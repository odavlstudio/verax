/**
 * STAGE 3.5: Outcome Truth Matrix
 * 
 * Deterministic mapping:
 * (promise.kind × acknowledgment.level × signal profiles × network status × errors)
 * → outcome
 * 
 * Outcomes:
 * - SUCCESS: Strong acknowledgment with expected signals
 * - PARTIAL_SUCCESS: Partial acknowledgment or weak feedback
 * - MISLEADING: Strong signals but error/auth issues present
 * - SILENT_FAILURE: No acknowledgment but errors detected
 * - AMBIGUOUS: Insufficient evidence for definitive outcome
 */

export const OUTCOME_TYPES = {
  SUCCESS: 'success',
  PARTIAL_SUCCESS: 'partial_success',
  MISLEADING: 'misleading',
  SILENT_FAILURE: 'silent_failure',
  AMBIGUOUS: 'ambiguous',
};

/**
 * Determine outcome from acknowledgment and context
 * 
 * @typedef {Object} OutcomeResult
 * @property {string} outcome - OUTCOME_TYPES.*
 * @property {number} confidence - [0, 1] confidence in outcome
 * @property {string} reasoning - Explanation of how outcome was determined
 * @property {string[]} signals_present - Which signals triggered this outcome
 * @property {string[]} warnings - Caveats or concerns about the outcome
 * 
 * @param {Object} evaluation - Evaluation context
 * @property {Object} evaluation.acknowledgment - Result from calculateAcknowledgmentLevel
 * @property {string} evaluation.promiseKind - Kind of promise
 * @property {Object} evaluation.networkStatus - Network activity
 * @property {Object} evaluation.errors - Collected errors
 * @property {boolean} evaluation.stabilityWindowMet - Stability check passed
 * @property {string} evaluation.silenceKind - Classification if no acknowledgment
 * @property {Object} evaluation.signals - Raw observed signals
 * 
 * @returns {OutcomeResult}
 */
