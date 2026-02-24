'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import Confetti from '@/components/Confetti';
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

interface FormData {
  firmenname: string;
  website: string;
  branche: string;
  kanton: string;
  hasBlog: string;
  usesSocialMedia: string;
  neukunden: string;
  name: string;
  email: string;
  telefon: string;
}

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

// --- PDF Report Generation ---

function calculateScore(data: FormData): {
  overall: number;
  seo: number;
  social: number;
  leadgen: number;
  automation: number;
} {
  let seo = 30;
  let social = 30;
  let leadgen = 30;
  let automation = 20;

  // Blog impact
  if (data.hasBlog === 'Ja, aktiv') { seo += 40; leadgen += 15; }
  else if (data.hasBlog === 'Ja, aber inaktiv') { seo += 15; leadgen += 5; }

  // Social media impact
  if (data.usesSocialMedia === 'Ja, regelmässig') { social += 45; leadgen += 10; }
  else if (data.usesSocialMedia === 'Ja, sporadisch') { social += 20; leadgen += 5; }

  // Neukunden impact
  if (data.neukunden === 'Mehr als 10') { leadgen += 35; automation += 20; }
  else if (data.neukunden === '6-10') { leadgen += 25; automation += 15; }
  else if (data.neukunden === '3-5') { leadgen += 15; automation += 10; }

  // Website bonus
  if (data.website) { seo += 10; social += 5; }

  seo = Math.min(seo, 100);
  social = Math.min(social, 100);
  leadgen = Math.min(leadgen, 100);
  automation = Math.min(automation, 100);

  const overall = Math.round((seo + social + leadgen + automation) / 4);

  return { overall, seo, social, leadgen, automation };
}

function getRecommendations(data: FormData, scores: ReturnType<typeof calculateScore>): string[] {
  const recs: string[] = [];

  if (scores.seo < 50) {
    recs.push('SEO-Strategie aufbauen: Ihre Branche "' + data.branche + '" hat im Kanton ' + data.kanton + ' hohes Suchpotenzial. Regelmässige Blog-Beiträge und lokale Keywords können Ihre Sichtbarkeit um bis zu 200% steigern.');
  }
  if (data.hasBlog === 'Nein') {
    recs.push('Blog starten: KMUs mit aktivem Blog generieren 67% mehr Leads. Starten Sie mit 2 Beiträgen pro Monat zu Themen, die Ihre Kunden beschäftigen.');
  } else if (data.hasBlog === 'Ja, aber inaktiv') {
    recs.push('Blog reaktivieren: Sie haben bereits die Grundlage. Regelmässige Veröffentlichungen (2x/Monat) können innerhalb von 3 Monaten zu messbaren SEO-Verbesserungen führen.');
  }
  if (scores.social < 50) {
    recs.push('Social-Media-Präsenz ausbauen: LinkedIn ist für Schweizer B2B-KMUs der effektivste Kanal. 3 Posts pro Woche mit Branchen-Insights können Ihre Reichweite verdreifachen.');
  }
  if (data.neukunden === '0-2') {
    recs.push('Lead-Generierung priorisieren: Mit gezieltem Online-Marketing können Sie 5-10 qualifizierte Anfragen pro Monat generieren. Der durchschnittliche CAC liegt bei CHF 80-150 in Ihrer Branche.');
  }
  if (scores.automation < 40) {
    recs.push('Prozesse automatisieren: Manuelle Admin-Arbeit kostet Schweizer KMUs durchschnittlich 20 Stunden pro Woche. Automatisierung von Email-Workflows, Reporting und CRM kann bis zu 60% dieser Zeit einsparen.');
  }
  if (!data.website) {
    recs.push('Website optimieren: Eine professionelle, SEO-optimierte Website ist das Fundament für Online-Kundengewinnung. Ohne sie verpassen Sie täglich potenzielle Anfragen.');
  }

  return recs.slice(0, 5);
}

