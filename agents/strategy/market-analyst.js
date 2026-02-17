/**
 * Werkpilot Market Analyst Agent (Agent 31)
 *
 * UPGRADED: Advanced market analysis with TAM/SAM/SOM calculation,
 * market size estimation by branche, growth trend tracking,
 * competitive positioning matrix, quarterly market reports,
 * and dashboard synchronization.
 *
 * Monitors the Swiss KMU market by industry and canton, tracks
 * digitalization trends, AI adoption rates, marketing spend patterns,
 * demand signals, seasonal patterns, and regulatory changes.
 * Produces quarterly market intelligence briefings.
 *
 * Schedule: Quarterly on 1st at 04:00, with monthly data refresh
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord } = require('../shared/utils/airtable-client');
const dashboardSync = require('../shared/utils/dashboard-sync');
const config = require('../shared/utils/config');

const logger = createLogger('strategy-market-analysis');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MARKET_DATA_DIR = path.join(__dirname, 'market-data');
const REPORTS_DIR = path.join(__dirname, 'industry-reports');
const STATS_FILE = path.join(MARKET_DATA_DIR, 'swiss-kmu-stats.json');

const QUARTERLY_SCHEDULE = '0 4 1 1,4,7,10 *'; // Quarterly: 1st of Jan/Apr/Jul/Oct at 04:00
const MONTHLY_SCHEDULE = '0 5 1 * *';           // Monthly: 1st at 05:00 (data refresh)
const TIMEZONE = 'Europe/Zurich';

const TRACKED_KEYWORDS = [
  'marketing automatisierung schweiz',
  'ki marketing kmu',
  'social media management tool',
  'seo optimierung kmu',
  'content marketing automation',
  'digitalisierung kmu schweiz',
  'ai marketing tools',
  'email marketing automation schweiz',
  'lead generation schweiz',
  'online marketing kmu',
];

const TRACKED_INDUSTRIES = [
  'services', 'retail', 'construction', 'hospitality',
  'health', 'manufacturing', 'it_telecom', 'finance_insurance', 'real_estate',
];

const TRACKED_CANTONS = [
  'ZH', 'BE', 'VD', 'AG', 'SG', 'LU', 'GE', 'TI', 'ZG', 'BS',
];

// ---------------------------------------------------------------------------
// Data Loading & Collection
// ---------------------------------------------------------------------------

/**
 * Load Swiss KMU statistics from the local data file.
 */
