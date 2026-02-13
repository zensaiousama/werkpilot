'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm'
          : 'bg-transparent'
      }`}
      role="navigation"
      aria-label="Hauptnavigation"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold"
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

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/dienstleistungen"
              className="text-sm font-medium hover:text-[var(--color-accent)] transition-colors"
              style={{ color: 'var(--color-text)' }}
            >
              Dienstleistungen
            </Link>
            <Link
              href="/preise"
              className="text-sm font-medium hover:text-[var(--color-accent)] transition-colors"
              style={{ color: 'var(--color-text)' }}
            >
              Preise
            </Link>
            <Link
              href="/ueber-uns"
              className="text-sm font-medium hover:text-[var(--color-accent)] transition-colors"
              style={{ color: 'var(--color-text)' }}
            >
              Über uns
            </Link>
            <Link
              href="/blog"
              className="text-sm font-medium hover:text-[var(--color-accent)] transition-colors"
              style={{ color: 'var(--color-text)' }}
            >
              Blog
            </Link>
            <Link
              href="/resources"
              className="text-sm font-medium hover:text-[var(--color-accent)] transition-colors"
              style={{ color: 'var(--color-text)' }}
            >
              Ressourcen
            </Link>
            <Link
              href="/kontakt"
              className="text-sm font-medium hover:text-[var(--color-accent)] transition-colors"
              style={{ color: 'var(--color-text)' }}
            >
              Kontakt
            </Link>
            <Link
              href="/fitness-check"
              className="btn btn-primary text-sm"
              aria-label="Gratis Fitness-Check starten"
              data-track="cta-nav"
            >
              Gratis Fitness-Check &rarr;
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Menü öffnen"
            aria-expanded={isMobileMenuOpen}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {isMobileMenuOpen ? (
                <>
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : (
                <>
                  <path
                    d="M3 12h18M3 6h18M3 18h18"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden pb-6 space-y-4"
            role="menu"
          >
            <Link
              href="/dienstleistungen"
              className="block py-2 text-base font-medium hover:text-[var(--color-accent)] transition-colors"
              style={{ color: 'var(--color-text)' }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Dienstleistungen
            </Link>
            <Link
              href="/preise"
              className="block py-2 text-base font-medium hover:text-[var(--color-accent)] transition-colors"
              style={{ color: 'var(--color-text)' }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Preise
            </Link>
            <Link
              href="/ueber-uns"
              className="block py-2 text-base font-medium hover:text-[var(--color-accent)] transition-colors"
              style={{ color: 'var(--color-text)' }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Über uns
            </Link>
            <Link
              href="/blog"
              className="block py-2 text-base font-medium hover:text-[var(--color-accent)] transition-colors"
              style={{ color: 'var(--color-text)' }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Blog
            </Link>
            <Link
              href="/resources"
              className="block py-2 text-base font-medium hover:text-[var(--color-accent)] transition-colors"
              style={{ color: 'var(--color-text)' }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Ressourcen
            </Link>
            <Link
              href="/kontakt"
              className="block py-2 text-base font-medium hover:text-[var(--color-accent)] transition-colors"
              style={{ color: 'var(--color-text)' }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Kontakt
            </Link>
            <Link
              href="/fitness-check"
              className="btn btn-primary inline-block mt-4"
              onClick={() => setIsMobileMenuOpen(false)}
              data-track="cta-nav-mobile"
            >
              Gratis Fitness-Check &rarr;
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
