# Marketing Agents Quick Start Guide

## Installation & Setup

### 1. Prerequisites

Ensure you have:
- Node.js v18 or higher
- `.env` file with `ANTHROPIC_API_KEY` configured
- Airtable credentials (optional, for data persistence)
- Access to shared utilities in `/agents/shared/utils/`

### 2. Install Dependencies

```bash
cd /Users/kaitoweingart/Downloads/werkpilot/agents
npm install
```

Required packages:
- `@anthropic-ai/sdk`
- `node-cron`
- `dotenv`

---

## Running the Agents

### Start Individual Agents

**Content Engine:**
```bash
node marketing/content-engine.js
```

**SEO Optimizer:**
```bash
node marketing/seo-optimizer.js
```

**Social Media:**
```bash
node marketing/social-media.js
```

### Run Tests

```bash
node marketing/test-marketing-agents.js
```

---

## Quick Usage Examples

### 1. Generate a Blog Article

```javascript
const { generateArticle } = require('./marketing/content-engine');

const article = await generateArticle({
  title: "Google Bewertungen für Zahnärzte: Der komplette Leitfaden",
  slug: "zahnarzt-google-bewertungen-leitfaden",
  type: "how_to",
  industry: "zahnarzt",
  target_keyword: "zahnarzt google bewertungen",
  secondary_keywords: ["zahnarzt bewertungen sammeln", "google rezensionen zahnarzt"],
  language: "de",
  estimated_words: 1800,
});

console.log(`Article generated: ${article.meta.word_count} words`);
console.log(`SEO score: ${article.quality_score || 'N/A'}`);
console.log(`Cost: CHF ${article.generation_metadata.estimated_cost_chf.toFixed(2)}`);
```

**Output includes:**
- Full article in markdown
- Meta title and description
- Image alt-text suggestions
- Internal link recommendations
- Social media snippets
- Token usage and cost tracking

---

### 2. Run SEO Analysis

```javascript
const { analyzeOnPageSEO, analyzeCompetitorKeywordGaps } = require('./marketing/seo-optimizer');

// On-page SEO analysis
const seoScore = await analyzeOnPageSEO('zahnarzt-google-bewertungen-leitfaden');
console.log(`SEO Score: ${seoScore.seo_score}/100 (Grade: ${seoScore.grade})`);
console.log(`Critical issues: ${seoScore.critical_issues.length}`);

// Competitor keyword gaps
const gaps = await analyzeCompetitorKeywordGaps('zahnarzt', 'de');
console.log(`Keyword gaps found: ${gaps.keyword_gaps.length}`);
console.log(`Quick wins: ${gaps.quick_wins.join(', ')}`);
```

**SEO Optimizer provides:**
- Keyword density analysis
- Competitor gap identification
- Swiss-specific SEO recommendations
- Page speed insights
- Monthly SEO reports

---

### 3. Create Social Media Posts

```javascript
const { adaptContentForPlatforms, generateSwissHashtags } = require('./marketing/social-media');

// Adapt content for all platforms
const socialPosts = await adaptContentForPlatforms(
  "Neu: Google Bewertungen richtig nutzen - so gewinnen Zahnärzte mehr Patienten!",
  {
    topic: "Google Bewertungen für Zahnärzte",
    industry: "zahnarzt",
    cta: "Jetzt Leitfaden lesen",
    url: "https://werkpilot.ch/blog/zahnarzt-google-bewertungen",
    language: "de",
  }
);

console.log('LinkedIn:', socialPosts.linkedin.text);
console.log('Instagram:', socialPosts.instagram.caption);
console.log('Twitter:', socialPosts.twitter.text);

// Generate Swiss hashtags
const hashtags = await generateSwissHashtags(
  "Google Bewertungen Zahnarzt",
  "instagram",
  "zahnarzt",
  "de"
);
console.log('Hashtags:', hashtags.hashtag_string);
```

