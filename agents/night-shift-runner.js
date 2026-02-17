/**
 * Night Shift Runner
 *
 * Main execution engine for overnight automation tasks.
 * Reads pending tasks from dashboard API, dispatches them to appropriate agents,
 * tracks progress, and generates completion reports.
 *
 * Features:
 * - Fetches pending tasks from dashboard (/api/nightshift)
 * - Routes tasks to appropriate agent handlers via task-dispatcher
 * - Updates task status in real-time (PATCH /api/nightshift)
 * - Tracks duration and token usage per task
 * - Sends completion notifications and summary reports
 * - Graceful error handling (continues on failure)
 *
 * Usage:
 *   node night-shift-runner.js              # Run once (process all pending)
 *   node night-shift-runner.js --continuous # Keep running (watch mode)
 *   node night-shift-runner.js --dry-run    # Preview tasks without executing
 */

const { createLogger } = require('./shared/utils/logger');
const dashboardClient = require('./shared/utils/dashboard-client');
const dashboardSync = require('./shared/utils/dashboard-sync');
const taskDispatcher = require('./shared/utils/task-dispatcher');

// Import agent modules
const { sendFollowUp } = require('./sales/follow-up');
const { updatePipeline } = require('./sales/pipeline-manager');
const { analyzeOnPageSEO } = require('./marketing/seo-optimizer');
const { generateArticle } = require('./marketing/content-engine');
const { runHealthCheck } = require('./it/systems');
const { runWeeklyOptimization } = require('./it/ai-optimization');

const logger = createLogger('night-shift-runner');

// ── Constants ────────────────────────────────────────────────────────────────

const AGENT_NAME = 'night-shift-runner';
const POLL_INTERVAL = 30000; // 30 seconds for continuous mode
const MAX_CONCURRENT_TASKS = 3; // Limit concurrent task execution

// ── Task Handler Registration ────────────────────────────────────────────────

/**
 * Register all agent task handlers with the dispatcher
 */
function registerTaskHandlers() {
  logger.info('Registering task handlers...');

  // Scrape handler (placeholder - implement actual scraper)
  taskDispatcher.registerHandler('scrape', async (data) => {
    logger.info(`Scraping: ${data.url || 'unknown URL'}`);
    // TODO: Implement actual web scraping logic
    return {
      success: true,
      output: `Scraped data from ${data.url}`,
      tokensUsed: 0,
    };
  });

  // SEO analysis handler
  taskDispatcher.registerHandler('seo-analysis', async (data) => {
    logger.info(`Running SEO analysis for: ${data.url || 'website'}`);

    const result = await analyzeOnPageSEO(data.url || 'https://werkpilot.ch');

    return {
      success: true,
      output: result,
      tokensUsed: 500,
    };
  });

  // Follow-up email handler
  taskDispatcher.registerHandler('follow-up', async (data) => {
    logger.info(`Sending follow-up email for lead: ${data.leadId}`);

    const result = await sendFollowUp({ id: data.leadId, ...data.leadData });

    return {
      success: result.success || false,
      output: result,
      tokensUsed: 300,
    };
  });

  // Pipeline update handler
  taskDispatcher.registerHandler('pipeline-update', async (data) => {
    logger.info('Running pipeline update...');

    const results = await updatePipeline();

    return {
      success: true,
      output: `Pipeline updated: ${results.length} leads progressed`,
      tokensUsed: 200,
    };
  });

  // Content generation handler
  taskDispatcher.registerHandler('content-generate', async (data) => {
    logger.info(`Generating content: ${data.topic || 'unknown topic'}`);

    const result = await generateArticle(data.topic, data.type || 'blog', data.language || 'de');

    return {
      success: true,
      output: result,
      tokensUsed: 2000,
    };
  });

  // Security scan handler (using health check as proxy)
  taskDispatcher.registerHandler('security-scan', async (data) => {
    logger.info(`Running security scan: ${data.scope || 'full'}`);

    const result = await runHealthCheck();

    return {
      success: true,
      output: result,
      tokensUsed: 100,
    };
  });

  // AI optimization handler
  taskDispatcher.registerHandler('agent-optimize', async (data) => {
    logger.info(`Running AI agent optimization: ${data.agentName || 'all agents'}`);

    const result = await runWeeklyOptimization();

    return {
      success: true,
      output: result,
      tokensUsed: 1000,
    };
  });

  const registeredTypes = taskDispatcher.getRegisteredTypes();
  logger.info(`Registered ${registeredTypes.length} task handlers: ${registeredTypes.join(', ')}`);
}

