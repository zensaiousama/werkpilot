/**
 * Agent 15 - Innovation Agent
 *
 * Scans for new AI models/tools/APIs, runs benchmarks, manages experiments,
 * tracks AI costs, and produces monthly innovation reports.
 *
 * Schedule: Weekly scans, ongoing experiment tracking, monthly report
 */

const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('innovation');

// --- Airtable Tables ---
const TABLES = {
  DISCOVERIES: 'Innovation_Discoveries',
  EXPERIMENTS: 'Innovation_Experiments',
  BENCHMARKS: 'Innovation_Benchmarks',
  AI_COSTS: 'AI_Cost_Tracking',
  AB_TESTS: 'AB_Tests',
};

const EXPERIMENTS_PATH = path.join(__dirname, 'experiments.json');
const BENCHMARKS_DIR = path.join(__dirname, 'benchmarks');

// --- RSS and News Sources ---
const AI_NEWS_SOURCES = [
  { name: 'Anthropic Blog', url: 'https://www.anthropic.com/blog', type: 'html' },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog', type: 'html' },
  { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog', type: 'html' },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/', type: 'html' },
  { name: 'AI News - The Verge', url: 'https://www.theverge.com/ai-artificial-intelligence', type: 'html' },
  { name: 'Papers With Code', url: 'https://paperswithcode.com/', type: 'html' },
];

// ============================================================
// AI Discovery Scanner
// ============================================================

