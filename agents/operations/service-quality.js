/**
 * Agent 22 — Service Quality Agent
 * Department: Operations
 *
 * Real-time monitoring of client deliverables, SLA tracking,
 * feedback integration, complaint handling, quality trends,
 * and monthly quality reporting.
 *
 * Schedule: SLA check every 15 minutes, complaint processing hourly,
 * daily quality summary, weekly trends, monthly CEO report
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const config = require('../shared/utils/config');

const log = createLogger('service-quality');

// --- Configuration ---

const SLA_CONFIG_PATH = path.join(__dirname, 'sla-definitions.json');
const COMPLAINT_CONFIG_PATH = path.join(__dirname, 'complaint-categories.json');

let slaConfig = {};
let complaintConfig = {};

function loadConfigs() {
  try {
    slaConfig = JSON.parse(fs.readFileSync(SLA_CONFIG_PATH, 'utf8'));
    log.info(`SLA config loaded: ${Object.keys(slaConfig.services || {}).length} service definitions`);
  } catch (err) {
    log.error(`Failed to load SLA config: ${err.message}`);
  }

  try {
    complaintConfig = JSON.parse(fs.readFileSync(COMPLAINT_CONFIG_PATH, 'utf8'));
    log.info(`Complaint config loaded: ${Object.keys(complaintConfig.categories || {}).length} categories`);
  } catch (err) {
    log.error(`Failed to load complaint config: ${err.message}`);
  }
}

// --- SLA Tracking ---

/**
 * Check all active SLAs against current performance
 */
async function checkSLAs() {
  log.info('Checking SLA compliance...');
  const violations = [];
  const services = slaConfig.services || {};

  try {
    // Check content delivery SLAs
    const pendingContent = await getRecords('Content', "{Status} = 'In Progress'");
    for (const content of pendingContent) {
      const service = services['blog-content'] || services['social-media'];
      if (!service) continue;

      const createdAt = new Date(content.CreatedAt || content.created_time);
      const hoursElapsed = (Date.now() - createdAt.getTime()) / 3600000;
      const slaHours = service.sla.deliveryTimeHours || 48;

      if (hoursElapsed > slaHours) {
        violations.push({
          type: 'content-delivery',
          service: 'blog-content',
          recordId: content.id,
          clientId: content.ClientID,
          hoursElapsed: hoursElapsed.toFixed(1),
          slaHours,
          severity: hoursElapsed > slaHours * 1.5 ? 'critical' : 'high',
        });
      }
    }

    // Check lead response SLAs
    const newLeads = await getRecords('Leads', "{Status} = 'New'");
    for (const lead of newLeads) {
      const createdAt = new Date(lead.CreatedAt || lead.created_time);
      const minutesElapsed = (Date.now() - createdAt.getTime()) / 60000;
      const slaMinutes = (services['lead-response'] || {}).sla?.responseTimeMinutes || 30;

      if (minutesElapsed > slaMinutes) {
        violations.push({
          type: 'lead-response',
          service: 'lead-response',
          recordId: lead.id,
          minutesElapsed: minutesElapsed.toFixed(0),
          slaMinutes,
          severity: minutesElapsed > slaMinutes * 3 ? 'critical' : 'high',
        });
      }
    }

    // Track SLA violations in Airtable
    for (const violation of violations) {
      try {
        await createRecord('SLATracking', {
          Service: violation.service,
          Type: violation.type,
          RecordID: violation.recordId || '',
          ClientID: violation.clientId || '',
          Severity: violation.severity,
          Details: JSON.stringify(violation),
          Date: new Date().toISOString().split('T')[0],
          Status: 'Open',
        });
      } catch (err) {
        log.warn(`Failed to record SLA violation: ${err.message}`);
      }
    }

    if (violations.length > 0) {
      log.warn(`SLA violations found: ${violations.length}`);

      // Alert on critical violations
      const critical = violations.filter(v => v.severity === 'critical');
      if (critical.length > 0) {
        await sendCEOEmail({
          subject: `SLA Alert: ${critical.length} critical violation(s)`,
          html: `
            <h2>Critical SLA Violations</h2>
            <table border="1" cellpadding="8" cellspacing="0">
              <tr><th>Service</th><th>Type</th><th>Elapsed</th><th>SLA</th><th>Severity</th></tr>
              ${critical.map(v => `
                <tr style="background: #ffcccc;">
                  <td>${v.service}</td>
                  <td>${v.type}</td>
                  <td>${v.hoursElapsed || v.minutesElapsed}${v.hoursElapsed ? 'h' : 'min'}</td>
                  <td>${v.slaHours || v.slaMinutes}${v.slaHours ? 'h' : 'min'}</td>
                  <td>${v.severity}</td>
                </tr>
              `).join('')}
            </table>
          `,
        });
      }
    } else {
      log.info('All SLAs within compliance');
    }

    return { violations, total: violations.length, critical: violations.filter(v => v.severity === 'critical').length };
  } catch (err) {
    log.error(`SLA check failed: ${err.message}`);
    return { violations: [], error: err.message };
  }
}

