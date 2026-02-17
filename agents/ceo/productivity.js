/**
 * Werkpilot CEO Productivity Agent
 *
 * Manages the CEO's weekly productivity rhythm:
 * - Weekly themes: Mon=Strategy, Tue=Clients, Wed=Product, Thu=Growth, Fri=Analytics
 * - Daily focus reminders at 08:00 with theme + top 3 priorities
 * - Time tracking per category
 * - Weekly review every Friday at 16:00
 * - Delegation check: if >30min on a task, suggests agent delegation
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const agentConfig = require('./config.json');
const logger = createLogger('ceo-productivity');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const TIME_TRACKING_FILE = path.join(__dirname, 'data', 'time-tracking.json');
const TASKS_FILE = path.join(__dirname, 'data', 'active-tasks.json');

// ---------------------------------------------------------------------------
// Data Persistence Helpers
// ---------------------------------------------------------------------------

function ensureDataDir() {
  const dataDir = path.join(__dirname, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
}

function loadJSON(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    logger.warn(`Could not load ${filePath}: ${err.message}`);
  }
  return defaultValue;
}

function saveJSON(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Weekly Theme Management
// ---------------------------------------------------------------------------

/**
 * Get today's theme based on the day of the week.
 */
function getTodayTheme() {
  const dayName = DAYS_OF_WEEK[new Date().getDay()];
  const theme = agentConfig.productivity.weeklyThemes[dayName];

  if (!theme) {
    return {
      dayName,
      theme: 'Freier Tag',
      emoji: '\u{1F3D6}\u{FE0F}',
      focus: 'Erholung und Regeneration',
      isWorkday: false,
    };
  }

  return { dayName, ...theme, isWorkday: true };
}

/**
 * Get the week number and year for tracking.
 */
function getWeekKey() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const daysSinceStart = Math.floor((now - startOfYear) / 86400000);
  const weekNum = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Time Tracking
// ---------------------------------------------------------------------------

/**
 * Get or initialize time tracking data for the current week.
 */
function getWeeklyTimeData() {
  const allData = loadJSON(TIME_TRACKING_FILE, {});
  const weekKey = getWeekKey();

  if (!allData[weekKey]) {
    allData[weekKey] = {
      week: weekKey,
      categories: {},
      tasks: [],
      totalMinutes: 0,
      delegationChecks: [],
    };

    // Initialize categories
    for (const cat of agentConfig.productivity.timeCategories) {
      allData[weekKey].categories[cat] = { minutes: 0, entries: [] };
    }

    saveJSON(TIME_TRACKING_FILE, allData);
  }

  return allData[weekKey];
}

/**
 * Log time to a category.
 */
function logTime(category, minutes, description = '') {
  const allData = loadJSON(TIME_TRACKING_FILE, {});
  const weekKey = getWeekKey();
  const weekData = allData[weekKey] || getWeeklyTimeData();

  if (!weekData.categories[category]) {
    weekData.categories[category] = { minutes: 0, entries: [] };
  }

  const entry = {
    timestamp: new Date().toISOString(),
    minutes,
    description,
  };

  weekData.categories[category].minutes += minutes;
  weekData.categories[category].entries.push(entry);
  weekData.totalMinutes += minutes;

  allData[weekKey] = weekData;
  saveJSON(TIME_TRACKING_FILE, allData);

  logger.info(`Logged ${minutes}min to ${category}: ${description}`);

  // Delegation check
  if (minutes >= agentConfig.productivity.delegationCheckMinutes) {
    triggerDelegationCheck(category, minutes, description);
  }

  return weekData;
}

/**
 * Start tracking a task (for delegation monitoring).
 */
function startTask(taskId, category, description) {
  const tasks = loadJSON(TASKS_FILE, { active: {} });

  tasks.active[taskId] = {
    id: taskId,
    category,
    description,
    startedAt: new Date().toISOString(),
    checkTriggered: false,
  };

  saveJSON(TASKS_FILE, tasks);
  logger.info(`Task started: ${taskId} - ${description}`);

  return tasks.active[taskId];
}

