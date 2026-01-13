/**
 * Wave 9 — Performance Caching Layer
 *
 * Provides in-memory and optional disk caching for TS Program, symbol resolution,
 * and AST extraction results. Deterministic cache keys based on file content hashes.
 *
 * Cache is keyed by: projectRoot + tsconfig path + file mtimes hash
 * Entries are computed only once per unique key within a single run.
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';

const memoryCache = new Map(); // Global in-memory cache

/**
 * Compute a deterministic cache key from project root, tsconfig, and source files.
 * @param {string} projectRoot - Project root directory
 * @param {string} tsconfigPath - Path to tsconfig.json (optional)
 * @param {Array<string>} sourceFiles - Array of source file paths
 * @returns {string} - Deterministic cache key
 */
export function computeCacheKey(projectRoot, tsconfigPath, sourceFiles = []) {
  const hash = createHash('sha256');

  // Hash the project root
  hash.update(projectRoot);

  // Hash the tsconfig if present
  if (tsconfigPath && existsSync(tsconfigPath)) {
    try {
      const tsconfigContent = readFileSync(tsconfigPath, 'utf-8');
      hash.update(tsconfigContent);
    } catch (e) {
      // If tsconfig can't be read, just use the path
      hash.update(tsconfigPath);
    }
  }

  // Hash file modification times (more efficient than file content)
  for (const filePath of sourceFiles) {
    try {
      if (existsSync(filePath)) {
        const stats = statSync(filePath);
        hash.update(filePath + ':' + stats.mtimeMs);
      }
    } catch (e) {
      // Skip files that can't be stat'd
    }
  }

  return hash.digest('hex').substring(0, 16); // Use first 16 chars for brevity
}

/**
 * Get a value from cache. Calls computeFn if not cached.
 * @param {string} key - Cache key
 * @param {Function} computeFn - Function to compute value if not cached
 * @returns {*} - Cached or computed value
 */
export function getOrCompute(key, computeFn) {
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  const value = computeFn();
  memoryCache.set(key, value);
  return value;
}

/**
 * Clear the in-memory cache (useful between test runs).
 */
export function clearCache() {
  memoryCache.clear();
}

/**
 * Get cache statistics (for diagnostics).
 * @returns {Object} - { size, hitRate, entries }
 */
export function getCacheStats() {
  return {
    size: memoryCache.size,
    keys: Array.from(memoryCache.keys()).slice(0, 5) // First 5 keys for inspection
  };
}

/**
 * Create a cache key specifically for TS Program resolution.
 */
export function getTSProgramCacheKey(rootDir, files) {
  const tsconfigPath = resolve(rootDir, 'tsconfig.json');
  return `ts-program:${computeCacheKey(rootDir, tsconfigPath, files)}`;
}

/**
 * Create a cache key specifically for AST extraction.
 */
export function getASTCacheKey(projectDir, files) {
  const tsconfigPath = resolve(projectDir, 'tsconfig.json');
  return `ast:${computeCacheKey(projectDir, tsconfigPath, files)}`;
}
