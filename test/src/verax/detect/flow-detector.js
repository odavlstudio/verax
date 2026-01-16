/**
 * FLOW DETECTION MODULE
 *
 * Detects multi-step flow failures - when a sequence of interactions
 * in a flow should work together but one step fails silently.
 *
 * FLOW INTELLIGENCE v1:
 * - Groups traces by flowId
 * - Validates each flow has 2+ proven expectations
 * - Detects silent failures in flow steps
 * - Checks for recovery in subsequent steps
 * - Emits flow_silent_failure findings when appropriate
 * - Suppresses per-step findings when flow finding is emitted
 */

import { getUrlPath } from './evidence-validator.js';
import {
  hasMeaningfulUrlChange,
  hasVisibleChange,
  hasDomChange
} from './comparison.js';
import {
  expectsNavigation,
  matchExpectation
} from './expectation-model.js';
import { isProvenExpectation } from '../shared/expectation-prover.js';
import { computeConfidence } from './confidence-engine.js';
import { enrichFindingWithExplanations } from './finding-detector.js';

/**
 * Detect flow-level silent failures in multi-step flows.
 *
 * @param {Array} traces - Observation traces from observe phase
 * @param {Object} manifest - Expectation manifest with staticExpectations
 * @param {Array} findings - Array of findings (will be mutated to suppress per-step findings)
 * @param {Array} coverageGaps - Coverage gaps data
 * @param {Object} helpers - Helper functions { enrichFindingWithDecisionSignals, computeConfidence }
 * @returns {Array} Array of flow_silent_failure findings
 */
