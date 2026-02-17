/**
 * Werkpilot OKR Tracker Agent (Agent 52)
 *
 * Tracks OKR (Objectives and Key Results) progress across the organization.
 * Features:
 * - OKR progress calculation with confidence scoring
 * - Automated status updates from pipeline/agent data
 * - OKR alignment visualization (company → department → team)
 * - Risk flagging for at-risk OKRs
 * - Weekly OKR summary for CEO
 * - Historical OKR completion rate tracking
 *
 * Schedule: Weekly on Monday at 08:00, Monthly review on 1st at 10:00
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const dashboardSync = require('../shared/utils/dashboard-sync');
const config = require('../shared/utils/config');

const logger = createLogger('strategy-okr-tracker');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OKR_DIR = path.join(__dirname, 'okrs');
const REPORTS_DIR = path.join(__dirname, 'industry-reports');
const OKR_DATA_FILE = path.join(OKR_DIR, 'okr-data.json');

const WEEKLY_SCHEDULE = '0 8 * * 1';      // Weekly: Monday at 08:00
const MONTHLY_SCHEDULE = '0 10 1 * *';    // Monthly: 1st at 10:00
const TIMEZONE = 'Europe/Zurich';

// ---------------------------------------------------------------------------
// OKR Data Management
// ---------------------------------------------------------------------------

/**
 * Load OKR data from file.
 */
