/**
 * Agent 13 — Follow-Up Agent
 *
 * Intelligent follow-up email sequences with time-of-day awareness, personalization,
 * A/B testing, and automatic escalation.
 *
 * Features:
 * - Time-of-day awareness (8am-6pm CET only)
 * - Follow-up escalation (3 emails → manual review)
 * - Deep personalization using lead data (branche, kanton, company size)
 * - A/B test support (2 variants per email)
 * - Swiss-compliant unsubscribe handling
 *
 * Usage:
 *   node follow-up.js --mode=continuous     # Process all pending follow-ups
 *   node follow-up.js --lead-id=abc123      # Send next follow-up for lead
 *   node follow-up.js --mode=escalate       # Escalate stale leads
 */

const { createLogger } = require('../shared/utils/logger');
const { generateText } = require('../shared/utils/claude-client');
const { getRecords, updateRecord, createRecord } = require('../shared/utils/airtable-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const dashboardSync = require('../shared/utils/dashboard-sync');
const config = require('../shared/utils/config');
const fs = require('fs');
const path = require('path');

const logger = createLogger('follow-up');

// ── Constants ────────────────────────────────────────────────────────────────

const AGENT_NAME = 'follow-up';
const TABLES = {
  LEADS: 'Leads',
  FOLLOW_UPS: 'FollowUps',
};

// Load follow-up sequences
const followUpSequences = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'follow-up-sequences.json'), 'utf-8')
);

// Business hours: 8am - 6pm CET
const BUSINESS_HOURS = {
  start: 8,  // 8am
  end: 18,   // 6pm
};

// Escalation threshold
const ESCALATION_THRESHOLD = 3; // No response after 3 emails → escalate

// ── Time-of-Day Awareness ────────────────────────────────────────────────────

/**
 * Check if current time is within business hours (CET)
 */
function isBusinessHours() {
  const now = new Date();
  const cetTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Zurich' }));
  const hour = cetTime.getHours();

  return hour >= BUSINESS_HOURS.start && hour < BUSINESS_HOURS.end;
}

/**
 * Calculate next business hour send time
 */
function getNextBusinessHourSendTime() {
  const now = new Date();
  const cetTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Zurich' }));
  const hour = cetTime.getHours();

  if (hour < BUSINESS_HOURS.start) {
    // Before 8am - schedule for 8am today
    cetTime.setHours(BUSINESS_HOURS.start, 0, 0, 0);
  } else if (hour >= BUSINESS_HOURS.end) {
    // After 6pm - schedule for 8am tomorrow
    cetTime.setDate(cetTime.getDate() + 1);
    cetTime.setHours(BUSINESS_HOURS.start, 0, 0, 0);
  } else {
    // During business hours - send now
    return new Date();
  }

  return cetTime;
}

// ── Personalization ──────────────────────────────────────────────────────────

/**
 * Generate personalized email using Claude
 */
