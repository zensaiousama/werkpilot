/**
 * Werkpilot Agent 35 — Training Agent
 *
 * Manages organizational knowledge, training, and onboarding:
 * - Generates and maintains SOPs for every process
 * - Creates onboarding guides for new freelancers
 * - Knowledge base management with wiki updates
 * - Skill assessment and quality standards testing
 * - Training materials for client onboarding
 * - FAQ database for internal questions
 *
 * Schedule: Daily at 09:00 CET (weekdays)
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

const logger = createLogger('hr-training');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AIRTABLE_TABLES = {
  freelancers: 'Freelancers',
  sops: 'SOPs',
  trainingRecords: 'TrainingRecords',
  assessments: 'Assessments',
  knowledgeBase: 'KnowledgeBase',
  certifications: 'Certifications',
  skillGaps: 'SkillGaps',
  agentExecutionLogs: 'AgentExecutionLogs',
};

const SOP_DIR = path.join(__dirname, 'sops');
const KB_DIR = path.join(__dirname, 'knowledge-base');
const FAQ_PATH = path.join(KB_DIR, 'faq.json');

// ---------------------------------------------------------------------------
// SOP Management
// ---------------------------------------------------------------------------

/**
 * Load an existing SOP from disk.
 */
function loadSOP(filename) {
  const sopPath = path.join(SOP_DIR, filename);
  if (!fs.existsSync(sopPath)) return null;
  return fs.readFileSync(sopPath, 'utf-8');
}

/**
 * Save an SOP to disk and optionally to Airtable.
 */
async function saveSOP(filename, content, metadata = {}) {
  const sopPath = path.join(SOP_DIR, filename);
  fs.mkdirSync(path.dirname(sopPath), { recursive: true });
  fs.writeFileSync(sopPath, content, 'utf-8');
  logger.info(`SOP saved to disk: ${sopPath}`);

  // Save metadata to Airtable
  try {
    await createRecord(AIRTABLE_TABLES.sops, {
      Filename: filename,
      Title: metadata.title || filename.replace('.md', ''),
      Category: metadata.category || 'general',
      Version: metadata.version || '1.0',
      LastUpdated: new Date().toISOString(),
      Status: 'active',
    });
  } catch (err) {
    logger.warn(`Could not save SOP metadata to Airtable: ${err.message}`);
  }

  return sopPath;
}

/**
 * Generate a new SOP via Claude for a given process.
 */
async function generateSOP(processName, processDescription, existingSOP = null) {
  const prompt = `You are creating a Standard Operating Procedure (SOP) for Werkpilot, a Swiss AI automation startup.

PROCESS: ${processName}
DESCRIPTION: ${processDescription}

${existingSOP ? `EXISTING SOP (to update/improve):\n${existingSOP}\n` : ''}

Create a comprehensive SOP that includes:
1. **Title and Version** - Clear title, version number, effective date
2. **Purpose** - Why this SOP exists
3. **Scope** - Who this applies to and when
4. **Prerequisites** - What's needed before starting
5. **Step-by-Step Procedure** - Numbered steps with clear actions
6. **Quality Checkpoints** - Where to verify quality
7. **Escalation Paths** - When and how to escalate issues
8. **Common Mistakes** - What to avoid
9. **Tools & Resources** - Software, links, templates needed
10. **Revision History** - Version tracking

FORMAT: Markdown with clear headers, numbered lists, and checkboxes where appropriate.
LANGUAGE: English (Werkpilot is international)
TONE: Professional but accessible, written for freelancers of varying experience levels.`;

  const sop = await generateText(prompt, {
    system: 'You are a process documentation expert. Write clear, actionable SOPs that anyone can follow.',
    model: config.models.standard,
    maxTokens: 4000,
  });

  logger.info(`Generated SOP for: ${processName}`);
  return sop;
}

/**
 * Auto-generate SOPs from agent execution patterns.
 */
