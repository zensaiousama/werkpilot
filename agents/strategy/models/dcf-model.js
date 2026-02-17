/**
 * Werkpilot DCF (Discounted Cash Flow) Model
 *
 * Financial modeling utilities for M&A analysis.
 * Provides DCF valuation, comparable company analysis,
 * and revenue multiple calculations for Swiss KMU targets.
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants & Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  discountRate: 0.10,         // 10% WACC (typical for Swiss tech KMU)
  terminalGrowthRate: 0.02,   // 2% perpetual growth
  projectionYears: 5,
  taxRate: 0.18,              // ~18% effective Swiss corporate tax (varies by canton)
  riskFreeRate: 0.015,        // Swiss 10yr government bond
  equityRiskPremium: 0.055,   // Swiss market
  smallCapPremium: 0.03,      // Additional premium for KMU targets
  currency: 'CHF',
};

const INDUSTRY_MULTIPLES = {
  'marketing-agency': {
    revenueMultiple: { low: 1.5, median: 2.5, high: 4.0 },
    ebitdaMultiple: { low: 5.0, median: 8.0, high: 12.0 },
    arrMultiple: { low: 3.0, median: 5.0, high: 8.0 },
  },
  'saas-marketing': {
    revenueMultiple: { low: 3.0, median: 6.0, high: 12.0 },
    ebitdaMultiple: { low: 10.0, median: 18.0, high: 30.0 },
    arrMultiple: { low: 5.0, median: 10.0, high: 20.0 },
  },
  'it-services': {
    revenueMultiple: { low: 1.0, median: 2.0, high: 3.5 },
    ebitdaMultiple: { low: 6.0, median: 9.0, high: 14.0 },
    arrMultiple: { low: 2.0, median: 4.0, high: 7.0 },
  },
  'digital-agency': {
    revenueMultiple: { low: 1.2, median: 2.2, high: 3.8 },
    ebitdaMultiple: { low: 5.0, median: 7.5, high: 11.0 },
    arrMultiple: { low: 2.5, median: 4.5, high: 7.5 },
  },
  'ecommerce-services': {
    revenueMultiple: { low: 1.5, median: 3.0, high: 5.0 },
    ebitdaMultiple: { low: 7.0, median: 11.0, high: 16.0 },
    arrMultiple: { low: 3.0, median: 6.0, high: 10.0 },
  },
};

// ---------------------------------------------------------------------------
// Core DCF Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate DCF valuation from projected free cash flows.
 *
 * @param {Object} params
 * @param {number[]} params.projectedFCF - Array of projected free cash flows per year
 * @param {number} [params.discountRate] - WACC / discount rate
 * @param {number} [params.terminalGrowthRate] - Perpetual growth rate for terminal value
 * @param {number} [params.netDebt] - Net debt (debt minus cash) to subtract from enterprise value
 * @returns {Object} Valuation results
 */
function calculateDCF({
  projectedFCF,
  discountRate = DEFAULTS.discountRate,
  terminalGrowthRate = DEFAULTS.terminalGrowthRate,
  netDebt = 0,
}) {
  if (!Array.isArray(projectedFCF) || projectedFCF.length === 0) {
    throw new Error('projectedFCF must be a non-empty array of cash flow numbers');
  }
  if (discountRate <= terminalGrowthRate) {
    throw new Error('discountRate must be greater than terminalGrowthRate');
  }

  const years = projectedFCF.length;

  // Discount each year's FCF to present value
  const pvCashFlows = projectedFCF.map((fcf, i) => {
    const year = i + 1;
    const discountFactor = Math.pow(1 + discountRate, year);
    return {
      year,
      fcf,
      discountFactor: parseFloat(discountFactor.toFixed(4)),
      presentValue: parseFloat((fcf / discountFactor).toFixed(2)),
    };
  });

  const pvSum = pvCashFlows.reduce((sum, pv) => sum + pv.presentValue, 0);

  // Terminal value using Gordon Growth Model
  const lastFCF = projectedFCF[projectedFCF.length - 1];
  const terminalFCF = lastFCF * (1 + terminalGrowthRate);
  const terminalValue = terminalFCF / (discountRate - terminalGrowthRate);
  const terminalDiscountFactor = Math.pow(1 + discountRate, years);
  const pvTerminalValue = terminalValue / terminalDiscountFactor;

  // Enterprise value
  const enterpriseValue = pvSum + pvTerminalValue;
  const equityValue = enterpriseValue - netDebt;

  return {
    inputs: {
      projectedFCF,
      discountRate,
      terminalGrowthRate,
      netDebt,
      projectionYears: years,
    },
    pvCashFlows,
    pvOfProjectedCashFlows: parseFloat(pvSum.toFixed(2)),
    terminalValue: parseFloat(terminalValue.toFixed(2)),
    pvTerminalValue: parseFloat(pvTerminalValue.toFixed(2)),
    terminalValueShare: parseFloat((pvTerminalValue / enterpriseValue * 100).toFixed(1)),
    enterpriseValue: parseFloat(enterpriseValue.toFixed(2)),
    equityValue: parseFloat(equityValue.toFixed(2)),
    currency: DEFAULTS.currency,
  };
}

