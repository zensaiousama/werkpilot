/**
 * AGENT 11 — PR / Media Agent
 *
 * Generates press releases, manages media contacts, pitches to Swiss media,
 * creates thought leadership content, and monitors media coverage.
 *
 * Responsibilities:
 * - Generate press releases for milestones (10 clients, 50 clients, new service)
 * - Journalist/media contact database in Airtable
 * - Pitch to Swiss media: Handelszeitung, Bilanz, NZZ, PME Magazine
 * - Thought leadership content generation
 * - Media monitoring
 * - Press kit management
 *
 * Schedule: Media monitoring daily, press releases on milestones, pitches weekly
 */

const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('pr-media');
const MARKETING_DIR = path.join(__dirname);
const PRESS_KIT_DIR = path.join(MARKETING_DIR, 'press-kit');
const MEDIA_CONTACTS_PATH = path.join(MARKETING_DIR, 'media-contacts.json');

// ─── Press Kit Management ───────────────────────────────────────────────────────

/**
 * Load press kit materials
 */
async function loadPressKit() {
  try {
    const files = {
      companyDescription: await fs.readFile(path.join(PRESS_KIT_DIR, 'company-description.md'), 'utf-8'),
      founderBio: await fs.readFile(path.join(PRESS_KIT_DIR, 'founder-bio.md'), 'utf-8'),
      keyStats: JSON.parse(await fs.readFile(path.join(PRESS_KIT_DIR, 'key-stats.json'), 'utf-8')),
    };

    logger.info('Press kit loaded successfully');
    return files;
  } catch (error) {
    logger.error('Failed to load press kit', { error: error.message });
    throw error;
  }
}

/**
 * Load media contacts database
 */
async function loadMediaContacts() {
  try {
    const content = await fs.readFile(MEDIA_CONTACTS_PATH, 'utf-8');
    const contacts = JSON.parse(content);

    // Also try Airtable for live contacts
    try {
      const airtableContacts = await getRecords('MediaContacts', '', 200);
      if (airtableContacts.length > 0) {
        contacts.airtable_contacts = airtableContacts;
        logger.info(`Loaded ${airtableContacts.length} contacts from Airtable`);
      }
    } catch (airtableErr) {
      logger.warn('Could not load Airtable media contacts, using local file', { error: airtableErr.message });
    }

    logger.info('Media contacts loaded');
    return contacts;
  } catch (error) {
    logger.error('Failed to load media contacts', { error: error.message });
    throw error;
  }
}

// ─── Press Release Generation ───────────────────────────────────────────────────

/**
 * Generate a press release for a specific milestone
 *
 * @param {string} milestoneType - client_milestone, new_service, partnership, award
 * @param {object} details - Milestone-specific details
 * @returns {object} Press release in DE and FR
 */
