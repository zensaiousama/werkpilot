import { PIPELINE_STAGES } from './constants';

/** Build { stage, count } array from Prisma groupBy result */
export function buildStatusMap(leadsByStatus: { status: string; _count: number }[]) {
  const map: Record<string, number> = {};
  leadsByStatus.forEach((s) => { map[s.status] = s._count; });
  return map;
}

export function buildPipeline(statusMap: Record<string, number>) {
  return PIPELINE_STAGES.map((stage) => ({ stage, count: statusMap[stage] || 0 }));
}

/** Average days from creation to status change for won leads */
export function calcPipelineVelocity(wonLeads: { createdAt: Date; updatedAt: Date }[]) {
  if (wonLeads.length === 0) return 0;
  const totalDays = wonLeads.reduce((sum, l) => {
    return sum + (l.updatedAt.getTime() - l.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  }, 0);
  return totalDays / wonLeads.length;
}

/** Agent health summary from agent array */
export function calcAgentHealth(agents: { status: string; score: number; tasksToday: number; errorsToday: number }[]) {
  return {
    total: agents.length,
    running: agents.filter((a) => a.status === 'running').length,
    idle: agents.filter((a) => a.status === 'idle').length,
    errored: agents.filter((a) => a.status === 'error').length,
    avgScore: agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.score, 0) / agents.length) : 0,
    totalTasksToday: agents.reduce((s, a) => s + a.tasksToday, 0),
    totalErrorsToday: agents.reduce((s, a) => s + a.errorsToday, 0),
  };
}
