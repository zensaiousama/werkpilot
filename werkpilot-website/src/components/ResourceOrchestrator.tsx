'use client';

import { useEffect, useRef } from 'react';

export default function ResourceOrchestrator() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    // 1. Idle callback for non-critical work
    const idleCallback = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 100);

    // 2. Prefetch critical routes during idle time
    idleCallback(() => {
      const routes = ['/fitness-check', '/dienstleistungen', '/preise', '/kontakt'];
      routes.forEach((route) => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        link.as = 'document';
        document.head.appendChild(link);
      });
    });

    // 3. Monitor long tasks and log them
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 100) {
              console.debug(`[Perf] Long task: ${Math.round(entry.duration)}ms`);
            }
          }
        });
        longTaskObserver.observe({ type: 'longtask', buffered: true });
      } catch {}
    }

    // 4. Preload images that are about to come into viewport
    if (typeof IntersectionObserver !== 'undefined') {
      const imgObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement;
              if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
              }
              imgObserver.unobserve(img);
            }
          });
        },
        { rootMargin: '300px' }
      );

      document.querySelectorAll('img[data-src]').forEach((img) => {
        imgObserver.observe(img);
      });
    }

    // 5. Connection-aware resource loading
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    if (conn?.effectiveType === '4g') {
      // On fast connections, prerender the fitness-check page
      idleCallback(() => {
        const link = document.createElement('link');
        link.rel = 'prerender';
        link.href = '/fitness-check';
        document.head.appendChild(link);
      });
    }
  }, []);

  return null;
}
