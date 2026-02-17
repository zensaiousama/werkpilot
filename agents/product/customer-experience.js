/**
 * Agent 16 - Customer Experience Agent
 *
 * Maps customer journey, manages NPS surveys, sentiment analysis,
 * churn prediction, onboarding flow, health scoring, and intervention
 * recommendations.
 *
 * Schedule: Daily health checks, monthly NPS, ongoing onboarding monitoring
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('customer-experience');

// --- Airtable Tables ---
const TABLES = {
  CLIENTS: 'Clients',
  NPS_RESPONSES: 'NPS_Responses',
  CUSTOMER_HEALTH: 'Customer_Health',
  ONBOARDING: 'Client_Onboarding',
  INTERVENTIONS: 'CX_Interventions',
  JOURNEY_EVENTS: 'Journey_Events',
  INVOICES: 'Invoices',
};

const JOURNEY_MAP_PATH = path.join(__dirname, 'journey-map.json');
const NPS_TEMPLATE_PATH = path.join(__dirname, 'nps-survey-template.html');

// ============================================================
// Customer Health Scoring
// ============================================================

/**
 * Health score weights:
 * - NPS score (25%)
 * - Engagement frequency (25%)
 * - Payment timeliness (20%)
 * - Support ticket trend (15%)
 * - Feature adoption (15%)
 */
const HEALTH_WEIGHTS = {
  nps: 0.25,
  engagement: 0.25,
  payment: 0.20,
  support: 0.15,
  adoption: 0.15,
};

function calculateHealthScore(metrics) {
  const {
    npsScore = 5,
    engagementScore = 50,
    paymentScore = 100,
    supportScore = 80,
    adoptionScore = 50,
  } = metrics;

  // Normalize NPS (1-10) to 0-100
  const normalizedNPS = Math.min(100, Math.max(0, (npsScore / 10) * 100));

  const weightedScore =
    normalizedNPS * HEALTH_WEIGHTS.nps +
    engagementScore * HEALTH_WEIGHTS.engagement +
    paymentScore * HEALTH_WEIGHTS.payment +
    supportScore * HEALTH_WEIGHTS.support +
    adoptionScore * HEALTH_WEIGHTS.adoption;

  return Math.round(weightedScore);
}

function getHealthStatus(score) {
  if (score >= 70) return 'Green';
  if (score >= 40) return 'Yellow';
  return 'Red';
}

async function calculateAllHealthScores() {
  logger.info('Calculating customer health scores');

  try {
    const clients = await getRecords(TABLES.CLIENTS, '{Status} = "Active"');
    const results = { green: 0, yellow: 0, red: 0, updated: 0 };

    for (const client of clients) {
      try {
        // Gather metrics for this client
        const metrics = await gatherClientMetrics(client);
        const score = calculateHealthScore(metrics);
        const status = getHealthStatus(score);

        // Get previous health record
        const previousHealth = await getRecords(
          TABLES.CUSTOMER_HEALTH,
          `{Client} = "${client.Name || client.Company}"`,
          1
        );

        const previousScore = previousHealth.length > 0 ? previousHealth[0].Score || 0 : 0;
        const previousStatus = previousHealth.length > 0 ? previousHealth[0].Status || '' : '';
        const trend = score > previousScore ? 'Improving' : score < previousScore ? 'Declining' : 'Stable';

        if (previousHealth.length > 0) {
          await updateRecord(TABLES.CUSTOMER_HEALTH, previousHealth[0].id, {
            Score: score,
            Status: status,
            Trend: trend,
            NPS_Component: Math.round(metrics.npsScore * 10),
            Engagement_Component: Math.round(metrics.engagementScore),
            Payment_Component: Math.round(metrics.paymentScore),
            Support_Component: Math.round(metrics.supportScore),
            Adoption_Component: Math.round(metrics.adoptionScore),
            Last_Updated: new Date().toISOString(),
          });
        } else {
          await createRecord(TABLES.CUSTOMER_HEALTH, {
            Client: client.Name || client.Company,
            Score: score,
            Status: status,
            Trend: 'New',
            NPS_Component: Math.round(metrics.npsScore * 10),
            Engagement_Component: Math.round(metrics.engagementScore),
            Payment_Component: Math.round(metrics.paymentScore),
            Support_Component: Math.round(metrics.supportScore),
            Adoption_Component: Math.round(metrics.adoptionScore),
            Last_Updated: new Date().toISOString(),
          });
        }

        results[status.toLowerCase()]++;
        results.updated++;

        // Flag status change transitions
        if (previousStatus && previousStatus !== status) {
          logger.info(`Health status change: ${client.Name || client.Company} ${previousStatus} -> ${status}`);

          if (status === 'Red' || (previousStatus === 'Green' && status === 'Yellow')) {
            await createIntervention(client, score, status, metrics, trend);
          }
        }
      } catch (err) {
        logger.warn(`Failed to score client: ${client.Name || client.Company}`, {
          error: err.message,
        });
      }
    }

    logger.info('Health scores updated', results);
    return results;
  } catch (err) {
    logger.error('Failed to calculate health scores', { error: err.message });
    return { green: 0, yellow: 0, red: 0, updated: 0 };
  }
}

