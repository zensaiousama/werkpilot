'use client';

import { useEffect, useRef } from 'react';

export default function PaintTimingTracker() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    if (typeof PerformanceObserver === 'undefined') return;

    // Track First Paint and First Contentful Paint
    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const w = window as unknown as Record<string, unknown>;
          type TrackFn = (event: string, data: Record<string, string>) => void;
          if (w.wpTrack) {
            (w.wpTrack as TrackFn)('paint_timing', {
              name: entry.name,
              time: String(Math.round(entry.startTime)),
            });
          }
        }
      });
      paintObserver.observe({ type: 'paint', buffered: true });
    } catch {}

    // Track Time to First Byte from navigation timing
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        const nav = navEntries[0];
        const ttfb = nav.responseStart - nav.requestStart;
        const domInteractive = nav.domInteractive - nav.fetchStart;
        const domComplete = nav.domComplete - nav.fetchStart;

        const w = window as unknown as Record<string, unknown>;
        type TrackFn = (event: string, data: Record<string, string>) => void;
        if (w.wpTrack) {
          (w.wpTrack as TrackFn)('navigation_timing', {
            ttfb: String(Math.round(ttfb)),
            domInteractive: String(Math.round(domInteractive)),
            domComplete: String(Math.round(domComplete)),
            transferSize: String(nav.transferSize || 0),
          });
        }
      }
    } catch {}
  }, []);

  return null;
}
