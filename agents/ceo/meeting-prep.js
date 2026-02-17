/**
 * Werkpilot CEO Meeting Preparation Agent (v2 - Enhanced)
 *
 * Comprehensive meeting preparation system that automates agenda generation,
 * participant briefing documents, action item tracking, time allocation,
 * cross-department data gathering, post-meeting summaries, and calendar
 * integration data structures.
 *
 * Features:
 * - Automatic agenda generation from pending decisions and OKRs
 * - Participant briefing document generation
 * - Action item tracking from previous meetings
 * - Time allocation recommendations per topic
 * - Pre-meeting data gathering from all departments
 * - Post-meeting summary generation
 * - Calendar integration data structures
 *
 * @module ceo/meeting-prep
 * @version 2.0.0
 * @author Werkpilot AI
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateJSON, generateText } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, updateRecord, createRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');
const dashboardClient = require('../shared/utils/dashboard-client');
const dashboardSync = require('../shared/utils/dashboard-sync');

const agentConfig = require('./config.json');
const logger = createLogger('ceo-meeting-prep');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_NAME = 'ceo-meeting-prep';
const MEETINGS_DIR = path.join(__dirname, 'meetings');
const ACTION_ITEMS_FILE = path.join(__dirname, 'meetings', 'action-items.json');
const MEETING_HISTORY_FILE = path.join(__dirname, 'meetings', 'history.json');
const TIMEZONE = 'Europe/Zurich';

/**
 * @typedef {Object} MeetingConfig
 * @property {string} id - Unique meeting identifier
 * @property {string} title - Meeting title
 * @property {string} type - 'standup' | 'weekly' | 'board' | 'client' | 'strategy' | 'one-on-one' | 'custom'
 * @property {string[]} participants - List of participant names/roles
 * @property {number} durationMinutes - Total meeting duration
 * @property {string} scheduledAt - ISO timestamp
 * @property {string} [recurrence] - Cron-like recurrence pattern
 * @property {Object} [context] - Additional context for agenda generation
 */

/**
 * @typedef {Object} AgendaItem
 * @property {number} order - Item order
 * @property {string} title - Topic title
 * @property {string} description - Brief description
 * @property {string} owner - Who owns this topic
 * @property {number} allocatedMinutes - Recommended time
 * @property {string} priority - 'critical' | 'high' | 'medium' | 'low'
 * @property {string} type - 'decision' | 'update' | 'discussion' | 'brainstorm' | 'review'
 * @property {Object[]} [supportingData] - Data points for this topic
 * @property {string[]} [preMeetingReading] - Links/references to read beforehand
 */

/**
 * @typedef {Object} ActionItem
 * @property {string} id - Unique action item ID
 * @property {string} meetingId - Source meeting ID
 * @property {string} title - Action item description
 * @property {string} assignee - Person responsible
 * @property {string} dueDate - ISO date string
 * @property {string} status - 'open' | 'in-progress' | 'done' | 'overdue' | 'cancelled'
 * @property {string} priority - 'critical' | 'high' | 'medium' | 'low'
 * @property {string} [notes] - Additional notes
 * @property {string} createdAt - ISO timestamp
 * @property {string} [completedAt] - ISO timestamp when completed
 */

/**
 * Default meeting type configurations with standard time allocations.
 */
const MEETING_TYPES = {
  standup: {
    defaultDuration: 15,
    sections: ['blockers', 'today-focus', 'quick-updates'],
    maxAgendaItems: 5,
  },
  weekly: {
    defaultDuration: 60,
    sections: ['review-action-items', 'kpi-review', 'decisions', 'department-updates', 'next-week-priorities'],
    maxAgendaItems: 10,
  },
  board: {
    defaultDuration: 120,
    sections: ['financials', 'strategy', 'product', 'growth', 'risks', 'decisions', 'aob'],
    maxAgendaItems: 15,
  },
  client: {
    defaultDuration: 45,
    sections: ['relationship-check', 'project-updates', 'issues', 'next-steps'],
    maxAgendaItems: 8,
  },
  strategy: {
    defaultDuration: 90,
    sections: ['market-analysis', 'competitive-landscape', 'strategic-initiatives', 'resource-allocation', 'decisions'],
    maxAgendaItems: 8,
  },
  'one-on-one': {
    defaultDuration: 30,
    sections: ['wellbeing', 'wins', 'challenges', 'goals', 'feedback'],
    maxAgendaItems: 6,
  },
  custom: {
    defaultDuration: 60,
    sections: ['agenda-items'],
    maxAgendaItems: 12,
  },
};

/**
 * Department data sources for pre-meeting intelligence gathering.
 */
const DEPARTMENT_SOURCES = {
  sales: { tables: ['Leads', 'Clients'], logDir: 'sales' },
  marketing: { tables: ['Leads'], logDir: 'marketing' },
  finance: { tables: ['Revenue'], logDir: 'finance' },
  operations: { tables: ['Projects', 'Tasks'], logDir: 'operations' },
  hr: { tables: [], logDir: 'hr' },
  it: { tables: ['AgentStatus'], logDir: 'it' },
  product: { tables: ['Projects', 'Tasks'], logDir: 'product' },
  strategy: { tables: ['Decisions'], logDir: 'strategy' },
  ceo: { tables: ['Decisions'], logDir: 'ceo' },
};

// ---------------------------------------------------------------------------
// File System Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the meetings directory exists.
 * @returns {void}
 */
function ensureDirectories() {
  fs.mkdirSync(MEETINGS_DIR, { recursive: true });
}

/**
 * Load JSON file with fallback default.
 * @param {string} filePath - Absolute path
 * @param {*} defaultValue - Default if file missing
 * @returns {*} Parsed data or default
 */
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

/**
 * Save JSON file atomically.
 * @param {string} filePath - Absolute path
 * @param {*} data - Data to save
 * @returns {void}
 */