async function gatherClientMetrics(client) {
  const clientName = client.Name || client.Company;
  const metrics = {
    npsScore: 5,
    engagementScore: 50,
    paymentScore: 100,
    supportScore: 80,
    adoptionScore: 50,
  };

  try {
    // NPS - latest score
    const npsRecords = await getRecords(
      TABLES.NPS_RESPONSES,
      `{Client} = "${clientName}"`,
      1
    );
    if (npsRecords.length > 0) {
      metrics.npsScore = npsRecords[0].Score || 5;
    }

    // Engagement - based on last activity
    const journeyEvents = await getRecords(
      TABLES.JOURNEY_EVENTS,
      `{Client} = "${clientName}"`,
      10
    );
    if (journeyEvents.length > 0) {
      const lastEvent = journeyEvents[0];
      const daysSince = lastEvent.Date
        ? Math.floor(
            (Date.now() - new Date(lastEvent.Date).getTime()) / (1000 * 60 * 60 * 24)
          )
        : 30;

      if (daysSince <= 7) metrics.engagementScore = 100;
      else if (daysSince <= 14) metrics.engagementScore = 80;
      else if (daysSince <= 30) metrics.engagementScore = 60;
      else if (daysSince <= 60) metrics.engagementScore = 30;
      else metrics.engagementScore = 10;
    }

    // Payment - based on invoice status
    const invoices = await getRecords(
      TABLES.INVOICES,
      `AND({Client} = "${clientName}", {Status} != "Paid")`,
      5
    );
    const overdueCount = invoices.filter((i) => i.Status === 'Overdue').length;
    if (overdueCount >= 3) metrics.paymentScore = 10;
    else if (overdueCount >= 2) metrics.paymentScore = 30;
    else if (overdueCount >= 1) metrics.paymentScore = 60;
    else if (invoices.length > 0) metrics.paymentScore = 85;
    else metrics.paymentScore = 100;

    // Support - based on open tickets
    const supportTickets = await getRecords(
      'Support_Tickets',
      `AND({Client} = "${clientName}", {Status} != "Resolved")`,
      10
    );
    const openTickets = supportTickets.length;
    if (openTickets >= 5) metrics.supportScore = 20;
    else if (openTickets >= 3) metrics.supportScore = 50;
    else if (openTickets >= 1) metrics.supportScore = 75;
    else metrics.supportScore = 100;

    // Adoption - based on features used
    const adoptionRecords = await getRecords(
      'Feature_Adoption',
      `{Client} = "${clientName}"`,
      50
    );
    const totalFeatures = 10; // assumed total available features
    const usedFeatures = adoptionRecords.length;
    metrics.adoptionScore = Math.min(100, Math.round((usedFeatures / totalFeatures) * 100));
  } catch (err) {
    logger.warn(`Failed to gather all metrics for ${clientName}`, { error: err.message });
  }

  return metrics;
}

// ============================================================
// Intervention Recommendations
// ============================================================

