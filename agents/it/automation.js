/**
 * Agent 40 — Automation Agent
 *
 * Master workflow orchestrator that manages workflow templates,
 * handles errors with retry logic, monitors performance,
 * suggests automation improvements, and generates workflow documentation.
 *
 * Schedule: Workflow monitoring every 5 min, performance review daily at 05:00,
 *           automation suggestions weekly on Fridays at 16:00.
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('it-automation');

// ── Constants ────────────────────────────────────────────────────────────────

const WORKFLOWS_DIR = path.join(__dirname, 'workflows');
const CRON_SCHEDULES_PATH = path.join(__dirname, 'cron-schedules.json');

const TABLES = {
  WORKFLOW_RUNS: 'WorkflowRuns',
  WORKFLOW_ERRORS: 'WorkflowErrors',
  AUTOMATION_SUGGESTIONS: 'AutomationSuggestions',
  AGENT_METRICS: 'AgentMetrics',
  CRON_JOBS: 'CronJobs',
};

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 2000;

const WORKFLOW_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying',
};

// ── Workflow Registry ────────────────────────────────────────────────────────

const activeWorkflows = new Map();
const workflowMetrics = new Map();

/**
 * Load workflow template from JSON file with version support.
 */
function loadWorkflowTemplate(templateName, version = null) {
  try {
    let templatePath;

    if (version && version !== 'latest') {
      // Load specific version
      templatePath = path.join(WORKFLOWS_DIR, `${templateName}-v${version}.json`);
    } else {
      // Load latest version
      templatePath = path.join(WORKFLOWS_DIR, `${templateName}.json`);
    }

    const raw = fs.readFileSync(templatePath, 'utf-8');
    const template = JSON.parse(raw);

    // Add version metadata if not present
    if (!template.version) {
      template.version = version || 'latest';
    }

    return template;
  } catch (error) {
    logger.error(`Failed to load workflow template "${templateName}" v${version || 'latest'}: ${error.message}`);
    return null;
  }
}

/**
 * Load all workflow templates.
 */
function loadAllWorkflowTemplates() {
  try {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));
    const templates = {};
    for (const file of files) {
      const name = path.basename(file, '.json');
      templates[name] = loadWorkflowTemplate(name);
    }
    return templates;
  } catch (error) {
    logger.error(`Failed to load workflow templates: ${error.message}`);
    return {};
  }
}

// ── Workflow Execution Engine ────────────────────────────────────────────────

/**
 * Execute a workflow with full error handling, retries, and metrics tracking.
 * Supports parallel execution, conditional branching, and workflow versioning.
 */
async function executeWorkflow(workflowName, trigger, context = {}, version = null) {
  const workflowId = `${workflowName}-${Date.now()}`;
  const startTime = Date.now();

  const run = {
    id: workflowId,
    workflow: workflowName,
    version: version || 'latest',
    trigger,
    status: WORKFLOW_STATUS.RUNNING,
    startedAt: new Date().toISOString(),
    steps: [],
    retries: 0,
    context,
  };

  activeWorkflows.set(workflowId, run);
  logger.info(`Starting workflow: ${workflowName} v${run.version} (${workflowId})`);

  try {
    const template = loadWorkflowTemplate(workflowName, version);
    if (!template) {
      throw new Error(`Workflow template "${workflowName}" v${version || 'latest'} not found`);
    }

    // Execute workflow steps (supports both sequential and parallel)
    await executeWorkflowSteps(template.steps, run);

    run.status = WORKFLOW_STATUS.COMPLETED;
    run.completedAt = new Date().toISOString();
    run.durationMs = Date.now() - startTime;

    logger.info(`Workflow completed: ${workflowName} (${run.durationMs}ms)`);
  } catch (error) {
    run.status = WORKFLOW_STATUS.FAILED;
    run.error = error.message;
    run.completedAt = new Date().toISOString();
    run.durationMs = Date.now() - startTime;

    logger.error(`Workflow failed: ${workflowName} - ${error.message}`);

    // Attempt retry if configured
    const template = loadWorkflowTemplate(workflowName, version);
    if (template?.retry && run.retries < (template.maxRetries || MAX_RETRIES)) {
      await retryWorkflow(run, template);
    } else {
      await handleWorkflowFailure(run);
    }
  }

  // Store run record
  await storeWorkflowRun(run);

  // Update metrics
  updateWorkflowMetrics(workflowName, run);

  activeWorkflows.delete(workflowId);
  return run;
}

/**
 * Execute workflow steps with support for parallel execution.
 */
