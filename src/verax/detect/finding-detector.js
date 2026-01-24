/**
 * Finding Detector - Pure finding creation from trace analysis
 * 
 * Contains logic to create finding objects from:
 * - Expectation-driven execution outcomes
 * - Observed expectation breaks
 * - Flow failures
 * 
 * PHASE 2: All findings include explicit outcome classification and purely factual wording.
 * PHASE 3: All findings include Promise awareness - which promise was evaluated/unmet.
 * 
 * All functions are pure (no file I/O, no side effects).
 */

import { hasMeaningfulUrlChange, hasVisibleChange, hasDomChange } from './comparison.js';
import { computeConfidence } from '../core/confidence/index.js';
import { generateHumanSummary, generateActionHint, deriveConfidenceExplanation } from './explanation-helpers.js';
import { mapFindingTypeToOutcome } from '../core/canonical-outcomes.js';
import { inferPromiseFromInteraction } from '../core/promise-model.js';

/**
 * Map finding type to confidence engine type.
 */
export function mapFindingTypeToConfidenceType(findingType) {
  if (findingType === 'silent_failure') {
    return 'no_effect_silent_failure';
  }
  if (findingType === 'flow_silent_failure') {
    return 'no_effect_silent_failure';
  }
  if (findingType === 'observed_break') {
    return 'no_effect_silent_failure';
  }
  return findingType;
}

/**
 * Compute confidence for a finding.
 */
export function computeFindingConfidence(finding, matchedExpectation, trace, comparisons) {
  const sensors = trace.sensors || {};
  const findingType = mapFindingTypeToConfidenceType(finding.type);
  
  const confidence = computeConfidence({
    findingType,
    expectation: matchedExpectation || {},
    sensors: {
      network: sensors.network || {},
      console: sensors.console || {},
      uiSignals: sensors.uiSignals || {}
    },
    comparisons: {
      hasUrlChange: comparisons.hasUrlChange || false,
      hasDomChange: comparisons.hasDomChange || false,
      hasVisibleChange: comparisons.hasVisibleChange || false
    },
    attemptMeta: {},
    evidenceIntent: null,
    guardrailsOutcome: null,
    truthStatus: 'SUSPECTED',
    evidence: {},
    options: {}
  });
  
  return confidence;
}

/**
 * Enrich finding with Phase 9 explanation fields: humanSummary, actionHint.
 */
export function enrichFindingWithExplanations(finding, trace) {
  // Add human summary
  finding.humanSummary = generateHumanSummary(finding, trace);
  
  // Add action hint
  finding.actionHint = generateActionHint(finding, finding.confidence);

  // Add confidence explanation (Phase 9)
  finding.confidenceExplanation = deriveConfidenceExplanation(
    finding.confidence || {},
    finding.type
  );
  
  return finding;
}

/**
 * PHASE 3: Bind Promise to finding
 * 
 * Infers the promise from the interaction context and attaches it to the finding.
 * All findings must have a promise descriptor.
 */
export function bindPromiseToFinding(finding, trace) {
  const interaction = trace.interaction || {};
  
  // Infer promise from interaction type/label
  const promise = inferPromiseFromInteraction(interaction);
  
  if (promise) {
    finding.promise = promise;
  } else {
    // No promise could be inferred - mark as unproven
    finding.promise = {
      type: 'UNPROVEN_INTERACTION',
      source: 'unknown',
      expected_signal: 'Unknown',
      reason: 'Could not infer promise from interaction type'
    };
  }
  
  return finding;
}

/**
 * Create finding from expectation-driven execution outcome.
 * Called when expectation execution resulted in SILENT_FAILURE.
 */
