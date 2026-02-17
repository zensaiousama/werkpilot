'use client';

import { useState } from 'react';

const packages = [
  { name: 'Effizienz', price: 1500, roi: 2.8 },
  { name: 'Kunden gewinnen', price: 2000, roi: 3.5 },
  { name: 'Wachstum', price: 5000, roi: 4.2 },
];

export default function ROICalculator() {
  const [selected, setSelected] = useState(1);
  const [employees, setEmployees] = useState(5);

  const pkg = packages[selected];
  const internalCost = employees * 1400; // avg admin cost per employee
  const savedTime = Math.round(employees * 4.2); // hours saved per week
  const projectedROI = Math.round(pkg.price * pkg.roi);
  const netGain = projectedROI - pkg.price;

  return (
    <div
      className="rounded-2xl p-8 md:p-10"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <h3
        className="text-xl mb-2"
        style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
      >
        ROI-Rechner
      </h3>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
        Berechnen Sie Ihre potenzielle Rendite
      </p>

      {/* Package selector */}
      <div className="flex gap-2 mb-6">
        {packages.map((p, i) => (
          <button
            key={p.name}
            onClick={() => setSelected(i)}
            className="flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: selected === i ? '#2563EB' : 'transparent',
              color: selected === i ? 'white' : 'var(--color-text-secondary)',
              border: selected === i ? 'none' : '1px solid var(--color-border)',
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Employee slider */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Mitarbeiter
          </label>
          <span className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
            {employees}
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="50"
          value={employees}
          onChange={(e) => setEmployees(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: '#2563EB' }}
        />
        <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          <span>1</span>
          <span>50</span>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Werkpilot Kosten</span>
          <span className="font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-jakarta)' }}>
            CHF {pkg.price.toLocaleString('de-CH')}/Mo
          </span>
        </div>
        <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Interne Kosten (geschätzt)</span>
          <span className="font-bold line-through opacity-50" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-jakarta)' }}>
            CHF {internalCost.toLocaleString('de-CH')}/Mo
          </span>
        </div>
        <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Zeitersparnis/Woche</span>
          <span className="font-bold" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-jakarta)' }}>
            {savedTime}h
          </span>
        </div>
        <div
          className="flex justify-between items-center py-4 px-4 rounded-xl mt-2"
          style={{ backgroundColor: 'rgba(5, 150, 105, 0.08)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
            Geschätzter Netto-Gewinn
          </span>
          <span
            className="text-2xl font-bold"
            style={{ color: 'var(--color-success)', fontFamily: 'var(--font-jakarta)', letterSpacing: '-0.03em' }}
          >
            +CHF {netGain.toLocaleString('de-CH')}/Mo
          </span>
        </div>
      </div>

      <p className="text-xs mt-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
        Basierend auf Durchschnittswerten unserer Schweizer KMU-Kunden
      </p>
    </div>
  );
}
