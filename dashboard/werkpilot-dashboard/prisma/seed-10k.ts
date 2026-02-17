/**
 * Werkpilot Dashboard - 10,000 Swiss Company Lead Seed Script
 * 
 * Generates 10,000 realistic Swiss business contacts with CEO data,
 * plus associated Activity records for 40% of leads.
 * 
 * Usage: npx tsx prisma/seed-10k.ts
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// ---------------------------------------------------------------------------
// Prisma Client Setup
// ---------------------------------------------------------------------------

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
});
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Normal distribution using Box-Muller transform, clamped to [min, max] */
function randNormal(mean: number, stddev: number, min: number, max: number): number {
  let u1 = Math.random();
  let u2 = Math.random();
  // Avoid log(0)
  if (u1 === 0) u1 = 0.0001;
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const value = Math.round(mean + z * stddev);
  return Math.max(min, Math.min(max, value));
}

function sanitizeDomain(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/é|è|ê/g, 'e')
    .replace(/à|â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/ô/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 30);
}

function sanitizeEmail(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/é|è|ê/g, 'e')
    .replace(/à|â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/ô/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9.-]/g, '');
}

// ---------------------------------------------------------------------------
// Data Pools
// ---------------------------------------------------------------------------

const companyPrefixes = [
  'Müller', 'Schneider', 'Weber', 'Fischer', 'Meyer', 'Wagner', 'Becker', 'Hoffmann',
  'Schmid', 'Koch', 'Richter', 'Wolf', 'Schröder', 'Brunner', 'Braun', 'Zimmermann',
  'Huber', 'König', 'Steiner', 'Meier', 'Keller', 'Baumann', 'Frey', 'Berger',
  'Moser', 'Suter', 'Graf', 'Gerber', 'Bühler', 'Widmer', 'Wyss', 'Ammann',
  'Roth', 'Studer', 'Kuhn', 'Arnold', 'Wenger', 'Hofer', 'Zaugg', 'Egger',
  'Aebischer', 'Zbinden', 'Lüthi', 'Schenk', 'Flückiger', 'Nussbaum', 'Zürcher',
  'Peter', 'Lehmann', 'Vogt', 'Bieri', 'Burri', 'Hess', 'Maurer', 'Schwab',
  'Blaser', 'Kaufmann', 'Tanner', 'Aebi', 'Bühlmann', 'Liechti', 'Habegger',
  'Rüegg', 'Bachmann', 'Pfister', 'Brügger', 'Küng', 'Wüthrich', 'Baumgartner',
  'Aeschbacher', 'Alpin', 'Bernina', 'Helvetia', 'Alpstein', 'Pilatus', 'Jungfrau',
  'Matterhorn', 'Edelweiss', 'Rigi', 'Titlis', 'Swiss', 'Zentral', 'National',
  'Regional', 'Rhein', 'Aare', 'Limmat', 'Reuss', 'Thur',
  // Additional Swiss surnames for more variety
  'Hartmann', 'Lang', 'Schmitz', 'Werner', 'Schwarz', 'Krause', 'Schuster', 'Jäger',
  'Brandt', 'Sommer', 'Winter', 'Frank', 'Ludwig', 'Heinrich', 'Kunz', 'Haas',
  'Dietrich', 'Fuchs', 'Gross', 'Schäfer', 'Ritter', 'Neumann', 'Vogel', 'Lange',
  'Krüger', 'Hahn', 'Wolff', 'Schumacher', 'Engel', 'Horn', 'Berg', 'Bucher',
  'Graber', 'Leuenberger', 'Felder', 'Stocker', 'Käser', 'Gasser', 'Indermühle',
  'Ritschard', 'Siegenthaler', 'Zumstein', 'Jenni', 'Niederberger', 'Imhof', 'Stucki',
  'Aegerter', 'Balmer', 'Christen', 'Dürr', 'Egli', 'Furrer', 'Gehrig', 'Häfliger',
  'Ineichen', 'Jost', 'Krieger', 'Lustenberger', 'Mathys', 'Neuhaus', 'Oberli',
  'Portmann', 'Rupp', 'Schnyder', 'Tobler', 'Ulrich', 'Vonlanthen', 'Wegmüller',
  'Zeller', 'Aebersold', 'Bader', 'Camenisch', 'Dalcher', 'Erb', 'Flury',
  'Germann', 'Häberli', 'Iseli', 'Jakob', 'Kneubühler', 'Loosli', 'Mäder',
  'Nägeli', 'Oppliger', 'Pfenninger', 'Reber', 'Salzmann', 'Tschanz', 'Urech',
  'Vetterli', 'Waber', 'Zanetti', 'Abderhalden', 'Bosshard', 'Caflisch',
  'Debrunner', 'Eigenmann', 'Frauenfelder', 'Grob', 'Hasler', 'Iten', 'Jordi',
  'Koller', 'Lienhard', 'Marty', 'Noser', 'Ochsner', 'Plüss', 'Rüfenacht',
  'Saxer', 'Thommen', 'Umbricht', 'Vonarburg', 'Waldmeier', 'Zehnder',
  'Stettler', 'Scheidegger', 'Wälti', 'Burgi', 'Ramseier', 'Bärtschi',
  'Rohner', 'Hodel', 'Lüscher', 'Zurfluh', 'Gnägi', 'Messerli', 'Ryser',
  'Schürch', 'Stauffer', 'Werren', 'Affolter', 'Binggeli', 'Corminboeuf',
  'Dähler', 'Engler', 'Fritschi', 'Glanzmann', 'Hirschi', 'Itten',
];

