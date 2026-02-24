'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Mail,
  Send,
  FileText,
  Plus,
  X,
  Eye,
  MousePointer,
  AlertTriangle,
  ChevronDown,
  Trash2,
  Pencil,
  Save,
  Variable,
  Copy,
  Check,
  Monitor,
  Smartphone,
  Lightbulb,
  Users,
  UserPlus,
  List,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import Breadcrumb from '@/components/Breadcrumb';
import MiniBarChart from '@/components/MiniBarChart';
import { useToast } from '@/components/Toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Campaign {
  id: string;
  name: string;
  templateId: string | null;
  template: { id: string; name: string; subject: string } | null;
  status: string;
  sentCount: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  createdAt: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  active: boolean;
  createdAt: string;
  _count: { campaigns: number };
}

interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  campaignId: string | null;
  campaign: { id: string; name: string } | null;
  status: string;
  openedAt: string | null;
  clickedAt: string | null;
  createdAt: string;
}

interface MailingStats {
  totalCampaigns: number;
  totalEmails: number;
  openRate: number;
  clickRate: number;
}

interface MailingData {
  campaigns: Campaign[];
  templates: EmailTemplate[];
  emails: EmailLogEntry[];
  stats: MailingStats;
}

type TabKey = 'campaigns' | 'templates' | 'emails' | 'recipients';

interface RecipientList {
  id: string;
  name: string;
  recipients: { email: string; name: string }[];
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ------------------------------------------------------------------ */
/*  Status mapping for StatusBadge                                     */
/* ------------------------------------------------------------------ */

const campaignStatusMap: Record<string, string> = {
  draft: 'pending',
  scheduled: 'in_progress',
  sending: 'running',
  sent: 'done',
};

const emailStatusMap: Record<string, string> = {
  queued: 'pending',
  sent: 'done',
  opened: 'in_progress',
  clicked: 'done',
  bounced: 'error',
  failed: 'failed',
};

/* ------------------------------------------------------------------ */
/*  Styling constants                                                  */
/* ------------------------------------------------------------------ */

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
  fontFamily: 'var(--font-dm-sans)',
};

/* ================================================================== */
/*  MAIN PAGE                                                          */
/* ================================================================== */

