const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

let client = null;

// Cost per 1M tokens (in USD)
const MODEL_COSTS = {
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
};

// Model fallback chain
const MODEL_FALLBACK = {
  'claude-opus-4-6': 'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-5-20250929': 'claude-3-5-haiku-20241022',
  'claude-3-5-sonnet-20241022': 'claude-3-5-haiku-20241022',
  'claude-3-5-haiku-20241022': 'claude-3-haiku-20240307',
};

// Usage tracking
const USAGE_FILE = path.join(__dirname, '../../.claude-usage.json');
const CACHE_DIR = path.join(__dirname, '../../.claude-cache');
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

let usageData = { dailyUsage: {}, totalCost: 0 };

function loadUsage() {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      usageData = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load usage data:', err.message);
  }
}

function saveUsage() {
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usageData, null, 2));
  } catch (err) {
    console.error('Failed to save usage data:', err.message);
  }
}

function getDateKey() {
  return new Date().toISOString().split('T')[0];
}

function getDailyUsage(date = getDateKey()) {
  if (!usageData.dailyUsage[date]) {
    usageData.dailyUsage[date] = {
      date,
      models: {},
      totalCost: 0,
      totalTokens: 0,
      requestCount: 0,
    };
  }
  return usageData.dailyUsage[date];
}

function getModelUsage(date, model) {
  const daily = getDailyUsage(date);
  if (!daily.models[model]) {
    daily.models[model] = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      requests: 0,
    };
  }
  return daily.models[model];
}

function trackUsage(model, promptTokens, completionTokens, cost, latencyMs) {
  const date = getDateKey();
  const daily = getDailyUsage(date);
  const modelUsage = getModelUsage(date, model);

  modelUsage.promptTokens += promptTokens;
  modelUsage.completionTokens += completionTokens;
  modelUsage.totalTokens += promptTokens + completionTokens;
  modelUsage.cost += cost;
  modelUsage.requests += 1;

  daily.totalCost += cost;
  daily.totalTokens += promptTokens + completionTokens;
  daily.requestCount += 1;

  usageData.totalCost += cost;

  console.log(`[Claude] ${model} | ${promptTokens} in + ${completionTokens} out = $${cost.toFixed(4)} | ${latencyMs}ms | Daily: $${daily.totalCost.toFixed(2)}`);

  saveUsage();
}

function calculateCost(model, promptTokens, completionTokens) {
  const costs = MODEL_COSTS[model] || MODEL_COSTS['claude-sonnet-4-5-20250929'];
  const inputCost = (promptTokens / 1_000_000) * costs.input;
  const outputCost = (completionTokens / 1_000_000) * costs.output;
  return inputCost + outputCost;
}

function checkBudget() {
  const dailyBudget = parseFloat(process.env.DAILY_AI_BUDGET || '50');
  const daily = getDailyUsage();
  return daily.totalCost < dailyBudget;
}

function getCacheKey(prompt, system, model) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify({ prompt, system, model }));
  return hash.digest('hex');
}

function getCachedResponse(cacheKey) {
  try {
    if (!fs.existsSync(CACHE_DIR)) return null;
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    if (!fs.existsSync(cachePath)) return null;

    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      fs.unlinkSync(cachePath);
      return null;
    }
    console.log(`[Claude] Cache HIT for ${cacheKey.substring(0, 8)}`);
    return cached.response;
  } catch {
    return null;
  }
}

function setCachedResponse(cacheKey, response) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    fs.writeFileSync(cachePath, JSON.stringify({ timestamp: Date.now(), response }));
  } catch (err) {
    console.error('Failed to cache response:', err.message);
  }
}

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

async function generateText(prompt, { system = '', model = 'claude-sonnet-4-5-20250929', maxTokens = 2048, temperature = 0.7, useCache = true } = {}) {
  loadUsage();

  // Check cache
  const cacheKey = getCacheKey(prompt, system, model);
  if (useCache) {
    const cached = getCachedResponse(cacheKey);
    if (cached) return cached.text;
  }

  // Check budget and fallback if needed
  let currentModel = model;
  if (!checkBudget() && MODEL_FALLBACK[currentModel]) {
    console.warn(`[Claude] Daily budget exceeded, falling back to ${MODEL_FALLBACK[currentModel]}`);
    currentModel = MODEL_FALLBACK[currentModel];
  }

  const client = getClient();
  const messages = [{ role: 'user', content: prompt }];
  const params = { model: currentModel, max_tokens: maxTokens, messages, temperature };
  if (system) params.system = system;

  const startTime = Date.now();
  const response = await client.messages.create(params);
  const latencyMs = Date.now() - startTime;

  const promptTokens = response.usage.input_tokens;
  const completionTokens = response.usage.output_tokens;
  const cost = calculateCost(currentModel, promptTokens, completionTokens);

  trackUsage(currentModel, promptTokens, completionTokens, cost, latencyMs);

  const text = response.content[0].text;

  // Cache the response
  if (useCache) {
    setCachedResponse(cacheKey, { text, promptTokens, completionTokens, totalCost: cost, model: currentModel, latencyMs });
  }

  return text;
}

async function generateJSON(prompt, { system = '', model = 'claude-sonnet-4-5-20250929', maxTokens = 1024, useCache = true } = {}) {
  const text = await generateText(prompt, { system: system + '\nRespond ONLY with valid JSON, no markdown.', model, maxTokens, useCache });
  try {
    return JSON.parse(text.trim());
  } catch {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse Claude response as JSON');
  }
}

function getUsageStats(date = getDateKey()) {
  loadUsage();
  return getDailyUsage(date);
}

function resetUsage() {
  usageData = { dailyUsage: {}, totalCost: 0 };
  saveUsage();
}

module.exports = { getClient, generateText, generateJSON, getUsageStats, resetUsage };
