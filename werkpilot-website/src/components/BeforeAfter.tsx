'use client';

import { useState } from 'react';

const metrics = [
  { label: 'Website-Traffic', before: '850', after: '3\'740', change: '+340%', unit: '/Monat' },
  { label: 'Neue Anfragen', before: '2', after: '14', change: '+600%', unit: '/Monat' },
  { label: 'Admin-Aufwand', before: '20h', after: '4h', change: '-80%', unit: '/Woche' },
  { label: 'Social Media', before: '0 Posts', after: '12 Posts', change: 'Neu', unit: '/Monat' },
];

export default function BeforeAfter() {
  const [showAfter, setShowAfter] = useState(false);

  return (
    <div>
      {/* Toggle */}
      <div className="flex justify-center mb-8">
        <div
          className="inline-flex rounded-full p-1"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <button
            onClick={() => setShowAfter(false)}
            className="px-6 py-2 rounded-full text-sm font-semibold transition-all"
            style={{
              backgroundColor: !showAfter ? '#2563EB' : 'transparent',
              color: !showAfter ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            Vorher
          </button>
          <button
            onClick={() => setShowAfter(true)}
            className="px-6 py-2 rounded-full text-sm font-semibold transition-all"
            style={{
              backgroundColor: showAfter ? '#059669' : 'transparent',
              color: showAfter ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            Nachher
          </button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl p-4 text-center transition-all duration-300"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: `1px solid ${showAfter ? 'rgba(5, 150, 105, 0.2)' : 'var(--color-border)'}`,
            }}
          >
            <p className="text-xs mb-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {metric.label}
            </p>
            <p
              className="text-2xl font-bold mb-1"
              style={{
                fontFamily: 'var(--font-jakarta)',
                color: showAfter ? 'var(--color-success)' : 'var(--color-text)',
                letterSpacing: '-0.03em',
              }}
            >
              {showAfter ? metric.after : metric.before}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {metric.unit}
            </p>
            {showAfter && (
              <span
                className="inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(5, 150, 105, 0.1)', color: 'var(--color-success)' }}
              >
                {metric.change}
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs mt-4" style={{ color: 'var(--color-text-secondary)' }}>
        Durchschnittswerte nach 3 Monaten — Treuhand Müller AG, Zürich
      </p>
    </div>
  );
}
