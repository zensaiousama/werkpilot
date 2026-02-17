/**
 * Werkpilot Agents Entry Point
 * Exports all monitoring utilities and agent wrapper
 */

const { getPerformanceMonitor, PerformanceMonitor } = require('./shared/utils/performance-monitor');
const { getCostTracker, CostTracker } = require('./shared/utils/cost-tracker');
const { getAlertManager, AlertManager } = require('./shared/utils/alert-manager');
const { createAgent, AgentWrapper } = require('./shared/utils/agent-wrapper');

module.exports = {
  // Monitoring
  getPerformanceMonitor,
  PerformanceMonitor,

  // Cost tracking
  getCostTracker,
  CostTracker,

  // Alerts
  getAlertManager,
  AlertManager,

  // Agent wrapper
  createAgent,
  AgentWrapper,
};
