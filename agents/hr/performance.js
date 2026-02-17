/**
 * Werkpilot Agent 37 — Performance Management Agent
 *
 * Tracks and manages freelancer performance:
 * - Quality score, timeliness, and availability tracking
 * - Monthly auto-generated reviews from data
 * - Bonus calculation based on metrics
 * - Performance improvement plans for underperformers
 * - Top performer recognition
 * - Team capacity analysis
 *
 * Schedule: Weekly on Monday at 07:00 CET, monthly reviews on 1st at 08:00
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const dashboardSync = require('../shared/utils/dashboard-sync');
const config = require('../shared/utils/config');

const logger = createLogger('hr-performance');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AIRTABLE_TABLES = {
  freelancers: 'Freelancers',
  performanceReviews: 'PerformanceReviews',
  performanceLogs: 'PerformanceLogs',
  bonuses: 'Bonuses',
  improvementPlans: 'ImprovementPlans',
  capacityLog: 'CapacityLog',
  tasks: 'Tasks',
  clientFeedback: 'ClientFeedback',
};

const METRICS_PATH = path.join(__dirname, 'performance-metrics.json');

/**
 * Load performance metrics configuration.
 */
function loadMetricsConfig() {
  if (!fs.existsSync(METRICS_PATH)) {
    logger.warn('Performance metrics config not found, using defaults');
    return getDefaultMetrics();
  }
  return JSON.parse(fs.readFileSync(METRICS_PATH, 'utf-8'));
}

function getDefaultMetrics() {
  return {
    weights: { quality: 0.35, timeliness: 0.25, availability: 0.15, clientFeedback: 0.25 },
    tiers: {
      A: { min: 90, label: 'Top Performer', bonusMultiplier: 1.15 },
      B: { min: 75, label: 'Strong Performer', bonusMultiplier: 1.05 },
      C: { min: 60, label: 'Meets Expectations', bonusMultiplier: 1.0 },
      D: { min: 40, label: 'Needs Improvement', bonusMultiplier: 0.95 },
      F: { min: 0, label: 'Under Review', bonusMultiplier: 0.0 },
    },
  };
}

// ---------------------------------------------------------------------------
// Automated Performance Scoring from Real Data
// ---------------------------------------------------------------------------

/**
 * Calculate task completion rate for a freelancer.
 */
async function calculateTaskCompletionRate(freelancerId, lookbackDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  const tasks = await getRecords(
    AIRTABLE_TABLES.tasks,
    `AND({FreelancerId} = '${freelancerId}', {AssignedAt} > '${cutoffDate.toISOString()}')`,
    200
  );

  if (tasks.length === 0) return { rate: 100, completed: 0, total: 0 };

  const completed = tasks.filter(t => t.Status === 'completed' || t.Status === 'done').length;
  const rate = Math.round((completed / tasks.length) * 100);

  return { rate, completed, total: tasks.length };
}

/**
 * Calculate quality score from task reviews and client feedback.
 */
async function calculateQualityScore(freelancerId, lookbackDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  // Get tasks with quality ratings
  const tasks = await getRecords(
    AIRTABLE_TABLES.tasks,
    `AND({FreelancerId} = '${freelancerId}', {CompletedAt} > '${cutoffDate.toISOString()}', {QualityRating} != '')`,
    100
  );

  // Get client feedback
  const feedback = await getRecords(
    AIRTABLE_TABLES.clientFeedback,
    `AND({FreelancerId} = '${freelancerId}', {ReceivedAt} > '${cutoffDate.toISOString()}')`,
    50
  );

  if (tasks.length === 0 && feedback.length === 0) return { score: 0, source: 'no-data' };

  // Average task quality ratings (0-5 scale converted to 0-100)
  const taskQualityAvg = tasks.length > 0
    ? (tasks.reduce((sum, t) => sum + (t.QualityRating || 0), 0) / tasks.length) * 20
    : 0;

  // Average client feedback scores (0-5 scale converted to 0-100)
  const feedbackAvg = feedback.length > 0
    ? (feedback.reduce((sum, f) => sum + (f.Rating || 0), 0) / feedback.length) * 20
    : 0;

  // Weighted average: task quality 60%, client feedback 40%
  const score = tasks.length > 0 && feedback.length > 0
    ? Math.round((taskQualityAvg * 0.6) + (feedbackAvg * 0.4))
    : tasks.length > 0
      ? Math.round(taskQualityAvg)
      : Math.round(feedbackAvg);

  return {
    score,
    taskQualityAvg: Math.round(taskQualityAvg),
    feedbackAvg: Math.round(feedbackAvg),
    tasksReviewed: tasks.length,
    feedbackCount: feedback.length,
  };
}

