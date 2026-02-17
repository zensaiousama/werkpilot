/**
 * Metrics API Endpoint
 * Returns aggregated system metrics, agent performance, costs, and alerts
 */

import { NextRequest, NextResponse } from 'next/server';

// Cache configuration
const CACHE_DURATION = 60 * 1000; // 60 seconds
let metricsCache: {
  data: any;
  timestamp: number;
} | null = null;

/**
 * GET /api/metrics - Returns all system metrics
 */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const type = url.searchParams.get('type'); // agent, system, costs, alerts

    // Check cache
    const now = Date.now();
    if (metricsCache && now - metricsCache.timestamp < CACHE_DURATION) {
      return filterMetrics(metricsCache.data, type);
    }

    // Gather metrics from all sources
    const metrics = await gatherMetrics();

    // Update cache
    metricsCache = {
      data: metrics,
      timestamp: now,
    };

    return filterMetrics(metrics, type);
  } catch (error) {
    console.error('Failed to get metrics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    );
  }
}

/**
 * Filter metrics based on type parameter
 */
function filterMetrics(metrics: any, type: string | null) {
  if (!type) {
    return NextResponse.json(metrics);
  }

  const filtered: any = {
    timestamp: metrics.timestamp,
  };

  switch (type) {
    case 'agent':
      filtered.agents = metrics.agents;
      break;
    case 'system':
      filtered.system = metrics.system;
      break;
    case 'costs':
      filtered.costs = metrics.costs;
      break;
    case 'alerts':
      filtered.alerts = metrics.alerts;
      break;
    default:
      return NextResponse.json(metrics);
  }

  return NextResponse.json(filtered);
}

/**
 * Gather all metrics from various sources
 */
async function gatherMetrics() {
  const timestamp = Date.now();

  // Import monitoring utilities (Node.js modules)
  let performanceMonitor: any = null;
  let costTracker: any = null;
  let alertManager: any = null;

  // Agent monitoring utilities are optional - they may not be installed
  // Use dynamic path resolution to avoid TypeScript module resolution errors
  const agentUtilsBase = '../../../agents/shared/utils';

  try {
    // @ts-ignore - optional external module
    const performanceModule = await import(/* webpackIgnore: true */ `${agentUtilsBase}/performance-monitor.js`);
    performanceMonitor = performanceModule.getPerformanceMonitor();
  } catch {
    // Performance monitor not available - using database metrics only
  }

  try {
    // @ts-ignore - optional external module
    const costModule = await import(/* webpackIgnore: true */ `${agentUtilsBase}/cost-tracker.js`);
    costTracker = costModule.getCostTracker();
  } catch {
    // Cost tracker not available - using defaults
  }

  try {
    // @ts-ignore - optional external module
    const alertModule = await import(/* webpackIgnore: true */ `${agentUtilsBase}/alert-manager.js`);
    alertManager = alertModule.getAlertManager();
  } catch {
    // Alert manager not available - using defaults
  }

  // Get database metrics
  const dbMetrics = await getDatabaseMetrics();

  // Combine all metrics
  const metrics = {
    timestamp,
    system: {
      ...(performanceMonitor ? performanceMonitor.getSystemMetrics() : {}),
      database: dbMetrics.system,
    },
    agents: [
      ...(performanceMonitor
        ? Array.from(performanceMonitor.metrics.agents.values()).map((agent: any) =>
            performanceMonitor.getAgentMetrics(agent.name)
          )
        : []),
      ...dbMetrics.agents,
    ],
    costs: costTracker
      ? costTracker.getAllCosts()
      : {
          agents: [],
          departments: [],
          daily: { totalCost: 0, executions: 0, agents: [], departments: [] },
          weekly: { totalCost: 0, executions: 0 },
          monthly: { totalCost: 0, executions: 0, departments: [] },
          optimizations: [],
        },
    alerts: alertManager
      ? {
          recent: alertManager.getAlerts({ limit: 50 }),
          stats: {
            '1h': alertManager.getAlertStats('1h'),
            '24h': alertManager.getAlertStats('24h'),
            '7d': alertManager.getAlertStats('7d'),
          },
          unacknowledged: alertManager.getAlerts({
            acknowledged: false,
            limit: 20,
          }),
        }
      : {
          recent: [],
          stats: {
            '1h': { total: 0, info: 0, warning: 0, critical: 0, unacknowledged: 0, byType: {} },
            '24h': { total: 0, info: 0, warning: 0, critical: 0, unacknowledged: 0, byType: {} },
            '7d': { total: 0, info: 0, warning: 0, critical: 0, unacknowledged: 0, byType: {} },
          },
          unacknowledged: [],
        },
  };

  return metrics;
}