function getBranchenBenchmark(branche: string): { avgMarketing: string; avgLeads: string; topPerformer: string } {
  const benchmarks: Record<string, { avgMarketing: string; avgLeads: string; topPerformer: string }> = {
    'Treuhand / Buchhaltung': { avgMarketing: "CHF 2'500", avgLeads: '8-12', topPerformer: '+340% Traffic' },
    'Beratung / Consulting': { avgMarketing: "CHF 3'000", avgLeads: '10-15', topPerformer: '+280% Anfragen' },
    'IT-Services / Software': { avgMarketing: "CHF 4'000", avgLeads: '15-25', topPerformer: '+420% Leads' },
    'Handwerk / Bau': { avgMarketing: "CHF 1'800", avgLeads: '5-10', topPerformer: '3x Aufträge' },
    'Immobilien': { avgMarketing: "CHF 3'500", avgLeads: '10-20', topPerformer: '+250% Besichtigungen' },
    'Gesundheit / Medizin': { avgMarketing: "CHF 2'200", avgLeads: '12-18', topPerformer: '+180% Patienten' },
    'Rechtsberatung': { avgMarketing: "CHF 3'000", avgLeads: '6-10', topPerformer: '+200% Mandate' },
    'Marketing / Kommunikation': { avgMarketing: "CHF 2'800", avgLeads: '8-15', topPerformer: '+300% Pipeline' },
    'Gastronomie / Hotellerie': { avgMarketing: "CHF 1'500", avgLeads: '20-40', topPerformer: '+150% Buchungen' },
    'Handel / E-Commerce': { avgMarketing: "CHF 3'500", avgLeads: '30-50', topPerformer: '+320% Umsatz' },
  };
  return benchmarks[branche] || { avgMarketing: "CHF 2'500", avgLeads: '8-15', topPerformer: '+250% Wachstum' };
}

