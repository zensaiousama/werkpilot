/**
 * Werkpilot Competitor Intelligence Agent (Agent 32)
 *
 * UPGRADED: Enhanced competitive intelligence with automated monitoring,
 * social media tracking, price benchmarking over time, SWOT analysis using Claude,
 * feature comparison matrix generation, and weekly competitor briefings.
 *
 * Monitors 10-15 competitors weekly: website changes (Puppeteer screenshots),
 * pricing, services, blog/content, social media, and job postings.
 * Performs win/loss analysis, maintains a feature comparison matrix,
 * alerts on significant changes, and produces monthly competitive reports.
 *
 * Schedule: Weekly on Tuesday at 03:00, Monthly report on 1st at 06:00
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const dashboardSync = require('../shared/utils/dashboard-sync');
const config = require('../shared/utils/config');

const logger = createLogger('strategy-competitor-intel');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const COMPETITORS_DIR = path.join(__dirname, 'competitors');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const REPORTS_DIR = path.join(__dirname, 'industry-reports');
const COMPETITOR_LIST_FILE = path.join(COMPETITORS_DIR, 'competitor-list.json');

const WEEKLY_SCHEDULE = '0 3 * * 2';       // Weekly: Tuesday at 03:00
const MONTHLY_SCHEDULE = '0 6 1 * *';      // Monthly: 1st at 06:00
const TIMEZONE = 'Europe/Zurich';

// ---------------------------------------------------------------------------
// Data Loading
// ---------------------------------------------------------------------------

/**
 * Load the competitor list configuration.
 */