async function generatePressRelease(milestoneType, details = {}) {
  logger.info(`Generating press release: ${milestoneType}`);

  try {
    const pressKit = await loadPressKit();
    const today = new Date().toISOString().split('T')[0];

    const milestoneDescriptions = {
      client_milestone: `Werkpilot hat ${details.count || 'X'} Kunden erreicht`,
      new_service: `Werkpilot lanciert neuen Service: ${details.serviceName || 'Neuer Service'}`,
      partnership: `Werkpilot geht Partnerschaft ein mit ${details.partnerName || 'Partner'}`,
      award: `Werkpilot erhält Auszeichnung: ${details.awardName || 'Auszeichnung'}`,
      market_expansion: `Werkpilot expandiert in ${details.market || 'neuen Markt'}`,
      funding: `Werkpilot schliesst Finanzierungsrunde ab`,
    };

    const prompt = `Write a professional press release for a Swiss tech company.

Company: Werkpilot
${pressKit.companyDescription.substring(0, 500)}

Key Stats:
${JSON.stringify(pressKit.keyStats.company, null, 2)}

Milestone: ${milestoneDescriptions[milestoneType] || milestoneType}
Additional Details: ${JSON.stringify(details)}
Date: ${today}

Write TWO versions:
1. German (Schweizerisches Hochdeutsch, "ss" not "ß")
2. French (Swiss business French)

Each press release must include:
- Headline (compelling, max 80 chars)
- Subheadline (contextual, max 120 chars)
- Location + Date line (e.g., "Zürich, ${today}")
- Lead paragraph (who, what, when, where, why - max 3 sentences)
- 2-3 body paragraphs with details, context, and impact
- Quote from founder
- Boilerplate "Über Werkpilot" paragraph
- Contact information

IMPORTANT: Never use "KI" or "AI" - use "intelligente Automatisierung" (DE) or "automatisation intelligente" (FR)
Use "wir" perspective in quotes, third person elsewhere.

Return as JSON:
{
  "de": {
    "headline": "string",
    "subheadline": "string",
    "body": "Full press release text in markdown",
    "summary": "2-sentence summary for social media",
    "hashtags": ["..."]
  },
  "fr": {
    "headline": "string",
    "subheadline": "string",
    "body": "Full press release text in markdown",
    "summary": "2-sentence summary for social media",
    "hashtags": ["..."]
  },
  "metadata": {
    "milestone_type": "string",
    "embargo_date": null,
    "target_media": ["..."],
    "suggested_images": ["..."]
  }
}`;

    const pressRelease = await generateJSON(prompt, {
      system: 'You are a Swiss PR professional writing press releases for business media. Professional, factual, compelling. Follow Swiss German conventions.',
      model: config.models.standard,
      maxTokens: 4096,
    });

    // Save press release
    const filename = `press-release_${milestoneType}_${today}.json`;
    const outputPath = path.join(PRESS_KIT_DIR, filename);
    await fs.writeFile(outputPath, JSON.stringify(pressRelease, null, 2));

    // Store in Airtable
    await createRecord('PressReleases', {
      Title: pressRelease.de?.headline || milestoneType,
      Type: milestoneType,
      Date: today,
      Status: 'draft',
      ContentDE: pressRelease.de?.body || '',
      ContentFR: pressRelease.fr?.body || '',
      Agent: 'pr-media',
    });

    logger.info(`Press release generated and saved: ${filename}`);
    return pressRelease;
  } catch (error) {
    logger.error('Press release generation failed', { milestoneType, error: error.message });
    throw error;
  }
}

// ─── Media Pitching ─────────────────────────────────────────────────────────────

/**
 * Generate a personalized media pitch for a specific outlet
 */
async function generatePitch(outletName, topic, angle = '') {
  logger.info(`Generating pitch for ${outletName}: ${topic}`);

  try {
    const contacts = await loadMediaContacts();
    const allOutlets = [
      ...contacts.target_media.national_business,
      ...contacts.target_media.tech_media,
      ...contacts.target_media.regional,
      ...contacts.target_media.industry_specific,
    ];

    const outlet = allOutlets.find(o => o.outlet.toLowerCase() === outletName.toLowerCase());
    if (!outlet) {
      logger.warn(`Outlet not found: ${outletName}`);
    }

    const prompt = `Write a personalized media pitch email for a Swiss journalist/editor.

Target Outlet: ${outletName}
${outlet ? `Outlet Focus: ${outlet.focus}` : ''}
${outlet ? `Language: ${outlet.language}` : 'Language: de'}
${outlet ? `Relevant Sections: ${outlet.sections?.join(', ') || 'General'}` : ''}

Topic: ${topic}
Angle: ${angle || 'General company story'}

Pitch Rules:
- Short (max 200 words for the body)
- Compelling subject line
- Personal but professional
- Why this is relevant for THEIR readers
- Clear offer (interview, data, exclusive)
- Easy to say yes
- Never use "KI" or "AI" - say "intelligente Automatisierung" or "automatisation intelligente"
- Include a specific hook or data point

Write in ${outlet?.language === 'fr' ? 'French' : 'German'} (Swiss style).

Return as JSON:
{
  "subject": "Email subject line",
  "body": "Complete pitch email body",
  "followup_subject": "Follow-up email subject",
  "followup_body": "Follow-up email body (shorter, sent 5 days later)",
  "best_timing": "Recommended day/time to send",
  "hook": "The main hook that makes this newsworthy"
}`;

    const pitch = await generateJSON(prompt, {
      system: 'You are a Swiss PR specialist writing concise, effective media pitches. You know how Swiss business journalists think.',
      model: config.models.standard,
    });

    // Store in Airtable
    await createRecord('MediaPitches', {
      Outlet: outletName,
      Topic: topic,
      Subject: pitch.subject,
      Status: 'draft',
      Date: new Date().toISOString().split('T')[0],
      Agent: 'pr-media',
    });

    logger.info(`Pitch generated for ${outletName}`);
    return pitch;
  } catch (error) {
    logger.error('Pitch generation failed', { outletName, error: error.message });
    throw error;
  }
}

