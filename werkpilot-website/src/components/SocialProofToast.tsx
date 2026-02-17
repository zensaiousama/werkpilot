'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const notifications = [
  { company: 'Treuhand Weber', location: 'Zürich', action: 'hat +340% mehr Traffic erreicht', result: true },
  { company: 'Zahnarztpraxis Meier', location: 'Bern', action: 'ist Kunde geworden', result: false },
  { company: 'Immobilien Schneider', location: 'Basel', action: 'hat 12 neue Mandanten/Monat gewonnen', result: true },
  { company: 'Consulting Hofmann', location: 'Luzern', action: 'spart 20h Admin-Arbeit pro Woche', result: true },
  { company: 'Rechtsberatung Fischer', location: 'St. Gallen', action: 'hat den Fitness-Check gestartet', result: false },
  { company: 'Weber IT Solutions', location: 'Winterthur', action: 'hat ROI nach 8 Wochen erreicht', result: true },
  { company: 'Architektur Brunner', location: 'Zug', action: 'nutzt Kunden gewinnen', result: false },
  { company: 'Praxis Dr. Keller', location: 'Thun', action: 'hat +180% mehr Anfragen erreicht', result: true },
];

const timeOffsets = notifications.map(() => Math.floor(Math.random() * 15) + 2);

export default function SocialProofToast() {
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const dismissedRef = useRef(false);

  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showNext = useCallback(() => {
    if (dismissedRef.current) return;
    setCurrentIndex((prev) => (prev + 1) % notifications.length);
    setVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), 5000);
  }, []);

  useEffect(() => {
    const initialDelay = setTimeout(() => {
      showNext();
    }, 8000);

    const interval = setInterval(() => {
      showNext();
    }, 30000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
      clearTimeout(hideTimerRef.current);
    };
  }, [showNext]);

  if (dismissed) return null;

  const notification = notifications[currentIndex];
  const timeAgo = `vor ${timeOffsets[currentIndex]} Minuten`;

  return (
    <div
      className={`fixed bottom-4 left-4 z-40 max-w-sm transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
      }`}
      role="status"
      aria-live="polite"
    >
      <div
        className="rounded-xl p-4 shadow-lg flex items-start gap-3"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: 'var(--color-success)' }}
        >
          {notification.company.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {notification.company} aus {notification.location}
          </p>
          <p className="text-xs" style={{ color: notification.result ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
            {notification.action}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>
              {timeAgo}
            </p>
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(5, 150, 105, 0.08)', color: 'var(--color-success)' }}
            >
              <svg width="10" height="10" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fill="var(--color-success)" />
              </svg>
              Verifiziert
            </span>
          </div>
        </div>
        <button
          onClick={() => { dismissedRef.current = true; setDismissed(true); }}
          className="flex-shrink-0 p-1 hover:opacity-70 transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Benachrichtigung schliessen"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
