# WERKPILOT.CH — PHASE 1: WEBSITE BUILD (YOLO MODE)

## MISSION
Build the complete Werkpilot.ch website from scratch. This is a premium Swiss B2B agency website that sells AI-powered backoffice services to Swiss SMEs (KMUs). The website must score 100/100 on ALL Lighthouse metrics and be production-ready.

## STEP 0: PROJECT SETUP
```
mkdir -p ~/Downloads/werkpilot
cd ~/Downloads/werkpilot
npx create-next-app@latest werkpilot-website --typescript --tailwind --eslint --app --src-dir --no-import-alias
cd werkpilot-website
npm install sharp next-sitemap framer-motion
```

## STEP 1: LIGHTHOUSE 100/100 REQUIREMENTS

### Performance (100/100)
- Use Next.js App Router with Server Components (RSC) by default
- ALL images: Use `next/image` with WebP/AVIF, explicit width/height, lazy loading, blur placeholder
- Zero layout shift (CLS = 0): Set explicit dimensions on every media element
- Font: Use `next/font/google` with `display: swap` and `preload: true` — choose "Plus Jakarta Sans" for headings, "DM Sans" for body
- Inline critical CSS, defer non-critical
- No third-party scripts on initial load — defer analytics, chat widgets behind user interaction
- Prefetch visible links with `<Link prefetch>`
- Use dynamic imports for below-fold components: `const Section = dynamic(() => import('./Section'))`
- Minify everything, tree-shake unused code
- Target LCP < 1.2s, FID < 50ms, CLS < 0.01

