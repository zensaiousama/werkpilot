/**
 * Werkpilot M&A Analysis Agent (Agent 30)
 *
 * Performs due diligence, financial modeling (DCF, comparable company,
 * revenue multiples), integration planning, risk assessment, and
 * synergy analysis for potential acquisition targets.
 *
 * Schedule: Weekly on Monday at 06:00 (checks for new targets)
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const dcfModel = require('./models/dcf-model');

const logger = createLogger('strategy-ma-analysis');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DD_CHECKLISTS_DIR = path.join(__dirname, 'dd-checklists');
const REPORTS_DIR = path.join(__dirname, 'industry-reports');
const SCHEDULE = '0 6 * * 1'; // Weekly Monday at 06:00
const TIMEZONE = 'Europe/Zurich';

// ---------------------------------------------------------------------------
// Data Helpers
// ---------------------------------------------------------------------------

/**
 * Load the standard due diligence checklist template.
 */
function loadDDChecklist() {
  try {
    const filePath = path.join(DD_CHECKLISTS_DIR, 'standard.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.error(`Failed to load DD checklist: ${err.message}`);
    return null;
  }
}

/**
 * Fetch M&A targets from Airtable.
 */
async function fetchMATargets() {
  try {
    const targets = await getRecords(
      'MATargets',
      "OR({Status} = 'new', {Status} = 'in-analysis', {Status} = 'updated')",
      50
    );
    logger.info(`Fetched ${targets.length} M&A targets for analysis`);
    return targets;
  } catch (err) {
    logger.warn(`Could not fetch M&A targets: ${err.message}`);
    return [];
  }
}

/**
 * Fetch completed deals for benchmarking.
 */
async function fetchCompletedDeals() {
  try {
    const deals = await getRecords('MATargets', "{Status} = 'completed'", 20);
    return deals;
  } catch (err) {
    logger.warn(`Could not fetch completed deals: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Due Diligence
// ---------------------------------------------------------------------------

/**
 * Generate a customized due diligence checklist for a specific target.
 */
async function generateDDChecklist(target) {
  const standardChecklist = loadDDChecklist();
  if (!standardChecklist) {
    logger.warn('Using AI-generated checklist (standard template not available)');
  }

  const prompt = `Create a customized due diligence checklist for the following acquisition target.

TARGET COMPANY:
- Name: ${target.Name || target.name}
- Industry: ${target.Industry || target.industry || 'Marketing/Tech'}
- Revenue: ${target.Revenue || target.revenue || 'Unknown'}
- Employees: ${target.Employees || target.employees || 'Unknown'}
- Location: ${target.Location || target.location || 'Switzerland'}
- Type: ${target.Type || target.type || 'full-acquisition'}
- Notes: ${target.Notes || target.notes || 'None'}

STANDARD CHECKLIST (adapt and extend as needed):
${standardChecklist ? JSON.stringify(standardChecklist.phases.map(p => ({ phase: p.name, itemCount: p.items.length })), null, 2) : 'Not available'}

Provide a JSON response with a customized checklist:
{
  "targetName": "...",
  "checklistVersion": "custom-1.0",
  "estimatedDuration": "X weeks",
  "phases": [
    {
      "phase": "...",
      "name": "...",
      "priority": "critical|high|medium",
      "items": [
        {
          "id": "...",
          "item": "...",
          "category": "...",
          "priority": "critical|high|medium|low",
          "responsible": "...",
          "targetSpecific": true,
          "notes": "..."
        }
      ]
    }
  ],
  "dealBreakers": ["..."],
  "specialConsiderations": ["..."]
}`;

  try {
    const checklist = await generateJSON(prompt, {
      system: 'You are an M&A due diligence expert. Create thorough, Swiss-market-aware checklists. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 4000,
    });
    return checklist;
  } catch (err) {
    logger.error(`DD checklist generation failed for ${target.Name || target.name}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Financial Modeling
// ---------------------------------------------------------------------------

/**
 * Run DCF valuation for a target.
 */
function runDCFValuation(target) {
  try {
    const revenue = parseFloat(target.Revenue || target.revenue || 0);
    const ebitda = parseFloat(target.EBITDA || target.ebitda || revenue * 0.15);
    const arr = parseFloat(target.ARR || target.arr || revenue * 0.6);
    const netDebt = parseFloat(target.NetDebt || target.netDebt || 0);

    if (revenue <= 0) {
      logger.warn(`Cannot run DCF for ${target.Name || target.name}: no revenue data`);
      return null;
    }

    const report = dcfModel.generateValuationReport({
      name: target.Name || target.name,
      industry: target.IndustryCategory || target.industryCategory || 'saas-marketing',
      revenue,
      ebitda,
      arr,
      netDebt,
      growthRates: [0.15, 0.12, 0.10, 0.08, 0.06],
      ebitdaMargin: ebitda / revenue,
    });

    logger.info(`DCF valuation for ${target.Name || target.name}: EV = ${report.dcfValuation.enterpriseValue} CHF`);
    return report;
  } catch (err) {
    logger.error(`DCF valuation failed for ${target.Name || target.name}: ${err.message}`);
    return null;
  }
}

/**
 * Run comparable company analysis.
 */
function runComparableAnalysis(target) {
  try {
    const revenue = parseFloat(target.Revenue || target.revenue || 0);
    const ebitda = parseFloat(target.EBITDA || target.ebitda || null);
    const arr = parseFloat(target.ARR || target.arr || null);
    const netDebt = parseFloat(target.NetDebt || target.netDebt || 0);
    const industry = target.IndustryCategory || target.industryCategory || 'saas-marketing';

    if (revenue <= 0) {
      logger.warn(`Cannot run comp analysis for ${target.Name || target.name}: no revenue`);
      return null;
    }

    const result = dcfModel.comparableCompanyValuation({
      industry,
      revenue,
      ebitda: ebitda || null,
      arr: arr || null,
      netDebt,
    });

    logger.info(`Comp analysis for ${target.Name || target.name}: median = ${result.blendedValuation.median} CHF`);
    return result;
  } catch (err) {
    logger.error(`Comparable analysis failed for ${target.Name || target.name}: ${err.message}`);
    return null;
  }
}

/**
 * Run sensitivity analysis on the DCF model.
 */
function runSensitivityAnalysis(target, dcfResult) {
  if (!dcfResult) return null;

  try {
    const result = dcfModel.sensitivityAnalysis({
      projectedFCF: dcfResult.fcfProjection.fcfArray,
      netDebt: parseFloat(target.NetDebt || target.netDebt || 0),
    });
    return result;
  } catch (err) {
    logger.error(`Sensitivity analysis failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Integration Planning
// ---------------------------------------------------------------------------

/**
 * Generate integration plan for merging acquired company into Werkpilot.
 */
async function generateIntegrationPlan(target, valuation) {
  const prompt = `Create a 100-day integration plan for Werkpilot acquiring ${target.Name || target.name}.

TARGET PROFILE:
- Industry: ${target.Industry || target.industry}
- Revenue: ${target.Revenue || target.revenue}
- Employees: ${target.Employees || target.employees}
- Technology: ${target.TechStack || target.techStack || 'Unknown'}
- Customers: ${target.CustomerCount || target.customerCount || 'Unknown'}

WERKPILOT CONTEXT:
- Swiss AI marketing automation platform
- SaaS model, CHF 499-4999/month
- Focus: KMU market
- Key requirement: integrate acquired clients into Werkpilot platform

VALUATION:
${valuation ? JSON.stringify(valuation.summary, null, 2) : 'Not available'}

Provide a JSON response:
{
  "integrationStrategy": "absorb|preserve|symbiosis",
  "strategyRationale": "...",
  "phases": [
    {
      "phase": "Day 1-30",
      "name": "...",
      "objectives": ["..."],
      "actions": [
        { "action": "...", "owner": "...", "deadline": "...", "priority": "critical|high|medium" }
      ],
      "risks": ["..."],
      "milestones": ["..."]
    }
  ],
  "clientMigration": {
    "approach": "immediate|phased|parallel",
    "timeline": "...",
    "steps": ["..."],
    "communicationPlan": "..."
  },
  "teamIntegration": {
    "keyRetention": ["..."],
    "restructuring": "...",
    "culturalAlignment": ["..."]
  },
  "technologyMerge": {
    "approach": "...",
    "timeline": "...",
    "dataMigration": "...",
    "systemDecommission": "..."
  },
  "estimatedIntegrationCost": number,
  "currency": "CHF",
  "successMetrics": [{ "metric": "...", "target": "...", "timeline": "..." }]
}`;

  try {
    const plan = await generateJSON(prompt, {
      system: 'You are an M&A integration specialist with experience in Swiss tech acquisitions. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 4000,
    });
    return plan;
  } catch (err) {
    logger.error(`Integration plan generation failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Risk Assessment
// ---------------------------------------------------------------------------

/**
 * Comprehensive risk assessment for an acquisition target.
 */
async function assessRisks(target, valuation, ddChecklist) {
  const prompt = `Perform a comprehensive risk assessment for Werkpilot acquiring ${target.Name || target.name}.

TARGET:
${JSON.stringify({
  name: target.Name || target.name,
  industry: target.Industry || target.industry,
  revenue: target.Revenue || target.revenue,
  employees: target.Employees || target.employees,
  location: target.Location || target.location,
}, null, 2)}

VALUATION:
${valuation ? JSON.stringify(valuation.summary, null, 2) : 'Not available'}

DD FOCUS AREAS:
${ddChecklist ? JSON.stringify(ddChecklist.dealBreakers || [], null, 2) : '[]'}

Provide a JSON response:
{
  "overallRiskLevel": "low|moderate|elevated|high|critical",
  "overallScore": number,
  "categories": [
    {
      "category": "Financial|Legal|Technical|Operational|Strategic|Cultural|Market",
      "riskLevel": "low|moderate|elevated|high|critical",
      "score": number,
      "weight": number,
      "risks": [
        {
          "risk": "...",
          "likelihood": "low|medium|high",
          "impact": "low|medium|high|critical",
          "mitigation": "...",
          "residualRisk": "low|medium|high"
        }
      ]
    }
  ],
  "dealBreakers": [{ "risk": "...", "assessment": "clear|concern|blocker" }],
  "recommendation": "proceed|proceed-with-caution|pause|abort",
  "recommendationRationale": "..."
}`;

  try {
    const risks = await generateJSON(prompt, {
      system: 'You are a risk assessment expert specializing in tech M&A. Be thorough and realistic. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 4000,
    });
    return risks;
  } catch (err) {
    logger.error(`Risk assessment failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Synergy Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze synergies from a potential acquisition.
 */
async function analyzeSynergies(target) {
  const prompt = `Analyze potential synergies from Werkpilot acquiring ${target.Name || target.name}.

TARGET PROFILE:
- Industry: ${target.Industry || target.industry}
- Revenue: ${target.Revenue || target.revenue}
- Employees: ${target.Employees || target.employees}
- Services: ${target.Services || target.services || 'Unknown'}
- Customers: ${target.CustomerCount || target.customerCount || 'Unknown'}

WERKPILOT PROFILE:
- AI marketing automation platform for Swiss KMUs
- SaaS model
- Capabilities: content generation, SEO, social media, analytics, automation

Identify revenue synergies and cost synergies. Provide a JSON response:
{
  "revenueSynergies": [
    {
      "description": "...",
      "annualValue": number,
      "probability": number,
      "yearsToRealize": number,
      "rationale": "..."
    }
  ],
  "costSynergies": [
    {
      "description": "...",
      "annualSaving": number,
      "probability": number,
      "yearsToRealize": number,
      "rationale": "..."
    }
  ],
  "integrationCost": number,
  "currency": "CHF",
  "timeToFullSynergy": "...",
  "confidenceLevel": "high|medium|low",
  "keyAssumptions": ["..."]
}`;

  try {
    const synergyInput = await generateJSON(prompt, {
      system: 'You are a synergy analyst. Be conservative and realistic with estimates. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 3000,
    });

    // Run the financial synergy calculation
    const synergyCalc = dcfModel.calculateSynergies({
      revenueSynergies: synergyInput.revenueSynergies || [],
      costSynergies: synergyInput.costSynergies || [],
      integrationCost: synergyInput.integrationCost || 0,
    });

    return {
      ...synergyInput,
      financialAnalysis: synergyCalc,
    };
  } catch (err) {
    logger.error(`Synergy analysis failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

/**
 * Generate a comprehensive M&A analysis report.
 */
async function generateMAReport(target, results) {
  const prompt = `Create a comprehensive M&A analysis report for Werkpilot leadership.

TARGET: ${target.Name || target.name}

ANALYSIS RESULTS:
- DD Checklist: ${results.ddChecklist ? 'Generated' : 'Not available'}
- DCF Valuation: ${results.dcfValuation ? `EV = ${results.dcfValuation.dcfValuation.enterpriseValue} CHF` : 'Not available'}
- Comparable Analysis: ${results.comparableAnalysis ? `Median = ${results.comparableAnalysis.blendedValuation.median} CHF` : 'Not available'}
- Integration Plan: ${results.integrationPlan ? results.integrationPlan.integrationStrategy : 'Not available'}
- Risk Assessment: ${results.riskAssessment ? results.riskAssessment.overallRiskLevel : 'Not available'}
- Synergies: ${results.synergyAnalysis?.financialAnalysis ? `Net = ${results.synergyAnalysis.financialAnalysis.netSynergyValue} CHF` : 'Not available'}

FULL DATA:
${JSON.stringify(results, null, 2)}

Write a Markdown report with:
1. Executive Summary (key recommendation and rationale)
2. Target Overview
3. Valuation Analysis (DCF + Comps + Sensitivity)
4. Due Diligence Status
5. Risk Assessment
6. Synergy Analysis
7. Integration Plan Summary
8. Financial Impact on Werkpilot
9. Recommendation (Go/No-Go with conditions)
10. Next Steps`;

  try {
    const report = await generateText(prompt, {
      system: 'You are a senior M&A advisor producing board-level investment memos. Be thorough and balanced.',
      model: config.models.standard,
      maxTokens: 5000,
      temperature: 0.3,
    });
    return report;
  } catch (err) {
    logger.error(`M&A report generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Save M&A analysis report.
 */
function saveMAReport(targetName, report, results) {
  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = targetName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const reportPath = path.join(REPORTS_DIR, `ma-${safeName}-${dateStr}.md`);
  fs.writeFileSync(reportPath, report, 'utf-8');

  const dataPath = path.join(REPORTS_DIR, `ma-${safeName}-${dateStr}-data.json`);
  fs.writeFileSync(dataPath, JSON.stringify(results, null, 2), 'utf-8');

  logger.info(`M&A report saved: ${reportPath}`);
  return reportPath;
}

/**
 * Convert report to HTML email.
 */
function reportToHtml(markdown, targetName) {
  let html = markdown
    .replace(/^### (.+)$/gm, '<h3 style="color:#1a1a2e;margin-top:18px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#16213e;margin-top:22px;border-bottom:2px solid #0f3460;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="color:#0f3460;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin:8px 0;">')
    .replace(/\n/g, '<br>');

  return `
    <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:900px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:24px 30px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">M&A Analysis: ${targetName}</h1>
        <p style="margin:5px 0 0;opacity:0.9;">Werkpilot Strategy Department - Confidential</p>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        <p style="margin:8px 0;">${html}</p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Main Execution
// ---------------------------------------------------------------------------

async function runMAAnalysis() {
  const startTime = Date.now();
  logger.info('=== Starting M&A Analysis Cycle ===');

  try {
    // Phase 1: Fetch targets
    logger.info('Phase 1: Fetching M&A targets...');
    const targets = await fetchMATargets();

    if (targets.length === 0) {
      logger.info('No M&A targets require analysis. Exiting.');
      return { success: true, targetsAnalyzed: 0 };
    }

    const completedDeals = await fetchCompletedDeals();

    // Phase 2: Analyze each target
    logger.info(`Phase 2: Analyzing ${targets.length} targets...`);
    const analysisResults = [];

    for (const target of targets) {
      const targetName = target.Name || target.name || 'Unknown Target';
      logger.info(`Analyzing target: ${targetName}...`);

      try {
        // Run all analyses
        const ddChecklist = await generateDDChecklist(target);
        const dcfValuation = runDCFValuation(target);
        const comparableAnalysis = runComparableAnalysis(target);
        const sensitivity = runSensitivityAnalysis(target, dcfValuation);
        const integrationPlan = await generateIntegrationPlan(target, dcfValuation);
        const synergyAnalysis = await analyzeSynergies(target);
        const riskAssessment = await assessRisks(target, dcfValuation, ddChecklist);

        const results = {
          target: targetName,
          ddChecklist,
          dcfValuation,
          comparableAnalysis,
          sensitivity,
          integrationPlan,
          synergyAnalysis,
          riskAssessment,
        };

        // Generate and save report
        const report = await generateMAReport(target, results);
        if (report) {
          const reportPath = saveMAReport(targetName, report, results);
          results.reportPath = reportPath;

          // Send email for high-priority targets
          const priority = target.Priority || target.priority || 'normal';
          if (priority === 'high' || priority === 'critical') {
            const emailHtml = reportToHtml(report, targetName);
            await sendCEOEmail({
              subject: `M&A Analysis: ${targetName} [${riskAssessment?.recommendation || 'pending'}]`,
              html: emailHtml,
            });
          }
        }

        // Update Airtable status
        if (target.id) {
          try {
            await updateRecord('MATargets', target.id, {
              Status: 'analyzed',
              LastAnalysis: new Date().toISOString().split('T')[0],
              Recommendation: riskAssessment?.recommendation || 'pending',
              ValuationRange: dcfValuation
                ? `${dcfValuation.summary.suggestedRange.low}-${dcfValuation.summary.suggestedRange.high}`
                : 'N/A',
            });
          } catch (updateErr) {
            logger.warn(`Could not update Airtable for ${targetName}: ${updateErr.message}`);
          }
        }

        analysisResults.push(results);
      } catch (targetErr) {
        logger.error(`Analysis failed for ${targetName}: ${targetErr.message}`);
        analysisResults.push({ target: targetName, error: targetErr.message });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== M&A Analysis complete in ${elapsed}s. Analyzed ${analysisResults.length} targets ===`);

    return {
      success: true,
      targetsAnalyzed: analysisResults.length,
      results: analysisResults,
      elapsed,
    };
  } catch (err) {
    logger.error(`M&A Analysis cycle failed: ${err.message}`, { stack: err.stack });

    try {
      await sendCEOEmail({
        subject: 'M&A Analysis FEHLER',
        html: `<div style="padding:20px;background:#fff3f3;border-left:4px solid #e94560;">
          <h2>M&A Analysis fehlgeschlagen</h2>
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
  logger.info(`M&A Analysis Agent starting. Schedule: ${SCHEDULE}`);

  cron.schedule(SCHEDULE, () => {
    logger.info('Cron triggered: weekly M&A analysis');
    runMAAnalysis();
  }, { timezone: TIMEZONE });

  logger.info('M&A Analysis Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--now') || args.includes('-n')) {
    logger.info('Running M&A analysis immediately (manual trigger)');
    runMAAnalysis().then((result) => {
      if (result.success) {
        logger.info(`Analysis complete: ${result.targetsAnalyzed} targets analyzed`);
      } else {
        logger.error(`Analysis failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else {
    start();
  }
}

module.exports = { start, runMAAnalysis };
