/**
 * Agent 43 — Infrastructure Monitor Agent
 *
 * Monitors infrastructure health including endpoint availability, response times,
 * SSL certificate expiry, disk space, memory/CPU usage, and syncs metrics to dashboard.
 * Provides comprehensive monitoring for all Werkpilot services.
 *
 * Schedule: Health checks every 5 min, metric aggregation every 15 min,
 *           SSL checks daily at 01:00, capacity planning weekly Monday at 07:00.
 */

const cron = require('node-cron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('it-infrastructure-monitor');

// ── Constants ────────────────────────────────────────────────────────────────

const TABLES = {
  ENDPOINT_HEALTH: 'EndpointHealth',
  RESPONSE_TIMES: 'ResponseTimes',
  SSL_CERTIFICATES: 'SSLCertificates',
  RESOURCE_USAGE: 'ResourceUsage',
  ALERTS: 'InfrastructureAlerts',
  CAPACITY_REPORTS: 'CapacityReports',
};

// Werkpilot service endpoints to monitor
const ENDPOINTS = {
  website: {
    url: config.endpoints?.website || 'https://werkpilot.ch',
    name: 'Werkpilot Website',
    critical: true,
    expectedStatus: 200,
  },
  dashboard: {
    url: config.endpoints?.dashboard || 'https://dashboard.werkpilot.ch',
    name: 'Werkpilot Dashboard',
    critical: true,
    expectedStatus: 200,
  },
  orchestrator: {
    url: config.endpoints?.orchestrator || 'http://localhost:3000/health',
    name: 'Agent Orchestrator',
    critical: true,
    expectedStatus: 200,
  },
  insideSalesBot: {
    url: config.endpoints?.insideSalesBot || 'http://localhost:3001/health',
    name: 'Inside Sales Bot',
    critical: false,
    expectedStatus: 200,
  },
};

// Alert thresholds
const THRESHOLDS = {
  responseTime: {
    warning: 2000,    // 2 seconds
    critical: 5000,   // 5 seconds
  },
  sslExpiry: {
    warning: 30,      // 30 days
    critical: 7,      // 7 days
  },
  diskSpace: {
    warning: 80,      // 80% used
    critical: 90,     // 90% used
  },
  memory: {
    warning: 80,      // 80% used
    critical: 90,     // 90% used
  },
  cpu: {
    warning: 75,      // 75% usage
    critical: 90,     // 90% usage
  },
};

const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  CRITICAL: 'critical',
  DOWN: 'down',
};

// In-memory metrics for trending
const metricsHistory = {
  responseTime: [],
  memory: [],
  cpu: [],
  diskSpace: [],
};

// ── Endpoint Health Checks ───────────────────────────────────────────────────

/**
 * Check health of a single endpoint.
 */
async function checkEndpoint(endpoint) {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const url = new URL(endpoint.url);
    const protocol = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      timeout: 10000,
      headers: {
        'User-Agent': 'Werkpilot-Monitor/1.0',
      },
    };

    const req = protocol.request(options, (res) => {
      const responseTime = Date.now() - startTime;
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const status = determineHealthStatus(res.statusCode, responseTime, endpoint);

        resolve({
          name: endpoint.name,
          url: endpoint.url,
          status,
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date().toISOString(),
          error: null,
          headers: res.headers,
        });
      });
    });

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      resolve({
        name: endpoint.name,
        url: endpoint.url,
        status: HEALTH_STATUS.DOWN,
        statusCode: null,
        responseTime,
        timestamp: new Date().toISOString(),
        error: error.message,
        headers: {},
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      resolve({
        name: endpoint.name,
        url: endpoint.url,
        status: HEALTH_STATUS.DOWN,
        statusCode: null,
        responseTime,
        timestamp: new Date().toISOString(),
        error: 'Request timeout',
        headers: {},
      });
    });

    req.end();
  });
}

/**
 * Determine health status based on response.
 */
