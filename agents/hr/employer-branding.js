/**
 * Werkpilot Agent 36 — Employer Branding Agent
 *
 * Manages Werkpilot's employer brand across platforms:
 * - Generates LinkedIn employer content ("Life at Werkpilot" posts)
 * - Glassdoor profile management and response drafts
 * - "We're hiring" posts optimized per platform
 * - Culture content: values, mission, work environment
 * - Freelancer testimonials collection and publishing
 *
 * Schedule: Twice weekly - Tuesday and Thursday at 10:00 CET
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('hr-employer-branding');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AIRTABLE_TABLES = {
  brandContent: 'EmployerBrandContent',
  testimonials: 'FreelancerTestimonials',
  hiringPosts: 'HiringPosts',
  glassdoorResponses: 'GlassdoorResponses',
};

const CONTENT_DIR = path.join(__dirname, 'content');
const VALUES_PATH = path.join(CONTENT_DIR, 'culture-values.json');

/**
 * Load the Werkpilot culture values.
 */
function loadCultureValues() {
  if (!fs.existsSync(VALUES_PATH)) {
    logger.warn('Culture values file not found, using defaults');
    return {
      values: [
        { name: 'Innovation', description: 'AI-first approach to solving business problems' },
        { name: 'Schweizer Qualitaet', description: 'Swiss precision and reliability in everything we do' },
        { name: 'Kundenorientierung', description: 'Customer success is our success' },
        { name: 'Effizienz', description: 'Automate what can be automated, focus humans on what matters' },
        { name: 'Vertrauen', description: 'Trust through transparency, reliability, and results' },
      ],
    };
  }
  return JSON.parse(fs.readFileSync(VALUES_PATH, 'utf-8'));
}

// ---------------------------------------------------------------------------
// LinkedIn Content Generation
// ---------------------------------------------------------------------------

const LINKEDIN_CONTENT_TYPES = [
  'life-at-werkpilot',
  'team-spotlight',
  'behind-the-scenes',
  'tech-culture',
  'values-highlight',
  'milestone-celebration',
  'learning-culture',
  'remote-work-tips',
];

/**
 * Generate a LinkedIn employer branding post.
 */
async function generateLinkedInPost(contentType = null) {
  const culture = loadCultureValues();
  const type = contentType || LINKEDIN_CONTENT_TYPES[Math.floor(Math.random() * LINKEDIN_CONTENT_TYPES.length)];

  const prompt = `Create a LinkedIn employer branding post for Werkpilot.

COMPANY: Werkpilot - Swiss AI automation startup
CONTENT TYPE: ${type}
COMPANY VALUES: ${JSON.stringify(culture.values)}

GUIDELINES:
- Write from Werkpilot's company page perspective
- 150-300 words (LinkedIn optimal length)
- Include 1-2 relevant emojis (not excessive)
- End with a call-to-action (visit careers page, follow us, etc.)
- Use storytelling when possible
- Authentic, not corporate-speak
- Mix English and German naturally (Swiss style)
- Include 3-5 relevant hashtags

CONTENT TYPE SPECIFICS:
- life-at-werkpilot: Day in the life, team rituals, workspace vibes
- team-spotlight: Highlight a team member or role (use fictional but realistic example)
- behind-the-scenes: How we build our AI agents, our tech stack
- tech-culture: Innovation culture, hackathons, learning
- values-highlight: Deep dive into one of our values
- milestone-celebration: Company achievement or growth metric
- learning-culture: How we grow and learn as a team
- remote-work-tips: Our async-first approach, tools we use

Return JSON:
{
  "type": "${type}",
  "title": "internal reference title",
  "content": "the full LinkedIn post text",
  "hashtags": ["#tag1", "#tag2"],
  "suggestedImage": "description of ideal accompanying image",
  "bestPostingTime": "suggested day and time",
  "engagementHook": "the opening line designed to stop the scroll"
}`;

  const post = await generateJSON(prompt, {
    system: 'You are a LinkedIn content strategist specializing in employer branding for tech startups. Write authentic, engaging content that attracts top talent.',
    model: config.models.standard,
    maxTokens: 1500,
  });

  logger.info(`Generated LinkedIn post: "${post.title}" (${type})`);
  return post;
}

