import Link from 'next/link';

export default function HeroSection() {
  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden grain-texture"
      style={{
        background: 'linear-gradient(135deg, #1B2A4A 0%, #2E75B6 100%)',
      }}
    >
      <div className="container mx-auto px-4 py-32 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-white mb-6" style={{ fontFamily: 'var(--font-jakarta)' }}>
            Ihr Unternehmen verdient ein Team, das nie schläft.
          </h1>

          {/* Loss aversion subheadline (Cialdini: Scarcity / Loss Framing) */}
          <p
            className="text-lg md:text-xl text-amber-300 font-semibold mb-4"
            style={{ fontFamily: 'var(--font-dm-sans)', color: '#D4760A' }}
            data-variant="loss-aversion"
          >
            Jeden Tag ohne Online-Präsenz verlieren Sie potenzielle Kunden
          </p>

          <p
            className="text-xl md:text-2xl text-white/90 mb-12 leading-relaxed"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Werkpilot übernimmt Marketing, Sales, Admin und mehr — damit Sie sich auf
            Ihr Kerngeschäft konzentrieren können.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
            <Link
              href="/fitness-check"
              className="btn btn-primary text-lg"
              prefetch={true}
              data-track="cta-hero"
            >
              Gratis Digital-Fitness-Check starten →
            </Link>
            <a
              href="#how-it-works"
              className="text-white text-lg font-medium hover:text-white/80 transition-colors"
            >
              So funktioniert&apos;s ↓
            </a>
          </div>

          {/* Micro-commitment text (Cialdini: Commitment & Consistency) */}
          <p
            className="text-white/60 text-sm mb-16"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Keine Kreditkarte erforderlich
          </p>

          {/* Social Proof: Specific client counter (Cialdini: Social Proof + Authority) */}
          <div className="pt-12 border-t border-white/20">
            <p
              className="text-white/90 text-sm font-semibold mb-6"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              47 Schweizer KMUs vertrauen bereits auf Werkpilot
            </p>
            <div className="flex flex-wrap justify-center items-center gap-6 opacity-70">
              <div className="w-36 h-12 bg-white/10 rounded flex items-center justify-center text-white text-xs font-medium">
                Treuhand Müller AG
              </div>
              <div className="w-36 h-12 bg-white/10 rounded flex items-center justify-center text-white text-xs font-medium">
                Zahnarztpraxis Bern
              </div>
              <div className="w-36 h-12 bg-white/10 rounded flex items-center justify-center text-white text-xs font-medium">
                Immobilien Zürich
              </div>
              <div className="w-36 h-12 bg-white/10 rounded flex items-center justify-center text-white text-xs font-medium">
                Autohaus Luzern
              </div>
              <div className="w-36 h-12 bg-white/10 rounded flex items-center justify-center text-white text-xs font-medium">
                Schreinerei Aargau
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animated gradient mesh */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(circle at 20% 50%, rgba(45, 140, 60, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(212, 118, 10, 0.3) 0%, transparent 50%)',
        }}
      />
    </section>
  );
}
