'use client';

import { useState, useEffect, useRef } from 'react';

const hints = [
  { trigger: 3000, message: 'Tipp: Scrollen Sie weiter um unsere Pakete zu sehen' },
  { trigger: 8000, message: 'Wussten Sie? Der Fitness-Check dauert nur 2 Minuten' },
];

export default function ProgressiveOnboarding() {
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const shownRef = useRef(new Set<number>());
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    // Don't show hints to returning visitors
    if (localStorage.getItem('wp-returning')) return;

    const timers = hints.map((hint, i) =>
      setTimeout(() => {
        if (shownRef.current.has(i)) return;
        shownRef.current.add(i);
        setActiveHint(hint.message);
        setTimeout(() => setActiveHint(null), 4000);
      }, hint.trigger)
    );

    // Mark as returning visitor after first visit
    localStorage.setItem('wp-returning', '1');

    return () => timers.forEach(clearTimeout);
  }, []);

  if (!activeHint) return null;

  return (
    <div
      className="fixed top-24 left-1/2 -translate-x-1/2 z-30 rounded-xl px-5 py-3 shadow-lg transition-all"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        animation: 'fadeInUp 0.3s ease',
        maxWidth: '90vw',
      }}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {activeHint}
      </p>
    </div>
  );
}
