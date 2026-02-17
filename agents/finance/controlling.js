/**
 * Agent 24 — Controlling Agent
 * Werkpilot Finance Department
 *
 * Tracks P&L per client, per service, per industry.
 * Calculates unit economics, margin analysis, budget vs actual.
 * Generates monthly P&L statements in Markdown.
 * Alerts when margins fall below 80%.
 *
 * Schedule: Daily at 06:00 (full run), hourly margin check
 */

'use strict';

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const dashboardSync = require('../shared/utils/dashboard-sync');
const config = require('../shared/utils/config');

const {
  calculateRevenue,
  calculateCOGS,
  calculateMargins,
  calculateClientPL,
  calculateUnitEconomics,
  generatePLStatement,
  budgetVsActual,
  findMarginAlerts,
  rankByProfitability,
  plToMarkdown,
} = require('./financial-models/pl-template');

const logger = createLogger('finance-controlling');
const REPORTS_DIR = path.join(__dirname, 'reports');
const MARGIN_THRESHOLD = 80;

// ---------------------------------------------------------------------------
// Data Collection
// ---------------------------------------------------------------------------

async function fetchClientData() {
  try {
    const clients = await getRecords('Clients', '{Status} = "Active"');
    logger.info(`Fetched ${clients.length} active clients`);
    return clients;
  } catch (error) {
    logger.error(`Failed to fetch client data: ${error.message}`);
    return [];
  }
}

async function fetchInvoices(period) {
  try {
    const filter = period
      ? `AND({Status} = "Paid", DATETIME_FORMAT({Date}, 'YYYY-MM') = "${period}")`
      : '{Status} = "Paid"';
    const invoices = await getRecords('Invoices', filter);
    logger.info(`Fetched ${invoices.length} paid invoices for period ${period || 'all'}`);
    return invoices;
  } catch (error) {
    logger.error(`Failed to fetch invoices: ${error.message}`);
    return [];
  }
}

async function fetchExpenses(period) {
  try {
    const filter = period
      ? `DATETIME_FORMAT({Date}, 'YYYY-MM') = "${period}"`
      : '';
    const expenses = await getRecords('Expenses', filter);
    logger.info(`Fetched ${expenses.length} expenses for period ${period || 'all'}`);
    return expenses;
  } catch (error) {
    logger.error(`Failed to fetch expenses: ${error.message}`);
    return [];
  }
}

async function fetchBudget(period) {
  try {
    const filter = period ? `{Period} = "${period}"` : '';
    const budget = await getRecords('Budget', filter);
    return budget.length > 0 ? budget[0] : null;
  } catch (error) {
    logger.error(`Failed to fetch budget: ${error.message}`);
    return null;
  }
}

async function fetchMarketingData() {
  try {
    const leads = await getRecords('Leads', '');
    const customers = await getRecords('Clients', '{Status} = "Active"');
    const marketingExpenses = await getRecords('Expenses', '{Category} = "Marketing"');
    return { leads, customers, marketingExpenses };
  } catch (error) {
    logger.error(`Failed to fetch marketing data: ${error.message}`);
    return { leads: [], customers: [], marketingExpenses: [] };
  }
}

// ---------------------------------------------------------------------------
// P&L Analysis
// ---------------------------------------------------------------------------

async function analyzeClientProfitability(clients, invoices, expenses) {
  const clientPLs = [];

  for (const client of clients) {
    const clientInvoices = invoices.filter(inv =>
      inv.Client === client.Name || inv.ClientId === client.id
    );
    const clientRevenue = clientInvoices.reduce((sum, inv) => sum + (inv.Amount || 0), 0);

    // Estimate API costs per client based on usage or proportional allocation
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.Amount || 0), 0);
    const revenueShare = totalRevenue > 0 ? clientRevenue / totalRevenue : 0;

    const apiExpenses = expenses.filter(e =>
      ['api', 'anthropic', 'openai', 'deepl'].includes((e.Category || '').toLowerCase())
    );
    const totalApiCosts = apiExpenses.reduce((sum, e) => sum + (e.Amount || 0), 0);

    const clientApiCosts = client.ApiCosts || (totalApiCosts * revenueShare);
    const clientDirectCosts = client.DirectCosts || 0;
    const clientOverhead = client.AllocatedOverhead || (clientRevenue * 0.05);

    const pl = calculateClientPL({
      name: client.Name || client.Company || 'Unknown',
      revenue: clientRevenue,
      apiCosts: clientApiCosts,
      directCosts: clientDirectCosts,
      allocatedOverhead: clientOverhead,
    });

    clientPLs.push({
      ...pl,
      industry: client.Industry || 'Unknown',
      service: client.ServiceType || 'Unknown',
      clientId: client.id,
    });
  }

  return clientPLs;
}

