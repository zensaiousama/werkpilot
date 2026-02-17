/**
 * Enhanced CEO Morning Briefing v2
 *
 * Next-generation executive briefing that integrates with dashboard API
 * for real-time KPIs, agent health, pipeline changes, and overnight results.
 *
 * New features:
 * - Pulls data from dashboard API (/api/reports) instead of raw logs
 * - Includes night shift task execution summary
 * - Real-time KPI tracking with change detection
 * - Agent health monitoring by department
 * - Pipeline velocity and conversion metrics
 * - Top leads prioritization
 * - Recent activity timeline
 * - Syncs briefing to dashboard as notification
 *
 * Usage:
 *   node morning-briefing-v2.js --now    # Generate immediately
 *   node morning-briefing-v2.js          # Run on schedule (6:30 CET)
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const dashboardClient = require('../shared/utils/dashboard-client');
const dashboardSync = require('../shared/utils/dashboard-sync');
const config = require('../shared/utils/config');

const agentConfig = require('../config.json');
const logger = createLogger('ceo-morning-briefing-v2');

// ── Constants ────────────────────────────────────────────────────────────────

const AGENT_NAME = 'ceo-morning-briefing-v2';
const SCHEDULE = '30 6 * * *'; // 6:30 AM daily
const TIMEZONE = 'Europe/Zurich';

// ── Data Collection ──────────────────────────────────────────────────────────

/**
 * Fetch comprehensive report from dashboard API
 */
async function fetchDashboardReport() {
  try {
    logger.info('Fetching dashboard report from API...');

    const report = await dashboardClient.get('/api/reports');

    logger.info('Dashboard report fetched successfully');

    return report;
  } catch (error) {
    logger.error(`Failed to fetch dashboard report: ${error.message}`);

    // Return empty structure as fallback
    return {
      generatedAt: new Date().toISOString(),
      kpis: {},
      pipeline: { stages: [], totalInPipeline: 0 },
      agentHealth: { total: 0, running: 0, idle: 0, errored: 0, avgScore: 0 },
      nightShift: { totalTasks: 0, completed: 0, failed: 0, successRate: 0 },
      topLeads: [],
      recentActivities: [],
      industryBreakdown: [],
    };
  }
}

/**
 * Calculate KPI changes by comparing with previous briefing
 */
function calculateKPIChanges(currentKPIs) {
  const previousBriefingPath = path.join(
    __dirname,
    '../briefings',
    'latest-kpis.json'
  );

  let previousKPIs = {};

  try {
    if (fs.existsSync(previousBriefingPath)) {
      previousKPIs = JSON.parse(fs.readFileSync(previousBriefingPath, 'utf-8'));
    }
  } catch (error) {
    logger.warn('Could not load previous KPIs for comparison');
  }

  const changes = {};

  Object.keys(currentKPIs).forEach((key) => {
    const current = currentKPIs[key];
    const previous = previousKPIs[key];

    if (typeof current === 'number' && typeof previous === 'number') {
      const delta = current - previous;
      const percentChange = previous !== 0 ? ((delta / previous) * 100).toFixed(1) : 0;

      changes[key] = {
        current,
        previous,
        delta,
        percentChange: parseFloat(percentChange),
        trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
      };
    } else {
      changes[key] = {
        current,
        previous: previous || 'N/A',
        delta: 0,
        percentChange: 0,
        trend: 'stable',
      };
    }
  });

  // Save current KPIs for next comparison
  try {
    fs.mkdirSync(path.dirname(previousBriefingPath), { recursive: true });
    fs.writeFileSync(previousBriefingPath, JSON.stringify(currentKPIs, null, 2));
  } catch (error) {
    logger.warn('Could not save current KPIs for future comparison');
  }

  return changes;
}

// ── Briefing Generation ──────────────────────────────────────────────────────

/**
 * Build prompt for Claude to generate executive briefing
 */
