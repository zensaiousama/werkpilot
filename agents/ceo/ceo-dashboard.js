/**
 * Werkpilot CEO Dashboard Agent
 *
 * Central intelligence hub that aggregates KPIs from all 9 departments,
 * compiles morning briefing data, performs weekly/monthly trend analysis,
 * prioritizes alerts, generates executive summaries, prepares board meeting
 * data, and tracks strategic initiatives.
 *
 * This agent serves as the single source of truth for executive-level
 * metrics and reporting across the entire Werkpilot organization.
 *
 * Features:
 * - Aggregates KPIs from all 9 departments (CEO, Sales, Marketing,
 *   Finance, HR, IT, Operations, Product, Strategy)
 * - Morning briefing data compilation
 * - Weekly/monthly trend analysis with change detection
 * - Alert prioritization (critical -> warning -> info)
 * - Executive summary generation
 * - Board meeting preparation data
 * - Strategic initiative tracking with milestone monitoring
 *
 * @module ceo/ceo-dashboard
 * @version 1.0.0
 * @author Werkpilot AI
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateJSON, generateText } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');
const dashboardClient = require('../shared/utils/dashboard-client');
const dashboardSync = require('../shared/utils/dashboard-sync');

const agentConfig = require('./config.json');
const logger = createLogger('ceo-dashboard');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_NAME = 'ceo-dashboard';
const DATA_DIR = path.join(__dirname, 'dashboard-data');
const KPI_HISTORY_FILE = path.join(DATA_DIR, 'kpi-history.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const INITIATIVES_FILE = path.join(DATA_DIR, 'strategic-initiatives.json');
const BOARD_DATA_DIR = path.join(DATA_DIR, 'board-reports');
const TIMEZONE = 'Europe/Zurich';

/**
 * @typedef {Object} DepartmentKPI
 * @property {string} department - Department name
 * @property {Object<string, number|string>} metrics - Key-value metric pairs
 * @property {string} healthStatus - 'healthy' | 'warning' | 'critical' | 'unknown'
 * @property {number} healthScore - 0-100 health score
 * @property {string} lastUpdated - ISO timestamp
 */

/**
 * @typedef {Object} Alert
 * @property {string} id - Unique alert ID
 * @property {string} level - 'critical' | 'warning' | 'info'
 * @property {string} department - Source department
 * @property {string} title - Alert title
 * @property {string} message - Alert details
 * @property {string} metric - Related metric name
 * @property {number|null} currentValue - Current metric value
 * @property {number|null} threshold - Threshold that was crossed
 * @property {string} createdAt - ISO timestamp
 * @property {boolean} acknowledged - Whether CEO has seen this
 * @property {string|null} acknowledgedAt - When acknowledged
 */

/**
 * @typedef {Object} StrategicInitiative
 * @property {string} id - Unique initiative ID
 * @property {string} title - Initiative name
 * @property {string} description - What this initiative aims to achieve
 * @property {string} owner - Person responsible
 * @property {string} status - 'planned' | 'active' | 'paused' | 'completed' | 'cancelled'
 * @property {number} progress - 0-100 completion percentage
 * @property {Object[]} milestones - Key milestones
 * @property {Object} kpis - Success metrics
 * @property {string} startDate - ISO date
 * @property {string} targetDate - ISO date
 * @property {string} lastUpdated - ISO timestamp
 */

/**
 * All 9 departments in the Werkpilot organization.
 */
const ALL_DEPARTMENTS = [
  'ceo', 'sales', 'marketing', 'finance',
  'hr', 'it', 'operations', 'product', 'strategy',
];

/**
 * KPI definitions per department with thresholds for alerting.
 */
const KPI_DEFINITIONS = {
  sales: {
    metrics: ['totalLeads', 'qualifiedLeads', 'conversionRate', 'pipelineValue', 'wonDeals', 'avgDealSize'],
    thresholds: {
      conversionRate: { warning: 10, critical: 5, direction: 'below' },
      totalLeads: { warning: 5, critical: 2, direction: 'below' },
    },
  },
  marketing: {
    metrics: ['websiteVisitors', 'leadGeneration', 'contentPublished', 'socialEngagement', 'emailOpenRate', 'cpl'],
    thresholds: {
      leadGeneration: { warning: 3, critical: 1, direction: 'below' },
    },
  },
  finance: {
    metrics: ['mrr', 'arr', 'cashBalance', 'burnRate', 'runway', 'grossMargin', 'revenueGrowth'],
    thresholds: {
      runway: { warning: 6, critical: 3, direction: 'below' }, // months
      burnRate: { warning: 50000, critical: 80000, direction: 'above' },
    },
  },
  hr: {
    metrics: ['headcount', 'openPositions', 'applicationsPending', 'employeeSatisfaction', 'turnoverRate'],
    thresholds: {
      turnoverRate: { warning: 15, critical: 25, direction: 'above' },
    },
  },
  it: {
    metrics: ['agentUptime', 'activeAgents', 'erroredAgents', 'avgResponseTime', 'systemLoad', 'deploymentsToday'],
    thresholds: {
      agentUptime: { warning: 95, critical: 90, direction: 'below' },
      erroredAgents: { warning: 2, critical: 5, direction: 'above' },
    },
  },
  operations: {
    metrics: ['activeProjects', 'completedTasks', 'blockedTasks', 'avgDeliveryTime', 'clientSatisfaction'],
    thresholds: {
      blockedTasks: { warning: 3, critical: 5, direction: 'above' },
    },
  },
  product: {
    metrics: ['featuresShipped', 'bugsOpen', 'bugsClosed', 'sprintVelocity', 'techDebtScore', 'uptime'],
    thresholds: {
      bugsOpen: { warning: 10, critical: 20, direction: 'above' },
    },
  },
  strategy: {
    metrics: ['initiativesActive', 'milestonesHit', 'marketShare', 'competitorMoves', 'partnershipsPipeline'],
    thresholds: {},
  },
  ceo: {
    metrics: ['pendingDecisions', 'avgDecisionTime', 'meetingsThisWeek', 'focusTimeHours', 'delegationRate'],
    thresholds: {
      pendingDecisions: { warning: 5, critical: 10, direction: 'above' },
    },
  },
};

// ---------------------------------------------------------------------------
// File System Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure all data directories exist.
 * @returns {void}
 */
function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BOARD_DATA_DIR, { recursive: true });
}

/**
 * Load JSON file safely.
 * @param {string} filePath - Path to file
 * @param {*} defaultValue - Default if missing
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
 * @param {string} filePath - Path to file
 * @param {*} data - Data to serialize
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
 * Generate a unique ID.
 * @param {string} prefix - ID prefix
 * @returns {string} Unique ID
 */
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Get current date key for daily snapshots.
 * @returns {string} YYYY-MM-DD
 */
function getDateKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current week key.
 * @returns {string} YYYY-WNN
 */
function getWeekKey() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const daysSinceStart = Math.floor((now - startOfYear) / 86400000);
  const weekNum = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Get current month key.
 * @returns {string} YYYY-MM
 */
