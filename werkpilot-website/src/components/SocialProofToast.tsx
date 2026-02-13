'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const notifications = [
  { company: 'Treuhand Weber', location: 'Zürich', action: 'hat den Fitness-Check gestartet' },
  { company: 'Zahnarztpraxis Meier', location: 'Bern', action: 'ist Kunde geworden' },
  { company: 'Immobilien Schneider', location: 'Basel', action: 'hat den Fitness-Check abgeschlossen' },
  { company: 'Consulting Hofmann', location: 'Luzern', action: 'nutzt das Effizienz-Paket' },
  { company: 'Rechtsberatung Fischer', location: 'St. Gallen', action: 'hat den Fitness-Check gestartet' },
  { company: 'Weber IT Solutions', location: 'Winterthur', action: 'ist Kunde geworden' },
  { company: 'Architektur Brunner', location: 'Zug', action: 'nutzt Kunden gewinnen' },
  { company: 'Praxis Dr. Keller', location: 'Thun', action: 'hat den Fitness-Check abgeschlossen' },
];

// Pre-generate random times so they're stable per notification
const timeOffsets = notifications.map(() => Math.floor(Math.random() * 15) + 2);

export default function SocialProofToast() {
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const dismissedRef = useRef(false);

  const showNext = useCallback(() => {
    if (dismissedRef.current) return;
    setCurrentIndex((prev) => (prev + 1) % notifications.length);
    setVisible(true);
    setTimeout(() => setVisible(false), 5000);
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
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {notification.action}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>
            {timeAgo}
          </p>
        </div>
        <button
          onClick={() => { dismissedRef.current = true; setDismissed(true); }}
          className="flex-shrink-0 p-1 hover:opacity-70 transition-opacity"
          aria-label="Benachrichtigung schliessen"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
