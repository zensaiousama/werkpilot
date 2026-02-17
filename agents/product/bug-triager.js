/**
 * Product Department - Bug Triager Agent
 *
 * Automated bug triage system with severity classification (P0-P4),
 * deduplication via similar bug detection, root cause analysis,
 * impact assessment, auto-assignment based on code ownership,
 * SLA tracking, and bug trend analysis.
 *
 * Schedule: Continuous triage (every 15 min), daily SLA check, weekly trend report
 *
 * @module agents/product/bug-triager
 * @requires ../../shared/utils/claude-client
 * @requires ../../shared/utils/logger
 * @requires ../../shared/utils/airtable-client
 * @requires ../../shared/utils/email-client
 * @requires ../../shared/utils/config
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('bug-triager');

// --- Airtable Tables ---
const TABLES = {
  BUGS: 'Bugs',
  BUG_DUPLICATES: 'Bug_Duplicates',
  BUG_TRENDS: 'Bug_Trends',
  CODE_OWNERS: 'Code_Owners',
  SLA_VIOLATIONS: 'SLA_Violations',
  CLIENTS: 'Clients',
  TEAM_MEMBERS: 'Team_Members',
};

// --- Severity Definitions ---
const SEVERITY_LEVELS = {
  P0: {
    label: 'P0 - Critical/Outage',
    description: 'Service down or major data loss. Affects all users.',
    slaResponseHours: 0.5,
    slaResolutionHours: 4,
    escalation: 'immediate',
    color: '#d32f2f',
  },
  P1: {
    label: 'P1 - High',
    description: 'Major feature broken, no workaround. Affects many users.',
    slaResponseHours: 2,
    slaResolutionHours: 24,
    escalation: 'within_1_hour',
    color: '#f57c00',
  },
  P2: {
    label: 'P2 - Medium',
    description: 'Feature partially broken, workaround exists. Affects some users.',
    slaResponseHours: 8,
    slaResolutionHours: 72,
    escalation: 'next_standup',
    color: '#fbc02d',
  },
  P3: {
    label: 'P3 - Low',
    description: 'Minor issue, cosmetic, or edge case. Affects few users.',
    slaResponseHours: 24,
    slaResolutionHours: 168,
    escalation: 'sprint_planning',
    color: '#388e3c',
  },
  P4: {
    label: 'P4 - Trivial',
    description: 'Enhancement request or negligible impact.',
    slaResponseHours: 72,
    slaResolutionHours: 720,
    escalation: 'backlog',
    color: '#757575',
  },
};

// --- Code Ownership Patterns (fallback if Airtable is empty) ---
const DEFAULT_CODE_OWNERS = {
  'frontend': { team: 'Frontend', lead: 'frontend-lead' },
  'backend': { team: 'Backend', lead: 'backend-lead' },
  'api': { team: 'Backend', lead: 'api-lead' },
  'database': { team: 'Backend', lead: 'db-lead' },
  'auth': { team: 'Security', lead: 'security-lead' },
  'payment': { team: 'Payments', lead: 'payments-lead' },
  'infra': { team: 'Infrastructure', lead: 'infra-lead' },
  'mobile': { team: 'Mobile', lead: 'mobile-lead' },
  'integration': { team: 'Integrations', lead: 'integrations-lead' },
  'ai': { team: 'AI/ML', lead: 'ai-lead' },
};

// ============================================================
// Automatic Severity Classification
// ============================================================

/**
 * Classify the severity of a bug report using P0-P4 levels.
 * Uses Claude to analyze the bug description, affected components,
 * and user impact to determine appropriate severity.
 *
 * @param {Object} bug - Bug report object
 * @param {string} bug.title - Bug title
 * @param {string} bug.description - Detailed bug description
 * @param {string} [bug.component] - Affected component/module
 * @param {string} [bug.environment] - Environment (production, staging, etc.)
 * @param {number} [bug.usersAffected] - Known number of affected users
 * @param {string} [bug.errorLogs] - Relevant error logs
 * @returns {Promise<Object>} Classification result with severity, rationale, and impact data
 */