async function generatePersonalizedEmail(lead, template, variant = 'A') {
  const language = followUpSequences.kantonLanguageMap[lead.Canton?.toUpperCase()] || 'de';
  const industryKey = detectIndustryKey(lead.Industry);
  const subjectOptions = followUpSequences.industrySubjects[industryKey]?.[language] ||
                          followUpSequences.industrySubjects.default[language];

  const prompt = `Generate a personalized follow-up email for this lead.

Lead Information:
- Company: ${lead.CompanyName}
- Industry: ${lead.Industry || 'N/A'}
- Canton: ${lead.Canton || 'N/A'}
- Language: ${language.toUpperCase()}
- Qualification Score: ${lead.QualificationScore || 'N/A'}
- Notes: ${lead.Notes || 'N/A'}
- Website: ${lead.Website || 'None'}

Email Template: ${template}
Variant: ${variant} (A = professional, B = friendly/casual)
Subject Options: ${JSON.stringify(subjectOptions)}

Requirements:
- Write in ${language === 'de' ? 'Swiss German (formal, "Sie")' : language === 'fr' ? 'French (formal, "vous")' : 'Italian (formal, "Lei")'}
- Reference their industry challenges specifically
- Keep it concise (3-4 short paragraphs max)
- Include clear CTA: Book a call OR request Fitness Check
- ${variant === 'B' ? 'Use slightly more casual, friendly tone' : 'Use professional, value-focused tone'}
- End with unsubscribe text: ${followUpSequences.compliance.unsubscribeText[language]}

Return JSON:
{
  "subject": "email subject line",
  "body": "email body as HTML",
  "cta": "primary call-to-action text"
}`;

  try {
    const result = await generateText(prompt, {
      model: config.models.fast,
      maxTokens: 1000,
      temperature: variant === 'B' ? 0.8 : 0.7,
    });

    // Parse JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Failed to parse email JSON from Claude response');
  } catch (error) {
    logger.error(`Email generation failed for ${lead.CompanyName}: ${error.message}`);

    // Fallback to generic template
    return {
      subject: subjectOptions[0],
      body: `<p>Guten Tag,</p><p>ich wollte mich kurz bei Ihnen melden bezüglich Ihrer digitalen Präsenz.</p><p>Hätten Sie Interesse an einem kurzen Austausch?</p><p>Freundliche Grüsse,<br>Werkpilot Team</p>`,
      cta: 'Termin buchen',
    };
  }
}

/**
 * Detect industry key for subject line selection
 */
function detectIndustryKey(industry) {
  if (!industry) return 'default';

  const industryLower = industry.toLowerCase();
  if (industryLower.includes('gastro') || industryLower.includes('hotel')) return 'gastro';
  if (industryLower.includes('handwerk') || industryLower.includes('craft')) return 'handwerk';
  if (industryLower.includes('retail') || industryLower.includes('einzelhandel')) return 'retail';
  if (industryLower.includes('health') || industryLower.includes('gesundheit')) return 'health';
  if (industryLower.includes('consulting') || industryLower.includes('beratung')) return 'consulting';

  return 'default';
}

// ── A/B Testing ──────────────────────────────────────────────────────────────

/**
 * Select A/B test variant (50/50 split)
 */
function selectVariant(leadId) {
  // Use lead ID hash for consistent variant assignment
  const hash = leadId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return hash % 2 === 0 ? 'A' : 'B';
}

// ── Follow-Up Logic ──────────────────────────────────────────────────────────

/**
 * Send follow-up email for a lead
 */