export function createFindingFromExpectationOutcome(expectation, trace, beforeUrl, afterUrl, beforeScreenshot, afterScreenshot, projectDir, _manifest) {
  const interaction = trace.interaction;
  const sensors = trace.sensors || {};
  
  if (expectation.type === 'navigation' || expectation.type === 'spa_navigation') {
    const finding = {
      outcome: mapFindingTypeToOutcome('navigation_silent_failure'),
      type: 'navigation_silent_failure',
      interaction: {
        type: interaction.type,
        selector: interaction.selector,
        label: interaction.label
      },
      what_happened: 'User action executed',
      what_was_expected: `Navigation to ${expectation.targetPath || expectation.expectedTarget || 'target URL'}`,
      what_was_observed: 'No URL change, no user-visible feedback provided',
      why_it_matters: 'User took action expecting navigation but received no confirmation of success or failure',
      evidence: {
        before: beforeScreenshot,
        after: afterScreenshot,
        beforeUrl: beforeUrl,
        afterUrl: afterUrl,
        expectedTarget: expectation.targetPath || expectation.expectedTarget || '',
        targetReached: false,
        urlChanged: sensors.navigation?.urlChanged === true,
        historyLengthDelta: sensors.navigation?.historyLengthDelta || 0,
        uiFeedback: sensors.uiSignals?.diff?.changed === true
      }
    };
    
    const hasUrlChange = sensors.navigation?.urlChanged === true || hasMeaningfulUrlChange(beforeUrl, afterUrl);
    finding.confidence = computeFindingConfidence(
      finding,
      expectation,
      trace,
      { hasUrlChange, hasDomChange: false, hasVisibleChange: false }
    );
    
    bindPromiseToFinding(finding, trace);
    enrichFindingWithExplanations(finding, trace);
    return finding;
  }
  
  if (expectation.type === 'network_action') {
    const networkData = sensors.network || {};
    const hasRequest = networkData.totalRequests > 0;
    const hasFailed = networkData.failedRequests > 0;
    
    if (!hasRequest) {
      const finding = {
        outcome: mapFindingTypeToOutcome('missing_network_action'),
        type: 'missing_network_action',
        interaction: {
          type: interaction.type,
          selector: interaction.selector,
          label: interaction.label
        },
        what_happened: 'User action executed',
        what_was_expected: `Network request to ${expectation.expectedTarget || expectation.urlPath || 'endpoint'} (${expectation.method || 'GET'})`,
        what_was_observed: 'No network request was made',
        why_it_matters: 'User took action expecting server communication but request was never sent',
        evidence: {
          before: beforeScreenshot,
          after: afterScreenshot,
          beforeUrl: beforeUrl,
          afterUrl: afterUrl,
          expectedEndpoint: expectation.expectedTarget || expectation.urlPath || '',
          expectedMethod: expectation.method || 'GET',
          totalRequests: networkData.totalRequests
        },
        confidence: computeFindingConfidence(
          { type: 'missing_network_action' },
          expectation,
          trace,
          { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false }
        )
      };
      bindPromiseToFinding(finding, trace);
      enrichFindingWithExplanations(finding, trace);
      return finding;
    }
    
    if (hasFailed && !sensors.uiSignals?.diff?.changed) {
      const finding = {
        outcome: mapFindingTypeToOutcome('network_silent_failure'),
        type: 'network_silent_failure',
        interaction: {
          type: interaction.type,
          selector: interaction.selector,
          label: interaction.label
        },
        what_happened: 'User action executed; network request was sent but failed',
        what_was_expected: `Request to ${expectation.expectedTarget || expectation.urlPath || 'endpoint'} succeeds with user feedback`,
        what_was_observed: 'Request failed but no user-visible feedback provided',
        why_it_matters: 'User took action expecting server communication; request failed but they received no error notification',
        evidence: {
          before: beforeScreenshot,
          after: afterScreenshot,
          beforeUrl: beforeUrl,
          afterUrl: afterUrl,
          expectedEndpoint: expectation.expectedTarget || expectation.urlPath || '',
          expectedMethod: expectation.method || 'GET',
          failedRequests: networkData.failedRequests,
          uiFeedback: false
        },
        confidence: computeFindingConfidence(
          { type: 'network_silent_failure' },
          expectation,
          trace,
          { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false }
        )
      };
      bindPromiseToFinding(finding, trace);
      enrichFindingWithExplanations(finding, trace);
      return finding;
    }
  }
  
  if (expectation.type === 'validation_block') {
    const finding = {
      outcome: mapFindingTypeToOutcome('validation_silent_failure'),
      type: 'validation_silent_failure',
      interaction: {
        type: interaction.type,
        selector: interaction.selector,
        label: interaction.label
      },
      what_happened: 'User submitted form',
      what_was_expected: 'Form validation fails with user-visible error message',
      what_was_observed: 'Form submission was blocked but no user-visible feedback provided',
      why_it_matters: 'User submitted form but received no indication why the submission was rejected',
      evidence: {
        before: beforeScreenshot,
        after: afterScreenshot,
        beforeUrl: beforeUrl,
        afterUrl: afterUrl,
        urlChanged: false,
        networkRequests: sensors.network?.totalRequests || 0,
        validationFeedbackDetected: sensors.uiSignals?.after?.validationFeedbackDetected === true,
        sourceRef: expectation.sourceRef,
        handlerRef: expectation.handlerRef
      },
      confidence: computeFindingConfidence(
        { type: 'validation_silent_failure' },
        expectation,
        trace,
        { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false }
      )
    };
    bindPromiseToFinding(finding, trace);
    enrichFindingWithExplanations(finding, trace);
    return finding;
  }
  
  if (expectation.type === 'state_action') {
    const finding = {
      outcome: mapFindingTypeToOutcome('missing_state_action'),
      type: 'missing_state_action',
      interaction: {
        type: interaction.type,
        selector: interaction.selector,
        label: interaction.label
      },
      what_happened: 'User action executed',
      what_was_expected: `Application state changes to: ${expectation.expectedTarget || ''} with user-visible feedback`,
      what_was_observed: 'State did not change, or changed without user-visible feedback',
      why_it_matters: 'User took action expecting app state to change but saw no confirmation',
      evidence: {
        before: beforeScreenshot,
        after: afterScreenshot,
        beforeUrl: beforeUrl,
        afterUrl: afterUrl,
        expectedStateKey: expectation.expectedTarget || '',
        stateChanged: sensors.state?.changed?.length > 0,
        stateKeysChanged: sensors.state?.changed || [],
        uiFeedback: sensors.uiSignals?.diff?.changed === true
      },
      confidence: computeFindingConfidence(
        { type: 'missing_state_action' },
        expectation,
        trace,
        { hasUrlChange: false, hasDomChange: false, hasVisibleChange: false }
      )
    };
    bindPromiseToFinding(finding, trace);
    enrichFindingWithExplanations(finding, trace);
    return finding;
  }
  
  // Generic silent failure
  const finding = {
    outcome: mapFindingTypeToOutcome('silent_failure'),
    type: 'silent_failure',
    interaction: {
      type: interaction.type,
      selector: interaction.selector,
      label: interaction.label
    },
    what_happened: 'User action executed',
    what_was_expected: 'User-visible change (URL, DOM, visual state)',
    what_was_observed: 'No observable change occurred',
    why_it_matters: 'User took action but system provided no visible confirmation of success or failure',
    evidence: {
      before: beforeScreenshot,
      after: afterScreenshot,
      beforeUrl: beforeUrl,
      afterUrl: afterUrl
    },
    confidence: computeFindingConfidence(
      { type: 'silent_failure' },
      expectation,
      trace,
      {
        hasUrlChange: hasMeaningfulUrlChange(beforeUrl, afterUrl),
        hasDomChange: hasDomChange(trace),
        hasVisibleChange: hasVisibleChange(beforeScreenshot, afterScreenshot, projectDir)
      }
    )
  };
  bindPromiseToFinding(finding, trace);
  enrichFindingWithExplanations(finding, trace);
  return finding;
}

