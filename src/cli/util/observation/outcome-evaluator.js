/**
 * OutcomeEvaluator
 * 
 * PURPOSE: Evaluate if action execution met expectations
 * 
 * SCOPE:
 * - Classify action outcome (observed, not-observed, error, etc.)
 * - Classify interaction intent (click intent, form intent, etc.)
 * - Evaluate acknowledgment (was action acknowledged by app)
 * - Determine final attempt reason based on outcome
 * 
 * INVARIANT: Evaluation is pure; no side effects
 * VALUES: Classification logic immutable; only extracted for clarity
 * 
 * PURE FUNCTION: All methods are deterministic
 */

export class OutcomeEvaluator {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Evaluate if action result meets expectation
   * 
   * Returns: { observed: boolean, reason: string, cause: string }
   */
  evaluate(promise, bundle, actionSuccess, actionReason) {
    const evaluation = {
      observed: false,
      reason: null,
      cause: null
    };

    // Check if action succeeded
    if (!actionSuccess) {
      evaluation.reason = actionReason || 'action-failed';
      evaluation.cause = 'action-failed';
      return evaluation;
    }

    // Action succeeded; check if expectations were met
    const expectationMet = this.meetsExpectation(promise, bundle);
    
    if (expectationMet) {
      evaluation.observed = true;
      evaluation.reason = null; // Null reason means "observed"
      evaluation.cause = null;
    } else {
      evaluation.observed = false;
      evaluation.reason = 'outcome-not-met';
      evaluation.cause = 'expectation-mismatch';
    }

    return evaluation;
  }

  /**
   * Check if action result satisfies expected outcome
   * 
   * PURE: Compares interaction result against promise expectations
   * Returns: boolean
   */
  meetsExpectation(promise, bundle) {
    if (!promise.expectedOutcome) {
      // No specific expectation; action success is enough
      return true;
    }

    if (!bundle.signals) {
      // No signals captured; can't verify expectation
      return false;
    }

    // Check if expected signal was observed
    return bundle.signals[promise.expectedOutcome] === true;
  }

  /**
   * Classify interaction intent based on evidence
   * 
   * PURE: Maps evidence to intent classification
   * Returns: { intent: string, signals: Array<string>, confidence: number }
   */
  classifyIntent(record) {
    const classification = {
      intent: 'unknown',
      signals: [],
      confidence: 0
    };

    if (!record) {
      return classification;
    }

    // Analyze record for intent signals
    const signals = [];
    let confidence = 0.5;

    // Check for navigation intent
    if (record.urlChanged || record.routeChanged) {
      signals.push('navigation');
      confidence = 0.9;
    }

    // Check for form submission intent
    if (record.formSubmitted || record.formValuesChanged) {
      signals.push('form-submit');
      confidence = Math.max(confidence, 0.95);
    }

    // Check for validation intent
    if (record.validationError || record.validationPassed) {
      signals.push('validation');
      confidence = 0.8;
    }

    // Check for state change intent
    if (record.stateChanged || record.dataChanged) {
      signals.push('state-change');
      confidence = 0.85;
    }

    // Check for network intent
    if (record.networkRequest) {
      signals.push('network');
      confidence = 0.75;
    }

    // Determine primary intent from strongest signal
    if (signals.length > 0) {
      classification.intent = signals[0];
      classification.signals = signals;
    }

    classification.confidence = confidence;
    return classification;
  }

  /**
   * Evaluate if interaction received acknowledgment
   * 
   * PURE: Checks signals for acknowledgment markers
   * Returns: { acknowledged: boolean, signals: Array<string> }
   */
  evaluateAcknowledgment(signals) {
    const acknowledgment = {
      acknowledged: false,
      signals: [],
      confidence: 0
    };

    if (!signals || typeof signals !== 'object') {
      return acknowledgment;
    }

    // Check for acknowledgment signals
    const ackSignals = [];

    if (signals.urlChanged) ackSignals.push('url-changed');
    if (signals.routeChanged) ackSignals.push('route-changed');
    if (signals.stateChanged) ackSignals.push('state-changed');
    if (signals.domChanged) ackSignals.push('dom-changed');
    if (signals.networkRequest) ackSignals.push('network-request');

    acknowledgment.signals = ackSignals;
    acknowledgment.acknowledged = ackSignals.length > 0;
    acknowledgment.confidence = Math.min(1, ackSignals.length * 0.2);

    return acknowledgment;
  }

  /**
   * Determine final attempt reason
   * 
   * PURE: Maps evaluation results to attempt reason
   * Returns: string (null = observed, otherwise = reason)
   */
  determineReason(actionSuccess, expectationMet, defaultCause) {
    if (actionSuccess && expectationMet) {
      return null; // Observed
    } else if (!actionSuccess) {
      return defaultCause || 'action-failed';
    } else {
      return defaultCause || 'outcome-not-met';
    }
  }

  /**
   * Classify outcome based on complete evidence
   * 
   * PURE: Comprehensive outcome classification
   * Returns: { classification: string, confidence: number, reason: string }
   */
  classifyOutcome(promise, bundle, actionSuccess, actionReason) {
    const classification = {
      classification: 'unknown',
      confidence: 0,
      reason: null
    };

    if (!actionSuccess) {
      classification.classification = 'action-failed';
      classification.reason = actionReason || 'action-execution-failed';
      classification.confidence = 0.95;
      return classification;
    }

    if (!this.meetsExpectation(promise, bundle)) {
      classification.classification = 'expectation-not-met';
      classification.reason = 'outcome-not-met';
      classification.confidence = 0.9;
      return classification;
    }

    // Action succeeded and expectation met
    classification.classification = 'observed';
    classification.reason = null;
    classification.confidence = 0.99;
    return classification;
  }
}

export default OutcomeEvaluator;
