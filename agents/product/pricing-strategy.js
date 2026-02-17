/**
 * Agent 17 - Pricing Strategy Agent
 *
 * Analyzes competitor pricing, tracks price sensitivity, calculates LTV,
 * recommends pricing changes, models price impact, and manages promotions.
 *
 * Schedule: Monthly competitor pricing scan, weekly conversion analysis, quarterly LTV
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

const logger = createLogger('pricing-strategy');

// --- Airtable Tables ---
const TABLES = {
  PRICING_ANALYSIS: 'Pricing_Analysis',
  COMPETITOR_PRICING: 'Competitor_Pricing',
  PRICE_SENSITIVITY: 'Price_Sensitivity',
  LTV_ANALYSIS: 'LTV_Analysis',
  PRICING_RECOMMENDATIONS: 'Pricing_Recommendations',
  PROMOTIONS: 'Promotions',
  CLIENTS: 'Clients',
  INVOICES: 'Invoices',
};

const COMPETITOR_PRICING_PATH = path.join(__dirname, 'competitor-pricing.json');

// ============================================================
// Competitor Pricing Analysis
// ============================================================

function loadCompetitorPricing() {
  try {
    return JSON.parse(fs.readFileSync(COMPETITOR_PRICING_PATH, 'utf-8'));
  } catch (err) {
    logger.error('Failed to load competitor-pricing.json', { error: err.message });
    return { competitors: [] };
  }
}

async function analyzeCompetitorPricing() {
  logger.info('Analyzing competitor pricing');

  const competitorData = loadCompetitorPricing();
  const results = [];

  for (const competitor of competitorData.competitors) {
    try {
      logger.info(`Scanning pricing for: ${competitor.name}`);

      const response = await axios.get(competitor.pricing_url, {
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      const $ = cheerio.load(response.data);
      const pageText = $('body').text().replace(/\s+/g, ' ').trim();

      // Use Claude to extract pricing information
      const pricing = await generateJSON(
        `Extract pricing information from this competitor's pricing page.

Competitor: ${competitor.name}
Page content (excerpt):
${pageText.substring(0, 4000)}

Return JSON with:
- plans: array of { name, price_monthly, price_annual, currency, features: [string], target_audience }
- pricing_model: "per_user", "per_project", "flat_rate", "usage_based", "custom"
- free_trial: boolean
- free_tier: boolean
- enterprise_custom_pricing: boolean
- notable_changes: any pricing elements that seem new or unusual
- scan_date: today's date

If exact prices are not visible, estimate based on available information and note uncertainty.`,
        { model: config.models.standard, maxTokens: 1500 }
      );

      results.push({
        competitor: competitor.name,
        ...pricing,
      });

      // Check for changes from last scan
      const previousRecords = await getRecords(
        TABLES.COMPETITOR_PRICING,
        `{Competitor} = "${competitor.name}"`,
        1
      );

      if (previousRecords.length > 0) {
        const previous = previousRecords[0];
        const previousPlans = JSON.parse(previous.Plans || '[]');

        // Detect price changes
        const changes = detectPriceChanges(previousPlans, pricing.plans || []);

        if (changes.length > 0) {
          logger.info(`Price changes detected for ${competitor.name}: ${changes.join(', ')}`);

          await updateRecord(TABLES.COMPETITOR_PRICING, previous.id, {
            Plans: JSON.stringify(pricing.plans || []),
            Pricing_Model: pricing.pricing_model,
            Free_Trial: pricing.free_trial,
            Free_Tier: pricing.free_tier,
            Last_Scanned: new Date().toISOString(),
            Changes_Detected: changes.join('; '),
            Change_Date: new Date().toISOString().split('T')[0],
          });
        } else {
          await updateRecord(TABLES.COMPETITOR_PRICING, previous.id, {
            Last_Scanned: new Date().toISOString(),
          });
        }
      } else {
        await createRecord(TABLES.COMPETITOR_PRICING, {
          Competitor: competitor.name,
          Pricing_URL: competitor.pricing_url,
          Plans: JSON.stringify(pricing.plans || []),
          Pricing_Model: pricing.pricing_model,
          Free_Trial: pricing.free_trial,
          Free_Tier: pricing.free_tier,
          Last_Scanned: new Date().toISOString(),
        });
      }
    } catch (err) {
      logger.warn(`Failed to scan pricing for ${competitor.name}`, { error: err.message });
    }
  }

  logger.info(`Scanned pricing for ${results.length} competitors`);
  return results;
}

function detectPriceChanges(previousPlans, currentPlans) {
  const changes = [];

  for (const current of currentPlans) {
    const previous = previousPlans.find(
      (p) => p.name && current.name && p.name.toLowerCase() === current.name.toLowerCase()
    );

    if (previous) {
      if (previous.price_monthly !== current.price_monthly) {
        changes.push(
          `${current.name}: ${previous.price_monthly} -> ${current.price_monthly}/mo`
        );
      }
      if (previous.price_annual !== current.price_annual) {
        changes.push(
          `${current.name}: ${previous.price_annual} -> ${current.price_annual}/yr`
        );
      }
    } else if (current.name) {
      changes.push(`New plan detected: ${current.name}`);
    }
  }

  // Check for removed plans
  for (const previous of previousPlans) {
    const stillExists = currentPlans.find(
      (c) => c.name && previous.name && c.name.toLowerCase() === previous.name.toLowerCase()
    );
    if (!stillExists && previous.name) {
      changes.push(`Plan removed: ${previous.name}`);
    }
  }

  return changes;
}

// ============================================================
// Price Sensitivity Tracking
// ============================================================

async function trackPriceSensitivity() {
  logger.info('Tracking price sensitivity / conversion rates');

  try {
    const clients = await getRecords(TABLES.CLIENTS, '');
    const proposals = await getRecords('Sales_Proposals', '', 200);

    // Group by price range and calculate conversion
    const priceRanges = {
      'CHF 0-500': { proposed: 0, converted: 0 },
      'CHF 501-1000': { proposed: 0, converted: 0 },
      'CHF 1001-2000': { proposed: 0, converted: 0 },
      'CHF 2001-5000': { proposed: 0, converted: 0 },
      'CHF 5000+': { proposed: 0, converted: 0 },
    };

    for (const proposal of proposals) {
      const mrr = proposal.MRR || proposal.Monthly_Value || 0;
      const range = getPriceRange(mrr);
      const status = proposal.Status || '';

      if (priceRanges[range]) {
        priceRanges[range].proposed++;
        if (status === 'Won' || status === 'Accepted') {
          priceRanges[range].converted++;
        }
      }
    }

    // Calculate conversion rates
    const sensitivityData = Object.entries(priceRanges).map(([range, data]) => ({
      range,
      proposed: data.proposed,
      converted: data.converted,
      conversionRate:
        data.proposed > 0
          ? Math.round((data.converted / data.proposed) * 100)
          : 0,
    }));

    // Group by industry
    const industryData = {};
    for (const client of clients) {
      const industry = client.Industry || 'Other';
      const mrr = client.MRR || 0;

      if (!industryData[industry]) {
        industryData[industry] = { count: 0, totalMRR: 0, clients: [] };
      }
      industryData[industry].count++;
      industryData[industry].totalMRR += mrr;
      industryData[industry].clients.push(mrr);
    }

    const industryAvgMRR = Object.entries(industryData).map(([industry, data]) => ({
      industry,
      clientCount: data.count,
      avgMRR: data.count > 0 ? Math.round(data.totalMRR / data.count) : 0,
      totalMRR: Math.round(data.totalMRR),
    }));

    // Save to Airtable
    await createRecord(TABLES.PRICE_SENSITIVITY, {
      Date: new Date().toISOString().split('T')[0],
      Price_Ranges: JSON.stringify(sensitivityData),
      Industry_Data: JSON.stringify(industryAvgMRR),
      Total_Proposals: proposals.length,
      Overall_Conversion: proposals.length > 0
        ? Math.round(
            (proposals.filter((p) => p.Status === 'Won' || p.Status === 'Accepted').length /
              proposals.length) *
              100
          )
        : 0,
    });

    logger.info('Price sensitivity data updated', { ranges: sensitivityData });
    return { sensitivityData, industryAvgMRR };
  } catch (err) {
    logger.error('Failed to track price sensitivity', { error: err.message });
    return null;
  }
}

function getPriceRange(mrr) {
  if (mrr <= 500) return 'CHF 0-500';
  if (mrr <= 1000) return 'CHF 501-1000';
  if (mrr <= 2000) return 'CHF 1001-2000';
  if (mrr <= 5000) return 'CHF 2001-5000';
  return 'CHF 5000+';
}

// ============================================================
// LTV Calculation
// ============================================================

async function calculateLTV() {
  logger.info('Calculating Lifetime Value per industry and package');

  try {
    const clients = await getRecords(TABLES.CLIENTS, '');
    const invoices = await getRecords(TABLES.INVOICES, '', 500);

    // Load LTV calculator
    const { calculateClientLTV, calculateCohortLTV } = require('./pricing-models/ltv-calculator');

    const ltvByIndustry = {};
    const ltvByPackage = {};

    for (const client of clients) {
      try {
        const clientInvoices = invoices.filter(
          (i) => i.Client === (client.Name || client.Company)
        );

        const ltv = calculateClientLTV({
          mrr: client.MRR || 0,
          startDate: client.Start_Date || client.Created,
          churnDate: client.Churn_Date || null,
          invoices: clientInvoices,
        });

        const industry = client.Industry || 'Other';
        const plan = client.Plan || 'Unknown';

        if (!ltvByIndustry[industry]) {
          ltvByIndustry[industry] = { values: [], count: 0 };
        }
        ltvByIndustry[industry].values.push(ltv);
        ltvByIndustry[industry].count++;

        if (!ltvByPackage[plan]) {
          ltvByPackage[plan] = { values: [], count: 0 };
        }
        ltvByPackage[plan].values.push(ltv);
        ltvByPackage[plan].count++;
      } catch (err) {
        logger.warn(`LTV calc failed for ${client.Name || client.Company}`, {
          error: err.message,
        });
      }
    }

    // Calculate averages
    const industryLTV = Object.entries(ltvByIndustry).map(([industry, data]) => ({
      industry,
      avgLTV: Math.round(data.values.reduce((a, b) => a + b, 0) / data.count),
      medianLTV: Math.round(median(data.values)),
      clientCount: data.count,
    }));

    const packageLTV = Object.entries(ltvByPackage).map(([plan, data]) => ({
      plan,
      avgLTV: Math.round(data.values.reduce((a, b) => a + b, 0) / data.count),
      medianLTV: Math.round(median(data.values)),
      clientCount: data.count,
    }));

    // Save to Airtable
    await createRecord(TABLES.LTV_ANALYSIS, {
      Date: new Date().toISOString().split('T')[0],
      Industry_LTV: JSON.stringify(industryLTV),
      Package_LTV: JSON.stringify(packageLTV),
      Overall_Avg_LTV: Math.round(
        clients.reduce((sum, c) => sum + (c.MRR || 0) * 12, 0) / Math.max(clients.length, 1)
      ),
      Total_Clients: clients.length,
    });

    logger.info('LTV analysis complete', {
      industries: industryLTV.length,
      packages: packageLTV.length,
    });

    return { industryLTV, packageLTV };
  } catch (err) {
    logger.error('Failed to calculate LTV', { error: err.message });
    return null;
  }
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ============================================================
// Pricing Recommendations
// ============================================================

async function generatePricingRecommendations() {
  logger.info('Generating pricing recommendations');

  try {
    // Gather all relevant data
    const competitorPricing = await getRecords(TABLES.COMPETITOR_PRICING, '', 20);
    const sensitivity = await getRecords(TABLES.PRICE_SENSITIVITY, '', 3);
    const ltvData = await getRecords(TABLES.LTV_ANALYSIS, '', 1);
    const clients = await getRecords(TABLES.CLIENTS, '{Status} = "Active"');

    const currentMRR = clients.reduce((sum, c) => sum + (c.MRR || 0), 0);

    const recommendations = await generateJSON(
      `Analyze our pricing data and provide strategic pricing recommendations.

CURRENT STATE:
- Active clients: ${clients.length}
- Total MRR: CHF ${currentMRR.toLocaleString()}
- Average MRR per client: CHF ${Math.round(currentMRR / Math.max(clients.length, 1)).toLocaleString()}

COMPETITOR PRICING:
${JSON.stringify(competitorPricing.map((c) => ({
  name: c.Competitor,
  model: c.Pricing_Model,
  plans: c.Plans ? JSON.parse(c.Plans).slice(0, 3) : [],
})), null, 2)}

PRICE SENSITIVITY (latest):
${sensitivity.length > 0 ? JSON.stringify(JSON.parse(sensitivity[0].Price_Ranges || '[]'), null, 2) : 'No data'}

LTV DATA:
${ltvData.length > 0 ? `Industry LTV: ${ltvData[0].Industry_LTV || 'N/A'}, Package LTV: ${ltvData[0].Package_LTV || 'N/A'}` : 'No data'}

Provide 3-5 pricing recommendations as JSON array with:
- recommendation: what to change
- rationale: why (supported by data)
- expected_impact: "revenue_increase", "conversion_increase", "retention_improvement", "competitive_advantage"
- estimated_revenue_impact_pct: estimated percentage impact on MRR
- risk_level: "low", "medium", "high"
- implementation_effort: "easy", "moderate", "complex"
- priority: 1-5 (1 = highest)`,
      { model: config.models.standard, maxTokens: 2048 }
    );

    const recs = Array.isArray(recommendations) ? recommendations : [];

    for (const rec of recs) {
      try {
        await createRecord(TABLES.PRICING_RECOMMENDATIONS, {
          Recommendation: rec.recommendation,
          Rationale: rec.rationale,
          Expected_Impact: rec.expected_impact,
          Revenue_Impact_Pct: rec.estimated_revenue_impact_pct,
          Risk: rec.risk_level,
          Effort: rec.implementation_effort,
          Priority: rec.priority,
          Status: 'Proposed',
          Date: new Date().toISOString().split('T')[0],
        });
      } catch (err) {
        logger.warn(`Failed to save recommendation`, { error: err.message });
      }
    }

    logger.info(`Generated ${recs.length} pricing recommendations`);
    return recs;
  } catch (err) {
    logger.error('Failed to generate pricing recommendations', { error: err.message });
    return [];
  }
}

// ============================================================
// Price Change Impact Modeling
// ============================================================

async function modelPriceChangeImpact(priceChangePercent, targetPlan) {
  logger.info(`Modeling price change impact: ${priceChangePercent}% on ${targetPlan || 'all plans'}`);

  try {
    const clients = await getRecords(TABLES.CLIENTS, '{Status} = "Active"');
    const sensitivity = await getRecords(TABLES.PRICE_SENSITIVITY, '', 1);

    // Load price sensitivity model
    const { modelElasticity } = require('./pricing-models/price-sensitivity');

    const affectedClients = targetPlan
      ? clients.filter((c) => c.Plan === targetPlan)
      : clients;

    const currentMRR = affectedClients.reduce((sum, c) => sum + (c.MRR || 0), 0);
    const newMRR = currentMRR * (1 + priceChangePercent / 100);

    // Estimate churn impact using elasticity
    const elasticityResult = modelElasticity({
      priceChangePercent,
      currentClientCount: affectedClients.length,
      currentMRR,
      sensitivityData: sensitivity.length > 0
        ? JSON.parse(sensitivity[0].Price_Ranges || '[]')
        : [],
    });

    const impact = {
      currentMRR: Math.round(currentMRR),
      projectedMRR: Math.round(newMRR * (1 - elasticityResult.estimatedChurnRate / 100)),
      mrrDelta: 0,
      affectedClients: affectedClients.length,
      estimatedChurnRate: elasticityResult.estimatedChurnRate,
      estimatedChurnCount: Math.round(
        affectedClients.length * (elasticityResult.estimatedChurnRate / 100)
      ),
      netImpact: '',
      recommendation: '',
    };

    impact.mrrDelta = impact.projectedMRR - impact.currentMRR;
    impact.netImpact = impact.mrrDelta >= 0 ? 'Positive' : 'Negative';
    impact.recommendation =
      impact.mrrDelta >= 0
        ? 'Price change is projected to be net positive'
        : 'Price change may result in net revenue loss due to expected churn';

    logger.info('Price impact model complete', impact);
    return impact;
  } catch (err) {
    logger.error('Failed to model price change impact', { error: err.message });
    return null;
  }
}

// ============================================================
// Promotional Pricing Management
// ============================================================

async function managePromotions() {
  logger.info('Managing promotional pricing');

  try {
    const activePromos = await getRecords(TABLES.PROMOTIONS, '{Status} = "Active"');
    const now = new Date();

    for (const promo of activePromos) {
      try {
        const endDate = new Date(promo.End_Date);

        // Check for expired promotions
        if (now > endDate) {
          await updateRecord(TABLES.PROMOTIONS, promo.id, {
            Status: 'Expired',
            Expired_Date: now.toISOString().split('T')[0],
          });
          logger.info(`Promotion expired: ${promo.Name}`);
          continue;
        }

        // Track promo performance
        const promoClients = await getRecords(
          TABLES.CLIENTS,
          `{Promo_Code} = "${promo.Code}"`,
          100
        );

        const conversions = promoClients.length;
        const revenue = promoClients.reduce((sum, c) => sum + (c.MRR || 0), 0);

        await updateRecord(TABLES.PROMOTIONS, promo.id, {
          Conversions: conversions,
          Revenue_Generated: revenue,
          Last_Checked: now.toISOString(),
        });

        // Alert if promo is underperforming
        const daysActive = Math.floor((now - new Date(promo.Start_Date)) / (1000 * 60 * 60 * 24));
        const expectedConversions = (promo.Target_Conversions || 10) * (daysActive / 30);

        if (conversions < expectedConversions * 0.5 && daysActive >= 7) {
          logger.warn(`Underperforming promo: ${promo.Name} (${conversions}/${Math.round(expectedConversions)} expected)`);
        }
      } catch (err) {
        logger.warn(`Failed to process promotion: ${promo.Name}`, { error: err.message });
      }
    }

    return activePromos.length;
  } catch (err) {
    logger.error('Failed to manage promotions', { error: err.message });
    return 0;
  }
}

// ============================================================
// Monthly Pricing Report
// ============================================================

async function generateMonthlyPricingReport() {
  logger.info('Generating monthly pricing report');

  try {
    const competitorPricing = await analyzeCompetitorPricing();
    const sensitivityData = await trackPriceSensitivity();
    const ltvData = await calculateLTV();
    const recommendations = await generatePricingRecommendations();

    const now = new Date();
    const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const clients = await getRecords(TABLES.CLIENTS, '{Status} = "Active"');
    const totalMRR = clients.reduce((sum, c) => sum + (c.MRR || 0), 0);
    const avgMRR = clients.length > 0 ? Math.round(totalMRR / clients.length) : 0;

    await sendCEOEmail({
      subject: `Pricing Strategy Report - ${monthName}`,
      html: `
        <h1>Pricing Strategy Report - ${monthName}</h1>
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 700px;">
          <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <strong>Current State:</strong> CHF ${totalMRR.toLocaleString()} MRR | ${clients.length} clients | CHF ${avgMRR.toLocaleString()} avg MRR
          </div>

          <h2>Competitor Pricing Updates</h2>
          ${competitorPricing.length > 0
            ? competitorPricing
                .map(
                  (c) => `
              <div style="border-left: 3px solid #1a237e; padding: 8px 12px; margin: 8px 0;">
                <strong>${c.competitor}</strong>: ${c.pricing_model || 'Unknown model'}
                ${(c.plans || []).map((p) => `<br>&nbsp;&nbsp;${p.name}: ${p.price_monthly || 'Custom'}`).join('')}
              </div>`
                )
                .join('')
            : '<p>No competitor data available</p>'
          }

          <h2>Price Sensitivity</h2>
          ${sensitivityData
            ? `<table style="width: 100%; border-collapse: collapse;">
                <tr style="background: #f5f5f5;"><th style="padding: 8px; text-align: left;">Range</th><th>Proposals</th><th>Won</th><th>Rate</th></tr>
                ${sensitivityData.sensitivityData.map((r) => `
                  <tr><td style="padding: 6px;">${r.range}</td><td style="text-align: center;">${r.proposed}</td><td style="text-align: center;">${r.converted}</td><td style="text-align: center; font-weight: bold;">${r.conversionRate}%</td></tr>
                `).join('')}
               </table>`
            : '<p>No sensitivity data available</p>'
          }

          <h2>Top Recommendations</h2>
          <ol>
            ${recommendations.slice(0, 3).map((r) => `
              <li style="margin-bottom: 10px;">
                <strong>${r.recommendation}</strong><br>
                <span style="color: #666;">${r.rationale}</span><br>
                <span style="color: #1a237e;">Impact: ${r.estimated_revenue_impact_pct}% | Risk: ${r.risk_level}</span>
              </li>
            `).join('')}
          </ol>

          <hr style="margin-top: 30px;">
          <p style="color: #666; font-size: 12px;">Generated by Werkpilot Pricing Strategy Agent</p>
        </div>
      `,
    });

    logger.info('Monthly pricing report sent');
  } catch (err) {
    logger.error('Failed to generate monthly pricing report', { error: err.message });
  }
}

// ============================================================
// Main Execution Flows
// ============================================================

async function runMonthlyAnalysis() {
  logger.info('=== Monthly Pricing Analysis ===');
  const startTime = Date.now();

  try {
    await generateMonthlyPricingReport();
    const promos = await managePromotions();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Monthly pricing analysis complete in ${duration}s`, {
      activePromos: promos,
    });
  } catch (err) {
    logger.error('Monthly pricing analysis failed', { error: err.message, stack: err.stack });
  }
}

async function runWeeklyConversionCheck() {
  logger.info('=== Weekly Conversion Check ===');
  try {
    await trackPriceSensitivity();
    await managePromotions();
  } catch (err) {
    logger.error('Weekly conversion check failed', { error: err.message, stack: err.stack });
  }
}

// ============================================================
// Cron Schedules
// ============================================================

// Monthly on the 5th at 06:00 - full pricing analysis + report
cron.schedule('0 6 5 * *', () => {
  runMonthlyAnalysis().catch((err) =>
    logger.error('Cron monthly analysis failed', { error: err.message })
  );
});

// Weekly on Wednesdays at 07:00 - conversion rate tracking
cron.schedule('0 7 * * 3', () => {
  runWeeklyConversionCheck().catch((err) =>
    logger.error('Cron weekly conversion check failed', { error: err.message })
  );
});

// Quarterly (1st of Jan/Apr/Jul/Oct) at 05:00 - deep LTV analysis
cron.schedule('0 5 1 1,4,7,10 *', () => {
  calculateLTV().catch((err) =>
    logger.error('Cron quarterly LTV failed', { error: err.message })
  );
});

// ============================================================
// Exports
// ============================================================

module.exports = {
  runMonthlyAnalysis,
  runWeeklyConversionCheck,
  analyzeCompetitorPricing,
  trackPriceSensitivity,
  calculateLTV,
  generatePricingRecommendations,
  modelPriceChangeImpact,
  managePromotions,
  generateMonthlyPricingReport,
};

// Run immediately if executed directly
if (require.main === module) {
  logger.info('Pricing Strategy Agent starting (direct execution)');
  runMonthlyAnalysis()
    .then(() => logger.info('Pricing Strategy Agent initial run complete'))
    .catch((err) => {
      logger.error('Pricing Strategy Agent failed', { error: err.message });
      process.exit(1);
    });
}
