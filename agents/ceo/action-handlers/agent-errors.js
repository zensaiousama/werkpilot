/**
 * Action Handler: Agent Errors
 *
 * Gathers context for agent error-related decisions including
 * error logs, error frequency, affected systems, and
 * potential fixes or escalation paths.
 */

const path = require('path');
const fs = require('fs');
const { getRecords } = require('../../shared/utils/airtable-client');
const { createLogger } = require('../../shared/utils/logger');
const config = require('../../shared/utils/config');

const logger = createLogger('ceo-handler-agent-errors');

/**
 * Read recent error logs from a specific agent.
 */
function readRecentErrors(agentName, maxLines = 40) {
  const errorLogPath = path.join(config.paths.logs, agentName, 'error.log');
  const combinedLogPath = path.join(config.paths.logs, agentName, 'combined.log');

  const result = { errors: [], recentActivity: [] };

  try {
    if (fs.existsSync(errorLogPath)) {
      const content = fs.readFileSync(errorLogPath, 'utf-8');
      const lines = content.trim().split('\n').slice(-maxLines);
      result.errors = lines.map(line => {
        try { return JSON.parse(line); } catch { return { message: line }; }
      });
    }
  } catch (err) {
    logger.warn(`Could not read error log for ${agentName}: ${err.message}`);
  }

  try {
    if (fs.existsSync(combinedLogPath)) {
      const content = fs.readFileSync(combinedLogPath, 'utf-8');
      const lines = content.trim().split('\n').slice(-20);
      result.recentActivity = lines.map(line => {
        try { return JSON.parse(line); } catch { return { message: line }; }
      });
    }
  } catch (err) {
    logger.warn(`Could not read combined log for ${agentName}: ${err.message}`);
  }

  return result;
}

/**
 * Gather context specific to agent error decisions.
 */
async function gatherContext(decision) {
  const context = {
    errorDetails: {},
    affectedAgents: [],
    errorFrequency: {},
    systemStatus: [],
    pastAgentErrors: [],
  };

  // Determine which agent(s) are affected from the description
  const allAgents = ['sales', 'marketing', 'operations', 'finance', 'hr', 'it', 'product', 'strategy'];
  const description = (decision.Description || '').toLowerCase();

  const affectedAgents = allAgents.filter(agent => description.includes(agent));
  if (affectedAgents.length === 0) {
    // If no specific agent mentioned, check all agents for errors
    context.affectedAgents = allAgents;
  } else {
    context.affectedAgents = affectedAgents;
  }

  // Read error logs for affected agents
  for (const agent of context.affectedAgents) {
    const agentLogs = readRecentErrors(agent);
    if (agentLogs.errors.length > 0 || agentLogs.recentActivity.length > 0) {
      context.errorDetails[agent] = agentLogs;
    }
  }

  // Calculate error frequency per agent
  for (const [agent, logs] of Object.entries(context.errorDetails)) {
    const errorCount = (logs.errors || []).length;
    const last24h = (logs.errors || []).filter(e => {
      const ts = e.timestamp || '';
      if (!ts) return false;
      return (Date.now() - new Date(ts).getTime()) < 86400000;
    }).length;

    context.errorFrequency[agent] = {
      total: errorCount,
      last24h,
      severity: last24h > 10 ? 'critical' : last24h > 5 ? 'high' : last24h > 0 ? 'medium' : 'none',
    };
  }

  try {
    // Get agent status from Airtable
    const agentStatus = await getRecords('AgentStatus', '', 20);
    context.systemStatus = agentStatus.map(s => ({
      agent: s.Agent || s.Name,
      status: s.Status,
      lastRun: s.LastRun || s.LastActivity,
      errorRate: s.ErrorRate,
    }));
  } catch (err) {
    logger.warn(`Could not fetch agent status: ${err.message}`);
  }

  try {
    // Get past agent error decisions for learning
    const pastErrors = await getRecords(
      'Decisions',
      "AND({Category} = 'agent-errors', {Status} = 'implemented')",
      5
    );

    context.pastAgentErrors = pastErrors.map(d => ({
      title: d.Title,
      decision: d.CEODecision,
      outcome: d.Outcome,
      rating: d.OutcomeRating,
    }));
  } catch (err) {
    logger.warn(`Could not fetch past error decisions: ${err.message}`);
  }

  logger.info(`Agent errors context gathered: ${JSON.stringify({
    affectedAgents: context.affectedAgents.length,
    errorsFound: Object.keys(context.errorDetails).length,
    systemStatusRecords: context.systemStatus.length,
  })}`);

  return context;
}

/**
 * Execute follow-up actions after an agent error decision is made.
 */
async function executeDecision(decision, chosenOption) {
  logger.info(`Executing agent error decision: ${decision.Title} -> ${chosenOption}`);

  return {
    executed: true,
    action: `Agent error decision "${decision.Title}" executed with option ${chosenOption}`,
    timestamp: new Date().toISOString(),
    notes: 'Monitor agent health after fix is applied',
  };
}

module.exports = { gatherContext, executeDecision };
