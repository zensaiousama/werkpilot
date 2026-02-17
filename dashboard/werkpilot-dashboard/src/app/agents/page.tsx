'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  ChevronDown,
  Clock,
  Grid3x3,
  List,
  Pause,
  Play,
  Power,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

interface AgentLog {
  id: string;
  agentId: string;
  level: string;
  message: string;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  dept: string;
  status: string;
  score: number;
  tasksToday: number;
  errorsToday: number;
  lastRun: string | null;
  logs: AgentLog[];
}

interface HealthData {
  total: number;
  running: number;
  idle: number;
  errored: number;
  avgScore: number;
  totalTasks: number;
  totalErrors: number;
  healthPct: number;
}

type SortBy = 'score' | 'name' | 'department' | 'status';
type ViewMode = 'grid' | 'list';

const DEPARTMENTS = [
  'All',
  'CEO',
  'Sales',
  'Marketing',
  'Product',
  'Operations',
  'Finance',
  'Strategy',
  'HR',
  'IT',
];

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Nie';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'gerade eben';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `vor ${diffHr} Std.`;
  const diffDay = Math.floor(diffHr / 24);
  return `vor ${diffDay} Tag${diffDay > 1 ? 'en' : ''}`;
}

function scoreColor(score: number): string {
  if (score < 50) return 'var(--red)';
  if (score < 75) return 'var(--amber)';
  return 'var(--green)';
}

function statusDotColor(status: string): string {
  if (status === 'running') return 'var(--green)';
  if (status === 'error') return 'var(--red)';
  return 'var(--text-muted)';
}

function logLevelColor(level: string): string {
  if (level === 'error') return 'var(--red)';
  if (level === 'warn') return 'var(--amber)';
  return 'var(--blue)';
}

function getDeptColor(dept: string): string {
  const deptMap: Record<string, string> = {
    CEO: 'var(--dept-ceo)',
    Sales: 'var(--dept-sales)',
    Marketing: 'var(--dept-marketing)',
    Product: 'var(--dept-product)',
    Operations: 'var(--dept-operations)',
    Finance: 'var(--dept-finance)',
    Strategy: 'var(--purple)',
    HR: 'var(--dept-hr)',
    IT: 'var(--blue)',
  };
  return deptMap[dept] || 'var(--amber)';
}

