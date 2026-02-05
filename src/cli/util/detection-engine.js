import { createFinding } from '../../verax/detect/finding-contract.js';
import { batchValidateFindings } from '../../verax/detect/constitution-validator.js';
import { inferInteractionIntent, INTERACTION_INTENTS } from './observation/interaction-intent.js';
import { inferNavigationIntent, evaluateNavigationObservables, NAVIGATION_INTENTS } from './observation/navigation-intent.js';
import { inferSubmissionIntent, SUBMISSION_INTENTS } from './observation/submission-intent.js';
import { evaluateSilentFailureConfirmedEligibility, SILENT_FAILURE_TYPES } from './detection/silent-failure-confirmed-eligibility.js';

/**
 * Detection Engine — Convert learn + observe into findings
 * PHASE X: State-aware, source-linked, actionable findings
 * 
 * Implements 3 silent failure detection classes:
 * 1. dead_interaction_silent_failure — Click with no response
 * 2. broken_navigation_promise — Navigation intent without actual nav
 * 3. silent_submission — Form submission without acknowledgment
 * 
 * KEY CHANGES (PHASE X):
 * - Detects empty states, disabled buttons, no-op interactions
 * - Caps confidence at ≤0.4 for state-ambiguous findings
 * - Records stateContext in enrichment for transparency
 * - Links findings to source code (file, line, selector)
 */

/**
 * Detect state context that explains "no change" outcomes
 * Returns: { isEmpty, isDisabled, isNoOp, reasons: [] }
 */
function detectStateContext(observation, signals) {
  const reasons = [];
  let isEmpty = false;
  let isDisabled = false;
  let isNoOp = false;
  
  // Check for empty list/container indication
  const uiSignals = signals?.uiSignals || {};
  if (uiSignals.emptyState || uiSignals.noItems) {
    isEmpty = true;
    reasons.push('UI indicates empty state or no items to operate on');
  }
  
  // Check for disabled/aria-disabled buttons
  if (observation.beforeState?.disabledElements?.length > 0) {
    isDisabled = true;
    reasons.push(`Button was disabled before interaction (${observation.beforeState.disabledElements.map(e => e.text).join(', ')})`);
  }
  
  // Check interaction label context
  if (observation.interactionLabel) {
    const label = observation.interactionLabel.toLowerCase();
    if (label.includes('clear') && isEmpty) {
      isNoOp = true;
      reasons.push('Clear action on empty list is valid no-op behavior');
    }
    if (label.includes('delete') && isEmpty) {
      isNoOp = true;
      reasons.push('Delete action on empty list is valid no-op behavior');
    }
  }
  
  return { isEmpty, isDisabled, isNoOp, reasons };
}

/**
 * PHASE X: Deterministic confidence formula with state awareness
 * 
 * Base: 0.6 (candidate silent failure exists)
 * State adjustments:
 *  CAP at 0.3 if empty state (button works, just nothing to do)
 *  CAP at 0.3 if button is disabled (expected no-op)
 *  CAP at 0.2 if marked as no-op behavior
 * Evidence adjustments:
 *  +0.1 if screenshots exist
 *  +0.1 if DOM diff exists
 *  +0.1 if network activity
 * Ambiguity reducers:
 *  -0.2 if console errors
 *  -0.2 if browser protection
 * Range: [0, 1]
 */
function computeConfidence(signals, evidenceFiles, stateContext) {
  let confidence = 0.6; // Base for candidate
  
  // PHASE X: State awareness caps confidence
  if (stateContext?.isEmpty) {
    confidence = Math.min(confidence, 0.3); // Empty state reduces confidence
  }
  if (stateContext?.isDisabled) {
    confidence = Math.min(confidence, 0.3); // Disabled is expected
  }
  if (stateContext?.isNoOp) {
    confidence = Math.min(confidence, 0.2); // Valid no-op behavior
  }
  
  // Evidence quality indicators (only if state doesn't explain it)
  if (!stateContext?.isEmpty && !stateContext?.isDisabled) {
    if (evidenceFiles && evidenceFiles.length > 0) {
      const hasScreenshots = evidenceFiles.some(f => f.endsWith('.png'));
      const hasDomDiff = evidenceFiles.some(f => f.includes('dom_diff'));
      
      if (hasScreenshots) confidence += 0.1;
      if (hasDomDiff) confidence += 0.1;
    }
    
    if (signals?.correlatedNetworkActivity) {
      confidence += 0.1;
    }
  }
  
  // Ambiguity reducers
  if (signals?.consoleErrors) {
    confidence -= 0.2;
  }
  if (signals?.blockedWrites) {
    confidence -= 0.2;
  }
  
  return Math.max(0, Math.min(1, confidence));
}

