/**
 * Werkpilot CEO Decision Tracker Agent (v2 - Enhanced)
 *
 * A comprehensive decision management system that goes beyond simple decision
 * support by providing impact scoring, decision tree visualization, historical
 * outcome tracking, risk assessment matrices, stakeholder impact analysis,
 * deadline alerting, and dashboard API integration.
 *
 * Upgrades over decision-support.js:
 * - Decision impact scoring (1-10 weighted criteria)
 * - Decision tree visualization data output
 * - Historical decision outcome tracking with pattern learning
 * - Risk assessment matrix (probability x impact)
 * - Stakeholder impact analysis per decision
 * - Decision deadline alerting with escalation
 * - Full dashboard API sync for real-time decision status
 *
 * @module ceo/decision-tracker
 * @version 2.0.0
 * @author Werkpilot AI
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateJSON, generateText } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, updateRecord, createRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');
const dashboardClient = require('../shared/utils/dashboard-client');
const dashboardSync = require('../shared/utils/dashboard-sync');

const agentConfig = require('./config.json');
const logger = createLogger('ceo-decision-tracker');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_NAME = 'ceo-decision-tracker';
const DECISIONS_DIR = path.join(__dirname, 'decisions');
const OUTCOMES_FILE = path.join(__dirname, 'decisions', 'outcomes-history.json');
const DEADLINES_FILE = path.join(__dirname, 'decisions', 'deadlines.json');
const TIMEZONE = 'Europe/Zurich';

/**
 * @typedef {Object} ImpactScore
 * @property {number} financial - Financial impact (1-10)
 * @property {number} strategic - Strategic alignment (1-10)
 * @property {number} operational - Operational complexity (1-10)
 * @property {number} customer - Customer impact (1-10)
 * @property {number} team - Team/culture impact (1-10)
 * @property {number} risk - Risk level (1-10, higher = riskier)
 * @property {number} weighted - Weighted composite score (1-10)
 */

/**
 * @typedef {Object} RiskAssessment
 * @property {number} probability - Likelihood of negative outcome (1-5)
 * @property {number} impact - Severity if negative outcome occurs (1-5)
 * @property {number} score - probability * impact (1-25)
 * @property {string} level - 'low' | 'medium' | 'high' | 'critical'
 * @property {string[]} mitigations - Suggested risk mitigations
 */

/**
 * @typedef {Object} StakeholderImpact
 * @property {string} stakeholder - Name of the stakeholder group
 * @property {string} impact - 'positive' | 'neutral' | 'negative'
 * @property {number} severity - Impact severity (1-5)
 * @property {string} description - Description of the impact
 */

/**
 * Weight configuration for impact scoring criteria.
 * Weights should sum to 1.0.
 */
const IMPACT_WEIGHTS = {
  financial: 0.25,
  strategic: 0.25,
  operational: 0.15,
  customer: 0.20,
  team: 0.10,
  risk: 0.05,
};

/**
 * Risk matrix thresholds for categorization.
 */
const RISK_THRESHOLDS = {
  low: 5,        // score 1-5
  medium: 10,    // score 6-10
  high: 15,      // score 11-15
  critical: 25,  // score 16-25
};

/**
 * Default deadline hours by urgency level.
 */
const URGENCY_DEADLINE_HOURS = {
  critical: 1,
  high: 4,
  medium: 24,
  low: 72,
};

// ---------------------------------------------------------------------------
// File System Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the decisions directory exists.
 * @returns {void}
 */
function ensureDirectories() {
  fs.mkdirSync(DECISIONS_DIR, { recursive: true });
}

/**
 * Load a JSON file safely with a default fallback.
 * @param {string} filePath - Absolute path to the JSON file
 * @param {*} defaultValue - Default value if file doesn't exist
 * @returns {*} Parsed JSON or default value
 */
function loadJSON(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    logger.warn(`Could not load ${filePath}: ${err.message}`);
  }
  return defaultValue;
}

/**
 * Save data to a JSON file atomically.
 * @param {string} filePath - Absolute path to the JSON file
 * @param {*} data - Data to serialize
 * @returns {void}
 */
