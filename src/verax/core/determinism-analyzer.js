/**
 * GATE 2: DETERMINISM ANALYZER
 *
 * Tracks and detects non-deterministic behavior during run execution.
 * Records adaptive events, timeouts, timing variations that could cause
 * verdicts to differ across runs with same inputs.
 */
import { getTimeProvider } from '../../cli/util/support/time-provider.js';

export class DeterminismAnalyzer {
  constructor(runId) {
    this.runId = runId;
    this.factors = [];  // Array of NON_DETERMINISTIC, CONTROLLED_NON_DETERMINISTIC, DETERMINISTIC
    this.adaptiveEvents = [];  // Log of adaptive behavior
    this.timeoutCount = 0;
    this.retryCount = 0;
    this.timeProvider = getTimeProvider();
  }

  /**
   * Record a potential non-determinism factor
   * @param {string} factor - NON_DETERMINISTIC, CONTROLLED_NON_DETERMINISTIC, or DETERMINISTIC
   * @param {string} reason - Human-readable reason
   * @param {Object} context - Additional context
   */
  recordFactor(factor, reason, context = {}) {
    this.factors.push({
      factor,
      reason,
      context,
      recordedAt: this.timeProvider.iso()
    });
  }

  /**
   * Record adaptive behavior that changed timing
   * @param {string} reason - Why adaptive action occurred
   * @param {Object} change - What changed
   */
  recordAdaptiveEvent(reason, change) {
    this.adaptiveEvents.push({
      reason,
      change,
      timestamp: this.timeProvider.iso()
    });
  }

  recordTimeout(phase, context = {}) {
    this.timeoutCount++;
    this.recordFactor(
      'NON_DETERMINISTIC',
      `Timeout during ${phase} - outcome depends on machine speed`,
      { phase, ...context }
    );
  }

  recordRetry(reason, attempt, context = {}) {
    this.retryCount++;
    this.recordFactor(
      'CONTROLLED_NON_DETERMINISTIC',
      `Retry ${attempt} - controlled but affects timing`,
      { reason, attempt, ...context }
    );
  }

  /**
   * Get overall determinism classification
   * @returns {string} DETERMINISTIC, CONTROLLED_NON_DETERMINISTIC, or NON_DETERMINISTIC
   */
  getClassification() {
    if (this.factors.some(f => f.factor === 'NON_DETERMINISTIC')) {
      return 'NON_DETERMINISTIC';
    }
    if (this.factors.some(f => f.factor === 'CONTROLLED_NON_DETERMINISTIC')) {
      return 'CONTROLLED_NON_DETERMINISTIC';
    }
    return 'DETERMINISTIC';
  }

  /**
   * Get determinism analysis object for output
   */
  getAnalysis() {
    return {
      classification: this.getClassification(),
      factorCount: this.factors.length,
      timeoutCount: this.timeoutCount,
      retryCount: this.retryCount,
      adaptiveEventCount: this.adaptiveEvents.length,
      factors: this.factors,
      adaptiveEvents: this.adaptiveEvents
    };
  }

  /**
   * Check if result should be marked INCOMPLETE due to determinism concerns
   * @returns {boolean} true if determinism issues force INCOMPLETE
   */
  shouldForceIncomplete() {
    // Non-deterministic behavior → cannot guarantee same verdict on re-run
    // Mark as INCOMPLETE so user knows to re-run and compare
    return this.getClassification() === 'NON_DETERMINISTIC';
  }

  /**
   * Check if result is reproducible (controlled non-determinism tracked)
   * @returns {boolean} true if run can be reproduced with same inputs
   */
  isReproducible() {
    // DETERMINISTIC or CONTROLLED (tracked) = reproducible
    // Only NON_DETERMINISTIC = not reproducible
    return this.getClassification() !== 'NON_DETERMINISTIC';
  }
}

export function createDeterminismAnalyzer(runId) {
  return new DeterminismAnalyzer(runId);
}