function buildBriefingPrompt(report, kpiChanges) {
  return `Du bist der Executive Assistant des CEOs von Werkpilot, einem Schweizer AI-Automations-Startup.
Erstelle ein präzises, handlungsorientiertes Morning Briefing auf Deutsch.

DASHBOARD-DATEN (Live von API):

## KPIs & Changes:
${JSON.stringify(kpiChanges, null, 2)}

## Pipeline Status:
Total in Pipeline: ${report.pipeline.totalInPipeline}
Stages: ${JSON.stringify(report.pipeline.stages, null, 2)}

## Agent Health:
${JSON.stringify(report.agentHealth, null, 2)}

## Night Shift Summary:
${JSON.stringify(report.nightShift, null, 2)}

## Top Leads (by score):
${JSON.stringify(report.topLeads.slice(0, 5), null, 2)}

## Recent Activities:
${JSON.stringify(report.recentActivities.slice(0, 10), null, 2)}

## Industry Breakdown:
${JSON.stringify(report.industryBreakdown, null, 2)}

Pending Decisions: ${report.pendingDecisions || 0}

ANWEISUNGEN:

Erstelle ein strukturiertes Briefing mit folgenden Abschnitten:

1. **EXECUTIVE_SUMMARY** (3-5 Bullet Points)
   - Die wichtigsten Insights aus der Nacht
   - Kritische KPI-Veränderungen (nutze Trend-Emojis: ↗️ up, ↘️ down, → stable)
   - Dringende Handlungspunkte

2. **NIGHT_SHIFT_REPORT**
   - Zusammenfassung der overnight Tasks (${report.nightShift.completed} completed, ${report.nightShift.failed} failed)
   - Success Rate: ${report.nightShift.successRate}%
   - Wichtigste Ergebnisse

3. **KPI_SNAPSHOT** (Markdown-Tabelle)
   - MRR, Total Leads, Active Clients, Conversion Rate, Pipeline Value
   - Zeige Change-Indikatoren (↗️ +X%, ↘️ -X%, → stable)

4. **AGENT_HEALTH_TABLE** (Markdown-Tabelle)
   - Agent-Status nach Department
   - Spalten: Department | Total | Running | Errored | Avg Score | Health%
   - Nutze Emojis: ✅ healthy (>90%), ⚠️ warning (70-90%), ❌ critical (<70%)

5. **PIPELINE_HIGHLIGHTS**
   - Top 3-5 Leads mit höchsten Scores
   - Aktuelle Stage-Verteilung
   - Conversion Rate Trends

6. **URGENT_DECISIONS**
   - ${report.pendingDecisions || 0} pending decisions aus Dashboard
   - Priorisiere nach Business Impact
   - Pro Entscheidung: Kontext, 2-3 Optionen, Empfehlung

7. **TODAY_PRIORITIES**
   - 3-5 konkrete Action Items für heute
   - Basierend auf KPI-Trends, Agent-Status, Top Leads

8. **STRATEGIC_RECOMMENDATIONS**
   - 2-3 strategische Insights
   - Datengetriebene Empfehlungen

FORMAT:
Antworte im Markdown-Format. Nutze für jeden Abschnitt das Label "### SECTION: <NAME>".
Sei präzise, handlungsorientiert und nutze Emojis sparsam aber effektiv.`;
}

/**
 * Parse Claude's response into sections
 */
function parseBriefingSections(text) {
  const sections = {};
  const sectionRegex = /### SECTION:\s*(\w+[\w_]*)\s*\n([\s\S]*?)(?=### SECTION:|$)/g;
  let match;

  while ((match = sectionRegex.exec(text)) !== null) {
    sections[match[1].trim()] = match[2].trim();
  }

  return sections;
}

/**
 * Build HTML email from sections
 */