// ---------------------------------------------------------------------------
// Revenue Projection
// ---------------------------------------------------------------------------

/**
 * Project future revenues based on current revenue and growth assumptions.
 *
 * @param {Object} params
 * @param {number} params.currentRevenue - Current annual revenue
 * @param {number[]} params.growthRates - Annual growth rates for each projected year
 * @param {number} [params.churnRate] - Annual customer churn rate
 * @param {number} [params.expansionRate] - Annual revenue expansion from existing customers
 * @returns {Object} Revenue projections
 */
function projectRevenue({
  currentRevenue,
  growthRates,
  churnRate = 0,
  expansionRate = 0,
}) {
  if (!currentRevenue || currentRevenue <= 0) {
    throw new Error('currentRevenue must be a positive number');
  }

  const projections = [];
  let revenue = currentRevenue;

  for (let i = 0; i < growthRates.length; i++) {
    const retainedRevenue = revenue * (1 - churnRate);
    const expandedRevenue = retainedRevenue * (1 + expansionRate);
    const newRevenue = revenue * growthRates[i];
    revenue = expandedRevenue + newRevenue;

    projections.push({
      year: i + 1,
      growthRate: growthRates[i],
      retainedRevenue: parseFloat(retainedRevenue.toFixed(2)),
      expandedRevenue: parseFloat(expandedRevenue.toFixed(2)),
      newRevenue: parseFloat(newRevenue.toFixed(2)),
      totalRevenue: parseFloat(revenue.toFixed(2)),
    });
  }

  return {
    currentRevenue,
    projections,
    cagr: parseFloat(
      (Math.pow(projections[projections.length - 1].totalRevenue / currentRevenue, 1 / growthRates.length) - 1).toFixed(4)
    ),
  };
}

// ---------------------------------------------------------------------------
// Free Cash Flow Projection
// ---------------------------------------------------------------------------

/**
 * Project free cash flows from revenue projections.
 *
 * @param {Object} params
 * @param {number[]} params.revenues - Projected annual revenues
 * @param {number} params.ebitdaMargin - EBITDA margin as decimal
 * @param {number} [params.capexPercent] - CapEx as percent of revenue
 * @param {number} [params.wcChangePercent] - Working capital change as percent of revenue
 * @param {number} [params.taxRate] - Effective tax rate
 * @param {number} [params.depreciationPercent] - Depreciation as percent of revenue
 * @returns {Object} FCF projections
 */
function projectFCF({
  revenues,
  ebitdaMargin,
  capexPercent = 0.05,
  wcChangePercent = 0.02,
  taxRate = DEFAULTS.taxRate,
  depreciationPercent = 0.03,
}) {
  const projections = revenues.map((revenue, i) => {
    const ebitda = revenue * ebitdaMargin;
    const depreciation = revenue * depreciationPercent;
    const ebit = ebitda - depreciation;
    const taxes = Math.max(0, ebit * taxRate);
    const nopat = ebit - taxes;
    const capex = revenue * capexPercent;
    const wcChange = i > 0 ? (revenue - revenues[i - 1]) * wcChangePercent : revenue * wcChangePercent * 0.5;
    const fcf = nopat + depreciation - capex - wcChange;

    return {
      year: i + 1,
      revenue: parseFloat(revenue.toFixed(2)),
      ebitda: parseFloat(ebitda.toFixed(2)),
      ebitdaMargin,
      depreciation: parseFloat(depreciation.toFixed(2)),
      ebit: parseFloat(ebit.toFixed(2)),
      taxes: parseFloat(taxes.toFixed(2)),
      nopat: parseFloat(nopat.toFixed(2)),
      capex: parseFloat(capex.toFixed(2)),
      workingCapitalChange: parseFloat(wcChange.toFixed(2)),
      freeCashFlow: parseFloat(fcf.toFixed(2)),
    };
  });

  return {
    projections,
    fcfArray: projections.map(p => p.freeCashFlow),
    totalFCF: parseFloat(projections.reduce((sum, p) => sum + p.freeCashFlow, 0).toFixed(2)),
  };
}

