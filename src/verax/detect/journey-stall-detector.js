/**
 * EXPECTATION CONTINUITY & USER STALL DETECTION
 * 
 * Detects silent failures that occur across multiple interactions where each step
 * individually works, but the user journey stalls.
 * 
 * Requirements:
 * 1) Track interaction sequence context (previous → next)
 * 2) After successful interaction, infer expected next signals:
 *    - navigation
 *    - new actionable elements (CTA)
 *    - content progression
 * 3) Detect stall conditions:
 *    - no navigation
 *    - no new actionable UI
 *    - no meaningful DOM progression within timeout
 * 4) Emit finding type: "journey-stall-silent-failure"
 */

import { stableHashId } from '../shared/hash-id.js';

/**
 * Journey Stall Detector
 * 
 * Analyzes sequences of traces to detect when interactions work individually
 * but the overall user journey stalls.
 */
export class JourneyStallDetector {
  constructor(options = {}) {
    this.stallThresholdMs = options.stallThresholdMs || 3000; // DOM should change within 3s
    this.minSequenceLength = options.minSequenceLength || 2; // At least 2 interactions for a journey
    this.maxSequenceLength = options.maxSequenceLength || 20; // But limit to 20 for performance
  }

  /**
   * Analyze traces for journey stalls
   * @param {Array} traces - Interaction traces from observe phase
   * @returns {Array} Journey stall findings
   */
  detectStalls(traces) {
    if (!Array.isArray(traces) || traces.length < this.minSequenceLength) {
      return [];
    }

    const findings = [];
    const sequences = this._extractSequences(traces);

    for (const sequence of sequences) {
      const stall = this._analyzeSequence(sequence);
      if (stall) {
        findings.push(stall);
      }
    }

    return findings;
  }

  /**
   * Extract meaningful interaction sequences from traces
   * @private
   */
  _extractSequences(traces) {
    const sequences = [];
    let currentSequence = [];

    for (let i = 0; i < traces.length; i++) {
      const trace = traces[i];

      // Skip traces without proper interaction data
      if (!trace || !trace.interaction || !trace.sensors) {
        continue;
      }

      currentSequence.push({
        index: i,
        trace,
        beforeUrl: trace.before?.url || '',
        afterUrl: trace.after?.url || '',
        navigation: trace.sensors.navigation || {},
        uiSignals: trace.sensors.uiSignals || {},
        dom: trace.dom || {},
        timing: trace.sensors.timing || {},
        uiFeedback: trace.sensors.uiFeedback || {}
      });

      // Sequence ends if:
      // 1. We reached max length
      // 2. Next trace shows successful navigation (end of journey segment)
      // 3. We're at the end of traces
      const isLastTrace = i === traces.length - 1;
      const _nextTrace = !isLastTrace ? traces[i + 1] : null;
      const navigationOccurred = trace.sensors?.navigation?.urlChanged === true;

      if (
        currentSequence.length >= this.maxSequenceLength ||
        navigationOccurred ||
        isLastTrace
      ) {
        if (currentSequence.length >= this.minSequenceLength) {
          sequences.push(currentSequence);
        }
        currentSequence = [];
      }
    }

    return sequences;
  }

  /**
   * Analyze a single sequence for stalls
   * @private
   */
  _analyzeSequence(sequence) {
    if (sequence.length < this.minSequenceLength) {
      return null;
    }

    // For each step (except the last), check if it progresses the journey
    const stallPoints = [];

    for (let i = 0; i < sequence.length - 1; i++) {
      const current = sequence[i];
      const next = sequence[i + 1];

      const stall = this._detectStallBetweenSteps(current, next, i, sequence);
      if (stall) {
        stallPoints.push(stall);
      }
    }

    if (stallPoints.length === 0) {
      return null; // No stalls detected
    }

    // Generate finding for this journey stall sequence
    return this._generateStallFinding(sequence, stallPoints);
  }

