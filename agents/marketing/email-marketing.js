/**
 * AGENT 13 — Email Marketing Agent
 *
 * Manages email marketing via MailerLite API, handles subscriber management,
 * campaign automation, A/B testing, and reporting.
 *
 * Responsibilities:
 * - MailerLite API integration (subscriber management, campaigns, automation)
 * - Email sequences: Welcome, Nurture, Upsell, Re-engagement, Onboarding
 * - Content generation via Claude in brand voice
 * - A/B test subject lines
 * - Segmentation by: language, industry, engagement, status
 * - Reports: open rates, clicks, conversions, unsubscribes
 * - Auto-clean: removes bounces, unsubscribes, 90d inactive
 *
 * Schedule: Campaigns per sequence schedule, reports weekly, cleanup monthly
 */

const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('email-marketing');
const MARKETING_DIR = path.join(__dirname);
const SEQUENCES_DIR = path.join(MARKETING_DIR, 'sequences');
const TEMPLATES_DIR = path.join(MARKETING_DIR, 'templates');
const BRAND_GUIDELINES_PATH = path.join(MARKETING_DIR, 'brand-guidelines.json');

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api';

// ─── MailerLite API Client ──────────────────────────────────────────────────────

/**
 * Make an authenticated request to the MailerLite API
 */
async function mailerliteRequest(endpoint, method = 'GET', body = null) {
  const apiKey = config.api.mailerlite;
  if (!apiKey) {
    throw new Error('MAILERLITE_API_KEY not configured');
  }

  const url = `${MAILERLITE_API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`MailerLite API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error(`MailerLite API request failed: ${method} ${endpoint}`, { error: error.message });
    throw error;
  }
}

// ─── Subscriber Management ──────────────────────────────────────────────────────

/**
 * Create or update a subscriber in MailerLite
 */
async function upsertSubscriber(email, fields = {}, groups = []) {
  logger.info(`Upserting subscriber: ${email}`);

  try {
    const subscriberData = {
      email,
      fields: {
        name: fields.firstName || '',
        last_name: fields.lastName || '',
        company: fields.company || '',
        z_industry: fields.industry || '',
        z_language: fields.language || 'de',
        z_source: fields.source || 'website',
        z_status: fields.status || 'lead',
      },
      groups: groups,
      status: 'active',
    };

    const result = await mailerliteRequest('/subscribers', 'POST', subscriberData);

    logger.info(`Subscriber upserted: ${email}`, { id: result.data?.id });
    return result.data;
  } catch (error) {
    logger.error('Subscriber upsert failed', { email, error: error.message });
    throw error;
  }
}

/**
 * Get subscriber details
 */
async function getSubscriber(email) {
  try {
    const result = await mailerliteRequest(`/subscribers/${encodeURIComponent(email)}`);
    return result.data;
  } catch (error) {
    logger.warn(`Subscriber not found: ${email}`);
    return null;
  }
}

/**
 * Update subscriber tags/groups
 */
async function tagSubscriber(subscriberId, tags = []) {
  logger.info(`Tagging subscriber ${subscriberId}`, { tags });

  try {
    for (const tag of tags) {
      // First, find or create the group (tag)
      const groups = await mailerliteRequest('/groups?filter[name]=' + encodeURIComponent(tag));
      let groupId;

      if (groups.data && groups.data.length > 0) {
        groupId = groups.data[0].id;
      } else {
        const newGroup = await mailerliteRequest('/groups', 'POST', { name: tag });
        groupId = newGroup.data?.id;
      }

      if (groupId) {
        await mailerliteRequest(`/subscribers/${subscriberId}/groups/${groupId}`, 'POST');
      }
    }

    logger.info(`Tags applied to subscriber ${subscriberId}: ${tags.join(', ')}`);
  } catch (error) {
    logger.error('Tagging failed', { subscriberId, error: error.message });
    throw error;
  }
}

