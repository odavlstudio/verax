/**
 * GAP-007: Deterministic Confidence Calibration
 * 
 * PURPOSE:
 * Refine confidence scores using runtime stability signals to reduce false positives
 * and noisy NEEDS_REVIEW cases without mutating verdicts.
 * 
 * CONSTRAINTS:
 * - Deterministic only (same inputs → same outputs)
 * - No ML, no heuristics scoring
 * - Evidence-based signals only
 * - Verdict type MUST NOT change
 * - Confidence score MAY change (clamped ±0.15 max)
 * - Read-only
 * - Zero config
 * 
 * ALGORITHM:
 * 1. Extract stability signals from observation
 * 2. Calculate adjustment based on deterministic rules
 * 3. Clamp adjustment to ±0.15 max
 * 4. Return calibrated confidence with human-readable reasons
 */

/**
 * Calibrate confidence score based on runtime stability signals
 * 
 * @param {number} originalConfidence - Original confidence score (0-1)
 * @param {Object} observation - Observation data with signals
 * @param {Object} finding - Finding object (for verdict type)
 * @returns {Object} { originalScore, calibratedScore, adjustments[], appliedCalibration }
 */
export function calibrateConfidence(originalConfidence, observation, finding) {
  // Only apply calibration to FAILURE_SILENT or NEEDS_REVIEW verdicts
  const findingType = finding?.type || finding?.judgment || 'unknown';
  const applicableTypes = [
    'FAILURE_SILENT',
    'silent_failure',
    'SILENT_FAILURE',
    'NEEDS_REVIEW',
    'needs_review',
    'SUSPECTED'
  ];
  
  const shouldCalibrate = applicableTypes.some(t => 
    findingType.toLowerCase().includes(t.toLowerCase())
  );
  
  if (!shouldCalibrate) {
    return {
      originalScore: originalConfidence,
      calibratedScore: originalConfidence,
      adjustments: [],
      appliedCalibration: false
    };
  }
  
  // Extract stability signals
  const signals = extractStabilitySignals(observation);
  
  // Calculate adjustment based on deterministic rules
  const adjustment = calculateAdjustment(signals);
  
  // Clamp adjustment to ±0.15 max
  const clampedAdjustment = Math.max(-0.15, Math.min(0.15, adjustment.totalAdjustment));
  
  // Apply adjustment and round to avoid floating point precision issues
  const rawScore = originalConfidence + clampedAdjustment;
  const calibratedScore = Math.round(Math.max(0, Math.min(1, rawScore)) * 1000) / 1000;
  
  // Build adjustment reasons
  const adjustments = buildAdjustmentReasons(adjustment, clampedAdjustment);
  
  // Only apply calibration if we have actual rules applied (not just silence alone)
  const appliedCalibration = adjustment.components.length > 0;
  
  return {
    originalScore: originalConfidence,
    calibratedScore,
    adjustments,
    appliedCalibration
  };
}

/**
 * Extract stability signals from observation
 * 
 * @param {Object} observation - Observation data
 * @returns {Object} Extracted stability signals
 */
