/**
 * Run Cleanup & Management
 * Delete old, excessive, or failed runs based on specified criteria
 */

const fs = require('fs');
const path = require('path');
const { readMetaJson } = require('./run-artifacts');

/**
 * Parse duration string (e.g. "7d", "24h", "30m")
 * 
 * @param {string} durationStr - Duration like "7d", "24h", "30m"
 * @returns {number} milliseconds
 */
function parseDuration(durationStr) {
  const match = durationStr.match(/^(\d+)([dhm])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${durationStr}. Use Nd, Nh, or Nm (e.g., "7d", "24h", "30m")`);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Find all run directories
 * 
 * @param {string} artifactsDir - Path to artifacts directory
 * @returns {Array} array of { dirPath, dirName, meta }
 */
function loadAllRuns(artifactsDir) {
  if (!fs.existsSync(artifactsDir)) {
    return [];
  }
  
  try {
    const entries = fs.readdirSync(artifactsDir, { withFileTypes: true });
    const runs = [];
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const dirPath = path.join(artifactsDir, entry.name);
      const meta = readMetaJson(dirPath);
      
      // Skip runs without META.json
      if (!meta) continue;
      
      runs.push({
        dirPath,
        dirName: entry.name,
        meta
      });
    }
    
    return runs;
  } catch (_e) {
    return [];
  }
}

/**
 * Group runs by siteSlug
 * 
 * @param {Array} runs - Array of run objects
 * @returns {Object} map of siteSlug → array of runs
 */
function groupBySite(runs) {
  const grouped = {};
  for (const run of runs) {
    const slug = run.meta.siteSlug || 'unknown';
    if (!grouped[slug]) {
      grouped[slug] = [];
    }
    grouped[slug].push(run);
  }
  return grouped;
}

/**
 * Sort runs by timestamp (newest first)
 * 
 * @param {Array} runs - Array of run objects
 * @returns {Array} sorted runs
 */
function sortByTimestamp(runs) {
  return runs.sort((a, b) => {
    const timeA = new Date(a.meta.timestamp).getTime();
    const timeB = new Date(b.meta.timestamp).getTime();
    return timeB - timeA;
  });
}

/**
 * Apply cleanup filters
 * 
 * @param {Array} runs - Array of run objects
 * @param {Object} opts - Options
 * @param {string} opts.olderThan - Duration string (e.g., "7d")
 * @param {number} opts.keepLatest - Number of latest runs to keep per site
 * @param {boolean} opts.failedOnly - Only delete FAILED runs
 * @returns {Array} runs to delete
 */
function selectRunsForDeletion(runs, opts = {}) {
  let toDelete = [...runs];
  const now = Date.now();
  
  // Filter by age
  if (opts.olderThan) {
    const ageMs = parseDuration(opts.olderThan);
    const cutoffTime = now - ageMs;
    toDelete = toDelete.filter(run => {
      const runTime = new Date(run.meta.timestamp).getTime();
      return runTime < cutoffTime;
    });
  }
  
  // Filter by status
  if (opts.failedOnly) {
    toDelete = toDelete.filter(run => run.meta.result === 'FAILED');
  }
  
  // Apply keep-latest per site (only if we're not already filtering by age/status heavily)
  if (opts.keepLatest && opts.keepLatest > 0) {
    const grouped = groupBySite(toDelete);
    const toKeepPaths = new Set();
    
    for (const siteSlug in grouped) {
      const siteRuns = sortByTimestamp(grouped[siteSlug]);
      // Keep the latest N
      for (let i = 0; i < Math.min(opts.keepLatest, siteRuns.length); i++) {
        toKeepPaths.add(siteRuns[i].dirPath);
      }
    }
    
    toDelete = toDelete.filter(run => !toKeepPaths.has(run.dirPath));
  }
  
  return toDelete;
}

/**
 * Execute cleanup
 * 
 * @param {string} artifactsDir - Path to artifacts directory
 * @param {Object} opts - Options
 * @returns {Object} cleanup result
 */
function cleanup(artifactsDir = './artifacts', opts = {}) {
  const allRuns = loadAllRuns(artifactsDir);
  
  if (allRuns.length === 0) {
    return {
      deleted: 0,
      kept: 0,
      errors: []
    };
  }
  
  // Determine which runs to delete
  const toDelete = selectRunsForDeletion(allRuns, opts);
  const deletePaths = new Set(toDelete.map(r => r.dirPath));
  
  const errors = [];
  
  // Delete run directories
  for (const run of toDelete) {
    try {
      fs.rmSync(run.dirPath, { recursive: true, force: true });
    } catch (e) {
      errors.push(`Failed to delete ${run.dirName}: ${e.message}`);
    }
  }
  
  return {
    deleted: toDelete.length,
    kept: allRuns.length - toDelete.length,
    errors,
    deletedRuns: toDelete.map(r => ({
      dirName: r.dirName,
      site: r.meta.siteSlug,
      result: r.meta.result,
      timestamp: r.meta.timestamp
    }))
  };
}

module.exports = {
  cleanup,
  parseDuration,
  loadAllRuns,
  groupBySite,
  sortByTimestamp,
  selectRunsForDeletion
};
