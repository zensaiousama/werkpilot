// ---------------------------------------------------------------------------
// Dashboard constants – Werkpilot
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DEPARTMENTS – The 9 core departments
// ---------------------------------------------------------------------------

export const DEPARTMENTS = [
  { id: "geschaeftsleitung", name: "Geschäftsleitung", color: "#6366F1", icon: "crown" },
  { id: "vertrieb", name: "Vertrieb & Akquise", color: "#8B5CF6", icon: "target" },
  { id: "marketing", name: "Marketing & Kommunikation", color: "#EC4899", icon: "megaphone" },
  { id: "buchhaltung", name: "Buchhaltung & Finanzen", color: "#10B981", icon: "calculator" },
  { id: "personal", name: "Personal & HR", color: "#F59E0B", icon: "users" },
  { id: "kundenservice", name: "Kundenservice & Support", color: "#3B82F6", icon: "headphones" },
  { id: "projektmanagement", name: "Projektmanagement", color: "#EF4444", icon: "kanban" },
  { id: "einkauf", name: "Einkauf & Lieferanten", color: "#14B8A6", icon: "truck" },
  { id: "it", name: "IT & Digitalisierung", color: "#64748B", icon: "server" },
] as const;

export type DepartmentId = (typeof DEPARTMENTS)[number]["id"];

// Quick lookup map
export const DEPARTMENT_MAP = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.id, d]),
) as Record<DepartmentId, (typeof DEPARTMENTS)[number]>;

// ---------------------------------------------------------------------------
// LEAD_STATUSES – Pipeline stages
// ---------------------------------------------------------------------------

export const LEAD_STATUSES = [
  { id: "new", label: "Neu", color: "#3B82F6", order: 0 },
  { id: "contacted", label: "Kontaktiert", color: "#8B5CF6", order: 1 },
  { id: "qualified", label: "Qualifiziert", color: "#F59E0B", order: 2 },
  { id: "proposal", label: "Angebot", color: "#EC4899", order: 3 },
  { id: "negotiation", label: "Verhandlung", color: "#EF4444", order: 4 },
  { id: "won", label: "Gewonnen", color: "#10B981", order: 5 },
  { id: "lost", label: "Verloren", color: "#6B7280", order: 6 },
  { id: "archived", label: "Archiviert", color: "#9CA3AF", order: 7 },
] as const;

export type LeadStatusId = (typeof LEAD_STATUSES)[number]["id"];

export const LEAD_STATUS_MAP = Object.fromEntries(
  LEAD_STATUSES.map((s) => [s.id, s]),
) as Record<LeadStatusId, (typeof LEAD_STATUSES)[number]>;

// ---------------------------------------------------------------------------
// AGENT_STATUSES – AI agent operational states
// ---------------------------------------------------------------------------

export const AGENT_STATUSES = [
  { id: "running", label: "Aktiv", color: "#10B981", pulse: true },
  { id: "idle", label: "Bereit", color: "#3B82F6", pulse: false },
  { id: "paused", label: "Pausiert", color: "#F59E0B", pulse: false },
  { id: "error", label: "Fehler", color: "#EF4444", pulse: true },
  { id: "offline", label: "Offline", color: "#6B7280", pulse: false },
  { id: "deploying", label: "Wird deployed", color: "#8B5CF6", pulse: true },
  { id: "maintenance", label: "Wartung", color: "#F97316", pulse: false },
] as const;

export type AgentStatusId = (typeof AGENT_STATUSES)[number]["id"];

export const AGENT_STATUS_MAP = Object.fromEntries(
  AGENT_STATUSES.map((s) => [s.id, s]),
) as Record<AgentStatusId, (typeof AGENT_STATUSES)[number]>;

// ---------------------------------------------------------------------------
// PAGINATION – default page sizes
// ---------------------------------------------------------------------------

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
} as const;

// ---------------------------------------------------------------------------
// API_ENDPOINTS – all internal API route paths
// ---------------------------------------------------------------------------

export const API_ENDPOINTS = {
  // Leads
  LEADS: "/api/leads",
  LEAD_BY_ID: (id: string) => `/api/leads/${id}`,

  // Agents
  AGENTS: "/api/agents",
  AGENT_BY_ID: (id: string) => `/api/agents/${id}`,
  AGENT_LOGS: (id: string) => `/api/agents/${id}/logs`,
  AGENT_START: (id: string) => `/api/agents/${id}/start`,
  AGENT_STOP: (id: string) => `/api/agents/${id}/stop`,

  // Auth
  AUTH_LOGIN: "/api/auth/login",
  AUTH_LOGOUT: "/api/auth/logout",
  AUTH_ME: "/api/auth/me",

  // Webhooks
  WEBHOOKS: "/api/webhooks",
  WEBHOOK_BY_ID: (id: string) => `/api/webhooks/${id}`,
} as const;

