/**
 * Airtable Integration Module
 *
 * Provides health checking, connection management, and utility functions
 * for the Airtable integration used across all Werkpilot agents.
 */

const { createLogger } = require('../../shared/utils/logger');
const { getRecords } = require('../../shared/utils/airtable-client');
const config = require('../../shared/utils/config');

const logger = createLogger('integration-airtable');

// ── Health Check ─────────────────────────────────────────────────────────────

/**
 * Check Airtable API connectivity and response.
 */
async function checkHealth() {
  const result = {
    status: 'healthy',
    details: {
      hasApiKey: !!config.api.airtable,
      hasBaseId: !!config.api.airtableBase,
    },
  };

  if (!config.api.airtable || !config.api.airtableBase) {
    result.status = 'down';
    result.details.error = 'Missing API key or Base ID';
    return result;
  }

  try {
    // Attempt to read a small set of records as a connectivity test
    const testRecords = await getRecords('SystemHealth', '', { maxRecords: 1 });
    result.details.connected = true;
    result.details.testQuery = 'success';
  } catch (error) {
    // Distinguish between auth errors and connectivity errors
    if (error.message.includes('AUTHENTICATION') || error.message.includes('401')) {
      result.status = 'down';
      result.details.error = 'Authentication failed - check API key';
    } else if (error.message.includes('NOT_FOUND') || error.message.includes('404')) {
      result.status = 'degraded';
      result.details.error = 'Test table not found - base may need setup';
      result.details.connected = true;
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
      result.status = 'down';
      result.details.error = 'Cannot reach Airtable API';
    } else {
      result.status = 'degraded';
      result.details.error = error.message;
      result.details.connected = true;
    }
  }

  return result;
}

// ── Table Schema Info ────────────────────────────────────────────────────────

/**
 * Get metadata about known Airtable tables used in the system.
 */
function getTableSchema() {
  return {
    Contacts: {
      description: 'All contacts (leads, clients, partners)',
      fields: ['Name', 'Email', 'CompanyName', 'Status', 'Industry', 'Source', 'Phone'],
      usedBy: ['sales', 'marketing', 'it-systems'],
    },
    Clients: {
      description: 'Active client accounts',
      fields: ['CompanyName', 'ContactName', 'ContactEmail', 'Status', 'MRR', 'ContractEndDate', 'Industry', 'Services'],
      usedBy: ['sales', 'ceo', 'finance', 'it-systems'],
    },
    Leads: {
      description: 'Inbound leads and prospects',
      fields: ['Name', 'Email', 'Company', 'Source', 'Score', 'Status', 'AssignedTo'],
      usedBy: ['sales', 'marketing'],
    },
    Revenue: {
      description: 'Revenue tracking records',
      fields: ['ClientId', 'Amount', 'Type', 'Date', 'Category', 'Description'],
      usedBy: ['finance', 'ceo'],
    },
    SystemHealth: {
      description: 'System health check results',
      fields: ['Timestamp', 'Airtable', 'Mailerlite', 'GoogleWorkspace', 'ResponseTimes'],
      usedBy: ['it-systems'],
    },
    AgentMetrics: {
      description: 'Agent performance metrics',
      fields: ['AgentName', 'RunDate', 'Duration', 'Status', 'RecordsProcessed', 'Errors'],
      usedBy: ['it-data-analytics', 'it-ai-optimization'],
    },
  };
}

// ── Rate Limiting ────────────────────────────────────────────────────────────

const rateLimiter = {
  requests: [],
  maxPerSecond: 5,

  /**
   * Check if a request can be made within rate limits.
   */
  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < 1000);
    return this.requests.length < this.maxPerSecond;
  },

  /**
   * Wait until a request can be made, then record it.
   */
  async waitForSlot() {
    while (!this.canMakeRequest()) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    this.requests.push(Date.now());
  },
};

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  checkHealth,
  getTableSchema,
  rateLimiter,
};
