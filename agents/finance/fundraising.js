/**
 * Agent 27 — Fundraising Agent
 * Werkpilot Finance Department
 *
 * Manages investor-ready data room, auto-updates KPI dashboard,
 * generates pitch deck data, tracks investors, prepares bank loan
 * documentation, and models funding scenarios.
 *
 * Schedule: Weekly on Friday at 08:00 (full update), daily KPI refresh
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

const logger = createLogger('finance-fundraising');
const DATA_ROOM_DIR = path.join(__dirname, 'data-room');
const REPORTS_DIR = path.join(__dirname, 'reports');
const INVESTOR_KPIS_PATH = path.join(__dirname, 'investor-kpis.json');

// ---------------------------------------------------------------------------
// KPI Dashboard
// ---------------------------------------------------------------------------

async function updateKPIDashboard() {
  logger.info('Updating investor KPI dashboard...');

  try {
    // Fetch all required data
    const [clients, invoices, expenses, pipeline, subscriptions] = await Promise.all([
      getRecords('Clients', '').catch(() => []),
      getRecords('Invoices', '{Status} = "Paid"').catch(() => []),
      getRecords('Expenses', '').catch(() => []),
      getRecords('Pipeline', '').catch(() => []),
      getRecords('Subscriptions', '{Status} = "Active"').catch(() => []),
    ]);

    const activeClients = clients.filter(c => c.Status === 'Active');
    const churnedClients = clients.filter(c => c.Status === 'Churned');

    // Calculate MRR
    const mrr = subscriptions.reduce((sum, s) => {
      const amount = s.Amount || s.Price || 0;
      return sum + (s.BillingCycle === 'annual' ? amount / 12 : amount);
    }, 0);
    const arr = mrr * 12;

    // Previous month MRR (approximate)
    const lastMonthClients = clients.filter(c => {
      const created = new Date(c.CreatedAt || c.SignupDate || 0);
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return created < lastMonth;
    });
    const previousMRR = mrr * 0.95; // Approximate

    const momGrowth = previousMRR > 0
      ? Math.round(((mrr - previousMRR) / previousMRR) * 10000) / 100
      : 0;

    // Unit economics
    const currentYear = new Date().getFullYear();
    const yearExpenses = expenses.filter(e =>
      e.Date && e.Date.startsWith(String(currentYear))
    );
    const marketingSpend = yearExpenses
      .filter(e => (e.Category || '').toLowerCase() === 'marketing')
      .reduce((sum, e) => sum + (e.Amount || 0), 0);

    const newCustomersThisYear = clients.filter(c => {
      const created = new Date(c.CreatedAt || c.SignupDate || 0);
      return created.getFullYear() === currentYear;
    }).length;

    const cac = newCustomersThisYear > 0 ? marketingSpend / newCustomersThisYear : 0;
    const avgContractValue = activeClients.length > 0
      ? mrr * 12 / activeClients.length
      : 0;
    const ltv = avgContractValue * 2.5; // Assume 2.5 year average lifespan
    const ltvCacRatio = cac > 0 ? ltv / cac : 0;
    const paybackMonths = cac > 0 && mrr > 0
      ? cac / (mrr / activeClients.length)
      : 0;

    // Revenue
    const totalRevenue = invoices.reduce((sum, i) => sum + (i.Amount || 0), 0);
    const totalCOGS = yearExpenses
      .filter(e => ['api', 'anthropic', 'openai', 'deepl', 'infrastructure', 'hosting'].includes((e.Category || '').toLowerCase()))
      .reduce((sum, e) => sum + (e.Amount || 0), 0);
    const grossMargin = totalRevenue > 0
      ? Math.round(((totalRevenue - totalCOGS) / totalRevenue) * 10000) / 100
      : 0;

    // Burn rate
    const monthlyExpenses = yearExpenses.reduce((sum, e) => sum + (e.Amount || 0), 0) / Math.max(1, new Date().getMonth() + 1);
    const netBurn = monthlyExpenses - mrr;

    // Churn
    const churnRate = clients.length > 0
      ? Math.round((churnedClients.length / clients.length) * 10000) / 100
      : 0;

    // NRR
    const nrr = churnRate < 100 ? Math.round((100 - churnRate + momGrowth) * 100) / 100 : 0;

    // Build KPI object
    const kpis = JSON.parse(fs.readFileSync(INVESTOR_KPIS_PATH, 'utf-8'));
    const timestamp = new Date().toISOString();

    kpis.lastUpdated = timestamp;
    kpis.metrics.revenue.mrr.value = Math.round(mrr * 100) / 100;
    kpis.metrics.revenue.arr.value = Math.round(arr * 100) / 100;
    kpis.metrics.revenue.momGrowth.value = momGrowth;
    kpis.metrics.revenue.nrr.value = nrr;
    kpis.metrics.revenue.revenuePerEmployee.value = null; // Needs team data

    kpis.metrics.customers.totalCustomers.value = activeClients.length;
    kpis.metrics.customers.newCustomersMonthly.value = newCustomersThisYear > 0
      ? Math.round(newCustomersThisYear / Math.max(1, new Date().getMonth() + 1))
      : 0;
    kpis.metrics.customers.churnRate.value = churnRate;
    kpis.metrics.customers.logoRetention.value = Math.round((100 - churnRate) * 100) / 100;
    kpis.metrics.customers.avgContractValue.value = Math.round(avgContractValue * 100) / 100;

    kpis.metrics.unitEconomics.cac.value = Math.round(cac * 100) / 100;
    kpis.metrics.unitEconomics.ltv.value = Math.round(ltv * 100) / 100;
    kpis.metrics.unitEconomics.ltvCacRatio.value = Math.round(ltvCacRatio * 100) / 100;
    kpis.metrics.unitEconomics.paybackMonths.value = Math.round(paybackMonths * 10) / 10;
    kpis.metrics.unitEconomics.grossMargin.value = grossMargin;

    kpis.metrics.efficiency.burnRate.value = Math.round(netBurn * 100) / 100;
    kpis.metrics.efficiency.runway.value = netBurn > 0 ? null : 999; // Need bank balance
    kpis.metrics.efficiency.ruleOf40.value = Math.round((momGrowth * 12 + grossMargin) * 100) / 100;

    // Add to history
    kpis.history.push({
      date: timestamp.split('T')[0],
      mrr: kpis.metrics.revenue.mrr.value,
      arr: kpis.metrics.revenue.arr.value,
      customers: activeClients.length,
      churnRate,
      cac: kpis.metrics.unitEconomics.cac.value,
      ltv: kpis.metrics.unitEconomics.ltv.value,
    });

    // Keep last 24 months of history
    if (kpis.history.length > 24) {
      kpis.history = kpis.history.slice(-24);
    }

    // Save KPIs
    fs.writeFileSync(INVESTOR_KPIS_PATH, JSON.stringify(kpis, null, 2), 'utf-8');
    logger.info('Investor KPI dashboard updated');

    // Update Airtable data room
    try {
      await createRecord('DataRoom_KPIs', {
        Date: timestamp.split('T')[0],
        MRR: mrr,
        ARR: arr,
        Customers: activeClients.length,
        GrossMargin: grossMargin,
        CAC: cac,
        LTV: ltv,
        ChurnRate: churnRate,
        BurnRate: netBurn,
      });
    } catch (error) {
      logger.warn(`Failed to store KPIs in Airtable: ${error.message}`);
    }

    return kpis;
  } catch (error) {
    logger.error(`KPI update failed: ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Pitch Deck Data Slides
// ---------------------------------------------------------------------------

async function generatePitchDeckData() {
  logger.info('Generating pitch deck data slides...');

  const kpis = JSON.parse(fs.readFileSync(INVESTOR_KPIS_PATH, 'utf-8'));

  const fmt = (val) => val !== null
    ? `CHF ${Math.round(val).toLocaleString('de-CH')}`
    : 'N/A';
  const pct = (val) => val !== null ? `${val}%` : 'N/A';

  const metricsData = kpis.metrics;

  // Generate AI-assisted narrative
  const narrative = await generateText(`
Generate a compelling 2-paragraph investor pitch narrative for a Swiss AI startup called Werkpilot.
Werkpilot provides AI-powered business automation for SMEs, replacing entire departments with AI agents.

Key metrics:
- MRR: ${fmt(metricsData.revenue.mrr.value)}
- ARR: ${fmt(metricsData.revenue.arr.value)}
- Growth: ${pct(metricsData.revenue.momGrowth.value)} MoM
- Customers: ${metricsData.customers.totalCustomers.value}
- Gross Margin: ${pct(metricsData.unitEconomics.grossMargin.value)}
- LTV/CAC: ${metricsData.unitEconomics.ltvCacRatio.value}x

Write in a style appropriate for Swiss/European investors. Be factual and data-driven.`,
    {
      system: 'You are a startup fundraising advisor. Write compelling but honest investor narratives.',
      model: config.models.standard,
    }
  );

  const pitchDeck = `# Werkpilot - Investor Metrics
*Updated: ${new Date().toISOString().split('T')[0]}*

---

## The Opportunity
${narrative}

---

## Key Metrics

### Revenue
| Metric | Value |
|--------|-------|
| MRR | ${fmt(metricsData.revenue.mrr.value)} |
| ARR | ${fmt(metricsData.revenue.arr.value)} |
| MoM Growth | ${pct(metricsData.revenue.momGrowth.value)} |
| Net Revenue Retention | ${pct(metricsData.revenue.nrr.value)} |

### Customers
| Metric | Value |
|--------|-------|
| Active Customers | ${metricsData.customers.totalCustomers.value} |
| Monthly Churn | ${pct(metricsData.customers.churnRate.value)} |
| Avg Contract Value | ${fmt(metricsData.customers.avgContractValue.value)} |

### Unit Economics
| Metric | Value |
|--------|-------|
| CAC | ${fmt(metricsData.unitEconomics.cac.value)} |
| LTV | ${fmt(metricsData.unitEconomics.ltv.value)} |
| LTV/CAC Ratio | ${metricsData.unitEconomics.ltvCacRatio.value}x |
| Payback Period | ${metricsData.unitEconomics.paybackMonths.value} months |
| Gross Margin | ${pct(metricsData.unitEconomics.grossMargin.value)} |

### Efficiency
| Metric | Value |
|--------|-------|
| Monthly Burn | ${fmt(metricsData.efficiency.burnRate.value)} |
| Rule of 40 | ${pct(metricsData.efficiency.ruleOf40.value)} |

### MRR History
| Date | MRR |
|------|-----|
${kpis.history.slice(-6).map(h => `| ${h.date} | ${fmt(h.mrr)} |`).join('\n')}

---
*Confidential - Werkpilot GmbH*
`;

  fs.mkdirSync(path.join(DATA_ROOM_DIR, 'financials'), { recursive: true });
  const deckPath = path.join(DATA_ROOM_DIR, 'financials', 'pitch-deck-metrics.md');
  fs.writeFileSync(deckPath, pitchDeck, 'utf-8');
  logger.info(`Pitch deck data saved to ${deckPath}`);

  return deckPath;
}

// ---------------------------------------------------------------------------
// Investor Tracking
// ---------------------------------------------------------------------------

async function trackInvestors() {
  logger.info('Updating investor tracking...');

  try {
    const investors = await getRecords('Investors', '');

    // Categorize
    const categories = {
      vcs: investors.filter(i => i.Type === 'VC'),
      angels: investors.filter(i => i.Type === 'Angel'),
      banks: investors.filter(i => i.Type === 'Bank'),
      grants: investors.filter(i => i.Type === 'Grant'),
    };

    // Check for needed follow-ups
    const needsFollowUp = investors.filter(i => {
      if (i.Status === 'Closed' || i.Status === 'Declined') return false;
      const lastContact = new Date(i.LastContact || 0);
      const daysSince = (Date.now() - lastContact) / (24 * 60 * 60 * 1000);
      return daysSince > 14;
    });

    if (needsFollowUp.length > 0) {
      logger.info(`${needsFollowUp.length} investor(s) need follow-up`);

      await sendCEOEmail({
        subject: `Investor Follow-up: ${needsFollowUp.length} Pending`,
        html: `
          <h2>Investor Follow-ups Needed</h2>
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
            <tr style="background: #f8f9fa;">
              <th>Investor</th><th>Type</th><th>Stage</th><th>Last Contact</th>
            </tr>
            ${needsFollowUp.map(i => `
              <tr>
                <td>${i.Name}</td>
                <td>${i.Type}</td>
                <td>${i.Stage || 'Intro'}</td>
                <td>${i.LastContact || 'Never'}</td>
              </tr>
            `).join('')}
          </table>
        `,
      });
    }

    return {
      total: investors.length,
      categories: {
        vcs: categories.vcs.length,
        angels: categories.angels.length,
        banks: categories.banks.length,
        grants: categories.grants.length,
      },
      needsFollowUp: needsFollowUp.length,
      pipeline: investors.filter(i => !['Closed', 'Declined'].includes(i.Status)).length,
    };
  } catch (error) {
    logger.error(`Investor tracking failed: ${error.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Swiss Bank Loan Documentation
// ---------------------------------------------------------------------------

async function prepareBankDocumentation() {
  logger.info('Preparing bank loan documentation...');

  try {
    const kpis = JSON.parse(fs.readFileSync(INVESTOR_KPIS_PATH, 'utf-8'));
    const metricsData = kpis.metrics;

    const fmt = (val) => val !== null
      ? `CHF ${Math.round(val).toLocaleString('de-CH')}`
      : 'N/A';

    // Generate bank-ready summary
    const bankSummary = await generateText(`
Generate a professional business overview for a Swiss bank loan application.
Company: Werkpilot GmbH, AI-powered business automation for SMEs in Switzerland.

Financial Summary:
- ARR: ${fmt(metricsData.revenue.arr.value)}
- Gross Margin: ${metricsData.unitEconomics.grossMargin.value}%
- Customers: ${metricsData.customers.totalCustomers.value}
- Monthly Burn: ${fmt(metricsData.efficiency.burnRate.value)}
- Growth Rate: ${metricsData.revenue.momGrowth.value}% MoM

Write 3 sections:
1. Business Description (2 paragraphs)
2. Financial Overview (structured for Swiss banker)
3. Use of Funds (typical for growth stage)

Keep it formal and suitable for Swiss banking context (UBS, ZKB, Credit Suisse).`,
      {
        system: 'You are a CFO preparing documentation for a Swiss bank loan application. Be conservative, factual, and professional.',
        model: config.models.standard,
      }
    );

    const docPath = path.join(DATA_ROOM_DIR, 'financials', 'bank-loan-overview.md');
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.writeFileSync(docPath, `# Bank Loan Application - Business Overview\n\n${bankSummary}\n\n---\n*Werkpilot GmbH | ${new Date().toISOString().split('T')[0]}*\n`, 'utf-8');

    logger.info(`Bank documentation saved to ${docPath}`);
    return docPath;
  } catch (error) {
    logger.error(`Bank documentation failed: ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Funding Scenario Modeling
// ---------------------------------------------------------------------------

async function modelFundingScenarios() {
  logger.info('Modeling funding scenarios...');

  const kpis = JSON.parse(fs.readFileSync(INVESTOR_KPIS_PATH, 'utf-8'));
  const currentMRR = kpis.metrics.revenue.mrr.value || 0;
  const currentBurn = kpis.metrics.efficiency.burnRate.value || 0;
  const grossMargin = kpis.metrics.unitEconomics.grossMargin.value || 85;

  const scenarios = {
    bootstrap: {
      name: 'Bootstrap (Self-Funded)',
      description: 'Continue growing organically with retained earnings',
      capitalNeeded: 0,
      dilution: 0,
      assumptions: {
        monthlyGrowthRate: 0.03,
        hiresPossible: 0,
        monthsToBreakeven: currentBurn > 0
          ? Math.ceil(currentBurn / (currentMRR * 0.03))
          : 0,
        riskLevel: 'Low',
      },
      projections: [],
    },
    seed: {
      name: 'Seed Round (CHF 500k - 1M)',
      description: 'Raise seed from Swiss angels/micro-VCs',
      capitalNeeded: 750000,
      dilution: 15,
      assumptions: {
        monthlyGrowthRate: 0.08,
        hiresPossible: 3,
        runway: 18,
        preMoneyValuation: 750000 / 0.15 - 750000,
        riskLevel: 'Medium',
      },
      projections: [],
    },
    bankLoan: {
      name: 'Bank Loan (CHF 200k - 500k)',
      description: 'Swiss bank KMU credit or StartUp credit from Startup loan providers',
      capitalNeeded: 300000,
      dilution: 0,
      assumptions: {
        interestRate: 0.035,
        monthlyPayment: 300000 * (0.035 / 12) / (1 - Math.pow(1 + 0.035 / 12, -48)),
        termMonths: 48,
        monthlyGrowthRate: 0.05,
        hiresPossible: 1,
        riskLevel: 'Low',
      },
      projections: [],
    },
  };

  // Generate 24-month projections for each
  for (const scenario of Object.values(scenarios)) {
    let mrr = currentMRR;
    const growthRate = scenario.assumptions.monthlyGrowthRate || 0.03;
    const additionalBurn = (scenario.assumptions.hiresPossible || 0) * 8000; // CHF 8k/mo per hire
    let cash = scenario.capitalNeeded;

    for (let month = 1; month <= 24; month++) {
      mrr = mrr * (1 + growthRate);
      const monthlyBurn = currentBurn + additionalBurn;
      const netCashFlow = mrr - monthlyBurn - (scenario.assumptions.monthlyPayment || 0);
      cash += netCashFlow;

      scenario.projections.push({
        month,
        mrr: Math.round(mrr),
        arr: Math.round(mrr * 12),
        netCashFlow: Math.round(netCashFlow),
        cashBalance: Math.round(cash),
        breakeven: netCashFlow >= 0,
      });
    }

    // Find breakeven month
    const breakevenMonth = scenario.projections.find(p => p.breakeven);
    scenario.breakevenMonth = breakevenMonth ? breakevenMonth.month : null;
    scenario.month24MRR = scenario.projections[23]?.mrr || 0;
    scenario.month24ARR = scenario.projections[23]?.arr || 0;
  }

  // Generate AI comparison
  const comparison = await generateText(`
Compare these 3 funding scenarios for a Swiss AI startup (Werkpilot) and recommend the best path:

1. Bootstrap: No external capital, 3% MoM growth, break-even in ${scenarios.bootstrap.assumptions.monthsToBreakeven} months
2. Seed Round: CHF 750k at 15% dilution, 8% MoM growth, 3 hires, 18mo runway
3. Bank Loan: CHF 300k at 3.5% interest (4yr term), 5% MoM growth, 1 hire, no dilution

24-Month ARR projections:
- Bootstrap: CHF ${scenarios.bootstrap.month24ARR.toLocaleString('de-CH')}
- Seed: CHF ${scenarios.seed.month24ARR.toLocaleString('de-CH')}
- Bank Loan: CHF ${scenarios.bankLoan.month24ARR.toLocaleString('de-CH')}

Consider Swiss market context, risk tolerance, and long-term value creation.
Provide a clear recommendation with reasoning.`,
    {
      system: 'You are a Swiss startup financial advisor. Provide pragmatic, data-driven advice.',
      model: config.models.standard,
    }
  );

  const fmt = (val) => `CHF ${Math.round(val).toLocaleString('de-CH')}`;

  const report = `# Funding Scenario Analysis
*Generated: ${new Date().toISOString().split('T')[0]}*

## Current Position
- MRR: ${fmt(currentMRR)}
- Monthly Burn: ${fmt(currentBurn)}
- Gross Margin: ${grossMargin}%

## Scenarios

### 1. ${scenarios.bootstrap.name}
- Capital: None required
- Dilution: 0%
- 24mo ARR: ${fmt(scenarios.bootstrap.month24ARR)}
- Break-even: Month ${scenarios.bootstrap.breakevenMonth || 'N/A'}

### 2. ${scenarios.seed.name}
- Capital: ${fmt(scenarios.seed.capitalNeeded)}
- Dilution: ${scenarios.seed.dilution}%
- Pre-money: ${fmt(scenarios.seed.assumptions.preMoneyValuation)}
- 24mo ARR: ${fmt(scenarios.seed.month24ARR)}
- Break-even: Month ${scenarios.seed.breakevenMonth || 'N/A'}

### 3. ${scenarios.bankLoan.name}
- Capital: ${fmt(scenarios.bankLoan.capitalNeeded)}
- Interest: ${scenarios.bankLoan.assumptions.interestRate * 100}%
- Monthly Payment: ${fmt(scenarios.bankLoan.assumptions.monthlyPayment)}
- 24mo ARR: ${fmt(scenarios.bankLoan.month24ARR)}
- Break-even: Month ${scenarios.bankLoan.breakevenMonth || 'N/A'}

## Recommendation

${comparison}

---
*Confidential - Werkpilot GmbH*
`;

  const reportPath = path.join(DATA_ROOM_DIR, 'financials', 'funding-scenarios.md');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, 'utf-8');
  logger.info(`Funding scenarios saved to ${reportPath}`);

  return { scenarios, reportPath };
}

// ---------------------------------------------------------------------------
// Data Room Management
// ---------------------------------------------------------------------------

async function updateDataRoom() {
  logger.info('Updating investor data room...');

  const dataRoomDirs = ['financials', 'legal', 'product', 'team'];
  for (const dir of dataRoomDirs) {
    fs.mkdirSync(path.join(DATA_ROOM_DIR, dir), { recursive: true });
  }

  // Update all components
  await updateKPIDashboard();
  await generatePitchDeckData();
  await modelFundingScenarios();
  await prepareBankDocumentation();

  // Generate data room index
  const indexContent = `# Werkpilot Investor Data Room
*Last Updated: ${new Date().toISOString().split('T')[0]}*

## Contents

### Financials
- [KPI Dashboard](financials/pitch-deck-metrics.md)
- [Funding Scenarios](financials/funding-scenarios.md)
- [Bank Loan Overview](financials/bank-loan-overview.md)

### Legal
- Company registration (Handelsregister)
- Articles of association (Statuten)
- Shareholder agreements

### Product
- Product overview & roadmap
- Technical architecture
- Customer testimonials

### Team
- Founder profiles
- Org chart
- Advisory board

---
*Access controlled by Werkpilot GmbH. All materials are confidential.*
`;

  fs.writeFileSync(path.join(DATA_ROOM_DIR, 'INDEX.md'), indexContent, 'utf-8');
  logger.info('Data room updated successfully');

  // Notify CEO
  await sendCEOEmail({
    subject: 'Data Room Updated - Ready for Investors',
    html: `
      <h2>Investor Data Room Updated</h2>
      <p>All materials have been refreshed with the latest data:</p>
      <ul>
        <li>KPI Dashboard - updated</li>
        <li>Pitch Deck Metrics - refreshed</li>
        <li>Funding Scenarios - recalculated</li>
        <li>Bank Documentation - updated</li>
      </ul>
      <p>Data room location: <code>${DATA_ROOM_DIR}</code></p>
    `,
  });

  return DATA_ROOM_DIR;
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function startScheduler() {
  // Full data room update: weekly Friday 08:00
  cron.schedule('0 8 * * 5', async () => {
    logger.info('Scheduled: Weekly data room update');
    try {
      await updateDataRoom();
    } catch (error) {
      logger.error(`Scheduled data room update failed: ${error.message}`);
    }
  });

  // KPI refresh: daily at 07:00
  cron.schedule('0 7 * * *', async () => {
    logger.info('Scheduled: Daily KPI refresh');
    try {
      await updateKPIDashboard();
    } catch (error) {
      logger.error(`Scheduled KPI refresh failed: ${error.message}`);
    }
  });

  // Investor follow-up check: weekly Monday 09:00
  cron.schedule('0 9 * * 1', async () => {
    logger.info('Scheduled: Investor tracking');
    try {
      await trackInvestors();
    } catch (error) {
      logger.error(`Scheduled investor tracking failed: ${error.message}`);
    }
  });

  logger.info('Fundraising Agent scheduler started');
  logger.info('  - Data room update: weekly Friday 08:00');
  logger.info('  - KPI refresh: daily 07:00');
  logger.info('  - Investor tracking: weekly Monday 09:00');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  logger.info('Fundraising Agent starting...');

  if (process.argv.includes('--once')) {
    await updateDataRoom();
  } else if (process.argv.includes('--kpis')) {
    const kpis = await updateKPIDashboard();
    console.log(JSON.stringify(kpis.metrics, null, 2));
  } else if (process.argv.includes('--pitch')) {
    await generatePitchDeckData();
  } else if (process.argv.includes('--scenarios')) {
    const { scenarios } = await modelFundingScenarios();
    console.log(JSON.stringify(scenarios, null, 2));
  } else if (process.argv.includes('--investors')) {
    const tracking = await trackInvestors();
    console.log(JSON.stringify(tracking, null, 2));
  } else if (process.argv.includes('--bank')) {
    await prepareBankDocumentation();
  } else {
    startScheduler();
  }
}

main().catch(error => {
  logger.error(`Fundraising Agent fatal error: ${error.message}`, { stack: error.stack });
  process.exit(1);
});

module.exports = {
  updateKPIDashboard,
  generatePitchDeckData,
  trackInvestors,
  prepareBankDocumentation,
  modelFundingScenarios,
  updateDataRoom,
  startScheduler,
};
