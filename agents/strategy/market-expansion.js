/**
 * Werkpilot Market Expansion Agent (Agent 29)
 *
 * Analyzes new market potential across DACH, BeNeLux, and France.
 * Evaluates market sizing (TAM/SAM/SOM), competitive landscapes,
 * regulatory requirements, localization needs, and generates
 * go-to-market strategy proposals with quarterly reporting.
 *
 * Schedule: Quarterly (1st day of Jan, Apr, Jul, Oct at 05:00)
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('strategy-market-expansion');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MARKETS_DIR = path.join(__dirname, 'markets');
const TARGET_MARKETS = ['DACH', 'BeNeLux', 'France'];
const MARKET_FILES = {
  switzerland: path.join(MARKETS_DIR, 'switzerland.json'),
  germany: path.join(MARKETS_DIR, 'germany.json'),
  austria: path.join(MARKETS_DIR, 'austria.json'),
};

const SCHEDULE = '0 5 1 1,4,7,10 *'; // Quarterly: 1st of Jan, Apr, Jul, Oct at 05:00
const TIMEZONE = 'Europe/Zurich';

// ---------------------------------------------------------------------------
// Market Data Helpers
// ---------------------------------------------------------------------------

/**
 * Load market data from local JSON files.
 */
function loadMarketData() {
  const markets = {};
  for (const [key, filePath] of Object.entries(MARKET_FILES)) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        markets[key] = JSON.parse(raw);
        logger.info(`Loaded market data for ${key}`);
      } else {
        logger.warn(`Market data file not found: ${filePath}`);
        markets[key] = null;
      }
    } catch (err) {
      logger.error(`Failed to load market data for ${key}: ${err.message}`);
      markets[key] = null;
    }
  }
  return markets;
}

/**
 * Fetch current expansion metrics from Airtable.
 */
async function fetchExpansionMetrics() {
  try {
    const records = await getRecords('MarketExpansion', '', 100);
    logger.info(`Fetched ${records.length} expansion records from Airtable`);
    return records;
  } catch (err) {
    logger.warn(`Could not fetch expansion metrics: ${err.message}`);
    return [];
  }
}

/**
 * Fetch current customer distribution by market.
 */
async function fetchCustomerDistribution() {
  try {
    const customers = await getRecords('Customers', '', 500);
    const distribution = {};
    for (const customer of customers) {
      const country = customer.Country || customer.Land || 'CH';
      distribution[country] = (distribution[country] || 0) + 1;
    }
    logger.info(`Customer distribution: ${JSON.stringify(distribution)}`);
    return distribution;
  } catch (err) {
    logger.warn(`Could not fetch customer distribution: ${err.message}`);
    return { CH: 0 };
  }
}

// ---------------------------------------------------------------------------
// Market Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze TAM/SAM/SOM for a given market.
 */
async function analyzeMarketSizing(marketData, currentMetrics) {
  const prompt = `You are a market analyst specializing in Swiss tech expansion into European markets.

Analyze the following market data and provide an updated TAM/SAM/SOM assessment:

MARKET DATA:
${JSON.stringify(marketData, null, 2)}

CURRENT EXPANSION METRICS:
${JSON.stringify(currentMetrics, null, 2)}

Provide a JSON response with:
{
  "country": "...",
  "tam": { "value": number, "currency": "...", "methodology": "...", "confidence": "high|medium|low" },
  "sam": { "value": number, "currency": "...", "methodology": "...", "confidence": "high|medium|low" },
  "som": { "value": number, "currency": "...", "methodology": "...", "confidence": "high|medium|low", "timeframe": "..." },
  "growthRate": number,
  "keyDrivers": ["..."],
  "keyRisks": ["..."],
  "marketReadiness": "ready|emerging|early|not-ready",
  "recommendedEntry": "immediate|6-months|12-months|24-months|not-recommended"
}`;

  try {
    const analysis = await generateJSON(prompt, {
      system: 'You are a senior market analyst. Respond only with valid JSON. Be precise with numbers and realistic with assessments.',
      model: config.models.standard,
      maxTokens: 3000,
    });
    return analysis;
  } catch (err) {
    logger.error(`Market sizing analysis failed: ${err.message}`);
    return null;
  }
}