function getMonthKey() {
  return new Date().toISOString().substring(0, 7);
}

// ---------------------------------------------------------------------------
// KPI Aggregation from All Departments
// ---------------------------------------------------------------------------

/**
 * Fetch KPIs from the dashboard API for all departments.
 *
 * @returns {Promise<Object>} Dashboard report data
 */
async function fetchDashboardData() {
  try {
    const report = await dashboardClient.get('/api/reports');
    logger.info('Dashboard data fetched successfully');
    return report;
  } catch (err) {
    logger.warn(`Dashboard data fetch failed: ${err.message}`);
    return null;
  }
}

/**
 * Fetch data from Airtable tables for KPI computation.
 *
 * @returns {Promise<Object>} Airtable data keyed by table name
 */
async function fetchAirtableData() {
  const tables = ['Clients', 'Leads', 'Projects', 'Revenue', 'Tasks', 'Decisions', 'AgentStatus'];
  const data = {};

  const results = await Promise.all(
    tables.map(table =>
      getRecords(table, '', 100)
        .then(records => ({ table, records }))
        .catch(err => {
          logger.warn(`Could not fetch ${table}: ${err.message}`);
          return { table, records: [] };
        })
    )
  );

  for (const { table, records } of results) {
    data[table] = records;
  }

  return data;
}

/**
 * Read agent health data from log directories.
 *
 * @returns {Object} Agent health per department
 */
function collectAgentHealth() {
  const health = {};

  for (const dept of ALL_DEPARTMENTS) {
    const logDir = path.join(config.paths.logs, dept);
    try {
      if (fs.existsSync(logDir)) {
        const errorLog = path.join(logDir, 'error.log');
        const combinedLog = path.join(logDir, 'combined.log');

        let errorCount = 0;
        let lastActivity = null;

        if (fs.existsSync(errorLog)) {
          const content = fs.readFileSync(errorLog, 'utf-8');
          const lines = content.trim().split('\n').filter(l => l.trim());
          // Count errors from last 24 hours
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          errorCount = lines.filter(line => {
            try {
              const match = line.match(/"timestamp":"([^"]+)"/);
              return match && new Date(match[1]).getTime() > oneDayAgo;
            } catch (_) { return false; }
          }).length;
        }

        if (fs.existsSync(combinedLog)) {
          const stat = fs.statSync(combinedLog);
          lastActivity = stat.mtime.toISOString();
        }

        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const isRecent = lastActivity && new Date(lastActivity).getTime() > oneHourAgo;

        health[dept] = {
          errorCount24h: errorCount,
          lastActivity,
          isActive: isRecent,
          healthStatus: errorCount > 5 ? 'critical' : errorCount > 2 ? 'warning' : 'healthy',
          healthScore: Math.max(0, 100 - errorCount * 10),
        };
      } else {
        health[dept] = {
          errorCount24h: 0,
          lastActivity: null,
          isActive: false,
          healthStatus: 'unknown',
          healthScore: 0,
        };
      }
    } catch (err) {
      logger.warn(`Health check failed for ${dept}: ${err.message}`);
      health[dept] = { errorCount24h: 0, lastActivity: null, isActive: false, healthStatus: 'unknown', healthScore: 0 };
    }
  }

  return health;
}

/**
 * Aggregate KPIs from all data sources into a unified structure.
 *
 * @returns {Promise<Object>} Aggregated KPIs per department
 */
