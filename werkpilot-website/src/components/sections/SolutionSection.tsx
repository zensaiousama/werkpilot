'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SolutionSection() {
  const [specialists, setSpecialists] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSpecialists((prev) => {
        if (prev < 43) return prev + 1;
        clearInterval(interval);
        return 43;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="section" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="mb-6" style={{ fontFamily: 'var(--font-jakarta)' }}>
            Werkpilot: Ihr komplettes Backoffice — ohne die Kosten eines Teams
          </h2>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 max-w-4xl mx-auto"
        >
          <div className="text-center">
            <div
              className="text-6xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-accent)' }}
            >
              {specialists}
            </div>
            <p className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>
              Spezialisten arbeiten für Sie
            </p>
          </div>
          <div className="text-center">
            <div
              className="text-6xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-accent)' }}
            >
              24/7
            </div>
            <p className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>
              Im Einsatz
            </p>
          </div>
          <div className="text-center">
            <div
              className="text-6xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-accent)' }}
            >
              CHF 1&apos;500
            </div>
            <p className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>
              Ab /Monat
            </p>
          </div>
        </motion.div>

        {/* Package Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            {
              title: 'Kunden gewinnen',
              price: 'CHF 2\'000',
              description: 'SEO, Content, Social Media, Email Marketing',
              link: '/dienstleistungen/kunden-gewinnen',
            },
            {
              title: 'Effizienz',
              price: 'CHF 1\'500',
              description: 'Prozess-Automation, Kommunikation, Reporting',
              link: '/dienstleistungen/effizienz',
            },
            {
              title: 'Wachstum',
              price: 'CHF 5\'000',
              description: 'Alles + Strategie, Analytics, Expansion',
              link: '/dienstleistungen/wachstum',
              featured: true,
            },
          ].map((pkg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
              className={`card p-8 ${pkg.featured ? 'ring-2' : ''}`}
              style={pkg.featured ? { borderColor: 'var(--color-accent)' } : {}}
            >
              {pkg.featured && (
                <div
                  className="text-xs font-bold mb-4 inline-block px-3 py-1 rounded-full"
                  style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
                >
                  BELIEBT
                </div>
              )}
              <h3
                className="mb-2"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
              >
                {pkg.title}
              </h3>
              <div
                className="text-3xl font-bold mb-4"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-accent)' }}
              >
                {pkg.price}
                <span className="text-lg font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                  /Monat
                </span>
              </div>
              <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                {pkg.description}
              </p>
              <Link href={pkg.link} className="btn btn-secondary w-full justify-center">
                Mehr erfahren →
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-12"
        >
          <Link
            href="/dienstleistungen"
            className="text-lg font-medium hover:underline"
            style={{ color: 'var(--color-accent)' }}
          >
            Alle Pakete vergleichen →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
