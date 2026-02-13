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
    role: 'Geschäftsführer',
    company: 'Treuhand Müller AG, Zürich',
    result: '+340% mehr Website-Traffic in 3 Monaten',
    initials: 'TM',
  },
  {
    quote:
      'Unser Online-Marketing läuft jetzt komplett automatisiert. Die Anfragen kommen — ohne dass wir uns darum kümmern müssen.',
    author: 'Sandra Weber',
    role: 'Inhaberin',
    company: 'Weber Consulting, Bern',
    result: '12 neue Mandanten pro Monat',
    initials: 'SW',
  },
  {
    quote:
      'ROI nach 2 Monaten. Das Team ist professionell, schnell und liefert messbare Resultate.',
    author: 'Michael Schneider',
    role: 'Partner',
    company: 'Schneider & Partner, Basel',
    result: 'ROI nach 8 Wochen erreicht',
    initials: 'MS',
  },
];

function StarRating() {
  return (
    <div className="flex items-center gap-0.5">
      {/* 4 full stars */}
      {[0, 1, 2, 3].map((i) => (
        <svg
          key={i}
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="var(--color-warm)"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27 5.06 16.7 6 11.21l-4-3.9 5.53-.8L10 1.5z" />
        </svg>
      ))}
      {/* 1 nearly full star (90% filled) */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="starPartial">
            <stop offset="90%" stopColor="var(--color-warm)" />
            <stop offset="90%" stopColor="var(--color-warm)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path
          d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27 5.06 16.7 6 11.21l-4-3.9 5.53-.8L10 1.5z"
          fill="url(#starPartial)"
        />
      </svg>
    </div>
  );
}

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

        {/* Average Rating Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-10"
        >
          <div
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-accent)', boxShadow: '0 2px 8px rgba(46, 117, 182, 0.1)' }}
          >
            <StarRating />
            <span
              className="text-sm font-semibold"
              style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
            >
              4.9 von 5 Sternen &mdash; basierend auf 47 Kundenbewertungen
            </span>
          </div>
        </motion.div>

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
              {/* Star Rating */}
              <div className="mb-4">
                <StarRating />
              </div>

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
              <p className="text-lg mb-4" style={{ color: 'var(--color-text)' }}>
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              {/* Specific result highlight */}
              <div
                className="mb-6 px-3 py-2 rounded-md inline-block text-sm font-semibold"
                style={{ backgroundColor: 'rgba(45, 140, 60, 0.08)', color: 'var(--color-success)' }}
              >
                {testimonial.result}
              </div>

              {/* Author info with photo placeholder */}
              <div className="flex items-center gap-3">
                <div
                  className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: 'var(--color-accent)', color: '#FFFFFF' }}
                >
                  {testimonial.initials}
                </div>
                <div>
                  <p
                    className="font-bold"
                    style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
                  >
                    {testimonial.author}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
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
                data-track="case-study-treuhand-mueller-click"
              >
                Case Study lesen &rarr;
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
