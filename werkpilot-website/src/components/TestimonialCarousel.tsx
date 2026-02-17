'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * TestimonialCarousel — Client component
 * Auto-playing testimonial slider with Swiss business owner reviews.
 * Supports auto-advance, pause-on-hover, dot navigation, and touch swipe.
 */

interface Testimonial {
  name: string;
  company: string;
  role: string;
  location: string;
  rating: number;
  text: string;
  initials: string;
  color: string;
}

const testimonials: Testimonial[] = [
  {
    name: 'Thomas Weber',
    company: 'Weber Treuhand AG',
    role: 'Geschäftsführer',
    location: 'Zürich',
    rating: 5.0,
    text: 'Seit wir mit Werkpilot arbeiten, hat sich unsere Mandantengewinnung verdreifacht. Die Automatisierung spart uns jede Woche 15 Stunden administrative Arbeit. Absolut empfehlenswert für jede Treuhand.',
    initials: 'WT',
    color: '#2563EB',
  },
  {
    name: 'Sandra Meier',
    company: 'Meier Immobilien GmbH',
    role: 'Inhaberin',
    location: 'Bern',
    rating: 4.9,
    text: 'In nur 3 Monaten haben wir 28 qualifizierte Leads generiert — mehr als im ganzen letzten Jahr. Der ROI war schon nach 6 Wochen positiv. Das Team versteht wirklich, was KMUs brauchen.',
    initials: 'MI',
    color: '#059669',
  },
  {
    name: 'Markus Brunner',
    company: 'Brunner Architektur',
    role: 'Partner',
    location: 'Basel',
    rating: 5.0,
    text: 'Werkpilot hat unsere Online-Präsenz komplett transformiert. Wir erhalten jetzt regelmässig Anfragen von genau den Kunden, die wir wollen. Professionell, transparent und ergebnisorientiert.',
    initials: 'BA',
    color: '#D97706',
  },
  {
    name: 'Lisa Hofmann',
    company: 'Hofmann Consulting',
    role: 'CEO',
    location: 'Luzern',
    rating: 4.8,
    text: 'Endlich ein Partner, der versteht, wie digitales Marketing für Schweizer KMUs funktioniert. Keine leeren Versprechen, sondern messbare Resultate. Unsere Website-Anfragen sind um 180% gestiegen.',
    initials: 'HC',
    color: '#7C3AED',
  },
  {
    name: 'Daniel Keller',
    company: 'Keller & Partner Recht',
    role: 'Gründer',
    location: 'St. Gallen',
    rating: 5.0,
    text: 'Als Anwaltskanzlei waren wir skeptisch gegenüber digitalem Marketing. Werkpilot hat uns vom Gegenteil überzeugt. 12 neue Mandanten im ersten Quartal — das spricht für sich.',
    initials: 'KP',
    color: '#DC2626',
  },
];

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;

  return (
    <div className="flex items-center gap-1" aria-label={`${rating} von 5 Sternen`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <svg
            key={i}
            width="16"
            height="16"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {i < fullStars ? (
              <path
                d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27 5.06 16.7 6 11.21l-4-3.9 5.53-.8L10 1.5z"
                fill="#FBBF24"
              />
            ) : i === fullStars && hasHalf ? (
              <>
                <defs>
                  <linearGradient id={`half-star-${i}`}>
                    <stop offset="50%" stopColor="#FBBF24" />
                    <stop offset="50%" stopColor="#D1D5DB" />
                  </linearGradient>
                </defs>
                <path
                  d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27 5.06 16.7 6 11.21l-4-3.9 5.53-.8L10 1.5z"
                  fill={`url(#half-star-${i})`}
                />
              </>
            ) : (
              <path
                d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27 5.06 16.7 6 11.21l-4-3.9 5.53-.8L10 1.5z"
                fill="#D1D5DB"
              />
            )}
          </svg>
        ))}
      </div>
      <span
        className="text-sm font-semibold ml-1"
        style={{ color: 'var(--color-text)' }}
      >
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

export default function TestimonialCarousel() {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const goTo = useCallback(
    (index: number) => {
      setDirection(index > active ? 'right' : 'left');
      setActive(index);
    },
    [active],
  );

  const goNext = useCallback(() => {
    setDirection('right');
    setActive((prev) => (prev + 1) % testimonials.length);
  }, []);

  const goPrev = useCallback(() => {
    setDirection('left');
    setActive((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, []);

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (isPaused) return;

    intervalRef.current = setInterval(goNext, 5000);
    return () => clearInterval(intervalRef.current);
  }, [isPaused, goNext]);

  // Touch events for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  const t = testimonials[active];

  return (
    <section className="py-20" style={{ background: 'var(--color-surface-alt)' }}>
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-12">
          <span
            className="inline-block text-sm font-semibold uppercase tracking-wider mb-3 px-4 py-1.5 rounded-full"
            style={{
              color: 'var(--color-accent)',
              background: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid rgba(37, 99, 235, 0.15)',
            }}
          >
            Kundenstimmen
          </span>
          <h2 style={{ color: 'var(--color-text)' }}>
            Was unsere Kunden sagen
          </h2>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Echte Resultate von Schweizer KMUs, die mit Werkpilot wachsen
          </p>
        </div>

        {/* Carousel */}
        <div
          className="max-w-3xl mx-auto"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="region"
          aria-roledescription="carousel"
          aria-label="Kundenstimmen"
        >
          {/* Card */}
          <div
            className="relative rounded-2xl p-8 md:p-10 overflow-hidden"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-xl)',
              minHeight: '320px',
            }}
          >
            {/* Decorative quote mark */}
            <svg
              className="absolute top-6 right-8 opacity-5"
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="var(--color-text)"
              aria-hidden="true"
            >
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>

            {/* Content with slide animation */}
            <div
              key={active}
              className="relative z-10"
              style={{
                animation: `slideIn${direction === 'right' ? 'Right' : 'Left'} 0.4s ease-out`,
              }}
            >
              {/* Rating */}
              <div className="mb-6">
                <StarRating rating={t.rating} />
              </div>

              {/* Testimonial text */}
              <blockquote className="mb-8">
                <p
                  className="text-lg md:text-xl leading-relaxed"
                  style={{
                    color: 'var(--color-text)',
                    fontStyle: 'italic',
                    fontWeight: 500,
                    lineHeight: 1.7,
                  }}
                >
                  &ldquo;{t.text}&rdquo;
                </p>
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-4">
                {/* Initials avatar */}
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: t.color }}
                  aria-hidden="true"
                >
                  {t.initials}
                </div>
                <div>
                  <div
                    className="font-bold text-base"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {t.name}
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {t.role}, {t.company} &middot; {t.location}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation arrows + dots */}
          <div className="flex items-center justify-center gap-6 mt-8">
            {/* Prev arrow */}
            <button
              onClick={goPrev}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
              aria-label="Vorheriges Testimonial"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Dot indicators */}
            <div className="flex items-center gap-2" role="tablist" aria-label="Testimonial Navigation">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="transition-all duration-300"
                  style={{
                    width: i === active ? '24px' : '8px',
                    height: '8px',
                    borderRadius: '4px',
                    background:
                      i === active
                        ? 'var(--color-accent)'
                        : 'var(--color-border)',
                  }}
                  role="tab"
                  aria-selected={i === active}
                  aria-label={`Testimonial ${i + 1} von ${testimonials.length}`}
                />
              ))}
            </div>

            {/* Next arrow */}
            <button
              onClick={goNext}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
              aria-label="Nächstes Testimonial"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Slide animations */}
      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </section>
  );
}
