'use client';

import { useEffect, useRef } from 'react';

interface ScrollLinkedProgressProps {
  sectionId: string;
  color?: string;
}

export default function ScrollLinkedProgress({ sectionId, color = '#2563EB' }: ScrollLinkedProgressProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const ticking = useRef(false);

  useEffect(() => {
    const section = document.getElementById(sectionId);
    const bar = barRef.current;
    if (!section || !bar) return;

    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const rect = section.getBoundingClientRect();
        const sectionHeight = section.offsetHeight;
        const viewportHeight = window.innerHeight;

        // Calculate how far through the section we've scrolled
        const progress = Math.max(0, Math.min(1,
          (viewportHeight - rect.top) / (sectionHeight + viewportHeight)
        ));

        bar.style.width = `${progress * 100}%`;
        ticking.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sectionId]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: '2px',
        backgroundColor: color,
        opacity: 0.3,
        transition: 'width 0.1s linear',
        zIndex: 2,
      }}
      ref={barRef}
      aria-hidden="true"
    />
  );
}
