# WERKPILOT — PHASE 4: MANAGEMENT DASHBOARD + CRM (YOLO MODE)

## MISSION
Build a complete management dashboard on localhost with:
- Full CRM with automated Google Maps scraping
- All 43 AI agent monitoring
- Night Shift control panel
- Executive dashboard with live KPIs
- Pipeline management
- Automated contact fetching from Google

## SETUP
```
cd ~/Downloads/werkpilot
mkdir -p dashboard
cd dashboard
npx create-next-app@latest werkpilot-dashboard --typescript --tailwind --app --src-dir
cd werkpilot-dashboard
npm install @anthropic-ai/sdk puppeteer cheerio airtable nodemailer recharts lucide-react framer-motion zustand swr
npm install -D @types/node prisma
npx prisma init --datasource-provider sqlite
```

## DATABASE (SQLite via Prisma — zero config, runs locally)

### prisma/schema.prisma
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./werkpilot.db"
}

model Lead {
  id              String   @id @default(cuid())
  firma           String
  kontakt         String?
  email           String?
  telefon         String?
  website         String?
  adresse         String?
  branche         String
  kanton          String
  ort             String
  status          String   @default("New Lead")
  leadScore       Int      @default(0)
  fitnessScore    Int      @default(0)
  umsatzpotenzial Int      @default(2000)
  googleRating    Float?
  googleReviews   Int?
  notizen         String?
  quelle          String?
  letzterKontakt  DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  activities      Activity[]
}

model Activity {
  id        String   @id @default(cuid())
  leadId    String
  lead      Lead     @relation(fields: [leadId], references: [id])
  type      String   // email_sent, email_opened, call, meeting, note, status_change
  details   String?
  createdAt DateTime @default(now())
}

model Agent {
  id        String   @id @default(cuid())
  name      String
  dept      String
  status    String   @default("idle") // running, idle, error
  score     Int      @default(0)
  tasksToday Int     @default(0)
  errorsToday Int    @default(0)
  lastRun   DateTime?
  config    String?  // JSON config
  logs      AgentLog[]
}

model AgentLog {
  id        String   @id @default(cuid())
  agentId   String
  agent     Agent    @relation(fields: [agentId], references: [id])
  level     String   // info, warn, error
  message   String
  createdAt DateTime @default(now())
}

model NightShiftTask {
  id        String   @id @default(cuid())
  task      String
  priority  Int      @default(1)
  status    String   @default("pending") // pending, running, done, failed
  startedAt DateTime?
  completedAt DateTime?
  output    String?
  createdAt DateTime @default(now())
}

model Decision {
  id        String   @id @default(cuid())
  title     String
  context   String
  options   String   // JSON array of options
  recommendation String?
  chosen    String?
  status    String   @default("pending") // pending, decided, executed
  createdAt DateTime @default(now())
}
```

Then run: `npx prisma db push`

## API ROUTES

### 1. Google Maps Scraper API — `/api/scrape/route.ts`
```
Build a real Google Maps scraper that:
1. Accepts POST { query: "Treuhand Zürich", maxResults: 20 }
2. Uses Puppeteer to:
   - Open Google Maps
   - Search for the query
   - Scroll through results to load more
   - Extract for each result:
     - Business name
     - Address
     - Phone number
     - Website URL
     - Google rating + review count
     - Business category
     - Opening hours (if available)
3. Then for each result WITH a website:
   - Fetch the website homepage
   - Extract email from: Impressum page, footer, contact page
   - Look for: mailto: links, info@, kontakt@, office@ patterns
   - Extract the Impressum page URL (Swiss legal requirement = gold mine)
4. Returns JSON array of scraped businesses
5. Rate limiting: Max 1 scrape request per 10 seconds
6. Caching: Cache results for 24h per query
7. Error handling: If Google blocks, retry with different user agent

