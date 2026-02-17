/**
 * Product Department - Release Manager Agent
 *
 * Manages the full release lifecycle with semantic versioning automation,
 * changelog generation, release readiness checklists, rollback plan generation,
 * deployment window scheduling, feature flag management, and post-release
 * monitoring triggers.
 *
 * Schedule: Daily release check, on-demand release prep, post-release monitoring
 *
 * @module agents/product/release-manager
 * @requires ../../shared/utils/claude-client
 * @requires ../../shared/utils/logger
 * @requires ../../shared/utils/airtable-client
 * @requires ../../shared/utils/email-client
 * @requires ../../shared/utils/config
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('release-manager');

// --- Airtable Tables ---
const TABLES = {
  RELEASES: 'Releases',
  RELEASE_ITEMS: 'Release_Items',
  CHANGELOGS: 'Changelogs',
  READINESS_CHECKS: 'Readiness_Checks',
  ROLLBACK_PLANS: 'Rollback_Plans',
  DEPLOYMENT_WINDOWS: 'Deployment_Windows',
  FEATURE_FLAGS: 'Feature_Flags',
  MONITORING_ALERTS: 'Monitoring_Alerts',
  BUGS: 'Bugs',
};

// --- Semantic Versioning Types ---
const VERSION_BUMP_TYPES = {
  major: 'Major - Breaking changes or significant rewrites',
  minor: 'Minor - New features, backward compatible',
  patch: 'Patch - Bug fixes, backward compatible',
};

// --- Conventional Commit Prefixes ---
const COMMIT_PREFIXES = {
  'feat': 'minor',
  'feature': 'minor',
  'fix': 'patch',
  'bugfix': 'patch',
  'hotfix': 'patch',
  'perf': 'patch',
  'refactor': 'patch',
  'docs': 'patch',
  'style': 'patch',
  'test': 'patch',
  'chore': 'patch',
  'ci': 'patch',
  'build': 'patch',
  'breaking': 'major',
  'BREAKING CHANGE': 'major',
};

// --- Deployment Risk Levels ---
const RISK_LEVELS = {
  low: { label: 'Low Risk', monitoringHours: 2, rollbackThresholdMinutes: 30 },
  medium: { label: 'Medium Risk', monitoringHours: 6, rollbackThresholdMinutes: 15 },
  high: { label: 'High Risk', monitoringHours: 24, rollbackThresholdMinutes: 5 },
  critical: { label: 'Critical Risk', monitoringHours: 48, rollbackThresholdMinutes: 2 },
};

// ============================================================
// Semantic Versioning Automation
// ============================================================

/**
 * Parse a semantic version string into components.
 *
 * @param {string} version - Version string (e.g., "1.2.3" or "v1.2.3")
 * @returns {Object} Parsed version with major, minor, patch numbers
 */
function parseVersion(version) {
  const cleaned = (version || '0.0.0').replace(/^v/, '');
  const parts = cleaned.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    raw: cleaned,
  };
}

/**
 * Bump a version according to semver rules.
 *
 * @param {string} currentVersion - Current version string
 * @param {string} bumpType - "major" | "minor" | "patch"
 * @param {string} [preRelease] - Optional pre-release label (e.g., "beta", "rc.1")
 * @returns {string} New version string
 */
function bumpVersion(currentVersion, bumpType, preRelease) {
  const v = parseVersion(currentVersion);
  let newVersion;

  switch (bumpType) {
    case 'major':
      newVersion = `${v.major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${v.major}.${v.minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${v.major}.${v.minor}.${v.patch + 1}`;
      break;
  }

  if (preRelease) {
    newVersion += `-${preRelease}`;
  }

  return newVersion;
}

/**
 * Determine the version bump type from a list of commits/changes.
 * Analyzes conventional commit prefixes and change descriptions.
 *
 * @param {Array} changes - Array of commit/change objects with type and description
 * @returns {Promise<Object>} Version recommendation with bump type and reasoning
 */
async function determineVersionBump(changes) {
  logger.info(`Determining version bump from ${changes.length} changes`);

  try {
    // First pass: rule-based analysis from commit prefixes
    let hasBreaking = false;
    let hasFeature = false;
    let hasFix = false;

    for (const change of changes) {
      const type = (change.type || '').toLowerCase();
      const desc = (change.description || change.message || '').toLowerCase();

      if (type === 'breaking' || desc.includes('breaking change') || desc.includes('BREAKING')) {
        hasBreaking = true;
      } else if (type === 'feat' || type === 'feature') {
        hasFeature = true;
      } else if (type === 'fix' || type === 'bugfix' || type === 'hotfix') {
        hasFix = true;
      }
    }

    let suggestedBump = 'patch';
    if (hasBreaking) suggestedBump = 'major';
    else if (hasFeature) suggestedBump = 'minor';

    // Second pass: Claude verifies and provides context
    const verification = await generateJSON(
      `Verify the semantic version bump for this release.

Changes:
${JSON.stringify(changes.slice(0, 30).map((c) => ({
  type: c.type,
  description: (c.description || c.message || '').substring(0, 200),
  breaking: c.breaking || false,
})), null, 2)}

Rule-based suggestion: ${suggestedBump}
- Has breaking changes: ${hasBreaking}
- Has new features: ${hasFeature}
- Has bug fixes: ${hasFix}

Return JSON with:
- bump_type: "major" | "minor" | "patch"
- confidence: 0-100
- rationale: why this bump type is appropriate
- breaking_changes: array of breaking change descriptions (if any)
- notable_features: array of notable new feature descriptions
- override_rule_based: boolean (true if Claude disagrees with rule-based suggestion)
- override_reason: explanation if overriding`,
      { model: config.models.fast, maxTokens: 512 }
    );

    const finalBump = verification.override_rule_based
      ? verification.bump_type
      : suggestedBump;

    logger.info(
      `Version bump determined: ${finalBump} | rule-based=${suggestedBump} | claude=${verification.bump_type} | override=${verification.override_rule_based}`
    );

    return {
      bumpType: finalBump,
      ...verification,
    };
  } catch (err) {
    logger.error('Failed to determine version bump', { error: err.message });
    // Safe default: patch bump
    return {
      bumpType: 'patch',
      confidence: 50,
      rationale: 'Defaulting to patch bump due to analysis failure.',
      breaking_changes: [],
      notable_features: [],
    };
  }
}

