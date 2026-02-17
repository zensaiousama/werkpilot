/**
 * AGENT 10 — Brand Marketing Agent
 *
 * Maintains brand guidelines, reviews content for brand consistency,
 * generates brand assets, and manages seasonal campaigns for Werkpilot.
 *
 * Responsibilities:
 * - Maintain brand guidelines (voice, tone, colors, typography)
 * - Review content from other agents for brand consistency via Claude
 * - Brand voice enforcement: Professional, warm, Swiss-quality
 * - Generate brand assets: email signatures, presentation templates
 * - Seasonal campaign briefs: Jahresabschluss, Frühling-Offensive, Messezeit
 *
 * Schedule: Content review on demand, seasonal briefs quarterly, asset generation weekly
 */

const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('brand-marketing');
const MARKETING_DIR = path.join(__dirname);
const TEMPLATES_DIR = path.join(MARKETING_DIR, 'templates');
const GUIDELINES_PATH = path.join(MARKETING_DIR, 'brand-guidelines.json');

let brandGuidelines = null;

// ─── Brand Guidelines Management ────────────────────────────────────────────────

/**
 * Load brand guidelines from file
 */
async function loadBrandGuidelines() {
  try {
    const content = await fs.readFile(GUIDELINES_PATH, 'utf-8');
    brandGuidelines = JSON.parse(content);
    logger.info('Brand guidelines loaded successfully');
    return brandGuidelines;
  } catch (error) {
    logger.error('Failed to load brand guidelines', { error: error.message });
    throw error;
  }
}

/**
 * Get the brand guidelines, loading if not cached
 */
async function getGuidelines() {
  if (!brandGuidelines) {
    await loadBrandGuidelines();
  }
  return brandGuidelines;
}

// ─── Content Review ─────────────────────────────────────────────────────────────

/**
 * Review a piece of content for brand consistency
 * Called by other agents before publishing any content
 *
 * @param {string} content - The content to review
 * @param {string} contentType - Type: email, blog, ad, social, website
 * @param {string} language - Language: de, fr, en
 * @returns {object} Review result with score, issues, and corrected content
 */
async function reviewContent(content, contentType = 'general', language = 'de') {
  logger.info(`Reviewing ${contentType} content for brand consistency (${language})`);

  try {
    const guidelines = await getGuidelines();

    const prompt = `You are the Werkpilot Brand Guardian. Review the following content for strict brand guideline compliance.

## Brand Guidelines

### Voice Rules:
${guidelines.voice.rules.map(r => `- ${r}`).join('\n')}

### Forbidden Words (MUST NOT appear):
${guidelines.voice.forbidden_words.join(', ')}

### Preferred Words:
${guidelines.voice.preferred_words.join(', ')}

### Language Notes (${language}):
${guidelines.voice.language_notes[language] || 'Use professional tone appropriate for Swiss market.'}

### Content Type: ${contentType}

## Content to Review:
---
${content}
---

Analyze the content and provide:
1. A brand compliance score (0-100)
2. List of specific issues found (forbidden words, tone problems, guideline violations)
3. A corrected version of the content that fixes all issues while preserving the message
4. Suggestions for improvement

Return as JSON:
{
  "score": number,
  "passed": boolean,
  "issues": [
    {
      "severity": "critical|warning|suggestion",
      "type": "forbidden_word|tone|voice|language|factual",
      "original_text": "The problematic text",
      "issue": "Description of the problem",
      "fix": "Suggested fix"
    }
  ],
  "corrected_content": "The full corrected content",
  "improvement_suggestions": ["..."],
  "word_replacements": {"original": "replacement"}
}`;

    const review = await generateJSON(prompt, {
      system: 'You are a meticulous brand consistency reviewer for a Swiss B2B SaaS company. You enforce brand guidelines strictly but constructively.',
      model: config.models.standard,
      maxTokens: 4096,
    });

    // Log the review
    const logEntry = {
      Agent: 'brand-marketing',
      Action: 'content_review',
      Date: new Date().toISOString(),
      ContentType: contentType,
      Language: language,
      Score: review.score,
      Passed: review.passed ? 'Yes' : 'No',
      IssueCount: review.issues?.length || 0,
    };

    try {
      await createRecord('BrandReviews', logEntry);
    } catch (airtableError) {
      logger.warn('Could not log review to Airtable', { error: airtableError.message });
    }

    logger.info(`Brand review complete: score ${review.score}/100, ${review.issues?.length || 0} issues`, {
      contentType,
      passed: review.passed,
    });

    return review;
  } catch (error) {
    logger.error('Content review failed', { contentType, error: error.message });
    throw error;
  }
}