// --- Content Quality Scoring ---

/**
 * Score content quality (grammar, tone, brand alignment)
 */
async function scoreContentQuality(content, contentType = 'blog') {
  log.info(`Scoring content quality for ${contentType}`);

  try {
    const result = await generateJSON(
      `Score this ${contentType} content across quality dimensions:

Content:
${content.substring(0, 3000)}

Provide scores (0-10) for:
1. grammar - grammatical correctness and language quality
2. tone - appropriate tone for Swiss business audience
3. brandAlignment - alignment with Werkpilot brand voice (professional, helpful, innovative)
4. clarity - how clear and understandable is the content
5. engagement - how engaging and compelling is the content
6. seoOptimization - how well optimized for search engines

Also provide:
- overallScore (0-10, weighted average)
- issues (array of objects with "type", "description", "severity")
- suggestions (array of improvement suggestions)

Respond with JSON.`,
      { model: config.models.fast, maxTokens: 800 }
    );

    log.info(`Content quality score: ${result.overallScore}/10`);
    return result;
  } catch (err) {
    log.error(`Content quality scoring failed: ${err.message}`);
    return {
      grammar: 0,
      tone: 0,
      brandAlignment: 0,
      clarity: 0,
      engagement: 0,
      seoOptimization: 0,
      overallScore: 0,
      issues: [{ type: 'scoring-error', description: err.message, severity: 'high' }],
      suggestions: []
    };
  }
}

// --- Data Quality Checks ---

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email) return { valid: false, error: 'Email is empty' };
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid = regex.test(email);
  return {
    valid,
    error: valid ? null : 'Invalid email format',
    normalized: valid ? email.toLowerCase().trim() : email
  };
}

/**
 * Validate and format Swiss phone number
 */
function validateAndFormatPhone(phone) {
  if (!phone) return { valid: false, error: 'Phone is empty', formatted: '' };

  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle Swiss numbers
  if (digits.startsWith('0041')) {
    digits = digits.substring(4);
  } else if (digits.startsWith('41')) {
    digits = digits.substring(2);
  } else if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Swiss mobile: 7X, 8X (9 digits total)
  // Swiss landline: area code + number (9 digits total)
  if (digits.length === 9) {
    const formatted = `+41 ${digits.substring(0, 2)} ${digits.substring(2, 5)} ${digits.substring(5, 7)} ${digits.substring(7, 9)}`;
    return { valid: true, error: null, formatted, original: phone };
  }

  return { valid: false, error: 'Invalid Swiss phone format', formatted: phone, original: phone };
}

/**
 * Check data completeness for required fields
 */
function checkDataCompleteness(record, requiredFields) {
  const completeness = {
    score: 0,
    total: requiredFields.length,
    missing: [],
    present: [],
    percentage: 0,
  };

  for (const field of requiredFields) {
    if (record[field] && record[field] !== '' && record[field] !== null) {
      completeness.present.push(field);
      completeness.score++;
    } else {
      completeness.missing.push(field);
    }
  }

  completeness.percentage = ((completeness.score / completeness.total) * 100).toFixed(0);

  return completeness;
}

/**
 * Score lead data completeness
 */
function scoreLeadCompleteness(lead) {
  const requiredFields = ['CompanyName', 'Email', 'Phone', 'ContactName', 'Industry', 'EmployeeCount'];
  const optionalFields = ['Website', 'Address', 'City', 'Canton', 'Revenue', 'Description'];

  const required = checkDataCompleteness(lead, requiredFields);
  const optional = checkDataCompleteness(lead, optionalFields);

  // Weight required fields more heavily
  const overallScore = ((required.percentage * 0.7) + (optional.percentage * 0.3)).toFixed(0);

  log.info(`Lead completeness: ${overallScore}% (required: ${required.percentage}%, optional: ${optional.percentage}%)`);

  return {
    overallScore: parseInt(overallScore),
    required,
    optional,
    qualityLevel: overallScore >= 80 ? 'excellent' : overallScore >= 60 ? 'good' : overallScore >= 40 ? 'fair' : 'poor',
  };
}

