'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Receipt,
  DollarSign,
  CreditCard,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  FileText,
  AlertTriangle,
  Check,
  RefreshCw,
  FileDown,
  BarChart3,
  Tag,
  Percent,
  Shield,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  HeartPulse,
  Target,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { useToast } from '@/components/Toast';
import Breadcrumb from '@/components/Breadcrumb';
import MiniBarChart, { DonutChart } from '@/components/MiniBarChart';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LineItem {
  beschreibung: string;
  betrag: number;
}

interface Invoice {
  id: string;
  nummer: string;
  kunde: string;
  email: string | null;
  adresse: string | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  betrag: number;
  mwstSatz: number;
  mwst: number;
  total: number;
  faelligAm: string | null;
  notizen: string | null;
  positionen: LineItem[];
  createdAt: string;
}

interface Payment {
  id: string;
  rechnungNummer: string;
  kunde: string;
  betrag: number;
  methode: string;
  referenz: string | null;
  bezahltAm: string;
}

interface Expense {
  id: string;
  beschreibung: string;
  kategorie: string;
  betrag: number;
  datum: string;
  wiederkehrend: boolean;
  notizen: string | null;
}

interface CashflowMonth {
  monat: string;
  einnahmen: number;
  ausgabenMonat: number;
  saldo: number;
}