function computeRuntimeNavConfidence(signals, evidenceFiles, routeData, blockedWrites = false) {
  let confidence = 0.85;

  const hasRouteEvidence = routeData && (routeData.before || routeData.after || (Array.isArray(routeData.transitions) && routeData.transitions.length > 0));
  if (hasRouteEvidence) {
    confidence += 0.05;
  }

  if (evidenceFiles && evidenceFiles.some(f => f.endsWith('.png'))) {
    confidence += 0.05;
  }

  if (signals?.consoleErrors) {
    confidence -= 0.2;
  }

  if (blockedWrites) {
    confidence -= 0.2;
  }

  if (confidence < 0) confidence = 0;
  if (confidence > 1) confidence = 1;

  return confidence;
}

function isActionableElementSnapshot(elementSnapshot) {
  if (!elementSnapshot || typeof elementSnapshot !== 'object') return false;
  if (elementSnapshot.disabled === true || elementSnapshot.ariaDisabled === true) return false;
  if (elementSnapshot.visible !== true) return false;
  const box = elementSnapshot.boundingBox || {};
  if ((box.width ?? 0) <= 0 || (box.height ?? 0) <= 0) return false;
  return true;
}

function hasStateComparisonEvidence(evidenceFiles) {
  if (!Array.isArray(evidenceFiles)) return false;
  const hasBefore = evidenceFiles.some(f => typeof f === 'string' && f.includes('before') && f.endsWith('.png'));
  const hasAfter = evidenceFiles.some(f => typeof f === 'string' && f.includes('after') && f.endsWith('.png'));
  const hasDomDiff = evidenceFiles.some(f => typeof f === 'string' && f.includes('dom_diff') && f.endsWith('.json'));
  return hasBefore && hasAfter && hasDomDiff;
}

function extractBeforeAfterScreenshots(evidenceFiles) {
  if (!Array.isArray(evidenceFiles)) return { before: null, after: null };
  const before = evidenceFiles.find(f => typeof f === 'string' && f.includes('before') && f.endsWith('.png')) || null;
  const after = evidenceFiles.find(f => typeof f === 'string' && f.includes('after') && f.endsWith('.png')) || null;
  return { before, after };
}

function capReasonStrings(reasons) {
  if (!Array.isArray(reasons)) return [];
  return reasons
    .filter(r => typeof r === 'string' && r.length > 0)
    .slice(0, 8)
    .map(r => (r.length > 80 ? r.slice(0, 80) : r));
}

function recordIntentBlockedSilence(observation, intentResult) {
  if (!observation || typeof observation !== 'object') return;

  // Avoid overwriting if something already recorded
  if (observation.silenceDetected) return;

  const expectationId = observation.id || observation.expectationId || null;
  observation.silenceDetected = {
    kind: 'intent_blocked',
    code: 'unknown_click_intent',
    scope: 'interaction',
    action: 'click',
    expectationId,
    intent: intentResult?.intent || 'UNKNOWN_INTENT',
    intentReasons: capReasonStrings(intentResult?.reasons),
  };
}

function recordNavigationAmbiguousSilence(observation, navIntentResult, code = 'navigation_intent_unresolved', extra = {}) {
  if (!observation || typeof observation !== 'object') return;
  if (observation.silenceDetected) return;

  const expectationId = observation.id || observation.expectationId || null;
  observation.silenceDetected = {
    kind: 'navigation_ambiguous',
    code,
    scope: 'interaction',
    action: 'click',
    expectationId,
    intent: navIntentResult?.intent || NAVIGATION_INTENTS.UNKNOWN_NAV_INTENT,
    intentReasons: capReasonStrings(navIntentResult?.reasons),
    ...extra,
  };
}

