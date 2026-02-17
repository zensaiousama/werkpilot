/**
 * Revenue Forecasting Calculations
 * Werkpilot Finance Department - Agent 25 Support Module
 *
 * Provides revenue forecasting based on pipeline data,
 * conversion rates, churn, and expansion revenue.
 * Enhanced with linear regression, seasonal adjustment,
 * and forecast accuracy tracking.
 */

'use strict';

// ---------------------------------------------------------------------------
// Linear Regression for Revenue Prediction
// ---------------------------------------------------------------------------

/**
 * Perform linear regression on historical MRR data
 * Returns slope and intercept for y = mx + b
 */
function linearRegression(dataPoints) {
  // dataPoints: [{x: monthIndex, y: mrr}, ...]
  const n = dataPoints.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (const point of dataPoints) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumX2 += point.x * point.x;
    sumY2 += point.y * point.y;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R² (coefficient of determination)
  const meanY = sumY / n;
  let ssTotal = 0, ssResidual = 0;
  for (const point of dataPoints) {
    const predicted = slope * point.x + intercept;
    ssTotal += Math.pow(point.y - meanY, 2);
    ssResidual += Math.pow(point.y - predicted, 2);
  }
  const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

  return {
    slope: Math.round(slope * 100) / 100,
    intercept: Math.round(intercept * 100) / 100,
    r2: Math.round(r2 * 10000) / 10000,
  };
}

/**
 * Predict future MRR using linear regression
 */
function predictWithLinearRegression(historicalMRR, monthsAhead) {
  // historicalMRR: [{period: 'YYYY-MM', mrr: number}, ...]
  const dataPoints = historicalMRR.map((entry, index) => ({
    x: index,
    y: entry.mrr || 0,
  }));

  const regression = linearRegression(dataPoints);
  const predictions = [];
  const startIndex = historicalMRR.length;

  for (let i = 0; i < monthsAhead; i++) {
    const monthIndex = startIndex + i;
    const predictedMRR = regression.slope * monthIndex + regression.intercept;

    predictions.push({
      month: i + 1,
      mrr: Math.max(0, Math.round(predictedMRR * 100) / 100),
      method: 'linear_regression',
    });
  }

  return {
    predictions,
    regression,
    confidenceLevel: regression.r2, // R² as confidence metric
  };
}

// ---------------------------------------------------------------------------
// Seasonal Adjustment (Swiss Business Calendar)
// ---------------------------------------------------------------------------

/**
 * Apply seasonal adjustment factors for Swiss business cycles
 * Q4 (Oct-Dec): slow, Q1-Q2 (Jan-Jun): strong
 */
function seasonalAdjustment(month, baseValue) {
  // month: 1-12 (January = 1)
  const seasonalFactors = {
    1: 1.15,  // January - Strong start
    2: 1.12,  // February - Strong
    3: 1.10,  // March - Strong
    4: 1.08,  // April - Good
    5: 1.05,  // May - Good
    6: 1.03,  // June - Moderate
    7: 0.98,  // July - Summer slowdown
    8: 0.95,  // August - Swiss vacation season
    9: 1.00,  // September - Recovery
    10: 0.92, // October - Q4 slowdown begins
    11: 0.88, // November - Slow
    12: 0.85, // December - Slowest (holidays)
  };

  const factor = seasonalFactors[month] || 1.0;
  return Math.round(baseValue * factor * 100) / 100;
}

/**
 * Apply seasonal factors to revenue predictions
 */
function applySeasonalFactors(predictions, startMonth) {
  // startMonth: current month (1-12)
  return predictions.map((pred, index) => {
    const month = ((startMonth + index - 1) % 12) + 1;
    const adjustedMRR = seasonalAdjustment(month, pred.mrr);

    return {
      ...pred,
      seasonalMonth: month,
      unadjustedMRR: pred.mrr,
      mrr: adjustedMRR,
      seasonalFactor: Math.round((adjustedMRR / pred.mrr) * 100) / 100,
    };
  });
}

// ---------------------------------------------------------------------------
// Forecast Accuracy Tracking
// ---------------------------------------------------------------------------

/**
 * Calculate forecast accuracy by comparing predictions to actuals
 */
function calculateForecastAccuracy(forecasts, actuals) {
  // forecasts: [{period: 'YYYY-MM', predicted: number}, ...]
  // actuals: [{period: 'YYYY-MM', actual: number}, ...]

  const results = [];
  let totalMAPE = 0;
  let totalRMSE = 0;
  let count = 0;

  for (const forecast of forecasts) {
    const actual = actuals.find(a => a.period === forecast.period);
    if (!actual) continue;

    const predicted = forecast.predicted || 0;
    const actualValue = actual.actual || 0;

    if (actualValue === 0) continue;

    const error = actualValue - predicted;
    const percentError = Math.abs(error / actualValue) * 100;
    const squaredError = Math.pow(error, 2);

    totalMAPE += percentError;
    totalRMSE += squaredError;
    count++;

    results.push({
      period: forecast.period,
      predicted,
      actual: actualValue,
      error,
      percentError: Math.round(percentError * 100) / 100,
    });
  }

  const mape = count > 0 ? totalMAPE / count : 0; // Mean Absolute Percentage Error
  const rmse = count > 0 ? Math.sqrt(totalRMSE / count) : 0; // Root Mean Squared Error

  return {
    results,
    mape: Math.round(mape * 100) / 100,
    rmse: Math.round(rmse * 100) / 100,
    accuracy: Math.max(0, 100 - mape), // Simple accuracy metric
    count,
  };
}

