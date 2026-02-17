/**
 * Agent 21 — Capacity Planning Agent
 * Department: Operations
 *
 * Tracks API usage across all agents, predicts costs, monitors rate limits,
 * suggests optimizations, manages API key rotation, and provides cost breakdowns.
 *
 * APIs tracked: Claude (Haiku/Sonnet/Opus), DeepL, MailerLite, Airtable, OpenAI
 *
 * Schedule: Hourly usage check, daily cost report, weekly optimization review
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../shared/utils/logger');
const { generateJSON } = require('../shared/utils/claude-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const config = require('../shared/utils/config');
const usageTracker = require('./api-usage-tracker');

const log = createLogger('capacity-planning');

// --- Budget Configuration ---

const BUDGET_CONFIG_PATH = path.join(__dirname, 'budget-config.json');
let budgetConfig = {};

function loadBudgetConfig() {
  try {
    budgetConfig = JSON.parse(fs.readFileSync(BUDGET_CONFIG_PATH, 'utf8'));
    log.info(`Budget config loaded: total monthly budget $${budgetConfig.totalMonthlyBudget}`);
  } catch (err) {
    log.error(`Failed to load budget config: ${err.message}`);
    budgetConfig = { apis: {}, totalMonthlyBudget: 500 };
  }
}

// --- Usage Tracking Across Agents ---

/**
 * Collect usage data from all running agents
 */
async function collectUsageData() {
  log.info('Collecting API usage data...');

  try {
    const records = await getRecords('APIUsage', `{Date} = '${new Date().toISOString().split('T')[0]}'`);

    const usage = {
      date: new Date().toISOString().split('T')[0],
      byApi: {},
      byAgent: {},
      byModel: {},
      totalCost: 0,
      totalCalls: 0,
    };

    for (const record of records) {
      const api = record.API || 'unknown';
      const agent = record.Agent || 'unknown';
      const model = record.Model || 'default';
      const cost = record.Cost || 0;
      const calls = 1;

      // By API
      if (!usage.byApi[api]) usage.byApi[api] = { calls: 0, cost: 0, tokens: 0 };
      usage.byApi[api].calls += calls;
      usage.byApi[api].cost += cost;
      usage.byApi[api].tokens += (record.InputTokens || 0) + (record.OutputTokens || 0);

      // By Agent
      if (!usage.byAgent[agent]) usage.byAgent[agent] = { calls: 0, cost: 0, apis: {} };
      usage.byAgent[agent].calls += calls;
      usage.byAgent[agent].cost += cost;
      if (!usage.byAgent[agent].apis[api]) usage.byAgent[agent].apis[api] = 0;
      usage.byAgent[agent].apis[api] += calls;

      // By Model
      if (model !== 'default') {
        if (!usage.byModel[model]) usage.byModel[model] = { calls: 0, cost: 0, tokens: 0 };
        usage.byModel[model].calls += calls;
        usage.byModel[model].cost += cost;
        usage.byModel[model].tokens += (record.InputTokens || 0) + (record.OutputTokens || 0);
      }

      usage.totalCost += cost;
      usage.totalCalls += calls;
    }

    return usage;
  } catch (err) {
    log.error(`Failed to collect usage data: ${err.message}`);
    return usageTracker.getStats();
  }
}

// --- Budget Monitoring ---

/**
 * Check current spending against budget limits
 */
