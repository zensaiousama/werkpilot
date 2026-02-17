/**
 * Agent 08 — Inside Sales Bot Agent
 *
 * Express API backend for the website chat widget. Uses Claude for real-time
 * conversational AI with knowledge of Werkpilot services, pricing, FAQ, and
 * process. Qualifies leads through a structured flow and routes them to
 * booking or Fitness Check. Multi-language: DE, FR, IT, EN.
 *
 * Endpoints:
 *   POST /api/chat          - Send a message, get AI response
 *   POST /api/chat/start    - Start a new conversation
 *   GET  /api/chat/history  - Get conversation history
 *   POST /api/chat/feedback - Submit conversation feedback
 */

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { createRecord, getRecords, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('inside-sales-bot');

// ── Load Knowledge & Rules ───────────────────────────────────────────────────

const knowledgeBase = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'knowledge-base.json'), 'utf-8')
);

const qualificationRules = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'qualification-rules.json'), 'utf-8')
);

// ── Constants ────────────────────────────────────────────────────────────────

const TABLES = {
  CONVERSATIONS: 'ChatConversations',
  MESSAGES: 'ChatMessages',
  LEADS: 'Leads',
};

const PORT = process.env.CHAT_BOT_PORT || 3100;
const SUPPORTED_LANGUAGES = ['de', 'fr', 'it', 'en'];
const DEFAULT_LANGUAGE = 'de';
const MAX_CONVERSATION_LENGTH = 50;

// In-memory conversation store (for active sessions; persisted to Airtable)
const conversations = new Map();

// ── Language Detection ───────────────────────────────────────────────────────

/**
 * Detect language from user message.
 */
function detectLanguage(message) {
  const lowerMessage = message.toLowerCase();
  const langScores = {};

  for (const [lang, keywords] of Object.entries(qualificationRules.languageDetection)) {
    langScores[lang] = 0;
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        langScores[lang]++;
      }
    }
  }

  const bestLang = Object.entries(langScores)
    .sort(([, a], [, b]) => b - a)[0];

  return bestLang && bestLang[1] > 0 ? bestLang[0] : null;
}

// ── Qualification Scoring ────────────────────────────────────────────────────

/**
 * Calculate qualification score from collected data.
 */
function calculateQualificationScore(qualData) {
  const criteria = qualificationRules.scoringCriteria;
  let score = 0;

  if (qualData.companyName) score += criteria.hasCompanyName;
  if (qualData.industry) score += criteria.hasIndustry;
  if (qualData.challenge) score += criteria.hasChallenge;
  if (qualData.budget) {
    score += criteria.hasBudget;
    if (['CHF 3\'000 - 6\'000', 'CHF 6\'000 - 15\'000', 'Ueber CHF 15\'000',
         'CHF 3,000 - 6,000', 'CHF 6,000 - 15,000', 'Over CHF 15,000'].includes(qualData.budget)) {
      score += criteria.budgetAbove3k;
    }
    if (['CHF 6\'000 - 15\'000', 'Ueber CHF 15\'000',
         'CHF 6,000 - 15,000', 'Over CHF 15,000'].includes(qualData.budget)) {
      score += criteria.budgetAbove6k;
    }
  }
  if (qualData.contactInfo) score += criteria.hasContactInfo;
  if (qualData.challenge && qualData.challenge.toLowerCase().includes('keine website')) {
    score += criteria.needsNewWebsite;
  }
  if (qualData.challenge && qualData.challenge.toLowerCase().includes('e-commerce')) {
    score += criteria.needsEcommerce;
  }

  return Math.min(100, score);
}

/**
 * Determine the recommended action based on score.
 */
function getQualificationAction(score) {
  const rules = qualificationRules.scoringRules;
  if (score >= rules.qualified.minScore) return 'book_call';
  if (score >= rules.nurture.minScore) return 'fitness_check';
  return 'information';
}

// ── Escalation Detection ─────────────────────────────────────────────────────

/**
 * Check if a message requires escalation to a human.
 */
function shouldEscalate(message) {
  const lowerMessage = message.toLowerCase();
  return qualificationRules.escalationTriggers.some(trigger =>
    lowerMessage.includes(trigger.toLowerCase())
  );
}