  /**
   * Detect if there's a stall between two consecutive steps
   * @private
   */
  _detectStallBetweenSteps(current, next, stepIndex, _sequence) {
    const reasons = [];
    const evidence = [];

    // Check 1: Was the current interaction successful?
    const currentSuccessful = this._isInteractionSuccessful(current);
    if (!currentSuccessful) {
      return null; // Current step failed, not a stall
    }

    // Check 2: Navigation expectation
    const expectedNavigation = this._shouldExpectNavigation(current);
    const actualNavigation = next.navigation?.urlChanged === true;

    if (expectedNavigation && !actualNavigation) {
      reasons.push('no_navigation');
      evidence.push({
        type: 'navigation_expectation_unmet',
        currentInteraction: current.trace.interaction.type,
        currentSelector: current.trace.interaction.selector,
        expectedNavigation: expectedNavigation,
        actualNavigation: actualNavigation,
        beforeUrl: current.beforeUrl,
        afterUrl: current.afterUrl,
        nextUrl: next.beforeUrl
      });
    }

    // Check 3: New actionable UI expectation
    const expectedNewActionableUI = this._shouldExpectNewActionableUI(current);
    const foundNewActionableUI = this._hasNewActionableUI(current, next);

    if (expectedNewActionableUI && !foundNewActionableUI) {
      reasons.push('no_new_actionable_ui');
      evidence.push({
        type: 'actionable_ui_expectation_unmet',
        currentInteraction: current.trace.interaction.type,
        currentSelector: current.trace.interaction.selector,
        expectedNewActions: expectedNewActionableUI,
        foundNew: foundNewActionableUI,
        currentUIActions: this._countActionableElements(current),
        nextUIActions: this._countActionableElements(next)
      });
    }

    // Check 4: DOM progression expectation
    const expectedDomProgression = this._shouldExpectDomProgression(current);
    const actualDomProgression = this._hasMeaningfulDomProgression(current, next);

    if (expectedDomProgression && !actualDomProgression) {
      reasons.push('no_dom_progression');
      evidence.push({
        type: 'dom_progression_expectation_unmet',
        currentInteraction: current.trace.interaction.type,
        currentSelector: current.trace.interaction.selector,
        expectedDomChange: expectedDomProgression,
        domChanged: current.uiSignals?.diff?.changed === true,
        domHash: {
          before: current.dom?.beforeHash,
          after: current.dom?.afterHash,
          domChangedDuringSettle: current.dom?.settle?.domChangedDuringSettle
        },
        nextDomChanged: next.uiSignals?.diff?.changed === true
      });
    }

    // Only return stall if we have reasons
    if (reasons.length === 0) {
      return null;
    }

    return {
      stepIndex,
      currentInteractionIndex: current.index,
      nextInteractionIndex: next.index,
      reasons,
      evidence,
      severity: this._calculateSeverity(reasons, current, next)
    };
  }

  /**
   * Check if an interaction was successful
   * @private
   */
  _isInteractionSuccessful(step) {
    const trace = step.trace;

    // Check for policy violations
    if (trace.policy) {
      if (trace.policy.timeout) return false;
      if (trace.policy.executionError) return false;
      if (trace.policy.blocked) return false;
    }

    // Should have sensors captured
    return !!trace.sensors;
  }

