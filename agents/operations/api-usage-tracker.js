/**
 * API Usage Tracker - Utility to track and log API calls across agents
 * Agent 21 support module
 *
 * Tracks usage of Claude, DeepL, MailerLite, and other APIs.
 * Provides cost estimation, rate limit tracking, and usage analytics.
 */

const { createLogger } = require('../shared/utils/logger');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');

const log = createLogger('api-usage-tracker');

// In-memory usage store (flushed to Airtable periodically)
const usageBuffer = [];
const rateLimits = new Map();
const dailyUsage = new Map();

// API pricing (approximate, in USD)
const API_PRICING = {
  'claude-haiku-4-5-20251001': {
    inputPer1kTokens: 0.001,
    outputPer1kTokens: 0.005,
  },
  'claude-sonnet-4-5-20250929': {
    inputPer1kTokens: 0.003,
    outputPer1kTokens: 0.015,
  },
  'claude-opus-4-6': {
    inputPer1kTokens: 0.015,
    outputPer1kTokens: 0.075,
  },
  'deepl': {
    perCharacter: 0.00002,
    freeLimit: 500000,
  },
  'mailerlite': {
    perEmail: 0.001,
    freeLimit: 1000,
  },
  'airtable': {
    perApiCall: 0.0001,
    freeLimit: 100000,
  },
};

/**
 * Track an API call
 */
function trackApiCall({
  api,
  model = null,
  agent,
  action,
  inputTokens = 0,
  outputTokens = 0,
  characters = 0,
  emails = 0,
  calls = 1,
  durationMs = 0,
  success = true,
  error = null,
}) {
  const timestamp = new Date().toISOString();
  const dateKey = timestamp.split('T')[0];

  // Calculate cost
  let cost = 0;
  if (api === 'claude' && model) {
    const pricing = API_PRICING[model] || API_PRICING['claude-sonnet-4-5-20250929'];
    cost = (inputTokens / 1000) * pricing.inputPer1kTokens
         + (outputTokens / 1000) * pricing.outputPer1kTokens;
  } else if (api === 'deepl') {
    cost = characters * API_PRICING.deepl.perCharacter;
  } else if (api === 'mailerlite') {
    cost = emails * API_PRICING.mailerlite.perEmail;
  } else if (api === 'airtable') {
    cost = calls * API_PRICING.airtable.perApiCall;
  }

  const entry = {
    timestamp,
    api,
    model,
    agent,
    action,
    inputTokens,
    outputTokens,
    characters,
    emails,
    calls,
    durationMs,
    cost: Math.round(cost * 1000000) / 1000000, // 6 decimal places
    success,
    error: error ? String(error) : null,
  };

  usageBuffer.push(entry);

  // Update daily aggregates
  const dailyKey = `${dateKey}:${api}:${agent}`;
  const existing = dailyUsage.get(dailyKey) || {
    date: dateKey,
    api,
    agent,
    totalCalls: 0,
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCharacters: 0,
    totalEmails: 0,
    successCount: 0,
    failureCount: 0,
    totalDurationMs: 0,
  };

  existing.totalCalls += calls;
  existing.totalCost += cost;
  existing.totalInputTokens += inputTokens;
  existing.totalOutputTokens += outputTokens;
  existing.totalCharacters += characters;
  existing.totalEmails += emails;
  existing.totalDurationMs += durationMs;
  if (success) existing.successCount++; else existing.failureCount++;

  dailyUsage.set(dailyKey, existing);

  log.info(`API call tracked: ${api}/${model || 'default'} by ${agent} - cost: $${cost.toFixed(6)}`);
  return entry;
}

/**
 * Update rate limit info for an API
 */
function updateRateLimit(api, { remaining, limit, resetsAt }) {
  rateLimits.set(api, {
    remaining,
    limit,
    resetsAt,
    updatedAt: new Date().toISOString(),
    usagePercent: limit > 0 ? ((limit - remaining) / limit) * 100 : 0,
  });

  if (remaining < limit * 0.1) {
    log.warn(`Rate limit warning: ${api} at ${((limit - remaining) / limit * 100).toFixed(1)}% usage (${remaining} remaining)`);
  }

  return rateLimits.get(api);
}

/**
 * Get rate limit info for an API
 */
function getRateLimit(api) {
  return rateLimits.get(api) || null;
}

/**
 * Check if API is near rate limit
 */
function isNearRateLimit(api, thresholdPercent = 80) {
  const info = rateLimits.get(api);
  if (!info) return false;
  return info.usagePercent >= thresholdPercent;
}

/**
 * Get daily usage summary
 */
function getDailyUsage(date = null) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const results = [];

  for (const [key, value] of dailyUsage.entries()) {
    if (value.date === targetDate) {
      results.push({ ...value });
    }
  }

  return results;
}

/**
 * Get usage by agent
 */
function getUsageByAgent(agent, days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = cutoffDate.toISOString().split('T')[0];

  const results = [];
  for (const [key, value] of dailyUsage.entries()) {
    if (value.agent === agent && value.date >= cutoff) {
      results.push({ ...value });
    }
  }

  return results;
}

