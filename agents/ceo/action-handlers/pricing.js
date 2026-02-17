/**
 * Action Handler: Pricing
 *
 * Gathers context for pricing-related decisions including
 * current pricing tiers, competitor data, revenue trends,
 * and client sensitivity analysis.
 */

const { getRecords } = require('../../shared/utils/airtable-client');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('ceo-handler-pricing');

/**
 * Gather context specific to pricing decisions.
 */
async function gatherContext(decision) {
  const context = {
    currentRevenue: null,
    clientDistribution: [],
    revenuePerClient: [],
    recentPricingDecisions: [],
    marketData: null,
  };

  try {
    // Get overall revenue data
    const revenue = await getRecords('Revenue', '', 50);

    if (revenue.length > 0) {
      const totalRevenue = revenue.reduce((sum, r) => sum + (r.Amount || 0), 0);
      const monthlyRevenue = {};

      for (const r of revenue) {
        const month = (r.Date || r.CreatedAt || '').substring(0, 7);
        if (month) {
          monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (r.Amount || 0);
        }
      }

      context.currentRevenue = {
        total: totalRevenue,
        monthlyBreakdown: monthlyRevenue,
        averagePerEntry: Math.round(totalRevenue / revenue.length),
        entryCount: revenue.length,
      };
    }
  } catch (err) {
    logger.warn(`Could not fetch revenue data: ${err.message}`);
  }

  try {
    // Get client data for distribution analysis
    const clients = await getRecords('Clients', '', 50);

    context.clientDistribution = clients.map(c => ({
      name: c.Name,
      plan: c.Plan || c.Tier || 'unknown',
      mrr: c.MRR || c.MonthlyRevenue || 0,
      status: c.Status,
      since: c.StartDate || c.CreatedAt,
    }));

    // Calculate revenue per client tier
    const tierGroups = {};
    for (const client of context.clientDistribution) {
      const tier = client.plan;
      if (!tierGroups[tier]) tierGroups[tier] = { count: 0, totalMRR: 0 };
      tierGroups[tier].count++;
      tierGroups[tier].totalMRR += client.mrr;
    }
    context.tierAnalysis = tierGroups;
  } catch (err) {
    logger.warn(`Could not fetch client data: ${err.message}`);
  }

  try {
    // Get previous pricing decisions for learning
    const pastPricing = await getRecords(
      'Decisions',
      "AND({Category} = 'pricing', {Status} = 'implemented')",
      5
    );

    context.recentPricingDecisions = pastPricing.map(d => ({
      title: d.Title,
      decision: d.CEODecision,
      outcome: d.Outcome,
      rating: d.OutcomeRating,
      financialImpact: d.FinancialImpact,
    }));
  } catch (err) {
    logger.warn(`Could not fetch past pricing decisions: ${err.message}`);
  }

  logger.info(`Pricing context gathered: ${JSON.stringify({
    revenueEntries: context.currentRevenue?.entryCount || 0,
    clientCount: context.clientDistribution.length,
    pastDecisions: context.recentPricingDecisions.length,
  })}`);

  return context;
}

/**
 * Execute follow-up actions after a pricing decision is made.
 */
async function executeDecision(decision, chosenOption) {
  logger.info(`Executing pricing decision: ${decision.Title} -> ${chosenOption}`);

  return {
    executed: true,
    action: `Pricing decision "${decision.Title}" executed with option ${chosenOption}`,
    timestamp: new Date().toISOString(),
    notes: 'Update client contracts and billing accordingly',
  };
}

module.exports = { gatherContext, executeDecision };