async function autoGenerateSOPFromAgentLogs(agentName, taskType, lookbackDays = 30) {
  logger.info(`Auto-generating SOP for ${agentName}/${taskType} from execution logs...`);

  // Fetch recent execution logs for this agent/task type
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  const logs = await getRecords(
    AIRTABLE_TABLES.agentExecutionLogs,
    `AND({AgentName} = '${agentName}', {TaskType} = '${taskType}', {Timestamp} > '${cutoffDate.toISOString()}')`,
    100
  );

  if (logs.length === 0) {
    logger.warn(`No execution logs found for ${agentName}/${taskType} in last ${lookbackDays} days`);
    return null;
  }

  // Analyze patterns from logs
  const executionPatterns = logs.map(log => ({
    steps: log.Steps || [],
    duration: log.DurationMs || 0,
    outcome: log.Outcome || 'unknown',
    errors: log.Errors || [],
    timestamp: log.Timestamp,
  }));

  const prompt = `You are analyzing agent execution logs to auto-generate a Standard Operating Procedure (SOP).

AGENT: ${agentName}
TASK TYPE: ${taskType}
EXECUTION LOGS ANALYZED: ${logs.length} executions over ${lookbackDays} days

EXECUTION PATTERNS:
${JSON.stringify(executionPatterns, null, 2)}

Based on these real execution patterns, create an SOP that:
1. Documents the **actual** process flow observed
2. Identifies common steps across successful executions
3. Highlights error patterns and how to avoid them
4. Includes quality checkpoints where errors frequently occur
5. Documents decision points and branching logic
6. Captures timing/duration expectations

Return JSON:
{
  "title": "SOP title",
  "processName": "${taskType}",
  "agentSource": "${agentName}",
  "confidenceScore": <0-100, based on consistency of patterns>,
  "sopContent": "full SOP in markdown format with all standard sections",
  "keyPatterns": ["pattern 1", "pattern 2"],
  "commonErrors": ["error type and prevention"],
  "averageDuration": <minutes>,
  "recommendations": ["improvements to standardize the process"]
}`;

  const sopAnalysis = await generateJSON(prompt, {
    system: 'You are a process documentation expert analyzing real execution data to create accurate SOPs.',
    model: config.models.standard,
    maxTokens: 4000,
  });

  // Only save if confidence score is high enough
  if (sopAnalysis.confidenceScore >= 70) {
    const filename = `auto-${agentName}-${taskType.toLowerCase().replace(/\s+/g, '-')}.md`;
    await saveSOP(filename, sopAnalysis.sopContent, {
      title: sopAnalysis.title,
      category: 'auto-generated',
      version: '1.0',
      source: 'agent-execution-logs',
      confidence: sopAnalysis.confidenceScore,
    });

    logger.info(`Auto-generated SOP: ${filename} (confidence: ${sopAnalysis.confidenceScore}%)`);
    return { filename, ...sopAnalysis };
  } else {
    logger.warn(`SOP confidence too low (${sopAnalysis.confidenceScore}%), not saving`);
    return null;
  }
}

/**
 * Check if SOPs need updates based on process changes.
 */
async function auditSOPs() {
  logger.info('Auditing SOPs for currency...');

  const sopFiles = fs.existsSync(SOP_DIR) ? fs.readdirSync(SOP_DIR).filter(f => f.endsWith('.md')) : [];
  const sopRecords = await getRecords(AIRTABLE_TABLES.sops, '', 100);

  const results = [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const record of sopRecords) {
    const lastUpdated = record.LastUpdated ? new Date(record.LastUpdated) : new Date(0);
    const isStale = lastUpdated < thirtyDaysAgo;

    if (isStale) {
      results.push({
        filename: record.Filename,
        title: record.Title,
        lastUpdated: record.LastUpdated,
        status: 'needs-review',
        daysSinceUpdate: Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)),
      });
    }
  }

  // Check for SOPs on disk not tracked in Airtable
  const trackedFiles = new Set(sopRecords.map(r => r.Filename));
  for (const file of sopFiles) {
    if (!trackedFiles.has(file)) {
      results.push({
        filename: file,
        title: file.replace('.md', ''),
        status: 'untracked',
      });
    }
  }

  logger.info(`SOP audit: ${results.length} items need attention`);
  return results;
}

// ---------------------------------------------------------------------------
// Onboarding Guide Generation
// ---------------------------------------------------------------------------

/**
 * Generate a personalized onboarding guide for a new freelancer.
 */
async function generateOnboardingGuide(freelancerName, role, details = {}) {
  const roleSops = fs.readdirSync(SOP_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f, content: fs.readFileSync(path.join(SOP_DIR, f), 'utf-8').substring(0, 500) }));

  const prompt = `Create a personalized onboarding guide for a new freelancer at Werkpilot.

FREELANCER: ${freelancerName}
ROLE: ${role}
START DATE: ${details.startDate || 'TBD'}
ADDITIONAL CONTEXT: ${JSON.stringify(details)}

AVAILABLE SOPs (summaries):
${roleSops.map(s => `- ${s.name}: ${s.content.substring(0, 200)}...`).join('\n')}

Create an onboarding guide with:
1. **Welcome Message** - Personal, warm welcome to Werkpilot
2. **Week 1 Checklist** - Day-by-day tasks for the first week
   - Day 1: Setup, introductions, tool access
   - Day 2-3: Read key SOPs, shadow sessions
   - Day 4-5: First supervised tasks
3. **Tools & Access** - List of tools they need access to, with setup instructions
4. **Key Contacts** - Who to reach out to for different questions
5. **Quality Standards** - What "good" looks like at Werkpilot
6. **Communication Guidelines** - How, when, and where to communicate
7. **First 30 Days Goals** - Clear milestones for the first month
8. **FAQ** - Common questions new freelancers have
9. **Resources** - Links to relevant SOPs and knowledge base articles

FORMAT: Clean Markdown
TONE: Friendly, supportive, clear`;

  const guide = await generateText(prompt, {
    system: 'You are a people-first HR specialist creating onboarding materials. Make new team members feel welcome and set them up for success.',
    model: config.models.standard,
    maxTokens: 4000,
  });

  logger.info(`Generated onboarding guide for ${freelancerName} (${role})`);
  return guide;
}

