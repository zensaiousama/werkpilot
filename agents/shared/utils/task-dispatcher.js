/**
 * Task Dispatcher Utility
 *
 * Central registry for routing task types to their handler functions.
 * Provides a clean abstraction for executing different types of night shift tasks.
 *
 * Usage:
 *   const dispatcher = require('./task-dispatcher');
 *   dispatcher.registerHandler('scrape', scraperHandler);
 *   const result = await dispatcher.dispatch({ type: 'scrape', data: {...} });
 */

const { createLogger } = require('./logger');

const logger = createLogger('task-dispatcher');

class TaskDispatcher {
  constructor() {
    // Registry maps task types to handler functions
    this.handlers = new Map();

    // Task execution metrics
    this.metrics = {
      totalExecuted: 0,
      totalSuccess: 0,
      totalFailed: 0,
      avgDurationMs: 0,
      totalTokensUsed: 0,
    };
  }

  /**
   * Register a handler for a specific task type
   * @param {string} taskType - The task type identifier (e.g., 'scrape', 'seo-analysis')
   * @param {Function} handlerFn - Async function that executes the task
   */
  registerHandler(taskType, handlerFn) {
    if (typeof handlerFn !== 'function') {
      throw new Error(`Handler for task type "${taskType}" must be a function`);
    }

    this.handlers.set(taskType, handlerFn);
    logger.info(`Registered handler for task type: ${taskType}`);
  }

  /**
   * Dispatch a task to its registered handler
   * @param {Object} task - Task object with type and data
   * @param {string} task.type - Task type (must match a registered handler)
   * @param {Object} task.data - Task-specific data/parameters
   * @returns {Object} Execution result with success, output, duration, and tokens
   */
  async dispatch(task) {
    const { type, data = {}, id } = task;

    if (!type) {
      return {
        success: false,
        error: 'Task type is required',
        durationMs: 0,
        tokensUsed: 0,
      };
    }

    const handler = this.handlers.get(type);

    if (!handler) {
      logger.error(`No handler registered for task type: ${type}`);
      return {
        success: false,
        error: `No handler found for task type: ${type}`,
        durationMs: 0,
        tokensUsed: 0,
      };
    }

    logger.info(`Dispatching task [${id || 'unknown'}] of type: ${type}`);

    const startTime = Date.now();
    let result;

    try {
      // Execute handler with error wrapping
      const handlerResult = await handler(data, task);

      const durationMs = Date.now() - startTime;

      // Normalize handler result format
      if (typeof handlerResult === 'object' && handlerResult !== null) {
        result = {
          success: handlerResult.success !== false, // Default to true if not explicitly false
          output: handlerResult.output || handlerResult.data || handlerResult.result || null,
          durationMs,
          tokensUsed: handlerResult.tokensUsed || handlerResult.tokens || 0,
          error: handlerResult.error || null,
        };
      } else {
        // Simple return value
        result = {
          success: true,
          output: handlerResult,
          durationMs,
          tokensUsed: 0,
        };
      }

      // Update metrics
      this.metrics.totalExecuted++;
      if (result.success) {
        this.metrics.totalSuccess++;
      } else {
        this.metrics.totalFailed++;
      }
      this.metrics.avgDurationMs =
        (this.metrics.avgDurationMs * (this.metrics.totalExecuted - 1) + durationMs) /
        this.metrics.totalExecuted;
      this.metrics.totalTokensUsed += result.tokensUsed;

      logger.info(
        `Task [${id || 'unknown'}] ${result.success ? 'completed' : 'failed'}: ` +
        `${type} (${durationMs}ms, ${result.tokensUsed} tokens)`
      );

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      logger.error(`Task [${id || 'unknown'}] execution error: ${error.message}`, {
        type,
        stack: error.stack,
      });

      this.metrics.totalExecuted++;
      this.metrics.totalFailed++;
      this.metrics.avgDurationMs =
        (this.metrics.avgDurationMs * (this.metrics.totalExecuted - 1) + durationMs) /
        this.metrics.totalExecuted;

      return {
        success: false,
        error: error.message,
        output: null,
        durationMs,
        tokensUsed: 0,
      };
    }
  }

  /**
   * Get list of registered task types
   * @returns {Array<string>} Array of registered task type names
   */
  getRegisteredTypes() {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a task type has a registered handler
   * @param {string} taskType - Task type to check
   * @returns {boolean} True if handler is registered
   */
  hasHandler(taskType) {
    return this.handlers.has(taskType);
  }

  /**
   * Remove a registered handler
   * @param {string} taskType - Task type to unregister
   */
  unregisterHandler(taskType) {
    if (this.handlers.delete(taskType)) {
      logger.info(`Unregistered handler for task type: ${taskType}`);
      return true;
    }
    return false;
  }

  /**
   * Get current execution metrics
   * @returns {Object} Metrics object with execution statistics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalExecuted > 0
        ? (this.metrics.totalSuccess / this.metrics.totalExecuted) * 100
        : 0,
    };
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.metrics = {
      totalExecuted: 0,
      totalSuccess: 0,
      totalFailed: 0,
      avgDurationMs: 0,
      totalTokensUsed: 0,
    };
    logger.info('Task dispatcher metrics reset');
  }

  /**
   * Clear all registered handlers
   */
  clearHandlers() {
    const count = this.handlers.size;
    this.handlers.clear();
    logger.info(`Cleared ${count} registered handlers`);
  }
}

// Singleton instance
const dispatcher = new TaskDispatcher();

module.exports = dispatcher;
