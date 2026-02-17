/**
 * Agent 25 — FP&A Agent (Financial Planning & Analysis)
 * Werkpilot Finance Department
 *
 * Revenue forecasting, cash flow projections, scenario modeling,
 * growth metrics, cohort analysis, and board-ready dashboards.
 *
 * Schedule: Weekly on Monday at 05:00 (full forecast), daily at 06:30 (metrics update)
 */

'use strict';

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const {
  calculateMRR,
  calculateGrowthRate,
  calculateNRR,
  forecastFromPipeline,
  projectRevenue,
  scenarioModeling,
  cohortAnalysis,
  growthMetricsSummary,
  predictWithLinearRegression,
  calculateForecastAccuracy,
} = require('./forecast-models/revenue-forecast');

const {
  calculateCashPosition,
  projectCashFlow,
  cashFlowSummary,
  calculateBurnRate,
  calculateRunway,
  categorizeExpenses,
  cashFlowToMarkdown,
} = require('./forecast-models/cashflow-model');

const logger = createLogger('finance-fpa');
const REPORTS_DIR = path.join(__dirname, 'reports');

// ---------------------------------------------------------------------------
// Data Collection
// ---------------------------------------------------------------------------

async function fetchSubscriptions() {
  try {
    const subs = await getRecords('Subscriptions', '{Status} = "Active"');
    logger.info(`Fetched ${subs.length} active subscriptions`);
    return subs;
  } catch (error) {
    logger.error(`Failed to fetch subscriptions: ${error.message}`);
    return [];
  }
}

async function fetchPipeline() {
  try {
    const deals = await getRecords('Pipeline', 'NOT({Stage} = "Closed Lost")');
    logger.info(`Fetched ${deals.length} pipeline deals`);
    return deals.map(d => ({
      name: d.Name || d.Company,
      amount: d.Amount || d.Value || 0,
      stage: d.Stage || 'lead',
      expectedCloseDate: d.ExpectedClose || d.CloseDate,
      probability: d.Probability,
    }));
  } catch (error) {
    logger.error(`Failed to fetch pipeline: ${error.message}`);
    return [];
  }
}

async function fetchCustomers() {
  try {
    const customers = await getRecords('Clients', '');
    return customers.map(c => ({
      id: c.id,
      name: c.Name || c.Company,
      signupDate: c.SignupDate || c.CreatedAt,
      status: (c.Status || '').toLowerCase(),
      mrr: c.MRR || c.MonthlyRevenue || 0,
      initialMRR: c.InitialMRR || c.MRR || 0,
      plan: c.Plan || 'standard',
      industry: c.Industry,
    }));
  } catch (error) {
    logger.error(`Failed to fetch customers: ${error.message}`);
    return [];
  }
}

async function fetchMRRHistory() {
  try {
    const history = await getRecords('MRR_History', '', 100);
    return history.sort((a, b) => (a.Period || '').localeCompare(b.Period || ''));
  } catch (error) {
    logger.error(`Failed to fetch MRR history: ${error.message}`);
    return [];
  }
}