/**
 * Automated data cleanup
 */
async function cleanupLeadData(lead) {
  log.info(`Cleaning up lead data: ${lead.id}`);

  const cleaned = { ...lead };
  const changes = [];

  // Clean email
  if (cleaned.Email) {
    const emailValidation = validateEmail(cleaned.Email);
    if (emailValidation.valid && emailValidation.normalized !== cleaned.Email) {
      cleaned.Email = emailValidation.normalized;
      changes.push({ field: 'Email', from: lead.Email, to: emailValidation.normalized, reason: 'normalized' });
    } else if (!emailValidation.valid) {
      changes.push({ field: 'Email', from: lead.Email, to: lead.Email, reason: 'invalid', error: emailValidation.error });
    }
  }

  // Clean phone
  if (cleaned.Phone) {
    const phoneValidation = validateAndFormatPhone(cleaned.Phone);
    if (phoneValidation.valid && phoneValidation.formatted !== cleaned.Phone) {
      cleaned.Phone = phoneValidation.formatted;
      changes.push({ field: 'Phone', from: lead.Phone, to: phoneValidation.formatted, reason: 'formatted' });
    } else if (!phoneValidation.valid) {
      changes.push({ field: 'Phone', from: lead.Phone, to: lead.Phone, reason: 'invalid', error: phoneValidation.error });
    }
  }

  // Trim whitespace from text fields
  const textFields = ['CompanyName', 'ContactName', 'Industry', 'City', 'Canton', 'Website', 'Description'];
  for (const field of textFields) {
    if (cleaned[field] && typeof cleaned[field] === 'string') {
      const trimmed = cleaned[field].trim();
      if (trimmed !== cleaned[field]) {
        cleaned[field] = trimmed;
        changes.push({ field, from: lead[field], to: trimmed, reason: 'trimmed whitespace' });
      }
    }
  }

  // Update record if changes were made
  if (changes.length > 0) {
    try {
      const updateData = {};
      for (const change of changes) {
        if (change.reason !== 'invalid') {
          updateData[change.field] = cleaned[change.field];
        }
      }

      if (Object.keys(updateData).length > 0) {
        await updateRecord('Leads', lead.id, updateData);
        log.info(`Lead ${lead.id} cleaned: ${changes.length} changes made`);
      }
    } catch (err) {
      log.error(`Failed to update cleaned lead data: ${err.message}`);
    }
  }

  return { cleaned, changes, changeCount: changes.length };
}

/**
 * Process data quality for all leads
 */
async function processLeadDataQuality() {
  log.info('Processing lead data quality...');

  try {
    const leads = await getRecords('Leads', "{Status} != 'Archived'");

    if (leads.length === 0) {
      log.info('No leads to process');
      return { processed: 0 };
    }

    log.info(`Processing ${leads.length} leads`);
    let processed = 0;
    let cleaned = 0;
    const qualityStats = { excellent: 0, good: 0, fair: 0, poor: 0 };

    for (const lead of leads) {
      try {
        // Score completeness
        const completeness = scoreLeadCompleteness(lead);
        qualityStats[completeness.qualityLevel]++;

        // Cleanup data
        const cleanupResult = await cleanupLeadData(lead);
        if (cleanupResult.changeCount > 0) {
          cleaned++;
        }

        // Update quality score in Airtable
        await updateRecord('Leads', lead.id, {
          DataQualityScore: completeness.overallScore,
          DataQualityLevel: completeness.qualityLevel,
          LastQualityCheck: new Date().toISOString(),
        });

        processed++;
      } catch (err) {
        log.error(`Failed to process lead ${lead.id}: ${err.message}`);
      }
    }

    log.info(`Lead data quality complete: ${processed} processed, ${cleaned} cleaned`);
    return { processed, cleaned, total: leads.length, qualityStats };
  } catch (err) {
    log.error(`Lead data quality processing failed: ${err.message}`);
    return { error: err.message };
  }
}

// --- Client Feedback Integration ---

/**
 * Process client feedback from NPS surveys, emails, and support
 */
