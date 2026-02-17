'use client';

/**
 * useNotifications - Notification state management hook
 *
 * Features:
 * - Fetches notifications from /api/notifications
 * - SSE integration for real-time new notifications via existing stream
 * - Mark as read (individual + bulk)
 * - Unread count
 * - Filter by type & sort utilities
 * - Auto-refresh every 30 seconds
 * - Sound toggle
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'agent_alert'
  | 'task_complete'
  | 'lead_update'
  | 'system'
  | 'ai_insight';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link: string | null;
  createdAt: string; // ISO string from API
}

export interface NotificationFilters {
  type?: NotificationType | null;
  read?: boolean | null;
}

interface UseNotificationsOptions {
  /** Auto-refresh interval in ms. Default 30000 (30s). 0 to disable. */
  refreshInterval?: number;
  /** Whether to connect to SSE for real-time updates. Default true. */
  realtime?: boolean;
  /** Initial page size. Default 50. */
  pageSize?: number;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  filters: NotificationFilters;
  setFilters: (f: NotificationFilters) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Notification sound (tiny inline beep)
// ---------------------------------------------------------------------------

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Silently ignore if AudioContext is unavailable
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const {
    refreshInterval = 30000,
    realtime = true,
    pageSize = 50,
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<NotificationFilters>({});
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('wp_notification_sound');
      return stored !== 'false';
    }
    return true;
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const knownIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  // Persist sound preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wp_notification_sound', String(soundEnabled));
    }
  }, [soundEnabled]);

  // -----------------------------------------------------------------------
  // Fetch notifications
  // -----------------------------------------------------------------------
  const fetchNotifications = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        if (!append) setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('page', String(pageNum));
        params.set('limit', String(pageSize));
        if (filters.type) params.set('type', filters.type);
        if (filters.read !== null && filters.read !== undefined) {
          params.set('read', String(filters.read));
        }

        const res = await fetch(`/api/notifications?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const fetched: Notification[] = data.notifications ?? [];
        setTotal(data.total ?? 0);

        if (!mountedRef.current) return;

        if (append) {
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const newItems = fetched.filter((n) => !existingIds.has(n.id));
            return [...prev, ...newItems];
          });
        } else {
          setNotifications(fetched);
          // Seed known IDs on first load
          knownIdsRef.current = new Set(fetched.map((n) => n.id));
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [filters, pageSize]
  );

  // Initial fetch + when filters change
  useEffect(() => {
    setPage(1);
    fetchNotifications(1);
  }, [fetchNotifications]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;
    const interval = setInterval(() => fetchNotifications(1), refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchNotifications]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // -----------------------------------------------------------------------
  // SSE real-time integration via /api/stream
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!realtime) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let attempts = 0;
    const maxAttempts = 10;

    function connect() {
      try {
        eventSource = new EventSource('/api/stream');

        eventSource.addEventListener('notification', (e: Event) => {
          const msgEvent = e as MessageEvent;
          try {
            const data = JSON.parse(msgEvent.data);
            if (!data.id) return;

            // Skip if we already know this notification
            if (knownIdsRef.current.has(data.id)) return;
            knownIdsRef.current.add(data.id);

            const newNotif: Notification = {
              id: data.id,
              title: data.title,
              message: data.message,
              type: data.type || 'system',
              read: false,
              link: data.link || null,
              createdAt: data.timestamp || new Date().toISOString(),
            };

            setNotifications((prev) => [newNotif, ...prev]);

            // Play sound if enabled
            if (soundEnabled) {
              playNotificationSound();
            }
          } catch {
            // Ignore parse errors
          }
        });

        eventSource.onopen = () => {
          attempts = 0;
        };

        eventSource.onerror = () => {
          eventSource?.close();
          if (attempts < maxAttempts) {
            attempts++;
            const delay = 1000 * Math.pow(2, attempts);
            reconnectTimeout = setTimeout(connect, delay);
          }
        };
      } catch {
        // SSE not supported or blocked
      }
    }

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      eventSource?.close();
    };
  }, [realtime, soundEnabled]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      // Revert on error
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: false } : n))
      );
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    // Optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds }),
      });
    } catch {
      // Refetch on error
      fetchNotifications(1);
    }
  }, [notifications, fetchNotifications]);

  const deleteNotification = useCallback(
    async (id: string) => {
      // Optimistic
      setNotifications((prev) => prev.filter((n) => n.id !== id));

      try {
        await fetch('/api/notifications', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [id] }),
        });
      } catch {
        fetchNotifications(1);
      }
    },
    [fetchNotifications]
  );

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchNotifications(nextPage, true);
  }, [page, fetchNotifications]);

  const refresh = useCallback(async () => {
    setPage(1);
    await fetchNotifications(1);
  }, [fetchNotifications]);

  // -----------------------------------------------------------------------
  // Derived
  // -----------------------------------------------------------------------

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasMore = notifications.length < total;

  return {
    notifications,
    unreadCount,
    loading,
    error,
    filters,
    setFilters,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
    soundEnabled,
    setSoundEnabled,
    hasMore,
    loadMore,
  };
}
