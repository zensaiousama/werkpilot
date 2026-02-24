'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Activity,
  Phone,
  Mail,
  Calendar,
  FileText,
  ArrowRightLeft,
  MousePointer,
  MailOpen,
  MailX,
  Send,
  CircleCheck,
  Clock,
  CheckCheck,
  AlertTriangle,
  UserPlus,
  Settings,
  Sparkles,
  Info,
  XCircle,
  Bell,
  Filter,
  Search,
  X,
  ChevronDown,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type EventType = 'lead_activity' | 'email' | 'invoice' | 'follow_up' | 'notification';

interface ActivityEvent {
  id: string;
  type: EventType;
  action: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

type ModuleFilter = 'all' | 'crm' | 'mailing' | 'finanzen' | 'follow-up' | 'agents';
type ActionFilter = 'all' | 'create' | 'update' | 'delete';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MODULE_FILTERS: { key: ModuleFilter; label: string; color: string }[] = [
  { key: 'all', label: 'Alle', color: 'var(--amber)' },
  { key: 'crm', label: 'CRM', color: 'var(--blue)' },
  { key: 'mailing', label: 'Mailing', color: 'var(--purple)' },
  { key: 'finanzen', label: 'Finanzen', color: 'var(--green)' },
  { key: 'follow-up', label: 'Follow-Up', color: 'var(--orange)' },
  { key: 'agents', label: 'Agents', color: 'var(--red)' },
];

const ACTION_FILTERS: { key: ActionFilter; label: string }[] = [
  { key: 'all', label: 'Alle Aktionen' },
  { key: 'create', label: 'Erstellt' },
  { key: 'update', label: 'Aktualisiert' },
  { key: 'delete', label: 'Geloescht' },
];

const MODULE_MAP: Record<EventType, ModuleFilter> = {
  lead_activity: 'crm',
  email: 'mailing',
  invoice: 'finanzen',
  follow_up: 'follow-up',
  notification: 'agents',
};

const MODULE_BADGE_CONFIG: Record<ModuleFilter, { label: string; color: string; bg: string }> = {
  all: { label: 'System', color: 'var(--text-secondary)', bg: 'rgba(139, 143, 163, 0.12)' },
  crm: { label: 'CRM', color: 'var(--blue)', bg: 'rgba(96, 165, 250, 0.12)' },
  mailing: { label: 'Mailing', color: 'var(--purple)', bg: 'rgba(139, 92, 246, 0.12)' },
  finanzen: { label: 'Finanzen', color: 'var(--green)', bg: 'rgba(34, 197, 94, 0.12)' },
  'follow-up': { label: 'Follow-Up', color: 'var(--orange)', bg: 'rgba(249, 115, 22, 0.12)' },
  agents: { label: 'Agents', color: 'var(--red)', bg: 'rgba(239, 68, 68, 0.12)' },
};

const ICON_MAP: Record<string, React.ElementType> = {
  phone: Phone,
  mail: Mail,
  calendar: Calendar,
  'file-text': FileText,
  'arrow-right-left': ArrowRightLeft,
  activity: Activity,
  'mouse-pointer-click': MousePointer,
  'mail-open': MailOpen,
  'mail-x': MailX,
  send: Send,
  'circle-check': CircleCheck,
  clock: Clock,
  'check-circle': CheckCheck,
  'alert-triangle': AlertTriangle,
  user: UserPlus,
  settings: Settings,
  sparkles: Sparkles,
  info: Info,
  'x-circle': XCircle,
  bell: Bell,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function classifyAction(action: string): ActionFilter {
  const createPatterns = ['created', 'sent', 'scheduled', 'added', 'note_added'];
  const updatePatterns = ['updated', 'changed', 'opened', 'clicked', 'paid', 'completed', 'called', 'emailed', 'meeting', 'status_changed'];
  const deletePatterns = ['deleted', 'removed', 'bounced', 'cancelled'];

  const lower = action.toLowerCase();
  if (deletePatterns.some((p) => lower.includes(p))) return 'delete';
  if (createPatterns.some((p) => lower.includes(p))) return 'create';
  if (updatePatterns.some((p) => lower.includes(p))) return 'update';
  return 'update';
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `Vor ${diffMins} Min.`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Vor ${diffHours} Std.`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Vor ${diffDays} ${diffDays === 1 ? 'Tag' : 'Tagen'}`;

  return date.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFullTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('de-CH', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDateGroupKey(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  if (date >= todayStart) return 'heute';
  if (date >= yesterdayStart) return 'gestern';
  return date.toLocaleDateString('de-CH', { day: '2-digit', month: 'long', year: 'numeric' });
}

function getDateGroupLabel(key: string): string {
  if (key === 'heute') return 'Heute';
  if (key === 'gestern') return 'Gestern';
  return key;
}

/* ------------------------------------------------------------------ */
/*  Skeleton Component                                                 */
/* ------------------------------------------------------------------ */

function ActivitySkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="card-glass-premium"
          style={{
            padding: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          {/* Icon skeleton */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.04)',
              flexShrink: 0,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Title skeleton */}
            <div
              style={{
                width: `${60 + (i % 3) * 15}%`,
                height: 14,
                borderRadius: 6,
                background: 'rgba(255, 255, 255, 0.06)',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`,
              }}
            />
            {/* Description skeleton */}
            <div
              style={{
                width: `${80 + (i % 2) * 10}%`,
                height: 10,
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.03)',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.1 + 0.05}s`,
              }}
            />
            {/* Meta skeleton */}
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <div
                style={{
                  width: 60,
                  height: 20,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.04)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 0.1 + 0.1}s`,
                }}
              />
              <div
                style={{
                  width: 80,
                  height: 10,
                  borderRadius: 4,
                  background: 'rgba(255, 255, 255, 0.03)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 0.1 + 0.15}s`,
                  alignSelf: 'center',
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity Card Component                                            */
/* ------------------------------------------------------------------ */

function ActivityCard({ event }: { event: ActivityEvent }) {
  const [hovered, setHovered] = useState(false);
  const module = MODULE_MAP[event.type] || 'all';
  const badge = MODULE_BADGE_CONFIG[module];
  const IconComponent = ICON_MAP[event.icon] || Activity;

  return (
    <div
      className="card-glass-premium"
      style={{
        padding: 20,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        cursor: 'default',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
        borderColor: hovered ? 'rgba(245, 158, 11, 0.15)' : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Timeline dot + icon */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: `color-mix(in srgb, ${event.color} 12%, transparent)`,
          color: event.color,
          border: `1px solid color-mix(in srgb, ${event.color} 20%, transparent)`,
        }}
      >
        <IconComponent size={20} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title */}
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text)',
            margin: 0,
            lineHeight: 1.4,
            fontFamily: 'var(--font-dm-sans)',
          }}
        >
          {event.title}
        </p>

        {/* Description */}
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            margin: '4px 0 0',
            lineHeight: 1.5,
            fontFamily: 'var(--font-dm-sans)',
          }}
        >
          {event.description}
        </p>