function loadSwissKMUStats() {
  try {
    if (!fs.existsSync(STATS_FILE)) {
      logger.warn('Swiss KMU stats file not found');
      return null;
    }
    const raw = fs.readFileSync(STATS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.error(`Failed to load Swiss KMU stats: ${err.message}`);
    return null;
  }
}

/**
 * Fetch market intelligence data from Airtable.
 */
async function fetchMarketIntelligence() {
  try {
    const records = await getRecords('MarketIntelligence', '', 100);
    logger.info(`Fetched ${records.length} market intelligence records`);
    return records;
  } catch (err) {
    logger.warn(`Could not fetch market intelligence: ${err.message}`);
    return [];
  }
}

/**
 * Fetch customer data to analyze current market penetration.
 */
async function fetchCustomerData() {
  try {
    const customers = await getRecords('Customers', '', 500);
    logger.info(`Fetched ${customers.length} customer records`);
    return customers;
  } catch (err) {
    logger.warn(`Could not fetch customer data: ${err.message}`);
    return [];
  }
}

/**
 * Fetch pipeline data for demand signals.
 */
async function fetchPipelineData() {
  try {
    const pipeline = await getRecords('Pipeline', '', 200);
    logger.info(`Fetched ${pipeline.length} pipeline records`);
    return pipeline;
  } catch (err) {
    logger.warn(`Could not fetch pipeline data: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Market Analysis Functions
// ---------------------------------------------------------------------------

/**
 * Calculate TAM/SAM/SOM for Werkpilot in Swiss KMU market.
 */
async function calculateTAMSAMSOM(kmuStats, customers, pipeline) {
  const prompt = `Calculate TAM (Total Addressable Market), SAM (Serviceable Addressable Market),
and SOM (Serviceable Obtainable Market) for Werkpilot, an AI marketing automation platform for Swiss KMUs.

SWISS KMU DATA:
${JSON.stringify(kmuStats, null, 2)}

CURRENT CUSTOMERS: ${customers.length}
PIPELINE SIZE: ${pipeline.length}

WERKPILOT PRICING: CHF 497-1997/month avg

Calculate and provide detailed market sizing:
{
  "TAM": {
    "totalKMUs": number,
    "potentialKMUs": number,
    "annualValueCHF": number,
    "assumptions": ["..."],
    "methodology": "..."
  },
  "SAM": {
    "targetableKMUs": number,
    "annualValueCHF": number,
    "targetSegments": ["..."],
    "assumptions": ["..."],
    "penetrationRate": number
  },
  "SOM": {
    "reachableKMUs": number,
    "year1Target": number,
    "year3Target": number,
    "year5Target": number,
    "annualValueCHF": number,
    "marketSharePercent": number,
    "assumptions": ["..."]
  },
  "marketSizeByBranche": [
    {
      "branche": "...",
      "totalKMUs": number,
      "targetableKMUs": number,
      "estimatedACV": number,
      "totalMarketValueCHF": number,
      "werkpilotPenetration": number,
      "growthPotential": "high|medium|low"
    }
  ],
  "keyInsights": ["..."],
  "growthStrategy": ["..."]
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a market sizing expert. Use bottom-up and top-down approaches. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 4000,
    });
  } catch (err) {
    logger.error(`TAM/SAM/SOM calculation failed: ${err.message}`);
    return null;
  }
}

/**
 * Track market growth trends over time.
 */
async function trackMarketGrowthTrends(historicalData) {
  const prompt = `Analyze market growth trends for Werkpilot based on historical market intelligence data.

HISTORICAL DATA (last 12 months):
${JSON.stringify(historicalData.slice(-12), null, 2)}

Provide a JSON response:
{
  "overallTrend": "accelerating|growing|stable|declining",
  "growthRate": number,
  "trendsBySegment": [
    {
      "segment": "...",
      "trend": "...",
      "growthRate": number,
      "drivers": ["..."],
      "forecast": "..."
    }
  ],
  "seasonalPatterns": {
    "strongMonths": ["..."],
    "weakMonths": ["..."],
    "explanation": "..."
  },
  "emergingOpportunities": ["..."],
  "threats": ["..."],
  "forecast": {
    "nextQuarter": "...",
    "nextYear": "...",
    "confidence": "high|medium|low"
  }
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a market trends analyst. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 3000,
    });
  } catch (err) {
    logger.error(`Growth trend tracking failed: ${err.message}`);
    return null;
  }
}

/**
 * Generate competitive positioning matrix.
 */
async function generateCompetitivePositioning(customers, competitors) {
  const prompt = `Create a competitive positioning matrix for Werkpilot in the Swiss AI marketing automation market.

WERKPILOT CUSTOMERS: ${customers.length}
Customer industries: ${JSON.stringify([...new Set(customers.map(c => c.Industry || c.Branche))].slice(0, 10))}

KNOWN COMPETITORS:
${JSON.stringify(competitors || ['HubSpot', 'Mailchimp', 'ActiveCampaign', 'Swiss local tools'], null, 2)}

Provide a JSON competitive positioning analysis:
{
  "positioningMatrix": {
    "axes": {
      "x": "Price (Low to High)",
      "y": "Features/Sophistication (Basic to Advanced)"
    },
    "werkpilot": {
      "x": number,
      "y": number,
      "quadrant": "...",
      "strengths": ["..."],
      "weaknesses": ["..."]
    },
    "competitors": [
      {
        "name": "...",
        "x": number,
        "y": number,
        "quadrant": "...",
        "marketShare": "...",
        "threat": "high|medium|low"
      }
    ]
  },
  "competitiveAdvantages": ["..."],
  "differentiators": ["..."],
  "vulnerabilities": ["..."],
  "strategicRecommendations": ["..."],
  "whiteSpace": ["..."]
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a competitive strategy consultant. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 3500,
    });
  } catch (err) {
    logger.error(`Competitive positioning failed: ${err.message}`);
    return null;
  }
}

/**
 * Analyze KMU market by industry sector.
 */
