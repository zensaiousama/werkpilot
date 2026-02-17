'use client';

import { useEffect, useRef } from 'react';

export default function MemoryMonitor() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (process.env.NODE_ENV !== 'development') return;

    const perf = performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
    if (!perf.memory) return;

    const checkMemory = () => {
      const used = perf.memory!.usedJSHeapSize;
      const limit = perf.memory!.jsHeapSizeLimit;
      const pct = (used / limit) * 100;

      if (pct > 80) {
        console.warn(`[Memory] High memory usage: ${Math.round(pct)}% (${Math.round(used / 1024 / 1024)}MB / ${Math.round(limit / 1024 / 1024)}MB)`);
      }
    };

    const interval = setInterval(checkMemory, 10000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
