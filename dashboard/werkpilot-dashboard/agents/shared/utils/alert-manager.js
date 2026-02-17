/**
 * Centralized Alert Management System
 * Handles alert channels, deduplication, history, and escalation
 */

const fs = require('fs').promises;
const path = require('path');

class AlertManager {
  constructor() {
    this.alerts = [];
    this.maxAlerts = 500; // Keep last 500 alerts
    this.deduplicationWindow = 60 * 60 * 1000; // 1 hour
    this.escalationTime = 60 * 60 * 1000; // 1 hour

    this.channels = {
      console: true,
      email: false, // Disabled by default, enable when email is configured
      dashboard: true,
    };

    this.emailConfig = {
      ceoEmail: process.env.CEO_EMAIL || 'ceo@werkpilot.com',
      from: process.env.ALERT_EMAIL_FROM || 'alerts@werkpilot.com',
    };

    this.rules = [];
    this.escalations = new Map();

    this.dataDir = path.join(__dirname, '../../../data/alerts');
  }

  /**
   * Initialize alert manager
   */
  async init() {
    await this.ensureDataDir();
    await this.loadAlertHistory();
    this.setupDefaultRules();
    this.startEscalationMonitor();

    // Make available globally
    global.alertManager = this;
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create alerts directory:', error);
    }
  }

  /**
   * Add a new alert
   */
  addAlert(alert) {
    const now = Date.now();

    // Normalize alert
    const normalizedAlert = {
      id: this.generateAlertId(),
      timestamp: now,
      level: alert.level || 'info', // info, warning, critical
      type: alert.type || 'general',
      message: alert.message,
      data: alert.data || {},
      acknowledged: false,
      escalated: false,
      ...alert,
    };

    // Check for duplicates
    if (this.isDuplicate(normalizedAlert)) {
      console.log(`Alert deduplicated: ${normalizedAlert.message}`);
      return null;
    }

    // Add to alerts array
    this.alerts.unshift(normalizedAlert);

    // Keep only last maxAlerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }

    // Process through rules engine
    this.processRules(normalizedAlert);

    // Send to channels
    this.sendToChannels(normalizedAlert);

    // Track for escalation if warning or critical
    if (normalizedAlert.level === 'warning' || normalizedAlert.level === 'critical') {
      this.trackEscalation(normalizedAlert);
    }

    // Save to disk
    this.saveAlert(normalizedAlert);

    return normalizedAlert;
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if alert is duplicate
   */
  isDuplicate(alert) {
    const now = Date.now();
    const cutoff = now - this.deduplicationWindow;

    return this.alerts.some((existing) => {
      return (
        existing.timestamp > cutoff &&
        existing.type === alert.type &&
        existing.message === alert.message &&
        !existing.acknowledged
      );
    });
  }

  /**
   * Process alert through rules engine
   */
  processRules(alert) {
    for (const rule of this.rules) {
      if (this.matchesRule(alert, rule)) {
        rule.action(alert);
      }
    }
  }

  /**
   * Check if alert matches rule
   */
  matchesRule(alert, rule) {
    if (rule.level && alert.level !== rule.level) return false;
    if (rule.type && alert.type !== rule.type) return false;
    if (rule.condition && !rule.condition(alert)) return false;
    return true;
  }

  /**
   * Send alert to configured channels
   */
  sendToChannels(alert) {
    // Console log
    if (this.channels.console) {
      this.sendToConsole(alert);
    }

    // Email (for critical alerts)
    if (this.channels.email && alert.level === 'critical') {
      this.sendToEmail(alert);
    }

    // Dashboard notification
    if (this.channels.dashboard) {
      this.sendToDashboard(alert);
    }
  }

  /**
   * Send alert to console
   */
  sendToConsole(alert) {
    const timestamp = new Date(alert.timestamp).toISOString();
    const level = alert.level.toUpperCase();
    const icon = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨',
    }[alert.level] || '•';

    console.log(`\n${icon} [${level}] ${timestamp}`);
    console.log(`   ${alert.message}`);
    if (alert.type) console.log(`   Type: ${alert.type}`);
    if (Object.keys(alert.data).length > 0) {
      console.log(`   Data:`, JSON.stringify(alert.data, null, 2));
    }
  }

  /**
   * Send alert to email
   */
  async sendToEmail(alert) {
    try {
      // In production, this would send an actual email
      // For now, just log that we would send
      console.log(`\n📧 EMAIL ALERT to ${this.emailConfig.ceoEmail}`);
      console.log(`Subject: [CRITICAL] ${alert.message}`);
      console.log(`Body: ${JSON.stringify(alert, null, 2)}`);

      // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
      // const nodemailer = require('nodemailer');
      // await transporter.sendMail({
      //   from: this.emailConfig.from,
      //   to: this.emailConfig.ceoEmail,
      //   subject: `[CRITICAL] ${alert.message}`,
      //   html: this.formatEmailBody(alert),
      // });
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }

  /**
   * Send alert to dashboard
   */
  async sendToDashboard(alert) {
    try {
      // Create a notification in the database
      const prisma = require('@/lib/db').default;

      await prisma.notification.create({
        data: {
          title: `[${alert.level.toUpperCase()}] ${alert.type}`,
          message: alert.message,
          type: alert.level,
          link: alert.link || null,
        },
      });
    } catch (error) {
      console.error('Failed to create dashboard notification:', error);
    }
  }

  /**
   * Track alert for escalation
   */
  trackEscalation(alert) {
    const key = `${alert.type}_${alert.level}`;
    const escalation = {
      alert,
      createdAt: alert.timestamp,
      escalateAt: alert.timestamp + this.escalationTime,
    };

    this.escalations.set(key, escalation);
  }

  /**
   * Start escalation monitor
   */
  startEscalationMonitor() {
    // Check for escalations every 5 minutes
    setInterval(() => {
      this.checkEscalations();
    }, 5 * 60 * 1000);
  }

  /**
   * Check for alerts that need escalation
   */
  checkEscalations() {
    const now = Date.now();

    for (const [key, escalation] of this.escalations.entries()) {
      // If alert was acknowledged, remove from escalations
      const alert = this.alerts.find((a) => a.id === escalation.alert.id);
      if (alert && alert.acknowledged) {
        this.escalations.delete(key);
        continue;
      }

      // If escalation time reached and not acknowledged
      if (now >= escalation.escalateAt && !escalation.alert.escalated) {
        this.escalateAlert(escalation.alert);
        escalation.alert.escalated = true;
      }
    }
  }

  /**
   * Escalate alert
   */
  escalateAlert(alert) {
    // Escalate warning to critical
    if (alert.level === 'warning') {
      const escalatedAlert = {
        ...alert,
        id: this.generateAlertId(),
        level: 'critical',
        message: `[ESCALATED] ${alert.message}`,
        escalatedFrom: alert.id,
        timestamp: Date.now(),
      };

      this.addAlert(escalatedAlert);
    }

    // Send critical alerts to CEO via email
    if (alert.level === 'critical') {
      this.sendToEmail(alert);
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Get all alerts
   */
  getAlerts(options = {}) {
    let filtered = this.alerts;

    // Filter by level
    if (options.level) {
      filtered = filtered.filter((a) => a.level === options.level);
    }

    // Filter by type
    if (options.type) {
      filtered = filtered.filter((a) => a.type === options.type);
    }

    // Filter by acknowledged status
    if (options.acknowledged !== undefined) {
      filtered = filtered.filter((a) => a.acknowledged === options.acknowledged);
    }

    // Filter by time range
    if (options.since) {
      filtered = filtered.filter((a) => a.timestamp >= options.since);
    }

    // Limit results
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get alert statistics
   */
  getAlertStats(period = '24h') {
    const now = Date.now();
    const periods = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };

    const duration = periods[period] || periods['24h'];
    const cutoff = now - duration;
    const alerts = this.alerts.filter((a) => a.timestamp >= cutoff);

    const stats = {
      total: alerts.length,
      info: alerts.filter((a) => a.level === 'info').length,
      warning: alerts.filter((a) => a.level === 'warning').length,
      critical: alerts.filter((a) => a.level === 'critical').length,
      unacknowledged: alerts.filter((a) => !a.acknowledged).length,
      byType: {},
    };

    // Count by type
    alerts.forEach((alert) => {
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Setup default alert rules
   */
  setupDefaultRules() {
    // Rule: Critical error rate - auto-escalate
    this.addRule({
      name: 'critical_error_rate',
      level: 'critical',
      type: 'error_rate',
      action: (alert) => {
        console.log('🚨 CRITICAL ERROR RATE - Immediate escalation required');
      },
    });

    // Rule: Budget exceeded - notify
    this.addRule({
      name: 'budget_exceeded',
      level: 'critical',
      type: 'budget_exceeded',
      action: (alert) => {
        console.log('💰 BUDGET EXCEEDED - Review spending immediately');
      },
    });

    // Rule: High response time - investigate
    this.addRule({
      name: 'high_response_time',
      level: 'warning',
      type: 'response_time',
      action: (alert) => {
        console.log('⏱️  HIGH RESPONSE TIME - Performance degradation detected');
      },
    });
  }

  /**
   * Add a new rule
   */
  addRule(rule) {
    this.rules.push({
      name: rule.name,
      level: rule.level,
      type: rule.type,
      condition: rule.condition,
      action: rule.action,
    });
  }

  /**
   * Save alert to disk
   */
  async saveAlert(alert) {
    try {
      const date = new Date(alert.timestamp).toISOString().split('T')[0];
      const filename = `alerts-${date}.json`;
      const filepath = path.join(this.dataDir, filename);

      let alerts = [];
      try {
        const data = await fs.readFile(filepath, 'utf8');
        alerts = JSON.parse(data);
      } catch {
        // File doesn't exist yet
      }

      alerts.push(alert);
      await fs.writeFile(filepath, JSON.stringify(alerts, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save alert:', error);
    }
  }

  /**
   * Load alert history
   */
  async loadAlertHistory() {
    try {
      const files = await fs.readdir(this.dataDir);
      const alertFiles = files.filter((f) => f.startsWith('alerts-')).sort().reverse();

      // Load last 7 days of alerts
      const recentFiles = alertFiles.slice(0, 7);

      for (const file of recentFiles) {
        const filepath = path.join(this.dataDir, file);
        const data = await fs.readFile(filepath, 'utf8');
        const alerts = JSON.parse(data);

        // Add to alerts array (newest first)
        this.alerts.push(...alerts);
      }

      // Sort by timestamp (newest first)
      this.alerts.sort((a, b) => b.timestamp - a.timestamp);

      // Keep only last maxAlerts
      this.alerts = this.alerts.slice(0, this.maxAlerts);

      console.log(`Loaded ${this.alerts.length} alerts from history`);
    } catch (error) {
      console.error('Failed to load alert history:', error);
    }
  }

  /**
   * Clear old alerts
   */
  async clearOldAlerts(days = 30) {
    try {
      const files = await fs.readdir(this.dataDir);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      for (const file of files) {
        if (file.startsWith('alerts-')) {
          const date = file.replace('alerts-', '').replace('.json', '');
          if (date < cutoff) {
            await fs.unlink(path.join(this.dataDir, file));
          }
        }
      }
    } catch (error) {
      console.error('Failed to clear old alerts:', error);
    }
  }

  /**
   * Enable/disable alert channel
   */
  setChannel(channel, enabled) {
    if (this.channels.hasOwnProperty(channel)) {
      this.channels[channel] = enabled;
    }
  }

  /**
   * Set CEO email for critical alerts
   */
  setCEOEmail(email) {
    this.emailConfig.ceoEmail = email;
  }

  /**
   * Format email body
   */
  formatEmailBody(alert) {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2 style="color: #dc2626;">Critical Alert</h2>
          <p><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
          <p><strong>Type:</strong> ${alert.type}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          ${Object.keys(alert.data).length > 0 ? `
            <h3>Details:</h3>
            <pre>${JSON.stringify(alert.data, null, 2)}</pre>
          ` : ''}
          <p style="margin-top: 20px; color: #666;">
            This is an automated alert from the Werkpilot monitoring system.
          </p>
        </body>
      </html>
    `;
  }
}

// Singleton instance
let instance = null;

function getAlertManager() {
  if (!instance) {
    instance = new AlertManager();
    instance.init();
  }
  return instance;
}

module.exports = {
  AlertManager,
  getAlertManager,
};
