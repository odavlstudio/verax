import { createFinding } from '../../verax/detect/finding-contract.js';
import { batchValidateFindings } from '../../verax/detect/constitution-validator.js';

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
  
  // Must have attempted but no observable outcome
  if (!observation.attempted) {
    return null;
  }
  
  const noNav = !signals.navigationChanged;
  const noDomChange = !signals.meaningfulDomChange;
  const noFeedback = !signals.feedbackSeen;
  
  // Silent if: action attempted + no outcome in any channel
  if (noNav && noDomChange && noFeedback) {
    // PHASE X: Detect state context
    const stateContext = detectStateContext(observation, signals);
    const confidence = computeConfidence(signals, observation.evidenceFiles, stateContext);
    
    // PHASE X: Downgrade or suppress if state explains the no-change
    let status = 'SUSPECTED';
    if (stateContext.isEmpty || stateContext.isDisabled || stateContext.isNoOp) {
      status = 'INFORMATIONAL'; // Not a confirmed failure, just informational
    } else if (confidence >= 0.8) {
      status = 'CONFIRMED';
    }
    
    return {
      type: 'dead_interaction_silent_failure',
      status,
      severity: 'MEDIUM',
      confidence,
      promise: expectation.promise,
      observed: {
        result: 'Interaction was attempted but produced no observable outcome'
      },
      evidence: {
        action_attempted: true,
        navigation_changed: signals.navigationChanged,
        meaningful_dom_change: signals.meaningfulDomChange,
        feedback_seen: signals.feedbackSeen,
        evidence_files: observation.evidenceFiles || []
      },
      // PHASE X: Add enrichment with source linkage and state context
      enrichment: {
        stateContext: stateContext.reasons.length > 0 ? stateContext.reasons : undefined,
        selector: observation.selector || expectation.selector,
        promise_source: expectation.source || 'extracted',
        file: expectation.sourceFile,
        line: expectation.sourceLine
      },
      impact: `User interacted (${expectation.promise.value}) but received no feedback or change, creating expectation mismatch`
    };
  }
  
  return null;
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
  
  if (!observation.attempted) {
    return null;
  }

  if (observation.reason && observation.reason.includes('not-found')) {
    // Coverage gap / untestable, not a broken promise
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

    return {
      type: 'broken_navigation_promise',
      status,
      severity: 'HIGH',
      confidence,
      promise: expectation.promise,
      observed: {
        result: `Navigation to "${expectation.promise.value}" was attempted but no route change or acknowledgment occurred`
      },
      evidence: {
        action_attempted: true,
        navigation_changed: routeChanged,
        outcome_acknowledged: acknowledged,
        meaningful_ui_change: uiChanged,
        feedback_seen: feedbackSeen,
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
  }

  // Fallback to existing detection for non-runtime navigation promises
  if (!routeChanged) {
    const confidence = computeConfidence(signals, observation.evidenceFiles);
    
    return {
      type: 'broken_navigation_promise',
      status: confidence >= 0.7 ? 'CONFIRMED' : 'SUSPECTED',
      severity: 'HIGH',
      confidence,
      promise: expectation.promise,
      observed: {
        result: `Navigation to "${expectation.promise.value}" was not completed`
      },
      evidence: {
        action_attempted: true,
        navigation_changed: signals.navigationChanged,
        meaningful_dom_change: signals.domChanged,
        feedback_seen: signals.feedbackSeen,
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
  // Could be triggered by interaction with type 'submit' or direct form submission
  const isSubmitAction = observation.action === 'submit' || 
                        observation.type === 'interaction' && expectation.promise?.kind === 'submit';
  
  if (!isSubmitAction) {
    return null;
  }
  
  const signals = observation.signals || {};
  
  if (!observation.attempted) {
    return null;
  }
  
  const noNav = !signals.navigationChanged;
  const noDomChange = !signals.meaningfulDomChange;
  const noFeedback = !signals.feedbackSeen;
  
  // Silent submission: no acknowledgment of the action
  if (noNav && noDomChange && noFeedback) {
    const confidence = computeConfidence(signals, observation.evidenceFiles);
    
    return {
      type: 'silent_submission',
      status: confidence >= 0.7 ? 'CONFIRMED' : 'SUSPECTED',
      severity: 'HIGH', // Form submissions are critical for user flows
      confidence,
      promise: expectation.promise,
      observed: {
        result: 'Form submission was attempted but produced no observable confirmation'
      },
      evidence: {
        action_attempted: true,
        navigation_changed: signals.navigationChanged,
        meaningful_dom_change: signals.meaningfulDomChange,
        feedback_seen: signals.feedbackSeen,
        evidence_files: observation.evidenceFiles || []
      },
      // PHASE X: Add source linkage
      enrichment: {
        submission_attempted: true,
        network_activity: signals.networkActivity || signals.correlatedNetworkActivity,
        stateContext: undefined,
        selector: observation.selector || expectation.selector,
        promise_source: expectation.source || 'extracted',
        file: expectation.sourceFile,
        line: expectation.sourceLine
      },
      impact: `Form submission was attempted (${expectation.promise.value}) but no acknowledgment received, leaving user uncertain of success`
    };
  }
  
  return null;
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
  
  const candidates = [];
  
  // Match each observation to its expectation and detect failures
  for (const observation of observations) {
    const expectation = expectations.find(e => e.id === observation.id);
    if (!expectation) {
      continue; // Skip unmatched observations
    }
    
    // Try to detect each class of silent failure
    let finding = detectDeadInteraction(observation, expectation);
    if (finding) {
      candidates.push(finding);
      continue;
    }
    
    // @ts-expect-error - finding may have optional properties based on detection type
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
      impact: candidate.impact
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