export function detectFlowSilentFailures(traces, manifest, findings, coverageGaps, helpers = {}) {
  const flowFindings = [];
  const projectDir = manifest.projectDir;
  const { enrichFindingWithDecisionSignals } = helpers;

  /**
   * Compute confidence for a flow finding.
   */
  function computeFlowFindingConfidence(flowFinding, matchedExpectation, trace, comparisons) {
    const sensors = trace.sensors || {};
    const findingType = 'flow_silent_failure';

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
      attemptMeta: {}
    });

    return confidence;
  }

  // Group traces by flowId
  const flowsByFlowId = {};
  let tracesWithFlowId = 0;
  for (const trace of traces) {
    const flowId = trace.flow?.flowId;
    if (!flowId) continue; // Flow tracking not available for this trace
    tracesWithFlowId++;

    if (!flowsByFlowId[flowId]) {
      flowsByFlowId[flowId] = [];
    }
    flowsByFlowId[flowId].push(trace);
  }

  // FLOW INTELLIGENCE v1: Only process if we have traces with flowIds
  if (tracesWithFlowId === 0) {
    return flowFindings; // No flow tracking available
  }

  // Detect flow silent failures
  for (const flowId in flowsByFlowId) {
    const flowTraces = flowsByFlowId[flowId];

    // Flow must have at least 2 steps
    if (flowTraces.length < 2) {
      continue;
    }

    // FLOW INTELLIGENCE v1: Check if flow has PROVEN expectations (at least 2 steps with PROVEN expectations)
    let stepCountWithProvenExpectation = 0;
    for (const trace of flowTraces) {
      const interaction = trace.interaction;
      const beforeUrl = trace.before.url;

      // Check for any PROVEN expectation (navigation, network, state)
      let hasProvenExpectation = false;

      // Check navigation
      if (expectsNavigation(manifest, interaction, beforeUrl)) {
        hasProvenExpectation = true;
      }

      // Check network
      if (!hasProvenExpectation && manifest.staticExpectations) {
        const networkExp = manifest.staticExpectations.find(e =>
          e.type === 'network_action' &&
          isProvenExpectation(e) &&
          matchExpectation(e, interaction, beforeUrl)
        );
        if (networkExp) {
          hasProvenExpectation = true;
        }
      }

      if (hasProvenExpectation) {
        stepCountWithProvenExpectation++;
      }
    }

    // Only process flows with 2+ PROVEN steps
    if (stepCountWithProvenExpectation < 2) {
      continue;
    }

    // Look for silent failures followed by lack of recovery
    const _hasSilentFailure = false;
    let failedStepIndex = -1;
    const _failedExpectation = null;

    for (let i = 0; i < flowTraces.length; i++) {
      const trace = flowTraces[i];
      const interaction = trace.interaction;
      const beforeUrl = trace.before.url;
      const afterUrl = trace.after.url;
      const beforeScreenshot = trace.before.screenshot;
      const afterScreenshot = trace.after.screenshot;

      // Check for PROVEN expectations at this step
      let matchedExpectation = null;
      let expectationType = null;
      let isSilentFailure = false;

      // Check navigation expectation
      if (expectsNavigation(manifest, interaction, beforeUrl)) {
        const navExp = manifest.staticExpectations?.find(e =>
          (e.type === 'navigation' || e.type === 'spa_navigation') &&
          isProvenExpectation(e) &&
          e.fromPath && getUrlPath(beforeUrl) &&
          e.fromPath.replace(/\/$/, '') === getUrlPath(beforeUrl).replace(/\/$/, '') &&
          matchExpectation(e, interaction, beforeUrl)
        );

        if (navExp) {
          matchedExpectation = navExp;
          expectationType = 'navigation';

          const afterUrlPath = getUrlPath(afterUrl) || '/';
          // Normalize paths: remove .html extension and trailing slashes for comparison
          const normalizePath = (path) => {
            if (!path) return '/';
            let normalized = path.toLowerCase().trim().replace(/\/$/, '') || '/';
            // Remove .html extension for comparison
            normalized = normalized.replace(/\.html$/, '');
            return normalized;
          };
          const normalizedAfter = normalizePath(afterUrlPath);
          const normalizedTarget = normalizePath(navExp.targetPath || '');

          const urlMatchesTarget = normalizedAfter === normalizedTarget;
          const hasVisibleChangeResult = beforeScreenshot && afterScreenshot ?
            hasVisibleChange(beforeScreenshot, afterScreenshot, projectDir) : false;
          const hasDomChangeResult = hasDomChange(trace);

          const hasEffect = urlMatchesTarget || hasVisibleChangeResult || hasDomChangeResult;
          const uiSignals = trace.sensors?.uiSignals || {};
          const uiAfter = uiSignals.after || {};
          const hasUIFeedback = uiAfter.uiFeedbackDetected === true || uiAfter.changed === true;

          // Navigation silent failure: expected navigation didn't occur and no UI feedback
          // BUT: in flow context, if navigation fails but we have subsequent steps, don't mark as silent failure yet
          // Let flow detection handle it
          if (!hasEffect && !hasUIFeedback) {
            isSilentFailure = true;
          } else {
            // Navigation succeeded - clear any silent failure flag
            isSilentFailure = false;
          }
        }
      }

      // Check network expectation (check even if navigation was found, as different steps may have different types)
      if (!matchedExpectation && manifest.staticExpectations) {
        const networkExp = manifest.staticExpectations.find(e =>
          e.type === 'network_action' &&
          isProvenExpectation(e) &&
          matchExpectation(e, interaction, beforeUrl)
        );

        if (networkExp) {
          matchedExpectation = networkExp;
          expectationType = 'network_action';

          const networkData = trace.sensors?.network || { totalRequests: 0, failedRequests: 0 };
          const uiSignals = trace.sensors?.uiSignals || {};
          const uiAfter = uiSignals.after || {};
          const hasUIFeedback = uiAfter.uiFeedbackDetected === true || uiAfter.changed === true;

          // Silent failure: network request failed OR missing with no UI feedback
          if ((networkData.failedRequests > 0 || networkData.totalRequests === 0) && !hasUIFeedback) {
            isSilentFailure = true;
          }
        }
      }

      // Also check network expectation even if navigation was matched (for step 2 of flow)
      if (matchedExpectation && (matchedExpectation.type === 'navigation' || matchedExpectation.type === 'spa_navigation') && manifest.staticExpectations) {
        const networkExp = manifest.staticExpectations.find(e =>
          e.type === 'network_action' &&
          isProvenExpectation(e) &&
          matchExpectation(e, interaction, beforeUrl)
        );

        if (networkExp) {
          // This step has both navigation and network expectations - check network failure
          const networkData = trace.sensors?.network || { totalRequests: 0, failedRequests: 0 };
          const uiSignals = trace.sensors?.uiSignals || {};
          const uiAfter = uiSignals.after || {};
          const hasUIFeedback = uiAfter.uiFeedbackDetected === true || uiAfter.changed === true;

          // If network fails silently, this is the failure we want to detect
          if ((networkData.failedRequests > 0 || networkData.totalRequests === 0) && !hasUIFeedback) {
            matchedExpectation = networkExp;
            expectationType = 'network_action';
            isSilentFailure = true;
          }
        }
      }

      if (isSilentFailure && matchedExpectation) {
        // Silent failure detected at this step
        const _hasSilentFailure = true;
        failedStepIndex = i;
        const _failedExpectation = matchedExpectation;

        // Check if subsequent steps show UI recovery
        let hasSubsequentRecovery = false;
        if (i + 1 < flowTraces.length) {
          const nextTrace = flowTraces[i + 1];
          const nextBeforeScreenshot = nextTrace.before.screenshot;
          const nextAfterScreenshot = nextTrace.after.screenshot;
          const nextUISignals = nextTrace.sensors?.uiSignals || {};
          const nextUIAfter = nextUISignals.after || {};

          if (nextBeforeScreenshot && nextAfterScreenshot) {
            hasSubsequentRecovery = hasVisibleChange(nextBeforeScreenshot, nextAfterScreenshot, projectDir) ||
                                   nextUIAfter.uiFeedbackDetected === true;
          }
        }

        // Emit flow_silent_failure only if no recovery in next step
        if (!hasSubsequentRecovery) {
          const hasUrlChange = hasMeaningfulUrlChange(beforeUrl, afterUrl);
          const hasVisibleChangeResult = beforeScreenshot && afterScreenshot ?
            hasVisibleChange(beforeScreenshot, afterScreenshot, projectDir) : false;
          const hasDomChangeResult = hasDomChange(trace);

          // Build prior steps summary
          const priorSteps = [];
          for (let j = 0; j < i; j++) {
            priorSteps.push({
              stepIndex: j,
              interaction: flowTraces[j].interaction,
              url: flowTraces[j].after.url
            });
          }

          const flowFinding = {
            type: 'flow_silent_failure',
            flowId: flowId,
            failedStepIndex: failedStepIndex,
            priorStepsCount: failedStepIndex,
            priorSteps: priorSteps,
            interaction: {
              type: interaction.type,
              selector: interaction.selector,
              label: interaction.label
            },
            reason: 'Silent failure in multi-step flow with no recovery in subsequent step',
            evidence: {
              before: beforeScreenshot,
              after: afterScreenshot,
              beforeUrl: beforeUrl,
              afterUrl: afterUrl,
              failedExpectation: {
                type: expectationType,
                sourceRef: matchedExpectation.sourceRef,
                handlerRef: matchedExpectation.handlerRef
              }
            }
          };

          flowFinding.confidence = computeFlowFindingConfidence(
            flowFinding,
            matchedExpectation,
            trace,
            { hasUrlChange, hasDomChange: hasDomChangeResult, hasVisibleChange: hasVisibleChangeResult }
          );

          enrichFindingWithExplanations(flowFinding, trace);
          if (enrichFindingWithDecisionSignals) {
            enrichFindingWithDecisionSignals(flowFinding, trace);
          }
          flowFindings.push(flowFinding);

          // Suppress per-step findings when flow finding is emitted
          // Remove any findings for this step AND any previous steps in the flow from the main findings array
          // Match by interaction details and also by finding type (network_silent_failure, navigation_silent_failure, etc.)
          const findingTypesToSuppress = ['network_silent_failure', 'navigation_silent_failure', 'missing_network_action', 'no_effect_silent_failure', 'silent_failure'];

          // Suppress findings for ALL steps in this flow (not just the failed step)
          for (let stepIdx = 0; stepIdx <= i; stepIdx++) {
            const stepTrace = flowTraces[stepIdx];
            const stepInteraction = stepTrace.interaction;
            const stepBeforeUrl = stepTrace.before.url;
            const stepAfterUrl = stepTrace.after.url;

            for (let k = findings.length - 1; k >= 0; k--) {
              const finding = findings[k];
              if (finding.interaction &&
                  findingTypesToSuppress.includes(finding.type)) {
                // Match by selector, label, or by URL context for this step
                const matchesSelector = finding.interaction.selector === stepInteraction.selector;
                const matchesLabel = finding.interaction.label === stepInteraction.label;
                const matchesUrl = (finding.evidence?.beforeUrl === stepBeforeUrl) ||
                                  (finding.evidence?.afterUrl === stepAfterUrl) ||
                                  (finding.evidence?.beforeUrl === stepTrace.before.url) ||
                                  (finding.evidence?.afterUrl === stepTrace.after.url);

                if (matchesSelector || matchesLabel || matchesUrl) {
                  findings.splice(k, 1);
                  // Note: findingsFromProven is in outer scope, but we can't access it here
                  // The caller will handle the adjustment
                }
              }
            }
          }
        }

        // Only report first silent failure in flow - break after emitting finding
        break;
      }
    }
  }

  return flowFindings;
}
