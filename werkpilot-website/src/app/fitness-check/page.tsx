'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { motion, AnimatePresence } from 'framer-motion';

const kantons = [
  'Zürich', 'Bern', 'Luzern', 'Uri', 'Schwyz', 'Obwalden', 'Nidwalden', 'Glarus',
  'Zug', 'Freiburg', 'Solothurn', 'Basel-Stadt', 'Basel-Landschaft', 'Schaffhausen',
  'Appenzell Ausserrhoden', 'Appenzell Innerrhoden', 'St. Gallen', 'Graubünden',
  'Aargau', 'Thurgau', 'Tessin', 'Waadt', 'Wallis', 'Neuenburg', 'Genf', 'Jura',
];

const branchen = [
  'Treuhand / Buchhaltung',
  'Beratung / Consulting',
  'IT-Services / Software',
  'Handwerk / Bau',
  'Immobilien',
  'Gesundheit / Medizin',
  'Rechtsberatung',
  'Marketing / Kommunikation',
  'Gastronomie / Hotellerie',
  'Handel / E-Commerce',
  'Andere',
];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ValidationCheck({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span
      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
      style={{ pointerEvents: 'none' }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5 13l4 4L19 7"
          stroke="var(--color-success)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function FitnessCheckPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firmenname: '',
    website: '',
    branche: '',
    kanton: '',
    hasBlog: '',
    usesSocialMedia: '',
    neukunden: '',
    name: '',
    email: '',
    telefon: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessGlow, setShowSuccessGlow] = useState(false);

  const firmennameRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) {
      firmennameRef.current?.focus();
    } else if (step === 3) {
      nameRef.current?.focus();
    }
  }, [step]);

  const handleNext = () => {
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call - in production, send to backend
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // In production: send to Airtable/webhook
    // Form data is ready: formData

    setIsSubmitting(false);
    setShowSuccessGlow(true);
    setTimeout(() => {
      setIsSubmitted(true);
    }, 800);
  };

  if (isSubmitted) {
    return (
      <>
        <Navigation />
        <main id="main-content" className="min-h-screen flex items-center justify-center py-32">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="container mx-auto px-4 max-w-2xl text-center"
          >
            <div
              className="w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-success)', opacity: 0.1 }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 13l4 4L19 7"
                  stroke="var(--color-success)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
              Vielen Dank!
            </h1>
            <p className="text-xl mt-6 mb-12" style={{ color: 'var(--color-text-secondary)' }}>
              Ihr Digital-Fitness-Report wird in den nächsten 24 Stunden per Email zugestellt.
            </p>
            <p className="text-lg mb-8" style={{ color: 'var(--color-text-secondary)' }}>
              Wir analysieren jetzt Ihre Online-Präsenz und erstellen einen massgeschneiderten
              Bericht mit konkreten Verbesserungsvorschlägen.
            </p>
            <Link href="/" className="btn btn-primary">
              Zurück zur Startseite
            </Link>
          </motion.div>
        </main>
        <Footer />
      </>
    );
  }

  const step2AllFilled = formData.hasBlog && formData.usesSocialMedia && formData.neukunden;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes successGlow {
          0% {
            box-shadow: 0 0 0 0 rgba(45, 140, 60, 0.4);
          }
          50% {
            box-shadow: 0 0 20px 10px rgba(45, 140, 60, 0.3);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(45, 140, 60, 0);
          }
        }
        .success-glow {
          animation: successGlow 0.8s ease-out forwards;
          background-color: var(--color-success) !important;
        }
      ` }} />
      <Navigation />
      <main id="main-content" className="min-h-screen py-32" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-12 text-center">
            <h1 style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
              Gratis Digital-Fitness-Check
            </h1>
            <p className="text-xl mt-4" style={{ color: 'var(--color-text-secondary)' }}>
              In 2 Minuten zu Ihrem persönlichen Report
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-12">
            <div className="flex justify-between mb-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                      step >= i
                        ? 'text-white'
                        : 'text-gray-400'
                    }`}
                    style={{
                      backgroundColor: step >= i ? 'var(--color-accent)' : 'var(--color-border)',
                    }}
                  >
                    {i}
                  </div>
                  <span className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {i === 1 ? 'Firma' : i === 2 ? 'Status' : 'Kontakt'}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--color-border)' }}
            >
              <motion.div
                className="h-full"
                style={{ backgroundColor: 'var(--color-accent)' }}
                initial={{ width: '0%' }}
                animate={{ width: `${(step / 3) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="card p-8"
                >
                  <h2 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
                    Über Ihr Unternehmen
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="firmenname">
                        Firmenname *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          id="firmenname"
                          ref={firmennameRef}
                          required
                          value={formData.firmenname}
                          onChange={(e) => setFormData({ ...formData, firmenname: e.target.value })}
                          className="w-full p-3 pr-10 border rounded-lg"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                        <ValidationCheck visible={formData.firmenname.trim().length > 0} />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="website">
                        Website-URL
                      </label>
                      <input
                        type="url"
                        id="website"
                        placeholder="https://ihre-website.ch"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full p-3 border rounded-lg"
                        style={{ borderColor: 'var(--color-border)' }}
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="branche">
                        Branche *
                      </label>
                      <div className="relative">
                        <select
                          id="branche"
                          required
                          value={formData.branche}
                          onChange={(e) => setFormData({ ...formData, branche: e.target.value })}
                          className="w-full p-3 pr-10 border rounded-lg"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <option value="">Bitte wählen...</option>
                          {branchen.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                        <ValidationCheck visible={formData.branche !== ''} />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="kanton">
                        Kanton *
                      </label>
                      <div className="relative">
                        <select
                          id="kanton"
                          required
                          value={formData.kanton}
                          onChange={(e) => setFormData({ ...formData, kanton: e.target.value })}
                          className="w-full p-3 pr-10 border rounded-lg"
                          style={{ borderColor: 'var(--color-border)' }}
                        >
                          <option value="">Bitte wählen...</option>
                          {kantons.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                        <ValidationCheck visible={formData.kanton !== ''} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <button
                      type="button"
                      onClick={handleNext}
                      className="btn btn-primary"
                      data-track="form-step-1-next"
                      disabled={!formData.firmenname || !formData.branche || !formData.kanton}
                    >
                      Weiter &rarr;
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="card p-8"
                >
                  <h2 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
                    Ihre aktuelle Situation
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block mb-3 font-medium">Haben Sie einen Blog? *</label>
                      <div className="space-y-2">
                        {['Ja, aktiv', 'Ja, aber inaktiv', 'Nein'].map((option) => (
                          <label key={option} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="hasBlog"
                              value={option}
                              checked={formData.hasBlog === option}
                              onChange={(e) =>
                                setFormData({ ...formData, hasBlog: e.target.value })
                              }
                              className="w-5 h-5"
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block mb-3 font-medium">Nutzen Sie Social Media? *</label>
                      <div className="space-y-2">
                        {['Ja, regelmässig', 'Ja, sporadisch', 'Nein'].map((option) => (
                          <label key={option} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="usesSocialMedia"
                              value={option}
                              checked={formData.usesSocialMedia === option}
                              onChange={(e) =>
                                setFormData({ ...formData, usesSocialMedia: e.target.value })
                              }
                              className="w-5 h-5"
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block mb-3 font-medium">
                        Wie viele Neukunden gewinnen Sie pro Monat? *
                      </label>
                      <div className="space-y-2">
                        {['0-2', '3-5', '6-10', 'Mehr als 10'].map((option) => (
                          <label key={option} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="neukunden"
                              value={option}
                              checked={formData.neukunden === option}
                              onChange={(e) =>
                                setFormData({ ...formData, neukunden: e.target.value })
                              }
                              className="w-5 h-5"
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Partial Results Teaser */}
                  {step2AllFilled && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="mt-8 p-6 rounded-xl border"
                      style={{
                        borderColor: 'var(--color-accent)',
                        backgroundColor: 'rgba(46, 117, 182, 0.05)',
                      }}
                    >
                      <h3
                        className="text-lg font-bold mb-4 flex items-center gap-2"
                        style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="var(--color-warm)" />
                        </svg>
                        Erste Einblicke
                      </h3>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3">
                          <span
                            className="mt-1 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: 'var(--color-success)' }}
                          >
                            1
                          </span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>
                            Ihre Branche hat ein SEO-Potenzial von <strong style={{ color: 'var(--color-primary)' }}>+200%</strong> für lokale Suchanfragen
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span
                            className="mt-1 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: 'var(--color-success)' }}
                          >
                            2
                          </span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>
                            KMUs in Ihrem Kanton investieren durchschnittlich <strong style={{ color: 'var(--color-primary)' }}>CHF 2&apos;500/Monat</strong> in Marketing
                          </span>
                        </li>
                      </ul>
                      <p className="mt-4 text-sm" style={{ color: 'var(--color-accent)' }}>
                        Für den vollständigen Report mit allen 5 Insights, benötigen wir Ihre Kontaktdaten.
                      </p>
                    </motion.div>
                  )}

                  <div className="mt-8 flex justify-between">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="btn btn-secondary"
                    >
                      &larr; Zurück
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="btn btn-primary"
                      data-track="form-step-2-next"
                      disabled={
                        !formData.hasBlog || !formData.usesSocialMedia || !formData.neukunden
                      }
                    >
                      Weiter &rarr;
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="card p-8"
                >
                  <h2 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
                    Ihre Kontaktdaten
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="name">
                        Name *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          id="name"
                          ref={nameRef}
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full p-3 pr-10 border rounded-lg"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                        <ValidationCheck visible={formData.name.trim().length > 0} />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="email">
                        Email *
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          id="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full p-3 pr-10 border rounded-lg"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                        <ValidationCheck visible={isValidEmail(formData.email)} />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="telefon">
                        Telefon (optional)
                      </label>
                      <input
                        type="tel"
                        id="telefon"
                        placeholder="+41 XX XXX XX XX"
                        value={formData.telefon}
                        onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                        className="w-full p-3 border rounded-lg"
                        style={{ borderColor: 'var(--color-border)' }}
                      />
                    </div>
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Ihre Daten werden vertraulich behandelt und nur zur Erstellung Ihres
                      Digital-Fitness-Reports verwendet. Siehe{' '}
                      <a href="/datenschutz" style={{ color: 'var(--color-accent)' }}>
                        Datenschutzerklärung
                      </a>
                      .
                    </div>
                  </div>
                  <div className="mt-8 flex justify-between items-start">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="btn btn-secondary"
                    >
                      &larr; Zurück
                    </button>
                    <div className="flex flex-col items-end gap-4">
                      <button
                        type="submit"
                        className={`btn btn-primary ${showSuccessGlow ? 'success-glow' : ''}`}
                        data-track="form-submit"
                        disabled={!formData.name || !formData.email || isSubmitting}
                      >
                        {isSubmitting ? 'Wird gesendet...' : showSuccessGlow ? (
                          <span className="flex items-center gap-2">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Gesendet!
                          </span>
                        ) : 'Report anfordern \u2192'}
                      </button>
                      {/* Trust Badges */}
                      <div className="flex flex-wrap gap-3 justify-end">
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--color-success)" strokeWidth="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          Ihre Daten sind verschlüsselt
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18.36 6.64A9 9 0 015.64 18.36M5.64 5.64A9 9 0 0118.36 18.36" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" />
                            <line x1="4" y1="4" x2="20" y2="20" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          Keine Spam-Mails
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="var(--color-success)" strokeWidth="2" />
                            <path d="M12 6v6l4 2" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          Analyse in 24h
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
