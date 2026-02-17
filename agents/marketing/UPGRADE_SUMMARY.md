# Marketing Agents Upgrade Summary

## Overview

The marketing department agents have been significantly upgraded with advanced content generation, SEO optimization, and social media management capabilities, all tailored for the Swiss market.

---

## Agent 12: Content Engine (Enhanced)

**File:** `content-engine.js`

### New Features

#### 1. Image Alt-Text Generation
- **Function:** `generateImageAltText(articleContext, imageCount)`
- Automatically generates SEO-optimized, accessibility-friendly alt-text for article images
- Includes primary keyword naturally
- Follows best practices for screen readers
- Returns structured suggestions for hero, content, and supporting images

#### 2. Advanced Internal Linking
- **Function:** `generateInternalLinkSuggestions(articleContent, existingArticles, targetKeyword)`
- AI-powered internal linking strategy
- Analyzes content and suggests natural link placements
- Strengthens topic authority and site structure
- Provides anchor text, target pages, and placement context

#### 3. Token and Cost Tracking
- Integrated with `claude-client.js` usage tracking
- Tracks tokens used per article (prompt + completion)
- Calculates estimated cost in CHF (USD to CHF conversion)
- Stores generation metadata with each article
- Syncs metrics to dashboard for budget monitoring

#### 4. Dashboard Integration
- Uses `dashboard-sync.js` for real-time metrics
- Syncs article generation events
- Tracks word count, language, industry, tokens, and cost
- Enables performance monitoring across agents

### Usage Example

```javascript
const { generateArticle, generateImageAltText, generateInternalLinkSuggestions } = require('./content-engine');

// Generate a complete article with all enhancements
const article = await generateArticle({
  title: "SEO für KMU: So werden Sie lokal gefunden",
  slug: "seo-kmu-lokal-gefunden",
  type: "how_to",
  industry: "general",
  target_keyword: "seo kmu schweiz",
  secondary_keywords: ["lokales seo", "google maps"],
  language: "de",
});

// Article now includes:
// - article.image_alt_texts: Array of alt-text suggestions
// - article.internal_link_suggestions: Strategic linking recommendations
// - article.generation_metadata: Token usage, cost, timing
```

---

## Agent 13: SEO Optimizer (New)

**File:** `seo-optimizer.js`

### Features

#### 1. Keyword Density Analysis
- **Function:** `analyzeKeywordDensity(content, targetKeywords)`
- Calculates keyword density for primary and secondary keywords
- Identifies over-optimization (>2.5%) and under-optimization (<0.5%)
- Provides actionable recommendations
- Returns detailed metrics per keyword

#### 2. Competitor Keyword Gap Analysis
- **Function:** `analyzeCompetitorKeywordGaps(industry, language)`
- Identifies high-value keywords competitors rank for
- Swiss-specific long-tail opportunities (includes city names)
- Question-based keywords ("wie", "was kostet", "warum")
- Categorizes gaps by search volume, difficulty, and intent
- Provides "quick win" keyword suggestions

#### 3. Page Speed Insights
- **Function:** `generatePageSpeedInsights(url)`
- Mock metrics (ready for Google PageSpeed Insights API integration)
- Analyzes Core Web Vitals: LCP, CLS, TBT
- Provides optimization recommendations by category
- Estimates SEO and conversion impact

#### 4. Swiss-Specific SEO
- **Function:** `analyzeSwissSEO(websiteUrl)`
- .ch TLD optimization recommendations
- hreflang implementation for de-CH, fr-CH, it-CH
- Local business schema for Swiss regions
- Swiss directory listings (local.ch, search.ch)
- Cultural localization (Swiss German spelling, payment methods)
- Cantonal and city-specific content opportunities

#### 5. Monthly SEO Reports
- **Function:** `generateMonthlySEOReport()`
- Comprehensive monthly report in German
- Content performance analysis
- Keyword strategy updates
- Technical SEO audits
- Competitor analysis summary
- Prioritized action items
- SEO health score (0-100)

