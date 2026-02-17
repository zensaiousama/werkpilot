'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  Download,
  ChevronDown,
  Search,
  X,
  Check,
  TrendingUp,
  Users,
  DollarSign,
  Target,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Activity {
  id: string;
  type: string;
  details: string | null;
  createdAt: string;
}

interface Lead {
  id: string;
  firma: string;
  kontakt: string | null;
  email: string | null;
  telefon: string | null;
  website: string | null;
  adresse: string | null;
  branche: string;
  kanton: string;
  ort: string;
  status: string;
  leadScore: number;
  fitnessScore: number;
  umsatzpotenzial: number;
  googleRating: number | null;
  googleReviews: number | null;
  notizen: string | null;
  quelle: string | null;
  letzterKontakt: string | null;
  createdAt: string;
  updatedAt: string;
  activities: Activity[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUSES = [
  'New Lead',
  'Researched',
  'Fitness Check',
  'Contacted',
  'Interested',
  'Meeting',
  'Proposal',
  'Negotiation',
  'Won',
  'Client',
  'Lost',
] as const;

const BRANCHEN = [
  'Treuhand',
  'Beratung',
  'IT-Services',
  'Handwerk',
  'Immobilien',
  'Gesundheit',
  'Rechtsberatung',
  'Marketing',
  'Gastronomie',
  'Handel',
] as const;

const KANTONS = [
  'Zürich',
  'Bern',
  'Luzern',
  'Basel-Stadt',
  'Aargau',
  'St. Gallen',
  'Genf',
  'Waadt',
  'Tessin',
] as const;

const ACTIVITY_LABELS: Record<string, string> = {
  status_change: 'Status geändert',
  note: 'Notiz',
  email_sent: 'E-Mail gesendet',
  call: 'Anruf',
  meeting: 'Meeting',
  scrape: 'Daten aktualisiert',
  fitness_check: 'Fitness Check',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--green)';
  if (score >= 40) return 'var(--amber)';
  return 'var(--red)';
}

function scoreBadgeClass(score: number): string {
  if (score >= 70) return 'badge-success';
  if (score >= 40) return 'badge-warning';
  return 'badge-error';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function exportToCSV(leads: Lead[]) {
  const headers = [
    'Firma',
    'Kontakt',
    'E-Mail',
    'Telefon',
    'Website',
    'Branche',
    'Kanton',
    'Ort',
    'Status',
    'Lead Score',
    'Fitness Score',
    'Umsatzpotenzial',
    'Erstellt',
  ];

  const rows = leads.map((lead) => [
    lead.firma,
    lead.kontakt || '',
    lead.email || '',
    lead.telefon || '',
    lead.website || '',
    lead.branche,
    lead.kanton,
    lead.ort,
    lead.status,
    lead.leadScore,
    lead.fitnessScore,
    lead.umsatzpotenzial,
    formatDate(lead.createdAt),
  ]);

  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `leads_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ------------------------------------------------------------------ */
/*  Multi-select Dropdown Component                                    */
/* ------------------------------------------------------------------ */

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(val: string) {
    if (selected.includes(val)) {
      onChange(selected.filter((s) => s !== val));
    } else {
      onChange([...selected, val]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: selected.length > 0 ? 'var(--amber)' : 'var(--border)',
          color: selected.length > 0 ? 'var(--text)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-dm-sans)',
        }}
      >
        {label}
        {selected.length > 0 && (
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
            style={{ backgroundColor: 'var(--amber)', color: '#000' }}
          >
            {selected.length}
          </span>
        )}
        <ChevronDown
          size={12}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg border shadow-lg overflow-hidden min-w-[200px]"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-2 text-xs"
              style={{ color: 'var(--red)', borderBottom: '1px solid var(--border)' }}
            >
              Alle zurücksetzen
            </button>
          )}
          <div className="max-h-64 overflow-y-auto">
            {options.map((opt) => {
              const isActive = selected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
                  style={{
                    backgroundColor: isActive ? 'var(--surface-hover)' : 'transparent',
                    color: isActive ? 'var(--text)' : 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = isActive
                      ? 'var(--surface-hover)'
                      : 'transparent';
                  }}
                >
                  <span
                    className="w-4 h-4 rounded border flex items-center justify-center text-xs"
                    style={{
                      borderColor: isActive ? 'var(--amber)' : 'var(--border)',
                      backgroundColor: isActive ? 'var(--amber)' : 'transparent',
                      color: isActive ? '#000' : 'transparent',
                    }}
                  >
                    {isActive ? <Check size={12} /> : ''}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single-select Dropdown Component                                   */
/* ------------------------------------------------------------------ */

function SelectDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: value ? 'var(--amber)' : 'var(--border)',
          color: value ? 'var(--text)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-dm-sans)',
        }}
      >
        {value || label}
        <ChevronDown
          size={12}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg border shadow-lg overflow-hidden min-w-[180px]"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {value && (
            <button
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs"
              style={{ color: 'var(--red)', borderBottom: '1px solid var(--border)' }}
            >
              Zurücksetzen
            </button>
          )}
          <div className="max-h-64 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm transition-colors"
                style={{
                  backgroundColor: opt === value ? 'var(--surface-hover)' : 'transparent',
                  color: opt === value ? 'var(--amber)' : 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    opt === value ? 'var(--surface-hover)' : 'transparent';
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Panel Component                                             */
/* ------------------------------------------------------------------ */

function DetailPanel({
  lead,
  onClose,
  onUpdate,
  onDelete,
}: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editStatus, setEditStatus] = useState(lead.status);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Escape key handler to close detail panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleStatusChange() {
    if (editStatus === lead.status) return;
    setSaving(true);
    await onUpdate(lead.id, { status: editStatus });
    setSaving(false);
  }

  async function handleAddNote() {
    if (!note.trim()) return;
    setSaving(true);
    await onUpdate(lead.id, { notizen: note.trim() });
    setNote('');
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete(lead.id);
    setDeleting(false);
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:h-full z-50 overflow-y-auto animate-slide-in-right"
        role="dialog"
        aria-label="CRM Detail Panel"
        style={{
          width: undefined,
          maxWidth: '100vw',
          backgroundColor: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
        }}
      >
        <style>{`
          @media (min-width: 768px) {
            [aria-label="CRM Detail Panel"] {
              width: 480px !important;
              left: auto !important;
              bottom: auto !important;
            }
          }
        `}</style>
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2
            className="text-lg font-bold truncate"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {lead.firma}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-5 md:space-y-6">
          {/* Lead Score Badge */}
          <div className="flex items-center gap-3">
            <span
              className={`${scoreBadgeClass(lead.leadScore)} text-sm font-bold px-4 py-2`}
            >
              Score: {lead.leadScore}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {lead.leadScore >= 70
                ? 'Heiß - Sofort kontaktieren!'
                : lead.leadScore >= 40
                ? 'Warm - Follow-up empfohlen'
                : 'Kalt - Weitere Recherche'}
            </span>
          </div>

          {/* Lead Info */}
          <div className="space-y-3">
            <h3
              className="text-xs font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              Lead Details
            </h3>
            <div
              className="rounded-xl border p-4 space-y-3"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              {[
                { label: 'Firma', value: lead.firma },
                { label: 'Kontakt', value: lead.kontakt },
                { label: 'E-Mail', value: lead.email },
                { label: 'Telefon', value: lead.telefon },
                { label: 'Website', value: lead.website },
                { label: 'Adresse', value: lead.adresse },
                { label: 'Ort', value: lead.ort },
                { label: 'Branche', value: lead.branche },
                { label: 'Kanton', value: lead.kanton },
                { label: 'Quelle', value: lead.quelle },
                { label: 'Google Rating', value: lead.googleRating != null ? `${lead.googleRating} (${lead.googleReviews ?? 0} Reviews)` : null },
                { label: 'Lead Score', value: lead.leadScore },
                { label: 'Fitness Score', value: lead.fitnessScore },
                { label: 'Umsatzpotenzial', value: lead.umsatzpotenzial ? `CHF ${lead.umsatzpotenzial.toLocaleString('de-CH')}` : null },
                { label: 'Erstellt', value: formatDate(lead.createdAt) },
                { label: 'Letzter Kontakt', value: lead.letzterKontakt ? formatDate(lead.letzterKontakt) : null },
              ]
                .filter((row) => row.value != null && row.value !== '')
                .map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4">
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {row.label}
                    </span>
                    <span
                      className="text-sm text-right"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* AI Lead Analysis */}
          <div className="space-y-3">
            <h3
              className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
            >
              <Sparkles size={14} />
              AI Analyse
            </h3>
            <div
              className="rounded-xl border p-4 space-y-3"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                backgroundImage: 'linear-gradient(135deg, color-mix(in srgb, var(--purple) 5%, transparent), transparent)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                  Conversion Wahrscheinlichkeit
                </span>
                <span
                  className="text-sm font-bold text-right"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: lead.leadScore >= 70 ? 'var(--green)' : lead.leadScore >= 40 ? 'var(--amber)' : 'var(--red)',
                  }}
                >
                  {Math.min(Math.round(lead.leadScore * 1.1), 99)}%
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                  Empfohlene nächste Aktion
                </span>
                <span
                  className="text-sm text-right"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  {lead.leadScore >= 70
                    ? 'Meeting vereinbaren'
                    : lead.leadScore >= 40
                    ? 'Follow-up E-Mail senden'
                    : 'Weitere Recherche'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                  Optimaler Kontaktzeitpunkt
                </span>
                <span
                  className="text-sm text-right"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  {lead.leadScore >= 70
                    ? 'Heute, 10:00 Uhr'
                    : lead.leadScore >= 40
                    ? 'Morgen, 14:00 Uhr'
                    : 'Nächste Woche'}
                </span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-3">
            <h3
              className="text-xs font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              Status ändern
            </h3>
            <div className="flex gap-2">
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                onClick={handleStatusChange}
                disabled={saving || editStatus === lead.status}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                style={{
                  backgroundColor: 'var(--amber)',
                  color: '#000',
                  opacity: saving || editStatus === lead.status ? 0.4 : 1,
                }}
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <h3
              className="text-xs font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              Notiz hinzufügen
            </h3>
            {lead.notizen && (
              <div
                className="rounded-lg border p-3 text-sm"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                  Aktuelle Notiz:
                </span>
                {lead.notizen}
              </div>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Neue Notiz schreiben..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
                fontFamily: 'var(--font-dm-sans)',
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--amber)';
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--border)';
              }}
            />
            <button
              onClick={handleAddNote}
              disabled={saving || !note.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{
                backgroundColor: 'var(--blue)',
                color: '#000',
                opacity: saving || !note.trim() ? 0.4 : 1,
              }}
            >
              {saving ? 'Speichern...' : 'Notiz speichern'}
            </button>
          </div>

          {/* Activity Timeline */}
          <div className="space-y-3">
            <h3
              className="text-xs font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              Aktivitäten
            </h3>
            {lead.activities.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Keine Aktivitäten vorhanden
              </p>
            ) : (
              <div className="space-y-0">
                {lead.activities.map((act, idx) => (
                  <div key={act.id} className="flex gap-3">
                    {/* Timeline bar */}
                    <div className="flex flex-col items-center">
                      <div
                        className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                        style={{
                          backgroundColor:
                            act.type === 'status_change'
                              ? 'var(--amber)'
                              : act.type === 'note'
                              ? 'var(--blue)'
                              : 'var(--text-muted)',
                        }}
                      />
                      {idx < lead.activities.length - 1 && (
                        <div
                          className="w-px flex-1 min-h-[24px]"
                          style={{ backgroundColor: 'var(--border)' }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pb-4 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                          {ACTIVITY_LABELS[act.type] || act.type}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatDateTime(act.createdAt)}
                        </span>
                      </div>
                      {act.details && (
                        <p className="text-sm mt-0.5 break-words" style={{ color: 'var(--text-secondary)' }}>
                          {act.details}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <div
            className="pt-4 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  borderColor: 'var(--red)',
                  color: 'var(--red)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.backgroundColor = 'color-mix(in srgb, var(--red) 15%, transparent)';
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.backgroundColor = 'transparent';
                }}
              >
                Lead löschen
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: 'var(--red)' }}>
                  Wirklich löschen?
                </span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg text-sm font-bold"
                  style={{ backgroundColor: 'var(--red)', color: '#fff' }}
                >
                  {deleting ? 'Löschen...' : 'Ja, löschen'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Abbrechen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Kanban View Component                                              */
/* ------------------------------------------------------------------ */

function KanbanView({
  leads,
  onLeadClick,
}: {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}) {
  const groupedByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = leads.filter((l) => l.status === status);
    return acc;
  }, {} as Record<string, Lead[]>);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4" style={{ minWidth: 'fit-content' }}>
        {STATUSES.map((status, idx) => (
          <div
            key={status}
            className="flex-shrink-0 w-[280px] md:w-80 stagger-children"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div
              className="card-glass-premium p-4 h-full"
              style={{ minHeight: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-sm font-bold uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  {status}
                </h3>
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                  style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
                >
                  {groupedByStatus[status].length}
                </span>
              </div>

              <div className="space-y-3 overflow-y-auto flex-1">
                {groupedByStatus[status].map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => onLeadClick(lead)}
                    className="rounded-xl border p-3 cursor-pointer transition-all hover-lift"
                    style={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4
                        className="text-sm font-bold truncate"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                      >
                        {lead.firma}
                      </h4>
                      <span
                        className={`${scoreBadgeClass(lead.leadScore)} text-xs px-2 py-0.5 shrink-0`}
                      >
                        {lead.leadScore}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {lead.kontakt && <div className="truncate">{lead.kontakt}</div>}
                      {lead.email && <div className="truncate">{lead.email}</div>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-hover)' }}>
                          {lead.branche}
                        </span>
                        <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-hover)' }}>
                          {lead.kanton}
                        </span>
                      </div>
                    </div>
                    {lead.umsatzpotenzial > 0 && (
                      <div
                        className="mt-2 pt-2 border-t flex items-center gap-1 text-xs font-bold"
                        style={{ borderColor: 'var(--border)', color: 'var(--green)' }}
                      >
                        <DollarSign size={12} />
                        CHF {lead.umsatzpotenzial.toLocaleString('de-CH')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main CRM Page                                                      */
/* ------------------------------------------------------------------ */

export default function CRMPage() {
  /* ---- State ---- */
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [brancheFilter, setBrancheFilter] = useState('');
  const [kantonFilter, setKantonFilter] = useState('');

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [bulkStatusDropdownOpen, setBulkStatusDropdownOpen] = useState(false);

  const limit = 50;
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const bulkStatusRef = useRef<HTMLDivElement>(null);

  /* ---- Debounced search ---- */
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [search]);

  /* ---- Reset page on filter change ---- */
  useEffect(() => {
    setPage(1);
  }, [statusFilter, brancheFilter, kantonFilter]);

  /* ---- Close bulk status dropdown on outside click ---- */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bulkStatusRef.current && !bulkStatusRef.current.contains(e.target as Node)) {
        setBulkStatusDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ---- Fetch leads ---- */
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter.length > 0) params.set('status', statusFilter.join(','));
    if (brancheFilter) params.set('branche', brancheFilter);
    if (kantonFilter) params.set('kanton', kantonFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    params.set('page', String(page));
    params.set('limit', String(limit));

    try {
      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
    } catch {
      console.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, brancheFilter, kantonFilter, debouncedSearch, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  /* ---- Update lead ---- */
  async function updateLead(id: string, data: Record<string, unknown>) {
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await fetchLeads();
    // Refresh selected lead detail
    const res = await fetch(`/api/leads/${id}`);
    if (res.ok) {
      const updated = await res.json();
      setSelectedLead(updated);
    }
  }

  /* ---- Delete lead ---- */
  async function deleteLead(id: string) {
    await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    setSelectedLead(null);
    await fetchLeads();
  }

  /* ---- Bulk actions ---- */
  function toggleSelectAll() {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map((l) => l.id));
    }
  }

  function toggleSelectLead(id: string) {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter((leadId) => leadId !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  }

  async function bulkUpdateStatus(status: string) {
    await Promise.all(
      selectedLeads.map((id) =>
        fetch(`/api/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
      )
    );
    setSelectedLeads([]);
    setBulkStatusDropdownOpen(false);
    await fetchLeads();
  }

  async function bulkDelete() {
    if (!confirm(`${selectedLeads.length} Leads wirklich löschen?`)) return;
    await Promise.all(selectedLeads.map((id) => fetch(`/api/leads/${id}`, { method: 'DELETE' })));
    setSelectedLeads([]);
    await fetchLeads();
  }

  /* ---- Statistics ---- */
  const totalLeads = total;
  const pipelineValue = leads.reduce((sum, lead) => sum + lead.umsatzpotenzial, 0);
  const avgScore = leads.length > 0 ? Math.round(leads.reduce((sum, l) => sum + l.leadScore, 0) / leads.length) : 0;
  const conversionRate = leads.length > 0 ? Math.round((leads.filter((l) => l.status === 'Won' || l.status === 'Client').length / leads.length) * 100) : 0;

  /* ---- Pagination ---- */
  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = statusFilter.length > 0 || brancheFilter || kantonFilter || debouncedSearch;

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter([]);
    setBrancheFilter('');
    setKantonFilter('');
  }

  /* ---- Render ---- */
  return (
    <div className="space-y-4 md:space-y-5">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
          CRM
        </h1>
        <div className="flex items-center gap-2 md:gap-3">
          {/* View Toggle */}
          <div
            className="flex items-center rounded-lg border overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <button
              onClick={() => setViewMode('table')}
              className="px-2.5 md:px-3 py-2 text-sm flex items-center gap-1.5 md:gap-2 transition-colors"
              style={{
                backgroundColor: viewMode === 'table' ? 'var(--amber)' : 'transparent',
                color: viewMode === 'table' ? '#000' : 'var(--text-secondary)',
              }}
            >
              <TableIcon size={16} />
              <span className="hidden sm:inline">Tabelle</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className="px-2.5 md:px-3 py-2 text-sm flex items-center gap-1.5 md:gap-2 transition-colors"
              style={{
                backgroundColor: viewMode === 'kanban' ? 'var(--amber)' : 'transparent',
                color: viewMode === 'kanban' ? '#000' : 'var(--text-secondary)',
              }}
            >
              <LayoutGrid size={16} />
              <span className="hidden sm:inline">Kanban</span>
            </button>
          </div>

          {/* Export CSV */}
          <button
            onClick={() => exportToCSV(leads)}
            className="px-3 md:px-4 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hover)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--amber)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
            }}
          >
            <Download size={16} />
            <span className="hidden sm:inline">CSV Export</span>
          </button>
        </div>
      </div>

      {/* Pipeline Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 stagger-children">
        <div className="card-glass-premium p-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--blue-glow)' }}
            >
              <Users size={20} style={{ color: 'var(--blue)' }} />
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Total Leads
              </div>
              <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                {totalLeads}
              </div>
            </div>
          </div>
        </div>

        <div className="card-glass-premium p-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--green-glow)' }}
            >
              <DollarSign size={20} style={{ color: 'var(--green)' }} />
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Pipeline Value
              </div>
              <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                CHF {Math.round(pipelineValue / 1000)}k
              </div>
            </div>
          </div>
        </div>

        <div className="card-glass-premium p-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--amber-glow)' }}
            >
              <Target size={20} style={{ color: 'var(--amber)' }} />
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Avg. Score
              </div>
              <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                {avgScore}
              </div>
            </div>
          </div>
        </div>

        <div className="card-glass-premium p-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--purple-glow)' }}
            >
              <TrendingUp size={20} style={{ color: 'var(--purple)' }} />
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Conversion Rate
              </div>
              <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                {conversionRate}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2"
          size={16}
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Firma, Kontakt, E-Mail oder Ort suchen..."
          aria-label="Leads durchsuchen"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
            fontFamily: 'var(--font-dm-sans)',
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--amber)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)';
          }}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 md:gap-3 flex-wrap overflow-x-auto pb-1">
        <MultiSelectDropdown
          label="Status"
          options={STATUSES}
          selected={statusFilter}
          onChange={setStatusFilter}
        />
        <SelectDropdown
          label="Branche"
          options={BRANCHEN}
          value={brancheFilter}
          onChange={setBrancheFilter}
        />
        <SelectDropdown
          label="Kanton"
          options={KANTONS}
          value={kantonFilter}
          onChange={setKantonFilter}
        />
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
            style={{ color: 'var(--red)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in srgb, var(--red) 10%, transparent)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            <X size={14} />
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedLeads.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto z-30 card-glass-premium p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-slide-in-up"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedLeads.length} Lead{selectedLeads.length !== 1 ? 's' : ''} ausgewählt
            </span>
            <button
              onClick={() => setSelectedLeads([])}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              Abwählen
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Bulk Status Change */}
            <div ref={bulkStatusRef} className="relative flex-1 sm:flex-none">
              <button
                onClick={() => setBulkStatusDropdownOpen(!bulkStatusDropdownOpen)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--amber)', color: '#000' }}
              >
                Status ändern
                <ChevronDown size={14} />
              </button>
              {bulkStatusDropdownOpen && (
                <div
                  className="absolute top-full right-0 mt-1 z-50 rounded-lg border shadow-lg overflow-hidden min-w-[180px]"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="max-h-64 overflow-y-auto">
                    {STATUSES.map((status) => (
                      <button
                        key={status}
                        onClick={() => bulkUpdateStatus(status)}
                        className="w-full text-left px-3 py-2 text-sm transition-colors"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hover)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                        }}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bulk Delete */}
            <button
              onClick={bulkDelete}
              className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
              style={{
                borderColor: 'var(--red)',
                color: 'var(--red)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.backgroundColor = 'color-mix(in srgb, var(--red) 15%, transparent)';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.backgroundColor = 'transparent';
              }}
            >
              Löschen
            </button>
          </div>
        </div>
      )}

      {/* Table or Kanban View */}
      {viewMode === 'kanban' ? (
        <KanbanView leads={leads} onLeadClick={setSelectedLead} />
      ) : (
        <div
          className="card-glass-premium overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th
                    className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg)',
                      width: '40px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLeads.length === leads.length && leads.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: 'var(--amber)' }}
                    />
                  </th>
                  {['Firma', 'Kontakt', 'E-Mail', 'Branche', 'Kanton', 'Status', 'Score', ''].map(
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
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-3">
                        <div className="skeleton w-4 h-4 rounded" />
                      </td>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="skeleton h-4 rounded" style={{ width: j === 0 ? '140px' : '80px' }} />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="skeleton w-6 h-6 rounded" />
                      </td>
                    </tr>
                  ))
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {hasActiveFilters
                          ? 'Keine Leads mit diesen Filtern gefunden.'
                          : 'Noch keine Leads vorhanden.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  leads.map((lead, idx) => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="cursor-pointer transition-all table-row"
                      style={{
                        borderBottom: '1px solid var(--border)',
                        animationDelay: `${idx * 30}ms`,
                      }}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => toggleSelectLead(lead.id)}
                          className="w-4 h-4 rounded cursor-pointer"
                          style={{ accentColor: 'var(--amber)' }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-sm font-medium"
                          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                        >
                          {lead.firma}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {lead.kontakt || '\u2014'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {lead.email || '\u2014'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {lead.branche}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {lead.kanton}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`${scoreBadgeClass(lead.leadScore)} text-xs px-2 py-1 font-bold`}
                        >
                          {lead.leadScore}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLead(lead);
                          }}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => {
                            const btn = e.currentTarget as HTMLButtonElement;
                            btn.style.backgroundColor = 'var(--surface-hover)';
                            btn.style.color = 'var(--text)';
                          }}
                          onMouseLeave={(e) => {
                            const btn = e.currentTarget as HTMLButtonElement;
                            btn.style.backgroundColor = 'transparent';
                            btn.style.color = 'var(--text-muted)';
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Seite {page} von {totalPages} ({total} Ergebnisse)
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-opacity"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                    opacity: page <= 1 ? 0.3 : 1,
                  }}
                >
                  Zurück
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  let p: number;
                  if (totalPages <= 5) {
                    p = i + 1;
                  } else if (page <= 3) {
                    p = i + 1;
                  } else if (page >= totalPages - 2) {
                    p = totalPages - 4 + i;
                  } else {
                    p = page - 2 + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: p === page ? 'var(--amber)' : 'transparent',
                        color: p === page ? '#000' : 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-opacity"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                    opacity: page >= totalPages ? 0.3 : 1,
                  }}
                >
                  Weiter
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Panel */}
      {selectedLead && (
        <DetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={updateLead}
          onDelete={deleteLead}
        />
      )}
    </div>
  );
}
