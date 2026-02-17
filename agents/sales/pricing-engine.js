/**
 * Agent 07 — Pricing Engine Agent
 *
 * Dynamic quote generation based on industry, kanton, scope, languages,
 * and urgency. Generates branded PDF quotes via Puppeteer, supports
 * A/B testing of pricing, and provides data-driven pricing recommendations.
 *
 * Schedule: On-demand via exports, with daily A/B test analysis.
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../shared/utils/logger');
const { generateJSON } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('pricing-engine');

// ── Load Configuration ───────────────────────────────────────────────────────

const pricingConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pricing-config.json'), 'utf-8')
);

const quoteTemplateHtml = fs.readFileSync(
  path.join(__dirname, 'quote-template.html'), 'utf-8'
);

// ── Constants ────────────────────────────────────────────────────────────────

const TABLES = {
  QUOTES: 'Quotes',
  LEADS: 'Leads',
  AB_TESTS: 'PricingABTests',
  PRICING_LOG: 'PricingLog',
};

const OUTPUT_DIR = path.join(__dirname, '../../output/quotes');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ── Price Calculation ────────────────────────────────────────────────────────

/**
 * Calculate the total price for a quote request.
 *
 * @param {Object} params - Quote parameters
 * @param {string} params.packageId - Base package ID (starter, professional, enterprise)
 * @param {string} params.industry - Industry code
 * @param {string} params.kanton - Swiss kanton code
 * @param {string[]} params.addons - Array of addon IDs
 * @param {number} params.additionalLanguages - Number of extra languages
 * @param {string} params.urgency - standard, priority, or rush
 * @param {string} [params.discountCode] - Optional discount code
 * @param {string} [params.abVariant] - A/B test variant (A, B, C)
 * @returns {Object} Detailed price breakdown
 */
