'use client';

import { useSyncExternalStore } from 'react';

interface ProofItem {
  text: string;
  time: string;
}

function generateProofItems(): ProofItem[] {
  const names = [
    'Ein Treuhandbüro in Zürich',
    'Eine Beratungsfirma in Bern',
    'Ein IT-Unternehmen in Basel',
    'Eine Immobilienfirma in Luzern',
    'Ein Handwerksbetrieb in St. Gallen',
    'Eine Arztpraxis in Winterthur',
    'Ein Architekturbüro in Zug',
  ];

  const actions = [
    'hat den Fitness-Check gestartet',
    'hat sich für das Effizienz-Paket entschieden',
    'hat eine Demo angefragt',
    'nutzt jetzt Werkpilot',
  ];

  const now = Date.now();
  const items: ProofItem[] = [];

  for (let i = 0; i < 5; i++) {
    const minutesAgo = Math.floor((now / 60000 + i * 7) % names.length);
    const actionIdx = Math.floor((now / 120000 + i * 3) % actions.length);
    const timeAgo = (i * 12 + 5 + Math.floor((now / 60000) % 10));

    items.push({
      text: `${names[minutesAgo]} ${actions[actionIdx]}`,
      time: timeAgo < 60 ? `vor ${timeAgo} Min.` : `vor ${Math.floor(timeAgo / 60)}h`,
    });
  }

  return items;
}

function subscribe(callback: () => void) {
  const interval = setInterval(callback, 60000);
  return () => clearInterval(interval);
}

function getSnapshot() {
  return JSON.stringify(generateProofItems());
}

function getServerSnapshot() {
  return '[]';
}

export default function DynamicSocialProof() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const items: ProofItem[] = JSON.parse(raw);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.slice(0, 3).map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
          style={{
            backgroundColor: 'rgba(5, 150, 105, 0.05)',
            border: '1px solid rgba(5, 150, 105, 0.1)',
          }}
        >
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: '#10B981' }} />
          </span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{item.text}</span>
          <span className="ml-auto text-[10px] flex-shrink-0" style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }}>
            {item.time}
          </span>
        </div>
      ))}
    </div>
  );
}
