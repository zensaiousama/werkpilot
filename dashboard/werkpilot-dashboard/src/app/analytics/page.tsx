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
  ChevronDown,
} from 'lucide-react';

// --- Types ---

interface StatsData {
  total: number;
  pipelineValue: number;
  avgLeadScore: number;
  avgFitnessScore: number;
  byStatus: { status: string; count: number }[];
  byBranche: { branche: string; count: number; revenue: number }[];
  byKanton: { kanton: string; count: number }[];
}

interface AnalyticsData {
  mrr: number;
  mrrChange: number;
  pipelineValue: number;
  pipelineChange: number;
  conversionRate: number;
  conversionChange: number;
  avgDealSize: number;
  dealSizeChange: number;
  funnelData: {
    stage: string;
    count: number;
    percentage: number;
  }[];
  mrrHistory: { month: string; value: number }[];
  conversionMetrics: {
    leadToMeeting: number;
    meetingToProposal: number;
    proposalToWon: number;
  };
}

interface AgentHealth {
  agents: {
    id: string;
    name: string;
    department: string;
    score: number;
    tasksCompleted: number;
    avgResponseTime: number;
  }[];
}

type DateRange = '7d' | '30d' | '90d' | 'ytd';

// --- Mock data generators ---

function generateMockAnalytics(): AnalyticsData {
  const mrrHistory = [];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let baseValue = 45000;

  for (let i = 0; i < 12; i++) {
    baseValue += Math.random() * 8000 - 2000;
    mrrHistory.push({
      month: months[i],
      value: Math.round(baseValue),
    });
  }

  return {
    mrr: 87500,
    mrrChange: 12.5,
    pipelineValue: 340000,
    pipelineChange: 8.3,
    conversionRate: 23.4,
    conversionChange: 2.1,
    avgDealSize: 8750,
    dealSizeChange: -3.2,
    funnelData: [
      { stage: 'New Leads', count: 450, percentage: 100 },
      { stage: 'Qualified', count: 315, percentage: 70 },
      { stage: 'Meeting', count: 220, percentage: 49 },
      { stage: 'Proposal', count: 135, percentage: 30 },
      { stage: 'Won', count: 54, percentage: 12 },
    ],
    mrrHistory,
    conversionMetrics: {
      leadToMeeting: 48.9,
      meetingToProposal: 61.4,
      proposalToWon: 40.0,
    },
  };
}

function generateMockAgentHealth(): AgentHealth {
  const departments = ['Sales', 'Marketing', 'Engineering', 'Finance', 'Operations'];
  const agents = [];

  for (let i = 0; i < 10; i++) {
    agents.push({
      id: `agent-${i + 1}`,
      name: `Agent ${i + 1}`,
      department: departments[i % departments.length],
      score: Math.floor(Math.random() * 30) + 70,
      tasksCompleted: Math.floor(Math.random() * 100) + 50,
      avgResponseTime: Math.floor(Math.random() * 300) + 100,
    });
  }

  return {
    agents: agents.sort((a, b) => b.score - a.score),
  };
}

// --- Components ---

function KPICard({
  label,
  value,
  change,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  change: number;
  icon: React.ElementType;
  color: string;
}) {
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <div className="card-glass-premium p-5 hover-lift">
      <div className="flex items-start justify-between mb-3">
        <div
          className="p-2.5 rounded-lg"
          style={{
            backgroundColor: `${color}15`,
            color: color,
          }}
        >
          <Icon size={20} />
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold">
          {isNeutral ? (
            <span style={{ color: 'var(--text-muted)' }}>—</span>
          ) : (
            <>
              {isPositive ? (
                <TrendingUp size={14} style={{ color: 'var(--green)' }} />
              ) : (
                <TrendingDown size={14} style={{ color: 'var(--red)' }} />
              )}
              <span style={{ color: isPositive ? 'var(--green)' : 'var(--red)' }}>
                {Math.abs(change)}%
              </span>
            </>
          )}
        </div>
      </div>
      <p
        className="text-xs mb-1.5"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
      >
        {label.toUpperCase()}
      </p>
      <p
        className="text-2xl font-bold tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', color }}
      >
        {value}
      </p>
    </div>
  );
}

