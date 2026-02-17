# Sales Department Agents - Upgrade Summary

## Overview

Three new intelligent sales agents have been created to handle lead qualification, follow-up sequences, and pipeline management. All agents use the shared utilities (logger, claude-client, dashboard-sync) and follow the existing patterns.

---

## 1. Lead Qualifier Agent (`lead-qualifier.js`)

### Features

**Multi-Factor Scoring System (0-100 points):**
- Website Quality (0-25): AI-powered website analysis
- Business Size (0-25): Company size detection from name/notes
- Responsiveness (0-25): Based on lead freshness and response times
- Budget Fit (0-25): Budget range scoring

**Swiss-Specific Signals:**
- `.ch` domain bonus: +5 points
- Swiss phone format bonus: +3 points
- Canton-tier scoring:
  - Tier 1 (ZH, ZG, BS, GE, VD): +10 points
  - Tier 2 (BE, LU, SG, AG, BL): +5 points

**Industry-Specific Weights:**
- Treuhand/Consulting: +10 points
- Beratung/Real Estate: +5 points
- Gastronomie/Hospitality: -5 points

**Qualification Tiers:**
- A - Hot Lead: 80-100 points
- B - Qualified: 60-79 points
- C - Low Priority: 0-59 points

**Dashboard Integration:**
- Syncs qualification score and tier to dashboard
- Tracks token usage and execution time
- Logs agent status (active/idle/error)

### Usage

```bash
# Qualify all unqualified leads
node lead-qualifier.js --mode=continuous

# Qualify single lead
node lead-qualifier.js --lead-id=abc123
```

### Output

Updates Airtable with:
- `QualificationScore` (0-100)
- `QualificationTier` (A/B/C)
- `QualificationNotes` (detailed breakdown)
- `QualifiedAt` (timestamp)
- `QualifiedBy` (agent name)

---

## 2. Follow-Up Agent (`follow-up.js`)

### Features

**Time-of-Day Awareness:**
- Only sends emails during business hours: 8am-6pm CET
- Auto-schedules emails outside business hours for next morning
- Respects weekends (schedules for Monday 8am)

**Follow-Up Sequences:**
- Standard: 5-step cold outreach (Day 0, 3, 7, 14, 21)
- Warm Referral: 3-step sequence (Day 0, 5, 12)
- Breakup email on final step

**Personalization:**
- Industry-specific subject lines (Gastro, Handwerk, Retail, Health, Consulting)
- Canton-based language detection (DE/FR/IT)
- AI-generated email bodies using lead data
- References qualification score, fitness check, company size

**A/B Testing:**
- Variant A: Professional, value-focused tone
- Variant B: Friendly, casual tone
- 50/50 split based on lead ID hash
- Tracks which variant was sent

**Escalation:**
- After 3 emails with no response → escalate to manual review
- Sends CEO email notification
- Dashboard notification
- Updates lead status to "Manual Review Required"

### Usage

```bash
# Process all pending follow-ups
node follow-up.js --mode=continuous

# Send next follow-up for specific lead
node follow-up.js --lead-id=abc123

# Escalate all stale leads
node follow-up.js --mode=escalate
```

### Email Compliance

- Swiss B2B compliant (UWG Art. 3)
- Unsubscribe text in every email (DE/FR/IT)
- Clear sender identification
- No deceptive subject lines

---

## 3. Pipeline Manager Agent (`pipeline-manager.js`)

### Features

**Automatic Stage Progression Rules:**

1. New Lead → Qualified
   - Condition: Qualification score ≥ 60

2. Qualified → Contacted
   - Condition: Fitness check score > 70 AND qualification score ≥ 60

3. Contacted → Proposal Sent
   - Condition: Meeting completed

**Stale Lead Detection:**
- Detects leads with no activity in 14+ days
- Marks lead as stale in Airtable
- Sends CEO email report with list
- Dashboard warning notification

**Pipeline Velocity:**
- Calculates leads per stage (current count)
- Tracks leads entered per stage (last 30 days)
- Average days in each stage
- Overall conversion rate (New Lead → Closed Won)
- Velocity per stage (leads/day)

**Weekly Pipeline Report:**
- Stage breakdown with counts and avg scores
- Velocity metrics
- Top 10 leads (by qualification score)
- At-risk leads (7-14 days inactive, score ≥ 60)
- AI-generated insights using Claude
- Sent via email to CEO

### Usage

```bash
# Update pipeline (auto-progress leads)
node pipeline-manager.js --mode=update

# Detect stale leads
node pipeline-manager.js --mode=detect-stale

# Calculate velocity metrics
node pipeline-manager.js --mode=velocity

# Generate weekly report
node pipeline-manager.js --mode=report
```

### Pipeline Stages

1. New Lead
2. Qualified
3. Contacted
4. Proposal Sent
5. Negotiation
6. Closed Won
7. Closed Lost