// ---------------------------------------------------------------------------
// PIPELINE_STAGES – Backend pipeline stage names (used in Prisma queries)
// ---------------------------------------------------------------------------

export const PIPELINE_STAGES = [
  'New Lead', 'Researched', 'Fitness Check', 'Contacted',
  'Interested', 'Meeting', 'Proposal', 'Negotiation',
  'Won', 'Client', 'Lost',
] as const;

export const HOT_LEAD_STATUSES = ['Interested', 'Meeting', 'Proposal', 'Negotiation'] as const;

export const MRR_PER_CLIENT = 2000;

// ---------------------------------------------------------------------------
// CHART_COLORS – consistent color palette for charts and graphs
// ---------------------------------------------------------------------------

export const CHART_COLORS = {
  primary: [
    "#6366F1", // Indigo
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#3B82F6", // Blue
    "#10B981", // Emerald
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#14B8A6", // Teal
    "#F97316", // Orange
    "#64748B", // Slate
  ],
  positive: "#10B981",
  negative: "#EF4444",
  neutral: "#6B7280",
  warning: "#F59E0B",
  info: "#3B82F6",
  background: {
    light: "rgba(99, 102, 241, 0.1)",
    medium: "rgba(99, 102, 241, 0.2)",
    dark: "rgba(99, 102, 241, 0.4)",
  },
  gradient: {
    from: "#6366F1",
    to: "#8B5CF6",
  },
} as const;

// ---------------------------------------------------------------------------
// KEYBOARD_SHORTCUTS – all keyboard shortcuts in the dashboard
// ---------------------------------------------------------------------------

export const KEYBOARD_SHORTCUTS = [
  // Global navigation
  { keys: ["g", "h"], description: "Zur Startseite", scope: "global" },
  { keys: ["g", "l"], description: "Zu Leads", scope: "global" },
  { keys: ["g", "a"], description: "Zu Agenten", scope: "global" },
  { keys: ["g", "d"], description: "Zu Abteilungen", scope: "global" },
  { keys: ["g", "s"], description: "Zu Einstellungen", scope: "global" },

  // Actions
  { keys: ["Mod", "k"], description: "Suche öffnen", scope: "global" },
  { keys: ["Mod", "n"], description: "Neuer Lead", scope: "global" },
  { keys: ["Mod", "b"], description: "Sidebar umschalten", scope: "global" },
  { keys: ["?"], description: "Shortcuts anzeigen", scope: "global" },
  { keys: ["Escape"], description: "Dialog schliessen", scope: "global" },

  // Table / list navigation
  { keys: ["j"], description: "Nächster Eintrag", scope: "table" },
  { keys: ["k"], description: "Vorheriger Eintrag", scope: "table" },
  { keys: ["Enter"], description: "Eintrag öffnen", scope: "table" },
  { keys: ["x"], description: "Eintrag auswählen", scope: "table" },
  { keys: ["Mod", "a"], description: "Alle auswählen", scope: "table" },

  // Lead detail
  { keys: ["e"], description: "Lead bearbeiten", scope: "lead-detail" },
  { keys: ["d"], description: "Lead löschen", scope: "lead-detail" },
  { keys: ["s"], description: "Status ändern", scope: "lead-detail" },
  { keys: ["n"], description: "Notiz hinzufügen", scope: "lead-detail" },
] as const;

export type KeyboardShortcut = (typeof KEYBOARD_SHORTCUTS)[number];

// ---------------------------------------------------------------------------
// TOAST – notification duration defaults
// ---------------------------------------------------------------------------

export const TOAST_DURATION = {
  SUCCESS: 3_000,
  ERROR: 6_000,
  WARNING: 5_000,
  INFO: 4_000,
} as const;

// ---------------------------------------------------------------------------
// DATE_RANGES – preset analytics date ranges
// ---------------------------------------------------------------------------

export const DATE_RANGES = [
  { id: "today", label: "Heute", days: 0 },
  { id: "7d", label: "Letzte 7 Tage", days: 7 },
  { id: "30d", label: "Letzte 30 Tage", days: 30 },
  { id: "90d", label: "Letzte 90 Tage", days: 90 },
  { id: "ytd", label: "Dieses Jahr", days: -1 },
  { id: "all", label: "Gesamtzeitraum", days: -2 },
] as const;
