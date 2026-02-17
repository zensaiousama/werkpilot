/**
 * Werkpilot CEO Decision Support Agent
 *
 * Monitors the "Decisions" Airtable table for new entries,
 * gathers context, runs Claude analysis with multiple options,
 * pros/cons, and recommendations, then sends formatted decision
 * cards via email. Logs all decisions and outcomes for learning.
 *
 * Categories: Client Issues, Pricing, Agent Errors, Strategy, Partnerships
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateJSON, generateText } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, updateRecord, createRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const agentConfig = require('./config.json');
const logger = createLogger('ceo-decision-support');

// ---------------------------------------------------------------------------
// Action Handler Registry
// ---------------------------------------------------------------------------

const actionHandlers = {};

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
// Context Gathering
// ---------------------------------------------------------------------------

/**
 * Gather additional context for a decision based on its category.
 */
async function gatherContext(decision) {
  const category = decision.Category || 'strategy';
  const context = { decision, additionalData: {} };

  try {
    // Get category-specific context via handler
    if (actionHandlers[category] && actionHandlers[category].gatherContext) {
      context.additionalData = await actionHandlers[category].gatherContext(decision);
    }

    // Get related past decisions for learning
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

    // If client-related, try to get client data
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

    // Read relevant agent logs
    const logsDir = config.paths.logs;
    const deptMap = {
      'client-issues': 'sales',
      'pricing': 'finance',
      'agent-errors': 'it',
      'strategy': 'strategy',
      'partnerships': 'sales',
    };

    const dept = deptMap[category];
    if (dept) {
      const logPath = path.join(logsDir, dept, 'combined.log');
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
// Decision Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a decision using Claude and generate options with recommendations.
 */
async function analyzeDecision(context) {
  const { decision, additionalData, pastDecisions, clientData, recentLogs } = context;

  const prompt = `Du bist der strategische KI-Berater des CEOs von Werkpilot (Schweizer AI-Automations-Startup).
Analysiere die folgende Entscheidung und erstelle eine strukturierte Entscheidungsvorlage.

ENTSCHEIDUNG:
- Titel: ${decision.Title || 'Unbekannt'}
- Kategorie: ${decision.Category || 'Unbekannt'}
- Dringlichkeit: ${decision.Urgency || 'medium'}
- Beschreibung: ${decision.Description || 'Keine Beschreibung'}
${decision.RelatedClient ? `- Betroffener Kunde: ${decision.RelatedClient}` : ''}

ZUSÄTZLICHER KONTEXT:
${JSON.stringify(additionalData, null, 2)}

${clientData ? `KUNDENDATEN:\n${JSON.stringify(clientData, null, 2)}` : ''}

${recentLogs ? `RELEVANTE LOGS:\n${recentLogs}` : ''}

${pastDecisions && pastDecisions.length > 0 ? `VERGANGENE ÄHNLICHE ENTSCHEIDUNGEN (zum Lernen):\n${JSON.stringify(pastDecisions.map(d => ({
  title: d.Title,
  decision: d.CEODecision,
  outcome: d.Outcome,
  rating: d.OutcomeRating,
})), null, 2)}` : ''}

AUFGABE:
Erstelle genau 2-3 Handlungsoptionen. Für jede Option:
1. Einen klaren Titel
2. Eine kurze Beschreibung (2-3 Sätze)
3. Pro-Argumente (2-3 Punkte)
4. Contra-Argumente (1-2 Punkte)
5. Geschätzter Impact (finanziell, zeitlich, strategisch)
6. Risikobewertung (niedrig/mittel/hoch)

Gib dann eine klare Empfehlung mit Begründung.

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
      "strategicImpact": "z.B. Stärkt Kundenbindung",
      "risk": "niedrig|mittel|hoch"
    }
  ],
  "recommendation": {
    "optionId": "A",
    "reasoning": "Begründung warum diese Option empfohlen wird",
    "nextSteps": ["Schritt 1", "Schritt 2"]
  },
  "estimatedFinancialImpact": 5000,
  "urgencyAssessment": "Einschätzung der tatsächlichen Dringlichkeit"
}`;

  const analysis = await generateJSON(prompt, {
    system: 'Du bist ein erfahrener Strategieberater für Tech-Startups in der Schweiz. Antworte immer auf Deutsch. Sei präzise und faktenbasiert. Gib valides JSON zurück.',
    model: agentConfig.models.decisions,
    maxTokens: 4096,
  });

  return analysis;
}

// ---------------------------------------------------------------------------
// Email Formatting
// ---------------------------------------------------------------------------

/**
 * Generate a beautifully formatted decision card HTML email.
 */
function formatDecisionEmail(decision, analysis) {
  const urgencyColors = {
    critical: '#e94560',
    high: '#ff6b35',
    medium: '#ffd166',
    low: '#06d6a0',
  };

  const urgencyEmojis = {
    critical: '\u{1F6A8}',
    high: '\u{26A0}\u{FE0F}',
    medium: '\u{1F4CB}',
    low: '\u{1F4AC}',
  };

  const riskColors = {
    niedrig: '#06d6a0',
    mittel: '#ffd166',
    hoch: '#e94560',
  };

  const urgency = (decision.Urgency || 'medium').toLowerCase();
  const urgencyColor = urgencyColors[urgency] || urgencyColors.medium;
  const urgencyEmoji = urgencyEmojis[urgency] || urgencyEmojis.medium;

  const optionsHtml = (analysis.options || []).map((opt) => {
    const riskColor = riskColors[opt.risk] || '#999';
    return `
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:12px 0;border-left:4px solid ${opt.id === analysis.recommendation?.optionId ? '#06d6a0' : '#ddd'};">
        <h3 style="margin:0 0 8px;color:#16213e;">
          ${opt.id === analysis.recommendation?.optionId ? '\u2B50 ' : ''}Option ${opt.id}: ${opt.title}
          ${opt.id === analysis.recommendation?.optionId ? '<span style="background:#06d6a0;color:white;padding:2px 8px;border-radius:12px;font-size:12px;margin-left:8px;">EMPFOHLEN</span>' : ''}
        </h3>
        <p style="margin:4px 0;color:#444;">${opt.description}</p>
        <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <strong style="color:#06d6a0;">\u2705 Pro:</strong>
            <ul style="margin:4px 0;padding-left:20px;">${(opt.pros || []).map(p => `<li>${p}</li>`).join('')}</ul>
          </div>
          <div style="flex:1;min-width:200px;">
            <strong style="color:#e94560;">\u274C Contra:</strong>
            <ul style="margin:4px 0;padding-left:20px;">${(opt.cons || []).map(c => `<li>${c}</li>`).join('')}</ul>
          </div>
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #eee;display:flex;gap:16px;flex-wrap:wrap;font-size:13px;">
          <span>\u{1F4B0} ${opt.financialImpact || '-'}</span>
          <span>\u{23F1}\u{FE0F} ${opt.timeImpact || '-'}</span>
          <span>\u{1F3AF} ${opt.strategicImpact || '-'}</span>
          <span style="color:${riskColor};font-weight:bold;">Risiko: ${opt.risk || '-'}</span>
        </div>
      </div>`;
  }).join('');

  const recommendationHtml = analysis.recommendation ? `
    <div style="background:#e8f5e9;border-radius:8px;padding:16px;margin:16px 0;border:2px solid #06d6a0;">
      <h3 style="margin:0 0 8px;color:#2e7d32;">\u{1F4A1} Empfehlung: Option ${analysis.recommendation.optionId}</h3>
      <p style="margin:4px 0;">${analysis.recommendation.reasoning}</p>
      ${analysis.recommendation.nextSteps ? `
        <div style="margin-top:12px;">
          <strong>Nächste Schritte:</strong>
          <ol style="margin:4px 0;">${analysis.recommendation.nextSteps.map(s => `<li>${s}</li>`).join('')}</ol>
        </div>` : ''}
    </div>` : '';

  return `
    <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h1 style="margin:0;font-size:20px;">${urgencyEmoji} Entscheidung erforderlich</h1>
          <span style="background:${urgencyColor};padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold;text-transform:uppercase;">${urgency}</span>
        </div>
        <h2 style="margin:8px 0 0;font-size:16px;opacity:0.9;">${decision.Title || 'Unbekannte Entscheidung'}</h2>
      </div>

      <div style="padding:20px 24px;background:#ffffff;border:1px solid #eee;">
        <div style="background:#f0f4ff;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
          <strong>Zusammenfassung:</strong> ${analysis.summary || decision.Description || '-'}
        </div>

        ${decision.RelatedClient ? `<p>\u{1F465} <strong>Betroffener Kunde:</strong> ${decision.RelatedClient}</p>` : ''}
        ${analysis.urgencyAssessment ? `<p>\u{23F0} <strong>Dringlichkeit:</strong> ${analysis.urgencyAssessment}</p>` : ''}
        ${analysis.estimatedFinancialImpact ? `<p>\u{1F4B0} <strong>Geschätzter finanzieller Impact:</strong> CHF ${analysis.estimatedFinancialImpact.toLocaleString('de-CH')}</p>` : ''}

        <h2 style="color:#16213e;border-bottom:2px solid #e94560;padding-bottom:8px;margin-top:24px;">Optionen</h2>
        ${optionsHtml}

        ${recommendationHtml}
      </div>

      <div style="padding:16px 24px;background:#f8f9fa;border-radius:0 0 8px 8px;border:1px solid #eee;border-top:none;">
        <p style="margin:0;color:#666;font-size:12px;text-align:center;">
          Werkpilot Decision Support &mdash; Antworten Sie mit Ihrer Entscheidung (A/B/C) und optionaler Begründung.
        </p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Decision Processing Pipeline
// ---------------------------------------------------------------------------

/**
 * Process a single new decision entry.
 */
async function processDecision(decision) {
  const decisionId = decision.id;
  const title = decision.Title || 'Unbekannt';

  logger.info(`Processing decision: "${title}" (${decisionId})`);

  try {
    // Mark as analyzing
    await updateRecord('Decisions', decisionId, { Status: 'analyzing' });

    // Gather context
    logger.info(`Gathering context for decision: ${title}`);
    const context = await gatherContext(decision);

    // Run AI analysis
    logger.info(`Running AI analysis for decision: ${title}`);
    const analysis = await analyzeDecision(context);

    // Update Airtable with analysis results
    await updateRecord('Decisions', decisionId, {
      Status: 'awaiting-decision',
      Context: JSON.stringify(context.additionalData, null, 2),
      Options: JSON.stringify(analysis.options, null, 2),
      AIRecommendation: analysis.recommendation
        ? `Option ${analysis.recommendation.optionId}: ${analysis.recommendation.reasoning}`
        : 'Keine klare Empfehlung',
      FinancialImpact: analysis.estimatedFinancialImpact || 0,
    });

    // Send email
    const emailHtml = formatDecisionEmail(decision, analysis);
    const urgencyPrefix = decision.Urgency === 'critical' ? '\u{1F6A8} DRINGEND: ' : '';

    await sendCEOEmail({
      subject: `${urgencyPrefix}Entscheidung: ${title}`,
      html: emailHtml,
    });

    // Save decision analysis locally
    saveDecisionLog(decision, analysis);

    logger.info(`Decision processed and sent: "${title}"`);
    return { success: true, decisionId, title };
  } catch (err) {
    logger.error(`Failed to process decision "${title}": ${err.message}`, { stack: err.stack });

    // Try to update status to reflect error
    try {
      await updateRecord('Decisions', decisionId, {
        Status: 'new',
        Context: `Analyse fehlgeschlagen: ${err.message}`,
      });
    } catch (updateErr) {
      logger.error(`Could not reset decision status: ${updateErr.message}`);
    }

    return { success: false, decisionId, title, error: err.message };
  }
}

/**
 * Save decision analysis to local log file.
 */
function saveDecisionLog(decision, analysis) {
  const decisionsDir = path.join(__dirname, agentConfig.decisionSupport.decisionsOutputDir);
  fs.mkdirSync(decisionsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = (decision.Title || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
  const filename = `${timestamp}_${slug}.json`;

  const logEntry = {
    timestamp: new Date().toISOString(),
    decision: {
      id: decision.id,
      title: decision.Title,
      category: decision.Category,
      urgency: decision.Urgency,
      description: decision.Description,
    },
    analysis,
  };

  fs.writeFileSync(
    path.join(decisionsDir, filename),
    JSON.stringify(logEntry, null, 2),
    'utf-8'
  );

  logger.info(`Decision log saved: ${filename}`);
}

// ---------------------------------------------------------------------------
// Polling Loop
// ---------------------------------------------------------------------------

/**
 * Check for new decisions that need processing.
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

      // Small delay between decisions
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
// Learning / Outcome Tracking
// ---------------------------------------------------------------------------

/**
 * Generate insights from past decisions for continuous improvement.
 */
async function generateDecisionInsights() {
  logger.info('Generating decision insights...');

  try {
    const completedDecisions = await getRecords(
      'Decisions',
      "AND({Status} = 'implemented', {OutcomeRating} != '')",
      50
    );

    if (completedDecisions.length < 3) {
      logger.info('Not enough completed decisions for insight generation');
      return null;
    }

    const prompt = `Analysiere die folgenden abgeschlossenen Entscheidungen und identifiziere Muster:

${JSON.stringify(completedDecisions.map(d => ({
  title: d.Title,
  category: d.Category,
  aiRecommendation: d.AIRecommendation,
  ceoDecision: d.CEODecision,
  outcome: d.Outcome,
  rating: d.OutcomeRating,
})), null, 2)}

Erstelle einen kurzen Bericht mit:
1. Häufigste Entscheidungskategorien
2. Erfolgsrate der KI-Empfehlungen (wenn CEO der Empfehlung folgte vs. nicht)
3. Muster bei erfolgreichen vs. weniger erfolgreichen Entscheidungen
4. Verbesserungsvorschläge für den Entscheidungsprozess`;

    const insights = await generateText(prompt, {
      system: 'Du bist ein Datenanalyst. Sei präzise und faktenbasiert. Antworte auf Deutsch.',
      model: agentConfig.models.decisions,
      maxTokens: 2048,
    });

    return insights;
  } catch (err) {
    logger.error(`Insight generation failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function start() {
  // Load action handlers
  loadActionHandlers();

  // Poll for new decisions every 5 minutes
  const pollSchedule = agentConfig.decisionSupport.pollInterval;
  logger.info(`Decision Support Agent starting. Poll schedule: ${pollSchedule}`);

  cron.schedule(pollSchedule, () => {
    logger.info('Cron triggered: decision poll');
    pollForNewDecisions();
  });

  // Generate weekly insights on Sundays at 20:00
  cron.schedule('0 20 * * 0', () => {
    logger.info('Cron triggered: weekly decision insights');
    generateDecisionInsights().then(insights => {
      if (insights) {
        sendCEOEmail({
          subject: 'Wöchentliche Decision Insights',
          html: `<div style="font-family:sans-serif;padding:20px;max-width:700px;margin:0 auto;">
            <h2>Decision Learning Report</h2>
            <pre style="white-space:pre-wrap;background:#f8f9fa;padding:16px;border-radius:8px;">${insights}</pre>
          </div>`,
        });
      }
    });
  }, {
    timezone: agentConfig.decisionSupport.timezone || 'Europe/Zurich',
  });

  logger.info('Decision Support Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--poll') || args.includes('-p')) {
    logger.info('Running decision poll immediately (manual trigger)');
    loadActionHandlers();
    pollForNewDecisions().then((results) => {
      logger.info(`Processed ${results.length} decision(s)`);
      results.forEach(r => {
        logger.info(`  - ${r.title}: ${r.success ? 'OK' : 'FAILED'}`);
      });
    });
  } else if (args.includes('--insights') || args.includes('-i')) {
    logger.info('Generating decision insights (manual trigger)');
    generateDecisionInsights().then((insights) => {
      if (insights) {
        console.log('\n' + insights);
      } else {
        console.log('No insights generated (not enough data).');
      }
    });
  } else {
    start();
  }
}

module.exports = { start, pollForNewDecisions, processDecision, generateDecisionInsights };
