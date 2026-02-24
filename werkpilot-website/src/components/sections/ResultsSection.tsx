'use client';

import AnimatedSection from '@/components/AnimatedSection';

const capabilities = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Marketing-Automatisierung',
    description: 'SEO, Social Media, Content und E-Mail-Kampagnen \u2014 automatisiert und auf den Schweizer Markt zugeschnitten.',
    details: ['SEO & lokale Sichtbarkeit', 'Social Media Management', 'Newsletter & E-Mail-Automation', 'Content-Erstellung'],
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Lead-Generierung & Sales',
    description: 'Von der ersten Anfrage bis zum Abschluss \u2014 strukturierte Prozesse f\u00fcr mehr Kunden.',
    details: ['Lead-Erfassung & Qualifizierung', 'Automatische Follow-ups', 'CRM-Integration', 'Angebots-Automation'],
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 14l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Admin & Backoffice',
    description: 'Repetitive Verwaltungsaufgaben automatisieren und Freir\u00e4ume f\u00fcr das Kerngesch\u00e4ft schaffen.',
    details: ['Dokumenten-Management', 'Termin-Koordination', 'Reporting & Analytics', 'Workflow-Optimierung'],
  },
];

export default function ResultsSection() {
  return (
    <section className="section" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2>Was Werkpilot f&uuml;r Sie leisten kann</h2>
          <p
            className="text-lg mt-4 max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Drei Bereiche, in denen AI-Automatisierung den gr&ouml;ssten Unterschied macht
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {capabilities.map((cap, index) => (
            <AnimatedSection
              key={index}
              delay={index * 100}
              className="card p-8"
            >
              <div
                className="inline-flex items-center justify-center mb-6"
                style={{ color: 'var(--color-accent)' }}
              >
                {cap.icon}
              </div>

              <h3
                className="text-xl font-bold mb-3"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
              >
                {cap.title}
              </h3>

              <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {cap.description}
              </p>

              <ul className="space-y-2">
                {cap.details.map((detail, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {detail}
                  </li>
                ))}
              </ul>
            </AnimatedSection>
          ))}
        </div>

        {/* Value proposition */}
        <AnimatedSection className="mt-16 text-center" delay={400}>
          <div
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(5, 150, 105, 0.1)" stroke="var(--color-success)" strokeWidth="2" />
              <path d="M9 12l2 2 4-4" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span
              className="text-sm font-semibold"
              style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
            >
              Alle Daten bleiben in der Schweiz &mdash; DSG- und DSGVO-konform
            </span>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
