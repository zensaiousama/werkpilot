# Strategy Department Agents

This directory contains AI agents responsible for strategic planning, market intelligence, competitive analysis, and OKR tracking for Werkpilot.

## Agents Overview

### 1. Market Analyst (`market-analyst.js`)
**Schedule**: Quarterly (1st of Jan/Apr/Jul/Oct at 04:00) + Monthly refresh (1st at 05:00)

Analyzes the Swiss KMU market with advanced capabilities:
- TAM/SAM/SOM calculation for market sizing
- Market growth trend tracking
- Competitive positioning matrix
- Industry and regional analysis
- Dashboard synchronization

**Outputs**: Quarterly market intelligence reports, market metrics tracking

### 2. Competitor Intelligence (`competitor-intel.js`)
**Schedule**: Weekly (Tuesday at 03:00) + Monthly report (1st at 06:00)

Monitors 10+ competitors with automated tracking:
- Website change detection (screenshots + content)
- Price benchmarking over time
- SWOT analysis using Claude
- Feature comparison matrix
- Weekly competitive briefings

**Outputs**: Weekly briefings, monthly competitive reports, pricing history

### 3. OKR Tracker (`okr-tracker.js`)
**Schedule**: Weekly (Monday at 08:00) + Monthly review (1st at 10:00)

Tracks organizational OKRs with intelligent progress calculation:
- AI-powered progress calculation from operational data
- Confidence scoring and risk flagging
- OKR alignment visualization (company → dept → team)
- Historical completion rate tracking
- Weekly CEO summaries

**Outputs**: Weekly OKR summaries, alignment reports, historical tracking

### 4. Market Expansion (`market-expansion.js`)
**Schedule**: Quarterly (1st of Jan/Apr/Jul/Oct at 05:00)

Analyzes new market opportunities in DACH, BeNeLux, and France with TAM/SAM/SOM sizing and GTM proposals.

### 5. M&A Analysis (`ma-analysis.js`)
**Schedule**: Weekly (Monday at 06:00)

Performs due diligence, DCF valuation, integration planning, and risk assessment for M&A targets.

### 6. BizDev (`bizdev.js`)
**Schedule**: Bi-weekly (1st and 15th at 07:00)

Evaluates business models, revenue modeling, partnership opportunities, and innovation pipeline.

## Directory Structure

```
strategy/
├── market-analyst.js          # Main market analysis agent
├── market-analysis.js          # Legacy (keep for reference)
├── competitor-intel.js         # Competitive intelligence agent
├── okr-tracker.js             # OKR tracking agent
├── market-expansion.js        # Market expansion analysis
├── ma-analysis.js             # M&A analysis
├── bizdev.js                  # Business development
├── competitors/               # Competitor data
│   ├── competitor-list.json   # Monitored competitors
│   ├── {id}-latest.json       # Latest scan data
│   └── {id}-pricing-history.json
├── okrs/                      # OKR data
│   └── okr-data.json          # Company/dept/team OKRs
├── market-data/               # Market research data
│   └── swiss-kmu-stats.json   # Swiss KMU statistics
├── screenshots/               # Competitor screenshots
│   └── {id}-{page}-{date}.png
├── industry-reports/          # Generated reports
│   ├── market-intelligence-Q{1-4}-{year}.md
│   ├── competitor-weekly-{date}.md
│   ├── competitive-analysis-{date}.md
│   └── okr-weekly-{date}.md
├── business-models/           # Business model evaluations
├── models/                    # Financial models
├── dd-checklists/            # Due diligence checklists
├── markets/                  # Market research by country
├── UPGRADE_SUMMARY.md        # Detailed upgrade documentation
└── README.md                 # This file
```

## Quick Start

### Run Agents Manually

```bash
# Market Analyst
node market-analyst.js --now      # Run quarterly analysis
node market-analyst.js --monthly  # Run monthly refresh

# Competitor Intelligence
node competitor-intel.js --scan   # Run weekly scan
node competitor-intel.js --report # Generate monthly report
node competitor-intel.js --now    # Run full cycle

# OKR Tracker
node okr-tracker.js --now         # Run weekly tracking
node okr-tracker.js --monthly     # Run monthly review
```

