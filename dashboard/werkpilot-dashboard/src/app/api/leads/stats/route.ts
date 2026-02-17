import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  const [total, byStatus, byBranche, byKanton] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ['status'], _count: true }),
    prisma.lead.groupBy({ by: ['branche'], _count: true, orderBy: { _count: { branche: 'desc' } }, take: 10 }),
    prisma.lead.groupBy({ by: ['kanton'], _count: true, orderBy: { _count: { kanton: 'desc' } }, take: 10 }),
  ]);

  const pipelineValue = await prisma.lead.aggregate({
    where: { status: { not: 'Lost' } },
    _sum: { umsatzpotenzial: true },
  });

  const avgScore = await prisma.lead.aggregate({ _avg: { leadScore: true, fitnessScore: true } });

  return NextResponse.json({
    total,
    pipelineValue: pipelineValue._sum.umsatzpotenzial || 0,
    avgLeadScore: Math.round(avgScore._avg.leadScore || 0),
    avgFitnessScore: Math.round(avgScore._avg.fitnessScore || 0),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byBranche: byBranche.map((b) => ({ branche: b.branche, count: b._count })),
    byKanton: byKanton.map((k) => ({ kanton: k.kanton, count: k._count })),
  });
}