/**
 * Send onboarding package to a new freelancer.
 */
async function sendOnboardingPackage(freelancer) {
  const guide = await generateOnboardingGuide(
    freelancer.Name,
    freelancer.Role,
    { startDate: freelancer.StartDate, email: freelancer.Email }
  );

  // Save guide to disk
  const filename = `onboarding-${freelancer.Name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`;
  const guidePath = path.join(KB_DIR, filename);
  fs.writeFileSync(guidePath, guide, 'utf-8');

  // Send via email
  if (freelancer.Email) {
    await sendEmail({
      to: freelancer.Email,
      subject: `Welcome to Werkpilot - Your Onboarding Guide`,
      html: `
        <div style="font-family:'Segoe UI',sans-serif;max-width:700px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:24px 30px;border-radius:8px 8px 0 0;">
            <h1 style="margin:0;">Welcome to Werkpilot!</h1>
            <p style="margin:8px 0 0;opacity:0.9;">Your onboarding guide is attached below</p>
          </div>
          <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;white-space:pre-wrap;font-size:14px;">
            ${guide.replace(/\n/g, '<br>').replace(/## /g, '<h2 style="color:#0f3460;">').replace(/# /g, '<h1>')}
          </div>
        </div>`,
    });
    logger.info(`Onboarding package sent to ${freelancer.Email}`);
  }

  // Track in Airtable
  await createRecord(AIRTABLE_TABLES.trainingRecords, {
    FreelancerName: freelancer.Name,
    Type: 'onboarding',
    Status: 'sent',
    SentAt: new Date().toISOString(),
    GuideFile: filename,
  });

  return { guide, filename };
}

// ---------------------------------------------------------------------------
// Knowledge Base Management
// ---------------------------------------------------------------------------

/**
 * Load the FAQ database.
 */
function loadFAQ() {
  if (!fs.existsSync(FAQ_PATH)) return { categories: {}, lastUpdated: null };
  return JSON.parse(fs.readFileSync(FAQ_PATH, 'utf-8'));
}

/**
 * Save the FAQ database.
 */
function saveFAQ(faq) {
  faq.lastUpdated = new Date().toISOString();
  fs.writeFileSync(FAQ_PATH, JSON.stringify(faq, null, 2), 'utf-8');
  logger.info('FAQ database updated');
}

/**
 * Add a new FAQ entry, generating the answer via Claude if not provided.
 */
async function addFAQEntry(question, category, answer = null) {
  const faq = loadFAQ();

  if (!answer) {
    answer = await generateText(
      `You are a Werkpilot internal knowledge base assistant.
Answer this internal FAQ question concisely and accurately:

Question: ${question}
Category: ${category}

Provide a clear, helpful answer in 2-4 sentences.`,
      { model: config.models.fast, maxTokens: 300 }
    );
  }

  if (!faq.categories[category]) {
    faq.categories[category] = [];
  }

  faq.categories[category].push({
    question,
    answer,
    addedAt: new Date().toISOString(),
    views: 0,
  });

  saveFAQ(faq);
  logger.info(`Added FAQ: "${question}" to category "${category}"`);
  return { question, answer, category };
}

/**
 * Search the FAQ for relevant entries.
 */
function searchFAQ(query) {
  const faq = loadFAQ();
  const queryLower = query.toLowerCase();
  const results = [];

  for (const [category, entries] of Object.entries(faq.categories)) {
    for (const entry of entries) {
      const qLower = entry.question.toLowerCase();
      const aLower = entry.answer.toLowerCase();
      if (qLower.includes(queryLower) || aLower.includes(queryLower)) {
        results.push({ ...entry, category });
      }
    }
  }

  return results;
}

/**
 * Update the knowledge base when processes change.
 */
