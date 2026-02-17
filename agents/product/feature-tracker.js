/**
 * Product Department - Feature Tracker Agent
 *
 * Comprehensive feature lifecycle management including RICE scoring,
 * dependency mapping, sprint planning, user story generation,
 * A/B test tracking, adoption metrics, and roadmap timeline generation.
 *
 * Schedule: Daily feature sync, weekly sprint prep, monthly roadmap review
 *
 * @module agents/product/feature-tracker
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
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('feature-tracker');

// --- Airtable Tables ---
const TABLES = {
  FEATURES: 'Features',
  FEATURE_REQUESTS: 'Feature_Requests',
  DEPENDENCIES: 'Feature_Dependencies',
  SPRINTS: 'Sprints',
  SPRINT_ITEMS: 'Sprint_Items',
  USER_STORIES: 'User_Stories',
  AB_TESTS: 'AB_Tests',
  FEATURE_FLAGS: 'Feature_Flags',
  ADOPTION_METRICS: 'Feature_Adoption',
  ROADMAP: 'Product_Roadmap',
};

// --- RICE impact levels ---
const RICE_IMPACT_LABELS = {
  0.25: 'Minimal',
  0.5: 'Low',
  1: 'Medium',
  2: 'High',
  3: 'Massive',
};

// --- Feature status lifecycle ---
const FEATURE_STATUSES = [
  'Requested',
  'Under Review',
  'Scored',
  'Approved',
  'In Sprint',
  'In Development',
  'In QA',
  'Feature Flagged',
  'Rolled Out',
  'Measuring',
  'Shipped',
  'Archived',
];

// ============================================================
// RICE Framework - Priority Scoring
// ============================================================

/**
 * Calculate RICE priority score for a feature.
 *
 * RICE = (Reach * Impact * Confidence%) / Effort
 *
 * @param {Object} params - RICE parameters
 * @param {number} params.reach - Users affected per quarter (0-100 scale)
 * @param {number} params.impact - Impact multiplier (0.25 | 0.5 | 1 | 2 | 3)
 * @param {number} params.confidence - Confidence percentage (0-100)
 * @param {number} params.effort - Effort in person-weeks (min 0.5)
 * @returns {number} RICE score rounded to 2 decimal places
 */
function calculateRICE({ reach, impact, confidence, effort }) {
  if (!effort || effort <= 0) {
    logger.warn('RICE calculation received zero or negative effort, returning 0');
    return 0;
  }
  if (reach < 0 || confidence < 0 || confidence > 100) {
    logger.warn('RICE calculation received out-of-range parameters', { reach, confidence });
  }
  const clampedConfidence = Math.max(0, Math.min(100, confidence));
  const clampedReach = Math.max(0, reach);
  return Math.round(((clampedReach * impact * (clampedConfidence / 100)) / effort) * 100) / 100;
}

/**
 * Determine priority tier from a RICE score.
 *
 * @param {number} riceScore - The computed RICE score
 * @returns {string} Priority label (P0-P3)
 */
function determinePriority(riceScore) {
  if (riceScore >= 200) return 'P0 - Critical';
  if (riceScore >= 100) return 'P1 - High';
  if (riceScore >= 50) return 'P2 - Medium';
  if (riceScore >= 20) return 'P3 - Low';
  return 'P4 - Backlog';
}

/**
 * Use Claude to score unscored feature requests with the RICE framework.
 * Pulls context from existing features for consistency.
 *
 * @returns {Promise<Array>} Array of scored feature objects
 */
