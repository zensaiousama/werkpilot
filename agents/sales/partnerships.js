/**
 * Agent 06 — Partnership Agent
 *
 * Identifies potential partners (marketing agencies, web studios, Treuhand-Verbaende,
 * consultants), generates personalized pitch emails, and manages the partnership
 * pipeline from identification through to active partnership.
 *
 * Partnership models: Referral (20%), White-label, Co-marketing
 * Pipeline: Identified -> Contacted -> Meeting -> Agreement -> Active
 *
 * Schedule: Weekly partner identification, daily pipeline check.
 */

const cron = require('node-cron');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('partnerships');

// ── Constants ────────────────────────────────────────────────────────────────

const TABLES = {
  PARTNERS: 'Partners',
  PARTNER_INTERACTIONS: 'PartnerInteractions',
  PARTNER_REFERRALS: 'PartnerReferrals',
  LEADS: 'Leads',
};

const PARTNER_TYPES = {
  MARKETING_AGENCY: {
    name: 'Marketing Agency',
    nameDE: 'Marketing-Agentur',
    pitch: 'We build the technical infrastructure your clients need. You focus on strategy and campaigns.',
    model: 'referral',
  },
  WEB_STUDIO: {
    name: 'Web Studio',
    nameDE: 'Web-Studio',
    pitch: 'We handle overflow projects and complex web applications when your team is at capacity.',
    model: 'white_label',
  },
  TREUHAND: {
    name: 'Treuhand / Fiduciary',
    nameDE: 'Treuhand-Verband',
    pitch: 'Your clients need digital presence. We provide exclusive rates for your network members.',
    model: 'referral',
  },
  CONSULTANT: {
    name: 'Business Consultant',
    nameDE: 'Unternehmensberater',
    pitch: 'Digital transformation is part of every engagement. We are the implementation partner your clients need.',
    model: 'referral',
  },
  IT_COMPANY: {
    name: 'IT Company',
    nameDE: 'IT-Unternehmen',
    pitch: 'You handle infrastructure and security. We handle modern web development. Together, a complete solution.',
    model: 'co_marketing',
  },
};

const PIPELINE_STAGES = ['Identified', 'Contacted', 'Meeting', 'Agreement', 'Active', 'Inactive'];

const PARTNERSHIP_MODELS = {
  referral: {
    name: 'Referral Partnership',
    commission: 0.20,
    description: '20% commission on referred client revenue for 12 months',
  },
  white_label: {
    name: 'White-Label Partnership',
    commission: 0.15,
    description: 'White-label development services at partner rates (-15% from list)',
  },
  co_marketing: {
    name: 'Co-Marketing Partnership',
    commission: 0.10,
    description: 'Joint marketing activities with mutual lead sharing',
  },
};

// ── Partner Identification ───────────────────────────────────────────────────

/**
 * Identify new potential partners from leads or external sources.
 */
async function identifyNewPartners() {
  logger.info('Identifying new potential partners...');

  // Get existing partners to avoid duplicates
  const existingPartners = await getRecords(TABLES.PARTNERS);
  const existingDomains = new Set(
    existingPartners
      .filter(p => p.Website)
      .map(p => extractDomain(p.Website))
  );

  // Look for partner-type leads in the CRM
  const potentialPartners = await getRecords(
    TABLES.LEADS,
    'OR({Industry} = "Marketing", {Industry} = "IT", {Industry} = "Consulting", {Industry} = "Treuhand", {Industry} = "Web Design")'
  );

  const newPartners = [];

  for (const lead of potentialPartners) {
    try {
      const domain = lead.Website ? extractDomain(lead.Website) : null;
      if (domain && existingDomains.has(domain)) {
        continue;
      }

      // Use Claude to assess partnership potential
      const assessment = await assessPartnerPotential(lead);
      if (!assessment || assessment.score < 60) {
        logger.info(`Skipping ${lead.CompanyName}: low partner score (${assessment?.score || 0})`);
        continue;
      }

      // Create partner record
      const partnerRecord = await createRecord(TABLES.PARTNERS, {
        CompanyName: lead.CompanyName,
        ContactName: lead.ContactName || '',
        Email: lead.Email || '',
        Phone: lead.Phone || '',
        Website: lead.Website || '',
        Type: assessment.type,
        ProposedModel: assessment.model,
        PipelineStage: 'Identified',
        Score: assessment.score,
        Notes: assessment.rationale,
        Kanton: lead.Kanton || '',
        IdentifiedAt: new Date().toISOString(),
        Source: 'CRM Lead',
      });

      newPartners.push({
        ...partnerRecord,
        companyName: lead.CompanyName,
        type: assessment.type,
        score: assessment.score,
      });

      if (domain) existingDomains.add(domain);
      logger.info(`New partner identified: ${lead.CompanyName} (${assessment.type}, score: ${assessment.score})`);
    } catch (error) {
      logger.error(`Error assessing ${lead.CompanyName}: ${error.message}`);
    }
  }

  if (newPartners.length > 0) {
    await notifyCEONewPartners(newPartners);
  }

  logger.info(`Identified ${newPartners.length} new potential partners`);
  return newPartners;
}