/**
 * Calculate response time score based on task acceptance and message response times.
 */
async function calculateResponseTimeScore(freelancerId, lookbackDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  const tasks = await getRecords(
    AIRTABLE_TABLES.tasks,
    `AND({FreelancerId} = '${freelancerId}', {AssignedAt} > '${cutoffDate.toISOString()}')`,
    100
  );

  if (tasks.length === 0) return { score: 100, avgResponseHours: 0 };

  // Calculate average response time in hours
  const responseTimes = tasks
    .filter(t => t.AssignedAt && t.AcceptedAt)
    .map(t => (new Date(t.AcceptedAt) - new Date(t.AssignedAt)) / (1000 * 60 * 60));

  if (responseTimes.length === 0) return { score: 100, avgResponseHours: 0 };

  const avgResponseHours = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

  // Score based on response time: <2h = 100, <4h = 90, <8h = 80, <24h = 70, >24h = declining
  let score = 100;
  if (avgResponseHours > 24) score = Math.max(40, 70 - Math.floor((avgResponseHours - 24) / 24) * 10);
  else if (avgResponseHours > 8) score = 70;
  else if (avgResponseHours > 4) score = 80;
  else if (avgResponseHours > 2) score = 90;

  return { score, avgResponseHours: Math.round(avgResponseHours * 10) / 10 };
}

/**
 * Aggregate client feedback score.
 */
async function calculateClientFeedbackScore(freelancerId, lookbackDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  const feedback = await getRecords(
    AIRTABLE_TABLES.clientFeedback,
    `AND({FreelancerId} = '${freelancerId}', {ReceivedAt} > '${cutoffDate.toISOString()}')`,
    100
  );

  if (feedback.length === 0) return { score: 0, count: 0, avgRating: 0 };

  const avgRating = feedback.reduce((sum, f) => sum + (f.Rating || 0), 0) / feedback.length;
  const score = Math.round(avgRating * 20); // Convert 0-5 to 0-100

  return { score, count: feedback.length, avgRating: Math.round(avgRating * 10) / 10 };
}

/**
 * Automatically calculate all performance metrics for a freelancer.
 */
async function autoCalculatePerformanceMetrics(freelancer) {
  logger.info(`Auto-calculating performance metrics for ${freelancer.Name}...`);

  const [taskCompletion, qualityData, responseTime, clientFeedback] = await Promise.all([
    calculateTaskCompletionRate(freelancer.id),
    calculateQualityScore(freelancer.id),
    calculateResponseTimeScore(freelancer.id),
    calculateClientFeedbackScore(freelancer.id),
  ]);

  // Update individual metric scores
  const metrics = {
    qualityScore: qualityData.score,
    timelinessScore: taskCompletion.rate,
    availabilityScore: responseTime.score,
    clientFeedbackScore: clientFeedback.score,
  };

  // Calculate composite
  const compositeScore = calculateCompositeScore(metrics);

  // Update freelancer record
  await updateRecord(AIRTABLE_TABLES.freelancers, freelancer.id, {
    QualityScore: metrics.qualityScore,
    TimelinessScore: metrics.timelinessScore,
    AvailabilityScore: metrics.availabilityScore,
    ClientFeedbackScore: metrics.clientFeedbackScore,
    CompositeScore: compositeScore,
    TasksCompleted: taskCompletion.completed,
    LastMetricsUpdate: new Date().toISOString(),
  });

  logger.info(`Metrics updated for ${freelancer.Name}: composite=${compositeScore}`);

  return {
    freelancerId: freelancer.id,
    freelancerName: freelancer.Name,
    metrics,
    compositeScore,
    details: {
      taskCompletion,
      qualityData,
      responseTime,
      clientFeedback,
    },
  };
}

// ---------------------------------------------------------------------------
// Performance Score Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate composite performance score for a freelancer.
 */
function calculateCompositeScore(metrics, weights) {
  const w = weights || loadMetricsConfig().weights;

  const quality = metrics.qualityScore || 0;
  const timeliness = metrics.timelinessScore || 0;
  const availability = metrics.availabilityScore || 0;
  const clientFeedback = metrics.clientFeedbackScore || 0;

  return Math.round(
    (quality * w.quality) +
    (timeliness * w.timeliness) +
    (availability * w.availability) +
    (clientFeedback * w.clientFeedback)
  );
}

/**
 * Determine performance tier from composite score.
 */