async function checkBudgets() {
  log.info('Checking budget limits...');

  const costData = usageTracker.getTotalCost(30);
  const alerts = [];

  for (const [api, apiConfig] of Object.entries(budgetConfig.apis || {})) {
    const spent = costData.breakdown[api] || 0;
    const budget = apiConfig.monthlyBudget || 0;

    if (budget <= 0) continue;

    const usagePercent = (spent / budget) * 100;

    if (usagePercent >= (apiConfig.criticalThreshold || 0.95) * 100) {
      alerts.push({
        api,
        severity: 'critical',
        message: `${api} at ${usagePercent.toFixed(1)}% of monthly budget ($${spent.toFixed(2)}/$${budget})`,
        spent,
        budget,
        usagePercent,
      });
    } else if (usagePercent >= (apiConfig.warningThreshold || 0.8) * 100) {
      alerts.push({
        api,
        severity: 'warning',
        message: `${api} at ${usagePercent.toFixed(1)}% of monthly budget ($${spent.toFixed(2)}/$${budget})`,
        spent,
        budget,
        usagePercent,
      });
    }
  }

  // Total budget check
  const totalSpent = costData.totalCost;
  const totalBudget = budgetConfig.totalMonthlyBudget || 500;
  const totalPercent = (totalSpent / totalBudget) * 100;

  if (totalPercent >= 95) {
    alerts.push({
      api: 'TOTAL',
      severity: 'critical',
      message: `Total API spend at ${totalPercent.toFixed(1)}% of budget ($${totalSpent.toFixed(2)}/$${totalBudget})`,
      spent: totalSpent,
      budget: totalBudget,
      usagePercent: totalPercent,
    });
  } else if (totalPercent >= 80) {
    alerts.push({
      api: 'TOTAL',
      severity: 'warning',
      message: `Total API spend at ${totalPercent.toFixed(1)}% of budget ($${totalSpent.toFixed(2)}/$${totalBudget})`,
      spent: totalSpent,
      budget: totalBudget,
      usagePercent: totalPercent,
    });
  }

  if (alerts.length > 0) {
    log.warn(`Budget alerts: ${alerts.length} (${alerts.filter(a => a.severity === 'critical').length} critical)`);

    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      try {
        await sendCEOEmail({
          subject: `Budget Alert: ${criticalAlerts.length} critical threshold(s) exceeded`,
          html: `
            <h2>API Budget Alert</h2>
            <table border="1" cellpadding="8" cellspacing="0">
              <tr><th>API</th><th>Severity</th><th>Spent</th><th>Budget</th><th>Usage</th></tr>
              ${alerts.map(a => `
                <tr style="background: ${a.severity === 'critical' ? '#ffcccc' : '#fff3cd'}">
                  <td>${a.api}</td>
                  <td>${a.severity.toUpperCase()}</td>
                  <td>$${a.spent.toFixed(2)}</td>
                  <td>$${a.budget.toFixed(2)}</td>
                  <td>${a.usagePercent.toFixed(1)}%</td>
                </tr>
              `).join('')}
            </table>
          `,
        });
      } catch (err) {
        log.error(`Failed to send budget alert: ${err.message}`);
      }
    }
  }

  return { alerts, totalSpent, totalBudget, totalPercent };
}

// --- Rate Limit Monitoring ---

/**
 * Check rate limit status across all APIs
 */
function checkRateLimits() {
  const issues = [];

  for (const api of ['claude', 'deepl', 'mailerlite', 'airtable']) {
    if (usageTracker.isNearRateLimit(api, 80)) {
      const info = usageTracker.getRateLimit(api);
      issues.push({
        api,
        severity: info.usagePercent >= 95 ? 'critical' : 'warning',
        remaining: info.remaining,
        limit: info.limit,
        usagePercent: info.usagePercent,
        resetsAt: info.resetsAt,
      });
    }
  }

  if (issues.length > 0) {
    log.warn(`Rate limit issues: ${JSON.stringify(issues)}`);
  }

  return issues;
}

// --- Cost Prediction ---

/**
 * Predict next month's costs based on current trends
 */
async function predictCosts() {
  log.info('Predicting next month costs...');

  const prediction = usageTracker.predictMonthlyCost();
  const budget = budgetConfig.totalMonthlyBudget || 500;

  const analysis = {
    ...prediction,
    budget,
    projectedOverBudget: prediction.nextMonth.predictedCost > budget,
    recommendations: [],
  };

  // Generate AI-powered recommendations if over budget
  if (analysis.projectedOverBudget || prediction.nextMonth.growthRate > 20) {
    try {
      const recommendations = await generateJSON(
        `Analyze these API cost projections and provide optimization recommendations:

Current month spending: $${prediction.currentMonth.projectedCost}
Predicted next month: $${prediction.nextMonth.predictedCost}
Monthly budget: $${budget}
Growth rate: ${prediction.nextMonth.growthRate}%

Provide 3-5 specific, actionable recommendations in JSON format:
[{ "priority": "high"|"medium"|"low", "action": "...", "estimatedSavings": "$XX", "effort": "low"|"medium"|"high" }]`,
        { model: config.models.fast, maxTokens: 500 }
      );
      analysis.recommendations = recommendations;
    } catch (err) {
      log.warn(`Failed to generate cost recommendations: ${err.message}`);
    }
  }

  return analysis;
}

