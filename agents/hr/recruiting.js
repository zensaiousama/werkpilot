/**
 * Werkpilot Agent 34 — Recruiting Agent
 *
 * Manages the freelancer recruitment pipeline for Werkpilot:
 * - Generates optimized job postings via Claude per platform
 * - Screens applications with AI-powered evaluation
 * - Schedules test tasks for qualified candidates
 * - Tracks freelancer performance and pipeline health
 * - Manages contracts and NDAs
 *
 * Target roles: Proofreaders (FR, IT), Virtual Assistants, Sales Freelancers
 * Platforms: Fiverr, Upwork, RemoteOK, jobs.ch, LinkedIn
 *
 * Schedule: Daily at 08:00 CET (weekdays)
 */

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const dashboardSync = require('../shared/utils/dashboard-sync');
const config = require('../shared/utils/config');

const logger = createLogger('hr-recruiting');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AIRTABLE_TABLES = {
  freelancers: 'Freelancers',
  applications: 'Applications',
  jobPostings: 'JobPostings',
  testTasks: 'TestTasks',
  contracts: 'Contracts',
  onboardingChecklists: 'OnboardingChecklists',
};

const PLATFORMS = ['fiverr', 'upwork', 'remoteok', 'jobsch', 'linkedin'];

const ROLES = {
  'proofreader-fr': { title: 'French Proofreader', market: 'FR/CH', templateFile: 'proofreader-fr.md' },
  'proofreader-it': { title: 'Italian Proofreader', market: 'IT/CH', templateFile: 'proofreader-it.md' },
  'va': { title: 'Virtual Assistant', market: 'Global', templateFile: 'va.md' },
  'sales': { title: 'Sales Freelancer', market: 'DACH', templateFile: 'sales.md' },
};

const RATE_CARDS_PATH = path.join(__dirname, 'rate-cards.json');

// ---------------------------------------------------------------------------
// Rate Card & Benchmarking
// ---------------------------------------------------------------------------

/**
 * Load rate cards for freelancer benchmarking.
 */
function loadRateCards() {
  if (!fs.existsSync(RATE_CARDS_PATH)) {
    logger.warn('Rate cards file not found');
    return null;
  }
  return JSON.parse(fs.readFileSync(RATE_CARDS_PATH, 'utf-8'));
}

/**
 * Get rate benchmarks for a given role and market.
 */
function getRateBenchmark(roleKey, market = null) {
  const rateCards = loadRateCards();
  if (!rateCards || !rateCards.roles[roleKey]) {
    logger.warn(`No rate card found for role: ${roleKey}`);
    return null;
  }

  const roleRates = rateCards.roles[roleKey];
  const marketRates = market && roleRates[market] ? roleRates[market] : roleRates.default;

  return {
    role: roleKey,
    market: market || 'default',
    ...marketRates,
    policies: rateCards.policies,
  };
}

/**
 * Evaluate if a candidate's rate is within acceptable range.
 */
function evaluateCandidateRate(candidateRate, roleKey, market = null) {
  const benchmark = getRateBenchmark(roleKey, market);
  if (!benchmark) return { withinRange: true, notes: 'No benchmark available' };

  const rate = parseFloat(candidateRate);
  if (isNaN(rate)) return { withinRange: false, notes: 'Invalid rate format' };

  const withinRange = rate >= benchmark.minRate && rate <= benchmark.maxRate;
  const percentOfMid = Math.round((rate / benchmark.hourlyRate) * 100);

  let notes = '';
  if (rate < benchmark.minRate) {
    notes = `Below minimum (${benchmark.minRate} CHF/hr). Candidate may be underqualified or undervaluing themselves.`;
  } else if (rate > benchmark.maxRate) {
    notes = `Above maximum (${benchmark.maxRate} CHF/hr). Requires CEO approval.`;
  } else if (rate > benchmark.hourlyRate * 1.1) {
    notes = `Above typical rate (${benchmark.hourlyRate} CHF/hr). Premium candidate.`;
  } else {
    notes = `Within expected range. ${percentOfMid}% of typical rate.`;
  }

  return {
    withinRange,
    notes,
    benchmark: benchmark.hourlyRate,
    min: benchmark.minRate,
    max: benchmark.maxRate,
    percentOfMid,
  };
}

// ---------------------------------------------------------------------------
// Job Posting Generation
// ---------------------------------------------------------------------------

