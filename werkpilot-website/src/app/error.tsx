'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to analytics when available
    const w = window as unknown as Record<string, unknown>;
    if (w.wpTrack) {
      (w.wpTrack as (event: string, data: Record<string, string>) => void)('error', {
        message: error.message,
        digest: error.digest || 'unknown',
      });
    }
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }} role="alert">
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
          Etwas ist schiefgelaufen
        </h1>
        <p className="mb-8" style={{ color: 'var(--color-text-secondary)' }}>
          Bitte versuchen Sie es erneut oder laden Sie die Seite neu.
        </p>
        {error.digest && (
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Fehler-ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={reset} className="btn btn-primary">
            Erneut versuchen
          </button>
          <Link href="/" className="btn btn-secondary">
            Zur Startseite
          </Link>
        </div>
      </div>
    </main>
  );
}
