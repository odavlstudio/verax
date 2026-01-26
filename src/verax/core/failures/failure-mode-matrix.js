/**
 * Failure Mode Matrix
 * Stable mapping: failure cause -> classification -> message.
 * Used to avoid silent downgrades and ensure every failure has exactly one reason.
 */
const FAILURE_MODE_MATRIX = {
  selector_not_found: {
    verdict: 'UNPROVEN',
    reason: 'selector mismatch',
    message: 'Expected element could not be located; promise remains unproven'
  },
  navigation_timeout: {
    verdict: 'INCOMPLETE',
    reason: 'timing_instability',
    message: 'Navigation exceeded stability window; outcome is incomplete'
  },
  interaction_timeout: {
    verdict: 'INCOMPLETE',
    reason: 'timing_instability',
    message: 'Interaction did not settle; behavior unverified'
  },
  settle_timeout: {
    verdict: 'INCOMPLETE',
    reason: 'timing_instability',
    message: 'DOM/network never stabilized; observation incomplete'
  },
  network_blocked: {
    verdict: 'INCOMPLETE',
    reason: 'network_unavailable',
    message: 'Network was blocked or unreachable during observation'
  },
  retry_budget_exhausted: {
    verdict: 'INCOMPLETE',
    reason: 'retry_budget_exhausted',
    message: 'Retry budget consumed without a stable interaction'
  },
  browser_startup_instability: {
    verdict: 'INCOMPLETE',
    reason: 'startup_instability',
    message: 'Browser failed to start reliably; observation aborted to avoid flake'
  },
  sensor_failure: {
    verdict: 'INCOMPLETE',
    reason: 'sensor_failure',
    message: 'Required browser sensor or hook failed; observation incomplete'
  },
  coverage_below_threshold: {
    verdict: 'INCOMPLETE',
    reason: 'coverage_gap',
    message: 'Coverage below configured threshold; observation incomplete by policy'
  },
  partial_attempts: {
    verdict: 'INCOMPLETE',
    reason: 'coverage_gap',
    message: 'Not all expectations were attempted; results are incomplete'
  },
  artifact_validation_failed: {
    verdict: 'INCOMPLETE',
    reason: 'artifact_validation_failed',
    message: 'Artifacts failed validation; outputs considered incomplete to avoid false trust'
  },
  unsupported_framework: {
    verdict: 'INCOMPLETE',
    reason: 'unsupported_framework',
    message: 'Framework is outside the supported envelope; routes marked out of scope'
  }
};

export function resolveFailureMode(cause) {
  return FAILURE_MODE_MATRIX[cause] || {
    verdict: 'INCOMPLETE',
    reason: cause || 'unknown_failure',
    message: 'Unclassified failure; treated as incomplete to avoid false success'
  };
}

const FAILURE_REASON_ALIASES = {
  'observe:timeout': 'interaction_timeout',
  'incomplete:timing_instability': 'interaction_timeout',
  'incomplete:network_unavailable': 'network_blocked',
  'unproven:selector_mismatch': 'selector_not_found',
  'error:transient-net': 'network_blocked',
  'error:sensor-failure': 'sensor_failure',
  'browser:startup-instability': 'browser_startup_instability',
  'browser_not_available': 'browser_startup_instability',
  'coverage_below_threshold': 'coverage_below_threshold',
  'partial_attempts': 'partial_attempts',
  'observation_incomplete': 'interaction_timeout',
  'retry_budget_exhausted': 'retry_budget_exhausted',
  'unsupported_framework': 'unsupported_framework',
  'settle_timeout': 'settle_timeout',
  'navigation_timeout': 'navigation_timeout',
  'interaction_timeout': 'interaction_timeout',
  'network_blocked': 'network_blocked'
};

export function mapFailureReasons(reasons = []) {
  const result = [];
  const seen = new Set();

  for (const raw of reasons) {
    const key = FAILURE_REASON_ALIASES[raw] || raw;
    if (seen.has(key)) continue;
    seen.add(key);
    const mode = resolveFailureMode(key);
    result.push({
      code: key,
      verdict: mode.verdict,
      reason: mode.reason,
      message: mode.message
    });
  }

  return result;
}

/**
 * Apply a matrix entry to a silence entry for consistent output.
 * Mutates and returns the entry for convenience.
 */
export function applyFailureMode(entry, causeKey) {
  const mode = resolveFailureMode(causeKey || entry?.reason);
  if (mode) {
    entry.verdict = mode.verdict;
    entry.reason = mode.reason;
    entry.reasonCode = causeKey || entry.reason;
    entry.message = mode.message;
  }
  return entry;
}

export { FAILURE_MODE_MATRIX };
