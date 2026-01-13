/**
 * SILENCE IMPACT ACCOUNTING
 * 
 * PHASE 4: Quantify how silence (unobserved/unevaluated states) affects confidence in our observations.
 * 
 * PRINCIPLES:
 * 1. Silence is never neutral - it reduces confidence in what we claim to observe
 * 2. Different types of silence have different confidence impacts
 * 3. Aggregate impacts show what confidence metric is weakened and by how much
 * 4. Confidence impact is ALWAYS negative (silence cannot increase confidence)
 * 5. Impacts are factual: based on type/scope, not on hypothetical outcomes
 * 
 * Three confidence metrics affected by silence:
 * - Coverage Confidence: How much of the codebase did we actually observe?
 * - Promise Verification Confidence: How certain are we about promise verification?
 * - Overall Observation Confidence: General confidence in observation completeness
 */

import { SILENCE_TYPES, EVALUATION_STATUS } from './silence-model.js';

/**
 * SILENCE_IMPACT_PROFILES - How different silence types affect confidence
 * 
 * Each profile defines the impact on three confidence dimensions.
 * All values are NEGATIVE (silence reduces confidence).
 */
export const SILENCE_IMPACT_PROFILES = {
  // Observation Infrastructure Failures - CRITICAL
  // Sensor failure means we lost observability entirely for that area
  [SILENCE_TYPES.SENSOR_FAILURE]: {
    name: 'Sensor Failure',
    severity: 'critical',
    coverage: -20,              // Major reduction: lost observability
    promise_verification: -15,  // Cannot verify promises without observation
    overall: -18,               // Very high impact
    reasoning: 'Observation infrastructure failure - no data collected for affected area'
  },
  
  [SILENCE_TYPES.DISCOVERY_FAILURE]: {
    name: 'Discovery Failure',
    severity: 'critical',
    coverage: -15,              // Major reduction: didn't find items to evaluate
    promise_verification: -10,  // Unknown what promises existed
    overall: -13,               // Very high impact
    reasoning: 'Could not discover items - evaluation incomplete for unknown scope'
  },

  // Timing Failures - HIGH
  // Timeouts mean interaction couldn't complete, promise unverified
  [SILENCE_TYPES.NAVIGATION_TIMEOUT]: {
    name: 'Navigation Timeout',
    severity: 'high',
    coverage: -10,              // Moderate reduction: page not reachable
    promise_verification: -20,  // Complete failure for navigation promise
    overall: -15,               // High impact
    reasoning: 'Navigation could not complete - route unreachable or page unresponsive'
  },
  
  [SILENCE_TYPES.INTERACTION_TIMEOUT]: {
    name: 'Interaction Timeout',
    severity: 'high',
    coverage: -8,               // Moderate reduction
    promise_verification: -18,  // Interaction promise verification failed
    overall: -13,               // High impact
    reasoning: 'Interaction did not complete within time budget - outcome unknown'
  },

  // Policy-Blocked Evaluation - MEDIUM
  // Safety blocks prevent evaluation, but promise is known to exist
  [SILENCE_TYPES.SAFETY_POLICY_BLOCK]: {
    name: 'Safety Policy Block',
    severity: 'medium',
    coverage: -3,               // Low reduction: coverage by skipping is intentional
    promise_verification: -25,  // Critical: promise cannot be verified due to safety policy
    overall: -12,               // Medium-high impact
    reasoning: 'Promise verification blocked by safety policy (logout, destructive action) - cannot assert promise due to risk'
  },

  [SILENCE_TYPES.PROMISE_VERIFICATION_BLOCKED]: {
    name: 'Promise Verification Blocked',
    severity: 'medium',
    coverage: -2,               // Very low reduction: blocked verification only
    promise_verification: -22,  // Cannot verify due to external navigation or origin mismatch
    overall: -10,               // Medium impact
    reasoning: 'Promise verification blocked - navigation leaves origin or enters external site'
  },

  // Resource Constraints - MEDIUM
  // Budget limits mean we didn't finish evaluation
  [SILENCE_TYPES.BUDGET_LIMIT_EXCEEDED]: {
    name: 'Budget Limit Exceeded',
    severity: 'medium',
    coverage: -12,              // Moderate reduction: didn't evaluate all items
    promise_verification: -8,   // Some promises verified, others not
    overall: -10,               // Medium impact
    reasoning: 'Evaluation terminated due to time/interaction budget - remaining items not evaluated'
  },

  // Data Reuse - LOW
  // Incremental reuse is safe by design (previous run passed)
  [SILENCE_TYPES.INCREMENTAL_REUSE]: {
    name: 'Incremental Reuse',
    severity: 'low',
    coverage: 0,                // No impact: explicitly reusing validated baseline
    promise_verification: 0,    // Verified in previous run
    overall: 0,                 // Intentional optimization
    reasoning: 'Data from previous run reused - baseline still valid'
  },

  // Ambiguous/Incomplete - LOW
  // No expectation defined = no promise to verify anyway
  [SILENCE_TYPES.PROMISE_NOT_EVALUATED]: {
    name: 'Promise Not Evaluated',
    severity: 'low',
    coverage: 0,                // No impact: covered but no expectation
    promise_verification: -2,   // Minor: cannot assert promise without expectation
    overall: -1,                // Minimal impact
    reasoning: 'Interaction found but no expectation defined - cannot verify promise'
  },
};

