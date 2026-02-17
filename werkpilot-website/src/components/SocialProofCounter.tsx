'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * SocialProofCounter — Client component
 * Animated real-time social proof counter showing how many companies use Werkpilot.
 * The number slowly increments over time to simulate real-time activity.
 */

export default function SocialProofCounter() {
  const BASE_COUNT = 423;
  const [count, setCount] = useState(BASE_COUNT);
  const [displayCount, setDisplayCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer — animate on scroll into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsVisible(true);
          setHasAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasAnimated]);

  // Count-up animation when becoming visible
  useEffect(() => {
    if (!isVisible) return;

    const duration = 2200;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quart for a satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayCount(Math.round(eased * count));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [isVisible, count]);

  // Simulated real-time increment
  const incrementCount = useCallback(() => {
    setCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    // Random interval between 15-45 seconds
    const schedule = () => {
      const delay = 15000 + Math.random() * 30000;
      return setTimeout(() => {
        incrementCount();
        timerRef.current = schedule();
      }, delay);
    };

    const timerRef = { current: schedule() };
    return () => clearTimeout(timerRef.current);
  }, [isVisible, incrementCount]);

  // Smoothly animate displayCount towards count when count changes
  useEffect(() => {
    if (!isVisible || !hasAnimated) return;
    // Simple direct set after initial animation
    const timeout = setTimeout(() => {
      setDisplayCount(count);
    }, 300);
    return () => clearTimeout(timeout);
  }, [count, isVisible, hasAnimated]);

  return (
    <div
      ref={containerRef}
      className={`inline-flex items-center gap-3 rounded-2xl px-6 py-3.5 transition-all duration-700 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4'
      }`}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg)',
      }}
      role="status"
      aria-live="polite"
    >
      {/* Live indicator dot */}
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: '#34D399' }}
        />
        <span
          className="relative inline-flex rounded-full h-2.5 w-2.5"
          style={{ backgroundColor: '#10B981' }}
        />
      </span>

      {/* Counter */}
      <div className="flex items-baseline gap-2">
        <span
          className="text-2xl font-extrabold tabular-nums tracking-tight"
          style={{ color: 'var(--color-text)', letterSpacing: '-0.02em' }}
        >
          {displayCount.toLocaleString('de-CH')}
        </span>
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Unternehmen nutzen Werkpilot
        </span>
      </div>

      {/* Live label */}
      <span
        className="text-xs font-semibold uppercase tracking-wider rounded-full px-2.5 py-0.5 flex-shrink-0"
        style={{
          color: '#059669',
          background: 'rgba(5, 150, 105, 0.1)',
          border: '1px solid rgba(5, 150, 105, 0.2)',
        }}
      >
        Live
      </span>
    </div>
  );
}
