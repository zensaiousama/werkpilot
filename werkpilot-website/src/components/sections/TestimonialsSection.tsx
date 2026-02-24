import AnimatedSection from '@/components/AnimatedSection';

const useCases = [
  {
    scenario: 'Treuhandb\u00fcro',
    challenge:
      'Ein Treuhandb\u00fcro verbringt t\u00e4glich Stunden mit manueller Dateneingabe, Kundenkorrespondenz und dem Erstellen von Reportings. Die Kernarbeit bleibt liegen.',
    solution:
      'Werkpilot automatisiert repetitive Admin-Aufgaben, versendet Kunden-Updates und erstellt Reportings automatisch \u2014 damit mehr Zeit f\u00fcr die eigentliche Beratung bleibt.',
    benefit: 'Mehr Zeit f\u00fcr Beratung',
  },
  {
    scenario: 'Handwerksbetrieb',
    challenge:
      'Ein Handwerksbetrieb hat keine Online-Pr\u00e4senz, verpasst potenzielle Kunden und verwaltet Auftr\u00e4ge noch per Papier und Telefon.',
    solution:
      'Werkpilot baut eine professionelle Online-Pr\u00e4senz auf, automatisiert die Lead-Erfassung und digitalisiert die Auftragsverarbeitung.',
    benefit: 'Online sichtbar werden',
  },
  {
    scenario: 'Beratungsfirma',
    challenge:
      'Eine Consulting-Firma m\u00f6chte wachsen, hat aber weder Zeit noch Budget f\u00fcr ein internes Marketing-Team. Social Media, Newsletter und SEO bleiben auf der Strecke.',
    solution:
      'Werkpilot \u00fcbernimmt die gesamte Marketing-Automatisierung: von Content-Erstellung \u00fcber Social Media bis hin zu E-Mail-Kampagnen.',
    benefit: 'Marketing ohne Mehraufwand',
  },
  {
    scenario: 'Immobilienverwaltung',
    challenge:
      'Eine Immobilienverwaltung k\u00e4mpft mit dem hohen Volumen an Mieteranfragen, Dokumentenverwaltung und der Koordination von Handwerkern.',
    solution:
      'Werkpilot automatisiert die Anfragenbearbeitung, organisiert Dokumente intelligent und koordiniert Termine f\u00fcr Reparaturen und Besichtigungen.',
    benefit: 'Weniger Admin-Chaos',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="section" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2>So hilft Werkpilot Schweizer KMUs</h2>
          <p
            className="text-lg mt-4 max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Typische Anwendungsf&auml;lle aus dem Alltag von Schweizer Unternehmen
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {useCases.map((uc, index) => (
            <AnimatedSection
              key={index}
              delay={index * 120}
              className="card p-8 flex flex-col"
            >
              {/* Scenario label */}
              <div
                className="inline-flex self-start items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-5"
                style={{
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  color: 'var(--color-accent)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {uc.scenario}
              </div>

              {/* Challenge */}
              <div className="mb-4">
                <p
                  className="text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Herausforderung
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {uc.challenge}
                </p>
              </div>

              {/* Solution */}
              <div className="mb-6 flex-1">
                <p
                  className="text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-success)' }}
                >
                  L&ouml;sung mit Werkpilot
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--color-text)' }}
                >
                  {uc.solution}
                </p>
              </div>

              {/* Benefit badge */}
              <div
                className="inline-flex self-start items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: 'rgba(5, 150, 105, 0.08)',
                  color: 'var(--color-success)',
                  border: '1px solid rgba(5, 150, 105, 0.2)',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {uc.benefit}
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
