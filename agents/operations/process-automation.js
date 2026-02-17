/**
 * Agent 20 — Process Automation Agent
 * Department: Operations
 *
 * Orchestrates workflows between agents using a task queue.
 * Manages workflow definitions, task execution, retries, and SLA monitoring.
 *
 * Workflows:
 *   - New Lead: Scrape -> Score -> Fitness Check -> CRM Update -> Email
 *   - New Client: Onboard -> Setup -> First Report -> Check-in
 *   - Content Publish: Write -> QA -> SEO Check -> Publish -> Social Share
 *
 * Task queue states: Pending -> In Progress -> Completed / Failed
 * Auto-retry failed tasks (max 3 attempts).
 * SLA monitoring with alerts if task exceeds expected duration.
 *
 * Schedule: Queue processor runs every minute, SLA check every 5 minutes
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../shared/utils/logger');
const { generateJSON } = require('../shared/utils/claude-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const config = require('../shared/utils/config');
const taskQueue = require('./task-queue');

const log = createLogger('process-automation');

// --- Workflow Definitions ---

const WORKFLOWS_DIR = path.join(__dirname, 'workflows');
let workflows = {};

function loadWorkflows() {
  try {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const workflow = JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf8'));
      workflows[workflow.id] = workflow;
    }
    log.info(`Loaded ${Object.keys(workflows).length} workflow definitions: ${Object.keys(workflows).join(', ')}`);
  } catch (err) {
    log.error(`Failed to load workflows: ${err.message}`);
  }
}

// --- Workflow Triggers ---

const WORKFLOW_TRIGGERS = {
  'lead_score_changed': {
    name: 'Lead Score Changed',
    description: 'Triggered when a lead score crosses a threshold',
    handler: handleLeadScoreChanged,
  },
  'agent_error': {
    name: 'Agent Error',
    description: 'Triggered when an agent encounters an error',
    handler: handleAgentError,
  },
  'task_completed': {
    name: 'Task Completed',
    description: 'Triggered when a specific task completes',
    handler: handleTaskCompleted,
  },
  'new_lead': {
    name: 'New Lead',
    description: 'Triggered when a new lead is created',
    handler: handleNewLead,
  },
  'new_client': {
    name: 'New Client',
    description: 'Triggered when a client is onboarded',
    handler: handleNewClient,
  },
};

async function handleLeadScoreChanged({ leadId, oldScore, newScore, threshold }) {
  log.info(`Lead score changed: ${leadId} from ${oldScore} to ${newScore}`);

  if (newScore >= 80 && oldScore < 80) {
    // High-value lead workflow
    return await startWorkflow('high-value-lead', { leadId, score: newScore }, 'lead_score_trigger');
  } else if (newScore >= 60 && oldScore < 60) {
    // Medium-value lead workflow
    return await startWorkflow('medium-value-lead', { leadId, score: newScore }, 'lead_score_trigger');
  }

  return null;
}

async function handleAgentError({ agentName, action, error, taskId, retryCount }) {
  log.error(`Agent error: ${agentName}.${action} - ${error}`);

  if (retryCount >= 3) {
    // Escalate after max retries
    return await startWorkflow('agent-error-escalation', {
      agentName,
      action,
      error,
      taskId,
      retryCount,
    }, 'agent_error_trigger');
  } else {
    // Log and retry
    log.info(`Agent will retry (${retryCount}/3)`);
    return null;
  }
}

async function handleTaskCompleted({ taskId, workflowId, output, agent }) {
  log.info(`Task completed: ${taskId} in workflow ${workflowId}`);

  // Trigger follow-up workflows based on task type
  if (agent === 'sales-lead-qualifier' && output?.qualified) {
    return await startWorkflow('qualified-lead-followup', { taskId, leadData: output }, 'task_completion_trigger');
  } else if (agent === 'marketing-content-creator' && output?.published) {
    return await startWorkflow('content-promotion', { taskId, contentData: output }, 'task_completion_trigger');
  }

  return null;
}

async function handleNewLead({ leadId, source, companyName }) {
  log.info(`New lead: ${leadId} from ${source}`);
  return await startWorkflow('new-lead', { leadId, source, companyName }, 'new_lead_trigger');
}

async function handleNewClient({ clientId, clientName, plan }) {
  log.info(`New client: ${clientName} (${clientId})`);
  return await startWorkflow('new-client', { clientId, clientName, plan }, 'new_client_trigger');
}

/**
 * Trigger a workflow based on an event
 */