interface FinanzenData {
  stats: {
    umsatz: number;
    ausstehend: number;
    ausgaben: number;
    gewinn: number;
  };
  rechnungen: Invoice[];
  zahlungen: Payment[];
  ausgaben: Expense[];
  cashflow?: CashflowMonth[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const EXPENSE_CATEGORIES = [
  'Miete',
  'Software',
  'Marketing',
  'Personal',
  'Versicherung',
  'Büromaterial',
  'Reisen',
  'Sonstiges',
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Miete: 'var(--blue)',
  Software: 'var(--purple)',
  Marketing: 'var(--amber)',
  Personal: 'var(--green)',
  Versicherung: 'var(--red)',
  Büromaterial: 'var(--text-secondary)',
  Reisen: 'var(--amber)',
  Sonstiges: 'var(--text-muted)',
};

const PAYMENT_METHODS = [
  'Banküberweisung',
  'Kreditkarte',
  'TWINT',
  'PayPal',
  'Bar',
] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--text-muted)',
  sent: 'var(--amber)',
  paid: 'var(--green)',
  overdue: 'var(--red)',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  sent: 'Gesendet',
  paid: 'Bezahlt',
  overdue: 'Überfällig',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCHF(value: number): string {
  return value.toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/*  PDF Invoice Generator                                              */
/* ------------------------------------------------------------------ */

function generateInvoicePDF(invoice: Invoice) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginLeft = 25;
  const marginRight = 25;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // Colors
  const dark = '#1a1a1a';
  const medium = '#555555';
  const light = '#999999';
  const accent = '#2563eb';
  const lineColor = '#e5e5e5';

  // Helper: format CHF for PDF
  function pdfCHF(val: number): string {
    return val.toLocaleString('de-CH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Helper: format date for PDF
  function pdfDate(iso: string): string {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  let y = 25;

  // ── Header: Company info ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(dark);
  doc.text('WerkPilot GmbH', marginLeft, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(medium);
  y += 7;
  doc.text('Bahnhofstrasse 42 | 8001 Zürich | Schweiz', marginLeft, y);
  y += 4.5;
  doc.text('info@werkpilot.ch | +41 44 000 00 00', marginLeft, y);
  y += 4.5;
  doc.text('CHE-123.456.789 MWST', marginLeft, y);

  // ── "RECHNUNG" title ──
  y += 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(accent);
  doc.text('RECHNUNG', marginLeft, y);

  // ── Invoice metadata (right-aligned block) ──
  const metaX = pageWidth - marginRight;
  let metaY = y - 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(medium);

  doc.text(`Rechnungs-Nr.: ${invoice.nummer}`, metaX, metaY, { align: 'right' });
  metaY += 5;
  doc.text(`Datum: ${pdfDate(invoice.createdAt)}`, metaX, metaY, { align: 'right' });
  metaY += 5;
  if (invoice.faelligAm) {
    doc.text(`Fällig am: ${pdfDate(invoice.faelligAm)}`, metaX, metaY, { align: 'right' });
    metaY += 5;
  }
  doc.text(`Status: ${STATUS_LABELS[invoice.status] || invoice.status}`, metaX, metaY, {
    align: 'right',
  });

  // ── Divider ──
  y += 6;
  doc.setDrawColor(lineColor);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);

  // ── Client address block ──
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(light);
  doc.text('Rechnungsempfänger', marginLeft, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(dark);
  doc.text(invoice.kunde, marginLeft, y);

  if (invoice.adresse) {
    y += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(medium);
    // Split multi-line addresses
    const addressLines = invoice.adresse.split(/[,\n]/).map((l) => l.trim());
    for (const line of addressLines) {
      doc.text(line, marginLeft, y);
      y += 4.5;
    }
    y -= 4.5; // undo last increment
  }

  if (invoice.email) {
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(medium);
    doc.text(invoice.email, marginLeft, y);
  }

  // ── Line items table ──
  y += 14;

  // Table header
  const colX = {
    nr: marginLeft,
    beschreibung: marginLeft + 12,
    menge: marginLeft + contentWidth - 70,
    einzelpreis: marginLeft + contentWidth - 42,
    total: marginLeft + contentWidth,
  };

  doc.setFillColor(248, 248, 248);
  doc.rect(marginLeft, y - 4, contentWidth, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(medium);
  doc.text('Pos.', colX.nr, y);
  doc.text('Beschreibung', colX.beschreibung, y);
  doc.text('Menge', colX.menge, y, { align: 'right' });
  doc.text('Einzelpreis', colX.einzelpreis, y, { align: 'right' });
  doc.text('Total', colX.total, y, { align: 'right' });

  y += 6;
  doc.setDrawColor(lineColor);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(dark);

  invoice.positionen.forEach((item, index) => {
    y += 7;
    doc.setTextColor(light);
    doc.text(String(index + 1), colX.nr, y);
    doc.setTextColor(dark);
    doc.text(item.beschreibung || '-', colX.beschreibung, y);
    doc.setTextColor(medium);
    doc.text('1', colX.menge, y, { align: 'right' });
    doc.text(`CHF ${pdfCHF(item.betrag)}`, colX.einzelpreis, y, { align: 'right' });
    doc.setTextColor(dark);
    doc.text(`CHF ${pdfCHF(item.betrag)}`, colX.total, y, { align: 'right' });

    y += 3;
    doc.setDrawColor(lineColor);
    doc.setLineWidth(0.15);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
  });

  // ── Totals section ──
  y += 10;
  const totalLabelX = marginLeft + contentWidth - 50;
  const totalValueX = marginLeft + contentWidth;

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(medium);
  doc.text('Subtotal', totalLabelX, y);
  doc.setTextColor(dark);
  doc.text(`CHF ${pdfCHF(invoice.betrag)}`, totalValueX, y, { align: 'right' });

  // MwSt
  y += 6;
  doc.setTextColor(medium);
  doc.text(`MwSt (${invoice.mwstSatz.toFixed(1)}%)`, totalLabelX, y);
  doc.setTextColor(dark);
  doc.text(`CHF ${pdfCHF(invoice.mwst)}`, totalValueX, y, { align: 'right' });

  // Total divider
  y += 4;
  doc.setDrawColor(dark);
  doc.setLineWidth(0.5);
  doc.line(totalLabelX - 5, y, totalValueX, y);

  // Total
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(dark);
  doc.text('Total', totalLabelX, y);
  doc.text(`CHF ${pdfCHF(invoice.total)}`, totalValueX, y, { align: 'right' });

  // ── Payment info ──
  y += 18;
  doc.setDrawColor(lineColor);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(dark);
  doc.text('Zahlungsinformationen', marginLeft, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(medium);

  const paymentInfo = [
    ['Bank:', 'Zürcher Kantonalbank (ZKB)'],
    ['IBAN:', 'CH93 0070 0110 0000 0000 1'],
    ['BIC/SWIFT:', 'ZKBKCHZZ80A'],
    ['Konto:', 'WerkPilot GmbH'],
    ['Referenz:', invoice.nummer],
  ];

  paymentInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, marginLeft + 28, y);
    y += 5;
  });

  // ── Notes ──
  if (invoice.notizen) {
    y += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(light);
    doc.text(`Bemerkung: ${invoice.notizen}`, marginLeft, y);
  }

  // ── Footer ──
  const footerY = 282;
  doc.setDrawColor(lineColor);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, footerY - 4, pageWidth - marginRight, footerY - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(light);
  doc.text(
    'WerkPilot GmbH | Bahnhofstrasse 42 | 8001 Zürich | CHE-123.456.789 MWST',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );
  doc.text('Vielen Dank für Ihr Vertrauen.', pageWidth / 2, footerY + 4, { align: 'center' });

  // Save
  doc.save(`Rechnung_${invoice.nummer}.pdf`);
}

/* ------------------------------------------------------------------ */
/*  Status Icon                                                        */
/* ------------------------------------------------------------------ */

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'draft':
      return <FileText size={14} />;
    case 'sent':
      return <AlertTriangle size={14} />;
    case 'paid':
      return <Check size={14} />;
    case 'overdue':
      return <AlertTriangle size={14} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Cashflow Chart (inline SVG)                                        */
/* ------------------------------------------------------------------ */

function CashflowChart({ data }: { data: CashflowMonth[] }) {
  if (data.length === 0) return null;

  const chartWidth = 600;
  const chartHeight = 200;
  const paddingTop = 24;
  const paddingBottom = 40;
  const paddingLeft = 64;
  const paddingRight = 20;
  const drawWidth = chartWidth - paddingLeft - paddingRight;
  const drawHeight = chartHeight - paddingTop - paddingBottom;

  // Calculate max value for scaling
  const allValues = data.flatMap((d) => [d.einnahmen, d.ausgabenMonat, Math.abs(d.saldo)]);
  const maxVal = Math.max(...allValues, 1);
  // Round up to a nice number
  const niceMax = Math.ceil(maxVal / 1000) * 1000 || 1000;

  const barGroupWidth = drawWidth / data.length;
  const barWidth = Math.min(barGroupWidth * 0.3, 32);
  const barGap = 4;

  function yScale(v: number): number {
    return paddingTop + drawHeight - (v / niceMax) * drawHeight;
  }

  // Grid lines (4 horizontal)
  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = (niceMax / gridSteps) * i;
    return { y: yScale(val), label: `${Math.round(val / 1000)}k` };
  });

  // Net balance line points
  const linePoints = data
    .map((d, i) => {
      const x = paddingLeft + barGroupWidth * i + barGroupWidth / 2;
      const clampedSaldo = Math.max(d.saldo, 0);
      const y = yScale(clampedSaldo);
      return `${x},${y}`;
    })
    .join(' ');

  // Net balance for display
  const totalSaldo = data.reduce((sum, d) => sum + d.saldo, 0);
  const totalEinnahmen = data.reduce((sum, d) => sum + d.einnahmen, 0);
  const totalAusgaben = data.reduce((sum, d) => sum + d.ausgabenMonat, 0);

  return (
    <div className="card-glass-premium p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-1"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
          >
            Cashflow (6 Monate)
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Einnahmen vs. Ausgaben pro Monat
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: 'var(--green)', opacity: 0.85 }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Einnahmen
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: 'var(--red)', opacity: 0.85 }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Ausgaben
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-0.5 rounded"
              style={{ backgroundColor: 'var(--blue)' }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Saldo
            </span>
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div
          className="rounded-lg border px-3 py-2"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Total Einnahmen
          </div>
          <div
            className="text-sm font-bold tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
          >
            CHF {formatCHF(totalEinnahmen)}
          </div>
        </div>
        <div
          className="rounded-lg border px-3 py-2"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Total Ausgaben
          </div>
          <div
            className="text-sm font-bold tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}
          >
            CHF {formatCHF(totalAusgaben)}
          </div>
        </div>
        <div
          className="rounded-lg border px-3 py-2"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Netto-Saldo
          </div>
          <div
            className="text-sm font-bold tabular-nums"
            style={{
              fontFamily: 'var(--font-mono)',
              color: totalSaldo >= 0 ? 'var(--green)' : 'var(--red)',
            }}
          >
            {totalSaldo >= 0 ? '+' : ''}CHF {formatCHF(totalSaldo)}
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ width: '100%', height: 'auto', minWidth: 400 }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {gridLines.map((g, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={g.y}
                x2={chartWidth - paddingRight}
                y2={g.y}
                stroke="var(--border)"
                strokeWidth={0.5}
                strokeDasharray={i === 0 ? 'none' : '4 4'}
                opacity={0.5}
              />
              <text
                x={paddingLeft - 8}
                y={g.y + 4}
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize={10}
                fontFamily="var(--font-mono)"
              >
                {g.label}
              </text>
            </g>
          ))}

          {/* Bars */}
          {data.map((d, i) => {
            const groupX = paddingLeft + barGroupWidth * i + barGroupWidth / 2;
            const incomeBarX = groupX - barWidth - barGap / 2;
            const expenseBarX = groupX + barGap / 2;
            const incomeH = (d.einnahmen / niceMax) * drawHeight;
            const expenseH = (d.ausgabenMonat / niceMax) * drawHeight;

            return (
              <g key={i}>
                {/* Income bar (green) */}
                <rect
                  x={incomeBarX}
                  y={yScale(d.einnahmen)}
                  width={barWidth}
                  height={Math.max(incomeH, 0)}
                  rx={3}
                  fill="var(--green)"
                  opacity={0.85}
                >
                  <title>
                    {d.monat} Einnahmen: CHF {formatCHF(d.einnahmen)}
                  </title>
                </rect>

                {/* Expense bar (red) */}
                <rect
                  x={expenseBarX}
                  y={yScale(d.ausgabenMonat)}
                  width={barWidth}
                  height={Math.max(expenseH, 0)}
                  rx={3}
                  fill="var(--red)"
                  opacity={0.85}
                >
                  <title>
                    {d.monat} Ausgaben: CHF {formatCHF(d.ausgabenMonat)}
                  </title>
                </rect>

                {/* Month label */}
                <text
                  x={groupX}
                  y={chartHeight - paddingBottom + 16}
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize={11}
                  fontFamily="var(--font-mono)"
                >
                  {d.monat}
                </text>

                {/* Net balance label below month */}
                <text
                  x={groupX}
                  y={chartHeight - paddingBottom + 30}
                  textAnchor="middle"
                  fill={d.saldo >= 0 ? 'var(--green)' : 'var(--red)'}
                  fontSize={9}
                  fontFamily="var(--font-mono)"
                  fontWeight={600}
                >
                  {d.saldo >= 0 ? '+' : ''}{Math.round(d.saldo / 100) / 10}k
                </text>
              </g>
            );
          })}

          {/* Net balance line */}
          <polyline
            points={linePoints}
            fill="none"
            stroke="var(--blue)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Net balance dots */}
          {data.map((d, i) => {
            const x = paddingLeft + barGroupWidth * i + barGroupWidth / 2;
            const clampedSaldo = Math.max(d.saldo, 0);
            const y = yScale(clampedSaldo);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={3.5}
                fill="var(--surface)"
                stroke="var(--blue)"
                strokeWidth={2}
              >
                <title>
                  {d.monat} Saldo: CHF {formatCHF(d.saldo)}
                </title>
              </circle>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Invoice Modal                                               */
/* ------------------------------------------------------------------ */

function CreateInvoiceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [kunde, setKunde] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [mwstSatz, setMwstSatz] = useState(8.1);
  const [faelligAm, setFaelligAm] = useState('');
  const [notizen, setNotizen] = useState('');
  const [positionen, setPositionen] = useState<LineItem[]>([
    { beschreibung: '', betrag: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const subtotal = positionen.reduce((sum, p) => sum + (p.betrag || 0), 0);
  const mwstBetrag = Math.round(subtotal * (mwstSatz / 100) * 100) / 100;
  const total = subtotal + mwstBetrag;

  function updatePosition(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...positionen];
    if (field === 'betrag') {
      updated[index] = { ...updated[index], betrag: parseFloat(String(value)) || 0 };
    } else {
      updated[index] = { ...updated[index], [field]: String(value) };
    }
    setPositionen(updated);
  }

  function addPosition() {
    setPositionen([...positionen, { beschreibung: '', betrag: 0 }]);
  }

  function removePosition(index: number) {
    if (positionen.length <= 1) return;
    setPositionen(positionen.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kunde.trim() || positionen.every((p) => !p.beschreibung.trim())) return;
    setSaving(true);
    try {
      await fetch('/api/finanzen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invoice',
          kunde: kunde.trim(),
          email: email.trim() || null,
          adresse: adresse.trim() || null,
          mwstSatz,
          faelligAm: faelligAm || null,
          notizen: notizen.trim() || null,
          positionen: positionen.filter((p) => p.beschreibung.trim()),
        }),
      });
      toast('Rechnung erstellt', 'success');
      onCreated();
      onClose();
    } catch {
      console.error('Failed to create invoice');
      toast('Fehler beim Erstellen der Rechnung', 'error');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg)',
    borderColor: 'var(--border)',
    color: 'var(--text)',
    fontFamily: 'var(--font-dm-sans)',
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--amber) 15%, transparent)' }}
                >
                  <FileText size={20} style={{ color: 'var(--amber)' }} />
                </div>
                <div>
                  <h2
                    className="text-lg font-bold"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                  >
                    Neue Rechnung
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Rechnung erstellen und versenden
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Kundendaten */}
              <div className="space-y-3">
                <h3
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                >
                  Kundendaten
                </h3>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    Kundenname *
                  </label>
                  <input
                    type="text"
                    value={kunde}
                    onChange={(e) => setKunde(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={inputStyle}
                    placeholder="Muster AG"
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--amber)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                      E-Mail (optional)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                      style={inputStyle}
                      placeholder="info@muster.ch"
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--amber)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                      Adresse (optional)
                    </label>
                    <input
                      type="text"
                      value={adresse}
                      onChange={(e) => setAdresse(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                      style={inputStyle}
                      placeholder="Bahnhofstrasse 1, 8001 Zürich"
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--amber)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* MwSt + Fälligkeitsdatum */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    MwSt-Satz (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={mwstSatz}
                    onChange={(e) => setMwstSatz(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--amber)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    Fälligkeitsdatum
                  </label>
                  <input
                    type="date"
                    value={faelligAm}
                    onChange={(e) => setFaelligAm(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={inputStyle}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--amber)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  />
                </div>
              </div>

              {/* Notizen */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Notizen
                </label>
                <textarea
                  value={notizen}
                  onChange={(e) => setNotizen(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                  style={inputStyle}
                  placeholder="Zahlbar innert 30 Tagen"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--amber)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                />
              </div>

              {/* Positionen */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                  >
                    Positionen
                  </h3>
                  <button
                    type="button"
                    onClick={addPosition}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                    style={{ color: 'var(--amber)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                        'color-mix(in srgb, var(--amber) 10%, transparent)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <Plus size={14} />
                    Position hinzufügen
                  </button>
                </div>
                {positionen.map((pos, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={pos.beschreibung}
                        onChange={(e) => updatePosition(idx, 'beschreibung', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={inputStyle}
                        placeholder="Beschreibung"
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--amber)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                        }}
                      />
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={pos.betrag || ''}
                        onChange={(e) => updatePosition(idx, 'betrag', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none text-right tabular-nums"
                        style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                        placeholder="0.00"
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'var(--amber)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                        }}
                      />
                    </div>
                    {positionen.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePosition(idx)}
                        className="p-2 rounded-lg transition-colors mt-0.5"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)';
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                            'color-mix(in srgb, var(--red) 10%, transparent)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                            'transparent';
                        }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div
                className="rounded-xl border p-4 space-y-2"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
              >
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                  <span
                    className="tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                  >
                    CHF {formatCHF(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>MwSt ({mwstSatz}%)</span>
                  <span
                    className="tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                  >
                    CHF {formatCHF(mwstBetrag)}
                  </span>
                </div>
                <div
                  className="flex justify-between text-sm font-bold pt-2 border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                    Total
                  </span>
                  <span
                    className="tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
                  >
                    CHF {formatCHF(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-3 px-6 py-4 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving || !kunde.trim()}
                className="px-5 py-2 rounded-lg text-sm font-bold transition-opacity"
                style={{
                  backgroundColor: 'var(--amber)',
                  color: '#000',
                  opacity: saving || !kunde.trim() ? 0.4 : 1,
                }}
              >
                {saving ? 'Erstellen...' : 'Rechnung erstellen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Expense Modal                                               */
/* ------------------------------------------------------------------ */

function CreateExpenseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [beschreibung, setBeschreibung] = useState('');
  const [kategorie, setKategorie] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [betrag, setBetrag] = useState('');
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0]);
  const [wiederkehrend, setWiederkehrend] = useState(false);
  const [notizen, setNotizen] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!beschreibung.trim() || !betrag) return;
    setSaving(true);
    try {
      await fetch('/api/finanzen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          beschreibung: beschreibung.trim(),
          kategorie,
          betrag: parseFloat(betrag),
          datum,
          wiederkehrend,
          notizen: notizen.trim() || null,
        }),
      });
      toast('Ausgabe erfasst', 'success');
      onCreated();
      onClose();
    } catch {
      console.error('Failed to create expense');
      toast('Fehler beim Erfassen der Ausgabe', 'error');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg)',
    borderColor: 'var(--border)',
    color: 'var(--text)',
    fontFamily: 'var(--font-dm-sans)',
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--red) 15%, transparent)' }}
                >
                  <CreditCard size={20} style={{ color: 'var(--red)' }} />
                </div>
                <div>
                  <h2
                    className="text-lg font-bold"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                  >
                    Neue Ausgabe
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Ausgabe erfassen
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Beschreibung *
                </label>
                <input
                  type="text"
                  value={beschreibung}
                  onChange={(e) => setBeschreibung(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={inputStyle}
                  placeholder="z.B. Server Hosting"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--amber)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Kategorie
                </label>
                <select
                  value={kategorie}
                  onChange={(e) => setKategorie(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={inputStyle}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    Betrag (CHF) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={betrag}
                    onChange={(e) => setBetrag(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none text-right tabular-nums"
                    style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                    placeholder="0.00"
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--amber)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    Datum
                  </label>
                  <input
                    type="date"
                    value={datum}
                    onChange={(e) => setDatum(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={inputStyle}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--amber)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setWiederkehrend(!wiederkehrend)}
                  className="relative w-10 h-6 rounded-full transition-colors"
                  style={{
                    backgroundColor: wiederkehrend ? 'var(--amber)' : 'var(--surface-hover)',
                    border: `1px solid ${wiederkehrend ? 'var(--amber)' : 'var(--border)'}`,
                  }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                    style={{
                      backgroundColor: wiederkehrend ? '#000' : 'var(--text-muted)',
                      transform: wiederkehrend ? 'translateX(18px)' : 'translateX(2px)',
                    }}
                  />
                </button>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Wiederkehrend
                </span>
                {wiederkehrend && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--amber) 12%, transparent)',
                      color: 'var(--amber)',
                      border: '1px solid color-mix(in srgb, var(--amber) 20%, transparent)',
                    }}
                  >
                    <RefreshCw size={10} />
                    Monatlich
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Notizen (optional)
                </label>
                <textarea
                  value={notizen}
                  onChange={(e) => setNotizen(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                  style={inputStyle}
                  placeholder="Zusätzliche Bemerkungen..."
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--amber)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-3 px-6 py-4 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving || !beschreibung.trim() || !betrag}
                className="px-5 py-2 rounded-lg text-sm font-bold transition-opacity"
                style={{
                  backgroundColor: 'var(--amber)',
                  color: '#000',
                  opacity: saving || !beschreibung.trim() || !betrag ? 0.4 : 1,
                }}
              >
                {saving ? 'Speichern...' : 'Ausgabe erfassen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Record Payment Modal                                               */
/* ------------------------------------------------------------------ */

function RecordPaymentModal({
  invoice,
  onClose,
  onCreated,
}: {
  invoice: Invoice;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [betrag, setBetrag] = useState<number>(invoice.total);
  const [methode, setMethode] = useState<string>(PAYMENT_METHODS[0]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!betrag) return;
    setSaving(true);
    try {
      await fetch('/api/finanzen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'payment',
          invoiceId: invoice.id,
          amount: betrag,
          method: methode,
        }),
      });
      toast(`Zahlung über CHF ${betrag.toFixed(2)} erfasst`, 'success');
      onCreated();
      onClose();
    } catch {
      console.error('Failed to record payment');
      toast('Fehler beim Erfassen der Zahlung', 'error');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg)',
    borderColor: 'var(--border)',
    color: 'var(--text)',
    fontFamily: 'var(--font-dm-sans)',
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-2xl border"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--green) 15%, transparent)' }}
                >
                  <DollarSign size={20} style={{ color: 'var(--green)' }} />
                </div>
                <div>
                  <h2
                    className="text-lg font-bold"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                  >
                    Zahlung erfassen
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Rechnung {invoice.nummer} - {invoice.kunde}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Invoice Summary */}
            <div className="px-6 pt-4">
              <div
                className="rounded-xl border p-3"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Rechnungstotal
                  </span>
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                  >
                    CHF {formatCHF(invoice.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Betrag (CHF)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={betrag || ''}
                  onChange={(e) => setBetrag(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none text-right tabular-nums"
                  style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--amber)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Zahlungsmethode
                </label>
                <select
                  value={methode}
                  onChange={(e) => setMethode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                  style={inputStyle}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-3 px-6 py-4 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving || !betrag}
                className="px-5 py-2 rounded-lg text-sm font-bold transition-opacity"
                style={{
                  backgroundColor: 'var(--green)',
                  color: '#000',
                  opacity: saving || !betrag ? 0.4 : 1,
                }}
              >
                {saving ? 'Erfassen...' : 'Zahlung erfassen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Profit & Loss Summary Card                                         */
/* ------------------------------------------------------------------ */

function ProfitLossCard({
  rechnungen,
  ausgaben,
  stats,
}: {
  rechnungen: Invoice[];
  ausgaben: Expense[];
  stats: { umsatz: number; ausstehend: number; ausgaben: number; gewinn: number };
}) {
  const einnahmen = stats.umsatz;
  const totalAusgaben = stats.ausgaben;
  const netGewinn = einnahmen - totalAusgaben;
  const gewinnMarge = einnahmen > 0 ? (netGewinn / einnahmen) * 100 : 0;
  const mwstRate = 8.1;
  const mwstRueckstellung = einnahmen > 0 ? (einnahmen * mwstRate) / (100 + mwstRate) : 0;

  // Monthly profit trend (last 6 months)
  const now = new Date();
  const monthlyProfits: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthIncome = rechnungen
      .filter((r) => r.status === 'paid' && new Date(r.createdAt) >= monthStart && new Date(r.createdAt) <= monthEnd)
      .reduce((sum, r) => sum + r.total, 0);

    const monthExpenses = ausgaben
      .filter((e) => new Date(e.datum) >= monthStart && new Date(e.datum) <= monthEnd)
      .reduce((sum, e) => sum + e.betrag, 0);

    monthlyProfits.push(monthIncome - monthExpenses);
  }

  // Sparkline calculations
  const sparkW = 120;
  const sparkH = 36;
  const sparkPadY = 4;
  const minVal = Math.min(...monthlyProfits, 0);
  const maxVal = Math.max(...monthlyProfits, 1);
  const range = maxVal - minVal || 1;

  const sparkPoints = monthlyProfits
    .map((v, i) => {
      const x = (i / (monthlyProfits.length - 1)) * sparkW;
      const y = sparkH - sparkPadY - ((v - minVal) / range) * (sparkH - sparkPadY * 2);
      return `${x},${y}`;
    })
    .join(' ');

  // Zero line y-position for sparkline
  const zeroY = sparkH - sparkPadY - ((0 - minVal) / range) * (sparkH - sparkPadY * 2);

  // Circular progress indicator
  const circleSize = 80;
  const strokeW = 7;
  const radius = (circleSize - strokeW) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedMarge = Math.max(0, Math.min(100, Math.abs(gewinnMarge)));
  const strokeDashoffset = circumference - (clampedMarge / 100) * circumference;
  const margeColor = gewinnMarge >= 0 ? 'var(--green)' : 'var(--red)';

  return (
    <div className="card-glass-premium p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--purple) 15%, transparent)' }}
          >
            <BarChart3 size={20} style={{ color: 'var(--purple)' }} />
          </div>
          <div>
            <h3
              className="text-xs font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              Gewinn &amp; Verlust
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Finanzübersicht &mdash; laufendes Jahr
            </p>
          </div>
        </div>
        {/* Sparkline */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Profit-Trend
          </span>
          <svg width={sparkW} height={sparkH} viewBox={`0 0 ${sparkW} ${sparkH}`}>
            {/* zero line */}
            {minVal < 0 && (
              <line
                x1={0}
                y1={zeroY}
                x2={sparkW}
                y2={zeroY}
                stroke="var(--border)"
                strokeWidth={0.5}
                strokeDasharray="3 3"
              />
            )}
            {/* gradient fill */}
            <defs>
              <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={netGewinn >= 0 ? 'var(--green)' : 'var(--red)'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={netGewinn >= 0 ? 'var(--green)' : 'var(--red)'} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <polygon
              points={`0,${sparkH} ${sparkPoints} ${sparkW},${sparkH}`}
              fill="url(#sparkGrad)"
            />
            <polyline
              points={sparkPoints}
              fill="none"
              stroke={netGewinn >= 0 ? 'var(--green)' : 'var(--red)'}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* end dot */}
            {monthlyProfits.length > 0 && (() => {
              const lastX = sparkW;
              const lastVal = monthlyProfits[monthlyProfits.length - 1];
              const lastY = sparkH - sparkPadY - ((lastVal - minVal) / range) * (sparkH - sparkPadY * 2);
              return (
                <circle
                  cx={lastX}
                  cy={lastY}
                  r={3}
                  fill={netGewinn >= 0 ? 'var(--green)' : 'var(--red)'}
                />
              );
            })()}
          </svg>
        </div>
      </div>

      {/* Main content: left metrics + right circular gauge */}
      <div className="flex gap-5">
        {/* Left: P&L rows */}
        <div className="flex-1 space-y-3">
          {/* Einnahmen */}
          <div
            className="flex items-center justify-between rounded-lg border px-4 py-3"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--green)', boxShadow: 'var(--green-glow)' }}
              />
              <div className="flex items-center gap-1.5">
                <TrendingUp size={14} style={{ color: 'var(--green)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Einnahmen
                </span>
              </div>
            </div>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
            >
              CHF {formatCHF(einnahmen)}
            </span>
          </div>

          {/* Ausgaben */}
          <div
            className="flex items-center justify-between rounded-lg border px-4 py-3"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--red)', boxShadow: 'var(--red-glow)' }}
              />
              <div className="flex items-center gap-1.5">
                <TrendingDown size={14} style={{ color: 'var(--red)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Ausgaben
                </span>
              </div>
            </div>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}
            >
              &minus;CHF {formatCHF(totalAusgaben)}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t" style={{ borderColor: 'var(--border)' }} />

          {/* Net Gewinn */}
          <div
            className="flex items-center justify-between rounded-lg border px-4 py-3"
            style={{
              backgroundColor: 'var(--bg)',
              borderColor: netGewinn >= 0
                ? 'color-mix(in srgb, var(--green) 30%, var(--border))'
                : 'color-mix(in srgb, var(--red) 30%, var(--border))',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: netGewinn >= 0 ? 'var(--green)' : 'var(--red)',
                  boxShadow: netGewinn >= 0 ? 'var(--green-glow)' : 'var(--red-glow)',
                }}
              />
              <div className="flex items-center gap-1.5">
                <DollarSign size={14} style={{ color: netGewinn >= 0 ? 'var(--green)' : 'var(--red)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                  Netto-Gewinn
                </span>
              </div>
            </div>
            <span
              className="text-base font-bold tabular-nums"
              style={{
                fontFamily: 'var(--font-mono)',
                color: netGewinn >= 0 ? 'var(--green)' : 'var(--red)',
              }}
            >
              {netGewinn >= 0 ? '+' : ''}{netGewinn < 0 ? '\u2212' : ''}CHF {formatCHF(Math.abs(netGewinn))}
            </span>
          </div>

          {/* MwSt Rückstellung */}
          <div
            className="flex items-center justify-between rounded-lg border px-4 py-2.5"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--amber)', boxShadow: 'var(--amber-glow)' }}
              />
              <div className="flex items-center gap-1.5">
                <Shield size={13} style={{ color: 'var(--amber)' }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                  MwSt-Rückstellung ({mwstRate}%)
                </span>
              </div>
            </div>
            <span
              className="text-xs font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
            >
              CHF {formatCHF(Math.round(mwstRueckstellung * 100) / 100)}
            </span>
          </div>
        </div>

        {/* Right: Circular Progress Gauge */}
        <div className="flex flex-col items-center justify-center" style={{ minWidth: 120 }}>
          <svg width={circleSize} height={circleSize} viewBox={`0 0 ${circleSize} ${circleSize}`}>
            {/* Background circle */}
            <circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              fill="none"
              stroke="var(--border)"
              strokeWidth={strokeW}
            />
            {/* Progress arc */}
            <circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              fill="none"
              stroke={margeColor}
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform={`rotate(-90 ${circleSize / 2} ${circleSize / 2})`}
              style={{
                transition: 'stroke-dashoffset 0.8s ease-out',
                filter: `drop-shadow(0 0 6px ${gewinnMarge >= 0 ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'})`,
              }}
            />
            {/* Center text */}
            <text
              x={circleSize / 2}
              y={circleSize / 2 - 3}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={margeColor}
              fontSize={18}
              fontWeight={700}
              fontFamily="var(--font-mono)"
            >
              {gewinnMarge >= 0 ? '' : '\u2212'}{Math.abs(gewinnMarge).toFixed(1)}%
            </text>
            <text
              x={circleSize / 2}
              y={circleSize / 2 + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              Marge
            </text>
          </svg>
          <div className="flex items-center gap-1 mt-2">
            <Percent size={11} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Gewinnmarge
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Payment Status Tracker Card                                        */
/* ------------------------------------------------------------------ */

function PaymentStatusTracker({
  rechnungen,
  zahlungen,
}: {
  rechnungen: Invoice[];
  zahlungen: Payment[];
}) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Categorize invoices
  const overdueInvoices = rechnungen.filter((r) => r.status === 'overdue');
  const pendingInvoices = rechnungen.filter((r) => r.status === 'sent');
  const paidThisMonth = rechnungen.filter(
    (r) => r.status === 'paid' && new Date(r.createdAt) >= monthStart && new Date(r.createdAt) <= monthEnd
  );

  const overdueTotal = overdueInvoices.reduce((sum, r) => sum + r.total, 0);
  const pendingTotal = pendingInvoices.reduce((sum, r) => sum + r.total, 0);
  const paidThisMonthTotal = paidThisMonth.reduce((sum, r) => sum + r.total, 0);

  // Payment health score: 0-100
  // Based on ratio of paid vs overdue, with penalty for overdue count
  const totalRelevant = rechnungen.filter(
    (r) => r.status === 'paid' || r.status === 'overdue' || r.status === 'sent'
  );
  const paidCount = rechnungen.filter((r) => r.status === 'paid').length;
  const relevantCount = totalRelevant.length;
  const baseScore = relevantCount > 0 ? (paidCount / relevantCount) * 100 : 100;
  // Extra penalty for overdue invoices: each overdue invoice reduces score by 5
  const overduePenalty = overdueInvoices.length * 5;
  const healthScore = Math.max(0, Math.min(100, Math.round(baseScore - overduePenalty)));

  // Circular gauge parameters
  const gaugeSize = 100;
  const gaugeStrokeW = 8;
  const gaugeRadius = (gaugeSize - gaugeStrokeW) / 2;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeProgress = (healthScore / 100) * gaugeCircumference;
  const gaugeColor =
    healthScore >= 75 ? 'var(--green)' : healthScore >= 50 ? 'var(--amber)' : 'var(--red)';
  const gaugeGlow =
    healthScore >= 75 ? 'var(--green-glow)' : healthScore >= 50 ? 'var(--amber-glow)' : 'var(--red-glow)';

  // Recent payment events timeline (last 5 events)
  const recentEvents: Array<{
    type: 'paid' | 'overdue' | 'sent';
    label: string;
    date: string;
    amount: number;
  }> = [];

  // Add recent payments
  zahlungen.slice(0, 5).forEach((z) => {
    recentEvents.push({
      type: 'paid',
      label: `${z.kunde} - ${z.rechnungNummer}`,
      date: z.bezahltAm,
      amount: z.betrag,
    });
  });

  // Add overdue invoices as events
  overdueInvoices.forEach((r) => {
    recentEvents.push({
      type: 'overdue',
      label: `${r.kunde} - ${r.nummer}`,
      date: r.faelligAm || r.createdAt,
      amount: r.total,
    });
  });

  // Add recently sent invoices
  pendingInvoices.slice(0, 3).forEach((r) => {
    recentEvents.push({
      type: 'sent',
      label: `${r.kunde} - ${r.nummer}`,
      date: r.createdAt,
      amount: r.total,
    });
  });

  // Sort by date descending and take 5
  const timeline = recentEvents
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const eventConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    paid: {
      color: 'var(--green)',
      icon: <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />,
      label: 'Bezahlt',
    },
    overdue: {
      color: 'var(--red)',
      icon: <AlertCircle size={14} style={{ color: 'var(--red)' }} />,
      label: 'Überfällig',
    },
    sent: {
      color: 'var(--amber)',
      icon: <Clock size={14} style={{ color: 'var(--amber)' }} />,
      label: 'Ausstehend',
    },
  };

  return (
    <div className="card-glass-premium p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'color-mix(in srgb, var(--blue) 15%, transparent)' }}
        >
          <HeartPulse size={18} style={{ color: 'var(--blue)' }} />
        </div>
        <div>
          <h3
            className="text-xs font-bold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
          >
            Zahlungsstatus
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Überblick über offene und bezahlte Rechnungen
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Status Buckets */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Overdue */}
          <div
            className="rounded-xl border px-4 py-3"
            style={{
              backgroundColor: 'var(--bg)',
              borderColor: 'color-mix(in srgb, var(--red) 30%, var(--border))',
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} style={{ color: 'var(--red)' }} />
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--red)' }}
                >
                  Überfällig
                </span>
              </div>
              <span
                className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--red)',
                  backgroundColor: 'color-mix(in srgb, var(--red) 12%, transparent)',
                }}
              >
                {overdueInvoices.length}
              </span>
            </div>
            <div
              className="text-lg font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}
            >
              CHF {formatCHF(overdueTotal)}
            </div>
          </div>

          {/* Pending */}
          <div
            className="rounded-xl border px-4 py-3"
            style={{
              backgroundColor: 'var(--bg)',
              borderColor: 'color-mix(in srgb, var(--amber) 30%, var(--border))',
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: 'var(--amber)' }} />
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--amber)' }}
                >
                  Ausstehend
                </span>
              </div>
              <span
                className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--amber)',
                  backgroundColor: 'color-mix(in srgb, var(--amber) 12%, transparent)',
                }}
              >
                {pendingInvoices.length}
              </span>
            </div>
            <div
              className="text-lg font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
            >
              CHF {formatCHF(pendingTotal)}
            </div>
          </div>

          {/* Paid this month */}
          <div
            className="rounded-xl border px-4 py-3"
            style={{
              backgroundColor: 'var(--bg)',
              borderColor: 'color-mix(in srgb, var(--green) 30%, var(--border))',
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--green)' }}
                >
                  Bezahlt (Monat)
                </span>
              </div>
              <span
                className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--green)',
                  backgroundColor: 'color-mix(in srgb, var(--green) 12%, transparent)',
                }}
              >
                {paidThisMonth.length}
              </span>
            </div>
            <div
              className="text-lg font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
            >
              CHF {formatCHF(paidThisMonthTotal)}
            </div>
          </div>
        </div>

        {/* Center: Health Score Gauge */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center">
          <div className="relative" style={{ width: gaugeSize, height: gaugeSize }}>
            <svg
              width={gaugeSize}
              height={gaugeSize}
              viewBox={`0 0 ${gaugeSize} ${gaugeSize}`}
              style={{ transform: 'rotate(-90deg)' }}
            >
              {/* Background track */}
              <circle
                cx={gaugeSize / 2}
                cy={gaugeSize / 2}
                r={gaugeRadius}
                fill="none"
                stroke="var(--border)"
                strokeWidth={gaugeStrokeW}
              />
              {/* Progress arc */}
              <circle
                cx={gaugeSize / 2}
                cy={gaugeSize / 2}
                r={gaugeRadius}
                fill="none"
                stroke={gaugeColor}
                strokeWidth={gaugeStrokeW}
                strokeDasharray={`${gaugeProgress} ${gaugeCircumference}`}
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 6px ${gaugeColor})`,
                  transition: 'stroke-dasharray 0.6s ease',
                }}
              />
            </svg>
            {/* Center text */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ transform: 'none' }}
            >
              <span
                className="text-2xl font-bold tabular-nums"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: gaugeColor,
                  textShadow: gaugeGlow,
                }}
              >
                {healthScore}
              </span>
              <span
                className="text-[9px] uppercase tracking-wider font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Score
              </span>
            </div>
          </div>
          <div className="mt-3 text-center">
            <p
              className="text-xs font-semibold"
              style={{ color: gaugeColor }}
            >
              {healthScore >= 75
                ? 'Gesund'
                : healthScore >= 50
                  ? 'Aufmerksamkeit nötig'
                  : 'Kritisch'}
            </p>
            <p
              className="text-[10px] mt-0.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Zahlungsgesundheit
            </p>
          </div>
        </div>

        {/* Right: Recent Payment Timeline */}
        <div className="lg:col-span-5">
          <h4
            className="text-[10px] font-bold uppercase tracking-wider mb-3"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
          >
            Letzte Ereignisse
          </h4>
          {timeline.length === 0 ? (
            <div
              className="flex items-center justify-center h-32 rounded-lg border"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
            >
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Keine Ereignisse vorhanden
              </p>
            </div>
          ) : (
            <div className="relative pl-5">
              {/* Vertical timeline line */}
              <div
                className="absolute left-[7px] top-1 bottom-1 w-px"
                style={{ backgroundColor: 'var(--border)' }}
              />
              <div className="flex flex-col gap-3">
                {timeline.map((event, i) => {
                  const cfg = eventConfig[event.type];
                  return (
                    <div key={i} className="relative flex items-start gap-3">
                      {/* Dot on timeline */}
                      <div
                        className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                        style={{
                          borderColor: cfg.color,
                          backgroundColor: 'var(--surface)',
                        }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: cfg.color }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {cfg.icon}
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wide"
                            style={{ color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                          <span
                            className="text-[10px] ml-auto tabular-nums"
                            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                          >
                            {formatDate(event.date)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span
                            className="text-xs truncate mr-2"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {event.label}
                          </span>
                          <span
                            className="text-xs font-bold tabular-nums whitespace-nowrap"
                            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                          >
                            CHF {formatCHF(event.amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MwSt-Uebersicht (VAT Summary)                                     */
/* ------------------------------------------------------------------ */

interface QuarterData {
  label: string;
  einnahmen: number;
  ausgaben: number;
  mwstEingenommen: number;
  mwstBezahlt: number;
  netto: number;
}

function MwStUebersicht({
  rechnungen,
  ausgaben,
}: {
  rechnungen: Invoice[];
  ausgaben: Expense[];
}) {
  const MWST_RATE = 0.081;
  const now = new Date();
  const currentYear = now.getFullYear();

  // Build quarterly data from invoices and expenses
  const quarters: QuarterData[] = [
    { label: 'Q1', months: [0, 1, 2] },
    { label: 'Q2', months: [3, 4, 5] },
    { label: 'Q3', months: [6, 7, 8] },
    { label: 'Q4', months: [9, 10, 11] },
  ].map(({ label, months }) => {
    const qStart = new Date(currentYear, months[0], 1);
    const qEnd = new Date(currentYear, months[2] + 1, 0, 23, 59, 59, 999);

    const qEinnahmen = rechnungen
      .filter((r) => {
        const d = new Date(r.createdAt);
        return r.status === 'paid' && d >= qStart && d <= qEnd;
      })
      .reduce((sum, r) => sum + r.total, 0);

    const qAusgaben = ausgaben
      .filter((e) => {
        const d = new Date(e.datum);
        return d >= qStart && d <= qEnd;
      })
      .reduce((sum, e) => sum + e.betrag, 0);

    const mwstEingenommen = Math.round(qEinnahmen * MWST_RATE * 100) / 100;
    const mwstBezahlt = Math.round(qAusgaben * MWST_RATE * 100) / 100;
    const netto = Math.round((mwstEingenommen - mwstBezahlt) * 100) / 100;

    return {
      label,
      einnahmen: qEinnahmen,
      ausgaben: qAusgaben,
      mwstEingenommen,
      mwstBezahlt,
      netto,
    };
  }) as QuarterData[];

  // Annual totals
  const totalEinnahmen = quarters.reduce((s, q) => s + q.einnahmen, 0);
  const totalAusgaben = quarters.reduce((s, q) => s + q.ausgaben, 0);
  const totalMwstEingenommen = quarters.reduce((s, q) => s + q.mwstEingenommen, 0);
  const totalMwstBezahlt = quarters.reduce((s, q) => s + q.mwstBezahlt, 0);
  const totalNetto = Math.round((totalMwstEingenommen - totalMwstBezahlt) * 100) / 100;

  // Bar chart scaling
  const maxMwst = Math.max(
    ...quarters.map((q) => Math.max(q.mwstEingenommen, q.mwstBezahlt)),
    1
  );

  const barChartH = 120;
  const barMaxH = barChartH - 20; // leave space for labels

  function barHeight(val: number): number {
    return Math.max((val / maxMwst) * barMaxH, 2);
  }

  return (
    <div className="card-glass-premium p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--amber) 15%, transparent)' }}
          >
            <Percent size={20} style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <h3
              className="text-xs font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              MwSt-Uebersicht
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Quartalsweise Mehrwertsteuer-Abrechnung {currentYear} &mdash; 8.1%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: 'var(--green)', opacity: 0.85 }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Eingenommen
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: 'var(--red)', opacity: 0.85 }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Bezahlt
            </span>
          </div>
        </div>
      </div>

      {/* Quarterly Bar Chart */}
      <div
        className="rounded-lg border p-4 mb-4"
        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-end justify-around" style={{ height: barChartH }}>
          {quarters.map((q) => (
            <div key={q.label} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
              {/* Bar values */}
              <div className="flex items-end gap-1.5" style={{ height: barMaxH }}>
                {/* Eingenommen bar */}
                <div className="flex flex-col items-center">
                  <span
                    className="text-[9px] font-bold tabular-nums mb-0.5"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
                  >
                    {q.mwstEingenommen > 0 ? formatCHF(q.mwstEingenommen) : '\u2013'}
                  </span>
                  <div
                    style={{
                      width: 28,
                      height: barHeight(q.mwstEingenommen),
                      backgroundColor: 'var(--green)',
                      borderRadius: '4px 4px 2px 2px',
                      opacity: 0.85,
                      transition: 'height 0.5s ease-out',
                    }}
                  />
                </div>
                {/* Bezahlt bar */}
                <div className="flex flex-col items-center">
                  <span
                    className="text-[9px] font-bold tabular-nums mb-0.5"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}
                  >
                    {q.mwstBezahlt > 0 ? formatCHF(q.mwstBezahlt) : '\u2013'}
                  </span>
                  <div
                    style={{
                      width: 28,
                      height: barHeight(q.mwstBezahlt),
                      backgroundColor: 'var(--red)',
                      borderRadius: '4px 4px 2px 2px',
                      opacity: 0.85,
                      transition: 'height 0.5s ease-out',
                    }}
                  />
                </div>
              </div>
              {/* Quarter label */}
              <span
                className="text-xs font-bold mt-1"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
              >
                {q.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quarterly Detail Table */}
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {['Quartal', 'Einnahmen', 'Ausgaben', 'MwSt eingenom.', 'MwSt bezahlt', 'Netto-MwSt'].map(
                (header) => (
                  <th
                    key={header}
                    className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {quarters.map((q) => (
              <tr
                key={q.label}
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <td
                  className="px-3 py-2.5 text-xs font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  {q.label} {currentYear}
                </td>
                <td
                  className="px-3 py-2.5 text-xs tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                >
                  CHF {formatCHF(q.einnahmen)}
                </td>
                <td
                  className="px-3 py-2.5 text-xs tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                >
                  CHF {formatCHF(q.ausgaben)}
                </td>
                <td
                  className="px-3 py-2.5 text-xs font-bold tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
                >
                  CHF {formatCHF(q.mwstEingenommen)}
                </td>
                <td
                  className="px-3 py-2.5 text-xs font-bold tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}
                >
                  &minus;CHF {formatCHF(q.mwstBezahlt)}
                </td>
                <td
                  className="px-3 py-2.5 text-xs font-bold tabular-nums"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: q.netto >= 0 ? 'var(--amber)' : 'var(--green)',
                  }}
                >
                  {q.netto >= 0 ? '' : '\u2212'}CHF {formatCHF(Math.abs(q.netto))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Annual Summary */}
      <div
        className="mt-4 rounded-lg border p-4"
        style={{
          backgroundColor: 'var(--bg)',
          borderColor: 'color-mix(in srgb, var(--amber) 30%, var(--border))',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Shield size={14} style={{ color: 'var(--amber)' }} />
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
          >
            Jahresabrechnung {currentYear}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
              Umsatz Total
            </div>
            <div
              className="text-sm font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
            >
              CHF {formatCHF(totalEinnahmen)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
              Ausgaben Total
            </div>
            <div
              className="text-sm font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
            >
              CHF {formatCHF(totalAusgaben)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
              MwSt Eingenommen
            </div>
            <div
              className="text-sm font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
            >
              CHF {formatCHF(totalMwstEingenommen)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
              MwSt Bezahlt
            </div>
            <div
              className="text-sm font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}
            >
              &minus;CHF {formatCHF(totalMwstBezahlt)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
              Netto MwSt-Schuld
            </div>
            <div
              className="text-base font-bold tabular-nums"
              style={{
                fontFamily: 'var(--font-mono)',
                color: totalNetto >= 0 ? 'var(--amber)' : 'var(--green)',
              }}
            >
              {totalNetto >= 0 ? '' : '\u2212'}CHF {formatCHF(Math.abs(totalNetto))}
            </div>
            <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {totalNetto >= 0 ? 'An ESTV zu zahlen' : 'Vorsteuer-Guthaben'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Budget vs Actual Comparison                                        */
/* ------------------------------------------------------------------ */

interface BudgetCategory {
  name: string;
  budget: number;
  actual: number;
}

const BUDGET_DATA: BudgetCategory[] = [
  { name: 'Personal', budget: 45000, actual: 42350 },
  { name: 'Marketing', budget: 12000, actual: 14200 },
  { name: 'Infrastruktur', budget: 8500, actual: 7100 },
  { name: 'Software', budget: 6000, actual: 5400 },
  { name: 'Buero', budget: 3500, actual: 3150 },
  { name: 'Reisen', budget: 5000, actual: 4800 },
  { name: 'Beratung', budget: 10000, actual: 8600 },
];

function BudgetVergleich({ ausgaben }: { ausgaben: Expense[] }) {
  // Merge actual expense data from real expenses where categories match
  const categories: BudgetCategory[] = BUDGET_DATA.map((b) => {
    const actualFromExpenses = ausgaben
      .filter((e) => e.kategorie.toLowerCase() === b.name.toLowerCase())
      .reduce((sum, e) => sum + e.betrag, 0);
    return {
      ...b,
      actual: actualFromExpenses > 0 ? actualFromExpenses : b.actual,
    };
  });

  const totalBudget = categories.reduce((s, c) => s + c.budget, 0);
  const totalActual = categories.reduce((s, c) => s + c.actual, 0);
  const totalPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
  const maxBudget = Math.max(...categories.map((c) => Math.max(c.budget, c.actual)));

  function getStatusColor(pct: number): string {
    if (pct > 100) return 'var(--red)';
    if (pct >= 80) return 'var(--amber)';
    return 'var(--green)';
  }

  function getStatusLabel(pct: number): string {
    if (pct > 100) return 'Ueberschritten';
    if (pct >= 80) return 'Achtung';
    return 'Im Rahmen';
  }

  return (
    <div className="card-glass-premium p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-1"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
          >
            Budget vs. Ist-Ausgaben
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
            Geplantes Budget gegenueber tatsaechlichen Ausgaben pro Kategorie
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{
                border: '2px solid var(--text-muted)',
                backgroundColor: 'transparent',
              }}
            />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Budget
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: 'var(--blue)', opacity: 0.8 }}
            />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Ist
            </span>
          </div>
        </div>
      </div>

      {/* Category rows */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const pct = cat.budget > 0 ? (cat.actual / cat.budget) * 100 : 0;
          const barMaxPct = maxBudget > 0 ? (cat.budget / maxBudget) * 100 : 0;
          const actualBarPct = maxBudget > 0 ? (cat.actual / maxBudget) * 100 : 0;
          const remaining = cat.budget - cat.actual;
          const statusColor = getStatusColor(pct);
          const statusLabel = getStatusLabel(pct);

          return (
            <div key={cat.name}>
              {/* Label row */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {cat.name}
                  </span>
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{
                      color: statusColor,
                      backgroundColor: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${statusColor} 25%, transparent)`,
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-[10px] tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', color: statusColor }}
                  >
                    {pct.toFixed(0)}%
                  </span>
                  <span
                    className="text-[10px] tabular-nums"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: remaining >= 0 ? 'var(--text-muted)' : 'var(--red)',
                    }}
                  >
                    {remaining >= 0 ? '+' : '\u2212'}CHF {formatCHF(Math.abs(remaining))} {remaining >= 0 ? 'uebrig' : 'ueber'}
                  </span>
                </div>
              </div>

              {/* Bar chart row */}
              <div className="relative" style={{ height: '20px' }}>
                {/* Budget bar (ghost/outlined) */}
                <div
                  className="absolute top-0 left-0 rounded"
                  style={{
                    width: `${Math.max(barMaxPct, 2)}%`,
                    height: '100%',
                    border: '1.5px dashed var(--text-muted)',
                    opacity: 0.35,
                    borderRadius: '4px',
                  }}
                />
                {/* Actual bar (filled) */}
                <div
                  className="absolute top-0 left-0 rounded transition-all"
                  style={{
                    width: `${Math.max(actualBarPct, 1)}%`,
                    height: '100%',
                    backgroundColor: statusColor,
                    opacity: 0.7,
                    borderRadius: '4px',
                  }}
                />
                {/* Values on bar */}
                <div
                  className="absolute top-0 left-0 h-full flex items-center px-2"
                  style={{ minWidth: `${Math.max(actualBarPct, 10)}%` }}
                >
                  <span
                    className="text-[9px] font-bold tabular-nums whitespace-nowrap"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text)',
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    }}
                  >
                    CHF {formatCHF(cat.actual)} / {formatCHF(cat.budget)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total summary row */}
      <div
        className="mt-5 pt-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Target size={14} style={{ color: 'var(--amber)' }} />
            <span
              className="text-sm font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
            >
              Total
            </span>
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold"
              style={{
                color: getStatusColor(totalPct),
                backgroundColor: `color-mix(in srgb, ${getStatusColor(totalPct)} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${getStatusColor(totalPct)} 25%, transparent)`,
              }}
            >
              {getStatusLabel(totalPct)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-xs tabular-nums font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: getStatusColor(totalPct) }}
            >
              {totalPct.toFixed(1)}%
            </span>
            <span
              className="text-xs tabular-nums font-bold"
              style={{
                fontFamily: 'var(--font-mono)',
                color: totalBudget - totalActual >= 0 ? 'var(--green)' : 'var(--red)',
              }}
            >
              {totalBudget - totalActual >= 0 ? '+' : '\u2212'}CHF{' '}
              {formatCHF(Math.abs(totalBudget - totalActual))} {totalBudget - totalActual >= 0 ? 'uebrig' : 'ueber'}
            </span>
          </div>
        </div>

        {/* Total bar */}
        <div className="relative" style={{ height: '24px' }}>
          <div
            className="absolute top-0 left-0 rounded"
            style={{
              width: '100%',
              height: '100%',
              border: '1.5px dashed var(--text-muted)',
              opacity: 0.35,
              borderRadius: '4px',
            }}
          />
          <div
            className="absolute top-0 left-0 rounded transition-all"
            style={{
              width: `${Math.min(totalPct, 100)}%`,
              height: '100%',
              backgroundColor: getStatusColor(totalPct),
              opacity: 0.7,
              borderRadius: '4px',
            }}
          />
          <div
            className="absolute top-0 left-0 h-full flex items-center px-2"
            style={{ width: '100%' }}
          >
            <span
              className="text-[10px] font-bold tabular-nums whitespace-nowrap"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }}
            >
              CHF {formatCHF(totalActual)} / {formatCHF(totalBudget)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Finanzen Page                                                 */
/* ------------------------------------------------------------------ */

export default function FinanzenPage() {
  const { toast } = useToast();
  /* ---- State ---- */
  const [data, setData] = useState<FinanzenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rechnungen' | 'zahlungen' | 'ausgaben'>(
    'rechnungen'
  );
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);

  /* ---- Fetch data ---- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finanzen');
      const json = await res.json();
      setData(json);
    } catch {
      console.error('Failed to fetch finanzen data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- Mark as sent ---- */
  async function markAsSent(invoiceId: string) {
    try {
      await fetch('/api/finanzen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'payment',
          invoiceId,
          action: 'mark_sent',
        }),
      });
      toast('Rechnung als versendet markiert', 'success');
      await fetchData();
    } catch {
      console.error('Failed to mark invoice as sent');
      toast('Fehler beim Markieren', 'error');
    }
  }

  /* ---- CSV Export ---- */
  function exportCSV() {
    if (!data) return;
    const headers = ['Nummer', 'Kunde', 'Status', 'Betrag', 'MwSt', 'Total', 'Fällig am', 'Erstellt'];
    const rows = (data.rechnungen ?? []).map((inv: Invoice) => [
      inv.nummer,
      inv.kunde,
      inv.status,
      inv.betrag.toFixed(2),
      inv.mwst.toFixed(2),
      inv.total.toFixed(2),
      inv.faelligAm ? new Date(inv.faelligAm).toLocaleDateString('de-CH') : '',
      new Date(inv.createdAt).toLocaleDateString('de-CH'),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rechnungen_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast('CSV exportiert', 'success');
  }

  /* ---- Derived data ---- */
  const stats = data?.stats ?? { umsatz: 0, ausstehend: 0, ausgaben: 0, gewinn: 0 };
  const rechnungen = data?.rechnungen ?? [];
  const zahlungen = data?.zahlungen ?? [];
  const ausgaben = data?.ausgaben ?? [];

  const tabs = [
    { key: 'rechnungen' as const, label: 'Rechnungen', count: rechnungen.length },
    { key: 'zahlungen' as const, label: 'Zahlungen', count: zahlungen.length },
    { key: 'ausgaben' as const, label: 'Ausgaben', count: ausgaben.length },
  ];

  /* ---- KPI cards config ---- */
  const kpiCards = [
    {
      label: 'Umsatz',
      value: stats.umsatz,
      icon: <TrendingUp size={20} style={{ color: 'var(--green)' }} />,
      color: 'var(--green)',
      bg: 'color-mix(in srgb, var(--green) 15%, transparent)',
    },
    {
      label: 'Ausstehend',
      value: stats.ausstehend,
      icon: <AlertTriangle size={20} style={{ color: 'var(--amber)' }} />,
      color: 'var(--amber)',
      bg: 'color-mix(in srgb, var(--amber) 15%, transparent)',
    },
    {
      label: 'Ausgaben',
      value: stats.ausgaben,
      icon: <TrendingDown size={20} style={{ color: 'var(--red)' }} />,
      color: 'var(--red)',
      bg: 'color-mix(in srgb, var(--red) 15%, transparent)',
    },
    {
      label: 'Gewinn',
      value: stats.gewinn,
      icon: <DollarSign size={20} style={{ color: 'var(--blue)' }} />,
      color: 'var(--blue)',
      bg: 'color-mix(in srgb, var(--blue) 15%, transparent)',
    },
  ];

  /* ---- Render ---- */
  return (
    <div className="space-y-4 md:space-y-5">
      <Breadcrumb items={[{ label: 'Finanzen' }]} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1
          className="text-xl md:text-2xl font-bold"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
        >
          Finanzen
        </h1>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="px-3 md:px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
            style={{ backgroundColor: 'var(--amber)', color: '#000' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 20px rgba(245, 158, 11, 0.3)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLButtonElement).style.transform = 'none';
            }}
          >
            <Receipt size={16} />
            Neue Rechnung
          </button>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="px-3 md:px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border transition-colors"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--surface)',
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.backgroundColor = 'var(--surface-hover)';
              btn.style.borderColor = 'var(--amber)';
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.backgroundColor = 'var(--surface)';
              btn.style.borderColor = 'var(--border)';
            }}
          >
            <CreditCard size={16} />
            Neue Ausgabe
          </button>
          <button
            onClick={exportCSV}
            className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border transition-colors"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--surface)',
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.backgroundColor = 'var(--surface-hover)';
              btn.style.borderColor = 'var(--green)';
              btn.style.color = 'var(--green)';
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.backgroundColor = 'var(--surface)';
              btn.style.borderColor = 'var(--border)';
              btn.style.color = 'var(--text-secondary)';
            }}
            title="Rechnungen als CSV exportieren"
          >
            <FileDown size={16} />
            CSV
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 stagger-children">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="card-glass-premium p-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: kpi.bg }}
              >
                {kpi.icon}
              </div>
              <div className="min-w-0">
                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {kpi.label}
                </div>
                {loading ? (
                  <div className="skeleton h-7 w-24 rounded mt-1" />
                ) : (
                  <div
                    className="text-xl md:text-2xl font-bold tabular-nums truncate"
                    style={{ fontFamily: 'var(--font-mono)', color: kpi.color }}
                  >
                    CHF {formatCHF(kpi.value)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Profit & Loss Summary Card */}
      {!loading && data && (
        <ProfitLossCard rechnungen={rechnungen} ausgaben={ausgaben} stats={stats} />
      )}

      {/* Payment Status Tracker */}
      {!loading && data && (
        <PaymentStatusTracker rechnungen={rechnungen} zahlungen={zahlungen} />
      )}

      {/* Revenue Charts Row */}
      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly Revenue Bar Chart */}
          <div className="card-glass-premium p-5">
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              Umsatz nach Monat
            </h3>
            <MiniBarChart
              data={(() => {
                const months: Record<string, number> = {};
                const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
                // Initialize last 6 months
                const now = new Date();
                for (let i = 5; i >= 0; i--) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  months[key] = 0;
                }
                // Sum invoices by month (paid only)
                rechnungen.filter(r => r.status === 'paid').forEach(r => {
                  const d = new Date(r.createdAt);
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  if (key in months) months[key] += r.total;
                });
                return Object.entries(months).map(([key, value]) => ({
                  label: monthNames[parseInt(key.split('-')[1]) - 1],
                  value: Math.round(value),
                  color: 'var(--green)',
                }));
              })()}
              height={140}
              barWidth={36}
              gap={8}
              valuePrefix="CHF "
            />
          </div>

          {/* Invoice Status Donut */}
          <div className="card-glass-premium p-5">
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              Rechnungsstatus
            </h3>
            <div className="flex flex-col items-center">
              <DonutChart
                data={[
                  { label: 'Bezahlt', value: rechnungen.filter(r => r.status === 'paid').length, color: 'var(--green)' },
                  { label: 'Gesendet', value: rechnungen.filter(r => r.status === 'sent').length, color: 'var(--blue)' },
                  { label: 'Überfällig', value: rechnungen.filter(r => r.status === 'overdue').length, color: 'var(--red)' },
                  { label: 'Entwurf', value: rechnungen.filter(r => r.status === 'draft').length, color: 'var(--text-muted)' },
                ].filter(s => s.value > 0)}
                size={130}
                strokeWidth={16}
                centerValue={String(rechnungen.length)}
                centerLabel="Rechnungen"
              />
            </div>
          </div>
        </div>
      )}

      {/* Cashflow Chart */}
      {!loading && data && data.cashflow && data.cashflow.length > 0 && (
        <CashflowChart data={data.cashflow} />
      )}

      {/* Budget vs. Ist-Ausgaben */}
      {!loading && data && (
        <BudgetVergleich ausgaben={ausgaben} />
      )}

      {/* MwSt-Uebersicht */}
      {!loading && data && (
        <MwStUebersicht rechnungen={rechnungen} ausgaben={ausgaben} />
      )}

      {/* Tabs */}
      <div
        className="flex items-center gap-0 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-3 text-sm font-medium transition-colors relative"
            style={{
              color: activeTab === tab.key ? 'var(--text)' : 'var(--text-muted)',
            }}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              <span
                className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold tabular-nums"
                style={{
                  backgroundColor:
                    activeTab === tab.key ? 'var(--amber)' : 'var(--surface-hover)',
                  color: activeTab === tab.key ? '#000' : 'var(--text-muted)',
                }}
              >
                {tab.count}
              </span>
            </span>
            {activeTab === tab.key && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: 'var(--amber)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card-glass-premium overflow-hidden">
        {/* ---- Rechnungen Tab ---- */}
        {activeTab === 'rechnungen' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[
                    'Nr.',
                    'Kunde',
                    'Status',
                    'Betrag',
                    'MwSt',
                    'Total',
                    'Fällig am',
                    'Erstellt',
                    '',
                  ].map((header) => (
                    <th
                      key={header}
                      className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg)',
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div
                            className="skeleton h-4 rounded"
                            style={{
                              width: j === 1 ? '120px' : j === 8 ? '100px' : '70px',
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rechnungen.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div style={{ width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 15%, transparent)', color: 'var(--green)', marginBottom: 14 }}>
                          <Receipt size={24} />
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)', margin: '0 0 6px' }}>Noch keine Rechnungen</h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 300 }}>Erstelle deine erste Rechnung, um Zahlungen zu verfolgen.</p>
                        <button onClick={() => setShowInvoiceModal(true)} className="mt-3 px-4 py-2 rounded-lg text-sm font-bold" style={{ backgroundColor: 'var(--amber)', color: '#000' }}>Erste Rechnung erstellen</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rechnungen.map((inv, idx) => (
                    <tr
                      key={inv.id}
                      className="transition-colors"
                      style={{
                        borderBottom: '1px solid var(--border)',
                        animationDelay: `${idx * 30}ms`,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                          'var(--surface-hover)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                          'transparent';
                      }}
                    >
                      <td className="px-4 py-3">
                        <span
                          className="text-sm font-medium tabular-nums"
                          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                        >
                          {inv.nummer}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: 'var(--text)' }}>
                          {inv.kunde}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{
                            color: STATUS_COLORS[inv.status],
                            backgroundColor: `color-mix(in srgb, ${STATUS_COLORS[inv.status]} 15%, transparent)`,
                          }}
                        >
                          <StatusIcon status={inv.status} />
                          {STATUS_LABELS[inv.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-sm tabular-nums"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          CHF {formatCHF(inv.betrag)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-sm tabular-nums"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          CHF {formatCHF(inv.mwst)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-sm font-bold tabular-nums"
                          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                        >
                          CHF {formatCHF(inv.total)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {inv.faelligAm ? formatDate(inv.faelligAm) : '\u2014'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatDate(inv.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {inv.status === 'draft' && (
                            <button
                              onClick={() => markAsSent(inv.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                              style={{ color: 'var(--amber)' }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                  'color-mix(in srgb, var(--amber) 10%, transparent)';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                  'transparent';
                              }}
                            >
                              Als gesendet markieren
                            </button>
                          )}
                          {inv.status === 'sent' && (
                            <button
                              onClick={() => setPaymentInvoice(inv)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                              style={{ color: 'var(--green)' }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                  'color-mix(in srgb, var(--green) 10%, transparent)';
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                  'transparent';
                              }}
                            >
                              Zahlung erfassen
                            </button>
                          )}
                          <button
                            onClick={() => generateInvoicePDF(inv)}
                            title="PDF exportieren"
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={(e) => {
                              const btn = e.currentTarget as HTMLButtonElement;
                              btn.style.color = 'var(--amber)';
                              btn.style.backgroundColor =
                                'color-mix(in srgb, var(--amber) 10%, transparent)';
                            }}
                            onMouseLeave={(e) => {
                              const btn = e.currentTarget as HTMLButtonElement;
                              btn.style.color = 'var(--text-muted)';
                              btn.style.backgroundColor = 'transparent';
                            }}
                          >
                            <FileDown size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- Zahlungen Tab ---- */}
        {activeTab === 'zahlungen' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Rechnung', 'Kunde', 'Betrag', 'Methode', 'Referenz', 'Bezahlt am'].map(
                    (header) => (
                      <th
                        key={header}
                        className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                          backgroundColor: 'var(--bg)',
                        }}
                      >
                        {header}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div
                            className="skeleton h-4 rounded"
                            style={{ width: '80px' }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : zahlungen.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div style={{ width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--blue) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--blue) 15%, transparent)', color: 'var(--blue)', marginBottom: 12 }}>
                          <CreditCard size={22} />
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)', margin: '0 0 4px' }}>Noch keine Zahlungen</h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 300 }}>Zahlungen werden automatisch erfasst, wenn Rechnungen bezahlt werden.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  zahlungen.map((pay, idx) => (
                    <tr
                      key={pay.id}
                      className="transition-colors"
                      style={{
                        borderBottom: '1px solid var(--border)',
                        animationDelay: `${idx * 30}ms`,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                          'var(--surface-hover)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                          'transparent';
                      }}
                    >
                      <td className="px-4 py-3">
                        <span
                          className="text-sm font-medium tabular-nums"
                          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                        >
                          {pay.rechnungNummer}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: 'var(--text)' }}>
                          {pay.kunde}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-sm font-bold tabular-nums"
                          style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
                        >
                          CHF {formatCHF(pay.betrag)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs"
                          style={{
                            backgroundColor: 'var(--surface-hover)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <CreditCard size={12} />
                          {pay.methode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs tabular-nums"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {pay.referenz || '\u2014'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {formatDate(pay.bezahltAm)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- Ausgaben Tab ---- */}
        {activeTab === 'ausgaben' && (
          <div>
            {/* Expense Statistics Summary */}
            {!loading && ausgaben.length > 0 && (
              <div
                className="p-4 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Total Expenses */}
                  <div
                    className="rounded-xl border p-4"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--red) 15%, transparent)' }}
                      >
                        <TrendingDown size={16} style={{ color: 'var(--red)' }} />
                      </div>
                      <h3
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                      >
                        Total Ausgaben
                      </h3>
                    </div>
                    <div
                      className="text-2xl font-bold tabular-nums"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}
                    >
                      CHF {formatCHF(ausgaben.reduce((sum, e) => sum + e.betrag, 0))}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {ausgaben.length} {ausgaben.length === 1 ? 'Ausgabe' : 'Ausgaben'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {ausgaben.filter((e) => e.wiederkehrend).length} wiederkehrend
                      </span>
                    </div>
                  </div>

                  {/* By Category */}
                  <div
                    className="rounded-xl border p-4"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--purple) 15%, transparent)' }}
                      >
                        <BarChart3 size={16} style={{ color: 'var(--purple)' }} />
                      </div>
                      <h3
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                      >
                        Nach Kategorie
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(
                        ausgaben.reduce<Record<string, number>>((acc, e) => {
                          acc[e.kategorie] = (acc[e.kategorie] || 0) + e.betrag;
                          return acc;
                        }, {})
                      )
                        .sort(([, a], [, b]) => b - a)
                        .map(([cat, total]) => {
                          const maxTotal = ausgaben.reduce((sum, e) => sum + e.betrag, 0);
                          const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                          const catColor = CATEGORY_COLORS[cat] || 'var(--text-muted)';
                          return (
                            <div key={cat}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <Tag size={10} style={{ color: catColor }} />
                                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    {cat}
                                  </span>
                                </div>
                                <span
                                  className="text-xs tabular-nums font-medium"
                                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                                >
                                  CHF {formatCHF(total)}
                                </span>
                              </div>
                              <div
                                className="h-1.5 rounded-full overflow-hidden"
                                style={{ backgroundColor: 'var(--surface)' }}
                              >
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: catColor,
                                    opacity: 0.7,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Beschreibung', 'Kategorie', 'Betrag', 'Datum', 'Wiederkehrend'].map(
                      (header) => (
                        <th
                          key={header}
                          className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                            backgroundColor: 'var(--bg)',
                          }}
                        >
                          {header}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div
                              className="skeleton h-4 rounded"
                              style={{ width: j === 0 ? '150px' : '80px' }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : ausgaben.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <DollarSign
                          size={32}
                          className="mx-auto mb-3"
                          style={{ color: 'var(--text-muted)' }}
                        />
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          Noch keine Ausgaben erfasst.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    ausgaben.map((exp, idx) => (
                      <tr
                        key={exp.id}
                        className="transition-colors"
                        style={{
                          borderBottom: '1px solid var(--border)',
                          animationDelay: `${idx * 30}ms`,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                            'var(--surface-hover)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                            'transparent';
                        }}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm" style={{ color: 'var(--text)' }}>
                            {exp.beschreibung}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: 'var(--surface-hover)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {exp.kategorie}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-sm font-bold tabular-nums"
                            style={{ fontFamily: 'var(--font-mono)', color: 'var(--red)' }}
                          >
                            CHF {formatCHF(exp.betrag)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-sm"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {exp.datum ? formatDate(exp.datum) : '\u2014'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {exp.wiederkehrend ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                              style={{
                                color: 'var(--amber)',
                                backgroundColor:
                                  'color-mix(in srgb, var(--amber) 12%, transparent)',
                                border:
                                  '1px solid color-mix(in srgb, var(--amber) 20%, transparent)',
                              }}
                            >
                              <RefreshCw size={10} />
                              Wiederkehrend
                            </span>
                          ) : (
                            <span
                              className="text-xs"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              Einmalig
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add expense button below table */}
            {!loading && (
              <div
                className="px-4 py-3 border-t"
                style={{ borderColor: 'var(--border)' }}
              >
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                  style={{ color: 'var(--amber)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'color-mix(in srgb, var(--amber) 10%, transparent)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <Plus size={16} />
                  Neue Ausgabe hinzufügen
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showInvoiceModal && (
        <CreateInvoiceModal
          onClose={() => setShowInvoiceModal(false)}
          onCreated={fetchData}
        />
      )}
      {showExpenseModal && (
        <CreateExpenseModal
          onClose={() => setShowExpenseModal(false)}
          onCreated={fetchData}
        />
      )}
      {paymentInvoice && (
        <RecordPaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
