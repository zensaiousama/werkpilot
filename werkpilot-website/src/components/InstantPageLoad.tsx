'use client';

import { useEffect, useRef } from 'react';

export default function InstantPageLoad() {
  const prefetchedRef = useRef(new Set<string>());

  useEffect(() => {
    // Prefetch links on hover (200ms before click)
    const handlePointerEnter = (e: Event) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (prefetchedRef.current.has(href)) return;

      prefetchedRef.current.add(href);
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.appendChild(link);
    };

    document.addEventListener('pointerenter', handlePointerEnter, { capture: true, passive: true });
    return () => document.removeEventListener('pointerenter', handlePointerEnter, { capture: true });
  }, []);

  return null;
}
