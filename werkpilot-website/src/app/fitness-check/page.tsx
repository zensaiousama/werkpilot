'use client';

import { useState } from 'react';
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
    setIsSubmitted(true);
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

  return (
    <>
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
                      <input
                        type="text"
                        id="firmenname"
                        required
                        value={formData.firmenname}
                        onChange={(e) => setFormData({ ...formData, firmenname: e.target.value })}
                        className="w-full p-3 border rounded-lg"
                        style={{ borderColor: 'var(--color-border)' }}
                      />
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
                      <select
                        id="branche"
                        required
                        value={formData.branche}
                        onChange={(e) => setFormData({ ...formData, branche: e.target.value })}
                        className="w-full p-3 border rounded-lg"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <option value="">Bitte wählen...</option>
                        {branchen.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="kanton">
                        Kanton *
                      </label>
                      <select
                        id="kanton"
                        required
                        value={formData.kanton}
                        onChange={(e) => setFormData({ ...formData, kanton: e.target.value })}
                        className="w-full p-3 border rounded-lg"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <option value="">Bitte wählen...</option>
                        {kantons.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <button
                      type="button"
                      onClick={handleNext}
                      className="btn btn-primary"
                      disabled={!formData.firmenname || !formData.branche || !formData.kanton}
                    >
                      Weiter →
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
                  <div className="mt-8 flex justify-between">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="btn btn-secondary"
                    >
                      ← Zurück
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="btn btn-primary"
                      disabled={
                        !formData.hasBlog || !formData.usesSocialMedia || !formData.neukunden
                      }
                    >
                      Weiter →
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
                      <input
                        type="text"
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full p-3 border rounded-lg"
                        style={{ borderColor: 'var(--color-border)' }}
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="email">
                        Email *
                      </label>
                      <input
                        type="email"
                        id="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full p-3 border rounded-lg"
                        style={{ borderColor: 'var(--color-border)' }}
                      />
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
                  <div className="mt-8 flex justify-between">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="btn btn-secondary"
                    >
                      ← Zurück
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!formData.name || !formData.email || isSubmitting}
                    >
                      {isSubmitting ? 'Wird gesendet...' : 'Report anfordern →'}
                    </button>
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
