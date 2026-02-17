#!/usr/bin/env node
'use strict';

/**
 * Werkpilot Master Orchestrator
 *
 * Boots all 42 agents in dependency order, manages health monitoring,
 * inter-agent messaging, performance scoring, and nightly self-optimization.
 *
 * Usage: node orchestrator.js
 */

const { EventEmitter } = require('events');
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { createLogger } = require('./shared/utils/logger');
const { generateJSON } = require('./shared/utils/claude-client');
const config = require('./shared/utils/config');

const logger = createLogger('orchestrator');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const AGENT_BOOT_TIMEOUT_MS = 30000;
const BOOT_LAYER_DELAY_MS = 2000;
const MAX_GLOBAL_RESTARTS_PER_HOUR = 50;
const PERFORMANCE_HISTORY_SIZE = 100;
const DASHBOARD_PORT = 3001;

// ---------------------------------------------------------------------------
// Message Bus
// ---------------------------------------------------------------------------
class MessageBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.messageLog = [];
    this.maxLogSize = 10000;
    this.pendingRequests = new Map(); // requestId -> { resolve, reject, timeout }
  }

  publish(from, topic, payload) {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      from,
      topic,
      payload,
      timestamp: new Date().toISOString(),
    };
    this.messageLog.push(message);
    if (this.messageLog.length > this.maxLogSize) {
      this.messageLog = this.messageLog.slice(-this.maxLogSize / 2);
    }
    this.emit(topic, message);
    this.emit('*', message);
    return message.id;
  }

  subscribe(topic, handler) {
    this.on(topic, handler);
    return () => this.off(topic, handler);
  }

  getRecentMessages(count = 50) {
    return this.messageLog.slice(-count);
  }

  /**
   * Request-response pattern: allows agents to query each other with timeout
   * @param {string} fromAgent - Agent making the request
   * @param {string} toAgent - Target agent
   * @param {any} payload - Request payload
   * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
   * @returns {Promise<any>} Response payload from target agent
   */
  async requestResponse(fromAgent, toAgent, payload, timeoutMs = 5000) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const responseTopic = `agent.response.${requestId}`;

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        this.off(responseTopic, responseHandler);
        reject(new Error(`Request to ${toAgent} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Set up response handler
      const responseHandler = (message) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        this.off(responseTopic, responseHandler);

        if (message.payload.error) {
          reject(new Error(message.payload.error));
        } else {
          resolve(message.payload.data);
        }
      };

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      this.on(responseTopic, responseHandler);

      // Publish the request
      this.publish(fromAgent, `agent.request.${toAgent}`, {
        requestId,
        responseTopic,
        payload,
      });
    });
  }

  /**
   * Helper for agents to respond to requests
   * @param {string} fromAgent - Agent sending response
   * @param {string} requestId - Original request ID
   * @param {string} responseTopic - Topic to respond on
   * @param {any} data - Response data (or null for error)
   * @param {string} error - Error message if failed
   */
  respondToRequest(fromAgent, requestId, responseTopic, data = null, error = null) {
    this.publish(fromAgent, responseTopic, {
      requestId,
      data,
      error,
    });
  }
}

// ---------------------------------------------------------------------------
// Performance Tracker
// ---------------------------------------------------------------------------
class PerformanceTracker {
  constructor() {
    this.metrics = new Map(); // agentName -> { history[], currentScore, executionTimes[] }
  }

  initialize(agentName) {
    this.metrics.set(agentName, {
      history: [],
      currentScore: 50,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      avgDurationMs: 0,
      lastRunAt: null,
      lastError: null,
      executionTimes: [],  // Sorted array for percentile calculation
    });
  }

  recordRun(agentName, { success, durationMs, error = null }) {
    const m = this.metrics.get(agentName);
    if (!m) return;

    m.totalRuns++;
    if (success) {
      m.successfulRuns++;
      // Track execution times for successful runs only
      m.executionTimes.push(durationMs);
      if (m.executionTimes.length > 1000) {
        m.executionTimes = m.executionTimes.slice(-1000);
      }
    } else {
      m.failedRuns++;
      m.lastError = error;
    }
    m.lastRunAt = new Date().toISOString();

    // Running average duration
    m.avgDurationMs = m.avgDurationMs === 0
      ? durationMs
      : (m.avgDurationMs * 0.8) + (durationMs * 0.2);

    // Compute score (0-100)
    const successRate = m.totalRuns > 0 ? (m.successfulRuns / m.totalRuns) : 0;
    const recentSuccess = success ? 1 : 0;
    // Weighted: 60% historical success rate, 30% recent run, 10% consistency bonus
    const consistencyBonus = m.failedRuns === 0 ? 10 : Math.max(0, 10 - m.failedRuns);
    m.currentScore = Math.round(
      (successRate * 60) + (recentSuccess * 30) + consistencyBonus
    );
    m.currentScore = Math.min(100, Math.max(0, m.currentScore));

    m.history.push({
      timestamp: m.lastRunAt,
      success,
      durationMs,
      score: m.currentScore,
    });
    if (m.history.length > PERFORMANCE_HISTORY_SIZE) {
      m.history = m.history.slice(-PERFORMANCE_HISTORY_SIZE);
    }
  }

  getPercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getScore(agentName) {
    const m = this.metrics.get(agentName);
    return m ? m.currentScore : 0;
  }

  getMetrics(agentName) {
    const m = this.metrics.get(agentName);
    if (!m) return null;

    return {
      ...m,
      p50: this.getPercentile(m.executionTimes, 50),
      p95: this.getPercentile(m.executionTimes, 95),
      p99: this.getPercentile(m.executionTimes, 99),
      executionTimes: undefined, // Don't expose raw array
    };
  }

  getAllMetrics() {
    const result = {};
    for (const [name, data] of this.metrics) {
      result[name] = {
        ...data,
        history: undefined,
        p50: this.getPercentile(data.executionTimes, 50),
        p95: this.getPercentile(data.executionTimes, 95),
        p99: this.getPercentile(data.executionTimes, 99),
        executionTimes: undefined,
      };
    }
    return result;
  }

  getUnderperformers(threshold = 40) {
    const result = [];
    for (const [name, data] of this.metrics) {
      if (data.currentScore < threshold && data.totalRuns > 0) {
        result.push({ name, score: data.currentScore, failedRuns: data.failedRuns, lastError: data.lastError });
      }
    }
    return result.sort((a, b) => a.score - b.score);
  }
}

// ---------------------------------------------------------------------------
// Master Orchestrator
// ---------------------------------------------------------------------------
class MasterOrchestrator {
  constructor() {
    this.registry = null;
    this.dependencyGraph = null;
    this.agents = new Map();          // name -> { config, process, status, restartCount, cronJob }
    this.messageBus = new MessageBus();
    this.performance = new PerformanceTracker();
    this.bootTime = null;
    this.isShuttingDown = false;
    this.healthCheckTimer = null;
    this.cronJobs = [];
    this.globalRestartCount = 0;
    this.globalRestartResetTimer = null;
    this.dashboardServer = null;
    this.deadLetterQueue = [];         // Failed executions after all retries
    this.memoryMonitorTimer = null;    // Memory monitoring timer
    this.executionQueue = [];          // Priority queue for agent executions
    this.isProcessingQueue = false;    // Flag to prevent concurrent queue processing

    // Track restart rate
    this.globalRestartResetTimer = setInterval(() => {
      this.globalRestartCount = 0;
    }, 60 * 60 * 1000);
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------
  async start() {
    logger.info('========================================');
    logger.info('  Werkpilot Master Orchestrator v1.0.0');
    logger.info('========================================');
    this.bootTime = new Date();

    try {
      this.loadRegistry();
      this.loadDependencyGraph();
      this.setupSignalHandlers();
      this.setupMessageBusLogging();

      await this.bootAgentsInOrder();
      this.startHealthMonitoring();
      this.scheduleNightlyOptimization();
      await this.startDashboard();

      logger.info(`All systems operational. ${this.getEnabledCount()} agents registered.`);
      this.messageBus.publish('orchestrator', 'system.boot.complete', {
        agentCount: this.getEnabledCount(),
        bootDurationMs: Date.now() - this.bootTime.getTime(),
      });
    } catch (err) {
      logger.error(`Fatal startup error: ${err.message}`, { stack: err.stack });
      await this.shutdown(1);
    }
  }

  loadRegistry() {
    const registryPath = path.join(__dirname, 'agent-registry.json');
    const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    this.registry = raw.agents;
    logger.info(`Loaded registry: ${this.registry.length} agents defined`);

    for (const agentConfig of this.registry) {
      this.performance.initialize(agentConfig.name);
      this.agents.set(agentConfig.name, {
        config: agentConfig,
        process: null,
        status: 'registered',
        restartCount: 0,
        cronJob: null,
        lastHealthCheck: null,
        bootedAt: null,
        error: null,
      });
    }
  }

  loadDependencyGraph() {
    const graphPath = path.join(__dirname, 'dependency-graph.json');
    this.dependencyGraph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    logger.info(`Loaded dependency graph: ${this.dependencyGraph.bootLayers.length} boot layers`);
    this.validateDependencyGraph();
  }

  validateDependencyGraph() {
    const registeredNames = new Set(this.registry.map(a => a.name));
    const graphNames = new Set(Object.keys(this.dependencyGraph.edges));

    for (const name of registeredNames) {
      if (!graphNames.has(name)) {
        logger.warn(`Agent "${name}" in registry but not in dependency graph`);
      }
    }
    for (const name of graphNames) {
      if (!registeredNames.has(name)) {
        logger.warn(`Agent "${name}" in dependency graph but not in registry`);
      }
    }

    // Check for circular dependencies
    const visited = new Set();
    const stack = new Set();
    const hasCycle = (node) => {
      visited.add(node);
      stack.add(node);
      const deps = this.dependencyGraph.edges[node] || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) return true;
        } else if (stack.has(dep)) {
          logger.error(`Circular dependency detected: ${node} -> ${dep}`);
          return true;
        }
      }
      stack.delete(node);
      return false;
    };

    for (const name of graphNames) {
      if (!visited.has(name)) {
        if (hasCycle(name)) {
          throw new Error('Circular dependency detected in agent graph. Cannot proceed.');
        }
      }
    }
    logger.info('Dependency graph validation passed (no cycles)');
  }

  // -------------------------------------------------------------------------
  // Boot sequence
  // -------------------------------------------------------------------------
  async bootAgentsInOrder() {
    const layers = this.dependencyGraph.bootLayers;
    logger.info(`Starting boot sequence: ${layers.length} layers`);

    for (const layer of layers) {
      logger.info(`--- Boot Layer ${layer.layer}: ${layer.description} ---`);
      const enabledInLayer = layer.agents.filter(name => {
        const agent = this.agents.get(name);
        return agent && agent.config.enabled;
      });

      if (enabledInLayer.length === 0) {
        logger.info(`  Layer ${layer.layer}: no enabled agents, skipping`);
        continue;
      }

      // Boot all agents in this layer concurrently
      const bootPromises = enabledInLayer.map(name => this.bootAgent(name));
      const results = await Promise.allSettled(bootPromises);

      let successCount = 0;
      let failCount = 0;
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
          logger.error(`  Failed to boot "${enabledInLayer[i]}": ${results[i].reason?.message}`);
        }
      }
      logger.info(`  Layer ${layer.layer} complete: ${successCount} ok, ${failCount} failed`);

      // Delay between layers to allow services to stabilize
      if (layer.layer < layers.length - 1) {
        await this.sleep(BOOT_LAYER_DELAY_MS);
      }
    }
  }

  async bootAgent(name) {
    const agent = this.agents.get(name);
    if (!agent) throw new Error(`Unknown agent: ${name}`);
    if (!agent.config.enabled) {
      agent.status = 'disabled';
      return;
    }

    const agentFile = path.resolve(__dirname, agent.config.file);

    // Check if agent file exists
    if (!fs.existsSync(agentFile)) {
      agent.status = 'missing';
      agent.error = `File not found: ${agentFile}`;
      logger.warn(`Agent "${name}" file not found at ${agentFile} - registering as scheduled stub`);
      this.scheduleAgent(name);
      return;
    }

    try {
      agent.status = 'booting';
      logger.info(`  Booting agent: ${name}`);

      // Schedule the agent via cron
      this.scheduleAgent(name);

      agent.status = 'ready';
      agent.bootedAt = new Date().toISOString();
      agent.error = null;

      this.messageBus.publish('orchestrator', 'agent.booted', { name, department: agent.config.department });
      this.performance.recordRun(name, { success: true, durationMs: 0 });

    } catch (err) {
      agent.status = 'error';
      agent.error = err.message;
      this.performance.recordRun(name, { success: false, durationMs: 0, error: err.message });
      throw err;
    }
  }

  scheduleAgent(name) {
    const agent = this.agents.get(name);
    if (!agent) return;

    const schedule = agent.config.schedule;
    if (!schedule || !cron.validate(schedule)) {
      logger.warn(`  Agent "${name}" has invalid or no cron schedule: ${schedule}`);
      return;
    }

    const job = cron.schedule(schedule, async () => {
      if (this.isShuttingDown) return;
      await this.queueAgentExecution(name);
    }, { scheduled: true, timezone: 'Europe/Zurich' });

    agent.cronJob = job;
    this.cronJobs.push(job);
    logger.info(`  Scheduled "${name}" with cron: ${schedule}`);
  }

  /**
   * Add agent execution to priority queue
   * Priority: 1=critical, 2=important, 3=normal
   * Sorted by: priority (ascending), then dependency depth (descending)
   */
  async queueAgentExecution(name) {
    const agent = this.agents.get(name);
    if (!agent) return;

    const priority = agent.config.priority || 3;
    const dependencyDepth = this.getDependencyDepth(name);

    const queueEntry = {
      name,
      priority,
      dependencyDepth,
      queuedAt: Date.now(),
    };

    // Insert and re-sort (max ~42 agents, negligible cost)
    this.executionQueue.push(queueEntry);
    this.executionQueue.sort((a, b) => a.priority - b.priority || a.dependencyDepth - b.dependencyDepth);

    logger.debug(`Queued "${name}" (priority=${priority}, depth=${dependencyDepth}, queue size=${this.executionQueue.length})`);

    // Process queue
    await this.processExecutionQueue();
  }

  async processExecutionQueue() {
    if (this.isProcessingQueue || this.executionQueue.length === 0) return;

    this.isProcessingQueue = true;
    try {
      while (this.executionQueue.length > 0 && !this.isShuttingDown) {
        const entry = this.executionQueue.shift();
        const waitTime = Date.now() - entry.queuedAt;

        logger.debug(`Executing "${entry.name}" from queue (waited ${waitTime}ms, priority=${entry.priority})`);
        await this.executeAgent(entry.name);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  getDependencyDepth(name, visited = new Set()) {
    if (visited.has(name)) return 0; // Avoid cycles
    visited.add(name);

    const deps = this.dependencyGraph.edges[name] || [];
    if (deps.length === 0) return 0;

    let maxDepth = 0;
    for (const dep of deps) {
      const depth = this.getDependencyDepth(dep, visited);
      maxDepth = Math.max(maxDepth, depth);
    }
    return maxDepth + 1;
  }

  async executeAgent(name) {
    const agent = this.agents.get(name);
    if (!agent || !agent.config.enabled) return;

    const agentFile = path.resolve(__dirname, agent.config.file);
    if (!fs.existsSync(agentFile)) {
      logger.debug(`Skipping execution of "${name}" - file not yet created`);
      return;
    }

    // Check dependencies are healthy
    const depsOk = this.checkDependenciesHealthy(name);
    if (!depsOk) {
      logger.warn(`Skipping "${name}" - one or more dependencies unhealthy`);
      this.performance.recordRun(name, { success: false, durationMs: 0, error: 'Dependencies unhealthy' });
      return;
    }

    const startTime = Date.now();
    agent.status = 'running';
    logger.info(`Executing agent: ${name}`);

    this.messageBus.publish('orchestrator', 'agent.execution.start', { name });

    return new Promise((resolve) => {
      const timeout = agent.config.timeoutMs || 300000;
      let finished = false;

      try {
        const child = fork(agentFile, [], {
          cwd: path.dirname(agentFile),
          env: { ...process.env, AGENT_NAME: name, WERKPILOT_AGENT: '1' },
          silent: true,
          timeout,
        });

        agent.process = child;

        const timeoutHandle = setTimeout(() => {
          if (!finished) {
            finished = true;
            logger.error(`Agent "${name}" timed out after ${timeout}ms`);
            child.kill('SIGTERM');
            setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 5000);
            agent.status = 'timeout';
            const durationMs = Date.now() - startTime;
            this.performance.recordRun(name, { success: false, durationMs, error: 'Timeout' });
            this.messageBus.publish('orchestrator', 'agent.execution.timeout', { name, durationMs });
            resolve();
          }
        }, timeout);

        child.stdout?.on('data', (data) => {
          const lines = data.toString().trim().split('\n');
          for (const line of lines) {
            logger.debug(`[${name}] ${line}`);
          }
        });

        child.stderr?.on('data', (data) => {
          const lines = data.toString().trim().split('\n');
          for (const line of lines) {
            logger.warn(`[${name}] STDERR: ${line}`);
          }
        });

        child.on('message', (msg) => {
          if (msg && msg.topic) {
            this.messageBus.publish(name, msg.topic, msg.payload);
          }
        });

        child.on('exit', (code, signal) => {
          if (finished) return;
          finished = true;
          clearTimeout(timeoutHandle);

          const durationMs = Date.now() - startTime;
          agent.process = null;

          if (code === 0) {
            agent.status = 'ready';
            agent.error = null;
            this.performance.recordRun(name, { success: true, durationMs });
            this.messageBus.publish('orchestrator', 'agent.execution.success', { name, durationMs });
            logger.info(`Agent "${name}" completed successfully in ${durationMs}ms`);
          } else {
            const errMsg = `Exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`;
            agent.status = 'error';
            agent.error = errMsg;
            this.performance.recordRun(name, { success: false, durationMs, error: errMsg });
            this.messageBus.publish('orchestrator', 'agent.execution.error', { name, durationMs, error: errMsg });
            logger.error(`Agent "${name}" failed: ${errMsg}`);
            this.handleAgentFailure(name);
          }
          resolve();
        });

        child.on('error', (err) => {
          if (finished) return;
          finished = true;
          clearTimeout(timeoutHandle);

          const durationMs = Date.now() - startTime;
          agent.process = null;
          agent.status = 'error';
          agent.error = err.message;
          this.performance.recordRun(name, { success: false, durationMs, error: err.message });
          this.messageBus.publish('orchestrator', 'agent.execution.error', { name, error: err.message });
          logger.error(`Agent "${name}" process error: ${err.message}`);
          this.handleAgentFailure(name);
          resolve();
        });
      } catch (err) {
        if (!finished) {
          finished = true;
          agent.status = 'error';
          agent.error = err.message;
          const durationMs = Date.now() - startTime;
          this.performance.recordRun(name, { success: false, durationMs, error: err.message });
          logger.error(`Failed to spawn agent "${name}": ${err.message}`);
          resolve();
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Failure handling & graceful degradation
  // -------------------------------------------------------------------------
  handleAgentFailure(name) {
    const agent = this.agents.get(name);
    if (!agent) return;

    agent.restartCount++;
    this.globalRestartCount++;

    // Circuit breaker: if too many global restarts, stop restarting
    if (this.globalRestartCount > MAX_GLOBAL_RESTARTS_PER_HOUR) {
      logger.error('Global restart limit exceeded. Entering degraded mode.');
      this.messageBus.publish('orchestrator', 'system.degraded', {
        reason: 'Too many restarts across all agents',
        globalRestartCount: this.globalRestartCount,
      });
      return;
    }

    const maxRestarts = agent.config.maxRestarts || 3;
    if (agent.restartCount > maxRestarts) {
      logger.error(`Agent "${name}" exceeded max restarts (${maxRestarts}). Disabling.`);
      agent.status = 'disabled_by_failure';

      // Add to Dead Letter Queue
      this.addToDeadLetterQueue({
        agentName: name,
        error: agent.error || 'Unknown error',
        timestamp: new Date().toISOString(),
        restartCount: agent.restartCount,
        executionData: {
          department: agent.config.department,
          schedule: agent.config.schedule,
          lastHealthCheck: agent.lastHealthCheck,
        },
      });

      this.messageBus.publish('orchestrator', 'agent.disabled', {
        name,
        reason: `Exceeded ${maxRestarts} restarts`,
      });

      // Notify dependents about degraded service
      this.notifyDependentsOfFailure(name);
      return;
    }

    // Exponential backoff restart
    const backoffMs = Math.min(60000, 1000 * Math.pow(2, agent.restartCount));
    logger.info(`Scheduling restart of "${name}" in ${backoffMs}ms (attempt ${agent.restartCount}/${maxRestarts})`);

    setTimeout(async () => {
      if (this.isShuttingDown) return;
      logger.info(`Restarting agent "${name}" (attempt ${agent.restartCount}/${maxRestarts})`);
      await this.executeAgent(name);
    }, backoffMs);
  }

  addToDeadLetterQueue(entry) {
    const MAX_DLQ_SIZE = 100;
    this.deadLetterQueue.push(entry);
    if (this.deadLetterQueue.length > MAX_DLQ_SIZE) {
      this.deadLetterQueue = this.deadLetterQueue.slice(-MAX_DLQ_SIZE);
    }
    logger.error(`Added to DLQ: ${entry.agentName} - ${entry.error}`);
    this.messageBus.publish('orchestrator', 'dlq.entry.added', entry);
  }

  getDeadLetterQueue() {
    return this.deadLetterQueue;
  }

  notifyDependentsOfFailure(failedAgent) {
    for (const [name, edges] of Object.entries(this.dependencyGraph.edges)) {
      if (edges.includes(failedAgent)) {
        logger.warn(`Agent "${name}" depends on failed agent "${failedAgent}" - marking degraded`);
        const agent = this.agents.get(name);
        if (agent && agent.status !== 'disabled_by_failure') {
          agent.status = 'degraded';
          this.messageBus.publish('orchestrator', 'agent.degraded', {
            name,
            reason: `Dependency "${failedAgent}" is down`,
          });
        }
      }
    }
  }

  checkDependenciesHealthy(name) {
    const deps = this.dependencyGraph.edges[name] || [];
    const unhealthyDeps = [];

    for (const dep of deps) {
      const agent = this.agents.get(dep);
      if (!agent) {
        unhealthyDeps.push({ dep, reason: 'not_found' });
        continue;
      }

      // Consider these statuses as unhealthy
      const unhealthyStatuses = [
        'disabled_by_failure',
        'disabled_by_memory',
        'error',
        'timeout',
        'missing',
      ];

      if (unhealthyStatuses.includes(agent.status)) {
        unhealthyDeps.push({ dep, reason: agent.status, error: agent.error });
      }
    }

    if (unhealthyDeps.length > 0) {
      logger.warn(
        `Agent "${name}" has unhealthy dependencies: ${unhealthyDeps.map(d => `${d.dep} (${d.reason})`).join(', ')}`
      );
      this.messageBus.publish('orchestrator', 'agent.dependencies.unhealthy', {
        agent: name,
        unhealthyDeps,
      });
      return false;
    }

    return true;
  }

  // -------------------------------------------------------------------------
  // Health monitoring
  // -------------------------------------------------------------------------
  startHealthMonitoring() {
    logger.info(`Starting health monitoring (every ${HEALTH_CHECK_INTERVAL_MS / 1000}s)`);

    this.healthCheckTimer = setInterval(async () => {
      if (this.isShuttingDown) return;
      await this.runHealthCheck();
    }, HEALTH_CHECK_INTERVAL_MS);

    // Start memory monitoring (every minute)
    logger.info('Starting memory monitoring (every 60s)');
    this.memoryMonitorTimer = setInterval(() => {
      if (this.isShuttingDown) return;
      this.monitorMemory();
    }, 60 * 1000);

    // Run initial checks
    this.runHealthCheck();
    this.monitorMemory();
  }

  monitorMemory() {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);
    const heapPercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

    // Log memory stats
    logger.debug(`Memory: ${heapUsedMB}MB/${heapTotalMB}MB heap (${heapPercent}%), ${rssMB}MB RSS`);

    this.messageBus.publish('orchestrator', 'system.memory', {
      heapUsedMB,
      heapTotalMB,
      heapPercent,
      rssMB,
      external: Math.round(usage.external / 1024 / 1024),
    });

    // Check thresholds
    if (heapPercent >= 90) {
      logger.error(`CRITICAL: Heap usage at ${heapPercent}% - disabling low-priority agents`);
      this.disableLowPriorityAgents();
      this.messageBus.publish('orchestrator', 'system.memory.critical', {
        heapPercent,
        action: 'disabled_low_priority_agents',
      });
    } else if (heapPercent >= 80) {
      logger.warn(`WARNING: Heap usage at ${heapPercent}% - triggering garbage collection hint`);

      // Trigger garbage collection if available
      if (global.gc) {
        try {
          global.gc();
          logger.info('Garbage collection triggered');
        } catch (err) {
          logger.warn(`GC failed: ${err.message}`);
        }
      } else {
        logger.warn('GC not available (run with --expose-gc flag to enable)');
      }

      this.messageBus.publish('orchestrator', 'system.memory.warning', {
        heapPercent,
        action: 'gc_triggered',
      });
    }
  }

  disableLowPriorityAgents() {
    let disabledCount = 0;
    for (const [name, agent] of this.agents) {
      // Disable agents with priority 3 (normal) that are enabled
      const priority = agent.config.priority || 3;
      if (priority === 3 && agent.config.enabled && agent.status !== 'disabled_by_memory') {
        logger.warn(`Disabling low-priority agent "${name}" due to memory pressure`);
        agent.status = 'disabled_by_memory';
        if (agent.cronJob) {
          agent.cronJob.stop();
        }
        disabledCount++;
      }
    }
    logger.warn(`Disabled ${disabledCount} low-priority agents due to memory pressure`);
  }

  async runHealthCheck() {
    const now = new Date().toISOString();
    let healthy = 0;
    let degraded = 0;
    let errored = 0;
    let disabled = 0;
    let missing = 0;

    for (const [name, agent] of this.agents) {
      if (!agent.config.enabled) {
        disabled++;
        continue;
      }

      agent.lastHealthCheck = now;

      switch (agent.status) {
        case 'ready':
        case 'running':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          break;
        case 'error':
        case 'timeout':
        case 'disabled_by_failure':
          errored++;
          break;
        case 'missing':
          missing++;
          break;
        default:
          break;
      }
    }

    const total = this.getEnabledCount();
    const healthPct = total > 0 ? Math.round((healthy / total) * 100) : 0;

    logger.info(
      `Health check: ${healthy}/${total} healthy, ${degraded} degraded, ` +
      `${errored} errored, ${missing} missing, ${disabled} disabled (${healthPct}%)`
    );

    this.messageBus.publish('orchestrator', 'health.check.complete', {
      timestamp: now,
      healthy,
      degraded,
      errored,
      disabled,
      missing,
      total,
      healthPercentage: healthPct,
    });

    if (healthPct < 50) {
      logger.error(`System health critical: ${healthPct}%`);
      this.messageBus.publish('orchestrator', 'system.health.critical', { healthPercentage: healthPct });
    }
  }

  // -------------------------------------------------------------------------
  // Nightly self-optimization (23:00 Europe/Zurich)
  // -------------------------------------------------------------------------
  scheduleNightlyOptimization() {
    const job = cron.schedule('0 23 * * *', async () => {
      if (this.isShuttingDown) return;
      await this.runNightlyOptimization();
    }, { timezone: 'Europe/Zurich' });

    this.cronJobs.push(job);
    logger.info('Nightly self-optimization scheduled at 23:00 Europe/Zurich');
  }

  async runNightlyOptimization() {
    logger.info('=== Nightly Self-Optimization Starting ===');
    const startTime = Date.now();

    try {
      // Gather data
      const underperformers = this.performance.getUnderperformers(40);
      const allMetrics = this.performance.getAllMetrics();
      const recentMessages = this.messageBus.getRecentMessages(100);
      const errorMessages = recentMessages.filter(m =>
        m.topic.includes('error') || m.topic.includes('timeout') || m.topic.includes('degraded')
      );

      // Build optimization report
      const report = {
        timestamp: new Date().toISOString(),
        uptimeHours: Math.round((Date.now() - this.bootTime.getTime()) / (1000 * 60 * 60)),
        totalAgents: this.registry.length,
        enabledAgents: this.getEnabledCount(),
        underperformers,
        recentErrors: errorMessages.slice(-20).map(m => ({
          agent: m.from,
          topic: m.topic,
          payload: m.payload,
          timestamp: m.timestamp,
        })),
        departmentHealth: this.getDepartmentHealth(),
      };

      // Log report
      const reportPath = path.join(config.paths.logs, 'orchestrator', `optimization-${new Date().toISOString().slice(0, 10)}.json`);
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      logger.info(`Optimization report saved to ${reportPath}`);

      // Use Claude to analyze performance and suggest improvements
      if (underperformers.length > 0 || errorMessages.length > 0) {
        try {
          const analysis = await generateJSON(
            `Analyze this Werkpilot AI agent system optimization report and suggest improvements.

Report:
${JSON.stringify(report, null, 2)}

For each underperforming agent, suggest:
1. Possible root cause of failures
2. Recommended action (restart, disable, adjust schedule, increase timeout)
3. Priority (high/medium/low)

Respond as JSON: { "recommendations": [{ "agent": string, "rootCause": string, "action": string, "priority": string }], "systemHealth": string, "summary": string }`,
            {
              system: 'You are the Werkpilot system optimization AI. Analyze agent performance data and provide actionable recommendations.',
              model: config.models.fast,
              maxTokens: 2048,
            }
          );

          logger.info(`Optimization analysis: ${analysis.summary || 'Complete'}`);

          if (analysis.recommendations) {
            for (const rec of analysis.recommendations) {
              logger.info(`  [${rec.priority}] ${rec.agent}: ${rec.action} (${rec.rootCause})`);

              // Auto-apply safe actions
              if (rec.action === 'restart' && rec.priority === 'high') {
                const agent = this.agents.get(rec.agent);
                if (agent) {
                  agent.restartCount = 0; // Reset restart count for fresh attempt
                  logger.info(`  Auto-restarting "${rec.agent}" per optimization recommendation`);
                }
              }
              if (rec.action === 'increase timeout') {
                const agent = this.agents.get(rec.agent);
                if (agent) {
                  agent.config.timeoutMs = Math.min(600000, (agent.config.timeoutMs || 300000) * 1.5);
                  logger.info(`  Increased timeout for "${rec.agent}" to ${agent.config.timeoutMs}ms`);
                }
              }
            }
          }

          // Save analysis alongside report
          const analysisPath = reportPath.replace('.json', '-analysis.json');
          fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
        } catch (aiErr) {
          logger.warn(`AI optimization analysis failed (non-critical): ${aiErr.message}`);
        }
      } else {
        logger.info('All agents performing well. No optimization needed.');
      }

      const durationMs = Date.now() - startTime;
      logger.info(`=== Nightly Optimization Complete (${durationMs}ms) ===`);

      this.messageBus.publish('orchestrator', 'optimization.complete', {
        durationMs,
        underperformersCount: underperformers.length,
        errorsReviewed: errorMessages.length,
      });

    } catch (err) {
      logger.error(`Nightly optimization failed: ${err.message}`, { stack: err.stack });
    }
  }

  getDepartmentHealth() {
    const departments = {};
    for (const [name, agent] of this.agents) {
      const dept = agent.config.department;
      if (!departments[dept]) {
        departments[dept] = { total: 0, healthy: 0, agents: [] };
      }
      departments[dept].total++;
      const isHealthy = ['ready', 'running', 'missing'].includes(agent.status);
      if (isHealthy) departments[dept].healthy++;
      departments[dept].agents.push({
        name,
        status: agent.status,
        score: this.performance.getScore(name),
      });
    }
    for (const dept of Object.values(departments)) {
      dept.healthPercentage = dept.total > 0 ? Math.round((dept.healthy / dept.total) * 100) : 0;
    }
    return departments;
  }

  // -------------------------------------------------------------------------
  // Dashboard data endpoint
  // -------------------------------------------------------------------------
  async startDashboard() {
    // Only start dashboard if not already running
    try {
      const dashboardModule = require('./health-dashboard');
      this.dashboardServer = dashboardModule.start(this, DASHBOARD_PORT);
      logger.info(`Health dashboard started on port ${DASHBOARD_PORT}`);
    } catch (err) {
      logger.warn(`Dashboard startup failed (non-critical): ${err.message}`);
    }
  }

  getDashboardData() {
    const agentsList = [];
    for (const [name, agent] of this.agents) {
      const metrics = this.performance.getMetrics(name);
      agentsList.push({
        name,
        department: agent.config.department,
        priority: agent.config.priority || 3,
        status: agent.status,
        enabled: agent.config.enabled,
        schedule: agent.config.schedule,
        score: this.performance.getScore(name),
        restartCount: agent.restartCount,
        bootedAt: agent.bootedAt,
        lastHealthCheck: agent.lastHealthCheck,
        error: agent.error,
        isRunning: agent.process !== null,
        dependencyDepth: this.getDependencyDepth(name),
        p50: metrics?.p50 || 0,
        p95: metrics?.p95 || 0,
        p99: metrics?.p99 || 0,
      });
    }

    const memUsage = process.memoryUsage();
    return {
      system: {
        bootTime: this.bootTime?.toISOString(),
        uptimeMs: this.bootTime ? Date.now() - this.bootTime.getTime() : 0,
        totalAgents: this.registry?.length || 0,
        enabledAgents: this.getEnabledCount(),
        isShuttingDown: this.isShuttingDown,
        globalRestartCount: this.globalRestartCount,
        executionQueueSize: this.executionQueue.length,
        deadLetterQueueSize: this.deadLetterQueue.length,
        memory: {
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          heapPercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
          rssMB: Math.round(memUsage.rss / 1024 / 1024),
        },
      },
      agents: agentsList,
      departments: this.getDepartmentHealth(),
      metrics: this.performance.getAllMetrics(),
      recentMessages: this.messageBus.getRecentMessages(20),
      deadLetterQueue: this.deadLetterQueue.slice(-20),
    };
  }

  getAgentData(name) {
    const agent = this.agents.get(name);
    if (!agent) return null;
    return {
      name,
      department: agent.config.department,
      file: agent.config.file,
      status: agent.status,
      enabled: agent.config.enabled,
      schedule: agent.config.schedule,
      dependencies: agent.config.dependencies,
      score: this.performance.getScore(name),
      metrics: this.performance.getMetrics(name),
      restartCount: agent.restartCount,
      maxRestarts: agent.config.maxRestarts,
      bootedAt: agent.bootedAt,
      lastHealthCheck: agent.lastHealthCheck,
      error: agent.error,
      isRunning: agent.process !== null,
    };
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------
  getEnabledCount() {
    let count = 0;
    for (const agent of this.agents.values()) {
      if (agent.config.enabled) count++;
    }
    return count;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // -------------------------------------------------------------------------
  // Signal handling & shutdown
  // -------------------------------------------------------------------------
  setupSignalHandlers() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'];
    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, initiating graceful shutdown...`);
        await this.shutdown(0);
      });
    }

    process.on('uncaughtException', async (err) => {
      logger.error(`Uncaught exception: ${err.message}`, { stack: err.stack });
      await this.shutdown(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error(`Unhandled rejection: ${reason}`);
    });
  }

  setupMessageBusLogging() {
    this.messageBus.subscribe('*', (msg) => {
      if (msg.topic.includes('error') || msg.topic.includes('critical')) {
        logger.warn(`Bus [${msg.from}] ${msg.topic}: ${JSON.stringify(msg.payload)}`);
      }
    });
  }

  async shutdown(exitCode = 0) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    const shutdownStart = Date.now();
    logger.info('========================================');
    logger.info('  Graceful Shutdown Initiated');
    logger.info('========================================');
    this.messageBus.publish('orchestrator', 'system.shutdown', { exitCode });

    // Step 1: Stop all cron jobs
    logger.info('[1/6] Stopping cron jobs...');
    for (const job of this.cronJobs) {
      try { job.stop(); } catch (e) { /* ignore */ }
    }
    logger.info(`  Stopped ${this.cronJobs.length} cron jobs`);

    // Step 2: Stop health check timer
    logger.info('[2/6] Stopping health monitoring...');
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.globalRestartResetTimer) {
      clearInterval(this.globalRestartResetTimer);
    }
    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer);
    }
    logger.info('  Health monitoring stopped');

    // Step 3: Wait for running agents to finish (with 30s timeout)
    logger.info('[3/6] Waiting for running agents to complete...');
    const runningAgents = Array.from(this.agents.entries())
      .filter(([_, agent]) => agent.process && !agent.process.killed)
      .map(([name, _]) => name);

    if (runningAgents.length > 0) {
      logger.info(`  Waiting for ${runningAgents.length} running agents: ${runningAgents.join(', ')}`);
      const GRACEFUL_WAIT_MS = 30000;
      const waitStart = Date.now();

      await Promise.race([
        // Wait for all to finish naturally
        Promise.all(
          runningAgents.map(name => {
            const agent = this.agents.get(name);
            return new Promise((resolve) => {
              if (!agent.process || agent.process.killed) {
                resolve();
                return;
              }
              agent.process.once('exit', () => {
                logger.info(`  Agent "${name}" completed gracefully`);
                resolve();
              });
            });
          })
        ),
        // Or timeout after 30s
        this.sleep(GRACEFUL_WAIT_MS),
      ]);

      const waitDuration = Date.now() - waitStart;
      logger.info(`  Wait completed after ${waitDuration}ms`);
    } else {
      logger.info('  No running agents to wait for');
    }

    // Step 4: Terminate any remaining agent processes
    logger.info('[4/6] Terminating remaining agent processes...');
    const killPromises = [];
    let terminatedCount = 0;
    for (const [name, agent] of this.agents) {
      if (agent.process && !agent.process.killed) {
        terminatedCount++;
        killPromises.push(new Promise((resolve) => {
          const timeout = setTimeout(() => {
            if (agent.process && !agent.process.killed) {
              logger.warn(`  Force-killing agent "${name}"`);
              agent.process.kill('SIGKILL');
            }
            resolve();
          }, 10000);

          agent.process.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });

          agent.process.kill('SIGTERM');
          logger.info(`  Sent SIGTERM to "${name}"`);
        }));
      }
    }

    if (killPromises.length > 0) {
      await Promise.allSettled(killPromises);
      logger.info(`  Terminated ${terminatedCount} agents`);
    } else {
      logger.info('  No processes to terminate');
    }

    // Step 5: Stop dashboard server
    logger.info('[5/6] Stopping dashboard server...');
    if (this.dashboardServer) {
      await new Promise((resolve) => {
        this.dashboardServer.close(() => {
          logger.info('  Dashboard server stopped');
          resolve();
        });
      });
    } else {
      logger.info('  No dashboard server to stop');
    }

    // Step 6: Final cleanup and exit
    logger.info('[6/6] Final cleanup...');
    const uptimeMs = this.bootTime ? Date.now() - this.bootTime.getTime() : 0;
    const shutdownDuration = Date.now() - shutdownStart;

    logger.info('========================================');
    logger.info(`  Shutdown Complete`);
    logger.info(`  Uptime: ${Math.round(uptimeMs / 1000)}s`);
    logger.info(`  Shutdown duration: ${shutdownDuration}ms`);
    logger.info(`  Exit code: ${exitCode}`);
    logger.info('========================================');

    process.exit(exitCode);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
if (require.main === module) {
  const orchestrator = new MasterOrchestrator();
  orchestrator.start().catch((err) => {
    console.error('Failed to start orchestrator:', err);
    process.exit(1);
  });
}

module.exports = { MasterOrchestrator, MessageBus, PerformanceTracker };