function saveJSON(filePath, data) {
  ensureDirectories();
  const tempPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    logger.error(`Failed to save ${filePath}: ${err.message}`);
    try { fs.unlinkSync(tempPath); } catch (_) { /* ignore */ }
    throw err;
  }
}

/**
 * Generate a unique ID for meetings and action items.
 * @param {string} prefix - ID prefix
 * @returns {string} Unique ID
 */
function generateId(prefix = 'mtg') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

// ---------------------------------------------------------------------------
// Action Item Tracking
// ---------------------------------------------------------------------------

/**
 * Get all action items, optionally filtered by status.
 *
 * @param {Object} [filters={}] - Filter options
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.assignee] - Filter by assignee
 * @param {string} [filters.meetingId] - Filter by meeting
 * @returns {ActionItem[]} Filtered action items
 */
function getActionItems(filters = {}) {
  const data = loadJSON(ACTION_ITEMS_FILE, { items: [] });
  let items = data.items || [];

  if (filters.status) {
    items = items.filter(i => i.status === filters.status);
  }
  if (filters.assignee) {
    items = items.filter(i => i.assignee === filters.assignee);
  }
  if (filters.meetingId) {
    items = items.filter(i => i.meetingId === filters.meetingId);
  }

  // Auto-mark overdue items
  const now = new Date();
  items.forEach(item => {
    if (item.status === 'open' && item.dueDate && new Date(item.dueDate) < now) {
      item.status = 'overdue';
    }
  });

  return items;
}

/**
 * Create a new action item.
 *
 * @param {Object} item - Action item data
 * @param {string} item.meetingId - Source meeting ID
 * @param {string} item.title - Description
 * @param {string} item.assignee - Person responsible
 * @param {string} item.dueDate - Due date ISO string
 * @param {string} [item.priority='medium'] - Priority level
 * @param {string} [item.notes] - Additional notes
 * @returns {ActionItem} Created action item
 */
function createActionItem(item) {
  const data = loadJSON(ACTION_ITEMS_FILE, { items: [] });

  const actionItem = {
    id: generateId('ai'),
    meetingId: item.meetingId,
    title: item.title,
    assignee: item.assignee,
    dueDate: item.dueDate,
    status: 'open',
    priority: item.priority || 'medium',
    notes: item.notes || '',
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  data.items.push(actionItem);
  saveJSON(ACTION_ITEMS_FILE, data);

  logger.info(`Action item created: "${actionItem.title}" -> ${actionItem.assignee}`);
  return actionItem;
}

/**
 * Update an action item's status.
 *
 * @param {string} itemId - The action item ID
 * @param {Object} updates - Fields to update
 * @returns {ActionItem|null} Updated item or null if not found
 */
function updateActionItem(itemId, updates) {
  const data = loadJSON(ACTION_ITEMS_FILE, { items: [] });
  const item = data.items.find(i => i.id === itemId);

  if (!item) {
    logger.warn(`Action item not found: ${itemId}`);
    return null;
  }

  Object.assign(item, updates);

  if (updates.status === 'done') {
    item.completedAt = new Date().toISOString();
  }

  saveJSON(ACTION_ITEMS_FILE, data);
  logger.info(`Action item updated: ${itemId} -> ${JSON.stringify(updates)}`);
  return item;
}

/**
 * Get a summary of open action items for meeting preparation.
 *
 * @returns {Object} Summary with counts and items grouped by assignee
 */
function getActionItemSummary() {
  const items = getActionItems();
  const open = items.filter(i => i.status === 'open' || i.status === 'in-progress');
  const overdue = items.filter(i => i.status === 'overdue');
  const done = items.filter(i => i.status === 'done');

  // Group by assignee
  const byAssignee = {};
  open.forEach(item => {
    if (!byAssignee[item.assignee]) {
      byAssignee[item.assignee] = [];
    }
    byAssignee[item.assignee].push(item);
  });

  return {
    total: items.length,
    open: open.length,
    overdue: overdue.length,
    done: done.length,
    completionRate: items.length > 0 ? Math.round((done.length / items.length) * 100) : 0,
    byAssignee,
    overdueItems: overdue,
    recentlyCompleted: done.filter(i => {
      const completedDate = new Date(i.completedAt);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return completedDate > weekAgo;
    }),
  };
}

// ---------------------------------------------------------------------------
// Pre-Meeting Data Gathering
// ---------------------------------------------------------------------------

/**
 * Gather data from all departments for meeting preparation.
 * Pulls from Airtable tables, agent logs, and the dashboard API.
 *
 * @param {string} meetingType - The type of meeting
 * @param {string[]} [specificDepartments] - Limit to specific departments
 * @returns {Promise<Object>} Aggregated department data
 */
async function gatherDepartmentData(meetingType, specificDepartments = null) {
  logger.info(`Gathering department data for ${meetingType} meeting...`);

  const departments = specificDepartments || Object.keys(DEPARTMENT_SOURCES);
  const data = {};

  // Fetch from Airtable tables in parallel
  const tablePromises = [];
  const tableMapping = {};

  for (const dept of departments) {
    const source = DEPARTMENT_SOURCES[dept];
    if (!source) continue;

    data[dept] = { tables: {}, logs: null };

    for (const table of source.tables) {
      if (!tableMapping[table]) {
        tableMapping[table] = [];
        tablePromises.push(
          getRecords(table, '', 30)
            .then(records => ({ table, records }))
            .catch(err => {
              logger.warn(`Could not fetch ${table}: ${err.message}`);
              return { table, records: [] };
            })
        );
      }
      tableMapping[table].push(dept);
    }

    // Read recent logs
    const logPath = path.join(config.paths.logs, source.logDir, 'combined.log');
    try {
      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf-8');
        const lines = content.trim().split('\n').slice(-20);
        data[dept].logs = lines.join('\n');
      }
    } catch (err) {
      logger.warn(`Could not read logs for ${dept}: ${err.message}`);
    }
  }

  // Resolve all table fetches
  const tableResults = await Promise.all(tablePromises);
  for (const { table, records } of tableResults) {
    const depts = tableMapping[table] || [];
    for (const dept of depts) {
      if (data[dept]) {
        data[dept].tables[table] = records;
      }
    }
  }

  // Fetch dashboard report for KPIs
  try {
    const dashboardReport = await dashboardClient.get('/api/reports');
    data._dashboard = dashboardReport;
  } catch (err) {
    logger.warn(`Could not fetch dashboard report: ${err.message}`);
    data._dashboard = null;
  }

  logger.info(`Department data gathered: ${departments.length} departments`);
  return data;
}