function analyzeByDimension(clientPLs, dimension) {
  const grouped = {};

  for (const pl of clientPLs) {
    const key = pl[dimension] || 'Unknown';
    if (!grouped[key]) {
      grouped[key] = {
        name: key,
        revenue: 0,
        totalCosts: 0,
        profit: 0,
        clientCount: 0,
      };
    }
    grouped[key].revenue += pl.revenue;
    grouped[key].totalCosts += pl.totalCosts;
    grouped[key].profit += pl.profit;
    grouped[key].clientCount += 1;
  }

  // Calculate margins
  for (const group of Object.values(grouped)) {
    group.margin = group.revenue > 0
      ? Math.round((group.profit / group.revenue) * 10000) / 100
      : 0;
  }

  return Object.values(grouped).sort((a, b) => b.profit - a.profit);
}

// ---------------------------------------------------------------------------
// Real-time KPI Dashboard Sync
// ---------------------------------------------------------------------------

async function calculateKPIs(clients, invoices, expenses) {
  // Calculate MRR from active subscriptions
  const subscriptions = await getRecords('Subscriptions', '{Status} = "Active"').catch(() => []);
  const mrr = subscriptions.reduce((sum, sub) => {
    const amount = sub.Amount || sub.Price || 0;
    const cycle = (sub.BillingCycle || 'monthly').toLowerCase();
    return sum + (cycle === 'annual' ? amount / 12 : amount);
  }, 0);

  const arr = mrr * 12;

  // Calculate churn rate
  const totalCustomers = clients.length;
  const churnedCustomers = clients.filter(c => c.Status === 'Churned').length;
  const churnRate = totalCustomers > 0 ? (churnedCustomers / totalCustomers) * 100 : 0;

  // Calculate LTV (average customer lifespan 24 months for now)
  const avgMRRPerCustomer = totalCustomers > 0 ? mrr / totalCustomers : 0;
  const ltv = avgMRRPerCustomer * 24; // 24 months average lifespan

  // Calculate CAC
  const marketingExpenses = expenses.filter(e =>
    (e.Category || '').toLowerCase() === 'marketing'
  );
  const totalMarketingSpend = marketingExpenses.reduce((sum, e) => sum + (e.Amount || 0), 0);
  const newCustomersThisMonth = clients.filter(c => {
    const signupDate = new Date(c.SignupDate || c.CreatedAt);
    const thisMonth = new Date();
    return signupDate.getMonth() === thisMonth.getMonth() &&
           signupDate.getFullYear() === thisMonth.getFullYear();
  }).length;
  const cac = newCustomersThisMonth > 0 ? totalMarketingSpend / newCustomersThisMonth : 0;

  // Revenue by Branche (industry)
  const revenueByBranche = {};
  for (const client of clients) {
    const branche = client.Industry || client.Branche || 'Unknown';
    const clientInvoices = invoices.filter(inv =>
      inv.Client === client.Name || inv.ClientId === client.id
    );
    const revenue = clientInvoices.reduce((sum, inv) => sum + (inv.Amount || 0), 0);

    if (!revenueByBranche[branche]) {
      revenueByBranche[branche] = { revenue: 0, clients: 0 };
    }
    revenueByBranche[branche].revenue += revenue;
    revenueByBranche[branche].clients += 1;
  }

  // Revenue by Kanton
  const revenueByKanton = {};
  for (const client of clients) {
    const kanton = client.Kanton || client.Canton || client.State || 'Unknown';
    const clientInvoices = invoices.filter(inv =>
      inv.Client === client.Name || inv.ClientId === client.id
    );
    const revenue = clientInvoices.reduce((sum, inv) => sum + (inv.Amount || 0), 0);

    if (!revenueByKanton[kanton]) {
      revenueByKanton[kanton] = { revenue: 0, clients: 0 };
    }
    revenueByKanton[kanton].revenue += revenue;
    revenueByKanton[kanton].clients += 1;
  }

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(arr * 100) / 100,
    churnRate: Math.round(churnRate * 100) / 100,
    ltv: Math.round(ltv * 100) / 100,
    cac: Math.round(cac * 100) / 100,
    ltvCacRatio: cac > 0 ? Math.round((ltv / cac) * 100) / 100 : 0,
    totalCustomers,
    activeCustomers: clients.filter(c => c.Status === 'Active').length,
    revenueByBranche,
    revenueByKanton,
  };
}