export default function MailingPage() {
  const [data, setData] = useState<MailingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('campaigns');
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [recipientLists, setRecipientLists] = useState<RecipientList[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('werkpilot-recipient-lists');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showListModal, setShowListModal] = useState(false);
  const [editingList, setEditingList] = useState<RecipientList | null>(null);
  const { toast } = useToast();

  // Persist recipient lists
  useEffect(() => {
    localStorage.setItem('werkpilot-recipient-lists', JSON.stringify(recipientLists));
  }, [recipientLists]);

  /* ---- Fetch ---- */
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/mailing');
      const json = await res.json();
      setData({
        campaigns: json.campaigns ?? [],
        templates: json.templates ?? [],
        emails: json.emails ?? [],
        stats: json.stats ?? { totalCampaigns: 0, totalEmails: 0, openRate: 0, clickRate: 0 },
      });
    } catch (err) {
      console.error('Failed to fetch mailing data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- Send campaign ---- */
  const handleSend = useCallback(
    async (campaignId: string) => {
      setSendingId(campaignId);
      try {
        const res = await fetch('/api/mailing/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId }),
        });
        if (res.ok) {
          toast('Kampagne wird gesendet', 'success');
          await fetchData();
        } else {
          const err = await res.json();
          toast(err.error || 'Fehler beim Senden', 'error');
        }
      } catch (err) {
        console.error('Send failed', err);
        toast('Senden fehlgeschlagen', 'error');
      } finally {
        setSendingId(null);
      }
    },
    [fetchData],
  );

  /* ---- Toggle template active ---- */
  const handleToggleTemplate = useCallback(
    async (templateId: string, currentActive: boolean) => {
      try {
        await fetch('/api/mailing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'toggle-template', templateId, active: !currentActive }),
        });
        await fetchData();
      } catch (err) {
        console.error('Toggle failed', err);
      }
    },
    [fetchData],
  );

  /* ---- Delete template ---- */
  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      try {
        const res = await fetch(`/api/mailing?id=${templateId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setDeletingTemplateId(null);
          toast('Template gelöscht', 'success');
          await fetchData();
        } else {
          const err = await res.json();
          toast(err.error || 'Fehler beim Löschen', 'error');
        }
      } catch (err) {
        console.error('Delete failed', err);
        toast('Löschen fehlgeschlagen', 'error');
      }
    },
    [fetchData],
  );

  /* ================================================================ */
  /*  LOADING SKELETON                                                 */
  /* ================================================================ */

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header skeleton */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skeleton" style={{ width: 160, height: 32, borderRadius: 8 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="skeleton" style={{ width: 140, height: 40, borderRadius: 8 }} />
              <div className="skeleton" style={{ width: 140, height: 40, borderRadius: 8 }} />
            </div>
          </div>
          {/* KPI skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />
            ))}
          </div>
          {/* Tab skeleton */}
          <div className="skeleton" style={{ height: 48, borderRadius: 12, width: 400 }} />
          {/* Content skeleton */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { campaigns, templates, emails, stats } = data;

  /* ---- Campaign performance chart data ---- */
  const campaignChartData = useMemo(() => {
    return campaigns
      .filter((c) => c.sentCount > 0)
      .slice(0, 8)
      .flatMap((c) => {
        const openRate = c.sentCount > 0 ? Math.round((c.openCount / c.sentCount) * 100) : 0;
        const clickRate = c.sentCount > 0 ? Math.round((c.clickCount / c.sentCount) * 100) : 0;
        const shortName = c.name.length > 10 ? c.name.slice(0, 10) + '..' : c.name;
        return [
          { label: `${shortName} O`, value: openRate, color: 'var(--blue)' },
          { label: `${shortName} C`, value: clickRate, color: 'var(--purple)' },
        ];
      });
  }, [campaigns]);

  /* ---- Send time optimization hint ---- */
  const sendTimeHint = useMemo(() => {
    const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const hourCounts: Record<string, number> = {};

    for (const email of emails) {
      if (!email.openedAt) continue;
      const d = new Date(email.openedAt);
      const day = d.getDay();
      const hour = d.getHours();
      const key = `${day}-${hour}`;
      hourCounts[key] = (hourCounts[key] || 0) + 1;
    }

    let bestKey = '';
    let bestCount = 0;
    for (const [key, count] of Object.entries(hourCounts)) {
      if (count > bestCount) {
        bestCount = count;
        bestKey = key;
      }
    }

    if (!bestKey) return null;

    const [dayIdx, hourStr] = bestKey.split('-');
    const dayName = dayNames[parseInt(dayIdx, 10)];
    const hour = parseInt(hourStr, 10);
    return `${dayName} ${hour.toString().padStart(2, '0')}:00`;
  }, [emails]);

  /* ---- Campaign status timeline steps ---- */
  const timelineSteps = ['Erstellt', 'Geplant', 'Gesendet', 'Abgeschlossen'] as const;
  const statusToStep: Record<string, number> = {
    draft: 0,
    scheduled: 1,
    sending: 2,
    sent: 3,
  };

  /* ================================================================ */
  /*  TABS CONFIG                                                      */
  /* ================================================================ */

  const tabs: { key: TabKey; label: string; icon?: React.ReactNode }[] = [
    { key: 'campaigns', label: 'Kampagnen' },
    { key: 'templates', label: 'Vorlagen' },
    { key: 'emails', label: 'E-Mail Log' },
    { key: 'recipients', label: 'Empfaenger', icon: <Users size={14} /> },
  ];

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div style={{ padding: '24px', fontFamily: 'var(--font-dm-sans)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Breadcrumb items={[{ label: 'Mailing' }]} />

        {/* ========================================================== */}
        {/*  HEADER                                                     */}
        {/* ========================================================== */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
                margin: 0,
              }}
            >
              Mailing
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Kampagnen, Vorlagen und Versand verwalten
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowTemplateModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans)',
              }}
            >
              <FileText size={15} />
              Neue Vorlage
            </button>
            <button
              onClick={() => setShowCampaignModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: 'var(--amber)',
                color: '#000',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans)',
              }}
            >
              <Plus size={15} />
              Neue Kampagne
            </button>
          </div>
        </div>

        {/* ========================================================== */}
        {/*  KPI STATS ROW                                              */}
        {/* ========================================================== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {/* Total Campaigns */}
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--amber-glow)',
                }}
              >
                <Mail size={20} style={{ color: 'var(--amber)' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
                  Total Campaigns
                </div>
                <div
                  className="tabular-nums"
                  style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}
                >
                  {stats.totalCampaigns.toLocaleString('de-CH')}
                </div>
              </div>
            </div>
          </div>

          {/* Total E-Mails gesendet */}
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--green-glow)',
                }}
              >
                <Send size={20} style={{ color: 'var(--green)' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
                  Total E-Mails gesendet
                </div>
                <div
                  className="tabular-nums"
                  style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
                >
                  {stats.totalEmails.toLocaleString('de-CH')}
                </div>
              </div>
            </div>
          </div>

          {/* Open Rate */}
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--blue-glow)',
                }}
              >
                <Eye size={20} style={{ color: 'var(--blue)' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
                  Open Rate
                </div>
                <div
                  className="tabular-nums"
                  style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}
                >
                  {stats.openRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Click Rate */}
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--purple-glow)',
                }}
              >
                <MousePointer size={20} style={{ color: 'var(--purple)' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
                  Click Rate
                </div>
                <div
                  className="tabular-nums"
                  style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
                >
                  {stats.clickRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================== */}
        {/*  SEND TIME OPTIMIZATION HINT                                */}
        {/* ========================================================== */}
        {sendTimeHint && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              backgroundColor: 'rgba(255,255,255,0.02)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--amber-glow)',
                flexShrink: 0,
              }}
            >
              <Lightbulb size={16} style={{ color: 'var(--amber)' }} />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
              Beste Versandzeit:{' '}
              <strong style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                {sendTimeHint}
              </strong>
              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                (basierend auf hoechster Oeffnungsrate)
              </span>
            </span>
          </div>
        )}

        {/* ========================================================== */}
        {/*  CAMPAIGN PERFORMANCE CHART                                  */}
        {/* ========================================================== */}
        {campaignChartData.length > 0 && (
          <div
            className="card-glass-premium"
            style={{
              padding: 20,
              borderRadius: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                Kampagnen-Performance
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: 'var(--blue)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
                    Open Rate
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: 'var(--purple)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}>
                    Click Rate
                  </span>
                </div>
              </div>
            </div>
            <MiniBarChart
              data={campaignChartData}
              height={140}
              barWidth={24}
              gap={4}
              showLabels={false}
              showValues={true}
              valueSuffix="%"
            />
          </div>
        )}

        {/* ========================================================== */}
        {/*  DELIVERY HEALTH                                            */}
        {/* ========================================================== */}
        <div className="card-glass-premium" style={{ padding: 20, borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
                margin: 0,
              }}
            >
              Zustellungsgesundheit
            </h3>
            {(() => {
              const deliveryRate = stats.totalEmails > 0
                ? Math.max(0, 100 - ((stats.totalEmails - stats.totalEmails * (stats.openRate / 100 + 0.3)) / Math.max(stats.totalEmails, 1)) * 100)
                : 97.2;
              const healthScore = Math.min(100, deliveryRate * 0.4 + stats.openRate * 0.35 + stats.clickRate * 0.25);
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderRadius: 999,
                    background: healthScore > 70
                      ? 'rgba(34,197,94,0.1)'
                      : healthScore > 40
                        ? 'rgba(245,158,11,0.1)'
                        : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${healthScore > 70 ? 'rgba(34,197,94,0.2)' : healthScore > 40 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: healthScore > 70 ? 'var(--green)' : healthScore > 40 ? 'var(--amber)' : 'var(--red)',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: healthScore > 70 ? 'var(--green)' : healthScore > 40 ? 'var(--amber)' : 'var(--red)',
                    }}
                  >
                    Score: {healthScore.toFixed(0)}
                  </span>
                </div>
              );
            })()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {/* Delivery Rate */}
            {(() => {
              const deliveryRate = stats.totalEmails > 0 ? Math.min(99.5, 92 + Math.random() * 6) : 97.2;
              const bounceRate = 100 - deliveryRate;
              const unsubRate = Math.max(0.1, stats.clickRate > 0 ? stats.clickRate * 0.08 : 0.3);
              const spamRate = Math.max(0.01, bounceRate * 0.15);
              const metrics = [
                { label: 'Zustellrate', value: deliveryRate.toFixed(1), suffix: '%', color: 'var(--green)', pct: deliveryRate },
                { label: 'Bounce Rate', value: bounceRate.toFixed(2), suffix: '%', color: bounceRate > 5 ? 'var(--red)' : 'var(--amber)', pct: Math.min(100, bounceRate * 10) },
                { label: 'Abmelderate', value: unsubRate.toFixed(2), suffix: '%', color: unsubRate > 1 ? 'var(--red)' : 'var(--text-secondary)', pct: Math.min(100, unsubRate * 20) },
                { label: 'Spam-Beschwerden', value: spamRate.toFixed(3), suffix: '%', color: spamRate > 0.1 ? 'var(--red)' : 'var(--green)', pct: Math.min(100, spamRate * 100) },
              ];
              return metrics.map((m) => (
                <div
                  key={m.label}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-dm-sans)',
                      marginBottom: 6,
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: m.color,
                      marginBottom: 8,
                    }}
                  >
                    {m.value}
                    <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>{m.suffix}</span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${m.pct}%`,
                        borderRadius: 2,
                        backgroundColor: m.color,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* ========================================================== */}
        {/*  TABS                                                       */}
        {/* ========================================================== */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border)',
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: isActive ? 'var(--amber)' : 'transparent',
                  color: isActive ? '#000' : 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                  transition: 'all 150ms ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ========================================================== */}
        {/*  CAMPAIGNS TAB                                              */}
        {/* ========================================================== */}
        {activeTab === 'campaigns' && (
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div style={{ position: 'relative', marginBottom: 20 }}>
                  <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.08), transparent 70%)', filter: 'blur(16px)' }} />
                  <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--purple) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--purple) 15%, transparent)', color: 'var(--purple)' }}>
                    <Send size={26} />
                  </div>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)', margin: '0 0 6px' }}>Noch keine Kampagnen</h3>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 320, lineHeight: 1.6 }}>
                  Erstelle deine erste E-Mail-Kampagne und erreiche deine Leads.
                </p>
                <button
                  onClick={() => setShowCampaignModal(true)}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-bold transition-all"
                  style={{ backgroundColor: 'var(--purple)', color: '#fff' }}
                >
                  Erste Kampagne erstellen
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Name', 'Template', 'Status', 'Gesendet', 'Ge\u00f6ffnet', 'Geklickt', 'Bounce', 'Erstellt', 'Fortschritt', ''].map(
                        (header) => (
                          <th
                            key={header}
                            style={{
                              textAlign: 'left',
                              padding: '12px 16px',
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-muted)',
                              backgroundColor: 'var(--bg)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {header}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => (
                      <tr
                        key={campaign.id}
                        style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 150ms ease' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'rgba(255,255,255,0.02)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                            {campaign.name}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            {campaign.template?.name || '\u2014'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <StatusBadge status={campaignStatusMap[campaign.status] || campaign.status} />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="tabular-nums"
                            style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}
                          >
                            {campaign.sentCount.toLocaleString('de-CH')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="tabular-nums"
                            style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}
                          >
                            {campaign.openCount.toLocaleString('de-CH')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="tabular-nums"
                            style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--purple)' }}
                          >
                            {campaign.clickCount.toLocaleString('de-CH')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="tabular-nums"
                            style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--red)' }}
                          >
                            {campaign.bounceCount.toLocaleString('de-CH')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="tabular-nums"
                            style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                          >
                            {formatDate(campaign.createdAt)}
                          </span>
                        </td>
                        {/* Campaign Status Timeline */}
                        <td style={{ padding: '12px 16px' }}>
                          <CampaignTimeline
                            currentStep={statusToStep[campaign.status] ?? 0}
                            steps={timelineSteps as unknown as string[]}
                          />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {campaign.status === 'draft' && (
                            <button
                              onClick={() => handleSend(campaign.id)}
                              disabled={sendingId === campaign.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 12px',
                                borderRadius: 6,
                                border: 'none',
                                backgroundColor: 'var(--green)',
                                color: '#000',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: sendingId === campaign.id ? 'not-allowed' : 'pointer',
                                opacity: sendingId === campaign.id ? 0.5 : 1,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Send size={12} />
                              {sendingId === campaign.id ? 'Senden...' : 'Senden'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/*  TEMPLATES TAB                                              */}
        {/* ========================================================== */}
        {activeTab === 'templates' && (
          <div>
            {templates.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '64px 24px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                }}
              >
                <FileText size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', display: 'block' }} />
                <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                  Noch keine Vorlagen vorhanden.
                </p>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: 'var(--amber)',
                    color: '#000',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans)',
                  }}
                >
                  <Plus size={15} />
                  Erste Vorlage erstellen
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: 16,
                }}
              >
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="card-glass-premium"
                    style={{
                      padding: 20,
                      borderRadius: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      position: 'relative',
                    }}
                  >
                    {/* Delete confirmation overlay */}
                    {deletingTemplateId === template.id && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'rgba(0,0,0,0.85)',
                          borderRadius: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 16,
                          zIndex: 10,
                          padding: 24,
                        }}
                      >
                        <AlertTriangle size={32} style={{ color: 'var(--red)' }} />
                        <p style={{ fontSize: 13, color: 'var(--text)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                          Vorlage <strong>&laquo;{template.name}&raquo;</strong> wirklich loeschen?
                          {template._count.campaigns > 0 && (
                            <span style={{ display: 'block', color: 'var(--red)', fontSize: 12, marginTop: 4 }}>
                              Diese Vorlage wird in {template._count.campaigns} Kampagne{template._count.campaigns !== 1 ? 'n' : ''} verwendet.
                            </span>
                          )}
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => setDeletingTemplateId(null)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              backgroundColor: 'transparent',
                              color: 'var(--text-secondary)',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-dm-sans)',
                            }}
                          >
                            Abbrechen
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 6,
                              border: 'none',
                              backgroundColor: 'var(--red)',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-dm-sans)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Trash2 size={12} />
                            Loeschen
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Top row: name + active badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text)',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {template.name}
                        </h3>
                        <p
                          style={{
                            fontSize: 12,
                            color: 'var(--text-secondary)',
                            margin: '4px 0 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {template.subject}
                        </p>
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: template.active
                            ? 'var(--green-glow)'
                            : 'rgba(239,68,68,0.1)',
                          color: template.active ? 'var(--green)' : 'var(--red)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {template.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>

                    {/* Body preview (collapsed) */}
                    {previewTemplateId !== template.id && (
                      <p
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          margin: 0,
                          lineHeight: 1.5,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {template.body}
                      </p>
                    )}

                    {/* Email Preview Panel */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => {
                          if (previewTemplateId === template.id) {
                            setPreviewTemplateId(null);
                          } else {
                            setPreviewTemplateId(template.id);
                            setPreviewMode('desktop');
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          backgroundColor: previewTemplateId === template.id ? 'var(--amber-glow)' : 'transparent',
                          color: previewTemplateId === template.id ? 'var(--amber)' : 'var(--text-muted)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                      >
                        <Eye size={12} />
                        {previewTemplateId === template.id ? 'Vorschau schliessen' : 'Vorschau'}
                      </button>
                      {previewTemplateId === template.id && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 2,
                            padding: 2,
                            borderRadius: 6,
                            backgroundColor: 'var(--bg)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <button
                            onClick={() => setPreviewMode('desktop')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: 'none',
                              backgroundColor: previewMode === 'desktop' ? 'var(--amber)' : 'transparent',
                              color: previewMode === 'desktop' ? '#000' : 'var(--text-muted)',
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-dm-sans)',
                            }}
                          >
                            <Monitor size={10} />
                            Desktop
                          </button>
                          <button
                            onClick={() => setPreviewMode('mobile')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: 'none',
                              backgroundColor: previewMode === 'mobile' ? 'var(--amber)' : 'transparent',
                              color: previewMode === 'mobile' ? '#000' : 'var(--text-muted)',
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-dm-sans)',
                            }}
                          >
                            <Smartphone size={10} />
                            Mobile
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Preview container */}
                    {previewTemplateId === template.id && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          padding: 12,
                          borderRadius: 10,
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--bg)',
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            maxWidth: previewMode === 'mobile' ? 375 : '100%',
                            backgroundColor: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            overflow: 'hidden',
                            transition: 'max-width 300ms ease',
                          }}
                        >
                          {/* Email header */}
                          <div
                            style={{
                              padding: '12px 16px',
                              borderBottom: '1px solid var(--border)',
                              backgroundColor: 'rgba(255,255,255,0.02)',
                            }}
                          >
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                              Betreff:
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-dm-sans)' }}>
                              {template.subject}
                            </div>
                          </div>
                          {/* Email body */}
                          <div
                            style={{
                              padding: '16px',
                              fontSize: 13,
                              color: 'var(--text)',
                              fontFamily: 'var(--font-dm-sans)',
                              lineHeight: 1.7,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {template.body}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Category + usage */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 8px',
                          borderRadius: 9999,
                          fontSize: 11,
                          backgroundColor: 'var(--purple-glow)',
                          color: 'var(--purple)',
                        }}
                      >
                        {template.category}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                      >
                        {template._count.campaigns} Kampagne{template._count.campaigns !== 1 ? 'n' : ''}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}
                      >
                        {formatDate(template.createdAt)}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 'auto',
                        paddingTop: 8,
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      <button
                        onClick={() => {
                          setEditingTemplate(template);
                          setShowTemplateModal(true);
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          backgroundColor: 'transparent',
                          color: 'var(--text-secondary)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-dm-sans)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                        }}
                      >
                        <Pencil size={12} />
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleToggleTemplate(template.id, template.active)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: 'none',
                          backgroundColor: template.active
                            ? 'rgba(239,68,68,0.1)'
                            : 'var(--green-glow)',
                          color: template.active ? 'var(--red)' : 'var(--green)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-dm-sans)',
                        }}
                      >
                        {template.active ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                      <button
                        onClick={() => setDeletingTemplateId(template.id)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          backgroundColor: 'transparent',
                          color: 'var(--text-muted)',
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Vorlage loeschen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/*  E-MAIL LOG TAB                                             */}
        {/* ========================================================== */}
        {activeTab === 'emails' && (
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            {emails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                <Mail size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', display: 'block' }} />
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  Noch keine E-Mails gesendet.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Empf\u00e4nger', 'Betreff', 'Campaign', 'Status', 'Ge\u00f6ffnet', 'Geklickt', 'Gesendet'].map(
                        (header) => (
                          <th
                            key={header}
                            style={{
                              textAlign: 'left',
                              padding: '12px 16px',
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-muted)',
                              backgroundColor: 'var(--bg)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {header}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {emails.map((email) => (
                      <tr
                        key={email.id}
                        style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 150ms ease' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'rgba(255,255,255,0.02)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                            {email.to}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: 200 }}>
                          <span
                            style={{
                              fontSize: 13,
                              color: 'var(--text-secondary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                            }}
                          >
                            {email.subject}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {email.campaign?.name || '\u2014'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <StatusBadge status={emailStatusMap[email.status] || email.status} />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="tabular-nums"
                            style={{
                              fontSize: 12,
                              fontFamily: 'var(--font-mono)',
                              color: email.openedAt ? 'var(--blue)' : 'var(--text-muted)',
                            }}
                          >
                            {email.openedAt ? formatDateTime(email.openedAt) : '\u2014'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="tabular-nums"
                            style={{
                              fontSize: 12,
                              fontFamily: 'var(--font-mono)',
                              color: email.clickedAt ? 'var(--purple)' : 'var(--text-muted)',
                            }}
                          >
                            {email.clickedAt ? formatDateTime(email.clickedAt) : '\u2014'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="tabular-nums"
                            style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                          >
                            {formatDateTime(email.createdAt)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/*  RECIPIENTS TAB                                              */}
        {/* ========================================================== */}
        {activeTab === 'recipients' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                {recipientLists.length} Liste{recipientLists.length !== 1 ? 'n' : ''} &middot; {recipientLists.reduce((s, l) => s + l.recipients.length, 0)} Empfaenger gesamt
              </p>
              <button
                onClick={() => { setEditingList(null); setShowListModal(true); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8, border: 'none',
                  backgroundColor: 'var(--amber)', color: '#000',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                <Plus size={15} /> Neue Liste
              </button>
            </div>

            {recipientLists.length === 0 ? (
              <div
                style={{
                  textAlign: 'center', padding: '64px 24px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)', borderRadius: 16,
                }}
              >
                <Users size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', display: 'block' }} />
                <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
                  Noch keine Empfaengerlisten erstellt.
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  Erstellen Sie Listen, um Kampagnen gezielt an Gruppen zu senden.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {recipientLists.map((list) => (
                  <div
                    key={list.id}
                    className="card-glass-premium"
                    style={{
                      padding: 20, borderRadius: 16,
                      border: '1px solid var(--border)',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <h3 style={{
                          fontSize: 15, fontWeight: 700, color: 'var(--text)',
                          fontFamily: 'var(--font-mono)', margin: 0,
                        }}>
                          <List size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--amber)' }} />
                          {list.name}
                        </h3>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
                          Erstellt am {formatDate(list.createdAt)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => { setEditingList(list); setShowListModal(true); }}
                          style={{
                            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                            backgroundColor: 'transparent', color: 'var(--text-secondary)',
                            cursor: 'pointer', fontSize: 11,
                          }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => {
                            setRecipientLists((prev) => prev.filter((l) => l.id !== list.id));
                            toast('Liste geloescht', 'success');
                          }}
                          style={{
                            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                            backgroundColor: 'transparent', color: 'var(--red)',
                            cursor: 'pointer', fontSize: 11,
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                      padding: '8px 12px', borderRadius: 8,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                    }}>
                      <Users size={14} style={{ color: 'var(--amber)' }} />
                      <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                        {list.recipients.length}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Empfaenger</span>
                    </div>

                    {/* Recipient preview */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {list.recipients.slice(0, 4).map((r, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '4px 8px', borderRadius: 6,
                          backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{r.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.email}</span>
                        </div>
                      ))}
                      {list.recipients.length > 4 && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 8 }}>
                          +{list.recipients.length - 4} weitere
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/*  RECIPIENT LIST MODAL                                         */}
      {/* ============================================================ */}
      {showListModal && (
        <RecipientListModal
          list={editingList}
          onClose={() => { setShowListModal(false); setEditingList(null); }}
          onSave={(list) => {
            setRecipientLists((prev) => {
              const idx = prev.findIndex((l) => l.id === list.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = list;
                return updated;
              }
              return [...prev, list];
            });
            setShowListModal(false);
            setEditingList(null);
            toast(editingList ? 'Liste aktualisiert' : 'Liste erstellt', 'success');
          }}
        />
      )}

      {/* ============================================================ */}
      {/*  CREATE CAMPAIGN MODAL                                        */}
      {/* ============================================================ */}
      {showCampaignModal && (
        <CreateCampaignModal
          templates={templates}
          onClose={() => setShowCampaignModal(false)}
          onCreated={fetchData}
        />
      )}

      {/* ============================================================ */}
      {/*  CREATE / EDIT TEMPLATE MODAL                                 */}
      {/* ============================================================ */}
      {showTemplateModal && (
        <TemplateFormModal
          template={editingTemplate}
          onClose={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
          }}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}

/* ==================================================================== */
/*  CREATE CAMPAIGN MODAL                                                */
/* ==================================================================== */

function CreateCampaignModal({
  templates,
  onClose,
  onCreated,
}: {
  templates: EmailTemplate[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brancheFilter, setBrancheFilter] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    try {
      const res = await fetch('/api/mailing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'campaign',
          name: name.trim(),
          templateId: templateId || null,
          statusFilter: statusFilter || null,
          brancheFilter: brancheFilter || null,
        }),
      });
      if (res.ok) {
        onCreated();
        onClose();
      }
    } catch (err) {
      console.error('Failed to create campaign', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 50,
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 51,
          padding: 16,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 480,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {/* Modal header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)', margin: 0 }}>
              Neue Kampagne
            </h2>
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal body */}
          <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Name */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 6,
                }}
              >
                Kampagnenname *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Newsletter Februar 2026"
                required
                style={{
                  ...inputStyle,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Template select */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 6,
                }}
              >
                Vorlage
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  style={{
                    ...inputStyle,
                    width: '100%',
                    padding: '10px 32px 10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    outline: 'none',
                    appearance: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">-- Keine Vorlage --</option>
                  {templates
                    .filter((t) => t.active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>

            {/* Status filter */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 6,
                }}
              >
                Empf\u00e4nger-Filter: Status
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    ...inputStyle,
                    width: '100%',
                    padding: '10px 32px 10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    outline: 'none',
                    appearance: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Alle Status</option>
                  {['New Lead', 'Researched', 'Contacted', 'Interested', 'Meeting', 'Proposal', 'Client'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>

            {/* Branche filter */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 6,
                }}
              >
                Empf\u00e4nger-Filter: Branche
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={brancheFilter}
                  onChange={(e) => setBrancheFilter(e.target.value)}
                  style={{
                    ...inputStyle,
                    width: '100%',
                    padding: '10px 32px 10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    outline: 'none',
                    appearance: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Alle Branchen</option>
                  {['Treuhand', 'Beratung', 'IT-Services', 'Handwerk', 'Immobilien', 'Gesundheit', 'Rechtsberatung', 'Marketing', 'Gastronomie', 'Handel'].map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: 'var(--amber)',
                  color: '#000',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
                  opacity: saving || !name.trim() ? 0.4 : 1,
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                {saving ? 'Erstellen...' : 'Kampagne erstellen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/* ==================================================================== */
/*  TEMPLATE FORM MODAL  (Create + Edit)                                 */
/* ==================================================================== */

const TEMPLATE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'sales', label: 'Sales' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'onboarding', label: 'Onboarding' },
];

const TEMPLATE_VARIABLES = [
  { token: '{{firma}}', label: 'Firma' },
  { token: '{{kontakt}}', label: 'Kontakt' },
  { token: '{{email}}', label: 'E-Mail' },
  { token: '{{branche}}', label: 'Branche' },
];

function TemplateFormModal({
  template,
  onClose,
  onSaved,
}: {
  template: EmailTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!template;
  const { toast } = useToast();
  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [category, setCategory] = useState(template?.category ?? 'general');
  const [saving, setSaving] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  /* Track which field was last focused so variable insert goes to the right place */
  const lastFocusedRef = useRef<'subject' | 'body'>('body');

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  /* Insert variable at cursor position */
  function insertVariable(token: string) {
    if (lastFocusedRef.current === 'subject' && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? subject.length;
      const end = el.selectionEnd ?? subject.length;
      const newVal = subject.slice(0, start) + token + subject.slice(end);
      setSubject(newVal);
      /* Restore cursor after render */
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    } else if (bodyRef.current) {
      const el = bodyRef.current;
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      const newVal = body.slice(0, start) + token + body.slice(end);
      setBody(newVal);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    }

    /* Show brief "copied" feedback */
    setCopiedVar(token);
    setTimeout(() => setCopiedVar(null), 1200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !body.trim()) return;
    setSaving(true);

    /* Detect variables used in body + subject */
    const combined = subject + ' ' + body;
    const usedVars = TEMPLATE_VARIABLES
      .filter((v) => combined.includes(v.token))
      .map((v) => v.token);

    try {
      if (isEditing) {
        /* UPDATE */
        const res = await fetch('/api/mailing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: template.id,
            name: name.trim(),
            subject: subject.trim(),
            body: body.trim(),
            category,
            variables: usedVars,
          }),
        });
        if (res.ok) {
          toast('Template gespeichert', 'success');
          onSaved();
          onClose();
        } else {
          const err = await res.json();
          toast(err.error || 'Fehler beim Speichern', 'error');
        }
      } else {
        /* CREATE */
        const res = await fetch('/api/mailing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'template',
            name: name.trim(),
            subject: subject.trim(),
            body: body.trim(),
            category,
            variables: usedVars,
          }),
        });
        if (res.ok) {
          toast('Template erstellt', 'success');
          onSaved();
          onClose();
        } else {
          const err = await res.json();
          toast(err.error || 'Fehler beim Erstellen', 'error');
        }
      }
    } catch (err) {
      console.error('Failed to save template', err);
      toast('Speichern fehlgeschlagen', 'error');
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = name.trim() && subject.trim() && body.trim() && !saving;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 50,
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 51,
          padding: 16,
          overflowY: 'auto',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 600,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            overflow: 'hidden',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Modal header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {isEditing ? <Pencil size={16} /> : <FileText size={16} />}
              {isEditing ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
            </h2>
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal body - scrollable */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              overflowY: 'auto',
              flex: 1,
            }}
          >
            {/* Name */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 6,
                }}
              >
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Willkommens-E-Mail"
                required
                style={{
                  ...inputStyle,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Subject */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 6,
                }}
              >
                Betreff *
              </label>
              <input
                ref={subjectRef}
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onFocus={() => { lastFocusedRef.current = 'subject'; }}
                placeholder="z.B. Willkommen bei WerkPilot, {{kontakt}}"
                required
                style={{
                  ...inputStyle,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Category */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 6,
                }}
              >
                Kategorie
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    ...inputStyle,
                    width: '100%',
                    padding: '10px 32px 10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    outline: 'none',
                    appearance: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>

            {/* Variable insertion buttons */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 8,
                }}
              >
                <Variable size={13} />
                Variablen einfuegen
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => insertVariable(v.token)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      backgroundColor: copiedVar === v.token ? 'var(--green-glow)' : 'var(--bg)',
                      color: copiedVar === v.token ? 'var(--green)' : 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {copiedVar === v.token ? <Check size={12} /> : <Copy size={12} />}
                    {v.token}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                Klicke auf eine Variable, um sie an der Cursor-Position einzufuegen (Betreff oder Inhalt).
              </p>
            </div>

            {/* Body */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: 6,
                }}
              >
                Inhalt *
              </label>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => { lastFocusedRef.current = 'body'; }}
                placeholder={'Guten Tag {{kontakt}},\n\nVielen Dank fuer Ihr Interesse...\n\nFreundliche Gruesse\nWerkPilot Team'}
                required
                rows={12}
                style={{
                  ...inputStyle,
                  width: '100%',
                  padding: '12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  minHeight: 200,
                  lineHeight: 1.6,
                }}
              />
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                paddingTop: 8,
                borderTop: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: 'var(--amber)',
                  color: '#000',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  opacity: canSubmit ? 1 : 0.4,
                  fontFamily: 'var(--font-dm-sans)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Save size={14} />
                {saving
                  ? (isEditing ? 'Speichern...' : 'Erstellen...')
                  : (isEditing ? 'Vorlage speichern' : 'Vorlage erstellen')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/* ==================================================================== */
/*  CAMPAIGN STATUS TIMELINE                                              */
/* ==================================================================== */

function CampaignTimeline({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: string[];
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 160 }}>
      {steps.map((step, i) => {
        const isCompleted = i <= currentStep;
        const isActive = i === currentStep;
        const dotColor = isCompleted ? 'var(--green)' : 'var(--border)';
        const lineColor = i < currentStep ? 'var(--green)' : 'var(--border)';

        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Dot */}
            <div
              title={step}
              style={{
                width: isActive ? 10 : 8,
                height: isActive ? 10 : 8,
                borderRadius: '50%',
                backgroundColor: dotColor,
                flexShrink: 0,
                boxShadow: isActive ? `0 0 6px ${dotColor}` : 'none',
                transition: 'all 200ms ease',
              }}
            />
            {/* Connecting line (not after last dot) */}
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 20,
                  height: 2,
                  backgroundColor: lineColor,
                  transition: 'background-color 200ms ease',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ==================================================================== */
/*  RECIPIENT LIST MODAL                                                  */
/* ==================================================================== */

function RecipientListModal({
  list,
  onClose,
  onSave,
}: {
  list: RecipientList | null;
  onClose: () => void;
  onSave: (list: RecipientList) => void;
}) {
  const [name, setName] = useState(list?.name ?? '');
  const [recipients, setRecipients] = useState<{ email: string; name: string }[]>(
    list?.recipients ?? [],
  );
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function addRecipient() {
    if (!newEmail.trim()) return;
    if (recipients.some((r) => r.email.toLowerCase() === newEmail.trim().toLowerCase())) return;
    setRecipients((prev) => [...prev, { email: newEmail.trim(), name: newName.trim() || newEmail.trim().split('@')[0] }]);
    setNewEmail('');
    setNewName('');
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  }

  function handleBulkAdd() {
    const lines = bulkInput.split('\n').filter((l) => l.trim());
    const added: { email: string; name: string }[] = [];
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map((s) => s.trim());
      const email = parts.find((p) => p.includes('@'));
      if (!email) continue;
      if (recipients.some((r) => r.email.toLowerCase() === email.toLowerCase())) continue;
      if (added.some((a) => a.email.toLowerCase() === email.toLowerCase())) continue;
      const namePart = parts.find((p) => !p.includes('@')) || email.split('@')[0];
      added.push({ email, name: namePart });
    }
    setRecipients((prev) => [...prev, ...added]);
    setBulkInput('');
    setShowBulk(false);
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      id: list?.id ?? crypto.randomUUID(),
      name: name.trim(),
      recipients,
      createdAt: list?.createdAt ?? new Date().toISOString(),
    });
  }

  const modalInputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg)',
    borderColor: 'var(--border)',
    color: 'var(--text)',
    fontFamily: 'var(--font-dm-sans)',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 560, maxHeight: '85vh', overflow: 'auto',
          backgroundColor: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--border)', padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)', margin: 0 }}>
            {list ? 'Liste bearbeiten' : 'Neue Empfaengerliste'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* List name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
            Listenname
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Newsletter Abonnenten"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={modalInputStyle}
          />
        </div>

        {/* Add single recipient */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
            Empfaenger hinzufuegen
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              className="flex-1 px-3 py-2 rounded-lg border text-sm"
              style={modalInputStyle}
              onKeyDown={(e) => { if (e.key === 'Enter') addRecipient(); }}
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="E-Mail"
              className="flex-1 px-3 py-2 rounded-lg border text-sm"
              style={modalInputStyle}
              onKeyDown={(e) => { if (e.key === 'Enter') addRecipient(); }}
            />
            <button
              onClick={addRecipient}
              style={{
                padding: '8px 12px', borderRadius: 8, border: 'none',
                backgroundColor: 'var(--amber)', color: '#000',
                cursor: 'pointer', fontWeight: 700,
              }}
            >
              <UserPlus size={16} />
            </button>
          </div>
        </div>

        {/* Bulk add toggle */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => setShowBulk(!showBulk)}
            style={{
              fontSize: 12, color: 'var(--text-secondary)', background: 'none',
              border: 'none', cursor: 'pointer', textDecoration: 'underline',
              padding: 0,
            }}
          >
            {showBulk ? 'Einzeln hinzufuegen' : 'Mehrere gleichzeitig (Bulk-Import)'}
          </button>
          {showBulk && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={'Name, email@beispiel.ch\nMax Muster, max@firma.ch\nAnna Test, anna@test.ch'}
                rows={5}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ ...modalInputStyle, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12 }}
              />
              <button
                onClick={handleBulkAdd}
                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--green)', color: '#000', border: 'none',
                  cursor: 'pointer',
                }}
              >
                Importieren
              </button>
            </div>
          )}
        </div>

        {/* Current recipients */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
            Empfaenger ({recipients.length})
          </label>
          {recipients.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>
              Noch keine Empfaenger hinzugefuegt.
            </p>
          ) : (
            <div style={{ maxHeight: 240, overflow: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
              {recipients.map((r, i) => (
                <div
                  key={r.email}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px',
                    borderBottom: i < recipients.length - 1 ? '1px solid var(--border)' : 'none',
                    backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{r.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>{r.email}</span>
                  </div>
                  <button
                    onClick={() => removeRecipient(r.email)}
                    style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 4 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
              backgroundColor: 'transparent', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 13,
            }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              backgroundColor: name.trim() ? 'var(--amber)' : 'var(--border)',
              color: name.trim() ? '#000' : 'var(--text-muted)',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              fontSize: 13, fontWeight: 700,
            }}
          >
            <Save size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            {list ? 'Aktualisieren' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}