function getTier(compositeScore) {
  const metricsConfig = loadMetricsConfig();
  const tiers = metricsConfig.tiers;

  for (const [grade, tierConfig] of Object.entries(tiers)) {
    if (compositeScore >= tierConfig.min) {
      return { grade, ...tierConfig };
    }
  }

  return { grade: 'F', label: 'Under Review', bonusMultiplier: 0.0 };
}

/**
 * Track performance trends (improving/declining/stable).
 */
function analyzePerformanceTrend(currentScore, previousScore, twoMonthsAgoScore = null) {
  const recentTrend = currentScore - previousScore;

  let trend = 'stable';
  let trendLabel = 'Stable';
  let trendIcon = '→';

  if (Math.abs(recentTrend) < 3) {
    trend = 'stable';
    trendLabel = 'Stable';
    trendIcon = '→';
  } else if (recentTrend > 0) {
    if (twoMonthsAgoScore && currentScore > twoMonthsAgoScore) {
      trend = 'improving';
      trendLabel = 'Improving';
      trendIcon = '↗';
    } else {
      trend = 'improving';
      trendLabel = 'Recently Improved';
      trendIcon = '↑';
    }
  } else {
    if (twoMonthsAgoScore && currentScore < twoMonthsAgoScore) {
      trend = 'declining';
      trendLabel = 'Declining';
      trendIcon = '↘';
    } else {
      trend = 'declining';
      trendLabel = 'Recently Declined';
      trendIcon = '↓';
    }
  }

  return {
    trend,
    trendLabel,
    trendIcon,
    recentChange: recentTrend,
    momentum: twoMonthsAgoScore ? currentScore - twoMonthsAgoScore : recentTrend,
  };
}

/**
 * Collect and aggregate performance data for all active freelancers.
 */
async function collectPerformanceData() {
  logger.info('Collecting performance data...');

  const freelancers = await getRecords(
    AIRTABLE_TABLES.freelancers,
    "{Status} = 'active'",
    200
  );

  const performanceData = [];

  for (const f of freelancers) {
    // Auto-calculate current metrics from real data
    const metricsUpdate = await autoCalculatePerformanceMetrics(f);

    const compositeScore = metricsUpdate.compositeScore;
    const tier = getTier(compositeScore);

    // Analyze trend
    const previousComposite = f.PreviousCompositeScore || compositeScore;
    const twoMonthsAgo = f.TwoMonthsAgoScore || null;
    const trendAnalysis = analyzePerformanceTrend(compositeScore, previousComposite, twoMonthsAgo);

    performanceData.push({
      id: f.id,
      name: f.Name,
      role: f.Role,
      metrics: metricsUpdate.metrics,
      compositeScore,
      tier,
      trendAnalysis,
      tasksCompleted: metricsUpdate.details.taskCompletion.completed,
      hoursLogged: f.HoursLogged || 0,
      activeSince: f.ActiveSince,
    });
  }

  // Sort by composite score descending
  performanceData.sort((a, b) => b.compositeScore - a.compositeScore);

  logger.info(`Collected performance data for ${performanceData.length} freelancers`);
  return performanceData;
}

// ---------------------------------------------------------------------------
// Monthly Performance Reviews
// ---------------------------------------------------------------------------

/**
 * Generate a monthly performance review for a freelancer.
 */
async function generateMonthlyReview(freelancerData) {
  const prompt = `Generate a monthly performance review for a Werkpilot freelancer.

FREELANCER: ${freelancerData.name}
ROLE: ${freelancerData.role}
REVIEW PERIOD: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

PERFORMANCE METRICS:
- Quality Score: ${freelancerData.metrics.qualityScore}/100
- Timeliness Score: ${freelancerData.metrics.timelinessScore}/100
- Availability Score: ${freelancerData.metrics.availabilityScore}/100
- Client Feedback Score: ${freelancerData.metrics.clientFeedbackScore}/100
- Composite Score: ${freelancerData.compositeScore}/100
- Performance Tier: ${freelancerData.tier.grade} (${freelancerData.tier.label})
- Score Trend: ${freelancerData.trend > 0 ? '+' : ''}${freelancerData.trend} from last month
- Tasks Completed: ${freelancerData.tasksCompleted}
- Hours Logged: ${freelancerData.hoursLogged}

Generate a professional performance review with:
{
  "summary": "2-3 sentence executive summary",
  "strengths": ["specific strength 1", "specific strength 2"],
  "areasForImprovement": ["specific area 1", "specific area 2"],
  "goalsNextMonth": ["goal 1", "goal 2", "goal 3"],
  "detailedFeedback": "3-4 paragraph detailed review",
  "managerNotes": "internal notes for the manager",
  "overallRating": "${freelancerData.tier.label}",
  "retentionRisk": "low|medium|high",
  "recommendedActions": ["action1", "action2"]
}`;

  const review = await generateJSON(prompt, {
    system: 'You are an experienced people manager providing constructive, data-driven performance reviews. Be specific, fair, and growth-oriented.',
    model: config.models.standard,
    maxTokens: 2000,
  });

  logger.info(`Generated review for ${freelancerData.name}: ${review.overallRating}`);
  return review;
}

