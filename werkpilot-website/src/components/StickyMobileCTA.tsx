'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function StickyMobileCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const ticking = useRef(false);
  const prefetched = useRef(false);

  useEffect(() => {
    const isFitnessCheck = window.location.pathname === '/fitness-check';

    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        setIsVisible(!isFitnessCheck && window.scrollY > 600);

        // Smart preload: prefetch fitness-check page when user scrolls past 50%
        if (!prefetched.current) {
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (docHeight > 0 && window.scrollY / docHeight > 0.5) {
            prefetched.current = true;
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = '/fitness-check';
            document.head.appendChild(link);
          }
        }

        ticking.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 md:hidden transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div
        className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-2px_10px_rgba(0,0,0,0.1)]"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <Link
          href="/fitness-check"
          className="btn btn-primary w-full justify-center text-base"
          data-track="cta-sticky-mobile"
        >
          Gratis Fitness-Check &rarr;
        </Link>
        <p className="text-center text-xs mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>
          Keine Kreditkarte erforderlich
        </p>
      </div>
    </div>
  );
}
