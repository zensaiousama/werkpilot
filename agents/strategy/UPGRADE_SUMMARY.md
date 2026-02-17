# Strategy Department Agent Upgrades

## Overview

The strategy department agents have been significantly upgraded with advanced market intelligence, competitive tracking, and OKR management capabilities. All agents now integrate with the dashboard and provide enhanced reporting.

---

## 1. Market Analyst Agent (`market-analyst.js`)

**Status**: Upgraded ✅
**Schedule**: Quarterly reports (Q1, Q2, Q3, Q4) + Monthly data refresh

### New Features

#### TAM/SAM/SOM Calculation
- **Total Addressable Market (TAM)**: Calculates total Swiss KMU market potential
- **Serviceable Addressable Market (SAM)**: Identifies targetable segments
- **Serviceable Obtainable Market (SOM)**: Realistic market share targets for Y1, Y3, Y5
- Market size estimation by branche with growth potential scoring
- Detailed assumptions and methodology documentation

#### Market Growth Trend Tracking
- Quarterly growth rate analysis across all segments
- Seasonal pattern identification (strong/weak months)
- Trend classification: accelerating, growing, stable, declining
- Emerging opportunity detection
- Confidence-scored forecasts for next quarter and year

#### Competitive Positioning Matrix
- 2D positioning analysis (Price vs. Features/Sophistication)
- Werkpilot positioning relative to 10+ competitors
- Quadrant analysis with strategic implications
- Competitive advantages and differentiators identification
- White space opportunity mapping

#### Dashboard Integration
- Real-time market metrics sync to dashboard
- TAM/SAM/SOM values tracked over time
- Growth rate and trend indicators
- Top industry and market alerts

### Quarterly Report Contents

1. Executive Summary (3-5 key insights)
2. **Market Size & Opportunity** (TAM/SAM/SOM analysis)
3. **Market Growth Trends** (quarterly performance, forecasts)
4. Industry Analysis (top sectors, opportunities, threats)
5. Regional Analysis (canton-by-canton highlights)
6. **Competitive Positioning Matrix**
7. Digitalization & AI Trends
8. Demand Signals & Pipeline Health
9. Regulatory Updates
10. Strategic Recommendations (prioritized for next quarter)

### Outputs

- **Quarterly Reports**: `market-intelligence-Q{1-4}-{year}.md`
- **Data Files**: `market-intelligence-Q{1-4}-{year}-data.json`
- **Airtable**: MarketIntelligence table with TAM/SAM/SOM tracking
- **Dashboard**: Market metrics and notifications
- **Email**: CEO receives quarterly briefing

### CLI Commands

```bash
# Run quarterly analysis immediately
node market-analyst.js --now

# Run monthly data refresh
node market-analyst.js --monthly
```

---

## 2. Competitor Intelligence Agent (`competitor-intel.js`)

**Status**: Upgraded ✅
**Schedule**: Weekly scan (Tuesday 03:00) + Monthly report (1st at 06:00)

### New Features

#### Automated Price Benchmarking
- Tracks competitor pricing changes over time (12-month history)
- Detects price increases, decreases, new plans, removed plans
- Calculates percentage changes
- Historical pricing stored in `{competitor-id}-pricing-history.json`
- Alerts on significant pricing changes (>10% change)

#### Competitive SWOT Analysis (Using Claude)
- AI-powered SWOT analysis for each competitor
- Strengths, Weaknesses, Opportunities, Threats
- Overall threat level scoring (critical, high, medium, low)
- Competitive advantages and vulnerabilities identification
- Strategic response recommendations

#### Weekly Competitor Briefing
- Concise weekly summary of competitive activity
- Significant website/content/feature changes
- Pricing changes summary
- Recommended actions
- Watch list for next week

#### Enhanced Monitoring
- Website change detection (screenshots + content analysis)
- Feature comparison matrix auto-update
- Social media activity tracking (placeholder for expansion)
- Job posting monitoring (via content scraping)

