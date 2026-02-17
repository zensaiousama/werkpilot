/**
 * Agent 19 — Translation Engine Agent
 * Department: Operations
 *
 * Multi-language translation engine with Swiss localization.
 * Pipeline: Detect language -> Translate (DeepL) -> Localize (Claude) -> Format -> QA -> Deliver
 *
 * Supports: DE-CH, FR-CH, IT-CH with Swiss-specific adaptations.
 * Handles: plain text, Markdown, HTML formats.
 * Manages customer glossaries for consistent terminology.
 *
 * Schedule: On-demand via API/Airtable trigger, batch processing at 06:00 daily
 */

const cron = require('node-cron');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const { sendEmail, sendCEOEmail } = require('../shared/utils/email-client');
const config = require('../shared/utils/config');

const log = createLogger('translation-engine');

// --- Localization Rules & Glossaries ---

const RULES_DIR = path.join(__dirname, 'localization-rules');
const GLOSSARY_DIR = path.join(__dirname, 'glossaries');

let localizationRules = {};
let glossaries = {};

function loadLocalizationRules() {
  try {
    const files = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const locale = file.replace('.json', '');
      localizationRules[locale] = JSON.parse(fs.readFileSync(path.join(RULES_DIR, file), 'utf8'));
    }
    log.info(`Loaded localization rules: ${Object.keys(localizationRules).join(', ')}`);
  } catch (err) {
    log.error(`Failed to load localization rules: ${err.message}`);
  }
}

function loadGlossaries() {
  try {
    const files = fs.readdirSync(GLOSSARY_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const name = file.replace('.json', '');
      glossaries[name] = JSON.parse(fs.readFileSync(path.join(GLOSSARY_DIR, file), 'utf8'));
    }
    log.info(`Loaded glossaries: ${Object.keys(glossaries).join(', ')}`);
  } catch (err) {
    log.error(`Failed to load glossaries: ${err.message}`);
  }
}

// --- Language Detection ---

async function detectLanguage(text) {
  try {
    // Use DeepL for language detection first
    if (config.api.deepl) {
      const response = await axios.post(
        'https://api-free.deepl.com/v2/translate',
        new URLSearchParams({
          auth_key: config.api.deepl,
          text: text.substring(0, 500),
          target_lang: 'EN',
        }),
        { timeout: 10000 }
      );

      if (response.data && response.data.translations && response.data.translations[0]) {
        const detected = response.data.translations[0].detected_source_language;
        log.info(`Language detected via DeepL: ${detected}`);
        return detected.toLowerCase();
      }
    }
  } catch (err) {
    log.warn(`DeepL detection failed, falling back to Claude: ${err.message}`);
  }

  // Fallback to Claude
  try {
    const result = await generateJSON(
      `Detect the language of this text and respond with JSON containing "language" (ISO 639-1 code) and "confidence" (0-1):\n\n${text.substring(0, 1000)}`,
      { model: config.models.fast, maxTokens: 100 }
    );
    log.info(`Language detected via Claude: ${result.language} (confidence: ${result.confidence})`);
    return result.language;
  } catch (err) {
    log.error(`Language detection failed: ${err.message}`);
    return 'unknown';
  }
}

// --- Translation via DeepL ---

const DEEPL_LANG_MAP = {
  'de-ch': 'DE',
  'fr-ch': 'FR',
  'it-ch': 'IT',
  'de': 'DE',
  'fr': 'FR',
  'it': 'IT',
  'en': 'EN-US',
  'es': 'ES',
  'pt': 'PT-PT',
};

async function translateWithDeepL(text, sourceLang, targetLang, format = 'text') {
  if (!config.api.deepl) {
    throw new Error('DeepL API key not configured');
  }

  const targetCode = DEEPL_LANG_MAP[targetLang] || DEEPL_LANG_MAP[targetLang.split('-')[0]] || targetLang.toUpperCase();
  const sourceCode = sourceLang ? (DEEPL_LANG_MAP[sourceLang] || sourceLang.toUpperCase()) : undefined;

  const params = {
    auth_key: config.api.deepl,
    text,
    target_lang: targetCode,
  };

  if (sourceCode) params.source_lang = sourceCode;

  // DeepL supports tag handling for HTML/XML
  if (format === 'html') {
    params.tag_handling = 'html';
  } else if (format === 'xml') {
    params.tag_handling = 'xml';
  }

  try {
    const response = await axios.post(
      'https://api-free.deepl.com/v2/translate',
      new URLSearchParams(params),
      { timeout: 30000 }
    );

    const translation = response.data.translations[0];
    const charCount = text.length;

    log.info(`DeepL translation: ${sourceLang || 'auto'} -> ${targetLang}, ${charCount} chars`);

    return {
      translatedText: translation.text,
      detectedSourceLang: translation.detected_source_language,
      characterCount: charCount,
    };
  } catch (err) {
    log.error(`DeepL translation failed: ${err.message}`);
    throw err;
  }
}