async function scanForDiscoveries() {
  logger.info('Scanning AI news sources for new discoveries');

  const discoveries = [];

  for (const source of AI_NEWS_SOURCES) {
    try {
      logger.info(`Scanning: ${source.name}`);

      const response = await axios.get(source.url, {
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      const $ = cheerio.load(response.data);

      // Extract article titles and links
      const articles = [];
      $('article, .post, .blog-post, [class*="article"], [class*="post"]')
        .slice(0, 10)
        .each((_, el) => {
          const title =
            $(el).find('h1, h2, h3, [class*="title"]').first().text().trim() ||
            $(el).find('a').first().text().trim();
          const link = $(el).find('a').first().attr('href') || '';
          const snippet = $(el).find('p, [class*="excerpt"], [class*="description"]').first().text().trim();

          if (title && title.length > 10) {
            articles.push({
              title: title.substring(0, 200),
              link: link.startsWith('http') ? link : `${source.url}${link}`,
              snippet: snippet.substring(0, 300),
            });
          }
        });

      if (articles.length === 0) {
        // Fallback: extract from headings
        $('h2, h3')
          .slice(0, 10)
          .each((_, el) => {
            const title = $(el).text().trim();
            const link = $(el).find('a').attr('href') || $(el).parent().find('a').first().attr('href') || '';
            if (title && title.length > 10) {
              articles.push({
                title: title.substring(0, 200),
                link: link.startsWith('http') ? link : `${source.url}${link}`,
                snippet: '',
              });
            }
          });
      }

      if (articles.length > 0) {
        // Use Claude to evaluate relevance
        const evaluation = await generateJSON(
          `Evaluate these AI news articles for relevance to a company that builds AI-powered business automation (marketing, sales, operations agents).

Source: ${source.name}
Articles:
${JSON.stringify(articles, null, 2)}

For each article, determine:
1. Is it relevant to improving quality, speed, or reducing costs of AI automation?
2. Rate relevance 0-100
3. Categorize: "new-model", "new-tool", "new-api", "technique", "industry-trend", "not-relevant"

Return JSON array with: title, relevance_score, category, action_recommendation (brief)
Only include articles with relevance_score >= 40.`,
          { model: config.models.fast, maxTokens: 1500 }
        );

        const relevant = Array.isArray(evaluation)
          ? evaluation.filter((a) => a.relevance_score >= 40)
          : [];

        for (const article of relevant) {
          discoveries.push({
            source: source.name,
            ...article,
          });
        }
      }
    } catch (err) {
      logger.warn(`Failed to scan ${source.name}`, { error: err.message });
    }
  }

  // Save discoveries to Airtable
  for (const discovery of discoveries) {
    try {
      // Avoid duplicates by checking title
      const existing = await getRecords(
        TABLES.DISCOVERIES,
        `{Title} = "${discovery.title.replace(/"/g, '\\"').substring(0, 100)}"`,
        1
      );

      if (existing.length === 0) {
        await createRecord(TABLES.DISCOVERIES, {
          Title: discovery.title,
          Source: discovery.source,
          Category: discovery.category,
          Relevance_Score: discovery.relevance_score,
          Action: discovery.action_recommendation,
          Status: 'New',
          Discovered_Date: new Date().toISOString().split('T')[0],
        });
      }
    } catch (err) {
      logger.warn(`Failed to save discovery: ${discovery.title}`, { error: err.message });
    }
  }

  logger.info(`Found ${discoveries.length} relevant AI discoveries`);
  return discoveries;
}

// ============================================================
// Benchmark Testing
// ============================================================

async function runBenchmarks() {
  logger.info('Running AI model benchmarks');

  const benchmarkTemplate = loadBenchmarkTemplate();
  const results = [];

  for (const test of benchmarkTemplate.tests) {
    try {
      logger.info(`Running benchmark: ${test.name}`);

      const testResults = {
        name: test.name,
        category: test.category,
        timestamp: new Date().toISOString(),
        models: {},
      };

      // Test with Claude (our primary model)
      for (const model of [config.models.fast, config.models.standard]) {
        const modelName = model.split('-').slice(0, 2).join('-');
        const startTime = Date.now();

        try {
          const response = await generateText(test.prompt, {
            model,
            maxTokens: test.maxTokens || 1024,
            temperature: test.temperature || 0.5,
          });

          const latency = Date.now() - startTime;

          // Score the response
          const score = await generateJSON(
            `Score this AI response on a scale of 0-100 for the given task.

Task: ${test.name}
Expected criteria: ${test.criteria}
Response: ${response.substring(0, 2000)}

Return JSON: { "score": number, "reasoning": "brief explanation" }`,
            { model: config.models.fast, maxTokens: 256 }
          );

          testResults.models[modelName] = {
            score: score.score || 0,
            latency,
            reasoning: score.reasoning || '',
            tokenEstimate: Math.ceil(response.length / 4),
          };
        } catch (err) {
          testResults.models[modelName] = {
            score: 0,
            latency: Date.now() - startTime,
            error: err.message,
          };
        }
      }

      results.push(testResults);

      // Save to Airtable
      try {
        await createRecord(TABLES.BENCHMARKS, {
          Name: test.name,
          Category: test.category,
          Results: JSON.stringify(testResults.models),
          Date: new Date().toISOString().split('T')[0],
          Winner: determineWinner(testResults.models),
        });
      } catch (err) {
        logger.warn(`Failed to save benchmark: ${test.name}`, { error: err.message });
      }
    } catch (err) {
      logger.error(`Benchmark failed: ${test.name}`, { error: err.message });
    }
  }

  // Save results to local file
  const resultsPath = path.join(BENCHMARKS_DIR, `results-${new Date().toISOString().split('T')[0]}.json`);
  try {
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    logger.info(`Benchmark results saved to ${resultsPath}`);
  } catch (err) {
    logger.warn('Failed to save benchmark results locally', { error: err.message });
  }

  logger.info(`Completed ${results.length} benchmark tests`);
  return results;
}

function loadBenchmarkTemplate() {
  const templatePath = path.join(BENCHMARKS_DIR, 'benchmark-template.json');
  try {
    return JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
  } catch (err) {
    logger.warn('Failed to load benchmark template, using defaults', { error: err.message });
    return {
      tests: [
        {
          name: 'Marketing Copy Generation',
          category: 'content',
          prompt: 'Write a compelling 100-word product description for an AI-powered business automation tool targeting Swiss SMEs.',
          criteria: 'Clarity, persuasiveness, brand alignment, call to action',
          maxTokens: 512,
          temperature: 0.7,
        },
        {
          name: 'Data Extraction Accuracy',
          category: 'analysis',
          prompt: 'Extract key metrics from this text: "Q4 revenue was CHF 2.3M, up 15% YoY. Customer count grew to 847 (+23%). Churn dropped to 2.1%. ARPU rose to CHF 2,718."',
          criteria: 'Accuracy, completeness, structured output',
          maxTokens: 512,
          temperature: 0.2,
        },
        {
          name: 'Email Personalization',
          category: 'outreach',
          prompt: 'Write a personalized follow-up email to a prospect who attended our webinar on AI automation but has not responded to our initial outreach. Company: Tech startup, 50 employees, Zurich.',
          criteria: 'Personalization, professional tone, clear CTA, conciseness',
          maxTokens: 512,
          temperature: 0.6,
        },
      ],
    };
  }
}

function determineWinner(models) {
  let best = null;
  let bestScore = -1;
  for (const [name, data] of Object.entries(models)) {
    if (data.score > bestScore) {
      bestScore = data.score;
      best = name;
    }
  }
  return best;
}

// ============================================================
// Experiment Management
// ============================================================

function loadExperiments() {
  try {
    return JSON.parse(fs.readFileSync(EXPERIMENTS_PATH, 'utf-8'));
  } catch (err) {
    return { experiments: [] };
  }
}

function saveExperiments(data) {
  fs.writeFileSync(EXPERIMENTS_PATH, JSON.stringify(data, null, 2));
}

async function proposeExperiments() {
  logger.info('Proposing new experiments based on discoveries');

  try {
    const discoveries = await getRecords(
      TABLES.DISCOVERIES,
      'AND({Status} = "New", {Relevance_Score} >= 60)',
      10
    );

    if (discoveries.length === 0) {
      logger.info('No high-relevance discoveries to experiment with');
      return [];
    }

    const proposals = await generateJSON(
      `Based on these AI discoveries, propose practical experiments for a business automation company.

Discoveries:
${JSON.stringify(discoveries.map((d) => ({ title: d.Title, category: d.Category, action: d.Action })), null, 2)}

For each viable experiment, return JSON array with:
- name: experiment name
- hypothesis: what we expect to prove
- methodology: how to test (keep practical, 1-2 week timeframe)
- success_metric: how we measure success
- estimated_effort_hours: realistic estimate
- potential_impact: "cost_reduction", "quality_improvement", "speed_improvement"
- discovery_title: which discovery inspired this

Only propose experiments that are practical and relevant.`,
      { model: config.models.standard, maxTokens: 2048 }
    );

    const experiments = Array.isArray(proposals) ? proposals : [];

    // Save to Airtable
    for (const exp of experiments) {
      try {
        await createRecord(TABLES.EXPERIMENTS, {
          Name: exp.name,
          Hypothesis: exp.hypothesis,
          Methodology: exp.methodology,
          Success_Metric: exp.success_metric,
          Effort_Hours: exp.estimated_effort_hours,
          Impact_Type: exp.potential_impact,
          Status: 'Proposed',
          Proposed_Date: new Date().toISOString().split('T')[0],
        });
      } catch (err) {
        logger.warn(`Failed to save experiment: ${exp.name}`, { error: err.message });
      }
    }

    // Update discovery status
    for (const discovery of discoveries) {
      try {
        await updateRecord(TABLES.DISCOVERIES, discovery.id, { Status: 'Experiment Proposed' });
      } catch (err) {
        logger.warn('Failed to update discovery status', { error: err.message });
      }
    }

    // Update local experiments.json
    const local = loadExperiments();
    local.experiments.push(
      ...experiments.map((e) => ({
        ...e,
        status: 'proposed',
        proposedDate: new Date().toISOString(),
      }))
    );
    saveExperiments(local);

    logger.info(`Proposed ${experiments.length} new experiments`);
    return experiments;
  } catch (err) {
    logger.error('Failed to propose experiments', { error: err.message });
    return [];
  }
}

// ============================================================
// A/B Test Management
// ============================================================

async function manageABTests() {
  logger.info('Managing A/B tests for prompt variations');

  try {
    const activeTests = await getRecords(TABLES.AB_TESTS, '{Status} = "Active"');

    for (const test of activeTests) {
      try {
        const sampleSize = test.Sample_Size || 100;
        const variantAResults = test.Variant_A_Conversions || 0;
        const variantBResults = test.Variant_B_Conversions || 0;
        const totalSamples = (test.Variant_A_Samples || 0) + (test.Variant_B_Samples || 0);

        // Check if we have enough data for statistical significance
        if (totalSamples >= sampleSize) {
          const rateA =
            test.Variant_A_Samples > 0 ? variantAResults / test.Variant_A_Samples : 0;
          const rateB =
            test.Variant_B_Samples > 0 ? variantBResults / test.Variant_B_Samples : 0;

          const winner = rateA > rateB ? 'A' : rateB > rateA ? 'B' : 'Tie';
          const improvement =
            rateA > 0 ? (((rateB - rateA) / rateA) * 100).toFixed(1) : 'N/A';

          await updateRecord(TABLES.AB_TESTS, test.id, {
            Status: 'Completed',
            Winner: winner,
            Rate_A: Math.round(rateA * 10000) / 100,
            Rate_B: Math.round(rateB * 10000) / 100,
            Improvement_Pct: winner === 'B' ? improvement : winner === 'A' ? `-${improvement}` : '0',
            Completed_Date: new Date().toISOString().split('T')[0],
          });

          logger.info(
            `A/B test completed: ${test.Name} - Winner: Variant ${winner} (${improvement}% diff)`
          );
        }
      } catch (err) {
        logger.warn(`Failed to process A/B test: ${test.Name}`, { error: err.message });
      }
    }

    return activeTests.length;
  } catch (err) {
    logger.error('Failed to manage A/B tests', { error: err.message });
    return 0;
  }
}

// ============================================================
// AI Cost Tracking
// ============================================================

async function trackAICosts() {
  logger.info('Tracking AI costs per task');

  try {
    const today = new Date().toISOString().split('T')[0];
    const costs = await getRecords(TABLES.AI_COSTS, `{Date} = "${today}"`);

    if (costs.length === 0) {
      logger.info('No cost records for today');
      return null;
    }

    // Aggregate costs by agent/task
    const costByAgent = {};
    const costByTask = {};
    let totalCost = 0;

    for (const record of costs) {
      const agent = record.Agent || 'unknown';
      const task = record.Task_Type || 'unknown';
      const cost = record.Cost_USD || 0;

      costByAgent[agent] = (costByAgent[agent] || 0) + cost;
      costByTask[task] = (costByTask[task] || 0) + cost;
      totalCost += cost;
    }

    // Check for cost anomalies
    const avgCostPerTask = totalCost / costs.length;
    const anomalies = costs.filter((c) => (c.Cost_USD || 0) > avgCostPerTask * 3);

    if (anomalies.length > 0) {
      logger.warn(`Found ${anomalies.length} cost anomalies (3x above average)`);
    }

    // Generate optimization suggestions
    const optimizations = await generateJSON(
      `Analyze these AI cost patterns and suggest optimizations.

Costs by agent: ${JSON.stringify(costByAgent)}
Costs by task type: ${JSON.stringify(costByTask)}
Total daily cost: $${totalCost.toFixed(2)}
Total API calls: ${costs.length}
Average cost per call: $${avgCostPerTask.toFixed(4)}

Suggest optimizations as JSON array with:
- suggestion: what to change
- estimated_savings_pct: percentage savings estimate
- effort: "low", "medium", "high"
- agent_affected: which agent or "all"

Consider: model downgrades for simple tasks, caching, batching, prompt optimization.`,
      { model: config.models.fast, maxTokens: 1024 }
    );

    return {
      date: today,
      totalCost,
      callCount: costs.length,
      avgCostPerCall: avgCostPerTask,
      costByAgent,
      costByTask,
      anomalies: anomalies.length,
      optimizations: Array.isArray(optimizations) ? optimizations : [],
    };
  } catch (err) {
    logger.error('Failed to track AI costs', { error: err.message });
    return null;
  }
}

// ============================================================
// Monthly Innovation Report
// ============================================================

async function generateMonthlyReport() {
  logger.info('Generating monthly innovation report');

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];

    const discoveries = await getRecords(
      TABLES.DISCOVERIES,
      `{Discovered_Date} >= "${monthStart}"`
    );

    const experiments = await getRecords(
      TABLES.EXPERIMENTS,
      `OR({Proposed_Date} >= "${monthStart}", {Status} = "Active")`
    );

    const benchmarks = await getRecords(
      TABLES.BENCHMARKS,
      `{Date} >= "${monthStart}"`
    );

    const abTests = await getRecords(
      TABLES.AB_TESTS,
      `OR({Status} = "Active", AND({Status} = "Completed", {Completed_Date} >= "${monthStart}"))`
    );

    const costData = await trackAICosts();

    const reportText = await generateText(
      `Generate a monthly innovation report for the leadership team.

Data:
- New AI discoveries this month: ${discoveries.length}
  Top discoveries: ${discoveries.slice(0, 5).map((d) => `${d.Title} (${d.Category}, relevance: ${d.Relevance_Score})`).join('; ')}
- Active experiments: ${experiments.filter((e) => e.Status === 'Active').length}
- Proposed experiments: ${experiments.filter((e) => e.Status === 'Proposed').length}
- Benchmark tests run: ${benchmarks.length}
- A/B tests active: ${abTests.filter((t) => t.Status === 'Active').length}
- A/B tests completed: ${abTests.filter((t) => t.Status === 'Completed').length}
- AI cost summary: ${costData ? `$${costData.totalCost.toFixed(2)}/day, ${costData.callCount} calls` : 'No data'}
- Cost optimizations: ${costData ? costData.optimizations.map((o) => o.suggestion).join('; ') : 'None'}

Write a professional report with sections:
1. Key Discoveries & Trends
2. Experiment Pipeline
3. Benchmark Highlights
4. A/B Test Results
5. AI Cost Analysis & Optimization
6. Recommendations for Next Month

Keep it strategic and actionable. Under 600 words.`,
      { model: config.models.standard, maxTokens: 2000 }
    );

    const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    await sendCEOEmail({
      subject: `Monthly Innovation Report - ${monthName}`,
      html: `
        <h1>Innovation Report - ${monthName}</h1>
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 700px;">
          <div style="background: #f0fff0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong>Highlights:</strong> ${discoveries.length} discoveries | ${experiments.length} experiments | ${benchmarks.length} benchmarks | ${abTests.length} A/B tests
          </div>
          ${formatReportHTML(reportText)}
          <hr style="margin-top: 30px;">
          <p style="color: #666; font-size: 12px;">Generated by Werkpilot Innovation Agent</p>
        </div>
      `,
    });

    logger.info('Monthly innovation report sent');
    return {
      discoveries: discoveries.length,
      experiments: experiments.length,
      benchmarks: benchmarks.length,
    };
  } catch (err) {
    logger.error('Failed to generate monthly report', { error: err.message });
    throw err;
  }
}