#### 6. On-Page SEO Analysis
- **Function:** `analyzeOnPageSEO(slug)`
- 10+ on-page factors checked
- Title tag, meta description, URL structure
- Header hierarchy (H1, H2, H3)
- Keyword placement optimization
- Image alt-text review
- Internal/external linking audit
- Schema markup opportunities
- Returns actionable improvement priority list

### Scheduling

- **Daily (6:00 AM CET):** On-page SEO monitoring for recent articles
- **Weekly (Monday 9:00 AM CET):** Competitor keyword gap analysis
- **Monthly (1st of month, 10:00 AM CET):** Full SEO report
- **Weekly (Wednesday 11:00 AM CET):** Swiss SEO audit

### Usage Example

```javascript
const { analyzeKeywordDensity, analyzeCompetitorKeywordGaps, analyzeSwissSEO } = require('./seo-optimizer');

// Analyze keyword density
const density = await analyzeKeywordDensity(articleContent, [
  'seo kmu schweiz',
  'lokales seo',
  'google maps eintrag'
]);
// Returns: { total_words, keywords: { density, status, recommendation }, overall_health }

// Find competitor gaps
const gaps = await analyzeCompetitorKeywordGaps('zahnarzt', 'de');
// Returns: { keyword_gaps, swiss_local_opportunities, quick_wins, strategic_summary }

// Swiss SEO audit
const audit = await analyzeSwissSEO('https://werkpilot.ch');
// Returns: { tld_optimization, hreflang_implementation, local_seo_opportunities, priority_actions }
```

---

## Agent 14: Social Media (New)

**File:** `social-media.js`

### Features

#### 1. Platform-Specific Content Adaptation
- **Function:** `adaptContentForPlatforms(baseContent, context)`
- Generates optimized variants for LinkedIn, Instagram, Twitter, Facebook
- Platform-specific character limits and best practices
- Tone adaptation (professional, visual, concise, community-focused)
- Optimal posting times per platform (Swiss timezone)
- Includes hooks, CTAs, and engagement strategies

Platform specs:
- **LinkedIn:** Professional B2B, ~150 chars optimal, max 5 hashtags
- **Instagram:** Visual storytelling, ~138 chars, 11-15 hashtags
- **Twitter:** Concise, max 280 chars, max 3 hashtags
- **Facebook:** Community-focused, ~250 chars optimal

