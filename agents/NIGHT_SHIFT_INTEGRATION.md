# Night Shift Integration - Complete Setup Guide

## Overview

End-to-end integration between the Werkpilot agent system and dashboard for automated overnight task execution and CEO morning briefings.

**Created:** 2026-02-14
**Status:** Ready for deployment

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Dashboard (Next.js)                     │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ /api/nightshift│  │  /api/reports   │  │  /api/sync   │ │
│  │  (CRUD tasks)  │  │ (KPIs, agents)  │  │ (real-time)  │ │
│  └────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                    ▲                    ▲
                    │                    │
         HTTP       │                    │      HTTP
      (fetch/patch) │                    │   (fetch)
                    │                    │
┌───────────────────┴────────────────────┴───────────────────┐
│                      Agent System                          │
│  ┌─────────────────────┐       ┌──────────────────────┐   │
│  │ night-shift-runner  │       │ morning-briefing-v2  │   │
│  │  - Fetches tasks    │       │  - Pulls KPI data    │   │
│  │  - Dispatches work  │       │  - Generates report  │   │
│  │  - Updates status   │       │  - Emails CEO        │   │
│  └─────────────────────┘       └──────────────────────┘   │
│            │                                               │
│            ▼                                               │
│  ┌──────────────────────────────────────────────┐         │
│  │        Task Dispatcher (Router)               │         │
│  │  - scrape          → scraper handler          │         │
│  │  - seo-analysis    → SEO optimizer            │         │
│  │  - follow-up       → follow-up agent          │         │
│  │  - pipeline-update → pipeline manager         │         │
│  │  - content-generate → content engine          │         │
│  │  - security-scan   → systems health check     │         │
│  │  - agent-optimize  → AI optimization          │         │
│  └──────────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────────┘
```

---

## Files Created

### 1. `/agents/shared/utils/task-dispatcher.js` (5.8 KB)
**Purpose:** Central task routing registry

**Features:**
- Handler registration for task types
- Execution with error wrapping
- Metrics tracking (success rate, duration, tokens)
- Normalized result format

**API:**
```javascript
const dispatcher = require('./shared/utils/task-dispatcher');

// Register a handler
dispatcher.registerHandler('my-task-type', async (data, task) => {
  // Execute task logic
  return { success: true, output: result, tokensUsed: 500 };
});

// Dispatch a task
const result = await dispatcher.dispatch({
  id: 'task-123',
  type: 'my-task-type',
  data: { url: 'https://example.com' }
});

// Get metrics
const metrics = dispatcher.getMetrics();
// { totalExecuted, totalSuccess, totalFailed, successRate, avgDurationMs, totalTokensUsed }
```

### 2. `/agents/night-shift-runner.js` (15 KB)
**Purpose:** Main overnight task execution engine

**Features:**
- Fetches pending tasks from `/api/nightshift?status=pending`
- Dispatches tasks to appropriate agent handlers
- Updates task status via `PATCH /api/nightshift`
- Tracks duration and token usage per task
- Graceful error handling (continues on failure)
- Concurrent execution with configurable limit (default: 3)
- Sends completion summary to dashboard

**Usage:**
```bash
# Run once (process all pending tasks)
node night-shift-runner.js

# Continuous mode (poll every 30s)
node night-shift-runner.js --continuous

# Dry run (preview without executing)
node night-shift-runner.js --dry-run
```

**Task Types Supported:**
- `scrape` - Web scraping (placeholder)
- `seo-analysis` - On-page SEO analysis
- `follow-up` - Send follow-up email to lead
- `pipeline-update` - Update sales pipeline stages
- `content-generate` - Generate blog article
- `security-scan` - System health check
- `agent-optimize` - AI cost optimization

**Environment Variables:**
```env
DASHBOARD_URL=http://localhost:3002  # Dashboard API base URL
```

### 3. `/agents/ceo/morning-briefing-v2.js` (20 KB)
**Purpose:** Enhanced CEO morning briefing with dashboard integration

**Features:**
- Pulls real-time data from `/api/reports`
- Calculates KPI changes vs. previous day
- Includes night shift task summary
- Agent health by department
- Pipeline velocity and top leads
- Recent activities timeline
- Generates briefing via Claude Opus
- Sends HTML email to CEO
- Syncs to dashboard as notification

**Usage:**
```bash
# Generate immediately
node ceo/morning-briefing-v2.js --now