// ============================================================
// Changelog Generation
// ============================================================

/**
 * Generate a comprehensive changelog from commits, PRs, and resolved bugs.
 *
 * @param {string} currentVersion - Current version string
 * @param {string} newVersion - New version string
 * @param {Array} changes - Array of changes (commits, PRs, bugs fixed)
 * @returns {Promise<Object>} Changelog with markdown content and structured data
 */
async function generateChangelog(currentVersion, newVersion, changes) {
  logger.info(`Generating changelog: ${currentVersion} -> ${newVersion}`);

  try {
    // Categorize changes
    const categorized = {
      breaking: [],
      features: [],
      fixes: [],
      performance: [],
      documentation: [],
      other: [],
    };

    for (const change of changes) {
      const type = (change.type || '').toLowerCase();
      if (type === 'breaking' || change.breaking) {
        categorized.breaking.push(change);
      } else if (type === 'feat' || type === 'feature') {
        categorized.features.push(change);
      } else if (type === 'fix' || type === 'bugfix' || type === 'hotfix') {
        categorized.fixes.push(change);
      } else if (type === 'perf') {
        categorized.performance.push(change);
      } else if (type === 'docs') {
        categorized.documentation.push(change);
      } else {
        categorized.other.push(change);
      }
    }

    // Generate human-readable changelog with Claude
    const changelog = await generateJSON(
      `Generate a professional changelog for this release.

Version: ${currentVersion} -> ${newVersion}
Release date: ${new Date().toISOString().split('T')[0]}

Categorized changes:
${JSON.stringify(categorized, null, 2)}

Return JSON with:
- version: "${newVersion}"
- date: release date
- summary: 2-3 sentence summary of the release highlights
- sections: array of {
    title: section title (e.g., "Breaking Changes", "New Features", "Bug Fixes"),
    emoji: appropriate emoji for the section,
    items: array of {
      description: clear, user-facing description of the change,
      technical_detail: optional technical detail,
      issue_refs: array of issue/PR references,
      contributors: array of contributor names/handles
    }
  }
- upgrade_guide: string or null (required if breaking changes exist, markdown formatted)
- migration_steps: array of steps users need to take (if breaking changes)
- highlights: array of 1-3 most noteworthy changes for marketing/announcements
- full_markdown: complete changelog in markdown format`,
      { model: config.models.standard, maxTokens: 3000 }
    );

    // Save changelog
    try {
      await createRecord(TABLES.CHANGELOGS, {
        Version: newVersion,
        Previous_Version: currentVersion,
        Date: new Date().toISOString().split('T')[0],
        Summary: changelog.summary,
        Markdown: changelog.full_markdown,
        Highlights: JSON.stringify(changelog.highlights || []),
        Breaking_Changes: categorized.breaking.length > 0,
        Upgrade_Guide: changelog.upgrade_guide || '',
        Total_Changes: changes.length,
      });
    } catch (err) {
      logger.warn('Failed to save changelog to Airtable', { error: err.message });
    }

    // Also save as local file
    const changelogDir = path.join(__dirname, 'changelogs');
    if (!fs.existsSync(changelogDir)) {
      fs.mkdirSync(changelogDir, { recursive: true });
    }
    const changelogPath = path.join(changelogDir, `${newVersion}.md`);
    fs.writeFileSync(changelogPath, changelog.full_markdown || '');
    logger.info(`Changelog saved to ${changelogPath}`);

    logger.info(
      `Changelog generated: ${newVersion} | ${changes.length} changes | ${categorized.breaking.length} breaking`
    );

    return changelog;
  } catch (err) {
    logger.error('Failed to generate changelog', { error: err.message });
    return {
      version: newVersion,
      date: new Date().toISOString().split('T')[0],
      summary: 'Changelog generation failed. Please review changes manually.',
      sections: [],
      full_markdown: `# ${newVersion}\n\nChangelog generation failed.`,
    };
  }
}

// ============================================================
// Release Readiness Checklist
// ============================================================

/**
 * Generate and evaluate a release readiness checklist.
 * Checks test coverage, open blockers, documentation status,
 * performance benchmarks, and deployment prerequisites.
 *
 * @param {string} version - Version being released
 * @param {Object} [releaseData] - Additional release context
 * @returns {Promise<Object>} Readiness assessment with pass/fail per check
 */