function getDeptClass(dept: string): string {
  const normalized = dept.toLowerCase().replace(/\s+/g, '-');
  return `dept-${normalized}`;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [activeDept, setActiveDept] = useState('All');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('score');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [actioningAgent, setActioningAgent] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((agentList: Agent[]) => {
        setAgents(agentList);
        // Compute health client-side instead of separate API call
        const total = agentList.length;
        const running = agentList.filter((a) => a.status === 'running').length;
        const idle = agentList.filter((a) => a.status === 'idle').length;
        const errored = agentList.filter((a) => a.status === 'error').length;
        const avgScore = total > 0
          ? Math.round(agentList.reduce((s, a) => s + a.score, 0) / total)
          : 0;
        const totalTasks = agentList.reduce((s, a) => s + a.tasksToday, 0);
        const totalErrors = agentList.reduce((s, a) => s + a.errorsToday, 0);
        setHealth({
          total,
          running,
          idle,
          errored,
          avgScore,
          totalTasks,
          totalErrors,
          healthPct: total > 0 ? Math.round(((total - errored) / total) * 100) : 100,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!selectedAgent) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedAgent(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedAgent]);

  useEffect(() => {
    if (selectedAgent && modalRef.current) {
      modalRef.current.focus();
    }
  }, [selectedAgent]);

  const handleRestartAgent = async (agentId: string) => {
    setActioningAgent(agentId);
    try {
      await fetch(`/api/agents/${agentId}/restart`, { method: 'POST' });
      await fetchData();
      const updated = agents.find((a) => a.id === agentId);
      if (updated) setSelectedAgent(updated);
    } catch {
      // silently handle
    } finally {
      setActioningAgent(null);
    }
  };

  const handleDisableAgent = async (agentId: string) => {
    setActioningAgent(agentId);
    try {
      await fetch(`/api/agents/${agentId}/disable`, { method: 'POST' });
      await fetchData();
      setSelectedAgent(null);
    } catch {
      // silently handle
    } finally {
      setActioningAgent(null);
    }
  };

  const filtered = agents
    .filter((a) => {
      const matchesDept = activeDept === 'All' || a.dept === activeDept;
      const matchesSearch =
        searchQuery.trim() === '' ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDept && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'department') return a.dept.localeCompare(b.dept);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return 0;
    });

  const erroredAgents = agents.filter((a) => a.status === 'error');

  if (!health) {
    return (
      <div className="space-y-6">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          AI Agents
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          AI Agents
        </h1>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search agents..."
            aria-label="Search agents by name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border outline-none transition-colors"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                'var(--amber)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                'var(--border)';
            }}
          />
          <Activity
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
          />
        </div>
      </div>

      {/* Real-time Agent Health Overview */}
      <div
        className="card-glass-premium p-5 rounded-xl border"
        style={{
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-sm font-bold"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                }}
              >
                SYSTEM HEALTH
              </span>
              <span
                className="text-lg font-bold"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color:
                    health.healthPct >= 90
                      ? 'var(--green)'
                      : health.healthPct >= 70
                        ? 'var(--amber)'
                        : 'var(--red)',
                }}
              >
                {health.healthPct}%
              </span>
            </div>
            <div
              className="w-full h-3 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--bg)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${health.healthPct}%`,
                  backgroundColor:
                    health.healthPct >= 90
                      ? 'var(--green)'
                      : health.healthPct >= 70
                        ? 'var(--amber)'
                        : 'var(--red)',
                }}
              />
            </div>
          </div>

          {/* Health Stats */}
          <div className="flex flex-wrap gap-6">
            <div className="text-center min-w-[60px]">
              <p
                className="text-2xl font-bold"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text)',
                }}
              >
                {health.total}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Total
              </p>
            </div>
            <div className="text-center min-w-[60px]">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: 'var(--green)',
                    animation: 'pulse-green 2s infinite',
                  }}
                />
                <p
                  className="text-2xl font-bold"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--green)',
                  }}
                >
                  {health.running}
                </p>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Running
              </p>
            </div>
            <div className="text-center min-w-[60px]">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: 'var(--text-muted)' }}
                />
                <p
                  className="text-2xl font-bold"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {health.idle}
                </p>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Idle
              </p>
            </div>
            <div className="text-center min-w-[60px]">
              <div className="flex items-center justify-center gap-1 mb-1">
                {health.errored > 0 && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: 'var(--red)',
                      animation: 'pulse-red 1.5s infinite',
                    }}
                  />
                )}
                <p
                  className="text-2xl font-bold"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: health.errored > 0 ? 'var(--red)' : 'var(--green)',
                  }}
                >
                  {health.errored}
                </p>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Errored
              </p>
            </div>
            <div className="text-center min-w-[60px]">
              <p
                className="text-2xl font-bold"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: scoreColor(health.avgScore),
                }}
              >
                {Math.round(health.avgScore)}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Avg Score
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Errored Agents Section (if any) */}
      {erroredAgents.length > 0 && (
        <div
          className="p-4 rounded-xl border border-red-500/30"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--red) 8%, var(--surface))',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5" style={{ color: 'var(--red)' }} />
            <span
              className="text-sm font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}
            >
              AGENTS WITH ERRORS ({erroredAgents.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {erroredAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--red)',
                  color: 'var(--red)',
                }}
              >
                {agent.name} ({agent.errorsToday} errors)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Department Filter Tabs + View Toggle + Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {DEPARTMENTS.map((dept) => {
            const isActive = activeDept === dept;
            return (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                aria-label={`Filter by department: ${dept}`}
                aria-pressed={isActive}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: isActive ? getDeptColor(dept) : 'var(--surface)',
                  color: isActive ? '#000' : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? getDeptColor(dept) : 'var(--border)'}`,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {dept}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="pl-3 pr-8 py-2 rounded-lg text-xs font-medium border outline-none appearance-none cursor-pointer transition-colors"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <option value="score">Sort: Score</option>
              <option value="name">Sort: Name</option>
              <option value="department">Sort: Department</option>
              <option value="status">Sort: Status</option>
            </select>
            <ChevronDown
              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
          </div>

          {/* View Toggle */}
          <div
            className="flex items-center gap-1 p-1 rounded-lg"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className="p-1.5 rounded transition-colors"
              style={{
                backgroundColor:
                  viewMode === 'grid' ? 'var(--amber)' : 'transparent',
                color: viewMode === 'grid' ? '#000' : 'var(--text-muted)',
              }}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className="p-1.5 rounded transition-colors"
              style={{
                backgroundColor:
                  viewMode === 'list' ? 'var(--amber)' : 'transparent',
                color: viewMode === 'list' ? '#000' : 'var(--text-muted)',
              }}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Agent Cards Grid/List */}
      <div
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4'
            : 'space-y-3'
        }
      >
        {filtered.map((agent) => {
          const deptClass = getDeptClass(agent.dept);
          const deptColor = getDeptColor(agent.dept);

          if (viewMode === 'list') {
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="w-full text-left p-4 rounded-xl border transition-all hover-lift"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex items-center gap-3 md:gap-4">
                  {/* Status Dot */}
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: statusDotColor(agent.status),
                      animation:
                        agent.status === 'error'
                          ? 'pulse-red 1.5s infinite'
                          : agent.status === 'running'
                            ? 'pulse-green 2s infinite'
                            : undefined,
                    }}
                  />

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-sm font-bold truncate block"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {agent.name}
                    </span>
                  </div>

                  {/* Department Badge */}
                  <span
                    className="hidden sm:inline-flex px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${deptColor} 15%, transparent)`,
                      color: deptColor,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {agent.dept}
                  </span>

                  {/* Score (Circular) */}
                  <div className="relative w-10 h-10 md:w-12 md:h-12">
                    <svg className="w-full h-full -rotate-90">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        fill="none"
                        stroke="var(--border)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        fill="none"
                        stroke={scoreColor(agent.score)}
                        strokeWidth="3"
                        strokeDasharray={`${(agent.score / 100) * 125.6} 125.6`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span
                      className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: scoreColor(agent.score),
                      }}
                    >
                      {agent.score}
                    </span>
                  </div>

                  {/* Tasks */}
                  <div className="hidden md:block text-center min-w-[60px]">
                    <p
                      className="text-lg font-bold"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {agent.tasksToday}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Tasks
                    </p>
                  </div>

                  {/* Errors */}
                  <div className="hidden md:block text-center min-w-[60px]">
                    <p
                      className="text-lg font-bold"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color:
                          agent.errorsToday > 0 ? 'var(--red)' : 'var(--text)',
                      }}
                    >
                      {agent.errorsToday}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Errors
                    </p>
                  </div>

                  {/* Last Run */}
                  <div
                    className="hidden sm:block text-xs text-right min-w-[80px]"
                    style={{
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {relativeTime(agent.lastRun)}
                  </div>
                </div>
              </button>
            );
          }

          // Grid view
          return (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className={`agent-card ${deptClass} text-left p-4 rounded-xl border transition-all card-glass-premium`}
              style={{
                borderColor: 'var(--border)',
              }}
            >
              {/* Header: Name + Status Dot */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-sm font-bold truncate"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {agent.name}
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 ml-2"
                  style={{
                    backgroundColor: statusDotColor(agent.status),
                    animation:
                      agent.status === 'error'
                        ? 'pulse-red 1.5s infinite'
                        : agent.status === 'running'
                          ? 'pulse-green 2s infinite'
                          : undefined,
                  }}
                />
              </div>

              {/* Department badge */}
              <div className="mb-3">
                <StatusBadge status={agent.status} />
                <span
                  className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold dept-badge ${deptClass}`}
                  style={{
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {agent.dept}
                </span>
              </div>

              {/* Score (Circular Progress) */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Score
                </span>
                <div className="relative w-12 h-12">
                  <svg className="w-full h-full -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="18"
                      fill="none"
                      stroke="var(--border)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="18"
                      fill="none"
                      stroke={scoreColor(agent.score)}
                      strokeWidth="4"
                      strokeDasharray={`${(agent.score / 100) * 113} 113`}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span
                    className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: scoreColor(agent.score),
                    }}
                  >
                    {agent.score}
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Tasks </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text)',
                    }}
                  >
                    {agent.tasksToday}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Errors </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color:
                        agent.errorsToday > 0 ? 'var(--red)' : 'var(--text)',
                    }}
                  >
                    {agent.errorsToday}
                  </span>
                </div>
                <div
                  className="text-right"
                  style={{
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                  }}
                >
                  {relativeTime(agent.lastRun)}
                </div>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div
            className="col-span-full text-center py-12"
            style={{ color: 'var(--text-muted)' }}
          >
            Keine Agents in dieser Abteilung
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedAgent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Agent details: ${selectedAgent.name}`}
          onClick={() => setSelectedAgent(null)}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 cmd-palette-backdrop"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          />

          {/* Modal content */}
          <div
            ref={modalRef}
            tabIndex={-1}
            className="animate-scale-in relative w-full max-w-2xl max-h-[100vh] md:max-h-[90vh] overflow-y-auto rounded-none md:rounded-xl border p-4 md:p-6 outline-none card-glass-premium"
            style={{
              borderColor: 'var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedAgent(null)}
              aria-label="Close agent details"
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors"
              style={{
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg)',
              }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Agent header */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor: statusDotColor(selectedAgent.status),
                  animation:
                    selectedAgent.status === 'error'
                      ? 'pulse-red 1.5s infinite'
                      : selectedAgent.status === 'running'
                        ? 'pulse-green 2s infinite'
                        : undefined,
                }}
              />
              <h2
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {selectedAgent.name}
              </h2>
              <span
                className={`ml-auto px-3 py-1 rounded text-xs font-bold dept-badge ${getDeptClass(selectedAgent.dept)}`}
              >
                {selectedAgent.dept}
              </span>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                {
                  label: 'Status',
                  value: selectedAgent.status,
                  isStatus: true,
                },
                { label: 'Score', value: `${selectedAgent.score}/100` },
                {
                  label: 'Tasks Today',
                  value: selectedAgent.tasksToday,
                },
                {
                  label: 'Errors Today',
                  value: selectedAgent.errorsToday,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--bg)' }}
                >
                  <p
                    className="text-xs mb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {item.label}
                  </p>
                  {item.isStatus ? (
                    <StatusBadge status={String(item.value)} />
                  ) : (
                    <p
                      className="text-sm font-bold"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {item.value}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Performance Chart Placeholder */}
            <div
              className="mb-5 p-4 rounded-lg"
              style={{ backgroundColor: 'var(--bg)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-xs font-bold"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  PERFORMANCE CHART
                </span>
                <BarChart3 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </div>
              <div className="sparkline-container">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="sparkline-bar"
                    style={{
                      height: `${Math.random() * 100}%`,
                      backgroundColor: scoreColor(selectedAgent.score),
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Score bar */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Performance Score
                </span>
                <span
                  className="text-sm font-bold"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: scoreColor(selectedAgent.score),
                  }}
                >
                  {selectedAgent.score}%
                </span>
              </div>
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--bg)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${selectedAgent.score}%`,
                    backgroundColor: scoreColor(selectedAgent.score),
                  }}
                />
              </div>
            </div>

            {/* Execution History */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <h3
                  className="text-sm font-bold"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  EXECUTION HISTORY
                </h3>
              </div>
              <div className="space-y-2">
                <div
                  className="p-3 rounded-lg flex items-center justify-between"
                  style={{ backgroundColor: 'var(--bg)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Last Run
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {relativeTime(selectedAgent.lastRun)}
                  </span>
                </div>
                <div
                  className="p-3 rounded-lg flex items-center justify-between"
                  style={{ backgroundColor: 'var(--bg)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Total Tasks Today
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {selectedAgent.tasksToday}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Logs */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <h3
                  className="text-sm font-bold"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  RECENT LOGS
                </h3>
              </div>
              {selectedAgent.logs.length === 0 ? (
                <p
                  className="text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Keine Logs vorhanden
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedAgent.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
                      style={{ backgroundColor: 'var(--bg)' }}
                    >
                      <span
                        className="w-2 h-2 rounded-full mt-1 shrink-0"
                        style={{
                          backgroundColor: logLevelColor(log.level),
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="break-words"
                          style={{ color: 'var(--text)' }}
                        >
                          {log.message}
                        </p>
                        <p
                          className="mt-0.5"
                          style={{
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                          }}
                        >
                          {log.level.toUpperCase()} --{' '}
                          {relativeTime(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 md:gap-3">
              {/* Restart Agent */}
              <button
                onClick={() => handleRestartAgent(selectedAgent.id)}
                disabled={actioningAgent === selectedAgent.id}
                className="flex-1 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 md:gap-2 min-h-[44px]"
                style={{
                  backgroundColor: 'var(--green)',
                  color: '#000',
                  opacity: actioningAgent === selectedAgent.id ? 0.6 : 1,
                  cursor:
                    actioningAgent === selectedAgent.id
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                <Play className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {actioningAgent === selectedAgent.id
                    ? 'Restarting...'
                    : 'Restart Agent'}
                </span>
                <span className="sm:hidden">
                  {actioningAgent === selectedAgent.id
                    ? '...'
                    : 'Restart'}
                </span>
              </button>

              {/* Disable Agent */}
              <button
                onClick={() => handleDisableAgent(selectedAgent.id)}
                disabled={actioningAgent === selectedAgent.id}
                className="flex-1 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 md:gap-2 min-h-[44px]"
                style={{
                  backgroundColor: 'var(--red)',
                  color: '#fff',
                  opacity: actioningAgent === selectedAgent.id ? 0.6 : 1,
                  cursor:
                    actioningAgent === selectedAgent.id
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                <Pause className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {actioningAgent === selectedAgent.id
                    ? 'Disabling...'
                    : 'Disable Agent'}
                </span>
                <span className="sm:hidden">
                  {actioningAgent === selectedAgent.id
                    ? '...'
                    : 'Disable'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
