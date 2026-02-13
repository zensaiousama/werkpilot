'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function StickyMobileCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Hide on fitness-check page (already on the form)
    const isFitnessCheck = window.location.pathname === '/fitness-check';

    const handleScroll = () => {
      setIsVisible(!isFitnessCheck && window.scrollY > 600);
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
        className="p-3 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]"
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
