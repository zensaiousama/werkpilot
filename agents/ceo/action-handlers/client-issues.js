/**
 * Action Handler: Client Issues
 *
 * Gathers context for client-related decisions including
 * client history, revenue impact, satisfaction data, and
 * recent communication logs.
 */

const { getRecords } = require('../../shared/utils/airtable-client');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('ceo-handler-client-issues');

/**
 * Gather context specific to client issue decisions.
 */
async function gatherContext(decision) {
  const context = {
    clientHistory: null,
    recentInteractions: [],
    revenueImpact: null,
    otherOpenIssues: [],
    clientSegment: null,
  };

  const clientName = decision.RelatedClient;

  if (!clientName) {
    logger.info('No client specified, gathering general client context');
    return context;
  }

  try {
    // Get client record with full details
    const clients = await getRecords(
      'Clients',
      `{Name} = '${clientName}'`,
      1
    );

    if (clients.length > 0) {
      context.clientHistory = clients[0];
      context.clientSegment = clients[0].Segment || 'unknown';
    }
  } catch (err) {
    logger.warn(`Could not fetch client record: ${err.message}`);
  }

  try {
    // Get revenue data for this client
    const revenue = await getRecords(
      'Revenue',
      `{Client} = '${clientName}'`,
      12
    );

    if (revenue.length > 0) {
      const totalRevenue = revenue.reduce((sum, r) => sum + (r.Amount || 0), 0);
      const monthlyAvg = totalRevenue / Math.max(revenue.length, 1);

      context.revenueImpact = {
        totalRevenue,
        monthlyAverage: Math.round(monthlyAvg),
        recordCount: revenue.length,
        recentEntries: revenue.slice(0, 3),
      };
    }
  } catch (err) {
    logger.warn(`Could not fetch revenue data: ${err.message}`);
  }

  try {
    // Check for other open issues with this client
    const openIssues = await getRecords(
      'Decisions',
      `AND({RelatedClient} = '${clientName}', {Category} = 'client-issues', {Status} != 'archived')`,
      10
    );

    context.otherOpenIssues = openIssues.map(i => ({
      title: i.Title,
      status: i.Status,
      urgency: i.Urgency,
    }));
  } catch (err) {
    logger.warn(`Could not fetch open issues: ${err.message}`);
  }

  try {
    // Get recent tasks related to this client
    const tasks = await getRecords(
      'Tasks',
      `{Client} = '${clientName}'`,
      10
    );

    context.recentInteractions = tasks.slice(0, 5).map(t => ({
      title: t.Title || t.Name,
      status: t.Status,
      date: t.Date || t.CreatedAt,
    }));
  } catch (err) {
    logger.warn(`Could not fetch client tasks: ${err.message}`);
  }

  logger.info(`Client issues context gathered for "${clientName}": ${JSON.stringify({
    hasClientHistory: !!context.clientHistory,
    revenueRecords: context.revenueImpact?.recordCount || 0,
    openIssues: context.otherOpenIssues.length,
    recentInteractions: context.recentInteractions.length,
  })}`);

  return context;
}

/**
 * Execute follow-up actions after a client issue decision is made.
 */
async function executeDecision(decision, chosenOption) {
  logger.info(`Executing client issue decision: ${decision.Title} -> ${chosenOption}`);

  // Log the execution for audit trail
  return {
    executed: true,
    action: `Client issue decision "${decision.Title}" executed with option ${chosenOption}`,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { gatherContext, executeDecision };