// --- Optimization Suggestions ---

/**
 * Suggest cheaper models for simple tasks
 */
async function generateOptimizationSuggestions() {
  log.info('Analyzing model usage for optimization opportunities...');

  const suggestions = [];
  const rules = (budgetConfig.costOptimization || {}).downgradeRules || [];

  try {
    const records = await getRecords('APIUsage', `{API} = 'claude'`, 500);

    // Group by agent and action
    const actionUsage = {};
    for (const record of records) {
      const key = `${record.Agent}:${record.Action}`;
      if (!actionUsage[key]) {
        actionUsage[key] = { agent: record.Agent, action: record.Action, models: {}, totalCost: 0, count: 0 };
      }
      const model = record.Model || 'unknown';
      if (!actionUsage[key].models[model]) actionUsage[key].models[model] = { count: 0, cost: 0 };
      actionUsage[key].models[model].count++;
      actionUsage[key].models[model].cost += record.Cost || 0;
      actionUsage[key].totalCost += record.Cost || 0;
      actionUsage[key].count++;
    }

    // Check each action against downgrade rules
    for (const [key, usage] of Object.entries(actionUsage)) {
      const expensiveModels = Object.entries(usage.models)
        .filter(([model]) => model.includes('opus') || model.includes('sonnet'))
        .sort((a, b) => b[1].cost - a[1].cost);

      if (expensiveModels.length === 0) continue;

      // Check if any downgrade rules apply
      for (const rule of rules) {
        const actions = rule.condition.match(/action in \[([^\]]+)\]/);
        if (actions) {
          const actionList = actions[1].replace(/'/g, '').split(',').map(a => a.trim());
          if (actionList.some(a => usage.action.toLowerCase().includes(a.toLowerCase()))) {
            const currentModel = expensiveModels[0][0];
            const recommended = rule.recommendedModel;

            if (currentModel !== recommended) {
              const currentPricing = usageTracker.API_PRICING[currentModel] || {};
              const recommendedPricing = usageTracker.API_PRICING[recommended] || {};

              // Estimate savings
              const costRatio = (recommendedPricing.inputPer1kTokens || 0.001) / (currentPricing.inputPer1kTokens || 0.015);
              const estimatedSavings = usage.totalCost * (1 - costRatio);

              suggestions.push({
                agent: usage.agent,
                action: usage.action,
                currentModel,
                recommendedModel: recommended,
                reason: rule.description,
                monthlyCallCount: usage.count,
                currentMonthlyCost: usage.totalCost.toFixed(2),
                estimatedMonthlySavings: estimatedSavings.toFixed(2),
              });
            }
          }
        }
      }
    }

    log.info(`Generated ${suggestions.length} optimization suggestions`);
  } catch (err) {
    log.error(`Failed to generate optimization suggestions: ${err.message}`);
  }

  return suggestions;
}

// --- Peak Detection ---

/**
 * Detect peak usage hours and suggest scheduling optimizations
 */
function detectPeakHours() {
  const hourlyUsage = {};

  // Analyze usage buffer by hour
  const today = new Date().toISOString().split('T')[0];
  const usage = usageTracker.getDailyUsage(today);

  // Aggregate by hour (from timestamps in the tracker)
  for (let h = 0; h < 24; h++) {
    hourlyUsage[h] = { calls: 0, cost: 0 };
  }

  // Use available data to estimate peak patterns
  const peakConfig = (budgetConfig.costOptimization || {}).peakHours || {};

  return {
    peakHours: peakConfig.peakStart && peakConfig.peakEnd
      ? { start: peakConfig.peakStart, end: peakConfig.peakEnd, timezone: peakConfig.timezone }
      : { start: '09:00', end: '12:00', timezone: 'Europe/Zurich' },
    deferrableAgents: peakConfig.deferrable || [],
    recommendation: 'Schedule non-critical tasks outside peak hours (09:00-12:00 CET) to reduce concurrent API load',
  };
}

// --- API Key Rotation ---

/**
 * Check API key health and rotation needs
 */
