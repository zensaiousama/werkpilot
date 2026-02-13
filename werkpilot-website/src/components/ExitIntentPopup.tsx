'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ExitIntentPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const shown = sessionStorage.getItem('exit-popup-shown');
    if (shown) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 5 && !sessionStorage.getItem('exit-popup-shown')) {
        setIsOpen(true);
        sessionStorage.setItem('exit-popup-shown', 'true');
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Angebot"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div
        className="relative max-w-lg w-full rounded-2xl p-8 shadow-2xl animate-[fadeInUp_0.3s_ease-out]"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 hover:opacity-70 transition-opacity"
          aria-label="Schliessen"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-warm)', opacity: 0.15 }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="var(--color-warm)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h2
            className="text-2xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
          >
            Warten Sie kurz!
          </h2>

          <p className="text-lg mb-2" style={{ color: 'var(--color-text)' }}>
            Ihr gratis Digital-Fitness-Check wartet auf Sie.
          </p>

          <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            Erfahren Sie in 2 Minuten, wie viele Kunden Sie online verpassen
            — und was Sie konkret dagegen tun k&ouml;nnen.
          </p>

          <Link
            href="/fitness-check"
            className="btn btn-primary w-full justify-center text-lg mb-4"
            onClick={() => setIsOpen(false)}
            data-track="cta-exit-intent"
          >
            Jetzt Fitness-Check starten &rarr;
          </Link>

          <div className="flex items-center justify-center gap-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 13l4 4L19 7" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Kostenlos
            </span>
            <span className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 13l4 4L19 7" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              2 Minuten
            </span>
            <span className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 13l4 4L19 7" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Unverbindlich
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