/**
 * Generate pitches for all target media outlets on a specific topic
 */
async function generatePitchBatch(topic, angle = '') {
  logger.info(`Generating pitch batch for topic: ${topic}`);

  try {
    const contacts = await loadMediaContacts();
    const priorityOutlets = [
      ...contacts.target_media.national_business.filter(o => o.relevance === 'high' || o.relevance === 'very_high'),
      ...contacts.target_media.tech_media.filter(o => o.relevance === 'high' || o.relevance === 'very_high'),
    ];

    const pitches = [];
    for (const outlet of priorityOutlets) {
      try {
        const pitch = await generatePitch(outlet.outlet, topic, angle);
        pitches.push({ outlet: outlet.outlet, ...pitch });
      } catch (pitchError) {
        logger.warn(`Failed to generate pitch for ${outlet.outlet}`, { error: pitchError.message });
      }
    }

    logger.info(`Pitch batch complete: ${pitches.length} pitches generated`);
    return pitches;
  } catch (error) {
    logger.error('Pitch batch generation failed', { error: error.message });
    throw error;
  }
}

// ─── Thought Leadership ─────────────────────────────────────────────────────────

/**
 * Generate thought leadership content (op-eds, expert commentary)
 */
async function generateThoughtLeadership(topic, format = 'op_ed', language = 'de') {
  logger.info(`Generating thought leadership: ${topic} (${format})`);

  try {
    const pressKit = await loadPressKit();

    const formatDescriptions = {
      op_ed: 'Opinion editorial (600-800 words) for a business newspaper',
      expert_commentary: 'Expert commentary (300-400 words) on an industry trend',
      linkedin_article: 'LinkedIn article (500-700 words) for professional audience',
      interview_prep: 'Interview talking points (10-15 key messages)',
      panel_speaking: 'Panel discussion prep: opening statement + 5 key points',
    };

    const prompt = `Write thought leadership content for the Werkpilot founder.

Topic: ${topic}
Format: ${formatDescriptions[format] || format}
Language: ${language === 'de' ? 'German (Swiss)' : language === 'fr' ? 'French (Swiss)' : 'English'}

About the Author/Speaker:
${pressKit.founderBio.substring(0, 500)}

Context:
- Werkpilot helps Swiss KMU with digital presence and marketing automation
- Target industries: Treuhänder, Zahnärzte, Immobilien, Anwälte, Architekten
- The author should come across as: knowledgeable, grounded, Swiss-practical, forward-thinking
- NEVER use "KI" or "AI" - use "intelligente Automatisierung" or "smarte digitale Werkzeuge"
- Use "ss" not "ß" for Swiss German

The content should:
1. Open with a compelling observation or statistic
2. Present a clear thesis/perspective
3. Back up with concrete examples (Swiss context preferred)
4. Offer practical takeaways
5. End with a forward-looking statement

Return as JSON:
{
  "title": "string",
  "subtitle": "string (optional)",
  "content": "Full content in markdown",
  "key_messages": ["3-5 key takeaways"],
  "social_teaser": "Short social media teaser",
  "target_publications": ["Where to pitch this"],
  "seo_keywords": ["Relevant keywords"]
}`;

    const content = await generateJSON(prompt, {
      system: 'You are a ghostwriter for a Swiss tech entrepreneur. Write with authority but humility. Swiss business style: practical, fact-based, no hyperbole.',
      model: config.models.standard,
      maxTokens: 4096,
    });

    // Store in Airtable
    await createRecord('ThoughtLeadership', {
      Title: content.title,
      Topic: topic,
      Format: format,
      Language: language,
      Status: 'draft',
      Content: content.content?.substring(0, 5000) || '',
      Date: new Date().toISOString().split('T')[0],
      Agent: 'pr-media',
    });

    logger.info(`Thought leadership content generated: ${content.title}`);
    return content;
  } catch (error) {
    logger.error('Thought leadership generation failed', { topic, error: error.message });
    throw error;
  }
}