        {/* Meta row: module badge + timestamp */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 10,
            flexWrap: 'wrap',
          }}
        >
          {/* Module badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.02em',
              color: badge.color,
              backgroundColor: badge.bg,
              border: `1px solid color-mix(in srgb, ${badge.color} 15%, transparent)`,
            }}
          >
            {badge.label}
          </span>

          {/* Timestamp */}
          <span
            title={formatFullTimestamp(event.timestamp)}
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {formatTimestamp(event.timestamp)}
          </span>

          {/* Action type tag */}
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              opacity: 0.7,
            }}
          >
            {event.action.replace(/_/g, ' ')}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch activities
  const fetchActivities = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/activity?limit=100');
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = events;

    // Module filter
    if (moduleFilter !== 'all') {
      result = result.filter((e) => MODULE_MAP[e.type] === moduleFilter);
    }

    // Action filter
    if (actionFilter !== 'all') {
      result = result.filter((e) => classifyAction(e.action) === actionFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q)
      );
    }

    // Date range
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((e) => new Date(e.timestamp) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((e) => new Date(e.timestamp) <= to);
    }

    return result;
  }, [events, moduleFilter, actionFilter, searchQuery, dateFrom, dateTo]);

  // Group by date
  const groupedEvents = useMemo(() => {
    const groups: { key: string; label: string; events: ActivityEvent[] }[] = [];
    const map = new Map<string, ActivityEvent[]>();
    const order: string[] = [];

    for (const event of filteredEvents) {
      const key = getDateGroupKey(event.timestamp);
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(event);
    }

    for (const key of order) {
      const items = map.get(key);
      if (items && items.length > 0) {
        groups.push({ key, label: getDateGroupLabel(key), events: items });
      }
    }

    return groups;
  }, [filteredEvents]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (moduleFilter !== 'all') count++;
    if (actionFilter !== 'all') count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [moduleFilter, actionFilter, dateFrom, dateTo, searchQuery]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setModuleFilter('all');
    setActionFilter('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(0.6);
          cursor: pointer;
        }
      `}} />

      <div style={{ padding: '0 0 40px' }}>
        <Breadcrumb items={[{ label: 'Aktivitaet' }]} />

        {/* ============================================ */}
        {/* Page Header                                   */}
        {/* ============================================ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 28,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '-0.02em',
              }}
            >
              Aktivitaetsprotokoll
            </h1>
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                margin: '6px 0 0',
                fontFamily: 'var(--font-dm-sans)',
              }}
            >
              Chronologische Uebersicht aller Systemaktivitaeten
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Event count */}
            <span
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border)',
              }}
            >
              {filteredEvents.length} {filteredEvents.length === 1 ? 'Ereignis' : 'Ereignisse'}
            </span>

            {/* Refresh button */}
            <button
              onClick={() => fetchActivities(true)}
              disabled={refreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!refreshing) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(245, 158, 11, 0.08)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245, 158, 11, 0.2)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--amber)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              }}
              title="Aktualisieren"
            >
              <RefreshCw
                size={16}
                style={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
            </button>
          </div>
        </div>

        {/* ============================================ */}
        {/* Module Filter Tabs                            */}
        {/* ============================================ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 16,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            paddingBottom: 2,
          }}
        >
          {MODULE_FILTERS.map((mod) => {
            const isActive = moduleFilter === mod.key;
            const count = mod.key === 'all'
              ? events.length
              : events.filter((e) => MODULE_MAP[e.type] === mod.key).length;

            return (
              <button
                key={mod.key}
                onClick={() => setModuleFilter(mod.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.02em',
                  color: isActive ? mod.color : 'var(--text-muted)',
                  backgroundColor: isActive
                    ? `color-mix(in srgb, ${mod.color} 10%, transparent)`
                    : 'transparent',
                  border: isActive
                    ? `1px solid color-mix(in srgb, ${mod.color} 20%, transparent)`
                    : '1px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                  }
                }}
              >
                {mod.label}
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    opacity: isActive ? 0.8 : 0.5,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ============================================ */}
        {/* Search + Filters Bar                          */}
        {/* ============================================ */}
        <div
          className="card-glass-premium"
          style={{
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {/* Search input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flex: 1,
                minWidth: 200,
                padding: '8px 14px',
                borderRadius: 10,
                backgroundColor: 'rgba(10, 13, 20, 0.5)',
                border: '1px solid var(--border)',
              }}
            >
              <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Aktivitaeten durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontFamily: 'var(--font-dm-sans)',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2,
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: showFilters ? 'var(--amber)' : 'var(--text-secondary)',
                backgroundColor: showFilters
                  ? 'rgba(245, 158, 11, 0.08)'
                  : 'rgba(10, 13, 20, 0.5)',
                border: showFilters
                  ? '1px solid rgba(245, 158, 11, 0.2)'
                  : '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Filter size={14} />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: 'var(--amber)',
                    color: '#000',
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                size={12}
                style={{
                  transform: showFilters ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              />
            </button>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '8px 12px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--red)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                }}
              >
                <X size={12} />
                Zuruecksetzen
              </button>
            )}
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid var(--border)',
              }}
            >
              {/* Action type filter */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}
                >
                  Aktionstyp
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ACTION_FILTERS.map((af) => {
                    const isActive = actionFilter === af.key;
                    return (
                      <button
                        key={af.key}
                        onClick={() => setActionFilter(af.key)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? 'var(--amber)' : 'var(--text-muted)',
                          backgroundColor: isActive
                            ? 'rgba(245, 158, 11, 0.1)'
                            : 'rgba(10, 13, 20, 0.5)',
                          border: isActive
                            ? '1px solid rgba(245, 158, 11, 0.2)'
                            : '1px solid var(--border)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {af.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date from */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}
                >
                  Von
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text)',
                    backgroundColor: 'rgba(10, 13, 20, 0.5)',
                    border: '1px solid var(--border)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Date to */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}
                >
                  Bis
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text)',
                    backgroundColor: 'rgba(10, 13, 20, 0.5)',
                    border: '1px solid var(--border)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* Activity Timeline                             */}
        {/* ============================================ */}
        {loading ? (
          <ActivitySkeleton />
        ) : filteredEvents.length === 0 ? (
          /* Empty state */
          <div
            className="card-glass-premium"
            style={{
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <Inbox size={28} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            </div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                margin: '0 0 8px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Keine Aktivitaeten gefunden
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                margin: 0,
                fontFamily: 'var(--font-dm-sans)',
              }}
            >
              {activeFilterCount > 0
                ? 'Versuche die Filter anzupassen oder zurueckzusetzen.'
                : 'Es wurden noch keine Aktivitaeten aufgezeichnet.'}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                style={{
                  marginTop: 20,
                  padding: '10px 20px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: 'var(--amber)',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(245, 158, 11, 0.14)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(245, 158, 11, 0.08)';
                }}
              >
                Filter zuruecksetzen
              </button>
            )}
          </div>
        ) : (
          /* Grouped timeline */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {groupedEvents.map((group) => (
              <div key={group.key}>
                {/* Date group header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      height: 1,
                      flex: 1,
                      background: 'linear-gradient(90deg, var(--border), transparent)',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      flexShrink: 0,
                      padding: '4px 14px',
                      borderRadius: 8,
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {group.label}
                    <span style={{ marginLeft: 8, opacity: 0.5 }}>{group.events.length}</span>
                  </span>
                  <div
                    style={{
                      height: 1,
                      flex: 1,
                      background: 'linear-gradient(90deg, transparent, var(--border))',
                    }}
                  />
                </div>

                {/* Timeline with left border */}
                <div
                  style={{
                    position: 'relative',
                    paddingLeft: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {/* Vertical timeline line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 8,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: 'linear-gradient(180deg, var(--border), rgba(30, 34, 51, 0.3), transparent)',
                      borderRadius: 1,
                    }}
                  />

                  {group.events.map((event, idx) => (
                    <div key={event.id} style={{ position: 'relative' }}>
                      {/* Timeline dot */}
                      <div
                        style={{
                          position: 'absolute',
                          left: -20,
                          top: 22,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: event.color,
                          border: '2px solid var(--bg)',
                          boxShadow: `0 0 6px color-mix(in srgb, ${event.color} 40%, transparent)`,
                          zIndex: 1,
                        }}
                      />
                      <ActivityCard event={event} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