/**
 * Get metrics from database (Prisma)
 */
async function getDatabaseMetrics() {
  try {
    const prisma = (await import('@/lib/db')).default;

    // Get agent metrics
    const agents = await prisma.agent.findMany({
      include: {
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    // Calculate agent performance from executions
    const agentMetrics = agents.map((agent) => {
      const executions = agent.executions || [];
      const completedExecutions = executions.filter((e) => e.status === 'completed');
      const failedExecutions = executions.filter((e) => e.status === 'failed');

      const totalDuration = completedExecutions.reduce(
        (sum, e) => sum + (e.durationMs || 0),
        0
      );
      const avgDuration = completedExecutions.length > 0
        ? totalDuration / completedExecutions.length
        : 0;

      const totalTokens = executions.reduce((sum, e) => sum + (e.tokensUsed || 0), 0);

      return {
        name: agent.name,
        department: agent.dept,
        status: agent.status,
        score: agent.score,
        tasksToday: agent.tasksToday,
        errorsToday: agent.errorsToday,
        lastRun: agent.lastRun,
        executions: executions.length,
        completedExecutions: completedExecutions.length,
        failedExecutions: failedExecutions.length,
        errorRate: executions.length > 0 ? failedExecutions.length / executions.length : 0,
        avgDuration,
        totalTokens,
        recentLogs: agent.logs,
      };
    });

    // System-wide metrics
    const totalExecutions = agentMetrics.reduce((sum, a) => sum + a.executions, 0);
    const totalErrors = agentMetrics.reduce((sum, a) => sum + a.failedExecutions, 0);
    const systemErrorRate = totalExecutions > 0 ? totalErrors / totalExecutions : 0;

    // Get notification count
    const unreadNotifications = await prisma.notification.count({
      where: { read: false },
    });

    // Get recent activity
    const recentActivities = await prisma.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { lead: true },
    });

    return {
      system: {
        totalAgents: agents.length,
        activeAgents: agents.filter((a) => a.status === 'active').length,
        idleAgents: agents.filter((a) => a.status === 'idle').length,
        totalExecutions,
        totalErrors,
        errorRate: systemErrorRate,
        unreadNotifications,
        recentActivities: recentActivities.length,
      },
      agents: agentMetrics,
    };
  } catch (error) {
    console.error('Failed to get database metrics:', error);
    return {
      system: {
        totalAgents: 0,
        activeAgents: 0,
        idleAgents: 0,
        totalExecutions: 0,
        totalErrors: 0,
        errorRate: 0,
        unreadNotifications: 0,
        recentActivities: 0,
      },
      agents: [],
    };
  }
}

/**
 * POST /api/metrics/acknowledge - Acknowledge an alert
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { alertId } = body;

    if (!alertId) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 });
    }

    // Load alert manager and acknowledge
    const agentUtilsBase = '../../../agents/shared/utils';
    // @ts-ignore - optional external module
    const { getAlertManager } = await import(/* webpackIgnore: true */ `${agentUtilsBase}/alert-manager.js`);
    const alertManager = getAlertManager();
    const success = alertManager.acknowledgeAlert(alertId);

    if (!success) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // Invalidate cache
    metricsCache = null;

    return NextResponse.json({ success: true, alertId });
  } catch (error) {
    console.error('Failed to acknowledge alert:', error);
    return NextResponse.json(
      { error: 'Failed to acknowledge alert' },
      { status: 500 }
    );
  }
}