function saveJSON(filePath, data) {
  ensureDirectories();
  const tempPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    logger.error(`Failed to save ${filePath}: ${err.message}`);
    // Clean up temp file if rename failed
    try { fs.unlinkSync(tempPath); } catch (_) { /* ignore */ }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Action Handler Registry
// ---------------------------------------------------------------------------

/** @type {Object<string, Object>} */
const actionHandlers = {};

/**
 * Load category-specific action handlers from the action-handlers directory.
 * @returns {void}
 */
function loadActionHandlers() {
  const handlersDir = path.join(__dirname, 'action-handlers');
  const categories = agentConfig.decisionSupport.categories;

  for (const category of categories) {
    const handlerPath = path.join(handlersDir, `${category}.js`);
    try {
      if (fs.existsSync(handlerPath)) {
        actionHandlers[category] = require(handlerPath);
        logger.info(`Loaded action handler: ${category}`);
      } else {
        logger.warn(`No action handler found for category: ${category}`);
      }
    } catch (err) {
      logger.error(`Failed to load handler ${category}: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Impact Scoring System
// ---------------------------------------------------------------------------

/**
 * Calculate a weighted impact score for a decision using Claude analysis.
 * Scores each criterion on a 1-10 scale and computes a weighted composite.
 *
 * @param {Object} decision - The decision record from Airtable
 * @param {Object} context - Gathered context data
 * @returns {Promise<ImpactScore>} The impact score breakdown
 */
async function calculateImpactScore(decision, context) {
  logger.info(`Calculating impact score for: ${decision.Title}`);

  try {
    const prompt = `Bewerte die folgende Entscheidung auf einer Skala von 1-10 fuer jedes Kriterium.
1 = minimal, 10 = maximal.

ENTSCHEIDUNG:
- Titel: ${decision.Title || 'Unbekannt'}
- Kategorie: ${decision.Category || 'Unbekannt'}
- Beschreibung: ${decision.Description || 'Keine Beschreibung'}
- Dringlichkeit: ${decision.Urgency || 'medium'}

KONTEXT:
${JSON.stringify(context.additionalData || {}, null, 2)}

Bewerte diese Kriterien:
1. financial: Finanzieller Impact (1=vernachlaessigbar, 10=geschaeftskritisch)
2. strategic: Strategische Relevanz (1=operativ, 10=richtungsweisend)
3. operational: Operative Komplexitaet der Umsetzung (1=einfach, 10=sehr komplex)
4. customer: Kundenauswirkung (1=keine, 10=massive Auswirkung)
5. team: Team/Kultur-Auswirkung (1=keine, 10=tiefgreifend)
6. risk: Risikolevel (1=sicher, 10=hochriskant)

Antworte als JSON:
{
  "financial": 7,
  "strategic": 8,
  "operational": 5,
  "customer": 6,
  "team": 3,
  "risk": 4,
  "reasoning": {
    "financial": "Kurze Begruendung",
    "strategic": "Kurze Begruendung",
    "operational": "Kurze Begruendung",
    "customer": "Kurze Begruendung",
    "team": "Kurze Begruendung",
    "risk": "Kurze Begruendung"
  }
}`;

    const scores = await generateJSON(prompt, {
      system: 'Du bist ein erfahrener Business Analyst. Bewerte praezise und faktenbasiert. Antworte auf Deutsch als valides JSON.',
      model: agentConfig.models.decisions,
      maxTokens: 1024,
    });

    // Calculate weighted composite score
    const weighted =
      (scores.financial || 5) * IMPACT_WEIGHTS.financial +
      (scores.strategic || 5) * IMPACT_WEIGHTS.strategic +
      (scores.operational || 5) * IMPACT_WEIGHTS.operational +
      (scores.customer || 5) * IMPACT_WEIGHTS.customer +
      (scores.team || 5) * IMPACT_WEIGHTS.team +
      (scores.risk || 5) * IMPACT_WEIGHTS.risk;

    const result = {
      financial: scores.financial || 5,
      strategic: scores.strategic || 5,
      operational: scores.operational || 5,
      customer: scores.customer || 5,
      team: scores.team || 5,
      risk: scores.risk || 5,
      weighted: Math.round(weighted * 10) / 10,
      reasoning: scores.reasoning || {},
    };

    logger.info(`Impact score calculated: weighted=${result.weighted}/10`);
    return result;
  } catch (err) {
    logger.error(`Impact score calculation failed: ${err.message}`);
    return {
      financial: 5, strategic: 5, operational: 5,
      customer: 5, team: 5, risk: 5,
      weighted: 5.0,
      reasoning: { error: err.message },
    };
  }
}

// ---------------------------------------------------------------------------
// Risk Assessment Matrix
// ---------------------------------------------------------------------------

/**
 * Generate a risk assessment matrix for each decision option.
 * Uses probability (1-5) x impact (1-5) scoring.
 *
 * @param {Object} decision - The decision record
 * @param {Object[]} options - Analysis options from Claude
 * @returns {Promise<RiskAssessment[]>} Risk assessments per option
 */
async function assessRisks(decision, options) {
  logger.info(`Assessing risks for: ${decision.Title}`);

  try {
    const prompt = `Erstelle eine Risikobewertungsmatrix fuer jede Option der folgenden Entscheidung.

ENTSCHEIDUNG: ${decision.Title}
BESCHREIBUNG: ${decision.Description || 'N/A'}

OPTIONEN:
${JSON.stringify(options.map(o => ({ id: o.id, title: o.title, description: o.description })), null, 2)}

Fuer jede Option bewerte:
- probability: Wahrscheinlichkeit eines negativen Ergebnisses (1-5, 1=sehr unwahrscheinlich, 5=sehr wahrscheinlich)
- impact: Schwere bei negativem Ergebnis (1-5, 1=vernachlaessigbar, 5=geschaeftskritisch)
- mitigations: 2-3 Massnahmen zur Risikominderung

Antworte als JSON Array:
[
  {
    "optionId": "A",
    "probability": 2,
    "impact": 4,
    "mitigations": ["Massnahme 1", "Massnahme 2"],
    "keyRisk": "Hauptrisiko in einem Satz"
  }
]`;

    const risks = await generateJSON(prompt, {
      system: 'Du bist ein Risikomanagement-Experte. Bewerte praezise. Antworte als valides JSON Array auf Deutsch.',
      model: agentConfig.models.decisions,
      maxTokens: 1024,
    });

    return (Array.isArray(risks) ? risks : []).map(r => {
      const score = (r.probability || 3) * (r.impact || 3);
      let level = 'low';
      if (score > RISK_THRESHOLDS.high) level = 'critical';
      else if (score > RISK_THRESHOLDS.medium) level = 'high';
      else if (score > RISK_THRESHOLDS.low) level = 'medium';

      return {
        optionId: r.optionId,
        probability: r.probability || 3,
        impact: r.impact || 3,
        score,
        level,
        mitigations: r.mitigations || [],
        keyRisk: r.keyRisk || '',
      };
    });
  } catch (err) {
    logger.error(`Risk assessment failed: ${err.message}`);
    return options.map(o => ({
      optionId: o.id,
      probability: 3,
      impact: 3,
      score: 9,
      level: 'medium',
      mitigations: ['Risikobewertung fehlgeschlagen - manuelle Pruefung empfohlen'],
      keyRisk: 'Automatische Risikobewertung nicht verfuegbar',
    }));
  }
}

// ---------------------------------------------------------------------------
// Stakeholder Impact Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze the impact of each decision option on key stakeholders.
 *
 * @param {Object} decision - The decision record
 * @param {Object[]} options - Analysis options
 * @returns {Promise<Object<string, StakeholderImpact[]>>} Stakeholder impacts per option
 */
async function analyzeStakeholderImpact(decision, options) {
  logger.info(`Analyzing stakeholder impact for: ${decision.Title}`);

  try {
    const prompt = `Analysiere die Auswirkungen jeder Option auf die wichtigsten Stakeholder.

ENTSCHEIDUNG: ${decision.Title}
BESCHREIBUNG: ${decision.Description || 'N/A'}
KATEGORIE: ${decision.Category || 'N/A'}
${decision.RelatedClient ? `BETROFFENER KUNDE: ${decision.RelatedClient}` : ''}

OPTIONEN:
${JSON.stringify(options.map(o => ({ id: o.id, title: o.title, description: o.description })), null, 2)}

STAKEHOLDER-GRUPPEN:
- Kunden (bestehende und potenzielle)
- Team (Mitarbeiter und Freelancer)
- Investoren/Board
- Partner (Technologie- und Vertriebspartner)
- CEO (persoenliche Belastung, Zeitinvestment)

Fuer jede Option, bewerte die Auswirkung auf jede Stakeholder-Gruppe.

Antworte als JSON:
{
  "A": [
    {
      "stakeholder": "Kunden",
      "impact": "positive",
      "severity": 4,
      "description": "Kurze Beschreibung der Auswirkung"
    }
  ],
  "B": [...]
}`;

    const impacts = await generateJSON(prompt, {
      system: 'Du bist ein Stakeholder-Management-Experte. Antworte auf Deutsch als valides JSON.',
      model: agentConfig.models.decisions,
      maxTokens: 2048,
    });

    return impacts || {};
  } catch (err) {
    logger.error(`Stakeholder analysis failed: ${err.message}`);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Decision Tree Visualization
// ---------------------------------------------------------------------------

/**
 * Generate decision tree data structure for visualization.
 * Produces a hierarchical tree that can be rendered by D3.js or similar.
 *
 * @param {Object} decision - The decision record
 * @param {Object} analysis - Full analysis including options, risks, impacts
 * @returns {Object} Decision tree data structure
 */
function generateDecisionTree(decision, analysis) {
  const { options = [], recommendation } = analysis;
  const riskMap = {};
  const stakeholderMap = analysis.stakeholderImpacts || {};

  // Index risk assessments by option ID
  (analysis.riskAssessments || []).forEach(r => {
    riskMap[r.optionId] = r;
  });

  const tree = {
    id: decision.id || 'root',
    name: decision.Title || 'Decision',
    type: 'decision',
    urgency: decision.Urgency || 'medium',
    impactScore: analysis.impactScore ? analysis.impactScore.weighted : null,
    children: options.map(opt => {
      const risk = riskMap[opt.id] || {};
      const stakeholders = stakeholderMap[opt.id] || [];

      return {
        id: `option-${opt.id}`,
        name: `Option ${opt.id}: ${opt.title}`,
        type: 'option',
        isRecommended: opt.id === (recommendation ? recommendation.optionId : null),
        risk: risk.level || 'unknown',
        riskScore: risk.score || 0,
        children: [
          {
            id: `${opt.id}-pros`,
            name: 'Vorteile',
            type: 'pros',
            children: (opt.pros || []).map((p, i) => ({
              id: `${opt.id}-pro-${i}`,
              name: p,
              type: 'pro',
            })),
          },
          {
            id: `${opt.id}-cons`,
            name: 'Nachteile',
            type: 'cons',
            children: (opt.cons || []).map((c, i) => ({
              id: `${opt.id}-con-${i}`,
              name: c,
              type: 'con',
            })),
          },
          {
            id: `${opt.id}-risks`,
            name: `Risiko: ${risk.level || 'N/A'}`,
            type: 'risk',
            score: risk.score || 0,
            children: (risk.mitigations || []).map((m, i) => ({
              id: `${opt.id}-mit-${i}`,
              name: m,
              type: 'mitigation',
            })),
          },
          {
            id: `${opt.id}-stakeholders`,
            name: 'Stakeholder Impact',
            type: 'stakeholders',
            children: stakeholders.map((s, i) => ({
              id: `${opt.id}-sh-${i}`,
              name: `${s.stakeholder}: ${s.impact} (${s.severity}/5)`,
              type: 'stakeholder',
              impact: s.impact,
              severity: s.severity,
            })),
          },
        ],
      };
    }),
    metadata: {
      generatedAt: new Date().toISOString(),
      category: decision.Category,
      recommendation: recommendation ? recommendation.optionId : null,
    },
  };

  return tree;
}

// ---------------------------------------------------------------------------
// Historical Outcome Tracking
// ---------------------------------------------------------------------------

/**
 * Record the outcome of a completed decision for future learning.
 *
 * @param {string} decisionId - Airtable record ID
 * @param {Object} outcome - Outcome data
 * @param {string} outcome.result - What actually happened
 * @param {string} outcome.rating - 'excellent' | 'good' | 'neutral' | 'poor'
 * @param {boolean} outcome.followedAI - Whether CEO followed AI recommendation
 * @param {number} outcome.actualFinancialImpact - Actual CHF impact
 * @returns {Object} Updated outcomes history
 */
function recordOutcome(decisionId, outcome) {
  const history = loadJSON(OUTCOMES_FILE, { outcomes: [], stats: {} });

  const entry = {
    decisionId,
    recordedAt: new Date().toISOString(),
    result: outcome.result || '',
    rating: outcome.rating || 'neutral',
    followedAI: outcome.followedAI || false,
    actualFinancialImpact: outcome.actualFinancialImpact || 0,
    ratingNumeric: { excellent: 4, good: 3, neutral: 2, poor: 1 }[outcome.rating] || 2,
  };

  history.outcomes.push(entry);

  // Update aggregated statistics
  const stats = history.stats;
  stats.totalDecisions = (stats.totalDecisions || 0) + 1;
  stats.totalFinancialImpact = (stats.totalFinancialImpact || 0) + entry.actualFinancialImpact;

  const ratings = history.outcomes.map(o => o.ratingNumeric);
  stats.averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  const aiFollowed = history.outcomes.filter(o => o.followedAI);
  const aiNotFollowed = history.outcomes.filter(o => !o.followedAI);

  stats.aiFollowedRate = history.outcomes.length > 0
    ? Math.round((aiFollowed.length / history.outcomes.length) * 100)
    : 0;

  stats.aiFollowedAvgRating = aiFollowed.length > 0
    ? aiFollowed.reduce((sum, o) => sum + o.ratingNumeric, 0) / aiFollowed.length
    : 0;

  stats.aiNotFollowedAvgRating = aiNotFollowed.length > 0
    ? aiNotFollowed.reduce((sum, o) => sum + o.ratingNumeric, 0) / aiNotFollowed.length
    : 0;

  history.stats = stats;
  saveJSON(OUTCOMES_FILE, history);

  logger.info(`Outcome recorded for decision ${decisionId}: ${outcome.rating}`);
  return history;
}

/**
 * Get historical outcome statistics and patterns.
 *
 * @returns {Object} Historical stats including AI accuracy, category performance, trends
 */
function getOutcomeStats() {
  const history = loadJSON(OUTCOMES_FILE, { outcomes: [], stats: {} });

  // Category breakdown
  const categoryStats = {};
  for (const outcome of history.outcomes) {
    const cat = outcome.category || 'unknown';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { count: 0, totalRating: 0, avgRating: 0 };
    }
    categoryStats[cat].count += 1;
    categoryStats[cat].totalRating += outcome.ratingNumeric;
    categoryStats[cat].avgRating = categoryStats[cat].totalRating / categoryStats[cat].count;
  }

  // Monthly trends
  const monthlyTrends = {};
  for (const outcome of history.outcomes) {
    const month = outcome.recordedAt ? outcome.recordedAt.substring(0, 7) : 'unknown';
    if (!monthlyTrends[month]) {
      monthlyTrends[month] = { count: 0, totalRating: 0, avgRating: 0 };
    }
    monthlyTrends[month].count += 1;
    monthlyTrends[month].totalRating += outcome.ratingNumeric;
    monthlyTrends[month].avgRating = monthlyTrends[month].totalRating / monthlyTrends[month].count;
  }

  return {
    ...history.stats,
    categoryStats,
    monthlyTrends,
    totalOutcomes: history.outcomes.length,
    recentOutcomes: history.outcomes.slice(-10),
  };
}

/**
 * Generate an AI-powered insights report from historical outcomes.
 *
 * @returns {Promise<string|null>} Insights report text or null
 */
async function generateOutcomeInsights() {
  logger.info('Generating outcome insights from historical data...');

  const stats = getOutcomeStats();

  if (stats.totalOutcomes < 3) {
    logger.info('Not enough historical outcomes for insight generation');
    return null;
  }

  try {
    const prompt = `Analysiere die folgenden historischen Entscheidungsdaten des CEOs und identifiziere Muster:

STATISTIKEN:
- Gesamtentscheidungen: ${stats.totalOutcomes}
- Durchschnittliche Bewertung: ${stats.averageRating?.toFixed(2) || 'N/A'}/4
- KI-Empfehlung gefolgt: ${stats.aiFollowedRate || 0}%
- Durchschnittl. Rating wenn KI gefolgt: ${stats.aiFollowedAvgRating?.toFixed(2) || 'N/A'}/4
- Durchschnittl. Rating wenn KI nicht gefolgt: ${stats.aiNotFollowedAvgRating?.toFixed(2) || 'N/A'}/4
- Gesamter finanzieller Impact: CHF ${stats.totalFinancialImpact || 0}

KATEGORIEN:
${JSON.stringify(stats.categoryStats, null, 2)}

MONATLICHE TRENDS:
${JSON.stringify(stats.monthlyTrends, null, 2)}

LETZTE 10 ENTSCHEIDUNGEN:
${JSON.stringify(stats.recentOutcomes, null, 2)}

Erstelle einen Bericht mit:
1. Wichtigste Muster und Erkenntnisse
2. Staerken und Schwaechen im Entscheidungsprozess
3. Empfehlungen fuer bessere Entscheidungen
4. Trend-Analyse (verbessert sich die Qualitaet?)`;

    const insights = await generateText(prompt, {
      system: 'Du bist ein Decision Analytics Experte. Sei datengetrieben und praezise. Antworte auf Deutsch.',
      model: agentConfig.models.decisions,
      maxTokens: 2048,
    });

    return insights;
  } catch (err) {
    logger.error(`Outcome insights generation failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Decision Deadline Management
// ---------------------------------------------------------------------------

/**
 * Set a deadline for a decision and register it for alerting.
 *
 * @param {string} decisionId - Airtable record ID
 * @param {string} title - Decision title
 * @param {string} urgency - Urgency level
 * @param {Date} [customDeadline] - Optional custom deadline
 * @returns {Object} Deadline record
 */
function setDeadline(decisionId, title, urgency, customDeadline = null) {
  const deadlines = loadJSON(DEADLINES_FILE, { active: {}, expired: [] });

  const hours = URGENCY_DEADLINE_HOURS[urgency] || 24;
  const deadline = customDeadline || new Date(Date.now() + hours * 60 * 60 * 1000);

  const record = {
    decisionId,
    title,
    urgency,
    createdAt: new Date().toISOString(),
    deadline: deadline instanceof Date ? deadline.toISOString() : deadline,
    alertsSent: 0,
    escalated: false,
  };

  deadlines.active[decisionId] = record;
  saveJSON(DEADLINES_FILE, deadlines);

  logger.info(`Deadline set for "${title}": ${record.deadline}`);
  return record;
}

/**
 * Check all active deadlines and send alerts for approaching or passed deadlines.
 * Escalates critical overdue decisions.
 *
 * @returns {Promise<Object[]>} List of alert actions taken
 */
async function checkDeadlines() {
  const deadlines = loadJSON(DEADLINES_FILE, { active: {}, expired: [] });
  const now = new Date();
  const alerts = [];

  for (const [id, deadline] of Object.entries(deadlines.active)) {
    const deadlineDate = new Date(deadline.deadline);
    const hoursRemaining = (deadlineDate - now) / (1000 * 60 * 60);

    try {
      // Decision is overdue
      if (hoursRemaining <= 0) {
        if (!deadline.escalated) {
          logger.warn(`Decision OVERDUE: "${deadline.title}" (${Math.abs(hoursRemaining).toFixed(1)}h over)`);

          await sendCEOEmail({
            subject: `[UEBERFAELLIG] Entscheidung: ${deadline.title}`,
            html: buildDeadlineAlertEmail(deadline, 'overdue', hoursRemaining),
          });

          await dashboardSync.sendNotification(
            `Entscheidung ueberfaellig: ${deadline.title}`,
            `Die Entscheidung "${deadline.title}" ist seit ${Math.abs(hoursRemaining).toFixed(1)} Stunden ueberfaellig.`,
            'error',
            `/decisions/${id}`
          );

          deadline.escalated = true;
          deadline.alertsSent += 1;
          alerts.push({ id, type: 'overdue', title: deadline.title });
        }
      }
      // Decision deadline is approaching (< 1 hour remaining)
      else if (hoursRemaining <= 1 && deadline.alertsSent < 2) {
        logger.info(`Decision deadline approaching: "${deadline.title}" (${hoursRemaining.toFixed(1)}h left)`);

        await sendCEOEmail({
          subject: `[BALD FAELLIG] Entscheidung: ${deadline.title}`,
          html: buildDeadlineAlertEmail(deadline, 'approaching', hoursRemaining),
        });

        deadline.alertsSent += 1;
        alerts.push({ id, type: 'approaching', title: deadline.title });
      }
      // 50% of time elapsed - send a reminder if no alert sent yet
      else if (hoursRemaining <= (URGENCY_DEADLINE_HOURS[deadline.urgency] || 24) / 2 && deadline.alertsSent === 0) {
        logger.info(`Decision halfway to deadline: "${deadline.title}" (${hoursRemaining.toFixed(1)}h left)`);

        await dashboardSync.sendNotification(
          `Erinnerung: ${deadline.title}`,
          `Noch ${hoursRemaining.toFixed(1)} Stunden bis zur Deadline.`,
          'warning',
          `/decisions/${id}`
        );

        deadline.alertsSent += 1;
        alerts.push({ id, type: 'reminder', title: deadline.title });
      }
    } catch (err) {
      logger.error(`Deadline check failed for "${deadline.title}": ${err.message}`);
    }
  }

  saveJSON(DEADLINES_FILE, deadlines);
  return alerts;
}

/**
 * Remove a deadline (decision was made).
 *
 * @param {string} decisionId - The decision ID
 * @returns {void}
 */
function clearDeadline(decisionId) {
  const deadlines = loadJSON(DEADLINES_FILE, { active: {}, expired: [] });

  if (deadlines.active[decisionId]) {
    const expired = deadlines.active[decisionId];
    expired.resolvedAt = new Date().toISOString();
    deadlines.expired.push(expired);
    delete deadlines.active[decisionId];
    saveJSON(DEADLINES_FILE, deadlines);
    logger.info(`Deadline cleared for decision ${decisionId}`);
  }
}

/**
 * Build deadline alert email HTML.
 *
 * @param {Object} deadline - The deadline record
 * @param {string} type - 'overdue' | 'approaching' | 'reminder'
 * @param {number} hoursRemaining - Hours until deadline (negative if overdue)
 * @returns {string} HTML email content
 */
function buildDeadlineAlertEmail(deadline, type, hoursRemaining) {
  const colors = {
    overdue: { bg: '#fff3f3', border: '#e94560', heading: '#c92a2a', label: 'UEBERFAELLIG' },
    approaching: { bg: '#fff8e1', border: '#ffc107', heading: '#856404', label: 'BALD FAELLIG' },
    reminder: { bg: '#e8f4f8', border: '#0077b6', heading: '#005f8f', label: 'ERINNERUNG' },
  };

  const style = colors[type] || colors.reminder;
  const timeText = hoursRemaining <= 0
    ? `${Math.abs(hoursRemaining).toFixed(1)} Stunden ueberfaellig`
    : `Noch ${hoursRemaining.toFixed(1)} Stunden`;

  return `
    <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:${style.bg};border-left:4px solid ${style.border};padding:20px;border-radius:8px;">
        <span style="background:${style.border};color:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;">${style.label}</span>
        <h2 style="margin:12px 0 8px;color:${style.heading};">${deadline.title}</h2>
        <p style="margin:4px 0;color:#555;"><strong>Dringlichkeit:</strong> ${deadline.urgency}</p>
        <p style="margin:4px 0;color:#555;"><strong>Deadline:</strong> ${new Date(deadline.deadline).toLocaleString('de-CH')}</p>
        <p style="margin:4px 0;color:${style.heading};font-weight:bold;font-size:16px;">${timeText}</p>
      </div>
      <div style="padding:12px;text-align:center;font-size:12px;color:#888;">
        Werkpilot Decision Tracker - Deadline Alert
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Dashboard API Integration
// ---------------------------------------------------------------------------

/**
 * Sync a decision and its full analysis to the dashboard API.
 *
 * @param {Object} decision - The decision record
 * @param {Object} analysis - The full analysis object
 * @returns {Promise<Object>} Sync result
 */
async function syncDecisionToDashboard(decision, analysis) {
  logger.info(`Syncing decision to dashboard: ${decision.Title}`);

  try {
    const payload = {
      id: decision.id,
      title: decision.Title,
      category: decision.Category,
      urgency: decision.Urgency,
      status: 'awaiting-decision',
      impactScore: analysis.impactScore || null,
      riskAssessments: analysis.riskAssessments || [],
      optionCount: (analysis.options || []).length,
      recommendation: analysis.recommendation ? analysis.recommendation.optionId : null,
      financialImpact: analysis.estimatedFinancialImpact || 0,
      createdAt: decision.CreatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await dashboardClient.post('/api/sync', {
      decisions: [payload],
    });

    logger.info(`Decision synced to dashboard: ${decision.Title}`);
    return result;
  } catch (err) {
    logger.warn(`Dashboard sync failed for decision "${decision.Title}": ${err.message}`);
    // Non-fatal: decision processing continues even if dashboard sync fails
    return { synced: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Context Gathering (Enhanced from decision-support.js)
// ---------------------------------------------------------------------------

/**
 * Gather comprehensive context for a decision, including category-specific
 * data, past decisions, client data, and agent logs.
 *
 * @param {Object} decision - The decision record from Airtable
 * @returns {Promise<Object>} Enriched context object
 */
async function gatherContext(decision) {
  const category = decision.Category || 'strategy';
  const context = { decision, additionalData: {} };

  try {
    // Category-specific context via handler
    if (actionHandlers[category] && actionHandlers[category].gatherContext) {
      context.additionalData = await actionHandlers[category].gatherContext(decision);
    }

    // Past decisions for learning
    try {
      const pastDecisions = await getRecords(
        'Decisions',
        `AND({Category} = '${category}', {Status} = 'implemented', {OutcomeRating} != '')`,
        5
      );
      context.pastDecisions = pastDecisions;
    } catch (err) {
      logger.warn(`Could not fetch past decisions: ${err.message}`);
      context.pastDecisions = [];
    }

    // Client data if applicable
    if (decision.RelatedClient) {
      try {
        const clientData = await getRecords(
          'Clients',
          `{Name} = '${decision.RelatedClient}'`,
          1
        );
        context.clientData = clientData[0] || null;
      } catch (err) {
        logger.warn(`Could not fetch client data: ${err.message}`);
      }
    }

    // Historical outcome stats
    context.outcomeStats = getOutcomeStats();

    // Agent logs for relevant department
    const deptMap = {
      'client-issues': 'sales',
      'pricing': 'finance',
      'agent-errors': 'it',
      'strategy': 'strategy',
      'partnerships': 'sales',
    };

    const dept = deptMap[category];
    if (dept) {
      const logPath = path.join(config.paths.logs, dept, 'combined.log');
      try {
        if (fs.existsSync(logPath)) {
          const content = fs.readFileSync(logPath, 'utf-8');
          const lines = content.trim().split('\n').slice(-30);
          context.recentLogs = lines.join('\n');
        }
      } catch (err) {
        logger.warn(`Could not read logs for ${dept}: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error(`Context gathering failed: ${err.message}`);
  }

  return context;
}

// ---------------------------------------------------------------------------
// Enhanced Decision Analysis
// ---------------------------------------------------------------------------

/**
 * Run full decision analysis pipeline including impact scoring, risk
 * assessment, stakeholder analysis, and decision tree generation.
 *
 * @param {Object} context - Gathered context from gatherContext()
 * @returns {Promise<Object>} Complete analysis with all enrichments
 */
async function analyzeDecisionFull(context) {
  const { decision, additionalData, pastDecisions, clientData, recentLogs, outcomeStats } = context;

  // Step 1: Base analysis (same prompt as decision-support.js but enhanced)
  const prompt = `Du bist der strategische KI-Berater des CEOs von Werkpilot (Schweizer AI-Automations-Startup).
Analysiere die folgende Entscheidung und erstelle eine strukturierte Entscheidungsvorlage.

ENTSCHEIDUNG:
- Titel: ${decision.Title || 'Unbekannt'}
- Kategorie: ${decision.Category || 'Unbekannt'}
- Dringlichkeit: ${decision.Urgency || 'medium'}
- Beschreibung: ${decision.Description || 'Keine Beschreibung'}
${decision.RelatedClient ? `- Betroffener Kunde: ${decision.RelatedClient}` : ''}

ZUSAETZLICHER KONTEXT:
${JSON.stringify(additionalData, null, 2)}

${clientData ? `KUNDENDATEN:\n${JSON.stringify(clientData, null, 2)}` : ''}

${recentLogs ? `RELEVANTE LOGS:\n${recentLogs}` : ''}

${pastDecisions && pastDecisions.length > 0 ? `VERGANGENE AEHNLICHE ENTSCHEIDUNGEN:\n${JSON.stringify(pastDecisions.map(d => ({
  title: d.Title,
  decision: d.CEODecision,
  outcome: d.Outcome,
  rating: d.OutcomeRating,
})), null, 2)}` : ''}

${outcomeStats && outcomeStats.totalOutcomes > 0 ? `HISTORISCHE STATISTIKEN:
- Gesamtentscheidungen: ${outcomeStats.totalOutcomes}
- Durchschnittl. Bewertung: ${outcomeStats.averageRating?.toFixed(2)}/4
- KI-Empfehlungsrate: ${outcomeStats.aiFollowedRate}%` : ''}

AUFGABE:
Erstelle genau 2-3 Handlungsoptionen. Fuer jede Option:
1. Einen klaren Titel
2. Eine kurze Beschreibung (2-3 Saetze)
3. Pro-Argumente (2-3 Punkte)
4. Contra-Argumente (1-2 Punkte)
5. Geschaetzter Impact (finanziell, zeitlich, strategisch)
6. Risikobewertung (niedrig/mittel/hoch)

Gib dann eine klare Empfehlung mit Begruendung.

Antwortformat als JSON:
{
  "summary": "Kurze Zusammenfassung der Situation",
  "options": [
    {
      "id": "A",
      "title": "Option A Titel",
      "description": "Beschreibung",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Contra 1"],
      "financialImpact": "z.B. +5000 CHF/Monat",
      "timeImpact": "z.B. 2 Wochen Implementierung",
      "strategicImpact": "z.B. Staerkt Kundenbindung",
      "risk": "niedrig|mittel|hoch"
    }
  ],
  "recommendation": {
    "optionId": "A",
    "reasoning": "Begruendung warum diese Option empfohlen wird",
    "nextSteps": ["Schritt 1", "Schritt 2"]
  },
  "estimatedFinancialImpact": 5000,
  "urgencyAssessment": "Einschaetzung der tatsaechlichen Dringlichkeit"
}`;

  const baseAnalysis = await generateJSON(prompt, {
    system: 'Du bist ein erfahrener Strategieberater fuer Tech-Startups in der Schweiz. Antworte immer auf Deutsch. Sei praezise und faktenbasiert. Gib valides JSON zurueck.',
    model: agentConfig.models.decisions,
    maxTokens: 4096,
  });

  // Step 2: Impact scoring (parallel)
  // Step 3: Risk assessment (parallel)
  // Step 4: Stakeholder analysis (parallel)
  const [impactScore, riskAssessments, stakeholderImpacts] = await Promise.all([
    calculateImpactScore(decision, context),
    assessRisks(decision, baseAnalysis.options || []),
    analyzeStakeholderImpact(decision, baseAnalysis.options || []),
  ]);

  // Step 5: Assemble full analysis
  const fullAnalysis = {
    ...baseAnalysis,
    impactScore,
    riskAssessments,
    stakeholderImpacts,
    decisionTree: null, // Will be set after
    analyzedAt: new Date().toISOString(),
    modelUsed: agentConfig.models.decisions,
  };

  // Step 6: Generate decision tree
  fullAnalysis.decisionTree = generateDecisionTree(decision, fullAnalysis);

  return fullAnalysis;
}

// ---------------------------------------------------------------------------
// Email Formatting (Enhanced)
// ---------------------------------------------------------------------------

/**
 * Generate a comprehensive decision card email with impact scores,
 * risk matrix, and stakeholder analysis.
 *
 * @param {Object} decision - The decision record
 * @param {Object} analysis - Full analysis from analyzeDecisionFull()
 * @returns {string} HTML email content
 */
function formatDecisionEmail(decision, analysis) {
  const urgencyColors = {
    critical: '#e94560',
    high: '#ff6b35',
    medium: '#ffd166',
    low: '#06d6a0',
  };

  const riskColors = {
    niedrig: '#06d6a0',
    mittel: '#ffd166',
    hoch: '#e94560',
    low: '#06d6a0',
    medium: '#ffd166',
    high: '#e94560',
    critical: '#c92a2a',
  };

  const urgency = (decision.Urgency || 'medium').toLowerCase();
  const urgencyColor = urgencyColors[urgency] || urgencyColors.medium;

  // Impact score badge
  const impactScore = analysis.impactScore || {};
  const weightedScore = impactScore.weighted || 5;
  const impactColor = weightedScore >= 7 ? '#e94560' : weightedScore >= 4 ? '#ffd166' : '#06d6a0';

  // Impact score section
  const impactHtml = `
    <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;">
      <h3 style="margin:0 0 12px;color:#16213e;">Impact Score: ${weightedScore}/10</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${['financial', 'strategic', 'operational', 'customer', 'team', 'risk'].map(key => {
          const val = impactScore[key] || 5;
          const barColor = val >= 7 ? '#e94560' : val >= 4 ? '#ffd166' : '#06d6a0';
          const label = { financial: 'Finanziell', strategic: 'Strategisch', operational: 'Operativ', customer: 'Kunden', team: 'Team', risk: 'Risiko' }[key];
          return `
            <div style="flex:1;min-width:100px;text-align:center;">
              <div style="font-size:11px;color:#666;margin-bottom:4px;">${label}</div>
              <div style="background:#eee;border-radius:4px;height:8px;overflow:hidden;">
                <div style="width:${val * 10}%;height:100%;background:${barColor};border-radius:4px;"></div>
              </div>
              <div style="font-size:13px;font-weight:bold;color:${barColor};margin-top:2px;">${val}/10</div>
            </div>`;
        }).join('')}
      </div>
    </div>`;

  // Options with risk badges
  const optionsHtml = (analysis.options || []).map(opt => {
    const isRecommended = opt.id === (analysis.recommendation ? analysis.recommendation.optionId : null);
    const riskAssessment = (analysis.riskAssessments || []).find(r => r.optionId === opt.id) || {};
    const stakeholders = (analysis.stakeholderImpacts || {})[opt.id] || [];
    const riskBadgeColor = riskColors[riskAssessment.level] || '#999';

    return `
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:12px 0;border-left:4px solid ${isRecommended ? '#06d6a0' : '#ddd'};">
        <h3 style="margin:0 0 8px;color:#16213e;">
          ${isRecommended ? '* ' : ''}Option ${opt.id}: ${opt.title}
          ${isRecommended ? '<span style="background:#06d6a0;color:white;padding:2px 8px;border-radius:12px;font-size:12px;margin-left:8px;">EMPFOHLEN</span>' : ''}
          <span style="background:${riskBadgeColor};color:white;padding:2px 8px;border-radius:12px;font-size:11px;margin-left:4px;">Risiko: ${riskAssessment.level || opt.risk || 'N/A'} (${riskAssessment.score || '-'}/25)</span>
        </h3>
        <p style="margin:4px 0;color:#444;">${opt.description}</p>
        <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <strong style="color:#06d6a0;">Pro:</strong>
            <ul style="margin:4px 0;padding-left:20px;">${(opt.pros || []).map(p => `<li>${p}</li>`).join('')}</ul>
          </div>
          <div style="flex:1;min-width:200px;">
            <strong style="color:#e94560;">Contra:</strong>
            <ul style="margin:4px 0;padding-left:20px;">${(opt.cons || []).map(c => `<li>${c}</li>`).join('')}</ul>
          </div>
        </div>
        ${riskAssessment.mitigations && riskAssessment.mitigations.length > 0 ? `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #eee;">
          <strong style="color:#555;font-size:13px;">Risikominderung:</strong>
          <ul style="margin:4px 0;padding-left:20px;font-size:13px;color:#666;">${riskAssessment.mitigations.map(m => `<li>${m}</li>`).join('')}</ul>
        </div>` : ''}
        ${stakeholders.length > 0 ? `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #eee;">
          <strong style="color:#555;font-size:13px;">Stakeholder Impact:</strong>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
            ${stakeholders.map(s => {
              const sColor = s.impact === 'positive' ? '#06d6a0' : s.impact === 'negative' ? '#e94560' : '#999';
              return `<span style="font-size:12px;padding:2px 8px;border-radius:12px;border:1px solid ${sColor};color:${sColor};">${s.stakeholder} ${s.impact === 'positive' ? '+' : s.impact === 'negative' ? '-' : '~'}${s.severity}</span>`;
            }).join('')}
          </div>
        </div>` : ''}
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #eee;display:flex;gap:16px;flex-wrap:wrap;font-size:13px;">
          <span>${opt.financialImpact || '-'}</span>
          <span>${opt.timeImpact || '-'}</span>
          <span>${opt.strategicImpact || '-'}</span>
        </div>
      </div>`;
  }).join('');

  // Recommendation section
  const recommendationHtml = analysis.recommendation ? `
    <div style="background:#e8f5e9;border-radius:8px;padding:16px;margin:16px 0;border:2px solid #06d6a0;">
      <h3 style="margin:0 0 8px;color:#2e7d32;">Empfehlung: Option ${analysis.recommendation.optionId}</h3>
      <p style="margin:4px 0;">${analysis.recommendation.reasoning}</p>
      ${analysis.recommendation.nextSteps ? `
        <div style="margin-top:12px;">
          <strong>Naechste Schritte:</strong>
          <ol style="margin:4px 0;">${analysis.recommendation.nextSteps.map(s => `<li>${s}</li>`).join('')}</ol>
        </div>` : ''}
    </div>` : '';

  return `
    <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:750px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h1 style="margin:0;font-size:20px;">Entscheidung erforderlich</h1>
          <div style="display:flex;gap:8px;">
            <span style="background:${urgencyColor};padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold;text-transform:uppercase;">${urgency}</span>
            <span style="background:${impactColor};padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold;">Impact: ${weightedScore}/10</span>
          </div>
        </div>
        <h2 style="margin:8px 0 0;font-size:16px;opacity:0.9;">${decision.Title || 'Unbekannte Entscheidung'}</h2>
      </div>
      <div style="padding:20px 24px;background:#ffffff;border:1px solid #eee;">
        <div style="background:#f0f4ff;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
          <strong>Zusammenfassung:</strong> ${analysis.summary || decision.Description || '-'}
        </div>
        ${decision.RelatedClient ? `<p><strong>Betroffener Kunde:</strong> ${decision.RelatedClient}</p>` : ''}
        ${analysis.urgencyAssessment ? `<p><strong>Dringlichkeit:</strong> ${analysis.urgencyAssessment}</p>` : ''}
        ${analysis.estimatedFinancialImpact ? `<p><strong>Geschaetzter finanzieller Impact:</strong> CHF ${analysis.estimatedFinancialImpact.toLocaleString('de-CH')}</p>` : ''}
        ${impactHtml}
        <h2 style="color:#16213e;border-bottom:2px solid #e94560;padding-bottom:8px;margin-top:24px;">Optionen</h2>
        ${optionsHtml}
        ${recommendationHtml}
      </div>
      <div style="padding:16px 24px;background:#f8f9fa;border-radius:0 0 8px 8px;border:1px solid #eee;border-top:none;">
        <p style="margin:0;color:#666;font-size:12px;text-align:center;">
          Werkpilot Decision Tracker v2 &mdash; Antworten Sie mit Ihrer Entscheidung (A/B/C) und optionaler Begruendung.
        </p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Decision Processing Pipeline (Enhanced)
// ---------------------------------------------------------------------------

/**
 * Process a single new decision entry through the full enhanced pipeline.
 *
 * @param {Object} decision - The decision record from Airtable
 * @returns {Promise<Object>} Processing result
 */
async function processDecision(decision) {
  const decisionId = decision.id;
  const title = decision.Title || 'Unbekannt';
  const startTime = new Date();

  logger.info(`Processing decision: "${title}" (${decisionId})`);

  try {
    // Mark as analyzing
    await updateRecord('Decisions', decisionId, { Status: 'analyzing' });
    await dashboardSync.syncAgentStatus(AGENT_NAME, 'active');

    // Step 1: Gather context
    logger.info(`[${title}] Step 1/5: Gathering context...`);
    const context = await gatherContext(decision);

    // Step 2: Full analysis (includes impact, risk, stakeholders)
    logger.info(`[${title}] Step 2/5: Running full AI analysis...`);
    const analysis = await analyzeDecisionFull(context);

    // Step 3: Set deadline
    logger.info(`[${title}] Step 3/5: Setting deadline...`);
    setDeadline(decisionId, title, decision.Urgency || 'medium');

    // Step 4: Update Airtable
    logger.info(`[${title}] Step 4/5: Updating Airtable and syncing dashboard...`);
    await updateRecord('Decisions', decisionId, {
      Status: 'awaiting-decision',
      Context: JSON.stringify({
        additionalData: context.additionalData,
        impactScore: analysis.impactScore,
        riskAssessments: analysis.riskAssessments,
      }, null, 2),
      Options: JSON.stringify(analysis.options, null, 2),
      AIRecommendation: analysis.recommendation
        ? `Option ${analysis.recommendation.optionId}: ${analysis.recommendation.reasoning}`
        : 'Keine klare Empfehlung',
      FinancialImpact: analysis.estimatedFinancialImpact || 0,
    });

    // Step 5: Dashboard sync + email + local save (parallel)
    logger.info(`[${title}] Step 5/5: Sending notifications...`);

    const emailHtml = formatDecisionEmail(decision, analysis);
    const urgencyPrefix = decision.Urgency === 'critical' ? '[DRINGEND] ' : '';

    await Promise.all([
      syncDecisionToDashboard(decision, analysis),
      sendCEOEmail({
        subject: `${urgencyPrefix}Entscheidung: ${title}`,
        html: emailHtml,
      }),
      dashboardSync.sendNotification(
        `Neue Entscheidung analysiert: ${title}`,
        `Impact Score: ${analysis.impactScore ? analysis.impactScore.weighted : 'N/A'}/10 | ${(analysis.options || []).length} Optionen | Empfehlung: Option ${analysis.recommendation ? analysis.recommendation.optionId : 'N/A'}`,
        decision.Urgency === 'critical' ? 'error' : decision.Urgency === 'high' ? 'warning' : 'info',
        `/decisions/${decisionId}`
      ),
    ]);

    // Save decision tree and full analysis locally
    saveDecisionLog(decision, analysis);

    const elapsed = ((new Date() - startTime) / 1000).toFixed(1);
    logger.info(`Decision processed in ${elapsed}s: "${title}"`);

    await dashboardSync.syncAgentStatus(AGENT_NAME, 'idle', 100, 1, 0);

    return { success: true, decisionId, title, elapsed, impactScore: analysis.impactScore?.weighted };
  } catch (err) {
    logger.error(`Failed to process decision "${title}": ${err.message}`, { stack: err.stack });

    // Reset status on error
    try {
      await updateRecord('Decisions', decisionId, {
        Status: 'new',
        Context: `Analyse fehlgeschlagen: ${err.message}`,
      });
    } catch (updateErr) {
      logger.error(`Could not reset decision status: ${updateErr.message}`);
    }

    try {
      await dashboardSync.syncAgentStatus(AGENT_NAME, 'error', 0, 0, 1);
    } catch (_) { /* ignore sync errors */ }

    return { success: false, decisionId, title, error: err.message };
  }
}

/**
 * Save the full decision analysis including decision tree to a local JSON file.
 *
 * @param {Object} decision - The decision record
 * @param {Object} analysis - Full analysis object
 * @returns {void}
 */
function saveDecisionLog(decision, analysis) {
  ensureDirectories();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = (decision.Title || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
  const filename = `${timestamp}_${slug}.json`;

  const logEntry = {
    version: '2.0',
    timestamp: new Date().toISOString(),
    decision: {
      id: decision.id,
      title: decision.Title,
      category: decision.Category,
      urgency: decision.Urgency,
      description: decision.Description,
    },
    analysis: {
      summary: analysis.summary,
      options: analysis.options,
      recommendation: analysis.recommendation,
      estimatedFinancialImpact: analysis.estimatedFinancialImpact,
      urgencyAssessment: analysis.urgencyAssessment,
    },
    impactScore: analysis.impactScore,
    riskAssessments: analysis.riskAssessments,
    stakeholderImpacts: analysis.stakeholderImpacts,
    decisionTree: analysis.decisionTree,
  };

  const filePath = path.join(DECISIONS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(logEntry, null, 2), 'utf-8');
  logger.info(`Full decision log saved: ${filename}`);

  // Also save decision tree separately for visualization
  const treePath = path.join(DECISIONS_DIR, `tree_${filename}`);
  fs.writeFileSync(treePath, JSON.stringify(analysis.decisionTree, null, 2), 'utf-8');
  logger.info(`Decision tree saved: tree_${filename}`);
}

// ---------------------------------------------------------------------------
// Polling Loop
// ---------------------------------------------------------------------------

/**
 * Poll Airtable for new decisions and process them in priority order.
 *
 * @returns {Promise<Object[]>} Array of processing results
 */
async function pollForNewDecisions() {
  logger.info('Polling for new decisions...');

  try {
    const newDecisions = await getRecords(
      'Decisions',
      "{Status} = 'new'",
      10
    );

    if (newDecisions.length === 0) {
      logger.info('No new decisions found');
      return [];
    }

    logger.info(`Found ${newDecisions.length} new decision(s) to process`);

    // Sort by urgency: critical > high > medium > low
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    newDecisions.sort((a, b) => {
      const aOrder = urgencyOrder[(a.Urgency || 'medium').toLowerCase()] ?? 2;
      const bOrder = urgencyOrder[(b.Urgency || 'medium').toLowerCase()] ?? 2;
      return aOrder - bOrder;
    });

    // Process sequentially to avoid rate limits
    const results = [];
    for (const decision of newDecisions) {
      const result = await processDecision(decision);
      results.push(result);

      // Delay between decisions to respect API rate limits
      if (newDecisions.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  } catch (err) {
    logger.error(`Polling failed: ${err.message}`, { stack: err.stack });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main Execute Function
// ---------------------------------------------------------------------------

/**
 * Main execution entry point for the Decision Tracker agent.
 * Can be called by the orchestrator or run standalone.
 *
 * @param {Object} [options={}] - Execution options
 * @param {string} [options.mode='poll'] - 'poll' | 'insights' | 'deadlines' | 'full'
 * @returns {Promise<Object>} Execution result
 */
async function execute(options = {}) {
  const mode = options.mode || 'poll';
  const startTime = Date.now();

  logger.info(`=== Decision Tracker executing in mode: ${mode} ===`);

  try {
    await dashboardSync.syncAgentStatus(AGENT_NAME, 'active');

    let result = {};

    switch (mode) {
      case 'poll': {
        const decisions = await pollForNewDecisions();
        const deadlineAlerts = await checkDeadlines();
        result = { decisions, deadlineAlerts };
        break;
      }

      case 'insights': {
        const insights = await generateOutcomeInsights();
        result = { insights };

        if (insights) {
          await sendCEOEmail({
            subject: 'Decision Insights Report',
            html: `<div style="font-family:sans-serif;padding:20px;max-width:700px;margin:0 auto;">
              <h2 style="color:#16213e;">Decision Learning Report</h2>
              <pre style="white-space:pre-wrap;background:#f8f9fa;padding:16px;border-radius:8px;line-height:1.6;">${insights}</pre>
            </div>`,
          });
        }
        break;
      }

      case 'deadlines': {
        const alerts = await checkDeadlines();
        result = { deadlineAlerts: alerts };
        break;
      }

      case 'full': {
        const decisions = await pollForNewDecisions();
        const deadlineAlerts = await checkDeadlines();
        const insights = await generateOutcomeInsights();
        result = { decisions, deadlineAlerts, insights };
        break;
      }

      default:
        logger.warn(`Unknown mode: ${mode}`);
        result = { error: `Unknown mode: ${mode}` };
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Decision Tracker complete in ${elapsed}s ===`);

    await dashboardSync.syncAgentStatus(AGENT_NAME, 'idle', 100);

    return { success: true, mode, elapsed, ...result };
  } catch (err) {
    logger.error(`Decision Tracker execution failed: ${err.message}`, { stack: err.stack });

    try {
      await dashboardSync.syncAgentStatus(AGENT_NAME, 'error', 0, 0, 1);
    } catch (_) { /* ignore */ }

    return { success: false, mode, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

/**
 * Start the Decision Tracker with cron scheduling.
 * Sets up polling, deadline checks, and weekly insights.
 *
 * @returns {void}
 */
function start() {
  loadActionHandlers();
  ensureDirectories();

  const pollSchedule = agentConfig.decisionSupport.pollInterval;
  logger.info(`Decision Tracker v2 starting. Poll: ${pollSchedule}`);

  // Poll for new decisions every 5 minutes
  cron.schedule(pollSchedule, () => {
    logger.info('Cron triggered: decision poll');
    execute({ mode: 'poll' });
  });

  // Check deadlines every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    logger.info('Cron triggered: deadline check');
    checkDeadlines();
  });

  // Generate weekly insights on Sundays at 20:00
  cron.schedule('0 20 * * 0', () => {
    logger.info('Cron triggered: weekly decision insights');
    execute({ mode: 'insights' });
  }, {
    timezone: TIMEZONE,
  });

  logger.info('Decision Tracker v2 is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--poll') || args.includes('-p')) {
    logger.info('Running decision poll immediately (manual trigger)');
    loadActionHandlers();
    execute({ mode: 'poll' }).then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else if (args.includes('--insights') || args.includes('-i')) {
    logger.info('Generating decision insights (manual trigger)');
    execute({ mode: 'insights' }).then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else if (args.includes('--deadlines') || args.includes('-d')) {
    logger.info('Checking deadlines (manual trigger)');
    execute({ mode: 'deadlines' }).then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else if (args.includes('--full')) {
    logger.info('Running full execution (manual trigger)');
    loadActionHandlers();
    execute({ mode: 'full' }).then(result => {
      console.log(JSON.stringify(result, null, 2));
    });
  } else if (args.includes('--record-outcome')) {
    const idIdx = args.indexOf('--record-outcome');
    const decisionId = args[idIdx + 1];
    const rating = args[idIdx + 2] || 'neutral';
    if (decisionId) {
      const history = recordOutcome(decisionId, { rating, result: args.slice(idIdx + 3).join(' ') });
      console.log(`Outcome recorded. Total outcomes: ${history.outcomes.length}`);
    } else {
      console.error('Usage: --record-outcome <decisionId> <rating> [result text]');
    }
  } else if (args.includes('--stats')) {
    const stats = getOutcomeStats();
    console.log(JSON.stringify(stats, null, 2));
  } else {
    start();
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  execute,
  start,
  processDecision,
  pollForNewDecisions,
  calculateImpactScore,
  assessRisks,
  analyzeStakeholderImpact,
  generateDecisionTree,
  recordOutcome,
  getOutcomeStats,
  generateOutcomeInsights,
  setDeadline,
  checkDeadlines,
  clearDeadline,
  syncDecisionToDashboard,
};
