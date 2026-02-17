/**
 * React hook for real-time updates via Server-Sent Events (SSE)
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Connection status tracking
 * - Event subscription system
 * - Automatic cleanup on unmount
 *
 * Usage:
 * ```tsx
 * const { isConnected, lastEvent, subscribe } = useRealtimeUpdates();
 *
 * useEffect(() => {
 *   const unsubscribe = subscribe('new_lead', (data) => {
 *     console.log('New lead:', data);
 *   });
 *   return unsubscribe;
 * }, [subscribe]);
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export type RealtimeEventType =
  | 'agent_status_change'
  | 'new_lead'
  | 'task_completed'
  | 'notification'
  | 'ping';

export interface RealtimeEvent {
  type: RealtimeEventType;
  data: unknown;
  timestamp: string;
}

type EventHandler = (data: unknown) => void;

export interface UseRealtimeUpdatesOptions {
  /** Enable/disable real-time updates */
  enabled?: boolean;
  /** Maximum reconnection attempts before giving up */
  maxReconnectAttempts?: number;
  /** Base delay for reconnection in ms */
  reconnectDelay?: number;
}

export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions = {}) {
  const {
    enabled = true,
    maxReconnectAttempts = 10,
    reconnectDelay = 1000,
  } = options;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<RealtimeEvent[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribersRef = useRef<Map<RealtimeEventType, Set<EventHandler>>>(new Map());

  /**
   * Subscribe to a specific event type
   */
  const subscribe = useCallback((eventType: RealtimeEventType, handler: EventHandler) => {
    if (!subscribersRef.current.has(eventType)) {
      subscribersRef.current.set(eventType, new Set());
    }
    subscribersRef.current.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = subscribersRef.current.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          subscribersRef.current.delete(eventType);
        }
      }
    };
  }, []);

  /**
   * Notify all subscribers of an event
   */
  const notifySubscribers = useCallback((eventType: RealtimeEventType, data: unknown) => {
    const handlers = subscribersRef.current.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${eventType} handler:`, error);
        }
      });
    }
  }, []);

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource('/api/stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        console.log('[SSE] Connected to real-time updates');
      };

      // Handle specific event types
      const eventTypes: RealtimeEventType[] = [
        'agent_status_change',
        'new_lead',
        'task_completed',
        'notification',
        'ping'
      ];

      eventTypes.forEach(eventType => {
        eventSource.addEventListener(eventType, (e: Event) => {
          const messageEvent = e as MessageEvent;
          try {
            const data = JSON.parse(messageEvent.data);
            const event: RealtimeEvent = {
              type: eventType,
              data,
              timestamp: data.timestamp || new Date().toISOString()
            };

            // Don't update state for ping events
            if (eventType !== 'ping') {
              setLastEvent(event);
              setEventHistory(prev => [event, ...prev].slice(0, 50)); // Keep last 50 events
            }

            // Notify subscribers
            notifySubscribers(eventType, data);
          } catch (error) {
            console.error(`[SSE] Error parsing ${eventType} event:`, error);
          }
        });
      });

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        eventSource.close();

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          setConnectionStatus('reconnecting');
          const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;

          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setConnectionStatus('disconnected');
          console.error('[SSE] Max reconnection attempts reached');
        }
      };

    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      setConnectionStatus('disconnected');
    }
  }, [enabled, maxReconnectAttempts, reconnectDelay, notifySubscribers]);

  /**
   * Disconnect from SSE endpoint
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionStatus('disconnected');
    reconnectAttemptsRef.current = 0;
  }, []);

  /**
   * Force reconnection
   */
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    /** Current connection status */
    connectionStatus,
    /** Whether currently connected */
    isConnected: connectionStatus === 'connected',
    /** Last received event (excluding pings) */
    lastEvent,
    /** Event history (last 50 events) */
    eventHistory,
    /** Subscribe to specific event types */
    subscribe,
    /** Force reconnection */
    reconnect,
    /** Manually disconnect */
    disconnect,
  };
}