const companySuffixes = [
  'AG', 'GmbH', '& Co.', '& Partner', 'Holding AG', 'Solutions GmbH',
  'Technik AG', 'Bau AG', 'Immobilien AG', 'Treuhand AG', 'Consulting GmbH',
  'Services AG', 'Group AG', 'Handels AG', 'Gastro GmbH', 'Dental AG',
  'Medizin AG', 'Pharma AG', 'Engineering AG', 'Elektro AG', 'Sanitär GmbH',
  'Malerei GmbH', 'Schreinerei GmbH', 'Transport AG', 'Logistik AG',
  'IT Solutions GmbH', 'Digital AG', 'Media GmbH', 'Design GmbH',
  'Architektur AG', 'Rechtsanwälte', 'Beratung GmbH', 'Finanz AG',
  'Versicherungen AG', 'Personalberatung GmbH', 'Reinigung GmbH',
  'Gartenbau GmbH', 'Autohaus AG', 'Garage GmbH', 'Optik AG',
];

const firstNames = [
  'Thomas', 'Daniel', 'Martin', 'Peter', 'Andreas', 'Michael', 'Christian', 'Stefan',
  'Markus', 'Patrick', 'Marco', 'Marcel', 'Christoph', 'David', 'Bruno', 'Beat',
  'René', 'Hans', 'Roland', 'Urs', 'Roger', 'Simon', 'Adrian', 'Reto', 'Dominik',
  'Philipp', 'Lukas', 'Felix', 'Jürg', 'Walter', 'Sandra', 'Nicole', 'Barbara',
  'Monika', 'Andrea', 'Christine', 'Sabine', 'Claudia', 'Brigitte', 'Susanne',
  'Karin', 'Silvia', 'Daniela', 'Corinne', 'Nadine', 'Simone', 'Manuela',
  'Franziska', 'Ursula', 'Ruth', 'Anna', 'Maria', 'Elisabeth', 'Katharina', 'Eva',
  'Gabriela', 'Sonja', 'Martina', 'Beatrice', 'Doris',
  // Additional first names
  'Alexander', 'Bernhard', 'Christof', 'Dieter', 'Ernst', 'Fritz', 'Georg', 'Herbert',
  'Ivan', 'Josef', 'Karl', 'Leo', 'Matthias', 'Norbert', 'Oliver', 'Pascal',
  'Ralf', 'Sascha', 'Tobias', 'Viktor', 'Werner', 'Xavier', 'Yves', 'Niklaus',
  'Heidi', 'Verena', 'Margrit', 'Irene', 'Therese', 'Regula', 'Anita', 'Rosmarie',
  'Cornelia', 'Jacqueline', 'Petra', 'Astrid', 'Helga', 'Ingrid', 'Renate', 'Erika',
];

