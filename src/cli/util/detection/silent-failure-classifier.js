/**
 * Silent Failure Classifier - STAGE 3: SILENT FAILURE CANON
 * 
 * Canonical, framework-agnostic classification of silent failures.
 * Each class:
 * - Maps to a stable finding.type
 * - Has deterministic, evidence-based rules
 * - Does NOT guess or rely on business intent
 * - Enforces Evidence Law (Stage 1) + Determinism (Stage 2)
 * 
 * CANONICAL CLASSES:
 * 1) navigation_silent_failure - Promise: explicit navigation intent
 * 2) submit_silent_failure - Promise: form submission
 * 3) ui_feedback_silent_failure - Promise: feedback is expected
 * 4) state_change_silent_failure - Promise: explicit state mutation
 * 5) loading_phantom_failure - Promise: loading indicator appearance
 * 6) permission_wall_silent_failure - Promise: action is available
 */

/**
 * Classify an expectation as a silent failure with evidence-based rules.
 * 
 * @param {Object} expectation - The expectation object with promise, type, source
 * @param {Object} observation - The observation from runtime with signals, evidence
 * @param {Object} evidenceSignals - Extracted evidence signals (route change, network, DOM, feedback)
 * @param {boolean} runComplete - Whether the run completed all expectations
 * @returns {Object} { type, status, confidence, rationaleSignals, reason }
 */
export function classifySilentFailure(expectation, observation, evidenceSignals = {}, runComplete = true) {
  if (!expectation || !observation) {
    return {
      type: null,
      status: 'UNCLASSIFIABLE',
      confidence: 0,
      rationaleSignals: [],
      reason: 'Missing expectation or observation',
    };
  }

  // Extract core signals
  const promise = expectation.promise || {};
  const promiseType = expectation.type; // 'navigation' | 'network' | 'state' | 'ui_feedback' | 'loading'
  const action = expectation.action || {};
  const actionType = action.type; // 'click' | 'submit' | 'type' | 'navigate'
  const signals = evidenceSignals || {};

  // Observation signals
  const observed = observation.observed === true;
  const attempted = observation.attempted === true ||
                    signals.loadingStarted === true ||
                    signals.navigationChanged === true ||
                    signals.networkActivity === true ||
                    signals.meaningfulDomChange === true ||
                    signals.domChanged === true ||
                    signals.stateChanged === true ||
                    signals.feedbackSeen === true ||
                    signals.ariaLiveUpdated === true;

  // If observed, not a silent failure
  if (observed) {
    return {
      type: null,
      status: 'OBSERVED',
      confidence: 1.0,
      rationaleSignals: ['EXPECTATION_MET'],
      reason: 'Expectation was observed at runtime',
    };
  }

  // If not attempted, not a silent failure (coverage gap)
  if (!attempted) {
    return {
      type: null,
      status: 'COVERAGE_GAP',
      confidence: 0,
      rationaleSignals: ['NOT_ATTEMPTED'],
      reason: observation.reason || 'Expectation was not attempted',
    };
  }

  // Attempted but not observed - check for silent failure
  // CRITICAL: Must have evidence to claim silent failure
  const hasAnyEvidence = hasSubstantiveEvidence(evidenceSignals, observation);
  if (!hasAnyEvidence) {
    return {
      type: null,
      status: 'UNPROVEN',
      confidence: 0,
      rationaleSignals: ['NO_EVIDENCE'],
      reason: 'Attempted but no substantive evidence captured',
    };
  }

  // Attempt + No Observation + Evidence = SILENT FAILURE
  // Now classify which type of silent failure
  const runCompleteFlag = observation && Object.prototype.hasOwnProperty.call(observation, 'runComplete')
    ? observation.runComplete
    : runComplete;
  return classifyByPattern(expectation, observation, evidenceSignals, promiseType, actionType, action, promise, runCompleteFlag);
}

/**
 * Classify silent failure by pattern matching against canonical classes.
 */