// ── Build System Prompt ──────────────────────────────────────────────────────

/**
 * Build a comprehensive system prompt from the knowledge base.
 */
function buildSystemPrompt(language) {
  const lang = SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
  const kb = knowledgeBase;

  const langInstructions = {
    de: 'Antworte auf Deutsch (Schweizer Geschaeftsdeutsch). Verwende "Sie" als Anrede.',
    fr: 'Reponds en francais (style professionnel suisse). Utilisez "vous".',
    it: 'Rispondi in italiano (stile professionale svizzero). Usa il "Lei".',
    en: 'Respond in English (professional Swiss business style).',
  };

  // Build services section
  const servicesText = Object.values(kb.services)
    .map(s => `- ${(s.name[lang] || s.name.de || s.name.en)}: ${(s.description[lang] || s.description.de || s.description.en)} (${s.startingPrice})`)
    .join('\n');

  // Build FAQ section
  const faqText = kb.faq
    .map(f => `Q: ${f.question[lang] || f.question.de}\nA: ${f.answer[lang] || f.answer.de}`)
    .join('\n\n');

  // Build pricing section
  const pricingText = Object.values(kb.pricing.packages)
    .map(p => `- ${p.name} (${p.price}): ${p.description[lang] || p.description.de}`)
    .join('\n');

  // Build process section
  const processText = kb.process.steps
    .map(s => `${s.step}. ${s.name[lang] || s.name.de} (${s.duration}): ${s.description[lang] || s.description.de}`)
    .join('\n');

  return `You are the Werkpilot Sales Assistant, a friendly and knowledgeable chatbot on werkpilot.ch.
Your role is to help website visitors learn about Werkpilot's services and qualify them as potential leads.

${langInstructions[lang]}

## About Werkpilot
${kb.company.description[lang] || kb.company.description.de}

## Services
${servicesText}

## Pricing
${pricingText}
Payment: ${kb.pricing.paymentTerms[lang] || kb.pricing.paymentTerms.de}

## Process
${processText}

## Frequently Asked Questions
${faqText}

## Key Differentiators
${(kb.differentiators[lang] || kb.differentiators.de).map(d => `- ${d}`).join('\n')}

## Your Behavior Rules
1. Be helpful, friendly, and professional
2. Keep responses concise (max 3-4 sentences unless more detail is needed)
3. Always try to understand what the visitor needs
4. If asked about specific pricing, mention the starting prices and recommend a consultation for exact quotes
5. Always try to guide the conversation toward booking a call or requesting a Fitness Check
6. Never make up information - if you don't know, say you'll connect them with an expert
7. Do not discuss competitor products in detail
8. For legal, data privacy, or complex technical questions, escalate to a human
9. The free Website Fitness Check is our primary lead magnet - recommend it when appropriate
10. Booking URL: ${kb.bookingUrl}
11. Fitness Check URL: ${kb.fitnessCheckUrl}

## Qualification Goal
Try to naturally collect during the conversation:
- Company name
- Industry
- Their biggest digital challenge
These help us provide better assistance. Don't ask all at once - weave them naturally into the conversation.`;
}

// ── Conversation Management ──────────────────────────────────────────────────

/**
 * Create a new conversation.
 */
function createConversation(language = DEFAULT_LANGUAGE) {
  const sessionId = uuidv4();
  const conversation = {
    sessionId,
    language,
    messages: [],
    qualificationData: {},
    qualificationScore: 0,
    status: 'active',
    startedAt: new Date().toISOString(),
    escalated: false,
  };
  conversations.set(sessionId, conversation);
  return conversation;
}

/**
 * Get an existing conversation.
 */
function getConversation(sessionId) {
  return conversations.get(sessionId) || null;
}

/**
 * Process a user message and generate a response.
 */
