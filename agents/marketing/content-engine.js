/**
 * AGENT 12 — Content Engine Agent
 *
 * Generates SEO-optimized blog content, manages content calendar,
 * handles multi-language content, and produces social media snippets.
 *
 * Responsibilities:
 * - Generate 8-12 blog articles/month via Claude
 * - SEO-optimized, natural Swiss German
 * - Includes meta title, description, slug, categories, tags
 * - Markdown format ready for Next.js
 * - Content calendar: plans 4 weeks ahead
 * - Content types: how-to, case studies, insights, comparisons
 * - Auto internal linking
 * - Social media snippets from each article
 * - Multi-language: DE first, then FR and EN
 * - Quality check: readability, keyword density
 *
 * Schedule: 2-3 articles/week, calendar planning monthly, quality checks daily
 */

const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON, getUsageStats } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const dashboardSync = require('../shared/utils/dashboard-sync');
const config = require('../shared/utils/config');

const logger = createLogger('content-engine');
const MARKETING_DIR = path.join(__dirname);
const OUTPUT_DIR = path.join(MARKETING_DIR, 'output');
const CALENDAR_PATH = path.join(MARKETING_DIR, 'content-calendar.json');
const SEO_KEYWORDS_PATH = path.join(MARKETING_DIR, 'seo-keywords.json');
const BRAND_GUIDELINES_PATH = path.join(MARKETING_DIR, 'brand-guidelines.json');

// ─── Data Loading ───────────────────────────────────────────────────────────────

/**
 * Load content calendar
 */
async function loadContentCalendar() {
  try {
    const content = await fs.readFile(CALENDAR_PATH, 'utf-8');
    const calendar = JSON.parse(content);
    logger.info(`Content calendar loaded: ${calendar.planned_articles?.length || 0} articles planned`);
    return calendar;
  } catch (error) {
    logger.error('Failed to load content calendar', { error: error.message });
    throw error;
  }
}

/**
 * Load SEO keywords database
 */
