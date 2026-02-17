'use client';

import { useSyncExternalStore } from 'react';

type ReferrerType = 'google' | 'linkedin' | 'direct' | 'other';

function getReferrerType(): ReferrerType {
  if (typeof document === 'undefined') return 'direct';
  const ref = document.referrer.toLowerCase();
  if (ref.includes('google')) return 'google';
  if (ref.includes('linkedin')) return 'linkedin';
  if (!ref) return 'direct';
  return 'other';
}

function subscribe(callback: () => void) {
  // Referrer doesn't change, but we need a valid subscription
  return () => {};
  void callback;
}

function getServerSnapshot(): ReferrerType {
  return 'direct';
}

const messages: Record<ReferrerType, string> = {
  google: 'Gefunden, was Sie gesucht haben? Starten Sie mit einem gratis Check.',
  linkedin: 'Willkommen von LinkedIn! Entdecken Sie unser Angebot für KMUs.',
  direct: 'Schön, dass Sie da sind! Erfahren Sie, wie wir Ihrem KMU helfen.',
  other: 'Willkommen bei Werkpilot — Ihrem virtuellen Backoffice-Team.',
};

export default function ReferrerPersonalizer() {
  const referrer = useSyncExternalStore(subscribe, getReferrerType, getServerSnapshot);

  return (
    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
      {messages[referrer]}
    </p>
  );
}