// ---------------------------------------------------------------------------
// Comparable Company Analysis
// ---------------------------------------------------------------------------

/**
 * Calculate valuation using comparable company multiples.
 *
 * @param {Object} params
 * @param {string} params.industry - Industry key (from INDUSTRY_MULTIPLES)
 * @param {number} params.revenue - Annual revenue
 * @param {number} [params.ebitda] - Annual EBITDA
 * @param {number} [params.arr] - Annual recurring revenue
 * @param {number} [params.netDebt] - Net debt
 * @returns {Object} Valuation ranges
 */
function comparableCompanyValuation({
  industry,
  revenue,
  ebitda = null,
  arr = null,
  netDebt = 0,
}) {
  const multiples = INDUSTRY_MULTIPLES[industry];
  if (!multiples) {
    throw new Error(`Unknown industry: ${industry}. Available: ${Object.keys(INDUSTRY_MULTIPLES).join(', ')}`);
  }

  const valuations = {};

  // Revenue-based valuation
  valuations.revenueMultiple = {
    method: 'Revenue Multiple',
    metric: revenue,
    low: parseFloat((revenue * multiples.revenueMultiple.low - netDebt).toFixed(2)),
    median: parseFloat((revenue * multiples.revenueMultiple.median - netDebt).toFixed(2)),
    high: parseFloat((revenue * multiples.revenueMultiple.high - netDebt).toFixed(2)),
    multiplesUsed: multiples.revenueMultiple,
  };

  // EBITDA-based valuation
  if (ebitda !== null) {
    valuations.ebitdaMultiple = {
      method: 'EBITDA Multiple',
      metric: ebitda,
      low: parseFloat((ebitda * multiples.ebitdaMultiple.low - netDebt).toFixed(2)),
      median: parseFloat((ebitda * multiples.ebitdaMultiple.median - netDebt).toFixed(2)),
      high: parseFloat((ebitda * multiples.ebitdaMultiple.high - netDebt).toFixed(2)),
      multiplesUsed: multiples.ebitdaMultiple,
    };
  }

  // ARR-based valuation
  if (arr !== null) {
    valuations.arrMultiple = {
      method: 'ARR Multiple',
      metric: arr,
      low: parseFloat((arr * multiples.arrMultiple.low - netDebt).toFixed(2)),
      median: parseFloat((arr * multiples.arrMultiple.median - netDebt).toFixed(2)),
      high: parseFloat((arr * multiples.arrMultiple.high - netDebt).toFixed(2)),
      multiplesUsed: multiples.arrMultiple,
    };
  }

  // Calculate blended valuation
  const medianValues = Object.values(valuations).map(v => v.median);
  const blendedMedian = medianValues.reduce((sum, v) => sum + v, 0) / medianValues.length;

  return {
    industry,
    multiples,
    valuations,
    blendedValuation: {
      low: parseFloat(Math.min(...Object.values(valuations).map(v => v.low)).toFixed(2)),
      median: parseFloat(blendedMedian.toFixed(2)),
      high: parseFloat(Math.max(...Object.values(valuations).map(v => v.high)).toFixed(2)),
    },
    currency: DEFAULTS.currency,
  };
}

// ---------------------------------------------------------------------------
// WACC Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate Weighted Average Cost of Capital.
 *
 * @param {Object} params
 * @param {number} params.equityWeight - Equity as percent of total capital
 * @param {number} params.debtWeight - Debt as percent of total capital
 * @param {number} [params.costOfEquity] - Cost of equity (if known)
 * @param {number} [params.beta] - Company beta (for CAPM calculation)
 * @param {number} params.costOfDebt - Pre-tax cost of debt
 * @param {number} [params.taxRate] - Corporate tax rate
 * @returns {Object} WACC calculation
 */