**Social Media Agent provides:**
- Platform-specific content variants
- Swiss market hashtags
- Optimal posting schedules
- A/B testing variants
- Engagement tracking

---

## Content Calendar Workflow

### 1. Plan Next Month's Content

```javascript
const { planNextMonth } = require('./marketing/content-engine');

const plan = await planNextMonth();
console.log(`Planned ${plan.articles.length} articles for next month`);
```

### 2. Generate Article Batch

```javascript
const { generateArticleBatch } = require('./marketing/content-engine');

const results = await generateArticleBatch(3); // Generate 3 articles
console.log(`Successfully generated: ${results.filter(r => !r.error).length}`);
```

### 3. Analyze SEO Performance

```javascript
const { generateMonthlySEOReport } = require('./marketing/seo-optimizer');

const report = await generateMonthlySEOReport();
// CEO receives email with comprehensive SEO report
```

### 4. Create Social Media Posts

```javascript
const { generatePostsFromContentCalendar } = require('./marketing/social-media');

const posts = await generatePostsFromContentCalendar();
console.log(`Generated social posts for ${posts.length} articles`);
```

---

## Scheduled Operations

All agents include cron schedulers that run automatically when the agent is started.

### Content Engine Schedule

| Time | Task |
|------|------|
| Mon, Wed, Fri 6:00 AM | Generate 2 articles |
| 25th of month, 10:00 AM | Plan next month's content |
| Tuesdays 7:00 AM | Translate articles to French |
| Sundays 6:00 PM | Weekly content report |

### SEO Optimizer Schedule

| Time | Task |
|------|------|
| Daily 6:00 AM | On-page SEO monitoring |
| Mondays 9:00 AM | Competitor keyword analysis |
| 1st of month, 10:00 AM | Monthly SEO report |
| Wednesdays 11:00 AM | Swiss SEO audit |

### Social Media Schedule

| Time | Task |
|------|------|
| Daily 7:30 AM | Generate posts from new articles |
| Mondays 9:00 AM | Weekly performance report |

**All times are in Europe/Zurich timezone (CET/CEST)**

---

## Configuration

### Environment Variables

Create a `.env` file in `/agents/`:

```env
# Claude API
ANTHROPIC_API_KEY=sk-ant-xxx

# Budget (optional)
DAILY_AI_BUDGET=50

# Airtable (optional)
AIRTABLE_API_KEY=keyXXX
AIRTABLE_BASE_ID=appXXX

# Email (optional)
CEO_EMAIL=ceo@werkpilot.ch
SMTP_HOST=smtp.example.com
SMTP_USER=noreply@werkpilot.ch
SMTP_PASS=xxx
```

### Config File

Edit `/agents/shared/utils/config.js`:

```javascript
module.exports = {
  models: {
    fast: 'claude-3-5-haiku-20241022',        // Quick tasks
    standard: 'claude-sonnet-4-5-20250929',   // Main content
    advanced: 'claude-opus-4-6',              // Complex analysis
  },
  // ... other config
};
```

---

## Output Files

Generated content is saved in `/agents/marketing/output/`:

```
output/
├── 2026-02-14_seo-kmu-lokal.json          # Full article data
├── seo-kmu-lokal.md                       # Markdown for Next.js
└── social_seo-kmu-lokal.json              # Social media posts
```

### Article JSON Structure

```json
{
  "meta": {
    "title": "SEO meta title",
    "description": "Meta description",
    "slug": "article-slug",
    "categories": ["SEO", "KMU"],
    "tags": ["seo", "schweiz"],
    "primary_keyword": "seo kmu schweiz",
    "word_count": 1542,
    "estimated_reading_time": 6
  },
  "content": "Full markdown content...",
  "image_alt_texts": [
    { "id": "hero", "alt": "Swiss business owner reviewing SEO dashboard" }
  ],
  "internal_link_suggestions": [
    { "anchor_text": "Google My Business", "target_slug": "google-my-business" }
  ],
  "social": {
    "linkedin": "LinkedIn post text...",
    "instagram": "Instagram caption..."
  },
  "generation_metadata": {
    "generation_time_ms": 12453,
    "tokens_used": { "total": 6234 },
    "estimated_cost_chf": 0.18
  }
}
```