function classifyByPattern(expectation, observation, evidenceSignals, promiseType, actionType, action, promise, runComplete) {
  const rationaleSignals = [];
  const signals = evidenceSignals || {};
  // Use observation.runComplete if defined, otherwise fall back to parameter
  const runCompleteFlag = observation && Object.prototype.hasOwnProperty.call(observation, 'runComplete') 
    ? observation.runComplete 
    : runComplete;

  // CORE PRINCIPLE: Silent Failure = promise + attempt + NO observable outcome + run COMPLETE
  // Evidence for CONFIRMATION:
  // 1. attemptEvidence: interaction was executed (click processed, submit sent)
  // 2. negativeOutcomeEvidence: promised outcome explicitly absent (no nav, no feedback, no DOM change)
  // 3. completeness: observation window is COMPLETE (not timeout/incomplete)
  //
  // DISCONFIRMING signals (NOT silent if present):
  // - meaningfulDomChange: proves something happened
  // - feedbackSeen: proves communication occurred  
  // - navigationChanged: proves route changed
  // - stateChanged: proves DOM outcome existed

  // CLASS A: navigation_silent_failure
  // Promise: navigation (href click, router.push, route change expected)
  // CONFIRMED: click executed + no route/URL change + no feedback + no DOM outcome + run complete
  if (promiseType === 'navigation' || isNavigationPromise(promise)) {
    const navigationPromiseExists = promise && (promise.value || promise.description);
    const clickAttempted = observation && observation.attempted === true;
    const noNavChange = !signals.navigationChanged;
    const noFeedback = !signals.feedbackSeen && !signals.ariaLiveUpdated && !signals.ariaRoleAlertsDetected;
    const noDomOutcome = !signals.meaningfulDomChange && !signals.domChanged;

    // DISCONFIRM: Meaningful DOM change proves something happened
    if (signals.meaningfulDomChange || signals.domChanged) {
      return null;
    }

    // DISCONFIRM: Feedback was given
    if (signals.feedbackSeen || signals.ariaLiveUpdated || signals.ariaRoleAlertsDetected) {
      return null;
    }

    // CONFIRM: All negative signals + attempt + complete
    if (navigationPromiseExists && clickAttempted && noNavChange && noFeedback && noDomOutcome && runCompleteFlag) {
      rationaleSignals.push('ATTEMPT_CONFIRMED', 'NO_NAV_CHANGE', 'NO_FEEDBACK', 'NO_DOM_CHANGE', 'RUN_COMPLETE');
      return {
        type: 'navigation_silent_failure',
        status: 'CONFIRMED',
        confidence: calculateConfidence(signals, 'navigation'),
        rationaleSignals,
        reason: 'Navigation click executed but no route change, DOM change, or feedback',
        expectationId: expectation.id,
        promiseValue: promise.value || promise.description,
      };
    }

    // Incomplete observation
    if (navigationPromiseExists && clickAttempted && !runCompleteFlag) {
      rationaleSignals.push('INCOMPLETE_OBSERVATION');
      return {
        type: 'navigation_silent_failure',
        status: 'SUSPECTED',
        confidence: calculateConfidence(signals, 'navigation') * 0.5,
        rationaleSignals,
        reason: 'Navigation attempted but observation window incomplete',
        expectationId: expectation.id,
        promiseValue: promise.value || promise.description,
      };
    }
  }

  // CLASS B: submit_silent_failure
  // Promise: form submission or submit-like action
  // CONFIRMED: submit executed + no feedback + no DOM outcome + run complete
  // Note: network activity is optional - silence is about UI outcome, not network
  if (promiseType === 'submit' || isSubmitAction(action.type, promise)) {
    const submitPromiseExists = promise && (promise.value || promise.description || promise.endpoint);
    const submitAttempted = observation && observation.attempted === true;
    const noFeedback = !signals.feedbackSeen && !signals.ariaLiveUpdated && !signals.ariaRoleAlertsDetected;
    const noDomOutcome = !signals.meaningfulDomChange && !signals.domChanged;

    // DISCONFIRM: Feedback signals
    if (signals.feedbackSeen || signals.ariaLiveUpdated || signals.ariaRoleAlertsDetected) {
      return null;
    }

    // DISCONFIRM: DOM outcome
    if (signals.meaningfulDomChange || signals.domChanged) {
      return null;
    }

    // CONFIRM: no feedback + no DOM outcome + submit attempted + run complete
    // Network activity is NOT required - can be absent OR present, UI still silent
    if (submitPromiseExists && submitAttempted && noFeedback && noDomOutcome && runCompleteFlag) {
      const networkSignal = signals.networkActivity ? 'NETWORK_ACTIVITY_PRESENT_BUT_NO_UI_OUTCOME' : 'NO_NETWORK';
      rationaleSignals.push('ATTEMPT_CONFIRMED', 'NO_FEEDBACK', 'NO_DOM_OUTCOME', networkSignal, 'RUN_COMPLETE');
      return {
        type: 'submit_silent_failure',
        status: 'CONFIRMED',
        confidence: calculateConfidence(signals, 'submit'),
        rationaleSignals,
        reason: 'Submit executed but no feedback and no DOM outcome (silent even if network present)',
        expectationId: expectation.id,
        promiseValue: promise.value || promise.description || promise.endpoint,
      };
    }

    // Incomplete observation
    if (submitPromiseExists && submitAttempted && !runCompleteFlag) {
      rationaleSignals.push('INCOMPLETE_OBSERVATION');
      return {
        type: 'submit_silent_failure',
        status: 'SUSPECTED',
        confidence: calculateConfidence(signals, 'submit') * 0.5,
        rationaleSignals,
        reason: 'Submit executed but observation window incomplete',
        expectationId: expectation.id,
        promiseValue: promise.value || promise.description || promise.endpoint,
      };
    }
  }

  // CLASS C: ui_feedback_silent_failure
  // Promise: action promises feedback (async action, button with feedback expectation)
  // CONFIRMED: attempted + no feedback + no DOM outcome + no navigation + run complete
  if (promiseType === 'ui_feedback' || isAsyncActionExpectingFeedback(promise, action)) {
    const feedbackPromiseExists = promise && (promise.value || promise.description);
    const actionAttempted = observation && observation.attempted === true;
    const noFeedback = !signals.feedbackSeen && !signals.ariaLiveUpdated && !signals.ariaRoleAlertsDetected;
    const noDomOutcome = !signals.meaningfulDomChange && !signals.domChanged;
    const noNav = !signals.navigationChanged;

    // DISCONFIRM: Feedback was given
    if (signals.feedbackSeen || signals.ariaLiveUpdated || signals.ariaRoleAlertsDetected) {
      return null;
    }

    // DISCONFIRM: DOM outcome
    if (signals.meaningfulDomChange || signals.domChanged) {
      return null;
    }

    // DISCONFIRM: Navigation happened
    if (signals.navigationChanged) {
      return null;
    }

    // CONFIRM: no feedback + no DOM + no nav + attempted + complete
    if (feedbackPromiseExists && actionAttempted && noFeedback && noDomOutcome && noNav && runCompleteFlag) {
      rationaleSignals.push('ATTEMPT_CONFIRMED', 'NO_FEEDBACK', 'NO_DOM_OUTCOME', 'NO_NAVIGATION', 'RUN_COMPLETE');
      return {
        type: 'ui_feedback_silent_failure',
        status: 'CONFIRMED',
        confidence: calculateConfidence(signals, 'feedback'),
        rationaleSignals,
        reason: 'Async action executed but no feedback, DOM change, or navigation',
        expectationId: expectation.id,
        promiseValue: promise.value || promise.description,
      };
    }

    // Incomplete observation
    if (feedbackPromiseExists && actionAttempted && !runCompleteFlag) {
      rationaleSignals.push('INCOMPLETE_OBSERVATION');
      return {
        type: 'ui_feedback_silent_failure',
        status: 'SUSPECTED',
        confidence: calculateConfidence(signals, 'feedback') * 0.5,
        rationaleSignals,
        reason: 'Async action executed but observation window incomplete',
        expectationId: expectation.id,
        promiseValue: promise.value || promise.description,
      };
    }
  }

  // CLASS D: state_change_silent_failure
  // Promise: explicit state mutation (setState, dispatch, store update)
  // CONFIRMED: attempted + no UI outcome + no feedback + run complete
  // Critical: meaningfulDomChange MUST be absent to confirm silence
  if (promiseType === 'state' || isStateChangeMutation(promise)) {
    const statePromiseExists = promise && (promise.value || promise.stateKey || promise.description);
    const mutationAttempted = observation && observation.attempted === true;
    const noUiOutcome = !signals.meaningfulDomChange && !signals.domChanged;
    const noFeedback = !signals.feedbackSeen && !signals.ariaLiveUpdated && !signals.ariaRoleAlertsDetected;

    // DISCONFIRM: Meaningful DOM change proves state reflected to UI
    if (signals.meaningfulDomChange || signals.domChanged) {
      return null;
    }

    // DISCONFIRM: Feedback signals
    if (signals.feedbackSeen || signals.ariaLiveUpdated || signals.ariaRoleAlertsDetected) {
      return null;
    }

    // CONFIRM: no DOM outcome + no feedback + attempted + complete
    if (statePromiseExists && mutationAttempted && noUiOutcome && noFeedback && runCompleteFlag) {
      rationaleSignals.push('ATTEMPT_CONFIRMED', 'NO_DOM_OUTCOME', 'NO_FEEDBACK', 'RUN_COMPLETE');
      return {
        type: 'state_change_silent_failure',
        status: 'CONFIRMED',
        confidence: calculateConfidence(signals, 'state'),
        rationaleSignals,
        reason: 'State mutation executed but no DOM outcome and no feedback',
        expectationId: expectation.id,
        promiseValue: promise.value || promise.stateKey || promise.description,
      };
    }

    // Incomplete observation
    if (statePromiseExists && mutationAttempted && !runCompleteFlag) {
      rationaleSignals.push('INCOMPLETE_OBSERVATION');
      return {
        type: 'state_change_silent_failure',
        status: 'SUSPECTED',
        confidence: calculateConfidence(signals, 'state') * 0.5,
        rationaleSignals,
        reason: 'State mutation executed but observation window incomplete',
        expectationId: expectation.id,
        promiseValue: promise.value || promise.stateKey || promise.description,
      };
    }
  }

  // CLASS E: loading_phantom_failure
  // Promise: loading indicator starts (spinner, progress bar, etc.)
  // CONFIRMED: loading started + never resolved + run complete + no success/error/nav
  if (promiseType === 'loading' || isLoadingStartPromise(promise)) {
    const loadingPromiseExists = promise && (promise.value || promise.indicator || promise.description);
    const loadingStarted = signals.loadingStarted === true;
    const loadingNeverResolved = signals.loadingResolved !== true;
    const noSuccess = !signals.feedbackSeen && !signals.ariaLiveUpdated;
    const noNav = !signals.navigationChanged;
    const noDom = !signals.meaningfulDomChange && !signals.domChanged;

    // DISCONFIRM: Feedback observed means user received response
    if (signals.feedbackSeen || signals.ariaLiveUpdated) {
      return null;
    }

    // DISCONFIRM: Loading resolved successfully
    if (signals.loadingResolved === true) {
      // If resolved with no outcome, it's SUSPECTED
      if (noSuccess && noNav && noDom) {
        rationaleSignals.push('LOADING_RESOLVED_NO_OUTCOME');
        return {
          type: 'loading_phantom_failure',
          status: 'SUSPECTED',
          confidence: calculateConfidence(signals, 'loading') * 0.65,
          rationaleSignals,
          reason: 'Loading resolved but no success feedback, navigation, or DOM change',
          expectationId: expectation.id,
          promiseValue: promise.value || promise.indicator,
        };
      }
      return null; // Loading resolved with outcome
    }

    // CONFIRM: Loading stalled (started, never resolved, observation complete)
    if (loadingPromiseExists && loadingStarted && loadingNeverResolved && runCompleteFlag && noSuccess && noNav && noDom) {
      rationaleSignals.push('LOADING_STARTED', 'LOADING_STALLED', 'NO_OUTCOME', 'RUN_COMPLETE');
      return {
        type: 'loading_phantom_failure',
        status: 'CONFIRMED',
        confidence: calculateConfidence(signals, 'loading'),
        rationaleSignals,
        reason: 'Loading indicator appeared but stalled (never resolved)',
        expectationId: expectation.id,
        promiseValue: promise.value || promise.indicator,
      };
    }

    // Incomplete observation
    if (loadingPromiseExists && loadingStarted && !runCompleteFlag) {
      rationaleSignals.push('INCOMPLETE_OBSERVATION');
      return {
        type: 'loading_phantom_failure',
        status: 'SUSPECTED',
        confidence: calculateConfidence(signals, 'loading') * 0.5,
        rationaleSignals,
        reason: 'Loading observed but observation window incomplete',
        expectationId: expectation.id,
        promiseValue: promise.value || promise.indicator,
      };
    }
  }

  // CLASS F: permission_wall_silent_failure
  // Promise: action is accessible and attempted (visible, enabled button)
  // CONFIRMED: attempted + blocked/403/silent-deny + no denial feedback + run complete
  if (promiseType === 'permission' || isPermissionWallPromise(promise, action)) {
    const actionPromiseExists = promise && (promise.value || promise.action || promise.description);
    const actionAttempted = observation && observation.attempted === true;
    const blockedOrDenied = (observation && observation.reason && 
                            (observation.reason.includes('blocked') || 
                             observation.reason.includes('403') ||
                             observation.reason.includes('401'))) || 
                           signals.silentBlock === true;
    const noDenialFeedback = !signals.feedbackSeen && !signals.ariaLiveUpdated;
    const noNav = !signals.navigationChanged;

    // DISCONFIRM: Denial feedback or redirect
    if (signals.feedbackSeen || signals.ariaLiveUpdated || signals.navigationChanged) {
      return null;
    }

    // CONFIRM: action attempted + blocked + no denial feedback + no redirect + complete
    if (actionPromiseExists && actionAttempted && blockedOrDenied && noDenialFeedback && noNav && runCompleteFlag) {
      rationaleSignals.push('ATTEMPT_CONFIRMED', 'BLOCKED_OR_403', 'NO_DENIAL_FEEDBACK', 'NO_REDIRECT', 'RUN_COMPLETE');
      return {
        type: 'permission_wall_silent_failure',
        status: 'CONFIRMED',
        confidence: calculateConfidence(signals, 'permission'),
        rationaleSignals,
        reason: 'Action attempted but silently blocked without denial message',
        expectationId: expectation.id,
        promiseValue: promise.value || promise.action || promise.description,
      };
    }

    // Incomplete observation
    if (actionPromiseExists && actionAttempted && blockedOrDenied && !runCompleteFlag) {
      rationaleSignals.push('INCOMPLETE_OBSERVATION');
      return {
        type: 'permission_wall_silent_failure',
        status: 'SUSPECTED',
        confidence: calculateConfidence(signals, 'permission') * 0.5,
        rationaleSignals,
        reason: 'Action attempted but observation window incomplete',
        expectationId: expectation.id,
        promiseValue: promise.value || promise.action || promise.description,
      };
    }
  }

  // No pattern matched - unknown type of failure
  return {
    type: 'unknown_silent_failure',
    status: 'SUSPECTED',
    confidence: calculateConfidence(signals, 'unknown'),
    rationaleSignals: ['UNCLASSIFIED'],
    reason: 'Attempted but not observed with evidence, type unclear',
    expectationId: expectation.id,
  };
}

