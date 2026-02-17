'use client';

import { useState } from 'react';
import {
  Eye,
  EyeOff,
  Save,
  Settings,
  Users,
  Bell,
  Key,
  Database,
  Globe,
  Moon,
  Sun,
  Clock,
  Zap,
  Mail,
  AlertTriangle,
  Trash2,
  Download,
  Server,
  RefreshCw,
} from 'lucide-react';

/* ================================================================== */
/*  TYPES                                                             */
/* ================================================================== */
type Tab = 'general' | 'agents' | 'notifications' | 'api' | 'database';

/* ================================================================== */
/*  INLINE STYLES                                                     */
/* ================================================================== */
const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
};

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
};

/* ================================================================== */
/*  TOGGLE COMPONENT                                                  */
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
/*  TEXT FIELD                                                        */
/* ================================================================== */
function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-xs font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
        style={{
          ...inputStyle,
          '--tw-ring-color': 'var(--amber)',
        } as React.CSSProperties}
      />
    </div>
  );
}

/* ================================================================== */
/*  SELECT FIELD                                                      */
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
      <label
        className="text-xs font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
        style={{
          ...inputStyle,
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
/*  SLIDER FIELD                                                      */
/* ================================================================== */
function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          className="text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </label>
        <span className="text-sm font-semibold" style={{ color: 'var(--amber)' }}>
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full outline-none"
        style={{
          background: `linear-gradient(to right, var(--amber) 0%, var(--amber) ${
            ((value - min) / (max - min)) * 100
          }%, var(--border) ${((value - min) / (max - min)) * 100}%, var(--border) 100%)`,
        }}
      />
    </div>
  );
}