async function processMessage(sessionId, userMessage) {
  const conversation = getConversation(sessionId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.messages.length >= MAX_CONVERSATION_LENGTH) {
    return {
      response: getLocalizedText(conversation.language, {
        de: 'Dieses Gespraech hat die maximale Laenge erreicht. Bitte buchen Sie einen Termin fuer eine ausfuehrliche Beratung.',
        en: 'This conversation has reached its maximum length. Please book an appointment for a detailed consultation.',
        fr: 'Cette conversation a atteint sa longueur maximale. Veuillez prendre rendez-vous pour une consultation detaillee.',
        it: 'Questa conversazione ha raggiunto la lunghezza massima. Si prega di prenotare un appuntamento per una consulenza dettagliata.',
      }),
      action: 'book_call',
      bookingUrl: knowledgeBase.bookingUrl,
    };
  }

  // Detect language if not yet set or first message
  if (conversation.messages.length === 0) {
    const detected = detectLanguage(userMessage);
    if (detected) {
      conversation.language = detected;
    }
  }

  // Check for escalation
  if (shouldEscalate(userMessage)) {
    conversation.escalated = true;
    const escalationMsg = qualificationRules.escalationMessage[conversation.language]
      || qualificationRules.escalationMessage.de;

    conversation.messages.push(
      { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
      { role: 'assistant', content: escalationMsg, timestamp: new Date().toISOString() }
    );

    // Notify CEO
    await notifyEscalation(conversation, userMessage);

    return {
      response: escalationMsg,
      action: 'escalate',
      escalated: true,
    };
  }

  // Add user message
  conversation.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  });

  // Build messages for Claude
  const systemPrompt = buildSystemPrompt(conversation.language);
  const claudeMessages = conversation.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));

  // Generate response via Claude
  try {
    const responseText = await generateText(
      claudeMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n') +
      '\n\nAssistant:',
      {
        system: systemPrompt,
        model: config.models.fast,
        maxTokens: 500,
        temperature: 0.7,
      }
    );

    // Add assistant response
    conversation.messages.push({
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
    });

    // Try to extract qualification data from the conversation
    await extractQualificationData(conversation);

    // Calculate score and determine action
    const score = calculateQualificationScore(conversation.qualificationData);
    conversation.qualificationScore = score;
    const action = getQualificationAction(score);

    // Persist to Airtable periodically
    if (conversation.messages.length % 4 === 0) {
      await persistConversation(conversation);
    }

    return {
      response: responseText,
      action: score >= 60 ? action : null,
      qualificationScore: score,
      bookingUrl: action === 'book_call' ? knowledgeBase.bookingUrl : null,
      fitnessCheckUrl: action === 'fitness_check' ? knowledgeBase.fitnessCheckUrl : null,
    };
  } catch (error) {
    logger.error(`Claude API error for session ${sessionId}: ${error.message}`);

    const fallback = getLocalizedText(conversation.language, {
      de: 'Entschuldigung, ich habe gerade ein technisches Problem. Bitte versuchen Sie es erneut oder buchen Sie direkt einen Termin.',
      en: 'Sorry, I\'m experiencing a technical issue. Please try again or book an appointment directly.',
      fr: 'Desole, j\'ai un probleme technique. Veuillez reessayer ou prendre directement rendez-vous.',
      it: 'Mi scusi, ho un problema tecnico. Riprovi o prenoti direttamente un appuntamento.',
    });

    conversation.messages.push({
      role: 'assistant',
      content: fallback,
      timestamp: new Date().toISOString(),
    });

    return {
      response: fallback,
      action: 'error',
      bookingUrl: knowledgeBase.bookingUrl,
    };
  }
}

/**
 * Extract qualification data from conversation using Claude.
 */
async function extractQualificationData(conversation) {
  // Only extract every 3 messages to save API calls
  if (conversation.messages.length % 3 !== 0) return;

  const recentMessages = conversation.messages.slice(-6);
  const prompt = `Extract any qualification data from this conversation snippet.
Return ONLY the data you can clearly identify, as JSON:
{
  "companyName": "string or null",
  "industry": "string or null",
  "challenge": "string or null",
  "budget": "string or null",
  "contactInfo": "string or null",
  "existingWebsite": "string or null"
}

Conversation:
${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`;

  try {
    const extracted = await generateJSON(prompt, {
      model: config.models.fast,
      maxTokens: 300,
    });

    // Merge with existing data (don't overwrite with null)
    for (const [key, value] of Object.entries(extracted)) {
      if (value && value !== 'null') {
        conversation.qualificationData[key] = value;
      }
    }
  } catch (error) {
    // Non-critical - qualification extraction can fail silently
    logger.warn(`Qualification extraction failed: ${error.message}`);
  }
}