/**
 * Helper: Check if promise is a permission wall.
 */
function isPermissionWallPromise(promise, action) {
  const promiseText = String((promise && (promise.value || promise.description || promise.action)) || '').toLowerCase();
  const actionText = String((action && (action.value || action.type)) || '').toLowerCase();
  const combined = `${promiseText} ${actionText}`;
  return combined.includes('permission') ||
         combined.includes('access') ||
         combined.includes('auth') ||
         combined.includes('403') ||
         combined.includes('401') ||
         combined.includes('blocked');
}

/**
 * Helper: Check if promise looks like navigation.
 */
function isNavigationPromise(promise) {
  if (!promise) return false;
  const value = String(promise.value || promise.text || '').toLowerCase();
  const text = String(promise.description || '').toLowerCase();
  return value.includes('navigate') || 
         value.includes('route') ||
         value.includes('link') ||
         text.includes('navigate') ||
         text.includes('route');
}

/**
 * Helper: Check if action is submit.
 */
function isSubmitAction(actionType, promise) {
  if (!actionType || !promise) return false;
  return actionType === 'submit' ||
         String(promise.value || '').toLowerCase().includes('submit') ||
         String(promise.description || '').toLowerCase().includes('submit');
}

/**
 * Helper: Check if action expects feedback.
 */