export function determineOutcome(evaluation) {
  if (!evaluation) {
    return {
      outcome: OUTCOME_TYPES.AMBIGUOUS,
      confidence: 0,
      reasoning: 'No evaluation context provided',
      signals_present: [],
      warnings: ['missing-evaluation-context'],
    };
  }

  const {
    acknowledgment = {},
    promiseKind = 'unknown',
    networkStatus = {},
    errors = [],
    stabilityWindowMet = false,
    silenceKind = null,
    signals: _signals = {},
  } = evaluation;

  const level = acknowledgment.level || 'none';
  const detectedSignals = acknowledgment.detectedSignals || [];

  // Hard error rules (always failure)
  if (hasHardError(errors, promiseKind)) {
    return {
      outcome: OUTCOME_TYPES.SILENT_FAILURE,
      confidence: 0.95,
      reasoning: 'Hard error detected (console error, network 5xx, etc.)',
      signals_present: detectedSignals,
      warnings: getErrorWarnings(errors),
    };
  }

  // Strong acknowledgment rules
  if (level === 'strong') {
    // All signals present and stability met
    if (stabilityWindowMet) {
      // Check for misleading patterns (200 OK but error message shown)
      if (isMisleadingPattern(evaluation)) {
        return {
          outcome: OUTCOME_TYPES.MISLEADING,
          confidence: 0.8,
          reasoning: 'Acknowledgment signals present but error indicators conflict',
          signals_present: detectedSignals,
          warnings: ['error-with-ui-feedback', 'contradictory-signals'],
        };
      }

      // Clean success
      return {
        outcome: OUTCOME_TYPES.SUCCESS,
        confidence: 0.95,
        reasoning: 'Strong acknowledgment with required signals stable through window',
        signals_present: detectedSignals,
        warnings: [],
      };
    } else {
      // Signals present but too early (transient)
      return {
        outcome: OUTCOME_TYPES.AMBIGUOUS,
        confidence: 0.5,
        reasoning: 'Strong signals detected but stability window not met yet',
        signals_present: detectedSignals,
        warnings: ['transient-signals', 'stability-window-pending'],
      };
    }
  }

  // Partial acknowledgment rules
  if (level === 'partial') {
    // Some required signals present
    if (stabilityWindowMet && isMeaningfulPartial(evaluation)) {
      return {
        outcome: OUTCOME_TYPES.PARTIAL_SUCCESS,
        confidence: 0.6,
        reasoning: 'Some required signals present and stable',
        signals_present: detectedSignals,
        warnings: ['incomplete-signals', 'partial-acknowledgment'],
      };
    }

    // Weak partial (might be false-green)
    return {
      outcome: OUTCOME_TYPES.AMBIGUOUS,
      confidence: 0.3,
      reasoning: 'Partial signals detected but insufficient for definitive outcome',
      signals_present: detectedSignals,
      warnings: ['weak-partial', 'might-be-false-green'],
    };
  }

  // Weak acknowledgment rules
  if (level === 'weak') {
    // Just loading spinner?
    if (detectedSignals.length > 0 && isLoadingOnlySignals(detectedSignals)) {
      return {
        outcome: OUTCOME_TYPES.AMBIGUOUS,
        confidence: 0.2,
        reasoning: 'Only loading indicators detected, insufficient for outcome',
        signals_present: detectedSignals,
        warnings: ['loading-only', 'no-substantive-feedback'],
      };
    }

    return {
      outcome: OUTCOME_TYPES.AMBIGUOUS,
      confidence: 0.2,
      reasoning: 'Weak signals detected',
      signals_present: detectedSignals,
      warnings: ['weak-acknowledgment'],
    };
  }

  // No acknowledgment (silence)
  if (level === 'none') {
    // Check for server-side-only success
    if (networkStatus.lastResponseStatus >= 200 && networkStatus.lastResponseStatus < 300) {
      if (silenceKind === 'server_side_only') {
        return {
          outcome: OUTCOME_TYPES.PARTIAL_SUCCESS,
          confidence: 0.7,
          reasoning: 'Network request succeeded but no client-side acknowledgment',
          signals_present: [],
          warnings: ['server-side-only', 'no-ui-feedback'],
        };
      }
    }

    // Check for auth blocking
    if (silenceKind === 'blocked_by_auth') {
      return {
        outcome: OUTCOME_TYPES.SILENT_FAILURE,
        confidence: 0.85,
        reasoning: 'Authentication required',
        signals_present: [],
        warnings: ['auth-required', 'authentication-needed'],
      };
    }

    // Check for network timeout
    if (silenceKind === 'network_timeout') {
      return {
        outcome: OUTCOME_TYPES.SILENT_FAILURE,
        confidence: 0.85,
        reasoning: 'Network request timed out',
        signals_present: [],
        warnings: ['network-timeout', 'request-not-completed'],
      };
    }

    // Check for UI render failure
    if (silenceKind === 'ui_render_failure') {
      return {
        outcome: OUTCOME_TYPES.SILENT_FAILURE,
        confidence: 0.8,
        reasoning: 'Request succeeded but UI failed to render',
        signals_present: [],
        warnings: ['render-error', 'ui-update-failed'],
      };
    }

    // Default silence: ambiguous or failure depending on promise kind
    const defaultForKind = isRequiredToHaveUI(promiseKind)
      ? OUTCOME_TYPES.SILENT_FAILURE
      : OUTCOME_TYPES.AMBIGUOUS;

    return {
      outcome: defaultForKind,
      confidence: silenceKind === 'true_silence' ? 0.8 : 0.5,
      reasoning: `No acknowledgment detected. Silence kind: ${silenceKind}`,
      signals_present: [],
      warnings: [silenceKind || 'true_silence', 'no-observable-change'],
    };
  }

  // Fallback
  return {
    outcome: OUTCOME_TYPES.AMBIGUOUS,
    confidence: 0,
    reasoning: 'Unable to determine outcome',
    signals_present: detectedSignals,
    warnings: ['indeterminate-outcome'],
  };
}

/**
 * Check if evaluation contains hard error indicators
 */
function hasHardError(errors, _promiseKind = 'unknown') {
  if (!errors || errors.length === 0) return false;

  // Network errors
  const networkErrors = errors.filter(e =>
    e.toLowerCase().includes('network') ||
    e.toLowerCase().includes('fetch failed') ||
    e.toLowerCase().includes('econnrefused') ||
    e.toLowerCase().includes('timeout')
  );
  if (networkErrors.length > 0) return true;

  // JavaScript errors
  const jsErrors = errors.filter(e =>
    e.toLowerCase().includes('error') ||
    e.toLowerCase().includes('exception') ||
    e.toLowerCase().includes('undefined')
  );
  if (jsErrors.length > 0) return true;

  return false;
}