function recordSubmissionAmbiguousSilence(observation, submissionIntentResult, code, extra = {}) {
  if (!observation || typeof observation !== 'object') return;
  if (observation.silenceDetected) return;

  const expectationId = observation.id || observation.expectationId || null;
  observation.silenceDetected = {
    kind: 'submission_ambiguous',
    code,
    scope: 'interaction',
    action: 'submit',
    expectationId,
    intent: submissionIntentResult?.intent || SUBMISSION_INTENTS.UNKNOWN_SUBMISSION_INTENT,
    intentReasons: capReasonStrings(submissionIntentResult?.reasons),
    ...extra,
  };
}

function didToggleStateChange(elementSnapshot) {
  const delta = elementSnapshot?.delta;
  if (!delta || typeof delta !== 'object') return false;
  return delta.ariaExpandedChanged === true ||
    delta.ariaPressedChanged === true ||
    delta.ariaCheckedChanged === true ||
    delta.controlCheckedChanged === true;
}

function observablesShowEffect(intent, signals, elementSnapshot) {
  const sig = signals || {};
  const navChanged = sig.navigationChanged === true || sig.routeChanged === true;
  const feedback = sig.feedbackSeen === true || sig.ariaLiveUpdated === true || sig.ariaRoleAlertsDetected === true;
  const meaningfulDom = sig.meaningfulDomChange === true || sig.meaningfulUIChange === true;
  const networkAttempt = sig.correlatedNetworkActivity === true || sig.networkActivity === true;

  switch (intent) {
    case INTERACTION_INTENTS.NAVIGATION_INTENT:
      return navChanged;
    case INTERACTION_INTENTS.SUBMISSION_INTENT:
      return navChanged || networkAttempt || feedback;
    case INTERACTION_INTENTS.ASYNC_FEEDBACK_INTENT:
      return feedback || meaningfulDom || networkAttempt;
    case INTERACTION_INTENTS.TOGGLE_INTENT:
      return didToggleStateChange(elementSnapshot) || meaningfulDom;
    case INTERACTION_INTENTS.UNKNOWN_INTENT:
    default:
      return false;
  }
}

/**
 * PHASE X: Detect dead interaction silent failure
 * 
 * Pattern: Action attempted (click) but:
 *  - No navigation change
 *  - No meaningful DOM change
 *  - No feedback seen
 * 
 * PLUS: Detect state context that explains the "no change"
 * Empty states, disabled buttons should not produce CONFIRMED findings
 */