function loadCompetitorList() {
  try {
    const raw = fs.readFileSync(COMPETITOR_LIST_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return data.competitors || [];
  } catch (err) {
    logger.error(`Failed to load competitor list: ${err.message}`);
    return [];
  }
}

/**
 * Load previous scan data for a competitor.
 */
function loadPreviousScan(competitorId) {
  try {
    const scanFile = path.join(COMPETITORS_DIR, `${competitorId}-latest.json`);
    if (!fs.existsSync(scanFile)) return null;
    const raw = fs.readFileSync(scanFile, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`Could not load previous scan for ${competitorId}: ${err.message}`);
    return null;
  }
}

/**
 * Save scan data for a competitor.
 */
function saveScanData(competitorId, data) {
  try {
    const scanFile = path.join(COMPETITORS_DIR, `${competitorId}-latest.json`);
    fs.writeFileSync(scanFile, JSON.stringify(data, null, 2), 'utf-8');
    logger.info(`Scan data saved for ${competitorId}`);
  } catch (err) {
    logger.error(`Failed to save scan data for ${competitorId}: ${err.message}`);
  }
}

/**
 * Fetch win/loss records from Airtable.
 */
async function fetchWinLossData() {
  try {
    const records = await getRecords('WinLoss', '', 200);
    logger.info(`Fetched ${records.length} win/loss records`);
    return records;
  } catch (err) {
    logger.warn(`Could not fetch win/loss data: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Website Monitoring (Puppeteer)
// ---------------------------------------------------------------------------

/**
 * Capture a screenshot of a competitor's page.
 */
async function captureScreenshot(url, outputPath) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: 30000,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.screenshot({ path: outputPath, fullPage: false });

    logger.info(`Screenshot captured: ${outputPath}`);
    return true;
  } catch (err) {
    logger.warn(`Screenshot failed for ${url}: ${err.message}`);
    return false;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) { /* ignore */ }
    }
  }
}

/**
 * Scrape key content from a competitor's page.
 */
async function scrapePageContent(url) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: 30000,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const content = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim().substring(0, 500) : null;
      };

      return {
        title: document.title,
        metaDescription: document.querySelector('meta[name="description"]')?.content || null,
        h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()).slice(0, 5),
        h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()).slice(0, 10),
        bodyText: document.body?.innerText?.substring(0, 3000) || '',
        links: Array.from(document.querySelectorAll('a[href]'))
          .map(a => ({ text: a.textContent.trim(), href: a.href }))
          .filter(l => l.text.length > 0 && l.text.length < 100)
          .slice(0, 50),
        images: document.querySelectorAll('img').length,
        scripts: document.querySelectorAll('script[src]').length,
      };
    });

    return content;
  } catch (err) {
    logger.warn(`Page scrape failed for ${url}: ${err.message}`);
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) { /* ignore */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Pricing Benchmarking
// ---------------------------------------------------------------------------

/**
 * Track competitor pricing changes over time.
 */
async function trackPricingChanges(competitorId, currentPricing) {
  try {
    const historyFile = path.join(COMPETITORS_DIR, `${competitorId}-pricing-history.json`);
    let pricingHistory = [];

    if (fs.existsSync(historyFile)) {
      const raw = fs.readFileSync(historyFile, 'utf-8');
      pricingHistory = JSON.parse(raw);
    }

    // Add current pricing snapshot
    pricingHistory.push({
      date: new Date().toISOString(),
      pricing: currentPricing,
    });

    // Keep last 12 months only
    const oneYearAgo = new Date();
    oneYearAgo.setMonth(oneYearAgo.getMonth() - 12);
    pricingHistory = pricingHistory.filter(p => new Date(p.date) > oneYearAgo);

    fs.writeFileSync(historyFile, JSON.stringify(pricingHistory, null, 2), 'utf-8');

    // Detect pricing changes
    if (pricingHistory.length > 1) {
      const previous = pricingHistory[pricingHistory.length - 2];
      const changes = detectPricingChanges(previous.pricing, currentPricing);
      return { history: pricingHistory, changes };
    }

    return { history: pricingHistory, changes: [] };
  } catch (err) {
    logger.warn(`Failed to track pricing for ${competitorId}: ${err.message}`);
    return { history: [], changes: [] };
  }
}

/**
 * Detect pricing changes between two pricing objects.
 */
function detectPricingChanges(oldPricing, newPricing) {
  const changes = [];

  if (!oldPricing || !newPricing) return changes;

  const oldKeys = Object.keys(oldPricing);
  const newKeys = Object.keys(newPricing);

  // Check for price increases/decreases
  for (const key of oldKeys) {
    if (newKeys.includes(key)) {
      const oldPrice = parseFloat(oldPricing[key]);
      const newPrice = parseFloat(newPricing[key]);
      if (!isNaN(oldPrice) && !isNaN(newPrice) && oldPrice !== newPrice) {
        const percentChange = ((newPrice - oldPrice) / oldPrice * 100).toFixed(1);
        changes.push({
          type: newPrice > oldPrice ? 'price-increase' : 'price-decrease',
          plan: key,
          oldPrice,
          newPrice,
          percentChange: parseFloat(percentChange),
        });
      }
    }
  }

  // Check for new plans
  for (const key of newKeys) {
    if (!oldKeys.includes(key)) {
      changes.push({
        type: 'new-plan',
        plan: key,
        price: newPricing[key],
      });
    }
  }

  // Check for removed plans
  for (const key of oldKeys) {
    if (!newKeys.includes(key)) {
      changes.push({
        type: 'plan-removed',
        plan: key,
      });
    }
  }

  return changes;
}

/**
 * Perform competitive SWOT analysis using Claude.
 */
async function performCompetitiveSWOT(competitor, scanResult) {
  const prompt = `Perform a competitive SWOT analysis for ${competitor.name} as a competitor to Werkpilot (Swiss AI marketing automation platform).

COMPETITOR INFO:
Name: ${competitor.name}
Type: ${competitor.type || 'Unknown'}
Focus: ${competitor.focus || 'Unknown'}

RECENT SCAN DATA:
${JSON.stringify(scanResult, null, 2)}

Provide a JSON SWOT analysis:
{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "opportunities": ["..."],
  "threats": ["..."],
  "overallThreatLevel": "critical|high|medium|low",
  "competitiveAdvantages": ["..."],
  "vulnerabilities": ["..."],
  "strategicResponse": ["..."]
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a competitive strategy analyst. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 2500,
    });
  } catch (err) {
    logger.error(`SWOT analysis failed for ${competitor.name}: ${err.message}`);
    return null;
  }
}

/**
 * Generate weekly competitor briefing.
 */
async function generateWeeklyBriefing(scanResults, pricingChanges) {
  const weekOf = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const significantChanges = scanResults.filter(r => r.changes.length > 0 || r.alerts.length > 0);
  const significantPricing = pricingChanges.filter(p => p.changes.length > 0);

  if (significantChanges.length === 0 && significantPricing.length === 0) {
    logger.info('No significant competitor activity this week, skipping briefing');
    return null;
  }

  const prompt = `Create a concise weekly competitor briefing for Werkpilot leadership.

WEEK OF: ${weekOf}

COMPETITOR ACTIVITY:
${JSON.stringify(significantChanges, null, 2)}

PRICING CHANGES:
${JSON.stringify(significantPricing, null, 2)}

Write a brief Markdown report covering:
1. Executive Summary (2-3 bullets)
2. Significant Changes (website, content, features)
3. Pricing Changes
4. Recommended Actions
5. Watch List (items to monitor next week)

Keep it concise and action-oriented.`;

  try {
    return await generateText(prompt, {
      system: 'You are a competitive intelligence analyst producing brief weekly updates. Be concise and highlight actionable insights.',
      model: config.models.fast,
      maxTokens: 2000,
      temperature: 0.3,
    });
  } catch (err) {
    logger.error(`Weekly briefing generation failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Competitor Analysis
// ---------------------------------------------------------------------------

/**
 * Scan a single competitor and detect changes.
 */
async function scanCompetitor(competitor) {
  const scanResult = {
    id: competitor.id,
    name: competitor.name,
    scanDate: new Date().toISOString(),
    pages: {},
    changes: [],
    alerts: [],
  };

  const previousScan = loadPreviousScan(competitor.id);

  // Scan each monitored URL
  const monitorUrls = competitor.monitorUrls || {};
  for (const [pageType, url] of Object.entries(monitorUrls)) {
    if (!url) continue;

    logger.info(`Scanning ${competitor.name} - ${pageType}: ${url}`);

    // Take screenshot
    const dateStr = new Date().toISOString().split('T')[0];
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${competitor.id}-${pageType}-${dateStr}.png`);
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    await captureScreenshot(url, screenshotPath);

    // Scrape content
    const content = await scrapePageContent(url);
    scanResult.pages[pageType] = {
      url,
      screenshotPath,
      content,
      scannedAt: new Date().toISOString(),
    };

    // Compare with previous scan
    if (previousScan?.pages?.[pageType]?.content && content) {
      const prevContent = previousScan.pages[pageType].content;

      // Check for title change
      if (prevContent.title !== content.title) {
        scanResult.changes.push({
          type: 'title-change',
          page: pageType,
          old: prevContent.title,
          new: content.title,
        });
      }

      // Check for new H2 headings (new content sections)
      if (content.h2 && prevContent.h2) {
        const newH2s = content.h2.filter(h => !prevContent.h2.includes(h));
        if (newH2s.length > 0) {
          scanResult.changes.push({
            type: 'new-content-sections',
            page: pageType,
            newSections: newH2s,
          });
        }
      }

      // Check for significant body text changes
      if (content.bodyText && prevContent.bodyText) {
        const similarity = calculateTextSimilarity(prevContent.bodyText, content.bodyText);
        if (similarity < 0.85) {
          scanResult.changes.push({
            type: 'significant-content-change',
            page: pageType,
            similarity: parseFloat(similarity.toFixed(3)),
          });
        }
      }
    }
  }

  // Check for alert keywords in changes
  const alertKeywords = competitor.alertKeywords || [];
  for (const change of scanResult.changes) {
    const changeText = JSON.stringify(change).toLowerCase();
    for (const keyword of alertKeywords) {
      if (changeText.includes(keyword.toLowerCase())) {
        scanResult.alerts.push({
          keyword,
          change,
          severity: 'medium',
        });
      }
    }
  }

  // Extract pricing info from scan (if pricing page was scanned)
  let pricingData = {};
  if (scanResult.pages.pricing?.content) {
    // Simple extraction - could be enhanced with more sophisticated parsing
    const pricingText = scanResult.pages.pricing.content.bodyText || '';
    // Look for CHF or $ amounts
    const priceMatches = pricingText.match(/(?:CHF|€|\$)\s*\d+[.,]?\d*/g);
    if (priceMatches) {
      pricingData = { extracted: priceMatches };
    }
  }

  // Track pricing changes
  const pricingTracking = await trackPricingChanges(competitor.id, pricingData);
  scanResult.pricingChanges = pricingTracking.changes;

  // Perform SWOT analysis
  const swot = await performCompetitiveSWOT(competitor, scanResult);
  scanResult.swot = swot;

  // Save scan data
  saveScanData(competitor.id, scanResult);

  return scanResult;
}

/**
 * Simple text similarity calculation (Jaccard-like on word sets).
 */
function calculateTextSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  if (words1.size === 0 && words2.size === 0) return 1.0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Analyze changes detected across all competitors using Claude.
 */
async function analyzeCompetitorChanges(scanResults) {
  const changesOnly = scanResults
    .filter(r => r.changes.length > 0 || r.alerts.length > 0)
    .map(r => ({
      name: r.name,
      changes: r.changes,
      alerts: r.alerts,
    }));

  if (changesOnly.length === 0) {
    logger.info('No significant competitor changes detected this week');
    return null;
  }

  const prompt = `Analyze these competitor changes detected this week for Werkpilot (Swiss AI marketing automation platform).

COMPETITOR CHANGES:
${JSON.stringify(changesOnly, null, 2)}

Provide a JSON response:
{
  "summary": "...",
  "significantChanges": [
    {
      "competitor": "...",
      "change": "...",
      "significance": "high|medium|low",
      "implication": "...",
      "recommendedResponse": "..."
    }
  ],
  "competitiveThreatLevel": "elevated|normal|low",
  "immediateActions": ["..."],
  "watchItems": ["..."]
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a competitive intelligence analyst. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 3000,
    });
  } catch (err) {
    logger.error(`Competitor change analysis failed: ${err.message}`);
    return null;
  }
}

/**
 * Perform win/loss analysis.
 */
async function analyzeWinLoss(winLossData) {
  if (winLossData.length === 0) {
    logger.info('No win/loss data available for analysis');
    return null;
  }

  const prompt = `Analyze win/loss patterns for Werkpilot.

WIN/LOSS DATA:
${JSON.stringify(winLossData.slice(0, 50), null, 2)}

Provide a JSON response:
{
  "winRate": number,
  "totalDeals": number,
  "wins": number,
  "losses": number,
  "topWinReasons": [{ "reason": "...", "frequency": number }],
  "topLossReasons": [{ "reason": "...", "frequency": number, "toCompetitor": "..." }],
  "competitorWinRates": [{ "competitor": "...", "ourWinRate": number, "dealsCount": number }],
  "pricingInsights": "...",
  "featureGaps": ["..."],
  "recommendations": ["..."]
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a competitive strategy analyst. Respond only with valid JSON.',
      model: config.models.standard,
      maxTokens: 3000,
    });
  } catch (err) {
    logger.error(`Win/loss analysis failed: ${err.message}`);
    return null;
  }
}

