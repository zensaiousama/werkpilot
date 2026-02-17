import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Realistic Swiss business data
const branchen = [
  'Treuhand', 'Immobilien', 'Handwerk', 'Gastronomie', 'Zahnarzt',
  'Architektur', 'IT-Dienstleistung', 'Rechtsanwaltschaft', 'Physiotherapie',
  'Beratung', 'Auto-Garage', 'Coiffeur', 'Fitness', 'Optiker', 'Apotheke'
];

const kantons = [
  'Zürich', 'Bern', 'Luzern', 'Basel-Stadt', 'Basel-Landschaft', 'Aargau',
  'St. Gallen', 'Genf', 'Waadt', 'Tessin', 'Zug', 'Thurgau', 'Solothurn',
  'Wallis', 'Graubünden', 'Neuenburg', 'Fribourg', 'Schaffhausen'
];

const orte: Record<string, string[]> = {
  'Zürich': ['Zürich', 'Winterthur', 'Uster', 'Dübendorf', 'Dietikon', 'Wetzikon', 'Horgen'],
  'Bern': ['Bern', 'Thun', 'Biel', 'Burgdorf', 'Köniz', 'Langenthal'],
  'Luzern': ['Luzern', 'Emmen', 'Kriens', 'Horw', 'Ebikon'],
  'Basel-Stadt': ['Basel', 'Riehen'],
  'Basel-Landschaft': ['Liestal', 'Pratteln', 'Muttenz', 'Allschwil'],
  'Aargau': ['Aarau', 'Baden', 'Wettingen', 'Wohlen', 'Oftringen'],
  'St. Gallen': ['St. Gallen', 'Rapperswil', 'Wil', 'Uzwil', 'Gossau'],
  'Genf': ['Genève', 'Carouge', 'Vernier', 'Meyrin', 'Onex'],
  'Waadt': ['Lausanne', 'Montreux', 'Vevey', 'Yverdon', 'Nyon'],
  'Tessin': ['Lugano', 'Bellinzona', 'Locarno', 'Mendrisio'],
  'Zug': ['Zug', 'Baar', 'Cham', 'Rotkreuz'],
  'Thurgau': ['Frauenfeld', 'Kreuzlingen', 'Arbon', 'Romanshorn'],
  'Solothurn': ['Solothurn', 'Olten', 'Grenchen'],
  'Wallis': ['Sion', 'Sierre', 'Martigny', 'Monthey', 'Visp'],
  'Graubünden': ['Chur', 'Davos', 'St. Moritz'],
  'Neuenburg': ['Neuchâtel', 'La Chaux-de-Fonds'],
  'Fribourg': ['Fribourg', 'Bulle'],
  'Schaffhausen': ['Schaffhausen', 'Neuhausen']
};

const statuses = [
  'New Lead', 'Researched', 'Fitness Check', 'Contacted',
  'Interested', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Client', 'Lost'
];

// Weighted status distribution (matches realistic pipeline)
const statusWeights = [
  { status: 'New Lead', weight: 30 },
  { status: 'Researched', weight: 15 },
  { status: 'Fitness Check', weight: 10 },
  { status: 'Contacted', weight: 10 },
  { status: 'Interested', weight: 10 },
  { status: 'Meeting', weight: 5 },
  { status: 'Proposal', weight: 5 },
  { status: 'Negotiation', weight: 5 },
  { status: 'Won', weight: 3 },
  { status: 'Client', weight: 2 },
  { status: 'Lost', weight: 5 }
];

const nachnamen = [
  'Müller', 'Meier', 'Schmid', 'Keller', 'Weber', 'Huber', 'Schneider',
  'Fischer', 'Steiner', 'Brunner', 'Baumann', 'Gerber', 'Wyss', 'Graf',
  'Frei', 'Moser', 'Zimmermann', 'Hofmann', 'Lehmann', 'Bühler', 'Roth',
  'Egli', 'Stauffer', 'Berger', 'Widmer', 'Marti', 'Suter', 'Flückiger',
  // French-speaking
  'Dubois', 'Laurent', 'Martin', 'Bernard', 'Favre', 'Rossier', 'Jacot',
  // Italian-speaking
  'Rossi', 'Ferrari', 'Bianchi', 'Colombo', 'Ricci', 'Moretti'
];

