'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  Sun,
  CloudSun,
  Sunset,
  Zap,
  Bot,
  Clock,
  ArrowRight,
  TrendingUp,
  Shield,
  FileSearch,
  Mail,
  Receipt,
  RotateCcw,
  Send,
  Eye,
  MousePointer,
  Phone,
  Calendar,
  ArrowRightLeft,
  CircleCheck,
  MailOpen,
  MailX,
  Bell,
  Info,
  XCircle,
  Settings,
  Sparkles,
  FileText,
  User,
  AlertTriangle,
  Plus,
  Search,
  BarChart3,
  MessageSquare,
  Check,
  RefreshCw,
  Trophy,
  Database,
  Server,
  Cpu,
  Wifi,
  HardDrive,
} from 'lucide-react';
import KPICard from '@/components/KPICard';
import StatusBadge from '@/components/StatusBadge';
import AIInsights from '@/components/AIInsights';
import { Sparkline as ForecastSparkline } from '@/components/MiniBarChart';

interface DashboardData {
  mrr: number;
  totalLeads: number;
  activeClients: number;
  pipelineValue: number;
  pipeline: { stage: string; count: number }[];
  agentHealth: { total: number; running: number; errored: number; avgScore: number };
  recentNightTasks: { id: string; task: string; status: string }[];
  pendingDecisions: { id: string; title: string; context: string }[];
  mailingStats: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalEmails: number;
  };
  financeStats: {
    revenue: number;
    outstanding: number;
    overdue: number;
    expenses: number;
    totalInvoices: number;
  };
  followUpStats: {
    dueToday: number;
    overdue: number;
  };
  trends: {
    leads: number;
    clients: number;
    won: number;
  };
  agents: {
    id: string;
    name: string;
    dept: string;
    status: string;
    score: number;
    tasksToday: number;
    errorsToday: number;
    lastRun: string | null;
  }[];
}

interface ForecastData {
  pipelineValue: number;
  avgDealSize: number;
  conversionRate: number;
  projectedRevenue: number;
  confidence: 'hoch' | 'mittel' | 'niedrig';
  monthlyTrend: number[];
}

/* -------------------------------------------------- */
/* Activity Event types + icon mapping                 */
/* -------------------------------------------------- */
interface ActivityEvent {
  id: string;
  type: string;
  action: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  timestamp: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  phone: <Phone size={14} />,
  mail: <Mail size={14} />,
  calendar: <Calendar size={14} />,
  'file-text': <FileText size={14} />,
  'arrow-right-left': <ArrowRightLeft size={14} />,
  activity: <Activity size={14} />,
  'mouse-pointer-click': <MousePointer size={14} />,
  'mail-open': <MailOpen size={14} />,
  'mail-x': <MailX size={14} />,
  send: <Send size={14} />,
  'circle-check': <CircleCheck size={14} />,
  'check-circle': <CheckCircle2 size={14} />,
  clock: <Clock size={14} />,
  'alert-triangle': <AlertTriangle size={14} />,
  user: <User size={14} />,
  settings: <Settings size={14} />,
  sparkles: <Sparkles size={14} />,
  info: <Info size={14} />,
  'x-circle': <XCircle size={14} />,
  bell: <Bell size={14} />,
  bot: <Bot size={14} />,
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  return `vor ${days} T`;
}

/* -------------------------------------------------- */
/* Follow-Up types + helpers                           */
/* -------------------------------------------------- */
interface FollowUpItem {
  id: string;
  leadId: string;
  lead: { id: string; firma: string } | null;
  subject: string;
  type: string;
  priority: number;
  dueDate: string;
  status: string;
}

const FOLLOW_UP_TYPE_ICONS: Record<string, React.ReactNode> = {
  email: <Mail size={15} />,
  call: <Phone size={15} />,
  meeting: <Calendar size={15} />,
  linkedin: <MessageSquare size={15} />,
};

function relativeDueDate(iso: string): { label: string; color: string } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(iso);
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `${Math.abs(diffDays)} T überfällig`, color: 'var(--red)' };
  if (diffDays === 0) return { label: 'heute', color: 'var(--amber)' };
  if (diffDays === 1) return { label: 'morgen', color: 'var(--green)' };
  return { label: `in ${diffDays} Tagen`, color: 'var(--green)' };
}

/* -------------------------------------------------- */
/* Greeting helper                                     */
/* -------------------------------------------------- */
function getGreetingConfig(hour: number): {
  greeting: string;
  icon: React.ReactNode;
  gradient: string;
} {
  if (hour >= 5 && hour < 12) {
    return {
      greeting: 'Guten Morgen',
      icon: <Sun size={28} style={{ color: 'var(--amber)' }} />,
      gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.04) 50%, transparent 100%)',
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      greeting: 'Guten Tag',
      icon: <CloudSun size={28} style={{ color: 'var(--blue)' }} />,
      gradient: 'linear-gradient(135deg, rgba(96,165,250,0.12) 0%, rgba(96,165,250,0.04) 50%, transparent 100%)',
    };
  }
  if (hour >= 17 && hour < 22) {
    return {
      greeting: 'Guten Abend',
      icon: <Sunset size={28} style={{ color: 'var(--purple)' }} />,
      gradient: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 50%, transparent 100%)',
    };
  }
  return {
    greeting: 'Gute Nacht',
    icon: <Moon size={28} style={{ color: 'var(--blue)' }} />,
    gradient: 'linear-gradient(135deg, rgba(30,58,138,0.15) 0%, rgba(96,165,250,0.06) 50%, transparent 100%)',
  };
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
/* Mini Sparkline SVG (deterministic pseudo-random)    */
/* -------------------------------------------------- */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function Sparkline({ seed, color }: { seed: number; color: string }) {
  const width = 60;
  const height = 24;
  const padding = 2;
  const rng = seededRandom(seed);
  const points: number[] = [];
  for (let i = 0; i < 7; i++) {
    points.push(rng() * 0.6 + 0.2 + (i / 6) * 0.15);
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((v, i) => ({
    x: padding + (i / 6) * (width - padding * 2),
    y: padding + (1 - (v - min) / range) * (height - padding * 2),
  }));

  const pathD = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');

  const areaD = `${pathD} L${coords[coords.length - 1].x.toFixed(1)},${height} L${coords[0].x.toFixed(1)},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={`spark-fill-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-fill-${seed})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={coords[coords.length - 1].x}
        cy={coords[coords.length - 1].y}
        r={2}
        fill={color}
      />
    </svg>
  );
}

