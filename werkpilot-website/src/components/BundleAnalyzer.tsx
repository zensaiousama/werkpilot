'use client';

import { useEffect, useRef } from 'react';

export default function BundleAnalyzer() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (process.env.NODE_ENV !== 'development') return;

    // Analyze loaded resources
    requestAnimationFrame(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      const byType: Record<string, { count: number; size: number }> = {};

      for (const r of resources) {
        const ext = r.name.split('.').pop()?.split('?')[0] || 'other';
        const type = ext === 'js' ? 'JavaScript' : ext === 'css' ? 'CSS' : ext === 'woff2' ? 'Fonts' : 'Other';

        if (!byType[type]) byType[type] = { count: 0, size: 0 };
        byType[type].count++;
        byType[type].size += r.transferSize || 0;
      }

      console.group('[Bundle Analysis]');
      for (const [type, data] of Object.entries(byType)) {
        console.log(`${type}: ${data.count} files, ${Math.round(data.size / 1024)}KB`);
      }
      console.log(`Total resources: ${resources.length}`);
      console.groupEnd();
    });
  }, []);

  return null;
}
