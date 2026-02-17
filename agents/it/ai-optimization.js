/**
 * Agent 42 — AI Optimization Agent
 *
 * Optimizes AI usage across the Werkpilot agent system through prompt A/B testing,
 * model selection recommendations, cost optimization, quality benchmarking,
 * prompt library management, token optimization, and monthly spend reports.
 *
 * Schedule: Daily cost tracking at 23:00, weekly optimization review Monday 04:00,
 *           monthly AI spend report 1st at 03:00.
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('it-ai-optimization');

// ── Constants ────────────────────────────────────────────────────────────────

const PROMPTS_DIR = path.join(__dirname, 'prompts');
const BENCHMARKS_DIR = path.join(__dirname, 'benchmarks');
const MODEL_RECS_PATH = path.join(__dirname, 'model-recommendations.json');

const TABLES = {
  AGENT_METRICS: 'AgentMetrics',
  PROMPT_VERSIONS: 'PromptVersions',
  AB_TESTS: 'ABTests',
  AI_BENCHMARKS: 'AIBenchmarks',
  COST_TRACKING: 'CostTracking',
  OPTIMIZATION_LOG: 'OptimizationLog',
};

// Model pricing per 1M tokens (CHF, approximate)
const MODEL_PRICING = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00, label: 'Haiku' },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00, label: 'Sonnet' },
  'claude-opus-4-6': { input: 15.00, output: 75.00, label: 'Opus' },
};

const MODEL_TIERS = {
  fast: config.models.fast,
  standard: config.models.standard,
  powerful: config.models.powerful,
};

// Task type to recommended model mapping
const TASK_MODEL_MAP = {
  classification: 'fast',
  short_response: 'fast',
  qa: 'fast',
  data_extraction: 'fast',
  content_generation: 'standard',
  email_writing: 'standard',
  analysis: 'standard',
  translation: 'standard',
  summarization: 'standard',
  complex_strategy: 'powerful',
  multi_step_reasoning: 'powerful',
  creative_writing: 'powerful',
  code_generation: 'powerful',
  financial_analysis: 'powerful',
};

// ── Prompt A/B Testing ───────────────────────────────────────────────────────

/**
 * Run an A/B test comparing two prompt variations for an agent task.
 */
async function runPromptABTest(testConfig) {
  const {
    name,
    agentName,
    taskType,
    promptA,
    promptB,
    testCases,
    evaluationCriteria,
    model,
  } = testConfig;

  logger.info(`Starting A/B test: ${name} for ${agentName}`);
  const testId = `ab-${Date.now()}`;

  const results = {
    testId,
    name,
    agentName,
    taskType,
    startedAt: new Date().toISOString(),
    promptA: { scores: [], avgScore: 0, avgTokens: 0, avgLatencyMs: 0 },
    promptB: { scores: [], avgScore: 0, avgTokens: 0, avgLatencyMs: 0 },
    winner: null,
  };

  try {
    for (const testCase of testCases) {
      // Test Prompt A
      const resultA = await runPromptTest(promptA, testCase, model, evaluationCriteria);
      results.promptA.scores.push(resultA);

      // Test Prompt B
      const resultB = await runPromptTest(promptB, testCase, model, evaluationCriteria);
      results.promptB.scores.push(resultB);
    }

    // Calculate averages
    results.promptA.avgScore = average(results.promptA.scores.map(s => s.qualityScore));
    results.promptA.avgTokens = average(results.promptA.scores.map(s => s.totalTokens));
    results.promptA.avgLatencyMs = average(results.promptA.scores.map(s => s.latencyMs));

    results.promptB.avgScore = average(results.promptB.scores.map(s => s.qualityScore));
    results.promptB.avgTokens = average(results.promptB.scores.map(s => s.totalTokens));
    results.promptB.avgLatencyMs = average(results.promptB.scores.map(s => s.latencyMs));

    // Determine winner
    const scoreDiff = results.promptB.avgScore - results.promptA.avgScore;
    const tokenSavings = results.promptA.avgTokens - results.promptB.avgTokens;

    if (scoreDiff > 5) {
      results.winner = 'B';
      results.reason = `Prompt B scored ${scoreDiff.toFixed(1)} points higher`;
    } else if (scoreDiff < -5) {
      results.winner = 'A';
      results.reason = `Prompt A scored ${Math.abs(scoreDiff).toFixed(1)} points higher`;
    } else if (tokenSavings > 100) {
      results.winner = 'B';
      results.reason = `Similar quality but Prompt B uses ${tokenSavings} fewer tokens`;
    } else if (tokenSavings < -100) {
      results.winner = 'A';
      results.reason = `Similar quality but Prompt A uses ${Math.abs(tokenSavings)} fewer tokens`;
    } else {
      results.winner = 'tie';
      results.reason = 'No significant difference between prompts';
    }

    results.completedAt = new Date().toISOString();

    // Store results
    await createRecord(TABLES.AB_TESTS, {
      TestId: testId,
      Name: name,
      AgentName: agentName,
      TaskType: taskType,
      PromptAScore: results.promptA.avgScore,
      PromptBScore: results.promptB.avgScore,
      PromptATokens: results.promptA.avgTokens,
      PromptBTokens: results.promptB.avgTokens,
      Winner: results.winner,
      Reason: results.reason,
      TestCases: testCases.length,
      ResultsJSON: JSON.stringify(results),
      StartedAt: results.startedAt,
      CompletedAt: results.completedAt,
    });

    logger.info(`A/B test complete: ${name} - Winner: ${results.winner} (${results.reason})`);
    return results;
  } catch (error) {
    logger.error(`A/B test failed: ${error.message}`);
    throw error;
  }
}