function buildEmailHTML(sections, report) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('de-CH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

  // Convert markdown to HTML (simple conversion)
  const mdToHtml = (md) => {
    return md
      .replace(/^### (.+)$/gm, '<h3 style="color:#1a1a2e;margin-top:20px;border-bottom:1px solid #e0e0e0;padding-bottom:8px;">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="color:#16213e;margin-top:24px;border-bottom:2px solid #e94560;padding-bottom:8px;">$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0f3460;">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li style="margin:6px 0;line-height:1.5;">$1</li>')
      .replace(/\n\n/g, '</p><p style="margin:10px 0;line-height:1.6;">')
      .replace(/\n/g, '<br>')
      // Tables
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        if (cells.every(c => /^[\s-:]+$/.test(c))) return '';
        const tds = cells.map(c =>
          `<td style="padding:10px;border:1px solid #ddd;background:#f9f9f9;">${c.trim()}</td>`
        ).join('');
        return `<tr>${tds}</tr>`;
      });
  };

  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Werkpilot CEO Briefing</title>
</head>
<body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;margin:0;padding:0;background:#f5f5f5;">
  <div style="max-width:900px;margin:20px auto;background:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:30px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:28px;font-weight:600;">Werkpilot CEO Briefing v2</h1>
      <p style="margin:8px 0 0;opacity:0.9;font-size:15px;">${dateStr} • ${timeStr}</p>
    </div>

    <!-- Content -->
    <div style="padding:30px;background:#ffffff;">

      <!-- Executive Summary -->
      <div style="background:#e8f4f8;border-left:4px solid #0077b6;padding:20px;margin-bottom:24px;border-radius:4px;">
        <h2 style="margin:0 0 12px;color:#0077b6;font-size:20px;">📋 Executive Summary</h2>
        <p style="margin:0;line-height:1.6;">${mdToHtml(sections.EXECUTIVE_SUMMARY || 'Keine Daten verfügbar')}</p>
      </div>

      <!-- Night Shift Report -->
      <div style="margin-bottom:24px;">
        <h2 style="color:#16213e;margin:0 0 12px;font-size:20px;border-bottom:2px solid #e94560;padding-bottom:8px;">🌙 Night Shift Report</h2>
        <p style="margin:0;line-height:1.6;">${mdToHtml(sections.NIGHT_SHIFT_REPORT || 'Keine Night Shift Aktivität')}</p>
      </div>

      <!-- KPI Snapshot -->
      <div style="margin-bottom:24px;">
        <h2 style="color:#16213e;margin:0 0 12px;font-size:20px;border-bottom:2px solid #e94560;padding-bottom:8px;">📊 KPI Snapshot</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:10px;border:1px solid #ddd;text-align:left;">Metric</th>
              <th style="padding:10px;border:1px solid #ddd;text-align:right;">Value</th>
              <th style="padding:10px;border:1px solid #ddd;text-align:right;">Change</th>
            </tr>
          </thead>
          <tbody>
            ${mdToHtml(sections.KPI_SNAPSHOT || '| - | - | - |')}
          </tbody>
        </table>
      </div>

      <!-- Agent Health -->
      <div style="margin-bottom:24px;">
        <h2 style="color:#16213e;margin:0 0 12px;font-size:20px;border-bottom:2px solid #e94560;padding-bottom:8px;">🤖 Agent Health</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:10px;border:1px solid #ddd;text-align:left;">Department</th>
              <th style="padding:10px;border:1px solid #ddd;text-align:center;">Total</th>
              <th style="padding:10px;border:1px solid #ddd;text-align:center;">Running</th>
              <th style="padding:10px;border:1px solid #ddd;text-align:center;">Errored</th>
              <th style="padding:10px;border:1px solid #ddd;text-align:center;">Avg Score</th>
              <th style="padding:10px;border:1px solid #ddd;text-align:center;">Health</th>
            </tr>
          </thead>
          <tbody>
            ${mdToHtml(sections.AGENT_HEALTH_TABLE || '| - | - | - | - | - | - |')}
          </tbody>
        </table>
      </div>

      <!-- Pipeline Highlights -->
      <div style="margin-bottom:24px;">
        <h2 style="color:#16213e;margin:0 0 12px;font-size:20px;border-bottom:2px solid #e94560;padding-bottom:8px;">🎯 Pipeline Highlights</h2>
        <p style="margin:0;line-height:1.6;">${mdToHtml(sections.PIPELINE_HIGHLIGHTS || 'Keine Pipeline-Updates')}</p>
      </div>

      <!-- Urgent Decisions -->
      ${sections.URGENT_DECISIONS ? `
      <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:20px;margin-bottom:24px;border-radius:4px;">
        <h2 style="margin:0 0 12px;color:#856404;font-size:20px;">⚠️ Urgent Decisions</h2>
        <p style="margin:0;line-height:1.6;">${mdToHtml(sections.URGENT_DECISIONS)}</p>
      </div>
      ` : ''}

      <!-- Today's Priorities -->
      <div style="background:#d4edda;border-left:4px solid #28a745;padding:20px;margin-bottom:24px;border-radius:4px;">
        <h2 style="margin:0 0 12px;color:#155724;font-size:20px;">✅ Today's Priorities</h2>
        <p style="margin:0;line-height:1.6;">${mdToHtml(sections.TODAY_PRIORITIES || 'Keine besonderen Prioritäten')}</p>
      </div>

      <!-- Strategic Recommendations -->
      <div style="margin-bottom:24px;">
        <h2 style="color:#16213e;margin:0 0 12px;font-size:20px;border-bottom:2px solid #e94560;padding-bottom:8px;">💡 Strategic Recommendations</h2>
        <p style="margin:0;line-height:1.6;">${mdToHtml(sections.STRATEGIC_RECOMMENDATIONS || 'Keine Empfehlungen')}</p>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;padding:20px;text-align:center;border-radius:0 0 8px 8px;">
      <p style="margin:0;color:#666;font-size:13px;">
        🤖 Automatically generated by Werkpilot AI • Dashboard API Integration
      </p>
      <p style="margin:8px 0 0;color:#999;font-size:12px;">
        Report generated at ${new Date().toISOString()}
      </p>
    </div>

  </div>