const lastNames = [
  'Müller', 'Schneider', 'Weber', 'Fischer', 'Meyer', 'Wagner', 'Becker', 'Hoffmann',
  'Schmid', 'Koch', 'Richter', 'Wolf', 'Schröder', 'Brunner', 'Braun', 'Zimmermann',
  'Huber', 'König', 'Steiner', 'Meier', 'Keller', 'Baumann', 'Frey', 'Berger',
  'Moser', 'Suter', 'Graf', 'Gerber', 'Bühler', 'Widmer', 'Wyss', 'Ammann',
  'Roth', 'Studer', 'Kuhn', 'Arnold', 'Wenger', 'Hofer', 'Zaugg', 'Egger',
  'Aebischer', 'Zbinden', 'Lüthi', 'Schenk', 'Flückiger', 'Nussbaum', 'Zürcher',
  'Peter', 'Lehmann', 'Vogt', 'Bieri', 'Burri', 'Hess', 'Maurer', 'Schwab',
  'Blaser', 'Kaufmann', 'Tanner', 'Aebi', 'Bühlmann', 'Liechti', 'Habegger',
  'Rüegg', 'Bachmann', 'Pfister', 'Brügger', 'Küng', 'Wüthrich', 'Baumgartner',
  'Aeschbacher', 'Hartmann', 'Lang', 'Werner', 'Schwarz', 'Schuster', 'Jäger',
  'Brandt', 'Sommer', 'Frank', 'Ludwig', 'Kunz', 'Haas', 'Dietrich', 'Fuchs',
  'Gross', 'Schäfer', 'Ritter', 'Neumann', 'Vogel', 'Hahn', 'Schumacher',
  'Engel', 'Horn', 'Berg', 'Bucher', 'Graber', 'Leuenberger', 'Felder', 'Stocker',
  'Käser', 'Gasser', 'Stucki', 'Balmer', 'Christen', 'Egli', 'Furrer',
  'Jost', 'Mathys', 'Neuhaus', 'Portmann', 'Schnyder', 'Tobler', 'Ulrich',
  'Zeller', 'Bader', 'Erb', 'Germann', 'Iseli', 'Jakob', 'Mäder',
  'Nägeli', 'Reber', 'Salzmann', 'Bosshard', 'Grob', 'Hasler', 'Koller',
  'Marty', 'Ochsner', 'Saxer', 'Thommen', 'Zehnder', 'Messerli', 'Ryser',
];

const industries = [
  'IT & Software', 'Immobilien', 'Treuhand & Beratung', 'Handwerk & Bau',
  'Gastro & Hotellerie', 'Gesundheit & Medizin', 'Handel & Retail', 'Rechtsberatung',
  'Finanzdienstleistungen', 'Architektur & Design', 'Transport & Logistik',
  'Bildung & Training', 'Versicherungen', 'Personalberatung', 'Industrie & Produktion',
  'Energie & Umwelt', 'Marketing & Kommunikation', 'Automotive',
  'Landwirtschaft', 'Pharma & Biotech',
];

const kantons = [
  'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR',
  'SO', 'BS', 'BL', 'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG',
  'TI', 'VD', 'VS', 'NE', 'GE', 'JU',
];

// Weighted kanton distribution (roughly proportional to population/business density)
const kantonWeights: Record<string, number> = {
  'ZH': 20, 'BE': 13, 'LU': 5, 'UR': 0.5, 'SZ': 2, 'OW': 0.5, 'NW': 0.5,
  'GL': 0.5, 'ZG': 3, 'FR': 3, 'SO': 3, 'BS': 4, 'BL': 3, 'SH': 1,
  'AR': 0.7, 'AI': 0.3, 'SG': 5, 'GR': 2, 'AG': 7, 'TG': 3,
  'TI': 4, 'VD': 8, 'VS': 3, 'NE': 2, 'GE': 6, 'JU': 1,
};

const citiesByKanton: Record<string, string[]> = {
  'ZH': ['Zürich', 'Winterthur', 'Uster', 'Dübendorf', 'Dietikon', 'Wetzikon', 'Kloten', 'Bülach', 'Horgen', 'Wädenswil', 'Adliswil', 'Opfikon', 'Thalwil', 'Illnau-Effretikon', 'Wallisellen'],
  'BE': ['Bern', 'Biel/Bienne', 'Thun', 'Köniz', 'Burgdorf', 'Langenthal', 'Spiez', 'Münsingen', 'Lyss', 'Ittigen', 'Interlaken', 'Muri bei Bern', 'Zollikofen'],
  'LU': ['Luzern', 'Emmen', 'Kriens', 'Horw', 'Ebikon', 'Sursee', 'Hochdorf', 'Rothenburg'],
  'UR': ['Altdorf', 'Erstfeld'],
  'SZ': ['Schwyz', 'Freienbach', 'Küssnacht', 'Einsiedeln'],
  'OW': ['Sarnen', 'Engelberg'],
  'NW': ['Stans', 'Hergiswil'],
  'GL': ['Glarus', 'Netstal'],
  'ZG': ['Zug', 'Baar', 'Cham', 'Steinhausen', 'Risch-Rotkreuz'],
  'FR': ['Fribourg', 'Bulle', 'Villars-sur-Glâne', 'Marly'],
  'SO': ['Solothurn', 'Olten', 'Grenchen', 'Zuchwil'],
  'BS': ['Basel'],
  'BL': ['Liestal', 'Allschwil', 'Reinach', 'Muttenz', 'Binningen', 'Pratteln'],
  'SH': ['Schaffhausen', 'Neuhausen am Rheinfall'],
  'AR': ['Herisau', 'Teufen'],
  'AI': ['Appenzell'],
  'SG': ['St. Gallen', 'Rapperswil-Jona', 'Wil', 'Gossau', 'Buchs', 'Rorschach', 'Uzwil'],
  'GR': ['Chur', 'Davos', 'St. Moritz', 'Landquart', 'Ilanz'],
  'AG': ['Aarau', 'Baden', 'Wettingen', 'Brugg', 'Lenzburg', 'Rheinfelden', 'Zofingen', 'Wohlen', 'Spreitenbach'],
  'TG': ['Frauenfeld', 'Kreuzlingen', 'Amriswil', 'Weinfelden', 'Arbon'],
  'TI': ['Lugano', 'Bellinzona', 'Locarno', 'Mendrisio', 'Chiasso'],
  'VD': ['Lausanne', 'Yverdon-les-Bains', 'Montreux', 'Nyon', 'Renens', 'Morges', 'Vevey'],
  'VS': ['Sion', 'Brig-Glis', 'Visp', 'Sierre', 'Martigny', 'Monthey'],
  'NE': ['Neuchâtel', 'La Chaux-de-Fonds', 'Le Locle'],
  'GE': ['Genève', 'Carouge', 'Lancy', 'Vernier', 'Meyrin', 'Onex'],
  'JU': ['Delémont', 'Porrentruy'],
};

