/**
 * Agent 14 - Product Strategy Agent
 *
 * Maintains product roadmap, collects feature requests, RICE scoring,
 * competitor monitoring, and monthly product reports.
 *
 * Schedule: Daily roadmap sync, weekly competitor scan, monthly report
 */

const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('product-strategy');

// --- Airtable Tables ---
const TABLES = {
  ROADMAP: 'Product_Roadmap',
  FEATURE_REQUESTS: 'Feature_Requests',
  COMPETITORS: 'Competitor_Watch',
  SERVICE_PACKAGES: 'Service_Packages',
  FEATURE_ADOPTION: 'Feature_Adoption',
};

// --- Competitor list ---
const COMPETITORS_PATH = path.join(__dirname, 'competitors.json');

function loadCompetitors() {
  try {
    return JSON.parse(fs.readFileSync(COMPETITORS_PATH, 'utf-8'));
  } catch (err) {
    logger.error('Failed to load competitors.json', { error: err.message });
    return { competitors: [] };
  }
}

// ============================================================
// RICE Scoring
// ============================================================

/**
 * Calculate RICE score for a feature request.
 * Reach (0-100), Impact (0.25/0.5/1/2/3), Confidence (0-100%), Effort (person-weeks)
 * RICE = (Reach * Impact * Confidence) / Effort
 */
function calculateRICE({ reach, impact, confidence, effort }) {
  if (!effort || effort === 0) return 0;
  return Math.round(((reach * impact * (confidence / 100)) / effort) * 100) / 100;
}

async function scoreFeatureRequests() {
  logger.info('Scoring unscored feature requests with RICE');

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

    const scored = [];

    for (const request of unscoredRequests) {
      try {
        const riceData = await generateJSON(
          `Analyze this feature request and provide RICE scoring parameters.

Feature: ${request.Title || request.Name || 'Unknown'}
Description: ${request.Description || 'No description'}
Source: ${request.Source || 'Unknown'}
Client Feedback: ${request.Client_Feedback || 'None'}

Return JSON with:
- reach: estimated number of users affected in next quarter (0-100 scale)
- impact: how much this moves the needle (0.25=minimal, 0.5=low, 1=medium, 2=high, 3=massive)
- confidence: how confident are we in these estimates (0-100 percentage)
- effort: estimated person-weeks to implement (minimum 0.5)
- rationale: brief explanation of scoring`,
          { model: config.models.fast, maxTokens: 512 }
        );

        const riceScore = calculateRICE(riceData);

        await updateRecord(TABLES.FEATURE_REQUESTS, request.id, {
          Reach: riceData.reach,
          Impact: riceData.impact,
          Confidence: riceData.confidence,
          Effort: riceData.effort,
          RICE_Score: riceScore,
          RICE_Rationale: riceData.rationale,
          Scored_Date: new Date().toISOString().split('T')[0],
        });

        scored.push({
          feature: request.Title || request.Name,
          riceScore,
          ...riceData,
        });

        logger.info(`Scored feature: ${request.Title || request.Name} = ${riceScore}`);
      } catch (err) {
        logger.error(`Failed to score feature: ${request.Title || request.Name}`, {
          error: err.message,
        });
      }
    }

    return scored;
  } catch (err) {
    logger.error('Failed to score feature requests', { error: err.message });
    return [];
  }
}

// ============================================================
// Feature Request Collection
// ============================================================

async function collectFeatureRequests() {
  logger.info('Collecting feature requests from all sources');

  try {
    // Pull from client feedback, sales notes, and support tickets
    const sources = [
      { table: 'Client_Feedback', field: 'Feature_Request', source: 'client-feedback' },
      { table: 'Sales_Notes', field: 'Feature_Request', source: 'sales' },
      { table: 'Support_Tickets', field: 'Feature_Request', source: 'support' },
    ];

    let totalNew = 0;

    for (const { table, field, source } of sources) {
      try {
        const records = await getRecords(
          table,
          `AND({${field}} != BLANK(), {Feature_Logged} = FALSE())`
        );

        for (const record of records) {
          try {
            await createRecord(TABLES.FEATURE_REQUESTS, {
              Title: record[field],
              Description: record.Details || record.Description || '',
              Source: source,
              Source_Record_ID: record.id,
              Status: 'New',
              Submitted_Date: new Date().toISOString().split('T')[0],
              Client: record.Client || record.Company || '',
            });

            await updateRecord(table, record.id, { Feature_Logged: true });
            totalNew++;
          } catch (err) {
            logger.warn(`Failed to create feature request from ${source}`, {
              error: err.message,
            });
          }
        }
      } catch (err) {
        logger.warn(`Failed to read from ${table}`, { error: err.message });
      }
    }

    logger.info(`Collected ${totalNew} new feature requests`);
    return totalNew;
  } catch (err) {
    logger.error('Failed to collect feature requests', { error: err.message });
    return 0;
  }
}

