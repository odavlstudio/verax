/**
 * PHASE 21.4 — Guardrails Engine (Policy-Driven)
 * 
 * Central guardrails engine that prevents false CONFIRMED findings
 * by enforcing policy-driven rules.
 * 
 * All rules are mandatory and cannot be disabled.
 */

import { loadGuardrailsPolicy, getPolicyReport } from './guardrails/policy.loader.js';
import { GUARDRAILS_RULE } from './guardrails/policy.defaults.js';

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

// Global policy cache (loaded once per process)
let cachedPolicy = null;

/**
 * Get guardrails policy (cached)
 * 
 * @param {string|null} policyPath - Custom policy path (optional)
 * @param {string} projectDir - Project directory
 * @returns {Object} Guardrails policy
 */
function getGuardrailsPolicy(policyPath = null, projectDir = null) {
  if (!cachedPolicy) {
    cachedPolicy = loadGuardrailsPolicy(policyPath, projectDir);
  }
  return cachedPolicy;
}

/**
 * PHASE 21.4: Apply guardrails to a finding using policy
 * 
 * @param {Object} finding - Finding object
 * @param {Object} context - Context including evidencePackage, signals, confidenceReasons, promise type
 * @param {Object} options - Options { policyPath, projectDir }
 * @returns {Object} { finding: updatedFinding, guardrails: report }
 */
export function applyGuardrails(finding, context = {}, options = {}) {
  const evidencePackage = context.evidencePackage || finding.evidencePackage || {};
  const signals = context.signals || evidencePackage.signals || {};
  const _confidenceReasons = context.confidenceReasons || finding.confidenceReasons || [];
  const _promiseType = context.promiseType || finding.expectation?.type || finding.promise?.type || null;
  
  // Load policy
  const policy = getGuardrailsPolicy(options.policyPath, options.projectDir);
  const policyReport = getPolicyReport(policy);
  
  const appliedRules = [];
  const contradictions = [];
  let recommendedStatus = finding.severity || finding.status || 'SUSPECTED';
  const confidenceAdjustments = [];
  let confidenceDelta = 0;
  
  // Apply rules in deterministic order (by rule id)
  const sortedRules = [...policy.rules].sort((a, b) => a.id.localeCompare(b.id));
  
  for (const rule of sortedRules) {
    // Check if rule applies to this finding type
    const appliesToFinding = rule.appliesTo.includes('*') || 
                             rule.appliesTo.some(cap => finding.type?.includes(cap));
    
    if (!appliesToFinding) {
      continue;
    }
    
    // Evaluate rule
    const evaluation = evaluateRule(rule, finding, signals, evidencePackage);
    
    if (evaluation.applies) {
      appliedRules.push({
        code: rule.id,
        severity: mapActionToSeverity(rule.action),
        message: evaluation.message,
        ruleId: rule.id,
        category: rule.category
      });
      
      if (evaluation.contradiction) {
        contradictions.push({
          code: rule.id,
          message: evaluation.message,
        });
      }
      
      if (evaluation.recommendedStatus) {
        recommendedStatus = evaluation.recommendedStatus;
      }
      
      const delta = rule.confidenceDelta || 0;
      confidenceDelta += delta;
      
      if (delta !== 0) {
        confidenceAdjustments.push({
          reason: rule.id,
          delta: delta,
          message: evaluation.message,
        });
      }
    }
  }
  
  // Apply confidence adjustments
  let finalConfidence = finding.confidence || 0;
  if (confidenceDelta !== 0) {
    finalConfidence = Math.max(0, Math.min(1, finalConfidence + confidenceDelta));
  }
  
  // Build guardrails report with policy metadata
  const guardrailsReport = {
    appliedRules,
    contradictions,
    recommendedStatus,
    confidenceAdjustments,
    confidenceDelta,
    finalDecision: recommendedStatus,
    policyReport: {
      version: policyReport.version,
      source: policyReport.source,
      appliedRuleIds: appliedRules.map(r => r.code)
    }
  };
  
  // Update finding
  const updatedFinding = {
    ...finding,
    severity: recommendedStatus,
    status: recommendedStatus, // Also update status for backward compatibility
    confidence: finalConfidence,
    guardrails: guardrailsReport,
  };
  
  return {
    finding: updatedFinding,
    guardrails: guardrailsReport,
  };
}

