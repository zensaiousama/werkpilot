import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kontakt — Werkpilot',
  description:
    'Kontaktieren Sie Werkpilot für Fragen zu unseren Dienstleistungen. Email, Telefon oder Kontaktformular. Wir antworten innerhalb von 24 Stunden.',
  openGraph: {
    title: 'Kontakt — Werkpilot',
    description: 'Wir freuen uns auf Ihre Nachricht.',
  },
  alternates: {
    canonical: 'https://werkpilot.ch/kontakt',
  },
};

export default function KontaktLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