// --- Swiss Localization via Claude ---

async function localizeForSwiss(text, targetLocale, format = 'text', glossaryName = 'default') {
  const rules = localizationRules[targetLocale];
  if (!rules) {
    log.warn(`No localization rules found for ${targetLocale}, skipping localization`);
    return text;
  }

  const glossary = glossaries[glossaryName] || glossaries['default'];
  const doNotTranslate = glossary ? glossary.doNotTranslate || [] : [];
  const glossaryEntries = glossary ? glossary.entries || {} : {};

  // Build glossary context for Claude
  let glossaryContext = '';
  if (Object.keys(glossaryEntries).length > 0) {
    const relevantEntries = Object.entries(glossaryEntries)
      .filter(([term]) => text.toLowerCase().includes(term.toLowerCase()))
      .map(([term, data]) => {
        const translation = data.translations[targetLocale] || term;
        return `"${term}" -> "${translation}"${data.notes ? ` (${data.notes})` : ''}`;
      });

    if (relevantEntries.length > 0) {
      glossaryContext = `\n\nGlossary - use these exact translations:\n${relevantEntries.join('\n')}`;
    }
  }

  const systemPrompt = `You are a Swiss localization expert for ${rules.name} (${rules.locale}).
Apply these Swiss-specific rules to the translated text:

${targetLocale === 'de-ch' ? `
- Replace all "ß" (Eszett) with "ss" (Swiss German never uses ß)
- Use Swiss German greetings: "Grüezi" instead of "Hallo", "Uf Widerluege" instead of "Auf Wiedersehen"
- Use Swiss vocabulary: Velo (not Fahrrad), Trottoir (not Bürgersteig), Spital (not Krankenhaus)
- Date format: DD.MM.YYYY
- Currency: CHF with apostrophe thousands separator (CHF 1'000.00)
- Phone format: +41 XX XXX XX XX
` : ''}
${targetLocale === 'fr-ch' ? `
- Use Swiss French numbers: septante (70), huitante (80), nonante (90)
- Use Swiss French meal names: déjeuner (breakfast), dîner (lunch), souper (dinner)
- Date format: DD.MM.YYYY (dots, not slashes)
- Currency: CHF with apostrophe thousands separator
- Phone format: +41 XX XXX XX XX
` : ''}
${targetLocale === 'it-ch' ? `
- Use Ticinese Italian where appropriate
- Include Swiss-Italian administrative terms
- Date format: DD.MM.YYYY
- Currency: CHF with apostrophe thousands separator
- Phone format: +41 XX XXX XX XX
` : ''}

Do NOT translate these terms: ${doNotTranslate.join(', ')}
${glossaryContext}

${format === 'html' ? 'IMPORTANT: Preserve all HTML tags exactly. Only localize the text content.' : ''}
${format === 'markdown' ? 'IMPORTANT: Preserve all Markdown formatting exactly. Only localize the text content.' : ''}

Return ONLY the localized text, no explanations.`;

  try {
    const localized = await generateText(
      `Localize this ${rules.locale} text with Swiss-specific adaptations:\n\n${text}`,
      { system: systemPrompt, model: config.models.fast, maxTokens: Math.max(text.length * 2, 2000) }
    );

    log.info(`Swiss localization applied for ${targetLocale}`);
    return localized.trim();
  } catch (err) {
    log.error(`Swiss localization failed: ${err.message}`);
    return text; // Return unlocalized text as fallback
  }
}

// --- Quick Rule-Based Localization (no AI needed) ---

function applyQuickRules(text, targetLocale) {
  const rules = localizationRules[targetLocale];
  if (!rules) return text;

  let result = text;

  // Apply orthography rules (e.g., ß -> ss for de-CH)
  if (rules.orthography) {
    for (const [ruleType, ruleData] of Object.entries(rules.orthography)) {
      if (ruleData.replace) {
        for (const [from, to] of Object.entries(ruleData.replace)) {
          result = result.split(from).join(to);
        }
      }
    }
  }

  // Apply number replacements (e.g., French numbers)
  if (rules.numbers && rules.numbers.replace) {
    for (const [from, to] of Object.entries(rules.numbers.replace)) {
      const regex = new RegExp(`\\b${from}\\b`, 'gi');
      result = result.replace(regex, to);
    }
  }

  // Apply currency replacements
  if (rules.currency && rules.currency.replace) {
    for (const [from, to] of Object.entries(rules.currency.replace)) {
      result = result.split(from).join(to);
    }
  }

  return result;
}

// --- Translation Memory ---

const TRANSLATION_MEMORY_PATH = path.join(__dirname, 'translation-memory.json');
let translationMemory = {};

function loadTranslationMemory() {
  try {
    if (fs.existsSync(TRANSLATION_MEMORY_PATH)) {
      translationMemory = JSON.parse(fs.readFileSync(TRANSLATION_MEMORY_PATH, 'utf8'));
      log.info(`Translation memory loaded: ${Object.keys(translationMemory).length} entries`);
    } else {
      translationMemory = {};
      log.info('No translation memory found, starting fresh');
    }
  } catch (err) {
    log.error(`Failed to load translation memory: ${err.message}`);
    translationMemory = {};
  }
}

function saveTranslationMemory() {
  try {
    fs.writeFileSync(TRANSLATION_MEMORY_PATH, JSON.stringify(translationMemory, null, 2));
  } catch (err) {
    log.error(`Failed to save translation memory: ${err.message}`);
  }
}

function getTranslationFromMemory(text, targetLocale) {
  const key = `${text.trim()}_${targetLocale}`;
  const hash = require('crypto').createHash('md5').update(key).digest('hex');

  if (translationMemory[hash]) {
    const entry = translationMemory[hash];
    // Cache valid for 90 days
    const age = Date.now() - new Date(entry.timestamp).getTime();
    if (age < 90 * 24 * 3600000) {
      log.info(`Translation memory hit: ${hash.substring(0, 8)}`);
      return entry.translation;
    } else {
      // Expired
      delete translationMemory[hash];
    }
  }

  return null;
}

function addTranslationToMemory(text, targetLocale, translation, qualityScore) {
  const key = `${text.trim()}_${targetLocale}`;
  const hash = require('crypto').createHash('md5').update(key).digest('hex');

  translationMemory[hash] = {
    original: text.substring(0, 500),
    translation: translation,
    targetLocale,
    qualityScore,
    timestamp: new Date().toISOString(),
  };

  saveTranslationMemory();
  log.info(`Translation added to memory: ${hash.substring(0, 8)}`);
}

// --- Swiss German Dialect Handling ---

const SWISS_GERMAN_IDIOMS = {
  'Grüezi mitenand': 'Grüezi',
  'lueg emol': 'schau mal',
  'mached Si': 'machen Sie',
  'gäll': 'nicht wahr',
  'händ Si': 'haben Sie',
  'chönd Si': 'können Sie',
  'wänd Si': 'wollen Sie',
  'Es gaht um': 'Es geht um',
  'mir händ': 'wir haben',
  'mir sind': 'wir sind',
  'üs Team': 'unser Team',
  'züri': 'Zürich',
  'bärn': 'Bern',
  'bizli': 'bisschen',
  'no': 'noch',
  'scho': 'schon',
};

function handleSwissGermanDialect(text, targetLocale) {
  if (targetLocale !== 'de-ch') return text;

  let result = text;

  // Convert Züridütsch idioms to standard Swiss German
  for (const [dialect, standard] of Object.entries(SWISS_GERMAN_IDIOMS)) {
    const regex = new RegExp(dialect, 'gi');
    result = result.replace(regex, standard);
  }

  log.info('Swiss German dialect normalization applied');
  return result;
}

// --- Quality Scoring ---

async function scoreTranslationQuality(original, translated, targetLocale, format = 'text') {
  try {
    const result = await generateJSON(
      `Score this ${targetLocale} translation across multiple dimensions:

Original (${format}):
${original.substring(0, 2000)}

Translation (${format}):
${translated.substring(0, 2000)}

Provide scores (0-10) for:
1. fluency - how natural and fluent does the translation read?
2. accuracy - how accurately does it preserve the original meaning?
3. culturalFit - how well adapted is it to Swiss ${targetLocale} culture/context?
4. formality - is the formality level appropriate for Swiss business communication?
5. consistency - are terms translated consistently?

Also provide:
- overallScore (0-10, weighted average)
- strengths (array of strings)
- weaknesses (array of strings)

Respond with JSON: { "fluency": number, "accuracy": number, "culturalFit": number, "formality": number, "consistency": number, "overallScore": number, "strengths": [], "weaknesses": [] }`,
      { model: config.models.fast, maxTokens: 800 }
    );

    log.info(`Quality scoring: overall=${result.overallScore}, fluency=${result.fluency}, accuracy=${result.accuracy}, culturalFit=${result.culturalFit}`);
    return result;
  } catch (err) {
    log.error(`Quality scoring failed: ${err.message}`);
    return {
      fluency: 0,
      accuracy: 0,
      culturalFit: 0,
      formality: 0,
      consistency: 0,
      overallScore: 0,
      strengths: [],
      weaknesses: ['Scoring failed: ' + err.message]
    };
  }
}

// --- QA Check ---

async function qaCheck(original, translated, targetLocale, format = 'text') {
  try {
    const result = await generateJSON(
      `Compare the original text and its ${targetLocale} translation. Check for:
1. Missing content (anything in original not in translation)
2. Added content (anything in translation not in original)
3. Formatting issues (broken HTML/Markdown if applicable)
4. Swiss localization correctness (dates, currency, terminology)
5. Glossary compliance
6. Overall quality score (1-10)

Original (${format}):
${original.substring(0, 2000)}

Translation (${format}):
${translated.substring(0, 2000)}

Respond with JSON: { "score": number, "issues": [{ "type": string, "description": string, "severity": "low"|"medium"|"high" }], "passed": boolean }`,
      { model: config.models.fast, maxTokens: 1000 }
    );

    log.info(`QA check: score=${result.score}, issues=${(result.issues || []).length}, passed=${result.passed}`);
    return result;
  } catch (err) {
    log.error(`QA check failed: ${err.message}`);
    return { score: 0, issues: [{ type: 'qa-error', description: err.message, severity: 'high' }], passed: false };
  }
}

// --- Format Detection ---

function detectFormat(text) {
  if (/<[a-z][\s\S]*>/i.test(text)) return 'html';
  if (/^#{1,6}\s|^\*\*|^\- |\!\[|^\[.+\]\(.+\)/m.test(text)) return 'markdown';
  return 'text';
}

// --- Cost Tracking ---

let costTracker = {
  deeplChars: 0,
  claudeTokens: 0,
  totalCostCHF: 0,
  lastReset: new Date().toISOString(),
};

function trackCosts(deeplChars = 0, claudeTokens = 0) {
  costTracker.deeplChars += deeplChars;
  costTracker.claudeTokens += claudeTokens;

  // DeepL: ~CHF 25 per 1M chars, Claude: ~CHF 0.015 per 1K tokens (estimated)
  const deeplCost = (deeplChars / 1000000) * 25;
  const claudeCost = (claudeTokens / 1000) * 0.015;

  costTracker.totalCostCHF = parseFloat((deeplCost + claudeCost).toFixed(2));

  log.info(`Cost tracking: DeepL=${deeplChars} chars, Claude=${claudeTokens} tokens, Total=CHF ${costTracker.totalCostCHF}`);
  return costTracker;
}

function getCostStats() {
  return {
    ...costTracker,
    deeplCostCHF: parseFloat(((costTracker.deeplChars / 1000000) * 25).toFixed(2)),
    claudeCostCHF: parseFloat(((costTracker.claudeTokens / 1000) * 0.015).toFixed(2)),
  };
}

function resetCosts() {
  costTracker = {
    deeplChars: 0,
    claudeTokens: 0,
    totalCostCHF: 0,
    lastReset: new Date().toISOString(),
  };
  log.info('Cost tracker reset');
}

// --- Main Translation Pipeline ---

async function translateDocument({
  text,
  targetLocale,
  sourceLang = null,
  format = null,
  glossaryName = 'default',
  clientId = null,
  documentId = null,
  skipQA = false,
  useMemory = true,
}) {
  const startTime = Date.now();
  const detectedFormat = format || detectFormat(text);

  log.info(`Translation pipeline started: -> ${targetLocale}, format=${detectedFormat}, ${text.length} chars`);

  const result = {
    documentId,
    clientId,
    targetLocale,
    format: detectedFormat,
    originalLength: text.length,
    stages: {},
    success: false,
    costs: { deeplChars: 0, claudeTokens: 0 },
  };

  try {
    // Check translation memory first
    if (useMemory && text.length < 5000) {
      const cached = getTranslationFromMemory(text, targetLocale);
      if (cached) {
        result.translatedText = cached;
        result.translatedLength = cached.length;
        result.success = true;
        result.durationMs = Date.now() - startTime;
        result.fromCache = true;
        log.info(`Translation served from memory: ${cached.length} chars`);
        return result;
      }
    }

    // Stage 1: Detect source language
    const source = sourceLang || await detectLanguage(text);
    result.stages.detection = { sourceLang: source, timestamp: new Date().toISOString() };
    log.info(`Stage 1 - Language detected: ${source}`);
    result.costs.claudeTokens += 50; // Estimate for detection

    // Skip if already in target language
    const targetBase = targetLocale.split('-')[0];
    if (source === targetBase || source === targetLocale) {
      log.info(`Source already in ${targetLocale}, applying localization only`);
      const localized = await localizeForSwiss(text, targetLocale, detectedFormat, glossaryName);
      result.translatedText = localized;
      result.stages.localization = { applied: true, timestamp: new Date().toISOString() };
      result.success = true;
      result.durationMs = Date.now() - startTime;
      result.costs.claudeTokens += Math.ceil(text.length / 3);
      trackCosts(0, result.costs.claudeTokens);
      return result;
    }

    // Stage 2: Swiss German dialect handling (if applicable)
    let preprocessedText = text;
    if (targetLocale === 'de-ch') {
      preprocessedText = handleSwissGermanDialect(text, targetLocale);
      result.stages.dialectHandling = { applied: true, timestamp: new Date().toISOString() };
    }

    // Stage 3: Translate via DeepL
    const translation = await translateWithDeepL(preprocessedText, source, targetLocale, detectedFormat);
    result.stages.translation = {
      engine: 'deepl',
      characterCount: translation.characterCount,
      timestamp: new Date().toISOString(),
    };
    result.costs.deeplChars = translation.characterCount;
    log.info(`Stage 3 - DeepL translation complete: ${translation.characterCount} chars`);

    // Stage 4: Swiss localization via Claude
    let localizedText = translation.translatedText;

    // First apply quick rule-based fixes
    localizedText = applyQuickRules(localizedText, targetLocale);

    // Glossary enforcement - check if glossary terms are correctly used
    const glossary = glossaries[glossaryName] || glossaries['default'];
    if (glossary && glossary.entries) {
      for (const [term, data] of Object.entries(glossary.entries)) {
        const expectedTranslation = data.translations[targetLocale];
        if (expectedTranslation && localizedText.includes(term) && !localizedText.includes(expectedTranslation)) {
          // Replace with glossary translation
          const regex = new RegExp(term, 'gi');
          localizedText = localizedText.replace(regex, expectedTranslation);
          log.info(`Glossary enforcement: "${term}" -> "${expectedTranslation}"`);
        }
      }
    }
    result.stages.glossaryEnforcement = { applied: true, glossary: glossaryName, timestamp: new Date().toISOString() };

    // Then apply AI localization for complex adaptations
    localizedText = await localizeForSwiss(localizedText, targetLocale, detectedFormat, glossaryName);
    result.stages.localization = { applied: true, timestamp: new Date().toISOString() };
    result.costs.claudeTokens += Math.ceil(localizedText.length / 3);
    log.info(`Stage 4 - Swiss localization applied`);

    // Stage 5: Format validation
    if (detectedFormat === 'html') {
      // Basic HTML validation
      const openTags = (localizedText.match(/<[a-z][^>]*>/gi) || []).length;
      const closeTags = (localizedText.match(/<\/[a-z][^>]*>/gi) || []).length;
      result.stages.formatting = { valid: true, openTags, closeTags, timestamp: new Date().toISOString() };
    } else if (detectedFormat === 'markdown') {
      result.stages.formatting = { valid: true, format: 'markdown', timestamp: new Date().toISOString() };
    } else {
      result.stages.formatting = { valid: true, format: 'text', timestamp: new Date().toISOString() };
    }
    log.info(`Stage 5 - Format validation passed`);

    // Stage 6: Quality scoring
    const qualityScore = await scoreTranslationQuality(text, localizedText, targetLocale, detectedFormat);
    result.stages.qualityScoring = { ...qualityScore, timestamp: new Date().toISOString() };
    result.costs.claudeTokens += 300; // Estimate for quality scoring
    log.info(`Stage 6 - Quality scoring: ${qualityScore.overallScore}/10`);

    // Stage 7: QA check
    if (!skipQA) {
      const qa = await qaCheck(text, localizedText, targetLocale, detectedFormat);
      result.stages.qa = { ...qa, timestamp: new Date().toISOString() };
      result.costs.claudeTokens += 200; // Estimate for QA

      if (!qa.passed && qa.score < 6) {
        log.warn(`QA failed with score ${qa.score}, attempting re-translation`);
        // Re-translate with explicit issue fixes
        const fixedText = await generateText(
          `The following ${targetLocale} translation has quality issues. Fix them:

Issues: ${JSON.stringify(qa.issues)}

Translation to fix:
${localizedText}`,
          { model: config.models.standard, maxTokens: Math.max(localizedText.length * 2, 2000) }
        );
        localizedText = fixedText.trim();
        result.stages.qa.reTranslated = true;
        result.costs.claudeTokens += Math.ceil(localizedText.length / 2);
      }
    } else {
      result.stages.qa = { skipped: true };
    }
    log.info(`Stage 7 - QA ${skipQA ? 'skipped' : 'complete'}`);

    result.translatedText = localizedText;
    result.translatedLength = localizedText.length;
    result.success = true;
    result.durationMs = Date.now() - startTime;

    // Add to translation memory if quality is high
    if (useMemory && qualityScore.overallScore >= 7 && text.length < 5000) {
      addTranslationToMemory(text, targetLocale, localizedText, qualityScore.overallScore);
    }

    // Track costs
    trackCosts(result.costs.deeplChars, result.costs.claudeTokens);
    result.costs.totalCHF = parseFloat((
      (result.costs.deeplChars / 1000000) * 25 +
      (result.costs.claudeTokens / 1000) * 0.015
    ).toFixed(4));

    // Track metrics
    await trackTranslation(result);

    log.info(`Translation pipeline complete: ${result.durationMs}ms, ${result.originalLength} -> ${result.translatedLength} chars, CHF ${result.costs.totalCHF}`);

    return result;
  } catch (err) {
    log.error(`Translation pipeline failed: ${err.message}`);
    result.error = err.message;
    result.success = false;
    result.durationMs = Date.now() - startTime;
    return result;
  }
}

// --- Batch Translation ---

async function translateBatch(documents, targetLocale, options = {}) {
  const results = [];
  const batchId = `batch_${Date.now()}`;
  const startTime = Date.now();

  log.info(`Batch translation started: ${documents.length} documents -> ${targetLocale}`);

  // Parallel processing for efficiency (max 3 concurrent)
  const concurrency = options.concurrency || 3;
  const batches = [];

  for (let i = 0; i < documents.length; i += concurrency) {
    const batch = documents.slice(i, i + concurrency);
    batches.push(batch);
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    log.info(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} documents)`);

    const batchPromises = batch.map(doc => translateDocument({
      text: doc.text,
      targetLocale,
      sourceLang: doc.sourceLang || null,
      format: doc.format || null,
      glossaryName: options.glossaryName || 'default',
      clientId: doc.clientId || options.clientId,
      documentId: doc.id,
      skipQA: options.skipQA || false,
      useMemory: options.useMemory !== false,
    }));

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Rate limiting between batches
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const summary = {
    batchId,
    totalDocuments: documents.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    fromCache: results.filter(r => r.fromCache).length,
    totalCharacters: results.reduce((sum, r) => sum + r.originalLength, 0),
    totalDurationMs: Date.now() - startTime,
    avgQualityScore: 0,
    totalCostCHF: results.reduce((sum, r) => sum + (r.costs?.totalCHF || 0), 0).toFixed(2),
    results,
  };

  // Calculate average quality score
  const withScores = results.filter(r => r.stages?.qualityScoring?.overallScore);
  if (withScores.length > 0) {
    summary.avgQualityScore = (
      withScores.reduce((sum, r) => sum + r.stages.qualityScoring.overallScore, 0) / withScores.length
    ).toFixed(1);
  }

  log.info(`Batch translation complete: ${summary.successful}/${summary.totalDocuments} successful, ${summary.fromCache} from cache, CHF ${summary.totalCostCHF}, avg quality ${summary.avgQualityScore}/10`);
  return summary;
}

// --- Glossary Management ---

function getGlossary(name) {
  return glossaries[name] || null;
}

function addGlossaryEntry(glossaryName, term, translations, notes = '') {
  if (!glossaries[glossaryName]) {
    glossaries[glossaryName] = {
      name: glossaryName,
      version: '1.0.0',
      lastUpdated: new Date().toISOString().split('T')[0],
      entries: {},
      doNotTranslate: [],
    };
  }

  glossaries[glossaryName].entries[term] = { translations, notes };
  glossaries[glossaryName].lastUpdated = new Date().toISOString().split('T')[0];

  // Persist to disk
  const filePath = path.join(GLOSSARY_DIR, `${glossaryName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(glossaries[glossaryName], null, 2));

  log.info(`Glossary entry added: "${term}" in ${glossaryName}`);
  return glossaries[glossaryName];
}

function createClientGlossary(clientId, entries = {}) {
  const glossaryName = `client-${clientId}`;
  glossaries[glossaryName] = {
    name: `Client ${clientId} Glossary`,
    version: '1.0.0',
    lastUpdated: new Date().toISOString().split('T')[0],
    description: `Custom glossary for client ${clientId}`,
    entries,
    doNotTranslate: [],
  };

  const filePath = path.join(GLOSSARY_DIR, `${glossaryName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(glossaries[glossaryName], null, 2));

  log.info(`Client glossary created: ${glossaryName}`);
  return glossaries[glossaryName];
}

// --- Metrics Tracking ---

async function trackTranslation(result) {
  try {
    await createRecord('Translations', {
      DocumentID: result.documentId || '',
      ClientID: result.clientId || '',
      TargetLocale: result.targetLocale,
      Format: result.format,
      OriginalChars: result.originalLength,
      TranslatedChars: result.translatedLength || 0,
      DurationMs: result.durationMs,
      QAScore: result.stages.qa ? result.stages.qa.score || 0 : 0,
      Success: result.success,
      Date: new Date().toISOString().split('T')[0],
    });
  } catch (err) {
    log.warn(`Failed to track translation metrics: ${err.message}`);
  }
}

async function getTranslationStats(days = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = cutoffDate.toISOString().split('T')[0];

    const records = await getRecords('Translations', `{Date} >= '${cutoff}'`);

    const stats = {
      totalTranslations: records.length,
      totalCharactersTranslated: records.reduce((sum, r) => sum + (r.OriginalChars || 0), 0),
      averageQAScore: 0,
      successRate: 0,
      byLocale: {},
      byClient: {},
      totalDurationMs: records.reduce((sum, r) => sum + (r.DurationMs || 0), 0),
    };

    if (records.length > 0) {
      const withScores = records.filter(r => r.QAScore > 0);
      stats.averageQAScore = withScores.length > 0
        ? (withScores.reduce((sum, r) => sum + r.QAScore, 0) / withScores.length).toFixed(1)
        : 0;
      stats.successRate = ((records.filter(r => r.Success).length / records.length) * 100).toFixed(1);
    }

    // Breakdown by locale
    records.forEach(r => {
      const locale = r.TargetLocale || 'unknown';
      if (!stats.byLocale[locale]) stats.byLocale[locale] = { count: 0, chars: 0 };
      stats.byLocale[locale].count++;
      stats.byLocale[locale].chars += r.OriginalChars || 0;

      const client = r.ClientID || 'internal';
      if (!stats.byClient[client]) stats.byClient[client] = { count: 0, chars: 0 };
      stats.byClient[client].count++;
      stats.byClient[client].chars += r.OriginalChars || 0;
    });

    // Estimate cost (DeepL pricing: ~$25 per 1M characters)
    stats.estimatedCost = ((stats.totalCharactersTranslated / 1000000) * 25).toFixed(2);

    return stats;
  } catch (err) {
    log.error(`Failed to get translation stats: ${err.message}`);
    return { error: err.message };
  }
}

// --- Process Pending Translations from Airtable ---

async function processPendingTranslations() {
  log.info('Checking for pending translation requests...');

  try {
    const pending = await getRecords('Translations', "{Status} = 'Pending'");

    if (pending.length === 0) {
      log.info('No pending translations found');
      return { processed: 0 };
    }

    log.info(`Found ${pending.length} pending translations`);
    let processed = 0;
    let failed = 0;

    for (const record of pending) {
      try {
        // Mark as in-progress
        await updateRecord('Translations', record.id, { Status: 'In Progress' });

        const result = await translateDocument({
          text: record.SourceText || '',
          targetLocale: record.TargetLocale || 'de-ch',
          sourceLang: record.SourceLang || null,
          format: record.Format || null,
          glossaryName: record.Glossary || 'default',
          clientId: record.ClientID || null,
          documentId: record.id,
        });

        if (result.success) {
          await updateRecord('Translations', record.id, {
            Status: 'Completed',
            TranslatedText: result.translatedText,
            QAScore: result.stages.qa ? result.stages.qa.score : 0,
            DurationMs: result.durationMs,
          });
          processed++;
        } else {
          await updateRecord('Translations', record.id, {
            Status: 'Failed',
            Error: result.error,
          });
          failed++;
        }
      } catch (err) {
        log.error(`Failed to process translation ${record.id}: ${err.message}`);
        await updateRecord('Translations', record.id, {
          Status: 'Failed',
          Error: err.message,
        }).catch(() => {});
        failed++;
      }
    }

    return { processed, failed, total: pending.length };
  } catch (err) {
    log.error(`Failed to process pending translations: ${err.message}`);
    return { error: err.message };
  }
}

// --- Daily Report ---

async function generateDailyReport() {
  log.info('Generating translation daily report...');

  try {
    const stats = await getTranslationStats(1);

    const reportHtml = `
      <h2>Translation Engine - Daily Report</h2>
      <p>Date: ${new Date().toLocaleDateString('de-CH')}</p>

      <h3>Summary</h3>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><td><strong>Translations Completed</strong></td><td>${stats.totalTranslations}</td></tr>
        <tr><td><strong>Characters Translated</strong></td><td>${stats.totalCharactersTranslated.toLocaleString()}</td></tr>
        <tr><td><strong>Average QA Score</strong></td><td>${stats.averageQAScore}/10</td></tr>
        <tr><td><strong>Success Rate</strong></td><td>${stats.successRate}%</td></tr>
        <tr><td><strong>Estimated Cost</strong></td><td>CHF ${stats.estimatedCost}</td></tr>
      </table>

      <h3>By Language</h3>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><th>Locale</th><th>Count</th><th>Characters</th></tr>
        ${Object.entries(stats.byLocale || {}).map(([locale, data]) =>
          `<tr><td>${locale}</td><td>${data.count}</td><td>${data.chars.toLocaleString()}</td></tr>`
        ).join('')}
      </table>
    `;

    return { stats, reportHtml };
  } catch (err) {
    log.error(`Failed to generate daily report: ${err.message}`);
    return { error: err.message };
  }
}

// --- Main Run ---

async function run() {
  log.info('Translation Engine Agent starting...');
  loadLocalizationRules();
  loadGlossaries();
  loadTranslationMemory();

  const result = await processPendingTranslations();
  const costs = getCostStats();

  log.info(`Translation run complete: ${JSON.stringify(result)}, costs: CHF ${costs.totalCostCHF}`);
  return { ...result, costs };
}

// --- Cron Scheduling ---

function startSchedule() {
  loadLocalizationRules();
  loadGlossaries();
  loadTranslationMemory();

  // Process pending translations every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      await processPendingTranslations();
    } catch (err) {
      log.error(`Scheduled translation processing failed: ${err.message}`);
    }
  });

  // Daily report at 18:00
  cron.schedule('0 18 * * *', async () => {
    try {
      const report = await generateDailyReport();
      const costs = getCostStats();

      if (report.reportHtml) {
        await sendCEOEmail({
          subject: 'Translation Engine - Daily Report',
          html: report.reportHtml + `
            <h3>Cost Tracking</h3>
            <table border="1" cellpadding="8" cellspacing="0">
              <tr><td><strong>DeepL Characters</strong></td><td>${costs.deeplChars.toLocaleString()}</td></tr>
              <tr><td><strong>Claude Tokens</strong></td><td>${costs.claudeTokens.toLocaleString()}</td></tr>
              <tr><td><strong>DeepL Cost</strong></td><td>CHF ${costs.deeplCostCHF}</td></tr>
              <tr><td><strong>Claude Cost</strong></td><td>CHF ${costs.claudeCostCHF}</td></tr>
              <tr><td><strong>Total Cost</strong></td><td>CHF ${costs.totalCostCHF}</td></tr>
            </table>
          `,
        });
      }
    } catch (err) {
      log.error(`Daily report generation failed: ${err.message}`);
    }
  });

  // Reset cost tracker at start of each month
  cron.schedule('0 0 1 * *', async () => {
    try {
      const costs = getCostStats();
      log.info(`Monthly cost reset - previous month: CHF ${costs.totalCostCHF}`);
      resetCosts();
    } catch (err) {
      log.error(`Cost reset failed: ${err.message}`);
    }
  });

  log.info('Translation Engine scheduled: pending check every 30min, daily report at 18:00, monthly cost reset');
}

// --- Exports ---

module.exports = {
  run,
  startSchedule,
  translateDocument,
  translateBatch,
  detectLanguage,
  translateWithDeepL,
  localizeForSwiss,
  applyQuickRules,
  qaCheck,
  detectFormat,
  getGlossary,
  addGlossaryEntry,
  createClientGlossary,
  getTranslationStats,
  processPendingTranslations,
  generateDailyReport,
  loadLocalizationRules,
  loadGlossaries,
  // New exports
  scoreTranslationQuality,
  handleSwissGermanDialect,
  loadTranslationMemory,
  getTranslationFromMemory,
  addTranslationToMemory,
  trackCosts,
  getCostStats,
  resetCosts,
};

// Run if called directly
if (require.main === module) {
  run().then(result => {
    log.info(`Translation Engine finished: ${JSON.stringify(result)}`);
    process.exit(0);
  }).catch(err => {
    log.error(`Translation Engine failed: ${err.message}`);
    process.exit(1);
  });
}
