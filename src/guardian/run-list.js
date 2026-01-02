/**
 * Run Listing CLI Command
 * Lists completed Guardian runs with their metadata
 */

const fs = require('fs');
const path = require('path');
const { readMetaJson, formatDuration } = require('./run-artifacts');

/**
 * Find all run directories in artifacts folder
 * 
 * @param {string} artifactsDir - Path to artifacts directory
 * @returns {string[]} array of run directory paths
 */
function findRunDirs(artifactsDir) {
  if (!fs.existsSync(artifactsDir)) {
    return [];
  }
  
  try {
    const entries = fs.readdirSync(artifactsDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => path.join(artifactsDir, e.name));
  } catch (_e) {
    return [];
  }
}

/**
 * Load run metadata with fallback to directory name parsing
 * 
 * @param {string} runDir - Run directory path
 * @returns {Object|null} run info or null if cannot parse
 */
function loadRunInfo(runDir) {
  const dirName = path.basename(runDir);
  
  // Try META.json first
  const meta = readMetaJson(runDir);
  if (meta) {
    return {
      path: runDir,
      dirName,
      timestamp: meta.timestamp,
      url: meta.url,
      siteSlug: meta.siteSlug,
      policy: meta.policy,
      result: meta.result,
      durationMs: meta.durationMs,
      attempts: meta.attempts
    };
  }
  
  // Silently skip if no META.json
  return null;
}

/**
 * Format and sort runs for display
 * 
 * @param {Array} runs - Array of run info objects
 * @returns {Array} sorted by timestamp (newest first)
 */
function sortRuns(runs) {
  return runs
    .filter(r => r !== null)
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // newest first
    });
}

/**
 * Format time string from ISO timestamp
 * 
 * @param {string} isoString - ISO-8601 timestamp
 * @returns {string} formatted local time (YYYY-MM-DD HH:MM:SS)
 */
function formatTime(isoString) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Calculate column widths for table display
 * 
 * @param {Array} runs - Run records
 * @returns {Object} widths for each column
 */
function calculateColumnWidths(runs) {
  // Use fixed reasonable widths for 100-char display
  return {
    time: 19,      // "YYYY-MM-DD HH:MM:SS"
    site: 14,
    policy: 10,
    result: 7,
    duration: 10,
    path: 30
  };
}

/**
 * Format a single row for table output
 * 
 * @param {Object} run - Run info
 * @param {Object} widths - Column widths
 * @returns {string} formatted row
 */
function formatRow(run, widths) {
  const time = formatTime(run.timestamp);
  const site = (run.siteSlug || 'unknown').substring(0, widths.site);
  const policy = (run.policy || 'default').substring(0, widths.policy);
  const result = (run.result || 'UNKNOWN').substring(0, widths.result);
  const duration = formatDuration(run.durationMs).substring(0, widths.duration);
  const path = run.dirName.substring(0, widths.path);
  
  return `${time}  ${site.padEnd(widths.site)}  ${policy.padEnd(widths.policy)}  ${result.padEnd(widths.result)}  ${duration.padEnd(widths.duration)}  ${path}`;
}

/**
 * Main list command with filtering
 * 
 * @param {string} artifactsDir - Path to artifacts directory
 * @param {Object} filters - Filter options
 * @param {boolean} filters.failed - Show only FAILED runs
 * @param {string} filters.site - Show only runs for specific site slug
 * @param {number} filters.limit - Show only newest N runs
 */
function listRuns(artifactsDir = './artifacts', filters = {}) {
  const runDirs = findRunDirs(artifactsDir);
  
  if (runDirs.length === 0) {
    console.log('No runs found.');
    return 0;
  }
  
  // Load metadata for all runs
  let runs = runDirs
    .map(dir => loadRunInfo(dir))
    .filter(r => r !== null);
  
  if (runs.length === 0) {
    console.log('No completed runs with META.json found.');
    return 0;
  }
  
  // Apply filters
  if (filters.failed) {
    runs = runs.filter(r => r.result === 'FAILED');
  }
  
  if (filters.site) {
    runs = runs.filter(r => r.siteSlug === filters.site);
  }
  
  if (runs.length === 0) {
    console.log('No runs matching the filters.');
    return 0;
  }
  
  // Sort by timestamp (newest first)
  const sorted = sortRuns(runs);
  
  // Apply limit filter
  let displayed = sorted;
  if (filters.limit && filters.limit > 0) {
    displayed = sorted.slice(0, filters.limit);
  }
  
  // Calculate column widths
  const widths = calculateColumnWidths(displayed);
  
  // Print header
  console.log('');
  console.log('Guardian Runs');
  console.log('='.repeat(100));
  const header = 'Time'.padEnd(widths.time + 2) +
    'Site'.padEnd(widths.site + 2) +
    'Policy'.padEnd(widths.policy + 2) +
    'Result'.padEnd(widths.result + 2) +
    'Duration'.padEnd(widths.duration + 2) +
    'Path';
  console.log(header);
  console.log('-'.repeat(100));
  
  // Print rows
  for (const run of displayed) {
    console.log(formatRow(run, widths));
  }
  
  console.log('='.repeat(100));
  console.log(`Total: ${runs.length} run(s)${displayed.length < runs.length ? ` (showing ${displayed.length})` : ''}\n`);
  
  return 0;
}

module.exports = {
  listRuns,
  findRunDirs,
  loadRunInfo,
  sortRuns
};