async function generatePDF(data: FormData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const scores = calculateScore(data);
  const recommendations = getRecommendations(data, scores);
  const benchmark = getBranchenBenchmark(data.branche);
  const today = new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const pageW = 210;
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 0;

  // --- Header (dark blue band) ---
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 50, 'F');

  // Swiss cross
  doc.setFillColor(220, 38, 38);
  doc.rect(margin, 15, 20, 20, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(margin + 5, 18.5, 10, 2.5, 'F');
  doc.rect(margin + 8.75, 15 + 3.5, 2.5, 13, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Werkpilot', margin + 25, 24);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Digital-Fitness-Report', margin + 25, 32);

  doc.setFontSize(9);
  doc.text(today, pageW - margin, 24, { align: 'right' });
  doc.text('werkpilot.ch', pageW - margin, 32, { align: 'right' });

  y = 60;

  // --- Report For ---
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Erstellt für ' + data.firmenname, margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(data.branche + ' | Kanton ' + data.kanton + (data.website ? ' | ' + data.website : ''), margin, y);
  doc.text('Ansprechperson: ' + data.name + ' (' + data.email + ')', margin, y + 5);
  y += 18;

  // --- Divider ---
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // --- Overall Score ---
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Gesamtbewertung', margin, y);
  y += 10;

  // Score circle
  const circleX = margin + 20;
  const circleY = y + 15;
  const circleR = 15;

  // Background circle
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(3);
  doc.circle(circleX, circleY, circleR);

  // Score color
  const scoreColor = scores.overall >= 70 ? [5, 150, 105] : scores.overall >= 40 ? [234, 179, 8] : [239, 68, 68];
  doc.setDrawColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.setLineWidth(3);
  // Draw arc approximation
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (scores.overall / 100) * 2 * Math.PI;
  const steps = 40;
  const arcPoints: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / steps);
    arcPoints.push([circleX + circleR * Math.cos(angle), circleY + circleR * Math.sin(angle)]);
  }
  for (let i = 0; i < arcPoints.length - 1; i++) {
    doc.line(arcPoints[i][0], arcPoints[i][1], arcPoints[i + 1][0], arcPoints[i + 1][1]);
  }

  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(scores.overall.toString(), circleX, circleY + 2, { align: 'center' });
  doc.setFontSize(8);
  doc.text('/100', circleX, circleY + 8, { align: 'center' });

  // Category scores next to circle
  const catX = margin + 50;
  const catStartY = y;
  const categories = [
    { label: 'SEO & Content', score: scores.seo },
    { label: 'Social Media', score: scores.social },
    { label: 'Lead-Generierung', score: scores.leadgen },
    { label: 'Automatisierung', score: scores.automation },
  ];

  doc.setFontSize(9);
  categories.forEach((cat, i) => {
    const catY = catStartY + i * 9;

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.text(cat.label, catX, catY + 3);

    // Score bar background
    const barX = catX + 40;
    const barW = 70;
    const barH = 4;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(barX, catY, barW, barH, 2, 2, 'F');

    // Score bar fill
    const fillColor = cat.score >= 70 ? [5, 150, 105] : cat.score >= 40 ? [234, 179, 8] : [239, 68, 68];
    doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    doc.roundedRect(barX, catY, barW * (cat.score / 100), barH, 2, 2, 'F');

    // Score number
    doc.setTextColor(fillColor[0], fillColor[1], fillColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(cat.score.toString() + '%', barX + barW + 4, catY + 3.5);
  });

  y += 42;

  // --- Divider ---
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // --- Branchen-Benchmark ---
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Branchen-Benchmark: ' + data.branche, margin, y);
  y += 10;

  // Benchmark cards
  const cardW = contentW / 3 - 3;
  const benchmarkData = [
    { label: 'Durchschn. Marketing-Budget', value: benchmark.avgMarketing + '/Mt' },
    { label: 'Leads pro Monat (Benchmark)', value: benchmark.avgLeads },
    { label: 'Top-Performer Ergebnis', value: benchmark.topPerformer },
  ];

  benchmarkData.forEach((item, i) => {
    const cardX = margin + i * (cardW + 4.5);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(cardX, y, cardW, 22, 2, 2, 'F');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, cardX + 4, y + 7);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, cardX + 4, y + 16);
  });

  y += 32;

  // --- Divider ---
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // --- Empfehlungen ---
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Konkrete Empfehlungen', margin, y);
  y += 8;

  recommendations.forEach((rec, i) => {
    // Check for page break
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    // Number circle
    doc.setFillColor(37, 99, 235);
    doc.circle(margin + 4, y + 3, 3.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text((i + 1).toString(), margin + 4, y + 4.5, { align: 'center' });

    // Recommendation text
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(rec, contentW - 15);
    doc.text(lines, margin + 12, y + 4);
    y += lines.length * 4.5 + 6;
  });

  y += 5;

  // --- Divider ---
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // --- Status Summary ---
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Ihre aktuelle Ausgangslage', margin, y);
  y += 8;

  const statusItems = [
    { label: 'Blog', value: data.hasBlog },
    { label: 'Social Media', value: data.usesSocialMedia },
    { label: 'Neukunden/Monat', value: data.neukunden },
  ];

  statusItems.forEach((item) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(item.label + ':', margin, y + 3);

    const statusColor =
      item.value.startsWith('Ja, aktiv') || item.value.startsWith('Ja, regelmässig') || item.value === 'Mehr als 10' || item.value === '6-10'
        ? [5, 150, 105]
        : item.value === 'Nein' || item.value === '0-2'
          ? [239, 68, 68]
          : [234, 179, 8];

    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(item.value, margin + 40, y + 3);
    y += 7;
  });

  y += 8;

  // --- CTA Box ---
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(margin, y, contentW, 35, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Nächster Schritt: Gratis Beratungsgespräch', margin + 8, y + 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Besprechen Sie Ihren Report mit einem Werkpilot-Spezialisten.', margin + 8, y + 20);
  doc.text('Termin buchen: werkpilot.ch/kontakt | info@werkpilot.ch | +41 44 555 50 00', margin + 8, y + 27);

  // --- Footer ---
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 287, pageW, 10, 'F');
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Werkpilot | werkpilot.ch | Vertraulich', margin, 293);
    doc.text('Seite ' + p + ' von ' + pageCount, pageW - margin, 293, { align: 'right' });
  }

  // Save
  const filename = 'Werkpilot_Fitness-Report_' + data.firmenname.replace(/[^a-zA-Z0-9äöüÄÖÜ]/g, '_') + '.pdf';
  doc.save(filename);
}

