/**
 * Agent 04 — Key Account Agent
 *
 * Monitors active clients, tracks usage patterns, generates health reports,
 * triggers upsell alerts, sends proactive check-ins, and flags churn signals.
 *
 * Schedule: Runs daily at 08:00 for monitoring, bi-weekly for check-ins,
 *           monthly for health reports.
 */

const cron = require('node-cron');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('key-account');

// ── Constants ────────────────────────────────────────────────────────────────

const TABLES = {
  CLIENTS: 'Clients',
  USAGE: 'ClientUsage',
  HEALTH_REPORTS: 'HealthReports',
  ALERTS: 'Alerts',
  NPS: 'NPSScores',
  INTERACTIONS: 'ClientInteractions',
};

const UPSELL_THRESHOLDS = {
  USAGE_LIMIT_PERCENT: 80,
  TRAFFIC_GROWTH_PERCENT: 50,
  RENEWAL_DAYS: 30,
};

const NPS_CHURN_THRESHOLD = 7;
const CHECK_IN_INTERVAL_DAYS = 14;

// ── Client Health Scoring ────────────────────────────────────────────────────

function calculateHealthScore(client, usage, npsScores) {
  let score = 100;
  const factors = [];

  // Usage engagement (0-30 points)
  const usagePercent = usage ? (usage.currentUsage / usage.usageLimit) * 100 : 0;
  if (usagePercent < 20) {
    score -= 25;
    factors.push('Low usage engagement');
  } else if (usagePercent > 80) {
    score -= 5;
    factors.push('Approaching usage limits');
  }

  // NPS score (0-30 points)
  const latestNPS = npsScores.length > 0 ? npsScores[0].Score : null;
  if (latestNPS !== null) {
    if (latestNPS < 5) {
      score -= 30;
      factors.push(`Critical NPS: ${latestNPS}`);
    } else if (latestNPS < 7) {
      score -= 15;
      factors.push(`Low NPS: ${latestNPS}`);
    }
  } else {
    score -= 10;
    factors.push('No NPS data available');
  }

  // Payment history (0-20 points)
  if (client.PaymentOverdue === true) {
    score -= 20;
    factors.push('Payment overdue');
  }

  // Support tickets (0-20 points)
  const openTickets = client.OpenTickets || 0;
  if (openTickets > 3) {
    score -= 15;
    factors.push(`${openTickets} open support tickets`);
  } else if (openTickets > 1) {
    score -= 5;
    factors.push(`${openTickets} open support tickets`);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    factors,
    risk: score >= 80 ? 'low' : score >= 60 ? 'medium' : score >= 40 ? 'high' : 'critical',
  };
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Fetch all active clients from Airtable.
 */
async function getActiveClients() {
  try {
    const clients = await getRecords(TABLES.CLIENTS, '{Status} = "Client"');
    logger.info(`Fetched ${clients.length} active clients`);
    return clients;
  } catch (error) {
    logger.error(`Failed to fetch active clients: ${error.message}`);
    throw error;
  }
}

/**
 * Get usage data for a specific client.
 */
async function getClientUsage(clientId) {
  try {
    const usage = await getRecords(
      TABLES.USAGE,
      `{ClientId} = "${clientId}"`
    );
    return usage.length > 0 ? usage[0] : null;
  } catch (error) {
    logger.error(`Failed to fetch usage for client ${clientId}: ${error.message}`);
    return null;
  }
}

/**
 * Get NPS scores for a client, sorted by date descending.
 */
async function getClientNPS(clientId) {
  try {
    const scores = await getRecords(
      TABLES.NPS,
      `{ClientId} = "${clientId}"`
    );
    return scores.sort((a, b) => new Date(b.Date) - new Date(a.Date));
  } catch (error) {
    logger.error(`Failed to fetch NPS for client ${clientId}: ${error.message}`);
    return [];
  }
}

/**
 * Check for upsell opportunities across all clients.
 */
async function checkUpsellOpportunities() {
  logger.info('Checking upsell opportunities...');
  const clients = await getActiveClients();
  const alerts = [];

  for (const client of clients) {
    try {
      const usage = await getClientUsage(client.id);
      if (!usage) continue;

      // Check usage limit approach
      const usagePercent = (usage.currentUsage / usage.usageLimit) * 100;
      if (usagePercent >= UPSELL_THRESHOLDS.USAGE_LIMIT_PERCENT) {
        alerts.push({
          clientId: client.id,
          clientName: client.CompanyName,
          type: 'usage_limit',
          message: `${client.CompanyName} at ${Math.round(usagePercent)}% of usage limit`,
          usagePercent: Math.round(usagePercent),
        });
      }

      // Check traffic growth
      if (usage.trafficGrowthPercent >= UPSELL_THRESHOLDS.TRAFFIC_GROWTH_PERCENT) {
        alerts.push({
          clientId: client.id,
          clientName: client.CompanyName,
          type: 'traffic_growth',
          message: `${client.CompanyName} traffic grew ${usage.trafficGrowthPercent}% this month`,
          growthPercent: usage.trafficGrowthPercent,
        });
      }

      // Check renewal approaching
      if (client.ContractEndDate) {
        const daysUntilRenewal = Math.ceil(
          (new Date(client.ContractEndDate) - new Date()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilRenewal <= UPSELL_THRESHOLDS.RENEWAL_DAYS && daysUntilRenewal > 0) {
          alerts.push({
            clientId: client.id,
            clientName: client.CompanyName,
            type: 'renewal',
            message: `${client.CompanyName} contract renews in ${daysUntilRenewal} days`,
            daysUntilRenewal,
          });
        }
      }
    } catch (error) {
      logger.error(`Error checking upsell for ${client.CompanyName}: ${error.message}`);
    }
  }

  // Store alerts and generate emails
  for (const alert of alerts) {
    try {
      await createRecord(TABLES.ALERTS, {
        ClientId: alert.clientId,
        Type: alert.type,
        Message: alert.message,
        Status: 'New',
        CreatedAt: new Date().toISOString(),
      });

      const emailDraft = await generateUpsellEmail(alert);
      alert.emailDraft = emailDraft;

      logger.info(`Upsell alert: ${alert.message}`);
    } catch (error) {
      logger.error(`Error storing alert for ${alert.clientName}: ${error.message}`);
    }
  }

  if (alerts.length > 0) {
    await notifyCEOAlerts(alerts, 'upsell');
  }

  logger.info(`Found ${alerts.length} upsell opportunities`);
  return alerts;
}

/**
 * Generate personalized upsell email via Claude.
 */
async function generateUpsellEmail(alert) {
  const typePrompts = {
    usage_limit: `The client "${alert.clientName}" is at ${alert.usagePercent}% of their usage limit.
      Suggest upgrading to the next tier with more capacity. Mention their growth as a positive sign.`,
    traffic_growth: `The client "${alert.clientName}" experienced ${alert.growthPercent}% traffic growth.
      Congratulate them and suggest adding performance optimization or CDN services.`,
    renewal: `The client "${alert.clientName}" has their contract renewing in ${alert.daysUntilRenewal} days.
      Propose a renewal with an upgraded package, highlighting new features and their success metrics.`,
  };

  const prompt = `You are a Key Account Manager at Werkpilot, a Swiss digital agency that builds websites,
web applications, and provides digital solutions for SMEs.

Write a personalized, professional upsell email in German (Swiss business style).
Keep it warm, consultative, not pushy. Reference specific data points.

Context: ${typePrompts[alert.type]}

Format the email with:
- Professional greeting using the company name
- 2-3 short paragraphs
- Clear call-to-action (e.g., schedule a call)
- Professional sign-off from the Werkpilot team

Return as JSON: { "subject": "...", "body": "..." }`;

  try {
    const result = await generateJSON(prompt, {
      model: config.models.standard,
      maxTokens: 1500,
    });
    return result;
  } catch (error) {
    logger.error(`Failed to generate upsell email for ${alert.clientName}: ${error.message}`);
    return null;
  }
}

/**
 * Monitor NPS scores and flag low scores.
 */
async function monitorNPSScores() {
  logger.info('Monitoring NPS scores...');
  const clients = await getActiveClients();
  const flaggedClients = [];

  for (const client of clients) {
    try {
      const npsScores = await getClientNPS(client.id);
      if (npsScores.length === 0) continue;

      const latestNPS = npsScores[0];
      if (latestNPS.Score < NPS_CHURN_THRESHOLD) {
        flaggedClients.push({
          clientId: client.id,
          clientName: client.CompanyName,
          npsScore: latestNPS.Score,
          previousScore: npsScores.length > 1 ? npsScores[1].Score : null,
          trend: npsScores.length > 1
            ? (latestNPS.Score - npsScores[1].Score > 0 ? 'improving' : 'declining')
            : 'unknown',
          feedback: latestNPS.Feedback || 'No feedback provided',
        });

        // Create churn risk alert
        await createRecord(TABLES.ALERTS, {
          ClientId: client.id,
          Type: 'nps_low',
          Message: `${client.CompanyName} NPS score: ${latestNPS.Score}/10 (${latestNPS.Feedback || 'No feedback'})`,
          Status: 'New',
          Priority: latestNPS.Score < 5 ? 'Critical' : 'High',
          CreatedAt: new Date().toISOString(),
        });

        logger.warn(`Low NPS flagged: ${client.CompanyName} scored ${latestNPS.Score}`);
      }
    } catch (error) {
      logger.error(`Error monitoring NPS for ${client.CompanyName}: ${error.message}`);
    }
  }

  if (flaggedClients.length > 0) {
    await alertCEOChurnSignals(flaggedClients);
  }

  logger.info(`Flagged ${flaggedClients.length} clients with low NPS`);
  return flaggedClients;
}

/**
 * Alert CEO about churn signals.
 */
async function alertCEOChurnSignals(flaggedClients) {
  const clientRows = flaggedClients.map(c => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${c.clientName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${c.npsScore < 5 ? '#e74c3c' : '#f39c12'};">
        ${c.npsScore}/10
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${c.trend}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${c.feedback}</td>
    </tr>
  `).join('');

  const html = `
    <h2>Churn Risk Alert</h2>
    <p>${flaggedClients.length} client(s) with NPS below ${NPS_CHURN_THRESHOLD}:</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">Client</th>
        <th style="padding: 8px; text-align: left;">NPS</th>
        <th style="padding: 8px; text-align: left;">Trend</th>
        <th style="padding: 8px; text-align: left;">Feedback</th>
      </tr>
      ${clientRows}
    </table>
    <p style="margin-top: 16px;">
      <strong>Recommended Action:</strong> Schedule personal calls with critical clients within 48 hours.
    </p>
  `;

  try {
    await sendCEOEmail({
      subject: `CHURN ALERT: ${flaggedClients.length} client(s) at risk`,
      html,
    });
    logger.info('CEO churn alert sent successfully');
  } catch (error) {
    logger.error(`Failed to send CEO churn alert: ${error.message}`);
  }
}

/**
 * Notify CEO about upsell and other alerts.
 */
async function notifyCEOAlerts(alerts, type) {
  const typeLabels = {
    upsell: 'Upsell Opportunities',
    health: 'Health Report Summary',
  };

  const alertRows = alerts.map(a => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${a.clientName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${a.type}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${a.message}</td>
    </tr>
  `).join('');

  const html = `
    <h2>${typeLabels[type] || 'Key Account Alerts'}</h2>
    <p>${alerts.length} alert(s) detected:</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">Client</th>
        <th style="padding: 8px; text-align: left;">Type</th>
        <th style="padding: 8px; text-align: left;">Details</th>
      </tr>
      ${alertRows}
    </table>
  `;

  try {
    await sendCEOEmail({
      subject: `Key Account: ${alerts.length} ${typeLabels[type] || 'alerts'}`,
      html,
    });
  } catch (error) {
    logger.error(`Failed to send CEO alerts notification: ${error.message}`);
  }
}

/**
 * Send proactive check-in emails to clients every 2 weeks.
 */
async function sendCheckInEmails() {
  logger.info('Running bi-weekly check-in cycle...');
  const clients = await getActiveClients();
  let sentCount = 0;

  for (const client of clients) {
    try {
      // Check last interaction date
      const interactions = await getRecords(
        TABLES.INTERACTIONS,
        `AND({ClientId} = "${client.id}", {Type} = "check_in")`
      );

      const lastCheckIn = interactions.length > 0
        ? new Date(interactions.sort((a, b) => new Date(b.Date) - new Date(a.Date))[0].Date)
        : null;

      const daysSinceLastCheckIn = lastCheckIn
        ? Math.ceil((new Date() - lastCheckIn) / (1000 * 60 * 60 * 24))
        : CHECK_IN_INTERVAL_DAYS + 1;

      if (daysSinceLastCheckIn < CHECK_IN_INTERVAL_DAYS) {
        logger.info(`Skipping ${client.CompanyName}: last check-in ${daysSinceLastCheckIn} days ago`);
        continue;
      }

      // Get client context for personalized email
      const usage = await getClientUsage(client.id);
      const npsScores = await getClientNPS(client.id);

      const prompt = `You are a Key Account Manager at Werkpilot, a Swiss digital agency.
Write a brief, friendly check-in email in German (Swiss business style) to ${client.CompanyName}.
Contact person: ${client.ContactName || 'the team'}.

Client context:
- Industry: ${client.Industry || 'Unknown'}
- Services: ${client.Services || 'Web presence'}
- Current usage: ${usage ? `${Math.round((usage.currentUsage / usage.usageLimit) * 100)}% of plan` : 'N/A'}
- Latest NPS: ${npsScores.length > 0 ? npsScores[0].Score + '/10' : 'Not yet rated'}
- Client since: ${client.StartDate || 'Unknown'}

The email should:
- Be warm and genuine, not template-like
- Reference something specific to their business or usage
- Ask if there is anything they need help with
- Keep it to 3-4 short paragraphs max
- Include a soft CTA (e.g., "let us know if you need anything" or suggest a quick call)

Return JSON: { "subject": "...", "body": "..." }`;

      const emailContent = await generateJSON(prompt, {
        model: config.models.fast,
        maxTokens: 1000,
      });

      if (client.ContactEmail) {
        await sendEmail({
          to: client.ContactEmail,
          subject: emailContent.subject,
          html: formatCheckInEmail(emailContent.body, client),
        });

        // Log the interaction
        await createRecord(TABLES.INTERACTIONS, {
          ClientId: client.id,
          Type: 'check_in',
          Subject: emailContent.subject,
          Date: new Date().toISOString(),
          Channel: 'email',
          Notes: 'Automated bi-weekly check-in',
        });

        sentCount++;
        logger.info(`Check-in sent to ${client.CompanyName}`);
      }
    } catch (error) {
      logger.error(`Failed check-in for ${client.CompanyName}: ${error.message}`);
    }
  }

  logger.info(`Sent ${sentCount} check-in emails`);
  return sentCount;
}

/**
 * Format check-in email with Werkpilot branding.
 */
function formatCheckInEmail(body, client) {
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; padding: 20px; text-align: center;">
        <h1 style="color: #00d4ff; margin: 0; font-size: 24px;">Werkpilot</h1>
      </div>
      <div style="padding: 30px; line-height: 1.6; color: #333;">
        ${body.replace(/\n/g, '<br>')}
      </div>
      <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
        <p>Werkpilot GmbH | Digitale Loesungen fuer Schweizer KMU</p>
        <p>
          <a href="https://werkpilot.ch" style="color: #00d4ff;">werkpilot.ch</a>
        </p>
      </div>
    </div>
  `;
}

/**
 * Generate monthly client health reports.
 */
async function generateMonthlyHealthReports() {
  logger.info('Generating monthly health reports...');
  const clients = await getActiveClients();
  const reports = [];

  for (const client of clients) {
    try {
      const usage = await getClientUsage(client.id);
      const npsScores = await getClientNPS(client.id);
      const health = calculateHealthScore(client, usage, npsScores);

      const report = {
        clientId: client.id,
        clientName: client.CompanyName,
        month: new Date().toISOString().slice(0, 7),
        healthScore: health.score,
        riskLevel: health.risk,
        factors: health.factors,
        usagePercent: usage ? Math.round((usage.currentUsage / usage.usageLimit) * 100) : null,
        latestNPS: npsScores.length > 0 ? npsScores[0].Score : null,
        contractEndDate: client.ContractEndDate || null,
        mrr: client.MRR || 0,
      };

      // Store report in Airtable
      await createRecord(TABLES.HEALTH_REPORTS, {
        ClientId: client.id,
        Month: report.month,
        HealthScore: report.healthScore,
        RiskLevel: report.riskLevel,
        Factors: report.factors.join('; '),
        UsagePercent: report.usagePercent,
        NPS: report.latestNPS,
        MRR: report.mrr,
        GeneratedAt: new Date().toISOString(),
      });

      reports.push(report);
    } catch (error) {
      logger.error(`Error generating health report for ${client.CompanyName}: ${error.message}`);
    }
  }

  // Send summary to CEO
  await sendHealthReportSummary(reports);

  logger.info(`Generated ${reports.length} health reports`);
  return reports;
}

/**
 * Send health report summary email to CEO.
 */
async function sendHealthReportSummary(reports) {
  const sortedReports = [...reports].sort((a, b) => a.healthScore - b.healthScore);

  const totalMRR = reports.reduce((sum, r) => sum + r.mrr, 0);
  const avgHealth = reports.length > 0
    ? Math.round(reports.reduce((sum, r) => sum + r.healthScore, 0) / reports.length)
    : 0;
  const atRisk = reports.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical');

  const reportRows = sortedReports.map(r => {
    const riskColors = { low: '#27ae60', medium: '#f39c12', high: '#e67e22', critical: '#e74c3c' };
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${r.clientName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">
          <span style="color: ${riskColors[r.riskLevel]}; font-weight: bold;">${r.healthScore}/100</span>
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${r.riskLevel.toUpperCase()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">CHF ${r.mrr}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${r.usagePercent || '-'}%</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${r.latestNPS || '-'}/10</td>
      </tr>
    `;
  }).join('');

  const html = `
    <h2>Monthly Client Health Report</h2>
    <p>Report for ${new Date().toISOString().slice(0, 7)}</p>

    <div style="display: flex; gap: 20px; margin: 20px 0;">
      <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; flex: 1;">
        <strong>Total MRR:</strong> CHF ${totalMRR.toLocaleString()}
      </div>
      <div style="background: #f0fff0; padding: 15px; border-radius: 8px; flex: 1;">
        <strong>Avg Health:</strong> ${avgHealth}/100
      </div>
      <div style="background: ${atRisk.length > 0 ? '#fff0f0' : '#f0fff0'}; padding: 15px; border-radius: 8px; flex: 1;">
        <strong>At Risk:</strong> ${atRisk.length} client(s)
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">Client</th>
        <th style="padding: 8px; text-align: left;">Score</th>
        <th style="padding: 8px; text-align: left;">Risk</th>
        <th style="padding: 8px; text-align: left;">MRR</th>
        <th style="padding: 8px; text-align: left;">Usage</th>
        <th style="padding: 8px; text-align: left;">NPS</th>
      </tr>
      ${reportRows}
    </table>

    ${atRisk.length > 0 ? `
      <h3 style="color: #e74c3c; margin-top: 20px;">Immediate Attention Required</h3>
      <ul>
        ${atRisk.map(r => `<li><strong>${r.clientName}</strong> (Score: ${r.healthScore}) - ${r.factors.join(', ')}</li>`).join('')}
      </ul>
    ` : ''}
  `;

  try {
    await sendCEOEmail({
      subject: `Monthly Health Report: ${reports.length} clients, Avg Score ${avgHealth}/100`,
      html,
    });
    logger.info('Monthly health report summary sent to CEO');
  } catch (error) {
    logger.error(`Failed to send health report summary: ${error.message}`);
  }
}

/**
 * Main daily monitoring run.
 */
async function runDailyMonitoring() {
  logger.info('=== Key Account Daily Monitoring Started ===');
  const startTime = Date.now();

  try {
    await checkUpsellOpportunities();
    await monitorNPSScores();
  } catch (error) {
    logger.error(`Daily monitoring failed: ${error.message}`, { stack: error.stack });
    await sendCEOEmail({
      subject: 'Key Account Agent: Daily Monitoring Error',
      html: `<p>The Key Account monitoring agent encountered an error:</p><pre>${error.message}</pre>`,
    });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Daily monitoring completed in ${duration}s ===`);
}

/**
 * Full monthly cycle: health reports + monitoring.
 */
async function runMonthlyCycle() {
  logger.info('=== Key Account Monthly Cycle Started ===');
  const startTime = Date.now();

  try {
    await generateMonthlyHealthReports();
  } catch (error) {
    logger.error(`Monthly cycle failed: ${error.message}`, { stack: error.stack });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Monthly cycle completed in ${duration}s ===`);
}

// ── Cron Scheduling ──────────────────────────────────────────────────────────

// Daily monitoring at 08:00
cron.schedule('0 8 * * *', () => {
  runDailyMonitoring().catch(err => logger.error(`Cron daily error: ${err.message}`));
});

// Bi-weekly check-in emails (every other Monday at 09:00)
cron.schedule('0 9 * * 1', () => {
  const weekNumber = Math.ceil(new Date().getDate() / 7);
  if (weekNumber % 2 === 1) {
    sendCheckInEmails().catch(err => logger.error(`Cron check-in error: ${err.message}`));
  }
});

// Monthly health reports (1st of every month at 07:00)
cron.schedule('0 7 1 * *', () => {
  runMonthlyCycle().catch(err => logger.error(`Cron monthly error: ${err.message}`));
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runDailyMonitoring,
  runMonthlyCycle,
  sendCheckInEmails,
  checkUpsellOpportunities,
  monitorNPSScores,
  generateMonthlyHealthReports,
  calculateHealthScore,
};

// Run immediately if executed directly
if (require.main === module) {
  runDailyMonitoring()
    .then(() => logger.info('Manual run completed'))
    .catch(err => logger.error(`Manual run failed: ${err.message}`));
}
