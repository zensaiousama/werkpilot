/**
 * Price Sensitivity Module
 *
 * Models price elasticity of demand for Werkpilot services.
 * Uses conversion data and historical patterns to estimate
 * the impact of price changes on customer acquisition and churn.
 *
 * Used by Agent 17 - Pricing Strategy Agent
 */

const { createLogger } = require('../../shared/utils/logger');
const logger = createLogger('price-sensitivity');

/**
 * Default elasticity coefficients by price range.
 * Higher values mean more price-sensitive customers.
 * Based on typical B2B SaaS elasticity patterns.
 */
const DEFAULT_ELASTICITY = {
  'CHF 0-500': 1.8,       // Small clients are most price-sensitive
  'CHF 501-1000': 1.4,    // Mid-market somewhat sensitive
  'CHF 1001-2000': 1.0,   // Standard sensitivity
  'CHF 2001-5000': 0.7,   // Enterprise less sensitive
  'CHF 5000+': 0.4,       // Large enterprise least sensitive
};

/**
 * Model the elasticity of demand for a given price change.
 *
 * @param {Object} params
 * @param {number} params.priceChangePercent - Percentage change in price (positive = increase)
 * @param {number} params.currentClientCount - Current number of affected clients
 * @param {number} params.currentMRR - Current MRR from affected clients
 * @param {Array} params.sensitivityData - Historical conversion data by price range
 * @returns {Object} Elasticity model results
 */
function modelElasticity({ priceChangePercent, currentClientCount, currentMRR, sensitivityData = [] }) {
  // Calculate weighted elasticity from historical data
  let weightedElasticity = 1.0;

  if (sensitivityData.length > 0) {
    let totalWeight = 0;
    let elasticitySum = 0;

    for (const range of sensitivityData) {
      const rangeElasticity = DEFAULT_ELASTICITY[range.range] || 1.0;
      const weight = range.proposed || 1;

      // Adjust elasticity based on actual conversion rates
      let adjustedElasticity = rangeElasticity;
      if (range.conversionRate > 60) {
        adjustedElasticity *= 0.8; // Higher conversion = less price sensitive
      } else if (range.conversionRate < 30) {
        adjustedElasticity *= 1.3; // Lower conversion = more price sensitive
      }

      elasticitySum += adjustedElasticity * weight;
      totalWeight += weight;
    }

    weightedElasticity = totalWeight > 0 ? elasticitySum / totalWeight : 1.0;
  }

  // Estimate churn from price increase using elasticity
  // For price increases, churn = elasticity * priceChange * base_churn_factor
  // For price decreases, we model new acquisition potential
  const isIncrease = priceChangePercent > 0;
  const absChange = Math.abs(priceChangePercent);

  let estimatedChurnRate = 0;
  let estimatedNewClients = 0;

  if (isIncrease) {
    // Price increase: estimate additional churn
    // Base formula: churn% = elasticity * (price_change% / 10) * sensitivity_factor
    const sensitivityFactor = 1.2; // Swiss market adjustment
    estimatedChurnRate = Math.min(
      50, // Cap at 50% churn
      Math.round(weightedElasticity * (absChange / 10) * sensitivityFactor * 100) / 100
    );
  } else {
    // Price decrease: estimate new client acquisition boost
    // Simplified: each 10% decrease gains ~(elasticity * 5)% more clients
    estimatedNewClients = Math.round(
      currentClientCount * (weightedElasticity * (absChange / 100) * 0.5)
    );
    estimatedChurnRate = 0; // No additional churn from price decrease
  }

  // Revenue projections
  const churningClients = Math.round(currentClientCount * (estimatedChurnRate / 100));
  const remainingClients = currentClientCount - churningClients + estimatedNewClients;
  const avgMRR = currentClientCount > 0 ? currentMRR / currentClientCount : 0;
  const newAvgMRR = avgMRR * (1 + priceChangePercent / 100);
  const projectedMRR = Math.round(remainingClients * newAvgMRR);
  const mrrDelta = projectedMRR - currentMRR;

  return {
    weightedElasticity: Math.round(weightedElasticity * 100) / 100,
    priceChangePercent,
    estimatedChurnRate,
    estimatedChurnCount: churningClients,
    estimatedNewClients,
    currentMRR: Math.round(currentMRR),
    projectedMRR,
    mrrDelta,
    breakEvenMonths: mrrDelta > 0 ? 0 : Math.ceil(Math.abs(mrrDelta) / (currentMRR * 0.03)),
    confidence: calculateConfidence(sensitivityData),
  };
}