function detectDeadInteraction(observation, expectation) {
  if (observation.type !== 'interaction' || observation.action !== 'click') {
    return null;
  }
  
  const signals = observation.signals || {};
  
  // Must have attempted and successfully executed the action
  if (!observation.attempted || observation.actionSuccess !== true) {
    return null;
  }

  const elementSnapshot = observation.evidence?.interactionIntent?.record || null;
  
  // Must have a valid actionable element snapshot (proves action targeted a real element)
  if (!isActionableElementSnapshot(elementSnapshot)) {
    return null;
  }

  // Must have a state-comparison evidence bundle (before/after + dom diff) to prove "no effect"
  if (!hasStateComparisonEvidence(observation.evidenceFiles)) {
    return null;
  }

  const intentResult = inferInteractionIntent({ elementSnapshot, actionType: 'click' });

  // Unknown intent: do NOT emit a finding, but DO record an auditable silence/gap signal.
  if (intentResult.intent === INTERACTION_INTENTS.UNKNOWN_INTENT) {
    recordIntentBlockedSilence(observation, intentResult);
    return null;
  }

  // If any intent-specific observable indicates an effect, it is NOT a dead interaction.
  if (observablesShowEffect(intentResult.intent, signals, elementSnapshot)) {
    return null;
  }

  // PHASE X: Detect state context
  const stateContext = detectStateContext(observation, signals);

  let status = 'CONFIRMED';
  if (stateContext.isEmpty || stateContext.isDisabled || stateContext.isNoOp) {
    status = 'INFORMATIONAL';
  }

  const { before: beforeScreenshot, after: afterScreenshot } = extractBeforeAfterScreenshots(observation.evidenceFiles);
  const confidence = status === 'CONFIRMED' ? 0.9 : computeConfidence(signals, observation.evidenceFiles, stateContext);

  const baseFinding = {
    type: 'dead_interaction_silent_failure',
    status,
    severity: 'MEDIUM',
    confidence,
    promise: expectation.promise,
    observed: {
      result: `Click was executed (${intentResult.intent}) but produced no intent-satisfying observable effect`
    },
    evidence: {
      action_attempted: true,
      action_executed: true,
      intent: intentResult.intent,
      intent_reasons: intentResult.reasons,
      navigation_changed: signals.navigationChanged === true || signals.routeChanged === true,
      feedback_seen: signals.feedbackSeen === true || signals.ariaLiveUpdated === true || signals.ariaRoleAlertsDetected === true,
      meaningful_dom_change: signals.meaningfulDomChange === true || signals.meaningfulUIChange === true,
      network_attempt: signals.correlatedNetworkActivity === true || signals.networkActivity === true,
      toggle_state_changed: didToggleStateChange(elementSnapshot),
      before_screenshot: beforeScreenshot,
      after_screenshot: afterScreenshot,
      evidence_files: observation.evidenceFiles || []
    },
    enrichment: {
      stateContext: stateContext.reasons.length > 0 ? stateContext.reasons : undefined,
      selector: observation.selector || expectation.selector,
      promise_source: expectation.source || 'extracted',
      file: expectation.sourceFile,
      line: expectation.sourceLine
    },
    impact: `User interacted (${expectation.promise.value}) but no observable effect occurred for the inferred intent (${intentResult.intent})`
  };

  if (baseFinding.status === 'CONFIRMED') {
    const eligibility = evaluateSilentFailureConfirmedEligibility({
      type: SILENT_FAILURE_TYPES.DEAD_INTERACTION,
      attempted: observation.attempted === true,
      actionSuccess: observation.actionSuccess === true,
      intent: intentResult.intent,
      signals,
      elementSnapshotActionable: true,
      evidenceFiles: observation.evidenceFiles || [],
      routeData: observation.evidence?.routeData || null,
    });
    if (!eligibility.eligible) {
      return {
        ...baseFinding,
        status: 'SUSPECTED',
        enrichment: {
          ...(baseFinding.enrichment || {}),
          confirmedEligibilityMissing: eligibility.missing,
        },
      };
    }
  }

  return baseFinding;
}

/**
 * PHASE X: Detect broken navigation promise
 * 
 * Pattern: Navigation intent (href, router push) but:
 *  - URL did not change
 *  - No navigation event occurred
 * 
 * PLUS: Include source linkage for navigation targets
 */
