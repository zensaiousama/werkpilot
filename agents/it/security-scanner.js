/**
 * Agent 44 — Security Scanner Agent
 *
 * Comprehensive security monitoring including dependency vulnerability scanning,
 * SSL/TLS configuration grading, HTTP security header auditing, API key rotation
 * tracking, and security report generation.
 *
 * Schedule: Dependency check daily at 02:00, security headers check every 6h,
 *           SSL audit daily at 03:00, rotation reminders weekly Monday at 08:00,
 *           full security report monthly on 1st at 04:00.
 */

const cron = require('node-cron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('it-security-scanner');

// ── Constants ────────────────────────────────────────────────────────────────

const TABLES = {
  VULNERABILITIES: 'SecurityVulnerabilities',
  SSL_AUDIT: 'SSLAudit',
  HEADER_AUDIT: 'SecurityHeaderAudit',
  API_KEY_ROTATIONS: 'APIKeyRotations',
  SECURITY_REPORTS: 'SecurityReports',
};

const SEVERITY_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
};

// Known vulnerable package patterns (simplified - in production use actual CVE database)
const KNOWN_VULNERABILITIES = {
  'lodash': { versions: ['<4.17.21'], cve: 'CVE-2021-23337', severity: 'high' },
  'axios': { versions: ['<0.21.1'], cve: 'CVE-2020-28168', severity: 'medium' },
  'express': { versions: ['<4.17.3'], cve: 'CVE-2022-24999', severity: 'high' },
};

// Required security headers
const REQUIRED_HEADERS = {
  'strict-transport-security': {
    name: 'Strict-Transport-Security',
    required: true,
    expectedPattern: /max-age=\d+/,
    severity: 'high',
    description: 'Forces HTTPS connections',
  },
  'x-frame-options': {
    name: 'X-Frame-Options',
    required: true,
    expectedValues: ['DENY', 'SAMEORIGIN'],
    severity: 'medium',
    description: 'Prevents clickjacking attacks',
  },
  'x-content-type-options': {
    name: 'X-Content-Type-Options',
    required: true,
    expectedValues: ['nosniff'],
    severity: 'medium',
    description: 'Prevents MIME type sniffing',
  },
  'content-security-policy': {
    name: 'Content-Security-Policy',
    required: true,
    severity: 'high',
    description: 'Controls resource loading',
  },
  'x-xss-protection': {
    name: 'X-XSS-Protection',
    required: false,
    expectedValues: ['1; mode=block', '0'],
    severity: 'low',
    description: 'XSS filtering (deprecated but still useful)',
  },
  'referrer-policy': {
    name: 'Referrer-Policy',
    required: true,
    expectedValues: ['strict-origin-when-cross-origin', 'no-referrer', 'same-origin'],
    severity: 'low',
    description: 'Controls referrer information',
  },
  'permissions-policy': {
    name: 'Permissions-Policy',
    required: false,
    severity: 'low',
    description: 'Controls browser features',
  },
};

// API keys to track rotation
const API_KEYS = [
  { name: 'Anthropic API Key', envVar: 'ANTHROPIC_API_KEY', rotationDays: 90 },
  { name: 'Airtable API Key', envVar: 'AIRTABLE_API_KEY', rotationDays: 180 },
  { name: 'Mailerlite API Key', envVar: 'MAILERLITE_API_KEY', rotationDays: 180 },
  { name: 'Gmail App Password', envVar: 'GMAIL_APP_PASSWORD', rotationDays: 90 },
  { name: 'Google Workspace Token', envVar: 'GOOGLE_WORKSPACE_TOKEN', rotationDays: 365 },
];

// ── Dependency Vulnerability Scanning ────────────────────────────────────────

/**
 * Scan package.json for dependencies with known vulnerabilities.
 */
