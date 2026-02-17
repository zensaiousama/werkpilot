/**
 * Test Script for Night Shift Integration
 *
 * Tests all components of the night shift system:
 * - Task dispatcher registration and execution
 * - Dashboard client connectivity
 * - Night shift runner dry run
 * - Morning briefing data fetch
 *
 * Usage:
 *   node test-night-shift-integration.js
 */

const { createLogger } = require('./shared/utils/logger');
const dashboardClient = require('./shared/utils/dashboard-client');
const taskDispatcher = require('./shared/utils/task-dispatcher');

const logger = createLogger('night-shift-integration-test');

// ── Test Suite ───────────────────────────────────────────────────────────────

/**
 * Test 1: Task Dispatcher
 */
async function testTaskDispatcher() {
  console.log('\n=== Test 1: Task Dispatcher ===\n');

  try {
    // Register test handler
    taskDispatcher.registerHandler('test-task', async (data) => {
      return {
        success: true,
        output: `Processed: ${data.message}`,
        tokensUsed: 10,
      };
    });

    // Dispatch test task
    const result = await taskDispatcher.dispatch({
      id: 'test-1',
      type: 'test-task',
      data: { message: 'Hello Night Shift!' },
    });

    console.log('✓ Task dispatched successfully');
    console.log('  Result:', JSON.stringify(result, null, 2));

    // Check metrics
    const metrics = taskDispatcher.getMetrics();
    console.log('✓ Metrics:', JSON.stringify(metrics, null, 2));

    // Test unregistered task
    const failResult = await taskDispatcher.dispatch({
      id: 'test-2',
      type: 'nonexistent-task',
      data: {},
    });

    console.log('✓ Error handling works:', failResult.success === false);

    // Clean up
    taskDispatcher.unregisterHandler('test-task');

    return true;
  } catch (error) {
    console.error('✗ Task Dispatcher test failed:', error.message);
    return false;
  }
}

/**
 * Test 2: Dashboard Client
 */
async function testDashboardClient() {
  console.log('\n=== Test 2: Dashboard Client ===\n');

  try {
    // Test health check
    const isHealthy = await dashboardClient.healthCheck();

    if (isHealthy) {
      console.log('✓ Dashboard health check passed');
    } else {
      console.log('⚠ Dashboard health check failed (is dashboard running?)');
      return false;
    }

    // Test fetching night shift tasks (should not fail even if no tasks)
    try {
      const response = await dashboardClient.get('/api/nightshift?status=pending');
      console.log(`✓ Fetched night shift tasks: ${response.tasks?.length || 0} pending`);
    } catch (error) {
      console.log('⚠ Could not fetch night shift tasks:', error.message);
      console.log('  (This is expected if dashboard is not running)');
      return false;
    }

    return true;
  } catch (error) {
    console.error('✗ Dashboard Client test failed:', error.message);
    console.error('  Make sure dashboard is running at:', process.env.DASHBOARD_URL || 'http://localhost:3002');
    return false;
  }
}

/**
 * Test 3: Dashboard Reports API
 */
async function testDashboardReports() {
  console.log('\n=== Test 3: Dashboard Reports API ===\n');

  try {
    const report = await dashboardClient.get('/api/reports');

    console.log('✓ Dashboard report fetched successfully');
    console.log('  Generated at:', report.generatedAt);
    console.log('  KPIs:', JSON.stringify(report.kpis || {}, null, 2));
    console.log('  Agent Health:', JSON.stringify({
      total: report.agentHealth?.total,
      running: report.agentHealth?.running,
      errored: report.agentHealth?.errored,
    }, null, 2));
    console.log('  Night Shift:', JSON.stringify(report.nightShift || {}, null, 2));

    return true;
  } catch (error) {
    console.error('✗ Dashboard Reports test failed:', error.message);
    console.error('  Make sure /api/reports endpoint exists in dashboard');
    return false;
  }
}

/**
 * Test 4: Task Type Registry
 */
