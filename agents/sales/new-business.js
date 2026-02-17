/**
 * Agent 05 — New Business Agent
 *
 * Manages cold outreach to new leads via personalized email sequences.
 * Reads leads from Airtable CRM, generates Claude-powered emails,
 * supports multi-language (DE/FR/IT), handles follow-up sequences,
 * and ensures Swiss anti-spam compliance.
 *
 * Schedule: Runs daily at 09:00 for sequence processing, hourly for follow-ups.
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('new-business');

// ── Load Configuration ───────────────────────────────────────────────────────

const sequenceConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'follow-up-sequences.json'), 'utf-8')
);

const TEMPLATES = {};
const templateDir = path.join(__dirname, 'templates');
['initial', 'followup-1', 'followup-2', 'followup-3', 'breakup'].forEach(name => {
  const filePath = path.join(templateDir, `${name}.html`);
  if (fs.existsSync(filePath)) {
    TEMPLATES[name] = fs.readFileSync(filePath, 'utf-8');
  }
});

// ── Constants ────────────────────────────────────────────────────────────────

const TABLES = {
  LEADS: 'Leads',
  SEQUENCES: 'EmailSequences',
  SENT_EMAILS: 'SentEmails',
  UNSUBSCRIBES: 'Unsubscribes',
};

const RATE_LIMITS = sequenceConfig.rateLimits;
const KANTON_LANGUAGE_MAP = sequenceConfig.kantonLanguageMap;
const INDUSTRY_SUBJECTS = sequenceConfig.industrySubjects;

let dailySendCount = 0;
let hourlySendCount = 0;
let lastHourReset = Date.now();

// ── Rate Limiting ────────────────────────────────────────────────────────────

function checkRateLimit() {
  // Reset hourly counter
  if (Date.now() - lastHourReset > 60 * 60 * 1000) {
    hourlySendCount = 0;
    lastHourReset = Date.now();
  }

  if (dailySendCount >= RATE_LIMITS.maxPerDay) {
    logger.warn(`Daily send limit reached (${RATE_LIMITS.maxPerDay})`);
    return false;
  }
  if (hourlySendCount >= RATE_LIMITS.maxPerHour) {
    logger.warn(`Hourly send limit reached (${RATE_LIMITS.maxPerHour})`);
    return false;
  }
  return true;
}

function recordSend() {
  dailySendCount++;
  hourlySendCount++;
}

// ── Language Detection ───────────────────────────────────────────────────────

function getLanguageForKanton(kanton) {
  if (!kanton) return 'de';
  const normalized = kanton.toUpperCase().trim();
  return KANTON_LANGUAGE_MAP[normalized] || KANTON_LANGUAGE_MAP.default;
}

function getLanguageName(code) {
  const names = { de: 'German', fr: 'French', it: 'Italian', en: 'English' };
  return names[code] || 'German';
}

// ── Subject Line Selection ───────────────────────────────────────────────────

function selectSubjectLine(industry, language) {
  const subjects = INDUSTRY_SUBJECTS[industry] || INDUSTRY_SUBJECTS.default;
  const langSubjects = subjects[language] || subjects.de || subjects.default;
  if (!langSubjects || langSubjects.length === 0) {
    const fallback = INDUSTRY_SUBJECTS.default[language] || INDUSTRY_SUBJECTS.default.de;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return langSubjects[Math.floor(Math.random() * langSubjects.length)];
}

// ── Anti-Spam Compliance ─────────────────────────────────────────────────────

function getUnsubscribeFooter(language, leadEmail) {
  const unsubUrl = `${config.website.url}/unsubscribe?email=${encodeURIComponent(leadEmail)}`;
  const text = sequenceConfig.compliance.unsubscribeText[language]
    || sequenceConfig.compliance.unsubscribeText.de;
  return text.replace('{unsubscribe_url}', unsubUrl);
}

async function isUnsubscribed(email) {
  try {
    const records = await getRecords(
      TABLES.UNSUBSCRIBES,
      `{Email} = "${email}"`
    );
    return records.length > 0;
  } catch (error) {
    logger.error(`Error checking unsubscribe status for ${email}: ${error.message}`);
    return false; // Err on side of not sending if check fails
  }
}

// ── Email Generation ─────────────────────────────────────────────────────────

/**
 * Generate a personalized cold email via Claude.
 */
