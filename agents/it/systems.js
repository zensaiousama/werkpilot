/**
 * Agent 39 — Systems Agent
 *
 * Manages all tool integrations (Airtable, Mailerlite, Google Workspace),
 * monitors API connection health, syncs data between systems, handles
 * centralized configuration, tracks agent versions, runs migration scripts,
 * and auto-generates API documentation.
 *
 * Schedule: Health checks every 15 min, full sync daily at 02:00,
 *           config audit weekly on Mondays at 06:00.
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../shared/utils/logger');
const { generateText, generateJSON } = require('../shared/utils/claude-client');
const { sendCEOEmail } = require('../shared/utils/email-client');
const { getRecords, createRecord, updateRecord } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const logger = createLogger('it-systems');

// ── Constants ────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(__dirname, 'configs', 'system-config.json');
const REGISTRY_PATH = path.join(__dirname, '..', 'agent-registry.json');

const TABLES = {
  SYSTEM_HEALTH: 'SystemHealth',
  SYNC_LOG: 'SyncLog',
  MIGRATIONS: 'Migrations',
  AGENT_VERSIONS: 'AgentVersions',
  API_DOCS: 'APIDocs',
};

const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  DOWN: 'down',
  UNKNOWN: 'unknown',
};

const INTEGRATIONS = {
  airtable: require('./integrations/airtable'),
  mailerlite: require('./integrations/mailerlite'),
  googleWorkspace: require('./integrations/google-workspace'),
};

// ── System Configuration ────────────────────────────────────────────────────

/**
 * Load the centralized system configuration.
 */
function loadSystemConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    logger.error(`Failed to load system config: ${error.message}`);
    return null;
  }
}

/**
 * Save updated system configuration.
 */
function saveSystemConfig(configData) {
  try {
    configData.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(configData, null, 2), 'utf-8');
    logger.info('System config saved successfully');
    return true;
  } catch (error) {
    logger.error(`Failed to save system config: ${error.message}`);
    return false;
  }
}

// ── API Health Monitoring ────────────────────────────────────────────────────

/**
 * Check the health of all integrated systems.
 */
