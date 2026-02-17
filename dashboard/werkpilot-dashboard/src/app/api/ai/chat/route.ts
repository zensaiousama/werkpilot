import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * AI Chat endpoint — provides context-aware responses
 * In production, this would call the Anthropic API with dashboard context
 * For now, it generates intelligent responses based on actual database data
 */
export async function POST(request: Request) {
  try {
    const { message, history } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const lower = message.toLowerCase();

    // Gather comprehensive context from database
    const [
      leadCount,
      leadStats,
      agentCount,
      agents,
      nightTasks,
      topLeads,
      recentActivities,
      agentErrors,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({ by: ['status'], _count: true }),
      prisma.agent.count(),
      prisma.agent.findMany({ select: { name: true, dept: true, status: true, score: true, errorsToday: true } }),
      prisma.nightShiftTask.count({ where: { status: 'done' } }),
      prisma.lead.findMany({
        where: { status: { in: ['Interested', 'Meeting', 'Proposal'] } },
        orderBy: { leadScore: 'desc' },
        take: 5,
        select: { firma: true, status: true, leadScore: true, umsatzpotenzial: true },
      }),
      prisma.activity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { type: true, details: true, createdAt: true, lead: { select: { firma: true } } },
      }),
      prisma.agentLog.findMany({
        where: { level: 'error' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { message: true, agent: { select: { name: true } } },
      }),
    ]);

    // Build system context for better responses
    const systemContext = {
      totalLeads: leadCount,
      statusBreakdown: leadStats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      totalAgents: agentCount,
      runningAgents: agents.filter((a) => a.status === 'running').length,
      erroredAgents: agents.filter((a) => a.status === 'error').length,
      avgAgentScore: agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.score, 0) / agents.length) : 0,
      completedNightTasks: nightTasks,
      topLeads: topLeads.map((l) => ({ firma: l.firma, score: l.leadScore })),
      recentErrors: agentErrors.map((e) => ({ agent: e.agent.name, error: e.message })),
    };

    // Context-aware response generation with conversation history support
    let response: string;

    // Check if user is asking a follow-up question
    const isFollowUp = history && Array.isArray(history) && history.length > 0;

    if (lower.includes('lead') || lower.includes('crm') || lower.includes('pipeline')) {
      const statusSummary = leadStats.map((s) => `${s.status}: ${s._count}`).join(', ');
      const hotLeads = topLeads.length;
      const avgHotScore = hotLeads > 0 ? Math.round(topLeads.reduce((s, l) => s + l.leadScore, 0) / hotLeads) : 0;
      const topLeadsList = topLeads.map((l, i) => `${i + 1}. ${l.firma} (Score: ${l.leadScore})`).join('\n');

      response = `CRM-Daten im Überblick:\n\n• Gesamt: ${leadCount} Leads\n• Status-Verteilung: ${statusSummary}\n\nTop 5 heisse Leads (Ø Score: ${avgHotScore}):\n${topLeadsList}\n\nEmpfehlung: Fokussieren Sie sich auf diese Top-Leads — sie haben die höchste Konversionswahrscheinlichkeit.`;
    } else if (lower.includes('agent') || lower.includes('system') || lower.includes('health')) {
      const running = agents.filter((a) => a.status === 'running').length;
      const errored = agents.filter((a) => a.status === 'error').length;
      const avgScore = systemContext.avgAgentScore;
      const totalErrors = agents.reduce((sum, a) => sum + a.errorsToday, 0);
      const errorList =
        agentErrors.length > 0
          ? '\n\nLetzte Fehler:\n' + agentErrors.map((e) => `• ${e.agent.name}: ${e.message}`).join('\n')
          : '';

      response = `System Health Report:\n\n• ${agentCount} Agents total\n• ${running} running, ${errored} mit Fehlern\n• Durchschnittlicher Score: ${avgScore}/100\n• Fehler heute: ${totalErrors}${errorList}\n\n${errored > 0 ? `⚠️ ${errored} Agent(s) zeigen Fehler. Bitte überprüfen Sie die Agent-Logs.` : '✅ Alle Systeme funktionieren normal.'}`;
    } else if (lower.includes('night') || lower.includes('nacht') || lower.includes('shift')) {
      const nightStats = await prisma.nightShiftTask.groupBy({
        by: ['status'],
        _count: true,
      });
      const nightSummary = nightStats.map((s) => `${s.status}: ${s._count}`).join(', ');

      response = `Night Shift Status:\n\n• ${nightTasks} Tasks erfolgreich abgeschlossen\n• Status-Verteilung: ${nightSummary}\n• System bereit für die nächste Night Shift\n\nVorschläge für heute Nacht:\n1. Agent-Logs reviewen und Fehler beheben\n2. Lead-Scoring aktualisieren\n3. CRM-Daten bereinigen\n4. Pipeline-Berichte generieren`;
    } else if (lower.includes('revenue') || lower.includes('umsatz') || lower.includes('mrr')) {
      const wonLeads = await prisma.lead.findMany({
        where: { status: 'Won' },
        select: { umsatzpotenzial: true },
      });
      const clientLeads = await prisma.lead.count({ where: { status: 'Client' } });
      const pipelineValue = await prisma.lead.aggregate({
        where: { status: { notIn: ['Lost', 'New Lead'] } },
        _sum: { umsatzpotenzial: true },
      });
      const totalRevenue = wonLeads.reduce((sum, l) => sum + l.umsatzpotenzial, 0);
      const avgDealSize = wonLeads.length > 0 ? totalRevenue / wonLeads.length : 0;

      response = `Revenue-Analyse:\n\n• ${wonLeads.length} gewonnene Deals\n• ${clientLeads} aktive Kunden\n• Total Revenue: CHF ${(totalRevenue / 1000).toFixed(0)}k\n• Avg Deal Size: CHF ${Math.round(avgDealSize)}\n• Pipeline-Wert: CHF ${((pipelineValue._sum.umsatzpotenzial || 0) / 1000).toFixed(0)}k\n\nEmpfehlung: Konzentrieren Sie Ihre Akquise auf hochwertige Leads mit hohem Umsatzpotenzial.`;
    } else if (lower.includes('activity') || lower.includes('aktivität')) {
      const activitySummary = recentActivities
        .map((a, i) => `${i + 1}. ${a.lead?.firma || 'N/A'}: ${a.type} - ${a.details || 'No details'}`)
        .join('\n');

      response = `Letzte Aktivitäten:\n\n${activitySummary}\n\nTipp: Regelmäßige Aktivitäten steigern die Conversion Rate erheblich.`;
    } else {
      // Default comprehensive overview
      const topLeadsList = topLeads.slice(0, 3).map((l, i) => `${i + 1}. ${l.firma} (Score: ${l.leadScore})`).join('\n');

      response = `Dashboard-Zusammenfassung:\n\n📊 CRM:\n• ${leadCount} Leads\n• Top Leads:\n${topLeadsList}\n\n🤖 Agents:\n• ${agentCount} aktiv (${systemContext.runningAgents} running)\n• Avg Score: ${systemContext.avgAgentScore}/100\n\n🌙 Night Shift:\n• ${nightTasks} Tasks abgeschlossen\n\nIch kann Ihnen bei folgenden Themen helfen:\n- Lead-Analyse & CRM\n- Agent-Monitoring\n- Night Shift Optimierung\n- Revenue & Pipeline\n- Aktivitäten-Tracking\n\nWas möchten Sie genauer wissen?`;
    }

    return NextResponse.json({
      response,
      context: systemContext,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }
}
