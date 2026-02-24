import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/* ------------------------------------------------------------------ */
/*  GET /api/analytics                                                 */
/*  Returns comprehensive analytics data from all modules              */
/* ------------------------------------------------------------------ */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const view = url.searchParams.get('view'); // 'overview' | 'sales' | 'mailing' | 'finance' | 'followup' | null (all)

    // Parallel data fetching
    const [
      leads,
      agents,
      campaigns,
      emailLogs,
      invoices,
      expenses,
      followUps,
    ] = await Promise.all([
      prisma.lead.findMany({ select: { id: true, status: true, branche: true, kanton: true, leadScore: true, fitnessScore: true, umsatzpotenzial: true, createdAt: true } }),
      prisma.agent.findMany({ select: { id: true, name: true, dept: true, status: true, score: true, tasksToday: true, errorsToday: true } }),
      prisma.campaign.findMany({ select: { id: true, name: true, status: true, sentCount: true, openCount: true, clickCount: true, bounceCount: true, createdAt: true } }),
      prisma.emailLog.findMany({ select: { id: true, status: true, createdAt: true } }),
      prisma.invoice.findMany({ select: { id: true, status: true, total: true, subtotal: true, vatAmount: true, createdAt: true, paidAt: true } }),
      prisma.expense.findMany({ select: { id: true, category: true, amount: true, date: true, recurring: true } }),
      prisma.followUp.findMany({ select: { id: true, type: true, status: true, priority: true, dueDate: true, completedAt: true, createdAt: true } }),
    ]);

    // ============================
    // SALES / CRM ANALYTICS
    // ============================
    const statusCounts: Record<string, number> = {};
    const brancheCounts: Record<string, number> = {};
    const kantonCounts: Record<string, number> = {};
    let totalLeadScore = 0;
    let totalFitnessScore = 0;

    for (const lead of leads) {
      statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
      brancheCounts[lead.branche] = (brancheCounts[lead.branche] || 0) + 1;
      kantonCounts[lead.kanton] = (kantonCounts[lead.kanton] || 0) + 1;
      totalLeadScore += lead.leadScore;
      totalFitnessScore += lead.fitnessScore;
    }

    const pipelineStages = ['New Lead', 'Researched', 'Fitness Check', 'Contacted', 'Interested', 'Meeting', 'Proposal', 'Negotiation', 'Won'];
    const funnelData = pipelineStages.map((stage) => ({
      stage,
      count: statusCounts[stage] || 0,
    }));

    const wonLeads = leads.filter((l) => l.status === 'Won' || l.status === 'Client');
    const activeClients = leads.filter((l) => l.status === 'Client').length;
    const mrr = wonLeads.reduce((sum, l) => sum + l.umsatzpotenzial, 0);
    const pipelineLeads = leads.filter((l) => !['Won', 'Client', 'Lost'].includes(l.status));
    const pipelineValue = pipelineLeads.reduce((sum, l) => sum + l.umsatzpotenzial, 0);

    // Conversion metrics
    const totalLeads = leads.length;
    const meetings = (statusCounts['Meeting'] || 0) + (statusCounts['Proposal'] || 0) + (statusCounts['Negotiation'] || 0) + wonLeads.length;
    const proposals = (statusCounts['Proposal'] || 0) + (statusCounts['Negotiation'] || 0) + wonLeads.length;
    const won = wonLeads.length;

    const conversionMetrics = {
      leadToMeeting: totalLeads > 0 ? Math.round((meetings / totalLeads) * 1000) / 10 : 0,
      meetingToProposal: meetings > 0 ? Math.round((proposals / meetings) * 1000) / 10 : 0,
      proposalToWon: proposals > 0 ? Math.round((won / proposals) * 1000) / 10 : 0,
      overallConversion: totalLeads > 0 ? Math.round((won / totalLeads) * 1000) / 10 : 0,
    };

    const salesAnalytics = {
      totalLeads,
      activeClients,
      mrr,
      pipelineValue,
      avgLeadScore: leads.length > 0 ? Math.round(totalLeadScore / leads.length) : 0,
      avgFitnessScore: leads.length > 0 ? Math.round(totalFitnessScore / leads.length) : 0,
      funnelData,
      conversionMetrics,
      byBranche: Object.entries(brancheCounts)
        .map(([branche, count]) => ({
          branche,
          count,
          revenue: leads.filter((l) => l.branche === branche && (l.status === 'Won' || l.status === 'Client')).reduce((s, l) => s + l.umsatzpotenzial, 0),
        }))
        .sort((a, b) => b.count - a.count),
      byKanton: Object.entries(kantonCounts)
        .map(([kanton, count]) => ({ kanton, count }))
        .sort((a, b) => b.count - a.count),
      byStatus: Object.entries(statusCounts)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
    };

    if (view === 'sales') return NextResponse.json(salesAnalytics);

    // ============================
    // MAILING ANALYTICS
    // ============================
    const emailStatusCounts: Record<string, number> = {};
    for (const email of emailLogs) {
      emailStatusCounts[email.status] = (emailStatusCounts[email.status] || 0) + 1;
    }

    const totalSent = (emailStatusCounts['sent'] || 0) + (emailStatusCounts['opened'] || 0) + (emailStatusCounts['clicked'] || 0);
    const totalOpened = (emailStatusCounts['opened'] || 0) + (emailStatusCounts['clicked'] || 0);
    const totalClicked = emailStatusCounts['clicked'] || 0;
    const totalBounced = emailStatusCounts['bounced'] || 0;

    const sentCampaigns = campaigns.filter((c) => c.status === 'sent');

    const mailingAnalytics = {
      totalCampaigns: campaigns.length,
      sentCampaigns: sentCampaigns.length,
      draftCampaigns: campaigns.filter((c) => c.status === 'draft').length,
      totalEmails: emailLogs.length,
      totalSent,
      totalOpened,
      totalClicked,
      totalBounced,
      openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 1000) / 10 : 0,
      clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 1000) / 10 : 0,
      bounceRate: emailLogs.length > 0 ? Math.round((totalBounced / emailLogs.length) * 1000) / 10 : 0,
      campaignPerformance: sentCampaigns.map((c) => ({
        name: c.name,
        sent: c.sentCount,
        opened: c.openCount,
        clicked: c.clickCount,
        bounced: c.bounceCount,
        openRate: c.sentCount > 0 ? Math.round((c.openCount / c.sentCount) * 100) : 0,
        clickRate: c.sentCount > 0 ? Math.round((c.clickCount / c.sentCount) * 100) : 0,
      })),
    };

    if (view === 'mailing') return NextResponse.json(mailingAnalytics);

    // ============================
    // FINANCE ANALYTICS
    // ============================
    const revenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0);
    const outstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0);
    const overdueAmount = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.total, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const recurringExpenses = expenses.filter((e) => e.recurring).reduce((s, e) => s + e.amount, 0);

    const expenseByCategory: Record<string, number> = {};
    for (const exp of expenses) {
      expenseByCategory[exp.category] = (expenseByCategory[exp.category] || 0) + exp.amount;
    }

    const financeAnalytics = {
      revenue,
      outstanding,
      overdueAmount,
      totalExpenses,
      recurringExpenses,
      profit: revenue - totalExpenses,
      profitMargin: revenue > 0 ? Math.round(((revenue - totalExpenses) / revenue) * 1000) / 10 : 0,
      invoiceCount: invoices.length,
      paidInvoices: invoices.filter((i) => i.status === 'paid').length,
      overdueInvoices: invoices.filter((i) => i.status === 'overdue').length,
      draftInvoices: invoices.filter((i) => i.status === 'draft').length,
      expenseByCategory: Object.entries(expenseByCategory)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      avgInvoiceAmount: invoices.length > 0 ? Math.round(invoices.reduce((s, i) => s + i.total, 0) / invoices.length) : 0,
    };

    if (view === 'finance') return NextResponse.json(financeAnalytics);

    // ============================
    // FOLLOW-UP ANALYTICS
    // ============================
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

    const fuStatusCounts: Record<string, number> = {};
    const fuTypeCounts: Record<string, number> = {};
    let dueToday = 0;
    let overdue = 0;
    let thisWeek = 0;

    for (const fu of followUps) {
      fuStatusCounts[fu.status] = (fuStatusCounts[fu.status] || 0) + 1;
      fuTypeCounts[fu.type] = (fuTypeCounts[fu.type] || 0) + 1;

      if (fu.status === 'pending') {
        const due = new Date(fu.dueDate);
        if (due < todayStart) overdue++;
        else if (due >= todayStart && due < new Date(todayStart.getTime() + 86400000)) dueToday++;
        if (due < weekEnd) thisWeek++;
      }
    }

    const completedFu = followUps.filter((f) => f.status === 'completed');
    const completionRate = followUps.length > 0 ? Math.round((completedFu.length / followUps.length) * 1000) / 10 : 0;

    // Avg completion time
    let totalCompletionMs = 0;
    let completionCount = 0;
    for (const fu of completedFu) {
      if (fu.completedAt) {
        totalCompletionMs += new Date(fu.completedAt).getTime() - new Date(fu.createdAt).getTime();
        completionCount++;
      }
    }
    const avgCompletionHours = completionCount > 0 ? Math.round(totalCompletionMs / completionCount / 3600000) : 0;

    const followUpAnalytics = {
      total: followUps.length,
      dueToday,
      overdue,
      thisWeek,
      completionRate,
      avgCompletionHours,
      byStatus: Object.entries(fuStatusCounts).map(([status, count]) => ({ status, count })),
      byType: Object.entries(fuTypeCounts).map(([type, count]) => ({ type, count })),
      byPriority: [1, 2, 3, 4, 5].map((p) => ({
        priority: p,
        count: followUps.filter((f) => f.priority === p).length,
      })),
    };

    if (view === 'followup') return NextResponse.json(followUpAnalytics);

    // ============================
    // AGENT ANALYTICS
    // ============================
    const agentAnalytics = {
      total: agents.length,
      running: agents.filter((a) => a.status === 'running').length,
      idle: agents.filter((a) => a.status === 'idle').length,
      errored: agents.filter((a) => a.status === 'error').length,
      avgScore: agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.score, 0) / agents.length) : 0,
      totalTasksToday: agents.reduce((s, a) => s + a.tasksToday, 0),
      totalErrorsToday: agents.reduce((s, a) => s + a.errorsToday, 0),
      topAgents: [...agents].sort((a, b) => b.score - a.score).slice(0, 10).map((a) => ({
        name: a.name,
        department: a.dept,
        score: a.score,
        tasksToday: a.tasksToday,
        status: a.status,
      })),
      byDepartment: Object.entries(
        agents.reduce<Record<string, { count: number; avgScore: number; totalTasks: number }>>((acc, a) => {
          if (!acc[a.dept]) acc[a.dept] = { count: 0, avgScore: 0, totalTasks: 0 };
          acc[a.dept].count++;
          acc[a.dept].avgScore += a.score;
          acc[a.dept].totalTasks += a.tasksToday;
          return acc;
        }, {})
      ).map(([dept, data]) => ({
        department: dept,
        count: data.count,
        avgScore: Math.round(data.avgScore / data.count),
        totalTasks: data.totalTasks,
      })).sort((a, b) => b.avgScore - a.avgScore),
    };

    // ============================
    // FULL OVERVIEW
    // ============================
    return NextResponse.json({
      sales: salesAnalytics,
      mailing: mailingAnalytics,
      finance: financeAnalytics,
      followUp: followUpAnalytics,
      agents: agentAnalytics,
      summary: {
        mrr,
        pipelineValue,
        totalLeads,
        activeClients,
        conversionRate: conversionMetrics.overallConversion,
        revenue,
        profit: revenue - totalExpenses,
        emailsSent: totalSent,
        openRate: mailingAnalytics.openRate,
        followUpsDue: dueToday + overdue,
        agentHealth: agentAnalytics.avgScore,
      },
    });
  } catch (error) {
    console.error('Analytics GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