async function updateKnowledgeBase(changeDescription, affectedAreas) {
  logger.info(`Updating knowledge base for change: ${changeDescription}`);

  const prompt = `A process change has occurred at Werkpilot. Update the knowledge base accordingly.

CHANGE: ${changeDescription}
AFFECTED AREAS: ${affectedAreas.join(', ')}

Determine:
1. Which SOPs might need updating
2. Which FAQ entries might be affected
3. Whether new training materials are needed
4. Who should be notified

Return JSON:
{
  "affectedSOPs": ["filename1.md", "filename2.md"],
  "affectedFAQs": ["question text 1", "question text 2"],
  "newTrainingNeeded": true/false,
  "trainingDescription": "brief description if needed",
  "notifications": [{"role": "affected-role", "message": "what to communicate"}],
  "summary": "brief summary of all changes needed"
}`;

  const analysis = await generateJSON(prompt, {
    model: config.models.standard,
    maxTokens: 1500,
  });

  // Track the change
  await createRecord(AIRTABLE_TABLES.knowledgeBase, {
    ChangeDescription: changeDescription,
    AffectedAreas: affectedAreas.join(', '),
    Analysis: JSON.stringify(analysis),
    Status: 'pending-review',
    CreatedAt: new Date().toISOString(),
  });

  logger.info(`Knowledge base update analysis: ${analysis.summary}`);
  return analysis;
}

// ---------------------------------------------------------------------------
// Skill Assessment
// ---------------------------------------------------------------------------

/**
 * Generate a skill assessment test for a freelancer.
 */
async function generateSkillAssessment(role, level = 'intermediate') {
  const prompt = `Create a skill assessment test for a ${role} at Werkpilot.
Level: ${level}

The assessment should include:
1. **Multiple Choice Questions** (5 questions) - Testing fundamental knowledge
2. **Practical Task** (1 task) - A hands-on exercise
3. **Scenario Question** (2 questions) - "What would you do if..."
4. **Quality Standards Check** (3 items) - Verify they know Werkpilot's quality expectations

Return JSON:
{
  "title": "assessment title",
  "role": "${role}",
  "level": "${level}",
  "timeLimit": "estimated minutes",
  "passingScore": <number 0-100>,
  "sections": [
    {
      "type": "multiple-choice",
      "questions": [
        {
          "question": "text",
          "options": ["A", "B", "C", "D"],
          "correctAnswer": "A",
          "points": 5
        }
      ]
    },
    {
      "type": "practical",
      "tasks": [
        {
          "description": "task text",
          "evaluationCriteria": ["criterion1", "criterion2"],
          "points": 25
        }
      ]
    },
    {
      "type": "scenario",
      "questions": [
        {
          "scenario": "description",
          "question": "what would you do?",
          "keyPoints": ["expected point 1", "expected point 2"],
          "points": 15
        }
      ]
    },
    {
      "type": "quality-standards",
      "items": [
        {
          "question": "text",
          "expectedAnswer": "brief expected answer",
          "points": 5
        }
      ]
    }
  ],
  "totalPoints": <number>
}`;

  const assessment = await generateJSON(prompt, {
    system: 'You are an assessment design specialist. Create fair, thorough, and role-relevant tests.',
    model: config.models.standard,
    maxTokens: 3000,
  });

  logger.info(`Generated skill assessment for ${role} (${level}): ${assessment.title}`);
  return assessment;
}

/**
 * Evaluate a completed skill assessment.
 */
async function evaluateAssessment(assessment, responses) {
  const prompt = `Evaluate this skill assessment submission.

ASSESSMENT: ${JSON.stringify(assessment)}
RESPONSES: ${JSON.stringify(responses)}

Score each section and provide:
{
  "totalScore": <number>,
  "passingScore": ${assessment.passingScore},
  "passed": true/false,
  "sectionScores": {
    "multiple-choice": { "earned": <n>, "possible": <n> },
    "practical": { "earned": <n>, "possible": <n>, "feedback": "detailed feedback" },
    "scenario": { "earned": <n>, "possible": <n>, "feedback": "detailed feedback" },
    "quality-standards": { "earned": <n>, "possible": <n> }
  },
  "strengths": ["strength1", "strength2"],
  "areasForImprovement": ["area1", "area2"],
  "overallFeedback": "comprehensive feedback paragraph",
  "recommendedTraining": ["topic1", "topic2"]
}`;

  const evaluation = await generateJSON(prompt, {
    model: config.models.standard,
    maxTokens: 2000,
  });

  logger.info(`Assessment evaluated: score=${evaluation.totalScore}, passed=${evaluation.passed}`);
  return evaluation;
}

// ---------------------------------------------------------------------------
// Skill Gap Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze skill gaps for individual freelancer.
 */
