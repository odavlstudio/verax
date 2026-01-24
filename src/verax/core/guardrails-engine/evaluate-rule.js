/**
 * Internal: Guardrails rule evaluation and mapping
 */

// Local copy of severity mapping to avoid circular imports
const GUARDRAILS_SEVERITY = {
  BLOCK_CONFIRMED: 'BLOCK_CONFIRMED',
  DOWNGRADE: 'DOWNGRADE',
  INFORMATIONAL: 'INFORMATIONAL',
  DROP: 'DROP',
  WARNING: 'WARNING',
};

export function mapActionToSeverity(action) {
  const mapping = {
    'BLOCK': GUARDRAILS_SEVERITY.BLOCK_CONFIRMED,
    'DOWNGRADE': GUARDRAILS_SEVERITY.DOWNGRADE,
    'INFO': GUARDRAILS_SEVERITY.INFORMATIONAL
  };
  return mapping[action] || GUARDRAILS_SEVERITY.WARNING;
}

export function evaluateRule(rule, finding, signals, evidencePackage) {
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

function evaluateViewSwitchMinorChange(finding, signals, evidencePackage, isConfirmed) {
  const isViewSwitch = finding.type?.includes('view_switch') || 
                      finding.expectation?.kind === 'VIEW_SWITCH_PROMISE';
  const beforeUrl = evidencePackage.before?.url || '';
  const afterUrl = evidencePackage.after?.url || '';
  const urlUnchanged = beforeUrl === afterUrl;
  
  const uiSignals = signals.uiSignals || {};
  const uiFeedback = signals.uiFeedback || {};
  
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

function evaluateViewSwitchAmbiguous(finding, signals, evidencePackage, isConfirmed) {
  const isViewSwitch = finding.type?.includes('view_switch') || 
                      finding.expectation?.kind === 'VIEW_SWITCH_PROMISE';
  const hasPromise = finding.expectation?.kind === 'VIEW_SWITCH_PROMISE' ||
                    finding.promise?.type === 'view_switch';
  
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
