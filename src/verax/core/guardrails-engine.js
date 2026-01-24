/**
 * PHASE 21.4 — Guardrails Engine (Policy-Driven)
 * 
 * Central guardrails engine that prevents false CONFIRMED findings
 * by enforcing policy-driven rules.
 * 
 * All rules are mandatory and cannot be disabled.
 */

import { GUARDRAILS_RULE } from './guardrails/policy.defaults.js';
import { applyGuardrails as _applyGuardrails } from './guardrails-engine/apply-guardrails.js';

// Re-export for backward compatibility
export { GUARDRAILS_RULE };

/**
 * PHASE 17: Guardrails Severity Levels
 */
export const GUARDRAILS_SEVERITY = {
  BLOCK_CONFIRMED: 'BLOCK_CONFIRMED',  // Prevents CONFIRMED status
  DOWNGRADE: 'DOWNGRADE',              // Recommends downgrade
  INFORMATIONAL: 'INFORMATIONAL',       // Makes finding informational
  DROP: 'DROP',                         // Recommends dropping finding
  WARNING: 'WARNING',                   // Warning only, no status change
};

// Policy cache moved to internal module; behavior unchanged

/**
 * PHASE 21.4: Apply guardrails to a finding using policy
 * 
 * @param {Object} finding - Finding object
 * @param {Object} context - Context including evidencePackage, signals, confidenceReasons, promise type
 * @param {Object} options - Options { policyPath, projectDir }
 * @returns {Object} { finding: updatedFinding, guardrails: report }
 */
export function applyGuardrails(finding, context = {}, options = {}) {
  return _applyGuardrails(finding, context, options);
}

/**
 * Map policy action to severity
 */
// Mapping moved internal; behavior unchanged

/**
 * Evaluate a guardrails rule
 * 
 * @param {Object} rule - Policy rule
 * @param {Object} finding - Finding object
 * @param {Object} signals - Sensor signals
 * @param {Object} evidencePackage - Evidence package
 * @returns {Object} { applies, message, contradiction, recommendedStatus }
 */
// Rule evaluators moved internal; behavior unchanged

/**
 * Rule 1: GUARD_NET_SUCCESS_NO_UI
 */
function _evaluateNetSuccessNoUi(finding, signals, evidencePackage, isConfirmed) {
  const networkSignals = signals.network || {};
  const uiSignals = signals.uiSignals || {};
  const uiFeedback = signals.uiFeedback || {};
  
  const hasNetworkSuccess = networkSignals.successfulRequests > 0 && 
                            networkSignals.failedRequests === 0;
  const hasNoUiChange = !uiSignals.changed && 
                        (!uiFeedback.overallUiFeedbackScore || uiFeedback.overallUiFeedbackScore < 0.3);
  const hasNoErrors = !networkSignals.failedRequests && 
                      (!signals.console || signals.console.errorCount === 0);
  
  const isSilentFailure = finding.type?.includes('silent_failure') || 
                          finding.type?.includes('network');
  
  if (hasNetworkSuccess && hasNoUiChange && hasNoErrors && isSilentFailure && isConfirmed) {
    return {
      applies: true,
      message: 'Network request succeeded but no UI change observed. This is not a silent failure.',
      contradiction: true,
      recommendedStatus: 'SUSPECTED',
    };
  }
  
  return { applies: false };
}

/**
 * Rule 2: GUARD_ANALYTICS_ONLY
 */
function _evaluateAnalyticsOnly(finding, signals, evidencePackage, isConfirmed) {
  const networkSignals = signals.network || {};
  const networkRequests = networkSignals.topFailedUrls || 
                          networkSignals.observedRequestUrls || 
                          [];
  
  const isAnalyticsOnly = networkRequests.some(url => {
    if (!url || typeof url !== 'string') return false;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('/analytics') ||
           lowerUrl.includes('/beacon') ||
           lowerUrl.includes('/tracking') ||
           lowerUrl.includes('/pixel') ||
           lowerUrl.includes('google-analytics') ||
           lowerUrl.includes('segment.io') ||
           lowerUrl.includes('mixpanel');
  });
  
  const isNetworkFinding = finding.type?.includes('network') || 
                           finding.type?.includes('silent_failure');
  
  if (isAnalyticsOnly && isNetworkFinding && isConfirmed && networkRequests.length === 1) {
    return {
      applies: true,
      message: 'Only analytics/beacon requests detected. These are not user promises.',
      contradiction: true,
      recommendedStatus: 'INFORMATIONAL',
    };
  }
  
  return { applies: false };
}