---

## Shared Utilities Used

All agents use:

- **Logger**: `shared/utils/logger.js` - Winston-based logging
- **Claude Client**: `shared/utils/claude-client.js` - AI text/JSON generation with token tracking
- **Airtable Client**: `shared/utils/airtable-client.js` - CRUD operations
- **Dashboard Sync**: `shared/utils/dashboard-sync.js` - Dashboard data sync
- **Email Client**: `shared/utils/email-client.js` - Email sending

---

## Integration with Existing System

### Airtable Tables

**Leads Table** (existing):
- New fields used:
  - `QualificationScore` (Number, 0-100)
  - `QualificationTier` (Text: A/B/C)
  - `QualificationNotes` (Long Text)
  - `QualifiedAt` (DateTime)
  - `QualifiedBy` (Text)
  - `FollowUpCount` (Number)
  - `LastFollowUp` (DateTime)
  - `FollowUpVariant` (Text: A/B)
  - `IsStale` (Checkbox)
  - `StaleDetectedAt` (DateTime)
  - `EscalatedAt` (DateTime)
  - `EscalationReason` (Text)
  - `StageProgressedAt` (DateTime)
  - `StageProgressionNote` (Text)

**FollowUps Table** (new, optional):
- `LeadId` (Link to Leads)
- `Step` (Number)
- `StepName` (Text)
- `Subject` (Text)
- `Variant` (Text: A/B)
- `SentAt` (DateTime)
- `ScheduledFor` (DateTime)
- `Status` (Text: Sent/Scheduled/Failed)

### Dashboard Sync

All agents sync to dashboard:
- Agent status updates (active/idle/error)
- Execution logs with token tracking
- Lead updates
- Notifications (success/warning/error)

---

## Cron Job Recommendations

```bash
# Lead Qualifier: Run every 2 hours during business hours
0 8-18/2 * * * cd /path/to/agents && node sales/lead-qualifier.js --mode=continuous

# Follow-Up: Run every 4 hours during business hours
0 8-18/4 * * * cd /path/to/agents && node sales/follow-up.js --mode=continuous

# Pipeline Update: Run every morning at 9am
0 9 * * * cd /path/to/agents && node sales/pipeline-manager.js --mode=update

# Stale Lead Detection: Run daily at 10am
0 10 * * * cd /path/to/agents && node sales/pipeline-manager.js --mode=detect-stale

# Weekly Report: Run Monday at 8am
0 8 * * 1 cd /path/to/agents && node sales/pipeline-manager.js --mode=report

# Escalation Check: Run daily at 11am
0 11 * * * cd /path/to/agents && node sales/follow-up.js --mode=escalate
```

---

## Testing

### Test Lead Qualifier

```bash
# Create test lead in Airtable with:
# - CompanyName: "Test GmbH"
# - Industry: "Treuhand"
# - Canton: "ZH"
# - Website: "https://example.ch"
# - Phone: "+41 44 123 45 67"

node lead-qualifier.js --lead-id=<test-lead-id>

# Expected: High score (80+) due to Treuhand (+10), ZH (+10), .ch (+5), Swiss phone (+3)
```

### Test Follow-Up

```bash
# Create qualified lead (score ≥ 60)
node follow-up.js --lead-id=<test-lead-id>

# Check:
# - Email sent only during 8am-6pm CET
# - Personalized with industry/canton data
# - Variant A or B assigned
# - FollowUpCount incremented
```

### Test Pipeline Manager

```bash
# Create lead with QualificationScore=65 and FitnessCheckScore=75
node pipeline-manager.js --mode=update

# Expected: Auto-progression from Qualified → Contacted
```

---

## Error Handling

All agents:
- Log errors to Winston logger
- Sync error status to dashboard
- Send error notifications for critical failures
- Continue processing remaining items on partial failures
- Track failed operations in metrics

---

## Performance

- Lead Qualifier: ~3-5 seconds per lead (includes AI call)
- Follow-Up: ~2-4 seconds per email (includes AI generation)
- Pipeline Manager: ~1 second per lead (no AI calls for progression)
- Token tracking: Logged for all Claude API calls
- Rate limiting: 2-5 second delays between operations

---

## Future Enhancements

1. **Lead Qualifier:**
   - Web scraping for actual website analysis
   - LinkedIn company size detection
   - Competitor analysis

2. **Follow-Up:**
   - Email open/click tracking
   - Auto-response detection
   - Multi-channel follow-up (SMS, LinkedIn)

3. **Pipeline Manager:**
   - Predictive lead scoring (ML model)
   - Forecast pipeline for next 30/60/90 days
   - Custom stage definitions per industry
   - Deal value tracking and revenue forecasting

---

## Questions?

For support or questions, contact the agent development team or check the shared utilities documentation in `/agents/shared/utils/README.md`.
