'use client';

import { motion } from 'framer-motion';

const results = [
  { metric: '+340%', description: 'mehr Website-Traffic' },
  { metric: '+12', description: 'neue Anfragen/Monat' },
  { metric: '20h', description: 'Admin-Arbeit gespart' },
];

const testimonials = [
  {
    quote:
      'Seit Werkpilot haben wir endlich Zeit für das, was wir am besten können: Unsere Kunden beraten.',
    author: 'Thomas Müller',
    company: 'Treuhand Müller AG, Zürich',
  },
  {
    quote:
      'Unser Online-Marketing läuft jetzt komplett automatisiert. Die Anfragen kommen — ohne dass wir uns darum kümmern müssen.',
    author: 'Sandra Weber',
    company: 'Weber Consulting, Bern',
  },
  {
    quote:
      'ROI nach 2 Monaten. Das Team ist professionell, schnell und liefert messbare Resultate.',
    author: 'Michael Schneider',
    company: 'Schneider & Partner, Basel',
  },
];

export default function ResultsSection() {
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
          <h2 style={{ fontFamily: 'var(--font-jakarta)' }}>
            Ergebnisse die für sich sprechen
          </h2>
        </motion.div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 max-w-4xl mx-auto">
          {results.map((result, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="card p-8 text-center"
            >
              <div
                className="text-5xl font-bold mb-3"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-success)' }}
              >
                {result.metric}
              </div>
              <p className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>
                {result.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
              className="card p-8"
            >
              <div className="mb-6">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 18C8 15.7909 9.79086 14 12 14C14.2091 14 16 15.7909 16 18C16 20.2091 14.2091 22 12 22C9.79086 22 8 20.2091 8 18ZM12 14C12 10.6863 9.31371 8 6 8V12C7.10457 12 8 12.8954 8 14H12Z"
                    fill="var(--color-accent)"
                    opacity="0.2"
                  />
                  <path
                    d="M20 18C20 15.7909 21.7909 14 24 14C26.2091 14 28 15.7909 28 18C28 20.2091 26.2091 22 24 22C21.7909 22 20 20.2091 20 18ZM24 14C24 10.6863 21.3137 8 18 8V12C19.1046 12 20 12.8954 20 14H24Z"
                    fill="var(--color-accent)"
                    opacity="0.2"
                  />
                </svg>
              </div>
              <p className="text-lg mb-6" style={{ color: 'var(--color-text)' }}>
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div>
                <p
                  className="font-bold"
                  style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
                >
                  {testimonial.author}
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {testimonial.company}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Case Study Teaser */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 card p-8 max-w-4xl mx-auto"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div
              className="flex-shrink-0 w-32 h-32 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-accent)', opacity: 0.1 }}
            >
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7 21h10m-5-18v18m0-18L5 8m7-5l7 5"
                  stroke="var(--color-accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3
                className="mb-2"
                style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
              >
                Wie Treuhand Müller in 3 Monaten 40% mehr Mandanten gewann
              </h3>
              <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                Fallstudie: Von 5 Anfragen/Monat zu 12 qualifizierten Neukunden durch
                strategisches SEO und Content Marketing.
              </p>
              <a
                href="/blog/case-study-treuhand-mueller"
                className="text-lg font-medium hover:underline inline-flex items-center gap-2"
                style={{ color: 'var(--color-accent)' }}
              >
                Case Study lesen →
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