async function analyzeFreelancerSkillGaps(freelancer) {
  const prompt = `Analyze skill gaps for a Werkpilot freelancer based on their role requirements and performance data.

FREELANCER: ${freelancer.Name}
ROLE: ${freelancer.Role}
CURRENT SKILLS: ${freelancer.Skills || 'Not documented'}
PERFORMANCE METRICS:
- Quality Score: ${freelancer.QualityScore || 'N/A'}/100
- Composite Score: ${freelancer.CompositeScore || 'N/A'}/100
- Tasks Completed: ${freelancer.TasksCompleted || 0}
- Tenure: ${freelancer.TenureMonths || 0} months

RECENT ASSESSMENTS: ${freelancer.RecentAssessmentResults || 'No recent assessments'}

Analyze and return JSON:
{
  "freelancerName": "${freelancer.Name}",
  "role": "${freelancer.Role}",
  "skillGaps": [
    {
      "skill": "skill name",
      "currentLevel": "none|basic|intermediate|advanced",
      "targetLevel": "basic|intermediate|advanced|expert",
      "priority": "low|medium|high|critical",
      "impact": "description of impact on performance",
      "recommendedTraining": "specific training or resources"
    }
  ],
  "strengths": ["documented strengths"],
  "developmentPriority": "which gap to address first",
  "estimatedTimeToClose": "realistic timeframe",
  "careerPathRecommendations": ["growth opportunities"]
}`;

  const analysis = await generateJSON(prompt, {
    system: 'You are a talent development specialist identifying skill gaps and creating growth plans.',
    model: config.models.standard,
    maxTokens: 2000,
  });

  // Save skill gap analysis
  for (const gap of analysis.skillGaps) {
    if (gap.priority === 'high' || gap.priority === 'critical') {
      await createRecord(AIRTABLE_TABLES.skillGaps, {
        FreelancerName: freelancer.Name,
        FreelancerId: freelancer.id,
        Skill: gap.skill,
        CurrentLevel: gap.currentLevel,
        TargetLevel: gap.targetLevel,
        Priority: gap.priority,
        Impact: gap.impact,
        RecommendedTraining: gap.recommendedTraining,
        Status: 'open',
        IdentifiedAt: new Date().toISOString(),
      });
    }
  }

  logger.info(`Skill gap analysis for ${freelancer.Name}: ${analysis.skillGaps.length} gaps identified`);
  return analysis;
}

/**
 * Run skill gap analysis for all active freelancers.
 */
async function runTeamSkillGapAnalysis() {
  logger.info('Running team-wide skill gap analysis...');

  const freelancers = await getRecords(
    AIRTABLE_TABLES.freelancers,
    "{Status} = 'active'",
    100
  );

  const analyses = [];
  for (const freelancer of freelancers) {
    try {
      const analysis = await analyzeFreelancerSkillGaps(freelancer);
      analyses.push(analysis);
    } catch (err) {
      logger.error(`Skill gap analysis failed for ${freelancer.Name}: ${err.message}`);
    }
  }

  // Aggregate team-level insights
  const teamGaps = {};
  for (const analysis of analyses) {
    for (const gap of analysis.skillGaps) {
      if (!teamGaps[gap.skill]) {
        teamGaps[gap.skill] = { count: 0, priority: gap.priority, training: gap.recommendedTraining };
      }
      teamGaps[gap.skill].count++;
    }
  }

  const topGaps = Object.entries(teamGaps)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([skill, data]) => ({ skill, ...data }));

  logger.info(`Team skill gap analysis: ${topGaps.length} common gaps across ${analyses.length} freelancers`);
  return { analyses, topGaps };
}

// ---------------------------------------------------------------------------
// Certification Tracking
// ---------------------------------------------------------------------------

/**
 * Track certifications for freelancers.
 */
async function trackCertification(freelancerName, freelancerId, certification) {
  const record = await createRecord(AIRTABLE_TABLES.certifications, {
    FreelancerName: freelancerName,
    FreelancerId: freelancerId,
    CertificationName: certification.name,
    IssuingOrganization: certification.issuer,
    IssueDate: certification.issueDate,
    ExpiryDate: certification.expiryDate || null,
    CredentialId: certification.credentialId || null,
    CredentialUrl: certification.url || null,
    Status: certification.expiryDate && new Date(certification.expiryDate) < new Date() ? 'expired' : 'active',
    AddedAt: new Date().toISOString(),
  });

  logger.info(`Certification tracked: ${certification.name} for ${freelancerName}`);
  return record;
}

/**
 * Check for expiring certifications and send reminders.
 */
