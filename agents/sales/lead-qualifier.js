/**
 * Agent 12 — Lead Qualifier Agent
 *
 * Advanced lead qualification with multi-factor scoring, Swiss-specific signals,
 * industry weighting, and automatic dashboard sync.
 *
 * Features:
 * - Multi-factor scoring: website quality, business size, responsiveness, budget fit
 * - Industry-specific scoring weights (Treuhand +10, Gastronomie -5)
 * - Swiss-specific signals: .ch domain, Swiss phone format, Canton-tier scoring
 * - Dashboard sync after qualification
 * - Token tracking and usage monitoring
 *
 * Usage:
 *   node lead-qualifier.js --mode=continuous  # Run continuously
 *   node lead-qualifier.js --lead-id=abc123   # Qualify single lead
 */

const { createLogger } = require('../shared/utils/logger');
const { generateJSON } = require('../shared/utils/claude-client');
const { getRecords, updateRecord } = require('../shared/utils/airtable-client');
const dashboardSync = require('../shared/utils/dashboard-sync');
const config = require('../shared/utils/config');

const logger = createLogger('lead-qualifier');

// ── Constants ────────────────────────────────────────────────────────────────

const AGENT_NAME = 'lead-qualifier';
const TABLES = {
  LEADS: 'Leads',
};

// Scoring weights (total: 100 points)
const SCORING_WEIGHTS = {
  websiteQuality: 25,
  businessSize: 25,
  responsiveness: 25,
  budgetFit: 25,
};

// Industry-specific bonuses/penalties
const INDUSTRY_MODIFIERS = {
  'Treuhand': +10,
  'Beratung': +5,
  'Consulting': +5,
  'Immobilien': +5,
  'Real Estate': +5,
  'Gastronomie': -5,
  'Gastro': -5,
  'Hospitality': -5,
};

// Canton tier scoring (economic strength)
const CANTON_TIERS = {
  tier1: ['ZH', 'ZG', 'BS', 'GE', 'VD'], // +10 points
  tier2: ['BE', 'LU', 'SG', 'AG', 'BL'], // +5 points
  tier3: [], // 0 points (all others)
};

// Swiss-specific regex patterns
const SWISS_PATTERNS = {
  domain: /\.ch$/i,
  phone: /^(\+41|0041|0)\s?(\d{2})\s?(\d{3})\s?(\d{2})\s?(\d{2})$/,
  mobilePhone: /^(\+41|0041|0)\s?(7[5-9])\s?(\d{3})\s?(\d{2})\s?(\d{2})$/,
};

// ── Swiss-Specific Signal Detection ─────────────────────────────────────────

/**
 * Calculate Swiss-specific bonus points
 */
function calculateSwissBonus(lead) {
  let bonus = 0;

  // .ch domain bonus (+5 points)
  if (lead.Website && SWISS_PATTERNS.domain.test(lead.Website)) {
    bonus += 5;
    logger.info(`Swiss domain detected for ${lead.CompanyName}: +5 points`);
  }

  // Swiss phone format bonus (+3 points)
  if (lead.Phone && (SWISS_PATTERNS.phone.test(lead.Phone) || SWISS_PATTERNS.mobilePhone.test(lead.Phone))) {
    bonus += 3;
    logger.info(`Swiss phone format detected for ${lead.CompanyName}: +3 points`);
  }

  // Canton-tier bonus
  if (lead.Canton) {
    const canton = lead.Canton.toUpperCase();
    if (CANTON_TIERS.tier1.includes(canton)) {
      bonus += 10;
      logger.info(`Tier 1 canton (${canton}) for ${lead.CompanyName}: +10 points`);
    } else if (CANTON_TIERS.tier2.includes(canton)) {
      bonus += 5;
      logger.info(`Tier 2 canton (${canton}) for ${lead.CompanyName}: +5 points`);
    }
  }

  return bonus;
}

/**
 * Calculate industry-specific modifier
 */
function calculateIndustryModifier(industry) {
  if (!industry) return 0;

  for (const [key, modifier] of Object.entries(INDUSTRY_MODIFIERS)) {
    if (industry.toLowerCase().includes(key.toLowerCase())) {
      logger.info(`Industry modifier for ${industry}: ${modifier > 0 ? '+' : ''}${modifier} points`);
      return modifier;
    }
  }

  return 0;
}

// ── Multi-Factor Scoring ─────────────────────────────────────────────────────

/**
 * Score website quality (0-25 points)
 */
async function scoreWebsiteQuality(lead) {
  const prompt = `Analyze this lead's website quality and provide a score from 0-25.

Lead Info:
- Company: ${lead.CompanyName || 'N/A'}
- Website: ${lead.Website || 'N/A'}
- Industry: ${lead.Industry || 'N/A'}
- Notes: ${lead.Notes || 'N/A'}

Scoring criteria:
- No website or broken link: 0-5 points (opportunity!)
- Outdated/poor design: 6-10 points
- Basic functional site: 11-15 points
- Modern but needs optimization: 16-20 points
- Excellent site (less opportunity): 21-25 points

Return JSON: {"score": number, "reason": "brief explanation"}`;

  try {
    const result = await generateJSON(prompt, {
      model: config.models.fast,
      maxTokens: 200,
    });
    return { score: Math.min(25, Math.max(0, result.score)), reason: result.reason };
  } catch (error) {
    logger.warn(`Website scoring failed for ${lead.CompanyName}: ${error.message}`);
    return { score: 12, reason: 'Auto-scored (default mid-range)' };
  }
}

