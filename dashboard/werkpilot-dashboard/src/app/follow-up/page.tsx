'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  RotateCcw,
  Clock,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Search,
  Filter,
  ArrowUpDown,
  Flame,
  Play,
  Zap,
  Activity,
  TrendingUp,
  Target,
  FileText,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import Breadcrumb from '@/components/Breadcrumb';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FollowUpLead {
  id: string;
  firma: string;
}

interface FollowUp {
  id: string;
  leadId: string;
  lead: FollowUpLead;
  subject: string;
  type: 'email' | 'call' | 'meeting' | 'linkedin';
  message: string | null;
  priority: number;
  dueDate: string;
  status: 'pending' | 'completed' | 'skipped';
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FollowUpStats {
  dueToday: number;
  overdue: number;
  thisWeek: number;
  completionRate: number;
}

interface SequenceStep {
  type: 'email' | 'call' | 'meeting' | 'linkedin';
  delay: number;       // Tage nach Start
  subject?: string;
  description?: string;
}

interface FollowUpSequence {
  id: string;
  name: string;
  description: string | null;
  steps: SequenceStep[];
  trigger: string;
  active: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PRIORITY_COLORS: Record<number, string> = {
  1: 'var(--red)',
  2: 'var(--amber)',
  3: 'var(--blue)',
  4: 'var(--green)',
  5: 'var(--text-muted)',
};

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Kritisch',
  2: 'Hoch',
  3: 'Normal',
  4: 'Niedrig',
  5: 'Optional',
};

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  email: { icon: Mail, label: 'E-Mail', color: 'var(--blue)', bg: 'rgba(96,165,250,0.12)' },
  call: { icon: Phone, label: 'Anruf', color: 'var(--green)', bg: 'rgba(34,197,94,0.12)' },
  meeting: { icon: Calendar, label: 'Meeting', color: 'var(--purple)', bg: 'rgba(139,92,246,0.12)' },
  linkedin: { icon: MessageSquare, label: 'LinkedIn', color: 'var(--amber)', bg: 'rgba(245,158,11,0.12)' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Ausstehend', bg: 'rgba(245,158,11,0.12)', color: 'var(--amber)' },
  completed: { label: 'Erledigt', bg: 'rgba(34,197,94,0.12)', color: 'var(--green)' },
  skipped: { label: 'Übersprungen', bg: 'rgba(139,143,163,0.1)', color: 'var(--text-secondary)' },
};

const STEP_ICON_MAP: Record<string, React.ElementType> = {
  email: Mail,
  call: Phone,
  meeting: Calendar,
  linkedin: MessageSquare,
};

interface EmailTemplate {
  id: string;
  label: string;
  description: string;
  color: string;
  bg: string;
  subject: string;
  body: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'erstanfrage',
    label: 'Erstanfrage',
    description: 'Erster Kontakt mit neuem Lead',
    color: 'var(--blue)',
    bg: 'rgba(96,165,250,0.12)',
    subject: 'Anfrage – Zusammenarbeit mit Werkpilot',
    body: 'Guten Tag,\n\nVielen Dank fuer Ihr Interesse an unseren Dienstleistungen. Gerne moechte ich Ihnen unsere Loesungen vorstellen und herausfinden, wie wir Sie am besten unterstuetzen koennen.\n\nWaeren Sie diese Woche fuer ein kurzes Gespraech verfuegbar?\n\nFreundliche Gruesse',
  },
  {
    id: 'nachfassen',
    label: 'Nachfassen',
    description: 'Erinnerung nach Erstkontakt',
    color: 'var(--amber)',
    bg: 'rgba(245,158,11,0.12)',
    subject: 'Kurze Rueckmeldung zu unserem Gespraech',
    body: 'Guten Tag,\n\nIch wollte mich kurz melden und nachfragen, ob Sie noch Fragen zu unserem letzten Gespraech haben. Gerne stehe ich Ihnen fuer weitere Informationen zur Verfuegung.\n\nFreundliche Gruesse',
  },
  {
    id: 'terminbestaetigung',
    label: 'Terminbestaetigung',
    description: 'Termin bestaetigen oder erinnern',
    color: 'var(--green)',
    bg: 'rgba(34,197,94,0.12)',
    subject: 'Terminbestaetigung – Unser Treffen',
    body: 'Guten Tag,\n\nHiermit bestaetigen wir unseren gemeinsamen Termin. Bitte lassen Sie mich wissen, falls sich etwas aendern sollte oder Sie Unterlagen im Voraus benoetigen.\n\nIch freue mich auf unser Gespraech.\n\nFreundliche Gruesse',
  },
  {
    id: 'angebot-senden',
    label: 'Angebot senden',
    description: 'Offerte oder Angebot uebermitteln',
    color: 'var(--purple)',
    bg: 'rgba(139,92,246,0.12)',
    subject: 'Ihr individuelles Angebot von Werkpilot',
    body: 'Guten Tag,\n\nWie besprochen sende ich Ihnen anbei unser Angebot. Es ist auf Ihre Anforderungen zugeschnitten und beinhaltet alle relevanten Details.\n\nSollten Sie Fragen haben oder Anpassungen wuenschen, melden Sie sich gerne jederzeit.\n\nFreundliche Gruesse',
  },
  {
    id: 'dankeschoen',
    label: 'Dankeschoen',
    description: 'Bedanken nach Abschluss oder Meeting',
    color: 'var(--cyan)',
    bg: 'rgba(34,211,238,0.12)',
    subject: 'Vielen Dank fuer Ihr Vertrauen',
    body: 'Guten Tag,\n\nHerzlichen Dank fuer die angenehme Zusammenarbeit und Ihr Vertrauen in unser Team. Wir freuen uns, Sie weiterhin unterstuetzen zu duerfen.\n\nBei Fragen stehen wir Ihnen jederzeit gerne zur Verfuegung.\n\nFreundliche Gruesse',
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getDueDateStatus(dueDate: string): 'overdue' | 'today' | 'future' {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  if (dueDay < today) return 'overdue';
  if (dueDay.getTime() === today.getTime()) return 'today';
  return 'future';
}

function getDueDateColor(dueDate: string): string {
  const status = getDueDateStatus(dueDate);
  if (status === 'overdue') return 'var(--red)';
  if (status === 'today') return 'var(--amber)';
  return 'var(--text-secondary)';
}

function getRowHighlight(followUp: FollowUp): string {
  if (followUp.status === 'completed' || followUp.status === 'skipped') return 'transparent';
  const status = getDueDateStatus(followUp.dueDate);
  if (status === 'overdue') return 'rgba(239,68,68,0.04)';
  if (status === 'today') return 'rgba(245,158,11,0.04)';
  return 'transparent';
}

function computeStreak(followUps: FollowUp[]): number {
  const completedDates = new Set<string>();
  for (const fu of followUps) {
    if (fu.status === 'completed' && fu.completedAt) {
      completedDates.add(fu.completedAt.split('T')[0]);
    }
  }
  if (completedDates.size === 0) return 0;

  let streak = 0;
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Check today first; if no completion today, start from yesterday
  const todayStr = day.toISOString().split('T')[0];
  if (!completedDates.has(todayStr)) {
    day.setDate(day.getDate() - 1);
  }

  while (true) {
    const dateStr = day.toISOString().split('T')[0];
    if (completedDates.has(dateStr)) {
      streak++;
      day.setDate(day.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

type SortOption = 'dueDate' | 'priority' | 'status';

/* ------------------------------------------------------------------ */
/*  Mini Calendar Widget                                               */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function MiniCalendar({
  followUps,
  selectedDate,
  onSelectDate,
}: {
  followUps: FollowUp[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => new Date());

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
  const totalDays = lastDay.getDate();

  const todayStr = new Date().toISOString().split('T')[0];

  // Count pending follow-ups per day
  const countsPerDay: Record<string, { pending: number; overdue: number }> = {};
  for (const fu of followUps) {
    if (fu.status !== 'pending') continue;
    const day = fu.dueDate.split('T')[0];
    if (!countsPerDay[day]) countsPerDay[day] = { pending: 0, overdue: 0 };
    countsPerDay[day].pending++;
    if (getDueDateStatus(fu.dueDate) === 'overdue') countsPerDay[day].overdue++;
  }

  const monthLabel = new Date(year, month).toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });

  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= totalDays; d++) days.push(d);

  return (
    <div className="card-glass-premium" style={{ padding: '16px 20px', marginBottom: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button
          onClick={() => setViewMonth(new Date(year, month - 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex' }}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
          {monthLabel}
        </span>
        <button
          onClick={() => setViewMonth(new Date(year, month + 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', display: 'flex' }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            style={{
              textAlign: 'center',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              padding: '4px 0',
              textTransform: 'uppercase',
            }}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const counts = countsPerDay[dateStr];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const hasPending = counts && counts.pending > 0;
          const hasOverdue = counts && counts.overdue > 0;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(isSelected ? null : dateStr)}
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                border: isSelected ? '1px solid var(--amber)' : isToday ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
                background: isSelected
                  ? 'rgba(245,158,11,0.12)'
                  : isToday
                    ? 'rgba(96,165,250,0.06)'
                    : 'transparent',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: isSelected ? 'var(--amber)' : isToday ? 'var(--blue)' : 'var(--text-secondary)',
                fontWeight: isToday || isSelected ? 700 : 400,
                transition: 'all 150ms',
              }}
            >
              {day}
              {hasPending && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: hasOverdue ? 'var(--red)' : 'var(--amber)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date badge */}
      {selectedDate && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Filter: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
          <button
            onClick={() => onSelectDate(null)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <X size={10} /> Zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Heatmap Helpers                                                    */
/* ------------------------------------------------------------------ */

interface HeatmapDay {
  date: string;       // YYYY-MM-DD
  count: number;
  dayOfWeek: number;  // 0 = Monday, 6 = Sunday
}

interface HeatmapData {
  grid: HeatmapDay[][];      // columns (weeks) x rows (days)
  monthLabels: { label: string; colIndex: number }[];
  totalThisMonth: number;
  dailyAverage: number;
  longestStreak: number;
}

function buildHeatmapData(followUps: FollowUp[], totalDays: number): HeatmapData {
  // Count follow-ups per day using dueDate (fallback to createdAt)
  const countsMap: Record<string, number> = {};
  for (const fu of followUps) {
    const dateStr = (fu.dueDate || fu.createdAt).split('T')[0];
    countsMap[dateStr] = (countsMap[dateStr] || 0) + 1;
  }

  // Build day entries for the last `totalDays` days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: HeatmapDay[] = [];

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = (d.getDay() + 6) % 7; // Monday = 0
    days.push({
      date: dateStr,
      count: countsMap[dateStr] || 0,
      dayOfWeek,
    });
  }

  // Arrange into week columns (each column = 7 rows, Mon-Sun)
  // First, pad the beginning so the first day lands on its correct row
  const firstDayOfWeek = days[0].dayOfWeek;
  const paddedDays: (HeatmapDay | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    paddedDays.push(null);
  }
  for (const day of days) {
    paddedDays.push(day);
  }

  // Split into columns of 7
  const grid: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    grid.push(paddedDays.slice(i, i + 7));
  }
  // Pad the last column to 7 rows
  const lastCol = grid[grid.length - 1];
  while (lastCol.length < 7) {
    lastCol.push(null);
  }

  // Month labels
  const monthLabels: { label: string; colIndex: number }[] = [];
  const seenMonths = new Set<string>();
  for (let colIdx = 0; colIdx < grid.length; colIdx++) {
    const col = grid[colIdx];
    for (const cell of col) {
      if (cell) {
        const monthKey = cell.date.substring(0, 7); // YYYY-MM
        if (!seenMonths.has(monthKey)) {
          seenMonths.add(monthKey);
          const [yr, mo] = monthKey.split('-');
          const monthDate = new Date(Number(yr), Number(mo) - 1, 1);
          const label = monthDate.toLocaleDateString('de-CH', { month: 'short' });
          monthLabels.push({ label, colIndex: colIdx });
        }
        break; // only check first non-null cell per column
      }
    }
  }

  // Total this month
  const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  let totalThisMonth = 0;
  let daysInPeriod = 0;
  let totalAll = 0;
  for (const day of days) {
    totalAll += day.count;
    daysInPeriod++;
    if (day.date.startsWith(thisMonthKey)) {
      totalThisMonth += day.count;
    }
  }

  // Daily average
  const dailyAverage = daysInPeriod > 0 ? totalAll / daysInPeriod : 0;

  // Longest streak (consecutive days with at least 1 follow-up)
  let longestStreak = 0;
  let currentStreak = 0;
  for (const day of days) {
    if (day.count > 0) {
      currentStreak++;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  return {
    grid: grid as HeatmapDay[][],
    monthLabels,
    totalThisMonth,
    dailyAverage,
    longestStreak,
  };
}

function getHeatmapCellColor(count: number): string {
  if (count === 0) return 'rgba(255,255,255,0.03)';
  if (count === 1) return 'rgba(245,158,11,0.3)';
  if (count <= 3) return 'rgba(245,158,11,0.5)';
  if (count <= 5) return 'rgba(245,158,11,0.7)';
  return 'rgba(245,158,11,1)';
}

function getHeatmapCellGlow(count: number): string | undefined {
  if (count >= 6) return '0 0 8px rgba(245,158,11,0.5)';
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Heatmap Component                                                  */
/* ------------------------------------------------------------------ */

const HEATMAP_DAY_LABELS = ['Mo', '', 'Mi', '', 'Fr', '', ''];

function FollowUpHeatmap({ followUps }: { followUps: FollowUp[] }) {
  const [hoveredCell, setHoveredCell] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  const data = useMemo(() => buildHeatmapData(followUps, 91), [followUps]);

  const cellSize = 14;
  const cellGap = 3;
  const labelWidth = 28;

  return (
    <div className="card-glass-premium" style={{ padding: '24px 28px', marginTop: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: 'rgba(245,158,11,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Activity size={18} style={{ color: 'var(--amber)' }} />
        </div>
        <div>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Follow-Up Aktivitaet
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
            Letzte 13 Wochen
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Total this month */}
        <div
          style={{
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Target size={12} style={{ color: 'var(--amber)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Dieser Monat
            </span>
          </div>
          <span
            style={{
              fontSize: '22px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--amber)',
              lineHeight: 1,
            }}
          >
            {data.totalThisMonth}
          </span>
        </div>

        {/* Daily average */}
        <div
          style={{
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <TrendingUp size={12} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Taegl. Schnitt
            </span>
          </div>
          <span
            style={{
              fontSize: '22px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text)',
              lineHeight: 1,
            }}
          >
            {data.dailyAverage.toFixed(1)}
          </span>
        </div>

        {/* Longest streak */}
        <div
          style={{
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <Flame size={12} style={{ color: data.longestStreak > 0 ? 'var(--green)' : 'var(--text-muted)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Laengster Streak
            </span>
          </div>
          <span
            style={{
              fontSize: '22px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: data.longestStreak > 0 ? 'var(--green)' : 'var(--text-muted)',
              lineHeight: 1,
            }}
          >
            {data.longestStreak}
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>
              Tage
            </span>
          </span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div style={{ position: 'relative', overflowX: 'auto', paddingBottom: '4px' }}>
        {/* Month Labels */}
        <div
          style={{
            display: 'flex',
            paddingLeft: `${labelWidth}px`,
            marginBottom: '4px',
          }}
        >
          {data.monthLabels.map((ml, idx) => {
            const leftPx = ml.colIndex * (cellSize + cellGap);
            // Calculate width until next label or end
            const nextLeft = idx < data.monthLabels.length - 1
              ? data.monthLabels[idx + 1].colIndex * (cellSize + cellGap)
              : data.grid.length * (cellSize + cellGap);
            const width = nextLeft - leftPx;

            return (
              <div
                key={`${ml.label}-${ml.colIndex}`}
                style={{
                  position: 'absolute',
                  left: `${labelWidth + leftPx}px`,
                  width: `${width}px`,
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {ml.label}
              </div>
            );
          })}
        </div>

        {/* Spacer for month labels */}
        <div style={{ height: '18px' }} />

        {/* Grid: 7 rows x N columns */}
        <div style={{ display: 'flex', gap: '0' }}>
          {/* Day labels column */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${cellGap}px`,
              width: `${labelWidth}px`,
              flexShrink: 0,
            }}
          >
            {HEATMAP_DAY_LABELS.map((label, idx) => (
              <div
                key={`day-label-${idx}`}
                style={{
                  height: `${cellSize}px`,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Heatmap columns */}
          <div style={{ display: 'flex', gap: `${cellGap}px` }}>
            {data.grid.map((col, colIdx) => (
              <div key={`col-${colIdx}`} style={{ display: 'flex', flexDirection: 'column', gap: `${cellGap}px` }}>
                {col.map((cell, rowIdx) => {
                  if (!cell) {
                    return (
                      <div
                        key={`empty-${colIdx}-${rowIdx}`}
                        style={{
                          width: `${cellSize}px`,
                          height: `${cellSize}px`,
                          borderRadius: '3px',
                        }}
                      />
                    );
                  }

                  const bgColor = getHeatmapCellColor(cell.count);
                  const glow = getHeatmapCellGlow(cell.count);

                  return (
                    <div
                      key={cell.date}
                      style={{
                        width: `${cellSize}px`,
                        height: `${cellSize}px`,
                        borderRadius: '3px',
                        backgroundColor: bgColor,
                        boxShadow: glow,
                        cursor: 'pointer',
                        transition: 'transform 100ms, box-shadow 100ms',
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredCell({
                          date: cell.date,
                          count: cell.count,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        });
                        e.currentTarget.style.transform = 'scale(1.3)';
                      }}
                      onMouseLeave={(e) => {
                        setHoveredCell(null);
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '6px',
            marginTop: '12px',
          }}
        >
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Weniger
          </span>
          {[0, 1, 2, 4, 6].map((count) => (
            <div
              key={`legend-${count}`}
              style={{
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                borderRadius: '3px',
                backgroundColor: getHeatmapCellColor(count),
                boxShadow: getHeatmapCellGlow(count),
              }}
            />
          ))}
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Mehr
          </span>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y - 8}px`,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            zIndex: 50,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontWeight: 700, color: hoveredCell.count > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>
            {hoveredCell.count} Follow-Up{hoveredCell.count !== 1 ? 's' : ''}
          </span>
          <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
            {new Date(hoveredCell.date + 'T00:00:00').toLocaleDateString('de-CH', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function FollowUpPage() {
  const { toast } = useToast();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [stats, setStats] = useState<FollowUpStats | null>(null);
  const [sequences, setSequences] = useState<FollowUpSequence[]>([]);
  const [sequencesOpen, setSequencesOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sort
  const [sortBy, setSortBy] = useState<SortOption>('dueDate');

  // Quick complete animation
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Reschedule
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');

  // Lead search for create form
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadSearchResults, setLeadSearchResults] = useState<FollowUpLead[]>([]);
  const [leadSearching, setLeadSearching] = useState(false);
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);

  // Create form state
  const [formData, setFormData] = useState({
    leadId: '',
    leadFirma: '',
    subject: '',
    type: 'email' as 'email' | 'call' | 'meeting' | 'linkedin',
    message: '',
    priority: 3,
    dueDate: '',
    notes: '',
  });

  /* ---------------------------------------------------------------- */
  /*  Fetch data                                                       */
  /* ---------------------------------------------------------------- */

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [followUpRes, statsRes, seqRes] = await Promise.all([
        fetch('/api/follow-up'),
        fetch('/api/follow-up?view=stats'),
        fetch('/api/follow-up?view=sequences'),
      ]);

      if (!followUpRes.ok) throw new Error('Follow-Ups konnten nicht geladen werden');
      if (!statsRes.ok) throw new Error('Statistiken konnten nicht geladen werden');

      const followUpData = await followUpRes.json();
      const statsData = await statsRes.json();

      const items: FollowUp[] = Array.isArray(followUpData)
        ? followUpData
        : followUpData.followUps ?? followUpData.data ?? [];
      items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      setFollowUps(items);
      setStats(statsData.stats ?? statsData);

      if (seqRes.ok) {
        const seqData = await seqRes.json();
        setSequences(seqData.sequences ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------------------------------------------------------------- */
  /*  Lead search                                                      */
  /* ---------------------------------------------------------------- */

  const searchLeads = useCallback(async (query: string) => {
    if (query.length < 2) {
      setLeadSearchResults([]);
      return;
    }
    setLeadSearching(true);
    try {
      const res = await fetch(`/api/leads?search=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        const leads = Array.isArray(data) ? data : data.leads ?? data.data ?? [];
        setLeadSearchResults(
          leads.map((l: { id: string; firma: string }) => ({ id: l.id, firma: l.firma })),
        );
      }
    } catch {
      // silently ignore lead search errors
    } finally {
      setLeadSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchLeads(leadSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [leadSearchQuery, searchLeads]);

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */

  const handleComplete = async (id: string) => {
    setCompletingId(id);
    try {
      const res = await fetch('/api/follow-up', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'complete' }),
      });
      if (!res.ok) throw new Error();
      toast('Follow-Up abgeschlossen', 'success');
      // Allow checkmark animation to play before refreshing
      await new Promise((r) => setTimeout(r, 600));
      await fetchData();
    } catch {
      setError('Follow-Up konnte nicht abgeschlossen werden');
      toast('Fehler beim Abschliessen', 'error');
    } finally {
      setCompletingId(null);
    }
  };

  const handleReschedule = async (id: string) => {
    if (!rescheduleDate) return;
    try {
      const res = await fetch('/api/follow-up', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reschedule', newDueDate: rescheduleDate }),
      });
      if (!res.ok) throw new Error();
      setRescheduleId(null);
      setRescheduleDate('');
      toast('Follow-Up verschoben', 'success');
      await fetchData();
    } catch {
      setError('Follow-Up konnte nicht verschoben werden');
      toast('Fehler beim Verschieben', 'error');
    }
  };

  const handleSkip = async (id: string) => {
    try {
      const res = await fetch('/api/follow-up', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'skip' }),
      });
      if (!res.ok) throw new Error();
      toast('Follow-Up übersprungen', 'info');
      await fetchData();
    } catch {
      setError('Follow-Up konnte nicht übersprungen werden');
      toast('Fehler beim Überspringen', 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.leadId || !formData.subject || !formData.dueDate) return;
    setCreating(true);
    try {
      const res = await fetch('/api/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: formData.leadId,
          subject: formData.subject,
          type: formData.type,
          message: formData.message || null,
          priority: formData.priority,
          dueDate: formData.dueDate,
          notes: formData.notes || null,
        }),
      });
      if (!res.ok) throw new Error();
      setShowCreateModal(false);
      resetForm();
      toast('Follow-Up erstellt', 'success');
      await fetchData();
    } catch {
      setError('Follow-Up konnte nicht erstellt werden');
      toast('Fehler beim Erstellen', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleStartSequence = (seq: FollowUpSequence) => {
    const leadCount = followUps.filter((fu) => fu.status === 'pending').length || 1;
    toast(`Sequenz gestartet fuer ${leadCount} Leads`, 'success');
  };

  const resetForm = () => {
    setFormData({
      leadId: '',
      leadFirma: '',
      subject: '',
      type: 'email',
      message: '',
      priority: 3,
      dueDate: '',
      notes: '',
    });
    setLeadSearchQuery('');
    setLeadSearchResults([]);
    setShowLeadDropdown(false);
  };

  /* ---------------------------------------------------------------- */
  /*  Filter                                                           */
  /* ---------------------------------------------------------------- */

  const filtered = followUps
    .filter((fu) => {
      if (statusFilter !== 'all' && fu.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && fu.priority !== Number(priorityFilter)) return false;
      if (selectedDate && fu.dueDate.split('T')[0] !== selectedDate) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchSubject = fu.subject.toLowerCase().includes(q);
        const matchFirma = fu.lead?.firma?.toLowerCase().includes(q);
        if (!matchSubject && !matchFirma) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') return a.priority - b.priority;
      if (sortBy === 'status') {
        const order: Record<string, number> = { pending: 0, completed: 1, skipped: 2 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      }
      // Default: dueDate soonest first
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const streak = computeStreak(followUps);

  /* ---------------------------------------------------------------- */
  /*  Shared Styles                                                    */
  /* ---------------------------------------------------------------- */

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 14px',
    fontSize: '14px',
    color: 'var(--text)',
    width: '100%',
    outline: 'none',
    transition: 'border-color 150ms, box-shadow 150ms',
    fontFamily: 'inherit',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238b8fa3' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: '36px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    display: 'block',
  };

  const actionBtnStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'all 150ms',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: 'inherit',
  };

  /* ---------------------------------------------------------------- */
  /*  Skeleton Loading                                                 */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div className="skeleton" style={{ width: '200px', height: '36px' }} />
          <div className="skeleton" style={{ width: '180px', height: '42px' }} />
        </div>

        {/* Stats row skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-xl)' }} />
          ))}
        </div>

        {/* Filter bar skeleton */}
        <div className="skeleton" style={{ height: '56px', borderRadius: 'var(--radius-xl)', marginBottom: '20px' }} />

        {/* List skeleton */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '88px', borderRadius: 'var(--radius-xl)', marginBottom: '12px' }} />
        ))}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Keyframe animations */}
      <style>{`
        @keyframes fu-pulse-red {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
        @keyframes fu-check-pop {
          0% { transform: scale(1); opacity: 1; }
          40% { transform: scale(1.6); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <Breadcrumb items={[{ label: 'Follow-Up' }]} />
      {/* ============================================================ */}
      {/*  Header                                                       */}
      {/* ============================================================ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Follow-Up
        </h1>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="btn-primary"
          style={{
            backgroundColor: 'var(--amber)',
            color: '#000',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Plus size={16} />
          Neues Follow-Up
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--red)',
            fontSize: '14px',
          }}
        >
          <AlertTriangle size={16} />
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--red)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Stats Row                                                     */}
      {/* ============================================================ */}
      {stats && (
        <div
          className="stagger-children"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          {/* Heute fällig */}
          <div className="card-glass-premium" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Heute fällig
                </p>
                <p
                  style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--amber)',
                    lineHeight: 1,
                  }}
                >
                  {stats.dueToday}
                </p>
              </div>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(245,158,11,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={20} style={{ color: 'var(--amber)' }} />
              </div>
            </div>
          </div>

          {/* Überfällig */}
          <div
            className="card-glass-premium"
            style={{
              padding: '20px 24px',
              animation: stats.overdue > 0 ? 'pulse-red 2s infinite' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Überfällig
                </p>
                <p
                  style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--red)',
                    lineHeight: 1,
                  }}
                >
                  {stats.overdue}
                </p>
              </div>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239,68,68,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={20} style={{ color: 'var(--red)' }} />
              </div>
            </div>
          </div>

          {/* Diese Woche */}
          <div className="card-glass-premium" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Diese Woche
                </p>
                <p
                  style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--blue)',
                    lineHeight: 1,
                  }}
                >
                  {stats.thisWeek}
                </p>
              </div>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(96,165,250,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Calendar size={20} style={{ color: 'var(--blue)' }} />
              </div>
            </div>
          </div>

          {/* Abschlussrate */}
          <div className="card-glass-premium" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Abschlussrate
                </p>
                <p
                  style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--green)',
                    lineHeight: 1,
                  }}
                >
                  {stats.completionRate}%
                </p>
              </div>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(34,197,94,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={20} style={{ color: 'var(--green)' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Calendar Widget                                               */}
      {/* ============================================================ */}
      <MiniCalendar
        followUps={followUps}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {/* ============================================================ */}
      {/*  Sequenzen Section                                              */}
      {/* ============================================================ */}
      {sequences.length > 0 && (
        <div className="card-glass-premium" style={{ marginBottom: '20px', overflow: 'hidden' }}>
          {/* Collapsible header */}
          <button
            onClick={() => setSequencesOpen((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Zap size={18} style={{ color: 'var(--amber)' }} />
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text)',
                }}
              >
                Sequenzen
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '999px',
                  padding: '2px 8px',
                }}
              >
                {sequences.length}
              </span>
            </div>
            {sequencesOpen ? (
              <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} />
            ) : (
              <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />
            )}
          </button>

          {/* Collapsible body */}
          {sequencesOpen && (
            <div
              style={{
                padding: '0 20px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {sequences.map((seq) => {
                const steps: SequenceStep[] = Array.isArray(seq.steps) ? seq.steps : [];
                return (
                  <div
                    key={seq.id}
                    style={{
                      backgroundColor: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xl)',
                      padding: '16px 20px',
                    }}
                  >
                    {/* Sequence header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '14px',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '15px',
                            fontWeight: 600,
                            fontFamily: 'var(--font-dm-sans)',
                            color: 'var(--text)',
                          }}
                        >
                          {seq.name}
                        </span>
                        {/* Active/Inactive badge */}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '999px',
                            backgroundColor: seq.active
                              ? 'rgba(34,197,94,0.12)'
                              : 'rgba(139,143,163,0.1)',
                            color: seq.active ? 'var(--green)' : 'var(--text-muted)',
                          }}
                        >
                          {seq.active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                        {/* Usage count */}
                        <span
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {seq.usageCount}x verwendet
                        </span>
                      </div>

                      <button
                        onClick={() => handleStartSequence(seq)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          fontSize: '12px',
                          fontWeight: 600,
                          fontFamily: 'var(--font-dm-sans)',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          backgroundColor: 'var(--amber)',
                          color: '#000',
                          cursor: 'pointer',
                          transition: 'opacity 150ms',
                          opacity: seq.active ? 1 : 0.5,
                        }}
                        disabled={!seq.active}
                      >
                        <Play size={12} />
                        Sequenz starten
                      </button>
                    </div>

                    {/* Description */}
                    {seq.description && (
                      <p
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-dm-sans)',
                          margin: '0 0 14px 0',
                          lineHeight: 1.5,
                        }}
                      >
                        {seq.description}
                      </p>
                    )}

                    {/* Step chain visualization */}
                    {steps.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0',
                          overflowX: 'auto',
                          paddingBottom: '4px',
                        }}
                      >
                        {steps.map((step, idx) => {
                          const StepIcon = STEP_ICON_MAP[step.type] || Mail;
                          const typeConf = TYPE_CONFIG[step.type] || TYPE_CONFIG.email;
                          const isFilled = idx === 0; // First step is "active"

                          return (
                            <div
                              key={idx}
                              style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
                            >
                              {/* Dashed connector line (not before first step) */}
                              {idx > 0 && (
                                <div
                                  style={{
                                    width: '32px',
                                    height: '0',
                                    borderTop: '2px dashed var(--border)',
                                    flexShrink: 0,
                                  }}
                                />
                              )}

                              {/* Step circle + label */}
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '6px',
                                  flexShrink: 0,
                                }}
                              >
                                <div
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: isFilled
                                      ? 'none'
                                      : `2px solid ${typeConf.color}`,
                                    backgroundColor: isFilled
                                      ? typeConf.color
                                      : typeConf.bg,
                                    transition: 'all 150ms',
                                  }}
                                >
                                  <StepIcon
                                    size={16}
                                    style={{
                                      color: isFilled ? '#000' : typeConf.color,
                                    }}
                                  />
                                </div>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    fontFamily: 'var(--font-mono)',
                                    color: isFilled ? typeConf.color : 'var(--text-muted)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Tag {step.delay}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*  Streak + Sort Controls                                        */}
      {/* ============================================================ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        {/* Completion Streak */}
        <div
          className="card-glass-premium"
          style={{
            padding: '10px 18px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Flame size={16} style={{ color: streak > 0 ? 'var(--amber)' : 'var(--text-muted)' }} />
          <span
            style={{
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: streak > 0 ? 'var(--amber)' : 'var(--text-muted)',
            }}
          >
            Streak: {streak} Tage
          </span>
        </div>

        {/* Sort Controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowUpDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '4px' }}>Sortieren:</span>
          {([
            { key: 'dueDate' as SortOption, label: 'Fälligk.' },
            { key: 'priority' as SortOption, label: 'Priorität' },
            { key: 'status' as SortOption, label: 'Status' },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'var(--font-dm-sans)',
                borderRadius: 'var(--radius-sm)',
                border: sortBy === opt.key ? '1px solid var(--amber)' : '1px solid var(--border)',
                backgroundColor: sortBy === opt.key ? 'var(--amber-glow)' : 'transparent',
                color: sortBy === opt.key ? 'var(--amber)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Filter Bar                                                    */}
      {/* ============================================================ */}
      <div
        className="card-glass-premium"
        style={{
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Filter size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            ...selectStyle,
            width: 'auto',
            minWidth: '150px',
            padding: '8px 36px 8px 12px',
            fontSize: '13px',
          }}
        >
          <option value="all">Alle Status</option>
          <option value="pending">Ausstehend</option>
          <option value="completed">Erledigt</option>
          <option value="skipped">Übersprungen</option>
        </select>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{
            ...selectStyle,
            width: 'auto',
            minWidth: '160px',
            padding: '8px 36px 8px 12px',
            fontSize: '13px',
          }}
        >
          <option value="all">Alle Prioritäten</option>
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>
              P{p} – {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Suche nach Betreff oder Firma..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              ...inputStyle,
              paddingLeft: '36px',
              padding: '8px 38px 8px 36px',
              fontSize: '13px',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Follow-Up List                                                */}
      {/* ============================================================ */}
      {filtered.length === 0 ? (
        /* Empty State */
        <div
          className="card-glass-premium"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: 'rgba(139,143,163,0.06)',
              border: '1px dashed var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              animation: 'float 4s ease-in-out infinite',
            }}
          >
            <RotateCcw size={28} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
            Keine Follow-Ups gefunden
          </h3>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              maxWidth: '360px',
              lineHeight: 1.6,
              marginBottom: '24px',
            }}
          >
            {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Versuche andere Filtereinstellungen oder passe deine Suche an.'
              : 'Erstelle dein erstes Follow-Up, um den Überblick über deine Kontakte zu behalten.'}
          </p>
          {!searchQuery && statusFilter === 'all' && priorityFilter === 'all' && (
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="btn-primary"
              style={{
                backgroundColor: 'var(--amber)',
                color: '#000',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Plus size={16} />
              Neues Follow-Up erstellen
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((fu) => {
            const typeConf = TYPE_CONFIG[fu.type] || TYPE_CONFIG.email;
            const TypeIcon = typeConf.icon;
            const statusConf = STATUS_CONFIG[fu.status] || STATUS_CONFIG.pending;
            const isCompleted = fu.status === 'completed';
            const isSkipped = fu.status === 'skipped';
            const isDone = isCompleted || isSkipped;
            const dueDateStatus = getDueDateStatus(fu.dueDate);

            return (
              <div
                key={fu.id}
                className="card-glass-premium"
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  opacity: isDone ? 0.6 : 1,
                  transition: 'all 250ms',
                  backgroundColor: getRowHighlight(fu),
                }}
              >
                {/* Priority indicator — colored left border */}
                <div
                  style={{
                    width: '4px',
                    flexShrink: 0,
                    borderRadius: '20px 0 0 20px',
                    backgroundColor: PRIORITY_COLORS[fu.priority] || 'var(--text-muted)',
                  }}
                />

                {/* Content */}
                <div
                  style={{
                    flex: 1,
                    padding: '16px 20px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Subject */}
                      <span
                        style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: 'var(--text)',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                        }}
                      >
                        {fu.subject}
                      </span>

                      {/* Type badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '999px',
                          backgroundColor: typeConf.bg,
                          color: typeConf.color,
                        }}
                      >
                        <TypeIcon size={11} />
                        {typeConf.label}
                      </span>

                      {/* Status badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '999px',
                          backgroundColor: statusConf.bg,
                          color: statusConf.color,
                        }}
                      >
                        {statusConf.label}
                      </span>
                    </div>

                    {/* Metadata row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      {/* Lead firma */}
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {fu.lead?.firma || '–'}
                      </span>

                      {/* Due date */}
                      <span
                        style={{
                          fontSize: '13px',
                          fontFamily: 'var(--font-mono)',
                          color: isDone ? 'var(--text-muted)' : getDueDateColor(fu.dueDate),
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Clock size={12} />
                        {formatDate(fu.dueDate)}
                        {!isDone && dueDateStatus === 'overdue' && (
                          <>
                            <span
                              style={{
                                display: 'inline-block',
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--red)',
                                animation: 'fu-pulse-red 1.5s ease-in-out infinite',
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontSize: '11px', marginLeft: '2px' }}>(überfällig)</span>
                          </>
                        )}
                        {!isDone && dueDateStatus === 'today' && (
                          <span style={{ fontSize: '11px', marginLeft: '2px' }}>(heute)</span>
                        )}
                      </span>

                      {/* Priority label */}
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: PRIORITY_COLORS[fu.priority],
                        }}
                      >
                        P{fu.priority}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {!isDone && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexShrink: 0,
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Complete */}
                      <button
                        onClick={() => handleComplete(fu.id)}
                        disabled={completingId === fu.id}
                        style={{
                          ...actionBtnStyle,
                          borderColor: completingId === fu.id ? 'var(--green)' : 'rgba(34,197,94,0.3)',
                          color: 'var(--green)',
                          backgroundColor: completingId === fu.id ? 'rgba(34,197,94,0.15)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (completingId !== fu.id) {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                              'rgba(34,197,94,0.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (completingId !== fu.id) {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                              'transparent';
                          }
                        }}
                      >
                        <Check
                          size={13}
                          style={
                            completingId === fu.id
                              ? { animation: 'fu-check-pop 0.5s ease-out' }
                              : undefined
                          }
                        />
                        {completingId === fu.id ? 'Erledigt!' : 'Erledigt'}
                      </button>

                      {/* Reschedule */}
                      {rescheduleId === fu.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="date"
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            style={{
                              ...inputStyle,
                              width: 'auto',
                              padding: '6px 10px',
                              fontSize: '12px',
                            }}
                          />
                          <button
                            onClick={() => handleReschedule(fu.id)}
                            disabled={!rescheduleDate}
                            style={{
                              ...actionBtnStyle,
                              borderColor: 'rgba(96,165,250,0.3)',
                              color: 'var(--blue)',
                              opacity: rescheduleDate ? 1 : 0.5,
                            }}
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => {
                              setRescheduleId(null);
                              setRescheduleDate('');
                            }}
                            style={{
                              ...actionBtnStyle,
                              borderColor: 'var(--border)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRescheduleId(fu.id)}
                          style={{
                            ...actionBtnStyle,
                            borderColor: 'rgba(96,165,250,0.3)',
                            color: 'var(--blue)',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                              'rgba(96,165,250,0.1)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                              'transparent';
                          }}
                        >
                          <Calendar size={13} />
                          Verschieben
                        </button>
                      )}

                      {/* Skip */}
                      <button
                        onClick={() => handleSkip(fu.id)}
                        style={actionBtnStyle}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                            'var(--surface-hover)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                            'transparent';
                        }}
                      >
                        <RotateCcw size={13} />
                        Überspringen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/*  Follow-Up Aktivitaet Heatmap                                   */}
      {/* ============================================================ */}
      <FollowUpHeatmap followUps={followUps} />

      {/* ============================================================ */}
      {/*  Create Follow-Up Modal                                        */}
      {/* ============================================================ */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '24px',
            animation: 'backdrop-enter 0.2s ease-out',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '85vh',
              overflowY: 'auto',
              animation: 'modal-enter 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '24px 28px 0',
              }}
            >
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                Neues Follow-Up
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'color 150ms',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreate} style={{ padding: '24px 28px 28px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Lead search/select */}
                <div style={{ position: 'relative' }}>
                  <label style={labelStyle}>Lead / Firma *</label>
                  {formData.leadId ? (
                    <div
                      style={{
                        ...inputStyle,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'default',
                      }}
                    >
                      <span style={{ color: 'var(--text)' }}>{formData.leadFirma}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, leadId: '', leadFirma: '' }));
                          setLeadSearchQuery('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ position: 'relative' }}>
                        <Search
                          size={14}
                          style={{
                            position: 'absolute',
                            left: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)',
                            pointerEvents: 'none',
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Firma suchen..."
                          value={leadSearchQuery}
                          onChange={(e) => {
                            setLeadSearchQuery(e.target.value);
                            setShowLeadDropdown(true);
                          }}
                          onFocus={() => setShowLeadDropdown(true)}
                          style={{ ...inputStyle, paddingLeft: '36px' }}
                        />
                      </div>
                      {showLeadDropdown && leadSearchQuery.length >= 2 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 10,
                            backgroundColor: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            marginTop: '4px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                          }}
                        >
                          {leadSearching ? (
                            <div
                              style={{
                                padding: '12px 16px',
                                color: 'var(--text-muted)',
                                fontSize: '13px',
                              }}
                            >
                              Suche...
                            </div>
                          ) : leadSearchResults.length === 0 ? (
                            <div
                              style={{
                                padding: '12px 16px',
                                color: 'var(--text-muted)',
                                fontSize: '13px',
                              }}
                            >
                              Keine Ergebnisse
                            </div>
                          ) : (
                            leadSearchResults.map((lead) => (
                              <button
                                key={lead.id}
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    leadId: lead.id,
                                    leadFirma: lead.firma,
                                  }));
                                  setLeadSearchQuery('');
                                  setShowLeadDropdown(false);
                                }}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '10px 16px',
                                  background: 'none',
                                  border: 'none',
                                  borderBottom: '1px solid var(--border)',
                                  color: 'var(--text)',
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                  transition: 'background-color 150ms',
                                }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                    'var(--surface-hover)';
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                    'transparent';
                                }}
                              >
                                {lead.firma}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label style={labelStyle}>Betreff *</label>
                  <input
                    type="text"
                    placeholder="z.B. Offerte nachfassen"
                    value={formData.subject}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                    required
                    style={inputStyle}
                  />
                </div>

                {/* Type + Priority row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>Typ</label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          type: e.target.value as 'email' | 'call' | 'meeting' | 'linkedin',
                        }))
                      }
                      style={selectStyle}
                    >
                      <option value="email">E-Mail</option>
                      <option value="call">Anruf</option>
                      <option value="meeting">Meeting</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Priorität</label>
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, priority: Number(e.target.value) }))
                      }
                      style={selectStyle}
                    >
                      {[1, 2, 3, 4, 5].map((p) => (
                        <option key={p} value={p}>
                          P{p} – {PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Email Template Quick-Select */}
                <div>
                  <label style={labelStyle}>
                    <FileText size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    E-Mail Vorlage waehlen
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                      gap: '8px',
                      marginBottom: '14px',
                    }}
                  >
                    {EMAIL_TEMPLATES.map((tpl) => {
                      const isActive =
                        formData.subject === tpl.subject && formData.message === tpl.body;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => {
                            if (isActive) {
                              setFormData((prev) => ({
                                ...prev,
                                subject: '',
                                message: '',
                              }));
                            } else {
                              setFormData((prev) => ({
                                ...prev,
                                subject: tpl.subject,
                                message: tpl.body,
                                type: 'email',
                              }));
                              toast(`Vorlage "${tpl.label}" geladen`, 'info');
                            }
                          }}
                          style={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '4px',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: isActive
                              ? `1.5px solid ${tpl.color}`
                              : '1px solid var(--border)',
                            backgroundColor: isActive ? tpl.bg : 'rgba(255,255,255,0.02)',
                            cursor: 'pointer',
                            transition: 'all 200ms ease',
                            textAlign: 'left',
                            overflow: 'hidden',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = tpl.bg;
                              (e.currentTarget as HTMLButtonElement).style.borderColor = tpl.color;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                'rgba(255,255,255,0.02)';
                              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                            }
                          }}
                        >
                          {isActive && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: tpl.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Check size={10} style={{ color: '#000' }} />
                            </div>
                          )}
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: isActive ? tpl.color : 'var(--text)',
                              lineHeight: 1.2,
                            }}
                          >
                            {tpl.label}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontFamily: 'var(--font-dm-sans)',
                              color: 'var(--text-muted)',
                              lineHeight: 1.3,
                            }}
                          >
                            {tpl.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <label style={labelStyle}>Nachricht</label>
                  <textarea
                    placeholder="Optionale Nachricht..."
                    value={formData.message}
                    onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                    rows={4}
                    style={{
                      ...inputStyle,
                      resize: 'vertical' as const,
                      minHeight: '100px',
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                  />
                </div>

                {/* Due date */}
                <div>
                  <label style={labelStyle}>Fällig am *</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dueDate: e.target.value }))}
                    required
                    style={inputStyle}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label style={labelStyle}>Notizen</label>
                  <textarea
                    placeholder="Interne Notizen..."
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    style={{
                      ...inputStyle,
                      resize: 'vertical' as const,
                      minHeight: '60px',
                    }}
                  />
                </div>

                {/* Submit row */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary"
                    style={{
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !formData.leadId || !formData.subject || !formData.dueDate}
                    style={{
                      backgroundColor: 'var(--amber)',
                      color: '#000',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 24px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: creating ? 'wait' : 'pointer',
                      opacity:
                        creating || !formData.leadId || !formData.subject || !formData.dueDate
                          ? 0.5
                          : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 150ms',
                    }}
                  >
                    {creating ? (
                      <span className="loading-spinner sm" />
                    ) : (
                      <Plus size={16} />
                    )}
                    {creating ? 'Erstelle...' : 'Follow-Up erstellen'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