/**
 * Run a single prompt test and evaluate quality.
 */
async function runPromptTest(prompt, testCase, model, evaluationCriteria) {
  const startTime = Date.now();

  try {
    const resolvedPrompt = prompt.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return testCase[key] !== undefined ? testCase[key] : match;
    });

    const output = await generateText(resolvedPrompt, {
      model: model || config.models.standard,
      maxTokens: 1500,
    });

    const latencyMs = Date.now() - startTime;

    // Estimate tokens (rough: 4 chars per token)
    const inputTokens = Math.ceil(resolvedPrompt.length / 4);
    const outputTokens = Math.ceil(output.length / 4);

    // Evaluate quality with a separate AI call
    const evaluation = await evaluateOutput(output, testCase, evaluationCriteria);

    return {
      qualityScore: evaluation.score,
      feedback: evaluation.feedback,
      totalTokens: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      latencyMs,
      outputLength: output.length,
    };
  } catch (error) {
    return {
      qualityScore: 0,
      feedback: `Error: ${error.message}`,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startTime,
      outputLength: 0,
    };
  }
}

/**
 * Evaluate the quality of an AI output.
 */
async function evaluateOutput(output, testCase, criteria) {
  try {
    const result = await generateJSON(
      `Evaluate this AI-generated output on a scale of 0-100.

Output to evaluate:
"""
${output.substring(0, 2000)}
"""

Test case context: ${JSON.stringify(testCase)}

Evaluation criteria:
${(criteria || ['accuracy', 'completeness', 'clarity', 'tone']).map(c => `- ${c}`).join('\n')}

Return JSON: { "score": 0-100, "feedback": "brief evaluation notes", "criteriaScores": { "criterion": score } }`,
      { model: config.models.fast, maxTokens: 300 }
    );
    return result;
  } catch (error) {
    return { score: 50, feedback: `Evaluation failed: ${error.message}` };
  }
}

// ── Model Selection Recommendations ──────────────────────────────────────────

/**
 * Analyze agent metrics and recommend optimal models per task type.
 */
async function generateModelRecommendations() {
  logger.info('Generating model recommendations...');

  try {
    const metrics = await getRecords(TABLES.AGENT_METRICS, '');
    const benchmarks = await getRecords(TABLES.AI_BENCHMARKS, '');

    // Analyze cost vs quality by model
    const modelAnalysis = {};
    for (const metric of metrics) {
      const model = metric.ModelUsed;
      if (!model) continue;

      if (!modelAnalysis[model]) {
        modelAnalysis[model] = {
          model,
          runs: 0,
          totalCost: 0,
          totalTokens: 0,
          avgDuration: 0,
          totalDuration: 0,
          successRate: 0,
          completed: 0,
          failed: 0,
          agents: new Set(),
        };
      }

      const analysis = modelAnalysis[model];
      analysis.runs++;
      analysis.totalCost += metric.CostCHF || 0;
      analysis.totalTokens += metric.TokensUsed || 0;
      analysis.totalDuration += metric.Duration || 0;
      if (metric.Status === 'completed') analysis.completed++;
      if (metric.Status === 'failed') analysis.failed++;
      if (metric.AgentName) analysis.agents.add(metric.AgentName);
    }

    // Calculate derived metrics
    for (const analysis of Object.values(modelAnalysis)) {
      analysis.avgDuration = analysis.runs > 0 ? Math.round(analysis.totalDuration / analysis.runs) : 0;
      analysis.successRate = analysis.runs > 0 ? ((analysis.completed / analysis.runs) * 100).toFixed(1) : 0;
      analysis.avgCostPerRun = analysis.runs > 0 ? (analysis.totalCost / analysis.runs).toFixed(4) : 0;
      analysis.agentCount = analysis.agents.size;
      analysis.agents = Array.from(analysis.agents);
    }

    // Generate AI-powered recommendations
    const recommendations = await generateJSON(
      `Analyze these AI model usage patterns for Werkpilot's agent system and recommend optimal models.

Model Usage Data:
${JSON.stringify(modelAnalysis, null, 2)}

Task Type to Model Mapping (current defaults):
${JSON.stringify(TASK_MODEL_MAP, null, 2)}

Model Pricing (per 1M tokens, CHF):
${JSON.stringify(MODEL_PRICING, null, 2)}

Guidelines:
- Haiku (fast): Best for classifications, short responses, QA, data extraction
- Sonnet (standard): Best for content generation, emails, analysis, translation
- Opus (powerful): Best for complex strategy, multi-step reasoning, financial analysis

Provide recommendations as JSON:
{
  "recommendations": [
    {
      "taskType": "...",
      "currentModel": "fast|standard|powerful",
      "recommendedModel": "fast|standard|powerful",
      "reason": "...",
      "estimatedSavings": "CHF X/month",
      "qualityImpact": "none|minor|significant"
    }
  ],
  "overallSavingsEstimate": "CHF X/month",
  "summary": "Brief summary of recommendations"
}`,
      { model: config.models.standard, maxTokens: 1500 }
    );

    // Save recommendations
    const fullRecommendations = {
      generatedAt: new Date().toISOString(),
      modelAnalysis,
      ...recommendations,
    };

    fs.writeFileSync(MODEL_RECS_PATH, JSON.stringify(fullRecommendations, null, 2), 'utf-8');

    logger.info(`Model recommendations generated: ${recommendations.recommendations?.length || 0} suggestions`);
    return fullRecommendations;
  } catch (error) {
    logger.error(`Model recommendations failed: ${error.message}`);
    throw error;
  }
}

