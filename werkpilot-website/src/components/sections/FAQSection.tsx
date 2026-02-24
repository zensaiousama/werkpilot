'use client';

import { useState } from 'react';
import Link from 'next/link';
import AnimatedSection from '@/components/AnimatedSection';

const faqs = [
  {
    question: 'Was genau macht Werkpilot?',
    answer:
      'Werkpilot ist Ihr virtuelles Backoffice-Team. Wir übernehmen alles, was Sie von Ihrem Kerngeschäft abhält: Marketing (SEO, Content, Social Media), Sales-Prozesse (Lead Generation, CRM), und Administration (Reporting, Automation, Kommunikation). Sie bekommen ein komplettes Team ohne Personalkosten.',
  },
  {
    question: 'Ersetzt das meine Mitarbeiter?',
    answer:
      'Nein. Werkpilot ergänzt Ihr Team bei repetitiven und zeitintensiven Aufgaben. Ihre Mitarbeiter können sich so auf das konzentrieren, was wirklich wichtig ist: Kundenkontakt, Beratung, Kerngeschäft. Denken Sie an uns als Ihr unsichtbares Backoffice.',
  },
  {
    question: 'Wie schnell sehe ich Resultate?',
    answer:
      'Kurzfristig (Woche 1-2): Prozesse sind eingerichtet, erste Automatisierungen laufen. Mittelfristig (Monat 1-2): Erste messbare Ergebnisse wie mehr Website-Traffic, organisierte Leads. Langfristig (Monat 3+): Signifikantes Wachstum bei Anfragen und Zeitersparnis.',
  },
  {
    question: 'Was kostet das?',
    answer:
      'Wir haben 3 Pakete: Effizienz (CHF 1\'500/Mo) für Prozess-Automation, Kunden gewinnen (CHF 2\'000/Mo) für Online-Marketing, und Wachstum (CHF 5\'000/Mo) für alles inkl. Strategie. Keine Setup-Gebühren, keine versteckten Kosten.',
  },
  {
    question: 'Sind meine Daten sicher?',
    answer:
      'Ja. Alle Daten werden in Schweizer Rechenzentren gespeichert. Wir sind DSG-konform (Schweizer Datenschutzgesetz) sowie DSGVO-konform und halten uns an höchste Sicherheitsstandards. Wir haben Zugriff nur auf die Systeme, die für die Arbeit notwendig sind — mit Ihrer expliziten Genehmigung.',
  },
  {
    question: 'Kann ich jederzeit kündigen?',
    answer:
      'Ja. Keine Mindestlaufzeit, monatlich kündbar. Wenn Sie nicht zufrieden sind, erhalten Sie in den ersten 30 Tagen eine volle Rückerstattung — ohne Wenn und Aber.',
  },
  {
    question: 'Für welche Branchen eignet sich Werkpilot?',
    answer:
      'Werkpilot funktioniert für die meisten Schweizer KMUs: Treuhand, Beratung, Handwerk, IT-Services, Immobilien, Gastronomie und mehr. Ob Einzelfirma im Kanton Zürich oder GmbH in der Romandie — wenn Sie online Kunden gewinnen oder effizienter arbeiten möchten, können wir helfen.',
  },
  {
    question: 'Wie startet man mit Werkpilot?',
    answer:
      'Schritt 1: Gratis Digital-Fitness-Check (2 Minuten). Schritt 2: Wir analysieren Ihre Situation und erstellen einen massgeschneiderten Plan. Schritt 3: Sie wählen ein Paket und wir starten innerhalb von 48h. So einfach.',
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <section className="section" style={{ backgroundColor: 'var(--color-bg)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2>Häufige Fragen</h2>
        </AnimatedSection>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <AnimatedSection
              key={index}
              delay={index * 50}
              className="card"
            >
              <button
                id={`faq-question-${index}`}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full p-6 text-left flex justify-between items-center gap-4"
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
              >
                <span
                  className="text-lg font-bold block"
                  style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
                  role="heading"
                  aria-level={3}
                >
                  {faq.question}
                </span>
                <svg
                  className={`flex-shrink-0 transform transition-transform duration-300 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M19 9l-7 7-7-7"
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div
                id={`faq-answer-${index}`}
                className={`faq-answer ${openIndex === index ? 'open' : ''}`}
                role="region"
                aria-labelledby={`faq-question-${index}`}
              >
                <div>
                  <div className="px-6 pb-6">
                    <p style={{ color: 'var(--color-text-secondary)' }}>{faq.answer}</p>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>

        {/* CTA after FAQ */}
        <AnimatedSection className="text-center mt-16" delay={400}>
          <p className="text-lg mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            Noch Fragen? Wir sind für Sie da.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/fitness-check" className="btn btn-primary" data-track="cta-faq">
              Gratis Fitness-Check &rarr;
            </Link>
            <Link href="/kontakt" className="btn btn-secondary">
              Kontakt aufnehmen
            </Link>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
