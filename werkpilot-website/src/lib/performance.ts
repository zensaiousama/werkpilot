/**
 * performance.ts
 *
 * Advanced performance utilities for measuring and reporting
 * Core Web Vitals and navigation timing data.
 */

// ──────────────────────────────────────────────
// Existing utilities (preserved)
// ──────────────────────────────────────────────

export function measureFunction<T>(name: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  if (duration > 16) {
    console.warn(`[Perf] ${name} took ${duration.toFixed(1)}ms (exceeds 16ms frame budget)`);
  }

  return result;
}

export function deferUntilIdle(fn: () => void, timeout = 2000): void {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(fn, { timeout });
  } else {
    setTimeout(fn, 100);
  }
}

export function whenVisible(fn: () => void): void {
  if (document.visibilityState === 'visible') {
    fn();
  } else {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        fn();
        document.removeEventListener('visibilitychange', handler);
      }
    };
    document.addEventListener('visibilitychange', handler);
  }
}

export function preloadRoute(path: string): void {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector(`link[href="${path}"][rel="prefetch"]`);
  if (existing) return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = path;
  document.head.appendChild(link);
}

// ──────────────────────────────────────────────
// Web Vitals metric type
// ──────────────────────────────────────────────

export interface WebVitalMetric {
  name: 'CLS' | 'LCP' | 'INP' | 'FCP' | 'TTFB' | string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  entries: PerformanceEntry[];
}

// ──────────────────────────────────────────────
// CLS — Cumulative Layout Shift
// ──────────────────────────────────────────────

export function measureCLS(callback?: (metric: WebVitalMetric) => void): (() => void) | undefined {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return undefined;

  let clsValue = 0;
  let clsEntries: PerformanceEntry[] = [];
  let sessionValue = 0;
  let sessionEntries: PerformanceEntry[] = [];

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // Only count layout shifts without recent user input
      const layoutShift = entry as PerformanceEntry & {
        hadRecentInput: boolean;
        value: number;
      };

      if (layoutShift.hadRecentInput) continue;

      const firstSessionEntry = sessionEntries[0] as PerformanceEntry | undefined;
      const lastSessionEntry = sessionEntries[sessionEntries.length - 1] as PerformanceEntry | undefined;

      // If the entry occurred within 1s of the previous entry and
      // within 5s of the first entry in the session, include it
      // in the current session. Otherwise, start a new session.
      if (
        sessionValue > 0 &&
        firstSessionEntry &&
        lastSessionEntry &&
        entry.startTime - lastSessionEntry.startTime < 1000 &&
        entry.startTime - firstSessionEntry.startTime < 5000
      ) {
        sessionValue += layoutShift.value;
        sessionEntries.push(entry);
      } else {
        sessionValue = layoutShift.value;
        sessionEntries = [entry];
      }

      // Update CLS if current session is larger
      if (sessionValue > clsValue) {
        clsValue = sessionValue;
        clsEntries = [...sessionEntries];

        const metric: WebVitalMetric = {
          name: 'CLS',
          value: clsValue,
          rating: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor',
          delta: layoutShift.value,
          id: `cls-${Date.now()}`,
          entries: clsEntries,
        };

        callback?.(metric);
      }
    }
  });

  try {
    observer.observe({ type: 'layout-shift', buffered: true });
  } catch {
    // layout-shift not supported
    return undefined;
  }

  return () => observer.disconnect();
}

// ──────────────────────────────────────────────
// LCP — Largest Contentful Paint
// ──────────────────────────────────────────────

export function measureLCP(callback?: (metric: WebVitalMetric) => void): (() => void) | undefined {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return undefined;

  let lcpValue = 0;
  let lcpEntries: PerformanceEntry[] = [];

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];

    if (lastEntry) {
      const lcpEntry = lastEntry as PerformanceEntry & { startTime: number };
      lcpValue = lcpEntry.startTime;
      lcpEntries = [lastEntry];

      const metric: WebVitalMetric = {
        name: 'LCP',
        value: lcpValue,
        rating: lcpValue <= 2500 ? 'good' : lcpValue <= 4000 ? 'needs-improvement' : 'poor',
        delta: lcpValue,
        id: `lcp-${Date.now()}`,
        entries: lcpEntries,
      };

      callback?.(metric);
    }
  });

  try {
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // LCP not supported
    return undefined;
  }

  // Stop observing after user interaction (LCP finalized)
  const stopOnInput = () => {
    ['keydown', 'click', 'scroll'].forEach((type) => {
      window.removeEventListener(type, stopOnInput, { capture: true } as EventListenerOptions);
    });
    // Give a small delay for final LCP entries
    setTimeout(() => observer.disconnect(), 500);
  };

  ['keydown', 'click', 'scroll'].forEach((type) => {
    window.addEventListener(type, stopOnInput, { capture: true, once: false, passive: true });
  });

  return () => {
    observer.disconnect();
    ['keydown', 'click', 'scroll'].forEach((type) => {
      window.removeEventListener(type, stopOnInput, { capture: true } as EventListenerOptions);
    });
  };
}

