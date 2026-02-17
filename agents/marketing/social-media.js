/**
 * AGENT 14 — Social Media Agent
 *
 * Advanced social media management for Werkpilot across multiple platforms.
 * Platform-specific content optimization, Swiss market hashtags, and scheduling.
 *
 * Responsibilities:
 * - Platform-specific content adaptation (LinkedIn, Instagram, Twitter, Facebook)
 * - Hashtag optimization for Swiss market
 * - Post scheduling with optimal time slots (Swiss timezone)
 * - Engagement metrics tracking
 * - A/B content variants generation
 * - Swiss German tone adaptation
 * - Multi-format content (text, carousel, video scripts)
 * - Social listening and trend monitoring
 *
 * Schedule: Daily posting, continuous monitoring, weekly performance analysis
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

const logger = createLogger('social-media');
const MARKETING_DIR = path.join(__dirname);
const OUTPUT_DIR = path.join(MARKETING_DIR, 'output');
const BRAND_GUIDELINES_PATH = path.join(MARKETING_DIR, 'brand-guidelines.json');

// Platform-specific constraints and best practices
const PLATFORM_SPECS = {
  linkedin: {
    maxLength: 3000,
    optimalLength: 150,
    hashtagLimit: 5,
    imageFormats: ['1200x627', '1080x1080'],
    tone: 'professional, insightful, B2B',
    bestTimes: ['Tuesday 10:00', 'Wednesday 12:00', 'Thursday 09:00', 'Thursday 14:00'],
  },
  instagram: {
    maxLength: 2200,
    optimalLength: 138,
    hashtagLimit: 30,
    optimalHashtags: 11,
    imageFormats: ['1080x1080', '1080x1350'],
    tone: 'visual, authentic, behind-the-scenes',
    bestTimes: ['Wednesday 11:00', 'Friday 10:00', 'Sunday 19:00'],
  },
  twitter: {
    maxLength: 280,
    optimalLength: 240,
    hashtagLimit: 3,
    imageFormats: ['1200x675'],
    tone: 'concise, timely, conversational',
    bestTimes: ['Monday 08:00', 'Wednesday 09:00', 'Friday 09:00'],
  },
  facebook: {
    maxLength: 63206,
    optimalLength: 250,
    hashtagLimit: 3,
    imageFormats: ['1200x630'],
    tone: 'friendly, community-focused, accessible',
    bestTimes: ['Wednesday 11:00', 'Thursday 13:00', 'Friday 09:00'],
  },
};

// ─── Platform-Specific Content Adaptation ──────────────────────────────────────

/**
 * Generate platform-specific content variants from a base message
 */
