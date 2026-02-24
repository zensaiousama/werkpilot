'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  Calendar,
  CalendarDays,
  Terminal,
  Trash2,
  TrendingUp,
  TrendingDown,
  Timer,
  AlarmClock,
  ToggleLeft,
  ToggleRight,
  Database,
  FileText,
  Bell,
  Eraser,
} from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';

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

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
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

// Sample log messages for simulation
const SAMPLE_LOG_SEQUENCES: { level: LogEntry['level']; message: string }[] = [
  { level: 'INFO', message: 'Night Shift gestartet - Initialisiere Task Queue...' },
  { level: 'INFO', message: 'Verbindung zu Agent-Cluster hergestellt' },
  { level: 'INFO', message: 'Task Queue geladen: 8 Tasks bereit' },
  { level: 'SUCCESS', message: 'Agent-Pool verfuegbar: 4 Worker aktiv' },
  { level: 'INFO', message: '[Task 1/8] Starte: Review all agent logs from today' },
  { level: 'INFO', message: 'Scanning 247 Log-Dateien...' },
  { level: 'WARN', message: 'Agent #3 hat erhoehte Latenz (>2s Response-Time)' },
  { level: 'SUCCESS', message: '[Task 1/8] Abgeschlossen in 12.4s - 3 Issues gefunden' },
  { level: 'INFO', message: '[Task 2/8] Starte: Fix any errors found in logs' },
  { level: 'INFO', message: 'Analysiere 3 Error-Patterns...' },
  { level: 'ERROR', message: 'Retry fuer Patch auf agent-config.yaml (Timeout nach 5s)' },
  { level: 'SUCCESS', message: 'Patch erfolgreich beim 2. Versuch angewendet' },
  { level: 'INFO', message: '[Task 3/8] Starte: Run quality benchmarks on all agents' },
  { level: 'INFO', message: 'Benchmark-Suite v2.1 initialisiert' },
  { level: 'INFO', message: 'Teste Agent #1: Response-Qualitaet...' },
  { level: 'SUCCESS', message: 'Agent #1 Score: 94.2% (+2.1% vs. letzte Nacht)' },
  { level: 'WARN', message: 'Agent #4 Score unter Threshold: 71.8%' },
  { level: 'SUCCESS', message: '[Task 3/8] Benchmarks abgeschlossen - Durchschnitt: 87.3%' },
  { level: 'INFO', message: '[Task 4/8] Starte: Optimize the 3 lowest-scoring agents' },
  { level: 'INFO', message: 'Optimierung laeuft fuer Agent #4, #2, #6...' },
  { level: 'SUCCESS', message: 'Prompt-Tuning abgeschlossen - 12.4% Verbesserung' },
  { level: 'INFO', message: '[Task 5/8] Starte: Write tests for any untested functions' },
  { level: 'INFO', message: '14 ungetestete Funktionen erkannt' },
  { level: 'SUCCESS', message: '14 Tests generiert, 13 bestanden, 1 angepasst' },
  { level: 'INFO', message: '[Task 6/8] Starte: Update documentation' },
  { level: 'SUCCESS', message: 'README und API-Docs aktualisiert' },
  { level: 'INFO', message: '[Task 7/8] Starte: Commit all changes' },
  { level: 'SUCCESS', message: 'Git commit: "nightshift: auto-fixes & optimierungen"' },
  { level: 'INFO', message: '[Task 8/8] Starte: Generate morning report' },
  { level: 'SUCCESS', message: 'Morning Report generiert und gespeichert' },
  { level: 'SUCCESS', message: 'Night Shift abgeschlossen - 8/8 Tasks erfolgreich' },
];

const LOG_LEVEL_COLORS: Record<LogEntry['level'], string> = {
  INFO: 'var(--blue)',
  WARN: 'var(--amber)',
  ERROR: 'var(--red)',
  SUCCESS: 'var(--green)',
};