# Run on schedule (6:30 AM CET daily)
node ceo/morning-briefing-v2.js
```

**Briefing Sections:**
1. Executive Summary (3-5 bullet points)
2. Night Shift Report (tasks completed/failed)
3. KPI Snapshot (MRR, leads, conversion, pipeline value)
4. Agent Health (by department with status emojis)
5. Pipeline Highlights (top leads, conversion trends)
6. Urgent Decisions (pending items from dashboard)
7. Today's Priorities (3-5 action items)
8. Strategic Recommendations (data-driven insights)

**Output:**
- Markdown file: `/agents/ceo/briefings/{date}-v2.md`
- HTML email to CEO
- Dashboard notification
- KPI snapshot saved for next comparison

---

## Dashboard API Integration

### Required Endpoints

#### 1. `/api/nightshift` (GET)
**Purpose:** Fetch pending tasks

**Query Parameters:**
- `status` - Filter by status (pending, running, done, failed)
- `priority` - Filter by priority (1-5)

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-123",
      "task": "seo-analysis",
      "priority": 2,
      "status": "pending",
      "data": "{\"url\":\"https://werkpilot.ch\"}",
      "createdAt": "2026-02-14T02:00:00Z"
    }
  ],
  "stats": {
    "total": 50,
    "completed": 45,
    "failed": 2,
    "avgDuration": 1234,
    "successRate": 95.74
  }
}
```

#### 2. `/api/nightshift` (POST)
**Purpose:** Create new task

**Body:**
```json
{
  "task": "seo-analysis",
  "priority": 2,
  "data": { "url": "https://werkpilot.ch" }
}
```

**Response:**
```json
{
  "id": "task-124",
  "task": "seo-analysis",
  "priority": 2,
  "status": "pending",
  "createdAt": "2026-02-14T03:00:00Z"
}
```

#### 3. `/api/nightshift` (PATCH)
**Purpose:** Update task status

**Body:**
```json
{
  "id": "task-123",
  "status": "done",
  "output": "{\"success\":true,\"recommendations\":5}"
}
```

**Status Flow:**
```
pending → running → done/failed
```

#### 4. `/api/reports` (GET)
**Purpose:** Comprehensive KPI and analytics report

**Response:** (see existing implementation)
```json
{
  "generatedAt": "2026-02-14T06:30:00Z",
  "kpis": {
    "mrr": 24000,
    "totalLeads": 150,
    "activeClients": 12,
    "wonDeals": 8,
    "totalRevenue": 96000,
    "avgDealSize": 12000,
    "conversionRate": 5.33,
    "pipelineValue": 180000,
    "pipelineVelocity": 21.5
  },
  "pipeline": {
    "stages": [...],
    "totalInPipeline": 42
  },
  "agentHealth": {
    "total": 45,
    "running": 5,
    "idle": 38,
    "errored": 2,
    "avgScore": 92,
    "totalTasks": 127,
    "totalErrors": 3,
    "healthPct": 95,
    "byDepartment": [...]
  },
  "nightShift": {
    "totalTasks": 8,
    "completed": 7,
    "failed": 1,
    "successRate": 87.5,
    "avgDuration": 2340
  },
  "topLeads": [...],
  "recentActivities": [...],
  "industryBreakdown": [...],
  "pendingDecisions": 3
}
```

#### 5. `/api/sync` (POST)
**Purpose:** Sync agent status, executions, notifications (existing)

