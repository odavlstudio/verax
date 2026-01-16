/**
 * PHASE 21.4 — Confidence Policy Schema
 * 
 * Defines the structure for confidence policies.
 * Truth locks are enforced and cannot be configured away.
 */

/**
 * Confidence Policy Schema
 * 
 * @typedef {Object} ConfidencePolicy
 * @property {string} version - Policy version
 * @property {string} source - 'default' | 'custom'
 * @property {Object} baseScores - Base score configuration
 * @property {Object} thresholds - Threshold configuration
 * @property {Object} weights - Weight configuration for pillars
 * @property {Object} truthLocks - Truth locks (cannot be overridden)
 */

/**
 * Validate confidence policy
 * 
 * @param {Object} policy - Policy to validate
 * @throws {Error} If policy is invalid
 */
export function validateConfidencePolicy(policy) {
  if (!policy) {
    throw new Error('Confidence policy is required');
  }
  
  if (!policy.version || typeof policy.version !== 'string') {
    throw new Error('Confidence policy must have a version string');
  }
  
  // Validate base scores
  if (!policy.baseScores || typeof policy.baseScores !== 'object') {
    throw new Error('Confidence policy must have baseScores object');
  }
  
  // Validate thresholds
  if (!policy.thresholds || typeof policy.thresholds !== 'object') {
    throw new Error('Confidence policy must have thresholds object');
  }
  
  // Validate weights
  if (!policy.weights || typeof policy.weights !== 'object') {
    throw new Error('Confidence policy must have weights object');
  }
  
  // Validate truth locks
  if (!policy.truthLocks || typeof policy.truthLocks !== 'object') {
    throw new Error('Confidence policy must have truthLocks object');
  }
  
  // HARD LOCK: Truth locks cannot be overridden
  const requiredTruthLocks = [
    'evidenceCompleteRequired',
    'nonDeterministicMaxConfidence',
    'guardrailsMaxNegative'
  ];
  
  for (const lock of requiredTruthLocks) {
    if (!(lock in policy.truthLocks)) {
      throw new Error(`Confidence policy must have truth lock: ${lock}`);
    }
  }
  
  // Validate threshold values
  const thresholds = policy.thresholds;
  if (typeof thresholds.high !== 'number' || thresholds.high < 0 || thresholds.high > 1) {
    throw new Error('Confidence policy threshold.high must be a number between 0 and 1');
  }
  
  if (typeof thresholds.medium !== 'number' || thresholds.medium < 0 || thresholds.medium > 1) {
    throw new Error('Confidence policy threshold.medium must be a number between 0 and 1');
  }
  
  if (typeof thresholds.low !== 'number' || thresholds.low < 0 || thresholds.low > 1) {
    throw new Error('Confidence policy threshold.low must be a number between 0 and 1');
  }
  
  // Validate weights sum to reasonable range
  const weights = policy.weights;
  const weightSum = (weights.promiseStrength || 0) + 
                    (weights.observationStrength || 0) + 
                    (weights.correlationQuality || 0) + 
                    (weights.guardrails || 0) + 
                    (weights.evidenceCompleteness || 0);
  
  if (Math.abs(weightSum - 1.0) > 0.01) {
    throw new Error(`Confidence policy weights must sum to approximately 1.0 (got ${weightSum})`);
  }
}

