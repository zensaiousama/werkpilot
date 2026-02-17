#!/usr/bin/env node
'use strict';

/**
 * Werkpilot Health Dashboard
 *
 * Express server providing REST endpoints for monitoring
 * the orchestrator and all 42 agents.
 *
 * Endpoints:
 *   GET /health         - Overall system health
 *   GET /agents         - Status of all agents
 *   GET /agents/:name   - Specific agent details
 *   GET /metrics        - Performance metrics
 *   GET /messages       - Recent message bus activity
 *   GET /departments    - Health by department
 */

const express = require('express');
const { createLogger } = require('./shared/utils/logger');

const logger = createLogger('health-dashboard');

function createApp(orchestrator) {
  const app = express();

  // ---------------------------------------------------------------------------
  // Middleware
  // ---------------------------------------------------------------------------
  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Werkpilot-Service', 'health-dashboard');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.path !== '/health') {
        logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
      }
    });
    next();
  });

  // ---------------------------------------------------------------------------
  // GET /health - Overall system health
  // ---------------------------------------------------------------------------
  app.get('/health', (req, res) => {
    try {
      const data = orchestrator.getDashboardData();
      const system = data.system;
      const agents = data.agents;

      const healthy = agents.filter(a => ['ready', 'running'].includes(a.status)).length;
      const degraded = agents.filter(a => a.status === 'degraded').length;
      const errored = agents.filter(a => ['error', 'timeout', 'disabled_by_failure'].includes(a.status)).length;
      const missing = agents.filter(a => a.status === 'missing').length;
      const enabled = agents.filter(a => a.enabled).length;

      const healthPercentage = enabled > 0 ? Math.round((healthy / enabled) * 100) : 0;

      let status = 'healthy';
      if (healthPercentage < 80) status = 'degraded';
      if (healthPercentage < 50) status = 'critical';
      if (system.isShuttingDown) status = 'shutting_down';

      res.json({
        status,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: {
          ms: system.uptimeMs,
          human: formatUptime(system.uptimeMs),
          bootTime: system.bootTime,
        },
        agents: {
          total: system.totalAgents,
          enabled,
          healthy,
          degraded,
          errored,
          missing,
          healthPercentage,
        },
        globalRestartCount: system.globalRestartCount,
      });
    } catch (err) {
      logger.error(`Health endpoint error: ${err.message}`);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /agents - Status of all agents
  // ---------------------------------------------------------------------------
  app.get('/agents', (req, res) => {
    try {
      const data = orchestrator.getDashboardData();
      let agents = data.agents;

      // Optional filters
      const { department, status, enabled } = req.query;
      if (department) {
        agents = agents.filter(a => a.department === department);
      }
      if (status) {
        agents = agents.filter(a => a.status === status);
      }
      if (enabled !== undefined) {
        const flag = enabled === 'true';
        agents = agents.filter(a => a.enabled === flag);
      }

      // Sort by department, then name
      agents.sort((a, b) => {
        if (a.department !== b.department) return a.department.localeCompare(b.department);
        return a.name.localeCompare(b.name);
      });

      res.json({
        count: agents.length,
        timestamp: new Date().toISOString(),
        agents,
      });
    } catch (err) {
      logger.error(`Agents endpoint error: ${err.message}`);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /agents/:name - Specific agent status
  // ---------------------------------------------------------------------------
  app.get('/agents/:name', (req, res) => {
    try {
      const agentData = orchestrator.getAgentData(req.params.name);
      if (!agentData) {
        return res.status(404).json({
          status: 'not_found',
          message: `Agent "${req.params.name}" not found`,
          availableAgents: orchestrator.getDashboardData().agents.map(a => a.name),
        });
      }

      res.json({
        timestamp: new Date().toISOString(),
        agent: agentData,
      });
    } catch (err) {
      logger.error(`Agent detail endpoint error: ${err.message}`);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /metrics - Performance metrics
  // ---------------------------------------------------------------------------
  app.get('/metrics', (req, res) => {
    try {
      const data = orchestrator.getDashboardData();
      const metrics = data.metrics;

      // Compute aggregate statistics
      const scores = Object.values(metrics).map(m => m.currentScore);
      const totalRuns = Object.values(metrics).reduce((sum, m) => sum + m.totalRuns, 0);
      const totalSuccess = Object.values(metrics).reduce((sum, m) => sum + m.successfulRuns, 0);
      const totalFailed = Object.values(metrics).reduce((sum, m) => sum + m.failedRuns, 0);

      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
        : 0;
      const minScore = scores.length > 0 ? Math.min(...scores) : 0;
      const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

      // Top performers
      const agentScores = Object.entries(metrics)
        .map(([name, m]) => ({ name, score: m.currentScore, totalRuns: m.totalRuns }))
        .sort((a, b) => b.score - a.score);

      const topPerformers = agentScores.slice(0, 10);
      const underperformers = agentScores.filter(a => a.score < 40 && a.totalRuns > 0);

      res.json({
        timestamp: new Date().toISOString(),
        summary: {
          averageScore: avgScore,
          minScore,
          maxScore,
          totalRuns,
          successfulRuns: totalSuccess,
          failedRuns: totalFailed,
          successRate: totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0,
        },
        topPerformers,
        underperformers,
        departments: data.departments,
        perAgent: metrics,
      });
    } catch (err) {
      logger.error(`Metrics endpoint error: ${err.message}`);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /messages - Recent message bus activity
  // ---------------------------------------------------------------------------
  app.get('/messages', (req, res) => {
    try {
      const data = orchestrator.getDashboardData();
      const count = Math.min(parseInt(req.query.count) || 50, 200);
      const topic = req.query.topic;

      let messages = data.recentMessages;
      if (topic) {
        messages = messages.filter(m => m.topic.includes(topic));
      }

      res.json({
        timestamp: new Date().toISOString(),
        count: messages.length,
        messages: messages.slice(-count),
      });
    } catch (err) {
      logger.error(`Messages endpoint error: ${err.message}`);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /departments - Health by department
  // ---------------------------------------------------------------------------
  app.get('/departments', (req, res) => {
    try {
      const data = orchestrator.getDashboardData();
      res.json({
        timestamp: new Date().toISOString(),
        departments: data.departments,
      });
    } catch (err) {
      logger.error(`Departments endpoint error: ${err.message}`);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // 404 handler
  // ---------------------------------------------------------------------------
  app.use((req, res) => {
    res.status(404).json({
      status: 'not_found',
      message: `Route not found: ${req.method} ${req.path}`,
      availableRoutes: [
        'GET /health',
        'GET /agents',
        'GET /agents/:name',
        'GET /metrics',
        'GET /messages',
        'GET /departments',
      ],
    });
  });

  // ---------------------------------------------------------------------------
  // Error handler
  // ---------------------------------------------------------------------------
  app.use((err, req, res, _next) => {
    logger.error(`Unhandled route error: ${err.message}`, { stack: err.stack });
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ---------------------------------------------------------------------------
// Start function (called by orchestrator)
// ---------------------------------------------------------------------------
function start(orchestrator, port = 3001) {
  const app = createApp(orchestrator);

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`Health dashboard listening on http://0.0.0.0:${port}`);
    logger.info('Available endpoints:');
    logger.info('  GET /health       - Overall system health');
    logger.info('  GET /agents       - All agent statuses');
    logger.info('  GET /agents/:name - Specific agent detail');
    logger.info('  GET /metrics      - Performance metrics');
    logger.info('  GET /messages     - Message bus activity');
    logger.info('  GET /departments  - Department health');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${port} is already in use. Dashboard will not start.`);
    } else {
      logger.error(`Dashboard server error: ${err.message}`);
    }
  });

  return server;
}

// ---------------------------------------------------------------------------
// Standalone mode (for testing)
// ---------------------------------------------------------------------------
if (require.main === module) {
  // Create a mock orchestrator for standalone testing
  const mockOrchestrator = {
    getDashboardData: () => ({
      system: {
        bootTime: new Date().toISOString(),
        uptimeMs: 0,
        totalAgents: 42,
        enabledAgents: 42,
        isShuttingDown: false,
        globalRestartCount: 0,
      },
      agents: [],
      departments: {},
      metrics: {},
      recentMessages: [],
    }),
    getAgentData: () => null,
  };

  const port = parseInt(process.env.PORT) || 3001;
  start(mockOrchestrator, port);
  logger.info('Running in standalone/test mode with mock data');
}

module.exports = { createApp, start };