### Start Scheduled Agents

```bash
# Start all strategy agents
node market-analyst.js &
node competitor-intel.js &
node okr-tracker.js &
```

## Configuration

### Market Analyst

Edit `market-data/swiss-kmu-stats.json` to update:
- KMU counts by industry
- KMU counts by canton
- Digitalization trends
- Seasonal patterns
- Regulatory changes

### Competitor Intelligence

Edit `competitors/competitor-list.json` to:
- Add/remove competitors
- Update monitor URLs
- Configure alert keywords
- Maintain feature comparison matrix

### OKR Tracker

Edit `okrs/okr-data.json` to:
- Define company OKRs
- Define department OKRs
- Define team OKRs
- View historical completion data

## Dashboard Integration

All agents sync data to the dashboard:

- **Market Analyst**: TAM/SAM/SOM metrics, growth rates, market alerts
- **Competitor Intel**: Scan summaries, threat alerts, pricing changes
- **OKR Tracker**: Progress metrics, alignment scores, risk alerts

## Email Notifications

All agents send weekly/quarterly reports to the CEO:

- **Market Analyst**: Quarterly market intelligence briefings
- **Competitor Intel**: Weekly competitor briefings + monthly reports
- **OKR Tracker**: Weekly OKR summaries

## Data Sources

Agents pull data from:

1. **Airtable Tables**:
   - MarketIntelligence
   - CompetitorScans
   - OKRTracking
   - Pipeline
   - Customers
   - AgentExecutions
   - Projects
   - WinLoss

2. **Local Files**:
   - Swiss KMU statistics
   - Competitor configurations
   - OKR definitions
   - Historical scan data

3. **Web Scraping**:
   - Competitor websites (Puppeteer)
   - Pricing pages
   - Feature pages
   - Blog/content

## AI Models Used

- **Standard**: `claude-sonnet-4-5-20250929` (analysis, reports)
- **Fast**: `claude-haiku-4-5-20251001` (quick summaries, briefings)
- **Powerful**: `claude-opus-4-6` (complex SWOT, strategic recommendations)

## Shared Utilities

All agents use:
- `../shared/utils/logger.js` - Structured logging
- `../shared/utils/claude-client.js` - AI generation
- `../shared/utils/email-client.js` - Email notifications
- `../shared/utils/airtable-client.js` - Data persistence
- `../shared/utils/dashboard-sync.js` - Dashboard integration
- `../shared/utils/config.js` - Configuration

## Development

### Adding a New Competitor

1. Edit `competitors/competitor-list.json`
2. Add competitor object with:
   - Unique ID
   - Name, type, focus
   - Monitor URLs
   - Alert keywords
3. Add to feature comparison matrix
4. Run scan: `node competitor-intel.js --scan`

### Adding a New OKR

1. Edit `okrs/okr-data.json`
2. Add to appropriate level (company/department/team)
3. Include:
   - Unique ID
   - Objective
   - Owner
   - Quarter
   - Key Results with targets, baselines, units
4. Run tracking: `node okr-tracker.js --now`

### Testing

```bash
# Syntax validation
node -c market-analyst.js
node -c competitor-intel.js
node -c okr-tracker.js

# Dry run (with test data)
node market-analyst.js --now
node competitor-intel.js --scan
node okr-tracker.js --now
```

## Troubleshooting

### Common Issues

1. **Missing data files**: Check that JSON files exist in correct directories
2. **API errors**: Verify API keys in `.env` file
3. **Puppeteer issues**: Ensure Chrome/Chromium is installed
4. **Email failures**: Check Gmail app password in `.env`

### Logs

Check logs in `/logs/strategy-*.log` for detailed execution traces.

## Upgrade History

- **2026-02-14**: Major upgrade - TAM/SAM/SOM, price benchmarking, SWOT, OKR tracking
- **2026-02-13**: Initial deployment of market analysis and competitor intel

## Support

For issues or questions, see `/agents/UPGRADE_SUMMARY.md` and `/agents/shared/utils/README.md`.