async function scanDependencyVulnerabilities() {
  logger.info('Scanning dependencies for vulnerabilities...');
  const vulnerabilities = [];

  try {
    // Find all package.json files
    const packageFiles = findPackageJsonFiles();
    logger.info(`Found ${packageFiles.length} package.json file(s)`);

    for (const pkgPath of packageFiles) {
      const pkgData = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const projectName = path.dirname(pkgPath).split('/').pop();

      // Check dependencies
      const allDeps = {
        ...pkgData.dependencies,
        ...pkgData.devDependencies,
      };

      for (const [pkgName, version] of Object.entries(allDeps)) {
        const vulnInfo = KNOWN_VULNERABILITIES[pkgName];

        if (vulnInfo) {
          // Simple version check (in production, use semver comparison)
          const isVulnerable = checkVersionVulnerability(version, vulnInfo.versions);

          if (isVulnerable) {
            const vuln = {
              project: projectName,
              package: pkgName,
              installedVersion: version,
              cve: vulnInfo.cve,
              severity: vulnInfo.severity,
              description: `Vulnerable version of ${pkgName} detected`,
              recommendation: `Update to latest version`,
              detectedAt: new Date().toISOString(),
            };

            vulnerabilities.push(vuln);

            logger.warn(`  Vulnerability: ${pkgName}@${version} (${vulnInfo.cve})`);

            // Store vulnerability
            await createRecord(TABLES.VULNERABILITIES, {
              Project: projectName,
              Package: pkgName,
              InstalledVersion: version,
              CVE: vulnInfo.cve,
              Severity: vulnInfo.severity,
              Description: vuln.description,
              Recommendation: vuln.recommendation,
              Status: 'Open',
              DetectedAt: vuln.detectedAt,
            });
          }
        }
      }
    }

    // Use npm audit for more comprehensive check
    try {
      const { execSync } = require('child_process');
      const auditResult = execSync('npm audit --json', {
        cwd: path.join(__dirname, '../..'),
        encoding: 'utf-8',
      });

      const auditData = JSON.parse(auditResult);
      if (auditData.vulnerabilities) {
        logger.info(`npm audit found ${Object.keys(auditData.vulnerabilities).length} issues`);
      }
    } catch (error) {
      // npm audit returns non-zero exit if vulnerabilities found
      logger.info('npm audit completed (some issues may exist)');
    }

    if (vulnerabilities.length > 0) {
      await alertVulnerabilities(vulnerabilities);
    }

    logger.info(`Dependency scan: ${vulnerabilities.length} vulnerabilities found`);
    return vulnerabilities;
  } catch (error) {
    logger.error(`Dependency scan failed: ${error.message}`);
    throw error;
  }
}

/**
 * Find all package.json files in the project.
 */
function findPackageJsonFiles() {
  const files = [];
  const baseDir = path.join(__dirname, '../..');

  function searchDir(dir) {
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          searchDir(fullPath);
        } else if (entry === 'package.json') {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
  }

  searchDir(baseDir);
  return files;
}

/**
 * Check if installed version is vulnerable.
 */
function checkVersionVulnerability(installedVersion, vulnerableVersions) {
  // Remove version prefixes like ^, ~, >=
  const cleanVersion = installedVersion.replace(/[^\d.]/g, '');

  for (const vulnPattern of vulnerableVersions) {
    if (vulnPattern.startsWith('<')) {
      // Check if version is less than threshold
      const threshold = vulnPattern.replace('<', '').trim();
      return compareVersions(cleanVersion, threshold) < 0;
    }
  }

  return false;
}

/**
 * Simple version comparison.
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  return 0;
}

/**
 * Alert about discovered vulnerabilities.
 */