const areaCodeByKanton: Record<string, number> = {
  'ZH': 44, 'BE': 31, 'LU': 41, 'UR': 41, 'SZ': 41, 'OW': 41, 'NW': 41,
  'GL': 55, 'ZG': 41, 'FR': 26, 'SO': 32, 'BS': 61, 'BL': 61, 'SH': 52,
  'AR': 71, 'AI': 71, 'SG': 71, 'GR': 81, 'AG': 62, 'TG': 71,
  'TI': 91, 'VD': 21, 'VS': 27, 'NE': 32, 'GE': 22, 'JU': 32,
};

// PLZ ranges by kanton (approximate)
const plzByKanton: Record<string, [number, number]> = {
  'ZH': [8000, 8999], 'BE': [3000, 3999], 'LU': [6000, 6099], 'UR': [6460, 6490],
  'SZ': [6410, 6443], 'OW': [6060, 6078], 'NW': [6370, 6390], 'GL': [8750, 8784],
  'ZG': [6300, 6349], 'FR': [1700, 1799], 'SO': [4500, 4654], 'BS': [4000, 4059],
  'BL': [4100, 4254], 'SH': [8200, 8260], 'AR': [9040, 9108], 'AI': [9050, 9058],
  'SG': [9000, 9499], 'GR': [7000, 7606], 'AG': [5000, 5746], 'TG': [8500, 8599],
  'TI': [6500, 6999], 'VD': [1000, 1699], 'VS': [1870, 3999], 'NE': [2000, 2325],
  'GE': [1200, 1299], 'JU': [2800, 2942],
};

const streetNames = [
  'Bahnhofstrasse', 'Hauptstrasse', 'Dorfstrasse', 'Kirchgasse', 'Seestrasse',
  'Industriestrasse', 'Gewerbestrasse', 'Ringstrasse', 'Schulstrasse', 'Gartenstrasse',
  'Birkenweg', 'Rosenweg', 'Tannenstrasse', 'Allmendstrasse', 'Lagerstrasse',
  'Bernstrasse', 'Zürichstrasse', 'Poststrasse', 'Marktgasse', 'Bundesstrasse',
  'Grabenstrasse', 'Mühlestrasse', 'Sonnenbergstrasse', 'Waldweg', 'Rebgasse',
  'Aarestrasse', 'Mattenstrasse', 'Wiesenstrasse', 'Unterdorfstrasse', 'Oberdorfstrasse',
  'Neugasse', 'Langstrasse', 'Steinweg', 'Haldenstrasse', 'Feldstrasse',
  'Fabrikstrasse', 'Europastrasse', 'Talstrasse', 'Bergstrasse', 'Panoramaweg',
];

const leadStatuses = ['New Lead', 'Kontaktiert', 'Qualifiziert', 'Angebot gesendet', 'Verhandlung', 'Gewonnen', 'Verloren', 'Kein Interesse'];
const leadStatusWeights = [30, 20, 15, 10, 8, 7, 5, 5];

const quellen = [
  'Google Maps', 'Empfehlung', 'Website', 'LinkedIn', 'Messe',
  'Kaltakquise', 'Social Media', 'Partner', 'Branchenverzeichnis',
];