const vornamen = [
  // German
  'Hans', 'Peter', 'Thomas', 'Martin', 'Daniel', 'Andreas', 'Markus',
  'Stefan', 'Christian', 'Michael', 'Sandra', 'Monika', 'Barbara',
  'Claudia', 'Andrea', 'Sabine', 'Nicole', 'Karin', 'Ursula', 'Silvia',
  'Beat', 'Reto', 'Urs', 'Fritz', 'Werner', 'Kurt', 'Anna', 'Maria',
  // French
  'Pierre', 'Jean', 'François', 'Michel', 'Philippe', 'Marie', 'Sophie',
  'Isabelle', 'Catherine', 'Nathalie',
  // Italian
  'Marco', 'Luca', 'Paolo', 'Giovanni', 'Francesca', 'Giulia', 'Chiara'
];

const firmenPrefixes: Record<string, string[]> = {
  'Treuhand': ['Treuhand', 'Treuhandbüro', 'Revisions- und Treuhand'],
  'Immobilien': ['Immobilien', 'Liegenschaftenverwaltung', 'Real Estate'],
  'Handwerk': ['Schreinerei', 'Malerei', 'Elektro', 'Sanitär', 'Bauunternehmung'],
  'Gastronomie': ['Restaurant', 'Café', 'Pizzeria', 'Trattoria', 'Bistro'],
  'Zahnarzt': ['Zahnarztpraxis', 'Dental', 'Zahnklinik'],
  'Architektur': ['Architekturbüro', 'Architekten', 'Planungsbüro'],
  'IT-Dienstleistung': ['IT Solutions', 'Software', 'Digital', 'Tech'],
  'Rechtsanwaltschaft': ['Rechtsanwaltskanzlei', 'Anwaltsbüro', 'Juristische Beratung'],
  'Physiotherapie': ['Physiotherapie', 'Physio', 'Therapiezentrum'],
  'Beratung': ['Consulting', 'Beratung', 'Advisory'],
  'Auto-Garage': ['Garage', 'Auto-Center', 'Automobil'],
  'Coiffeur': ['Coiffeur', 'Hair & Beauty', 'Salon'],
  'Fitness': ['Fitness', 'Training', 'Gym', 'Sport'],
  'Optiker': ['Optik', 'Brillen', 'Augenoptik'],
  'Apotheke': ['Apotheke', 'Pharmazie', 'Drogerie']
};

const rechtsformen = ['AG', 'GmbH', ''];

const strassen = [
  'Bahnhofstrasse', 'Hauptstrasse', 'Dorfstrasse', 'Seestrasse', 'Kirchgasse',
  'Poststrasse', 'Schulhausstrasse', 'Zürcherstrasse', 'Bernstrasse', 'Industriestrasse',
  'Alte Landstrasse', 'Lindenstrasse', 'Gartenstrasse', 'Bergstrasse', 'Talstrasse'
];

const quellen = [
  'Google Maps Scraper', 'Website', 'Referral', 'LinkedIn', 'Manual',
  'Local.ch', 'Search.ch', 'Partner Network', 'Trade Show', 'Cold Outreach'
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * total;
  for (const item of items) {
    if (random < item.weight) return item;
    random -= item.weight;
  }
  return items[items.length - 1];
}

function generatePhone(): string {
  const area = pick(['43', '44', '58', '61', '71', '78', '79', '31', '41', '52']);
  return `+41 ${area} ${rand(100, 999)} ${rand(10, 99)} ${rand(10, 99)}`;
}

function generateFirma(branche: string, nachname: string): string {
  const prefix = pick(firmenPrefixes[branche]);
  const rechtsform = pick(rechtsformen);
  const suffix = rechtsform ? ` ${rechtsform}` : '';

  if (Math.random() > 0.5) {
    return `${prefix} ${nachname}${suffix}`.trim();
  } else {
    return `${nachname} ${prefix}${suffix}`.trim();
  }
}