function detectBrokenNavigation(observation, expectation) {
  if (observation.type !== 'navigation') {
    return null;
  }
  
  const signals = observation.signals || {};
  const isRuntimeNav = observation.isRuntimeNav === true || expectation.isRuntimeNav === true || expectation.kind === 'navigation.runtime' || observation.source?.type === 'runtime-dom';
  
  // Must have attempted and executed the action (otherwise it's blocked/timeout, not a broken promise)
  if (!observation.attempted || observation.actionSuccess !== true) {
    return null;
  }

  if (observation.reason && observation.reason.includes('not-found')) {
    // Coverage gap / untestable, not a broken promise
    return null;
  }

  // Must have a state-comparison evidence bundle to prove "no effect"
  if (!hasStateComparisonEvidence(observation.evidenceFiles)) {
    return null;
  }

  const elementSnapshot = observation.evidence?.interactionIntent?.record || null;
  const runtimeNav = observation.runtimeNav || expectation.runtimeNav || null;
  const navIntent = inferNavigationIntent({ elementSnapshot, runtimeNav, expectation });

  // Unknown/ambiguous intent: never emit broken_navigation_promise; record auditable silence.
  if (navIntent.intent === NAVIGATION_INTENTS.UNKNOWN_NAV_INTENT) {
    // Only record when we otherwise qualified for evaluation (attempted + actionSuccess + actionable snapshot OR runtimeNav exists)
    const qualifies = (runtimeNav && typeof runtimeNav.href === 'string') || isActionableElementSnapshot(elementSnapshot);
    if (qualifies) {
      recordNavigationAmbiguousSilence(observation, navIntent, 'navigation_intent_unresolved');
    }
    return null;
  }

  // Intent-specific observable contract
  const routeData = observation.evidence?.routeData || null;
  const navObs = evaluateNavigationObservables(navIntent.intent, signals, routeData);
  if (!navObs.observablesAvailable) {
    recordNavigationAmbiguousSilence(observation, navIntent, 'navigation_observables_unavailable', { details: navObs.details });
    return null;
  }

  // If any intent-specific observable indicates an effect, it is NOT a broken navigation promise.
  if (navObs.effectObserved) {
    return null;
  }
  
  const uiChanged = signals.meaningfulUIChange || signals.meaningfulDomChange;
  const routeChanged = signals.routeChanged || signals.navigationChanged;
  const acknowledged = signals.outcomeAcknowledged === true;
  const feedbackSeen = signals.feedbackSeen === true;

  // Runtime navigation failure: no route change, no acknowledgment, no meaningful UI change
  if (isRuntimeNav && !routeChanged && !acknowledged && !uiChanged && !feedbackSeen) {
    const routeData = observation.evidence?.routeData;
    let confidence = computeRuntimeNavConfidence(signals, observation.evidenceFiles, routeData, signals.blockedWrites);
    if (observation.runtimeNav?.context?.kind === 'iframe') {
      confidence = Math.max(0, confidence - 0.1);
    }
    const hasEvidence = (observation.evidenceFiles || []).length > 0 || !!routeData;
    const status = confidence >= 0.85 && hasEvidence ? 'CONFIRMED' : 'SUSPECTED';
    const beforeScreenshot = (observation.evidenceFiles || []).find(f => f.includes('before')) || null;
    const afterScreenshot = (observation.evidenceFiles || []).find(f => f.includes('after')) || null;

    const baseFinding = {
      type: 'broken_navigation_promise',
      status,
      severity: 'HIGH',
      confidence,
      promise: expectation.promise,
      observed: {
        result: `Navigation (${navIntent.intent}) to "${expectation.promise.value}" was attempted but no intent-satisfying observable occurred`
      },
      evidence: {
        action_attempted: true,
        navigation_changed: routeChanged,
        outcome_acknowledged: acknowledged,
        meaningful_ui_change: uiChanged,
        feedback_seen: feedbackSeen,
        navigation_intent: navIntent.intent,
        navigation_intent_reasons: navIntent.reasons,
        navigation_observable_contract: navObs.details,
        route_data: routeData || null,
        outcome_watcher: observation.evidence?.outcomeWatcher || null,
        mutation_summary: observation.evidence?.mutationSummary || null,
        blocked_writes: signals.blockedWrites || false,
        before_screenshot: beforeScreenshot,
        after_screenshot: afterScreenshot,
        evidence_files: observation.evidenceFiles || [],
      },
      enrichment: {
        intended_destination: expectation.promise.value,
        selector: observation.runtimeNav?.selectorPath || observation.selector || expectation.selector,
        promise_source: expectation.source || 'runtime-dom',
        file: expectation.sourceFile,
        line: expectation.sourceLine,
        runtimeTargetId: observation.runtimeNav?.targetId || expectation.runtimeNav?.targetId,
      },
      impact: `Navigation to ${expectation.promise.value} was promised but did not occur, breaking user flow`
    };

    if (baseFinding.status === 'CONFIRMED') {
      const eligibility = evaluateSilentFailureConfirmedEligibility({
        type: SILENT_FAILURE_TYPES.BROKEN_NAV,
        attempted: observation.attempted === true,
        actionSuccess: observation.actionSuccess === true,
        navIntent: navIntent.intent,
        navObservablesAvailable: navObs.observablesAvailable === true,
        signals,
        elementSnapshotActionable: (runtimeNav && typeof runtimeNav.href === 'string')
          ? true
          : isActionableElementSnapshot(elementSnapshot),
        evidenceFiles: observation.evidenceFiles || [],
        routeData: routeData || null,
      });
      if (!eligibility.eligible) {
        return {
          ...baseFinding,
          status: 'SUSPECTED',
          enrichment: {
            ...(baseFinding.enrichment || {}),
            confirmedEligibilityMissing: eligibility.missing,
          },
        };
      }
    }

    return baseFinding;
  }

  // Fallback to existing detection for non-runtime navigation promises
  if (!routeChanged) {
    const confidence = computeConfidence(signals, observation.evidenceFiles);
    
    const baseFinding = {
      type: 'broken_navigation_promise',
      status: confidence >= 0.7 ? 'CONFIRMED' : 'SUSPECTED',
      severity: 'HIGH',
      confidence,
      promise: expectation.promise,
      observed: {
        result: `Navigation (${navIntent.intent}) to "${expectation.promise.value}" was attempted but no intent-satisfying observable occurred`
      },
      evidence: {
        action_attempted: true,
        navigation_changed: signals.navigationChanged,
        meaningful_dom_change: signals.domChanged,
        feedback_seen: signals.feedbackSeen,
        navigation_intent: navIntent.intent,
        navigation_intent_reasons: navIntent.reasons,
        navigation_observable_contract: navObs.details,
        evidence_files: observation.evidenceFiles || []
      },
      enrichment: {
        intended_destination: expectation.promise.value,
        stateContext: undefined,
        selector: observation.selector || expectation.selector,
        promise_source: expectation.source || 'extracted',
        file: expectation.sourceFile,
        line: expectation.sourceLine
      },
      impact: `Navigation to ${expectation.promise.value} was promised but did not occur, breaking user flow`
    };

    if (baseFinding.status === 'CONFIRMED') {
      const eligibility = evaluateSilentFailureConfirmedEligibility({
        type: SILENT_FAILURE_TYPES.BROKEN_NAV,
        attempted: observation.attempted === true,
        actionSuccess: observation.actionSuccess === true,
        navIntent: navIntent.intent,
        navObservablesAvailable: navObs.observablesAvailable === true,
        signals,
        elementSnapshotActionable: isActionableElementSnapshot(elementSnapshot),
        evidenceFiles: observation.evidenceFiles || [],
        routeData: observation.evidence?.routeData || null,
      });
      if (!eligibility.eligible) {
        return {
          ...baseFinding,
          status: 'SUSPECTED',
          enrichment: {
            ...(baseFinding.enrichment || {}),
            confirmedEligibilityMissing: eligibility.missing,
          },
        };
      }
    }

    return baseFinding;
  }
  
  return null;
}