async function createIntervention(client, score, status, metrics, trend) {
  logger.info(`Creating intervention for ${client.Name || client.Company} (${status})`);

  try {
    const recommendation = await generateJSON(
      `A customer's health score has dropped. Recommend an intervention.

Customer: ${client.Name || client.Company}
Industry: ${client.Industry || 'Unknown'}
Plan: ${client.Plan || 'Unknown'}
Health Score: ${score}/100 (${status})
Trend: ${trend}

Component Scores:
- NPS: ${Math.round(metrics.npsScore * 10)}/100
- Engagement: ${Math.round(metrics.engagementScore)}/100
- Payment: ${Math.round(metrics.paymentScore)}/100
- Support: ${Math.round(metrics.supportScore)}/100
- Feature Adoption: ${Math.round(metrics.adoptionScore)}/100

Return JSON with:
- urgency: "immediate", "this_week", "this_month"
- intervention_type: "call", "email", "meeting", "discount_offer", "feature_training", "executive_outreach"
- recommended_action: specific action to take (2-3 sentences)
- talking_points: array of 3 key things to discuss
- churn_risk: "high", "medium", "low"
- root_cause: what is likely causing the decline`,
      { model: config.models.standard, maxTokens: 512 }
    );

    await createRecord(TABLES.INTERVENTIONS, {
      Client: client.Name || client.Company,
      Health_Score: score,
      Health_Status: status,
      Urgency: recommendation.urgency,
      Type: recommendation.intervention_type,
      Action: recommendation.recommended_action,
      Talking_Points: JSON.stringify(recommendation.talking_points),
      Churn_Risk: recommendation.churn_risk,
      Root_Cause: recommendation.root_cause,
      Status: 'Pending',
      Created_Date: new Date().toISOString().split('T')[0],
    });

    // Alert for high churn risk
    if (recommendation.churn_risk === 'high') {
      await sendCEOEmail({
        subject: `CHURN ALERT: ${client.Name || client.Company} (Score: ${score})`,
        html: `
          <h2 style="color: #d32f2f;">High Churn Risk Alert</h2>
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold;">Client:</td><td>${client.Name || client.Company}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Health Score:</td><td style="color: ${status === 'Red' ? '#d32f2f' : '#f57c00'};">${score}/100 (${status})</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Trend:</td><td>${trend}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Root Cause:</td><td>${recommendation.root_cause}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Urgency:</td><td>${recommendation.urgency}</td></tr>
            </table>
            <h3>Recommended Action</h3>
            <p>${recommendation.recommended_action}</p>
            <h3>Talking Points</h3>
            <ul>
              ${(recommendation.talking_points || []).map((p) => `<li>${p}</li>`).join('')}
            </ul>
          </div>
        `,
      });
    }

    return recommendation;
  } catch (err) {
    logger.error('Failed to create intervention', { error: err.message });
    return null;
  }
}

// ============================================================
// NPS Survey Management
// ============================================================

async function sendNPSSurveys() {
  logger.info('Sending monthly NPS surveys');

  try {
    const clients = await getRecords(TABLES.CLIENTS, '{Status} = "Active"');
    let sent = 0;

    // Load NPS template
    let template;
    try {
      template = fs.readFileSync(NPS_TEMPLATE_PATH, 'utf-8');
    } catch (err) {
      logger.error('Failed to load NPS template', { error: err.message });
      return 0;
    }

    const now = new Date();
    const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    for (const client of clients) {
      try {
        const contactEmail = client.Contact_Email || client.Email;
        const contactName = client.Contact_Name || client.Name || 'Valued Customer';

        if (!contactEmail) {
          logger.warn(`No email for client: ${client.Name || client.Company}`);
          continue;
        }

        // Check if NPS was already sent this month
        const recentNPS = await getRecords(
          TABLES.NPS_RESPONSES,
          `AND({Client} = "${client.Name || client.Company}", {Month} = "${monthYear}")`,
          1
        );

        if (recentNPS.length > 0) continue;

        // Personalize template
        const surveyUrl = `${config.website.url}/nps?client=${encodeURIComponent(client.Name || client.Company)}&month=${encodeURIComponent(monthYear)}`;
        const personalizedHTML = template
          .replace(/\[CLIENT_NAME\]/g, contactName)
          .replace(/\[COMPANY_NAME\]/g, client.Name || client.Company || '')
          .replace(/\[SURVEY_URL\]/g, surveyUrl)
          .replace(/\[MONTH_YEAR\]/g, monthYear);

        await sendEmail({
          to: contactEmail,
          subject: `How are we doing? Quick feedback for ${monthYear}`,
          html: personalizedHTML,
        });

        // Create a pending NPS record
        await createRecord(TABLES.NPS_RESPONSES, {
          Client: client.Name || client.Company,
          Contact_Email: contactEmail,
          Month: monthYear,
          Status: 'Sent',
          Sent_Date: now.toISOString().split('T')[0],
        });

        sent++;
        logger.info(`NPS survey sent to ${contactEmail}`);
      } catch (err) {
        logger.warn(`Failed to send NPS to ${client.Name || client.Company}`, {
          error: err.message,
        });
      }
    }

    logger.info(`Sent ${sent} NPS surveys`);
    return sent;
  } catch (err) {
    logger.error('Failed to send NPS surveys', { error: err.message });
    return 0;
  }
}