function generateWebsite(firma: string): string {
  const slug = firma
    .toLowerCase()
    .replace(/[äöü]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue' }[c] || c))
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
  return `https://www.${slug}.ch`;
}

function generateEmail(vorname: string, nachname: string, firma: string): string {
  const slug = firma
    .toLowerCase()
    .replace(/[äöü]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue' }[c] || c))
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
  return `${vorname.toLowerCase()}.${nachname.toLowerCase()}@${slug}.ch`;
}

// All 43 agent definitions (42 + orchestrator)
const agentDefs = [
  // CEO
  { name: 'Morning Briefing', dept: 'CEO' },
  { name: 'Decision Support', dept: 'CEO' },
  { name: 'Productivity', dept: 'CEO' },

  // Sales
  { name: 'Key Account', dept: 'Sales' },
  { name: 'New Business', dept: 'Sales' },
  { name: 'Partnerships', dept: 'Sales' },
  { name: 'Pricing Engine', dept: 'Sales' },
  { name: 'Inside Sales Bot', dept: 'Sales' },

  // Marketing
  { name: 'Performance Marketing', dept: 'Marketing' },
  { name: 'Brand Marketing', dept: 'Marketing' },
  { name: 'PR / Media', dept: 'Marketing' },
  { name: 'Content Engine', dept: 'Marketing' },
  { name: 'Email Marketing', dept: 'Marketing' },

  // Product
  { name: 'Product Strategy', dept: 'Product' },
  { name: 'Innovation', dept: 'Product' },
  { name: 'Customer Experience', dept: 'Product' },
  { name: 'Pricing Strategy', dept: 'Product' },
  { name: 'Quality Management', dept: 'Product' },

  // Operations
  { name: 'Translation Engine', dept: 'Operations' },
  { name: 'Process Automation', dept: 'Operations' },
  { name: 'Capacity Planning', dept: 'Operations' },
  { name: 'Service Quality', dept: 'Operations' },
  { name: 'Infrastructure', dept: 'Operations' },

  // Finance
  { name: 'Controlling', dept: 'Finance' },
  { name: 'FP&A', dept: 'Finance' },
  { name: 'Treasury', dept: 'Finance' },
  { name: 'Fundraising', dept: 'Finance' },
  { name: 'M&A Scout', dept: 'Finance' },

  // Strategy
  { name: 'Market Expansion', dept: 'Strategy' },
  { name: 'M&A Analysis', dept: 'Strategy' },
  { name: 'Market Analysis', dept: 'Strategy' },
  { name: 'Competitor Intel', dept: 'Strategy' },
  { name: 'BizDev', dept: 'Strategy' },

  // HR
  { name: 'Recruiting', dept: 'HR' },
  { name: 'Training', dept: 'HR' },
  { name: 'Employer Branding', dept: 'HR' },
  { name: 'Performance Mgmt', dept: 'HR' },
  { name: 'Compensation', dept: 'HR' },

  // IT
  { name: 'Systems', dept: 'IT' },
  { name: 'Automation', dept: 'IT' },
  { name: 'Data Analytics', dept: 'IT' },
  { name: 'AI Optimization', dept: 'IT' },

  // System
  { name: 'Orchestrator', dept: 'System' },
];

// Realistic night shift tasks
const nightShiftTasks = [
  'Scrape 50 neue Treuhand-Leads Kanton Zürich',
  'SEO-Analyse für Top-20 Kunden durchführen',
  'Follow-Up Emails für Meeting-Pipeline versenden',
  'Google Ratings aktualisieren (alle Leads)',
  'Wettbewerber-Monitoring für Immobilien-Branche',
  'Lead-Scoring Modell neu trainieren',
  'Fitness-Scores für alle Neukunden berechnen',
  'LinkedIn Profile enrichment (100 Leads)',
  'Quartalsbericht für CEO vorbereiten',
  'Cleanup: Duplikate in CRM entfernen',
  'Website-Checks für alle Leads mit Status "Contacted"',
  'Email-Vorlagen für Gastronomie-Leads optimieren',
  'Agent Performance Report generieren',
  'Backup aller Kundendaten erstellen',
  'A/B Test Auswertung: Email Subject Lines'
];

// Realistic decisions
const decisions = [
  {
    title: 'Preiserhöhung Package "Business Pro"',
    context: 'Aktuelle Pricing-Analyse zeigt: Wir liegen 18% unter Marktdurchschnitt. Wettbewerber verlangen CHF 1.950-2.200 für vergleichbare Leistungen. Unsere Kosten sind um 12% gestiegen.',
    options: JSON.stringify(['CHF 1.750 (+10%)', 'CHF 1.950 (+23%)', 'CHF 1.650 (+4%)', 'Beibehalten']),
    recommendation: 'CHF 1.750 (+10%)'
  },
  {
    title: 'Sales-Freelancer engagieren?',
    context: '24 Leads in Pipeline-Stage "Interested" und "Meeting" warten auf Follow-up. Durchschnittliche Response-Zeit: 4.2 Tage (Ziel: <24h). Geschätzte verlorene Revenue: CHF 45.000/Monat.',
    options: JSON.stringify(['Freelancer 60%', 'Teilzeit-Anstellung', 'Agent-Kapazität erhöhen', 'Abwarten']),
    recommendation: 'Freelancer 60%'
  },
  {
    title: 'Google Ads Budget für Q2',
    context: 'Q1 Performance: ROAS 4.8x, CPL CHF 38, Conversion Rate 12.4%. Budget voll ausgeschöpft. Weitere 8 profitable Keywords identifiziert. Wettbewerber investieren 3x mehr.',
    options: JSON.stringify(['Verdoppeln auf CHF 8.000', '+50% auf CHF 6.000', '+25% auf CHF 5.000', 'Beibehalten CHF 4.000']),
    recommendation: 'Verdoppeln auf CHF 8.000'
  },
  {
    title: 'Expansion nach Romandie beschleunigen?',
    context: '34 Leads aus Waadt/Genf, aber nur 2 Conversions. Sprachbarriere identifiziert. 68% der Leads bevorzugen Kommunikation auf Französisch.',
    options: JSON.stringify(['Französischsprachigen Sales-Agent', 'Übersetzungs-Agent ausbauen', 'Regional-Partner suchen', 'Fokus auf Deutschschweiz']),
    recommendation: 'Französischsprachigen Sales-Agent'
  },
  {
    title: 'CRM-System upgraden?',
    context: 'Aktuelles System: 89% Auslastung, langsame Queries (avg 3.2s), keine API für neue Tools. Upgrade-Kosten: CHF 12.000 Setup + CHF 450/Monat. ROI-Schätzung: 18 Monate.',
    options: JSON.stringify(['Upgrade auf Enterprise', 'Migration zu HubSpot', 'Custom Solution entwickeln', 'Optimieren & Beibehalten']),
    recommendation: 'Upgrade auf Enterprise'
  }
];

// Realistic notifications
const notifications = [
  {
    type: 'alert',
    title: 'Agent "Email Marketing" Error',
    message: 'Connection timeout beim Versand von 23 Follow-up Emails. Warteschlange: 47 ausstehend.',
    read: false
  },
  {
    type: 'success',
    title: 'Night Shift abgeschlossen',
    message: '12/15 Tasks erfolgreich. 47 neue Leads, 156 Scores aktualisiert, 89 Emails versendet.',
    read: true
  },
  {
    type: 'warning',
    title: 'Lead-Qualität gesunken',
    message: 'Durchschnittlicher Lead Score der letzten 48h: 42 (Normal: 68). Quelle "Google Maps Scraper" prüfen.',
    read: false
  },
  {
    type: 'info',
    title: 'Neue Decision verfügbar',
    message: 'Decision Support Agent empfiehlt: Preiserhöhung Package "Business Pro" um 10%.',
    read: true
  },
  {
    type: 'alert',
    title: 'Pipeline-Stau bei "Meeting"',
    message: '18 Leads seit >7 Tagen in Stage "Meeting". Durchschnittliche Conversion-Zeit überschritten.',
    read: false
  },
  {
    type: 'success',
    title: 'Neuer Deal gewonnen',
    message: 'Treuhand Weber AG (Zürich) → Status "Client". Umsatzpotenzial: CHF 24.000/Jahr. Agent: Key Account.',
    read: true
  },
  {
    type: 'warning',
    title: 'Google Ads Budget 94% aufgebraucht',
    message: 'Monatsbudget zu 94% ausgeschöpft. Noch 11 Tage bis Monatsende. Kampagnen-Pause empfohlen ab 96%.',
    read: false
  },
  {
    type: 'info',
    title: 'Wettbewerber-Update',
    message: 'Competitor Intel: "SwissBiz Solutions" hat Preise um 8% gesenkt. 3 ähnliche Packages identifiziert.',
    read: true
  },
  {
    type: 'alert',
    title: 'Absprungrate Dashboard gestiegen',
    message: 'Analytics zeigt: Bounce Rate 68% (+22% vs. Vorwoche) auf Fitness-Check Seite. Performance-Check empfohlen.',
    read: false
  },
  {
    type: 'success',
    title: 'Agent-Performance über Target',
    message: 'Alle 43 Agents laufen stabil. Durchschnittlicher Score: 87/100 (Target: 75). 0 Critical Errors heute.',
    read: true
  }
];

export async function POST() {
  try {
    // Clean existing data
    console.log('Cleaning database...');
    await prisma.notification.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.agentLog.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.nightShiftTask.deleteMany();
    await prisma.decision.deleteMany();

    console.log('Creating 200 leads...');
    // Create 200 realistic leads
    for (let i = 0; i < 200; i++) {
      const kanton = pick(kantons);
      const ort = pick(orte[kanton] || [kanton]);
      const nachname = pick(nachnamen);
      const vorname = pick(vornamen);
      const branche = pick(branchen);
      const firma = generateFirma(branche, nachname);
      const selectedStatus = weightedPick(statusWeights);
      const status = selectedStatus.status;

      const leadScore = rand(20, 95);
      const fitnessScore = rand(15, 85);
      const umsatzpotenzial = rand(5000, 150000);
      const googleRating = Math.round((3.2 + Math.random() * 1.8) * 10) / 10;
      const googleReviews = rand(5, 500);

      const strasse = pick(strassen);
      const hausnummer = rand(1, 120);
      const plz = ort === 'Zürich' ? rand(8000, 8099) :
                  ort === 'Bern' ? rand(3000, 3099) :
                  ort === 'Basel' ? rand(4000, 4099) :
                  ort === 'Genève' ? rand(1200, 1299) :
                  ort === 'Lausanne' ? rand(1000, 1099) :
                  rand(1000, 9999);

      // Create activities based on status
      const activities = [
        { type: 'note', details: `Lead erstellt via ${pick(quellen)}` }
      ];

      if (['Researched', 'Fitness Check', 'Contacted', 'Interested', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Client'].includes(status)) {
        activities.push({ type: 'note', details: 'Initial Research abgeschlossen' });
      }

      if (['Fitness Check', 'Contacted', 'Interested', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Client'].includes(status)) {
        activities.push({ type: 'email', details: 'Fitness-Check Email versendet' });
      }

      if (['Contacted', 'Interested', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Client'].includes(status)) {
        activities.push({
          type: 'call',
          details: `Erstgespräch: ${pick(['Interesse an Automatisierung', 'Benötigt mehr Leads', 'Möchte Beratung', 'Follow-up vereinbart'])}`
        });
      }

      if (['Interested', 'Meeting', 'Proposal', 'Negotiation', 'Won', 'Client'].includes(status)) {
        activities.push({
          type: 'meeting',
          details: `Meeting gebucht für ${new Date(Date.now() + rand(1, 14) * 86400000).toLocaleDateString('de-CH')}`
        });
      }

      if (['Proposal', 'Negotiation', 'Won', 'Client'].includes(status)) {
        activities.push({ type: 'note', details: `Proposal versendet: Package ${pick(['Starter', 'Business', 'Enterprise'])}` });
      }

      if (['Won', 'Client'].includes(status)) {
        activities.push({ type: 'note', details: '✅ Deal gewonnen! Vertrag unterzeichnet.' });
      }

      if (status === 'Lost') {
        activities.push({
          type: 'note',
          details: `❌ Lost: ${pick(['Zu teuer', 'Falscher Zeitpunkt', 'Keine Antwort', 'Wettbewerber gewählt', 'Budget fehlt'])}`
        });
      }

      await prisma.lead.create({
        data: {
          firma,
          kontakt: `${vorname} ${nachname}`,
          email: generateEmail(vorname, nachname, firma),
          telefon: generatePhone(),
          website: generateWebsite(firma),
          adresse: `${strasse} ${hausnummer}, ${plz} ${ort}`,
          branche,
          kanton,
          ort,
          status,
          leadScore,
          fitnessScore,
          umsatzpotenzial,
          googleRating,
          googleReviews,
          quelle: pick(quellen),
          activities: {
            create: activities
          }
        }
      });
    }

    console.log('Creating 43 agents...');
    // Create all 43 agents
    for (const def of agentDefs) {
      const isError = Math.random() < 0.12; // ~12% error rate (5 agents)
      const isRunning = !isError && Math.random() < 0.85; // ~85% running (35 agents)
      const score = isError ? rand(20, 50) : rand(60, 98);
      const tasksToday = isError ? rand(0, 15) : rand(5, 50);
      const errorsToday = isError ? rand(5, 15) : rand(0, 3);

      const logs: { level: string; message: string }[] = [
        { level: 'info', message: `${def.name} agent started at ${new Date(Date.now() - rand(3600000, 28800000)).toISOString()}` },
        { level: 'info', message: `Processed ${rand(5, 30)} tasks successfully` },
        { level: 'info', message: `Current queue: ${rand(0, 15)} pending tasks` }
      ];

      if (isError) {
        logs.push(
          { level: 'error', message: pick(['Connection timeout to external API', 'Rate limit exceeded', 'Database query failed', 'Memory allocation error']) },
          { level: 'warning', message: 'Retrying failed operations...' },
          { level: 'error', message: 'Max retry attempts reached' }
        );
      } else {
        logs.push({ level: 'info', message: `Performance: ${rand(85, 99)}% efficiency` });
      }

      await prisma.agent.create({
        data: {
          name: def.name,
          dept: def.dept,
          status: isError ? 'error' : isRunning ? 'running' : 'idle',
          score,
          tasksToday,
          errorsToday,
          lastRun: new Date(Date.now() - rand(0, 3600000)),
          logs: {
            create: logs
          }
        }
      });
    }

    console.log('Creating 15 night shift tasks...');
    // Create 15 night shift tasks (10 done, 3 in_progress, 2 pending)
    for (let i = 0; i < nightShiftTasks.length; i++) {
      const task = nightShiftTasks[i];
      let status: 'pending' | 'in_progress' | 'done';

      if (i < 10) status = 'done';
      else if (i < 13) status = 'in_progress';
      else status = 'pending';

      const priority = rand(1, 5);
      const isDone = status === 'done';
      const isInProgress = status === 'in_progress';

      const startedAt = (isDone || isInProgress)
        ? new Date(Date.now() - rand(3600000, 28800000))
        : null;

      const completedAt = isDone
        ? new Date(Date.now() - rand(0, 3600000))
        : null;

      const outputs = [
        `✓ Completed successfully. ${rand(15, 89)} items processed.`,
        `✓ Done. ${rand(3, 25)} changes applied.`,
        `✓ Finished. ${rand(45, 150)} records updated.`,
        `✓ Success. Generated ${rand(2, 8)} reports.`,
        `✓ OK. ${rand(10, 60)} emails sent.`
      ];

      await prisma.nightShiftTask.create({
        data: {
          task,
          priority,
          status,
          startedAt,
          completedAt,
          output: isDone ? pick(outputs) : isInProgress ? 'In progress...' : null
        }
      });
    }

    console.log('Creating 5 decisions...');
    // Create 5 decisions
    for (const decision of decisions) {
      await prisma.decision.create({
        data: decision
      });
    }

    console.log('Creating 10 notifications...');
    // Create 10 notifications
    for (const notification of notifications) {
      await prisma.notification.create({
        data: notification
      });
    }

    console.log('Seed completed successfully!');
    return NextResponse.json({
      ok: true,
      leads: 200,
      agents: 43,
      nightShiftTasks: 15,
      decisions: 5,
      notifications: 10
    });

  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
