'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/dienstleistungen', label: 'Dienstleistungen' },
  { href: '/preise', label: 'Preise' },
  { href: '/ueber-uns', label: 'Über uns' },
  { href: '/blog', label: 'Blog' },
  { href: '/resources', label: 'Ressourcen' },
  { href: '/kontakt', label: 'Kontakt' },
];

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 20);
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Focus trap in mobile menu
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isMobileMenuOpen || !mobileMenuRef.current) return;

    if (e.key === 'Escape') {
      setIsMobileMenuOpen(false);
      menuButtonRef.current?.focus();
      return;
    }

    if (e.key === 'Tab') {
      const focusableElements = mobileMenuRef.current.querySelectorAll<HTMLElement>(
        'a[href], button'
      );
      const firstEl = focusableElements[0];
      const lastEl = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  }, [isMobileMenuOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  // Swipe down to close mobile menu
  const touchStartY = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 80) setIsMobileMenuOpen(false); // swipe down > 80px closes menu
  }, []);

  // Close menu on orientation change
  useEffect(() => {
    const handleOrientationChange = () => setIsMobileMenuOpen(false);
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, []);

  const isHomepage = pathname === '/';
  const showLightLinks = isHomepage && !isScrolled && !isMobileMenuOpen;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'shadow-sm'
          : ''
      }`}
      style={{
        backgroundColor: isScrolled
          ? 'var(--color-nav-bg)'
          : 'transparent',
        backdropFilter: isScrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: isScrolled ? 'blur(12px)' : 'none',
        borderBottom: isScrolled ? '1px solid var(--color-border)' : 'none',
      }}
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
            <span style={{ color: showLightLinks ? '#FFFFFF' : 'var(--color-primary)' }}>
              Werkpilot
            </span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect x="8" y="2" width="4" height="7" fill="var(--color-warm)" />
              <rect x="2" y="8" width="7" height="4" fill="var(--color-warm)" />
              <rect x="11" y="8" width="7" height="4" fill="var(--color-warm)" />
              <rect x="8" y="11" width="4" height="7" fill="var(--color-warm)" />
            </svg>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link text-sm font-medium transition-colors"
                style={{
                  color: showLightLinks ? 'rgba(255,255,255,0.85)' : 'var(--color-text)',
                }}
                aria-current={pathname === link.href ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
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
            ref={menuButtonRef}
            className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Menü schliessen' : 'Menü öffnen'}
            aria-expanded={isMobileMenuOpen}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {isMobileMenuOpen ? (
                <path
                  d="M6 18L18 6M6 6l12 12"
                  stroke={showLightLinks ? '#FFFFFF' : 'var(--color-primary)'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M3 12h18M3 6h18M3 18h18"
                  stroke={showLightLinks ? '#FFFFFF' : 'var(--color-primary)'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu — Fullscreen Overlay */}
        {isMobileMenuOpen && (
          <div
            ref={mobileMenuRef}
            className="fixed inset-0 top-0 z-40 flex flex-col items-center justify-center mobile-menu-overlay md:hidden"
            style={{ backgroundColor: '#0F172A' }}
            role="menu"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Close button inside overlay */}
            <button
              className="absolute top-6 right-4 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Menü schliessen"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M6 18L18 6M6 6l12 12" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="flex flex-col items-center gap-6">
              {navLinks.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="mobile-nav-item text-2xl font-semibold text-white/90 hover:text-white transition-colors"
                  style={{ animationDelay: `${index * 60}ms` }}
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-current={pathname === link.href ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/fitness-check"
                className="mobile-nav-item btn btn-primary mt-4 text-lg"
                style={{ animationDelay: `${navLinks.length * 60}ms` }}
                onClick={() => setIsMobileMenuOpen(false)}
                data-track="cta-nav-mobile"
              >
                Gratis Fitness-Check &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
