'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2,
  Mail,
  Bell,
  Bot,
  Database,
  Save,
  Eye,
  EyeOff,
  Send,
  Download,
  Trash2,
  Upload,
  Phone,
  Globe,
  CreditCard,
  FileText,
  Server,
  Lock,
  BellRing,
  MessageSquare,
  AlertCircle,
  Moon,
  Cpu,
  Zap,
  CheckCircle2,
  Image,
  Palette,
  Type,
  Layers,
  Sparkles,
  Monitor,
  RotateCcw,
  HardDrive,
  BarChart3,
  FileUp,
  ClockAlert,
  BellOff,
  Loader2,
  Table,
  X,
  Users,
  Receipt,
  CalendarCheck,
  Megaphone,
  BotMessageSquare,
  Activity,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import Breadcrumb from '@/components/Breadcrumb';

/* ================================================================== */
/*  STYLES                                                             */
/* ================================================================== */
const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
};

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--text)',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
};

const bodyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-dm-sans)',
};

/* ================================================================== */
/*  TOGGLE                                                             */
/* ================================================================== */
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: checked ? 'var(--green)' : 'var(--border)',
        position: 'relative',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          backgroundColor: '#fff',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

/* ================================================================== */
/*  TEXT FIELD                                                          */
/* ================================================================== */
function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={labelStyle}>
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          >
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
          style={{
            ...inputStyle,
            paddingLeft: icon ? 36 : 12,
            fontFamily: 'var(--font-dm-sans)',
            '--tw-ring-color': 'var(--amber)',
          } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  SELECT FIELD                                                       */
/* ================================================================== */
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={labelStyle}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
        style={{
          ...inputStyle,
          fontFamily: 'var(--font-dm-sans)',
          '--tw-ring-color': 'var(--amber)',
        } as React.CSSProperties}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ================================================================== */
/*  SLIDER FIELD                                                       */
/* ================================================================== */
function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium" style={labelStyle}>
          {label}
        </label>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: 'var(--amber)' }}
        >
          {value.toLocaleString('de-CH')}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full outline-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--amber) 0%, var(--amber) ${pct}%, var(--border) ${pct}%, var(--border) 100%)`,
        }}
      />
      <div
        className="flex justify-between text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        <span>
          {min.toLocaleString('de-CH')}
          {unit}
        </span>
        <span>
          {max.toLocaleString('de-CH')}
          {unit}
        </span>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  API KEY FIELD                                                      */
/* ================================================================== */
function ApiKeyField({
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={labelStyle}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-..."
          className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
          style={{
            ...inputStyle,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            '--tw-ring-color': 'var(--amber)',
          } as React.CSSProperties}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="p-2 rounded-lg border transition-colors"
          style={{
            backgroundColor: 'var(--bg)',
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
          aria-label={visible ? 'Verstecken' : 'Anzeigen'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  SECTION HEADER                                                     */
/* ================================================================== */
function SectionHeader({
  icon,
  title,
  description,
  color = 'var(--amber)',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div
        className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
          color: color,
        }}
      >
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-bold" style={headingStyle}>
          {title}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', ...bodyStyle }}>
          {description}
        </p>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  SAVE BUTTON                                                        */
/* ================================================================== */
function SaveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 active:scale-[0.97]"
      style={{ backgroundColor: 'var(--amber)', color: '#000' }}
    >
      <Save size={15} />
      Aenderungen speichern
    </button>
  );
}

/* ================================================================== */
/*  NOTIFICATION ROW                                                   */
/* ================================================================== */
function NotificationRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors"
      style={{
        borderColor: checked ? 'color-mix(in srgb, var(--green) 30%, transparent)' : 'var(--border)',
        backgroundColor: checked
          ? 'color-mix(in srgb, var(--green) 4%, transparent)'
          : 'transparent',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0" style={{ color: checked ? 'var(--green)' : 'var(--text-muted)' }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ ...bodyStyle, color: 'var(--text)' }}>
            {title}
          </p>
          <p
            className="text-xs truncate mt-0.5"
            style={{ color: 'var(--text-muted)', ...bodyStyle }}
          >
            {description}
          </p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

/* ================================================================== */
/*  SETTINGS PAGE                                                      */
/* ================================================================== */
export default function SettingsPage() {
  const { toast } = useToast();

  /* ---------- Firma ---------- */
  const [firma, setFirma] = useState({
    firmenname: 'Werkpilot GmbH',
    adresse: 'Bahnhofstrasse 42',
    plzOrt: '8001 Zuerich',
    telefon: '+41 44 123 45 67',
    email: 'info@werkpilot.ch',
    website: 'https://werkpilot.ch',
    iban: 'CH93 0076 2011 6238 5295 7',
    mwstNummer: 'CHE-123.456.789 MWST',
    handelsregister: 'CH-020.3.045.678-9',
  });

  /* ---------- E-Mail ---------- */
  const [emailSettings, setEmailSettings] = useState({
    smtpServer: 'smtp.werkpilot.ch',
    port: '587',
    benutzername: 'noreply@werkpilot.ch',
    passwort: '',
    absenderName: 'Werkpilot',
    absenderEmail: 'noreply@werkpilot.ch',
  });

  /* ---------- Benachrichtigungen ---------- */
  const [notifications, setNotifications] = useState({
    neueLeads: true,
    followUpErinnerungen: true,
    rechnungsErinnerungen: true,
    agentFehler: true,
    nightshiftReports: false,
  });

  /* ---------- AI & Agents ---------- */
  const [aiSettings, setAiSettings] = useState({
    apiKey: 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    defaultModell: 'claude-sonnet-4-5',
    maxTokens: 4096,
    agentAutoRun: true,
  });
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  /* ---------- Darstellung / Theme ---------- */
  const ACCENT_PRESETS = [
    { name: 'Bernstein', color: '#f59e0b', glow: 'rgba(245,158,11,0.15)' },
    { name: 'Smaragd', color: '#22c55e', glow: 'rgba(34,197,94,0.12)' },
    { name: 'Saphir', color: '#60a5fa', glow: 'rgba(96,165,250,0.12)' },
    { name: 'Amethyst', color: '#8b5cf6', glow: 'rgba(139,92,246,0.12)' },
    { name: 'Rubin', color: '#ef4444', glow: 'rgba(239,68,68,0.12)' },
    { name: 'Rosé', color: '#ec4899', glow: 'rgba(236,72,153,0.12)' },
    { name: 'Teal', color: '#14b8a6', glow: 'rgba(20,184,166,0.12)' },
    { name: 'Orange', color: '#f97316', glow: 'rgba(249,115,22,0.12)' },
  ];

  const FONT_SIZES = [
    { label: 'Klein', value: 13 },
    { label: 'Normal', value: 14 },
    { label: 'Gross', value: 16 },
  ];

  const SIDEBAR_DENSITIES = [
    { label: 'Kompakt', value: 'compact', padding: '6px 12px' },
    { label: 'Normal', value: 'normal', padding: '10px 16px' },
    { label: 'Geraemig', value: 'spacious', padding: '14px 20px' },
  ];

  const BORDER_STYLES = [
    { label: 'Keine', value: 'none' },
    { label: 'Subtil', value: 'subtle' },
    { label: 'Glow', value: 'glow' },
  ];

  const [themeSettings, setThemeSettings] = useState({
    accentColor: '#f59e0b',
    accentGlow: 'rgba(245,158,11,0.15)',
    fontSize: 14,
    sidebarDensity: 'normal',
    borderStyle: 'subtle',
    animations: true,
  });

  // Load saved theme on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('werkpilot-theme');
      if (saved) {
        const parsed = JSON.parse(saved);
        setThemeSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, []);

  // Apply theme to CSS variables
  const applyTheme = useCallback((settings: typeof themeSettings) => {
    const root = document.documentElement;
    root.style.setProperty('--amber', settings.accentColor);
    root.style.setProperty('--amber-glow', settings.accentGlow);
    root.style.setProperty('--shadow-glow-amber', `0 0 20px ${settings.accentGlow}`);
    root.style.fontSize = `${settings.fontSize}px`;

    if (!settings.animations) {
      root.style.setProperty('--transition-fast', '0ms');
      root.style.setProperty('--transition-base', '0ms');
      root.style.setProperty('--transition-slow', '0ms');
    } else {
      root.style.setProperty('--transition-fast', '150ms cubic-bezier(0.4, 0, 0.2, 1)');
      root.style.setProperty('--transition-base', '250ms cubic-bezier(0.4, 0, 0.2, 1)');
      root.style.setProperty('--transition-slow', '400ms cubic-bezier(0.4, 0, 0.2, 1)');
    }
  }, []);

  // Apply on settings change
  useEffect(() => {
    applyTheme(themeSettings);
  }, [themeSettings, applyTheme]);

  const handleThemeSave = () => {
    localStorage.setItem('werkpilot-theme', JSON.stringify(themeSettings));
    toast('Design-Einstellungen gespeichert', 'success');
  };

  const handleThemeReset = () => {
    const defaults = {
      accentColor: '#f59e0b',
      accentGlow: 'rgba(245,158,11,0.15)',
      fontSize: 14,
      sidebarDensity: 'normal',
      borderStyle: 'subtle',
      animations: true,
    };
    setThemeSettings(defaults);
    localStorage.removeItem('werkpilot-theme');
    applyTheme(defaults);
    toast('Design zurueckgesetzt', 'info');
  };

  /* ---------- Daten & Export ---------- */
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  /* ---------- Daten & Backup ---------- */
  interface ModuleStats {
    leads: number;
    invoices: number;
    followUps: number;
    campaigns: number;
    agents: number;
    agentLogs: number;
    notifications: number;
    activities: number;
    expenses: number;
    emailLogs: number;
    nightShiftTasks: number;
  }
  const [stats, setStats] = useState<ModuleStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvDragOver, setCsvDragOver] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState<string | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthData, setHealthData] = useState<{
    dbStatus: 'ok' | 'error';
    apiLatency: number;
    uptime: number;
    dbSize: string;
    lastBackup: string | null;
    errorCount: number;
  } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // API Keys management
  const [apiKeys, setApiKeys] = useState<{
    id: string;
    key: string;
    description: string;
    createdAt: string;
    lastUsed: string | null;
  }[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('werkpilot-api-keys');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/settings/stats');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setStats(data);
    } catch {
      toast('Statistiken konnten nicht geladen werden', 'error');
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const parseCsv = (text: string): { headers: string[]; rows: string[][] } => {
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map((line) =>
      line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ''))
    );
    return { headers, rows };
  };

  const handleCsvSelect = (file: File) => {
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCsv(text);
      setCsvHeaders(headers);
      setCsvPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCsvDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleCsvSelect(file);
    } else {
      toast('Bitte nur CSV-Dateien hochladen', 'warning');
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvImporting(true);
    try {
      const text = await csvFile.text();
      const { headers, rows } = parseCsv(text);

      const fieldMap: Record<string, string> = {
        firma: 'firma',
        firmenname: 'firma',
        company: 'firma',
        kontakt: 'kontakt',
        contact: 'kontakt',
        ansprechpartner: 'kontakt',
        email: 'email',
        'e-mail': 'email',
        telefon: 'telefon',
        phone: 'telefon',
        tel: 'telefon',
        website: 'website',
        web: 'website',
        url: 'website',
        adresse: 'adresse',
        address: 'adresse',
        branche: 'branche',
        industry: 'branche',
        kanton: 'kanton',
        canton: 'kanton',
        ort: 'ort',
        city: 'ort',
        stadt: 'ort',
        status: 'status',
        quelle: 'quelle',
        source: 'quelle',
      };

      const headerMapping = headers.map((h) => fieldMap[h.toLowerCase()] || null);
      let imported = 0;
      let errors = 0;

      for (const row of rows) {
        const lead: Record<string, string> = {};
        headerMapping.forEach((field, idx) => {
          if (field && row[idx]) {
            lead[field] = row[idx];
          }
        });

        if (!lead.firma || !lead.branche || !lead.kanton || !lead.ort) {
          errors++;
          return;
        }

        try {
          const res = await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...lead,
              quelle: lead.quelle || 'csv-import',
            }),
          });
          if (res.ok) imported++;
          else errors++;
        } catch {
          errors++;
        }
      }

      toast(
        `Import abgeschlossen: ${imported} Leads importiert${errors > 0 ? `, ${errors} Fehler` : ''}`,
        errors > 0 ? 'warning' : 'success'
      );
      setCsvFile(null);
      setCsvPreview([]);
      setCsvHeaders([]);
      fetchStats();
    } catch {
      toast('CSV-Import fehlgeschlagen', 'error');
    } finally {
      setCsvImporting(false);
    }
  };

  const handleFullExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch('/api/settings/export');
      if (!res.ok) throw new Error('Export fehlgeschlagen');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `werkpilot-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Export erfolgreich heruntergeladen', 'success');
    } catch {
      toast('Export fehlgeschlagen', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const handleCleanup = async (action: string, label: string) => {
    setCleanupLoading(action);
    try {
      const res = await fetch('/api/settings/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Cleanup fehlgeschlagen');
      const data = await res.json();
      toast(`${label}: ${data.deleted} Eintraege geloescht`, 'success');
      fetchStats();
    } catch {
      toast(`${label} fehlgeschlagen`, 'error');
    } finally {
      setCleanupLoading(null);
    }
  };

  /* ---------- Health Check ---------- */
  const runHealthCheck = useCallback(async () => {
    setHealthChecking(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/settings/stats');
      const latency = Math.round(performance.now() - start);
      const ok = res.ok;
      setHealthData({
        dbStatus: ok ? 'ok' : 'error',
        apiLatency: latency,
        uptime: Math.floor(performance.now() / 1000),
        dbSize: stats ? `${((stats.leads + stats.invoices + stats.agents + stats.followUps + stats.campaigns + stats.expenses) * 0.8).toFixed(1)} KB` : '—',
        lastBackup: null,
        errorCount: ok ? 0 : 1,
      });
    } catch {
      setHealthData({
        dbStatus: 'error',
        apiLatency: Math.round(performance.now() - start),
        uptime: Math.floor(performance.now() / 1000),
        dbSize: '—',
        lastBackup: null,
        errorCount: 1,
      });
    } finally {
      setHealthChecking(false);
    }
  }, [stats]);

  /* ---------- Handlers ---------- */
  const handleSave = (section: string) => {
    toast(`${section} erfolgreich gespeichert`, 'success');
  };

  const handleTestEmail = () => {
    toast('Test-E-Mail wurde gesendet', 'info');
  };

  const handleExport = () => {
    toast('Export wird vorbereitet...', 'info');
  };

  const handleReset = () => {
    setShowResetConfirm(false);
    toast('Datenbank wurde zurueckgesetzt', 'warning');
  };

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      <Breadcrumb items={[{ label: 'Settings' }]} />
      {/* Page Header */}
      <div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Einstellungen
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', ...bodyStyle }}>
          Verwalte deine Werkpilot-Konfiguration und Praeferenzen
        </p>
      </div>

      {/* ============================================================= */}
      {/* 1. FIRMA                                                       */}
      {/* ============================================================= */}
      <section className="card-glass-premium p-5 md:p-6">
        <SectionHeader
          icon={<Building2 size={20} />}
          title="Firma"
          description="Firmeninformationen und Geschaeftsdaten"
          color="var(--amber)"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="sm:col-span-2">
            <TextField
              label="Firmenname"
              value={firma.firmenname}
              onChange={(v) => setFirma({ ...firma, firmenname: v })}
              placeholder="Werkpilot GmbH"
              icon={<Building2 size={14} />}
            />
          </div>
          <TextField
            label="Adresse"
            value={firma.adresse}
            onChange={(v) => setFirma({ ...firma, adresse: v })}
            placeholder="Bahnhofstrasse 42"
          />
          <TextField
            label="PLZ / Ort"
            value={firma.plzOrt}
            onChange={(v) => setFirma({ ...firma, plzOrt: v })}
            placeholder="8001 Zuerich"
          />
          <TextField
            label="Telefon"
            value={firma.telefon}
            onChange={(v) => setFirma({ ...firma, telefon: v })}
            placeholder="+41 44 123 45 67"
            icon={<Phone size={14} />}
          />
          <TextField
            label="E-Mail"
            value={firma.email}
            onChange={(v) => setFirma({ ...firma, email: v })}
            type="email"
            placeholder="info@werkpilot.ch"
            icon={<Mail size={14} />}
          />
          <TextField
            label="Website"
            value={firma.website}
            onChange={(v) => setFirma({ ...firma, website: v })}
            placeholder="https://werkpilot.ch"
            icon={<Globe size={14} />}
          />
        </div>

        {/* Divider */}
        <div className="divider my-6" />

        {/* Financial details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <TextField
            label="IBAN"
            value={firma.iban}
            onChange={(v) => setFirma({ ...firma, iban: v })}
            placeholder="CH93 0076 2011 6238 5295 7"
            icon={<CreditCard size={14} />}
          />
          <TextField
            label="MwSt-Nummer (8.1%)"
            value={firma.mwstNummer}
            onChange={(v) => setFirma({ ...firma, mwstNummer: v })}
            placeholder="CHE-123.456.789 MWST"
            icon={<FileText size={14} />}
          />
          <TextField
            label="Handelsregisternummer"
            value={firma.handelsregister}
            onChange={(v) => setFirma({ ...firma, handelsregister: v })}
            placeholder="CH-020.3.045.678-9"
          />
        </div>

        {/* Logo Upload Placeholder */}
        <div className="mb-6">
          <label className="text-xs font-medium block mb-2" style={labelStyle}>
            Firmenlogo
          </label>
          <div
            className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:border-[var(--amber)]"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'color-mix(in srgb, var(--bg) 50%, transparent)',
            }}
          >
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl"
              style={{
                backgroundColor: 'var(--surface-hover)',
                color: 'var(--text-muted)',
              }}
            >
              <Image size={24} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Logo hochladen
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                PNG, JPG oder SVG (max. 2 MB)
              </p>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-[var(--surface-hover)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <Upload size={13} />
              Datei auswaehlen
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <SaveButton onClick={() => handleSave('Firmadaten')} />
        </div>
      </section>

      {/* ============================================================= */}
      {/* 2. E-MAIL EINSTELLUNGEN                                        */}
      {/* ============================================================= */}
      <section className="card-glass-premium p-5 md:p-6">
        <SectionHeader
          icon={<Mail size={20} />}
          title="E-Mail Einstellungen"
          description="SMTP-Konfiguration und Absender-Einstellungen"
          color="var(--blue)"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <TextField
            label="SMTP Server"
            value={emailSettings.smtpServer}
            onChange={(v) => setEmailSettings({ ...emailSettings, smtpServer: v })}
            placeholder="smtp.beispiel.ch"
            icon={<Server size={14} />}
          />
          <TextField
            label="Port"
            value={emailSettings.port}
            onChange={(v) => setEmailSettings({ ...emailSettings, port: v })}
            placeholder="587"
          />
          <TextField
            label="Benutzername"
            value={emailSettings.benutzername}
            onChange={(v) => setEmailSettings({ ...emailSettings, benutzername: v })}
            placeholder="user@beispiel.ch"
          />
          <TextField
            label="Passwort"
            value={emailSettings.passwort}
            onChange={(v) => setEmailSettings({ ...emailSettings, passwort: v })}
            type="password"
            placeholder="Passwort eingeben"
            icon={<Lock size={14} />}
          />
        </div>

        <div className="divider my-6" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <TextField
            label="Absender-Name"
            value={emailSettings.absenderName}
            onChange={(v) => setEmailSettings({ ...emailSettings, absenderName: v })}
            placeholder="Werkpilot"
          />
          <TextField
            label="Absender-E-Mail"
            value={emailSettings.absenderEmail}
            onChange={(v) => setEmailSettings({ ...emailSettings, absenderEmail: v })}
            type="email"
            placeholder="noreply@werkpilot.ch"
            icon={<Mail size={14} />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <button
            type="button"
            onClick={handleTestEmail}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--surface-hover)]"
            style={{
              borderColor: 'var(--blue)',
              color: 'var(--blue)',
            }}
          >
            <Send size={15} />
            Test-E-Mail senden
          </button>
          <SaveButton onClick={() => handleSave('E-Mail Einstellungen')} />
        </div>
      </section>

      {/* ============================================================= */}
      {/* 3. BENACHRICHTIGUNGEN                                          */}
      {/* ============================================================= */}
      <section className="card-glass-premium p-5 md:p-6">
        <SectionHeader
          icon={<Bell size={20} />}
          title="Benachrichtigungen"
          description="Welche Benachrichtigungen moechtest du erhalten?"
          color="var(--green)"
        />

        <div className="space-y-3 mb-6">
          <NotificationRow
            icon={<Zap size={18} />}
            title="Neue Leads"
            description="Benachrichtigung wenn ein neuer Lead erfasst wird"
            checked={notifications.neueLeads}
            onChange={(v) => setNotifications({ ...notifications, neueLeads: v })}
          />
          <NotificationRow
            icon={<BellRing size={18} />}
            title="Follow-Up Erinnerungen"
            description="Erinnerungen fuer anstehende Follow-Ups und Nachfassaktionen"
            checked={notifications.followUpErinnerungen}
            onChange={(v) => setNotifications({ ...notifications, followUpErinnerungen: v })}
          />
          <NotificationRow
            icon={<CreditCard size={18} />}
            title="Rechnungs-Erinnerungen"
            description="Benachrichtigung bei faelligen oder ueberfaelligen Rechnungen"
            checked={notifications.rechnungsErinnerungen}
            onChange={(v) => setNotifications({ ...notifications, rechnungsErinnerungen: v })}
          />
          <NotificationRow
            icon={<AlertCircle size={18} />}
            title="Agent-Fehler"
            description="Sofort-Benachrichtigung wenn ein Agent einen Fehler meldet"
            checked={notifications.agentFehler}
            onChange={(v) => setNotifications({ ...notifications, agentFehler: v })}
          />
          <NotificationRow
            icon={<Moon size={18} />}
            title="Nightshift-Reports"
            description="Taeglicher Report ueber die Nightshift-Agent-Aktivitaeten"
            checked={notifications.nightshiftReports}
            onChange={(v) => setNotifications({ ...notifications, nightshiftReports: v })}
          />
        </div>

        <div className="flex justify-end">
          <SaveButton onClick={() => handleSave('Benachrichtigungen')} />
        </div>
      </section>

      {/* ============================================================= */}
      {/* 3b. DARSTELLUNG / THEME                                         */}
      {/* ============================================================= */}
      <section className="card-glass-premium p-5 md:p-6">
        <SectionHeader
          icon={<Palette size={20} />}
          title="Darstellung"
          description="Akzentfarbe, Schriftgroesse und visuelle Praeferenzen"
          color="var(--purple)"
        />

        {/* Accent Color Picker */}
        <div className="mb-6">
          <label className="text-xs font-medium block mb-3" style={labelStyle}>
            <div className="flex items-center gap-2">
              <Sparkles size={13} />
              Akzentfarbe
            </div>
          </label>
          <div className="flex flex-wrap gap-3">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() =>
                  setThemeSettings({
                    ...themeSettings,
                    accentColor: preset.color,
                    accentGlow: preset.glow,
                  })
                }
                className="flex flex-col items-center gap-1.5 group"
                title={preset.name}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: preset.color,
                    border:
                      themeSettings.accentColor === preset.color
                        ? '3px solid var(--text)'
                        : '3px solid transparent',
                    boxShadow:
                      themeSettings.accentColor === preset.color
                        ? `0 0 16px ${preset.glow}`
                        : 'none',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                />
                <span
                  className="text-xs"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color:
                      themeSettings.accentColor === preset.color
                        ? preset.color
                        : 'var(--text-muted)',
                    fontWeight: themeSettings.accentColor === preset.color ? 700 : 400,
                  }}
                >
                  {preset.name}
                </span>
              </button>
            ))}
          </div>

          {/* Live preview swatch */}
          <div
            className="mt-4 p-3 rounded-xl border flex items-center gap-3"
            style={{
              borderColor: `color-mix(in srgb, ${themeSettings.accentColor} 30%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${themeSettings.accentColor} 4%, transparent)`,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor: themeSettings.accentColor,
              }}
            />
            <span className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              Vorschau: Aktive Akzentfarbe
            </span>
            <span className="text-xs font-bold" style={{ color: themeSettings.accentColor, fontFamily: 'var(--font-mono)' }}>
              {themeSettings.accentColor}
            </span>
          </div>
        </div>

        <div className="divider my-6" />

        {/* Font Size */}
        <div className="mb-6">
          <label className="text-xs font-medium block mb-3" style={labelStyle}>
            <div className="flex items-center gap-2">
              <Type size={13} />
              Schriftgroesse
            </div>
          </label>
          <div className="flex gap-2">
            {FONT_SIZES.map((fs) => (
              <button
                key={fs.value}
                type="button"
                onClick={() => setThemeSettings({ ...themeSettings, fontSize: fs.value })}
                className="px-4 py-2 rounded-lg border text-sm font-medium transition-all"
                style={{
                  borderColor:
                    themeSettings.fontSize === fs.value
                      ? themeSettings.accentColor
                      : 'var(--border)',
                  backgroundColor:
                    themeSettings.fontSize === fs.value
                      ? `color-mix(in srgb, ${themeSettings.accentColor} 12%, transparent)`
                      : 'transparent',
                  color:
                    themeSettings.fontSize === fs.value
                      ? themeSettings.accentColor
                      : 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {fs.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Density */}
        <div className="mb-6">
          <label className="text-xs font-medium block mb-3" style={labelStyle}>
            <div className="flex items-center gap-2">
              <Layers size={13} />
              Sidebar-Dichte
            </div>
          </label>
          <div className="flex gap-2">
            {SIDEBAR_DENSITIES.map((sd) => (
              <button
                key={sd.value}
                type="button"
                onClick={() => setThemeSettings({ ...themeSettings, sidebarDensity: sd.value })}
                className="px-4 py-2 rounded-lg border text-sm font-medium transition-all"
                style={{
                  borderColor:
                    themeSettings.sidebarDensity === sd.value
                      ? themeSettings.accentColor
                      : 'var(--border)',
                  backgroundColor:
                    themeSettings.sidebarDensity === sd.value
                      ? `color-mix(in srgb, ${themeSettings.accentColor} 12%, transparent)`
                      : 'transparent',
                  color:
                    themeSettings.sidebarDensity === sd.value
                      ? themeSettings.accentColor
                      : 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {sd.label}
              </button>
            ))}
          </div>
        </div>

        {/* Card Border Style */}
        <div className="mb-6">
          <label className="text-xs font-medium block mb-3" style={labelStyle}>
            <div className="flex items-center gap-2">
              <Monitor size={13} />
              Karten-Rahmen
            </div>
          </label>
          <div className="flex gap-2">
            {BORDER_STYLES.map((bs) => (
              <button
                key={bs.value}
                type="button"
                onClick={() => setThemeSettings({ ...themeSettings, borderStyle: bs.value })}
                className="px-4 py-2 rounded-lg border text-sm font-medium transition-all"
                style={{
                  borderColor:
                    themeSettings.borderStyle === bs.value
                      ? themeSettings.accentColor
                      : 'var(--border)',
                  backgroundColor:
                    themeSettings.borderStyle === bs.value
                      ? `color-mix(in srgb, ${themeSettings.accentColor} 12%, transparent)`
                      : 'transparent',
                  color:
                    themeSettings.borderStyle === bs.value
                      ? themeSettings.accentColor
                      : 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {bs.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divider my-6" />

        {/* Animations Toggle */}
        <div
          className="flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors mb-6"
          style={{
            borderColor: themeSettings.animations
              ? `color-mix(in srgb, ${themeSettings.accentColor} 30%, transparent)`
              : 'var(--border)',
            backgroundColor: themeSettings.animations
              ? `color-mix(in srgb, ${themeSettings.accentColor} 4%, transparent)`
              : 'transparent',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="shrink-0"
              style={{ color: themeSettings.animations ? themeSettings.accentColor : 'var(--text-muted)' }}
            >
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ ...bodyStyle, color: 'var(--text)' }}>
                Animationen
              </p>
              <p
                className="text-xs truncate mt-0.5"
                style={{ color: 'var(--text-muted)', ...bodyStyle }}
              >
                Uebergangseffekte und Animationen aktivieren
              </p>
            </div>
          </div>
          <Toggle
            checked={themeSettings.animations}
            onChange={(v) => setThemeSettings({ ...themeSettings, animations: v })}
          />
        </div>

        {/* Save / Reset */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <button
            type="button"
            onClick={handleThemeReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--surface-hover)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <RotateCcw size={15} />
            Zuruecksetzen
          </button>
          <SaveButton onClick={handleThemeSave} />
        </div>
      </section>

      {/* ============================================================= */}
      {/* 4. AI & AGENTS                                                 */}
      {/* ============================================================= */}
      <section className="card-glass-premium p-5 md:p-6">
        <SectionHeader
          icon={<Bot size={20} />}
          title="AI & Agents"
          description="KI-Modell-Konfiguration und Agent-Verhalten"
          color="var(--purple)"
        />

        <div className="space-y-5 mb-6">
          <ApiKeyField
            label="API Key"
            value={aiSettings.apiKey}
            onChange={(v) => setAiSettings({ ...aiSettings, apiKey: v })}
            visible={apiKeyVisible}
            onToggleVisibility={() => setApiKeyVisible(!apiKeyVisible)}
          />

          <SelectField
            label="Default-Modell"
            value={aiSettings.defaultModell}
            onChange={(v) => setAiSettings({ ...aiSettings, defaultModell: v })}
            options={[
              { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (Premium)' },
              { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Balanced)' },
              { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (Schnell & Guenstig)' },
            ]}
          />

          <SliderField
            label="Max Tokens"
            value={aiSettings.maxTokens}
            onChange={(v) => setAiSettings({ ...aiSettings, maxTokens: v })}
            min={256}
            max={16384}
            step={256}
          />

          <div
            className="flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors"
            style={{
              borderColor: aiSettings.agentAutoRun
                ? 'color-mix(in srgb, var(--purple) 30%, transparent)'
                : 'var(--border)',
              backgroundColor: aiSettings.agentAutoRun
                ? 'color-mix(in srgb, var(--purple) 4%, transparent)'
                : 'transparent',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="shrink-0"
                style={{
                  color: aiSettings.agentAutoRun ? 'var(--purple)' : 'var(--text-muted)',
                }}
              >
                <Cpu size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ ...bodyStyle, color: 'var(--text)' }}>
                  Agent Auto-Run
                </p>
                <p
                  className="text-xs truncate mt-0.5"
                  style={{ color: 'var(--text-muted)', ...bodyStyle }}
                >
                  Agents automatisch starten wenn neue Aufgaben eingehen
                </p>
              </div>
            </div>
            <Toggle
              checked={aiSettings.agentAutoRun}
              onChange={(v) => setAiSettings({ ...aiSettings, agentAutoRun: v })}
            />
          </div>

          {/* Model info panel */}
          <div
            className="p-4 rounded-xl border"
            style={{
              backgroundColor: 'var(--surface-hover)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} style={{ color: 'var(--purple)' }} />
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--purple)', fontFamily: 'var(--font-mono)' }}
              >
                Aktives Modell
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Modell
                </p>
                <p
                  className="text-sm font-semibold mt-0.5"
                  style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                >
                  {aiSettings.defaultModell}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Max Tokens
                </p>
                <p
                  className="text-sm font-semibold mt-0.5"
                  style={{ color: 'var(--amber)' }}
                >
                  {aiSettings.maxTokens.toLocaleString('de-CH')}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Status
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 size={13} style={{ color: 'var(--green)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--green)' }}>
                    Verbunden
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <SaveButton onClick={() => handleSave('AI & Agents')} />
        </div>
      </section>

      {/* ============================================================= */}
      {/* 5. DATEN & BACKUP                                              */}
      {/* ============================================================= */}
      <section className="card-glass-premium p-5 md:p-6">
        <SectionHeader
          icon={<HardDrive size={20} />}
          title="Daten & Backup"
          description="Statistiken, Import, Export und Datenbereinigung"
          color="var(--blue)"
        />

        {/* ---------- Usage Statistics ---------- */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} style={{ color: 'var(--blue)' }} />
            <h3
              className="text-sm font-bold uppercase tracking-wide"
              style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}
            >
              Nutzungsstatistiken
            </h3>
          </div>
          {statsLoading || !stats ? (
            <div
              className="flex items-center justify-center gap-2 p-8 rounded-xl border"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-hover)' }}
            >
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--text-muted)', ...bodyStyle }}>
                Statistiken werden geladen...
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {[
                { label: 'Leads', count: stats.leads, icon: <Users size={16} />, color: 'var(--amber)' },
                { label: 'Rechnungen', count: stats.invoices, icon: <Receipt size={16} />, color: 'var(--green)' },
                { label: 'Follow-Ups', count: stats.followUps, icon: <CalendarCheck size={16} />, color: 'var(--blue)' },
                { label: 'Kampagnen', count: stats.campaigns, icon: <Megaphone size={16} />, color: 'var(--purple)' },
                { label: 'Agents', count: stats.agents, icon: <BotMessageSquare size={16} />, color: 'var(--red)' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-3 rounded-xl border text-center"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--surface-hover)',
                  }}
                >
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-lg mx-auto mb-2"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${item.color} 12%, transparent)`,
                      color: item.color,
                    }}
                  >
                    {item.icon}
                  </div>
                  <p
                    className="text-xl font-bold tabular-nums"
                    style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                  >
                    {item.count.toLocaleString('de-CH')}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', ...bodyStyle }}>
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divider my-6" />

        {/* ---------- CSV Lead Import ---------- */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileUp size={16} style={{ color: 'var(--green)' }} />
            <h3
              className="text-sm font-bold uppercase tracking-wide"
              style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}
            >
              CSV Lead Import
            </h3>
          </div>

          {/* Hidden file input */}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCsvSelect(file);
            }}
          />

          {!csvFile ? (
            <div
              className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors"
              style={{
                borderColor: csvDragOver ? 'var(--green)' : 'var(--border)',
                backgroundColor: csvDragOver
                  ? 'color-mix(in srgb, var(--green) 4%, transparent)'
                  : 'color-mix(in srgb, var(--bg) 50%, transparent)',
              }}
              onDragOver={(e) => { e.preventDefault(); setCsvDragOver(true); }}
              onDragLeave={() => setCsvDragOver(false)}
              onDrop={handleCsvDrop}
              onClick={() => csvInputRef.current?.click()}
            >
              <div
                className="flex items-center justify-center w-12 h-12 rounded-xl"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--green) 12%, transparent)',
                  color: 'var(--green)',
                }}
              >
                <Upload size={24} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)', ...bodyStyle }}>
                  CSV-Datei hierher ziehen oder klicken
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', ...bodyStyle }}>
                  Spalten: Firma, Kontakt, Email, Telefon, Branche, Kanton, Ort
                </p>
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* File header */}
              <div
                className="flex items-center justify-between gap-3 px-4 py-3"
                style={{ backgroundColor: 'var(--surface-hover)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Table size={16} style={{ color: 'var(--green)' }} />
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text)', ...bodyStyle }}
                  >
                    {csvFile.name}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--green) 12%, transparent)',
                      color: 'var(--green)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {csvPreview.length}+ Zeilen
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setCsvFile(null); setCsvPreview([]); setCsvHeaders([]); }}
                  className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Datei entfernen"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Preview table */}
              {csvHeaders.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ ...bodyStyle }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg)' }}>
                        {csvHeaders.map((h, i) => (
                          <th
                            key={i}
                            className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border)' }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-3 py-2 whitespace-nowrap"
                              style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
                            >
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Import button */}
              <div
                className="flex items-center justify-between gap-3 px-4 py-3"
                style={{ backgroundColor: 'var(--surface-hover)' }}
              >
                <p className="text-xs" style={{ color: 'var(--text-muted)', ...bodyStyle }}>
                  Vorschau der ersten 5 Zeilen. Pflichtfelder: Firma, Branche, Kanton, Ort
                </p>
                <button
                  type="button"
                  onClick={handleCsvImport}
                  disabled={csvImporting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 active:scale-[0.97] shrink-0 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--green)', color: '#000' }}
                >
                  {csvImporting ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Upload size={15} />
                  )}
                  {csvImporting ? 'Importiere...' : 'Leads importieren'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="divider my-6" />

        {/* ---------- Full Export ---------- */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Download size={16} style={{ color: 'var(--amber)' }} />
            <h3
              className="text-sm font-bold uppercase tracking-wide"
              style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}
            >
              Vollstaendiger Export
            </h3>
          </div>
          <div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--surface-hover)',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Download size={20} style={{ color: 'var(--amber)' }} className="shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ ...bodyStyle, color: 'var(--text)' }}>
                  Alle Daten als JSON exportieren
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--text-muted)', ...bodyStyle }}
                >
                  Exportiert Leads, Rechnungen, Follow-Ups, Kampagnen, Agents und alle weiteren Daten
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFullExport}
              disabled={exportLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 active:scale-[0.97] shrink-0 disabled:opacity-50"
              style={{ backgroundColor: 'var(--amber)', color: '#000' }}
            >
              {exportLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              {exportLoading ? 'Exportiere...' : 'JSON Export'}
            </button>
          </div>
        </div>

        <div className="divider my-6" />

        {/* ---------- Data Cleanup ---------- */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 size={16} style={{ color: 'var(--red)' }} />
            <h3
              className="text-sm font-bold uppercase tracking-wide"
              style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)' }}
            >
              Datenbereinigung
            </h3>
          </div>
          <div className="space-y-3">
            {/* Delete old logs */}
            <div
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--surface-hover)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ClockAlert size={20} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ ...bodyStyle, color: 'var(--text)' }}>
                    Alte Logs loeschen (&gt;30 Tage)
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--text-muted)', ...bodyStyle }}
                  >
                    Entfernt Agent-Logs die aelter als 30 Tage sind
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCleanup('delete_old_logs', 'Alte Logs loeschen')}
                disabled={cleanupLoading !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--surface-hover)] shrink-0 disabled:opacity-50"
                style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
              >
                {cleanupLoading === 'delete_old_logs' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ClockAlert size={15} />
                )}
                Logs bereinigen
              </button>
            </div>

            {/* Delete read notifications */}
            <div
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--surface-hover)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <BellOff size={20} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ ...bodyStyle, color: 'var(--text)' }}>
                    Gelesene Benachrichtigungen loeschen
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--text-muted)', ...bodyStyle }}
                  >
                    Entfernt alle bereits gelesenen Benachrichtigungen
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCleanup('delete_read_notifications', 'Benachrichtigungen loeschen')}
                disabled={cleanupLoading !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--surface-hover)] shrink-0 disabled:opacity-50"
                style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
              >
                {cleanupLoading === 'delete_read_notifications' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <BellOff size={15} />
                )}
                Benachrichtigungen bereinigen
              </button>
            </div>
          </div>
        </div>

        <div className="divider my-6" />

        {/* ---------- Danger Zone ---------- */}
        <div
          className="p-4 rounded-xl border"
          style={{
            borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--red) 4%, transparent)',
          }}
        >
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)' }}
          >
            Gefahrenzone
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)', ...bodyStyle }}>
            Diese Aktion loescht alle Daten unwiderruflich. Dies kann nicht rueckgaengig gemacht
            werden.
          </p>

          {!showResetConfirm ? (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--red)', color: '#fff' }}
            >
              <Trash2 size={15} />
              Datenbank zuruecksetzen
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <p className="text-sm font-medium" style={{ color: 'var(--red)' }}>
                Bist du sicher?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: 'var(--red)', color: '#fff' }}
                >
                  <Trash2 size={15} />
                  Ja, zuruecksetzen
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SYSTEM HEALTH                                                 */}
      {/* ============================================================ */}
      <section className="card-glass-premium p-5 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--green)' }}>
              <Activity size={18} />
            </div>
            <div>
              <h2 style={headingStyle}>System Health</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Status und Diagnose
              </p>
            </div>
          </div>
          <button
            onClick={runHealthCheck}
            disabled={healthChecking}
            className="px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
            style={{
              backgroundColor: healthChecking ? 'var(--border)' : 'var(--green)',
              color: healthChecking ? 'var(--text-muted)' : '#000',
              border: 'none',
              cursor: healthChecking ? 'not-allowed' : 'pointer',
            }}
          >
            {healthChecking ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
            {healthChecking ? 'Pruefe...' : 'Health Check'}
          </button>
        </div>

        {!healthData ? (
          <div className="text-center py-8">
            <Server size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Klicken Sie &quot;Health Check&quot; um den Systemstatus zu pruefen.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Database Status */}
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: 'var(--bg)',
                border: `1px solid ${healthData.dbStatus === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {healthData.dbStatus === 'ok' ? (
                  <Wifi size={14} style={{ color: 'var(--green)' }} />
                ) : (
                  <WifiOff size={14} style={{ color: 'var(--red)' }} />
                )}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Datenbank</span>
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: healthData.dbStatus === 'ok' ? 'var(--green)' : 'var(--red)',
                }}
              >
                {healthData.dbStatus === 'ok' ? 'Online' : 'Fehler'}
              </span>
            </div>

            {/* API Latency */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} style={{ color: healthData.apiLatency < 200 ? 'var(--green)' : healthData.apiLatency < 500 ? 'var(--amber)' : 'var(--red)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>API Latenz</span>
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: healthData.apiLatency < 200 ? 'var(--green)' : healthData.apiLatency < 500 ? 'var(--amber)' : 'var(--red)',
                }}
              >
                {healthData.apiLatency}ms
              </span>
            </div>

            {/* DB Size */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <HardDrive size={14} style={{ color: 'var(--blue)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>DB Groesse</span>
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--blue)',
                }}
              >
                {healthData.dbSize}
              </span>
            </div>

            {/* Error Count */}
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: 'var(--bg)',
                border: `1px solid ${healthData.errorCount === 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} style={{ color: healthData.errorCount === 0 ? 'var(--green)' : 'var(--red)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Fehler</span>
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: healthData.errorCount === 0 ? 'var(--green)' : 'var(--red)',
                }}
              >
                {healthData.errorCount}
              </span>
            </div>
          </div>
        )}

        {/* Health Score Bar */}
        {healthData && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                System Health Score
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: healthData.dbStatus === 'ok' && healthData.apiLatency < 500 ? 'var(--green)' : 'var(--amber)',
                }}
              >
                {healthData.dbStatus === 'ok' && healthData.apiLatency < 200 ? '98' : healthData.dbStatus === 'ok' ? '85' : '40'}/100
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 4,
                  width: `${healthData.dbStatus === 'ok' && healthData.apiLatency < 200 ? 98 : healthData.dbStatus === 'ok' ? 85 : 40}%`,
                  background: `linear-gradient(90deg, ${healthData.dbStatus === 'ok' ? 'var(--green)' : 'var(--red)'}, ${healthData.dbStatus === 'ok' && healthData.apiLatency < 200 ? 'var(--green)' : 'var(--amber)'})`,
                  transition: 'width 0.6s ease',
                  boxShadow: `0 0 8px ${healthData.dbStatus === 'ok' ? 'var(--green-glow)' : 'var(--red-glow)'}`,
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* ============================================================ */}
      {/*  API KEYS MANAGEMENT                                          */}
      {/* ============================================================ */}
      <section className="card-glass-premium" style={{ padding: '24px 28px', borderRadius: 16 }}>
        <h2 style={headingStyle}>
          <Lock size={18} style={{ color: 'var(--purple)' }} />
          API-Schluessel
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)', marginTop: -8, marginBottom: 16 }}>
          API-Schluessel fuer externe Integrationen und Automatisierungen verwalten
        </p>

        {/* Generate new key */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Beschreibung (z.B. Zapier Integration)"
            value={newKeyDescription}
            onChange={(e) => setNewKeyDescription(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontFamily: 'var(--font-dm-sans)',
            }}
          />
          <button
            onClick={() => {
              if (!newKeyDescription.trim()) return;
              const key = `wp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 18)}`;
              const newKey = {
                id: crypto.randomUUID(),
                key,
                description: newKeyDescription.trim(),
                createdAt: new Date().toISOString(),
                lastUsed: null as string | null,
              };
              const updated = [...apiKeys, newKey];
              setApiKeys(updated);
              localStorage.setItem('werkpilot-api-keys', JSON.stringify(updated));
              setNewKeyDescription('');
              setRevealedKey(key);
              toast('API-Schluessel erstellt', 'success');
            }}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--purple), color-mix(in srgb, var(--purple) 70%, var(--blue)))',
              color: '#fff',
              border: 'none',
              cursor: newKeyDescription.trim() ? 'pointer' : 'not-allowed',
              opacity: newKeyDescription.trim() ? 1 : 0.5,
              fontFamily: 'var(--font-mono)',
            }}
          >
            Generieren
          </button>
        </div>

        {/* Revealed key notice */}
        {revealedKey && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.2)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Shield size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold" style={{ color: 'var(--green)', marginBottom: 4 }}>
                Neuer Schluessel erstellt - jetzt kopieren!
              </p>
              <code
                className="text-xs block truncate"
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text)',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  padding: '4px 8px',
                  borderRadius: 6,
                }}
              >
                {revealedKey}
              </code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(revealedKey);
                toast('Schluessel kopiert', 'success');
                setRevealedKey(null);
              }}
              className="text-xs px-3 py-1.5 rounded-lg font-bold shrink-0"
              style={{
                backgroundColor: 'rgba(34,197,94,0.1)',
                color: 'var(--green)',
                border: '1px solid rgba(34,197,94,0.2)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Kopieren
            </button>
          </div>
        )}

        {/* Key list */}
        {apiKeys.length === 0 ? (
          <div
            className="text-center py-10"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}
          >
            <Lock size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p className="text-sm">Noch keine API-Schluessel erstellt</p>
          </div>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div
                key={k.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                }}
              >
                <Lock size={14} style={{ color: 'var(--purple)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-semibold truncate"
                    style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {k.description}
                  </p>
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                  >
                    wp_****{k.key.slice(-4)}
                    <span style={{ marginLeft: 8 }}>
                      Erstellt: {new Date(k.createdAt).toLocaleDateString('de-CH')}
                    </span>
                    {k.lastUsed && (
                      <span style={{ marginLeft: 8 }}>
                        Zuletzt: {new Date(k.lastUsed).toLocaleDateString('de-CH')}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const updated = apiKeys.filter((x) => x.id !== k.id);
                    setApiKeys(updated);
                    localStorage.setItem('werkpilot-api-keys', JSON.stringify(updated));
                    toast('Schluessel widerrufen', 'success');
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all"
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.08)',
                    color: 'var(--red)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Widerrufen
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