/* -------------------------------------------------- */
/* Fallback activity ticker (used while API loads)     */
/* -------------------------------------------------- */
const FALLBACK_TICKER: ActivityEvent[] = [
  { id: '1', type: 'notification', action: 'system', title: 'System', description: 'Lade Live-Aktivitäten...', color: 'var(--amber)', icon: 'bot', timestamp: new Date().toISOString() },
];

/* -------------------------------------------------- */
/* Quick Action definitions                            */
/* -------------------------------------------------- */
const QUICK_ACTIONS = [
  {
    label: 'Neuer Lead',
    icon: Plus,
    route: '/crm',
    color: 'var(--amber)',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.2)',
  },
  {
    label: 'Neue Rechnung',
    icon: Receipt,
    route: '/finanzen',
    color: 'var(--green)',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.2)',
  },
  {
    label: 'Kampagne',
    icon: Mail,
    route: '/mailing',
    color: 'var(--purple)',
    bg: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.2)',
  },
  {
    label: 'Follow-Up',
    icon: RotateCcw,
    route: '/follow-up',
    color: 'var(--blue)',
    bg: 'rgba(96,165,250,0.1)',
    border: 'rgba(96,165,250,0.2)',
  },
  {
    label: 'Scraper',
    icon: Search,
    route: '/scraper',
    color: 'var(--orange)',
    bg: 'rgba(249,115,22,0.1)',
    border: 'rgba(249,115,22,0.2)',
  },
  {
    label: 'Analytics',
    icon: BarChart3,
    route: '/analytics',
    color: 'var(--cyan)',
    bg: 'rgba(34,211,238,0.1)',
    border: 'rgba(34,211,238,0.2)',
  },
];

