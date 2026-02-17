/**
 * Valuation Model
 * Werkpilot Finance Department - Agent 28 Support Module
 *
 * Simple revenue multiple valuation for M&A target assessment.
 * Supports SaaS, agency, and translation bureau valuation methods.
 */

'use strict';

/**
 * Industry revenue multiples for Swiss market
 */
const REVENUE_MULTIPLES = {
  'saas': { low: 4.0, mid: 8.0, high: 15.0 },
  'saas-growing': { low: 8.0, mid: 15.0, high: 30.0 },
  'translation-bureau': { low: 0.5, mid: 1.0, high: 2.0 },
  'digital-agency': { low: 0.8, mid: 1.5, high: 3.0 },
  'marketing-agency': { low: 0.6, mid: 1.2, high: 2.5 },
  'consulting': { low: 0.8, mid: 1.5, high: 2.5 },
  'it-services': { low: 1.0, mid: 2.0, high: 4.0 },
  'ai-startup': { low: 5.0, mid: 12.0, high: 25.0 },
  'generic': { low: 0.5, mid: 1.5, high: 3.0 },
};

/**
 * EBITDA multiples
 */
const EBITDA_MULTIPLES = {
  'saas': { low: 10, mid: 20, high: 40 },
  'saas-growing': { low: 20, mid: 40, high: 80 },
  'translation-bureau': { low: 3, mid: 5, high: 8 },
  'digital-agency': { low: 4, mid: 6, high: 10 },
  'marketing-agency': { low: 3, mid: 5, high: 8 },
  'consulting': { low: 4, mid: 7, high: 12 },
  'it-services': { low: 5, mid: 8, high: 14 },
  'ai-startup': { low: 15, mid: 30, high: 60 },
  'generic': { low: 3, mid: 6, high: 10 },
};

/**
 * Value a target using revenue multiples
 */
function revenueMultipleValuation(annualRevenue, industry, adjustments = {}) {
  const multiples = REVENUE_MULTIPLES[industry] || REVENUE_MULTIPLES['generic'];

  const {
    growthRate = 0,
    recurringRevenuePct = 0,
    customerConcentration = 0,
    marketPosition = 'average',
  } = adjustments;

  // Adjust multiples based on quality factors
  let multiplierAdj = 1.0;

  // Growth premium/discount
  if (growthRate > 0.30) multiplierAdj += 0.3;
  else if (growthRate > 0.15) multiplierAdj += 0.15;
  else if (growthRate < 0) multiplierAdj -= 0.2;

  // Recurring revenue premium
  if (recurringRevenuePct > 80) multiplierAdj += 0.25;
  else if (recurringRevenuePct > 50) multiplierAdj += 0.1;

  // Customer concentration discount
  if (customerConcentration > 50) multiplierAdj -= 0.3;
  else if (customerConcentration > 30) multiplierAdj -= 0.15;

  // Market position
  if (marketPosition === 'leader') multiplierAdj += 0.2;
  else if (marketPosition === 'weak') multiplierAdj -= 0.2;

  return {
    method: 'Revenue Multiple',
    industry,
    annualRevenue,
    multiples: {
      low: Math.round(multiples.low * multiplierAdj * 100) / 100,
      mid: Math.round(multiples.mid * multiplierAdj * 100) / 100,
      high: Math.round(multiples.high * multiplierAdj * 100) / 100,
    },
    valuation: {
      low: Math.round(annualRevenue * multiples.low * multiplierAdj),
      mid: Math.round(annualRevenue * multiples.mid * multiplierAdj),
      high: Math.round(annualRevenue * multiples.high * multiplierAdj),
    },
    adjustmentFactor: Math.round(multiplierAdj * 100) / 100,
    adjustments,
  };
}

/**
 * Value a target using EBITDA multiples
 */
function ebitdaMultipleValuation(ebitda, industry, adjustments = {}) {
  const multiples = EBITDA_MULTIPLES[industry] || EBITDA_MULTIPLES['generic'];
  const multiplierAdj = 1.0; // Can apply same adjustments as revenue

  return {
    method: 'EBITDA Multiple',
    industry,
    ebitda,
    multiples: {
      low: multiples.low * multiplierAdj,
      mid: multiples.mid * multiplierAdj,
      high: multiples.high * multiplierAdj,
    },
    valuation: {
      low: Math.round(ebitda * multiples.low * multiplierAdj),
      mid: Math.round(ebitda * multiples.mid * multiplierAdj),
      high: Math.round(ebitda * multiples.high * multiplierAdj),
    },
  };
}

