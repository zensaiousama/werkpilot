import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient();

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

  // Clean existing data
  await prisma.activity.deleteMany();
  await prisma.agentLog.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.nightShiftTask.deleteMany();
  await prisma.decision.deleteMany();

  // Seed 100 leads
  for (let i = 0; i < 100; i++) {
    const kanton = pick(kantons);
    const ort = pick(orte[kanton] || [kanton]);
    const nachname = pick(nachnamen);
    const vorname = pick(vornamen);
    const branche = pick(branchen);
    const firma = `${branche === 'Treuhand' ? 'Treuhand' : branche === 'Rechtsberatung' ? 'Kanzlei' : branche === 'Gesundheit' ? 'Praxis' : ''} ${nachname}${Math.random() > 0.5 ? ' AG' : ' GmbH'}`.trim();

    await prisma.lead.create({
      data: {
        firma,
        kontakt: `${vorname} ${nachname}`,
        email: `${vorname.toLowerCase()}.${nachname.toLowerCase()}@${firma.toLowerCase().replace(/[^a-z]/g, '')}.ch`,
        telefon: `+41 ${rand(20, 79)} ${rand(100, 999)} ${rand(10, 99)} ${rand(10, 99)}`,
        website: `https://www.${firma.toLowerCase().replace(/[^a-z]/g, '')}.ch`,
        adresse: `${['Bahnhofstrasse', 'Hauptstrasse', 'Dorfstrasse', 'Seestrasse', 'Kirchgasse'][i % 5]} ${rand(1, 120)}, ${rand(1000, 9999)} ${ort}`,
        branche,
        kanton,
        ort,
        status: pick(statuses),
        leadScore: rand(10, 95),
        fitnessScore: rand(20, 90),
        umsatzpotenzial: pick([1500, 2000, 2000, 2000, 3500, 5000]),
        googleRating: Math.round((3 + Math.random() * 2) * 10) / 10,
        googleReviews: rand(2, 200),
        quelle: pick(['Google Maps Scraper', 'Website', 'Referral', 'LinkedIn', 'Manual']),
        activities: {
          create: [
            { type: 'note', details: 'Lead erstellt via Import' },
            ...(Math.random() > 0.5 ? [{ type: 'email_sent', details: 'Fitness-Check Einladung gesendet' }] : []),
            ...(Math.random() > 0.7 ? [{ type: 'status_change', details: 'Status: New Lead → Contacted' }] : []),
          ],
        },
      },
    });
  }
  console.log('  100 leads created');

  // Seed 43 agents
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
            { level: 'info', message: `${def.name} agent started` },
            { level: 'info', message: `Completed ${rand(1, 20)} tasks` },
            ...(isError ? [{ level: 'error', message: 'Connection timeout to Airtable API' }] : []),
          ],
        },
      },
    });
  }
  console.log('  43 agents created');

  // Seed night shift tasks
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

  // Seed decisions
  const decisions = [
    { title: 'Preiserhöhung Package A', context: 'Package A liegt unter dem Marktdurchschnitt. Empfehlung: +10% auf CHF 1.650/Mo.', options: '["CHF 1.650", "CHF 1.750", "Beibehalten"]', recommendation: 'CHF 1.650' },
    { title: 'Neuer Sales-Agent einstellen?', context: 'Pipeline wächst schneller als Kapazität. 15 Leads warten auf Follow-up.', options: '["Freelancer", "Teilzeit", "Abwarten"]', recommendation: 'Freelancer' },
    { title: 'Google Ads Budget verdoppeln?', context: 'ROAS liegt bei 4.2x. Mehr Budget könnte mehr Leads generieren.', options: '["Verdoppeln", "+50%", "Beibehalten"]', recommendation: 'Verdoppeln' },
  ];
  for (const d of decisions) {
    await prisma.decision.create({ data: d });
  }
  console.log('  3 decisions created');

  console.log('Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
