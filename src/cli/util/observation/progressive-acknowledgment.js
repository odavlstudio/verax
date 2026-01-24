/**
 * STAGE 3.2: Progressive Acknowledgment Levels
 * 
 * Replace boolean acknowledged with nuanced levels:
 * - NONE: No signals detected
 * - WEAK: Only minor signals (loading, spinner)
 * - PARTIAL: Some required signals, not all
 * - STRONG: All required signals satisfied + stability window met
 * 
 * Designed for promise-aware evaluation
 */

export const ACKNOWLEDGMENT_LEVELS = {
  NONE: 'none',
  WEAK: 'weak',
  PARTIAL: 'partial',
  STRONG: 'strong',
};

/**
 * Calculate acknowledgment level based on observed signals
 * 
 * @typedef {Object} AcknowledgmentResult
 * @property {string} level - NONE|WEAK|PARTIAL|STRONG
 * @property {Array<string>} detectedSignals - Signal names detected
 * @property {number} requiredSignalsSatisfied - Count of required signals present
 * @property {number} requiredSignalsTotal - Count of total required signals
 * @property {number} latencyMs - Time to first signal
 * @property {number} confidence - Numeric [0, 1] confidence in level
 * 
 * @param {Object} signals - Observed signals {signalName: boolean}
 * @param {Object} profile - ObservationProfile with requiredSignals, optionalSignals
 * @param {number} latencyMs - Time from action to first signal
 * @param {boolean} stabilityWindowMet - Whether signal persisted through stability window
 * @returns {AcknowledgmentResult}
 */
export function calculateAcknowledgmentLevel(signals, profile, latencyMs, stabilityWindowMet) {
  if (!signals || !profile) {
    return {
      level: ACKNOWLEDGMENT_LEVELS.NONE,
      detectedSignals: [],
      requiredSignalsSatisfied: 0,
      requiredSignalsTotal: profile?.requiredSignals?.length || 0,
      latencyMs,
      confidence: 0,
    };
  }

  // Collect detected signals
  const allSignals = [...(profile.requiredSignals || []), ...(profile.optionalSignals || [])];
  const detectedSignals = allSignals.filter(sig => signals[sig] === true);

  // Count required signals satisfied
  const detectedRequired = (profile.requiredSignals || []).filter(sig => signals[sig] === true);
  const totalRequired = profile.requiredSignals?.length || 0;

  // Determine level
  let level = ACKNOWLEDGMENT_LEVELS.NONE;
  let confidence = 0;

  if (detectedSignals.length === 0) {
    // No signals at all
    level = ACKNOWLEDGMENT_LEVELS.NONE;
    confidence = 0;
  } else if (detectedRequired.length === 0) {
    // Signals present but none are required (weak acknowledgment)
    level = ACKNOWLEDGMENT_LEVELS.WEAK;
    confidence = 0.3;
  } else if (detectedRequired.length < totalRequired) {
    // Some but not all required signals
    level = ACKNOWLEDGMENT_LEVELS.PARTIAL;
    confidence = detectedRequired.length / totalRequired;
  } else if (detectedRequired.length === totalRequired) {
    // All required signals present
    if (stabilityWindowMet) {
      // Signals persisted through stability window
      level = ACKNOWLEDGMENT_LEVELS.STRONG;
      confidence = 0.95;
    } else {
      // Signals detected but too soon (transient)
      level = ACKNOWLEDGMENT_LEVELS.PARTIAL;
      confidence = 0.6;
    }
  }

  return {
    level,
    detectedSignals,
    requiredSignalsSatisfied: detectedRequired.length,
    requiredSignalsTotal: totalRequired,
    latencyMs,
    confidence: Math.round(confidence * 100) / 100, // Round to 2 decimals
  };
}

/**
 * Classify signal strength relative to promise profile
 * 
 * @param {string} signalName - Name of the signal
 * @param {Object} profile - ObservationProfile
 * @returns {string} 'required'|'optional'|'forbidden'|'unknown'
 */
export function classifySignalStrength(signalName, profile) {
  if (!profile) return 'unknown';

  if (profile.requiredSignals?.includes(signalName)) {
    return 'required';
  }
  if (profile.optionalSignals?.includes(signalName)) {
    return 'optional';
  }
  if (profile.forbiddenSignals?.includes(signalName)) {
    return 'forbidden';
  }
  return 'unknown';
}

/**
 * Determine if acknowledgment level indicates success
 * 
 * @param {string} level - ACKNOWLEDGMENT_LEVELS.*
 * @returns {boolean}
 */
export function isSuccessfulAcknowledgment(level) {
  return level === ACKNOWLEDGMENT_LEVELS.STRONG || level === ACKNOWLEDGMENT_LEVELS.PARTIAL;
}

/**
 * Determine if acknowledgment level is conclusive (not transient)
 * 
 * @param {string} level - ACKNOWLEDGMENT_LEVELS.*
 * @returns {boolean}
 */
export function isConclusiveAcknowledgment(level) {
  return level === ACKNOWLEDGMENT_LEVELS.STRONG;
}

/**
 * Score acknowledgment level for outcome determination
 * 
 * STRONG = 1.0 (definitive success)
 * PARTIAL = 0.6 (probable success)
 * WEAK = 0.2 (low confidence)
 * NONE = 0 (no evidence)
 * 
 * @param {string} level - ACKNOWLEDGMENT_LEVELS.*
 * @returns {number} Score [0, 1]
 */
export function scoreAcknowledgmentLevel(level) {
  const scores = {
    [ACKNOWLEDGMENT_LEVELS.STRONG]: 1.0,
    [ACKNOWLEDGMENT_LEVELS.PARTIAL]: 0.6,
    [ACKNOWLEDGMENT_LEVELS.WEAK]: 0.2,
    [ACKNOWLEDGMENT_LEVELS.NONE]: 0,
  };

  return scores[level] ?? 0;
}