async function triggerWorkflow(triggerType, data) {
  const trigger = WORKFLOW_TRIGGERS[triggerType];
  if (!trigger) {
    log.warn(`Unknown trigger type: ${triggerType}`);
    return null;
  }

  log.info(`Workflow trigger: ${trigger.name}`);

  try {
    const result = await trigger.handler(data);
    await logWorkflowExecution({
      triggerType,
      triggerData: data,
      result,
      timestamp: new Date().toISOString(),
    });
    return result;
  } catch (err) {
    log.error(`Trigger handler failed for ${triggerType}: ${err.message}`);
    return null;
  }
}

// --- Workflow Execution Logging ---

const WORKFLOW_LOG_PATH = path.join(__dirname, 'workflow-executions.json');
let workflowExecutionLog = [];

function loadWorkflowLog() {
  try {
    if (fs.existsSync(WORKFLOW_LOG_PATH)) {
      workflowExecutionLog = JSON.parse(fs.readFileSync(WORKFLOW_LOG_PATH, 'utf8'));
      log.info(`Workflow execution log loaded: ${workflowExecutionLog.length} entries`);
    }
  } catch (err) {
    log.error(`Failed to load workflow log: ${err.message}`);
  }
}

function saveWorkflowLog() {
  try {
    // Keep only last 1000 entries
    if (workflowExecutionLog.length > 1000) {
      workflowExecutionLog = workflowExecutionLog.slice(-1000);
    }
    fs.writeFileSync(WORKFLOW_LOG_PATH, JSON.stringify(workflowExecutionLog, null, 2));
  } catch (err) {
    log.error(`Failed to save workflow log: ${err.message}`);
  }
}

async function logWorkflowExecution(logEntry) {
  workflowExecutionLog.push(logEntry);
  saveWorkflowLog();

  // Sync to dashboard (Airtable)
  try {
    await createRecord('WorkflowExecutions', {
      TriggerType: logEntry.triggerType || 'unknown',
      TriggerData: JSON.stringify(logEntry.triggerData || {}),
      InstanceID: logEntry.result?.instanceId || '',
      WorkflowID: logEntry.result?.workflowId || '',
      Status: logEntry.result ? 'Started' : 'Failed',
      Timestamp: logEntry.timestamp,
    });
  } catch (err) {
    log.warn(`Failed to sync workflow execution to dashboard: ${err.message}`);
  }
}

// --- Workflow Execution ---

/**
 * Start a workflow instance
 */
async function startWorkflow(workflowId, triggerData = {}, triggeredBy = 'system') {
  const workflow = workflows[workflowId];
  if (!workflow) {
    log.error(`Workflow not found: ${workflowId}`);
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  log.info(`Starting workflow: ${workflow.name} (${workflowId}), triggered by ${triggeredBy}`);

  // Create workflow instance
  const instance = taskQueue.createWorkflowInstance(workflowId, triggeredBy, triggerData);

  // Create tasks for each step
  const taskIds = {};
  for (const step of workflow.steps) {
    const task = taskQueue.addTask({
      workflowId,
      workflowInstanceId: instance.id,
      stepId: step.id,
      agent: step.agent,
      action: step.action,
      input: resolveInputTemplates(step.input || {}, { trigger: { data: triggerData } }),
      priority: getPriorityFromWorkflow(workflow),
      timeout: step.timeout || 60000,
      maxRetries: step.retries || 3,
      delay: parseDelay(step.delay),
      dependsOn: step.dependsOn || [],
    });
    taskIds[step.id] = task.id;
  }

  log.info(`Workflow ${workflowId} instance ${instance.id} created with ${Object.keys(taskIds).length} tasks`);

  // Track in Airtable
  try {
    await createRecord('Tasks', {
      WorkflowID: workflowId,
      InstanceID: instance.id,
      TriggeredBy: triggeredBy,
      Status: 'Running',
      StepCount: workflow.steps.length,
      StartedAt: new Date().toISOString(),
    });
  } catch (err) {
    log.warn(`Failed to track workflow in Airtable: ${err.message}`);
  }

  return {
    instanceId: instance.id,
    workflowId,
    taskIds,
    stepCount: workflow.steps.length,
  };
}

/**
 * Resolve template variables in step input
 */
function resolveInputTemplates(input, context) {
  const resolved = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      const path = value.slice(2, -2).trim();
      resolved[key] = getNestedValue(context, path) || value;
    } else if (typeof value === 'object' && value !== null) {
      resolved[key] = resolveInputTemplates(value, context);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

/**
 * Get nested object value by dot path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Parse delay string to milliseconds
 */
function parseDelay(delay) {
  if (!delay) return 0;
  if (typeof delay === 'number') return delay;

  const match = delay.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return 0;

  const value = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] || 0);
}