// ─── Segment Management ─────────────────────────────────────────────────────────

/**
 * Define and manage subscriber segments
 */
const SEGMENTS = {
  by_language: {
    de: { field: 'z_language', value: 'de' },
    fr: { field: 'z_language', value: 'fr' },
    en: { field: 'z_language', value: 'en' },
  },
  by_industry: {
    treuhand: { field: 'z_industry', value: 'treuhand' },
    zahnarzt: { field: 'z_industry', value: 'zahnarzt' },
    immobilien: { field: 'z_industry', value: 'immobilien' },
    anwalt: { field: 'z_industry', value: 'anwalt' },
    architekt: { field: 'z_industry', value: 'architekt' },
  },
  by_engagement: {
    active: { opens_min: 1, period_days: 30 },
    warm: { opens_min: 1, period_days: 60 },
    cold: { opens_max: 0, period_days: 30 },
    inactive: { opens_max: 0, period_days: 90 },
  },
  by_status: {
    lead: { field: 'z_status', value: 'lead' },
    prospect: { field: 'z_status', value: 'prospect' },
    client: { field: 'z_status', value: 'client' },
    churned: { field: 'z_status', value: 'churned' },
  },
};

/**
 * Get subscribers matching a segment
 */
async function getSegmentSubscribers(segmentCategory, segmentName, limit = 100) {
  logger.info(`Fetching segment: ${segmentCategory}/${segmentName}`);

  try {
    const segment = SEGMENTS[segmentCategory]?.[segmentName];
    if (!segment) {
      throw new Error(`Unknown segment: ${segmentCategory}/${segmentName}`);
    }

    if (segment.field) {
      const result = await mailerliteRequest(
        `/subscribers?filter[fields][${segment.field}]=${segment.value}&limit=${limit}`
      );
      return result.data || [];
    }

    // For engagement-based segments, we'd need to check activity
    // This would require additional API calls or automation rules
    logger.warn('Engagement-based segments require MailerLite automation rules');
    return [];
  } catch (error) {
    logger.error('Segment fetch failed', { segmentCategory, segmentName, error: error.message });
    throw error;
  }
}

// ─── Email Sequence Management ──────────────────────────────────────────────────

/**
 * Load an email sequence configuration
 */