// --- Main Component ---

export default function FitnessCheckPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
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
  const [showConfetti, setShowConfetti] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);

  const firmennameRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const kantonDetectedRef = useRef(false);

  useEffect(() => {
    if (kantonDetectedRef.current) return;
    kantonDetectedRef.current = true;
    try {
      const lang = navigator.language || '';
      const languages = navigator.languages || [];
      const allLangs = [lang, ...languages].join(' ').toLowerCase();
      let detected = '';
      if (allLangs.includes('fr-ch')) detected = 'Genf';
      else if (allLangs.includes('it-ch')) detected = 'Tessin';
      else if (allLangs.includes('de-ch')) detected = 'Zürich';
      if (detected) {
        requestAnimationFrame(() => {
          setFormData((prev) => prev.kanton ? prev : { ...prev, kanton: detected });
        });
      }
    } catch { /* Silent */ }
  }, []);

  useEffect(() => {
    if (step === 1) firmennameRef.current?.focus();
    else if (step === 3) nameRef.current?.focus();
  }, [step]);

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleDownloadPDF = useCallback(async () => {
    await generatePDF(formData);
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await generatePDF(formData);
      setPdfReady(true);
      setShowConfetti(true);
      setTimeout(() => {
        setIsSubmitted(true);
      }, 600);
    } catch {
      // Fallback: still show success
      setIsSubmitted(true);
    }

    setIsSubmitting(false);
  };

  if (isSubmitted) {
    const scores = calculateScore(formData);
    return (
      <>
        <Navigation />
        <main id="main-content" className="min-h-screen flex items-center justify-center py-32">
          <Confetti active={showConfetti} />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="container mx-auto px-4 max-w-2xl text-center"
          >
            <div
              className="w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center"
              style={{ backgroundColor: 'rgba(5, 150, 105, 0.1)' }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 13l4 4L19 7" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
              Ihr Report ist bereit!
            </h1>
            <p className="text-xl mt-6 mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              Ihr Digital-Fitness-Score: <strong style={{ color: scores.overall >= 70 ? '#059669' : scores.overall >= 40 ? '#EAB308' : '#EF4444', fontSize: '1.5rem' }}>{scores.overall}/100</strong>
            </p>
            <p className="text-lg mb-8" style={{ color: 'var(--color-text-secondary)' }}>
              {pdfReady
                ? 'Der PDF-Report wurde automatisch heruntergeladen. Falls nicht, klicken Sie auf den Button unten.'
                : 'Klicken Sie auf den Button, um Ihren Report herunterzuladen.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleDownloadPDF}
                className="btn btn-primary text-lg"
              >
                PDF erneut herunterladen
              </button>
              <Link href="/kontakt" className="btn btn-secondary text-lg">
                Gratis Beratung buchen
              </Link>
            </div>
            <p className="mt-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Möchten Sie Ihren Report mit einem Werkpilot-Spezialisten besprechen?{' '}
              <Link href="/kontakt" style={{ color: 'var(--color-accent)' }}>
                Kontakt aufnehmen &rarr;
              </Link>
            </p>
          </motion.div>
        </main>
        <Footer />
      </>
    );
  }

  const step2AllFilled = formData.hasBlog && formData.usesSocialMedia && formData.neukunden;

  return (
    <>
      <Confetti active={showConfetti} />
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes successGlow {
          0% { box-shadow: 0 0 0 0 rgba(45, 140, 60, 0.4); }
          50% { box-shadow: 0 0 20px 10px rgba(45, 140, 60, 0.3); }
          100% { box-shadow: 0 0 0 0 rgba(45, 140, 60, 0); }
        }
        .success-glow { animation: successGlow 0.8s ease-out forwards; background-color: var(--color-success) !important; }
      ` }} />
      <Navigation />
      <main id="main-content" className="min-h-screen py-32" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-12 text-center">
            <h1 style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
              Gratis Digital-Fitness-Check
            </h1>
            <p className="text-xl mt-4" style={{ color: 'var(--color-text-secondary)' }}>
              In 2 Minuten zu Ihrem persönlichen PDF-Report
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-12">
            <div className="flex justify-between mb-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all ${step >= i ? 'text-white' : 'text-gray-400'}`}
                    style={{ backgroundColor: step >= i ? 'var(--color-accent)' : 'var(--color-border)' }}
                  >
                    {i}
                  </div>
                  <span className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {i === 1 ? 'Firma' : i === 2 ? 'Status' : 'Kontakt'}
                  </span>
                </div>
              ))}
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
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
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card p-8">
                  <h2 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
                    Über Ihr Unternehmen
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="firmenname">Firmenname *</label>
                      <div className="relative">
                        <input type="text" id="firmenname" ref={firmennameRef} required value={formData.firmenname}
                          onChange={(e) => setFormData({ ...formData, firmenname: e.target.value })}
                          className="w-full p-3 pr-10 border rounded-lg" style={{ borderColor: 'var(--color-border)' }} />
                        <ValidationCheck visible={formData.firmenname.trim().length > 0} />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="website">Website-URL</label>
                      <input type="url" id="website" placeholder="https://ihre-website.ch" value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full p-3 border rounded-lg" style={{ borderColor: 'var(--color-border)' }} />
                    </div>
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="branche">Branche *</label>
                      <div className="relative">
                        <select id="branche" required value={formData.branche}
                          onChange={(e) => setFormData({ ...formData, branche: e.target.value })}
                          className="w-full p-3 pr-10 border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
                          <option value="">Bitte wählen...</option>
                          {branchen.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <ValidationCheck visible={formData.branche !== ''} />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="kanton">Kanton *</label>
                      <div className="relative">
                        <select id="kanton" required value={formData.kanton}
                          onChange={(e) => setFormData({ ...formData, kanton: e.target.value })}
                          className="w-full p-3 pr-10 border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
                          <option value="">Bitte wählen...</option>
                          {kantons.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <ValidationCheck visible={formData.kanton !== ''} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <button type="button" onClick={handleNext} className="btn btn-primary" data-track="form-step-1-next"
                      disabled={!formData.firmenname || !formData.branche || !formData.kanton}>
                      Weiter &rarr;
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card p-8">
                  <h2 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
                    Ihre aktuelle Situation
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block mb-3 font-medium">Haben Sie einen Blog? *</label>
                      <div className="space-y-2">
                        {['Ja, aktiv', 'Ja, aber inaktiv', 'Nein'].map((option) => (
                          <label key={option} className="flex items-center gap-3 cursor-pointer">
                            <input type="radio" name="hasBlog" value={option} checked={formData.hasBlog === option}
                              onChange={(e) => setFormData({ ...formData, hasBlog: e.target.value })} className="w-5 h-5" />
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
                            <input type="radio" name="usesSocialMedia" value={option} checked={formData.usesSocialMedia === option}
                              onChange={(e) => setFormData({ ...formData, usesSocialMedia: e.target.value })} className="w-5 h-5" />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block mb-3 font-medium">Wie viele Neukunden gewinnen Sie pro Monat? *</label>
                      <div className="space-y-2">
                        {['0-2', '3-5', '6-10', 'Mehr als 10'].map((option) => (
                          <label key={option} className="flex items-center gap-3 cursor-pointer">
                            <input type="radio" name="neukunden" value={option} checked={formData.neukunden === option}
                              onChange={(e) => setFormData({ ...formData, neukunden: e.target.value })} className="w-5 h-5" />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {step2AllFilled && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                      className="mt-8 p-6 rounded-xl border" style={{ borderColor: 'var(--color-accent)', backgroundColor: 'rgba(46, 117, 182, 0.05)' }}>
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2"
                        style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="var(--color-warm)" />
                        </svg>
                        Erste Einblicke
                      </h3>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3">
                          <span className="mt-1 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: 'var(--color-success)' }}>1</span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>
                            Ihre Branche hat ein SEO-Potenzial von <strong style={{ color: 'var(--color-primary)' }}>+200%</strong> für lokale Suchanfragen
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="mt-1 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: 'var(--color-success)' }}>2</span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>
                            KMUs in Ihrem Kanton investieren durchschnittlich <strong style={{ color: 'var(--color-primary)' }}>CHF 2&apos;500/Monat</strong> in Marketing
                          </span>
                        </li>
                      </ul>
                      <p className="mt-4 text-sm" style={{ color: 'var(--color-accent)' }}>
                        Im nächsten Schritt erhalten Sie Ihren vollständigen PDF-Report zum Herunterladen.
                      </p>
                    </motion.div>
                  )}

                  <div className="mt-8 flex justify-between">
                    <button type="button" onClick={handleBack} className="btn btn-secondary">&larr; Zurück</button>
                    <button type="button" onClick={handleNext} className="btn btn-primary" data-track="form-step-2-next"
                      disabled={!formData.hasBlog || !formData.usesSocialMedia || !formData.neukunden}>
                      Weiter &rarr;
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card p-8">
                  <h2 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--color-primary)' }}>
                    Ihre Kontaktdaten
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="name">Name *</label>
                      <div className="relative">
                        <input type="text" id="name" ref={nameRef} required value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full p-3 pr-10 border rounded-lg" style={{ borderColor: 'var(--color-border)' }} />
                        <ValidationCheck visible={formData.name.trim().length > 0} />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="email">Email *</label>
                      <div className="relative">
                        <input type="email" id="email" required value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full p-3 pr-10 border rounded-lg" style={{ borderColor: 'var(--color-border)' }} />
                        <ValidationCheck visible={isValidEmail(formData.email)} />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-2 font-medium" htmlFor="telefon">Telefon (optional)</label>
                      <input type="tel" id="telefon" placeholder="+41 XX XXX XX XX" value={formData.telefon}
                        onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                        className="w-full p-3 border rounded-lg" style={{ borderColor: 'var(--color-border)' }} />
                    </div>
                    <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Ihre Daten werden vertraulich behandelt und nur zur Erstellung Ihres Digital-Fitness-Reports verwendet. Siehe{' '}
                      <a href="/datenschutz" style={{ color: 'var(--color-accent)' }}>Datenschutzerklärung</a>.
                    </div>
                  </div>
                  <div className="mt-8 flex justify-between items-start">
                    <button type="button" onClick={handleBack} className="btn btn-secondary">&larr; Zurück</button>
                    <div className="flex flex-col items-end gap-4">
                      <button type="submit" className="btn btn-primary" data-track="form-submit"
                        disabled={!formData.name || !formData.email || isSubmitting}>
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                            </svg>
                            PDF wird erstellt...
                          </span>
                        ) : 'PDF-Report herunterladen \u2192'}
                      </button>
                      <div className="flex flex-wrap gap-3 justify-end">
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--color-success)" strokeWidth="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          Sofort-Download
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          PDF mit Analyse
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18.36 6.64A9 9 0 015.64 18.36M5.64 5.64A9 9 0 0118.36 18.36" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" />
                            <line x1="4" y1="4" x2="20" y2="20" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          Kein Spam
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
