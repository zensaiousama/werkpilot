/**
 * Agent 41 — Data Analytics Agent
 *
 * Central data warehouse that aggregates metrics from all agents,
 * provides a dashboard API (Express on port 3002), generates standard
 * reports (daily/weekly/monthly), detects anomalies, supports natural
 * language queries, exports data, and runs quality checks.
 *
 * Schedule: Daily metrics at 06:00, weekly report Monday 05:00,
 *           monthly report 1st at 04:00.
 * API Server: Express on port 3002.
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('it-data-analytics');

// ── Constants ────────────────────────────────────────────────────────────────

const SCHEMAS_DIR = path.join(__dirname, 'schemas');
const REPORTS_DIR = path.join(__dirname, 'reports');
const API_PORT = 3002;

const TABLES = {
  LEADS: 'Leads',
  CLIENTS: 'Clients',
  REVENUE: 'Revenue',
  AGENT_METRICS: 'AgentMetrics',
  DAILY_METRICS: 'DailyMetrics',
  WEEKLY_REPORTS: 'WeeklyReports',
  MONTHLY_REPORTS: 'MonthlyReports',
  ANOMALIES: 'Anomalies',
  DATA_QUALITY: 'DataQuality',
};

const ANOMALY_THRESHOLDS = {
  revenueChangePercent: 30,
  leadVolumeChangePercent: 50,
  errorRatePercent: 15,
  agentFailureRate: 20,
};

// ── Data Warehouse ───────────────────────────────────────────────────────────

/**
 * Aggregate daily metrics from all data sources.
 */
async function aggregateDailyMetrics() {
  logger.info('Aggregating daily metrics...');
  const today = new Date().toISOString().slice(0, 10);
  const startTime = Date.now();

  const metrics = {
    date: today,
    revenue: { total: 0, recurring: 0, oneTime: 0, count: 0 },
    leads: { new: 0, qualified: 0, converted: 0, lost: 0 },
    clients: { active: 0, new: 0, churned: 0, totalMRR: 0 },
    agents: { totalRuns: 0, completed: 0, failed: 0, avgDurationMs: 0 },
    errors: { total: 0, critical: 0, byAgent: {} },
    tasks: { created: 0, completed: 0, overdue: 0 },
  };

  try {
    // Revenue metrics
    const revenueRecords = await getRecords(TABLES.REVENUE, `{Date} = "${today}"`);
    for (const record of revenueRecords) {
      metrics.revenue.total += record.Amount || 0;
      metrics.revenue.count++;
      if (record.Type === 'Recurring') {
        metrics.revenue.recurring += record.Amount || 0;
      } else {
        metrics.revenue.oneTime += record.Amount || 0;
      }
    }

    // Lead metrics
    const leads = await getRecords(TABLES.LEADS, `{CreatedDate} = "${today}"`);
    metrics.leads.new = leads.length;
    metrics.leads.qualified = leads.filter(l => l.Status === 'Qualified').length;
    metrics.leads.converted = leads.filter(l => l.Status === 'Converted').length;
    metrics.leads.lost = leads.filter(l => l.Status === 'Lost').length;

    // Client metrics
    const clients = await getRecords(TABLES.CLIENTS, '{Status} = "Client"');
    metrics.clients.active = clients.length;
    metrics.clients.totalMRR = clients.reduce((sum, c) => sum + (c.MRR || 0), 0);

    const newClients = clients.filter(c => c.StartDate === today);
    metrics.clients.new = newClients.length;

    // Agent metrics
    const agentRuns = await getRecords(TABLES.AGENT_METRICS, `{RunDate} >= "${today}"`);
    metrics.agents.totalRuns = agentRuns.length;
    metrics.agents.completed = agentRuns.filter(r => r.Status === 'completed').length;
    metrics.agents.failed = agentRuns.filter(r => r.Status === 'failed').length;

    const durations = agentRuns.filter(r => r.Duration).map(r => r.Duration);
    metrics.agents.avgDurationMs = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Error aggregation by agent
    const failedRuns = agentRuns.filter(r => r.Status === 'failed');
    metrics.errors.total = failedRuns.length;
    for (const run of failedRuns) {
      const agentName = run.AgentName || 'unknown';
      metrics.errors.byAgent[agentName] = (metrics.errors.byAgent[agentName] || 0) + 1;
    }
    metrics.errors.critical = failedRuns.filter(r => r.Priority === 'Critical').length;

    // Store daily metrics
    await createRecord(TABLES.DAILY_METRICS, {
      Date: today,
      RevenueTotal: metrics.revenue.total,
      RevenueRecurring: metrics.revenue.recurring,
      NewLeads: metrics.leads.new,
      QualifiedLeads: metrics.leads.qualified,
      ConvertedLeads: metrics.leads.converted,
      ActiveClients: metrics.clients.active,
      TotalMRR: metrics.clients.totalMRR,
      AgentRuns: metrics.agents.totalRuns,
      AgentCompleted: metrics.agents.completed,
      AgentFailed: metrics.agents.failed,
      TotalErrors: metrics.errors.total,
      MetricsJSON: JSON.stringify(metrics),
      AggregatedAt: new Date().toISOString(),
      DurationMs: Date.now() - startTime,
    });

    logger.info(`Daily metrics aggregated: Revenue CHF ${metrics.revenue.total}, ${metrics.leads.new} leads, ${metrics.agents.totalRuns} agent runs`);
    return metrics;
  } catch (error) {
    logger.error(`Daily metrics aggregation failed: ${error.message}`);
    throw error;
  }
}