/**
 * Use Claude to assess if a lead is a good partnership candidate.
 */
async function assessPartnerPotential(lead) {
  const prompt = `Assess this company as a potential partnership candidate for Werkpilot, a Swiss digital agency.

Company details:
- Name: ${lead.CompanyName}
- Industry: ${lead.Industry || 'Unknown'}
- Location: ${lead.City || ''}, ${lead.Kanton || ''}
- Website: ${lead.Website || 'N/A'}
- Description: ${lead.BusinessDescription || 'N/A'}
- Notes: ${lead.ResearchNotes || 'N/A'}

Partner types we seek:
1. Marketing Agency - they need web development for clients
2. Web Studio - overflow/complex project partnership
3. Treuhand/Fiduciary - their SME clients need digital presence
4. Business Consultant - digital transformation implementation
5. IT Company - complementary services

Return JSON:
{
  "score": 0-100,
  "type": "one of: MARKETING_AGENCY, WEB_STUDIO, TREUHAND, CONSULTANT, IT_COMPANY",
  "model": "one of: referral, white_label, co_marketing",
  "rationale": "brief explanation in German",
  "synergies": ["list of potential synergies"]
}`;

  try {
    return await generateJSON(prompt, {
      model: config.models.fast,
      maxTokens: 800,
    });
  } catch (error) {
    logger.error(`Partner assessment failed for ${lead.CompanyName}: ${error.message}`);
    return null;
  }
}

// ── Partnership Outreach ─────────────────────────────────────────────────────

/**
 * Generate and send partnership pitch emails for identified partners.
 */
async function processPartnerOutreach() {
  logger.info('Processing partner outreach...');

  const identifiedPartners = await getRecords(
    TABLES.PARTNERS,
    '{PipelineStage} = "Identified"'
  );

  let sentCount = 0;

  for (const partner of identifiedPartners) {
    try {
      if (!partner.Email) {
        logger.warn(`Skipping ${partner.CompanyName}: no email`);
        continue;
      }

      const pitchEmail = await generatePartnershipPitch(partner);
      if (!pitchEmail) continue;

      await sendEmail({
        to: partner.Email,
        subject: pitchEmail.subject,
        html: formatPartnerEmail(pitchEmail),
        from: `Werkpilot Partnerships <${config.email.user}>`,
      });

      // Update pipeline stage
      await updateRecord(TABLES.PARTNERS, partner.id, {
        PipelineStage: 'Contacted',
        ContactedAt: new Date().toISOString(),
      });

      // Log interaction
      await createRecord(TABLES.PARTNER_INTERACTIONS, {
        PartnerId: partner.id,
        Type: 'pitch_email',
        Subject: pitchEmail.subject,
        Date: new Date().toISOString(),
        Notes: 'Initial partnership pitch sent',
      });

      sentCount++;
      logger.info(`Partnership pitch sent to ${partner.CompanyName}`);

      // Cooldown between sends
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      logger.error(`Failed outreach to ${partner.CompanyName}: ${error.message}`);
    }
  }

  logger.info(`Sent ${sentCount} partnership pitches`);
  return sentCount;
}

/**
 * Generate personalized partnership pitch via Claude.
 */
