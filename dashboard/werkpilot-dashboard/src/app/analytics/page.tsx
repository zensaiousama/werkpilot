'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Users,
  MapPin,
  Calendar,
  Award,
  Briefcase,
  Mail,
  Receipt,
  RotateCcw,
  Send,
  Eye,
  MousePointer,
  AlertTriangle,
  Clock,
  Check,
  BarChart3,
  Bot,
  Filter,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';
import MiniBarChart, { DonutChart } from '@/components/MiniBarChart';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface AnalyticsData {
  sales: {
    totalLeads: number;
    activeClients: number;
    mrr: number;
    pipelineValue: number;
    avgLeadScore: number;
    avgFitnessScore: number;
    funnelData: { stage: string; count: number }[];
    conversionMetrics: {
      leadToMeeting: number;
      meetingToProposal: number;
      proposalToWon: number;
      overallConversion: number;
    };
    byBranche: { branche: string; count: number; revenue: number }[];
    byKanton: { kanton: string; count: number }[];
    byStatus: { status: string; count: number }[];
  };
  mailing: {
    totalCampaigns: number;
    sentCampaigns: number;
    totalEmails: number;
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    campaignPerformance: {
      name: string;
      sent: number;
      opened: number;
      clicked: number;
      bounced: number;
      openRate: number;
      clickRate: number;
    }[];
  };
  finance: {
    revenue: number;
    outstanding: number;
    overdueAmount: number;
    totalExpenses: number;
    recurringExpenses: number;
    profit: number;
    profitMargin: number;
    invoiceCount: number;
    paidInvoices: number;
    overdueInvoices: number;
    draftInvoices: number;
    expenseByCategory: { category: string; amount: number }[];
    avgInvoiceAmount: number;
  };
  followUp: {
    total: number;
    dueToday: number;
    overdue: number;
    thisWeek: number;
    completionRate: number;
    avgCompletionHours: number;
    byStatus: { status: string; count: number }[];
    byType: { type: string; count: number }[];
    byPriority: { priority: number; count: number }[];
  };
  agents: {
    total: number;
    running: number;
    idle: number;
    errored: number;
    avgScore: number;
    totalTasksToday: number;
    totalErrorsToday: number;
    topAgents: { name: string; department: string; score: number; tasksToday: number; status: string }[];
    byDepartment: { department: string; count: number; avgScore: number; totalTasks: number }[];
  };
  summary: {
    mrr: number;
    pipelineValue: number;
    totalLeads: number;
    activeClients: number;
    conversionRate: number;
    revenue: number;
    profit: number;
    emailsSent: number;
    openRate: number;
    followUpsDue: number;
    agentHealth: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatCHF(value: number): string {
  if (value >= 1000) return `CHF ${(value / 1000).toFixed(1)}k`;
  return `CHF ${value.toLocaleString('de-CH')}`;
}

/* ------------------------------------------------------------------ */
/*  Sub-Components                                                     */
/* ------------------------------------------------------------------ */

function SummaryKPI({
  label,
  value,
  icon: Icon,
  color,
  subtext,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtext?: string;
}) {
  return (
    <div className="card-glass-premium p-5 hover-lift">
      <div className="flex items-start justify-between mb-3">
        <div
          className="p-2.5 rounded-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
        >
          <Icon size={20} />
        </div>
      </div>
      <p
        className="text-xs mb-1.5 uppercase tracking-wider"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color }}>
        {value}
      </p>
      {subtext && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{subtext}</p>
      )}
    </div>
  );
}

function HorizontalBar({
  label,
  value,
  maxValue,
  color,
  suffix,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  suffix?: string;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color, fontFamily: 'var(--font-mono)' }}>
          {suffix ? `${value.toLocaleString('de-CH')} ${suffix}` : value.toLocaleString('de-CH')}
        </span>
      </div>
      <div className="h-7 rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
        <div
          className="h-full rounded-lg transition-all duration-700"
          style={{
            width: `${Math.max(pct, 2)}%`,
            backgroundColor: color,
            opacity: 0.8,
          }}
        />
      </div>
    </div>
  );
}