/**
 * PHASE X: Detect silent submission
 * 
 * Pattern: Form submission action but:
 *  - No navigation occurred
 *  - No meaningful DOM change
 *  - No feedback (success/error message)
 * 
 * PLUS: Include source linkage for forms
 */
function detectSilentSubmission(observation, expectation) {
  const isSubmitAction = observation.action === 'submit' ||
    (observation.type === 'interaction' && expectation.promise?.kind === 'submit');

  if (!isSubmitAction) return null;

  // Silence contracts apply only when we truly attempted and the action was executed.
  if (!observation.attempted || observation.actionSuccess !== true) return null;

  const signals = observation.signals || {};
  const evidenceFiles = observation.evidenceFiles || [];

  // Strict evidence gate: must have before/after screenshots + DOM diff
  if (!hasStateComparisonEvidence(evidenceFiles)) {
    recordSubmissionAmbiguousSilence(
      observation,
      null,
      'submission_observables_unavailable',
      { details: { missing: 'state_comparison_evidence' } }
    );
    return null;
  }

  const elementSnapshot = observation.evidence?.interactionIntent?.record || null;
  const intentResult = inferSubmissionIntent({ elementSnapshot, actionType: 'submit' });

  if (intentResult.intent === SUBMISSION_INTENTS.UNKNOWN_SUBMISSION_INTENT) {
    recordSubmissionAmbiguousSilence(observation, intentResult, 'unknown_submission_intent');
    return null;
  }

  const submissionTriggered = signals.submissionTriggered;
  if (submissionTriggered !== true) {
    if (submissionTriggered === false) {
      recordSubmissionAmbiguousSilence(observation, intentResult, 'submission_not_triggered');
    } else {
      recordSubmissionAmbiguousSilence(
        observation,
        intentResult,
        'submission_observables_unavailable',
        { details: { missing: 'submissionTriggered' } }
      );
    }
    return null;
  }

  const netAfter = signals.networkAttemptAfterSubmit;
  if (netAfter !== true && netAfter !== false) {
    recordSubmissionAmbiguousSilence(
      observation,
      intentResult,
      'submission_observables_unavailable',
      { details: { missing: 'networkAttemptAfterSubmit' } }
    );
    return null;
  }

  const navigationChanged = signals.navigationChanged === true || signals.routeChanged === true;
  const feedbackSeen = signals.feedbackSeen === true || signals.ariaLiveUpdated === true || signals.ariaRoleAlertsDetected === true;
  const meaningfulDelta = signals.meaningfulDomChange === true || signals.meaningfulUIChange === true;
  const networkAttemptAfterSubmit = netAfter === true;

  const anyEffect = navigationChanged || feedbackSeen || meaningfulDelta || networkAttemptAfterSubmit;
  if (anyEffect) return null;

  const confidence = computeConfidence(signals, evidenceFiles);
  const { before: beforeScreenshot, after: afterScreenshot } = extractBeforeAfterScreenshots(evidenceFiles);

  const baseFinding = {
    type: 'silent_submission',
    status: confidence >= 0.7 ? 'CONFIRMED' : 'SUSPECTED',
    severity: 'HIGH',
    confidence,
    promise: expectation.promise,
    observed: {
      result: 'Form submission was triggered but produced no observable acknowledgment'
    },
    evidence: {
      action_attempted: true,
      action_success: true,
      submission_intent: intentResult.intent,
      submission_intent_reasons: intentResult.reasons,
      submission_triggered: true,
      network_attempt_after_submit: networkAttemptAfterSubmit,
      navigation_changed: navigationChanged,
      feedback_seen: feedbackSeen,
      meaningful_dom_change: signals.meaningfulDomChange === true,
      meaningful_ui_change: signals.meaningfulUIChange === true,
      before_screenshot: beforeScreenshot,
      after_screenshot: afterScreenshot,
      evidence_files: evidenceFiles,
    },
    enrichment: {
      promise_source: expectation.source || 'extracted',
      file: expectation.sourceFile,
      line: expectation.sourceLine
    },
    impact: 'Form submission was triggered but the user saw no confirmation, error, navigation, or visible effect'
  };

  if (baseFinding.status === 'CONFIRMED') {
    const eligibility = evaluateSilentFailureConfirmedEligibility({
      type: SILENT_FAILURE_TYPES.SILENT_SUBMISSION,
      attempted: observation.attempted === true,
      actionSuccess: observation.actionSuccess === true,
      submissionTriggered: signals.submissionTriggered === true,
      signals,
      elementSnapshotActionable: true,
      evidenceFiles,
      routeData: observation.evidence?.routeData || null,
    });
    if (!eligibility.eligible) {
      return {
        ...baseFinding,
        status: 'SUSPECTED',
        enrichment: {
          ...(baseFinding.enrichment || {}),
          confirmedEligibilityMissing: eligibility.missing,
        },
      };
    }
  }

  return baseFinding;
}