async function executeWorkflowSteps(steps, workflowRun) {
  let i = 0;
  while (i < steps.length) {
    const step = steps[i];

    // Check if this step and following steps can run in parallel
    if (step.parallel) {
      const parallelSteps = [step];
      let j = i + 1;
      while (j < steps.length && steps[j].parallel) {
        parallelSteps.push(steps[j]);
        j++;
      }

      logger.info(`  Executing ${parallelSteps.length} steps in parallel`);
      const results = await Promise.all(
        parallelSteps.map(s => executeWorkflowStep(s, workflowRun))
      );

      results.forEach(result => workflowRun.steps.push(result));

      // Check for failures
      const failures = results.filter(r => r.status === 'failed');
      if (failures.length > 0 && failures.some(f => f.required !== false)) {
        throw new Error(`Parallel step(s) failed: ${failures.map(f => f.name).join(', ')}`);
      }

      i = j;
    } else {
      // Sequential execution
      const stepResult = await executeWorkflowStep(step, workflowRun);
      workflowRun.steps.push(stepResult);

      // Handle conditional branching
      if (step.type === 'condition' && stepResult.branch) {
        // Update context with condition result
        workflowRun.context._lastCondition = stepResult.branch;

        // If there's a branch path, follow it
        if (step.branches && step.branches[stepResult.branch]) {
          const branchSteps = step.branches[stepResult.branch];
          await executeWorkflowSteps(branchSteps, workflowRun);
        }
      }

      if (stepResult.status === 'failed' && step.required !== false) {
        throw new Error(`Required step "${step.name}" failed: ${stepResult.error}`);
      }

      i++;
    }
  }
}

/**
 * Execute a single step within a workflow.
 */
async function executeWorkflowStep(step, workflowRun) {
  const stepStart = Date.now();
  const result = {
    name: step.name,
    type: step.type,
    startedAt: new Date().toISOString(),
    status: 'running',
    required: step.required !== false,
  };

  try {
    switch (step.type) {
      case 'fetch_records':
        result.data = await getRecords(step.table, step.filter || '');
        result.recordCount = result.data.length;
        // Store in context for subsequent steps
        if (step.contextKey) {
          workflowRun.context[step.contextKey] = result.data;
        }
        break;

      case 'create_record':
        result.data = await createRecord(step.table, resolveFields(step.fields, workflowRun.context));
        if (step.contextKey) {
          workflowRun.context[step.contextKey] = result.data;
        }
        break;

      case 'update_record':
        result.data = await updateRecord(step.table, step.recordId || workflowRun.context.recordId, resolveFields(step.fields, workflowRun.context));
        break;

      case 'ai_classify':
        result.data = await generateJSON(resolveTemplate(step.prompt, workflowRun.context), {
          model: step.model || config.models.fast,
          maxTokens: step.maxTokens || 500,
        });
        if (step.contextKey) {
          workflowRun.context[step.contextKey] = result.data;
        }
        break;

      case 'ai_generate':
        result.data = await generateText(resolveTemplate(step.prompt, workflowRun.context), {
          model: step.model || config.models.standard,
          maxTokens: step.maxTokens || 1500,
        });
        if (step.contextKey) {
          workflowRun.context[step.contextKey] = result.data;
        }
        break;

      case 'condition':
        result.data = evaluateCondition(step.condition, workflowRun);
        result.branch = result.data ? 'true' : 'false';
        // Support custom branch names if defined
        if (step.trueBranch && result.data) result.branch = step.trueBranch;
        if (step.falseBranch && !result.data) result.branch = step.falseBranch;
        break;

      case 'webhook':
        result.data = await callWebhook(step.url, step.method || 'POST', resolveFields(step.payload, workflowRun.context), step.headers);
        if (step.contextKey) {
          workflowRun.context[step.contextKey] = result.data;
        }
        break;

      case 'notify':
        await sendCEOEmail({
          subject: resolveTemplate(step.subject, workflowRun.context),
          html: resolveTemplate(step.html, workflowRun.context),
        });
        result.data = { notified: true };
        break;

      case 'delay':
        await new Promise(resolve => setTimeout(resolve, step.delayMs || 1000));
        result.data = { delayed: step.delayMs };
        break;

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }

    result.status = 'completed';
    result.durationMs = Date.now() - stepStart;
    logger.info(`  Step "${step.name}" completed (${result.durationMs}ms)`);
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    result.durationMs = Date.now() - stepStart;
    logger.error(`  Step "${step.name}" failed: ${error.message}`);
  }

  return result;
}

