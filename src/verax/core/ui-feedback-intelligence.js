/**
 * PHASE 13 — UI Feedback Deepening
 * 
 * Unified UI feedback detection and intelligence layer that:
 * - Defines canonical UI feedback taxonomy
 * - Scores feedback presence/absence deterministically
 * - Correlates feedback with promises
 * - Provides evidence-backed findings
 */

/**
 * PHASE 13: UI Feedback Taxonomy
 */
export const FEEDBACK_TYPE = {
  LOADING: 'loading',
  DISABLED: 'disabled',
  TOAST: 'toast',
  MODAL: 'modal',
  INLINE_MESSAGE: 'inline_message',
  DOM_CHANGE: 'dom_change',
};

export const FEEDBACK_SCORE = {
  CONFIRMED: 'FEEDBACK_CONFIRMED',
  MISSING: 'FEEDBACK_MISSING',
  AMBIGUOUS: 'FEEDBACK_AMBIGUOUS',
};

/**
 * PHASE 13: Detect UI feedback signals from trace sensors
 * 
 * @param {Object} trace - Interaction trace with sensors
 * @returns {Array} Array of detected feedback signals
 */
export function detectUIFeedbackSignals(trace) {
  const signals = [];
  const sensors = trace.sensors || {};
  const uiSignals = sensors.uiSignals || {};
  const uiFeedback = sensors.uiFeedback || {};
  const _before = trace.before || {};
  const _after = trace.after || {};
  
  const beforeSignals = uiSignals.before || {};
  const afterSignals = uiSignals.after || {};
  const diff = uiSignals.diff || {};
  
  // 1. Loading indicators
  if (afterSignals.hasLoadingIndicator || 
      uiFeedback.signals?.loading?.appeared === true ||
      uiFeedback.signals?.loading?.disappeared === true) {
    signals.push({
      type: FEEDBACK_TYPE.LOADING,
      selector: findLoadingSelector(afterSignals),
      confidence: 0.9,
      evidence: {
        before: beforeSignals.hasLoadingIndicator || false,
        after: afterSignals.hasLoadingIndicator || false,
        appeared: uiFeedback.signals?.loading?.appeared === true,
        disappeared: uiFeedback.signals?.loading?.disappeared === true,
      },
    });
  }
  
  // 2. Disabled/blocked states
  const disabledChanged = diff.buttonStateChanged === true ||
                          (beforeSignals.disabledElements?.length || 0) !== (afterSignals.disabledElements?.length || 0) ||
                          uiFeedback.signals?.buttonStateTransition?.happened === true;
  
  if (disabledChanged) {
    signals.push({
      type: FEEDBACK_TYPE.DISABLED,
      selector: findDisabledSelector(afterSignals),
      confidence: 0.85,
      evidence: {
        beforeCount: beforeSignals.disabledElements?.length || 0,
        afterCount: afterSignals.disabledElements?.length || 0,
        buttonStateChanged: diff.buttonStateChanged === true,
      },
    });
  }
  
  // 3. Toast/snackbar notifications
  if (afterSignals.hasStatusSignal || 
      afterSignals.hasLiveRegion ||
      uiFeedback.signals?.notification?.happened === true) {
    signals.push({
      type: FEEDBACK_TYPE.TOAST,
      selector: findToastSelector(afterSignals),
      confidence: 0.9,
      evidence: {
        hasStatusSignal: afterSignals.hasStatusSignal || false,
        hasLiveRegion: afterSignals.hasLiveRegion || false,
        notification: uiFeedback.signals?.notification?.happened === true,
      },
    });
  }
  
  // 4. Modal/dialog confirmations
  if (afterSignals.hasDialog || 
      uiFeedback.signals?.domChange?.happened === true) {
    // Check if dialog appeared
    const dialogAppeared = !beforeSignals.hasDialog && afterSignals.hasDialog;
    
    if (dialogAppeared) {
      signals.push({
        type: FEEDBACK_TYPE.MODAL,
        selector: findDialogSelector(afterSignals),
        confidence: 0.95,
        evidence: {
          before: beforeSignals.hasDialog || false,
          after: afterSignals.hasDialog || false,
          appeared: dialogAppeared,
        },
      });
    }
  }
  
  // 5. Inline success/error messages
  if (afterSignals.hasErrorSignal || 
      afterSignals.validationFeedbackDetected ||
      uiFeedback.signals?.domChange?.happened === true) {
    signals.push({
      type: FEEDBACK_TYPE.INLINE_MESSAGE,
      selector: findInlineMessageSelector(afterSignals),
      confidence: 0.85,
      evidence: {
        hasErrorSignal: afterSignals.hasErrorSignal || false,
        validationFeedbackDetected: afterSignals.validationFeedbackDetected || false,
      },
    });
  }
  
  // 6. Meaningful DOM changes
  const domChanged = trace.dom?.beforeHash !== trace.dom?.afterHash ||
                     uiFeedback.signals?.domChange?.happened === true ||
                     diff.changed === true;
  
  if (domChanged) {
    // Only count as feedback if it's a meaningful change (not just timestamps/random IDs)
    const isMeaningful = isMeaningfulDOMChange(trace, uiFeedback);
    
    if (isMeaningful) {
      signals.push({
        type: FEEDBACK_TYPE.DOM_CHANGE,
        selector: null, // DOM change affects multiple elements
        confidence: 0.7,
        evidence: {
          domHashChanged: trace.dom?.beforeHash !== trace.dom?.afterHash,
          uiFeedbackDomChange: uiFeedback.signals?.domChange?.happened === true,
          uiSignalsChanged: diff.changed === true,
        },
      });
    }
  }
  
  return signals;
}

