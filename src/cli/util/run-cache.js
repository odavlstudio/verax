/**
 * Week 4 — Run-Scoped Deterministic Cache
 * 
 * Performance-critical cache initialized per run:
 * - Deterministic: Same inputs → same outputs, cached results byte-identical
 * - Auto-invalidated: Fresh per run, no cross-run pollution
 * - Bounded: Never persists across runs (unless explicitly allowed by Product Contract)
 * 
 * Cached items:
 * 1. package.json parsing (called 4+ times per run)
 * 2. Project shape detection (static analysis)
 * 3. Route discovery results (rarely changes during run)
 * 4. Security policy loading (config is static)
 * 5. TypeScript/ESM resolution (analyzed once per file)
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { getTimeProvider } from './support/time-provider.js';

/**
 * Per-run cache object
 * Created fresh at run start, discarded at run end
 * Prevents repeated expensive operations without cross-run pollution
 */
class RunCache {
  constructor(runId) {
    this.runId = runId;
    this.packageJsonCache = new Map(); // path → {content, parsedData, timestamp}
    this.projectShapeCache = null; // {srcPath, shape, timestamp}
    this.routeDiscoveryCache = null; // {routes, gaps, timestamp}
    this.policyCache = new Map(); // path → {content, data, timestamp}
    this.tsResolutionCache = new Map(); // filePath → {result, timestamp}
    this.hitCount = 0; // For testing: verify cache hits
    this.missCount = 0;
  }

  /**
   * Get or fetch package.json (most called item)
   * Deterministic: Same path always returns same parsed object
   */
  async getPackageJson(packagePath) {
    if (!packagePath) {
      this.missCount++;
      return null;
    }

    if (this.packageJsonCache.has(packagePath)) {
      this.hitCount++;
      return this.packageJsonCache.get(packagePath).parsedData;
    }

    // Cache miss: read and parse
    try {
      const content = await readFile(packagePath, 'utf-8');
      const parsedData = JSON.parse(content);
      
      this.packageJsonCache.set(packagePath, {
        content,
        parsedData,
        timestamp: getTimeProvider().now()
      });
      
      this.missCount++;
      return parsedData;
    } catch (error) {
      this.missCount++;
      return null;
    }
  }

  /**
   * Set project shape (computed once per run)
   */
  setProjectShape(srcPath, shape) {
    this.projectShapeCache = {
      srcPath,
      shape,
      timestamp: getTimeProvider().now()
    };
  }

  /**
   * Get cached project shape
   */
  getProjectShape(srcPath) {
    if (this.projectShapeCache && this.projectShapeCache.srcPath === srcPath) {
      this.hitCount++;
      return this.projectShapeCache.shape;
    }
    this.missCount++;
    return null;
  }

  /**
   * Set route discovery results (computed once, rarely changes)
   */
  setRouteDiscovery(routes, gaps) {
    this.routeDiscoveryCache = {
      routes,
      gaps,
      timestamp: getTimeProvider().now()
    };
  }

  /**
   * Get cached route discovery
   */
  getRouteDiscovery() {
    if (this.routeDiscoveryCache) {
      this.hitCount++;
      return this.routeDiscoveryCache;
    }
    this.missCount++;
    return null;
  }

  /**
   * Cache policy data (security, confidence, gates policies)
   */
  async getPolicy(policyPath) {
    if (!policyPath || !existsSync(policyPath)) {
      this.missCount++;
      return null;
    }

    if (this.policyCache.has(policyPath)) {
      this.hitCount++;
      return this.policyCache.get(policyPath).data;
    }

    // Cache miss: read and parse
    try {
      const content = await readFile(policyPath, 'utf-8');
      const data = JSON.parse(content);
      
      this.policyCache.set(policyPath, {
        content,
        data,
        timestamp: getTimeProvider().now()
      });
      
      this.missCount++;
      return data;
    } catch (error) {
      this.missCount++;
      return null;
    }
  }

  /**
   * Cache TypeScript/ESM resolution results
   */
  setTsResolution(filePath, result) {
    this.tsResolutionCache.set(filePath, {
      result,
      timestamp: getTimeProvider().now()
    });
  }

  /**
   * Get cached TypeScript/ESM resolution
   */
  getTsResolution(filePath) {
    if (this.tsResolutionCache.has(filePath)) {
      this.hitCount++;
      return this.tsResolutionCache.get(filePath).result;
    }
    this.missCount++;
    return null;
  }

  /**
   * Get cache statistics for testing
   */
  getStats() {
    return {
      runId: this.runId,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount / (this.hitCount + this.missCount || 1),
      cacheSize: {
        packageJson: this.packageJsonCache.size,
        projectShape: this.projectShapeCache ? 1 : 0,
        routeDiscovery: this.routeDiscoveryCache ? 1 : 0,
        policies: this.policyCache.size,
        tsResolutions: this.tsResolutionCache.size
      }
    };
  }

  /**
   * Clear all caches (at run end)
   */
  clear() {
    this.packageJsonCache.clear();
    this.projectShapeCache = null;
    this.routeDiscoveryCache = null;
    this.policyCache.clear();
    this.tsResolutionCache.clear();
  }
}

// Singleton per run
let activeRunCache = null;

/**
 * Initialize run cache at run start
 * Must be called once per run, before any cached operations
 */
export function initializeRunCache(runId) {
  if (activeRunCache && activeRunCache.runId !== runId) {
    // Previous run not cleared - log warning in test/debug
    if (process.env.VERAX_DEBUG) {
      console.warn(`[RunCache] Previous run cache (${activeRunCache.runId}) not cleared before initializing ${runId}`);
    }
  }
  activeRunCache = new RunCache(runId);
  return activeRunCache;
}

/**
 * Get active run cache
 * Returns null if no cache initialized (error condition)
 */
export function getRunCache() {
  return activeRunCache;
}

/**
 * Clear and reset run cache
 * Called at run completion
 */
export function clearRunCache() {
  if (activeRunCache) {
    activeRunCache.clear();
  }
  activeRunCache = null;
}

/**
 * Assert cache is active
 * Throws if called outside run context
 */
export function requireRunCache(context = 'unknown') {
  if (!activeRunCache) {
    throw new Error(`[RunCache] Cache not initialized. Called from ${context}. This must be called within a run context.`);
  }
  return activeRunCache;
}

/**
 * Export cache class for testing
 */
export { RunCache };
