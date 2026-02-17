export default function GuaranteeBadge() {
  return (
    <div
      className="inline-flex items-center gap-4 rounded-2xl px-6 py-4"
      style={{
        backgroundColor: 'rgba(5, 150, 105, 0.06)',
        border: '1px solid rgba(5, 150, 105, 0.15)',
      }}
    >
      <div
        className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'rgba(5, 150, 105, 0.1)' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className="font-bold text-sm" style={{ color: 'var(--color-success)', fontFamily: 'var(--font-jakarta)' }}>
          30-Tage-Geld-zurück-Garantie
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Nicht zufrieden? Volle Rückerstattung — keine Fragen.
        </p>
      </div>
    </div>
  );
}