/**
 * Analyze competitive landscape for a target market.
 */
async function analyzeCompetitiveLandscape(marketData) {
  const prompt = `Analyze the competitive landscape for AI marketing automation in ${marketData.country}.

MARKET DATA:
${JSON.stringify(marketData.competitiveLandscape || {}, null, 2)}

KEY INDUSTRIES:
${JSON.stringify(marketData.industries || marketData.byIndustry || {}, null, 2)}

Provide a JSON response with:
{
  "marketMaturity": "nascent|early|growing|mature|saturated",
  "competitorCount": number,
  "topCompetitors": [
    { "name": "...", "marketShare": number, "strengths": ["..."], "weaknesses": ["..."], "pricing": "..." }
  ],
  "entryBarriers": {
    "overall": "low|medium|high",
    "regulatory": "low|medium|high",
    "brand": "low|medium|high",
    "technology": "low|medium|high",
    "network": "low|medium|high"
  },
  "werkpilotAdvantages": ["..."],
  "werkpilotChallenges": ["..."],
  "differentiationStrategy": "..."
}`;

  try {
    const landscape = await generateJSON(prompt, {
      system: 'You are a competitive intelligence analyst. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 3000,
    });
    return landscape;
  } catch (err) {
    logger.error(`Competitive landscape analysis failed for ${marketData.country}: ${err.message}`);
    return null;
  }
}

/**
 * Assess regulatory requirements for market entry.
 */
async function assessRegulatoryRequirements(marketData) {
  const prompt = `Assess the regulatory requirements for a Swiss AI marketing automation company entering the ${marketData.country} market.

KNOWN REGULATORY FRAMEWORK:
${JSON.stringify(marketData.regulatory || {}, null, 2)}

EXPANSION REQUIREMENTS:
${JSON.stringify(marketData.expansionRequirements || {}, null, 2)}

Provide a JSON response with:
{
  "dataProtection": { "law": "...", "requirements": ["..."], "complianceCost": number, "timeline": "..." },
  "businessRegistration": { "form": "...", "process": ["..."], "cost": number, "timeline": "..." },
  "taxObligations": { "vatRate": number, "corporateTax": "...", "withholding": "...", "doubleTaxTreaty": boolean },
  "industrySpecific": ["..."],
  "localPresenceRequired": boolean,
  "estimatedComplianceBudget": number,
  "currency": "...",
  "criticalDeadlines": ["..."],
  "riskLevel": "low|medium|high"
}`;

  try {
    const regulatory = await generateJSON(prompt, {
      system: 'You are a regulatory compliance expert specializing in European tech expansion. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 3000,
    });
    return regulatory;
  } catch (err) {
    logger.error(`Regulatory assessment failed for ${marketData.country}: ${err.message}`);
    return null;
  }
}

/**
 * Evaluate localization needs for a market.
 */
async function evaluateLocalizationNeeds(marketData) {
  const prompt = `Evaluate the localization needs for Werkpilot (Swiss AI marketing automation platform) entering the ${marketData.country} market.

LOCALIZATION DATA:
${JSON.stringify(marketData.localization || {}, null, 2)}

Provide a JSON response with:
{
  "languages": [{ "code": "...", "priority": "critical|high|medium|low", "coverage": "full|partial|basic" }],
  "contentLocalization": {
    "website": { "effort": "high|medium|low", "estimatedCost": number },
    "app": { "effort": "high|medium|low", "estimatedCost": number },
    "documentation": { "effort": "high|medium|low", "estimatedCost": number },
    "marketing": { "effort": "high|medium|low", "estimatedCost": number }
  },
  "culturalAdaptations": ["..."],
  "paymentMethods": ["..."],
  "localPartnerNeeds": ["..."],
  "totalEstimatedCost": number,
  "currency": "CHF",
  "timelineWeeks": number
}`;

  try {
    const localization = await generateJSON(prompt, {
      system: 'You are a localization strategist. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 2500,
    });
    return localization;
  } catch (err) {
    logger.error(`Localization evaluation failed for ${marketData.country}: ${err.message}`);
    return null;
  }
}

/**
 * Generate a go-to-market strategy proposal.
 */