async function scoreFeatureRequests() {
  logger.info('Scoring unscored feature requests with RICE framework');

  try {
    const unscoredRequests = await getRecords(
      TABLES.FEATURE_REQUESTS,
      '{RICE_Score} = BLANK()'
    );

    if (unscoredRequests.length === 0) {
      logger.info('No unscored feature requests found');
      return [];
    }

    logger.info(`Found ${unscoredRequests.length} unscored feature requests`);

    // Fetch recently scored features for calibration context
    const recentlyScored = await getRecords(
      TABLES.FEATURE_REQUESTS,
      'AND({RICE_Score} != BLANK(), {Scored_Date} != BLANK())',
      10
    );
    const calibrationExamples = recentlyScored.slice(0, 5).map((f) => ({
      title: f.Title || f.Name,
      reach: f.Reach,
      impact: f.Impact,
      confidence: f.Confidence,
      effort: f.Effort,
      score: f.RICE_Score,
    }));

    const scored = [];

    for (const request of unscoredRequests) {
      try {
        const riceData = await generateJSON(
          `You are a product manager scoring feature requests using the RICE framework.

RICE = (Reach * Impact * Confidence%) / Effort

Feature to score:
- Title: ${request.Title || request.Name || 'Unknown'}
- Description: ${request.Description || 'No description provided'}
- Source: ${request.Source || 'Unknown'}
- Client: ${request.Client || 'Unknown'}
- Client Feedback: ${request.Client_Feedback || 'None'}
- Request Count: ${request.Vote_Count || 1} (how many times requested)
- Revenue Impact: ${request.Revenue_Impact || 'Unknown'}

${calibrationExamples.length > 0
  ? `Previously scored features for calibration:
${JSON.stringify(calibrationExamples, null, 2)}`
  : ''}

Return JSON with:
- reach: number of users affected per quarter (0-100 scale, where 100 = all users)
- impact: impact multiplier (use exactly one of: 0.25, 0.5, 1, 2, 3)
  - 0.25 = Minimal improvement
  - 0.5 = Low improvement
  - 1 = Medium improvement
  - 2 = High improvement
  - 3 = Massive improvement
- confidence: confidence in estimates as percentage (0-100)
- effort: person-weeks to implement (minimum 0.5, be realistic)
- rationale: 2-3 sentence explanation of the scoring
- risks: array of implementation risks
- quick_win: boolean, true if effort < 1 week and impact >= 1`,
          { model: config.models.fast, maxTokens: 768 }
        );

        const riceScore = calculateRICE(riceData);
        const priority = determinePriority(riceScore);

        await updateRecord(TABLES.FEATURE_REQUESTS, request.id, {
          Reach: riceData.reach,
          Impact: riceData.impact,
          Confidence: riceData.confidence,
          Effort: riceData.effort,
          RICE_Score: riceScore,
          RICE_Rationale: riceData.rationale,
          Priority: priority,
          Quick_Win: riceData.quick_win || false,
          Risks: JSON.stringify(riceData.risks || []),
          Scored_Date: new Date().toISOString().split('T')[0],
        });

        scored.push({
          feature: request.Title || request.Name,
          riceScore,
          priority,
          quickWin: riceData.quick_win || false,
          ...riceData,
        });

        logger.info(
          `Scored: ${request.Title || request.Name} | RICE=${riceScore} | ${priority}${riceData.quick_win ? ' [QUICK WIN]' : ''}`
        );
      } catch (err) {
        logger.error(`Failed to score feature: ${request.Title || request.Name}`, {
          error: err.message,
        });
      }
    }

    // Log summary
    const quickWins = scored.filter((s) => s.quickWin);
    if (quickWins.length > 0) {
      logger.info(
        `Quick wins identified: ${quickWins.map((q) => q.feature).join(', ')}`
      );
    }

    return scored;
  } catch (err) {
    logger.error('Failed to score feature requests', { error: err.message });
    return [];
  }
}

// ============================================================
// Feature Dependency Mapping
// ============================================================

/**
 * Analyze features for dependencies and create a dependency graph.
 * Identifies blocking relationships, shared components, and prerequisite work.
 *
 * @returns {Promise<Object>} Dependency analysis result
 */
async function mapFeatureDependencies() {
  logger.info('Mapping feature dependencies');

  try {
    const activeFeatures = await getRecords(
      TABLES.FEATURES,
      'AND({Status} != "Archived", {Status} != "Shipped")'
    );

    if (activeFeatures.length < 2) {
      logger.info('Not enough active features to map dependencies');
      return { dependencies: [], cycles: [] };
    }

    const featureList = activeFeatures.map((f) => ({
      id: f.id,
      name: f.Name || f.Title,
      description: (f.Description || '').substring(0, 200),
      status: f.Status,
      techStack: f.Tech_Stack || '',
      componentsAffected: f.Components || '',
    }));

    const analysis = await generateJSON(
      `Analyze these features for dependencies. Identify which features block, enable, or share components with others.

Features:
${JSON.stringify(featureList, null, 2)}

Return JSON with:
- dependencies: array of {
    from_id: feature id that depends on another,
    from_name: feature name,
    to_id: feature id that is depended upon,
    to_name: feature name,
    type: "blocks" | "enables" | "shared_component" | "data_dependency" | "api_dependency",
    description: why this dependency exists,
    critical: boolean (if blocking, is it on the critical path?)
  }
- shared_components: array of { component: string, features: [feature names] }
- suggested_order: array of feature names in recommended implementation order
- parallel_groups: array of arrays of feature names that can be developed in parallel
- cycles: array of circular dependency descriptions (if any)
- risks: array of dependency-related risks`,
      { model: config.models.standard, maxTokens: 3000 }
    );

    // Persist dependencies to Airtable
    const deps = analysis.dependencies || [];
    let savedCount = 0;
    for (const dep of deps) {
      try {
        // Check if dependency already exists
        const existing = await getRecords(
          TABLES.DEPENDENCIES,
          `AND({From_Feature} = "${dep.from_name}", {To_Feature} = "${dep.to_name}")`,
          1
        );

        if (existing.length === 0) {
          await createRecord(TABLES.DEPENDENCIES, {
            From_Feature: dep.from_name,
            To_Feature: dep.to_name,
            Type: dep.type,
            Description: dep.description,
            Critical: dep.critical || false,
            Mapped_Date: new Date().toISOString().split('T')[0],
          });
          savedCount++;
        }
      } catch (err) {
        logger.warn(`Failed to save dependency: ${dep.from_name} -> ${dep.to_name}`, {
          error: err.message,
        });
      }
    }

    // Warn about cycles
    if (analysis.cycles && analysis.cycles.length > 0) {
      logger.warn(`Circular dependencies detected: ${analysis.cycles.length}`);
      for (const cycle of analysis.cycles) {
        logger.warn(`  Cycle: ${typeof cycle === 'string' ? cycle : JSON.stringify(cycle)}`);
      }
    }

    logger.info(
      `Dependency mapping complete: ${deps.length} dependencies found, ${savedCount} new saved`
    );

    return analysis;
  } catch (err) {
    logger.error('Failed to map feature dependencies', { error: err.message });
    return { dependencies: [], cycles: [] };
  }
}