/**
 * Generate and update the feature comparison matrix.
 */
async function updateFeatureMatrix(competitors, scanResults) {
  const competitorListRaw = fs.readFileSync(COMPETITOR_LIST_FILE, 'utf-8');
  const competitorData = JSON.parse(competitorListRaw);
  const existingMatrix = competitorData.featureComparisonMatrix || {};

  const prompt = `Update the feature comparison matrix based on recent competitor scans.

CURRENT MATRIX:
${JSON.stringify(existingMatrix, null, 2)}

RECENT SCAN DATA (key changes):
${JSON.stringify(scanResults.filter(r => r.changes.length > 0).map(r => ({
  name: r.name,
  id: r.id,
  changes: r.changes,
})), null, 2)}

If there are feature changes detected, update the matrix. Otherwise, return the existing matrix unchanged.
Respond with the updated matrix JSON only:
{
  "features": ["..."],
  "werkpilot": [true/false, ...],
  "ratings": { "comp-xxx": [true/false, ...] },
  "lastUpdated": "YYYY-MM-DD",
  "changesDetected": ["description of changes..."]
}`;

  try {
    return await generateJSON(prompt, {
      system: 'You are a product analyst. Respond only with valid JSON.',
      model: config.models.fast,
      maxTokens: 2500,
    });
  } catch (err) {
    logger.error(`Feature matrix update failed: ${err.message}`);
    return existingMatrix;
  }
}

