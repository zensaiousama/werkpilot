/**
 * AGENT 09 — Performance Marketing Agent
 *
 * Manages Google Ads campaigns, keyword optimization, ad copy generation,
 * budget optimization, and performance reporting for Werkpilot.
 *
 * Responsibilities:
 * - Campaign structure preparation (Google Ads API integration later)
 * - Keyword management per industry/language
 * - Ad copy generation via Claude
 * - Budget optimization: CPC, CPA, ROAS tracking
 * - Weekly performance reports with recommendations
 * - Competitor ad monitoring
 * - Landing page conversion recommendations
 *
 * Schedule: Daily optimization checks, weekly reports
 */

const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('performance-marketing');
const MARKETING_DIR = path.join(__dirname);
const CAMPAIGNS_DIR = path.join(MARKETING_DIR, 'campaigns');
const KEYWORDS_DIR = path.join(MARKETING_DIR, 'keywords');

// ─── Campaign Management ───────────────────────────────────────────────────────

/**
 * Load all campaign configurations from the campaigns directory
 */
async function loadCampaigns() {
  try {
    const files = await fs.readdir(CAMPAIGNS_DIR);
    const campaigns = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const content = await fs.readFile(path.join(CAMPAIGNS_DIR, file), 'utf-8');
      const campaign = JSON.parse(content);
      campaigns.push({ file, ...campaign });
    }

    logger.info(`Loaded ${campaigns.length} campaign configurations`);
    return campaigns;
  } catch (error) {
    logger.error('Failed to load campaigns', { error: error.message });
    throw error;
  }
}

/**
 * Load keyword lists for a specific language
 */