// ============================================================
// Sprint Planning Integration
// ============================================================

/**
 * Generate a sprint plan by selecting the highest-value features
 * that fit within the team's capacity, respecting dependencies.
 *
 * @param {Object} options - Sprint planning options
 * @param {number} [options.capacityWeeks=10] - Total person-weeks available
 * @param {number} [options.sprintLengthDays=14] - Sprint duration in days
 * @param {string} [options.sprintName] - Custom sprint name
 * @returns {Promise<Object>} Sprint plan with selected features and schedule
 */
async function planSprint({ capacityWeeks = 10, sprintLengthDays = 14, sprintName } = {}) {
  logger.info(`Planning sprint | capacity=${capacityWeeks} person-weeks | length=${sprintLengthDays} days`);

  try {
    // Fetch scored, approved features not yet in a sprint
    const candidates = await getRecords(
      TABLES.FEATURE_REQUESTS,
      'AND({RICE_Score} != BLANK(), OR({Status} = "Approved", {Status} = "Scored"), {Sprint} = BLANK())',
      50
    );

    if (candidates.length === 0) {
      logger.info('No sprint candidates available');
      return { sprint: null, items: [] };
    }

    // Sort by RICE score descending
    candidates.sort((a, b) => (b.RICE_Score || 0) - (a.RICE_Score || 0));

    // Fetch existing dependencies
    const dependencies = await getRecords(TABLES.DEPENDENCIES, '', 200);

    const candidateData = candidates.map((c) => ({
      id: c.id,
      name: c.Title || c.Name,
      riceScore: c.RICE_Score,
      effort: c.Effort || 1,
      priority: c.Priority,
      quickWin: c.Quick_Win || false,
    }));

    const depData = dependencies.map((d) => ({
      from: d.From_Feature,
      to: d.To_Feature,
      type: d.Type,
      critical: d.Critical,
    }));

    const sprintPlan = await generateJSON(
      `You are a sprint planner. Select features for the next sprint.

Available capacity: ${capacityWeeks} person-weeks
Sprint length: ${sprintLengthDays} days

Candidate features (sorted by RICE score):
${JSON.stringify(candidateData, null, 2)}

Known dependencies:
${JSON.stringify(depData, null, 2)}

Rules:
1. Total effort of selected features must not exceed ${capacityWeeks} person-weeks
2. Respect dependencies: if A depends on B, B must be included or already shipped
3. Prioritize quick wins (low effort, high value) for early sprint momentum
4. Leave 15-20% capacity buffer for bugs and unplanned work
5. Balance between P0/P1 must-haves and P2/P3 nice-to-haves

Return JSON with:
- sprint_name: "${sprintName || `Sprint ${new Date().toISOString().split('T')[0]}`}"
- start_date: suggested start date (ISO string)
- end_date: suggested end date (ISO string)
- selected_features: array of {
    id: feature id,
    name: feature name,
    effort: person-weeks,
    priority: priority level,
    sprint_goal_contribution: how this feature contributes to the sprint goal
  }
- total_effort: sum of effort for selected features
- remaining_capacity: unused capacity (buffer)
- sprint_goal: 1-2 sentence sprint goal summarizing the theme
- deferred: array of { name, reason } for features not included
- risks: array of sprint-level risks`,
      { model: config.models.standard, maxTokens: 2048 }
    );

    // Create sprint record
    const sprint = await createRecord(TABLES.SPRINTS, {
      Name: sprintPlan.sprint_name,
      Start_Date: sprintPlan.start_date,
      End_Date: sprintPlan.end_date,
      Goal: sprintPlan.sprint_goal,
      Capacity_Weeks: capacityWeeks,
      Planned_Effort: sprintPlan.total_effort,
      Buffer: sprintPlan.remaining_capacity,
      Status: 'Planning',
      Created_Date: new Date().toISOString().split('T')[0],
    });

    // Create sprint items and update feature statuses
    const sprintItems = [];
    for (const feature of sprintPlan.selected_features || []) {
      try {
        await createRecord(TABLES.SPRINT_ITEMS, {
          Sprint: sprint.id,
          Feature: feature.name,
          Feature_ID: feature.id,
          Effort: feature.effort,
          Priority: feature.priority,
          Status: 'To Do',
          Sprint_Goal_Contribution: feature.sprint_goal_contribution,
        });

        // Update feature status
        if (feature.id) {
          await updateRecord(TABLES.FEATURE_REQUESTS, feature.id, {
            Status: 'In Sprint',
            Sprint: sprint.id,
          });
        }

        sprintItems.push(feature);
      } catch (err) {
        logger.warn(`Failed to add sprint item: ${feature.name}`, { error: err.message });
      }
    }

    logger.info(
      `Sprint planned: ${sprintPlan.sprint_name} | ${sprintItems.length} features | ${sprintPlan.total_effort}/${capacityWeeks} weeks`
    );

    return { sprint: sprintPlan, items: sprintItems };
  } catch (err) {
    logger.error('Failed to plan sprint', { error: err.message });
    return { sprint: null, items: [] };
  }
}