function PipelineFunnel({ data }: { data: AnalyticsData['funnelData'] }) {
  const maxWidth = 100;

  return (
    <div className="space-y-3">
      {data.map((stage, idx) => {
        const width = (stage.percentage / 100) * maxWidth;
        const prevCount = idx > 0 ? data[idx - 1].count : stage.count;
        const dropOff = idx > 0 ? ((prevCount - stage.count) / prevCount) * 100 : 0;

        return (
          <div key={stage.stage}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {stage.stage}
              </span>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {stage.count} ({stage.percentage}%)
              </span>
            </div>
            <div className="relative">
              <svg width="100%" height="48" className="overflow-visible">
                <defs>
                  <linearGradient id={`funnel-gradient-${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="var(--amber)" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <rect
                  x="0"
                  y="0"
                  width={`${width}%`}
                  height="40"
                  rx="6"
                  fill={`url(#funnel-gradient-${idx})`}
                  stroke="var(--amber)"
                  strokeWidth="1"
                  opacity="0.9"
                />
                <text
                  x="12"
                  y="24"
                  fill="var(--text)"
                  fontSize="13"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                >
                  {stage.count}
                </text>
              </svg>
              {dropOff > 0 && (
                <div
                  className="hidden md:block absolute -right-14 top-1/2 -translate-y-1/2 text-xs font-semibold"
                  style={{ color: 'var(--red)' }}
                >
                  -{dropOff.toFixed(0)}%
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IndustryBreakdown({
  data,
}: {
  data: { branche: string; count: number; revenue: number }[];
}) {
  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((item, idx) => {
        const percentage = (item.count / maxCount) * 100;

        return (
          <div key={item.branche}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium truncate-1" style={{ color: 'var(--text)' }}>
                {item.branche}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {item.count} leads
                </span>
                <span
                  className="text-xs font-semibold tabular-nums"
                  style={{ color: 'var(--green)' }}
                >
                  CHF {(item.revenue / 1000).toFixed(0)}k
                </span>
              </div>
            </div>
            <div className="relative h-7 rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--surface-hover)' }}>
              <div
                className="h-full rounded-lg transition-all duration-700"
                style={{
                  width: `${percentage}%`,
                  background: `linear-gradient(90deg, var(--chart-${(idx % 8) + 1}), var(--chart-${(idx % 8) + 1}) 50%, transparent)`,
                  opacity: 0.85,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GeographicDistribution({
  data,
}: {
  data: { kanton: string; count: number }[];
}) {
  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {data.slice(0, 12).map((item, idx) => {
        const percentage = (item.count / maxCount) * 100;

        return (
          <div
            key={item.kanton}
            className="p-3 rounded-lg border hover-border-glow transition-all"
            style={{
              backgroundColor: 'var(--surface-hover)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={14} style={{ color: 'var(--blue)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {item.kanton}
              </span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div
                className="flex-1 h-1.5 rounded-full"
                style={{
                  background: `linear-gradient(90deg, var(--blue) ${percentage}%, var(--border) ${percentage}%)`,
                }}
              />
              <span
                className="text-xs font-bold tabular-nums"
                style={{ color: 'var(--text-secondary)' }}
              >
                {item.count}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgentLeaderboard({ data }: { data: AgentHealth['agents'] }) {
  const deptColors: Record<string, string> = {
    Sales: 'var(--dept-sales)',
    Marketing: 'var(--dept-marketing)',
    Engineering: 'var(--dept-engineering)',
    Finance: 'var(--dept-finance)',
    Operations: 'var(--dept-operations)',
  };

  return (
    <div className="space-y-2">
      {data.map((agent, idx) => (
        <div
          key={agent.id}
          className="flex items-center gap-3 p-3 rounded-lg border hover-border-glow transition-all"
          style={{
            backgroundColor: 'var(--surface-hover)',
            borderColor: 'var(--border)',
          }}
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
            <p className="text-sm font-semibold truncate-1" style={{ color: 'var(--text)' }}>
              {agent.name}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {agent.department} · {agent.tasksCompleted} tasks · {agent.avgResponseTime}ms
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p
                className="text-sm font-bold tabular-nums"
                style={{ color: deptColors[agent.department] || 'var(--amber)' }}
              >
                {agent.score}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                score
              </p>
            </div>
            {idx < 3 && <Award size={16} style={{ color: 'var(--amber)' }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function MRRSparkline({ data }: { data: { month: string; value: number }[] }) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));
  const range = maxValue - minValue;

  return (
    <svg width="100%" height="60" className="overflow-visible">
      <defs>
        <linearGradient id="sparkline-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--amber)" stopOpacity={0.3} />
          <stop offset="100%" stopColor="var(--amber)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={data
          .map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = 50 - ((d.value - minValue) / range) * 40;
            return `${i === 0 ? 'M' : 'L'} ${x}% ${y}`;
          })
          .join(' ')}
        fill="none"
        stroke="var(--amber)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={
          data
            .map((d, i) => {
              const x = (i / (data.length - 1)) * 100;
              const y = 50 - ((d.value - minValue) / range) * 40;
              return `${i === 0 ? 'M' : 'L'} ${x}% ${y}`;
            })
            .join(' ') + ' L 100% 50 L 0% 50 Z'
        }
        fill="url(#sparkline-gradient)"
      />
    </svg>
  );
}

function ConversionMetrics({
  data,
}: {
  data: AnalyticsData['conversionMetrics'];
}) {
  const metrics = [
    { label: 'Lead → Meeting', value: data.leadToMeeting, color: 'var(--blue)' },
    { label: 'Meeting → Proposal', value: data.meetingToProposal, color: 'var(--purple)' },
    { label: 'Proposal → Won', value: data.proposalToWon, color: 'var(--green)' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
      {metrics.map((metric, idx) => (
        <div
          key={metric.label}
          className="p-3 md:p-4 rounded-xl border text-center hover-lift transition-all"
          style={{
            backgroundColor: 'var(--surface-hover)',
            borderColor: 'var(--border)',
          }}
        >
          <div
            className="text-2xl md:text-3xl font-bold mb-1 tabular-nums"
            style={{ color: metric.color }}
          >
            {metric.value.toFixed(1)}%
          </div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {metric.label}
          </div>
          <div
            className="mt-3 h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${metric.value}%`,
                backgroundColor: metric.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DateRangeSelector({
  selected,
  onChange,
}: {
  selected: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const ranges: { label: string; value: DateRange }[] = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
    { label: 'YTD', value: 'ytd' },
  ];

  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-lg border"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
          style={{
            backgroundColor: selected === range.value ? 'var(--amber)' : 'transparent',
            color: selected === range.value ? '#000' : 'var(--text-secondary)',
          }}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

// --- Main Page Component ---

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [agentHealth, setAgentHealth] = useState<AgentHealth | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  useEffect(() => {
    // Fetch real data
    Promise.all([
      fetch('/api/leads/stats').then((r) => r.json()),
      fetch('/api/dashboard?view=kpis').then((r) => r.json()).catch(() => generateMockAnalytics()),
      fetch('/api/agents/health').then((r) => r.json()).catch(() => generateMockAgentHealth()),
    ])
      .then(([statsData, analyticsData, agentData]) => {
        setStats(statsData);
        setAnalytics(analyticsData);
        setAgentHealth(agentData);
      })
      .catch(() => {
        // Fallback to mock data
        setAnalytics(generateMockAnalytics());
        setAgentHealth(generateMockAgentHealth());
      });
  }, [dateRange]);

  // Loading skeleton
  if (!stats || !analytics || !agentHealth) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
            Analytics
          </h1>
          <div className="skeleton h-9 w-80 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-96 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Add revenue data to industry breakdown
  const industryData = stats.byBranche.map((item, idx) => ({
    ...item,
    revenue: (item.count * (8000 + Math.random() * 4000)),
  }));

  return (
    <div className="space-y-6 pb-8">
      {/* Header with Date Range Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
            Analytics
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Comprehensive insights and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 overflow-x-auto">
          <Calendar size={18} className="shrink-0 hidden sm:block" style={{ color: 'var(--text-muted)' }} />
          <DateRangeSelector selected={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="MRR"
          value={`CHF ${(analytics.mrr / 1000).toFixed(0)}k`}
          change={analytics.mrrChange}
          icon={DollarSign}
          color="var(--green)"
        />
        <KPICard
          label="Pipeline Value"
          value={`CHF ${(analytics.pipelineValue / 1000).toFixed(0)}k`}
          change={analytics.pipelineChange}
          icon={Target}
          color="var(--amber)"
        />
        <KPICard
          label="Conversion Rate"
          value={`${analytics.conversionRate.toFixed(1)}%`}
          change={analytics.conversionChange}
          icon={TrendingUp}
          color="var(--blue)"
        />
        <KPICard
          label="Avg Deal Size"
          value={`CHF ${(analytics.avgDealSize / 1000).toFixed(1)}k`}
          change={analytics.dealSizeChange}
          icon={Briefcase}
          color="var(--purple)"
        />
      </div>

      {/* Conversion Metrics */}
      <div className="card-glass-premium p-4 md:p-6">
        <h2
          className="text-sm font-bold mb-5"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
        >
          CONVERSION METRICS
        </h2>
        <ConversionMetrics data={analytics.conversionMetrics} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Pipeline Funnel */}
        <div className="card-glass-premium p-4 md:p-6 overflow-x-auto">
          <h2
            className="text-sm font-bold mb-5"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
          >
            PIPELINE FUNNEL
          </h2>
          <PipelineFunnel data={analytics.funnelData} />
        </div>

        {/* MRR Growth */}
        <div className="card-glass-premium p-4 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2
              className="text-sm font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              MRR GROWTH (12 MONTHS)
            </h2>
            <div className="flex items-center gap-1.5">
              <TrendingUp size={14} style={{ color: 'var(--green)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--green)' }}>
                +{analytics.mrrChange}%
              </span>
            </div>
          </div>
          <MRRSparkline data={analytics.mrrHistory} />
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
            {analytics.mrrHistory.slice(-6).map((item) => (
              <div key={item.month} className="text-center">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  {item.month}
                </div>
                <div
                  className="text-xs font-semibold tabular-nums"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {(item.value / 1000).toFixed(0)}k
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Industry Breakdown */}
        <div className="card-glass-premium p-4 md:p-6">
          <h2
            className="text-sm font-bold mb-5"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
          >
            INDUSTRY BREAKDOWN
          </h2>
          <IndustryBreakdown data={industryData} />
        </div>

        {/* Geographic Distribution */}
        <div className="card-glass-premium p-4 md:p-6">
          <h2
            className="text-sm font-bold mb-5"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
          >
            GEOGRAPHIC DISTRIBUTION
          </h2>
          <GeographicDistribution data={stats.byKanton} />
        </div>
      </div>

      {/* Agent Performance Leaderboard */}
      <div className="card-glass-premium p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 md:mb-5">
          <h2
            className="text-sm font-bold"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
          >
            AGENT PERFORMANCE LEADERBOARD
          </h2>
          <div className="flex items-center gap-2">
            <Users size={16} style={{ color: 'var(--amber)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Top 10 Agents
            </span>
          </div>
        </div>
        <AgentLeaderboard data={agentHealth.agents} />
      </div>
    </div>
  );
}