/**
 * Load the job template for a given role.
 */
function loadJobTemplate(roleKey) {
  const role = ROLES[roleKey];
  if (!role) throw new Error(`Unknown role: ${roleKey}`);

  const templatePath = path.join(__dirname, 'job-templates', role.templateFile);
  if (!fs.existsSync(templatePath)) {
    logger.warn(`Template not found: ${templatePath}, using generic prompt`);
    return null;
  }
  return fs.readFileSync(templatePath, 'utf-8');
}

/**
 * Generate a platform-optimized job posting via Claude.
 */
async function generateJobPosting(roleKey, platform) {
  const role = ROLES[roleKey];
  const template = loadJobTemplate(roleKey);

  const prompt = `You are a recruitment specialist for Werkpilot, a Swiss AI automation startup.
Generate a job posting for the role: ${role.title}
Target market: ${role.market}
Platform: ${platform}

${template ? `BASE TEMPLATE:\n${template}\n` : ''}

PLATFORM-SPECIFIC GUIDELINES:
- fiverr: Short, benefit-focused, buyer's perspective. Max 1200 chars for description.
- upwork: Professional, skills-focused, clear deliverables and milestones. Include hourly rate range.
- remoteok: Tech-savvy tone, async-friendly, timezone-flexible. Include tags.
- jobsch: Swiss-formal, bilingual (DE/EN), reference Swiss market. Include Arbeitsort.
- linkedin: Professional networking tone, company culture highlights, growth opportunity.

REQUIREMENTS:
- Highlight Werkpilot's AI-first approach
- Mention Swiss quality standards
- Include clear requirements and responsibilities
- Add compensation indication where appropriate
- Make it compelling for top-tier freelancers

Return a JSON object with:
{
  "title": "job title optimized for the platform",
  "description": "full posting text",
  "tags": ["relevant", "tags"],
  "compensation": "rate indication",
  "requirements": ["req1", "req2"],
  "platformMetadata": {}
}`;

  const posting = await generateJSON(prompt, {
    system: 'You are an expert tech recruiter specializing in freelancer marketplaces. Write compelling, honest job postings.',
    model: config.models.standard,
    maxTokens: 3000,
  });

  logger.info(`Generated ${platform} posting for ${roleKey}: "${posting.title}"`);
  return posting;
}

/**
 * Generate job postings for a role across all platforms and save to Airtable.
 */