async function classifySeverity(bug) {
  logger.info(`Classifying severity for: ${bug.title}`);

  try {
    const classification = await generateJSON(
      `You are a senior QA engineer triaging a bug report. Classify its severity using P0-P4 levels.

Severity definitions:
- P0 (Critical/Outage): Service is completely down or causes data loss/corruption. Affects all or most users. Revenue-blocking.
- P1 (High): Major feature is broken with no workaround. Affects a significant portion of users. Business impact is high.
- P2 (Medium): Feature partially broken but a workaround exists. Affects some users. Moderate business impact.
- P3 (Low): Minor issue, cosmetic bug, or rare edge case. Affects few users. Low business impact.
- P4 (Trivial): Enhancement disguised as bug, or negligible impact. No real urgency.

Bug report:
- Title: ${bug.title}
- Description: ${bug.description || 'No description provided'}
- Component: ${bug.component || 'Unknown'}
- Environment: ${bug.environment || 'Unknown'}
- Users affected: ${bug.usersAffected || 'Unknown'}
- Reporter: ${bug.reporter || 'Unknown'}
- Error logs: ${(bug.errorLogs || 'None provided').substring(0, 1000)}
- Reproduction steps: ${bug.reproSteps || 'None provided'}

Return JSON with:
- severity: "P0" | "P1" | "P2" | "P3" | "P4"
- severity_label: full label (e.g., "P0 - Critical/Outage")
- rationale: 2-3 sentence explanation of why this severity was chosen
- user_impact: "all_users" | "many_users" | "some_users" | "few_users" | "negligible"
- business_impact: "revenue_blocking" | "high" | "medium" | "low" | "negligible"
- data_risk: boolean, true if there is risk of data loss/corruption
- workaround_available: boolean
- workaround_description: string or null
- escalation_needed: boolean
- escalation_reason: string or null
- affected_components: array of component names likely involved
- suggested_tags: array of relevant tags (e.g., ["regression", "security", "performance"])`,
      { model: config.models.fast, maxTokens: 768 }
    );

    logger.info(
      `Severity classified: ${bug.title} => ${classification.severity} | impact=${classification.user_impact} | escalate=${classification.escalation_needed}`
    );

    return classification;
  } catch (err) {
    logger.error(`Failed to classify severity for: ${bug.title}`, { error: err.message });
    // Default to P2 (Medium) on failure to avoid both under- and over-triaging
    return {
      severity: 'P2',
      severity_label: 'P2 - Medium (auto-default)',
      rationale: 'Classification failed; defaulting to P2 for manual review.',
      user_impact: 'unknown',
      business_impact: 'unknown',
      data_risk: false,
      workaround_available: false,
      workaround_description: null,
      escalation_needed: true,
      escalation_reason: 'Automated classification failed, needs manual triage.',
      affected_components: [],
      suggested_tags: ['needs-triage'],
    };
  }
}

// ============================================================
// Similar Bug Detection (Deduplication)
// ============================================================

/**
 * Search for existing bugs similar to a new report to identify duplicates.
 * Uses Claude to perform semantic similarity matching beyond simple text matching.
 *
 * @param {Object} newBug - The new bug report to check for duplicates
 * @param {string} newBug.title - Bug title
 * @param {string} newBug.description - Bug description
 * @param {string} [newBug.component] - Affected component
 * @returns {Promise<Object>} Deduplication result with matches and confidence
 */
async function detectSimilarBugs(newBug) {
  logger.info(`Checking for duplicates: ${newBug.title}`);

  try {
    // Fetch open bugs from the last 90 days for comparison
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const existingBugs = await getRecords(
      TABLES.BUGS,
      `AND(OR({Status} = "Open", {Status} = "In Progress", {Status} = "Reopened"), {Created_Date} >= "${ninetyDaysAgo}")`,
      100
    );

    if (existingBugs.length === 0) {
      logger.info('No existing bugs to compare against');
      return { isDuplicate: false, matches: [], confidence: 0 };
    }

    const existingList = existingBugs.map((b) => ({
      id: b.id,
      title: b.Title || b.Name,
      description: (b.Description || '').substring(0, 300),
      component: b.Component || '',
      severity: b.Severity || '',
      status: b.Status || '',
    }));

    const analysis = await generateJSON(
      `Compare this new bug report against existing open bugs to find duplicates or closely related issues.

New bug:
- Title: ${newBug.title}
- Description: ${(newBug.description || '').substring(0, 500)}
- Component: ${newBug.component || 'Unknown'}

Existing bugs:
${JSON.stringify(existingList, null, 2)}

For each potential match, assess:
1. Semantic similarity (same root cause, even if described differently)
2. Component overlap
3. Symptom overlap (same user-visible behavior)

Return JSON with:
- is_duplicate: boolean (true if high-confidence duplicate exists)
- duplicate_of: id of the primary duplicate (or null)
- matches: array of {
    id: bug id,
    title: bug title,
    similarity_score: 0-100,
    relationship: "exact_duplicate" | "likely_duplicate" | "related" | "same_root_cause" | "different",
    explanation: why these bugs are similar
  } (only include matches with similarity_score >= 40, sorted by score desc)
- recommendation: "merge" | "link" | "keep_separate" | "needs_manual_review"
- merged_description: if merging, a combined bug description incorporating both reports`,
      { model: config.models.fast, maxTokens: 1500 }
    );

    if (analysis.is_duplicate && analysis.duplicate_of) {
      logger.info(
        `Duplicate detected: "${newBug.title}" is duplicate of bug ${analysis.duplicate_of}`
      );
    } else if (analysis.matches && analysis.matches.length > 0) {
      const relatedCount = analysis.matches.filter((m) => m.similarity_score >= 60).length;
      if (relatedCount > 0) {
        logger.info(`Found ${relatedCount} closely related bugs for: ${newBug.title}`);
      }
    }

    return analysis;
  } catch (err) {
    logger.error(`Failed to detect similar bugs for: ${newBug.title}`, { error: err.message });
    return { isDuplicate: false, matches: [], confidence: 0 };
  }
}

// ============================================================
// Root Cause Analysis Suggestions
// ============================================================

/**
 * Generate root cause analysis suggestions for a bug based on
 * available information, error logs, and system context.
 *
 * @param {Object} bug - Bug report with detailed information
 * @param {string} bug.title - Bug title
 * @param {string} bug.description - Detailed description
 * @param {string} [bug.errorLogs] - Error logs / stack traces
 * @param {string} [bug.component] - Affected component
 * @param {string} [bug.recentChanges] - Recent deployments or changes
 * @returns {Promise<Object>} Root cause analysis with hypotheses and investigation steps
 */