async function alertVulnerabilities(vulnerabilities) {
  const critical = vulnerabilities.filter(v => v.severity === SEVERITY_LEVELS.CRITICAL);
  const high = vulnerabilities.filter(v => v.severity === SEVERITY_LEVELS.HIGH);

  if (critical.length === 0 && high.length === 0) return;

  const vulnRows = vulnerabilities
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    })
    .map(v => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${v.package}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${v.installedVersion}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${v.cve}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${getSeverityColor(v.severity)}; font-weight: bold;">
          ${v.severity.toUpperCase()}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${v.recommendation}</td>
      </tr>
    `).join('');

  await sendCEOEmail({
    subject: `🔒 SECURITY: ${vulnerabilities.length} vulnerabilities (${critical.length} critical, ${high.length} high)`,
    html: `
      <h2 style="color: #e74c3c;">Security Vulnerability Alert</h2>
      <p>Dependency scan detected <strong>${vulnerabilities.length}</strong> vulnerabilities:</p>
      <ul>
        <li style="color: #c0392b;"><strong>${critical.length}</strong> Critical</li>
        <li style="color: #e74c3c;"><strong>${high.length}</strong> High</li>
        <li style="color: #f39c12;"><strong>${vulnerabilities.filter(v => v.severity === 'medium').length}</strong> Medium</li>
        <li style="color: #3498db;"><strong>${vulnerabilities.filter(v => v.severity === 'low').length}</strong> Low</li>
      </ul>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <tr style="background: #f5f5f5;">
          <th style="padding: 8px; text-align: left;">Package</th>
          <th style="padding: 8px; text-align: left;">Version</th>
          <th style="padding: 8px; text-align: left;">CVE</th>
          <th style="padding: 8px; text-align: left;">Severity</th>
          <th style="padding: 8px; text-align: left;">Action</th>
        </tr>
        ${vulnRows}
      </table>
      <p style="margin-top: 20px; color: #e74c3c;">
        <strong>⚠️ ${critical.length > 0 ? 'CRITICAL vulnerabilities require immediate attention!' : 'Please review and update affected packages.'}</strong>
      </p>
    `,
  });
}

// ── SSL/TLS Configuration Grading ────────────────────────────────────────────

/**
 * Audit SSL/TLS configuration for all HTTPS endpoints.
 */
async function auditSSLConfiguration() {
  logger.info('Auditing SSL/TLS configurations...');
  const results = [];

  // Load endpoints from config or infrastructure monitor
  const endpoints = config.endpoints || {};

  for (const [key, url] of Object.entries(endpoints)) {
    if (typeof url !== 'string' || !url.startsWith('https://')) continue;

    try {
      const hostname = new URL(url).hostname;
      const sslGrade = await gradeSSLConfiguration(hostname);

      results.push(sslGrade);

      logger.info(`  ${hostname}: Grade ${sslGrade.grade} (${sslGrade.score}/100)`);

      // Store audit result
      await createRecord(TABLES.SSL_AUDIT, {
        Endpoint: key,
        Hostname: hostname,
        Grade: sslGrade.grade,
        Score: sslGrade.score,
        Protocol: sslGrade.protocol,
        CipherSuite: sslGrade.cipherSuite,
        Issues: JSON.stringify(sslGrade.issues),
        Recommendations: JSON.stringify(sslGrade.recommendations),
        AuditedAt: new Date().toISOString(),
      });

      // Alert on poor grades
      if (sslGrade.score < 70) {
        await alertSSLGrade(key, hostname, sslGrade);
      }
    } catch (error) {
      logger.error(`SSL audit failed for ${url}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Grade SSL/TLS configuration for a hostname.
 */
function gradeSSLConfiguration(hostname) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      method: 'GET',
      agent: false,
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      const socket = res.socket;
      const protocol = socket.getProtocol ? socket.getProtocol() : socket.getCipher()?.version;
      const cipher = socket.getCipher();

      let score = 100;
      const issues = [];
      const recommendations = [];

      // Check protocol version
      if (protocol === 'TLSv1' || protocol === 'TLSv1.1') {
        score -= 30;
        issues.push('Outdated TLS protocol version');
        recommendations.push('Upgrade to TLS 1.2 or 1.3');
      } else if (protocol === 'TLSv1.2') {
        score -= 5;
        recommendations.push('Consider upgrading to TLS 1.3 for better performance');
      }

      // Check cipher strength
      if (cipher && cipher.bits < 128) {
        score -= 25;
        issues.push('Weak cipher strength');
        recommendations.push('Use 128-bit or 256-bit ciphers');
      }

      // Assign letter grade
      let grade = 'F';
      if (score >= 90) grade = 'A';
      else if (score >= 80) grade = 'B';
      else if (score >= 70) grade = 'C';
      else if (score >= 60) grade = 'D';

      resolve({
        hostname,
        grade,
        score,
        protocol: protocol || 'Unknown',
        cipherSuite: cipher ? `${cipher.name} (${cipher.bits}-bit)` : 'Unknown',
        issues,
        recommendations,
      });

      req.abort();
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Alert on poor SSL grades.
 */
async function alertSSLGrade(endpoint, hostname, sslGrade) {
  await sendCEOEmail({
    subject: `🔒 SSL GRADE ${sslGrade.grade}: ${hostname}`,
    html: `
      <h2 style="color: ${sslGrade.score < 60 ? '#e74c3c' : '#f39c12'};">SSL/TLS Configuration Alert</h2>
      <p><strong>Endpoint:</strong> ${endpoint}</p>
      <p><strong>Hostname:</strong> ${hostname}</p>
      <p><strong>Grade:</strong> <span style="font-size: 24px; font-weight: bold;">${sslGrade.grade}</span> (${sslGrade.score}/100)</p>
      <p><strong>Protocol:</strong> ${sslGrade.protocol}</p>
      <p><strong>Cipher:</strong> ${sslGrade.cipherSuite}</p>
      ${sslGrade.issues.length > 0 ? `
        <h3>Issues:</h3>
        <ul>${sslGrade.issues.map(i => `<li style="color: #e74c3c;">${i}</li>`).join('')}</ul>
      ` : ''}
      <h3>Recommendations:</h3>
      <ol>${sslGrade.recommendations.map(r => `<li>${r}</li>`).join('')}</ol>
    `,
  });
}

// ── HTTP Security Header Audit ───────────────────────────────────────────────

/**
 * Audit HTTP security headers for all endpoints.
 */
async function auditSecurityHeaders() {
  logger.info('Auditing security headers...');
  const results = [];

  const endpoints = config.endpoints || {};

  for (const [key, url] of Object.entries(endpoints)) {
    if (typeof url !== 'string') continue;

    try {
      const headers = await fetchHeaders(url);
      const audit = analyzeSecurityHeaders(headers);

      audit.endpoint = key;
      audit.url = url;
      results.push(audit);

      logger.info(`  ${key}: ${audit.score}/100 (${audit.missing.length} missing, ${audit.issues.length} issues)`);

      // Store audit
      await createRecord(TABLES.HEADER_AUDIT, {
        Endpoint: key,
        URL: url,
        Score: audit.score,
        Grade: audit.grade,
        MissingHeaders: JSON.stringify(audit.missing),
        Issues: JSON.stringify(audit.issues),
        Recommendations: JSON.stringify(audit.recommendations),
        AuditedAt: new Date().toISOString(),
      });

      // Alert on poor scores
      if (audit.score < 70) {
        await alertSecurityHeaders(audit);
      }
    } catch (error) {
      logger.error(`Header audit failed for ${url}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Fetch HTTP headers from a URL.
 */
function fetchHeaders(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : require('http');

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'HEAD',
      timeout: 10000,
    };

    const req = protocol.request(options, (res) => {
      resolve(res.headers);
      req.abort();
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Analyze security headers and assign score.
 */
function analyzeSecurityHeaders(headers) {
  let score = 100;
  const missing = [];
  const issues = [];
  const recommendations = [];

  for (const [key, config] of Object.entries(REQUIRED_HEADERS)) {
    const headerValue = headers[key.toLowerCase()];

    if (!headerValue) {
      if (config.required) {
        score -= getSeverityDeduction(config.severity);
        missing.push({
          header: config.name,
          severity: config.severity,
          description: config.description,
        });
        recommendations.push(`Add ${config.name} header`);
      }
      continue;
    }

    // Validate header value if expected values are defined
    if (config.expectedValues) {
      const isValid = config.expectedValues.some(expected =>
        headerValue.toLowerCase().includes(expected.toLowerCase())
      );
      if (!isValid) {
        score -= 5;
        issues.push({
          header: config.name,
          value: headerValue,
          issue: 'Invalid value',
        });
        recommendations.push(`Update ${config.name} to use recommended value`);
      }
    }

    // Validate header pattern if defined
    if (config.expectedPattern && !config.expectedPattern.test(headerValue)) {
      score -= 5;
      issues.push({
        header: config.name,
        value: headerValue,
        issue: 'Does not match expected pattern',
      });
    }
  }

  let grade = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';

  return {
    score: Math.max(0, score),
    grade,
    missing,
    issues,
    recommendations,
  };
}

/**
 * Get score deduction based on severity.
 */
function getSeverityDeduction(severity) {
  const deductions = {
    critical: 25,
    high: 15,
    medium: 10,
    low: 5,
    info: 2,
  };
  return deductions[severity] || 10;
}

/**
 * Alert on poor security header scores.
 */
async function alertSecurityHeaders(audit) {
  const missingRows = audit.missing.map(m => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${m.header}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${getSeverityColor(m.severity)};">
        ${m.severity.toUpperCase()}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${m.description}</td>
    </tr>
  `).join('');

  await sendCEOEmail({
    subject: `🔒 SECURITY HEADERS: Grade ${audit.grade} for ${audit.endpoint}`,
    html: `
      <h2 style="color: #f39c12;">Security Headers Audit</h2>
      <p><strong>Endpoint:</strong> ${audit.endpoint}</p>
      <p><strong>URL:</strong> ${audit.url}</p>
      <p><strong>Grade:</strong> <span style="font-size: 24px; font-weight: bold;">${audit.grade}</span> (${audit.score}/100)</p>
      <h3>Missing Headers (${audit.missing.length}):</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f5f5f5;">
          <th style="padding: 8px; text-align: left;">Header</th>
          <th style="padding: 8px; text-align: left;">Severity</th>
          <th style="padding: 8px; text-align: left;">Purpose</th>
        </tr>
        ${missingRows}
      </table>
      <h3>Recommendations:</h3>
      <ol>${audit.recommendations.map(r => `<li>${r}</li>`).join('')}</ol>
    `,
  });
}

// ── API Key Rotation Tracking ────────────────────────────────────────────────

/**
 * Track and remind about API key rotations.
 */
async function checkAPIKeyRotations() {
  logger.info('Checking API key rotation status...');
  const reminders = [];

  for (const apiKey of API_KEYS) {
    try {
      // Get last rotation date from Airtable
      const rotations = await getRecords(
        TABLES.API_KEY_ROTATIONS,
        `{KeyName} = "${apiKey.name}"`
      );

      const lastRotation = rotations.length > 0
        ? rotations.sort((a, b) => new Date(b.RotatedAt) - new Date(a.RotatedAt))[0]
        : null;

      const daysSinceRotation = lastRotation
        ? Math.floor((Date.now() - new Date(lastRotation.RotatedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const status = daysSinceRotation >= apiKey.rotationDays ? 'overdue' :
                     daysSinceRotation >= apiKey.rotationDays - 14 ? 'due_soon' :
                     'current';

      if (status !== 'current') {
        reminders.push({
          name: apiKey.name,
          daysSinceRotation,
          rotationDays: apiKey.rotationDays,
          status,
          lastRotation: lastRotation?.RotatedAt || 'Never',
        });
      }

      logger.info(`  ${apiKey.name}: ${status} (${daysSinceRotation} days)`);
    } catch (error) {
      logger.error(`Failed to check ${apiKey.name}: ${error.message}`);
    }
  }

  if (reminders.length > 0) {
    await sendRotationReminders(reminders);
  }

  logger.info(`Key rotation check: ${reminders.length} reminder(s)`);
  return reminders;
}

/**
 * Send API key rotation reminders.
 */
async function sendRotationReminders(reminders) {
  const reminderRows = reminders.map(r => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${r.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${r.status === 'overdue' ? '#e74c3c' : '#f39c12'};">
        ${r.status === 'overdue' ? 'OVERDUE' : 'DUE SOON'}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${r.daysSinceRotation} days</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${r.lastRotation}</td>
    </tr>
  `).join('');

  await sendCEOEmail({
    subject: `🔑 API Key Rotation: ${reminders.filter(r => r.status === 'overdue').length} overdue`,
    html: `
      <h2 style="color: #f39c12;">API Key Rotation Reminder</h2>
      <p>${reminders.length} API key(s) need rotation:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f5f5f5;">
          <th style="padding: 8px; text-align: left;">API Key</th>
          <th style="padding: 8px; text-align: left;">Status</th>
          <th style="padding: 8px; text-align: left;">Days Since Rotation</th>
          <th style="padding: 8px; text-align: left;">Last Rotated</th>
        </tr>
        ${reminderRows}
      </table>
      <p style="margin-top: 20px;">
        <strong>Best Practice:</strong> Rotate API keys regularly to maintain security.
        Update keys in environment variables and configuration after rotation.
      </p>
    `,
  });
}

/**
 * Record an API key rotation.
 */
async function recordKeyRotation(keyName) {
  try {
    await createRecord(TABLES.API_KEY_ROTATIONS, {
      KeyName: keyName,
      RotatedAt: new Date().toISOString(),
      RotatedBy: 'manual',
    });
    logger.info(`Recorded rotation for ${keyName}`);
  } catch (error) {
    logger.error(`Failed to record rotation for ${keyName}: ${error.message}`);
  }
}

// ── Security Report Generation ───────────────────────────────────────────────

/**
 * Generate comprehensive monthly security report.
 */
async function generateSecurityReport() {
  logger.info('Generating security report...');

  try {
    // Gather security data
    const vulnerabilities = await getRecords(TABLES.VULNERABILITIES, '{Status} = "Open"');
    const sslAudits = await getRecords(TABLES.SSL_AUDIT, '', 10);
    const headerAudits = await getRecords(TABLES.HEADER_AUDIT, '', 10);
    const rotations = await checkAPIKeyRotations();

    // Count by severity
    const vulnBySeverity = {
      critical: vulnerabilities.filter(v => v.Severity === 'critical').length,
      high: vulnerabilities.filter(v => v.Severity === 'high').length,
      medium: vulnerabilities.filter(v => v.Severity === 'medium').length,
      low: vulnerabilities.filter(v => v.Severity === 'low').length,
    };

    // Calculate average SSL grade
    const avgSSLScore = sslAudits.length > 0
      ? Math.round(sslAudits.reduce((sum, a) => sum + (a.Score || 0), 0) / sslAudits.length)
      : 0;

    // Calculate average header score
    const avgHeaderScore = headerAudits.length > 0
      ? Math.round(headerAudits.reduce((sum, a) => sum + (a.Score || 0), 0) / headerAudits.length)
      : 0;

    // AI-powered security analysis
    const analysis = await generateJSON(
      `Analyze this security posture and provide recommendations.

Open Vulnerabilities:
- Critical: ${vulnBySeverity.critical}
- High: ${vulnBySeverity.high}
- Medium: ${vulnBySeverity.medium}
- Low: ${vulnBySeverity.low}

SSL/TLS Configuration: Average score ${avgSSLScore}/100
Security Headers: Average score ${avgHeaderScore}/100
API Key Rotations: ${rotations.length} keys need rotation

Provide analysis as JSON:
{
  "overallRating": "excellent|good|fair|poor|critical",
  "riskScore": 0-100,
  "summary": "2-3 sentence security posture summary",
  "topPriorities": ["priority 1", "priority 2", "priority 3"],
  "recommendations": ["rec 1", "rec 2", "rec 3", "rec 4", "rec 5"],
  "complianceNotes": "Notes about compliance (GDPR, etc.)"
}`,
      { model: config.models.standard, maxTokens: 1000 }
    );

    const report = {
      period: 'Monthly Security Report',
      generatedAt: new Date().toISOString(),
      vulnerabilities: vulnBySeverity,
      totalVulnerabilities: vulnerabilities.length,
      sslScore: avgSSLScore,
      headerScore: avgHeaderScore,
      rotationsPending: rotations.length,
      analysis,
    };

    // Store report
    await createRecord(TABLES.SECURITY_REPORTS, {
      Period: report.period,
      GeneratedAt: report.generatedAt,
      TotalVulnerabilities: report.totalVulnerabilities,
      CriticalVulns: vulnBySeverity.critical,
      HighVulns: vulnBySeverity.high,
      SSLScore: avgSSLScore,
      HeaderScore: avgHeaderScore,
      OverallRating: analysis.overallRating,
      RiskScore: analysis.riskScore,
      Summary: analysis.summary,
      RecommendationsJSON: JSON.stringify(analysis.recommendations),
    });

    // Send report email
    await sendSecurityReportEmail(report);

    logger.info(`Security report: ${analysis.overallRating} (risk score: ${analysis.riskScore})`);
    return report;
  } catch (error) {
    logger.error(`Security report generation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Send security report email.
 */
async function sendSecurityReportEmail(report) {
  const ratingColor = {
    excellent: '#27ae60',
    good: '#2ecc71',
    fair: '#f39c12',
    poor: '#e67e22',
    critical: '#e74c3c',
  }[report.analysis.overallRating] || '#95a5a6';

  await sendCEOEmail({
    subject: `🔒 Monthly Security Report: ${report.analysis.overallRating.toUpperCase()} (Risk: ${report.analysis.riskScore}/100)`,
    html: `
      <h2>Security Posture Report</h2>
      <p>${report.period} - ${new Date(report.generatedAt).toLocaleDateString()}</p>

      <div style="background: ${ratingColor}; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <h3 style="margin: 0; color: white;">Overall Rating: ${report.analysis.overallRating.toUpperCase()}</h3>
        <p style="margin: 10px 0 0 0; font-size: 18px; color: white;">Risk Score: ${report.analysis.riskScore}/100</p>
      </div>

      <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <strong>Summary:</strong> ${report.analysis.summary}
      </div>

      <h3>Security Metrics:</h3>
      <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; flex: 1; min-width: 150px;">
          <strong>Vulnerabilities</strong><br>
          ${report.totalVulnerabilities} total<br>
          <span style="color: #c0392b;">${report.vulnerabilities.critical} critical</span>,
          <span style="color: #e74c3c;">${report.vulnerabilities.high} high</span>
        </div>
        <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; flex: 1; min-width: 150px;">
          <strong>SSL/TLS</strong><br>
          Score: ${report.sslScore}/100
        </div>
        <div style="background: #d4edda; padding: 15px; border-radius: 8px; flex: 1; min-width: 150px;">
          <strong>Security Headers</strong><br>
          Score: ${report.headerScore}/100
        </div>
        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; flex: 1; min-width: 150px;">
          <strong>API Keys</strong><br>
          ${report.rotationsPending} need rotation
        </div>
      </div>

      <h3>Top Priorities:</h3>
      <ol style="color: #e74c3c; font-weight: bold;">
        ${report.analysis.topPriorities.map(p => `<li>${p}</li>`).join('')}
      </ol>

      <h3>Recommendations:</h3>
      <ol>${report.analysis.recommendations.map(r => `<li>${r}</li>`).join('')}</ol>

      ${report.analysis.complianceNotes ? `
        <h3>Compliance Notes:</h3>
        <p>${report.analysis.complianceNotes}</p>
      ` : ''}
    `,
  });
}

// ── Helper Functions ─────────────────────────────────────────────────────────

function getSeverityColor(severity) {
  const colors = {
    critical: '#c0392b',
    high: '#e74c3c',
    medium: '#f39c12',
    low: '#3498db',
    info: '#95a5a6',
  };
  return colors[severity] || '#333';
}

// ── Main Runs ────────────────────────────────────────────────────────────────

/**
 * Daily dependency check.
 */
async function runDependencyCheck() {
  logger.info('=== Daily Dependency Check ===');
  const startTime = Date.now();

  try {
    await scanDependencyVulnerabilities();
  } catch (error) {
    logger.error(`Dependency check failed: ${error.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Dependency check completed in ${duration}s ===`);
}

/**
 * Security headers check (every 6h).
 */
async function runHeadersCheck() {
  logger.info('=== Security Headers Check ===');
  const startTime = Date.now();

  try {
    await auditSecurityHeaders();
  } catch (error) {
    logger.error(`Headers check failed: ${error.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Headers check completed in ${duration}s ===`);
}

/**
 * Daily SSL audit.
 */
async function runSSLAudit() {
  logger.info('=== SSL Configuration Audit ===');
  const startTime = Date.now();

  try {
    await auditSSLConfiguration();
  } catch (error) {
    logger.error(`SSL audit failed: ${error.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== SSL audit completed in ${duration}s ===`);
}

/**
 * Weekly rotation check.
 */
async function runRotationCheck() {
  logger.info('=== API Key Rotation Check ===');
  const startTime = Date.now();

  try {
    await checkAPIKeyRotations();
  } catch (error) {
    logger.error(`Rotation check failed: ${error.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Rotation check completed in ${duration}s ===`);
}

/**
 * Monthly security report.
 */
async function runMonthlyReport() {
  logger.info('=== Monthly Security Report ===');
  const startTime = Date.now();

  try {
    await generateSecurityReport();
  } catch (error) {
    logger.error(`Security report failed: ${error.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Security report completed in ${duration}s ===`);
}

// ── Cron Scheduling ──────────────────────────────────────────────────────────

// Dependency check daily at 02:00
cron.schedule('0 2 * * *', () => {
  runDependencyCheck().catch(err => logger.error(`Cron dependency error: ${err.message}`));
});

// Security headers check every 6 hours
cron.schedule('0 */6 * * *', () => {
  runHeadersCheck().catch(err => logger.error(`Cron headers error: ${err.message}`));
});

// SSL audit daily at 03:00
cron.schedule('0 3 * * *', () => {
  runSSLAudit().catch(err => logger.error(`Cron SSL error: ${err.message}`));
});

// Rotation check weekly on Mondays at 08:00
cron.schedule('0 8 * * 1', () => {
  runRotationCheck().catch(err => logger.error(`Cron rotation error: ${err.message}`));
});

// Monthly security report on 1st at 04:00
cron.schedule('0 4 1 * *', () => {
  runMonthlyReport().catch(err => logger.error(`Cron report error: ${err.message}`));
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runDependencyCheck,
  runHeadersCheck,
  runSSLAudit,
  runRotationCheck,
  runMonthlyReport,
  scanDependencyVulnerabilities,
  auditSSLConfiguration,
  auditSecurityHeaders,
  checkAPIKeyRotations,
  recordKeyRotation,
  generateSecurityReport,
};

// Run immediately if executed directly
if (require.main === module) {
  runDependencyCheck()
    .then(() => logger.info('Manual security check completed'))
    .catch(err => logger.error(`Manual run failed: ${err.message}`));
}