function RingChart({
  value,
  label,
  color,
  size = 80,
}: {
  value: number;
  label: string;
  color: string;
  size?: number;
}) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color, lineHeight: 1 }}>
            {value.toFixed(1)}%
          </span>
        </div>
      </div>
      <span className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Conversion Funnel                                                  */
/* ------------------------------------------------------------------ */

/** Color for each funnel stage – gradient from blue to green */
const FUNNEL_COLORS = [
  '#60a5fa', // New Lead        – blue
  '#6daafc', // Researched
  '#7ab0fd', // Fitness Check
  '#7db8f4', // Contacted
  '#6dc7c0', // Interested
  '#4dbd8e', // Meeting
  '#34c06e', // Proposal
  '#2ac45e', // Negotiation
  '#22c55e', // Won             – green
];

function ConversionFunnel({
  funnelData,
  overallConversion,
}: {
  funnelData: { stage: string; count: number }[];
  overallConversion: number;
}) {
  const [animated, setAnimated] = useState(false);
  const maxCount = Math.max(...funnelData.map((s) => s.count), 1);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="card-glass-premium p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-lg"
            style={{ backgroundColor: 'var(--blue-glow)', color: 'var(--blue)' }}
          >
            <Filter size={18} />
          </div>
          <div>
            <h3
              className="text-xs font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              Conversion Funnel
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Pipeline-Stufen von New Lead bis Won
            </p>
          </div>
        </div>
        {/* Overall conversion badge */}
        <div
          className="flex flex-col items-center px-4 py-2.5 rounded-xl"
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
          }}
        >
          <span
            className="text-xl font-bold tabular-nums leading-none"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
          >
            {overallConversion}%
          </span>
          <span className="text-[10px] mt-1 font-medium" style={{ color: 'var(--green)' }}>
            Gesamt-Conversion
          </span>
        </div>
      </div>

      {/* Funnel visualization */}
      <div className="space-y-2">
        {funnelData.map((stage, idx) => {
          const widthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
          const prevCount = idx > 0 ? funnelData[idx - 1].count : 0;
          const conversionFromPrev =
            idx > 0 && prevCount > 0
              ? Math.round((stage.count / prevCount) * 1000) / 10
              : null;
          const color = FUNNEL_COLORS[idx] || FUNNEL_COLORS[FUNNEL_COLORS.length - 1];
          const isLast = idx === funnelData.length - 1;

          return (
            <div key={stage.stage}>
              <div className="flex items-center gap-3">
                {/* Stage label */}
                <div className="w-28 shrink-0 text-right">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: isLast ? 'var(--green)' : 'var(--text)', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {stage.stage}
                  </span>
                </div>

                {/* Bar container */}
                <div className="flex-1 relative">
                  <div
                    className="h-9 rounded-lg overflow-hidden relative"
                    style={{ backgroundColor: 'rgba(255,255,255,0.025)' }}
                  >
                    {/* Animated bar */}
                    <div
                      className="h-full rounded-lg relative"
                      style={{
                        width: animated ? `${Math.max(widthPct, 3)}%` : '0%',
                        background: `linear-gradient(90deg, ${color}, ${color}dd)`,
                        transition: `width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 80}ms`,
                        boxShadow: `0 0 12px ${color}33, 0 0 4px ${color}22`,
                      }}
                    >
                      {/* Glow top line */}
                      <div
                        className="absolute top-0 left-0 right-0 h-px"
                        style={{ background: `linear-gradient(90deg, ${color}88, transparent)` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Count */}
                <div className="w-14 shrink-0 text-right">
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color }}
                  >
                    {stage.count.toLocaleString('de-CH')}
                  </span>
                </div>

                {/* Conversion rate from previous stage */}
                <div className="w-16 shrink-0 text-right">
                  {conversionFromPrev !== null ? (
                    <span
                      className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: conversionFromPrev >= 70 ? 'var(--green)' : conversionFromPrev >= 40 ? 'var(--amber)' : 'var(--red)',
                        backgroundColor:
                          conversionFromPrev >= 70
                            ? 'rgba(34,197,94,0.1)'
                            : conversionFromPrev >= 40
                              ? 'rgba(245,158,11,0.1)'
                              : 'rgba(239,68,68,0.1)',
                      }}
                    >
                      {conversionFromPrev}%
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Start
                    </span>
                  )}
                </div>
              </div>

              {/* Connector arrow between stages */}
              {!isLast && (
                <div className="flex items-center ml-28 pl-3 py-0.5">
                  <ChevronRight
                    size={10}
                    style={{
                      color: 'var(--text-muted)',
                      opacity: 0.4,
                      transform: 'rotate(90deg)',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom summary row */}
      <div
        className="mt-5 pt-4 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {funnelData[0]?.stage || 'New Lead'}
          </span>
          <ArrowRight size={10} style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {funnelData[funnelData.length - 1]?.stage || 'Won'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--blue)' }}
            />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Frühe Phase
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: '#6dc7c0' }}
            />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Mittlere Phase
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--green)' }}
            />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Abschluss
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'mailing' | 'finance' | 'followup' | 'agents'>('overview');

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center justify-between">
          <div className="skeleton h-10 w-48 rounded-lg" />
          <div className="skeleton h-9 w-96 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-72 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'overview' as const, label: 'Übersicht', icon: BarChart3 },
    { key: 'sales' as const, label: 'Sales', icon: Target },
    { key: 'mailing' as const, label: 'Mailing', icon: Mail },
    { key: 'finance' as const, label: 'Finanzen', icon: Receipt },
    { key: 'followup' as const, label: 'Follow-Up', icon: RotateCcw },
    { key: 'agents' as const, label: 'Agents', icon: Bot },
  ];

  return (
    <div className="space-y-6 pb-8 p-1">
      <Breadcrumb items={[{ label: 'Analytics' }]} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>Analytics</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Performance-Übersicht aller Module
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl overflow-x-auto"
        style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
      >
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap"
              style={{
                backgroundColor: activeTab === tab.key ? 'var(--amber)' : 'transparent',
                color: activeTab === tab.key ? '#000' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <TabIcon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && (
        <div className="space-y-6 stagger-children">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryKPI label="MRR" value={formatCHF(data.summary.mrr)} icon={DollarSign} color="var(--green)" subtext={`${data.summary.activeClients} aktive Kunden`} />
            <SummaryKPI label="Pipeline" value={formatCHF(data.summary.pipelineValue)} icon={Target} color="var(--amber)" subtext={`${data.summary.totalLeads} Leads total`} />
            <SummaryKPI label="Umsatz" value={formatCHF(data.summary.revenue)} icon={TrendingUp} color="var(--blue)" subtext={`Gewinn: ${formatCHF(data.summary.profit)}`} />
            <SummaryKPI label="Agent Health" value={`${data.summary.agentHealth}%`} icon={Bot} color={data.summary.agentHealth >= 80 ? 'var(--green)' : 'var(--amber)'} subtext={`${data.agents.running} aktiv`} />
          </div>

          {/* Conversion Funnel – compact overview version */}
          <ConversionFunnel
            funnelData={data.sales.funnelData}
            overallConversion={data.sales.conversionMetrics.overallConversion}
          />

          {/* Second row: Key metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Conversion Rates mini */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Conversion Rates
              </h3>
              <div className="flex justify-around">
                <RingChart value={data.sales.conversionMetrics.leadToMeeting} label="Lead → Meeting" color="var(--blue)" size={72} />
                <RingChart value={data.sales.conversionMetrics.meetingToProposal} label="Meeting → Angebot" color="var(--purple)" size={72} />
                <RingChart value={data.sales.conversionMetrics.proposalToWon} label="Angebot → Won" color="var(--green)" size={72} />
              </div>
            </div>

            {/* Mailing snapshot */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Mailing Performance
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Send size={12} style={{ color: 'var(--purple)' }} />
                    <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}>{data.mailing.totalSent}</span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Gesendet</span>
                </div>
                <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Eye size={12} style={{ color: 'var(--green)' }} />
                    <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>{data.mailing.openRate}%</span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Open Rate</span>
                </div>
                <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <MousePointer size={12} style={{ color: 'var(--blue)' }} />
                    <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}>{data.mailing.clickRate}%</span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Click Rate</span>
                </div>
                <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <AlertTriangle size={12} style={{ color: 'var(--red)' }} />
                    <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>{data.mailing.bounceRate}%</span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Bounce</span>
                </div>
              </div>
            </div>

            {/* Follow-Up snapshot */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Follow-Up Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={14} style={{ color: 'var(--amber)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Heute fällig</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>{data.followUp.dueToday}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} style={{ color: 'var(--red)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Überfällig</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>{data.followUp.overdue}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} style={{ color: 'var(--blue)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Diese Woche</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}>{data.followUp.thisWeek}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check size={14} style={{ color: 'var(--green)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Abschlussrate</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>{data.followUp.completionRate}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Finance overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue breakdown */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Finanz-Übersicht
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Umsatz</p>
                  <p className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
                    {formatCHF(data.finance.revenue)}
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Gewinn</p>
                  <p className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}>
                    {formatCHF(data.finance.profit)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {data.finance.profitMargin}% Marge
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Ausstehend</p>
                  <p className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
                    {formatCHF(data.finance.outstanding)}
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Ausgaben</p>
                  <p className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>
                    {formatCHF(data.finance.totalExpenses)}
                  </p>
                </div>
              </div>
            </div>

            {/* Expense breakdown with donut chart */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Ausgaben nach Kategorie
              </h3>
              <div className="flex flex-col items-center mb-4">
                <DonutChart
                  data={data.finance.expenseByCategory.slice(0, 6).map((cat, idx) => ({
                    label: cat.category,
                    value: cat.amount,
                    color: ['var(--amber)', 'var(--blue)', 'var(--purple)', 'var(--green)', 'var(--red)', 'var(--orange)'][idx % 6],
                  }))}
                  size={140}
                  strokeWidth={18}
                  centerValue={`CHF ${(data.finance.totalExpenses / 1000).toFixed(1)}k`}
                  centerLabel="Total"
                />
              </div>
              <div className="space-y-2 mt-4">
                {data.finance.expenseByCategory.slice(0, 6).map((cat, idx) => {
                  const colors = ['var(--amber)', 'var(--blue)', 'var(--purple)', 'var(--green)', 'var(--red)', 'var(--orange)'];
                  const color = colors[idx % colors.length];
                  const pct = data.finance.totalExpenses > 0 ? ((cat.amount / data.finance.totalExpenses) * 100).toFixed(1) : '0';
                  return (
                    <div key={cat.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{cat.category}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color }}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SALES TAB ===== */}
      {activeTab === 'sales' && (
        <div className="space-y-6 stagger-children">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryKPI label="Total Leads" value={String(data.sales.totalLeads)} icon={Users} color="var(--blue)" />
            <SummaryKPI label="MRR" value={formatCHF(data.sales.mrr)} icon={DollarSign} color="var(--green)" />
            <SummaryKPI label="Pipeline" value={formatCHF(data.sales.pipelineValue)} icon={Target} color="var(--amber)" />
            <SummaryKPI label="Conversion" value={`${data.sales.conversionMetrics.overallConversion}%`} icon={TrendingUp} color="var(--purple)" />
          </div>

          {/* Conversion Funnel – full visualization */}
          <ConversionFunnel
            funnelData={data.sales.funnelData}
            overallConversion={data.sales.conversionMetrics.overallConversion}
          />

          {/* Conversion Flow */}
          <div className="card-glass-premium p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              Conversion Flow
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border text-center" style={{ backgroundColor: 'var(--surface-hover)', borderColor: 'var(--border)' }}>
                <div className="text-3xl font-bold mb-1 tabular-nums" style={{ color: 'var(--blue)' }}>{data.sales.conversionMetrics.leadToMeeting}%</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Lead → Meeting</div>
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="h-full rounded-full" style={{ width: `${data.sales.conversionMetrics.leadToMeeting}%`, backgroundColor: 'var(--blue)' }} />
                </div>
              </div>
              <div className="p-4 rounded-xl border text-center" style={{ backgroundColor: 'var(--surface-hover)', borderColor: 'var(--border)' }}>
                <div className="text-3xl font-bold mb-1 tabular-nums" style={{ color: 'var(--purple)' }}>{data.sales.conversionMetrics.meetingToProposal}%</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Meeting → Angebot</div>
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="h-full rounded-full" style={{ width: `${data.sales.conversionMetrics.meetingToProposal}%`, backgroundColor: 'var(--purple)' }} />
                </div>
              </div>
              <div className="p-4 rounded-xl border text-center" style={{ backgroundColor: 'var(--surface-hover)', borderColor: 'var(--border)' }}>
                <div className="text-3xl font-bold mb-1 tabular-nums" style={{ color: 'var(--green)' }}>{data.sales.conversionMetrics.proposalToWon}%</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Angebot → Won</div>
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="h-full rounded-full" style={{ width: `${data.sales.conversionMetrics.proposalToWon}%`, backgroundColor: 'var(--green)' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pipeline Funnel with Bar Chart */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Sales Pipeline
              </h3>
              <div className="mb-5">
                <MiniBarChart
                  data={data.sales.funnelData.map((stage, idx) => ({
                    label: stage.stage.length > 6 ? stage.stage.slice(0, 6) + '.' : stage.stage,
                    value: stage.count,
                    color: ['var(--blue)', 'var(--blue)', 'var(--purple)', 'var(--purple)', 'var(--amber)', 'var(--amber)', 'var(--orange)', 'var(--green)', 'var(--green)'][idx] || 'var(--amber)',
                  }))}
                  height={130}
                  barWidth={24}
                  gap={4}
                />
              </div>
              <div className="space-y-2">
                {data.sales.funnelData.map((stage, idx) => {
                  const maxCount = Math.max(...data.sales.funnelData.map((s) => s.count), 1);
                  const colors = ['var(--blue)', 'var(--blue)', 'var(--purple)', 'var(--purple)', 'var(--amber)', 'var(--amber)', 'var(--orange)', 'var(--green)', 'var(--green)'];
                  return (
                    <HorizontalBar key={stage.stage} label={stage.stage} value={stage.count} maxValue={maxCount} color={colors[idx] || 'var(--amber)'} />
                  );
                })}
              </div>
            </div>

            {/* Industry Breakdown */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Branchen-Verteilung
              </h3>
              <div className="space-y-3">
                {data.sales.byBranche.slice(0, 8).map((item, idx) => {
                  const colors = ['var(--amber)', 'var(--green)', 'var(--blue)', 'var(--purple)', 'var(--red)', 'var(--orange)', 'var(--green)', 'var(--blue)'];
                  return (
                    <HorizontalBar key={item.branche} label={item.branche} value={item.count} maxValue={data.sales.byBranche[0]?.count || 1} color={colors[idx % colors.length]} suffix="Leads" />
                  );
                })}
              </div>
            </div>

            {/* Geographic Distribution */}
            <div className="card-glass-premium p-5 lg:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Geografische Verteilung
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.sales.byKanton.map((item) => {
                  const maxCount = data.sales.byKanton[0]?.count || 1;
                  const pct = (item.count / maxCount) * 100;
                  return (
                    <div key={item.kanton} className="p-3 rounded-lg border hover-border-glow" style={{ backgroundColor: 'var(--surface-hover)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin size={14} style={{ color: 'var(--blue)' }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.kanton}</span>
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, var(--blue) ${pct}%, var(--border) ${pct}%)` }} />
                        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-secondary)' }}>{item.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MAILING TAB ===== */}
      {activeTab === 'mailing' && (
        <div className="space-y-6 stagger-children">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryKPI label="E-Mails gesendet" value={String(data.mailing.totalSent)} icon={Send} color="var(--purple)" />
            <SummaryKPI label="Open Rate" value={`${data.mailing.openRate}%`} icon={Eye} color="var(--green)" />
            <SummaryKPI label="Click Rate" value={`${data.mailing.clickRate}%`} icon={MousePointer} color="var(--blue)" />
            <SummaryKPI label="Bounce Rate" value={`${data.mailing.bounceRate}%`} icon={AlertTriangle} color="var(--red)" />
          </div>

          {/* Campaign Performance */}
          <div className="card-glass-premium p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              Kampagnen-Performance
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Kampagne', 'Gesendet', 'Geöffnet', 'Geklickt', 'Bounced', 'Open Rate', 'Click Rate'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.mailing.campaignPerformance.map((c) => (
                    <tr key={c.name} className="table-row" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{c.name}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{c.sent}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>{c.opened}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}>{c.clicked}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>{c.bounced}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>{c.openRate}%</td>
                      <td className="px-4 py-3 tabular-nums font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}>{c.clickRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== FINANCE TAB ===== */}
      {activeTab === 'finance' && (
        <div className="space-y-6 stagger-children">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryKPI label="Umsatz" value={formatCHF(data.finance.revenue)} icon={TrendingUp} color="var(--green)" subtext={`${data.finance.paidInvoices} bezahlte Rechnungen`} />
            <SummaryKPI label="Ausstehend" value={formatCHF(data.finance.outstanding)} icon={Clock} color="var(--amber)" subtext={`${data.finance.overdueInvoices} überfällig`} />
            <SummaryKPI label="Ausgaben" value={formatCHF(data.finance.totalExpenses)} icon={TrendingDown} color="var(--red)" subtext={`davon ${formatCHF(data.finance.recurringExpenses)} wiederkehrend`} />
            <SummaryKPI label="Gewinn" value={formatCHF(data.finance.profit)} icon={DollarSign} color="var(--blue)" subtext={`${data.finance.profitMargin}% Marge`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expense Categories */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Ausgaben nach Kategorie
              </h3>
              <div className="space-y-3">
                {data.finance.expenseByCategory.map((cat, idx) => {
                  const colors = ['var(--amber)', 'var(--blue)', 'var(--purple)', 'var(--green)', 'var(--red)', 'var(--orange)', 'var(--blue)', 'var(--purple)', 'var(--green)'];
                  return (
                    <HorizontalBar key={cat.category} label={cat.category} value={cat.amount} maxValue={data.finance.expenseByCategory[0]?.amount || 1} color={colors[idx % colors.length]} suffix="CHF" />
                  );
                })}
              </div>
            </div>

            {/* Invoice Stats */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Rechnungs-Statistik
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
                    <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>{data.finance.paidInvoices}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Bezahlt</p>
                  </div>
                  <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                    <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>{data.finance.invoiceCount - data.finance.paidInvoices - data.finance.draftInvoices}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Offen</p>
                  </div>
                  <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                    <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>{data.finance.overdueInvoices}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Überfällig</p>
                  </div>
                  <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'rgba(139,143,163,0.06)', border: '1px solid rgba(139,143,163,0.12)' }}>
                    <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{data.finance.draftInvoices}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Entwurf</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Durchschn. Rechnungsbetrag</span>
                    <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                      CHF {data.finance.avgInvoiceAmount.toLocaleString('de-CH')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== FOLLOW-UP TAB ===== */}
      {activeTab === 'followup' && (
        <div className="space-y-6 stagger-children">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryKPI label="Heute fällig" value={String(data.followUp.dueToday)} icon={Clock} color="var(--amber)" />
            <SummaryKPI label="Überfällig" value={String(data.followUp.overdue)} icon={AlertTriangle} color="var(--red)" />
            <SummaryKPI label="Abschlussrate" value={`${data.followUp.completionRate}%`} icon={Check} color="var(--green)" />
            <SummaryKPI label="Durchschn. Dauer" value={`${data.followUp.avgCompletionHours}h`} icon={Calendar} color="var(--blue)" subtext="bis Abschluss" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* By Type */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Nach Typ
              </h3>
              <div className="space-y-3">
                {data.followUp.byType.map((item) => {
                  const typeColors: Record<string, string> = { email: 'var(--blue)', call: 'var(--green)', meeting: 'var(--purple)', linkedin: 'var(--amber)' };
                  return (
                    <HorizontalBar key={item.type} label={item.type.charAt(0).toUpperCase() + item.type.slice(1)} value={item.count} maxValue={Math.max(...data.followUp.byType.map((t) => t.count), 1)} color={typeColors[item.type] || 'var(--text-secondary)'} />
                  );
                })}
              </div>
            </div>

            {/* By Status */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Nach Status
              </h3>
              <div className="space-y-3">
                {data.followUp.byStatus.map((item) => {
                  const statusColors: Record<string, string> = { pending: 'var(--amber)', completed: 'var(--green)', skipped: 'var(--text-muted)' };
                  return (
                    <HorizontalBar key={item.status} label={item.status.charAt(0).toUpperCase() + item.status.slice(1)} value={item.count} maxValue={Math.max(...data.followUp.byStatus.map((s) => s.count), 1)} color={statusColors[item.status] || 'var(--text-secondary)'} />
                  );
                })}
              </div>
            </div>

            {/* By Priority */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Nach Priorität
              </h3>
              <div className="space-y-3">
                {data.followUp.byPriority.map((item) => {
                  const priorityLabels: Record<number, string> = { 1: 'P1 — Kritisch', 2: 'P2 — Hoch', 3: 'P3 — Normal', 4: 'P4 — Niedrig', 5: 'P5 — Minimal' };
                  const priorityColors: Record<number, string> = { 1: 'var(--red)', 2: 'var(--amber)', 3: 'var(--blue)', 4: 'var(--green)', 5: 'var(--text-muted)' };
                  return (
                    <HorizontalBar key={item.priority} label={priorityLabels[item.priority] || `P${item.priority}`} value={item.count} maxValue={Math.max(...data.followUp.byPriority.map((p) => p.count), 1)} color={priorityColors[item.priority] || 'var(--text-secondary)'} />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== AGENTS TAB ===== */}
      {activeTab === 'agents' && (
        <div className="space-y-6 stagger-children">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryKPI label="Total Agents" value={String(data.agents.total)} icon={Bot} color="var(--blue)" />
            <SummaryKPI label="Aktiv" value={String(data.agents.running)} icon={TrendingUp} color="var(--green)" />
            <SummaryKPI label="Avg Score" value={String(data.agents.avgScore)} icon={Award} color={data.agents.avgScore >= 80 ? 'var(--green)' : 'var(--amber)'} />
            <SummaryKPI label="Tasks heute" value={String(data.agents.totalTasksToday)} icon={Briefcase} color="var(--purple)" subtext={`${data.agents.totalErrorsToday} Fehler`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Agents */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Top 10 Agents
              </h3>
              <div className="space-y-2">
                {data.agents.topAgents.map((agent, idx) => (
                  <div
                    key={agent.name}
                    className="flex items-center gap-3 p-3 rounded-lg border hover-border-glow transition-all"
                    style={{ backgroundColor: 'var(--surface-hover)', borderColor: 'var(--border)' }}
                  >
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: idx < 3 ? 'var(--amber-glow)' : 'var(--surface)',
                        color: idx < 3 ? 'var(--amber)' : 'var(--text-secondary)',
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{agent.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{agent.department} · {agent.tasksToday} tasks</p>
                    </div>
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ fontFamily: 'var(--font-mono)', color: agent.score >= 80 ? 'var(--green)' : agent.score >= 60 ? 'var(--amber)' : 'var(--red)' }}
                    >
                      {agent.score}
                    </span>
                    {idx < 3 && <Award size={16} style={{ color: 'var(--amber)' }} />}
                  </div>
                ))}
              </div>
            </div>

            {/* By Department */}
            <div className="card-glass-premium p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                Abteilungen
              </h3>
              <div className="space-y-3">
                {data.agents.byDepartment.map((dept) => (
                  <div key={dept.department} className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--surface-hover)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{dept.department}</span>
                      <span className="text-xs tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: dept.avgScore >= 80 ? 'var(--green)' : 'var(--amber)' }}>
                        Score: {dept.avgScore}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>{dept.count} Agents</span>
                      <span>{dept.totalTasks} Tasks heute</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
                      <div className="h-full rounded-full" style={{ width: `${dept.avgScore}%`, backgroundColor: dept.avgScore >= 80 ? 'var(--green)' : 'var(--amber)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