async function generatePartnershipPitch(partner) {
  const partnerTypeInfo = PARTNER_TYPES[partner.Type] || PARTNER_TYPES.CONSULTANT;
  const modelInfo = PARTNERSHIP_MODELS[partner.ProposedModel] || PARTNERSHIP_MODELS.referral;

  const prompt = `You are the Partnership Manager at Werkpilot, a Swiss digital agency that builds modern websites
and web applications for SMEs.

Write a professional partnership pitch email in German (Swiss business style) to ${partner.CompanyName}.
Contact: ${partner.ContactName || 'Geschaeftsleitung'}

Partner type: ${partnerTypeInfo.nameDE} (${partnerTypeInfo.name})
Value proposition: ${partnerTypeInfo.pitch}
Proposed model: ${modelInfo.name} - ${modelInfo.description}

Partner details:
- Location: ${partner.Kanton || 'Switzerland'}
- Website: ${partner.Website || 'N/A'}
- Notes: ${partner.Notes || 'N/A'}

The email should:
- Be executive-level professional
- Open with a specific observation about their business
- Clearly state the mutual benefit
- Mention the partnership model briefly (${modelInfo.description})
- Include Werkpilot credentials (Swiss digital agency, modern tech stack, KMU focus)
- End with a clear CTA (15-minute discovery call)
- Keep it to 4-5 paragraphs max

Return JSON: {
  "subject": "subject line",
  "body": "email body in HTML",
  "preheader": "preview text"
}`;

  try {
    return await generateJSON(prompt, {
      model: config.models.standard,
      maxTokens: 2000,
    });
  } catch (error) {
    logger.error(`Failed to generate pitch for ${partner.CompanyName}: ${error.message}`);
    return null;
  }
}

/**
 * Format partner email with branding.
 */
function formatPartnerEmail(emailContent) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; padding: 24px 30px;">
        <span style="color: #00d4ff; font-size: 22px; font-weight: 700; letter-spacing: 1px;">Werkpilot</span>
        <span style="color: #888; font-size: 13px; margin-left: 12px;">Partnerships</span>
      </div>
      <div style="padding: 32px 30px; line-height: 1.7; color: #333;">
        ${emailContent.body}
      </div>
      <div style="padding: 20px 30px; background: #f8f9fa; border-top: 1px solid #eee; font-size: 11px; color: #999;">
        <p>Werkpilot GmbH | Partner Program</p>
        <p><a href="https://werkpilot.ch" style="color: #00d4ff;">werkpilot.ch</a></p>
      </div>
    </body>
    </html>
  `;
}

// ── Pipeline Management ──────────────────────────────────────────────────────

/**
 * Follow up with contacted partners who haven't responded.
 */
async function processPartnerFollowUps() {
  logger.info('Processing partner follow-ups...');

  const contactedPartners = await getRecords(
    TABLES.PARTNERS,
    '{PipelineStage} = "Contacted"'
  );

  let followUpCount = 0;

  for (const partner of contactedPartners) {
    try {
      const contactedDate = new Date(partner.ContactedAt);
      const daysSinceContact = Math.ceil((Date.now() - contactedDate) / (1000 * 60 * 60 * 24));

      // Follow up after 7 days
      if (daysSinceContact < 7 || daysSinceContact > 21) continue;

      // Check if we already followed up
      const interactions = await getRecords(
        TABLES.PARTNER_INTERACTIONS,
        `AND({PartnerId} = "${partner.id}", {Type} = "follow_up")`
      );
      if (interactions.length >= 2) {
        // Max 2 follow-ups, then mark as stale
        await updateRecord(TABLES.PARTNERS, partner.id, {
          PipelineStage: 'Inactive',
          Notes: `${partner.Notes || ''}\nNo response after 2 follow-ups`,
        });
        logger.info(`Partner ${partner.CompanyName} moved to Inactive after no response`);
        continue;
      }

      if (!partner.Email) continue;

      const followUpEmail = await generatePartnerFollowUp(partner, interactions.length + 1);
      if (!followUpEmail) continue;

      await sendEmail({
        to: partner.Email,
        subject: followUpEmail.subject,
        html: formatPartnerEmail(followUpEmail),
        from: `Werkpilot Partnerships <${config.email.user}>`,
      });

      await createRecord(TABLES.PARTNER_INTERACTIONS, {
        PartnerId: partner.id,
        Type: 'follow_up',
        Subject: followUpEmail.subject,
        Date: new Date().toISOString(),
        Notes: `Follow-up #${interactions.length + 1}`,
      });

      followUpCount++;
      logger.info(`Follow-up sent to partner ${partner.CompanyName}`);
    } catch (error) {
      logger.error(`Failed follow-up for partner ${partner.CompanyName}: ${error.message}`);
    }
  }

  logger.info(`Sent ${followUpCount} partner follow-ups`);
  return followUpCount;
}