async function suggestRootCause(bug) {
  logger.info(`Generating root cause analysis for: ${bug.title}`);

  try {
    const analysis = await generateJSON(
      `You are a senior software engineer performing root cause analysis on a bug.

Bug Details:
- Title: ${bug.title}
- Description: ${bug.description || 'No description'}
- Component: ${bug.component || 'Unknown'}
- Severity: ${bug.severity || 'Unknown'}
- Environment: ${bug.environment || 'Unknown'}
- Error Logs / Stack Trace:
${(bug.errorLogs || 'None available').substring(0, 2000)}
- Recent Changes/Deployments: ${bug.recentChanges || 'None known'}
- First Occurrence: ${bug.firstOccurrence || 'Unknown'}
- Frequency: ${bug.frequency || 'Unknown'}
- Reproduction Steps: ${bug.reproSteps || 'None provided'}

Analyze the bug and provide root cause hypotheses.

Return JSON with:
- hypotheses: array of {
    rank: 1-based ranking by likelihood,
    cause: brief description of the potential root cause,
    likelihood: "high" | "medium" | "low",
    category: "code_bug" | "configuration" | "infrastructure" | "data_corruption" | "race_condition" | "dependency" | "resource_exhaustion" | "security" | "third_party",
    evidence: array of evidence supporting this hypothesis,
    investigation_steps: array of concrete steps to verify this hypothesis,
    affected_code_areas: array of likely code paths/files involved
  }
- immediate_actions: array of things to do right now (mitigation)
- investigation_priority: ordered array of what to investigate first
- related_patterns: array of common bug patterns this matches
- prevention_suggestions: array of how to prevent similar bugs in the future
- estimated_fix_complexity: "trivial" | "simple" | "moderate" | "complex" | "architectural"
- requires_postmortem: boolean`,
      { model: config.models.standard, maxTokens: 2000 }
    );

    logger.info(
      `Root cause analysis complete for: ${bug.title} | ${(analysis.hypotheses || []).length} hypotheses | fix_complexity=${analysis.estimated_fix_complexity}`
    );

    return analysis;
  } catch (err) {
    logger.error(`Failed to generate root cause analysis for: ${bug.title}`, {
      error: err.message,
    });
    return {
      hypotheses: [],
      immediate_actions: ['Manual investigation required'],
      investigation_priority: [],
      related_patterns: [],
      prevention_suggestions: [],
      estimated_fix_complexity: 'unknown',
      requires_postmortem: false,
    };
  }
}

// ============================================================
// Impact Assessment
// ============================================================

/**
 * Assess the impact of a bug in terms of users affected, revenue at risk,
 * and operational consequences.
 *
 * @param {Object} bug - Bug report
 * @returns {Promise<Object>} Impact assessment with user, revenue, and operational impact
 */
async function assessImpact(bug) {
  logger.info(`Assessing impact for: ${bug.title}`);

  try {
    // Get active client data for context
    const activeClients = await getRecords(TABLES.CLIENTS, '{Status} = "Active"', 100);
    const totalClients = activeClients.length;
    const totalMRR = activeClients.reduce((sum, c) => sum + (c.MRR || 0), 0);

    const assessment = await generateJSON(
      `Assess the business impact of this bug.

Bug:
- Title: ${bug.title}
- Description: ${bug.description || 'No description'}
- Severity: ${bug.severity || 'Unknown'}
- Component: ${bug.component || 'Unknown'}
- Environment: ${bug.environment || 'Unknown'}
- Reports count: ${bug.reportCount || 1}

Business context:
- Total active clients: ${totalClients}
- Total MRR: CHF ${totalMRR}
- Company: Werkpilot (Swiss AI automation for SMEs)

Return JSON with:
- users_affected_estimate: number (best estimate of affected users)
- users_affected_percentage: percentage of total user base
- revenue_at_risk_monthly: estimated CHF at risk per month if unresolved
- revenue_at_risk_rationale: explanation of revenue calculation
- operational_impact: "none" | "low" | "medium" | "high" | "critical"
- operational_impact_description: what operational processes are affected
- reputation_risk: "none" | "low" | "medium" | "high"
- churn_risk: boolean, true if this bug could cause customer churn
- churn_risk_clients: array of client types most at risk
- sla_breach_risk: boolean, true if client SLAs might be breached
- data_integrity_risk: "none" | "low" | "medium" | "high"
- compliance_implications: array of compliance concerns (GDPR, etc.)
- cost_of_delay_per_day: estimated daily cost of not fixing this (in CHF)
- priority_recommendation: recommended priority considering all factors`,
      { model: config.models.fast, maxTokens: 1024 }
    );

    logger.info(
      `Impact assessed: ${bug.title} | ${assessment.users_affected_estimate} users | CHF ${assessment.revenue_at_risk_monthly}/mo at risk | churn_risk=${assessment.churn_risk}`
    );

    return assessment;
  } catch (err) {
    logger.error(`Failed to assess impact for: ${bug.title}`, { error: err.message });
    return {
      users_affected_estimate: 0,
      users_affected_percentage: 0,
      revenue_at_risk_monthly: 0,
      operational_impact: 'unknown',
      reputation_risk: 'unknown',
      churn_risk: false,
      cost_of_delay_per_day: 0,
      priority_recommendation: 'P2',
    };
  }
}

// ============================================================
// Auto-Assignment Based on Code Ownership
// ============================================================

/**
 * Automatically assign a bug to the appropriate team member
 * based on code ownership rules and current workload.
 *
 * @param {Object} bug - Bug report with classification
 * @param {string} bug.component - Affected component
 * @param {string} bug.severity - Bug severity (P0-P4)
 * @param {string[]} [bug.affectedComponents] - Additional affected components
 * @returns {Promise<Object>} Assignment recommendation with assignee and reasoning
 */