/**
 * Quick check for forbidden words (fast, no AI needed)
 */
async function quickForbiddenWordCheck(content) {
  const guidelines = await getGuidelines();
  const forbidden = guidelines.voice.forbidden_words;
  const found = [];

  const contentLower = content.toLowerCase();
  for (const word of forbidden) {
    if (contentLower.includes(word.toLowerCase())) {
      found.push(word);
    }
  }

  return {
    clean: found.length === 0,
    forbidden_words_found: found,
  };
}

// ─── Brand Asset Generation ─────────────────────────────────────────────────────

/**
 * Generate an email signature for a team member
 */
async function generateEmailSignature(name, title, email, phone, photoUrl = '') {
  logger.info(`Generating email signature for ${name}`);

  try {
    const templatePath = path.join(TEMPLATES_DIR, 'email-signature.html');
    let template = await fs.readFile(templatePath, 'utf-8');

    template = template.replace(/\{\{NAME\}\}/g, name);
    template = template.replace(/\{\{TITLE\}\}/g, title);
    template = template.replace(/\{\{EMAIL\}\}/g, email);
    template = template.replace(/\{\{PHONE\}\}/g, phone);
    template = template.replace(/\{\{PHOTO_URL\}\}/g, photoUrl || 'https://werkpilot.ch/email/default-avatar.png');

    logger.info(`Email signature generated for ${name}`);
    return template;
  } catch (error) {
    logger.error('Email signature generation failed', { name, error: error.message });
    throw error;
  }
}

/**
 * Generate a presentation template brief
 */
async function generatePresentationBrief(topic, audience, slideCount = 10) {
  logger.info(`Generating presentation brief: ${topic}`);

  try {
    const guidelines = await getGuidelines();

    const prompt = `Create a presentation outline for Werkpilot.

Topic: ${topic}
Audience: ${audience}
Slide Count: ${slideCount}

Brand Guidelines:
- Colors: Navy ${guidelines.visual.colors.primary.navy.hex}, Blue ${guidelines.visual.colors.primary.blue.hex}, Green ${guidelines.visual.colors.secondary.green.hex}, Orange ${guidelines.visual.colors.secondary.orange.hex}
- Fonts: ${guidelines.visual.typography.primary.family} (headlines), ${guidelines.visual.typography.secondary.family} (body)
- Voice: ${guidelines.voice.tone}
- NEVER mention "AI" or "KI" - use "intelligente Automatisierung"
- Always "wir" perspective

For each slide provide:
1. Title
2. Key message (1 sentence)
3. Content bullets (3-5 points)
4. Visual suggestion
5. Speaker notes (2-3 sentences)

Return as JSON:
{
  "presentation": {
    "title": "string",
    "subtitle": "string",
    "audience": "string",
    "duration_minutes": number,
    "slides": [
      {
        "number": number,
        "title": "string",
        "key_message": "string",
        "bullets": ["..."],
        "visual": "string",
        "speaker_notes": "string",
        "layout": "title|content|image_left|image_right|quote|stats|cta"
      }
    ]
  }
}`;

    const result = await generateJSON(prompt, {
      system: 'You are a presentation design strategist for a Swiss B2B tech company. Create compelling, professional presentations.',
      model: config.models.standard,
      maxTokens: 4096,
    });

    logger.info(`Presentation brief generated: ${result.presentation?.slides?.length || 0} slides`);
    return result;
  } catch (error) {
    logger.error('Presentation brief generation failed', { topic, error: error.message });
    throw error;
  }
}

// ─── Seasonal Campaigns ─────────────────────────────────────────────────────────

/**
 * Generate a seasonal campaign brief
 */
