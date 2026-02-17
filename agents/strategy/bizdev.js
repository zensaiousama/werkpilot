/**
 * Werkpilot Business Development Agent (Agent 33)
 *
 * Evaluates business models (white-label, API-as-a-service, vertical SaaS, franchise),
 * performs revenue modeling per model, identifies partnership opportunities with
 * complementary services, builds business cases with projected P&L,
 * and manages the innovation pipeline.
 *
 * Schedule: Bi-weekly on Monday at 07:00 (1st and 15th of month)
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('strategy-bizdev');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MODELS_DIR = path.join(__dirname, 'business-models');
const REPORTS_DIR = path.join(__dirname, 'industry-reports');

const SCHEDULE = '0 7 1,15 * *';  // Bi-weekly: 1st and 15th at 07:00
const TIMEZONE = 'Europe/Zurich';

const BUSINESS_MODEL_FILES = {
  'white-label': path.join(MODELS_DIR, 'white-label.json'),
  'api-service': path.join(MODELS_DIR, 'api-service.json'),
  'franchise': path.join(MODELS_DIR, 'franchise.json'),
};

// ---------------------------------------------------------------------------
// Data Loading
// ---------------------------------------------------------------------------

/**
 * Load business model configurations.
 */
function loadBusinessModels() {
  const models = {};
  for (const [key, filePath] of Object.entries(BUSINESS_MODEL_FILES)) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        models[key] = JSON.parse(raw);
        logger.info(`Loaded business model: ${key}`);
      } else {
        logger.warn(`Business model file not found: ${filePath}`);
      }
    } catch (err) {
      logger.error(`Failed to load business model ${key}: ${err.message}`);
    }
  }
  return models;
}

/**
 * Fetch business development pipeline from Airtable.
 */
async function fetchBizDevPipeline() {
  try {
    const records = await getRecords('BizDevPipeline', '', 100);
    logger.info(`Fetched ${records.length} bizdev pipeline records`);
    return records;
  } catch (err) {
    logger.warn(`Could not fetch bizdev pipeline: ${err.message}`);
    return [];
  }
}

/**
 * Fetch partnership opportunities from Airtable.
 */
async function fetchPartnerships() {
  try {
    const records = await getRecords('Partnerships', '', 100);
    logger.info(`Fetched ${records.length} partnership records`);
    return records;
  } catch (err) {
    logger.warn(`Could not fetch partnerships: ${err.message}`);
    return [];
  }
}

/**
 * Fetch current revenue data from Airtable.
 */
async function fetchRevenueData() {
  try {
    const records = await getRecords('Revenue', '', 50);
    logger.info(`Fetched ${records.length} revenue records`);
    return records;
  } catch (err) {
    logger.warn(`Could not fetch revenue data: ${err.message}`);
    return [];
  }
}

/**
 * Fetch innovation pipeline items.
 */