/**
 * Get priority number from workflow
 */
function getPriorityFromWorkflow(workflow) {
  const sla = workflow.sla || {};
  if (sla.maxDurationMinutes <= 30) return 1;
  if (sla.maxDurationMinutes <= 120) return 3;
  return 5;
}

// --- Task Processing ---

/**
 * Process the next pending task in the queue
 */
async function processNextTask() {
  const task = taskQueue.getNextPendingTask();
  if (!task) return null;

  log.info(`Processing task: ${task.id} [${task.agent}.${task.action}]`);
  taskQueue.startTask(task.id);

  try {
    // Resolve input from completed dependency outputs
    const resolvedInput = await resolveTaskInput(task);

    // Execute the task (simulate agent call)
    const output = await executeAgentAction(task.agent, task.action, resolvedInput, task.timeout);

    taskQueue.completeTask(task.id, output);
    log.info(`Task completed: ${task.id}`);

    // Check if workflow is complete
    await checkWorkflowCompletion(task.workflowInstanceId);

    return { taskId: task.id, status: 'completed', output };
  } catch (err) {
    log.error(`Task failed: ${task.id} - ${err.message}`);
    const failedTask = taskQueue.failTask(task.id, err);

    // If task is set to retry, it will be picked up on next cycle
    if (failedTask && failedTask.status === taskQueue.STATUS.RETRY) {
      log.info(`Task ${task.id} queued for retry (attempt ${failedTask.retryCount}/${failedTask.maxRetries})`);
    }

    // Check if this failure should abort the workflow
    await handleTaskFailure(task, err);

    return { taskId: task.id, status: 'failed', error: err.message };
  }
}

/**
 * Resolve task input from dependency outputs
 */
async function resolveTaskInput(task) {
  const input = { ...task.input };

  if (task.dependsOn && task.dependsOn.length > 0) {
    const { tasks: allTasks } = taskQueue.listTasks({
      workflowInstanceId: task.workflowInstanceId,
    });

    const stepOutputs = {};
    for (const t of allTasks) {
      if (t.status === taskQueue.STATUS.COMPLETED && t.output) {
        stepOutputs[t.stepId] = t.output;
      }
    }

    // Resolve references like {{steps.scrape-enrich.output}}
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && value.includes('steps.')) {
        const match = value.match(/steps\.([^.]+)\.output(?:\.(.+))?/);
        if (match) {
          const stepId = match[1];
          const subPath = match[2];
          if (stepOutputs[stepId]) {
            input[key] = subPath ? getNestedValue(stepOutputs[stepId], subPath) : stepOutputs[stepId];
          }
        }
      }
    }
  }

  return input;
}

/**
 * Execute an agent action
 */