// ---------------------------------------------------------------------------
// Alert System
// ---------------------------------------------------------------------------

/**
 * Send alerts for significant competitor changes.
 */
async function sendCompetitorAlerts(analysis) {
  if (!analysis || analysis.competitiveThreatLevel === 'low') return;

  const significantChanges = (analysis.significantChanges || [])
    .filter(c => c.significance === 'high');

  if (significantChanges.length === 0) return;

  const alertHtml = `
    <div style="font-family:'Segoe UI',sans-serif;max-width:700px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#e94560,#c23152);color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">Competitor Alert</h2>
        <p style="margin:5px 0 0;opacity:0.9;">Threat Level: ${analysis.competitiveThreatLevel.toUpperCase()}</p>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        <p><strong>Summary:</strong> ${analysis.summary}</p>
        <h3>Significant Changes:</h3>
        <ul>
          ${significantChanges.map(c =>
            `<li><strong>${c.competitor}:</strong> ${c.change}<br>
             <em>Implication:</em> ${c.implication}<br>
             <em>Recommended:</em> ${c.recommendedResponse}</li>`
          ).join('')}
        </ul>
        ${analysis.immediateActions?.length > 0 ? `
          <h3>Immediate Actions Needed:</h3>
          <ul>${analysis.immediateActions.map(a => `<li>${a}</li>`).join('')}</ul>
        ` : ''}
      </div>
    </div>`;

  try {
    await sendCEOEmail({
      subject: `Competitor Alert: ${significantChanges.length} significant change(s) detected`,
      html: alertHtml,
    });
    logger.info('Competitor alert email sent');
  } catch (err) {
    logger.error(`Failed to send competitor alert: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Monthly Report
// ---------------------------------------------------------------------------

/**
 * Generate the monthly competitive analysis report.
 */
async function generateMonthlyReport(scanHistory, winLossAnalysis, featureMatrix) {
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const competitors = loadCompetitorList();

  const prompt = `Create a comprehensive monthly competitive analysis report for Werkpilot leadership.

PERIOD: ${monthYear}

COMPETITORS MONITORED: ${competitors.length}
${JSON.stringify(competitors.map(c => ({ name: c.name, type: c.type, focus: c.focus })), null, 2)}

SCAN HISTORY (recent changes):
${JSON.stringify(scanHistory, null, 2)}

WIN/LOSS ANALYSIS:
${JSON.stringify(winLossAnalysis, null, 2)}

FEATURE COMPARISON:
${JSON.stringify(featureMatrix, null, 2)}

Write a Markdown report covering:
1. Executive Summary
2. Competitive Landscape Overview
3. Competitor Activity Summary (changes, new offerings, pricing changes)
4. Feature Comparison Matrix (as table)
5. Win/Loss Analysis
6. Competitive Threats Assessment
7. Opportunities Identified
8. Pricing Intelligence
9. Strategic Recommendations
10. Watch List (competitors/actions to monitor closely)`;

  try {
    return await generateText(prompt, {
      system: 'You are a competitive intelligence analyst producing C-level reports. Be specific and actionable.',
      model: config.models.standard,
      maxTokens: 6000,
      temperature: 0.3,
    });
  } catch (err) {
    logger.error(`Monthly competitive report failed: ${err.message}`);
    return null;
  }
}

/**
 * Save the monthly report.
 */
function saveMonthlyReport(report) {
  const dateStr = new Date().toISOString().split('T')[0];
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const reportPath = path.join(REPORTS_DIR, `competitive-analysis-${dateStr}.md`);
  fs.writeFileSync(reportPath, report, 'utf-8');
  logger.info(`Monthly competitive report saved: ${reportPath}`);
  return reportPath;
}

// ---------------------------------------------------------------------------
// Main Execution
// ---------------------------------------------------------------------------

/**
 * Weekly competitor scan.
 */
async function runWeeklyScan() {
  const startTime = Date.now();
  logger.info('=== Starting Weekly Competitor Scan ===');

  try {
    const competitors = loadCompetitorList();
    if (competitors.length === 0) {
      logger.warn('No competitors configured. Exiting.');
      return { success: true, scanned: 0 };
    }

    // Scan each competitor sequentially to avoid overwhelming targets
    const scanResults = [];
    for (const competitor of competitors) {
      logger.info(`Scanning competitor: ${competitor.name}...`);
      try {
        const result = await scanCompetitor(competitor);
        scanResults.push(result);
        logger.info(`  ${competitor.name}: ${result.changes.length} changes, ${result.alerts.length} alerts`);
      } catch (scanErr) {
        logger.error(`Scan failed for ${competitor.name}: ${scanErr.message}`);
        scanResults.push({
          id: competitor.id,
          name: competitor.name,
          error: scanErr.message,
          changes: [],
          alerts: [],
        });
      }

      // Brief pause between scans to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Analyze changes
    const analysis = await analyzeCompetitorChanges(scanResults);

    // Send alerts if needed
    if (analysis) {
      await sendCompetitorAlerts(analysis);
    }

    // Update feature matrix
    await updateFeatureMatrix(competitors, scanResults);

    // Collect pricing changes
    const pricingChanges = scanResults
      .filter(r => r.pricingChanges && r.pricingChanges.length > 0)
      .map(r => ({ name: r.name, changes: r.pricingChanges }));

    // Generate weekly briefing
    const weeklyBriefing = await generateWeeklyBriefing(scanResults, pricingChanges);
    if (weeklyBriefing) {
      // Save weekly briefing
      const dateStr = new Date().toISOString().split('T')[0];
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
      const briefingPath = path.join(REPORTS_DIR, `competitor-weekly-${dateStr}.md`);
      fs.writeFileSync(briefingPath, weeklyBriefing, 'utf-8');
      logger.info(`Weekly briefing saved: ${briefingPath}`);

      // Send to CEO
      const briefingHtml = weeklyBriefing
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 style="border-bottom:2px solid #0f3460;">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

      await sendCEOEmail({
        subject: `Weekly Competitor Briefing - ${new Date().toLocaleDateString('de-CH', { month: 'long', day: 'numeric' })}`,
        html: `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:20px;"><p>${briefingHtml}</p></div>`,
      });
    }

    // Store scan summary in Airtable
    try {
      await createRecord('CompetitorScans', {
        Date: new Date().toISOString().split('T')[0],
        CompetitorsScanned: competitors.length,
        ChangesDetected: scanResults.reduce((sum, r) => sum + r.changes.length, 0),
        AlertsTriggered: scanResults.reduce((sum, r) => sum + r.alerts.length, 0),
        PricingChanges: pricingChanges.length,
        ThreatLevel: analysis?.competitiveThreatLevel || 'normal',
      });
    } catch (storeErr) {
      logger.warn(`Could not store scan summary: ${storeErr.message}`);
    }

    // Sync to dashboard
    try {
      await dashboardSync.bulkSync({
        notifications: [
          {
            title: 'Weekly Competitor Scan Complete',
            message: `Scanned ${scanResults.length} competitors, ${scanResults.reduce((sum, r) => sum + r.changes.length, 0)} changes detected, ${pricingChanges.length} pricing changes`,
            type: analysis?.competitiveThreatLevel === 'elevated' ? 'warning' : 'info',
            link: null,
          },
        ],
      });
    } catch (dashErr) {
      logger.warn(`Could not sync to dashboard: ${dashErr.message}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Weekly scan complete in ${elapsed}s. Scanned ${scanResults.length} competitors ===`);

    return {
      success: true,
      scanned: scanResults.length,
      totalChanges: scanResults.reduce((sum, r) => sum + r.changes.length, 0),
      alerts: scanResults.reduce((sum, r) => sum + r.alerts.length, 0),
      elapsed,
    };
  } catch (err) {
    logger.error(`Weekly competitor scan failed: ${err.message}`, { stack: err.stack });

    try {
      await sendCEOEmail({
        subject: 'Competitor Scan FEHLER',
        html: `<div style="padding:20px;background:#fff3f3;border-left:4px solid #e94560;">
          <h2>Competitor Scan fehlgeschlagen</h2>
          <p><strong>Fehler:</strong> ${err.message}</p>
          <p><strong>Zeit:</strong> ${new Date().toLocaleString('de-CH')}</p>
        </div>`,
      });
    } catch (emailErr) {
      logger.error(`Could not send error notification: ${emailErr.message}`);
    }

    return { success: false, error: err.message };
  }
}

