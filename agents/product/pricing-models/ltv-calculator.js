/**
 * LTV Calculator Module
 *
 * Calculates Customer Lifetime Value using multiple methodologies:
 * - Simple LTV: MRR * Average Lifespan
 * - Revenue-based LTV: Sum of actual invoices + projected future revenue
 * - Cohort-based LTV: Average LTV by signup cohort
 *
 * Used by Agent 17 - Pricing Strategy Agent
 */

const { createLogger } = require('../../shared/utils/logger');
const logger = createLogger('ltv-calculator');

/**
 * Calculate LTV for a single client.
 *
 * @param {Object} params
 * @param {number} params.mrr - Current monthly recurring revenue
 * @param {string|Date} params.startDate - Client start date
 * @param {string|Date|null} params.churnDate - Client churn date (null if still active)
 * @param {Array} params.invoices - Array of invoice records
 * @returns {number} Estimated lifetime value in CHF
 */
function calculateClientLTV({ mrr, startDate, churnDate, invoices = [] }) {
  if (!startDate) return 0;

  const start = new Date(startDate);
  const end = churnDate ? new Date(churnDate) : new Date();

  // Actual months as a client
  const monthsActive = Math.max(
    1,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  );

  // Method 1: Revenue-based (actual invoices)
  const actualRevenue = invoices.reduce((sum, inv) => {
    const amount = inv.Amount || inv.Total || 0;
    return sum + (inv.Status === 'Paid' ? amount : 0);
  }, 0);

  // Method 2: MRR-projected (if still active, project forward)
  const avgMonthlyChurnRate = 0.03; // 3% monthly churn assumption
  const avgLifespanMonths = 1 / avgMonthlyChurnRate; // ~33 months

  let projectedFutureRevenue = 0;
  if (!churnDate && mrr > 0) {
    // Project remaining lifetime revenue using geometric series
    const remainingMonths = Math.max(0, avgLifespanMonths - monthsActive);
    projectedFutureRevenue = mrr * remainingMonths * 0.85; // 85% discount for uncertainty
  }

  // Combined LTV: actual + projected
  const combinedLTV = actualRevenue + projectedFutureRevenue;

  // Simple LTV as sanity check
  const simpleLTV = mrr * avgLifespanMonths;

  // Return the more conservative estimate
  return Math.round(Math.min(combinedLTV, simpleLTV * 1.5));
}

/**
 * Calculate average LTV for a cohort of clients.
 *
 * @param {Array} clients - Array of client objects with mrr, startDate, churnDate, invoices
 * @returns {Object} Cohort LTV statistics
 */
function calculateCohortLTV(clients) {
  if (!clients || clients.length === 0) {
    return {
      avgLTV: 0,
      medianLTV: 0,
      totalLTV: 0,
      clientCount: 0,
      avgLifespanMonths: 0,
      churnRate: 0,
    };
  }

  const ltvValues = clients.map((c) =>
    calculateClientLTV({
      mrr: c.mrr || c.MRR || 0,
      startDate: c.startDate || c.Start_Date || c.Created,
      churnDate: c.churnDate || c.Churn_Date || null,
      invoices: c.invoices || [],
    })
  );

  const totalLTV = ltvValues.reduce((a, b) => a + b, 0);
  const avgLTV = Math.round(totalLTV / clients.length);

  // Median
  const sorted = [...ltvValues].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianLTV =
    sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

  // Average lifespan
  const lifespans = clients.map((c) => {
    const start = new Date(c.startDate || c.Start_Date || c.Created || Date.now());
    const end = c.churnDate || c.Churn_Date ? new Date(c.churnDate || c.Churn_Date) : new Date();
    return Math.max(
      1,
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    );
  });
  const avgLifespanMonths = Math.round(
    lifespans.reduce((a, b) => a + b, 0) / lifespans.length
  );

  // Churn rate
  const churned = clients.filter((c) => c.churnDate || c.Churn_Date).length;
  const churnRate =
    clients.length > 0 ? Math.round((churned / clients.length) * 100) : 0;

  return {
    avgLTV,
    medianLTV,
    totalLTV: Math.round(totalLTV),
    clientCount: clients.length,
    avgLifespanMonths,
    churnRate,
  };
}

/**
 * Calculate LTV:CAC ratio.
 *
 * @param {number} ltv - Average customer lifetime value
 * @param {number} cac - Customer acquisition cost
 * @returns {Object} LTV:CAC analysis
 */
function calculateLTVCAC(ltv, cac) {
  if (!cac || cac === 0) {
    return { ratio: Infinity, paybackMonths: 0, verdict: 'No CAC data' };
  }

  const ratio = Math.round((ltv / cac) * 100) / 100;
  const paybackMonths = Math.ceil(cac / (ltv / 33)); // assuming 33 month avg lifespan

  let verdict;
  if (ratio >= 5) verdict = 'Excellent - high efficiency';
  else if (ratio >= 3) verdict = 'Good - healthy business';
  else if (ratio >= 1) verdict = 'Marginal - optimize CAC or increase LTV';
  else verdict = 'Unsustainable - losing money per customer';

  return { ratio, paybackMonths, verdict };
}

module.exports = {
  calculateClientLTV,
  calculateCohortLTV,
  calculateLTVCAC,
};
