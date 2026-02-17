'use client';

import { useEffect, useRef } from 'react';

export default function WebVitals() {
  const reportedRef = useRef(false);

  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;

    if (typeof PerformanceObserver === 'undefined') return;

    const vitals: Record<string, number> = {};

    // LCP
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        vitals.lcp = last.startTime;
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    // FID / INP
    try {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEventTiming;
          if (!vitals.inp || e.duration > vitals.inp) {
            vitals.inp = e.duration;
          }
        }
      });
      fidObserver.observe({ type: 'event', buffered: true });
    } catch {}

    // CLS
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!e.hadRecentInput && e.value) {
            clsValue += e.value;
            vitals.cls = clsValue;
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {}

    // Report on page hide
    const report = () => {
      if (Object.keys(vitals).length === 0) return;
      const w = window as unknown as Record<string, unknown>;
      type TrackFn = (event: string, data: Record<string, string>) => void;
      if (w.wpTrack) {
        (w.wpTrack as TrackFn)('web_vitals', {
          lcp: String(Math.round(vitals.lcp || 0)),
          inp: String(Math.round(vitals.inp || 0)),
          cls: String((vitals.cls || 0).toFixed(3)),
        });
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') report();
    });
  }, []);

  return null;
}