IMPORTANT: Use realistic delays between requests (2-5 seconds).
Use rotating user agents. Respect robots.txt where applicable.
```

### 2. Lead Import API — `/api/leads/route.ts`
```
Build CRUD API for leads:
- GET /api/leads — List all leads with filtering (status, branche, kanton, search)
- POST /api/leads — Create new lead (from scraper import or manual)
- PATCH /api/leads/[id] — Update lead (status change, notes, etc.)
- DELETE /api/leads/[id] — Delete lead
- POST /api/leads/bulk-import — Import multiple leads from scraper results
- GET /api/leads/stats — Pipeline stats, counts per status, revenue metrics
```

### 3. Digital Fitness Check API — `/api/fitness-check/route.ts`
```
Build an automated website analysis that:
1. Accepts POST { url: "www.example.ch" }
2. Uses Puppeteer + Lighthouse to analyze:
   - Performance score
   - SEO score (meta tags, headings, alt texts)
   - Mobile friendliness
   - SSL certificate
   - Page speed
   - Social media presence (checks for LinkedIn, Facebook links)
   - Blog presence (checks for /blog, /news, /aktuelles)
   - Google My Business presence
   - Multi-language support (checks for /de, /fr, /it, /en)
   - Contact form presence
   - Call-to-action clarity
3. Generates a fitness score 0-100
4. Stores result in lead record
5. Generates a PDF report using puppeteer (HTML template → PDF)
6. Returns the score + key findings