function determineHealthStatus(statusCode, responseTime, endpoint) {
  if (!statusCode || statusCode !== endpoint.expectedStatus) {
    return HEALTH_STATUS.DOWN;
  }

  if (responseTime > THRESHOLDS.responseTime.critical) {
    return HEALTH_STATUS.CRITICAL;
  }

  if (responseTime > THRESHOLDS.responseTime.warning) {
    return HEALTH_STATUS.WARNING;
  }

  return HEALTH_STATUS.HEALTHY;
}

/**
 * Check all endpoints and report results.
 */
async function checkAllEndpoints() {
  logger.info('Checking all endpoint health...');
  const results = [];

  for (const [key, endpoint] of Object.entries(ENDPOINTS)) {
    try {
      const result = await checkEndpoint(endpoint);
      results.push(result);

      logger.info(`  ${result.name}: ${result.status} (${result.responseTime}ms)`);

      // Store result
      await createRecord(TABLES.ENDPOINT_HEALTH, {
        EndpointKey: key,
        EndpointName: result.name,
        URL: result.url,
        Status: result.status,
        StatusCode: result.statusCode,
        ResponseTimeMs: result.responseTime,
        Error: result.error,
        CheckedAt: result.timestamp,
      });

      // Track response time for trending
      metricsHistory.responseTime.push({
        endpoint: key,
        value: result.responseTime,
        timestamp: result.timestamp,
      });

      // Alert on issues
      if (result.status === HEALTH_STATUS.DOWN ||
          (result.status === HEALTH_STATUS.CRITICAL && endpoint.critical)) {
        await alertEndpointIssue(result, endpoint);
      }

    } catch (error) {
      logger.error(`Failed to check ${endpoint.name}: ${error.message}`);
    }
  }

  // Trim history to last 1000 entries
  if (metricsHistory.responseTime.length > 1000) {
    metricsHistory.responseTime = metricsHistory.responseTime.slice(-1000);
  }

  return results;
}

/**
 * Alert when endpoint has issues.
 */
async function alertEndpointIssue(result, endpoint) {
  const severity = result.status === HEALTH_STATUS.DOWN ? 'critical' : 'warning';

  try {
    await createRecord(TABLES.ALERTS, {
      Type: 'endpoint_health',
      Severity: severity,
      EndpointName: result.name,
      Status: result.status,
      Message: result.error || `Response time: ${result.responseTime}ms`,
      OccurredAt: result.timestamp,
    });

    if (endpoint.critical || severity === 'critical') {
      await sendCEOEmail({
        subject: `🚨 ${severity.toUpperCase()}: ${result.name} is ${result.status}`,
        html: `
          <h2 style="color: #e74c3c;">Endpoint Alert: ${result.name}</h2>
          <p><strong>Status:</strong> ${result.status.toUpperCase()}</p>
          <p><strong>URL:</strong> ${result.url}</p>
          <p><strong>Status Code:</strong> ${result.statusCode || 'N/A'}</p>
          <p><strong>Response Time:</strong> ${result.responseTime}ms</p>
          ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
          <p><strong>Time:</strong> ${result.timestamp}</p>
          <p style="margin-top: 20px; color: #888;">
            This is a ${endpoint.critical ? 'CRITICAL' : 'non-critical'} endpoint.
            ${result.status === HEALTH_STATUS.DOWN ? 'Immediate action required.' : 'Please investigate.'}
          </p>
        `,
      });
    }
  } catch (error) {
    logger.error(`Failed to alert endpoint issue: ${error.message}`);
  }
}

// ── Response Time Tracking ───────────────────────────────────────────────────

/**
 * Aggregate and analyze response time trends.
 */