function isAsyncActionExpectingFeedback(promise, action) {
  if (!promise || !action) return false;
  const type = promise.description || promise.value || '';
  return String(type).toLowerCase().includes('feedback') ||
         String(type).toLowerCase().includes('async') ||
         String(type).toLowerCase().includes('click');
}

/**
 * Helper: Check if promise is a state mutation.
 */
function isStateChangeMutation(promise) {
  if (!promise) return false;
  const value = String(promise.value || promise.stateKey || '').toLowerCase();
  return value.includes('state') ||
         value.includes('dispatch') ||
         value.includes('set') ||
         value.includes('store');
}

/**
 * Helper: Check if promise is loading start.
 */
function isLoadingStartPromise(promise) {
  if (!promise) return false;
  const value = String(promise.value || promise.description || '').toLowerCase();
  return value.includes('loading') ||
         value.includes('spinner') ||
         value.includes('progress') ||
         value.includes('skeleton');
}

/**
 * For silent failures, we check:
 * - Attempt happened (critical gate)
 * - Observable signals present OR incomplete observation (incomplete is itself evidence)
 */
function hasSubstantiveEvidence(signals, observation) {
  if (!signals && !observation) return false;

  const sig = signals || {};
  const obs = observation || {};

  // Gate 1: Attempt must be provable
  const attemptProof = obs.attempted === true ||
                       sig.loadingStarted === true ||
                       sig.navigationChanged === true ||
                       sig.networkActivity === true ||
                       sig.meaningfulDomChange === true ||
                       sig.domChanged === true ||
                       sig.stateChanged === true ||
                       sig.feedbackSeen === true ||
                       sig.ariaLiveUpdated === true;

  // Gate 2: Observable signals OR incomplete observation
  // Observable signals = something changed/happened
  // Incomplete observation = runComplete=false (means we didn't observe full window, still valid for SUSPECTED)
  const hasObservableSignals = sig.navigationChanged ||
                               sig.networkActivity ||
                               sig.meaningfulDomChange ||
                               sig.feedbackSeen ||
                               sig.ariaLiveUpdated ||
                               sig.loadingStarted ||
                               sig.loadingResolved ||
                               sig.stateChanged ||
                               sig.silentBlock;
  const isIncompleteObservation = obs.runComplete === false;
  const isCompleteObservation = obs.runComplete === true;

  return attemptProof && (hasObservableSignals || isIncompleteObservation || isCompleteObservation);
}