---

## Common Tasks

### Generate Content for New Industry

1. Add industry to `/marketing/seo-keywords.json`
2. Create campaign in `/marketing/campaigns/{industry}.json`
3. Update content calendar with industry articles
4. Run `generateArticleBatch()`

### Add New Language

1. Create `/marketing/keywords/{lang}-keywords.json`
2. Update content calendar with language code
3. Generate article with `language: '{lang}'`
4. Social media will auto-adapt

### Monitor Performance

```javascript
// Check daily usage
const { getUsageStats } = require('../shared/utils/claude-client');
const stats = getUsageStats();
console.log(`Today's cost: $${stats.totalCost.toFixed(2)}`);

// Check content metrics
const articles = await getRecords('BlogArticles', '{Status} = "published"', 100);
console.log(`Published articles: ${articles.length}`);
```

### Debug Issues

Enable detailed logging:

```javascript
const logger = createLogger('my-test');
logger.info('Starting test...');
logger.error('Error occurred', { error: err.message });
```

Check log files (if configured):
```bash
tail -f /var/log/werkpilot-agents.log
```

---

## Troubleshooting

### "Daily budget exceeded"
- Check usage: `getUsageStats()`
- Increase `DAILY_AI_BUDGET` in `.env`
- Model will auto-fallback to cheaper alternative

### "Failed to parse JSON"
- Claude response may include markdown formatting
- The client auto-extracts JSON from markdown blocks
- Check `claude-client.js` for parser logic

### "Airtable connection failed"
- Verify `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID`
- Check table names match (`BlogArticles`, `SEOAnalysis`, etc.)
- Agents will log warnings but continue without Airtable

### "Content calendar not found"
- Ensure `/marketing/content-calendar.json` exists
- Run `planNextMonth()` to generate initial calendar

---

## Best Practices

### 1. Cost Management
- Use `models.fast` for simple tasks (hashtags, alt-text)
- Use `models.standard` for main content (articles, analysis)
- Use `models.advanced` only for complex reasoning
- Enable caching for repeated requests

### 2. Quality Control
- Run `runQualityCheck()` on all generated articles
- Target score: >85/100 before publishing
- Review critical issues flagged by SEO analysis

### 3. SEO Strategy
- Generate competitor gap analysis monthly
- Update keyword clusters based on findings
- Monitor on-page SEO scores weekly

### 4. Social Media
- A/B test different hooks, CTAs, hashtags
- Track engagement rates per platform
- Adjust posting times based on performance

### 5. Content Planning
- Plan 4 weeks ahead in content calendar
- Mix content types (how-to, case study, insight)
- Cover all target industries evenly
- Include 2-3 French articles per month

---

## Support

- **Documentation:** See `UPGRADE_SUMMARY.md` for detailed features
- **Code examples:** See `test-marketing-agents.js`
- **Shared utils:** See `/shared/utils/README.md`
- **Inline help:** All functions have JSDoc comments

---

## Next Steps

1. **Test the agents:** Run `node test-marketing-agents.js`
2. **Review output:** Check `/marketing/output/` directory
3. **Plan content:** Run `planNextMonth()` to create content calendar
4. **Generate articles:** Run `generateArticleBatch(3)` to create first batch
5. **Analyze SEO:** Run SEO analysis on generated content
6. **Create social posts:** Generate social media variants
7. **Monitor performance:** Check dashboard and Airtable
8. **Schedule agents:** Start agents as background processes

---

**Happy content creating!**

For questions or issues, review the agent source code - all functions include detailed comments and examples.