async function sendFollowUp(lead) {
  logger.info(`Preparing follow-up for: ${lead.CompanyName} (${lead.id})`);

  const startTime = Date.now();

  try {
    // Check if within business hours
    if (!isBusinessHours()) {
      const nextSendTime = getNextBusinessHourSendTime();
      logger.info(`Outside business hours. Scheduling for ${nextSendTime.toISOString()}`);

      await createRecord(TABLES.FOLLOW_UPS, {
        LeadId: lead.id,
        ScheduledFor: nextSendTime.toISOString(),
        Status: 'Scheduled',
        Reason: 'Outside business hours (8am-6pm CET)',
      });

      return {
        success: true,
        scheduled: true,
        scheduledFor: nextSendTime.toISOString(),
      };
    }

    // Determine follow-up step
    const followUpCount = lead.FollowUpCount || 0;
    const sequenceType = lead.ReferralSource ? 'warm_referral' : 'standard';
    const sequence = followUpSequences.sequences[sequenceType];

    if (followUpCount >= sequence.steps.length) {
      logger.info(`${lead.CompanyName} has completed all follow-ups. Escalating.`);
      return await escalateLead(lead, 'Sequence completed');
    }

    const step = sequence.steps[followUpCount];

    // Check if should escalate (3+ emails with no response)
    if (followUpCount >= ESCALATION_THRESHOLD && !lead.Responded) {
      logger.info(`${lead.CompanyName} has ${followUpCount} follow-ups with no response. Escalating.`);
      return await escalateLead(lead, 'No response after 3 emails');
    }

    // Select A/B variant
    const variant = selectVariant(lead.id);

    // Generate personalized email
    const email = await generatePersonalizedEmail(lead, step.template, variant);

    // Send email
    await sendEmail({
      to: lead.Email,
      subject: email.subject,
      html: email.body,
      from: 'info@werkpilot.ch',
    });

    // Update lead
    await updateRecord(TABLES.LEADS, lead.id, {
      FollowUpCount: followUpCount + 1,
      LastFollowUp: new Date().toISOString(),
      FollowUpVariant: variant,
    });

    // Log follow-up
    await createRecord(TABLES.FOLLOW_UPS, {
      LeadId: lead.id,
      Step: step.step,
      StepName: step.name,
      Subject: email.subject,
      Variant: variant,
      SentAt: new Date().toISOString(),
      Status: 'Sent',
    });

    // Sync to dashboard
    await dashboardSync.syncLeadUpdate(lead.id, {
      followUpCount: followUpCount + 1,
      lastFollowUp: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    logger.info(`Follow-up sent to ${lead.CompanyName}: Step ${step.step} (Variant ${variant}) - ${duration}ms`);

    // Track execution
    await dashboardSync.logAgentExecution(
      AGENT_NAME,
      new Date(startTime),
      new Date(),
      'success',
      null,
      null,
      config.models.fast
    );

    return {
      success: true,
      leadId: lead.id,
      companyName: lead.CompanyName,
      step: step.step,
      variant,
      duration,
    };
  } catch (error) {
    logger.error(`Failed to send follow-up to ${lead.CompanyName}: ${error.message}`);

    await dashboardSync.logAgentExecution(
      AGENT_NAME,
      new Date(startTime),
      new Date(),
      'error',
      error.message,
      null,
      config.models.fast
    );

    return {
      success: false,
      leadId: lead.id,
      companyName: lead.CompanyName,
      error: error.message,
    };
  }
}

// ── Escalation ───────────────────────────────────────────────────────────────

/**
 * Escalate lead to manual review
 */
async function escalateLead(lead, reason) {
  logger.info(`Escalating lead: ${lead.CompanyName} - Reason: ${reason}`);

  try {
    // Update lead status
    await updateRecord(TABLES.LEADS, lead.id, {
      Status: 'Manual Review Required',
      EscalatedAt: new Date().toISOString(),
      EscalationReason: reason,
    });

    // Notify CEO
    await sendCEOEmail({
      subject: `Lead Escalation: ${lead.CompanyName}`,
      html: `
        <h2>Lead Requires Manual Review</h2>
        <p><strong>Company:</strong> ${lead.CompanyName}</p>
        <p><strong>Industry:</strong> ${lead.Industry || 'N/A'}</p>
        <p><strong>Qualification Score:</strong> ${lead.QualificationScore || 'N/A'}/100</p>
        <p><strong>Follow-ups Sent:</strong> ${lead.FollowUpCount || 0}</p>
        <p><strong>Escalation Reason:</strong> ${reason}</p>
        <p><strong>Email:</strong> ${lead.Email}</p>
        <p><strong>Phone:</strong> ${lead.Phone || 'N/A'}</p>
        <p><strong>Notes:</strong> ${lead.Notes || 'None'}</p>
        <hr>
        <p>Please review and take manual action.</p>
      `,
    });

    // Send dashboard notification
    await dashboardSync.sendNotification(
      'Lead Escalation',
      `${lead.CompanyName} requires manual review: ${reason}`,
      'warning',
      `/leads/${lead.id}`
    );

    logger.info(`Lead escalated: ${lead.CompanyName}`);

    return {
      success: true,
      escalated: true,
      leadId: lead.id,
      reason,
    };
  } catch (error) {
    logger.error(`Failed to escalate lead ${lead.CompanyName}: ${error.message}`);
    return {
      success: false,
      escalated: false,
      error: error.message,
    };
  }
}

// ── Continuous Mode ──────────────────────────────────────────────────────────

/**
 * Process all pending follow-ups
 */
async function runContinuous() {
  logger.info('Starting continuous follow-up processing...');

  try {
    await dashboardSync.syncAgentStatus(AGENT_NAME, 'active');

    // Get leads needing follow-up
    const leads = await getRecords(
      TABLES.LEADS,
      "AND({Status} = 'Qualified', OR({FollowUpCount} = 0, DATETIME_DIFF(NOW(), {LastFollowUp}, 'days') >= 3))"
    );

    logger.info(`Found ${leads.length} leads needing follow-up`);

    if (leads.length === 0) {
      logger.info('No leads to follow up. Exiting.');
      await dashboardSync.syncAgentStatus(AGENT_NAME, 'idle');
      return;
    }

    const results = [];

    for (const lead of leads) {
      const result = await sendFollowUp(lead);
      results.push(result);

      // Rate limiting: wait 5 seconds between emails
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const sent = results.filter(r => r.success && !r.scheduled && !r.escalated).length;
    const scheduled = results.filter(r => r.scheduled).length;
    const escalated = results.filter(r => r.escalated).length;
    const failed = results.filter(r => !r.success).length;

    logger.info(`Follow-up complete: ${sent} sent, ${scheduled} scheduled, ${escalated} escalated, ${failed} failed`);

    await dashboardSync.sendNotification(
      'Follow-Up Round Complete',
      `Sent ${sent} emails, scheduled ${scheduled}, escalated ${escalated}. ${failed} failed.`,
      'success'
    );

    await dashboardSync.syncAgentStatus(AGENT_NAME, 'idle', 100, sent, failed);
  } catch (error) {
    logger.error(`Continuous mode error: ${error.message}`);
    await dashboardSync.syncAgentStatus(AGENT_NAME, 'error');
    await dashboardSync.sendNotification('Follow-Up Agent Error', error.message, 'error');
  }
}

/**
 * Escalate all stale leads (no response after threshold)
 */
async function runEscalation() {
  logger.info('Checking for leads to escalate...');

  try {
    const leads = await getRecords(
      TABLES.LEADS,
      `AND({FollowUpCount} >= ${ESCALATION_THRESHOLD}, {Responded} = FALSE(), {Status} != 'Manual Review Required')`
    );

    logger.info(`Found ${leads.length} leads for escalation`);

    for (const lead of leads) {
      await escalateLead(lead, 'No response after 3+ follow-ups');
    }

    logger.info(`Escalated ${leads.length} leads`);
  } catch (error) {
    logger.error(`Escalation error: ${error.message}`);
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1];
  const leadId = args.find(arg => arg.startsWith('--lead-id='))?.split('=')[1];

  if (leadId) {
    // Single lead follow-up
    const leads = await getRecords(TABLES.LEADS, `{AirtableId} = "${leadId}"`);
    if (leads.length === 0) {
      logger.error(`Lead not found: ${leadId}`);
      process.exit(1);
    }
    const result = await sendFollowUp(leads[0]);
    console.log(JSON.stringify(result, null, 2));
  } else if (mode === 'continuous') {
    await runContinuous();
  } else if (mode === 'escalate') {
    await runEscalation();
  } else {
    console.log('Usage:');
    console.log('  node follow-up.js --mode=continuous');
    console.log('  node follow-up.js --lead-id=abc123');
    console.log('  node follow-up.js --mode=escalate');
    process.exit(1);
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  sendFollowUp,
  escalateLead,
  runContinuous,
  runEscalation,
  isBusinessHours,
  generatePersonalizedEmail,
};

// Start if executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