/**
 * Stop tracking a task and log the time.
 */
function stopTask(taskId) {
  const tasks = loadJSON(TASKS_FILE, { active: {} });
  const task = tasks.active[taskId];

  if (!task) {
    logger.warn(`Task not found: ${taskId}`);
    return null;
  }

  const startTime = new Date(task.startedAt);
  const minutes = Math.round((Date.now() - startTime.getTime()) / 60000);

  logTime(task.category, minutes, task.description);

  delete tasks.active[taskId];
  saveJSON(TASKS_FILE, tasks);

  logger.info(`Task stopped: ${taskId} - ${minutes}min`);
  return { ...task, minutes };
}

// ---------------------------------------------------------------------------
// Delegation Check
// ---------------------------------------------------------------------------

/**
 * Check active tasks for delegation opportunities (>30min threshold).
 */
async function checkActiveTasks() {
  const tasks = loadJSON(TASKS_FILE, { active: {} });
  const threshold = agentConfig.productivity.delegationCheckMinutes;

  for (const [taskId, task] of Object.entries(tasks.active)) {
    if (task.checkTriggered) continue;

    const startTime = new Date(task.startedAt);
    const minutes = Math.round((Date.now() - startTime.getTime()) / 60000);

    if (minutes >= threshold) {
      task.checkTriggered = true;
      saveJSON(TASKS_FILE, tasks);
      await triggerDelegationCheck(task.category, minutes, task.description);
    }
  }
}

/**
 * Ask Claude if a task could be delegated to an agent.
 */