/**
 * PHASE 13: Score feedback presence/absence
 * 
 * @param {Array} signals - Detected feedback signals
 * @param {Object} expectation - Promise/expectation that should have feedback
 * @param {Object} trace - Interaction trace
 * @returns {Object} Scoring result
 */
export function scoreUIFeedback(signals, expectation, trace) {
  const sensors = trace.sensors || {};
  const networkSensor = sensors.network || {};
  const uiFeedback = sensors.uiFeedback || {};
  
  // Evidence-only: no inferred feedback expectations
  const expectedFeedbackTypes = [];
  
  // Check if any expected feedback types are present
  const matchingSignals = signals.filter(s => 
    expectedFeedbackTypes.includes(s.type)
  );
  
  // Overall UI feedback score from sensor
  const overallScore = uiFeedback.overallUiFeedbackScore || 0;
  
  // Network activity context
  const hasNetworkActivity = networkSensor.hasNetworkActivity === true ||
                            (networkSensor.totalRequests || 0) > 0;
  const hasNetworkFailure = networkSensor.failedRequests > 0 ||
                            networkSensor.topFailedUrls?.length > 0;
  
  // Determine score
  if (matchingSignals.length > 0 || overallScore > 0.5) {
    return {
      score: FEEDBACK_SCORE.CONFIRMED,
      confidence: matchingSignals.length > 0
        ? Math.max(...matchingSignals.map(s => s.confidence))
        : overallScore,
      explanation: buildFeedbackExplanation(matchingSignals, overallScore, 'confirmed'),
      signals: matchingSignals,
      topSignals: matchingSignals.slice(0, 3).map(s => ({
        type: s.type,
        confidence: s.confidence,
        selector: s.selector,
      })),
    };
  }
  
  // If network activity but no feedback, likely missing
  if (hasNetworkActivity && signals.length === 0 && overallScore < 0.3) {
    return {
      score: FEEDBACK_SCORE.MISSING,
      confidence: hasNetworkFailure ? 0.9 : 0.7,
      explanation: buildFeedbackExplanation([], overallScore, 'missing', {
        hasNetworkActivity,
        hasNetworkFailure,
      }),
      signals: [],
      topSignals: [],
    };
  }
  
  // Ambiguous case
  if (signals.length > 0 && overallScore > 0 && overallScore < 0.5) {
    return {
      score: FEEDBACK_SCORE.AMBIGUOUS,
      confidence: 0.6,
      explanation: buildFeedbackExplanation(signals, overallScore, 'ambiguous'),
      signals: signals,
      topSignals: signals.slice(0, 3).map(s => ({
        type: s.type,
        confidence: s.confidence,
        selector: s.selector,
      })),
    };
  }
  
  // Default: missing if no signals and low score
  return {
    score: FEEDBACK_SCORE.MISSING,
    confidence: 0.5,
    explanation: buildFeedbackExplanation([], overallScore, 'missing'),
    signals: [],
    topSignals: [],
  };
}

