'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  Download,
  Upload,
  ChevronDown,
  Search,
  X,
  Check,
  TrendingUp,
  Users,
  DollarSign,
  Target,
  CalendarPlus,
  Mail,
  FileText,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  Loader2,
  FileUp,
  Building2,
  User,
  Phone,
  Globe,
  MapPin,
  Tag,
  Map,
  Clock,
  ExternalLink,
  Activity,
  Filter,
  MessageSquare,
  Send,
  Star,
  Paperclip,
  FileImage,
  FileSpreadsheet,
  File,
  UploadCloud,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import Breadcrumb from '@/components/Breadcrumb';
import { Sparkline, DonutChart } from '@/components/MiniBarChart';
import { useToast } from '@/components/Toast';

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
  tags: string;
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

const PIPELINE_STAGES = [
  'New Lead',
  'Researched',
  'Fitness Check',
  'Contacted',
  'Interested',
  'Meeting',
  'Proposal',
  'Negotiation',
  'Won',
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
/*  Tag Colors                                                         */
/* ------------------------------------------------------------------ */

const TAG_COLORS = [
  'var(--amber)',
  'var(--green)',
  'var(--blue)',
  'var(--purple)',
  'var(--cyan)',
  'var(--orange)',
  'var(--red)',
] as const;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getTagColor(tag: string): string {
  return TAG_COLORS[hashString(tag.toLowerCase().trim()) % TAG_COLORS.length];
}

function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags.split(',').map((t) => t.trim()).filter(Boolean);
}

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

/** Build 14-day activity sparkline data from lead activities */
function buildActivitySparkline(activities: Activity[]): number[] {
  const days = 14;
  const now = Date.now();
  const msPerDay = 86400000;
  const counts = new Array(days).fill(0);
  for (const a of activities) {
    const age = Math.floor((now - new Date(a.createdAt).getTime()) / msPerDay);
    if (age >= 0 && age < days) counts[days - 1 - age]++;
  }
  return counts;
}

/* ------------------------------------------------------------------ */
/*  Score Breakdown Tooltip                                            */
/* ------------------------------------------------------------------ */