async function generateSeasonalBrief(seasonKey) {
  logger.info(`Generating seasonal campaign brief: ${seasonKey}`);

  try {
    const guidelines = await getGuidelines();
    const seasonConfig = guidelines.seasonal_campaigns[seasonKey];

    if (!seasonConfig) {
      throw new Error(`Unknown season: ${seasonKey}. Available: ${Object.keys(guidelines.seasonal_campaigns).join(', ')}`);
    }

    const prompt = `Create a comprehensive seasonal marketing campaign brief for Werkpilot.

Season: ${seasonKey}
Period: ${seasonConfig.period}
Theme: ${seasonConfig.theme}
Core Message: ${seasonConfig.message}
Accent Color: ${seasonConfig.colors_accent}

Brand Context:
- Company: Werkpilot - digital marketing automation for Swiss KMU
- Industries: Treuhänder, Zahnärzte, Immobilien, Anwälte, Architekten
- Markets: Deutschschweiz (primary), Romandie (secondary)
- Voice: ${guidelines.voice.tone}
- NEVER say "AI/KI" - say "intelligente Automatisierung"

Create a campaign brief including:
1. Campaign Overview
2. Target Audience Segments
3. Key Messages (DE + FR)
4. Channel Strategy (Email, Social, Blog, Ads)
5. Content Calendar (week-by-week)
6. Email Sequences (3-5 emails)
7. Social Media Posts (5-8 posts)
8. Blog Article Concepts (2-3 articles)
9. Ad Copy Concepts (Google + Social)
10. KPIs and Success Metrics
11. Budget Allocation

Return as JSON:
{
  "campaign": {
    "name": "string",
    "period": "string",
    "theme": "string",
    "objective": "string",
    "target_kpis": {},
    "segments": [],
    "messages": { "de": "string", "fr": "string" },
    "channels": {},
    "content_calendar": [],
    "email_sequence": [],
    "social_posts": [],
    "blog_concepts": [],
    "ad_concepts": [],
    "budget_split": {},
    "success_metrics": []
  }
}`;

    const brief = await generateJSON(prompt, {
      system: 'You are a senior marketing strategist for a Swiss B2B SaaS company. Create detailed, actionable campaign briefs.',
      model: config.models.standard,
      maxTokens: 4096,
    });

    // Store in Airtable
    await createRecord('SeasonalCampaigns', {
      Season: seasonKey,
      Name: brief.campaign?.name || seasonConfig.theme,
      Period: seasonConfig.period,
      Status: 'draft',
      Brief: JSON.stringify(brief),
      CreatedDate: new Date().toISOString(),
      Agent: 'brand-marketing',
    });

    logger.info(`Seasonal brief generated: ${brief.campaign?.name || seasonKey}`);
    return brief;
  } catch (error) {
    logger.error('Seasonal brief generation failed', { seasonKey, error: error.message });
    throw error;
  }
}

/**
 * Determine which seasonal campaign should be active based on current date
 */
function getCurrentSeason() {
  const month = new Date().getMonth() + 1; // 1-12

  if (month >= 11 || month === 12) return 'jahresabschluss';
  if (month >= 3 && month <= 4) return 'frühling_offensive';
  if (month >= 6 && month <= 7) return 'sommer_aktion';
  if (month >= 9 && month <= 10) return 'messezeit';

  return null; // No active seasonal campaign
}

// ─── Brand Health Monitoring ────────────────────────────────────────────────────

/**
 * Run a brand health check across all recent content
 */