function calculateWACC({
  equityWeight,
  debtWeight,
  costOfEquity = null,
  beta = 1.0,
  costOfDebt,
  taxRate = DEFAULTS.taxRate,
}) {
  // Calculate cost of equity using CAPM if not provided
  const calcCostOfEquity = costOfEquity !== null
    ? costOfEquity
    : DEFAULTS.riskFreeRate + beta * DEFAULTS.equityRiskPremium + DEFAULTS.smallCapPremium;

  const afterTaxCostOfDebt = costOfDebt * (1 - taxRate);
  const wacc = (equityWeight * calcCostOfEquity) + (debtWeight * afterTaxCostOfDebt);

  return {
    costOfEquity: parseFloat(calcCostOfEquity.toFixed(4)),
    costOfDebt: parseFloat(costOfDebt.toFixed(4)),
    afterTaxCostOfDebt: parseFloat(afterTaxCostOfDebt.toFixed(4)),
    equityWeight: parseFloat(equityWeight.toFixed(4)),
    debtWeight: parseFloat(debtWeight.toFixed(4)),
    wacc: parseFloat(wacc.toFixed(4)),
    waccPercent: `${(wacc * 100).toFixed(2)}%`,
    components: {
      riskFreeRate: DEFAULTS.riskFreeRate,
      equityRiskPremium: DEFAULTS.equityRiskPremium,
      smallCapPremium: DEFAULTS.smallCapPremium,
      beta,
      taxRate,
    },
  };
}

// ---------------------------------------------------------------------------
// Sensitivity Analysis
// ---------------------------------------------------------------------------

/**
 * Run DCF sensitivity analysis across discount rates and growth rates.
 *
 * @param {Object} params
 * @param {number[]} params.projectedFCF - Base projected FCF
 * @param {number[]} [params.discountRates] - Range of discount rates to test
 * @param {number[]} [params.growthRates] - Range of terminal growth rates to test
 * @param {number} [params.netDebt] - Net debt
 * @returns {Object} Sensitivity matrix
 */
function sensitivityAnalysis({
  projectedFCF,
  discountRates = [0.08, 0.09, 0.10, 0.11, 0.12],
  growthRates = [0.01, 0.015, 0.02, 0.025, 0.03],
  netDebt = 0,
}) {
  const matrix = {};

  for (const dr of discountRates) {
    matrix[`WACC_${(dr * 100).toFixed(1)}%`] = {};
    for (const gr of growthRates) {
      if (dr <= gr) {
        matrix[`WACC_${(dr * 100).toFixed(1)}%`][`g_${(gr * 100).toFixed(1)}%`] = 'N/A';
        continue;
      }
      const result = calculateDCF({
        projectedFCF,
        discountRate: dr,
        terminalGrowthRate: gr,
        netDebt,
      });
      matrix[`WACC_${(dr * 100).toFixed(1)}%`][`g_${(gr * 100).toFixed(1)}%`] =
        parseFloat(result.equityValue.toFixed(0));
    }
  }

  return {
    discountRates: discountRates.map(r => `${(r * 100).toFixed(1)}%`),
    growthRates: growthRates.map(r => `${(r * 100).toFixed(1)}%`),
    equityValueMatrix: matrix,
    currency: DEFAULTS.currency,
  };
}

// ---------------------------------------------------------------------------
// Synergy Valuation
// ---------------------------------------------------------------------------

/**
 * Calculate value of synergies from an acquisition.
 *
 * @param {Object} params
 * @param {Object[]} params.revenueSynergies - Array of { description, annualValue, probability, yearsToRealize }
 * @param {Object[]} params.costSynergies - Array of { description, annualSaving, probability, yearsToRealize }
 * @param {number} [params.integrationCost] - One-time integration cost
 * @param {number} [params.discountRate] - Discount rate for synergy PV
 * @returns {Object} Synergy valuation
 */
