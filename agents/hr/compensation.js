/**
 * Werkpilot Agent 38 — Compensation Agent
 *
 * Manages freelancer compensation and financial operations:
 * - Market rate research for freelancer roles
 * - Compensation benchmarking against market data
 * - Rate card management per role per market
 * - Invoice processing: verifies against agreed rates
 * - Payment scheduling: ensures timely payments
 * - Total compensation tracking per freelancer per month
 *
 * Schedule: Weekly on Friday at 09:00 CET, invoice processing daily at 11:00
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('hr-compensation');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AIRTABLE_TABLES = {
  freelancers: 'Freelancers',
  invoices: 'Invoices',
  payments: 'Payments',
  rateCards: 'RateCards',
  compensationLog: 'CompensationLog',
  marketData: 'MarketData',
};

const RATE_CARDS_PATH = path.join(__dirname, 'rate-cards.json');
const MARKET_DATA_DIR = path.join(__dirname, 'market-data');
const SALARY_BENCHMARKS_PATH = path.join(MARKET_DATA_DIR, 'salary-benchmarks.json');

// ---------------------------------------------------------------------------
// Rate Card Management
// ---------------------------------------------------------------------------

/**
 * Load rate cards from disk.
 */
function loadRateCards() {
  if (!fs.existsSync(RATE_CARDS_PATH)) {
    logger.warn('Rate cards file not found, using defaults');
    return getDefaultRateCards();
  }
  return JSON.parse(fs.readFileSync(RATE_CARDS_PATH, 'utf-8'));
}

function getDefaultRateCards() {
  return {
    lastUpdated: new Date().toISOString(),
    currency: 'CHF',
    roles: {},
  };
}

/**
 * Save rate cards to disk.
 */
function saveRateCards(rateCards) {
  rateCards.lastUpdated = new Date().toISOString();
  fs.writeFileSync(RATE_CARDS_PATH, JSON.stringify(rateCards, null, 2), 'utf-8');
  logger.info('Rate cards saved');
}

/**
 * Get the rate card for a specific role and market.
 */
function getRateCard(role, market = 'default') {
  const cards = loadRateCards();
  const roleCards = cards.roles[role];
  if (!roleCards) return null;
  return roleCards[market] || roleCards.default || null;
}

/**
 * Update a rate card for a role/market combination.
 */
function updateRateCard(role, market, rates) {
  const cards = loadRateCards();
  if (!cards.roles[role]) cards.roles[role] = {};
  cards.roles[role][market] = {
    ...rates,
    updatedAt: new Date().toISOString(),
  };
  saveRateCards(cards);
  logger.info(`Updated rate card: ${role}/${market}`);
}

// ---------------------------------------------------------------------------
// Market Rate Research
// ---------------------------------------------------------------------------

/**
 * Load salary benchmarks from disk.
 */
function loadSalaryBenchmarks() {
  if (!fs.existsSync(SALARY_BENCHMARKS_PATH)) return { benchmarks: {}, lastUpdated: null };
  return JSON.parse(fs.readFileSync(SALARY_BENCHMARKS_PATH, 'utf-8'));
}

/**
 * Research market rates for a role via Claude.
 */
async function researchMarketRates(role, market) {
  const prompt = `Research current freelancer market rates for: ${role}
Market/Region: ${market}
Year: ${new Date().getFullYear()}

Based on your knowledge of freelancer marketplaces (Upwork, Fiverr, Freelancer, Toptal) and job boards:

Provide comprehensive rate data:
{
  "role": "${role}",
  "market": "${market}",
  "currency": "CHF",
  "hourlyRates": {
    "entry": { "min": <n>, "max": <n>, "typical": <n> },
    "mid": { "min": <n>, "max": <n>, "typical": <n> },
    "senior": { "min": <n>, "max": <n>, "typical": <n> },
    "expert": { "min": <n>, "max": <n>, "typical": <n> }
  },
  "projectRates": {
    "small": { "description": "small project scope", "typical": <n> },
    "medium": { "description": "medium project scope", "typical": <n> },
    "large": { "description": "large project scope", "typical": <n> }
  },
  "factors": ["factor affecting rates 1", "factor 2"],
  "trends": "brief market trend description",
  "recommendation": "recommended Werkpilot rate positioning",
  "competitiveAdvantage": "what Werkpilot can offer beyond rate",
  "sources": ["data source 1", "data source 2"],
  "confidence": "high|medium|low",
  "notes": "any caveats or additional context"
}`;

  const research = await generateJSON(prompt, {
    system: 'You are a compensation analyst specializing in freelancer markets in Europe, particularly Switzerland and DACH. Provide realistic, well-researched rate data.',
    model: config.models.standard,
    maxTokens: 2000,
  });

  logger.info(`Market rate research for ${role}/${market}: entry CHF ${research.hourlyRates.entry.typical}-${research.hourlyRates.expert.typical}/hr`);
  return research;
}

