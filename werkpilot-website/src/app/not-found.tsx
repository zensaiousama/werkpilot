import { Metadata } from 'next';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Seite nicht gefunden',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <Navigation />
      <main id="main-content" className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-center max-w-md">
          <div
            className="mb-6"
            style={{
              fontSize: '8rem',
              fontFamily: 'var(--font-jakarta)',
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.04em',
              color: 'var(--color-accent)',
              opacity: 0.15,
            }}
          >
            404
          </div>
          <h1
            className="text-3xl font-bold mb-4"
            style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
          >
            Seite nicht gefunden
          </h1>
          <p className="mb-8 text-lg" style={{ color: 'var(--color-text-secondary)' }}>
            Die gesuchte Seite existiert nicht oder wurde verschoben.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/" className="btn btn-primary">
              Zur Startseite &rarr;
            </Link>
            <Link href="/fitness-check" className="btn btn-secondary">
              Fitness-Check starten
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
