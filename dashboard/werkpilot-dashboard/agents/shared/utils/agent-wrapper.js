/**
 * Agent Wrapper Utility
 * Simplifies integration of monitoring, cost tracking, and alerting for agents
 */

const { getPerformanceMonitor } = require('./performance-monitor');
const { getCostTracker } = require('./cost-tracker');
const { getAlertManager } = require('./alert-manager');

class AgentWrapper {
  constructor(name, department, config = {}) {
    this.name = name;
    this.department = department;
    this.config = {
      model: 'haiku', // default model
      trackPerformance: true,
      trackCosts: true,
      enableAlerts: true,
      ...config,
    };

    this.performanceMonitor = null;
    this.costTracker = null;
    this.alertManager = null;

    this.currentExecution = null;
  }

  /**
   * Initialize the agent wrapper
   */
  async init() {
    if (this.config.trackPerformance) {
      this.performanceMonitor = getPerformanceMonitor();
    }

    if (this.config.trackCosts) {
      this.costTracker = getCostTracker();
    }

    if (this.config.enableAlerts) {
      this.alertManager = getAlertManager();
    }
  }

  /**
   * Start tracking an execution
   */
  startExecution() {
    this.currentExecution = {
      startTime: Date.now(),
      startCpu: process.cpuUsage(),
      startMemory: process.memoryUsage().heapUsed,
      apiCalls: 0,
    };
  }

  /**
   * Track an API call
   */
  trackApiCall() {
    if (this.currentExecution) {
      this.currentExecution.apiCalls++;
    }
  }

  /**
   * End tracking and report metrics
   */
  endExecution(status, data = {}) {
    if (!this.currentExecution) {
      console.warn(`No execution started for agent ${this.name}`);
      return;
    }

    const endTime = Date.now();
    const endCpu = process.cpuUsage(this.currentExecution.startCpu);
    const endMemory = process.memoryUsage().heapUsed;

    const duration = endTime - this.currentExecution.startTime;
    const cpuTime = (endCpu.user + endCpu.system) / 1000; // Convert to ms
    const memoryDelta = endMemory - this.currentExecution.startMemory;

    const { inputTokens = 0, outputTokens = 0, tokensUsed = 0, model = this.config.model } = data;

    // Calculate cost
    let cost = 0;
    if (this.costTracker) {
      const costResult = this.costTracker.trackCost(this.name, this.department, {
        model,
        inputTokens,
        outputTokens,
        tokensUsed,
      });
      cost = costResult.cost;
    }

    // Track performance
    if (this.performanceMonitor) {
      this.performanceMonitor.trackExecution(this.name, {
        duration,
        status,
        tokensUsed: tokensUsed || inputTokens + outputTokens,
        model,
        cost,
        cpuTime,
        memoryDelta,
        apiCalls: this.currentExecution.apiCalls,
      });
    }

    // Reset execution
    const executionData = {
      duration,
      status,
      cpuTime,
      memoryDelta,
      apiCalls: this.currentExecution.apiCalls,
      cost,
    };

    this.currentExecution = null;

    return executionData;
  }

  /**
   * Execute an agent task with automatic tracking
   */
  async execute(taskFn, data = {}) {
    this.startExecution();

    try {
      const result = await taskFn();

      // End execution with success
      const metrics = this.endExecution('completed', data);

      return {
        success: true,
        result,
        metrics,
      };
    } catch (error) {
      // End execution with error
      const metrics = this.endExecution('error', data);

      // Send error alert
      if (this.alertManager) {
        this.alertManager.addAlert({
          level: 'warning',
          type: 'agent_error',
          message: `Agent ${this.name} execution failed: ${error.message}`,
          data: {
            agent: this.name,
            department: this.department,
            error: error.message,
            stack: error.stack,
          },
        });
      }

      return {
        success: false,
        error: error.message,
        metrics,
      };
    }
  }

  /**
   * Send a custom alert
   */
  alert(level, message, data = {}) {
    if (this.alertManager) {
      this.alertManager.addAlert({
        level,
        type: 'agent_custom',
        message: `[${this.name}] ${message}`,
        data: {
          agent: this.name,
          department: this.department,
          ...data,
        },
      });
    }
  }

  /**
   * Log info
   */
  info(message, data = {}) {
    this.alert('info', message, data);
  }

  /**
   * Log warning
   */
  warn(message, data = {}) {
    this.alert('warning', message, data);
  }

  /**
   * Log critical
   */
  critical(message, data = {}) {
    this.alert('critical', message, data);
  }

  /**
   * Get agent metrics
   */
  getMetrics() {
    if (this.performanceMonitor) {
      return this.performanceMonitor.getAgentMetrics(this.name);
    }
    return null;
  }

  /**
   * Get agent costs
   */
  getCosts() {
    if (this.costTracker) {
      return this.costTracker.getAgentCost(this.name);
    }
    return null;
  }
}

/**
 * Create an agent wrapper
 */
function createAgent(name, department, config = {}) {
  const agent = new AgentWrapper(name, department, config);
  agent.init();
  return agent;
}

module.exports = {
  AgentWrapper,
  createAgent,
};
