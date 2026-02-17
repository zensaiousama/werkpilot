/**
 * P&L Calculation Functions
 * Werkpilot Finance Department - Agent 24 Support Module
 *
 * Provides profit & loss calculation, unit economics,
 * margin analysis, and budget vs actual tracking.
 */

'use strict';

/**
 * Calculate revenue breakdown by client/service/industry
 */
function calculateRevenue(invoices, groupBy = 'client') {
  const grouped = {};

  for (const inv of invoices) {
    const key = inv[groupBy] || 'Unknown';
    if (!grouped[key]) {
      grouped[key] = { total: 0, count: 0, invoices: [] };
    }
    grouped[key].total += inv.amount || 0;
    grouped[key].count += 1;
    grouped[key].invoices.push(inv);
  }

  return grouped;
}

/**
 * Calculate COGS (Cost of Goods Sold) - primarily API costs for Werkpilot
 */
function calculateCOGS(expenses, period) {
  const cogs = {
    apiCosts: 0,
    infrastructureCosts: 0,
    thirdPartyTools: 0,
    directLabor: 0,
    total: 0,
  };

  for (const exp of expenses) {
    if (period && exp.period !== period) continue;

    switch (exp.category) {
      case 'api':
      case 'anthropic':
      case 'openai':
      case 'deepl':
        cogs.apiCosts += exp.amount || 0;
        break;
      case 'infrastructure':
      case 'hosting':
      case 'cloud':
        cogs.infrastructureCosts += exp.amount || 0;
        break;
      case 'tools':
      case 'saas':
        cogs.thirdPartyTools += exp.amount || 0;
        break;
      case 'labor':
      case 'freelancer':
        cogs.directLabor += exp.amount || 0;
        break;
      default:
        cogs.thirdPartyTools += exp.amount || 0;
    }
  }

  cogs.total = cogs.apiCosts + cogs.infrastructureCosts + cogs.thirdPartyTools + cogs.directLabor;
  return cogs;
}

/**
 * Calculate gross and net margins
 */
function calculateMargins(revenue, cogs, opex) {
  const grossProfit = revenue - cogs;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netProfit = grossProfit - opex;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    revenue,
    cogs,
    grossProfit,
    grossMargin: Math.round(grossMargin * 100) / 100,
    opex,
    netProfit,
    netMargin: Math.round(netMargin * 100) / 100,
  };
}

/**
 * Calculate per-client P&L
 */
function calculateClientPL(clientData) {
  const { revenue, apiCosts, directCosts, allocatedOverhead } = clientData;
  const totalCosts = apiCosts + directCosts + allocatedOverhead;
  const profit = revenue - totalCosts;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return {
    client: clientData.name,
    revenue,
    apiCosts,
    directCosts,
    allocatedOverhead,
    totalCosts,
    profit,
    margin: Math.round(margin * 100) / 100,
    isHealthy: margin >= 80,
  };
}

/**
 * Calculate unit economics
 */
function calculateUnitEconomics(data) {
  const {
    totalMarketingSpend,
    totalLeads,
    totalCustomers,
    totalRevenue,
    avgCustomerLifespanMonths,
    totalChurnedCustomers,
    monthsInPeriod,
  } = data;

  const costPerLead = totalLeads > 0 ? totalMarketingSpend / totalLeads : 0;
  const conversionRate = totalLeads > 0 ? (totalCustomers / totalLeads) * 100 : 0;
  const cac = totalCustomers > 0 ? totalMarketingSpend / totalCustomers : 0;
  const avgRevenuePerCustomer = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const monthlyRevenuePerCustomer = monthsInPeriod > 0 ? avgRevenuePerCustomer / monthsInPeriod : 0;
  const ltv = monthlyRevenuePerCustomer * avgCustomerLifespanMonths;
  const ltvCacRatio = cac > 0 ? ltv / cac : 0;
  const churnRate = totalCustomers > 0
    ? (totalChurnedCustomers / totalCustomers) * 100
    : 0;

  return {
    costPerLead: Math.round(costPerLead * 100) / 100,
    conversionRate: Math.round(conversionRate * 100) / 100,
    cac: Math.round(cac * 100) / 100,
    avgRevenuePerCustomer: Math.round(avgRevenuePerCustomer * 100) / 100,
    monthlyRevenuePerCustomer: Math.round(monthlyRevenuePerCustomer * 100) / 100,
    ltv: Math.round(ltv * 100) / 100,
    ltvCacRatio: Math.round(ltvCacRatio * 100) / 100,
    churnRate: Math.round(churnRate * 100) / 100,
  };
}

/**
 * Generate full P&L statement data structure
 */
