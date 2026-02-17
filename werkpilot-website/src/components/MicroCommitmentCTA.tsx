'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

/**
 * MicroCommitmentCTA — Client component
 * Low-friction CTA that walks the user through easy questions
 * before delivering a personalized recommendation + CTA.
 */

type EmployeeSize = '1-5' | '6-20' | '20+';
type Industry = 'treuhand' | 'immobilien' | 'gesundheit' | 'andere';

interface StepConfig {
  employeeSize: EmployeeSize | null;
  industry: Industry | null;
}

const industryLabels: Record<Industry, string> = {
  treuhand: 'Treuhand & Beratung',
  immobilien: 'Immobilien',
  gesundheit: 'Gesundheit & Praxis',
  andere: 'Andere Branche',
};

const industryIcons: Record<Industry, string> = {
  treuhand: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  immobilien: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4',
  gesundheit: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  andere: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
};

function getRecommendation(size: EmployeeSize, industry: Industry): { headline: string; body: string } {
  const industryName = industryLabels[industry];

  if (size === '1-5') {
    return {
      headline: `Perfekt für kleine ${industryName}-Unternehmen`,
      body: `Als kleines Team profitieren Sie besonders von Automatisierung. Werkpilot übernimmt Ihr Marketing, damit Sie sich auf Ihre Kunden konzentrieren können. KMUs Ihrer Grösse gewinnen im Schnitt 8 neue Kunden pro Monat.`,
    };
  }

  if (size === '6-20') {
    return {
      headline: `Ideal für wachsende ${industryName}-Betriebe`,
      body: `Mit 6-20 Mitarbeitern stehen Sie an einem Wendepunkt. Werkpilot skaliert Ihr Marketing mit, ohne dass Sie ein internes Team aufbauen müssen. Ähnliche Unternehmen sparen CHF 5'000/Monat gegenüber einer Agentur.`,
    };
  }

  return {
    headline: `Massgeschneidert für etablierte ${industryName}-Unternehmen`,
    body: `Für Unternehmen Ihrer Grösse bieten wir Enterprise-Lösungen mit dediziertem Account Manager. Unsere grösseren Kunden steigern ihren Umsatz im Schnitt um 35% innerhalb von 6 Monaten.`,
  };
}

