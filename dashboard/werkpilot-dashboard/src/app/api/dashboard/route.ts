/**
 * Unified Dashboard Data Endpoint
 *
 * Supports ?view= parameter:
 *   - "kpis"   — lightweight KPI + pipeline data (replaces /api/analytics)
 *   - "report" — comprehensive report with industry breakdown (replaces /api/reports)
 *   - "full"   — everything incl. agents, notifications, insights (default)
 *
 * Features:
 * - Parallel Prisma queries for optimal performance
 * - 15-second caching (per view) to reduce database load
 * - Single endpoint reduces network overhead
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSharedCache } from '@/lib/cache';
import { MRR_PER_CLIENT } from '@/lib/constants';
import { buildStatusMap, buildPipeline, calcPipelineVelocity, calcAgentHealth } from '@/lib/dashboard-helpers';

const CACHE_TTL = 15_000; // 15 seconds

export async function GET(request: NextRequest) {
  const view = request.nextUrl.searchParams.get('view') || 'full';
  const cacheKey = `dashboard:${view}`;
  const cache = getSharedCache();

  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // --- Shared base queries (needed by all views) ---
    const [totalLeads, leadsByStatus, wonLeads, pipelineValue, activeClients] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({ by: ['status'], _count: true }),
      prisma.lead.findMany({
        where: { status: 'Won' },
        select: { umsatzpotenzial: true, createdAt: true, updatedAt: true },
      }),
      prisma.lead.aggregate({
        where: { status: { notIn: ['Lost', 'New Lead'] } },
        _sum: { umsatzpotenzial: true },
      }),
      prisma.lead.count({ where: { status: 'Client' } }),
    ]);

    const statusMap = buildStatusMap(leadsByStatus);
    const pipeline = buildPipeline(statusMap);
    const pipelineVelocity = calcPipelineVelocity(wonLeads);
    const mrr = activeClients * MRR_PER_CLIENT;
    const conversionRate = totalLeads > 0 ? ((statusMap['Won'] || 0) / totalLeads) * 100 : 0;
    const avgDealSize = wonLeads.length > 0
      ? wonLeads.reduce((sum, l) => sum + l.umsatzpotenzial, 0) / wonLeads.length
      : 0;

    const kpis = {
      mrr,
      totalLeads,
      activeClients,
      pipelineValue: pipelineValue._sum.umsatzpotenzial || 0,
      conversionRate: Number(conversionRate.toFixed(2)),
      avgDealSize: Math.round(avgDealSize),
      pipelineVelocity: Number(pipelineVelocity.toFixed(1)),
      wonDeals: statusMap['Won'] || 0,
    };

    // --- "kpis" view: lightweight ---
    if (view === 'kpis') {
      const result = { timestamp: new Date().toISOString(), kpis, pipeline };
      cache.set(cacheKey, result, CACHE_TTL);
      return NextResponse.json(result);
    }

    // --- Additional queries for report + full views ---
    const [agents, nightTasks, decisions, recentActivities] = await Promise.all([
      prisma.agent.findMany({
        select: {
          id: true, name: true, dept: true, status: true,
          score: true, tasksToday: true, errorsToday: true, lastRun: true,
        },
      }),
      prisma.nightShiftTask.findMany({
        where: { status: { in: ['done', 'failed'] } },
        select: { status: true, startedAt: true, completedAt: true, task: true },
      }),
      prisma.decision.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true, type: true, details: true, createdAt: true,
          lead: { select: { firma: true, status: true } },
        },
      }),
    ]);

    const agentHealth = calcAgentHealth(agents);

    // --- "report" view: comprehensive report ---
    if (view === 'report') {
      // Night Shift statistics
      const completedNightTasks = nightTasks.filter((t) => t.status === 'done').length;
      const failedNightTasks = nightTasks.filter((t) => t.status === 'failed').length;
      const nightShiftSuccessRate = nightTasks.length > 0
        ? (completedNightTasks / nightTasks.length) * 100 : 0;

      const tasksWithDuration = nightTasks.filter((t) => t.startedAt && t.completedAt);
      const avgNightShiftDuration = tasksWithDuration.length > 0
        ? tasksWithDuration.reduce((sum, t) => {
            return sum + (t.completedAt!.getTime() - t.startedAt!.getTime());
          }, 0) / tasksWithDuration.length / 1000
        : 0;

      // Department breakdown
      const deptMap: Record<string, { total: number; running: number; errored: number; avgScore: number }> = {};
      agents.forEach((agent) => {
        if (!deptMap[agent.dept]) {
          deptMap[agent.dept] = { total: 0, running: 0, errored: 0, avgScore: 0 };
        }
        deptMap[agent.dept].total++;
        if (agent.status === 'running') deptMap[agent.dept].running++;
        if (agent.status === 'error') deptMap[agent.dept].errored++;
        deptMap[agent.dept].avgScore += agent.score;
      });
      const agentsByDepartment = Object.entries(deptMap).map(([dept, stats]) => ({
        dept,
        total: stats.total,
        running: stats.running,
        errored: stats.errored,
        avgScore: Math.round(stats.avgScore / stats.total),
        healthPct: Math.round(((stats.total - stats.errored) / stats.total) * 100),
      }));

      // Industry breakdown
      const allLeads = await prisma.lead.findMany({
        select: { branche: true, status: true },
        take: 1000,
      });
      const brancheStats: Record<string, { total: number; won: number }> = {};
      allLeads.forEach((lead) => {
        if (!brancheStats[lead.branche]) brancheStats[lead.branche] = { total: 0, won: 0 };
        brancheStats[lead.branche].total++;
        if (lead.status === 'Won') brancheStats[lead.branche].won++;
      });
      const industryBreakdown = Object.entries(brancheStats)
        .map(([branche, stats]) => ({
          branche,
          count: stats.total,
          wonCount: stats.won,
          conversionRate: stats.total > 0 ? (stats.won / stats.total) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top leads
      const topLeads = await prisma.lead.findMany({
        where: { status: { in: ['Interested', 'Meeting', 'Proposal', 'Negotiation'] } },
        orderBy: { leadScore: 'desc' },
        take: 10,
        select: {
          id: true, firma: true, kontakt: true, email: true,
          status: true, leadScore: true, umsatzpotenzial: true,
          branche: true, letzterKontakt: true,
        },
      });

      const result = {
        generatedAt: new Date().toISOString(),
        kpis: { ...kpis, totalRevenue: wonLeads.reduce((s, l) => s + l.umsatzpotenzial, 0) },
        pipeline: { stages: pipeline, totalInPipeline: pipeline.reduce((s, st) => s + st.count, 0) },
        agentHealth: {
          ...agentHealth,
          totalTasks: agentHealth.totalTasksToday,
          totalErrors: agentHealth.totalErrorsToday,
          healthPct: agentHealth.total > 0 ? Math.round(((agentHealth.total - agentHealth.errored) / agentHealth.total) * 100) : 100,
          byDepartment: agentsByDepartment,
        },
        nightShift: {
          totalTasks: nightTasks.length,
          completed: completedNightTasks,
          failed: failedNightTasks,
          successRate: Number(nightShiftSuccessRate.toFixed(2)),
          avgDuration: Math.round(avgNightShiftDuration),
        },
        topLeads: topLeads.map((lead) => ({
          ...lead,
          daysSinceContact: lead.letzterKontakt
            ? Math.floor((Date.now() - lead.letzterKontakt.getTime()) / (1000 * 60 * 60 * 24))
            : null,
        })),
        recentActivities: recentActivities.map((a) => ({
          id: a.id, type: a.type, details: a.details,
          firma: a.lead?.firma || 'Unknown',
          leadStatus: a.lead?.status || 'Unknown',
          createdAt: a.createdAt,
        })),
        industryBreakdown,
        pendingDecisions: decisions.length,
      };

      cache.set(cacheKey, result, CACHE_TTL);
      return NextResponse.json(result);
    }

    // --- "full" view (default): everything including notifications, agent logs, insights ---
    const [notifications, agentExecutions, agentsWithLogs] = await Promise.all([
      prisma.notification.findMany({
        where: { read: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.agentExecution.findMany({
        where: { completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 50,
        select: {
          durationMs: true, status: true, tokensUsed: true,
          agent: { select: { name: true, dept: true } },
        },
      }),
      prisma.agent.findMany({
        orderBy: [{ dept: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, dept: true, status: true,
          score: true, tasksToday: true, errorsToday: true, lastRun: true,
          logs: { orderBy: { createdAt: 'desc' }, take: 3 },
        },
      }),
    ]);

    // Agent performance
    const avgExecutionTime = agentExecutions.length > 0
      ? Math.round(agentExecutions.reduce((s, e) => s + (e.durationMs || 0), 0) / agentExecutions.length)
      : 0;
    const totalTokensUsed = agentExecutions.reduce((s, e) => s + e.tokensUsed, 0);
    const successfulExecs = agentExecutions.filter((e) => e.status === 'success').length;
    const successRate = agentExecutions.length > 0
      ? (successfulExecs / agentExecutions.length) * 100
      : 0;

    // Build insights
    const insights: Array<{ title: string; description: string; type: 'success' | 'warning' | 'info' | 'error'; priority: number }> = [];

    const newLeadCount = statusMap['New Lead'] || 0;
    if (newLeadCount > 50) {
      insights.push({ title: 'Hohe Anzahl neuer Leads', description: `${newLeadCount} neue Leads warten auf Bearbeitung. Eventuell zusätzliche Automatisierung aktivieren.`, type: 'warning', priority: 1 });
    }
    if (agentHealth.errored > 0) {
      insights.push({ title: 'Agenten mit Fehlern', description: `${agentHealth.errored} Agent(en) haben Fehler. Überprüfung empfohlen.`, type: 'error', priority: 0 });
    }
    if (conversionRate < 5) {
      insights.push({ title: 'Niedrige Conversion Rate', description: `Aktuelle Conversion Rate: ${conversionRate.toFixed(1)}%. Lead-Qualität oder Prozess optimieren.`, type: 'warning', priority: 2 });
    }
    if (decisions.length > 5) {
      insights.push({ title: 'Viele offene Entscheidungen', description: `${decisions.length} Entscheidungen warten auf Genehmigung.`, type: 'info', priority: 3 });
    }
    if (agentHealth.running > 0) {
      insights.push({ title: 'Agenten aktiv', description: `${agentHealth.running} Agent(en) arbeiten aktuell. System läuft optimal.`, type: 'success', priority: 4 });
    }
    insights.sort((a, b) => a.priority - b.priority);

    const result = {
      timestamp: new Date().toISOString(),
      cached: false,
      kpis,
      pipeline,
      agentHealth,
      agents: agentsWithLogs.map((a) => ({
        id: a.id, name: a.name, dept: a.dept, status: a.status,
        score: a.score, tasksToday: a.tasksToday, errorsToday: a.errorsToday,
        lastRun: a.lastRun, recentLogs: a.logs.slice(0, 3),
      })),
      agentPerformance: {
        avgExecutionTime, totalTokensUsed,
        successRate: Number(successRate.toFixed(1)),
        totalExecutions: agentExecutions.length,
      },
      recentTasks: nightTasks.filter((t) => t.status === 'done').slice(0, 5),
      pendingDecisions: decisions.slice(0, 5),
      recentActivities: recentActivities.slice(0, 10),
      notifications,
      unreadCount: notifications.length,
      insights: insights.slice(0, 5),
    };

    cache.set(cacheKey, result, CACHE_TTL);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