/**
 * Run Van Westendorp Price Sensitivity Meter analysis.
 *
 * @param {Array} responses - Array of survey responses with:
 *   tooExpensive, expensive, bargain, tooCheap (all prices in CHF)
 * @returns {Object} Optimal price range
 */
function vanWestendorp(responses) {
  if (!responses || responses.length < 10) {
    return {
      error: 'Insufficient data (need at least 10 responses)',
      optimalPrice: null,
      acceptableRange: null,
    };
  }

  const sorted = {
    tooExpensive: responses.map((r) => r.tooExpensive).sort((a, b) => a - b),
    expensive: responses.map((r) => r.expensive).sort((a, b) => a - b),
    bargain: responses.map((r) => r.bargain).sort((a, b) => a - b),
    tooCheap: responses.map((r) => r.tooCheap).sort((a, b) => a - b),
  };

  const n = responses.length;

  // Find intersection points using cumulative distributions
  // This is a simplified calculation - in production you would use
  // actual cumulative distribution functions and find intersections

  const medianTooExpensive = sorted.tooExpensive[Math.floor(n / 2)];
  const medianExpensive = sorted.expensive[Math.floor(n / 2)];
  const medianBargain = sorted.bargain[Math.floor(n / 2)];
  const medianTooCheap = sorted.tooCheap[Math.floor(n / 2)];

  // Optimal Price Point (OPP): midpoint between "too expensive" and "too cheap" medians
  const optimalPrice = Math.round((medianTooExpensive + medianTooCheap) / 2);

  // Acceptable range
  const rangeLow = Math.round((medianTooCheap + medianBargain) / 2);
  const rangeHigh = Math.round((medianExpensive + medianTooExpensive) / 2);

  return {
    optimalPrice,
    acceptableRange: { low: rangeLow, high: rangeHigh },
    medians: {
      tooExpensive: medianTooExpensive,
      expensive: medianExpensive,
      bargain: medianBargain,
      tooCheap: medianTooCheap,
    },
    sampleSize: n,
  };
}

/**
 * Simulate revenue impact over time for a price change.
 *
 * @param {Object} params
 * @param {number} params.currentMRR - Current MRR
 * @param {number} params.priceChangePercent - Price change percentage
 * @param {number} params.months - Months to simulate (default 12)
 * @param {number} params.baseChurnRate - Base monthly churn rate (default 0.03)
 * @param {number} params.elasticity - Price elasticity (default 1.0)
 * @returns {Array} Monthly revenue projections
 */
function simulateRevenueImpact({
  currentMRR,
  priceChangePercent,
  months = 12,
  baseChurnRate = 0.03,
  elasticity = 1.0,
}) {
  const projections = [];

  // Additional churn from price change
  const additionalChurnRate =
    priceChangePercent > 0
      ? Math.min(0.15, elasticity * (priceChangePercent / 100) * 0.3)
      : 0;

  // New client boost from price decrease
  const acquisitionBoost =
    priceChangePercent < 0
      ? Math.abs(priceChangePercent / 100) * 0.2
      : 0;

  let mrr = currentMRR * (1 + priceChangePercent / 100);
  const newClientMRR = currentMRR / 100; // estimated avg MRR per new client

  for (let month = 1; month <= months; month++) {
    // Apply churn (extra churn decays over time as sensitive customers leave early)
    const monthlyExtraChurn = additionalChurnRate * Math.exp(-0.3 * month);
    const totalChurn = baseChurnRate + monthlyExtraChurn;

    mrr = mrr * (1 - totalChurn);

    // Apply new client acquisition
    if (acquisitionBoost > 0) {
      mrr += newClientMRR * acquisitionBoost * 100 * Math.exp(-0.1 * month);
    }

    projections.push({
      month,
      mrr: Math.round(mrr),
      churnRate: Math.round(totalChurn * 10000) / 100,
      cumulativeRevenue: projections.reduce((sum, p) => sum + p.mrr, 0) + Math.round(mrr),
    });
  }

  return projections;
}

/**
 * Calculate confidence level based on available data.
 */
function calculateConfidence(sensitivityData) {
  if (!sensitivityData || sensitivityData.length === 0) return 'Low';

  const totalSamples = sensitivityData.reduce((sum, r) => sum + (r.proposed || 0), 0);
  if (totalSamples >= 200) return 'High';
  if (totalSamples >= 50) return 'Medium';
  return 'Low';
}

module.exports = {
  modelElasticity,
  vanWestendorp,
  simulateRevenueImpact,
  DEFAULT_ELASTICITY,
};
