'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

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
      'Ja. Alle Daten werden in Schweizer Rechenzentren gespeichert. Wir sind DSGVO-konform und halten uns an höchste Sicherheitsstandards. Wir haben Zugriff nur auf die Systeme, die für die Arbeit notwendig sind — mit Ihrer expliziten Genehmigung.',
  },
  {
    question: 'Kann ich jederzeit kündigen?',
    answer:
      'Ja. Keine Mindestlaufzeit, monatlich kündbar. Wenn Sie nicht zufrieden sind, erhalten Sie in den ersten 30 Tagen eine volle Rückerstattung — ohne Wenn und Aber.',
  },
  {
    question: 'Für welche Branchen eignet sich Werkpilot?',
    answer:
      'Werkpilot funktioniert für die meisten B2B-KMUs: Treuhand, Beratung, Handwerk, IT-Services, Immobilien, und mehr. Wenn Sie online Kunden gewinnen wollen oder effizienter arbeiten möchten, können wir helfen.',
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
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 style={{ fontFamily: 'var(--font-jakarta)' }}>Häufige Fragen</h2>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="card"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full p-6 text-left flex justify-between items-center gap-4"
                aria-expanded={openIndex === index}
              >
                <h3
                  className="text-lg font-bold"
                  style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
                >
                  {faq.question}
                </h3>
                <svg
                  className={`flex-shrink-0 transform transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
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
              {openIndex === index && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="px-6 pb-6"
                >
                  <p style={{ color: 'var(--color-text-secondary)' }}>{faq.answer}</p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