/**
 * Calculate confidence based on strength of negative evidence (absence of outcome).
 * For silent failures, confidence is HIGH when:
 * - Promised outcome is definitively absent
 * - Observation window is complete
 * - Contradicting signals are absent (no feedback, no DOM change, no nav)
 */
function calculateConfidence(signals, classType) {
  if (!signals) return 0;

  let score = 0.5; // base confidence

  // Increase for strong NEGATIVE signals (proving silence):
  if (!signals.feedbackSeen && !signals.ariaLiveUpdated) score += 0.2; // no feedback
  if (!signals.meaningfulDomChange && !signals.domChanged) score += 0.15; // no DOM change
  if (!signals.navigationChanged) score += 0.15; // no navigation

  // Decrease confidence if contradicting signals exist:
  if (signals.feedbackSeen || signals.ariaLiveUpdated) score -= 0.25; // feedback contradicts silence
  if (signals.meaningfulDomChange || signals.domChanged) score -= 0.25; // DOM change contradicts silence
  if (signals.navigationChanged) score -= 0.25; // navigation contradicts silence

  // Class-specific adjustments
  if (classType === 'navigation') {
    if (signals.navigationChanged) score -= 0.3; // navigation is the specific promise
  } else if (classType === 'loading') {
    if (signals.loadingResolved) score += 0.05; // loading did resolve (even if with no outcome)
  } else if (classType === 'submit') {
    // Network activity is optional for submit silence, not a disconfirming signal
    if (signals.networkActivity && !signals.feedbackSeen && !signals.meaningfulDomChange) {
      score += 0.05; // network present but UI still silent = stronger evidence of one-way comms
    }
  }

  return Math.max(0, Math.min(1, score)); // clamp 0-1
}








