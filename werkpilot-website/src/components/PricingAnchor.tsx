export default function PricingAnchor() {
  return (
    <div className="text-center">
      <div className="inline-flex flex-col items-center gap-2">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Statt
        </p>
        <div className="relative">
          <span
            className="text-4xl font-bold line-through opacity-30"
            style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-text)' }}
          >
            CHF 7&apos;000
          </span>
          <span className="text-sm ml-1 line-through opacity-30" style={{ color: 'var(--color-text-secondary)' }}>
            /Monat
          </span>
        </div>
        <div>
          <span
            className="text-5xl font-bold"
            style={{ fontFamily: 'var(--font-jakarta)', color: '#2563EB', letterSpacing: '-0.04em' }}
          >
            ab CHF 1&apos;500
          </span>
          <span className="text-base ml-1" style={{ color: 'var(--color-text-secondary)' }}>
            /Monat
          </span>
        </div>
        <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-success)' }}>
          Sie sparen bis zu CHF 5&apos;500/Monat
        </p>
      </div>
    </div>
  );
}
