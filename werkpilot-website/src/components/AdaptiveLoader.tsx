'use client';

import { useEffect, useRef } from 'react';

export default function AdaptiveLoader() {
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    // Detect device memory and adjust
    const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
    const lowEnd = (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2);

    if (lowEnd) {
      // Disable expensive animations on low-end devices
      document.documentElement.classList.add('reduce-animations');
    }

    // Detect slow connection and adapt
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
    if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') {
      document.documentElement.classList.add('save-data');
    }
  }, []);

  return null;
}
