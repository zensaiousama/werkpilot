/**
 * Cash Flow Projection Model
 * Werkpilot Finance Department - Agent 25 Support Module
 *
 * Provides 30/60/90 day cash flow projections,
 * runway calculations, and burn rate analysis.
 */

'use strict';

/**
 * Calculate current cash position
 */
function calculateCashPosition(data) {
  const {
    bankBalance,
    accountsReceivable,
    accountsPayable,
    pendingInvoices,
    upcomingExpenses,
  } = data;

  return {
    bankBalance,
    accountsReceivable,
    accountsPayable,
    netWorkingCapital: bankBalance + accountsReceivable - accountsPayable,
    pendingInflows: pendingInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
    pendingOutflows: upcomingExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0),
  };
}

/**
 * Project cash flow for N days
 */
function projectCashFlow(startingBalance, projectionDays, inflows, outflows, recurring) {
  const daily = [];
  let balance = startingBalance;

  const today = new Date();

  for (let day = 0; day < projectionDays; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfMonth = date.getDate();

    let dayInflows = 0;
    let dayOutflows = 0;

    // One-time inflows (expected payments, invoices)
    for (const inflow of inflows) {
      if (inflow.expectedDate === dateStr) {
        dayInflows += inflow.amount || 0;
      }
    }

    // One-time outflows (bills, payments due)
    for (const outflow of outflows) {
      if (outflow.dueDate === dateStr) {
        dayOutflows += outflow.amount || 0;
      }
    }

    // Recurring items (salaries on 25th, rent on 1st, subscriptions, etc.)
    for (const item of recurring) {
      if (item.dayOfMonth === dayOfMonth) {
        if (item.type === 'inflow') {
          dayInflows += item.amount || 0;
        } else {
          dayOutflows += item.amount || 0;
        }
      }
    }

    balance = balance + dayInflows - dayOutflows;

    daily.push({
      date: dateStr,
      day: day + 1,
      inflows: Math.round(dayInflows * 100) / 100,
      outflows: Math.round(dayOutflows * 100) / 100,
      netCashFlow: Math.round((dayInflows - dayOutflows) * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }

  return daily;
}

/**
 * Generate 30/60/90 day cash flow summary
 */
function cashFlowSummary(dailyProjection) {
  const periods = [30, 60, 90];
  const summaries = {};

  for (const period of periods) {
    const slice = dailyProjection.slice(0, period);
    if (slice.length === 0) continue;

    const totalInflows = slice.reduce((sum, d) => sum + d.inflows, 0);
    const totalOutflows = slice.reduce((sum, d) => sum + d.outflows, 0);
    const endingBalance = slice[slice.length - 1].balance;
    const lowestBalance = Math.min(...slice.map(d => d.balance));
    const lowestDay = slice.find(d => d.balance === lowestBalance);

    summaries[`${period}day`] = {
      period: `${period} days`,
      totalInflows: Math.round(totalInflows * 100) / 100,
      totalOutflows: Math.round(totalOutflows * 100) / 100,
      netCashFlow: Math.round((totalInflows - totalOutflows) * 100) / 100,
      endingBalance: Math.round(endingBalance * 100) / 100,
      lowestBalance: Math.round(lowestBalance * 100) / 100,
      lowestBalanceDate: lowestDay ? lowestDay.date : null,
      isNegative: lowestBalance < 0,
    };
  }

  return summaries;
}

/**
 * Calculate monthly burn rate
 */
function calculateBurnRate(monthlyExpenses, monthlyRevenue) {
  const grossBurn = monthlyExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalRevenue = monthlyRevenue.reduce((sum, rev) => sum + (rev.amount || 0), 0);
  const netBurn = grossBurn - totalRevenue;

  return {
    grossBurn: Math.round(grossBurn * 100) / 100,
    revenue: Math.round(totalRevenue * 100) / 100,
    netBurn: Math.round(netBurn * 100) / 100,
    isProfitable: netBurn <= 0,
  };
}

/**
 * Calculate runway in months
 */
function calculateRunway(cashBalance, burnRate) {
  if (burnRate.netBurn <= 0) {
    return {
      months: Infinity,
      status: 'profitable',
      message: 'Company is cash-flow positive - infinite runway',
    };
  }

  const months = cashBalance / burnRate.netBurn;
  let status = 'healthy';
  if (months < 6) status = 'critical';
  else if (months < 12) status = 'warning';
  else if (months < 18) status = 'moderate';

  return {
    months: Math.round(months * 10) / 10,
    status,
    cashOutDate: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() + Math.floor(months));
      return date.toISOString().split('T')[0];
    })(),
    message: `${Math.round(months * 10) / 10} months of runway at current burn rate`,
  };
}

/**
 * Categorize expenses by type for burn analysis
 */
function categorizeExpenses(expenses) {
  const categories = {
    fixed: { items: [], total: 0 },
    variable: { items: [], total: 0 },
    discretionary: { items: [], total: 0 },
  };

  const fixedCategories = ['rent', 'salaries', 'insurance', 'subscriptions', 'loan'];
  const variableCategories = ['api', 'hosting', 'infrastructure', 'freelancer', 'cloud'];

  for (const exp of expenses) {
    const cat = (exp.category || '').toLowerCase();

    if (fixedCategories.some(f => cat.includes(f))) {
      categories.fixed.items.push(exp);
      categories.fixed.total += exp.amount || 0;
    } else if (variableCategories.some(v => cat.includes(v))) {
      categories.variable.items.push(exp);
      categories.variable.total += exp.amount || 0;
    } else {
      categories.discretionary.items.push(exp);
      categories.discretionary.total += exp.amount || 0;
    }
  }

  return categories;
}

/**
 * Generate cash flow report as Markdown
 */
function cashFlowToMarkdown(summary, burnRate, runway) {
  const fmt = (val) => `CHF ${val.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  let md = `# Cash Flow Projection Report

*Generated: ${new Date().toISOString().split('T')[0]}*

## Summary

| Metric | Value |
|--------|-------|
| Monthly Gross Burn | ${fmt(burnRate.grossBurn)} |
| Monthly Revenue | ${fmt(burnRate.revenue)} |
| Monthly Net Burn | ${fmt(burnRate.netBurn)} |
| Profitable | ${burnRate.isProfitable ? 'Yes' : 'No'} |
| Runway | ${runway.message} |

## Cash Flow Projections

| Period | Inflows | Outflows | Net | Ending Balance | Lowest Point |
|--------|---------|----------|-----|----------------|--------------|
`;

  for (const [key, period] of Object.entries(summary)) {
    md += `| ${period.period} | ${fmt(period.totalInflows)} | ${fmt(period.totalOutflows)} | ${fmt(period.netCashFlow)} | ${fmt(period.endingBalance)} | ${fmt(period.lowestBalance)} |\n`;
  }

  if (Object.values(summary).some(s => s.isNegative)) {
    md += `\n**WARNING: Cash balance projected to go negative. Immediate action required.**\n`;
  }

  return md;
}

module.exports = {
  calculateCashPosition,
  projectCashFlow,
  cashFlowSummary,
  calculateBurnRate,
  calculateRunway,
  categorizeExpenses,
  cashFlowToMarkdown,
};