/**
 * PHASE 3: Detect interaction-based silent failures
 * Finds intentful interactions that received no acknowledgment
 * 
 * @param {Array} observations - All observation attempts
 * @returns {Array} Candidates for interaction_silent_failure findings
 */
function detectInteractionSilentFailures(observations) {
  const candidates = [];
  
  for (const observation of observations) {
    // Only process if interaction intent was recorded
    if (!observation.evidence?.interactionIntent) {
      continue;
    }
    
    const intent = observation.evidence.interactionIntent;
    
    // Skip if intent classification is missing
    if (!intent.classification) {
      continue;
    }
    
    // Only flag if interaction was INTENTFUL
    if (!intent.classification.intentful) {
      continue;
    }
    
    // Check if interaction was acknowledged
    const hasAcknowledgment = observation.evidence?.interactionAcknowledgment?.acknowledged;
    
    if (!hasAcknowledgment) {
      // INTENTFUL + NO ACKNOWLEDGMENT = SILENT FAILURE
      const candidate = {
        type: 'interaction_silent_failure',
        status: 'SUSPECTED', // Interaction intent + no acknowledgment = strong signal but not 100% certain
        severity: 'MEDIUM',
        confidence: 0.8, // Base confidence for observable intent
        promise: {
          id: `interaction_${observation.id}`,
          type: 'interaction',
          value: `User interaction with ${intent.record.tagName.toLowerCase()} element (${intent.record.ariaLabel || intent.record.id || 'unlabeled'}) had no observable effect`,
          promise_source: 'runtime-intent',
          element: {
            tagName: intent.record.tagName,
            role: intent.record.role,
            ariaLabel: intent.record.ariaLabel,
            id: intent.record.id,
            selectorPath: intent.record.selectorPath
          }
        },
        observed: {
          acknowledgment_signals: observation.evidence?.interactionAcknowledgment?.signals || [],
          signal_count: observation.evidence?.interactionAcknowledgment?.signalCount || 0,
          outcome_watcher_result: observation.evidence?.outcomeWatcher || null,
          mutation_summary: observation.evidence?.mutationSummary || null
        },
        evidence: {
          before_screenshot: observation.evidence?.files?.find(f => f.includes('before')) || null,
          after_screenshot: observation.evidence?.files?.find(f => f.includes('after')) || null,
          interaction_intent_record: intent.record,
          interaction_intent_classification: intent.classification
        },
        impact: `User action was visible and interactable, but had no observable effect on the application state or UI`
      };
      
      candidates.push(candidate);
    }
  }
  
  return candidates;
}