function loadOKRData() {
  try {
    if (!fs.existsSync(OKR_DATA_FILE)) {
      logger.warn('OKR data file not found, initializing empty structure');
      return { company: [], departments: {}, teams: {}, historical: [] };
    }
    const raw = fs.readFileSync(OKR_DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.error(`Failed to load OKR data: ${err.message}`);
    return { company: [], departments: {}, teams: {}, historical: [] };
  }
}

/**
 * Save OKR data to file.
 */
function saveOKRData(data) {
  try {
    fs.mkdirSync(OKR_DIR, { recursive: true });
    fs.writeFileSync(OKR_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    logger.info('OKR data saved');
  } catch (err) {
    logger.error(`Failed to save OKR data: ${err.message}`);
  }
}

/**
 * Fetch operational data for OKR progress calculation.
 */
async function fetchOperationalData() {
  try {
    const [pipeline, customers, agents, projects] = await Promise.all([
      getRecords('Pipeline', '', 200),
      getRecords('Customers', '', 500),
      getRecords('AgentExecutions', '', 100),
      getRecords('Projects', '', 100),
    ]);

    logger.info(`Fetched operational data: ${pipeline.length} pipeline, ${customers.length} customers, ${agents.length} agent executions, ${projects.length} projects`);

    return {
      pipeline,
      customers,
      agents,
      projects,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn(`Could not fetch operational data: ${err.message}`);
    return {
      pipeline: [],
      customers: [],
      agents: [],
      projects: [],
      fetchedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// OKR Progress Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate progress for all OKRs using operational data and AI analysis.
 */
async function calculateOKRProgress(okrData, operationalData) {
  const allOKRs = [
    ...okrData.company.map(o => ({ ...o, level: 'company' })),
    ...Object.entries(okrData.departments).flatMap(([dept, okrs]) =>
      okrs.map(o => ({ ...o, level: 'department', department: dept }))
    ),
    ...Object.entries(okrData.teams).flatMap(([team, okrs]) =>
      okrs.map(o => ({ ...o, level: 'team', team }))
    ),
  ];

  if (allOKRs.length === 0) {
    logger.info('No OKRs defined yet');
    return [];
  }

  const prompt = `Calculate progress for the following OKRs based on operational data.

OKRS:
${JSON.stringify(allOKRs, null, 2)}

OPERATIONAL DATA:
Pipeline: ${operationalData.pipeline.length} deals
Customers: ${operationalData.customers.length} customers
Recent Agent Executions: ${operationalData.agents.length}
Active Projects: ${operationalData.projects.length}

For each OKR, calculate:
{
  "okrResults": [
    {
      "id": "okr-id",
      "objective": "...",
      "level": "company|department|team",
      "department": "...",
      "team": "...",
      "keyResults": [
        {
          "kr": "...",
          "target": number,
          "current": number,
          "progress": number,
          "confidence": "high|medium|low",
          "lastUpdated": "YYYY-MM-DD",
          "dataSource": "...",
          "trend": "on-track|at-risk|off-track"
        }
      ],
      "overallProgress": number,
      "status": "on-track|at-risk|off-track",
      "confidenceScore": number,
      "riskFlags": ["..."],
      "blockers": ["..."],
      "recommendations": ["..."]
    }
  ],
  "summary": {
    "totalOKRs": number,
    "onTrack": number,
    "atRisk": number,
    "offTrack": number,
    "avgProgress": number,
    "criticalRisks": ["..."]
  }
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are an OKR tracking expert. Calculate realistic progress based on data. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 6000,
    });
  } catch (err) {
    logger.error(`OKR progress calculation failed: ${err.message}`);
    return null;
  }
}

/**
 * Analyze OKR alignment across company → department → team levels.
 */
async function analyzeOKRAlignment(okrData, progressData) {
  const prompt = `Analyze OKR alignment across organizational levels for Werkpilot.

OKR STRUCTURE:
Company OKRs: ${okrData.company.length}
Department OKRs: ${JSON.stringify(Object.keys(okrData.departments).map(d => ({ dept: d, count: okrData.departments[d].length })))}
Team OKRs: ${JSON.stringify(Object.keys(okrData.teams).map(t => ({ team: t, count: okrData.teams[t].length })))}

PROGRESS DATA:
${JSON.stringify(progressData?.summary, null, 2)}

Provide a JSON alignment analysis:
{
  "alignmentScore": number,
  "alignmentIssues": [
    {
      "type": "misaligned|orphaned|duplicate",
      "level": "department|team",
      "entity": "...",
      "issue": "...",
      "recommendation": "..."
    }
  ],
  "cascadeAnalysis": {
    "companyToDepart": "strong|moderate|weak",
    "departToTeam": "strong|moderate|weak",
    "gaps": ["..."]
  },
  "recommendations": ["..."],
  "visualizationData": {
    "nodes": [
      { "id": "...", "label": "...", "level": "company|department|team", "status": "..." }
    ],
    "edges": [
      { "from": "...", "to": "...", "strength": "strong|weak" }
    ]
  }
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are an organizational alignment expert. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 4000,
    });
  } catch (err) {
    logger.error(`OKR alignment analysis failed: ${err.message}`);
    return null;
  }
}

/**
 * Track historical OKR completion rates.
 */
function trackHistoricalCompletion(okrData) {
  const historical = okrData.historical || [];

  if (historical.length === 0) {
    logger.info('No historical OKR data available yet');
    return {
      quarters: [],
      avgCompletionRate: 0,
      trend: 'unknown',
    };
  }

  const quarterStats = historical.map(h => ({
    period: h.period,
    totalOKRs: h.totalOKRs || 0,
    completed: h.completed || 0,
    completionRate: h.totalOKRs > 0 ? (h.completed / h.totalOKRs * 100) : 0,
  }));

  const avgCompletionRate = quarterStats.length > 0
    ? quarterStats.reduce((sum, q) => sum + q.completionRate, 0) / quarterStats.length
    : 0;

  // Determine trend
  let trend = 'stable';
  if (quarterStats.length >= 2) {
    const recent = quarterStats.slice(-2);
    if (recent[1].completionRate > recent[0].completionRate + 5) {
      trend = 'improving';
    } else if (recent[1].completionRate < recent[0].completionRate - 5) {
      trend = 'declining';
    }
  }

  return {
    quarters: quarterStats,
    avgCompletionRate: parseFloat(avgCompletionRate.toFixed(1)),
    trend,
  };
}

// ---------------------------------------------------------------------------
// Weekly OKR Summary
// ---------------------------------------------------------------------------

/**
 * Generate weekly OKR summary for CEO.
 */
async function generateWeeklySummary(progressData, alignmentData, historicalData) {
  const weekOf = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const prompt = `Create a concise weekly OKR summary for the CEO.

WEEK OF: ${weekOf}

PROGRESS DATA:
${JSON.stringify(progressData, null, 2)}

ALIGNMENT DATA:
${JSON.stringify(alignmentData?.alignmentScore, null, 2)}

HISTORICAL PERFORMANCE:
${JSON.stringify(historicalData, null, 2)}

Write a Markdown report covering:
1. Executive Summary (3-4 key points)
2. Overall Progress (metrics table)
3. At-Risk OKRs (with recommended actions)
4. Alignment Health
5. This Week's Priorities
6. Blockers & Escalations

Keep it concise, data-driven, and actionable.`;

  try {
    return await generateText(prompt, {
      system: 'You are an executive OKR coach. Provide brief, actionable summaries. Be data-driven and highlight risks early.',
      model: config.models.fast,
      maxTokens: 2500,
      temperature: 0.3,
    });
  } catch (err) {
    logger.error(`Weekly summary generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Save weekly summary.
 */
function saveWeeklySummary(summary) {
  const dateStr = new Date().toISOString().split('T')[0];
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const reportPath = path.join(REPORTS_DIR, `okr-weekly-${dateStr}.md`);
  fs.writeFileSync(reportPath, summary, 'utf-8');
  logger.info(`Weekly OKR summary saved: ${reportPath}`);
  return reportPath;
}

/**
 * Store OKR metrics in Airtable.
 */
async function storeOKRMetrics(progressData, alignmentData) {
  try {
    const record = {
      Date: new Date().toISOString().split('T')[0],
      Week: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      TotalOKRs: progressData?.summary?.totalOKRs || 0,
      OnTrack: progressData?.summary?.onTrack || 0,
      AtRisk: progressData?.summary?.atRisk || 0,
      OffTrack: progressData?.summary?.offTrack || 0,
      AvgProgress: progressData?.summary?.avgProgress || 0,
      AlignmentScore: alignmentData?.alignmentScore || 0,
      CriticalRisks: progressData?.summary?.criticalRisks?.join(', ') || '',
    };

    await createRecord('OKRTracking', record);
    logger.info('OKR metrics stored in Airtable');
  } catch (err) {
    logger.warn(`Could not store OKR metrics: ${err.message}`);
  }
}

/**
 * Sync OKR data to dashboard.
 */
async function syncOKRsToDashboard(progressData, alignmentData) {
  try {
    const atRiskCount = progressData?.summary?.atRisk || 0;
    const offTrackCount = progressData?.summary?.offTrack || 0;

    await dashboardSync.bulkSync({
      notifications: [
        {
          title: 'Weekly OKR Update',
          message: `${progressData?.summary?.onTrack || 0} on track, ${atRiskCount} at risk, ${offTrackCount} off track. Alignment: ${alignmentData?.alignmentScore || 0}%`,
          type: atRiskCount > 0 || offTrackCount > 0 ? 'warning' : 'success',
          link: null,
        },
      ],
    });

    logger.info('OKR data synced to dashboard');
  } catch (err) {
    logger.warn(`Could not sync OKR data to dashboard: ${err.message}`);
  }
}

/**
 * Convert markdown to HTML for email.
 */
function summaryToHtml(markdown) {
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
        <h1 style="margin:0;font-size:22px;">Weekly OKR Summary</h1>
        <p style="margin:5px 0 0;opacity:0.9;">Werkpilot Strategy - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        <p style="margin:8px 0;">${html}</p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Main Execution
// ---------------------------------------------------------------------------

/**
 * Weekly OKR tracking.
 */
async function runWeeklyOKRTracking() {
  const startTime = Date.now();
  logger.info('=== Starting Weekly OKR Tracking ===');

  try {
    // Phase 1: Load OKR data and fetch operational data
    logger.info('Phase 1: Loading OKR data and fetching operational metrics...');
    const okrData = loadOKRData();
    const operationalData = await fetchOperationalData();

    if (okrData.company.length === 0 && Object.keys(okrData.departments).length === 0) {
      logger.warn('No OKRs defined yet. Skipping tracking.');
      return { success: true, message: 'No OKRs to track' };
    }

    // Phase 2: Calculate progress
    logger.info('Phase 2: Calculating OKR progress...');
    const progressData = await calculateOKRProgress(okrData, operationalData);

    if (!progressData) {
      throw new Error('Failed to calculate OKR progress');
    }

    // Phase 3: Analyze alignment
    logger.info('Phase 3: Analyzing OKR alignment...');
    const alignmentData = await analyzeOKRAlignment(okrData, progressData);

    // Phase 4: Track historical completion
    logger.info('Phase 4: Analyzing historical trends...');
    const historicalData = trackHistoricalCompletion(okrData);

    // Phase 5: Generate and distribute weekly summary
    logger.info('Phase 5: Generating weekly summary...');
    const summary = await generateWeeklySummary(progressData, alignmentData, historicalData);

    if (!summary) {
      throw new Error('Failed to generate weekly summary');
    }

    const reportPath = saveWeeklySummary(summary);
    await storeOKRMetrics(progressData, alignmentData);
    await syncOKRsToDashboard(progressData, alignmentData);

    // Send to CEO
    const emailHtml = summaryToHtml(summary);
    await sendCEOEmail({
      subject: `Weekly OKR Summary - ${new Date().toLocaleDateString('de-CH', { month: 'long', day: 'numeric' })}`,
      html: emailHtml,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Weekly OKR tracking complete in ${elapsed}s ===`);

    return { success: true, reportPath, elapsed };
  } catch (err) {
    logger.error(`Weekly OKR tracking failed: ${err.message}`, { stack: err.stack });

    try {
      await sendCEOEmail({
        subject: 'OKR Tracking FEHLER',
        html: `<div style="padding:20px;background:#fff3f3;border-left:4px solid #e94560;">
          <h2>OKR Tracking fehlgeschlagen</h2>
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

/**
 * Monthly OKR review and historical archival.
 */
async function runMonthlyOKRReview() {
  const startTime = Date.now();
  logger.info('=== Starting Monthly OKR Review ===');

  try {
    // Run weekly tracking first
    const weeklyResult = await runWeeklyOKRTracking();

    // Archive quarterly OKRs if it's end of quarter
    const month = new Date().getMonth();
    const isQuarterEnd = [2, 5, 8, 11].includes(month); // March, June, Sept, Dec

    if (isQuarterEnd) {
      logger.info('Quarter end detected, archiving OKR completion data...');
      const okrData = loadOKRData();

      // Calculate quarter completion
      const quarter = Math.floor(month / 3) + 1;
      const year = new Date().getFullYear();

      // This would need actual completion data - simplified here
      const quarterRecord = {
        period: `Q${quarter} ${year}`,
        totalOKRs: okrData.company.length + Object.values(okrData.departments).flat().length,
        completed: 0, // Would be calculated from actual completion data
        archivedAt: new Date().toISOString(),
      };

      okrData.historical = okrData.historical || [];
      okrData.historical.push(quarterRecord);

      saveOKRData(okrData);
      logger.info(`Quarter ${quarter} OKR data archived`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Monthly OKR review complete in ${elapsed}s ===`);

    return { success: true, elapsed };
  } catch (err) {
    logger.error(`Monthly OKR review failed: ${err.message}`, { stack: err.stack });
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function start() {
  logger.info(`OKR Tracker Agent starting.`);
  logger.info(`  Weekly tracking: ${WEEKLY_SCHEDULE}`);
  logger.info(`  Monthly review:  ${MONTHLY_SCHEDULE}`);

  cron.schedule(WEEKLY_SCHEDULE, () => {
    logger.info('Cron triggered: weekly OKR tracking');
    runWeeklyOKRTracking();
  }, { timezone: TIMEZONE });

  cron.schedule(MONTHLY_SCHEDULE, () => {
    logger.info('Cron triggered: monthly OKR review');
    runMonthlyOKRReview();
  }, { timezone: TIMEZONE });

  logger.info('OKR Tracker Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--now') || args.includes('-n')) {
    logger.info('Running weekly OKR tracking immediately (manual trigger)');
    runWeeklyOKRTracking().then((result) => {
      if (result.success) {
        logger.info(`Tracking complete: ${result.reportPath || result.message}`);
      } else {
        logger.error(`Tracking failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else if (args.includes('--monthly') || args.includes('-m')) {
    logger.info('Running monthly OKR review immediately (manual trigger)');
    runMonthlyOKRReview().then((result) => {
      if (result.success) {
        logger.info('Monthly review complete');
      } else {
        logger.error(`Review failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else {
    start();
  }
}

module.exports = { start, runWeeklyOKRTracking, runMonthlyOKRReview };
