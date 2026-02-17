'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: 'var(--red-glow, rgba(239,68,68,0.12))' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          System Error
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          {error.message || 'Ein unerwarteter Fehler ist aufgetreten.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: 'var(--amber)', color: '#000' }}
          >
            Erneut versuchen
          </button>
          <a
            href="/"
            className="px-5 py-2.5 rounded-xl text-sm font-medium border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Dashboard
          </a>
        </div>
        {error.digest && (
          <p
            className="mt-4 text-xs"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
          >
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