async function autoAssign(bug) {
  logger.info(`Auto-assigning bug: ${bug.title}`);

  try {
    // Load code owners from Airtable or use defaults
    let codeOwners;
    try {
      const owners = await getRecords(TABLES.CODE_OWNERS, '', 50);
      if (owners.length > 0) {
        codeOwners = {};
        for (const owner of owners) {
          codeOwners[owner.Component || owner.Name] = {
            team: owner.Team,
            lead: owner.Lead,
            members: owner.Members ? owner.Members.split(',').map((m) => m.trim()) : [],
          };
        }
      } else {
        codeOwners = DEFAULT_CODE_OWNERS;
      }
    } catch (err) {
      logger.warn('Failed to load code owners from Airtable, using defaults', {
        error: err.message,
      });
      codeOwners = DEFAULT_CODE_OWNERS;
    }

    // Get current team workloads
    let teamWorkloads = {};
    try {
      const openBugs = await getRecords(
        TABLES.BUGS,
        'AND(OR({Status} = "Open", {Status} = "In Progress"), {Assignee} != BLANK())'
      );
      for (const b of openBugs) {
        const assignee = b.Assignee || 'unassigned';
        if (!teamWorkloads[assignee]) {
          teamWorkloads[assignee] = { total: 0, p0p1: 0 };
        }
        teamWorkloads[assignee].total++;
        if (b.Severity === 'P0' || b.Severity === 'P1') {
          teamWorkloads[assignee].p0p1++;
        }
      }
    } catch (err) {
      logger.warn('Failed to load team workloads', { error: err.message });
    }

    const components = [bug.component, ...(bug.affectedComponents || [])].filter(Boolean);

    // Find matching owners
    const matchedOwners = [];
    for (const component of components) {
      const lowerComp = (component || '').toLowerCase();
      for (const [pattern, owner] of Object.entries(codeOwners)) {
        if (lowerComp.includes(pattern.toLowerCase()) || pattern.toLowerCase().includes(lowerComp)) {
          matchedOwners.push({ component, ...owner, pattern });
        }
      }
    }

    // Use Claude for nuanced assignment if matches are ambiguous
    const assignment = await generateJSON(
      `Assign this bug to the most appropriate team member.

Bug:
- Title: ${bug.title}
- Severity: ${bug.severity || 'P2'}
- Components: ${components.join(', ') || 'Unknown'}
- Description: ${(bug.description || '').substring(0, 300)}

Code ownership matches:
${JSON.stringify(matchedOwners, null, 2)}

Current team workloads (open bugs per person):
${JSON.stringify(teamWorkloads, null, 2)}

Rules:
1. P0 bugs go to the team lead
2. Balance workload: avoid overloading anyone
3. If multiple teams are involved, assign to the primary component owner
4. For P0/P1, also identify a backup assignee

Return JSON with:
- assignee: recommended primary assignee (team lead or member name)
- team: which team owns this
- backup_assignee: secondary assignee for coverage
- assignment_rationale: why this person/team was chosen
- workload_warning: boolean, true if assignee already has high workload
- cc_list: array of people who should be notified
- expertise_match: "strong" | "moderate" | "weak" (how well the assignee matches)`,
      { model: config.models.fast, maxTokens: 512 }
    );

    logger.info(
      `Bug assigned: ${bug.title} => ${assignment.assignee} (${assignment.team}) | expertise=${assignment.expertise_match}`
    );

    return assignment;
  } catch (err) {
    logger.error(`Failed to auto-assign bug: ${bug.title}`, { error: err.message });
    return {
      assignee: 'unassigned',
      team: 'Unknown',
      backup_assignee: null,
      assignment_rationale: 'Auto-assignment failed; manual assignment required.',
      workload_warning: false,
      cc_list: [],
      expertise_match: 'weak',
    };
  }
}

// ============================================================
// SLA Tracking
// ============================================================

/**
 * Check all open bugs against their SLA deadlines based on severity.
 * Identifies breaches, at-risk bugs, and generates alerts.
 *
 * @returns {Promise<Object>} SLA tracking results with violations and at-risk items
 */