/**
 * Detect silent failures
 * 
 * @param {Object} learnData - {expectations, ...}
 * @param {Object} observeData - {observations, ...}
 * @returns {Promise<Array>} Array of finding objects
 */
export async function detectSilentFailures(learnData, observeData) {
  const runtimeExpectations = observeData?.runtimeExpectations || [];
  const expectations = [...(learnData?.expectations || []), ...runtimeExpectations];
  const observations = observeData?.observations || [];
  
  if (observations.length === 0) {
    return [];
  }
  
  /** @type {any[]} */
  const candidates = [];
  
  // Match each observation to its expectation and detect failures
  for (const observation of observations) {
    const expectation = expectations.find(e => e.id === observation.id);
    if (!expectation) {
      continue; // Skip unmatched observations
    }
    
    // Try to detect each class of silent failure
    /** @type {any} */
    let finding = detectDeadInteraction(observation, expectation);
    if (finding) {
      candidates.push(finding);
      continue;
    }
    
    finding = detectBrokenNavigation(observation, expectation);
    if (finding) {
      candidates.push(finding);
      continue;
    }
    
    finding = detectSilentSubmission(observation, expectation);
    if (finding) {
      candidates.push(finding);
      continue;
    }
  }
  const interactionFindings = detectInteractionSilentFailures(observations);
  candidates.push(...interactionFindings);
  
  // Convert candidates to constitutional findings
  const findings = candidates.map(candidate => {
    const finding = createFinding({
      type: candidate.type,
      status: candidate.status,
      severity: candidate.severity,
      confidence: candidate.confidence,
      promise: candidate.promise,
      observed: candidate.observed,
      evidence: candidate.evidence,
      impact: candidate.impact,
      enrichment: candidate.enrichment || undefined,
      interaction: candidate.interaction || undefined,
    });
    return finding;
  });
  
  // TRUST SURFACE LOCK: Enforce finding ID uniqueness
  // IDs are generated by computeFindingIdentity (deterministic hash)
  // but we must ensure no duplicates in the final array
  const seenIds = new Set();
  const uniqueFindings = [];
  for (const finding of findings) {
    if (!seenIds.has(finding.id)) {
      seenIds.add(finding.id);
      uniqueFindings.push(finding);
    }
  }
  
  // Validate all findings through constitution before returning
  const { valid } = batchValidateFindings(uniqueFindings);
  
  return valid;
}