// ============================================================
// Roadmap Management
// ============================================================

async function syncRoadmap() {
  logger.info('Syncing product roadmap');

  try {
    const roadmapItems = await getRecords(TABLES.ROADMAP, '{Status} != "Archived"');
    const topFeatures = await getRecords(
      TABLES.FEATURE_REQUESTS,
      'AND({Status} = "Approved", {Roadmap_Item} = BLANK())',
      20
    );

    // Sort by RICE score descending
    topFeatures.sort((a, b) => (b.RICE_Score || 0) - (a.RICE_Score || 0));

    // Check for features that should be promoted to roadmap
    const promoted = [];
    for (const feature of topFeatures.slice(0, 5)) {
      if ((feature.RICE_Score || 0) >= 50) {
        try {
          const roadmapItem = await createRecord(TABLES.ROADMAP, {
            Name: feature.Title || feature.Name,
            Description: feature.Description,
            RICE_Score: feature.RICE_Score,
            Status: 'Planned',
            Quarter: getCurrentQuarter(),
            Source_Feature: feature.id,
            Priority: determinePriority(feature.RICE_Score),
          });

          await updateRecord(TABLES.FEATURE_REQUESTS, feature.id, {
            Roadmap_Item: roadmapItem.id,
            Status: 'On Roadmap',
          });

          promoted.push(feature.Title || feature.Name);
        } catch (err) {
          logger.warn(`Failed to promote feature to roadmap`, { error: err.message });
        }
      }
    }

    if (promoted.length > 0) {
      logger.info(`Promoted ${promoted.length} features to roadmap: ${promoted.join(', ')}`);
    }

    // Update roadmap status based on development progress
    for (const item of roadmapItems) {
      try {
        if (item.Status === 'In Development' && item.Completion_Pct >= 100) {
          await updateRecord(TABLES.ROADMAP, item.id, {
            Status: 'Shipped',
            Shipped_Date: new Date().toISOString().split('T')[0],
          });
          logger.info(`Marked roadmap item as shipped: ${item.Name}`);
        }
      } catch (err) {
        logger.warn(`Failed to update roadmap item: ${item.Name}`, { error: err.message });
      }
    }

    return { totalItems: roadmapItems.length, promoted: promoted.length };
  } catch (err) {
    logger.error('Failed to sync roadmap', { error: err.message });
    return { totalItems: 0, promoted: 0 };
  }
}

