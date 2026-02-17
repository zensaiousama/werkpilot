/**
 * Action Handler: Partnerships
 *
 * Gathers context for partnership-related decisions including
 * current partner ecosystem, revenue from partnerships,
 * market fit analysis, and resource requirements.
 */

const { getRecords } = require('../../shared/utils/airtable-client');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('ceo-handler-partnerships');

/**
 * Gather context specific to partnership decisions.
 */
async function gatherContext(decision) {
  const context = {
    currentPartners: [],
    partnerRevenue: null,
    companyResources: null,
    recentLeads: [],
    pastPartnershipDecisions: [],
    clientFeedback: [],
  };

  try {
    // Get current clients that might be partners
    const clients = await getRecords('Clients', '', 50);

    context.currentPartners = clients
      .filter(c => c.Type === 'partner' || c.Type === 'Partner' || c.IsPartner)
      .map(c => ({
        name: c.Name,
        type: c.PartnerType || c.Type,
        status: c.Status,
        revenue: c.MRR || c.MonthlyRevenue || 0,
        since: c.StartDate || c.CreatedAt,
      }));

    // General client overview for market context
    context.clientOverview = {
      totalClients: clients.length,
      activeClients: clients.filter(c => c.Status === 'active' || c.Status === 'Active').length,
      industries: [...new Set(clients.map(c => c.Industry).filter(Boolean))],
    };
  } catch (err) {
    logger.warn(`Could not fetch client/partner data: ${err.message}`);
  }

  try {
    // Get revenue data related to partnerships
    const revenue = await getRecords('Revenue', '', 50);

    const partnerRevenue = revenue.filter(r =>
      r.Source === 'partner' || r.Source === 'Partnership' || r.Type === 'partner'
    );

    const totalPartnerRevenue = partnerRevenue.reduce((sum, r) => sum + (r.Amount || 0), 0);
    const totalRevenue = revenue.reduce((sum, r) => sum + (r.Amount || 0), 0);

    context.partnerRevenue = {
      total: totalPartnerRevenue,
      percentOfTotal: totalRevenue > 0
        ? `${((totalPartnerRevenue / totalRevenue) * 100).toFixed(1)}%`
        : '0%',
      entries: partnerRevenue.length,
    };
  } catch (err) {
    logger.warn(`Could not fetch revenue data: ${err.message}`);
  }

  try {
    // Get recent leads for partner sourcing analysis
    const leads = await getRecords('Leads', '', 30);

    context.recentLeads = leads.slice(0, 10).map(l => ({
      name: l.Name || l.Company,
      source: l.Source,
      status: l.Status,
      industry: l.Industry,
      value: l.EstimatedValue || l.Value || 0,
    }));

    // Check which leads come from partner referrals
    const partnerReferrals = leads.filter(l =>
      l.Source === 'partner' || l.Source === 'referral' || l.Source === 'Partner'
    );

    context.partnerLeadConversion = {
      totalLeads: leads.length,
      partnerReferrals: partnerReferrals.length,
      referralRate: leads.length > 0
        ? `${((partnerReferrals.length / leads.length) * 100).toFixed(1)}%`
        : '0%',
    };
  } catch (err) {
    logger.warn(`Could not fetch leads data: ${err.message}`);
  }

  try {
    // Get current resource/project load
    const projects = await getRecords('Projects', '', 20);

    const activeProjects = projects.filter(p =>
      p.Status !== 'completed' && p.Status !== 'archived'
    );

    context.companyResources = {
      activeProjects: activeProjects.length,
      projectLoad: activeProjects.map(p => ({
        name: p.Name || p.Title,
        status: p.Status,
        priority: p.Priority,
      })),
    };
  } catch (err) {
    logger.warn(`Could not fetch projects: ${err.message}`);
  }

  try {
    // Get past partnership decisions for learning
    const pastPartnerships = await getRecords(
      'Decisions',
      "AND({Category} = 'partnerships', {Status} = 'implemented')",
      5
    );

    context.pastPartnershipDecisions = pastPartnerships.map(d => ({
      title: d.Title,
      decision: d.CEODecision,
      outcome: d.Outcome,
      rating: d.OutcomeRating,
      financialImpact: d.FinancialImpact,
    }));
  } catch (err) {
    logger.warn(`Could not fetch past partnership decisions: ${err.message}`);
  }

  logger.info(`Partnerships context gathered: ${JSON.stringify({
    currentPartners: context.currentPartners.length,
    hasPartnerRevenue: !!context.partnerRevenue,
    recentLeads: context.recentLeads.length,
    pastDecisions: context.pastPartnershipDecisions.length,
  })}`);

  return context;
}

/**
 * Execute follow-up actions after a partnership decision is made.
 */
async function executeDecision(decision, chosenOption) {
  logger.info(`Executing partnership decision: ${decision.Title} -> ${chosenOption}`);

  return {
    executed: true,
    action: `Partnership decision "${decision.Title}" executed with option ${chosenOption}`,
    timestamp: new Date().toISOString(),
    notes: 'Draft partnership agreement and schedule intro call',
  };
}

module.exports = { gatherContext, executeDecision };