async function loadSEOKeywords() {
  try {
    const content = await fs.readFile(SEO_KEYWORDS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    logger.error('Failed to load SEO keywords', { error: error.message });
    throw error;
  }
}

/**
 * Load brand guidelines for voice/tone reference
 */
async function loadBrandGuidelines() {
  try {
    const content = await fs.readFile(BRAND_GUIDELINES_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    logger.error('Failed to load brand guidelines', { error: error.message });
    throw error;
  }
}

/**
 * Get existing published articles for internal linking
 */
async function getExistingArticles() {
  try {
    const articles = await getRecords('BlogArticles', '{Status} = "published"', 100);
    return articles.map(a => ({
      title: a.Title,
      slug: a.Slug,
      category: a.Category,
      industry: a.Industry,
      keywords: a.Keywords,
    }));
  } catch (error) {
    logger.warn('Could not fetch existing articles from Airtable', { error: error.message });
    return [];
  }
}

// ─── Article Generation ─────────────────────────────────────────────────────────

/**
 * Generate image alt-text suggestions for an article
 */
async function generateImageAltText(articleContext, imageCount = 3) {
  const prompt = `Generate ${imageCount} descriptive alt-text suggestions for images in this blog article.

Article context:
Title: ${articleContext.title}
Industry: ${articleContext.industry}
Primary keyword: ${articleContext.target_keyword}

Generate alt-text that:
- Describes the image content clearly (50-125 characters)
- Naturally includes the primary keyword where relevant
- Is helpful for screen readers
- Follows accessibility best practices

Return as JSON:
{
  "alt_texts": [
    { "id": "hero", "alt": "...", "context": "Hero/featured image" },
    { "id": "content_1", "alt": "...", "context": "Mid-article visual" },
    { "id": "content_2", "alt": "...", "context": "Supporting graphic" }
  ]
}`;

  const result = await generateJSON(prompt, {
    system: 'You are an accessibility and SEO expert creating image alt-text.',
    model: config.models.fast,
  });

  return result.alt_texts || [];
}

/**
 * Suggest internal links for an article based on content and existing articles
 */
async function generateInternalLinkSuggestions(articleContent, existingArticles, targetKeyword) {
  const prompt = `Analyze this article excerpt and suggest strategic internal links to existing content.

Article excerpt (first 1000 chars):
${articleContent.substring(0, 1000)}

Target keyword: ${targetKeyword}

Existing articles to link to:
${existingArticles.map(a => `- ${a.title} (/blog/${a.slug}) - Keywords: ${a.keywords || 'N/A'}`).join('\n')}

Suggest 3-5 natural internal link placements that:
- Add value for the reader
- Use relevant anchor text
- Strengthen the site's topic authority
- Support SEO without being spammy

Return as JSON:
{
  "suggestions": [
    {
      "anchor_text": "exact text to link",
      "target_slug": "slug-of-article",
      "context": "brief explanation of why this link helps",
      "placement": "where in article (intro/middle/conclusion)"
    }
  ]
}`;

  const result = await generateJSON(prompt, {
    system: 'You are an SEO expert specializing in internal linking strategy.',
    model: config.models.fast,
  });

  return result.suggestions || [];
}

/**
 * Generate a complete blog article with SEO optimization
 *
 * @param {object} articlePlan - Article plan from content calendar
 * @returns {object} Complete article with metadata, content, and social snippets
 */
async function generateArticle(articlePlan) {
  const { title, slug, type, industry, target_keyword, secondary_keywords, language } = articlePlan;

  logger.info(`Generating article: "${title}" (${language})`);

  const startTime = Date.now();

  try {
    const brandGuidelines = await loadBrandGuidelines();
    const existingArticles = await getExistingArticles();
    const seoKeywords = await loadSEOKeywords();

    // Get keyword cluster for the industry
    const industryKeywords = seoKeywords.target_keywords[industry] || seoKeywords.target_keywords.general_kmu;

    // Build internal linking suggestions
    const relatedArticles = existingArticles.filter(a =>
      a.industry === industry || a.category === type
    ).slice(0, 5);

    const prompt = `Write a complete, SEO-optimized blog article for Werkpilot.ch.

## Article Requirements
Title: ${title}
URL Slug: ${slug}
Type: ${type}
Industry: ${industry}
Primary Language: ${language === 'de' ? 'German (Swiss)' : language === 'fr' ? 'French (Swiss)' : 'English'}
Target Word Count: ${articlePlan.estimated_words || 1500}

## SEO Requirements
Primary Keyword: "${target_keyword}"
Secondary Keywords: ${JSON.stringify(secondary_keywords || [])}
Industry Keyword Cluster: ${JSON.stringify(industryKeywords?.cluster?.map(k => k.keyword) || [])}

SEO Rules:
- Primary keyword in H1, first paragraph, 1 H2, meta title, meta description, and alt text
- Keyword density: 1-2% for primary keyword
- Use secondary keywords naturally throughout
- Include LSI keywords (related terms)
- Write compelling meta title (50-60 chars) and meta description (150-160 chars)
- Use H2 and H3 headers with keywords
- Short paragraphs (2-4 sentences)
- Include at least 1 bullet/numbered list

## Brand Voice (Werkpilot)
${brandGuidelines.voice.rules.slice(0, 5).map(r => `- ${r}`).join('\n')}
FORBIDDEN WORDS: ${brandGuidelines.voice.forbidden_words.join(', ')}
USE "ss" NOT "ß" (Swiss German)

## Internal Links to Include
${relatedArticles.length > 0
    ? relatedArticles.map(a => `- [${a.title}](/blog/${a.slug})`).join('\n')
    : '- No existing articles yet. Add [INTERNAL_LINK] placeholders for future linking.'}

## Content Structure for "${type}"
${type === 'how_to' ? 'Introduction → Problem → Step-by-step solution → Tips → Conclusion with CTA' :
    type === 'case_study' ? 'Introduction → Challenge → Solution → Results (with numbers) → Key takeaways' :
      type === 'industry_insight' ? 'Hook → Current landscape → Trends → Impact → What to do → Conclusion' :
        type === 'comparison' ? 'Introduction → Criteria → Option A → Option B → Comparison table → Recommendation' :
          type === 'listicle' ? 'Introduction → Numbered items with explanations → Summary → CTA' :
            'Introduction → Body → Conclusion → CTA'}

Write complete article in markdown format. Be practical, specific, and Swiss-focused.
Include a compelling introduction that hooks the reader.
End with a call-to-action for Werkpilot services (subtle, not salesy).

Return as JSON:
{
  "meta": {
    "title": "SEO meta title (50-60 chars)",
    "description": "SEO meta description (150-160 chars)",
    "slug": "${slug}",
    "canonical_url": "https://werkpilot.ch/blog/${slug}",
    "categories": ["..."],
    "tags": ["..."],
    "primary_keyword": "${target_keyword}",
    "secondary_keywords": [],
    "author": "Werkpilot Team",
    "language": "${language}",
    "estimated_reading_time": number,
    "word_count": number
  },
  "content": "Full article in markdown",
  "social": {
    "linkedin": "LinkedIn post (max 200 chars)",
    "twitter": "Tweet (max 280 chars)",
    "instagram": "Instagram caption (max 150 chars + hashtags)"
  },
  "internal_links_used": ["slugs of linked articles"],
  "featured_image_alt": "Alt text for featured image",
  "schema_faq": [
    { "question": "...", "answer": "..." }
  ]
}`;

    const article = await generateJSON(prompt, {
      system: `You are an expert Swiss content writer specializing in B2B blog articles for KMU (small businesses). Write naturally in ${language === 'de' ? 'Swiss German' : language === 'fr' ? 'Swiss French' : 'English'}. Your articles are informative, practical, and SEO-optimized while maintaining a warm, professional tone.`,
      model: config.models.standard,
      maxTokens: 6000,
    });

    // Generate image alt-text suggestions
    const altTexts = await generateImageAltText({
      title,
      industry,
      target_keyword,
    }, 3);
    article.image_alt_texts = altTexts;

    // Generate internal link suggestions
    const linkSuggestions = await generateInternalLinkSuggestions(
      article.content || '',
      relatedArticles,
      target_keyword
    );
    article.internal_link_suggestions = linkSuggestions;

    // Calculate generation time and token usage
    const generationTime = Date.now() - startTime;
    const usageStats = getUsageStats();
    const todayUsage = usageStats.models?.[config.models.standard] || {};

    article.generation_metadata = {
      generation_time_ms: generationTime,
      tokens_used: {
        prompt: todayUsage.promptTokens || 0,
        completion: todayUsage.completionTokens || 0,
        total: todayUsage.totalTokens || 0,
      },
      estimated_cost_chf: (todayUsage.cost || 0) * 0.92, // USD to CHF conversion estimate
      model_used: config.models.standard,
      generated_at: new Date().toISOString(),
    };

    // Save article to output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const outputFilename = `${new Date().toISOString().split('T')[0]}_${slug}.json`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    await fs.writeFile(outputPath, JSON.stringify(article, null, 2));

    // Save markdown separately for Next.js
    const markdownPath = path.join(OUTPUT_DIR, `${slug}.md`);
    const frontmatter = `---
title: "${article.meta?.title || title}"
description: "${article.meta?.description || ''}"
slug: "${slug}"
date: "${new Date().toISOString()}"
categories: ${JSON.stringify(article.meta?.categories || [])}
tags: ${JSON.stringify(article.meta?.tags || [])}
author: "${article.meta?.author || 'Werkpilot Team'}"
language: "${language}"
reading_time: ${article.meta?.estimated_reading_time || 5}
---

${article.content || ''}
`;
    await fs.writeFile(markdownPath, frontmatter);

    // Store in Airtable
    await createRecord('BlogArticles', {
      Title: article.meta?.title || title,
      Slug: slug,
      Type: type,
      Industry: industry,
      Language: language,
      Status: 'draft',
      WordCount: article.meta?.word_count || 0,
      PrimaryKeyword: target_keyword,
      MetaDescription: article.meta?.description || '',
      PublishedDate: null,
      Agent: 'content-engine',
      TokensUsed: article.generation_metadata?.tokens_used?.total || 0,
      GenerationCost: article.generation_metadata?.estimated_cost_chf || 0,
    });

    // Sync metrics to dashboard
    await dashboardSync.syncAgentStatus('content_engine', 'active');

    logger.info(`Article generated: "${title}" (${article.meta?.word_count || 0} words)`, {
      slug,
      readingTime: article.meta?.estimated_reading_time,
      tokens: article.generation_metadata?.tokens_used?.total,
      cost: `CHF ${(article.generation_metadata?.estimated_cost_chf || 0).toFixed(2)}`,
    });

    return article;
  } catch (error) {
    logger.error('Article generation failed', { title, error: error.message });
    throw error;
  }
}

// ─── Multi-Language Support ─────────────────────────────────────────────────────

/**
 * Translate an article to another language
 */
async function translateArticle(articleSlug, targetLanguage) {
  logger.info(`Translating article ${articleSlug} to ${targetLanguage}`);

  try {
    // Load the original article
    const originalPath = path.join(OUTPUT_DIR, `${articleSlug}.md`);
    const originalContent = await fs.readFile(originalPath, 'utf-8');

    const brandGuidelines = await loadBrandGuidelines();

    const prompt = `Translate this blog article to ${targetLanguage === 'fr' ? 'French (Swiss)' : 'English'}.

## Translation Rules
- Do NOT just translate word-by-word. Adapt the content for the target audience.
- Keep SEO optimization: translate keywords naturally.
- Maintain brand voice: ${brandGuidelines.voice.tone}
- ${targetLanguage === 'fr' ? 'Use Swiss French conventions. Avoid France-specific expressions.' : 'Use British English with Swiss context.'}
- NEVER use "AI" or "KI" - use ${targetLanguage === 'fr' ? '"automatisation intelligente"' : '"intelligent automation"'}
- Keep all markdown formatting
- Translate the meta title and description
- Adapt examples to be culturally relevant for ${targetLanguage === 'fr' ? 'Romandie (French-speaking Switzerland)' : 'international'} readers

## Original Article:
${originalContent}

Return the complete translated article in the same markdown format with frontmatter.`;

    const translatedContent = await generateText(prompt, {
      system: `You are a professional Swiss ${targetLanguage === 'fr' ? 'French' : 'English'} translator specializing in B2B marketing content. You adapt content culturally, not just linguistically.`,
      model: config.models.standard,
      maxTokens: 6000,
    });

    // Save translated article
    const translatedSlug = `${articleSlug}-${targetLanguage}`;
    const translatedPath = path.join(OUTPUT_DIR, `${translatedSlug}.md`);
    await fs.writeFile(translatedPath, translatedContent);

    // Store in Airtable
    await createRecord('BlogArticles', {
      Title: `[${targetLanguage.toUpperCase()}] ${articleSlug}`,
      Slug: translatedSlug,
      Language: targetLanguage,
      Status: 'draft',
      OriginalSlug: articleSlug,
      Agent: 'content-engine',
    });

    logger.info(`Article translated: ${articleSlug} -> ${translatedSlug}`);
    return { slug: translatedSlug, content: translatedContent };
  } catch (error) {
    logger.error('Article translation failed', { articleSlug, targetLanguage, error: error.message });
    throw error;
  }
}

// ─── Quality Checks ─────────────────────────────────────────────────────────────

/**
 * Run quality checks on an article
 */
async function runQualityCheck(articleSlug) {
  logger.info(`Running quality check on: ${articleSlug}`);

  try {
    const articlePath = path.join(OUTPUT_DIR, `${articleSlug}.md`);
    const content = await fs.readFile(articlePath, 'utf-8');

    // Basic metrics
    const words = content.split(/\s+/).length;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim()).length;
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim()).length;
    const headers = (content.match(/^#{1,6}\s/gm) || []).length;
    const links = (content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;
    const images = (content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;

    // Readability estimate (Flesch-like for German is approximate)
    const avgWordsPerSentence = sentences > 0 ? words / sentences : 0;
    const readabilityScore = Math.max(0, Math.min(100,
      206.835 - (1.015 * avgWordsPerSentence) - (84.6 * (content.length / words / 6))
    ));

    const prompt = `Analyze this blog article for quality and provide a comprehensive review.

Article content (first 3000 chars):
${content.substring(0, 3000)}

Metrics:
- Word count: ${words}
- Sentences: ${sentences}
- Paragraphs: ${paragraphs}
- Headers: ${headers}
- Links: ${links}
- Images: ${images}
- Avg words/sentence: ${avgWordsPerSentence.toFixed(1)}

Check for:
1. Readability (is it easy to scan and understand?)
2. SEO optimization (keywords, headers, meta)
3. Brand voice compliance (no "KI/AI", uses "wir", professional but warm)
4. Content quality (factual, specific, Swiss-relevant)
5. Structure (intro, body, conclusion, CTA)
6. Call-to-action presence and quality
7. Internal linking opportunities

Return as JSON:
{
  "overall_score": number (0-100),
  "passed": boolean,
  "scores": {
    "readability": number,
    "seo": number,
    "brand_voice": number,
    "content_quality": number,
    "structure": number,
    "cta": number
  },
  "issues": [
    {
      "severity": "critical|warning|suggestion",
      "category": "readability|seo|brand|quality|structure",
      "description": "What's wrong",
      "fix": "How to fix it",
      "line_reference": "Approximate location"
    }
  ],
  "keyword_density": { "keyword": "percentage" },
  "improvement_suggestions": ["..."],
  "missing_elements": ["..."]
}`;

    const review = await generateJSON(prompt, {
      system: 'You are a senior content editor and SEO specialist reviewing blog articles for a Swiss B2B tech company.',
      model: config.models.fast,
    });

    review.basic_metrics = {
      words,
      sentences,
      paragraphs,
      headers,
      links,
      images,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      readabilityEstimate: Math.round(readabilityScore),
    };

    logger.info(`Quality check complete for ${articleSlug}: ${review.overall_score}/100`, {
      passed: review.passed,
      issues: review.issues?.length || 0,
    });

    return review;
  } catch (error) {
    logger.error('Quality check failed', { articleSlug, error: error.message });
    throw error;
  }
}

// ─── Content Calendar Planning ──────────────────────────────────────────────────

/**
 * Generate next month's content calendar
 */
async function planNextMonth() {
  logger.info('Planning next month\'s content calendar');

  try {
    const currentCalendar = await loadContentCalendar();
    const seoKeywords = await loadSEOKeywords();
    const existingArticles = await getExistingArticles();

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthName = nextMonth.toLocaleString('de-CH', { month: 'long', year: 'numeric' });

    const prompt = `Plan the blog content calendar for ${monthName} for Werkpilot.ch.

## Context
- Werkpilot: Digital marketing automation for Swiss KMU
- Target industries: Treuhänder, Zahnärzte, Immobilien, Anwälte, Architekten
- Article target: 8-12 articles/month
- Languages: DE (primary), FR (2-3/month), EN (1/month)
- Primary blog audience: Swiss business owners looking to grow their business online

## Content Types & Frequency
${Object.entries(currentCalendar.content_types).map(([type, config]) => `- ${type}: ${config.frequency}/${config.per} (~${config.avg_words} words)`).join('\n')}

## SEO Keyword Clusters to Target
${Object.entries(seoKeywords.target_keywords).map(([ind, data]) => `${ind}: ${data.cluster?.slice(0, 3).map(k => k.keyword).join(', ')}`).join('\n')}

## Already Published (avoid duplication)
${existingArticles.slice(0, 10).map(a => `- ${a.title} (${a.slug})`).join('\n') || 'No articles published yet'}

## Recurring Series
${currentCalendar.recurring_series.map(s => `- ${s.name} (${s.frequency}): ${s.description}`).join('\n')}

Plan 10 articles with:
1. Strategic mix of content types
2. Coverage of all key industries
3. Mix of primary and long-tail keywords
4. Seasonal relevance for ${monthName}
5. 2 articles in French, 1 in English

Return as JSON:
{
  "month": "${monthName}",
  "articles": [
    {
      "week": number,
      "title": "string",
      "slug": "string",
      "type": "how_to|case_study|industry_insight|comparison|listicle|news_commentary",
      "industry": "string",
      "target_keyword": "string",
      "secondary_keywords": ["..."],
      "language": "de|fr|en",
      "estimated_words": number,
      "publish_day": "Monday|Tuesday|Wednesday|Thursday|Friday",
      "brief": "2-3 sentence content brief"
    }
  ],
  "strategy_notes": "Why this mix was chosen"
}`;

    const plan = await generateJSON(prompt, {
      system: 'You are a content strategy director for a Swiss B2B tech company. Plan diverse, SEO-driven content calendars.',
      model: config.models.standard,
    });

    // Update calendar file
    const calendar = await loadContentCalendar();
    calendar.planned_articles = plan.articles;
    calendar.metadata.last_generated = new Date().toISOString();
    await fs.writeFile(CALENDAR_PATH, JSON.stringify(calendar, null, 2));

    // Store in Airtable
    await createRecord('ContentCalendar', {
      Month: monthName,
      ArticleCount: plan.articles?.length || 0,
      Strategy: plan.strategy_notes || '',
      Plan: JSON.stringify(plan),
      CreatedDate: new Date().toISOString(),
      Agent: 'content-engine',
    });

    logger.info(`Content calendar planned for ${monthName}: ${plan.articles?.length || 0} articles`);
    return plan;
  } catch (error) {
    logger.error('Content calendar planning failed', { error: error.message });
    throw error;
  }
}

// ─── Social Media Snippets ──────────────────────────────────────────────────────

/**
 * Generate social media snippets from an existing article
 */
async function generateSocialSnippets(articleSlug) {
  logger.info(`Generating social snippets for: ${articleSlug}`);

  try {
    const articlePath = path.join(OUTPUT_DIR, `${articleSlug}.md`);
    const content = await fs.readFile(articlePath, 'utf-8');

    const prompt = `Generate social media posts to promote this blog article.

Article:
${content.substring(0, 2000)}

Article URL: https://werkpilot.ch/blog/${articleSlug}

Generate posts for:
1. LinkedIn (3 variations: short teaser, key insight, question-based)
2. Instagram (2 variations: caption + hashtags)
3. Twitter/X (3 variations: stat-based, question, quote)
4. Facebook (1 longer post)

Rules:
- Never say "KI" or "AI"
- Professional but approachable Swiss business tone
- Include relevant hashtags
- Include call-to-action (link reference)
- Use "wir" perspective for Werkpilot
- Swiss German for DE posts (use "ss" not "ß")

Return as JSON:
{
  "linkedin": [
    { "text": "string", "hashtags": ["..."], "type": "teaser|insight|question" }
  ],
  "instagram": [
    { "caption": "string", "hashtags": ["..."] }
  ],
  "twitter": [
    { "text": "string (max 280 chars incl hashtags)" }
  ],
  "facebook": [
    { "text": "string" }
  ],
  "scheduling": {
    "best_times_linkedin": ["Tuesday 10:00", "Thursday 14:00"],
    "best_times_instagram": ["Wednesday 12:00", "Friday 09:00"],
    "drip_schedule": "Post 1 on publish day, Post 2 after 3 days, Post 3 after 7 days"
  }
}`;

    const snippets = await generateJSON(prompt, {
      system: 'You are a Swiss B2B social media specialist. Create engaging, professional posts that drive traffic to blog content.',
      model: config.models.fast,
    });

    logger.info(`Social snippets generated for ${articleSlug}`, {
      linkedin: snippets.linkedin?.length || 0,
      instagram: snippets.instagram?.length || 0,
      twitter: snippets.twitter?.length || 0,
    });

    return snippets;
  } catch (error) {
    logger.error('Social snippet generation failed', { articleSlug, error: error.message });
    throw error;
  }
}

// ─── Batch Article Generation ───────────────────────────────────────────────────

/**
 * Generate the next batch of articles from the content calendar
 */
async function generateArticleBatch(count = 3) {
  logger.info(`Generating batch of ${count} articles`);

  try {
    const calendar = await loadContentCalendar();
    const plannedArticles = (calendar.planned_articles || [])
      .filter(a => a.status === 'planned')
      .slice(0, count);

    if (plannedArticles.length === 0) {
      logger.info('No planned articles found. Consider running planNextMonth().');
      return [];
    }

    const results = [];
    for (const articlePlan of plannedArticles) {
      try {
        // Generate the article
        const article = await generateArticle(articlePlan);

        // Run quality check
        const quality = await runQualityCheck(articlePlan.slug);

        // Generate social snippets
        const social = await generateSocialSnippets(articlePlan.slug);

        // Update calendar status
        articlePlan.status = quality.passed ? 'generated' : 'needs_review';

        results.push({
          slug: articlePlan.slug,
          title: articlePlan.title,
          quality_score: quality.overall_score,
          passed: quality.passed,
          social_posts: (social.linkedin?.length || 0) + (social.twitter?.length || 0),
        });

        logger.info(`Article batch item complete: "${articlePlan.title}" (score: ${quality.overall_score})`);
      } catch (articleError) {
        logger.error(`Failed to generate article: ${articlePlan.title}`, { error: articleError.message });
        results.push({ slug: articlePlan.slug, error: articleError.message });
      }
    }

    // Save updated calendar
    await fs.writeFile(CALENDAR_PATH, JSON.stringify(calendar, null, 2));

    logger.info(`Article batch complete: ${results.filter(r => !r.error).length}/${plannedArticles.length} successful`);
    return results;
  } catch (error) {
    logger.error('Article batch generation failed', { error: error.message });
    throw error;
  }
}

// ─── Cron Scheduling ────────────────────────────────────────────────────────────

function startScheduler() {
  logger.info('Starting Content Engine Agent scheduler');

  // Generate articles batch - Monday, Wednesday, Friday at 6:00 AM CET
  cron.schedule('0 6 * * 1,3,5', async () => {
    logger.info('Cron: Generating article batch');
    try {
      await generateArticleBatch(2);
    } catch (error) {
      logger.error('Cron: Article batch generation failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Plan next month's calendar - 25th of each month at 10:00 AM CET
  cron.schedule('0 10 25 * *', async () => {
    logger.info('Cron: Planning next month\'s content');
    try {
      await planNextMonth();
    } catch (error) {
      logger.error('Cron: Content planning failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Translate latest articles to FR - Tuesdays at 7:00 AM CET
  cron.schedule('0 7 * * 2', async () => {
    logger.info('Cron: Translating articles to FR');
    try {
      const calendar = await loadContentCalendar();
      const deArticles = (calendar.planned_articles || [])
        .filter(a => a.language === 'de' && a.status === 'generated')
        .slice(0, 2);

      for (const article of deArticles) {
        await translateArticle(article.slug, 'fr');
      }
    } catch (error) {
      logger.error('Cron: Translation failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Weekly content report - Sundays at 18:00 CET
  cron.schedule('0 18 * * 0', async () => {
    logger.info('Cron: Generating weekly content report');
    try {
      const articles = await getRecords('BlogArticles', '{CreatedDate} >= TODAY() - 7', 50);
      const generated = articles.filter(a => a.Status !== 'planned').length;
      const published = articles.filter(a => a.Status === 'published').length;

      await sendCEOEmail({
        subject: 'Content Engine - Wochenbericht',
        html: `
          <h2 style="color: #1B2A4A;">Content Engine Wochenbericht</h2>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #E9ECEF;"><strong>Artikel generiert:</strong></td><td style="padding: 8px;">${generated}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #E9ECEF;"><strong>Artikel veröffentlicht:</strong></td><td style="padding: 8px;">${published}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #E9ECEF;"><strong>Total diese Woche:</strong></td><td style="padding: 8px;">${articles.length}</td></tr>
          </table>
          <p style="color: #6C757D; font-size: 12px; margin-top: 16px;">Automatisch generiert vom Content Engine Agent</p>
        `,
      });
    } catch (error) {
      logger.error('Cron: Weekly report failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  logger.info('Content Engine Agent scheduler started successfully');
}

// ─── Main Entry Point ───────────────────────────────────────────────────────────

async function main() {
  logger.info('═══ Content Engine Agent (Agent 12) starting ═══');

  try {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Load and validate data
    const calendar = await loadContentCalendar();
    const seoKeywords = await loadSEOKeywords();
    const brandGuidelines = await loadBrandGuidelines();

    logger.info('Content Engine initialized', {
      planned_articles: calendar.planned_articles?.length || 0,
      keyword_industries: Object.keys(seoKeywords.target_keywords).length,
      brand_rules: brandGuidelines.voice.rules.length,
    });

    // Start the scheduler
    startScheduler();

    logger.info('═══ Content Engine Agent initialized successfully ═══');
  } catch (error) {
    logger.error('Content Engine Agent initialization failed', { error: error.message });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  loadContentCalendar,
  loadSEOKeywords,
  generateArticle,
  generateImageAltText,
  generateInternalLinkSuggestions,
  translateArticle,
  runQualityCheck,
  planNextMonth,
  generateSocialSnippets,
  generateArticleBatch,
  startScheduler,
};