/**
 * Get usage by API
 */
function getUsageByApi(api, days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = cutoffDate.toISOString().split('T')[0];

  const results = [];
  for (const [key, value] of dailyUsage.entries()) {
    if (value.api === api && value.date >= cutoff) {
      results.push({ ...value });
    }
  }

  return results;
}

/**
 * Get total cost for a period
 */
function getTotalCost(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = cutoffDate.toISOString().split('T')[0];

  let totalCost = 0;
  const breakdown = {};

  for (const [key, value] of dailyUsage.entries()) {
    if (value.date >= cutoff) {
      totalCost += value.totalCost;
      if (!breakdown[value.api]) breakdown[value.api] = 0;
      breakdown[value.api] += value.totalCost;
    }
  }

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    breakdown: Object.fromEntries(
      Object.entries(breakdown).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    days,
    periodStart: cutoff,
    periodEnd: new Date().toISOString().split('T')[0],
  };
}

/**
 * Predict next month's costs based on growth trend
 */
function predictMonthlyCost() {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

  let currentCost = 0;
  let lastCost = 0;
  let currentDays = 0;

  for (const [key, value] of dailyUsage.entries()) {
    if (value.date.startsWith(currentMonth)) {
      currentCost += value.totalCost;
      currentDays = Math.max(currentDays, parseInt(value.date.split('-')[2]));
    } else if (value.date.startsWith(lastMonth)) {
      lastCost += value.totalCost;
    }
  }

  // Extrapolate current month
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedCurrent = currentDays > 0 ? (currentCost / currentDays) * daysInMonth : 0;

  // Growth rate
  const growthRate = lastCost > 0 ? (projectedCurrent - lastCost) / lastCost : 0;

  // Next month prediction
  const predictedNext = projectedCurrent * (1 + growthRate);

  return {
    lastMonth: { month: lastMonth, cost: Math.round(lastCost * 100) / 100 },
    currentMonth: {
      month: currentMonth,
      actualCost: Math.round(currentCost * 100) / 100,
      projectedCost: Math.round(projectedCurrent * 100) / 100,
      daysElapsed: currentDays,
      daysTotal: daysInMonth,
    },
    nextMonth: {
      predictedCost: Math.round(predictedNext * 100) / 100,
      growthRate: Math.round(growthRate * 10000) / 100,
    },
  };
}

/**
 * Flush usage buffer to Airtable
 */
async function flushToAirtable() {
  if (usageBuffer.length === 0) return 0;

  const batch = usageBuffer.splice(0, 50);
  let flushed = 0;

  for (const entry of batch) {
    try {
      await createRecord('APIUsage', {
        Timestamp: entry.timestamp,
        API: entry.api,
        Model: entry.model || '',
        Agent: entry.agent,
        Action: entry.action,
        InputTokens: entry.inputTokens,
        OutputTokens: entry.outputTokens,
        Characters: entry.characters,
        Cost: entry.cost,
        Success: entry.success,
        DurationMs: entry.durationMs,
        Error: entry.error || '',
      });
      flushed++;
    } catch (err) {
      log.error(`Failed to flush usage entry to Airtable: ${err.message}`);
      usageBuffer.unshift(entry); // Put back
      break;
    }
  }

  log.info(`Flushed ${flushed} usage entries to Airtable`);
  return flushed;
}

/**
 * Get comprehensive usage stats
 */
function getStats() {
  const allEntries = Array.from(dailyUsage.values());
  const totalCost = allEntries.reduce((sum, e) => sum + e.totalCost, 0);
  const totalCalls = allEntries.reduce((sum, e) => sum + e.totalCalls, 0);

  const byApi = {};
  const byAgent = {};
  allEntries.forEach(e => {
    if (!byApi[e.api]) byApi[e.api] = { calls: 0, cost: 0 };
    byApi[e.api].calls += e.totalCalls;
    byApi[e.api].cost += e.totalCost;

    if (!byAgent[e.agent]) byAgent[e.agent] = { calls: 0, cost: 0 };
    byAgent[e.agent].calls += e.totalCalls;
    byAgent[e.agent].cost += e.totalCost;
  });

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalCalls,
    bufferSize: usageBuffer.length,
    dailyEntriesTracked: dailyUsage.size,
    rateLimits: Object.fromEntries(rateLimits),
    byApi,
    byAgent,
  };
}

/**
 * Reset daily counters (call at midnight)
 */
function resetDaily() {
  // Keep last 90 days, remove older
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  let removed = 0;
  for (const [key, value] of dailyUsage.entries()) {
    if (value.date < cutoffStr) {
      dailyUsage.delete(key);
      removed++;
    }
  }

  if (removed > 0) {
    log.info(`Reset: removed ${removed} daily entries older than 90 days`);
  }
}

module.exports = {
  API_PRICING,
  trackApiCall,
  updateRateLimit,
  getRateLimit,
  isNearRateLimit,
  getDailyUsage,
  getUsageByAgent,
  getUsageByApi,
  getTotalCost,
  predictMonthlyCost,
  flushToAirtable,
  getStats,
  resetDaily,
};
