/**
 * PHASE 25 — Confidence Policy Cache
 * 
 * Single-sourced policy loading with deterministic caching.
 * Each unique (projectDir, policyPath) combination is cached.
 * Policies are immutable after loading.
 */

import { loadConfidencePolicy as _loadConfidencePolicy } from './confidence.loader.js';

/**
 * Policy cache: Map<cacheKey, policy>
 * cacheKey = `${projectDir}||${policyPath}` (|| used as separator)
 */
const POLICY_CACHE = new Map();

/**
 * Generate deterministic cache key from params
 * 
 * @param {string|null} projectDir - Project directory
 * @param {string|null} policyPath - Policy path
 * @returns {string} Cache key
 */
function generateCacheKey(projectDir, policyPath) {
  return `${projectDir || ''}||${policyPath || ''}`;
}

/**
 * Load or retrieve cached confidence policy
 * 
 * DETERMINISTIC: Same (projectDir, policyPath) always returns same object.
 * SINGLE-SOURCED: Policy loaded only once per cache key.
 * IMMUTABLE: Policies cannot be modified after loading.
 * 
 * @param {string|null} policyPath - Path to custom policy file (optional)
 * @param {string|null} projectDir - Project directory (optional)
 * @returns {Object} Confidence policy (frozen/sealed)
 * @throws {Error} If policy loading fails
 */
export function getConfidencePolicy(policyPath = null, projectDir = null) {
  // Generate deterministic cache key
  const cacheKey = generateCacheKey(projectDir, policyPath);
  
  // Check cache
  if (POLICY_CACHE.has(cacheKey)) {
    return POLICY_CACHE.get(cacheKey);
  }
  
  // Load policy (will throw if invalid)
  const policy = _loadConfidencePolicy(policyPath, projectDir);
  
  // Freeze policy to ensure immutability
  // (prevents accidental mutations)
  Object.freeze(policy);
  if (policy.baseScores) Object.freeze(policy.baseScores);
  if (policy.thresholds) Object.freeze(policy.thresholds);
  if (policy.weights) Object.freeze(policy.weights);
  if (policy.truthLocks) Object.freeze(policy.truthLocks);
  
  // Cache and return
  POLICY_CACHE.set(cacheKey, policy);
  return policy;
}

/**
 * Clear policy cache (testing only)
 * 
 * WARNING: Only call in tests.
 * In production, policies should be cached for the lifetime of the process.
 */
export function clearPolicyCache() {
  POLICY_CACHE.clear();
}

/**
 * Get cache statistics (for debugging)
 * 
 * @returns {Object} Cache stats { size, keys: [] }
 */
export function getPolicyCacheStats() {
  return {
    size: POLICY_CACHE.size,
    keys: Array.from(POLICY_CACHE.keys())
  };
}