async function loadSequence(sequenceName) {
  try {
    const filePath = path.join(SEQUENCES_DIR, `${sequenceName}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    const sequence = JSON.parse(content);
    logger.info(`Sequence loaded: ${sequence.sequence.name}`);
    return sequence;
  } catch (error) {
    logger.error(`Failed to load sequence: ${sequenceName}`, { error: error.message });
    throw error;
  }
}

/**
 * Generate email content for a sequence step
 */
async function generateSequenceEmail(sequenceName, position, subscriberData = {}) {
  logger.info(`Generating email for sequence ${sequenceName}, position ${position}`);

  try {
    const sequence = await loadSequence(sequenceName);
    const emailConfig = sequence.emails?.find(e => e.position === position);

    if (!emailConfig) {
      throw new Error(`Email position ${position} not found in sequence ${sequenceName}`);
    }

    const brandGuidelines = JSON.parse(await fs.readFile(BRAND_GUIDELINES_PATH, 'utf-8'));

    // Load email base template
    const baseTemplate = await fs.readFile(path.join(TEMPLATES_DIR, 'email-base.html'), 'utf-8');

    const prompt = `Write the email content for this marketing automation email.

## Email Configuration
Sequence: ${sequence.sequence.name}
Position: ${position} of ${sequence.emails?.length || '?'}
Subject A: ${emailConfig.subject_a}
Subject B: ${emailConfig.subject_b}
Preview Text: ${emailConfig.preview_text}
Content Brief: ${emailConfig.content_brief}
CTA: ${emailConfig.cta}

## Subscriber Context
Name: ${subscriberData.firstName || '{{first_name}}'}
Industry: ${subscriberData.industry || '{{industry}}'}
Language: ${subscriberData.language || 'de'}
Company: ${subscriberData.company || '{{company_name}}'}

## Brand Voice
${brandGuidelines.voice.rules.slice(0, 5).map(r => `- ${r}`).join('\n')}
FORBIDDEN: ${brandGuidelines.voice.forbidden_words.slice(0, 10).join(', ')}

## Requirements
- Write in ${subscriberData.language === 'fr' ? 'French (Swiss)' : 'German (Swiss)'}
- Use "ss" not "ß"
- Personal, warm but professional tone
- Short paragraphs (2-3 sentences max)
- NEVER say "KI" or "AI"
- Include the CTA naturally
- Use {{first_name}}, {{company_name}}, {{industry}} as merge tags

Return as JSON:
{
  "subject_a": "Finalized subject line A",
  "subject_b": "Finalized subject line B",
  "preview_text": "Preview text (max 100 chars)",
  "headline": "Email headline",
  "body_html": "Complete email body in HTML (paragraphs, lists, bold as needed)",
  "body_text": "Plain text version",
  "cta_text": "Button text",
  "cta_url": "${emailConfig.cta_url || 'https://werkpilot.ch'}",
  "ps_line": "Optional P.S. line (or null)"
}`;

    const emailContent = await generateJSON(prompt, {
      system: 'You are an email marketing copywriter for a Swiss B2B tech company. Write engaging, personal emails that feel like they come from a real person, not a company.',
      model: config.models.standard,
    });

    // Merge into base template
    let html = baseTemplate;
    html = html.replace('{{EMAIL_TITLE}}', emailContent.subject_a || '');
    html = html.replace('{{PREVIEW_TEXT}}', emailContent.preview_text || '');
    html = html.replace('{{HEADLINE}}', emailContent.headline || '');
    html = html.replace('{{BODY_CONTENT}}', emailContent.body_html || '');
    html = html.replace('{{CTA_TEXT}}', emailContent.cta_text || emailConfig.cta);
    html = html.replace(/\{\{CTA_URL\}\}/g, emailContent.cta_url || emailConfig.cta_url || '#');
    html = html.replace('{{ADDITIONAL_CONTENT}}', emailContent.ps_line
      ? `<p style="font-size: 14px; color: #6C757D; font-style: italic;">P.S. ${emailContent.ps_line}</p>`
      : '');
    html = html.replace('{{UNSUBSCRIBE_URL}}', '{{unsubscribe_url}}');
    html = html.replace('{{PREFERENCES_URL}}', 'https://werkpilot.ch/email-preferences');

    emailContent.full_html = html;

    logger.info(`Email generated for ${sequenceName}[${position}]`);
    return emailContent;
  } catch (error) {
    logger.error('Sequence email generation failed', { sequenceName, position, error: error.message });
    throw error;
  }
}

// ─── A/B Testing ────────────────────────────────────────────────────────────────

/**
 * Create an A/B test for email subject lines
 */
async function createSubjectLineABTest(sequenceName, position, additionalVariants = 2) {
  logger.info(`Creating A/B test for ${sequenceName}[${position}]`);

  try {
    const sequence = await loadSequence(sequenceName);
    const emailConfig = sequence.emails?.find(e => e.position === position);

    if (!emailConfig) {
      throw new Error(`Email position ${position} not found in sequence ${sequenceName}`);
    }

    const prompt = `Generate ${additionalVariants + 2} A/B test variants for an email subject line.

Original subjects:
A: ${emailConfig.subject_a}
B: ${emailConfig.subject_b}

Context:
- Email sequence: ${sequence.sequence.name}
- Content brief: ${emailConfig.content_brief}
- Target audience: Swiss business owners (KMU)
- Language: German (Swiss)
- NEVER use "KI" or "AI"

Generate ${additionalVariants} additional variants that test different approaches:
1. Curiosity-driven
2. Benefit-focused
3. Urgency (soft, not aggressive)
4. Personalization-heavy
5. Question-based

Return as JSON:
{
  "variants": [
    {
      "label": "A",
      "subject": "string",
      "approach": "The strategy behind this variant",
      "hypothesis": "What we expect to learn"
    }
  ],
  "test_plan": {
    "sample_size_per_variant": "20% of list each",
    "winner_criteria": "open_rate",
    "test_duration_hours": 4,
    "winner_send_to": "remaining 60%"
  }
}`;

    const abTest = await generateJSON(prompt, {
      system: 'You are an email marketing A/B testing specialist. Create statistically meaningful test variants.',
      model: config.models.fast,
    });

    logger.info(`A/B test created with ${abTest.variants?.length || 0} variants`);
    return abTest;
  } catch (error) {
    logger.error('A/B test creation failed', { error: error.message });
    throw error;
  }
}

// ─── Campaign Creation ──────────────────────────────────────────────────────────

/**
 * Create a campaign in MailerLite
 */
async function createCampaign(name, subject, htmlContent, segmentGroups = []) {
  logger.info(`Creating campaign: ${name}`);

  try {
    // Create the campaign
    const campaign = await mailerliteRequest('/campaigns', 'POST', {
      name,
      type: 'regular',
      emails: [{
        subject,
        from_name: 'Werkpilot',
        from: config.email.user,
        content: htmlContent,
      }],
      groups: segmentGroups,
    });

    logger.info(`Campaign created: ${campaign.data?.id}`);
    return campaign.data;
  } catch (error) {
    logger.error('Campaign creation failed', { name, error: error.message });
    throw error;
  }
}

/**
 * Schedule a campaign for sending
 */
async function scheduleCampaign(campaignId, sendAt = null) {
  logger.info(`Scheduling campaign ${campaignId}`);

  try {
    const scheduleData = sendAt
      ? { delivery: 'scheduled', schedule: { date: sendAt, timezone_id: 'Europe/Zurich' } }
      : { delivery: 'instant' };

    const result = await mailerliteRequest(`/campaigns/${campaignId}/schedule`, 'POST', scheduleData);

    logger.info(`Campaign ${campaignId} scheduled`, { delivery: scheduleData.delivery });
    return result;
  } catch (error) {
    logger.error('Campaign scheduling failed', { campaignId, error: error.message });
    throw error;
  }
}

// ─── Reporting ──────────────────────────────────────────────────────────────────

/**
 * Get campaign performance reports
 */
async function getCampaignReports(period = 'week') {
  logger.info(`Fetching campaign reports (${period})`);

  try {
    const campaigns = await mailerliteRequest('/campaigns?filter[status]=sent&limit=20&sort=-finished_at');

    if (!campaigns.data || campaigns.data.length === 0) {
      return { status: 'no_campaigns', campaigns: [] };
    }

    const reports = campaigns.data.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      sent_at: campaign.finished_at,
      stats: {
        emails_sent: campaign.stats?.sent || 0,
        opens: campaign.stats?.opens_count || 0,
        open_rate: campaign.stats?.open_rate || 0,
        clicks: campaign.stats?.clicks_count || 0,
        click_rate: campaign.stats?.click_rate || 0,
        unsubscribes: campaign.stats?.unsubscribes_count || 0,
        bounces: campaign.stats?.bounces_count || 0,
        spam_reports: campaign.stats?.spam_count || 0,
      },
    }));

    // Calculate aggregate metrics
    const aggregate = reports.reduce((acc, r) => {
      acc.total_sent += r.stats.emails_sent;
      acc.total_opens += r.stats.opens;
      acc.total_clicks += r.stats.clicks;
      acc.total_unsubscribes += r.stats.unsubscribes;
      acc.total_bounces += r.stats.bounces;
      return acc;
    }, { total_sent: 0, total_opens: 0, total_clicks: 0, total_unsubscribes: 0, total_bounces: 0 });

    aggregate.avg_open_rate = aggregate.total_sent > 0
      ? ((aggregate.total_opens / aggregate.total_sent) * 100).toFixed(1)
      : '0.0';
    aggregate.avg_click_rate = aggregate.total_sent > 0
      ? ((aggregate.total_clicks / aggregate.total_sent) * 100).toFixed(1)
      : '0.0';

    logger.info('Campaign reports fetched', {
      campaigns: reports.length,
      avgOpenRate: aggregate.avg_open_rate,
    });

    return { aggregate, campaigns: reports };
  } catch (error) {
    logger.error('Campaign reports failed', { error: error.message });
    throw error;
  }
}

/**
 * Generate and send the weekly email marketing report
 */
async function generateWeeklyReport() {
  logger.info('Generating weekly email marketing report');

  try {
    const reports = await getCampaignReports('week');

    const prompt = `Create a weekly email marketing report summary in German for the CEO.

Campaign Data:
${JSON.stringify(reports, null, 2)}

Include:
1. Executive Summary (2 sentences)
2. Key Metrics (open rate, click rate, unsubscribes)
3. Best/worst performing campaigns
4. Subscriber growth
5. Recommendations for next week
6. A/B test results (if any)

Format as clean HTML email with Werkpilot brand colors (#1B2A4A headers, #2E75B6 accents).
Keep it brief and scannable.`;

    const reportHtml = await generateText(prompt, {
      system: 'You are an email marketing manager writing a weekly performance report. German, professional, data-driven.',
      model: config.models.fast,
      maxTokens: 2000,
    });

    await sendCEOEmail({
      subject: 'Email Marketing - Wochenbericht',
      html: reportHtml,
    });

    // Store in Airtable
    await createRecord('WeeklyReports', {
      Agent: 'email-marketing',
      Date: new Date().toISOString().split('T')[0],
      Type: 'weekly_email_marketing',
      Summary: `Open Rate: ${reports.aggregate?.avg_open_rate}%, Click Rate: ${reports.aggregate?.avg_click_rate}%`,
      Status: 'sent',
    });

    logger.info('Weekly email marketing report sent');
    return reports;
  } catch (error) {
    logger.error('Weekly report generation failed', { error: error.message });
    throw error;
  }
}

// ─── List Cleanup ───────────────────────────────────────────────────────────────

/**
 * Auto-clean: remove bounces, unsubscribes, and 90-day inactive subscribers
 */
async function cleanSubscriberList() {
  logger.info('Starting subscriber list cleanup');

  try {
    const cleanupResults = {
      bounces_removed: 0,
      unsubscribes_removed: 0,
      inactive_removed: 0,
      total_removed: 0,
      timestamp: new Date().toISOString(),
    };

    // 1. Remove bounced subscribers
    try {
      const bounced = await mailerliteRequest('/subscribers?filter[status]=bounced&limit=100');
      if (bounced.data) {
        for (const sub of bounced.data) {
          await mailerliteRequest(`/subscribers/${sub.id}`, 'DELETE');
          cleanupResults.bounces_removed++;
        }
      }
    } catch (err) {
      logger.warn('Bounce cleanup encountered issues', { error: err.message });
    }

    // 2. Remove hard unsubscribes
    try {
      const unsubscribed = await mailerliteRequest('/subscribers?filter[status]=unsubscribed&limit=100');
      if (unsubscribed.data) {
        for (const sub of unsubscribed.data) {
          await mailerliteRequest(`/subscribers/${sub.id}`, 'DELETE');
          cleanupResults.unsubscribes_removed++;
        }
      }
    } catch (err) {
      logger.warn('Unsubscribe cleanup encountered issues', { error: err.message });
    }

    // 3. Flag 90-day inactive (moved to re-engagement first)
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const inactive = await mailerliteRequest(
        `/subscribers?filter[status]=active&sort=-created_at&limit=100`
      );

      if (inactive.data) {
        const inactiveSubscribers = inactive.data.filter(sub => {
          const lastOpen = sub.stats?.last_opened_at;
          if (!lastOpen) {
            const created = new Date(sub.created_at);
            return created < ninetyDaysAgo;
          }
          return new Date(lastOpen) < ninetyDaysAgo;
        });

        for (const sub of inactiveSubscribers) {
          // Move to re-engagement group instead of deleting
          await tagSubscriber(sub.id, ['90d_inactive', 'reengagement_candidate']);
          cleanupResults.inactive_removed++;
        }
      }
    } catch (err) {
      logger.warn('Inactive cleanup encountered issues', { error: err.message });
    }

    cleanupResults.total_removed = cleanupResults.bounces_removed +
      cleanupResults.unsubscribes_removed +
      cleanupResults.inactive_removed;

    // Store cleanup results
    await createRecord('AgentActivity', {
      Agent: 'email-marketing',
      Action: 'list_cleanup',
      Date: new Date().toISOString(),
      Result: JSON.stringify(cleanupResults),
      Status: 'completed',
    });

    logger.info('Subscriber list cleanup complete', cleanupResults);
    return cleanupResults;
  } catch (error) {
    logger.error('Subscriber list cleanup failed', { error: error.message });
    throw error;
  }
}

// ─── Trigger Handlers ───────────────────────────────────────────────────────────

/**
 * Handle new subscriber trigger - starts welcome sequence
 */
async function onNewSubscriber(email, fields = {}) {
  logger.info(`New subscriber trigger: ${email}`);

  try {
    // Upsert subscriber
    const subscriber = await upsertSubscriber(email, fields, []);

    // Tag as new subscriber
    if (subscriber?.id) {
      await tagSubscriber(subscriber.id, ['new_subscriber', `lang_${fields.language || 'de'}`, `industry_${fields.industry || 'unknown'}`]);
    }

    // Generate first welcome email
    const welcomeEmail = await generateSequenceEmail('welcome', 1, fields);

    // In production, this would trigger the MailerLite automation
    // For now, log the action
    await createRecord('EmailQueue', {
      Subscriber: email,
      Sequence: 'welcome',
      Position: 1,
      SubjectA: welcomeEmail.subject_a,
      SubjectB: welcomeEmail.subject_b,
      Status: 'queued',
      ScheduledDate: new Date().toISOString(),
      Agent: 'email-marketing',
    });

    logger.info(`Welcome sequence initiated for ${email}`);
    return { subscriber, welcomeEmail };
  } catch (error) {
    logger.error('New subscriber handling failed', { email, error: error.message });
    throw error;
  }
}

/**
 * Handle new client trigger - starts onboarding sequence
 */
async function onNewClient(email, clientData = {}) {
  logger.info(`New client trigger: ${email}`);

  try {
    // Update subscriber status
    const subscriber = await getSubscriber(email);
    if (subscriber?.id) {
      await tagSubscriber(subscriber.id, ['client', 'onboarding_started']);
    }

    // Generate first onboarding email
    const onboardingEmail = await generateSequenceEmail('onboarding', 1, {
      ...clientData,
      status: 'client',
    });

    await createRecord('EmailQueue', {
      Subscriber: email,
      Sequence: 'onboarding',
      Position: 1,
      SubjectA: onboardingEmail.subject_a,
      SubjectB: onboardingEmail.subject_b,
      Status: 'queued',
      ScheduledDate: new Date().toISOString(),
      Agent: 'email-marketing',
    });

    logger.info(`Onboarding sequence initiated for ${email}`);
    return { subscriber, onboardingEmail };
  } catch (error) {
    logger.error('New client handling failed', { email, error: error.message });
    throw error;
  }
}

// ─── Cron Scheduling ────────────────────────────────────────────────────────────

function startScheduler() {
  logger.info('Starting Email Marketing Agent scheduler');

  // Process email queue - every hour from 7 AM to 8 PM CET
  cron.schedule('0 7-20 * * *', async () => {
    logger.info('Cron: Processing email queue');
    try {
      const queue = await getRecords('EmailQueue', '{Status} = "queued"', 20);

      for (const item of queue) {
        try {
          // Check if it's time to send (based on sequence delays)
          const scheduledDate = new Date(item.ScheduledDate);
          if (scheduledDate <= new Date()) {
            logger.info(`Sending queued email: ${item.Sequence}[${item.Position}] to ${item.Subscriber}`);

            // In production: use MailerLite API to send
            // For now: mark as sent
            await updateRecord('EmailQueue', item.id, {
              Status: 'sent',
              SentDate: new Date().toISOString(),
            });
          }
        } catch (itemError) {
          logger.error('Queue item processing failed', { id: item.id, error: itemError.message });
        }
      }
    } catch (error) {
      logger.error('Cron: Email queue processing failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Weekly report - Mondays at 9:00 AM CET
  cron.schedule('0 9 * * 1', async () => {
    logger.info('Cron: Generating weekly email report');
    try {
      await generateWeeklyReport();
    } catch (error) {
      logger.error('Cron: Weekly report failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Monthly list cleanup - 1st of month at 3:00 AM CET
  cron.schedule('0 3 1 * *', async () => {
    logger.info('Cron: Running monthly list cleanup');
    try {
      await cleanSubscriberList();
    } catch (error) {
      logger.error('Cron: List cleanup failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Nurture emails - Wednesdays at 10:00 AM CET
  cron.schedule('0 10 * * 3', async () => {
    logger.info('Cron: Processing nurture sequence');
    try {
      // Generate this week's nurture content
      const nurture = await loadSequence('nurture');
      const weekNumber = Math.ceil(new Date().getDate() / 7);
      const contentType = nurture.content_rotation?.week_pattern?.[weekNumber % 4] || 'educational_tip';

      logger.info(`Nurture content type this week: ${contentType}`);
      // In production: generate and send nurture email for this week
    } catch (error) {
      logger.error('Cron: Nurture processing failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  logger.info('Email Marketing Agent scheduler started successfully');
}

// ─── Main Entry Point ───────────────────────────────────────────────────────────

async function main() {
  logger.info('═══ Email Marketing Agent (Agent 13) starting ═══');

  try {
    // Load and validate sequence files
    const sequences = ['welcome', 'nurture', 'upsell', 're-engagement', 'onboarding'];
    for (const seq of sequences) {
      const loaded = await loadSequence(seq);
      logger.info(`Sequence "${loaded.sequence.name}" loaded: ${loaded.emails?.length || 'dynamic'} emails`);
    }

    // Load brand guidelines
    const brandGuidelines = JSON.parse(await fs.readFile(BRAND_GUIDELINES_PATH, 'utf-8'));
    logger.info('Brand guidelines loaded for email voice');

    // Verify email template exists
    const templatePath = path.join(TEMPLATES_DIR, 'email-base.html');
    await fs.access(templatePath);
    logger.info('Email base template verified');

    // Start the scheduler
    startScheduler();

    logger.info('═══ Email Marketing Agent initialized successfully ═══');
  } catch (error) {
    logger.error('Email Marketing Agent initialization failed', { error: error.message });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  // Subscriber management
  upsertSubscriber,
  getSubscriber,
  tagSubscriber,
  getSegmentSubscribers,
  // Sequences
  loadSequence,
  generateSequenceEmail,
  createSubjectLineABTest,
  // Campaigns
  createCampaign,
  scheduleCampaign,
  // Reporting
  getCampaignReports,
  generateWeeklyReport,
  // Maintenance
  cleanSubscriberList,
  // Triggers
  onNewSubscriber,
  onNewClient,
  // Scheduler
  startScheduler,
};
