'use client';

import { useState } from 'react';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const contactMethods = [
  {
    icon: '📧',
    title: 'Email',
    detail: 'info@werkpilot.ch',
    link: 'mailto:info@werkpilot.ch',
  },
  {
    icon: '📞',
    title: 'Telefon',
    detail: '+41 44 555 50 00',
    link: 'tel:+41445555000',
  },
  {
    icon: '💬',
    title: 'LinkedIn',
    detail: 'Folgen Sie uns',
    link: 'https://linkedin.com/company/werkpilot',
  },
];

export default function KontaktPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    // In production, you would send this to your backend
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitStatus('success');
      setFormData({
        name: '',
        email: '',
        company: '',
        phone: '',
        message: '',
      });
    }, 1500);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <>
      <Navigation />
      <main id="main-content">
        {/* Hero Section */}
        <section
          className="pt-32 pb-20"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1
                className="text-5xl md:text-6xl font-bold mb-6"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Kontaktieren Sie uns
              </h1>
              <p
                className="text-xl mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Haben Sie Fragen zu unseren Dienstleistungen? Möchten Sie eine
                persönliche Demo? Wir freuen uns, von Ihnen zu hören.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Methods */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                {contactMethods.map((method, idx) => (
                  <a
                    key={idx}
                    href={method.link}
                    target={method.link.startsWith('http') ? '_blank' : undefined}
                    rel={method.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="card p-8 text-center hover:shadow-lg transition-shadow"
                    style={{ backgroundColor: 'var(--color-bg)' }}
                  >
                    <div
                      className="text-4xl mb-4"
                      role="img"
                      aria-label={method.title}
                    >
                      {method.icon}
                    </div>
                    <h3
                      className="text-lg font-bold mb-2"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {method.title}
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      {method.detail}
                    </p>
                  </a>
                ))}
              </div>

              {/* Contact Form */}
              <div className="max-w-2xl mx-auto">
                <div
                  className="card p-8"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <h2
                    className="text-2xl font-bold mb-6 text-center"
                    style={{
                      fontFamily: 'var(--font-jakarta)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    Nachricht senden
                  </h2>

                  {submitStatus === 'success' && (
                    <div
                      className="p-4 rounded-lg mb-6"
                      style={{
                        backgroundColor: 'var(--color-success)',
                        color: 'white',
                      }}
                      role="alert"
                    >
                      Vielen Dank! Wir melden uns innerhalb von 24 Stunden bei Ihnen.
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    <div className="space-y-6">
                      <div>
                        <label
                          htmlFor="name"
                          className="block text-sm font-medium mb-2"
                          style={{ color: 'var(--color-text)' }}
                        >
                          Name *
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          className="w-full p-3 rounded-lg border"
                          style={{
                            borderColor: 'var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text)',
                          }}
                          placeholder="Ihr vollständiger Name"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="email"
                          className="block text-sm font-medium mb-2"
                          style={{ color: 'var(--color-text)' }}
                        >
                          Email *
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full p-3 rounded-lg border"
                          style={{
                            borderColor: 'var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text)',
                          }}
                          placeholder="ihre@email.ch"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="company"
                          className="block text-sm font-medium mb-2"
                          style={{ color: 'var(--color-text)' }}
                        >
                          Unternehmen
                        </label>
                        <input
                          type="text"
                          id="company"
                          name="company"
                          value={formData.company}
                          onChange={handleChange}
                          className="w-full p-3 rounded-lg border"
                          style={{
                            borderColor: 'var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text)',
                          }}
                          placeholder="Ihr Unternehmen (optional)"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="phone"
                          className="block text-sm font-medium mb-2"
                          style={{ color: 'var(--color-text)' }}
                        >
                          Telefon
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className="w-full p-3 rounded-lg border"
                          style={{
                            borderColor: 'var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text)',
                          }}
                          placeholder="+41 79 123 45 67 (optional)"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="message"
                          className="block text-sm font-medium mb-2"
                          style={{ color: 'var(--color-text)' }}
                        >
                          Nachricht *
                        </label>
                        <textarea
                          id="message"
                          name="message"
                          required
                          value={formData.message}
                          onChange={handleChange}
                          rows={6}
                          className="w-full p-3 rounded-lg border resize-none"
                          style={{
                            borderColor: 'var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text)',
                          }}
                          placeholder="Wie können wir Ihnen helfen?"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn btn-primary w-full justify-center"
                        style={{
                          opacity: isSubmitting ? 0.6 : 1,
                          cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isSubmitting ? 'Wird gesendet...' : 'Nachricht senden'}
                      </button>

                      <p
                        className="text-xs text-center"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Mit dem Absenden stimmen Sie unserer{' '}
                        <a
                          href="/datenschutz"
                          className="underline hover:opacity-70"
                          style={{ color: 'var(--color-accent)' }}
                        >
                          Datenschutzerklärung
                        </a>{' '}
                        zu.
                      </p>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Office Info */}
        <section className="py-20" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2
                className="text-3xl font-bold mb-12 text-center"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Unser Standort
              </h2>

              <div
                className="card p-8"
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3
                      className="text-xl font-bold mb-4"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      Werkpilot
                    </h3>
                    <p
                      className="text-sm mb-6"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Schweizer Einzelfirma
                      <br />
                      Eingetragen im Handelsregister
                      <br />
                      Zürich, Schweiz
                    </p>

                    <h4
                      className="font-bold text-sm mb-2"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      Öffnungszeiten Support
                    </h4>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Montag - Freitag: 8:00 - 18:00 Uhr
                      <br />
                      Samstag: 9:00 - 15:00 Uhr
                      <br />
                      <span className="font-medium">
                        Automatisierte Systeme: 24/7
                      </span>
                    </p>
                  </div>

                  <div>
                    <h4
                      className="font-bold text-sm mb-3"
                      style={{
                        fontFamily: 'var(--font-jakarta)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      Antwortzeiten
                    </h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        >
                          <path
                            d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                            fill="var(--color-success)"
                          />
                        </svg>
                        <span
                          className="text-sm"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Email: Innerhalb von 24 Stunden
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        >
                          <path
                            d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                            fill="var(--color-success)"
                          />
                        </svg>
                        <span
                          className="text-sm"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Telefon: Während Geschäftszeiten
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        >
                          <path
                            d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"
                            fill="var(--color-success)"
                          />
                        </svg>
                        <span
                          className="text-sm"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Dringende Anliegen: Innerhalb von 4 Stunden
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="py-20"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2
                className="text-3xl font-bold mb-6"
                style={{
                  fontFamily: 'var(--font-jakarta)',
                  color: 'var(--color-primary)',
                }}
              >
                Lieber erst testen?
              </h2>
              <p
                className="text-lg mb-8"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Machen Sie unseren kostenlosen Fitness-Check und erhalten Sie eine
                persönliche Empfehlung für Ihr Unternehmen.
              </p>
              <a href="/fitness-check" className="btn btn-primary">
                Gratis Fitness-Check starten →
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
