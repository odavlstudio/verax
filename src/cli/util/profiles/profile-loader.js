/**
 * Profile Loader (PHASE 5.6)
 *
 * Evidence-only time budgets and coverage profiles for CI-friendly execution.
 * Deterministic: same profile + same inputs => identical outputs.
 */

import { UsageError } from '../support/errors.js';

/**
 * Profile definitions
 * All values are evidence-based budget limits, not heuristics
 */
const PROFILES = {
  fast: {
    name: 'fast',
    description: 'Minimum coverage for fast CI feedback',
    maxInteractions: 10,
    maxRuntimeExpectations: 20,
    settleTimeoutMs: 2000,
    outcomeWatcherTimeoutMs: 5000,
    runtimeNavigationBudget: 10,
    shadowDomDepth: 1,
    iframeDepth: 1,
    observePhaseTimeoutMs: 60000, // 1 minute
    detectPhaseTimeoutMs: 30000,  // 30 seconds
  },
  standard: {
    name: 'standard',
    description: 'Balanced coverage and execution time (default)',
    maxInteractions: 50,
    maxRuntimeExpectations: 100,
    settleTimeoutMs: 3000,
    outcomeWatcherTimeoutMs: 10000,
    runtimeNavigationBudget: 50,
    shadowDomDepth: 3,
    iframeDepth: 2,
    observePhaseTimeoutMs: 300000, // 5 minutes
    detectPhaseTimeoutMs: 60000,   // 1 minute
  },
  thorough: {
    name: 'thorough',
    description: 'Maximum coverage for comprehensive analysis',
    maxInteractions: 200,
    maxRuntimeExpectations: 500,
    settleTimeoutMs: 5000,
    outcomeWatcherTimeoutMs: 15000,
    runtimeNavigationBudget: 200,
    shadowDomDepth: 5,
    iframeDepth: 3,
    observePhaseTimeoutMs: 600000, // 10 minutes
    detectPhaseTimeoutMs: 120000,  // 2 minutes
  },
};

const DEFAULT_PROFILE = 'standard';

/**
 * Load profile by name
 * @param {string} profileName - 'fast', 'standard', or 'thorough'
 * @returns {Object} Profile configuration
 * @throws {UsageError} if profile name is invalid
 */
export function loadProfile(profileName) {
  const name = profileName || DEFAULT_PROFILE;
  
  if (!PROFILES[name]) {
    const validNames = Object.keys(PROFILES).join(', ');
    throw new UsageError(`Invalid profile: '${name}'. Valid profiles: ${validNames}`);
  }
  
  return { ...PROFILES[name] };
}

/**
 * Get default profile
 * @returns {Object} Standard profile configuration
 */
export function getDefaultProfile() {
  return loadProfile(DEFAULT_PROFILE);
}

/**
 * List all available profiles
 * @returns {Array<Object>} Array of {name, description} for each profile
 */
export function listProfiles() {
  return Object.values(PROFILES).map(p => ({
    name: p.name,
    description: p.description,
  }));
}

/**
 * Validate profile values (used for programmatic profile overrides)
 * @param {Object} profile - Profile object to validate
 * @returns {boolean} true if valid
 * @throws {UsageError} if invalid
 */
export function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new UsageError('Profile must be an object');
  }
  
  const requiredFields = [
    'maxInteractions',
    'maxRuntimeExpectations',
    'settleTimeoutMs',
    'outcomeWatcherTimeoutMs',
    'runtimeNavigationBudget',
    'shadowDomDepth',
    'iframeDepth',
  ];
  
  for (const field of requiredFields) {
    if (typeof profile[field] !== 'number' || profile[field] < 0) {
      throw new UsageError(`Profile field '${field}' must be a non-negative number`);
    }
  }
  
  return true;
}

/**
 * Apply profile budgets to observe configuration
 * @param {Object} profile - Profile to apply
 * @returns {Object} Observe configuration with budget limits
 */
export function applyProfileToObserveConfig(profile) {
  return {
    maxInteractions: profile.maxInteractions,
    settleTimeoutMs: profile.settleTimeoutMs,
    outcomeWatcherTimeoutMs: profile.outcomeWatcherTimeoutMs,
    runtimeNavigationBudget: profile.maxRuntimeExpectations,
    shadowDomDepth: profile.shadowDomDepth,
    iframeDepth: profile.iframeDepth,
    phaseTimeoutMs: profile.observePhaseTimeoutMs,
  };
}

/**
 * Apply profile budgets to detect configuration
 * @param {Object} profile - Profile to apply
 * @returns {Object} Detect configuration with budget limits
 */
export function applyProfileToDetectConfig(profile) {
  return {
    phaseTimeoutMs: profile.detectPhaseTimeoutMs,
  };
}