// ── Report Generation ────────────────────────────────────────────────────────

/**
 * Generate daily report with revenue, leads, tasks, and errors.
 */
async function generateDailyReport() {
  logger.info('Generating daily report...');
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    const todayMetrics = await getDailyMetrics(today);
    const yesterdayMetrics = await getDailyMetrics(yesterday);

    const changes = calculateChanges(todayMetrics, yesterdayMetrics);

    // Check for anomalies
    const anomalies = detectAnomalies(todayMetrics, yesterdayMetrics);
    if (anomalies.length > 0) {
      await storeAnomalies(anomalies);
    }

    const html = buildDailyReportHTML(todayMetrics, changes, anomalies);

    await sendCEOEmail({
      subject: `Daily Report ${today}: CHF ${todayMetrics.revenue?.total || 0} Revenue, ${todayMetrics.leads?.new || 0} New Leads`,
      html,
    });

    logger.info('Daily report sent');
    return { date: today, metrics: todayMetrics, changes, anomalies };
  } catch (error) {
    logger.error(`Daily report generation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Generate weekly report with growth trends.
 */
async function generateWeeklyReport() {
  logger.info('Generating weekly report...');
  const endDate = new Date();
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const weeklyData = await getMetricsRange(startDate, endDate);
    const previousWeekData = await getMetricsRange(
      new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
      startDate
    );

    // Aggregate weekly totals
    const weekTotals = aggregateMetricsRange(weeklyData);
    const prevWeekTotals = aggregateMetricsRange(previousWeekData);
    const growthMetrics = calculateGrowth(weekTotals, prevWeekTotals);

    // Use AI for trend analysis
    const trendAnalysis = await generateJSON(
      `Analyze these weekly business metrics for Werkpilot (Swiss digital agency) and provide insights.

This week:
${JSON.stringify(weekTotals, null, 2)}

Previous week:
${JSON.stringify(prevWeekTotals, null, 2)}

Growth:
${JSON.stringify(growthMetrics, null, 2)}

Return JSON: {
  "summary": "2-3 sentence executive summary",
  "highlights": ["positive highlight 1", "positive highlight 2"],
  "concerns": ["concern 1 if any"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "outlook": "brief outlook for next week"
}`,
      { model: config.models.standard, maxTokens: 1000 }
    );

    const report = {
      period: `${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`,
      totals: weekTotals,
      growth: growthMetrics,
      analysis: trendAnalysis,
      dailyBreakdown: weeklyData,
    };

    // Store report
    await createRecord(TABLES.WEEKLY_REPORTS, {
      WeekStart: startDate.toISOString().slice(0, 10),
      WeekEnd: endDate.toISOString().slice(0, 10),
      TotalRevenue: weekTotals.revenue,
      NewLeads: weekTotals.leads,
      NewClients: weekTotals.newClients,
      AgentRuns: weekTotals.agentRuns,
      Summary: trendAnalysis.summary,
      ReportJSON: JSON.stringify(report),
      GeneratedAt: new Date().toISOString(),
    });

    // Send email
    const html = buildWeeklyReportHTML(report);
    await sendCEOEmail({
      subject: `Weekly Report: CHF ${weekTotals.revenue} Revenue (${growthMetrics.revenueGrowth}% growth)`,
      html,
    });

    logger.info('Weekly report generated and sent');
    return report;
  } catch (error) {
    logger.error(`Weekly report generation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Generate monthly report with P&L, cohorts, and forecasts.
 */
async function generateMonthlyReport() {
  logger.info('Generating monthly report...');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  try {
    const monthlyData = await getMetricsRange(monthStart, monthEnd);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
    const prevMonthData = await getMetricsRange(prevMonthStart, prevMonthEnd);

    const monthTotals = aggregateMetricsRange(monthlyData);
    const prevMonthTotals = aggregateMetricsRange(prevMonthData);

    // Generate comprehensive analysis with AI
    const analysis = await generateJSON(
      `Generate a comprehensive monthly business report for Werkpilot (Swiss digital agency).

This month (${monthStart.toISOString().slice(0, 7)}):
${JSON.stringify(monthTotals, null, 2)}

Previous month:
${JSON.stringify(prevMonthTotals, null, 2)}

Include:
1. P&L summary (simplified)
2. Client cohort analysis (new vs returning revenue)
3. 3-month forecast based on trends
4. Key performance indicators vs targets
5. Agent system performance summary

Return JSON: {
  "executiveSummary": "...",
  "pnl": { "revenue": 0, "estimatedCosts": 0, "grossMargin": 0, "netMarginPercent": 0 },
  "cohortAnalysis": { "newClientRevenue": 0, "existingClientRevenue": 0, "churnRate": 0 },
  "forecast": { "month1": 0, "month2": 0, "month3": 0, "confidence": "low|medium|high" },
  "kpis": [{ "name": "...", "actual": 0, "target": 0, "status": "on_track|at_risk|behind" }],
  "agentPerformance": { "uptime": 0, "successRate": 0, "totalCost": 0 },
  "recommendations": ["..."]
}`,
      { model: config.models.powerful, maxTokens: 2500 }
    );

    const report = {
      period: monthStart.toISOString().slice(0, 7),
      totals: monthTotals,
      analysis,
      dailyBreakdown: monthlyData,
    };

    // Store report
    await createRecord(TABLES.MONTHLY_REPORTS, {
      Month: monthStart.toISOString().slice(0, 7),
      TotalRevenue: monthTotals.revenue,
      TotalLeads: monthTotals.leads,
      TotalClients: monthTotals.activeClients,
      ExecutiveSummary: analysis.executiveSummary,
      ReportJSON: JSON.stringify(report),
      GeneratedAt: new Date().toISOString(),
    });

    // Send email
    const html = buildMonthlyReportHTML(report);
    await sendCEOEmail({
      subject: `Monthly Report ${monthStart.toISOString().slice(0, 7)}: ${analysis.executiveSummary.substring(0, 80)}...`,
      html,
    });

    logger.info('Monthly report generated and sent');
    return report;
  } catch (error) {
    logger.error(`Monthly report generation failed: ${error.message}`);
    throw error;
  }
}

// ── Anomaly Detection ────────────────────────────────────────────────────────

/**
 * Detect anomalies by comparing metrics against recent baselines.
 */
function detectAnomalies(current, previous) {
  const anomalies = [];

  if (!current || !previous) return anomalies;

  // Revenue anomaly
  if (previous.revenue?.total > 0) {
    const revenueChange = ((current.revenue.total - previous.revenue.total) / previous.revenue.total) * 100;
    if (Math.abs(revenueChange) > ANOMALY_THRESHOLDS.revenueChangePercent) {
      anomalies.push({
        type: 'revenue',
        severity: revenueChange < 0 ? 'high' : 'medium',
        message: `Revenue ${revenueChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(revenueChange).toFixed(1)}%`,
        current: current.revenue.total,
        previous: previous.revenue.total,
        changePercent: revenueChange,
      });
    }
  }

  // Lead volume anomaly
  if (previous.leads?.new > 0) {
    const leadChange = ((current.leads.new - previous.leads.new) / previous.leads.new) * 100;
    if (Math.abs(leadChange) > ANOMALY_THRESHOLDS.leadVolumeChangePercent) {
      anomalies.push({
        type: 'leads',
        severity: leadChange < 0 ? 'high' : 'low',
        message: `Lead volume ${leadChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(leadChange).toFixed(1)}%`,
        current: current.leads.new,
        previous: previous.leads.new,
        changePercent: leadChange,
      });
    }
  }

  // Error rate anomaly
  if (current.agents?.totalRuns > 0) {
    const errorRate = (current.errors.total / current.agents.totalRuns) * 100;
    if (errorRate > ANOMALY_THRESHOLDS.errorRatePercent) {
      anomalies.push({
        type: 'errors',
        severity: 'critical',
        message: `Agent error rate at ${errorRate.toFixed(1)}% (${current.errors.total}/${current.agents.totalRuns})`,
        current: errorRate,
        threshold: ANOMALY_THRESHOLDS.errorRatePercent,
      });
    }
  }

  // Agent failure rate
  if (current.agents?.totalRuns > 0) {
    const failureRate = (current.agents.failed / current.agents.totalRuns) * 100;
    if (failureRate > ANOMALY_THRESHOLDS.agentFailureRate) {
      anomalies.push({
        type: 'agent_failures',
        severity: 'critical',
        message: `Agent failure rate at ${failureRate.toFixed(1)}%`,
        current: failureRate,
        threshold: ANOMALY_THRESHOLDS.agentFailureRate,
      });
    }
  }

  return anomalies;
}

/**
 * Store detected anomalies.
 */
async function storeAnomalies(anomalies) {
  for (const anomaly of anomalies) {
    try {
      await createRecord(TABLES.ANOMALIES, {
        Type: anomaly.type,
        Severity: anomaly.severity,
        Message: anomaly.message,
        CurrentValue: String(anomaly.current),
        PreviousValue: String(anomaly.previous || ''),
        ChangePercent: anomaly.changePercent || null,
        DetectedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Failed to store anomaly: ${error.message}`);
    }
  }

  if (anomalies.some(a => a.severity === 'critical' || a.severity === 'high')) {
    await alertAnomalies(anomalies.filter(a => a.severity === 'critical' || a.severity === 'high'));
  }
}

/**
 * Alert CEO about significant anomalies.
 */
async function alertAnomalies(anomalies) {
  const rows = anomalies.map(a => {
    const severityColors = { critical: '#e74c3c', high: '#e67e22', medium: '#f39c12', low: '#3498db' };
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">
          <span style="color: ${severityColors[a.severity]}; font-weight: bold;">${a.severity.toUpperCase()}</span>
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${a.type}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${a.message}</td>
      </tr>
    `;
  }).join('');

  await sendCEOEmail({
    subject: `ANOMALY ALERT: ${anomalies.length} significant deviation(s) detected`,
    html: `
      <h2 style="color: #e74c3c;">Data Anomaly Alert</h2>
      <p>${anomalies.length} anomaly(ies) detected that exceed normal thresholds:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f5f5f5;">
          <th style="padding: 8px; text-align: left;">Severity</th>
          <th style="padding: 8px; text-align: left;">Type</th>
          <th style="padding: 8px; text-align: left;">Details</th>
        </tr>
        ${rows}
      </table>
    `,
  });
}

// ── Natural Language Query ───────────────────────────────────────────────────

/**
 * Handle a natural language data query from the CEO.
 */
async function handleNaturalLanguageQuery(question) {
  logger.info(`Processing query: "${question}"`);

  try {
    // Gather context data
    const today = new Date().toISOString().slice(0, 10);
    const recentMetrics = await getRecords(TABLES.DAILY_METRICS, '');
    const clients = await getRecords(TABLES.CLIENTS, '{Status} = "Client"');
    const leads = await getRecords(TABLES.LEADS, '');

    const prompt = `You are a data analyst for Werkpilot, a Swiss digital agency.
Answer the following business question using the provided data.

Question: "${question}"

Recent Daily Metrics (last entries):
${JSON.stringify(recentMetrics.slice(-14).map(m => ({
  date: m.Date,
  revenue: m.RevenueTotal,
  leads: m.NewLeads,
  clients: m.ActiveClients,
  mrr: m.TotalMRR,
  agentRuns: m.AgentRuns,
  errors: m.TotalErrors,
})), null, 2)}

Active Clients: ${clients.length}
Total MRR: CHF ${clients.reduce((s, c) => s + (c.MRR || 0), 0)}
Open Leads: ${leads.filter(l => l.Status !== 'Converted' && l.Status !== 'Lost').length}

Answer in a clear, executive-friendly format. Include specific numbers.
If you cannot answer precisely from the data, provide the best estimate and note assumptions.

Return JSON: {
  "answer": "...",
  "dataPoints": [{ "label": "...", "value": "..." }],
  "confidence": "high|medium|low",
  "caveat": "optional note about data limitations"
}`;

    const result = await generateJSON(prompt, {
      model: config.models.standard,
      maxTokens: 1500,
    });

    logger.info(`Query answered with ${result.confidence} confidence`);
    return result;
  } catch (error) {
    logger.error(`Natural language query failed: ${error.message}`);
    throw error;
  }
}

// ── Data Export ──────────────────────────────────────────────────────────────

/**
 * Export data in CSV format.
 */
function exportToCSV(data, fields) {
  if (!data || data.length === 0) return '';

  const headers = fields || Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const value = row[h];
      if (value === null || value === undefined) return '';
      const str = String(value);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export data in JSON format.
 */
function exportToJSON(data, pretty = true) {
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

// ── Data Quality Checks ─────────────────────────────────────────────────────

/**
 * Run data quality checks across all key tables.
 */
async function runDataQualityChecks() {
  logger.info('Running data quality checks...');
  const issues = [];

  try {
    // Check for duplicate emails in Contacts
    const contacts = await getRecords('Contacts', '');
    const emails = {};
    for (const contact of contacts) {
      if (contact.Email) {
        if (emails[contact.Email]) {
          issues.push({
            table: 'Contacts',
            type: 'duplicate',
            field: 'Email',
            value: contact.Email,
            message: `Duplicate email: ${contact.Email}`,
          });
        }
        emails[contact.Email] = true;
      } else {
        issues.push({
          table: 'Contacts',
          type: 'missing',
          field: 'Email',
          recordId: contact.id,
          message: `Contact ${contact.Name || contact.id} missing email`,
        });
      }
    }

    // Check clients for required fields
    const clients = await getRecords(TABLES.CLIENTS, '');
    for (const client of clients) {
      const requiredFields = ['CompanyName', 'ContactEmail', 'Status', 'MRR'];
      for (const field of requiredFields) {
        if (!client[field] && client[field] !== 0) {
          issues.push({
            table: 'Clients',
            type: 'missing',
            field,
            recordId: client.id,
            message: `Client ${client.CompanyName || client.id} missing ${field}`,
          });
        }
      }
    }

    // Check revenue records for valid amounts
    const revenue = await getRecords(TABLES.REVENUE, '');
    for (const record of revenue) {
      if (!record.Amount || record.Amount <= 0) {
        issues.push({
          table: 'Revenue',
          type: 'invalid',
          field: 'Amount',
          recordId: record.id,
          message: `Invalid revenue amount: ${record.Amount}`,
        });
      }
      if (!record.Date) {
        issues.push({
          table: 'Revenue',
          type: 'missing',
          field: 'Date',
          recordId: record.id,
          message: 'Revenue record missing date',
        });
      }
    }

    // Store quality report
    await createRecord(TABLES.DATA_QUALITY, {
      CheckDate: new Date().toISOString().slice(0, 10),
      TotalIssues: issues.length,
      Duplicates: issues.filter(i => i.type === 'duplicate').length,
      MissingFields: issues.filter(i => i.type === 'missing').length,
      InvalidData: issues.filter(i => i.type === 'invalid').length,
      IssuesJSON: JSON.stringify(issues.slice(0, 50)),
      CheckedAt: new Date().toISOString(),
    });

    logger.info(`Data quality check: ${issues.length} issues found`);
    return issues;
  } catch (error) {
    logger.error(`Data quality check failed: ${error.message}`);
    throw error;
  }
}

// ── Helper Functions ─────────────────────────────────────────────────────────

async function getDailyMetrics(date) {
  try {
    const records = await getRecords(TABLES.DAILY_METRICS, `{Date} = "${date}"`);
    if (records.length > 0 && records[0].MetricsJSON) {
      return JSON.parse(records[0].MetricsJSON);
    }
    return null;
  } catch (error) {
    logger.error(`Failed to get daily metrics for ${date}: ${error.message}`);
    return null;
  }
}

async function getMetricsRange(startDate, endDate) {
  try {
    const start = startDate.toISOString().slice(0, 10);
    const end = endDate.toISOString().slice(0, 10);
    const records = await getRecords(
      TABLES.DAILY_METRICS,
      `AND({Date} >= "${start}", {Date} <= "${end}")`
    );
    return records.map(r => r.MetricsJSON ? JSON.parse(r.MetricsJSON) : r);
  } catch (error) {
    logger.error(`Failed to get metrics range: ${error.message}`);
    return [];
  }
}

function aggregateMetricsRange(metricsArray) {
  const totals = {
    revenue: 0,
    leads: 0,
    qualifiedLeads: 0,
    convertedLeads: 0,
    newClients: 0,
    activeClients: 0,
    totalMRR: 0,
    agentRuns: 0,
    agentCompleted: 0,
    agentFailed: 0,
    errors: 0,
    days: metricsArray.length,
  };

  for (const day of metricsArray) {
    totals.revenue += day.revenue?.total || day.RevenueTotal || 0;
    totals.leads += day.leads?.new || day.NewLeads || 0;
    totals.qualifiedLeads += day.leads?.qualified || day.QualifiedLeads || 0;
    totals.convertedLeads += day.leads?.converted || day.ConvertedLeads || 0;
    totals.newClients += day.clients?.new || 0;
    totals.agentRuns += day.agents?.totalRuns || day.AgentRuns || 0;
    totals.agentCompleted += day.agents?.completed || day.AgentCompleted || 0;
    totals.agentFailed += day.agents?.failed || day.AgentFailed || 0;
    totals.errors += day.errors?.total || day.TotalErrors || 0;

    // Use latest values for point-in-time metrics
    totals.activeClients = day.clients?.active || day.ActiveClients || totals.activeClients;
    totals.totalMRR = day.clients?.totalMRR || day.TotalMRR || totals.totalMRR;
  }

  return totals;
}

function calculateChanges(current, previous) {
  if (!current || !previous) return {};
  return {
    revenue: calculatePercent(current.revenue?.total, previous.revenue?.total),
    leads: calculatePercent(current.leads?.new, previous.leads?.new),
    clients: calculatePercent(current.clients?.active, previous.clients?.active),
    errors: calculatePercent(current.errors?.total, previous.errors?.total),
  };
}

function calculateGrowth(current, previous) {
  return {
    revenueGrowth: calculatePercent(current.revenue, previous.revenue),
    leadGrowth: calculatePercent(current.leads, previous.leads),
    clientGrowth: calculatePercent(current.activeClients, previous.activeClients),
    agentSuccessRate: current.agentRuns > 0
      ? ((current.agentCompleted / current.agentRuns) * 100).toFixed(1)
      : 'N/A',
  };
}

function calculatePercent(current, previous) {
  if (!previous || previous === 0) return current > 0 ? '+100' : '0';
  return (((current - previous) / previous) * 100).toFixed(1);
}

// ── HTML Report Builders ─────────────────────────────────────────────────────

function buildDailyReportHTML(metrics, changes, anomalies) {
  const anomalySection = anomalies.length > 0
    ? `<h3 style="color: #e74c3c;">Anomalies Detected</h3>
       <ul>${anomalies.map(a => `<li><strong>${a.severity.toUpperCase()}</strong>: ${a.message}</li>`).join('')}</ul>`
    : '';

  return `
    <h2>Daily Business Report</h2>
    <p>Date: ${metrics?.date || new Date().toISOString().slice(0, 10)}</p>

    <div style="display: flex; gap: 15px; margin: 20px 0; flex-wrap: wrap;">
      <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; flex: 1; min-width: 150px;">
        <strong>Revenue</strong><br>CHF ${metrics?.revenue?.total || 0}
        <br><small style="color: ${parseFloat(changes?.revenue) >= 0 ? '#27ae60' : '#e74c3c'};">${changes?.revenue || 0}% vs yesterday</small>
      </div>
      <div style="background: #f0fff0; padding: 15px; border-radius: 8px; flex: 1; min-width: 150px;">
        <strong>New Leads</strong><br>${metrics?.leads?.new || 0}
        <br><small style="color: ${parseFloat(changes?.leads) >= 0 ? '#27ae60' : '#e74c3c'};">${changes?.leads || 0}% vs yesterday</small>
      </div>
      <div style="background: #fff8f0; padding: 15px; border-radius: 8px; flex: 1; min-width: 150px;">
        <strong>Active Clients</strong><br>${metrics?.clients?.active || 0}
        <br><small>MRR: CHF ${metrics?.clients?.totalMRR || 0}</small>
      </div>
      <div style="background: #f8f0ff; padding: 15px; border-radius: 8px; flex: 1; min-width: 150px;">
        <strong>Agent Runs</strong><br>${metrics?.agents?.totalRuns || 0}
        <br><small>${metrics?.agents?.failed || 0} failed</small>
      </div>
    </div>
    ${anomalySection}
  `;
}

function buildWeeklyReportHTML(report) {
  const { totals, growth, analysis } = report;
  return `
    <h2>Weekly Business Report</h2>
    <p>Period: ${report.period}</p>

    <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">Executive Summary</h3>
      <p>${analysis?.summary || 'No summary available'}</p>
    </div>

    <h3>Key Metrics</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px;"><strong>Revenue</strong></td><td>CHF ${totals.revenue} (${growth.revenueGrowth}%)</td></tr>
      <tr><td style="padding: 8px;"><strong>New Leads</strong></td><td>${totals.leads} (${growth.leadGrowth}%)</td></tr>
      <tr><td style="padding: 8px;"><strong>Active Clients</strong></td><td>${totals.activeClients}</td></tr>
      <tr><td style="padding: 8px;"><strong>Total MRR</strong></td><td>CHF ${totals.totalMRR}</td></tr>
      <tr><td style="padding: 8px;"><strong>Agent Success Rate</strong></td><td>${growth.agentSuccessRate}%</td></tr>
    </table>

    ${analysis?.highlights ? `<h3>Highlights</h3><ul>${analysis.highlights.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}
    ${analysis?.concerns ? `<h3>Concerns</h3><ul>${analysis.concerns.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
    ${analysis?.recommendations ? `<h3>Recommendations</h3><ul>${analysis.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
  `;
}

function buildMonthlyReportHTML(report) {
  const { totals, analysis } = report;
  return `
    <h2>Monthly Business Report - ${report.period}</h2>

    <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">Executive Summary</h3>
      <p>${analysis?.executiveSummary || 'No summary available'}</p>
    </div>

    ${analysis?.pnl ? `
    <h3>P&L Summary</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px;"><strong>Revenue</strong></td><td>CHF ${analysis.pnl.revenue}</td></tr>
      <tr><td style="padding: 8px;"><strong>Estimated Costs</strong></td><td>CHF ${analysis.pnl.estimatedCosts}</td></tr>
      <tr><td style="padding: 8px;"><strong>Gross Margin</strong></td><td>CHF ${analysis.pnl.grossMargin}</td></tr>
      <tr><td style="padding: 8px;"><strong>Net Margin</strong></td><td>${analysis.pnl.netMarginPercent}%</td></tr>
    </table>` : ''}

    ${analysis?.forecast ? `
    <h3>3-Month Forecast (${analysis.forecast.confidence} confidence)</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px;"><strong>Month +1</strong></td><td>CHF ${analysis.forecast.month1}</td></tr>
      <tr><td style="padding: 8px;"><strong>Month +2</strong></td><td>CHF ${analysis.forecast.month2}</td></tr>
      <tr><td style="padding: 8px;"><strong>Month +3</strong></td><td>CHF ${analysis.forecast.month3}</td></tr>
    </table>` : ''}

    ${analysis?.recommendations ? `
    <h3>Recommendations</h3>
    <ul>${analysis.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
  `;
}

// ── Express API Server ───────────────────────────────────────────────────────

let apiServer = null;

/**
 * Start the Express dashboard API server on port 3002.
 */
function startAPIServer() {
  try {
    const express = require('express');
    const app = express();
    app.use(express.json());

    // CORS for dashboard
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // Load route handlers
    const routes = require('./api/routes');
    routes.register(app, {
      aggregateDailyMetrics,
      generateDailyReport,
      generateWeeklyReport,
      generateMonthlyReport,
      handleNaturalLanguageQuery,
      exportToCSV,
      exportToJSON,
      getDailyMetrics,
      getMetricsRange,
      aggregateMetricsRange,
      runDataQualityChecks,
    });

    apiServer = app.listen(API_PORT, () => {
      logger.info(`Dashboard API running on port ${API_PORT}`);
    });

    apiServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.warn(`Port ${API_PORT} already in use, skipping API server start`);
      } else {
        logger.error(`API server error: ${error.message}`);
      }
    });

    return apiServer;
  } catch (error) {
    logger.error(`Failed to start API server: ${error.message}`);
    return null;
  }
}

/**
 * Stop the API server gracefully.
 */
function stopAPIServer() {
  if (apiServer) {
    apiServer.close(() => {
      logger.info('Dashboard API server stopped');
    });
  }
}

// ── Main Runs ────────────────────────────────────────────────────────────────

/**
 * Daily metrics aggregation and report.
 */
async function runDailyMetrics() {
  logger.info('=== Data Analytics Daily Run ===');
  const startTime = Date.now();

  try {
    await aggregateDailyMetrics();
    await generateDailyReport();
    await runDataQualityChecks();
  } catch (error) {
    logger.error(`Daily metrics run failed: ${error.message}`, { stack: error.stack });
    await sendCEOEmail({
      subject: 'Data Analytics Agent: Daily Run Error',
      html: `<p>Daily metrics aggregation encountered an error:</p><pre>${error.message}</pre>`,
    });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Daily run completed in ${duration}s ===`);
}

/**
 * Weekly report generation.
 */
async function runWeeklyReport() {
  logger.info('=== Data Analytics Weekly Report ===');
  const startTime = Date.now();

  try {
    await generateWeeklyReport();
  } catch (error) {
    logger.error(`Weekly report failed: ${error.message}`, { stack: error.stack });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Weekly report completed in ${duration}s ===`);
}

/**
 * Monthly comprehensive report.
 */
async function runMonthlyReport() {
  logger.info('=== Data Analytics Monthly Report ===');
  const startTime = Date.now();

  try {
    await generateMonthlyReport();
  } catch (error) {
    logger.error(`Monthly report failed: ${error.message}`, { stack: error.stack });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Monthly report completed in ${duration}s ===`);
}

// ── Cron Scheduling ──────────────────────────────────────────────────────────

// Daily metrics aggregation and report at 06:00
cron.schedule('0 6 * * *', () => {
  runDailyMetrics().catch(err => logger.error(`Cron daily error: ${err.message}`));
});

// Weekly report on Monday at 05:00
cron.schedule('0 5 * * 1', () => {
  runWeeklyReport().catch(err => logger.error(`Cron weekly error: ${err.message}`));
});

// Monthly report on 1st at 04:00
cron.schedule('0 4 1 * *', () => {
  runMonthlyReport().catch(err => logger.error(`Cron monthly error: ${err.message}`));
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runDailyMetrics,
  runWeeklyReport,
  runMonthlyReport,
  aggregateDailyMetrics,
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  handleNaturalLanguageQuery,
  detectAnomalies,
  runDataQualityChecks,
  exportToCSV,
  exportToJSON,
  startAPIServer,
  stopAPIServer,
};

// Start API server and run if executed directly
if (require.main === module) {
  startAPIServer();
  runDailyMetrics()
    .then(() => logger.info('Manual daily run completed'))
    .catch(err => logger.error(`Manual run failed: ${err.message}`));
}