async function analyzeNPSResponses() {
  logger.info('Analyzing NPS responses with sentiment analysis');

  try {
    const unanalyzed = await getRecords(
      TABLES.NPS_RESPONSES,
      'AND({Status} = "Received", {Sentiment} = BLANK())'
    );

    if (unanalyzed.length === 0) {
      logger.info('No unanalyzed NPS responses');
      return [];
    }

    const analyses = [];

    for (const response of unanalyzed) {
      try {
        if (!response.Comment) {
          await updateRecord(TABLES.NPS_RESPONSES, response.id, {
            Sentiment: response.Score >= 9 ? 'Positive' : response.Score >= 7 ? 'Neutral' : 'Negative',
            Themes: 'No comment provided',
            Status: 'Analyzed',
          });
          continue;
        }

        const analysis = await generateJSON(
          `Analyze this NPS survey response.

Client: ${response.Client}
NPS Score: ${response.Score}/10
Comment: "${response.Comment}"

Return JSON with:
- sentiment: "Positive", "Neutral", or "Negative"
- themes: array of 1-3 key themes/topics mentioned
- urgency: "none", "low", "medium", "high" (does this need immediate attention?)
- action_required: boolean
- suggested_response: brief suggested reply to the customer (1-2 sentences)
- improvement_area: which area needs improvement (e.g., "onboarding", "support", "features", "pricing", "communication")`,
          { model: config.models.fast, maxTokens: 512 }
        );

        await updateRecord(TABLES.NPS_RESPONSES, response.id, {
          Sentiment: analysis.sentiment,
          Themes: Array.isArray(analysis.themes) ? analysis.themes.join(', ') : analysis.themes,
          Urgency: analysis.urgency,
          Action_Required: analysis.action_required,
          Suggested_Response: analysis.suggested_response,
          Improvement_Area: analysis.improvement_area,
          Status: 'Analyzed',
          Analyzed_Date: new Date().toISOString().split('T')[0],
        });

        analyses.push({
          client: response.Client,
          score: response.Score,
          sentiment: analysis.sentiment,
          urgency: analysis.urgency,
        });

        // Flag high-urgency responses
        if (analysis.urgency === 'high') {
          await sendCEOEmail({
            subject: `Urgent NPS Response: ${response.Client} (${response.Score}/10)`,
            html: `
              <h2>Urgent NPS Feedback</h2>
              <p><strong>Client:</strong> ${response.Client}</p>
              <p><strong>Score:</strong> ${response.Score}/10</p>
              <p><strong>Comment:</strong> "${response.Comment}"</p>
              <p><strong>Sentiment:</strong> ${analysis.sentiment}</p>
              <p><strong>Improvement Area:</strong> ${analysis.improvement_area}</p>
              <p><strong>Suggested Response:</strong> ${analysis.suggested_response}</p>
            `,
          });
        }
      } catch (err) {
        logger.warn(`Failed to analyze NPS for ${response.Client}`, { error: err.message });
      }
    }

    logger.info(`Analyzed ${analyses.length} NPS responses`);
    return analyses;
  } catch (err) {
    logger.error('Failed to analyze NPS responses', { error: err.message });
    return [];
  }
}

// ============================================================
// Churn Prediction
// ============================================================

