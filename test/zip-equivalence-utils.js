/**
 * ZIP Normalization Utility - Deterministic comparison for export equivalence
 * 
 * Used ONLY by tests to normalize ZIP archives and compare their contents.
 * Ignores ZIP metadata (timestamps, permissions) and focuses on file content.
 * 
 * This is NOT used in production code.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const JSZip = require('jszip');

/**
 * Normalize a ZIP file to a canonical content map
 * 
 * @param {Buffer|string} zipSource - ZIP buffer or file path
 * @returns {Promise<Object>} { filePath -> contentHash }
 */
async function normalizeZip(zipSource) {
  let zipBuffer;
  
  // Handle both buffer and file path
  if (typeof zipSource === 'string') {
    zipBuffer = fs.readFileSync(zipSource);
  } else if (Buffer.isBuffer(zipSource)) {
    zipBuffer = zipSource;
  } else {
    throw new Error('zipSource must be Buffer or file path string');
  }
  
  const normalized = {};
  
  const zip = await JSZip.loadAsync(zipBuffer);

  for (const [fileName, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    const normalizedPath = fileName.replace(/\\/g, '/');
    const content = await entry.async('nodebuffer');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    normalized[normalizedPath] = hash;
  }
  
  return normalized;
}

/**
 * Compare two normalized ZIP objects
 * 
 * @param {Object} zip1 - Normalized ZIP (path -> hash)
 * @param {Object} zip2 - Normalized ZIP (path -> hash)
 * @returns {Object} { same: boolean, diffs: [] }
 */
function compareNormalizedZips(zip1, zip2) {
  const diffs = [];
  const allPaths = new Set([...Object.keys(zip1), ...Object.keys(zip2)]);
  
  for (const filePath of Array.from(allPaths).sort()) {
    const hash1 = zip1[filePath];
    const hash2 = zip2[filePath];
    
    if (!hash1) {
      diffs.push({ type: 'MISSING_IN_ZIP1', path: filePath, hash2 });
    } else if (!hash2) {
      diffs.push({ type: 'MISSING_IN_ZIP2', path: filePath, hash1 });
    } else if (hash1 !== hash2) {
      diffs.push({ type: 'CONTENT_MISMATCH', path: filePath, hash1, hash2 });
    }
  }
  
  return {
    same: diffs.length === 0,
    diffs,
    summary: {
      files1: Object.keys(zip1).length,
      files2: Object.keys(zip2).length,
      totalUnique: allPaths.size,
      differences: diffs.length
    }
  };
}

/**
 * Format comparison diff for display
 * 
 * @param {Object} comparison - Result from compareNormalizedZips()
 * @returns {string} Formatted diff string
 */
function formatComparisonDiff(comparison) {
  if (comparison.same) {
    return 'ZIPs are identical';
  }
  
  let output = `\nZIP Equivalence Report:\n`;
  output += `Files in ZIP 1: ${comparison.summary.files1}\n`;
  output += `Files in ZIP 2: ${comparison.summary.files2}\n`;
  output += `Total unique files: ${comparison.summary.totalUnique}\n`;
  output += `Differences: ${comparison.summary.differences}\n\n`;
  
  if (comparison.diffs.length > 0) {
    output += `Differences found:\n`;
    for (const diff of comparison.diffs) {
      if (diff.type === 'MISSING_IN_ZIP1') {
        output += `  [MISSING_IN_ZIP1] ${diff.path}\n`;
      } else if (diff.type === 'MISSING_IN_ZIP2') {
        output += `  [MISSING_IN_ZIP2] ${diff.path}\n`;
      } else if (diff.type === 'CONTENT_MISMATCH') {
        output += `  [CONTENT_MISMATCH] ${diff.path}\n`;
        output += `    ZIP1: ${diff.hash1}\n`;
        output += `    ZIP2: ${diff.hash2}\n`;
      }
    }
  }
  
  return output;
}

module.exports = {
  normalizeZip,
  compareNormalizedZips,
  formatComparisonDiff
};