/**
 * Call a webhook as part of a workflow step.
 */
async function callWebhook(url, method, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? require('https') : require('http');
    const payloadString = JSON.stringify(payload);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadString),
        ...headers,
      },
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(data),
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);
    req.write(payloadString);
    req.end();
  });
}

/**
 * Resolve template variables in a string using context.
 */
function resolveTemplate(template, context) {
  if (!template || typeof template !== 'string') return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return context[key] !== undefined ? context[key] : match;
  });
}

/**
 * Resolve field values that may reference context variables.
 */
function resolveFields(fields, context) {
  if (!fields) return {};
  const resolved = {};
  for (const [key, value] of Object.entries(fields)) {
    resolved[key] = typeof value === 'string' ? resolveTemplate(value, context) : value;
  }
  return resolved;
}

/**
 * Evaluate a simple condition expression.
 */
function evaluateCondition(condition, workflowRun) {
  if (!condition) return true;

  const { field, operator, value } = condition;
  const actualValue = workflowRun.context[field];

  switch (operator) {
    case 'equals': return actualValue === value;
    case 'not_equals': return actualValue !== value;
    case 'contains': return String(actualValue).includes(value);
    case 'greater_than': return Number(actualValue) > Number(value);
    case 'less_than': return Number(actualValue) < Number(value);
    case 'exists': return actualValue !== undefined && actualValue !== null;
    default: return true;
  }
}

// ── Retry Logic ──────────────────────────────────────────────────────────────

/**
 * Retry a failed workflow with exponential backoff.
 */
async function retryWorkflow(failedRun, template) {
  failedRun.retries++;
  const delay = RETRY_DELAY_BASE_MS * Math.pow(2, failedRun.retries - 1);

  logger.info(
    `Retrying workflow ${failedRun.workflow} (attempt ${failedRun.retries}/${template.maxRetries || MAX_RETRIES}) ` +
    `in ${delay}ms`
  );

  failedRun.status = WORKFLOW_STATUS.RETRYING;

  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    // Re-execute from the failed step
    const workflowTemplate = loadWorkflowTemplate(failedRun.workflow);
    const completedStepNames = failedRun.steps
      .filter(s => s.status === 'completed')
      .map(s => s.name);

    const remainingSteps = workflowTemplate.steps.filter(
      s => !completedStepNames.includes(s.name)
    );

    for (const step of remainingSteps) {
      const stepResult = await executeWorkflowStep(step, failedRun);
      failedRun.steps.push(stepResult);

      if (stepResult.status === 'failed' && step.required !== false) {
        throw new Error(`Retry step "${step.name}" failed: ${stepResult.error}`);
      }
    }

    failedRun.status = WORKFLOW_STATUS.COMPLETED;
    failedRun.completedAt = new Date().toISOString();
    logger.info(`Workflow retry succeeded: ${failedRun.workflow}`);
  } catch (error) {
    if (failedRun.retries < (template.maxRetries || MAX_RETRIES)) {
      await retryWorkflow(failedRun, template);
    } else {
      failedRun.status = WORKFLOW_STATUS.FAILED;
      failedRun.error = `Max retries (${template.maxRetries || MAX_RETRIES}) exceeded: ${error.message}`;
      failedRun.completedAt = new Date().toISOString();
      await handleWorkflowFailure(failedRun);
    }
  }
}

/**
 * Handle a workflow failure after all retries exhausted.
 */
async function handleWorkflowFailure(run) {
  logger.error(`Workflow permanently failed: ${run.workflow} after ${run.retries} retries`);

  try {
    await createRecord(TABLES.WORKFLOW_ERRORS, {
      WorkflowId: run.id,
      WorkflowName: run.workflow,
      Trigger: run.trigger,
      Error: run.error,
      Retries: run.retries,
      FailedSteps: JSON.stringify(run.steps.filter(s => s.status === 'failed')),
      OccurredAt: new Date().toISOString(),
    });

    // Alert on critical workflow failures
    const failedStepsList = run.steps
      .filter(s => s.status === 'failed')
      .map(s => `<li><strong>${s.name}</strong>: ${s.error}</li>`)
      .join('');

    await sendCEOEmail({
      subject: `WORKFLOW FAILED: ${run.workflow} (${run.retries} retries)`,
      html: `
        <h2 style="color: #e74c3c;">Workflow Failure Alert</h2>
        <p><strong>Workflow:</strong> ${run.workflow}</p>
        <p><strong>Trigger:</strong> ${run.trigger}</p>
        <p><strong>Error:</strong> ${run.error}</p>
        <p><strong>Retries:</strong> ${run.retries}</p>
        <p><strong>Duration:</strong> ${run.durationMs}ms</p>
        <h3>Failed Steps:</h3>
        <ul>${failedStepsList}</ul>
      `,
    });
  } catch (error) {
    logger.error(`Failed to handle workflow failure: ${error.message}`);
  }
}

