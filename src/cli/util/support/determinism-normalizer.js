/**
 * Determinism Normalizer
 * Removes volatile fields and normalizes JSON for deterministic comparison
 * Used in tests to verify runs produce identical outputs
 */

/**
 * Fields that are explicitly volatile (timestamps, runtime metrics, volatile IDs)
 * These are excluded from determinism comparison
 */
const VOLATILE_FIELDS = [
  'startedAt',
  'completedAt',
  'observedAt',
  'detectedAt',
  'learnedAt',
  'generatedAt',
  'incompleteAt',
  'failedAt',
  'manifestGeneratedAt',
  'learnMs',
  'observeMs',
  'detectMs',
  'totalMs',
  'durationMs',
  'timeMs',
  'elapsed',
  'runId',
  'sessionId',
  'executionTime',
];

/**
 * Normalize JSON for deterministic comparison
 * Removes volatile fields and sorts keys consistently
 * @param {Object} obj - JSON object to normalize
 * @param {Set<string>} volatileFields - fields to exclude (optional)
 * @returns {Object} normalized JSON
 */
export function normalizeForComparison(obj, volatileFields = new Set(VOLATILE_FIELDS)) {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => normalizeForComparison(item, volatileFields));
  }

  // Object: filter volatile fields and sort keys
  const normalized = {};
  const keys = Object.keys(obj)
    .filter(key => !volatileFields.has(key))
    .sort((a, b) => a.localeCompare(b, 'en'));

  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'object' && value !== null) {
      normalized[key] = normalizeForComparison(value, volatileFields);
    } else if (value !== undefined) {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Compare two normalized JSON objects for equality
 * Useful for verifying deterministic outputs
 * @param {Object} a - first normalized JSON
 * @param {Object} b - second normalized JSON
 * @returns {boolean} true if objects are deeply equal
 */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return a === b;
  }

  const keysA = Object.keys(a).sort((a, b) => a.localeCompare(b, 'en'));
  const keysB = Object.keys(b).sort((a, b) => a.localeCompare(b, 'en'));

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) {
      return false;
    }
  }

  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Get a human-readable diff of two objects
 * Highlights differences after normalization
 * @param {Object} expected - expected value
 * @param {Object} actual - actual value
 * @param {string} path - current path in object tree
 * @returns {string[]} array of diff lines
 */
export function getDiff(expected, actual, path = 'root') {
  const diffs = [];

  if (typeof expected !== typeof actual) {
    diffs.push(`${path}: type mismatch (expected ${typeof expected}, got ${typeof actual})`);
    return diffs;
  }

  if (typeof expected !== 'object' || expected === null || actual === null) {
    if (expected !== actual) {
      diffs.push(`${path}: ${JSON.stringify(expected)} !== ${JSON.stringify(actual)}`);
    }
    return diffs;
  }

  if (Array.isArray(expected) !== Array.isArray(actual)) {
    diffs.push(`${path}: expected array=${Array.isArray(expected)}, got ${Array.isArray(actual)}`);
    return diffs;
  }

  if (Array.isArray(expected)) {
    if (expected.length !== actual.length) {
      diffs.push(`${path}: array length mismatch (expected ${expected.length}, got ${actual.length})`);
    }
    const minLen = Math.min(expected.length, actual.length);
    for (let i = 0; i < minLen; i++) {
      diffs.push(...getDiff(expected[i], actual[i], `${path}[${i}]`));
    }
    return diffs;
  }

  const keysExp = Object.keys(expected).sort((a, b) => a.localeCompare(b, 'en'));
  const keysAct = Object.keys(actual).sort((a, b) => a.localeCompare(b, 'en'));
  const allKeys = new Set([...keysExp, ...keysAct]);

  for (const key of allKeys) {
    if (!keysExp.includes(key)) {
      diffs.push(`${path}.${key}: unexpected key in actual`);
    } else if (!keysAct.includes(key)) {
      diffs.push(`${path}.${key}: missing from actual`);
    } else {
      diffs.push(...getDiff(expected[key], actual[key], `${path}.${key}`));
    }
  }

  return diffs;
}