// ── Cost Optimization ────────────────────────────────────────────────────────

/**
 * Track daily AI costs across all agents.
 */
async function trackDailyCosts() {
  logger.info('Tracking daily AI costs...');
  const today = new Date().toISOString().slice(0, 10);

  try {
    const metrics = await getRecords(
      TABLES.AGENT_METRICS,
      `{RunDate} >= "${today}"`
    );

    const costBreakdown = {
      date: today,
      totalCostCHF: 0,
      totalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byModel: {},
      byAgent: {},
      byDepartment: {},
      runs: metrics.length,
    };

    for (const metric of metrics) {
      const model = metric.ModelUsed || 'unknown';
      const agent = metric.AgentName || 'unknown';
      const department = metric.Department || 'unknown';
      const cost = metric.CostCHF || estimateCost(model, metric.InputTokens || 0, metric.OutputTokens || 0);

      costBreakdown.totalCostCHF += cost;
      costBreakdown.totalTokens += metric.TokensUsed || 0;
      costBreakdown.totalInputTokens += metric.InputTokens || 0;
      costBreakdown.totalOutputTokens += metric.OutputTokens || 0;

      // By model
      if (!costBreakdown.byModel[model]) {
        costBreakdown.byModel[model] = { cost: 0, tokens: 0, runs: 0 };
      }
      costBreakdown.byModel[model].cost += cost;
      costBreakdown.byModel[model].tokens += metric.TokensUsed || 0;
      costBreakdown.byModel[model].runs++;

      // By agent
      if (!costBreakdown.byAgent[agent]) {
        costBreakdown.byAgent[agent] = { cost: 0, tokens: 0, runs: 0 };
      }
      costBreakdown.byAgent[agent].cost += cost;
      costBreakdown.byAgent[agent].tokens += metric.TokensUsed || 0;
      costBreakdown.byAgent[agent].runs++;

      // By department
      if (!costBreakdown.byDepartment[department]) {
        costBreakdown.byDepartment[department] = { cost: 0, tokens: 0, runs: 0 };
      }
      costBreakdown.byDepartment[department].cost += cost;
      costBreakdown.byDepartment[department].tokens += metric.TokensUsed || 0;
      costBreakdown.byDepartment[department].runs++;
    }

    // Store cost tracking
    await createRecord(TABLES.COST_TRACKING, {
      Date: today,
      TotalCostCHF: parseFloat(costBreakdown.totalCostCHF.toFixed(4)),
      TotalTokens: costBreakdown.totalTokens,
      TotalRuns: costBreakdown.runs,
      ByModelJSON: JSON.stringify(costBreakdown.byModel),
      ByAgentJSON: JSON.stringify(costBreakdown.byAgent),
      ByDepartmentJSON: JSON.stringify(costBreakdown.byDepartment),
      TrackedAt: new Date().toISOString(),
    });

    logger.info(`Daily costs tracked: CHF ${costBreakdown.totalCostCHF.toFixed(4)} across ${costBreakdown.runs} runs`);
    return costBreakdown;
  } catch (error) {
    logger.error(`Cost tracking failed: ${error.message}`);
    throw error;
  }
}

/**
 * Estimate cost based on model and token counts.
 */