/**
 * Calculate Monthly Recurring Revenue (MRR) and Annual (ARR)
 */
function calculateMRR(activeSubscriptions) {
  let mrr = 0;
  const breakdown = {};

  for (const sub of activeSubscriptions) {
    const monthlyValue = sub.billingCycle === 'annual'
      ? (sub.amount || 0) / 12
      : (sub.amount || 0);

    mrr += monthlyValue;

    const plan = sub.plan || 'standard';
    if (!breakdown[plan]) breakdown[plan] = 0;
    breakdown[plan] += monthlyValue;
  }

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    breakdown,
    customerCount: activeSubscriptions.length,
    avgMRRPerCustomer: activeSubscriptions.length > 0
      ? Math.round((mrr / activeSubscriptions.length) * 100) / 100
      : 0,
  };
}

/**
 * Calculate MoM growth rate
 */
function calculateGrowthRate(currentMRR, previousMRR) {
  if (previousMRR === 0) return currentMRR > 0 ? 100 : 0;
  return Math.round(((currentMRR - previousMRR) / previousMRR) * 10000) / 100;
}

/**
 * Calculate Net Revenue Retention (NRR)
 */
function calculateNRR(data) {
  const {
    beginningMRR,
    expansionMRR,
    contractionMRR,
    churnedMRR,
  } = data;

  if (beginningMRR === 0) return 0;

  const nrr = ((beginningMRR + expansionMRR - contractionMRR - churnedMRR) / beginningMRR) * 100;
  return Math.round(nrr * 100) / 100;
}

/**
 * Forecast revenue from pipeline using weighted probability
 */
function forecastFromPipeline(pipeline) {
  const stageWeights = {
    'lead': 0.05,
    'qualified': 0.15,
    'discovery': 0.25,
    'proposal': 0.50,
    'negotiation': 0.70,
    'verbal-commit': 0.90,
    'closed-won': 1.00,
    'closed-lost': 0.00,
  };

  let weightedTotal = 0;
  let bestCase = 0;
  let worstCase = 0;
  const byStage = {};

  for (const deal of pipeline) {
    const stage = (deal.stage || 'lead').toLowerCase();
    const weight = stageWeights[stage] !== undefined ? stageWeights[stage] : 0.10;
    const amount = deal.amount || 0;

    const weighted = amount * weight;
    weightedTotal += weighted;

    // Best case: everything from discovery+ closes
    if (weight >= 0.25) bestCase += amount;
    // Worst case: only verbal-commit+ closes
    if (weight >= 0.90) worstCase += amount;

    if (!byStage[stage]) {
      byStage[stage] = { count: 0, totalValue: 0, weightedValue: 0 };
    }
    byStage[stage].count += 1;
    byStage[stage].totalValue += amount;
    byStage[stage].weightedValue += weighted;
  }

  return {
    expected: Math.round(weightedTotal * 100) / 100,
    bestCase: Math.round(bestCase * 100) / 100,
    worstCase: Math.round(worstCase * 100) / 100,
    byStage,
    totalDeals: pipeline.length,
    totalPipelineValue: pipeline.reduce((sum, d) => sum + (d.amount || 0), 0),
  };
}

/**
 * Project revenue forward N months
 */
function projectRevenue(currentMRR, monthsAhead, assumptions) {
  const {
    monthlyGrowthRate = 0.05,
    monthlyChurnRate = 0.03,
    expansionRate = 0.02,
    newCustomerMRR = 0,
  } = assumptions;

  const projections = [];
  let mrr = currentMRR;

  for (let month = 1; month <= monthsAhead; month++) {
    const churnLoss = mrr * monthlyChurnRate;
    const expansion = mrr * expansionRate;
    const newRevenue = newCustomerMRR;
    const organicGrowth = mrr * monthlyGrowthRate;

    mrr = mrr - churnLoss + expansion + newRevenue + organicGrowth;

    projections.push({
      month,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      churnLoss: Math.round(churnLoss * 100) / 100,
      expansion: Math.round(expansion * 100) / 100,
      newRevenue: Math.round(newRevenue * 100) / 100,
      organicGrowth: Math.round(organicGrowth * 100) / 100,
    });
  }

  return projections;
}

/**
 * Generate 3 scenarios: best, expected, worst
 * Enhanced with confidence intervals and seasonal adjustment
 */