async function adaptContentForPlatforms(baseContent, context = {}) {
  logger.info('Adapting content for multiple platforms');

  const { topic, industry, targetAudience, cta, url, language = 'de' } = context;

  try {
    const brandGuidelines = JSON.parse(await fs.readFile(BRAND_GUIDELINES_PATH, 'utf-8'));

    const prompt = `Adapt this content for multiple social media platforms (LinkedIn, Instagram, Twitter, Facebook).

Base content:
${baseContent}

Context:
- Topic: ${topic || 'Swiss KMU digital marketing'}
- Industry: ${industry || 'general'}
- Target audience: ${targetAudience || 'Swiss business owners'}
- CTA: ${cta || 'Learn more'}
- URL: ${url || 'https://werkpilot.ch'}
- Language: ${language === 'de' ? 'Swiss German (use "ss" not "ß")' : language === 'fr' ? 'Swiss French' : 'English'}

Platform-specific requirements:

LINKEDIN (Professional B2B):
- Length: ~150 chars optimal, max 3000
- Tone: Professional, insightful, thought leadership
- Format: Start with hook, add value, end with question or CTA
- Hashtags: Max 5, industry-relevant
- Include: Business insights, data points, practical tips

INSTAGRAM (Visual storytelling):
- Length: ~138 chars optimal for caption
- Tone: Authentic, visual, relatable
- Format: Engaging caption + emoji + line breaks for readability
- Hashtags: 11-15 optimal, mix of broad and niche
- Include: Visual description, storytelling, personality

TWITTER (Concise engagement):
- Length: Max 280 chars (leave room for RT)
- Tone: Concise, timely, conversational
- Format: Hook + value + CTA in minimal words
- Hashtags: Max 3, highly relevant
- Include: Clear message, urgency, direct CTA

FACEBOOK (Community building):
- Length: ~250 chars optimal
- Tone: Friendly, accessible, community-focused
- Format: Conversational opener + story + engagement question
- Hashtags: 1-3, not critical for Facebook
- Include: Questions, community feel, shareability

Brand voice:
${brandGuidelines.voice.tone}
NEVER use: ${brandGuidelines.voice.forbidden_words.join(', ')}

Return as JSON:
{
  "linkedin": {
    "text": "Full post text",
    "hashtags": ["SwissKMU", "Digitalisierung", ...],
    "char_count": number,
    "hook": "First sentence that grabs attention",
    "cta": "Call to action"
  },
  "instagram": {
    "caption": "Caption with emoji and line breaks",
    "hashtags": ["werkpilot", "swissbusiness", ...],
    "char_count": number,
    "visual_suggestion": "What image/graphic would work best"
  },
  "twitter": {
    "text": "Tweet text (max 280 chars)",
    "hashtags": ["included", "in", "text"],
    "char_count": number,
    "thread_opportunity": "Could this be expanded into a thread? How?"
  },
  "facebook": {
    "text": "Facebook post text",
    "hashtags": ["optional"],
    "char_count": number,
    "engagement_question": "Question to spark comments"
  },
  "posting_strategy": {
    "linkedin_time": "Tuesday 10:00",
    "instagram_time": "Wednesday 11:00",
    "twitter_time": "Monday 08:00",
    "facebook_time": "Wednesday 11:00",
    "drip_schedule": "Which platform to post when"
  }
}`;

    const variants = await generateJSON(prompt, {
      system: `You are a Swiss social media expert creating platform-optimized content for B2B audiences. Write in ${language === 'de' ? 'Swiss German' : language === 'fr' ? 'Swiss French' : 'English'}.`,
      model: config.models.standard,
    });

    logger.info('Content adapted for platforms', {
      linkedin: variants.linkedin?.char_count,
      instagram: variants.instagram?.char_count,
      twitter: variants.twitter?.char_count,
      facebook: variants.facebook?.char_count,
    });

    return variants;
  } catch (error) {
    logger.error('Platform content adaptation failed', { error: error.message });
    throw error;
  }
}

// ─── Swiss Market Hashtag Optimization ─────────────────────────────────────────

/**
 * Generate optimized hashtags for Swiss market
 */
async function generateSwissHashtags(topic, platform, industry, language = 'de') {
  logger.info(`Generating Swiss hashtags for ${topic} on ${platform}`);

  try {
    const maxHashtags = PLATFORM_SPECS[platform]?.optimalHashtags || PLATFORM_SPECS[platform]?.hashtagLimit || 5;

    const prompt = `Generate optimized hashtags for a Swiss ${industry} business post about "${topic}" on ${platform}.

Platform: ${platform}
Max hashtags: ${maxHashtags}
Language: ${language}
Industry: ${industry}

Hashtag strategy:
1. Brand hashtags (werkpilot, your brand)
2. Swiss-specific hashtags (ch, swiss, schweiz, suisse)
3. Industry hashtags (${industry}-specific)
4. Topic hashtags (related to "${topic}")
5. Trending hashtags (if relevant)

Mix of:
- High reach (100k+ posts): 2-3 hashtags
- Medium reach (10k-100k posts): 3-5 hashtags
- Niche reach (<10k posts): 2-4 hashtags

Swiss market specifics:
- Use German hashtags primarily (#schweiz not #germany)
- Include multilingual variants for reach (#swiss #schweiz #suisse)
- Use KMU-related tags (#kmu #sme #pme)
- City tags where relevant (#zürich #bern #basel #genève)

Return as JSON:
{
  "hashtags": [
    {
      "tag": "#ExactHashtag",
      "category": "brand|swiss|industry|topic|trending|city",
      "reach": "high|medium|niche",
      "estimated_posts": "10k|50k|200k",
      "reason": "Why this hashtag is valuable"
    }
  ],
  "primary_tags": ["Most important 3-5 tags"],
  "optional_tags": ["Additional tags if space allows"],
  "hashtag_string": "#tag1 #tag2 #tag3 (ready to copy-paste)"
}`;

    const result = await generateJSON(prompt, {
      system: 'You are a Swiss social media hashtag strategist with deep knowledge of local trends and reach.',
      model: config.models.fast,
    });

    logger.info(`Generated ${result.hashtags?.length || 0} hashtags for ${platform}`);
    return result;
  } catch (error) {
    logger.error('Swiss hashtag generation failed', { error: error.message });
    throw error;
  }
}