/**
 * Create finding from observed expectation that didn't repeat.
 */
export function createObservedBreakFinding(trace, projectDir) {
  const obs = trace.observedExpectation;
  const interaction = trace.interaction || {};
  const beforeUrl = trace.before?.url;
  const afterUrl = trace.after?.url;
  const beforeScreenshot = trace.before?.screenshot;
  const afterScreenshot = trace.after?.screenshot;
  const sensors = trace.sensors || {};

  const comparisons = {
    hasUrlChange: hasMeaningfulUrlChange(beforeUrl, afterUrl),
    hasDomChange: hasDomChange(trace),
    hasVisibleChange: hasVisibleChange(beforeScreenshot, afterScreenshot, projectDir)
  };

  const finding = {
    outcome: mapFindingTypeToOutcome('observed_break'),
    type: 'observed_break',
    interaction: {
      type: interaction.type,
      selector: interaction.selector,
      label: interaction.label
    },
    what_happened: 'User interaction was executed',
    what_was_expected: `Previously observed outcome repeats: ${obs?.reason || 'observable change'}`,
    what_was_observed: 'Same user interaction this time produced a different outcome',
    why_it_matters: 'Interaction behavior changed between executions: system is non-deterministic',
    evidence: {
      before: beforeScreenshot,
      after: afterScreenshot,
      beforeUrl,
      afterUrl,
      observedExpectation: obs
    }
  };

  finding.confidence = computeConfidence({
    findingType: mapFindingTypeToConfidenceType('observed_break'),
    expectation: obs || { expectationStrength: 'OBSERVED' },
    sensors: {
      network: sensors.network || {},
      console: sensors.console || {},
      uiSignals: sensors.uiSignals || {}
    },
    comparisons,
    attemptMeta: { repeated: obs?.repeated === true },
    evidenceIntent: null,
    guardrailsOutcome: null,
    truthStatus: 'SUSPECTED',
    evidence: {},
    options: {}
  });

  bindPromiseToFinding(finding, trace);
  enrichFindingWithExplanations(finding, trace);
  return finding;
}