/**
 * Generate partner follow-up email.
 */
async function generatePartnerFollowUp(partner, followUpNumber) {
  const prompt = `Write a brief, professional follow-up email in German (Swiss business style).
This is follow-up #${followUpNumber} to a partnership pitch to ${partner.CompanyName}.
Type: ${(PARTNER_TYPES[partner.Type] || {}).nameDE || partner.Type}

Keep it:
- Short (2-3 paragraphs)
- Reference the original proposal
- Add one new piece of value (e.g., a recent project success, industry trend)
- Gentle CTA for a quick call

Return JSON: { "subject": "subject line", "body": "HTML body", "preheader": "preview" }`;

  try {
    return await generateJSON(prompt, {
      model: config.models.fast,
      maxTokens: 1000,
    });
  } catch (error) {
    logger.error(`Failed to generate follow-up for ${partner.CompanyName}: ${error.message}`);
    return null;
  }
}

/**
 * Track referral performance for active partners.
 */
async function trackReferralPerformance() {
  logger.info('Tracking referral performance...');

  const activePartners = await getRecords(
    TABLES.PARTNERS,
    '{PipelineStage} = "Active"'
  );

  const performanceData = [];

  for (const partner of activePartners) {
    try {
      const referrals = await getRecords(
        TABLES.PARTNER_REFERRALS,
        `{PartnerId} = "${partner.id}"`
      );

      const totalReferrals = referrals.length;
      const convertedReferrals = referrals.filter(r => r.Status === 'Converted').length;
      const totalRevenue = referrals
        .filter(r => r.Revenue)
        .reduce((sum, r) => sum + r.Revenue, 0);
      const commissionDue = totalRevenue * (PARTNERSHIP_MODELS[partner.ProposedModel]?.commission || 0.20);

      performanceData.push({
        partnerId: partner.id,
        partnerName: partner.CompanyName,
        type: partner.Type,
        model: partner.ProposedModel,
        totalReferrals,
        convertedReferrals,
        conversionRate: totalReferrals > 0 ? Math.round((convertedReferrals / totalReferrals) * 100) : 0,
        totalRevenue,
        commissionDue,
      });
    } catch (error) {
      logger.error(`Error tracking referrals for ${partner.CompanyName}: ${error.message}`);
    }
  }

  logger.info(`Tracked performance for ${performanceData.length} active partners`);
  return performanceData;
}

/**
 * Generate weekly pipeline summary for CEO.
 */
