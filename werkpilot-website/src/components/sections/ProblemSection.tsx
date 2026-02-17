import Link from 'next/link';
import AnimatedSection from '@/components/AnimatedSection';

const problems = [
  {
    title: '3 verpasste Anfragen pro Tag',
    description:
      'Ohne aktives Online-Marketing gehen täglich durchschnittlich 3 qualifizierte Anfragen an Ihre Konkurrenz — das sind über 90 verlorene Kunden pro Monat.',
    link: '/dienstleistungen/kunden-gewinnen',
    linkText: 'Kunden gewinnen',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: '20 Stunden verschwendet pro Woche',
    description:
      "Administrative Aufgaben fressen Ihre wertvollste Ressource: Ihre Zeit. Das sind über 1'000 Stunden pro Jahr, die Sie in Ihr Kerngeschäft investieren könnten.",
    link: '/dienstleistungen/effizienz',
    linkText: 'Effizienz steigern',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="2" />
        <path d="M12 6v6l4 2" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "CHF 15'000 verschenktes Potenzial",
    description:
      "Schweizer KMUs ohne automatisiertes Marketing verlieren durchschnittlich CHF 15'000 pro Monat an potenziellem Umsatz.",
    link: '/dienstleistungen/wachstum',
    linkText: 'Wachstum starten',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M23 6l-9.5 9.5-5-5L1 18" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 6h6v6" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function ProblemSection() {
  return (
    <section className="section" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2>Was Sie gerade verpassen</h2>
          <p
            className="mt-4 text-lg"
            style={{ color: 'var(--color-text-secondary)', maxWidth: '640px', margin: '1rem auto 0' }}
          >
            Jeden Tag ohne optimierte Online-Präsenz kostet Sie bares Geld
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {problems.map((problem, index) => (
            <AnimatedSection key={index} delay={index * 150} className="card p-8">
              <div
                className="w-14 h-14 rounded-xl mb-6 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(37, 99, 235, 0.06)' }}
              >
                {problem.icon}
              </div>
              <h3
                className="mb-3"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
              >
                {problem.title}
              </h3>
              <p className="mb-4 text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {problem.description}
              </p>
              <Link
                href={problem.link}
                className="text-sm font-semibold hover:underline"
                style={{ color: 'var(--color-accent)' }}
              >
                {problem.linkText} &rarr;
              </Link>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