/**
 * Gather OKR (Objectives and Key Results) data for strategic alignment.
 *
 * @returns {Promise<Object>} OKR data
 */
async function gatherOKRs() {
  try {
    const projects = await getRecords('Projects', '', 50);
    const tasks = await getRecords('Tasks', "{Status} != 'done'", 50);

    return {
      activeProjects: projects.filter(p => p.Status === 'active' || p.Status === 'in-progress'),
      blockedProjects: projects.filter(p => p.Status === 'blocked'),
      openTasks: tasks,
      totalProjects: projects.length,
    };
  } catch (err) {
    logger.warn(`Could not gather OKR data: ${err.message}`);
    return { activeProjects: [], blockedProjects: [], openTasks: [], totalProjects: 0 };
  }
}

/**
 * Gather pending decisions that need discussion.
 *
 * @returns {Promise<Object[]>} Pending decisions
 */
async function gatherPendingDecisions() {
  try {
    const decisions = await getRecords(
      'Decisions',
      "OR({Status} = 'new', {Status} = 'awaiting-decision')",
      10
    );
    return decisions;
  } catch (err) {
    logger.warn(`Could not fetch pending decisions: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Agenda Generation
// ---------------------------------------------------------------------------

/**
 * Generate a meeting agenda automatically based on meeting type,
 * pending decisions, OKRs, action items, and department data.
 *
 * @param {MeetingConfig} meeting - Meeting configuration
 * @returns {Promise<Object>} Generated agenda with items and time allocations
 */
async function generateAgenda(meeting) {
  const meetingId = meeting.id || generateId('mtg');
  const meetingType = meeting.type || 'custom';
  const typeConfig = MEETING_TYPES[meetingType] || MEETING_TYPES.custom;
  const duration = meeting.durationMinutes || typeConfig.defaultDuration;

  logger.info(`Generating agenda for: ${meeting.title} (${meetingType}, ${duration}min)`);

  // Gather all necessary data in parallel
  const [departmentData, okrs, pendingDecisions, actionItemSummary] = await Promise.all([
    gatherDepartmentData(meetingType, meeting.departments || null),
    gatherOKRs(),
    gatherPendingDecisions(),
    Promise.resolve(getActionItemSummary()),
  ]);

  // Build prompt for Claude to generate the agenda
  const prompt = `Erstelle eine detaillierte Meeting-Agenda fuer folgendes Meeting:

MEETING-DETAILS:
- Titel: ${meeting.title}
- Typ: ${meetingType}
- Dauer: ${duration} Minuten
- Teilnehmer: ${(meeting.participants || ['CEO']).join(', ')}
- Datum: ${meeting.scheduledAt || new Date().toISOString()}
${meeting.context ? `- Zusaetzlicher Kontext: ${JSON.stringify(meeting.context)}` : ''}

STANDARD-SEKTIONEN fuer ${meetingType}: ${typeConfig.sections.join(', ')}

OFFENE ACTION ITEMS (${actionItemSummary.open} offen, ${actionItemSummary.overdue} ueberfaellig):
${JSON.stringify(actionItemSummary.overdueItems.slice(0, 5), null, 2)}

OFFENE ENTSCHEIDUNGEN (${pendingDecisions.length}):
${JSON.stringify(pendingDecisions.map(d => ({
  title: d.Title,
  category: d.Category,
  urgency: d.Urgency,
  status: d.Status,
})), null, 2)}

AKTIVE PROJEKTE UND OKRs:
${JSON.stringify({
  active: okrs.activeProjects.map(p => ({ name: p.Name || p.Title, status: p.Status })).slice(0, 10),
  blocked: okrs.blockedProjects.map(p => ({ name: p.Name || p.Title, reason: p.BlockReason || 'N/A' })),
  openTasks: okrs.openTasks.length,
}, null, 2)}

DEPARTMENT-DATEN (Zusammenfassung):
${departmentData._dashboard ? `Dashboard KPIs: ${JSON.stringify(departmentData._dashboard.kpis || {}, null, 2)}` : 'Keine Dashboard-Daten'}

REGELN:
1. Maximal ${typeConfig.maxAgendaItems} Agenda-Punkte
2. Gesamtzeit muss ${duration} Minuten ergeben
3. Priorisiere Blocker, ueberfaellige Items und dringende Entscheidungen
4. Beginne mit einem kurzen Check-in und ende mit klaren Next Steps
5. Weise jedem Punkt einen Verantwortlichen aus den Teilnehmern zu
6. Beruecksichtige den Meeting-Typ und passe Tiefe/Umfang an

Antworte als JSON:
{
  "meetingId": "${meetingId}",
  "title": "${meeting.title}",
  "type": "${meetingType}",
  "totalMinutes": ${duration},
  "agendaItems": [
    {
      "order": 1,
      "title": "Check-in und Ueberblick",
      "description": "Kurze Beschreibung des Themas",
      "owner": "CEO",
      "allocatedMinutes": 5,
      "priority": "medium",
      "type": "update",
      "supportingData": [{"metric": "Name", "value": "Wert", "trend": "up/down/stable"}],
      "talkingPoints": ["Punkt 1", "Punkt 2"],
      "desiredOutcome": "Was soll am Ende dieses Punkts klar sein"
    }
  ],
  "preMeetingPrep": {
    "readingMaterial": ["Dokument 1", "Dokument 2"],
    "dataToReview": ["KPI Dashboard", "Pipeline Report"],
    "questionsToConsider": ["Frage 1", "Frage 2"]
  },
  "suggestedFollowUp": "Empfohlener naechster Meeting-Termin oder Follow-up"
}`;

  try {
    const agenda = await generateJSON(prompt, {
      system: 'Du bist ein erfahrener Executive Assistant, spezialisiert auf effiziente Meeting-Vorbereitung fuer Startup-CEOs. Antworte auf Deutsch als valides JSON. Optimiere fuer Zeiteffizienz und klare Ergebnisse.',
      model: agentConfig.models.decisions,
      maxTokens: 4096,
    });

    // Validate and fix time allocations
    const totalAllocated = (agenda.agendaItems || []).reduce((sum, item) => sum + (item.allocatedMinutes || 0), 0);
    if (totalAllocated !== duration && agenda.agendaItems && agenda.agendaItems.length > 0) {
      const diff = duration - totalAllocated;
      // Distribute difference across items proportionally
      const lastItem = agenda.agendaItems[agenda.agendaItems.length - 1];
      lastItem.allocatedMinutes = Math.max(1, (lastItem.allocatedMinutes || 5) + diff);
      logger.info(`Adjusted time allocation: ${totalAllocated}min -> ${duration}min`);
    }

    // Enrich with action item references
    agenda.actionItemReview = {
      overdue: actionItemSummary.overdueItems.slice(0, 5),
      openCount: actionItemSummary.open,
      completionRate: actionItemSummary.completionRate,
    };

    agenda.pendingDecisions = pendingDecisions.map(d => ({
      title: d.Title,
      urgency: d.Urgency,
      category: d.Category,
    }));

    logger.info(`Agenda generated: ${(agenda.agendaItems || []).length} items, ${duration}min total`);
    return agenda;
  } catch (err) {
    logger.error(`Agenda generation failed: ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Participant Briefing Documents
// ---------------------------------------------------------------------------

/**
 * Generate personalized briefing documents for each meeting participant.
 *
 * @param {Object} agenda - The generated agenda
 * @param {MeetingConfig} meeting - Meeting configuration
 * @param {Object} departmentData - Gathered department data
 * @returns {Promise<Object<string, string>>} Briefing documents keyed by participant name
 */
async function generateParticipantBriefings(agenda, meeting, departmentData) {
  const participants = meeting.participants || ['CEO'];
  const briefings = {};

  logger.info(`Generating briefing documents for ${participants.length} participants...`);

  // Generate briefings in parallel (up to 3 at a time to respect rate limits)
  const batchSize = 3;
  for (let i = 0; i < participants.length; i += batchSize) {
    const batch = participants.slice(i, i + batchSize);

    const batchResults = await Promise.all(batch.map(async (participant) => {
      try {
        // Find agenda items this participant owns
        const ownedItems = (agenda.agendaItems || []).filter(
          item => item.owner === participant || item.owner === 'All'
        );

        const prompt = `Erstelle ein kurzes Briefing-Dokument fuer ${participant} fuer das folgende Meeting.

MEETING: ${meeting.title}
DATUM: ${meeting.scheduledAt || 'TBD'}
DAUER: ${meeting.durationMinutes || 60} Minuten

AGENDA:
${JSON.stringify(agenda.agendaItems, null, 2)}

PUNKTE DIE ${participant} VERANTWORTET:
${JSON.stringify(ownedItems, null, 2)}

OFFENE ACTION ITEMS fuer ${participant}:
${JSON.stringify(agenda.actionItemReview?.overdue?.filter(i => i.assignee === participant) || [], null, 2)}

Erstelle ein praegnantes Briefing mit:
1. Ueberblick: Was ist das Ziel dieses Meetings?
2. Deine Rolle: Welche Punkte verantwortest du?
3. Vorbereitung: Was solltest du vorher tun/lesen?
4. Key Data Points: Welche Zahlen/Fakten sind relevant?
5. Erwartete Ergebnisse: Was wird von dir erwartet?

Halte es kurz und actionable. Maximal 300 Woerter.`;

        const briefing = await generateText(prompt, {
          system: `Du erstellst Meeting-Briefings fuer ${participant}. Sei praezise und handlungsorientiert. Antworte auf Deutsch.`,
          model: agentConfig.models.productivity || agentConfig.models.decisions,
          maxTokens: 1024,
        });

        return { participant, briefing };
      } catch (err) {
        logger.warn(`Briefing generation failed for ${participant}: ${err.message}`);
        return { participant, briefing: `Briefing konnte nicht generiert werden: ${err.message}` };
      }
    }));

    for (const { participant, briefing } of batchResults) {
      briefings[participant] = briefing;
    }
  }

  logger.info(`Generated ${Object.keys(briefings).length} participant briefings`);
  return briefings;
}

// ---------------------------------------------------------------------------
// Time Allocation Recommendations
// ---------------------------------------------------------------------------

/**
 * Calculate optimal time allocation for agenda items based on
 * priority, complexity, and number of decision points.
 *
 * @param {Object[]} agendaItems - Agenda items
 * @param {number} totalMinutes - Total meeting duration
 * @returns {Object[]} Items with optimized time allocations
 */
function optimizeTimeAllocation(agendaItems, totalMinutes) {
  if (!agendaItems || agendaItems.length === 0) return [];

  // Priority weights
  const priorityWeights = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  // Type weights (decisions need more time)
  const typeWeights = {
    decision: 3,
    discussion: 2.5,
    brainstorm: 2,
    review: 1.5,
    update: 1,
  };

  // Reserve 10% for buffer (overruns, transitions)
  const availableMinutes = Math.floor(totalMinutes * 0.9);
  const bufferMinutes = totalMinutes - availableMinutes;

  // Calculate raw weights
  const items = agendaItems.map(item => {
    const pWeight = priorityWeights[item.priority] || 2;
    const tWeight = typeWeights[item.type] || 1.5;
    return { ...item, rawWeight: pWeight * tWeight };
  });

  const totalWeight = items.reduce((sum, i) => sum + i.rawWeight, 0);

  // Distribute time proportionally with minimum of 2 minutes per item
  const minPerItem = 2;
  const distributableMinutes = availableMinutes - (items.length * minPerItem);

  items.forEach(item => {
    const proportion = item.rawWeight / totalWeight;
    item.recommendedMinutes = Math.max(minPerItem, Math.round(minPerItem + distributableMinutes * proportion));
  });

  // Adjust to fit total
  let allocated = items.reduce((sum, i) => sum + i.recommendedMinutes, 0);
  const diff = availableMinutes - allocated;
  if (diff !== 0 && items.length > 0) {
    // Add/subtract from highest priority item
    items[0].recommendedMinutes += diff;
  }

  // Add buffer note
  items.push({
    order: items.length + 1,
    title: 'Buffer / Uebergangszeiten',
    description: 'Reserve fuer Ueberlaeufe und Uebergaenge',
    allocatedMinutes: bufferMinutes,
    priority: 'low',
    type: 'buffer',
    isBuffer: true,
  });

  return items;
}

// ---------------------------------------------------------------------------
// Post-Meeting Summary Generation
// ---------------------------------------------------------------------------

/**
 * Generate a post-meeting summary from notes and extract action items.
 *
 * @param {string} meetingId - The meeting ID
 * @param {Object} agenda - The original agenda
 * @param {string} meetingNotes - Raw meeting notes/transcript
 * @returns {Promise<Object>} Post-meeting summary with extracted action items
 */
async function generatePostMeetingSummary(meetingId, agenda, meetingNotes) {
  logger.info(`Generating post-meeting summary for: ${meetingId}`);

  try {
    const prompt = `Erstelle eine strukturierte Zusammenfassung des folgenden Meetings und extrahiere alle Action Items.

MEETING: ${agenda.title || 'N/A'}
TYP: ${agenda.type || 'N/A'}
TEILNEHMER: ${(agenda.participants || []).join(', ')}

URSPRUENGLICHE AGENDA:
${JSON.stringify(agenda.agendaItems, null, 2)}

MEETING-NOTIZEN:
${meetingNotes}

Erstelle als JSON:
{
  "summary": "Zusammenfassung in 3-5 Saetzen",
  "keyDecisions": [
    {
      "decision": "Was wurde entschieden",
      "context": "Kurzer Kontext",
      "owner": "Verantwortlich",
      "deadline": "YYYY-MM-DD oder null"
    }
  ],
  "actionItems": [
    {
      "title": "Was zu tun ist",
      "assignee": "Wer",
      "dueDate": "YYYY-MM-DD",
      "priority": "high",
      "notes": "Zusaetzliche Notizen"
    }
  ],
  "openQuestions": ["Offene Frage 1", "Offene Frage 2"],
  "parkingLot": ["Zurueckgestellte Themen"],
  "nextMeeting": {
    "suggestedDate": "YYYY-MM-DD oder null",
    "suggestedTopics": ["Thema 1"]
  },
  "attendeeSatisfaction": "Einschaetzung ob Meeting produktiv war (gut/mittel/schlecht)"
}`;

    const summary = await generateJSON(prompt, {
      system: 'Du bist ein professioneller Meeting-Protokollant. Extrahiere praezise und vollstaendig alle relevanten Informationen. Antworte auf Deutsch als valides JSON.',
      model: agentConfig.models.decisions,
      maxTokens: 3000,
    });

    // Create action items from the summary
    const createdItems = [];
    for (const item of (summary.actionItems || [])) {
      const created = createActionItem({
        meetingId,
        title: item.title,
        assignee: item.assignee || 'CEO',
        dueDate: item.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: item.priority || 'medium',
        notes: item.notes || '',
      });
      createdItems.push(created);
    }

    summary.createdActionItems = createdItems;

    // Save to meeting history
    const history = loadJSON(MEETING_HISTORY_FILE, { meetings: [] });
    history.meetings.push({
      meetingId,
      title: agenda.title,
      type: agenda.type,
      date: new Date().toISOString(),
      summary: summary.summary,
      keyDecisions: summary.keyDecisions,
      actionItemCount: createdItems.length,
      satisfaction: summary.attendeeSatisfaction,
    });
    saveJSON(MEETING_HISTORY_FILE, history);

    logger.info(`Post-meeting summary generated: ${createdItems.length} action items created`);
    return summary;
  } catch (err) {
    logger.error(`Post-meeting summary generation failed: ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Calendar Integration Data Structures
// ---------------------------------------------------------------------------

/**
 * Generate a calendar event data structure (iCal/Google Calendar compatible).
 *
 * @param {MeetingConfig} meeting - Meeting configuration
 * @param {Object} agenda - Generated agenda
 * @returns {Object} Calendar event data
 */
function generateCalendarEvent(meeting, agenda) {
  const startDate = meeting.scheduledAt ? new Date(meeting.scheduledAt) : new Date();
  const endDate = new Date(startDate.getTime() + (meeting.durationMinutes || 60) * 60 * 1000);

  // Build description from agenda
  const agendaText = (agenda.agendaItems || [])
    .map(item => `${item.order}. ${item.title} (${item.allocatedMinutes}min, ${item.owner})`)
    .join('\n');

  const event = {
    // Standard iCal fields
    uid: `${meeting.id || generateId('cal')}@werkpilot.ch`,
    summary: meeting.title,
    description: `Meeting-Typ: ${meeting.type}\n\nAgenda:\n${agendaText}\n\n---\nGeneriert von Werkpilot Meeting Prep Agent`,
    dtstart: startDate.toISOString(),
    dtend: endDate.toISOString(),
    location: meeting.location || 'Werkpilot Office / Virtual',
    organizer: { name: 'Werkpilot CEO', email: config.email.ceo || 'ceo@werkpilot.ch' },
    attendees: (meeting.participants || []).map(p => ({
      name: p,
      role: 'required',
    })),
    status: 'CONFIRMED',
    categories: [meeting.type, 'werkpilot'],

    // Extended fields for integration
    reminders: [
      { method: 'popup', minutes: 30 },
      { method: 'email', minutes: 60 },
    ],

    // Werkpilot metadata
    werkpilot: {
      meetingId: meeting.id || generateId('mtg'),
      type: meeting.type,
      agendaItemCount: (agenda.agendaItems || []).length,
      totalMinutes: meeting.durationMinutes || 60,
      generatedAt: new Date().toISOString(),
      hasPreMeetingBriefing: true,
    },
  };

  return event;
}

/**
 * Generate a recurring meeting schedule data structure.
 *
 * @param {MeetingConfig} meeting - Meeting configuration with recurrence
 * @param {number} [instances=4] - Number of future instances to generate
 * @returns {Object[]} Array of calendar events
 */
function generateRecurringSchedule(meeting, instances = 4) {
  const events = [];
  const startDate = meeting.scheduledAt ? new Date(meeting.scheduledAt) : new Date();

  // Parse recurrence (simplified: daily, weekly, biweekly, monthly)
  const recurrenceMap = {
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
  };

  const interval = recurrenceMap[meeting.recurrence] || 7;

  for (let i = 0; i < instances; i++) {
    const instanceDate = new Date(startDate.getTime() + i * interval * 24 * 60 * 60 * 1000);
    events.push({
      instanceNumber: i + 1,
      scheduledAt: instanceDate.toISOString(),
      title: meeting.title,
      type: meeting.type,
      durationMinutes: meeting.durationMinutes,
      participants: meeting.participants,
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Email Formatting
// ---------------------------------------------------------------------------

/**
 * Build a comprehensive meeting prep email with agenda, briefings,
 * and action items.
 *
 * @param {Object} agenda - Generated agenda
 * @param {Object<string, string>} briefings - Participant briefings
 * @param {MeetingConfig} meeting - Meeting configuration
 * @returns {string} HTML email content
 */
function formatMeetingPrepEmail(agenda, briefings, meeting) {
  const dateStr = meeting.scheduledAt
    ? new Date(meeting.scheduledAt).toLocaleDateString('de-CH', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'TBD';

  const typeLabels = {
    standup: 'Standup', weekly: 'Weekly', board: 'Board Meeting',
    client: 'Kunden-Meeting', strategy: 'Strategie-Session',
    'one-on-one': '1:1', custom: 'Meeting',
  };

  const priorityColors = {
    critical: '#e94560', high: '#ff6b35', medium: '#ffd166', low: '#06d6a0',
  };

  const typeIcons = {
    decision: '[Entscheidung]', update: '[Update]', discussion: '[Diskussion]',
    brainstorm: '[Brainstorm]', review: '[Review]', buffer: '[Buffer]',
  };

  // Agenda items HTML
  const agendaHtml = (agenda.agendaItems || []).map(item => {
    const pColor = priorityColors[item.priority] || '#999';
    const icon = typeIcons[item.type] || '';

    return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;color:#16213e;width:30px;text-align:center;">${item.order}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          <strong>${item.title}</strong>
          <span style="font-size:11px;color:${pColor};margin-left:8px;background:${pColor}22;padding:1px 6px;border-radius:8px;">${icon} ${item.priority}</span>
          <br><span style="color:#666;font-size:13px;">${item.description || ''}</span>
          ${item.talkingPoints ? `<br><span style="font-size:12px;color:#888;">Punkte: ${item.talkingPoints.join(' | ')}</span>` : ''}
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;white-space:nowrap;">${item.allocatedMinutes || '-'} min</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${item.owner || '-'}</td>
      </tr>`;
  }).join('');

  // Action items review
  const actionReview = agenda.actionItemReview || {};
  const overdueHtml = (actionReview.overdue || []).slice(0, 5).map(item => `
    <li style="margin:4px 0;color:#e94560;">${item.title} (${item.assignee}, faellig: ${item.dueDate})</li>
  `).join('');

  // Pre-meeting prep
  const prepHtml = agenda.preMeetingPrep ? `
    <div style="background:#f0f4ff;padding:16px;border-radius:8px;margin:16px 0;">
      <h3 style="margin:0 0 8px;color:#0f3460;">Vorbereitung</h3>
      ${agenda.preMeetingPrep.readingMaterial ? `<p style="margin:4px 0;"><strong>Lesen:</strong> ${agenda.preMeetingPrep.readingMaterial.join(', ')}</p>` : ''}
      ${agenda.preMeetingPrep.dataToReview ? `<p style="margin:4px 0;"><strong>Daten pruefen:</strong> ${agenda.preMeetingPrep.dataToReview.join(', ')}</p>` : ''}
      ${agenda.preMeetingPrep.questionsToConsider ? `<p style="margin:4px 0;"><strong>Fragen:</strong></p><ul style="margin:4px 0;">${agenda.preMeetingPrep.questionsToConsider.map(q => `<li>${q}</li>`).join('')}</ul>` : ''}
    </div>` : '';

  return `
    <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:800px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:24px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">Meeting Prep: ${meeting.title}</h1>
        <p style="margin:6px 0 0;opacity:0.9;">
          ${typeLabels[meeting.type] || 'Meeting'} | ${dateStr} | ${meeting.durationMinutes || 60} Minuten
        </p>
        <p style="margin:4px 0 0;opacity:0.8;font-size:13px;">
          Teilnehmer: ${(meeting.participants || ['CEO']).join(', ')}
        </p>
      </div>

      <div style="padding:24px;background:#fff;border:1px solid #eee;">
        ${prepHtml}

        ${overdueHtml ? `
        <div style="background:#fff3f3;padding:12px 16px;border-radius:8px;margin:0 0 16px;border-left:4px solid #e94560;">
          <strong style="color:#e94560;">Ueberfaellige Action Items (${actionReview.overdue?.length || 0}):</strong>
          <ul style="margin:4px 0;padding-left:20px;">${overdueHtml}</ul>
        </div>` : ''}

        <h2 style="color:#16213e;border-bottom:2px solid #e94560;padding-bottom:8px;">Agenda</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="padding:10px;text-align:center;border-bottom:2px solid #ddd;">#</th>
              <th style="padding:10px;text-align:left;border-bottom:2px solid #ddd;">Thema</th>
              <th style="padding:10px;text-align:center;border-bottom:2px solid #ddd;">Zeit</th>
              <th style="padding:10px;text-align:center;border-bottom:2px solid #ddd;">Owner</th>
            </tr>
          </thead>
          <tbody>${agendaHtml}</tbody>
        </table>

        ${agenda.pendingDecisions && agenda.pendingDecisions.length > 0 ? `
        <div style="margin-top:16px;padding:12px 16px;background:#fff8e1;border-radius:8px;border-left:4px solid #ffc107;">
          <strong>Offene Entscheidungen (${agenda.pendingDecisions.length}):</strong>
          <ul style="margin:4px 0;padding-left:20px;">
            ${agenda.pendingDecisions.map(d => `<li>${d.title} <span style="font-size:12px;color:#666;">(${d.urgency}, ${d.category})</span></li>`).join('')}
          </ul>
        </div>` : ''}
      </div>

      <div style="padding:16px 24px;background:#f8f9fa;border-radius:0 0 8px 8px;border:1px solid #eee;border-top:none;">
        <p style="margin:0;color:#666;font-size:12px;text-align:center;">
          Werkpilot Meeting Prep Agent v2 &mdash; Action Items: ${actionReview.open || 0} offen, ${actionReview.completionRate || 0}% erledigt
        </p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Main Execution Functions
// ---------------------------------------------------------------------------

/**
 * Full meeting preparation pipeline: generates agenda, briefings,
 * time optimization, calendar event, and sends everything via email.
 *
 * @param {MeetingConfig} meeting - Meeting configuration
 * @returns {Promise<Object>} Complete preparation package
 */
async function prepareMeeting(meeting) {
  const startTime = Date.now();
  const meetingId = meeting.id || generateId('mtg');
  meeting.id = meetingId;

  logger.info(`=== Preparing meeting: ${meeting.title} (${meetingId}) ===`);

  try {
    await dashboardSync.syncAgentStatus(AGENT_NAME, 'active');

    // Step 1: Generate agenda
    logger.info(`[${meetingId}] Step 1/5: Generating agenda...`);
    const agenda = await generateAgenda(meeting);

    // Step 2: Optimize time allocation
    logger.info(`[${meetingId}] Step 2/5: Optimizing time allocation...`);
    agenda.agendaItems = optimizeTimeAllocation(
      agenda.agendaItems || [],
      meeting.durationMinutes || 60
    );

    // Step 3: Generate participant briefings
    logger.info(`[${meetingId}] Step 3/5: Generating participant briefings...`);
    const departmentData = {}; // Already gathered during agenda generation
    const briefings = await generateParticipantBriefings(agenda, meeting, departmentData);

    // Step 4: Generate calendar event
    logger.info(`[${meetingId}] Step 4/5: Creating calendar event...`);
    const calendarEvent = generateCalendarEvent(meeting, agenda);

    // Step 5: Save and send
    logger.info(`[${meetingId}] Step 5/5: Saving and sending prep materials...`);

    // Save meeting prep package
    const prepPackage = {
      meetingId,
      meeting,
      agenda,
      briefings,
      calendarEvent,
      generatedAt: new Date().toISOString(),
    };

    const prepPath = path.join(MEETINGS_DIR, `${meetingId}.json`);
    saveJSON(prepPath, prepPackage);

    // Send email
    const emailHtml = formatMeetingPrepEmail(agenda, briefings, meeting);
    await sendCEOEmail({
      subject: `Meeting Prep: ${meeting.title}`,
      html: emailHtml,
    });

    // Dashboard notification
    await dashboardSync.sendNotification(
      `Meeting vorbereitet: ${meeting.title}`,
      `Agenda mit ${(agenda.agendaItems || []).length} Punkten generiert. ${Object.keys(briefings).length} Briefings erstellt.`,
      'success',
      `/meetings/${meetingId}`
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Meeting prep complete in ${elapsed}s: ${meetingId} ===`);

    await dashboardSync.syncAgentStatus(AGENT_NAME, 'idle', 100, 1, 0);

    return {
      success: true,
      meetingId,
      elapsed,
      agendaItemCount: (agenda.agendaItems || []).length,
      briefingCount: Object.keys(briefings).length,
      prepPath,
    };
  } catch (err) {
    logger.error(`Meeting prep failed: ${err.message}`, { stack: err.stack });

    try {
      await dashboardSync.syncAgentStatus(AGENT_NAME, 'error', 0, 0, 1);
    } catch (_) { /* ignore */ }

    return { success: false, meetingId, error: err.message };
  }
}

/**
 * Main execute function - entry point for the orchestrator.
 *
 * @param {Object} [options={}] - Execution options
 * @param {string} [options.mode='prep'] - 'prep' | 'summary' | 'action-items' | 'check-items'
 * @param {MeetingConfig} [options.meeting] - Meeting config for prep mode
 * @param {string} [options.meetingId] - Meeting ID for summary mode
 * @param {string} [options.notes] - Meeting notes for summary mode
 * @returns {Promise<Object>} Execution result
 */
async function execute(options = {}) {
  const mode = options.mode || 'prep';
  const startTime = Date.now();

  logger.info(`=== Meeting Prep Agent executing in mode: ${mode} ===`);

  try {
    let result = {};

    switch (mode) {
      case 'prep': {
        if (!options.meeting) {
          throw new Error('Meeting configuration required for prep mode');
        }
        result = await prepareMeeting(options.meeting);
        break;
      }

      case 'summary': {
        if (!options.meetingId || !options.notes) {
          throw new Error('Meeting ID and notes required for summary mode');
        }
        // Load the meeting prep package
        const prepPath = path.join(MEETINGS_DIR, `${options.meetingId}.json`);
        const prepPackage = loadJSON(prepPath, null);
        if (!prepPackage) {
          throw new Error(`Meeting prep not found: ${options.meetingId}`);
        }

        const summary = await generatePostMeetingSummary(
          options.meetingId,
          prepPackage.agenda,
          options.notes
        );

        // Send summary email
        await sendCEOEmail({
          subject: `Meeting Summary: ${prepPackage.meeting.title}`,
          html: `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:20px;">
            <h2 style="color:#16213e;">Meeting Summary</h2>
            <p>${summary.summary}</p>
            <h3>Entscheidungen</h3>
            <ul>${(summary.keyDecisions || []).map(d => `<li><strong>${d.decision}</strong> (${d.owner})</li>`).join('')}</ul>
            <h3>Action Items (${(summary.createdActionItems || []).length})</h3>
            <ul>${(summary.createdActionItems || []).map(ai => `<li>${ai.title} -> ${ai.assignee} (bis ${ai.dueDate})</li>`).join('')}</ul>
            ${summary.openQuestions && summary.openQuestions.length > 0 ? `<h3>Offene Fragen</h3><ul>${summary.openQuestions.map(q => `<li>${q}</li>`).join('')}</ul>` : ''}
          </div>`,
        });

        result = { summary, actionItemsCreated: (summary.createdActionItems || []).length };
        break;
      }

      case 'action-items': {
        const summary = getActionItemSummary();
        result = { actionItems: summary };
        break;
      }

      case 'check-items': {
        // Check and alert about overdue action items
        const items = getActionItems();
        const overdue = items.filter(i => i.status === 'overdue');

        if (overdue.length > 0) {
          await sendCEOEmail({
            subject: `${overdue.length} ueberfaellige Action Items`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff3f3;border-left:4px solid #e94560;border-radius:8px;">
              <h2 style="color:#c92a2a;">Ueberfaellige Action Items</h2>
              <ul>${overdue.map(i => `<li><strong>${i.title}</strong> - ${i.assignee} (faellig: ${i.dueDate})</li>`).join('')}</ul>
            </div>`,
          });

          await dashboardSync.sendNotification(
            `${overdue.length} ueberfaellige Action Items`,
            overdue.map(i => `${i.title} (${i.assignee})`).join(', '),
            'warning'
          );
        }

        result = { overdueCount: overdue.length, overdue };
        break;
      }

      default:
        throw new Error(`Unknown mode: ${mode}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Meeting Prep Agent complete in ${elapsed}s ===`);

    return { success: true, mode, elapsed, ...result };
  } catch (err) {
    logger.error(`Meeting Prep Agent execution failed: ${err.message}`, { stack: err.stack });
    return { success: false, mode, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

/**
 * Start the Meeting Prep agent with scheduled tasks.
 * @returns {void}
 */
function start() {
  ensureDirectories();
  logger.info(`Meeting Prep Agent v2 starting...`);

  // Check overdue action items every morning at 07:30
  cron.schedule('30 7 * * 1-5', () => {
    logger.info('Cron triggered: overdue action item check');
    execute({ mode: 'check-items' });
  }, { timezone: TIMEZONE });

  // Weekly Monday prep: auto-generate agenda for standard weekly meeting
  cron.schedule('0 7 * * 1', () => {
    logger.info('Cron triggered: weekly meeting prep');
    execute({
      mode: 'prep',
      meeting: {
        title: 'Weekly Team Meeting',
        type: 'weekly',
        durationMinutes: 60,
        participants: ['CEO', 'CTO', 'Head of Sales', 'Head of Marketing'],
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      },
    });
  }, { timezone: TIMEZONE });

  logger.info('Meeting Prep Agent v2 is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--prep') || args.includes('-p')) {
    // Quick prep with defaults
    const title = args[args.indexOf('--prep') + 1] || args[args.indexOf('-p') + 1] || 'Quick Meeting';
    execute({
      mode: 'prep',
      meeting: {
        title,
        type: 'weekly',
        durationMinutes: 60,
        participants: ['CEO'],
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    }).then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else if (args.includes('--action-items') || args.includes('-a')) {
    execute({ mode: 'action-items' }).then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else if (args.includes('--check-items') || args.includes('-c')) {
    execute({ mode: 'check-items' }).then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else if (args.includes('--summary') || args.includes('-s')) {
    const meetingId = args[args.indexOf('--summary') + 1] || args[args.indexOf('-s') + 1];
    const notes = args.slice(args.indexOf(meetingId) + 1).join(' ') || 'Keine Notizen';
    execute({ mode: 'summary', meetingId, notes }).then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else if (args.includes('--create-item')) {
    const idx = args.indexOf('--create-item');
    const title = args[idx + 1] || 'New action item';
    const assignee = args[idx + 2] || 'CEO';
    const dueDate = args[idx + 3] || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const item = createActionItem({
      meetingId: 'manual',
      title,
      assignee,
      dueDate,
    });
    console.log('Action item created:', JSON.stringify(item, null, 2));
  } else if (args.includes('--complete-item')) {
    const itemId = args[args.indexOf('--complete-item') + 1];
    if (itemId) {
      const updated = updateActionItem(itemId, { status: 'done' });
      console.log(updated ? 'Item completed' : 'Item not found');
    } else {
      console.error('Usage: --complete-item <itemId>');
    }
  } else {
    start();
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  execute,
  start,
  prepareMeeting,
  generateAgenda,
  generateParticipantBriefings,
  generatePostMeetingSummary,
  optimizeTimeAllocation,
  generateCalendarEvent,
  generateRecurringSchedule,
  getActionItems,
  createActionItem,
  updateActionItem,
  getActionItemSummary,
  gatherDepartmentData,
};
