/**
 * Example Agent
 * Demonstrates how to use the monitoring infrastructure
 */

const { createAgent } = require('./shared/utils/agent-wrapper');

// Create an agent with monitoring
const agent = createAgent('example-agent', 'sales', {
  model: 'haiku', // Default model to use
  trackPerformance: true,
  trackCosts: true,
  enableAlerts: true,
});

/**
 * Example task: Analyze a lead
 */
async function analyzeLeadTask() {
  // Simulate API call to Claude
  agent.trackApiCall();

  // Simulate some processing
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return {
    score: 85,
    recommendation: 'High priority lead',
  };
}

/**
 * Example execution with automatic tracking
 */
async function analyzeLead(leadId) {
  console.log(`\n=== Analyzing Lead ${leadId} ===\n`);

  // Execute with automatic tracking
  const result = await agent.execute(analyzeLeadTask, {
    model: 'haiku',
    inputTokens: 500,
    outputTokens: 200,
  });

  if (result.success) {
    console.log('Analysis complete:', result.result);
    console.log('Execution metrics:', result.metrics);

    // Send success info
    agent.info('Lead analyzed successfully', {
      leadId,
      score: result.result.score,
    });
  } else {
    console.error('Analysis failed:', result.error);
    console.log('Execution metrics:', result.metrics);
  }

  return result;
}

/**
 * Example manual tracking
 */
async function manualTracking() {
  console.log('\n=== Manual Tracking Example ===\n');

  // Start tracking
  agent.startExecution();

  try {
    // Do some work
    agent.trackApiCall();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Track another API call
    agent.trackApiCall();
    await new Promise((resolve) => setTimeout(resolve, 300));

    // End tracking
    const metrics = agent.endExecution('completed', {
      model: 'sonnet',
      inputTokens: 1000,
      outputTokens: 500,
    });

    console.log('Manual tracking metrics:', metrics);
  } catch (error) {
    agent.endExecution('error', {
      model: 'sonnet',
      inputTokens: 1000,
      outputTokens: 0,
    });

    agent.warn('Manual tracking failed', { error: error.message });
  }
}

/**
 * Example alert usage
 */
function sendAlerts() {
  console.log('\n=== Alert Examples ===\n');

  // Info alert
  agent.info('Agent started successfully');

  // Warning alert
  agent.warn('Lead score below threshold', {
    score: 45,
    threshold: 50,
  });

  // Critical alert (use sparingly!)
  // agent.critical('Critical error occurred', { error: 'Database connection lost' });
}

/**
 * Get agent metrics
 */
function showMetrics() {
  console.log('\n=== Agent Metrics ===\n');

  const metrics = agent.getMetrics();
  if (metrics) {
    console.log('Performance metrics:', JSON.stringify(metrics, null, 2));
  }

  const costs = agent.getCosts();
  if (costs) {
    console.log('Cost metrics:', JSON.stringify(costs, null, 2));
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting Example Agent...');

  // Example 1: Automatic tracking
  await analyzeLead('lead-123');

  // Example 2: Manual tracking
  await manualTracking();

  // Example 3: Send alerts
  sendAlerts();

  // Example 4: Show metrics
  setTimeout(() => {
    showMetrics();
  }, 1000);
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  analyzeLead,
  agent,
};