// ──────────────────────────────────────────────
// INP — Interaction to Next Paint
// ──────────────────────────────────────────────

export function measureINP(callback?: (metric: WebVitalMetric) => void): (() => void) | undefined {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return undefined;

  const interactions: Array<{ latency: number; entry: PerformanceEntry }> = [];

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const eventEntry = entry as PerformanceEntry & {
        duration: number;
        interactionId?: number;
      };

      // Only count entries with interactionId (true interactions)
      if (!eventEntry.interactionId) continue;

      interactions.push({
        latency: eventEntry.duration,
        entry,
      });

      // Calculate INP: the 98th percentile of interaction latencies
      // (approximate: worst interaction ignoring the top outlier)
      const sorted = [...interactions].sort((a, b) => b.latency - a.latency);
      const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.02));
      const inp = sorted[idx];

      if (inp) {
        const metric: WebVitalMetric = {
          name: 'INP',
          value: inp.latency,
          rating: inp.latency <= 200 ? 'good' : inp.latency <= 500 ? 'needs-improvement' : 'poor',
          delta: eventEntry.duration,
          id: `inp-${Date.now()}`,
          entries: [inp.entry],
        };

        callback?.(metric);
      }
    }
  });

  try {
    observer.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  } catch {
    // event timing not supported
    return undefined;
  }

  return () => observer.disconnect();
}

// ──────────────────────────────────────────────
// Report Web Vitals to analytics endpoint
// ──────────────────────────────────────────────

const ANALYTICS_ENDPOINT = '/api/analytics/vitals';

export function reportWebVitals(metric: WebVitalMetric): void {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: Date.now(),
    connection: getConnectionInfo(),
  });

  // Use sendBeacon for reliability (works even on page unload)
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
    return;
  }

  // Fallback to fetch with keepalive
  if (typeof fetch !== 'undefined') {
    fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Silently fail — analytics should never break the app
    });
  }
}

// ──────────────────────────────────────────────
// Navigation Timing
// ──────────────────────────────────────────────

export interface NavigationTimingData {
  dnsLookup: number;
  tcpConnection: number;
  tlsNegotiation: number;
  serverResponseTime: number;
  contentDownload: number;
  domInteractive: number;
  domComplete: number;
  loadComplete: number;
  redirectTime: number;
  unloadTime: number;
}

export function getNavigationTiming(): NavigationTimingData | null {
  if (typeof window === 'undefined' || !('performance' in window)) return null;

  const entries = performance.getEntriesByType('navigation');
  if (entries.length === 0) return null;

  const nav = entries[0] as PerformanceNavigationTiming;

  return {
    dnsLookup: nav.domainLookupEnd - nav.domainLookupStart,
    tcpConnection: nav.connectEnd - nav.connectStart,
    tlsNegotiation: nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0,
    serverResponseTime: nav.responseStart - nav.requestStart,
    contentDownload: nav.responseEnd - nav.responseStart,
    domInteractive: nav.domInteractive - nav.fetchStart,
    domComplete: nav.domComplete - nav.fetchStart,
    loadComplete: nav.loadEventEnd - nav.fetchStart,
    redirectTime: nav.redirectEnd - nav.redirectStart,
    unloadTime: nav.unloadEventEnd - nav.unloadEventStart,
  };
}

// ──────────────────────────────────────────────
// Resource Timings — find slow resources
// ──────────────────────────────────────────────

export interface SlowResource {
  name: string;
  initiatorType: string;
  duration: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
}

export function getResourceTimings(thresholdMs = 500): SlowResource[] {
  if (typeof window === 'undefined' || !('performance' in window)) return [];

  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  return entries
    .filter((entry) => entry.duration > thresholdMs)
    .sort((a, b) => b.duration - a.duration)
    .map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      duration: Math.round(entry.duration),
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
    }));
}

// ──────────────────────────────────────────────
// Slow Connection Detection
// ──────────────────────────────────────────────

interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

function getConnectionInfo(): NetworkInformation | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & { connection?: NetworkInformation };
  return nav.connection ?? null;
}

export function isSlowConnection(): boolean {
  const connection = getConnectionInfo();
  if (!connection) return false;

  // Consider slow if:
  // - effectiveType is 'slow-2g', '2g', or '3g'
  // - downlink speed is below 1.5 Mbps
  // - round-trip time exceeds 300ms
  // - user has enabled data saver
  if (connection.saveData) return true;

  const slowTypes = ['slow-2g', '2g', '3g'];
  if (connection.effectiveType && slowTypes.includes(connection.effectiveType)) return true;

  if (typeof connection.downlink === 'number' && connection.downlink < 1.5) return true;

  if (typeof connection.rtt === 'number' && connection.rtt > 300) return true;

  return false;
}
