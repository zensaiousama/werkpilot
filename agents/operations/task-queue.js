/**
 * Task Queue - In-memory task queue for workflow orchestration
 * Agent 20 support module
 *
 * Provides add, get, update, list, retry methods for managing
 * workflow tasks across the Werkpilot agent system.
 */

const { v4: uuidv4 } = require('uuid') || { v4: () => `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
const { createLogger } = require('../shared/utils/logger');

const log = createLogger('task-queue');

// Task statuses
const STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRY: 'retry',
  CANCELLED: 'cancelled',
};

// In-memory task store
const tasks = new Map();
const workflowInstances = new Map();

// Generate unique ID
function generateId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add a new task to the queue
 */
function addTask({
  workflowId,
  workflowInstanceId,
  stepId,
  agent,
  action,
  input = {},
  priority = 5,
  timeout = 60000,
  maxRetries = 3,
  delay = 0,
  dependsOn = [],
}) {
  const id = generateId();
  const task = {
    id,
    workflowId,
    workflowInstanceId,
    stepId,
    agent,
    action,
    input,
    priority,
    status: STATUS.PENDING,
    timeout,
    maxRetries,
    retryCount: 0,
    delay,
    dependsOn,
    output: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    scheduledFor: delay > 0 ? new Date(Date.now() + delay).toISOString() : null,
  };

  tasks.set(id, task);
  log.info(`Task added: ${id} [${agent}.${action}] for workflow ${workflowId}`);
  return task;
}

/**
 * Get a task by ID
 */
function getTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) {
    log.warn(`Task not found: ${taskId}`);
    return null;
  }
  return { ...task };
}

/**
 * Update a task
 */
function updateTask(taskId, updates) {
  const task = tasks.get(taskId);
  if (!task) {
    log.warn(`Cannot update - task not found: ${taskId}`);
    return null;
  }

  const updated = {
    ...task,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Set timestamps based on status transitions
  if (updates.status === STATUS.IN_PROGRESS && !task.startedAt) {
    updated.startedAt = new Date().toISOString();
  }
  if (updates.status === STATUS.COMPLETED || updates.status === STATUS.FAILED) {
    updated.completedAt = new Date().toISOString();
  }

  tasks.set(taskId, updated);
  log.info(`Task updated: ${taskId} -> ${updates.status || 'fields updated'}`);
  return { ...updated };
}

/**
 * Mark task as in-progress
 */
function startTask(taskId) {
  return updateTask(taskId, { status: STATUS.IN_PROGRESS });
}

/**
 * Mark task as completed with output
 */
function completeTask(taskId, output = {}) {
  return updateTask(taskId, {
    status: STATUS.COMPLETED,
    output,
    error: null,
  });
}

/**
 * Mark task as failed with error
 */
function failTask(taskId, error) {
  const task = tasks.get(taskId);
  if (!task) return null;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  if (task.retryCount < task.maxRetries) {
    log.warn(`Task ${taskId} failed (attempt ${task.retryCount + 1}/${task.maxRetries}): ${errorMessage}`);
    return updateTask(taskId, {
      status: STATUS.RETRY,
      error: { message: errorMessage, stack: errorStack, attempt: task.retryCount + 1 },
      retryCount: task.retryCount + 1,
    });
  }

  log.error(`Task ${taskId} permanently failed after ${task.maxRetries} attempts: ${errorMessage}`);
  return updateTask(taskId, {
    status: STATUS.FAILED,
    error: { message: errorMessage, stack: errorStack, attempt: task.retryCount + 1 },
  });
}

/**
 * Retry a failed task
 */
function retryTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) {
    log.warn(`Cannot retry - task not found: ${taskId}`);
    return null;
  }

  if (task.status !== STATUS.FAILED && task.status !== STATUS.RETRY) {
    log.warn(`Cannot retry task ${taskId} - status is ${task.status}`);
    return null;
  }

  if (task.retryCount >= task.maxRetries) {
    log.warn(`Cannot retry task ${taskId} - max retries (${task.maxRetries}) reached`);
    return null;
  }

  log.info(`Retrying task ${taskId} (attempt ${task.retryCount + 1}/${task.maxRetries})`);
  return updateTask(taskId, {
    status: STATUS.PENDING,
    error: null,
    startedAt: null,
    completedAt: null,
  });
}

/**
 * List tasks with optional filtering
 */
function listTasks({
  status = null,
  workflowId = null,
  workflowInstanceId = null,
  agent = null,
  limit = 100,
  offset = 0,
  sortBy = 'createdAt',
  sortOrder = 'desc',
} = {}) {
  let results = Array.from(tasks.values());

  // Apply filters
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    results = results.filter(t => statuses.includes(t.status));
  }
  if (workflowId) {
    results = results.filter(t => t.workflowId === workflowId);
  }
  if (workflowInstanceId) {
    results = results.filter(t => t.workflowInstanceId === workflowInstanceId);
  }
  if (agent) {
    results = results.filter(t => t.agent === agent);
  }

  // Sort
  results.sort((a, b) => {
    const aVal = a[sortBy] || '';
    const bVal = b[sortBy] || '';
    return sortOrder === 'desc'
      ? (bVal > aVal ? 1 : -1)
      : (aVal > bVal ? 1 : -1);
  });

  // Paginate
  const total = results.length;
  results = results.slice(offset, offset + limit);

  return { tasks: results, total, limit, offset };
}

/**
 * Get next pending task (respects priority and dependencies)
 */
function getNextPendingTask() {
  const pending = Array.from(tasks.values())
    .filter(t => {
      if (t.status !== STATUS.PENDING && t.status !== STATUS.RETRY) return false;
      // Check delay
      if (t.scheduledFor && new Date(t.scheduledFor) > new Date()) return false;
      // Check dependencies are completed
      if (t.dependsOn && t.dependsOn.length > 0) {
        const allDepsCompleted = t.dependsOn.every(depStepId => {
          const depTask = Array.from(tasks.values()).find(
            dt => dt.workflowInstanceId === t.workflowInstanceId && dt.stepId === depStepId
          );
          return depTask && depTask.status === STATUS.COMPLETED;
        });
        if (!allDepsCompleted) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Higher priority first (lower number = higher priority)
      if (a.priority !== b.priority) return a.priority - b.priority;
      // Retries get slight priority
      if (a.status === STATUS.RETRY && b.status !== STATUS.RETRY) return -1;
      if (b.status === STATUS.RETRY && a.status !== STATUS.RETRY) return 1;
      // Older tasks first
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

  return pending.length > 0 ? { ...pending[0] } : null;
}

/**
 * Get tasks that are ready for retry
 */
function getRetryableTasks() {
  return Array.from(tasks.values())
    .filter(t => t.status === STATUS.RETRY && t.retryCount < t.maxRetries)
    .map(t => ({ ...t }));
}

/**
 * Get tasks exceeding their timeout (stuck in progress)
 */
function getStuckTasks() {
  const now = Date.now();
  return Array.from(tasks.values())
    .filter(t => {
      if (t.status !== STATUS.IN_PROGRESS) return false;
      if (!t.startedAt) return false;
      const elapsed = now - new Date(t.startedAt).getTime();
      return elapsed > t.timeout;
    })
    .map(t => ({ ...t }));
}

/**
 * Cancel a task
 */
function cancelTask(taskId) {
  return updateTask(taskId, { status: STATUS.CANCELLED });
}

/**
 * Get queue statistics
 */
function getStats() {
  const all = Array.from(tasks.values());
  const stats = {
    total: all.length,
    pending: all.filter(t => t.status === STATUS.PENDING).length,
    inProgress: all.filter(t => t.status === STATUS.IN_PROGRESS).length,
    completed: all.filter(t => t.status === STATUS.COMPLETED).length,
    failed: all.filter(t => t.status === STATUS.FAILED).length,
    retry: all.filter(t => t.status === STATUS.RETRY).length,
    cancelled: all.filter(t => t.status === STATUS.CANCELLED).length,
    stuck: getStuckTasks().length,
  };

  // Per-workflow stats
  stats.byWorkflow = {};
  all.forEach(t => {
    if (!stats.byWorkflow[t.workflowId]) {
      stats.byWorkflow[t.workflowId] = { total: 0, completed: 0, failed: 0, pending: 0 };
    }
    stats.byWorkflow[t.workflowId].total++;
    if (t.status === STATUS.COMPLETED) stats.byWorkflow[t.workflowId].completed++;
    if (t.status === STATUS.FAILED) stats.byWorkflow[t.workflowId].failed++;
    if (t.status === STATUS.PENDING) stats.byWorkflow[t.workflowId].pending++;
  });

  // Average completion time
  const completedTasks = all.filter(t => t.completedAt && t.startedAt);
  if (completedTasks.length > 0) {
    const totalTime = completedTasks.reduce((sum, t) => {
      return sum + (new Date(t.completedAt) - new Date(t.startedAt));
    }, 0);
    stats.avgCompletionMs = Math.round(totalTime / completedTasks.length);
  }

  return stats;
}

/**
 * Clean up old completed/failed tasks
 */
function cleanup(maxAgeHours = 24) {
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  let removed = 0;

  for (const [id, task] of tasks.entries()) {
    if (
      (task.status === STATUS.COMPLETED || task.status === STATUS.FAILED || task.status === STATUS.CANCELLED) &&
      new Date(task.updatedAt).getTime() < cutoff
    ) {
      tasks.delete(id);
      removed++;
    }
  }

  if (removed > 0) {
    log.info(`Cleaned up ${removed} old tasks`);
  }
  return removed;
}

/**
 * Track a workflow instance
 */
function createWorkflowInstance(workflowId, triggeredBy, triggerData = {}) {
  const instanceId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const instance = {
    id: instanceId,
    workflowId,
    triggeredBy,
    triggerData,
    status: 'running',
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  workflowInstances.set(instanceId, instance);
  return instance;
}

/**
 * Get workflow instance
 */
function getWorkflowInstance(instanceId) {
  return workflowInstances.get(instanceId) || null;
}

/**
 * Update workflow instance status
 */
function updateWorkflowInstance(instanceId, updates) {
  const instance = workflowInstances.get(instanceId);
  if (!instance) return null;
  const updated = { ...instance, ...updates, updatedAt: new Date().toISOString() };
  if (updates.status === 'completed' || updates.status === 'failed') {
    updated.completedAt = new Date().toISOString();
  }
  workflowInstances.set(instanceId, updated);
  return updated;
}

module.exports = {
  STATUS,
  addTask,
  getTask,
  updateTask,
  startTask,
  completeTask,
  failTask,
  retryTask,
  listTasks,
  getNextPendingTask,
  getRetryableTasks,
  getStuckTasks,
  cancelTask,
  getStats,
  cleanup,
  createWorkflowInstance,
  getWorkflowInstance,
  updateWorkflowInstance,
  generateId,
};
