/**
 * Dashboard Sync Utility
 * Provides methods for agents to sync data to the dashboard database
 */

const dashboardClient = require('./dashboard-client');

class DashboardSync {
  /**
   * Sync agent status to dashboard
   * @param {string} agentName - Name of the agent
   * @param {string} status - Current status (active, idle, error, disabled)
   * @param {number} score - Performance score (0-100)
   * @param {number} tasksToday - Number of tasks completed today
   * @param {number} errorsToday - Number of errors today
   */
  async syncAgentStatus(agentName, status, score = null, tasksToday = null, errorsToday = null) {
    try {
      const updates = {
        name: agentName,
        status,
        lastSeen: new Date().toISOString()
      };

      if (score !== null) updates.score = score;
      if (tasksToday !== null) updates.tasksToday = tasksToday;
      if (errorsToday !== null) updates.errorsToday = errorsToday;

      const result = await dashboardClient.post('/api/sync', {
        agents: [updates]
      });

      console.log(`[DashboardSync] Agent status synced: ${agentName} - ${status}`);
      return result;
    } catch (err) {
      console.error(`[DashboardSync] Failed to sync agent status for ${agentName}:`, err.message);
      throw err;
    }
  }

  /**
   * Log agent execution
   * @param {string} agentName - Name of the agent
   * @param {Date} startTime - Execution start time
   * @param {Date} endTime - Execution end time
   * @param {string} status - Execution status (success, error, timeout)
   * @param {string} errorMsg - Error message if status is error
   * @param {number} tokensUsed - Number of tokens consumed
   * @param {string} model - LLM model used
   */
  async logAgentExecution(agentName, startTime, endTime, status, errorMsg = null, tokensUsed = null, model = null) {
    try {
      const execution = {
        agentName,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMs: endTime - startTime,
        status,
        errorMsg,
        tokensUsed,
        model,
        timestamp: new Date().toISOString()
      };

      const result = await dashboardClient.post('/api/sync', {
        executions: [execution]
      });

      console.log(`[DashboardSync] Execution logged: ${agentName} - ${status} (${execution.durationMs}ms)`);
      return result;
    } catch (err) {
      console.error(`[DashboardSync] Failed to log execution for ${agentName}:`, err.message);
      throw err;
    }
  }

  /**
   * Sync lead update
   * @param {string} leadId - Lead identifier
   * @param {Object} updates - Lead fields to update
   */
  async syncLeadUpdate(leadId, updates) {
    try {
      const leadUpdate = {
        leadId,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const result = await dashboardClient.post('/api/sync', {
        leads: [leadUpdate]
      });

      console.log(`[DashboardSync] Lead updated: ${leadId}`);
      return result;
    } catch (err) {
      console.error(`[DashboardSync] Failed to sync lead update for ${leadId}:`, err.message);
      throw err;
    }
  }

  /**
   * Create a night shift task
   * @param {Object} task - Task object
   * @param {string} task.title - Task title
   * @param {string} task.description - Task description
   * @param {string} task.agentName - Agent responsible
   * @param {Object} task.metadata - Additional metadata
   * @param {string} priority - Priority level (low, medium, high, urgent)
   */
  async createNightShiftTask(task, priority = 'medium') {
    try {
      const nightShiftTask = {
        ...task,
        priority,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const result = await dashboardClient.post('/api/sync', {
        tasks: [nightShiftTask]
      });

      console.log(`[DashboardSync] Night shift task created: ${task.title}`);
      return result;
    } catch (err) {
      console.error(`[DashboardSync] Failed to create night shift task:`, err.message);
      throw err;
    }
  }

  /**
   * Update a night shift task
   * @param {string} taskId - Task identifier
   * @param {string} status - New status (pending, running, completed, failed)
   * @param {string} output - Task output/result
   * @param {number} durationMs - Execution duration in milliseconds
   * @param {number} tokensUsed - Tokens consumed
   */
  async updateNightShiftTask(taskId, status, output = null, durationMs = null, tokensUsed = null) {
    try {
      const taskUpdate = {
        taskId,
        status,
        output,
        durationMs,
        tokensUsed,
        updatedAt: new Date().toISOString()
      };

      if (status === 'completed' || status === 'failed') {
        taskUpdate.completedAt = new Date().toISOString();
      }

      const result = await dashboardClient.post('/api/sync', {
        tasks: [taskUpdate]
      });

      console.log(`[DashboardSync] Night shift task updated: ${taskId} - ${status}`);
      return result;
    } catch (err) {
      console.error(`[DashboardSync] Failed to update night shift task ${taskId}:`, err.message);
      throw err;
    }
  }

  /**
   * Send notification to dashboard
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {string} type - Notification type (info, success, warning, error)
   * @param {string} link - Optional link/action URL
   */
  async sendNotification(title, message, type = 'info', link = null) {
    try {
      const notification = {
        title,
        message,
        type,
        link,
        timestamp: new Date().toISOString(),
        read: false
      };

      const result = await dashboardClient.post('/api/sync', {
        notifications: [notification]
      });

      console.log(`[DashboardSync] Notification sent: ${title} (${type})`);
      return result;
    } catch (err) {
      console.error(`[DashboardSync] Failed to send notification:`, err.message);
      throw err;
    }
  }

  /**
   * Bulk sync multiple data types at once
   * @param {Object} data - Object containing arrays of agents, executions, leads, tasks, notifications
   */
  async bulkSync(data) {
    try {
      const payload = {
        agents: data.agents || [],
        executions: data.executions || [],
        leads: data.leads || [],
        tasks: data.tasks || [],
        notifications: data.notifications || []
      };

      const result = await dashboardClient.post('/api/sync', payload);

      console.log('[DashboardSync] Bulk sync completed:', result.synced);
      return result;
    } catch (err) {
      console.error('[DashboardSync] Bulk sync failed:', err.message);
      throw err;
    }
  }

  /**
   * Test connection to dashboard
   */
  async testConnection() {
    try {
      const isHealthy = await dashboardClient.healthCheck();
      if (isHealthy) {
        console.log('[DashboardSync] Dashboard connection OK');
        return true;
      } else {
        console.error('[DashboardSync] Dashboard health check failed');
        return false;
      }
    } catch (err) {
      console.error('[DashboardSync] Dashboard connection test failed:', err.message);
      return false;
    }
  }
}

// Singleton instance
const dashboardSync = new DashboardSync();

module.exports = dashboardSync;