const notizenPool = [
  'Sehr interessiert an Marketing-Automation',
  'Möchte Angebot per Email',
  'Rückruf vereinbart für nächste Woche',
  'Aktuell zufrieden mit bestehendem Anbieter',
  'Budget vorhanden, Entscheid im Q2',
  'Empfehlung von Firma XY',
  'Hat bereits Website-Relaunch geplant',
  'Wünscht Beratungsgespräch vor Ort',
  'Interessiert an SEO-Paket',
  'Entscheidungsträger ist in den Ferien bis Ende Monat',
  'Braucht Social-Media-Betreuung',
  'Aktuell kein Budget, Follow-up in 6 Monaten',
  'Geschäftsführer wechselt, neuen Kontakt abwarten',
  'Sehr aktiv auf LinkedIn, guter Lead',
  'Zweigstelle in Romandie geplant',
  'Möchte Google Ads starten',
  'Hat negative Google-Bewertungen, braucht Reputation Management',
  'Interessiert an CRM-Integration',
  'Ist bereits Kunde bei Mitbewerber Z',
  'Hohe Affinität zu Digitalisierung',
  'Gründer sehr technikaffin',
  'Firmenjubiläum steht an - Marketing-Push gewünscht',
  'Bereits erstes Meeting gehabt, gutes Feedback',
  'KMU mit 20+ Mitarbeitern, wachsend',
  'Reagiert nur auf persönliche Ansprache',
  'Möchte alles auf Schweizerdeutsch',
  'Bevorzugt Kommunikation per Telefon',
  'Hat aktuell keine Website',
  'Verwendet noch Excel für Kundenverwaltung',
  'Interessiert an automatisierten Offerten',
  'Braucht mehrsprachige Website (DE/FR/IT)',
  'Grosses Wachstumspotenzial, Start-up seit 2023',
  'Franchise-Betrieb, Entscheid zentral in Zürich',
  'Handwerksbetrieb mit Nachfolgeproblem',
  'Sucht Unterstützung bei Google My Business',
  'Möchte Newsletter-System aufbauen',
  'Wartet auf Offerte von Konkurrenzfirma zum Vergleich',
  'Projekt startet erst im Q3',
  'Referenz von bestehender Kundin Frau Müller',
  'War auf Werkpilot-Stand an der Messe in Bern',
];

const activityTypes = ['Anruf', 'Email', 'Meeting', 'Notiz', 'Statusänderung', 'Aufgabe', 'LinkedIn-Nachricht'];

const activityDetailsPool: Record<string, string[]> = {
  'Anruf': [
    'Erstgespräch geführt, gutes Interesse',
    'Anrufbeantworter, Nachricht hinterlassen',
    'Kurzes Telefonat, will Unterlagen per Email',
    'Ausführliches Gespräch (25 Min.), Bedarf identifiziert',
    'Sekretariat erreicht, Rückruf vereinbart',
    'Kein Interesse signalisiert, höflich abgelehnt',
    'Termin für Demo vereinbart nächste Woche',
    'Nachfass-Anruf nach Offerte, Entscheid steht aus',
    'CEO persönlich gesprochen, sehr interessiert',
    'Mehrere Versuche, nicht erreichbar',
  ],
  'Email': [
    'Willkommens-Email mit Fitness-Check gesendet',
    'Angebot als PDF im Anhang verschickt',
    'Follow-up nach Meeting gesendet',
    'Case Study zugestellt',
    'Einladung zum Webinar verschickt',
    'Terminbestätigung gesendet',
    'Nachfass-Email nach 2 Wochen ohne Antwort',
    'Preisliste auf Anfrage zugestellt',
    'Dankesmail nach erstem Gespräch',
    'Informationen zu Referenzkunden geteilt',
  ],
  'Meeting': [
    'Erstberatung vor Ort (1h), Bedarf analysiert',
    'Online-Demo durchgeführt via Teams',
    'Workshop zur Digitalisierungsstrategie',
    'Gemeinsames Mittagessen, Beziehungspflege',
    'Präsentation beim Führungsteam',
    'Follow-up-Meeting nach Testphase',
    'Vertragsverhandlung in Zürich',
    'Kick-off Meeting für neues Projekt',
  ],
  'Notiz': [
    'Lead über Google Maps gefunden, gute Bewertungen',
    'Konkurrenzprodukt im Einsatz, Vertrag läuft aus Q4',
    'Firmengrösse: ca. 15-20 MA',
    'Wachstumsbranche, hohes Potenzial',
    'Entscheider: Geschäftsleitung, kein Einkauf',
    'Saisonales Geschäft, bester Zeitpunkt Frühling',
    'Empfohlen von bestehendem Kunden Herr Steiner',
    'ISO-zertifiziert, legt Wert auf Qualität',
    'Zweite Generation Familienbetrieb',
    'Aktives LinkedIn-Profil, postet regelmässig',
  ],
  'Statusänderung': [
    'Status: New Lead → Kontaktiert',
    'Status: Kontaktiert → Qualifiziert',
    'Status: Qualifiziert → Angebot gesendet',
    'Status: Angebot gesendet → Verhandlung',
    'Status: Verhandlung → Gewonnen',
    'Status: Verhandlung → Verloren',
    'Status: New Lead → Kein Interesse',
    'Status: Kontaktiert → Kein Interesse',
  ],
  'Aufgabe': [
    'Offerte erstellen bis Freitag',
    'Referenzen zusammenstellen',
    'Branchenspezifische Case Study vorbereiten',
    'Termin für Demo koordinieren',
    'Vertragsentwurf prüfen lassen',
    'Unterlagen für Präsentation vorbereiten',
    'Wettbewerbsanalyse durchführen',
    'Follow-up in 2 Wochen einplanen',
  ],
  'LinkedIn-Nachricht': [
    'Vernetzungsanfrage gesendet und angenommen',
    'Nachricht mit Mehrwert-Content geteilt',
    'Kommentar unter Firmenbeitrag hinterlassen',
    'InMail mit personalisierten Referenzen gesendet',
    'Gratulation zum Firmenjubiläum gesendet',
  ],
};