async function generatePipelineSummary() {
  logger.info('Generating partnership pipeline summary...');

  const allPartners = await getRecords(TABLES.PARTNERS);
  const performance = await trackReferralPerformance();

  // Count by stage
  const stageCounts = {};
  for (const stage of PIPELINE_STAGES) {
    stageCounts[stage] = allPartners.filter(p => p.PipelineStage === stage).length;
  }

  const stageRows = PIPELINE_STAGES.map(stage => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${stage}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${stageCounts[stage] || 0}</td>
    </tr>
  `).join('');

  const performanceRows = performance.map(p => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${p.partnerName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${p.totalReferrals}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${p.conversionRate}%</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">CHF ${p.totalRevenue.toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">CHF ${p.commissionDue.toLocaleString()}</td>
    </tr>
  `).join('');

  const totalCommission = performance.reduce((sum, p) => sum + p.commissionDue, 0);
  const totalPartnerRevenue = performance.reduce((sum, p) => sum + p.totalRevenue, 0);

  const html = `
    <h2>Partnership Pipeline Summary</h2>

    <h3>Pipeline Overview</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">Stage</th>
        <th style="padding: 8px; text-align: left;">Count</th>
      </tr>
      ${stageRows}
    </table>

    ${performance.length > 0 ? `
      <h3 style="margin-top: 24px;">Active Partner Performance</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f5f5f5;">
          <th style="padding: 8px; text-align: left;">Partner</th>
          <th style="padding: 8px; text-align: left;">Referrals</th>
          <th style="padding: 8px; text-align: left;">Conv. Rate</th>
          <th style="padding: 8px; text-align: left;">Revenue</th>
          <th style="padding: 8px; text-align: left;">Commission</th>
        </tr>
        ${performanceRows}
      </table>
      <p style="margin-top: 12px;">
        <strong>Total Partner Revenue:</strong> CHF ${totalPartnerRevenue.toLocaleString()}<br>
        <strong>Total Commission Due:</strong> CHF ${totalCommission.toLocaleString()}
      </p>
    ` : '<p>No active partners with referral data yet.</p>'}
  `;

  try {
    await sendCEOEmail({
      subject: `Partnerships: ${allPartners.length} total, ${stageCounts.Active || 0} active`,
      html,
    });
    logger.info('Pipeline summary sent to CEO');
  } catch (error) {
    logger.error(`Failed to send pipeline summary: ${error.message}`);
  }
}

// ── Notify CEO ───────────────────────────────────────────────────────────────

async function notifyCEONewPartners(partners) {
  const rows = partners.map(p => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${p.companyName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${(PARTNER_TYPES[p.type] || {}).nameDE || p.type}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${p.score}/100</td>
    </tr>
  `).join('');

  const html = `
    <h2>New Partners Identified</h2>
    <p>${partners.length} new potential partner(s) found:</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">Company</th>
        <th style="padding: 8px; text-align: left;">Type</th>
        <th style="padding: 8px; text-align: left;">Score</th>
      </tr>
      ${rows}
    </table>
  `;

  try {
    await sendCEOEmail({
      subject: `${partners.length} new potential partner(s) identified`,
      html,
    });
  } catch (error) {
    logger.error(`Failed to notify CEO about new partners: ${error.message}`);
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function extractDomain(url) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// ── Main Runs ────────────────────────────────────────────────────────────────

async function runWeeklyCycle() {
  logger.info('=== Partnership Agent Weekly Cycle Started ===');
  const startTime = Date.now();

  try {
    await identifyNewPartners();
    await processPartnerOutreach();
    await generatePipelineSummary();
  } catch (error) {
    logger.error(`Weekly cycle failed: ${error.message}`, { stack: error.stack });
    await sendCEOEmail({
      subject: 'Partnership Agent: Weekly Cycle Error',
      html: `<p>Error:</p><pre>${error.message}</pre>`,
    });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Weekly cycle completed in ${duration}s ===`);
}

async function runDailyPipeline() {
  logger.info('=== Partnership Agent Daily Pipeline Check ===');

  try {
    await processPartnerFollowUps();
  } catch (error) {
    logger.error(`Daily pipeline check failed: ${error.message}`);
  }
}

// ── Cron Scheduling ──────────────────────────────────────────────────────────

// Weekly partner identification and outreach (Monday at 10:00)
cron.schedule('0 10 * * 1', () => {
  runWeeklyCycle().catch(err => logger.error(`Cron weekly error: ${err.message}`));
});

// Daily pipeline follow-up check at 14:00
cron.schedule('0 14 * * 1-5', () => {
  runDailyPipeline().catch(err => logger.error(`Cron daily error: ${err.message}`));
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runWeeklyCycle,
  runDailyPipeline,
  identifyNewPartners,
  processPartnerOutreach,
  processPartnerFollowUps,
  trackReferralPerformance,
  generatePipelineSummary,
  PARTNER_TYPES,
  PARTNERSHIP_MODELS,
  PIPELINE_STAGES,
};

// Run immediately if executed directly
if (require.main === module) {
  runWeeklyCycle()
    .then(() => logger.info('Manual run completed'))
    .catch(err => logger.error(`Manual run failed: ${err.message}`));
}