function calculatePrice(params) {
  const {
    packageId = 'professional',
    industry = 'default',
    kanton = 'default',
    addons = [],
    additionalLanguages = 0,
    urgency = 'standard',
    discountCode = null,
    abVariant = null,
  } = params;

  const pkg = pricingConfig.basePackages[packageId];
  if (!pkg) {
    throw new Error(`Unknown package: ${packageId}`);
  }

  // Base price
  let basePrice = pkg.basePrice;

  // Industry multiplier
  const industryMultiplier = pricingConfig.industryMultipliers[industry]
    || pricingConfig.industryMultipliers.default;

  // Kanton multiplier
  const kantonMultiplier = pricingConfig.kantonMultipliers[kanton]
    || pricingConfig.kantonMultipliers.default;

  // Urgency multiplier
  const urgencyMultiplier = pricingConfig.urgencyMultiplier[urgency]
    || pricingConfig.urgencyMultiplier.standard;

  // A/B test multiplier
  let abMultiplier = 1.0;
  const selectedVariant = abVariant || selectABVariant();
  const variant = pricingConfig.abTestVariants[selectedVariant];
  if (variant && variant.active) {
    abMultiplier = variant.modifier;
  }

  // Calculate adjusted base price
  const adjustedBase = Math.round(basePrice * industryMultiplier * kantonMultiplier * urgencyMultiplier * abMultiplier);

  // Calculate addons
  const addonItems = [];
  let addonsTotal = 0;

  for (const addonId of addons) {
    const addon = pricingConfig.addons[addonId];
    if (!addon) {
      logger.warn(`Unknown addon: ${addonId}`);
      continue;
    }
    const addonPrice = addon.price;
    addonItems.push({
      id: addonId,
      name: addon.nameDE || addon.name,
      price: addonPrice,
      recurring: addon.recurring || false,
      unit: addon.unit || null,
    });
    addonsTotal += addonPrice;
  }

  // Additional languages
  if (additionalLanguages > 0) {
    const langAddon = pricingConfig.addons.additional_language;
    const langTotal = langAddon.price * additionalLanguages;
    addonItems.push({
      id: 'additional_language',
      name: `${langAddon.nameDE} (${additionalLanguages}x)`,
      price: langTotal,
      quantity: additionalLanguages,
    });
    addonsTotal += langTotal;
  }

  // Subtotal before discounts
  const subtotal = adjustedBase + addonsTotal;

  // Calculate discounts
  let discountPercent = 0;
  let discountLabel = '';

  if (discountCode === 'referral') {
    discountPercent = pricingConfig.discounts.referral;
    discountLabel = 'Empfehlungsrabatt';
  } else if (discountCode === 'partner') {
    discountPercent = pricingConfig.discounts.partner;
    discountLabel = 'Partnerrabatt';
  } else if (discountCode === 'nonprofit') {
    discountPercent = pricingConfig.discounts.nonprofit;
    discountLabel = 'Non-Profit Rabatt';
  } else if (discountCode === 'annual') {
    discountPercent = pricingConfig.discounts.annual_payment;
    discountLabel = 'Jahresrabatt';
  }

  // Bundle discount for 3+ addons
  if (addons.length >= 3) {
    const bundleDiscount = pricingConfig.discounts.bundle_3plus_addons;
    if (bundleDiscount > discountPercent) {
      discountPercent = bundleDiscount;
      discountLabel = 'Paketrabatt (3+ Zusatzoptionen)';
    }
  }

  const discountAmount = Math.round(subtotal * discountPercent);
  const afterDiscount = subtotal - discountAmount;

  // VAT
  const vatAmount = Math.round(afterDiscount * pricingConfig.vatRate);
  const total = afterDiscount + vatAmount;

  // Payment terms
  const paymentTerms = pricingConfig.quoteSettings.paymentTerms;
  const depositAmount = Math.round(total * paymentTerms.deposit);
  const milestoneAmount = Math.round(total * paymentTerms.milestone);
  const completionAmount = total - depositAmount - milestoneAmount;

  // Delivery timeline
  let deliveryDays = pkg.deliveryDays;
  if (urgency === 'priority') deliveryDays = Math.round(deliveryDays * 0.75);
  if (urgency === 'rush') deliveryDays = Math.round(deliveryDays * 0.5);

  return {
    packageId,
    packageName: pkg.nameDE || pkg.name,
    packageDescription: pkg.descriptionDE || pkg.description,
    packageIncludes: pkg.includes,
    basePrice,
    adjustedBase,
    multipliers: {
      industry: { code: industry, value: industryMultiplier },
      kanton: { code: kanton, value: kantonMultiplier },
      urgency: { code: urgency, value: urgencyMultiplier },
      abTest: { variant: selectedVariant, value: abMultiplier },
    },
    addonItems,
    addonsTotal,
    subtotal,
    discount: {
      code: discountCode,
      label: discountLabel,
      percent: discountPercent,
      amount: discountAmount,
    },
    afterDiscount,
    vat: {
      rate: pricingConfig.vatRate,
      amount: vatAmount,
    },
    total,
    payment: {
      deposit: depositAmount,
      milestone: milestoneAmount,
      completion: completionAmount,
    },
    deliveryDays,
    maxRevisions: pkg.maxRevisions,
    currency: pricingConfig.currency,
    abVariant: selectedVariant,
  };
}

/**
 * Select an A/B test variant randomly from active variants.
 */
function selectABVariant() {
  const activeVariants = Object.keys(pricingConfig.abTestVariants)
    .filter(k => pricingConfig.abTestVariants[k].active);
  if (activeVariants.length === 0) return 'A';
  return activeVariants[Math.floor(Math.random() * activeVariants.length)];
}

// ── Quote Generation ─────────────────────────────────────────────────────────

/**
 * Generate a complete quote with PDF.
 *
 * @param {Object} params - Quote parameters
 * @param {Object} params.client - Client details (company, contact, email, address)
 * @param {Object} params.pricing - Pricing parameters for calculatePrice()
 * @returns {Object} Quote details including file path
 */
