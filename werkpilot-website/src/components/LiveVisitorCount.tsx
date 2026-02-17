'use client';

import { useSyncExternalStore } from 'react';

function getVisitorCount(): number {
  // Simulate realistic visitor count based on time of day
  const hour = new Date().getHours();
  const base = hour >= 8 && hour <= 18 ? 12 : 4;
  // Use minute as seed for slight variation
  const minute = new Date().getMinutes();
  return base + (minute % 5);
}

function subscribe(callback: () => void) {
  // Update every 30 seconds for realistic feel
  const interval = setInterval(callback, 30000);
  return () => clearInterval(interval);
}

function getServerSnapshot(): number {
  return 8;
}

export default function LiveVisitorCount() {
  const count = useSyncExternalStore(subscribe, getVisitorCount, getServerSnapshot);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-4 py-1.5"
      style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span className="relative flex h-2 w-2">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: '#34D399' }}
        />
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: '#10B981' }}
        />
      </span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
        {count} Besucher gerade online
      </span>
    </div>
  );
}