/**
 * Store workflow run record in Airtable.
 */
async function storeWorkflowRun(run) {
  try {
    await createRecord(TABLES.WORKFLOW_RUNS, {
      WorkflowId: run.id,
      WorkflowName: run.workflow,
      Trigger: run.trigger,
      Status: run.status,
      StartedAt: run.startedAt,
      CompletedAt: run.completedAt || null,
      DurationMs: run.durationMs || 0,
      Retries: run.retries,
      StepsCompleted: run.steps.filter(s => s.status === 'completed').length,
      StepsFailed: run.steps.filter(s => s.status === 'failed').length,
      Error: run.error || null,
    });
  } catch (error) {
    logger.error(`Failed to store workflow run: ${error.message}`);
  }
}

// ── Workflow Metrics ─────────────────────────────────────────────────────────

/**
 * Update in-memory metrics for a workflow.
 */
function updateWorkflowMetrics(workflowName, run) {
  if (!workflowMetrics.has(workflowName)) {
    workflowMetrics.set(workflowName, {
      totalRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
      lastRun: null,
      retryRate: 0,
      totalRetries: 0,
    });
  }

  const metrics = workflowMetrics.get(workflowName);
  metrics.totalRuns++;
  metrics.totalRetries += run.retries;

  if (run.status === WORKFLOW_STATUS.COMPLETED) {
    metrics.completedRuns++;
  } else {
    metrics.failedRuns++;
  }

  if (run.durationMs) {
    metrics.totalDurationMs += run.durationMs;
    metrics.avgDurationMs = Math.round(metrics.totalDurationMs / metrics.totalRuns);
  }

  metrics.lastRun = run.completedAt || run.startedAt;
  metrics.retryRate = metrics.totalRuns > 0
    ? (metrics.totalRetries / metrics.totalRuns).toFixed(2)
    : 0;
}

// ── Performance Optimization ─────────────────────────────────────────────────

/**
 * Analyze workflow performance and identify slow workflows.
 */
async function analyzeWorkflowPerformance() {
  logger.info('Analyzing workflow performance...');

  try {
    // Get recent workflow runs
    const recentRuns = await getRecords(TABLES.WORKFLOW_RUNS, '{StartedAt} >= "' +
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) + '"'
    );

    if (recentRuns.length === 0) {
      logger.info('No recent workflow runs to analyze');
      return null;
    }

    // Aggregate by workflow name
    const workflowStats = {};
    for (const run of recentRuns) {
      const name = run.WorkflowName;
      if (!workflowStats[name]) {
        workflowStats[name] = {
          name,
          runs: 0,
          completed: 0,
          failed: 0,
          totalDuration: 0,
          maxDuration: 0,
          totalRetries: 0,
        };
      }

      const stats = workflowStats[name];
      stats.runs++;
      if (run.Status === WORKFLOW_STATUS.COMPLETED) stats.completed++;
      if (run.Status === WORKFLOW_STATUS.FAILED) stats.failed++;
      stats.totalDuration += run.DurationMs || 0;
      stats.maxDuration = Math.max(stats.maxDuration, run.DurationMs || 0);
      stats.totalRetries += run.Retries || 0;
    }

    // Calculate averages and identify issues
    const analysis = [];
    for (const stats of Object.values(workflowStats)) {
      const avgDuration = stats.runs > 0 ? Math.round(stats.totalDuration / stats.runs) : 0;
      const failureRate = stats.runs > 0 ? ((stats.failed / stats.runs) * 100).toFixed(1) : 0;
      const retryRate = stats.runs > 0 ? ((stats.totalRetries / stats.runs) * 100).toFixed(1) : 0;

      const issues = [];
      if (avgDuration > 30000) issues.push('Slow average execution time');
      if (parseFloat(failureRate) > 10) issues.push('High failure rate');
      if (parseFloat(retryRate) > 20) issues.push('High retry rate');
      if (stats.maxDuration > 120000) issues.push('Extremely long max execution');

      analysis.push({
        ...stats,
        avgDuration,
        failureRate: parseFloat(failureRate),
        retryRate: parseFloat(retryRate),
        issues,
        needsOptimization: issues.length > 0,
      });
    }

    // Sort by issues severity
    analysis.sort((a, b) => b.issues.length - a.issues.length);

    const problematic = analysis.filter(a => a.needsOptimization);
    if (problematic.length > 0) {
      logger.warn(`${problematic.length} workflow(s) need optimization`);
      await sendPerformanceReport(analysis);
    }

    logger.info(`Analyzed ${Object.keys(workflowStats).length} workflows from ${recentRuns.length} runs`);
    return analysis;
  } catch (error) {
    logger.error(`Performance analysis failed: ${error.message}`);
    throw error;
  }
}

