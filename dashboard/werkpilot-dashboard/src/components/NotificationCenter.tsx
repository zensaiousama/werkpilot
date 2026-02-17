'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellRing,
  X,
  CheckCheck,
  Bot,
  Users,
  AlertTriangle,
  Settings,
  Zap,
  Volume2,
  VolumeX,
  Filter,
  ChevronDown,
  Loader2,
  Sparkles,
  CheckCircle2,
  BellOff,
} from 'lucide-react';
import {
  useNotifications,
  type NotificationType,
  type Notification,
} from '@/hooks/useNotifications';

// ---------------------------------------------------------------------------
// Type config: icon, color, glow, label per notification type
// ---------------------------------------------------------------------------

const typeConfig: Record<
  NotificationType,
  { icon: typeof Bot; color: string; glow: string; label: string }
> = {
  agent_alert: {
    icon: AlertTriangle,
    color: 'var(--amber)',
    glow: 'var(--amber-glow)',
    label: 'Agent Alert',
  },
  task_complete: {
    icon: CheckCircle2,
    color: 'var(--green)',
    glow: 'rgba(34,197,94,0.12)',
    label: 'Task Complete',
  },
  lead_update: {
    icon: Users,
    color: 'var(--blue)',
    glow: 'rgba(96,165,250,0.12)',
    label: 'Lead Update',
  },
  system: {
    icon: Settings,
    color: 'var(--text-muted)',
    glow: 'rgba(74,78,99,0.12)',
    label: 'System',
  },
  ai_insight: {
    icon: Sparkles,
    color: 'var(--purple)',
    glow: 'rgba(139,92,246,0.12)',
    label: 'AI Insight',
  },
};

const allTypes: NotificationType[] = [
  'agent_alert',
  'task_complete',
  'lead_update',
  'system',
  'ai_insight',
];

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 0) return 'Gerade eben';
  if (diffSec < 60) return 'Gerade eben';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `vor ${diffD} Tag${diffD > 1 ? 'en' : ''}`;
  const diffW = Math.floor(diffD / 7);
  return `vor ${diffW} Woche${diffW > 1 ? 'n' : ''}`;
}

// ---------------------------------------------------------------------------
// Inline animation keyframes
// ---------------------------------------------------------------------------