#### Dashboard Integration
- Weekly scan summary notifications
- Threat level alerts (warning for elevated threats)
- Pricing change tracking
- Competitive activity metrics

### Weekly Briefing Contents

1. Executive Summary (2-3 bullets)
2. Significant Changes (website, content, features)
3. Pricing Changes
4. Recommended Actions
5. Watch List (items to monitor next week)

### Monthly Report Contents

1. Executive Summary
2. Competitive Landscape Overview
3. Competitor Activity Summary
4. Feature Comparison Matrix (as table)
5. Win/Loss Analysis
6. Competitive Threats Assessment
7. Opportunities Identified
8. Pricing Intelligence
9. Strategic Recommendations
10. Watch List

### Outputs

- **Weekly Briefings**: `competitor-weekly-{date}.md`
- **Monthly Reports**: `competitive-analysis-{date}.md`
- **Screenshots**: `{competitor-id}-{page-type}-{date}.png`
- **Scan Data**: `{competitor-id}-latest.json`
- **Pricing History**: `{competitor-id}-pricing-history.json`
- **Airtable**: CompetitorScans table with weekly metrics
- **Dashboard**: Competitive activity notifications
- **Email**: CEO receives weekly briefing + monthly report

### CLI Commands

```bash
# Run weekly scan immediately
node competitor-intel.js --scan

# Generate monthly report
node competitor-intel.js --report

# Run full cycle (scan + report)
node competitor-intel.js --now
```

---

## 3. OKR Tracker Agent (`okr-tracker.js`)

**Status**: Created ✅
**Schedule**: Weekly tracking (Monday 08:00) + Monthly review (1st at 10:00)

### Features

#### OKR Progress Calculation with Confidence Scoring
- AI-powered progress calculation using operational data
- Confidence scoring (high/medium/low) for each Key Result
- Trend analysis (on-track, at-risk, off-track)
- Data source attribution for transparency
- Blocker and risk identification

#### Automated Status Updates from Pipeline/Agent Data
- Pulls data from:
  - Pipeline (deals, revenue)
  - Customers (retention, growth)
  - Agent Executions (automation metrics)
  - Projects (delivery progress)
- Automatically calculates progress against targets
- Real-time updates every Monday

#### OKR Alignment Visualization
- Three-level hierarchy: Company → Department → Team
- Alignment score calculation (0-100%)
- Cascade analysis (company-to-department, department-to-team)
- Misalignment detection (orphaned, duplicate, conflicting OKRs)
- Visual graph data (nodes and edges for visualization)

#### Risk Flagging for At-Risk OKRs
- Automatic risk detection based on progress and confidence
- Critical risk alerts highlighted
- Blocker identification
- Recommended actions for each at-risk OKR

#### Weekly OKR Summary for CEO
- Concise, actionable weekly update
- Overall progress metrics
- At-risk OKRs with recommended actions
- Alignment health status
- This week's priorities
- Blockers & escalations

#### Historical OKR Completion Rate Tracking
- Quarterly completion data archival
- Trend analysis (improving, stable, declining)
- Average completion rate calculation
- Historical comparison across quarters

#### Dashboard Integration
- Weekly OKR status sync
- At-risk and off-track OKR alerts
- Alignment score tracking
- Progress notifications (success/warning based on status)

### Weekly Summary Contents

1. Executive Summary (3-4 key points)
2. Overall Progress (metrics table)
3. At-Risk OKRs (with recommended actions)
4. Alignment Health
5. This Week's Priorities
6. Blockers & Escalations

### Outputs

- **Weekly Summaries**: `okr-weekly-{date}.md`
- **OKR Data**: `okr-data.json` (company, department, team OKRs)
- **Airtable**: OKRTracking table with weekly metrics
- **Dashboard**: OKR status and alignment notifications
- **Email**: CEO receives weekly OKR summary

### CLI Commands

```bash
# Run weekly tracking immediately
node okr-tracker.js --now

# Run monthly review (with quarter-end archival)
node okr-tracker.js --monthly
```