async function fetchInnovationPipeline() {
  try {
    const records = await getRecords('InnovationPipeline', '', 100);
    logger.info(`Fetched ${records.length} innovation pipeline items`);
    return records;
  } catch (err) {
    logger.warn(`Could not fetch innovation pipeline: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Business Model Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a business model against current business context.
 */
async function evaluateBusinessModel(modelData, revenueData, pipeline) {
  const currentMRR = revenueData.reduce((sum, r) => sum + parseFloat(r.MRR || r.mrr || 0), 0);
  const currentCustomers = revenueData.length;

  const prompt = `Evaluate the following business model for Werkpilot (Swiss AI marketing automation).

BUSINESS MODEL:
${JSON.stringify(modelData, null, 2)}

CURRENT BUSINESS STATE:
- Current MRR: CHF ${currentMRR.toLocaleString()}
- Current customers: ${currentCustomers}
- Model: SaaS direct-to-KMU

PIPELINE STATUS:
${JSON.stringify(pipeline.slice(0, 10), null, 2)}

Provide a thorough evaluation in JSON:
{
  "model": "...",
  "overallScore": number,
  "feasibility": {
    "score": number,
    "assessment": "...",
    "prerequisites": ["..."],
    "timeline": "..."
  },
  "financialAttractiveness": {
    "score": number,
    "revenueImpact": "...",
    "marginProfile": "...",
    "capitalRequirement": number,
    "paybackPeriod": "...",
    "ltv": number,
    "cac": number
  },
  "strategicFit": {
    "score": number,
    "alignment": "...",
    "synergiesWithCore": ["..."],
    "conflictsWithCore": ["..."]
  },
  "marketReadiness": {
    "score": number,
    "demandSignals": ["..."],
    "competitorActivity": "...",
    "timingAssessment": "..."
  },
  "risks": [
    { "risk": "...", "severity": "high|medium|low", "mitigation": "..." }
  ],
  "recommendation": "pursue-immediately|plan-for-next-quarter|explore-further|deprioritize",
  "rationale": "...",
  "nextSteps": ["..."]
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a business strategy consultant specializing in SaaS business model innovation. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 4000,
    });
  } catch (err) {
    logger.error(`Business model evaluation failed for ${modelData.model}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Revenue Modeling
// ---------------------------------------------------------------------------

/**
 * Build revenue model for a specific business model.
 */
async function buildRevenueModel(modelData, revenueData) {
  const currentMRR = revenueData.reduce((sum, r) => sum + parseFloat(r.MRR || r.mrr || 0), 0);

  const prompt = `Build a detailed 3-year revenue model for the following Werkpilot business model.

BUSINESS MODEL:
${JSON.stringify(modelData, null, 2)}

CURRENT REVENUE BASE:
- Current MRR: CHF ${currentMRR.toLocaleString()}
- Current customer count: ${revenueData.length}

Build a month-by-month model for Year 1 and quarterly for Years 2-3.

Provide a JSON response:
{
  "model": "...",
  "currency": "CHF",
  "assumptions": {
    "customerGrowth": "...",
    "churnRate": number,
    "avgRevenuePerCustomer": number,
    "expansionRate": number,
    "salesCycleMonths": number,
    "rampUpMonths": number
  },
  "year1": {
    "months": [
      { "month": 1, "newCustomers": number, "totalCustomers": number, "mrr": number, "costs": number, "profit": number }
    ],
    "totalRevenue": number,
    "totalCosts": number,
    "netIncome": number,
    "endMRR": number,
    "endCustomers": number
  },
  "year2": {
    "quarters": [
      { "quarter": "Q1", "newCustomers": number, "totalCustomers": number, "quarterlyRevenue": number, "costs": number, "profit": number }
    ],
    "totalRevenue": number,
    "totalCosts": number,
    "netIncome": number
  },
  "year3": {
    "quarters": [
      { "quarter": "Q1", "newCustomers": number, "totalCustomers": number, "quarterlyRevenue": number, "costs": number, "profit": number }
    ],
    "totalRevenue": number,
    "totalCosts": number,
    "netIncome": number
  },
  "projectedPL": {
    "year1": { "revenue": number, "cogs": number, "grossProfit": number, "opex": number, "ebitda": number, "netIncome": number },
    "year2": { "revenue": number, "cogs": number, "grossProfit": number, "opex": number, "ebitda": number, "netIncome": number },
    "year3": { "revenue": number, "cogs": number, "grossProfit": number, "opex": number, "ebitda": number, "netIncome": number }
  },
  "breakEvenMonth": number,
  "irr": number,
  "npv": number,
  "keyMetrics": {
    "cac": number,
    "ltv": number,
    "ltvCacRatio": number,
    "grossMargin": number,
    "netMargin": number,
    "revenuePerEmployee": number
  }
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a financial modeler. Build conservative, realistic models. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 5000,
    });
  } catch (err) {
    logger.error(`Revenue modeling failed for ${modelData.model}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Partnership Analysis
// ---------------------------------------------------------------------------

/**
 * Identify and evaluate partnership opportunities.
 */
async function analyzePartnerships(currentPartnerships, revenueData) {
  const prompt = `Identify and evaluate partnership opportunities for Werkpilot (Swiss AI marketing automation platform).

CURRENT PARTNERSHIPS:
${JSON.stringify(currentPartnerships, null, 2)}

CURRENT REVENUE STATE:
- Customer count: ${revenueData.length}
- Estimated MRR: CHF ${revenueData.reduce((sum, r) => sum + parseFloat(r.MRR || r.mrr || 0), 0).toLocaleString()}

WERKPILOT CAPABILITIES:
- AI content generation (multilingual DE/FR/IT/EN)
- Marketing automation (email, social, ads)
- SEO optimization
- Analytics and reporting
- Lead generation and scoring
- CRM integration

Identify complementary service providers in the Swiss market that could benefit from a partnership.

Provide a JSON response:
{
  "partnershipCategories": [
    {
      "category": "...",
      "rationale": "...",
      "potentialPartners": [
        {
          "type": "...",
          "examples": ["..."],
          "partnershipModel": "referral|integration|co-sell|reseller|technology",
          "revenueImpact": number,
          "effort": "low|medium|high",
          "priority": "high|medium|low",
          "nextSteps": ["..."]
        }
      ]
    }
  ],
  "topOpportunities": [
    {
      "partner": "...",
      "model": "...",
      "estimatedAnnualRevenue": number,
      "timeToRevenue": "...",
      "investmentRequired": number,
      "roi": number
    }
  ],
  "currentPartnershipHealth": {
    "active": number,
    "needsAttention": number,
    "recommendations": ["..."]
  },
  "strategicRecommendation": "..."
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a business development strategist focusing on the Swiss tech market. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 4000,
    });
  } catch (err) {
    logger.error(`Partnership analysis failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Business Case Builder
// ---------------------------------------------------------------------------

/**
 * Build a comprehensive business case for a specific opportunity.
 */
async function buildBusinessCase(opportunity, modelEvaluation, revenueModel) {
  const prompt = `Build a comprehensive business case for the following Werkpilot business opportunity.

OPPORTUNITY:
${JSON.stringify(opportunity, null, 2)}

MODEL EVALUATION:
${JSON.stringify(modelEvaluation, null, 2)}

REVENUE MODEL:
${JSON.stringify(revenueModel?.projectedPL || {}, null, 2)}

Create a board-ready business case in JSON:
{
  "title": "...",
  "executiveSummary": "...",
  "problemStatement": "...",
  "proposedSolution": "...",
  "marketOpportunity": {
    "size": number,
    "growth": number,
    "werkpilotShare": number
  },
  "financialProjection": {
    "investmentRequired": number,
    "year1Revenue": number,
    "year1Costs": number,
    "year1Profit": number,
    "year3Revenue": number,
    "year3Profit": number,
    "breakEvenMonth": number,
    "irr": number,
    "npv": number,
    "paybackPeriod": "..."
  },
  "projectedPL": {
    "year1": { "revenue": number, "directCosts": number, "grossProfit": number, "overhead": number, "netProfit": number, "margin": number },
    "year2": { "revenue": number, "directCosts": number, "grossProfit": number, "overhead": number, "netProfit": number, "margin": number },
    "year3": { "revenue": number, "directCosts": number, "grossProfit": number, "overhead": number, "netProfit": number, "margin": number }
  },
  "implementationPlan": [
    { "phase": "...", "duration": "...", "activities": ["..."], "cost": number, "milestone": "..." }
  ],
  "riskAnalysis": [
    { "risk": "...", "probability": "high|medium|low", "impact": "high|medium|low", "mitigation": "..." }
  ],
  "successCriteria": ["..."],
  "decision": "approve|conditional-approve|further-study|reject",
  "decisionRationale": "...",
  "resourceRequirements": {
    "team": ["..."],
    "technology": ["..."],
    "budget": number,
    "timeline": "..."
  }
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a business case specialist. Create concise, data-driven business cases. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 4000,
    });
  } catch (err) {
    logger.error(`Business case generation failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Innovation Pipeline Management
// ---------------------------------------------------------------------------

/**
 * Review and score innovation pipeline items.
 */
async function reviewInnovationPipeline(pipelineItems) {
  if (pipelineItems.length === 0) {
    logger.info('No innovation pipeline items to review');
    return null;
  }

  const prompt = `Review and score the following innovation pipeline items for Werkpilot.

PIPELINE ITEMS:
${JSON.stringify(pipelineItems, null, 2)}

For each item, provide an assessment. Also suggest new ideas.

Provide a JSON response:
{
  "pipelineReview": [
    {
      "id": "...",
      "name": "...",
      "innovationScore": number,
      "feasibility": number,
      "marketImpact": number,
      "strategicFit": number,
      "overallPriority": number,
      "stage": "idea|validation|prototype|pilot|scale",
      "recommendedAction": "accelerate|continue|pivot|pause|kill",
      "rationale": "...",
      "nextMilestone": "...",
      "resourceNeeds": "..."
    }
  ],
  "newIdeas": [
    {
      "idea": "...",
      "category": "...",
      "estimatedImpact": "high|medium|low",
      "estimatedEffort": "high|medium|low",
      "rationale": "..."
    }
  ],
  "pipelineHealth": {
    "totalItems": number,
    "byStage": { "idea": number, "validation": number, "prototype": number, "pilot": number, "scale": number },
    "avgScore": number,
    "recommendations": ["..."]
  }
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are an innovation manager. Score objectively and recommend decisively. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 4000,
    });
  } catch (err) {
    logger.error(`Innovation pipeline review failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

/**
 * Compile the bi-weekly business development report.
 */
async function compileBizDevReport(results) {
  const prompt = `Create a business development report for Werkpilot leadership.

ANALYSIS RESULTS:
${JSON.stringify(results, null, 2)}

Write a Markdown report covering:
1. Executive Summary (top 3-5 priorities)
2. Business Model Evaluations (comparative analysis)
3. Revenue Model Comparison (side-by-side projections)
4. Partnership Landscape
5. Business Cases Ready for Decision
6. Innovation Pipeline Status
7. Investment Requirements Summary
8. Priority Matrix (impact vs effort)
9. Recommended Actions (with owners and timelines)
10. Strategic Outlook

Include tables for comparisons. Be specific with numbers and timelines.`;

  try {
    return await generateText(prompt, {
      system: 'You are a senior business development advisor. Be strategic, data-driven, and actionable.',
      model: config.models.standard,
      maxTokens: 6000,
      temperature: 0.4,
    });
  } catch (err) {
    logger.error(`BizDev report compilation failed: ${err.message}`);
    return null;
  }
}

/**
 * Save the bizdev report.
 */
function saveReport(report, results) {
  const dateStr = new Date().toISOString().split('T')[0];
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const reportPath = path.join(REPORTS_DIR, `bizdev-report-${dateStr}.md`);
  fs.writeFileSync(reportPath, report, 'utf-8');

  const dataPath = path.join(REPORTS_DIR, `bizdev-data-${dateStr}.json`);
  fs.writeFileSync(dataPath, JSON.stringify(results, null, 2), 'utf-8');

  logger.info(`BizDev report saved: ${reportPath}`);
  return reportPath;
}

/**
 * Convert report to HTML for email.
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
        <h1 style="margin:0;font-size:22px;">Business Development Report</h1>
        <p style="margin:5px 0 0;opacity:0.9;">Werkpilot Strategy Department</p>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        <p style="margin:8px 0;">${html}</p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Main Execution
// ---------------------------------------------------------------------------

async function runBizDevAnalysis() {
  const startTime = Date.now();
  logger.info('=== Starting Business Development Analysis ===');

  try {
    // Phase 1: Load all data
    logger.info('Phase 1: Loading data sources...');
    const businessModels = loadBusinessModels();
    const [bizdevPipeline, partnerships, revenueData, innovationPipeline] = await Promise.all([
      fetchBizDevPipeline(),
      fetchPartnerships(),
      fetchRevenueData(),
      fetchInnovationPipeline(),
    ]);

    // Phase 2: Evaluate each business model
    logger.info('Phase 2: Evaluating business models...');
    const modelEvaluations = {};
    const revenueModels = {};

    for (const [key, modelData] of Object.entries(businessModels)) {
      logger.info(`Evaluating model: ${modelData.model}...`);
      const evaluation = await evaluateBusinessModel(modelData, revenueData, bizdevPipeline);
      modelEvaluations[key] = evaluation;

      if (evaluation && evaluation.recommendation !== 'deprioritize') {
        logger.info(`Building revenue model for: ${modelData.model}...`);
        const revenueModel = await buildRevenueModel(modelData, revenueData);
        revenueModels[key] = revenueModel;
      }
    }

    // Phase 3: Partnership analysis
    logger.info('Phase 3: Analyzing partnerships...');
    const partnershipAnalysis = await analyzePartnerships(partnerships, revenueData);

    // Phase 4: Build business cases for top opportunities
    logger.info('Phase 4: Building business cases...');
    const businessCases = {};
    for (const [key, evaluation] of Object.entries(modelEvaluations)) {
      if (evaluation && (evaluation.recommendation === 'pursue-immediately' || evaluation.recommendation === 'plan-for-next-quarter')) {
        logger.info(`Building business case for: ${key}...`);
        const businessCase = await buildBusinessCase(
          businessModels[key],
          evaluation,
          revenueModels[key]
        );
        businessCases[key] = businessCase;
      }
    }

    // Phase 5: Review innovation pipeline
    logger.info('Phase 5: Reviewing innovation pipeline...');
    const innovationReview = await reviewInnovationPipeline(innovationPipeline);

    // Phase 6: Compile results
    const results = {
      date: new Date().toISOString().split('T')[0],
      modelEvaluations,
      revenueModels,
      partnershipAnalysis,
      businessCases,
      innovationReview,
      summary: {
        modelsEvaluated: Object.keys(modelEvaluations).length,
        revenueModelsBuilt: Object.keys(revenueModels).length,
        businessCasesReady: Object.keys(businessCases).length,
        innovationItems: innovationPipeline.length,
        partnershipsAnalyzed: partnerships.length,
      },
    };

    // Phase 7: Generate and distribute report
    logger.info('Phase 6: Compiling report...');
    const report = await compileBizDevReport(results);

    if (!report) {
      throw new Error('Failed to compile bizdev report');
    }

    const reportPath = saveReport(report, results);
    const emailHtml = reportToHtml(report);

    await sendCEOEmail({
      subject: `Business Development Report - ${new Date().toLocaleDateString('de-CH')}`,
      html: emailHtml,
    });

    // Store summary in Airtable
    try {
      await createRecord('BizDevReports', {
        Date: new Date().toISOString().split('T')[0],
        ModelsEvaluated: results.summary.modelsEvaluated,
        BusinessCasesReady: results.summary.businessCasesReady,
        TopRecommendation: Object.entries(modelEvaluations)
          .filter(([, ev]) => ev?.recommendation === 'pursue-immediately')
          .map(([key]) => key)
          .join(', ') || 'None immediate',
        Status: 'completed',
      });
    } catch (storeErr) {
      logger.warn(`Could not store report summary: ${storeErr.message}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Business Development Analysis complete in ${elapsed}s ===`);

    return {
      success: true,
      reportPath,
      summary: results.summary,
      elapsed,
    };
  } catch (err) {
    logger.error(`Business Development Analysis failed: ${err.message}`, { stack: err.stack });

    try {
      await sendCEOEmail({
        subject: 'BizDev Analysis FEHLER',
        html: `<div style="padding:20px;background:#fff3f3;border-left:4px solid #e94560;">
          <h2>BizDev Analysis fehlgeschlagen</h2>
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
  logger.info(`Business Development Agent starting. Schedule: ${SCHEDULE}`);

  cron.schedule(SCHEDULE, () => {
    logger.info('Cron triggered: bi-weekly bizdev analysis');
    runBizDevAnalysis();
  }, { timezone: TIMEZONE });

  logger.info('Business Development Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--now') || args.includes('-n')) {
    logger.info('Running bizdev analysis immediately (manual trigger)');
    runBizDevAnalysis().then((result) => {
      if (result.success) {
        logger.info(`Analysis complete. Report: ${result.reportPath}`);
        logger.info(`Summary: ${JSON.stringify(result.summary)}`);
      } else {
        logger.error(`Analysis failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else {
    start();
  }
}

module.exports = { start, runBizDevAnalysis };
