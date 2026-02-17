import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSharedCache } from '@/lib/cache';

const CACHE_TTL = 10_000; // 10 seconds

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const status = url.searchParams.get('status');
  const priority = url.searchParams.get('priority');

  const cacheKey = `nightshift:list:${status || 'all'}:${priority || 'all'}`;
  const cache = getSharedCache();
  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const where: Record<string, unknown> = {};
  if (status) {
    const statuses = status.split(',');
    where.status = { in: statuses };
  }
  if (priority) {
    where.priority = parseInt(priority);
  }

  const [tasks, stats] = await Promise.all([
    prisma.nightShiftTask.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.nightShiftTask.findMany({
      where: { status: { in: ['done', 'failed'] }, startedAt: { not: null }, completedAt: { not: null } },
      select: { status: true, startedAt: true, completedAt: true },
    }),
  ]);

  // Calculate execution statistics
  const completedTasks = stats.filter((t) => t.status === 'done');
  const failedTasks = stats.filter((t) => t.status === 'failed');
  const avgDuration = completedTasks.length > 0
    ? completedTasks.reduce((sum, task) => {
        if (task.startedAt && task.completedAt) {
          return sum + (task.completedAt.getTime() - task.startedAt.getTime());
        }
        return sum;
      }, 0) / completedTasks.length / 1000 // Convert to seconds
    : 0;
  const successRate = stats.length > 0
    ? (completedTasks.length / stats.length) * 100
    : 0;

  const result = {
    tasks,
    stats: {
      total: stats.length,
      completed: completedTasks.length,
      failed: failedTasks.length,
      avgDuration: Math.round(avgDuration),
      successRate: Number(successRate.toFixed(2)),
    },
  };

  cache.set(cacheKey, result, CACHE_TTL);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const task = await prisma.nightShiftTask.create({
    data: {
      task: body.task,
      priority: body.priority || 1,
    },
  });
  return NextResponse.json(task, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status, output } = body;

  if (!id) {
    return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) {
    updateData.status = status;
    if (status === 'running' && !body.startedAt) {
      updateData.startedAt = new Date();
    }
    if ((status === 'done' || status === 'failed') && !body.completedAt) {
      updateData.completedAt = new Date();
    }
  }
  if (output !== undefined) updateData.output = output;

  const task = await prisma.nightShiftTask.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(task);
}
