'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function FinalCTASection() {
  return (
    <section
      className="section relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1B2A4A 0%, #2E75B6 100%)',
      }}
    >
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          {/* Scarcity badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2 mb-6"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            <span className="text-white/90 text-sm font-medium">
              Aktuell 2 Plätze frei
            </span>
          </motion.div>

          <h2 className="text-white mb-4" style={{ fontFamily: 'var(--font-jakarta)' }}>
            Bereit für mehr Kunden und weniger Stress?
          </h2>

          <p className="text-white/80 text-sm mb-6 font-medium tracking-wide">
            Wir nehmen nur 5 neue Kunden pro Monat auf
          </p>

          <p className="text-xl text-white/90 mb-8 leading-relaxed">
            Starten Sie mit einem gratis Digital-Fitness-Check
          </p>

          {/* Comparison anchor */}
          <p className="text-white/70 text-sm mb-8">
            Ein Marketing-Team kostet CHF 7&apos;000/Monat. Werkpilot ab CHF 1&apos;500.
          </p>

          <Link
            href="/fitness-check"
            className="btn btn-primary text-lg mb-6 inline-block"
            data-track="cta-final"
          >
            Jetzt kostenlos starten →
          </Link>

          {/* Trust micro-badges */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-6">
            {[
              'Keine Kreditkarte',
              '2 Minuten',
              '100% kostenlos',
              'Unverbindlich',
            ].map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 text-white/70 text-sm"
              >
                <svg
                  className="w-4 h-4 text-green-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {label}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Decorative elements */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(circle at 20% 50%, rgba(212, 118, 10, 0.4) 0%, transparent 50%), radial-gradient(circle at 80% 30%, rgba(45, 140, 60, 0.4) 0%, transparent 50%)',
        }}
      />
    </section>
  );
}
