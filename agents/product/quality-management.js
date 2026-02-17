/**
 * Agent 18 - Quality Management Agent
 *
 * Reviews ALL outputs from ALL agents before delivery. Checks grammar,
 * spelling, brand voice, factual accuracy, SEO quality, email quality,
 * and report accuracy. Maintains quality scores per agent and sends
 * improvement feedback.
 *
 * Schedule: Continuous review queue, weekly quality report
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('quality-management');

// --- Airtable Tables ---
const TABLES = {
  QUALITY_QUEUE: 'Quality_Queue',
  QUALITY_RESULTS: 'Quality_Results',
  AGENT_SCORES: 'Agent_Quality_Scores',
  QUALITY_FEEDBACK: 'Quality_Feedback',
};

const QUALITY_RULES_PATH = path.join(__dirname, 'quality-rules.json');
const QUALITY_LOG_PATH = path.join(__dirname, 'quality-log.json');

const MINIMUM_QUALITY_SCORE = 85;

// ============================================================
// Quality Rules Loading
// ============================================================

function loadQualityRules() {
  try {
    return JSON.parse(fs.readFileSync(QUALITY_RULES_PATH, 'utf-8'));
  } catch (err) {
    logger.error('Failed to load quality rules', { error: err.message });
    return { contentTypes: {} };
  }
}

function loadQualityLog() {
  try {
    return JSON.parse(fs.readFileSync(QUALITY_LOG_PATH, 'utf-8'));
  } catch (err) {
    return { reviews: [], lastUpdated: null };
  }
}

function saveQualityLog(log) {
  log.lastUpdated = new Date().toISOString();
  fs.writeFileSync(QUALITY_LOG_PATH, JSON.stringify(log, null, 2));
}

// ============================================================
// Content Quality Review
// ============================================================

async function reviewContent(content, contentType, agentName, metadata = {}) {
  logger.info(`Reviewing ${contentType} from ${agentName}`);

  const rules = loadQualityRules();
  const typeRules = rules.contentTypes[contentType] || rules.contentTypes.general;

  if (!typeRules) {
    logger.warn(`No quality rules found for content type: ${contentType}`);
    return null;
  }

  try {
    // Build the review prompt based on content type
    const checks = typeRules.checks || [];
    const checkDescriptions = checks
      .map((c) => `- ${c.name}: ${c.description} (weight: ${c.weight})`)
      .join('\n');

    const review = await generateJSON(
      `You are a quality assurance reviewer for a professional AI automation company (Werkpilot, Swiss-based).

Review this ${contentType} content produced by the ${agentName} agent.

CONTENT TO REVIEW:
---
${typeof content === 'string' ? content.substring(0, 5000) : JSON.stringify(content).substring(0, 5000)}
---

QUALITY CHECKS TO PERFORM:
${checkDescriptions}

BRAND VOICE GUIDELINES:
- Professional yet approachable
- Confident but not arrogant
- Clear and concise
- Data-driven
- Swiss quality standards

${metadata.targetAudience ? `TARGET AUDIENCE: ${metadata.targetAudience}` : ''}
${metadata.language ? `LANGUAGE: ${metadata.language}` : ''}
${metadata.seoKeywords ? `SEO KEYWORDS: ${metadata.seoKeywords}` : ''}

Return JSON with:
- overall_score: 0-100 composite quality score
- checks: array of { name, score (0-100), passed (boolean), issues: [string], suggestions: [string] }
- critical_issues: array of issues that MUST be fixed before delivery
- minor_issues: array of nice-to-fix issues
- brand_voice_aligned: boolean
- factual_concerns: array of statements that may need fact-checking
- improved_version: null or an improved version if score < ${MINIMUM_QUALITY_SCORE} (only for text content under 1000 chars)
- summary: 2-3 sentence quality assessment`,
      { model: config.models.standard, maxTokens: 3000 }
    );

    // Calculate weighted score
    const weightedScore = calculateWeightedScore(review.checks || [], checks);
    review.weighted_score = weightedScore;

    // Log the review
    const logEntry = {
      timestamp: new Date().toISOString(),
      agent: agentName,
      contentType,
      score: review.overall_score || weightedScore,
      passed: (review.overall_score || weightedScore) >= MINIMUM_QUALITY_SCORE,
      criticalIssues: (review.critical_issues || []).length,
      minorIssues: (review.minor_issues || []).length,
    };

    const qualityLog = loadQualityLog();
    qualityLog.reviews.push(logEntry);

    // Keep only last 1000 reviews in local log
    if (qualityLog.reviews.length > 1000) {
      qualityLog.reviews = qualityLog.reviews.slice(-1000);
    }
    saveQualityLog(qualityLog);

    // Save to Airtable
    try {
      await createRecord(TABLES.QUALITY_RESULTS, {
        Agent: agentName,
        Content_Type: contentType,
        Score: review.overall_score || weightedScore,
        Passed: (review.overall_score || weightedScore) >= MINIMUM_QUALITY_SCORE,
        Critical_Issues: JSON.stringify(review.critical_issues || []),
        Minor_Issues: JSON.stringify(review.minor_issues || []),
        Summary: review.summary,
        Review_Date: new Date().toISOString().split('T')[0],
      });
    } catch (err) {
      logger.warn('Failed to save quality result to Airtable', { error: err.message });
    }

    // Flag if below threshold
    const score = review.overall_score || weightedScore;
    if (score < MINIMUM_QUALITY_SCORE) {
      logger.warn(`Quality below threshold: ${agentName} ${contentType} = ${score}/100`);
      await flagLowQuality(agentName, contentType, score, review);
    }

    return review;
  } catch (err) {
    logger.error(`Quality review failed for ${contentType} from ${agentName}`, {
      error: err.message,
    });
    return null;
  }
}

function calculateWeightedScore(reviewChecks, ruleChecks) {
  if (!reviewChecks || reviewChecks.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const check of reviewChecks) {
    const rule = ruleChecks.find((r) => r.name === check.name);
    const weight = rule ? rule.weight : 1;
    totalWeight += weight;
    weightedSum += (check.score || 0) * weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// ============================================================
// Specific Quality Checks
// ============================================================

async function reviewGrammarSpelling(text, language = 'en') {
  const review = await generateJSON(
    `Check this text for grammar and spelling errors.
Language: ${language}

Text:
"${text.substring(0, 3000)}"

Return JSON with:
- error_count: number of errors found
- errors: array of { original, correction, type: "grammar"|"spelling"|"punctuation", position: approximate }
- corrected_text: the fully corrected text
- score: 0-100 (100 = no errors)`,
    { model: config.models.fast, maxTokens: 1500 }
  );

  return review;
}

async function reviewSEOQuality(content, metadata = {}) {
  const review = await generateJSON(
    `Evaluate this content for SEO quality.

Content:
"${typeof content === 'string' ? content.substring(0, 3000) : ''}"

${metadata.targetKeyword ? `Target keyword: ${metadata.targetKeyword}` : ''}
${metadata.metaDescription ? `Meta description: ${metadata.metaDescription}` : ''}
${metadata.title ? `Title: ${metadata.title}` : ''}

Check:
1. Keyword usage and density (target: 1-2%)
2. Title tag optimization (under 60 chars, keyword included)
3. Meta description (under 155 chars, compelling, keyword included)
4. Heading structure (H1, H2, H3 hierarchy)
5. Readability (Flesch-Kincaid equivalent)
6. Internal/external linking potential
7. Content length (minimum 300 words for blog posts)
8. Image alt text suggestions

Return JSON with:
- seo_score: 0-100
- keyword_density: percentage
- readability_score: 0-100
- issues: array of { check, score, recommendation }
- meta_suggestion: improved meta description if needed`,
    { model: config.models.fast, maxTokens: 1024 }
  );

  return review;
}

async function reviewEmailQuality(emailHTML, metadata = {}) {
  const review = await generateJSON(
    `Evaluate this email for quality and deliverability.

Email HTML:
${emailHTML.substring(0, 3000)}

${metadata.subject ? `Subject: ${metadata.subject}` : ''}
${metadata.purpose ? `Purpose: ${metadata.purpose}` : ''}

Check:
1. Subject line quality (compelling, under 50 chars, no spam triggers)
2. Preheader text
3. Call-to-action clarity
4. Mobile responsiveness indicators
5. Spam trigger words
6. Personalization usage
7. Unsubscribe link presence
8. Professional formatting
9. Brand voice alignment

Return JSON with:
- email_score: 0-100
- spam_risk: "low", "medium", "high"
- issues: array of { check, score, recommendation }
- subject_suggestion: improved subject line if needed
- cta_clear: boolean`,
    { model: config.models.fast, maxTokens: 1024 }
  );

  return review;
}

async function reviewReportAccuracy(report, sourceData = {}) {
  const review = await generateJSON(
    `Verify the accuracy of this report against the source data.

Report:
${typeof report === 'string' ? report.substring(0, 3000) : JSON.stringify(report).substring(0, 3000)}

Source data:
${JSON.stringify(sourceData).substring(0, 2000)}

Check:
1. Are all numbers and statistics accurate?
2. Are percentages calculated correctly?
3. Are trends described accurately?
4. Are any claims unsupported by the data?
5. Are there any contradictions?
6. Is the data current (not stale)?

Return JSON with:
- accuracy_score: 0-100
- verified_claims: number of verified factual claims
- unverified_claims: number of claims that cannot be verified
- incorrect_claims: array of { claim, issue, correction }
- missing_context: array of important data points not mentioned
- data_freshness: "current", "slightly_stale", "outdated"`,
    { model: config.models.standard, maxTokens: 1024 }
  );

  return review;
}

// ============================================================
// Quality Queue Processing
// ============================================================

async function processQualityQueue() {
  logger.info('Processing quality review queue');

  try {
    const pending = await getRecords(TABLES.QUALITY_QUEUE, '{Status} = "Pending"', 20);

    if (pending.length === 0) {
      logger.info('No items in quality queue');
      return 0;
    }

    logger.info(`Processing ${pending.length} quality review items`);
    let reviewed = 0;

    for (const item of pending) {
      try {
        // Mark as in progress
        await updateRecord(TABLES.QUALITY_QUEUE, item.id, { Status: 'Reviewing' });

        const content = item.Content || '';
        const contentType = item.Content_Type || 'general';
        const agentName = item.Agent || 'unknown';

        const review = await reviewContent(content, contentType, agentName, {
          targetAudience: item.Target_Audience,
          language: item.Language || 'en',
          seoKeywords: item.SEO_Keywords,
        });

        if (review) {
          const score = review.overall_score || review.weighted_score || 0;
          const passed = score >= MINIMUM_QUALITY_SCORE;

          await updateRecord(TABLES.QUALITY_QUEUE, item.id, {
            Status: passed ? 'Approved' : 'Needs Revision',
            Quality_Score: score,
            Review_Summary: review.summary,
            Critical_Issues: JSON.stringify(review.critical_issues || []),
            Reviewed_Date: new Date().toISOString(),
          });

          // If content needs revision, attach improved version if available
          if (!passed && review.improved_version) {
            await updateRecord(TABLES.QUALITY_QUEUE, item.id, {
              Improved_Content: review.improved_version,
            });
          }

          reviewed++;
        } else {
          await updateRecord(TABLES.QUALITY_QUEUE, item.id, {
            Status: 'Review Failed',
            Review_Summary: 'Quality review could not be completed',
          });
        }
      } catch (err) {
        logger.error(`Failed to review queue item`, { error: err.message });
        try {
          await updateRecord(TABLES.QUALITY_QUEUE, item.id, {
            Status: 'Review Failed',
            Review_Summary: `Error: ${err.message}`,
          });
        } catch (updateErr) {
          logger.error('Failed to update queue item status', { error: updateErr.message });
        }
      }
    }

    logger.info(`Processed ${reviewed}/${pending.length} quality reviews`);
    return reviewed;
  } catch (err) {
    logger.error('Failed to process quality queue', { error: err.message });
    return 0;
  }
}

// ============================================================
// Agent Quality Scoring
// ============================================================

async function updateAgentScores() {
  logger.info('Updating quality scores per agent');

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const recentResults = await getRecords(
      TABLES.QUALITY_RESULTS,
      `{Review_Date} >= "${thirtyDaysAgo}"`,
      500
    );

    // Group by agent
    const agentData = {};
    for (const result of recentResults) {
      const agent = result.Agent || 'unknown';
      if (!agentData[agent]) {
        agentData[agent] = {
          scores: [],
          passed: 0,
          failed: 0,
          criticalIssueCount: 0,
          contentTypes: {},
        };
      }

      const score = result.Score || 0;
      agentData[agent].scores.push(score);

      if (result.Passed) {
        agentData[agent].passed++;
      } else {
        agentData[agent].failed++;
      }

      const criticals = result.Critical_Issues ? JSON.parse(result.Critical_Issues) : [];
      agentData[agent].criticalIssueCount += criticals.length;

      const type = result.Content_Type || 'unknown';
      if (!agentData[agent].contentTypes[type]) {
        agentData[agent].contentTypes[type] = { scores: [], count: 0 };
      }
      agentData[agent].contentTypes[type].scores.push(score);
      agentData[agent].contentTypes[type].count++;
    }

    // Calculate and save agent scores
    const scoreboard = [];

    for (const [agent, data] of Object.entries(agentData)) {
      const avgScore =
        data.scores.length > 0
          ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
          : 0;

      const passRate =
        data.passed + data.failed > 0
          ? Math.round((data.passed / (data.passed + data.failed)) * 100)
          : 0;

      const trend = calculateTrend(data.scores);

      // Content type breakdown
      const typeBreakdown = Object.entries(data.contentTypes).map(([type, typeData]) => ({
        type,
        avgScore: Math.round(
          typeData.scores.reduce((a, b) => a + b, 0) / typeData.scores.length
        ),
        count: typeData.count,
      }));

      const scoreEntry = {
        agent,
        avgScore,
        passRate,
        totalReviews: data.scores.length,
        criticalIssues: data.criticalIssueCount,
        trend,
        typeBreakdown,
      };

      scoreboard.push(scoreEntry);

      // Update in Airtable
      try {
        const existing = await getRecords(
          TABLES.AGENT_SCORES,
          `{Agent} = "${agent}"`,
          1
        );

        const fields = {
          Agent: agent,
          Avg_Score: avgScore,
          Pass_Rate: passRate,
          Total_Reviews: data.scores.length,
          Critical_Issues: data.criticalIssueCount,
          Trend: trend,
          Type_Breakdown: JSON.stringify(typeBreakdown),
          Last_Updated: now.toISOString(),
        };

        if (existing.length > 0) {
          await updateRecord(TABLES.AGENT_SCORES, existing[0].id, fields);
        } else {
          await createRecord(TABLES.AGENT_SCORES, fields);
        }
      } catch (err) {
        logger.warn(`Failed to save score for ${agent}`, { error: err.message });
      }
    }

    // Sort by score ascending to identify weakest agents
    scoreboard.sort((a, b) => a.avgScore - b.avgScore);

    logger.info('Agent scores updated', {
      agents: scoreboard.length,
      weakest: scoreboard[0] ? `${scoreboard[0].agent}: ${scoreboard[0].avgScore}` : 'N/A',
    });

    return scoreboard;
  } catch (err) {
    logger.error('Failed to update agent scores', { error: err.message });
    return [];
  }
}

function calculateTrend(scores) {
  if (scores.length < 5) return 'Insufficient data';

  // Compare recent 5 scores vs previous 5
  const recent = scores.slice(-5);
  const previous = scores.slice(-10, -5);

  if (previous.length === 0) return 'New';

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;

  const diff = recentAvg - previousAvg;
  if (diff > 5) return 'Improving';
  if (diff < -5) return 'Declining';
  return 'Stable';
}

// ============================================================
// Low Quality Flagging & Feedback
// ============================================================

async function flagLowQuality(agentName, contentType, score, review) {
  logger.warn(`Flagging low quality: ${agentName} (${contentType}) = ${score}/100`);

  try {
    // Generate improvement suggestions
    const feedback = await generateText(
      `Generate specific, actionable improvement suggestions for this AI agent.

Agent: ${agentName}
Content type: ${contentType}
Quality score: ${score}/100 (minimum threshold: ${MINIMUM_QUALITY_SCORE})

Issues found:
Critical: ${JSON.stringify(review.critical_issues || [])}
Minor: ${JSON.stringify(review.minor_issues || [])}
Summary: ${review.summary}

Provide 3-5 specific, actionable suggestions to improve the agent's output quality.
Be concrete with examples. Format as numbered list.`,
      { model: config.models.fast, maxTokens: 512 }
    );

    await createRecord(TABLES.QUALITY_FEEDBACK, {
      Agent: agentName,
      Content_Type: contentType,
      Score: score,
      Feedback: feedback,
      Critical_Issues: JSON.stringify(review.critical_issues || []),
      Status: 'Pending',
      Created_Date: new Date().toISOString().split('T')[0],
    });

    return feedback;
  } catch (err) {
    logger.error('Failed to generate quality feedback', { error: err.message });
    return null;
  }
}

async function sendImprovementSuggestions() {
  logger.info('Sending improvement suggestions to agents');

  try {
    const pendingFeedback = await getRecords(
      TABLES.QUALITY_FEEDBACK,
      '{Status} = "Pending"',
      20
    );

    // Group feedback by agent
    const agentFeedback = {};
    for (const fb of pendingFeedback) {
      const agent = fb.Agent || 'unknown';
      if (!agentFeedback[agent]) {
        agentFeedback[agent] = [];
      }
      agentFeedback[agent].push(fb);
    }

    for (const [agent, feedbackItems] of Object.entries(agentFeedback)) {
      try {
        // Consolidate feedback
        const consolidated = await generateText(
          `Consolidate these quality improvement items into a clear, prioritized action plan for the ${agent} agent.

Feedback items:
${feedbackItems.map((f) => `- ${f.Content_Type} (Score: ${f.Score}): ${f.Feedback}`).join('\n')}

Create a concise improvement plan with:
1. Top priority fixes
2. Pattern-based improvements
3. Specific examples of good vs bad output

Keep under 300 words.`,
          { model: config.models.fast, maxTokens: 600 }
        );

        // Mark feedback as sent
        for (const fb of feedbackItems) {
          await updateRecord(TABLES.QUALITY_FEEDBACK, fb.id, {
            Status: 'Sent',
            Sent_Date: new Date().toISOString().split('T')[0],
          });
        }

        logger.info(`Improvement suggestions sent for ${agent} (${feedbackItems.length} items)`);
      } catch (err) {
        logger.warn(`Failed to send improvement suggestions for ${agent}`, {
          error: err.message,
        });
      }
    }

    return Object.keys(agentFeedback).length;
  } catch (err) {
    logger.error('Failed to send improvement suggestions', { error: err.message });
    return 0;
  }
}

// ============================================================
// Weekly Quality Report
// ============================================================

async function generateWeeklyReport() {
  logger.info('Generating weekly quality report');

  try {
    const scoreboard = await updateAgentScores();
    await sendImprovementSuggestions();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const weeklyResults = await getRecords(
      TABLES.QUALITY_RESULTS,
      `{Review_Date} >= "${weekAgo}"`,
      200
    );

    const totalReviews = weeklyResults.length;
    const avgScore =
      totalReviews > 0
        ? Math.round(
            weeklyResults.reduce((sum, r) => sum + (r.Score || 0), 0) / totalReviews
          )
        : 0;
    const passCount = weeklyResults.filter((r) => r.Passed).length;
    const failCount = totalReviews - passCount;
    const passRate = totalReviews > 0 ? Math.round((passCount / totalReviews) * 100) : 0;

    // Sort scoreboard: worst first for attention
    scoreboard.sort((a, b) => a.avgScore - b.avgScore);

    const weekStr = `${weekAgo} to ${now.toISOString().split('T')[0]}`;

    await sendCEOEmail({
      subject: `Weekly Quality Report (Avg: ${avgScore}/100, Pass: ${passRate}%)`,
      html: `
        <h1>Weekly Quality Report</h1>
        <p style="color: #666;">${weekStr}</p>
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 700px;">

          <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
              <div style="font-size: 24px; font-weight: bold;">${totalReviews}</div>
              <div>Reviews</div>
            </div>
            <div style="background: ${avgScore >= 85 ? '#e8f5e9' : avgScore >= 70 ? '#fff8e1' : '#ffebee'}; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
              <div style="font-size: 24px; font-weight: bold;">${avgScore}</div>
              <div>Avg Score</div>
            </div>
            <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">${passCount}</div>
              <div>Passed</div>
            </div>
            <div style="background: #ffebee; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #c62828;">${failCount}</div>
              <div>Failed</div>
            </div>
          </div>

          <h2>Agent Scoreboard</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; text-align: left;">Agent</th>
              <th style="text-align: center;">Score</th>
              <th style="text-align: center;">Pass Rate</th>
              <th style="text-align: center;">Reviews</th>
              <th style="text-align: center;">Trend</th>
            </tr>
            ${scoreboard
              .map(
                (a) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 6px 8px;">${a.agent}</td>
                <td style="text-align: center; font-weight: bold; color: ${a.avgScore >= 85 ? '#2e7d32' : a.avgScore >= 70 ? '#f57f17' : '#c62828'};">${a.avgScore}</td>
                <td style="text-align: center;">${a.passRate}%</td>
                <td style="text-align: center;">${a.totalReviews}</td>
                <td style="text-align: center;">${a.trend}</td>
              </tr>`
              )
              .join('')}
          </table>

          ${scoreboard.filter((a) => a.avgScore < MINIMUM_QUALITY_SCORE).length > 0
            ? `
            <h2 style="color: #c62828;">Agents Below Threshold (${MINIMUM_QUALITY_SCORE})</h2>
            <ul>
              ${scoreboard
                .filter((a) => a.avgScore < MINIMUM_QUALITY_SCORE)
                .map(
                  (a) =>
                    `<li><strong>${a.agent}</strong>: ${a.avgScore}/100 - ${a.criticalIssues} critical issues (${a.trend})</li>`
                )
                .join('')}
            </ul>
            `
            : '<p style="color: #2e7d32;">All agents meet the quality threshold.</p>'
          }

          <hr style="margin-top: 30px;">
          <p style="color: #666; font-size: 12px;">Generated by Werkpilot Quality Management Agent</p>
        </div>
      `,
    });

    logger.info('Weekly quality report sent', { totalReviews, avgScore, passRate });
    return { totalReviews, avgScore, passRate, scoreboard };
  } catch (err) {
    logger.error('Failed to generate weekly report', { error: err.message });
    throw err;
  }
}

// ============================================================
// Main Execution Flows
// ============================================================

async function runQueueProcessing() {
  logger.info('=== Quality Queue Processing ===');
  const startTime = Date.now();

  try {
    const reviewed = await processQualityQueue();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Queue processing complete in ${duration}s`, { reviewed });
  } catch (err) {
    logger.error('Queue processing failed', { error: err.message, stack: err.stack });
  }
}

async function runWeeklyReport() {
  logger.info('=== Weekly Quality Report ===');
  try {
    await generateWeeklyReport();
  } catch (err) {
    logger.error('Weekly report failed', { error: err.message, stack: err.stack });
  }
}

// ============================================================
// Cron Schedules
// ============================================================

// Every 30 minutes - process quality review queue
cron.schedule('*/30 * * * *', () => {
  runQueueProcessing().catch((err) =>
    logger.error('Cron queue processing failed', { error: err.message })
  );
});

// Weekly on Fridays at 16:00 - quality report
cron.schedule('0 16 * * 5', () => {
  runWeeklyReport().catch((err) =>
    logger.error('Cron weekly report failed', { error: err.message })
  );
});

// Daily at 22:00 - send improvement suggestions
cron.schedule('0 22 * * *', () => {
  sendImprovementSuggestions().catch((err) =>
    logger.error('Cron improvement suggestions failed', { error: err.message })
  );
});

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Main flows
  runQueueProcessing,
  runWeeklyReport,

  // Core review functions
  reviewContent,
  processQualityQueue,

  // Specific checks
  reviewGrammarSpelling,
  reviewSEOQuality,
  reviewEmailQuality,
  reviewReportAccuracy,

  // Scoring & feedback
  updateAgentScores,
  sendImprovementSuggestions,
  generateWeeklyReport,
  flagLowQuality,

  // Constants
  MINIMUM_QUALITY_SCORE,
};

// Run immediately if executed directly
if (require.main === module) {
  logger.info('Quality Management Agent starting (direct execution)');
  runQueueProcessing()
    .then(() => logger.info('Quality Management Agent initial run complete'))
    .catch((err) => {
      logger.error('Quality Management Agent failed', { error: err.message });
      process.exit(1);
    });
}
