/**
 * PHASE 21.9 — Performance Budget Contract
 * 
 * Defines hard limits for runtime, memory, pages, interactions, and artifacts.
 * Exceeding runtime or memory = BLOCKING.
 * Exceeding interactions/pages = DEGRADED.
 */

/**
 * Default performance budgets
 */
export const DEFAULT_PERF_BUDGET = {
  // Runtime limits (ms)
  maxRuntimeMs: 300000, // 5 minutes
  
  // Memory limits (bytes)
  maxMemoryRSS: 1024 * 1024 * 1024, // 1GB
  
  // Page/interaction limits
  maxPagesVisited: 100,
  maxInteractionsExecuted: 500,
  
  // Artifact size limits (bytes)
  maxArtifactsSizeMB: 500, // 500MB
  
  // Event loop delay threshold (ms)
  maxEventLoopDelayMs: 100
};

/**
 * Performance budget profiles
 */
export const PERF_BUDGET_PROFILES = {
  QUICK: {
    maxRuntimeMs: 20000, // 20s
    maxMemoryRSS: 512 * 1024 * 1024, // 512MB
    maxPagesVisited: 5,
    maxInteractionsExecuted: 50,
    maxArtifactsSizeMB: 50,
    maxEventLoopDelayMs: 50
  },
  STANDARD: {
    ...DEFAULT_PERF_BUDGET
  },
  THOROUGH: {
    maxRuntimeMs: 600000, // 10 minutes
    maxMemoryRSS: 2 * 1024 * 1024 * 1024, // 2GB
    maxPagesVisited: 200,
    maxInteractionsExecuted: 1000,
    maxArtifactsSizeMB: 1000, // 1GB
    maxEventLoopDelayMs: 200
  },
  EXHAUSTIVE: {
    maxRuntimeMs: 1800000, // 30 minutes
    maxMemoryRSS: 4 * 1024 * 1024 * 1024, // 4GB
    maxPagesVisited: 500,
    maxInteractionsExecuted: 5000,
    maxArtifactsSizeMB: 2000, // 2GB
    maxEventLoopDelayMs: 500
  }
};

/**
 * Get performance budget for a profile
 * 
 * @param {string} profileName - Profile name (QUICK, STANDARD, THOROUGH, EXHAUSTIVE)
 * @returns {Object} Performance budget
 */
export function getPerfBudget(profileName = 'STANDARD') {
  const profile = PERF_BUDGET_PROFILES[profileName.toUpperCase()];
  return profile || PERF_BUDGET_PROFILES.STANDARD;
}

/**
 * Evaluate performance against budget
 * 
 * @param {Object} actual - Actual performance metrics
 * @param {Object} budget - Performance budget
 * @returns {Object} Evaluation result
 */
export function evaluatePerfBudget(actual, budget) {
  const violations = [];
  const warnings = [];
  
  // BLOCKING violations
  if (actual.runtimeMs > budget.maxRuntimeMs) {
    violations.push({
      type: 'RUNTIME_EXCEEDED',
      severity: 'BLOCKING',
      actual: actual.runtimeMs,
      budget: budget.maxRuntimeMs,
      excess: actual.runtimeMs - budget.maxRuntimeMs,
      message: `Runtime exceeded: ${actual.runtimeMs}ms > ${budget.maxRuntimeMs}ms`
    });
  }
  
  if (actual.memoryRSS > budget.maxMemoryRSS) {
    violations.push({
      type: 'MEMORY_EXCEEDED',
      severity: 'BLOCKING',
      actual: actual.memoryRSS,
      budget: budget.maxMemoryRSS,
      excess: actual.memoryRSS - budget.maxMemoryRSS,
      message: `Memory exceeded: ${formatBytes(actual.memoryRSS)} > ${formatBytes(budget.maxMemoryRSS)}`
    });
  }
  
  // DEGRADED violations
  if (actual.pagesVisited > budget.maxPagesVisited) {
    warnings.push({
      type: 'PAGES_EXCEEDED',
      severity: 'DEGRADED',
      actual: actual.pagesVisited,
      budget: budget.maxPagesVisited,
      excess: actual.pagesVisited - budget.maxPagesVisited,
      message: `Pages visited exceeded: ${actual.pagesVisited} > ${budget.maxPagesVisited}`
    });
  }
  
  if (actual.interactionsExecuted > budget.maxInteractionsExecuted) {
    warnings.push({
      type: 'INTERACTIONS_EXCEEDED',
      severity: 'DEGRADED',
      actual: actual.interactionsExecuted,
      budget: budget.maxInteractionsExecuted,
      excess: actual.interactionsExecuted - budget.maxInteractionsExecuted,
      message: `Interactions executed exceeded: ${actual.interactionsExecuted} > ${budget.maxInteractionsExecuted}`
    });
  }
  
  if (actual.artifactsSizeMB > budget.maxArtifactsSizeMB) {
    warnings.push({
      type: 'ARTIFACTS_SIZE_EXCEEDED',
      severity: 'DEGRADED',
      actual: actual.artifactsSizeMB,
      budget: budget.maxArtifactsSizeMB,
      excess: actual.artifactsSizeMB - budget.maxArtifactsSizeMB,
      message: `Artifacts size exceeded: ${actual.artifactsSizeMB}MB > ${budget.maxArtifactsSizeMB}MB`
    });
  }
  
  if (actual.eventLoopDelayMs > budget.maxEventLoopDelayMs) {
    warnings.push({
      type: 'EVENT_LOOP_DELAY_EXCEEDED',
      severity: 'DEGRADED',
      actual: actual.eventLoopDelayMs,
      budget: budget.maxEventLoopDelayMs,
      excess: actual.eventLoopDelayMs - budget.maxEventLoopDelayMs,
      message: `Event loop delay exceeded: ${actual.eventLoopDelayMs}ms > ${budget.maxEventLoopDelayMs}ms`
    });
  }
  
  const hasBlocking = violations.length > 0;
  const hasDegraded = warnings.length > 0;
  
  let verdict = 'OK';
  if (hasBlocking) {
    verdict = 'BLOCKED';
  } else if (hasDegraded) {
    verdict = 'DEGRADED';
  }
  
  return {
    verdict,
    ok: !hasBlocking,
    violations,
    warnings,
    summary: {
      blocking: violations.length,
      degraded: warnings.length,
      total: violations.length + warnings.length
    }
  };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}