/**
 * Build explanation for feedback score
 */
function buildFeedbackExplanation(signals, overallScore, outcome, context = {}) {
  const parts = [];
  
  if (outcome === 'confirmed') {
    if (signals.length > 0) {
      parts.push(`Detected ${signals.length} feedback signal(s): ${signals.map(s => s.type).join(', ')}`);
    }
    if (overallScore > 0.5) {
      parts.push(`Overall UI feedback score: ${overallScore.toFixed(2)}`);
    }
  } else if (outcome === 'missing') {
    parts.push('No feedback signals detected');
    if (context.hasNetworkActivity) {
      parts.push('Network activity occurred but no feedback');
    }
    if (context.hasNetworkFailure) {
      parts.push('Network failure occurred but no error feedback');
    }
    if (overallScore < 0.3) {
      parts.push(`Low UI feedback score: ${overallScore.toFixed(2)}`);
    }
  } else if (outcome === 'ambiguous') {
    parts.push('Feedback signals present but confidence is low');
    if (signals.length > 0) {
      parts.push(`Detected ${signals.length} signal(s) but overall score is ${overallScore.toFixed(2)}`);
    }
  }
  
  return parts.join('. ');
}

/**
 * Helper functions to find selectors
 */
function findLoadingSelector(_signals) {
  // Return a generic selector hint
  return '[aria-busy="true"], [data-loading], [role="status"]';
}

function findDisabledSelector(_signals) {
  return '[disabled], [aria-disabled="true"]';
}

function findToastSelector(_signals) {
  return '[role="alert"], [role="status"], [aria-live], .toast, .snackbar';
}

function findDialogSelector(_signals) {
  return '[role="dialog"], [aria-modal="true"]';
}

function findInlineMessageSelector(_signals) {
  return '[role="alert"], .error, .success, [class*="message"]';
}

/**
 * Check if DOM change is meaningful (not just timestamps/random IDs)
 */
function isMeaningfulDOMChange(trace, uiFeedback) {
  // If UI feedback sensor detected meaningful change, trust it
  if (uiFeedback.signals?.domChange?.happened === true) {
    return true;
  }
  
  // If DOM hash changed, consider it meaningful
  if (trace.dom?.beforeHash !== trace.dom?.afterHash) {
    // Additional check: if UI signals changed, it's meaningful
    const uiSignals = trace.sensors?.uiSignals || {};
    if (uiSignals.diff?.changed === true) {
      return true;
    }
  }
  
  return false;
}

/**
 * PHASE 13: Correlate promise with UI feedback
 * 
 * @param {Object} expectation - Promise/expectation
 * @param {Object} feedbackScore - Feedback scoring result
 * @param {Object} trace - Interaction trace
 * @returns {Object} Correlation result
 */
