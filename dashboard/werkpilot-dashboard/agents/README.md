# Werkpilot Agent Performance Monitoring System

This directory contains the shared utilities and monitoring infrastructure for all Werkpilot AI agents.

## Directory Structure

```
agents/
├── shared/
│   └── utils/
│       ├── performance-monitor.js   # Central performance tracking
│       ├── cost-tracker.js          # AI cost management
│       └── alert-manager.js         # Centralized alerting
└── [individual agent directories]
```

## Monitoring Components

### 1. Performance Monitor (`performance-monitor.js`)

Tracks comprehensive performance metrics for each agent and system-wide statistics.

**Per-Agent Metrics:**
- CPU time usage
- Memory delta (allocation/deallocation)
- Execution duration
- API call count
- Tokens used
- Cost per execution

**System-Wide Metrics:**
- Total executions per hour
- Error rate (percentage)
- Average response time
- Total cost
- System health (CPU, memory, uptime)

**Rolling Windows:**
- 1 hour: Recent performance trends
- 24 hours: Daily patterns
- 7 days: Weekly trends

**Alert Thresholds:**
- Error rate > 10% → Warning
- Error rate > 25% → Critical
- Daily cost > budget → Alert
- Avg response time > 30s → Warning

**Features:**
- Automatic hourly snapshots saved to disk
- Metrics exported as JSON for dashboard
- Performance data persists across restarts

**Usage:**
```javascript
const { getPerformanceMonitor } = require('./shared/utils/performance-monitor');

const monitor = getPerformanceMonitor();

// Track an execution
monitor.trackExecution('agent-name', {
  duration: 1500,        // ms
  status: 'completed',   // or 'error', 'failed'
  tokensUsed: 1000,
  model: 'haiku',
  cost: 0.001,
  cpuTime: 500,
  memoryDelta: 1024,
  apiCalls: 2,
});

// Get agent metrics
const metrics = monitor.getAgentMetrics('agent-name');

// Get system metrics
const systemMetrics = monitor.getSystemMetrics();

// Export all metrics
const json = monitor.exportMetrics();
```

### 2. Cost Tracker (`cost-tracker.js`)

Manages AI costs across agents, departments, and time periods.

**Model Pricing (per 1M tokens):**
- Haiku: $0.25 input / $1.25 output
- Sonnet: $3.00 input / $15.00 output
- Opus: $15.00 input / $75.00 output

**Department Budgets (monthly):**
- Sales: $500
- Marketing: $300
- Operations: $200
- Support: $150
- Default: $100

**Features:**
- Track costs per agent, department, day, week, month
- Budget allocation and monitoring
- Cost optimization suggestions
- Alert when approaching budget limits
- Daily cost reports
- Historical data persistence

**Usage:**
```javascript
const { getCostTracker } = require('./shared/utils/cost-tracker');

const tracker = getCostTracker();

// Track a cost
tracker.trackCost('agent-name', 'sales', {
  model: 'sonnet',
  inputTokens: 500,
  outputTokens: 300,
});

// Get daily cost report
const dailyReport = tracker.getDailyCostReport();

// Get optimization suggestions
const optimizations = tracker.getCostOptimizations();

// Set department budget
tracker.setDepartmentBudget('sales', 600);

// Generate daily report
const report = await tracker.generateDailyCostReport();
```

### 3. Alert Manager (`alert-manager.js`)

Centralized alert handling with multiple channels and escalation.

**Alert Levels:**
- Info: General information
- Warning: Attention required
- Critical: Immediate action needed

**Alert Channels:**
- Console: Real-time logging
- Email: CEO notification for critical alerts
- Dashboard: In-app notifications

**Features:**
- Alert deduplication (1 hour window)
- Alert history (last 500 alerts)
- Rule-based alert processing
- Automatic escalation (warning → critical after 1 hour)
- Alert persistence to disk
- Acknowledgment tracking

**Usage:**
```javascript
const { getAlertManager } = require('./shared/utils/alert-manager');

const alerts = getAlertManager();

// Add an alert
alerts.addAlert({
  level: 'warning',
  type: 'error_rate',
  message: 'Error rate is above threshold',
  data: {
    errorRate: 0.15,
    threshold: 0.10,
  },
});

// Get recent alerts
const recentAlerts = alerts.getAlerts({ limit: 20 });

// Get alert statistics
const stats = alerts.getAlertStats('24h');

// Acknowledge an alert
alerts.acknowledgeAlert('alert_id');

// Add custom rule
alerts.addRule({
  name: 'custom_rule',
  level: 'critical',
  type: 'custom_type',
  condition: (alert) => alert.data.value > 100,
  action: (alert) => {
    console.log('Custom action:', alert);
  },
});
```

## Integration with Dashboard

The monitoring system is integrated with the dashboard through the `/api/metrics` endpoint:

**GET /api/metrics**
- Returns all system metrics
- Includes: agent performance, costs, alerts, system health
- 60-second caching for performance
- Query parameters:
  - `?type=agent` - Agent metrics only
  - `?type=system` - System metrics only
  - `?type=costs` - Cost data only
  - `?type=alerts` - Alerts only

**POST /api/metrics/acknowledge**
- Acknowledge an alert
- Body: `{ "alertId": "alert_id" }`

## Data Persistence

All monitoring data is persisted to disk:

```
data/
├── metrics/
│   └── snapshot-YYYY-MM-DDTHH-MM-SS.json  # Hourly snapshots
├── costs/
│   └── daily-cost-YYYY-MM-DD.json         # Daily cost reports
└── alerts/
    └── alerts-YYYY-MM-DD.json             # Daily alert logs
```

**Retention:**
- Metrics snapshots: 7 days (168 hourly snapshots)
- Cost reports: Permanent (for historical analysis)
- Alert logs: 30 days (configurable)

## Best Practices

1. **Always track executions**: Every agent execution should be tracked for visibility
2. **Use appropriate models**: Choose the cheapest model that meets requirements
3. **Monitor costs daily**: Review daily cost reports to catch anomalies
4. **Acknowledge alerts promptly**: Prevents escalation and keeps history clean
5. **Set realistic budgets**: Align department budgets with actual needs
6. **Review optimizations**: Act on cost optimization suggestions
7. **Monitor error rates**: High error rates indicate agent issues

## Environment Variables

Configure the following in `.env`:

```bash
# Alert Manager
CEO_EMAIL=ceo@werkpilot.com
ALERT_EMAIL_FROM=alerts@werkpilot.com

# Cost Tracker (optional overrides)
DAILY_BUDGET=100
SALES_BUDGET=500
MARKETING_BUDGET=300
```

## Troubleshooting

**Q: Metrics not showing up in dashboard?**
- Check that agents are calling `trackExecution()` properly
- Verify data directory permissions
- Check browser console for API errors

**Q: Alerts not being sent?**
- Email channel is disabled by default (requires email service setup)
- Check console for alert logs
- Verify dashboard notifications are being created

**Q: Cost calculations seem wrong?**
- Ensure correct model name is passed
- Verify input/output token counts
- Check model pricing in `cost-tracker.js`

## Future Enhancements

- [ ] Real email integration (SendGrid, AWS SES)
- [ ] SMS alerts for critical issues
- [ ] Slack/Teams integration
- [ ] ML-based anomaly detection
- [ ] Cost forecasting
- [ ] Performance trend analysis
- [ ] Custom dashboard widgets
- [ ] Export to external monitoring (Datadog, New Relic)