function formatReportHTML(text) {
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h2>${line.slice(2)}</h2>`;
      if (line.startsWith('## ')) return `<h3>${line.slice(3)}</h3>`;
      if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
      if (line.trim() === '') return '<br>';
      return `<p>${line}</p>`;
    })
    .join('\n');
}

// ============================================================
// Main Execution Flows
// ============================================================

async function runWeeklyScan() {
  logger.info('=== Innovation Weekly Scan ===');
  const startTime = Date.now();

  try {
    const discoveries = await scanForDiscoveries();
    const experiments = await proposeExperiments();
    const abTestCount = await manageABTests();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Weekly scan complete in ${duration}s`, {
      discoveries: discoveries.length,
      experiments: experiments.length,
      abTests: abTestCount,
    });
  } catch (err) {
    logger.error('Weekly scan failed', { error: err.message, stack: err.stack });
  }
}

async function runWeeklyBenchmarks() {
  logger.info('=== Innovation Weekly Benchmarks ===');
  const startTime = Date.now();

  try {
    const results = await runBenchmarks();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Weekly benchmarks complete in ${duration}s`, { tests: results.length });
  } catch (err) {
    logger.error('Weekly benchmarks failed', { error: err.message, stack: err.stack });
  }
}

async function runDailyCostTracking() {
  logger.info('=== Daily AI Cost Tracking ===');
  try {
    const costData = await trackAICosts();
    if (costData && costData.totalCost > 50) {
      logger.warn(`Daily AI cost alert: $${costData.totalCost.toFixed(2)}`);
    }
  } catch (err) {
    logger.error('Daily cost tracking failed', { error: err.message, stack: err.stack });
  }
}

// ============================================================
// Cron Schedules
// ============================================================

// Weekly on Tuesdays at 03:00 - scan for new AI tools/models
cron.schedule('0 3 * * 2', () => {
  runWeeklyScan().catch((err) =>
    logger.error('Cron weekly scan failed', { error: err.message })
  );
});

// Weekly on Thursdays at 02:00 - run benchmarks
cron.schedule('0 2 * * 4', () => {
  runWeeklyBenchmarks().catch((err) =>
    logger.error('Cron weekly benchmarks failed', { error: err.message })
  );
});

// Daily at 23:00 - cost tracking
cron.schedule('0 23 * * *', () => {
  runDailyCostTracking().catch((err) =>
    logger.error('Cron daily cost tracking failed', { error: err.message })
  );
});

// Monthly on the 2nd at 09:00 - innovation report
cron.schedule('0 9 2 * *', () => {
  generateMonthlyReport().catch((err) =>
    logger.error('Cron monthly report failed', { error: err.message })
  );
});

// ============================================================
// Exports
// ============================================================

module.exports = {
  runWeeklyScan,
  runWeeklyBenchmarks,
  runDailyCostTracking,
  generateMonthlyReport,
  scanForDiscoveries,
  runBenchmarks,
  proposeExperiments,
  manageABTests,
  trackAICosts,
};

// Run immediately if executed directly
if (require.main === module) {
  logger.info('Innovation Agent starting (direct execution)');
  runWeeklyScan()
    .then(() => logger.info('Innovation Agent initial run complete'))
    .catch((err) => {
      logger.error('Innovation Agent failed', { error: err.message });
      process.exit(1);
    });
}