/**
 * Compute confidence impact for a single silence entry
 * 
 * @param {Object} silence - SilenceEntry with silence_type, evaluation_status, context
 * @returns {Object} Impact: { coverage: number, promise_verification: number, overall: number }
 */
export function computeSilenceImpact(silence) {
  if (!silence) {
    return { coverage: 0, promise_verification: 0, overall: 0 };
  }

  const profile = SILENCE_IMPACT_PROFILES[silence.silence_type];
  
  if (!profile) {
    // Unknown silence type - be conservative
    return {
      coverage: -5,
      promise_verification: -5,
      overall: -5,
      unknown_type: silence.silence_type
    };
  }

  // Start with base profile
  let impact = {
    coverage: profile.coverage,
    promise_verification: profile.promise_verification,
    overall: profile.overall
  };

  // Adjust for evaluation status (some statuses are worse than others)
  if (silence.evaluation_status === EVALUATION_STATUS.BLOCKED) {
    // Blocked state: intentional, but still reduces confidence
    // Slightly less impact than timeout
    impact.promise_verification = Math.max(-20, impact.promise_verification + 2);
  } else if (silence.evaluation_status === EVALUATION_STATUS.TIMED_OUT) {
    // Timed out: worse than blocked (unintentional failure)
    impact.promise_verification = Math.min(-25, impact.promise_verification - 2);
  } else if (silence.evaluation_status === EVALUATION_STATUS.AMBIGUOUS) {
    // Ambiguous: cannot assert but also didn't try
    impact.promise_verification = Math.max(-5, impact.promise_verification + 3);
  }

  // Clamp to reasonable ranges
  impact.coverage = Math.max(-100, impact.coverage);
  impact.promise_verification = Math.max(-100, impact.promise_verification);
  impact.overall = Math.max(-100, impact.overall);

  return impact;
}

/**
 * Aggregate impacts from multiple silences
 * 
 * RULE: Impacts are cumulative but clamped at -100 (cannot be worse than complete loss)
 * 
 * @param {Array} silences - Array of SilenceEntry objects
 * @returns {Object} Aggregated impact with clamping
 */
export function aggregateSilenceImpacts(silences) {
  const total = {
    coverage: 0,
    promise_verification: 0,
    overall: 0
  };

  if (!silences || silences.length === 0) {
    return total;
  }

  for (const silence of silences) {
    const impact = computeSilenceImpact(silence);
    total.coverage += impact.coverage;
    total.promise_verification += impact.promise_verification;
    total.overall += impact.overall;
  }

  // Clamp to -100 to 0 range
  return {
    coverage: Math.max(-100, total.coverage),
    promise_verification: Math.max(-100, total.promise_verification),
    overall: Math.max(-100, total.overall)
  };
}

/**
 * Categorize impacts by severity
 * 
 * @param {Array} silences - Array of SilenceEntry objects
 * @returns {Object} Impacts organized by severity
 */
