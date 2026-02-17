'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

export default function ExitIntentPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [spotsLeft] = useState(() => Math.floor(Math.random() * 2) + 2);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

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

  // Focus management and Escape key
  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, close]);

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
        onClick={close}
      />

      {/* Modal */}
      <div
        className="relative max-w-lg w-full rounded-2xl p-8 shadow-2xl animate-[fadeInUp_0.3s_ease-out]"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <button
          ref={closeButtonRef}
          onClick={close}
          className="absolute top-4 right-4 p-2 hover:opacity-70 transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Schliessen"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="text-center">
          {/* Spots counter */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6"
            style={{ backgroundColor: 'rgba(37, 99, 235, 0.06)', border: '1px solid rgba(37, 99, 235, 0.15)' }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--color-warm)' }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--color-warm)' }} />
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-warm)' }}>
              Nur noch {spotsLeft} Plätze diesen Monat
            </span>
          </div>

          <h2
            className="text-2xl font-bold mb-3"
            style={{ color: 'var(--color-primary)' }}
          >
            Warten Sie kurz!
          </h2>

          <p className="text-lg mb-2" style={{ color: 'var(--color-text)' }}>
            Ihr gratis Digital-Fitness-Check wartet auf Sie.
          </p>

          <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Erfahren Sie in 2 Minuten, wie viele Kunden Sie online verpassen
            — und was Sie konkret dagegen tun k&ouml;nnen.
          </p>

          {/* Urgency offer */}
          <div
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 mb-6"
            style={{ backgroundColor: 'rgba(5, 150, 105, 0.06)', border: '1px solid rgba(5, 150, 105, 0.15)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>
              Gratis Setup (CHF 500 Wert) — nur diesen Monat
            </span>
          </div>

          <Link
            href="/fitness-check"
            className="btn btn-primary w-full justify-center text-lg mb-4"
            onClick={close}
            data-track="cta-exit-intent"
          >
            Jetzt Fitness-Check starten &rarr;
          </Link>

          <div className="flex items-center justify-center gap-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {['Kostenlos', '2 Minuten', 'Unverbindlich'].map((label) => (
              <span key={label} className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
