import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();

    // --- Parallel queries ---
    const [qualifiedProposalLeads, wonLeads, totalLeadCount, paidInvoices] = await Promise.all([
      // Pipeline value: sum umsatzpotenzial for Qualified + Proposal leads
      prisma.lead.aggregate({
        where: { status: { in: ['Qualified', 'Proposal'] } },
        _sum: { umsatzpotenzial: true },
      }),
      // Won leads for avg deal size + conversion rate
      prisma.lead.findMany({
        where: { status: 'Won' },
        select: { umsatzpotenzial: true },
      }),
      // Total leads for conversion rate
      prisma.lead.count(),
      // Paid invoices for monthly trend (last 6 months)
      prisma.invoice.findMany({
        where: {
          status: 'paid',
          paidAt: {
            gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
          },
        },
        select: { total: true, paidAt: true },
      }),
    ]);

    // Pipeline value
    const pipelineValue = qualifiedProposalLeads._sum.umsatzpotenzial ?? 0;

    // Average deal size from won leads
    const avgDealSize =
      wonLeads.length > 0
        ? Math.round(
            wonLeads.reduce((sum, l) => sum + l.umsatzpotenzial, 0) / wonLeads.length,
          )
        : 0;

    // Conversion rate
    const conversionRate =
      totalLeadCount > 0
        ? Number(((wonLeads.length / totalLeadCount) * 100).toFixed(1))
        : 0;

    // Monthly trend: last 6 months revenue from paid invoices
    const monthlyTrend: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthTotal = paidInvoices
        .filter((inv) => {
          if (!inv.paidAt) return false;
          const paid = new Date(inv.paidAt);
          return paid >= monthStart && paid < monthEnd;
        })
        .reduce((sum, inv) => sum + inv.total, 0);
      monthlyTrend.push(Math.round(monthTotal));
    }

    // Projected revenue: pipeline value * conversion rate
    const projectedRevenue = Math.round(pipelineValue * (conversionRate / 100));

    // Confidence level based on won deals count
    const wonCount = wonLeads.length;
    const confidence: 'hoch' | 'mittel' | 'niedrig' =
      wonCount >= 20 ? 'hoch' : wonCount >= 5 ? 'mittel' : 'niedrig';

    return NextResponse.json({
      pipelineValue,
      avgDealSize,
      conversionRate,
      projectedRevenue,
      confidence,
      monthlyTrend,
    });
  } catch (error) {
    console.error('Error fetching forecast data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch forecast data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