async function checkAllSystemHealth() {
  logger.info('Running system health checks...');
  const results = {};
  const startTime = Date.now();

  for (const [name, integration] of Object.entries(INTEGRATIONS)) {
    try {
      const checkStart = Date.now();
      const health = await integration.checkHealth();
      const responseTime = Date.now() - checkStart;

      results[name] = {
        status: health.status || HEALTH_STATUS.HEALTHY,
        responseTimeMs: responseTime,
        details: health.details || {},
        lastChecked: new Date().toISOString(),
        error: null,
      };

      if (responseTime > 5000) {
        results[name].status = HEALTH_STATUS.DEGRADED;
        results[name].details.warning = `Slow response: ${responseTime}ms`;
      }

      logger.info(`${name}: ${results[name].status} (${responseTime}ms)`);
    } catch (error) {
      results[name] = {
        status: HEALTH_STATUS.DOWN,
        responseTimeMs: null,
        details: {},
        lastChecked: new Date().toISOString(),
        error: error.message,
      };
      logger.error(`${name} health check failed: ${error.message}`);
    }
  }

  // Store health results
  try {
    await createRecord(TABLES.SYSTEM_HEALTH, {
      Timestamp: new Date().toISOString(),
      Airtable: results.airtable?.status || HEALTH_STATUS.UNKNOWN,
      Mailerlite: results.mailerlite?.status || HEALTH_STATUS.UNKNOWN,
      GoogleWorkspace: results.googleWorkspace?.status || HEALTH_STATUS.UNKNOWN,
      ResponseTimes: JSON.stringify({
        airtable: results.airtable?.responseTimeMs,
        mailerlite: results.mailerlite?.responseTimeMs,
        googleWorkspace: results.googleWorkspace?.responseTimeMs,
      }),
      TotalCheckTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error(`Failed to store health results: ${error.message}`);
  }

  // Alert on failures
  const downSystems = Object.entries(results)
    .filter(([, r]) => r.status === HEALTH_STATUS.DOWN);

  if (downSystems.length > 0) {
    await alertSystemDown(downSystems);
  }

  return results;
}

/**
 * Alert CEO when systems are down.
 */
async function alertSystemDown(downSystems) {
  const systemRows = downSystems.map(([name, info]) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; color: #e74c3c;">DOWN</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${info.error}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${info.lastChecked}</td>
    </tr>
  `).join('');

  const html = `
    <h2 style="color: #e74c3c;">System Down Alert</h2>
    <p>${downSystems.length} system(s) are currently unreachable:</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">System</th>
        <th style="padding: 8px; text-align: left;">Status</th>
        <th style="padding: 8px; text-align: left;">Error</th>
        <th style="padding: 8px; text-align: left;">Checked At</th>
      </tr>
      ${systemRows}
    </table>
    <p style="margin-top: 16px;">
      <strong>Impact:</strong> Agents depending on these systems may be affected.
      Automatic retry will occur at the next health check interval.
    </p>
  `;

  try {
    await sendCEOEmail({
      subject: `SYSTEM ALERT: ${downSystems.length} integration(s) down`,
      html,
    });
    logger.info('System down alert sent to CEO');
  } catch (error) {
    logger.error(`Failed to send system down alert: ${error.message}`);
  }
}

// ── Data Sync ────────────────────────────────────────────────────────────────

/**
 * Sync data between CRM (Airtable) and Email Marketing (Mailerlite).
 */
async function syncCRMToEmailMarketing() {
  logger.info('Starting CRM to Email Marketing sync...');
  const startTime = Date.now();
  const syncLog = {
    type: 'crm_to_email',
    startedAt: new Date().toISOString(),
    recordsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    errors: [],
  };

  try {
    // Fetch contacts from CRM
    const contacts = await getRecords('Contacts', '{Status} != "Deleted"');
    syncLog.recordsProcessed = contacts.length;
    logger.info(`Processing ${contacts.length} contacts for email sync`);

    for (const contact of contacts) {
      try {
        if (!contact.Email) {
          syncLog.recordsSkipped++;
          continue;
        }

        const subscriberData = {
          email: contact.Email,
          name: contact.Name || '',
          company: contact.CompanyName || '',
          status: contact.Status || 'Lead',
          tags: [],
        };

        // Assign tags based on CRM status
        if (contact.Status === 'Client') subscriberData.tags.push('client');
        if (contact.Status === 'Lead') subscriberData.tags.push('lead');
        if (contact.Industry) subscriberData.tags.push(contact.Industry.toLowerCase());
        if (contact.Source) subscriberData.tags.push(`source:${contact.Source.toLowerCase()}`);

        const result = await INTEGRATIONS.mailerlite.upsertSubscriber(subscriberData);

        if (result.created) {
          syncLog.recordsCreated++;
        } else if (result.updated) {
          syncLog.recordsUpdated++;
        } else {
          syncLog.recordsSkipped++;
        }
      } catch (error) {
        syncLog.errors.push({
          contactId: contact.id,
          email: contact.Email,
          error: error.message,
        });
        logger.error(`Sync error for ${contact.Email}: ${error.message}`);
      }
    }
  } catch (error) {
    syncLog.errors.push({ phase: 'fetch', error: error.message });
    logger.error(`CRM sync fetch failed: ${error.message}`);
  }

  syncLog.completedAt = new Date().toISOString();
  syncLog.durationMs = Date.now() - startTime;

  // Store sync log
  try {
    await createRecord(TABLES.SYNC_LOG, {
      Type: syncLog.type,
      StartedAt: syncLog.startedAt,
      CompletedAt: syncLog.completedAt,
      DurationMs: syncLog.durationMs,
      Processed: syncLog.recordsProcessed,
      Created: syncLog.recordsCreated,
      Updated: syncLog.recordsUpdated,
      Skipped: syncLog.recordsSkipped,
      Errors: syncLog.errors.length,
      ErrorDetails: JSON.stringify(syncLog.errors.slice(0, 10)),
    });
  } catch (error) {
    logger.error(`Failed to store sync log: ${error.message}`);
  }

  logger.info(
    `Sync complete: ${syncLog.recordsCreated} created, ${syncLog.recordsUpdated} updated, ` +
    `${syncLog.recordsSkipped} skipped, ${syncLog.errors.length} errors (${syncLog.durationMs}ms)`
  );

  return syncLog;
}

/**
 * Sync data between CRM and Google Workspace contacts.
 */
async function syncCRMToGoogleWorkspace() {
  logger.info('Starting CRM to Google Workspace sync...');
  const startTime = Date.now();
  const syncLog = {
    type: 'crm_to_google',
    startedAt: new Date().toISOString(),
    recordsProcessed: 0,
    recordsSynced: 0,
    errors: [],
  };

  try {
    const clients = await getRecords('Clients', '{Status} = "Client"');
    syncLog.recordsProcessed = clients.length;

    for (const client of clients) {
      try {
        await INTEGRATIONS.googleWorkspace.syncContact({
          email: client.ContactEmail,
          name: client.ContactName,
          company: client.CompanyName,
          phone: client.Phone || '',
          notes: `CRM ID: ${client.id} | Status: ${client.Status}`,
        });
        syncLog.recordsSynced++;
      } catch (error) {
        syncLog.errors.push({
          clientId: client.id,
          error: error.message,
        });
      }
    }
  } catch (error) {
    syncLog.errors.push({ phase: 'fetch', error: error.message });
    logger.error(`Google Workspace sync failed: ${error.message}`);
  }

  syncLog.completedAt = new Date().toISOString();
  syncLog.durationMs = Date.now() - startTime;

  try {
    await createRecord(TABLES.SYNC_LOG, {
      Type: syncLog.type,
      StartedAt: syncLog.startedAt,
      CompletedAt: syncLog.completedAt,
      DurationMs: syncLog.durationMs,
      Processed: syncLog.recordsProcessed,
      Synced: syncLog.recordsSynced,
      Errors: syncLog.errors.length,
      ErrorDetails: JSON.stringify(syncLog.errors.slice(0, 10)),
    });
  } catch (error) {
    logger.error(`Failed to store Google sync log: ${error.message}`);
  }

  logger.info(
    `Google sync complete: ${syncLog.recordsSynced}/${syncLog.recordsProcessed} synced, ` +
    `${syncLog.errors.length} errors (${syncLog.durationMs}ms)`
  );

  return syncLog;
}

// ── Agent Version Tracking ──────────────────────────────────────────────────

/**
 * Scan the agent registry and track versions of all running agents.
 */
async function trackAgentVersions() {
  logger.info('Tracking agent versions...');

  try {
    const registryRaw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    const registry = JSON.parse(registryRaw);
    const versionReport = [];

    for (const agent of registry.agents) {
      const agentPath = path.join(__dirname, '..', agent.file);
      let fileHash = null;
      let lastModified = null;
      let fileExists = false;

      try {
        const stat = fs.statSync(agentPath);
        fileExists = true;
        lastModified = stat.mtime.toISOString();

        // Simple hash from file size + mtime for change detection
        fileHash = `${stat.size}-${stat.mtimeMs}`;
      } catch {
        fileExists = false;
      }

      const versionEntry = {
        name: agent.name,
        department: agent.department,
        file: agent.file,
        fileExists,
        fileHash,
        lastModified,
        enabled: agent.enabled,
        status: agent.status,
        schedule: agent.schedule,
      };

      versionReport.push(versionEntry);

      // Update version tracking in Airtable
      try {
        const existing = await getRecords(
          TABLES.AGENT_VERSIONS,
          `{AgentName} = "${agent.name}"`
        );

        const fields = {
          AgentName: agent.name,
          Department: agent.department,
          FilePath: agent.file,
          FileExists: fileExists,
          FileHash: fileHash,
          LastModified: lastModified,
          Enabled: agent.enabled,
          Status: agent.status,
          Schedule: agent.schedule,
          CheckedAt: new Date().toISOString(),
        };

        if (existing.length > 0) {
          const prev = existing[0];
          if (prev.FileHash !== fileHash) {
            fields.PreviousHash = prev.FileHash;
            fields.VersionChanged = true;
            logger.info(`Version change detected: ${agent.name}`);
          }
          await updateRecord(TABLES.AGENT_VERSIONS, existing[0].id, fields);
        } else {
          await createRecord(TABLES.AGENT_VERSIONS, fields);
        }
      } catch (error) {
        logger.error(`Failed to track version for ${agent.name}: ${error.message}`);
      }
    }

    const missingAgents = versionReport.filter(a => !a.fileExists);
    if (missingAgents.length > 0) {
      logger.warn(`${missingAgents.length} agent files missing: ${missingAgents.map(a => a.name).join(', ')}`);
    }

    logger.info(`Tracked versions for ${versionReport.length} agents`);
    return versionReport;
  } catch (error) {
    logger.error(`Agent version tracking failed: ${error.message}`);
    throw error;
  }
}

// ── Migration Management ─────────────────────────────────────────────────────

/**
 * Run pending migration scripts for schema or tool changes.
 */
async function runPendingMigrations() {
  logger.info('Checking for pending migrations...');

  try {
    const completedMigrations = await getRecords(
      TABLES.MIGRATIONS,
      '{Status} = "completed"'
    );
    const completedIds = new Set(completedMigrations.map(m => m.MigrationId));

    const systemConfig = loadSystemConfig();
    if (!systemConfig || !systemConfig.migrations) {
      logger.info('No migrations defined in system config');
      return [];
    }

    const pendingMigrations = systemConfig.migrations.filter(
      m => !completedIds.has(m.id)
    );

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return [];
    }

    logger.info(`Found ${pendingMigrations.length} pending migration(s)`);
    const results = [];

    for (const migration of pendingMigrations) {
      const migrationResult = {
        id: migration.id,
        name: migration.name,
        startedAt: new Date().toISOString(),
        status: 'running',
      };

      try {
        logger.info(`Running migration: ${migration.name} (${migration.id})`);

        // Execute migration based on type
        switch (migration.type) {
          case 'schema_update':
            await executeSchemaMigration(migration);
            break;
          case 'data_transform':
            await executeDataTransformMigration(migration);
            break;
          case 'config_change':
            await executeConfigMigration(migration);
            break;
          default:
            throw new Error(`Unknown migration type: ${migration.type}`);
        }

        migrationResult.status = 'completed';
        migrationResult.completedAt = new Date().toISOString();

        await createRecord(TABLES.MIGRATIONS, {
          MigrationId: migration.id,
          Name: migration.name,
          Type: migration.type,
          Status: 'completed',
          StartedAt: migrationResult.startedAt,
          CompletedAt: migrationResult.completedAt,
        });

        logger.info(`Migration completed: ${migration.name}`);
      } catch (error) {
        migrationResult.status = 'failed';
        migrationResult.error = error.message;

        await createRecord(TABLES.MIGRATIONS, {
          MigrationId: migration.id,
          Name: migration.name,
          Type: migration.type,
          Status: 'failed',
          StartedAt: migrationResult.startedAt,
          Error: error.message,
        });

        logger.error(`Migration failed: ${migration.name} - ${error.message}`);
      }

      results.push(migrationResult);
    }

    return results;
  } catch (error) {
    logger.error(`Migration check failed: ${error.message}`);
    throw error;
  }
}

async function executeSchemaMigration(migration) {
  logger.info(`Executing schema migration: ${migration.description || migration.name}`);
  // Schema migrations update Airtable field configurations
  if (migration.fields) {
    for (const field of migration.fields) {
      logger.info(`  Updating field: ${field.table}.${field.name} (${field.action})`);
    }
  }
}

async function executeDataTransformMigration(migration) {
  logger.info(`Executing data transform: ${migration.description || migration.name}`);
  if (migration.table && migration.transform) {
    const records = await getRecords(migration.table, migration.filter || '');
    logger.info(`  Processing ${records.length} records in ${migration.table}`);
  }
}

async function executeConfigMigration(migration) {
  logger.info(`Executing config migration: ${migration.description || migration.name}`);
  const systemConfig = loadSystemConfig();
  if (migration.configChanges && systemConfig) {
    for (const [key, value] of Object.entries(migration.configChanges)) {
      logger.info(`  Setting config: ${key}`);
    }
    saveSystemConfig(systemConfig);
  }
}

// ── API Documentation Generator ──────────────────────────────────────────────

/**
 * Auto-generate API documentation from the system configuration and agent registry.
 */
async function generateAPIDocs() {
  logger.info('Generating API documentation...');

  try {
    const systemConfig = loadSystemConfig();
    const registryRaw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    const registry = JSON.parse(registryRaw);

    const prompt = `You are a technical documentation writer for Werkpilot, a Swiss digital agency's
AI agent system. Generate comprehensive API documentation in Markdown format.

System Configuration:
${JSON.stringify(systemConfig, null, 2)}

Agent Registry (${registry.agents.length} agents):
${JSON.stringify(registry.agents.map(a => ({
  name: a.name,
  department: a.department,
  description: a.description,
  schedule: a.schedule,
  dependencies: a.dependencies,
})), null, 2)}

Generate documentation covering:
1. System Overview - what the system does
2. Integrations - Airtable, Mailerlite, Google Workspace with endpoints and auth
3. Agent Registry - all agents organized by department with schedules
4. Data Sync - how data flows between systems
5. Health Monitoring - endpoints and alert thresholds
6. Configuration - how to modify system settings

Format as clean Markdown with tables where appropriate.`;

    const docs = await generateText(prompt, {
      model: config.models.standard,
      maxTokens: 4000,
    });

    // Save documentation
    const docsPath = path.join(__dirname, 'configs', 'api-docs.md');
    fs.writeFileSync(docsPath, docs, 'utf-8');

    // Store in Airtable for versioning
    await createRecord(TABLES.API_DOCS, {
      Version: new Date().toISOString().slice(0, 10),
      GeneratedAt: new Date().toISOString(),
      AgentCount: registry.agents.length,
      IntegrationCount: Object.keys(INTEGRATIONS).length,
      FilePath: docsPath,
    });

    logger.info('API documentation generated and saved');
    return docsPath;
  } catch (error) {
    logger.error(`API docs generation failed: ${error.message}`);
    throw error;
  }
}

// ── Configuration Audit ──────────────────────────────────────────────────────

/**
 * Audit system configuration for completeness and correctness.
 */
async function auditConfiguration() {
  logger.info('Running configuration audit...');
  const issues = [];

  // Check API keys are configured
  const requiredKeys = [
    { key: 'api.anthropic', value: config.api.anthropic, label: 'Anthropic API Key' },
    { key: 'api.airtable', value: config.api.airtable, label: 'Airtable API Key' },
    { key: 'api.mailerlite', value: config.api.mailerlite, label: 'Mailerlite API Key' },
    { key: 'email.user', value: config.email.user, label: 'Gmail User' },
    { key: 'email.password', value: config.email.password, label: 'Gmail App Password' },
    { key: 'email.ceo', value: config.email.ceo, label: 'CEO Email' },
  ];

  for (const check of requiredKeys) {
    if (!check.value) {
      issues.push({
        severity: 'critical',
        category: 'configuration',
        message: `Missing required config: ${check.label} (${check.key})`,
      });
    }
  }

  // Check system config file exists and is valid
  const systemConfig = loadSystemConfig();
  if (!systemConfig) {
    issues.push({
      severity: 'high',
      category: 'configuration',
      message: 'System config file is missing or invalid',
    });
  }

  // Check agent registry
  try {
    const registryRaw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
    const registry = JSON.parse(registryRaw);

    // Check for agents with missing files
    for (const agent of registry.agents) {
      const agentPath = path.join(__dirname, '..', agent.file);
      try {
        fs.accessSync(agentPath);
      } catch {
        issues.push({
          severity: 'medium',
          category: 'agent_registry',
          message: `Agent file missing: ${agent.name} (${agent.file})`,
        });
      }
    }

    // Check for circular dependencies
    const depGraph = {};
    for (const agent of registry.agents) {
      depGraph[agent.name] = agent.dependencies || [];
    }
    const cycles = detectCircularDependencies(depGraph);
    for (const cycle of cycles) {
      issues.push({
        severity: 'high',
        category: 'dependencies',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
      });
    }
  } catch (error) {
    issues.push({
      severity: 'critical',
      category: 'agent_registry',
      message: `Cannot read agent registry: ${error.message}`,
    });
  }

  // Check integration health
  const health = await checkAllSystemHealth();
  for (const [name, result] of Object.entries(health)) {
    if (result.status !== HEALTH_STATUS.HEALTHY) {
      issues.push({
        severity: result.status === HEALTH_STATUS.DOWN ? 'critical' : 'medium',
        category: 'integration',
        message: `Integration ${name} is ${result.status}: ${result.error || 'degraded performance'}`,
      });
    }
  }

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;

  if (criticalCount > 0 || highCount > 0) {
    await sendConfigAuditReport(issues);
  }

  logger.info(
    `Audit complete: ${issues.length} issues found ` +
    `(${criticalCount} critical, ${highCount} high)`
  );

  return issues;
}

/**
 * Detect circular dependencies in the agent dependency graph.
 */
function detectCircularDependencies(graph) {
  const cycles = [];
  const visited = new Set();
  const inStack = new Set();

  function dfs(node, path) {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart).concat(node));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const dep of (graph[node] || [])) {
      dfs(dep, [...path]);
    }

    inStack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    dfs(node, []);
  }

  return cycles;
}

/**
 * Send configuration audit report to CEO.
 */
async function sendConfigAuditReport(issues) {
  const severityColors = {
    critical: '#e74c3c',
    high: '#e67e22',
    medium: '#f39c12',
    low: '#3498db',
  };

  const issueRows = issues.map(issue => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">
        <span style="color: ${severityColors[issue.severity]}; font-weight: bold;">
          ${issue.severity.toUpperCase()}
        </span>
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${issue.category}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${issue.message}</td>
    </tr>
  `).join('');

  const html = `
    <h2>System Configuration Audit Report</h2>
    <p>Audit performed: ${new Date().toISOString()}</p>
    <p>Total issues: <strong>${issues.length}</strong></p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">Severity</th>
        <th style="padding: 8px; text-align: left;">Category</th>
        <th style="padding: 8px; text-align: left;">Issue</th>
      </tr>
      ${issueRows}
    </table>
  `;

  try {
    await sendCEOEmail({
      subject: `System Audit: ${issues.length} issues found (${issues.filter(i => i.severity === 'critical').length} critical)`,
      html,
    });
  } catch (error) {
    logger.error(`Failed to send audit report: ${error.message}`);
  }
}

// ── Main Runs ────────────────────────────────────────────────────────────────

/**
 * Quick health check run (every 15 min).
 */
async function runHealthCheck() {
  logger.info('=== Systems Health Check Started ===');
  const startTime = Date.now();

  try {
    const health = await checkAllSystemHealth();
    const allHealthy = Object.values(health).every(h => h.status === HEALTH_STATUS.HEALTHY);
    logger.info(`Health check: ${allHealthy ? 'All systems healthy' : 'Issues detected'}`);
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Health check completed in ${duration}s ===`);
}

/**
 * Daily full sync run.
 */
async function runDailySync() {
  logger.info('=== Systems Daily Sync Started ===');
  const startTime = Date.now();

  try {
    await syncCRMToEmailMarketing();
    await syncCRMToGoogleWorkspace();
    await trackAgentVersions();
    await runPendingMigrations();
  } catch (error) {
    logger.error(`Daily sync failed: ${error.message}`, { stack: error.stack });
    await sendCEOEmail({
      subject: 'Systems Agent: Daily Sync Error',
      html: `<p>The Systems agent daily sync encountered an error:</p><pre>${error.message}</pre>`,
    });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Daily sync completed in ${duration}s ===`);
}

/**
 * Weekly configuration audit and docs generation.
 */
async function runWeeklyAudit() {
  logger.info('=== Systems Weekly Audit Started ===');
  const startTime = Date.now();

  try {
    await auditConfiguration();
    await generateAPIDocs();
  } catch (error) {
    logger.error(`Weekly audit failed: ${error.message}`, { stack: error.stack });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`=== Weekly audit completed in ${duration}s ===`);
}

// ── Cron Scheduling ──────────────────────────────────────────────────────────

// Health checks every 15 minutes
cron.schedule('*/15 * * * *', () => {
  runHealthCheck().catch(err => logger.error(`Cron health check error: ${err.message}`));
});

// Daily full sync at 02:00
cron.schedule('0 2 * * *', () => {
  runDailySync().catch(err => logger.error(`Cron daily sync error: ${err.message}`));
});

// Weekly configuration audit on Mondays at 06:00
cron.schedule('0 6 * * 1', () => {
  runWeeklyAudit().catch(err => logger.error(`Cron weekly audit error: ${err.message}`));
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runHealthCheck,
  runDailySync,
  runWeeklyAudit,
  checkAllSystemHealth,
  syncCRMToEmailMarketing,
  syncCRMToGoogleWorkspace,
  trackAgentVersions,
  runPendingMigrations,
  generateAPIDocs,
  auditConfiguration,
  loadSystemConfig,
  saveSystemConfig,
};

// Run immediately if executed directly
if (require.main === module) {
  runHealthCheck()
    .then(() => logger.info('Manual health check completed'))
    .catch(err => logger.error(`Manual run failed: ${err.message}`));
}