async function generateQuote(params) {
  const { client, pricing } = params;
  logger.info(`Generating quote for ${client.company}...`);

  // Calculate price
  const priceBreakdown = calculatePrice(pricing);

  // Generate quote number
  const quoteNumber = generateQuoteNumber();
  const quoteDate = new Date().toLocaleDateString('de-CH');
  const validUntil = new Date(Date.now() + pricingConfig.quoteSettings.validityDays * 86400000)
    .toLocaleDateString('de-CH');

  // Build HTML from template
  const html = buildQuoteHtml({
    quoteNumber,
    quoteDate,
    validUntil,
    client,
    priceBreakdown,
  });

  // Generate PDF
  let pdfPath = null;
  try {
    pdfPath = await generatePDF(html, quoteNumber);
    logger.info(`PDF generated: ${pdfPath}`);
  } catch (error) {
    logger.error(`PDF generation failed: ${error.message}`);
  }

  // Store in Airtable
  try {
    await createRecord(TABLES.QUOTES, {
      QuoteNumber: quoteNumber,
      ClientCompany: client.company,
      ClientEmail: client.email,
      Package: priceBreakdown.packageName,
      Subtotal: priceBreakdown.subtotal,
      Discount: priceBreakdown.discount.amount,
      VAT: priceBreakdown.vat.amount,
      Total: priceBreakdown.total,
      Status: 'Sent',
      ABVariant: priceBreakdown.abVariant,
      Industry: pricing.industry,
      Kanton: pricing.kanton,
      Urgency: pricing.urgency,
      CreatedAt: new Date().toISOString(),
      ValidUntil: validUntil,
    });
  } catch (error) {
    logger.error(`Failed to store quote in Airtable: ${error.message}`);
  }

  // Log for A/B testing
  try {
    await createRecord(TABLES.AB_TESTS, {
      QuoteNumber: quoteNumber,
      Variant: priceBreakdown.abVariant,
      BasePrice: priceBreakdown.basePrice,
      FinalPrice: priceBreakdown.total,
      Industry: pricing.industry,
      Kanton: pricing.kanton,
      CreatedAt: new Date().toISOString(),
      Outcome: 'Pending',
    });
  } catch (error) {
    logger.error(`Failed to log A/B test data: ${error.message}`);
  }

  return {
    quoteNumber,
    priceBreakdown,
    pdfPath,
    html,
  };
}

/**
 * Generate unique quote number.
 */
function generateQuoteNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `WP-${year}${month}-${random}`;
}

/**
 * Build HTML for the quote from template.
 */