/* ================================================================== */
/*  API KEY FIELD                                                     */
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
  const masked =
    value.length > 8
      ? `${value.slice(0, 3)}...${value.slice(-4)}`
      : value.length > 0
      ? '****'
      : '';

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-xs font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type={visible ? 'text' : 'password'}
          value={visible ? value : masked}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label}`}
          onFocus={() => {
            if (!visible) onToggleVisibility();
          }}
          className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
          style={{
            ...inputStyle,
            '--tw-ring-color': 'var(--amber)',
          } as React.CSSProperties}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="p-2 rounded-lg border transition-colors hover:bg-[var(--surface-hover)]"
          style={{
            backgroundColor: 'var(--bg)',
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
          aria-label={visible ? 'Hide' : 'Reveal'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  PRIMARY BUTTON                                                    */
/* ================================================================== */
function PrimaryButton({
  children,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
      style={{ backgroundColor: 'var(--amber)', color: '#000' }}
    >
      {icon}
      {children}
    </button>
  );
}

/* ================================================================== */
/*  SECONDARY BUTTON                                                  */
/* ================================================================== */
function SecondaryButton({
  children,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--surface-hover)]"
      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
    >
      {icon}
      {children}
    </button>
  );
}

/* ================================================================== */
/*  DANGER BUTTON                                                     */
/* ================================================================== */
function DangerButton({
  children,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
      style={{ backgroundColor: 'var(--red)', color: '#fff' }}
    >
      {icon}
      {children}
    </button>
  );
}

/* ================================================================== */
/*  SETTINGS PAGE                                                     */
/* ================================================================== */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [showToast, setShowToast] = useState(false);

  // General settings
  const [general, setGeneral] = useState({
    companyName: 'Werkpilot',
    timezone: 'Europe/Zurich',
    language: 'de',
    theme: 'dark',
  });

  // Agent settings
  const [agents, setAgents] = useState({
    dailyBudget: 50,
    defaultModel: 'sonnet',
    nightShiftStart: '23:00',
    nightShiftEnd: '06:00',
    autoRestart: true,
    maxRetries: 3,
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    ceoEmail: 'ceo@werkpilot.ch',
    alertErrorCount: 5,
    alertPipelineDropPercent: 20,
    slackWebhook: '',
  });

  // API keys
  const [apiKeys, setApiKeys] = useState({
    anthropic: 'sk-ant-abc123xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    airtable: 'pat1234567890abcdef',
    openai: 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  });
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({
    anthropic: false,
    airtable: false,
    openai: false,
  });

  // Database
  const [dbStats] = useState({
    totalLeads: 1247,
    totalAgents: 8,
    totalTasks: 342,
  });
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const toggleKeyVisibility = (key: string) =>
    setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }));

  const updateApiKey = (key: string, value: string) =>
    setApiKeys((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSeedDatabase = async () => {
    try {
      const response = await fetch('/api/seed', { method: 'POST' });
      if (response.ok) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (error) {
      console.error('Seed error:', error);
    }
  };

  const handleClearData = () => {
    setShowClearConfirm(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const tabs = [
    { id: 'general' as Tab, label: 'General', icon: Settings },
    { id: 'agents' as Tab, label: 'Agents', icon: Users },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    { id: 'api' as Tab, label: 'API', icon: Key },
    { id: 'database' as Tab, label: 'Database', icon: Database },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Settings
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Configure your Werkpilot dashboard preferences
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1.5 md:gap-2 p-1 rounded-xl border overflow-x-auto scrollbar-hide -mx-1 px-1"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap shrink-0 min-h-[44px]"
              style={{
                backgroundColor: isActive ? 'var(--amber)' : 'transparent',
                color: isActive ? '#000' : 'var(--text-secondary)',
              }}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="card-glass-premium p-4 md:p-6 space-y-5 md:space-y-6">
        {/* ======================== GENERAL TAB ======================== */}
        {activeTab === 'general' && (
          <>
            <div>
              <h2 className="text-lg font-bold mb-1" style={headingStyle}>
                General Settings
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Core configuration for your workspace
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <TextField
                label="Company Name"
                value={general.companyName}
                onChange={(v) => setGeneral({ ...general, companyName: v })}
                placeholder="Werkpilot"
              />
              <SelectField
                label="Timezone"
                value={general.timezone}
                onChange={(v) => setGeneral({ ...general, timezone: v })}
                options={[
                  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET)' },
                  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
                  { value: 'America/New_York', label: 'America/New York (EST)' },
                  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST)' },
                ]}
              />
              <SelectField
                label="Language"
                value={general.language}
                onChange={(v) => setGeneral({ ...general, language: v })}
                options={[
                  { value: 'de', label: 'Deutsch' },
                  { value: 'en', label: 'English' },
                  { value: 'fr', label: 'Français' },
                ]}
              />
            </div>

            <div className="flex items-center justify-between gap-3 p-3 md:p-4 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3 min-w-0">
                {general.theme === 'dark' ? <Moon size={20} className="shrink-0" /> : <Sun size={20} className="shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    Currently: {general.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </p>
                </div>
              </div>
              <Toggle
                checked={general.theme === 'dark'}
                onChange={(v) => setGeneral({ ...general, theme: v ? 'dark' : 'light' })}
              />
            </div>
          </>
        )}

        {/* ======================== AGENTS TAB ======================== */}
        {activeTab === 'agents' && (
          <>
            <div>
              <h2 className="text-lg font-bold mb-1" style={headingStyle}>
                Agent Configuration
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Control AI agent behavior and resource limits
              </p>
            </div>

            <SliderField
              label="Daily AI Budget"
              value={agents.dailyBudget}
              onChange={(v) => setAgents({ ...agents, dailyBudget: v })}
              min={10}
              max={200}
              unit=" CHF"
            />

            <SelectField
              label="Default Model"
              value={agents.defaultModel}
              onChange={(v) => setAgents({ ...agents, defaultModel: v })}
              options={[
                { value: 'haiku', label: 'Claude Haiku (Fast & Cheap)' },
                { value: 'sonnet', label: 'Claude Sonnet (Balanced)' },
                { value: 'opus', label: 'Claude Opus (Premium)' },
              ]}
            />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Night Shift Schedule
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <TextField
                  label="Start Time"
                  value={agents.nightShiftStart}
                  onChange={(v) => setAgents({ ...agents, nightShiftStart: v })}
                  type="time"
                />
                <TextField
                  label="End Time"
                  value={agents.nightShiftEnd}
                  onChange={(v) => setAgents({ ...agents, nightShiftEnd: v })}
                  type="time"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 md:p-4 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <RefreshCw size={20} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Auto-Restart Failed Tasks</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    Automatically retry failed agent tasks
                  </p>
                </div>
              </div>
              <Toggle
                checked={agents.autoRestart}
                onChange={(v) => setAgents({ ...agents, autoRestart: v })}
              />
            </div>

            <SliderField
              label="Max Retries per Task"
              value={agents.maxRetries}
              onChange={(v) => setAgents({ ...agents, maxRetries: v })}
              min={1}
              max={10}
            />
          </>
        )}

        {/* ===================== NOTIFICATIONS TAB ===================== */}
        {activeTab === 'notifications' && (
          <>
            <div>
              <h2 className="text-lg font-bold mb-1" style={headingStyle}>
                Notification Preferences
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Control how and when you receive alerts
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 p-3 md:p-4 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <Mail size={20} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    Receive important alerts via email
                  </p>
                </div>
              </div>
              <Toggle
                checked={notifications.emailNotifications}
                onChange={(v) =>
                  setNotifications({ ...notifications, emailNotifications: v })
                }
              />
            </div>

            <TextField
              label="CEO Email"
              value={notifications.ceoEmail}
              onChange={(v) => setNotifications({ ...notifications, ceoEmail: v })}
              type="email"
              placeholder="ceo@werkpilot.ch"
            />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Alert Thresholds
                </span>
              </div>
              <div className="space-y-4">
                <SliderField
                  label="Agent Error Count"
                  value={notifications.alertErrorCount}
                  onChange={(v) =>
                    setNotifications({ ...notifications, alertErrorCount: v })
                  }
                  min={1}
                  max={20}
                />
                <SliderField
                  label="Pipeline Drop Percentage"
                  value={notifications.alertPipelineDropPercent}
                  onChange={(v) =>
                    setNotifications({ ...notifications, alertPipelineDropPercent: v })
                  }
                  min={5}
                  max={50}
                  unit="%"
                />
              </div>
            </div>

            <TextField
              label="Slack Webhook URL (optional)"
              value={notifications.slackWebhook}
              onChange={(v) => setNotifications({ ...notifications, slackWebhook: v })}
              placeholder="https://hooks.slack.com/services/..."
            />
          </>
        )}

        {/* ======================== API TAB ======================== */}
        {activeTab === 'api' && (
          <>
            <div>
              <h2 className="text-lg font-bold mb-1" style={headingStyle}>
                API Configuration
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Manage API keys and integrations
              </p>
            </div>

            <div className="space-y-4">
              <ApiKeyField
                label="Anthropic API Key"
                value={apiKeys.anthropic}
                onChange={(v) => updateApiKey('anthropic', v)}
                visible={visibleKeys.anthropic}
                onToggleVisibility={() => toggleKeyVisibility('anthropic')}
              />
              <ApiKeyField
                label="Airtable API Key"
                value={apiKeys.airtable}
                onChange={(v) => updateApiKey('airtable', v)}
                visible={visibleKeys.airtable}
                onToggleVisibility={() => toggleKeyVisibility('airtable')}
              />
              <ApiKeyField
                label="OpenAI API Key (optional)"
                value={apiKeys.openai}
                onChange={(v) => updateApiKey('openai', v)}
                visible={visibleKeys.openai}
                onToggleVisibility={() => toggleKeyVisibility('openai')}
              />
            </div>

            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--surface-hover)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} style={{ color: 'var(--amber)' }} />
                <h3 className="text-sm font-semibold">Rate Limits</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mt-3">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Anthropic
                  </p>
                  <p className="text-xs md:text-sm font-semibold" style={{ color: 'var(--green)' }}>
                    4,000 / 5,000 RPM
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Airtable
                  </p>
                  <p className="text-xs md:text-sm font-semibold" style={{ color: 'var(--green)' }}>
                    12 / 15 RPS
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    OpenAI
                  </p>
                  <p className="text-xs md:text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Not configured
                  </p>
                </div>
              </div>
            </div>

            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--surface-hover)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Globe size={16} style={{ color: 'var(--blue)' }} />
                <h3 className="text-sm font-semibold">Webhooks</h3>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Configure webhook endpoints for external integrations
              </p>
              <SecondaryButton icon={<Settings size={14} />}>
                Manage Webhooks
              </SecondaryButton>
            </div>
          </>
        )}

        {/* ===================== DATABASE TAB ===================== */}
        {activeTab === 'database' && (
          <>
            <div>
              <h2 className="text-lg font-bold mb-1" style={headingStyle}>
                Database Management
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                View stats, seed data, and manage your database
              </p>
            </div>

            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--surface-hover)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Server size={16} style={{ color: 'var(--blue)' }} />
                <h3 className="text-sm font-semibold">Database Statistics</h3>
              </div>
              <div className="grid grid-cols-3 gap-3 md:gap-4">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Total Leads
                  </p>
                  <p className="text-xl md:text-2xl font-bold" style={{ color: 'var(--amber)' }}>
                    {dbStats.totalLeads.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Active Agents
                  </p>
                  <p className="text-xl md:text-2xl font-bold" style={{ color: 'var(--green)' }}>
                    {dbStats.totalAgents}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Pending Tasks
                  </p>
                  <p className="text-xl md:text-2xl font-bold" style={{ color: 'var(--blue)' }}>
                    {dbStats.totalTasks}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton
                onClick={handleSeedDatabase}
                icon={<Database size={14} />}
              >
                Seed Database
              </PrimaryButton>
              <SecondaryButton icon={<Download size={14} />}>
                Export Data
              </SecondaryButton>
            </div>

            {/* Danger Zone */}
            <div
              className="mt-4 p-3 md:p-4 rounded-lg border"
              style={{
                borderColor: 'var(--red)',
                backgroundColor: 'rgba(239,68,68,0.05)',
              }}
            >
              <h3
                className="text-xs font-bold uppercase tracking-wide mb-2"
                style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)' }}
              >
                Danger Zone
              </h3>
              <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                This action permanently deletes all data and cannot be undone.
              </p>

              {!showClearConfirm ? (
                <DangerButton
                  onClick={() => setShowClearConfirm(true)}
                  icon={<Trash2 size={14} />}
                >
                  Clear All Data
                </DangerButton>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <DangerButton
                    onClick={handleClearData}
                    icon={<Trash2 size={14} />}
                  >
                    Confirm Clear
                  </DangerButton>
                  <SecondaryButton onClick={() => setShowClearConfirm(false)}>
                    Cancel
                  </SecondaryButton>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Save Button (always visible) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <PrimaryButton onClick={handleSave} icon={<Save size={16} />}>
          Save All Settings
        </PrimaryButton>
        {showToast && (
          <span
            className="text-sm font-medium animate-fade-in"
            style={{ color: 'var(--green)' }}
          >
            Settings saved successfully
          </span>
        )}
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 p-4 rounded-lg border shadow-lg animate-slide-in-right"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--green)',
            zIndex: 1000,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--green)' }}
            />
            <p className="text-sm font-medium">Settings saved successfully!</p>
          </div>
        </div>
      )}
    </div>
  );
}
