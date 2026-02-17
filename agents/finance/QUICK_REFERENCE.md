# Finance Agents - Quick Reference Guide

## Controlling Agent (controlling.js)

### Purpose
Tracks P&L per client, service, and industry. Calculates margins, unit economics, and budget vs actual. Monitors KPIs in real-time.

### Key Functions

```javascript
// Calculate KPIs (MRR, ARR, Churn, LTV, CAC, Revenue by Branche/Kanton)
const kpis = await calculateKPIs(clients, invoices, expenses);

// Sync KPIs to dashboard
await syncKPIsToDashboard(kpis, '2026-02');

// Project cash flow for next 3 months
const cashFlow = await projectCashFlow();

// Generate full controlling report
const report = await generateControllingReport();

// Check margins (alerts if below 80%)
const { alerts, clientPLs } = await checkMargins();

// Calculate unit economics
const unitEcon = await computeUnitEconomics();
```

### CLI Usage
```bash
# Full report
node controlling.js --once

# Margin check only
node controlling.js --margins

# Unit economics
node controlling.js --unit-economics

# Run as scheduled daemon
node controlling.js
```

### Schedule
- Full report: Daily at 06:00
- Margin check: Every 4 hours

---

## Revenue Forecast Model (forecast-models/revenue-forecast.js)

### Purpose
Statistical revenue forecasting with linear regression, seasonal adjustments, and accuracy tracking.

### Key Functions

```javascript
// Linear regression on historical MRR
const regression = linearRegression([
  { x: 0, y: 10000 },
  { x: 1, y: 11000 },
  { x: 2, y: 12500 }
]);
// Returns: { slope, intercept, r2 }

// Predict future MRR using regression
const prediction = predictWithLinearRegression(historicalMRR, 12);

// Apply seasonal adjustment (Swiss calendar)
const adjusted = seasonalAdjustment(8, 10000); // August = 0.95x

// Apply seasonal factors to forecast
const seasonal = applySeasonalFactors(predictions, currentMonth);

// Enhanced scenario modeling with confidence intervals
const scenarios = scenarioModeling(
  currentMRR,
  12,
  historicalMRR,
  true // includeSeasonalFactors
);
// Returns: { bestCase, expected, worstCase, linearRegression, regressionQuality }

// Track forecast accuracy
const accuracy = calculateForecastAccuracy(forecasts, actuals);
// Returns: { results, mape, rmse, accuracy, count }
```

### Seasonal Factors (Swiss Business Calendar)
- **Jan-Mar**: 1.15, 1.12, 1.10 (Strong Q1)
- **Apr-Jun**: 1.08, 1.05, 1.03 (Good Q2)
- **Jul-Sep**: 0.98, 0.95, 1.00 (Summer slowdown)
- **Oct-Dec**: 0.92, 0.88, 0.85 (Q4 slowdown)

---

## FP&A Agent (fpa.js)

### Purpose
Revenue forecasting, cash flow projections, scenario modeling, unit economics, cohort analysis, and board-ready dashboards.

### Key Functions

```javascript
// Enhanced unit economics
const unitEcon = await calculateEnhancedUnitEconomics();
// Returns: { cac, ltv, ltvCacRatio, paybackPeriod, avgMRRPerCustomer, 
//           avgLifespanMonths, monthlyChurnRate, conversionRate }

// Enhanced cohort analysis
const cohorts = await runEnhancedCohortAnalysis();
// Groups by signup month, tracks retention, expansion, churn

// Department cost allocation
const deptCosts = await allocateDepartmentCosts('2026-02');
// Allocates to: engineering, sales, marketing, operations, finance, general

// Enhanced P&L statement
const pl = await generateEnhancedPL('2026-02');
// Returns: { revenue, cogs, grossProfit, grossMargin, departmentCosts, 
//           opex, ebitda, ebitdaMargin, netIncome, netMargin }

// Break-even analysis
const breakEven = await calculateBreakEven();
// Returns: { fixedCosts, variableCostRatio, breakEvenRevenue, 
//           currentRevenue, marginOfSafety, isProfitable }

// Revenue forecast with linear regression & seasonal adjustment
const forecast = await runRevenueForecast();
// Includes: scenarios, forecastAccuracy, pipeline analysis

// Cash flow projection (30/60/90 days)
const cashFlow = await runCashFlowProjection();

// Growth metrics dashboard
const dashboard = await generateGrowthDashboard();

// Full board report (comprehensive)
const boardReport = await generateBoardReport();
```