function getCurrentQuarter() {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${q} ${now.getFullYear()}`;
}

function determinePriority(riceScore) {
  if (riceScore >= 200) return 'P0 - Critical';
  if (riceScore >= 100) return 'P1 - High';
  if (riceScore >= 50) return 'P2 - Medium';
  return 'P3 - Low';
}

// ============================================================
// Competitor Monitoring
// ============================================================

async function monitorCompetitors() {
  logger.info('Running weekly competitor monitoring');

  const competitorData = loadCompetitors();
  const changes = [];

  for (const competitor of competitorData.competitors) {
    try {
      logger.info(`Scanning competitor: ${competitor.name}`);

      for (const url of competitor.urls) {
        try {
          const response = await axios.get(url, {
            timeout: 15000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
          });

          const $ = cheerio.load(response.data);

          // Extract page content for comparison
          const pageContent = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 3000);
          const pageTitle = $('title').text().trim();

          // Check for previous snapshot
          const previousRecords = await getRecords(
            TABLES.COMPETITORS,
            `AND({Competitor} = "${competitor.name}", {URL} = "${url}")`,
            1
          );

          if (previousRecords.length > 0) {
            const previous = previousRecords[0];
            const previousContent = previous.Content_Hash || '';

            // Simple content change detection via hash comparison
            const contentHash = simpleHash(pageContent);

            if (contentHash !== previousContent) {
              // Use Claude to analyze what changed
              const analysis = await generateText(
                `Compare these two snapshots of a competitor's webpage and identify significant changes related to features, pricing, or services.

Previous title: ${previous.Page_Title || 'Unknown'}
Current title: ${pageTitle}
URL: ${url}

Current page excerpt (first 2000 chars):
${pageContent.substring(0, 2000)}

Describe any notable changes. If you cannot determine changes from the content alone, describe what the page currently offers. Keep response under 200 words.`,
                { model: config.models.fast, maxTokens: 300 }
              );

              changes.push({
                competitor: competitor.name,
                url,
                analysis,
              });

              await updateRecord(TABLES.COMPETITORS, previous.id, {
                Content_Hash: contentHash,
                Page_Title: pageTitle,
                Last_Scanned: new Date().toISOString(),
                Last_Change: new Date().toISOString(),
                Change_Notes: analysis,
              });

              logger.info(`Change detected: ${competitor.name} - ${url}`);
            } else {
              await updateRecord(TABLES.COMPETITORS, previous.id, {
                Last_Scanned: new Date().toISOString(),
              });
            }
          } else {
            // First-time scan
            const contentHash = simpleHash(pageContent);
            await createRecord(TABLES.COMPETITORS, {
              Competitor: competitor.name,
              URL: url,
              Page_Title: pageTitle,
              Content_Hash: contentHash,
              Last_Scanned: new Date().toISOString(),
              Category: competitor.category || 'General',
            });
          }
        } catch (err) {
          logger.warn(`Failed to scan URL: ${url}`, { error: err.message });
        }
      }
    } catch (err) {
      logger.error(`Failed to monitor competitor: ${competitor.name}`, {
        error: err.message,
      });
    }
  }

  if (changes.length > 0) {
    logger.info(`Detected ${changes.length} competitor changes`);
  }

  return changes;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

// ============================================================
// Feature Adoption Tracking
// ============================================================

async function trackFeatureAdoption() {
  logger.info('Tracking feature adoption rates');

  try {
    const shippedFeatures = await getRecords(
      TABLES.ROADMAP,
      'AND({Status} = "Shipped", {Adoption_Tracked} != TRUE())'
    );

    const adoptionData = [];

    for (const feature of shippedFeatures) {
      try {
        // Query usage data from clients
        const usageRecords = await getRecords(
          TABLES.FEATURE_ADOPTION,
          `{Feature} = "${feature.Name}"`
        );

        const totalClients = await getRecords('Clients', '{Status} = "Active"');
        const adoptionRate =
          totalClients.length > 0
            ? Math.round((usageRecords.length / totalClients.length) * 100)
            : 0;

        await updateRecord(TABLES.ROADMAP, feature.id, {
          Adoption_Rate: adoptionRate,
          Adoption_Count: usageRecords.length,
          Adoption_Tracked: true,
          Adoption_Date: new Date().toISOString().split('T')[0],
        });

        adoptionData.push({
          feature: feature.Name,
          adoptionRate,
          userCount: usageRecords.length,
        });

        logger.info(`Feature adoption: ${feature.Name} = ${adoptionRate}%`);
      } catch (err) {
        logger.warn(`Failed to track adoption for: ${feature.Name}`, {
          error: err.message,
        });
      }
    }

    return adoptionData;
  } catch (err) {
    logger.error('Failed to track feature adoption', { error: err.message });
    return [];
  }
}

// ============================================================
// Service Package Proposals
// ============================================================

async function proposeServicePackages() {
  logger.info('Analyzing demand for new service package proposals');

  try {
    const featureRequests = await getRecords(TABLES.FEATURE_REQUESTS, '', 100);
    const existingPackages = await getRecords(TABLES.SERVICE_PACKAGES, '', 50);

    // Group requests by theme
    const proposals = await generateJSON(
      `Analyze these feature requests and suggest new service packages that Werkpilot could offer.

Current feature requests:
${JSON.stringify(featureRequests.map((f) => ({ title: f.Title, source: f.Source, votes: f.Vote_Count || 1 })), null, 2)}

Existing packages:
${JSON.stringify(existingPackages.map((p) => ({ name: p.Name, description: p.Description })), null, 2)}

Return JSON array of proposed packages, each with:
- name: package name
- description: what it includes
- target_audience: who needs this
- demand_signals: list of feature requests supporting this
- estimated_price_range: e.g. "CHF 500-1000/month"
- confidence: 0-100 how confident we are in demand`,
      { model: config.models.standard, maxTokens: 2048 }
    );

    const validProposals = Array.isArray(proposals)
      ? proposals.filter((p) => p.confidence >= 60)
      : [];

    for (const proposal of validProposals) {
      try {
        await createRecord(TABLES.SERVICE_PACKAGES, {
          Name: proposal.name,
          Description: proposal.description,
          Target_Audience: proposal.target_audience,
          Demand_Signals: JSON.stringify(proposal.demand_signals),
          Price_Range: proposal.estimated_price_range,
          Confidence: proposal.confidence,
          Status: 'Proposed',
          Proposed_Date: new Date().toISOString().split('T')[0],
        });
      } catch (err) {
        logger.warn(`Failed to save package proposal: ${proposal.name}`, {
          error: err.message,
        });
      }
    }

    logger.info(`Generated ${validProposals.length} service package proposals`);
    return validProposals;
  } catch (err) {
    logger.error('Failed to propose service packages', { error: err.message });
    return [];
  }
}

// ============================================================
// Monthly Product Report
// ============================================================

async function generateMonthlyReport() {
  logger.info('Generating monthly product report');

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    // Gather data
    const shipped = await getRecords(
      TABLES.ROADMAP,
      `AND({Status} = "Shipped", {Shipped_Date} >= "${monthStart}")`
    );

    const planned = await getRecords(
      TABLES.ROADMAP,
      '{Status} = "Planned"'
    );

    const inDev = await getRecords(
      TABLES.ROADMAP,
      '{Status} = "In Development"'
    );

    const featureRequests = await getRecords(
      TABLES.FEATURE_REQUESTS,
      `{Submitted_Date} >= "${monthStart}"`
    );

    const competitors = await getRecords(
      TABLES.COMPETITORS,
      `{Last_Change} >= "${monthStart}"`
    );

    // Claude generates the report narrative
    const reportNarrative = await generateText(
      `Generate a concise monthly product report for Werkpilot leadership.

Data:
- Shipped this month: ${shipped.map((s) => s.Name).join(', ') || 'None'}
- In development: ${inDev.map((d) => `${d.Name} (${d.Completion_Pct || 0}%)`).join(', ') || 'None'}
- Planned next: ${planned.slice(0, 5).map((p) => p.Name).join(', ') || 'None'}
- New feature requests: ${featureRequests.length}
- Top requested themes: ${extractThemes(featureRequests)}
- Competitor changes detected: ${competitors.length}

Write a professional report with sections:
1. Shipped This Month
2. Currently In Development
3. Up Next
4. Feature Request Themes
5. Competitive Landscape Updates
6. Recommendations

Keep it actionable. Use bullet points. Under 500 words.`,
      { model: config.models.standard, maxTokens: 1500 }
    );

    const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    await sendCEOEmail({
      subject: `Monthly Product Report - ${monthName}`,
      html: `
        <h1>Monthly Product Report - ${monthName}</h1>
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 700px;">
          <div style="background: #f0f4ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong>Summary:</strong> ${shipped.length} shipped | ${inDev.length} in development | ${planned.length} planned | ${featureRequests.length} new requests
          </div>
          ${formatReportHTML(reportNarrative)}
          <hr style="margin-top: 30px;">
          <p style="color: #666; font-size: 12px;">Generated by Werkpilot Product Strategy Agent</p>
        </div>
      `,
    });

    logger.info('Monthly product report sent successfully');
    return { shipped: shipped.length, inDev: inDev.length, planned: planned.length };
  } catch (err) {
    logger.error('Failed to generate monthly report', { error: err.message });
    throw err;
  }
}

function extractThemes(requests) {
  const themes = {};
  for (const r of requests) {
    const source = r.Source || 'unknown';
    themes[source] = (themes[source] || 0) + 1;
  }
  return Object.entries(themes)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') || 'None';
}

function formatReportHTML(text) {
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h2>${line.slice(2)}</h2>`;
      if (line.startsWith('## ')) return `<h3>${line.slice(3)}</h3>`;
      if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
      if (line.trim() === '') return '<br>';
      return `<p>${line}</p>`;
    })
    .join('\n');
}

