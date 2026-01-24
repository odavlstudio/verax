/**
 * EvidenceCaptureService
 * 
 * PURPOSE: Centralize evidence capture before/after state changes
 * 
 * SCOPE: 
 * - Capture page state before interaction (route, DOM, network)
 * - Capture page state after interaction (route, DOM, network)
 * - Analyze changes between before and after states
 * - Correlate with action execution timeline
 * 
 * INVARIANT: Evidence must be captured even if analysis fails
 * CONSTITUTION: Read-only observation; no writes to page
 */

import {
  captureRouteSignature,
  getRouteTransitions,
  routeSignatureChanged,
  analyzeRouteTransitions
} from './route-sensor.js';
import {
  captureUIMutationSummary,
  analyzeMutationSummary
} from './ui-mutation-tracker.js';
import { getTimeProvider } from '../support/time-provider.js';

export class EvidenceCaptureService {
  constructor(page, options = {}) {
    this.page = page;
    this.timeProvider = getTimeProvider();
    this.options = options;
  }

  /**
   * Capture page state before interaction
   * 
   * INVARIANT: Must succeed even if some captures fail
   * Returns: { routeSignature, consoleErrorCount, beforeSnapshot }
   */
  async captureBeforeState(bundle, consoleEventsLength) {
    const before = {
      routeSignature: null,
      url: null,
      consoleErrorCount: consoleEventsLength || 0,
      capturedAt: this.timeProvider.iso()
    };

    try {
      // Capture route signature (core for SPA detection)
      before.routeSignature = await captureRouteSignature(this.page);
    } catch (e) {
      // Continue even if route capture fails
      before.routeSignature = null;
    }

    try {
      before.url = this.page.url();
    } catch (e) {
      // Continue even if URL fails
      before.url = null;
    }

    // Capture before state via bundle (includes DOM, network, console)
    try {
      await bundle.captureBeforeState(this.page);
    } catch (e) {
      // Log but continue
    }

    return before;
  }

  /**
   * Capture page state after interaction
   * 
   * Captures: route signature, URL, DOM, network, console
   * Returns: { before, after, routeChanges, mutations }
   */
  async captureAfterState(bundle, consoleEventsLength, beforeState) {
    const after = {
      routeSignature: null,
      url: null,
      consoleErrorCount: consoleEventsLength || 0,
      capturedAt: this.timeProvider.iso()
    };

    try {
      after.routeSignature = await captureRouteSignature(this.page);
    } catch (e) {
      after.routeSignature = null;
    }

    try {
      after.url = this.page.url();
    } catch (e) {
      after.url = null;
    }

    // Capture after state via bundle
    try {
      await bundle.captureAfterState(this.page);
    } catch (e) {
      // Continue even if capture fails
    }

    return {
      before: beforeState,
      after,
      capturedAt: this.timeProvider.iso()
    };
  }

  /**
   * Analyze route changes between before and after states
   * 
   * Returns: { signatureChanged, transitionAnalysis, routeData }
   */
  async analyzeRouteChanges(beforeState, afterState) {
    const analysis = {
      signatureChanged: false,
      transitions: [],
      hasTransitions: false,
      error: null
    };

    try {
      // Check if route signature changed
      const signatureChanged = routeSignatureChanged(
        beforeState.routeSignature,
        afterState.routeSignature
      );
      analysis.signatureChanged = signatureChanged;

      // Analyze transitions
      const routeTransitions = await getRouteTransitions(this.page);
      const transitionAnalysis = analyzeRouteTransitions(routeTransitions);
      
      analysis.transitions = routeTransitions;
      analysis.hasTransitions = transitionAnalysis.hasTransitions;
    } catch (e) {
      analysis.error = e.message;
    }

    return analysis;
  }

  /**
   * Analyze DOM mutation changes
   * 
   * Returns: { summary, analysis }
   */
  async analyzeMutationChanges(beforeMutations, afterMutations) {
    const analysis = {
      before: beforeMutations,
      after: afterMutations,
      summary: null,
      error: null
    };

    try {
      if (afterMutations) {
        const mutationAnalysis = analyzeMutationSummary(afterMutations);
        analysis.summary = mutationAnalysis;
      }
    } catch (e) {
      analysis.error = e.message;
    }

    return analysis;
  }

  /**
   * Capture UI mutations summary
   * 
   * Returns: mutation summary object
   */
  async captureUIMutations() {
    try {
      return await captureUIMutationSummary(this.page);
    } catch (e) {
      return { error: e.message };
    }
  }

  /**
   * Full capture and analysis cycle (convenience method)
   * 
   * Returns complete before/after evidence
   */
  async captureCycle(bundle, consoleEventsLength) {
    // Capture before
    const beforeState = await this.captureBeforeState(bundle, consoleEventsLength);
    const beforeMutations = await this.captureUIMutations();

    // Return capture handler that will be called after action
    return {
      beforeState,
      beforeMutations,
      // Called after action to capture after state
      async captureAfter() {
        const afterState = await this.captureAfterState(bundle, consoleEventsLength, beforeState);
        const afterMutations = await this.captureUIMutations();
        
        // Analyze changes
        const routeAnalysis = await this.analyzeRouteChanges(beforeState, afterState.after);
        const mutationAnalysis = await this.analyzeMutationChanges(beforeMutations, afterMutations);

        return {
          beforeState,
          afterState: afterState.after,
          beforeMutations,
          afterMutations,
          routeAnalysis,
          mutationAnalysis
        };
      }
    };
  }
}

export default EvidenceCaptureService;
