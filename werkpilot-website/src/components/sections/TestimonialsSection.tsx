import AnimatedSection from '@/components/AnimatedSection';

const testimonials = [
  {
    quote:
      'Seit Werkpilot haben wir endlich Zeit fuer das, was wir am besten koennen: Unsere Kunden beraten. Das Marketing laeuft jetzt automatisch — und die Anfragen kommen.',
    name: 'Thomas Mueller',
    role: 'Geschaeftsfuehrer',
    company: 'Mueller & Partner Treuhand',
    location: 'Zuerich',
    metric: '+62% mehr Anfragen',
  },
  {
    quote:
      'Unser Online-Marketing laeuft jetzt komplett automatisiert. Die Anfragen kommen — ohne dass wir uns darum kuemmern muessen. ROI nach 2 Monaten.',
    name: 'Sandra Weber',
    role: 'Inhaberin',
    company: 'Weber Immobilien AG',
    location: 'Bern',
    metric: '20h/Woche gespart',
  },
  {
    quote:
      'Als Handwerksbetrieb hatten wir null Online-Praesenz. Werkpilot hat das in 4 Wochen komplett gedreht. Jetzt haben wir eine Warteliste.',
    name: 'Michael Schneider',
    role: 'Inhaber',
    company: 'Schneider Schreinerei',
    location: 'Luzern',
    metric: '3x mehr Auftraege',
  },
  {
    quote:
      'Die Zusammenarbeit mit Werkpilot fuehlt sich an wie ein internes Team — nur ohne den ganzen Overhead. Absolute Empfehlung fuer jedes KMU.',
    name: 'Lisa Brunner',
    role: 'COO',
    company: 'TechConsult GmbH',
    location: 'Basel',
    metric: 'CHF 8\'000/Mt gespart',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="section" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2>Was unsere Kunden sagen</h2>
          <p
            className="text-lg mt-4 max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Schweizer KMUs vertrauen auf Werkpilot
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {testimonials.map((t, index) => (
            <AnimatedSection
              key={index}
              delay={index * 120}
              className="card p-8 flex flex-col"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <svg
                    key={i}
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="#FBBF24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27 5.06 16.7 6 11.21l-4-3.9 5.53-.8L10 1.5z" />
                  </svg>
                ))}
              </div>

              {/* Quote */}
              <blockquote
                className="text-base leading-relaxed mb-6 flex-1"
                style={{ color: 'var(--color-text)', fontStyle: 'italic' }}
              >
                &laquo;{t.quote}&raquo;
              </blockquote>

              {/* Metric badge */}
              <div
                className="inline-flex self-start items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-5"
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
                    d="M23 6l-9.5 9.5-5-5L1 18"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t.metric}
              </div>

              {/* Author */}
              <div
                className="flex items-center gap-4 pt-5 border-t"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {/* Avatar placeholder */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    color: 'var(--color-accent)',
                    fontFamily: 'var(--font-jakarta)',
                  }}
                >
                  {t.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <p
                    className="text-sm font-bold"
                    style={{
                      color: 'var(--color-primary)',
                      fontFamily: 'var(--font-jakarta)',
                      marginBottom: '0.125rem',
                    }}
                  >
                    {t.name}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--color-text-secondary)', marginBottom: 0 }}
                  >
                    {t.role}, {t.company} &mdash; {t.location}
                  </p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