async function processClientFeedback() {
  log.info('Processing client feedback...');

  try {
    const unprocessed = await getRecords('ClientFeedback', "{Processed} = FALSE()");

    if (unprocessed.length === 0) {
      log.info('No new feedback to process');
      return { processed: 0 };
    }

    log.info(`Processing ${unprocessed.length} feedback entries`);
    let processed = 0;

    for (const feedback of unprocessed) {
      try {
        // Analyze sentiment and categorize with Claude
        const analysis = await generateJSON(
          `Analyze this client feedback and provide:
1. Sentiment score (-1 to 1, where -1 is very negative, 0 neutral, 1 very positive)
2. Category (quality, timeliness, communication, billing, service, other)
3. Key themes (array of strings)
4. Action required (boolean)
5. Suggested action (string, if action required)
6. Priority (low, medium, high, critical)

Client: ${feedback.ClientName || 'Unknown'}
Source: ${feedback.Source || 'Unknown'}
NPS Score: ${feedback.NPSScore || 'N/A'}
Feedback: ${feedback.Text || feedback.Message || 'No text'}

Respond with JSON.`,
          { model: config.models.fast, maxTokens: 500 }
        );

        // Update feedback record
        await updateRecord('ClientFeedback', feedback.id, {
          Processed: true,
          Sentiment: analysis.sentiment || 0,
          Category: analysis.category || 'other',
          Themes: (analysis.themes || []).join(', '),
          ActionRequired: analysis.actionRequired || false,
          SuggestedAction: analysis.suggestedAction || '',
          Priority: analysis.priority || 'low',
          ProcessedAt: new Date().toISOString(),
        });

        // If negative and high priority, create a complaint
        if (analysis.sentiment < -0.3 && (analysis.priority === 'high' || analysis.priority === 'critical')) {
          await handleComplaint({
            clientId: feedback.ClientID,
            clientName: feedback.ClientName,
            category: analysis.category,
            description: feedback.Text || feedback.Message,
            severity: analysis.priority,
            source: feedback.Source || 'feedback',
          });
        }

        processed++;
      } catch (err) {
        log.error(`Failed to process feedback ${feedback.id}: ${err.message}`);
      }
    }

    return { processed, total: unprocessed.length };
  } catch (err) {
    log.error(`Feedback processing failed: ${err.message}`);
    return { error: err.message };
  }
}

// --- Complaint Handling ---

/**
 * Handle a new complaint
 */
async function handleComplaint({ clientId, clientName, category, subcategory, description, severity, source }) {
  log.info(`Handling complaint: ${category}/${subcategory || 'general'} from ${clientName || clientId} (${severity})`);

  const categoryConfig = (complaintConfig.categories || {})[category] || {};
  const severityConfig = (complaintConfig.severityMatrix || {})[severity] || {};

  try {
    // Create complaint record
    const record = await createRecord('Complaints', {
      ClientID: clientId || '',
      ClientName: clientName || '',
      Category: category,
      Subcategory: subcategory || '',
      Description: description,
      Severity: severity,
      Source: source || 'manual',
      Status: 'open',
      SLAResponseHours: severityConfig.maxResponseHours || 24,
      CreatedAt: new Date().toISOString(),
    });

    // Execute auto-actions
    const autoActions = categoryConfig.autoActions || [];

    for (const action of autoActions) {
      switch (action) {
        case 'notify-ceo':
          await sendCEOEmail({
            subject: `Complaint [${severity.toUpperCase()}]: ${category} - ${clientName || clientId}`,
            html: `
              <h2>New Client Complaint</h2>
              <table border="1" cellpadding="8" cellspacing="0">
                <tr><td><strong>Client</strong></td><td>${clientName || clientId}</td></tr>
                <tr><td><strong>Category</strong></td><td>${category}${subcategory ? ` / ${subcategory}` : ''}</td></tr>
                <tr><td><strong>Severity</strong></td><td style="color: ${severity === 'critical' ? 'red' : severity === 'high' ? 'orange' : 'inherit'}">${severity.toUpperCase()}</td></tr>
                <tr><td><strong>Source</strong></td><td>${source}</td></tr>
                <tr><td><strong>Description</strong></td><td>${description}</td></tr>
                <tr><td><strong>SLA Response</strong></td><td>${severityConfig.maxResponseHours || 24} hours</td></tr>
              </table>
            `,
          });
          break;

        case 'send-apology':
          // Generate apology email if client email available
          if (clientId) {
            const client = await getRecords('Clients', `{ClientID} = '${clientId}'`);
            if (client.length > 0 && client[0].Email) {
              const apology = await generateText(
                `Write a professional, empathetic apology email for a ${category} complaint from a Swiss business client. Keep it brief (3-4 sentences). Acknowledge the issue and assure swift resolution. Write in German (Swiss style).`,
                { model: config.models.fast, maxTokens: 300 }
              );
              await sendEmail({
                to: client[0].Email,
                subject: `Ihre Rückmeldung - Werkpilot`,
                html: `<p>${apology.replace(/\n/g, '<br>')}</p>`,
              });
            }
          }
          break;

        case 'escalate-to-ops':
        case 'flag-for-review':
        case 'notify-account-manager':
        case 'alert-infrastructure':
        case 'notify-finance':
        case 'notify-content-team':
        case 'schedule-call':
        case 'schedule-review':
        case 'create-incident':
          log.info(`Auto-action: ${action} for complaint ${record.id || 'new'}`);
          break;

        default:
          log.warn(`Unknown auto-action: ${action}`);
      }
    }

    return { complaintId: record.id || 'created', severity, category, autoActions };
  } catch (err) {
    log.error(`Complaint handling failed: ${err.message}`);
    return { error: err.message };
  }
}