async function loadKeywords(language = 'de') {
  try {
    const filePath = path.join(KEYWORDS_DIR, `${language}-keywords.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    const keywords = JSON.parse(content);
    logger.info(`Loaded ${language} keywords`);
    return keywords;
  } catch (error) {
    logger.error(`Failed to load ${language} keywords`, { error: error.message });
    throw error;
  }
}

/**
 * Generate optimized ad copy for a campaign using Claude
 */
async function generateAdCopy(industry, language = 'de', adGroupName = '') {
  logger.info(`Generating ad copy for ${industry} (${language})`);

  try {
    const keywords = await loadKeywords(language);
    const industryKeywords = keywords.industries[industry] || {};

    const prompt = `Generate Google Ads responsive search ad copy for a Swiss digital marketing service called "Werkpilot" targeting ${industry} businesses.

Language: ${language === 'de' ? 'German (Swiss)' : 'French (Swiss)'}
Ad Group: ${adGroupName}

Key keywords to incorporate naturally:
${JSON.stringify(industryKeywords.primary?.slice(0, 5) || [], null, 2)}

Pain points to address:
${JSON.stringify(industryKeywords.pain_points || [], null, 2)}

Requirements:
- 10 headlines (max 30 characters each)
- 4 descriptions (max 90 characters each)
- Headlines should include keyword variations, benefits, and CTAs
- Descriptions should highlight: Swiss quality, results, ease of use, industry expertise
- NEVER use the words "KI", "AI", "künstliche Intelligenz" or "artificial intelligence"
- Use "wir" (we) perspective, warm professional tone
- Include Swiss-specific references where appropriate
- Use "ss" instead of "ß"

Return as JSON with format:
{
  "headlines": ["..."],
  "descriptions": ["..."],
  "sitelinks": [{"text": "...", "description": "...", "url": "..."}]
}`;

    const result = await generateJSON(prompt, {
      system: 'You are an expert Google Ads copywriter specializing in the Swiss B2B market. Write compelling, concise ad copy that drives clicks from business owners.',
      model: config.models.standard,
    });

    logger.info(`Generated ad copy for ${industry}: ${result.headlines?.length || 0} headlines, ${result.descriptions?.length || 0} descriptions`);
    return result;
  } catch (error) {
    logger.error('Ad copy generation failed', { industry, error: error.message });
    throw error;
  }
}

/**
 * Prepare campaign structure for Google Ads API
 * (Structure ready, actual API integration to follow)
 */
async function prepareCampaignStructure(campaignFile) {
  logger.info(`Preparing campaign structure from ${campaignFile}`);

  try {
    const content = await fs.readFile(path.join(CAMPAIGNS_DIR, campaignFile), 'utf-8');
    const { campaign } = JSON.parse(content);

    const structure = {
      campaign: {
        name: campaign.name,
        status: 'PAUSED', // Always start paused
        budget: {
          amount_micros: campaign.budget.daily * 1_000_000,
          delivery_method: 'STANDARD',
        },
        network_settings: {
          target_google_search: true,
          target_search_network: false,
          target_content_network: false,
        },
        geo_targets: campaign.targeting.locations.map(loc => ({
          country_code: loc.country,
          regions: loc.regions,
        })),
        language_targets: campaign.languages.map(l => l === 'de' ? 1000 : l === 'fr' ? 1002 : 1000),
        ad_schedule: campaign.schedule,
      },
      ad_groups: campaign.ad_groups.map(group => ({
        name: group.name,
        cpc_bid_micros: group.bid_strategy.max_cpc * 1_000_000,
        keywords: group.keywords.map(kw => ({
          text: kw,
          match_type: group.match_types.includes('exact') ? 'EXACT' : 'PHRASE',
        })),
        negative_keywords: group.negative_keywords.map(kw => ({
          text: kw,
          match_type: 'BROAD',
        })),
        ads: group.ads,
      })),
      conversion_actions: campaign.conversion_tracking.goals,
      prepared_at: new Date().toISOString(),
      api_ready: false,
      note: 'Structure prepared. Enable Google Ads API integration to deploy.',
    };

    // Save prepared structure
    const outputPath = path.join(CAMPAIGNS_DIR, `prepared_${campaignFile}`);
    await fs.writeFile(outputPath, JSON.stringify(structure, null, 2));

    logger.info(`Campaign structure prepared and saved to ${outputPath}`);
    return structure;
  } catch (error) {
    logger.error('Failed to prepare campaign structure', { campaignFile, error: error.message });
    throw error;
  }
}

// ─── Budget Optimization ────────────────────────────────────────────────────────

/**
 * Analyze campaign performance metrics and suggest optimizations
 */
async function analyzeBudgetPerformance() {
  logger.info('Analyzing budget performance across campaigns');

  try {
    // Fetch performance data from Airtable
    const performanceData = await getRecords('CampaignPerformance', '', 100);

    if (performanceData.length === 0) {
      logger.info('No performance data available yet');
      return { status: 'no_data', recommendations: [] };
    }

    // Calculate key metrics
    const metrics = performanceData.reduce((acc, record) => {
      acc.totalSpend += record.Spend || 0;
      acc.totalClicks += record.Clicks || 0;
      acc.totalImpressions += record.Impressions || 0;
      acc.totalConversions += record.Conversions || 0;
      acc.totalRevenue += record.Revenue || 0;
      return acc;
    }, { totalSpend: 0, totalClicks: 0, totalImpressions: 0, totalConversions: 0, totalRevenue: 0 });

    metrics.ctr = metrics.totalImpressions > 0 ? (metrics.totalClicks / metrics.totalImpressions) * 100 : 0;
    metrics.cpc = metrics.totalClicks > 0 ? metrics.totalSpend / metrics.totalClicks : 0;
    metrics.cpa = metrics.totalConversions > 0 ? metrics.totalSpend / metrics.totalConversions : 0;
    metrics.roas = metrics.totalSpend > 0 ? metrics.totalRevenue / metrics.totalSpend : 0;
    metrics.conversionRate = metrics.totalClicks > 0 ? (metrics.totalConversions / metrics.totalClicks) * 100 : 0;

    // Generate AI-powered recommendations
    const prompt = `Analyze these Google Ads performance metrics for a Swiss B2B SaaS company (Werkpilot) and provide budget optimization recommendations:

Metrics:
- Total Spend: CHF ${metrics.totalSpend.toFixed(2)}
- Total Clicks: ${metrics.totalClicks}
- Total Impressions: ${metrics.totalImpressions}
- CTR: ${metrics.ctr.toFixed(2)}%
- CPC: CHF ${metrics.cpc.toFixed(2)}
- Total Conversions: ${metrics.totalConversions}
- CPA: CHF ${metrics.cpa.toFixed(2)}
- Conversion Rate: ${metrics.conversionRate.toFixed(2)}%
- Revenue: CHF ${metrics.totalRevenue.toFixed(2)}
- ROAS: ${metrics.roas.toFixed(2)}x

Provide 3-5 specific, actionable recommendations as JSON:
{
  "overall_health": "good|warning|critical",
  "summary": "One sentence summary",
  "recommendations": [
    {
      "priority": "high|medium|low",
      "area": "budget|keywords|ads|targeting|bidding",
      "action": "Specific action to take",
      "expected_impact": "Expected result of this action",
      "reasoning": "Why this matters"
    }
  ],
  "budget_adjustment": {
    "current_daily": number,
    "recommended_daily": number,
    "reason": "string"
  }
}`;

    const analysis = await generateJSON(prompt, {
      system: 'You are a Google Ads optimization specialist for the Swiss market. Provide data-driven recommendations.',
      model: config.models.standard,
    });

    logger.info('Budget analysis complete', { health: analysis.overall_health });
    return { metrics, analysis };
  } catch (error) {
    logger.error('Budget analysis failed', { error: error.message });
    throw error;
  }
}

// ─── Competitor Monitoring ──────────────────────────────────────────────────────

/**
 * Monitor competitor ad strategies and generate insights
 */
async function monitorCompetitors() {
  logger.info('Running competitor monitoring');

  try {
    // Define known competitors in the Swiss KMU digital marketing space
    const competitors = [
      { name: 'Webflow Agencies', focus: 'Website design' },
      { name: 'Local SEO agencies', focus: 'SEO services' },
      { name: 'Localsearch/Swisscom Directories', focus: 'Local listings' },
      { name: 'Freelance web designers', focus: 'Custom websites' },
      { name: 'Marketing agencies (traditional)', focus: 'Full-service marketing' },
    ];

    const prompt = `As a competitive intelligence analyst for the Swiss digital marketing space, analyze the competitive landscape for Werkpilot (a KMU digital marketing automation platform).

Known competitor types:
${competitors.map(c => `- ${c.name}: ${c.focus}`).join('\n')}

Generate a competitive analysis with:
1. Likely ad strategies each competitor type uses
2. Keywords they probably target
3. Messaging angles they use
4. Gaps Werkpilot can exploit
5. Recommended counter-positioning

Return as JSON:
{
  "competitor_analysis": [
    {
      "competitor_type": "string",
      "likely_keywords": ["..."],
      "messaging_angles": ["..."],
      "strengths": ["..."],
      "weaknesses": ["..."]
    }
  ],
  "opportunities": ["..."],
  "recommended_counter_ads": [
    {
      "against": "competitor type",
      "headline": "Ad headline (max 30 chars)",
      "description": "Ad description (max 90 chars)",
      "differentiator": "What makes Werkpilot better"
    }
  ]
}`;

    const analysis = await generateJSON(prompt, {
      system: 'You are a Swiss market competitive intelligence expert specializing in digital marketing services for KMU.',
      model: config.models.standard,
    });

    // Store in Airtable
    await createRecord('CompetitorInsights', {
      Date: new Date().toISOString().split('T')[0],
      Analysis: JSON.stringify(analysis),
      Opportunities: analysis.opportunities?.join('; ') || '',
      Agent: 'performance-marketing',
    });

    logger.info(`Competitor analysis complete: ${analysis.opportunities?.length || 0} opportunities identified`);
    return analysis;
  } catch (error) {
    logger.error('Competitor monitoring failed', { error: error.message });
    throw error;
  }
}

// ─── Landing Page Analysis ──────────────────────────────────────────────────────

/**
 * Generate landing page conversion recommendations
 */
async function analyzeLandingPages() {
  logger.info('Generating landing page conversion recommendations');

  try {
    const campaigns = await loadCampaigns();
    const landingPages = campaigns
      .flatMap(c => c.campaign?.ad_groups || [])
      .flatMap(g => g.ads || [])
      .map(a => a.final_url)
      .filter((url, i, arr) => arr.indexOf(url) === i);

    const prompt = `As a conversion rate optimization (CRO) expert, generate landing page recommendations for these Werkpilot campaign landing pages:

Landing pages:
${landingPages.map(url => `- ${url}`).join('\n')}

For each landing page, provide recommendations covering:
1. Above-the-fold content
2. Social proof elements
3. Form optimization
4. Trust signals (Swiss-specific)
5. Mobile optimization
6. Page speed considerations
7. CTA placement and copy

Brand requirements:
- Colors: Navy #1B2A4A, Blue #2E75B6, Green #2D8C3C, Orange #D4760A
- Fonts: Plus Jakarta Sans (headlines), DM Sans (body)
- Never mention "AI" or "KI" - use "intelligente Automatisierung"
- Swiss quality messaging

Return as JSON:
{
  "pages": [
    {
      "url": "string",
      "recommendations": [
        {
          "area": "string",
          "current_issue": "string",
          "recommendation": "string",
          "priority": "high|medium|low",
          "expected_lift": "string"
        }
      ]
    }
  ],
  "general_recommendations": ["..."]
}`;

    const analysis = await generateJSON(prompt, {
      system: 'You are a CRO specialist with deep experience in Swiss B2B landing pages.',
      model: config.models.standard,
    });

    logger.info(`Landing page analysis complete: ${analysis.pages?.length || 0} pages analyzed`);
    return analysis;
  } catch (error) {
    logger.error('Landing page analysis failed', { error: error.message });
    throw error;
  }
}

// ─── Keyword Optimization ───────────────────────────────────────────────────────

/**
 * Discover new keyword opportunities based on performance and trends
 */
async function discoverKeywords(industry, language = 'de') {
  logger.info(`Discovering new keywords for ${industry} (${language})`);

  try {
    const keywords = await loadKeywords(language);
    const existingKeywords = keywords.industries[industry] || {};

    const prompt = `As a Swiss SEO/SEM specialist, suggest new keyword opportunities for the "${industry}" industry in ${language === 'de' ? 'German-speaking Switzerland' : 'French-speaking Switzerland'}.

Existing keywords we already target:
${JSON.stringify(existingKeywords.primary?.map(k => k.keyword || k) || [], null, 2)}

Existing long-tail keywords:
${JSON.stringify(existingKeywords.long_tail?.map(k => k.keyword || k) || [], null, 2)}

Find new opportunities in these categories:
1. New long-tail keywords (4+ words, lower competition)
2. Question-based keywords ("wie", "warum", "was kostet")
3. Local intent keywords (city + service)
4. Seasonal keywords
5. Competitor gap keywords

Return as JSON:
{
  "new_keywords": [
    {
      "keyword": "string",
      "category": "long_tail|question|local|seasonal|competitor_gap",
      "estimated_volume": number,
      "estimated_difficulty": "low|medium|high",
      "intent": "informational|commercial|transactional",
      "recommended_match_type": "exact|phrase|broad",
      "recommended_bid": number,
      "rationale": "Why this keyword is valuable"
    }
  ],
  "negative_keyword_suggestions": ["..."],
  "trending_topics": ["..."]
}`;

    const result = await generateJSON(prompt, {
      system: 'You are a Swiss SEM specialist. Suggest realistic keywords with accurate Swiss search behavior.',
      model: config.models.standard,
    });

    logger.info(`Discovered ${result.new_keywords?.length || 0} new keywords for ${industry}`);
    return result;
  } catch (error) {
    logger.error('Keyword discovery failed', { industry, error: error.message });
    throw error;
  }
}

// ─── Weekly Report ──────────────────────────────────────────────────────────────

/**
 * Generate and send weekly performance report
 */
async function generateWeeklyReport() {
  logger.info('Generating weekly performance report');

  try {
    const budgetAnalysis = await analyzeBudgetPerformance();
    const campaigns = await loadCampaigns();

    const prompt = `Generate a weekly Google Ads performance report summary for the CEO.

Campaign data:
${JSON.stringify(budgetAnalysis.metrics || { note: 'No live data yet' }, null, 2)}

AI Analysis:
${JSON.stringify(budgetAnalysis.analysis || { note: 'Pending first campaign data' }, null, 2)}

Active campaigns: ${campaigns.length}
${campaigns.map(c => `- ${c.campaign?.name || c.file}: ${c.campaign?.status || 'draft'}`).join('\n')}

Write a professional, concise report in German. Include:
1. Executive Summary (2-3 sentences)
2. Key Metrics Table
3. Top performing campaigns/ad groups
4. Underperforming areas
5. Budget recommendations
6. Actions taken this week
7. Planned actions next week

Format as HTML for email. Use Werkpilot brand colors (#1B2A4A for headers, #2E75B6 for accents).
Keep it scannable - the CEO is busy.`;

    const reportHtml = await generateText(prompt, {
      system: 'You are a performance marketing manager writing a weekly report for the CEO. Professional German, data-driven, actionable.',
      model: config.models.standard,
      maxTokens: 3000,
    });

    // Send to CEO
    await sendCEOEmail({
      subject: 'Performance Marketing - Wochenbericht',
      html: reportHtml,
    });

    // Store in Airtable
    await createRecord('WeeklyReports', {
      Agent: 'performance-marketing',
      Date: new Date().toISOString().split('T')[0],
      Type: 'weekly_performance',
      Summary: budgetAnalysis.analysis?.summary || 'Report generated',
      Status: 'sent',
    });

    logger.info('Weekly performance report generated and sent');
    return { status: 'sent', metrics: budgetAnalysis.metrics };
  } catch (error) {
    logger.error('Weekly report generation failed', { error: error.message });
    throw error;
  }
}

// ─── Daily Optimization ─────────────────────────────────────────────────────────

/**
 * Run daily campaign optimization checks
 */
async function runDailyOptimization() {
  logger.info('Running daily optimization cycle');

  try {
    const results = {
      timestamp: new Date().toISOString(),
      checks: [],
    };

    // 1. Check budget pacing
    logger.info('Checking budget pacing...');
    const budgetCheck = await analyzeBudgetPerformance();
    results.checks.push({
      check: 'budget_pacing',
      status: budgetCheck.analysis?.overall_health || 'no_data',
    });

    // 2. Check for underperforming keywords
    logger.info('Checking keyword performance...');
    const performanceData = await getRecords('KeywordPerformance', '{CTR} < 1', 50);
    if (performanceData.length > 0) {
      results.checks.push({
        check: 'low_ctr_keywords',
        count: performanceData.length,
        action: 'flagged_for_review',
      });
    }

    // 3. Check for high-CPA conversions
    const highCPAData = await getRecords('CampaignPerformance', '{CPA} > 80', 20);
    if (highCPAData.length > 0) {
      results.checks.push({
        check: 'high_cpa_campaigns',
        count: highCPAData.length,
        action: 'budget_reduction_recommended',
      });
    }

    // Store daily check results
    await createRecord('AgentActivity', {
      Agent: 'performance-marketing',
      Action: 'daily_optimization',
      Date: new Date().toISOString(),
      Result: JSON.stringify(results),
      Status: 'completed',
    });

    logger.info('Daily optimization cycle complete', { checks: results.checks.length });
    return results;
  } catch (error) {
    logger.error('Daily optimization failed', { error: error.message });
    throw error;
  }
}

// ─── Cron Scheduling ────────────────────────────────────────────────────────────

function startScheduler() {
  logger.info('Starting Performance Marketing Agent scheduler');

  // Daily optimization check at 7:00 AM CET
  cron.schedule('0 7 * * *', async () => {
    logger.info('Cron: Starting daily optimization');
    try {
      await runDailyOptimization();
    } catch (error) {
      logger.error('Cron: Daily optimization failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Weekly report every Monday at 8:00 AM CET
  cron.schedule('0 8 * * 1', async () => {
    logger.info('Cron: Generating weekly report');
    try {
      await generateWeeklyReport();
    } catch (error) {
      logger.error('Cron: Weekly report failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Competitor monitoring every Wednesday at 10:00 AM CET
  cron.schedule('0 10 * * 3', async () => {
    logger.info('Cron: Running competitor monitoring');
    try {
      await monitorCompetitors();
    } catch (error) {
      logger.error('Cron: Competitor monitoring failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Keyword discovery every Friday at 9:00 AM CET
  cron.schedule('0 9 * * 5', async () => {
    logger.info('Cron: Running keyword discovery');
    try {
      for (const industry of ['treuhand', 'zahnarzt', 'immobilien']) {
        await discoverKeywords(industry, 'de');
      }
    } catch (error) {
      logger.error('Cron: Keyword discovery failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  logger.info('Performance Marketing Agent scheduler started successfully');
}

// ─── Main Entry Point ───────────────────────────────────────────────────────────

async function main() {
  logger.info('═══ Performance Marketing Agent (Agent 09) starting ═══');

  try {
    // Validate campaign files exist
    const campaigns = await loadCampaigns();
    logger.info(`Found ${campaigns.length} campaign configurations`);

    // Validate keyword files exist
    for (const lang of ['de', 'fr']) {
      await loadKeywords(lang);
    }

    // Start the scheduler
    startScheduler();

    logger.info('═══ Performance Marketing Agent initialized successfully ═══');
  } catch (error) {
    logger.error('Performance Marketing Agent initialization failed', { error: error.message });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  loadCampaigns,
  loadKeywords,
  generateAdCopy,
  prepareCampaignStructure,
  analyzeBudgetPerformance,
  monitorCompetitors,
  analyzeLandingPages,
  discoverKeywords,
  generateWeeklyReport,
  runDailyOptimization,
  startScheduler,
};
