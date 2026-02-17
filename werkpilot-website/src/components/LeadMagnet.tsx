'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function LeadMagnet() {
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    // Don't show if already dismissed or on fitness-check page
    if (localStorage.getItem('wp-lead-magnet-dismissed')) return;
    if (window.location.pathname === '/fitness-check') return;

    // Show after 15 seconds on page
    const timer = setTimeout(() => setIsVisible(true), 15000);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible || dismissed) return null;

  return (
    <div
      className="fixed bottom-24 right-4 z-30 max-w-sm rounded-2xl p-5 shadow-xl md:bottom-8"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        animation: 'fadeInUp 0.4s ease',
      }}
    >
      <button
        onClick={() => {
          setDismissed(true);
          localStorage.setItem('wp-lead-magnet-dismissed', '1');
        }}
        className="absolute top-3 right-3 p-1"
        style={{ color: 'var(--color-text-secondary)' }}
        aria-label="Schliessen"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-start gap-3 mb-3">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10,9 9,9 8,9" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
            Gratis KMU-Checkliste
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            7 Schritte zu mehr Kunden online
          </p>
        </div>
      </div>

      <Link
        href="/fitness-check"
        className="btn btn-primary w-full justify-center text-sm py-2.5"
        data-track="cta-lead-magnet"
        onClick={() => {
          setDismissed(true);
          localStorage.setItem('wp-lead-magnet-dismissed', '1');
        }}
      >
        Jetzt herunterladen &rarr;
      </Link>

      <p className="text-[10px] text-center mt-2" style={{ color: 'var(--color-text-secondary)' }}>
        Kostenlos &middot; Kein Spam &middot; Sofort per Email
      </p>
    </div>
  );
}