async function generateGTMStrategy(marketData, sizing, landscape, regulatory, localization) {
  const prompt = `Create a comprehensive go-to-market strategy for Werkpilot expanding into ${marketData.country}.

CONTEXT:
- Werkpilot is a Swiss AI marketing automation platform for KMUs
- Currently serving Swiss market with proven product-market fit
- Revenue model: SaaS subscription CHF 499-4999/month

MARKET SIZING:
${JSON.stringify(sizing, null, 2)}

COMPETITIVE LANDSCAPE:
${JSON.stringify(landscape, null, 2)}

REGULATORY:
${JSON.stringify(regulatory, null, 2)}

LOCALIZATION:
${JSON.stringify(localization, null, 2)}

Provide a JSON response with a detailed GTM strategy:
{
  "strategy": "direct|partner-led|hybrid|digital-first",
  "phases": [
    {
      "phase": 1,
      "name": "...",
      "duration": "...",
      "objectives": ["..."],
      "activities": ["..."],
      "kpis": [{ "metric": "...", "target": "..." }],
      "budget": number,
      "resources": ["..."]
    }
  ],
  "totalBudget": number,
  "expectedROI": number,
  "breakEvenMonths": number,
  "risks": [{ "risk": "...", "mitigation": "..." }],
  "quickWins": ["..."],
  "recommendation": "go|conditional-go|wait|no-go",
  "recommendationRationale": "..."
}`;

  try {
    const gtm = await generateJSON(prompt, {
      system: 'You are a GTM strategist with deep experience in European tech market expansion. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 4000,
    });
    return gtm;
  } catch (err) {
    logger.error(`GTM strategy generation failed for ${marketData.country}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

/**
 * Compile the quarterly expansion report.
 */
async function compileQuarterlyReport(analyses) {
  const prompt = `Create an executive quarterly market expansion report for Werkpilot leadership.

MARKET ANALYSES:
${JSON.stringify(analyses, null, 2)}

Write a comprehensive report in Markdown format covering:
1. Executive Summary (3-5 key points)
2. Market-by-Market Analysis (TAM/SAM/SOM, competitive position, readiness)
3. Regulatory Compliance Status
4. Localization Progress
5. GTM Strategy Recommendations
6. Investment Requirements Summary
7. Priority Ranking of Markets
8. Recommended Next Steps (with timeline and budget)
9. Key Risks and Mitigations

Use tables where appropriate. Be specific with numbers, timelines, and budgets.
Report should be in English with German terms where industry-appropriate.`;

  try {
    const report = await generateText(prompt, {
      system: 'You are a senior strategy consultant producing C-level market expansion reports. Be thorough, data-driven, and action-oriented.',
      model: config.models.standard,
      maxTokens: 6000,
      temperature: 0.4,
    });
    return report;
  } catch (err) {
    logger.error(`Quarterly report compilation failed: ${err.message}`);
    return null;
  }
}

/**
 * Save the quarterly report to disk.
 */
function saveReport(report, analyses) {
  const quarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
  const year = new Date().getFullYear();
  const reportDir = path.join(__dirname, 'industry-reports');
  fs.mkdirSync(reportDir, { recursive: true });

  const reportPath = path.join(reportDir, `market-expansion-${year}-${quarter}.md`);
  fs.writeFileSync(reportPath, report, 'utf-8');

  const dataPath = path.join(reportDir, `market-expansion-${year}-${quarter}-data.json`);
  fs.writeFileSync(dataPath, JSON.stringify(analyses, null, 2), 'utf-8');

  logger.info(`Reports saved: ${reportPath}, ${dataPath}`);
  return reportPath;
}

/**
 * Convert markdown report to HTML for email.
 */
function reportToHtml(markdown) {
  let html = markdown
    .replace(/^### (.+)$/gm, '<h3 style="color:#1a1a2e;margin-top:18px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#16213e;margin-top:22px;border-bottom:2px solid #0f3460;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="color:#0f3460;margin-top:26px;">$1</h1>')
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
        <h1 style="margin:0;font-size:22px;">Market Expansion Quarterly Report</h1>
        <p style="margin:5px 0 0;opacity:0.9;">Werkpilot Strategy Department</p>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        <p style="margin:8px 0;">${html}</p>
      </div>
    </div>`;
}

/**
 * Store expansion analysis results in Airtable.
 */
async function storeAnalysisResults(country, analysis) {
  try {
    await createRecord('MarketExpansion', {
      Country: country,
      Date: new Date().toISOString().split('T')[0],
      TAM: analysis.sizing?.tam?.value || 0,
      SAM: analysis.sizing?.sam?.value || 0,
      SOM: analysis.sizing?.som?.value || 0,
      MarketReadiness: analysis.sizing?.marketReadiness || 'unknown',
      Recommendation: analysis.gtm?.recommendation || 'unknown',
      Status: 'analyzed',
    });
    logger.info(`Stored analysis results for ${country} in Airtable`);
  } catch (err) {
    logger.warn(`Could not store results for ${country}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main Execution
// ---------------------------------------------------------------------------

async function runMarketExpansionAnalysis() {
  const startTime = Date.now();
  logger.info('=== Starting Market Expansion Analysis ===');

  try {
    // Phase 1: Load data sources
    logger.info('Phase 1: Loading market data and current metrics...');
    const marketData = loadMarketData();
    const [expansionMetrics, customerDistribution] = await Promise.all([
      fetchExpansionMetrics(),
      fetchCustomerDistribution(),
    ]);

    // Phase 2: Analyze each market
    logger.info('Phase 2: Analyzing individual markets...');
    const analyses = {};

    for (const [key, data] of Object.entries(marketData)) {
      if (!data) {
        logger.warn(`Skipping ${key}: no data available`);
        continue;
      }

      logger.info(`Analyzing market: ${data.country}...`);

      const [sizing, landscape, regulatory, localization] = await Promise.all([
        analyzeMarketSizing(data, expansionMetrics),
        analyzeCompetitiveLandscape(data),
        assessRegulatoryRequirements(data),
        evaluateLocalizationNeeds(data),
      ]);

      const gtm = await generateGTMStrategy(data, sizing, landscape, regulatory, localization);

      analyses[key] = {
        country: data.country,
        code: data.code,
        sizing,
        landscape,
        regulatory,
        localization,
        gtm,
        customerDistribution: customerDistribution[data.code] || 0,
      };

      // Store in Airtable
      await storeAnalysisResults(data.country, analyses[key]);
    }

    // Phase 3: Compile quarterly report
    logger.info('Phase 3: Compiling quarterly report...');
    const report = await compileQuarterlyReport(analyses);

    if (!report) {
      throw new Error('Failed to compile quarterly report');
    }

    // Phase 4: Save and distribute
    logger.info('Phase 4: Saving and distributing report...');
    const reportPath = saveReport(report, analyses);
    const emailHtml = reportToHtml(report);

    const quarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`;
    await sendCEOEmail({
      subject: `Market Expansion Report ${quarter}`,
      html: emailHtml,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Market Expansion Analysis complete in ${elapsed}s ===`);

    return {
      success: true,
      reportPath,
      marketsAnalyzed: Object.keys(analyses).length,
      elapsed,
    };
  } catch (err) {
    logger.error(`Market Expansion Analysis failed: ${err.message}`, { stack: err.stack });

    try {
      await sendCEOEmail({
        subject: 'Market Expansion Analysis FEHLER',
        html: `<div style="padding:20px;background:#fff3f3;border-left:4px solid #e94560;">
          <h2>Market Expansion Analysis fehlgeschlagen</h2>
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
  logger.info(`Market Expansion Agent starting. Schedule: ${SCHEDULE}`);

  cron.schedule(SCHEDULE, () => {
    logger.info('Cron triggered: quarterly market expansion analysis');
    runMarketExpansionAnalysis();
  }, { timezone: TIMEZONE });

  logger.info('Market Expansion Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--now') || args.includes('-n')) {
    logger.info('Running market expansion analysis immediately (manual trigger)');
    runMarketExpansionAnalysis().then((result) => {
      if (result.success) {
        logger.info(`Analysis complete: ${result.marketsAnalyzed} markets analyzed`);
      } else {
        logger.error(`Analysis failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else {
    start();
  }
}

module.exports = { start, runMarketExpansionAnalysis };