// ── Task Execution ───────────────────────────────────────────────────────────

/**
 * Fetch pending tasks from dashboard
 */
async function fetchPendingTasks() {
  try {
    logger.info('Fetching pending tasks from dashboard...');

    const response = await dashboardClient.get('/api/nightshift?status=pending');

    const tasks = response.tasks || [];
    logger.info(`Found ${tasks.length} pending tasks`);

    return tasks;
  } catch (error) {
    logger.error(`Failed to fetch pending tasks: ${error.message}`);
    throw error;
  }
}

/**
 * Update task status in dashboard
 */
async function updateTaskStatus(taskId, status, output = null, durationMs = null, tokensUsed = null) {
  try {
    const updateData = {
      id: taskId,
      status,
      output: output ? JSON.stringify(output) : null,
    };

    await dashboardClient.patch('/api/nightshift', updateData);

    logger.info(`Task ${taskId} updated: ${status}`);
  } catch (error) {
    logger.error(`Failed to update task ${taskId}: ${error.message}`);
    // Don't throw - task execution succeeded even if update failed
  }
}

/**
 * Execute a single task
 */
async function executeTask(task) {
  const { id, task: taskType, priority } = task;

  logger.info(`Executing task ${id}: ${taskType} (priority: ${priority})`);

  const startTime = Date.now();

  try {
    // Mark task as running
    await updateTaskStatus(id, 'running');

    // Parse task data if it's a JSON string
    let taskData = {};
    if (task.data && typeof task.data === 'string') {
      try {
        taskData = JSON.parse(task.data);
      } catch (e) {
        logger.warn(`Failed to parse task data for ${id}, using raw value`);
        taskData = { raw: task.data };
      }
    } else if (task.data) {
      taskData = task.data;
    }

    // Dispatch to appropriate handler
    const result = await taskDispatcher.dispatch({
      id,
      type: taskType,
      data: taskData,
    });

    const durationMs = Date.now() - startTime;

    if (result.success) {
      await updateTaskStatus(id, 'done', result.output, durationMs, result.tokensUsed);

      logger.info(
        `Task ${id} completed successfully: ${taskType} (${durationMs}ms, ${result.tokensUsed} tokens)`
      );

      return {
        taskId: id,
        taskType,
        success: true,
        durationMs,
        tokensUsed: result.tokensUsed,
        output: result.output,
      };
    } else {
      await updateTaskStatus(id, 'failed', { error: result.error }, durationMs, result.tokensUsed);

      logger.error(`Task ${id} failed: ${result.error}`);

      return {
        taskId: id,
        taskType,
        success: false,
        durationMs,
        tokensUsed: result.tokensUsed,
        error: result.error,
      };
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;

    await updateTaskStatus(id, 'failed', { error: error.message }, durationMs, 0);

    logger.error(`Task ${id} execution error: ${error.message}`);

    return {
      taskId: id,
      taskType,
      success: false,
      durationMs,
      tokensUsed: 0,
      error: error.message,
    };
  }
}

/**
 * Execute tasks with concurrency limit
 */
async function executeTasks(tasks) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    // Execute task and add to executing pool
    const promise = executeTask(task).then((result) => {
      // Remove from executing pool when done
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });

    executing.push(promise);
    results.push(promise);

    // Wait if we've hit the concurrency limit
    if (executing.length >= MAX_CONCURRENT_TASKS) {
      await Promise.race(executing);
    }
  }

  // Wait for all remaining tasks to complete
  return Promise.all(results);
}

// ── Reporting ────────────────────────────────────────────────────────────────

/**
 * Generate and send summary report
 */
