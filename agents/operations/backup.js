/**
 * Backup Manager - Automated Airtable data backup script
 * Agent 23 support module
 *
 * Backs up all Airtable tables to JSON files with rotation.
 * Supports daily, weekly, and monthly backup schedules.
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../shared/utils/logger');
const { getRecords } = require('../shared/utils/airtable-client');
const config = require('../shared/utils/config');

const log = createLogger('backup-manager');

const BACKUP_DIR = path.join(config.paths.root, 'backups');
const MAX_DAILY_BACKUPS = 7;
const MAX_WEEKLY_BACKUPS = 4;
const MAX_MONTHLY_BACKUPS = 12;

// Tables to back up
const TABLES = [
  'Clients',
  'Leads',
  'Projects',
  'Content',
  'Invoices',
  'APIUsage',
  'Complaints',
  'SLATracking',
  'Translations',
  'Tasks',
];

/**
 * Ensure backup directory exists
 */
function ensureBackupDir(subDir = '') {
  const dir = path.join(BACKUP_DIR, subDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.info(`Created backup directory: ${dir}`);
  }
  return dir;
}

/**
 * Back up a single Airtable table
 */
async function backupTable(tableName) {
  try {
    log.info(`Backing up table: ${tableName}`);
    const records = await getRecords(tableName, '', 10000);

    return {
      table: tableName,
      recordCount: records.length,
      data: records,
      backedUpAt: new Date().toISOString(),
    };
  } catch (err) {
    log.error(`Failed to backup table ${tableName}: ${err.message}`);
    return {
      table: tableName,
      recordCount: 0,
      data: [],
      error: err.message,
      backedUpAt: new Date().toISOString(),
    };
  }
}

/**
 * Run full backup of all tables
 */
async function runFullBackup(type = 'daily') {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = ensureBackupDir(type);
  const backupFile = path.join(backupDir, `backup-${timestamp}.json`);

  log.info(`Starting ${type} backup...`);

  const results = {
    type,
    timestamp: new Date().toISOString(),
    tables: {},
    totalRecords: 0,
    errors: [],
  };

  for (const tableName of TABLES) {
    const tableResult = await backupTable(tableName);
    results.tables[tableName] = {
      recordCount: tableResult.recordCount,
      error: tableResult.error || null,
    };
    results.totalRecords += tableResult.recordCount;

    if (tableResult.error) {
      results.errors.push({ table: tableName, error: tableResult.error });
    }
  }

  // Write backup file
  try {
    const backupData = {
      metadata: {
        type,
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        totalRecords: results.totalRecords,
        tableCount: TABLES.length,
      },
      tables: {},
    };

    for (const tableName of TABLES) {
      const tableResult = await backupTable(tableName);
      backupData.tables[tableName] = tableResult.data;
    }

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    const fileSizeBytes = fs.statSync(backupFile).size;
    const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(2);

    results.file = backupFile;
    results.fileSizeMB = parseFloat(fileSizeMB);
    results.durationMs = Date.now() - startTime;

    log.info(`${type} backup completed: ${results.totalRecords} records, ${fileSizeMB}MB, ${results.durationMs}ms`);
  } catch (err) {
    log.error(`Failed to write backup file: ${err.message}`);
    results.errors.push({ table: 'ALL', error: `Write failed: ${err.message}` });
  }

  // Rotate old backups
  await rotateBackups(type);

  return results;
}

/**
 * Rotate old backup files based on retention policy
 */
async function rotateBackups(type = 'daily') {
  const maxBackups = {
    daily: MAX_DAILY_BACKUPS,
    weekly: MAX_WEEKLY_BACKUPS,
    monthly: MAX_MONTHLY_BACKUPS,
  };

  const max = maxBackups[type] || MAX_DAILY_BACKUPS;
  const backupDir = path.join(BACKUP_DIR, type);

  if (!fs.existsSync(backupDir)) return;

  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length > max) {
      const toDelete = files.slice(max);
      for (const file of toDelete) {
        const filePath = path.join(backupDir, file);
        fs.unlinkSync(filePath);
        log.info(`Rotated old backup: ${file}`);
      }
      log.info(`Rotated ${toDelete.length} old ${type} backups`);
    }
  } catch (err) {
    log.error(`Failed to rotate backups: ${err.message}`);
  }
}

/**
 * Verify backup integrity
 */
function verifyBackup(backupFile) {
  try {
    if (!fs.existsSync(backupFile)) {
      return { valid: false, error: 'File not found' };
    }

    const content = fs.readFileSync(backupFile, 'utf8');
    const data = JSON.parse(content);

    if (!data.metadata || !data.tables) {
      return { valid: false, error: 'Invalid backup structure' };
    }

    const tableCount = Object.keys(data.tables).length;
    let totalRecords = 0;
    for (const [table, records] of Object.entries(data.tables)) {
      if (!Array.isArray(records)) {
        return { valid: false, error: `Table ${table} has invalid data` };
      }
      totalRecords += records.length;
    }

    return {
      valid: true,
      metadata: data.metadata,
      tableCount,
      totalRecords,
      fileSizeMB: (fs.statSync(backupFile).size / 1024 / 1024).toFixed(2),
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * List all available backups
 */
function listBackups() {
  const backups = {
    daily: [],
    weekly: [],
    monthly: [],
  };

  for (const type of ['daily', 'weekly', 'monthly']) {
    const dir = path.join(BACKUP_DIR, type);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    backups[type] = files.map(f => {
      const filePath = path.join(dir, f);
      const stats = fs.statSync(filePath);
      return {
        file: f,
        path: filePath,
        sizeMB: (stats.size / 1024 / 1024).toFixed(2),
        createdAt: stats.birthtime.toISOString(),
      };
    });
  }

  return backups;
}

/**
 * Get latest backup info
 */
function getLatestBackup(type = 'daily') {
  const dir = path.join(BACKUP_DIR, type);
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const filePath = path.join(dir, files[0]);
  const stats = fs.statSync(filePath);
  const verification = verifyBackup(filePath);

  return {
    file: files[0],
    path: filePath,
    sizeMB: (stats.size / 1024 / 1024).toFixed(2),
    createdAt: stats.birthtime.toISOString(),
    ageHours: ((Date.now() - stats.birthtime.getTime()) / 3600000).toFixed(1),
    verification,
  };
}

/**
 * Check backup health
 */
function checkBackupHealth() {
  const issues = [];
  const latestDaily = getLatestBackup('daily');

  if (!latestDaily) {
    issues.push({ severity: 'critical', message: 'No daily backups found' });
  } else if (parseFloat(latestDaily.ageHours) > 25) {
    issues.push({
      severity: 'high',
      message: `Latest daily backup is ${latestDaily.ageHours} hours old`,
    });
  }

  if (latestDaily && !latestDaily.verification.valid) {
    issues.push({
      severity: 'critical',
      message: `Latest daily backup is corrupted: ${latestDaily.verification.error}`,
    });
  }

  return {
    healthy: issues.length === 0,
    issues,
    latestDaily,
    latestWeekly: getLatestBackup('weekly'),
    latestMonthly: getLatestBackup('monthly'),
  };
}

// Export for use by infrastructure agent
module.exports = {
  TABLES,
  BACKUP_DIR,
  runFullBackup,
  rotateBackups,
  verifyBackup,
  listBackups,
  getLatestBackup,
  checkBackupHealth,
  backupTable,
};
