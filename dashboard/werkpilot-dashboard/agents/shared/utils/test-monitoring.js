/**
 * Test Monitoring System
 * Verifies all monitoring components are working correctly
 */

const { getPerformanceMonitor } = require('./performance-monitor');
const { getCostTracker } = require('./cost-tracker');
const { getAlertManager } = require('./alert-manager');

async function testPerformanceMonitor() {
  console.log('\n========================================');
  console.log('Testing Performance Monitor');
  console.log('========================================\n');

  const monitor = getPerformanceMonitor();

  // Simulate agent executions
  console.log('1. Tracking successful execution...');
  monitor.trackExecution('test-agent', {
    duration: 1500,
    status: 'completed',
    tokensUsed: 1000,
    model: 'haiku',
    cost: 0.001,
    cpuTime: 500,
    memoryDelta: 1024,
    apiCalls: 2,
  });

  console.log('2. Tracking another execution...');
  monitor.trackExecution('test-agent', {
    duration: 2000,
    status: 'completed',
    tokensUsed: 1500,
    model: 'sonnet',
    cost: 0.005,
    cpuTime: 800,
    memoryDelta: 2048,
    apiCalls: 3,
  });

  console.log('3. Tracking failed execution...');
  monitor.trackExecution('test-agent', {
    duration: 500,
    status: 'error',
    tokensUsed: 100,
    model: 'haiku',
    cost: 0.0001,
    cpuTime: 100,
    memoryDelta: 512,
    apiCalls: 1,
  });

  console.log('4. Getting agent metrics...');
  const metrics = monitor.getAgentMetrics('test-agent');
  console.log(JSON.stringify(metrics, null, 2));

  console.log('\n5. Getting system metrics...');
  const systemMetrics = monitor.getSystemMetrics();
  console.log(JSON.stringify(systemMetrics, null, 2));

  console.log('\n✓ Performance Monitor test completed');
}

async function testCostTracker() {
  console.log('\n========================================');
  console.log('Testing Cost Tracker');
  console.log('========================================\n');

  const tracker = getCostTracker();

  // Test cost tracking
  console.log('1. Tracking Haiku usage...');
  let result = tracker.trackCost('sales-agent', 'sales', {
    model: 'haiku',
    inputTokens: 1000,
    outputTokens: 500,
  });
  console.log(`Cost: $${result.cost.toFixed(4)}`);

  console.log('\n2. Tracking Sonnet usage...');
  result = tracker.trackCost('marketing-agent', 'marketing', {
    model: 'sonnet',
    inputTokens: 2000,
    outputTokens: 1000,
  });
  console.log(`Cost: $${result.cost.toFixed(4)}`);

  console.log('\n3. Tracking Opus usage...');
  result = tracker.trackCost('ceo-agent', 'operations', {
    model: 'opus',
    inputTokens: 5000,
    outputTokens: 2000,
  });
  console.log(`Cost: $${result.cost.toFixed(4)}`);

  console.log('\n4. Getting daily cost report...');
  const dailyReport = tracker.getDailyCostReport();
  console.log(JSON.stringify(dailyReport, null, 2));

  console.log('\n5. Getting department costs...');
  const deptCost = tracker.getDepartmentCost('sales');
  console.log(JSON.stringify(deptCost, null, 2));

  console.log('\n6. Getting cost optimizations...');
  const optimizations = tracker.getCostOptimizations();
  console.log(JSON.stringify(optimizations, null, 2));

  console.log('\n✓ Cost Tracker test completed');
}