function buildQuoteHtml({ quoteNumber, quoteDate, validUntil, client, priceBreakdown }) {
  const companyInfo = pricingConfig.quoteSettings.companyInfo;

  // Build includes list
  const includesHtml = priceBreakdown.packageIncludes
    .map(item => `<li>${item}</li>`)
    .join('\n');

  // Build line items
  let lineItemsHtml = `
    <tr>
      <td>
        <div class="item-name">${priceBreakdown.packageName}</div>
        <div class="item-description">${priceBreakdown.packageDescription}</div>
      </td>
      <td>1</td>
      <td>CHF ${priceBreakdown.adjustedBase.toLocaleString('de-CH')}</td>
      <td>CHF ${priceBreakdown.adjustedBase.toLocaleString('de-CH')}</td>
    </tr>
  `;

  for (const addon of priceBreakdown.addonItems) {
    lineItemsHtml += `
      <tr>
        <td>
          <div class="item-name">${addon.name}</div>
          ${addon.recurring ? '<div class="item-description">Wiederkehrend</div>' : ''}
        </td>
        <td>${addon.quantity || 1}</td>
        <td>CHF ${addon.price.toLocaleString('de-CH')}</td>
        <td>CHF ${addon.price.toLocaleString('de-CH')}</td>
      </tr>
    `;
  }

  // Build discount row
  let discountRow = '';
  if (priceBreakdown.discount.amount > 0) {
    discountRow = `
      <tr class="discount">
        <td>${priceBreakdown.discount.label} (-${Math.round(priceBreakdown.discount.percent * 100)}%)</td>
        <td>-CHF ${priceBreakdown.discount.amount.toLocaleString('de-CH')}</td>
      </tr>
    `;
  }

  // Build timeline steps
  const deliveryDays = priceBreakdown.deliveryDays;
  const timelineSteps = [
    { label: 'Kickoff', days: 0 },
    { label: 'Design', days: Math.round(deliveryDays * 0.25) },
    { label: 'Entwicklung', days: Math.round(deliveryDays * 0.6) },
    { label: 'Testing', days: Math.round(deliveryDays * 0.8) },
    { label: 'Launch', days: deliveryDays },
  ];

  const timelineHtml = timelineSteps.map((step, i) => {
    const date = new Date(Date.now() + step.days * 86400000).toLocaleDateString('de-CH');
    return `
      <div class="timeline-step">
        <div class="timeline-dot">${i + 1}</div>
        <div class="timeline-label">${step.label}</div>
        <div class="timeline-date">${date}</div>
      </div>
    `;
  }).join('');

  // A/B test note (hidden from client)
  const abTestNote = `Ref: ${priceBreakdown.abVariant}`;

  // Replace template placeholders
  let html = quoteTemplateHtml;
  const replacements = {
    '{{quote_number}}': quoteNumber,
    '{{quote_date}}': quoteDate,
    '{{valid_until}}': validUntil,
    '{{prepared_by}}': 'Werkpilot Team',
    '{{client_company}}': client.company || '',
    '{{client_contact}}': client.contact || '',
    '{{client_address}}': client.address || '',
    '{{client_email}}': client.email || '',
    '{{company_address}}': companyInfo.address,
    '{{company_email}}': companyInfo.email,
    '{{company_website}}': companyInfo.website,
    '{{company_uid}}': companyInfo.uid,
    '{{package_name}}': priceBreakdown.packageName,
    '{{package_description}}': priceBreakdown.packageDescription,
    '{{package_includes}}': includesHtml,
    '{{line_items}}': lineItemsHtml,
    '{{subtotal}}': priceBreakdown.subtotal.toLocaleString('de-CH'),
    '{{discount_row}}': discountRow,
    '{{vat_amount}}': priceBreakdown.vat.amount.toLocaleString('de-CH'),
    '{{total}}': priceBreakdown.total.toLocaleString('de-CH'),
    '{{timeline_steps}}': timelineHtml,
    '{{deposit_amount}}': priceBreakdown.payment.deposit.toLocaleString('de-CH'),
    '{{milestone_amount}}': priceBreakdown.payment.milestone.toLocaleString('de-CH'),
    '{{completion_amount}}': priceBreakdown.payment.completion.toLocaleString('de-CH'),
    '{{terms_url}}': pricingConfig.quoteSettings.termsUrl,
    '{{ab_test_note}}': abTestNote,
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return html;
}

/**
 * Generate PDF from HTML using Puppeteer.
 */
async function generatePDF(html, quoteNumber) {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    logger.warn('Puppeteer not installed. Saving HTML version instead.');
    const htmlPath = path.join(OUTPUT_DIR, `${quoteNumber}.html`);
    fs.writeFileSync(htmlPath, html);
    return htmlPath;
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfPath = path.join(OUTPUT_DIR, `${quoteNumber}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });

    return pdfPath;
  } finally {
    await browser.close();
  }
}

// ── A/B Test Analysis ────────────────────────────────────────────────────────

/**
 * Analyze A/B test results and provide pricing recommendations.
 */
async function analyzeABTests() {
  logger.info('Analyzing A/B test results...');

  try {
    const testData = await getRecords(TABLES.AB_TESTS);

    if (testData.length < 10) {
      logger.info('Not enough A/B test data yet (need at least 10 quotes)');
      return null;
    }

    // Group by variant
    const variantStats = {};
    for (const test of testData) {
      const variant = test.Variant || 'A';
      if (!variantStats[variant]) {
        variantStats[variant] = {
          total: 0,
          accepted: 0,
          rejected: 0,
          pending: 0,
          totalRevenue: 0,
          prices: [],
        };
      }

      variantStats[variant].total++;
      variantStats[variant].prices.push(test.FinalPrice || 0);

      if (test.Outcome === 'Accepted') {
        variantStats[variant].accepted++;
        variantStats[variant].totalRevenue += test.FinalPrice || 0;
      } else if (test.Outcome === 'Rejected') {
        variantStats[variant].rejected++;
      } else {
        variantStats[variant].pending++;
      }
    }

    // Calculate conversion rates
    const analysis = {};
    for (const [variant, stats] of Object.entries(variantStats)) {
      const decided = stats.accepted + stats.rejected;
      analysis[variant] = {
        ...stats,
        conversionRate: decided > 0 ? Math.round((stats.accepted / decided) * 100) : 0,
        avgPrice: stats.prices.length > 0
          ? Math.round(stats.prices.reduce((a, b) => a + b, 0) / stats.prices.length)
          : 0,
        avgRevenue: stats.accepted > 0
          ? Math.round(stats.totalRevenue / stats.accepted)
          : 0,
      };
    }

    // Generate recommendation via Claude
    const recommendation = await generatePricingRecommendation(analysis);

    // Send report
    await sendABTestReport(analysis, recommendation);

    logger.info('A/B test analysis complete');
    return { analysis, recommendation };
  } catch (error) {
    logger.error(`A/B test analysis failed: ${error.message}`);
    return null;
  }
}

/**
 * Get Claude-powered pricing recommendations.
 */
async function generatePricingRecommendation(analysis) {
  const prompt = `You are a pricing strategist for Werkpilot, a Swiss digital agency.

Analyze these A/B test results for our pricing variants:

${JSON.stringify(analysis, null, 2)}

Variant definitions:
${JSON.stringify(pricingConfig.abTestVariants, null, 2)}

Based on the data:
1. Which variant performs best (highest revenue per quote)?
2. Is there a statistically meaningful difference?
3. Should we adjust our base pricing?
4. Any industry or regional patterns to exploit?

Return JSON: {
  "winningVariant": "A/B/C",
  "confidence": "low/medium/high",
  "recommendation": "brief recommendation in German",
  "suggestedActions": ["action 1", "action 2"],
  "estimatedRevenueImpact": "estimated monthly impact in CHF"
}`;

  try {
    return await generateJSON(prompt, {
      model: config.models.standard,
      maxTokens: 1000,
    });
  } catch (error) {
    logger.error(`Pricing recommendation generation failed: ${error.message}`);
    return null;
  }
}

/**
 * Send A/B test report to CEO.
 */
async function sendABTestReport(analysis, recommendation) {
  const variantRows = Object.entries(analysis).map(([variant, stats]) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${variant}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${stats.total}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${stats.conversionRate}%</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">CHF ${stats.avgPrice.toLocaleString()}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">CHF ${stats.totalRevenue.toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
    <h2>Pricing A/B Test Report</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">Variant</th>
        <th style="padding: 8px; text-align: left;">Quotes</th>
        <th style="padding: 8px; text-align: left;">Conv. Rate</th>
        <th style="padding: 8px; text-align: left;">Avg Price</th>
        <th style="padding: 8px; text-align: left;">Total Revenue</th>
      </tr>
      ${variantRows}
    </table>

    ${recommendation ? `
      <div style="background: #f0f8ff; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 8px 0;">AI Recommendation</h3>
        <p><strong>Winning Variant:</strong> ${recommendation.winningVariant} (Confidence: ${recommendation.confidence})</p>
        <p>${recommendation.recommendation}</p>
        <p><strong>Estimated Revenue Impact:</strong> ${recommendation.estimatedRevenueImpact}</p>
        <ul>
          ${(recommendation.suggestedActions || []).map(a => `<li>${a}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;

  try {
    await sendCEOEmail({
      subject: 'Pricing A/B Test Results',
      html,
    });
  } catch (error) {
    logger.error(`Failed to send A/B test report: ${error.message}`);
  }
}

// ── Quote Email Delivery ─────────────────────────────────────────────────────

/**
 * Send a quote to a client via email.
 */
async function sendQuoteEmail(quoteResult, client) {
  const { quoteNumber, priceBreakdown, pdfPath } = quoteResult;

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; padding: 24px 30px;">
        <span style="color: #00d4ff; font-size: 22px; font-weight: 700;">Werkpilot</span>
      </div>
      <div style="padding: 30px; line-height: 1.7; color: #333;">
        <p>Guten Tag ${client.contact || ''},</p>
        <p>Vielen Dank fuer Ihr Interesse an unseren Dienstleistungen. Anbei finden Sie unsere Offerte
           <strong>${quoteNumber}</strong> fuer das <strong>${priceBreakdown.packageName}</strong>.</p>
        <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <div style="font-size: 14px; color: #666;">Gesamtbetrag (inkl. MwSt.)</div>
          <div style="font-size: 32px; font-weight: 700; color: #1a1a2e;">
            CHF ${priceBreakdown.total.toLocaleString('de-CH')}
          </div>
        </div>
        <p>Die Offerte ist 30 Tage gueltig. Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfuegung.</p>
        <p>Freundliche Gruesse,<br>Das Werkpilot Team</p>
      </div>
      <div style="padding: 20px 30px; background: #f8f9fa; font-size: 11px; color: #999; border-top: 1px solid #eee;">
        <p>Werkpilot GmbH | <a href="https://werkpilot.ch" style="color: #00d4ff;">werkpilot.ch</a></p>
      </div>
    </div>
  `;

  const mailOptions = {
    to: client.email,
    subject: `Offerte ${quoteNumber} - ${priceBreakdown.packageName}`,
    html,
    from: `Werkpilot <${config.email.user}>`,
  };

  // Attach PDF if available
  if (pdfPath && fs.existsSync(pdfPath)) {
    mailOptions.attachments = [{
      filename: `${quoteNumber}.pdf`,
      path: pdfPath,
    }];
  }

  try {
    await sendEmail(mailOptions);
    logger.info(`Quote ${quoteNumber} sent to ${client.email}`);

    // Update Airtable
    const quotes = await getRecords(TABLES.QUOTES, `{QuoteNumber} = "${quoteNumber}"`);
    if (quotes.length > 0) {
      await updateRecord(TABLES.QUOTES, quotes[0].id, {
        Status: 'Sent',
        SentAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error(`Failed to send quote ${quoteNumber}: ${error.message}`);
    throw error;
  }
}

// ── Cron Scheduling ──────────────────────────────────────────────────────────

// Daily A/B test analysis at 18:00
cron.schedule('0 18 * * *', () => {
  analyzeABTests().catch(err => logger.error(`Cron A/B analysis error: ${err.message}`));
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  calculatePrice,
  generateQuote,
  sendQuoteEmail,
  analyzeABTests,
  generatePricingRecommendation,
  selectABVariant,
};

// Run A/B analysis if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'demo') {
    // Generate a demo quote
    const demoQuote = async () => {
      const result = await generateQuote({
        client: {
          company: 'Demo AG',
          contact: 'Max Muster',
          email: 'demo@example.com',
          address: 'Musterstrasse 1, 8000 Zuerich',
        },
        pricing: {
          packageId: 'professional',
          industry: 'gastro',
          kanton: 'ZH',
          addons: ['seo_premium', 'booking_system'],
          additionalLanguages: 1,
          urgency: 'standard',
        },
      });
      logger.info(`Demo quote generated: ${result.quoteNumber}`);
      logger.info(`Total: CHF ${result.priceBreakdown.total}`);
      if (result.pdfPath) logger.info(`PDF: ${result.pdfPath}`);
    };
    demoQuote().catch(err => logger.error(`Demo failed: ${err.message}`));
  } else {
    analyzeABTests()
      .then(() => logger.info('A/B analysis completed'))
      .catch(err => logger.error(`A/B analysis failed: ${err.message}`));
  }
}