async function predictChurn() {
  logger.info('Running churn prediction model');

  try {
    const healthRecords = await getRecords(TABLES.CUSTOMER_HEALTH, '');
    const predictions = [];

    for (const record of healthRecords) {
      try {
        const churnSignals = [];
        const score = record.Score || 50;

        // Declining engagement
        if ((record.Engagement_Component || 50) < 30) {
          churnSignals.push('Low engagement');
        }

        // Late payments
        if ((record.Payment_Component || 100) < 50) {
          churnSignals.push('Payment issues');
        }

        // Low NPS
        if ((record.NPS_Component || 50) < 40) {
          churnSignals.push('Low satisfaction');
        }

        // Declining trend
        if (record.Trend === 'Declining') {
          churnSignals.push('Declining health trend');
        }

        // Low adoption
        if ((record.Adoption_Component || 50) < 25) {
          churnSignals.push('Low feature adoption');
        }

        // Calculate churn probability
        let churnProbability = 0;
        if (score < 30) churnProbability = 80;
        else if (score < 50) churnProbability = 50;
        else if (score < 70) churnProbability = 20;
        else churnProbability = 5;

        // Adjust by signal count
        churnProbability = Math.min(95, churnProbability + churnSignals.length * 5);

        if (churnProbability >= 40) {
          predictions.push({
            client: record.Client,
            score,
            churnProbability,
            signals: churnSignals,
            status: record.Status,
          });
        }
      } catch (err) {
        logger.warn(`Churn prediction failed for ${record.Client}`, { error: err.message });
      }
    }

    // Sort by churn probability descending
    predictions.sort((a, b) => b.churnProbability - a.churnProbability);

    if (predictions.length > 0) {
      logger.warn(`Churn risk detected for ${predictions.length} clients`);
    }

    return predictions;
  } catch (err) {
    logger.error('Failed to run churn prediction', { error: err.message });
    return [];
  }
}

// ============================================================
// Onboarding Flow Management
// ============================================================