async function analyzeByIndustry(kmuStats, customers) {
  const industryData = kmuStats?.byIndustry || {};
  const customersByIndustry = {};

  for (const customer of customers) {
    const industry = customer.Industry || customer.Branche || 'unknown';
    customersByIndustry[industry] = (customersByIndustry[industry] || 0) + 1;
  }

  const prompt = `Analyze the Swiss KMU market by industry sector for Werkpilot (AI marketing automation platform).

INDUSTRY DATA:
${JSON.stringify(industryData, null, 2)}

WERKPILOT CUSTOMER DISTRIBUTION:
${JSON.stringify(customersByIndustry, null, 2)}

For each industry, provide:
{
  "industries": [
    {
      "key": "...",
      "name": "...",
      "totalKMUs": number,
      "werkpilotCustomers": number,
      "penetrationRate": number,
      "marketPotential": "high|medium|low",
      "digitalReadiness": number,
      "aiAdoptionRate": number,
      "avgMarketingBudget": number,
      "growthTrend": "accelerating|stable|declining",
      "opportunities": ["..."],
      "challenges": ["..."],
      "recommendedApproach": "...",
      "priorityScore": number
    }
  ],
  "topOpportunities": ["..."],
  "underservedSegments": ["..."]
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a Swiss market analyst. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 4000,
    });
  } catch (err) {
    logger.error(`Industry analysis failed: ${err.message}`);
    return null;
  }
}

/**
 * Analyze market by canton.
 */
async function analyzeByCanton(kmuStats, customers) {
  const cantonData = kmuStats?.byCanton || {};
  const customersByCanton = {};

  for (const customer of customers) {
    const canton = customer.Canton || customer.Kanton || 'unknown';
    customersByCanton[canton] = (customersByCanton[canton] || 0) + 1;
  }

  const prompt = `Analyze the Swiss KMU market by canton for Werkpilot.

CANTON DATA:
${JSON.stringify(cantonData, null, 2)}

WERKPILOT CUSTOMER DISTRIBUTION:
${JSON.stringify(customersByCanton, null, 2)}

Provide a JSON response:
{
  "cantons": [
    {
      "code": "...",
      "kmuCount": number,
      "werkpilotCustomers": number,
      "penetration": number,
      "digitalReadiness": number,
      "growthRate": number,
      "competitorPresence": "low|medium|high",
      "marketPotential": "high|medium|low",
      "priorityRank": number,
      "recommendedAction": "..."
    }
  ],
  "expansionPriorities": ["..."],
  "regionalStrategy": "..."
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a Swiss regional market analyst. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 3000,
    });
  } catch (err) {
    logger.error(`Canton analysis failed: ${err.message}`);
    return null;
  }
}

/**
 * Analyze digitalization and AI adoption trends.
 */
async function analyzeTrends(kmuStats) {
  const trendData = kmuStats?.trends || {};

  const prompt = `Analyze digitalization and AI adoption trends in the Swiss KMU market.

TREND DATA:
${JSON.stringify(trendData, null, 2)}

Provide a JSON response:
{
  "digitalizationTrends": {
    "currentRate": number,
    "trajectory": "accelerating|stable|decelerating",
    "topDrivers": ["..."],
    "topBarriers": ["..."],
    "forecast2027": number,
    "implicationsForWerkpilot": ["..."]
  },
  "aiAdoptionTrends": {
    "currentRate": number,
    "trajectory": "accelerating|stable|decelerating",
    "topUseCases": ["..."],
    "adoptionBySegment": { "early": ["..."], "mainstream": ["..."], "laggard": ["..."] },
    "investmentTrend": "increasing|stable|decreasing",
    "implicationsForWerkpilot": ["..."]
  },
  "marketingSpendTrends": {
    "digitalShareGrowth": number,
    "topChannels": ["..."],
    "emergingChannels": ["..."],
    "decliningChannels": ["..."],
    "budgetTrend": "increasing|stable|decreasing"
  },
  "keyInsights": ["..."],
  "strategicRecommendations": ["..."]
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a digital transformation analyst focused on Swiss SMBs. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 3500,
    });
  } catch (err) {
    logger.error(`Trend analysis failed: ${err.message}`);
    return null;
  }
}

/**
 * Analyze demand signals from pipeline and keyword data.
 */
async function analyzeDemandSignals(pipeline, kmuStats) {
  const seasonalData = kmuStats?.seasonalPatterns || {};
  const currentMonth = new Date().toLocaleString('en', { month: 'long' }).toLowerCase();

  const pipelineSummary = {
    total: pipeline.length,
    bySource: {},
    byStage: {},
    avgDealSize: 0,
  };

  let totalValue = 0;
  for (const deal of pipeline) {
    const source = deal.Source || deal.Quelle || 'unknown';
    const stage = deal.Stage || deal.Status || 'unknown';
    pipelineSummary.bySource[source] = (pipelineSummary.bySource[source] || 0) + 1;
    pipelineSummary.byStage[stage] = (pipelineSummary.byStage[stage] || 0) + 1;
    totalValue += parseFloat(deal.Value || deal.Wert || 0);
  }
  pipelineSummary.avgDealSize = pipeline.length > 0 ? Math.round(totalValue / pipeline.length) : 0;

  const prompt = `Analyze demand signals for Werkpilot's AI marketing automation platform.

CURRENT MONTH: ${currentMonth}

SEASONAL PATTERNS:
${JSON.stringify(seasonalData, null, 2)}

PIPELINE DATA:
${JSON.stringify(pipelineSummary, null, 2)}

TRACKED KEYWORDS: ${TRACKED_KEYWORDS.join(', ')}

Provide a JSON response:
{
  "currentDemandLevel": "very-high|high|medium|low|very-low",
  "seasonalContext": "...",
  "demandDrivers": ["..."],
  "leadSources": [
    { "source": "...", "volume": number, "trend": "increasing|stable|decreasing", "quality": "high|medium|low" }
  ],
  "keywordTrends": [
    { "keyword": "...", "trend": "rising|stable|falling", "competitiveness": "high|medium|low" }
  ],
  "emergingDemand": ["..."],
  "seasonalRecommendations": ["..."],
  "pipelineHealth": "strong|healthy|concerning|weak",
  "forecast": { "nextMonth": "...", "nextQuarter": "..." }
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a demand generation analyst. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 3000,
    });
  } catch (err) {
    logger.error(`Demand signal analysis failed: ${err.message}`);
    return null;
  }
}

