'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  DollarSign,
  Target,
  Users,
  UserCheck,
  Activity,
  AlertCircle,
  GitBranch,
  CheckCircle2,
  Moon,
  Zap,
  Bot,
  Clock,
  ArrowRight,
  TrendingUp,
  Shield,
  FileSearch,
} from 'lucide-react';
import KPICard from '@/components/KPICard';
import StatusBadge from '@/components/StatusBadge';
import AIInsights from '@/components/AIInsights';

interface DashboardData {
  mrr: number;
  totalLeads: number;
  activeClients: number;
  pipelineValue: number;
  pipeline: { stage: string; count: number }[];
  agentHealth: { total: number; running: number; errored: number; avgScore: number };
  recentNightTasks: { id: string; task: string; status: string }[];
  pendingDecisions: { id: string; title: string; context: string }[];
}

/* -------------------------------------------------- */
/* Greeting helper                                     */
/* -------------------------------------------------- */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

/* -------------------------------------------------- */
/* Circular Progress Ring (SVG)                        */
/* -------------------------------------------------- */
function CircularProgress({
  value,
  size = 96,
  strokeWidth = 7,
  color,
  glowColor,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  glowColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [animatedOffset, setAnimatedOffset] = useState(circumference);

  useEffect(() => {
    const timer = setTimeout(() => {
      const progress = Math.min(Math.max(value, 0), 100);
      setAnimatedOffset(circumference - (progress / 100) * circumference);
    }, 300);
    return () => clearTimeout(timer);
  }, [value, circumference]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={strokeWidth}
      />
      {/* Glow filter */}
      <defs>
        <filter id="score-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor={glowColor} result="color" />
          <feComposite in="color" in2="blur" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={animatedOffset}
        filter="url(#score-glow)"
        style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
    </svg>
  );
}

/* -------------------------------------------------- */
/* Pipeline gradient colors                            */
/* -------------------------------------------------- */
const PIPELINE_GRADIENTS = [
  { from: '#60a5fa', to: '#3b82f6' },   // blue
  { from: '#818cf8', to: '#6366f1' },   // indigo
  { from: '#22c55e', to: '#16a34a' },   // green
  { from: '#a3e635', to: '#84cc16' },   // lime
  { from: '#f59e0b', to: '#d97706' },   // amber
  { from: '#f97316', to: '#ea580c' },   // orange
  { from: '#ef4444', to: '#dc2626' },   // red (fallback)
  { from: '#8b5cf6', to: '#7c3aed' },   // purple (fallback)
];

/* -------------------------------------------------- */
/* Decision icons                                      */
/* -------------------------------------------------- */
const DECISION_ICONS = [
  <TrendingUp key="0" size={16} />,
  <Shield key="1" size={16} />,
  <FileSearch key="2" size={16} />,
  <AlertCircle key="3" size={16} />,
  <GitBranch key="4" size={16} />,
  <Zap key="5" size={16} />,
];

/* -------------------------------------------------- */
/* Mock activity ticker data                           */
/* -------------------------------------------------- */
const ACTIVITY_TICKER = [
  { icon: <Bot size={14} />, text: 'Sales-Agent #12 hat 3 neue Leads qualifiziert', time: 'vor 2 Min', color: 'var(--green)' },
  { icon: <FileSearch size={14} />, text: 'Scraper-Agent hat 47 neue Firmen gefunden (Region Bern)', time: 'vor 8 Min', color: 'var(--blue)' },
  { icon: <Zap size={14} />, text: 'Night-Shift: Fitness-Check Pipeline abgeschlossen', time: 'vor 23 Min', color: 'var(--purple)' },
  { icon: <TrendingUp size={14} />, text: 'MRR-Prognose aktualisiert: +4.2% vs. letzte Woche', time: 'vor 41 Min', color: 'var(--amber)' },
];

/* ================================================== */
/* MAIN DASHBOARD                                      */
/* ================================================== */
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    const loadData = () =>
      fetch('/api/dashboard')
        .then((r) => r.json())
        .then((d) => {
          setData({
            mrr: d.kpis?.mrr ?? d.mrr ?? 0,
            totalLeads: d.kpis?.totalLeads ?? d.totalLeads ?? 0,
            activeClients: d.kpis?.activeClients ?? d.activeClients ?? 0,
            pipelineValue: d.kpis?.pipelineValue ?? d.pipelineValue ?? 0,
            pipeline: d.pipeline ?? [],
            agentHealth: d.agentHealth ?? { total: 0, running: 0, errored: 0, avgScore: 0 },
            recentNightTasks: (d.recentTasks ?? d.recentNightTasks ?? []).map(
              (t: { id: string; task: string; status: string }) => ({
                id: t.id,
                task: t.task,
                status: t.status,
              })
            ),
            pendingDecisions: (d.pendingDecisions ?? []).map(
              (dec: { id: string; title: string; context: string }) => ({
                id: dec.id,
                title: dec.title,
                context: dec.context,
              })
            ),
          });
        })
        .catch(() => {});
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Rotate activity ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % ACTIVITY_TICKER.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const dateString = useMemo(
    () =>
      new Date().toLocaleDateString('de-CH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [],
  );

  /* ---------- LOADING STATE ---------- */
  if (!data) {
    return (
      <div className="p-6 md:p-8">
        <div className="space-y-6 stagger-children">
          <div className="skeleton h-16 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-36 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 skeleton h-80 rounded-xl" />
            <div className="skeleton h-80 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="skeleton h-56 rounded-xl" />
            <div className="skeleton h-56 rounded-xl" />
            <div className="skeleton h-56 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const maxPipeline = Math.max(...data.pipeline.map((p) => p.count), 1);
  const totalPipelineCount = data.pipeline.reduce((acc, s) => acc + s.count, 0);
  const scoreColor =
    data.agentHealth.avgScore > 80
      ? 'var(--green)'
      : data.agentHealth.avgScore > 60
        ? 'var(--amber)'
        : 'var(--red)';
  const scoreGlow =
    data.agentHealth.avgScore > 80
      ? 'rgba(34,197,94,0.5)'
      : data.agentHealth.avgScore > 60
        ? 'rgba(245,158,11,0.5)'
        : 'rgba(239,68,68,0.5)';

  return (
    <div className="relative min-h-screen">
      {/* ===== Animated Gradient Mesh Background ===== */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse 80% 60% at 10% 20%, rgba(245, 158, 11, 0.06) 0%, transparent 60%),
              radial-gradient(ellipse 60% 80% at 85% 75%, rgba(139, 92, 246, 0.06) 0%, transparent 60%),
              radial-gradient(ellipse 70% 50% at 50% 10%, rgba(96, 165, 250, 0.04) 0%, transparent 60%),
              radial-gradient(ellipse 50% 70% at 70% 40%, rgba(34, 197, 94, 0.03) 0%, transparent 60%)
            `,
            animation: 'gradient-shift 20s ease infinite',
            backgroundSize: '200% 200%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse 40% 40% at 30% 70%, rgba(245, 158, 11, 0.03) 0%, transparent 70%),
              radial-gradient(ellipse 50% 50% at 80% 20%, rgba(96, 165, 250, 0.03) 0%, transparent 70%)
            `,
            animation: 'gradient-shift 15s ease infinite reverse',
            backgroundSize: '200% 200%',
          }}
        />
      </div>

      {/* ===== Main Content ===== */}
      <div className="relative p-4 md:p-6 lg:p-8" style={{ zIndex: 1 }}>
        <div className="space-y-4 md:space-y-6 stagger-children">

          {/* ===== HEADER ===== */}
          <div
            className="card-glass-premium p-4 md:p-6 lg:p-7"
            style={{ animationDelay: '0ms' }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
              <div>
                <p
                  className="text-xs md:text-sm mb-1"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {getGreeting()}
                </p>
                <h1
                  className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  Executive Dashboard
                </h1>
                <p
                  className="text-sm mt-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {dateString}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* Refresh indicator */}
                <div
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                  style={{
                    backgroundColor: 'rgba(139,143,163,0.06)',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <Clock size={12} />
                  Auto-refresh 30s
                </div>

                {/* Live pulse */}
                <div
                  className="flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.08))',
                    color: 'var(--green)',
                    fontFamily: 'var(--font-mono)',
                    border: '1px solid rgba(34,197,94,0.2)',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'var(--green)',
                      display: 'inline-block',
                      boxShadow: '0 0 8px rgba(34,197,94,0.6), 0 0 16px rgba(34,197,94,0.3)',
                      animation: 'pulse-green 2s infinite',
                    }}
                  />
                  Systeme Live
                </div>
              </div>
            </div>
          </div>

          {/* ===== KPI CARDS ===== */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 stagger-children">
            <KPICard
              label="MRR"
              value={data.mrr}
              prefix="CHF "
              trend={12}
              color="var(--green)"
              icon={<DollarSign size={20} style={{ color: 'var(--green)' }} />}
              delay={0}
            />
            <KPICard
              label="Pipeline Value"
              value={data.pipelineValue}
              prefix="CHF "
              trend={8}
              color="var(--amber)"
              icon={<Target size={20} style={{ color: 'var(--amber)' }} />}
              delay={80}
            />
            <KPICard
              label="Total Leads"
              value={data.totalLeads}
              trend={15}
              color="var(--blue)"
              icon={<Users size={20} style={{ color: 'var(--blue)' }} />}
              delay={160}
            />
            <KPICard
              label="Active Clients"
              value={data.activeClients}
              trend={5}
              color="var(--green)"
              icon={<UserCheck size={20} style={{ color: 'var(--green)' }} />}
              delay={240}
            />
          </div>

          {/* ===== PIPELINE (Centerpiece) + AI INSIGHTS ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pipeline - Visual Centerpiece */}
            <div
              className="lg:col-span-2 card-glass-premium p-4 md:p-6 lg:p-7"
            >
              {/* Pipeline Header */}
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(96,165,250,0.15), rgba(34,197,94,0.15))',
                    }}
                  >
                    <GitBranch size={18} style={{ color: 'var(--blue)' }} />
                  </div>
                  <div>
                    <h2
                      className="text-sm font-bold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                    >
                      SALES PIPELINE
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Conversion funnel overview
                    </p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(96,165,250,0.1), rgba(139,92,246,0.1))',
                    border: '1px solid rgba(96,165,250,0.15)',
                  }}
                >
                  <span
                    className="text-xl font-bold"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                  >
                    {totalPipelineCount}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    Total
                  </span>
                </div>
              </div>

              {/* Pipeline Bars */}
              <div className="space-y-4">
                {data.pipeline.map((s, idx) => {
                  const gradient = PIPELINE_GRADIENTS[idx % PIPELINE_GRADIENTS.length];
                  const percentage = Math.round((s.count / maxPipeline) * 100);
                  const widthPercent = Math.max((s.count / maxPipeline) * 100, s.count > 0 ? 8 : 0);

                  return (
                    <div
                      key={s.stage}
                      className="group"
                      style={{
                        animation: `fadeInUp 500ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 100 + 200}ms both`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="text-xs font-medium tracking-wide"
                          style={{
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {s.stage}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs"
                            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                          >
                            {percentage}%
                          </span>
                          <span
                            className="text-sm font-bold tabular-nums"
                            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                          >
                            {s.count}
                          </span>
                        </div>
                      </div>
                      <div
                        className="relative h-9 rounded-xl overflow-hidden"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        {/* Bar fill */}
                        <div
                          className="absolute inset-y-0 left-0 rounded-xl transition-all duration-700 ease-out"
                          style={{
                            width: `${widthPercent}%`,
                            background: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})`,
                            boxShadow: `0 0 20px ${gradient.from}22, inset 0 1px 0 rgba(255,255,255,0.15)`,
                            transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
                          }}
                        >
                          {/* Shimmer effect */}
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background:
                                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
                              backgroundSize: '200% 100%',
                              animation: 'shimmer 3s ease-in-out infinite',
                              borderRadius: 'inherit',
                            }}
                          />
                        </div>

                        {/* Hover overlay */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: `linear-gradient(90deg, ${gradient.from}08, transparent)`,
                            opacity: 0,
                            transition: 'opacity 0.3s ease',
                            borderRadius: 'inherit',
                            pointerEvents: 'none',
                          }}
                          className="group-hover:!opacity-100"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pipeline legend line */}
              <div
                className="mt-3 md:mt-5 pt-3 md:pt-4 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <div className="hidden sm:flex items-center gap-4 flex-wrap">
                  {data.pipeline.slice(0, 4).map((s, idx) => {
                    const gradient = PIPELINE_GRADIENTS[idx % PIPELINE_GRADIENTS.length];
                    return (
                      <div key={s.stage} className="flex items-center gap-1.5">
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 3,
                            background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
                          }}
                        />
                        <span
                          className="text-xs"
                          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                        >
                          {s.stage}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Updated live
                </span>
              </div>
            </div>

            {/* AI Insights with animated gradient border */}
            <div className="border-gradient">
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(18,21,31,0.95), rgba(24,28,42,0.9))',
                  borderRadius: 'var(--radius-lg)',
                  height: '100%',
                }}
              >
                <AIInsights />
              </div>
            </div>
          </div>

          {/* ===== BOTTOM ROW: Decisions + Night Shift + Agent Performance ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 stagger-children">

            {/* Decisions */}
            <div className="card-glass-premium p-4 md:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--amber-glow)' }}
                >
                  <AlertCircle size={16} style={{ color: 'var(--amber)' }} />
                </div>
                <h2
                  className="text-sm font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  PENDING DECISIONS
                </h2>
                {data.pendingDecisions.length > 0 && (
                  <span className="notification-badge ml-auto">
                    {data.pendingDecisions.length}
                  </span>
                )}
              </div>

              {data.pendingDecisions.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2
                    size={32}
                    style={{ color: 'var(--green)', margin: '0 auto 8px', opacity: 0.6 }}
                  />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Keine offenen Entscheidungen
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.pendingDecisions.map((d, idx) => (
                    <div
                      key={d.id}
                      className="group relative p-3.5 rounded-xl cursor-pointer transition-all"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border)',
                        animation: `fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 80}ms both`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.04)';
                        e.currentTarget.style.borderColor = 'rgba(245,158,11,0.2)';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      {/* Left gradient accent */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '15%',
                          bottom: '15%',
                          width: 3,
                          borderRadius: 4,
                          background: 'linear-gradient(180deg, var(--amber), var(--orange))',
                          opacity: 0.7,
                          transition: 'opacity 0.2s ease',
                        }}
                        className="group-hover:!opacity-100"
                      />

                      <div className="flex items-start gap-3 pl-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            backgroundColor: 'var(--amber-glow)',
                            color: 'var(--amber)',
                          }}
                        >
                          {DECISION_ICONS[idx % DECISION_ICONS.length]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium mb-1"
                            style={{ color: 'var(--text)' }}
                          >
                            {d.title}
                          </p>
                          <p
                            className="text-xs leading-relaxed"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {d.context.slice(0, 80)}...
                          </p>
                        </div>
                        <ArrowRight
                          size={14}
                          style={{
                            color: 'var(--text-muted)',
                            marginTop: 6,
                            opacity: 0,
                            transform: 'translateX(-4px)',
                            transition: 'all 0.2s ease',
                          }}
                          className="group-hover:!opacity-100 group-hover:!translate-x-0"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Night Shift */}
            <div className="card-glass-premium p-4 md:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--purple-glow)' }}
                >
                  <Moon size={16} style={{ color: 'var(--purple)' }} />
                </div>
                <h2
                  className="text-sm font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
                >
                  NIGHT SHIFT
                </h2>
                {data.recentNightTasks.length > 0 && (
                  <span
                    className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: 'var(--purple-glow)',
                      color: 'var(--purple)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {data.recentNightTasks.length} Tasks
                  </span>
                )}
              </div>

              {data.recentNightTasks.length === 0 ? (
                <div className="text-center py-8">
                  <Moon
                    size={32}
                    style={{ color: 'var(--purple)', margin: '0 auto 8px', opacity: 0.4 }}
                  />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Keine Night-Shift-Tasks
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.recentNightTasks.map((t, idx) => {
                    const isDone = t.status === 'done' || t.status === 'completed';
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg transition-all"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          animation: `fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 80}ms both`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(139,92,246,0.04)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                        }}
                      >
                        {/* Animated checkmark for completed */}
                        <div
                          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: isDone
                              ? 'var(--green-glow)'
                              : 'rgba(139,143,163,0.08)',
                            transition: 'all 0.3s ease',
                          }}
                        >
                          {isDone ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                              style={{ color: 'var(--green)' }}
                            >
                              <path
                                d="M3 7L6 10L11 4"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                  strokeDasharray: 20,
                                  strokeDashoffset: 0,
                                  animation: `checkmark-draw 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${idx * 200 + 500}ms both`,
                                }}
                              />
                            </svg>
                          ) : (
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: 'var(--text-muted)',
                                animation: t.status === 'in_progress' ? 'pulse-dot 2s infinite' : undefined,
                              }}
                            />
                          )}
                        </div>

                        <span
                          className="text-sm truncate flex-1"
                          style={{
                            color: isDone ? 'var(--text-secondary)' : 'var(--text)',
                          }}
                        >
                          {t.task}
                        </span>
                        <StatusBadge status={t.status} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Agent Performance */}
            <div className="card-glass-premium p-4 md:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--blue-glow)' }}
                >
                  <Activity size={16} style={{ color: 'var(--blue)' }} />
                </div>
                <h2
                  className="text-sm font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  AGENT PERFORMANCE
                </h2>
              </div>

              {/* Score Ring - Centerpiece */}
              <div className="flex flex-col items-center mb-5">
                <div className="relative">
                  <CircularProgress
                    value={data.agentHealth.avgScore}
                    size={110}
                    strokeWidth={8}
                    color={scoreColor}
                    glowColor={scoreGlow}
                  />
                  {/* Center label */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      className="text-2xl font-bold tabular-nums"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: scoreColor,
                        lineHeight: 1,
                      }}
                    >
                      {data.agentHealth.avgScore}
                    </span>
                    <span
                      className="text-xs mt-1"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      AVG
                    </span>
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Running',
                    value: data.agentHealth.running,
                    color: 'var(--green)',
                    bg: 'var(--green-glow)',
                  },
                  {
                    label: 'Total',
                    value: data.agentHealth.total,
                    color: 'var(--blue)',
                    bg: 'var(--blue-glow)',
                  },
                  {
                    label: 'Errors',
                    value: data.agentHealth.errored,
                    color: data.agentHealth.errored > 0 ? 'var(--red)' : 'var(--green)',
                    bg: data.agentHealth.errored > 0 ? 'var(--red-glow)' : 'var(--green-glow)',
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="text-center p-3 rounded-xl transition-all"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <p
                      className="text-xl font-bold tabular-nums"
                      style={{ fontFamily: 'var(--font-mono)', color: m.color }}
                    >
                      {m.value}
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      {m.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===== LIVE ACTIVITY TICKER ===== */}
          <div
            className="hidden md:block card-glass-premium px-5 py-3.5 overflow-hidden"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <Zap size={14} style={{ color: 'var(--amber)' }} />
                <span
                  className="text-xs font-bold tracking-wider"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--amber)',
                    textTransform: 'uppercase',
                  }}
                >
                  Live
                </span>
              </div>

              {/* Divider */}
              <div
                style={{
                  width: 1,
                  height: 20,
                  background: 'linear-gradient(180deg, transparent, var(--border), transparent)',
                }}
              />

              {/* Ticker content */}
              <div className="flex-1 overflow-hidden relative" style={{ height: 24 }}>
                {ACTIVITY_TICKER.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 absolute inset-0 transition-all"
                    style={{
                      opacity: tickerIndex === idx ? 1 : 0,
                      transform: tickerIndex === idx ? 'translateY(0)' : 'translateY(12px)',
                      transition: 'opacity 0.5s ease, transform 0.5s ease',
                    }}
                  >
                    <span style={{ color: item.color, display: 'flex', alignItems: 'center' }}>
                      {item.icon}
                    </span>
                    <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                      {item.text}
                    </span>
                    <span
                      className="text-xs shrink-0 ml-auto"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>

              {/* Ticker dots */}
              <div className="flex items-center gap-1.5 shrink-0">
                {ACTIVITY_TICKER.map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: tickerIndex === idx ? 16 : 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: tickerIndex === idx ? 'var(--amber)' : 'var(--border)',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ===== Inline styles for checkmark animation ===== */}
      <style>{`
        @keyframes checkmark-draw {
          from {
            stroke-dashoffset: 20;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