async function monitorOnboarding() {
  logger.info('Monitoring client onboarding flow');

  try {
    const pendingOnboarding = await getRecords(
      TABLES.ONBOARDING,
      '{Status} != "Completed"'
    );

    const alerts = [];

    for (const onboarding of pendingOnboarding) {
      try {
        const startDate = new Date(onboarding.Start_Date);
        const hoursElapsed = (Date.now() - startDate.getTime()) / (1000 * 60 * 60);

        // Alert if onboarding exceeds 48h
        if (hoursElapsed > 48 && onboarding.Status !== 'Delayed') {
          await updateRecord(TABLES.ONBOARDING, onboarding.id, {
            Status: 'Delayed',
            Delay_Hours: Math.round(hoursElapsed - 48),
          });

          alerts.push({
            client: onboarding.Client,
            hoursElapsed: Math.round(hoursElapsed),
            currentStep: onboarding.Current_Step || 'Unknown',
          });

          // Notify about delay
          await sendCEOEmail({
            subject: `Onboarding Delay: ${onboarding.Client} (${Math.round(hoursElapsed)}h)`,
            html: `
              <h2>Onboarding Delay Alert</h2>
              <p><strong>Client:</strong> ${onboarding.Client}</p>
              <p><strong>Started:</strong> ${startDate.toISOString()}</p>
              <p><strong>Hours Elapsed:</strong> ${Math.round(hoursElapsed)}</p>
              <p><strong>Current Step:</strong> ${onboarding.Current_Step || 'Unknown'}</p>
              <p><strong>Blocker:</strong> ${onboarding.Blocker || 'Unknown'}</p>
              <p>Target: Complete setup within 48 hours of contract signing.</p>
            `,
          });

          logger.warn(`Onboarding delay: ${onboarding.Client} at ${Math.round(hoursElapsed)}h`);
        }

        // Check for stalled onboarding steps
        const lastUpdate = new Date(onboarding.Last_Updated || onboarding.Start_Date);
        const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

        if (hoursSinceUpdate > 24 && onboarding.Status === 'In Progress') {
          // Generate automated nudge
          const clientEmail = onboarding.Contact_Email;
          if (clientEmail) {
            const nudgeContent = await generateText(
              `Write a friendly, brief onboarding check-in email.

Client: ${onboarding.Client}
Current Step: ${onboarding.Current_Step || 'setup'}
Hours since last activity: ${Math.round(hoursSinceUpdate)}

Ask if they need help. Offer to schedule a quick call. Keep under 100 words. Professional but warm tone.`,
              { model: config.models.fast, maxTokens: 256 }
            );

            await sendEmail({
              to: clientEmail,
              subject: `Quick check-in on your Werkpilot setup`,
              html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${nudgeContent.replace(/\n/g, '<br>')}</div>`,
            });

            logger.info(`Onboarding nudge sent to ${onboarding.Client}`);
          }
        }
      } catch (err) {
        logger.warn(`Failed to process onboarding: ${onboarding.Client}`, {
          error: err.message,
        });
      }
    }

    logger.info(`Onboarding monitoring complete. ${alerts.length} delays detected.`);
    return { pending: pendingOnboarding.length, delayed: alerts.length };
  } catch (err) {
    logger.error('Failed to monitor onboarding', { error: err.message });
    return { pending: 0, delayed: 0 };
  }
}

// ============================================================
// Journey Event Tracking
// ============================================================

async function trackJourneyEvents() {
  logger.info('Tracking customer journey events');

  const journeyMap = loadJourneyMap();
  const stages = journeyMap.stages;

  try {
    const clients = await getRecords(TABLES.CLIENTS, '{Status} = "Active"');

    for (const client of clients) {
      try {
        const events = await getRecords(
          TABLES.JOURNEY_EVENTS,
          `{Client} = "${client.Name || client.Company}"`,
          50
        );

        // Determine current stage
        const currentStage = determineStage(events, stages);

        if (currentStage !== client.Journey_Stage) {
          await updateRecord(TABLES.CLIENTS, client.id, {
            Journey_Stage: currentStage,
            Stage_Updated: new Date().toISOString().split('T')[0],
          });

          logger.info(
            `Journey stage update: ${client.Name || client.Company} -> ${currentStage}`
          );
        }
      } catch (err) {
        logger.warn(`Failed to track journey for ${client.Name || client.Company}`, {
          error: err.message,
        });
      }
    }
  } catch (err) {
    logger.error('Failed to track journey events', { error: err.message });
  }
}

function determineStage(events, stages) {
  if (!events || events.length === 0) return 'Awareness';

  const eventTypes = events.map((e) => e.Event_Type || '');

  // Work backwards from Advocacy to Awareness
  const stageOrder = ['Advocacy', 'Expansion', 'Active', 'Onboarding', 'Purchase', 'Consideration', 'Awareness'];

  for (const stage of stageOrder) {
    const stageConfig = stages.find((s) => s.name === stage);
    if (stageConfig && stageConfig.indicators) {
      const hasIndicator = stageConfig.indicators.some((ind) =>
        eventTypes.includes(ind)
      );
      if (hasIndicator) return stage;
    }
  }

  return 'Awareness';
}

function loadJourneyMap() {
  try {
    return JSON.parse(fs.readFileSync(JOURNEY_MAP_PATH, 'utf-8'));
  } catch (err) {
    logger.warn('Failed to load journey map', { error: err.message });
    return { stages: [] };
  }
}

// ============================================================
// CX Monthly Report
// ============================================================

async function generateCXReport() {
  logger.info('Generating CX monthly report');

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];

    const healthRecords = await getRecords(TABLES.CUSTOMER_HEALTH, '');
    const npsResponses = await getRecords(
      TABLES.NPS_RESPONSES,
      `AND({Status} = "Analyzed", {Analyzed_Date} >= "${monthStart}")`
    );
    const interventions = await getRecords(
      TABLES.INTERVENTIONS,
      `{Created_Date} >= "${monthStart}"`
    );
    const churnPredictions = await predictChurn();

    const greenCount = healthRecords.filter((h) => h.Status === 'Green').length;
    const yellowCount = healthRecords.filter((h) => h.Status === 'Yellow').length;
    const redCount = healthRecords.filter((h) => h.Status === 'Red').length;

    const avgNPS =
      npsResponses.length > 0
        ? (npsResponses.reduce((sum, r) => sum + (r.Score || 0), 0) / npsResponses.length).toFixed(1)
        : 'N/A';

    const promoters = npsResponses.filter((r) => (r.Score || 0) >= 9).length;
    const passives = npsResponses.filter((r) => (r.Score || 0) >= 7 && (r.Score || 0) < 9).length;
    const detractors = npsResponses.filter((r) => (r.Score || 0) < 7).length;
    const npsNetScore =
      npsResponses.length > 0
        ? Math.round(((promoters - detractors) / npsResponses.length) * 100)
        : 'N/A';

    const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    await sendCEOEmail({
      subject: `Customer Experience Report - ${monthName}`,
      html: `
        <h1>Customer Experience Report - ${monthName}</h1>
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 700px;">
          <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">${greenCount}</div>
              <div>Green</div>
            </div>
            <div style="background: #fff8e1; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #f57f17;">${yellowCount}</div>
              <div>Yellow</div>
            </div>
            <div style="background: #ffebee; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #c62828;">${redCount}</div>
              <div>Red</div>
            </div>
          </div>

          <h2>NPS Summary</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Net NPS Score</strong></td><td>${npsNetScore}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Average Score</strong></td><td>${avgNPS}/10</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Responses</strong></td><td>${npsResponses.length}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Promoters / Passives / Detractors</strong></td><td>${promoters} / ${passives} / ${detractors}</td></tr>
          </table>

          <h2>Churn Risk</h2>
          <p>${churnPredictions.length} clients at elevated churn risk</p>
          ${churnPredictions.slice(0, 5).map((p) => `<p style="color: ${p.churnProbability >= 60 ? '#c62828' : '#f57f17'};">${p.client}: ${p.churnProbability}% risk (${p.signals.join(', ')})</p>`).join('')}

          <h2>Interventions</h2>
          <p>${interventions.length} interventions created this month</p>

          <hr style="margin-top: 30px;">
          <p style="color: #666; font-size: 12px;">Generated by Werkpilot Customer Experience Agent</p>
        </div>
      `,
    });

    logger.info('CX monthly report sent');
  } catch (err) {
    logger.error('Failed to generate CX report', { error: err.message });
  }
}

// ============================================================
// Main Execution Flows
// ============================================================

async function runDailyHealthCheck() {
  logger.info('=== Daily Customer Health Check ===');
  const startTime = Date.now();

  try {
    const healthResults = await calculateAllHealthScores();
    const onboardingResults = await monitorOnboarding();
    await analyzeNPSResponses();
    await trackJourneyEvents();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Daily health check complete in ${duration}s`, {
      ...healthResults,
      onboarding: onboardingResults,
    });
  } catch (err) {
    logger.error('Daily health check failed', { error: err.message, stack: err.stack });
  }
}

async function runMonthlyNPS() {
  logger.info('=== Monthly NPS Survey ===');
  try {
    const sent = await sendNPSSurveys();
    logger.info(`Monthly NPS complete: ${sent} surveys sent`);
  } catch (err) {
    logger.error('Monthly NPS failed', { error: err.message, stack: err.stack });
  }
}

// ============================================================
// Cron Schedules
// ============================================================

// Daily at 06:00 - health scoring, onboarding, NPS analysis
cron.schedule('0 6 * * *', () => {
  runDailyHealthCheck().catch((err) =>
    logger.error('Cron daily health check failed', { error: err.message })
  );
});

// Monthly on the 15th at 09:00 - send NPS surveys
cron.schedule('0 9 15 * *', () => {
  runMonthlyNPS().catch((err) =>
    logger.error('Cron monthly NPS failed', { error: err.message })
  );
});

// Monthly on the 3rd at 10:00 - CX report (after NPS analysis completes)
cron.schedule('0 10 3 * *', () => {
  generateCXReport().catch((err) =>
    logger.error('Cron CX report failed', { error: err.message })
  );
});

// ============================================================
// Exports
// ============================================================

module.exports = {
  runDailyHealthCheck,
  runMonthlyNPS,
  generateCXReport,
  calculateAllHealthScores,
  calculateHealthScore,
  getHealthStatus,
  sendNPSSurveys,
  analyzeNPSResponses,
  predictChurn,
  monitorOnboarding,
  trackJourneyEvents,
  createIntervention,
};

// Run immediately if executed directly
if (require.main === module) {
  logger.info('Customer Experience Agent starting (direct execution)');
  runDailyHealthCheck()
    .then(() => logger.info('Customer Experience Agent initial run complete'))
    .catch((err) => {
      logger.error('Customer Experience Agent failed', { error: err.message });
      process.exit(1);
    });
}