// ============================================================
// User Story Generation
// ============================================================

/**
 * Generate user stories from feature requests.
 * Produces stories in "As a [role], I want [goal], so that [benefit]" format
 * with acceptance criteria and story points.
 *
 * @param {string} [featureFilter] - Optional Airtable filter formula for specific features
 * @returns {Promise<Array>} Array of generated user stories
 */
async function generateUserStories(featureFilter) {
  logger.info('Generating user stories from feature requests');

  try {
    const filter = featureFilter ||
      'AND(OR({Status} = "Approved", {Status} = "In Sprint"), {Stories_Generated} != TRUE())';
    const features = await getRecords(TABLES.FEATURE_REQUESTS, filter, 20);

    if (features.length === 0) {
      logger.info('No features need user story generation');
      return [];
    }

    logger.info(`Generating user stories for ${features.length} features`);
    const allStories = [];

    for (const feature of features) {
      try {
        const stories = await generateJSON(
          `Generate user stories for this feature request. Break it into granular, implementable stories.

Feature: ${feature.Title || feature.Name}
Description: ${feature.Description || 'No description'}
Target Users: ${feature.Target_Audience || 'All users'}
Priority: ${feature.Priority || 'Unknown'}
Effort Estimate: ${feature.Effort || 'Unknown'} person-weeks

Context: Werkpilot is a Swiss AI automation company that helps SMEs automate workflows.

Generate user stories using this format. Return JSON array of stories, each with:
- title: concise story title
- story: "As a [role], I want [goal], so that [benefit]"
- acceptance_criteria: array of testable acceptance criteria (Given/When/Then format)
- story_points: fibonacci estimate (1, 2, 3, 5, 8, 13)
- priority: "Must Have" | "Should Have" | "Could Have" | "Won't Have" (MoSCoW)
- technical_notes: implementation hints for developers
- test_scenarios: array of key test scenarios
- dependencies: array of other stories this depends on (by title)

Aim for 3-8 stories per feature, depending on complexity.`,
          { model: config.models.standard, maxTokens: 3000 }
        );

        const storyArray = Array.isArray(stories) ? stories : [stories];

        for (const story of storyArray) {
          try {
            await createRecord(TABLES.USER_STORIES, {
              Title: story.title,
              Story: story.story,
              Feature: feature.Title || feature.Name,
              Feature_ID: feature.id,
              Acceptance_Criteria: JSON.stringify(story.acceptance_criteria || []),
              Story_Points: story.story_points || 3,
              MoSCoW: story.priority || 'Should Have',
              Technical_Notes: story.technical_notes || '',
              Test_Scenarios: JSON.stringify(story.test_scenarios || []),
              Status: 'New',
              Created_Date: new Date().toISOString().split('T')[0],
            });

            allStories.push({
              feature: feature.Title || feature.Name,
              ...story,
            });
          } catch (err) {
            logger.warn(`Failed to save user story: ${story.title}`, { error: err.message });
          }
        }

        // Mark feature as having stories generated
        await updateRecord(TABLES.FEATURE_REQUESTS, feature.id, {
          Stories_Generated: true,
          Story_Count: storyArray.length,
        });

        logger.info(
          `Generated ${storyArray.length} user stories for: ${feature.Title || feature.Name}`
        );
      } catch (err) {
        logger.error(`Failed to generate stories for: ${feature.Title || feature.Name}`, {
          error: err.message,
        });
      }
    }

    logger.info(`Total user stories generated: ${allStories.length}`);
    return allStories;
  } catch (err) {
    logger.error('Failed to generate user stories', { error: err.message });
    return [];
  }
}

// ============================================================
// A/B Test Tracking for Feature Flags
// ============================================================