function generatePLStatement(data) {
  const { period, revenue, cogs, operatingExpenses } = data;

  const grossProfit = revenue.total - cogs.total;
  const grossMarginPct = revenue.total > 0 ? (grossProfit / revenue.total) * 100 : 0;

  const totalOpex = Object.values(operatingExpenses).reduce((sum, val) => sum + val, 0);
  const ebitda = grossProfit - totalOpex;
  const ebitdaMarginPct = revenue.total > 0 ? (ebitda / revenue.total) * 100 : 0;

  const depreciation = data.depreciation || 0;
  const interest = data.interest || 0;
  const taxes = data.taxes || 0;

  const ebit = ebitda - depreciation;
  const ebt = ebit - interest;
  const netIncome = ebt - taxes;
  const netMarginPct = revenue.total > 0 ? (netIncome / revenue.total) * 100 : 0;

  return {
    period,
    revenue: {
      services: revenue.services || 0,
      subscriptions: revenue.subscriptions || 0,
      consulting: revenue.consulting || 0,
      other: revenue.other || 0,
      total: revenue.total,
    },
    cogs: {
      apiCosts: cogs.apiCosts || 0,
      infrastructure: cogs.infrastructureCosts || 0,
      thirdParty: cogs.thirdPartyTools || 0,
      directLabor: cogs.directLabor || 0,
      total: cogs.total,
    },
    grossProfit,
    grossMarginPct: Math.round(grossMarginPct * 100) / 100,
    operatingExpenses: {
      salaries: operatingExpenses.salaries || 0,
      marketing: operatingExpenses.marketing || 0,
      office: operatingExpenses.office || 0,
      software: operatingExpenses.software || 0,
      professional: operatingExpenses.professional || 0,
      other: operatingExpenses.other || 0,
      total: totalOpex,
    },
    ebitda,
    ebitdaMarginPct: Math.round(ebitdaMarginPct * 100) / 100,
    depreciation,
    ebit,
    interest,
    ebt,
    taxes,
    netIncome,
    netMarginPct: Math.round(netMarginPct * 100) / 100,
  };
}

/**
 * Compare budget vs actual
 */
function budgetVsActual(budget, actual) {
  const comparison = {};

  const allKeys = new Set([...Object.keys(budget), ...Object.keys(actual)]);

  for (const key of allKeys) {
    const budgetVal = budget[key] || 0;
    const actualVal = actual[key] || 0;
    const variance = actualVal - budgetVal;
    const variancePct = budgetVal !== 0 ? (variance / Math.abs(budgetVal)) * 100 : 0;

    comparison[key] = {
      budget: budgetVal,
      actual: actualVal,
      variance,
      variancePct: Math.round(variancePct * 100) / 100,
      status: Math.abs(variancePct) <= 5 ? 'on-track' : variancePct > 5 ? 'over-budget' : 'under-budget',
    };
  }

  return comparison;
}

/**
 * Find margin alerts (clients/services below threshold)
 */
function findMarginAlerts(clientPLs, threshold = 80) {
  return clientPLs
    .filter(pl => pl.margin < threshold)
    .map(pl => ({
      client: pl.client,
      margin: pl.margin,
      revenue: pl.revenue,
      severity: pl.margin < 50 ? 'critical' : pl.margin < threshold ? 'warning' : 'ok',
      message: `${pl.client}: margin at ${pl.margin}% (threshold: ${threshold}%)`,
    }))
    .sort((a, b) => a.margin - b.margin);
}

/**
 * Rank by profitability
 */
function rankByProfitability(clientPLs) {
  return [...clientPLs]
    .sort((a, b) => b.profit - a.profit)
    .map((pl, index) => ({
      rank: index + 1,
      ...pl,
    }));
}

/**
 * Generate P&L as Markdown
 */
function plToMarkdown(pl) {
  const fmt = (val) => `CHF ${val.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pct = (val) => `${val.toFixed(1)}%`;

  return `# Profit & Loss Statement - ${pl.period}

## Revenue
| Category | Amount |
|----------|--------|
| Services | ${fmt(pl.revenue.services)} |
| Subscriptions | ${fmt(pl.revenue.subscriptions)} |
| Consulting | ${fmt(pl.revenue.consulting)} |
| Other | ${fmt(pl.revenue.other)} |
| **Total Revenue** | **${fmt(pl.revenue.total)}** |

## Cost of Goods Sold
| Category | Amount |
|----------|--------|
| API Costs (Claude, OpenAI, DeepL) | ${fmt(pl.cogs.apiCosts)} |
| Infrastructure | ${fmt(pl.cogs.infrastructure)} |
| Third-Party Tools | ${fmt(pl.cogs.thirdParty)} |
| Direct Labor | ${fmt(pl.cogs.directLabor)} |
| **Total COGS** | **${fmt(pl.cogs.total)}** |

## Gross Profit: ${fmt(pl.grossProfit)} (${pct(pl.grossMarginPct)})

## Operating Expenses
| Category | Amount |
|----------|--------|
| Salaries & Benefits | ${fmt(pl.operatingExpenses.salaries)} |
| Marketing | ${fmt(pl.operatingExpenses.marketing)} |
| Office & Rent | ${fmt(pl.operatingExpenses.office)} |
| Software & Tools | ${fmt(pl.operatingExpenses.software)} |
| Professional Services | ${fmt(pl.operatingExpenses.professional)} |
| Other | ${fmt(pl.operatingExpenses.other)} |
| **Total OpEx** | **${fmt(pl.operatingExpenses.total)}** |

## EBITDA: ${fmt(pl.ebitda)} (${pct(pl.ebitdaMarginPct)})
## Depreciation: ${fmt(pl.depreciation)}
## EBIT: ${fmt(pl.ebit)}
## Interest: ${fmt(pl.interest)}
## EBT: ${fmt(pl.ebt)}
## Taxes: ${fmt(pl.taxes)}

---
## **Net Income: ${fmt(pl.netIncome)} (${pct(pl.netMarginPct)})**

*Generated by Werkpilot Controlling Agent on ${new Date().toISOString().split('T')[0]}*
`;
}

module.exports = {
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
};
