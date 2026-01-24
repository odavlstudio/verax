/**
 * Test Mode Budget Constants
 * 
 * Provides fixed, deterministic runtime budgets for test mode execution.
 * Ensures integration tests run predictably without timing variance.
 * 
 * @param {Object} options - Budget context
 * @param {string} [options.framework='unknown'] - Detected framework
 * @param {number} [options.expectationsCount=0] - Number of expectations
 * @param {number|null} [options.fileCount=null] - Number of files scanned
 * @returns {Object} Fixed test mode budget configuration
 */
export function getTestModeBudget({ framework = 'unknown', expectationsCount = 0, fileCount = null }) {
  const projectSize = fileCount !== null ? fileCount : expectationsCount;

  return {
    totalMaxMs: 30000,          // Hard cap per run
    learnMaxMs: 5000,           // Keep learn bounded
    observeMaxMs: 20000,        // Deterministic observe budget
    detectMaxMs: 5000,          // Bounded detect
    perExpectationMaxMs: 5000,  // Deterministic per-expectation guard
    mode: 'test',
    framework,
    expectationsCount,
    projectSize,
    frameworkMultiplier: 1.0,
  };
}