/**
 * Process open complaints and check SLA response times
 */
async function checkComplaintSLAs() {
  try {
    const openComplaints = await getRecords('Complaints', "{Status} = 'open'");

    const overdue = [];
    for (const complaint of openComplaints) {
      const createdAt = new Date(complaint.CreatedAt || complaint.created_time);
      const hoursElapsed = (Date.now() - createdAt.getTime()) / 3600000;
      const slaHours = complaint.SLAResponseHours || 24;

      if (hoursElapsed > slaHours) {
        overdue.push({
          id: complaint.id,
          clientName: complaint.ClientName,
          category: complaint.Category,
          severity: complaint.Severity,
          hoursElapsed: hoursElapsed.toFixed(1),
          slaHours,
        });
      }
    }

    if (overdue.length > 0) {
      log.warn(`${overdue.length} overdue complaint responses`);
    }

    return { openComplaints: openComplaints.length, overdue };
  } catch (err) {
    log.error(`Complaint SLA check failed: ${err.message}`);
    return { error: err.message };
  }
}

// --- Quality Trends ---

/**
 * Calculate quality trends per agent, per client, per service
 */
async function calculateQualityTrends(days = 30) {
  log.info(`Calculating quality trends for last ${days} days...`);

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString().split('T')[0];

    // Fetch SLA data
    const slaRecords = await getRecords('SLATracking', `{Date} >= '${cutoff}'`);

    // Fetch complaint data
    const complaints = await getRecords('Complaints', `CREATED_TIME() >= '${cutoff}'`);

    // Fetch feedback data
    const feedback = await getRecords('ClientFeedback', `{ProcessedAt} >= '${cutoff}'`);

    // Calculate trends
    const trends = {
      period: `${cutoff} to ${new Date().toISOString().split('T')[0]}`,
      overall: {
        slaViolations: slaRecords.length,
        complaints: complaints.length,
        feedbackEntries: feedback.length,
        avgSentiment: 0,
        avgNPS: 0,
      },
      byService: {},
      byClient: {},
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    };

    // Sentiment average
    const sentimentValues = feedback.filter(f => f.Sentiment !== undefined).map(f => f.Sentiment);
    if (sentimentValues.length > 0) {
      trends.overall.avgSentiment = (sentimentValues.reduce((a, b) => a + b, 0) / sentimentValues.length).toFixed(2);
    }

    // NPS average
    const npsValues = feedback.filter(f => f.NPSScore !== undefined).map(f => f.NPSScore);
    if (npsValues.length > 0) {
      trends.overall.avgNPS = (npsValues.reduce((a, b) => a + b, 0) / npsValues.length).toFixed(1);
    }

    // By service
    for (const record of slaRecords) {
      const service = record.Service || 'unknown';
      if (!trends.byService[service]) trends.byService[service] = { violations: 0, resolved: 0 };
      trends.byService[service].violations++;
      if (record.Status === 'Resolved') trends.byService[service].resolved++;
    }

    // By client
    for (const complaint of complaints) {
      const client = complaint.ClientName || complaint.ClientID || 'unknown';
      if (!trends.byClient[client]) trends.byClient[client] = { complaints: 0, avgSeverity: 0 };
      trends.byClient[client].complaints++;
    }

    // By severity
    for (const complaint of complaints) {
      const severity = complaint.Severity || 'medium';
      if (trends.bySeverity[severity] !== undefined) trends.bySeverity[severity]++;
    }

    return trends;
  } catch (err) {
    log.error(`Quality trend calculation failed: ${err.message}`);
    return { error: err.message };
  }
}