/**
 * Run comprehensive market research and update benchmarks.
 */
async function updateMarketBenchmarks() {
  logger.info('Updating market benchmarks...');

  const roles = [
    { role: 'proofreader-fr', market: 'FR/CH' },
    { role: 'proofreader-it', market: 'IT/CH' },
    { role: 'virtual-assistant', market: 'Global' },
    { role: 'sales-freelancer', market: 'DACH' },
    { role: 'content-writer', market: 'DACH' },
    { role: 'web-developer', market: 'Global' },
  ];

  const benchmarks = { lastUpdated: new Date().toISOString(), data: {} };

  for (const { role, market } of roles) {
    try {
      const research = await researchMarketRates(role, market);
      benchmarks.data[`${role}/${market}`] = research;

      // Update rate cards if research suggests adjustment
      const currentCard = getRateCard(role, market);
      if (currentCard) {
        const midTypical = research.hourlyRates.mid.typical;
        const currentRate = currentCard.hourlyRate;

        if (currentRate && Math.abs(currentRate - midTypical) / midTypical > 0.15) {
          logger.warn(`Rate deviation for ${role}/${market}: current CHF ${currentRate} vs market CHF ${midTypical} (>15% difference)`);
        }
      }

      // Save to Airtable
      await createRecord(AIRTABLE_TABLES.marketData, {
        Role: role,
        Market: market,
        EntryRate: research.hourlyRates.entry.typical,
        MidRate: research.hourlyRates.mid.typical,
        SeniorRate: research.hourlyRates.senior.typical,
        ExpertRate: research.hourlyRates.expert.typical,
        Trends: research.trends,
        Recommendation: research.recommendation,
        Confidence: research.confidence,
        ResearchedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(`Failed market research for ${role}/${market}: ${err.message}`);
    }
  }

  // Save to disk
  fs.mkdirSync(MARKET_DATA_DIR, { recursive: true });
  fs.writeFileSync(SALARY_BENCHMARKS_PATH, JSON.stringify(benchmarks, null, 2), 'utf-8');
  logger.info(`Market benchmarks updated: ${Object.keys(benchmarks.data).length} roles researched`);

  return benchmarks;
}

// ---------------------------------------------------------------------------
// Compensation Benchmarking
// ---------------------------------------------------------------------------

/**
 * Benchmark a freelancer's compensation against market data.
 */
async function benchmarkFreelancer(freelancer) {
  const benchmarks = loadSalaryBenchmarks();
  const key = `${freelancer.Role}/${freelancer.Market || 'Global'}`;
  const marketData = benchmarks.data[key];

  if (!marketData) {
    logger.warn(`No market data for ${key}`);
    return { status: 'no-data', freelancer: freelancer.Name };
  }

  const currentRate = freelancer.HourlyRate || 0;
  const midRate = marketData.hourlyRates.mid.typical;
  const percentile = calculatePercentile(currentRate, marketData.hourlyRates);

  return {
    freelancer: freelancer.Name,
    role: freelancer.Role,
    market: freelancer.Market,
    currentRate,
    marketMidRate: midRate,
    percentile,
    deviation: Math.round(((currentRate - midRate) / midRate) * 100),
    recommendation: percentile < 25
      ? 'Consider rate increase to remain competitive'
      : percentile > 85
        ? 'Rate is above market; ensure quality justifies premium'
        : 'Rate is within competitive range',
  };
}

/**
 * Calculate which percentile a rate falls in.
 */
function calculatePercentile(rate, hourlyRates) {
  const ranges = [
    { level: 'entry', pct: 25 },
    { level: 'mid', pct: 50 },
    { level: 'senior', pct: 75 },
    { level: 'expert', pct: 95 },
  ];

  for (let i = ranges.length - 1; i >= 0; i--) {
    if (rate >= hourlyRates[ranges[i].level].typical) {
      return ranges[i].pct;
    }
  }

  return 10; // Below entry level
}

/**
 * Run benchmarking for all active freelancers.
 */
async function runCompensationBenchmarking() {
  logger.info('Running compensation benchmarking...');

  const freelancers = await getRecords(
    AIRTABLE_TABLES.freelancers,
    "{Status} = 'active'",
    200
  );

  const results = [];
  const alerts = [];

  for (const f of freelancers) {
    try {
      const benchmark = await benchmarkFreelancer(f);
      results.push(benchmark);

      if (benchmark.percentile && benchmark.percentile < 25) {
        alerts.push({
          type: 'underpaid',
          freelancer: f.Name,
          role: f.Role,
          currentRate: benchmark.currentRate,
          marketMid: benchmark.marketMidRate,
          percentile: benchmark.percentile,
        });
      }
    } catch (err) {
      logger.error(`Failed to benchmark ${f.Name}: ${err.message}`);
    }
  }

  logger.info(`Benchmarking complete: ${results.length} freelancers, ${alerts.length} alerts`);
  return { results, alerts };
}

// ---------------------------------------------------------------------------
// Invoice Processing
// ---------------------------------------------------------------------------

/**
 * Verify an invoice against the agreed rate card.
 */
async function verifyInvoice(invoice) {
  const rateCard = getRateCard(invoice.Role, invoice.Market);

  const verification = {
    invoiceId: invoice.id,
    freelancer: invoice.FreelancerName,
    amount: invoice.Amount,
    hours: invoice.Hours,
    effectiveRate: invoice.Hours > 0 ? Math.round(invoice.Amount / invoice.Hours * 100) / 100 : 0,
    status: 'pending',
    issues: [],
  };

  // Check against rate card
  if (rateCard) {
    const agreedRate = rateCard.hourlyRate || rateCard.agreedRate;
    if (agreedRate) {
      const rateDeviation = Math.abs(verification.effectiveRate - agreedRate) / agreedRate;

      if (rateDeviation > 0.05) { // More than 5% deviation
        verification.issues.push({
          type: 'rate-mismatch',
          detail: `Effective rate CHF ${verification.effectiveRate} differs from agreed CHF ${agreedRate} by ${Math.round(rateDeviation * 100)}%`,
        });
      }
    }
  } else {
    verification.issues.push({
      type: 'no-rate-card',
      detail: `No rate card found for ${invoice.Role}/${invoice.Market}`,
    });
  }

  // Check for duplicate invoices
  try {
    const existingInvoices = await getRecords(
      AIRTABLE_TABLES.invoices,
      `AND({FreelancerName} = '${invoice.FreelancerName}', {Period} = '${invoice.Period}', {Status} != 'rejected')`,
      10
    );

    if (existingInvoices.length > 1) {
      verification.issues.push({
        type: 'potential-duplicate',
        detail: `${existingInvoices.length} invoices found for same freelancer and period`,
      });
    }
  } catch (err) {
    logger.warn(`Could not check for duplicate invoices: ${err.message}`);
  }

  // Check hours reasonability
  if (invoice.Hours > 200) {
    verification.issues.push({
      type: 'excessive-hours',
      detail: `${invoice.Hours} hours claimed exceeds reasonable monthly maximum`,
    });
  }

  verification.status = verification.issues.length === 0 ? 'verified' : 'flagged';
  return verification;
}

/**
 * Process all pending invoices.
 */
async function processInvoices() {
  logger.info('Processing pending invoices...');

  const invoices = await getRecords(
    AIRTABLE_TABLES.invoices,
    "{Status} = 'submitted'",
    50
  );

  if (invoices.length === 0) {
    logger.info('No pending invoices to process');
    return [];
  }

  logger.info(`Found ${invoices.length} invoices to process`);
  const results = [];

  for (const invoice of invoices) {
    try {
      const verification = await verifyInvoice(invoice);

      await updateRecord(AIRTABLE_TABLES.invoices, invoice.id, {
        VerificationStatus: verification.status,
        Issues: verification.issues.map(i => i.detail).join('; '),
        EffectiveRate: verification.effectiveRate,
        VerifiedAt: new Date().toISOString(),
        Status: verification.status === 'verified' ? 'approved' : 'needs-review',
      });

      results.push(verification);
      logger.info(`Invoice ${invoice.id}: ${verification.status} (${verification.issues.length} issues)`);
    } catch (err) {
      logger.error(`Failed to process invoice ${invoice.id}: ${err.message}`);
      results.push({ invoiceId: invoice.id, status: 'error', error: err.message });
    }
  }

  const approved = results.filter(r => r.status === 'verified').length;
  const flagged = results.filter(r => r.status === 'flagged').length;
  logger.info(`Invoice processing complete: ${approved} approved, ${flagged} flagged`);

  return results;
}

// ---------------------------------------------------------------------------
// Payment Scheduling
// ---------------------------------------------------------------------------

/**
 * Generate the payment schedule for the current period.
 */
async function generatePaymentSchedule() {
  logger.info('Generating payment schedule...');

  const approvedInvoices = await getRecords(
    AIRTABLE_TABLES.invoices,
    "{Status} = 'approved'",
    100
  );

  if (approvedInvoices.length === 0) {
    logger.info('No approved invoices for payment scheduling');
    return { payments: [], totalAmount: 0 };
  }

  const paymentDate = getNextPaymentDate();
  const payments = [];
  let totalAmount = 0;

  for (const invoice of approvedInvoices) {
    const payment = {
      freelancer: invoice.FreelancerName,
      invoiceId: invoice.id,
      amount: invoice.Amount,
      currency: invoice.Currency || 'CHF',
      paymentMethod: invoice.PaymentMethod || 'bank-transfer',
      scheduledDate: paymentDate.toISOString(),
    };

    try {
      await createRecord(AIRTABLE_TABLES.payments, {
        FreelancerName: invoice.FreelancerName,
        InvoiceId: invoice.id,
        Amount: invoice.Amount,
        Currency: payment.currency,
        PaymentMethod: payment.paymentMethod,
        ScheduledDate: payment.scheduledDate,
        Status: 'scheduled',
        CreatedAt: new Date().toISOString(),
      });

      await updateRecord(AIRTABLE_TABLES.invoices, invoice.id, {
        Status: 'payment-scheduled',
        PaymentScheduledDate: payment.scheduledDate,
      });

      payments.push(payment);
      totalAmount += invoice.Amount;
    } catch (err) {
      logger.error(`Failed to schedule payment for invoice ${invoice.id}: ${err.message}`);
    }
  }

  logger.info(`Payment schedule: ${payments.length} payments totaling CHF ${totalAmount.toFixed(2)} for ${paymentDate.toISOString().split('T')[0]}`);
  return { payments, totalAmount, paymentDate };
}

/**
 * Get the next payment date (15th or last day of month, whichever is next).
 */
function getNextPaymentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  if (day < 15) {
    return new Date(year, month, 15);
  } else {
    // Last day of month
    return new Date(year, month + 1, 0);
  }
}

/**
 * Check for overdue payments.
 */
async function checkOverduePayments() {
  logger.info('Checking for overdue payments...');

  const scheduledPayments = await getRecords(
    AIRTABLE_TABLES.payments,
    "{Status} = 'scheduled'",
    100
  );

  const now = new Date();
  const overdue = [];

  for (const payment of scheduledPayments) {
    const scheduledDate = new Date(payment.ScheduledDate);
    if (scheduledDate < now) {
      const daysOverdue = Math.floor((now - scheduledDate) / (1000 * 60 * 60 * 24));
      overdue.push({
        freelancer: payment.FreelancerName,
        amount: payment.Amount,
        scheduledDate: payment.ScheduledDate,
        daysOverdue,
      });
    }
  }

  if (overdue.length > 0) {
    logger.warn(`Found ${overdue.length} overdue payments`);
  }

  return overdue;
}

// ---------------------------------------------------------------------------
// Total Compensation Tracking
// ---------------------------------------------------------------------------

/**
 * Calculate total compensation for a freelancer over a period.
 */
async function calculateTotalCompensation(freelancerName, startDate, endDate) {
  const invoices = await getRecords(
    AIRTABLE_TABLES.invoices,
    `AND({FreelancerName} = '${freelancerName}', {Status} != 'rejected')`,
    100
  );

  const payments = await getRecords(
    AIRTABLE_TABLES.payments,
    `AND({FreelancerName} = '${freelancerName}', {Status} = 'completed')`,
    100
  );

  const start = new Date(startDate);
  const end = new Date(endDate);

  const periodInvoices = invoices.filter(i => {
    const date = new Date(i.CreatedAt || i.SubmittedAt);
    return date >= start && date <= end;
  });

  const periodPayments = payments.filter(p => {
    const date = new Date(p.CompletedAt || p.ScheduledDate);
    return date >= start && date <= end;
  });

  const totalInvoiced = periodInvoices.reduce((sum, i) => sum + (i.Amount || 0), 0);
  const totalPaid = periodPayments.reduce((sum, p) => sum + (p.Amount || 0), 0);
  const totalHours = periodInvoices.reduce((sum, i) => sum + (i.Hours || 0), 0);

  return {
    freelancer: freelancerName,
    period: { start: startDate, end: endDate },
    invoiceCount: periodInvoices.length,
    totalInvoiced: Math.round(totalInvoiced * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    outstanding: Math.round((totalInvoiced - totalPaid) * 100) / 100,
    totalHours,
    effectiveHourlyRate: totalHours > 0 ? Math.round(totalInvoiced / totalHours * 100) / 100 : 0,
  };
}

/**
 * Generate monthly compensation report for all freelancers.
 */
async function generateMonthlyCompensationReport() {
  logger.info('Generating monthly compensation report...');

  const freelancers = await getRecords(
    AIRTABLE_TABLES.freelancers,
    "{Status} = 'active'",
    200
  );

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  const compensations = [];
  let totalMonthlySpend = 0;

  for (const f of freelancers) {
    try {
      const comp = await calculateTotalCompensation(f.Name, monthStart, monthEnd);
      compensations.push(comp);
      totalMonthlySpend += comp.totalInvoiced;

      // Log to Airtable
      await createRecord(AIRTABLE_TABLES.compensationLog, {
        FreelancerName: f.Name,
        Role: f.Role,
        Period: now.toISOString().substring(0, 7),
        TotalInvoiced: comp.totalInvoiced,
        TotalPaid: comp.totalPaid,
        Hours: comp.totalHours,
        EffectiveRate: comp.effectiveHourlyRate,
        CreatedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(`Failed to calculate compensation for ${f.Name}: ${err.message}`);
    }
  }

  const report = {
    period: now.toISOString().substring(0, 7),
    freelancerCount: compensations.length,
    totalMonthlySpend: Math.round(totalMonthlySpend * 100) / 100,
    averagePerFreelancer: compensations.length > 0 ? Math.round(totalMonthlySpend / compensations.length * 100) / 100 : 0,
    compensations,
  };

  logger.info(`Monthly compensation report: CHF ${report.totalMonthlySpend} across ${report.freelancerCount} freelancers`);
  return report;
}

// ---------------------------------------------------------------------------
// Main Runs
// ---------------------------------------------------------------------------

/**
 * Daily invoice processing run.
 */
async function runDailyInvoiceProcessing() {
  const startTime = Date.now();
  logger.info('=== Compensation Agent: Daily Invoice Processing ===');

  try {
    // Process invoices
    const invoiceResults = await processInvoices();

    // Check overdue payments
    const overduePayments = await checkOverduePayments();

    // Send alerts if there are flagged invoices or overdue payments
    const flaggedInvoices = invoiceResults.filter(r => r.status === 'flagged');

    if (flaggedInvoices.length > 0 || overduePayments.length > 0) {
      await sendCEOEmail({
        subject: 'Compensation Alert: Action Required',
        html: buildAlertEmail(flaggedInvoices, overduePayments),
      });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Invoice Processing Complete in ${elapsed}s ===`);

    return {
      success: true,
      elapsed,
      invoicesProcessed: invoiceResults.length,
      approved: invoiceResults.filter(r => r.status === 'verified').length,
      flagged: flaggedInvoices.length,
      overduePayments: overduePayments.length,
    };
  } catch (err) {
    logger.error(`Invoice processing failed: ${err.message}`, { stack: err.stack });
    return { success: false, error: err.message };
  }
}

/**
 * Weekly compensation analysis run.
 */
async function runWeekly() {
  const startTime = Date.now();
  logger.info('=== Compensation Agent: Weekly Run Starting ===');

  try {
    // Step 1: Process any pending invoices
    const invoiceResults = await processInvoices();

    // Step 2: Generate payment schedule
    const paymentSchedule = await generatePaymentSchedule();

    // Step 3: Run compensation benchmarking
    const benchmarking = await runCompensationBenchmarking();

    // Step 4: Check overdue payments
    const overduePayments = await checkOverduePayments();

    // Step 5: Monthly report on first week
    const today = new Date();
    let monthlyReport = null;
    if (today.getDate() <= 7) {
      monthlyReport = await generateMonthlyCompensationReport();
    }

    // Step 6: Quarterly market update
    let marketUpdate = null;
    if (today.getMonth() % 3 === 0 && today.getDate() <= 7) {
      marketUpdate = await updateMarketBenchmarks();
    }

    // Step 7: Send comprehensive report
    await sendCEOEmail({
      subject: `Compensation Weekly Report${monthlyReport ? ' + Monthly Summary' : ''}`,
      html: buildWeeklyReportEmail(invoiceResults, paymentSchedule, benchmarking, overduePayments, monthlyReport),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Compensation Agent: Weekly Run Complete in ${elapsed}s ===`);

    return {
      success: true,
      elapsed,
      invoicesProcessed: invoiceResults.length,
      paymentsScheduled: paymentSchedule.payments.length,
      totalPayments: paymentSchedule.totalAmount,
      benchmarkAlerts: benchmarking.alerts.length,
      overduePayments: overduePayments.length,
    };
  } catch (err) {
    logger.error(`Compensation Agent weekly run failed: ${err.message}`, { stack: err.stack });

    try {
      await sendCEOEmail({
        subject: 'Compensation Agent ERROR',
        html: `<div style="font-family:sans-serif;padding:20px;background:#fff3f3;border-left:4px solid #e94560;">
          <h2>Compensation Agent Failed</h2>
          <p><strong>Error:</strong> ${err.message}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString('de-CH')}</p>
        </div>`,
      });
    } catch (emailErr) {
      logger.error(`Could not send error notification: ${emailErr.message}`);
    }

    return { success: false, error: err.message };
  }
}

/**
 * Build alert email for flagged items.
 */
function buildAlertEmail(flaggedInvoices, overduePayments) {
  return `
    <div style="font-family:'Segoe UI',sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:#e94560;color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">Compensation Alert</h1>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        ${flaggedInvoices.length > 0 ? `
          <h2>Flagged Invoices (${flaggedInvoices.length})</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="background:#e8e8e8;"><th>Freelancer</th><th>Amount</th><th>Issue</th></tr>
            ${flaggedInvoices.map(i => `
              <tr>
                <td>${i.freelancer}</td>
                <td>CHF ${i.amount}</td>
                <td style="color:#e94560;">${i.issues.map(j => j.detail).join('; ')}</td>
              </tr>
            `).join('')}
          </table>
        ` : ''}

        ${overduePayments.length > 0 ? `
          <h2>Overdue Payments (${overduePayments.length})</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="background:#e8e8e8;"><th>Freelancer</th><th>Amount</th><th>Days Overdue</th></tr>
            ${overduePayments.map(p => `
              <tr>
                <td>${p.freelancer}</td>
                <td>CHF ${p.amount}</td>
                <td style="color:#e94560;font-weight:bold;">${p.daysOverdue} days</td>
              </tr>
            `).join('')}
          </table>
        ` : ''}
      </div>
    </div>`;
}

/**
 * Build weekly report email.
 */
function buildWeeklyReportEmail(invoiceResults, paymentSchedule, benchmarking, overduePayments, monthlyReport) {
  const approved = invoiceResults.filter(r => r.status === 'verified').length;
  const flagged = invoiceResults.filter(r => r.status === 'flagged').length;

  return `
    <div style="font-family:'Segoe UI',sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">Compensation Weekly Report</h1>
        <p style="margin:5px 0 0;opacity:0.9;">${new Date().toLocaleDateString('de-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        <h2>Invoice Processing</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td>Invoices Processed</td><td style="text-align:right;font-weight:bold;">${invoiceResults.length}</td></tr>
          <tr><td>Approved</td><td style="text-align:right;color:#28a745;font-weight:bold;">${approved}</td></tr>
          <tr><td>Flagged for Review</td><td style="text-align:right;color:#e94560;font-weight:bold;">${flagged}</td></tr>
        </table>

        <h2>Payment Schedule</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td>Payments Scheduled</td><td style="text-align:right;font-weight:bold;">${paymentSchedule.payments.length}</td></tr>
          <tr><td>Total Amount</td><td style="text-align:right;font-weight:bold;">CHF ${paymentSchedule.totalAmount.toFixed(2)}</td></tr>
          <tr><td>Next Payment Date</td><td style="text-align:right;">${paymentSchedule.paymentDate ? paymentSchedule.paymentDate.toISOString().split('T')[0] : 'N/A'}</td></tr>
        </table>

        ${overduePayments.length > 0 ? `
          <h2 style="color:#e94560;">Overdue Payments: ${overduePayments.length}</h2>
          <p>Total overdue: CHF ${overduePayments.reduce((s, p) => s + (p.amount || 0), 0).toFixed(2)}</p>
        ` : '<p style="color:#28a745;">No overdue payments.</p>'}

        ${benchmarking.alerts.length > 0 ? `
          <h2>Compensation Alerts</h2>
          <ul>${benchmarking.alerts.map(a => `<li>${a.freelancer} (${a.role}): CHF ${a.currentRate}/hr at ${a.percentile}th percentile</li>`).join('')}</ul>
        ` : ''}

        ${monthlyReport ? `
          <h2>Monthly Summary: ${monthlyReport.period}</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td>Total Monthly Spend</td><td style="text-align:right;font-weight:bold;">CHF ${monthlyReport.totalMonthlySpend.toFixed(2)}</td></tr>
            <tr><td>Active Freelancers</td><td style="text-align:right;">${monthlyReport.freelancerCount}</td></tr>
            <tr><td>Average per Freelancer</td><td style="text-align:right;">CHF ${monthlyReport.averagePerFreelancer.toFixed(2)}</td></tr>
          </table>
        ` : ''}
      </div>
      <div style="text-align:center;padding:16px;color:#666;font-size:12px;">
        Werkpilot AI Compensation Agent
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function start() {
  // Daily invoice processing: 11:00 weekdays
  const dailySchedule = '0 11 * * 1-5';
  cron.schedule(dailySchedule, () => {
    logger.info('Cron triggered: daily invoice processing');
    runDailyInvoiceProcessing();
  }, {
    timezone: 'Europe/Zurich',
  });

  // Weekly comprehensive run: Friday 09:00
  const weeklySchedule = '0 9 * * 5';
  cron.schedule(weeklySchedule, () => {
    logger.info('Cron triggered: weekly compensation run');
    runWeekly();
  }, {
    timezone: 'Europe/Zurich',
  });

  logger.info(`Compensation Agent starting. Daily: ${dailySchedule}, Weekly: ${weeklySchedule}`);
  logger.info('Compensation Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--now') || args.includes('-n')) {
    logger.info('Running compensation agent immediately (manual trigger)');
    runWeekly().then(result => {
      if (result.success) {
        logger.info(`Weekly run completed: ${JSON.stringify(result)}`);
      } else {
        logger.error(`Weekly run failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else if (args.includes('--invoices')) {
    runDailyInvoiceProcessing().then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else if (args.includes('--market-research')) {
    updateMarketBenchmarks().then(result => {
      console.log(`Market benchmarks updated: ${Object.keys(result.data).length} roles`);
    });
  } else if (args.includes('--payment-schedule')) {
    generatePaymentSchedule().then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else if (args.includes('--monthly-report')) {
    generateMonthlyCompensationReport().then(report => {
      console.log(JSON.stringify(report, null, 2));
    });
  } else {
    start();
  }
}

module.exports = {
  start,
  runWeekly,
  runDailyInvoiceProcessing,
  loadRateCards,
  getRateCard,
  updateRateCard,
  researchMarketRates,
  updateMarketBenchmarks,
  benchmarkFreelancer,
  runCompensationBenchmarking,
  verifyInvoice,
  processInvoices,
  generatePaymentSchedule,
  checkOverduePayments,
  calculateTotalCompensation,
  generateMonthlyCompensationReport,
};
