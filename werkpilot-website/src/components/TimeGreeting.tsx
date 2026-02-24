'use client';

import { useSyncExternalStore } from 'react';

type TimeOfDay = 'morning' | 'afternoon' | 'evening';

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

function subscribe(callback: () => void) {
  // Re-check every 30 minutes
  const interval = setInterval(callback, 30 * 60 * 1000);
  return () => clearInterval(interval);
}

function getServerSnapshot(): TimeOfDay {
  return 'morning';
}

const greetings: Record<TimeOfDay, string> = {
  morning: 'Grüezi',
  afternoon: 'Grüezi mitenand',
  evening: 'Grüezi',
};

const subtext: Record<TimeOfDay, string> = {
  morning: 'Starten Sie den Tag mit einer gratis Analyse',
  afternoon: 'Nutzen Sie jetzt 2 Minuten für Ihren Fitness-Check',
  evening: 'Noch schnell Ihren gratis Report anfordern',
};

export default function TimeGreeting() {
  const time = useSyncExternalStore(subscribe, getTimeOfDay, getServerSnapshot);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6"
      style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
        {greetings[time]} — {subtext[time]}
      </span>
    </div>
  );
}
