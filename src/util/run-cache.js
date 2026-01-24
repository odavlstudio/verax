/**
 * WEEK 4: Per-run deterministic cache for performance optimization
 *
 * This module provides a run-scoped caching layer that:
 * - Caches expensive computations per run (package.json parsing, project shape, routes)
 * - Is deterministic (same input always yields same output)
 * - Is invalidated at run end (no cross-run persistence)
 * - Records cache hits/misses as observable evidence
 *
 * Evidence of cache operation is recorded for auditability (VERAX law #1: No Evidence → No Finding).
 */

import { getTimeProvider } from '../cli/util/support/time-provider.js';

const cacheStorage = new Map(); // runId -> cacheMap
const cacheStats = new Map(); // runId -> { hits, misses, operations }

/**
 * Initialize per-run cache storage
 */
export function initializeRunCache(runId) {
  if (cacheStorage.has(runId)) {
    throw new Error(`[WEEK4-CACHE] Duplicate runId initialization: ${runId}`);
  }
  cacheStorage.set(runId, new Map());
  cacheStats.set(runId, { hits: 0, misses: 0, operations: [] });
  return {
    initialized: true,
    runId,
    timestamp: getTimeProvider().now(),
  };
}

/**
 * Get from run cache with hit/miss tracking
 */
export function getFromRunCache(runId, key) {
  if (!cacheStorage.has(runId)) {
    throw new Error(`[WEEK4-CACHE] Cache not initialized for runId: ${runId}`);
  }

  const cache = cacheStorage.get(runId);
  const stats = cacheStats.get(runId);

  if (cache.has(key)) {
    stats.hits++;
    stats.operations.push({
      type: 'HIT',
      key,
      timestamp: getTimeProvider().now(),
    });
    return {
      value: cache.get(key),
      cached: true,
    };
  }

  stats.misses++;
  stats.operations.push({
    type: 'MISS',
    key,
    timestamp: getTimeProvider().now(),
  });

  return {
    value: null,
    cached: false,
  };
}

/**
 * Set into run cache with operation tracking
 */
export function setRunCache(runId, key, value, metadata = {}) {
  if (!cacheStorage.has(runId)) {
    throw new Error(`[WEEK4-CACHE] Cache not initialized for runId: ${runId}`);
  }

  const cache = cacheStorage.get(runId);
  const stats = cacheStats.get(runId);

  cache.set(key, value);
  stats.operations.push({
    type: 'SET',
    key,
    valueType: typeof value,
    metadata,
    timestamp: getTimeProvider().now(),
  });

  return {
    cached: true,
    key,
  };
}

/**
 * Clear run-scoped cache (called at run end)
 */
export function clearRunCache(runId) {
  const stats = cacheStats.get(runId) || { hits: 0, misses: 0, operations: [] };

  cacheStorage.delete(runId);
  cacheStats.delete(runId);

  return {
    cleared: true,
    runId,
    stats: {
      hits: stats.hits,
      misses: stats.misses,
      operations: stats.operations.length,
      hitRate: stats.hits + stats.misses > 0 
        ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%'
        : 'N/A',
    },
  };
}

/**
 * Get cache statistics for reporting
 */
export function getRunCacheStats(runId) {
  if (!cacheStats.has(runId)) {
    return {
      exists: false,
      runId,
    };
  }

  const stats = cacheStats.get(runId);
  return {
    exists: true,
    runId,
    hits: stats.hits,
    misses: stats.misses,
    totalAccesses: stats.hits + stats.misses,
    hitRate: stats.hits + stats.misses > 0 
      ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%'
      : 'N/A',
    operations: stats.operations.length,
  };
}

/**
 * Deterministic cache key generator
 * Ensures cache keys are reproducible across runs with same inputs
 */
export function generateCacheKey(namespace, ...args) {
  // Simple deterministic key generation
  // In production, use stable-id pattern from codebase
  return `${namespace}:${args
    .map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg, Object.keys(arg).sort());
      }
      return String(arg);
    })
    .join(':')}`;
}