// ============================================================
// Main execution flows
// ============================================================

async function runDailySync() {
  logger.info('=== Product Strategy Daily Sync ===');
  const startTime = Date.now();

  try {
    const newRequests = await collectFeatureRequests();
    const scored = await scoreFeatureRequests();
    const roadmapResult = await syncRoadmap();
    const adoption = await trackFeatureAdoption();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Daily sync complete in ${duration}s`, {
      newRequests,
      scored: scored.length,
      roadmapPromoted: roadmapResult.promoted,
      adoptionTracked: adoption.length,
    });
  } catch (err) {
    logger.error('Daily sync failed', { error: err.message, stack: err.stack });
  }
}

async function runWeeklyCompetitorScan() {
  logger.info('=== Weekly Competitor Scan ===');
  const startTime = Date.now();

  try {
    const changes = await monitorCompetitors();

    if (changes.length > 0) {
      await sendCEOEmail({
        subject: `Competitor Changes Detected (${changes.length})`,
        html: `
          <h2>Competitor Watch - Weekly Update</h2>
          ${changes
            .map(
              (c) => `
            <div style="border-left: 3px solid #ff6b35; padding: 10px; margin: 10px 0;">
              <strong>${c.competitor}</strong><br>
              <a href="${c.url}">${c.url}</a><br>
              <p>${c.analysis}</p>
            </div>
          `
            )
            .join('')}
          <p style="color: #666; font-size: 12px;">Generated by Werkpilot Product Strategy Agent</p>
        `,
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Weekly competitor scan complete in ${duration}s`, {
      changesDetected: changes.length,
    });
  } catch (err) {
    logger.error('Weekly competitor scan failed', { error: err.message, stack: err.stack });
  }
}