async function checkExpiringCertifications() {
  logger.info('Checking for expiring certifications...');

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const certifications = await getRecords(
    AIRTABLE_TABLES.certifications,
    `AND({Status} = 'active', {ExpiryDate} != '', {ExpiryDate} < '${thirtyDaysFromNow.toISOString()}')`,
    50
  );

  const expiringCerts = [];
  for (const cert of certifications) {
    const expiryDate = new Date(cert.ExpiryDate);
    const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));

    expiringCerts.push({
      freelancerName: cert.FreelancerName,
      certificationName: cert.CertificationName,
      expiryDate: cert.ExpiryDate,
      daysUntilExpiry,
    });

    // Send reminder email if expiring in 7 days or less
    if (daysUntilExpiry <= 7 && cert.FreelancerEmail) {
      await sendEmail({
        to: cert.FreelancerEmail,
        subject: `Certification Expiring Soon: ${cert.CertificationName}`,
        html: `
          <div style="font-family:sans-serif;padding:20px;">
            <h2>Certification Renewal Reminder</h2>
            <p>Dear ${cert.FreelancerName},</p>
            <p>Your certification <strong>${cert.CertificationName}</strong> will expire in <strong>${daysUntilExpiry} days</strong> on ${expiryDate.toLocaleDateString()}.</p>
            <p>Please renew it to maintain your active status at Werkpilot.</p>
            <p>Best regards,<br>Werkpilot HR Team</p>
          </div>`,
      });
    }
  }

  logger.info(`Found ${expiringCerts.length} certifications expiring within 30 days`);
  return expiringCerts;
}

/**
 * Generate monthly training progress report.
 */
async function generateMonthlyTrainingReport() {
  logger.info('Generating monthly training report...');

  // Get training records from the past month
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const trainingRecords = await getRecords(
    AIRTABLE_TABLES.trainingRecords,
    `{SentAt} > '${lastMonth.toISOString()}'`,
    200
  );

  const assessments = await getRecords(
    AIRTABLE_TABLES.assessments,
    `{EvaluatedAt} > '${lastMonth.toISOString()}'`,
    100
  );

  const certifications = await getRecords(
    AIRTABLE_TABLES.certifications,
    `{AddedAt} > '${lastMonth.toISOString()}'`,
    50
  );

  // Analyze training completion rates
  const trainingByType = {};
  for (const record of trainingRecords) {
    const type = record.Type || 'other';
    if (!trainingByType[type]) {
      trainingByType[type] = { sent: 0, completed: 0 };
    }
    trainingByType[type].sent++;
    if (record.Status === 'completed') {
      trainingByType[type].completed++;
    }
  }

  // Assessment pass rates
  const assessmentStats = {
    total: assessments.length,
    passed: assessments.filter(a => a.Status === 'passed').length,
    failed: assessments.filter(a => a.Status === 'failed').length,
    averageScore: assessments.length > 0
      ? Math.round(assessments.reduce((sum, a) => sum + (a.Score || 0), 0) / assessments.length)
      : 0,
  };

  const report = {
    period: lastMonth.toISOString().substring(0, 7),
    trainingByType,
    assessmentStats,
    newCertifications: certifications.length,
    topPerformers: assessments
      .filter(a => a.Score >= 90)
      .map(a => ({ name: a.FreelancerName, score: a.Score }))
      .slice(0, 5),
    generatedAt: new Date().toISOString(),
  };

  logger.info(`Monthly training report: ${trainingRecords.length} trainings, ${assessments.length} assessments`);
  return report;
}

// ---------------------------------------------------------------------------
// Training Materials Generation
// ---------------------------------------------------------------------------

/**
 * Generate training materials for a specific topic.
 */
async function generateTrainingMaterial(topic, audience, format = 'guide') {
  const formatInstructions = {
    guide: 'Create a comprehensive training guide with sections, examples, and exercises.',
    quickref: 'Create a quick-reference card with key points, shortcuts, and checklists.',
    video_script: 'Create a video script with narration, visual cues, and timing marks.',
    checklist: 'Create a step-by-step checklist with verification points.',
  };

  const prompt = `Create ${format} training material for Werkpilot.

TOPIC: ${topic}
AUDIENCE: ${audience}
FORMAT: ${formatInstructions[format] || formatInstructions.guide}

Include:
- Clear learning objectives
- Practical examples relevant to Werkpilot's work
- Common pitfalls and how to avoid them
- Key takeaways
- Self-check questions

Make it engaging and practical.`;

  const material = await generateText(prompt, {
    system: 'You are a corporate training specialist. Create engaging, practical training materials that respect the learner\'s time.',
    model: config.models.standard,
    maxTokens: 4000,
  });

  logger.info(`Generated training material: ${topic} (${format}) for ${audience}`);
  return material;
}

// ---------------------------------------------------------------------------
// Main Daily Run
// ---------------------------------------------------------------------------

