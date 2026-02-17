'use client';

import { useState, useEffect, useRef } from 'react';
import AnimatedSection from '@/components/AnimatedSection';
import BeforeAfter from '@/components/BeforeAfter';

const results = [
  { end: 340, prefix: '+', suffix: '%', description: 'mehr Website-Traffic', color: '#059669' },
  { end: 12, prefix: '+', suffix: '', description: 'neue Anfragen/Monat', color: '#2563EB' },
  { end: 20, prefix: '', suffix: 'h', description: 'Admin-Arbeit gespart/Woche', color: 'var(--color-primary)' },
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
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="#FBBF24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27 5.06 16.7 6 11.21l-4-3.9 5.53-.8L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}

function AnimatedCounter({ end, prefix, suffix, color }: { end: number; prefix: string; suffix: string; color: string }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 2000;
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * end));
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, hasAnimated]);

  return (
    <div
      ref={ref}
      className="mb-3"
      style={{
        fontSize: '3.75rem',
        fontFamily: 'var(--font-jakarta)',
        color,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: '-0.04em',
        minHeight: '3.75rem',
      }}
    >
      {prefix}{count}{suffix}
    </div>
  );
}

export default function ResultsSection() {
  return (
    <section className="section" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
      <div className="container mx-auto px-4">
        <AnimatedSection className="text-center mb-16">
          <h2>Ergebnisse, die für sich sprechen</h2>
          <p
            className="text-lg mt-4 max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Durchschnittliche Resultate unserer Kunden nach 3 Monaten
          </p>
        </AnimatedSection>

        {/* Metrics with animated counters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 max-w-4xl mx-auto">
          {results.map((result, index) => (
            <AnimatedSection
              key={index}
              delay={index * 100}
              className="card p-10 text-center"
            >
              <AnimatedCounter
                end={result.end}
                prefix={result.prefix}
                suffix={result.suffix}
                color={result.color}
              />
              <p className="text-base font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {result.description}
              </p>
            </AnimatedSection>
          ))}
        </div>

        {/* Rating Badge */}
        <AnimatedSection className="flex justify-center mb-12">
          <div
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <StarRating />
            <span
              className="text-sm font-semibold"
              style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
            >
              4.9 von 5 Sternen &mdash; 47 Kundenbewertungen
            </span>
          </div>
        </AnimatedSection>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <AnimatedSection
              key={index}
              delay={400 + index * 100}
              className="card p-8"
            >
              <div className="mb-4">
                <StarRating />
              </div>

              <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--color-text)' }}>
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              {/* Result highlight */}
              <div
                className="mb-6 px-3 py-2 rounded-md inline-block text-sm font-semibold"
                style={{ backgroundColor: 'rgba(5, 150, 105, 0.08)', color: 'var(--color-success)' }}
              >
                {testimonial.result}
              </div>

              {/* Author info */}
              <div className="flex items-center gap-3">
                <div
                  className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: 'var(--color-accent)', color: '#FFFFFF' }}
                >
                  {testimonial.initials}
                </div>
                <div>
                  <p
                    className="font-bold text-sm"
                    style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
                  >
                    {testimonial.author}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection className="mt-16" delay={600}>
          <h3 className="text-center mb-8" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
            Vorher vs. Nachher
          </h3>
          <BeforeAfter />
        </AnimatedSection>
      </div>
    </section>
  );
}