// ─── Media Monitoring ───────────────────────────────────────────────────────────

/**
 * Monitor for brand mentions and industry news
 * Note: Uses AI to generate monitoring report; integrate with media monitoring API later
 */
async function runMediaMonitoring() {
  logger.info('Running media monitoring check');

  try {
    // Check Airtable for any manually logged mentions
    const mentions = await getRecords('MediaMentions', '{Date} >= TODAY() - 7', 50);

    const prompt = `Generate a media monitoring report template for Werkpilot.

Known recent mentions: ${mentions.length > 0 ? JSON.stringify(mentions.map(m => ({ outlet: m.Outlet, date: m.Date, sentiment: m.Sentiment }))) : 'No mentions tracked yet'}

Create a monitoring checklist and report template covering:
1. Brand mentions (Werkpilot, werkpilot.ch)
2. Industry mentions (KMU Digitalisierung Schweiz, digitales Marketing KMU)
3. Competitor activity
4. Relevant industry news (Treuhand, Zahnarzt, Immobilien digital)
5. Sentiment analysis
6. Opportunities for reactive PR

Return as JSON:
{
  "monitoring_date": "${new Date().toISOString().split('T')[0]}",
  "brand_mentions": { "count": number, "sentiment": "positive|neutral|negative|mixed", "highlights": [] },
  "industry_news": [{ "headline": "string", "source": "string", "relevance": "high|medium|low", "pr_opportunity": "string" }],
  "competitor_activity": [],
  "action_items": [{ "priority": "high|medium|low", "action": "string", "deadline": "string" }],
  "monitoring_keywords": ["Keywords to track"],
  "api_integration_note": "Integrate with Google Alerts, Mention.com, or Meltwater for automated monitoring"
}`;

    const report = await generateJSON(prompt, {
      system: 'You are a Swiss media monitoring specialist. Generate actionable monitoring reports.',
      model: config.models.fast,
    });

    // Store monitoring report
    await createRecord('MediaMonitoring', {
      Date: new Date().toISOString().split('T')[0],
      MentionCount: report.brand_mentions?.count || 0,
      Sentiment: report.brand_mentions?.sentiment || 'no_data',
      ActionItems: report.action_items?.length || 0,
      Report: JSON.stringify(report),
      Agent: 'pr-media',
    });

    logger.info('Media monitoring complete', {
      mentions: report.brand_mentions?.count || 0,
      actionItems: report.action_items?.length || 0,
    });

    return report;
  } catch (error) {
    logger.error('Media monitoring failed', { error: error.message });
    throw error;
  }
}

// ─── Milestone Checking ─────────────────────────────────────────────────────────

/**
 * Check if any milestones have been reached that warrant a press release
 */