/**
 * Monitor regulatory changes affecting Swiss KMUs.
 */
async function monitorRegulatoryChanges(kmuStats) {
  const knownChanges = kmuStats?.regulatoryChanges || [];

  const prompt = `Review and update regulatory changes affecting Swiss KMUs and marketing automation.

KNOWN REGULATORY CHANGES:
${JSON.stringify(knownChanges, null, 2)}

Provide a JSON response with any updates or new changes:
{
  "activeRegulations": [
    { "name": "...", "effectiveDate": "...", "impact": "...", "complianceStatus": "compliant|in-progress|action-needed" }
  ],
  "upcomingChanges": [
    { "name": "...", "expectedDate": "...", "impact": "...", "preparationNeeded": "..." }
  ],
  "riskAlerts": ["..."],
  "opportunities": ["..."],
  "recommendedActions": ["..."]
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a Swiss regulatory compliance expert. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 2500,
    });
  } catch (err) {
    logger.error(`Regulatory monitoring failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

/**
 * Compile the quarterly market intelligence briefing.
 */
async function compileQuarterlyBriefing(analyses) {
  const quarter = Math.floor(new Date().getMonth() / 3) + 1;
  const year = new Date().getFullYear();
  const periodLabel = `Q${quarter} ${year}`;

  const prompt = `Create a comprehensive quarterly market intelligence briefing for Werkpilot leadership.

PERIOD: ${periodLabel}

ANALYSIS DATA:
${JSON.stringify(analyses, null, 2)}

Write a Markdown report covering:
1. Executive Summary (3-5 key insights)
2. Market Size & Opportunity (TAM/SAM/SOM analysis)
3. Market Growth Trends (quarterly performance, forecasts)
4. Industry Analysis (top sectors, opportunities, threats)
5. Regional Analysis (canton-by-canton highlights)
6. Competitive Positioning Matrix
7. Digitalization & AI Trends
8. Demand Signals & Pipeline Health
9. Regulatory Updates
10. Strategic Recommendations (prioritized action items for next quarter)

Use tables, bullet points, and clear structure. Include specific numbers and data visualizations where appropriate.`;

  try {
    return await generateText(prompt, {
      system: 'You are a senior market intelligence analyst producing C-level briefings. Be data-driven, concise, and actionable.',
      model: config.models.standard,
      maxTokens: 6000,
      temperature: 0.4,
    });
  } catch (err) {
    logger.error(`Monthly briefing compilation failed: ${err.message}`);
    return null;
  }
}

/**
 * Save the quarterly briefing.
 */
function saveBriefing(report, analyses) {
  const dateStr = new Date().toISOString().split('T')[0];
  const quarter = Math.floor(new Date().getMonth() / 3) + 1;
  const year = new Date().getFullYear();

  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const reportPath = path.join(REPORTS_DIR, `market-intelligence-Q${quarter}-${year}.md`);
  fs.writeFileSync(reportPath, report, 'utf-8');

  const dataPath = path.join(REPORTS_DIR, `market-intelligence-Q${quarter}-${year}-data.json`);
  fs.writeFileSync(dataPath, JSON.stringify(analyses, null, 2), 'utf-8');

  logger.info(`Quarterly briefing saved: ${reportPath}`);
  return reportPath;
}

/**
 * Store key metrics in Airtable for trend tracking.
 */
async function storeMarketMetrics(analyses) {
  try {
    const quarter = Math.floor(new Date().getMonth() / 3) + 1;
    const year = new Date().getFullYear();

    const record = {
      Date: new Date().toISOString().split('T')[0],
      Period: `Q${quarter} ${year}`,
      DemandLevel: analyses.demandSignals?.currentDemandLevel || 'unknown',
      PipelineHealth: analyses.demandSignals?.pipelineHealth || 'unknown',
      DigitalizationRate: analyses.trends?.digitalizationTrends?.currentRate || 0,
      AIAdoptionRate: analyses.trends?.aiAdoptionTrends?.currentRate || 0,
      TAM_CHF: analyses.tamsamsom?.TAM?.annualValueCHF || 0,
      SAM_CHF: analyses.tamsamsom?.SAM?.annualValueCHF || 0,
      SOM_CHF: analyses.tamsamsom?.SOM?.annualValueCHF || 0,
      MarketGrowthRate: analyses.growthTrends?.growthRate || 0,
      TopIndustry: analyses.industryAnalysis?.topOpportunities?.[0] || 'unknown',
      Notes: analyses.trends?.keyInsights?.slice(0, 3).join('; ') || '',
    };

    await createRecord('MarketIntelligence', record);
    logger.info('Market metrics stored in Airtable');
  } catch (err) {
    logger.warn(`Could not store market metrics: ${err.message}`);
  }
}

/**
 * Sync market metrics to dashboard.
 */
async function syncMarketMetricsToDashboard(analyses) {
  try {
    const quarter = Math.floor(new Date().getMonth() / 3) + 1;
    const year = new Date().getFullYear();

    await dashboardSync.bulkSync({
      notifications: [
        {
          title: `Market Intelligence Q${quarter} ${year}`,
          message: `TAM: CHF ${(analyses.tamsamsom?.TAM?.annualValueCHF || 0).toLocaleString()}, Growth: ${analyses.growthTrends?.growthRate || 0}%, Top Industry: ${analyses.industryAnalysis?.topOpportunities?.[0] || 'N/A'}`,
          type: 'info',
          link: null,
        },
      ],
    });

    logger.info('Market metrics synced to dashboard');
  } catch (err) {
    logger.warn(`Could not sync market metrics to dashboard: ${err.message}`);
  }
}

/**
 * Convert markdown to HTML for email.
 */
function reportToHtml(markdown) {
  let html = markdown
    .replace(/^### (.+)$/gm, '<h3 style="color:#1a1a2e;margin-top:18px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#16213e;margin-top:22px;border-bottom:2px solid #0f3460;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="color:#0f3460;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;">$1</li>')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.every(c => /^[\s-:]+$/.test(c))) return '';
      const tds = cells.map(c => `<td style="padding:6px 10px;border:1px solid #ddd;">${c.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    })
    .replace(/\n\n/g, '</p><p style="margin:8px 0;">')
    .replace(/\n/g, '<br>');

  return `
    <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:900px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:24px 30px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">Quarterly Market Intelligence Briefing</h1>
        <p style="margin:5px 0 0;opacity:0.9;">Werkpilot Strategy Department - Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}</p>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        <p style="margin:8px 0;">${html}</p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Monthly Data Refresh
// ---------------------------------------------------------------------------

/**
 * Monthly data refresh (lighter than full quarterly analysis).
 */
async function monthlyDataRefresh() {
  logger.info('=== Monthly Market Data Refresh ===');

  try {
    const kmuStats = loadSwissKMUStats();
    const pipeline = await fetchPipelineData();

    // Quick demand signal check
    const demandSignals = await analyzeDemandSignals(pipeline, kmuStats);

    // Store weekly metrics
    if (demandSignals) {
      await storeMarketMetrics({ demandSignals });
    }

    logger.info('Monthly data refresh complete');
    return { success: true };
  } catch (err) {
    logger.error(`Monthly data refresh failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Main Execution
// ---------------------------------------------------------------------------

async function runQuarterlyMarketAnalysis() {
  const startTime = Date.now();
  logger.info('=== Starting Quarterly Market Analysis ===');

  try {
    // Phase 1: Collect data
    logger.info('Phase 1: Collecting data sources...');
    const kmuStats = loadSwissKMUStats();
    const [marketIntel, customers, pipeline] = await Promise.all([
      fetchMarketIntelligence(),
      fetchCustomerData(),
      fetchPipelineData(),
    ]);

    // Phase 2: Run core analyses
    logger.info('Phase 2: Running market analyses...');
    const [industryAnalysis, cantonAnalysis, trends, demandSignals, regulatory] = await Promise.all([
      analyzeByIndustry(kmuStats, customers),
      analyzeByCanton(kmuStats, customers),
      analyzeTrends(kmuStats),
      analyzeDemandSignals(pipeline, kmuStats),
      monitorRegulatoryChanges(kmuStats),
    ]);

    // Phase 3: Advanced analyses (TAM/SAM/SOM, growth trends, competitive positioning)
    logger.info('Phase 3: Running advanced analyses...');
    const [tamsamsom, growthTrends, competitivePositioning] = await Promise.all([
      calculateTAMSAMSOM(kmuStats, customers, pipeline),
      trackMarketGrowthTrends(marketIntel),
      generateCompetitivePositioning(customers, []),
    ]);

    const quarter = Math.floor(new Date().getMonth() / 3) + 1;
    const year = new Date().getFullYear();

    const analyses = {
      period: `Q${quarter} ${year}`,
      tamsamsom,
      growthTrends,
      competitivePositioning,
      industryAnalysis,
      cantonAnalysis,
      trends,
      demandSignals,
      regulatory,
      dataPoints: {
        totalCustomers: customers.length,
        pipelineSize: pipeline.length,
        historicalIntelRecords: marketIntel.length,
      },
    };

    // Phase 4: Compile and distribute briefing
    logger.info('Phase 4: Compiling quarterly briefing...');
    const briefing = await compileQuarterlyBriefing(analyses);

    if (!briefing) {
      throw new Error('Failed to compile quarterly briefing');
    }

    // Phase 5: Save and send
    logger.info('Phase 5: Saving and distributing...');
    const reportPath = saveBriefing(briefing, analyses);
    await storeMarketMetrics(analyses);
    await syncMarketMetricsToDashboard(analyses);

    const emailHtml = reportToHtml(briefing);
    await sendCEOEmail({
      subject: `Market Intelligence Briefing - Q${quarter} ${year}`,
      html: emailHtml,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Quarterly Market Analysis complete in ${elapsed}s ===`);

    return { success: true, reportPath, elapsed };
  } catch (err) {
    logger.error(`Quarterly Market Analysis failed: ${err.message}`, { stack: err.stack });

    try {
      await sendCEOEmail({
        subject: 'Market Analysis FEHLER',
        html: `<div style="padding:20px;background:#fff3f3;border-left:4px solid #e94560;">
          <h2>Market Analysis fehlgeschlagen</h2>
          <p><strong>Fehler:</strong> ${err.message}</p>
          <p><strong>Zeit:</strong> ${new Date().toLocaleString('de-CH')}</p>
        </div>`,
      });
    } catch (emailErr) {
      logger.error(`Could not send error notification: ${emailErr.message}`);
    }

    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function start() {
  logger.info(`Market Analyst Agent starting.`);
  logger.info(`  Quarterly report: ${QUARTERLY_SCHEDULE}`);
  logger.info(`  Monthly refresh:  ${MONTHLY_SCHEDULE}`);

  cron.schedule(QUARTERLY_SCHEDULE, () => {
    logger.info('Cron triggered: quarterly market analysis');
    runQuarterlyMarketAnalysis();
  }, { timezone: TIMEZONE });

  cron.schedule(MONTHLY_SCHEDULE, () => {
    logger.info('Cron triggered: monthly data refresh');
    monthlyDataRefresh();
  }, { timezone: TIMEZONE });

  logger.info('Market Analyst Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--now') || args.includes('-n')) {
    logger.info('Running quarterly market analysis immediately (manual trigger)');
    runQuarterlyMarketAnalysis().then((result) => {
      if (result.success) {
        logger.info(`Analysis complete. Report: ${result.reportPath}`);
      } else {
        logger.error(`Analysis failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else if (args.includes('--monthly') || args.includes('-m')) {
    logger.info('Running monthly data refresh immediately (manual trigger)');
    monthlyDataRefresh().then((result) => {
      if (result.success) {
        logger.info('Monthly refresh complete');
      } else {
        logger.error(`Refresh failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else {
    start();
  }
}

module.exports = { start, runQuarterlyMarketAnalysis, monthlyDataRefresh };