/**
 * Monthly competitive analysis report.
 */
async function runMonthlyReport() {
  const startTime = Date.now();
  logger.info('=== Starting Monthly Competitive Analysis Report ===');

  try {
    // Load recent scan data
    const competitors = loadCompetitorList();
    const scanHistory = [];
    for (const comp of competitors) {
      const prevScan = loadPreviousScan(comp.id);
      if (prevScan) {
        scanHistory.push({
          name: comp.name,
          changes: prevScan.changes || [],
          alerts: prevScan.alerts || [],
          lastScan: prevScan.scanDate,
        });
      }
    }

    // Get win/loss data
    const winLossData = await fetchWinLossData();
    const winLossAnalysis = await analyzeWinLoss(winLossData);

    // Load feature matrix
    const competitorListRaw = fs.readFileSync(COMPETITOR_LIST_FILE, 'utf-8');
    const featureMatrix = JSON.parse(competitorListRaw).featureComparisonMatrix;

    // Generate report
    const report = await generateMonthlyReport(scanHistory, winLossAnalysis, featureMatrix);
    if (!report) {
      throw new Error('Failed to generate monthly report');
    }

    const reportPath = saveMonthlyReport(report);

    // Send to CEO
    const monthYear = new Date().toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });
    let html = report
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="border-bottom:2px solid #0f3460;">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    html = `
      <div style="font-family:sans-serif;max-width:900px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:24px 30px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;">Monthly Competitive Analysis</h1>
          <p style="margin:5px 0 0;opacity:0.9;">${monthYear}</p>
        </div>
        <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
          <p>${html}</p>
        </div>
      </div>`;

    await sendCEOEmail({
      subject: `Competitive Analysis Report - ${monthYear}`,
      html,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Monthly report complete in ${elapsed}s ===`);

    return { success: true, reportPath, elapsed };
  } catch (err) {
    logger.error(`Monthly competitive report failed: ${err.message}`, { stack: err.stack });
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function start() {
  logger.info(`Competitor Intelligence Agent starting.`);
  logger.info(`  Weekly scan:    ${WEEKLY_SCHEDULE}`);
  logger.info(`  Monthly report: ${MONTHLY_SCHEDULE}`);

  cron.schedule(WEEKLY_SCHEDULE, () => {
    logger.info('Cron triggered: weekly competitor scan');
    runWeeklyScan();
  }, { timezone: TIMEZONE });

  cron.schedule(MONTHLY_SCHEDULE, () => {
    logger.info('Cron triggered: monthly competitive report');
    runMonthlyReport();
  }, { timezone: TIMEZONE });

  logger.info('Competitor Intelligence Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--scan') || args.includes('-s')) {
    logger.info('Running weekly competitor scan immediately (manual trigger)');
    runWeeklyScan().then((result) => {
      if (result.success) {
        logger.info(`Scan complete: ${result.scanned} competitors, ${result.totalChanges} changes`);
      } else {
        logger.error(`Scan failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else if (args.includes('--report') || args.includes('-r')) {
    logger.info('Running monthly report immediately (manual trigger)');
    runMonthlyReport().then((result) => {
      if (result.success) {
        logger.info(`Report generated: ${result.reportPath}`);
      } else {
        logger.error(`Report failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else if (args.includes('--now') || args.includes('-n')) {
    logger.info('Running full cycle (scan + report) immediately');
    runWeeklyScan()
      .then(() => runMonthlyReport())
      .then((result) => {
        if (result.success) logger.info('Full cycle complete');
        else process.exit(1);
      });
  } else {
    start();
  }
}

module.exports = { start, runWeeklyScan, runMonthlyReport };