// ── Persistence ──────────────────────────────────────────────────────────────

/**
 * Persist conversation to Airtable.
 */
async function persistConversation(conversation) {
  try {
    const existing = await getRecords(
      TABLES.CONVERSATIONS,
      `{SessionId} = "${conversation.sessionId}"`
    );

    const fields = {
      SessionId: conversation.sessionId,
      Language: conversation.language,
      MessageCount: conversation.messages.length,
      QualificationScore: conversation.qualificationScore,
      QualificationData: JSON.stringify(conversation.qualificationData),
      Status: conversation.status,
      Escalated: conversation.escalated,
      LastActivity: new Date().toISOString(),
    };

    if (existing.length > 0) {
      await updateRecord(TABLES.CONVERSATIONS, existing[0].id, fields);
    } else {
      fields.StartedAt = conversation.startedAt;
      await createRecord(TABLES.CONVERSATIONS, fields);
    }

    // If qualified and has contact info, create/update lead
    if (conversation.qualificationScore >= 60 && conversation.qualificationData.contactInfo) {
      await createLeadFromChat(conversation);
    }
  } catch (error) {
    logger.error(`Failed to persist conversation ${conversation.sessionId}: ${error.message}`);
  }
}

/**
 * Create a lead from a qualified chat conversation.
 */
async function createLeadFromChat(conversation) {
  const qd = conversation.qualificationData;

  try {
    // Check if lead already exists
    const existingLeads = await getRecords(
      TABLES.LEADS,
      `{ChatSessionId} = "${conversation.sessionId}"`
    );

    if (existingLeads.length > 0) return;

    await createRecord(TABLES.LEADS, {
      CompanyName: qd.companyName || 'Chat Lead',
      Industry: qd.industry || '',
      ContactName: qd.contactInfo || '',
      Email: extractEmail(qd.contactInfo) || '',
      Source: 'Chat Widget',
      Status: 'New Lead',
      Notes: `Challenge: ${qd.challenge || 'N/A'}\nBudget: ${qd.budget || 'N/A'}\nQualification Score: ${conversation.qualificationScore}`,
      ChatSessionId: conversation.sessionId,
      CreatedAt: new Date().toISOString(),
    });

    logger.info(`Lead created from chat: ${qd.companyName || 'Unknown'}`);
  } catch (error) {
    logger.error(`Failed to create lead from chat: ${error.message}`);
  }
}

// ── Escalation Notification ──────────────────────────────────────────────────