async function fetchFinancialData() {
  try {
    const [bankBalance, receivables, payables, pendingInvoices, upcomingExpenses, monthlyExpenses, monthlyRevenue, recurringItems] = await Promise.all([
      getRecords('BankAccounts', '').then(r => r.reduce((sum, a) => sum + (a.Balance || 0), 0)).catch(() => 0),
      getRecords('Invoices', '{Status} = "Sent"').then(r => r.reduce((sum, i) => sum + (i.Amount || 0), 0)).catch(() => 0),
      getRecords('Bills', '{Status} = "Unpaid"').then(r => r.reduce((sum, b) => sum + (b.Amount || 0), 0)).catch(() => 0),
      getRecords('Invoices', '{Status} = "Sent"').catch(() => []),
      getRecords('Bills', '{Status} = "Unpaid"').catch(() => []),
      getRecords('Expenses', `DATETIME_FORMAT({Date}, 'YYYY-MM') = "${new Date().toISOString().substring(0, 7)}"`).catch(() => []),
      getRecords('Invoices', `AND({Status} = "Paid", DATETIME_FORMAT({Date}, 'YYYY-MM') = "${new Date().toISOString().substring(0, 7)}")`).catch(() => []),
      getRecords('RecurringItems', '{Active} = TRUE()').catch(() => []),
    ]);

    return {
      bankBalance,
      receivables,
      payables,
      pendingInvoices: pendingInvoices.map(i => ({
        amount: i.Amount || 0,
        expectedDate: i.DueDate || i.ExpectedPayment,
        client: i.Client,
      })),
      upcomingExpenses: upcomingExpenses.map(e => ({
        amount: e.Amount || 0,
        dueDate: e.DueDate,
        description: e.Description,
      })),
      monthlyExpenses: monthlyExpenses.map(e => ({ amount: e.Amount || 0, category: e.Category })),
      monthlyRevenue: monthlyRevenue.map(r => ({ amount: r.Amount || 0 })),
      recurringItems: recurringItems.map(r => ({
        amount: r.Amount || 0,
        dayOfMonth: r.DayOfMonth || 1,
        type: r.Type || 'outflow',
        description: r.Description,
      })),
    };
  } catch (error) {
    logger.error(`Failed to fetch financial data: ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Enhanced Unit Economics Calculation
// ---------------------------------------------------------------------------

async function calculateEnhancedUnitEconomics() {
  logger.info('Calculating enhanced unit economics...');

  const customers = await fetchCustomers();
  const activeCustomers = customers.filter(c => c.status === 'active');
  const churnedCustomers = customers.filter(c => c.status === 'churned');

  // Get leads and marketing data
  const leads = await getRecords('Leads', '').catch(() => []);
  const marketingExpenses = await getRecords('Expenses', '{Category} = "Marketing"').catch(() => []);
  const totalMarketingSpend = marketingExpenses.reduce((sum, e) => sum + (e.Amount || 0), 0);

  // CAC (Customer Acquisition Cost)
  const cac = activeCustomers.length > 0
    ? totalMarketingSpend / activeCustomers.length
    : 0;

  // Calculate average MRR per customer
  const totalMRR = activeCustomers.reduce((sum, c) => sum + (c.mrr || 0), 0);
  const avgMRRPerCustomer = activeCustomers.length > 0
    ? totalMRR / activeCustomers.length
    : 0;

  // Calculate average customer lifespan from churned customers
  const avgLifespanMonths = churnedCustomers.length > 0
    ? churnedCustomers.reduce((sum, c) => {
        const signup = new Date(c.signupDate);
        const churnDate = new Date(c.churnDate || Date.now());
        const monthsDiff = (churnDate - signup) / (1000 * 60 * 60 * 24 * 30);
        return sum + monthsDiff;
      }, 0) / churnedCustomers.length
    : 24; // Default to 24 months if no churn data

  // LTV (Customer Lifetime Value)
  const ltv = avgMRRPerCustomer * avgLifespanMonths;

  // LTV/CAC Ratio
  const ltvCacRatio = cac > 0 ? ltv / cac : 0;

  // Payback Period (in months)
  const paybackPeriod = avgMRRPerCustomer > 0 ? cac / avgMRRPerCustomer : 0;

  // Monthly Churn Rate
  const totalCustomers = customers.length;
  const monthlyChurnRate = totalCustomers > 0
    ? (churnedCustomers.length / totalCustomers) * 100
    : 0;

  // Calculate conversion funnel
  const conversionRate = leads.length > 0
    ? (activeCustomers.length / leads.length) * 100
    : 0;

  return {
    cac: Math.round(cac * 100) / 100,
    ltv: Math.round(ltv * 100) / 100,
    ltvCacRatio: Math.round(ltvCacRatio * 100) / 100,
    paybackPeriod: Math.round(paybackPeriod * 10) / 10,
    avgMRRPerCustomer: Math.round(avgMRRPerCustomer * 100) / 100,
    avgLifespanMonths: Math.round(avgLifespanMonths * 10) / 10,
    monthlyChurnRate: Math.round(monthlyChurnRate * 100) / 100,
    conversionRate: Math.round(conversionRate * 100) / 100,
    totalLeads: leads.length,
    totalCustomers: activeCustomers.length,
    totalMarketingSpend,
  };
}

// ---------------------------------------------------------------------------
// Enhanced Cohort Analysis
// ---------------------------------------------------------------------------

async function runEnhancedCohortAnalysis() {
  logger.info('Running enhanced cohort analysis...');

  const customers = await fetchCustomers();
  const cohorts = {};

  // Group customers by signup month
  for (const customer of customers) {
    const signupMonth = customer.signupDate
      ? customer.signupDate.substring(0, 7)
      : 'unknown';

    if (!cohorts[signupMonth]) {
      cohorts[signupMonth] = {
        signupMonth,
        initialCount: 0,
        currentActive: 0,
        initialMRR: 0,
        currentMRR: 0,
        totalRevenue: 0,
        churnedCount: 0,
        expandedCount: 0,
        contractedCount: 0,
        customers: [],
      };
    }

    const cohort = cohorts[signupMonth];
    cohort.initialCount += 1;
    cohort.initialMRR += customer.initialMRR || customer.mrr || 0;
    cohort.customers.push(customer);

    if (customer.status === 'active') {
      cohort.currentActive += 1;
      cohort.currentMRR += customer.mrr || 0;
    } else if (customer.status === 'churned') {
      cohort.churnedCount += 1;
    }

    // Track expansion and contraction
    const initialMRR = customer.initialMRR || customer.mrr || 0;
    const currentMRR = customer.mrr || 0;
    if (currentMRR > initialMRR) {
      cohort.expandedCount += 1;
    } else if (currentMRR < initialMRR && customer.status === 'active') {
      cohort.contractedCount += 1;
    }
  }

  // Calculate retention and expansion metrics for each cohort
  for (const [month, cohort] of Object.entries(cohorts)) {
    // Customer retention rate
    cohort.customerRetention = cohort.initialCount > 0
      ? Math.round((cohort.currentActive / cohort.initialCount) * 10000) / 100
      : 0;

    // Revenue retention rate
    cohort.revenueRetention = cohort.initialMRR > 0
      ? Math.round((cohort.currentMRR / cohort.initialMRR) * 10000) / 100
      : 0;

    // Net Revenue Retention (includes expansion)
    cohort.nrr = cohort.revenueRetention;

    // Expansion rate
    cohort.expansionRate = cohort.initialCount > 0
      ? Math.round((cohort.expandedCount / cohort.initialCount) * 10000) / 100
      : 0;

    // Churn rate
    cohort.churnRate = cohort.initialCount > 0
      ? Math.round((cohort.churnedCount / cohort.initialCount) * 10000) / 100
      : 0;

    // Average MRR per customer
    cohort.avgMRRPerCustomer = cohort.currentActive > 0
      ? Math.round((cohort.currentMRR / cohort.currentActive) * 100) / 100
      : 0;

    // Cohort age in months
    const cohortDate = new Date(month + '-01');
    const now = new Date();
    cohort.ageMonths = Math.round((now - cohortDate) / (1000 * 60 * 60 * 24 * 30));

    // Remove customer array to reduce size
    delete cohort.customers;
  }

  return cohorts;
}

// ---------------------------------------------------------------------------
// Department Cost Allocation
// ---------------------------------------------------------------------------

async function allocateDepartmentCosts(period) {
  logger.info(`Allocating department costs for ${period}...`);

  const expenses = await getRecords('Expenses',
    period ? `DATETIME_FORMAT({Date}, 'YYYY-MM') = "${period}"` : ''
  ).catch(() => []);

  const departments = {
    engineering: { total: 0, categories: {} },
    sales: { total: 0, categories: {} },
    marketing: { total: 0, categories: {} },
    operations: { total: 0, categories: {} },
    finance: { total: 0, categories: {} },
    general: { total: 0, categories: {} },
  };

  const departmentMapping = {
    'api': 'engineering',
    'anthropic': 'engineering',
    'openai': 'engineering',
    'deepl': 'engineering',
    'infrastructure': 'engineering',
    'hosting': 'engineering',
    'cloud': 'engineering',
    'tools': 'engineering',
    'saas': 'engineering',
    'marketing': 'marketing',
    'advertising': 'marketing',
    'content': 'marketing',
    'seo': 'marketing',
    'sales': 'sales',
    'crm': 'sales',
    'commission': 'sales',
    'accounting': 'finance',
    'legal': 'finance',
    'professional': 'finance',
    'office': 'operations',
    'rent': 'operations',
    'utilities': 'operations',
    'insurance': 'operations',
  };

  for (const expense of expenses) {
    const category = (expense.Category || '').toLowerCase();
    const amount = expense.Amount || 0;
    const department = departmentMapping[category] || 'general';

    departments[department].total += amount;

    if (!departments[department].categories[category]) {
      departments[department].categories[category] = 0;
    }
    departments[department].categories[category] += amount;
  }

  // Round totals
  for (const dept of Object.values(departments)) {
    dept.total = Math.round(dept.total * 100) / 100;
    for (const [cat, val] of Object.entries(dept.categories)) {
      dept.categories[cat] = Math.round(val * 100) / 100;
    }
  }

  return departments;
}

// ---------------------------------------------------------------------------
// Enhanced P&L Statement
// ---------------------------------------------------------------------------

async function generateEnhancedPL(period) {
  logger.info(`Generating enhanced P&L for ${period}...`);

  const invoices = await getRecords('Invoices',
    `AND({Status} = "Paid", DATETIME_FORMAT({Date}, 'YYYY-MM') = "${period}")`
  ).catch(() => []);

  const expenses = await getRecords('Expenses',
    `DATETIME_FORMAT({Date}, 'YYYY-MM') = "${period}"`
  ).catch(() => []);

  // Revenue breakdown
  const revenue = {
    services: invoices.filter(i => i.Type === 'Service').reduce((s, i) => s + (i.Amount || 0), 0),
    subscriptions: invoices.filter(i => i.Type === 'Subscription').reduce((s, i) => s + (i.Amount || 0), 0),
    consulting: invoices.filter(i => i.Type === 'Consulting').reduce((s, i) => s + (i.Amount || 0), 0),
    other: invoices.filter(i => !['Service', 'Subscription', 'Consulting'].includes(i.Type)).reduce((s, i) => s + (i.Amount || 0), 0),
  };
  revenue.total = revenue.services + revenue.subscriptions + revenue.consulting + revenue.other;

  // COGS
  const cogsCategories = ['api', 'anthropic', 'openai', 'deepl', 'infrastructure', 'hosting', 'cloud'];
  const cogs = expenses
    .filter(e => cogsCategories.includes((e.Category || '').toLowerCase()))
    .reduce((sum, e) => sum + (e.Amount || 0), 0);

  const grossProfit = revenue.total - cogs;
  const grossMargin = revenue.total > 0 ? (grossProfit / revenue.total) * 100 : 0;

  // Operating expenses by department
  const departmentCosts = await allocateDepartmentCosts(period);

  const opex = Object.values(departmentCosts).reduce((sum, dept) => sum + dept.total, 0);
  const ebitda = grossProfit - opex;
  const ebitdaMargin = revenue.total > 0 ? (ebitda / revenue.total) * 100 : 0;

  const netIncome = ebitda; // Simplified (no D&A, interest, taxes for now)
  const netMargin = revenue.total > 0 ? (netIncome / revenue.total) * 100 : 0;

  return {
    period,
    revenue,
    cogs,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
    departmentCosts,
    opex: Math.round(opex * 100) / 100,
    ebitda: Math.round(ebitda * 100) / 100,
    ebitdaMargin: Math.round(ebitdaMargin * 100) / 100,
    netIncome: Math.round(netIncome * 100) / 100,
    netMargin: Math.round(netMargin * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Break-Even Analysis
// ---------------------------------------------------------------------------

async function calculateBreakEven() {
  logger.info('Calculating break-even analysis...');

  const currentPeriod = new Date().toISOString().substring(0, 7);
  const pl = await generateEnhancedPL(currentPeriod);

  // Fixed costs (monthly)
  const fixedCosts = pl.departmentCosts.finance.total +
                     pl.departmentCosts.operations.total +
                     (pl.departmentCosts.general.total || 0);

  // Variable costs per unit (as % of revenue)
  const variableCostRatio = pl.revenue.total > 0
    ? pl.cogs / pl.revenue.total
    : 0.2; // Default to 20%

  // Break-even revenue = Fixed Costs / (1 - Variable Cost Ratio)
  const breakEvenRevenue = fixedCosts / (1 - variableCostRatio);

  // Current margin of safety
  const marginOfSafety = pl.revenue.total > 0
    ? ((pl.revenue.total - breakEvenRevenue) / pl.revenue.total) * 100
    : 0;

  return {
    fixedCosts: Math.round(fixedCosts * 100) / 100,
    variableCostRatio: Math.round(variableCostRatio * 10000) / 100,
    breakEvenRevenue: Math.round(breakEvenRevenue * 100) / 100,
    currentRevenue: pl.revenue.total,
    marginOfSafety: Math.round(marginOfSafety * 100) / 100,
    isProfitable: pl.netIncome > 0,
  };
}

// ---------------------------------------------------------------------------
// Revenue Forecasting
// ---------------------------------------------------------------------------

async function runRevenueForecast() {
  logger.info('Running revenue forecast...');

  const subscriptions = await fetchSubscriptions();
  const pipeline = await fetchPipeline();
  const mrrHistory = await fetchMRRHistory();

  // Current MRR
  const mrrData = calculateMRR(subscriptions.map(s => ({
    amount: s.Amount || s.Price || 0,
    billingCycle: s.BillingCycle || 'monthly',
    plan: s.Plan || 'standard',
  })));

  // Previous MRR
  const previousMRR = mrrHistory.length > 0
    ? mrrHistory[mrrHistory.length - 1].MRR || 0
    : mrrData.mrr * 0.95;

  // Growth rate
  const momGrowth = calculateGrowthRate(mrrData.mrr, previousMRR);

  // Pipeline forecast
  const pipelineForecast = forecastFromPipeline(pipeline);

  // NRR calculation
  const customers = await fetchCustomers();
  const activeCustomers = customers.filter(c => c.status === 'active');
  const expansionMRR = activeCustomers.reduce((sum, c) => {
    const expansion = (c.mrr || 0) - (c.initialMRR || 0);
    return sum + Math.max(0, expansion);
  }, 0);
  const contractionMRR = activeCustomers.reduce((sum, c) => {
    const contraction = (c.initialMRR || 0) - (c.mrr || 0);
    return sum + Math.max(0, contraction);
  }, 0);
  const churnedMRR = customers
    .filter(c => c.status === 'churned')
    .reduce((sum, c) => sum + (c.initialMRR || 0), 0);

  const nrr = calculateNRR({
    beginningMRR: previousMRR,
    expansionMRR,
    contractionMRR,
    churnedMRR: churnedMRR / 12, // Monthly portion
  });

  // 12-month scenario modeling with seasonal adjustment and linear regression
  const scenarios = scenarioModeling(mrrData.mrr, 12, mrrHistory, true);

  // Track forecast accuracy if we have historical forecasts
  let forecastAccuracy = null;
  try {
    const historicalForecasts = await getRecords('Forecasts', '').catch(() => []);
    if (historicalForecasts.length > 0) {
      const forecasts = historicalForecasts.map(f => ({
        period: f.Period,
        predicted: f.PredictedMRR || 0,
      }));
      const actuals = mrrHistory.map(h => ({
        period: h.Period,
        actual: h.MRR || 0,
      }));
      forecastAccuracy = calculateForecastAccuracy(forecasts, actuals);
    }
  } catch (error) {
    logger.warn(`Could not calculate forecast accuracy: ${error.message}`);
  }

  return {
    current: mrrData,
    previousMRR,
    momGrowth,
    nrr,
    pipeline: pipelineForecast,
    scenarios,
    forecastAccuracy,
  };
}

// ---------------------------------------------------------------------------
// Cash Flow Projection
// ---------------------------------------------------------------------------

async function runCashFlowProjection() {
  logger.info('Running cash flow projection...');

  const finData = await fetchFinancialData();

  // Cash position
  const cashPosition = calculateCashPosition({
    bankBalance: finData.bankBalance,
    accountsReceivable: finData.receivables,
    accountsPayable: finData.payables,
    pendingInvoices: finData.pendingInvoices,
    upcomingExpenses: finData.upcomingExpenses,
  });

  // Daily cash flow projection (90 days)
  const dailyProjection = projectCashFlow(
    finData.bankBalance,
    90,
    finData.pendingInvoices,
    finData.upcomingExpenses,
    finData.recurringItems
  );

  // Summary
  const summary = cashFlowSummary(dailyProjection);

  // Burn rate
  const burnRate = calculateBurnRate(finData.monthlyExpenses, finData.monthlyRevenue);

  // Runway
  const runway = calculateRunway(finData.bankBalance, burnRate);

  // Expense categorization
  const expenseCategories = categorizeExpenses(finData.monthlyExpenses);

  return {
    cashPosition,
    dailyProjection,
    summary,
    burnRate,
    runway,
    expenseCategories,
  };
}

// ---------------------------------------------------------------------------
// Cohort Analysis (wrapper for backward compatibility)
// ---------------------------------------------------------------------------

async function runCohortAnalysis() {
  logger.info('Running cohort analysis...');
  return await runEnhancedCohortAnalysis();
}

// ---------------------------------------------------------------------------
// Growth Metrics Dashboard
// ---------------------------------------------------------------------------

async function generateGrowthDashboard() {
  logger.info('Generating growth metrics dashboard...');

  const subscriptions = await fetchSubscriptions();
  const pipeline = await fetchPipeline();
  const mrrHistory = await fetchMRRHistory();
  const customers = await fetchCustomers();

  const mrrData = calculateMRR(subscriptions.map(s => ({
    amount: s.Amount || s.Price || 0,
    billingCycle: s.BillingCycle || 'monthly',
    plan: s.Plan || 'standard',
  })));

  const previousMRR = mrrHistory.length > 0
    ? mrrHistory[mrrHistory.length - 1].MRR || 0
    : 0;

  const activeCustomers = customers.filter(c => c.status === 'active');
  const churnedCustomers = customers.filter(c => c.status === 'churned');

  const dashboard = {
    timestamp: new Date().toISOString(),
    mrr: mrrData.mrr,
    arr: mrrData.arr,
    momGrowth: calculateGrowthRate(mrrData.mrr, previousMRR),
    totalCustomers: activeCustomers.length,
    churnRate: customers.length > 0
      ? Math.round((churnedCustomers.length / customers.length) * 10000) / 100
      : 0,
    avgMRRPerCustomer: mrrData.avgMRRPerCustomer,
    pipelineValue: pipeline.reduce((sum, d) => sum + (d.amount || 0), 0),
    pipelineDeals: pipeline.length,
    mrrBreakdown: mrrData.breakdown,
    mrrHistory: mrrHistory.slice(-12).map(h => ({
      period: h.Period,
      mrr: h.MRR || 0,
    })),
  };

  // Store current MRR in history
  try {
    const currentPeriod = new Date().toISOString().substring(0, 7);
    await createRecord('MRR_History', {
      Period: currentPeriod,
      MRR: mrrData.mrr,
      ARR: mrrData.arr,
      CustomerCount: activeCustomers.length,
      AvgMRR: mrrData.avgMRRPerCustomer,
      Date: new Date().toISOString().split('T')[0],
    });
  } catch (error) {
    logger.warn(`Failed to store MRR history: ${error.message}`);
  }

  return dashboard;
}

// ---------------------------------------------------------------------------
// Board-Ready Report
// ---------------------------------------------------------------------------

async function generateBoardReport() {
  logger.info('Generating board-ready metrics report...');

  const [forecast, cashFlow, cohorts, dashboard, unitEconomics, breakEven, pl] = await Promise.all([
    runRevenueForecast(),
    runCashFlowProjection(),
    runCohortAnalysis(),
    generateGrowthDashboard(),
    calculateEnhancedUnitEconomics(),
    calculateBreakEven(),
    generateEnhancedPL(new Date().toISOString().substring(0, 7)),
  ]);

  const fmt = (val) => `CHF ${Math.round(val).toLocaleString('de-CH')}`;
  const pct = (val) => `${val}%`;

  // Cash flow markdown
  const cashFlowMd = cashFlowToMarkdown(
    cashFlow.summary,
    cashFlow.burnRate,
    cashFlow.runway
  );

  // Generate AI commentary with enhanced metrics
  const commentary = await generateText(`
Analyze these SaaS metrics for a Swiss AI startup board meeting and provide strategic commentary in 4-5 paragraphs:

Revenue Metrics:
- MRR: ${fmt(forecast.current.mrr)}
- ARR: ${fmt(forecast.current.arr)}
- MoM Growth: ${pct(forecast.momGrowth)}
- NRR: ${pct(forecast.nrr)}
- Pipeline Weighted: ${fmt(forecast.pipeline.expected)}

Unit Economics:
- CAC: ${fmt(unitEconomics.cac)}
- LTV: ${fmt(unitEconomics.ltv)}
- LTV/CAC Ratio: ${unitEconomics.ltvCacRatio}x
- Payback Period: ${unitEconomics.paybackPeriod} months
- Monthly Churn: ${pct(unitEconomics.monthlyChurnRate)}

Cash Position:
- Bank Balance: ${fmt(cashFlow.cashPosition.bankBalance)}
- Monthly Burn: ${fmt(cashFlow.burnRate.netBurn)}
- Runway: ${cashFlow.runway.message}
- Profitable: ${cashFlow.burnRate.isProfitable ? 'Yes' : 'No'}

Profitability:
- Gross Margin: ${pct(pl.grossMargin)}
- EBITDA Margin: ${pct(pl.ebitdaMargin)}
- Net Margin: ${pct(pl.netMargin)}
- Break-Even Revenue: ${fmt(breakEven.breakEvenRevenue)}
- Margin of Safety: ${pct(breakEven.marginOfSafety)}

12-Month Forecast (Expected):
- Month 6 MRR: ${fmt(forecast.scenarios.expected[5]?.mrr || 0)}
- Month 12 MRR: ${fmt(forecast.scenarios.expected[11]?.mrr || 0)}
${forecast.forecastAccuracy ? `- Forecast Accuracy: ${pct(forecast.forecastAccuracy.accuracy)}` : ''}

Customers: ${dashboard.totalCustomers} active
Churn Rate: ${pct(dashboard.churnRate)}

Focus on: growth trajectory, capital efficiency, unit economics health, key risks, strategic recommendations.`,
    {
      system: 'You are a CFO preparing board materials for a Swiss AI/SaaS startup. Be data-driven, concise, and strategic.',
      model: config.models.standard,
    }
  );

  // Build full report with enhanced metrics
  const cohortEntries = Object.entries(cohorts).slice(-6);
  const report = `# FP&A Board Report
*Period: ${new Date().toISOString().substring(0, 7)} | Generated: ${new Date().toISOString().split('T')[0]}*

---

## Key Metrics at a Glance

| Metric | Current | Trend |
|--------|---------|-------|
| MRR | ${fmt(forecast.current.mrr)} | ${forecast.momGrowth > 0 ? 'Up' : 'Down'} ${pct(Math.abs(forecast.momGrowth))} MoM |
| ARR | ${fmt(forecast.current.arr)} | - |
| NRR | ${pct(forecast.nrr)} | ${forecast.nrr > 100 ? 'Healthy' : 'Below 100%'} |
| Active Customers | ${dashboard.totalCustomers} | - |
| Avg MRR/Customer | ${fmt(dashboard.avgMRRPerCustomer)} | - |
| Churn Rate | ${pct(dashboard.churnRate)} | - |
| Pipeline Value | ${fmt(dashboard.pipelineValue)} | ${dashboard.pipelineDeals} deals |
| Pipeline (Weighted) | ${fmt(forecast.pipeline.expected)} | - |

## Unit Economics

| Metric | Value | Status |
|--------|-------|--------|
| CAC | ${fmt(unitEconomics.cac)} | - |
| LTV | ${fmt(unitEconomics.ltv)} | - |
| LTV/CAC Ratio | ${unitEconomics.ltvCacRatio}x | ${unitEconomics.ltvCacRatio >= 3 ? 'Healthy' : 'Needs Improvement'} |
| Payback Period | ${unitEconomics.paybackPeriod} months | ${unitEconomics.paybackPeriod <= 12 ? 'Good' : 'High'} |
| Conversion Rate | ${pct(unitEconomics.conversionRate)} | - |
| Avg Lifespan | ${unitEconomics.avgLifespanMonths} months | - |

## Profitability & P&L

| Metric | Value |
|--------|-------|
| Revenue | ${fmt(pl.revenue.total)} |
| Gross Margin | ${pct(pl.grossMargin)} |
| EBITDA | ${fmt(pl.ebitda)} |
| EBITDA Margin | ${pct(pl.ebitdaMargin)} |
| Net Income | ${fmt(pl.netIncome)} |
| Net Margin | ${pct(pl.netMargin)} |

## Break-Even Analysis

| Metric | Value |
|--------|-------|
| Fixed Costs | ${fmt(breakEven.fixedCosts)} |
| Variable Cost Ratio | ${pct(breakEven.variableCostRatio)} |
| Break-Even Revenue | ${fmt(breakEven.breakEvenRevenue)} |
| Current Revenue | ${fmt(breakEven.currentRevenue)} |
| Margin of Safety | ${pct(breakEven.marginOfSafety)} |
| Status | ${breakEven.isProfitable ? 'Profitable' : 'Pre-Profitable'} |

## Revenue Forecast - 12 Month Scenarios (with Confidence Intervals)

| Month | Best Case | Expected | Expected CI | Worst Case |
|-------|-----------|----------|-------------|------------|
${[0, 2, 5, 8, 11].map(i => {
  const bc = forecast.scenarios.bestCase[i];
  const ex = forecast.scenarios.expected[i];
  const wc = forecast.scenarios.worstCase[i];
  const ci = ex?.confidenceInterval;
  const ciStr = ci ? `${fmt(ci.lower)} - ${fmt(ci.upper)}` : '-';
  return `| M+${i + 1} | ${bc ? fmt(bc.mrr) : '-'} | ${ex ? fmt(ex.mrr) : '-'} | ${ciStr} | ${wc ? fmt(wc.mrr) : '-'} |`;
}).join('\n')}

${forecast.scenarios.linearRegression ? `### Linear Regression Forecast
**Quality Metrics:**
- R² (goodness of fit): ${forecast.scenarios.regressionQuality?.r2 || 'N/A'}
- Slope: ${forecast.scenarios.regressionQuality?.slope || 'N/A'}
- Confidence: ${pct((forecast.scenarios.regressionQuality?.confidence || 0) * 100)}
` : ''}

${forecast.forecastAccuracy ? `### Forecast Accuracy Tracking
- MAPE (Mean Absolute % Error): ${pct(forecast.forecastAccuracy.mape)}
- Accuracy: ${pct(forecast.forecastAccuracy.accuracy)}
- RMSE: ${fmt(forecast.forecastAccuracy.rmse)}
- Historical Comparisons: ${forecast.forecastAccuracy.count}
` : ''}

## Pipeline Analysis

| Stage | Deals | Total Value | Weighted Value |
|-------|-------|-------------|----------------|
${Object.entries(forecast.pipeline.byStage).map(([stage, data]) =>
  `| ${stage} | ${data.count} | ${fmt(data.totalValue)} | ${fmt(data.weightedValue)} |`
).join('\n')}

**Pipeline Summary:** ${fmt(forecast.pipeline.totalPipelineValue)} total, ${fmt(forecast.pipeline.expected)} weighted expected

${cashFlowMd}

## Department Cost Allocation

| Department | Total Cost | % of OpEx |
|------------|------------|-----------|
${Object.entries(pl.departmentCosts).map(([dept, data]) => {
  const pctOfOpex = pl.opex > 0 ? Math.round((data.total / pl.opex) * 10000) / 100 : 0;
  return `| ${dept.charAt(0).toUpperCase() + dept.slice(1)} | ${fmt(data.total)} | ${pct(pctOfOpex)} |`;
}).join('\n')}

## Cohort Analysis (Enhanced)

| Cohort | Initial | Active | Churn Rate | Customer Retention | Revenue Retention | NRR | Expansion Rate |
|--------|---------|--------|------------|--------------------|--------------------|-----|----------------|
${cohortEntries.map(([month, c]) =>
  `| ${month} | ${c.initialCount} | ${c.currentActive} | ${c.churnRate}% | ${c.customerRetention}% | ${c.revenueRetention}% | ${c.nrr}% | ${c.expansionRate}% |`
).join('\n')}

## Strategic Commentary

${commentary}

---
*Generated by Werkpilot FP&A Agent | Confidential*
`;

  // Save report
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `fpa-board-report-${new Date().toISOString().substring(0, 7)}.md`);
  fs.writeFileSync(reportPath, report, 'utf-8');
  logger.info(`Board report saved to ${reportPath}`);

  // Store in Airtable
  try {
    await createRecord('Reports', {
      Type: 'FPA_Board',
      Period: new Date().toISOString().substring(0, 7),
      MRR: forecast.current.mrr,
      ARR: forecast.current.arr,
      MoMGrowth: forecast.momGrowth,
      NRR: forecast.nrr,
      BurnRate: cashFlow.burnRate.netBurn,
      Runway: cashFlow.runway.months === Infinity ? 999 : cashFlow.runway.months,
      GeneratedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Failed to store board report in Airtable: ${error.message}`);
  }

  // Email to CEO
  await sendCEOEmail({
    subject: `FP&A Board Report - ${new Date().toISOString().substring(0, 7)}`,
    html: `
      <h2>FP&A Board Report</h2>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
        <tr><td><strong>MRR</strong></td><td>${fmt(forecast.current.mrr)}</td></tr>
        <tr><td><strong>ARR</strong></td><td>${fmt(forecast.current.arr)}</td></tr>
        <tr><td><strong>MoM Growth</strong></td><td>${pct(forecast.momGrowth)}</td></tr>
        <tr><td><strong>NRR</strong></td><td>${pct(forecast.nrr)}</td></tr>
        <tr><td><strong>Burn Rate</strong></td><td>${fmt(cashFlow.burnRate.netBurn)}/month</td></tr>
        <tr><td><strong>Runway</strong></td><td>${cashFlow.runway.message}</td></tr>
        <tr><td><strong>Pipeline</strong></td><td>${fmt(forecast.pipeline.expected)} weighted</td></tr>
      </table>
      <h3>Commentary</h3>
      <p>${commentary.replace(/\n/g, '<br>')}</p>
      <p style="color: #999; font-size: 12px;">
        Full report: ${reportPath}
      </p>
    `,
  });

  logger.info('Board report completed and sent');

  return {
    forecast,
    cashFlow,
    cohorts,
    dashboard,
    unitEconomics,
    breakEven,
    pl,
    reportPath,
  };
}

