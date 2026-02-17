'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Moon,
  Play,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  Plus,
  Calendar
} from 'lucide-react';

interface NightTask {
  id: string;
  task: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  output: string | null;
  duration: number | null;
  tokensUsed: number | null;
  createdAt: string;
}

interface TaskStats {
  totalTasks: number;
  successRate: number;
  avgDuration: number;
  totalTokens: number;
}

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'done' | 'failed';

// Sample predefined tasks for "Run Night Shift"
const PREDEFINED_TASKS = [
  { task: 'Review all agent logs from today', priority: 1 },
  { task: 'Fix any errors found in logs', priority: 1 },
  { task: 'Run quality benchmarks on all agents', priority: 2 },
  { task: 'Optimize the 3 lowest-scoring agents', priority: 2 },
  { task: 'Write tests for any untested functions', priority: 2 },
  { task: 'Update documentation', priority: 3 },
  { task: 'Commit all changes', priority: 3 },
  { task: 'Generate morning report', priority: 1 },
];

function PriorityBadge({ priority }: { priority: number }) {
  const colors = {
    1: { bg: 'rgba(239, 68, 68, 0.12)', text: 'var(--red)', border: 'rgba(239, 68, 68, 0.3)' },
    2: { bg: 'rgba(245, 158, 11, 0.12)', text: 'var(--amber)', border: 'rgba(245, 158, 11, 0.3)' },
    3: { bg: 'rgba(96, 165, 250, 0.12)', text: 'var(--blue)', border: 'rgba(96, 165, 250, 0.3)' },
  };
  const color = colors[priority as keyof typeof colors] || colors[3];

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
      style={{
        backgroundColor: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
        fontFamily: 'var(--font-mono)',
      }}
    >
      P{priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { icon: typeof Circle; color: string; bg: string; label: string; spin?: boolean }> = {
    pending: {
      icon: Circle,
      color: 'var(--text-muted)',
      bg: 'rgba(139, 143, 163, 0.1)',
      label: 'Pending'
    },
    in_progress: {
      icon: Loader2,
      color: 'var(--amber)',
      bg: 'rgba(245, 158, 11, 0.12)',
      label: 'In Progress',
      spin: true
    },
    done: {
      icon: CheckCircle2,
      color: 'var(--green)',
      bg: 'rgba(34, 197, 94, 0.12)',
      label: 'Done'
    },
    failed: {
      icon: XCircle,
      color: 'var(--red)',
      bg: 'rgba(239, 68, 68, 0.12)',
      label: 'Failed'
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: config.bg,
        color: config.color,
      }}
    >
      <Icon size={12} className={config.spin ? 'animate-spin' : ''} style={{ animation: config.spin ? 'spin 1s linear infinite' : 'none' }} />
      {config.label}
    </span>
  );
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(ms: number | null) {
  if (!ms) return '—';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function TaskCard({ task, onRefresh }: { task: NightTask; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg border transition-all"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: task.status === 'in_progress' ? 'var(--purple)' : 'var(--border)',
        boxShadow: task.status === 'in_progress' ? '0 0 20px rgba(139, 92, 246, 0.15)' : 'none',
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
            <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text)' }}>
              {task.task}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2">
            <Clock size={12} />
            <span>{formatDuration(task.duration)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={12} />
            <span>{task.tokensUsed ? task.tokensUsed.toLocaleString() : '—'} tokens</span>
          </div>
        </div>

        {task.status === 'in_progress' && (
          <div className="mt-3">
            <div className="loading-bar" />
          </div>
        )}

        {task.output && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-xs font-medium transition-colors"
              style={{ color: 'var(--purple)' }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'Hide Output' : 'Show Output'}
            </button>
            {expanded && (
              <div
                className="mt-2 p-3 rounded text-xs leading-relaxed"
                style={{
                  backgroundColor: '#0a0a0f',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}
              >
                {task.output}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineView({ tasks }: { tasks: NightTask[] }) {
  const sortedTasks = [...tasks].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="space-y-0">
      {sortedTasks.map((task, idx) => (
        <div key={task.id} className="timeline-item">
          <div
            className={`timeline-dot ${
              task.status === 'done' ? 'completed' :
              task.status === 'in_progress' ? 'active' :
              task.status === 'failed' ? 'error' :
              'pending'
            }`}
          />
          <div className="timeline-line" />

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3 mb-1">
            <div className="flex-1">
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                {task.task}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {formatTime(task.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex sm:flex-col sm:text-right text-xs gap-2 sm:gap-0" style={{ color: 'var(--text-muted)' }}>
              {task.duration && <div>{formatDuration(task.duration)}</div>}
              {task.tokensUsed && <div>{task.tokensUsed.toLocaleString()} tokens</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NightShiftPage() {
  const [tasks, setTasks] = useState<NightTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [newPriority, setNewPriority] = useState<1 | 2 | 3>(2);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [runningNightShift, setRunningNightShift] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/nightshift');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 15000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setSubmitting(true);
    try {
      await fetch('/api/nightshift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: newTask.trim(), priority: newPriority }),
      });
      setNewTask('');
      setNewPriority(2);
      await fetchTasks();
    } catch {
      // silently handle
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunNightShift = async () => {
    setRunningNightShift(true);
    try {
      for (const task of PREDEFINED_TASKS) {
        await fetch('/api/nightshift', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        });
      }
      await fetchTasks();
    } catch {
      // silently handle
    } finally {
      setRunningNightShift(false);
    }
  };

  // Calculate stats
  const stats: TaskStats = {
    totalTasks: tasks.length,
    successRate: tasks.length > 0
      ? (tasks.filter(t => t.status === 'done').length / tasks.filter(t => t.status === 'done' || t.status === 'failed').length) * 100
      : 0,
    avgDuration: tasks.filter(t => t.duration).reduce((sum, t) => sum + (t.duration || 0), 0) / (tasks.filter(t => t.duration).length || 1),
    totalTokens: tasks.reduce((sum, t) => sum + (t.tokensUsed || 0), 0),
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filterStatus === 'all') return true;
    return task.status === filterStatus;
  });

  // Recent activity log (last 10 completed tasks)
  const recentActivity = tasks
    .filter(t => t.status === 'done' || t.status === 'failed')
    .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--purple) 20%, transparent)',
              border: '1px solid var(--purple)',
            }}
          >
            <Moon size={20} className="md:hidden" style={{ color: 'var(--purple)' }} />
            <Moon size={24} className="hidden md:block" style={{ color: 'var(--purple)' }} />
          </div>
          <div>
            <h1
              className="text-lg md:text-2xl font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
            >
              Night Shift Control Panel
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Autonomous task execution while you sleep
            </p>
          </div>
        </div>

        <button
          onClick={handleRunNightShift}
          disabled={runningNightShift}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] w-full sm:w-auto"
          style={{
            backgroundColor: 'var(--purple)',
            color: '#ffffff',
            opacity: runningNightShift ? 0.6 : 1,
            cursor: runningNightShift ? 'not-allowed' : 'pointer',
          }}
        >
          {runningNightShift ? (
            <>
              <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              Queuing Tasks...
            </>
          ) : (
            <>
              <Play size={16} />
              Run Night Shift
            </>
          )}
        </button>
      </div>

      {/* Execution Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div
          className="p-3 md:p-5 rounded-xl border text-center transition-all hover:transform hover:translateY(-1px)"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Total Tasks
          </p>
          <p
            className="text-2xl md:text-3xl font-bold tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
          >
            {stats.totalTasks}
          </p>
        </div>

        <div
          className="p-3 md:p-5 rounded-xl border text-center transition-all hover:transform hover:translateY(-1px)"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Success Rate
          </p>
          <p
            className="text-2xl md:text-3xl font-bold tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
          >
            {isNaN(stats.successRate) ? '0' : stats.successRate.toFixed(0)}%
          </p>
        </div>

        <div
          className="p-3 md:p-5 rounded-xl border text-center transition-all hover:transform hover:translateY(-1px)"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Avg Duration
          </p>
          <p
            className="text-2xl md:text-3xl font-bold tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}
          >
            {formatDuration(stats.avgDuration)}
          </p>
        </div>

        <div
          className="p-3 md:p-5 rounded-xl border text-center transition-all hover:transform hover:translateY(-1px)"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Tokens Used
          </p>
          <p
            className="text-2xl md:text-3xl font-bold tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
          >
            {(stats.totalTokens / 1000).toFixed(1)}K
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Task Creation + Filters */}
        <div className="lg:col-span-1 space-y-4">
          {/* Task Creation Form */}
          <div
            className="rounded-xl border p-5"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h2
              className="text-sm font-bold mb-3 flex items-center gap-2"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
            >
              <Plus size={16} />
              ADD NEW TASK
            </h2>
            <form onSubmit={handleAddTask} className="space-y-3">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Describe the task..."
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none transition-all"
                style={{
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Priority
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(Number(e.target.value) as 1 | 2 | 3)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <option value={1}>P1 - Critical</option>
                  <option value={2}>P2 - High</option>
                  <option value={3}>P3 - Normal</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting || !newTask.trim()}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: 'var(--purple)',
                  color: '#ffffff',
                  opacity: submitting || !newTask.trim() ? 0.5 : 1,
                  cursor: submitting || !newTask.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Adding...' : 'Add to Queue'}
              </button>
            </form>
          </div>

          {/* Recent Activity Log */}
          <div
            className="rounded-xl border"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div
              className="px-5 py-3 border-b flex items-center gap-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <Calendar size={14} style={{ color: 'var(--purple)' }} />
              <h2
                className="text-sm font-bold"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
              >
                RECENT ACTIVITY
              </h2>
            </div>
            <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  No recent activity
                </p>
              ) : (
                recentActivity.map((task) => (
                  <div
                    key={task.id}
                    className="p-2.5 rounded-lg border"
                    style={{
                      borderColor: 'var(--border)',
                      backgroundColor: 'var(--bg)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {task.status === 'done' ? (
                        <CheckCircle2 size={12} style={{ color: 'var(--green)' }} />
                      ) : (
                        <XCircle size={12} style={{ color: 'var(--red)' }} />
                      )}
                      <span className="text-xs font-medium truncate-1" style={{ color: 'var(--text)' }}>
                        {task.task}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>{formatTime(task.completedAt)}</span>
                      <span>{formatDuration(task.duration)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Task List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Tabs + View Toggle */}
          <div
            className="rounded-xl border p-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex gap-2 overflow-x-auto pb-1 w-full sm:w-auto scrollbar-hide">
                {(['all', 'pending', 'in_progress', 'done', 'failed'] as FilterStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: filterStatus === status ? 'var(--purple)' : 'var(--bg)',
                      color: filterStatus === status ? '#ffffff' : 'var(--text-secondary)',
                      border: `1px solid ${filterStatus === status ? 'var(--purple)' : 'var(--border)'}`,
                    }}
                  >
                    {status.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: viewMode === 'grid' ? 'var(--purple)' : 'var(--bg)',
                    color: viewMode === 'grid' ? '#ffffff' : 'var(--text-secondary)',
                    border: `1px solid ${viewMode === 'grid' ? 'var(--purple)' : 'var(--border)'}`,
                  }}
                >
                  GRID
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: viewMode === 'timeline' ? 'var(--purple)' : 'var(--bg)',
                    color: viewMode === 'timeline' ? '#ffffff' : 'var(--text-secondary)',
                    border: `1px solid ${viewMode === 'timeline' ? 'var(--purple)' : 'var(--border)'}`,
                  }}
                >
                  TIMELINE
                </button>
              </div>
            </div>
          </div>

          {/* Tasks Display */}
          <div
            className="rounded-xl border p-5 min-h-[500px]"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-32 rounded-lg" />
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Moon size={32} />
                </div>
                <h3>No tasks found</h3>
                <p>
                  {filterStatus === 'all'
                    ? 'Create a new task or run Night Shift to get started.'
                    : `No ${filterStatus.replace('_', ' ')} tasks.`}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onRefresh={fetchTasks} />
                ))}
              </div>
            ) : (
              <TimelineView tasks={filteredTasks} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