// ---------------------------------------------------------------------------
// Generator Functions
// ---------------------------------------------------------------------------

function generateKanton(): string {
  const kantonKeys = kantons;
  const weights = kantonKeys.map(k => kantonWeights[k] || 1);
  return pickWeighted(kantonKeys, weights);
}

function generateCity(kanton: string): string {
  const cities = citiesByKanton[kanton];
  if (!cities || cities.length === 0) return kanton;
  return pick(cities);
}

function generateCompanyName(): string {
  const prefix = pick(companyPrefixes);
  const suffix = pick(companySuffixes);
  // Sometimes add a second prefix for variety (15% chance)
  if (Math.random() < 0.15) {
    const prefix2 = pick(companyPrefixes);
    if (prefix !== prefix2) {
      return `${prefix} & ${prefix2} ${suffix}`;
    }
  }
  return `${prefix} ${suffix}`;
}

function generateContactName(): string {
  return `${pick(firstNames)} ${pick(lastNames)}`;
}

function generateEmail(firstName: string, lastName: string, companyName: string): string {
  const domain = sanitizeDomain(companyName.split(' ')[0]);
  const fn = sanitizeEmail(firstName.toLowerCase());
  const ln = sanitizeEmail(lastName.toLowerCase());
  // Variation in email format
  const r = Math.random();
  if (r < 0.6) return `${fn}.${ln}@${domain}.ch`;
  if (r < 0.8) return `${fn[0]}.${ln}@${domain}.ch`;
  if (r < 0.9) return `${fn}@${domain}.ch`;
  return `info@${domain}.ch`;
}

function generatePhone(kanton: string): string {
  const areaCode = areaCodeByKanton[kanton] || 44;
  const a = randInt(100, 999);
  const b = randInt(10, 99);
  const c = randInt(10, 99);
  return `+41 ${areaCode} ${a} ${b} ${c}`;
}

function generateWebsite(companyName: string): string {
  const domain = sanitizeDomain(companyName.split(' ')[0]);
  return `www.${domain}.ch`;
}

function generateAddress(kanton: string, city: string): string {
  const street = pick(streetNames);
  const number = randInt(1, 150);
  const [plzMin, plzMax] = plzByKanton[kanton] || [1000, 9999];
  const plz = randInt(plzMin, plzMax);
  return `${street} ${number}, ${plz} ${city}`;
}

function generateLeadScore(): number {
  // Normal distribution centered around 50
  return randNormal(50, 22, 0, 100);
}

function generateFitnessScore(): number {
  return randInt(0, 100);
}

function generateUmsatzpotenzial(): number {
  // Weighted toward 1000-5000 range using normal distribution
  const value = randNormal(3000, 2500, 500, 50000);
  // Round to nearest 500
  return Math.round(value / 500) * 500;
}

function generateGoogleRating(): number | null {
  if (Math.random() < 0.2) return null;
  // Most businesses cluster between 3.5 and 4.8
  const rating = 3.0 + Math.random() * 2.0;
  return Math.round(rating * 10) / 10;
}

function generateGoogleReviews(): number | null {
  if (Math.random() < 0.2) return null;
  // Most have few reviews, some have many (exponential-ish distribution)
  const r = Math.random();
  if (r < 0.5) return randInt(0, 20);
  if (r < 0.8) return randInt(20, 100);
  if (r < 0.95) return randInt(100, 300);
  return randInt(300, 500);
}

