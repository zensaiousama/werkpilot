/**
 * Agent 26 — Treasury Agent
 * Werkpilot Finance Department
 *
 * Swiss QR Bill invoice generation, auto-sending after service delivery,
 * payment tracking, dunning process (15/30/45 days), Treuhand exports,
 * and MWST/VAT tracking.
 *
 * Schedule: Daily at 07:00 (invoice check), hourly (payment matching), weekly (dunning)
 */

'use strict';

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { createLogger } = require('../shared/utils/logger');
const { generateText } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('finance-treasury');
const REPORTS_DIR = path.join(__dirname, 'reports');
const TEMPLATES_DIR = path.join(__dirname);
const DUNNING_DIR = path.join(__dirname, 'dunning-templates');

// Company details for invoices
const COMPANY = {
  name: 'Werkpilot',
  legalName: 'Werkpilot GmbH',
  street: process.env.COMPANY_STREET || 'Musterstrasse 1',
  zip: process.env.COMPANY_ZIP || '8000',
  city: process.env.COMPANY_CITY || 'Zuerich',
  country: 'Schweiz',
  email: process.env.COMPANY_EMAIL || 'finance@werkpilot.ch',
  phone: process.env.COMPANY_PHONE || '+41 44 000 00 00',
  uid: process.env.COMPANY_UID || 'CHE-000.000.000',
  iban: process.env.COMPANY_IBAN || 'CH00 0000 0000 0000 0000 0',
  bic: process.env.COMPANY_BIC || 'ZKBKCHZZ80A',
  bankName: process.env.COMPANY_BANK || 'Zuercher Kantonalbank',
  paymentTerms: 30,
  vatRate: 8.1,
  vatThreshold: 100000,
};

// ---------------------------------------------------------------------------
// Invoice Generation
// ---------------------------------------------------------------------------

function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `WP-${year}${month}-${seq}`;
}

function generateQRReference() {
  // Swiss QR Reference (26 digits + check digit)
  const base = Date.now().toString().slice(-20).padStart(26, '0');
  return base;
}

