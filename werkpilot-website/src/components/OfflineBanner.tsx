'use client';

import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return !navigator.onLine;
}

function getServerSnapshot() {
  return false;
}

export default function OfflineBanner() {
  const isOffline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!isOffline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] text-center py-2 text-sm font-medium"
      style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
      role="alert"
    >
      Sie sind offline. Einige Funktionen sind möglicherweise eingeschränkt.
    </div>
  );
}
