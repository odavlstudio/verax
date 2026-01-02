/**
 * Latest Run Pointers
 * Maintains LATEST.json and site-specific latest pointers for quick access
 */

const fs = require('fs');
const path = require('path');

/**
 * Create a pointer file pointing to the latest run
 * 
 * @param {string} pointerPath - Path where pointer file should be saved
 * @param {Object} meta - META.json content from the run
 * @param {string} runDirName - Name of the run directory
 */
function writePointer(pointerPath, meta, runDirName) {
  const pointer = {
    version: 1,
    timestamp: new Date().toISOString(),
    pointedRun: runDirName,
    pointedRunMeta: {
      timestamp: meta.timestamp,
      url: meta.url,
      siteSlug: meta.siteSlug,
      policy: meta.policy,
      result: meta.result,
      durationMs: meta.durationMs
    }
  };
  
  // Create directory if needed
  const dir = path.dirname(pointerPath);
  fs.mkdirSync(dir, { recursive: true });
  
  // Atomic write
  fs.writeFileSync(pointerPath, JSON.stringify(pointer, null, 2));
}

/**
 * Update LATEST.json (global latest run)
 * 
 * @param {string} runDir - Full path to the run directory
 * @param {string} runDirName - Name of the run directory
 * @param {Object} meta - META.json content
 * @param {string} artifactsDir - Artifacts directory path (for pointer location)
 */
function updateLatestGlobal(runDir, runDirName, meta, artifactsDir = './artifacts') {
  const pointerPath = path.join(artifactsDir, 'LATEST.json');
  writePointer(pointerPath, meta, runDirName);
}

/**
 * Update site-specific latest pointer
 * 
 * @param {string} runDir - Full path to the run directory
 * @param {string} runDirName - Name of the run directory
 * @param {Object} meta - META.json content
 * @param {string} artifactsDir - Artifacts directory path (for pointer location)
 */
function updateLatestBySite(runDir, runDirName, meta, artifactsDir = './artifacts') {
  const siteSlug = meta.siteSlug || 'unknown';
  const pointerPath = path.join(artifactsDir, 'latest', `${siteSlug}.json`);
  writePointer(pointerPath, meta, runDirName);
}

/**
 * Read a pointer file
 * 
 * @param {string} pointerPath - Path to pointer file
 * @returns {Object|null} pointer content or null if missing
 */
function readPointer(pointerPath) {
  if (!fs.existsSync(pointerPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(pointerPath, 'utf8');
    return JSON.parse(content);
  } catch (_e) {
    return null;
  }
}

module.exports = {
  updateLatestGlobal,
  updateLatestBySite,
  readPointer,
  writePointer
};
