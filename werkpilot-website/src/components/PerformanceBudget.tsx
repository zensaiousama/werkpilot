'use client';

import { useEffect, useRef } from 'react';

const BUDGETS = {
  lcp: 2500,      // ms - Good LCP threshold
  fid: 100,       // ms - Good FID threshold
  cls: 0.1,       // Good CLS threshold
  totalBlockingTime: 200,  // ms
};

export default function PerformanceBudget() {
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    // Only run budget checks in development
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof PerformanceObserver === 'undefined') return;

    // Check LCP
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last.startTime > BUDGETS.lcp) {
          console.warn(
            `[Perf Budget] LCP exceeded: ${Math.round(last.startTime)}ms (budget: ${BUDGETS.lcp}ms)`
          );
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    // Check Long Tasks
    try {
      let totalBlockingTime = 0;
      const ltObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          totalBlockingTime += entry.duration - 50;
          if (totalBlockingTime > BUDGETS.totalBlockingTime) {
            console.warn(
              `[Perf Budget] TBT exceeded: ${Math.round(totalBlockingTime)}ms (budget: ${BUDGETS.totalBlockingTime}ms)`
            );
          }
        }
      });
      ltObserver.observe({ type: 'longtask', buffered: true });
    } catch {}

    // Log resource sizes
    try {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const jsSize = resources
        .filter((r) => r.name.endsWith('.js'))
        .reduce((sum, r) => sum + (r.transferSize || 0), 0);

      const jsBudget = 300 * 1024; // 300KB
      if (jsSize > jsBudget) {
        console.warn(
          `[Perf Budget] JS size exceeded: ${Math.round(jsSize / 1024)}KB (budget: ${Math.round(jsBudget / 1024)}KB)`
        );
      }
    } catch {}
  }, []);

  return null;
}