/**
 * Rule 3: GUARD_SHALLOW_ROUTING
 */
function _evaluateShallowRouting(finding, signals, evidencePackage, isConfirmed) {
  const navigationSignals = signals.navigation || {};
  const beforeUrl = evidencePackage.before?.url || '';
  const afterUrl = evidencePackage.after?.url || '';
  
  const isHashOnly = beforeUrl && afterUrl && 
                     beforeUrl.split('#')[0] === afterUrl.split('#')[0] &&
                     (beforeUrl.includes('#') || afterUrl.includes('#'));
  const isShallowRouting = navigationSignals.shallowRouting === true && 
                           !navigationSignals.urlChanged;
  
  const isNavigationFinding = finding.type?.includes('navigation') || 
                              finding.type?.includes('route');
  
  if ((isHashOnly || isShallowRouting) && isNavigationFinding && isConfirmed) {
    return {
      applies: true,
      message: 'Hash-only or shallow routing detected. Cannot confirm navigation without route intelligence verification.',
      contradiction: true,
      recommendedStatus: 'SUSPECTED',
    };
  }
  
  return { applies: false };
}

/**
 * Rule 4: GUARD_UI_FEEDBACK_PRESENT
 */
function _evaluateUiFeedbackPresent(finding, signals, evidencePackage, isConfirmed) {
  const uiFeedback = signals.uiFeedback || {};
  const uiSignals = signals.uiSignals || {};
  
  const hasFeedback = (uiFeedback.overallUiFeedbackScore || 0) > 0.5 ||
                      uiSignals.hasLoadingIndicator ||
                      uiSignals.hasDialog ||
                      uiSignals.hasErrorSignal ||
                      uiSignals.changed;
  
  const isSilentFailure = finding.type?.includes('silent_failure') || 
                          finding.type?.includes('feedback_missing');
  
  if (hasFeedback && isSilentFailure && isConfirmed) {
    return {
      applies: true,
      message: 'UI feedback is present. This contradicts a silent failure claim.',
      contradiction: true,
      recommendedStatus: 'SUSPECTED',
    };
  }
  
  return { applies: false };
}

/**
 * Rule 5: GUARD_INTERACTION_BLOCKED
 */
function _evaluateInteractionBlocked(finding, signals, evidencePackage, isConfirmed) {
  const interaction = finding.interaction || {};
  const action = evidencePackage.action || {};
  
  const isDisabled = interaction.disabled === true ||
                     action.interaction?.disabled === true ||
                     finding.evidence?.interactionBlocked === true;
  
  const isSilentFailure = finding.type?.includes('silent_failure');
  
  if (isDisabled && isSilentFailure && isConfirmed) {
    return {
      applies: true,
      message: 'Interaction was disabled/blocked. This is expected behavior, not a silent failure.',
      recommendedStatus: 'INFORMATIONAL',
    };
  }
  
  return { applies: false };
}

/**
 * Rule 6: GUARD_VALIDATION_PRESENT
 */
function _evaluateValidationPresent(finding, signals, evidencePackage, isConfirmed) {
  const uiSignals = signals.uiSignals || {};
  const uiFeedback = signals.uiFeedback || {};
  
  const hasValidationFeedback = uiSignals.hasErrorSignal ||
                                uiSignals.hasValidationMessage ||
                                (uiFeedback.signals?.validation?.happened === true);
  
  const isValidationFailure = finding.type?.includes('validation') || 
                              finding.type?.includes('form');
  
  if (hasValidationFeedback && isValidationFailure && isConfirmed) {
    return {
      applies: true,
      message: 'Validation feedback is present. This contradicts a validation silent failure claim.',
      contradiction: true,
      recommendedStatus: 'SUSPECTED',
    };
  }
  
  return { applies: false };
}

/**
 * Rule 7: GUARD_CONTRADICT_EVIDENCE
 */
function _evaluateContradictEvidence(finding, signals, evidencePackage, isConfirmed) {
  if (!evidencePackage || !evidencePackage.isComplete) {
    const missingFields = evidencePackage.missingEvidence || [];
    if (isConfirmed && missingFields.length > 0) {
      return {
        applies: true,
        message: `Evidence package is incomplete. Missing: ${missingFields.join(', ')}`,
        contradiction: true,
        recommendedStatus: 'SUSPECTED',
      };
    }
  }
  
  return { applies: false };
}