function calculateSynergies({
  revenueSynergies = [],
  costSynergies = [],
  integrationCost = 0,
  discountRate = DEFAULTS.discountRate,
}) {
  const revenueResults = revenueSynergies.map(s => {
    const expectedValue = s.annualValue * s.probability;
    const pvFactor = 1 / Math.pow(1 + discountRate, s.yearsToRealize);
    const pv = expectedValue / (discountRate) * pvFactor; // Perpetuity starting at realization
    return {
      ...s,
      expectedAnnualValue: parseFloat(expectedValue.toFixed(2)),
      presentValue: parseFloat(pv.toFixed(2)),
    };
  });

  const costResults = costSynergies.map(s => {
    const expectedSaving = s.annualSaving * s.probability;
    const pvFactor = 1 / Math.pow(1 + discountRate, s.yearsToRealize);
    const pv = expectedSaving / (discountRate) * pvFactor;
    return {
      ...s,
      expectedAnnualSaving: parseFloat(expectedSaving.toFixed(2)),
      presentValue: parseFloat(pv.toFixed(2)),
    };
  });

  const totalRevenueSynergyPV = revenueResults.reduce((sum, s) => sum + s.presentValue, 0);
  const totalCostSynergyPV = costResults.reduce((sum, s) => sum + s.presentValue, 0);
  const totalSynergyValue = totalRevenueSynergyPV + totalCostSynergyPV;
  const netSynergyValue = totalSynergyValue - integrationCost;

  return {
    revenueSynergies: revenueResults,
    costSynergies: costResults,
    totalRevenueSynergyPV: parseFloat(totalRevenueSynergyPV.toFixed(2)),
    totalCostSynergyPV: parseFloat(totalCostSynergyPV.toFixed(2)),
    totalSynergyValue: parseFloat(totalSynergyValue.toFixed(2)),
    integrationCost,
    netSynergyValue: parseFloat(netSynergyValue.toFixed(2)),
    currency: DEFAULTS.currency,
  };
}

// ---------------------------------------------------------------------------
// Full Valuation Report
// ---------------------------------------------------------------------------

/**
 * Generate a complete valuation report combining DCF, comps, and synergies.
 *
 * @param {Object} target - Target company data
 * @returns {Object} Complete valuation report
 */
function generateValuationReport(target) {
  const {
    name,
    industry,
    revenue,
    ebitda,
    arr,
    netDebt = 0,
    growthRates,
    ebitdaMargin,
    revenueSynergies = [],
    costSynergies = [],
    integrationCost = 0,
  } = target;

  // 1. Revenue projection
  const revenueProjection = projectRevenue({
    currentRevenue: revenue,
    growthRates: growthRates || [0.15, 0.12, 0.10, 0.08, 0.06],
  });

  // 2. FCF projection
  const revenues = revenueProjection.projections.map(p => p.totalRevenue);
  const fcfProjection = projectFCF({
    revenues,
    ebitdaMargin: ebitdaMargin || 0.20,
  });

  // 3. DCF valuation
  const dcfValuation = calculateDCF({
    projectedFCF: fcfProjection.fcfArray,
    netDebt,
  });

  // 4. Comparable company valuation
  const compValuation = comparableCompanyValuation({
    industry: industry || 'saas-marketing',
    revenue,
    ebitda,
    arr,
    netDebt,
  });

  // 5. Synergy analysis
  const synergies = calculateSynergies({
    revenueSynergies,
    costSynergies,
    integrationCost,
  });

  // 6. Sensitivity analysis
  const sensitivity = sensitivityAnalysis({
    projectedFCF: fcfProjection.fcfArray,
    netDebt,
  });

  // Combined valuation range
  const allMedians = [
    dcfValuation.equityValue,
    compValuation.blendedValuation.median,
  ];
  const combinedMedian = allMedians.reduce((s, v) => s + v, 0) / allMedians.length;

  return {
    targetName: name,
    date: new Date().toISOString().split('T')[0],
    revenueProjection,
    fcfProjection,
    dcfValuation,
    comparableValuation: compValuation,
    synergies,
    sensitivityAnalysis: sensitivity,
    summary: {
      dcfEquityValue: dcfValuation.equityValue,
      compMedianValue: compValuation.blendedValuation.median,
      combinedMedianValue: parseFloat(combinedMedian.toFixed(2)),
      netSynergyValue: synergies.netSynergyValue,
      suggestedRange: {
        low: parseFloat((combinedMedian * 0.85).toFixed(2)),
        mid: parseFloat(combinedMedian.toFixed(2)),
        high: parseFloat((combinedMedian * 1.15 + synergies.netSynergyValue * 0.5).toFixed(2)),
      },
      currency: DEFAULTS.currency,
    },
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  DEFAULTS,
  INDUSTRY_MULTIPLES,
  calculateDCF,
  projectRevenue,
  projectFCF,
  comparableCompanyValuation,
  calculateWACC,
  sensitivityAnalysis,
  calculateSynergies,
  generateValuationReport,
};
