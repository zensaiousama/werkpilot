import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSharedCache } from '@/lib/cache';
import { HOT_LEAD_STATUSES, MRR_PER_CLIENT } from '@/lib/constants';
import { calcPipelineVelocity } from '@/lib/dashboard-helpers';

const CACHE_KEY = 'ai:insights';
const CACHE_TTL = 60_000; // 60 seconds (aligned with dashboard cache strategy)

interface Insight {
  id: string;
  type: 'positive' | 'warning' | 'suggestion';
  title: string;
  description: string;
  action?: string;
  actionHref?: string;
}

/**
 * AI Insights endpoint — generates data-driven insights
 * Analyzes leads, agents, and night shift data to provide actionable recommendations
 */
export async function GET() {
  const cache = getSharedCache();
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const [leads, agents, nightTasks, activities] = await Promise.all([
      prisma.lead.findMany({
        select: {
          id: true,
          status: true,
          leadScore: true,
          branche: true,
          createdAt: true,
          updatedAt: true,
          umsatzpotenzial: true,
          letzterKontakt: true,
        },
        take: 1000,
      }),
      prisma.agent.findMany({
        select: { status: true, score: true, errorsToday: true, tasksToday: true, dept: true },
      }),
      prisma.nightShiftTask.findMany({
        select: { status: true, startedAt: true, completedAt: true },
      }),
      prisma.activity.findMany({
        select: { leadId: true, type: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const insights: Insight[] = [];

    // 1. Hot leads analysis with real data
    const hotLeads = leads.filter((l) => (HOT_LEAD_STATUSES as readonly string[]).includes(l.status));
    const avgHotScore = hotLeads.length > 0
      ? Math.round(hotLeads.reduce((s, l) => s + l.leadScore, 0) / hotLeads.length)
      : 0;
    const hotPipelineValue = hotLeads.reduce((sum, l) => sum + l.umsatzpotenzial, 0);

    if (hotLeads.length > 0) {
      insights.push({
        id: 'pipeline',
        type: 'positive',
        title: `${hotLeads.length} heisse Leads im Wert von CHF ${(hotPipelineValue / 1000).toFixed(0)}k`,
        description: `Durchschnittlicher Score: ${avgHotScore}/100. Diese Leads befinden sich in fortgeschrittenen Phasen und sollten priorisiert werden.`,
        action: 'CRM öffnen',
        actionHref: '/crm',
      });
    }

    // 2. Stale leads (no contact in 14+ days) with real data
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const staleLeads = leads.filter(
      (l) =>
        ['Contacted', 'Interested', 'Meeting'].includes(l.status) &&
        (!l.letzterKontakt || l.letzterKontakt < fourteenDaysAgo)
    );

    if (staleLeads.length > 0) {
      insights.push({
        id: 'stale',
        type: 'warning',
        title: `${staleLeads.length} Leads ohne Follow-up (14+ Tage)`,
        description: `Diese Leads könnten kalt werden. Durchschnittlicher Score: ${Math.round(staleLeads.reduce((s, l) => s + l.leadScore, 0) / staleLeads.length)}/100. Empfehlung: Sofort Follow-up durchführen.`,
        action: 'Leads anzeigen',
        actionHref: '/crm?filter=stale',
      });
    }

    // 3. Agent health analysis with detailed metrics
    const erroredAgents = agents.filter((a) => a.status === 'error');
    const totalTasks = agents.reduce((sum, a) => sum + a.tasksToday, 0);
    const totalErrors = agents.reduce((sum, a) => sum + a.errorsToday, 0);
    const errorRate = totalTasks > 0 ? (totalErrors / totalTasks) * 100 : 0;

    if (erroredAgents.length > 0 || errorRate > 5) {
      const depts = [...new Set(erroredAgents.map((a) => a.dept))].join(', ');
      insights.push({
        id: 'agents',
        type: 'warning',
        title: `${erroredAgents.length} Agent(s) mit Fehlern (${errorRate.toFixed(1)}% Error Rate)`,
        description: `Betroffene Abteilungen: ${depts || 'N/A'}. ${totalErrors} Fehler bei ${totalTasks} Tasks. Bitte überprüfen Sie die Logs.`,
        action: 'Agents prüfen',
        actionHref: '/agents',
      });
    }

    // 4. Industry analysis with conversion insights
    const brancheCounts: Record<string, { count: number; won: number; total: number }> = {};
    leads.forEach((l) => {
      if (!brancheCounts[l.branche]) {
        brancheCounts[l.branche] = { count: 0, won: 0, total: 0 };
      }
      brancheCounts[l.branche].count++;
      brancheCounts[l.branche].total++;
      if (l.status === 'Won') brancheCounts[l.branche].won++;
    });

    const topBranche = Object.entries(brancheCounts)
      .map(([branche, stats]) => ({
        branche,
        count: stats.count,
        conversionRate: stats.total > 0 ? (stats.won / stats.total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)[0];

    if (topBranche && topBranche.count > 5) {
      insights.push({
        id: 'branche',
        type: 'suggestion',
        title: `Top-Branche: ${topBranche.branche} (${Math.round((topBranche.count / leads.length) * 100)}%)`,
        description: `Conversion Rate: ${topBranche.conversionRate.toFixed(1)}%. Empfehlung: Verstärken Sie das Scraping in dieser Branche.`,
        action: 'Scraper öffnen',
        actionHref: '/scraper',
      });
    }

    // 5. Night shift efficiency with real metrics
    const completedTasks = nightTasks.filter((t) => t.status === 'done').length;
    const failedTasks = nightTasks.filter((t) => t.status === 'failed').length;
    const totalNightTasks = completedTasks + failedTasks;

    if (totalNightTasks > 0) {
      const successRate = Math.round((completedTasks / totalNightTasks) * 100);
      const avgDuration =
        nightTasks.filter((t) => t.startedAt && t.completedAt).length > 0
          ? nightTasks
              .filter((t) => t.startedAt && t.completedAt)
              .reduce((sum, t) => {
                if (t.startedAt && t.completedAt) {
                  return sum + (t.completedAt.getTime() - t.startedAt.getTime());
                }
                return sum;
              }, 0) /
            nightTasks.filter((t) => t.startedAt && t.completedAt).length /
            1000
          : 0;

      insights.push({
        id: 'nightshift',
        type: successRate >= 80 ? 'positive' : 'warning',
        title: `Night Shift: ${successRate}% Erfolgsrate`,
        description: `${completedTasks}/${totalNightTasks} Tasks erfolgreich. Durchschnittliche Dauer: ${Math.round(avgDuration)}s. ${successRate < 80 ? 'Optimieren Sie die Task-Konfiguration.' : 'Gute Performance!'}`,
        action: 'Night Shift',
        actionHref: '/nightshift',
      });
    }

    // 6. Pipeline velocity insight
    const wonLeads = leads.filter((l) => l.status === 'Won');
    if (wonLeads.length >= 3) {
      const avgDaysToWin = calcPipelineVelocity(wonLeads);

      insights.push({
        id: 'velocity',
        type: 'suggestion',
        title: `Sales Cycle: ${Math.round(avgDaysToWin)} Tage im Durchschnitt`,
        description: `Basierend auf ${wonLeads.length} gewonnenen Deals. ${avgDaysToWin > 30 ? 'Empfehlung: Verkürzen Sie den Zyklus durch proaktivere Follow-ups.' : 'Sehr gute Geschwindigkeit!'}`,
        action: 'Analytics',
        actionHref: '/analytics',
      });
    }

    // Fallback if no insights
    if (insights.length === 0) {
      insights.push({
        id: 'default',
        type: 'suggestion',
        title: 'Daten sammeln',
        description: 'Importieren Sie Leads über den Scraper, um personalisierte AI-Insights zu erhalten.',
        action: 'Scraper öffnen',
        actionHref: '/scraper',
      });
    }

    const result = { insights };
    cache.set(CACHE_KEY, result, CACHE_TTL);
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI Insights error:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
