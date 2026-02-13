import Link from 'next/link';

export default function Footer() {
  return (
    <footer
      className="border-t"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Company Info */}
          <div className="md:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-bold mb-4"
              style={{ fontFamily: 'var(--font-jakarta)' }}
            >
              <span style={{ color: 'var(--color-primary)' }}>Werkpilot</span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect x="8" y="2" width="4" height="7" fill="#D4760A" />
                <rect x="2" y="8" width="7" height="4" fill="#D4760A" />
                <rect x="11" y="8" width="7" height="4" fill="#D4760A" />
                <rect x="8" y="11" width="4" height="7" fill="#D4760A" />
              </svg>
            </Link>
            <p
              className="text-sm mb-4 max-w-md"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Das Betriebssystem für Schweizer KMUs. Mehr Kunden. Weniger Admin.
              Ihr virtuelles Backoffice.
            </p>
            <p
              className="text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Ein Schweizer Unternehmen. Eingetragen als Einzelfirma.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3
              className="font-bold mb-4 text-sm"
              style={{
                fontFamily: 'var(--font-jakarta)',
                color: 'var(--color-primary)',
              }}
            >
              Navigation
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/dienstleistungen"
                  className="text-sm hover:text-[var(--color-accent)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Dienstleistungen
                </Link>
              </li>
              <li>
                <Link
                  href="/preise"
                  className="text-sm hover:text-[var(--color-accent)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Preise
                </Link>
              </li>
              <li>
                <Link
                  href="/ueber-uns"
                  className="text-sm hover:text-[var(--color-accent)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Über uns
                </Link>
              </li>
              <li>
                <Link
                  href="/resources"
                  className="text-sm hover:text-[var(--color-accent)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Ressourcen
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-sm hover:text-[var(--color-accent)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/kontakt"
                  className="text-sm hover:text-[var(--color-accent)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Kontakt
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Legal */}
          <div>
            <h3
              className="font-bold mb-4 text-sm"
              style={{
                fontFamily: 'var(--font-jakarta)',
                color: 'var(--color-primary)',
              }}
            >
              Kontakt
            </h3>
            <ul className="space-y-2 mb-6">
              <li>
                <a
                  href="mailto:info@werkpilot.ch"
                  className="text-sm hover:text-[var(--color-accent)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  info@werkpilot.ch
                </a>
              </li>
              <li>
                <a
                  href="tel:+41445555000"
                  className="text-sm hover:text-[var(--color-accent)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  +41 44 555 50 00
                </a>
              </li>
            </ul>

            <h3
              className="font-bold mb-4 text-sm"
              style={{
                fontFamily: 'var(--font-jakarta)',
                color: 'var(--color-primary)',
              }}
            >
              Rechtliches
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/impressum"
                  className="text-sm hover:text-[var(--color-accent)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Impressum
                </Link>
              </li>
              <li>
                <Link
                  href="/datenschutz"
                  className="text-sm hover:text-[var(--color-accent)] transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Datenschutz
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Trust Signals */}
        <div
          className="py-6 border-t flex flex-wrap justify-center gap-6"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            SSL verschl&uuml;sselt
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            DSGVO &amp; DSG konform
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Daten in der Schweiz
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            100% Schweizer Unternehmen
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              &copy; 2026 Werkpilot. Alle Rechte vorbehalten.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://linkedin.com/company/werkpilot"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-70 transition-opacity"
                aria-label="Werkpilot auf LinkedIn"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="var(--color-text-secondary)"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
