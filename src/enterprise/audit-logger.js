/**
 * Phase 11: Audit Logging System
 * Immutable, append-only logs for compliance and accountability
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const AUDIT_DIR = path.join(os.homedir(), '.odavl-guardian', 'audit');

// Ensure audit directory exists
function ensureAuditDir() {
  if (!fs.existsSync(AUDIT_DIR)) {
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
  }
}

/**
 * Get current audit log file path (monthly rotation)
 */
function getAuditLogPath() {
  ensureAuditDir();
  
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const filename = `audit-${year}-${month}.jsonl`;
  
  return path.join(AUDIT_DIR, filename);
}

/**
 * Write an audit log entry
 */
function logAudit(action, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    user: os.userInfo().username || 'unknown',
    action,
    details,
    hostname: os.hostname(),
  };
  
  const logPath = getAuditLogPath();
  const logLine = JSON.stringify(entry) + '\n';
  
  // Append-only write (immutable)
  fs.appendFileSync(logPath, logLine, 'utf-8');
  
  return entry;
}

/**
 * Read audit logs (optionally filtered)
 */
function readAuditLogs(options = {}) {
  ensureAuditDir();
  
  const {
    action = null,
    user = null,
    startDate = null,
    endDate = null,
    limit = 1000,
  } = options;
  
  const logs = [];
  const files = fs.readdirSync(AUDIT_DIR)
    .filter(f => f.startsWith('audit-') && f.endsWith('.jsonl'))
    .sort()
    .reverse(); // Most recent first
  
  for (const file of files) {
    const filePath = path.join(AUDIT_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        // Apply filters
        if (action && entry.action !== action) continue;
        if (user && entry.user !== user) continue;
        if (startDate && new Date(entry.timestamp) < new Date(startDate)) continue;
        if (endDate && new Date(entry.timestamp) > new Date(endDate)) continue;
        
        logs.push(entry);
        
        if (logs.length >= limit) {
          return logs;
        }
      } catch (_error) {
        // Skip invalid lines
        continue;
      }
    }
  }
  
  return logs;
}

/**
 * Get audit summary
 */
function getAuditSummary() {
  const logs = readAuditLogs({ limit: 10000 });
  
  const actionCounts = {};
  const userCounts = {};
  
  for (const log of logs) {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    userCounts[log.user] = (userCounts[log.user] || 0) + 1;
  }
  
  return {
    totalLogs: logs.length,
    actionCounts,
    userCounts,
    firstLog: logs[logs.length - 1]?.timestamp || null,
    lastLog: logs[0]?.timestamp || null,
  };
}

/**
 * Common audit actions (constants)
 */
const AUDIT_ACTIONS = {
  SCAN_RUN: 'scan:run',
  SCAN_VIEW: 'scan:view',
  LIVE_START: 'live:start',
  LIVE_STOP: 'live:stop',
  SITE_ADD: 'site:add',
  SITE_REMOVE: 'site:remove',
  PLAN_UPGRADE: 'plan:upgrade',
  USER_ADD: 'user:add',
  USER_REMOVE: 'user:remove',
  EXPORT_PDF: 'export:pdf',
  RECIPE_IMPORT: 'recipe:import',
  RECIPE_EXPORT: 'recipe:export',
  RECIPE_REMOVE: 'recipe:remove',
};

/**
 * Reset audit logs (for testing only)
 */
function resetAuditLogs() {
  if (fs.existsSync(AUDIT_DIR)) {
    const files = fs.readdirSync(AUDIT_DIR);
    for (const file of files) {
      if (file.startsWith('audit-') && file.endsWith('.jsonl')) {
        fs.unlinkSync(path.join(AUDIT_DIR, file));
      }
    }
  }
}

module.exports = {
  logAudit,
  readAuditLogs,
  getAuditSummary,
  AUDIT_ACTIONS,
  resetAuditLogs,
};
