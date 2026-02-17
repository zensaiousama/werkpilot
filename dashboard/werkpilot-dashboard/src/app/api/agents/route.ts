import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSharedCache } from '@/lib/cache';

const CACHE_TTL = 30_000; // 30 seconds

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const department = url.searchParams.get('dept');
  const status = url.searchParams.get('status');

  const cacheKey = `agents:list:${department || 'all'}:${status || 'all'}`;
  const cache = getSharedCache();
  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const where: Record<string, unknown> = {};
  if (department) where.dept = department;
  if (status) {
    const statuses = status.split(',');
    where.status = { in: statuses };
  }

  const agents = await prisma.agent.findMany({
    where,
    orderBy: [{ dept: 'asc' }, { name: 'asc' }],
    include: { logs: { orderBy: { createdAt: 'desc' }, take: 5 } },
  });

  cache.set(cacheKey, agents, CACHE_TTL);
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const agent = await prisma.agent.create({ data: body });
  return NextResponse.json(agent, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status, score } = body;

  if (!id) {
    return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (score !== undefined) updateData.score = score;

  const agent = await prisma.agent.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(agent);
}