async function checkMilestones() {
  logger.info('Checking for press release milestones');

  try {
    const pressKit = await loadPressKit();
    const triggers = pressKit.keyStats.press_release_triggers;

    // Get current client count from Airtable
    let currentClients = 0;
    try {
      const clients = await getRecords('Clients', '{Status} = "active"', 1000);
      currentClients = clients.length;
    } catch (err) {
      logger.warn('Could not fetch client count from Airtable');
    }

    // Check client milestones
    const clientMilestones = triggers.client_milestones || [];
    const reachedMilestones = clientMilestones.filter(m => currentClients >= m);

    // Check if we already have a press release for this milestone
    const existingReleases = await getRecords('PressReleases', '{Type} = "client_milestone"', 100);
    const existingCounts = existingReleases.map(r => {
      const match = r.Title?.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });

    const newMilestones = reachedMilestones.filter(m => !existingCounts.includes(m));

    if (newMilestones.length > 0) {
      const latestMilestone = Math.max(...newMilestones);
      logger.info(`New milestone reached: ${latestMilestone} clients!`);

      const pressRelease = await generatePressRelease('client_milestone', {
        count: latestMilestone,
        currentTotal: currentClients,
      });

      // Notify CEO
      await sendCEOEmail({
        subject: `Meilenstein erreicht: ${latestMilestone} Kunden! Pressemitteilung bereit.`,
        html: `
          <h2 style="color: #1B2A4A;">Neuer Meilenstein: ${latestMilestone} Kunden</h2>
          <p>Herzlichen Glückwunsch! Werkpilot hat ${latestMilestone} aktive Kunden erreicht.</p>
          <p>Eine Pressemitteilung wurde vorbereitet:</p>
          <blockquote style="border-left: 3px solid #2E75B6; padding-left: 12px; color: #212529;">
            <strong>${pressRelease.de?.headline || 'Pressemitteilung'}</strong><br>
            ${pressRelease.de?.subheadline || ''}
          </blockquote>
          <p>Bitte prüfen und freigeben.</p>
        `,
      });

      return { milestone: latestMilestone, pressRelease };
    }

    logger.info(`No new milestones. Current clients: ${currentClients}, next milestone: ${clientMilestones.find(m => m > currentClients) || 'none set'}`);
    return { milestone: null, currentClients };
  } catch (error) {
    logger.error('Milestone check failed', { error: error.message });
    throw error;
  }
}

// ─── Cron Scheduling ────────────────────────────────────────────────────────────

function startScheduler() {
  logger.info('Starting PR/Media Agent scheduler');

  // Daily media monitoring at 8:00 AM CET
  cron.schedule('0 8 * * *', async () => {
    logger.info('Cron: Running media monitoring');
    try {
      await runMediaMonitoring();
    } catch (error) {
      logger.error('Cron: Media monitoring failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Daily milestone check at 9:00 AM CET
  cron.schedule('0 9 * * *', async () => {
    logger.info('Cron: Checking milestones');
    try {
      await checkMilestones();
    } catch (error) {
      logger.error('Cron: Milestone check failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Weekly thought leadership generation - Thursdays at 10:00 AM CET
  cron.schedule('0 10 * * 4', async () => {
    logger.info('Cron: Generating thought leadership content');
    try {
      const topics = [
        'Warum Schweizer KMU jetzt digital aufrüsten müssen',
        'Die Zukunft der lokalen Suche für Dienstleister',
        'Digitalisierung im Treuhandwesen: Chancen und Herausforderungen',
        'Online-Reputation als Wettbewerbsvorteil',
        'Marketing-Automatisierung für KMU: Was funktioniert wirklich',
      ];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      await generateThoughtLeadership(randomTopic, 'linkedin_article', 'de');
    } catch (error) {
      logger.error('Cron: Thought leadership generation failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  logger.info('PR/Media Agent scheduler started successfully');
}

// ─── Main Entry Point ───────────────────────────────────────────────────────────

async function main() {
  logger.info('═══ PR/Media Agent (Agent 11) starting ═══');

  try {
    // Load and validate press kit
    const pressKit = await loadPressKit();
    logger.info('Press kit validated', {
      milestones: pressKit.keyStats.milestones?.length || 0,
      industries: pressKit.keyStats.industries_served?.length || 0,
    });

    // Load media contacts
    const contacts = await loadMediaContacts();
    const totalOutlets = Object.values(contacts.target_media).reduce((sum, cat) => sum + cat.length, 0);
    logger.info(`Media contacts loaded: ${totalOutlets} target outlets`);

    // Start the scheduler
    startScheduler();

    logger.info('═══ PR/Media Agent initialized successfully ═══');
  } catch (error) {
    logger.error('PR/Media Agent initialization failed', { error: error.message });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  loadPressKit,
  loadMediaContacts,
  generatePressRelease,
  generatePitch,
  generatePitchBatch,
  generateThoughtLeadership,
  runMediaMonitoring,
  checkMilestones,
  startScheduler,
};
