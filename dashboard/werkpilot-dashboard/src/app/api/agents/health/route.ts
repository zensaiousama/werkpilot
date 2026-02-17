import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSharedCache } from '@/lib/cache';

const CACHE_KEY = 'agents:health';
const CACHE_TTL = 30_000; // 30 seconds

export async function GET() {
  const cache = getSharedCache();
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  const agents = await prisma.agent.findMany();
  const total = agents.length;
  const running = agents.filter((a) => a.status === 'running').length;
  const idle = agents.filter((a) => a.status === 'idle').length;
  const errored = agents.filter((a) => a.status === 'error').length;
  const avgScore = total > 0 ? Math.round(agents.reduce((s, a) => s + a.score, 0) / total) : 0;
  const totalTasks = agents.reduce((s, a) => s + a.tasksToday, 0);
  const totalErrors = agents.reduce((s, a) => s + a.errorsToday, 0);

  // Department-level breakdown
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

  const departments = Object.entries(deptMap).map(([dept, stats]) => ({
    dept,
    total: stats.total,
    running: stats.running,
    errored: stats.errored,
    avgScore: Math.round(stats.avgScore / stats.total),
    healthPct: Math.round(((stats.total - stats.errored) / stats.total) * 100),
  }));

  // Uptime percentage: Calculate based on agents that have run before
  const agentsWithLastRun = agents.filter((a) => a.lastRun !== null);
  const uptime = agentsWithLastRun.length > 0
    ? Math.round(((agentsWithLastRun.length - errored) / agentsWithLastRun.length) * 100)
    : 100;

  // Alert thresholds
  const alerts = [];
  if (errored > 0) {
    alerts.push({
      level: 'critical',
      message: `${errored} agent(s) in error state`,
      threshold: 0,
    });
  }
  if (avgScore < 50) {
    alerts.push({
      level: 'warning',
      message: `Average score below 50: ${avgScore}`,
      threshold: 50,
    });
  }
  if (totalErrors > totalTasks * 0.1) {
    alerts.push({
      level: 'warning',
      message: `Error rate above 10%: ${Math.round((totalErrors / (totalTasks || 1)) * 100)}%`,
      threshold: 10,
    });
  }

  const result = {
    total,
    running,
    idle,
    errored,
    avgScore,
    totalTasks,
    totalErrors,
    healthPct: total > 0 ? Math.round(((total - errored) / total) * 100) : 100,
    uptime,
    departments,
    alerts,
  };

  cache.set(CACHE_KEY, result, CACHE_TTL);
  return NextResponse.json(result);
}
