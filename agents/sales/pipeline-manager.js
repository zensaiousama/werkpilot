/**
 * Agent 14 — Pipeline Manager Agent
 *
 * Intelligent sales pipeline management with automatic stage progression,
 * stale lead detection, velocity tracking, and weekly reporting.
 *
 * Features:
 * - Automatic stage progression rules (fitness check + score → auto-advance)
 * - Stale lead detection (no activity in 14 days → alert)
 * - Pipeline velocity calculation per stage
 * - Weekly pipeline summary report
 * - Stage-specific actions and alerts
 *
 * Usage:
 *   node pipeline-manager.js --mode=update        # Update all pipeline stages
 *   node pipeline-manager.js --mode=detect-stale  # Find and alert on stale leads
 *   node pipeline-manager.js --mode=velocity      # Calculate pipeline velocity
 *   node pipeline-manager.js --mode=report        # Generate weekly summary
 */

const { createLogger } = require('../shared/utils/logger');
const { generateText } = require('../shared/utils/claude-client');
const { getRecords, updateRecord } = require('../shared/utils/airtable-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const dashboardSync = require('../shared/utils/dashboard-sync');
const config = require('../shared/utils/config');

const logger = createLogger('pipeline-manager');

// ── Constants ────────────────────────────────────────────────────────────────

const AGENT_NAME = 'pipeline-manager';
const TABLES = {
  LEADS: 'Leads',
};

// Pipeline stages (in order)
const PIPELINE_STAGES = [
  'New Lead',
  'Qualified',
  'Contacted',
  'Proposal Sent',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
];

// Stage progression rules
const PROGRESSION_RULES = {
  'New Lead → Qualified': {
    condition: (lead) => lead.QualificationScore >= 60,
    action: 'Auto-qualified based on score',
  },
  'Qualified → Contacted': {
    condition: (lead) =>
      (lead.FitnessCheckScore && lead.FitnessCheckScore > 70) &&
      (lead.QualificationScore && lead.QualificationScore >= 60),
    action: 'Auto-advanced: High fitness check + qualified',
  },
  'Contacted → Proposal Sent': {
    condition: (lead) => lead.MeetingCompleted === true,
    action: 'Auto-advanced: Meeting completed',
  },
};

// Stale lead threshold (days)
const STALE_THRESHOLD_DAYS = 14;

// Velocity calculation period (days)
const VELOCITY_PERIOD_DAYS = 30;

// ── Stage Progression ────────────────────────────────────────────────────────

/**
 * Check if lead should progress to next stage
 */
function shouldProgress(lead) {
  const currentStage = lead.Status || 'New Lead';

  // Check each progression rule
  for (const [ruleKey, rule] of Object.entries(PROGRESSION_RULES)) {
    const [fromStage, toStage] = ruleKey.split(' → ');

    if (currentStage === fromStage && rule.condition(lead)) {
      return {
        shouldProgress: true,
        fromStage,
        toStage,
        action: rule.action,
      };
    }
  }

  return { shouldProgress: false };
}

/**
 * Progress lead to next stage
 */
async function progressLead(lead) {
  const progression = shouldProgress(lead);

  if (!progression.shouldProgress) {
    return { progressed: false };
  }

  logger.info(`Progressing ${lead.CompanyName}: ${progression.fromStage} → ${progression.toStage}`);

  try {
    await updateRecord(TABLES.LEADS, lead.id, {
      Status: progression.toStage,
      StageProgressedAt: new Date().toISOString(),
      StageProgressionNote: progression.action,
      LastActivity: new Date().toISOString(),
    });

    // Sync to dashboard
    await dashboardSync.syncLeadUpdate(lead.id, {
      status: progression.toStage,
      lastActivity: new Date().toISOString(),
    });

    // Send notification for significant progressions
    if (progression.toStage === 'Contacted' || progression.toStage === 'Proposal Sent') {
      await dashboardSync.sendNotification(
        'Lead Progressed',
        `${lead.CompanyName} moved to ${progression.toStage}`,
        'success',
        `/leads/${lead.id}`
      );
    }

    logger.info(`Lead progressed: ${lead.CompanyName} → ${progression.toStage}`);

    return {
      progressed: true,
      leadId: lead.id,
      companyName: lead.CompanyName,
      fromStage: progression.fromStage,
      toStage: progression.toStage,
    };
  } catch (error) {
    logger.error(`Failed to progress lead ${lead.CompanyName}: ${error.message}`);
    return {
      progressed: false,
      error: error.message,
    };
  }
}

/**
 * Update all leads in pipeline
 */
async function updatePipeline() {
  logger.info('Updating pipeline stages...');

  try {
    await dashboardSync.syncAgentStatus(AGENT_NAME, 'active');

    // Get all active leads (not closed)
    const leads = await getRecords(
      TABLES.LEADS,
      "AND({Status} != 'Closed Won', {Status} != 'Closed Lost', {Status} != 'Disqualified')"
    );

    logger.info(`Found ${leads.length} active leads`);

    const results = [];

    for (const lead of leads) {
      const result = await progressLead(lead);
      if (result.progressed) {
        results.push(result);
      }
    }

    logger.info(`Pipeline update complete: ${results.length} leads progressed`);

    if (results.length > 0) {
      await dashboardSync.sendNotification(
        'Pipeline Update Complete',
        `${results.length} leads auto-progressed`,
        'info'
      );
    }

    await dashboardSync.syncAgentStatus(AGENT_NAME, 'idle', 100, results.length, 0);

    return results;
  } catch (error) {
    logger.error(`Pipeline update error: ${error.message}`);
    await dashboardSync.syncAgentStatus(AGENT_NAME, 'error');
    throw error;
  }
}

// ── Stale Lead Detection ─────────────────────────────────────────────────────

/**
 * Detect stale leads (no activity in 14+ days)
 */
async function detectStaleLeads() {
  logger.info('Detecting stale leads...');

  try {
    const now = Date.now();
    const staleThreshold = now - (STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    // Get active leads
    const leads = await getRecords(
      TABLES.LEADS,
      "AND({Status} != 'Closed Won', {Status} != 'Closed Lost', {Status} != 'Disqualified')"
    );

    const staleLeads = leads.filter(lead => {
      const lastActivity = lead.LastActivity ? new Date(lead.LastActivity).getTime() :
                          lead.CreatedAt ? new Date(lead.CreatedAt).getTime() : 0;

      return lastActivity < staleThreshold;
    });

    logger.info(`Found ${staleLeads.length} stale leads (no activity in ${STALE_THRESHOLD_DAYS}+ days)`);

    if (staleLeads.length === 0) {
      return { staleLeads: [] };
    }

    // Update stale leads
    for (const lead of staleLeads) {
      await updateRecord(TABLES.LEADS, lead.id, {
        IsStale: true,
        StaleDetectedAt: new Date().toISOString(),
      });

      logger.info(`Marked as stale: ${lead.CompanyName} (last activity: ${lead.LastActivity || 'never'})`);
    }

    // Generate stale leads report
    const staleReport = staleLeads.map(lead => ({
      company: lead.CompanyName,
      stage: lead.Status,
      qualificationScore: lead.QualificationScore || 'N/A',
      lastActivity: lead.LastActivity || lead.CreatedAt || 'Unknown',
      daysSinceActivity: Math.floor((now - (lead.LastActivity ? new Date(lead.LastActivity).getTime() : new Date(lead.CreatedAt).getTime())) / (24 * 60 * 60 * 1000)),
    }));

    // Send email report to CEO
    const reportHtml = `
      <h2>Stale Leads Report</h2>
      <p>Found <strong>${staleLeads.length}</strong> leads with no activity in the last ${STALE_THRESHOLD_DAYS} days.</p>
      <table border="1" cellpadding="5" cellspacing="0">
        <thead>
          <tr>
            <th>Company</th>
            <th>Stage</th>
            <th>Score</th>
            <th>Last Activity</th>
            <th>Days Stale</th>
          </tr>
        </thead>
        <tbody>
          ${staleReport.map(lead => `
            <tr>
              <td>${lead.company}</td>
              <td>${lead.stage}</td>
              <td>${lead.qualificationScore}</td>
              <td>${lead.lastActivity}</td>
              <td>${lead.daysSinceActivity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p><strong>Action Required:</strong> Review these leads and re-engage or close.</p>
    `;

    await sendCEOEmail({
      subject: `Stale Leads Alert: ${staleLeads.length} leads need attention`,
      html: reportHtml,
    });

    // Send dashboard notification
    await dashboardSync.sendNotification(
      'Stale Leads Detected',
      `${staleLeads.length} leads have no activity in ${STALE_THRESHOLD_DAYS}+ days`,
      'warning'
    );

    logger.info(`Stale leads report sent to CEO`);

    return { staleLeads: staleReport };
  } catch (error) {
    logger.error(`Stale lead detection error: ${error.message}`);
    throw error;
  }
}

// ── Pipeline Velocity ────────────────────────────────────────────────────────

/**
 * Calculate pipeline velocity per stage
 */
async function calculateVelocity() {
  logger.info(`Calculating pipeline velocity (last ${VELOCITY_PERIOD_DAYS} days)...`);

  try {
    const now = Date.now();
    const periodStart = now - (VELOCITY_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // Get all leads
    const leads = await getRecords(TABLES.LEADS);

    // Calculate metrics per stage
    const stageMetrics = {};

    for (const stage of PIPELINE_STAGES) {
      const leadsInStage = leads.filter(lead => lead.Status === stage);
      const leadsEnteredStage = leads.filter(lead => {
        const progressedAt = lead.StageProgressedAt ? new Date(lead.StageProgressedAt).getTime() : 0;
        return lead.Status === stage && progressedAt >= periodStart;
      });

      // Calculate average time in stage
      const timesInStage = leadsInStage
        .filter(lead => lead.StageProgressedAt)
        .map(lead => {
          const enteredAt = new Date(lead.StageProgressedAt).getTime();
          const exitedAt = lead.StageExitedAt ? new Date(lead.StageExitedAt).getTime() : now;
          return exitedAt - enteredAt;
        });

      const avgTimeInStage = timesInStage.length > 0
        ? timesInStage.reduce((sum, time) => sum + time, 0) / timesInStage.length
        : 0;

      stageMetrics[stage] = {
        currentCount: leadsInStage.length,
        enteredInPeriod: leadsEnteredStage.length,
        avgDaysInStage: avgTimeInStage > 0 ? Math.round(avgTimeInStage / (24 * 60 * 60 * 1000)) : 0,
        velocity: leadsEnteredStage.length / VELOCITY_PERIOD_DAYS, // leads per day
      };
    }

    // Calculate overall pipeline velocity
    const totalEntered = Object.values(stageMetrics).reduce((sum, m) => sum + m.enteredInPeriod, 0);
    const totalClosedWon = stageMetrics['Closed Won']?.enteredInPeriod || 0;
    const conversionRate = totalEntered > 0 ? (totalClosedWon / totalEntered * 100).toFixed(1) : 0;

    logger.info(`Pipeline velocity calculated: ${totalEntered} leads entered, ${totalClosedWon} closed won (${conversionRate}% conversion)`);

    return {
      period: `Last ${VELOCITY_PERIOD_DAYS} days`,
      stages: stageMetrics,
      overall: {
        totalEntered,
        totalClosedWon,
        conversionRate: parseFloat(conversionRate),
      },
    };
  } catch (error) {
    logger.error(`Velocity calculation error: ${error.message}`);
    throw error;
  }
}

// ── Weekly Pipeline Report ───────────────────────────────────────────────────

/**
 * Generate weekly pipeline summary report
 */
async function generateWeeklyReport() {
  logger.info('Generating weekly pipeline report...');

  try {
    // Get all leads
    const leads = await getRecords(TABLES.LEADS);

    // Get velocity metrics
    const velocity = await calculateVelocity();

    // Stage breakdown
    const stageBreakdown = PIPELINE_STAGES.map(stage => ({
      stage,
      count: leads.filter(lead => lead.Status === stage).length,
      avgScore: calculateAvgScore(leads.filter(lead => lead.Status === stage)),
    }));

    // Top leads (highest qualification score, not closed)
    const topLeads = leads
      .filter(lead => lead.Status !== 'Closed Won' && lead.Status !== 'Closed Lost' && lead.Status !== 'Disqualified')
      .sort((a, b) => (b.QualificationScore || 0) - (a.QualificationScore || 0))
      .slice(0, 10)
      .map(lead => ({
        company: lead.CompanyName,
        stage: lead.Status,
        score: lead.QualificationScore || 'N/A',
        lastActivity: lead.LastActivity || lead.CreatedAt || 'N/A',
      }));

    // At-risk leads (qualified but no recent activity)
    const atRiskLeads = leads.filter(lead => {
      if (lead.Status === 'Closed Won' || lead.Status === 'Closed Lost' || lead.Status === 'Disqualified') {
        return false;
      }
      const lastActivity = lead.LastActivity ? new Date(lead.LastActivity).getTime() :
                          lead.CreatedAt ? new Date(lead.CreatedAt).getTime() : 0;
      const daysSinceActivity = Math.floor((Date.now() - lastActivity) / (24 * 60 * 60 * 1000));
      return daysSinceActivity >= 7 && daysSinceActivity < 14 && (lead.QualificationScore || 0) >= 60;
    });

    // Generate AI insights using Claude
    const insightsPrompt = `Analyze this sales pipeline data and provide 3-5 key insights and recommendations.

Pipeline Overview:
${stageBreakdown.map(s => `- ${s.stage}: ${s.count} leads (avg score: ${s.avgScore})`).join('\n')}

Velocity (last ${velocity.period}):
- Total leads entered: ${velocity.overall.totalEntered}
- Closed won: ${velocity.overall.totalClosedWon}
- Conversion rate: ${velocity.overall.conversionRate}%

At-risk leads: ${atRiskLeads.length} qualified leads with 7-14 days of inactivity

Provide actionable insights in German (Swiss business style).`;

    const insights = await generateText(insightsPrompt, {
      model: config.models.fast,
      maxTokens: 500,
    });

    // Build HTML report
    const reportHtml = `
      <h1>Weekly Pipeline Report</h1>
      <p><strong>Report Period:</strong> ${new Date().toISOString().split('T')[0]}</p>

      <h2>Pipeline Overview</h2>
      <table border="1" cellpadding="5" cellspacing="0">
        <thead>
          <tr>
            <th>Stage</th>
            <th>Count</th>
            <th>Avg Score</th>
          </tr>
        </thead>
        <tbody>
          ${stageBreakdown.map(s => `
            <tr>
              <td>${s.stage}</td>
              <td>${s.count}</td>
              <td>${s.avgScore}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Velocity Metrics (${velocity.period})</h2>
      <ul>
        <li><strong>Total Leads Entered:</strong> ${velocity.overall.totalEntered}</li>
        <li><strong>Closed Won:</strong> ${velocity.overall.totalClosedWon}</li>
        <li><strong>Conversion Rate:</strong> ${velocity.overall.conversionRate}%</li>
      </ul>

      <h2>Top 10 Leads</h2>
      <table border="1" cellpadding="5" cellspacing="0">
        <thead>
          <tr>
            <th>Company</th>
            <th>Stage</th>
            <th>Score</th>
            <th>Last Activity</th>
          </tr>
        </thead>
        <tbody>
          ${topLeads.map(lead => `
            <tr>
              <td>${lead.company}</td>
              <td>${lead.stage}</td>
              <td>${lead.score}</td>
              <td>${lead.lastActivity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>At-Risk Leads (${atRiskLeads.length})</h2>
      <p>Qualified leads with 7-14 days of inactivity - re-engage urgently!</p>
      ${atRiskLeads.length > 0 ? `
        <ul>
          ${atRiskLeads.map(lead => `<li>${lead.CompanyName} (${lead.Status})</li>`).join('')}
        </ul>
      ` : '<p>No at-risk leads this week.</p>'}

      <h2>AI Insights</h2>
      <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #0066cc;">
        ${insights.split('\n').map(line => `<p>${line}</p>`).join('')}
      </div>

      <hr>
      <p><small>Generated by Pipeline Manager Agent on ${new Date().toISOString()}</small></p>
    `;

    // Send report
    await sendCEOEmail({
      subject: 'Weekly Pipeline Report',
      html: reportHtml,
    });

    // Send dashboard notification
    await dashboardSync.sendNotification(
      'Weekly Pipeline Report',
      `Pipeline report generated: ${velocity.overall.totalEntered} leads entered, ${velocity.overall.conversionRate}% conversion`,
      'info'
    );

    logger.info('Weekly pipeline report sent');

    return {
      stageBreakdown,
      velocity,
      topLeads,
      atRiskLeads: atRiskLeads.length,
      insights,
    };
  } catch (error) {
    logger.error(`Weekly report generation error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate average qualification score for a group of leads
 */
function calculateAvgScore(leads) {
  const scoresWithValues = leads.filter(lead => lead.QualificationScore).map(lead => lead.QualificationScore);
  if (scoresWithValues.length === 0) return 'N/A';
  const avg = scoresWithValues.reduce((sum, score) => sum + score, 0) / scoresWithValues.length;
  return Math.round(avg);
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1];

  if (mode === 'update') {
    const results = await updatePipeline();
    console.log(JSON.stringify(results, null, 2));
  } else if (mode === 'detect-stale') {
    const results = await detectStaleLeads();
    console.log(JSON.stringify(results, null, 2));
  } else if (mode === 'velocity') {
    const results = await calculateVelocity();
    console.log(JSON.stringify(results, null, 2));
  } else if (mode === 'report') {
    const results = await generateWeeklyReport();
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('Usage:');
    console.log('  node pipeline-manager.js --mode=update');
    console.log('  node pipeline-manager.js --mode=detect-stale');
    console.log('  node pipeline-manager.js --mode=velocity');
    console.log('  node pipeline-manager.js --mode=report');
    process.exit(1);
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  updatePipeline,
  detectStaleLeads,
  calculateVelocity,
  generateWeeklyReport,
  progressLead,
  shouldProgress,
};

// Start if executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
