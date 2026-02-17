import Link from 'next/link';
import TimeGreeting from '@/components/TimeGreeting';
import ParticleField from '@/components/ParticleField';
import LiveVisitorCount from '@/components/LiveVisitorCount';

export default function HeroSection() {
  return (
    <section
      className="hero-gradient relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Floating ambient orbs for depth */}
      <div className="hero-orb hero-orb-1" aria-hidden="true" />
      <div className="hero-orb hero-orb-2" aria-hidden="true" />
      <div className="hero-orb hero-orb-3" aria-hidden="true" />
      <ParticleField />

      <div className="container mx-auto px-4 py-32 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <TimeGreeting />

          {/* Social Proof Badge */}
          <div
            className="hero-fade-in inline-flex items-center gap-3 rounded-full px-5 py-2.5 mb-10"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              animationDelay: '0.2s',
            }}
          >
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <svg
                  key={i}
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="#FBBF24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27 5.06 16.7 6 11.21l-4-3.9 5.53-.8L10 1.5z" />
                </svg>
              ))}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', fontWeight: 500 }}>
              4.9/5 &middot; 47+ zufriedene Schweizer KMUs
            </span>
          </div>

          <h1
            className="hero-fade-in"
            style={{ color: '#FFFFFF', animationDelay: '0.4s' }}
          >
            Ihr Unternehmen verdient ein Team,{' '}
            <span className="text-gradient-animated">
              das nie schläft
            </span>
          </h1>

          <p
            className="hero-fade-in text-xl md:text-2xl mb-12 max-w-3xl mx-auto leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.85)', animationDelay: '0.6s' }}
          >
            43 Spezialisten übernehmen Marketing, Sales und Admin —
            damit Sie sich auf Ihr Kerngeschäft konzentrieren können.
            Ab CHF 1&apos;500/Monat.
          </p>

          <div
            className="hero-fade-in flex flex-col sm:flex-row gap-4 justify-center items-center mb-4"
            style={{ animationDelay: '0.8s' }}
          >
            <Link
              href="/fitness-check"
              className="btn btn-primary btn-glow text-lg"
              prefetch={true}
              data-track="cta-hero"
            >
              Gratis Fitness-Check starten &rarr;
            </Link>
            <a
              href="#how-it-works"
              className="text-lg font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              So funktioniert&apos;s &darr;
            </a>
          </div>

          <p
            className="hero-fade-in"
            style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '1rem', marginBottom: '5rem', animationDelay: '1s' }}
          >
            Kostenlos &middot; 2 Minuten &middot; Unverbindlich
          </p>

          {/* Trust stats row */}
          <div
            className="hero-fade-in grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-10"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)', animationDelay: '1.2s' }}
          >
            {[
              { value: '43', label: 'Spezialisten' },
              { value: '24/7', label: 'Im Einsatz' },
              { value: '78%', label: 'Günstiger als intern' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div style={{ fontSize: '2rem', fontFamily: 'var(--font-jakarta)', letterSpacing: '-0.03em', fontWeight: 800, color: '#FFFFFF' }}>
                  {stat.value}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginBottom: 0 }}>{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="hero-fade-in mt-6" style={{ animationDelay: '1.4s' }}>
            <LiveVisitorCount />
          </div>
        </div>
      </div>
    </section>
  );
}