async function trackSLAs() {
  logger.info('Tracking SLA compliance for open bugs');

  try {
    const openBugs = await getRecords(
      TABLES.BUGS,
      'AND(OR({Status} = "Open", {Status} = "In Progress", {Status} = "Reopened"), {Severity} != BLANK())',
      200
    );

    if (openBugs.length === 0) {
      logger.info('No open bugs to check SLAs');
      return { violations: [], atRisk: [], compliant: 0 };
    }

    const now = Date.now();
    const violations = [];
    const atRisk = [];
    let compliant = 0;

    for (const bug of openBugs) {
      const severity = bug.Severity || 'P3';
      const sla = SEVERITY_LEVELS[severity];
      if (!sla) continue;

      const createdAt = bug.Created_Date ? new Date(bug.Created_Date).getTime() : now;
      const respondedAt = bug.First_Response_Date
        ? new Date(bug.First_Response_Date).getTime()
        : null;

      const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);

      // Check response SLA
      const responseDeadlineHours = sla.slaResponseHours;
      const responseBreached = !respondedAt && hoursSinceCreated > responseDeadlineHours;
      const responseAtRisk =
        !respondedAt && hoursSinceCreated > responseDeadlineHours * 0.75;

      // Check resolution SLA
      const resolutionDeadlineHours = sla.slaResolutionHours;
      const resolutionBreached = hoursSinceCreated > resolutionDeadlineHours;
      const resolutionAtRisk = hoursSinceCreated > resolutionDeadlineHours * 0.75;

      const bugInfo = {
        id: bug.id,
        title: bug.Title || bug.Name,
        severity,
        assignee: bug.Assignee || 'Unassigned',
        hoursSinceCreated: Math.round(hoursSinceCreated * 10) / 10,
        responseDeadlineHours,
        resolutionDeadlineHours,
      };

      if (responseBreached || resolutionBreached) {
        const violation = {
          ...bugInfo,
          type: responseBreached ? 'response' : 'resolution',
          breachedBy: responseBreached
            ? `${Math.round(hoursSinceCreated - responseDeadlineHours)}h over response SLA`
            : `${Math.round(hoursSinceCreated - resolutionDeadlineHours)}h over resolution SLA`,
        };
        violations.push(violation);

        // Record SLA violation
        try {
          await createRecord(TABLES.SLA_VIOLATIONS, {
            Bug: bug.Title || bug.Name,
            Bug_ID: bug.id,
            Severity: severity,
            Violation_Type: violation.type,
            Hours_Over: responseBreached
              ? hoursSinceCreated - responseDeadlineHours
              : hoursSinceCreated - resolutionDeadlineHours,
            Assignee: bug.Assignee || 'Unassigned',
            Detected_Date: new Date().toISOString(),
          });
        } catch (err) {
          logger.warn('Failed to record SLA violation', { error: err.message });
        }

        logger.warn(
          `SLA VIOLATED: ${bug.Title || bug.Name} (${severity}) | ${violation.breachedBy}`
        );
      } else if (responseAtRisk || resolutionAtRisk) {
        atRisk.push({
          ...bugInfo,
          type: responseAtRisk ? 'response' : 'resolution',
          timeRemaining: responseAtRisk
            ? `${Math.round(responseDeadlineHours - hoursSinceCreated)}h until response SLA`
            : `${Math.round(resolutionDeadlineHours - hoursSinceCreated)}h until resolution SLA`,
        });
      } else {
        compliant++;
      }
    }

    // Send alerts for P0/P1 SLA violations
    const criticalViolations = violations.filter(
      (v) => v.severity === 'P0' || v.severity === 'P1'
    );
    if (criticalViolations.length > 0) {
      try {
        await sendCEOEmail({
          subject: `SLA BREACH ALERT: ${criticalViolations.length} Critical/High bugs over SLA`,
          html: `
            <h2 style="color: #d32f2f;">SLA Breach Alert</h2>
            <div style="font-family: Arial, sans-serif;">
              ${criticalViolations
                .map(
                  (v) => `
                <div style="border-left: 4px solid ${SEVERITY_LEVELS[v.severity]?.color || '#d32f2f'}; padding: 10px; margin: 10px 0; background: #fff3f3;">
                  <strong>${v.severity}: ${v.title}</strong><br>
                  Assignee: ${v.assignee}<br>
                  ${v.breachedBy}<br>
                </div>`
                )
                .join('')}
              <p style="color: #666; font-size: 12px;">Generated by Werkpilot Bug Triager Agent</p>
            </div>
          `,
        });
      } catch (err) {
        logger.error('Failed to send SLA breach alert email', { error: err.message });
      }
    }

    logger.info(
      `SLA tracking: ${violations.length} violations | ${atRisk.length} at-risk | ${compliant} compliant | ${openBugs.length} total`
    );

    return { violations, atRisk, compliant, total: openBugs.length };
  } catch (err) {
    logger.error('Failed to track SLAs', { error: err.message });
    return { violations: [], atRisk: [], compliant: 0, total: 0 };
  }
}

// ============================================================
// Bug Trend Analysis
// ============================================================

/**
 * Analyze bug trends over time to identify regressions, hotspot components,
 * recurring patterns, and overall quality trajectory.
 *
 * @param {number} [lookbackDays=30] - Number of days to analyze
 * @returns {Promise<Object>} Trend analysis with patterns, hotspots, and recommendations
 */