async function executeAgentAction(agentName, action, input, timeout) {
  // Attempt to load and call the actual agent
  const agentPaths = {
    'sales-lead-qualifier': '../sales/lead-qualifier',
    'sales-crm-sync': '../sales/crm-sync',
    'sales-follow-up': '../sales/follow-up',
    'sales-pipeline-manager': '../sales/pipeline-manager',
    'sales-proposal-writer': '../sales/proposal-writer',
    'marketing-content-creator': '../marketing/content-creator',
    'marketing-seo-optimizer': '../marketing/seo-optimizer',
    'marketing-social-media': '../marketing/social-media',
    'marketing-analytics': '../marketing/analytics',
    'marketing-email-campaigns': '../marketing/email-campaigns',
    'operations-project-tracker': './project-tracker',
    'operations-quality-assurance': './quality-assurance',
    'hr-onboarding': '../hr/onboarding',
    'it-infrastructure-monitor': '../it/infrastructure-monitor',
    'translation-engine': './translation-engine',
  };

  const agentPath = agentPaths[agentName];

  return new Promise(async (resolve, reject) => {
    // Timeout handler
    const timer = setTimeout(() => {
      reject(new Error(`Task timed out after ${timeout}ms`));
    }, timeout);

    try {
      if (agentPath) {
        try {
          const agent = require(agentPath);
          if (typeof agent[action] === 'function') {
            const result = await agent[action](input);
            clearTimeout(timer);
            resolve(result || { success: true, action, agent: agentName });
            return;
          }
        } catch (loadErr) {
          log.warn(`Could not load agent ${agentName}: ${loadErr.message}, using simulation`);
        }
      }

      // Simulation fallback for agents not yet implemented
      log.info(`Simulating: ${agentName}.${action}(${JSON.stringify(input).substring(0, 100)}...)`);
      await new Promise(r => setTimeout(r, Math.random() * 2000 + 500));

      clearTimeout(timer);
      resolve({
        success: true,
        simulated: true,
        agent: agentName,
        action,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

/**
 * Handle task failure (check if workflow should abort)
 */
async function handleTaskFailure(task, error) {
  const workflow = workflows[task.workflowId];
  if (!workflow) return;

  const step = workflow.steps.find(s => s.id === task.stepId);
  if (!step) return;

  if (step.onFailure === 'abort') {
    log.warn(`Aborting workflow ${task.workflowId} due to step ${task.stepId} failure`);
    taskQueue.updateWorkflowInstance(task.workflowInstanceId, { status: 'failed' });

    // Cancel remaining pending tasks
    const { tasks: remaining } = taskQueue.listTasks({
      workflowInstanceId: task.workflowInstanceId,
      status: [taskQueue.STATUS.PENDING],
    });

    for (const t of remaining) {
      taskQueue.cancelTask(t.id);
    }

    // Send alert
    if (workflow.onFailure && workflow.onFailure.alertTo === 'ceo') {
      try {
        await sendCEOEmail({
          subject: `Workflow Failed: ${workflow.name}`,
          html: `
            <h2>Workflow Failure Alert</h2>
            <p><strong>Workflow:</strong> ${workflow.name}</p>
            <p><strong>Failed Step:</strong> ${step.name} (${step.id})</p>
            <p><strong>Error:</strong> ${error.message}</p>
            <p><strong>Instance:</strong> ${task.workflowInstanceId}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString('de-CH')}</p>
          `,
        });
      } catch (emailErr) {
        log.error(`Failed to send workflow failure alert: ${emailErr.message}`);
      }
    }
  }
}

/**
 * Check if all tasks in a workflow instance are complete
 */
async function checkWorkflowCompletion(instanceId) {
  const { tasks: allTasks } = taskQueue.listTasks({ workflowInstanceId: instanceId });

  if (allTasks.length === 0) return;

  const allDone = allTasks.every(t =>
    t.status === taskQueue.STATUS.COMPLETED ||
    t.status === taskQueue.STATUS.FAILED ||
    t.status === taskQueue.STATUS.CANCELLED
  );

  if (!allDone) return;

  const instance = taskQueue.getWorkflowInstance(instanceId);
  if (!instance) return;

  const anyFailed = allTasks.some(t => t.status === taskQueue.STATUS.FAILED);
  const status = anyFailed ? 'completed_with_errors' : 'completed';

  taskQueue.updateWorkflowInstance(instanceId, { status });
  log.info(`Workflow instance ${instanceId} ${status}: ${allTasks.filter(t => t.status === taskQueue.STATUS.COMPLETED).length}/${allTasks.length} tasks succeeded`);

  // Handle workflow completion callback
  const workflow = workflows[instance.workflowId];
  if (workflow && workflow.onComplete && !anyFailed) {
    if (workflow.onComplete.notifyTo === 'ceo') {
      try {
        await sendCEOEmail({
          subject: `Workflow Complete: ${workflow.name}`,
          html: `
            <h2>Workflow Completed Successfully</h2>
            <p><strong>Workflow:</strong> ${workflow.name}</p>
            <p><strong>Tasks:</strong> ${allTasks.length} completed</p>
            <p><strong>Duration:</strong> ${((new Date() - new Date(instance.createdAt)) / 1000).toFixed(0)}s</p>
          `,
        });
      } catch (err) {
        log.warn(`Failed to send completion notification: ${err.message}`);
      }
    }
  }

  // Track in Airtable
  try {
    const records = await getRecords('Tasks', `{InstanceID} = '${instanceId}'`);
    if (records.length > 0) {
      await updateRecord('Tasks', records[0].id, {
        Status: status === 'completed' ? 'Completed' : 'Failed',
        CompletedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    log.warn(`Failed to update workflow record: ${err.message}`);
  }
}

// --- SLA Monitoring ---

async function monitorSLAs() {
  const { tasks: inProgress } = taskQueue.listTasks({
    status: [taskQueue.STATUS.IN_PROGRESS],
  });

  const violations = [];

  for (const task of inProgress) {
    if (!task.startedAt) continue;

    const elapsed = Date.now() - new Date(task.startedAt).getTime();
    const workflow = workflows[task.workflowId];

    if (!workflow) continue;

    const sla = workflow.sla || {};
    const alertThresholdMs = (sla.alertAfterMinutes || 60) * 60000;
    const maxDurationMs = (sla.maxDurationMinutes || 120) * 60000;

    if (elapsed > maxDurationMs) {
      violations.push({
        taskId: task.id,
        workflowId: task.workflowId,
        stepId: task.stepId,
        agent: task.agent,
        elapsedMinutes: (elapsed / 60000).toFixed(1),
        maxMinutes: sla.maxDurationMinutes,
        severity: 'critical',
      });
    } else if (elapsed > alertThresholdMs) {
      violations.push({
        taskId: task.id,
        workflowId: task.workflowId,
        stepId: task.stepId,
        agent: task.agent,
        elapsedMinutes: (elapsed / 60000).toFixed(1),
        alertMinutes: sla.alertAfterMinutes,
        severity: 'warning',
      });
    }
  }

  if (violations.length > 0) {
    log.warn(`SLA violations detected: ${violations.length}`);

    const critical = violations.filter(v => v.severity === 'critical');
    if (critical.length > 0) {
      try {
        await sendCEOEmail({
          subject: `SLA Violation Alert: ${critical.length} tasks overdue`,
          html: `
            <h2>SLA Violation Alert</h2>
            <p>${critical.length} task(s) have exceeded their maximum duration:</p>
            <table border="1" cellpadding="8" cellspacing="0">
              <tr><th>Workflow</th><th>Step</th><th>Agent</th><th>Elapsed</th><th>Max</th></tr>
              ${critical.map(v => `
                <tr>
                  <td>${v.workflowId}</td>
                  <td>${v.stepId}</td>
                  <td>${v.agent}</td>
                  <td>${v.elapsedMinutes} min</td>
                  <td>${v.maxMinutes} min</td>
                </tr>
              `).join('')}
            </table>
          `,
        });
      } catch (err) {
        log.error(`Failed to send SLA alert: ${err.message}`);
      }
    }
  }

  return violations;
}

// --- Retry Failed Tasks ---

async function retryFailedTasks() {
  const retryable = taskQueue.getRetryableTasks();

  if (retryable.length === 0) return [];

  log.info(`Retrying ${retryable.length} failed tasks`);
  const results = [];

  for (const task of retryable) {
    const retried = taskQueue.retryTask(task.id);
    if (retried) {
      results.push({ taskId: task.id, retryCount: task.retryCount });
    }
  }

  return results;
}

// --- Handle Stuck Tasks ---

async function handleStuckTasks() {
  const stuck = taskQueue.getStuckTasks();

  if (stuck.length === 0) return [];

  log.warn(`Found ${stuck.length} stuck tasks`);
  const results = [];

  for (const task of stuck) {
    const elapsed = Date.now() - new Date(task.startedAt).getTime();
    log.warn(`Stuck task ${task.id} [${task.agent}.${task.action}]: ${(elapsed / 1000).toFixed(0)}s elapsed`);

    // Fail the stuck task so it can be retried
    taskQueue.failTask(task.id, new Error(`Task stuck: exceeded timeout of ${task.timeout}ms`));
    results.push({ taskId: task.id, elapsedMs: elapsed });
  }

  return results;
}

// --- Workflow Performance Metrics ---

function getWorkflowPerformanceMetrics(days = 7) {
  const cutoff = Date.now() - (days * 24 * 3600000);
  const recentExecutions = workflowExecutionLog.filter(e => {
    const timestamp = new Date(e.timestamp).getTime();
    return timestamp > cutoff;
  });

  const metrics = {
    totalExecutions: recentExecutions.length,
    byWorkflow: {},
    byTrigger: {},
    avgExecutionTime: 0,
    successRate: 0,
  };

  for (const execution of recentExecutions) {
    const workflowId = execution.result?.workflowId || 'unknown';
    const triggerType = execution.triggerType || 'unknown';

    if (!metrics.byWorkflow[workflowId]) {
      metrics.byWorkflow[workflowId] = { count: 0, success: 0, failed: 0 };
    }
    metrics.byWorkflow[workflowId].count++;
    if (execution.result) {
      metrics.byWorkflow[workflowId].success++;
    } else {
      metrics.byWorkflow[workflowId].failed++;
    }

    if (!metrics.byTrigger[triggerType]) {
      metrics.byTrigger[triggerType] = { count: 0 };
    }
    metrics.byTrigger[triggerType].count++;
  }

  const successful = recentExecutions.filter(e => e.result).length;
  metrics.successRate = recentExecutions.length > 0
    ? ((successful / recentExecutions.length) * 100).toFixed(1)
    : 0;

  return metrics;
}

async function syncMetricsToDashboard(metrics) {
  try {
    // Sync workflow performance to Airtable
    for (const [workflowId, data] of Object.entries(metrics.byWorkflow)) {
      await createRecord('WorkflowMetrics', {
        WorkflowID: workflowId,
        TotalExecutions: data.count,
        Successful: data.success,
        Failed: data.failed,
        SuccessRate: data.count > 0 ? ((data.success / data.count) * 100).toFixed(1) : 0,
        Period: '7days',
        Timestamp: new Date().toISOString(),
      });
    }
    log.info('Workflow metrics synced to dashboard');
  } catch (err) {
    log.warn(`Failed to sync metrics to dashboard: ${err.message}`);
  }
}

// --- Dashboard Data ---

function getDashboardData() {
  const stats = taskQueue.getStats();
  const workflowStats = {};

  for (const [id, workflow] of Object.entries(workflows)) {
    workflowStats[id] = {
      name: workflow.name,
      steps: workflow.steps.length,
      sla: workflow.sla,
    };
  }

  const performanceMetrics = getWorkflowPerformanceMetrics(7);

  return {
    queueStats: stats,
    workflows: workflowStats,
    recentTasks: taskQueue.listTasks({ limit: 20 }).tasks,
    performanceMetrics,
    timestamp: new Date().toISOString(),
  };
}

// --- Process Queue Loop ---

async function processQueue(maxTasks = 10) {
  let processed = 0;

  for (let i = 0; i < maxTasks; i++) {
    const result = await processNextTask();
    if (!result) break;
    processed++;
  }

  return processed;
}

// --- Main Run ---

async function run() {
  log.info('Process Automation Agent starting...');
  loadWorkflows();
  loadWorkflowLog();

  // Process queue
  const processed = await processQueue();

  // Retry failed tasks
  const retried = await retryFailedTasks();

  // Handle stuck tasks
  const stuck = await handleStuckTasks();

  // SLA check
  const violations = await monitorSLAs();

  // Cleanup old tasks
  const cleaned = taskQueue.cleanup(24);

  // Get performance metrics
  const performanceMetrics = getWorkflowPerformanceMetrics(7);

  const result = {
    processed,
    retried: retried.length,
    stuck: stuck.length,
    slaViolations: violations.length,
    cleaned,
    queueStats: taskQueue.getStats(),
    performanceMetrics,
  };

  log.info(`Process Automation run complete: ${JSON.stringify(result)}`);
  return result;
}

// --- Cron Scheduling ---

function startSchedule() {
  loadWorkflows();
  loadWorkflowLog();

  // Process queue every minute
  cron.schedule('* * * * *', async () => {
    try {
      await processQueue();
    } catch (err) {
      log.error(`Queue processing failed: ${err.message}`);
    }
  });

  // Retry failed tasks every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await retryFailedTasks();
      await handleStuckTasks();
    } catch (err) {
      log.error(`Retry handling failed: ${err.message}`);
    }
  });

  // SLA monitoring every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await monitorSLAs();
    } catch (err) {
      log.error(`SLA monitoring failed: ${err.message}`);
    }
  });

  // Cleanup old tasks every hour
  cron.schedule('0 * * * *', async () => {
    try {
      taskQueue.cleanup(48);
    } catch (err) {
      log.error(`Task cleanup failed: ${err.message}`);
    }
  });

  // Sync metrics to dashboard every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      const metrics = getWorkflowPerformanceMetrics(7);
      await syncMetricsToDashboard(metrics);
    } catch (err) {
      log.error(`Metrics sync failed: ${err.message}`);
    }
  });

  // Daily summary at 20:00
  cron.schedule('0 20 * * *', async () => {
    try {
      const dashboard = getDashboardData();
      await sendCEOEmail({
        subject: 'Process Automation - Daily Summary',
        html: `
          <h2>Process Automation - Daily Summary</h2>
          <p>Date: ${new Date().toLocaleDateString('de-CH')}</p>

          <h3>Task Queue</h3>
          <table border="1" cellpadding="8" cellspacing="0">
            <tr><td><strong>Total Tasks</strong></td><td>${dashboard.queueStats.total}</td></tr>
            <tr><td><strong>Completed</strong></td><td>${dashboard.queueStats.completed}</td></tr>
            <tr><td><strong>Failed</strong></td><td>${dashboard.queueStats.failed}</td></tr>
            <tr><td><strong>Pending</strong></td><td>${dashboard.queueStats.pending}</td></tr>
            <tr><td><strong>In Progress</strong></td><td>${dashboard.queueStats.inProgress}</td></tr>
            ${dashboard.queueStats.avgCompletionMs ? `<tr><td><strong>Avg Completion</strong></td><td>${(dashboard.queueStats.avgCompletionMs / 1000).toFixed(1)}s</td></tr>` : ''}
          </table>

          <h3>Workflow Performance (7 days)</h3>
          <table border="1" cellpadding="8" cellspacing="0">
            <tr><td><strong>Total Executions</strong></td><td>${dashboard.performanceMetrics.totalExecutions}</td></tr>
            <tr><td><strong>Success Rate</strong></td><td>${dashboard.performanceMetrics.successRate}%</td></tr>
          </table>

          <h3>By Workflow</h3>
          <table border="1" cellpadding="8" cellspacing="0">
            <tr><th>Workflow</th><th>Executions</th><th>Success</th><th>Failed</th></tr>
            ${Object.entries(dashboard.performanceMetrics.byWorkflow).map(([id, data]) => `
              <tr>
                <td>${id}</td>
                <td>${data.count}</td>
                <td>${data.success}</td>
                <td>${data.failed}</td>
              </tr>
            `).join('')}
          </table>
        `,
      });
    } catch (err) {
      log.error(`Daily summary failed: ${err.message}`);
    }
  });

  log.info('Process Automation scheduled: queue every 1min, retries every 5min, SLA every 5min, metrics sync every 30min');
}

// --- Exports ---

module.exports = {
  run,
  startSchedule,
  startWorkflow,
  processQueue,
  processNextTask,
  monitorSLAs,
  retryFailedTasks,
  handleStuckTasks,
  getDashboardData,
  loadWorkflows,
  workflows,
  taskQueue,
  // New exports
  triggerWorkflow,
  WORKFLOW_TRIGGERS,
  getWorkflowPerformanceMetrics,
  syncMetricsToDashboard,
  logWorkflowExecution,
  loadWorkflowLog,
};

// Run if called directly
if (require.main === module) {
  run().then(result => {
    log.info(`Process Automation finished: ${JSON.stringify(result)}`);
    process.exit(0);
  }).catch(err => {
    log.error(`Process Automation failed: ${err.message}`);
    process.exit(1);
  });
}