  /**
   * Determine if interaction should trigger navigation
   * @private
   */
  _shouldExpectNavigation(step) {
    const trace = step.trace;
    const interactionType = trace.interaction?.type;
    const href = trace.interaction?.href;
    const dataHref = trace.interaction?.dataHref;
    const formAction = trace.interaction?.formAction;

    // Links with href should navigate
    if (interactionType === 'link' && (href || dataHref)) {
      return true;
    }

    // Forms with action should navigate (unless AJAX)
    if (interactionType === 'form' && formAction) {
      // Check if AJAX detected
      const networkSummary = step.trace.sensors?.network;
      if (networkSummary && networkSummary.totalRequests > 0) {
        // Could be AJAX, but still might navigate
        // Conservative: expect navigation if form has action
        return true;
      }
    }

    // Buttons might trigger navigation if they have href (OR if href attribute indicates navigation)
    // Any button might be a form submit or navigation trigger
    if (interactionType === 'button') {
      if (href || dataHref) {
        return true;
      }
      // Check if button label suggests navigation (Next, Continue, Submit, etc.)
      const label = trace.interaction?.label || '';
      if (/next|continue|submit|go|proceed|forward/i.test(label)) {
        // Likely expects navigation
        return true;
      }
    }

    return false;
  }

  /**
   * Determine if interaction should produce new actionable UI
   * @private
   */
  _shouldExpectNewActionableUI(step) {
    const trace = step.trace;
    const interactionType = trace.interaction?.type;

    // Click/tap interactions often reveal new UI
    if (interactionType === 'click' || interactionType === 'tap') {
      return true;
    }

    // Form submissions reveal new content
    if (interactionType === 'form') {
      return true;
    }

    // Hover might reveal new UI (dropdowns, tooltips)
    if (interactionType === 'hover') {
      return true;
    }

    return false;
  }

  /**
   * Check if new actionable UI appeared between steps
   * @private
   */
  _hasNewActionableUI(current, next) {
    const currentActions = this._countActionableElements(current);
    const nextActions = this._countActionableElements(next);

    // New actionable UI if we have more clickable elements
    if (nextActions > currentActions) {
      return true;
    }

    // Or if UI feedback detected new interactive elements
    const nextFeedback = next.uiFeedback;
    if (nextFeedback?.signals?.notification?.detected === true) {
      return true; // New notification appeared
    }

    if (nextFeedback?.signals?.buttonStateTransition?.detected === true) {
      return true; // Button state changed (became enabled, etc.)
    }

    return false;
  }

  /**
   * Count actionable elements from UI signals
   * @private
   */
  _countActionableElements(step) {
    const uiSignals = step.uiSignals || {};
    const after = uiSignals.after || {};

    let count = 0;

    // Count detected interactive elements
    if (after.clickableCount) count += after.clickableCount;
    if (after.formCount) count += after.formCount;
    if (after.buttonCount) count += after.buttonCount;
    if (after.linkCount) count += after.linkCount;

    // If no explicit counts, estimate from diff
    if (count === 0 && uiSignals.diff?.changed) {
      count = 1; // At least something changed
    }

    return count;
  }

  /**
   * Determine if DOM progression is expected
   * @private
   */
  _shouldExpectDomProgression(step) {
    const trace = step.trace;
    const interactionType = trace.interaction?.type;
    const uiFeedback = step.uiFeedback;

    // Any interaction that changes visible state should progress DOM
    if (
      interactionType === 'click' ||
      interactionType === 'tap' ||
      interactionType === 'form'
    ) {
      return true;
    }

    // If we detected loading indicators, expect DOM change after loading
    if (uiFeedback?.signals?.loading?.detected === true) {
      return true;
    }

    return false;
  }

  /**
   * Check if meaningful DOM progression occurred
   * @private
   */
  _hasMeaningfulDomProgression(current, next) {
    // Check if DOM hash changed (content changed)
    const currentHash = current.dom?.afterHash;
    const nextHash = next.dom?.beforeHash;

    if (currentHash && nextHash && currentHash !== nextHash) {
      return true;
    }

    // Check if UI signals indicate change
    if (next.uiSignals?.diff?.changed === true) {
      return true;
    }

    // Check if DOM settle detected changes
    if (next.dom?.settle?.domChangedDuringSettle === true) {
      return true;
    }

    // Check if DOM elements increased (more content)
    const currentElements = current.uiSignals?.after?.domNodeCount || 0;
    const nextElements = next.uiSignals?.before?.domNodeCount || 0;

    if (nextElements > currentElements && nextElements > 100) {
      // Significant increase in DOM elements
      return true;
    }

    // More lenient: if hashes exist and are different, DOM changed
    if (current.dom?.beforeHash && current.dom?.afterHash && current.dom.beforeHash !== current.dom.afterHash) {
      return true;
    }

    return false;
  }

