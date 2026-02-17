/**
 * Mailerlite Integration Module
 *
 * Provides health checking, subscriber management, and campaign utilities
 * for the Mailerlite email marketing platform.
 */

const { createLogger } = require('../../shared/utils/logger');
const config = require('../../shared/utils/config');

const logger = createLogger('integration-mailerlite');

const BASE_URL = 'https://connect.mailerlite.com/api';

// ── HTTP Helper ──────────────────────────────────────────────────────────────

/**
 * Make an authenticated request to the Mailerlite API.
 */
async function makeRequest(method, endpoint, body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${config.api.mailerlite}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'No response body');
    throw new Error(`Mailerlite API ${method} ${endpoint}: ${response.status} - ${errorBody}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

// ── Health Check ─────────────────────────────────────────────────────────────

/**
 * Check Mailerlite API connectivity and account status.
 */
async function checkHealth() {
  const result = {
    status: 'healthy',
    details: {
      hasApiKey: !!config.api.mailerlite,
    },
  };

  if (!config.api.mailerlite) {
    result.status = 'down';
    result.details.error = 'Missing Mailerlite API key';
    return result;
  }

  try {
    const accountData = await makeRequest('GET', '/subscribers?limit=1');
    result.details.connected = true;
    result.details.totalSubscribers = accountData?.meta?.total || 'unknown';
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('403')) {
      result.status = 'down';
      result.details.error = 'Authentication failed - check API key';
    } else if (error.message.includes('429')) {
      result.status = 'degraded';
      result.details.error = 'Rate limited';
      result.details.connected = true;
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
      result.status = 'down';
      result.details.error = 'Cannot reach Mailerlite API';
    } else {
      result.status = 'degraded';
      result.details.error = error.message;
    }
  }

  return result;
}

// ── Subscriber Management ────────────────────────────────────────────────────

/**
 * Create or update a subscriber in Mailerlite.
 * Returns { created: boolean, updated: boolean, subscriber: object }
 */
async function upsertSubscriber({ email, name, company, status, tags }) {
  if (!email) {
    throw new Error('Email is required for subscriber upsert');
  }

  try {
    // Try to find existing subscriber
    const existing = await findSubscriber(email);

    if (existing) {
      // Update existing subscriber
      const updateData = {
        fields: {
          name: name || existing.fields?.name || '',
          company: company || existing.fields?.company || '',
          crm_status: status || '',
        },
      };

      await makeRequest('PUT', `/subscribers/${existing.id}`, updateData);

      // Update tags
      if (tags && tags.length > 0) {
        await syncSubscriberTags(existing.id, tags);
      }

      logger.info(`Updated subscriber: ${email}`);
      return { created: false, updated: true, subscriber: existing };
    } else {
      // Create new subscriber
      const createData = {
        email,
        fields: {
          name: name || '',
          company: company || '',
          crm_status: status || '',
        },
        groups: [],
        status: 'active',
      };

      const newSubscriber = await makeRequest('POST', '/subscribers', createData);

      // Add tags
      if (tags && tags.length > 0 && newSubscriber?.data?.id) {
        await syncSubscriberTags(newSubscriber.data.id, tags);
      }

      logger.info(`Created subscriber: ${email}`);
      return { created: true, updated: false, subscriber: newSubscriber?.data };
    }
  } catch (error) {
    logger.error(`Failed to upsert subscriber ${email}: ${error.message}`);
    throw error;
  }
}

/**
 * Find a subscriber by email address.
 */
async function findSubscriber(email) {
  try {
    const result = await makeRequest('GET', `/subscribers/${encodeURIComponent(email)}`);
    return result?.data || null;
  } catch (error) {
    if (error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Sync tags for a subscriber (add missing, keep existing).
 */
async function syncSubscriberTags(subscriberId, tags) {
  try {
    for (const tag of tags) {
      await makeRequest('POST', `/subscribers/${subscriberId}/tags`, {
        tag: tag,
      });
    }
  } catch (error) {
    logger.warn(`Failed to sync tags for subscriber ${subscriberId}: ${error.message}`);
  }
}

/**
 * Remove a subscriber (unsubscribe).
 */
async function removeSubscriber(email) {
  try {
    const subscriber = await findSubscriber(email);
    if (subscriber) {
      await makeRequest('DELETE', `/subscribers/${subscriber.id}`);
      logger.info(`Removed subscriber: ${email}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Failed to remove subscriber ${email}: ${error.message}`);
    throw error;
  }
}

// ── Campaign Utilities ───────────────────────────────────────────────────────

/**
 * Get recent campaign statistics.
 */
async function getRecentCampaigns(limit = 10) {
  try {
    const result = await makeRequest('GET', `/campaigns?filter[status]=sent&limit=${limit}`);
    return (result?.data || []).map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      sentAt: campaign.sent_at,
      stats: {
        sent: campaign.stats?.sent || 0,
        opened: campaign.stats?.opened || 0,
        clicked: campaign.stats?.clicked || 0,
        unsubscribed: campaign.stats?.unsubscribed || 0,
        openRate: campaign.stats?.open_rate || 0,
        clickRate: campaign.stats?.click_rate || 0,
      },
    }));
  } catch (error) {
    logger.error(`Failed to fetch campaigns: ${error.message}`);
    throw error;
  }
}

/**
 * Get subscriber count by group/segment.
 */
async function getSubscriberGroups() {
  try {
    const result = await makeRequest('GET', '/groups?limit=100');
    return (result?.data || []).map(group => ({
      id: group.id,
      name: group.name,
      subscriberCount: group.active_count || 0,
      createdAt: group.created_at,
    }));
  } catch (error) {
    logger.error(`Failed to fetch subscriber groups: ${error.message}`);
    throw error;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  checkHealth,
  upsertSubscriber,
  findSubscriber,
  removeSubscriber,
  getRecentCampaigns,
  getSubscriberGroups,
};
