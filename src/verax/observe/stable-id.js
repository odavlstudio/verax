/**
 * Stable ID Generation for Observable Layers
 * 
 * VERAX CONSTITUTION: No Date.now(), No Math.random() in production runtime.
 * 
 * All IDs must be deterministic given identical inputs.
 * This enables reproducible findings and semantic comparison across runs.
 */

import { createHash } from 'crypto';

/**
 * Generate a deterministic, stable ID from input parts
 * 
 * @param {string} prefix - ID prefix (e.g., 'obs-nav', 'loading')
 * @param {object|array} parts - Input parts (will be JSON-stringified with sorted keys)
 * @returns {string} - Deterministic hash-based ID
 * 
 * @example
 * stableHashId('obs-nav', { url: '/home', selector: 'a.btn' })
 * // => 'obs-nav-a3f8b2c1'
 */
export function stableHashId(prefix, parts) {
  // Normalize parts to stable JSON representation
  const normalized = normalizeForHash(parts);
  
  // Generate SHA-1 hash and truncate to 8 chars
  const hash = createHash('sha1')
    .update(normalized)
    .digest('hex')
    .slice(0, 8);
  
  return `${prefix}-${hash}`;
}

/**
 * Normalize object/array to deterministic JSON string
 * - Sorts object keys recursively
 * - Handles nested objects and arrays
 * - Null/undefined become empty string
 * 
 * @param {any} value - Value to normalize
 * @returns {string} - Stable JSON representation
 */
function normalizeForHash(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (Array.isArray(value)) {
    return JSON.stringify(value.map(normalizeForHash));
  }
  
  if (typeof value === 'object') {
    // Sort keys for deterministic ordering
    const sorted = {};
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b, 'en'));
    for (const key of keys) {
      sorted[key] = normalizeForHash(value[key]);
    }
    return JSON.stringify(sorted);
  }
  
  return JSON.stringify(value);
}

/**
 * Create a deterministic counter-based ID generator
 * Useful when hash-based IDs are not feasible
 * 
 * @param {string} prefix - ID prefix
 * @returns {function(): string} - Generator function
 * 
 * @example
 * const gen = createCounterId('loading');
 * gen() // => 'loading-1'
 * gen() // => 'loading-2'
 */
export function createCounterId(prefix) {
  let counter = 0;
  
  return () => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}
