/**
 * Configuration Loader
 * 
 * Loads defaults and applies environment variable overrides, then CLI overrides.
 * Priority: CLI > ENV > DEFAULT
 * Produces frozen, immutable config object.
 * 
 * Environment variables supported (legacy compatibility):
 * - VERAX_TEST_MODE: "1" to enable test mode
 * - VERAX_MAX_RETRIES: Override default retry limit
 * - VERAX_MAX_NAVIGATION_DEPTH: Override navigation depth
 * - VERAX_MAX_INTERACTIONS: Override interaction limit
 * 
 * CLI options (overrides environment and defaults):
 * - globalTimeoutMs: Override global timeout
 * - interactionTimeoutMs: Override per-interaction timeout
 * - navigationTimeoutMs: Override navigation timeout
 */

import defaults from './defaults.js';

/**
 * Load configuration with environment overrides and CLI options
 * @param {Object} cliOptions - CLI options { globalTimeoutMs, interactionTimeoutMs, navigationTimeoutMs }
 * @returns {Object} Frozen configuration object
 */
export function loadConfig(cliOptions = {}) {
  // Deep clone defaults to avoid mutation
  const config = {
    timeouts: { ...defaults.TIMEOUTS },
    limits: { 
      ...defaults.LIMITS,
      minPhaseTimeouts: { ...defaults.LIMITS.minPhaseTimeouts },
    },
    frameworkMultipliers: { ...defaults.FRAMEWORK_MULTIPLIERS },
    skipPatterns: [...defaults.SKIP_PATTERNS],
    scanExtensions: [...defaults.SCAN_EXTENSIONS],
  };

  // Apply environment overrides (only for explicitly supported variables)
  if (process.env.VERAX_MAX_RETRIES !== undefined) {
    config.limits.maxRetries = Math.max(0, Number(process.env.VERAX_MAX_RETRIES));
  }

  if (process.env.VERAX_MAX_NAVIGATION_DEPTH !== undefined) {
    config.limits.maxNavigationDepth = Math.max(1, Number(process.env.VERAX_MAX_NAVIGATION_DEPTH));
  }

  if (process.env.VERAX_MAX_INTERACTIONS !== undefined) {
    config.limits.maxInteractions = Math.max(1, Number(process.env.VERAX_MAX_INTERACTIONS));
  }

  // Apply CLI timeout overrides (highest priority)
  // These override both environment variables and defaults
  if (cliOptions.globalTimeoutMs !== undefined) {
    config.cliTimeouts = config.cliTimeouts || {};
    config.cliTimeouts.globalTimeoutMs = cliOptions.globalTimeoutMs;
  }
  
  if (cliOptions.interactionTimeoutMs !== undefined) {
    config.cliTimeouts = config.cliTimeouts || {};
    config.cliTimeouts.interactionTimeoutMs = cliOptions.interactionTimeoutMs;
  }
  
  if (cliOptions.navigationTimeoutMs !== undefined) {
    config.cliTimeouts = config.cliTimeouts || {};
    config.cliTimeouts.navigationTimeoutMs = cliOptions.navigationTimeoutMs;
  }

  // Test mode detection (VERAX_TEST_MODE=1)
  config.testMode = process.env.VERAX_TEST_MODE === '1';

  // Freeze to prevent runtime mutation
  return Object.freeze({
    timeouts: Object.freeze({
      ci: Object.freeze(config.timeouts.ci),
      default: Object.freeze(config.timeouts.default),
      test: Object.freeze(config.timeouts.test),
    }),
    limits: Object.freeze({
      ...config.limits,
      minPhaseTimeouts: Object.freeze(config.limits.minPhaseTimeouts),
    }),
    frameworkMultipliers: Object.freeze(config.frameworkMultipliers),
    skipPatterns: Object.freeze(config.skipPatterns),
    scanExtensions: Object.freeze(config.scanExtensions),
    cliTimeouts: config.cliTimeouts ? Object.freeze(config.cliTimeouts) : undefined,
    testMode: config.testMode,
  });
}

/**
 * Singleton config instance
 */
let configInstance = null;
let lastCliOptions = null;

/**
 * Get configuration singleton
 * @param {Object} cliOptions - Optional CLI options to override defaults
 * @returns {Object} Frozen configuration
 */
export function getConfig(cliOptions = {}) {
  // If CLI options changed or config not yet created, load fresh config
  const optionsChanged = JSON.stringify(lastCliOptions) !== JSON.stringify(cliOptions);
  if (!configInstance || optionsChanged) {
    configInstance = loadConfig(cliOptions);
    lastCliOptions = cliOptions;
  }
  return configInstance;
}

/**
 * Reset config instance (for testing only)
 */
export function resetConfig() {
  configInstance = null;
  lastCliOptions = null;
}