// ─── Post Scheduling ────────────────────────────────────────────────────────────

/**
 * Generate optimal posting schedule for Swiss timezone
 */
function generatePostingSchedule(postsPerWeek = 7, platforms = ['linkedin', 'instagram', 'twitter']) {
  logger.info('Generating posting schedule');

  const schedule = [];
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Distribute posts across platforms and days
  let postIndex = 0;
  for (let i = 0; i < postsPerWeek; i++) {
    const platform = platforms[postIndex % platforms.length];
    const dayIndex = Math.floor(postIndex / platforms.length) % 7;
    const day = daysOfWeek[dayIndex];

    // Get platform-specific best times
    const bestTimes = PLATFORM_SPECS[platform]?.bestTimes || ['09:00'];
    const time = bestTimes[Math.floor(Math.random() * bestTimes.length)];

    schedule.push({
      day,
      time,
      platform,
      timezone: 'Europe/Zurich',
      datetime: `${day} ${time} CET`,
    });

    postIndex++;
  }

  // Sort by day of week
  const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
  schedule.sort((a, b) => dayOrder[a.day] - dayOrder[b.day]);

  logger.info(`Posting schedule generated: ${schedule.length} posts across ${platforms.length} platforms`);
  return schedule;
}

// ─── A/B Content Variants ───────────────────────────────────────────────────────

/**
 * Generate A/B test variants for a social media post
 */
async function generateABVariants(basePost, platform, testFocus = 'cta') {
  logger.info(`Generating A/B variants for ${platform}, testing ${testFocus}`);

  try {
    const prompt = `Create A/B test variants for this ${platform} post.

Base post:
${JSON.stringify(basePost, null, 2)}

Test focus: ${testFocus}
Options: "hook" (opening line), "cta" (call-to-action), "hashtags", "format", "tone"

Generate 3 distinct variants:
- Variant A: ${testFocus === 'hook' ? 'Question-based hook' : testFocus === 'cta' ? 'Direct CTA' : testFocus === 'hashtags' ? 'Broad hashtags' : testFocus === 'format' ? 'Short format' : 'Professional tone'}
- Variant B: ${testFocus === 'hook' ? 'Stat-based hook' : testFocus === 'cta' ? 'Soft CTA' : testFocus === 'hashtags' ? 'Niche hashtags' : testFocus === 'format' ? 'Long format' : 'Casual tone'}
- Variant C: ${testFocus === 'hook' ? 'Story-based hook' : testFocus === 'cta' ? 'Curiosity CTA' : testFocus === 'hashtags' ? 'Mixed hashtags' : testFocus === 'format' ? 'List format' : 'Inspiring tone'}

Each variant should:
- Maintain the core message
- Be optimized for ${platform}
- Test ONLY the ${testFocus} element (keep everything else consistent)
- Be trackable (we'll measure engagement, clicks, conversions)

Return as JSON:
{
  "test_hypothesis": "What we expect to learn from this test",
  "variants": [
    {
      "id": "A",
      "name": "Descriptive name",
      "text": "Full post text",
      "hashtags": ["..."],
      "difference_from_base": "What's different in this variant",
      "expected_performance": "Who this might resonate with"
    },
    {
      "id": "B",
      "name": "Descriptive name",
      "text": "Full post text",
      "hashtags": ["..."],
      "difference_from_base": "What's different",
      "expected_performance": "Expected audience response"
    },
    {
      "id": "C",
      "name": "Descriptive name",
      "text": "Full post text",
      "hashtags": ["..."],
      "difference_from_base": "What's different",
      "expected_performance": "Expected audience response"
    }
  ],
  "success_metrics": ["What to track to determine winner"],
  "recommended_test_duration": "How long to run test (days)"
}`;

    const result = await generateJSON(prompt, {
      system: 'You are a social media growth expert specializing in A/B testing and conversion optimization.',
      model: config.models.standard,
    });

    // Store A/B test in Airtable
    await createRecord('SocialABTests', {
      Platform: platform,
      TestFocus: testFocus,
      Hypothesis: result.test_hypothesis || '',
      VariantsJSON: JSON.stringify(result.variants),
      Status: 'draft',
      Date: new Date().toISOString().split('T')[0],
      Agent: 'social-media',
    });

    logger.info(`A/B variants generated for ${platform}`, {
      variants: result.variants?.length || 0,
      testFocus,
    });

    return result;
  } catch (error) {
    logger.error('A/B variant generation failed', { error: error.message });
    throw error;
  }
}

