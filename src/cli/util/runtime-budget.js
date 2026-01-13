/**
 * Runtime Budget Model
 * Computes timeouts based on project size, execution mode, and framework
 * Ensures deterministic, bounded execution times
 */

/**
 * @typedef {Object} RuntimeBudgetOptions
 * @property {number} [expectationsCount=0] - Number of expectations to process
 * @property {string} [mode='default'] - Execution mode: 'default', 'run', 'ci'
 * @property {string} [framework='unknown'] - Detected framework (optional)
 * @property {number|null} [fileCount=null] - Number of files scanned (optional, fallback to expectationsCount)
 */

/**
 * Compute runtime budgets for a VERAX run
 * @param {RuntimeBudgetOptions} [options={}] - Budget computation options
 * @returns {Object} Budget object with phase timeouts
 */
export function computeRuntimeBudget(options = {}) {
  const {
    expectationsCount = 0,
    mode = 'default',
    framework = 'unknown',
    fileCount = null,
  } = options;

  // TEST MODE OVERRIDE: Fixed deterministic budgets for integration tests
  if (process.env.VERAX_TEST_MODE === '1') {
    return {
      totalMaxMs: 30000,          // Hard cap per run
      learnMaxMs: 5000,           // Keep learn bounded
      observeMaxMs: 20000,        // Deterministic observe budget
      detectMaxMs: 5000,          // Bounded detect
      perExpectationMaxMs: 5000,  // Deterministic per-expectation guard
      mode: 'test',
      framework,
      expectationsCount,
      projectSize: fileCount !== null ? fileCount : expectationsCount,
      frameworkMultiplier: 1.0,
    };
  }

  // Use file count if available, otherwise use expectations count as proxy
  const projectSize = fileCount !== null ? fileCount : expectationsCount;

  // Base timeouts (milliseconds)
  // Small project: < 10 expectations/files
  // Medium project: 10-50 expectations/files
  // Large project: > 50 expectations/files

  // Learn phase: file scanning and AST parsing
  const learnBaseMs = mode === 'ci' ? 30000 : 60000; // CI: 30s, default: 60s
  const learnPerFileMs = 50; // 50ms per file
  const learnMaxMs = mode === 'ci' ? 120000 : 300000; // CI: 2min, default: 5min

  // Observe phase: browser automation
  const observeBaseMs = mode === 'ci' ? 60000 : 120000; // CI: 1min, default: 2min
  const observePerExpectationMs = mode === 'ci' ? 2000 : 5000; // CI: 2s, default: 5s per expectation
  const observeMaxMs = mode === 'ci' ? 600000 : 1800000; // CI: 10min, default: 30min

  // Detect phase: analysis and comparison
  const detectBaseMs = mode === 'ci' ? 15000 : 30000; // CI: 15s, default: 30s
  const detectPerExpectationMs = 100; // 100ms per expectation
  const detectMaxMs = mode === 'ci' ? 120000 : 300000; // CI: 2min, default: 5min

  // Per-expectation timeout during observe phase
  const perExpectationBaseMs = mode === 'ci' ? 10000 : 30000; // CI: 10s, default: 30s
  const perExpectationMaxMs = 120000; // 2min max per expectation

  // Framework weighting (some frameworks may need more time)
  let frameworkMultiplier = 1.0;
  if (framework === 'nextjs' || framework === 'remix') {
    frameworkMultiplier = 1.2; // SSR frameworks may need slightly more time
  } else if (framework === 'react' || framework === 'vue') {
    frameworkMultiplier = 1.1; // SPA frameworks
  }

  // Compute phase budgets
  const computedLearnMaxMs = Math.min(
    learnBaseMs + (projectSize * learnPerFileMs * frameworkMultiplier),
    learnMaxMs
  );

  const computedObserveMaxMs = Math.min(
    observeBaseMs + (expectationsCount * observePerExpectationMs * frameworkMultiplier),
    observeMaxMs
  );

  const computedDetectMaxMs = Math.min(
    detectBaseMs + (expectationsCount * detectPerExpectationMs * frameworkMultiplier),
    detectMaxMs
  );

  const computedPerExpectationMaxMs = Math.min(
    perExpectationBaseMs * frameworkMultiplier,
    perExpectationMaxMs
  );

  // Global watchdog timeout (must be >= sum of all phases + buffer)
  // Add 30s buffer for finalization
  const totalMaxMs = Math.max(
    computedLearnMaxMs + computedObserveMaxMs + computedDetectMaxMs + 30000,
    mode === 'ci' ? 900000 : 2400000 // CI: 15min minimum, default: 40min minimum
  );

  // Cap global timeout
  const totalMaxMsCap = mode === 'ci' ? 1800000 : 3600000; // CI: 30min, default: 60min
  const finalTotalMaxMs = Math.min(totalMaxMs, totalMaxMsCap);

  // Ensure minimums are met
  const finalLearnMaxMs = Math.max(computedLearnMaxMs, 10000); // At least 10s
  const finalObserveMaxMs = Math.max(computedObserveMaxMs, 30000); // At least 30s
  const finalDetectMaxMs = Math.max(computedDetectMaxMs, 5000); // At least 5s
  const finalPerExpectationMaxMs = Math.max(computedPerExpectationMaxMs, 5000); // At least 5s

  return {
    totalMaxMs: finalTotalMaxMs,
    learnMaxMs: finalLearnMaxMs,
    observeMaxMs: finalObserveMaxMs,
    detectMaxMs: finalDetectMaxMs,
    perExpectationMaxMs: finalPerExpectationMaxMs,
    mode,
    framework,
    expectationsCount,
    projectSize,
  };
}

/**
 * Create a timeout wrapper that rejects after specified milliseconds
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {Promise} promise - Promise to wrap
 * @param {string} phase - Phase name for error messages
 * @returns {Promise} Promise that rejects on timeout
 */
export function withTimeout(timeoutMs, promise, phase = 'unknown') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Phase timeout: ${phase} exceeded ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

