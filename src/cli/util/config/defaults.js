/**
 * Configuration Defaults
 * 
 * CRITICAL: Defaults mirror legacy behavior exactly. Do not change without tests.
 * 
 * This module centralizes all hardcoded configuration values from:
 * - runtime-budget.js (timeouts by mode)
 * - observation-engine.js (limits)
 * - expectation-extractor.js (skip patterns)
 */

/**
 * @typedef {Object} TimeoutDefaults
 * @property {Object} ci - CI mode timeouts
 * @property {Object} default - Default mode timeouts
 * @property {Object} test - Test mode timeouts (VERAX_TEST_MODE=1)
 */

/**
 * Phase timeouts by execution mode (milliseconds)
 * 
 * LEARN: File scanning and AST parsing
 * OBSERVE: Browser automation
 * DETECT: Analysis and comparison
 */
const TIMEOUTS = {
  // CI mode: Faster timeouts for CI environments
  ci: {
    learnBaseMs: 30000,
    learnPerFileMs: 50,
    learnMaxMs: 120000,
    observeBaseMs: 60000,
    observePerExpectationMs: 2000,
    observeMaxMs: 600000,
    detectBaseMs: 15000,
    detectPerExpectationMs: 100,
    detectMaxMs: 120000,
    perExpectationBaseMs: 10000,
    perExpectationMaxMs: 120000,
    totalMinMs: 900000,
    totalMaxMsCap: 1800000,
  },

  // Default mode: Standard timeouts
  default: {
    learnBaseMs: 60000,
    learnPerFileMs: 50,
    learnMaxMs: 300000,
    observeBaseMs: 120000,
    observePerExpectationMs: 5000,
    observeMaxMs: 1800000,
    detectBaseMs: 30000,
    detectPerExpectationMs: 100,
    detectMaxMs: 300000,
    perExpectationBaseMs: 30000,
    perExpectationMaxMs: 120000,
    totalMinMs: 2400000,
    totalMaxMsCap: 3600000,
  },

  // Test mode: Fixed deterministic budgets for integration tests
  test: {
    totalMaxMs: 30000,
    learnMaxMs: 5000,
    observeMaxMs: 20000,
    detectMaxMs: 5000,
    perExpectationMaxMs: 5000,
  },
};

/**
 * Observation limits
 */
const LIMITS = {
  maxNavigationDepth: 2,
  maxInteractions: 25,
  maxRetries: 1,
  minPhaseTimeouts: {
    learnMaxMs: 10000,
    observeMaxMs: 30000,
    detectMaxMs: 5000,
    perExpectationMaxMs: 5000,
  },
  finalizationBufferMs: 30000,
};

/**
 * Framework multipliers for timeout adjustments
 */
const FRAMEWORK_MULTIPLIERS = {
  nextjs: 1.2,
  remix: 1.2,
  react: 1.1,
  vue: 1.1,
  unknown: 1.0,
  default: 1.0,
};

/**
 * Directory skip patterns (exact matches)
 * Order preserved from legacy implementation
 */
const SKIP_PATTERNS = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  '.venv',
  '__pycache__',
  '.env',
  'public',
  '.cache',
  'coverage',
];

/**
 * File extensions to scan
 */
const SCAN_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.html', '.mjs'];

export default {
  TIMEOUTS,
  LIMITS,
  FRAMEWORK_MULTIPLIERS,
  SKIP_PATTERNS,
  SCAN_EXTENSIONS,
};