async function checkReleaseReadiness(version, releaseData = {}) {
  logger.info(`Checking release readiness for ${version}`);

  try {
    // Gather data for readiness checks
    const openBlockers = await getRecords(
      TABLES.BUGS,
      'AND(OR({Severity} = "P0", {Severity} = "P1"), OR({Status} = "Open", {Status} = "In Progress"))',
      50
    );

    const releaseItems = await getRecords(
      TABLES.RELEASE_ITEMS,
      `{Release_Version} = "${version}"`,
      50
    );

    const featureFlags = await getRecords(
      TABLES.FEATURE_FLAGS,
      `{Release_Version} = "${version}"`,
      20
    );

    const checks = [
      {
        name: 'No P0/P1 open blockers',
        status: openBlockers.length === 0 ? 'pass' : 'fail',
        detail: openBlockers.length === 0
          ? 'No critical or high severity bugs are open'
          : `${openBlockers.length} P0/P1 bugs still open: ${openBlockers.map((b) => b.Title || b.Name).join(', ')}`,
        blocking: true,
      },
      {
        name: 'All release items complete',
        status: releaseItems.every((i) => i.Status === 'Complete' || i.Status === 'Shipped')
          ? 'pass'
          : releaseItems.some((i) => i.Status === 'Complete' || i.Status === 'Shipped')
            ? 'warn'
            : 'fail',
        detail: `${releaseItems.filter((i) => i.Status === 'Complete' || i.Status === 'Shipped').length}/${releaseItems.length} items complete`,
        blocking: true,
      },
      {
        name: 'Feature flags configured',
        status: featureFlags.every((f) => f.Configured) ? 'pass' : 'warn',
        detail: `${featureFlags.filter((f) => f.Configured).length}/${featureFlags.length} flags configured`,
        blocking: false,
      },
      {
        name: 'Test suite passes',
        status: releaseData.testsPassing ? 'pass' : releaseData.testsPassing === false ? 'fail' : 'unknown',
        detail: releaseData.testCoverage
          ? `Coverage: ${releaseData.testCoverage}%`
          : 'Test status unknown - manual verification needed',
        blocking: true,
      },
      {
        name: 'Changelog generated',
        status: releaseData.changelogGenerated ? 'pass' : 'fail',
        detail: releaseData.changelogGenerated
          ? 'Changelog has been generated'
          : 'Changelog not yet generated',
        blocking: false,
      },
      {
        name: 'Rollback plan ready',
        status: releaseData.rollbackPlanReady ? 'pass' : 'fail',
        detail: releaseData.rollbackPlanReady
          ? 'Rollback plan is documented'
          : 'Rollback plan not yet created',
        blocking: true,
      },
      {
        name: 'Deployment window scheduled',
        status: releaseData.deploymentWindowScheduled ? 'pass' : 'warn',
        detail: releaseData.deploymentWindow
          ? `Scheduled for ${releaseData.deploymentWindow}`
          : 'No deployment window scheduled',
        blocking: false,
      },
      {
        name: 'Stakeholder sign-off',
        status: releaseData.signedOff ? 'pass' : 'warn',
        detail: releaseData.signedOff
          ? `Signed off by: ${releaseData.signedOffBy || 'stakeholders'}`
          : 'Awaiting stakeholder sign-off',
        blocking: false,
      },
    ];

    // Use Claude for comprehensive risk assessment
    const riskAssessment = await generateJSON(
      `Assess the release readiness based on these checklist results.

Version: ${version}
Checklist results:
${JSON.stringify(checks, null, 2)}

Release items:
${JSON.stringify(releaseItems.slice(0, 10).map((r) => ({ name: r.Name, status: r.Status, type: r.Type })), null, 2)}

Open blockers:
${JSON.stringify(openBlockers.slice(0, 5).map((b) => ({ title: b.Title || b.Name, severity: b.Severity, status: b.Status })), null, 2)}

Return JSON with:
- ready_to_release: boolean
- overall_risk: "low" | "medium" | "high" | "critical"
- blocking_issues: array of issues that must be resolved before release
- warnings: array of non-blocking concerns
- go_no_go_recommendation: "GO" | "NO-GO" | "CONDITIONAL-GO"
- conditions: array of conditions that must be met for a conditional go (if applicable)
- risk_mitigation: array of recommended risk mitigation steps
- suggested_actions: array of actions to take before proceeding`,
      { model: config.models.fast, maxTokens: 1024 }
    );

    // Persist readiness check
    try {
      await createRecord(TABLES.READINESS_CHECKS, {
        Version: version,
        Ready: riskAssessment.ready_to_release,
        Overall_Risk: riskAssessment.overall_risk,
        Recommendation: riskAssessment.go_no_go_recommendation,
        Checks: JSON.stringify(checks),
        Blocking_Issues: JSON.stringify(riskAssessment.blocking_issues || []),
        Check_Date: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn('Failed to save readiness check', { error: err.message });
    }

    const failCount = checks.filter((c) => c.status === 'fail').length;
    const warnCount = checks.filter((c) => c.status === 'warn').length;
    const passCount = checks.filter((c) => c.status === 'pass').length;

    logger.info(
      `Release readiness for ${version}: ${riskAssessment.go_no_go_recommendation} | pass=${passCount} warn=${warnCount} fail=${failCount} | risk=${riskAssessment.overall_risk}`
    );

    return {
      version,
      checks,
      ...riskAssessment,
      summary: { pass: passCount, warn: warnCount, fail: failCount },
    };
  } catch (err) {
    logger.error(`Failed to check release readiness for ${version}`, { error: err.message });
    return {
      version,
      checks: [],
      ready_to_release: false,
      overall_risk: 'unknown',
      go_no_go_recommendation: 'NO-GO',
      blocking_issues: ['Readiness check failed due to an error'],
    };
  }
}

// ============================================================
// Rollback Plan Generation
// ============================================================

/**
 * Generate a detailed rollback plan for a release.
 *
 * @param {string} version - Version being released
 * @param {Object} releaseContext - Context about the release
 * @param {string} releaseContext.previousVersion - Previous stable version
 * @param {Array} [releaseContext.changes] - Changes in this release
 * @param {string} [releaseContext.deploymentType] - Type of deployment
 * @returns {Promise<Object>} Detailed rollback plan with steps and criteria
 */
async function generateRollbackPlan(version, releaseContext = {}) {
  logger.info(`Generating rollback plan for ${version}`);

  try {
    const previousVersion = releaseContext.previousVersion || 'unknown';
    const changes = releaseContext.changes || [];
    const deploymentType = releaseContext.deploymentType || 'standard';

    const plan = await generateJSON(
      `Generate a comprehensive rollback plan for this software release.

Release: ${version} (rolling back to ${previousVersion})
Deployment type: ${deploymentType}
Changes included:
${JSON.stringify(changes.slice(0, 20).map((c) => ({
  type: c.type,
  description: (c.description || c.message || '').substring(0, 150),
  has_db_migration: c.has_db_migration || false,
  has_api_change: c.has_api_change || false,
})), null, 2)}

Generate a detailed rollback plan. Return JSON with:
- plan_id: unique identifier
- version: "${version}"
- rollback_to: "${previousVersion}"
- risk_level: "low" | "medium" | "high" | "critical"
- estimated_rollback_time_minutes: number
- rollback_triggers: array of conditions that should trigger a rollback (e.g., error rate > 5%)
- pre_rollback_steps: array of { step: number, action: string, responsible: string, estimated_minutes: number }
- rollback_steps: array of { step: number, action: string, command: string (if applicable), verification: string, estimated_minutes: number }
- post_rollback_steps: array of { step: number, action: string, verification: string }
- database_rollback: {
    required: boolean,
    migrations_to_reverse: array of migration names,
    data_backup_required: boolean,
    backup_procedure: string
  }
- api_rollback: {
    required: boolean,
    affected_endpoints: array of endpoints,
    client_impact: string,
    notification_required: boolean
  }
- feature_flag_rollback: array of { flag_name, action: "disable" | "revert" | "keep" }
- communication_plan: {
    internal_notification: string (template),
    client_notification: string (template, if needed),
    status_page_update: string
  }
- validation_checklist: array of checks to confirm rollback success
- point_of_no_return: description of when rollback becomes more costly than fixing forward
- lessons_learned_template: template for post-incident review`,
      { model: config.models.standard, maxTokens: 3000 }
    );

    // Save rollback plan
    try {
      await createRecord(TABLES.ROLLBACK_PLANS, {
        Version: version,
        Rollback_To: previousVersion,
        Risk_Level: plan.risk_level,
        Estimated_Time_Minutes: plan.estimated_rollback_time_minutes,
        Plan_JSON: JSON.stringify(plan),
        Status: 'Ready',
        Created_Date: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn('Failed to save rollback plan to Airtable', { error: err.message });
    }

    // Save as local file for quick access during incidents
    const rollbackDir = path.join(__dirname, 'rollback-plans');
    if (!fs.existsSync(rollbackDir)) {
      fs.mkdirSync(rollbackDir, { recursive: true });
    }
    const rollbackPath = path.join(rollbackDir, `rollback-${version}.json`);
    fs.writeFileSync(rollbackPath, JSON.stringify(plan, null, 2));
    logger.info(`Rollback plan saved to ${rollbackPath}`);

    logger.info(
      `Rollback plan generated: ${version} -> ${previousVersion} | risk=${plan.risk_level} | est. ${plan.estimated_rollback_time_minutes}min`
    );

    return plan;
  } catch (err) {
    logger.error(`Failed to generate rollback plan for ${version}`, { error: err.message });
    return {
      version,
      rollback_to: releaseContext.previousVersion || 'unknown',
      risk_level: 'unknown',
      rollback_steps: [{ step: 1, action: 'Manual rollback required - plan generation failed' }],
    };
  }
}

// ============================================================
// Deployment Window Scheduling
// ============================================================

/**
 * Schedule an optimal deployment window based on traffic patterns,
 * team availability, and risk level.
 *
 * @param {string} version - Version to deploy
 * @param {string} riskLevel - "low" | "medium" | "high" | "critical"
 * @param {Object} [constraints] - Scheduling constraints
 * @returns {Promise<Object>} Recommended deployment window with schedule
 */
async function scheduleDeploymentWindow(version, riskLevel = 'medium', constraints = {}) {
  logger.info(`Scheduling deployment window for ${version} (risk: ${riskLevel})`);

  try {
    const riskConfig = RISK_LEVELS[riskLevel] || RISK_LEVELS.medium;

    const schedule = await generateJSON(
      `Recommend an optimal deployment window for this release.

Release: ${version}
Risk level: ${riskLevel} (${riskConfig.label})
Required monitoring period: ${riskConfig.monitoringHours} hours
Rollback threshold: ${riskConfig.rollbackThresholdMinutes} minutes
Current date/time: ${new Date().toISOString()}
Timezone: Europe/Zurich (CET/CEST)

Constraints:
- Blackout dates: ${JSON.stringify(constraints.blackoutDates || [])}
- Preferred days: ${JSON.stringify(constraints.preferredDays || ['Tuesday', 'Wednesday', 'Thursday'])}
- Team availability: ${constraints.teamAvailability || 'Standard business hours CET'}
- Avoid Fridays and weekends for medium/high risk deploys
- Swiss public holidays should be avoided

Return JSON with:
- primary_window: {
    date: ISO date string,
    start_time: "HH:MM" (CET),
    end_time: "HH:MM" (CET),
    day_of_week: string,
    rationale: why this window was chosen
  }
- backup_window: same structure as primary
- pre_deployment_checklist_time: "HH:MM" (when to start pre-deploy checks)
- monitoring_end_time: when monitoring period ends
- team_required: array of { role, availability_required: "during_deploy" | "on_call" | "monitoring" }
- go_no_go_meeting_time: when to hold the go/no-go decision meeting
- communication_schedule: array of { time, action, audience }
- conflict_warnings: array of potential conflicts with the scheduled window`,
      { model: config.models.fast, maxTokens: 1024 }
    );

    // Save deployment window
    try {
      await createRecord(TABLES.DEPLOYMENT_WINDOWS, {
        Version: version,
        Risk_Level: riskLevel,
        Scheduled_Date: schedule.primary_window?.date,
        Start_Time: schedule.primary_window?.start_time,
        End_Time: schedule.primary_window?.end_time,
        Backup_Date: schedule.backup_window?.date,
        Monitoring_Hours: riskConfig.monitoringHours,
        Status: 'Scheduled',
        Created_Date: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn('Failed to save deployment window', { error: err.message });
    }

    logger.info(
      `Deployment window scheduled: ${version} | ${schedule.primary_window?.date} ${schedule.primary_window?.start_time}-${schedule.primary_window?.end_time} CET`
    );

    return schedule;
  } catch (err) {
    logger.error(`Failed to schedule deployment window for ${version}`, { error: err.message });
    return {
      primary_window: null,
      backup_window: null,
      error: 'Failed to schedule deployment window',
    };
  }
}

// ============================================================
// Feature Flag Management
// ============================================================

/**
 * Manage feature flags for a release, including creation, rollout strategies,
 * and cleanup of old flags.
 *
 * @param {string} version - Release version
 * @returns {Promise<Object>} Feature flag management results
 */
async function manageFeatureFlags(version) {
  logger.info(`Managing feature flags for ${version}`);

  try {
    // Get features in this release that need flags
    const releaseItems = await getRecords(
      TABLES.RELEASE_ITEMS,
      `AND({Release_Version} = "${version}", {Needs_Feature_Flag} = TRUE())`,
      20
    );

    // Get existing feature flags
    const existingFlags = await getRecords(TABLES.FEATURE_FLAGS, '', 100);

    const flagResults = {
      created: [],
      updated: [],
      readyForCleanup: [],
    };

    // Create new flags for release items
    for (const item of releaseItems) {
      try {
        const flagName = `ff_${(item.Name || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

        const existingFlag = existingFlags.find((f) => f.Name === flagName);

        if (!existingFlag) {
          // Generate rollout strategy with Claude
          const strategy = await generateJSON(
            `Recommend a feature flag rollout strategy for this feature.

Feature: ${item.Name}
Description: ${item.Description || 'No description'}
Release: ${version}
Risk level: ${item.Risk_Level || 'medium'}

Return JSON with:
- flag_name: "${flagName}"
- rollout_strategy: "immediate" | "percentage_ramp" | "canary" | "beta_group" | "internal_only"
- rollout_phases: array of { phase, percentage, duration_hours, success_criteria }
- targeting_rules: array of { condition, action } (e.g., target by client tier, region)
- kill_switch_conditions: array of conditions that should auto-disable the flag
- metrics_to_monitor: array of metrics to watch during rollout
- full_rollout_eta_days: estimated days until 100% rollout`,
            { model: config.models.fast, maxTokens: 768 }
          );

          await createRecord(TABLES.FEATURE_FLAGS, {
            Name: flagName,
            Feature: item.Name,
            Release_Version: version,
            Rollout_Strategy: strategy.rollout_strategy,
            Rollout_Phases: JSON.stringify(strategy.rollout_phases || []),
            Current_Phase: 0,
            Current_Percentage: 0,
            Enabled: false,
            Kill_Switch_Conditions: JSON.stringify(strategy.kill_switch_conditions || []),
            Metrics_To_Monitor: JSON.stringify(strategy.metrics_to_monitor || []),
            Configured: true,
            Created_Date: new Date().toISOString().split('T')[0],
          });

          flagResults.created.push({ flag: flagName, strategy: strategy.rollout_strategy });
          logger.info(`Feature flag created: ${flagName} | strategy=${strategy.rollout_strategy}`);
        } else {
          flagResults.updated.push({ flag: flagName, status: 'already exists' });
        }
      } catch (err) {
        logger.warn(`Failed to manage feature flag for: ${item.Name}`, { error: err.message });
      }
    }

    // Identify old flags ready for cleanup (fully rolled out for 30+ days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    for (const flag of existingFlags) {
      if (
        flag.Current_Percentage === 100 &&
        flag.Full_Rollout_Date &&
        flag.Full_Rollout_Date <= thirtyDaysAgo
      ) {
        flagResults.readyForCleanup.push({
          flag: flag.Name,
          feature: flag.Feature,
          fullRolloutDate: flag.Full_Rollout_Date,
        });
      }
    }

    if (flagResults.readyForCleanup.length > 0) {
      logger.info(
        `Feature flags ready for cleanup: ${flagResults.readyForCleanup.map((f) => f.flag).join(', ')}`
      );
    }

    logger.info(
      `Feature flag management: ${flagResults.created.length} created | ${flagResults.updated.length} updated | ${flagResults.readyForCleanup.length} ready for cleanup`
    );

    return flagResults;
  } catch (err) {
    logger.error(`Failed to manage feature flags for ${version}`, { error: err.message });
    return { created: [], updated: [], readyForCleanup: [] };
  }
}

// ============================================================
// Post-Release Monitoring Triggers
// ============================================================

/**
 * Set up post-release monitoring triggers and alerting rules.
 * Defines what to watch, threshold values, and escalation paths.
 *
 * @param {string} version - Deployed version
 * @param {string} riskLevel - "low" | "medium" | "high" | "critical"
 * @returns {Promise<Object>} Monitoring configuration with triggers and alerts
 */
async function setupPostReleaseMonitoring(version, riskLevel = 'medium') {
  logger.info(`Setting up post-release monitoring for ${version} (risk: ${riskLevel})`);

  try {
    const riskConfig = RISK_LEVELS[riskLevel] || RISK_LEVELS.medium;

    // Get changes in this release for context
    const releaseItems = await getRecords(
      TABLES.RELEASE_ITEMS,
      `{Release_Version} = "${version}"`,
      30
    );

    const monitoring = await generateJSON(
      `Define post-release monitoring configuration for this deployment.

Release: ${version}
Risk level: ${riskLevel}
Monitoring period: ${riskConfig.monitoringHours} hours
Rollback threshold: ${riskConfig.rollbackThresholdMinutes} minutes

Release items:
${JSON.stringify(releaseItems.slice(0, 15).map((r) => ({
  name: r.Name,
  type: r.Type,
  component: r.Component,
})), null, 2)}

Return JSON with:
- monitoring_duration_hours: ${riskConfig.monitoringHours}
- start_time: when monitoring starts (assume deployment just completed)
- end_time: when monitoring period ends
- metrics: array of {
    name: metric name,
    type: "counter" | "gauge" | "histogram",
    baseline: expected normal value/range,
    warning_threshold: value that triggers a warning,
    critical_threshold: value that triggers critical alert / rollback consideration,
    check_interval_seconds: how often to check
  }
- alerts: array of {
    name: alert name,
    condition: human-readable condition description,
    severity: "info" | "warning" | "critical" | "page",
    notification_channels: array of "email" | "slack" | "pagerduty" | "sms",
    auto_rollback: boolean (should this trigger automatic rollback?)
  }
- health_checks: array of {
    endpoint: path to check,
    expected_status: 200,
    timeout_ms: number,
    interval_seconds: number
  }
- canary_checks: array of specific user journeys to verify
- escalation_matrix: array of { level, condition, action, notify }
- rollback_decision_criteria: array of conditions that collectively warrant a rollback
- all_clear_criteria: conditions that must be met to declare the release successful
- post_monitoring_tasks: array of tasks to perform after monitoring period ends`,
      { model: config.models.standard, maxTokens: 2500 }
    );

    // Save monitoring config
    try {
      for (const alert of monitoring.alerts || []) {
        await createRecord(TABLES.MONITORING_ALERTS, {
          Version: version,
          Alert_Name: alert.name,
          Condition: alert.condition,
          Severity: alert.severity,
          Auto_Rollback: alert.auto_rollback || false,
          Notification_Channels: JSON.stringify(alert.notification_channels || []),
          Status: 'Active',
          Created_Date: new Date().toISOString(),
        });
      }
    } catch (err) {
      logger.warn('Failed to save monitoring alerts', { error: err.message });
    }

    // Save full config locally
    const monitoringDir = path.join(__dirname, 'monitoring-configs');
    if (!fs.existsSync(monitoringDir)) {
      fs.mkdirSync(monitoringDir, { recursive: true });
    }
    const configPath = path.join(monitoringDir, `monitoring-${version}.json`);
    fs.writeFileSync(configPath, JSON.stringify(monitoring, null, 2));

    logger.info(
      `Post-release monitoring configured: ${version} | ${(monitoring.metrics || []).length} metrics | ${(monitoring.alerts || []).length} alerts | ${riskConfig.monitoringHours}h window`
    );

    return monitoring;
  } catch (err) {
    logger.error(`Failed to set up monitoring for ${version}`, { error: err.message });
    return {
      monitoring_duration_hours: RISK_LEVELS.medium.monitoringHours,
      metrics: [],
      alerts: [],
      health_checks: [],
      error: 'Monitoring setup failed',
    };
  }
}

// ============================================================
// Full Release Pipeline
// ============================================================

/**
 * Execute the full release preparation pipeline.
 *
 * @param {Object} options - Release options
 * @param {string} options.currentVersion - Current version
 * @param {Array} options.changes - Array of changes/commits
 * @param {Object} [options.releaseData] - Additional release data
 * @param {Object} [options.constraints] - Scheduling constraints
 * @returns {Promise<Object>} Complete release preparation results
 */
async function prepareRelease({ currentVersion, changes = [], releaseData = {}, constraints = {} }) {
  logger.info(`=== Release Preparation Pipeline for post-${currentVersion} ===`);
  const startTime = Date.now();

  try {
    // Step 1: Determine version bump
    logger.info('Step 1/6: Determining version bump...');
    const versionInfo = await determineVersionBump(changes);
    const newVersion = bumpVersion(currentVersion, versionInfo.bumpType);
    logger.info(`New version: ${newVersion} (${versionInfo.bumpType} bump)`);

    // Step 2: Generate changelog
    logger.info('Step 2/6: Generating changelog...');
    const changelog = await generateChangelog(currentVersion, newVersion, changes);

    // Step 3: Generate rollback plan
    logger.info('Step 3/6: Generating rollback plan...');
    const rollbackPlan = await generateRollbackPlan(newVersion, {
      previousVersion: currentVersion,
      changes,
    });

    // Step 4: Manage feature flags
    logger.info('Step 4/6: Managing feature flags...');
    const featureFlags = await manageFeatureFlags(newVersion);

    // Step 5: Check readiness
    logger.info('Step 5/6: Checking release readiness...');
    const readiness = await checkReleaseReadiness(newVersion, {
      ...releaseData,
      changelogGenerated: true,
      rollbackPlanReady: true,
    });

    // Step 6: Schedule deployment
    logger.info('Step 6/6: Scheduling deployment window...');
    const riskLevel = rollbackPlan.risk_level || 'medium';
    const deploymentWindow = await scheduleDeploymentWindow(newVersion, riskLevel, constraints);

    // Create release record
    try {
      await createRecord(TABLES.RELEASES, {
        Version: newVersion,
        Previous_Version: currentVersion,
        Bump_Type: versionInfo.bumpType,
        Status: readiness.go_no_go_recommendation === 'GO' ? 'Ready' : 'Blocked',
        Risk_Level: riskLevel,
        Total_Changes: changes.length,
        Changelog_Summary: changelog.summary,
        Readiness_Score: `${readiness.summary.pass}/${readiness.summary.pass + readiness.summary.warn + readiness.summary.fail}`,
        Deployment_Date: deploymentWindow.primary_window?.date || '',
        Created_Date: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn('Failed to create release record', { error: err.message });
    }

    // Send release summary email
    await sendCEOEmail({
      subject: `Release ${newVersion} Preparation: ${readiness.go_no_go_recommendation}`,
      html: `
        <h1>Release ${newVersion} - Preparation Summary</h1>
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 700px;">
          <div style="background: ${readiness.go_no_go_recommendation === 'GO' ? '#e8f5e9' : readiness.go_no_go_recommendation === 'CONDITIONAL-GO' ? '#fff8e1' : '#ffebee'}; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong>Decision: ${readiness.go_no_go_recommendation}</strong><br>
            Version: ${currentVersion} -> ${newVersion} (${versionInfo.bumpType})<br>
            Risk Level: ${riskLevel}<br>
            Changes: ${changes.length}
          </div>

          <h3>Changelog Highlights</h3>
          <p>${changelog.summary}</p>
          ${(changelog.highlights || []).length > 0
            ? `<ul>${changelog.highlights.map((h) => `<li>${typeof h === 'string' ? h : h.description || JSON.stringify(h)}</li>`).join('')}</ul>`
            : ''}

          <h3>Readiness Checklist</h3>
          ${readiness.checks.map((c) => `
            <div style="padding: 4px 0;">
              ${c.status === 'pass' ? '[PASS]' : c.status === 'fail' ? '[FAIL]' : '[WARN]'}
              ${c.name}: ${c.detail}
            </div>
          `).join('')}

          ${readiness.blocking_issues && readiness.blocking_issues.length > 0
            ? `<h3 style="color: #d32f2f;">Blocking Issues</h3><ul>${readiness.blocking_issues.map((i) => `<li>${typeof i === 'string' ? i : JSON.stringify(i)}</li>`).join('')}</ul>`
            : ''}

          <h3>Deployment</h3>
          <p>Window: ${deploymentWindow.primary_window?.date || 'TBD'} ${deploymentWindow.primary_window?.start_time || ''}-${deploymentWindow.primary_window?.end_time || ''} CET</p>
          <p>Rollback plan: ${rollbackPlan.risk_level} risk, ~${rollbackPlan.estimated_rollback_time_minutes || '?'}min to roll back</p>

          <h3>Feature Flags</h3>
          <p>Created: ${featureFlags.created.length} | Cleanup ready: ${featureFlags.readyForCleanup.length}</p>

          <hr style="margin-top: 30px;">
          <p style="color: #666; font-size: 12px;">Generated by Werkpilot Release Manager Agent</p>
        </div>
      `,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(
      `Release preparation complete in ${duration}s: ${newVersion} | ${readiness.go_no_go_recommendation}`
    );

    return {
      version: newVersion,
      previousVersion: currentVersion,
      bumpType: versionInfo.bumpType,
      changelog,
      readiness,
      rollbackPlan,
      deploymentWindow,
      featureFlags,
      duration: `${duration}s`,
    };
  } catch (err) {
    logger.error('Release preparation pipeline failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

/**
 * Main execute function - entry point for the agent.
 *
 * @param {Object} [options] - Execution options
 * @param {string} [options.workflow='check'] - 'check' | 'prepare' | 'monitor' | 'flags'
 * @param {string} [options.version] - Target version
 * @param {string} [options.currentVersion] - Current version (for prepare)
 * @param {Array} [options.changes] - Changes for the release
 * @param {string} [options.riskLevel] - Risk level for monitoring
 * @returns {Promise<Object>} Execution results
 */
async function execute({
  workflow = 'check',
  version,
  currentVersion,
  changes = [],
  riskLevel = 'medium',
  releaseData = {},
  constraints = {},
} = {}) {
  logger.info(`Release Manager executing workflow: ${workflow}`);

  const results = {};

  try {
    switch (workflow) {
      case 'check':
        if (!version) throw new Error('Version is required for readiness check');
        results.readiness = await checkReleaseReadiness(version, releaseData);
        break;
      case 'prepare':
        if (!currentVersion) throw new Error('currentVersion is required for release preparation');
        results.release = await prepareRelease({ currentVersion, changes, releaseData, constraints });
        break;
      case 'monitor':
        if (!version) throw new Error('Version is required for monitoring setup');
        results.monitoring = await setupPostReleaseMonitoring(version, riskLevel);
        break;
      case 'flags':
        if (!version) throw new Error('Version is required for feature flag management');
        results.flags = await manageFeatureFlags(version);
        break;
      case 'rollback':
        if (!version) throw new Error('Version is required for rollback plan');
        results.rollback = await generateRollbackPlan(version, {
          previousVersion: currentVersion,
          changes,
        });
        break;
      case 'changelog':
        if (!currentVersion || !version) throw new Error('currentVersion and version required');
        results.changelog = await generateChangelog(currentVersion, version, changes);
        break;
      default:
        logger.warn(`Unknown workflow: ${workflow}`);
        throw new Error(`Unknown workflow: ${workflow}. Use: check, prepare, monitor, flags, rollback, changelog`);
    }

    logger.info('Release Manager execution complete', { workflow });
    return results;
  } catch (err) {
    logger.error('Release Manager execution failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

// ============================================================
// Cron Schedules
// ============================================================

// Daily at 06:00 - check readiness for pending releases
cron.schedule('0 6 * * 1-5', () => {
  (async () => {
    try {
      const pendingReleases = await getRecords(
        TABLES.RELEASES,
        'AND({Status} = "Ready", {Deployed} != TRUE())'
      );
      for (const release of pendingReleases) {
        await checkReleaseReadiness(release.Version);
      }
    } catch (err) {
      logger.error('Cron readiness check failed', { error: err.message });
    }
  })();
});

// Every 2 hours - check feature flag cleanup candidates
cron.schedule('0 */2 * * *', () => {
  (async () => {
    try {
      const latestRelease = await getRecords(
        TABLES.RELEASES,
        '{Status} = "Deployed"',
        1
      );
      if (latestRelease.length > 0) {
        await manageFeatureFlags(latestRelease[0].Version);
      }
    } catch (err) {
      logger.error('Cron feature flag check failed', { error: err.message });
    }
  })();
});

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Main entry point
  execute,

  // Full pipeline
  prepareRelease,

  // Version management
  parseVersion,
  bumpVersion,
  determineVersionBump,

  // Changelog
  generateChangelog,

  // Readiness
  checkReleaseReadiness,

  // Rollback
  generateRollbackPlan,

  // Deployment
  scheduleDeploymentWindow,

  // Feature flags
  manageFeatureFlags,

  // Monitoring
  setupPostReleaseMonitoring,

  // Constants
  VERSION_BUMP_TYPES,
  COMMIT_PREFIXES,
  RISK_LEVELS,
};

// Run immediately if executed directly
if (require.main === module) {
  logger.info('Release Manager Agent starting (direct execution)');

  // Default: check readiness for latest pending release
  (async () => {
    try {
      const pendingReleases = await getRecords(
        TABLES.RELEASES,
        'AND({Status} != "Deployed", {Status} != "Cancelled")',
        1
      );

      if (pendingReleases.length > 0) {
        const result = await execute({
          workflow: 'check',
          version: pendingReleases[0].Version,
        });
        logger.info('Release Manager initial run complete', result);
      } else {
        logger.info('No pending releases found');
      }
    } catch (err) {
      logger.error('Release Manager Agent failed', { error: err.message });
      process.exit(1);
    }
  })();
}