// ─── Engagement Metrics Tracking ────────────────────────────────────────────────

/**
 * Track and analyze social media engagement metrics
 */
async function trackEngagementMetrics(platform, postId, metrics) {
  logger.info(`Tracking engagement metrics for ${platform} post ${postId}`);

  try {
    const {
      impressions = 0,
      reach = 0,
      likes = 0,
      comments = 0,
      shares = 0,
      clicks = 0,
      saves = 0,
    } = metrics;

    // Calculate engagement rate
    const totalEngagements = likes + comments + shares + (saves || 0);
    const engagementRate = impressions > 0 ? (totalEngagements / impressions) * 100 : 0;
    const clickThroughRate = impressions > 0 ? (clicks / impressions) * 100 : 0;

    const metricsData = {
      Platform: platform,
      PostID: postId,
      Impressions: impressions,
      Reach: reach,
      Likes: likes,
      Comments: comments,
      Shares: shares,
      Clicks: clicks,
      Saves: saves,
      EngagementRate: engagementRate,
      ClickThroughRate: clickThroughRate,
      Date: new Date().toISOString().split('T')[0],
      Agent: 'social-media',
    };

    // Store in Airtable
    await createRecord('SocialMetrics', metricsData);

    // Sync to dashboard
    await dashboardSync.syncAgentStatus('social_media', 'active', Math.round(engagementRate));

    logger.info(`Engagement metrics tracked for ${platform}`, {
      engagementRate: `${engagementRate.toFixed(2)}%`,
      ctr: `${clickThroughRate.toFixed(2)}%`,
    });

    return { ...metricsData, status: 'tracked' };
  } catch (error) {
    logger.error('Engagement metrics tracking failed', { error: error.message });
    throw error;
  }
}

// ─── Content Calendar Integration ──────────────────────────────────────────────

/**
 * Generate social media posts from blog content calendar
 */
async function generatePostsFromContentCalendar() {
  logger.info('Generating social media posts from content calendar');

  try {
    // Get recently published blog articles
    const recentArticles = await getRecords('BlogArticles', '{Status} = "published"', 10);

    if (recentArticles.length === 0) {
      logger.info('No published articles found for social media promotion');
      return [];
    }

    const posts = [];

    for (const article of recentArticles.slice(0, 3)) {
      const baseContent = `New blog post: ${article.Title}\n\n${article.MetaDescription || 'Learn more about ' + article.PrimaryKeyword}`;

      const variants = await adaptContentForPlatforms(baseContent, {
        topic: article.Title,
        industry: article.Industry || 'general',
        targetAudience: 'Swiss business owners',
        cta: 'Read the article',
        url: `https://werkpilot.ch/blog/${article.Slug}`,
        language: article.Language || 'de',
      });

      posts.push({
        article_slug: article.Slug,
        article_title: article.Title,
        variants,
        created_at: new Date().toISOString(),
      });

      // Save to output
      const outputPath = path.join(OUTPUT_DIR, `social_${article.Slug}.json`);
      await fs.writeFile(outputPath, JSON.stringify({ article, variants }, null, 2));
    }

    logger.info(`Generated social posts for ${posts.length} articles`);
    return posts;
  } catch (error) {
    logger.error('Social posts generation from calendar failed', { error: error.message });
    throw error;
  }
}

// ─── Weekly Performance Analysis ────────────────────────────────────────────────

/**
 * Generate weekly social media performance report
 */
