/**
 * Run Artifacts Naming & Metadata
 * Deterministic naming and META.json generation for Guardian runs
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate site slug from URL
 * 
 * Rules:
 * - Lowercase
 * - Remove protocol (http/https)
 * - Remove trailing slash
 * - Replace non-alphanumeric with "-"
 * - Collapse multiple "-" to one
 * - Trim leading/trailing "-"
 * 
 * @param {string} url - Original URL
 * @returns {string} slug
 */
function makeSiteSlug(url) {
  if (!url) return 'unknown';
  
  // Parse URL to get host + path
  let normalized = url.toLowerCase();
  
  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//i, '');
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  // Replace any non-alphanumeric character (including colon, slash, dot) with hyphen
  normalized = normalized.replace(/[^a-z0-9\-]/g, '-');
  
  // Collapse multiple hyphens
  normalized = normalized.replace(/-+/g, '-');
  
  // Trim leading/trailing hyphens
  normalized = normalized.replace(/^-+|-+$/g, '');
  
  return normalized || 'unknown';
}

/**
 * Generate human-readable run directory name
 * 
 * Format: YYYY-MM-DD_HH-MM-SS_<siteSlug>_<policy>_<RESULT>
 * Example: 2025-12-24_01-31-11_localhost-8001_startup_FAILED
 * 
 * @param {Object} opts
 * @param {Date|string} opts.timestamp - Execution time
 * @param {string} opts.url - Site URL
 * @param {string} opts.policy - Policy/profile name (or 'default')
 * @param {string} opts.result - Result: PASSED, FAILED, or WARN
 * @returns {string} directory name
 */
function makeRunDirName(opts) {
  const { timestamp, url, policy, result } = opts;
  
  // Parse timestamp
  const time = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  // Format: YYYY-MM-DD_HH-MM-SS
  const year = time.getFullYear();
  const month = String(time.getMonth() + 1).padStart(2, '0');
  const day = String(time.getDate()).padStart(2, '0');
  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const seconds = String(time.getSeconds()).padStart(2, '0');
  
  const timeStr = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  
  // Generate slug
  const slug = makeSiteSlug(url);
  
  // Normalize policy (extract preset name if needed)
  let policyName = policy || 'default';
  if (policyName.startsWith('preset:')) {
    policyName = policyName.replace('preset:', '');
  }
  
  // Normalize result
  const normalizedResult = (result || 'UNKNOWN').toUpperCase();
  
  return `${timeStr}_${slug}_${policyName}_${normalizedResult}`;
}

/**
 * Write META.json for a completed run
 * 
 * @param {Object} opts
 * @param {string} opts.runDir - Run directory path
 * @param {string} opts.url - Original site URL
 * @param {string} opts.siteSlug - Generated slug
 * @param {string} opts.policy - Policy used
 * @param {string} opts.result - PASSED|FAILED|WARN
 * @param {number} opts.durationMs - Wall-clock duration
 * @param {string} opts.profile - Detected site profile (ecommerce|saas|content|unknown)
 * @param {Object} opts.attempts - Attempt statistics
 * @param {number} opts.attempts.total
 * @param {number} opts.attempts.executed
 * @param {number} opts.attempts.successful
 * @param {number} opts.attempts.failed
 * @param {number} opts.attempts.skipped
 * @param {Array} opts.attempts.skippedDetails - Array of {attempt, reason}
 * @param {number} [opts.attempts.nearSuccess] - Count of near-success signals
 * @param {Array} [opts.attempts.nearSuccessDetails] - Array of { attempt, reason }
 * @throws {Error} if write fails
 */
function writeMetaJson(opts) {
  const {
    runDir,
    url,
    siteSlug,
    policy,
    result,
    durationMs,
    profile,
    attempts,
    verdict
  } = opts;
  
  const meta = {
    version: 1,
    timestamp: new Date().toISOString(),
    url,
    siteSlug,
    policy: policy || 'default',
    result: (result || 'UNKNOWN').toUpperCase(),
    durationMs: Math.round(durationMs || 0),
    profile: profile || 'unknown',
    attempts: {
      total: attempts?.total || 0,
      executed: attempts?.executed || 0,
      successful: attempts?.successful || 0,
      failed: attempts?.failed || 0,
      skipped: attempts?.skipped || 0,
      skippedDetails: attempts?.skippedDetails || [],
      nearSuccess: attempts?.nearSuccess || 0,
      nearSuccessDetails: attempts?.nearSuccessDetails || []
    }
  };
  if (verdict) {
    meta.verdict = {
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      why: verdict.why || ''
    };
  }
  
  const metaPath = path.join(runDir, 'META.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  
  return metaPath;
}

/**
 * Read META.json from a run directory
 * 
 * @param {string} runDir - Run directory path
 * @returns {Object|null} parsed META.json or null if missing/invalid
 */
function readMetaJson(runDir) {
  const metaPath = path.join(runDir, 'META.json');
  
  if (!fs.existsSync(metaPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(metaPath, 'utf8');
    return JSON.parse(content);
  } catch (_e) {
    return null;
  }
}

/**
 * Format duration for human-readable output
 * 
 * @param {number} ms - Milliseconds
 * @returns {string} formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

module.exports = {
  makeSiteSlug,
  makeRunDirName,
  writeMetaJson,
  readMetaJson,
  formatDuration
};