async function analyzeResponseTimeTrends() {
  logger.info('Analyzing response time trends...');

  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentTimes = await getRecords(
      TABLES.RESPONSE_TIMES,
      `{CheckedAt} >= "${last24h}"`
    );

    // Aggregate by endpoint
    const byEndpoint = {};
    for (const record of recentTimes) {
      const key = record.EndpointKey;
      if (!byEndpoint[key]) {
        byEndpoint[key] = {
          key,
          name: record.EndpointName,
          samples: 0,
          avg: 0,
          min: Infinity,
          max: 0,
          p95: 0,
          total: 0,
        };
      }

      const rt = record.ResponseTimeMs || 0;
      const stats = byEndpoint[key];
      stats.samples++;
      stats.total += rt;
      stats.min = Math.min(stats.min, rt);
      stats.max = Math.max(stats.max, rt);
    }

    // Calculate averages and percentiles
    const trends = [];
    for (const stats of Object.values(byEndpoint)) {
      stats.avg = Math.round(stats.total / stats.samples);

      // Get recent samples for this endpoint
      const samples = recentTimes
        .filter(r => r.EndpointKey === stats.key)
        .map(r => r.ResponseTimeMs)
        .sort((a, b) => a - b);

      stats.p95 = samples[Math.floor(samples.length * 0.95)] || stats.max;

      // Detect degradation
      if (stats.avg > THRESHOLDS.responseTime.warning) {
        stats.issue = 'High average response time';
      }
      if (stats.p95 > THRESHOLDS.responseTime.critical) {
        stats.issue = 'P95 exceeds critical threshold';
      }

      trends.push(stats);
    }

    logger.info(`Analyzed trends for ${trends.length} endpoints`);
    return trends;
  } catch (error) {
    logger.error(`Response time trend analysis failed: ${error.message}`);
    return [];
  }
}

// ── SSL Certificate Monitoring ───────────────────────────────────────────────

/**
 * Check SSL certificate expiry for HTTPS endpoints.
 */