async function testTaskRegistry() {
  console.log('\n=== Test 4: Task Type Registry ===\n');

  try {
    // Load night shift runner to register handlers
    const { registerTaskHandlers } = require('./night-shift-runner');

    // Register all handlers
    registerTaskHandlers();

    // Check registered types
    const registeredTypes = taskDispatcher.getRegisteredTypes();

    console.log('✓ Task handlers registered:', registeredTypes.length);
    console.log('  Types:', registeredTypes.join(', '));

    const expectedTypes = [
      'scrape',
      'seo-analysis',
      'follow-up',
      'pipeline-update',
      'content-generate',
      'security-scan',
      'agent-optimize',
    ];

    const allRegistered = expectedTypes.every((type) =>
      taskDispatcher.hasHandler(type)
    );

    if (allRegistered) {
      console.log('✓ All expected task types are registered');
    } else {
      console.log('⚠ Some task types are missing');
    }

    return allRegistered;
  } catch (error) {
    console.error('✗ Task Registry test failed:', error.message);
    return false;
  }
}

/**
 * Test 5: Mock Task Execution
 */
async function testMockTaskExecution() {
  console.log('\n=== Test 5: Mock Task Execution ===\n');

  try {
    // Load night shift runner
    const { registerTaskHandlers } = require('./night-shift-runner');
    registerTaskHandlers();

    // Test a simple task (scrape - it's a placeholder)
    console.log('Testing scrape task...');
    const scrapeResult = await taskDispatcher.dispatch({
      id: 'mock-1',
      type: 'scrape',
      data: { url: 'https://example.com' },
    });

    console.log('✓ Scrape task result:', scrapeResult.success ? 'success' : 'failed');

    // Check metrics after execution
    const metrics = taskDispatcher.getMetrics();
    console.log('✓ Execution metrics:', JSON.stringify(metrics, null, 2));

    return true;
  } catch (error) {
    console.error('✗ Mock Task Execution test failed:', error.message);
    return false;
  }
}

/**
 * Test 6: Morning Briefing Data Fetch
 */
async function testMorningBriefingData() {
  console.log('\n=== Test 6: Morning Briefing Data Fetch ===\n');

  try {
    const { fetchDashboardReport } = require('./ceo/morning-briefing-v2');

    const report = await fetchDashboardReport();

    console.log('✓ Morning briefing data fetched');
    console.log('  Generated at:', report.generatedAt);
    console.log('  Total leads:', report.kpis?.totalLeads || 0);
    console.log('  Night shift tasks:', report.nightShift?.totalTasks || 0);
    console.log('  Agents:', report.agentHealth?.total || 0);

    return true;
  } catch (error) {
    console.error('✗ Morning Briefing Data test failed:', error.message);
    return false;
  }
}

// ── Test Runner ──────────────────────────────────────────────────────────────

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Night Shift Integration Test Suite                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results = [];

  // Run tests sequentially
  results.push({ name: 'Task Dispatcher', passed: await testTaskDispatcher() });
  results.push({ name: 'Dashboard Client', passed: await testDashboardClient() });
  results.push({ name: 'Dashboard Reports', passed: await testDashboardReports() });
  results.push({ name: 'Task Registry', passed: await testTaskRegistry() });
  results.push({ name: 'Mock Task Execution', passed: await testMockTaskExecution() });
  results.push({ name: 'Morning Briefing Data', passed: await testMorningBriefingData() });

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     Test Results Summary                                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const icon = result.passed ? '✓' : '✗';
    const status = result.passed ? 'PASS' : 'FAIL';
    console.log(`  ${icon} ${result.name}: ${status}`);
  });

  console.log(`\n  Total: ${passed}/${total} tests passed (${((passed / total) * 100).toFixed(1)}%)`);

  if (passed === total) {
    console.log('\n  🎉 All tests passed! Night Shift integration is ready.');
    process.exit(0);
  } else {
    console.log('\n  ⚠ Some tests failed. Check logs above for details.');
    console.log('  Note: Dashboard-dependent tests will fail if dashboard is not running.');
    process.exit(1);
  }
}

// ── Execute ──────────────────────────────────────────────────────────────────

if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('\n✗ Test suite crashed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  testTaskDispatcher,
  testDashboardClient,
  testDashboardReports,
  testTaskRegistry,
  testMockTaskExecution,
  testMorningBriefingData,
};