function scenarioModeling(currentMRR, monthsAhead, historicalMRR = [], includeSeasonalFactors = true) {
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // Optimistic scenario
  let bestCase = projectRevenue(currentMRR, monthsAhead, {
    monthlyGrowthRate: 0.10,
    monthlyChurnRate: 0.01,
    expansionRate: 0.05,
    newCustomerMRR: currentMRR * 0.15,
  });

  // Base/Expected scenario
  let expected = projectRevenue(currentMRR, monthsAhead, {
    monthlyGrowthRate: 0.05,
    monthlyChurnRate: 0.03,
    expansionRate: 0.02,
    newCustomerMRR: currentMRR * 0.08,
  });

  // Pessimistic scenario
  let worstCase = projectRevenue(currentMRR, monthsAhead, {
    monthlyGrowthRate: 0.01,
    monthlyChurnRate: 0.07,
    expansionRate: 0.005,
    newCustomerMRR: currentMRR * 0.02,
  });

  // Apply seasonal factors if enabled
  if (includeSeasonalFactors) {
    bestCase = applySeasonalFactors(bestCase, currentMonth);
    expected = applySeasonalFactors(expected, currentMonth);
    worstCase = applySeasonalFactors(worstCase, currentMonth);
  }

  // Calculate confidence intervals (±10% for expected, wider for best/worst)
  const withConfidenceIntervals = {
    bestCase: bestCase.map(m => ({
      ...m,
      confidenceInterval: {
        lower: Math.round(m.mrr * 0.85 * 100) / 100,
        upper: Math.round(m.mrr * 1.15 * 100) / 100,
      },
    })),
    expected: expected.map(m => ({
      ...m,
      confidenceInterval: {
        lower: Math.round(m.mrr * 0.90 * 100) / 100,
        upper: Math.round(m.mrr * 1.10 * 100) / 100,
      },
    })),
    worstCase: worstCase.map(m => ({
      ...m,
      confidenceInterval: {
        lower: Math.round(m.mrr * 0.80 * 100) / 100,
        upper: Math.round(m.mrr * 1.20 * 100) / 100,
      },
    })),
  };

  // Add linear regression prediction if historical data available
  if (historicalMRR && historicalMRR.length >= 3) {
    const regression = predictWithLinearRegression(historicalMRR, monthsAhead);
    withConfidenceIntervals.linearRegression = regression.predictions;
    withConfidenceIntervals.regressionQuality = {
      r2: regression.regression.r2,
      slope: regression.regression.slope,
      confidence: regression.confidenceLevel,
    };
  }

  return withConfidenceIntervals;
}

/**
 * Cohort analysis - revenue retention by signup month
 */
function cohortAnalysis(customers) {
  const cohorts = {};

  for (const customer of customers) {
    const signupMonth = customer.signupDate
      ? customer.signupDate.substring(0, 7)
      : 'unknown';

    if (!cohorts[signupMonth]) {
      cohorts[signupMonth] = {
        initialCount: 0,
        currentActive: 0,
        initialMRR: 0,
        currentMRR: 0,
        months: [],
      };
    }

    cohorts[signupMonth].initialCount += 1;
    cohorts[signupMonth].initialMRR += customer.initialMRR || customer.mrr || 0;

    if (customer.status === 'active') {
      cohorts[signupMonth].currentActive += 1;
      cohorts[signupMonth].currentMRR += customer.mrr || 0;
    }
  }

  // Calculate retention rates
  for (const [month, cohort] of Object.entries(cohorts)) {
    cohort.customerRetention = cohort.initialCount > 0
      ? Math.round((cohort.currentActive / cohort.initialCount) * 10000) / 100
      : 0;
    cohort.revenueRetention = cohort.initialMRR > 0
      ? Math.round((cohort.currentMRR / cohort.initialMRR) * 10000) / 100
      : 0;
  }

  return cohorts;
}

/**
 * Calculate growth metrics summary
 */
function growthMetricsSummary(currentMRR, previousMRR, nrrData, pipeline) {
  const momGrowth = calculateGrowthRate(currentMRR, previousMRR);
  const nrr = calculateNRR(nrrData);
  const pipelineForecast = forecastFromPipeline(pipeline);

  return {
    mrr: currentMRR,
    arr: currentMRR * 12,
    momGrowth,
    nrr,
    pipelineWeightedValue: pipelineForecast.expected,
    totalPipelineValue: pipelineForecast.totalPipelineValue,
    pipelineDeals: pipelineForecast.totalDeals,
    runRate: currentMRR * 12,
    monthsToDouble: momGrowth > 0 ? Math.ceil(72 / momGrowth) : Infinity,
  };
}

module.exports = {
  calculateMRR,
  calculateGrowthRate,
  calculateNRR,
  forecastFromPipeline,
  projectRevenue,
  scenarioModeling,
  cohortAnalysis,
  growthMetricsSummary,
  linearRegression,
  predictWithLinearRegression,
  seasonalAdjustment,
  applySeasonalFactors,
  calculateForecastAccuracy,
};