async function triggerDelegationCheck(category, minutes, description) {
  logger.info(`Delegation check triggered: ${description} (${minutes}min in ${category})`);

  try {
    const analysis = await generateJSON(
      `Der CEO arbeitet seit ${minutes} Minuten an folgender Aufgabe:
Kategorie: ${category}
Beschreibung: ${description}

Werkpilot hat folgende AI-Agenten zur Verfügung:
- Sales Agent: Lead-Generierung, CRM-Updates, Follow-ups
- Marketing Agent: Content-Erstellung, SEO, Social Media
- Operations Agent: Prozessautomatisierung, Reporting
- Finance Agent: Buchhaltung, Rechnungen, Forecasting
- HR Agent: Recruiting, Onboarding
- IT Agent: System-Monitoring, Deployments
- Product Agent: Feature-Tracking, Bug-Management
- Strategy Agent: Marktanalyse, Wettbewerb

Kann ein Agent diese Aufgabe (teilweise) übernehmen?

Antworte als JSON:
{
  "canDelegate": true/false,
  "suggestedAgent": "Name des Agenten oder null",
  "delegationPlan": "Wie der Agent helfen kann",
  "ceoRemainder": "Was der CEO selbst machen muss",
  "timeSavings": "Geschätzte Zeitersparnis in Minuten"
}`,
      {
        system: 'Du bist ein Produktivitätsberater für Startup-CEOs. Antworte auf Deutsch als valides JSON.',
        model: agentConfig.models.productivity,
        maxTokens: 1024,
      }
    );

    if (analysis.canDelegate) {
      logger.info(`Delegation possible: ${analysis.suggestedAgent} - ${analysis.delegationPlan}`);

      await sendCEOEmail({
        subject: `Delegation Check: ${description}`,
        html: `
          <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#ffd166;padding:16px 20px;border-radius:8px 8px 0 0;">
              <h2 style="margin:0;color:#1a1a2e;">\u{23F0} Delegation Check</h2>
              <p style="margin:4px 0 0;color:#333;">Sie arbeiten seit <strong>${minutes} Minuten</strong> an dieser Aufgabe.</p>
            </div>
            <div style="padding:16px 20px;background:#fff;border:1px solid #eee;">
              <p><strong>Aufgabe:</strong> ${description}</p>
              <p><strong>Kategorie:</strong> ${category}</p>

              <div style="background:#e8f5e9;padding:12px 16px;border-radius:8px;margin:12px 0;">
                <h3 style="margin:0 0 8px;color:#2e7d32;">\u{1F916} ${analysis.suggestedAgent} kann helfen!</h3>
                <p style="margin:4px 0;"><strong>Plan:</strong> ${analysis.delegationPlan}</p>
                <p style="margin:4px 0;"><strong>Sie machen:</strong> ${analysis.ceoRemainder}</p>
                <p style="margin:4px 0;"><strong>Zeitersparnis:</strong> ~${analysis.timeSavings} Minuten</p>
              </div>
            </div>
            <div style="padding:12px 20px;background:#f8f9fa;border-radius:0 0 8px 8px;text-align:center;font-size:12px;color:#666;">
              Werkpilot Productivity Agent
            </div>
          </div>`,
      });

      // Log delegation suggestion
      const weekData = getWeeklyTimeData();
      weekData.delegationChecks.push({
        timestamp: new Date().toISOString(),
        task: description,
        category,
        minutes,
        suggestedAgent: analysis.suggestedAgent,
        plan: analysis.delegationPlan,
      });
      const allData = loadJSON(TIME_TRACKING_FILE, {});
      allData[getWeekKey()] = weekData;
      saveJSON(TIME_TRACKING_FILE, allData);
    }

    return analysis;
  } catch (err) {
    logger.error(`Delegation check failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Daily Focus Reminder
// ---------------------------------------------------------------------------

/**
 * Generate and send the daily focus reminder at 08:00.
 */
async function sendDailyFocusReminder() {
  const today = getTodayTheme();

  if (!today.isWorkday) {
    logger.info('Not a workday, skipping focus reminder');
    return;
  }

  logger.info(`Generating daily focus reminder: ${today.theme}`);

  try {
    // Get relevant data for today's theme
    let contextData = '';
    try {
      const themeToTable = {
        'Strategie': ['Projects', 'Tasks'],
        'Kunden': ['Clients', 'Leads'],
        'Produkt': ['Projects', 'Tasks'],
        'Wachstum': ['Leads', 'Revenue'],
        'Analytics': ['Revenue', 'AgentStatus'],
      };

      const tables = themeToTable[today.theme] || ['Tasks'];
      for (const table of tables) {
        try {
          const records = await getRecords(table, '', 20);
          contextData += `\n${table}: ${JSON.stringify(records.slice(0, 10))}\n`;
        } catch (e) {
          // Table might not exist yet
        }
      }
    } catch (err) {
      logger.warn(`Could not fetch context data: ${err.message}`);
    }

    // Get recent time tracking for context
    const weekData = getWeeklyTimeData();

    const priorities = await generateJSON(
      `Es ist ${DAYS_OF_WEEK[new Date().getDay()]}, das Tages-Thema ist "${today.theme}" (${today.focus}).

Aktuelle Daten:
${contextData}

Zeitverteilung diese Woche bisher:
${JSON.stringify(weekData.categories, null, 2)}

Erstelle die Top 3 Prioritäten für den heutigen Tag, passend zum Thema.

Antworte als JSON:
{
  "greeting": "Personalisierte Begrüssung (1 Satz)",
  "themeInsight": "Kurzer Insight zum Tages-Thema (1-2 Sätze)",
  "priorities": [
    {
      "rank": 1,
      "title": "Priorität Titel",
      "description": "Was genau zu tun ist (1-2 Sätze)",
      "estimatedMinutes": 60,
      "category": "strategie"
    }
  ],
  "timeCheck": "Hinweis zur Zeitverteilung diese Woche (falls relevant)",
  "motivationalNote": "Motivierender Abschluss (1 Satz)"
}`,
      {
        system: 'Du bist ein Produktivitätscoach für einen Startup-CEO in der Schweiz. Antworte auf Deutsch. Sei motivierend aber pragmatisch.',
        model: agentConfig.models.productivity,
        maxTokens: 1024,
      }
    );

    // Format and send email
    const dayEmojis = {
      'Strategie': '\u{265F}\u{FE0F}',
      'Kunden': '\u{1F91D}',
      'Produkt': '\u{1F680}',
      'Wachstum': '\u{1F4C8}',
      'Analytics': '\u{1F4CA}',
    };

    const themeEmoji = dayEmojis[today.theme] || '\u{1F4CB}';
    const dateStr = new Date().toLocaleDateString('de-CH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    const prioritiesHtml = (priorities.priorities || []).map((p, i) => {
      const colors = ['#0f3460', '#16213e', '#1a1a2e'];
      return `
        <div style="display:flex;align-items:flex-start;gap:12px;margin:12px 0;padding:12px;background:#f8f9fa;border-radius:8px;border-left:4px solid ${colors[i] || colors[0]};">
          <div style="background:${colors[i] || colors[0]};color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;flex-shrink:0;">${p.rank}</div>
          <div>
            <strong style="font-size:15px;">${p.title}</strong>
            <p style="margin:4px 0;color:#555;font-size:14px;">${p.description}</p>
            <span style="font-size:12px;color:#888;">~${p.estimatedMinutes} Min. | ${p.category}</span>
          </div>
        </div>`;
    }).join('');

    const emailHtml = `
      <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">${themeEmoji}</div>
          <h1 style="margin:0;font-size:22px;">${today.theme}-Tag</h1>
          <p style="margin:4px 0 0;opacity:0.85;font-size:14px;">${dateStr}</p>
        </div>

        <div style="padding:20px 24px;background:#ffffff;border:1px solid #eee;">
          <p style="font-size:16px;color:#333;">${priorities.greeting || 'Guten Morgen!'}</p>

          <div style="background:#e8eaf6;padding:12px 16px;border-radius:8px;margin:12px 0;">
            <p style="margin:0;color:#1a237e;"><strong>Thema heute:</strong> ${today.focus}</p>
            ${priorities.themeInsight ? `<p style="margin:8px 0 0;color:#333;">${priorities.themeInsight}</p>` : ''}
          </div>

          <h2 style="color:#16213e;margin-top:20px;font-size:18px;">Top 3 Prioritäten</h2>
          ${prioritiesHtml}

          ${priorities.timeCheck ? `
          <div style="background:#fff3e0;padding:10px 14px;border-radius:8px;margin:16px 0;font-size:13px;">
            <strong>\u{23F0} Zeit-Check:</strong> ${priorities.timeCheck}
          </div>` : ''}

          ${priorities.motivationalNote ? `
          <div style="text-align:center;padding:16px;margin-top:12px;">
            <p style="font-size:15px;color:#0f3460;font-style:italic;">"${priorities.motivationalNote}"</p>
          </div>` : ''}
        </div>

        <div style="padding:12px 24px;background:#f8f9fa;border-radius:0 0 8px 8px;border:1px solid #eee;border-top:none;text-align:center;font-size:12px;color:#888;">
          Werkpilot Productivity Agent \u{2022} Fokussiert bleiben!
        </div>
      </div>`;

    await sendCEOEmail({
      subject: `${themeEmoji} ${today.theme}-Tag: Deine Top 3 Prioritäten`,
      html: emailHtml,
    });

    logger.info(`Daily focus reminder sent: ${today.theme}`);
    return priorities;
  } catch (err) {
    logger.error(`Daily focus reminder failed: ${err.message}`, { stack: err.stack });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Weekly Review
// ---------------------------------------------------------------------------

/**
 * Generate and send the weekly review every Friday at 16:00.
 */
async function sendWeeklyReview() {
  logger.info('Generating weekly review...');

  try {
    // Collect the full week's data
    const weekData = getWeeklyTimeData();

    // Get all weekly time tracking data
    const allTimeData = loadJSON(TIME_TRACKING_FILE, {});
    const weekKeys = Object.keys(allTimeData).sort().slice(-4); // Last 4 weeks
    const historicalData = weekKeys.map(k => ({ week: k, ...allTimeData[k] }));

    // Collect Airtable data for the review
    let airtableContext = '';
    for (const table of ['Revenue', 'Clients', 'Leads', 'Projects', 'Decisions']) {
      try {
        const records = await getRecords(table, '', 20);
        airtableContext += `\n${table} (${records.length} Einträge): ${JSON.stringify(records.slice(0, 5))}\n`;
      } catch (e) {
        // Table might not exist
      }
    }

    const review = await generateJSON(
      `Erstelle einen Wochenreview für den CEO von Werkpilot.

ZEITVERTEILUNG DIESE WOCHE:
${JSON.stringify(weekData, null, 2)}

HISTORISCHE DATEN (letzte Wochen):
${JSON.stringify(historicalData, null, 2)}

BUSINESS-DATEN:
${airtableContext}

DELEGATIONS-CHECKS DIESE WOCHE:
${JSON.stringify(weekData.delegationChecks || [], null, 2)}

Erstelle einen umfassenden Wochenreview als JSON:
{
  "weekSummary": "Zusammenfassung der Woche (3-4 Sätze)",
  "achievements": ["Errungenschaft 1", "Errungenschaft 2", "Errungenschaft 3"],
  "timeAnalysis": {
    "totalHours": 0,
    "topCategory": "kategorie",
    "topCategoryHours": 0,
    "balanceScore": "gut/mittel/schlecht",
    "balanceComment": "Kommentar zur Work-Life-Balance"
  },
  "delegationReport": {
    "totalChecks": 0,
    "delegated": 0,
    "timeSaved": "geschätzte Zeit in Stunden",
    "suggestion": "Vorschlag für nächste Woche"
  },
  "kpiHighlights": [
    {"metric": "Metrik-Name", "value": "Wert", "trend": "up/down/stable", "comment": "Kurzer Kommentar"}
  ],
  "nextWeekFocus": [
    {"day": "Montag", "theme": "Strategie", "topPriority": "Was am wichtigsten ist"}
  ],
  "strategicInsight": "Eine strategische Erkenntnis aus der Woche",
  "weekRating": "1-10 Bewertung der Woche",
  "weekRatingComment": "Begründung der Bewertung"
}`,
      {
        system: 'Du bist ein Executive Coach für einen Startup-CEO. Antworte auf Deutsch als valides JSON. Sei ehrlich, konstruktiv und datenbasiert.',
        model: agentConfig.models.decisions, // Use standard model for review
        maxTokens: 3000,
      }
    );

    // Format the weekly review email
    const trendIcons = { up: '\u{2B06}\u{FE0F}', down: '\u{2B07}\u{FE0F}', stable: '\u{27A1}\u{FE0F}' };

    const achievementsHtml = (review.achievements || [])
      .map(a => `<li style="margin:6px 0;">\u{2705} ${a}</li>`)
      .join('');

    const kpiHtml = (review.kpiHighlights || [])
      .map(k => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${k.metric}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${k.value}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${trendIcons[k.trend] || ''} ${k.comment}</td>
        </tr>`)
      .join('');

    const nextWeekHtml = (review.nextWeekFocus || [])
      .map(d => `
        <div style="display:flex;gap:8px;margin:6px 0;padding:8px;background:#f8f9fa;border-radius:6px;">
          <strong style="min-width:80px;">${d.day}:</strong>
          <span>${d.theme} \u{2192} ${d.topPriority}</span>
        </div>`)
      .join('');

    const ratingColor = (review.weekRating || 5) >= 7 ? '#06d6a0' : (review.weekRating || 5) >= 4 ? '#ffd166' : '#e94560';

    const emailHtml = `
      <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:700px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:22px;">\u{1F4CA} Wochenreview</h1>
          <p style="margin:4px 0 0;opacity:0.85;">${getWeekKey()} | Werkpilot CEO</p>
        </div>

        <div style="padding:20px 24px;background:#ffffff;border:1px solid #eee;">
          <!-- Rating -->
          <div style="text-align:center;margin-bottom:20px;">
            <div style="display:inline-block;background:${ratingColor};color:white;width:64px;height:64px;line-height:64px;border-radius:50%;font-size:28px;font-weight:bold;">
              ${review.weekRating || '-'}
            </div>
            <p style="margin:8px 0 0;color:#666;">${review.weekRatingComment || ''}</p>
          </div>

          <!-- Summary -->
          <p style="font-size:15px;color:#333;line-height:1.6;">${review.weekSummary || ''}</p>

          <!-- Achievements -->
          <h2 style="color:#16213e;font-size:18px;border-bottom:2px solid #06d6a0;padding-bottom:8px;">Erfolge diese Woche</h2>
          <ul style="list-style:none;padding:0;">${achievementsHtml}</ul>

          <!-- Time Analysis -->
          <h2 style="color:#16213e;font-size:18px;border-bottom:2px solid #ffd166;padding-bottom:8px;">Zeitanalyse</h2>
          <div style="display:flex;gap:16px;flex-wrap:wrap;margin:12px 0;">
            <div style="background:#f0f4ff;padding:12px;border-radius:8px;flex:1;min-width:120px;text-align:center;">
              <div style="font-size:24px;font-weight:bold;color:#0f3460;">${review.timeAnalysis?.totalHours || 0}h</div>
              <div style="font-size:12px;color:#666;">Total</div>
            </div>
            <div style="background:#f0f4ff;padding:12px;border-radius:8px;flex:1;min-width:120px;text-align:center;">
              <div style="font-size:24px;font-weight:bold;color:#0f3460;">${review.timeAnalysis?.topCategory || '-'}</div>
              <div style="font-size:12px;color:#666;">Top Kategorie (${review.timeAnalysis?.topCategoryHours || 0}h)</div>
            </div>
            <div style="background:#f0f4ff;padding:12px;border-radius:8px;flex:1;min-width:120px;text-align:center;">
              <div style="font-size:24px;font-weight:bold;color:${ratingColor};">${review.timeAnalysis?.balanceScore || '-'}</div>
              <div style="font-size:12px;color:#666;">Balance</div>
            </div>
          </div>
          <p style="font-size:13px;color:#666;">${review.timeAnalysis?.balanceComment || ''}</p>

          <!-- Delegation Report -->
          ${review.delegationReport ? `
          <h2 style="color:#16213e;font-size:18px;border-bottom:2px solid #e94560;padding-bottom:8px;">Delegation Report</h2>
          <div style="background:#fff3e0;padding:12px 16px;border-radius:8px;margin:12px 0;">
            <p style="margin:4px 0;">\u{1F916} <strong>${review.delegationReport.totalChecks || 0}</strong> Delegation-Checks | <strong>${review.delegationReport.delegated || 0}</strong> delegiert | <strong>~${review.delegationReport.timeSaved || 0}h</strong> gespart</p>
            <p style="margin:4px 0;font-style:italic;">${review.delegationReport.suggestion || ''}</p>
          </div>` : ''}

          <!-- KPIs -->
          <h2 style="color:#16213e;font-size:18px;border-bottom:2px solid #0f3460;padding-bottom:8px;">KPI Highlights</h2>
          <table style="width:100%;border-collapse:collapse;margin:12px 0;">
            <tr style="background:#f0f4ff;">
              <th style="padding:8px;text-align:left;">Metrik</th>
              <th style="padding:8px;text-align:left;">Wert</th>
              <th style="padding:8px;text-align:left;">Trend</th>
            </tr>
            ${kpiHtml}
          </table>

          <!-- Next Week -->
          <h2 style="color:#16213e;font-size:18px;border-bottom:2px solid #16213e;padding-bottom:8px;">Nächste Woche</h2>
          ${nextWeekHtml}

          <!-- Strategic Insight -->
          ${review.strategicInsight ? `
          <div style="background:linear-gradient(135deg,#e8eaf6,#f3e5f5);padding:16px;border-radius:8px;margin:20px 0;text-align:center;">
            <p style="margin:0;font-size:15px;color:#1a237e;font-style:italic;">"\u{1F4A1} ${review.strategicInsight}"</p>
          </div>` : ''}
        </div>

        <div style="padding:12px 24px;background:#f8f9fa;border-radius:0 0 8px 8px;border:1px solid #eee;border-top:none;text-align:center;font-size:12px;color:#888;">
          Werkpilot Productivity Agent \u{2022} Wochenreview ${getWeekKey()}
        </div>
      </div>`;

    await sendCEOEmail({
      subject: `Wochenreview ${getWeekKey()} - Rating: ${review.weekRating}/10`,
      html: emailHtml,
    });

    // Save review data
    const reviewsDir = path.join(__dirname, 'data', 'reviews');
    fs.mkdirSync(reviewsDir, { recursive: true });
    fs.writeFileSync(
      path.join(reviewsDir, `${getWeekKey()}.json`),
      JSON.stringify(review, null, 2),
      'utf-8'
    );

    logger.info(`Weekly review sent and saved for ${getWeekKey()}`);
    return review;
  } catch (err) {
    logger.error(`Weekly review failed: ${err.message}`, { stack: err.stack });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function start() {
  ensureDataDir();

  const focusSchedule = agentConfig.productivity.focusReminderSchedule;
  const reviewSchedule = agentConfig.productivity.weeklyReviewSchedule;
  const timezone = agentConfig.productivity.timezone;

  logger.info(`CEO Productivity Agent starting`);
  logger.info(`  Focus reminder: ${focusSchedule}`);
  logger.info(`  Weekly review: ${reviewSchedule}`);
  logger.info(`  Timezone: ${timezone}`);

  // Daily focus reminder at 08:00 Mon-Fri
  cron.schedule(focusSchedule, () => {
    logger.info('Cron triggered: daily focus reminder');
    sendDailyFocusReminder();
  }, { timezone });

  // Weekly review Friday 16:00
  cron.schedule(reviewSchedule, () => {
    logger.info('Cron triggered: weekly review');
    sendWeeklyReview();
  }, { timezone });

  // Check active tasks for delegation every 10 minutes during work hours
  cron.schedule('*/10 8-18 * * 1-5', () => {
    checkActiveTasks();
  }, { timezone });

  logger.info('Productivity Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--focus') || args.includes('-f')) {
    logger.info('Sending daily focus reminder (manual trigger)');
    sendDailyFocusReminder().then(() => process.exit(0));
  } else if (args.includes('--review') || args.includes('-r')) {
    logger.info('Generating weekly review (manual trigger)');
    sendWeeklyReview().then(() => process.exit(0));
  } else if (args.includes('--log-time')) {
    const catIdx = args.indexOf('--log-time');
    const category = args[catIdx + 1] || 'admin';
    const minutes = parseInt(args[catIdx + 2], 10) || 30;
    const desc = args.slice(catIdx + 3).join(' ') || 'Manual entry';
    logTime(category, minutes, desc);
    console.log(`Logged ${minutes}min to ${category}: ${desc}`);
  } else if (args.includes('--status')) {
    const weekData = getWeeklyTimeData();
    console.log(`\nWeek: ${getWeekKey()}`);
    console.log(`Total: ${weekData.totalMinutes} minutes\n`);
    for (const [cat, data] of Object.entries(weekData.categories)) {
      if (data.minutes > 0) {
        console.log(`  ${cat}: ${data.minutes} min (${data.entries.length} entries)`);
      }
    }
    console.log(`\nDelegation checks: ${(weekData.delegationChecks || []).length}`);
  } else {
    start();
  }
}

module.exports = {
  start,
  sendDailyFocusReminder,
  sendWeeklyReview,
  logTime,
  startTask,
  stopTask,
  checkActiveTasks,
  getTodayTheme,
  getWeeklyTimeData,
};