async function runMonthlyReport() {
  logger.info('=== Monthly Product Report ===');
  try {
    await proposeServicePackages();
    await generateMonthlyReport();
  } catch (err) {
    logger.error('Monthly product report failed', { error: err.message, stack: err.stack });
  }
}

// ============================================================
// Cron Schedules
// ============================================================

// Daily at 07:00 - collect requests, score, sync roadmap
cron.schedule('0 7 * * 1-5', () => {
  runDailySync().catch((err) =>
    logger.error('Cron daily sync failed', { error: err.message })
  );
});

// Weekly on Mondays at 04:00 - competitor monitoring
cron.schedule('0 4 * * 1', () => {
  runWeeklyCompetitorScan().catch((err) =>
    logger.error('Cron weekly competitor scan failed', { error: err.message })
  );
});

// Monthly on the 1st at 08:00 - monthly report + service proposals
cron.schedule('0 8 1 * *', () => {
  runMonthlyReport().catch((err) =>
    logger.error('Cron monthly report failed', { error: err.message })
  );
});

// ============================================================
// Exports
// ============================================================

module.exports = {
  runDailySync,
  runWeeklyCompetitorScan,
  runMonthlyReport,
  scoreFeatureRequests,
  collectFeatureRequests,
  syncRoadmap,
  monitorCompetitors,
  trackFeatureAdoption,
  proposeServicePackages,
  generateMonthlyReport,
  calculateRICE,
};

// Run immediately if executed directly
if (require.main === module) {
  logger.info('Product Strategy Agent starting (direct execution)');
  runDailySync()
    .then(() => logger.info('Product Strategy Agent initial run complete'))
    .catch((err) => {
      logger.error('Product Strategy Agent failed', { error: err.message });
      process.exit(1);
    });
}