// ---------------------------------------------------------------------------
// Monthly Forecast Report (simpler than board report)
// ---------------------------------------------------------------------------

async function generateMonthlyForecast() {
  logger.info('Generating monthly forecast...');

  const forecast = await runRevenueForecast();
  const cashFlow = await runCashFlowProjection();

  const fmt = (val) => `CHF ${Math.round(val).toLocaleString('de-CH')}`;

  const report = {
    period: new Date().toISOString().substring(0, 7),
    mrr: forecast.current.mrr,
    arr: forecast.current.arr,
    momGrowth: forecast.momGrowth,
    nrr: forecast.nrr,
    pipelineExpected: forecast.pipeline.expected,
    burnRate: cashFlow.burnRate.netBurn,
    runway: cashFlow.runway.months,
    cashPosition: cashFlow.cashPosition.bankBalance,
    forecast3m: forecast.scenarios.expected[2]?.mrr || 0,
    forecast6m: forecast.scenarios.expected[5]?.mrr || 0,
    forecast12m: forecast.scenarios.expected[11]?.mrr || 0,
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const filePath = path.join(REPORTS_DIR, `forecast-${report.period}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
  logger.info(`Monthly forecast saved to ${filePath}`);

  return report;
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function startScheduler() {
  // Full board report: weekly on Monday at 05:00
  cron.schedule('0 5 * * 1', async () => {
    logger.info('Scheduled: Weekly board report');
    try {
      await generateBoardReport();
    } catch (error) {
      logger.error(`Scheduled board report failed: ${error.message}`);
    }
  });

  // Daily metrics update at 06:30
  cron.schedule('30 6 * * *', async () => {
    logger.info('Scheduled: Daily metrics update');
    try {
      await generateGrowthDashboard();
    } catch (error) {
      logger.error(`Scheduled metrics update failed: ${error.message}`);
    }
  });

  // Monthly forecast: 1st of each month at 04:00
  cron.schedule('0 4 1 * *', async () => {
    logger.info('Scheduled: Monthly forecast');
    try {
      await generateMonthlyForecast();
    } catch (error) {
      logger.error(`Scheduled monthly forecast failed: ${error.message}`);
    }
  });

  logger.info('FP&A Agent scheduler started');
  logger.info('  - Board report: weekly Monday 05:00');
  logger.info('  - Metrics update: daily 06:30');
  logger.info('  - Monthly forecast: 1st of month 04:00');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  logger.info('FP&A Agent starting...');

  if (process.argv.includes('--once')) {
    await generateBoardReport();
  } else if (process.argv.includes('--forecast')) {
    await generateMonthlyForecast();
  } else if (process.argv.includes('--cashflow')) {
    const cf = await runCashFlowProjection();
    console.log(JSON.stringify(cf.summary, null, 2));
  } else if (process.argv.includes('--dashboard')) {
    const dashboard = await generateGrowthDashboard();
    console.log(JSON.stringify(dashboard, null, 2));
  } else if (process.argv.includes('--cohorts')) {
    const cohorts = await runCohortAnalysis();
    console.log(JSON.stringify(cohorts, null, 2));
  } else if (process.argv.includes('--unit-economics')) {
    const unitEcon = await calculateEnhancedUnitEconomics();
    console.log(JSON.stringify(unitEcon, null, 2));
  } else if (process.argv.includes('--break-even')) {
    const breakEven = await calculateBreakEven();
    console.log(JSON.stringify(breakEven, null, 2));
  } else if (process.argv.includes('--pl')) {
    const period = process.argv.find(arg => arg.match(/\d{4}-\d{2}/)) ||
                   new Date().toISOString().substring(0, 7);
    const pl = await generateEnhancedPL(period);
    console.log(JSON.stringify(pl, null, 2));
  } else {
    startScheduler();
  }
}

main().catch(error => {
  logger.error(`FP&A Agent fatal error: ${error.message}`, { stack: error.stack });
  process.exit(1);
});

module.exports = {
  runRevenueForecast,
  runCashFlowProjection,
  runCohortAnalysis,
  runEnhancedCohortAnalysis,
  generateGrowthDashboard,
  generateBoardReport,
  generateMonthlyForecast,
  calculateEnhancedUnitEconomics,
  allocateDepartmentCosts,
  generateEnhancedPL,
  calculateBreakEven,
  startScheduler,
};
