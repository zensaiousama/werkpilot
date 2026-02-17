import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gratis Digital-Fitness-Check für Ihr KMU',
  description:
    'Kostenlose Analyse Ihrer Online-Präsenz in nur 2 Minuten. Erhalten Sie einen persönlichen Report mit konkreten Verbesserungsvorschlägen für SEO, Social Media und Neukundengewinnung.',
  keywords: [
    'Digital Fitness Check',
    'KMU Analyse',
    'Online Präsenz Check',
    'SEO Analyse Schweiz',
    'Digital Marketing Audit',
    'KMU Digitalisierung',
    'Website Analyse gratis',
    'Neukundengewinnung KMU',
  ],
  openGraph: {
    title: 'Gratis Digital-Fitness-Check — Werkpilot',
    description:
      'In 2 Minuten zu Ihrem persönlichen Digital-Report. Kostenlose Analyse Ihrer Online-Präsenz mit konkreten Handlungsempfehlungen.',
    url: 'https://werkpilot.ch/fitness-check',
    type: 'website',
    locale: 'de_CH',
    siteName: 'Werkpilot',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gratis Digital-Fitness-Check — Werkpilot',
    description:
      'In 2 Minuten zu Ihrem persönlichen Digital-Report. Kostenlose Analyse Ihrer Online-Präsenz.',
  },
  alternates: {
    canonical: 'https://werkpilot.ch/fitness-check',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Was ist der Digital-Fitness-Check von Werkpilot?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Der Digital-Fitness-Check ist eine kostenlose Analyse Ihrer Online-Präsenz. In nur 2 Minuten erhalten Sie einen massgeschneiderten Report mit konkreten Verbesserungsvorschlägen für SEO, Social Media und Neukundengewinnung.',
          },
        },
        {
          '@type': 'Question',
          name: 'Wie lange dauert der Digital-Fitness-Check?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Das Ausfüllen des Formulars dauert nur 2 Minuten. Ihren persönlichen Digital-Fitness-Report erhalten Sie innerhalb von 24 Stunden per E-Mail.',
          },
        },
        {
          '@type': 'Question',
          name: 'Ist der Digital-Fitness-Check wirklich kostenlos?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Ja, der Digital-Fitness-Check ist 100% kostenlos und unverbindlich. Sie erhalten einen detaillierten Report ohne jegliche Verpflichtung.',
          },
        },
        {
          '@type': 'Question',
          name: 'Welche Bereiche werden im Digital-Fitness-Check analysiert?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Der Check analysiert Ihre Online-Präsenz in den Bereichen SEO-Potenzial, Social-Media-Aktivität, Blog-Strategie, Neukundengewinnung und gibt branchenspezifische Benchmarks für Ihren Kanton.',
          },
        },
        {
          '@type': 'Question',
          name: 'Für welche Unternehmen eignet sich der Digital-Fitness-Check?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Der Check eignet sich für alle Schweizer KMUs — von Treuhand und Beratung über IT-Services und Handwerk bis hin zu Gesundheit, Gastronomie und E-Commerce.',
          },
        },
      ],
    }),
  },
};

export default function FitnessCheckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Was ist der Digital-Fitness-Check von Werkpilot?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Der Digital-Fitness-Check ist eine kostenlose Analyse Ihrer Online-Präsenz. In nur 2 Minuten erhalten Sie einen massgeschneiderten Report mit konkreten Verbesserungsvorschlägen für SEO, Social Media und Neukundengewinnung.',
                },
              },
              {
                '@type': 'Question',
                name: 'Wie lange dauert der Digital-Fitness-Check?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Das Ausfüllen des Formulars dauert nur 2 Minuten. Ihren persönlichen Digital-Fitness-Report erhalten Sie innerhalb von 24 Stunden per E-Mail.',
                },
              },
              {
                '@type': 'Question',
                name: 'Ist der Digital-Fitness-Check wirklich kostenlos?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Ja, der Digital-Fitness-Check ist 100% kostenlos und unverbindlich. Sie erhalten einen detaillierten Report ohne jegliche Verpflichtung.',
                },
              },
              {
                '@type': 'Question',
                name: 'Welche Bereiche werden im Digital-Fitness-Check analysiert?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Der Check analysiert Ihre Online-Präsenz in den Bereichen SEO-Potenzial, Social-Media-Aktivität, Blog-Strategie, Neukundengewinnung und gibt branchenspezifische Benchmarks für Ihren Kanton.',
                },
              },
              {
                '@type': 'Question',
                name: 'Für welche Unternehmen eignet sich der Digital-Fitness-Check?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Der Check eignet sich für alle Schweizer KMUs — von Treuhand und Beratung über IT-Services und Handwerk bis hin zu Gesundheit, Gastronomie und E-Commerce.',
                },
              },
            ],
          }),
        }}
      />
      {children}
    </>
  );
}