/**
 * Score business size (0-25 points)
 */
function scoreBusinessSize(lead) {
  const notes = (lead.Notes || '').toLowerCase();
  const companyName = (lead.CompanyName || '').toLowerCase();

  // Detect size indicators
  const indicators = {
    large: ['ag', 'gmbh', 'sa', 'inc', '50+ mitarbeiter', '100+ employees'],
    medium: ['10-50 mitarbeiter', '10-50 employees', 'team'],
    small: ['einzelunternehmen', 'sole proprietor', 'freelance', '1-5 mitarbeiter'],
  };

  let score = 15; // default medium size
  let reason = 'Medium-sized business (default)';

  if (indicators.large.some(ind => companyName.includes(ind) || notes.includes(ind))) {
    score = 25;
    reason = 'Large business detected';
  } else if (indicators.small.some(ind => companyName.includes(ind) || notes.includes(ind))) {
    score = 10;
    reason = 'Small business detected';
  }

  return { score, reason };
}

/**
 * Score responsiveness (0-25 points)
 */
function scoreResponsiveness(lead) {
  const lastContact = lead.LastContact ? new Date(lead.LastContact) : null;
  const createdAt = lead.CreatedAt ? new Date(lead.CreatedAt) : new Date();
  const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  let score = 15; // default
  let reason = 'No contact history yet';

  if (!lastContact) {
    // New lead - score based on freshness
    if (daysSinceCreation <= 1) {
      score = 25;
      reason = 'Fresh lead (< 1 day old)';
    } else if (daysSinceCreation <= 7) {
      score = 20;
      reason = 'Recent lead (< 1 week old)';
    }
  } else {
    // Has contact history - score based on response time
    const hoursSinceContact = Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60));

    if (hoursSinceContact <= 24) {
      score = 25;
      reason = 'Responded within 24 hours';
    } else if (hoursSinceContact <= 72) {
      score = 20;
      reason = 'Responded within 3 days';
    } else if (hoursSinceContact <= 168) {
      score = 15;
      reason = 'Responded within 1 week';
    } else {
      score = 10;
      reason = 'Slow response (> 1 week)';
    }
  }

  return { score, reason };
}

/**
 * Score budget fit (0-25 points)
 */
function scoreBudgetFit(lead) {
  const budget = lead.Budget || lead.EstimatedBudget || '';
  const budgetLower = budget.toLowerCase();

  let score = 15; // default unknown budget
  let reason = 'Budget not specified';

  if (budgetLower.includes('15000') || budgetLower.includes('15\'000')) {
    score = 25;
    reason = 'High budget (CHF 15,000+)';
  } else if (budgetLower.includes('6000') || budgetLower.includes('6\'000')) {
    score = 20;
    reason = 'Medium budget (CHF 6,000-15,000)';
  } else if (budgetLower.includes('3000') || budgetLower.includes('3\'000')) {
    score = 15;
    reason = 'Low-medium budget (CHF 3,000-6,000)';
  } else if (budgetLower.includes('unter') || budgetLower.includes('under')) {
    score = 5;
    reason = 'Low budget (< CHF 3,000)';
  }

  return { score, reason };
}

// ── Main Qualification Function ─────────────────────────────────────────────

/**
 * Qualify a lead with multi-factor scoring
 */