/**
 * Generate a batch of LinkedIn posts for the content calendar.
 */
async function generateContentCalendar(weeks = 2) {
  const posts = [];
  const postsPerWeek = 3;

  for (let w = 0; w < weeks; w++) {
    for (let p = 0; p < postsPerWeek; p++) {
      const typeIndex = (w * postsPerWeek + p) % LINKEDIN_CONTENT_TYPES.length;
      try {
        const post = await generateLinkedInPost(LINKEDIN_CONTENT_TYPES[typeIndex]);
        post.scheduledWeek = w + 1;
        post.scheduledDay = ['Monday', 'Wednesday', 'Friday'][p];
        posts.push(post);

        // Save to Airtable
        await createRecord(AIRTABLE_TABLES.brandContent, {
          Title: post.title,
          Type: post.type,
          Platform: 'LinkedIn',
          Content: post.content,
          Hashtags: post.hashtags.join(', '),
          Status: 'draft',
          ScheduledWeek: post.scheduledWeek,
          ScheduledDay: post.scheduledDay,
          CreatedAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.error(`Failed to generate post ${typeIndex}: ${err.message}`);
      }
    }
  }

  logger.info(`Generated ${posts.length} posts for ${weeks}-week content calendar`);
  return posts;
}

// ---------------------------------------------------------------------------
// Glassdoor Management
// ---------------------------------------------------------------------------

/**
 * Generate a response to a Glassdoor review.
 */
async function generateGlassdoorResponse(review) {
  const prompt = `Draft a professional response to this Glassdoor review for Werkpilot.

REVIEW:
- Rating: ${review.rating}/5
- Title: ${review.title}
- Pros: ${review.pros}
- Cons: ${review.cons}
- Advice: ${review.advice || 'None'}

RESPONSE GUIDELINES:
- Thank the reviewer genuinely
- Address specific points (both positive and negative)
- If negative: acknowledge, don't be defensive, share what you're doing about it
- If positive: express genuine gratitude, reinforce the culture
- Keep it professional but human
- 100-200 words
- Sign off as "The Werkpilot Team"

Return JSON:
{
  "response": "the full response text",
  "sentiment": "positive|mixed|negative",
  "keyThemes": ["theme1", "theme2"],
  "actionItems": ["any internal actions to consider"],
  "priority": "high|medium|low"
}`;

  const result = await generateJSON(prompt, {
    system: 'You are an employer brand manager skilled at authentic, empathetic review responses.',
    model: config.models.standard,
    maxTokens: 1000,
  });

  logger.info(`Generated Glassdoor response for review: "${review.title}" (${result.sentiment})`);
  return result;
}

/**
 * Process pending Glassdoor reviews that need responses.
 */
async function processGlassdoorReviews() {
  logger.info('Processing pending Glassdoor reviews...');

  const reviews = await getRecords(
    AIRTABLE_TABLES.glassdoorResponses,
    "{Status} = 'pending'",
    20
  );

  if (reviews.length === 0) {
    logger.info('No pending Glassdoor reviews');
    return [];
  }

  const results = [];

  for (const review of reviews) {
    try {
      const response = await generateGlassdoorResponse(review);

      await updateRecord(AIRTABLE_TABLES.glassdoorResponses, review.id, {
        DraftResponse: response.response,
        Sentiment: response.sentiment,
        Priority: response.priority,
        ActionItems: response.actionItems.join('; '),
        Status: 'draft-ready',
        ProcessedAt: new Date().toISOString(),
      });

      results.push({
        title: review.title,
        rating: review.rating,
        sentiment: response.sentiment,
        priority: response.priority,
      });
    } catch (err) {
      logger.error(`Failed to process Glassdoor review ${review.id}: ${err.message}`);
    }
  }

  logger.info(`Processed ${results.length} Glassdoor reviews`);
  return results;
}

// ---------------------------------------------------------------------------
// "We're Hiring" Posts
// ---------------------------------------------------------------------------

/**
 * Generate a "we're hiring" post for a specific platform.
 */
async function generateHiringPost(role, platform) {
  const culture = loadCultureValues();

  const prompt = `Create a "We're Hiring" post for Werkpilot.

ROLE: ${role}
PLATFORM: ${platform}
COMPANY VALUES: ${JSON.stringify(culture.values)}

PLATFORM GUIDELINES:
- linkedin: Professional, detailed, company culture emphasis. 200-400 words.
- twitter: Punchy, concise, high energy. Max 280 chars + thread option.
- instagram: Visual-focused description, storytelling, aspirational. 150-200 words.
- facebook: Community-focused, relatable, shareable. 150-300 words.
- website: SEO-friendly, comprehensive, with clear application instructions.

Include:
- What makes this role exciting
- Why Werkpilot is a great place to work
- Key requirements (brief)
- How to apply
- A compelling hook

Return JSON:
{
  "platform": "${platform}",
  "role": "${role}",
  "headline": "attention-grabbing headline",
  "content": "full post text",
  "callToAction": "specific CTA",
  "hashtags": ["#tag1", "#tag2"],
  "suggestedVisual": "image/video description"
}`;

  const post = await generateJSON(prompt, {
    system: 'You are a recruitment marketing specialist. Create posts that make top talent excited about the opportunity.',
    model: config.models.standard,
    maxTokens: 1500,
  });

  logger.info(`Generated hiring post for ${role} on ${platform}`);
  return post;
}

/**
 * Generate hiring posts across all platforms for a role.
 */
async function publishHiringCampaign(role) {
  const platforms = ['linkedin', 'twitter', 'instagram', 'website'];
  const posts = [];

  for (const platform of platforms) {
    try {
      const post = await generateHiringPost(role, platform);

      await createRecord(AIRTABLE_TABLES.hiringPosts, {
        Role: role,
        Platform: platform,
        Headline: post.headline,
        Content: post.content,
        Hashtags: post.hashtags.join(', '),
        Status: 'draft',
        CreatedAt: new Date().toISOString(),
      });

      posts.push(post);
    } catch (err) {
      logger.error(`Failed hiring post for ${role} on ${platform}: ${err.message}`);
    }
  }

  logger.info(`Generated ${posts.length} hiring posts for ${role}`);
  return posts;
}

// ---------------------------------------------------------------------------
// Freelancer Testimonials
// ---------------------------------------------------------------------------

/**
 * Generate a testimonial request email for a freelancer.
 */
async function generateTestimonialRequest(freelancer) {
  const prompt = `Write a personalized email requesting a testimonial from a freelancer.

FREELANCER: ${freelancer.Name}
ROLE: ${freelancer.Role}
TENURE: ${freelancer.TenureMonths || 'several'} months
HIGHLIGHTS: ${freelancer.Highlights || 'consistent quality work'}

The email should:
- Be warm and personal
- Explain why their testimonial matters
- Provide 3-4 specific questions to guide their response
- Make it easy (suggest 5-10 minutes)
- Mention it may be used on LinkedIn/website (with permission)

Return JSON:
{
  "subject": "email subject line",
  "body": "full email text",
  "questions": ["q1", "q2", "q3"]
}`;

  return await generateJSON(prompt, {
    model: config.models.fast,
    maxTokens: 1000,
  });
}

/**
 * Polish a raw testimonial into publishable formats.
 */
async function polishTestimonial(rawTestimonial, freelancerName, role) {
  const prompt = `Polish this freelancer testimonial for Werkpilot's employer branding.

RAW TESTIMONIAL: ${rawTestimonial}
FROM: ${freelancerName}, ${role}

Create multiple versions:
{
  "linkedinQuote": "2-3 sentence version for LinkedIn posts (with quotation marks)",
  "websiteTestimonial": "3-5 sentence version for the website careers page",
  "shortQuote": "1 sentence pull-quote for graphics",
  "keyThemes": ["theme1", "theme2"],
  "suggestedVisualStyle": "description of visual treatment"
}

Keep the original voice and meaning. Do not fabricate details.`;

  return await generateJSON(prompt, {
    model: config.models.standard,
    maxTokens: 1000,
  });
}

// ---------------------------------------------------------------------------
// Culture Content
// ---------------------------------------------------------------------------

/**
 * Generate culture-focused content around a specific value.
 */
async function generateCultureContent(valueName) {
  const culture = loadCultureValues();
  const value = culture.values.find(v => v.name.toLowerCase() === valueName.toLowerCase());

  if (!value) {
    logger.warn(`Value not found: ${valueName}`);
    return null;
  }

  const prompt = `Create culture content highlighting Werkpilot's value: "${value.name}"

VALUE: ${value.name}
DESCRIPTION: ${value.description}
ALL VALUES: ${culture.values.map(v => v.name).join(', ')}

Generate:
{
  "valueName": "${value.name}",
  "linkedinPost": "300-word LinkedIn post about how this value shows up daily",
  "internalMessage": "200-word internal team message reinforcing this value",
  "storyPrompt": "a prompt to collect real stories from team members about this value",
  "visualConcept": "description of a visual/infographic concept",
  "keyMessages": ["message1", "message2", "message3"]
}`;

  const content = await generateJSON(prompt, {
    system: 'You are a culture and internal communications specialist. Create authentic content that resonates.',
    model: config.models.standard,
    maxTokens: 2000,
  });

  logger.info(`Generated culture content for value: ${value.name}`);
  return content;
}

// ---------------------------------------------------------------------------
// Main Run
// ---------------------------------------------------------------------------

async function runScheduled() {
  const startTime = Date.now();
  logger.info('=== Employer Branding Agent: Scheduled Run Starting ===');

  try {
    // Step 1: Generate LinkedIn content
    const linkedinPost = await generateLinkedInPost();

    // Step 2: Process Glassdoor reviews
    const glassdoorResults = await processGlassdoorReviews();

    // Step 3: Check for open roles needing hiring posts
    const openRoles = await getRecords(
      AIRTABLE_TABLES.hiringPosts,
      "{Status} = 'needed'",
      10
    );

    const hiringResults = [];
    for (const role of openRoles) {
      try {
        const posts = await publishHiringCampaign(role.Role);
        hiringResults.push({ role: role.Role, postsGenerated: posts.length });
      } catch (err) {
        logger.error(`Failed hiring campaign for ${role.Role}: ${err.message}`);
      }
    }

    // Step 4: Generate one culture content piece per week (Tuesday only)
    const today = new Date();
    let cultureContent = null;
    if (today.getDay() === 2) { // Tuesday
      const culture = loadCultureValues();
      const weekOfYear = Math.ceil((today - new Date(today.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
      const valueIndex = weekOfYear % culture.values.length;
      cultureContent = await generateCultureContent(culture.values[valueIndex].name);
    }

    // Step 5: Send summary
    const hasActivity = linkedinPost || glassdoorResults.length > 0 || hiringResults.length > 0;

    if (hasActivity) {
      await sendCEOEmail({
        subject: 'Employer Branding Update',
        html: buildSummaryEmail(linkedinPost, glassdoorResults, hiringResults, cultureContent),
      });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Employer Branding Agent: Run Complete in ${elapsed}s ===`);

    return {
      success: true,
      elapsed,
      linkedinPostGenerated: !!linkedinPost,
      glassdoorReviewsProcessed: glassdoorResults.length,
      hiringCampaigns: hiringResults.length,
      cultureContentGenerated: !!cultureContent,
    };
  } catch (err) {
    logger.error(`Employer Branding Agent failed: ${err.message}`, { stack: err.stack });

    try {
      await sendCEOEmail({
        subject: 'Employer Branding Agent ERROR',
        html: `<div style="font-family:sans-serif;padding:20px;background:#fff3f3;border-left:4px solid #e94560;">
          <h2>Employer Branding Agent Failed</h2>
          <p><strong>Error:</strong> ${err.message}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString('de-CH')}</p>
        </div>`,
      });
    } catch (emailErr) {
      logger.error(`Could not send error notification: ${emailErr.message}`);
    }

    return { success: false, error: err.message };
  }
}

/**
 * Build summary email.
 */
function buildSummaryEmail(linkedinPost, glassdoorResults, hiringResults, cultureContent) {
  return `
    <div style="font-family:'Segoe UI',sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">Employer Branding Update</h1>
        <p style="margin:5px 0 0;opacity:0.9;">${new Date().toLocaleDateString('de-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        ${linkedinPost ? `
          <h2>LinkedIn Post (Draft)</h2>
          <div style="background:white;padding:16px;border-radius:6px;border-left:4px solid #0077b5;margin:12px 0;">
            <p style="font-weight:bold;">${linkedinPost.title} (${linkedinPost.type})</p>
            <p style="font-size:13px;color:#666;">${linkedinPost.engagementHook}</p>
          </div>
        ` : ''}

        ${glassdoorResults.length > 0 ? `
          <h2>Glassdoor Reviews Processed: ${glassdoorResults.length}</h2>
          <ul>${glassdoorResults.map(r => `<li>${r.title} - ${r.rating}/5 (${r.sentiment}, ${r.priority} priority)</li>`).join('')}</ul>
        ` : ''}

        ${hiringResults.length > 0 ? `
          <h2>Hiring Campaigns Created</h2>
          <ul>${hiringResults.map(r => `<li>${r.role}: ${r.postsGenerated} posts generated</li>`).join('')}</ul>
        ` : ''}

        ${cultureContent ? `
          <h2>Culture Content: ${cultureContent.valueName}</h2>
          <p style="font-size:13px;">${cultureContent.keyMessages.join(' | ')}</p>
        ` : ''}
      </div>
      <div style="text-align:center;padding:16px;color:#666;font-size:12px;">
        Werkpilot AI Employer Branding Agent
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function start() {
  const schedule = '0 10 * * 2,4'; // 10:00 Tuesday and Thursday
  logger.info(`Employer Branding Agent starting. Schedule: ${schedule}`);

  cron.schedule(schedule, () => {
    logger.info('Cron triggered: employer branding run');
    runScheduled();
  }, {
    timezone: 'Europe/Zurich',
  });

  logger.info('Employer Branding Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--now') || args.includes('-n')) {
    logger.info('Running employer branding agent immediately (manual trigger)');
    runScheduled().then(result => {
      if (result.success) {
        logger.info(`Run completed: ${JSON.stringify(result)}`);
      } else {
        logger.error(`Run failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else if (args.includes('--linkedin')) {
    const type = args[args.indexOf('--linkedin') + 1];
    generateLinkedInPost(type).then(post => {
      console.log(JSON.stringify(post, null, 2));
    });
  } else if (args.includes('--hiring')) {
    const role = args[args.indexOf('--hiring') + 1] || 'Virtual Assistant';
    publishHiringCampaign(role).then(posts => {
      console.log(JSON.stringify(posts, null, 2));
    });
  } else if (args.includes('--culture')) {
    const value = args[args.indexOf('--culture') + 1] || 'Innovation';
    generateCultureContent(value).then(content => {
      console.log(JSON.stringify(content, null, 2));
    });
  } else if (args.includes('--calendar')) {
    const weeks = parseInt(args[args.indexOf('--calendar') + 1]) || 2;
    generateContentCalendar(weeks).then(posts => {
      console.log(`Generated ${posts.length} posts for ${weeks}-week calendar`);
    });
  } else {
    start();
  }
}

module.exports = {
  start,
  runScheduled,
  generateLinkedInPost,
  generateContentCalendar,
  generateGlassdoorResponse,
  processGlassdoorReviews,
  generateHiringPost,
  publishHiringCampaign,
  generateTestimonialRequest,
  polishTestimonial,
  generateCultureContent,
};