async function runBrandHealthCheck() {
  logger.info('Running brand health check');

  try {
    // Get recent content from various sources
    const recentContent = await getRecords('ContentPublished', '{PublishedDate} >= TODAY() - 7', 50);

    if (recentContent.length === 0) {
      logger.info('No recent content to review');
      return { status: 'no_content', score: null };
    }

    let totalScore = 0;
    let totalIssues = 0;
    const criticalIssues = [];

    for (const item of recentContent) {
      if (!item.Content) continue;

      const review = await reviewContent(
        item.Content,
        item.ContentType || 'general',
        item.Language || 'de'
      );

      totalScore += review.score;

      if (review.issues) {
        totalIssues += review.issues.length;
        const critical = review.issues.filter(i => i.severity === 'critical');
        if (critical.length > 0) {
          criticalIssues.push({
            content_id: item.id,
            content_type: item.ContentType,
            issues: critical,
          });
        }
      }
    }

    const avgScore = recentContent.length > 0 ? Math.round(totalScore / recentContent.length) : 0;

    const report = {
      date: new Date().toISOString().split('T')[0],
      content_reviewed: recentContent.length,
      average_score: avgScore,
      total_issues: totalIssues,
      critical_issues: criticalIssues.length,
      brand_health: avgScore >= 90 ? 'excellent' : avgScore >= 75 ? 'good' : avgScore >= 60 ? 'needs_attention' : 'critical',
    };

    // Alert CEO if brand health is critical
    if (report.brand_health === 'critical' || criticalIssues.length > 0) {
      await sendCEOEmail({
        subject: `Brand Alert: ${criticalIssues.length} kritische Marken-Probleme gefunden`,
        html: `
          <h2 style="color: #1B2A4A;">Brand Health Alert</h2>
          <p>Der wöchentliche Brand-Check hat <strong>${criticalIssues.length} kritische Probleme</strong> gefunden.</p>
          <p>Durchschnittlicher Brand-Score: <strong>${avgScore}/100</strong></p>
          <p>Gesamte Probleme: ${totalIssues}</p>
          <h3>Kritische Probleme:</h3>
          <ul>
            ${criticalIssues.map(ci => `<li>${ci.content_type}: ${ci.issues.map(i => i.issue).join(', ')}</li>`).join('')}
          </ul>
          <p style="color: #6C757D; font-size: 12px;">Automatisch generiert vom Brand Marketing Agent</p>
        `,
      });
    }

    logger.info('Brand health check complete', report);
    return report;
  } catch (error) {
    logger.error('Brand health check failed', { error: error.message });
    throw error;
  }
}

// ─── Cron Scheduling ────────────────────────────────────────────────────────────

function startScheduler() {
  logger.info('Starting Brand Marketing Agent scheduler');

  // Weekly brand health check - Tuesdays at 9:00 AM CET
  cron.schedule('0 9 * * 2', async () => {
    logger.info('Cron: Running weekly brand health check');
    try {
      await runBrandHealthCheck();
    } catch (error) {
      logger.error('Cron: Brand health check failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Seasonal campaign brief - 1st of each month at 8:00 AM CET
  cron.schedule('0 8 1 * *', async () => {
    logger.info('Cron: Checking for seasonal campaign');
    try {
      const season = getCurrentSeason();
      if (season) {
        logger.info(`Active season detected: ${season}`);
        await generateSeasonalBrief(season);
      } else {
        logger.info('No active seasonal campaign for this period');
      }
    } catch (error) {
      logger.error('Cron: Seasonal brief generation failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  logger.info('Brand Marketing Agent scheduler started successfully');
}

// ─── Main Entry Point ───────────────────────────────────────────────────────────

async function main() {
  logger.info('═══ Brand Marketing Agent (Agent 10) starting ═══');

  try {
    // Load and validate brand guidelines
    const guidelines = await loadBrandGuidelines();
    logger.info(`Brand guidelines loaded: ${guidelines.brand.name}`, {
      colors: Object.keys(guidelines.visual.colors.primary).length + Object.keys(guidelines.visual.colors.secondary).length,
      voice_rules: guidelines.voice.rules.length,
      forbidden_words: guidelines.voice.forbidden_words.length,
      seasonal_campaigns: Object.keys(guidelines.seasonal_campaigns).length,
    });

    // Start the scheduler
    startScheduler();

    logger.info('═══ Brand Marketing Agent initialized successfully ═══');
  } catch (error) {
    logger.error('Brand Marketing Agent initialization failed', { error: error.message });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  loadBrandGuidelines,
  getGuidelines,
  reviewContent,
  quickForbiddenWordCheck,
  generateEmailSignature,
  generatePresentationBrief,
  generateSeasonalBrief,
  getCurrentSeason,
  runBrandHealthCheck,
  startScheduler,
};