function checkApiKeyHealth() {
  const keys = {
    anthropic: {
      configured: !!config.api.anthropic,
      lastChars: config.api.anthropic ? `...${config.api.anthropic.slice(-4)}` : 'NOT SET',
    },
    deepl: {
      configured: !!config.api.deepl,
      lastChars: config.api.deepl ? `...${config.api.deepl.slice(-4)}` : 'NOT SET',
    },
    airtable: {
      configured: !!config.api.airtable,
      lastChars: config.api.airtable ? `...${config.api.airtable.slice(-4)}` : 'NOT SET',
    },
    mailerlite: {
      configured: !!config.api.mailerlite,
      lastChars: config.api.mailerlite ? `...${config.api.mailerlite.slice(-4)}` : 'NOT SET',
    },
    openai: {
      configured: !!config.api.openai,
      lastChars: config.api.openai ? `...${config.api.openai.slice(-4)}` : 'NOT SET',
    },
  };

  const issues = [];
  for (const [name, info] of Object.entries(keys)) {
    if (!info.configured) {
      issues.push({ api: name, issue: 'API key not configured' });
    }
  }

  return { keys, issues };
}

// --- Daily Cost Breakdown ---

async function generateDailyCostBreakdown() {
  const usage = await collectUsageData();
  const budgetCheck = await checkBudgets();

  return {
    date: new Date().toISOString().split('T')[0],
    totalCost: usage.totalCost,
    totalCalls: usage.totalCalls,
    byApi: usage.byApi,
    byAgent: usage.byAgent,
    byModel: usage.byModel,
    budgetStatus: {
      spent: budgetCheck.totalSpent,
      budget: budgetCheck.totalBudget,
      percentUsed: budgetCheck.totalPercent,
      alerts: budgetCheck.alerts,
    },
  };
}

// --- Weekly Cost Report ---

async function generateWeeklyCostReport() {
  log.info('Generating weekly cost report...');

  const costData = usageTracker.getTotalCost(7);
  const prediction = await predictCosts();
  const optimizations = await generateOptimizationSuggestions();
  const peaks = detectPeakHours();
  const keyHealth = checkApiKeyHealth();

  const reportHtml = `
    <h2>Capacity Planning - Weekly Report</h2>
    <p>Period: ${costData.periodStart} to ${costData.periodEnd}</p>

    <h3>Cost Summary (7 days)</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr><td><strong>Total Cost</strong></td><td>$${costData.totalCost.toFixed(2)}</td></tr>
      ${Object.entries(costData.breakdown).map(([api, cost]) =>
        `<tr><td>${api}</td><td>$${cost.toFixed(2)}</td></tr>`
      ).join('')}
    </table>

    <h3>Cost Prediction</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr><td><strong>Current Month (Projected)</strong></td><td>$${prediction.currentMonth.projectedCost}</td></tr>
      <tr><td><strong>Next Month (Predicted)</strong></td><td>$${prediction.nextMonth.predictedCost}</td></tr>
      <tr><td><strong>Growth Rate</strong></td><td>${prediction.nextMonth.growthRate}%</td></tr>
      <tr><td><strong>Monthly Budget</strong></td><td>$${prediction.budget}</td></tr>
      <tr><td><strong>Status</strong></td><td>${prediction.projectedOverBudget ? 'OVER BUDGET' : 'Within Budget'}</td></tr>
    </table>

    ${optimizations.length > 0 ? `
    <h3>Optimization Suggestions</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr><th>Agent</th><th>Action</th><th>Current</th><th>Recommended</th><th>Monthly Savings</th></tr>
      ${optimizations.slice(0, 10).map(o => `
        <tr>
          <td>${o.agent}</td>
          <td>${o.action}</td>
          <td>${o.currentModel}</td>
          <td>${o.recommendedModel}</td>
          <td>$${o.estimatedMonthlySavings}</td>
        </tr>
      `).join('')}
    </table>
    ` : ''}

    <h3>API Key Health</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      ${Object.entries(keyHealth.keys).map(([name, info]) => `
        <tr>
          <td>${name}</td>
          <td>${info.configured ? 'OK' : 'NOT CONFIGURED'}</td>
          <td>${info.lastChars}</td>
        </tr>
      `).join('')}
    </table>

    <h3>Peak Usage</h3>
    <p>${peaks.recommendation}</p>
  `;

  return { costData, prediction, optimizations, peaks, keyHealth, reportHtml };
}

// --- Monthly Cost Report ---