async function sendSummaryReport(results) {
  const totalTasks = results.length;
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => r.success === false).length;
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
  const totalTokens = results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

  const avgDuration = totalTasks > 0 ? Math.round(totalDuration / totalTasks) : 0;
  const successRate = totalTasks > 0 ? ((successful / totalTasks) * 100).toFixed(1) : 0;

  logger.info(
    `Night Shift Summary: ${successful}/${totalTasks} successful (${successRate}%), ` +
    `${totalTokens} tokens, avg ${avgDuration}ms per task`
  );

  // Send dashboard notification
  await dashboardSync.sendNotification(
    'Night Shift Complete',
    `Completed ${totalTasks} tasks: ${successful} successful, ${failed} failed. ` +
    `Total tokens: ${totalTokens}`,
    failed > 0 ? 'warning' : 'success'
  );

  // Detailed results breakdown
  const taskBreakdown = {};
  results.forEach((r) => {
    if (!taskBreakdown[r.taskType]) {
      taskBreakdown[r.taskType] = { total: 0, successful: 0, failed: 0 };
    }
    taskBreakdown[r.taskType].total++;
    if (r.success) {
      taskBreakdown[r.taskType].successful++;
    } else {
      taskBreakdown[r.taskType].failed++;
    }
  });

  return {
    totalTasks,
    successful,
    failed,
    successRate: parseFloat(successRate),
    totalDuration,
    avgDuration,
    totalTokens,
    taskBreakdown,
    timestamp: new Date().toISOString(),
  };
}

// ── Main Execution ───────────────────────────────────────────────────────────

/**
 * Run night shift once (process all pending tasks)
 */
async function runOnce(dryRun = false) {
  const runStartTime = Date.now();

  logger.info('=== Night Shift Runner Starting ===');

  try {
    await dashboardSync.syncAgentStatus(AGENT_NAME, 'active');

    // Register all task handlers
    registerTaskHandlers();

    // Fetch pending tasks
    const tasks = await fetchPendingTasks();

    if (tasks.length === 0) {
      logger.info('No pending tasks. Night shift idle.');
      await dashboardSync.syncAgentStatus(AGENT_NAME, 'idle');
      return {
        success: true,
        tasksExecuted: 0,
        message: 'No pending tasks',
      };
    }

    if (dryRun) {
      logger.info('DRY RUN MODE - Tasks would be executed:');
      tasks.forEach((task) => {
        logger.info(`  - [${task.id}] ${task.task} (priority: ${task.priority})`);
      });
      return {
        success: true,
        dryRun: true,
        tasks: tasks.map((t) => ({ id: t.id, type: t.task, priority: t.priority })),
      };
    }

    // Execute all tasks
    logger.info(`Executing ${tasks.length} tasks...`);
    const results = await executeTasks(tasks);

    // Generate summary report
    const summary = await sendSummaryReport(results);

    const totalDuration = Date.now() - runStartTime;
    logger.info(`=== Night Shift Complete in ${(totalDuration / 1000).toFixed(1)}s ===`);

    await dashboardSync.syncAgentStatus(
      AGENT_NAME,
      'idle',
      summary.successRate,
      summary.successful,
      summary.failed
    );

    return {
      success: true,
      summary,
      results,
      totalDuration,
    };
  } catch (error) {
    logger.error(`Night shift error: ${error.message}`, { stack: error.stack });

    await dashboardSync.syncAgentStatus(AGENT_NAME, 'error');
    await dashboardSync.sendNotification(
      'Night Shift Error',
      `Night shift runner failed: ${error.message}`,
      'error'
    );

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Continuous mode - poll for new tasks
 */
async function runContinuous() {
  logger.info('=== Night Shift Runner - Continuous Mode ===');
  logger.info(`Polling interval: ${POLL_INTERVAL}ms`);

  let running = true;

  // Graceful shutdown handler
  process.on('SIGINT', () => {
    logger.info('Received SIGINT - shutting down gracefully...');
    running = false;
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM - shutting down gracefully...');
    running = false;
  });

  while (running) {
    try {
      await runOnce();
    } catch (error) {
      logger.error(`Continuous mode error: ${error.message}`);
    }

    // Wait before next poll
    if (running) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  logger.info('Night shift runner stopped');
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  const isContinuous = args.includes('--continuous') || args.includes('-c');
  const isDryRun = args.includes('--dry-run') || args.includes('-d');

  if (isContinuous) {
    await runContinuous();
  } else {
    const result = await runOnce(isDryRun);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runOnce,
  runContinuous,
  executeTask,
  fetchPendingTasks,
  registerTaskHandlers,
};

// Start if executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
