/**
 * Event System for Werkpilot Dashboard
 * EventEmitter-style with typed events and event history
 */

export type EventType =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.statusChanged'
  | 'agent.error'
  | 'agent.recovered'
  | 'nightshift.completed'
  | 'decision.made';

export interface BaseEvent<T = unknown> {
  type: EventType;
  timestamp: Date;
  payload: T;
}

export interface LeadCreatedPayload {
  leadId: string;
  email: string;
  source?: string;
}

export interface LeadUpdatedPayload {
  leadId: string;
  changes: Record<string, unknown>;
}

export interface LeadStatusChangedPayload {
  leadId: string;
  oldStatus: string;
  newStatus: string;
}

export interface AgentErrorPayload {
  agentId: string;
  error: string;
  context?: Record<string, unknown>;
}

export interface AgentRecoveredPayload {
  agentId: string;
  recoveryTime: number;
}

export interface NightshiftCompletedPayload {
  runId: string;
  leadsProcessed: number;
  duration: number;
  results: Record<string, unknown>;
}

export interface DecisionMadePayload {
  leadId: string;
  decision: string;
  confidence: number;
  reasoning?: string;
}

export type EventPayload =
  | LeadCreatedPayload
  | LeadUpdatedPayload
  | LeadStatusChangedPayload
  | AgentErrorPayload
  | AgentRecoveredPayload
  | NightshiftCompletedPayload
  | DecisionMadePayload;

export type EventCallback<T = unknown> = (event: BaseEvent<T>) => void | Promise<void>;

class EventSystem {
  private listeners: Map<EventType, Set<EventCallback>> = new Map();
  private history: BaseEvent[] = [];
  private readonly MAX_HISTORY = 1000;

  /**
   * Register an event listener
   */
  on<T = unknown>(eventType: EventType, callback: EventCallback<T>): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback as EventCallback);
  }

  /**
   * Unregister an event listener
   */
  off<T = unknown>(eventType: EventType, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.delete(callback as EventCallback);
    }
  }

  /**
   * Emit an event to all registered listeners
   */
  async emit<T = unknown>(eventType: EventType, payload: T): Promise<void> {
    const event: BaseEvent<T> = {
      type: eventType,
      timestamp: new Date(),
      payload,
    };

    // Add to history
    this.addToHistory(event);

    // Notify listeners
    const callbacks = this.listeners.get(eventType);
    if (callbacks && callbacks.size > 0) {
      const promises = Array.from(callbacks).map(async (callback) => {
        try {
          await callback(event as BaseEvent);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
      await Promise.allSettled(promises);
    }
  }

  /**
   * Add event to history with size limit
   */
  private addToHistory(event: BaseEvent): void {
    this.history.push(event);

    // Maintain max history size
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * Get event history with optional filtering
   */
  getHistory(eventType?: EventType, limit?: number): BaseEvent[] {
    let filtered = eventType
      ? this.history.filter((e) => e.type === eventType)
      : this.history;

    if (limit && limit > 0) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get all registered event types
   */
  getRegisteredEvents(): EventType[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get listener count for an event type
   */
  listenerCount(eventType: EventType): number {
    return this.listeners.get(eventType)?.size || 0;
  }
}

// Singleton instance
export const eventSystem = new EventSystem();
