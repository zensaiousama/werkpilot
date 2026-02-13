# WERKPILOT — PHASE 3: 42 AI AGENT BUILD PROMPTS (YOLO MODE)

## HOW TO USE
Each agent below is a separate Claude Code YOLO prompt. Run them sequentially or in parallel.
Each agent creates its own folder inside `~/Downloads/werkpilot/agents/`.
After all agents are built, run the ORCHESTRATOR prompt (Agent #43) to wire them all together.

---
## MASTER SETUP (Run first)
```
cd ~/Downloads/werkpilot
mkdir -p agents/{ceo,sales,marketing,product,operations,finance,strategy,hr,it}
mkdir -p agents/shared/{prompts,templates,configs,utils}
npm init -y
npm install @anthropic-ai/sdk openai node-cron nodemailer axios cheerio puppeteer csv-parse airtable dotenv zod winston
touch .env
echo "ANTHROPIC_API_KEY=your-key-here" >> .env
echo "AIRTABLE_API_KEY=your-key-here" >> .env
echo "AIRTABLE_BASE_ID=your-base-here" >> .env
echo "DEEPL_API_KEY=your-key-here" >> .env
echo "MAILERLITE_API_KEY=your-key-here" >> .env
echo "GMAIL_USER=info@werkpilot.ch" >> .env
echo "GMAIL_APP_PASSWORD=your-app-password" >> .env
```

---

# ═══════════════════════════════════════════════
# DEPARTMENT 1: CEO / EXECUTIVE OFFICE (3 Agents)
# ═══════════════════════════════════════════════

## AGENT 01 — Morning Briefing Agent
```
cd ~/Downloads/werkpilot/agents/ceo

Create a Morning Briefing Agent in Node.js (morning-briefing.js) that:

1. Runs every day at 06:30 via node-cron
2. Collects data from ALL other agents' log files and Airtable:
   - Revenue: New invoices, payments received, MRR change
   - Sales: Emails sent, responses, new leads, pipeline changes
   - Marketing: Email open rates, new subscribers, social engagement
   - Operations: Tasks completed, errors, SLA breaches
   - Finance: Outstanding invoices, overdue payments, cash position
3. Calls Claude API to generate a concise executive briefing in German
4. Includes a "Decision Queue" — 2-5 items that need the CEO's input, each with Options A/B/C and a recommendation
5. Sends the briefing via email (nodemailer) to the CEO
6. Saves the briefing as markdown in agents/ceo/briefings/YYYY-MM-DD.md
7. Format: Clean, scannable, with emojis for quick visual parsing
8. Include a "Night Shift Report" section summarizing Claude Code's overnight work (reads git log)

Create also: config.json with all data source paths, email settings, schedule.
Create also: templates/briefing-template.md with the email structure.
Test with mock data. Make it production-ready.
```

## AGENT 02 — Decision Support Agent
```
cd ~/Downloads/werkpilot/agents/ceo

Create a Decision Support Agent (decision-support.js) that:

1. Monitors a "decisions" table in Airtable for new entries
2. When a decision request comes in (from any agent or manually):
   - Gathers all relevant context from Airtable and agent logs
   - Calls Claude API to analyze the situation
   - Generates 2-3 options with pros/cons and impact analysis
   - Recommends one option with reasoning
   - Sends formatted decision card via email
3. When CEO responds (A/B/C via email reply or Airtable), triggers the appropriate action
4. Logs all decisions + outcomes for learning over time
5. Decision categories: Client issues, Pricing changes, Agent errors, Strategic choices, Partnerships

Create: decisions-schema.json for Airtable table structure
Create: action-handlers/ folder with handler for each decision type
```

## AGENT 03 — Productivity Agent
```
cd ~/Downloads/werkpilot/agents/ceo

Create a Productivity Agent (productivity.js) that:

1. Manages the CEO's weekly schedule template:
   - Monday: Strategy & Planning
   - Tuesday: Client Development
   - Wednesday: Product & Engineering
   - Thursday: Growth & Marketing
   - Friday: Analytics & Review
2. Sends daily focus reminder at 08:00 with today's theme + top 3 priorities
3. Tracks time spent per category (via simple time-tracking API)
4. Weekly review every Friday at 16:00: What worked, what didn't, adjust next week
5. "Delegation Check": If CEO spends >30min on a task, asks "Can an agent handle this?"
6. Integrates with Google Calendar API to check conflicts
```

---

# ═══════════════════════════════════════════════
# DEPARTMENT 2: SALES / REVENUE (5 Agents)
# ═══════════════════════════════════════════════

## AGENT 04 — Key Account Agent
```
cd ~/Downloads/werkpilot/agents/sales

Create a Key Account Management Agent (key-account.js) that:

1. Monitors all active clients in Airtable (status = "Client")
2. Tracks usage patterns: Are they using all services? Approaching limits?
3. Auto-generates monthly client health report per client
4. Triggers upsell alerts when:
   - Client approaches word/content limit
   - Client's website traffic grows (they need more)
   - Contract renewal is 30 days away
5. Generates personalized upsell email drafts (Claude API)
6. Sends proactive check-in emails every 2 weeks: "Wie läuft es? Können wir etwas verbessern?"
7. Tracks NPS scores and flags clients with NPS < 7
8. Alerts CEO if any client shows churn signals (decreased usage, complaints, late payments)
```

## AGENT 05 — New Business / Acquisition Agent
```
cd ~/Downloads/werkpilot/agents/sales

Create a New Business Agent (new-business.js) that:

1. Reads leads from Airtable CRM (status = "New Lead" or "Researched")
2. For each lead, generates a personalized cold email using Claude API:
   - References their specific business (from CRM notes)
   - Mentions a concrete problem found in their Digital Fitness Check
   - Offers the free Fitness Check as CTA
   - Written in their language (DE/FR/IT based on Kanton)
3. Email templates: Initial, Follow-up 1 (Day 3), Follow-up 2 (Day 7), Follow-up 3 (Day 14), Breakup (Day 21)
4. Sends via nodemailer with rate limiting (max 50/day initially)
5. Tracks opens/clicks via pixel tracking or Mailerlite integration
6. Auto-updates CRM status after each touchpoint
7. Respects Swiss anti-spam law: Only B2B, always include unsubscribe, identify sender
8. Personalizes subject line per industry: Treuhänder, Zahnarzt, Immobilien, Anwalt, Handwerker

Create: templates/ folder with email templates per industry and language
Create: follow-up-sequences.json defining the timing and logic
```

## AGENT 06 — Partnership Agent
```
cd ~/Downloads/werkpilot/agents/sales

Create a Partnership Agent (partnerships.js) that:

1. Identifies potential partners from a curated list:
   - Marketing agencies (they need execution capacity)
   - Web design studios (they don't do ongoing marketing)
   - Treuhand-Verbände (referral partnerships)
   - Business consultants
2. Generates partnership pitch emails via Claude API
3. Manages a partnerships table in Airtable
4. Proposes partnership models: Referral fee (20%), white-label, co-marketing
5. Tracks partnership pipeline: Identified → Contacted → Meeting → Agreement → Active
```

## AGENT 07 — Pricing Engine Agent
```
cd ~/Downloads/werkpilot/agents/sales

Create a Pricing Engine (pricing-engine.js) that:

1. Calculates dynamic quotes based on:
   - Client industry (Treuhänder = higher willingness to pay)
   - Kanton (Zürich = premium, rural = lower)
   - Scope of services requested
   - Number of languages needed
   - Urgency (rush = +30%)
2. Maintains pricing rules in a JSON config
3. Generates PDF quotes via puppeteer with Werkpilot branding
4. A/B tests pricing (tracks which price points convert best)
5. Provides pricing recommendations to CEO based on market data
6. Exports: pricing-config.json, quote-template.html
```

## AGENT 08 — Inside Sales Bot Agent
```
cd ~/Downloads/werkpilot/agents/sales

Create a Website Chat/Sales Bot (inside-sales-bot.js) that:

1. Serves as API backend for the website chat widget
2. Uses Claude API to answer visitor questions in real-time
3. Knowledge base: Services, pricing, FAQ, process, about Werkpilot
4. Qualification flow: Asks company name, industry, biggest challenge
5. If qualified: Offers to book a call (generates Calendly-style link)
6. If not ready: Offers the free Fitness Check
7. Logs all conversations to Airtable for follow-up
8. Responds in DE, FR, IT, or EN based on detected language
9. Escalation: If question is too complex, creates a task for CEO

Create: knowledge-base.json with all FAQ and product info
Create: qualification-rules.json with scoring criteria
Create: api/chat endpoint (Express.js) for the website widget
```

---

# ═══════════════════════════════════════════════
# DEPARTMENT 3: MARKETING (5 Agents)
# ═══════════════════════════════════════════════

## AGENT 09 — Performance Marketing Agent
```
cd ~/Downloads/werkpilot/agents/marketing

Create a Performance Marketing Agent (performance-marketing.js) that:

1. Manages Google Ads campaigns via API (prepare structure, actual API later)
2. Keyword management: Maintains list of target keywords per industry/language
3. Ad copy generation: Uses Claude API to generate ad variants
4. Budget optimization: Tracks CPC, CPA, ROAS per campaign
5. Weekly report: Performance by campaign, recommendations for next week
6. Competitor ad monitoring: Tracks competitor ad copy changes
7. Landing page recommendations: Which landing page converts best for which keyword

Create: campaigns/ folder with campaign configs per industry
Create: keywords/ folder with keyword lists per industry and language
```

## AGENT 10 — Brand Marketing Agent
```
cd ~/Downloads/werkpilot/agents/marketing

Create a Brand Marketing Agent (brand-marketing.js) that:

1. Maintains brand guidelines: Voice, tone, colors, fonts, imagery rules
2. Reviews ALL content from other agents for brand consistency (Claude API)
3. Brand voice rules: Professional but warm, Swiss-quality, never say "AI" to customers, use "wir" not "unser System"
4. Generates brand assets: Email signatures, presentation templates, letterheads
5. Monitors brand mentions online (Google Alerts integration placeholder)
6. Creates seasonal campaign briefs: Jahresabschluss, Frühling-Offensive, Messezeit

Create: brand-guidelines.json with complete brand rules
Create: templates/ with email signature HTML, letterhead, etc.
```

## AGENT 11 — PR / Media Agent
```
cd ~/Downloads/werkpilot/agents/marketing

Create a PR Agent (pr-media.js) that:

1. Generates press releases for milestones (10 clients, 50 clients, new service launch)
2. Maintains a journalist/media contact database in Airtable
3. Pitches stories to Swiss business media: Handelszeitung, Bilanz, NZZ, PME Magazine
4. Creates thought leadership content: "Die Zukunft der Schweizer KMU-Landschaft"
5. Monitors media for relevant mentions and industry news
6. Press kit: Company description, founder bio, key stats, logos

Create: press-kit/ folder with all materials
Create: media-contacts.json placeholder
```

## AGENT 12 — Content Agent
```
cd ~/Downloads/werkpilot/agents/marketing

Create a Content Agent (content-engine.js) that:

1. Generates 8-12 blog articles per month using Claude API:
   - SEO-optimized for target keywords
   - Written in natural Swiss German (not Hochdeutsch)
   - Includes meta title, meta description, slug, categories, tags
   - Formats in Markdown, ready for WordPress/Next.js
2. Content calendar: Plans topics 4 weeks ahead based on keyword research
3. Content types: How-to guides, case studies, industry insights, comparison posts
4. Automatic internal linking between related articles
5. Generates social media snippets from each article (for Social Media Agent)
6. Multi-language: Creates DE version first, then generates FR and EN variants
7. Quality check: Readability score, keyword density, uniqueness check

Create: content-calendar.json with planned topics
Create: output/ folder for generated articles
Create: seo-keywords.json with target keywords per industry
```

## AGENT 13 — CRM / Email Marketing Agent
```
cd ~/Downloads/werkpilot/agents/marketing

Create an Email Marketing Agent (email-marketing.js) that:

1. Manages Mailerlite via API:
   - Subscriber management (add, tag, segment)
   - Campaign creation and sending
   - Automation sequences
2. Email sequences:
   - Welcome (5 emails over 10 days): Value, Case Study, Social Proof, Offer, Follow-up
   - Nurture (weekly newsletter): Tips, insights, industry news
   - Upsell (trigger-based): When client approaches limit
   - Re-engagement (for cold leads): After 30 days inactive
   - Onboarding (for new clients): First 7 days setup guide
3. Generates all email content via Claude API in the brand voice
4. A/B tests subject lines automatically
5. Segments by: Language, Industry, Engagement level, Client status
6. Reports: Open rates, click rates, conversion rates, unsubscribes
7. Auto-cleans list: Removes bounces, unsubscribes, 90-day inactive

Create: sequences/ folder with email sequence definitions
Create: templates/ folder with email HTML templates
```

---

# ═══════════════════════════════════════════════
# DEPARTMENT 4: PRODUCT / SERVICE (5 Agents)
# ═══════════════════════════════════════════════

## AGENT 14 — Product Strategy Agent
```
cd ~/Downloads/werkpilot/agents/product

Create a Product Strategy Agent (product-strategy.js) that:

1. Maintains the product roadmap in Airtable
2. Collects feature requests from: Client feedback, Sales conversations, Support tickets
3. Prioritizes features using RICE scoring (Reach, Impact, Confidence, Effort)
4. Generates monthly product report: What shipped, what's next, customer feedback themes
5. Monitors competitor features (tracks competitor websites weekly for changes)
6. Proposes new service packages based on demand patterns
7. Tracks feature adoption: Which services do clients actually use?

Create: roadmap-schema.json for Airtable
Create: competitors.json with competitor URLs to monitor
```

## AGENT 15 — Innovation Agent
```
cd ~/Downloads/werkpilot/agents/product

Create an Innovation Agent (innovation.js) that:

1. Scans for new AI models, tools, and APIs weekly (RSS feeds, Product Hunt, Hacker News)
2. Evaluates new tools: Could this improve quality, speed, or reduce costs?
3. Runs benchmark tests: Compare Claude vs GPT vs DeepL for specific tasks
4. Proposes experiments: "What if we tried [X] for [Y]?"
5. Manages A/B tests for prompt variations
6. Tracks AI cost per task and optimizes for cost-efficiency
7. Monthly innovation report to CEO

Create: benchmarks/ folder for test results
Create: experiments.json tracking active experiments
```

## AGENT 16 — Customer Experience Agent
```
cd ~/Downloads/werkpilot/agents/product

Create a CX Agent (customer-experience.js) that:

1. Maps the complete customer journey: Awareness → Consideration → Purchase → Onboarding → Active → Expansion → Advocacy
2. Sends NPS survey to every client monthly (simple 1-10 + comment)
3. Analyzes NPS responses via Claude API for sentiment and actionable insights
4. Churn prediction: Flags clients with declining engagement, late payments, or low NPS
5. Onboarding flow management: Ensures every new client completes setup within 48h
6. Customer health scoring: Green (happy), Yellow (at risk), Red (churn risk)
7. Generates intervention recommendations for Yellow/Red clients

Create: journey-map.json with all touchpoints
Create: nps-survey-template.html
```

## AGENT 17 — Pricing Strategy Agent
```
cd ~/Downloads/werkpilot/agents/product

Create a Pricing Strategy Agent (pricing-strategy.js) that:

1. Analyzes competitor pricing monthly (web scraping competitor websites)
2. Tracks price sensitivity: Which price points convert best? At what price do prospects drop off?
3. Calculates customer lifetime value (LTV) per industry/package
4. Recommends pricing changes based on data
5. Models impact of price changes: "If we increase Package A by 10%, projected impact is..."
6. Manages promotional pricing: When to offer discounts, for whom, how much

Create: competitor-pricing.json
Create: pricing-models/ folder with calculation scripts
```

## AGENT 18 — Quality Management Agent
```
cd ~/Downloads/werkpilot/agents/product

Create a Quality Management Agent (quality-management.js) that:

1. Reviews ALL outputs from ALL agents before delivery to clients
2. Quality checks:
   - Content: Grammar, spelling, brand voice, factual accuracy (Claude API second pass)
   - SEO: Keyword presence, meta tags, readability score
   - Emails: Subject line quality, CTA clarity, mobile rendering
   - Reports: Data accuracy, formatting, completeness
3. Maintains quality score per agent (0-100)
4. Flags any output below 85/100 for review
5. Weekly quality report: Average scores, trends, problem areas
6. Feedback loop: Sends improvement suggestions to each agent

Create: quality-rules.json with check criteria per content type
Create: quality-log.json tracking all reviews
```

---

# ═══════════════════════════════════════════════
# DEPARTMENT 5: OPERATIONS (5 Agents)
# ═══════════════════════════════════════════════

## AGENT 19 — Translation Engine Agent
```
cd ~/Downloads/werkpilot/agents/operations

Create a Translation Engine (translation-engine.js) that:

1. Accepts documents via API endpoint or Airtable trigger
2. Pipeline: Detect language → Translate (DeepL API) → Localize (Claude API for Swiss specifics) → Format → QA → Deliver
3. Swiss localization rules:
   - DE: "Grüezi" not "Hallo", "ss" not "ß", Swiss date format (DD.MM.YYYY), CHF not EUR, Swiss phone format (+41...)
   - FR: Swiss French conventions, "nonante" vs "quatre-vingt-dix" etc.
   - IT: Ticinese Italian conventions
4. Supports formats: Plain text, DOCX, PDF, HTML, Markdown
5. Customer glossary management: Each client can have custom terminology
6. Tracks words translated, cost per word, quality scores
7. Output: Translated document in original format + quality report

Create: localization-rules/ folder with rules per language
Create: glossaries/ folder for client-specific terminology
```

## AGENT 20 — Process Automation Agent
```
cd ~/Downloads/werkpilot/agents/operations

Create a Process Automation Agent (process-automation.js) that:

1. Orchestrates workflows between agents using a task queue
2. Workflow definitions in YAML:
   - New Lead: Scrape → Score → Fitness Check → CRM Update → Email
   - New Client: Onboard → Setup Services → First Report → Check-in
   - Content Publish: Write → QA → SEO Check → Publish → Social Share
3. Monitors task queue: Pending, In Progress, Completed, Failed
4. Auto-retries failed tasks (max 3 attempts)
5. SLA monitoring: Alert if any task exceeds expected duration
6. Dashboard data: Tasks completed today, average processing time, error rate

Create: workflows/ folder with YAML workflow definitions
Create: task-queue.js with Redis-like in-memory queue
```

## AGENT 21 — Capacity Planning Agent
```
cd ~/Downloads/werkpilot/agents/operations

Create a Capacity Planning Agent (capacity-planning.js) that:

1. Tracks API usage across all agents: Claude API, DeepL API, Mailerlite, etc.
2. Predicts API costs for next month based on client growth
3. Alerts when approaching rate limits or budget caps
4. Optimizes: Suggests using cheaper models for simple tasks (Haiku for QA, Sonnet for content)
5. Manages API key rotation and backup keys
6. Peak detection: Identifies high-load periods and suggests scheduling
7. Cost report: Daily/weekly/monthly API spend breakdown by agent

Create: api-usage-tracker.js
Create: budget-config.json with monthly limits per API
```

## AGENT 22 — Service Quality Agent
```
cd ~/Downloads/werkpilot/agents/operations

Create a Service Quality Agent (service-quality.js) that:

1. Real-time monitoring of all client deliverables
2. SLA tracking: Content delivered on time? Reports accurate? Emails sent on schedule?
3. Client feedback integration: Processes feedback from NPS, emails, support tickets
4. Complaint handling: Auto-categorizes, assigns severity, triggers response
5. Quality trends: Is quality improving or declining? Per agent, per client, per service
6. Benchmarking: How do we compare to industry standards?
7. Generates monthly quality report for CEO

Create: sla-definitions.json with SLA per service type
Create: complaint-categories.json
```

## AGENT 23 — Infrastructure Agent
```
cd ~/Downloads/werkpilot/agents/operations

Create an Infrastructure Agent (infrastructure.js) that:

1. Monitors all services: Website uptime, API health, email deliverability
2. Health checks every 5 minutes on critical endpoints
3. Alerts via email/Slack if any service goes down
4. Backup management: Ensures daily backups of Airtable data, content, configs
5. Security: Checks for exposed API keys, reviews access logs
6. SSL certificate expiry monitoring
7. Performance monitoring: Website speed, API response times
8. Auto-restart scripts for crashed agent processes

Create: health-checks.json with all endpoints to monitor
Create: backup.js for automated Airtable backup
```

---

# ═══════════════════════════════════════════════
# DEPARTMENT 6: FINANCE (5 Agents)
# ═══════════════════════════════════════════════

## AGENT 24 — Controlling Agent
```
cd ~/Downloads/werkpilot/agents/finance

Create a Controlling Agent (controlling.js) that:

1. Tracks P&L per client, per service, per industry
2. Calculates: Revenue, COGS (API costs), Gross Margin, Net Margin per client
3. Unit economics: Cost per lead, cost per acquisition, customer lifetime value
4. Margin analysis: Which clients/industries are most profitable?
5. Monthly P&L statement generation (Markdown + PDF)
6. Budget vs Actual tracking
7. Alerts when margins drop below threshold (e.g., <80%)

Create: financial-models/ with calculation templates
Create: reports/ for generated financial reports
```

## AGENT 25 — FP&A Agent (Forecasting)
```
cd ~/Downloads/werkpilot/agents/finance

Create an FP&A Agent (fpa.js) that:

1. Revenue forecasting: Based on pipeline, conversion rates, churn, expansion
2. Cash flow projection: 30, 60, 90 day forward-looking
3. Scenario modeling: Best case, expected, worst case
4. Growth metrics: MRR, ARR, MoM growth, net revenue retention
5. Cohort analysis: How do different client cohorts perform over time?
6. Board-ready metrics dashboard data (for potential investors later)
7. Monthly forecast report to CEO

Create: forecast-models/ with calculation scripts
```

## AGENT 26 — Treasury Agent
```
cd ~/Downloads/werkpilot/agents/finance

Create a Treasury Agent (treasury.js) that:

1. Generates QR-Rechnungen (Swiss QR Bill standard) using swiss-qr-bill library
2. Sends invoices automatically after service delivery
3. Payment tracking: Matches bank statements with invoices
4. Dunning process: Reminder at 15 days, 30 days, 45 days overdue
5. Each reminder escalates in tone (friendly → firm → final warning)
6. Exports for Treuhand: CSV compatible with Bexio/Abacus
7. MWST tracking: Prepares VAT declaration data (when >CHF 100k revenue)

Create: invoice-template.html with QR Bill
Create: dunning-templates/ with 3 escalation levels
npm install swissqrbill
```

## AGENT 27 — Fundraising Agent
```
cd ~/Downloads/werkpilot/agents/finance

Create a Fundraising Agent (fundraising.js) that:

1. Maintains an investor-ready data room in Airtable
2. Auto-updates KPI dashboard: MRR, growth rate, churn, CAC, LTV
3. Generates pitch deck data slides (key metrics)
4. Tracks potential investors, VC funds, angel investors in Switzerland
5. Prepares bank loan documentation (Swiss bank requirements)
6. Models different funding scenarios (bootstrap vs seed vs bank)

Create: data-room/ folder structure
Create: investor-kpis.json with tracked metrics
```

## AGENT 28 — M&A Scout Agent
```
cd ~/Downloads/werkpilot/agents/finance

Create an M&A Scout Agent (ma-scout.js) that:

1. Identifies potential acquisition targets:
   - Small translation bureaus (acquire client base)
   - Struggling marketing agencies (acquire talent + clients)
   - Complementary SaaS tools
2. Monitors Handelsregister for recently closed/struggling businesses in target industries
3. Tracks industry consolidation trends
4. Generates one-page acquisition briefs for interesting targets
5. Values targets using simple revenue multiples

Create: targets/ folder for acquisition briefs
Create: valuation-model.js
```

---

# ═══════════════════════════════════════════════
# DEPARTMENT 7: STRATEGY / CEO OFFICE (5 Agents)
# ═══════════════════════════════════════════════

## AGENT 29 — Market Expansion Agent
```
cd ~/Downloads/werkpilot/agents/strategy

Create a Market Expansion Agent (market-expansion.js) that:

1. Analyzes new market potential: DACH (Germany, Austria), BeNeLux, France
2. Market sizing: TAM, SAM, SOM per country
3. Competitive landscape per market
4. Regulatory requirements (DSGVO, local business registration)
5. Localization needs per market
6. Go-to-market strategy proposals
7. Quarterly market expansion report

Create: markets/ folder with analysis per country
```

## AGENT 30 — M&A Analysis Agent
```
cd ~/Downloads/werkpilot/agents/strategy

Create an M&A Analysis Agent (ma-analysis.js) that:

1. Due diligence checklist generator for acquisition targets
2. Financial modeling: DCF, comparable company analysis, revenue multiples
3. Integration planning: How to merge acquired clients into Werkpilot
4. Risk assessment per target
5. Synergy analysis: What revenue/cost synergies are realistic?

Create: dd-checklists/ with templates
Create: models/ with financial calculation scripts
```

## AGENT 31 — Market Analysis Agent
```
cd ~/Downloads/werkpilot/agents/strategy

Create a Market Analysis Agent (market-analysis.js) that:

1. Swiss KMU market monitoring: Total addressable market by industry/canton
2. Tracks industry trends: Digitalization rate, AI adoption, marketing spend
3. Demand signals: Google Trends data for relevant keywords
4. Seasonal patterns: When do KMUs buy marketing services?
5. Regulatory changes that affect KMUs (tax law, digital requirements)
6. Monthly market intelligence briefing

Create: market-data/ folder for collected data
Create: industry-reports/ for generated analysis
```

## AGENT 32 — Competitor Intelligence Agent
```
cd ~/Downloads/werkpilot/agents/strategy

Create a Competitor Intelligence Agent (competitor-intel.js) that:

1. Monitors 10-15 direct competitors weekly:
   - Website changes (puppeteer screenshots + diff)
   - Pricing changes
   - New service offerings
   - Blog/content strategy
   - Social media activity
   - Job postings (indicates growth/strategy)
2. Win/loss analysis: Why did we win or lose specific deals?
3. Feature comparison matrix: Us vs each competitor
4. Alert when competitor makes significant change
5. Monthly competitive analysis report

Create: competitors/ folder with config per competitor
Create: screenshots/ for website tracking
```

## AGENT 33 — Business Development Agent
```
cd ~/Downloads/werkpilot/agents/strategy

Create a Business Development Agent (bizdev.js) that:

1. Evaluates new business models:
   - White-label offering for agencies
   - API-as-a-service for tech companies
   - Vertical SaaS play (specific industry)
   - Franchise model (local Werkpilot partners)
2. Revenue modeling for each new model
3. Tracks partnership opportunities with complementary services
4. Generates business cases with projected P&L
5. Innovation pipeline management

Create: business-models/ folder with analysis per model
```

---

# ═══════════════════════════════════════════════
# DEPARTMENT 8: HR / PEOPLE (5 Agents)
# ═══════════════════════════════════════════════

## AGENT 34 — Recruiting Agent
```
cd ~/Downloads/werkpilot/agents/hr

Create a Recruiting Agent (recruiting.js) that:

1. Manages freelancer pipeline: Proofreaders (FR, IT), VAs, Sales freelancers
2. Generates job postings using Claude API (optimized for platform)
3. Posts to: Fiverr, Upwork, RemoteOK, jobs.ch, LinkedIn
4. Screens applications: Basic qualification check via Claude API
5. Schedules test tasks for qualified candidates
6. Tracks freelancer performance over time
7. Manages freelancer contracts and NDAs

Create: job-templates/ folder per role
Create: freelancers-schema.json for Airtable tracking
```

## AGENT 35 — Training Agent
```
cd ~/Downloads/werkpilot/agents/hr

Create a Training Agent (training.js) that:

1. Generates SOPs (Standard Operating Procedures) for every process
2. Creates onboarding guides for new freelancers
3. Knowledge base management: Updates wiki/docs when processes change
4. Skill assessment: Tests freelancers on quality standards
5. Creates training materials for client onboarding
6. FAQ database for common internal questions

Create: sops/ folder with procedure documents
Create: knowledge-base/ folder organized by topic
```

## AGENT 36 — Employer Branding Agent
```
cd ~/Downloads/werkpilot/agents/hr

Create an Employer Branding Agent (employer-branding.js) that:

1. Generates LinkedIn employer content: "Life at Werkpilot" posts
2. Glassdoor profile management (when applicable)
3. Crafts "We're hiring" posts optimized for each platform
4. Creates culture content: Values, mission, work environment
5. Employee/freelancer testimonials

Create: content/ folder for employer brand content
```

## AGENT 37 — Performance Management Agent
```
cd ~/Downloads/werkpilot/agents/hr

Create a Performance Management Agent (performance.js) that:

1. Tracks freelancer performance: Quality score, timeliness, availability
2. Monthly performance reviews auto-generated from data
3. Bonus calculation based on performance metrics
4. Performance improvement plans for underperformers
5. Top performer recognition and retention offers
6. Team capacity analysis: Do we need more people?

Create: performance-metrics.json with KPIs per role
```

## AGENT 38 — Compensation Agent
```
cd ~/Downloads/werkpilot/agents/hr

Create a Compensation Agent (compensation.js) that:

1. Market rate research for freelancer roles (web scraping salary data)
2. Compensation benchmarking: Are we competitive?
3. Rate card management: Standard rates per role per market
4. Invoice processing: Verifies freelancer invoices against agreed rates
5. Payment scheduling: Ensures timely freelancer payments
6. Total compensation tracking: Per freelancer, per month

Create: rate-cards.json with standard rates
Create: market-data/ for salary benchmarks
```

---

# ═══════════════════════════════════════════════
# DEPARTMENT 9: IT / DATA (5 Agents)
# ═══════════════════════════════════════════════

## AGENT 39 — Systems Agent
```
cd ~/Downloads/werkpilot/agents/it

Create a Systems Agent (systems.js) that:

1. Manages all tool integrations: Airtable, Mailerlite, Google Workspace, etc.
2. API connection health monitoring
3. Data sync between systems (e.g., CRM → Email Marketing)
4. Configuration management: Centralized config for all agents
5. Version control: Tracks which version of each agent is running
6. Migration scripts when changing tools or updating schemas
7. Documentation: Auto-generates API docs for internal use

Create: integrations/ folder with connector per tool
Create: configs/ folder with centralized configuration
```

## AGENT 40 — Automation Agent
```
cd ~/Downloads/werkpilot/agents/it

Create an Automation Agent (automation.js) that:

1. Master orchestrator: Manages all n8n/Make.com workflows
2. Workflow templates for common automations:
   - New Airtable record → trigger agent workflow
   - Email received → classify and route
   - Scheduled tasks → cron job management
3. Error handling: Catches failures, retries, alerts
4. Performance optimization: Identifies slow workflows and suggests improvements
5. New automation suggestions: "I noticed you do [X] manually. Want me to automate it?"
6. Workflow documentation generator

Create: workflows/ folder with automation definitions
Create: cron-schedules.json with all scheduled tasks
```

## AGENT 41 — Data Analytics Agent
```
cd ~/Downloads/werkpilot/agents/it

Create a Data Analytics Agent (data-analytics.js) that:

1. Central data warehouse: Aggregates data from all agents into unified structure
2. Dashboard data API: Provides endpoints for all dashboards
3. Standard reports:
   - Daily: Revenue, leads, tasks, errors
   - Weekly: Growth, trends, agent performance
   - Monthly: P&L, cohort analysis, forecasts
4. Anomaly detection: Alerts when metrics deviate significantly from norm
5. Custom queries: CEO can ask natural language questions about data (Claude API)
6. Data export: CSV, JSON, PDF for any dataset
7. Data quality checks: Identifies missing, duplicate, or inconsistent data

Create: schemas/ folder with data models
Create: reports/ folder with report templates
Create: api/ folder with data API endpoints
```

## AGENT 42 — AI Optimization Agent
```
cd ~/Downloads/werkpilot/agents/it

Create an AI Optimization Agent (ai-optimization.js) that:

1. Prompt optimization: A/B tests prompt variations for each agent
2. Model selection: Recommends optimal model per task:
   - Haiku: Simple classifications, short responses, QA checks
   - Sonnet: Content generation, email writing, analysis
   - Opus: Complex strategy, multi-step reasoning
3. Cost optimization: Tracks cost per task, finds savings opportunities
4. Quality benchmarking: Measures output quality per model per task
5. Prompt library management: Version-controlled prompts for each agent
6. Token usage optimization: Shorter prompts, better system prompts, caching
7. Monthly AI spend report with optimization recommendations

Create: prompts/ folder with versioned prompts per agent
Create: benchmarks/ folder for quality/cost tracking
Create: model-recommendations.json
```

---

# ═══════════════════════════════════════════════
# AGENT 43: THE ORCHESTRATOR (Meta-Agent)
# ═══════════════════════════════════════════════

## AGENT 43 — Master Orchestrator
```
cd ~/Downloads/werkpilot/agents

Create a Master Orchestrator (orchestrator.js) that:

1. Boots all 42 agents in correct order (dependencies first)
2. Health monitoring: Checks every agent is running every 5 minutes
3. Inter-agent communication: Message bus for agents to trigger each other
4. Agent performance scoring: Tracks each agent's effectiveness (0-100)
5. Self-optimization loop:
   - Every night at 23:00: Reviews all agent logs from the day
   - Identifies underperforming agents
   - Generates improvement suggestions via Claude API
   - Creates tasks in CLAUDE.md for the night shift
6. Agent dependency graph: Knows which agents depend on which
7. Graceful degradation: If one agent fails, others continue
8. Master dashboard data: Provides overview of entire system health
9. Configuration: Single .env file, shared configs, centralized logging
10. Startup: `node orchestrator.js` starts EVERYTHING

Create: agent-registry.json listing all 42 agents with configs
Create: dependency-graph.json
Create: health-dashboard.js for system overview
Create: startup.sh for one-command system boot
```

---

# EXECUTION INSTRUCTIONS

## Run Order:
1. Run MASTER SETUP first
2. Run agents in this order: 43 (Orchestrator) → 20 (Process Automation) → 05 (New Business) → 12 (Content) → 13 (Email Marketing) → then all others in any order
3. Each prompt: `cd ~/Downloads/werkpilot && claude --dangerously-skip-permissions -p "[paste prompt above]"`

## Night Shift Template (CLAUDE.md):
After all agents are built, use this nightly:
```
# Night Shift — [DATE]
1. Review all agent logs from today
2. Fix any errors found in logs
3. Run quality benchmarks on all agents
4. Optimize the 3 lowest-scoring agents
5. Write tests for any untested functions
6. Update documentation
7. Commit all changes with descriptive messages
8. Generate morning report summary
```