### OKR Data Structure

```json
{
  "company": [
    {
      "id": "okr-001",
      "objective": "...",
      "owner": "CEO",
      "quarter": "Q1 2026",
      "keyResults": [
        {
          "kr": "...",
          "target": 100,
          "unit": "customers",
          "baseline": 15,
          "current": 28
        }
      ]
    }
  ],
  "departments": {
    "sales": [...],
    "marketing": [...],
    "product": [...],
    "strategy": [...]
  },
  "teams": {},
  "historical": [
    {
      "period": "Q1 2026",
      "totalOKRs": 10,
      "completed": 7,
      "archivedAt": "2026-04-01T00:00:00.000Z"
    }
  ]
}
```

---

## Shared Utilities Used

All upgraded agents leverage the following shared utilities:

- **`logger.js`**: Structured logging with agent context
- **`claude-client.js`**: AI-powered analysis and text/JSON generation
- **`email-client.js`**: CEO email notifications
- **`airtable-client.js`**: Data persistence and retrieval
- **`dashboard-sync.js`**: Real-time dashboard updates and notifications
- **`config.js`**: Centralized configuration and API keys

---

## Data Files Created

### Market Analyst
- `/strategy/market-data/swiss-kmu-stats.json` (market data by industry/canton)
- `/strategy/industry-reports/market-intelligence-Q{1-4}-{year}.md`
- `/strategy/industry-reports/market-intelligence-Q{1-4}-{year}-data.json`

### Competitor Intelligence
- `/strategy/competitors/competitor-list.json` (monitored competitors)
- `/strategy/competitors/{competitor-id}-latest.json` (latest scan)
- `/strategy/competitors/{competitor-id}-pricing-history.json` (pricing over time)
- `/strategy/screenshots/{competitor-id}-{page}-{date}.png`
- `/strategy/industry-reports/competitor-weekly-{date}.md`
- `/strategy/industry-reports/competitive-analysis-{date}.md`

### OKR Tracker
- `/strategy/okrs/okr-data.json` (company/dept/team OKRs + historical)
- `/strategy/industry-reports/okr-weekly-{date}.md`

---

## Integration with Dashboard

All three agents sync data to the dashboard via `dashboard-sync.js`:

### Market Analyst
- **Notifications**: Quarterly market intelligence updates
- **Metrics**: TAM/SAM/SOM, growth rate, top industry

### Competitor Intelligence
- **Notifications**: Weekly scan completion, threat level alerts
- **Metrics**: Competitors scanned, changes detected, pricing changes

### OKR Tracker
- **Notifications**: Weekly OKR status, at-risk alerts
- **Metrics**: Total OKRs, on-track/at-risk/off-track counts, alignment score

---

## Next Steps

1. **Populate Market Data**: Add `swiss-kmu-stats.json` with real Swiss KMU data
2. **Configure Competitors**: Update `competitor-list.json` with actual competitor URLs
3. **Define OKRs**: Populate `okr-data.json` with company/department/team OKRs
4. **Test Runs**:
   ```bash
   cd /Users/kaitoweingart/Downloads/werkpilot/agents/strategy
   node market-analyst.js --now
   node competitor-intel.js --scan
   node okr-tracker.js --now
   ```
5. **Schedule Agents**: Enable in agent registry and start cron schedules
6. **Monitor Dashboard**: Check dashboard for synced metrics and notifications

---

## Upgrade Summary

✅ **Market Analyst**: TAM/SAM/SOM + Growth Trends + Competitive Positioning
✅ **Competitor Intel**: Price Benchmarking + SWOT Analysis + Weekly Briefings
✅ **OKR Tracker**: Progress Calculation + Alignment Viz + Risk Flagging
✅ **Dashboard Sync**: All agents integrated with real-time updates
✅ **Sample Data**: OKR data and competitor list initialized

**All agents use existing patterns, shared utilities, and maintain code consistency with the rest of the codebase.**