async function runDaily() {
  const startTime = Date.now();
  logger.info('=== Training Agent: Daily Run Starting ===');

  try {
    // Step 1: Audit SOPs for staleness
    const sopAudit = await auditSOPs();

    // Step 2: Check for new freelancers needing onboarding
    const newFreelancers = await getRecords(
      AIRTABLE_TABLES.freelancers,
      "{OnboardingStatus} = 'pending'",
      20
    );

    const onboardingResults = [];
    for (const freelancer of newFreelancers) {
      try {
        const result = await sendOnboardingPackage(freelancer);
        onboardingResults.push({ name: freelancer.Name, status: 'sent' });

        await updateRecord(AIRTABLE_TABLES.freelancers, freelancer.id, {
          OnboardingStatus: 'in-progress',
        });
      } catch (err) {
        logger.error(`Failed onboarding for ${freelancer.Name}: ${err.message}`);
        onboardingResults.push({ name: freelancer.Name, status: 'failed', error: err.message });
      }
    }

    // Step 3: Check for pending assessments
    const pendingAssessments = await getRecords(
      AIRTABLE_TABLES.assessments,
      "{Status} = 'submitted'",
      20
    );

    const assessmentResults = [];
    for (const record of pendingAssessments) {
      try {
        const assessment = JSON.parse(record.AssessmentData || '{}');
        const responses = JSON.parse(record.Responses || '{}');
        const evaluation = await evaluateAssessment(assessment, responses);

        await updateRecord(AIRTABLE_TABLES.assessments, record.id, {
          Status: evaluation.passed ? 'passed' : 'failed',
          Score: evaluation.totalScore,
          Feedback: evaluation.overallFeedback,
          EvaluatedAt: new Date().toISOString(),
        });

        assessmentResults.push({
          freelancer: record.FreelancerName,
          score: evaluation.totalScore,
          passed: evaluation.passed,
        });
      } catch (err) {
        logger.error(`Failed to evaluate assessment ${record.id}: ${err.message}`);
      }
    }

    // Step 4: Check for expiring certifications
    const expiringCerts = await checkExpiringCertifications();

    // Step 5: Run skill gap analysis (weekly on Mondays)
    let skillGapResults = null;
    const today = new Date().getDay();
    if (today === 1) {
      skillGapResults = await runTeamSkillGapAnalysis();
    }

    // Step 6: Generate training progress tracking
    const trainingProgress = await generateMonthlyTrainingReport();

    // Step 7: Sync to dashboard
    try {
      await dashboardSync.bulkSync({
        agents: [{
          name: 'hr-training',
          status: 'active',
          score: 92,
          tasksToday: onboardingResults.length + assessmentResults.length,
          errorsToday: onboardingResults.filter(r => r.status === 'failed').length,
        }],
        notifications: expiringCerts.length > 0 ? [{
          title: 'Certifications Expiring Soon',
          message: `${expiringCerts.length} certifications expiring within 30 days`,
          type: 'warning',
          link: '/hr/certifications',
        }] : [],
      });

      logger.info('Dashboard sync completed for training metrics');
    } catch (syncErr) {
      logger.warn(`Dashboard sync failed: ${syncErr.message}`);
    }

    // Step 8: Send summary if noteworthy
    const hasActivity = sopAudit.length > 0 || onboardingResults.length > 0 || assessmentResults.length > 0 || expiringCerts.length > 0;

    if (hasActivity) {
      await sendCEOEmail({
        subject: 'Training Agent Daily Summary',
        html: buildDailySummary(sopAudit, onboardingResults, assessmentResults, expiringCerts, skillGapResults, trainingProgress),
      });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`=== Training Agent: Daily Run Complete in ${elapsed}s ===`);

    return {
      success: true,
      elapsed,
      sopAuditItems: sopAudit.length,
      onboardingSent: onboardingResults.filter(r => r.status === 'sent').length,
      assessmentsEvaluated: assessmentResults.length,
      expiringCertifications: expiringCerts.length,
      skillGapsIdentified: skillGapResults ? skillGapResults.topGaps.length : 0,
    };
  } catch (err) {
    logger.error(`Training Agent daily run failed: ${err.message}`, { stack: err.stack });

    try {
      await sendCEOEmail({
        subject: 'Training Agent ERROR',
        html: `<div style="font-family:sans-serif;padding:20px;background:#fff3f3;border-left:4px solid #e94560;">
          <h2>Training Agent Failed</h2>
          <p><strong>Error:</strong> ${err.message}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString('de-CH')}</p>
        </div>`,
      });

      // Sync error to dashboard
      await dashboardSync.syncAgentStatus('hr-training', 'error', 0, 0, 1);
    } catch (emailErr) {
      logger.error(`Could not send error notification: ${emailErr.message}`);
    }

    return { success: false, error: err.message };
  }
}

/**
 * Build daily summary email.
 */