function extractStabilitySignals(observation) {
  if (!observation) {
    return {
      hasSilence: false,
      hasStableDom: false,
      hasStableNetwork: false,
      hasNetworkJitter: false,
      hasAdaptiveEvents: false,
      hasLateRender: false,
      domChangeCount: 0,
      networkRequestCount: 0,
      networkFailureCount: 0,
      retryCount: 0,
      silenceDuration: 0
    };
  }
  
  // Extract signals
  const signals = observation.signals || {};
  const networkStatus = observation.networkStatus || {};
  const timing = observation.timing || observation.timings || {};
  const _evidence = observation.evidence || {};
  const comparisons = observation.comparisons || {};
  
  // Silence detection
  const hasSilence = 
    signals.silenceDetected === true ||
    signals.noFeedback === true ||
    (comparisons.urlChanged === false && comparisons.domChanged === false);
  
  // DOM stability: low change count indicates stable DOM
  const domChangeCount = 
    comparisons.domChangeCount ||
    comparisons.mutationCount ||
    signals.domMutationCount ||
    0;
  const hasStableDom = domChangeCount < 5; // Deterministic threshold
  
  // Network stability: successful requests without failures
  const networkRequestCount = networkStatus.totalRequests || 0;
  const networkFailureCount = networkStatus.failedRequests || 0;
  const hasStableNetwork = 
    networkRequestCount > 0 && 
    networkFailureCount === 0;
  
  // Network jitter: multiple failed requests or high failure rate
  const hasNetworkJitter = 
    networkFailureCount > 2 ||
    (networkRequestCount > 0 && (networkFailureCount / networkRequestCount) > 0.3);
  
  // Adaptive events: retry or adaptive stabilization occurred
  const retryCount = 
    observation.retryCount ||
    observation.adaptiveRetries ||
    signals.retryCount ||
    0;
  const hasAdaptiveEvents = 
    retryCount > 0 ||
    observation.adaptiveStabilization === true ||
    signals.adaptiveStabilization === true;
  
  // Late render: significant delay between action and visibility
  const renderDelay = timing.renderDelay || timing.domSettleMs || 0;
  const hasLateRender = renderDelay > 2000; // 2s threshold (deterministic)
  
  // Silence duration (if available)
  const silenceDuration = timing.silenceDuration || timing.waitMs || 0;
  
  return {
    hasSilence,
    hasStableDom,
    hasStableNetwork,
    hasNetworkJitter,
    hasAdaptiveEvents,
    hasLateRender,
    domChangeCount,
    networkRequestCount,
    networkFailureCount,
    retryCount,
    silenceDuration,
    renderDelay
  };
}

/**
 * Calculate confidence adjustment based on stability signals
 * 
 * DETERMINISTIC RULES (examples from requirements):
 * - Stable DOM + stable network + silence → confidence ↑ (+0.10)
 * - High jitter + late render + silence → confidence ↓ (-0.10)
 * - Adaptive events present → confidence ↓ slightly (-0.05)
 * - Silence alone (no other signals) → no adjustment (0)
 * 
 * @param {Object} signals - Extracted stability signals
 * @returns {Object} { totalAdjustment, components }
 */
function calculateAdjustment(signals) {
  let totalAdjustment = 0;
  const components = [];
  
  // Track which rules have fired to avoid conflicts
  let stableDomRuleFired = false;
  let jitterRuleFired = false;
  
  // RULE 1: Stable DOM + Stable Network + Silence → Confidence ↑
  if (signals.hasSilence && signals.hasStableDom && signals.hasStableNetwork) {
    totalAdjustment += 0.10;
    components.push({
      rule: 'stable-environment-with-silence',
      adjustment: +0.10,
      reason: 'Stable DOM and network with silence suggests non-issue'
    });
    stableDomRuleFired = true;
  }
  
  // RULE 2: Network Jitter + Late Render + Silence → Confidence ↓
  if (signals.hasSilence && signals.hasNetworkJitter && signals.hasLateRender) {
    totalAdjustment -= 0.10;
    components.push({
      rule: 'unstable-environment-with-silence',
      adjustment: -0.10,
      reason: 'Network jitter and late render with silence suggests real issue'
    });
    jitterRuleFired = true;
  }
  
  // RULE 3: Adaptive Events Present → Confidence ↓ slightly
  if (signals.hasAdaptiveEvents) {
    totalAdjustment -= 0.05;
    components.push({
      rule: 'adaptive-events-detected',
      adjustment: -0.05,
      reason: `Adaptive events (retries=${signals.retryCount}) suggest instability`
    });
  }
  
  // RULE 4: Silence with Very Stable DOM (< 2 changes) → Confidence ↑ slightly
  // Only if Rule 1 (stable environment) hasn't fired
  if (signals.hasSilence && signals.domChangeCount < 2 && signals.domChangeCount >= 0 && !stableDomRuleFired) {
    totalAdjustment += 0.05;
    components.push({
      rule: 'minimal-dom-changes-with-silence',
      adjustment: +0.05,
      reason: `Very stable DOM (${signals.domChangeCount} changes) with silence`
    });
  }
  
  // RULE 5: High DOM Volatility (> 20 changes) + Silence → Confidence ↑
  // (Indicates active UI updates, silence may be temporary state)
  if (signals.hasSilence && signals.domChangeCount > 20) {
    totalAdjustment += 0.08;
    components.push({
      rule: 'high-dom-activity-with-silence',
      adjustment: +0.08,
      reason: `High DOM activity (${signals.domChangeCount} changes) suggests dynamic UI`
    });
  }
  
  // RULE 6: Network Failures Without Jitter → Confidence ↓ slightly
  // (Isolated failures suggest real issue)
  // Only if jitter rule hasn't fired
  if (signals.networkFailureCount > 0 && !signals.hasNetworkJitter && !jitterRuleFired) {
    totalAdjustment -= 0.05;
    components.push({
      rule: 'isolated-network-failures',
      adjustment: -0.05,
      reason: `Network failures (${signals.networkFailureCount}) suggest connectivity issue`
    });
  }
  
  return {
    totalAdjustment,
    components
  };
}

