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
          <p className="text-xl md:text-2xl text-white/90 mb-12 leading-relaxed">
            Werkpilot übernimmt Marketing, Sales, Admin und mehr — damit Sie sich auf
            Ihr Kerngeschäft konzentrieren können.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link
              href="/fitness-check"
              className="btn btn-primary text-lg"
              prefetch={true}
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

          {/* Trust Bar */}
          <div className="pt-12 border-t border-white/20">
            <p className="text-white/70 text-sm mb-6">
              Vertrauen von 50+ Schweizer KMUs
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              <div className="w-32 h-12 bg-white/10 rounded flex items-center justify-center text-white text-xs">
                Kunde 1
              </div>
              <div className="w-32 h-12 bg-white/10 rounded flex items-center justify-center text-white text-xs">
                Kunde 2
              </div>
              <div className="w-32 h-12 bg-white/10 rounded flex items-center justify-center text-white text-xs">
                Kunde 3
              </div>
              <div className="w-32 h-12 bg-white/10 rounded flex items-center justify-center text-white text-xs">
                Kunde 4
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
