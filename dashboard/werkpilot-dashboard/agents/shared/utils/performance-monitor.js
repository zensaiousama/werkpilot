/**
 * Central Performance Monitoring System
 * Tracks agent and system-wide metrics with rolling windows and alert thresholds
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      agents: new Map(),
      system: {
        totalExecutions: 0,
        totalErrors: 0,
        totalCost: 0,
        startTime: Date.now(),
      },
      windows: {
        '1h': [],
        '24h': [],
        '7d': [],
      },
    };

    this.thresholds = {
      errorRate: {
        warning: 0.10, // 10%
        critical: 0.25, // 25%
      },
      responseTime: {
        warning: 30000, // 30 seconds
      },
      dailyBudget: 100, // $100 per day default
    };

    this.snapshotInterval = null;
    this.dataDir = path.join(__dirname, '../../../data/metrics');
  }

  /**
   * Initialize the performance monitor
   */
  async init() {
    await this.ensureDataDir();
    await this.loadLastSnapshot();
    this.startHourlySnapshots();
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create metrics directory:', error);
    }
  }

  /**
   * Track a new execution for an agent
   */
  trackExecution(agentName, data) {
    const {
      duration,
      status,
      tokensUsed = 0,
      model = 'haiku',
      cost = 0,
      cpuTime = 0,
      memoryDelta = 0,
      apiCalls = 0,
    } = data;

    // Initialize agent metrics if not exists
    if (!this.metrics.agents.has(agentName)) {
      this.metrics.agents.set(agentName, {
        name: agentName,
        executions: 0,
        errors: 0,
        totalDuration: 0,
        totalTokens: 0,
        totalCost: 0,
        totalCpuTime: 0,
        totalMemoryDelta: 0,
        totalApiCalls: 0,
        lastExecution: null,
        executions1h: [],
        executions24h: [],
        executions7d: [],
      });
    }

    const agent = this.metrics.agents.get(agentName);
    const timestamp = Date.now();
    const isError = status === 'error' || status === 'failed';

    // Update agent metrics
    agent.executions++;
    if (isError) agent.errors++;
    agent.totalDuration += duration;
    agent.totalTokens += tokensUsed;
    agent.totalCost += cost;
    agent.totalCpuTime += cpuTime;
    agent.totalMemoryDelta += memoryDelta;
    agent.totalApiCalls += apiCalls;
    agent.lastExecution = timestamp;

    // Update system metrics
    this.metrics.system.totalExecutions++;
    if (isError) this.metrics.system.totalErrors++;
    this.metrics.system.totalCost += cost;

    // Add to rolling windows
    const execution = {
      timestamp,
      duration,
      status,
      tokensUsed,
      model,
      cost,
      cpuTime,
      memoryDelta,
      apiCalls,
    };

    agent.executions1h.push(execution);
    agent.executions24h.push(execution);
    agent.executions7d.push(execution);

    this.metrics.windows['1h'].push({ agentName, ...execution });
    this.metrics.windows['24h'].push({ agentName, ...execution });
    this.metrics.windows['7d'].push({ agentName, ...execution });

    // Clean old data from windows
    this.cleanWindows();

    // Check thresholds and generate alerts
    this.checkThresholds(agentName, agent);

    return this.getAgentMetrics(agentName);
  }

  /**
   * Clean old data from rolling windows
   */
  cleanWindows() {
    const now = Date.now();
    const windows = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };

    // Clean system windows
    for (const [window, duration] of Object.entries(windows)) {
      this.metrics.windows[window] = this.metrics.windows[window].filter(
        (exec) => now - exec.timestamp < duration
      );
    }

    // Clean agent windows
    for (const agent of this.metrics.agents.values()) {
      agent.executions1h = agent.executions1h.filter(
        (exec) => now - exec.timestamp < windows['1h']
      );
      agent.executions24h = agent.executions24h.filter(
        (exec) => now - exec.timestamp < windows['24h']
      );
      agent.executions7d = agent.executions7d.filter(
        (exec) => now - exec.timestamp < windows['7d']
      );
    }
  }

  /**
   * Check thresholds and generate alerts
   */
  checkThresholds(agentName, agent) {
    const alerts = [];

    // Error rate check (24h window)
    const executions24h = agent.executions24h.length;
    if (executions24h > 10) {
      // Only check if we have enough data
      const errors24h = agent.executions24h.filter(
        (e) => e.status === 'error' || e.status === 'failed'
      ).length;
      const errorRate = errors24h / executions24h;

      if (errorRate > this.thresholds.errorRate.critical) {
        alerts.push({
          level: 'critical',
          type: 'error_rate',
          message: `Agent ${agentName} error rate is ${(errorRate * 100).toFixed(1)}% (critical threshold: 25%)`,
          value: errorRate,
          threshold: this.thresholds.errorRate.critical,
        });
      } else if (errorRate > this.thresholds.errorRate.warning) {
        alerts.push({
          level: 'warning',
          type: 'error_rate',
          message: `Agent ${agentName} error rate is ${(errorRate * 100).toFixed(1)}% (warning threshold: 10%)`,
          value: errorRate,
          threshold: this.thresholds.errorRate.warning,
        });
      }
    }

    // Average response time check (1h window)
    if (agent.executions1h.length > 0) {
      const avgResponseTime =
        agent.executions1h.reduce((sum, e) => sum + e.duration, 0) /
        agent.executions1h.length;

      if (avgResponseTime > this.thresholds.responseTime.warning) {
        alerts.push({
          level: 'warning',
          type: 'response_time',
          message: `Agent ${agentName} avg response time is ${(avgResponseTime / 1000).toFixed(1)}s (threshold: 30s)`,
          value: avgResponseTime,
          threshold: this.thresholds.responseTime.warning,
        });
      }
    }

    // Daily cost check
    const today = new Date().toISOString().split('T')[0];
    const costToday = this.getDailyCost(today);
    if (costToday > this.thresholds.dailyBudget) {
      alerts.push({
        level: 'critical',
        type: 'daily_budget',
        message: `Daily cost $${costToday.toFixed(2)} exceeds budget $${this.thresholds.dailyBudget}`,
        value: costToday,
        threshold: this.thresholds.dailyBudget,
      });
    }

    // Emit alerts if any (will be handled by alert-manager)
    if (alerts.length > 0) {
      this.emitAlerts(alerts);
    }

    return alerts;
  }

  /**
   * Emit alerts to alert manager
   */
  emitAlerts(alerts) {
    // This will be picked up by alert-manager.js
    if (global.alertManager) {
      alerts.forEach((alert) => global.alertManager.addAlert(alert));
    }
  }

  /**
   * Get metrics for a specific agent
   */
  getAgentMetrics(agentName) {
    const agent = this.metrics.agents.get(agentName);
    if (!agent) return null;

    const avgDuration = agent.executions > 0 ? agent.totalDuration / agent.executions : 0;
    const errorRate = agent.executions > 0 ? agent.errors / agent.executions : 0;

    return {
      name: agentName,
      executions: agent.executions,
      errors: agent.errors,
      errorRate,
      avgDuration,
      totalTokens: agent.totalTokens,
      totalCost: agent.totalCost,
      totalCpuTime: agent.totalCpuTime,
      totalMemoryDelta: agent.totalMemoryDelta,
      totalApiCalls: agent.totalApiCalls,
      lastExecution: agent.lastExecution,
      windows: {
        '1h': this.calculateWindowStats(agent.executions1h),
        '24h': this.calculateWindowStats(agent.executions24h),
        '7d': this.calculateWindowStats(agent.executions7d),
      },
    };
  }

  /**
   * Calculate statistics for a window
   */
  calculateWindowStats(executions) {
    if (executions.length === 0) {
      return {
        count: 0,
        errors: 0,
        errorRate: 0,
        avgDuration: 0,
        totalCost: 0,
        totalTokens: 0,
      };
    }

    const errors = executions.filter((e) => e.status === 'error' || e.status === 'failed').length;
    const totalDuration = executions.reduce((sum, e) => sum + e.duration, 0);
    const totalCost = executions.reduce((sum, e) => sum + e.cost, 0);
    const totalTokens = executions.reduce((sum, e) => sum + e.tokensUsed, 0);

    return {
      count: executions.length,
      errors,
      errorRate: errors / executions.length,
      avgDuration: totalDuration / executions.length,
      totalCost,
      totalTokens,
    };
  }

  /**
   * Get system-wide metrics
   */
  getSystemMetrics() {
    const uptime = Date.now() - this.metrics.system.startTime;
    const errorRate =
      this.metrics.system.totalExecutions > 0
        ? this.metrics.system.totalErrors / this.metrics.system.totalExecutions
        : 0;

    // Calculate executions per hour
    const executions1h = this.metrics.windows['1h'].length;
    const executionsPerHour = executions1h;

    // Calculate average response time across all agents (1h window)
    const avgResponseTime =
      executions1h > 0
        ? this.metrics.windows['1h'].reduce((sum, e) => sum + e.duration, 0) / executions1h
        : 0;

    return {
      uptime,
      totalExecutions: this.metrics.system.totalExecutions,
      totalErrors: this.metrics.system.totalErrors,
      errorRate,
      totalCost: this.metrics.system.totalCost,
      executionsPerHour,
      avgResponseTime,
      agentCount: this.metrics.agents.size,
      windows: {
        '1h': this.calculateWindowStats(this.metrics.windows['1h']),
        '24h': this.calculateWindowStats(this.metrics.windows['24h']),
        '7d': this.calculateWindowStats(this.metrics.windows['7d']),
      },
      systemHealth: this.getSystemHealth(),
    };
  }

  /**
   * Get system health information
   */
  getSystemHealth() {
    return {
      cpu: {
        usage: process.cpuUsage(),
        loadAvg: os.loadavg(),
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        processUsage: process.memoryUsage(),
      },
      uptime: os.uptime(),
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    const agents = [];
    for (const [name, agent] of this.metrics.agents) {
      agents.push(this.getAgentMetrics(name));
    }

    return {
      system: this.getSystemMetrics(),
      agents,
      timestamp: Date.now(),
    };
  }

  /**
   * Get daily cost
   */
  getDailyCost(date) {
    const startOfDay = new Date(date).setHours(0, 0, 0, 0);
    const endOfDay = new Date(date).setHours(23, 59, 59, 999);

    return this.metrics.windows['24h']
      .filter((e) => e.timestamp >= startOfDay && e.timestamp <= endOfDay)
      .reduce((sum, e) => sum + e.cost, 0);
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics() {
    return JSON.stringify(this.getAllMetrics(), null, 2);
  }

  /**
   * Save hourly snapshot to disk
   */
  async saveSnapshot() {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `snapshot-${timestamp}.json`;
      const filepath = path.join(this.dataDir, filename);

      await fs.writeFile(filepath, this.exportMetrics(), 'utf8');

      // Keep only last 168 snapshots (7 days of hourly snapshots)
      await this.cleanOldSnapshots();

      return filepath;
    } catch (error) {
      console.error('Failed to save snapshot:', error);
      return null;
    }
  }

  /**
   * Clean old snapshots (keep last 7 days)
   */
  async cleanOldSnapshots() {
    try {
      const files = await fs.readdir(this.dataDir);
      const snapshots = files
        .filter((f) => f.startsWith('snapshot-'))
        .sort()
        .reverse();

      // Keep only last 168 files
      const toDelete = snapshots.slice(168);
      for (const file of toDelete) {
        await fs.unlink(path.join(this.dataDir, file));
      }
    } catch (error) {
      console.error('Failed to clean old snapshots:', error);
    }
  }

  /**
   * Load last snapshot from disk
   */
  async loadLastSnapshot() {
    try {
      const files = await fs.readdir(this.dataDir);
      const snapshots = files.filter((f) => f.startsWith('snapshot-')).sort().reverse();

      if (snapshots.length > 0) {
        const filepath = path.join(this.dataDir, snapshots[0]);
        const data = await fs.readFile(filepath, 'utf8');
        const snapshot = JSON.parse(data);

        // Restore metrics from snapshot
        if (snapshot.system) {
          this.metrics.system = {
            ...this.metrics.system,
            totalExecutions: snapshot.system.totalExecutions || 0,
            totalErrors: snapshot.system.totalErrors || 0,
            totalCost: snapshot.system.totalCost || 0,
          };
        }

        if (snapshot.agents) {
          for (const agent of snapshot.agents) {
            this.metrics.agents.set(agent.name, {
              name: agent.name,
              executions: agent.executions || 0,
              errors: agent.errors || 0,
              totalDuration: agent.executions * (agent.avgDuration || 0),
              totalTokens: agent.totalTokens || 0,
              totalCost: agent.totalCost || 0,
              totalCpuTime: agent.totalCpuTime || 0,
              totalMemoryDelta: agent.totalMemoryDelta || 0,
              totalApiCalls: agent.totalApiCalls || 0,
              lastExecution: agent.lastExecution,
              executions1h: [],
              executions24h: [],
              executions7d: [],
            });
          }
        }

        console.log(`Loaded snapshot from ${snapshots[0]}`);
      }
    } catch (error) {
      console.error('Failed to load last snapshot:', error);
    }
  }

  /**
   * Start hourly snapshot process
   */
  startHourlySnapshots() {
    // Save snapshot every hour
    this.snapshotInterval = setInterval(() => {
      this.saveSnapshot();
    }, 60 * 60 * 1000);

    // Also save on process exit
    process.on('beforeExit', () => {
      this.saveSnapshot();
    });
  }

  /**
   * Stop hourly snapshots
   */
  stopHourlySnapshots() {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  /**
   * Set threshold values
   */
  setThresholds(thresholds) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }
}

// Singleton instance
let instance = null;

function getPerformanceMonitor() {
  if (!instance) {
    instance = new PerformanceMonitor();
    instance.init();
  }
  return instance;
}

module.exports = {
  PerformanceMonitor,
  getPerformanceMonitor,
};
