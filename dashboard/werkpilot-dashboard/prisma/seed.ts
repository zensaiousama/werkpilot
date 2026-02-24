import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

const branchen = ['Treuhand', 'Beratung', 'IT-Services', 'Handwerk', 'Immobilien', 'Gesundheit', 'Rechtsberatung', 'Marketing', 'Gastronomie', 'Handel'];
const kantons = ['Zürich', 'Bern', 'Luzern', 'Basel-Stadt', 'Aargau', 'St. Gallen', 'Genf', 'Waadt', 'Tessin', 'Zug'];
const orte: Record<string, string[]> = {
  'Zürich': ['Zürich', 'Winterthur', 'Uster', 'Dübendorf'],
  'Bern': ['Bern', 'Thun', 'Biel', 'Burgdorf'],
  'Luzern': ['Luzern', 'Emmen', 'Kriens', 'Horw'],
  'Basel-Stadt': ['Basel'],
  'Aargau': ['Aarau', 'Baden', 'Wettingen', 'Brugg'],
  'St. Gallen': ['St. Gallen', 'Rapperswil', 'Wil', 'Gossau'],
  'Genf': ['Genève', 'Carouge', 'Lancy'],
  'Waadt': ['Lausanne', 'Montreux', 'Nyon', 'Vevey'],
  'Tessin': ['Lugano', 'Bellinzona', 'Locarno'],
  'Zug': ['Zug', 'Baar', 'Cham'],
};
const statuses = ['New Lead', 'Researched', 'Fitness Check', 'Contacted', 'Interested', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Client', 'Lost'];
const nachnamen = ['Müller', 'Meier', 'Schmid', 'Keller', 'Weber', 'Huber', 'Schneider', 'Fischer', 'Steiner', 'Brunner', 'Baumann', 'Gerber', 'Wyss', 'Graf', 'Frei', 'Moser', 'Zimmermann', 'Hofmann', 'Lehmann', 'Bühler'];
const vornamen = ['Hans', 'Peter', 'Thomas', 'Martin', 'Daniel', 'Andreas', 'Markus', 'Stefan', 'Christian', 'Michael', 'Sandra', 'Monika', 'Barbara', 'Claudia', 'Andrea', 'Sabine', 'Nicole', 'Karin', 'Ursula', 'Silvia'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(days: number): Date { return new Date(Date.now() - days * 86400000 + rand(0, 86400000)); }
function daysFromNow(days: number): Date { return new Date(Date.now() + days * 86400000 + rand(0, 86400000)); }

const agentDefs = [
  { name: 'Morning Briefing', dept: 'CEO' },
  { name: 'Decision Support', dept: 'CEO' },
  { name: 'Productivity', dept: 'CEO' },
  { name: 'Key Account', dept: 'Sales' },
  { name: 'New Business', dept: 'Sales' },
  { name: 'Partnerships', dept: 'Sales' },
  { name: 'Pricing Engine', dept: 'Sales' },
  { name: 'Inside Sales Bot', dept: 'Sales' },
  { name: 'Performance Marketing', dept: 'Marketing' },
  { name: 'Brand Marketing', dept: 'Marketing' },
  { name: 'PR / Media', dept: 'Marketing' },
  { name: 'Content Engine', dept: 'Marketing' },
  { name: 'Email Marketing', dept: 'Marketing' },
  { name: 'Product Strategy', dept: 'Product' },
  { name: 'Innovation', dept: 'Product' },
  { name: 'Customer Experience', dept: 'Product' },
  { name: 'Pricing Strategy', dept: 'Product' },
  { name: 'Quality Management', dept: 'Product' },
  { name: 'Translation Engine', dept: 'Operations' },
  { name: 'Process Automation', dept: 'Operations' },
  { name: 'Capacity Planning', dept: 'Operations' },
  { name: 'Service Quality', dept: 'Operations' },
  { name: 'Infrastructure', dept: 'Operations' },
  { name: 'Controlling', dept: 'Finance' },
  { name: 'FP&A', dept: 'Finance' },
  { name: 'Treasury', dept: 'Finance' },
  { name: 'Fundraising', dept: 'Finance' },
  { name: 'M&A Scout', dept: 'Finance' },
  { name: 'Market Expansion', dept: 'Strategy' },
  { name: 'M&A Analysis', dept: 'Strategy' },
  { name: 'Market Analysis', dept: 'Strategy' },
  { name: 'Competitor Intel', dept: 'Strategy' },
  { name: 'BizDev', dept: 'Strategy' },
  { name: 'Recruiting', dept: 'HR' },
  { name: 'Training', dept: 'HR' },
  { name: 'Employer Branding', dept: 'HR' },
  { name: 'Performance Mgmt', dept: 'HR' },
  { name: 'Compensation', dept: 'HR' },
  { name: 'Systems', dept: 'IT' },
  { name: 'Automation', dept: 'IT' },
  { name: 'Data Analytics', dept: 'IT' },
  { name: 'AI Optimization', dept: 'IT' },
  { name: 'Orchestrator', dept: 'System' },
];

async function main() {
  console.log('Seeding database...');

  // Clean existing data (order matters for FK constraints)
  await prisma.emailLog.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.followUpSequence.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.agentLog.deleteMany();
  await prisma.agentExecution.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.nightShiftTask.deleteMany();
  await prisma.decision.deleteMany();

  // ============================
  // LEADS (100)
  // ============================
  const leadIds: string[] = [];
  const leadNames: { id: string; firma: string; kontakt: string; email: string }[] = [];

  for (let i = 0; i < 100; i++) {
    const kanton = pick(kantons);
    const ort = pick(orte[kanton] || [kanton]);
    const nachname = pick(nachnamen);
    const vorname = pick(vornamen);
    const branche = pick(branchen);
    const firma = `${branche === 'Treuhand' ? 'Treuhand' : branche === 'Rechtsberatung' ? 'Kanzlei' : branche === 'Gesundheit' ? 'Praxis' : ''} ${nachname}${Math.random() > 0.5 ? ' AG' : ' GmbH'}`.trim();
    const email = `${vorname.toLowerCase()}.${nachname.toLowerCase()}@${firma.toLowerCase().replace(/[^a-z]/g, '')}.ch`;
    const status = pick(statuses);

    const lead = await prisma.lead.create({
      data: {
        firma,
        kontakt: `${vorname} ${nachname}`,
        email,
        telefon: `+41 ${rand(20, 79)} ${rand(100, 999)} ${rand(10, 99)} ${rand(10, 99)}`,
        website: `https://www.${firma.toLowerCase().replace(/[^a-z]/g, '')}.ch`,
        adresse: `${['Bahnhofstrasse', 'Hauptstrasse', 'Dorfstrasse', 'Seestrasse', 'Kirchgasse'][i % 5]} ${rand(1, 120)}, ${rand(1000, 9999)} ${ort}`,
        branche,
        kanton,
        ort,
        status,
        leadScore: rand(10, 95),
        fitnessScore: rand(20, 90),
        umsatzpotenzial: pick([1500, 2000, 2000, 2000, 3500, 5000]),
        googleRating: Math.round((3 + Math.random() * 2) * 10) / 10,
        googleReviews: rand(2, 200),
        quelle: pick(['Google Maps Scraper', 'Website', 'Referral', 'LinkedIn', 'Manual']),
        letzterKontakt: Math.random() > 0.4 ? daysAgo(rand(1, 30)) : null,
        activities: {
          create: [
            { type: 'note', details: 'Lead erstellt via Import', createdAt: daysAgo(rand(30, 90)) },
            ...(Math.random() > 0.5 ? [{ type: 'email_sent', details: 'Fitness-Check Einladung gesendet', createdAt: daysAgo(rand(10, 40)) }] : []),
            ...(Math.random() > 0.7 ? [{ type: 'status_change', details: `Status: New Lead → ${status}`, createdAt: daysAgo(rand(1, 20)) }] : []),
            ...(Math.random() > 0.8 ? [{ type: 'call', details: 'Telefonat geführt, Interesse bekundet', createdAt: daysAgo(rand(1, 15)) }] : []),
          ],
        },
      },
    });
    leadIds.push(lead.id);
    leadNames.push({ id: lead.id, firma, kontakt: `${vorname} ${nachname}`, email });
  }
  console.log('  100 leads created');

  // ============================
  // AGENTS (43)
  // ============================
  for (const def of agentDefs) {
    const isError = Math.random() < 0.05;
    const isRunning = !isError && Math.random() < 0.7;
    await prisma.agent.create({
      data: {
        name: def.name,
        dept: def.dept,
        status: isError ? 'error' : isRunning ? 'running' : 'idle',
        score: rand(60, 98),
        tasksToday: rand(0, 50),
        errorsToday: isError ? rand(1, 5) : 0,
        lastRun: new Date(Date.now() - rand(0, 3600000)),
        logs: {
          create: [
            { level: 'info', message: `${def.name} agent started`, createdAt: daysAgo(0) },
            { level: 'info', message: `Completed ${rand(1, 20)} tasks`, createdAt: daysAgo(0) },
            ...(isError ? [{ level: 'error', message: 'Connection timeout to Airtable API' }] : []),
          ],
        },
      },
    });
  }
  console.log('  43 agents created');

  // ============================
  // NIGHT SHIFT TASKS (10)
  // ============================
  const nightTasks = [
    'Review all agent logs from today',
    'Fix email marketing template rendering issue',
    'Run quality benchmarks on all agents',
    'Optimize content-engine prompts for better SEO',
    'Write unit tests for pricing-engine',
    'Update API documentation',
    'Commit all changes with descriptive messages',
    'Generate morning report summary',
    'Clean up unused log files',
    'Update competitor pricing data',
  ];
  for (const task of nightTasks) {
    const done = Math.random() > 0.3;
    await prisma.nightShiftTask.create({
      data: {
        task,
        priority: rand(1, 5),
        status: done ? 'done' : 'pending',
        startedAt: done ? new Date(Date.now() - rand(3600000, 28800000)) : null,
        completedAt: done ? new Date(Date.now() - rand(0, 3600000)) : null,
        output: done ? `Completed successfully. ${rand(1, 10)} changes made.` : null,
      },
    });
  }
  console.log('  10 night shift tasks created');

  // ============================
  // DECISIONS (3)
  // ============================
  const decisions = [
    { title: 'Preiserhöhung Package A', context: 'Package A liegt unter dem Marktdurchschnitt. Empfehlung: +10% auf CHF 1.650/Mo.', options: '["CHF 1.650", "CHF 1.750", "Beibehalten"]', recommendation: 'CHF 1.650' },
    { title: 'Neuer Sales-Agent einstellen?', context: 'Pipeline wächst schneller als Kapazität. 15 Leads warten auf Follow-up.', options: '["Freelancer", "Teilzeit", "Abwarten"]', recommendation: 'Freelancer' },
    { title: 'Google Ads Budget verdoppeln?', context: 'ROAS liegt bei 4.2x. Mehr Budget könnte mehr Leads generieren.', options: '["Verdoppeln", "+50%", "Beibehalten"]', recommendation: 'Verdoppeln' },
  ];
  for (const d of decisions) {
    await prisma.decision.create({ data: d });
  }
  console.log('  3 decisions created');

  // ============================
  // EMAIL TEMPLATES (6)
  // ============================
  const templates = [
    {
      name: 'Fitness-Check Einladung',
      subject: 'Kostenloser Fitness-Check für Ihr Unternehmen',
      body: `Guten Tag [KONTAKT],\n\nWir bieten Ihnen einen kostenlosen Fitness-Check für [FIRMA] an.\n\nIn nur 5 Minuten erfahren Sie:\n- Wie digital fit Ihr Unternehmen ist\n- Wo ungenutztes Potenzial liegt\n- Welche Quick-Wins sofort möglich sind\n\nJetzt starten: [LINK]\n\nFreundliche Grüsse\nWerkPilot Team`,
      category: 'acquisition',
      variables: '["KONTAKT", "FIRMA", "LINK"]',
    },
    {
      name: 'Follow-Up nach Fitness-Check',
      subject: 'Ihre Fitness-Check Ergebnisse — nächste Schritte',
      body: `Guten Tag [KONTAKT],\n\nVielen Dank, dass Sie den Fitness-Check für [FIRMA] durchgeführt haben.\n\nIhr Ergebnis: [SCORE]/100 Punkte\n\nGerne bespreche ich die Ergebnisse in einem kurzen Call.\nTermin buchen: [CALENDLY]\n\nFreundliche Grüsse\nWerkPilot Team`,
      category: 'follow-up',
      variables: '["KONTAKT", "FIRMA", "SCORE", "CALENDLY"]',
    },
    {
      name: 'Angebot versenden',
      subject: 'Ihr massgeschneidertes Angebot von WerkPilot',
      body: `Guten Tag [KONTAKT],\n\nBezugnehmend auf unser Gespräch sende ich Ihnen gerne unser Angebot.\n\nPaket: [PAKET]\nMonatlich: CHF [PREIS]\nLaufzeit: 12 Monate\n\nDetails im Anhang.\n\nFreundliche Grüsse\nWerkPilot Team`,
      category: 'sales',
      variables: '["KONTAKT", "PAKET", "PREIS"]',
    },
    {
      name: 'Onboarding Willkommen',
      subject: 'Willkommen bei WerkPilot — Ihre nächsten Schritte',
      body: `Guten Tag [KONTAKT],\n\nHerzlich willkommen bei WerkPilot!\n\nIhr Onboarding-Plan:\n1. Kickoff-Meeting (diese Woche)\n2. System-Setup & Integration\n3. Team-Schulung\n4. Go-Live\n\nIhr persönlicher Ansprechpartner: [BETREUER]\n\nFreundliche Grüsse\nWerkPilot Team`,
      category: 'onboarding',
      variables: '["KONTAKT", "BETREUER"]',
    },
    {
      name: 'Monatlicher Newsletter',
      subject: 'WerkPilot Newsletter — [MONAT] [JAHR]',
      body: `Guten Tag [KONTAKT],\n\nDie wichtigsten Updates diesen Monat:\n\n📊 Neue Features\n- [FEATURE_1]\n- [FEATURE_2]\n\n📈 Erfolgsgeschichte\n[CASE_STUDY]\n\n💡 Tipp des Monats\n[TIPP]\n\nFreundliche Grüsse\nWerkPilot Team`,
      category: 'newsletter',
      variables: '["KONTAKT", "MONAT", "JAHR", "FEATURE_1", "FEATURE_2", "CASE_STUDY", "TIPP"]',
    },
    {
      name: 'Rechnung versenden',
      subject: 'Rechnung [NUMMER] — [FIRMA]',
      body: `Guten Tag [KONTAKT],\n\nAnbei erhalten Sie die Rechnung [NUMMER] über CHF [BETRAG].\n\nZahlungsfrist: 30 Tage\nBankverbindung: [IBAN]\n\nBei Fragen stehe ich gerne zur Verfügung.\n\nFreundliche Grüsse\nWerkPilot Team`,
      category: 'billing',
      variables: '["KONTAKT", "FIRMA", "NUMMER", "BETRAG", "IBAN"]',
    },
  ];

  const templateIds: string[] = [];
  for (const t of templates) {
    const template = await prisma.emailTemplate.create({ data: t });
    templateIds.push(template.id);
  }
  console.log('  6 email templates created');

  // ============================
  // CAMPAIGNS (5)
  // ============================
  const campaignDefs = [
    { name: 'Q1 2026 — Fitness-Check Kampagne', templateIdx: 0, status: 'sent', sentCount: 85, openCount: 42, clickCount: 18, bounceCount: 3 },
    { name: 'Follow-Up Welle Februar', templateIdx: 1, status: 'sent', sentCount: 34, openCount: 22, clickCount: 11, bounceCount: 1 },
    { name: 'Frühlings-Newsletter', templateIdx: 4, status: 'sent', sentCount: 120, openCount: 68, clickCount: 25, bounceCount: 5 },
    { name: 'Angebots-Kampagne März', templateIdx: 2, status: 'draft', sentCount: 0, openCount: 0, clickCount: 0, bounceCount: 0 },
    { name: 'Onboarding Q1 Neukunden', templateIdx: 3, status: 'sent', sentCount: 12, openCount: 11, clickCount: 8, bounceCount: 0 },
  ];

  const campaignIds: string[] = [];
  for (const c of campaignDefs) {
    const campaign = await prisma.campaign.create({
      data: {
        name: c.name,
        templateId: templateIds[c.templateIdx],
        status: c.status,
        sentCount: c.sentCount,
        openCount: c.openCount,
        clickCount: c.clickCount,
        bounceCount: c.bounceCount,
        sentAt: c.status === 'sent' ? daysAgo(rand(1, 30)) : null,
        createdAt: daysAgo(rand(10, 45)),
      },
    });
    campaignIds.push(campaign.id);
  }
  console.log('  5 campaigns created');

  // ============================
  // EMAIL LOGS (150)
  // ============================
  const emailStatuses = ['sent', 'sent', 'sent', 'sent', 'opened', 'opened', 'clicked', 'bounced'];
  for (let i = 0; i < 150; i++) {
    const lead = pick(leadNames);
    const campaignId = pick(campaignIds.filter((_, idx) => campaignDefs[idx].status === 'sent'));
    const status = pick(emailStatuses);
    const createdAt = daysAgo(rand(1, 30));

    await prisma.emailLog.create({
      data: {
        campaignId,
        leadId: lead.id,
        to: lead.email,
        subject: pick(templates).subject.replace('[KONTAKT]', lead.kontakt),
        status,
        openedAt: ['opened', 'clicked'].includes(status) ? new Date(createdAt.getTime() + rand(3600000, 86400000)) : null,
        clickedAt: status === 'clicked' ? new Date(createdAt.getTime() + rand(7200000, 172800000)) : null,
        bouncedAt: status === 'bounced' ? createdAt : null,
        createdAt,
      },
    });
  }
  console.log('  150 email logs created');

  // ============================
  // INVOICES (20)
  // ============================
  const invoiceIds: string[] = [];
  const invoiceData: { id: string; total: number; status: string }[] = [];

  const serviceItems = [
    { description: 'WerkPilot Standard Paket — Monatlich', amount: 2000 },
    { description: 'WerkPilot Premium Paket — Monatlich', amount: 3500 },
    { description: 'WerkPilot Enterprise Paket — Monatlich', amount: 5000 },
    { description: 'Setup & Onboarding', amount: 1500 },
    { description: 'Individuelle Integration', amount: 2500 },
    { description: 'Zusätzlicher AI-Agent', amount: 500 },
    { description: 'Schulung (halbtags)', amount: 800 },
    { description: 'Consulting — Strategieberatung', amount: 1200 },
    { description: 'Website-Optimierung', amount: 3000 },
    { description: 'SEO-Audit & Massnahmenplan', amount: 1800 },
  ];

  for (let i = 0; i < 20; i++) {
    const lead = leadNames[i % leadNames.length];
    const itemCount = rand(1, 3);
    const items = Array.from({ length: itemCount }, () => pick(serviceItems));
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const vatRate = 8.1;
    const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;
    const year = 2026;
    const invoiceNumber = `WP-${year}-${String(i + 1).padStart(3, '0')}`;

    const statusRoll = Math.random();
    let status: string;
    let paidAt: Date | null = null;
    if (statusRoll < 0.35) {
      status = 'paid';
      paidAt = daysAgo(rand(1, 20));
    } else if (statusRoll < 0.55) {
      status = 'sent';
    } else if (statusRoll < 0.7) {
      status = 'overdue';
    } else {
      status = 'draft';
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        leadId: lead.id,
        clientName: lead.firma,
        clientEmail: lead.email,
        clientAddress: `Bahnhofstrasse ${rand(1, 100)}, ${rand(8000, 8999)} Zürich`,
        items: JSON.stringify(items),
        subtotal,
        vatRate,
        vatAmount,
        total,
        currency: 'CHF',
        status,
        dueDate: status === 'overdue' ? daysAgo(rand(1, 15)) : daysFromNow(rand(10, 30)),
        paidAt,
        notes: Math.random() > 0.6 ? pick(['Zahlung per TWINT', 'Netto 30 Tage', 'Ratenzahlung vereinbart', '2% Skonto bei Vorauszahlung']) : null,
        createdAt: daysAgo(rand(5, 60)),
      },
    });
    invoiceIds.push(invoice.id);
    invoiceData.push({ id: invoice.id, total, status });
  }
  console.log('  20 invoices created');

  // ============================
  // PAYMENTS (for paid invoices)
  // ============================
  let paymentCount = 0;
  for (const inv of invoiceData) {
    if (inv.status === 'paid') {
      await prisma.payment.create({
        data: {
          invoiceId: inv.id,
          amount: inv.total,
          method: pick(['bank_transfer', 'bank_transfer', 'twint', 'credit_card']),
          reference: `PAY-${rand(10000, 99999)}`,
          notes: Math.random() > 0.7 ? 'Pünktlich bezahlt' : null,
          paidAt: daysAgo(rand(1, 15)),
        },
      });
      paymentCount++;
    }
  }
  console.log(`  ${paymentCount} payments created`);

  // ============================
  // EXPENSES (25)
  // ============================
  const expenseDefs = [
    { description: 'OpenAI API — Monatsabrechnung', category: 'Software', amount: 2450 },
    { description: 'Anthropic Claude API', category: 'Software', amount: 1800 },
    { description: 'Vercel Pro — Hosting', category: 'Infrastruktur', amount: 240 },
    { description: 'AWS S3 & CloudFront', category: 'Infrastruktur', amount: 180 },
    { description: 'Notion Team', category: 'Software', amount: 120 },
    { description: 'Slack Business+', category: 'Software', amount: 95 },
    { description: 'Figma Professional', category: 'Software', amount: 45 },
    { description: 'Google Workspace', category: 'Software', amount: 72 },
    { description: 'GitHub Team', category: 'Software', amount: 84 },
    { description: 'Linear Premium', category: 'Software', amount: 60 },
    { description: 'Büro Miete — Technopark Zürich', category: 'Büro', amount: 3200, recurring: true },
    { description: 'Büro Nebenkosten', category: 'Büro', amount: 450, recurring: true },
    { description: 'Kaffee & Getränke', category: 'Büro', amount: 85 },
    { description: 'Google Ads', category: 'Marketing', amount: 3500 },
    { description: 'LinkedIn Ads', category: 'Marketing', amount: 1200 },
    { description: 'Messe Swiss Digital', category: 'Marketing', amount: 4500 },
    { description: 'Visitenkarten & Flyer', category: 'Marketing', amount: 380 },
    { description: 'Reise Bern — Kundentermin', category: 'Reisen', amount: 145 },
    { description: 'Reise Basel — Partnermeeting', category: 'Reisen', amount: 210 },
    { description: 'SBB GA Travelcard', category: 'Reisen', amount: 340, recurring: true },
    { description: 'Betriebshaftpflicht', category: 'Versicherungen', amount: 450, recurring: true },
    { description: 'Cyber-Versicherung', category: 'Versicherungen', amount: 280, recurring: true },
    { description: 'Steuerberater Q1', category: 'Beratung', amount: 1800 },
    { description: 'Rechtsberatung — AGB Update', category: 'Beratung', amount: 2400 },
    { description: 'Freelancer Design — Landing Page', category: 'Personal', amount: 3200 },
  ];

  for (const exp of expenseDefs) {
    await prisma.expense.create({
      data: {
        description: exp.description,
        category: exp.category,
        amount: exp.amount,
        currency: 'CHF',
        date: daysAgo(rand(1, 45)),
        recurring: exp.recurring || false,
        notes: Math.random() > 0.7 ? 'Monatlich wiederkehrend' : null,
      },
    });
  }
  console.log('  25 expenses created');

  // ============================
  // FOLLOW-UPS (30)
  // ============================
  const followUpTypes = ['email', 'call', 'meeting', 'linkedin'];
  const followUpSubjects = [
    'Fitness-Check Ergebnisse besprechen',
    'Angebot nachfassen',
    'Onboarding Kickoff vereinbaren',
    'Quartalsgespräch planen',
    'Feedback einholen',
    'Cross-Selling Potenzial prüfen',
    'Vertragsverlängerung ansprechen',
    'Problemlösung Follow-Up',
    'Referral anfragen',
    'Produktdemo vereinbaren',
    'Entscheidungsträger identifizieren',
    'Budget-Gespräch führen',
    'Konkurrenz-Vergleich senden',
    'Case Study teilen',
    'Webinar Einladung',
  ];

  for (let i = 0; i < 30; i++) {
    const lead = pick(leadNames);
    const statusRoll = Math.random();
    let status: string;
    let completedAt: Date | null = null;
    if (statusRoll < 0.4) {
      status = 'pending';
    } else if (statusRoll < 0.75) {
      status = 'completed';
      completedAt = daysAgo(rand(1, 15));
    } else if (statusRoll < 0.85) {
      status = 'skipped';
    } else {
      status = 'pending'; // overdue (past due date)
    }

    const isOverdue = status === 'pending' && Math.random() < 0.3;
    const dueDate = isOverdue
      ? daysAgo(rand(1, 7))
      : status === 'completed'
        ? daysAgo(rand(2, 20))
        : daysFromNow(rand(0, 14));

    await prisma.followUp.create({
      data: {
        leadId: lead.id,
        type: pick(followUpTypes),
        subject: pick(followUpSubjects),
        message: Math.random() > 0.5 ? pick([
          'Bitte Rückmeldung zum Angebot einholen.',
          'Termin für nächste Woche vorschlagen.',
          'Kurzes Check-in nach Onboarding.',
          'Neue Features demonstrieren.',
          'Zufriedenheitsumfrage durchführen.',
        ]) : null,
        status,
        priority: rand(1, 5),
        dueDate,
        completedAt,
        notes: Math.random() > 0.7 ? pick([
          'Kunde war sehr interessiert',
          'Voicemail hinterlassen',
          'LinkedIn Nachricht gesendet',
          'Meeting bestätigt',
          'Kein Interesse signalisiert',
        ]) : null,
        createdAt: daysAgo(rand(5, 30)),
      },
    });
  }
  console.log('  30 follow-ups created');

  // ============================
  // FOLLOW-UP SEQUENCES (3)
  // ============================
  const sequences = [
    {
      name: 'Fitness-Check Funnel',
      description: 'Automatische Follow-Up Sequenz nach Fitness-Check Ergebnis',
      steps: JSON.stringify([
        { day: 0, type: 'email', subject: 'Ihre Ergebnisse sind da', template: 'fitness-results' },
        { day: 3, type: 'email', subject: 'Haben Sie Fragen?', template: 'fitness-faq' },
        { day: 7, type: 'call', subject: 'Persönliches Gespräch' },
        { day: 14, type: 'email', subject: 'Exklusives Angebot', template: 'fitness-offer' },
      ]),
      trigger: 'fitness_complete',
      usageCount: 42,
    },
    {
      name: 'Neukunden Onboarding',
      description: 'Onboarding-Sequenz für neue Kunden nach Vertragsabschluss',
      steps: JSON.stringify([
        { day: 0, type: 'email', subject: 'Willkommen bei WerkPilot', template: 'welcome' },
        { day: 1, type: 'call', subject: 'Kickoff Call' },
        { day: 7, type: 'email', subject: 'Erste Woche — Wie läuft es?', template: 'week1-check' },
        { day: 30, type: 'meeting', subject: 'Monats-Review' },
      ]),
      trigger: 'deal_won',
      usageCount: 15,
    },
    {
      name: 'Cold Outreach',
      description: 'Kaltakquise-Sequenz für neue Leads aus dem Scraper',
      steps: JSON.stringify([
        { day: 0, type: 'email', subject: 'Potential für Ihr Unternehmen', template: 'cold-intro' },
        { day: 4, type: 'linkedin', subject: 'LinkedIn Vernetzung' },
        { day: 8, type: 'email', subject: 'Kurze Frage...', template: 'cold-followup' },
        { day: 15, type: 'call', subject: 'Abschluss-Call' },
      ]),
      trigger: 'new_lead',
      usageCount: 67,
    },
  ];

  for (const seq of sequences) {
    await prisma.followUpSequence.create({ data: seq });
  }
  console.log('  3 follow-up sequences created');

  // ============================
  // NOTIFICATIONS (10)
  // ============================
  const notifications = [
    { title: 'Neue Leads importiert', message: '12 neue Leads aus Google Maps Scraper (Region Zürich)', type: 'info' },
    { title: 'Kampagne gesendet', message: 'Q1 Fitness-Check Kampagne an 85 Empfänger gesendet', type: 'success' },
    { title: 'Rechnung überfällig', message: 'WP-2026-003 von Treuhand Müller AG — CHF 4.050 seit 7 Tagen überfällig', type: 'warning' },
    { title: 'Agent Fehler', message: 'Inside Sales Bot: Timeout bei API-Aufruf', type: 'error' },
    { title: 'Zahlung eingegangen', message: 'CHF 2.162 von Beratung Keller GmbH (WP-2026-001)', type: 'success' },
    { title: 'Follow-Up fällig', message: '3 Follow-Ups für heute ausstehend', type: 'warning' },
    { title: 'Neuer Kunde', message: 'IT-Services Weber AG hat Vertrag unterschrieben', type: 'success' },
    { title: 'Night Shift abgeschlossen', message: '8/10 Tasks erfolgreich abgeschlossen', type: 'info' },
    { title: 'Hohe Open Rate', message: 'Newsletter Februar: 56.7% Open Rate — neuer Rekord!', type: 'success' },
    { title: 'Budget-Warnung', message: 'Marketing-Ausgaben bei 87% des Monatsbudgets', type: 'warning' },
  ];

  for (let i = 0; i < notifications.length; i++) {
    await prisma.notification.create({
      data: {
        ...notifications[i],
        read: i > 3,
        createdAt: daysAgo(i),
      },
    });
  }
  console.log('  10 notifications created');

  console.log('\nSeeding complete!');
  console.log('  Total: 100 leads, 43 agents, 6 templates, 5 campaigns, 150 emails, 20 invoices, 25 expenses, 30 follow-ups, 3 sequences, 10 notifications');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