async function checkSSLCertificates() {
  logger.info('Checking SSL certificates...');
  const results = [];

  for (const [key, endpoint] of Object.entries(ENDPOINTS)) {
    if (!endpoint.url.startsWith('https://')) continue;

    try {
      const url = new URL(endpoint.url);
      const certInfo = await getSSLCertificate(url.hostname);

      if (certInfo) {
        const daysUntilExpiry = Math.floor(
          (certInfo.validTo - Date.now()) / (1000 * 60 * 60 * 24)
        );

        let status = HEALTH_STATUS.HEALTHY;
        if (daysUntilExpiry <= THRESHOLDS.sslExpiry.critical) {
          status = HEALTH_STATUS.CRITICAL;
        } else if (daysUntilExpiry <= THRESHOLDS.sslExpiry.warning) {
          status = HEALTH_STATUS.WARNING;
        }

        const result = {
          endpointKey: key,
          endpointName: endpoint.name,
          hostname: url.hostname,
          issuer: certInfo.issuer,
          validFrom: certInfo.validFrom,
          validTo: certInfo.validTo,
          daysUntilExpiry,
          status,
        };

        results.push(result);

        logger.info(`  ${endpoint.name}: expires in ${daysUntilExpiry} days (${status})`);

        // Store certificate info
        await createRecord(TABLES.SSL_CERTIFICATES, {
          EndpointKey: key,
          EndpointName: endpoint.name,
          Hostname: url.hostname,
          Issuer: certInfo.issuer,
          ValidFrom: new Date(certInfo.validFrom).toISOString(),
          ValidTo: new Date(certInfo.validTo).toISOString(),
          DaysUntilExpiry: daysUntilExpiry,
          Status: status,
          CheckedAt: new Date().toISOString(),
        });

        // Alert on expiring certificates
        if (status !== HEALTH_STATUS.HEALTHY) {
          await alertSSLExpiry(result);
        }
      }
    } catch (error) {
      logger.error(`SSL check failed for ${endpoint.name}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Get SSL certificate details for a hostname.
 */
function getSSLCertificate(hostname) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      method: 'GET',
      agent: false,
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      const cert = res.socket.getPeerCertificate();

      if (cert && cert.subject) {
        resolve({
          issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
          validFrom: new Date(cert.valid_from).getTime(),
          validTo: new Date(cert.valid_to).getTime(),
          subject: cert.subject?.CN || hostname,
        });
      } else {
        reject(new Error('No certificate found'));
      }

      req.abort();
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Alert when SSL certificate is expiring.
 */
async function alertSSLExpiry(result) {
  const severity = result.status === HEALTH_STATUS.CRITICAL ? 'critical' : 'warning';

  try {
    await createRecord(TABLES.ALERTS, {
      Type: 'ssl_expiry',
      Severity: severity,
      EndpointName: result.endpointName,
      Message: `SSL certificate expires in ${result.daysUntilExpiry} days`,
      OccurredAt: new Date().toISOString(),
    });

    await sendCEOEmail({
      subject: `🔒 SSL Certificate ${severity.toUpperCase()}: ${result.endpointName}`,
      html: `
        <h2 style="color: ${severity === 'critical' ? '#e74c3c' : '#f39c12'};">
          SSL Certificate Expiry Warning
        </h2>
        <p><strong>Endpoint:</strong> ${result.endpointName}</p>
        <p><strong>Hostname:</strong> ${result.hostname}</p>
        <p><strong>Days Until Expiry:</strong> ${result.daysUntilExpiry}</p>
        <p><strong>Valid Until:</strong> ${new Date(result.validTo).toLocaleString()}</p>
        <p><strong>Issuer:</strong> ${result.issuer}</p>
        <p style="margin-top: 20px;">
          ${severity === 'critical'
            ? '⚠️ URGENT: Certificate expires in less than 7 days. Renew immediately!'
            : 'Please schedule certificate renewal soon.'}
        </p>
      `,
    });
  } catch (error) {
    logger.error(`Failed to alert SSL expiry: ${error.message}`);
  }
}

// ── Resource Usage Monitoring ────────────────────────────────────────────────

/**
 * Monitor disk space, memory, and CPU usage.
 */
async function monitorResourceUsage() {
  logger.info('Monitoring resource usage...');

  try {
    const usage = await collectResourceMetrics();

    // Store metrics
    await createRecord(TABLES.RESOURCE_USAGE, {
      DiskUsedPercent: usage.disk.usedPercent,
      DiskFreeGB: usage.disk.freeGB,
      MemoryUsedPercent: usage.memory.usedPercent,
      MemoryFreeGB: usage.memory.freeGB,
      CPUUsagePercent: usage.cpu.usagePercent,
      LoadAverage: usage.cpu.loadAverage,
      CollectedAt: new Date().toISOString(),
    });

    // Track for trending
    metricsHistory.diskSpace.push({
      value: usage.disk.usedPercent,
      timestamp: new Date().toISOString(),
    });
    metricsHistory.memory.push({
      value: usage.memory.usedPercent,
      timestamp: new Date().toISOString(),
    });
    metricsHistory.cpu.push({
      value: usage.cpu.usagePercent,
      timestamp: new Date().toISOString(),
    });

    // Trim history
    ['diskSpace', 'memory', 'cpu'].forEach(key => {
      if (metricsHistory[key].length > 1000) {
        metricsHistory[key] = metricsHistory[key].slice(-1000);
      }
    });

    // Check thresholds and alert
    const alerts = [];

    if (usage.disk.usedPercent >= THRESHOLDS.diskSpace.critical) {
      alerts.push({ type: 'disk', severity: 'critical', value: usage.disk.usedPercent });
    } else if (usage.disk.usedPercent >= THRESHOLDS.diskSpace.warning) {
      alerts.push({ type: 'disk', severity: 'warning', value: usage.disk.usedPercent });
    }

    if (usage.memory.usedPercent >= THRESHOLDS.memory.critical) {
      alerts.push({ type: 'memory', severity: 'critical', value: usage.memory.usedPercent });
    } else if (usage.memory.usedPercent >= THRESHOLDS.memory.warning) {
      alerts.push({ type: 'memory', severity: 'warning', value: usage.memory.usedPercent });
    }

    if (usage.cpu.usagePercent >= THRESHOLDS.cpu.critical) {
      alerts.push({ type: 'cpu', severity: 'critical', value: usage.cpu.usagePercent });
    } else if (usage.cpu.usagePercent >= THRESHOLDS.cpu.warning) {
      alerts.push({ type: 'cpu', severity: 'warning', value: usage.cpu.usagePercent });
    }

    if (alerts.length > 0) {
      await alertResourceIssues(alerts, usage);
    }

    logger.info(
      `Resources: Disk ${usage.disk.usedPercent}%, Memory ${usage.memory.usedPercent}%, ` +
      `CPU ${usage.cpu.usagePercent}%`
    );

    return usage;
  } catch (error) {
    logger.error(`Resource monitoring failed: ${error.message}`);
    return null;
  }
}

/**
 * Collect system resource metrics.
 */
async function collectResourceMetrics() {
  const os = require('os');

  // Disk space (approximate from file system)
  let diskStats = { usedPercent: 0, freeGB: 0, totalGB: 0 };
  try {
    const { execSync } = require('child_process');
    const dfOutput = execSync('df -BG / | tail -1').toString();
    const parts = dfOutput.split(/\s+/);
    const totalGB = parseInt(parts[1]);
    const usedGB = parseInt(parts[2]);
    const freeGB = parseInt(parts[3]);
    diskStats = {
      totalGB,
      usedGB,
      freeGB,
      usedPercent: Math.round((usedGB / totalGB) * 100),
    };
  } catch (error) {
    logger.warn(`Could not collect disk stats: ${error.message}`);
  }

  // Memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryStats = {
    totalGB: (totalMem / (1024 ** 3)).toFixed(2),
    freeGB: (freeMem / (1024 ** 3)).toFixed(2),
    usedGB: (usedMem / (1024 ** 3)).toFixed(2),
    usedPercent: Math.round((usedMem / totalMem) * 100),
  };

  // CPU (use load average as proxy)
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const cpuUsagePercent = Math.min(100, Math.round((loadAvg[0] / cpuCount) * 100));

  return {
    disk: diskStats,
    memory: memoryStats,
    cpu: {
      usagePercent: cpuUsagePercent,
      loadAverage: loadAvg[0].toFixed(2),
      cores: cpuCount,
    },
  };
}

/**
 * Alert when resource usage exceeds thresholds.
 */
async function alertResourceIssues(alerts, usage) {
  for (const alert of alerts) {
    await createRecord(TABLES.ALERTS, {
      Type: 'resource_usage',
      Severity: alert.severity,
      ResourceType: alert.type,
      Message: `${alert.type.toUpperCase()} usage at ${alert.value}%`,
      OccurredAt: new Date().toISOString(),
    });
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  if (criticalAlerts.length > 0) {
    const alertRows = alerts.map(a => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${a.type.toUpperCase()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${a.severity === 'critical' ? '#e74c3c' : '#f39c12'};">
          ${a.severity.toUpperCase()}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${a.value}%</td>
      </tr>
    `).join('');

    await sendCEOEmail({
      subject: `⚠️ RESOURCE ALERT: ${criticalAlerts.length} critical issue(s)`,
      html: `
        <h2 style="color: #e74c3c;">Resource Usage Alert</h2>
        <p>${alerts.length} resource threshold(s) exceeded:</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f5f5f5;">
            <th style="padding: 8px; text-align: left;">Resource</th>
            <th style="padding: 8px; text-align: left;">Severity</th>
            <th style="padding: 8px; text-align: left;">Usage</th>
          </tr>
          ${alertRows}
        </table>
        <h3>Current Usage:</h3>
        <ul>
          <li><strong>Disk:</strong> ${usage.disk.usedPercent}% (${usage.disk.freeGB}GB free)</li>
          <li><strong>Memory:</strong> ${usage.memory.usedPercent}% (${usage.memory.freeGB}GB free)</li>
          <li><strong>CPU:</strong> ${usage.cpu.usagePercent}% (Load: ${usage.cpu.loadAverage})</li>
        </ul>
      `,
    });
  }
}

// ── Capacity Planning & Trending ─────────────────────────────────────────────

/**
 * Generate capacity planning report with trend analysis.
 */
async function generateCapacityReport() {
  logger.info('Generating capacity planning report...');

  try {
    // Get historical data
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const resourceHistory = await getRecords(
      TABLES.RESOURCE_USAGE,
      `{CollectedAt} >= "${last30Days}"`
    );

    // Calculate trends
    const trends = {
      disk: calculateTrend(resourceHistory.map(r => ({
        value: r.DiskUsedPercent,
        timestamp: r.CollectedAt,
      }))),
      memory: calculateTrend(resourceHistory.map(r => ({
        value: r.MemoryUsedPercent,
        timestamp: r.CollectedAt,
      }))),
      cpu: calculateTrend(resourceHistory.map(r => ({
        value: r.CPUUsagePercent,
        timestamp: r.CollectedAt,
      }))),
    };

    // AI-powered analysis
    const analysis = await generateJSON(
      `Analyze this infrastructure capacity data and provide recommendations.

Resource Usage Trends (30 days):
- Disk: Current ${trends.disk.current}%, Avg ${trends.disk.avg}%, Trend: ${trends.disk.trend}
- Memory: Current ${trends.memory.current}%, Avg ${trends.memory.avg}%, Trend: ${trends.memory.trend}
- CPU: Current ${trends.cpu.current}%, Avg ${trends.cpu.avg}%, Trend: ${trends.cpu.trend}

Provide analysis as JSON:
{
  "summary": "2-3 sentence overview",
  "capacityStatus": "healthy|warning|critical",
  "projectedCapacityIssues": [{"resource": "...", "daysUntilThreshold": 0, "action": "..."}],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "estimatedMonthsUntilUpgrade": 0
}`,
      { model: config.models.standard, maxTokens: 1000 }
    );

    const report = {
      period: 'Last 30 days',
      trends,
      analysis,
      generatedAt: new Date().toISOString(),
    };

    // Store report
    await createRecord(TABLES.CAPACITY_REPORTS, {
      Period: report.period,
      DiskTrend: trends.disk.trend,
      MemoryTrend: trends.memory.trend,
      CPUTrend: trends.cpu.trend,
      CapacityStatus: analysis.capacityStatus,
      Summary: analysis.summary,
      RecommendationsJSON: JSON.stringify(analysis.recommendations),
      GeneratedAt: report.generatedAt,
    });

    logger.info(`Capacity report: ${analysis.capacityStatus} - ${analysis.recommendations.length} recommendations`);
    return report;
  } catch (error) {
    logger.error(`Capacity report generation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate trend from time series data.
 */
function calculateTrend(data) {
  if (!data || data.length === 0) {
    return { current: 0, avg: 0, min: 0, max: 0, trend: 'stable' };
  }

  const values = data.map(d => d.value).filter(v => v != null);
  const current = values[values.length - 1] || 0;
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Simple trend: compare first half vs second half
  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  let trend = 'stable';
  if (secondAvg > firstAvg + 5) trend = 'increasing';
  if (secondAvg < firstAvg - 5) trend = 'decreasing';

  return { current, avg, min, max, trend };
}

// ── Dashboard Sync ───────────────────────────────────────────────────────────

/**
 * Sync all metrics to dashboard for visualization.
 */
async function syncMetricsToDashboard() {
  logger.info('Syncing metrics to dashboard...');

  try {
    // This would integrate with the Werkpilot dashboard
    // For now, we ensure all recent metrics are in Airtable

    const metrics = {
      endpoints: await getRecords(TABLES.ENDPOINT_HEALTH, '', 10),
      ssl: await getRecords(TABLES.SSL_CERTIFICATES, '', 10),
      resources: await getRecords(TABLES.RESOURCE_USAGE, '', 10),
      alerts: await getRecords(TABLES.ALERTS, '{Resolved} != TRUE', 20),
    };

    logger.info(
      `Dashboard sync: ${metrics.endpoints.length} endpoint checks, ` +
      `${metrics.ssl.length} SSL certs, ${metrics.alerts.length} active alerts`
    );

    return metrics;
  } catch (error) {
    logger.error(`Dashboard sync failed: ${error.message}`);
    return null;
  }
}

// ── Main Runs ────────────────────────────────────────────────────────────────

/**
 * Quick health check (every 5 min).
 */
async function runHealthCheck() {
  logger.info('=== Infrastructure Health Check ===');
  const startTime = Date.now();

  try {
    await checkAllEndpoints();
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Health check completed in ${duration}s ===`);
}

/**
 * Metric aggregation (every 15 min).
 */
async function runMetricAggregation() {
  logger.info('=== Metric Aggregation ===');
  const startTime = Date.now();

  try {
    await monitorResourceUsage();
    await analyzeResponseTimeTrends();
    await syncMetricsToDashboard();
  } catch (error) {
    logger.error(`Metric aggregation failed: ${error.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Metric aggregation completed in ${duration}s ===`);
}

/**
 * SSL certificate check (daily at 01:00).
 */
async function runSSLCheck() {
  logger.info('=== SSL Certificate Check ===');
  const startTime = Date.now();

  try {
    await checkSSLCertificates();
  } catch (error) {
    logger.error(`SSL check failed: ${error.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== SSL check completed in ${duration}s ===`);
}

/**
 * Capacity planning (weekly Monday at 07:00).
 */
async function runCapacityPlanning() {
  logger.info('=== Capacity Planning ===');
  const startTime = Date.now();

  try {
    const report = await generateCapacityReport();

    // Send report if there are concerns
    if (report && report.analysis.capacityStatus !== 'healthy') {
      await sendCEOEmail({
        subject: `Capacity Planning: ${report.analysis.capacityStatus.toUpperCase()}`,
        html: `
          <h2>Infrastructure Capacity Report</h2>
          <p>${report.period}</p>
          <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <strong>Status:</strong> ${report.analysis.capacityStatus.toUpperCase()}<br>
            <strong>Summary:</strong> ${report.analysis.summary}
          </div>
          <h3>Trends:</h3>
          <ul>
            <li><strong>Disk:</strong> ${report.trends.disk.current}% (${report.trends.disk.trend})</li>
            <li><strong>Memory:</strong> ${report.trends.memory.current}% (${report.trends.memory.trend})</li>
            <li><strong>CPU:</strong> ${report.trends.cpu.current}% (${report.trends.cpu.trend})</li>
          </ul>
          <h3>Recommendations:</h3>
          <ol>${report.analysis.recommendations.map(r => `<li>${r}</li>`).join('')}</ol>
        `,
      });
    }
  } catch (error) {
    logger.error(`Capacity planning failed: ${error.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Capacity planning completed in ${duration}s ===`);
}

// ── Cron Scheduling ──────────────────────────────────────────────────────────

// Health checks every 5 minutes
cron.schedule('*/5 * * * *', () => {
  runHealthCheck().catch(err => logger.error(`Cron health check error: ${err.message}`));
});

// Metric aggregation every 15 minutes
cron.schedule('*/15 * * * *', () => {
  runMetricAggregation().catch(err => logger.error(`Cron metric error: ${err.message}`));
});

// SSL certificate check daily at 01:00
cron.schedule('0 1 * * *', () => {
  runSSLCheck().catch(err => logger.error(`Cron SSL check error: ${err.message}`));
});

// Capacity planning weekly on Mondays at 07:00
cron.schedule('0 7 * * 1', () => {
  runCapacityPlanning().catch(err => logger.error(`Cron capacity error: ${err.message}`));
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runHealthCheck,
  runMetricAggregation,
  runSSLCheck,
  runCapacityPlanning,
  checkAllEndpoints,
  checkSSLCertificates,
  monitorResourceUsage,
  analyzeResponseTimeTrends,
  generateCapacityReport,
  syncMetricsToDashboard,
};

// Run immediately if executed directly
if (require.main === module) {
  runHealthCheck()
    .then(() => logger.info('Manual health check completed'))
    .catch(err => logger.error(`Manual run failed: ${err.message}`));
}