async function generateMonthlyCostReport() {
  log.info('Generating monthly cost report...');

  const costData = usageTracker.getTotalCost(30);
  const prediction = await predictCosts();

  return {
    period: '30 days',
    ...costData,
    prediction,
    budget: budgetConfig.totalMonthlyBudget,
    budgetRemaining: budgetConfig.totalMonthlyBudget - costData.totalCost,
  };
}

// --- Main Run ---

async function run() {
  log.info('Capacity Planning Agent starting...');
  loadBudgetConfig();

  const [usage, budgets, rateLimits, prediction] = await Promise.all([
    collectUsageData(),
    checkBudgets(),
    Promise.resolve(checkRateLimits()),
    predictCosts(),
  ]);

  const result = {
    dailyUsage: usage,
    budgetAlerts: budgets.alerts.length,
    rateLimitIssues: rateLimits.length,
    predictedNextMonth: prediction.nextMonth.predictedCost,
    overBudget: prediction.projectedOverBudget,
    timestamp: new Date().toISOString(),
  };

  log.info(`Capacity Planning run complete: ${JSON.stringify(result)}`);
  return result;
}

// --- Cron Scheduling ---

function startSchedule() {
  loadBudgetConfig();

  // Hourly usage check and budget monitoring
  cron.schedule('0 * * * *', async () => {
    try {
      await collectUsageData();
      await checkBudgets();
      checkRateLimits();
    } catch (err) {
      log.error(`Hourly check failed: ${err.message}`);
    }
  });

  // Flush usage buffer to Airtable every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await usageTracker.flushToAirtable();
    } catch (err) {
      log.error(`Usage flush failed: ${err.message}`);
    }
  });

  // Daily cost report at 21:00
  cron.schedule('0 21 * * *', async () => {
    try {
      const breakdown = await generateDailyCostBreakdown();
      await sendCEOEmail({
        subject: `API Costs: $${breakdown.totalCost.toFixed(2)} today`,
        html: `
          <h2>Daily API Cost Report</h2>
          <p>Date: ${breakdown.date}</p>
          <p>Total: $${breakdown.totalCost.toFixed(2)} | Calls: ${breakdown.totalCalls}</p>
          <p>Budget: $${breakdown.budgetStatus.spent.toFixed(2)}/$${breakdown.budgetStatus.budget} (${breakdown.budgetStatus.percentUsed.toFixed(1)}%)</p>
        `,
      });
    } catch (err) {
      log.error(`Daily cost report failed: ${err.message}`);
    }
  });

  // Weekly report on Monday at 07:00
  cron.schedule('0 7 * * 1', async () => {
    try {
      const report = await generateWeeklyCostReport();
      await sendCEOEmail({
        subject: 'Capacity Planning - Weekly Report',
        html: report.reportHtml,
      });
    } catch (err) {
      log.error(`Weekly report failed: ${err.message}`);
    }
  });

  // Monthly report on 1st at 08:00
  cron.schedule('0 8 1 * *', async () => {
    try {
      const report = await generateMonthlyCostReport();
      await sendCEOEmail({
        subject: `Monthly API Costs: $${report.totalCost.toFixed(2)}`,
        html: `
          <h2>Monthly Capacity Report</h2>
          <p>Total Cost: $${report.totalCost.toFixed(2)}</p>
          <p>Budget: $${report.budget} | Remaining: $${report.budgetRemaining.toFixed(2)}</p>
          <p>Next Month Prediction: $${report.prediction.nextMonth.predictedCost}</p>
        `,
      });
    } catch (err) {
      log.error(`Monthly report failed: ${err.message}`);
    }
  });

  // Reset daily counters at midnight
  cron.schedule('0 0 * * *', () => {
    usageTracker.resetDaily();
  });

  log.info('Capacity Planning scheduled: hourly checks, daily/weekly/monthly reports');
}

// --- Exports ---

module.exports = {
  run,
  startSchedule,
  collectUsageData,
  checkBudgets,
  checkRateLimits,
  predictCosts,
  generateOptimizationSuggestions,
  detectPeakHours,
  checkApiKeyHealth,
  generateDailyCostBreakdown,
  generateWeeklyCostReport,
  generateMonthlyCostReport,
  loadBudgetConfig,
};

// Run if called directly
if (require.main === module) {
  run().then(result => {
    log.info(`Capacity Planning finished: ${JSON.stringify(result)}`);
    process.exit(0);
  }).catch(err => {
    log.error(`Capacity Planning failed: ${err.message}`);
    process.exit(1);
  });
}