### Accessibility (100/100)
- Semantic HTML: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`
- ARIA labels on all interactive elements
- Color contrast ratio ≥ 4.5:1 for body text, ≥ 3:1 for large text
- Focus indicators on all interactive elements (visible focus ring)
- Alt text on every image
- Skip-to-content link as first focusable element
- Keyboard navigable: Tab through all elements, Enter/Space to activate
- `lang="de"` on `<html>` tag (with hreflang alternatives)
- Heading hierarchy: Only one `<h1>` per page, sequential `<h2>`, `<h3>`

### Best Practices (100/100)
- HTTPS only (handled by deployment)
- No `console.log` in production
- No deprecated APIs
- CSP headers in next.config.js
- Correct `robots.txt` and `sitemap.xml` via next-sitemap

### SEO (100/100)
- Unique `<title>` and `<meta description>` per page
- Open Graph tags (og:title, og:description, og:image, og:url)
- Twitter Card meta tags
- Canonical URLs on every page
- Structured data (JSON-LD): Organization, Service, FAQ, BreadcrumbList
- hreflang tags for DE, FR, IT, EN
- `sitemap.xml` auto-generated via next-sitemap
- `robots.txt` allowing all crawlers
- Clean URL structure: `/dienstleistungen`, `/preise`, `/kontakt`

## STEP 2: SITE ARCHITECTURE

```
/                           → Homepage (DE) — Hero, Services Overview, Social Proof, CTA
/dienstleistungen           → Services page with 3 packages
/dienstleistungen/kunden-gewinnen    → Package 1 detail
/dienstleistungen/effizienz          → Package 2 detail
/dienstleistungen/wachstum           → Package 3 detail
/preise                     → Pricing page
/ueber-uns                  → About / Trust page
/kontakt                    → Contact + Lead form
/blog                       → Blog listing (SEO content)
/fitness-check              → Free Digital Fitness Check (Lead Magnet)
/impressum                  → Legal (Impressum — Swiss law requirement)
/datenschutz                → Privacy policy
```

## STEP 3: DESIGN SYSTEM

### Brand Identity
- **Positioning**: Premium Swiss agency, NOT a tech startup. Think "your trusted business partner" not "AI tool"
- **Tone**: Professional, warm, competent, Swiss-quality. Never say "AI" prominently.
- **Tagline**: "Mehr Kunden. Weniger Admin. Ihr virtuelles Backoffice."
- **Secondary tagline**: "Werkpilot — Das Betriebssystem für Schweizer KMUs"

### Colors (CSS Variables)
```css
--color-primary: #1B2A4A;      /* Deep navy — trust, premium */
--color-accent: #2E75B6;       /* Swiss blue — action, links */
--color-success: #2D8C3C;      /* Alpine green — growth, results */
--color-warm: #D4760A;         /* Warm amber — energy, CTAs */
--color-bg: #FAFAF9;           /* Warm off-white */
--color-surface: #FFFFFF;
--color-text: #1A1A1A;
--color-text-secondary: #666666;
--color-border: #E5E7EB;
```

### Typography
- Headings: "Plus Jakarta Sans", bold, tight tracking (-0.02em)
- Body: "DM Sans", regular, 16px base, 1.7 line-height
- Never use generic system fonts

### Design Rules
- Generous whitespace (sections: 120px padding vertical)
- Max content width: 1200px
- Cards: 16px border-radius, subtle shadow (0 1px 3px rgba(0,0,0,0.08))
- CTAs: Warm amber (#D4760A) buttons with hover animation
- Swiss flag/cross icon subtly integrated (NOT as main graphic)
- NO stock photos of people. Use abstract geometric patterns, data visualizations, or clean icons
- Subtle grain texture overlay on hero section
- Scroll-triggered animations (fade-in-up) using framer-motion with `whileInView`

## STEP 4: HOMEPAGE SECTIONS (in order)

### 1. Navigation
- Sticky, blurred background on scroll
- Logo: "Werkpilot" in Plus Jakarta Sans bold + small Swiss cross icon
- Links: Dienstleistungen, Preise, Über uns, Blog, Kontakt
- CTA button: "Gratis Fitness-Check →"
- Mobile: Hamburger menu with smooth slide-in

### 2. Hero Section
- Headline: "Ihr Unternehmen verdient ein Team, das nie schläft."
- Subheadline: "Werkpilot übernimmt Marketing, Sales, Admin und mehr — damit Sie sich auf Ihr Kerngeschäft konzentrieren können."
- Primary CTA: "Gratis Digital-Fitness-Check starten →" (amber button)
- Secondary CTA: "So funktioniert's ↓" (text link)
- Background: Subtle animated gradient mesh (CSS only, no JS animation for performance)
- Trust bar below hero: "Vertrauen von 50+ Schweizer KMUs" with logos or trust badges

### 3. Problem Section
- Headline: "Kennen Sie das?"
- 3 pain points in cards:
  - "Sie wissen, dass Sie online mehr Kunden gewinnen könnten — aber wer soll das machen?"
  - "Administration frisst Ihre Zeit — statt dass Sie sich auf Kunden konzentrieren"
  - "Marketing-Agenturen sind teuer und liefern oft nicht was sie versprechen"

### 4. Solution Section
- Headline: "Werkpilot: Ihr komplettes Backoffice — ohne die Kosten eines Teams"
- Visual: Animated counter/stats
  - "43 Spezialisten arbeiten für Sie" (counter animation)
  - "24/7 im Einsatz"
  - "Ab CHF 1'500/Monat"
- 3 Package preview cards linking to detail pages

### 5. How It Works
- 3-step process:
  1. "Gratis Analyse" — Wir analysieren Ihre Online-Präsenz und zeigen Ihnen konkret wo Sie Kunden verlieren
  2. "Massgeschneiderter Plan" — Sie wählen was Sie brauchen: Kunden gewinnen, Effizienz, oder Wachstum
  3. "Wir legen los" — Innerhalb von 48h arbeitet Ihr Werkpilot-Team für Sie — messbar und transparent

### 6. Results / Social Proof
- Headline: "Ergebnisse die für sich sprechen"
- Metrics grid: "+340% mehr Website-Traffic", "+12 neue Anfragen/Monat", "20h Admin-Arbeit gespart"
- 2-3 Testimonial cards (initially use placeholder, realistic Swiss names)
- "Wie Treuhand Müller in 3 Monaten 40% mehr Mandanten gewann" — case study teaser

### 7. Services Overview
- 3 packages as visual cards:
  - "Kunden gewinnen" — CHF 2'000/Mo — SEO, Content, Social Media, Email Marketing
  - "Effizienz" — CHF 1'500/Mo — Prozess-Automation, Kommunikation, Reporting
  - "Wachstum" — CHF 5'000/Mo — Alles + Strategie, Analytics, Expansion
- "Alle Pakete vergleichen →" link

### 8. Trust Section
- Swiss quality badges/icons
- "100% Schweizer Unternehmen"
- "Ihre Daten bleiben in der Schweiz"
- "30 Tage Geld-zurück-Garantie"
- "Keine Mindestlaufzeit"

### 9. FAQ
- 6-8 FAQs in accordion (with JSON-LD structured data)
- Key questions: "Was genau macht Werkpilot?", "Ersetzt das meine Mitarbeiter?", "Wie schnell sehe ich Resultate?", "Was kostet das?", "Sind meine Daten sicher?", "Kann ich jederzeit kündigen?"

### 10. Final CTA
- Full-width section with gradient background
- "Bereit für mehr Kunden und weniger Stress?"
- "Starten Sie mit einem gratis Digital-Fitness-Check"
- Large amber CTA button
- "Unverbindlich. In 2 Minuten erledigt."

### 11. Footer
- Werkpilot logo + short description
- Navigation links
- Contact: info@werkpilot.ch, Swiss phone number placeholder
- "Ein Schweizer Unternehmen. Eingetragen als Einzelfirma."
- Social links: LinkedIn
- © 2026 Werkpilot. Alle Rechte vorbehalten.

## STEP 5: LEAD MAGNET — DIGITAL FITNESS CHECK PAGE (/fitness-check)

Build a multi-step form (3 steps):
1. Company info: Firmenname, Website-URL, Branche (dropdown), Kanton (dropdown)
2. Current situation: "Haben Sie einen Blog?", "Nutzen Sie Social Media?", "Wie viele Neukunden/Monat?"
3. Contact: Name, Email, Telefon (optional)

On submit: Thank you page with "Ihr Report wird in den nächsten 24 Stunden per Email zugestellt."
Store submissions in a JSON file (later: Airtable webhook)

## STEP 6: TECHNICAL REQUIREMENTS

### next.config.js
```javascript
const nextConfig = {
  images: { formats: ['image/avif', 'image/webp'] },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
};
```

### Sitemap (next-sitemap.config.js)
```javascript
module.exports = {
  siteUrl: 'https://werkpilot.ch',
  generateRobotsTxt: true,
  changefreq: 'weekly',
  priority: 0.7,
};
```

## STEP 7: VALIDATION CHECKLIST

After building, run and fix until ALL pass:
1. `npm run build` — Zero errors, zero warnings
2. `npx next lint` — Clean
3. Lighthouse CI: `npx lighthouse http://localhost:3000 --output=json` — ALL 100
4. Check every page for:
   - [ ] Correct `<title>` and `<meta description>`
   - [ ] JSON-LD structured data
   - [ ] All images have alt text
   - [ ] No console errors
   - [ ] Responsive on mobile (375px) and desktop (1440px)
   - [ ] All CTAs link to /fitness-check
   - [ ] Form submission works

## EXECUTION ORDER
1. Set up project with all dependencies
2. Build the design system (globals.css, fonts, components)
3. Build layout (nav + footer)
4. Build homepage sections top to bottom
5. Build /fitness-check page
6. Build /dienstleistungen, /preise, /kontakt pages
7. Build /impressum, /datenschutz
8. Add JSON-LD structured data
9. Add sitemap + robots.txt
10. Run Lighthouse, fix any issues until 100/100
11. Final `npm run build` — must succeed with zero errors

START NOW. Build everything. Do not ask for confirmation. Commit after each major section.
