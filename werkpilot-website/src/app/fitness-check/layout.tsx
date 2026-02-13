import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gratis Digital-Fitness-Check — Werkpilot',
  description:
    'Kostenlose Analyse Ihrer Online-Präsenz. In 2 Minuten zu Ihrem persönlichen Report mit konkreten Verbesserungsvorschlägen.',
};

export default function FitnessCheckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