async function testAlertManager() {
  console.log('\n========================================');
  console.log('Testing Alert Manager');
  console.log('========================================\n');

  const alerts = getAlertManager();

  // Test alert creation
  console.log('1. Creating info alert...');
  alerts.addAlert({
    level: 'info',
    type: 'test',
    message: 'This is an info alert',
    data: { test: true },
  });

  console.log('\n2. Creating warning alert...');
  alerts.addAlert({
    level: 'warning',
    type: 'test',
    message: 'This is a warning alert',
    data: { threshold: 10, value: 15 },
  });

  console.log('\n3. Creating critical alert...');
  alerts.addAlert({
    level: 'critical',
    type: 'test',
    message: 'This is a critical alert',
    data: { severity: 'high' },
  });

  console.log('\n4. Testing deduplication (same alert)...');
  alerts.addAlert({
    level: 'critical',
    type: 'test',
    message: 'This is a critical alert',
    data: { severity: 'high' },
  });

  console.log('\n5. Getting all alerts...');
  const allAlerts = alerts.getAlerts({ limit: 10 });
  console.log(`Found ${allAlerts.length} alerts`);

  console.log('\n6. Getting alert statistics...');
  const stats = alerts.getAlertStats('24h');
  console.log(JSON.stringify(stats, null, 2));

  console.log('\n7. Testing alert acknowledgment...');
  if (allAlerts.length > 0) {
    const alertId = allAlerts[0].id;
    const success = alerts.acknowledgeAlert(alertId);
    console.log(`Acknowledged alert: ${success}`);
  }

  console.log('\n✓ Alert Manager test completed');
}

async function testIntegration() {
  console.log('\n========================================');
  console.log('Testing Integration');
  console.log('========================================\n');

  const monitor = getPerformanceMonitor();
  const tracker = getCostTracker();

  // Simulate multiple agents running
  const agents = [
    { name: 'sales-agent-1', dept: 'sales', model: 'haiku' },
    { name: 'sales-agent-2', dept: 'sales', model: 'sonnet' },
    { name: 'marketing-agent-1', dept: 'marketing', model: 'haiku' },
    { name: 'ops-agent-1', dept: 'operations', model: 'opus' },
  ];

  console.log('Simulating 10 executions per agent...\n');

  for (const agent of agents) {
    for (let i = 0; i < 10; i++) {
      const inputTokens = Math.floor(Math.random() * 2000) + 500;
      const outputTokens = Math.floor(Math.random() * 1000) + 200;
      const duration = Math.floor(Math.random() * 3000) + 500;
      const status = Math.random() > 0.1 ? 'completed' : 'error';

      // Track cost
      const costResult = tracker.trackCost(agent.name, agent.dept, {
        model: agent.model,
        inputTokens,
        outputTokens,
      });

      // Track performance
      monitor.trackExecution(agent.name, {
        duration,
        status,
        tokensUsed: inputTokens + outputTokens,
        model: agent.model,
        cost: costResult.cost,
        cpuTime: Math.floor(Math.random() * 500),
        memoryDelta: Math.floor(Math.random() * 2048),
        apiCalls: Math.floor(Math.random() * 3) + 1,
      });
    }

    console.log(`✓ ${agent.name} completed 10 executions`);
  }

  console.log('\n--- Final System Metrics ---\n');

  const systemMetrics = monitor.getSystemMetrics();
  console.log('Executions per hour:', systemMetrics.executionsPerHour);
  console.log('Total executions:', systemMetrics.totalExecutions);
  console.log('Error rate:', (systemMetrics.errorRate * 100).toFixed(2) + '%');
  console.log('Total cost: $' + systemMetrics.totalCost.toFixed(4));
  console.log('Avg response time:', (systemMetrics.avgResponseTime / 1000).toFixed(2) + 's');

  console.log('\n--- Cost Summary ---\n');

  const allCosts = tracker.getAllCosts();
  console.log('Total agents:', allCosts.agents.length);
  console.log('Daily cost: $' + allCosts.daily.totalCost.toFixed(4));

  console.log('\nTop 3 most expensive agents:');
  allCosts.agents.slice(0, 3).forEach((agent, i) => {
    console.log(`  ${i + 1}. ${agent.name}: $${agent.totalCost.toFixed(4)}`);
  });

  console.log('\nDepartment costs:');
  allCosts.departments.forEach((dept) => {
    console.log(
      `  ${dept.name}: $${dept.totalCost.toFixed(4)} (${dept.budgetUsed.toFixed(1)}% of budget)`
    );
  });

  console.log('\n✓ Integration test completed');
}

async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Werkpilot Monitoring System Tests    ║');
  console.log('╔════════════════════════════════════════╝');

  try {
    await testPerformanceMonitor();
    await testCostTracker();
    await testAlertManager();
    await testIntegration();

    console.log('\n');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  All tests completed successfully! ✓  ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testPerformanceMonitor,
  testCostTracker,
  testAlertManager,
  testIntegration,
};