async function notifyEscalation(conversation, triggerMessage) {
  const html = `
    <h2>Chat Escalation Required</h2>
    <p><strong>Session:</strong> ${conversation.sessionId}</p>
    <p><strong>Language:</strong> ${conversation.language.toUpperCase()}</p>
    <p><strong>Trigger Message:</strong> "${triggerMessage}"</p>
    <p><strong>Qualification Data:</strong></p>
    <pre>${JSON.stringify(conversation.qualificationData, null, 2)}</pre>
    <h3>Recent Messages</h3>
    ${conversation.messages.slice(-6).map(m =>
      `<p><strong>${m.role}:</strong> ${m.content}</p>`
    ).join('')}
  `;

  try {
    await sendCEOEmail({
      subject: 'Chat Escalation: Human Response Needed',
      html,
    });
    logger.info(`Escalation notification sent for session ${conversation.sessionId}`);
  } catch (error) {
    logger.error(`Failed to send escalation notification: ${error.message}`);
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function getLocalizedText(language, texts) {
  return texts[language] || texts.de;
}

function extractEmail(text) {
  if (!text) return null;
  const match = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  return match ? match[0] : null;
}

// ── Express API ──────────────────────────────────────────────────────────────

const app = express();

app.use(cors({
  origin: [
    'https://werkpilot.ch',
    'https://www.werkpilot.ch',
    /^http:\/\/localhost:\d+$/,
  ],
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));

// Rate limiting (simple in-memory)
const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // max requests per window

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimiter.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimiter.set(ip, { windowStart: now, count: 1 });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up rate limiter periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimiter.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimiter.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Middleware: rate limiting
app.use('/api/chat', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }
  next();
});

/**
 * POST /api/chat/start - Start a new conversation
 */
app.post('/api/chat/start', (req, res) => {
  try {
    const { language } = req.body;
    const lang = SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;

    const conversation = createConversation(lang);
    const greeting = qualificationRules.qualificationFlow.steps[0];
    const greetingMessage = greeting.message[lang] || greeting.message.de;

    conversation.messages.push({
      role: 'assistant',
      content: greetingMessage,
      timestamp: new Date().toISOString(),
    });

    logger.info(`New chat session started: ${conversation.sessionId} (${lang})`);

    res.json({
      sessionId: conversation.sessionId,
      message: greetingMessage,
      options: greeting.options ? (greeting.options[lang] || greeting.options.de) : null,
      language: lang,
    });
  } catch (error) {
    logger.error(`Error starting chat: ${error.message}`);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

/**
 * POST /api/chat - Send a message
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    if (typeof message !== 'string' || message.length > 2000) {
      return res.status(400).json({ error: 'Invalid message' });
    }

    const conversation = getConversation(sessionId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found. Please start a new chat.' });
    }

    const result = await processMessage(sessionId, message.trim());

    res.json({
      sessionId,
      message: result.response,
      action: result.action,
      bookingUrl: result.bookingUrl,
      fitnessCheckUrl: result.fitnessCheckUrl,
      escalated: result.escalated || false,
    });
  } catch (error) {
    logger.error(`Error processing chat message: ${error.message}`);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * GET /api/chat/history - Get conversation history
 */
app.get('/api/chat/history', (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const conversation = getConversation(sessionId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      sessionId,
      language: conversation.language,
      messages: conversation.messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
      qualificationScore: conversation.qualificationScore,
    });
  } catch (error) {
    logger.error(`Error fetching chat history: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * POST /api/chat/feedback - Submit feedback
 */
app.post('/api/chat/feedback', async (req, res) => {
  try {
    const { sessionId, rating, comment } = req.body;
    if (!sessionId || rating === undefined) {
      return res.status(400).json({ error: 'sessionId and rating are required' });
    }

    const conversation = getConversation(sessionId);
    if (conversation) {
      conversation.feedback = { rating, comment, timestamp: new Date().toISOString() };
      await persistConversation(conversation);
    }

    logger.info(`Chat feedback received: session=${sessionId}, rating=${rating}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`Error saving feedback: ${error.message}`);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

/**
 * Health check
 */
app.get('/api/chat/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: conversations.size,
    uptime: process.uptime(),
  });
});

// ── Session Cleanup ──────────────────────────────────────────────────────────

// Clean up stale sessions (older than 2 hours)
setInterval(async () => {
  const now = Date.now();
  const staleThreshold = 2 * 60 * 60 * 1000;

  for (const [sessionId, conversation] of conversations.entries()) {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const lastActivity = lastMessage ? new Date(lastMessage.timestamp).getTime() : 0;

    if (now - lastActivity > staleThreshold) {
      // Persist before removing
      try {
        conversation.status = 'ended';
        await persistConversation(conversation);
      } catch (error) {
        logger.warn(`Failed to persist stale session ${sessionId}: ${error.message}`);
      }
      conversations.delete(sessionId);
      logger.info(`Cleaned up stale session: ${sessionId}`);
    }
  }
}, 30 * 60 * 1000);

// ── Server Start ─────────────────────────────────────────────────────────────

function startServer() {
  app.listen(PORT, () => {
    logger.info(`Inside Sales Bot API running on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/api/chat/health`);
  });
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  app,
  startServer,
  processMessage,
  createConversation,
  calculateQualificationScore,
  detectLanguage,
  buildSystemPrompt,
};

// Start server if executed directly
if (require.main === module) {
  startServer();
}