// --- Industry Benchmarking ---

async function generateBenchmarkComparison() {
  try {
    const trends = await calculateQualityTrends(30);

    const benchmark = await generateJSON(
      `Compare these service quality metrics for a Swiss AI automation agency against industry benchmarks:

Our metrics (last 30 days):
- SLA violations: ${trends.overall.slaViolations}
- Complaints: ${trends.overall.complaints}
- Average sentiment: ${trends.overall.avgSentiment} (-1 to 1)
- Average NPS: ${trends.overall.avgNPS}

Provide JSON with:
{
  "benchmarks": { "metric": { "ours": number, "industryAvg": number, "topPerformer": number, "rating": "below"|"average"|"above"|"excellent" } },
  "overallRating": "string",
  "improvements": ["string"]
}`,
      { model: config.models.fast, maxTokens: 500 }
    );

    return benchmark;
  } catch (err) {
    log.error(`Benchmarking failed: ${err.message}`);
    return { error: err.message };
  }
}

// --- Weekly Quality Report ---

async function generateWeeklyQualityReport() {
  log.info('Generating weekly quality report...');

  try {
    const trends = await calculateQualityTrends(7);
    const dataQuality = await processLeadDataQuality();

    const reportHtml = `
      <h2>Weekly Quality Report</h2>
      <p>Week ending: ${new Date().toLocaleDateString('de-CH')}</p>

      <h3>Service Quality</h3>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><td><strong>SLA Violations</strong></td><td>${trends.overall.slaViolations}</td></tr>
        <tr><td><strong>Complaints</strong></td><td>${trends.overall.complaints}</td></tr>
        <tr><td><strong>Avg Sentiment</strong></td><td>${trends.overall.avgSentiment}</td></tr>
        <tr><td><strong>Avg NPS</strong></td><td>${trends.overall.avgNPS}</td></tr>
      </table>

      <h3>Data Quality</h3>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><td><strong>Leads Processed</strong></td><td>${dataQuality.processed || 0}</td></tr>
        <tr><td><strong>Leads Cleaned</strong></td><td>${dataQuality.cleaned || 0}</td></tr>
        <tr><td><strong>Excellent Quality</strong></td><td>${dataQuality.qualityStats?.excellent || 0}</td></tr>
        <tr><td><strong>Good Quality</strong></td><td>${dataQuality.qualityStats?.good || 0}</td></tr>
        <tr><td><strong>Fair Quality</strong></td><td>${dataQuality.qualityStats?.fair || 0}</td></tr>
        <tr><td><strong>Poor Quality</strong></td><td>${dataQuality.qualityStats?.poor || 0}</td></tr>
      </table>
    `;

    // Sync to dashboard
    await syncQualityMetricsToDashboard({
      trends,
      dataQuality,
      timestamp: new Date().toISOString(),
    });

    return { reportHtml, trends, dataQuality };
  } catch (err) {
    log.error(`Weekly quality report failed: ${err.message}`);
    return { error: err.message };
  }
}

// --- Sync to Dashboard ---

async function syncQualityMetricsToDashboard(metrics) {
  log.info('Syncing quality metrics to dashboard...');

  try {
    await createRecord('QualityMetrics', {
      Period: 'weekly',
      SLAViolations: metrics.trends?.overall?.slaViolations || 0,
      Complaints: metrics.trends?.overall?.complaints || 0,
      AvgSentiment: metrics.trends?.overall?.avgSentiment || 0,
      AvgNPS: metrics.trends?.overall?.avgNPS || 0,
      LeadsProcessed: metrics.dataQuality?.processed || 0,
      LeadsCleaned: metrics.dataQuality?.cleaned || 0,
      ExcellentQuality: metrics.dataQuality?.qualityStats?.excellent || 0,
      GoodQuality: metrics.dataQuality?.qualityStats?.good || 0,
      FairQuality: metrics.dataQuality?.qualityStats?.fair || 0,
      PoorQuality: metrics.dataQuality?.qualityStats?.poor || 0,
      Timestamp: metrics.timestamp,
    });

    log.info('Quality metrics synced to dashboard');
  } catch (err) {
    log.warn(`Failed to sync quality metrics: ${err.message}`);
  }
}

// --- Monthly Quality Report ---