### CLI Usage
```bash
# Full board report
node fpa.js --once

# Monthly forecast
node fpa.js --forecast

# Cash flow projection
node fpa.js --cashflow

# Growth dashboard
node fpa.js --dashboard

# Enhanced cohort analysis
node fpa.js --cohorts

# Unit economics
node fpa.js --unit-economics

# Break-even analysis
node fpa.js --break-even

# Enhanced P&L
node fpa.js --pl 2026-02

# Run as scheduled daemon
node fpa.js
```

### Schedule
- Board report: Weekly Monday at 05:00
- Metrics update: Daily at 06:30
- Monthly forecast: 1st of month at 04:00

---

## Key Metrics Explained

### MRR (Monthly Recurring Revenue)
Sum of all subscription revenue normalized to monthly.

### ARR (Annual Recurring Revenue)
MRR × 12

### CAC (Customer Acquisition Cost)
Total marketing spend ÷ number of new customers

### LTV (Lifetime Value)
Average MRR per customer × average customer lifespan (months)

### LTV/CAC Ratio
Target: 3x or higher
- Below 1x: Unsustainable
- 1-3x: Needs improvement
- 3x+: Healthy

### Payback Period
CAC ÷ Average MRR per customer (in months)
Target: 12 months or less

### NRR (Net Revenue Retention)
Revenue retention including expansion and contraction
Target: 100%+ (indicates expansion revenue)

### Churn Rate
(Churned customers ÷ total customers) × 100

### Gross Margin
(Revenue - COGS) ÷ Revenue × 100

### EBITDA Margin
EBITDA ÷ Revenue × 100

### Break-Even Revenue
Fixed costs ÷ (1 - variable cost ratio)

### Margin of Safety
((Current revenue - break-even revenue) ÷ current revenue) × 100

---

## Forecast Quality Metrics

### R² (Coefficient of Determination)
0.0 - 1.0, higher is better
- Above 0.7: Good fit
- 0.4 - 0.7: Moderate fit
- Below 0.4: Poor fit

### MAPE (Mean Absolute Percentage Error)
Lower is better
- Below 10%: Highly accurate
- 10-20%: Good
- 20-50%: Reasonable
- Above 50%: Inaccurate

### RMSE (Root Mean Squared Error)
Absolute error in same units as data. Lower is better.

---

## Dashboard Sync

KPIs are automatically synced to the dashboard via `dashboard-sync.bulkSync()`:
- MRR, ARR snapshots
- Churn rate
- LTV, CAC, LTV/CAC ratio
- Revenue by Branche (industry)
- Revenue by Kanton (geography)
- Timestamp for historical tracking

---

## Data Requirements

### Airtable Tables
- **Clients**: Name, Status, Industry, Kanton, SignupDate, MRR
- **Subscriptions**: Amount, BillingCycle, Status, Plan
- **Invoices**: Amount, Date, Status, Type, Client
- **Expenses**: Amount, Date, Category
- **Leads**: For conversion tracking
- **MRR_History**: Period, MRR, ARR
- **Forecasts**: Period, PredictedMRR (for accuracy tracking)
- **Budget**: Period, Revenue, COGS, expenses
- **BankAccounts**: Balance
- **Bills**: Amount, Status, DueDate
- **RecurringItems**: Amount, Type, DayOfMonth

---

## Best Practices

1. **Run reports monthly** for trend analysis
2. **Track forecast accuracy** to improve models
3. **Monitor LTV/CAC ratio** for unit economics health
4. **Review cohorts quarterly** for retention insights
5. **Adjust seasonal factors** based on actual performance
6. **Set margin alerts** at appropriate thresholds
7. **Project cash flow** regularly to avoid surprises
8. **Sync KPIs to dashboard** for real-time visibility

---

**Last Updated**: 2026-02-14