async function generateColdEmail(lead, step) {
  const language = getLanguageForKanton(lead.Kanton);
  const langName = getLanguageName(language);

  const stepDescriptions = {
    1: 'Initial cold outreach. Reference their specific business and a concrete problem you can solve. Offer a free Fitness Check of their website.',
    2: 'First follow-up (3 days after initial). Share an industry-specific insight or tip. Keep it short and valuable.',
    3: 'Second follow-up (7 days). Include social proof - a case study or testimonial from a similar business.',
    4: 'Third follow-up (14 days). Direct value proposition with specific ROI numbers or competitive advantage.',
    5: 'Breakup email (21 days). Friendly final email. Respect their time, leave the door open for future.',
  };

  const prompt = `You are a sales representative at Werkpilot, a Swiss digital agency that builds modern websites,
web applications, and digital solutions for Swiss SMEs (KMU).

Write a ${stepDescriptions[step]}

Lead details:
- Company: ${lead.CompanyName}
- Contact: ${lead.ContactName || 'Geschaeftsleitung'}
- Industry: ${lead.Industry || 'KMU'}
- Website: ${lead.Website || 'Not available'}
- Location: ${lead.City || ''}, Kanton ${lead.Kanton || 'unknown'}
- Business description: ${lead.BusinessDescription || 'Swiss SME'}
- Notes from research: ${lead.ResearchNotes || 'None'}

Requirements:
- Write in ${langName} (Swiss business style)
- Keep the email concise (max 150 words for body)
- Be personal and specific - reference their actual business
- No generic marketing speak
- Professional but approachable tone
- Step ${step} of 5 in the sequence

Werkpilot services:
- Modern responsive websites (from CHF 2'900)
- Web applications & portals
- SEO & performance optimization
- Free "Website Fitness Check" (our lead magnet)

Return JSON: {
  "subject": "email subject line",
  "body": "email body in HTML format",
  "preheader": "short preview text"
}`;

  try {
    const result = await generateJSON(prompt, {
      model: config.models.standard,
      maxTokens: 1500,
    });
    return result;
  } catch (error) {
    logger.error(`Failed to generate email for ${lead.CompanyName} step ${step}: ${error.message}`);
    return null;
  }
}

/**
 * Wrap email content in branded template with compliance footer.
 */
