// @ts-nocheck
/**
 * Gate Preview Formatter (read-only)
 * Converts gate outcome metadata into human-readable summary and recommendations.
 *
 * Inputs: gateOutcome, decisionUsefulness, confidence.level, truthStatus
 * Output: { gate, summary, recommendation }
 *
 * No side effects. Pure mapping only.
 */

function n(v) {
  return v ? String(v).toUpperCase() : null;
}

/**
 * Format a human-readable gate preview from outcome and usefulness signals.
 *
 * @param {Object} params
 * @param {string} params.gateOutcome - 'PASS' | 'WARN' | 'FAIL'
 * @param {string} params.decisionUsefulness - 'IGNORE' | 'INVESTIGATE' | 'FIX' | 'BLOCK'
 * @param {string} params.level - 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
 * @param {string} params.truthStatus - 'CONFIRMED' | 'SUSPECTED' | 'INFORMATIONAL' | 'IGNORED'
 * @returns {Object} { gate, summary, recommendation }
 */
export function formatGatePreview({ gateOutcome = 'PASS', decisionUsefulness = 'IGNORE', level = 'UNKNOWN', truthStatus = null } = {}) {
  const g = n(gateOutcome) || 'PASS';
  const du = n(decisionUsefulness) || 'IGNORE';
  const l = n(level) || 'UNKNOWN';
  const t = n(truthStatus);

  let summary = '';
  let recommendation = '';

  // Gate outcome determines primary message
  if (g === 'FAIL') {
    summary = 'Gate FAIL: Action required';
    if (du === 'BLOCK') {
      recommendation = 'Critical issue detected. Blocking change is required before deployment.';
    } else if (du === 'FIX') {
      recommendation = 'Confirmed finding. Address issue before shipping to production.';
    } else if (t === 'CONFIRMED' && (l === 'HIGH' || l === 'MEDIUM')) {
      recommendation = 'Confirmed finding with significant confidence. Must be resolved before release.';
    } else {
      recommendation = 'Action required. Review finding and apply fix.';
    }
  } else if (g === 'WARN') {
    summary = 'Gate WARN: Review recommended';
    if (du === 'INVESTIGATE') {
      recommendation = 'Suspected issue detected. Investigate before merging or deploying.';
    } else if (t === 'SUSPECTED' && (l === 'HIGH' || l === 'MEDIUM')) {
      recommendation = 'Suspected finding with medium-to-high confidence. Review before release.';
    } else {
      recommendation = 'Non-critical issue. Review and consider fixing.';
    }
  } else {
    // PASS
    summary = 'Gate PASS: No immediate action';
    if (du === 'IGNORE') {
      recommendation = 'No actionable findings. Safe to proceed.';
    } else if (t === 'INFORMATIONAL' || t === 'IGNORED') {
      recommendation = 'Informational only. No action required.';
    } else {
      recommendation = 'Continue monitoring. No blocking issues detected.';
    }
  }

  return {
    gate: g,
    summary,
    recommendation
  };
}
