/**
 * Agent 28 — M&A Scout Agent
 * Werkpilot Finance Department
 *
 * Identifies acquisition targets (translation bureaus, agencies, SaaS),
 * monitors Handelsregister for opportunities, tracks consolidation trends,
 * generates acquisition briefs, and values targets.
 *
 * Schedule: Weekly on Wednesday at 04:00 (full scan), daily market monitoring
 */

'use strict';

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const {
  revenueMultipleValuation,
  ebitdaMultipleValuation,
  synergyValuation,
  generateAcquisitionBrief,
  scoreTarget,
} = require('./valuation-model');

const logger = createLogger('finance-ma-scout');
const TARGETS_DIR = path.join(__dirname, 'targets');
const REPORTS_DIR = path.join(__dirname, 'reports');

// Target industries and search parameters
const TARGET_PROFILES = [
  {
    type: 'translation-bureau',
    description: 'Translation bureaus in Switzerland that could be automated with AI',
    keywords: ['Uebersetzungsbuero', 'Sprachdienste', 'Translation', 'Lokalisierung', 'Dolmetscher'],
    industries: ['translation', 'localization', 'language-services'],
    minRevenue: 200000,
    maxRevenue: 5000000,
    cantons: ['ZH', 'BE', 'BS', 'GE', 'VD', 'LU', 'SG', 'AG'],
  },
  {
    type: 'digital-agency',
    description: 'Small digital/marketing agencies that are struggling or looking to exit',
    keywords: ['Digitalagentur', 'Webagentur', 'Marketing Agentur', 'Content Agentur'],
    industries: ['digital-agency', 'marketing-agency'],
    minRevenue: 100000,
    maxRevenue: 3000000,
    cantons: ['ZH', 'BE', 'BS', 'GE', 'VD'],
  },
  {
    type: 'saas',
    description: 'Complementary SaaS tools (CRM, project management, automation)',
    keywords: ['SaaS', 'Software', 'Automation', 'CRM', 'Projektmanagement'],
    industries: ['saas', 'it-services'],
    minRevenue: 50000,
    maxRevenue: 2000000,
    cantons: [],
  },
];

// ---------------------------------------------------------------------------
// Handelsregister Monitoring
// ---------------------------------------------------------------------------