function generateNotizen(): string | null {
  if (Math.random() > 0.3) return null;
  // Sometimes combine 2 notes
  if (Math.random() < 0.2) {
    return `${pick(notizenPool)}. ${pick(notizenPool)}.`;
  }
  return pick(notizenPool);
}

function generateCreatedAt(): Date {
  // Spread over the last 12 months
  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  return new Date(oneYearAgo + Math.random() * (now - oneYearAgo));
}

function generateLetzterKontakt(createdAt: Date): Date | null {
  // 60% have a last contact date
  if (Math.random() > 0.6) return null;
  const now = Date.now();
  const createdTs = createdAt.getTime();
  if (createdTs >= now) return createdAt;
  return new Date(createdTs + Math.random() * (now - createdTs));
}

// ---------------------------------------------------------------------------
// Activity Generator
// ---------------------------------------------------------------------------

interface ActivityData {
  type: string;
  details: string;
  createdAt: Date;
}

function generateActivities(leadCreatedAt: Date, leadStatus: string): ActivityData[] {
  const count = randInt(1, 5);
  const activities: ActivityData[] = [];
  const now = Date.now();
  const baseTs = leadCreatedAt.getTime();

  for (let i = 0; i < count; i++) {
    const type = pick(activityTypes);
    const detailsPool = activityDetailsPool[type] || ['Aktivität durchgeführt'];
    const details = pick(detailsPool);
    // Activities happen between lead creation and now
    const ts = baseTs + Math.random() * (now - baseTs);
    activities.push({
      type,
      details,
      createdAt: new Date(ts),
    });
  }

  // Sort by date
  activities.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return activities;
}

// ---------------------------------------------------------------------------
// Lead Record Generator
// ---------------------------------------------------------------------------

interface LeadData {
  firma: string;
  kontakt: string;
  email: string;
  telefon: string;
  website: string;
  adresse: string;
  branche: string;
  kanton: string;
  ort: string;
  status: string;
  leadScore: number;
  fitnessScore: number;
  umsatzpotenzial: number;
  googleRating: number | null;
  googleReviews: number | null;
  notizen: string | null;
  quelle: string;
  letzterKontakt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function generateLead(): LeadData {
  const kanton = generateKanton();
  const city = generateCity(kanton);
  const companyName = generateCompanyName();
  const contactName = generateContactName();
  const [firstName, ...lastParts] = contactName.split(' ');
  const lastName = lastParts.join(' ');
  const createdAt = generateCreatedAt();
  const updatedAt = new Date(
    createdAt.getTime() + Math.random() * (Date.now() - createdAt.getTime())
  );

  return {
    firma: companyName,
    kontakt: contactName,
    email: generateEmail(firstName, lastName, companyName),
    telefon: generatePhone(kanton),
    website: generateWebsite(companyName),
    adresse: generateAddress(kanton, city),
    branche: pick(industries),
    kanton,
    ort: city,
    status: pickWeighted(leadStatuses, leadStatusWeights),
    leadScore: generateLeadScore(),
    fitnessScore: generateFitnessScore(),
    umsatzpotenzial: generateUmsatzpotenzial(),
    googleRating: generateGoogleRating(),
    googleReviews: generateGoogleReviews(),
    notizen: generateNotizen(),
    quelle: pick(quellen),
    letzterKontakt: generateLetzterKontakt(createdAt),
    createdAt,
    updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Main Seed Function
// ---------------------------------------------------------------------------

const TOTAL_LEADS = 10_000;
const BATCH_SIZE = 500;
const ACTIVITY_PROBABILITY = 0.4; // 40% of leads get activities

async function main() {
  console.log('='.repeat(60));
  console.log('  Werkpilot Dashboard - 10K Swiss Lead Seed Script');
  console.log('='.repeat(60));
  console.log();

  const startTime = Date.now();

  // Step 1: Clear existing data
  console.log('[1/4] Clearing existing lead and activity data...');
  await prisma.activity.deleteMany();
  await prisma.lead.deleteMany();
  console.log('       Existing data cleared.\n');

  // Step 2: Generate and insert leads in batches
  console.log(`[2/4] Generating ${TOTAL_LEADS.toLocaleString()} leads in batches of ${BATCH_SIZE}...`);

  const allLeadData: LeadData[] = [];
  for (let i = 0; i < TOTAL_LEADS; i++) {
    allLeadData.push(generateLead());
  }

  let insertedLeads = 0;
  for (let batchStart = 0; batchStart < TOTAL_LEADS; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_LEADS);
    const batch = allLeadData.slice(batchStart, batchEnd);

    await prisma.lead.createMany({
      data: batch.map(lead => ({
        firma: lead.firma,
        kontakt: lead.kontakt,
        email: lead.email,
        telefon: lead.telefon,
        website: lead.website,
        adresse: lead.adresse,
        branche: lead.branche,
        kanton: lead.kanton,
        ort: lead.ort,
        status: lead.status,
        leadScore: lead.leadScore,
        fitnessScore: lead.fitnessScore,
        umsatzpotenzial: lead.umsatzpotenzial,
        googleRating: lead.googleRating,
        googleReviews: lead.googleReviews,
        notizen: lead.notizen,
        quelle: lead.quelle,
        letzterKontakt: lead.letzterKontakt,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      })),
    });

    insertedLeads += batch.length;
    if (insertedLeads % 1000 === 0 || insertedLeads === TOTAL_LEADS) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`       ${insertedLeads.toLocaleString()} / ${TOTAL_LEADS.toLocaleString()} leads inserted (${elapsed}s)`);
    }
  }
  console.log();