/**
 * Send workflow performance report.
 */
async function sendPerformanceReport(analysis) {
  const rows = analysis.map(w => {
    const statusColor = w.needsOptimization ? '#e74c3c' : '#27ae60';
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${w.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${w.runs}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${w.failureRate > 10 ? '#e74c3c' : '#333'};">
          ${w.failureRate}%
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${(w.avgDuration / 1000).toFixed(1)}s</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${w.retryRate}%</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${statusColor};">
          ${w.issues.length > 0 ? w.issues.join(', ') : 'OK'}
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <h2>Workflow Performance Report</h2>
    <p>Analysis period: Last 7 days</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">Workflow</th>
        <th style="padding: 8px; text-align: left;">Runs</th>
        <th style="padding: 8px; text-align: left;">Failure Rate</th>
        <th style="padding: 8px; text-align: left;">Avg Duration</th>
        <th style="padding: 8px; text-align: left;">Retry Rate</th>
        <th style="padding: 8px; text-align: left;">Issues</th>
      </tr>
      ${rows}
    </table>
  `;

  try {
    await sendCEOEmail({
      subject: `Workflow Performance: ${analysis.filter(a => a.needsOptimization).length} need attention`,
      html,
    });
  } catch (error) {
    logger.error(`Failed to send performance report: ${error.message}`);
  }
}

// ── Automation Suggestions ───────────────────────────────────────────────────

/**
 * Analyze patterns and suggest new automations.
 */
async function generateAutomationSuggestions() {
  logger.info('Generating automation suggestions...');

  try {
    // Gather data about current workflows and agent activity
    const workflowRuns = await getRecords(TABLES.WORKFLOW_RUNS, '');
    const agentMetrics = await getRecords(TABLES.AGENT_METRICS, '');
    const errors = await getRecords(TABLES.WORKFLOW_ERRORS, '');

    const prompt = `You are an automation engineer analyzing the Werkpilot AI agent system.
Based on the following operational data, suggest 3-5 new automation opportunities.

Current Workflows (${workflowRuns.length} recent runs):
${JSON.stringify(workflowRuns.slice(0, 20).map(r => ({
  name: r.WorkflowName,
  status: r.Status,
  duration: r.DurationMs,
  retries: r.Retries,
})), null, 2)}

Agent Metrics (${agentMetrics.length} records):
${JSON.stringify(agentMetrics.slice(0, 20).map(m => ({
  agent: m.AgentName,
  duration: m.Duration,
  status: m.Status,
  errors: m.Errors,
})), null, 2)}

Recent Errors (${errors.length}):
${JSON.stringify(errors.slice(0, 10).map(e => ({
  workflow: e.WorkflowName,
  error: e.Error,
  retries: e.Retries,
})), null, 2)}

For each suggestion provide:
1. Name of the automation
2. Description of what it would do
3. Trigger (what starts it)
4. Expected impact (time saved, error reduction, etc.)
5. Complexity (low/medium/high)
6. Priority (1-5, 1 being highest)

Return as JSON array: [{ "name": "...", "description": "...", "trigger": "...", "impact": "...", "complexity": "...", "priority": ... }]`;

    const suggestions = await generateJSON(prompt, {
      model: config.models.standard,
      maxTokens: 2000,
    });

    // Store suggestions
    for (const suggestion of suggestions) {
      try {
        await createRecord(TABLES.AUTOMATION_SUGGESTIONS, {
          Name: suggestion.name,
          Description: suggestion.description,
          Trigger: suggestion.trigger,
          Impact: suggestion.impact,
          Complexity: suggestion.complexity,
          Priority: suggestion.priority,
          Status: 'Proposed',
          GeneratedAt: new Date().toISOString(),
        });
      } catch (error) {
        logger.error(`Failed to store suggestion: ${error.message}`);
      }
    }

    logger.info(`Generated ${suggestions.length} automation suggestions`);
    return suggestions;
  } catch (error) {
    logger.error(`Automation suggestions failed: ${error.message}`);
    throw error;
  }
}

// ── Cron Management ──────────────────────────────────────────────────────────

/**
 * Load and validate all cron schedules.
 */
function loadCronSchedules() {
  try {
    const raw = fs.readFileSync(CRON_SCHEDULES_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    logger.error(`Failed to load cron schedules: ${error.message}`);
    return null;
  }
}

/**
 * Validate that a cron expression is syntactically valid.
 */
function validateCronExpression(expression) {
  return cron.validate(expression);
}

/**
 * Audit all cron schedules for conflicts and coverage gaps.
 */
async function auditCronSchedules() {
  logger.info('Auditing cron schedules...');
  const schedules = loadCronSchedules();
  if (!schedules) return [];

  const issues = [];

  // Check for scheduling conflicts (too many agents at same time)
  const timeSlots = {};
  for (const job of schedules.jobs) {
    if (!validateCronExpression(job.schedule)) {
      issues.push({
        job: job.name,
        issue: `Invalid cron expression: ${job.schedule}`,
        severity: 'high',
      });
      continue;
    }

    // Simple hour-based conflict check
    const hourMatch = job.schedule.match(/(\d+)\s+(\d+)/);
    if (hourMatch) {
      const slot = `${hourMatch[2]}:${hourMatch[1]}`;
      if (!timeSlots[slot]) timeSlots[slot] = [];
      timeSlots[slot].push(job.name);
    }
  }

  // Flag timeslots with 3+ concurrent jobs
  for (const [slot, jobs] of Object.entries(timeSlots)) {
    if (jobs.length >= 3) {
      issues.push({
        timeSlot: slot,
        jobs: jobs,
        issue: `${jobs.length} jobs scheduled at the same time`,
        severity: 'medium',
      });
    }
  }

  logger.info(`Cron audit: ${issues.length} issues found`);
  return issues;
}

// ── Workflow Documentation Generator ─────────────────────────────────────────

/**
 * Generate comprehensive workflow documentation.
 */
async function generateWorkflowDocs() {
  logger.info('Generating workflow documentation...');

  try {
    const templates = loadAllWorkflowTemplates();
    const schedules = loadCronSchedules();

    const prompt = `You are a technical writer documenting the Werkpilot automation system.
Generate clear, comprehensive workflow documentation in Markdown.

Workflow Templates:
${JSON.stringify(templates, null, 2)}

Cron Schedules:
${JSON.stringify(schedules, null, 2)}

Include:
1. Overview of the automation system
2. Each workflow with: description, trigger, steps, error handling, retry policy
3. Cron schedule table showing all scheduled tasks
4. Data flow diagrams described in text
5. Troubleshooting guide for common failures

Format as clean Markdown.`;

    const docs = await generateText(prompt, {
      model: config.models.standard,
      maxTokens: 4000,
    });

    const docsPath = path.join(WORKFLOWS_DIR, 'workflow-docs.md');
    fs.writeFileSync(docsPath, docs, 'utf-8');

    logger.info('Workflow documentation generated');
    return docsPath;
  } catch (error) {
    logger.error(`Workflow docs generation failed: ${error.message}`);
    throw error;
  }
}

// ── Workflow History & Replay ────────────────────────────────────────────────

/**
 * Get workflow execution history.
 */
async function getWorkflowHistory(workflowName, limit = 50) {
  try {
    const runs = await getRecords(
      TABLES.WORKFLOW_RUNS,
      workflowName ? `{WorkflowName} = "${workflowName}"` : '',
      limit
    );

    return runs.sort((a, b) => new Date(b.StartedAt) - new Date(a.StartedAt));
  } catch (error) {
    logger.error(`Failed to get workflow history: ${error.message}`);
    return [];
  }
}

/**
 * Replay a previous workflow execution with the same context.
 */
async function replayWorkflow(workflowRunId) {
  logger.info(`Replaying workflow run: ${workflowRunId}`);

  try {
    // Get original run details
    const originalRuns = await getRecords(
      TABLES.WORKFLOW_RUNS,
      `{WorkflowId} = "${workflowRunId}"`
    );

    if (originalRuns.length === 0) {
      throw new Error(`Workflow run ${workflowRunId} not found`);
    }

    const originalRun = originalRuns[0];

    // Extract original context (if stored in a custom field)
    let context = {};
    try {
      context = JSON.parse(originalRun.ContextJSON || '{}');
    } catch {
      logger.warn('Could not parse original context, using empty context');
    }

    // Re-execute with same trigger and context
    const replayResult = await executeWorkflow(
      originalRun.WorkflowName,
      `replay:${workflowRunId}`,
      context
    );

    logger.info(`Workflow replay complete: ${replayResult.status}`);
    return replayResult;
  } catch (error) {
    logger.error(`Workflow replay failed: ${error.message}`);
    throw error;
  }
}

/**
 * Create a new version of a workflow template.
 */
function createWorkflowVersion(workflowName) {
  try {
    const currentTemplate = loadWorkflowTemplate(workflowName);
    if (!currentTemplate) {
      throw new Error(`Workflow ${workflowName} not found`);
    }

    // Find existing versions
    const files = fs.readdirSync(WORKFLOWS_DIR);
    const versions = files
      .filter(f => f.startsWith(`${workflowName}-v`) && f.endsWith('.json'))
      .map(f => {
        const match = f.match(/-v(\d+)\.json$/);
        return match ? parseInt(match[1]) : 0;
      });

    const nextVersion = versions.length > 0 ? Math.max(...versions) + 1 : 1;
    const versionedPath = path.join(WORKFLOWS_DIR, `${workflowName}-v${nextVersion}.json`);

    // Add version metadata
    currentTemplate.version = nextVersion;
    currentTemplate.createdAt = new Date().toISOString();

    // Save versioned copy
    fs.writeFileSync(versionedPath, JSON.stringify(currentTemplate, null, 2), 'utf-8');

    logger.info(`Created workflow version: ${workflowName} v${nextVersion}`);
    return { version: nextVersion, path: versionedPath };
  } catch (error) {
    logger.error(`Failed to create workflow version: ${error.message}`);
    throw error;
  }
}

/**
 * List all versions of a workflow.
 */
function listWorkflowVersions(workflowName) {
  try {
    const files = fs.readdirSync(WORKFLOWS_DIR);
    const versions = [];

    // Find all versioned files
    for (const file of files) {
      if (file.startsWith(`${workflowName}-v`) && file.endsWith('.json')) {
        const match = file.match(/-v(\d+)\.json$/);
        if (match) {
          const versionNum = parseInt(match[1]);
          const template = loadWorkflowTemplate(workflowName, versionNum);
          versions.push({
            version: versionNum,
            file,
            createdAt: template?.createdAt || null,
            steps: template?.steps?.length || 0,
          });
        }
      }
    }

    // Add current/latest version
    const current = loadWorkflowTemplate(workflowName);
    if (current) {
      versions.push({
        version: 'latest',
        file: `${workflowName}.json`,
        createdAt: current.createdAt || null,
        steps: current.steps?.length || 0,
        isCurrent: true,
      });
    }

    return versions.sort((a, b) => {
      if (a.version === 'latest') return -1;
      if (b.version === 'latest') return 1;
      return b.version - a.version;
    });
  } catch (error) {
    logger.error(`Failed to list workflow versions: ${error.message}`);
    return [];
  }
}

// ── Webhook Listener ─────────────────────────────────────────────────────────

/**
 * Register a webhook endpoint to trigger workflows.
 * This creates an HTTP endpoint that listens for incoming webhooks.
 */
function registerWebhookTrigger(path, workflowName, port = 3100) {
  const http = require('http');
  const url = require('url');

  if (!registerWebhookTrigger.server) {
    // Create HTTP server only once
    registerWebhookTrigger.server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url, true);
      const webhookPath = parsedUrl.pathname;

      // Find matching webhook registration
      const registration = registerWebhookTrigger.registrations?.find(r => r.path === webhookPath);

      if (!registration) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Webhook not found' }));
        return;
      }

      // Parse request body
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');

          logger.info(`Webhook triggered: ${webhookPath} -> ${registration.workflowName}`);

          // Execute workflow with webhook payload as context
          const result = await executeWorkflow(
            registration.workflowName,
            `webhook:${webhookPath}`,
            payload
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            workflowId: result.id,
            status: result.status,
          }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    });

    registerWebhookTrigger.registrations = [];
    registerWebhookTrigger.server.listen(port, () => {
      logger.info(`Webhook server listening on port ${port}`);
    });
  }

  // Add webhook registration
  registerWebhookTrigger.registrations.push({ path, workflowName });
  logger.info(`Registered webhook: ${path} -> ${workflowName}`);
}

// ── Trigger Handlers ─────────────────────────────────────────────────────────

/**
 * Handle a new Airtable record trigger.
 */
async function handleRecordTrigger(table, recordId, fields) {
  logger.info(`Record trigger: new record in ${table} (${recordId})`);
  return executeWorkflow('record-trigger', 'airtable_new_record', {
    table,
    recordId,
    ...fields,
  });
}

/**
 * Handle an incoming email trigger.
 */
async function handleEmailTrigger(email) {
  logger.info(`Email trigger: from ${email.from}, subject: "${email.subject}"`);
  return executeWorkflow('email-routing', 'email_received', {
    from: email.from,
    subject: email.subject,
    body: email.body,
    receivedAt: email.receivedAt || new Date().toISOString(),
  });
}

/**
 * Handle a scheduled task trigger.
 */
async function handleScheduledTrigger(taskName) {
  logger.info(`Scheduled trigger: ${taskName}`);
  return executeWorkflow('scheduled-tasks', 'cron_schedule', {
    taskName,
    triggeredAt: new Date().toISOString(),
  });
}

// ── Main Runs ────────────────────────────────────────────────────────────────

/**
 * Monitor active workflows and check for stuck processes.
 */
async function runWorkflowMonitor() {
  logger.info('=== Workflow Monitor Check ===');

  try {
    // Check for stuck workflows (running for more than 10 minutes)
    const stuckThreshold = 10 * 60 * 1000;
    const now = Date.now();

    for (const [id, workflow] of activeWorkflows.entries()) {
      const runningTime = now - new Date(workflow.startedAt).getTime();
      if (runningTime > stuckThreshold) {
        logger.warn(`Stuck workflow detected: ${workflow.workflow} (${id}) running for ${Math.round(runningTime / 1000)}s`);

        await createRecord(TABLES.WORKFLOW_ERRORS, {
          WorkflowId: id,
          WorkflowName: workflow.workflow,
          Error: `Workflow stuck for ${Math.round(runningTime / 1000)}s`,
          OccurredAt: new Date().toISOString(),
        });
      }
    }

    // Run cron schedule audit
    await auditCronSchedules();
  } catch (error) {
    logger.error(`Workflow monitor failed: ${error.message}`);
  }
}

/**
 * Daily performance review.
 */
async function runDailyPerformanceReview() {
  logger.info('=== Daily Workflow Performance Review ===');
  const startTime = Date.now();

  try {
    await analyzeWorkflowPerformance();
  } catch (error) {
    logger.error(`Daily performance review failed: ${error.message}`, { stack: error.stack });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Performance review completed in ${duration}s ===`);
}

/**
 * Weekly automation suggestions and documentation.
 */
async function runWeeklySuggestions() {
  logger.info('=== Weekly Automation Analysis ===');
  const startTime = Date.now();

  try {
    await generateAutomationSuggestions();
    await generateWorkflowDocs();
  } catch (error) {
    logger.error(`Weekly suggestions failed: ${error.message}`, { stack: error.stack });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Weekly analysis completed in ${duration}s ===`);
}

// ── Cron Scheduling ──────────────────────────────────────────────────────────

// Workflow monitoring every 5 minutes
cron.schedule('*/5 * * * *', () => {
  runWorkflowMonitor().catch(err => logger.error(`Cron monitor error: ${err.message}`));
});

// Daily performance review at 05:00
cron.schedule('0 5 * * *', () => {
  runDailyPerformanceReview().catch(err => logger.error(`Cron performance error: ${err.message}`));
});

// Weekly automation suggestions on Fridays at 16:00
cron.schedule('0 16 * * 5', () => {
  runWeeklySuggestions().catch(err => logger.error(`Cron suggestions error: ${err.message}`));
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  executeWorkflow,
  handleRecordTrigger,
  handleEmailTrigger,
  handleScheduledTrigger,
  runWorkflowMonitor,
  runDailyPerformanceReview,
  runWeeklySuggestions,
  analyzeWorkflowPerformance,
  generateAutomationSuggestions,
  generateWorkflowDocs,
  loadCronSchedules,
  auditCronSchedules,
  getWorkflowHistory,
  replayWorkflow,
  createWorkflowVersion,
  listWorkflowVersions,
  registerWebhookTrigger,
  loadWorkflowTemplate,
  loadAllWorkflowTemplates,
};

// Run immediately if executed directly
if (require.main === module) {
  runWorkflowMonitor()
    .then(() => logger.info('Manual monitor run completed'))
    .catch(err => logger.error(`Manual run failed: ${err.message}`));
}