// --- Sparkline component for stats cards ---
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', opacity: 0.7 }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Execution Timeline Bar ---
function ExecutionTimeline({ tasks }: { tasks: NightTask[] }) {
  const sortedTasks = [...tasks].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (sortedTasks.length === 0) return null;

  const doneCount = sortedTasks.filter(t => t.status === 'done').length;
  const failedCount = sortedTasks.filter(t => t.status === 'failed').length;
  const inProgressCount = sortedTasks.filter(t => t.status === 'in_progress').length;
  const completedCount = doneCount + failedCount;
  const progressPct = sortedTasks.length > 0 ? (completedCount / sortedTasks.length) * 100 : 0;

  const statusIcon = (status: NightTask['status']) => {
    switch (status) {
      case 'done': return <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />;
      case 'failed': return <XCircle size={14} style={{ color: 'var(--red)' }} />;
      case 'in_progress': return <Loader2 size={14} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />;
      default: return <Circle size={14} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  return (
    <div
      className="card-glass-premium rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-sm font-bold flex items-center gap-2"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
        >
          <Timer size={16} />
          EXECUTION TIMELINE
        </h2>
        <span
          className="text-xs px-2 py-1 rounded-full"
          style={{
            fontFamily: 'var(--font-mono)',
            color: inProgressCount > 0 ? 'var(--amber)' : 'var(--green)',
            backgroundColor: inProgressCount > 0 ? 'var(--amber-glow)' : 'var(--green-glow)',
          }}
        >
          {completedCount}/{sortedTasks.length} abgeschlossen
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="relative w-full h-2 rounded-full mb-5 overflow-hidden"
        style={{ backgroundColor: 'rgba(139, 143, 163, 0.15)' }}
      >
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all"
          style={{
            width: `${progressPct}%`,
            background: failedCount > 0
              ? 'linear-gradient(90deg, var(--green), var(--red))'
              : 'linear-gradient(90deg, var(--purple), var(--green))',
            transition: 'width 0.6s ease',
          }}
        />
        {inProgressCount > 0 && (
          <div
            className="absolute top-0 h-full rounded-full"
            style={{
              left: `${progressPct}%`,
              width: `${(inProgressCount / sortedTasks.length) * 100}%`,
              background: 'var(--amber)',
              opacity: 0.5,
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Step markers */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {sortedTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg shrink-0"
            style={{
              backgroundColor: task.status === 'in_progress'
                ? 'var(--amber-glow)'
                : task.status === 'done'
                  ? 'var(--green-glow)'
                  : task.status === 'failed'
                    ? 'var(--red-glow)'
                    : 'rgba(139, 143, 163, 0.08)',
              border: task.status === 'in_progress'
                ? '1px solid rgba(245, 158, 11, 0.3)'
                : '1px solid transparent',
              minWidth: '160px',
              maxWidth: '220px',
            }}
          >
            {statusIcon(task.status)}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                {task.task}
              </p>
              <p
                className="text-[10px]"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {task.duration ? formatDuration(task.duration) : task.status === 'in_progress' ? 'laeuft...' : 'wartend'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Task type definitions for the weekly schedule ---
type ScheduleTaskType = 'data-sync' | 'cleanup' | 'reports' | 'notifications';

interface ScheduleTask {
  id: string;
  name: string;
  type: ScheduleTaskType;
  startHour: number;
  startMinute: number;
  durationMinutes: number;
}

interface DaySchedule {
  day: string;
  dayShort: string;
  tasks: ScheduleTask[];
}

const TASK_TYPE_CONFIG: Record<ScheduleTaskType, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof Database }> = {
  'data-sync': {
    label: 'Datensync',
    color: 'var(--blue)',
    bgColor: 'rgba(96, 165, 250, 0.12)',
    borderColor: 'rgba(96, 165, 250, 0.35)',
    icon: Database,
  },
  'cleanup': {
    label: 'Bereinigung',
    color: 'var(--amber)',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    icon: Eraser,
  },
  'reports': {
    label: 'Reports',
    color: 'var(--green)',
    bgColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.35)',
    icon: FileText,
  },
  'notifications': {
    label: 'Benachrichtigungen',
    color: 'var(--purple)',
    bgColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
    icon: Bell,
  },
};

const WEEKLY_SCHEDULE: DaySchedule[] = [
  {
    day: 'Montag',
    dayShort: 'Mo',
    tasks: [
      { id: 'mo-1', name: 'DB Backup', type: 'data-sync', startHour: 0, startMinute: 30, durationMinutes: 45 },
      { id: 'mo-2', name: 'Log Cleanup', type: 'cleanup', startHour: 1, startMinute: 30, durationMinutes: 30 },
      { id: 'mo-3', name: 'Wochen-Report', type: 'reports', startHour: 3, startMinute: 0, durationMinutes: 60 },
      { id: 'mo-4', name: 'Team-Alerts', type: 'notifications', startHour: 5, startMinute: 0, durationMinutes: 30 },
    ],
  },
  {
    day: 'Dienstag',
    dayShort: 'Di',
    tasks: [
      { id: 'di-1', name: 'CRM Sync', type: 'data-sync', startHour: 0, startMinute: 0, durationMinutes: 60 },
      { id: 'di-2', name: 'Temp-Dateien', type: 'cleanup', startHour: 2, startMinute: 0, durationMinutes: 30 },
      { id: 'di-3', name: 'Agent-Report', type: 'reports', startHour: 4, startMinute: 0, durationMinutes: 45 },
    ],
  },
  {
    day: 'Mittwoch',
    dayShort: 'Mi',
    tasks: [
      { id: 'mi-1', name: 'API Sync', type: 'data-sync', startHour: 0, startMinute: 15, durationMinutes: 45 },
      { id: 'mi-2', name: 'Cache Purge', type: 'cleanup', startHour: 1, startMinute: 30, durationMinutes: 30 },
      { id: 'mi-3', name: 'Performance', type: 'reports', startHour: 2, startMinute: 30, durationMinutes: 60 },
      { id: 'mi-4', name: 'Slack Digest', type: 'notifications', startHour: 5, startMinute: 15, durationMinutes: 30 },
    ],
  },
  {
    day: 'Donnerstag',
    dayShort: 'Do',
    tasks: [
      { id: 'do-1', name: 'ERP Sync', type: 'data-sync', startHour: 0, startMinute: 0, durationMinutes: 90 },
      { id: 'do-2', name: 'Umsatz-Report', type: 'reports', startHour: 3, startMinute: 0, durationMinutes: 45 },
      { id: 'do-3', name: 'Erinnerungen', type: 'notifications', startHour: 5, startMinute: 0, durationMinutes: 30 },
    ],
  },
  {
    day: 'Freitag',
    dayShort: 'Fr',
    tasks: [
      { id: 'fr-1', name: 'Full Backup', type: 'data-sync', startHour: 0, startMinute: 0, durationMinutes: 120 },
      { id: 'fr-2', name: 'Archivierung', type: 'cleanup', startHour: 2, startMinute: 30, durationMinutes: 45 },
      { id: 'fr-3', name: 'Wochen-Bericht', type: 'reports', startHour: 3, startMinute: 30, durationMinutes: 60 },
      { id: 'fr-4', name: 'Wochenend-Mail', type: 'notifications', startHour: 5, startMinute: 0, durationMinutes: 30 },
    ],
  },
  {
    day: 'Samstag',
    dayShort: 'Sa',
    tasks: [
      { id: 'sa-1', name: 'Incremental Sync', type: 'data-sync', startHour: 1, startMinute: 0, durationMinutes: 45 },
      { id: 'sa-2', name: 'Deep Clean', type: 'cleanup', startHour: 2, startMinute: 0, durationMinutes: 60 },
    ],
  },
  {
    day: 'Sonntag',
    dayShort: 'So',
    tasks: [
      { id: 'so-1', name: 'Full Sync', type: 'data-sync', startHour: 0, startMinute: 0, durationMinutes: 90 },
      { id: 'so-2', name: 'System Purge', type: 'cleanup', startHour: 2, startMinute: 0, durationMinutes: 60 },
      { id: 'so-3', name: 'Montag-Vorbereitung', type: 'reports', startHour: 4, startMinute: 0, durationMinutes: 60 },
    ],
  },
];

const TIME_SLOTS = [0, 1, 2, 3, 4, 5]; // 00:00 - 05:00 (each represents a 1-hour slot up to 06:00)

function WeeklyScheduleCalendar() {
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Determine current day of week (0=Mo ... 6=So)
  const now = new Date();
  const jsDay = now.getDay(); // 0=Sun, 1=Mon ...
  const currentDayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Mon ... 6=Sun

  const totalMinutes = 360; // 6 hours = 360 minutes

  const getTaskPosition = (task: ScheduleTask) => {
    const startOffset = task.startHour * 60 + task.startMinute;
    const leftPercent = (startOffset / totalMinutes) * 100;
    const widthPercent = (task.durationMinutes / totalMinutes) * 100;
    return { left: `${leftPercent}%`, width: `${widthPercent}%` };
  };

  const activeDayIndex = selectedDay !== null ? selectedDay : null;

  return (
    <div className="card-glass-premium rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2
          className="text-sm font-bold flex items-center gap-2"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
        >
          <CalendarDays size={16} />
          WOCHENPLAN
        </h2>
        <span
          className="text-xs px-2 py-1 rounded-full"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            backgroundColor: 'rgba(139, 143, 163, 0.1)',
          }}
        >
          00:00 &ndash; 06:00 Nightshift
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {(Object.keys(TASK_TYPE_CONFIG) as ScheduleTaskType[]).map((type) => {
          const config = TASK_TYPE_CONFIG[type];
          const Icon = config.icon;
          return (
            <div
              key={type}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
              style={{
                backgroundColor: config.bgColor,
                color: config.color,
                border: `1px solid ${config.borderColor}`,
                fontFamily: 'var(--font-mono)',
              }}
            >
              <Icon size={11} />
              {config.label}
            </div>
          );
        })}
      </div>

      {/* Time axis header */}
      <div className="flex" style={{ marginBottom: '2px' }}>
        {/* Day label spacer */}
        <div style={{ width: '48px', flexShrink: 0 }} />
        {/* Time labels */}
        <div className="flex-1 relative" style={{ height: '20px' }}>
          {TIME_SLOTS.map((hour) => {
            const leftPercent = (hour / 6) * 100;
            return (
              <span
                key={hour}
                className="absolute text-[10px]"
                style={{
                  left: `${leftPercent}%`,
                  transform: 'translateX(-50%)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {hour.toString().padStart(2, '0')}:00
              </span>
            );
          })}
          {/* 06:00 end label */}
          <span
            className="absolute text-[10px]"
            style={{
              left: '100%',
              transform: 'translateX(-50%)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            06:00
          </span>
        </div>
      </div>

      {/* Day rows */}
      <div className="space-y-1">
        {WEEKLY_SCHEDULE.map((day, dayIndex) => {
          const isToday = dayIndex === currentDayIndex;
          const isSelected = activeDayIndex === dayIndex;
          return (
            <div
              key={day.dayShort}
              className="flex items-stretch rounded-lg transition-all"
              style={{
                backgroundColor: isToday
                  ? 'rgba(139, 92, 246, 0.06)'
                  : isSelected
                    ? 'rgba(139, 143, 163, 0.04)'
                    : 'transparent',
                border: isToday
                  ? '1px solid rgba(139, 92, 246, 0.2)'
                  : '1px solid transparent',
                cursor: 'pointer',
                minHeight: '44px',
              }}
              onClick={() => setSelectedDay(isSelected ? null : dayIndex)}
            >
              {/* Day label */}
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: '48px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'var(--purple)' : 'var(--text-secondary)',
                }}
              >
                {day.dayShort}
              </div>

              {/* Timeline area */}
              <div
                className="flex-1 relative"
                style={{
                  borderLeft: '1px solid var(--border)',
                  minHeight: '40px',
                }}
              >
                {/* Hour grid lines */}
                {TIME_SLOTS.map((hour) => {
                  const leftPercent = (hour / 6) * 100;
                  return (
                    <div
                      key={hour}
                      className="absolute top-0 bottom-0"
                      style={{
                        left: `${leftPercent}%`,
                        width: '1px',
                        backgroundColor: hour === 0 ? 'transparent' : 'var(--border)',
                        opacity: 0.5,
                      }}
                    />
                  );
                })}

                {/* Task blocks */}
                <div className="relative w-full" style={{ padding: '4px 0' }}>
                  {day.tasks.map((task) => {
                    const pos = getTaskPosition(task);
                    const config = TASK_TYPE_CONFIG[task.type];
                    const isHovered = hoveredTask === task.id;
                    const Icon = config.icon;
                    return (
                      <div
                        key={task.id}
                        className="absolute rounded-md flex items-center gap-1 overflow-hidden transition-all"
                        style={{
                          left: pos.left,
                          width: pos.width,
                          top: '3px',
                          height: '30px',
                          backgroundColor: isHovered ? config.bgColor.replace('0.12', '0.22') : config.bgColor,
                          border: `1px solid ${config.borderColor}`,
                          padding: '0 6px',
                          zIndex: isHovered ? 10 : 1,
                          boxShadow: isHovered
                            ? `0 0 12px ${config.borderColor}`
                            : 'none',
                          cursor: 'default',
                        }}
                        onMouseEnter={() => setHoveredTask(task.id)}
                        onMouseLeave={() => setHoveredTask(null)}
                        onClick={(e) => e.stopPropagation()}
                        title={`${task.name} (${task.startHour.toString().padStart(2, '0')}:${task.startMinute.toString().padStart(2, '0')} - ${Math.floor((task.startHour * 60 + task.startMinute + task.durationMinutes) / 60).toString().padStart(2, '0')}:${((task.startHour * 60 + task.startMinute + task.durationMinutes) % 60).toString().padStart(2, '0')})`}
                      >
                        <Icon
                          size={11}
                          style={{ color: config.color, flexShrink: 0 }}
                        />
                        <span
                          className="text-[10px] font-medium truncate"
                          style={{
                            color: config.color,
                            fontFamily: 'var(--font-mono)',
                            lineHeight: 1,
                          }}
                        >
                          {task.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded detail view for selected day */}
      {activeDayIndex !== null && (
        <div
          className="mt-4 rounded-lg p-4"
          style={{
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
          }}
        >
          <h3
            className="text-xs font-bold mb-3 flex items-center gap-2"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
          >
            <Clock size={13} />
            {WEEKLY_SCHEDULE[activeDayIndex].day.toUpperCase()} &ndash; GEPLANTE TASKS
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {WEEKLY_SCHEDULE[activeDayIndex].tasks.map((task) => {
              const config = TASK_TYPE_CONFIG[task.type];
              const Icon = config.icon;
              const endMinutes = task.startHour * 60 + task.startMinute + task.durationMinutes;
              const endHour = Math.floor(endMinutes / 60);
              const endMin = endMinutes % 60;
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{
                    backgroundColor: config.bgColor,
                    border: `1px solid ${config.borderColor}`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: config.borderColor,
                    }}
                  >
                    <Icon size={14} style={{ color: config.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-semibold truncate"
                      style={{ color: 'var(--text)' }}
                    >
                      {task.name}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {task.startHour.toString().padStart(2, '0')}:{task.startMinute.toString().padStart(2, '0')} &ndash; {endHour.toString().padStart(2, '0')}:{endMin.toString().padStart(2, '0')} ({task.durationMinutes}min)
                    </p>
                  </div>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: config.borderColor,
                      color: config.color,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Schedule Widget ---
function ScheduleWidget() {
  const [autoRun, setAutoRun] = useState(true);
  const [scheduleHour, setScheduleHour] = useState('02');
  const [scheduleMinute, setScheduleMinute] = useState('00');

  return (
    <div
      className="rounded-xl border p-5"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <h2
        className="text-sm font-bold mb-4 flex items-center gap-2"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
      >
        <AlarmClock size={16} />
        ZEITPLAN
      </h2>

      <div
        className="flex items-center gap-3 p-3 rounded-lg mb-3"
        style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
      >
        <Moon size={16} style={{ color: 'var(--purple)', flexShrink: 0 }} />
        <div className="flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
            Naechste Night Shift
          </p>
          <p
            className="text-sm font-bold"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
          >
            Heute, {scheduleHour}:{scheduleMinute} Uhr
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Auto-Run Zeitplan
        </span>
        <button
          onClick={() => setAutoRun(!autoRun)}
          className="flex items-center gap-1.5 transition-all"
          style={{ color: autoRun ? 'var(--green)' : 'var(--text-muted)' }}
        >
          {autoRun ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
        </button>
      </div>

      {autoRun && (
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            Startzeit
          </label>
          <div className="flex items-center gap-1 flex-1">
            <select
              value={scheduleHour}
              onChange={(e) => setScheduleHour(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>:</span>
            <select
              value={scheduleMinute}
              onChange={(e) => setScheduleMinute(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {['00', '15', '30', '45'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Uhr</span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Console Log Viewer ---
function ConsoleLogViewer({ logs, onClear }: { logs: LogEntry[]; onClear: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && expanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, expanded]);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center justify-between cursor-pointer"
        style={{ borderBottom: expanded ? '1px solid var(--border)' : 'none' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Terminal size={16} style={{ color: 'var(--green)' }} />
          <h2
            className="text-sm font-bold"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
          >
            CONSOLE LOG
          </h2>
          {logs.length > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(139, 143, 163, 0.15)',
              }}
            >
              {logs.length} Eintraege
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
              style={{
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(139, 143, 163, 0.08)',
              }}
            >
              <Trash2 size={12} />
              Clear
            </button>
          )}
          {expanded ? (
            <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
          ) : (
            <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
      </div>

      {/* Log content */}
      {expanded && (
        <div
          ref={scrollRef}
          className="p-4 overflow-y-auto"
          style={{
            backgroundColor: '#07070c',
            maxHeight: '300px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            lineHeight: '1.8',
          }}
        >
          {logs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>
              Warte auf Night Shift Ausfuehrung...
            </p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-3" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  {log.timestamp}
                </span>
                <span
                  className="font-bold"
                  style={{
                    color: LOG_LEVEL_COLORS[log.level],
                    flexShrink: 0,
                    minWidth: '56px',
                  }}
                >
                  [{log.level}]
                </span>
                <span style={{ color: LOG_LEVEL_COLORS[log.level], opacity: 0.9 }}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

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
  if (!iso) return '\u2014';
  const d = new Date(iso);
  return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(ms: number | null) {
  if (!ms) return '\u2014';
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
            <span>{task.tokensUsed ? task.tokensUsed.toLocaleString() : '\u2014'} tokens</span>
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
      {sortedTasks.map((task) => (
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const logTimeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  // Cleanup log timeouts on unmount
  useEffect(() => {
    const refs = logTimeoutRefs.current;
    return () => {
      refs.forEach(clearTimeout);
    };
  }, []);

  const startLogSimulation = useCallback(() => {
    // Clear existing timeouts
    logTimeoutRefs.current.forEach(clearTimeout);
    logTimeoutRefs.current = [];

    const now = new Date();

    SAMPLE_LOG_SEQUENCES.forEach((logDef, index) => {
      const timeout = setTimeout(() => {
        const ts = new Date(now.getTime() + index * 800);
        const timestamp = ts.toLocaleTimeString('de-CH', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        logIdRef.current += 1;
        setLogs((prev) => [
          ...prev,
          {
            id: logIdRef.current,
            timestamp,
            level: logDef.level,
            message: logDef.message,
          },
        ]);
      }, index * 800);
      logTimeoutRefs.current.push(timeout);
    });
  }, []);

  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

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
    startLogSimulation();
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

  // Sparkline data (simulated recent trend data)
  const sparkTasks = [5, 7, 6, 8, 12, 10, stats.totalTasks || 8];
  const sparkSuccess = [78, 82, 85, 80, 88, 92, isNaN(stats.successRate) ? 85 : stats.successRate];
  const sparkDuration = [4500, 3800, 5200, 4100, 3600, 4000, stats.avgDuration || 4000];
  const sparkTokens = [2100, 3400, 2800, 4100, 3200, 3800, stats.totalTokens || 3500];

  // Trend calculation helpers
  const trendUp = (data: number[]) => data.length >= 2 && data[data.length - 1] >= data[data.length - 2];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Night Shift' }]} />
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

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Total Tasks */}
        <div className="card-glass-premium p-3 md:p-5 rounded-xl text-center relative overflow-hidden">
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Total Tasks
          </p>
          <div className="flex items-center justify-center gap-2">
            <p
              className="text-2xl md:text-3xl font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
            >
              {stats.totalTasks}
            </p>
            <span style={{ color: trendUp(sparkTasks) ? 'var(--green)' : 'var(--red)' }}>
              {trendUp(sparkTasks) ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </span>
          </div>
          <div className="flex justify-center mt-2">
            <MiniSparkline data={sparkTasks} color="var(--purple)" />
          </div>
        </div>

        {/* Success Rate */}
        <div className="card-glass-premium p-3 md:p-5 rounded-xl text-center relative overflow-hidden">
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Success Rate
          </p>
          <div className="flex items-center justify-center gap-2">
            <p
              className="text-2xl md:text-3xl font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
            >
              {isNaN(stats.successRate) ? '0' : stats.successRate.toFixed(0)}%
            </p>
            <span style={{ color: trendUp(sparkSuccess) ? 'var(--green)' : 'var(--red)' }}>
              {trendUp(sparkSuccess) ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </span>
          </div>
          <div className="flex justify-center mt-2">
            <MiniSparkline data={sparkSuccess} color="var(--green)" />
          </div>
        </div>

        {/* Avg Duration */}
        <div className="card-glass-premium p-3 md:p-5 rounded-xl text-center relative overflow-hidden">
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Avg Duration
          </p>
          <div className="flex items-center justify-center gap-2">
            <p
              className="text-2xl md:text-3xl font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}
            >
              {formatDuration(stats.avgDuration)}
            </p>
            <span style={{ color: !trendUp(sparkDuration) ? 'var(--green)' : 'var(--red)' }}>
              {!trendUp(sparkDuration) ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
            </span>
          </div>
          <div className="flex justify-center mt-2">
            <MiniSparkline data={sparkDuration} color="var(--blue)" />
          </div>
        </div>

        {/* Tokens Used */}
        <div className="card-glass-premium p-3 md:p-5 rounded-xl text-center relative overflow-hidden">
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Tokens Used
          </p>
          <div className="flex items-center justify-center gap-2">
            <p
              className="text-2xl md:text-3xl font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
            >
              {(stats.totalTokens / 1000).toFixed(1)}K
            </p>
            <span style={{ color: trendUp(sparkTokens) ? 'var(--amber)' : 'var(--green)' }}>
              {trendUp(sparkTokens) ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </span>
          </div>
          <div className="flex justify-center mt-2">
            <MiniSparkline data={sparkTokens} color="var(--amber)" />
          </div>
        </div>
      </div>

      {/* Execution Timeline */}
      {tasks.length > 0 && <ExecutionTimeline tasks={tasks} />}

      {/* Weekly Schedule Calendar */}
      <WeeklyScheduleCalendar />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Task Creation + Schedule + Filters */}
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

          {/* Schedule Widget */}
          <ScheduleWidget />

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

      {/* Console Log Viewer */}
      <ConsoleLogViewer logs={logs} onClear={handleClearLogs} />
    </div>
  );
}