async function qualifyLead(lead) {
  logger.info(`Qualifying lead: ${lead.CompanyName} (${lead.id})`);

  const startTime = Date.now();
  let tokensUsed = 0;

  try {
    // Calculate each scoring factor
    const websiteScore = await scoreWebsiteQuality(lead);
    const businessSizeScore = scoreBusinessSize(lead);
    const responsivenessScore = scoreResponsiveness(lead);
    const budgetScore = scoreBudgetFit(lead);

    // Calculate base score (weighted)
    const baseScore = Math.round(
      (websiteScore.score / 25) * SCORING_WEIGHTS.websiteQuality +
      (businessSizeScore.score / 25) * SCORING_WEIGHTS.businessSize +
      (responsivenessScore.score / 25) * SCORING_WEIGHTS.responsiveness +
      (budgetScore.score / 25) * SCORING_WEIGHTS.budgetFit
    );

    // Add Swiss bonuses
    const swissBonus = calculateSwissBonus(lead);

    // Add industry modifier
    const industryModifier = calculateIndustryModifier(lead.Industry);

    // Calculate final score (capped at 100)
    const finalScore = Math.min(100, Math.max(0, baseScore + swissBonus + industryModifier));

    // Determine qualification tier
    let tier = 'C - Low Priority';
    if (finalScore >= 80) tier = 'A - Hot Lead';
    else if (finalScore >= 60) tier = 'B - Qualified';

    // Build qualification notes
    const qualificationNotes = `
Lead Qualification Score: ${finalScore}/100 (${tier})

Base Score: ${baseScore}/100
- Website Quality: ${websiteScore.score}/25 - ${websiteScore.reason}
- Business Size: ${businessSizeScore.score}/25 - ${businessSizeScore.reason}
- Responsiveness: ${responsivenessScore.score}/25 - ${responsivenessScore.reason}
- Budget Fit: ${budgetScore.score}/25 - ${budgetScore.reason}

Modifiers:
- Swiss Signals: +${swissBonus} points
- Industry (${lead.Industry || 'N/A'}): ${industryModifier > 0 ? '+' : ''}${industryModifier} points

Qualified by: ${AGENT_NAME}
Qualified at: ${new Date().toISOString()}
`.trim();

    // Update lead in Airtable
    await updateRecord(TABLES.LEADS, lead.id, {
      QualificationScore: finalScore,
      QualificationTier: tier,
      QualificationNotes: qualificationNotes,
      QualifiedAt: new Date().toISOString(),
      QualifiedBy: AGENT_NAME,
    });

    // Sync to dashboard
    await dashboardSync.syncLeadUpdate(lead.id, {
      qualificationScore: finalScore,
      qualificationTier: tier,
      status: finalScore >= 60 ? 'Qualified' : 'Nurture',
    });

    const duration = Date.now() - startTime;
    logger.info(`Lead qualified: ${lead.CompanyName} - Score: ${finalScore}/100 (${tier}) - ${duration}ms`);

    // Track execution in dashboard
    await dashboardSync.logAgentExecution(
      AGENT_NAME,
      new Date(startTime),
      new Date(),
      'success',
      null,
      tokensUsed,
      config.models.fast
    );

    return {
      success: true,
      leadId: lead.id,
      companyName: lead.CompanyName,
      score: finalScore,
      tier,
      duration,
    };
  } catch (error) {
    logger.error(`Failed to qualify lead ${lead.CompanyName}: ${error.message}`);

    await dashboardSync.logAgentExecution(
      AGENT_NAME,
      new Date(startTime),
      new Date(),
      'error',
      error.message,
      tokensUsed,
      config.models.fast
    );

    return {
      success: false,
      leadId: lead.id,
      companyName: lead.CompanyName,
      error: error.message,
    };
  }
}

// ── Continuous Mode ──────────────────────────────────────────────────────────

/**
 * Run qualification on all unqualified leads
 */
async function runContinuous() {
  logger.info('Starting continuous lead qualification...');

  try {
    // Sync agent status
    await dashboardSync.syncAgentStatus(AGENT_NAME, 'active');

    // Get unqualified leads
    const leads = await getRecords(
      TABLES.LEADS,
      "AND({Status} != 'Disqualified', {QualifiedAt} = '')"
    );

    logger.info(`Found ${leads.length} unqualified leads`);

    if (leads.length === 0) {
      logger.info('No leads to qualify. Exiting.');
      await dashboardSync.syncAgentStatus(AGENT_NAME, 'idle');
      return;
    }

    const results = [];

    for (const lead of leads) {
      const result = await qualifyLead(lead);
      results.push(result);

      // Rate limiting: wait 2 seconds between leads
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info(`Qualification complete: ${successful} successful, ${failed} failed`);

    // Send summary notification
    await dashboardSync.sendNotification(
      'Lead Qualification Complete',
      `Qualified ${successful} leads. ${failed} failed.`,
      'success'
    );

    await dashboardSync.syncAgentStatus(AGENT_NAME, 'idle', 100, successful, failed);
  } catch (error) {
    logger.error(`Continuous mode error: ${error.message}`);
    await dashboardSync.syncAgentStatus(AGENT_NAME, 'error');
    await dashboardSync.sendNotification(
      'Lead Qualifier Error',
      error.message,
      'error'
    );
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1];
  const leadId = args.find(arg => arg.startsWith('--lead-id='))?.split('=')[1];

  if (leadId) {
    // Qualify single lead
    const leads = await getRecords(TABLES.LEADS, `{AirtableId} = "${leadId}"`);
    if (leads.length === 0) {
      logger.error(`Lead not found: ${leadId}`);
      process.exit(1);
    }
    const result = await qualifyLead(leads[0]);
    console.log(JSON.stringify(result, null, 2));
  } else if (mode === 'continuous') {
    await runContinuous();
  } else {
    console.log('Usage:');
    console.log('  node lead-qualifier.js --mode=continuous');
    console.log('  node lead-qualifier.js --lead-id=abc123');
    process.exit(1);
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  qualifyLead,
  runContinuous,
  scoreWebsiteQuality,
  scoreBusinessSize,
  scoreResponsiveness,
  scoreBudgetFit,
  calculateSwissBonus,
  calculateIndustryModifier,
};

// Start if executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}
