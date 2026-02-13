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
          <h2 className="text-white mb-6" style={{ fontFamily: 'var(--font-jakarta)' }}>
            Bereit für mehr Kunden und weniger Stress?
          </h2>
          <p className="text-xl text-white/90 mb-12 leading-relaxed">
            Starten Sie mit einem gratis Digital-Fitness-Check
          </p>

          <Link href="/fitness-check" className="btn btn-primary text-lg mb-6 inline-block">
            Jetzt kostenlos starten →
          </Link>

          <p className="text-white/70 text-sm">
            Unverbindlich. In 2 Minuten erledigt.
          </p>
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
