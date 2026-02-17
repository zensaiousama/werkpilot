'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';

type ConsentStatus = 'pending' | 'accepted' | 'declined';

const CONSENT_KEY = 'wp-cookie-consent';

function subscribeToConsent(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getConsentSnapshot(): ConsentStatus {
  const stored = localStorage.getItem(CONSENT_KEY);
  if (stored === 'accepted' || stored === 'declined') return stored;
  return 'pending';
}

function getServerSnapshot(): ConsentStatus {
  return 'pending';
}

export default function CookieConsent() {
  const status = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, getServerSnapshot);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== 'pending') return;
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
    // Trigger storage event for useSyncExternalStore
    window.dispatchEvent(new Event('storage'));
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setVisible(false);
    window.dispatchEvent(new Event('storage'));
  };

  // Already decided or not yet shown
  if (status !== 'pending' || !visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-label="Cookie-Einstellungen"
      aria-describedby="cookie-desc"
    >
      <div
        className="max-w-2xl mx-auto rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-4"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex-1">
          <p id="cookie-desc" className="text-sm" style={{ color: 'var(--color-text)', marginBottom: '4px' }}>
            Wir verwenden Cookies für Analyse und Verbesserung unserer Website.{' '}
            <Link
              href="/datenschutz"
              className="underline"
              style={{ color: 'var(--color-accent)' }}
            >
              Datenschutzerklärung
            </Link>
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={handleDecline}
            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            style={{
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
            }}
          >
            Ablehnen
          </button>
          <button
            onClick={handleAccept}
            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            style={{
              background: '#2563EB',
              color: 'white',
            }}
          >
            Akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if analytics consent was given.
 * Use in DeferredAnalytics to gate loading.
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CONSENT_KEY) === 'accepted';
}
