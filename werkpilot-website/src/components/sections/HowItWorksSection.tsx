import Link from 'next/link';
import AnimatedSection from '@/components/AnimatedSection';

const steps = [
  {
    number: '1',
    title: 'Gratis Analyse',
    description:
      'Wir analysieren Ihre Online-Präsenz und zeigen Ihnen konkret wo Sie Kunden verlieren',
    link: '/fitness-check',
    linkText: 'Jetzt Analyse starten',
  },
  {
    number: '2',
    title: 'Massgeschneiderter Plan',
    description:
      'Sie wählen was Sie brauchen: Kunden gewinnen, Effizienz, oder Wachstum',
    link: '/dienstleistungen',
    linkText: 'Pakete vergleichen',
  },
  {
    number: '3',
    title: 'Wir legen los',
    description:
      'Innerhalb von 48h arbeitet Ihr Werkpilot-Team für Sie — messbar und transparent',
    link: '/fitness-check',
    linkText: 'Jetzt starten',
  },
];

export default function HowItWorksSection() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'So starten Sie mit Werkpilot',
            description: 'In 3 einfachen Schritten zu Ihrem virtuellen Backoffice',
            totalTime: 'P2D',
            estimatedCost: {
              '@type': 'MonetaryAmount',
              currency: 'CHF',
              value: '0',
            },
            step: [
              {
                '@type': 'HowToStep',
                position: 1,
                name: 'Gratis Analyse',
                text: 'Wir analysieren Ihre Online-Präsenz und zeigen Ihnen konkret wo Sie Kunden verlieren',
                url: 'https://werkpilot.ch/fitness-check',
              },
              {
                '@type': 'HowToStep',
                position: 2,
                name: 'Massgeschneiderter Plan',
                text: 'Sie wählen was Sie brauchen: Kunden gewinnen, Effizienz, oder Wachstum',
                url: 'https://werkpilot.ch/dienstleistungen',
              },
              {
                '@type': 'HowToStep',
                position: 3,
                name: 'Wir legen los',
                text: 'Innerhalb von 48h arbeitet Ihr Werkpilot-Team für Sie — messbar und transparent',
                url: 'https://werkpilot.ch/fitness-check',
              },
            ],
          }),
        }}
      />
      <section
        id="how-it-works"
        className="section"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2>So funktioniert&apos;s</h2>
          <p
            className="text-xl mt-4 max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            In 3 einfachen Schritten zu Ihrem virtuellen Backoffice
          </p>
        </AnimatedSection>

        <div className="max-w-4xl mx-auto relative">
          {/* Connecting timeline line */}
          <div
            className="hidden md:block absolute"
            style={{
              left: '2.5rem',
              top: '5rem',
              bottom: '5rem',
              width: '2px',
              background: 'linear-gradient(to bottom, rgba(37, 99, 235, 0.3), rgba(5, 150, 105, 0.3))',
            }}
            aria-hidden="true"
          />

          {steps.map((step, index) => (
            <AnimatedSection
              key={index}
              animation="fade-left"
              delay={index * 200}
              className="flex flex-col md:flex-row gap-8 mb-12 items-start relative"
            >
              <div
                className="flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center text-4xl font-bold relative z-10"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'white',
                  fontFamily: 'var(--font-jakarta)',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                }}
              >
                {step.number}
              </div>
              <div className="flex-1 pt-2">
                <h3
                  className="mb-3"
                  style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
                >
                  {step.title}
                </h3>
                <p className="text-lg mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {step.description}
                </p>
                <Link
                  href={step.link}
                  className="text-sm font-semibold hover:underline"
                  style={{ color: 'var(--color-accent)' }}
                >
                  {step.linkText} &rarr;
                </Link>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
    </>
  );
}