/**
 * Run monthly reviews for all active freelancers.
 */
async function runMonthlyReviews() {
  logger.info('=== Running Monthly Performance Reviews ===');

  const performanceData = await collectPerformanceData();
  const reviews = [];

  for (const freelancer of performanceData) {
    try {
      const review = await generateMonthlyReview(freelancer);

      // Save to Airtable
      await createRecord(AIRTABLE_TABLES.performanceReviews, {
        FreelancerName: freelancer.name,
        FreelancerId: freelancer.id,
        Role: freelancer.role,
        ReviewPeriod: new Date().toISOString().substring(0, 7), // YYYY-MM
        CompositeScore: freelancer.compositeScore,
        Tier: freelancer.tier.grade,
        Summary: review.summary,
        Strengths: review.strengths.join('; '),
        AreasForImprovement: review.areasForImprovement.join('; '),
        Goals: review.goalsNextMonth.join('; '),
        DetailedFeedback: review.detailedFeedback,
        RetentionRisk: review.retentionRisk,
        Status: 'draft',
        CreatedAt: new Date().toISOString(),
      });

      // Update freelancer record with latest composite
      await updateRecord(AIRTABLE_TABLES.freelancers, freelancer.id, {
        CompositeScore: freelancer.compositeScore,
        PerformanceTier: `${freelancer.tier.grade} - ${freelancer.tier.label}`,
        PreviousCompositeScore: freelancer.compositeScore,
        LastReviewedAt: new Date().toISOString(),
      });

      reviews.push({
        name: freelancer.name,
        score: freelancer.compositeScore,
        tier: freelancer.tier.grade,
        retentionRisk: review.retentionRisk,
      });

      // Flag underperformers for improvement plans
      if (freelancer.tier.grade === 'D' || freelancer.tier.grade === 'F') {
        await createImprovementPlan(freelancer, review);
      }
    } catch (err) {
      logger.error(`Failed to generate review for ${freelancer.name}: ${err.message}`);
    }
  }

  logger.info(`Completed ${reviews.length} monthly reviews`);
  return reviews;
}

// ---------------------------------------------------------------------------
// Bonus Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate monthly bonuses based on performance.
 */
async function calculateBonuses(month = null) {
  const period = month || new Date().toISOString().substring(0, 7);
  logger.info(`Calculating bonuses for period: ${period}`);

  const performanceData = await collectPerformanceData();
  const metricsConfig = loadMetricsConfig();
  const bonuses = [];

  for (const freelancer of performanceData) {
    const baseRate = freelancer.hoursLogged * (freelancer.metrics.hourlyRate || 0);
    const bonusMultiplier = freelancer.tier.bonusMultiplier;
    const bonusAmount = Math.round((bonusMultiplier - 1.0) * baseRate * 100) / 100;

    if (bonusAmount > 0) {
      try {
        await createRecord(AIRTABLE_TABLES.bonuses, {
          FreelancerName: freelancer.name,
          FreelancerId: freelancer.id,
          Period: period,
          CompositeScore: freelancer.compositeScore,
          Tier: freelancer.tier.grade,
          BonusMultiplier: bonusMultiplier,
          BaseAmount: baseRate,
          BonusAmount: bonusAmount,
          Status: 'pending-approval',
          CreatedAt: new Date().toISOString(),
        });

        bonuses.push({
          name: freelancer.name,
          tier: freelancer.tier.grade,
          bonusAmount,
          bonusMultiplier,
        });
      } catch (err) {
        logger.error(`Failed to create bonus record for ${freelancer.name}: ${err.message}`);
      }
    }
  }

  const totalBonuses = bonuses.reduce((sum, b) => sum + b.bonusAmount, 0);
  logger.info(`Calculated ${bonuses.length} bonuses totaling CHF ${totalBonuses.toFixed(2)}`);
  return { bonuses, totalAmount: totalBonuses, period };
}

// ---------------------------------------------------------------------------
// Performance Improvement Plans
// ---------------------------------------------------------------------------

/**
 * Create a performance improvement plan for an underperformer.
 */