function estimateCost(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Identify cost savings opportunities.
 */
async function identifySavingsOpportunities() {
  logger.info('Identifying cost savings opportunities...');

  try {
    const recentCosts = await getRecords(TABLES.COST_TRACKING, '');
    const agentMetrics = await getRecords(TABLES.AGENT_METRICS, '');

    // Find agents using expensive models for simple tasks
    const opportunities = [];

    // Group metrics by agent
    const agentUsage = {};
    for (const metric of agentMetrics) {
      const agent = metric.AgentName;
      if (!agent) continue;

      if (!agentUsage[agent]) {
        agentUsage[agent] = {
          agent,
          models: {},
          totalCost: 0,
          totalRuns: 0,
        };
      }

      const model = metric.ModelUsed || 'unknown';
      if (!agentUsage[agent].models[model]) {
        agentUsage[agent].models[model] = { runs: 0, cost: 0, tokens: 0 };
      }
      agentUsage[agent].models[model].runs++;
      agentUsage[agent].models[model].cost += metric.CostCHF || 0;
      agentUsage[agent].models[model].tokens += metric.TokensUsed || 0;
      agentUsage[agent].totalCost += metric.CostCHF || 0;
      agentUsage[agent].totalRuns++;
    }

    // Identify downgrade opportunities
    for (const usage of Object.values(agentUsage)) {
      const powerfullModel = config.models.powerful;
      const standardModel = config.models.standard;

      // If using Opus for tasks that could use Sonnet
      if (usage.models[powerfullModel] && usage.models[powerfullModel].runs > 5) {
        const opusCost = usage.models[powerfullModel].cost;
        const estimatedSonnetCost = opusCost * (3.0 / 15.0); // Rough ratio
        const savings = opusCost - estimatedSonnetCost;

        if (savings > 1) {
          opportunities.push({
            agent: usage.agent,
            type: 'model_downgrade',
            currentModel: 'Opus',
            suggestedModel: 'Sonnet',
            monthlySavingsCHF: (savings * 30).toFixed(2),
            qualityRisk: 'medium',
            description: `Consider using Sonnet instead of Opus for ${usage.agent}`,
          });
        }
      }

      // If using Sonnet for simple tasks
      if (usage.models[standardModel] && usage.models[standardModel].runs > 10) {
        const avgTokens = usage.models[standardModel].tokens / usage.models[standardModel].runs;
        if (avgTokens < 500) {
          opportunities.push({
            agent: usage.agent,
            type: 'model_downgrade',
            currentModel: 'Sonnet',
            suggestedModel: 'Haiku',
            monthlySavingsCHF: ((usage.models[standardModel].cost * 0.7) * 30).toFixed(2),
            qualityRisk: 'low',
            description: `Low token usage suggests ${usage.agent} could use Haiku`,
          });
        }
      }
    }

    logger.info(`Found ${opportunities.length} savings opportunities`);
    return opportunities;
  } catch (error) {
    logger.error(`Savings identification failed: ${error.message}`);
    throw error;
  }
}

// ── Quality Benchmarking ─────────────────────────────────────────────────────

/**
 * Run quality benchmarks across models for common task types.
 */
async function runQualityBenchmarks() {
  logger.info('Running quality benchmarks...');

  const benchmarkTasks = [
    {
      name: 'email_classification',
      type: 'classification',
      prompt: 'Classify this email as: sales_inquiry, support_request, spam, or general.\n\nEmail: "Hi, I saw your website and would like to discuss building a new web application for our company. Can we schedule a call?"\n\nReturn JSON: { "category": "...", "confidence": 0.0-1.0 }',
      expectedOutput: { category: 'sales_inquiry' },
    },
    {
      name: 'content_generation',
      type: 'content',
      prompt: 'Write a brief LinkedIn post (max 100 words) announcing that Werkpilot, a Swiss digital agency, has launched a new AI-powered website optimization service. Make it professional and engaging.',
      evaluationCriteria: ['engaging', 'professional', 'concise', 'relevant'],
    },
    {
      name: 'data_analysis',
      type: 'analysis',
      prompt: 'Analyze these monthly revenue figures and provide insights:\nJan: CHF 45000, Feb: CHF 52000, Mar: CHF 48000, Apr: CHF 61000, May: CHF 58000, Jun: CHF 72000\n\nReturn JSON: { "trend": "...", "avgGrowthRate": "...", "forecast_jul": 0, "insights": ["..."] }',
      evaluationCriteria: ['accuracy', 'actionable_insights'],
    },
  ];

  const results = [];

  for (const task of benchmarkTasks) {
    for (const [tier, model] of Object.entries(MODEL_TIERS)) {
      try {
        const startTime = Date.now();
        const output = await generateText(task.prompt, {
          model,
          maxTokens: 800,
        });
        const latencyMs = Date.now() - startTime;

        // Estimate tokens
        const inputTokens = Math.ceil(task.prompt.length / 4);
        const outputTokens = Math.ceil(output.length / 4);
        const cost = estimateCost(model, inputTokens, outputTokens);

        // Evaluate quality
        const evaluation = await evaluateOutput(
          output,
          task,
          task.evaluationCriteria || ['accuracy', 'completeness']
        );

        const benchmark = {
          task: task.name,
          taskType: task.type,
          model: tier,
          modelId: model,
          qualityScore: evaluation.score,
          latencyMs,
          inputTokens,
          outputTokens,
          costCHF: cost,
          costEfficiency: evaluation.score > 0 ? (evaluation.score / (cost * 1000)).toFixed(2) : 0,
          timestamp: new Date().toISOString(),
        };

        results.push(benchmark);

        // Store benchmark
        await createRecord(TABLES.AI_BENCHMARKS, {
          TaskName: task.name,
          TaskType: task.type,
          Model: tier,
          ModelId: model,
          QualityScore: evaluation.score,
          LatencyMs: latencyMs,
          TokensUsed: inputTokens + outputTokens,
          CostCHF: parseFloat(cost.toFixed(6)),
          CostEfficiency: parseFloat(benchmark.costEfficiency),
          BenchmarkedAt: benchmark.timestamp,
        });

        logger.info(`  Benchmark: ${task.name} + ${tier} = Score ${evaluation.score}, CHF ${cost.toFixed(6)}, ${latencyMs}ms`);
      } catch (error) {
        logger.error(`Benchmark failed: ${task.name} + ${tier}: ${error.message}`);
      }
    }
  }

  // Save results
  const benchmarkPath = path.join(BENCHMARKS_DIR, `benchmark-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(benchmarkPath, JSON.stringify(results, null, 2), 'utf-8');

  logger.info(`Benchmarks complete: ${results.length} results saved`);
  return results;
}

// ── Prompt Library Management ────────────────────────────────────────────────

/**
 * Get all versioned prompts from the prompts directory.
 */
function getPromptLibrary() {
  try {
    const files = fs.readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.md'));
    const library = {};

    for (const file of files) {
      const content = fs.readFileSync(path.join(PROMPTS_DIR, file), 'utf-8');
      const nameMatch = file.match(/^(.+)-v(\d+)\.md$/);
      if (nameMatch) {
        const [, name, version] = nameMatch;
        if (!library[name]) {
          library[name] = { versions: [], latest: null };
        }
        library[name].versions.push({
          version: parseInt(version),
          file,
          content,
          size: content.length,
        });
      }
    }

    // Set latest version
    for (const prompt of Object.values(library)) {
      prompt.versions.sort((a, b) => b.version - a.version);
      prompt.latest = prompt.versions[0];
    }

    return library;
  } catch (error) {
    logger.error(`Failed to load prompt library: ${error.message}`);
    return {};
  }
}

/**
 * Create a new version of a prompt.
 */
function createPromptVersion(name, content, metadata = {}) {
  const library = getPromptLibrary();
  const currentVersions = library[name]?.versions || [];
  const nextVersion = currentVersions.length > 0
    ? currentVersions[0].version + 1
    : 1;

  const filename = `${name}-v${nextVersion}.md`;
  const header = `---
name: ${name}
version: ${nextVersion}
created: ${new Date().toISOString()}
author: ai-optimization-agent
${metadata.model ? `model: ${metadata.model}` : ''}
${metadata.taskType ? `taskType: ${metadata.taskType}` : ''}
${metadata.abTestResult ? `abTestResult: ${metadata.abTestResult}` : ''}
---

`;

  fs.writeFileSync(
    path.join(PROMPTS_DIR, filename),
    header + content,
    'utf-8'
  );

  logger.info(`Created prompt version: ${filename}`);
  return { name, version: nextVersion, file: filename };
}

// ── Model Performance Tracking ───────────────────────────────────────────────

/**
 * Track model performance (latency and quality) per task type.
 */
async function trackModelPerformance() {
  logger.info('Tracking model performance by task type...');

  try {
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const metrics = await getRecords(
      TABLES.AGENT_METRICS,
      `{RunDate} >= "${last7Days}"`
    );

    // Group by model and task type
    const performance = {};

    for (const metric of metrics) {
      const model = metric.ModelUsed || 'unknown';
      const taskType = metric.TaskType || 'unknown';
      const key = `${model}:${taskType}`;

      if (!performance[key]) {
        performance[key] = {
          model,
          taskType,
          samples: 0,
          totalLatency: 0,
          avgLatency: 0,
          minLatency: Infinity,
          maxLatency: 0,
          totalCost: 0,
          avgCost: 0,
          successRate: 0,
          successes: 0,
          failures: 0,
        };
      }

      const perf = performance[key];
      perf.samples++;
      perf.totalLatency += metric.Duration || 0;
      perf.minLatency = Math.min(perf.minLatency, metric.Duration || Infinity);
      perf.maxLatency = Math.max(perf.maxLatency, metric.Duration || 0);
      perf.totalCost += metric.CostCHF || 0;

      if (metric.Status === 'completed') perf.successes++;
      else perf.failures++;
    }

    // Calculate averages
    for (const perf of Object.values(performance)) {
      perf.avgLatency = Math.round(perf.totalLatency / perf.samples);
      perf.avgCost = (perf.totalCost / perf.samples).toFixed(6);
      perf.successRate = ((perf.successes / perf.samples) * 100).toFixed(1);
    }

    logger.info(`Tracked performance for ${Object.keys(performance).length} model/task combinations`);
    return performance;
  } catch (error) {
    logger.error(`Model performance tracking failed: ${error.message}`);
    return {};
  }
}

/**
 * Compare models for specific task types.
 */
async function compareModelsForTask(taskType) {
  const performance = await trackModelPerformance();
  const taskPerf = Object.values(performance).filter(p => p.taskType === taskType);

  if (taskPerf.length === 0) {
    logger.warn(`No performance data for task type: ${taskType}`);
    return null;
  }

  // Sort by cost efficiency (quality/cost ratio)
  const comparison = taskPerf.map(p => ({
    ...p,
    costEfficiency: p.successRate > 0 ? (parseFloat(p.successRate) / (parseFloat(p.avgCost) * 1000)).toFixed(2) : 0,
  })).sort((a, b) => parseFloat(b.costEfficiency) - parseFloat(a.costEfficiency));

  return {
    taskType,
    models: comparison,
    recommended: comparison[0]?.model || config.models.standard,
  };
}

// ── Prompt Effectiveness Tracking ────────────────────────────────────────────

/**
 * Track which prompts are most effective for each task type.
 */
async function trackPromptEffectiveness() {
  logger.info('Tracking prompt effectiveness...');

  try {
    const abTests = await getRecords(TABLES.AB_TESTS, '');
    const effectiveness = {};

    for (const test of abTests) {
      const key = `${test.AgentName}:${test.TaskType}`;

      if (!effectiveness[key]) {
        effectiveness[key] = {
          agent: test.AgentName,
          taskType: test.TaskType,
          tests: 0,
          avgScoreA: 0,
          avgScoreB: 0,
          preferredPrompt: null,
        };
      }

      const eff = effectiveness[key];
      eff.tests++;

      if (test.Winner === 'A') {
        eff.avgScoreA += test.PromptAScore || 0;
      } else if (test.Winner === 'B') {
        eff.avgScoreB += test.PromptBScore || 0;
      }
    }

    // Calculate averages and determine preferred prompts
    for (const eff of Object.values(effectiveness)) {
      if (eff.tests > 0) {
        eff.avgScoreA = (eff.avgScoreA / eff.tests).toFixed(1);
        eff.avgScoreB = (eff.avgScoreB / eff.tests).toFixed(1);
        eff.preferredPrompt = parseFloat(eff.avgScoreA) > parseFloat(eff.avgScoreB) ? 'A' : 'B';
      }
    }

    logger.info(`Tracked prompt effectiveness for ${Object.keys(effectiveness).length} agent/task pairs`);
    return effectiveness;
  } catch (error) {
    logger.error(`Prompt effectiveness tracking failed: ${error.message}`);
    return {};
  }
}

// ── Token Budget Allocation ──────────────────────────────────────────────────

/**
 * Allocate token budgets per department based on usage patterns.
 */
async function allocateTokenBudgets() {
  logger.info('Allocating token budgets per department...');

  try {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const metrics = await getRecords(
      TABLES.AGENT_METRICS,
      `{RunDate} >= "${last30Days}"`
    );

    // Calculate usage by department
    const departmentUsage = {};
    let totalTokens = 0;

    for (const metric of metrics) {
      const dept = metric.Department || 'unknown';
      const tokens = metric.TokensUsed || 0;

      if (!departmentUsage[dept]) {
        departmentUsage[dept] = { tokens: 0, cost: 0, agents: new Set() };
      }

      departmentUsage[dept].tokens += tokens;
      departmentUsage[dept].cost += metric.CostCHF || 0;
      departmentUsage[dept].agents.add(metric.AgentName);
      totalTokens += tokens;
    }

    // Calculate percentages and allocate budgets
    const monthlyTokenBudget = config.integrations?.anthropic?.monthlyTokenBudget || 50000000; // 50M tokens
    const allocations = {};

    for (const [dept, usage] of Object.entries(departmentUsage)) {
      const percentage = (usage.tokens / totalTokens) * 100;
      const allocation = Math.round((usage.tokens / totalTokens) * monthlyTokenBudget);

      allocations[dept] = {
        department: dept,
        currentUsage: usage.tokens,
        currentCost: usage.cost.toFixed(2),
        usagePercentage: percentage.toFixed(1),
        allocatedTokens: allocation,
        agentCount: usage.agents.size,
        tokensPerAgent: Math.round(allocation / usage.agents.size),
      };
    }

    logger.info(`Allocated budgets for ${Object.keys(allocations).length} departments`);
    return allocations;
  } catch (error) {
    logger.error(`Token budget allocation failed: ${error.message}`);
    return {};
  }
}

// ── Daily AI Cost Report ─────────────────────────────────────────────────────

/**
 * Generate daily AI cost report with key insights.
 */
async function generateDailyAICostReport() {
  logger.info('Generating daily AI cost report...');

  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const todayCosts = await getRecords(TABLES.COST_TRACKING, `{Date} = "${today}"`);
    const yesterdayCosts = await getRecords(TABLES.COST_TRACKING, `{Date} = "${yesterday}"`);

    const todayTotal = todayCosts[0]?.TotalCostCHF || 0;
    const yesterdayTotal = yesterdayCosts[0]?.TotalCostCHF || 0;
    const change = ((todayTotal - yesterdayTotal) / yesterdayTotal * 100).toFixed(1);

    // Get top spending agents today
    const todayByAgent = JSON.parse(todayCosts[0]?.ByAgentJSON || '{}');
    const topAgents = Object.entries(todayByAgent)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5)
      .map(([name, data]) => ({ name, cost: data.cost.toFixed(4), runs: data.runs }));

    const report = {
      date: today,
      totalCost: todayTotal.toFixed(4),
      yesterdayTotal: yesterdayTotal.toFixed(4),
      change: isFinite(parseFloat(change)) ? change : '0.0',
      topAgents,
    };

    logger.info(
      `Daily AI cost: CHF ${report.totalCost} (${report.change}% ${parseFloat(report.change) >= 0 ? 'increase' : 'decrease'})`
    );

    return report;
  } catch (error) {
    logger.error(`Daily cost report generation failed: ${error.message}`);
    return null;
  }
}

// ── Token Optimization ───────────────────────────────────────────────────────

/**
 * Analyze prompts for token optimization opportunities.
 */
async function optimizeTokenUsage() {
  logger.info('Analyzing token optimization opportunities...');

  const library = getPromptLibrary();
  const optimizations = [];

  for (const [name, promptData] of Object.entries(library)) {
    const latest = promptData.latest;
    if (!latest) continue;

    try {
      const optimization = await generateJSON(
        `Analyze this prompt for token optimization while maintaining quality.

Prompt (${latest.content.length} chars, ~${Math.ceil(latest.content.length / 4)} tokens):
"""
${latest.content.substring(0, 3000)}
"""

Suggest optimizations:
1. Can the prompt be shorter without losing clarity?
2. Are there redundant instructions?
3. Can examples be more concise?
4. Can system-level instructions be cached?

Return JSON: {
  "currentEstimatedTokens": 0,
  "optimizedEstimatedTokens": 0,
  "savingsPercent": 0,
  "suggestions": ["..."],
  "optimizedVersion": "the optimized prompt text",
  "qualityImpact": "none|minimal|moderate"
}`,
        { model: config.models.fast, maxTokens: 2000 }
      );

      if (optimization.savingsPercent > 10) {
        optimizations.push({
          promptName: name,
          currentTokens: optimization.currentEstimatedTokens,
          optimizedTokens: optimization.optimizedEstimatedTokens,
          savingsPercent: optimization.savingsPercent,
          suggestions: optimization.suggestions,
          qualityImpact: optimization.qualityImpact,
        });
      }
    } catch (error) {
      logger.error(`Token optimization analysis failed for ${name}: ${error.message}`);
    }
  }

  logger.info(`Found ${optimizations.length} token optimization opportunities`);
  return optimizations;
}

// ── Monthly AI Spend Report ──────────────────────────────────────────────────

/**
 * Generate comprehensive monthly AI spend report with recommendations.
 */
async function generateMonthlySpendReport() {
  logger.info('Generating monthly AI spend report...');

  try {
    // Get last 30 days of cost data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const costRecords = await getRecords(
      TABLES.COST_TRACKING,
      `{Date} >= "${thirtyDaysAgo}"`
    );

    // Aggregate monthly costs
    let totalCost = 0;
    let totalTokens = 0;
    let totalRuns = 0;
    const dailyCosts = [];
    const modelCosts = {};
    const departmentCosts = {};
    const agentCosts = {};

    for (const record of costRecords) {
      totalCost += record.TotalCostCHF || 0;
      totalTokens += record.TotalTokens || 0;
      totalRuns += record.TotalRuns || 0;

      dailyCosts.push({
        date: record.Date,
        cost: record.TotalCostCHF || 0,
        tokens: record.TotalTokens || 0,
        runs: record.TotalRuns || 0,
      });

      // Parse JSON fields
      try {
        const byModel = JSON.parse(record.ByModelJSON || '{}');
        for (const [model, data] of Object.entries(byModel)) {
          if (!modelCosts[model]) modelCosts[model] = { cost: 0, tokens: 0, runs: 0 };
          modelCosts[model].cost += data.cost || 0;
          modelCosts[model].tokens += data.tokens || 0;
          modelCosts[model].runs += data.runs || 0;
        }
      } catch {}

      try {
        const byDept = JSON.parse(record.ByDepartmentJSON || '{}');
        for (const [dept, data] of Object.entries(byDept)) {
          if (!departmentCosts[dept]) departmentCosts[dept] = { cost: 0, tokens: 0, runs: 0 };
          departmentCosts[dept].cost += data.cost || 0;
          departmentCosts[dept].tokens += data.tokens || 0;
          departmentCosts[dept].runs += data.runs || 0;
        }
      } catch {}

      try {
        const byAgent = JSON.parse(record.ByAgentJSON || '{}');
        for (const [agent, data] of Object.entries(byAgent)) {
          if (!agentCosts[agent]) agentCosts[agent] = { cost: 0, tokens: 0, runs: 0 };
          agentCosts[agent].cost += data.cost || 0;
          agentCosts[agent].tokens += data.tokens || 0;
          agentCosts[agent].runs += data.runs || 0;
        }
      } catch {}
    }

    // Get savings opportunities
    const savings = await identifySavingsOpportunities();

    // Generate AI analysis
    const analysis = await generateJSON(
      `Analyze this monthly AI spending report for Werkpilot and provide recommendations.

Total Monthly Cost: CHF ${totalCost.toFixed(2)}
Total Tokens: ${totalTokens.toLocaleString()}
Total Runs: ${totalRuns}
Monthly Budget: CHF ${config.integrations?.anthropic?.monthlyBudgetCHF || 500}

Cost by Model:
${JSON.stringify(modelCosts, null, 2)}

Cost by Department:
${JSON.stringify(departmentCosts, null, 2)}

Top 10 Agents by Cost:
${JSON.stringify(
  Object.entries(agentCosts)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 10)
    .map(([name, data]) => ({ name, ...data })),
  null, 2
)}

Savings Opportunities: ${savings.length}

Provide analysis as JSON: {
  "summary": "2-3 sentence executive summary",
  "budgetStatus": "under_budget|on_track|over_budget",
  "costTrend": "decreasing|stable|increasing",
  "topRecommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "projectedNextMonth": 0,
  "potentialMonthlySavings": 0
}`,
      { model: config.models.standard, maxTokens: 1000 }
    );

    // Build and send report
    const report = {
      period: `Last 30 days (since ${thirtyDaysAgo})`,
      totalCost: totalCost.toFixed(2),
      totalTokens,
      totalRuns,
      dailyCosts,
      modelCosts,
      departmentCosts,
      topAgents: Object.entries(agentCosts)
        .sort((a, b) => b[1].cost - a[1].cost)
        .slice(0, 15)
        .map(([name, data]) => ({ name, ...data })),
      savings,
      analysis,
    };

    const html = buildSpendReportHTML(report);

    await sendCEOEmail({
      subject: `Monthly AI Spend: CHF ${totalCost.toFixed(2)} | ${analysis.budgetStatus?.replace(/_/g, ' ')} | ${analysis.topRecommendations?.[0] || ''}`,
      html,
    });

    logger.info(`Monthly spend report: CHF ${totalCost.toFixed(2)}, ${totalRuns} runs`);
    return report;
  } catch (error) {
    logger.error(`Monthly spend report failed: ${error.message}`);
    throw error;
  }
}

/**
 * Build HTML for the monthly spend report email.
 */
function buildSpendReportHTML(report) {
  const modelRows = Object.entries(report.modelCosts)
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([model, data]) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${MODEL_PRICING[model]?.label || model}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">CHF ${data.cost.toFixed(4)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.tokens?.toLocaleString() || 0}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.runs}</td>
      </tr>
    `).join('');

  const deptRows = Object.entries(report.departmentCosts)
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([dept, data]) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${dept}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">CHF ${data.cost.toFixed(4)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.runs}</td>
      </tr>
    `).join('');

  const savingsRows = report.savings.slice(0, 5).map(s => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${s.agent}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${s.currentModel} -> ${s.suggestedModel}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">CHF ${s.monthlySavingsCHF}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${s.qualityRisk}</td>
    </tr>
  `).join('');

  return `
    <h2>Monthly AI Spend Report</h2>
    <p>${report.period}</p>

    <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">Summary</h3>
      <p>${report.analysis?.summary || ''}</p>
    </div>

    <div style="display: flex; gap: 15px; margin: 20px 0; flex-wrap: wrap;">
      <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; flex: 1; min-width: 120px;">
        <strong>Total Spend</strong><br>CHF ${report.totalCost}
      </div>
      <div style="background: #f0fff0; padding: 15px; border-radius: 8px; flex: 1; min-width: 120px;">
        <strong>Total Runs</strong><br>${report.totalRuns?.toLocaleString()}
      </div>
      <div style="background: #fff8f0; padding: 15px; border-radius: 8px; flex: 1; min-width: 120px;">
        <strong>Total Tokens</strong><br>${report.totalTokens?.toLocaleString()}
      </div>
      <div style="background: #f8f0ff; padding: 15px; border-radius: 8px; flex: 1; min-width: 120px;">
        <strong>Projected Next Month</strong><br>CHF ${report.analysis?.projectedNextMonth || 'N/A'}
      </div>
    </div>

    <h3>Cost by Model</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">Model</th>
        <th style="padding: 8px; text-align: left;">Cost</th>
        <th style="padding: 8px; text-align: left;">Tokens</th>
        <th style="padding: 8px; text-align: left;">Runs</th>
      </tr>
      ${modelRows}
    </table>

    <h3>Cost by Department</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">Department</th>
        <th style="padding: 8px; text-align: left;">Cost</th>
        <th style="padding: 8px; text-align: left;">Runs</th>
      </tr>
      ${deptRows}
    </table>

    ${report.savings.length > 0 ? `
    <h3>Savings Opportunities</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">Agent</th>
        <th style="padding: 8px; text-align: left;">Change</th>
        <th style="padding: 8px; text-align: left;">Monthly Savings</th>
        <th style="padding: 8px; text-align: left;">Quality Risk</th>
      </tr>
      ${savingsRows}
    </table>
    <p><strong>Potential Total Savings: CHF ${report.analysis?.potentialMonthlySavings || 'N/A'}/month</strong></p>
    ` : ''}

    ${report.analysis?.topRecommendations ? `
    <h3>Recommendations</h3>
    <ol>${report.analysis.topRecommendations.map(r => `<li>${r}</li>`).join('')}</ol>
    ` : ''}
  `;
}

