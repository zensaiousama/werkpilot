/**
 * AGENT 13 — SEO Optimizer Agent
 *
 * Advanced SEO analysis and optimization for Werkpilot content and website.
 * Swiss-specific SEO including .ch TLD optimization and multi-language support.
 *
 * Responsibilities:
 * - Keyword density analysis
 * - Competitor keyword gap analysis
 * - Page speed insights (mock data for now)
 * - Swiss-specific SEO: .ch TLD, hreflang de-CH/fr-CH/it-CH
 * - Monthly SEO reports
 * - Dashboard sync for SEO metrics
 * - On-page SEO recommendations
 * - Technical SEO audits
 *
 * Schedule: Daily monitoring, weekly analysis, monthly reports
 */

const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const dashboardSync = require('../shared/utils/dashboard-sync');
const config = require('../shared/utils/config');

const logger = createLogger('seo-optimizer');
const MARKETING_DIR = path.join(__dirname);
const SEO_KEYWORDS_PATH = path.join(MARKETING_DIR, 'seo-keywords.json');
const OUTPUT_DIR = path.join(MARKETING_DIR, 'output');

// ─── Keyword Density Analysis ──────────────────────────────────────────────────

/**
 * Analyze keyword density in content
 */
async function analyzeKeywordDensity(content, targetKeywords) {
  logger.info('Analyzing keyword density');

  try {
    // Remove markdown and HTML
    const plainText = content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/[#*_\[\]()]/g, '');

    const words = plainText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const totalWords = words.length;

    // Count keyword occurrences
    const keywordStats = {};

    for (const keyword of targetKeywords) {
      const keywordLower = keyword.toLowerCase();
      const keywordWords = keywordLower.split(/\s+/);
      let count = 0;

      if (keywordWords.length === 1) {
        // Single word keyword
        count = words.filter(w => w === keywordLower).length;
      } else {
        // Multi-word keyword
        const pattern = keywordWords.join('\\s+');
        const regex = new RegExp(pattern, 'gi');
        count = (plainText.match(regex) || []).length;
      }

      const density = totalWords > 0 ? (count / totalWords) * 100 : 0;

      keywordStats[keyword] = {
        count,
        density: Math.round(density * 100) / 100,
        status: density < 0.5 ? 'too_low' : density > 2.5 ? 'too_high' : 'optimal',
        recommendation: density < 0.5
          ? 'Increase keyword usage naturally'
          : density > 2.5
            ? 'Reduce keyword usage to avoid over-optimization'
            : 'Keyword density is optimal',
      };
    }

    const analysis = {
      total_words: totalWords,
      keywords: keywordStats,
      overall_health: Object.values(keywordStats).filter(k => k.status === 'optimal').length / targetKeywords.length,
      timestamp: new Date().toISOString(),
    };

    logger.info(`Keyword density analyzed: ${totalWords} words, ${targetKeywords.length} keywords checked`);
    return analysis;
  } catch (error) {
    logger.error('Keyword density analysis failed', { error: error.message });
    throw error;
  }
}

// ─── Competitor Keyword Gap Analysis ───────────────────────────────────────────

/**
 * Analyze keyword gaps between Werkpilot and competitors
 */
async function analyzeCompetitorKeywordGaps(industry, language = 'de') {
  logger.info(`Analyzing competitor keyword gaps for ${industry} (${language})`);

  try {
    const seoKeywords = JSON.parse(await fs.readFile(SEO_KEYWORDS_PATH, 'utf-8'));
    const industryKeywords = seoKeywords.target_keywords[industry] || seoKeywords.target_keywords.general_kmu;

    // Define common Swiss KMU marketing competitors
    const competitors = {
      treuhand: ['treuhand-express.ch', 'treufid.ch', 'revitas.ch'],
      zahnarzt: ['zahnarzt-zentrum.ch', 'swiss-dental.ch', 'dentalcare.ch'],
      immobilien: ['immoscout24.ch', 'homegate.ch', 'newhome.ch'],
      general: ['localsearch.ch', 'google.com/business', 'swisscom-directories.ch'],
    };

    const industryCompetitors = competitors[industry] || competitors.general;

    const prompt = `As a Swiss SEO specialist, analyze keyword gaps for Werkpilot.ch competing in the ${industry} industry.

Our current target keywords:
${JSON.stringify(industryKeywords.cluster?.map(k => k.keyword) || [], null, 2)}

Known competitors in Swiss ${industry} market:
${industryCompetitors.map(c => `- ${c}`).join('\n')}

Identify:
1. High-value keywords competitors likely rank for that we don't target yet
2. Swiss-specific long-tail keywords (include city names: Zürich, Bern, Basel, Genf, Lausanne)
3. Question-based keywords ("wie", "was kostet", "warum")
4. Commercial intent keywords we're missing
5. Seasonal opportunities

Focus on ${language === 'de' ? 'German (Swiss)' : language === 'fr' ? 'French (Swiss)' : 'English'} keywords.

Return as JSON:
{
  "keyword_gaps": [
    {
      "keyword": "string",
      "search_volume_estimate": "low|medium|high",
      "difficulty": "low|medium|high",
      "intent": "informational|commercial|transactional",
      "gap_reason": "Why competitors rank but we don't",
      "priority": "high|medium|low",
      "content_recommendation": "Type of content to create"
    }
  ],
  "swiss_local_opportunities": [
    { "city": "string", "keyword_pattern": "string", "potential": "high|medium|low" }
  ],
  "competitor_strengths": {
    "competitor": ["strengths we should counter"]
  },
  "quick_wins": ["Keywords we can rank for quickly"],
  "strategic_summary": "One paragraph summary"
}`;

    const analysis = await generateJSON(prompt, {
      system: 'You are a Swiss SEO expert with deep knowledge of local search behavior and competition.',
      model: config.models.standard,
    });

    // Store analysis
    await createRecord('SEOAnalysis', {
      Type: 'competitor_gap',
      Industry: industry,
      Language: language,
      GapsFound: analysis.keyword_gaps?.length || 0,
      QuickWins: analysis.quick_wins?.join('; ') || '',
      Date: new Date().toISOString().split('T')[0],
      Analysis: JSON.stringify(analysis),
      Agent: 'seo-optimizer',
    });

    logger.info(`Competitor gap analysis complete: ${analysis.keyword_gaps?.length || 0} gaps found`);
    return analysis;
  } catch (error) {
    logger.error('Competitor keyword gap analysis failed', { error: error.message });
    throw error;
  }
}

// ─── Page Speed Insights ────────────────────────────────────────────────────────

/**
 * Generate page speed insights (mock data for now)
 * In production, this would integrate with Google PageSpeed Insights API
 */
async function generatePageSpeedInsights(url) {
  logger.info(`Generating page speed insights for ${url}`);

  try {
    // Mock data - replace with actual PageSpeed Insights API in production
    const mockMetrics = {
      performance_score: 85 + Math.floor(Math.random() * 15),
      first_contentful_paint: 1.2 + Math.random() * 0.8,
      largest_contentful_paint: 2.1 + Math.random() * 1.2,
      time_to_interactive: 3.5 + Math.random() * 1.5,
      cumulative_layout_shift: 0.05 + Math.random() * 0.1,
      total_blocking_time: 150 + Math.floor(Math.random() * 200),
    };

    const prompt = `Analyze these page speed metrics for ${url} and provide optimization recommendations.

Metrics:
- Performance Score: ${mockMetrics.performance_score}/100
- First Contentful Paint (FCP): ${mockMetrics.first_contentful_paint.toFixed(2)}s
- Largest Contentful Paint (LCP): ${mockMetrics.largest_contentful_paint.toFixed(2)}s
- Time to Interactive (TTI): ${mockMetrics.time_to_interactive.toFixed(2)}s
- Cumulative Layout Shift (CLS): ${mockMetrics.cumulative_layout_shift.toFixed(3)}
- Total Blocking Time (TBT): ${mockMetrics.total_blocking_time}ms

Core Web Vitals benchmarks:
- LCP: Good < 2.5s, Needs improvement < 4s, Poor > 4s
- CLS: Good < 0.1, Needs improvement < 0.25, Poor > 0.25
- FID/TBT: Good < 100ms, Needs improvement < 300ms, Poor > 300ms

Provide specific, actionable recommendations for this Swiss B2B SaaS website.

Return as JSON:
{
  "overall_grade": "excellent|good|needs_improvement|poor",
  "core_web_vitals_status": {
    "lcp": "good|needs_improvement|poor",
    "cls": "good|needs_improvement|poor",
    "tbt": "good|needs_improvement|poor"
  },
  "recommendations": [
    {
      "priority": "critical|high|medium|low",
      "category": "images|javascript|css|server|fonts|third_party",
      "issue": "What's wrong",
      "action": "Specific action to take",
      "expected_improvement": "Expected impact on metrics"
    }
  ],
  "estimated_seo_impact": "How speed affects SEO ranking",
  "user_experience_impact": "How speed affects conversions"
}`;

    const insights = await generateJSON(prompt, {
      system: 'You are a web performance expert specializing in Core Web Vitals optimization.',
      model: config.models.fast,
    });

    insights.metrics = mockMetrics;
    insights.url = url;
    insights.tested_at = new Date().toISOString();

    logger.info(`Page speed insights generated for ${url}: ${insights.overall_grade}`);
    return insights;
  } catch (error) {
    logger.error('Page speed insights generation failed', { error: error.message });
    throw error;
  }
}

// ─── Swiss-Specific SEO ─────────────────────────────────────────────────────────

/**
 * Analyze and generate Swiss-specific SEO recommendations
 */
async function analyzeSwissSEO(websiteUrl = 'https://werkpilot.ch') {
  logger.info('Analyzing Swiss-specific SEO factors');

  try {
    const prompt = `Analyze Swiss-specific SEO requirements for ${websiteUrl} and provide comprehensive recommendations.

Swiss SEO factors to check:
1. .ch TLD optimization
2. hreflang tags for de-CH, fr-CH, it-CH (multi-language Switzerland)
3. Local business schema for Swiss regions
4. Swiss-specific keywords ("KMU", "Treuhand", "CHF", city names)
5. Swiss search engine preferences (Google.ch vs Google.com)
6. Local citations and directories (local.ch, search.ch)
7. Swiss payment methods and trust signals
8. GDPR/Swiss data protection compliance messaging
9. Swiss German spelling preferences (ss vs ß)
10. Cantonal and city-specific content opportunities

Return as JSON:
{
  "tld_optimization": {
    "status": "optimized|needs_work|missing",
    "recommendations": ["..."]
  },
  "hreflang_implementation": {
    "current_setup": "Describe current state",
    "recommended_setup": {
      "de-CH": "German Swiss pages",
      "fr-CH": "French Swiss pages",
      "it-CH": "Italian Swiss pages",
      "de-DE": "Optional German fallback",
      "fr-FR": "Optional French fallback"
    },
    "implementation_code": "HTML example"
  },
  "local_seo_opportunities": [
    {
      "region": "Zürich|Bern|Basel|Genf|Lausanne|etc",
      "keywords": ["..."],
      "content_ideas": ["..."],
      "priority": "high|medium|low"
    }
  ],
  "swiss_directories": [
    {
      "name": "local.ch|search.ch|etc",
      "status": "listed|pending|not_listed",
      "recommendation": "string"
    }
  ],
  "cultural_localization": {
    "language_preferences": "Recommendations for Swiss German, French, Italian",
    "trust_signals": ["Swiss quality indicators to emphasize"],
    "payment_methods": ["TWINT, PostFinance, etc"]
  },
  "technical_requirements": [
    {
      "requirement": "string",
      "status": "implemented|missing",
      "priority": "critical|high|medium|low",
      "implementation": "How to implement"
    }
  ],
  "priority_actions": ["Top 5 actions to take immediately"]
}`;

    const analysis = await generateJSON(prompt, {
      system: 'You are a Swiss SEO specialist with expertise in multi-language .ch domain optimization.',
      model: config.models.standard,
    });

    // Store analysis
    await createRecord('SEOAnalysis', {
      Type: 'swiss_seo',
      URL: websiteUrl,
      Date: new Date().toISOString().split('T')[0],
      Analysis: JSON.stringify(analysis),
      PriorityActionsCount: analysis.priority_actions?.length || 0,
      Agent: 'seo-optimizer',
    });

    logger.info('Swiss SEO analysis complete', {
      hreflang_status: analysis.hreflang_implementation?.current_setup || 'unknown',
      priority_actions: analysis.priority_actions?.length || 0,
    });

    return analysis;
  } catch (error) {
    logger.error('Swiss SEO analysis failed', { error: error.message });
    throw error;
  }
}

// ─── Monthly SEO Report ─────────────────────────────────────────────────────────

/**
 * Generate comprehensive monthly SEO report
 */
async function generateMonthlySEOReport() {
  logger.info('Generating monthly SEO report');

  try {
    const now = new Date();
    const monthName = now.toLocaleString('de-CH', { month: 'long', year: 'numeric' });

    // Gather data from various sources
    const articles = await getRecords('BlogArticles', '{PublishedDate} != ""', 100);
    const publishedThisMonth = articles.filter(a => {
      const pubDate = new Date(a.PublishedDate);
      return pubDate.getMonth() === now.getMonth() && pubDate.getFullYear() === now.getFullYear();
    });

    // Get recent SEO analyses
    const seoAnalyses = await getRecords('SEOAnalysis', '', 20);

    // Perform fresh analyses
    const competitorGaps = await analyzeCompetitorKeywordGaps('general', 'de');
    const swissSEO = await analyzeSwissSEO();
    const speedInsights = await generatePageSpeedInsights('https://werkpilot.ch');

    const prompt = `Generate a comprehensive monthly SEO report for Werkpilot.ch for ${monthName}.

## Content Published This Month
Articles: ${publishedThisMonth.length}
${publishedThisMonth.slice(0, 5).map(a => `- ${a.Title} (${a.PrimaryKeyword})`).join('\n') || 'No articles published'}

## Keyword Analysis
Recent keyword gaps found: ${competitorGaps.keyword_gaps?.length || 0}
Quick wins identified: ${competitorGaps.quick_wins?.length || 0}

## Swiss SEO Status
Priority actions: ${swissSEO.priority_actions?.length || 0}
${swissSEO.priority_actions?.slice(0, 3).map((a, i) => `${i + 1}. ${a}`).join('\n') || ''}

## Page Speed
Performance score: ${speedInsights.metrics?.performance_score || 'N/A'}/100
LCP: ${speedInsights.metrics?.largest_contentful_paint?.toFixed(2) || 'N/A'}s

Create a professional German-language SEO report for the CEO covering:
1. Executive Summary (3-4 sentences)
2. Content Performance (published articles and their SEO impact)
3. Keyword Strategy (new opportunities and gaps)
4. Technical SEO (Swiss-specific optimizations)
5. Page Speed & Core Web Vitals
6. Competitor Analysis Summary
7. Action Items for Next Month (prioritized)
8. SEO Health Score (0-100)

Format as HTML for email using Werkpilot brand colors (#1B2A4A for headers, #2E75B6 for accents).
Include data visualizations as simple HTML tables.`;

    const reportHtml = await generateText(prompt, {
      system: 'You are an SEO director writing a monthly report for the CEO. Professional German, data-driven, strategic.',
      model: config.models.standard,
      maxTokens: 4000,
    });

    // Send to CEO
    await sendCEOEmail({
      subject: `SEO Bericht ${monthName}`,
      html: reportHtml,
    });

    // Store report
    await createRecord('WeeklyReports', {
      Agent: 'seo-optimizer',
      Date: now.toISOString().split('T')[0],
      Type: 'monthly_seo',
      Summary: `${publishedThisMonth.length} articles published, ${competitorGaps.keyword_gaps?.length || 0} gaps found`,
      Status: 'sent',
    });

    // Sync to dashboard
    await dashboardSync.syncAgentStatus('seo_optimizer', 'active');

    logger.info(`Monthly SEO report generated and sent for ${monthName}`);
    return { status: 'sent', month: monthName, articles: publishedThisMonth.length };
  } catch (error) {
    logger.error('Monthly SEO report generation failed', { error: error.message });
    throw error;
  }
}

// ─── On-Page SEO Analysis ───────────────────────────────────────────────────────

/**
 * Analyze on-page SEO for a specific article or page
 */
async function analyzeOnPageSEO(slug) {
  logger.info(`Analyzing on-page SEO for ${slug}`);

  try {
    const articlePath = path.join(OUTPUT_DIR, `${slug}.md`);
    const content = await fs.readFile(articlePath, 'utf-8');

    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';
    const bodyContent = content.replace(/^---\n[\s\S]*?\n---\n/, '');

    const prompt = `Perform a comprehensive on-page SEO audit for this blog article.

Frontmatter:
${frontmatter}

Content (first 2000 chars):
${bodyContent.substring(0, 2000)}

Analyze:
1. Title tag optimization (50-60 chars, includes keyword)
2. Meta description (150-160 chars, compelling, includes keyword)
3. URL structure (short, keyword-rich, readable)
4. H1 tag (one only, includes keyword)
5. H2/H3 structure (logical hierarchy, includes variations)
6. Keyword placement (title, intro, headers, conclusion)
7. Image alt text (descriptive, includes keywords naturally)
8. Internal linking (3-5 relevant links)
9. External linking (authoritative sources)
10. Content length (sufficient depth for topic)
11. Readability (short paragraphs, bullet points, clear language)
12. Schema markup opportunities (FAQ, Article, HowTo)
13. Mobile-friendliness indicators

Return as JSON:
{
  "seo_score": number (0-100),
  "grade": "A|B|C|D|F",
  "checks": {
    "title_tag": { "status": "pass|fail|warning", "score": number, "issue": "string", "recommendation": "string" },
    "meta_description": { "status": "pass|fail|warning", "score": number, "issue": "string", "recommendation": "string" },
    "url_structure": { "status": "pass|fail|warning", "score": number, "issue": "string", "recommendation": "string" },
    "h1_tag": { "status": "pass|fail|warning", "score": number, "issue": "string", "recommendation": "string" },
    "header_hierarchy": { "status": "pass|fail|warning", "score": number, "issue": "string", "recommendation": "string" },
    "keyword_placement": { "status": "pass|fail|warning", "score": number, "issue": "string", "recommendation": "string" },
    "image_optimization": { "status": "pass|fail|warning", "score": number, "issue": "string", "recommendation": "string" },
    "internal_links": { "status": "pass|fail|warning", "score": number, "count": number, "recommendation": "string" },
    "content_depth": { "status": "pass|fail|warning", "score": number, "word_count": number, "recommendation": "string" },
    "readability": { "status": "pass|fail|warning", "score": number, "issue": "string", "recommendation": "string" }
  },
  "critical_issues": ["..."],
  "warnings": ["..."],
  "passed_checks": number,
  "total_checks": number,
  "improvement_priority": [
    { "item": "string", "priority": "critical|high|medium|low", "effort": "low|medium|high", "impact": "low|medium|high" }
  ]
}`;

    const analysis = await generateJSON(prompt, {
      system: 'You are an on-page SEO specialist performing detailed content audits.',
      model: config.models.standard,
    });

    logger.info(`On-page SEO analysis complete for ${slug}: ${analysis.grade} (${analysis.seo_score}/100)`);
    return analysis;
  } catch (error) {
    logger.error('On-page SEO analysis failed', { slug, error: error.message });
    throw error;
  }
}

// ─── Cron Scheduling ────────────────────────────────────────────────────────────

function startScheduler() {
  logger.info('Starting SEO Optimizer Agent scheduler');

  // Daily SEO monitoring - every day at 6:00 AM CET
  cron.schedule('0 6 * * *', async () => {
    logger.info('Cron: Running daily SEO monitoring');
    try {
      // Check recently published articles
      const recentArticles = await getRecords('BlogArticles', '{PublishedDate} >= TODAY() - 7', 10);

      for (const article of recentArticles.slice(0, 3)) {
        await analyzeOnPageSEO(article.Slug);
      }
    } catch (error) {
      logger.error('Cron: Daily SEO monitoring failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Weekly competitor analysis - every Monday at 9:00 AM CET
  cron.schedule('0 9 * * 1', async () => {
    logger.info('Cron: Running weekly competitor keyword gap analysis');
    try {
      for (const industry of ['treuhand', 'zahnarzt', 'immobilien']) {
        await analyzeCompetitorKeywordGaps(industry, 'de');
      }
    } catch (error) {
      logger.error('Cron: Competitor analysis failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Monthly SEO report - first day of month at 10:00 AM CET
  cron.schedule('0 10 1 * *', async () => {
    logger.info('Cron: Generating monthly SEO report');
    try {
      await generateMonthlySEOReport();
    } catch (error) {
      logger.error('Cron: Monthly SEO report failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Swiss SEO audit - every Wednesday at 11:00 AM CET
  cron.schedule('0 11 * * 3', async () => {
    logger.info('Cron: Running Swiss SEO audit');
    try {
      await analyzeSwissSEO();
    } catch (error) {
      logger.error('Cron: Swiss SEO audit failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  logger.info('SEO Optimizer Agent scheduler started successfully');
}

// ─── Main Entry Point ───────────────────────────────────────────────────────────

async function main() {
  logger.info('═══ SEO Optimizer Agent (Agent 13) starting ═══');

  try {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Validate SEO keywords file exists
    await fs.access(SEO_KEYWORDS_PATH);

    logger.info('SEO Optimizer Agent initialized');

    // Start the scheduler
    startScheduler();

    logger.info('═══ SEO Optimizer Agent initialized successfully ═══');
  } catch (error) {
    logger.error('SEO Optimizer Agent initialization failed', { error: error.message });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  analyzeKeywordDensity,
  analyzeCompetitorKeywordGaps,
  generatePageSpeedInsights,
  analyzeSwissSEO,
  generateMonthlySEOReport,
  analyzeOnPageSEO,
  startScheduler,
};