</body>
</html>`;

  return html;
}

/**
 * Save briefing as markdown file
 */
function saveBriefing(sections, report) {
  const today = new Date().toISOString().split('T')[0];
  const briefingDir = path.join(__dirname, '../briefings');
  fs.mkdirSync(briefingDir, { recursive: true });

  const filePath = path.join(briefingDir, `${today}-v2.md`);

  const markdown = `# Werkpilot CEO Morning Briefing v2
Generated: ${new Date().toISOString()}

## Executive Summary
${sections.EXECUTIVE_SUMMARY || 'N/A'}

## Night Shift Report
${sections.NIGHT_SHIFT_REPORT || 'N/A'}

## KPI Snapshot
${sections.KPI_SNAPSHOT || 'N/A'}

## Agent Health
${sections.AGENT_HEALTH_TABLE || 'N/A'}

## Pipeline Highlights
${sections.PIPELINE_HIGHLIGHTS || 'N/A'}

## Urgent Decisions
${sections.URGENT_DECISIONS || 'None'}

## Today's Priorities
${sections.TODAY_PRIORITIES || 'N/A'}

## Strategic Recommendations
${sections.STRATEGIC_RECOMMENDATIONS || 'N/A'}

---
*Report Data: ${JSON.stringify(report.kpis, null, 2)}*
`;

  fs.writeFileSync(filePath, markdown, 'utf-8');
  logger.info(`Briefing saved to ${filePath}`);

  return filePath;
}

// ── Main Execution ───────────────────────────────────────────────────────────

/**
 * Generate morning briefing
 */
async function generateMorningBriefing() {
  const startTime = Date.now();
  logger.info('=== CEO Morning Briefing v2 - Starting ===');

  try {
    await dashboardSync.syncAgentStatus(AGENT_NAME, 'active');

    // Phase 1: Fetch data from dashboard API
    logger.info('Phase 1: Fetching dashboard report...');
    const report = await fetchDashboardReport();

    // Calculate KPI changes
    const kpiChanges = calculateKPIChanges(report.kpis);

    // Phase 2: Generate briefing with Claude
    logger.info('Phase 2: Generating briefing with Claude Opus...');
    const prompt = buildBriefingPrompt(report, kpiChanges);

    const briefingText = await generateText(prompt, {
      system: 'Du bist ein hocheffektiver Executive Assistant für einen Startup-CEO. Kommuniziere auf Deutsch, sei präzise und handlungsorientiert.',
      model: config.models.powerful, // Use Opus for high-quality briefings
      maxTokens: 8000,
      temperature: 0.6,
    });

    // Phase 3: Parse and assemble
    logger.info('Phase 3: Assembling briefing...');
    const sections = parseBriefingSections(briefingText);

    // Phase 4: Save and send
    logger.info('Phase 4: Saving and sending...');
    const savedPath = saveBriefing(sections, report);
    const emailHtml = buildEmailHTML(sections, report);

    const dateStr = new Date().toLocaleDateString('de-CH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    // Send email
    await sendCEOEmail({
      subject: `📋 Morning Briefing v2 - ${dateStr}`,
      html: emailHtml,
    });

    // Sync to dashboard as notification
    await dashboardSync.sendNotification(
      'CEO Morning Briefing Ready',
      `Morning briefing generated successfully. ${report.nightShift.completed} night shift tasks completed.`,
      'success',
      `/briefings/${new Date().toISOString().split('T')[0]}`
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Morning Briefing v2 complete in ${elapsed}s ===`);

    await dashboardSync.syncAgentStatus(AGENT_NAME, 'idle', 100, 1, 0);

    return { success: true, path: savedPath, elapsed };
  } catch (error) {
    logger.error(`Morning Briefing v2 failed: ${error.message}`, { stack: error.stack });

    // Send error notification
    await dashboardSync.sendNotification(
      'CEO Briefing Error',
      `Morning briefing generation failed: ${error.message}`,
      'error'
    );

    try {
      await sendCEOEmail({
        subject: '❌ Morning Briefing FEHLER',
        html: `
          <div style="font-family:sans-serif;padding:30px;background:#fff3f3;border-left:4px solid #e94560;">
            <h2 style="color:#c92a2a;">Morning Briefing konnte nicht generiert werden</h2>
            <p><strong>Fehler:</strong> ${error.message}</p>
            <p><strong>Zeit:</strong> ${new Date().toLocaleString('de-CH')}</p>
            <p>Das IT-Team wurde automatisch benachrichtigt.</p>
          </div>`,
      });
    } catch (emailErr) {
      logger.error(`Could not send error notification: ${emailErr.message}`);
    }

    await dashboardSync.syncAgentStatus(AGENT_NAME, 'error', 0, 0, 1);

    return { success: false, error: error.message };
  }
}

// ── Scheduling ───────────────────────────────────────────────────────────────

/**
 * Start scheduled briefing generation
 */
function start() {
  logger.info(`CEO Morning Briefing v2 starting. Schedule: ${SCHEDULE} (${TIMEZONE})`);

  cron.schedule(
    SCHEDULE,
    () => {
      logger.info('Cron triggered: morning briefing v2');
      generateMorningBriefing();
    },
    {
      timezone: TIMEZONE,
    }
  );

  logger.info('Morning Briefing v2 Agent is running and waiting for schedule...');
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--now') || args.includes('-n')) {
    logger.info('Running morning briefing immediately (manual trigger)');

    const result = await generateMorningBriefing();

    if (result.success) {
      logger.info(`Briefing generated successfully: ${result.path}`);
      console.log(JSON.stringify(result, null, 2));
    } else {
      logger.error(`Briefing generation failed: ${result.error}`);
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  } else {
    start();
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  start,
  generateMorningBriefing,
  fetchDashboardReport,
  calculateKPIChanges,
};

// Start if executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
