/**
 * BUDGET PROFILES
 *
 * Predefined scan budgets for different use cases.
 * Select using VERAX_BUDGET_PROFILE environment variable.
 *
 * Available profiles:
 * - QUICK: 20 seconds, minimal coverage (developer rapid feedback)
 * - STANDARD: 60 seconds, balanced (default CI behavior)
 * - THOROUGH: 120 seconds, deeper coverage (comprehensive validation)
 * - EXHAUSTIVE: 300 seconds, maximum coverage (deep audit)
 */

import { createScanBudget } from './scan-budget.js';

/**
 * QUICK profile: Fast feedback for development
 * - maxScanDurationMs: 20 seconds (vs 60)
 * - maxInteractionsPerPage: 20 (vs 30) 
 * - maxPages: 2 (vs 50)
 * - maxFlows: 1 (vs 3)
 * Recommended for: Local development, PR checks, pre-commit
 */
const QUICK_PROFILE = {
  maxScanDurationMs: 20000,
  maxInteractionsPerPage: 20,
  maxPages: 2,
  maxFlows: 1,
  maxFlowSteps: 3
};

/**
 * STANDARD profile: Balanced coverage (DEFAULT)
 * - maxScanDurationMs: 60 seconds (default)
 * - maxInteractionsPerPage: 30 (default)
 * - maxPages: 50 (default)
 * - maxFlows: 3 (default)
 * Recommended for: CI/CD pipelines, standard regression testing
 */
const STANDARD_PROFILE = {};

/**
 * THOROUGH profile: Deeper coverage for comprehensive validation
 * - maxScanDurationMs: 120 seconds (2x default)
 * - maxInteractionsPerPage: 50 (1.67x default)
 * - maxPages: 50 (unchanged)
 * - maxFlows: 5 (1.67x default)
 * - stabilizationWindowMs: 6000 (2x default for flakiness reduction)
 * - adaptiveStabilization: true (extend settle if DOM/network still changing)
 * Recommended for: Pre-release testing, critical applications
 */
const THOROUGH_PROFILE = {
  maxScanDurationMs: 120000,
  maxInteractionsPerPage: 50,
  maxFlows: 5,
  maxFlowSteps: 7,
  stabilizationWindowMs: 6000,
  adaptiveStabilization: true
};

/**
 * EXHAUSTIVE profile: Maximum coverage for deep audit
 * - maxScanDurationMs: 300 seconds (5x default)
 * - maxInteractionsPerPage: 100 (3.3x default)
 * - maxPages: 50 (unchanged, depth not breadth)
 * - maxFlows: 10 (3.3x default)
 * - stabilizationWindowMs: 8000 (2.67x default for comprehensive stability)
 * - adaptiveStabilization: true (extend settle generously for difficult applications)
 * Recommended for: Security audits, full app validation, non-time-critical analysis
 */
const EXHAUSTIVE_PROFILE = {
  maxScanDurationMs: 300000,
  maxInteractionsPerPage: 100,
  maxFlows: 10,
  maxFlowSteps: 10,
  stabilizationWindowMs: 8000,
  adaptiveStabilization: true
};

const PROFILES = {
  QUICK: QUICK_PROFILE,
  STANDARD: STANDARD_PROFILE,
  THOROUGH: THOROUGH_PROFILE,
  EXHAUSTIVE: EXHAUSTIVE_PROFILE
};

/**
 * Get the active budget profile based on VERAX_BUDGET_PROFILE env var.
 * Defaults to STANDARD if not set.
 * @returns {Object} Profile overrides
 */
export function getActiveBudgetProfile() {
  const profileName = process.env.VERAX_BUDGET_PROFILE || 'STANDARD';
  const profile = PROFILES[profileName.toUpperCase()];
  
  if (!profile) {
    console.warn(
      `Warning: Unknown budget profile '${profileName}'. ` +
      `Available profiles: ${Object.keys(PROFILES).join(', ')}. ` +
      `Defaulting to STANDARD.`
    );
    return STANDARD_PROFILE;
  }
  
  return profile;
}

/**
 * Create a scan budget with the active profile applied.
 * @returns {Object} Complete scan budget with profile applied
 */
export function createScanBudgetWithProfile() {
  const profile = getActiveBudgetProfile();
  return createScanBudget(profile);
}

/**
 * Get profile metadata for logging/debugging.
 * @returns {Object} Profile name and configuration
 */
export function getProfileMetadata() {
  const profileName = process.env.VERAX_BUDGET_PROFILE || 'STANDARD';
  const profile = PROFILES[profileName.toUpperCase()] || STANDARD_PROFILE;
  const budget = createScanBudget(profile);
  
  return {
    name: profileName.toUpperCase(),
    maxScanDurationMs: budget.maxScanDurationMs,
    maxInteractionsPerPage: budget.maxInteractionsPerPage,
    maxPages: budget.maxPages,
    maxFlows: budget.maxFlows,
    maxFlowSteps: budget.maxFlowSteps
  };
}

export { PROFILES };