/**
 * Get warnings from error list
 */
function getErrorWarnings(errors) {
  const warnings = [];

  (errors || []).forEach(err => {
    if (err.toLowerCase().includes('network')) warnings.push('network-error');
    if (err.toLowerCase().includes('timeout')) warnings.push('timeout-error');
    if (err.toLowerCase().includes('auth')) warnings.push('auth-error');
    if (err.toLowerCase().includes('5')) warnings.push('server-error');
  });

  return [...new Set(warnings)]; // Deduplicate
}

/**
 * Check if signals are misleading (UI shows success but errors present)
 */
function isMisleadingPattern(evaluation) {
  const { signals = {}, errors = [], networkStatus = {} } = evaluation;

  // Check for success UI with error status
  if (signals.successMessageAppeared && networkStatus.lastResponseStatus >= 400) {
    return true;
  }

  // Check for UI feedback but console errors
  if (signals.feedbackAppeared && errors.length > 0) {
    return true;
  }

  // Check for success message but API error
  if (signals.successMessageAppeared && networkStatus.apiErrorDetected) {
    return true;
  }

  return false;
}

/**
 * Check if partial acknowledgment is meaningful
 */
function isMeaningfulPartial(evaluation) {
  const { acknowledgment = {} } = evaluation;
  const { requiredSignalsSatisfied = 0, requiredSignalsTotal = 1 } = acknowledgment;

  // At least 50% of required signals should be present
  return requiredSignalsSatisfied >= requiredSignalsTotal * 0.5;
}

/**
 * Check if signals are only loading indicators
 */
function isLoadingOnlySignals(signals) {
  const loadingSignals = ['loadingStarted', 'loadingSpinner', 'progressBar', 'skeletonLoader'];
  return signals.every(sig => loadingSignals.includes(sig));
}

/**
 * Check if promise kind requires UI feedback
 */
function isRequiredToHaveUI(promiseKind) {
  const requireUI = [
    'feedback.toast',
    'feedback.modal',
    'feedback.notification',
    'state',
    'state.redux',
    'state.zustand',
    'state.react',
  ];

  return requireUI.includes(promiseKind);
}

/**
 * Score outcome for comparison
 * 
 * SUCCESS: 1.0
 * PARTIAL_SUCCESS: 0.6
 * AMBIGUOUS: 0.3
 * MISLEADING: 0.2
 * SILENT_FAILURE: 0
 * 
 * @param {string} outcome - OUTCOME_TYPES.*
 * @returns {number} Score [0, 1]
 */
export function scoreOutcome(outcome) {
  const scores = {
    [OUTCOME_TYPES.SUCCESS]: 1.0,
    [OUTCOME_TYPES.PARTIAL_SUCCESS]: 0.6,
    [OUTCOME_TYPES.AMBIGUOUS]: 0.3,
    [OUTCOME_TYPES.MISLEADING]: 0.2,
    [OUTCOME_TYPES.SILENT_FAILURE]: 0,
  };

  return scores[outcome] ?? 0;
}

/**
 * Determine if outcome is successful
 */
export function isSuccessfulOutcome(outcome) {
  return outcome === OUTCOME_TYPES.SUCCESS || outcome === OUTCOME_TYPES.PARTIAL_SUCCESS;
}

/**
 * Determine if outcome is definitive (not ambiguous)
 */
export function isDefinitiveOutcome(outcome) {
  return outcome !== OUTCOME_TYPES.AMBIGUOUS;
}

/**
 * Get human-readable outcome explanation
 */
export function explainOutcome(outcome) {
  const explanations = {
    [OUTCOME_TYPES.SUCCESS]: 'Promise executed successfully with full acknowledgment',
    [OUTCOME_TYPES.PARTIAL_SUCCESS]: 'Promise partially executed or acknowledged incompletely',
    [OUTCOME_TYPES.MISLEADING]: 'UI shows success but error signals detected (misleading outcome)',
    [OUTCOME_TYPES.SILENT_FAILURE]: 'Promise execution failed with no observable acknowledgment',
    [OUTCOME_TYPES.AMBIGUOUS]: 'Insufficient evidence to determine outcome',
  };

  return explanations[outcome] || 'Unknown outcome';
}