function buildDailySummary(sopAudit, onboardingResults, assessmentResults, expiringCerts = [], skillGapResults = null, trainingProgress = null) {
  return `
    <div style="font-family:'Segoe UI',sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:22px;">Training Agent Daily Summary</h1>
        <p style="margin:5px 0 0;opacity:0.9;">${new Date().toLocaleDateString('de-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div style="padding:20px 30px;background:#f8f9fa;border-radius:0 0 8px 8px;">
        ${trainingProgress ? `
          <h2>Monthly Training Progress</h2>
          <table style="width:100%;border-collapse:collapse;margin:12px 0;">
            <tr><td>Assessments Completed</td><td style="text-align:right;font-weight:bold;">${trainingProgress.assessmentStats.total}</td></tr>
            <tr><td>Pass Rate</td><td style="text-align:right;font-weight:bold;">${trainingProgress.assessmentStats.total > 0 ? Math.round((trainingProgress.assessmentStats.passed / trainingProgress.assessmentStats.total) * 100) : 0}%</td></tr>
            <tr><td>Average Score</td><td style="text-align:right;font-weight:bold;">${trainingProgress.assessmentStats.averageScore}/100</td></tr>
            <tr><td>New Certifications</td><td style="text-align:right;font-weight:bold;">${trainingProgress.newCertifications}</td></tr>
          </table>
        ` : ''}

        ${sopAudit.length > 0 ? `
          <h2>SOP Audit</h2>
          <p>${sopAudit.length} SOPs need attention:</p>
          <ul>${sopAudit.map(s => `<li><strong>${s.title || s.filename}</strong> - ${s.status}${s.daysSinceUpdate ? ` (${s.daysSinceUpdate} days)` : ''}</li>`).join('')}</ul>
        ` : '<p>All SOPs are up to date.</p>'}

        ${onboardingResults.length > 0 ? `
          <h2>Onboarding</h2>
          <ul>${onboardingResults.map(r => `<li>${r.name}: ${r.status}</li>`).join('')}</ul>
        ` : ''}

        ${assessmentResults.length > 0 ? `
          <h2>Assessments</h2>
          <ul>${assessmentResults.map(r => `<li>${r.freelancer}: ${r.score}/100 (${r.passed ? 'PASSED' : 'FAILED'})</li>`).join('')}</ul>
        ` : ''}

        ${expiringCerts.length > 0 ? `
          <h2 style="color:#e94560;">Expiring Certifications</h2>
          <ul>${expiringCerts.map(c => `<li><strong>${c.freelancerName}</strong>: ${c.certificationName} expires in ${c.daysUntilExpiry} days</li>`).join('')}</ul>
        ` : ''}

        ${skillGapResults && skillGapResults.topGaps.length > 0 ? `
          <h2>Top Team Skill Gaps</h2>
          <ul>${skillGapResults.topGaps.map(g => `<li><strong>${g.skill}</strong>: ${g.count} freelancers need training</li>`).join('')}</ul>
        ` : ''}
      </div>
      <div style="text-align:center;padding:16px;color:#666;font-size:12px;">
        Werkpilot AI Training Agent
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Cron Scheduling
// ---------------------------------------------------------------------------

function start() {
  const schedule = '0 9 * * 1-5'; // 09:00 weekdays
  logger.info(`Training Agent starting. Schedule: ${schedule}`);

  cron.schedule(schedule, () => {
    logger.info('Cron triggered: daily training run');
    runDaily();
  }, {
    timezone: 'Europe/Zurich',
  });

  logger.info('Training Agent is running and waiting for schedule...');
}

// ---------------------------------------------------------------------------
// CLI Support
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--now') || args.includes('-n')) {
    logger.info('Running training agent immediately (manual trigger)');
    runDaily().then(result => {
      if (result.success) {
        logger.info(`Daily run completed: ${JSON.stringify(result)}`);
      } else {
        logger.error(`Daily run failed: ${result.error}`);
        process.exit(1);
      }
    });
  } else if (args.includes('--generate-sop')) {
    const processName = args[args.indexOf('--generate-sop') + 1] || 'content-creation';
    generateSOP(processName, `Standard process for ${processName}`).then(sop => {
      console.log(sop);
    });
  } else if (args.includes('--add-faq')) {
    const question = args[args.indexOf('--add-faq') + 1] || 'How do I submit my work?';
    const category = args[args.indexOf('--add-faq') + 2] || 'general';
    addFAQEntry(question, category).then(entry => {
      console.log(JSON.stringify(entry, null, 2));
    });
  } else if (args.includes('--generate-assessment')) {
    const role = args[args.indexOf('--generate-assessment') + 1] || 'proofreader';
    generateSkillAssessment(role).then(assessment => {
      console.log(JSON.stringify(assessment, null, 2));
    });
  } else {
    start();
  }
}

module.exports = {
  start,
  runDaily,
  generateSOP,
  saveSOP,
  auditSOPs,
  autoGenerateSOPFromAgentLogs,
  generateOnboardingGuide,
  sendOnboardingPackage,
  loadFAQ,
  addFAQEntry,
  searchFAQ,
  updateKnowledgeBase,
  generateSkillAssessment,
  evaluateAssessment,
  generateTrainingMaterial,
  analyzeFreelancerSkillGaps,
  runTeamSkillGapAnalysis,
  trackCertification,
  checkExpiringCertifications,
  generateMonthlyTrainingReport,
};