async function createImprovementPlan(freelancerData, review) {
  const prompt = `Create a Performance Improvement Plan (PIP) for a Werkpilot freelancer.

FREELANCER: ${freelancerData.name}
ROLE: ${freelancerData.role}
CURRENT SCORE: ${freelancerData.compositeScore}/100 (Tier: ${freelancerData.tier.grade})
REVIEW SUMMARY: ${review.summary}
AREAS FOR IMPROVEMENT: ${review.areasForImprovement.join(', ')}

Create a structured 30-day PIP:
{
  "objective": "clear improvement objective",
  "targetScore": <target composite score>,
  "timeline": "30 days",
  "milestones": [
    {"week": 1, "goals": ["goal1", "goal2"], "checkIn": "what to review"},
    {"week": 2, "goals": ["goal1", "goal2"], "checkIn": "what to review"},
    {"week": 3, "goals": ["goal1", "goal2"], "checkIn": "what to review"},
    {"week": 4, "goals": ["goal1", "goal2"], "checkIn": "final assessment"}
  ],
  "supportProvided": ["resource1", "resource2"],
  "successCriteria": ["criterion1", "criterion2"],
  "consequenceOfNonImprovement": "clear but fair statement",
  "managerActions": ["action1", "action2"]
}`;

  const plan = await generateJSON(prompt, {
    system: 'You are an HR performance specialist. Create fair, supportive, and actionable improvement plans.',
    model: config.models.standard,
    maxTokens: 2000,
  });

  await createRecord(AIRTABLE_TABLES.improvementPlans, {
    FreelancerName: freelancerData.name,
    FreelancerId: freelancerData.id,
    Role: freelancerData.role,
    CurrentScore: freelancerData.compositeScore,
    TargetScore: plan.targetScore,
    Objective: plan.objective,
    Plan: JSON.stringify(plan),
    StartDate: new Date().toISOString(),
    EndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    Status: 'active',
  });

  logger.info(`Created improvement plan for ${freelancerData.name} (target: ${plan.targetScore})`);
  return plan;
}

// ---------------------------------------------------------------------------
// Top Performer Recognition
// ---------------------------------------------------------------------------

/**
 * Identify and recognize top performers.
 */
async function recognizeTopPerformers() {
  const performanceData = await collectPerformanceData();
  const topPerformers = performanceData.filter(f => f.tier.grade === 'A');

  if (topPerformers.length === 0) {
    logger.info('No top performers to recognize this period');
    return [];
  }

  const recognitions = [];

  for (const performer of topPerformers) {
    const prompt = `Write a brief recognition message for a top-performing freelancer at Werkpilot.

NAME: ${performer.name}
ROLE: ${performer.role}
COMPOSITE SCORE: ${performer.compositeScore}/100
KEY HIGHLIGHTS:
- Quality: ${performer.metrics.qualityScore}/100
- Timeliness: ${performer.metrics.timelinessScore}/100
- Tasks Completed: ${performer.tasksCompleted}

Write a warm, specific 2-3 sentence recognition message. Be genuine, not generic.`;

    try {
      const message = await generateText(prompt, {
        model: config.models.fast,
        maxTokens: 200,
      });

      recognitions.push({
        name: performer.name,
        role: performer.role,
        score: performer.compositeScore,
        message,
      });
    } catch (err) {
      logger.error(`Failed to generate recognition for ${performer.name}: ${err.message}`);
    }
  }

  logger.info(`Recognized ${recognitions.length} top performers`);
  return recognitions;
}

// ---------------------------------------------------------------------------
// Team Capacity Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze team capacity and identify gaps.
 */
async function analyzeTeamCapacity() {
  logger.info('Analyzing team capacity...');

  const freelancers = await getRecords(
    AIRTABLE_TABLES.freelancers,
    "{Status} = 'active'",
    200
  );

  const capacityByRole = {};

  for (const f of freelancers) {
    const role = f.Role || 'unassigned';
    if (!capacityByRole[role]) {
      capacityByRole[role] = {
        count: 0,
        totalHoursAvailable: 0,
        totalHoursUsed: 0,
        averageScore: 0,
        scores: [],
      };
    }

    const roleData = capacityByRole[role];
    roleData.count++;
    roleData.totalHoursAvailable += f.WeeklyHoursAvailable || 20;
    roleData.totalHoursUsed += f.WeeklyHoursUsed || 0;
    roleData.scores.push(f.CompositeScore || 0);
  }

  // Calculate averages and utilization
  for (const [role, data] of Object.entries(capacityByRole)) {
    data.averageScore = data.scores.length > 0
      ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
      : 0;
    data.utilization = data.totalHoursAvailable > 0
      ? Math.round((data.totalHoursUsed / data.totalHoursAvailable) * 100)
      : 0;
    delete data.scores;
  }

  // AI analysis of capacity
  const prompt = `Analyze this team capacity data for Werkpilot and provide insights.

CAPACITY DATA BY ROLE:
${JSON.stringify(capacityByRole, null, 2)}

Provide:
{
  "overallUtilization": <percentage>,
  "bottlenecks": ["roles that are over-capacity"],
  "underutilized": ["roles with significant spare capacity"],
  "hiringRecommendations": ["role to hire for and why"],
  "riskAreas": ["capacity risks to flag"],
  "summary": "2-3 sentence executive summary"
}`;

  const analysis = await generateJSON(prompt, {
    model: config.models.fast,
    maxTokens: 1000,
  });

  // Log capacity snapshot
  await createRecord(AIRTABLE_TABLES.capacityLog, {
    Date: new Date().toISOString(),
    Data: JSON.stringify(capacityByRole),
    Analysis: JSON.stringify(analysis),
    OverallUtilization: analysis.overallUtilization,
  });

  logger.info(`Capacity analysis: ${analysis.summary}`);
  return { capacityByRole, analysis };
}

