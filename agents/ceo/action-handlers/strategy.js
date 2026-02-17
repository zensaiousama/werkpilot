/**
 * Action Handler: Strategy
 *
 * Gathers context for strategic decisions including
 * market data, competitive landscape, financial health,
 * team capacity, and growth metrics.
 */

const { getRecords } = require('../../shared/utils/airtable-client');
const { createLogger } = require('../../shared/utils/logger');

const logger = createLogger('ceo-handler-strategy');

/**
 * Gather context specific to strategic decisions.
 */
async function gatherContext(decision) {
  const context = {
    financialHealth: null,
    growthMetrics: null,
    activeProjects: [],
    teamCapacity: null,
    marketContext: null,
    pastStrategyDecisions: [],
  };

  try {
    // Get revenue data for financial health
    const revenue = await getRecords('Revenue', '', 50);

    if (revenue.length > 0) {
      const sorted = [...revenue].sort((a, b) => {
        return (a.Date || '').localeCompare(b.Date || '');
      });

      const totalRevenue = revenue.reduce((sum, r) => sum + (r.Amount || 0), 0);

      // Calculate month-over-month growth
      const monthlyTotals = {};
      for (const r of revenue) {
        const month = (r.Date || r.CreatedAt || '').substring(0, 7);
        if (month) {
          monthlyTotals[month] = (monthlyTotals[month] || 0) + (r.Amount || 0);
        }
      }

      const months = Object.keys(monthlyTotals).sort();
      let growthRate = 0;
      if (months.length >= 2) {
        const latest = monthlyTotals[months[months.length - 1]];
        const previous = monthlyTotals[months[months.length - 2]];
        if (previous > 0) {
          growthRate = ((latest - previous) / previous * 100).toFixed(1);
        }
      }

      context.financialHealth = {
        totalRevenue,
        monthlyBreakdown: monthlyTotals,
        monthOverMonthGrowth: `${growthRate}%`,
        latestMonth: months[months.length - 1] || 'N/A',
      };
    }
  } catch (err) {
    logger.warn(`Could not fetch revenue data: ${err.message}`);
  }

  try {
    // Get lead and client growth metrics
    const leads = await getRecords('Leads', '', 50);
    const clients = await getRecords('Clients', '', 50);

    const activeClients = clients.filter(c =>
      c.Status === 'active' || c.Status === 'Active'
    ).length;

    const newLeadsThisMonth = leads.filter(l => {
      const created = l.CreatedAt || l.Date || '';
      return created.startsWith(new Date().toISOString().substring(0, 7));
    }).length;

    context.growthMetrics = {
      totalLeads: leads.length,
      newLeadsThisMonth,
      totalClients: clients.length,
      activeClients,
      conversionRate: leads.length > 0
        ? `${((clients.length / leads.length) * 100).toFixed(1)}%`
        : 'N/A',
    };
  } catch (err) {
    logger.warn(`Could not fetch growth metrics: ${err.message}`);
  }

  try {
    // Get active projects
    const projects = await getRecords('Projects', '', 20);

    context.activeProjects = projects
      .filter(p => p.Status !== 'completed' && p.Status !== 'archived')
      .map(p => ({
        name: p.Name || p.Title,
        status: p.Status,
        priority: p.Priority,
        deadline: p.Deadline || p.DueDate,
        progress: p.Progress || 0,
      }));
  } catch (err) {
    logger.warn(`Could not fetch projects: ${err.message}`);
  }

  try {
    // Get task load for team capacity assessment
    const tasks = await getRecords('Tasks', '', 50);

    const openTasks = tasks.filter(t => t.Status !== 'done' && t.Status !== 'completed');
    const overdueTasks = openTasks.filter(t => {
      const due = t.DueDate || t.Deadline;
      return due && new Date(due) < new Date();
    });

    context.teamCapacity = {
      totalOpenTasks: openTasks.length,
      overdueTasks: overdueTasks.length,
      tasksByStatus: openTasks.reduce((acc, t) => {
        const status = t.Status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
    };
  } catch (err) {
    logger.warn(`Could not fetch tasks: ${err.message}`);
  }

  try {
    // Get past strategy decisions for pattern recognition
    const pastStrategy = await getRecords(
      'Decisions',
      "AND({Category} = 'strategy', {Status} = 'implemented')",
      5
    );

    context.pastStrategyDecisions = pastStrategy.map(d => ({
      title: d.Title,
      decision: d.CEODecision,
      outcome: d.Outcome,
      rating: d.OutcomeRating,
      financialImpact: d.FinancialImpact,
    }));
  } catch (err) {
    logger.warn(`Could not fetch past strategy decisions: ${err.message}`);
  }

  logger.info(`Strategy context gathered: ${JSON.stringify({
    hasFinancials: !!context.financialHealth,
    hasGrowthMetrics: !!context.growthMetrics,
    activeProjects: context.activeProjects.length,
    hasTeamCapacity: !!context.teamCapacity,
    pastDecisions: context.pastStrategyDecisions.length,
  })}`);

  return context;
}

/**
 * Execute follow-up actions after a strategy decision is made.
 */
async function executeDecision(decision, chosenOption) {
  logger.info(`Executing strategy decision: ${decision.Title} -> ${chosenOption}`);

  return {
    executed: true,
    action: `Strategy decision "${decision.Title}" executed with option ${chosenOption}`,
    timestamp: new Date().toISOString(),
    notes: 'Update roadmap and communicate to team',
  };
}

module.exports = { gatherContext, executeDecision };