export function categorizeSilencesByImpactSeverity(silences) {
  const critical = [];
  const high = [];
  const medium = [];
  const low = [];

  if (!silences) return { critical, high, medium, low };

  for (const silence of silences) {
    const profile = SILENCE_IMPACT_PROFILES[silence.silence_type];
    if (!profile) {
      high.push(silence); // Default to high for unknown types
      continue;
    }

    switch (profile.severity) {
      case 'critical':
        critical.push(silence);
        break;
      case 'high':
        high.push(silence);
        break;
      case 'medium':
        medium.push(silence);
        break;
      case 'low':
        low.push(silence);
        break;
    }
  }

  return { critical, high, medium, low };
}

/**
 * Compute impact summary for output
 * 
 * Shows:
 * - Total impact by dimension
 * - Most impactful silence types
 * - Silences affecting each dimension
 * 
 * @param {Array} silences - Array of SilenceEntry objects
 * @returns {Object} Detailed impact summary
 */
export function createImpactSummary(silences) {
  if (!silences || silences.length === 0) {
    return {
      total_silences: 0,
      aggregated_impact: { coverage: 0, promise_verification: 0, overall: 0 },
      by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
      most_impactful_types: [],
      affected_dimensions: {
        coverage: [],
        promise_verification: [],
        overall: []
      }
    };
  }

  const aggregated = aggregateSilenceImpacts(silences);
  const bySeverity = categorizeSilencesByImpactSeverity(silences);

  // Find most impactful types
  const typeImpacts = {};
  for (const silence of silences) {
    const impact = computeSilenceImpact(silence);
    if (!typeImpacts[silence.silence_type]) {
      typeImpacts[silence.silence_type] = { count: 0, total_impact: 0 };
    }
    typeImpacts[silence.silence_type].count++;
    typeImpacts[silence.silence_type].total_impact += impact.overall;
  }

  const mostImpactful = Object.entries(typeImpacts)
    .map(([type, data]) => ({
      type,
      count: data.count,
      average_impact: Math.round(data.total_impact / data.count),
      total_impact: data.total_impact
    }))
    .sort((a, b) => a.total_impact - b.total_impact)
    .slice(0, 5);

  // Find silences affecting each dimension most
  const affectedDimensions = {
    coverage: silences
      .filter(s => computeSilenceImpact(s).coverage < 0)
      .sort((a, b) => computeSilenceImpact(a).coverage - computeSilenceImpact(b).coverage)
      .slice(0, 3)
      .map(s => s.silence_type),
    promise_verification: silences
      .filter(s => computeSilenceImpact(s).promise_verification < 0)
      .sort((a, b) => computeSilenceImpact(a).promise_verification - computeSilenceImpact(b).promise_verification)
      .slice(0, 3)
      .map(s => s.silence_type),
    overall: silences
      .filter(s => computeSilenceImpact(s).overall < 0)
      .sort((a, b) => computeSilenceImpact(a).overall - computeSilenceImpact(b).overall)
      .slice(0, 3)
      .map(s => s.silence_type)
  };

  return {
    total_silences: silences.length,
    aggregated_impact: aggregated,
    by_severity: {
      critical: bySeverity.critical.length,
      high: bySeverity.high.length,
      medium: bySeverity.medium.length,
      low: bySeverity.low.length
    },
    most_impactful_types: mostImpactful,
    affected_dimensions: affectedDimensions,
    confidence_interpretation: generateConfidenceInterpretation(aggregated)
  };
}

/**
 * Generate human-readable interpretation of confidence impacts
 * 
 * @param {Object} aggregated - Aggregated impact object
 * @returns {string} Human-readable interpretation
 */
function generateConfidenceInterpretation(aggregated) {
  const { coverage: _coverage, promise_verification: _promise_verification, overall } = aggregated;

  if (overall === 0) {
    return 'No silence events - observation confidence is complete within evaluated scope';
  }

  if (overall <= -80) {
    return 'CRITICAL: Observation significantly incomplete - major silence events limit what we can assert';
  }

  if (overall <= -50) {
    return 'SIGNIFICANT: Multiple silence events reduce observation confidence - substantial unknowns remain';
  }

  if (overall <= -25) {
    return 'MODERATE: Some silence events reduce observation completeness - some unknowns remain';
  }

  if (overall <= -10) {
    return 'MINOR: Few silence events slightly reduce confidence - observation mostly complete';
  }

  return 'Very minor impact from silence events';
}

export default {
  SILENCE_IMPACT_PROFILES,
  computeSilenceImpact,
  aggregateSilenceImpacts,
  categorizeSilencesByImpactSeverity,
  createImpactSummary
};