// ── Helper Functions ─────────────────────────────────────────────────────────

function average(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ── Main Runs ────────────────────────────────────────────────────────────────

/**
 * Daily cost tracking run.
 */
async function runDailyCostTracking() {
  logger.info('=== AI Optimization Daily Cost Tracking ===');
  const startTime = Date.now();

  try {
    await trackDailyCosts();
  } catch (error) {
    logger.error(`Daily cost tracking failed: ${error.message}`, { stack: error.stack });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Daily cost tracking completed in ${duration}s ===`);
}

/**
 * Weekly optimization review.
 */
async function runWeeklyOptimization() {
  logger.info('=== AI Optimization Weekly Review ===');
  const startTime = Date.now();

  try {
    await generateModelRecommendations();
    await runQualityBenchmarks();
    await optimizeTokenUsage();
    await identifySavingsOpportunities();
    await trackModelPerformance();
    await trackPromptEffectiveness();
    await allocateTokenBudgets();
  } catch (error) {
    logger.error(`Weekly optimization failed: ${error.message}`, { stack: error.stack });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Weekly optimization completed in ${duration}s ===`);
}

/**
 * Monthly spend report.
 */
async function runMonthlySpendReport() {
  logger.info('=== AI Optimization Monthly Report ===');
  const startTime = Date.now();

  try {
    await generateMonthlySpendReport();
  } catch (error) {
    logger.error(`Monthly spend report failed: ${error.message}`, { stack: error.stack });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Monthly report completed in ${duration}s ===`);
}

// ── Cron Scheduling ──────────────────────────────────────────────────────────

// Daily cost tracking at 23:00
cron.schedule('0 23 * * *', () => {
  runDailyCostTracking().catch(err => logger.error(`Cron daily cost error: ${err.message}`));
});

// Weekly optimization review on Monday at 04:00
cron.schedule('0 4 * * 1', () => {
  runWeeklyOptimization().catch(err => logger.error(`Cron weekly optimization error: ${err.message}`));
});

// Monthly AI spend report on 1st at 03:00
cron.schedule('0 3 1 * *', () => {
  runMonthlySpendReport().catch(err => logger.error(`Cron monthly report error: ${err.message}`));
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runDailyCostTracking,
  runWeeklyOptimization,
  runMonthlySpendReport,
  runPromptABTest,
  generateModelRecommendations,
  trackDailyCosts,
  identifySavingsOpportunities,
  runQualityBenchmarks,
  getPromptLibrary,
  createPromptVersion,
  optimizeTokenUsage,
  generateMonthlySpendReport,
  estimateCost,
  trackModelPerformance,
  compareModelsForTask,
  trackPromptEffectiveness,
  allocateTokenBudgets,
  generateDailyAICostReport,
};

// Run immediately if executed directly
if (require.main === module) {
  runDailyCostTracking()
    .then(() => logger.info('Manual cost tracking completed'))
    .catch(err => logger.error(`Manual run failed: ${err.message}`));
}