const notifAnimStyles = `
  @keyframes notif-fade-in-down {
    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes notif-slide-in {
    from { opacity: 0; transform: translateX(12px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes notif-badge-bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }
  @keyframes notif-dot-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [, setTick] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    notifications,
    unreadCount,
    loading,
    filters,
    setFilters,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    soundEnabled,
    setSoundEnabled,
    hasMore,
    loadMore,
  } = useNotifications();

  // Tick for relative time updates
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setFilterOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setFilterOpen(false);
      }
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Handle notification click -> navigate if link present
  const handleNotificationClick = useCallback(
    (notif: Notification) => {
      markAsRead(notif.id);
      if (notif.link) {
        setOpen(false);
        router.push(notif.link);
      }
    },
    [markAsRead, router]
  );

  // Filter toggle
  const handleFilterType = useCallback(
    (type: NotificationType | null) => {
      setFilters({ ...filters, type });
      setFilterOpen(false);
    },
    [filters, setFilters]
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: notifAnimStyles }} />

      <div className="relative">
        {/* ---------------------------------------------------------------- */}
        {/* Bell Button                                                      */}
        {/* ---------------------------------------------------------------- */}
        <button
          ref={buttonRef}
          onClick={() => setOpen((prev) => !prev)}
          className="relative p-2.5 rounded-xl transition-all duration-200"
          style={{
            backgroundColor: open ? 'var(--surface-hover)' : 'transparent',
            color: open ? 'var(--amber)' : 'var(--text-secondary)',
            border: '1px solid transparent',
          }}
          onMouseEnter={(e) => {
            if (!open) {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'var(--text)';
            }
          }}
          onMouseLeave={(e) => {
            if (!open) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
          aria-label={`Benachrichtigungen${unreadCount > 0 ? ` (${unreadCount} ungelesen)` : ''}`}
          aria-expanded={open}
        >
          {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}

          {/* Unread badge */}
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full font-bold"
              style={{
                width: unreadCount > 9 ? 22 : 18,
                height: 18,
                fontSize: '10px',
                backgroundColor: 'var(--red)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                boxShadow: '0 0 8px rgba(239,68,68,0.5)',
                animation: 'notif-badge-bounce 2s ease-in-out infinite',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* ---------------------------------------------------------------- */}
        {/* Dropdown Panel                                                    */}
        {/* ---------------------------------------------------------------- */}
        {open && (
          <div
            ref={dropdownRef}
            className="absolute top-full right-0 mt-2 border rounded-2xl overflow-hidden"
            style={{
              width: 420,
              maxHeight: 540,
              background: 'rgba(12,15,23,0.82)',
              backdropFilter: 'blur(24px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
              borderColor: 'rgba(255,255,255,0.08)',
              boxShadow:
                '0 25px 50px -12px rgba(0,0,0,0.6), 0 0 1px 0 rgba(255,255,255,0.05) inset',
              zIndex: 60,
              animation: 'notif-fade-in-down 200ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* ----- Header ----- */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2">
                <Zap size={14} style={{ color: 'var(--amber)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  Benachrichtigungen
                </h3>
                {unreadCount > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: 'var(--amber-glow)',
                      color: 'var(--amber)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* Sound toggle */}
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  aria-label={soundEnabled ? 'Ton deaktivieren' : 'Ton aktivieren'}
                  title={soundEnabled ? 'Ton deaktivieren' : 'Ton aktivieren'}
                >
                  {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>

                {/* Filter */}
                <div className="relative">
                  <button
                    onClick={() => setFilterOpen(!filterOpen)}
                    className="p-1.5 rounded-lg transition-colors flex items-center gap-0.5"
                    style={{
                      color: filters.type ? 'var(--amber)' : 'var(--text-muted)',
                    }}
                    onMouseEnter={(e) => {
                      if (!filters.type) e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!filters.type) e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                    aria-label="Filter"
                  >
                    <Filter size={14} />
                    <ChevronDown
                      size={10}
                      style={{
                        transition: 'transform 150ms',
                        transform: filterOpen ? 'rotate(180deg)' : 'none',
                      }}
                    />
                  </button>

                  {/* Filter dropdown */}
                  {filterOpen && (
                    <div
                      className="absolute right-0 top-full mt-1 border rounded-xl overflow-hidden py-1"
                      style={{
                        width: 180,
                        background: 'rgba(16,19,28,0.95)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        borderColor: 'rgba(255,255,255,0.08)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        zIndex: 70,
                        animation: 'notif-fade-in-down 150ms ease-out',
                      }}
                    >
                      <button
                        onClick={() => handleFilterType(null)}
                        className="w-full text-left px-3 py-2 text-xs transition-colors"
                        style={{
                          color: !filters.type ? 'var(--amber)' : 'var(--text-secondary)',
                          backgroundColor: !filters.type ? 'rgba(245,158,11,0.06)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = !filters.type
                            ? 'rgba(245,158,11,0.06)'
                            : 'transparent';
                        }}
                      >
                        Alle anzeigen
                      </button>
                      {allTypes.map((t) => {
                        const cfg = typeConfig[t];
                        const Icon = cfg.icon;
                        const active = filters.type === t;
                        return (
                          <button
                            key={t}
                            onClick={() => handleFilterType(t)}
                            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors"
                            style={{
                              color: active ? cfg.color : 'var(--text-secondary)',
                              backgroundColor: active ? cfg.glow : 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = active ? cfg.glow : 'transparent';
                            }}
                          >
                            <Icon size={12} style={{ color: cfg.color }} />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Mark all read */}
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--amber)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    title="Alle als gelesen markieren"
                  >
                    <CheckCheck size={13} />
                  </button>
                )}

                {/* Close */}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  aria-label="Schliessen"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Active filter badge */}
            {filters.type && (
              <div
                className="flex items-center gap-2 px-4 py-2 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.04)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Filter:
                </span>
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: typeConfig[filters.type].glow,
                    color: typeConfig[filters.type].color,
                  }}
                >
                  {typeConfig[filters.type].label}
                  <button
                    onClick={() => setFilters({ ...filters, type: null })}
                    className="ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </span>
              </div>
            )}

            {/* ----- Notification List ----- */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: filters.type ? 390 : 420 }}
            >
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2
                    size={24}
                    style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }}
                  />
                </div>
              ) : notifications.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-14 px-6">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(139,92,246,0.06))',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <BellOff size={28} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Keine Benachrichtigungen
                  </p>
                  <p
                    className="text-xs mt-1.5 text-center"
                    style={{ color: 'var(--text-muted)', maxWidth: 240 }}
                  >
                    {filters.type
                      ? `Keine ${typeConfig[filters.type].label}-Benachrichtigungen vorhanden.`
                      : 'Neue Events von Agents, Leads und dem System erscheinen hier automatisch.'}
                  </p>
                </div>
              ) : (
                <>
                  {notifications.map((n, idx) => {
                    const config = typeConfig[n.type as NotificationType] || typeConfig.system;
                    const Icon = config.icon;

                    return (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer group"
                        style={{
                          backgroundColor: n.read ? 'transparent' : 'rgba(245,158,11,0.02)',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          animation: `notif-slide-in 200ms cubic-bezier(0.4,0,0.2,1) ${Math.min(idx * 30, 300)}ms both`,
                        }}
                        onClick={() => handleNotificationClick(n)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = n.read
                            ? 'transparent'
                            : 'rgba(245,158,11,0.02)';
                        }}
                      >
                        {/* Icon */}
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: config.glow }}
                        >
                          <Icon size={14} style={{ color: config.color }} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {!n.read && (
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: 'var(--amber)',
                                  animation: 'notif-dot-pulse 2s ease-in-out infinite',
                                }}
                              />
                            )}
                            <p
                              className="text-sm truncate"
                              style={{
                                color: 'var(--text)',
                                fontWeight: n.read ? 400 : 600,
                              }}
                            >
                              {n.title}
                            </p>
                          </div>
                          <p
                            className="text-xs mt-0.5 line-clamp-2"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {n.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p
                              className="text-xs"
                              style={{
                                color: 'var(--text-muted)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '10px',
                              }}
                            >
                              {formatRelativeTime(n.createdAt)}
                            </p>
                            {n.link && (
                              <span
                                className="text-xs"
                                style={{
                                  color: config.color,
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '9px',
                                  opacity: 0.6,
                                }}
                              >
                                {'\u2192'} details
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Remove */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--red)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                          aria-label="Entfernen"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Load more */}
                  {hasMore && (
                    <button
                      onClick={loadMore}
                      className="w-full py-3 text-xs text-center transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--amber)';
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Mehr laden...
                    </button>
                  )}
                </>
              )}
            </div>

            {/* ----- Footer ----- */}
            {notifications.length > 0 && (
              <div
                className="flex items-center justify-between px-4 py-2.5 border-t text-xs"
                style={{
                  borderColor: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                }}
              >
                <span>
                  {notifications.length} Benachrichtigung{notifications.length !== 1 ? 'en' : ''}
                </span>
                <span>
                  {soundEnabled ? 'Ton an' : 'Ton aus'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