// ---------------------------------------------------------------------------
// Main Weekly Run
// ---------------------------------------------------------------------------

/**
 * Generate weekly performance summary.
 */
async function generateWeeklyPerformanceSummary(performanceData) {
  const improving = performanceData.filter(f => f.trendAnalysis.trend === 'improving');
  const declining = performanceData.filter(f => f.trendAnalysis.trend === 'declining');
  const underperformers = performanceData.filter(f => f.tier.grade === 'D' || f.tier.grade === 'F');

  const summary = {
    totalFreelancers: performanceData.length,
    averageScore: Math.round(performanceData.reduce((s, f) => s + f.compositeScore, 0) / performanceData.length),
    improving: improving.length,
    declining: declining.length,
    underperformers: underperformers.length,
    topPerformers: performanceData.filter(f => f.tier.grade === 'A').length,
    generatedAt: new Date().toISOString(),
  };

  return summary;
}

async function runWeekly() {
  const startTime = Date.now();
  logger.info('=== Performance Agent: Weekly Run Starting ===');

  try {
    // Step 1: Collect and update performance data
    const performanceData = await collectPerformanceData();

    // Step 2: Update all freelancer records with trend data
    for (const f of performanceData) {
      try {
        await updateRecord(AIRTABLE_TABLES.freelancers, f.id, {
          CompositeScore: f.compositeScore,
          PerformanceTier: `${f.tier.grade} - ${f.tier.label}`,
          PerformanceTrend: f.trendAnalysis.trendLabel,
          TwoMonthsAgoScore: f.id.PreviousCompositeScore || f.compositeScore,
          PreviousCompositeScore: f.compositeScore,
          LastReviewedAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.warn(`Could not update ${f.name}: ${err.message}`);
      }
    }

    // Step 3: Recognize top performers
    const recognitions = await recognizeTopPerformers();

    // Step 4: Analyze capacity
    const capacity = await analyzeTeamCapacity();

    // Step 5: Generate weekly summary
    const weeklySummary = await generateWeeklyPerformanceSummary(performanceData);

    // Step 6: Identify underperformers and create improvement plans
    const underperformers = performanceData.filter(f => f.tier.grade === 'D' || f.tier.grade === 'F');
    for (const underperformer of underperformers) {
      const existingPlan = await getRecords(
        AIRTABLE_TABLES.improvementPlans,
        `AND({FreelancerId} = '${underperformer.id}', {Status} = 'active')`,
        1
      );

      // Only create new plan if none exists
      if (existingPlan.length === 0) {
        await createImprovementPlan(underperformer, {
          summary: `Performance score: ${underperformer.compositeScore}/100`,
          areasForImprovement: ['Quality', 'Timeliness', 'Client Feedback'].filter((_, i) =>
            Object.values(underperformer.metrics)[i] < 60
          ),
        });
      }
    }

    // Step 7: Check if it's the first of the month for monthly reviews
    const today = new Date();
    let monthlyReviewResults = null;
    let bonusResults = null;

    if (today.getDate() === 1) {
      monthlyReviewResults = await runMonthlyReviews();
      bonusResults = await calculateBonuses();
    }

    // Step 8: Sync to dashboard
    try {
      await dashboardSync.bulkSync({
        agents: [{
          name: 'hr-performance',
          status: 'active',
          score: weeklySummary.averageScore,
          tasksToday: performanceData.length,
          errorsToday: 0,
        }],
        notifications: [
          ...underperformers.length > 0 ? [{
            title: 'Underperformers Detected',
            message: `${underperformers.length} freelancers need performance improvement plans`,
            type: 'warning',
            link: '/hr/performance',
          }] : [],
          ...capacity.analysis.bottlenecks.length > 0 ? [{
            title: 'Capacity Bottlenecks',
            message: capacity.analysis.bottlenecks.join(', '),
            type: 'warning',
            link: '/hr/capacity',
          }] : [],
        ],
      });

      logger.info('Dashboard sync completed for performance metrics');
    } catch (syncErr) {
      logger.warn(`Dashboard sync failed: ${syncErr.message}`);
    }

    // Step 9: Send summary
    await sendCEOEmail({
      subject: `Performance Weekly Report${monthlyReviewResults ? ' + Monthly Reviews' : ''}`,
      html: buildWeeklyReportEmail(performanceData, recognitions, capacity, monthlyReviewResults, bonusResults, weeklySummary),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Performance Agent: Weekly Run Complete in ${elapsed}s ===`);

    return {
      success: true,
      elapsed,
      freelancersTracked: performanceData.length,
      topPerformers: recognitions.length,
      underperformers: underperformers.length,
      utilization: capacity.analysis.overallUtilization,
      monthlyReviews: monthlyReviewResults ? monthlyReviewResults.length : 0,
      weeklySummary,
    };
  } catch (err) {
    logger.error(`Performance Agent weekly run failed: ${err.message}`, { stack: err.stack });

    try {
      await sendCEOEmail({
        subject: 'Performance Agent ERROR',
        html: `<div style="font-family:sans-serif;padding:20px;background:#fff3f3;border-left:4px solid #e94560;">
          <h2>Performance Agent Failed</h2>
          <p><strong>Error:</strong> ${err.message}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString('de-CH')}</p>
        </div>`,
      });

      // Sync error to dashboard
      await dashboardSync.syncAgentStatus('hr-performance', 'error', 0, 0, 1);
    } catch (emailErr) {
      logger.error(`Could not send error notification: ${emailErr.message}`);
    }

    return { success: false, error: err.message };
  }
}

/**
 * Build the weekly report email.
 */
function buildWeeklyReportEmail(performanceData, recognitions, capacity, monthlyReviews, bonuses, weeklySummary = null) {
  const tierCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const f of performanceData) {
    tierCounts[f.tier.grade] = (tierCounts[f.tier.grade] || 0) + 1;
  }

  const avgScore = weeklySummary ? weeklySummary.averageScore : (performanceData.length > 0
    ? Math.round(performanceData.reduce((s, f) => s + f.compositeScore, 0) / performanceData.length)
    : 0);

  const trending = {
    improving: performanceData.filter(f => f.trendAnalysis.trend === 'improving'),
    declining: performanceData.filter(f => f.trendAnalysis.trend === 'declining'),
  };

  return `
    <div style="font-family:'Segoe UI',sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">Performance Weekly Report</h1>
        <p style="margin:5px 0 0;opacity:0.9;">${new Date().toLocaleDateString('de-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        <h2>Team Overview</h2>
        <table style="width:100%;border-collapse:collapse;margin:12px 0;">
          <tr><td>Active Freelancers</td><td style="text-align:right;font-weight:bold;">${performanceData.length}</td></tr>
          <tr><td>Average Composite Score</td><td style="text-align:right;font-weight:bold;">${avgScore}/100</td></tr>
          <tr><td>Team Utilization</td><td style="text-align:right;font-weight:bold;">${capacity.analysis.overallUtilization}%</td></tr>
        </table>

        <h3>Tier Distribution</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="background:#e8e8e8;"><th>Tier</th><th>Count</th><th>%</th></tr>
          ${Object.entries(tierCounts).map(([tier, count]) =>
            `<tr><td>Tier ${tier}</td><td>${count}</td><td>${performanceData.length > 0 ? Math.round(count/performanceData.length*100) : 0}%</td></tr>`
          ).join('')}
        </table>

        ${weeklySummary ? `
          <h3>Performance Trends</h3>
          <table style="width:100%;border-collapse:collapse;margin:12px 0;">
            <tr><td>Improving</td><td style="text-align:right;font-weight:bold;color:#28a745;">${weeklySummary.improving} ↗</td></tr>
            <tr><td>Declining</td><td style="text-align:right;font-weight:bold;color:#e94560;">${weeklySummary.declining} ↘</td></tr>
            <tr><td>Need Improvement Plans</td><td style="text-align:right;font-weight:bold;color:#ff9800;">${weeklySummary.underperformers}</td></tr>
          </table>
        ` : ''}

        ${trending.improving.length > 0 ? `
          <h2 style="color:#28a745;">Improving Performers</h2>
          ${trending.improving.slice(0, 3).map(f => `
            <div style="background:white;padding:8px;border-radius:4px;border-left:4px solid #28a745;margin:6px 0;">
              <strong>${f.name}</strong> (${f.role}): ${f.compositeScore}/100 ${f.trendAnalysis.trendIcon} (+${f.trendAnalysis.recentChange})
            </div>
          `).join('')}
        ` : ''}

        ${trending.declining.length > 0 ? `
          <h2 style="color:#e94560;">Performance Concerns</h2>
          ${trending.declining.slice(0, 3).map(f => `
            <div style="background:white;padding:8px;border-radius:4px;border-left:4px solid #e94560;margin:6px 0;">
              <strong>${f.name}</strong> (${f.role}): ${f.compositeScore}/100 ${f.trendAnalysis.trendIcon} (${f.trendAnalysis.recentChange})
            </div>
          `).join('')}
        ` : ''}

        ${recognitions.length > 0 ? `
          <h2>Top Performers</h2>
          ${recognitions.map(r => `
            <div style="background:white;padding:12px;border-radius:6px;border-left:4px solid #28a745;margin:8px 0;">
              <strong>${r.name}</strong> (${r.role}) - Score: ${r.score}/100<br>
              <em style="color:#666;">${r.message}</em>
            </div>
          `).join('')}
        ` : ''}

        ${capacity.analysis.bottlenecks.length > 0 ? `
          <h2 style="color:#e94560;">Capacity Alerts</h2>
          <ul>${capacity.analysis.bottlenecks.map(b => `<li>${b}</li>`).join('')}</ul>
        ` : ''}

        ${capacity.analysis.hiringRecommendations.length > 0 ? `
          <h2>Hiring Recommendations</h2>
          <ul>${capacity.analysis.hiringRecommendations.map(r => `<li>${r}</li>`).join('')}</ul>
        ` : ''}

        ${monthlyReviews ? `
          <h2>Monthly Reviews Completed: ${monthlyReviews.length}</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="background:#e8e8e8;"><th>Name</th><th>Score</th><th>Tier</th><th>Risk</th></tr>
            ${monthlyReviews.map(r =>
              `<tr><td>${r.name}</td><td>${r.score}</td><td>${r.tier}</td><td>${r.retentionRisk}</td></tr>`
            ).join('')}
          </table>
        ` : ''}

        ${bonuses ? `
          <h2>Bonus Calculations</h2>
          <p>Total bonuses pending approval: <strong>CHF ${bonuses.totalAmount.toFixed(2)}</strong></p>
        ` : ''}
      </div>
      <div style="text-align:center;padding:16px;color:#666;font-size:12px;">
        Werkpilot AI Performance Agent
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function start() {
  // Weekly run: Monday 07:00
  const weeklySchedule = '0 7 * * 1';
  logger.info(`Performance Agent starting. Weekly schedule: ${weeklySchedule}`);

  cron.schedule(weeklySchedule, () => {
    logger.info('Cron triggered: weekly performance run');
    runWeekly();
  }, {
    timezone: 'Europe/Zurich',
  });

  // Monthly reviews: 1st of month at 08:00
  const monthlySchedule = '0 8 1 * *';
  cron.schedule(monthlySchedule, () => {
    logger.info('Cron triggered: monthly reviews');
    runMonthlyReviews();
    calculateBonuses();
  }, {
    timezone: 'Europe/Zurich',
  });

  logger.info('Performance Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--now') || args.includes('-n')) {
    logger.info('Running performance agent immediately (manual trigger)');
    runWeekly().then(result => {
      if (result.success) {
        logger.info(`Weekly run completed: ${JSON.stringify(result)}`);
      } else {
        logger.error(`Weekly run failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else if (args.includes('--monthly-reviews')) {
    runMonthlyReviews().then(reviews => {
      logger.info(`Monthly reviews completed: ${reviews.length} reviews`);
    });
  } else if (args.includes('--bonuses')) {
    calculateBonuses().then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else if (args.includes('--capacity')) {
    analyzeTeamCapacity().then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else {
    start();
  }
}

module.exports = {
  start,
  runWeekly,
  collectPerformanceData,
  calculateCompositeScore,
  getTier,
  generateMonthlyReview,
  runMonthlyReviews,
  calculateBonuses,
  createImprovementPlan,
  recognizeTopPerformers,
  analyzeTeamCapacity,
  autoCalculatePerformanceMetrics,
  calculateTaskCompletionRate,
  calculateQualityScore,
  calculateResponseTimeScore,
  calculateClientFeedbackScore,
  analyzePerformanceTrend,
  generateWeeklyPerformanceSummary,
};