/**
 * Build human-readable adjustment reasons
 * 
 * @param {Object} adjustment - Adjustment calculation result
 * @param {number} clampedAdjustment - Final clamped adjustment value
 * @returns {Array<string>} Human-readable reasons
 */
function buildAdjustmentReasons(adjustment, clampedAdjustment) {
  const reasons = [];
  
  if (adjustment.components.length === 0) {
    reasons.push('no-calibration-rules-applied');
    return reasons;
  }
  
  // Add component reasons
  for (const component of adjustment.components) {
    const sign = component.adjustment >= 0 ? '+' : '';
    reasons.push(`${component.rule}: ${sign}${component.adjustment.toFixed(3)} (${component.reason})`);
  }
  
  // Add clamping notice if adjustment was clamped
  if (Math.abs(adjustment.totalAdjustment - clampedAdjustment) > 0.001) {
    reasons.push(
      `clamped: total=${adjustment.totalAdjustment.toFixed(3)} → ${clampedAdjustment.toFixed(3)} (±0.15 max)`
    );
  }
  
  return reasons;
}

/**
 * Get calibration statistics from a set of findings
 * 
 * @param {Array} findings - Array of findings with calibration data
 * @returns {Object} Calibration statistics
 */
export function getCalibrationStats(findings) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return {
      totalFindings: 0,
      calibratedCount: 0,
      increasedCount: 0,
      decreasedCount: 0,
      unchangedCount: 0,
      averageAdjustment: 0,
      maxIncrease: 0,
      maxDecrease: 0
    };
  }
  
  let calibratedCount = 0;
  let increasedCount = 0;
  let decreasedCount = 0;
  let unchangedCount = 0;
  let totalAdjustment = 0;
  let maxIncrease = 0;
  let maxDecrease = 0;
  
  for (const finding of findings) {
    const calibration = finding.confidenceCalibration || finding.confidence?.calibration;
    
    // If no calibration metadata, count as unchanged
    if (!calibration) {
      unchangedCount++;
      continue;
    }
    
    const original = calibration.originalScore || 0;
    const calibrated = calibration.calibratedScore || 0;
    const delta = calibrated - original;
    
    if (calibration.appliedCalibration === true) {
      calibratedCount++;
      totalAdjustment += delta;
      
      if (delta > 0.001) {
        increasedCount++;
        maxIncrease = Math.max(maxIncrease, delta);
      } else if (delta < -0.001) {
        decreasedCount++;
        maxDecrease = Math.min(maxDecrease, delta);
      } else {
        unchangedCount++;
      }
    } else {
      unchangedCount++;
    }
  }
  
  // Round values to avoid floating point precision issues
  const roundTo3 = (n) => Math.round(n * 1000) / 1000;
  
  return {
    totalFindings: findings.length,
    calibratedCount,
    increasedCount,
    decreasedCount,
    unchangedCount,
    averageAdjustment: roundTo3(calibratedCount > 0 ? (totalAdjustment / calibratedCount) : 0),
    maxIncrease: roundTo3(maxIncrease),
    maxDecrease: roundTo3(Math.abs(maxDecrease))
  };
}