export function correlatePromiseWithFeedback(expectation, feedbackScore, trace) {
  const sensors = trace.sensors || {};
  const networkSensor = sensors.network || {};
  const hasNetworkFailure = networkSensor.failedRequests > 0 ||
                            networkSensor.topFailedUrls?.length > 0;
  
  // Rule 1: Network failed AND feedback missing → CONFIRMED silent failure
  if (expectation.type === 'network_action' || expectation.type === 'network') {
    if (hasNetworkFailure && feedbackScore.score === FEEDBACK_SCORE.MISSING) {
      return {
        outcome: 'CONFIRMED',
        confidence: 0.9,
        reason: 'Network request failed but no error feedback provided to user',
        requiresEvidence: true,
      };
    }
    
    // Network succeeded but no feedback and no DOM change
    const hasNetworkSuccess = networkSensor.successfulRequests > 0;
    const hasDomChange = trace.dom?.beforeHash !== trace.dom?.afterHash;
    const hasUrlChange = trace.sensors?.navigation?.urlChanged === true;
    
    if (hasNetworkSuccess && 
        feedbackScore.score === FEEDBACK_SCORE.MISSING && 
        !hasDomChange && 
        !hasUrlChange) {
      return {
        outcome: 'SUSPECTED',
        confidence: 0.7,
        reason: 'Network request succeeded but no feedback or visible change',
        requiresEvidence: true,
      };
    }
  }
  
  // Rule 2: Navigation promised but URL/UI unchanged
  if (expectation.type === 'navigation' || expectation.type === 'spa_navigation') {
    const urlChanged = trace.sensors?.navigation?.urlChanged === true;
    const hasDomChange = trace.dom?.beforeHash !== trace.dom?.afterHash;
    
    if (!urlChanged && !hasDomChange && feedbackScore.score === FEEDBACK_SCORE.MISSING) {
      return {
        outcome: 'CONFIRMED',
        confidence: 0.85,
        reason: 'Navigation promise not fulfilled - no URL change, DOM change, or feedback',
        requiresEvidence: true,
      };
    }
  }
  
  // Rule 3: Validation expected but no inline feedback
  if (expectation.type === 'validation' || expectation.type === 'form_submission') {
    if (feedbackScore.score === FEEDBACK_SCORE.MISSING) {
      // Check if form was actually submitted
      const formSubmitted = trace.interaction?.type === 'form';
      
      if (formSubmitted) {
        return {
          outcome: 'SUSPECTED',
          confidence: 0.7,
          reason: 'Form submission expected validation feedback but none detected',
          requiresEvidence: true,
        };
      }
    }
  }
  
  // Rule 4: State action but no UI feedback
  if (expectation.type === 'state_action' || expectation.type === 'state') {
    if (feedbackScore.score === FEEDBACK_SCORE.MISSING) {
      // Check if state actually changed
      const stateChanged = trace.sensors?.state?.changed?.length > 0;
      
      if (stateChanged) {
        return {
          outcome: 'SUSPECTED',
          confidence: 0.75,
          reason: 'State changed but no UI feedback detected',
          requiresEvidence: true,
        };
      }
    }
  }
  
  // Default: no correlation (feedback present or expectation doesn't require it)
  return {
    outcome: null,
    confidence: 0,
    reason: null,
    requiresEvidence: false,
  };
}

/**
 * PHASE 13: Build evidence for UI feedback finding
 * 
 * @param {Object} feedbackScore - Feedback scoring result
 * @param {Object} correlation - Promise-feedback correlation
 * @param {Object} trace - Interaction trace
 * @param {Object} expectation - Promise/expectation
 * @returns {Object} Evidence object
 */
export function buildUIFeedbackEvidence(feedbackScore, correlation, trace, expectation) {
  const evidence = {
    feedback: {
      score: feedbackScore.score,
      confidence: feedbackScore.confidence,
      explanation: feedbackScore.explanation,
      signals: feedbackScore.signals.map(s => ({
        type: s.type,
        selector: s.selector,
        confidence: s.confidence,
      })),
      topSignals: feedbackScore.topSignals,
    },
    beforeAfter: {
      beforeScreenshot: trace.before?.screenshot || null,
      afterScreenshot: trace.after?.screenshot || null,
      beforeUrl: trace.before?.url || null,
      afterUrl: trace.after?.url || null,
      beforeDomHash: trace.dom?.beforeHash || null,
      afterDomHash: trace.dom?.afterHash || null,
    },
    promise: {
      type: expectation?.type || null,
      value: expectation?.promise?.value || expectation?.targetPath || null,
      source: expectation?.source || null,
      context: expectation?.source?.context || null,
      astSource: expectation?.source?.astSource || null,
    },
    sensors: {
      uiSignals: trace.sensors?.uiSignals || null,
      uiFeedback: trace.sensors?.uiFeedback || null,
      network: trace.sensors?.network || null,
      navigation: trace.sensors?.navigation || null,
    },
    correlation: {
      outcome: correlation.outcome,
      confidence: correlation.confidence,
      reason: correlation.reason,
    },
    timing: {
      // Timing window information if available
      stabilizationWindow: trace.sensors?.uiFeedback?.timing || null,
    },
  };
  
  return evidence;
}