async function publishJobPostings(roleKey) {
  const results = [];

  for (const platform of PLATFORMS) {
    try {
      const posting = await generateJobPosting(roleKey, platform);

      const record = await createRecord(AIRTABLE_TABLES.jobPostings, {
        Role: roleKey,
        Platform: platform,
        Title: posting.title,
        Description: posting.description,
        Tags: posting.tags.join(', '),
        Compensation: posting.compensation,
        Status: 'draft',
        CreatedAt: new Date().toISOString(),
      });

      results.push({ platform, postingId: record.id, title: posting.title, status: 'created' });
      logger.info(`Saved posting to Airtable: ${platform}/${roleKey} (${record.id})`);
    } catch (err) {
      logger.error(`Failed to generate posting for ${platform}/${roleKey}: ${err.message}`);
      results.push({ platform, status: 'failed', error: err.message });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Application Screening
// ---------------------------------------------------------------------------

/**
 * Screen a single application using Claude with enhanced scoring.
 */
async function screenApplication(application) {
  const role = ROLES[application.Role] || { title: application.Role };
  const market = application.Market || role.market;

  // Get rate benchmark
  const rateBenchmark = getRateBenchmark(application.Role, market);
  const rateEval = application.Rate ? evaluateCandidateRate(application.Rate, application.Role, market) : null;

  const prompt = `You are screening a freelancer application for Werkpilot, a Swiss AI automation startup.

ROLE: ${role.title}
TARGET MARKET: ${market}

APPLICANT INFO:
- Name: ${application.Name || 'N/A'}
- Platform: ${application.Platform || 'N/A'}
- Experience: ${application.Experience || 'N/A'}
- Portfolio: ${application.Portfolio || 'N/A'}
- Rate: ${application.Rate || 'N/A'}
- Cover Letter: ${application.CoverLetter || 'N/A'}
- Languages: ${application.Languages || 'N/A'}
- Location: ${application.Location || 'N/A'}

RATE BENCHMARK (for context):
${rateBenchmark ? `- Typical rate: ${rateBenchmark.hourlyRate} CHF/hr
- Range: ${rateBenchmark.minRate}-${rateBenchmark.maxRate} CHF/hr
- Candidate rate evaluation: ${rateEval ? rateEval.notes : 'Not provided'}` : 'No benchmark available'}

EVALUATION CRITERIA (enhanced):
1. **Skills Match** (0-25 pts): Does the candidate have the specific skills needed for this role?
   - Technical/domain expertise
   - Relevant certifications or training
   - Demonstrated proficiency in required tools

2. **Experience Quality** (0-20 pts): Not just years, but quality and relevance
   - Similar projects/clients
   - Industry experience
   - Complexity of past work

3. **Swiss Market Knowledge** (0-15 pts): Understanding of Swiss business culture
   - Swiss clients in portfolio
   - Knowledge of Swiss quality standards
   - Cultural fit indicators

4. **Language Skills** (0-20 pts): Proficiency in required languages
   - Native/fluent in target language
   - Swiss dialect knowledge (if applicable)
   - Additional language skills as bonus

5. **Rate Alignment** (0-10 pts): Reasonable and competitive
   - Within budget range
   - Justified by experience level
   - Flexible/negotiable

6. **Communication Quality** (0-10 pts): From cover letter and application
   - Clarity and professionalism
   - Attention to detail
   - Enthusiasm and cultural fit

Return JSON:
{
  "totalScore": <0-100>,
  "breakdown": {
    "skillsMatch": <n>,
    "experienceQuality": <n>,
    "swissMarketKnowledge": <n>,
    "languageSkills": <n>,
    "rateAlignment": <n>,
    "communication": <n>
  },
  "recommendation": "advance|test-task|reject|review",
  "reasoning": "2-3 sentence explanation focusing on key decision factors",
  "redFlags": ["specific concerns if any"],
  "strengths": ["specific strengths"],
  "suggestedTestTask": "description if recommendation is test-task",
  "interviewQuestions": ["3-5 tailored interview questions if advancing"]
}`;

  const evaluation = await generateJSON(prompt, {
    system: 'You are a fair, thorough recruitment screener. Be objective and data-driven.',
    model: config.models.standard,
    maxTokens: 1500,
  });

  return evaluation;
}

/**
 * Process all new (unscreened) applications.
 */
async function screenNewApplications() {
  logger.info('Screening new applications...');

  const applications = await getRecords(
    AIRTABLE_TABLES.applications,
    "{Status} = 'new'",
    50
  );

  if (applications.length === 0) {
    logger.info('No new applications to screen');
    return [];
  }

  logger.info(`Found ${applications.length} new applications to screen`);
  const results = [];

  for (const app of applications) {
    try {
      const evaluation = await screenApplication(app);

      await updateRecord(AIRTABLE_TABLES.applications, app.id, {
        Status: evaluation.recommendation === 'reject' ? 'rejected' : 'screened',
        Score: evaluation.totalScore,
        Recommendation: evaluation.recommendation,
        ScreeningNotes: evaluation.reasoning,
        RedFlags: (evaluation.redFlags || []).join('; '),
        Strengths: (evaluation.strengths || []).join('; '),
        ScreenedAt: new Date().toISOString(),
      });

      results.push({
        name: app.Name,
        role: app.Role,
        score: evaluation.totalScore,
        recommendation: evaluation.recommendation,
      });

      // If candidate should advance, schedule test task and generate interview questions
      if (evaluation.recommendation === 'test-task' || evaluation.recommendation === 'advance') {
        await scheduleTestTask(app, evaluation);

        // Generate interview questions if advancing directly
        if (evaluation.recommendation === 'advance' && evaluation.interviewQuestions && evaluation.interviewQuestions.length > 0) {
          const interviewQuestions = await generateInterviewQuestions(app, evaluation);
          await updateRecord(AIRTABLE_TABLES.applications, app.id, {
            InterviewQuestions: JSON.stringify(interviewQuestions),
          });
        }
      }

      logger.info(`Screened ${app.Name}: score=${evaluation.totalScore}, rec=${evaluation.recommendation}`);
    } catch (err) {
      logger.error(`Failed to screen application ${app.id} (${app.Name}): ${err.message}`);
      results.push({ name: app.Name, status: 'error', error: err.message });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Test Task Management
// ---------------------------------------------------------------------------

/**
 * Schedule a test task for a qualified candidate.
 */
async function scheduleTestTask(application, evaluation) {
  const taskDescription = evaluation.suggestedTestTask || await generateTestTask(application.Role);

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 3); // 3-day deadline for test tasks

  const record = await createRecord(AIRTABLE_TABLES.testTasks, {
    ApplicantName: application.Name,
    ApplicantEmail: application.Email,
    ApplicationId: application.id,
    Role: application.Role,
    TaskDescription: taskDescription,
    Deadline: deadline.toISOString(),
    Status: 'assigned',
    AssignedAt: new Date().toISOString(),
  });

  // Send test task email to candidate
  if (application.Email) {
    await sendEmail({
      to: application.Email,
      subject: `Werkpilot - Test Task for ${ROLES[application.Role]?.title || application.Role} Role`,
      html: buildTestTaskEmail(application.Name, taskDescription, deadline),
    });
    logger.info(`Test task email sent to ${application.Email}`);
  }

  logger.info(`Test task scheduled for ${application.Name}: ${record.id}`);
  return record;
}

/**
 * Generate a role-appropriate test task via Claude.
 */
async function generateTestTask(roleKey) {
  const role = ROLES[roleKey] || { title: roleKey };

  const prompt = `Create a practical test task for a ${role.title} candidate at Werkpilot (Swiss AI automation startup).

The task should:
- Be completable in 1-2 hours
- Test real skills needed for the role
- Have clear, measurable evaluation criteria
- Be fair and not require proprietary knowledge

Return a clear task description in 200-300 words.`;

  return await generateText(prompt, {
    model: config.models.fast,
    maxTokens: 500,
  });
}

/**
 * Build the test task email HTML.
 */
function buildTestTaskEmail(name, taskDescription, deadline) {
  return `
    <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">Werkpilot Test Task</h1>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        <p>Dear ${name},</p>
        <p>Thank you for your application to Werkpilot. We were impressed with your profile and would like to invite you to complete a short test task.</p>
        <div style="background:white;padding:16px;border-radius:6px;border-left:4px solid #0f3460;margin:16px 0;">
          <h3 style="margin-top:0;">Your Task</h3>
          <p>${taskDescription}</p>
        </div>
        <p><strong>Deadline:</strong> ${deadline.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p>Please reply to this email with your completed task. If you have any questions, do not hesitate to reach out.</p>
        <p>Best regards,<br>Werkpilot Recruitment Team</p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Interview Question Generation
// ---------------------------------------------------------------------------

/**
 * Generate tailored interview questions for a candidate.
 */
async function generateInterviewQuestions(application, evaluation) {
  const role = ROLES[application.Role] || { title: application.Role };

  const prompt = `Generate tailored interview questions for a Werkpilot freelancer candidate.

ROLE: ${role.title}
CANDIDATE: ${application.Name}
EXPERIENCE: ${application.Experience || 'N/A'}
LANGUAGES: ${application.Languages || 'N/A'}
LOCATION: ${application.Location || 'N/A'}
SCREENING SCORE: ${evaluation.totalScore}/100

SCREENING INSIGHTS:
- Strengths: ${(evaluation.strengths || []).join(', ')}
- Areas to probe: ${(evaluation.redFlags || []).join(', ')}

Generate 8-10 interview questions covering:
1. **Technical/Skills Questions** (3-4): Test specific competencies for the role
2. **Experience Deep-Dive** (2-3): Understand quality of past work
3. **Cultural Fit** (2): Werkpilot values, work style, Swiss business culture
4. **Situational Questions** (2): How they handle challenges, client feedback, deadlines

Return JSON:
{
  "questions": [
    {
      "category": "technical|experience|cultural|situational",
      "question": "the question text",
      "purpose": "what you're evaluating",
      "idealAnswer": "key points to listen for"
    }
  ],
  "focusAreas": ["key areas to assess in this interview"],
  "redFlagsToWatch": ["specific concerns from screening to validate/disprove"]
}`;

  const questions = await generateJSON(prompt, {
    system: 'You are an expert technical interviewer. Create questions that reveal true capabilities and fit.',
    model: config.models.standard,
    maxTokens: 2000,
  });

  logger.info(`Generated ${questions.questions.length} interview questions for ${application.Name}`);
  return questions;
}

// ---------------------------------------------------------------------------
// Onboarding Checklist Auto-Creation
// ---------------------------------------------------------------------------

/**
 * Generate an onboarding checklist for a newly hired freelancer.
 */
async function generateOnboardingChecklist(freelancer) {
  const role = ROLES[freelancer.Role] || { title: freelancer.Role };

  const prompt = `Create a comprehensive onboarding checklist for a new Werkpilot freelancer.

FREELANCER: ${freelancer.Name}
ROLE: ${role.title}
START DATE: ${freelancer.StartDate || 'TBD'}
LANGUAGES: ${freelancer.Languages || 'N/A'}
MARKET: ${freelancer.Market || role.market}

Create a structured onboarding checklist with:
1. **Pre-Start Tasks** (before first day): Contracts, tools setup, access provisioning
2. **Week 1 Tasks**: Orientation, introductions, basic training
3. **Week 2-4 Tasks**: Supervised work, skill validation, process learning
4. **First 30 Days Milestones**: Key achievements to complete

Return JSON:
{
  "freelancerName": "${freelancer.Name}",
  "role": "${role.title}",
  "phases": [
    {
      "phase": "pre-start",
      "title": "Before Your First Day",
      "tasks": [
        {
          "task": "task description",
          "owner": "freelancer|manager|hr",
          "deadline": "relative days from start (e.g., -3 for 3 days before)",
          "status": "pending"
        }
      ]
    },
    {
      "phase": "week-1",
      "title": "Week 1: Orientation & Setup",
      "tasks": [...]
    },
    {
      "phase": "week-2-4",
      "title": "Weeks 2-4: Learning & Supervised Work",
      "tasks": [...]
    },
    {
      "phase": "30-day-milestones",
      "title": "30-Day Success Milestones",
      "tasks": [...]
    }
  ],
  "keyContacts": [
    {"role": "Manager", "name": "TBD", "purpose": "Daily questions and task assignment"},
    {"role": "HR Contact", "name": "TBD", "purpose": "Admin, payments, contracts"},
    {"role": "Tech Support", "name": "TBD", "purpose": "Tool access and technical issues"}
  ],
  "criticalDocuments": ["document names to read"],
  "expectedOutcomes": ["what success looks like after 30 days"]
}`;

  const checklist = await generateJSON(prompt, {
    system: 'You are an onboarding specialist. Create thorough, realistic checklists that set freelancers up for success.',
    model: config.models.standard,
    maxTokens: 3000,
  });

  // Save to Airtable
  const record = await createRecord(AIRTABLE_TABLES.onboardingChecklists, {
    FreelancerName: freelancer.Name,
    FreelancerId: freelancer.id,
    Role: freelancer.Role,
    Checklist: JSON.stringify(checklist),
    Status: 'active',
    Progress: 0,
    CreatedAt: new Date().toISOString(),
  });

  logger.info(`Generated onboarding checklist for ${freelancer.Name}: ${record.id}`);
  return { checklist, recordId: record.id };
}

// ---------------------------------------------------------------------------
// Freelancer Performance Tracking
// ---------------------------------------------------------------------------

/**
 * Update freelancer performance metrics from recent data.
 */
async function trackFreelancerPerformance() {
  logger.info('Updating freelancer performance metrics...');

  const freelancers = await getRecords(
    AIRTABLE_TABLES.freelancers,
    "{Status} = 'active'",
    100
  );

  if (freelancers.length === 0) {
    logger.info('No active freelancers to track');
    return [];
  }

  const updates = [];

  for (const freelancer of freelancers) {
    try {
      // Calculate composite performance score
      const qualityScore = freelancer.QualityScore || 0;
      const timeliness = freelancer.TimelinessScore || 0;
      const availability = freelancer.AvailabilityScore || 0;
      const clientFeedback = freelancer.ClientFeedbackScore || 0;

      const compositeScore = Math.round(
        (qualityScore * 0.35) +
        (timeliness * 0.25) +
        (availability * 0.15) +
        (clientFeedback * 0.25)
      );

      let performanceTier;
      if (compositeScore >= 90) performanceTier = 'A - Top Performer';
      else if (compositeScore >= 75) performanceTier = 'B - Strong';
      else if (compositeScore >= 60) performanceTier = 'C - Meets Expectations';
      else if (compositeScore >= 40) performanceTier = 'D - Needs Improvement';
      else performanceTier = 'F - Under Review';

      await updateRecord(AIRTABLE_TABLES.freelancers, freelancer.id, {
        CompositeScore: compositeScore,
        PerformanceTier: performanceTier,
        LastReviewedAt: new Date().toISOString(),
      });

      updates.push({
        name: freelancer.Name,
        role: freelancer.Role,
        compositeScore,
        tier: performanceTier,
      });

      logger.info(`Updated ${freelancer.Name}: composite=${compositeScore}, tier=${performanceTier}`);
    } catch (err) {
      logger.error(`Failed to update performance for ${freelancer.Name}: ${err.message}`);
    }
  }

  return updates;
}

// ---------------------------------------------------------------------------
// Contract & NDA Management
// ---------------------------------------------------------------------------

/**
 * Generate a contract or NDA draft via Claude.
 */
async function generateContractDraft(freelancerName, role, contractType, terms) {
  const prompt = `Generate a ${contractType} for a freelancer engagement at Werkpilot AG (Swiss company).

DETAILS:
- Freelancer: ${freelancerName}
- Role: ${ROLES[role]?.title || role}
- Contract Type: ${contractType}
- Terms: ${JSON.stringify(terms)}

REQUIREMENTS:
- Swiss law governed (Obligationenrecht)
- Include confidentiality clauses
- Include IP assignment clause
- Include termination with 14-day notice
- Professional, clear language (English)
- Include placeholder fields marked with [FIELD_NAME]

Return the contract as formatted text.`;

  return await generateText(prompt, {
    system: 'You are a legal document specialist familiar with Swiss employment and freelancer law.',
    model: config.models.standard,
    maxTokens: 4000,
  });
}

/**
 * Check for freelancers missing contracts or NDAs.
 */
async function auditContracts() {
  logger.info('Auditing freelancer contracts...');

  const freelancers = await getRecords(
    AIRTABLE_TABLES.freelancers,
    "{Status} = 'active'",
    100
  );

  const contracts = await getRecords(AIRTABLE_TABLES.contracts, '', 200);
  const contractMap = {};
  for (const c of contracts) {
    const key = c.FreelancerName || c.FreelancerId;
    if (!contractMap[key]) contractMap[key] = [];
    contractMap[key].push(c);
  }

  const issues = [];

  for (const f of freelancers) {
    const fContracts = contractMap[f.Name] || contractMap[f.id] || [];
    const hasContract = fContracts.some(c => c.Type === 'service-agreement' && c.Status === 'active');
    const hasNDA = fContracts.some(c => c.Type === 'nda' && c.Status === 'active');

    if (!hasContract) {
      issues.push({ freelancer: f.Name, role: f.Role, missing: 'Service Agreement' });
    }
    if (!hasNDA) {
      issues.push({ freelancer: f.Name, role: f.Role, missing: 'NDA' });
    }
  }

  if (issues.length > 0) {
    logger.warn(`Found ${issues.length} contract compliance issues`);
  } else {
    logger.info('All active freelancers have contracts and NDAs');
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Pipeline Report
// ---------------------------------------------------------------------------

/**
 * Generate a recruitment pipeline summary report.
 */
async function generatePipelineReport() {
  logger.info('Generating pipeline report...');

  const [applications, freelancers, testTasks] = await Promise.all([
    getRecords(AIRTABLE_TABLES.applications, '', 100),
    getRecords(AIRTABLE_TABLES.freelancers, '', 100),
    getRecords(AIRTABLE_TABLES.testTasks, '', 50),
  ]);

  const pipeline = {
    new: applications.filter(a => a.Status === 'new').length,
    screened: applications.filter(a => a.Status === 'screened').length,
    testTaskAssigned: testTasks.filter(t => t.Status === 'assigned').length,
    testTaskCompleted: testTasks.filter(t => t.Status === 'completed').length,
    hired: applications.filter(a => a.Status === 'hired').length,
    rejected: applications.filter(a => a.Status === 'rejected').length,
    activeFreelancers: freelancers.filter(f => f.Status === 'active').length,
    totalFreelancers: freelancers.length,
  };

  const roleBreakdown = {};
  for (const app of applications) {
    const role = app.Role || 'unknown';
    if (!roleBreakdown[role]) roleBreakdown[role] = { total: 0, new: 0, screened: 0, hired: 0 };
    roleBreakdown[role].total++;
    if (app.Status === 'new') roleBreakdown[role].new++;
    if (app.Status === 'screened') roleBreakdown[role].screened++;
    if (app.Status === 'hired') roleBreakdown[role].hired++;
  }

  const report = { generatedAt: new Date().toISOString(), pipeline, roleBreakdown };

  logger.info(`Pipeline report: ${pipeline.new} new, ${pipeline.screened} screened, ${pipeline.activeFreelancers} active`);
  return report;
}

// ---------------------------------------------------------------------------
// Main Daily Run
// ---------------------------------------------------------------------------

async function runDaily() {
  const startTime = Date.now();
  logger.info('=== Recruiting Agent: Daily Run Starting ===');

  try {
    // Step 1: Screen new applications
    const screeningResults = await screenNewApplications();

    // Step 2: Track freelancer performance
    const performanceUpdates = await trackFreelancerPerformance();

    // Step 3: Audit contracts
    const contractIssues = await auditContracts();

    // Step 4: Generate pipeline report
    const pipelineReport = await generatePipelineReport();

    // Step 5: Create onboarding checklists for newly hired freelancers
    const newHires = await getRecords(
      AIRTABLE_TABLES.freelancers,
      "AND({Status} = 'active', {OnboardingStatus} = 'pending')",
      20
    );

    const onboardingResults = [];
    for (const hire of newHires) {
      try {
        const { checklist, recordId } = await generateOnboardingChecklist(hire);
        onboardingResults.push({ name: hire.Name, status: 'created', recordId });

        await updateRecord(AIRTABLE_TABLES.freelancers, hire.id, {
          OnboardingStatus: 'in-progress',
        });
      } catch (err) {
        logger.error(`Failed to create onboarding checklist for ${hire.Name}: ${err.message}`);
        onboardingResults.push({ name: hire.Name, status: 'failed', error: err.message });
      }
    }

    // Step 6: Sync recruitment metrics to dashboard
    try {
      await dashboardSync.bulkSync({
        agents: [{
          name: 'hr-recruiting',
          status: 'active',
          score: 95,
          tasksToday: screeningResults.length + performanceUpdates.length + onboardingResults.length,
          errorsToday: 0,
        }],
        notifications: contractIssues.length > 0 ? [{
          title: 'Contract Compliance Issues',
          message: `${contractIssues.length} freelancers need contract or NDA updates`,
          type: 'warning',
          link: '/hr/contracts',
        }] : [],
      });

      logger.info('Dashboard sync completed for recruiting metrics');
    } catch (syncErr) {
      logger.warn(`Dashboard sync failed: ${syncErr.message}`);
    }

    // Step 7: Send summary to CEO if there are noteworthy items
    const hasNotableItems = screeningResults.length > 0 || contractIssues.length > 0 || onboardingResults.length > 0;

    if (hasNotableItems) {
      const summaryHtml = buildDailySummaryEmail(screeningResults, performanceUpdates, contractIssues, pipelineReport, onboardingResults);
      await sendCEOEmail({
        subject: 'Recruiting Daily Summary',
        html: summaryHtml,
      });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Recruiting Agent: Daily Run Complete in ${elapsed}s ===`);

    return {
      success: true,
      elapsed,
      screened: screeningResults.length,
      performanceUpdates: performanceUpdates.length,
      contractIssues: contractIssues.length,
      onboardingChecklists: onboardingResults.filter(r => r.status === 'created').length,
      pipeline: pipelineReport.pipeline,
    };
  } catch (err) {
    logger.error(`Recruiting Agent daily run failed: ${err.message}`, { stack: err.stack });

    try {
      await sendCEOEmail({
        subject: 'Recruiting Agent ERROR',
        html: `<div style="font-family:sans-serif;padding:20px;background:#fff3f3;border-left:4px solid #e94560;">
          <h2>Recruiting Agent Failed</h2>
          <p><strong>Error:</strong> ${err.message}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString('de-CH')}</p>
        </div>`,
      });

      // Sync error to dashboard
      await dashboardSync.syncAgentStatus('hr-recruiting', 'error', 0, 0, 1);
    } catch (emailErr) {
      logger.error(`Could not send error notification: ${emailErr.message}`);
    }

    return { success: false, error: err.message };
  }
}

/**
 * Build daily summary email HTML.
 */
function buildDailySummaryEmail(screeningResults, performanceUpdates, contractIssues, pipelineReport, onboardingResults = []) {
  const screeningRows = screeningResults.map(r =>
    `<tr><td>${r.name || 'N/A'}</td><td>${r.role || 'N/A'}</td><td>${r.score || '-'}</td><td>${r.recommendation || r.status}</td></tr>`
  ).join('');

  const contractRows = contractIssues.map(i =>
    `<tr><td>${i.freelancer}</td><td>${i.role}</td><td style="color:#e94560;font-weight:bold;">${i.missing}</td></tr>`
  ).join('');

  const onboardingRows = onboardingResults.map(o =>
    `<tr><td>${o.name}</td><td style="color:${o.status === 'created' ? '#28a745' : '#e94560'};">${o.status}</td></tr>`
  ).join('');

  const p = pipelineReport.pipeline;

  return `
    <div style="font-family:'Segoe UI',sans-serif;max-width:700px;margin:0 auto;padding:20px;">
      <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">Recruiting Daily Summary</h1>
        <p style="margin:5px 0 0;opacity:0.9;">${new Date().toLocaleDateString('de-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        <h2>Pipeline Overview</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td>New Applications</td><td style="text-align:right;font-weight:bold;">${p.new}</td></tr>
          <tr><td>Screened Today</td><td style="text-align:right;font-weight:bold;">${screeningResults.length}</td></tr>
          <tr><td>Test Tasks Pending</td><td style="text-align:right;font-weight:bold;">${p.testTaskAssigned}</td></tr>
          <tr><td>Active Freelancers</td><td style="text-align:right;font-weight:bold;">${p.activeFreelancers}</td></tr>
        </table>

        ${screeningResults.length > 0 ? `
          <h2>Application Screening</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="background:#e8e8e8;"><th>Name</th><th>Role</th><th>Score</th><th>Result</th></tr>
            ${screeningRows}
          </table>
        ` : ''}

        ${contractIssues.length > 0 ? `
          <h2 style="color:#e94560;">Contract Issues</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="background:#e8e8e8;"><th>Freelancer</th><th>Role</th><th>Missing</th></tr>
            ${contractRows}
          </table>
        ` : ''}

        ${onboardingResults.length > 0 ? `
          <h2>Onboarding Checklists</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="background:#e8e8e8;"><th>Freelancer</th><th>Status</th></tr>
            ${onboardingRows}
          </table>
        ` : ''}
      </div>
      <div style="text-align:center;padding:16px;color:#666;font-size:12px;">
        Werkpilot AI Recruiting Agent
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function start() {
  const schedule = '0 8 * * 1-5'; // 08:00 weekdays
  logger.info(`Recruiting Agent starting. Schedule: ${schedule}`);

  cron.schedule(schedule, () => {
    logger.info('Cron triggered: daily recruiting run');
    runDaily();
  }, {
    timezone: 'Europe/Zurich',
  });

  logger.info('Recruiting Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--now') || args.includes('-n')) {
    logger.info('Running recruiting agent immediately (manual trigger)');
    runDaily().then(result => {
      if (result.success) {
        logger.info(`Daily run completed: ${JSON.stringify(result)}`);
      } else {
        logger.error(`Daily run failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else if (args.includes('--post-jobs')) {
    const roleArg = args[args.indexOf('--post-jobs') + 1];
    const roleKey = roleArg || 'va';
    logger.info(`Publishing job postings for role: ${roleKey}`);
    publishJobPostings(roleKey).then(results => {
      logger.info(`Job postings published: ${JSON.stringify(results, null, 2)}`);
    });
  } else if (args.includes('--generate-contract')) {
    const name = args[args.indexOf('--generate-contract') + 1] || 'John Doe';
    const role = args[args.indexOf('--generate-contract') + 2] || 'va';
    generateContractDraft(name, role, 'freelancer-service-agreement', {
      startDate: new Date().toISOString().split('T')[0],
      rate: 'CHF 35/hour',
      scope: 'General virtual assistant tasks',
    }).then(contract => {
      console.log(contract);
    });
  } else {
    start();
  }
}

module.exports = {
  start,
  runDaily,
  generateJobPosting,
  publishJobPostings,
  screenApplication,
  screenNewApplications,
  scheduleTestTask,
  trackFreelancerPerformance,
  generateContractDraft,
  auditContracts,
  generatePipelineReport,
  loadRateCards,
  getRateBenchmark,
  evaluateCandidateRate,
  generateInterviewQuestions,
  generateOnboardingChecklist,
};