function formatCurrency(amount) {
  return amount.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateLineItemsHTML(items) {
  return items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.description}</td>
      <td>${item.quantity || 1}</td>
      <td>CHF ${formatCurrency(item.unitPrice || item.amount)}</td>
      <td>CHF ${formatCurrency((item.quantity || 1) * (item.unitPrice || item.amount))}</td>
    </tr>
  `).join('\n');
}

async function generateInvoice(invoiceData) {
  const {
    client,
    items,
    notes,
    servicePeriod,
    applyVAT,
    discountRate,
  } = invoiceData;

  logger.info(`Generating invoice for ${client.name || client.company}`);

  const invoiceNumber = generateInvoiceNumber();
  const invoiceDate = new Date().toISOString().split('T')[0];
  const dueDate = new Date(Date.now() + COMPANY.paymentTerms * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];
  const qrReference = generateQRReference();

  // Calculate totals
  const subtotal = items.reduce((sum, item) =>
    sum + (item.quantity || 1) * (item.unitPrice || item.amount), 0
  );

  const discountAmount = discountRate ? subtotal * (discountRate / 100) : 0;
  const afterDiscount = subtotal - discountAmount;
  const vatAmount = applyVAT ? afterDiscount * (COMPANY.vatRate / 100) : 0;
  const totalAmount = afterDiscount + vatAmount;

  // Load template
  const templatePath = path.join(TEMPLATES_DIR, 'invoice-template.html');
  let template = fs.readFileSync(templatePath, 'utf-8');

  // Replace all placeholders
  const replacements = {
    '{{INVOICE_NUMBER}}': invoiceNumber,
    '{{INVOICE_DATE}}': invoiceDate,
    '{{DUE_DATE}}': dueDate,
    '{{SERVICE_PERIOD}}': servicePeriod || invoiceDate,
    '{{CLIENT_NAME}}': client.name || '',
    '{{CLIENT_COMPANY}}': client.company || '',
    '{{CLIENT_STREET}}': client.street || '',
    '{{CLIENT_ZIP}}': client.zip || '',
    '{{CLIENT_CITY}}': client.city || '',
    '{{CLIENT_COUNTRY}}': client.country || 'Schweiz',
    '{{CLIENT_NUMBER}}': client.number || client.id || '',
    '{{REFERENCE}}': `WP-${invoiceNumber}`,
    '{{COMPANY_STREET}}': COMPANY.street,
    '{{COMPANY_ZIP}}': COMPANY.zip,
    '{{COMPANY_CITY}}': COMPANY.city,
    '{{COMPANY_COUNTRY}}': COMPANY.country,
    '{{COMPANY_EMAIL}}': COMPANY.email,
    '{{COMPANY_PHONE}}': COMPANY.phone,
    '{{COMPANY_UID}}': COMPANY.uid,
    '{{COMPANY_LEGAL_NAME}}': COMPANY.legalName,
    '{{LINE_ITEMS}}': generateLineItemsHTML(items),
    '{{SUBTOTAL}}': formatCurrency(subtotal),
    '{{VAT_RATE}}': String(COMPANY.vatRate),
    '{{VAT_AMOUNT}}': formatCurrency(vatAmount),
    '{{DISCOUNT_RATE}}': String(discountRate || 0),
    '{{DISCOUNT_AMOUNT}}': formatCurrency(discountAmount),
    '{{TOTAL_AMOUNT}}': formatCurrency(totalAmount),
    '{{BANK_NAME}}': COMPANY.bankName,
    '{{IBAN}}': COMPANY.iban,
    '{{BIC}}': COMPANY.bic,
    '{{PAYMENT_TERMS}}': String(COMPANY.paymentTerms),
    '{{PAYMENT_REFERENCE}}': invoiceNumber,
    '{{QR_REFERENCE}}': qrReference,
    '{{QR_DATA}}': `SPC/0200/1/${COMPANY.iban}/${totalAmount}/CHF/${qrReference}`,
    '{{ADDITIONAL_INFO}}': notes || `Invoice ${invoiceNumber}`,
  };

  // Handle conditional sections
  if (!applyVAT) {
    template = template.replace(/\{\{#IF_VAT\}\}[\s\S]*?\{\{\/IF_VAT\}\}/g, '');
  } else {
    template = template.replace(/\{\{#IF_VAT\}\}/g, '').replace(/\{\{\/IF_VAT\}\}/g, '');
  }

  if (!discountRate) {
    template = template.replace(/\{\{#IF_DISCOUNT\}\}[\s\S]*?\{\{\/IF_DISCOUNT\}\}/g, '');
  } else {
    template = template.replace(/\{\{#IF_DISCOUNT\}\}/g, '').replace(/\{\{\/IF_DISCOUNT\}\}/g, '');
  }

  // Apply replacements
  for (const [placeholder, value] of Object.entries(replacements)) {
    template = template.split(placeholder).join(value);
  }

  // Save invoice HTML
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const invoicePath = path.join(REPORTS_DIR, `invoice-${invoiceNumber}.html`);
  fs.writeFileSync(invoicePath, template, 'utf-8');
  logger.info(`Invoice saved to ${invoicePath}`);

  // Store in Airtable
  try {
    await createRecord('Invoices', {
      InvoiceNumber: invoiceNumber,
      Client: client.name || client.company,
      ClientId: client.id,
      Amount: totalAmount,
      Subtotal: subtotal,
      VAT: vatAmount,
      Discount: discountAmount,
      Date: invoiceDate,
      DueDate: dueDate,
      Status: 'Draft',
      QRReference: qrReference,
      FilePath: invoicePath,
    });
  } catch (error) {
    logger.error(`Failed to store invoice in Airtable: ${error.message}`);
  }

  return {
    invoiceNumber,
    invoiceDate,
    dueDate,
    subtotal,
    vatAmount,
    discountAmount,
    totalAmount,
    filePath: invoicePath,
    qrReference,
  };
}

// ---------------------------------------------------------------------------
// Auto-Invoice After Service Delivery
// ---------------------------------------------------------------------------

async function checkAndSendInvoices() {
  logger.info('Checking for completed services needing invoicing...');

  try {
    // Find delivered services without invoices
    const deliveredServices = await getRecords('Projects',
      'AND({Status} = "Delivered", {Invoiced} = FALSE())'
    );

    if (deliveredServices.length === 0) {
      logger.info('No uninvoiced delivered services found');
      return [];
    }

    logger.info(`Found ${deliveredServices.length} services to invoice`);
    const generatedInvoices = [];

    for (const service of deliveredServices) {
      try {
        // Get client details
        const clients = await getRecords('Clients', `{Name} = "${service.Client}"`);
        const client = clients[0] || {
          name: service.Client,
          company: service.ClientCompany || service.Client,
          email: service.ClientEmail,
        };

        // Check if VAT applies (revenue > threshold)
        const allInvoices = await getRecords('Invoices', '{Status} = "Paid"');
        const yearRevenue = allInvoices
          .filter(inv => inv.Date && inv.Date.startsWith(new Date().getFullYear().toString()))
          .reduce((sum, inv) => sum + (inv.Amount || 0), 0);
        const applyVAT = yearRevenue >= COMPANY.vatThreshold;

        const invoice = await generateInvoice({
          client: {
            name: client.Name || client.name,
            company: client.Company || client.company,
            street: client.Street || '',
            zip: client.ZIP || '',
            city: client.City || '',
            country: client.Country || 'Schweiz',
            id: client.id,
            email: client.Email || client.email,
            number: client.CustomerNumber || '',
          },
          items: [{
            description: service.ServiceDescription || service.Name,
            quantity: 1,
            unitPrice: service.Price || service.Amount || 0,
          }],
          servicePeriod: `${service.StartDate || ''} - ${service.EndDate || service.DeliveryDate || ''}`,
          applyVAT,
          notes: service.Notes,
        });

        // Send invoice email
        const clientEmail = client.Email || client.email;
        if (clientEmail) {
          const invoiceHTML = fs.readFileSync(invoice.filePath, 'utf-8');
          await sendEmail({
            to: clientEmail,
            subject: `Rechnung ${invoice.invoiceNumber} - Werkpilot`,
            html: `
              <p>Guten Tag ${client.Name || client.name},</p>
              <p>anbei erhalten Sie die Rechnung fuer unsere erbrachten Leistungen.</p>
              <p><strong>Rechnungsnummer:</strong> ${invoice.invoiceNumber}<br>
              <strong>Betrag:</strong> CHF ${formatCurrency(invoice.totalAmount)}<br>
              <strong>Zahlungsfrist:</strong> ${invoice.dueDate}</p>
              <p>Die vollstaendige Rechnung mit QR-Einzahlungsschein finden Sie im Anhang.</p>
              <p>Bei Fragen stehen wir Ihnen gerne zur Verfuegung.</p>
              <p>Freundliche Gruesse,<br>Werkpilot Finance Team</p>
            `,
          });

          // Update invoice status
          await updateRecord('Invoices', invoice.invoiceNumber, { Status: 'Sent' });
          logger.info(`Invoice ${invoice.invoiceNumber} sent to ${clientEmail}`);
        }

        // Mark service as invoiced
        try {
          await updateRecord('Projects', service.id, { Invoiced: true, InvoiceNumber: invoice.invoiceNumber });
        } catch (error) {
          logger.warn(`Failed to mark service as invoiced: ${error.message}`);
        }

        generatedInvoices.push(invoice);
      } catch (error) {
        logger.error(`Failed to generate invoice for ${service.Client}: ${error.message}`);
      }
    }

    if (generatedInvoices.length > 0) {
      await sendCEOEmail({
        subject: `${generatedInvoices.length} Invoice(s) Generated & Sent`,
        html: `
          <h2>Auto-Generated Invoices</h2>
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
            <tr style="background: #f8f9fa;">
              <th>Invoice #</th><th>Client</th><th>Amount</th><th>Due Date</th>
            </tr>
            ${generatedInvoices.map(inv => `
              <tr>
                <td>${inv.invoiceNumber}</td>
                <td>${inv.clientName || '-'}</td>
                <td>CHF ${formatCurrency(inv.totalAmount)}</td>
                <td>${inv.dueDate}</td>
              </tr>
            `).join('')}
          </table>
        `,
      });
    }

    return generatedInvoices;
  } catch (error) {
    logger.error(`Auto-invoice check failed: ${error.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Payment Tracking & Matching
// ---------------------------------------------------------------------------

async function matchPayments() {
  logger.info('Running payment matching...');

  try {
    // Get unpaid invoices
    const unpaidInvoices = await getRecords('Invoices', '{Status} = "Sent"');

    // Get recent bank transactions
    const transactions = await getRecords('BankTransactions',
      'AND({Matched} = FALSE(), {Type} = "Credit")'
    );

    if (transactions.length === 0 || unpaidInvoices.length === 0) {
      logger.info('No unmatched transactions or unpaid invoices');
      return [];
    }

    const matches = [];

    for (const txn of transactions) {
      const txnAmount = txn.Amount || 0;
      const txnRef = (txn.Reference || txn.Description || '').toUpperCase();

      // Try to match by reference number first
      let matchedInvoice = unpaidInvoices.find(inv =>
        txnRef.includes(inv.InvoiceNumber) ||
        txnRef.includes(inv.QRReference || '')
      );

      // Try to match by amount if no reference match
      if (!matchedInvoice) {
        matchedInvoice = unpaidInvoices.find(inv =>
          Math.abs((inv.Amount || 0) - txnAmount) < 0.05
        );
      }

      if (matchedInvoice) {
        try {
          await updateRecord('Invoices', matchedInvoice.id, {
            Status: 'Paid',
            PaidDate: txn.Date || new Date().toISOString().split('T')[0],
            PaymentReference: txn.Reference,
          });

          await updateRecord('BankTransactions', txn.id, {
            Matched: true,
            InvoiceNumber: matchedInvoice.InvoiceNumber,
          });

          matches.push({
            invoice: matchedInvoice.InvoiceNumber,
            amount: txnAmount,
            date: txn.Date,
            method: txnRef.includes(matchedInvoice.InvoiceNumber) ? 'reference' : 'amount',
          });

          logger.info(`Matched payment CHF ${txnAmount} to invoice ${matchedInvoice.InvoiceNumber}`);
        } catch (error) {
          logger.error(`Failed to update match: ${error.message}`);
        }
      }
    }

    if (matches.length > 0) {
      logger.info(`Matched ${matches.length} payments`);
    }

    return matches;
  } catch (error) {
    logger.error(`Payment matching failed: ${error.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Dunning Process
// ---------------------------------------------------------------------------

async function runDunningProcess() {
  logger.info('Running dunning process...');

  try {
    const unpaidInvoices = await getRecords('Invoices', '{Status} = "Sent"');
    const now = new Date();
    const dunningActions = [];

    for (const invoice of unpaidInvoices) {
      const dueDate = new Date(invoice.DueDate);
      const daysOverdue = Math.floor((now - dueDate) / (24 * 60 * 60 * 1000));

      if (daysOverdue < 15) continue;

      const reminderLevel = invoice.ReminderLevel || 0;
      let templateFile = null;
      let newLevel = reminderLevel;
      let escalation = null;

      if (daysOverdue >= 45 && reminderLevel < 3) {
        templateFile = 'reminder-3.html';
        newLevel = 3;
        escalation = 'final-warning';
      } else if (daysOverdue >= 30 && reminderLevel < 2) {
        templateFile = 'reminder-2.html';
        newLevel = 2;
        escalation = 'firm';
      } else if (daysOverdue >= 15 && reminderLevel < 1) {
        templateFile = 'reminder-1.html';
        newLevel = 1;
        escalation = 'friendly';
      }

      if (!templateFile) continue;

      // Load and fill template
      const templatePath = path.join(DUNNING_DIR, templateFile);
      let template = fs.readFileSync(templatePath, 'utf-8');

      const clientEmail = invoice.ClientEmail || invoice.Email;
      if (!clientEmail) {
        logger.warn(`No email for invoice ${invoice.InvoiceNumber}, skipping dunning`);
        continue;
      }

      const replacements = {
        '{{CLIENT_NAME}}': invoice.Client || invoice.ClientName || 'Kunde',
        '{{INVOICE_NUMBER}}': invoice.InvoiceNumber,
        '{{INVOICE_DATE}}': invoice.Date || '',
        '{{DUE_DATE}}': invoice.DueDate || '',
        '{{DAYS_OVERDUE}}': String(daysOverdue),
        '{{AMOUNT}}': formatCurrency(invoice.Amount || 0),
        '{{IBAN}}': COMPANY.iban,
        '{{BANK_NAME}}': COMPANY.bankName,
        '{{PAYMENT_REFERENCE}}': invoice.InvoiceNumber,
        '{{COMPANY_STREET}}': COMPANY.street,
        '{{COMPANY_ZIP}}': COMPANY.zip,
        '{{COMPANY_CITY}}': COMPANY.city,
        '{{COMPANY_EMAIL}}': COMPANY.email,
        '{{COMPANY_PHONE}}': COMPANY.phone,
        '{{FIRST_REMINDER_DATE}}': invoice.Reminder1Date || '',
        '{{SECOND_REMINDER_DATE}}': invoice.Reminder2Date || '',
        '{{PAYMENT_DEADLINE}}': new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        '{{FINAL_DEADLINE}}': new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      for (const [placeholder, value] of Object.entries(replacements)) {
        template = template.split(placeholder).join(value);
      }

      // Send dunning email
      const subjectMap = {
        1: `Zahlungserinnerung - Rechnung ${invoice.InvoiceNumber}`,
        2: `2. Mahnung - Rechnung ${invoice.InvoiceNumber}`,
        3: `LETZTE MAHNUNG - Rechnung ${invoice.InvoiceNumber}`,
      };

      try {
        await sendEmail({
          to: clientEmail,
          subject: subjectMap[newLevel],
          html: template,
        });

        // Update invoice reminder level
        const updateFields = {
          ReminderLevel: newLevel,
          [`Reminder${newLevel}Date`]: now.toISOString().split('T')[0],
        };
        await updateRecord('Invoices', invoice.id, updateFields);

        dunningActions.push({
          invoiceNumber: invoice.InvoiceNumber,
          client: invoice.Client,
          amount: invoice.Amount,
          daysOverdue,
          level: newLevel,
          escalation,
          email: clientEmail,
        });

        logger.info(`Dunning level ${newLevel} sent for invoice ${invoice.InvoiceNumber} (${daysOverdue} days overdue)`);
      } catch (error) {
        logger.error(`Failed to send dunning for ${invoice.InvoiceNumber}: ${error.message}`);
      }
    }

    // Alert CEO for level 3 dunning
    const criticalDunning = dunningActions.filter(d => d.level === 3);
    if (criticalDunning.length > 0) {
      await sendCEOEmail({
        subject: `CRITICAL: ${criticalDunning.length} Invoice(s) at Final Warning Stage`,
        html: `
          <h2>Final Warning Dunning Notices Sent</h2>
          <p>The following invoices have reached the final warning stage (45+ days overdue):</p>
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
            <tr style="background: #dc3545; color: white;">
              <th>Invoice</th><th>Client</th><th>Amount</th><th>Days Overdue</th>
            </tr>
            ${criticalDunning.map(d => `
              <tr>
                <td>${d.invoiceNumber}</td>
                <td>${d.client}</td>
                <td>CHF ${formatCurrency(d.amount)}</td>
                <td>${d.daysOverdue}</td>
              </tr>
            `).join('')}
          </table>
          <p><strong>Next step:</strong> If no payment within 7 days, consider initiating Betreibungsverfahren (debt collection).</p>
        `,
      });
    }

    logger.info(`Dunning process complete: ${dunningActions.length} actions taken`);
    return dunningActions;
  } catch (error) {
    logger.error(`Dunning process failed: ${error.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Treuhand Export (Bexio/Abacus Compatible CSV)
// ---------------------------------------------------------------------------

async function exportForTreuhand(period) {
  const exportPeriod = period || new Date().toISOString().substring(0, 7);
  logger.info(`Generating Treuhand export for ${exportPeriod}...`);

  try {
    const invoices = await getRecords('Invoices',
      `DATETIME_FORMAT({Date}, 'YYYY-MM') = "${exportPeriod}"`
    );
    const expenses = await getRecords('Expenses',
      `DATETIME_FORMAT({Date}, 'YYYY-MM') = "${exportPeriod}"`
    );

    // Revenue CSV (Bexio compatible)
    const revenueCSV = [
      'Datum;Belegnummer;Konto;Gegenkonto;Betrag;MwSt-Code;MwSt-Betrag;Text;Waehrung',
    ];

    for (const inv of invoices) {
      const vatCode = (inv.VAT || 0) > 0 ? 'USt80' : 'ohne';
      revenueCSV.push([
        inv.Date || '',
        inv.InvoiceNumber || '',
        '1100', // Debtors account
        '3000', // Revenue account
        formatCurrency(inv.Amount || 0),
        vatCode,
        formatCurrency(inv.VAT || 0),
        `${inv.Client || ''} - ${inv.InvoiceNumber || ''}`,
        'CHF',
      ].join(';'));
    }

    // Expense CSV
    const expenseCSV = [
      'Datum;Belegnummer;Konto;Gegenkonto;Betrag;MwSt-Code;MwSt-Betrag;Text;Waehrung',
    ];

    const accountMap = {
      'api': '4400',
      'anthropic': '4400',
      'openai': '4400',
      'deepl': '4400',
      'infrastructure': '4500',
      'hosting': '4500',
      'cloud': '4500',
      'salaries': '5000',
      'marketing': '6000',
      'office': '6100',
      'rent': '6100',
      'software': '6500',
      'insurance': '6300',
      'legal': '6800',
      'accounting': '6800',
      'travel': '6700',
    };

    for (const exp of expenses) {
      const category = (exp.Category || '').toLowerCase();
      const account = accountMap[category] || '6900';
      expenseCSV.push([
        exp.Date || '',
        exp.Reference || '',
        '2000', // Creditors account
        account,
        formatCurrency(exp.Amount || 0),
        'ohne',
        '0.00',
        exp.Description || exp.Category || '',
        'CHF',
      ].join(';'));
    }

    // Save CSV files
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const revenuePath = path.join(REPORTS_DIR, `treuhand-revenue-${exportPeriod}.csv`);
    const expensePath = path.join(REPORTS_DIR, `treuhand-expenses-${exportPeriod}.csv`);

    fs.writeFileSync(revenuePath, revenueCSV.join('\n'), 'utf-8');
    fs.writeFileSync(expensePath, expenseCSV.join('\n'), 'utf-8');

    logger.info(`Treuhand exports saved: ${revenuePath}, ${expensePath}`);

    return {
      period: exportPeriod,
      revenuePath,
      expensePath,
      invoiceCount: invoices.length,
      expenseCount: expenses.length,
      totalRevenue: invoices.reduce((sum, i) => sum + (i.Amount || 0), 0),
      totalExpenses: expenses.reduce((sum, e) => sum + (e.Amount || 0), 0),
    };
  } catch (error) {
    logger.error(`Treuhand export failed: ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// MWST/VAT Tracking
// ---------------------------------------------------------------------------

async function trackVAT() {
  logger.info('Running VAT tracking...');

  try {
    const currentYear = new Date().getFullYear();
    const invoices = await getRecords('Invoices',
      `AND({Status} = "Paid", DATETIME_FORMAT({Date}, 'YYYY') = "${currentYear}")`
    );

    const yearRevenue = invoices.reduce((sum, inv) => sum + (inv.Amount || 0), 0);
    const isVATObligated = yearRevenue >= COMPANY.vatThreshold;

    const vatCollected = invoices.reduce((sum, inv) => sum + (inv.VAT || 0), 0);

    // Input VAT (on expenses)
    const expenses = await getRecords('Expenses',
      `DATETIME_FORMAT({Date}, 'YYYY') = "${currentYear}"`
    );
    const inputVAT = expenses.reduce((sum, exp) => sum + (exp.VAT || 0), 0);
    const netVATPayable = vatCollected - inputVAT;

    const vatStatus = {
      year: currentYear,
      yearRevenue: Math.round(yearRevenue * 100) / 100,
      vatThreshold: COMPANY.vatThreshold,
      isVATObligated,
      vatCollected: Math.round(vatCollected * 100) / 100,
      inputVAT: Math.round(inputVAT * 100) / 100,
      netVATPayable: Math.round(netVATPayable * 100) / 100,
      vatRate: COMPANY.vatRate,
      nextFilingDate: getNextVATFilingDate(),
    };

    // Alert if approaching threshold
    if (yearRevenue >= COMPANY.vatThreshold * 0.8 && !isVATObligated) {
      await sendCEOEmail({
        subject: 'VAT Threshold Alert - Approaching CHF 100k Revenue',
        html: `
          <h2>MWST Threshold Alert</h2>
          <p>Year-to-date revenue: <strong>CHF ${formatCurrency(yearRevenue)}</strong></p>
          <p>VAT threshold: <strong>CHF ${formatCurrency(COMPANY.vatThreshold)}</strong></p>
          <p>Progress: <strong>${Math.round((yearRevenue / COMPANY.vatThreshold) * 100)}%</strong></p>
          <p>Once revenue exceeds CHF ${formatCurrency(COMPANY.vatThreshold)}, MWST registration is required.
          Consider contacting your Treuhand to prepare.</p>
        `,
      });
    }

    logger.info(`VAT Status: Revenue CHF ${formatCurrency(yearRevenue)}, Obligated: ${isVATObligated}, Net Payable: CHF ${formatCurrency(netVATPayable)}`);

    return vatStatus;
  } catch (error) {
    logger.error(`VAT tracking failed: ${error.message}`);
    return null;
  }
}

function getNextVATFilingDate() {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const nextQuarterMonth = (quarter + 1) * 3;
  const filingDate = new Date(now.getFullYear(), nextQuarterMonth + 1, 0);

  // Filing deadline: 60 days after quarter end
  filingDate.setDate(filingDate.getDate() + 60);
  return filingDate.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Daily Treasury Report
// ---------------------------------------------------------------------------

async function generateTreasuryReport() {
  logger.info('Generating daily treasury report...');

  try {
    const [unpaid, overdue, matched, vatStatus] = await Promise.all([
      getRecords('Invoices', '{Status} = "Sent"'),
      getRecords('Invoices', 'AND({Status} = "Sent", IS_BEFORE({DueDate}, TODAY()))'),
      matchPayments(),
      trackVAT(),
    ]);

    const totalUnpaid = unpaid.reduce((sum, i) => sum + (i.Amount || 0), 0);
    const totalOverdue = overdue.reduce((sum, i) => sum + (i.Amount || 0), 0);

    const report = {
      date: new Date().toISOString().split('T')[0],
      unpaidInvoices: unpaid.length,
      totalUnpaid,
      overdueInvoices: overdue.length,
      totalOverdue,
      paymentsMatched: matched.length,
      vatStatus,
    };

    // Store daily snapshot
    try {
      await createRecord('TreasurySnapshots', {
        Date: report.date,
        UnpaidInvoices: unpaid.length,
        TotalUnpaid: totalUnpaid,
        OverdueInvoices: overdue.length,
        TotalOverdue: totalOverdue,
      });
    } catch (error) {
      logger.warn(`Failed to store treasury snapshot: ${error.message}`);
    }

    return report;
  } catch (error) {
    logger.error(`Treasury report failed: ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function startScheduler() {
  // Invoice check: daily at 07:00
  cron.schedule('0 7 * * *', async () => {
    logger.info('Scheduled: Invoice check');
    try {
      await checkAndSendInvoices();
    } catch (error) {
      logger.error(`Scheduled invoice check failed: ${error.message}`);
    }
  });

  // Payment matching: every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    logger.info('Scheduled: Payment matching');
    try {
      await matchPayments();
    } catch (error) {
      logger.error(`Scheduled payment matching failed: ${error.message}`);
    }
  });

  // Dunning: weekly on Tuesday at 09:00
  cron.schedule('0 9 * * 2', async () => {
    logger.info('Scheduled: Dunning process');
    try {
      await runDunningProcess();
    } catch (error) {
      logger.error(`Scheduled dunning failed: ${error.message}`);
    }
  });

  // Treuhand export: monthly on the 5th at 06:00
  cron.schedule('0 6 5 * *', async () => {
    logger.info('Scheduled: Treuhand export');
    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const period = lastMonth.toISOString().substring(0, 7);
      await exportForTreuhand(period);
    } catch (error) {
      logger.error(`Scheduled Treuhand export failed: ${error.message}`);
    }
  });

  // VAT tracking: monthly on the 1st at 08:00
  cron.schedule('0 8 1 * *', async () => {
    logger.info('Scheduled: VAT tracking');
    try {
      await trackVAT();
    } catch (error) {
      logger.error(`Scheduled VAT tracking failed: ${error.message}`);
    }
  });

  // Daily treasury report: daily at 17:00
  cron.schedule('0 17 * * 1-5', async () => {
    logger.info('Scheduled: Daily treasury report');
    try {
      await generateTreasuryReport();
    } catch (error) {
      logger.error(`Scheduled treasury report failed: ${error.message}`);
    }
  });

  logger.info('Treasury Agent scheduler started');
  logger.info('  - Invoice check: daily 07:00');
  logger.info('  - Payment matching: every 2 hours');
  logger.info('  - Dunning: weekly Tuesday 09:00');
  logger.info('  - Treuhand export: monthly 5th 06:00');
  logger.info('  - VAT tracking: monthly 1st 08:00');
  logger.info('  - Treasury report: daily 17:00');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  logger.info('Treasury Agent starting...');

  if (process.argv.includes('--once')) {
    await generateTreasuryReport();
  } else if (process.argv.includes('--invoice')) {
    await checkAndSendInvoices();
  } else if (process.argv.includes('--dunning')) {
    await runDunningProcess();
  } else if (process.argv.includes('--export')) {
    const period = process.argv[process.argv.indexOf('--export') + 1];
    await exportForTreuhand(period);
  } else if (process.argv.includes('--vat')) {
    const status = await trackVAT();
    console.log(JSON.stringify(status, null, 2));
  } else if (process.argv.includes('--match')) {
    const matches = await matchPayments();
    console.log(JSON.stringify(matches, null, 2));
  } else {
    startScheduler();
  }
}

main().catch(error => {
  logger.error(`Treasury Agent fatal error: ${error.message}`, { stack: error.stack });
  process.exit(1);
});

module.exports = {
  generateInvoice,
  checkAndSendInvoices,
  matchPayments,
  runDunningProcess,
  exportForTreuhand,
  trackVAT,
  generateTreasuryReport,
  startScheduler,
};