  // Step 3: Fetch lead IDs and generate activities for 40% of them
  console.log(`[3/4] Generating activities for ~${Math.round(TOTAL_LEADS * ACTIVITY_PROBABILITY).toLocaleString()} leads...`);

  // Fetch all lead IDs and their creation dates + statuses
  const leads = await prisma.lead.findMany({
    select: { id: true, createdAt: true, status: true },
  });

  const leadsWithActivities = leads.filter(() => Math.random() < ACTIVITY_PROBABILITY);
  let activityCount = 0;
  const activityBatch: { leadId: string; type: string; details: string; createdAt: Date }[] = [];

  for (const lead of leadsWithActivities) {
    const activities = generateActivities(lead.createdAt, lead.status);
    for (const act of activities) {
      activityBatch.push({
        leadId: lead.id,
        type: act.type,
        details: act.details,
        createdAt: act.createdAt,
      });
    }
  }

  // Insert activities in batches
  const ACTIVITY_BATCH_SIZE = 1000;
  for (let i = 0; i < activityBatch.length; i += ACTIVITY_BATCH_SIZE) {
    const batch = activityBatch.slice(i, i + ACTIVITY_BATCH_SIZE);
    await prisma.activity.createMany({ data: batch });
    activityCount += batch.length;
    if (activityCount % 5000 === 0 || i + ACTIVITY_BATCH_SIZE >= activityBatch.length) {
      console.log(`       ${activityCount.toLocaleString()} activities inserted...`);
    }
  }
  console.log();

  // Step 4: Final report
  console.log('[4/4] Verifying final counts...');
  const finalLeadCount = await prisma.lead.count();
  const finalActivityCount = await prisma.activity.count();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log();
  console.log('='.repeat(60));
  console.log('  Seed Complete!');
  console.log('='.repeat(60));
  console.log(`  Leads:      ${finalLeadCount.toLocaleString()}`);
  console.log(`  Activities:  ${finalActivityCount.toLocaleString()}`);
  console.log(`  Duration:    ${elapsed}s`);
  console.log('='.repeat(60));

  // Print status distribution
  console.log('\n  Status Distribution:');
  for (const status of leadStatuses) {
    const count = await prisma.lead.count({ where: { status } });
    const pct = ((count / finalLeadCount) * 100).toFixed(1);
    console.log(`    ${status.padEnd(20)} ${count.toString().padStart(5)} (${pct}%)`);
  }

  // Print top 5 kantons
  console.log('\n  Top 5 Kantons:');
  const kantonCounts: { kanton: string; count: number }[] = [];
  for (const k of kantons) {
    const count = await prisma.lead.count({ where: { kanton: k } });
    kantonCounts.push({ kanton: k, count });
  }
  kantonCounts.sort((a, b) => b.count - a.count);
  for (const { kanton, count } of kantonCounts.slice(0, 5)) {
    const pct = ((count / finalLeadCount) * 100).toFixed(1);
    console.log(`    ${kanton.padEnd(5)} ${count.toString().padStart(5)} (${pct}%)`);
  }

  // Print top 5 industries
  console.log('\n  Top 5 Industries:');
  const industryCounts: { branche: string; count: number }[] = [];
  for (const b of industries) {
    const count = await prisma.lead.count({ where: { branche: b } });
    industryCounts.push({ branche: b, count });
  }
  industryCounts.sort((a, b) => b.count - a.count);
  for (const { branche, count } of industryCounts.slice(0, 5)) {
    const pct = ((count / finalLeadCount) * 100).toFixed(1);
    console.log(`    ${branche.padEnd(28)} ${count.toString().padStart(5)} (${pct}%)`);
  }

  console.log();
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