This is the "free lead magnet" — sends automatically with cold emails.
```

### 4. Agent Status API — `/api/agents/route.ts`
```
Build agent monitoring:
- GET /api/agents — All agent statuses with scores
- GET /api/agents/[id]/logs — Agent log entries
- POST /api/agents/[id]/trigger — Manually trigger an agent
- GET /api/agents/health — Overall system health summary
```

### 5. Night Shift API — `/api/nightshift/route.ts`
```
Build night shift management:
- GET /api/nightshift/tasks — Current task queue
- POST /api/nightshift/tasks — Add new task
- GET /api/nightshift/log — Last night's execution log
- POST /api/nightshift/start — Trigger night shift manually
- GET /api/nightshift/report — Morning report data
```

### 6. Analytics API — `/api/analytics/route.ts`
```
Build analytics endpoints:
- GET /api/analytics/dashboard — All dashboard KPIs
- GET /api/analytics/pipeline — Pipeline funnel data
- GET /api/analytics/revenue — Revenue over time (daily, weekly, monthly)
- GET /api/analytics/agents — Agent performance over time
- GET /api/analytics/leads — Lead acquisition over time
```

## FRONTEND PAGES

### Dashboard Layout (`/layout.tsx`)
- Dark theme (background: #0f1117)
- Sidebar with navigation: Dashboard, CRM, Lead Scraper, AI Agents, Night Shift, Analytics, Settings
- Werkpilot logo + system status indicator in sidebar
- Agent health dots (43 dots showing red/yellow/green) in sidebar footer
- Responsive: Sidebar collapses on mobile

### Page 1: Executive Dashboard (`/page.tsx`)
- KPI cards: MRR, Pipeline Value, Total Leads, Active Clients, Agent Health
- Sales Pipeline funnel visualization (10 stages with counts)
- Revenue chart (line chart, last 30 days) using Recharts
- Top performing agents list (sorted by score)
- Night shift summary (last night's tasks)
- Decision queue (pending decisions needing CEO input)
- Recent activity feed

### Page 2: CRM (`/crm/page.tsx`)
- Full lead table with sorting, filtering, search
- Filters: Status (multi-select), Branche, Kanton, Score range, Date range
- Click on lead → Detail panel slides in from right
- Lead detail: All info, activity timeline, fitness check results, actions
- Actions: Send fitness check, Send cold email, Change status, Add note, Schedule meeting
- Bulk actions: Select multiple → Change status, Export CSV, Send email sequence
- Pipeline Kanban view toggle (drag & drop between stages)
- Import button → Links to scraper

### Page 3: Lead Scraper (`/scraper/page.tsx`)
- Search bar: "Treuhand Zürich" style queries
- Quick-search buttons for common searches
- Results grid: Business name, address, phone, website, email, rating, reviews
- Import buttons: Import single or all
- Progress indicator during scraping
- History: Previous scrapes with results count
- Auto-email-extraction indicator (green check when email found)
- Scrape queue: Schedule multiple scrapes

### Page 4: AI Agents (`/agents/page.tsx`)
- Grid of 43 agent cards organized by department
- Each card: Name, department, status dot, score bar, tasks today, error count
- Click card → Agent detail: Full log, config, performance chart over time
- Department filter tabs
- System health overview at top
- Trigger buttons to manually run agents
- Agent-to-agent dependency visualization

### Page 5: Night Shift (`/nightshift/page.tsx`)
- CLAUDE.md editor (textarea with syntax highlighting)
- Task queue list (drag to reorder priority)
- Last night's log with timestamps
- KPIs: Tasks completed, tests passing, API cost, duration
- Schedule settings: Start time, max duration, budget limit
- Morning report preview
- Git commit log from night shift branch

### Page 6: Analytics (`/analytics/page.tsx`)
- Revenue charts: MRR growth, revenue by client, by industry
- Lead charts: Acquisition rate, conversion funnel, source analysis
- Agent charts: Performance over time, cost per task, efficiency
- Client charts: Retention, churn, LTV, NPS
- All charts interactive with Recharts

### Page 7: Settings (`/settings/page.tsx`)
- API keys management (masked display)
- Email configuration (SMTP settings)
- Agent configuration (enable/disable, schedules)
- Night shift settings (time, budget, branch name)
- Notification preferences
- Export/Import data

## DESIGN SYSTEM

### Colors (Tailwind config)
```
Dark background: #0f1117
Surface: #1a1c28
Surface hover: #1e2030
Border: #2a2d3a
Text primary: #e2e2e2
Text secondary: #888888
Text muted: #555555
Amber (primary accent): #f59e0b
Green (success): #22c55e
Blue (info): #60a5fa
Purple (night shift): #6B3FA0
Red (error): #ef4444
Orange (warning): #f97316
```

### Typography
- Headings: JetBrains Mono (bold, tight)
- Body: DM Sans
- Data/Numbers: JetBrains Mono
- Load via next/font/google

### Components to Build
- KPICard (label, value, trend, color)
- StatusBadge (status → color mapping)
- AgentCard (name, dept, status, score, tasks, errors)
- LeadRow (all lead fields, click to expand)
- LeadDetail (full info, actions, activity timeline)
- PipelineFunnel (10 stages, counts, visual bars)
- Chart wrappers for Recharts (LineChart, BarChart, PieChart)
- DataTable (sortable, filterable, searchable, selectable)
- ScrapeResultCard (business info, import button)
- NightShiftLogEntry (timestamp, task, status)
- DecisionCard (title, options A/B/C, recommendation)

## EXECUTION ORDER
1. Set up project + Prisma schema + database
2. Build all API routes
3. Build layout + sidebar navigation
4. Build Dashboard page
5. Build CRM page with full CRUD
6. Build Lead Scraper with real Google Maps scraping
7. Build AI Agents monitoring page
8. Build Night Shift control panel
9. Build Analytics page with charts
10. Build Settings page
11. Seed database with 100 sample leads
12. Test all pages, fix any issues
13. `npm run dev` should start the complete dashboard on localhost:3000

## CRITICAL REQUIREMENTS
- Everything must work on `npm run dev` (localhost:3000)
- Real Google Maps scraping (not mocked)
- SQLite database (zero external dependencies)
- All data persists between sessions
- Responsive on all screen sizes
- Dark theme throughout
- Fast — no unnecessary re-renders
- Error boundaries on every page

START NOW. Build everything. Do not ask for confirmation. Commit after each page.