async function syncKPIsToDashboard(kpis, period) {
  try {
    logger.info('Syncing KPIs to dashboard...');

    // Create a snapshot record
    await dashboardSync.bulkSync({
      metrics: [{
        type: 'kpi_snapshot',
        period,
        mrr: kpis.mrr,
        arr: kpis.arr,
        churnRate: kpis.churnRate,
        ltv: kpis.ltv,
        cac: kpis.cac,
        ltvCacRatio: kpis.ltvCacRatio,
        totalCustomers: kpis.totalCustomers,
        activeCustomers: kpis.activeCustomers,
        revenueByBranche: JSON.stringify(kpis.revenueByBranche),
        revenueByKanton: JSON.stringify(kpis.revenueByKanton),
        timestamp: new Date().toISOString(),
      }],
    });

    logger.info('KPIs synced successfully to dashboard');
  } catch (error) {
    logger.error(`Failed to sync KPIs to dashboard: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Cash Flow Projection (3 months ahead)
// ---------------------------------------------------------------------------

async function projectCashFlow() {
  try {
    // Get current bank balance
    const bankAccounts = await getRecords('BankAccounts', '');
    const currentBalance = bankAccounts.reduce((sum, acc) => sum + (acc.Balance || 0), 0);

    // Get pending invoices
    const pendingInvoices = await getRecords('Invoices', '{Status} = "Sent"');

    // Get upcoming expenses
    const today = new Date();
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    const upcomingBills = await getRecords('Bills', '{Status} = "Unpaid"');

    // Get recurring items
    const recurringItems = await getRecords('RecurringItems', '{Active} = TRUE()');

    // Project for next 3 months
    const projections = [];
    let runningBalance = currentBalance;

    for (let month = 0; month < 3; month++) {
      const projectionDate = new Date(today);
      projectionDate.setMonth(projectionDate.getMonth() + month + 1);
      const monthStr = projectionDate.toISOString().substring(0, 7);

      // Expected inflows (average monthly revenue)
      const pastInvoices = await getRecords('Invoices', '{Status} = "Paid"');
      const avgMonthlyRevenue = pastInvoices.length > 0
        ? pastInvoices.reduce((sum, inv) => sum + (inv.Amount || 0), 0) / 12
        : 0;

      // Expected outflows (recurring expenses)
      const recurringExpenses = recurringItems
        .filter(item => (item.Type || '').toLowerCase() === 'outflow')
        .reduce((sum, item) => sum + (item.Amount || 0), 0);

      runningBalance = runningBalance + avgMonthlyRevenue - recurringExpenses;

      projections.push({
        month: monthStr,
        expectedInflows: Math.round(avgMonthlyRevenue * 100) / 100,
        expectedOutflows: Math.round(recurringExpenses * 100) / 100,
        projectedBalance: Math.round(runningBalance * 100) / 100,
      });
    }

    return {
      currentBalance,
      projections,
    };
  } catch (error) {
    logger.error(`Failed to project cash flow: ${error.message}`);
    return { currentBalance: 0, projections: [] };
  }
}

// ---------------------------------------------------------------------------
// Monthly P&L Statement
// ---------------------------------------------------------------------------

async function generateMonthlyPL(period) {
  logger.info(`Generating monthly P&L for ${period}`);

  const invoices = await fetchInvoices(period);
  const expenses = await fetchExpenses(period);

  // Revenue breakdown
  const serviceRevenue = invoices
    .filter(inv => inv.Type === 'Service')
    .reduce((sum, inv) => sum + (inv.Amount || 0), 0);
  const subscriptionRevenue = invoices
    .filter(inv => inv.Type === 'Subscription')
    .reduce((sum, inv) => sum + (inv.Amount || 0), 0);
  const consultingRevenue = invoices
    .filter(inv => inv.Type === 'Consulting')
    .reduce((sum, inv) => sum + (inv.Amount || 0), 0);
  const otherRevenue = invoices
    .filter(inv => !['Service', 'Subscription', 'Consulting'].includes(inv.Type))
    .reduce((sum, inv) => sum + (inv.Amount || 0), 0);

  const totalRevenue = serviceRevenue + subscriptionRevenue + consultingRevenue + otherRevenue;

  // COGS
  const cogs = calculateCOGS(expenses.map(e => ({
    category: (e.Category || '').toLowerCase(),
    amount: e.Amount || 0,
    period,
  })), period);

  // Operating expenses (non-COGS)
  const cogsCategories = ['api', 'anthropic', 'openai', 'deepl', 'infrastructure', 'hosting', 'cloud', 'tools', 'saas', 'labor', 'freelancer'];
  const opexExpenses = expenses.filter(e =>
    !cogsCategories.includes((e.Category || '').toLowerCase())
  );

  const operatingExpenses = {
    salaries: opexExpenses.filter(e => (e.Category || '').toLowerCase() === 'salaries').reduce((s, e) => s + (e.Amount || 0), 0),
    marketing: opexExpenses.filter(e => (e.Category || '').toLowerCase() === 'marketing').reduce((s, e) => s + (e.Amount || 0), 0),
    office: opexExpenses.filter(e => ['office', 'rent'].includes((e.Category || '').toLowerCase())).reduce((s, e) => s + (e.Amount || 0), 0),
    software: opexExpenses.filter(e => (e.Category || '').toLowerCase() === 'software').reduce((s, e) => s + (e.Amount || 0), 0),
    professional: opexExpenses.filter(e => ['legal', 'accounting', 'professional'].includes((e.Category || '').toLowerCase())).reduce((s, e) => s + (e.Amount || 0), 0),
    other: opexExpenses.filter(e => !['salaries', 'marketing', 'office', 'rent', 'software', 'legal', 'accounting', 'professional'].includes((e.Category || '').toLowerCase())).reduce((s, e) => s + (e.Amount || 0), 0),
  };

  const pl = generatePLStatement({
    period,
    revenue: {
      services: serviceRevenue,
      subscriptions: subscriptionRevenue,
      consulting: consultingRevenue,
      other: otherRevenue,
      total: totalRevenue,
    },
    cogs,
    operatingExpenses,
    depreciation: 0,
    interest: 0,
    taxes: 0,
  });

  return pl;
}

// ---------------------------------------------------------------------------
// Unit Economics
// ---------------------------------------------------------------------------

async function computeUnitEconomics() {
  const { leads, customers, marketingExpenses } = await fetchMarketingData();

  const totalMarketingSpend = marketingExpenses.reduce((sum, e) => sum + (e.Amount || 0), 0);
  const invoices = await fetchInvoices();
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.Amount || 0), 0);

  const activeCustomers = customers.filter(c => c.Status === 'Active');
  const churnedCustomers = customers.filter(c => c.Status === 'Churned');

  const economics = calculateUnitEconomics({
    totalMarketingSpend,
    totalLeads: leads.length,
    totalCustomers: activeCustomers.length,
    totalRevenue,
    avgCustomerLifespanMonths: 24,
    totalChurnedCustomers: churnedCustomers.length,
    monthsInPeriod: 12,
  });

  return economics;
}

// ---------------------------------------------------------------------------
// Budget vs Actual
// ---------------------------------------------------------------------------

async function analyzeBudgetVsActual(period) {
  const budget = await fetchBudget(period);
  if (!budget) {
    logger.warn(`No budget found for period ${period}`);
    return null;
  }

  const pl = await generateMonthlyPL(period);

  const budgetData = {
    revenue: budget.Revenue || 0,
    cogs: budget.COGS || 0,
    salaries: budget.Salaries || 0,
    marketing: budget.Marketing || 0,
    office: budget.Office || 0,
    software: budget.Software || 0,
    total_expenses: budget.TotalExpenses || 0,
    net_income: budget.NetIncome || 0,
  };

  const actualData = {
    revenue: pl.revenue.total,
    cogs: pl.cogs.total,
    salaries: pl.operatingExpenses.salaries,
    marketing: pl.operatingExpenses.marketing,
    office: pl.operatingExpenses.office,
    software: pl.operatingExpenses.software,
    total_expenses: pl.cogs.total + pl.operatingExpenses.total,
    net_income: pl.netIncome,
  };

  return budgetVsActual(budgetData, actualData);
}

// ---------------------------------------------------------------------------
// Margin Monitoring & Alerts
// ---------------------------------------------------------------------------

async function checkMargins() {
  logger.info('Running margin check...');

  const clients = await fetchClientData();
  const invoices = await fetchInvoices();
  const expenses = await fetchExpenses();

  if (clients.length === 0) {
    logger.warn('No client data available for margin check');
    return;
  }

  const clientPLs = await analyzeClientProfitability(clients, invoices, expenses);
  const alerts = findMarginAlerts(clientPLs, MARGIN_THRESHOLD);

  if (alerts.length > 0) {
    logger.warn(`${alerts.length} margin alert(s) detected`);

    const alertRows = alerts.map(a =>
      `<tr style="color: ${a.severity === 'critical' ? '#dc3545' : '#ffc107'}">
        <td>${a.client}</td>
        <td>${a.margin}%</td>
        <td>CHF ${a.revenue.toLocaleString('de-CH')}</td>
        <td>${a.severity.toUpperCase()}</td>
      </tr>`
    ).join('\n');

    await sendCEOEmail({
      subject: `Margin Alert: ${alerts.length} client(s) below ${MARGIN_THRESHOLD}%`,
      html: `
        <h2>Margin Alert - Werkpilot Controlling</h2>
        <p>The following clients have margins below the ${MARGIN_THRESHOLD}% threshold:</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
          <tr style="background: #f8f9fa;">
            <th>Client</th>
            <th>Margin</th>
            <th>Revenue</th>
            <th>Severity</th>
          </tr>
          ${alertRows}
        </table>
        <p style="margin-top: 16px;">
          <strong>Recommended actions:</strong><br>
          - Review API usage and costs for critical clients<br>
          - Consider repricing or service adjustments<br>
          - Evaluate scope creep on projects
        </p>
        <p style="color: #999; font-size: 12px;">
          Generated by Werkpilot Controlling Agent
        </p>
      `,
    });

    // Store alerts in Airtable
    for (const alert of alerts) {
      try {
        await createRecord('Alerts', {
          Type: 'Margin',
          Source: 'Controlling Agent',
          Severity: alert.severity,
          Client: alert.client,
          Message: alert.message,
          Metric: alert.margin,
          Threshold: MARGIN_THRESHOLD,
          Date: new Date().toISOString().split('T')[0],
        });
      } catch (error) {
        logger.error(`Failed to store alert for ${alert.client}: ${error.message}`);
      }
    }
  } else {
    logger.info('All client margins are healthy');
  }

  return { alerts, clientPLs };
}

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

async function generateControllingReport() {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  logger.info(`Starting full controlling report for ${period}`);

  try {
    // 1. Monthly P&L
    const pl = await generateMonthlyPL(period);
    const plMarkdown = plToMarkdown(pl);

    // Save P&L report
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const plFilePath = path.join(REPORTS_DIR, `pl-${period}.md`);
    fs.writeFileSync(plFilePath, plMarkdown, 'utf-8');
    logger.info(`P&L report saved to ${plFilePath}`);

    // 2. Client profitability
    const clients = await fetchClientData();
    const invoices = await fetchInvoices(period);
    const expenses = await fetchExpenses(period);
    const clientPLs = await analyzeClientProfitability(clients, invoices, expenses);
    const ranked = rankByProfitability(clientPLs);
    const byIndustry = analyzeByDimension(clientPLs, 'industry');
    const byService = analyzeByDimension(clientPLs, 'service');

    // 3. Unit economics
    const unitEconomics = await computeUnitEconomics();

    // 4. Budget vs actual
    const budgetComparison = await analyzeBudgetVsActual(period);

    // 5. Margin alerts
    const { alerts } = await checkMargins();

    // 6. Calculate and sync KPIs
    const kpis = await calculateKPIs(clients, invoices, expenses);
    await syncKPIsToDashboard(kpis, period);

    // 7. Cash flow projection
    const cashFlowProjection = await projectCashFlow();

    // 8. Generate AI executive summary
    const summaryPrompt = `Analyze this financial data and provide a concise executive summary in 3-4 paragraphs:

P&L Summary:
- Revenue: CHF ${pl.revenue.total}
- Gross Margin: ${pl.grossMarginPct}%
- Net Income: CHF ${pl.netIncome}
- EBITDA: CHF ${pl.ebitda}

Top 3 Clients by Profit: ${ranked.slice(0, 3).map(c => `${c.client} (${c.margin}%)`).join(', ')}
Bottom 3 Clients by Margin: ${ranked.slice(-3).map(c => `${c.client} (${c.margin}%)`).join(', ')}

KPIs:
- MRR: CHF ${kpis.mrr}
- ARR: CHF ${kpis.arr}
- CAC: CHF ${kpis.cac}
- LTV: CHF ${kpis.ltv}
- LTV/CAC: ${kpis.ltvCacRatio}x
- Churn: ${kpis.churnRate}%

Cash Flow:
- Current Balance: CHF ${cashFlowProjection.currentBalance}
- 3-Month Projection: ${cashFlowProjection.projections.map(p => `${p.month}: CHF ${p.projectedBalance}`).join(', ')}

Unit Economics:
- CAC: CHF ${unitEconomics.cac}
- LTV: CHF ${unitEconomics.ltv}
- LTV/CAC: ${unitEconomics.ltvCacRatio}x
- Churn: ${unitEconomics.churnRate}%

Margin Alerts: ${alerts.length} client(s) below ${MARGIN_THRESHOLD}%

Provide actionable insights for a Swiss AI startup CEO.`;

    const summary = await generateText(summaryPrompt, {
      system: 'You are a financial controller for a Swiss AI startup. Provide concise, actionable financial analysis.',
      model: config.models.standard,
    });

    // 9. Build full report
    const fullReport = `${plMarkdown}

---

# KPI Dashboard

| Metric | Value |
|--------|-------|
| MRR | CHF ${kpis.mrr.toLocaleString('de-CH')} |
| ARR | CHF ${kpis.arr.toLocaleString('de-CH')} |
| Churn Rate | ${kpis.churnRate}% |
| LTV | CHF ${kpis.ltv.toLocaleString('de-CH')} |
| CAC | CHF ${kpis.cac.toLocaleString('de-CH')} |
| LTV/CAC Ratio | ${kpis.ltvCacRatio}x |
| Total Customers | ${kpis.totalCustomers} |
| Active Customers | ${kpis.activeCustomers} |

## Revenue by Branche

| Branche | Revenue (CHF) | Clients |
|---------|---------------|---------|
${Object.entries(kpis.revenueByBranche).map(([branche, data]) =>
  `| ${branche} | ${data.revenue.toLocaleString('de-CH')} | ${data.clients} |`
).join('\n')}

## Revenue by Kanton

| Kanton | Revenue (CHF) | Clients |
|--------|---------------|---------|
${Object.entries(kpis.revenueByKanton).map(([kanton, data]) =>
  `| ${kanton} | ${data.revenue.toLocaleString('de-CH')} | ${data.clients} |`
).join('\n')}

# Cash Flow Projection (3 Months)

| Month | Expected Inflows | Expected Outflows | Projected Balance |
|-------|------------------|-------------------|-------------------|
${cashFlowProjection.projections.map(p =>
  `| ${p.month} | CHF ${p.expectedInflows.toLocaleString('de-CH')} | CHF ${p.expectedOutflows.toLocaleString('de-CH')} | CHF ${p.projectedBalance.toLocaleString('de-CH')} |`
).join('\n')}

**Current Balance:** CHF ${cashFlowProjection.currentBalance.toLocaleString('de-CH')}

---

${plMarkdown.replace(/^#.*\n/, '')}

---

# Client Profitability Ranking

| Rank | Client | Revenue (CHF) | Margin | Status |
|------|--------|---------------|--------|--------|
${ranked.slice(0, 10).map(c =>
  `| ${c.rank} | ${c.client} | ${c.revenue.toLocaleString('de-CH')} | ${c.margin}% | ${c.isHealthy ? 'Healthy' : 'Alert'} |`
).join('\n')}

# Profitability by Industry

| Industry | Revenue (CHF) | Profit (CHF) | Margin | Clients |
|----------|---------------|--------------|--------|---------|
${byIndustry.map(g =>
  `| ${g.name} | ${g.revenue.toLocaleString('de-CH')} | ${g.profit.toLocaleString('de-CH')} | ${g.margin}% | ${g.clientCount} |`
).join('\n')}

# Profitability by Service Type

| Service | Revenue (CHF) | Profit (CHF) | Margin | Clients |
|---------|---------------|--------------|--------|---------|
${byService.map(g =>
  `| ${g.name} | ${g.revenue.toLocaleString('de-CH')} | ${g.profit.toLocaleString('de-CH')} | ${g.margin}% | ${g.clientCount} |`
).join('\n')}

# Unit Economics

| Metric | Value |
|--------|-------|
| Cost per Lead | CHF ${unitEconomics.costPerLead} |
| Conversion Rate | ${unitEconomics.conversionRate}% |
| CAC | CHF ${unitEconomics.cac} |
| LTV | CHF ${unitEconomics.ltv} |
| LTV/CAC Ratio | ${unitEconomics.ltvCacRatio}x |
| Monthly Churn | ${unitEconomics.churnRate}% |

# Executive Summary

${summary}

---
*Report generated by Werkpilot Controlling Agent on ${new Date().toISOString()}*
`;

    // Save full report
    const reportPath = path.join(REPORTS_DIR, `controlling-report-${period}.md`);
    fs.writeFileSync(reportPath, fullReport, 'utf-8');
    logger.info(`Full controlling report saved to ${reportPath}`);

    // Store in Airtable
    try {
      await createRecord('Reports', {
        Type: 'Controlling',
        Period: period,
        Revenue: pl.revenue.total,
        GrossMargin: pl.grossMarginPct,
        NetIncome: pl.netIncome,
        EBITDA: pl.ebitda,
        AlertCount: alerts.length,
        GeneratedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Failed to store report in Airtable: ${error.message}`);
    }

    // Email summary to CEO
    await sendCEOEmail({
      subject: `Monthly Controlling Report - ${period}`,
      html: `
        <h2>Monthly Controlling Report - ${period}</h2>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
          <tr><td><strong>Revenue</strong></td><td>CHF ${pl.revenue.total.toLocaleString('de-CH')}</td></tr>
          <tr><td><strong>Gross Margin</strong></td><td>${pl.grossMarginPct}%</td></tr>
          <tr><td><strong>EBITDA</strong></td><td>CHF ${pl.ebitda.toLocaleString('de-CH')}</td></tr>
          <tr><td><strong>Net Income</strong></td><td>CHF ${pl.netIncome.toLocaleString('de-CH')}</td></tr>
          <tr><td><strong>Margin Alerts</strong></td><td>${alerts.length} client(s)</td></tr>
        </table>
        <h3>Executive Summary</h3>
        <p>${summary.replace(/\n/g, '<br>')}</p>
        <p style="color: #999; font-size: 12px;">
          Full report saved to: ${reportPath}
        </p>
      `,
    });

    logger.info('Controlling report completed and sent');

    return {
      period,
      pl,
      clientPLs: ranked,
      unitEconomics,
      budgetComparison,
      alerts,
      kpis,
      cashFlowProjection,
      reportPath,
    };

  } catch (error) {
    logger.error(`Controlling report failed: ${error.message}`, { stack: error.stack });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function startScheduler() {
  // Full controlling report: daily at 06:00
  cron.schedule('0 6 * * *', async () => {
    logger.info('Scheduled: Daily controlling report');
    try {
      await generateControllingReport();
    } catch (error) {
      logger.error(`Scheduled controlling report failed: ${error.message}`);
    }
  });

  // Margin check: every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    logger.info('Scheduled: Margin check');
    try {
      await checkMargins();
    } catch (error) {
      logger.error(`Scheduled margin check failed: ${error.message}`);
    }
  });

  logger.info('Controlling Agent scheduler started');
  logger.info('  - Full report: daily at 06:00');
  logger.info('  - Margin check: every 4 hours');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  logger.info('Controlling Agent starting...');

  if (process.argv.includes('--once')) {
    await generateControllingReport();
  } else if (process.argv.includes('--margins')) {
    await checkMargins();
  } else if (process.argv.includes('--unit-economics')) {
    const economics = await computeUnitEconomics();
    console.log(JSON.stringify(economics, null, 2));
  } else {
    startScheduler();
  }
}

main().catch(error => {
  logger.error(`Controlling Agent fatal error: ${error.message}`, { stack: error.stack });
  process.exit(1);
});

module.exports = {
  generateControllingReport,
  checkMargins,
  computeUnitEconomics,
  analyzeClientProfitability,
  analyzeBudgetVsActual,
  generateMonthlyPL,
  calculateKPIs,
  syncKPIsToDashboard,
  projectCashFlow,
  startScheduler,
};