function wrapInTemplate(emailContent, lead, stepName) {
  const language = getLanguageForKanton(lead.Kanton);
  const unsubscribeFooter = getUnsubscribeFooter(language, lead.Email);

  const template = TEMPLATES[stepName];
  if (template) {
    return template
      .replace('{{subject}}', emailContent.subject || '')
      .replace('{{preheader}}', emailContent.preheader || '')
      .replace('{{body}}', emailContent.body || '')
      .replace('{{company_name}}', lead.CompanyName || '')
      .replace('{{contact_name}}', lead.ContactName || '')
      .replace('{{unsubscribe_footer}}', unsubscribeFooter);
  }

  // Fallback: inline template
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="padding: 30px;">
        ${emailContent.body}
      </div>
      <div style="padding: 20px; border-top: 1px solid #eee; font-size: 11px; color: #999;">
        <p>Werkpilot GmbH | Digitale Loesungen fuer Schweizer KMU</p>
        <p>${unsubscribeFooter}</p>
      </div>
    </body>
    </html>
  `;
}

// ── Sequence Management ──────────────────────────────────────────────────────

/**
 * Get leads ready for initial outreach.
 */
async function getNewLeads() {
  try {
    const leads = await getRecords(
      TABLES.LEADS,
      'OR({Status} = "New Lead", {Status} = "Researched")'
    );
    logger.info(`Found ${leads.length} leads ready for outreach`);
    return leads;
  } catch (error) {
    logger.error(`Failed to fetch new leads: ${error.message}`);
    return [];
  }
}

/**
 * Get active email sequences that need follow-ups.
 */
async function getActiveSequences() {
  try {
    const sequences = await getRecords(
      TABLES.SEQUENCES,
      'AND({Status} = "Active", {NextStepDate} <= TODAY())'
    );
    logger.info(`Found ${sequences.length} sequences needing follow-up`);
    return sequences;
  } catch (error) {
    logger.error(`Failed to fetch active sequences: ${error.message}`);
    return [];
  }
}

/**
 * Process initial outreach to new leads.
 */
async function processNewLeads() {
  logger.info('Processing new leads for initial outreach...');
  const leads = await getNewLeads();
  let sentCount = 0;

  for (const lead of leads) {
    if (!checkRateLimit()) {
      logger.warn('Rate limit reached, stopping new lead processing');
      break;
    }

    try {
      // Skip if no email
      if (!lead.Email) {
        logger.warn(`Skipping ${lead.CompanyName}: no email address`);
        continue;
      }

      // Check unsubscribe list
      if (await isUnsubscribed(lead.Email)) {
        logger.info(`Skipping ${lead.CompanyName}: unsubscribed`);
        await updateRecord(TABLES.LEADS, lead.id, { Status: 'Unsubscribed' });
        continue;
      }

      // Check if sequence already exists
      const existingSequence = await getRecords(
        TABLES.SEQUENCES,
        `{LeadId} = "${lead.id}"`
      );
      if (existingSequence.length > 0) {
        logger.info(`Skipping ${lead.CompanyName}: sequence already exists`);
        continue;
      }

      // Generate personalized email
      const emailContent = await generateColdEmail(lead, 1);
      if (!emailContent) continue;

      // Get step name for template
      const stepConfig = sequenceConfig.sequences.standard.steps[0];
      const html = wrapInTemplate(emailContent, lead, stepConfig.name);

      // Send email
      await sendEmail({
        to: lead.Email,
        subject: emailContent.subject || selectSubjectLine(lead.Industry, getLanguageForKanton(lead.Kanton)),
        html,
        from: `Werkpilot <${config.email.user}>`,
      });

      recordSend();

      // Create sequence record
      const nextStepDate = new Date();
      nextStepDate.setDate(nextStepDate.getDate() + sequenceConfig.sequences.standard.steps[1].delayDays);

      await createRecord(TABLES.SEQUENCES, {
        LeadId: lead.id,
        LeadEmail: lead.Email,
        CompanyName: lead.CompanyName,
        CurrentStep: 1,
        Status: 'Active',
        SequenceType: 'standard',
        Language: getLanguageForKanton(lead.Kanton),
        NextStepDate: nextStepDate.toISOString().split('T')[0],
        StartedAt: new Date().toISOString(),
      });

      // Log sent email
      await createRecord(TABLES.SENT_EMAILS, {
        LeadId: lead.id,
        Email: lead.Email,
        Step: 1,
        Subject: emailContent.subject,
        SentAt: new Date().toISOString(),
        Status: 'Sent',
      });

      // Update lead status
      await updateRecord(TABLES.LEADS, lead.id, {
        Status: 'Contacted',
        FirstContactDate: new Date().toISOString(),
      });

      sentCount++;
      logger.info(`Initial email sent to ${lead.CompanyName} (${lead.Email})`);

      // Cooldown between sends
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.cooldownMinutes * 60 * 1000));

    } catch (error) {
      logger.error(`Failed to process lead ${lead.CompanyName}: ${error.message}`);
    }
  }

  logger.info(`Processed ${sentCount} new leads`);
  return sentCount;
}

/**
 * Process follow-up emails for active sequences.
 */
async function processFollowUps() {
  logger.info('Processing follow-up sequences...');
  const sequences = await getActiveSequences();
  let sentCount = 0;

  for (const seq of sequences) {
    if (!checkRateLimit()) {
      logger.warn('Rate limit reached, stopping follow-up processing');
      break;
    }

    try {
      const nextStep = seq.CurrentStep + 1;
      const sequenceType = seq.SequenceType || 'standard';
      const seqDef = sequenceConfig.sequences[sequenceType];

      if (!seqDef || nextStep > seqDef.steps.length) {
        // Sequence complete
        await updateRecord(TABLES.SEQUENCES, seq.id, {
          Status: 'Completed',
          CompletedAt: new Date().toISOString(),
        });
        logger.info(`Sequence completed for ${seq.CompanyName}`);
        continue;
      }

      // Check unsubscribe
      if (await isUnsubscribed(seq.LeadEmail)) {
        await updateRecord(TABLES.SEQUENCES, seq.id, { Status: 'Unsubscribed' });
        logger.info(`Sequence stopped for ${seq.CompanyName}: unsubscribed`);
        continue;
      }

      // Get lead details for personalization
      const leads = await getRecords(TABLES.LEADS, `RECORD_ID() = "${seq.LeadId}"`);
      const lead = leads.length > 0 ? leads[0] : { CompanyName: seq.CompanyName, Email: seq.LeadEmail };

      // Generate follow-up email
      const emailContent = await generateColdEmail(lead, nextStep);
      if (!emailContent) continue;

      const stepConfig = seqDef.steps[nextStep - 1];
      const html = wrapInTemplate(emailContent, lead, stepConfig.name);

      // Send
      await sendEmail({
        to: seq.LeadEmail,
        subject: emailContent.subject,
        html,
        from: `Werkpilot <${config.email.user}>`,
      });

      recordSend();

      // Update sequence
      const hasNextStep = nextStep < seqDef.steps.length;
      const updateFields = {
        CurrentStep: nextStep,
        LastSentAt: new Date().toISOString(),
      };

      if (hasNextStep) {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + seqDef.steps[nextStep].delayDays);
        updateFields.NextStepDate = nextDate.toISOString().split('T')[0];
      } else {
        updateFields.Status = 'Completed';
        updateFields.CompletedAt = new Date().toISOString();
      }

      await updateRecord(TABLES.SEQUENCES, seq.id, updateFields);

      // Log sent email
      await createRecord(TABLES.SENT_EMAILS, {
        LeadId: seq.LeadId,
        Email: seq.LeadEmail,
        Step: nextStep,
        Subject: emailContent.subject,
        SentAt: new Date().toISOString(),
        Status: 'Sent',
      });

      sentCount++;
      logger.info(`Follow-up ${nextStep} sent to ${seq.CompanyName}`);

      // Cooldown
      await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.cooldownMinutes * 60 * 1000));

    } catch (error) {
      logger.error(`Failed follow-up for ${seq.CompanyName}: ${error.message}`);
    }
  }

  logger.info(`Processed ${sentCount} follow-ups`);
  return sentCount;
}

// ── Daily Summary ────────────────────────────────────────────────────────────

async function sendDailySummary(newLeadsSent, followUpsSent) {
  const activeSequences = await getRecords(TABLES.SEQUENCES, '{Status} = "Active"');
  const completedToday = await getRecords(
    TABLES.SEQUENCES,
    `AND({Status} = "Completed", IS_AFTER({CompletedAt}, DATEADD(TODAY(), -1, 'days')))`
  );

  const html = `
    <h2>New Business Agent - Daily Summary</h2>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 12px; background: #f0f8ff; border-radius: 4px;">
          <strong>Initial Emails Sent:</strong> ${newLeadsSent}
        </td>
        <td style="padding: 12px; background: #f0fff0; border-radius: 4px;">
          <strong>Follow-ups Sent:</strong> ${followUpsSent}
        </td>
      </tr>
      <tr>
        <td style="padding: 12px; background: #fff8f0; border-radius: 4px;">
          <strong>Active Sequences:</strong> ${activeSequences.length}
        </td>
        <td style="padding: 12px; background: #f8f0ff; border-radius: 4px;">
          <strong>Completed Today:</strong> ${completedToday.length}
        </td>
      </tr>
    </table>
    <p><strong>Daily Send Count:</strong> ${dailySendCount}/${RATE_LIMITS.maxPerDay}</p>
  `;

  try {
    await sendCEOEmail({
      subject: `New Business: ${newLeadsSent + followUpsSent} emails sent today`,
      html,
    });
  } catch (error) {
    logger.error(`Failed to send daily summary: ${error.message}`);
  }
}

// ── Main Run ─────────────────────────────────────────────────────────────────

async function runDailyCycle() {
  logger.info('=== New Business Agent Daily Cycle Started ===');
  const startTime = Date.now();

  // Reset daily counter
  dailySendCount = 0;

  try {
    const newLeadsSent = await processNewLeads();
    const followUpsSent = await processFollowUps();
    await sendDailySummary(newLeadsSent, followUpsSent);
  } catch (error) {
    logger.error(`Daily cycle failed: ${error.message}`, { stack: error.stack });
    await sendCEOEmail({
      subject: 'New Business Agent: Error in Daily Cycle',
      html: `<p>The New Business agent encountered an error:</p><pre>${error.message}</pre>`,
    });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Daily cycle completed in ${duration}s ===`);
}

async function runFollowUpCheck() {
  logger.info('Running follow-up check...');
  try {
    await processFollowUps();
  } catch (error) {
    logger.error(`Follow-up check failed: ${error.message}`);
  }
}

// ── Cron Scheduling ──────────────────────────────────────────────────────────

// Main daily run at 09:00
cron.schedule('0 9 * * *', () => {
  runDailyCycle().catch(err => logger.error(`Cron daily error: ${err.message}`));
});

// Follow-up check every 3 hours during business hours (09-18)
cron.schedule('0 9,12,15,18 * * 1-5', () => {
  runFollowUpCheck().catch(err => logger.error(`Cron follow-up error: ${err.message}`));
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runDailyCycle,
  runFollowUpCheck,
  processNewLeads,
  processFollowUps,
  generateColdEmail,
  getLanguageForKanton,
  selectSubjectLine,
};

// Run immediately if executed directly
if (require.main === module) {
  runDailyCycle()
    .then(() => logger.info('Manual run completed'))
    .catch(err => logger.error(`Manual run failed: ${err.message}`));
}