/* ================================================== */
/* MAIN DASHBOARD                                      */
/* ================================================== */
export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(FALLBACK_TICKER);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<FollowUpItem[]>([]);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [timePeriod, setTimePeriod] = useState<'today' | 'week' | 'month' | 'quarter'>('month');
  const [liveTime, setLiveTime] = useState(() => new Date());

  // ===== SYSTEM STATUS BAR STATE =====
  const [systemBootTime] = useState(() => new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 - 7 * 60 * 60 * 1000 - 23 * 60 * 1000));
  const [systemUptime, setSystemUptime] = useState('');
  const [systemLoad, setSystemLoad] = useState(42);
  const [systemLastSync, setSystemLastSync] = useState(() => new Date());
  const [systemServices, setSystemServices] = useState<
    { name: string; status: 'ok' | 'warning' | 'error'; icon: React.ReactNode }[]
  >([
    { name: 'Database', status: 'ok', icon: <Database size={13} /> },
    { name: 'API', status: 'ok', icon: <Server size={13} /> },
    { name: 'Agents', status: 'ok', icon: <Cpu size={13} /> },
    { name: 'Scraper', status: 'ok', icon: <Wifi size={13} /> },
    { name: 'Mailing', status: 'ok', icon: <Mail size={13} /> },
  ]);

  // Uptime counter - updates every second
  useEffect(() => {
    const updateUptime = () => {
      const diff = Date.now() - systemBootTime.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setSystemUptime(
        `${days}d ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };
    updateUptime();
    const tick = setInterval(updateUptime, 1000);
    return () => clearInterval(tick);
  }, [systemBootTime]);

  // Simulate fluctuating system load + occasional status changes
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemLoad((prev) => {
        const delta = (Math.random() - 0.48) * 8;
        return Math.min(85, Math.max(15, prev + delta));
      });
      setSystemLastSync(new Date());
      // Occasionally simulate a service status change
      setSystemServices((prev) =>
        prev.map((svc) => {
          const roll = Math.random();
          if (roll > 0.97) return { ...svc, status: 'warning' as const };
          if (roll > 0.995) return { ...svc, status: 'error' as const };
          if (roll < 0.85 && svc.status !== 'ok') return { ...svc, status: 'ok' as const };
          return svc;
        })
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Live clock - updates every second
  useEffect(() => {
    const tick = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Fetch forecast data
  useEffect(() => {
    fetch('/api/dashboard/forecast')
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setForecast(d);
      })
      .catch(() => {});
  }, []);

  // Update current hour every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const greetingConfig = useMemo(() => getGreetingConfig(currentHour), [currentHour]);

  // Fetch upcoming follow-ups
  const loadFollowUps = useCallback(() => {
    fetch('/api/follow-up?limit=5&status=pending')
      .then((r) => r.json())
      .then((d) => {
        if (d.followUps) {
          setUpcomingFollowUps(d.followUps);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadFollowUps();
    const interval = setInterval(loadFollowUps, 30000);
    return () => clearInterval(interval);
  }, [loadFollowUps]);

  // Follow-up quick actions
  const handleCompleteFollowUp = useCallback((id: string) => {
    fetch('/api/follow-up', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'complete' }),
    })
      .then((r) => {
        if (r.ok) {
          setUpcomingFollowUps((prev) => prev.filter((f) => f.id !== id));
          loadFollowUps();
        }
      })
      .catch(() => {});
  }, [loadFollowUps]);

  const handleRescheduleFollowUp = useCallback((id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    fetch('/api/follow-up', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'reschedule', newDueDate: tomorrow.toISOString() }),
    })
      .then((r) => {
        if (r.ok) loadFollowUps();
      })
      .catch(() => {});
  }, [loadFollowUps]);

  useEffect(() => {
    const loadData = () => {
      setIsRefreshing(true);
      return fetch('/api/dashboard')
        .then((r) => r.json())
        .then((d) => {
          setLastRefresh(new Date());
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
            mailingStats: d.mailingStats ?? {
              totalCampaigns: 0, activeCampaigns: 0, totalSent: 0,
              totalOpened: 0, totalClicked: 0, totalEmails: 0,
            },
            financeStats: d.financeStats ?? {
              revenue: 0, outstanding: 0, overdue: 0, expenses: 0, totalInvoices: 0,
            },
            followUpStats: d.followUpStats ?? { dueToday: 0, overdue: 0 },
            trends: d.trends ?? { leads: 0, clients: 0, won: 0 },
            agents: (d.agents ?? []).map(
              (a: { id: string; name: string; dept: string; status: string; score: number; tasksToday: number; errorsToday: number; lastRun: string | null }) => ({
                id: a.id, name: a.name, dept: a.dept, status: a.status,
                score: a.score, tasksToday: a.tasksToday, errorsToday: a.errorsToday, lastRun: a.lastRun,
              })
            ),
          });
        })
        .catch(() => {})
        .finally(() => setIsRefreshing(false));
    };
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Manual refresh handler
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => {
        setLastRefresh(new Date());
        setData({
          mrr: d.kpis?.mrr ?? d.mrr ?? 0,
          totalLeads: d.kpis?.totalLeads ?? d.totalLeads ?? 0,
          activeClients: d.kpis?.activeClients ?? d.activeClients ?? 0,
          pipelineValue: d.kpis?.pipelineValue ?? d.pipelineValue ?? 0,
          pipeline: d.pipeline ?? [],
          agentHealth: d.agentHealth ?? { total: 0, running: 0, errored: 0, avgScore: 0 },
          recentNightTasks: (d.recentTasks ?? d.recentNightTasks ?? []).map(
            (t: { id: string; task: string; status: string }) => ({
              id: t.id, task: t.task, status: t.status,
            })
          ),
          pendingDecisions: (d.pendingDecisions ?? []).map(
            (dec: { id: string; title: string; context: string }) => ({
              id: dec.id, title: dec.title, context: dec.context,
            })
          ),
          mailingStats: d.mailingStats ?? {
            totalCampaigns: 0, activeCampaigns: 0, totalSent: 0,
            totalOpened: 0, totalClicked: 0, totalEmails: 0,
          },
          financeStats: d.financeStats ?? {
            revenue: 0, outstanding: 0, overdue: 0, expenses: 0, totalInvoices: 0,
          },
          followUpStats: d.followUpStats ?? { dueToday: 0, overdue: 0 },
          trends: d.trends ?? { leads: 0, clients: 0, won: 0 },
          agents: (d.agents ?? []).map(
            (a: { id: string; name: string; dept: string; status: string; score: number; tasksToday: number; errorsToday: number; lastRun: string | null }) => ({
              id: a.id, name: a.name, dept: a.dept, status: a.status,
              score: a.score, tasksToday: a.tasksToday, errorsToday: a.errorsToday, lastRun: a.lastRun,
            })
          ),
        });
      })
      .catch(() => {})
      .finally(() => setIsRefreshing(false));
  };

  // Fetch live activity events
  useEffect(() => {
    const loadActivity = () =>
      fetch('/api/activity?limit=8')
        .then((r) => r.json())
        .then((d) => {
          if (d.events && d.events.length > 0) {
            setActivityEvents(d.events);
          }
        })
        .catch(() => {});
    loadActivity();
    const interval = setInterval(loadActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  // Rotate activity ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % activityEvents.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [activityEvents.length]);

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
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div>
              <div className="skeleton h-8 w-48 rounded-xl mb-2" />
              <div className="skeleton h-4 w-72 rounded-lg" />
            </div>
            <div className="skeleton h-9 w-24 rounded-xl" />
          </div>

          {/* Quick Actions skeleton */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-[72px] rounded-xl" />
            ))}
          </div>

          {/* KPI cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-36 rounded-xl" />
            ))}
          </div>

          {/* Pipeline + Agents skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 skeleton h-80 rounded-xl" />
            <div className="skeleton h-80 rounded-xl" />
          </div>

          {/* Bottom row skeleton */}
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

          {/* ===== HEADER / GREETING ===== */}
          <div
            className="card-glass-premium p-4 md:p-6 lg:p-7"
            style={{
              animationDelay: '0ms',
              background: greetingConfig.gradient,
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 md:gap-4">
              {/* Left: greeting + date + status */}
              <div className="flex items-start gap-3 md:gap-4">
                {/* Time-of-day icon */}
                <div
                  className="flex items-center justify-center rounded-xl mt-0.5"
                  style={{
                    width: 48,
                    height: 48,
                    minWidth: 48,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {greetingConfig.icon}
                </div>

                <div>
                  <h1
                    className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                  >
                    {greetingConfig.greeting}
                  </h1>
                  <p
                    className="text-sm mt-1 flex items-center gap-2"
                    style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {dateString}
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {liveTime.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </p>
                  <p
                    className="text-xs mt-2"
                    style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    <span style={{ color: 'var(--amber)' }}>
                      {(data.followUpStats.dueToday + data.followUpStats.overdue)} Follow-Ups fällig
                    </span>
                    {' · '}
                    <span style={{ color: 'var(--blue)' }}>
                      {data.totalLeads} offene Leads
                    </span>
                    {' · '}
                    <span style={{ color: 'var(--red)' }}>
                      {data.financeStats.outstanding} Rechnungen ausstehend
                    </span>
                  </p>
                </div>
              </div>

              {/* Right: refresh + live badge */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Refresh button with timestamp */}
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all duration-200"
                  style={{
                    backgroundColor: isRefreshing ? 'rgba(245,158,11,0.08)' : 'rgba(139,143,163,0.06)',
                    color: isRefreshing ? 'var(--amber)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    border: 'none',
                    cursor: isRefreshing ? 'wait' : 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!isRefreshing) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(245,158,11,0.08)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--amber)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRefreshing) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,143,163,0.06)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                    }
                  }}
                  title="Dashboard aktualisieren"
                >
                  <RefreshCw
                    size={12}
                    style={{
                      animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                    }}
                  />
                  {lastRefresh
                    ? lastRefresh.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : 'Laden...'}
                </button>

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

          {/* ===== TIME PERIOD FILTER ===== */}
          <div className="flex items-center gap-2">
            {([
              { key: 'today' as const, label: 'Heute' },
              { key: 'week' as const, label: 'Woche' },
              { key: 'month' as const, label: 'Monat' },
              { key: 'quarter' as const, label: 'Quartal' },
            ]).map((p) => (
              <button
                key={p.key}
                onClick={() => setTimePeriod(p.key)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
                style={{
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: timePeriod === p.key ? 'var(--amber)' : 'rgba(255,255,255,0.04)',
                  color: timePeriod === p.key ? '#000' : 'var(--text-muted)',
                  border: timePeriod === p.key ? 'none' : '1px solid var(--border)',
                  boxShadow: timePeriod === p.key ? '0 0 12px var(--amber-glow)' : 'none',
                }}
              >
                {p.label}
              </button>
            ))}
            <span
              className="ml-auto text-[10px]"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {timePeriod === 'today' ? 'Heute' : timePeriod === 'week' ? 'Letzte 7 Tage' : timePeriod === 'month' ? 'Letzter Monat' : 'Letztes Quartal'}
            </span>
          </div>

          {/* ===== KPI CARDS ===== */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 stagger-children">
            <KPICard
              label="MRR"
              value={data.mrr}
              prefix="CHF "
              trend={data.trends.clients}
              color="var(--green)"
              icon={<DollarSign size={20} style={{ color: 'var(--green)' }} />}
              delay={0}
            />
            <KPICard
              label="Pipeline Value"
              value={data.pipelineValue}
              prefix="CHF "
              trend={data.trends.won}
              color="var(--amber)"
              icon={<Target size={20} style={{ color: 'var(--amber)' }} />}
              delay={80}
            />
            <KPICard
              label="Total Leads"
              value={data.totalLeads}
              trend={data.trends.leads}
              color="var(--blue)"
              icon={<Users size={20} style={{ color: 'var(--blue)' }} />}
              delay={160}
            />
            <KPICard
              label="Active Clients"
              value={data.activeClients}
              trend={data.trends.clients}
              color="var(--green)"
              icon={<UserCheck size={20} style={{ color: 'var(--green)' }} />}
              delay={240}
            />
          </div>

          {/* ===== REVENUE FORECAST ===== */}
          {forecast && (
            <div
              className="card-glass-premium p-4 md:p-6 lg:p-7"
              style={{ animation: 'fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) 300ms both' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 md:mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(96,165,250,0.15))',
                    }}
                  >
                    <TrendingUp size={18} style={{ color: 'var(--green)' }} />
                  </div>
                  <div>
                    <h2
                      className="text-sm font-bold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                    >
                      UMSATZPROGNOSE
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Prognose nächster Monat
                    </p>
                  </div>
                </div>
                {/* Confidence badge */}
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{
                    background:
                      forecast.confidence === 'hoch'
                        ? 'rgba(34,197,94,0.1)'
                        : forecast.confidence === 'mittel'
                          ? 'rgba(245,158,11,0.1)'
                          : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${
                      forecast.confidence === 'hoch'
                        ? 'rgba(34,197,94,0.2)'
                        : forecast.confidence === 'mittel'
                          ? 'rgba(245,158,11,0.2)'
                          : 'rgba(239,68,68,0.2)'
                    }`,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor:
                        forecast.confidence === 'hoch'
                          ? 'var(--green)'
                          : forecast.confidence === 'mittel'
                            ? 'var(--amber)'
                            : 'var(--red)',
                    }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color:
                        forecast.confidence === 'hoch'
                          ? 'var(--green)'
                          : forecast.confidence === 'mittel'
                            ? 'var(--amber)'
                            : 'var(--red)',
                    }}
                  >
                    Konfidenz: {forecast.confidence}
                  </span>
                </div>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 items-center">
                {/* Projected Revenue + Sparkline */}
                <div className="md:col-span-2 flex items-center gap-4">
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Projizierter Umsatz
                    </p>
                    <p
                      className="text-2xl md:text-3xl font-bold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                    >
                      CHF {forecast.projectedRevenue.toLocaleString('de-CH')}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <ForecastSparkline
                      data={forecast.monthlyTrend}
                      width={120}
                      height={36}
                      color="var(--green)"
                      filled
                    />
                  </div>
                </div>

                {/* Pipeline Value */}
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Pipeline-Wert
                  </p>
                  <p
                    className="text-lg font-bold"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
                  >
                    CHF {forecast.pipelineValue.toLocaleString('de-CH')}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Qualified + Proposal
                  </p>
                </div>

                {/* Conversion Rate + Avg Deal */}
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Conversion Rate
                    </p>
                    <p
                      className="text-lg font-bold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}
                    >
                      {forecast.conversionRate.toLocaleString('de-CH')}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Durchschn. Deal
                    </p>
                    <p
                      className="text-sm font-bold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
                    >
                      CHF {forecast.avgDealSize.toLocaleString('de-CH')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== QUICK ACTIONS ===== */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {QUICK_ACTIONS.map((action, idx) => (
              <button
                key={action.label}
                onClick={() => router.push(action.route)}
                className="card-glass-premium p-3 md:p-4 flex flex-col items-center gap-2 transition-all group"
                style={{
                  animation: `fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 60}ms both`,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = action.border;
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = `0 8px 24px ${action.bg}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: action.bg }}
                >
                  <action.icon size={18} style={{ color: action.color }} />
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
                >
                  {action.label}
                </span>
              </button>
            ))}
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

          {/* ===== SYSTEM OVERVIEW: Mailing, Finanzen, Follow-Up ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 stagger-children">

            {/* Mailing Overview */}
            <a
              href="/mailing"
              className="card-glass-premium p-4 md:p-6 transition-all group cursor-pointer"
              style={{ textDecoration: 'none' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.transform = '';
              }}
            >
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--purple-glow)' }}
                >
                  <Mail size={16} style={{ color: 'var(--purple)' }} />
                </div>
                <h2
                  className="text-sm font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  MAILING
                </h2>
                <div className="ml-auto flex items-center gap-2">
                  <Sparkline seed={42} color="var(--purple)" />
                  <ArrowRight
                    size={14}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-muted)' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Send size={12} style={{ color: 'var(--purple)' }} />
                    <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}>
                      {data.mailingStats.totalSent}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Gesendet</span>
                </div>
                <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Eye size={12} style={{ color: 'var(--green)' }} />
                    <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
                      {data.mailingStats.totalSent > 0 ? Math.round((data.mailingStats.totalOpened / data.mailingStats.totalSent) * 100) : 0}%
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Open Rate</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>{data.mailingStats.totalCampaigns} Kampagnen</span>
                <span>{data.mailingStats.totalEmails} E-Mails total</span>
              </div>
            </a>

            {/* Finanzen Overview */}
            <a
              href="/finanzen"
              className="card-glass-premium p-4 md:p-6 transition-all group cursor-pointer"
              style={{ textDecoration: 'none' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(34,197,94,0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.transform = '';
              }}
            >
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--green-glow)' }}
                >
                  <Receipt size={16} style={{ color: 'var(--green)' }} />
                </div>
                <h2
                  className="text-sm font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  FINANZEN
                </h2>
                <div className="ml-auto flex items-center gap-2">
                  <Sparkline seed={137} color="var(--green)" />
                  <ArrowRight
                    size={14}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-muted)' }}
                  />
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Umsatz</span>
                  <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
                    CHF {data.financeStats.revenue.toLocaleString('de-CH')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Ausstehend</span>
                  <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
                    CHF {data.financeStats.outstanding.toLocaleString('de-CH')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Ausgaben</span>
                  <span className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>
                    CHF {data.financeStats.expenses.toLocaleString('de-CH')}
                  </span>
                </div>
              </div>

              <div
                className="pt-3 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {data.financeStats.totalInvoices} Rechnungen
                </span>
                {data.financeStats.overdue > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--red-glow)', color: 'var(--red)' }}>
                    {data.financeStats.overdue} überfällig
                  </span>
                )}
              </div>
            </a>

            {/* Follow-Up Overview */}
            <a
              href="/follow-up"
              className="card-glass-premium p-4 md:p-6 transition-all group cursor-pointer"
              style={{ textDecoration: 'none' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.transform = '';
              }}
            >
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--amber-glow)' }}
                >
                  <RotateCcw size={16} style={{ color: 'var(--amber)' }} />
                </div>
                <h2
                  className="text-sm font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  FOLLOW-UP
                </h2>
                <div className="ml-auto flex items-center gap-2">
                  <Sparkline seed={256} color="var(--amber)" />
                  <ArrowRight
                    size={14}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-muted)' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Clock size={12} style={{ color: 'var(--amber)' }} />
                    <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
                      {data.followUpStats.dueToday}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Heute fällig</span>
                </div>
                <div className="text-center p-3 rounded-xl" style={{
                  backgroundColor: data.followUpStats.overdue > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
                  border: data.followUpStats.overdue > 0 ? '1px solid rgba(239,68,68,0.15)' : '1px solid var(--border)',
                }}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <AlertCircle size={12} style={{ color: data.followUpStats.overdue > 0 ? 'var(--red)' : 'var(--text-muted)' }} />
                    <span className="text-lg font-bold tabular-nums" style={{
                      fontFamily: 'var(--font-mono)',
                      color: data.followUpStats.overdue > 0 ? 'var(--red)' : 'var(--text-muted)',
                    }}>
                      {data.followUpStats.overdue}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Überfällig</span>
                </div>
              </div>

              {data.followUpStats.overdue > 0 ? (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--red)' }}>
                  <AlertCircle size={12} />
                  <span>{data.followUpStats.overdue} Follow-Ups brauchen Aufmerksamkeit</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--green)' }}>
                  <CheckCircle2 size={12} />
                  <span>Alle Follow-Ups im Zeitplan</span>
                </div>
              )}
            </a>
          </div>

          {/* ===== ACTIVITY TIMELINE + LIVE TICKER ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Full Activity Timeline */}
            <div className="lg:col-span-2 card-glass-premium p-4 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'var(--amber-glow)' }}
                  >
                    <Activity size={16} style={{ color: 'var(--amber)' }} />
                  </div>
                  <div>
                    <h2
                      className="text-sm font-bold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                    >
                      AKTIVITÄTEN
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Letzte Ereignisse
                    </p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.15)',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: 'var(--amber)',
                      display: 'inline-block',
                      animation: 'pulse-green 2s infinite',
                    }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}
                  >
                    Live
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                {activityEvents.map((event, idx) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-xl transition-all group"
                    style={{
                      animation: `fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 60}ms both`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: `${event.color}15`,
                          color: event.color,
                        }}
                      >
                        {ICON_MAP[event.icon] || <Zap size={14} />}
                      </div>
                      {idx < activityEvents.length - 1 && (
                        <div
                          style={{
                            width: 1,
                            height: 20,
                            marginTop: 4,
                            background: 'linear-gradient(180deg, var(--border), transparent)',
                          }}
                        />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: 'var(--text)' }}
                        >
                          {event.title}
                        </p>
                        <span
                          className="text-xs shrink-0"
                          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                        >
                          {timeAgo(event.timestamp)}
                        </span>
                      </div>
                      <p
                        className="text-xs mt-0.5 truncate"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {event.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Health / Quick Stats Sidebar */}
            <div className="card-glass-premium p-4 md:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--green-glow)' }}
                >
                  <Shield size={16} style={{ color: 'var(--green)' }} />
                </div>
                <h2
                  className="text-sm font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  SYSTEM HEALTH
                </h2>
              </div>

              <div className="space-y-4">
                {/* System metrics */}
                {[
                  { label: 'API Status', value: 'Online', color: 'var(--green)', icon: <Zap size={14} /> },
                  { label: 'Datenbank', value: 'Healthy', color: 'var(--green)', icon: <Shield size={14} /> },
                  { label: 'AI Agents', value: `${data.agentHealth.running}/${data.agentHealth.total} aktiv`, color: data.agentHealth.errored > 0 ? 'var(--amber)' : 'var(--green)', icon: <Bot size={14} /> },
                  { label: 'Night Shift', value: data.recentNightTasks.length > 0 ? `${data.recentNightTasks.filter(t => t.status === 'done' || t.status === 'completed').length} erledigt` : 'Idle', color: 'var(--purple)', icon: <Moon size={14} /> },
                  { label: 'Mailing Queue', value: `${data.mailingStats.totalSent} gesendet`, color: 'var(--blue)', icon: <Mail size={14} /> },
                ].map((metric, idx) => (
                  <div
                    key={metric.label}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border)',
                      animation: `fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 80}ms both`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${metric.color}15`, color: metric.color }}
                    >
                      {metric.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {metric.label}
                      </p>
                      <p
                        className="text-sm font-medium"
                        style={{ color: metric.color, fontFamily: 'var(--font-mono)' }}
                      >
                        {metric.value}
                      </p>
                    </div>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: metric.color,
                        boxShadow: `0 0 8px ${metric.color}60`,
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Uptime */}
              <div
                className="mt-5 pt-4 text-center"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>System Uptime</p>
                <p
                  className="text-lg font-bold mt-1"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
                >
                  99.9%
                </p>
              </div>
            </div>
          </div>

          {/* ===== NÄCHSTE FOLLOW-UPS ===== */}
          <div className="card-glass-premium p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(96,165,250,0.12)' }}
                >
                  <RotateCcw size={16} style={{ color: 'var(--blue)' }} />
                </div>
                <h2
                  className="text-sm font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  NÄCHSTE FOLLOW-UPS
                </h2>
                {upcomingFollowUps.length > 0 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: 'rgba(96,165,250,0.12)',
                      color: 'var(--blue)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {upcomingFollowUps.length}
                  </span>
                )}
              </div>
              <a
                href="/follow-up"
                className="flex items-center gap-1.5 text-xs font-medium transition-all"
                style={{
                  color: 'var(--blue)',
                  fontFamily: 'var(--font-mono)',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Alle anzeigen
                <ArrowRight size={12} />
              </a>
            </div>

            {/* Follow-up list */}
            {upcomingFollowUps.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2
                  size={32}
                  style={{ color: 'var(--green)', margin: '0 auto 8px', opacity: 0.6 }}
                />
                <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
                  Keine anstehenden Follow-Ups
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingFollowUps.map((fu, idx) => {
                  const due = relativeDueDate(fu.dueDate);
                  const typeIcon = FOLLOW_UP_TYPE_ICONS[fu.type] || <Mail size={15} />;
                  const typeColors: Record<string, string> = {
                    email: 'var(--purple)',
                    call: 'var(--green)',
                    meeting: 'var(--amber)',
                    linkedin: 'var(--blue)',
                  };
                  const iconColor = typeColors[fu.type] || 'var(--blue)';

                  return (
                    <div
                      key={fu.id}
                      className="group flex items-center gap-3 p-3 rounded-xl transition-all"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border)',
                        animation: `fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 60}ms both`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(96,165,250,0.04)';
                        e.currentTarget.style.borderColor = 'rgba(96,165,250,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                    >
                      {/* Type icon */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${iconColor}15`,
                          color: iconColor,
                        }}
                      >
                        {typeIcon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-semibold truncate"
                            style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-sans)' }}
                          >
                            {fu.lead?.firma || 'Unbekannt'}
                          </span>
                        </div>
                        <p
                          className="text-xs truncate mt-0.5"
                          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}
                        >
                          {fu.subject}
                        </p>
                      </div>

                      {/* Due date */}
                      <span
                        className="text-xs font-medium shrink-0 px-2 py-0.5 rounded-full"
                        style={{
                          color: due.color,
                          backgroundColor: `${due.color}12`,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {due.label}
                      </span>

                      {/* Quick actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCompleteFollowUp(fu.id);
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                          style={{
                            backgroundColor: 'rgba(34,197,94,0.1)',
                            color: 'var(--green)',
                            border: '1px solid rgba(34,197,94,0.2)',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.2)';
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.1)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          title="Erledigt"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRescheduleFollowUp(fu.id);
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                          style={{
                            backgroundColor: 'rgba(245,158,11,0.1)',
                            color: 'var(--amber)',
                            border: '1px solid rgba(245,158,11,0.2)',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.2)';
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.1)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          title="Verschieben"
                        >
                          <Clock size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ===== AI BUSINESS INSIGHTS ===== */}
          {(() => {
            const insights: { text: string; severity: 'info' | 'warning' | 'success'; icon: typeof Sparkles }[] = [];

            // Generate dynamic insights based on data
            if (data.followUpStats.overdue > 0) {
              insights.push({
                text: `${data.followUpStats.overdue} Follow-Ups sind ueberfaellig und brauchen sofortige Aufmerksamkeit`,
                severity: 'warning',
                icon: AlertTriangle,
              });
            }
            if (data.financeStats.overdue > 0) {
              insights.push({
                text: `${data.financeStats.overdue} Rechnungen sind ueberfaellig (CHF ${data.financeStats.outstanding.toLocaleString('de-CH')})`,
                severity: 'warning',
                icon: AlertTriangle,
              });
            }
            if (data.trends.leads > 0) {
              insights.push({
                text: `Lead-Zuwachs: +${data.trends.leads} neue Leads diesen Monat`,
                severity: 'success',
                icon: TrendingUp,
              });
            }
            if (data.agentHealth.errored > 0) {
              insights.push({
                text: `${data.agentHealth.errored} Agent(en) zeigen Fehler - Ueberpruefen empfohlen`,
                severity: 'warning',
                icon: AlertCircle,
              });
            }
            if (data.pipelineValue > 50000) {
              insights.push({
                text: `Pipeline-Wert bei CHF ${data.pipelineValue.toLocaleString('de-CH')} - starkes Quartal`,
                severity: 'success',
                icon: TrendingUp,
              });
            }
            if (data.mailingStats.totalOpened > 0 && data.mailingStats.totalSent > 0) {
              const openRate = Math.round((data.mailingStats.totalOpened / data.mailingStats.totalSent) * 100);
              insights.push({
                text: `E-Mail Oeffnungsrate bei ${openRate}% - ${openRate > 25 ? 'ueberdurchschnittlich' : 'Optimierung empfohlen'}`,
                severity: openRate > 25 ? 'success' : 'info',
                icon: openRate > 25 ? CheckCircle2 : Info,
              });
            }
            if (data.followUpStats.dueToday > 3) {
              insights.push({
                text: `${data.followUpStats.dueToday} Follow-Ups fuer heute geplant - produktiver Tag`,
                severity: 'info',
                icon: Calendar,
              });
            }

            if (insights.length === 0) {
              insights.push({
                text: 'Alle Systeme laufen reibungslos - keine dringenden Aktionen',
                severity: 'success',
                icon: CheckCircle2,
              });
            }

            const severityConfig = {
              warning: { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)', color: 'var(--amber)', glow: 'var(--amber-glow)' },
              success: { bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.15)', color: 'var(--green)', glow: 'var(--green-glow)' },
              info: { bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.15)', color: 'var(--blue)', glow: 'var(--blue-glow)' },
            };

            return (
              <div className="card-glass-premium p-5" style={{ animationDelay: '350ms' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(96,165,250,0.15))', border: '1px solid rgba(139,92,246,0.2)' }}
                  >
                    <Sparkles size={15} style={{ color: 'var(--purple)' }} />
                  </div>
                  <h2
                    className="text-sm font-bold"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                  >
                    AI Insights
                  </h2>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full ml-auto"
                    style={{
                      background: 'rgba(139,92,246,0.1)',
                      color: 'var(--purple)',
                      fontFamily: 'var(--font-mono)',
                      border: '1px solid rgba(139,92,246,0.2)',
                    }}
                  >
                    {insights.length} Insights
                  </span>
                </div>
                <div className="space-y-2">
                  {insights.slice(0, 5).map((insight, idx) => {
                    const cfg = severityConfig[insight.severity];
                    const Icon = insight.icon;
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-lg transition-all"
                        style={{
                          backgroundColor: cfg.bg,
                          border: `1px solid ${cfg.border}`,
                        }}
                      >
                        <Icon size={14} style={{ color: cfg.color, marginTop: 1, flexShrink: 0 }} />
                        <span
                          className="text-xs leading-relaxed"
                          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}
                        >
                          {insight.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ===== TEAM LEADERBOARD ===== */}
          {data.agents.length > 0 && (() => {
            const ranked = [...data.agents]
              .map((a) => {
                const totalTasks = a.tasksToday;
                const successRate = totalTasks > 0
                  ? Math.round(((totalTasks - a.errorsToday) / totalTasks) * 100)
                  : 0;
                return { ...a, successRate };
              })
              .sort((a, b) => b.score - a.score || b.successRate - a.successRate)
              .slice(0, 5);

            const RANK_COLORS: Record<number, { color: string; bg: string; glow: string; label: string }> = {
              0: { color: 'var(--amber)', bg: 'rgba(245,158,11,0.15)', glow: 'var(--amber-glow)', label: '#1' },
              1: { color: 'var(--text-secondary)', bg: 'rgba(139,143,163,0.12)', glow: 'rgba(139,143,163,0.08)', label: '#2' },
              2: { color: 'var(--orange)', bg: 'rgba(249,115,22,0.15)', glow: 'rgba(249,115,22,0.08)', label: '#3' },
            };

            return (
              <div className="card-glass-premium p-4 md:p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}
                    >
                      <Trophy size={16} style={{ color: 'var(--amber)' }} />
                    </div>
                    <div>
                      <h2
                        className="text-sm font-bold"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                      >
                        TEAM LEADERBOARD
                      </h2>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
                        Top-Agenten nach Score
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{
                      backgroundColor: 'rgba(245,158,11,0.12)',
                      color: 'var(--amber)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {data.agents.length} Agenten
                  </span>
                </div>

                {/* Leaderboard rows */}
                <div className="space-y-2">
                  {ranked.map((agent, idx) => {
                    const rank = RANK_COLORS[idx];
                    const isFirst = idx === 0;
                    const initials = agent.name
                      .split(/[\s_-]+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0].toUpperCase())
                      .join('');
                    const rankColor = rank?.color ?? 'var(--text-muted)';
                    const rankBg = rank?.bg ?? 'rgba(74,78,99,0.1)';

                    return (
                      <div
                        key={agent.id}
                        className="group flex items-center gap-3 p-3 rounded-xl transition-all"
                        style={{
                          backgroundColor: isFirst ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)',
                          border: isFirst ? '1px solid rgba(245,158,11,0.15)' : '1px solid var(--border)',
                          animation: `fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 80}ms both`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isFirst ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.04)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isFirst ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        {/* Rank badge */}
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: rankBg,
                            boxShadow: isFirst ? `0 0 12px ${rank?.glow ?? 'transparent'}` : 'none',
                          }}
                        >
                          <span
                            className="text-xs font-bold"
                            style={{ fontFamily: 'var(--font-mono)', color: rankColor }}
                          >
                            {rank?.label ?? `#${idx + 1}`}
                          </span>
                        </div>

                        {/* Avatar circle */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: isFirst
                              ? 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(249,115,22,0.25))'
                              : 'linear-gradient(135deg, rgba(96,165,250,0.15), rgba(139,92,246,0.15))',
                            border: `1px solid ${isFirst ? 'rgba(245,158,11,0.3)' : 'rgba(96,165,250,0.2)'}`,
                          }}
                        >
                          <span
                            className="text-xs font-bold"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              color: isFirst ? 'var(--amber)' : 'var(--blue)',
                            }}
                          >
                            {initials}
                          </span>
                        </div>

                        {/* Name + dept */}
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-sans)' }}
                          >
                            {agent.name}
                          </p>
                          <p
                            className="text-xs truncate"
                            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                          >
                            {agent.dept}
                          </p>
                        </div>

                        {/* Tasks completed */}
                        <div className="text-center shrink-0 hidden sm:block" style={{ minWidth: 48 }}>
                          <p
                            className="text-sm font-bold tabular-nums"
                            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                          >
                            {agent.tasksToday}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            Tasks
                          </p>
                        </div>

                        {/* Success rate with mini progress bar */}
                        <div className="shrink-0 hidden sm:block" style={{ minWidth: 64 }}>
                          <div className="flex items-center justify-end gap-1.5 mb-1">
                            <span
                              className="text-xs font-bold tabular-nums"
                              style={{
                                fontFamily: 'var(--font-mono)',
                                color: agent.successRate >= 80 ? 'var(--green)' : agent.successRate >= 50 ? 'var(--amber)' : 'var(--red)',
                              }}
                            >
                              {agent.successRate}%
                            </span>
                          </div>
                          <div
                            className="h-1 rounded-full overflow-hidden"
                            style={{ backgroundColor: 'rgba(255,255,255,0.06)', width: 64 }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${agent.successRate}%`,
                                background: agent.successRate >= 80
                                  ? 'linear-gradient(90deg, var(--green), #16a34a)'
                                  : agent.successRate >= 50
                                    ? 'linear-gradient(90deg, var(--amber), #d97706)'
                                    : 'linear-gradient(90deg, var(--red), #dc2626)',
                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                              }}
                            />
                          </div>
                        </div>

                        {/* Score with glow on #1 */}
                        <div
                          className="text-center shrink-0 px-2.5 py-1.5 rounded-lg"
                          style={{
                            minWidth: 52,
                            backgroundColor: isFirst ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
                            border: isFirst ? '1px solid rgba(245,158,11,0.2)' : '1px solid var(--border)',
                            boxShadow: isFirst ? '0 0 16px var(--amber-glow)' : 'none',
                          }}
                        >
                          <p
                            className="text-sm font-bold tabular-nums"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              color: isFirst ? 'var(--amber)' : 'var(--text)',
                              textShadow: isFirst ? '0 0 8px var(--amber-glow)' : 'none',
                            }}
                          >
                            {agent.score}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            Score
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ===== ONBOARDING CHECKLIST ===== */}
          {data && (() => {
            const steps = [
              {
                label: 'Leads importieren',
                done: data.totalLeads > 0,
                href: '/crm',
                icon: <Users size={14} />,
                color: 'var(--blue)',
              },
              {
                label: 'Erste E-Mail senden',
                done: (data.mailingStats?.totalSent ?? 0) > 0,
                href: '/mailing',
                icon: <Send size={14} />,
                color: 'var(--purple)',
              },
              {
                label: 'Rechnung erstellen',
                done: (data.financeStats?.totalInvoices ?? 0) > 0,
                href: '/finanzen',
                icon: <Receipt size={14} />,
                color: 'var(--green)',
              },
              {
                label: 'Follow-Up planen',
                done: (data.followUpStats?.dueToday ?? 0) > 0 || (data.followUpStats?.overdue ?? 0) > 0,
                href: '/follow-up',
                icon: <RotateCcw size={14} />,
                color: 'var(--amber)',
              },
              {
                label: 'Night Shift starten',
                done: data.recentNightTasks.length > 0,
                href: '/nightshift',
                icon: <Moon size={14} />,
                color: 'var(--cyan)',
              },
            ];
            const completedCount = steps.filter((s) => s.done).length;
            const pct = Math.round((completedCount / steps.length) * 100);

            // Hide when all steps are done
            if (completedCount === steps.length) return null;

            return (
              <div className="card-glass-premium p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(245,158,11,0.12)' }}
                    >
                      <Sparkles size={16} style={{ color: 'var(--amber)' }} />
                    </div>
                    <h2
                      className="text-sm font-bold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                    >
                      ERSTE SCHRITTE
                    </h2>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: 'rgba(245,158,11,0.12)',
                        color: 'var(--amber)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {completedCount}/{steps.length}
                    </span>
                  </div>
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
                  >
                    {pct}%
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  className="h-1.5 rounded-full overflow-hidden mb-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, var(--amber), var(--green))',
                      transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  {steps.map((step) => (
                    <a
                      key={step.label}
                      href={step.href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group"
                      style={{
                        textDecoration: 'none',
                        backgroundColor: step.done ? 'rgba(34,197,94,0.04)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!step.done) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = step.done ? 'rgba(34,197,94,0.04)' : 'transparent';
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                        style={{
                          border: step.done ? 'none' : '2px solid var(--border)',
                          backgroundColor: step.done ? 'var(--green)' : 'transparent',
                        }}
                      >
                        {step.done && <Check size={12} style={{ color: '#000' }} />}
                      </div>

                      {/* Icon */}
                      <span style={{ color: step.done ? 'var(--text-muted)' : step.color }}>
                        {step.icon}
                      </span>

                      {/* Label */}
                      <span
                        className="text-sm flex-1"
                        style={{
                          color: step.done ? 'var(--text-muted)' : 'var(--text)',
                          textDecoration: step.done ? 'line-through' : 'none',
                        }}
                      >
                        {step.label}
                      </span>

                      {/* Arrow */}
                      {!step.done && (
                        <ArrowRight
                          size={14}
                          style={{ color: 'var(--text-muted)', opacity: 0 }}
                          className="group-hover:opacity-100 transition-opacity"
                        />
                      )}
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}

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
                {activityEvents.map((event, idx) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2.5 absolute inset-0 transition-all"
                    style={{
                      opacity: tickerIndex === idx ? 1 : 0,
                      transform: tickerIndex === idx ? 'translateY(0)' : 'translateY(12px)',
                      transition: 'opacity 0.5s ease, transform 0.5s ease',
                    }}
                  >
                    <span style={{ color: event.color, display: 'flex', alignItems: 'center' }}>
                      {ICON_MAP[event.icon] || <Zap size={14} />}
                    </span>
                    <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                      {event.description}
                    </span>
                    <span
                      className="text-xs shrink-0 ml-auto"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Ticker dots */}
              <div className="flex items-center gap-1.5 shrink-0">
                {activityEvents.slice(0, 8).map((event, idx) => (
                  <div
                    key={event.id}
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

          {/* ===== SYSTEM STATUS BAR ===== */}
          <div
            className="card-glass-premium px-4 py-2.5 md:px-5 md:py-3"
            style={{ animationDelay: '800ms' }}
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {/* Status label */}
              <div className="flex items-center gap-2 shrink-0">
                <HardDrive size={13} style={{ color: 'var(--text-muted)' }} />
                <span
                  className="text-[10px] font-bold tracking-widest uppercase"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                >
                  System
                </span>
              </div>

              {/* Divider */}
              <div
                style={{
                  width: 1,
                  height: 18,
                  background: 'linear-gradient(180deg, transparent, var(--border), transparent)',
                }}
              />

              {/* Service indicators */}
              <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                {systemServices.map((svc) => {
                  const dotColor =
                    svc.status === 'ok'
                      ? 'var(--green)'
                      : svc.status === 'warning'
                        ? 'var(--amber)'
                        : 'var(--red)';
                  const dotGlow =
                    svc.status === 'ok'
                      ? 'rgba(34,197,94,0.4)'
                      : svc.status === 'warning'
                        ? 'rgba(245,158,11,0.4)'
                        : 'rgba(239,68,68,0.4)';
                  return (
                    <div key={svc.name} className="flex items-center gap-1.5" title={`${svc.name}: ${svc.status}`}>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                        {svc.icon}
                      </span>
                      <span
                        className="text-[11px]"
                        style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-secondary)' }}
                      >
                        {svc.name}
                      </span>
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          backgroundColor: dotColor,
                          boxShadow: `0 0 6px ${dotGlow}`,
                          transition: 'all 0.5s ease',
                          display: 'inline-block',
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Divider */}
              <div
                className="hidden md:block"
                style={{
                  width: 1,
                  height: 18,
                  background: 'linear-gradient(180deg, transparent, var(--border), transparent)',
                }}
              />

              {/* System load */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                >
                  Last
                </span>
                <div
                  style={{
                    width: 64,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: 'var(--border)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round(systemLoad)}%`,
                      height: '100%',
                      borderRadius: 3,
                      background:
                        systemLoad > 75
                          ? 'linear-gradient(90deg, var(--amber), var(--red))'
                          : systemLoad > 50
                            ? 'linear-gradient(90deg, var(--green), var(--amber))'
                            : 'linear-gradient(90deg, var(--green), var(--green))',
                      transition: 'width 1s ease, background 1s ease',
                      boxShadow:
                        systemLoad > 75
                          ? '0 0 8px rgba(239,68,68,0.3)'
                          : '0 0 8px rgba(34,197,94,0.2)',
                    }}
                  />
                </div>
                <span
                  className="text-[10px] tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', minWidth: 28 }}
                >
                  {Math.round(systemLoad)}%
                </span>
              </div>

              {/* Spacer pushes right items to end */}
              <div className="hidden lg:block flex-1" />

              {/* Last sync */}
              <div className="flex items-center gap-1.5 shrink-0">
                <RefreshCw size={11} style={{ color: 'var(--text-muted)' }} />
                <span
                  className="text-[10px]"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                >
                  Sync{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {systemLastSync.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </span>
              </div>

              {/* Divider */}
              <div
                className="hidden sm:block"
                style={{
                  width: 1,
                  height: 18,
                  background: 'linear-gradient(180deg, transparent, var(--border), transparent)',
                }}
              />

              {/* Uptime */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Activity size={11} style={{ color: 'var(--green)' }} />
                <span
                  className="text-[10px]"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                >
                  Uptime{' '}
                  <span className="tabular-nums" style={{ color: 'var(--green)' }}>
                    {systemUptime}
                  </span>
                </span>
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
