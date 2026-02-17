/**
 * ValueStack — Server component
 * Visual value stack showing what is included with Werkpilot,
 * comparing total value versus actual price with a savings callout.
 */

interface ValueItem {
  label: string;
  value: number;
}

const items: ValueItem[] = [
  { label: 'Professionelle Website-Optimierung', value: 3500 },
  { label: 'SEO-Strategie & Umsetzung', value: 2800 },
  { label: 'Google Ads Management', value: 1500 },
  { label: 'Social-Media-Automatisierung', value: 1200 },
  { label: 'Lead-Funnel & CRM-Integration', value: 2500 },
  { label: 'Monatliche Performance-Reports', value: 800 },
  { label: 'Persönlicher Ansprechpartner', value: 1500 },
  { label: 'Laufende Optimierung & A/B-Tests', value: 1800 },
];

const totalValue = items.reduce((sum, item) => sum + item.value, 0);
const actualPrice = 1500;
const savings = totalValue - actualPrice;

function formatCHF(amount: number): string {
  return `CHF ${amount.toLocaleString('de-CH')}`;
}

export default function ValueStack() {
  return (
    <section className="py-20" style={{ background: 'var(--color-surface)' }}>
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-12">
          <span
            className="inline-block text-sm font-semibold uppercase tracking-wider mb-3 px-4 py-1.5 rounded-full"
            style={{
              color: '#059669',
              background: 'rgba(5, 150, 105, 0.08)',
              border: '1px solid rgba(5, 150, 105, 0.15)',
            }}
          >
            Alles inklusive
          </span>
          <h2 style={{ color: 'var(--color-text)' }}>
            Was Sie bei Werkpilot erhalten
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Ein komplettes Digital-Marketing-Paket — für einen Bruchteil
            der Kosten eines internen Teams.
          </p>
        </div>

        {/* Value stack card */}
        <div
          className="max-w-2xl mx-auto rounded-2xl overflow-hidden"
          style={{
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {/* Items list */}
          <div
            className="p-6 md:p-8"
            style={{ background: 'var(--color-surface)' }}
          >
            <ul className="space-y-4">
              {items.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-4 pb-4"
                  style={{
                    borderBottom:
                      i < items.length - 1
                        ? '1px solid var(--color-border)'
                        : 'none',
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkmark icon */}
                    <svg
                      className="w-5 h-5 flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" fill="rgba(5, 150, 105, 0.1)" />
                      <path
                        d="M8 12l2.5 2.5L16 9"
                        stroke="#059669"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span
                      className="text-base font-medium"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {item.label}
                    </span>
                  </div>
                  <span
                    className="text-sm font-medium whitespace-nowrap flex-shrink-0"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Wert: {formatCHF(item.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Total value line */}
          <div
            className="px-6 md:px-8 py-4 flex items-center justify-between"
            style={{
              background: 'var(--color-surface-alt)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <span
              className="text-base font-bold"
              style={{ color: 'var(--color-text)' }}
            >
              Gesamtwert
            </span>
            <span
              className="text-lg font-bold line-through"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {formatCHF(totalValue)}
            </span>
          </div>

          {/* Actual price */}
          <div
            className="px-6 md:px-8 py-4 flex items-center justify-between"
            style={{
              background: 'var(--color-surface-alt)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <span
              className="text-base font-bold"
              style={{ color: 'var(--color-text)' }}
            >
              Ihr Preis ab
            </span>
            <span
              className="text-2xl font-extrabold"
              style={{ color: 'var(--color-accent)', letterSpacing: '-0.02em' }}
            >
              {formatCHF(actualPrice)}/Mt.
            </span>
          </div>

          {/* Savings callout */}
          <div
            className="px-6 md:px-8 py-5 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.08) 0%, rgba(16, 185, 129, 0.12) 100%)',
              borderTop: '1px solid rgba(5, 150, 105, 0.2)',
            }}
          >
            <svg
              className="w-5 h-5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#059669"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span
              className="text-base font-bold"
              style={{ color: '#059669' }}
            >
              Sie sparen {formatCHF(savings)} gegenüber Einzelbuchung
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