/**
 * Calculate strategic value / synergy value
 */
function synergyValuation(baseValuation, synergies) {
  const {
    revenueUpside = 0,          // Additional revenue from cross-sell
    costSavings = 0,            // Annual cost savings from consolidation
    customerBase = 0,           // Value of acquiring customer base
    technologyValue = 0,        // Value of acquiring tech/IP
    talentValue = 0,            // Value of acquiring team
    timeToMarketSavings = 0,    // Months saved * monthly cost
  } = synergies;

  const totalSynergies = revenueUpside + costSavings + customerBase +
    technologyValue + talentValue + timeToMarketSavings;

  return {
    baseValuation,
    synergies: {
      revenueUpside,
      costSavings,
      customerBase,
      technologyValue,
      talentValue,
      timeToMarketSavings,
      total: totalSynergies,
    },
    adjustedValuation: {
      low: baseValuation.low + totalSynergies * 0.5,
      mid: baseValuation.mid + totalSynergies * 0.75,
      high: baseValuation.high + totalSynergies,
    },
  };
}

/**
 * Generate a one-page acquisition brief
 */
function generateAcquisitionBrief(target) {
  const {
    name,
    industry,
    location,
    annualRevenue,
    employees,
    founded,
    description,
    valuation,
    rationale,
    risks,
    synergies,
  } = target;

  const fmt = (val) => `CHF ${val.toLocaleString('de-CH')}`;

  return `# Acquisition Brief: ${name}

## Company Overview
| Attribute | Details |
|-----------|---------|
| Company | ${name} |
| Industry | ${industry} |
| Location | ${location} |
| Founded | ${founded || 'N/A'} |
| Employees | ${employees || 'N/A'} |
| Annual Revenue | ${annualRevenue ? fmt(annualRevenue) : 'N/A'} |

## Description
${description || 'No description available.'}

## Valuation Range
| Scenario | Value |
|----------|-------|
| Conservative | ${valuation ? fmt(valuation.low) : 'TBD'} |
| Expected | ${valuation ? fmt(valuation.mid) : 'TBD'} |
| Optimistic | ${valuation ? fmt(valuation.high) : 'TBD'} |

## Strategic Rationale
${rationale ? rationale.map(r => `- ${r}`).join('\n') : '- To be determined'}

## Key Synergies
${synergies ? synergies.map(s => `- ${s}`).join('\n') : '- To be analyzed'}

## Key Risks
${risks ? risks.map(r => `- ${r}`).join('\n') : '- To be assessed'}

## Recommendation
**Priority:** ${target.priority || 'Medium'}
**Next Steps:** ${target.nextSteps || 'Conduct preliminary due diligence'}

---
*Generated by Werkpilot M&A Scout Agent on ${new Date().toISOString().split('T')[0]}*
`;
}

/**
 * Score an acquisition target (0-100)
 */
function scoreTarget(target) {
  let score = 50; // baseline

  // Revenue attractiveness
  if (target.annualRevenue > 1000000) score += 10;
  else if (target.annualRevenue > 500000) score += 5;

  // Strategic fit
  if (target.strategicFit === 'high') score += 15;
  else if (target.strategicFit === 'medium') score += 8;

  // Growth rate
  if (target.growthRate > 0.20) score += 10;
  else if (target.growthRate > 0) score += 5;
  else if (target.growthRate < 0) score -= 10;

  // Customer base overlap
  if (target.customerOverlap === 'complementary') score += 10;
  else if (target.customerOverlap === 'overlapping') score -= 5;

  // Technology value
  if (target.hasProprietaryTech) score += 10;

  // Financial health
  if (target.isDistressed) score += 5; // discount opportunity
  if (target.isProfitable) score += 5;

  // Location
  if (target.isSwiss) score += 5;

  return Math.max(0, Math.min(100, score));
}

module.exports = {
  REVENUE_MULTIPLES,
  EBITDA_MULTIPLES,
  revenueMultipleValuation,
  ebitdaMultipleValuation,
  synergyValuation,
  generateAcquisitionBrief,
  scoreTarget,
};