/**
 * Track and analyze A/B tests running on feature flags.
 * Checks test status, calculates statistical significance, and recommends actions.
 *
 * @returns {Promise<Array>} Array of test analysis results
 */
async function trackABTests() {
  logger.info('Tracking A/B tests for feature flags');

  try {
    const activeTests = await getRecords(
      TABLES.AB_TESTS,
      '{Status} = "Running"'
    );

    if (activeTests.length === 0) {
      logger.info('No active A/B tests');
      return [];
    }

    logger.info(`Analyzing ${activeTests.length} active A/B tests`);
    const results = [];

    for (const test of activeTests) {
      try {
        const testAge = test.Start_Date
          ? Math.floor((Date.now() - new Date(test.Start_Date).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        const analysis = await generateJSON(
          `Analyze this A/B test and determine if we have enough data to make a decision.

Test: ${test.Name}
Feature Flag: ${test.Feature_Flag || 'Unknown'}
Hypothesis: ${test.Hypothesis || 'Not stated'}
Primary Metric: ${test.Primary_Metric || 'Conversion rate'}
Running for: ${testAge} days
Minimum runtime: ${test.Min_Runtime_Days || 14} days

Control group (A):
- Sample size: ${test.Control_Sample || 0}
- Conversions: ${test.Control_Conversions || 0}
- Rate: ${test.Control_Rate || 0}%

Treatment group (B):
- Sample size: ${test.Treatment_Sample || 0}
- Conversions: ${test.Treatment_Conversions || 0}
- Rate: ${test.Treatment_Rate || 0}%

Secondary metrics:
${test.Secondary_Metrics || 'None tracked'}

Return JSON with:
- statistical_significance: boolean (is p < 0.05?)
- confidence_level: percentage (e.g., 95.3)
- relative_improvement: percentage change from control to treatment
- absolute_improvement: absolute difference in rates
- sample_size_sufficient: boolean
- recommended_action: "continue" | "roll_out_treatment" | "roll_back" | "extend" | "redesign"
- action_rationale: explanation of recommendation
- estimated_days_remaining: if continuing, how many more days needed
- revenue_impact_estimate: estimated monthly revenue impact if rolled out
- risks: array of risks with the recommended action
- secondary_metric_impacts: array of { metric, impact, concerning: boolean }`,
          { model: config.models.standard, maxTokens: 1024 }
        );

        // Update test record
        await updateRecord(TABLES.AB_TESTS, test.id, {
          Statistical_Significance: analysis.statistical_significance,
          Confidence_Level: analysis.confidence_level,
          Relative_Improvement: analysis.relative_improvement,
          Recommended_Action: analysis.recommended_action,
          Action_Rationale: analysis.action_rationale,
          Last_Analyzed: new Date().toISOString(),
        });

        // Auto-complete tests that have clear results
        if (
          analysis.recommended_action === 'roll_out_treatment' &&
          analysis.statistical_significance &&
          testAge >= (test.Min_Runtime_Days || 14)
        ) {
          await updateRecord(TABLES.AB_TESTS, test.id, {
            Status: 'Concluded - Roll Out',
          });
          logger.info(
            `A/B test concluded (roll out): ${test.Name} | ${analysis.relative_improvement}% improvement`
          );
        } else if (
          analysis.recommended_action === 'roll_back' &&
          analysis.statistical_significance
        ) {
          await updateRecord(TABLES.AB_TESTS, test.id, {
            Status: 'Concluded - Roll Back',
          });
          logger.warn(
            `A/B test concluded (roll back): ${test.Name} | ${analysis.relative_improvement}% change`
          );
        }

        results.push({
          test: test.Name,
          featureFlag: test.Feature_Flag,
          daysRunning: testAge,
          ...analysis,
        });

        logger.info(
          `A/B test: ${test.Name} | action=${analysis.recommended_action} | significance=${analysis.statistical_significance} | improvement=${analysis.relative_improvement}%`
        );
      } catch (err) {
        logger.error(`Failed to analyze A/B test: ${test.Name}`, { error: err.message });
      }
    }

    return results;
  } catch (err) {
    logger.error('Failed to track A/B tests', { error: err.message });
    return [];
  }
}

// ============================================================
// Feature Adoption Metrics
// ============================================================

/**
 * Track and analyze adoption metrics for shipped features.
 * Measures usage rates, engagement patterns, and retention impact.
 *
 * @returns {Promise<Array>} Array of adoption metric analyses
 */
async function trackFeatureAdoption() {
  logger.info('Tracking feature adoption metrics');

  try {
    const shippedFeatures = await getRecords(
      TABLES.FEATURES,
      'AND(OR({Status} = "Shipped", {Status} = "Rolled Out"), {Adoption_Rate} = BLANK())'
    );

    if (shippedFeatures.length === 0) {
      logger.info('No features pending adoption tracking');
      return [];
    }

    const totalActiveClients = await getRecords('Clients', '{Status} = "Active"');
    const totalClientCount = totalActiveClients.length || 1;

    const adoptionData = [];

    for (const feature of shippedFeatures) {
      try {
        // Get usage records for this feature
        const usageRecords = await getRecords(
          TABLES.ADOPTION_METRICS,
          `{Feature} = "${feature.Name || feature.Title}"`
        );

        const adoptionRate = Math.round((usageRecords.length / totalClientCount) * 100);

        // Calculate usage frequency
        const activeUsers = usageRecords.filter((u) => {
          const lastUsed = u.Last_Used ? new Date(u.Last_Used) : null;
          if (!lastUsed) return false;
          const daysSinceUse = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceUse <= 30;
        });

        const activeRate = Math.round((activeUsers.length / Math.max(usageRecords.length, 1)) * 100);

        // Analyze adoption health with Claude
        const analysis = await generateJSON(
          `Analyze the adoption metrics for this feature and provide health assessment.

Feature: ${feature.Name || feature.Title}
Shipped Date: ${feature.Shipped_Date || 'Unknown'}
Total clients: ${totalClientCount}
Clients using feature: ${usageRecords.length}
Adoption rate: ${adoptionRate}%
Active users (last 30 days): ${activeUsers.length}
Active rate among adopters: ${activeRate}%

Return JSON with:
- health: "healthy" | "concerning" | "at_risk" | "failing"
- adoption_velocity: "fast" | "normal" | "slow" | "stalled"
- churn_risk: boolean, true if active rate is declining
- recommendations: array of actionable suggestions to improve adoption
- target_adoption_rate: recommended target percentage
- days_to_target: estimated days to reach target adoption
- activation_barrier: main reason users might not adopt (guess based on context)`,
          { model: config.models.fast, maxTokens: 512 }
        );

        await updateRecord(TABLES.FEATURES, feature.id, {
          Adoption_Rate: adoptionRate,
          Adoption_Count: usageRecords.length,
          Active_Users: activeUsers.length,
          Active_Rate: activeRate,
          Adoption_Health: analysis.health,
          Adoption_Velocity: analysis.adoption_velocity,
          Adoption_Tracked_Date: new Date().toISOString().split('T')[0],
        });

        adoptionData.push({
          feature: feature.Name || feature.Title,
          adoptionRate,
          activeRate,
          health: analysis.health,
          velocity: analysis.adoption_velocity,
          recommendations: analysis.recommendations,
        });

        const healthIcon = {
          healthy: 'OK',
          concerning: 'WARN',
          at_risk: 'RISK',
          failing: 'FAIL',
        }[analysis.health] || 'UNKNOWN';

        logger.info(
          `Adoption [${healthIcon}]: ${feature.Name || feature.Title} | ${adoptionRate}% adoption | ${activeRate}% active`
        );
      } catch (err) {
        logger.error(`Failed to track adoption for: ${feature.Name || feature.Title}`, {
          error: err.message,
        });
      }
    }

    // Alert on at-risk features
    const atRisk = adoptionData.filter(
      (a) => a.health === 'at_risk' || a.health === 'failing'
    );
    if (atRisk.length > 0) {
      logger.warn(
        `Features with adoption issues: ${atRisk.map((a) => `${a.feature} (${a.health})`).join(', ')}`
      );
    }

    return adoptionData;
  } catch (err) {
    logger.error('Failed to track feature adoption', { error: err.message });
    return [];
  }
}

// ============================================================
// Roadmap Timeline Generation
// ============================================================

/**
 * Generate a visual timeline of the product roadmap,
 * accounting for dependencies, team capacity, and priorities.
 *
 * @param {Object} options - Timeline generation options
 * @param {number} [options.quarters=4] - Number of quarters to project
 * @returns {Promise<Object>} Timeline data structure with quarters and milestones
 */
async function generateRoadmapTimeline({ quarters = 4 } = {}) {
  logger.info(`Generating roadmap timeline for ${quarters} quarters`);

  try {
    // Gather all relevant data
    const roadmapItems = await getRecords(
      TABLES.ROADMAP,
      '{Status} != "Archived"',
      100
    );

    const scoredFeatures = await getRecords(
      TABLES.FEATURE_REQUESTS,
      'AND({RICE_Score} != BLANK(), {Status} != "Archived")',
      50
    );

    const dependencies = await getRecords(TABLES.DEPENDENCIES, '', 100);

    // Build timeline with Claude
    const timeline = await generateJSON(
      `Generate a product roadmap timeline for the next ${quarters} quarters.

Current date: ${new Date().toISOString().split('T')[0]}

Roadmap items (already planned):
${JSON.stringify(
  roadmapItems.map((r) => ({
    name: r.Name,
    status: r.Status,
    quarter: r.Quarter,
    priority: r.Priority,
    effort: r.Effort,
    completion: r.Completion_Pct || 0,
  })),
  null,
  2
)}

Top scored features (candidates for future quarters):
${JSON.stringify(
  scoredFeatures
    .sort((a, b) => (b.RICE_Score || 0) - (a.RICE_Score || 0))
    .slice(0, 20)
    .map((f) => ({
      name: f.Title || f.Name,
      riceScore: f.RICE_Score,
      effort: f.Effort,
      priority: f.Priority,
    })),
  null,
  2
)}

Dependencies:
${JSON.stringify(
  dependencies.map((d) => ({
    from: d.From_Feature,
    to: d.To_Feature,
    type: d.Type,
    critical: d.Critical,
  })),
  null,
  2
)}

Return JSON with:
- timeline: array of quarters, each with:
  - quarter: "Q1 2026" etc.
  - theme: overarching theme for the quarter
  - features: array of { name, status, effort_weeks, start_week, end_week, milestone: boolean }
  - total_effort: sum of effort
  - key_milestones: array of { name, target_date, description }
  - dependencies_resolved: array of dependency descriptions resolved this quarter
- critical_path: array of features on the critical path (longest dependency chain)
- risks: array of timeline risks
- assumptions: array of planning assumptions made
- capacity_utilization: array of { quarter, utilized_pct } showing capacity usage per quarter`,
      { model: config.models.standard, maxTokens: 4000 }
    );

    // Save timeline snapshot
    const timelinePath = path.join(__dirname, 'roadmap-timeline.json');
    const snapshot = {
      generated: new Date().toISOString(),
      quarters,
      ...timeline,
    };
    fs.writeFileSync(timelinePath, JSON.stringify(snapshot, null, 2));
    logger.info(`Roadmap timeline saved to ${timelinePath}`);

    // Update roadmap items with timeline data
    for (const quarter of timeline.timeline || []) {
      for (const feature of quarter.features || []) {
        try {
          const existing = await getRecords(
            TABLES.ROADMAP,
            `{Name} = "${feature.name}"`,
            1
          );
          if (existing.length > 0) {
            await updateRecord(TABLES.ROADMAP, existing[0].id, {
              Planned_Quarter: quarter.quarter,
              Timeline_Start_Week: feature.start_week,
              Timeline_End_Week: feature.end_week,
              Is_Milestone: feature.milestone || false,
            });
          }
        } catch (err) {
          logger.warn(`Failed to update timeline for: ${feature.name}`, {
            error: err.message,
          });
        }
      }
    }

    logger.info(
      `Roadmap timeline generated: ${(timeline.timeline || []).length} quarters, ${(timeline.critical_path || []).length} items on critical path`
    );

    return timeline;
  } catch (err) {
    logger.error('Failed to generate roadmap timeline', { error: err.message });
    return { timeline: [], critical_path: [], risks: [] };
  }
}

// ============================================================
// Main Execution Flows
// ============================================================

/**
 * Run the daily feature tracking sync.
 * Scores new requests, checks adoption metrics, and tracks A/B tests.
 *
 * @returns {Promise<Object>} Summary of daily sync results
 */
async function runDailySync() {
  logger.info('=== Feature Tracker Daily Sync ===');
  const startTime = Date.now();

  try {
    const scored = await scoreFeatureRequests();
    const adoption = await trackFeatureAdoption();
    const abTests = await trackABTests();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const summary = {
      scored: scored.length,
      adoptionTracked: adoption.length,
      abTestsAnalyzed: abTests.length,
      duration: `${duration}s`,
    };

    logger.info(`Daily sync complete in ${duration}s`, summary);
    return summary;
  } catch (err) {
    logger.error('Daily sync failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

/**
 * Run the weekly sprint preparation workflow.
 * Maps dependencies, generates user stories, and prepares sprint plan.
 *
 * @param {Object} [options] - Sprint planning options
 * @returns {Promise<Object>} Summary of sprint prep results
 */
async function runWeeklySprintPrep(options = {}) {
  logger.info('=== Feature Tracker Weekly Sprint Prep ===');
  const startTime = Date.now();

  try {
    const dependencies = await mapFeatureDependencies();
    const stories = await generateUserStories();
    const sprint = await planSprint(options);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const summary = {
      dependencies: (dependencies.dependencies || []).length,
      cycles: (dependencies.cycles || []).length,
      stories: stories.length,
      sprintFeatures: (sprint.items || []).length,
      duration: `${duration}s`,
    };

    logger.info(`Weekly sprint prep complete in ${duration}s`, summary);
    return summary;
  } catch (err) {
    logger.error('Weekly sprint prep failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

/**
 * Run the monthly roadmap review.
 * Generates roadmap timeline and sends summary to leadership.
 *
 * @returns {Promise<Object>} Roadmap timeline data
 */
async function runMonthlyRoadmapReview() {
  logger.info('=== Feature Tracker Monthly Roadmap Review ===');
  const startTime = Date.now();

  try {
    const timeline = await generateRoadmapTimeline();

    // Send summary email
    const quarterSummaries = (timeline.timeline || [])
      .map(
        (q) => `
        <div style="border-left: 3px solid #1976d2; padding: 10px; margin: 10px 0;">
          <strong>${q.quarter}: ${q.theme || 'TBD'}</strong><br>
          Features: ${(q.features || []).map((f) => f.name).join(', ') || 'None planned'}<br>
          Milestones: ${(q.key_milestones || []).map((m) => m.name).join(', ') || 'None'}
        </div>`
      )
      .join('');

    await sendCEOEmail({
      subject: `Product Roadmap Timeline Update`,
      html: `
        <h1>Product Roadmap Timeline</h1>
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 700px;">
          ${quarterSummaries}
          ${
            timeline.critical_path && timeline.critical_path.length > 0
              ? `<h3>Critical Path</h3><p>${timeline.critical_path.join(' -> ')}</p>`
              : ''
          }
          ${
            timeline.risks && timeline.risks.length > 0
              ? `<h3>Risks</h3><ul>${timeline.risks.map((r) => `<li>${typeof r === 'string' ? r : r.description || JSON.stringify(r)}</li>`).join('')}</ul>`
              : ''
          }
          <hr style="margin-top: 30px;">
          <p style="color: #666; font-size: 12px;">Generated by Werkpilot Feature Tracker Agent</p>
        </div>
      `,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Monthly roadmap review complete in ${duration}s`);
    return timeline;
  } catch (err) {
    logger.error('Monthly roadmap review failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

/**
 * Main execute function - entry point for the agent.
 * Runs the daily sync by default, or a specific workflow if specified.
 *
 * @param {Object} [options] - Execution options
 * @param {string} [options.workflow='daily'] - Which workflow to run: 'daily' | 'sprint' | 'roadmap' | 'all'
 * @param {Object} [options.sprintOptions] - Options to pass to sprint planning
 * @returns {Promise<Object>} Execution results
 */
async function execute({ workflow = 'daily', sprintOptions = {} } = {}) {
  logger.info(`Feature Tracker executing workflow: ${workflow}`);

  const results = {};

  try {
    switch (workflow) {
      case 'daily':
        results.daily = await runDailySync();
        break;
      case 'sprint':
        results.sprint = await runWeeklySprintPrep(sprintOptions);
        break;
      case 'roadmap':
        results.roadmap = await runMonthlyRoadmapReview();
        break;
      case 'all':
        results.daily = await runDailySync();
        results.sprint = await runWeeklySprintPrep(sprintOptions);
        results.roadmap = await runMonthlyRoadmapReview();
        break;
      default:
        logger.warn(`Unknown workflow: ${workflow}, running daily sync`);
        results.daily = await runDailySync();
    }

    logger.info('Feature Tracker execution complete', results);
    return results;
  } catch (err) {
    logger.error('Feature Tracker execution failed', { error: err.message, stack: err.stack });
    throw err;
  }
}

// ============================================================
// Cron Schedules
// ============================================================

// Daily at 07:30 - score features, track adoption, analyze A/B tests
cron.schedule('30 7 * * 1-5', () => {
  runDailySync().catch((err) =>
    logger.error('Cron daily sync failed', { error: err.message })
  );
});

// Weekly on Wednesdays at 06:00 - sprint prep (dependencies, stories, planning)
cron.schedule('0 6 * * 3', () => {
  runWeeklySprintPrep().catch((err) =>
    logger.error('Cron weekly sprint prep failed', { error: err.message })
  );
});

// Monthly on the 15th at 09:00 - roadmap timeline review
cron.schedule('0 9 15 * *', () => {
  runMonthlyRoadmapReview().catch((err) =>
    logger.error('Cron monthly roadmap review failed', { error: err.message })
  );
});

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Main entry point
  execute,

  // Workflow runners
  runDailySync,
  runWeeklySprintPrep,
  runMonthlyRoadmapReview,

  // RICE scoring
  calculateRICE,
  determinePriority,
  scoreFeatureRequests,

  // Dependencies
  mapFeatureDependencies,

  // Sprint planning
  planSprint,

  // User stories
  generateUserStories,

  // A/B testing
  trackABTests,

  // Adoption
  trackFeatureAdoption,

  // Roadmap
  generateRoadmapTimeline,

  // Constants
  RICE_IMPACT_LABELS,
  FEATURE_STATUSES,
};

// Run immediately if executed directly
if (require.main === module) {
  logger.info('Feature Tracker Agent starting (direct execution)');
  execute()
    .then((results) => logger.info('Feature Tracker Agent initial run complete', results))
    .catch((err) => {
      logger.error('Feature Tracker Agent failed', { error: err.message });
      process.exit(1);
    });
}