async function analyzeBugTrends(lookbackDays = 30) {
  logger.info(`Analyzing bug trends over the last ${lookbackDays} days`);

  try {
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const recentBugs = await getRecords(
      TABLES.BUGS,
      `{Created_Date} >= "${startDate}"`,
      500
    );

    if (recentBugs.length === 0) {
      logger.info('No bugs in the analysis period');
      return { trends: [], hotspots: [], regressions: [] };
    }

    // Aggregate data
    const byComponent = {};
    const bySeverity = {};
    const byWeek = {};
    const byStatus = {};

    for (const bug of recentBugs) {
      const component = bug.Component || 'Unknown';
      const severity = bug.Severity || 'Unknown';
      const created = bug.Created_Date || '';
      const status = bug.Status || 'Unknown';

      // Component counts
      byComponent[component] = (byComponent[component] || 0) + 1;

      // Severity counts
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;

      // Weekly counts
      if (created) {
        const weekStart = getWeekStart(new Date(created));
        byWeek[weekStart] = (byWeek[weekStart] || 0) + 1;
      }

      // Status counts
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    // Calculate resolution times
    const resolvedBugs = recentBugs.filter((b) => b.Resolved_Date && b.Created_Date);
    const resolutionTimes = resolvedBugs.map((b) => {
      const created = new Date(b.Created_Date).getTime();
      const resolved = new Date(b.Resolved_Date).getTime();
      return (resolved - created) / (1000 * 60 * 60); // hours
    });

    const avgResolutionHours =
      resolutionTimes.length > 0
        ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
        : 0;

    const medianResolutionHours =
      resolutionTimes.length > 0
        ? Math.round(resolutionTimes.sort((a, b) => a - b)[Math.floor(resolutionTimes.length / 2)])
        : 0;

    // Use Claude for deeper analysis
    const analysis = await generateJSON(
      `Analyze these bug trend data and identify patterns, regressions, and recommendations.

Period: ${lookbackDays} days (since ${startDate})
Total bugs: ${recentBugs.length}

Bugs by component:
${JSON.stringify(byComponent, null, 2)}

Bugs by severity:
${JSON.stringify(bySeverity, null, 2)}

Bugs by week:
${JSON.stringify(byWeek, null, 2)}

Bugs by status:
${JSON.stringify(byStatus, null, 2)}

Resolution metrics:
- Resolved bugs: ${resolvedBugs.length}
- Average resolution time: ${avgResolutionHours}h
- Median resolution time: ${medianResolutionHours}h

Return JSON with:
- overall_trend: "improving" | "stable" | "worsening"
- trend_description: 2-3 sentence summary of the overall quality trend
- hotspot_components: array of { component, bug_count, severity_distribution, is_regression: boolean, recommendation }
- regressions: array of { component, evidence, likely_cause, severity }
- recurring_patterns: array of { pattern, frequency, components_affected, root_cause_suggestion }
- weekly_trend: "increasing" | "stable" | "decreasing"
- resolution_health: "healthy" | "slow" | "backlog_growing"
- open_vs_resolved_ratio: description of the bug open/close rate balance
- top_recommendations: array of 3-5 prioritized recommendations to improve quality
- process_improvements: array of suggested process changes
- testing_gaps: array of areas where more testing is needed`,
      { model: config.models.standard, maxTokens: 2000 }
    );

    // Save trend data
    try {
      await createRecord(TABLES.BUG_TRENDS, {
        Period_Start: startDate,
        Period_End: new Date().toISOString().split('T')[0],
        Total_Bugs: recentBugs.length,
        Overall_Trend: analysis.overall_trend,
        Hotspots: JSON.stringify(analysis.hotspot_components || []),
        Regressions: JSON.stringify(analysis.regressions || []),
        Avg_Resolution_Hours: avgResolutionHours,
        Median_Resolution_Hours: medianResolutionHours,
        Analysis_Date: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn('Failed to save bug trend data', { error: err.message });
    }

    logger.info(
      `Bug trend analysis: ${analysis.overall_trend} | ${recentBugs.length} bugs | ${(analysis.hotspot_components || []).length} hotspots | ${(analysis.regressions || []).length} regressions`
    );

    return {
      ...analysis,
      rawMetrics: {
        totalBugs: recentBugs.length,
        byComponent,
        bySeverity,
        byWeek,
        avgResolutionHours,
        medianResolutionHours,
      },
    };
  } catch (err) {
    logger.error('Failed to analyze bug trends', { error: err.message });
    return { trends: [], hotspots: [], regressions: [] };
  }
}

/**
 * Get the ISO week start date string for a given date.
 * @param {Date} date - Input date
 * @returns {string} Week start as ISO date string
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// ============================================================
// Full Triage Pipeline
// ============================================================

/**
 * Run the complete triage pipeline on new, untriaged bugs.
 * Classifies severity, checks for duplicates, assesses impact,
 * suggests root causes, and auto-assigns.
 *
 * @returns {Promise<Object>} Triage results summary
 */
async function triageNewBugs() {
  logger.info('Triaging new bug reports');

  try {
    const newBugs = await getRecords(
      TABLES.BUGS,
      'AND({Status} = "New", {Triaged} != TRUE())',
      20
    );

    if (newBugs.length === 0) {
      logger.info('No new bugs to triage');
      return { triaged: 0, duplicates: 0, p0p1: 0 };
    }

    logger.info(`Triaging ${newBugs.length} new bug reports`);

    let triaged = 0;
    let duplicatesFound = 0;
    let p0p1Count = 0;

    for (const bug of newBugs) {
      try {
        const bugData = {
          title: bug.Title || bug.Name || 'Untitled',
          description: bug.Description || '',
          component: bug.Component || '',
          environment: bug.Environment || 'production',
          usersAffected: bug.Users_Affected || 0,
          reporter: bug.Reporter || '',
          errorLogs: bug.Error_Logs || '',
          reproSteps: bug.Repro_Steps || '',
          recentChanges: bug.Recent_Changes || '',
          firstOccurrence: bug.First_Occurrence || '',
          frequency: bug.Frequency || '',
          reportCount: bug.Report_Count || 1,
        };

        // Step 1: Check for duplicates
        const duplicateCheck = await detectSimilarBugs(bugData);

        if (duplicateCheck.is_duplicate && duplicateCheck.duplicate_of) {
          await updateRecord(TABLES.BUGS, bug.id, {
            Status: 'Duplicate',
            Duplicate_Of: duplicateCheck.duplicate_of,
            Triaged: true,
            Triage_Notes: `Duplicate of bug ${duplicateCheck.duplicate_of}. ${duplicateCheck.matches?.[0]?.explanation || ''}`,
            Triaged_Date: new Date().toISOString(),
          });

          // Save duplicate relationship
          try {
            await createRecord(TABLES.BUG_DUPLICATES, {
              Original_Bug: duplicateCheck.duplicate_of,
              Duplicate_Bug: bug.id,
              Similarity_Score: duplicateCheck.matches?.[0]?.similarity_score || 0,
              Detected_Date: new Date().toISOString().split('T')[0],
            });
          } catch (err) {
            logger.warn('Failed to save duplicate relationship', { error: err.message });
          }

          duplicatesFound++;
          triaged++;
          logger.info(`Bug marked as duplicate: ${bugData.title}`);
          continue;
        }

        // Step 2: Classify severity
        const classification = await classifySeverity(bugData);

        // Step 3: Assess impact
        const impact = await assessImpact({
          ...bugData,
          severity: classification.severity,
        });

        // Step 4: Root cause analysis (for P0-P2)
        let rootCause = null;
        if (['P0', 'P1', 'P2'].includes(classification.severity)) {
          rootCause = await suggestRootCause({
            ...bugData,
            severity: classification.severity,
          });
        }

        // Step 5: Auto-assign
        const assignment = await autoAssign({
          ...bugData,
          severity: classification.severity,
          affectedComponents: classification.affected_components || [],
        });

        // Update the bug record with all triage data
        const updateFields = {
          Severity: classification.severity,
          Severity_Label: classification.severity_label,
          Severity_Rationale: classification.rationale,
          User_Impact: classification.user_impact,
          Business_Impact: classification.business_impact,
          Data_Risk: classification.data_risk,
          Workaround_Available: classification.workaround_available,
          Workaround_Description: classification.workaround_description || '',
          Tags: (classification.suggested_tags || []).join(', '),
          Assignee: assignment.assignee,
          Team: assignment.team,
          Backup_Assignee: assignment.backup_assignee || '',
          Users_Affected_Estimate: impact.users_affected_estimate,
          Revenue_At_Risk: impact.revenue_at_risk_monthly,
          Churn_Risk: impact.churn_risk,
          Cost_Of_Delay_Per_Day: impact.cost_of_delay_per_day,
          Triaged: true,
          Triaged_Date: new Date().toISOString(),
          Status: 'Open',
        };

        if (rootCause) {
          updateFields.Root_Cause_Hypotheses = JSON.stringify(
            (rootCause.hypotheses || []).slice(0, 3)
          );
          updateFields.Immediate_Actions = JSON.stringify(rootCause.immediate_actions || []);
          updateFields.Fix_Complexity = rootCause.estimated_fix_complexity;
          updateFields.Requires_Postmortem = rootCause.requires_postmortem;
        }

        // Link similar (non-duplicate) bugs
        const relatedBugs = (duplicateCheck.matches || [])
          .filter((m) => m.similarity_score >= 40 && m.relationship !== 'exact_duplicate')
          .map((m) => m.id);
        if (relatedBugs.length > 0) {
          updateFields.Related_Bugs = relatedBugs.join(', ');
        }

        await updateRecord(TABLES.BUGS, bug.id, updateFields);

        if (classification.severity === 'P0' || classification.severity === 'P1') {
          p0p1Count++;
        }

        // Escalation for P0 bugs
        if (classification.severity === 'P0' && classification.escalation_needed) {
          try {
            await sendCEOEmail({
              subject: `P0 BUG: ${bugData.title}`,
              html: `
                <h2 style="color: #d32f2f;">P0 Critical Bug Alert</h2>
                <div style="font-family: Arial, sans-serif;">
                  <p><strong>${bugData.title}</strong></p>
                  <p>${bugData.description.substring(0, 500)}</p>
                  <div style="background: #fff3f3; padding: 12px; border-radius: 6px; margin: 10px 0;">
                    <strong>Impact:</strong> ${classification.user_impact} | Revenue at risk: CHF ${impact.revenue_at_risk_monthly}/mo<br>
                    <strong>Assigned to:</strong> ${assignment.assignee} (${assignment.team})<br>
                    <strong>SLA:</strong> Respond within ${SEVERITY_LEVELS.P0.slaResponseHours}h, resolve within ${SEVERITY_LEVELS.P0.slaResolutionHours}h
                  </div>
                  ${rootCause ? `<p><strong>Top hypothesis:</strong> ${rootCause.hypotheses?.[0]?.cause || 'Under investigation'}</p>` : ''}
                  <p style="color: #666; font-size: 12px;">Generated by Werkpilot Bug Triager Agent</p>
                </div>
              `,
            });
          } catch (err) {
            logger.error('Failed to send P0 escalation email', { error: err.message });
          }
        }

        triaged++;
        logger.info(
          `Triaged: ${bugData.title} | ${classification.severity} | assigned=${assignment.assignee} | impact=${classification.user_impact}`
        );
      } catch (err) {
        logger.error(`Failed to triage bug: ${bug.Title || bug.Name}`, {
          error: err.message,
        });
      }
    }

    logger.info(
      `Triage complete: ${triaged} triaged | ${duplicatesFound} duplicates | ${p0p1Count} P0/P1`
    );

    return { triaged, duplicates: duplicatesFound, p0p1: p0p1Count };
  } catch (err) {
    logger.error('Failed to triage new bugs', { error: err.message });
    return { triaged: 0, duplicates: 0, p0p1: 0 };
  }
}

// ============================================================
// Main Execution Flows
// ============================================================

/**
 * Run the continuous triage cycle.
 * @returns {Promise<Object>} Triage results
 */
async function runTriageCycle() {
  logger.info('=== Bug Triager - Triage Cycle ===');
  const startTime = Date.now();

  try {
    const triageResults = await triageNewBugs();
    const slaResults = await trackSLAs();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Triage cycle complete in ${duration}s`, {
      ...triageResults,
      slaViolations: slaResults.violations.length,
    });

    return { ...triageResults, sla: slaResults };
  } catch (err) {
    logger.error('Triage cycle failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

/**
 * Run the weekly bug trend analysis and report.
 * @returns {Promise<Object>} Trend analysis results
 */
async function runWeeklyTrendReport() {
  logger.info('=== Bug Triager - Weekly Trend Report ===');
  const startTime = Date.now();

  try {
    const trends = await analyzeBugTrends(30);
    const sla = await trackSLAs();

    // Send weekly trend report
    const hotspots = (trends.hotspot_components || []).slice(0, 5);
    const regressions = trends.regressions || [];

    await sendCEOEmail({
      subject: `Bug Trend Report: ${trends.overall_trend || 'N/A'} (${trends.rawMetrics?.totalBugs || 0} bugs)`,
      html: `
        <h1>Weekly Bug Trend Report</h1>
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 700px;">
          <div style="background: #f0f4ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong>Overall Trend:</strong> ${trends.overall_trend || 'N/A'}<br>
            <strong>Total Bugs (30d):</strong> ${trends.rawMetrics?.totalBugs || 0}<br>
            <strong>Avg Resolution:</strong> ${trends.rawMetrics?.avgResolutionHours || 0}h<br>
            <strong>SLA Violations:</strong> ${sla.violations.length}
          </div>

          <p>${trends.trend_description || ''}</p>

          ${hotspots.length > 0
            ? `<h3>Hotspot Components</h3>
              <ul>${hotspots.map((h) => `<li><strong>${h.component}</strong>: ${h.bug_count} bugs${h.is_regression ? ' [REGRESSION]' : ''} - ${h.recommendation || ''}</li>`).join('')}</ul>`
            : ''}

          ${regressions.length > 0
            ? `<h3 style="color: #d32f2f;">Regressions Detected</h3>
              <ul>${regressions.map((r) => `<li><strong>${r.component}</strong>: ${r.evidence} (${r.severity})</li>`).join('')}</ul>`
            : '<p style="color: #2e7d32;">No regressions detected.</p>'}

          ${(trends.top_recommendations || []).length > 0
            ? `<h3>Top Recommendations</h3>
              <ol>${trends.top_recommendations.map((r) => `<li>${typeof r === 'string' ? r : r.description || JSON.stringify(r)}</li>`).join('')}</ol>`
            : ''}

          <hr style="margin-top: 30px;">
          <p style="color: #666; font-size: 12px;">Generated by Werkpilot Bug Triager Agent</p>
        </div>
      `,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Weekly trend report complete in ${duration}s`);

    return trends;
  } catch (err) {
    logger.error('Weekly trend report failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

/**
 * Main execute function - entry point for the agent.
 *
 * @param {Object} [options] - Execution options
 * @param {string} [options.workflow='triage'] - 'triage' | 'sla' | 'trends' | 'all'
 * @param {number} [options.lookbackDays=30] - Days for trend analysis
 * @returns {Promise<Object>} Execution results
 */
async function execute({ workflow = 'triage', lookbackDays = 30 } = {}) {
  logger.info(`Bug Triager executing workflow: ${workflow}`);

  const results = {};

  try {
    switch (workflow) {
      case 'triage':
        results.triage = await runTriageCycle();
        break;
      case 'sla':
        results.sla = await trackSLAs();
        break;
      case 'trends':
        results.trends = await analyzeBugTrends(lookbackDays);
        break;
      case 'all':
        results.triage = await runTriageCycle();
        results.trends = await analyzeBugTrends(lookbackDays);
        break;
      default:
        logger.warn(`Unknown workflow: ${workflow}, running triage cycle`);
        results.triage = await runTriageCycle();
    }

    logger.info('Bug Triager execution complete', results);
    return results;
  } catch (err) {
    logger.error('Bug Triager execution failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

// ============================================================
// Cron Schedules
// ============================================================

// Every 15 minutes - triage new bugs and check SLAs
cron.schedule('*/15 * * * *', () => {
  runTriageCycle().catch((err) =>
    logger.error('Cron triage cycle failed', { error: err.message })
  );
});

// Daily at 08:00 - comprehensive SLA check
cron.schedule('0 8 * * *', () => {
  trackSLAs().catch((err) =>
    logger.error('Cron SLA tracking failed', { error: err.message })
  );
});

// Weekly on Mondays at 07:00 - bug trend analysis and report
cron.schedule('0 7 * * 1', () => {
  runWeeklyTrendReport().catch((err) =>
    logger.error('Cron weekly trend report failed', { error: err.message })
  );
});

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Main entry point
  execute,

  // Workflow runners
  runTriageCycle,
  runWeeklyTrendReport,

  // Core triage functions
  classifySeverity,
  detectSimilarBugs,
  suggestRootCause,
  assessImpact,
  autoAssign,
  triageNewBugs,

  // SLA
  trackSLAs,

  // Trends
  analyzeBugTrends,

  // Constants
  SEVERITY_LEVELS,
};

// Run immediately if executed directly
if (require.main === module) {
  logger.info('Bug Triager Agent starting (direct execution)');
  execute()
    .then((results) => logger.info('Bug Triager Agent initial run complete', results))
    .catch((err) => {
      logger.error('Bug Triager Agent failed', { error: err.message });
      process.exit(1);
    });
}