async function monitorHandelsregister() {
  logger.info('Monitoring Handelsregister for opportunities...');

  const opportunities = [];

  try {
    // Search Zefix (Swiss commercial register API) for relevant changes
    // Note: Zefix API at zefix.ch provides public company data
    for (const profile of TARGET_PROFILES) {
      for (const keyword of profile.keywords.slice(0, 3)) {
        try {
          const response = await axios.get('https://www.zefix.admin.ch/ZefixREST/api/v1/company/search', {
            params: {
              name: keyword,
              activeOnly: false,
              maxEntries: 20,
            },
            headers: {
              'Accept': 'application/json',
            },
            timeout: 10000,
          });

          if (response.data && Array.isArray(response.data.list)) {
            for (const company of response.data.list) {
              // Look for liquidations, mutations, or deletions
              const isDistressed = company.status === 'BEING_CANCELLED' ||
                company.status === 'IN_LIQUIDATION' ||
                company.deletionDate;

              if (isDistressed || profile.type === 'translation-bureau') {
                opportunities.push({
                  name: company.name,
                  uid: company.uid,
                  canton: company.canton,
                  status: company.status,
                  legalForm: company.legalForm,
                  isDistressed,
                  type: profile.type,
                  source: 'handelsregister',
                  foundDate: new Date().toISOString().split('T')[0],
                });
              }
            }
          }
        } catch (error) {
          // Zefix API may not be available or may rate-limit
          logger.debug(`Zefix search for "${keyword}" failed: ${error.message}`);
        }
      }
    }

    logger.info(`Found ${opportunities.length} potential opportunities from Handelsregister`);
    return opportunities;
  } catch (error) {
    logger.error(`Handelsregister monitoring failed: ${error.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// AI-Powered Target Identification
// ---------------------------------------------------------------------------

async function identifyTargets() {
  logger.info('Running AI-powered target identification...');

  try {
    // Get existing targets to avoid duplicates
    const existingTargets = await getRecords('MA_Targets', '').catch(() => []);
    const existingNames = new Set(existingTargets.map(t => (t.Name || '').toLowerCase()));

    // Handelsregister scan
    const hrOpportunities = await monitorHandelsregister();

    // AI analysis of market opportunities
    const aiTargets = await generateJSON(`
Identify 5 realistic acquisition target profiles for Werkpilot, a Swiss AI startup that automates business processes for SMEs.

Target categories:
1. Translation bureaus in Switzerland (ripe for AI disruption)
2. Small digital/marketing agencies struggling with competition
3. Complementary SaaS tools that could enhance the platform

For each target, provide:
{
  "targets": [
    {
      "name": "Example Company Name",
      "type": "translation-bureau|digital-agency|saas",
      "location": "City, Canton",
      "estimatedRevenue": 500000,
      "employees": 5,
      "description": "Brief description",
      "rationale": ["reason 1", "reason 2"],
      "risks": ["risk 1", "risk 2"],
      "synergies": ["synergy 1", "synergy 2"],
      "growthRate": 0.05,
      "isDistressed": false,
      "strategicFit": "high|medium|low"
    }
  ]
}

Focus on realistic Swiss market companies. Use plausible but fictional names.`,
      {
        system: 'You are an M&A analyst specializing in Swiss SME acquisitions in the tech/language services sector.',
        model: config.models.standard,
      }
    );

    const allTargets = [];

    // Process Handelsregister opportunities
    for (const opp of hrOpportunities) {
      if (existingNames.has((opp.name || '').toLowerCase())) continue;

      const target = {
        name: opp.name,
        type: opp.type,
        location: `${opp.canton}, Schweiz`,
        source: 'handelsregister',
        isDistressed: opp.isDistressed,
        status: opp.status,
        uid: opp.uid,
        foundDate: opp.foundDate,
      };

      allTargets.push(target);
    }

    // Process AI-identified targets
    if (aiTargets && aiTargets.targets) {
      for (const target of aiTargets.targets) {
        if (existingNames.has((target.name || '').toLowerCase())) continue;

        allTargets.push({
          ...target,
          source: 'ai-analysis',
          foundDate: new Date().toISOString().split('T')[0],
        });
      }
    }

    logger.info(`Identified ${allTargets.length} new potential targets`);
    return allTargets;
  } catch (error) {
    logger.error(`Target identification failed: ${error.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Target Valuation
// ---------------------------------------------------------------------------

function valuateTarget(target) {
  const industry = target.type || 'generic';
  const revenue = target.estimatedRevenue || target.annualRevenue || 0;

  if (revenue === 0) {
    return {
      method: 'Revenue Multiple',
      industry,
      valuation: { low: 0, mid: 0, high: 0 },
      note: 'Insufficient revenue data for valuation',
    };
  }

  const valuation = revenueMultipleValuation(revenue, industry, {
    growthRate: target.growthRate || 0,
    recurringRevenuePct: target.recurringRevenuePct || 30,
    customerConcentration: target.customerConcentration || 20,
    marketPosition: target.marketPosition || 'average',
  });

  return valuation;
}

// ---------------------------------------------------------------------------
// Acquisition Brief Generation
// ---------------------------------------------------------------------------

async function generateTargetBrief(target) {
  logger.info(`Generating acquisition brief for ${target.name}...`);

  // Valuate
  const valuation = valuateTarget(target);

  // Score
  const score = scoreTarget({
    ...target,
    annualRevenue: target.estimatedRevenue || target.annualRevenue || 0,
    isSwiss: true,
  });

  // AI-enhanced analysis
  const analysis = await generateText(`
Provide a strategic analysis (3 paragraphs) for acquiring "${target.name}":

Target Profile:
- Type: ${target.type}
- Location: ${target.location || 'Switzerland'}
- Est. Revenue: CHF ${(target.estimatedRevenue || 0).toLocaleString('de-CH')}
- Employees: ${target.employees || 'Unknown'}
- Description: ${target.description || 'N/A'}
- Distressed: ${target.isDistressed ? 'Yes' : 'No'}

Acquirer: Werkpilot - AI-powered business automation for Swiss SMEs
Valuation Range: CHF ${valuation.valuation.low.toLocaleString('de-CH')} - ${valuation.valuation.high.toLocaleString('de-CH')}

Analyze: strategic fit, integration challenges, value creation potential, recommended offer range.`,
    {
      system: 'You are an M&A advisor specializing in Swiss tech acquisitions. Be analytical and pragmatic.',
      model: config.models.standard,
    }
  );

  // Build brief
  const briefData = {
    name: target.name,
    industry: target.type,
    location: target.location || 'Schweiz',
    annualRevenue: target.estimatedRevenue || target.annualRevenue,
    employees: target.employees,
    founded: target.founded,
    description: target.description,
    valuation: valuation.valuation,
    rationale: target.rationale || ['Strategic fit with Werkpilot AI platform'],
    risks: target.risks || ['Integration complexity', 'Customer retention'],
    synergies: target.synergies || ['Customer base acquisition', 'Revenue cross-sell'],
    priority: score >= 70 ? 'High' : score >= 50 ? 'Medium' : 'Low',
    nextSteps: score >= 70
      ? 'Initiate preliminary contact and request financials'
      : 'Monitor and reassess quarterly',
    score,
    analysis,
  };

  const briefMarkdown = generateAcquisitionBrief(briefData);

  // Append AI analysis
  const fullBrief = `${briefMarkdown}\n## Strategic Analysis\n\n${analysis}\n\n## Scoring\n- Overall Score: ${score}/100\n- Priority: ${briefData.priority}\n`;

  // Save brief
  fs.mkdirSync(TARGETS_DIR, { recursive: true });
  const sanitizedName = target.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const briefPath = path.join(TARGETS_DIR, `${sanitizedName}.md`);
  fs.writeFileSync(briefPath, fullBrief, 'utf-8');
  logger.info(`Acquisition brief saved to ${briefPath}`);

  // Store in Airtable
  try {
    await createRecord('MA_Targets', {
      Name: target.name,
      Type: target.type,
      Location: target.location || 'Schweiz',
      EstimatedRevenue: target.estimatedRevenue || 0,
      ValuationLow: valuation.valuation.low,
      ValuationMid: valuation.valuation.mid,
      ValuationHigh: valuation.valuation.high,
      Score: score,
      Priority: briefData.priority,
      Source: target.source || 'manual',
      IsDistressed: target.isDistressed || false,
      Status: 'Identified',
      FoundDate: target.foundDate || new Date().toISOString().split('T')[0],
      BriefPath: briefPath,
    });
  } catch (error) {
    logger.warn(`Failed to store target in Airtable: ${error.message}`);
  }

  return {
    name: target.name,
    score,
    priority: briefData.priority,
    valuation: valuation.valuation,
    briefPath,
  };
}

// ---------------------------------------------------------------------------
// Industry Consolidation Trends
// ---------------------------------------------------------------------------

async function analyzeConsolidationTrends() {
  logger.info('Analyzing industry consolidation trends...');

  const analysis = await generateText(`
Analyze current consolidation trends (as of early 2026) in these Swiss industries:

1. Translation & Localization Services
   - Impact of AI (LLMs) on traditional translation bureaus
   - Market size and fragmentation in Switzerland
   - Key players and recent M&A activity

2. Digital Marketing Agencies
   - Consolidation driven by AI tools
   - Small agencies struggling or being acquired
   - Swiss market specifics

3. SaaS / Business Automation
   - Roll-up strategies in Swiss B2B SaaS
   - AI-first companies acquiring traditional software
   - Vertical SaaS consolidation

For each industry, provide:
- Market size estimate (Switzerland)
- Fragmentation level
- Key consolidation drivers
- Opportunity assessment for an AI-first acquirer
- 2-3 recent relevant transactions (real or representative)

Be specific to the Swiss market and use CHF figures where applicable.`,
    {
      system: 'You are a Swiss M&A analyst specializing in tech and professional services. Provide market-informed analysis.',
      model: config.models.standard,
    }
  );

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `consolidation-trends-${new Date().toISOString().substring(0, 7)}.md`);
  fs.writeFileSync(reportPath, `# Industry Consolidation Trends\n*${new Date().toISOString().split('T')[0]}*\n\n${analysis}\n\n---\n*Generated by Werkpilot M&A Scout Agent*\n`, 'utf-8');

  logger.info(`Consolidation analysis saved to ${reportPath}`);
  return reportPath;
}

// ---------------------------------------------------------------------------
// Full M&A Scan
// ---------------------------------------------------------------------------

async function runFullScan() {
  logger.info('Running full M&A scan...');

  try {
    // 1. Identify new targets
    const newTargets = await identifyTargets();

    // 2. Generate briefs for top targets
    const briefs = [];
    const topTargets = newTargets
      .filter(t => t.estimatedRevenue || t.isDistressed)
      .slice(0, 5);

    for (const target of topTargets) {
      try {
        const brief = await generateTargetBrief(target);
        briefs.push(brief);
      } catch (error) {
        logger.error(`Failed to generate brief for ${target.name}: ${error.message}`);
      }
    }

    // 3. Consolidation trends (monthly)
    const now = new Date();
    if (now.getDate() <= 7) { // First week of month
      await analyzeConsolidationTrends();
    }

    // 4. Summary report
    const highPriority = briefs.filter(b => b.priority === 'High');

    if (briefs.length > 0) {
      const fmt = (val) => `CHF ${Math.round(val).toLocaleString('de-CH')}`;

      await sendCEOEmail({
        subject: `M&A Scout: ${briefs.length} Target(s) Analyzed${highPriority.length > 0 ? ` (${highPriority.length} High Priority)` : ''}`,
        html: `
          <h2>M&A Scout Weekly Report</h2>
          <p>Analyzed ${briefs.length} potential acquisition target(s):</p>
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
            <tr style="background: #f8f9fa;">
              <th>Target</th>
              <th>Score</th>
              <th>Priority</th>
              <th>Valuation Range</th>
            </tr>
            ${briefs.map(b => `
              <tr style="${b.priority === 'High' ? 'background: #d4edda;' : ''}">
                <td>${b.name}</td>
                <td>${b.score}/100</td>
                <td><strong>${b.priority}</strong></td>
                <td>${fmt(b.valuation.low)} - ${fmt(b.valuation.high)}</td>
              </tr>
            `).join('')}
          </table>
          ${highPriority.length > 0 ? `
            <p style="margin-top: 16px; color: #155724; background: #d4edda; padding: 12px; border-radius: 6px;">
              <strong>${highPriority.length} high-priority target(s)</strong> identified.
              Acquisition briefs are available in the targets directory.
            </p>
          ` : ''}
          <p style="color: #999; font-size: 12px;">
            Briefs saved to: ${TARGETS_DIR}
          </p>
        `,
      });
    }

    logger.info(`M&A scan complete: ${newTargets.length} targets found, ${briefs.length} briefs generated`);

    return {
      targetsFound: newTargets.length,
      briefsGenerated: briefs.length,
      highPriority: highPriority.length,
      briefs,
    };
  } catch (error) {
    logger.error(`Full M&A scan failed: ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Target Pipeline Management
// ---------------------------------------------------------------------------

async function reviewTargetPipeline() {
  logger.info('Reviewing M&A target pipeline...');

  try {
    const targets = await getRecords('MA_Targets', '');

    const pipeline = {
      identified: targets.filter(t => t.Status === 'Identified'),
      researching: targets.filter(t => t.Status === 'Researching'),
      contacted: targets.filter(t => t.Status === 'Contacted'),
      negotiating: targets.filter(t => t.Status === 'Negotiating'),
      dueDiligence: targets.filter(t => t.Status === 'Due Diligence'),
      closed: targets.filter(t => t.Status === 'Closed'),
      passed: targets.filter(t => t.Status === 'Passed'),
    };

    const totalPipelineValue = targets
      .filter(t => !['Closed', 'Passed'].includes(t.Status))
      .reduce((sum, t) => sum + (t.ValuationMid || 0), 0);

    return {
      total: targets.length,
      active: targets.filter(t => !['Closed', 'Passed'].includes(t.Status)).length,
      pipeline,
      totalPipelineValue,
    };
  } catch (error) {
    logger.error(`Pipeline review failed: ${error.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function startScheduler() {
  // Full M&A scan: weekly Wednesday 04:00
  cron.schedule('0 4 * * 3', async () => {
    logger.info('Scheduled: Weekly M&A scan');
    try {
      await runFullScan();
    } catch (error) {
      logger.error(`Scheduled M&A scan failed: ${error.message}`);
    }
  });

  // Handelsregister monitoring: daily at 05:00
  cron.schedule('0 5 * * 1-5', async () => {
    logger.info('Scheduled: Daily Handelsregister monitoring');
    try {
      const opportunities = await monitorHandelsregister();
      if (opportunities.filter(o => o.isDistressed).length > 0) {
        logger.info(`Found ${opportunities.filter(o => o.isDistressed).length} distressed companies`);
      }
    } catch (error) {
      logger.error(`Scheduled Handelsregister check failed: ${error.message}`);
    }
  });

  // Pipeline review: weekly Monday 10:00
  cron.schedule('0 10 * * 1', async () => {
    logger.info('Scheduled: Pipeline review');
    try {
      await reviewTargetPipeline();
    } catch (error) {
      logger.error(`Scheduled pipeline review failed: ${error.message}`);
    }
  });

  // Consolidation trends: monthly 1st at 03:00
  cron.schedule('0 3 1 * *', async () => {
    logger.info('Scheduled: Monthly consolidation analysis');
    try {
      await analyzeConsolidationTrends();
    } catch (error) {
      logger.error(`Scheduled consolidation analysis failed: ${error.message}`);
    }
  });

  logger.info('M&A Scout Agent scheduler started');
  logger.info('  - Full scan: weekly Wednesday 04:00');
  logger.info('  - Handelsregister: daily 05:00 (Mon-Fri)');
  logger.info('  - Pipeline review: weekly Monday 10:00');
  logger.info('  - Consolidation trends: monthly 1st 03:00');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  logger.info('M&A Scout Agent starting...');

  if (process.argv.includes('--once')) {
    await runFullScan();
  } else if (process.argv.includes('--handelsregister')) {
    const opportunities = await monitorHandelsregister();
    console.log(JSON.stringify(opportunities, null, 2));
  } else if (process.argv.includes('--trends')) {
    await analyzeConsolidationTrends();
  } else if (process.argv.includes('--pipeline')) {
    const pipeline = await reviewTargetPipeline();
    console.log(JSON.stringify(pipeline, null, 2));
  } else if (process.argv.includes('--valuate')) {
    const name = process.argv[process.argv.indexOf('--valuate') + 1] || 'Test Target';
    const revenue = parseInt(process.argv[process.argv.indexOf('--valuate') + 2] || '500000', 10);
    const val = revenueMultipleValuation(revenue, 'translation-bureau');
    console.log(JSON.stringify(val, null, 2));
  } else {
    startScheduler();
  }
}

main().catch(error => {
  logger.error(`M&A Scout Agent fatal error: ${error.message}`, { stack: error.stack });
  process.exit(1);
});

module.exports = {
  runFullScan,
  identifyTargets,
  generateTargetBrief,
  monitorHandelsregister,
  analyzeConsolidationTrends,
  reviewTargetPipeline,
  valuateTarget,
  startScheduler,
};