**Body:**
```json
{
  "agents": [...],
  "executions": [...],
  "notifications": [
    {
      "title": "Night Shift Complete",
      "message": "7 tasks completed successfully",
      "type": "success",
      "timestamp": "2026-02-14T06:00:00Z"
    }
  ]
}
```

---

## Deployment Checklist

### 1. Prerequisites
- [ ] Dashboard running at `http://localhost:3002` (or set `DASHBOARD_URL`)
- [ ] Prisma database with `NightShiftTask` model
- [ ] Agent system dependencies installed (`npm install` in `/agents`)
- [ ] Environment variables configured (`.env` file)

### 2. Database Schema
Ensure Prisma schema includes:
```prisma
model NightShiftTask {
  id          String   @id @default(cuid())
  task        String   // Task type (e.g., "seo-analysis")
  priority    Int      @default(1)
  status      String   @default("pending") // pending, running, done, failed
  data        String?  // JSON string with task parameters
  output      String?  // JSON string with task results
  createdAt   DateTime @default(now())
  startedAt   DateTime?
  completedAt DateTime?
}
```

### 3. Initial Testing

**Test 1: Task Dispatcher**
```bash
cd /agents
node -e "
  const dispatcher = require('./shared/utils/task-dispatcher');
  dispatcher.registerHandler('test', async (data) => ({ success: true, output: 'OK' }));
  dispatcher.dispatch({ id: '1', type: 'test', data: {} })
    .then(r => console.log('✓ Dispatcher working:', r))
    .catch(e => console.error('✗ Error:', e));
"
```

**Test 2: Night Shift Runner (Dry Run)**
```bash
cd /agents
node night-shift-runner.js --dry-run
```

**Test 3: Morning Briefing v2**
```bash
cd /agents
node ceo/morning-briefing-v2.js --now
```

### 4. Schedule with Cron/PM2

**Option A: System Cron**
```cron
# Run night shift at 2 AM daily
0 2 * * * cd /path/to/agents && node night-shift-runner.js >> logs/night-shift.log 2>&1

# Generate morning briefing at 6:30 AM daily
30 6 * * * cd /path/to/agents && node ceo/morning-briefing-v2.js --now >> logs/briefing.log 2>&1
```

**Option B: PM2 Process Manager**
```json
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'night-shift-runner',
      script: './night-shift-runner.js',
      args: '--continuous',
      cwd: '/path/to/agents',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
        DASHBOARD_URL: 'http://localhost:3002'
      }
    }
  ]
};
```

Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Enable auto-restart on boot
```

---

## Creating Night Shift Tasks

### Via Dashboard UI
Add tasks through admin panel or API:

```javascript
// Example: Schedule SEO analysis
fetch('http://localhost:3002/api/nightshift', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: 'seo-analysis',
    priority: 2,
    data: { url: 'https://werkpilot.ch/blog' }
  })
});
```

### Programmatically from Agents
```javascript
const dashboardSync = require('./shared/utils/dashboard-sync');

// Create task
await dashboardSync.createNightShiftTask({
  title: 'Generate SEO report',
  description: 'Monthly SEO audit for werkpilot.ch',
  agentName: 'seo-optimizer',
  metadata: { url: 'https://werkpilot.ch' }
}, 'high');
```

### Bulk Task Creation
```javascript
const tasks = [
  { task: 'seo-analysis', priority: 2, data: { url: 'https://werkpilot.ch' } },
  { task: 'pipeline-update', priority: 1, data: {} },
  { task: 'content-generate', priority: 3, data: { topic: 'AI automation', type: 'blog' } }
];

for (const taskData of tasks) {
  await fetch('http://localhost:3002/api/nightshift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData)
  });
}
```

---

## Extending with New Task Types

### 1. Create Agent Handler
```javascript
// /agents/marketing/new-agent.js
async function executeMyTask(params) {
  // Task logic here
  return {
    success: true,
    data: { result: 'completed' }
  };
}