/**
 * Rule: GUARD_VIEW_SWITCH_MINOR_CHANGE
 * If URL unchanged and change is minor (e.g. button text change only) -> cannot be CONFIRMED
 */
function _evaluateViewSwitchMinorChange(finding, signals, evidencePackage, isConfirmed) {
  const isViewSwitch = finding.type?.includes('view_switch') || 
                      finding.expectation?.kind === 'VIEW_SWITCH_PROMISE';
  const beforeUrl = evidencePackage.before?.url || '';
  const afterUrl = evidencePackage.after?.url || '';
  const urlUnchanged = beforeUrl === afterUrl;
  
  const uiSignals = signals.uiSignals || {};
  const uiFeedback = signals.uiFeedback || {};
  
  // Check if change is minor (only button text, no structural change)
  const isMinorChange = (
    uiSignals.textChanged === true &&
    !uiSignals.domChanged &&
    !uiSignals.visibleChanged &&
    !uiSignals.ariaChanged &&
    (!uiFeedback.overallUiFeedbackScore || uiFeedback.overallUiFeedbackScore < 0.2)
  );
  
  if (isViewSwitch && urlUnchanged && isMinorChange && isConfirmed) {
    return {
      applies: true,
      message: 'URL unchanged and change is minor (e.g. button text only). Cannot confirm view switch.',
      contradiction: true,
      recommendedStatus: 'SUSPECTED',
    };
  }
  
  return { applies: false };
}

/**
 * Rule: GUARD_VIEW_SWITCH_ANALYTICS_ONLY
 * If only analytics fired -> ignore
 */
function _evaluateViewSwitchAnalyticsOnly(finding, signals, evidencePackage, isConfirmed) {
  const isViewSwitch = finding.type?.includes('view_switch') || 
                      finding.expectation?.kind === 'VIEW_SWITCH_PROMISE';
  
  const networkSignals = signals.network || {};
  const networkRequests = networkSignals.topFailedUrls || 
                          networkSignals.observedRequestUrls || 
                          [];
  
  const analyticsOnly = networkRequests.length > 0 && networkRequests.every(url => {
    if (!url || typeof url !== 'string') return false;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('/analytics') ||
           lowerUrl.includes('/beacon') ||
           lowerUrl.includes('/tracking') ||
           lowerUrl.includes('/pixel') ||
           lowerUrl.includes('google-analytics') ||
           lowerUrl.includes('segment.io') ||
           lowerUrl.includes('mixpanel');
  });
  
  const uiSignals = signals.uiSignals || {};
  const hasNoUiChange = !uiSignals.changed && !uiSignals.domChanged && !uiSignals.visibleChanged;
  
  if (isViewSwitch && analyticsOnly && hasNoUiChange && isConfirmed) {
    return {
      applies: true,
      message: 'Only analytics fired, no UI change. Cannot confirm view switch.',
      contradiction: true,
      recommendedStatus: 'INFORMATIONAL',
    };
  }
  
  return { applies: false };
}

/**
 * Rule: GUARD_VIEW_SWITCH_AMBIGUOUS
 * If state change promise exists but UI outcome ambiguous (one signal only) -> SUSPECTED
 */
function _evaluateViewSwitchAmbiguous(finding, signals, evidencePackage, isConfirmed) {
  const isViewSwitch = finding.type?.includes('view_switch') || 
                      finding.expectation?.kind === 'VIEW_SWITCH_PROMISE';
  const hasPromise = finding.expectation?.kind === 'VIEW_SWITCH_PROMISE' ||
                    finding.promise?.type === 'view_switch';
  
  // Check correlation result - if only one signal, it's ambiguous
  const correlation = finding.correlation || {};
  const signalCount = correlation.signals?.length || 0;
  const ambiguousOutcome = signalCount === 1;
  
  if (isViewSwitch && hasPromise && ambiguousOutcome && isConfirmed) {
    return {
      applies: true,
      message: 'State change promise exists but UI outcome ambiguous (one signal only). Downgrading to SUSPECTED.',
      contradiction: false,
      recommendedStatus: 'SUSPECTED',
    };
  }
  
  return { applies: false };
}