function ScoreBreakdownTooltip({ lead }: { lead: Lead }) {
  const [show, setShow] = useState(false);

  // Decompose lead score into components
  const fitness = lead.fitnessScore;
  const activity = Math.min(100, lead.activities.length * 8);
  const engagement = lead.letzterKontakt
    ? Math.max(0, 100 - Math.floor((Date.now() - new Date(lead.letzterKontakt).getTime()) / 86400000) * 3)
    : 10;
  const dealValue = Math.min(100, Math.round((lead.umsatzpotenzial / 50000) * 100));

  const components = [
    { label: 'Fitness', value: fitness, color: 'var(--blue)' },
    { label: 'Aktivitaet', value: activity, color: 'var(--purple)' },
    { label: 'Engagement', value: engagement, color: 'var(--amber)' },
    { label: 'Deal-Wert', value: dealValue, color: 'var(--green)' },
  ];

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span
        className={`${scoreBadgeClass(lead.leadScore)} text-xs px-2 py-1 font-bold cursor-help`}
      >
        {lead.leadScore}
      </span>
      {show && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-3 rounded-xl"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div
            className="text-[10px] font-bold mb-2 text-center"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
          >
            SCORE BREAKDOWN
          </div>
          <div className="space-y-1.5">
            {components.map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span
                  className="text-[10px] w-16 shrink-0"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}
                >
                  {c.label}
                </span>
                <div
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, c.value))}%`,
                      backgroundColor: c.color,
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-bold w-6 text-right"
                  style={{ fontFamily: 'var(--font-mono)', color: c.color }}
                >
                  {Math.max(0, Math.min(100, c.value))}
                </span>
              </div>
            ))}
          </div>
          {/* Triangle pointer */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-1.5"
            style={{
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid var(--border)',
            }}
          />
        </div>
      )}
    </div>
  );
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
/*  Tag Filter Dropdown                                                */
/* ------------------------------------------------------------------ */

function TagFilterDropdown({
  tags,
  value,
  onChange,
}: {
  tags: string[];
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
        <Tag size={12} />
        {value || 'Tag'}
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
            {tags.map((tag) => {
              const color = getTagColor(tag);
              return (
                <button
                  key={tag}
                  onClick={() => {
                    onChange(tag);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                  style={{
                    backgroundColor: tag === value ? 'var(--surface-hover)' : 'transparent',
                    color: tag === value ? color : 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      tag === value ? 'var(--surface-hover)' : 'transparent';
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  {tag}
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
/*  Tag Chip Component                                                  */
/* ------------------------------------------------------------------ */

function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const color = getTagColor(tag);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {tag}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0 leading-none transition-colors"
          style={{ color }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.7';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
          }}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Score Ring SVG Component                                            */
/* ------------------------------------------------------------------ */

function ScoreRing({
  score,
  label,
  size = 80,
  strokeWidth = 6,
}: {
  score: number;
  label: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: `drop-shadow(0 0 6px ${color})`,
            }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontFamily: 'var(--font-mono)', color }}
        >
          <span className="text-lg font-bold">{score}</span>
        </div>
      </div>
      <span
        className="text-xs font-medium"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}
      >
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Panel Component                                             */
/* ------------------------------------------------------------------ */

interface TimelineEvent {
  id: string;
  type: string;
  details: string | null;
  createdAt: string;
}

function DetailPanel({
  lead,
  onClose,
  onUpdate,
  onDelete,
  allTags,
}: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  allTags: string[];
}) {
  const [editStatus, setEditStatus] = useState(lead.status);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Tag input state
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestOpen, setTagSuggestOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagSuggestRef = useRef<HTMLDivElement>(null);
  const leadTags = parseTags(lead.tags);

  const tagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return allTags.filter((t) => !leadTags.includes(t));
    const q = tagInput.trim().toLowerCase();
    return allTags.filter((t) => t.toLowerCase().includes(q) && !leadTags.includes(t));
  }, [tagInput, allTags, leadTags]);

  async function handleAddTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || leadTags.includes(trimmed)) return;
    const updated = [...leadTags, trimmed].join(',');
    await onUpdate(lead.id, { tags: updated });
    setTagInput('');
    setTagSuggestOpen(false);
  }

  async function handleRemoveTag(tag: string) {
    const updated = leadTags.filter((t) => t !== tag).join(',');
    await onUpdate(lead.id, { tags: updated });
  }

  // Close tag suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tagSuggestRef.current && !tagSuggestRef.current.contains(e.target as Node)) {
        setTagSuggestOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Activity timeline fetched from /api/events
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  // Quick Actions state
  const [openAction, setOpenAction] = useState<'followup' | 'email' | 'invoice' | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionSaving, setActionSaving] = useState(false);

  // Follow-Up form
  const [fuTyp, setFuTyp] = useState<'email' | 'call' | 'meeting'>('email');
  const [fuBetreff, setFuBetreff] = useState('');
  const [fuFaellig, setFuFaellig] = useState('');
  const [fuPrio, setFuPrio] = useState(3);
  const [fuNachricht, setFuNachricht] = useState('');

  // Email form
  const [emailBetreff, setEmailBetreff] = useState('');
  const [emailNachricht, setEmailNachricht] = useState('');

  // Invoice form
  const [invPositionen, setInvPositionen] = useState<{ beschreibung: string; betrag: string }[]>([{ beschreibung: '', betrag: '' }]);
  const [invMwst, setInvMwst] = useState('8.1');
  const [invFaellig, setInvFaellig] = useState('');
  const [invNotizen, setInvNotizen] = useState('');

  // File upload state
  interface UploadedFile {
    id: string;
    file: File;
    name: string;
    size: number;
    type: string;
  }
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];
  const ACCEPTED_EXTENSIONS = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.csv,.doc,.docx';
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

  function getFileIcon(fileName: string) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return <FileImage size={16} style={{ color: 'var(--purple)' }} />;
    }
    if (ext === 'pdf') {
      return <FileText size={16} style={{ color: 'var(--red)' }} />;
    }
    if (ext === 'csv') {
      return <FileSpreadsheet size={16} style={{ color: 'var(--green)' }} />;
    }
    if (['doc', 'docx'].includes(ext)) {
      return <FileText size={16} style={{ color: 'var(--blue)' }} />;
    }
    return <File size={16} style={{ color: 'var(--text-muted)' }} />;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function processFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const validFiles: UploadedFile[] = [];
    const rejected: string[] = [];

    for (const f of fileArray) {
      if (!ACCEPTED_TYPES.includes(f.type) && !ACCEPTED_EXTENSIONS.split(',').some(ext => f.name.toLowerCase().endsWith(ext))) {
        rejected.push(`${f.name}: Dateityp nicht unterstuetzt`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        rejected.push(`${f.name}: Datei zu gross (max. 25 MB)`);
        continue;
      }
      if (uploadedFiles.some(uf => uf.name === f.name && uf.size === f.size)) {
        rejected.push(`${f.name}: Bereits hinzugefuegt`);
        continue;
      }
      validFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file: f,
        name: f.name,
        size: f.size,
        type: f.type,
      });
    }

    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
    }
    if (rejected.length > 0) {
      // Show first rejection reason via inline message (actionMessage already exists in the component)
      setActionMessage({ type: 'error', text: rejected[0] });
    }
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = ''; // reset so same file can be re-selected
    }
  }

  function handleRemoveFile(fileId: string) {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  }

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

  // Parse notes from JSON array or legacy string
  function parseNotes(): { text: string; createdAt: string }[] {
    if (!lead.notizen) return [];
    try {
      const parsed = JSON.parse(lead.notizen);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Legacy: single string note
    }
    return [{ text: lead.notizen, createdAt: lead.createdAt || new Date().toISOString() }];
  }

  async function handleAddNote() {
    if (!note.trim()) return;
    setSaving(true);
    const existing = parseNotes();
    const updated = [...existing, { text: note.trim(), createdAt: new Date().toISOString() }];
    await onUpdate(lead.id, { notizen: JSON.stringify(updated) });
    setNote('');
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete(lead.id);
    setDeleting(false);
  }

  function toggleAction(action: 'followup' | 'email' | 'invoice') {
    setOpenAction(openAction === action ? null : action);
    setActionMessage(null);
  }

  function resetFollowUpForm() {
    setFuTyp('email');
    setFuBetreff('');
    setFuFaellig('');
    setFuPrio(3);
    setFuNachricht('');
  }

  function resetEmailForm() {
    setEmailBetreff('');
    setEmailNachricht('');
  }

  function resetInvoiceForm() {
    setInvPositionen([{ beschreibung: '', betrag: '' }]);
    setInvMwst('8.1');
    setInvFaellig('');
    setInvNotizen('');
  }

  async function handleFollowUp() {
    if (!fuBetreff.trim() || !fuFaellig) return;
    setActionSaving(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          type: fuTyp,
          subject: fuBetreff.trim(),
          dueDate: fuFaellig,
          priority: fuPrio,
          message: fuNachricht.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('Fehler beim Erstellen');
      setActionMessage({ type: 'success', text: 'Follow-Up erfolgreich erstellt!' });
      resetFollowUpForm();
    } catch {
      setActionMessage({ type: 'error', text: 'Follow-Up konnte nicht erstellt werden.' });
    } finally {
      setActionSaving(false);
    }
  }

  async function handleSendEmail() {
    if (!emailBetreff.trim() || !emailNachricht.trim()) return;
    setActionSaving(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/mailing/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lead.email,
          subject: emailBetreff.trim(),
          body: emailNachricht.trim(),
          leadId: lead.id,
        }),
      });
      if (!res.ok) throw new Error('Fehler beim Senden');
      setActionMessage({ type: 'success', text: 'E-Mail erfolgreich gesendet!' });
      resetEmailForm();
    } catch {
      setActionMessage({ type: 'error', text: 'E-Mail konnte nicht gesendet werden.' });
    } finally {
      setActionSaving(false);
    }
  }

  async function handleCreateInvoice() {
    const validPositionen = invPositionen.filter((p) => p.beschreibung.trim() && p.betrag.trim());
    if (validPositionen.length === 0 || !invFaellig) return;
    setActionSaving(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/finanzen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'invoice',
          kunde: lead.firma,
          positionen: validPositionen.map((p) => ({
            beschreibung: p.beschreibung.trim(),
            betrag: parseFloat(p.betrag),
          })),
          mwstSatz: parseFloat(invMwst),
          faelligAm: invFaellig,
          notizen: invNotizen.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('Fehler beim Erstellen');
      setActionMessage({ type: 'success', text: 'Rechnung erfolgreich erstellt!' });
      resetInvoiceForm();
    } catch {
      setActionMessage({ type: 'error', text: 'Rechnung konnte nicht erstellt werden.' });
    } finally {
      setActionSaving(false);
    }
  }

  /* Score ring helpers for header */
  const ringSize = 56;
  const ringStroke = 5;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (lead.leadScore / 100) * ringCircumference;
  const ringColor = scoreColor(lead.leadScore);

  /* Activity icon helper */
  const activityIcon = (type: string) => {
    switch (type) {
      case 'status_change': return <TrendingUp size={12} />;
      case 'note': return <FileText size={12} />;
      case 'email_sent': return <Mail size={12} />;
      case 'call': return <Phone size={12} />;
      case 'meeting': return <Users size={12} />;
      case 'scrape': return <Globe size={12} />;
      case 'fitness_check': return <Target size={12} />;
      default: return <Activity size={12} />;
    }
  };

  const activityColor = (type: string) => {
    switch (type) {
      case 'status_change': return 'var(--amber)';
      case 'note': return 'var(--blue)';
      case 'email_sent': return 'var(--cyan)';
      case 'call': return 'var(--green)';
      case 'meeting': return 'var(--purple)';
      case 'scrape': return 'var(--orange)';
      case 'fitness_check': return 'var(--amber)';
      default: return 'var(--text-muted)';
    }
  };

  /* Icon map for info rows */
  const infoIconMap: Record<string, React.ReactNode> = {
    Firma: <Building2 size={14} style={{ color: 'var(--blue)' }} />,
    Kontakt: <User size={14} style={{ color: 'var(--green)' }} />,
    'E-Mail': <Mail size={14} style={{ color: 'var(--cyan)' }} />,
    Telefon: <Phone size={14} style={{ color: 'var(--amber)' }} />,
    Website: <Globe size={14} style={{ color: 'var(--purple)' }} />,
    Adresse: <MapPin size={14} style={{ color: 'var(--red)' }} />,
    Ort: <MapPin size={14} style={{ color: 'var(--red)' }} />,
    Branche: <Tag size={14} style={{ color: 'var(--orange)' }} />,
    Kanton: <Map size={14} style={{ color: 'var(--green)' }} />,
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
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
          backgroundColor: 'color-mix(in srgb, var(--surface) 85%, transparent)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          borderLeft: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
        }}
      >
        <style>{`
          @media (min-width: 768px) {
            [aria-label="CRM Detail Panel"] {
              width: 520px !important;
              left: auto !important;
              bottom: auto !important;
            }
          }
          @keyframes score-ring-fill {
            from { stroke-dashoffset: ${ringCircumference}; }
          }
        `}</style>

        {/* ── Premium Glassmorphism Header ── */}
        <div
          className="sticky top-0 z-10 border-b"
          style={{
            borderColor: 'color-mix(in srgb, var(--border) 50%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--surface) 80%, transparent)',
            backdropFilter: 'blur(24px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
          }}
        >
          <div className="px-4 md:px-6 py-4 md:py-5 flex items-center gap-4">
            {/* Score Ring in Header */}
            <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
              <svg width={ringSize} height={ringSize} className="transform -rotate-90">
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  fill="none"
                  stroke="color-mix(in srgb, var(--border) 40%, transparent)"
                  strokeWidth={ringStroke}
                />
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth={ringStroke}
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  style={{
                    animation: 'score-ring-fill 1s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                    filter: `drop-shadow(0 0 6px ${ringColor})`,
                  }}
                />
              </svg>
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ fontFamily: 'var(--font-mono)', color: ringColor }}
              >
                <span className="text-sm font-bold">{lead.leadScore}</span>
              </div>
            </div>

            {/* Firma Name + Status Badge */}
            <div className="flex-1 min-w-0">
              <h2
                className="text-lg font-bold truncate"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
              >
                {lead.firma}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={lead.status} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {lead.leadScore >= 70
                    ? 'Heiss - Sofort kontaktieren!'
                    : lead.leadScore >= 40
                    ? 'Warm - Follow-up empfohlen'
                    : 'Kalt - Weitere Recherche'}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-all shrink-0"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'color-mix(in srgb, var(--border) 20%, transparent)',
              }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.backgroundColor = 'color-mix(in srgb, var(--red) 20%, transparent)';
                btn.style.color = 'var(--red)';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                btn.style.backgroundColor = 'color-mix(in srgb, var(--border) 20%, transparent)';
                btn.style.color = 'var(--text-secondary)';
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-5 md:space-y-6">

          {/* ── Score Visualization Section ── */}
          <div
            className="rounded-xl border p-4"
            style={{
              borderColor: 'color-mix(in srgb, var(--border) 50%, transparent)',
              backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center gap-5">
              <ScoreRing score={lead.leadScore} label="Lead Score" size={80} strokeWidth={6} />
              {lead.fitnessScore != null && (
                <ScoreRing score={lead.fitnessScore} label="Fitness" size={80} strokeWidth={6} />
              )}
              <div className="flex-1 space-y-2">
                {lead.umsatzpotenzial != null && lead.umsatzpotenzial > 0 && (
                  <div>
                    <span className="text-xs block" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
                      Umsatzpotenzial
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
                    >
                      CHF {lead.umsatzpotenzial.toLocaleString('de-CH')}
                    </span>
                  </div>
                )}
                {lead.googleRating != null && (
                  <div>
                    <span className="text-xs block" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
                      Google Rating
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
                    >
                      {lead.googleRating} ({lead.googleReviews ?? 0} Reviews)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Lead Info with Icons ── */}
          <div className="space-y-3">
            <h3
              className="text-xs font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              Lead Details
            </h3>
            <div
              className="rounded-xl border p-4 space-y-0.5"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
                borderColor: 'color-mix(in srgb, var(--border) 50%, transparent)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {([
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
                { label: 'Erstellt', value: formatDate(lead.createdAt) },
                { label: 'Letzter Kontakt', value: lead.letzterKontakt ? formatDate(lead.letzterKontakt) : null },
              ] as { label: string; value: string | number | null | undefined }[])
                .filter((row) => row.value != null && row.value !== '')
                .map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center gap-3 py-2 rounded-lg px-2 transition-colors"
                    style={{ cursor: 'default' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = 'color-mix(in srgb, var(--border) 15%, transparent)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--border) 25%, transparent)' }}
                    >
                      {infoIconMap[row.label] || <Clock size={14} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <span className="text-xs shrink-0 w-24" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
                      {row.label}
                    </span>
                    <span
                      className="text-sm flex-1 text-right truncate"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                    >
                      {row.label === 'Website' && typeof row.value === 'string' ? (
                        <a
                          href={row.value.startsWith('http') ? row.value : `https://${row.value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1"
                          style={{ color: 'var(--blue)' }}
                        >
                          {row.value}
                          <ExternalLink size={10} />
                        </a>
                      ) : row.label === 'E-Mail' && typeof row.value === 'string' ? (
                        <a
                          href={`mailto:${row.value}`}
                          style={{ color: 'var(--cyan)' }}
                        >
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* ── Tags Section ── */}
          <div className="space-y-3">
            <h3
              className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}
            >
              <Tag size={14} />
              Tags
            </h3>
            <div
              className="rounded-xl border p-4"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
                borderColor: 'color-mix(in srgb, var(--border) 50%, transparent)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Existing tags as chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {leadTags.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Keine Tags
                  </span>
                )}
                {leadTags.map((tag) => (
                  <TagChip key={tag} tag={tag} onRemove={() => handleRemoveTag(tag)} />
                ))}
              </div>

              {/* Tag input with auto-suggest */}
              <div ref={tagSuggestRef} className="relative">
                <div className="flex gap-2">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value);
                      setTagSuggestOpen(true);
                    }}
                    onFocus={() => setTagSuggestOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        handleAddTag(tagInput);
                      }
                    }}
                    placeholder="Tag hinzufügen..."
                    className="flex-1 px-3 py-1.5 rounded-lg border text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                  />
                  <button
                    onClick={() => handleAddTag(tagInput)}
                    disabled={!tagInput.trim()}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: tagInput.trim() ? 'var(--cyan)' : 'var(--surface)',
                      color: tagInput.trim() ? '#000' : 'var(--text-muted)',
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Auto-suggest dropdown */}
                {tagSuggestOpen && tagSuggestions.length > 0 && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border shadow-lg overflow-hidden"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div className="max-h-32 overflow-y-auto">
                      {tagSuggestions.map((tag) => {
                        const color = getTagColor(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => handleAddTag(tag)}
                            className="w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2"
                            style={{ color: 'var(--text-secondary)' }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hover)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
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
                backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
                borderColor: 'color-mix(in srgb, var(--purple) 25%, var(--border))',
                backgroundImage: 'linear-gradient(135deg, color-mix(in srgb, var(--purple) 8%, transparent), transparent)',
                backdropFilter: 'blur(12px)',
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

          {/* Schnellaktionen */}
          <div className="space-y-3">
            <h3
              className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
            >
              <Sparkles size={14} />
              Schnellaktionen
            </h3>

            {/* Action Message */}
            {actionMessage && (
              <div
                className="rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: actionMessage.type === 'success'
                    ? 'color-mix(in srgb, var(--green) 15%, transparent)'
                    : 'color-mix(in srgb, var(--red) 15%, transparent)',
                  color: actionMessage.type === 'success' ? 'var(--green)' : 'var(--red)',
                  border: `1px solid ${actionMessage.type === 'success' ? 'var(--green)' : 'var(--red)'}`,
                }}
              >
                {actionMessage.text}
              </div>
            )}

            {/* Follow-Up erstellen */}
            <div
              className="rounded-xl border overflow-hidden"
              style={{
                borderColor: openAction === 'followup' ? 'var(--amber)' : 'color-mix(in srgb, var(--border) 50%, transparent)',
                backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <button
                onClick={() => toggleAction('followup')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: openAction === 'followup' ? 'color-mix(in srgb, var(--amber) 10%, var(--bg))' : 'transparent',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-dm-sans)',
                }}
                onMouseEnter={(e) => {
                  if (openAction !== 'followup') (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in srgb, var(--border) 15%, transparent)';
                }}
                onMouseLeave={(e) => {
                  if (openAction !== 'followup') (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                <CalendarPlus size={16} style={{ color: 'var(--amber)' }} />
                <span className="flex-1 text-left">Follow-Up erstellen</span>
                <ChevronDown
                  size={14}
                  style={{
                    color: 'var(--text-muted)',
                    transform: openAction === 'followup' ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              </button>
              {openAction === 'followup' && (
                <div
                  className="px-4 pb-4 space-y-3 border-t"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg) 80%, transparent)' }}
                >
                  <div className="pt-3 space-y-3">
                    {/* Typ */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Typ</label>
                      <select
                        value={fuTyp}
                        onChange={(e) => setFuTyp(e.target.value as 'email' | 'call' | 'meeting')}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                      >
                        <option value="email">E-Mail</option>
                        <option value="call">Anruf</option>
                        <option value="meeting">Meeting</option>
                      </select>
                    </div>
                    {/* Betreff */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Betreff</label>
                      <input
                        type="text"
                        value={fuBetreff}
                        onChange={(e) => setFuBetreff(e.target.value)}
                        placeholder="Betreff eingeben..."
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                        onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--amber)'; }}
                        onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                      />
                    </div>
                    {/* Faellig am */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Fällig am</label>
                      <input
                        type="date"
                        value={fuFaellig}
                        onChange={(e) => setFuFaellig(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                        onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--amber)'; }}
                        onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                      />
                    </div>
                    {/* Prioritaet */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Priorität (1-5)</label>
                      <select
                        value={fuPrio}
                        onChange={(e) => setFuPrio(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n}{n === 1 ? ' (Höchste)' : n === 5 ? ' (Niedrigste)' : ''}</option>
                        ))}
                      </select>
                    </div>
                    {/* Nachricht */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Nachricht (optional)</label>
                      <textarea
                        value={fuNachricht}
                        onChange={(e) => setFuNachricht(e.target.value)}
                        placeholder="Zusätzliche Nachricht..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                        onFocus={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--amber)'; }}
                        onBlur={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--border)'; }}
                      />
                    </div>
                    <button
                      onClick={handleFollowUp}
                      disabled={actionSaving || !fuBetreff.trim() || !fuFaellig}
                      className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                      style={{
                        backgroundColor: 'var(--amber)',
                        color: '#000',
                        opacity: actionSaving || !fuBetreff.trim() || !fuFaellig ? 0.4 : 1,
                      }}
                    >
                      {actionSaving ? 'Erstellen...' : 'Follow-Up erstellen'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* E-Mail senden */}
            <div
              className="rounded-xl border overflow-hidden"
              style={{
                borderColor: openAction === 'email' ? 'var(--blue)' : 'color-mix(in srgb, var(--border) 50%, transparent)',
                backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <button
                onClick={() => toggleAction('email')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: openAction === 'email' ? 'color-mix(in srgb, var(--blue) 10%, var(--bg))' : 'transparent',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-dm-sans)',
                }}
                onMouseEnter={(e) => {
                  if (openAction !== 'email') (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in srgb, var(--border) 15%, transparent)';
                }}
                onMouseLeave={(e) => {
                  if (openAction !== 'email') (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                <Mail size={16} style={{ color: 'var(--blue)' }} />
                <span className="flex-1 text-left">E-Mail senden</span>
                <ChevronDown
                  size={14}
                  style={{
                    color: 'var(--text-muted)',
                    transform: openAction === 'email' ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              </button>
              {openAction === 'email' && (
                <div
                  className="px-4 pb-4 space-y-3 border-t"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg) 80%, transparent)' }}
                >
                  <div className="pt-3 space-y-3">
                    {/* An */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>An</label>
                      <input
                        type="text"
                        value={lead.email || ''}
                        disabled
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                      />
                    </div>
                    {/* Betreff */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Betreff</label>
                      <input
                        type="text"
                        value={emailBetreff}
                        onChange={(e) => setEmailBetreff(e.target.value)}
                        placeholder="E-Mail Betreff..."
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                        onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--blue)'; }}
                        onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                      />
                    </div>
                    {/* Nachricht */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Nachricht</label>
                      <textarea
                        value={emailNachricht}
                        onChange={(e) => setEmailNachricht(e.target.value)}
                        placeholder="E-Mail Nachricht schreiben..."
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                        onFocus={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--blue)'; }}
                        onBlur={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--border)'; }}
                      />
                    </div>
                    <button
                      onClick={handleSendEmail}
                      disabled={actionSaving || !emailBetreff.trim() || !emailNachricht.trim() || !lead.email}
                      className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                      style={{
                        backgroundColor: 'var(--blue)',
                        color: '#000',
                        opacity: actionSaving || !emailBetreff.trim() || !emailNachricht.trim() || !lead.email ? 0.4 : 1,
                      }}
                    >
                      {actionSaving ? 'Senden...' : 'E-Mail senden'}
                    </button>
                    {!lead.email && (
                      <p className="text-xs" style={{ color: 'var(--red)' }}>
                        Keine E-Mail-Adresse für diesen Lead hinterlegt.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Rechnung erstellen */}
            <div
              className="rounded-xl border overflow-hidden"
              style={{
                borderColor: openAction === 'invoice' ? 'var(--green)' : 'color-mix(in srgb, var(--border) 50%, transparent)',
                backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <button
                onClick={() => toggleAction('invoice')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: openAction === 'invoice' ? 'color-mix(in srgb, var(--green) 10%, var(--bg))' : 'transparent',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-dm-sans)',
                }}
                onMouseEnter={(e) => {
                  if (openAction !== 'invoice') (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in srgb, var(--border) 15%, transparent)';
                }}
                onMouseLeave={(e) => {
                  if (openAction !== 'invoice') (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                <FileText size={16} style={{ color: 'var(--green)' }} />
                <span className="flex-1 text-left">Rechnung erstellen</span>
                <ChevronDown
                  size={14}
                  style={{
                    color: 'var(--text-muted)',
                    transform: openAction === 'invoice' ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              </button>
              {openAction === 'invoice' && (
                <div
                  className="px-4 pb-4 space-y-3 border-t"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg) 80%, transparent)' }}
                >
                  <div className="pt-3 space-y-3">
                    {/* Kunde */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Kunde</label>
                      <input
                        type="text"
                        value={lead.firma}
                        disabled
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                      />
                    </div>
                    {/* Positionen */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Positionen</label>
                      <div className="space-y-2">
                        {invPositionen.map((pos, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={pos.beschreibung}
                              onChange={(e) => {
                                const updated = [...invPositionen];
                                updated[idx] = { ...updated[idx], beschreibung: e.target.value };
                                setInvPositionen(updated);
                              }}
                              placeholder="Beschreibung"
                              className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
                              style={{
                                backgroundColor: 'var(--bg)',
                                borderColor: 'var(--border)',
                                color: 'var(--text)',
                                fontFamily: 'var(--font-dm-sans)',
                              }}
                              onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--green)'; }}
                              onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                            />
                            <div className="relative">
                              <span
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                CHF
                              </span>
                              <input
                                type="number"
                                value={pos.betrag}
                                onChange={(e) => {
                                  const updated = [...invPositionen];
                                  updated[idx] = { ...updated[idx], betrag: e.target.value };
                                  setInvPositionen(updated);
                                }}
                                placeholder="0.00"
                                className="w-[120px] pl-10 pr-3 py-2 rounded-lg border text-sm outline-none"
                                style={{
                                  backgroundColor: 'var(--bg)',
                                  borderColor: 'var(--border)',
                                  color: 'var(--text)',
                                  fontFamily: 'var(--font-mono)',
                                }}
                                onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--green)'; }}
                                onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                              />
                            </div>
                            {invPositionen.length > 1 && (
                              <button
                                onClick={() => setInvPositionen(invPositionen.filter((_, i) => i !== idx))}
                                className="p-1.5 rounded-lg transition-colors shrink-0"
                                style={{ color: 'var(--red)' }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in srgb, var(--red) 15%, transparent)';
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                                }}
                              >
                                <Minus size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setInvPositionen([...invPositionen, { beschreibung: '', betrag: '' }])}
                        className="flex items-center gap-1.5 mt-2 text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                        style={{ color: 'var(--green)' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in srgb, var(--green) 10%, transparent)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                        }}
                      >
                        <Plus size={12} />
                        Position hinzufügen
                      </button>
                    </div>
                    {/* MwSt-Satz */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>MwSt-Satz (%)</label>
                      <input
                        type="number"
                        value={invMwst}
                        onChange={(e) => setInvMwst(e.target.value)}
                        step="0.1"
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-mono)',
                        }}
                        onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--green)'; }}
                        onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                      />
                    </div>
                    {/* Faellig am */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Fällig am</label>
                      <input
                        type="date"
                        value={invFaellig}
                        onChange={(e) => setInvFaellig(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                        onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--green)'; }}
                        onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                      />
                    </div>
                    {/* Notizen */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Notizen (optional)</label>
                      <textarea
                        value={invNotizen}
                        onChange={(e) => setInvNotizen(e.target.value)}
                        placeholder="Zusätzliche Notizen zur Rechnung..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                        style={{
                          backgroundColor: 'var(--bg)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                        onFocus={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--green)'; }}
                        onBlur={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--border)'; }}
                      />
                    </div>
                    {/* Total preview */}
                    {invPositionen.some((p) => p.betrag) && (
                      <div
                        className="rounded-lg border p-3 space-y-1"
                        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                      >
                        <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span>Zwischensumme</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>
                            CHF {invPositionen.reduce((s, p) => s + (parseFloat(p.betrag) || 0), 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span>MwSt ({invMwst}%)</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>
                            CHF {(invPositionen.reduce((s, p) => s + (parseFloat(p.betrag) || 0), 0) * (parseFloat(invMwst) || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                        <div
                          className="flex justify-between text-sm font-bold pt-1 border-t"
                          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                        >
                          <span>Total</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
                            CHF {(invPositionen.reduce((s, p) => s + (parseFloat(p.betrag) || 0), 0) * (1 + (parseFloat(invMwst) || 0) / 100)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={handleCreateInvoice}
                      disabled={actionSaving || !invPositionen.some((p) => p.beschreibung.trim() && p.betrag.trim()) || !invFaellig}
                      className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                      style={{
                        backgroundColor: 'var(--green)',
                        color: '#000',
                        opacity: actionSaving || !invPositionen.some((p) => p.beschreibung.trim() && p.betrag.trim()) || !invFaellig ? 0.4 : 1,
                      }}
                    >
                      {actionSaving ? 'Erstellen...' : 'Rechnung erstellen'}
                    </button>
                  </div>
                </div>
              )}
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

          {/* Notes (Chat-style) */}
          <div className="space-y-3">
            <h3
              className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              <MessageSquare size={14} style={{ color: 'var(--blue)' }} />
              Notizen
              {parseNotes().length > 0 && (
                <span
                  className="inline-flex items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: 'rgba(96,165,250,0.15)',
                    color: 'var(--blue)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {parseNotes().length}
                </span>
              )}
            </h3>

            {/* Notes history */}
            {parseNotes().length > 0 && (
              <div
                className="rounded-xl border overflow-hidden"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--border)',
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {parseNotes().map((n, i) => (
                  <div
                    key={i}
                    className="px-3 py-2.5 text-sm"
                    style={{
                      borderBottom: i < parseNotes().length - 1 ? '1px solid var(--border)' : 'none',
                      color: 'var(--text)',
                    }}
                  >
                    <p style={{ fontFamily: 'var(--font-dm-sans)', lineHeight: 1.5, margin: 0 }}>
                      {n.text}
                    </p>
                    <span
                      className="text-[10px] mt-1 block"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      {new Date(n.createdAt).toLocaleDateString('de-CH', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}{' '}
                      {new Date(n.createdAt).toLocaleTimeString('de-CH', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Input row */}
            <div className="flex gap-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Neue Notiz schreiben..."
                rows={2}
                className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none resize-none"
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
              />
              <button
                onClick={handleAddNote}
                disabled={saving || !note.trim()}
                className="self-end p-2.5 rounded-lg transition-opacity"
                style={{
                  backgroundColor: 'var(--blue)',
                  color: '#000',
                  opacity: saving || !note.trim() ? 0.3 : 1,
                }}
                title="Notiz senden (Cmd+Enter)"
              >
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* ── Activity Timeline (Premium) ── */}
          <div className="space-y-3">
            <h3
              className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
            >
              <Activity size={14} style={{ color: 'var(--cyan)' }} />
              Aktivitäten
            </h3>
            {lead.activities.length === 0 ? (
              <div
                className="rounded-xl border p-6 text-center"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--border) 50%, transparent)',
                }}
              >
                <Clock size={24} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
                  Keine Aktivitäten vorhanden
                </p>
              </div>
            ) : (
              <div
                className="rounded-xl border p-4"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--border) 50%, transparent)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div className="relative">
                  {/* Vertical connecting line */}
                  {lead.activities.length > 1 && (
                    <div
                      className="absolute left-[13px] top-[20px] bottom-[20px] w-px"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--border) 60%, transparent)' }}
                    />
                  )}
                  <div className="space-y-0">
                    {lead.activities.map((act, idx) => {
                      const aColor = activityColor(act.type);
                      return (
                        <div key={act.id} className="flex gap-3 relative">
                          {/* Activity Icon Node */}
                          <div className="flex flex-col items-center z-10">
                            <div
                              className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0"
                              style={{
                                backgroundColor: `color-mix(in srgb, ${aColor} 15%, var(--bg))`,
                                border: `1.5px solid ${aColor}`,
                                color: aColor,
                              }}
                            >
                              {activityIcon(act.type)}
                            </div>
                          </div>

                          {/* Content */}
                          <div
                            className="pb-4 flex-1 min-w-0 pt-0.5"
                            style={{ paddingBottom: idx === lead.activities.length - 1 ? '0' : '16px' }}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-xs font-medium px-2 py-0.5 rounded-md"
                                style={{
                                  color: aColor,
                                  backgroundColor: `color-mix(in srgb, ${aColor} 10%, transparent)`,
                                  fontFamily: 'var(--font-dm-sans)',
                                }}
                              >
                                {ACTIVITY_LABELS[act.type] || act.type}
                              </span>
                              <span
                                className="text-xs flex items-center gap-1"
                                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                              >
                                <Clock size={10} />
                                {formatDateTime(act.createdAt)}
                              </span>
                            </div>
                            {act.details && (
                              <p
                                className="text-sm mt-1 break-words leading-relaxed"
                                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}
                              >
                                {act.details}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── File Upload Zone ── */}
          <div
            className="pt-4 border-t"
            style={{ borderColor: 'color-mix(in srgb, var(--border) 50%, transparent)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Paperclip size={14} style={{ color: 'var(--cyan)' }} />
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                Dateien
              </span>
              {uploadedFiles.length > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--cyan) 15%, transparent)',
                    color: 'var(--cyan)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {uploadedFiles.length}
                </span>
              )}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl cursor-pointer transition-all duration-200"
              style={{
                border: isDragOver
                  ? '2px dashed var(--cyan)'
                  : '2px dashed color-mix(in srgb, var(--border) 70%, transparent)',
                backgroundColor: isDragOver
                  ? 'color-mix(in srgb, var(--cyan) 8%, var(--bg))'
                  : 'color-mix(in srgb, var(--surface) 40%, transparent)',
                padding: '20px',
                textAlign: 'center' as const,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <div className="flex flex-col items-center gap-2">
                <div
                  className="rounded-full p-2.5"
                  style={{
                    backgroundColor: isDragOver
                      ? 'color-mix(in srgb, var(--cyan) 20%, transparent)'
                      : 'color-mix(in srgb, var(--border) 30%, transparent)',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <UploadCloud
                    size={22}
                    style={{
                      color: isDragOver ? 'var(--cyan)' : 'var(--text-muted)',
                      transition: 'color 0.2s',
                    }}
                  />
                </div>
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: isDragOver ? 'var(--cyan)' : 'var(--text)',
                      fontFamily: 'var(--font-dm-sans)',
                      transition: 'color 0.2s',
                    }}
                  >
                    {isDragOver ? 'Dateien hier ablegen' : 'Dateien hierher ziehen'}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    oder klicken zum Auswaehlen &middot; PDF, Bilder, CSV, DOCX
                  </p>
                </div>
              </div>
            </div>

            {/* Uploaded file list */}
            {uploadedFiles.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {uploadedFiles.map((uf) => (
                  <div
                    key={uf.id}
                    className="card-glass-premium flex items-center gap-3 rounded-lg px-3 py-2.5 group"
                    style={{
                      border: '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
                    }}
                  >
                    <div
                      className="shrink-0 rounded-md p-1.5"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--border) 25%, transparent)',
                      }}
                    >
                      {getFileIcon(uf.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-sans)' }}
                        title={uf.name}
                      >
                        {uf.name}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                      >
                        {formatFileSize(uf.size)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveFile(uf.id); }}
                      className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--red)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in srgb, var(--red) 15%, transparent)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                      }}
                      title="Datei entfernen"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <div
            className="pt-4 border-t"
            style={{ borderColor: 'color-mix(in srgb, var(--border) 50%, transparent)' }}
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
  onStatusChange,
}: {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onStatusChange: (id: string, newStatus: string) => Promise<void>;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const groupedByStatus = PIPELINE_STAGES.reduce((acc, status) => {
    acc[status] = leads.filter((l) => l.status === status);
    return acc;
  }, {} as Record<string, Lead[]>);

  function handleDragStart(e: React.DragEvent, leadId: string) {
    setDraggedId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', leadId);
    // Make the drag preview slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }

  function handleDragEnd(e: React.DragEvent) {
    setDraggedId(null);
    setDropTarget(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }

  function handleDragOver(e: React.DragEvent, status: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(status);
  }

  function handleDragLeave() {
    setDropTarget(null);
  }

  async function handleDrop(e: React.DragEvent, newStatus: string) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain');
    setDraggedId(null);
    setDropTarget(null);
    if (leadId) {
      const lead = leads.find((l) => l.id === leadId);
      if (lead && lead.status !== newStatus) {
        await onStatusChange(leadId, newStatus);
      }
    }
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4" style={{ minWidth: 'fit-content' }}>
        {PIPELINE_STAGES.map((status, idx) => {
          const isDropping = dropTarget === status;
          return (
            <div
              key={status}
              className="flex-shrink-0 w-[280px] md:w-80 stagger-children"
              style={{ animationDelay: `${idx * 50}ms` }}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div
                className="card-glass-premium p-4 h-full transition-all duration-200"
                style={{
                  minHeight: '500px',
                  maxHeight: '80vh',
                  display: 'flex',
                  flexDirection: 'column',
                  borderColor: isDropping ? 'var(--amber)' : undefined,
                  boxShadow: isDropping ? '0 0 20px rgba(245, 158, 11, 0.15), inset 0 0 20px rgba(245, 158, 11, 0.05)' : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3
                    className="text-sm font-bold uppercase tracking-wider"
                    style={{ fontFamily: 'var(--font-mono)', color: isDropping ? 'var(--amber)' : 'var(--text)' }}
                  >
                    {status}
                  </h3>
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: isDropping ? 'var(--amber)' : 'var(--surface-hover)',
                      color: isDropping ? '#000' : 'var(--text-secondary)',
                    }}
                  >
                    {groupedByStatus[status].length}
                  </span>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1">
                  {groupedByStatus[status].map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onLeadClick(lead)}
                      className="rounded-xl border p-3 cursor-grab transition-all hover-lift active:cursor-grabbing"
                      style={{
                        backgroundColor: draggedId === lead.id ? 'var(--bg)' : 'var(--surface)',
                        borderColor: draggedId === lead.id ? 'var(--amber)' : 'var(--border)',
                        opacity: draggedId === lead.id ? 0.5 : 1,
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
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-hover)' }}>
                            {lead.branche}
                          </span>
                          <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-hover)' }}>
                            {lead.kanton}
                          </span>
                        </div>
                        {parseTags(lead.tags).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {parseTags(lead.tags).slice(0, 3).map((tag) => (
                              <TagChip key={tag} tag={tag} />
                            ))}
                            {parseTags(lead.tags).length > 3 && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: 'color-mix(in srgb, var(--border) 30%, transparent)',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                +{parseTags(lead.tags).length - 3}
                              </span>
                            )}
                          </div>
                        )}
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
                  {isDropping && groupedByStatus[status].length === 0 && (
                    <div
                      className="rounded-xl border-2 border-dashed p-6 text-center"
                      style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
                    >
                      <p className="text-xs font-medium">Hierher ziehen</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline Edit Cell                                                    */
/* ------------------------------------------------------------------ */

function InlineEditCell({
  value,
  field,
  leadId,
  onSave,
  mono,
}: {
  value: string | null;
  field: string;
  leadId: string;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
  mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function handleSave() {
    if (editValue.trim() !== (value || '')) {
      await onSave(leadId, { [field]: editValue.trim() || null });
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') { setEditValue(value || ''); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full px-2 py-1 rounded border text-sm outline-none"
        style={{
          backgroundColor: 'var(--bg)',
          borderColor: 'var(--amber)',
          color: 'var(--text)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-dm-sans)',
          minWidth: '80px',
        }}
      />
    );
  }

  return (
    <span
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); setEditValue(value || ''); }}
      className={`text-sm ${mono ? 'font-medium' : ''}`}
      style={{
        fontFamily: mono ? 'var(--font-mono)' : undefined,
        color: value ? (mono ? 'var(--text)' : 'var(--text-secondary)') : 'var(--text-muted)',
        cursor: 'text',
      }}
      title="Doppelklick zum Bearbeiten"
    >
      {value || '\u2014'}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Lead Source Chart                                                   */
/* ------------------------------------------------------------------ */

const SOURCE_COLORS: Record<string, string> = {
  Scraper: 'var(--blue)',
  Manuell: 'var(--green)',
  Import: 'var(--amber)',
  Empfehlung: 'var(--purple)',
  Website: 'var(--cyan)',
  Sonstige: 'var(--text-muted)',
};

function LeadSourceChart({ leads }: { leads: Lead[] }) {
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) {
      const src = l.quelle || 'Sonstige';
      const normalized =
        src.toLowerCase().includes('scrap') ? 'Scraper' :
        src.toLowerCase().includes('import') || src.toLowerCase().includes('csv') ? 'Import' :
        src.toLowerCase().includes('empfehl') || src.toLowerCase().includes('referr') ? 'Empfehlung' :
        src.toLowerCase().includes('web') ? 'Website' :
        src.toLowerCase().includes('manu') ? 'Manuell' : 'Sonstige';
      counts[normalized] = (counts[normalized] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, color: SOURCE_COLORS[name] || 'var(--text-muted)' }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  const total = leads.length || 1;

  if (sourceCounts.length === 0) return null;

  return (
    <div className="card-glass-premium p-5">
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-bold"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
        >
          Lead-Quellen
        </h3>
        <span
          className="text-xs px-2.5 py-1 rounded-full"
          style={{
            background: 'rgba(96,165,250,0.1)',
            color: 'var(--blue)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {leads.length} Total
        </span>
      </div>
      <div className="flex items-center gap-6">
        <DonutChart
          data={sourceCounts.map((s) => ({ label: s.name, value: s.count, color: s.color }))}
          size={100}
          strokeWidth={14}
        />
        <div className="flex-1 space-y-2">
          {sourceCounts.map((s) => {
            const pct = Math.round((s.count / total) * 100);
            return (
              <div key={s.name} className="flex items-center gap-2">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: s.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  className="text-xs flex-1"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}
                >
                  {s.name}
                </span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                >
                  {s.count}
                </span>
                <span
                  className="text-xs"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 36, textAlign: 'right' }}
                >
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pipeline Funnel                                                    */
/* ------------------------------------------------------------------ */

const FUNNEL_STAGES = [
  { key: 'New Lead', label: 'New Lead', color: 'var(--blue)' },
  { key: 'Contacted', label: 'Contacted', color: 'var(--amber)' },
  { key: 'Qualified', label: 'Qualified', color: 'var(--purple)' },
  { key: 'Proposal', label: 'Proposal', color: 'var(--orange)' },
  { key: 'Won', label: 'Won', color: 'var(--green)' },
] as const;

function PipelineFunnel({
  statusCounts,
  activeFilter,
  onStageClick,
}: {
  statusCounts: Record<string, number>;
  activeFilter: string[];
  onStageClick: (stage: string) => void;
}) {
  const stages = FUNNEL_STAGES.map((s, i) => {
    const count = statusCounts[s.key] || 0;
    const prevCount = i > 0 ? (statusCounts[FUNNEL_STAGES[i - 1].key] || 0) : 0;
    const conversionPct = i === 0 ? 100 : prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
    return { ...s, count, conversionPct };
  });

  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const stageCount = stages.length;

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 120;
  const stageGap = 4;
  const stageWidth = (svgWidth - stageGap * (stageCount - 1)) / stageCount;
  const maxBarHeight = 80;
  const yBase = svgHeight - 8;

  return (
    <div className="card-glass-premium p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Filter size={16} style={{ color: 'var(--amber)' }} />
        <h3
          className="text-sm font-semibold"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
        >
          Pipeline Funnel
        </h3>
        <span
          className="text-xs ml-auto"
          style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-muted)' }}
        >
          Klick auf Stufe zum Filtern
        </span>
      </div>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        height="auto"
        style={{ overflow: 'visible' }}
        role="img"
        aria-label="Pipeline Funnel Chart"
      >
        {stages.map((stage, i) => {
          const barHeight = maxCount > 0 ? Math.max((stage.count / maxCount) * maxBarHeight, 12) : 12;
          const nextBarHeight =
            i < stageCount - 1
              ? Math.max(((stages[i + 1].count) / maxCount) * maxBarHeight, 12)
              : barHeight * 0.6;

          const x = i * (stageWidth + stageGap);
          const xEnd = x + stageWidth;

          // Trapezoid: wider at top-left (current stage height), narrower at top-right (next stage height)
          const yTopLeft = yBase - barHeight;
          const yTopRight = yBase - (i < stageCount - 1 ? nextBarHeight : barHeight * 0.7);

          const isActive = activeFilter.includes(stage.key);

          return (
            <g
              key={stage.key}
              onClick={() => onStageClick(stage.key)}
              style={{ cursor: 'pointer' }}
              role="button"
              aria-label={`${stage.label}: ${stage.count} Leads`}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStageClick(stage.key); }}
            >
              {/* Trapezoid shape */}
              <polygon
                points={`${x},${yBase} ${x},${yTopLeft} ${xEnd},${yTopRight} ${xEnd},${yBase}`}
                fill={stage.color}
                opacity={isActive ? 1 : 0.65}
                rx={4}
              >
                <animate
                  attributeName="opacity"
                  from="0"
                  to={isActive ? '1' : '0.65'}
                  dur="0.4s"
                  fill="freeze"
                />
              </polygon>

              {/* Active highlight border */}
              {isActive && (
                <polygon
                  points={`${x},${yBase} ${x},${yTopLeft} ${xEnd},${yTopRight} ${xEnd},${yBase}`}
                  fill="none"
                  stroke={stage.color}
                  strokeWidth={2}
                  opacity={1}
                />
              )}

              {/* Hover overlay */}
              <polygon
                points={`${x},${yBase} ${x},${yTopLeft} ${xEnd},${yTopRight} ${xEnd},${yBase}`}
                fill="white"
                opacity={0}
                className="funnel-hover-overlay"
              >
                <set attributeName="opacity" to="0.1" begin="mouseover" end="mouseout" />
              </polygon>

              {/* Stage label */}
              <text
                x={x + stageWidth / 2}
                y={yBase - barHeight / 2 - 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fontFamily="var(--font-mono)"
                fontWeight="600"
                fill="white"
              >
                {stage.count}
              </text>

              {/* Stage name below */}
              <text
                x={x + stageWidth / 2}
                y={yBase - barHeight / 2 + 10}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={8}
                fontFamily="var(--font-dm-sans)"
                fill="white"
                opacity={0.85}
              >
                {stage.label}
              </text>

              {/* Conversion arrow + percentage between stages */}
              {i > 0 && (
                <text
                  x={x - stageGap / 2}
                  y={8}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fontSize={9}
                  fontFamily="var(--font-mono)"
                  fontWeight="600"
                  fill={stage.color}
                >
                  {stage.conversionPct}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Canton Map                                                         */
/* ------------------------------------------------------------------ */

const CANTON_ABBR: Record<string, string> = {
  'Zuerich': 'ZH',
  'Z\u00fcrich': 'ZH',
  'Bern': 'BE',
  'Luzern': 'LU',
  'Uri': 'UR',
  'Schwyz': 'SZ',
  'Obwalden': 'OW',
  'Nidwalden': 'NW',
  'Glarus': 'GL',
  'Zug': 'ZG',
  'Freiburg': 'FR',
  'Solothurn': 'SO',
  'Basel-Stadt': 'BS',
  'Basel-Landschaft': 'BL',
  'Schaffhausen': 'SH',
  'Appenzell Ausserrhoden': 'AR',
  'Appenzell Innerrhoden': 'AI',
  'St. Gallen': 'SG',
  'Graubuenden': 'GR',
  'Graub\u00fcnden': 'GR',
  'Aargau': 'AG',
  'Thurgau': 'TG',
  'Tessin': 'TI',
  'Waadt': 'VD',
  'Wallis': 'VS',
  'Neuenburg': 'NE',
  'Genf': 'GE',
  'Jura': 'JU',
};

/* Reverse map: abbreviation -> display name (matches data/filter values) */
const CANTON_DISPLAY: Record<string, string> = {
  'ZH': 'Z\u00fcrich',
  'BE': 'Bern',
  'LU': 'Luzern',
  'UR': 'Uri',
  'SZ': 'Schwyz',
  'OW': 'Obwalden',
  'NW': 'Nidwalden',
  'GL': 'Glarus',
  'ZG': 'Zug',
  'FR': 'Freiburg',
  'SO': 'Solothurn',
  'BS': 'Basel-Stadt',
  'BL': 'Basel-Landschaft',
  'SH': 'Schaffhausen',
  'AR': 'Appenzell Ausserrhoden',
  'AI': 'Appenzell Innerrhoden',
  'SG': 'St. Gallen',
  'GR': 'Graub\u00fcnden',
  'AG': 'Aargau',
  'TG': 'Thurgau',
  'TI': 'Tessin',
  'VD': 'Waadt',
  'VS': 'Wallis',
  'NE': 'Neuenburg',
  'GE': 'Genf',
  'JU': 'Jura',
};

/** Simplified SVG paths for Swiss cantons in a 600x400 viewBox */
const CANTON_PATHS: { abbr: string; d: string; labelX: number; labelY: number }[] = [
  // Genf (GE) - southwest corner
  { abbr: 'GE', d: 'M68,340 L58,325 L62,310 L72,305 L85,310 L90,325 L82,340 Z', labelX: 74, labelY: 324 },
  // Waadt (VD) - western Switzerland
  { abbr: 'VD', d: 'M90,325 L85,310 L72,305 L80,285 L95,270 L120,260 L145,265 L155,280 L148,300 L135,315 L115,330 L100,335 Z', labelX: 115, labelY: 295 },
  // Wallis (VS) - southern Switzerland
  { abbr: 'VS', d: 'M148,300 L155,280 L170,275 L190,285 L215,290 L240,300 L265,305 L280,295 L290,310 L275,330 L250,340 L220,345 L190,340 L165,330 L148,315 Z', labelX: 218, labelY: 318 },
  // Freiburg (FR) - west-central
  { abbr: 'FR', d: 'M120,260 L135,245 L155,240 L170,248 L170,275 L155,280 L145,265 Z', labelX: 148, labelY: 260 },
  // Neuenburg (NE) - northwest
  { abbr: 'NE', d: 'M95,250 L108,235 L125,228 L135,245 L120,260 L95,270 Z', labelX: 114, labelY: 250 },
  // Jura (JU) - northwest
  { abbr: 'JU', d: 'M108,205 L125,192 L145,188 L155,200 L148,218 L135,228 L108,235 Z', labelX: 130, labelY: 212 },
  // Bern (BE) - large central canton
  { abbr: 'BE', d: 'M135,228 L148,218 L155,200 L175,195 L195,200 L210,215 L220,235 L215,255 L215,290 L190,285 L170,275 L170,248 L155,240 L135,245 Z', labelX: 180, labelY: 240 },
  // Solothurn (SO) - north-central
  { abbr: 'SO', d: 'M175,195 L195,185 L215,180 L228,188 L225,200 L210,215 L195,200 Z', labelX: 202, labelY: 196 },
  // Basel-Landschaft (BL) - northwest
  { abbr: 'BL', d: 'M185,168 L200,160 L215,165 L215,180 L195,185 L185,178 Z', labelX: 200, labelY: 174 },
  // Basel-Stadt (BS) - northwest (small)
  { abbr: 'BS', d: 'M192,155 L205,150 L212,158 L200,160 L185,168 L185,162 Z', labelX: 198, labelY: 158 },
  // Aargau (AG) - north-central
  { abbr: 'AG', d: 'M215,180 L215,165 L235,160 L255,162 L265,175 L258,192 L250,200 L228,205 L228,188 Z', labelX: 240, labelY: 182 },
  // Luzern (LU) - central
  { abbr: 'LU', d: 'M228,205 L250,200 L268,210 L275,230 L260,245 L240,248 L220,235 L210,215 L225,200 Z', labelX: 244, labelY: 228 },
  // Zug (ZG) - central (small)
  { abbr: 'ZG', d: 'M268,210 L280,205 L288,215 L285,228 L275,230 Z', labelX: 278, labelY: 218 },
  // Zuerich (ZH) - north
  { abbr: 'ZH', d: 'M265,175 L280,165 L300,158 L318,162 L325,175 L320,195 L305,205 L288,215 L280,205 L268,210 L250,200 L258,192 Z', labelX: 290, labelY: 185 },
  // Schaffhausen (SH) - north
  { abbr: 'SH', d: 'M295,135 L315,128 L332,132 L338,145 L325,155 L310,152 L300,158 L280,165 L282,152 Z', labelX: 310, labelY: 144 },
  // Thurgau (TG) - northeast
  { abbr: 'TG', d: 'M325,155 L338,145 L360,140 L380,148 L385,162 L370,175 L350,178 L330,175 L318,162 L325,175 L320,165 Z', labelX: 355, labelY: 160 },
  // St. Gallen (SG) - northeast
  { abbr: 'SG', d: 'M350,178 L370,175 L385,162 L400,165 L418,175 L425,195 L415,218 L398,230 L375,225 L355,215 L340,205 L330,195 L320,195 L305,205 L288,215 L285,228 L275,230 L260,245 L265,255 L280,250 L300,242 L318,235 L340,228 L355,215 Z', labelX: 380, labelY: 200 },
  // Appenzell Ausserrhoden (AR) - northeast (small)
  { abbr: 'AR', d: 'M400,165 L415,160 L428,168 L425,180 L418,175 Z', labelX: 414, labelY: 170 },
  // Appenzell Innerrhoden (AI) - northeast (tiny)
  { abbr: 'AI', d: 'M418,175 L428,168 L435,178 L430,188 L425,195 Z', labelX: 426, labelY: 180 },
  // Glarus (GL) - central-east
  { abbr: 'GL', d: 'M340,228 L355,215 L375,225 L380,242 L365,258 L345,252 L335,240 Z', labelX: 357, labelY: 240 },
  // Schwyz (SZ) - central
  { abbr: 'SZ', d: 'M285,228 L300,225 L318,235 L315,252 L300,260 L285,255 L275,240 Z', labelX: 298, labelY: 244 },
  // Uri (UR) - central south
  { abbr: 'UR', d: 'M300,260 L315,252 L330,260 L335,280 L325,300 L310,305 L295,295 L290,275 Z', labelX: 314, labelY: 280 },
  // Obwalden (OW) - central
  { abbr: 'OW', d: 'M260,245 L275,240 L285,255 L280,270 L265,275 L252,265 Z', labelX: 268, labelY: 258 },
  // Nidwalden (NW) - central
  { abbr: 'NW', d: 'M280,270 L285,255 L300,260 L295,280 L280,280 Z', labelX: 288, labelY: 270 },
  // Graubuenden (GR) - eastern Switzerland (largest)
  { abbr: 'GR', d: 'M365,258 L380,242 L398,230 L415,218 L435,220 L460,235 L480,255 L490,280 L485,310 L470,335 L445,350 L420,348 L395,335 L375,315 L358,295 L350,275 Z', labelX: 430, labelY: 290 },
  // Tessin (TI) - southern Switzerland
  { abbr: 'TI', d: 'M325,300 L335,280 L350,275 L358,295 L375,315 L380,335 L370,355 L348,368 L325,365 L310,348 L305,325 Z', labelX: 342, labelY: 332 },
];

/** Resolve any canton name variant to its 2-letter abbreviation */
function resolveCantonAbbr(name: string): string {
  if (CANTON_ABBR[name]) return CANTON_ABBR[name];
  for (const [abbr, display] of Object.entries(CANTON_DISPLAY)) {
    if (display === name) return abbr;
  }
  // Handle umlaut variants (Zuerich/Graubuenden)
  const normalized = name
    .replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae')
    .replace(/Ü/g, 'Ue').replace(/Ö/g, 'Oe').replace(/Ä/g, 'Ae');
  if (CANTON_ABBR[normalized]) return CANTON_ABBR[normalized];
  return name.slice(0, 2).toUpperCase();
}

function CantonMap({
  leads,
  activeCantonFilter,
  onCantonClick,
}: {
  leads: Lead[];
  activeCantonFilter: string;
  onCantonClick: (cantonName: string) => void;
}) {
  const [hoveredCanton, setHoveredCanton] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Build lead count per canton abbreviation
  const cantonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) {
      const abbr = resolveCantonAbbr(l.kanton || '');
      counts[abbr] = (counts[abbr] || 0) + 1;
    }
    return counts;
  }, [leads]);

  const maxCount = useMemo(() => {
    const vals = Object.values(cantonCounts);
    return vals.length > 0 ? Math.max(...vals) : 1;
  }, [cantonCounts]);

  const activeAbbr = activeCantonFilter ? resolveCantonAbbr(activeCantonFilter) : '';

  /** Get heat color for a canton based on lead count */
  function getHeatColor(abbr: string): string {
    const count = cantonCounts[abbr] || 0;
    if (count === 0) return 'rgba(96, 165, 250, 0.06)';
    const intensity = count / maxCount;
    const alpha = 0.12 + intensity * 0.73;
    return `rgba(96, 165, 250, ${alpha.toFixed(2)})`;
  }

  /** Get canton display name from abbreviation */
  function getCantonName(abbr: string): string {
    return CANTON_DISPLAY[abbr] || abbr;
  }

  /** Handle click on a canton path */
  function handleCantonClick(abbr: string) {
    const displayName = getCantonName(abbr);
    if (activeAbbr === abbr) {
      onCantonClick('');
    } else {
      onCantonClick(displayName);
    }
  }

  function handleMouseMove(e: React.MouseEvent, abbr: string) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setHoveredCanton(abbr);
  }

  const totalLeads = leads.length;
  const uniqueCantons = Object.keys(cantonCounts).length;

  return (
    <div className="card-glass-premium" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <MapPin size={16} style={{ color: 'var(--blue)' }} />
          <h3
            className="text-sm font-bold"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', margin: 0 }}
          >
            Lead-Karte Schweiz
          </h3>
          <span
            className="text-xs px-2.5 py-0.5 rounded-full"
            style={{
              background: 'rgba(96,165,250,0.1)',
              color: 'var(--blue)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {uniqueCantons} Kantone
          </span>
        </div>
        <span
          className="text-xs hidden sm:inline"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}
        >
          {totalLeads} Leads &middot; Klick auf Kanton zum Filtern
        </span>
      </div>

      {/* Map SVG */}
      <div style={{ padding: '0 20px 12px 20px', position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox="40 120 480 270"
          width="100%"
          height="auto"
          style={{
            borderRadius: 8,
            overflow: 'visible',
            display: 'block',
            background: 'rgba(0,0,0,0.15)',
          }}
          role="img"
          aria-label="Schweizer Kantonskarte mit Lead-Verteilung"
          onMouseLeave={() => setHoveredCanton(null)}
        >
          {CANTON_PATHS.map((canton) => {
            const count = cantonCounts[canton.abbr] || 0;
            const isActive = activeAbbr === canton.abbr;
            const isHovered = hoveredCanton === canton.abbr;

            return (
              <g
                key={canton.abbr}
                onClick={() => handleCantonClick(canton.abbr)}
                onMouseMove={(e) => handleMouseMove(e, canton.abbr)}
                onMouseLeave={() => setHoveredCanton(null)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={`${getCantonName(canton.abbr)}: ${count} Leads`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleCantonClick(canton.abbr);
                }}
              >
                <path
                  d={canton.d}
                  fill={getHeatColor(canton.abbr)}
                  stroke={
                    isActive
                      ? 'var(--amber)'
                      : isHovered
                        ? 'var(--blue)'
                        : 'rgba(148, 163, 184, 0.25)'
                  }
                  strokeWidth={isActive ? 2.5 : isHovered ? 2 : 0.8}
                  style={{
                    transition: 'fill 0.2s ease, stroke 0.2s ease, stroke-width 0.15s ease',
                    filter: isHovered ? 'brightness(1.3)' : 'none',
                  }}
                />
                {/* Canton label */}
                <text
                  x={canton.labelX}
                  y={canton.labelY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={9}
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                  fill={count > 0 ? 'var(--text)' : 'var(--text-muted)'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {canton.abbr}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredCanton && (
          <div
            style={{
              position: 'absolute',
              left: tooltipPos.x + 12,
              top: tooltipPos.y - 40,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              pointerEvents: 'none',
              zIndex: 20,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              whiteSpace: 'nowrap',
            }}
          >
            <div
              className="text-xs font-bold"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
            >
              {hoveredCanton} - {getCantonName(hoveredCanton)}
            </div>
            <div
              className="text-xs mt-0.5"
              style={{ fontFamily: 'var(--font-dm-sans)', color: 'var(--text-muted)' }}
            >
              {cantonCounts[hoveredCanton] || 0} Leads
            </div>
          </div>
        )}

        {/* Legend */}
        <div
          className="flex items-center justify-between mt-3 pt-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-[10px]"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}
            >
              Weniger Leads
            </span>
            <div className="flex items-center gap-0.5">
              {[0.12, 0.28, 0.45, 0.62, 0.85].map((alpha) => (
                <div
                  key={alpha}
                  style={{
                    width: 20,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: `rgba(96, 165, 250, ${alpha})`,
                  }}
                />
              ))}
            </div>
            <span
              className="text-[10px]"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}
            >
              Mehr Leads
            </span>
          </div>
          {activeAbbr && (
            <button
              onClick={() => onCantonClick('')}
              className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded"
              style={{
                color: 'var(--amber)',
                background: 'rgba(251,191,36,0.1)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <X size={10} />
              Filter: {activeAbbr}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main CRM Page                                                      */
/* ------------------------------------------------------------------ */

export default function CRMPage() {
  const { toast } = useToast();
  /* ---- State ---- */
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [brancheFilter, setBrancheFilter] = useState('');
  const [kantonFilter, setKantonFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusDropdownOpen, setBulkStatusDropdownOpen] = useState(false);
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // New Lead Modal
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLeadData, setNewLeadData] = useState({
    firma: '', kontakt: '', email: '', telefon: '', website: '',
    adresse: '', branche: 'Treuhand', kanton: 'Zürich', ort: '',
  });
  const [newLeadSaving, setNewLeadSaving] = useState(false);
  const [newLeadError, setNewLeadError] = useState('');

  // CSV Import
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState<{ success: boolean; count: number } | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const csvFileRef = useRef<HTMLInputElement>(null);

  const limit = 50;
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const bulkStatusRef = useRef<HTMLDivElement>(null);

  // Favorites (persisted in localStorage)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>();
    try {
      const stored = localStorage.getItem('werkpilot-crm-favorites');
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem('werkpilot-crm-favorites', JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Pipeline funnel stats (fetched from /api/leads/stats for accurate totals)
  const [pipelineStatusCounts, setPipelineStatusCounts] = useState<Record<string, number>>({});

  const fetchPipelineStats = useCallback(async () => {
    try {
      const res = await fetch('/api/leads/stats');
      if (res.ok) {
        const data = await res.json();
        const counts: Record<string, number> = {};
        for (const entry of data.byStatus ?? []) {
          counts[entry.status] = entry.count;
        }
        setPipelineStatusCounts(counts);
      }
    } catch {
      // Silently fail - funnel just shows 0s
    }
  }, []);

  useEffect(() => {
    fetchPipelineStats();
  }, [fetchPipelineStats]);

  // Re-fetch pipeline stats when leads change (after CRUD ops)
  useEffect(() => {
    fetchPipelineStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  function handleFunnelStageClick(stage: string) {
    setStatusFilter((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [stage]
    );
  }

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
  }, [statusFilter, brancheFilter, kantonFilter, tagFilter]);

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
    try {
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await fetchLeads();
      const res = await fetch(`/api/leads/${id}`);
      if (res.ok) {
        const updated = await res.json();
        setSelectedLead(updated);
      }
      toast('Lead aktualisiert', 'success');
    } catch {
      toast('Aktualisierung fehlgeschlagen', 'error');
    }
  }

  /* ---- Delete lead ---- */
  async function deleteLead(id: string) {
    try {
      await fetch(`/api/leads/${id}`, { method: 'DELETE' });
      setSelectedLead(null);
      toast('Lead gelöscht', 'success');
      await fetchLeads();
    } catch {
      toast('Löschen fehlgeschlagen', 'error');
    }
  }

  /* ---- Bulk actions ---- */
  function toggleSelectAll() {
    if (selectedIds.size === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  }

  function toggleSelectLead(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function bulkUpdateStatus(status: string) {
    setBulkActionLoading(true);
    const count = selectedIds.size;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/leads/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          })
        )
      );
      setSelectedIds(new Set());
      setBulkStatusDropdownOpen(false);
      toast(`${count} Leads auf "${status}" gesetzt`, 'success');
      await fetchLeads();
    } catch {
      toast('Bulk-Update fehlgeschlagen', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function bulkDelete() {
    setBulkActionLoading(true);
    const count = selectedIds.size;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => fetch(`/api/leads/${id}`, { method: 'DELETE' }))
      );
      setSelectedIds(new Set());
      setBulkConfirmDelete(false);
      toast(`${count} Leads gelöscht`, 'success');
      await fetchLeads();
    } catch {
      toast('Bulk-Löschen fehlgeschlagen', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  }

  /* ---- Create new lead ---- */
  async function createNewLead() {
    if (!newLeadData.firma.trim() || !newLeadData.ort.trim()) {
      setNewLeadError('Firma und Ort sind Pflichtfelder.');
      return;
    }
    setNewLeadSaving(true);
    setNewLeadError('');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newLeadData,
          firma: newLeadData.firma.trim(),
          kontakt: newLeadData.kontakt.trim() || null,
          email: newLeadData.email.trim() || null,
          telefon: newLeadData.telefon.trim() || null,
          website: newLeadData.website.trim() || null,
          adresse: newLeadData.adresse.trim() || null,
          ort: newLeadData.ort.trim(),
          quelle: 'manual',
        }),
      });
      if (!res.ok) throw new Error('Fehler beim Erstellen');
      setNewLeadOpen(false);
      setNewLeadData({
        firma: '', kontakt: '', email: '', telefon: '', website: '',
        adresse: '', branche: 'Treuhand', kanton: 'Zürich', ort: '',
      });
      toast(`Lead "${newLeadData.firma}" erstellt`, 'success');
      await fetchLeads();
    } catch {
      setNewLeadError('Lead konnte nicht erstellt werden.');
      toast('Lead-Erstellung fehlgeschlagen', 'error');
    } finally {
      setNewLeadSaving(false);
    }
  }

  /* ---- Statistics ---- */
  const totalLeads = total;
  const pipelineValue = leads.reduce((sum, lead) => sum + lead.umsatzpotenzial, 0);
  const avgScore = leads.length > 0 ? Math.round(leads.reduce((sum, l) => sum + l.leadScore, 0) / leads.length) : 0;
  const conversionRate = leads.length > 0 ? Math.round((leads.filter((l) => l.status === 'Won' || l.status === 'Client').length / leads.length) * 100) : 0;

  /* ---- All tags collected from leads (for auto-suggest & filter) ---- */
  const allTags = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => parseTags(l.tags).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }, [leads]);

  /* ---- Client-side tag + favorites filter ---- */
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (tagFilter) {
      result = result.filter((l) => parseTags(l.tags).some((t) => t.toLowerCase() === tagFilter.toLowerCase()));
    }
    if (showFavoritesOnly) {
      result = result.filter((l) => favorites.has(l.id));
    }
    // Sort favorites to top
    result = [...result].sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      return aFav - bFav;
    });
    return result;
  }, [leads, tagFilter, showFavoritesOnly, favorites]);

  /* ---- Pagination ---- */
  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = statusFilter.length > 0 || brancheFilter || kantonFilter || debouncedSearch || !!tagFilter || showFavoritesOnly;

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter([]);
    setBrancheFilter('');
    setKantonFilter('');
    setTagFilter('');
    setShowFavoritesOnly(false);
  }

  /* ---- CSV Import ---- */
  const CSV_FIELDS = [
    { key: 'firma', label: 'Firma', required: true },
    { key: 'kontakt', label: 'Kontakt', required: false },
    { key: 'email', label: 'E-Mail', required: false },
    { key: 'telefon', label: 'Telefon', required: false },
    { key: 'website', label: 'Website', required: false },
    { key: 'adresse', label: 'Adresse', required: false },
    { key: 'branche', label: 'Branche', required: true },
    { key: 'kanton', label: 'Kanton', required: true },
    { key: 'ort', label: 'Ort', required: true },
  ];

  function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    // Detect delimiter
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

    function parseLine(line: string): string[] {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map((line) => {
      const values = parseLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || '';
      });
      return row;
    }).filter((row) => Object.values(row).some((v) => v.trim()));

    return { headers, rows };
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvData(rows);

      // Auto-map headers to fields
      const mapping: Record<string, string> = {};
      const autoMap: Record<string, string[]> = {
        firma: ['firma', 'company', 'firmenname', 'unternehmen', 'name'],
        kontakt: ['kontakt', 'contact', 'ansprechpartner', 'kontaktperson'],
        email: ['email', 'e-mail', 'mail', 'e_mail'],
        telefon: ['telefon', 'phone', 'tel', 'telephone', 'telefonnummer'],
        website: ['website', 'web', 'url', 'homepage', 'webseite'],
        adresse: ['adresse', 'address', 'strasse', 'street'],
        branche: ['branche', 'industry', 'sektor', 'bereich'],
        kanton: ['kanton', 'canton', 'kt', 'state', 'region'],
        ort: ['ort', 'city', 'stadt', 'plz', 'location'],
      };

      headers.forEach((h) => {
        const lower = h.toLowerCase().trim();
        for (const [field, aliases] of Object.entries(autoMap)) {
          if (aliases.includes(lower) && !mapping[field]) {
            mapping[field] = h;
          }
        }
      });

      setCsvMapping(mapping);
    };
    reader.readAsText(file);
  }

  async function handleCSVImport() {
    if (csvData.length === 0) return;
    setCsvImporting(true);
    setCsvImportResult(null);

    const leads = csvData.map((row) => {
      const lead: Record<string, string> = {};
      for (const field of CSV_FIELDS) {
        const header = csvMapping[field.key];
        lead[field.key] = header ? row[header]?.trim() || '' : '';
      }
      // Defaults for required fields
      if (!lead.branche) lead.branche = 'Sonstige';
      if (!lead.kanton) lead.kanton = 'Zürich';
      if (!lead.ort) lead.ort = 'Unbekannt';
      return lead;
    }).filter((l) => l.firma);

    try {
      const res = await fetch('/api/leads/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      });
      if (!res.ok) throw new Error('Import fehlgeschlagen');
      const data = await res.json();
      const count = data.imported || leads.length;
      setCsvImportResult({ success: true, count });
      toast(`${count} Leads importiert`, 'success');
      await fetchLeads();
    } catch {
      setCsvImportResult({ success: false, count: 0 });
      toast('CSV-Import fehlgeschlagen', 'error');
    } finally {
      setCsvImporting(false);
    }
  }

  function resetCsvImport() {
    setCsvData([]);
    setCsvHeaders([]);
    setCsvMapping({});
    setCsvImportResult(null);
    setCsvFileName('');
    if (csvFileRef.current) csvFileRef.current.value = '';
  }

  /* ---- Render ---- */
  return (
    <div className="space-y-4 md:space-y-5">
      <Breadcrumb items={[{ label: 'CRM' }]} />
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
              onClick={() => setViewMode('list')}
              className="px-2.5 md:px-3 py-2 text-sm flex items-center gap-1.5 md:gap-2 transition-colors"
              style={{
                backgroundColor: viewMode === 'list' ? 'var(--amber)' : 'transparent',
                color: viewMode === 'list' ? '#000' : 'var(--text-secondary)',
              }}
            >
              <TableIcon size={16} />
              <span className="hidden sm:inline">Liste</span>
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

          {/* New Lead */}
          <button
            onClick={() => setNewLeadOpen(true)}
            className="px-3 md:px-4 py-2 rounded-lg text-sm flex items-center gap-2 font-medium transition-colors"
            style={{
              backgroundColor: 'var(--amber)',
              color: '#000',
            }}
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Neuer Lead</span>
          </button>

          {/* Import CSV */}
          <button
            onClick={() => { setCsvImportOpen(true); resetCsvImport(); }}
            className="px-3 md:px-4 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hover)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--green)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
            }}
          >
            <Upload size={16} />
            <span className="hidden sm:inline">CSV Import</span>
          </button>

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

      {/* Pipeline Funnel + Lead Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PipelineFunnel
            statusCounts={pipelineStatusCounts}
            activeFilter={statusFilter}
            onStageClick={handleFunnelStageClick}
          />
        </div>
        <LeadSourceChart leads={leads} />
      </div>

      {/* Canton Map - Lead distribution by Swiss canton */}
      <CantonMap
        leads={leads}
        activeCantonFilter={kantonFilter}
        onCantonClick={setKantonFilter}
      />

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
        {allTags.length > 0 && (
          <TagFilterDropdown
            tags={allTags}
            value={tagFilter}
            onChange={setTagFilter}
          />
        )}
        <button
          onClick={() => setShowFavoritesOnly((p) => !p)}
          className="px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
          style={{
            fontFamily: 'var(--font-mono)',
            backgroundColor: showFavoritesOnly ? 'color-mix(in srgb, var(--amber) 15%, transparent)' : 'rgba(255,255,255,0.04)',
            color: showFavoritesOnly ? 'var(--amber)' : 'var(--text-muted)',
            border: `1px solid ${showFavoritesOnly ? 'var(--amber)' : 'var(--border)'}`,
            boxShadow: showFavoritesOnly ? '0 0 8px var(--amber-glow)' : 'none',
          }}
          title={showFavoritesOnly ? 'Alle anzeigen' : 'Nur Favoriten'}
        >
          <Star size={13} fill={showFavoritesOnly ? 'var(--amber)' : 'none'} />
          {favorites.size > 0 && <span>{favorites.size}</span>}
        </button>
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

      {/* Floating Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 z-30 animate-slide-in-up"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div
            className="card-glass-premium flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
            style={{
              border: '1px solid var(--border)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              minWidth: '320px',
            }}
          >
            {/* Selected count */}
            <span
              className="text-sm font-bold whitespace-nowrap"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
            >
              {selectedIds.size} Lead{selectedIds.size !== 1 ? 's' : ''} ausgewählt
            </span>

            {/* Divider */}
            <div className="w-px h-6 shrink-0" style={{ backgroundColor: 'var(--border)' }} />

            {/* Bulk Status Change */}
            <div ref={bulkStatusRef} className="relative">
              <button
                onClick={() => {
                  setBulkStatusDropdownOpen(!bulkStatusDropdownOpen);
                  setBulkConfirmDelete(false);
                }}
                disabled={bulkActionLoading}
                className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-opacity"
                style={{
                  backgroundColor: 'var(--amber)',
                  color: '#000',
                  opacity: bulkActionLoading ? 0.5 : 1,
                }}
              >
                Status ändern
                <ChevronDown
                  size={14}
                  style={{
                    transform: bulkStatusDropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s',
                  }}
                />
              </button>
              {bulkStatusDropdownOpen && (
                <div
                  className="absolute bottom-full left-0 mb-2 z-50 rounded-lg border shadow-lg overflow-hidden min-w-[200px]"
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

            {/* Alle abwählen */}
            <button
              onClick={() => {
                setSelectedIds(new Set());
                setBulkConfirmDelete(false);
                setBulkStatusDropdownOpen(false);
              }}
              className="px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              Alle abwählen
            </button>

            {/* Divider */}
            <div className="w-px h-6 shrink-0" style={{ backgroundColor: 'var(--border)' }} />

            {/* Löschen with confirmation */}
            {!bulkConfirmDelete ? (
              <button
                onClick={() => {
                  setBulkConfirmDelete(true);
                  setBulkStatusDropdownOpen(false);
                }}
                disabled={bulkActionLoading}
                className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                style={{
                  color: 'var(--rose)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in srgb, var(--rose) 15%, transparent)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                <Trash2 size={14} />
                Löschen
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs whitespace-nowrap" style={{ color: 'var(--rose)' }}>
                  {selectedIds.size} löschen?
                </span>
                <button
                  onClick={bulkDelete}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity"
                  style={{
                    backgroundColor: 'var(--rose)',
                    color: '#fff',
                    opacity: bulkActionLoading ? 0.5 : 1,
                  }}
                >
                  {bulkActionLoading ? 'Löschen...' : 'Ja'}
                </button>
                <button
                  onClick={() => setBulkConfirmDelete(false)}
                  className="px-2 py-1.5 rounded-lg text-xs transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  Nein
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table or Kanban View */}
      {viewMode === 'kanban' ? (
        <KanbanView
          leads={filteredLeads}
          onLeadClick={setSelectedLead}
          onStatusChange={async (id, newStatus) => {
            await updateLead(id, { status: newStatus });
          }}
        />
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
                      checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredLeads.length;
                      }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: 'var(--amber)' }}
                    />
                  </th>
                  {['Firma', 'Kontakt', 'E-Mail', 'Branche', 'Kanton', 'Status', 'Score', 'Tags', ''].map(
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
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="skeleton h-4 rounded" style={{ width: j === 0 ? '140px' : '80px' }} />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="skeleton w-6 h-6 rounded" />
                      </td>
                    </tr>
                  ))
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--amber) 15%, transparent)',
                            color: 'var(--amber)',
                            marginBottom: 16,
                          }}
                        >
                          <Users size={24} />
                        </div>
                        <h3
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text)',
                            margin: '0 0 6px',
                          }}
                        >
                          {hasActiveFilters ? 'Keine Treffer' : 'Noch keine Leads'}
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 320 }}>
                          {hasActiveFilters
                            ? 'Keine Leads entsprechen den aktuellen Filtern. Versuche andere Filterkriterien.'
                            : 'Erstelle deinen ersten Lead oder importiere Leads per CSV.'}
                        </p>
                        {!hasActiveFilters && (
                          <button
                            onClick={() => setNewLeadOpen(true)}
                            className="mt-4 px-4 py-2 rounded-lg text-sm font-bold transition-all"
                            style={{ backgroundColor: 'var(--amber)', color: '#000' }}
                          >
                            <Plus size={14} className="inline mr-1.5" style={{ verticalAlign: 'middle' }} />
                            Ersten Lead erstellen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead, idx) => (
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
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={() => toggleSelectLead(lead.id)}
                            className="w-4 h-4 rounded cursor-pointer"
                            style={{ accentColor: 'var(--amber)' }}
                          />
                          <button
                            onClick={() => toggleFavorite(lead.id)}
                            className="transition-all hover:scale-110"
                            style={{ color: favorites.has(lead.id) ? 'var(--amber)' : 'var(--text-muted)', opacity: favorites.has(lead.id) ? 1 : 0.4 }}
                            title={favorites.has(lead.id) ? 'Favorit entfernen' : 'Als Favorit markieren'}
                          >
                            <Star size={14} fill={favorites.has(lead.id) ? 'var(--amber)' : 'none'} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell value={lead.firma} field="firma" leadId={lead.id} onSave={updateLead} mono />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell value={lead.kontakt} field="kontakt" leadId={lead.id} onSave={updateLead} />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell value={lead.email} field="email" leadId={lead.id} onSave={updateLead} />
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
                        <div className="flex items-center gap-2">
                          <ScoreBreakdownTooltip lead={lead} />
                          {lead.activities.length > 0 && (
                            <Sparkline
                              data={buildActivitySparkline(lead.activities)}
                              width={48}
                              height={18}
                              color={scoreColor(lead.leadScore)}
                              filled
                            />
                          )}
                          {lead.notizen && (() => {
                            let count = 0;
                            try {
                              const arr = JSON.parse(lead.notizen);
                              if (Array.isArray(arr)) count = arr.length;
                              else count = 1;
                            } catch { count = 1; }
                            return count > 0 ? (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-bold"
                                style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}
                                title={`${count} Notiz${count !== 1 ? 'en' : ''}`}
                              >
                                <MessageSquare size={11} />
                                {count}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {parseTags(lead.tags).slice(0, 3).map((tag) => (
                            <TagChip key={tag} tag={tag} />
                          ))}
                          {parseTags(lead.tags).length > 3 && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--border) 30%, transparent)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              +{parseTags(lead.tags).length - 3}
                            </span>
                          )}
                        </div>
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

      {/* New Lead Modal */}
      {newLeadOpen && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setNewLeadOpen(false)}
          />
          <div
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
            onClick={() => setNewLeadOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border overflow-hidden"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <h2
                  className="text-lg font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                >
                  Neuer Lead
                </h2>
                <button
                  onClick={() => setNewLeadOpen(false)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form */}
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {newLeadError && (
                  <div
                    className="rounded-lg px-3 py-2 text-sm flex items-center gap-2"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--red) 15%, transparent)',
                      color: 'var(--red)',
                      border: '1px solid var(--red)',
                    }}
                  >
                    <AlertCircle size={16} />
                    {newLeadError}
                  </div>
                )}

                {/* Firma + Kontakt */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Firma <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={newLeadData.firma}
                      onChange={(e) => setNewLeadData({ ...newLeadData, firma: e.target.value })}
                      placeholder="Firmenname"
                      className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-dm-sans)',
                      }}
                      onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--amber)'; }}
                      onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Kontakt</label>
                    <input
                      type="text"
                      value={newLeadData.kontakt}
                      onChange={(e) => setNewLeadData({ ...newLeadData, kontakt: e.target.value })}
                      placeholder="Ansprechpartner"
                      className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-dm-sans)',
                      }}
                      onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--amber)'; }}
                      onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                    />
                  </div>
                </div>

                {/* E-Mail + Telefon */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>E-Mail</label>
                    <input
                      type="email"
                      value={newLeadData.email}
                      onChange={(e) => setNewLeadData({ ...newLeadData, email: e.target.value })}
                      placeholder="email@firma.ch"
                      className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-dm-sans)',
                      }}
                      onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--amber)'; }}
                      onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Telefon</label>
                    <input
                      type="tel"
                      value={newLeadData.telefon}
                      onChange={(e) => setNewLeadData({ ...newLeadData, telefon: e.target.value })}
                      placeholder="+41 44 123 45 67"
                      className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-dm-sans)',
                      }}
                      onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--amber)'; }}
                      onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                    />
                  </div>
                </div>

                {/* Website */}
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Website</label>
                  <input
                    type="url"
                    value={newLeadData.website}
                    onChange={(e) => setNewLeadData({ ...newLeadData, website: e.target.value })}
                    placeholder="https://www.firma.ch"
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg)',
                      borderColor: 'var(--border)',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                    onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--amber)'; }}
                    onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                  />
                </div>

                {/* Adresse */}
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Adresse</label>
                  <input
                    type="text"
                    value={newLeadData.adresse}
                    onChange={(e) => setNewLeadData({ ...newLeadData, adresse: e.target.value })}
                    placeholder="Bahnhofstrasse 1"
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg)',
                      borderColor: 'var(--border)',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                    onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--amber)'; }}
                    onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                  />
                </div>

                {/* Ort + Kanton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Ort <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={newLeadData.ort}
                      onChange={(e) => setNewLeadData({ ...newLeadData, ort: e.target.value })}
                      placeholder="Zürich"
                      className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-dm-sans)',
                      }}
                      onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--amber)'; }}
                      onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Kanton</label>
                    <select
                      value={newLeadData.kanton}
                      onChange={(e) => setNewLeadData({ ...newLeadData, kanton: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                        fontFamily: 'var(--font-dm-sans)',
                      }}
                    >
                      {KANTONS.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Branche */}
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Branche</label>
                  <select
                    value={newLeadData.branche}
                    onChange={(e) => setNewLeadData({ ...newLeadData, branche: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg)',
                      borderColor: 'var(--border)',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                  >
                    {BRANCHEN.map((b) => (
                      <option key={b} value={b}>{b}</option>
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
                  onClick={() => setNewLeadOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Abbrechen
                </button>
                <button
                  onClick={createNewLead}
                  disabled={newLeadSaving || !newLeadData.firma.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-opacity"
                  style={{
                    backgroundColor: 'var(--amber)',
                    color: '#000',
                    opacity: newLeadSaving || !newLeadData.firma.trim() ? 0.4 : 1,
                  }}
                >
                  {newLeadSaving ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Erstellen...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Lead erstellen
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* CSV Import Modal */}
      {csvImportOpen && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setCsvImportOpen(false)}
          />
          <div
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
            onClick={() => setCsvImportOpen(false)}
          >
            <div
              className="w-full max-w-2xl rounded-2xl border overflow-hidden"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                className="flex items-center justify-between px-6 py-4 border-b shrink-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--green) 15%, transparent)' }}
                  >
                    <FileUp size={20} style={{ color: 'var(--green)' }} />
                  </div>
                  <div>
                    <h2
                      className="text-lg font-bold"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
                    >
                      CSV Import
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Leads aus einer CSV-Datei importieren
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCsvImportOpen(false)}
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

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Success/Error result */}
                {csvImportResult && (
                  <div
                    className="rounded-xl border p-4 flex items-center gap-3"
                    style={{
                      backgroundColor: csvImportResult.success
                        ? 'color-mix(in srgb, var(--green) 10%, var(--bg))'
                        : 'color-mix(in srgb, var(--red) 10%, var(--bg))',
                      borderColor: csvImportResult.success ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {csvImportResult.success ? (
                      <Check size={20} style={{ color: 'var(--green)', flexShrink: 0 }} />
                    ) : (
                      <AlertCircle size={20} style={{ color: 'var(--red)', flexShrink: 0 }} />
                    )}
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {csvImportResult.success
                          ? `${csvImportResult.count} Leads erfolgreich importiert!`
                          : 'Import fehlgeschlagen. Bitte überprüfen Sie die Datei.'}
                      </p>
                      {csvImportResult.success && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          Die Leads wurden der Datenbank hinzugefügt.
                        </p>
                      )}
                    </div>
                    {csvImportResult.success && (
                      <button
                        onClick={() => { setCsvImportOpen(false); resetCsvImport(); }}
                        className="ml-auto px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ backgroundColor: 'var(--green)', color: '#000' }}
                      >
                        Fertig
                      </button>
                    )}
                  </div>
                )}

                {/* File Upload Area */}
                {csvData.length === 0 && !csvImportResult?.success && (
                  <div
                    className="rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => csvFileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--green)';
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = 'color-mix(in srgb, var(--green) 5%, transparent)';
                    }}
                    onDragLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
                      const file = e.dataTransfer.files[0];
                      if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
                        const input = csvFileRef.current;
                        if (input) {
                          const dt = new DataTransfer();
                          dt.items.add(file);
                          input.files = dt.files;
                          input.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                      }
                    }}
                  >
                    <Upload size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                      CSV-Datei hierher ziehen
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      oder klicken zum Auswählen
                    </p>
                    <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                      Unterstützte Spalten: Firma, Kontakt, E-Mail, Telefon, Branche, Kanton, Ort
                    </p>
                    <input
                      ref={csvFileRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCSVFile}
                      className="hidden"
                    />
                  </div>
                )}

                {/* Column Mapping */}
                {csvData.length > 0 && !csvImportResult?.success && (
                  <>
                    {/* File info */}
                    <div
                      className="rounded-xl border p-4 flex items-center gap-3"
                      style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
                    >
                      <FileText size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                          {csvFileName}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {csvData.length} Zeilen · {csvHeaders.length} Spalten
                        </p>
                      </div>
                      <button
                        onClick={resetCsvImport}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{ color: 'var(--red)' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in srgb, var(--red) 10%, transparent)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                        }}
                      >
                        Andere Datei
                      </button>
                    </div>

                    {/* Mapping */}
                    <div className="space-y-3">
                      <h3
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                      >
                        Spalten-Zuordnung
                      </h3>
                      <div
                        className="rounded-xl border divide-y"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {CSV_FIELDS.map((field) => (
                          <div
                            key={field.key}
                            className="flex items-center justify-between gap-3 px-4 py-3"
                            style={{
                              backgroundColor: 'var(--bg)',
                              borderColor: 'var(--border)',
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <span className="text-sm" style={{ color: 'var(--text)' }}>
                                {field.label}
                              </span>
                              {field.required && (
                                <span className="text-xs" style={{ color: 'var(--red)' }}>*</span>
                              )}
                            </div>
                            <select
                              value={csvMapping[field.key] || ''}
                              onChange={(e) => {
                                setCsvMapping((prev) => ({ ...prev, [field.key]: e.target.value }));
                              }}
                              className="flex-1 max-w-[200px] px-3 py-2 rounded-lg border text-sm outline-none"
                              style={{
                                backgroundColor: 'var(--surface)',
                                borderColor: csvMapping[field.key] ? 'var(--green)' : 'var(--border)',
                                color: csvMapping[field.key] ? 'var(--text)' : 'var(--text-muted)',
                                fontFamily: 'var(--font-dm-sans)',
                              }}
                            >
                              <option value="">— Nicht zuordnen —</option>
                              {csvHeaders.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                            {csvMapping[field.key] && (
                              <Check size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="space-y-3">
                      <h3
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                      >
                        Vorschau (erste 5 Zeilen)
                      </h3>
                      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              {CSV_FIELDS.filter((f) => csvMapping[f.key]).map((f) => (
                                <th
                                  key={f.key}
                                  className="text-left px-3 py-2 font-bold uppercase tracking-wider"
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    color: 'var(--text-muted)',
                                    backgroundColor: 'var(--bg)',
                                  }}
                                >
                                  {f.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvData.slice(0, 5).map((row, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                {CSV_FIELDS.filter((f) => csvMapping[f.key]).map((f) => (
                                  <td
                                    key={f.key}
                                    className="px-3 py-2"
                                    style={{
                                      color: 'var(--text-secondary)',
                                      backgroundColor: 'var(--bg)',
                                      maxWidth: '150px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {row[csvMapping[f.key]] || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              {csvData.length > 0 && !csvImportResult?.success && (
                <div
                  className="flex items-center justify-between px-6 py-4 border-t shrink-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-2">
                    {!csvMapping.firma && (
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--amber)' }}>
                        <AlertCircle size={14} />
                        <span>&quot;Firma&quot; muss zugeordnet werden</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCsvImportOpen(false)}
                      className="px-4 py-2 rounded-lg text-sm transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleCSVImport}
                      disabled={csvImporting || !csvMapping.firma}
                      className="px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-opacity"
                      style={{
                        backgroundColor: 'var(--green)',
                        color: '#000',
                        opacity: csvImporting || !csvMapping.firma ? 0.4 : 1,
                      }}
                    >
                      {csvImporting ? (
                        <>
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                          Importieren...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          {csvData.length} Leads importieren
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Detail Panel */}
      {selectedLead && (
        <DetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={updateLead}
          onDelete={deleteLead}
          allTags={allTags}
        />
      )}
    </div>
  );
}
