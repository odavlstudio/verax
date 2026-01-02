/**
 * Stage 5: Determinism Contract
 * 
 * Ensures same inputs => same verdict (within same environment).
 * Provides determinism hash for verification.
 */

const crypto = require('crypto');

/**
 * Compute determinism hash from run inputs
 * @param {Object} inputs - The input configuration
 * @returns {string} SHA-256 hash of normalized inputs
 */
function computeDeterminismHash(inputs) {
  const {
    baseUrl,
    policy,
    attempts = [],
    flows = [],
    preset,
    timeout,
    maxPages,
    maxDepth,
    enableFlows,
    enableCrawl,
    attemptsFilter,
    mode
  } = inputs;

  // Normalize inputs for consistent hashing
  const normalized = {
    baseUrl: String(baseUrl || ''),
    policy: typeof policy === 'string' ? policy : (policy?.id || 'default'),
    preset: String(preset || 'default'),
    // Sort arrays for deterministic ordering
    attempts: Array.isArray(attempts) ? [...attempts].sort() : [],
    flows: Array.isArray(flows) ? [...flows].sort() : [],
    timeout: Number(timeout) || 20000,
    maxPages: Number(maxPages) || 25,
    maxDepth: Number(maxDepth) || 3,
    enableFlows: Boolean(enableFlows),
    enableCrawl: Boolean(enableCrawl),
    attemptsFilter: String(attemptsFilter || ''),
    mode: String(mode || 'advisory')
  };

  const hashInput = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Normalize wait strategies to remove randomness
 * @param {Array} steps - Flow steps
 * @returns {Array} Normalized steps
 */
function normalizeWaitStrategies(steps) {
  if (!Array.isArray(steps)) return steps;

  return steps.map(step => {
    if (step.wait) {
      // Remove any random wait variation, use fixed waits
      const wait = { ...step.wait };
      delete wait.variance;
      delete wait.jitter;
      return { ...step, wait };
    }
    return step;
  });
}

/**
 * Stable sort for arrays (ensures deterministic ordering)
 * @param {Array} arr - Array to sort
 * @param {Function} compareFn - Comparison function
 * @returns {Array} Sorted array
 */
function stableSort(arr, compareFn) {
  if (!Array.isArray(arr)) return arr;
  
  // Add index to maintain stability
  const indexed = arr.map((item, index) => ({ item, index }));
  
  indexed.sort((a, b) => {
    const result = compareFn(a.item, b.item);
    return result !== 0 ? result : a.index - b.index;
  });
  
  return indexed.map(x => x.item);
}

/**
 * Remove timing-dependent data from results for determinism
 * @param {Object} result - Attempt or flow result
 * @returns {Object} Normalized result
 */
function normalizeTimingData(result) {
  if (!result) return result;

  const normalized = { ...result };
  
  // Keep duration for analysis but don't use it for verdict computation
  // unless it exceeds hard thresholds (not relative comparisons)
  if (normalized.timing) {
    normalized.timing = {
      ...normalized.timing,
      // Remove wall-clock timestamps
      startedAt: undefined,
      completedAt: undefined
    };
  }

  return normalized;
}

/**
 * Validate determinism between runs
 * @param {Array} hashes - Array of determinism hashes from multiple runs
 * @returns {Object} Validation result
 */
function validateDeterminism(hashes) {
  if (!Array.isArray(hashes) || hashes.length < 2) {
    return {
      valid: false,
      error: 'Need at least 2 runs to validate determinism'
    };
  }

  const firstHash = hashes[0];
  const allMatch = hashes.every(h => h === firstHash);

  return {
    valid: allMatch,
    hash: firstHash,
    runs: hashes.length,
    mismatch: allMatch ? null : hashes.filter(h => h !== firstHash)
  };
}

module.exports = {
  computeDeterminismHash,
  normalizeWaitStrategies,
  stableSort,
  normalizeTimingData,
  validateDeterminism
};
