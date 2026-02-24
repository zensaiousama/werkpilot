import AnimatedSection from '@/components/AnimatedSection';

const trustBadges = [
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: '100% Schweizer Unternehmen',
    description: 'Eingetragen und ansässig in der Schweiz',
  },
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Ihre Daten bleiben in der Schweiz',
    description: 'DSG- und DSGVO-konform, Server in Schweizer Rechenzentren',
  },
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: '30 Tage Geld-zurück-Garantie',
    description: 'Nicht zufrieden? Volle Rückerstattung, keine Fragen',
  },
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Keine Mindestlaufzeit',
    description: 'Monatlich kündbar, volle Flexibilität',
  },
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
        <path d="M6 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M4 3L20 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Keine Kreditkarte erforderlich',
    description: 'Starten Sie sofort — ohne Zahlungsdaten',
  },
  {
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: '2h Reaktionszeit',
    description: 'Garantierte Antwort innerhalb von 2 Stunden',
  },
];


export default function TrustSection() {
  return (
    <section className="section" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2>Schweizer Qualität — von hier, für hier</h2>
          <p
            className="text-xl mt-4 max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Zuverlässig, präzis und transparent — so wie Sie es von einem Schweizer Partner erwarten
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {trustBadges.map((badge, index) => (
            <AnimatedSection
              key={index}
              delay={index * 100}
              className="text-center trust-float"
            >
              <div
                className="inline-flex items-center justify-center mb-4"
                style={{ color: 'var(--color-success)' }}
              >
                {badge.icon}
              </div>
              <h4
                className="text-lg mb-2 font-bold"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
              >
                {badge.title}
              </h4>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {badge.description}
              </p>
            </AnimatedSection>
          ))}
        </div>

        {/* DSGVO / DSG compliance note */}
        <AnimatedSection className="mt-12 text-center" delay={500}>
          <p
            className="text-xs"
            style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.05em' }}
          >
            DSG- und DSGVO-konform — Ihre Daten verlassen nie die Schweiz
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