async function aggregateKPIs() {
  logger.info('Aggregating KPIs from all 9 departments...');

  const [dashboardData, airtableData, agentHealth] = await Promise.all([
    fetchDashboardData(),
    fetchAirtableData(),
    Promise.resolve(collectAgentHealth()),
  ]);

  const kpis = {};

  // Sales KPIs
  const leads = airtableData.Leads || [];
  const clients = airtableData.Clients || [];
  kpis.sales = {
    department: 'sales',
    metrics: {
      totalLeads: leads.length,
      qualifiedLeads: leads.filter(l => l.Status === 'qualified' || l.Score > 50).length,
      conversionRate: leads.length > 0 ? Math.round((clients.length / leads.length) * 100) : 0,
      pipelineValue: leads.reduce((sum, l) => sum + (l.EstimatedValue || 0), 0),
      activeClients: clients.filter(c => c.Status === 'active').length,
      avgDealSize: clients.length > 0 ? Math.round(clients.reduce((sum, c) => sum + (c.ContractValue || 0), 0) / clients.length) : 0,
    },
    ...agentHealth.sales,
    lastUpdated: new Date().toISOString(),
  };

  // Marketing KPIs
  kpis.marketing = {
    department: 'marketing',
    metrics: {
      leadGeneration: leads.filter(l => {
        const created = new Date(l.CreatedAt || l.createdAt || 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return created > weekAgo;
      }).length,
      totalLeads: leads.length,
      websiteVisitors: dashboardData?.kpis?.websiteVisitors || 0,
      contentPublished: dashboardData?.kpis?.contentPublished || 0,
    },
    ...agentHealth.marketing,
    lastUpdated: new Date().toISOString(),
  };

  // Finance KPIs
  const revenue = airtableData.Revenue || [];
  const monthlyRevenue = revenue.reduce((sum, r) => sum + (r.Amount || 0), 0);
  kpis.finance = {
    department: 'finance',
    metrics: {
      mrr: dashboardData?.kpis?.mrr || monthlyRevenue,
      arr: (dashboardData?.kpis?.mrr || monthlyRevenue) * 12,
      cashBalance: dashboardData?.kpis?.cashBalance || 0,
      burnRate: dashboardData?.kpis?.burnRate || 0,
      runway: dashboardData?.kpis?.runway || 0,
      revenueGrowth: dashboardData?.kpis?.revenueGrowth || 0,
    },
    ...agentHealth.finance,
    lastUpdated: new Date().toISOString(),
  };

  // HR KPIs
  kpis.hr = {
    department: 'hr',
    metrics: {
      headcount: dashboardData?.kpis?.headcount || 0,
      openPositions: dashboardData?.kpis?.openPositions || 0,
      applicationsPending: dashboardData?.kpis?.applicationsPending || 0,
    },
    ...agentHealth.hr,
    lastUpdated: new Date().toISOString(),
  };

  // IT KPIs
  const agentStatuses = airtableData.AgentStatus || [];
  const activeAgents = agentStatuses.filter(a => a.Status === 'active' || a.Status === 'running');
  const erroredAgents = agentStatuses.filter(a => a.Status === 'error');
  kpis.it = {
    department: 'it',
    metrics: {
      totalAgents: agentStatuses.length,
      activeAgents: activeAgents.length,
      erroredAgents: erroredAgents.length,
      agentUptime: agentStatuses.length > 0
        ? Math.round(((agentStatuses.length - erroredAgents.length) / agentStatuses.length) * 100)
        : 100,
      avgHealthScore: agentStatuses.length > 0
        ? Math.round(agentStatuses.reduce((sum, a) => sum + (a.Score || 0), 0) / agentStatuses.length)
        : 0,
    },
    ...agentHealth.it,
    lastUpdated: new Date().toISOString(),
  };

  // Operations KPIs
  const projects = airtableData.Projects || [];
  const tasks = airtableData.Tasks || [];
  kpis.operations = {
    department: 'operations',
    metrics: {
      activeProjects: projects.filter(p => p.Status === 'active' || p.Status === 'in-progress').length,
      totalProjects: projects.length,
      completedTasks: tasks.filter(t => t.Status === 'done' || t.Status === 'completed').length,
      openTasks: tasks.filter(t => t.Status !== 'done' && t.Status !== 'completed' && t.Status !== 'cancelled').length,
      blockedTasks: tasks.filter(t => t.Status === 'blocked').length,
    },
    ...agentHealth.operations,
    lastUpdated: new Date().toISOString(),
  };

  // Product KPIs
  kpis.product = {
    department: 'product',
    metrics: {
      featuresShipped: dashboardData?.kpis?.featuresShipped || 0,
      bugsOpen: dashboardData?.kpis?.bugsOpen || tasks.filter(t => t.Type === 'bug' && t.Status !== 'done').length,
      sprintVelocity: dashboardData?.kpis?.sprintVelocity || 0,
    },
    ...agentHealth.product,
    lastUpdated: new Date().toISOString(),
  };

  // Strategy KPIs
  const decisions = airtableData.Decisions || [];
  const initiatives = loadJSON(INITIATIVES_FILE, { initiatives: [] });
  kpis.strategy = {
    department: 'strategy',
    metrics: {
      initiativesActive: (initiatives.initiatives || []).filter(i => i.status === 'active').length,
      pendingDecisions: decisions.filter(d => d.Status === 'new' || d.Status === 'awaiting-decision').length,
      implementedDecisions: decisions.filter(d => d.Status === 'implemented').length,
    },
    ...agentHealth.strategy,
    lastUpdated: new Date().toISOString(),
  };

  // CEO KPIs
  kpis.ceo = {
    department: 'ceo',
    metrics: {
      pendingDecisions: decisions.filter(d => d.Status === 'new' || d.Status === 'awaiting-decision').length,
      totalDecisions: decisions.length,
      avgDecisionTime: 0, // Would need decision timestamps to calculate
    },
    ...agentHealth.ceo,
    lastUpdated: new Date().toISOString(),
  };

  // Overall health
  const allHealthScores = Object.values(kpis).map(k => k.healthScore || 0);
  kpis._overall = {
    avgHealthScore: allHealthScores.length > 0
      ? Math.round(allHealthScores.reduce((a, b) => a + b, 0) / allHealthScores.length)
      : 0,
    departmentsHealthy: Object.values(kpis).filter(k => k.healthStatus === 'healthy').length,
    departmentsWarning: Object.values(kpis).filter(k => k.healthStatus === 'warning').length,
    departmentsCritical: Object.values(kpis).filter(k => k.healthStatus === 'critical').length,
    lastAggregated: new Date().toISOString(),
  };

  logger.info(`KPIs aggregated for ${ALL_DEPARTMENTS.length} departments. Overall health: ${kpis._overall.avgHealthScore}/100`);
  return kpis;
}

// ---------------------------------------------------------------------------
// KPI History & Trend Analysis
// ---------------------------------------------------------------------------

/**
 * Save a KPI snapshot for trend analysis.
 *
 * @param {Object} kpis - Current aggregated KPIs
 * @returns {void}
 */
function saveKPISnapshot(kpis) {
  const history = loadJSON(KPI_HISTORY_FILE, { daily: {}, weekly: {}, monthly: {} });
  const dateKey = getDateKey();
  const weekKey = getWeekKey();
  const monthKey = getMonthKey();

  // Save daily snapshot
  history.daily[dateKey] = {
    timestamp: new Date().toISOString(),
    kpis: extractMetricValues(kpis),
    overallHealth: kpis._overall?.avgHealthScore || 0,
  };

  // Aggregate weekly if we have enough daily data
  const weekDates = Object.keys(history.daily).filter(d => {
    const date = new Date(d);
    const now = new Date();
    const diffDays = Math.floor((now - date) / 86400000);
    return diffDays < 7;
  });

  if (weekDates.length > 0) {
    history.weekly[weekKey] = {
      timestamp: new Date().toISOString(),
      avgHealth: Math.round(
        weekDates.reduce((sum, d) => sum + (history.daily[d]?.overallHealth || 0), 0) / weekDates.length
      ),
      dataPoints: weekDates.length,
    };
  }

  // Monthly aggregation
  const monthDates = Object.keys(history.daily).filter(d => d.startsWith(monthKey));
  if (monthDates.length > 0) {
    history.monthly[monthKey] = {
      timestamp: new Date().toISOString(),
      avgHealth: Math.round(
        monthDates.reduce((sum, d) => sum + (history.daily[d]?.overallHealth || 0), 0) / monthDates.length
      ),
      dataPoints: monthDates.length,
    };
  }

  // Keep only last 90 daily entries, 26 weekly, 12 monthly
  const dailyKeys = Object.keys(history.daily).sort().reverse();
  if (dailyKeys.length > 90) {
    for (const key of dailyKeys.slice(90)) {
      delete history.daily[key];
    }
  }

  const weeklyKeys = Object.keys(history.weekly).sort().reverse();
  if (weeklyKeys.length > 26) {
    for (const key of weeklyKeys.slice(26)) {
      delete history.weekly[key];
    }
  }

  const monthlyKeys = Object.keys(history.monthly).sort().reverse();
  if (monthlyKeys.length > 12) {
    for (const key of monthlyKeys.slice(12)) {
      delete history.monthly[key];
    }
  }

  saveJSON(KPI_HISTORY_FILE, history);
  logger.info(`KPI snapshot saved for ${dateKey}`);
}

/**
 * Extract flat metric values from nested KPI structure.
 *
 * @param {Object} kpis - Aggregated KPIs
 * @returns {Object} Flat metric values
 */
function extractMetricValues(kpis) {
  const flat = {};
  for (const [dept, data] of Object.entries(kpis)) {
    if (dept.startsWith('_')) continue;
    if (data.metrics) {
      for (const [key, value] of Object.entries(data.metrics)) {
        flat[`${dept}.${key}`] = value;
      }
    }
  }
  return flat;
}

/**
 * Perform trend analysis comparing current KPIs with historical data.
 *
 * @param {Object} currentKPIs - Current aggregated KPIs
 * @param {string} [period='daily'] - 'daily' | 'weekly' | 'monthly'
 * @returns {Object} Trend analysis with changes per metric
 */
function analyzeTrends(currentKPIs, period = 'daily') {
  const history = loadJSON(KPI_HISTORY_FILE, { daily: {}, weekly: {}, monthly: {} });
  const periodData = history[period] || {};
  const sortedKeys = Object.keys(periodData).sort().reverse();

  // Get previous period data
  const previousKey = sortedKeys[0]; // Most recent previous snapshot
  const previousData = previousKey ? periodData[previousKey] : null;
  const currentFlat = extractMetricValues(currentKPIs);

  const trends = {};

  for (const [metricKey, currentValue] of Object.entries(currentFlat)) {
    if (typeof currentValue !== 'number') continue;

    const previousValue = previousData?.kpis?.[metricKey];
    const delta = typeof previousValue === 'number' ? currentValue - previousValue : 0;
    const percentChange = typeof previousValue === 'number' && previousValue !== 0
      ? parseFloat(((delta / previousValue) * 100).toFixed(1))
      : 0;

    trends[metricKey] = {
      current: currentValue,
      previous: previousValue ?? null,
      delta,
      percentChange,
      trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
    };
  }

  // Overall health trend
  const healthHistory = sortedKeys.slice(0, 7).map(k => periodData[k]?.overallHealth || periodData[k]?.avgHealth || 0);
  const avgRecentHealth = healthHistory.length > 0
    ? healthHistory.reduce((a, b) => a + b, 0) / healthHistory.length
    : 0;

  return {
    period,
    comparedTo: previousKey || 'N/A',
    metrics: trends,
    overallHealthTrend: {
      current: currentKPIs._overall?.avgHealthScore || 0,
      recentAvg: Math.round(avgRecentHealth),
      direction: (currentKPIs._overall?.avgHealthScore || 0) > avgRecentHealth ? 'improving' : 'declining',
    },
    analyzedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Alert System
// ---------------------------------------------------------------------------

/**
 * Check all KPIs against thresholds and generate alerts.
 *
 * @param {Object} kpis - Current aggregated KPIs
 * @returns {Alert[]} New alerts generated
 */
function checkThresholdsAndAlert(kpis) {
  const newAlerts = [];

  for (const [dept, deptConfig] of Object.entries(KPI_DEFINITIONS)) {
    const deptKPIs = kpis[dept];
    if (!deptKPIs || !deptKPIs.metrics) continue;

    for (const [metric, threshold] of Object.entries(deptConfig.thresholds || {})) {
      const value = deptKPIs.metrics[metric];
      if (typeof value !== 'number') continue;

      let level = null;
      if (threshold.direction === 'below') {
        if (value < threshold.critical) level = 'critical';
        else if (value < threshold.warning) level = 'warning';
      } else if (threshold.direction === 'above') {
        if (value > threshold.critical) level = 'critical';
        else if (value > threshold.warning) level = 'warning';
      }

      if (level) {
        newAlerts.push({
          id: generateId('alert'),
          level,
          department: dept,
          title: `${dept.toUpperCase()}: ${metric} ${threshold.direction === 'below' ? 'unter' : 'ueber'} Schwellenwert`,
          message: `${metric} = ${value} (${level === 'critical' ? 'kritisch' : 'Warnung'}: Schwellenwert ${threshold[level]})`,
          metric,
          currentValue: value,
          threshold: threshold[level],
          createdAt: new Date().toISOString(),
          acknowledged: false,
          acknowledgedAt: null,
        });
      }
    }
  }

  // Save alerts
  if (newAlerts.length > 0) {
    const alertData = loadJSON(ALERTS_FILE, { active: [], history: [] });

    for (const alert of newAlerts) {
      // Check if same alert already exists (avoid duplicates within 1 hour)
      const isDuplicate = alertData.active.some(
        a => a.department === alert.department && a.metric === alert.metric &&
             (new Date() - new Date(a.createdAt)) < 60 * 60 * 1000
      );

      if (!isDuplicate) {
        alertData.active.push(alert);
      }
    }

    saveJSON(ALERTS_FILE, alertData);
    logger.info(`${newAlerts.length} new alerts generated`);
  }

  return newAlerts;
}

/**
 * Get all active (unacknowledged) alerts, sorted by priority.
 *
 * @returns {Alert[]} Active alerts sorted by level (critical first)
 */
function getActiveAlerts() {
  const alertData = loadJSON(ALERTS_FILE, { active: [], history: [] });
  const levelOrder = { critical: 0, warning: 1, info: 2 };

  return (alertData.active || [])
    .filter(a => !a.acknowledged)
    .sort((a, b) => (levelOrder[a.level] || 2) - (levelOrder[b.level] || 2));
}

/**
 * Acknowledge an alert.
 *
 * @param {string} alertId - The alert ID
 * @returns {Alert|null} Updated alert
 */
function acknowledgeAlert(alertId) {
  const alertData = loadJSON(ALERTS_FILE, { active: [], history: [] });
  const alert = alertData.active.find(a => a.id === alertId);

  if (alert) {
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date().toISOString();
    alertData.history.push(alert);
    alertData.active = alertData.active.filter(a => a.id !== alertId);
    saveJSON(ALERTS_FILE, alertData);
    logger.info(`Alert acknowledged: ${alertId}`);
  }

  return alert;
}

// ---------------------------------------------------------------------------
// Morning Briefing Data Compilation
// ---------------------------------------------------------------------------

/**
 * Compile comprehensive morning briefing data from all sources.
 *
 * @returns {Promise<Object>} Complete briefing data package
 */
async function compileMorningBriefing() {
  logger.info('Compiling morning briefing data...');
  const startTime = Date.now();

  const kpis = await aggregateKPIs();
  const dailyTrends = analyzeTrends(kpis, 'daily');
  const weeklyTrends = analyzeTrends(kpis, 'weekly');
  const alerts = checkThresholdsAndAlert(kpis);
  const activeAlerts = getActiveAlerts();
  const initiatives = getStrategicInitiatives({ status: 'active' });

  // Save snapshot for future trend analysis
  saveKPISnapshot(kpis);

  const briefingData = {
    generatedAt: new Date().toISOString(),
    generationTimeMs: Date.now() - startTime,
    kpis,
    trends: {
      daily: dailyTrends,
      weekly: weeklyTrends,
    },
    alerts: {
      new: alerts,
      active: activeAlerts,
      criticalCount: activeAlerts.filter(a => a.level === 'critical').length,
      warningCount: activeAlerts.filter(a => a.level === 'warning').length,
    },
    strategicInitiatives: {
      active: initiatives.filter(i => i.status === 'active'),
      atRisk: initiatives.filter(i => i.progress < 50 && new Date(i.targetDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    },
    overallHealth: kpis._overall,
  };

  logger.info(`Morning briefing compiled in ${Date.now() - startTime}ms`);
  return briefingData;
}

// ---------------------------------------------------------------------------
// Executive Summary Generation
// ---------------------------------------------------------------------------

/**
 * Generate an AI-powered executive summary from the briefing data.
 *
 * @param {Object} briefingData - Compiled briefing data
 * @returns {Promise<Object>} Executive summary
 */
async function generateExecutiveSummary(briefingData) {
  logger.info('Generating executive summary...');

  try {
    const prompt = `Du bist der KI-Assistent des CEOs von Werkpilot. Erstelle eine praegnante Executive Summary basierend auf den folgenden Daten.

UEBERBLICK:
- Overall Health Score: ${briefingData.overallHealth?.avgHealthScore || 0}/100
- Departments Healthy: ${briefingData.overallHealth?.departmentsHealthy || 0}/9
- Departments Warning: ${briefingData.overallHealth?.departmentsWarning || 0}
- Departments Critical: ${briefingData.overallHealth?.departmentsCritical || 0}

AKTIVE ALERTS:
- Kritisch: ${briefingData.alerts?.criticalCount || 0}
- Warnungen: ${briefingData.alerts?.warningCount || 0}
${JSON.stringify(briefingData.alerts?.active?.slice(0, 5) || [], null, 2)}

KPI HIGHLIGHTS (Top Veraenderungen):
${JSON.stringify(
  Object.entries(briefingData.trends?.daily?.metrics || {})
    .filter(([_, v]) => Math.abs(v.percentChange) > 5)
    .sort((a, b) => Math.abs(b[1].percentChange) - Math.abs(a[1].percentChange))
    .slice(0, 10)
    .map(([key, v]) => ({ metric: key, change: `${v.percentChange > 0 ? '+' : ''}${v.percentChange}%`, value: v.current })),
  null, 2
)}

FINANZ-KPIs:
${JSON.stringify(briefingData.kpis?.finance?.metrics || {}, null, 2)}

SALES-KPIs:
${JSON.stringify(briefingData.kpis?.sales?.metrics || {}, null, 2)}

IT/AGENT STATUS:
${JSON.stringify(briefingData.kpis?.it?.metrics || {}, null, 2)}

STRATEGISCHE INITIATIVEN:
- Aktiv: ${briefingData.strategicInitiatives?.active?.length || 0}
- Gefaehrdet: ${briefingData.strategicInitiatives?.atRisk?.length || 0}

Erstelle als JSON:
{
  "headline": "Ein-Satz Zusammenfassung des Tages",
  "keyInsights": [
    "Insight 1 (wichtigstes zuerst)",
    "Insight 2",
    "Insight 3"
  ],
  "criticalActions": [
    {
      "action": "Was zu tun ist",
      "reason": "Warum dringend",
      "department": "Betroffene Abteilung"
    }
  ],
  "positiveHighlights": ["Positives 1", "Positives 2"],
  "riskFlags": ["Risiko 1", "Risiko 2"],
  "todayFocus": "Was heute der Fokus sein sollte (1 Satz)",
  "healthEmoji": "green|yellow|red",
  "confidenceLevel": "hoch|mittel|niedrig"
}`;

    const summary = await generateJSON(prompt, {
      system: 'Du bist ein praeziser Executive Advisor. Formuliere klar, datenbasiert und handlungsorientiert. Antworte auf Deutsch als valides JSON.',
      model: agentConfig.models.decisions,
      maxTokens: 2048,
    });

    return summary;
  } catch (err) {
    logger.error(`Executive summary generation failed: ${err.message}`);
    return {
      headline: 'Executive Summary konnte nicht generiert werden',
      keyInsights: [`Fehler: ${err.message}`],
      criticalActions: [],
      positiveHighlights: [],
      riskFlags: [],
      todayFocus: 'Bitte manuell pruefen',
      healthEmoji: 'yellow',
      confidenceLevel: 'niedrig',
    };
  }
}

// ---------------------------------------------------------------------------
// Board Meeting Preparation
// ---------------------------------------------------------------------------

/**
 * Generate comprehensive board meeting preparation data.
 * Aggregates all KPIs, financials, strategic progress, and generates
 * a structured report suitable for investor/board presentations.
 *
 * @returns {Promise<Object>} Board meeting preparation package
 */
async function prepareBoardMeetingData() {
  logger.info('Preparing board meeting data...');

  try {
    const kpis = await aggregateKPIs();
    const history = loadJSON(KPI_HISTORY_FILE, { daily: {}, weekly: {}, monthly: {} });
    const initiatives = getStrategicInitiatives();

    // Generate AI analysis for the board
    const prompt = `Erstelle eine Board-Meeting-Zusammenfassung fuer Werkpilot (Schweizer AI-Automations-Startup).

AKTUELLE KPIs:
${JSON.stringify({
  finance: kpis.finance?.metrics,
  sales: kpis.sales?.metrics,
  operations: kpis.operations?.metrics,
  it: kpis.it?.metrics,
}, null, 2)}

MONATLICHE TRENDS:
${JSON.stringify(Object.entries(history.monthly || {}).slice(0, 3), null, 2)}

STRATEGISCHE INITIATIVEN:
${JSON.stringify(initiatives.map(i => ({
  title: i.title,
  status: i.status,
  progress: i.progress,
  targetDate: i.targetDate,
})), null, 2)}

Erstelle als JSON:
{
  "executiveOverview": "2-3 Saetze Gesamt-Ueberblick fuer das Board",
  "financialHighlights": {
    "mrr": "CHF Wert",
    "growth": "Wachstumsrate",
    "runway": "Runway in Monaten",
    "keyMetric": "Wichtigster Finanz-Indikator"
  },
  "productUpdate": "1-2 Saetze zum Produktfortschritt",
  "customerMetrics": {
    "activeClients": 0,
    "pipeline": "Pipeline-Wert",
    "retention": "Retention-Rate"
  },
  "teamUpdate": "1 Satz zum Team",
  "strategicProgress": [
    {
      "initiative": "Name",
      "status": "On Track/At Risk/Behind",
      "highlight": "Wichtigstes Update"
    }
  ],
  "risksAndChallenges": ["Risiko 1", "Risiko 2"],
  "askFromBoard": ["Was wird vom Board benoetigt"],
  "quarterOutlook": "1-2 Saetze zum Quartalsausblick"
}`;

    const boardAnalysis = await generateJSON(prompt, {
      system: 'Du bist ein erfahrener CFO-Berater. Erstelle investor-taugliche Zusammenfassungen. Antworte auf Deutsch als valides JSON.',
      model: agentConfig.models.decisions,
      maxTokens: 3000,
    });

    const boardPackage = {
      generatedAt: new Date().toISOString(),
      period: getMonthKey(),
      analysis: boardAnalysis,
      rawKPIs: kpis,
      historicalTrends: {
        monthly: Object.entries(history.monthly || {}).slice(0, 6),
        weekly: Object.entries(history.weekly || {}).slice(0, 12),
      },
      strategicInitiatives: initiatives,
    };

    // Save board report
    const reportPath = path.join(BOARD_DATA_DIR, `board-${getDateKey()}.json`);
    saveJSON(reportPath, boardPackage);

    logger.info(`Board meeting data prepared: ${reportPath}`);
    return boardPackage;
  } catch (err) {
    logger.error(`Board meeting prep failed: ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Strategic Initiative Tracking
// ---------------------------------------------------------------------------

/**
 * Get all strategic initiatives, optionally filtered.
 *
 * @param {Object} [filters={}] - Filter options
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.owner] - Filter by owner
 * @returns {StrategicInitiative[]} Filtered initiatives
 */
function getStrategicInitiatives(filters = {}) {
  const data = loadJSON(INITIATIVES_FILE, { initiatives: [] });
  let initiatives = data.initiatives || [];

  if (filters.status) {
    initiatives = initiatives.filter(i => i.status === filters.status);
  }
  if (filters.owner) {
    initiatives = initiatives.filter(i => i.owner === filters.owner);
  }

  return initiatives;
}

/**
 * Create or update a strategic initiative.
 *
 * @param {Object} initiative - Initiative data
 * @returns {StrategicInitiative} Created/updated initiative
 */
function upsertInitiative(initiative) {
  const data = loadJSON(INITIATIVES_FILE, { initiatives: [] });

  const existing = data.initiatives.findIndex(i => i.id === initiative.id);

  const record = {
    id: initiative.id || generateId('init'),
    title: initiative.title,
    description: initiative.description || '',
    owner: initiative.owner || 'CEO',
    status: initiative.status || 'planned',
    progress: initiative.progress || 0,
    milestones: initiative.milestones || [],
    kpis: initiative.kpis || {},
    startDate: initiative.startDate || new Date().toISOString().split('T')[0],
    targetDate: initiative.targetDate || null,
    lastUpdated: new Date().toISOString(),
  };

  if (existing >= 0) {
    data.initiatives[existing] = { ...data.initiatives[existing], ...record };
  } else {
    data.initiatives.push(record);
  }

  saveJSON(INITIATIVES_FILE, data);
  logger.info(`Initiative ${existing >= 0 ? 'updated' : 'created'}: ${record.title}`);
  return record;
}

/**
 * Update milestone status for an initiative.
 *
 * @param {string} initiativeId - Initiative ID
 * @param {number} milestoneIndex - Milestone index
 * @param {Object} update - Milestone update data
 * @returns {StrategicInitiative|null} Updated initiative
 */
function updateMilestone(initiativeId, milestoneIndex, update) {
  const data = loadJSON(INITIATIVES_FILE, { initiatives: [] });
  const initiative = data.initiatives.find(i => i.id === initiativeId);

  if (!initiative) {
    logger.warn(`Initiative not found: ${initiativeId}`);
    return null;
  }

  if (!initiative.milestones[milestoneIndex]) {
    logger.warn(`Milestone ${milestoneIndex} not found in ${initiativeId}`);
    return null;
  }

  Object.assign(initiative.milestones[milestoneIndex], update);

  // Recalculate progress based on milestones
  const completedMilestones = initiative.milestones.filter(m => m.status === 'completed').length;
  initiative.progress = Math.round((completedMilestones / initiative.milestones.length) * 100);
  initiative.lastUpdated = new Date().toISOString();

  saveJSON(INITIATIVES_FILE, data);
  logger.info(`Milestone updated for ${initiativeId}: ${milestoneIndex}`);
  return initiative;
}

// ---------------------------------------------------------------------------
// Email Formatting
// ---------------------------------------------------------------------------

/**
 * Build a comprehensive CEO dashboard email.
 *
 * @param {Object} briefingData - Compiled briefing data
 * @param {Object} summary - Executive summary
 * @returns {string} HTML email content
 */
function formatDashboardEmail(briefingData, summary) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('de-CH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

  const healthColor = (summary.healthEmoji === 'green' || briefingData.overallHealth?.avgHealthScore >= 80) ? '#06d6a0'
    : (summary.healthEmoji === 'red' || briefingData.overallHealth?.avgHealthScore < 50) ? '#e94560'
    : '#ffd166';

  // Department health cards
  const deptCards = ALL_DEPARTMENTS.filter(d => d !== 'ceo').map(dept => {
    const data = briefingData.kpis?.[dept];
    if (!data) return '';
    const color = data.healthStatus === 'healthy' ? '#06d6a0' : data.healthStatus === 'warning' ? '#ffd166' : data.healthStatus === 'critical' ? '#e94560' : '#999';
    const icon = data.healthStatus === 'healthy' ? 'OK' : data.healthStatus === 'warning' ? '!!' : data.healthStatus === 'critical' ? 'XX' : '??';

    const topMetrics = Object.entries(data.metrics || {}).slice(0, 3).map(([k, v]) =>
      `<span style="font-size:11px;color:#666;">${k}: <strong>${typeof v === 'number' ? v.toLocaleString('de-CH') : v}</strong></span>`
    ).join('<br>');

    return `
      <div style="flex:1;min-width:180px;background:#f8f9fa;border-radius:8px;padding:12px;border-top:3px solid ${color};">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:13px;color:#16213e;">${dept.toUpperCase()}</strong>
          <span style="font-size:11px;font-weight:bold;color:${color};">${icon} ${data.healthScore || 0}%</span>
        </div>
        <div style="margin-top:8px;">${topMetrics}</div>
      </div>`;
  }).join('');

  // Alerts section
  const activeAlerts = briefingData.alerts?.active || [];
  const alertsHtml = activeAlerts.length > 0 ? activeAlerts.slice(0, 5).map(alert => {
    const alertColor = alert.level === 'critical' ? '#e94560' : alert.level === 'warning' ? '#ffc107' : '#17a2b8';
    return `<li style="margin:6px 0;"><span style="color:${alertColor};font-weight:bold;">[${alert.level.toUpperCase()}]</span> ${alert.department}: ${alert.message}</li>`;
  }).join('') : '<li style="color:#06d6a0;">Keine aktiven Alerts</li>';

  // Significant trend changes
  const significantTrends = Object.entries(briefingData.trends?.daily?.metrics || {})
    .filter(([_, v]) => Math.abs(v.percentChange) > 5)
    .sort((a, b) => Math.abs(b[1].percentChange) - Math.abs(a[1].percentChange))
    .slice(0, 8);

  const trendsHtml = significantTrends.map(([key, v]) => {
    const trendColor = v.trend === 'up' ? '#06d6a0' : v.trend === 'down' ? '#e94560' : '#999';
    const arrow = v.trend === 'up' ? '+' : '';
    return `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${key}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${typeof v.current === 'number' ? v.current.toLocaleString('de-CH') : v.current}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;color:${trendColor};font-weight:bold;">${arrow}${v.percentChange}%</td>
      </tr>`;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;margin:0;padding:0;background:#f5f5f5;">
  <div style="max-width:900px;margin:20px auto;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:28px;border-radius:8px 8px 0 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h1 style="margin:0;font-size:26px;">CEO Dashboard</h1>
          <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">${dateStr} | ${timeStr}</p>
        </div>
        <div style="text-align:center;">
          <div style="width:64px;height:64px;border-radius:50%;background:${healthColor};display:flex;align-items:center;justify-content:center;">
            <span style="font-size:22px;font-weight:bold;color:white;">${briefingData.overallHealth?.avgHealthScore || 0}</span>
          </div>
          <span style="font-size:11px;opacity:0.8;">Health Score</span>
        </div>
      </div>
    </div>

    <div style="padding:24px;">
      <!-- Executive Summary -->
      <div style="background:#e8f4f8;border-left:4px solid #0077b6;padding:16px;margin-bottom:20px;border-radius:4px;">
        <h2 style="margin:0 0 8px;color:#0077b6;font-size:18px;">Executive Summary</h2>
        <p style="margin:0 0 12px;font-size:15px;font-weight:bold;color:#16213e;">${summary.headline || ''}</p>
        <ul style="margin:0;padding-left:20px;">
          ${(summary.keyInsights || []).map(i => `<li style="margin:4px 0;">${i}</li>`).join('')}
        </ul>
        ${summary.todayFocus ? `<p style="margin:12px 0 0;padding:8px 12px;background:#d4edda;border-radius:4px;"><strong>Fokus heute:</strong> ${summary.todayFocus}</p>` : ''}
      </div>

      <!-- Critical Actions -->
      ${(summary.criticalActions || []).length > 0 ? `
      <div style="background:#fff3f3;border-left:4px solid #e94560;padding:16px;margin-bottom:20px;border-radius:4px;">
        <h3 style="margin:0 0 8px;color:#e94560;">Kritische Aktionen</h3>
        ${summary.criticalActions.map(a => `
          <div style="margin:8px 0;padding:8px;background:white;border-radius:4px;">
            <strong>${a.action}</strong> <span style="font-size:12px;color:#666;">(${a.department})</span><br>
            <span style="font-size:13px;color:#555;">${a.reason}</span>
          </div>
        `).join('')}
      </div>` : ''}

      <!-- Alerts -->
      <div style="margin-bottom:20px;">
        <h2 style="color:#16213e;font-size:18px;border-bottom:2px solid #e94560;padding-bottom:8px;">
          Alerts (${activeAlerts.length})
        </h2>
        <ul style="padding-left:20px;">${alertsHtml}</ul>
      </div>

      <!-- Department Overview -->
      <h2 style="color:#16213e;font-size:18px;border-bottom:2px solid #e94560;padding-bottom:8px;">Department Health</h2>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;">${deptCards}</div>

      <!-- Trend Changes -->
      ${significantTrends.length > 0 ? `
      <h2 style="color:#16213e;font-size:18px;border-bottom:2px solid #e94560;padding-bottom:8px;margin-top:24px;">Signifikante Veraenderungen</h2>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #ddd;">Metrik</th>
            <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #ddd;">Wert</th>
            <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #ddd;">Veraenderung</th>
          </tr>
        </thead>
        <tbody>${trendsHtml}</tbody>
      </table>` : ''}

      <!-- Strategic Initiatives -->
      ${(briefingData.strategicInitiatives?.active || []).length > 0 ? `
      <h2 style="color:#16213e;font-size:18px;border-bottom:2px solid #e94560;padding-bottom:8px;margin-top:24px;">Strategische Initiativen</h2>
      ${briefingData.strategicInitiatives.active.map(init => {
        const progressColor = init.progress >= 70 ? '#06d6a0' : init.progress >= 40 ? '#ffd166' : '#e94560';
        return `
        <div style="margin:10px 0;padding:10px;background:#f8f9fa;border-radius:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${init.title}</strong>
            <span style="font-size:13px;color:${progressColor};font-weight:bold;">${init.progress}%</span>
          </div>
          <div style="margin-top:6px;background:#eee;border-radius:4px;height:6px;overflow:hidden;">
            <div style="width:${init.progress}%;height:100%;background:${progressColor};border-radius:4px;"></div>
          </div>
          <span style="font-size:12px;color:#888;">Owner: ${init.owner} | Ziel: ${init.targetDate || 'TBD'}</span>
        </div>`;
      }).join('')}` : ''}
    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;padding:16px;text-align:center;border-radius:0 0 8px 8px;">
      <p style="margin:0;color:#666;font-size:12px;">
        Werkpilot CEO Dashboard Agent | ${ALL_DEPARTMENTS.length} Departments | Generated ${new Date().toISOString()}
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main Execute Function
// ---------------------------------------------------------------------------

/**
 * Main execution entry point for the CEO Dashboard agent.
 *
 * @param {Object} [options={}] - Execution options
 * @param {string} [options.mode='briefing'] - Execution mode:
 *   - 'briefing': Full morning briefing with email
 *   - 'snapshot': Just aggregate KPIs and save snapshot (no email)
 *   - 'alerts': Only check thresholds and send alerts
 *   - 'board': Generate board meeting preparation data
 *   - 'trends': Generate trend analysis report
 *   - 'full': Everything combined
 * @returns {Promise<Object>} Execution result
 */
async function execute(options = {}) {
  const mode = options.mode || 'briefing';
  const startTime = Date.now();

  logger.info(`=== CEO Dashboard Agent executing in mode: ${mode} ===`);

  try {
    await dashboardSync.syncAgentStatus(AGENT_NAME, 'active');
    let result = {};

    switch (mode) {
      case 'briefing': {
        // Full morning briefing
        const briefingData = await compileMorningBriefing();
        const summary = await generateExecutiveSummary(briefingData);

        // Send dashboard email
        const emailHtml = formatDashboardEmail(briefingData, summary);
        const dateStr = new Date().toLocaleDateString('de-CH', {
          weekday: 'long', day: 'numeric', month: 'long',
        });

        await sendCEOEmail({
          subject: `CEO Dashboard - ${dateStr}`,
          html: emailHtml,
        });

        // Sync to dashboard
        await dashboardSync.sendNotification(
          'CEO Dashboard aktualisiert',
          `Health Score: ${briefingData.overallHealth?.avgHealthScore || 0}/100 | ${briefingData.alerts?.active?.length || 0} aktive Alerts`,
          briefingData.alerts?.criticalCount > 0 ? 'error' : briefingData.alerts?.warningCount > 0 ? 'warning' : 'success',
          '/dashboard/ceo'
        );

        result = { briefingData, summary };
        break;
      }

      case 'snapshot': {
        const kpis = await aggregateKPIs();
        saveKPISnapshot(kpis);
        result = { kpis };
        break;
      }

      case 'alerts': {
        const kpis = await aggregateKPIs();
        const newAlerts = checkThresholdsAndAlert(kpis);
        const criticalAlerts = newAlerts.filter(a => a.level === 'critical');

        // Send immediate email for critical alerts
        if (criticalAlerts.length > 0) {
          await sendCEOEmail({
            subject: `[KRITISCH] ${criticalAlerts.length} kritische Alerts`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff3f3;border-left:4px solid #e94560;border-radius:8px;">
              <h2 style="color:#c92a2a;">Kritische Alerts</h2>
              <ul>${criticalAlerts.map(a => `<li><strong>${a.department}:</strong> ${a.message}</li>`).join('')}</ul>
            </div>`,
          });
        }

        result = { newAlerts, criticalCount: criticalAlerts.length };
        break;
      }

      case 'board': {
        const boardData = await prepareBoardMeetingData();

        await sendCEOEmail({
          subject: `Board Meeting Data - ${getMonthKey()}`,
          html: `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:20px;">
            <h2 style="color:#16213e;">Board Meeting Preparation</h2>
            <div style="background:#f0f4ff;padding:16px;border-radius:8px;">
              <p><strong>Overview:</strong> ${boardData.analysis?.executiveOverview || 'N/A'}</p>
              <p><strong>Quarter Outlook:</strong> ${boardData.analysis?.quarterOutlook || 'N/A'}</p>
            </div>
            <h3>Risks</h3>
            <ul>${(boardData.analysis?.risksAndChallenges || []).map(r => `<li>${r}</li>`).join('')}</ul>
            <h3>Board Asks</h3>
            <ul>${(boardData.analysis?.askFromBoard || []).map(a => `<li>${a}</li>`).join('')}</ul>
            <p style="font-size:12px;color:#888;">Full data saved to: board-${getDateKey()}.json</p>
          </div>`,
        });

        result = { boardData };
        break;
      }

      case 'trends': {
        const kpis = await aggregateKPIs();
        const dailyTrends = analyzeTrends(kpis, 'daily');
        const weeklyTrends = analyzeTrends(kpis, 'weekly');
        const monthlyTrends = analyzeTrends(kpis, 'monthly');

        result = { trends: { daily: dailyTrends, weekly: weeklyTrends, monthly: monthlyTrends } };
        break;
      }

      case 'full': {
        // Everything combined
        const briefingData = await compileMorningBriefing();
        const summary = await generateExecutiveSummary(briefingData);
        const boardData = await prepareBoardMeetingData();

        const emailHtml = formatDashboardEmail(briefingData, summary);
        await sendCEOEmail({
          subject: `CEO Full Dashboard - ${getDateKey()}`,
          html: emailHtml,
        });

        result = { briefingData, summary, boardData };
        break;
      }

      default:
        throw new Error(`Unknown mode: ${mode}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== CEO Dashboard Agent complete in ${elapsed}s ===`);

    await dashboardSync.syncAgentStatus(AGENT_NAME, 'idle', 100, 1, 0);

    return { success: true, mode, elapsed, ...result };
  } catch (err) {
    logger.error(`CEO Dashboard Agent failed: ${err.message}`, { stack: err.stack });

    try {
      await dashboardSync.syncAgentStatus(AGENT_NAME, 'error', 0, 0, 1);
    } catch (_) { /* ignore */ }

    return { success: false, mode, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

/**
 * Start the CEO Dashboard agent with cron schedules.
 * @returns {void}
 */
function start() {
  ensureDirectories();
  logger.info('CEO Dashboard Agent starting...');

  // Morning briefing at 06:15 (before the existing morning briefing at 06:30)
  cron.schedule('15 6 * * *', () => {
    logger.info('Cron triggered: morning dashboard briefing');
    execute({ mode: 'briefing' });
  }, { timezone: TIMEZONE });

  // KPI snapshot every 4 hours during business hours
  cron.schedule('0 8,12,16,20 * * *', () => {
    logger.info('Cron triggered: KPI snapshot');
    execute({ mode: 'snapshot' });
  }, { timezone: TIMEZONE });

  // Alert check every 30 minutes
  cron.schedule('*/30 * * * *', () => {
    logger.info('Cron triggered: alert check');
    execute({ mode: 'alerts' });
  });

  // Weekly trend report on Mondays at 07:00
  cron.schedule('0 7 * * 1', () => {
    logger.info('Cron triggered: weekly trend analysis');
    execute({ mode: 'trends' }).then(async (result) => {
      if (result.success && result.trends) {
        const significant = Object.entries(result.trends.weekly?.metrics || {})
          .filter(([_, v]) => Math.abs(v.percentChange) > 10)
          .slice(0, 10);

        if (significant.length > 0) {
          try {
            await sendCEOEmail({
              subject: `Weekly Trends: ${significant.length} signifikante Veraenderungen`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2>Woechentliche Trend-Analyse</h2>
                <table style="width:100%;border-collapse:collapse;">
                  <tr style="background:#f0f0f0;"><th style="padding:8px;text-align:left;">Metrik</th><th style="padding:8px;text-align:right;">Veraenderung</th></tr>
                  ${significant.map(([k, v]) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${k}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;color:${v.trend === 'up' ? '#06d6a0' : '#e94560'};font-weight:bold;">${v.percentChange > 0 ? '+' : ''}${v.percentChange}%</td></tr>`).join('')}
                </table>
              </div>`,
            });
          } catch (emailErr) {
            logger.warn(`Could not send weekly trends email: ${emailErr.message}`);
          }
        }
      }
    });
  }, { timezone: TIMEZONE });

  // Monthly board prep on the 25th at 10:00
  cron.schedule('0 10 25 * *', () => {
    logger.info('Cron triggered: monthly board meeting prep');
    execute({ mode: 'board' });
  }, { timezone: TIMEZONE });

  logger.info('CEO Dashboard Agent is running with schedules:');
  logger.info('  - Morning briefing: 06:15 daily');
  logger.info('  - KPI snapshots: every 4h during business hours');
  logger.info('  - Alert checks: every 30min');
  logger.info('  - Weekly trends: Monday 07:00');
  logger.info('  - Board prep: 25th of month 10:00');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--briefing') || args.includes('-b')) {
    execute({ mode: 'briefing' }).then(r => console.log(JSON.stringify({ success: r.success, elapsed: r.elapsed }, null, 2)));
  } else if (args.includes('--snapshot') || args.includes('-s')) {
    execute({ mode: 'snapshot' }).then(r => console.log(JSON.stringify(r, null, 2)));
  } else if (args.includes('--alerts') || args.includes('-a')) {
    execute({ mode: 'alerts' }).then(r => console.log(JSON.stringify(r, null, 2)));
  } else if (args.includes('--board')) {
    execute({ mode: 'board' }).then(r => console.log(JSON.stringify({ success: r.success, elapsed: r.elapsed }, null, 2)));
  } else if (args.includes('--trends') || args.includes('-t')) {
    execute({ mode: 'trends' }).then(r => console.log(JSON.stringify(r, null, 2)));
  } else if (args.includes('--full') || args.includes('-f')) {
    execute({ mode: 'full' }).then(r => console.log(JSON.stringify({ success: r.success, elapsed: r.elapsed }, null, 2)));
  } else if (args.includes('--add-initiative')) {
    const idx = args.indexOf('--add-initiative');
    const title = args[idx + 1] || 'New Initiative';
    const owner = args[idx + 2] || 'CEO';
    const init = upsertInitiative({ title, owner, status: 'planned' });
    console.log('Initiative created:', JSON.stringify(init, null, 2));
  } else if (args.includes('--initiatives')) {
    const initiatives = getStrategicInitiatives();
    console.log(JSON.stringify(initiatives, null, 2));
  } else if (args.includes('--active-alerts')) {
    const alerts = getActiveAlerts();
    console.log(JSON.stringify(alerts, null, 2));
  } else if (args.includes('--ack-alert')) {
    const alertId = args[args.indexOf('--ack-alert') + 1];
    if (alertId) {
      const result = acknowledgeAlert(alertId);
      console.log(result ? 'Alert acknowledged' : 'Alert not found');
    } else {
      console.error('Usage: --ack-alert <alertId>');
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
  aggregateKPIs,
  compileMorningBriefing,
  generateExecutiveSummary,
  prepareBoardMeetingData,
  analyzeTrends,
  checkThresholdsAndAlert,
  getActiveAlerts,
  acknowledgeAlert,
  getStrategicInitiatives,
  upsertInitiative,
  updateMilestone,
  saveKPISnapshot,
};