/**
 * Compute confidence for OBSERVED expectations with strict caps.
 * OBSERVED can be at most MEDIUM unless repeated twice.
 */
export function computeObservedConfidence(finding, observedExp, trace, comparisons, repeated) {
  // Base score for OBSERVED expectations (lower than PROVEN)
  let baseScore = 50;
  
  // Boost if repeated (confirms consistency)
  if (repeated) {
    baseScore += 15; // Boost for repetition
  }
  
  // Apply sensor presence penalties/boosts
  const sensors = trace.sensors || {};
  const sensorsPresent = {
    network: Object.keys(sensors.network || {}).length > 0,
    console: Object.keys(sensors.console || {}).length > 0,
    ui: Object.keys(sensors.uiSignals || {}).length > 0
  };
  
  const allSensorsPresent = sensorsPresent.network && sensorsPresent.console && sensorsPresent.ui;
  
  if (!allSensorsPresent) {
    baseScore -= 10; // Penalty for missing sensors
  }
  
  // Clamp score
  let score = Math.max(0, Math.min(100, baseScore));
  
  // Determine level with strict caps
  let level = 'LOW';
  
  if (score >= 55 && repeated) {
    // MEDIUM only if repeated
    level = 'MEDIUM';
    score = Math.min(score, 70); // Cap at 70 for OBSERVED
  } else if (score >= 55) {
    // Without repetition, cap at LOW
    level = 'LOW';
    score = Math.min(score, 54);
  }
  
  return {
    score: Math.round(score),
    level,
    explain: [
      `Expectation strength: OBSERVED (runtime-derived)`,
      repeated ? 'Confirmed by repetition' : 'Single observation (not repeated)',
      allSensorsPresent ? 'All sensors present' : 'Some sensors missing'
    ],
    factors: {
      expectationStrength: 'OBSERVED',
      repeated: repeated,
      sensorsPresent: sensorsPresent
    }
  };
}



