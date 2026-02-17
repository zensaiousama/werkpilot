'use client';

import { useSyncExternalStore } from 'react';

type ConnectionQuality = 'fast' | 'slow' | 'offline';

function getConnectionQuality(): ConnectionQuality {
  if (typeof navigator === 'undefined') return 'fast';
  if (!navigator.onLine) return 'offline';

  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  if (!conn) return 'fast';
  if (conn.saveData) return 'slow';

  const type = conn.effectiveType;
  if (type === 'slow-2g' || type === '2g' || type === '3g') return 'slow';
  return 'fast';
}

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);

  const conn = (navigator as Navigator & { connection?: EventTarget }).connection;
  if (conn) {
    conn.addEventListener('change', callback);
  }

  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
    if (conn) {
      conn.removeEventListener('change', callback);
    }
  };
}

function getServerSnapshot(): ConnectionQuality {
  return 'fast';
}

export function useNetworkStatus(): ConnectionQuality {
  return useSyncExternalStore(subscribe, getConnectionQuality, getServerSnapshot);
}