async function generateMonthlyQualityReport() {
  log.info('Generating monthly quality report for CEO...');

  try {
    const trends = await calculateQualityTrends(30);
    const benchmark = await generateBenchmarkComparison();
    const complaintStatus = await checkComplaintSLAs();
    const dataQuality = await processLeadDataQuality();

    // Generate executive summary with Claude
    const summary = await generateText(
      `Write a brief executive summary (3-4 paragraphs) of the service quality report for the CEO of a Swiss AI automation agency (Werkpilot). Use professional German (Swiss style).

Key metrics:
- SLA violations: ${trends.overall.slaViolations}
- Complaints: ${trends.overall.complaints}
- Average sentiment: ${trends.overall.avgSentiment}
- Open complaints: ${complaintStatus.openComplaints || 0}
- Overdue responses: ${(complaintStatus.overdue || []).length}
- Data quality: ${dataQuality.qualityStats?.excellent || 0} excellent, ${dataQuality.qualityStats?.poor || 0} poor

Focus on: what's going well, what needs attention, and recommended actions.`,
      { model: config.models.standard, maxTokens: 800 }
    );

    const reportHtml = `
      <h1>Werkpilot - Monatlicher Qualitätsbericht</h1>
      <p>Berichtszeitraum: ${trends.period}</p>

      <h2>Zusammenfassung</h2>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
        ${summary.replace(/\n/g, '<br>')}
      </div>

      <h2>Service Quality Metrics</h2>
      <table border="1" cellpadding="8" cellspacing="0" style="width:100%">
        <tr><td><strong>SLA Violations</strong></td><td>${trends.overall.slaViolations}</td></tr>
        <tr><td><strong>Complaints</strong></td><td>${trends.overall.complaints}</td></tr>
        <tr><td><strong>Feedback Entries</strong></td><td>${trends.overall.feedbackEntries}</td></tr>
        <tr><td><strong>Avg Sentiment</strong></td><td>${trends.overall.avgSentiment}</td></tr>
        <tr><td><strong>Avg NPS</strong></td><td>${trends.overall.avgNPS}</td></tr>
        <tr><td><strong>Open Complaints</strong></td><td>${complaintStatus.openComplaints || 0}</td></tr>
        <tr><td><strong>Overdue Responses</strong></td><td>${(complaintStatus.overdue || []).length}</td></tr>
      </table>

      <h2>Data Quality Metrics</h2>
      <table border="1" cellpadding="8" cellspacing="0" style="width:100%">
        <tr><td><strong>Leads Processed</strong></td><td>${dataQuality.processed || 0}</td></tr>
        <tr><td><strong>Leads Cleaned</strong></td><td>${dataQuality.cleaned || 0}</td></tr>
        <tr><td><strong>Excellent Quality</strong></td><td>${dataQuality.qualityStats?.excellent || 0}</td></tr>
        <tr><td><strong>Good Quality</strong></td><td>${dataQuality.qualityStats?.good || 0}</td></tr>
        <tr><td><strong>Fair Quality</strong></td><td>${dataQuality.qualityStats?.fair || 0}</td></tr>
        <tr><td><strong>Poor Quality</strong></td><td>${dataQuality.qualityStats?.poor || 0}</td></tr>
      </table>

      <h2>Severity Breakdown</h2>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><th>Severity</th><th>Count</th></tr>
        ${Object.entries(trends.bySeverity).map(([sev, count]) =>
          `<tr><td>${sev}</td><td>${count}</td></tr>`
        ).join('')}
      </table>

      <h2>By Service</h2>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><th>Service</th><th>Violations</th><th>Resolved</th></tr>
        ${Object.entries(trends.byService).map(([service, data]) =>
          `<tr><td>${service}</td><td>${data.violations}</td><td>${data.resolved}</td></tr>`
        ).join('')}
      </table>

      ${benchmark.overallRating ? `
      <h2>Industry Benchmark</h2>
      <p>Overall Rating: <strong>${benchmark.overallRating}</strong></p>
      ${benchmark.improvements ? `<ul>${benchmark.improvements.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}
      ` : ''}
    `;

    // Send to CEO
    await sendCEOEmail({
      subject: 'Monatlicher Qualitätsbericht - Werkpilot',
      html: reportHtml,
    });

    // Sync to dashboard
    await syncQualityMetricsToDashboard({
      trends,
      dataQuality,
      timestamp: new Date().toISOString(),
    });

    log.info('Monthly quality report sent to CEO');
    return { sent: true, trends, benchmark, dataQuality };
  } catch (err) {
    log.error(`Monthly quality report failed: ${err.message}`);
    return { error: err.message };
  }
}

// --- Main Run ---

async function run() {
  log.info('Service Quality Agent starting...');
  loadConfigs();

  const [slaResult, feedbackResult, complaintSLAs, trends, dataQuality] = await Promise.all([
    checkSLAs(),
    processClientFeedback(),
    checkComplaintSLAs(),
    calculateQualityTrends(7),
    processLeadDataQuality(),
  ]);

  const result = {
    slaViolations: slaResult.total || 0,
    feedbackProcessed: feedbackResult.processed || 0,
    overdueComplaints: (complaintSLAs.overdue || []).length,
    dataQuality: {
      processed: dataQuality.processed || 0,
      cleaned: dataQuality.cleaned || 0,
      qualityStats: dataQuality.qualityStats || {},
    },
    weeklyTrends: {
      violations: trends.overall ? trends.overall.slaViolations : 0,
      complaints: trends.overall ? trends.overall.complaints : 0,
      sentiment: trends.overall ? trends.overall.avgSentiment : 'N/A',
    },
    timestamp: new Date().toISOString(),
  };

  // Sync metrics to dashboard
  await syncQualityMetricsToDashboard({
    trends,
    dataQuality,
    timestamp: result.timestamp,
  });

  log.info(`Service Quality run complete: ${JSON.stringify(result)}`);
  return result;
}

// --- Cron Scheduling ---

function startSchedule() {
  loadConfigs();

  // SLA check every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await checkSLAs();
    } catch (err) {
      log.error(`SLA check failed: ${err.message}`);
    }
  });

  // Process feedback hourly
  cron.schedule('0 * * * *', async () => {
    try {
      await processClientFeedback();
    } catch (err) {
      log.error(`Feedback processing failed: ${err.message}`);
    }
  });

  // Check complaint SLAs every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      await checkComplaintSLAs();
    } catch (err) {
      log.error(`Complaint SLA check failed: ${err.message}`);
    }
  });

  // Data quality check every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      await processLeadDataQuality();
    } catch (err) {
      log.error(`Data quality check failed: ${err.message}`);
    }
  });

  // Daily quality summary at 18:00
  cron.schedule('0 18 * * *', async () => {
    try {
      const trends = await calculateQualityTrends(1);
      const dataQuality = await processLeadDataQuality();

      await sendCEOEmail({
        subject: 'Daily Quality Summary',
        html: `
          <h2>Daily Quality Summary</h2>
          <h3>Service Quality</h3>
          <p>SLA Violations: ${trends.overall.slaViolations}</p>
          <p>Complaints: ${trends.overall.complaints}</p>
          <p>Avg Sentiment: ${trends.overall.avgSentiment}</p>
          <h3>Data Quality</h3>
          <p>Leads Processed: ${dataQuality.processed || 0}</p>
          <p>Leads Cleaned: ${dataQuality.cleaned || 0}</p>
        `,
      });
    } catch (err) {
      log.error(`Daily summary failed: ${err.message}`);
    }
  });

  // Weekly quality report on Friday at 16:00
  cron.schedule('0 16 * * 5', async () => {
    try {
      const report = await generateWeeklyQualityReport();
      await sendCEOEmail({
        subject: 'Weekly Quality Report',
        html: report.reportHtml,
      });
    } catch (err) {
      log.error(`Weekly report failed: ${err.message}`);
    }
  });

  // Monthly report on 1st at 09:00
  cron.schedule('0 9 1 * *', async () => {
    try {
      await generateMonthlyQualityReport();
    } catch (err) {
      log.error(`Monthly report failed: ${err.message}`);
    }
  });

  log.info('Service Quality scheduled: SLA every 15min, feedback hourly, data quality every 6h, daily/weekly/monthly reports');
}

// --- Exports ---

module.exports = {
  run,
  startSchedule,
  checkSLAs,
  processClientFeedback,
  handleComplaint,
  checkComplaintSLAs,
  calculateQualityTrends,
  generateBenchmarkComparison,
  generateMonthlyQualityReport,
  generateWeeklyQualityReport,
  loadConfigs,
  // New exports
  scoreContentQuality,
  validateEmail,
  validateAndFormatPhone,
  checkDataCompleteness,
  scoreLeadCompleteness,
  cleanupLeadData,
  processLeadDataQuality,
  syncQualityMetricsToDashboard,
};

// Run if called directly
if (require.main === module) {
  run().then(result => {
    log.info(`Service Quality finished: ${JSON.stringify(result)}`);
    process.exit(0);
  }).catch(err => {
    log.error(`Service Quality failed: ${err.message}`);
    process.exit(1);
  });
}