export default function MicroCommitmentCTA() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<StepConfig>({
    employeeSize: null,
    industry: null,
  });

  const handleSizeSelect = useCallback((size: EmployeeSize) => {
    setConfig((prev) => ({ ...prev, employeeSize: size }));
    setStep(1);
  }, []);

  const handleIndustrySelect = useCallback((industry: Industry) => {
    setConfig((prev) => ({ ...prev, industry }));
    setStep(2);
  }, []);

  const handleBack = useCallback(() => {
    setStep((prev) => Math.max(0, prev - 1));
  }, []);

  const recommendation =
    config.employeeSize && config.industry
      ? getRecommendation(config.employeeSize, config.industry)
      : null;

  return (
    <section className="py-20" style={{ background: 'var(--color-surface-alt)' }}>
      <div className="container mx-auto px-4">
        <div
          className="max-w-2xl mx-auto rounded-2xl p-8 md:p-10 relative overflow-hidden"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="transition-all duration-300"
                style={{
                  width: i === step ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background:
                    i < step
                      ? '#059669'
                      : i === step
                        ? 'var(--color-accent)'
                        : 'var(--color-border)',
                }}
                aria-hidden="true"
              />
            ))}
          </div>

          {/* Step content with transitions */}
          <div className="relative" style={{ minHeight: '280px' }}>
            {/* Step 0: Employee count */}
            <div
              className="transition-all duration-400"
              style={{
                opacity: step === 0 ? 1 : 0,
                transform: step === 0 ? 'translateX(0)' : 'translateX(-30px)',
                position: step === 0 ? 'relative' : 'absolute',
                top: 0,
                left: 0,
                right: 0,
                pointerEvents: step === 0 ? 'auto' : 'none',
              }}
            >
              <div className="text-center mb-8">
                <h3 style={{ color: 'var(--color-text)' }}>
                  Wie viele Mitarbeiter hat Ihr Unternehmen?
                </h3>
                <p
                  className="text-base"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Wir passen unsere Empfehlung an Ihre Unternehmensgrösse an.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {(
                  [
                    { value: '1-5' as EmployeeSize, label: '1 – 5', sub: 'Kleinunternehmen' },
                    { value: '6-20' as EmployeeSize, label: '6 – 20', sub: 'Wachsend' },
                    { value: '20+' as EmployeeSize, label: '20+', sub: 'Etabliert' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSizeSelect(option.value)}
                    className="group rounded-xl p-5 text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    style={{
                      background: 'var(--color-surface-alt)',
                      border: '2px solid var(--color-border)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-accent)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div
                      className="text-2xl font-extrabold mb-1"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {option.label}
                    </div>
                    <div
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {option.sub}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 1: Industry */}
            <div
              className="transition-all duration-400"
              style={{
                opacity: step === 1 ? 1 : 0,
                transform:
                  step === 1
                    ? 'translateX(0)'
                    : step < 1
                      ? 'translateX(30px)'
                      : 'translateX(-30px)',
                position: step === 1 ? 'relative' : 'absolute',
                top: 0,
                left: 0,
                right: 0,
                pointerEvents: step === 1 ? 'auto' : 'none',
              }}
            >
              <div className="text-center mb-8">
                <h3 style={{ color: 'var(--color-text)' }}>
                  In welcher Branche sind Sie tätig?
                </h3>
                <p
                  className="text-base"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Damit wir Ihnen branchenspezifische Insights zeigen können.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(Object.keys(industryLabels) as Industry[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => handleIndustrySelect(key)}
                    className="group rounded-xl p-5 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-3"
                    style={{
                      background: 'var(--color-surface-alt)',
                      border: '2px solid var(--color-border)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-accent)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <svg
                      className="w-6 h-6 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="var(--color-accent)"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={industryIcons[key]} />
                    </svg>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {industryLabels[key]}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={handleBack}
                className="mt-6 mx-auto flex items-center gap-1.5 text-sm font-medium cursor-pointer"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Zurück
              </button>
            </div>

            {/* Step 2: Personalized result */}
            <div
              className="transition-all duration-400"
              style={{
                opacity: step === 2 ? 1 : 0,
                transform: step === 2 ? 'translateX(0)' : 'translateX(30px)',
                position: step === 2 ? 'relative' : 'absolute',
                top: 0,
                left: 0,
                right: 0,
                pointerEvents: step === 2 ? 'auto' : 'none',
              }}
            >
              {recommendation && (
                <div className="text-center">
                  {/* Success checkmark */}
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                    style={{
                      background: 'rgba(5, 150, 105, 0.1)',
                      border: '2px solid rgba(5, 150, 105, 0.2)',
                    }}
                  >
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="#059669"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  <h3
                    className="mb-4"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {recommendation.headline}
                  </h3>

                  <p
                    className="text-base leading-relaxed mb-8 max-w-lg mx-auto"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {recommendation.body}
                  </p>

                  {/* CTA button */}
                  <Link
                    href="/fitness-check"
                    className="btn btn-primary btn-glow text-base inline-flex items-center gap-2 mb-4"
                    data-track="micro-commitment-cta"
                  >
                    Jetzt kostenlosen Fitness-Check starten
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>

                  {/* Trust micro-labels */}
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-2">
                    {['2 Minuten', 'Kostenlos', 'Unverbindlich'].map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 text-xs font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="#059669"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {label}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={handleBack}
                    className="mt-6 mx-auto flex items-center gap-1.5 text-sm font-medium cursor-pointer"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Zurück
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
