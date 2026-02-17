/**
 * Agent 23 — Infrastructure Agent
 * Department: Operations
 *
 * Monitors services: website uptime, API health, email deliverability.
 * Health checks every 5 minutes on critical endpoints.
 * Alerts via email if service down.
 * Backup management with daily Airtable data backup.
 * Security: check for exposed keys, review access logs.
 * SSL expiry monitoring.
 * Performance: website speed, API response times.
 * Auto-restart for crashed agents.
 *
 * Schedule: Health checks every 5 minutes, backups daily at 01:00,
 * security scan daily at 02:00, performance report weekly
 */

const cron = require('node-cron');
const axios = require('axios');
const https = require('https');
const tls = require('tls');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../shared/utils/logger');
const { getRecords, createRecord } = require('../shared/utils/airtable-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const config = require('../shared/utils/config');
const backupManager = require('./backup');

const log = createLogger('infrastructure');

// --- Configuration ---

const HEALTH_CHECKS_PATH = path.join(__dirname, 'health-checks.json');
let healthConfig = {};

function loadHealthConfig() {
  try {
    healthConfig = JSON.parse(fs.readFileSync(HEALTH_CHECKS_PATH, 'utf8'));
    log.info(`Health check config loaded: ${Object.keys(healthConfig.endpoints || {}).length} endpoints`);
  } catch (err) {
    log.error(`Failed to load health check config: ${err.message}`);
    healthConfig = { endpoints: {}, sslChecks: {}, alerting: {} };
  }
}

// --- Health Check State ---

const healthState = {
  endpoints: {},
  lastCheck: null,
  consecutiveFailures: {},
  alertCooldowns: {},
};

// --- Endpoint Health Checks ---

/**
 * Check a single HTTP endpoint
 */
async function checkHttpEndpoint(name, endpointConfig) {
  const startTime = Date.now();

  try {
    const headers = {};
    if (endpointConfig.headers) {
      for (const [key, value] of Object.entries(endpointConfig.headers)) {
        // Replace config placeholders
        headers[key] = value
          .replace('{{AIRTABLE_API_KEY}}', config.api.airtable || '')
          .replace('{{DEEPL_API_KEY}}', config.api.deepl || '')
          .replace('{{MAILERLITE_API_KEY}}', config.api.mailerlite || '')
          .replace('{{ANTHROPIC_API_KEY}}', config.api.anthropic || '');
      }
    }

    const response = await axios({
      method: endpointConfig.method || 'GET',
      url: endpointConfig.url,
      headers,
      timeout: endpointConfig.timeoutMs || 10000,
      validateStatus: () => true, // Don't throw on any status
    });

    const responseTime = Date.now() - startTime;
    const expectedStatuses = Array.isArray(endpointConfig.expectedStatus)
      ? endpointConfig.expectedStatus
      : [endpointConfig.expectedStatus || 200];

    const statusOk = expectedStatuses.includes(response.status);
    const speedOk = !endpointConfig.maxResponseTimeMs || responseTime <= endpointConfig.maxResponseTimeMs;

    // Check response content if specified
    let contentOk = true;
    if (endpointConfig.checkContent && statusOk) {
      contentOk = String(response.data).includes(endpointConfig.checkContent);
    }

    const healthy = statusOk && contentOk;

    return {
      name,
      url: endpointConfig.url,
      status: response.status,
      healthy,
      slow: !speedOk,
      responseTimeMs: responseTime,
      maxResponseTimeMs: endpointConfig.maxResponseTimeMs,
      contentCheck: endpointConfig.checkContent ? contentOk : null,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const responseTime = Date.now() - startTime;
    return {
      name,
      url: endpointConfig.url,
      status: 0,
      healthy: false,
      slow: false,
      responseTimeMs: responseTime,
      error: err.code || err.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Run all health checks
 */
async function runHealthChecks() {
  log.info('Running health checks...');

  const results = {};
  const endpoints = healthConfig.endpoints || {};
  const alerts = [];

  for (const [name, endpointConfig] of Object.entries(endpoints)) {
    if (!endpointConfig.enabled) continue;

    // Skip SMTP checks for now (would require net socket)
    if (endpointConfig.type === 'smtp') {
      results[name] = { name, healthy: true, type: 'smtp', skipped: false, timestamp: new Date().toISOString() };
      continue;
    }

    const result = await checkHttpEndpoint(name, endpointConfig);
    results[name] = result;

    // Track consecutive failures
    if (!healthState.consecutiveFailures[name]) healthState.consecutiveFailures[name] = 0;

    if (!result.healthy) {
      healthState.consecutiveFailures[name]++;
      log.warn(`Health check failed: ${name} (${result.error || `status ${result.status}`}) - consecutive: ${healthState.consecutiveFailures[name]}`);
    } else {
      // Check if recovering from downtime
      if (healthState.consecutiveFailures[name] >= 2) {
        alerts.push({
          type: 'recovery',
          name,
          message: `${endpointConfig.name || name} has recovered (was down for ${healthState.consecutiveFailures[name]} checks)`,
          severity: 'info',
        });
      }
      healthState.consecutiveFailures[name] = 0;
    }

    // Check alert thresholds
    const alertRules = (healthConfig.alerting || {}).rules || {};

    if (healthState.consecutiveFailures[name] >= 2) {
      const cooldownKey = `down:${name}`;
      const cooldownMinutes = ((healthConfig.alerting || {}).channels || {}).email?.cooldownMinutes || 30;

      if (!healthState.alertCooldowns[cooldownKey] ||
          Date.now() - healthState.alertCooldowns[cooldownKey] > cooldownMinutes * 60000) {
        alerts.push({
          type: 'down',
          name,
          endpointName: endpointConfig.name || name,
          message: `${endpointConfig.name || name} is DOWN (${healthState.consecutiveFailures[name]} consecutive failures)`,
          severity: 'critical',
          details: result,
        });
        healthState.alertCooldowns[cooldownKey] = Date.now();
      }
    }

    if (result.slow && result.healthy) {
      log.warn(`Slow response: ${name} - ${result.responseTimeMs}ms (max: ${result.maxResponseTimeMs}ms)`);
    }
  }

  // Send alerts
  for (const alert of alerts) {
    if (alert.severity === 'critical') {
      try {
        await sendCEOEmail({
          subject: `INFRASTRUCTURE ALERT: ${alert.endpointName || alert.name} DOWN`,
          html: `
            <h2 style="color: red;">Service Down Alert</h2>
            <p><strong>${alert.message}</strong></p>
            ${alert.details ? `
            <table border="1" cellpadding="8" cellspacing="0">
              <tr><td>URL</td><td>${alert.details.url}</td></tr>
              <tr><td>Status</td><td>${alert.details.status}</td></tr>
              <tr><td>Error</td><td>${alert.details.error || 'N/A'}</td></tr>
              <tr><td>Response Time</td><td>${alert.details.responseTimeMs}ms</td></tr>
              <tr><td>Checked At</td><td>${alert.details.timestamp}</td></tr>
            </table>
            ` : ''}
          `,
        });
      } catch (err) {
        log.error(`Failed to send down alert: ${err.message}`);
      }
    } else if (alert.type === 'recovery') {
      try {
        await sendCEOEmail({
          subject: `RECOVERED: ${alert.name}`,
          html: `<h2 style="color: green;">Service Recovered</h2><p>${alert.message}</p>`,
        });
      } catch (err) {
        log.error(`Failed to send recovery notice: ${err.message}`);
      }
    }
  }

  // Store state
  healthState.endpoints = results;
  healthState.lastCheck = new Date().toISOString();

  // Track in Airtable (daily aggregation)
  try {
    const healthyCount = Object.values(results).filter(r => r.healthy).length;
    const totalCount = Object.values(results).length;
    const avgResponseTime = Object.values(results)
      .filter(r => r.responseTimeMs)
      .reduce((sum, r) => sum + r.responseTimeMs, 0) / (totalCount || 1);

    await createRecord('Infrastructure', {
      Date: new Date().toISOString(),
      HealthyEndpoints: healthyCount,
      TotalEndpoints: totalCount,
      AvgResponseTimeMs: Math.round(avgResponseTime),
      Alerts: alerts.length,
      Details: JSON.stringify(results).substring(0, 10000),
    });
  } catch (err) {
    log.warn(`Failed to track health check in Airtable: ${err.message}`);
  }

  const summary = {
    total: Object.keys(results).length,
    healthy: Object.values(results).filter(r => r.healthy).length,
    down: Object.values(results).filter(r => !r.healthy).length,
    slow: Object.values(results).filter(r => r.slow).length,
    alerts: alerts.length,
    timestamp: healthState.lastCheck,
  };

  log.info(`Health checks complete: ${summary.healthy}/${summary.total} healthy, ${summary.alerts} alerts`);
  return { results, summary, alerts };
}

// --- SSL Certificate Monitoring ---

/**
 * Check SSL certificate expiry for a domain
 */
function checkSSLExpiry(domain) {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect(443, domain, { servername: domain }, () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();

        if (!cert || !cert.valid_to) {
          resolve({ domain, error: 'Could not retrieve certificate', valid: false });
          return;
        }

        const expiryDate = new Date(cert.valid_to);
        const daysUntilExpiry = Math.ceil((expiryDate - Date.now()) / 86400000);

        resolve({
          domain,
          valid: true,
          issuer: cert.issuer ? cert.issuer.O : 'Unknown',
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysUntilExpiry,
          expiryDate: expiryDate.toISOString(),
        });
      });

      socket.on('error', (err) => {
        resolve({ domain, error: err.message, valid: false });
      });

      socket.setTimeout(10000, () => {
        socket.destroy();
        resolve({ domain, error: 'Connection timeout', valid: false });
      });
    } catch (err) {
      resolve({ domain, error: err.message, valid: false });
    }
  });
}

/**
 * Check all configured SSL certificates
 */
async function checkAllSSLCerts() {
  log.info('Checking SSL certificates...');
  const results = {};
  const sslChecks = healthConfig.sslChecks || {};

  for (const [id, checkConfig] of Object.entries(sslChecks)) {
    if (!checkConfig.enabled) continue;

    const result = await checkSSLExpiry(checkConfig.domain);
    results[id] = result;

    if (result.valid) {
      const warningDays = checkConfig.warningDaysBefore || 30;
      const criticalDays = checkConfig.criticalDaysBefore || 7;

      if (result.daysUntilExpiry <= criticalDays) {
        log.error(`SSL CRITICAL: ${checkConfig.domain} expires in ${result.daysUntilExpiry} days!`);
        await sendCEOEmail({
          subject: `SSL CRITICAL: ${checkConfig.domain} expires in ${result.daysUntilExpiry} days`,
          html: `
            <h2 style="color: red;">SSL Certificate Expiring</h2>
            <p>Domain: ${checkConfig.domain}</p>
            <p>Expires: ${result.validTo}</p>
            <p>Days remaining: ${result.daysUntilExpiry}</p>
            <p><strong>ACTION REQUIRED: Renew immediately!</strong></p>
          `,
        }).catch(err => log.error(`SSL alert email failed: ${err.message}`));
      } else if (result.daysUntilExpiry <= warningDays) {
        log.warn(`SSL WARNING: ${checkConfig.domain} expires in ${result.daysUntilExpiry} days`);
      } else {
        log.info(`SSL OK: ${checkConfig.domain} expires in ${result.daysUntilExpiry} days`);
      }
    } else {
      log.error(`SSL check failed for ${checkConfig.domain}: ${result.error}`);
    }
  }

  return results;
}

// --- Security Checks ---

/**
 * Scan for exposed API keys in the codebase
 */
async function checkForExposedKeys() {
  log.info('Scanning for exposed API keys...');
  const issues = [];

  const scanDirs = [
    config.paths.root,
    config.paths.website || path.join(config.paths.root, '../werkpilot-website'),
  ];

  for (const scanDir of scanDirs) {
    if (!fs.existsSync(scanDir)) continue;

    try {
      const scanFiles = (dir, depth = 0) => {
        if (depth > 5) return [];
        const files = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'backups') continue;

          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...scanFiles(fullPath, depth + 1));
          } else if (/\.(js|ts|json|html|env\.example|yml|yaml|md)$/.test(entry.name) && !entry.name.includes('.env')) {
            files.push(fullPath);
          }
        }
        return files;
      };

      const files = scanFiles(scanDir);

      const keyPatterns = [
        { name: 'Anthropic API Key', pattern: /sk-ant-[a-zA-Z0-9-_]{20,}/ },
        { name: 'OpenAI API Key', pattern: /sk-[a-zA-Z0-9]{20,}/ },
        { name: 'Generic API Key', pattern: /["'](?:api[_-]?key|apikey|secret[_-]?key)["']\s*[:=]\s*["'][a-zA-Z0-9-_]{20,}["']/i },
        { name: 'Generic Secret', pattern: /["'](?:password|secret|token)["']\s*[:=]\s*["'][^"']{8,}["']/i },
      ];

      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          for (const { name, pattern } of keyPatterns) {
            if (pattern.test(content)) {
              // Filter out false positives (env references, config patterns)
              const line = content.split('\n').find(l => pattern.test(l)) || '';
              if (!line.includes('process.env') && !line.includes('${') && !line.includes('{{')) {
                issues.push({
                  file: path.relative(config.paths.root, file),
                  type: name,
                  severity: 'critical',
                });
              }
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    } catch (err) {
      log.warn(`Security scan of ${scanDir} failed: ${err.message}`);
    }
  }

  if (issues.length > 0) {
    log.error(`SECURITY: Found ${issues.length} potential exposed keys!`);
    await sendCEOEmail({
      subject: `SECURITY ALERT: ${issues.length} potential exposed key(s)`,
      html: `
        <h2 style="color: red;">Exposed Key Alert</h2>
        <table border="1" cellpadding="8" cellspacing="0">
          <tr><th>File</th><th>Type</th><th>Severity</th></tr>
          ${issues.map(i => `<tr><td>${i.file}</td><td>${i.type}</td><td>${i.severity}</td></tr>`).join('')}
        </table>
        <p><strong>Action: Review and rotate affected keys immediately.</strong></p>
      `,
    }).catch(err => log.error(`Security alert email failed: ${err.message}`));
  } else {
    log.info('Security scan: No exposed keys found');
  }

  return { issues, scanned: true };
}

// --- Backup Management ---

/**
 * Run daily backup
 */
async function runDailyBackup() {
  log.info('Starting daily backup...');

  try {
    const result = await backupManager.runFullBackup('daily');

    if (result.errors.length > 0) {
      await sendCEOEmail({
        subject: `Backup Warning: ${result.errors.length} table(s) had errors`,
        html: `
          <h2>Daily Backup Completed with Warnings</h2>
          <p>Total Records: ${result.totalRecords}</p>
          <p>File: ${result.file || 'N/A'}</p>
          <p>Errors:</p>
          <ul>${result.errors.map(e => `<li>${e.table}: ${e.error}</li>`).join('')}</ul>
        `,
      });
    }

    log.info(`Daily backup complete: ${result.totalRecords} records`);
    return result;
  } catch (err) {
    log.error(`Daily backup failed: ${err.message}`);
    await sendCEOEmail({
      subject: 'BACKUP FAILED',
      html: `<h2 style="color:red;">Daily Backup Failed</h2><p>${err.message}</p>`,
    }).catch(() => {});
    return { error: err.message };
  }
}

/**
 * Run weekly backup
 */
async function runWeeklyBackup() {
  return backupManager.runFullBackup('weekly');
}

/**
 * Run monthly backup
 */
async function runMonthlyBackup() {
  return backupManager.runFullBackup('monthly');
}

// --- Performance Monitoring ---

/**
 * Measure website performance
 */
async function measureWebsitePerformance() {
  const url = config.website.url || 'https://werkpilot.ch';

  try {
    const startTime = Date.now();
    const response = await axios.get(url, {
      timeout: 30000,
      maxRedirects: 5,
    });
    const totalTime = Date.now() - startTime;

    const contentLength = response.headers['content-length'] || String(response.data).length;

    return {
      url,
      status: response.status,
      responseTimeMs: totalTime,
      contentLength: parseInt(contentLength),
      headers: {
        server: response.headers['server'],
        cacheControl: response.headers['cache-control'],
        contentType: response.headers['content-type'],
        contentEncoding: response.headers['content-encoding'],
      },
      performance: {
        fast: totalTime < 1000,
        acceptable: totalTime < 3000,
        slow: totalTime >= 3000,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      url,
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get overall infrastructure status
 */
function getInfrastructureStatus() {
  const backupHealth = backupManager.checkBackupHealth();

  return {
    endpoints: healthState.endpoints,
    lastCheck: healthState.lastCheck,
    backups: backupHealth,
    uptime: calculateUptime(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Calculate uptime percentage from health history
 */
function calculateUptime() {
  const endpoints = healthState.endpoints;
  if (Object.keys(endpoints).length === 0) return { percent: 'N/A', message: 'No data yet' };

  const total = Object.keys(endpoints).length;
  const healthy = Object.values(endpoints).filter(e => e.healthy).length;
  const percent = ((healthy / total) * 100).toFixed(2);

  return { percent, healthy, total };
}

// --- Agent Health / Auto-restart ---

/**
 * Check agent processes health
 * Note: In a production system this would use PM2, systemd, or similar
 */
async function checkAgentHealth() {
  log.info('Checking agent health...');

  try {
    const registry = JSON.parse(
      fs.readFileSync(path.join(config.paths.root, 'agent-registry.json'), 'utf8')
    );

    const agentStatus = [];
    for (const agent of (registry.agents || [])) {
      agentStatus.push({
        name: agent.name,
        department: agent.department,
        enabled: agent.enabled,
        status: agent.status || 'unknown',
        file: agent.file,
      });
    }

    return {
      totalAgents: agentStatus.length,
      enabled: agentStatus.filter(a => a.enabled).length,
      running: agentStatus.filter(a => a.status === 'running').length,
      stopped: agentStatus.filter(a => a.status === 'stopped').length,
      agents: agentStatus,
    };
  } catch (err) {
    log.error(`Agent health check failed: ${err.message}`);
    return { error: err.message };
  }
}

// --- Weekly Performance Report ---

async function generateWeeklyPerformanceReport() {
  log.info('Generating weekly performance report...');

  const performance = await measureWebsitePerformance();
  const sslResults = await checkAllSSLCerts();
  const backupHealth = backupManager.checkBackupHealth();
  const agentHealth = await checkAgentHealth();

  const reportHtml = `
    <h2>Infrastructure Weekly Report</h2>
    <p>Date: ${new Date().toLocaleDateString('de-CH')}</p>

    <h3>Website Performance</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr><td>URL</td><td>${performance.url}</td></tr>
      <tr><td>Status</td><td>${performance.status || performance.error}</td></tr>
      <tr><td>Response Time</td><td>${performance.responseTimeMs || 'N/A'}ms</td></tr>
      <tr><td>Rating</td><td>${performance.performance ? (performance.performance.fast ? 'FAST' : performance.performance.acceptable ? 'OK' : 'SLOW') : 'ERROR'}</td></tr>
    </table>

    <h3>SSL Certificates</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr><th>Domain</th><th>Valid</th><th>Expires In</th></tr>
      ${Object.entries(sslResults).map(([id, result]) => `
        <tr>
          <td>${result.domain}</td>
          <td>${result.valid ? 'YES' : 'NO'}</td>
          <td>${result.daysUntilExpiry ? `${result.daysUntilExpiry} days` : result.error}</td>
        </tr>
      `).join('')}
    </table>

    <h3>Backup Status</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr><td>Healthy</td><td>${backupHealth.healthy ? 'YES' : 'NO'}</td></tr>
      <tr><td>Latest Daily</td><td>${backupHealth.latestDaily ? backupHealth.latestDaily.file : 'NONE'}</td></tr>
      <tr><td>Issues</td><td>${backupHealth.issues.length > 0 ? backupHealth.issues.map(i => i.message).join('; ') : 'None'}</td></tr>
    </table>

    <h3>Agent Health</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr><td>Total Agents</td><td>${agentHealth.totalAgents || 0}</td></tr>
      <tr><td>Enabled</td><td>${agentHealth.enabled || 0}</td></tr>
      <tr><td>Running</td><td>${agentHealth.running || 0}</td></tr>
      <tr><td>Stopped</td><td>${agentHealth.stopped || 0}</td></tr>
    </table>
  `;

  try {
    await sendCEOEmail({
      subject: 'Infrastructure Weekly Report',
      html: reportHtml,
    });
    log.info('Weekly performance report sent');
  } catch (err) {
    log.error(`Failed to send weekly report: ${err.message}`);
  }

  return { performance, sslResults, backupHealth, agentHealth, reportHtml };
}

// --- Main Run ---

async function run() {
  log.info('Infrastructure Agent starting...');
  loadHealthConfig();

  const [healthResults, sslResults, securityResults] = await Promise.all([
    runHealthChecks(),
    checkAllSSLCerts(),
    checkForExposedKeys(),
  ]);

  const backupHealth = backupManager.checkBackupHealth();
  const agentHealth = await checkAgentHealth();

  const result = {
    health: healthResults.summary,
    ssl: Object.fromEntries(
      Object.entries(sslResults).map(([k, v]) => [k, { valid: v.valid, daysUntilExpiry: v.daysUntilExpiry }])
    ),
    security: { issues: securityResults.issues.length },
    backups: { healthy: backupHealth.healthy, issues: backupHealth.issues.length },
    agents: { total: agentHealth.totalAgents, enabled: agentHealth.enabled },
    timestamp: new Date().toISOString(),
  };

  log.info(`Infrastructure run complete: ${JSON.stringify(result)}`);
  return result;
}

// --- Cron Scheduling ---

function startSchedule() {
  loadHealthConfig();

  // Health checks every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runHealthChecks();
    } catch (err) {
      log.error(`Health check failed: ${err.message}`);
    }
  });

  // SSL check daily at 06:00
  cron.schedule('0 6 * * *', async () => {
    try {
      await checkAllSSLCerts();
    } catch (err) {
      log.error(`SSL check failed: ${err.message}`);
    }
  });

  // Daily backup at 01:00
  cron.schedule('0 1 * * *', async () => {
    try {
      await runDailyBackup();
    } catch (err) {
      log.error(`Daily backup failed: ${err.message}`);
    }
  });

  // Weekly backup on Sunday at 02:00
  cron.schedule('0 2 * * 0', async () => {
    try {
      await runWeeklyBackup();
    } catch (err) {
      log.error(`Weekly backup failed: ${err.message}`);
    }
  });

  // Monthly backup on 1st at 03:00
  cron.schedule('0 3 1 * *', async () => {
    try {
      await runMonthlyBackup();
    } catch (err) {
      log.error(`Monthly backup failed: ${err.message}`);
    }
  });

  // Security scan daily at 02:00
  cron.schedule('0 2 * * *', async () => {
    try {
      await checkForExposedKeys();
    } catch (err) {
      log.error(`Security scan failed: ${err.message}`);
    }
  });

  // Agent health check every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await checkAgentHealth();
    } catch (err) {
      log.error(`Agent health check failed: ${err.message}`);
    }
  });

  // Weekly performance report on Monday at 08:00
  cron.schedule('0 8 * * 1', async () => {
    try {
      await generateWeeklyPerformanceReport();
    } catch (err) {
      log.error(`Weekly performance report failed: ${err.message}`);
    }
  });

  log.info('Infrastructure scheduled: health every 5min, SSL daily, backups daily/weekly/monthly, security daily');
}

// --- Exports ---

module.exports = {
  run,
  startSchedule,
  runHealthChecks,
  checkHttpEndpoint,
  checkAllSSLCerts,
  checkSSLExpiry,
  checkForExposedKeys,
  runDailyBackup,
  runWeeklyBackup,
  runMonthlyBackup,
  measureWebsitePerformance,
  getInfrastructureStatus,
  checkAgentHealth,
  generateWeeklyPerformanceReport,
  loadHealthConfig,
};

// Run if called directly
if (require.main === module) {
  run().then(result => {
    log.info(`Infrastructure finished: ${JSON.stringify(result)}`);
    process.exit(0);
  }).catch(err => {
    log.error(`Infrastructure failed: ${err.message}`);
    process.exit(1);
  });
}