async function generateWeeklyReport() {
  logger.info('Generating weekly social media performance report');

  try {
    // Get last 7 days of metrics
    const metrics = await getRecords('SocialMetrics', '{Date} >= TODAY() - 7', 100);

    // Aggregate by platform
    const platformStats = {};
    for (const platform of ['linkedin', 'instagram', 'twitter', 'facebook']) {
      const platformMetrics = metrics.filter(m => m.Platform === platform);

      platformStats[platform] = {
        posts: platformMetrics.length,
        total_impressions: platformMetrics.reduce((sum, m) => sum + (m.Impressions || 0), 0),
        total_engagements: platformMetrics.reduce((sum, m) =>
          sum + (m.Likes || 0) + (m.Comments || 0) + (m.Shares || 0), 0),
        avg_engagement_rate: platformMetrics.length > 0
          ? platformMetrics.reduce((sum, m) => sum + (m.EngagementRate || 0), 0) / platformMetrics.length
          : 0,
        total_clicks: platformMetrics.reduce((sum, m) => sum + (m.Clicks || 0), 0),
      };
    }

    const prompt = `Generate a weekly social media performance report for Werkpilot.

Platform Statistics:
${JSON.stringify(platformStats, null, 2)}

Total posts this week: ${metrics.length}

Create a professional German-language report for the CEO covering:
1. Executive Summary (2-3 sentences)
2. Platform Performance Breakdown
3. Top Performing Posts (if data available)
4. Engagement Trends
5. Growth Metrics
6. Content Insights (what worked, what didn't)
7. Action Items for Next Week

Format as HTML for email using Werkpilot brand colors (#1B2A4A for headers, #2E75B6 for accents).`;

    const reportHtml = await generateText(prompt, {
      system: 'You are a social media manager writing a weekly performance report. Professional German, data-driven.',
      model: config.models.standard,
      maxTokens: 3000,
    });

    // Send to CEO
    await sendCEOEmail({
      subject: 'Social Media - Wochenbericht',
      html: reportHtml,
    });

    // Store report
    await createRecord('WeeklyReports', {
      Agent: 'social-media',
      Date: new Date().toISOString().split('T')[0],
      Type: 'weekly_social',
      Summary: `${metrics.length} posts, ${platformStats.linkedin?.total_impressions || 0} impressions`,
      Status: 'sent',
    });

    logger.info('Weekly social media report generated and sent');
    return { status: 'sent', metrics: platformStats };
  } catch (error) {
    logger.error('Weekly social media report generation failed', { error: error.message });
    throw error;
  }
}

// ─── Cron Scheduling ────────────────────────────────────────────────────────────

function startScheduler() {
  logger.info('Starting Social Media Agent scheduler');

  // Generate social posts from new blog articles - daily at 7:30 AM CET
  cron.schedule('30 7 * * *', async () => {
    logger.info('Cron: Generating social posts from content calendar');
    try {
      await generatePostsFromContentCalendar();
    } catch (error) {
      logger.error('Cron: Social post generation failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  // Weekly performance report - Mondays at 9:00 AM CET
  cron.schedule('0 9 * * 1', async () => {
    logger.info('Cron: Generating weekly social media report');
    try {
      await generateWeeklyReport();
    } catch (error) {
      logger.error('Cron: Weekly report failed', { error: error.message });
    }
  }, { timezone: 'Europe/Zurich' });

  logger.info('Social Media Agent scheduler started successfully');
}

// ─── Main Entry Point ───────────────────────────────────────────────────────────

async function main() {
  logger.info('═══ Social Media Agent (Agent 14) starting ═══');

  try {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Validate brand guidelines exist
    await fs.access(BRAND_GUIDELINES_PATH);

    logger.info('Social Media Agent initialized');

    // Start the scheduler
    startScheduler();

    logger.info('═══ Social Media Agent initialized successfully ═══');
  } catch (error) {
    logger.error('Social Media Agent initialization failed', { error: error.message });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  adaptContentForPlatforms,
  generateSwissHashtags,
  generatePostingSchedule,
  generateABVariants,
  trackEngagementMetrics,
  generatePostsFromContentCalendar,
  generateWeeklyReport,
  startScheduler,
  PLATFORM_SPECS,
};
