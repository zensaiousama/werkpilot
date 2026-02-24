'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  ChevronDown,
  Clock,
  Crown,
  FileText,
  Grid3x3,
  List,
  Loader2,
  Pause,
  PieChart,
  Play,
  Plus,
  Power,
  Settings,
  Terminal,
  ToggleLeft,
  ToggleRight,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import Breadcrumb from '@/components/Breadcrumb';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
type StatusFilter = 'all' | 'running' | 'idle' | 'error';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

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

const AGENT_TYPES = [
  'Data Analyst',
  'Content Writer',
  'Lead Researcher',
  'Email Automator',
  'Report Generator',
  'Task Scheduler',
  'Quality Checker',
  'Social Media Manager',
  'Invoice Processor',
  'Customer Support',
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

function formatLogTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatLogDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function scoreColor(score: number): string {
  if (score < 50) return 'var(--red)';
  if (score < 75) return 'var(--amber)';
  return 'var(--green)';
}

function scoreGlow(score: number): string {
  if (score < 50) return 'var(--red-glow)';
  if (score < 75) return 'var(--amber-glow)';
  return 'var(--green-glow)';
}

function statusDotColor(status: string): string {
  if (status === 'running') return 'var(--green)';
  if (status === 'error') return 'var(--red)';
  return 'var(--text-muted)';
}

function statusLabel(status: string): string {
  if (status === 'running') return 'Aktiv';
  if (status === 'error') return 'Fehler';
  if (status === 'idle') return 'Inaktiv';
  return status;
}

function logLevelColor(level: string): string {
  if (level === 'error') return 'var(--red)';
  if (level === 'warn') return 'var(--amber)';
  return 'var(--blue)';
}

function logLevelIcon(level: string): string {
  if (level === 'error') return '!';
  if (level === 'warn') return '~';
  return '>';
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

/** Generate deterministic score history for bar chart visualisation */
function generateScoreHistory(agent: Agent): number[] {
  let seed = 0;
  for (let i = 0; i < agent.id.length; i++) {
    seed = (seed + agent.id.charCodeAt(i) * (i + 1)) & 0xffff;
  }
  const bars: number[] = [];
  for (let i = 0; i < 14; i++) {
    seed = (seed * 16807 + 12345) & 0x7fffffff;
    const variance = ((seed % 40) - 20);
    const value = Math.max(10, Math.min(100, agent.score + variance));
    bars.push(value);
  }
  return bars;
}

/* ------------------------------------------------------------------ */
/*  Create Agent Modal Component                                       */
/* ------------------------------------------------------------------ */

function CreateAgentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [dept, setDept] = useState('CEO');
  const [agentType, setAgentType] = useState<string>(AGENT_TYPES[0]);
  const [description, setDescription] = useState('');
  const [autoRun, setAutoRun] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    modalRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name ist erforderlich');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          dept,
          status: autoRun ? 'running' : 'idle',
          score: 50,
          tasksToday: 0,
          errorsToday: 0,
          config: JSON.stringify({ type: agentType, description, autoRun }),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Erstellen');
      }
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 cmd-palette-backdrop"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', animation: 'fadeIn 200ms ease-out' }}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="animate-scale-in relative w-full max-w-lg rounded-xl border p-6 outline-none card-glass-premium"
        style={{ borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--amber-glow)' }}
            >
              <Bot className="w-5 h-5" style={{ color: 'var(--amber)' }} />
            </div>
            <div>
              <h2
                className="text-lg font-bold"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Neuen Agent erstellen
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Konfiguriere einen neuen AI Agent
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--red) 10%, var(--surface))',
              color: 'var(--red)',
              border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label
              className="block text-xs font-bold mb-1.5"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              NAME
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Lead-Researcher Pro"
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
                fontFamily: 'var(--font-dm-sans)',
              }}
            />
          </div>

          {/* Type + Department row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-bold mb-1.5"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
              >
                TYP
              </label>
              <div className="relative">
                <select
                  value={agentType}
                  onChange={(e) => setAgentType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none appearance-none cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-dm-sans)',
                  }}
                >
                  {AGENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}
                />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-bold mb-1.5"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
              >
                ABTEILUNG
              </label>
              <div className="relative">
                <select
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none appearance-none cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-dm-sans)',
                  }}
                >
                  {DEPARTMENTS.filter((d) => d !== 'All').map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              className="block text-xs font-bold mb-1.5"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              BESCHREIBUNG
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Was soll dieser Agent tun?"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none resize-none"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
                fontFamily: 'var(--font-dm-sans)',
              }}
            />
          </div>

          {/* Auto-Run Toggle */}
          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <div>
              <p
                className="text-sm font-bold"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Auto-Run
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Agent automatisch nach Erstellung starten
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoRun(!autoRun)}
              className="shrink-0"
              style={{ color: autoRun ? 'var(--green)' : 'var(--text-muted)' }}
            >
              {autoRun ? (
                <ToggleRight className="w-8 h-8" />
              ) : (
                <ToggleLeft className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: 'var(--surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'var(--amber)',
                color: '#000',
                opacity: saving ? 0.6 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Erstelle...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Agent erstellen
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Score Ring Component (SVG)                                         */
/* ------------------------------------------------------------------ */

function ScoreRing({
  score,
  size = 48,
  strokeWidth = 4,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
          style={{
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-bold"
        style={{
          fontFamily: 'var(--font-mono)',
          color,
          fontSize: size < 40 ? '10px' : '12px',
        }}
      >
        {score}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini Bar Chart Component                                           */
/* ------------------------------------------------------------------ */

function MiniBarChart({
  data,
  color,
  height = 48,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  const max = Math.max(...data, 1);

  return (
    <div
      className="flex items-end gap-[3px] w-full"
      style={{ height }}
    >
      {data.map((val, i) => {
        const barHeight = (val / max) * 100;
        const isLast = i === data.length - 1;
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-300 group relative"
            style={{
              height: `${barHeight}%`,
              backgroundColor: isLast ? color : `color-mix(in srgb, ${color} 50%, transparent)`,
              minWidth: '4px',
              opacity: 0.4 + (i / data.length) * 0.6,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '1';
              (e.currentTarget as HTMLElement).style.backgroundColor = color;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = String(0.4 + (i / data.length) * 0.6);
              (e.currentTarget as HTMLElement).style.backgroundColor = isLast
                ? color
                : `color-mix(in srgb, ${color} 50%, transparent)`;
            }}
            title={`Score: ${val}`}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Panel (slide-in from right)                                 */
/* ------------------------------------------------------------------ */

function DetailPanel({
  agent,
  onClose,
  onRestart,
  onDisable,
  isActioning,
}: {
  agent: Agent;
  onClose: () => void;
  onRestart: (id: string) => void;
  onDisable: (id: string) => void;
  isActioning: boolean;
}) {
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const deptClass = getDeptClass(agent.dept);
  const scoreHistory = generateScoreHistory(agent);
  const scoreTrend = scoreHistory[scoreHistory.length - 1] - scoreHistory[0];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const filteredLogs = agent.logs.filter(
    (log) => logFilter === 'all' || log.level === logFilter,
  );

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', animation: 'fadeIn 200ms ease-out' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:h-full z-50 overflow-y-auto animate-slide-in-right"
        role="dialog"
        aria-label="Agent Detail Panel"
        style={{
          maxWidth: '100vw',
          backgroundColor: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
        }}
      >
        <style>{`
          @media (min-width: 768px) {
            [aria-label="Agent Detail Panel"] {
              width: 520px !important;
              left: auto !important;
              bottom: auto !important;
            }
          }
        `}</style>

        {/* Sticky Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
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
            <h2
              className="text-lg font-bold truncate"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {agent.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors shrink-0"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 md:px-6 py-5 space-y-5">
          {/* Agent Identity */}
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `color-mix(in srgb, ${getDeptColor(agent.dept)} 12%, var(--bg))`,
                border: `1px solid color-mix(in srgb, ${getDeptColor(agent.dept)} 25%, transparent)`,
              }}
            >
              <Bot className="w-7 h-7" style={{ color: getDeptColor(agent.dept) }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={agent.status} />
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold dept-badge ${deptClass}`}
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {agent.dept}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Letzter Lauf: {relativeTime(agent.lastRun)}
              </p>
            </div>
            <ScoreRing score={agent.score} size={56} strokeWidth={5} />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Score',
                value: `${agent.score}%`,
                color: scoreColor(agent.score),
                icon: <Zap className="w-3.5 h-3.5" />,
              },
              {
                label: 'Tasks',
                value: agent.tasksToday,
                color: 'var(--blue)',
                icon: <Activity className="w-3.5 h-3.5" />,
              },
              {
                label: 'Fehler',
                value: agent.errorsToday,
                color: agent.errorsToday > 0 ? 'var(--red)' : 'var(--green)',
                icon: <AlertCircle className="w-3.5 h-3.5" />,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-3 rounded-xl text-center"
                style={{
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="flex items-center justify-center gap-1 mb-1"
                  style={{ color: stat.color }}
                >
                  {stat.icon}
                </div>
                <p
                  className="text-lg font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: stat.color }}
                >
                  {stat.value}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* Performance Chart */}
          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <span
                  className="text-xs font-bold"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  SCORE-VERLAUF
                </span>
              </div>
              <div className="flex items-center gap-1">
                {scoreTrend >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--green)' }} />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--red)' }} />
                )}
                <span
                  className="text-xs font-bold"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: scoreTrend >= 0 ? 'var(--green)' : 'var(--red)',
                  }}
                >
                  {scoreTrend >= 0 ? '+' : ''}{scoreTrend}
                </span>
              </div>
            </div>
            <MiniBarChart
              data={scoreHistory}
              color={scoreColor(agent.score)}
              height={64}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                14 Tage
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Heute
              </span>
            </div>
          </div>

          {/* Score Bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Performance Score
              </span>
              <span
                className="text-sm font-bold"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: scoreColor(agent.score),
                }}
              >
                {agent.score}%
              </span>
            </div>
            <div
              className="w-full h-2.5 rounded-full overflow-hidden"
              style={{ backgroundColor: 'color-mix(in srgb, var(--border) 50%, var(--bg))' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${agent.score}%`,
                  backgroundColor: scoreColor(agent.score),
                  boxShadow: `0 0 8px ${scoreGlow(agent.score)}`,
                }}
              />
            </div>
          </div>

          {/* Execution History */}
          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <h3
                className="text-xs font-bold"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                }}
              >
                AUSFUEHRUNGSHISTORIE
              </h3>
            </div>
            <div className="space-y-2">
              <div
                className="flex items-center justify-between p-2.5 rounded-lg"
                style={{ backgroundColor: 'var(--surface)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Letzter Lauf
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {relativeTime(agent.lastRun)}
                </span>
              </div>
              <div
                className="flex items-center justify-between p-2.5 rounded-lg"
                style={{ backgroundColor: 'var(--surface)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Tasks heute
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {agent.tasksToday}
                </span>
              </div>
              <div
                className="flex items-center justify-between p-2.5 rounded-lg"
                style={{ backgroundColor: 'var(--surface)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Fehler heute
                </span>
                <span
                  className="text-xs font-bold"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: agent.errorsToday > 0 ? 'var(--red)' : 'var(--text)',
                  }}
                >
                  {agent.errorsToday}
                </span>
              </div>
            </div>
          </div>

          {/* Task Queue */}
          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <List className="w-4 h-4" style={{ color: 'var(--amber)' }} />
              <h3
                className="text-xs font-bold"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
              >
                TASK QUEUE
              </h3>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto"
                style={{
                  backgroundColor: 'rgba(245,158,11,0.1)',
                  color: 'var(--amber)',
                  fontFamily: 'var(--font-mono)',
                  border: '1px solid rgba(245,158,11,0.2)',
                }}
              >
                {Math.max(0, agent.tasksToday - agent.errorsToday)} ausstehend
              </span>
            </div>
            <div className="space-y-1.5">
              {(() => {
                const tasks = [
                  { name: 'Lead-Scoring Update', status: 'done' as const, duration: '2.3s' },
                  { name: 'E-Mail Kampagne pruefen', status: 'done' as const, duration: '1.8s' },
                  { name: 'Daten-Synchronisation', status: agent.status === 'running' ? 'running' as const : 'pending' as const, duration: '—' },
                  { name: 'Report generieren', status: 'pending' as const, duration: '—' },
                  { name: 'Cleanup ausfuehren', status: 'pending' as const, duration: '—' },
                ];
                const statusConfig = {
                  done: { color: 'var(--green)', bg: 'rgba(34,197,94,0.08)', label: 'Erledigt' },
                  running: { color: 'var(--amber)', bg: 'rgba(245,158,11,0.08)', label: 'Laeuft...' },
                  pending: { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.02)', label: 'Wartend' },
                };
                return tasks.map((t, i) => {
                  const cfg = statusConfig[t.status];
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 rounded-lg"
                      style={{ backgroundColor: cfg.bg }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: cfg.color,
                          flexShrink: 0,
                          boxShadow: t.status === 'running' ? `0 0 6px ${cfg.color}` : 'none',
                          animation: t.status === 'running' ? 'pulse-green 2s infinite' : 'none',
                        }}
                      />
                      <span
                        className="text-xs flex-1 truncate"
                        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}
                      >
                        {t.name}
                      </span>
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: cfg.color, fontFamily: 'var(--font-mono)' }}
                      >
                        {t.status === 'done' ? t.duration : cfg.label}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Log Viewer */}
          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <h3
                  className="text-xs font-bold"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  AGENT LOGS
                </h3>
              </div>
              {/* Log level filter */}
              <div className="flex gap-1">
                {(['all', 'error', 'warn', 'info'] as const).map((level) => {
                  const isActive = logFilter === level;
                  const filterColor =
                    level === 'error'
                      ? 'var(--red)'
                      : level === 'warn'
                        ? 'var(--amber)'
                        : level === 'info'
                          ? 'var(--blue)'
                          : 'var(--text-secondary)';
                  return (
                    <button
                      key={level}
                      onClick={() => setLogFilter(level)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold transition-all"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        backgroundColor: isActive
                          ? `color-mix(in srgb, ${filterColor} 15%, transparent)`
                          : 'transparent',
                        color: isActive ? filterColor : 'var(--text-muted)',
                        border: `1px solid ${isActive ? filterColor : 'transparent'}`,
                      }}
                    >
                      {level === 'all' ? 'Alle' : level.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div
                className="text-center py-6"
                style={{ color: 'var(--text-muted)' }}
              >
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">
                  {logFilter === 'all'
                    ? 'Keine Logs vorhanden'
                    : `Keine ${logFilter.toUpperCase()} Logs`}
                </p>
              </div>
            ) : (
              <div
                className="space-y-1 max-h-64 overflow-y-auto rounded-lg p-2"
                style={{
                  backgroundColor: 'var(--surface)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded text-xs transition-colors"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Timestamp */}
                    <span
                      className="shrink-0 w-[52px]"
                      style={{ color: 'var(--text-muted)', fontSize: '10px' }}
                    >
                      {formatLogTime(log.createdAt)}
                    </span>
                    {/* Level indicator */}
                    <span
                      className="shrink-0 w-[14px] text-center font-bold"
                      style={{
                        color: logLevelColor(log.level),
                        fontSize: '10px',
                      }}
                    >
                      {logLevelIcon(log.level)}
                    </span>
                    {/* Message */}
                    <span className="flex-1 break-words leading-relaxed" style={{ fontSize: '11px' }}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => onRestart(agent.id)}
              disabled={isActioning}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 min-h-[44px]"
              style={{
                backgroundColor: 'var(--green)',
                color: '#000',
                opacity: isActioning ? 0.6 : 1,
                cursor: isActioning ? 'not-allowed' : 'pointer',
              }}
            >
              <Play className="w-4 h-4" />
              {isActioning ? 'Wird neugestartet...' : 'Agent neustarten'}
            </button>
            <button
              onClick={() => onDisable(agent.id)}
              disabled={isActioning}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 min-h-[44px]"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--red) 15%, var(--surface))',
                color: 'var(--red)',
                border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
                opacity: isActioning ? 0.6 : 1,
                cursor: isActioning ? 'not-allowed' : 'pointer',
              }}
            >
              <Pause className="w-4 h-4" />
              {isActioning ? 'Wird deaktiviert...' : 'Deaktivieren'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ================================================================== */
/*  Main Page                                                          */
/* ================================================================== */

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [activeDept, setActiveDept] = useState('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('score');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [actioningAgent, setActioningAgent] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchData = useCallback(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((agentList: Agent[]) => {
        setAgents(agentList);
        const total = agentList.length;
        const running = agentList.filter((a) => a.status === 'running').length;
        const idle = agentList.filter((a) => a.status === 'idle').length;
        const errored = agentList.filter((a) => a.status === 'error').length;
        const avgScore =
          total > 0
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
          healthPct:
            total > 0 ? Math.round(((total - errored) / total) * 100) : 100,
        });
        // Update selected agent if it's open
        if (selectedAgent) {
          const updated = agentList.find((a) => a.id === selectedAgent.id);
          if (updated) setSelectedAgent(updated);
        }
      })
      .catch(() => {});
  }, [selectedAgent]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRestartAgent = async (agentId: string) => {
    setActioningAgent(agentId);
    try {
      await fetch(`/api/agents/${agentId}/restart`, { method: 'POST' });
      await new Promise((r) => setTimeout(r, 500));
      fetchData();
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
      await new Promise((r) => setTimeout(r, 500));
      fetchData();
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
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchesSearch =
        searchQuery.trim() === '' ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDept && matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'department') return a.dept.localeCompare(b.dept);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return 0;
    });

  const erroredAgents = agents.filter((a) => a.status === 'error');

  /* ---- Loading state ---- */
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

  /* ---- Status filter tab counts ---- */
  const statusCounts = {
    all: agents.length,
    running: agents.filter((a) => a.status === 'running').length,
    idle: agents.filter((a) => a.status === 'idle').length,
    error: agents.filter((a) => a.status === 'error').length,
  };

  const statusTabs: { key: StatusFilter; label: string; color: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'Alle', color: 'var(--amber)', icon: <Grid3x3 className="w-3.5 h-3.5" /> },
    { key: 'running', label: 'Aktiv', color: 'var(--green)', icon: <Play className="w-3.5 h-3.5" /> },
    { key: 'idle', label: 'Inaktiv', color: 'var(--text-muted)', icon: <Pause className="w-3.5 h-3.5" /> },
    { key: 'error', label: 'Fehler', color: 'var(--red)', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  ];

  if (!health) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="skeleton" style={{ width: 200, height: 32, borderRadius: 8 }} />
          <div className="skeleton" style={{ width: 140, height: 40, borderRadius: 8 }} />
        </div>
        {/* Health bar skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />
          ))}
        </div>
        {/* Filter tabs skeleton */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ width: 80, height: 36, borderRadius: 8 }} />
          ))}
        </div>
        {/* Agent cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 200, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'AI Agents' }]} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            AI Agents
          </h1>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{
              backgroundColor: 'var(--amber-glow)',
              color: 'var(--amber)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {agents.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative w-full sm:w-60">
            <input
              type="text"
              placeholder="Agents suchen..."
              aria-label="Agents nach Name suchen"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border outline-none transition-colors"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
              }}
            />
            <Activity
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--text-muted)' }}
            />
          </div>

          {/* Create Agent Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shrink-0"
            style={{
              backgroundColor: 'var(--amber)',
              color: '#000',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.3)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Neuer Agent</span>
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2">
        {statusTabs.map((tab) => {
          const isActive = statusFilter === tab.key;
          const count = statusCounts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                fontFamily: 'var(--font-mono)',
                backgroundColor: isActive
                  ? `color-mix(in srgb, ${tab.color} 15%, var(--surface))`
                  : 'var(--surface)',
                color: isActive ? tab.color : 'var(--text-muted)',
                border: `1px solid ${isActive ? tab.color : 'var(--border)'}`,
                boxShadow: isActive ? `0 0 12px color-mix(in srgb, ${tab.color} 15%, transparent)` : 'none',
              }}
            >
              {tab.icon}
              {tab.label}
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: isActive
                    ? `color-mix(in srgb, ${tab.color} 20%, transparent)`
                    : 'var(--bg)',
                  color: isActive ? tab.color : 'var(--text-muted)',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* System Health Overview */}
      <div
        className="card-glass-premium p-5 rounded-xl border"
        style={{ borderColor: 'var(--border)' }}
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
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${health.healthPct}%`,
                  backgroundColor:
                    health.healthPct >= 90
                      ? 'var(--green)'
                      : health.healthPct >= 70
                        ? 'var(--amber)'
                        : 'var(--red)',
                  boxShadow:
                    health.healthPct >= 90
                      ? '0 0 12px var(--green-glow)'
                      : health.healthPct >= 70
                        ? '0 0 12px var(--amber-glow)'
                        : '0 0 12px var(--red-glow)',
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
                Aktiv
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
                Inaktiv
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
                Fehler
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

      {/* Errored Agents Alert */}
      {erroredAgents.length > 0 && (
        <div
          className="p-4 rounded-xl border border-red-500/30"
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--red) 8%, var(--surface))',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle
              className="w-5 h-5"
              style={{ color: 'var(--red)' }}
            />
            <span
              className="text-sm font-bold"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--red)',
              }}
            >
              AGENTS MIT FEHLERN ({erroredAgents.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {erroredAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--red)',
                  color: 'var(--red)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'color-mix(in srgb, var(--red) 15%, var(--surface))';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                }}
              >
                {agent.name} ({agent.errorsToday} Fehler)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* Performance Section                          */}
      {/* ============================================ */}
      {agents.length > 0 && (() => {
        const topAgent = [...agents].sort((a, b) => b.score - a.score)[0];

        /* Department task aggregation for donut chart */
        const deptTaskMap: Record<string, number> = {};
        agents.forEach((a) => {
          deptTaskMap[a.dept] = (deptTaskMap[a.dept] || 0) + a.tasksToday;
        });
        const deptEntries = Object.entries(deptTaskMap).sort((a, b) => b[1] - a[1]);
        const totalDeptTasks = deptEntries.reduce((s, [, v]) => s + v, 0);

        /* Donut chart geometry */
        const donutRadius = 54;
        const donutStroke = 14;
        const donutCircumference = 2 * Math.PI * donutRadius;

        /* Score comparison sorted */
        const sortedByScore = [...agents].sort((a, b) => b.score - a.score);
        const maxScore = Math.max(...agents.map((a) => a.score), 1);

        return (
          <div className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" style={{ color: 'var(--amber)' }} />
              <h2
                className="text-lg font-bold"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Performance
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 1. Top Performer Card */}
              <div
                className="card-glass-premium p-5 rounded-xl border relative overflow-hidden"
                style={{
                  borderColor: 'var(--amber)',
                  boxShadow: '0 0 24px var(--amber-glow), 0 0 48px rgba(245, 158, 11, 0.06)',
                }}
              >
                {/* Amber glow overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse at 20% 20%, rgba(245, 158, 11, 0.08), transparent 70%)',
                  }}
                />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Crown className="w-4 h-4" style={{ color: 'var(--amber)' }} />
                    <span
                      className="text-xs font-bold"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--amber)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      TOP PERFORMER
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Score Ring */}
                    <ScoreRing score={topAgent.score} size={64} strokeWidth={5} />

                    <div className="flex-1 min-w-0">
                      <p
                        className="text-base font-bold truncate mb-1"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {topAgent.name}
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold dept-badge ${getDeptClass(topAgent.dept)}`}
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {topAgent.dept}
                        </span>
                        <StatusBadge status={topAgent.status} />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3" style={{ color: 'var(--blue)' }} />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Tasks</span>
                          <span
                            className="text-xs font-bold"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {topAgent.tasksToday}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertCircle
                            className="w-3 h-3"
                            style={{
                              color: topAgent.errorsToday > 0 ? 'var(--red)' : 'var(--text-muted)',
                            }}
                          />
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Fehler</span>
                          <span
                            className="text-xs font-bold"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              color: topAgent.errorsToday > 0 ? 'var(--red)' : 'var(--text)',
                            }}
                          >
                            {topAgent.errorsToday}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Horizontal Score Comparison */}
              <div
                className="card-glass-premium p-5 rounded-xl border"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4" style={{ color: 'var(--blue)' }} />
                  <span
                    className="text-xs font-bold"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    SCORE VERGLEICH
                  </span>
                </div>

                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {sortedByScore.map((agent) => {
                    const barWidth = (agent.score / maxScore) * 100;
                    return (
                      <div key={agent.id} className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-medium truncate w-[72px] shrink-0 text-right"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                          }}
                          title={agent.name}
                        >
                          {agent.name.length > 10 ? agent.name.slice(0, 10) + '...' : agent.name}
                        </span>
                        <div
                          className="flex-1 h-[14px] rounded-full overflow-hidden"
                          style={{ backgroundColor: 'var(--bg)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: scoreColor(agent.score),
                              boxShadow: `0 0 6px ${scoreGlow(agent.score)}`,
                            }}
                          />
                        </div>
                        <span
                          className="text-[10px] font-bold w-[28px] shrink-0 text-right"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: scoreColor(agent.score),
                          }}
                        >
                          {agent.score}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Department Efficiency (Donut Chart) */}
              <div
                className="card-glass-premium p-5 rounded-xl border"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <PieChart className="w-4 h-4" style={{ color: 'var(--purple)' }} />
                  <span
                    className="text-xs font-bold"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    TASKS NACH ABTEILUNG
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {/* SVG Donut */}
                  <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
                    <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
                      {/* Background circle */}
                      <circle
                        cx="64"
                        cy="64"
                        r={donutRadius}
                        fill="none"
                        stroke="var(--border)"
                        strokeWidth={donutStroke}
                      />
                      {/* Segments */}
                      {(() => {
                        let cumulativeOffset = 0;
                        return deptEntries.map(([dept, count]) => {
                          const pct = totalDeptTasks > 0 ? count / totalDeptTasks : 0;
                          const dashLength = pct * donutCircumference;
                          const gap = donutCircumference - dashLength;
                          const offset = cumulativeOffset;
                          cumulativeOffset += dashLength;
                          const color = getDeptColor(dept);
                          return (
                            <circle
                              key={dept}
                              cx="64"
                              cy="64"
                              r={donutRadius}
                              fill="none"
                              stroke={color}
                              strokeWidth={donutStroke}
                              strokeDasharray={`${dashLength} ${gap}`}
                              strokeDashoffset={-offset}
                              strokeLinecap="butt"
                              className="transition-all duration-700"
                              style={{
                                filter: `drop-shadow(0 0 3px ${color})`,
                              }}
                            />
                          );
                        });
                      })()}
                    </svg>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span
                        className="text-lg font-bold"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {totalDeptTasks}
                      </span>
                      <span
                        className="text-[9px]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Tasks
                      </span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex-1 space-y-1.5 min-w-0 max-h-[120px] overflow-y-auto">
                    {deptEntries.map(([dept, count]) => {
                      const pct = totalDeptTasks > 0 ? Math.round((count / totalDeptTasks) * 100) : 0;
                      return (
                        <div key={dept} className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: getDeptColor(dept) }}
                          />
                          <span
                            className="text-[10px] truncate flex-1"
                            style={{
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-dm-sans)',
                            }}
                          >
                            {dept}
                          </span>
                          <span
                            className="text-[10px] font-bold shrink-0"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Department Filter Tabs + View Toggle + Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {DEPARTMENTS.map((dept) => {
            const isActive = activeDept === dept;
            return (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                aria-label={`Nach Abteilung filtern: ${dept}`}
                aria-pressed={isActive}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: isActive
                    ? getDeptColor(dept)
                    : 'var(--surface)',
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
              <option value="department">Sort: Abteilung</option>
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
              aria-label="Rasteransicht"
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
              aria-label="Listenansicht"
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
          const history = generateScoreHistory(agent);
          const isSelected = selectedAgent?.id === agent.id;

          if (viewMode === 'list') {
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="w-full text-left p-4 rounded-xl border transition-all hover-lift"
                style={{
                  backgroundColor: isSelected
                    ? 'color-mix(in srgb, var(--amber) 5%, var(--surface))'
                    : 'var(--surface)',
                  borderColor: isSelected ? 'var(--amber)' : 'var(--border)',
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
                    className={`hidden sm:inline-flex px-2 py-0.5 rounded text-xs font-bold dept-badge ${deptClass}`}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {agent.dept}
                  </span>

                  {/* Mini sparkline */}
                  <div className="hidden lg:flex w-24 h-6 items-end gap-[2px]">
                    {history.slice(-8).map((val, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm"
                        style={{
                          height: `${(val / 100) * 100}%`,
                          backgroundColor: scoreColor(agent.score),
                          opacity: 0.3 + (i / 8) * 0.7,
                          minWidth: '3px',
                        }}
                      />
                    ))}
                  </div>

                  {/* Score Ring */}
                  <ScoreRing score={agent.score} size={40} strokeWidth={3} />

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
                          agent.errorsToday > 0
                            ? 'var(--red)'
                            : 'var(--text)',
                      }}
                    >
                      {agent.errorsToday}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Fehler
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
                borderColor: isSelected ? 'var(--amber)' : 'var(--border)',
                boxShadow: isSelected
                  ? '0 0 20px var(--amber-glow)'
                  : undefined,
              }}
            >
              {/* Header: Name + Status Dot */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Bot
                    className="w-4 h-4 shrink-0"
                    style={{ color: deptColor }}
                  />
                  <span
                    className="text-sm font-bold truncate"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {agent.name}
                  </span>
                </div>
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

              {/* Department badge + Status */}
              <div className="flex items-center gap-2 mb-3">
                <StatusBadge status={agent.status} />
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold dept-badge ${deptClass}`}
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {agent.dept}
                </span>
              </div>

              {/* Score Ring + Mini Chart side by side */}
              <div className="flex items-center gap-3 mb-3">
                <ScoreRing score={agent.score} size={48} strokeWidth={4} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-end gap-[2px] h-[28px]">
                    {history.slice(-10).map((val, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm"
                        style={{
                          height: `${(val / 100) * 100}%`,
                          backgroundColor: scoreColor(agent.score),
                          opacity: 0.25 + (i / 10) * 0.75,
                          minWidth: '3px',
                        }}
                      />
                    ))}
                  </div>
                  <p
                    className="text-[10px] mt-1"
                    style={{
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Score-Verlauf
                  </p>
                </div>
              </div>

              {/* Tasks vs Errors stacked bar */}
              {(agent.tasksToday > 0 || agent.errorsToday > 0) && (() => {
                const total = agent.tasksToday + agent.errorsToday;
                const taskPct = total > 0 ? (agent.tasksToday / total) * 100 : 100;
                const errorPct = total > 0 ? (agent.errorsToday / total) * 100 : 0;
                return (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-[10px]"
                        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                      >
                        Tasks vs Fehler
                      </span>
                      <span
                        className="text-[10px] font-bold"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                      >
                        {agent.tasksToday}/{agent.errorsToday}
                      </span>
                    </div>
                    <div
                      className="flex w-full h-[6px] rounded-full overflow-hidden"
                      style={{ backgroundColor: 'var(--bg)' }}
                    >
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${taskPct}%`,
                          backgroundColor: 'var(--green)',
                          borderRadius: errorPct > 0 ? '9999px 0 0 9999px' : '9999px',
                        }}
                      />
                      {errorPct > 0 && (
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${errorPct}%`,
                            backgroundColor: 'var(--red)',
                            borderRadius: '0 9999px 9999px 0',
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Stats row */}
              <div
                className="flex items-center justify-between text-xs pt-2"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3" style={{ color: 'var(--blue)' }} />
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
                <div className="flex items-center gap-1">
                  <AlertCircle
                    className="w-3 h-3"
                    style={{
                      color:
                        agent.errorsToday > 0
                          ? 'var(--red)'
                          : 'var(--text-muted)',
                    }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>Fehler </span>
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
            className="col-span-full text-center py-16"
            style={{ color: 'var(--text-muted)' }}
          >
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-mono)' }}>
              Keine Agents gefunden
            </p>
            <p className="text-xs mt-1">
              Versuche andere Filter oder erstelle einen neuen Agent
            </p>
          </div>
        )}
      </div>

      {/* Detail Panel (slide-in from right) */}
      {selectedAgent && (
        <DetailPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onRestart={handleRestartAgent}
          onDisable={handleDisableAgent}
          isActioning={actioningAgent === selectedAgent.id}
        />
      )}

      {/* Create Agent Modal */}
      {showCreateModal && (
        <CreateAgentModal
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