  /**
   * Calculate severity level for stall
   * @private
   */
  _calculateSeverity(reasons, _current, _next) {
    let score = 0;

    // Multiple reasons = higher severity
    score += reasons.length * 0.3;

    // Navigation expected but missing is very serious
    if (reasons.includes('no_navigation')) {
      score += 0.4;
    }

    // No new UI is concerning
    if (reasons.includes('no_new_actionable_ui')) {
      score += 0.3;
    }

    // DOM stagnation is concerning
    if (reasons.includes('no_dom_progression')) {
      score += 0.3;
    }

    if (score >= 0.7) return 'CRITICAL';
    if (score >= 0.5) return 'HIGH';
    if (score >= 0.3) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate a finding for this journey stall
   * @private
   */
  _generateStallFinding(sequence, stallPoints) {
    const _firstTrace = sequence[0].trace;
    const lastTrace = sequence[sequence.length - 1].trace;

    const id = stableHashId('journey-stall', { sequence_length: sequence.length, stall_count: stallPoints.length });

    return {
      id,
      type: 'journey-stall-silent-failure',
      severity: this._getHighestSeverity(stallPoints),
      sequenceLength: sequence.length,
      stallPoints,
      sequence: {
        startedAt: sequence[0].beforeUrl,
        endedAt: lastTrace.after?.url || sequence[sequence.length - 1].beforeUrl,
        interactions: sequence.map((s, idx) => ({
          index: idx,
          type: s.trace.interaction.type,
          selector: s.trace.interaction.selector,
          label: s.trace.interaction.label
        }))
      },
      summary: this._generateSummary(stallPoints, sequence),
      evidence: {
        stallPoints: stallPoints.map(sp => ({
          stepIndex: sp.stepIndex,
          reasons: sp.reasons,
          severity: sp.severity,
          details: sp.evidence
        })),
        journeyContext: {
          totalInteractions: sequence.length,
          startUrl: sequence[0].beforeUrl,
          finalUrl: lastTrace.after?.url || sequence[sequence.length - 1].beforeUrl,
          urlProgression: this._extractUrlProgression(sequence)
        }
      },
      expectedOutcome: 'user_should_progress_through_journey',
      actualOutcome: 'journey_stalls_despite_successful_individual_steps',
      confidence: null, // Will be calculated by confidence engine
      impact: 'HIGH' // Journey stalls have high user impact
    };
  }

  /**
   * Get highest severity from stall points
   * @private
   */
  _getHighestSeverity(stallPoints) {
    const levels = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const severities = stallPoints.map(sp => levels[sp.severity] || 0);
    const max = Math.max(...severities);

    for (const [level, value] of Object.entries(levels)) {
      if (value === max) return level;
    }

    return 'MEDIUM';
  }

  /**
   * Generate human-readable summary
   * @private
   */
  _generateSummary(stallPoints, sequence) {
    const steps = sequence.length;
    const failureTypes = new Set();

    stallPoints.forEach(sp => {
      sp.reasons.forEach(reason => failureTypes.add(reason));
    });

    const typeList = Array.from(failureTypes).join(', ');
    return `User journey stalled after ${steps} successful interactions: ${typeList}`;
  }

  /**
   * Extract URL progression from sequence
   * @private
   */
  _extractUrlProgression(sequence) {
    const progression = [];
    let lastUrl = null;

    for (const step of sequence) {
      const url = step.afterUrl || step.beforeUrl;

      if (url && url !== lastUrl) {
        progression.push(url);
        lastUrl = url;
      }
    }

    return progression;
  }
}

export default JourneyStallDetector;