#### 2. Swiss Market Hashtag Optimization
- **Function:** `generateSwissHashtags(topic, platform, industry, language)`
- Mix of high-reach, medium-reach, and niche hashtags
- Swiss-specific tags (#schweiz, #swiss, #suisse, #kmu)
- Multilingual variants for maximum reach
- City-specific tags (#zürich, #bern, #basel, #genève)
- Industry-relevant hashtags
- Estimated reach and post counts

#### 3. Post Scheduling with Optimal Times
- **Function:** `generatePostingSchedule(postsPerWeek, platforms)`
- Swiss timezone (Europe/Zurich)
- Platform-specific best times based on Swiss B2B audience behavior
- Distributes posts across days and platforms
- Returns structured schedule with day, time, platform

#### 4. A/B Content Variants
- **Function:** `generateABVariants(basePost, platform, testFocus)`
- Test focus options: hook, CTA, hashtags, format, tone
- Generates 3 distinct variants (A, B, C)
- Maintains core message while testing specific elements
- Includes hypothesis and success metrics
- Stores tests in Airtable for tracking

#### 5. Engagement Metrics Tracking
- **Function:** `trackEngagementMetrics(platform, postId, metrics)`
- Tracks impressions, reach, likes, comments, shares, clicks, saves
- Calculates engagement rate and CTR
- Stores in Airtable and syncs to dashboard
- Enables performance analysis and optimization

#### 6. Content Calendar Integration
- **Function:** `generatePostsFromContentCalendar()`
- Automatically creates social posts from published blog articles
- Generates platform-optimized variants
- Includes article URL and metadata
- Saves to output directory for easy access

#### 7. Weekly Performance Reports
- **Function:** `generateWeeklyReport()`
- Aggregates metrics by platform
- Analyzes engagement trends
- Identifies top-performing content
- Provides actionable insights
- German-language report for CEO

### Scheduling

- **Daily (7:30 AM CET):** Generate social posts from new blog articles
- **Weekly (Monday 9:00 AM CET):** Performance report

### Usage Example

```javascript
const { adaptContentForPlatforms, generateSwissHashtags, generateABVariants } = require('./social-media');

// Adapt content for all platforms
const variants = await adaptContentForPlatforms(
  "New blog: SEO für KMU - So werden Sie lokal gefunden",
  {
    topic: "Local SEO for Swiss SMEs",
    industry: "general",
    targetAudience: "Swiss business owners",
    cta: "Read the guide",
    url: "https://werkpilot.ch/blog/seo-kmu-lokal",
    language: "de"
  }
);
// Returns: { linkedin, instagram, twitter, facebook, posting_strategy }

// Generate Swiss hashtags
const hashtags = await generateSwissHashtags(
  "Local SEO",
  "instagram",
  "general",
  "de"
);
// Returns: { hashtags, primary_tags, optional_tags, hashtag_string }

// Create A/B test
const abTest = await generateABVariants(
  variants.linkedin,
  "linkedin",
  "cta"
);
// Returns: { test_hypothesis, variants: [A, B, C], success_metrics }
```

---

## Integration with Shared Utilities

All agents use the centralized shared utilities:

### Claude Client (`claude-client.js`)
- `generateText()`: Text generation with cost tracking
- `generateJSON()`: JSON generation with automatic parsing
- `getUsageStats()`: Retrieve token usage and cost data
- Automatic caching (5-minute TTL)
- Budget monitoring and model fallback
- Cost calculation in USD (agents convert to CHF)

### Dashboard Sync (`dashboard-sync.js`)
- `syncMetric()`: Real-time metrics synchronization
- Enables cross-agent performance monitoring
- Supports custom metadata per metric

### Logger (`logger.js`)
- `createLogger(agentName)`: Structured logging
- Consistent log format across agents
- Error tracking and debugging

### Airtable Client (`airtable-client.js`)
- `getRecords()`: Fetch records with filters
- `createRecord()`: Store generated content
- `updateRecord()`: Update existing records

### Email Client (`email-client.js`)
- `sendCEOEmail()`: Send reports to CEO
- HTML email formatting
- Werkpilot brand styling

---

## Data Flow

```
┌─────────────────────────────────────────────────────┐
│          Content Calendar (JSON)                    │
│  - Planned articles with keywords, industry, etc.   │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│     Agent 12: Content Engine                        │
│  1. Generate article with Claude                    │
│  2. Generate image alt-texts                        │
│  3. Suggest internal links                          │
│  4. Track tokens & cost                             │
│  5. Save to output/ and Airtable                    │
└─────────────────┬───────────────────────────────────┘
                  │
                  ├──────────────┐
                  ▼              ▼
┌───────────────────────┐  ┌────────────────────────┐
│  Agent 13: SEO        │  │  Agent 14: Social      │
│  - Keyword density    │  │  - Platform variants   │
│  - Competitor gaps    │  │  - Swiss hashtags      │
│  - On-page analysis   │  │  - Scheduling          │
│  - Swiss SEO audit    │  │  - A/B testing         │
│  - Monthly reports    │  │  - Engagement tracking │
└───────────────────────┘  └────────────────────────┘
                  │              │
                  ▼              ▼
┌─────────────────────────────────────────────────────┐
│          Dashboard & Airtable                       │
│  - Centralized metrics                              │
│  - Cross-agent insights                             │
│  - CEO reports                                      │
└─────────────────────────────────────────────────────┘
```

---

## File Structure

```
werkpilot/agents/marketing/
├── content-engine.js           (Enhanced - Agent 12)
├── seo-optimizer.js            (NEW - Agent 13)
├── social-media.js             (NEW - Agent 14)
├── performance-marketing.js    (Existing - Agent 09)
├── brand-marketing.js          (Existing)
├── email-marketing.js          (Existing)
├── pr-media.js                 (Existing)
├── content-calendar.json       (Article planning)
├── seo-keywords.json           (Keyword database)
├── brand-guidelines.json       (Voice & tone)
├── output/                     (Generated content)
│   ├── YYYY-MM-DD_slug.json
│   ├── slug.md
│   └── social_slug.json
├── campaigns/                  (Google Ads campaigns)
├── keywords/                   (DE/FR keyword lists)
└── UPGRADE_SUMMARY.md          (This file)
```

---

## Swiss-Specific Features

### Language Support
- **German (Swiss):** Uses "ss" instead of "ß", Swiss-specific vocabulary
- **French (Swiss):** Swiss French conventions, avoids France-specific expressions
- **Italian (Swiss):** Future support planned

### SEO Optimizations
- **.ch TLD:** Domain authority optimization for Swiss search
- **hreflang tags:** de-CH, fr-CH, it-CH for multi-language content
- **Local keywords:** City names (Zürich, Bern, Basel, Genf, Lausanne)
- **Swiss directories:** local.ch, search.ch, localsearch.ch

### Social Media
- **Hashtags:** Swiss-specific (#schweiz, #swiss, #suisse, #kmu, #pme)
- **Timing:** Europe/Zurich timezone, B2B optimal times
- **Cultural tone:** Professional Swiss business culture

### Content
- **Forbidden words:** Never use "KI", "AI", "künstliche Intelligenz"
- **Use instead:** "intelligente Automatisierung", "smart tools"
- **Perspective:** "wir" (we) for brand voice
- **Quality:** Swiss quality messaging, trust signals

---

## Performance Metrics

### Content Engine
- Articles generated per month: 8-12
- Average word count: 1,200-1,800
- Token usage per article: ~4,000-8,000 tokens
- Cost per article: ~CHF 0.10-0.30
- Quality score target: >85/100

### SEO Optimizer
- Keyword gaps identified: 10-20 per industry
- On-page SEO score target: >80/100
- Page speed target: >85/100
- Monthly reports: 1st of each month

### Social Media
- Posts per week: 7-14 (across all platforms)
- Platform variants: 4 per piece of content
- Engagement rate target: >2%
- CTR target: >1%

---

## Next Steps

### Integration Opportunities
1. **Google PageSpeed Insights API:** Replace mock data with real metrics
2. **Social media APIs:** Auto-posting and real engagement tracking
3. **Google Ads API:** Automated campaign management
4. **Analytics integration:** GA4 data for content performance

### Feature Enhancements
1. **Video content scripts:** Social media video generation
2. **Carousel posts:** Multi-image Instagram content
3. **LinkedIn articles:** Long-form LinkedIn publishing
4. **Podcast scripts:** Audio content generation

### Automation
1. **Auto-publishing:** Scheduled content publication
2. **Auto-translation:** DE → FR/IT translation pipeline
3. **Auto-A/B testing:** Continuous optimization
4. **Alert system:** Performance anomaly detection

---

## Monitoring & Maintenance

### Daily Checks
- Content generation status
- SEO analysis results
- Social post performance

### Weekly Reviews
- Performance reports from all agents
- Budget vs. actual spending
- Quality score trends

### Monthly Audits
- Comprehensive SEO report
- Keyword strategy review
- Content calendar planning
- Social media growth analysis

---

## Support & Documentation

- **Shared utilities:** `/agents/shared/utils/README.md`
- **Content engine:** Inline JSDoc comments
- **SEO optimizer:** Inline JSDoc comments
- **Social media:** Inline JSDoc comments
- **API references:** See individual agent files

---

## Version History

- **v1.0** (2026-02-14): Initial upgrade
  - Enhanced content-engine.js with alt-text, internal linking, cost tracking
  - Added seo-optimizer.js with keyword analysis, Swiss SEO, monthly reports
  - Added social-media.js with platform adaptation, hashtags, A/B testing

---

**Maintained by:** Werkpilot AI Agent System
**Last Updated:** 2026-02-14
**Agents:** 12 (Content Engine), 13 (SEO Optimizer), 14 (Social Media)