/**
 * Map policy action to severity
 */
function mapActionToSeverity(action) {
  const mapping = {
    'BLOCK': GUARDRAILS_SEVERITY.BLOCK_CONFIRMED,
    'DOWNGRADE': GUARDRAILS_SEVERITY.DOWNGRADE,
    'INFO': GUARDRAILS_SEVERITY.INFORMATIONAL
  };
  return mapping[action] || GUARDRAILS_SEVERITY.WARNING;
}

/**
 * Evaluate a guardrails rule
 * 
 * @param {Object} rule - Policy rule
 * @param {Object} finding - Finding object
 * @param {Object} signals - Sensor signals
 * @param {Object} evidencePackage - Evidence package
 * @returns {Object} { applies, message, contradiction, recommendedStatus }
 */
function evaluateRule(rule, finding, signals, evidencePackage) {
  const evalType = rule.evaluation.type;
  const isConfirmed = finding.severity === 'CONFIRMED' || finding.status === 'CONFIRMED';
  
  switch (evalType) {
    case 'network_success_no_ui':
      return evaluateNetSuccessNoUi(finding, signals, evidencePackage, isConfirmed);
    
    case 'analytics_only':
      return evaluateAnalyticsOnly(finding, signals, evidencePackage, isConfirmed);
    
    case 'shallow_routing':
      return evaluateShallowRouting(finding, signals, evidencePackage, isConfirmed);
    
    case 'ui_feedback_present':
      return evaluateUiFeedbackPresent(finding, signals, evidencePackage, isConfirmed);
    
    case 'interaction_blocked':
      return evaluateInteractionBlocked(finding, signals, evidencePackage, isConfirmed);
    
    case 'validation_present':
      return evaluateValidationPresent(finding, signals, evidencePackage, isConfirmed);
    
    case 'contradict_evidence':
      return evaluateContradictEvidence(finding, signals, evidencePackage, isConfirmed);
    
    case 'view_switch_minor_change':
      return evaluateViewSwitchMinorChange(finding, signals, evidencePackage, isConfirmed);
    
    case 'view_switch_analytics_only':
      return evaluateViewSwitchAnalyticsOnly(finding, signals, evidencePackage, isConfirmed);
    
    case 'view_switch_ambiguous':
      return evaluateViewSwitchAmbiguous(finding, signals, evidencePackage, isConfirmed);
    
    default:
      return { applies: false };
  }
}

/**
 * Rule 1: GUARD_NET_SUCCESS_NO_UI
 */
function evaluateNetSuccessNoUi(finding, signals, evidencePackage, isConfirmed) {
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
function evaluateAnalyticsOnly(finding, signals, evidencePackage, isConfirmed) {
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
function evaluateShallowRouting(finding, signals, evidencePackage, isConfirmed) {
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
function evaluateUiFeedbackPresent(finding, signals, evidencePackage, isConfirmed) {
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
function evaluateInteractionBlocked(finding, signals, evidencePackage, isConfirmed) {
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
function evaluateValidationPresent(finding, signals, evidencePackage, isConfirmed) {
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
function evaluateContradictEvidence(finding, signals, evidencePackage, isConfirmed) {
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
function evaluateViewSwitchMinorChange(finding, signals, evidencePackage, isConfirmed) {
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
function evaluateViewSwitchAnalyticsOnly(finding, signals, evidencePackage, isConfirmed) {
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
function evaluateViewSwitchAmbiguous(finding, signals, evidencePackage, isConfirmed) {
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