module.exports = { executeMyTask };
```

### 2. Register in Night Shift Runner
Edit `/agents/night-shift-runner.js`:

```javascript
// Add import
const { executeMyTask } = require('./marketing/new-agent');

// Register handler (in registerTaskHandlers function)
taskDispatcher.registerHandler('my-new-task', async (data) => {
  logger.info(`Executing my new task: ${data.param}`);

  const result = await executeMyTask(data);

  return {
    success: true,
    output: result,
    tokensUsed: 100,
  };
});
```

### 3. Create Tasks
```javascript
await fetch('http://localhost:3002/api/nightshift', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: 'my-new-task',
    priority: 2,
    data: { param: 'value' }
  })
});
```

---

## Monitoring & Troubleshooting

### Check Task Status
```bash
# View all tasks
curl http://localhost:3002/api/nightshift

# View pending tasks
curl http://localhost:3002/api/nightshift?status=pending

# View failed tasks
curl http://localhost:3002/api/nightshift?status=failed
```

### Logs
```bash
# Night shift runner logs
tail -f /agents/logs/night-shift-runner/combined.log

# Morning briefing logs
tail -f /agents/logs/ceo-morning-briefing-v2/combined.log

# Error logs
tail -f /agents/logs/*/error.log
```

### Common Issues

**Issue:** Tasks stuck in "pending"
- **Fix:** Check if night-shift-runner is running (`pm2 list` or `ps aux | grep night-shift`)

**Issue:** Morning briefing email not sent
- **Fix:** Verify `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env`

**Issue:** Dashboard API connection failed
- **Fix:** Verify `DASHBOARD_URL` is correct and dashboard is running

**Issue:** Task execution fails
- **Fix:** Check agent logs, ensure required dependencies are installed

---

## Performance Metrics

### Task Dispatcher Metrics
```javascript
const metrics = taskDispatcher.getMetrics();
console.log(metrics);
// {
//   totalExecuted: 127,
//   totalSuccess: 122,
//   totalFailed: 5,
//   successRate: 96.06,
//   avgDurationMs: 2340,
//   totalTokensUsed: 45600
// }
```

### Dashboard Sync Metrics
Available via `/api/reports`:
- Night shift success rate
- Average task duration
- Total tasks completed
- Token usage trends

---

## Future Enhancements

### Planned Features
- [ ] Task priorities with preemption
- [ ] Task dependencies (task B waits for task A)
- [ ] Scheduled recurring tasks (daily, weekly)
- [ ] Task retry logic with exponential backoff
- [ ] Real-time task progress websockets
- [ ] Task execution time predictions
- [ ] Resource usage optimization
- [ ] Multi-agent task orchestration
- [ ] Task result caching

### Integration Opportunities
- [ ] Slack notifications for task completion
- [ ] Grafana dashboards for metrics
- [ ] Prometheus metrics export
- [ ] Webhook triggers for external systems
- [ ] Task scheduling UI in dashboard

---

## Support & Documentation

**Files:**
- Task Dispatcher: `/agents/shared/utils/task-dispatcher.js`
- Night Shift Runner: `/agents/night-shift-runner.js`
- Morning Briefing v2: `/agents/ceo/morning-briefing-v2.js`

**Key Dependencies:**
- `node-cron` - Task scheduling
- `winston` - Logging
- `@anthropic-ai/sdk` - Claude API
- `nodemailer` - Email sending

**Environment Variables:**
```env
# Dashboard
DASHBOARD_URL=http://localhost:3002

# Email (for CEO briefing)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
CEO_EMAIL=ceo@werkpilot.ch

# AI
ANTHROPIC_API_KEY=sk-ant-...
DAILY_AI_BUDGET=50

# Airtable
AIRTABLE_API_KEY=key...
AIRTABLE_BASE_ID=app...
```

---

## License & Credits

**Created:** 2026-02-14
**Author:** Werkpilot AI Team
**License:** Proprietary

**Built with:**
- Node.js
- Claude Opus 4.6
- Next.js Dashboard
- Prisma ORM
