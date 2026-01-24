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
export { FEEDBACK_TYPE, FEEDBACK_SCORE } from './ui-feedback-intelligence/types.js';

/**
 * PHASE 13: Detect UI feedback signals from trace sensors
 * 
 * @param {Object} trace - Interaction trace with sensors
 * @returns {Array} Array of detected feedback signals
 */
export { detectUIFeedbackSignals } from './ui-feedback-intelligence/detect-signals.js';

/**
 * PHASE 13: Score feedback presence/absence
 * 
 * @param {Array} signals - Detected feedback signals
 * @param {Object} expectation - Promise/expectation that should have feedback
 * @param {Object} trace - Interaction trace
 * @returns {Object} Scoring result
 */
export { scoreUIFeedback } from './ui-feedback-intelligence/score-signals.js';

/**
 * Build explanation for feedback score
 */
// Internal helper moved; behavior unchanged

/**
 * Helper functions to find selectors
 */
// Internal helpers moved; behavior unchanged

/**
 * Check if DOM change is meaningful (not just timestamps/random IDs)
 */
// Internal helper moved; behavior unchanged

/**
 * PHASE 13: Correlate promise with UI feedback
 * 
 * @param {Object} expectation - Promise/expectation
 * @param {Object} feedbackScore - Feedback scoring result
 * @param {Object} trace - Interaction trace
 * @returns {Object} Correlation result
 */
export { correlatePromiseWithFeedback } from './ui-feedback-intelligence/correlate-promise.js';

/**
 * PHASE 13: Build evidence for UI feedback finding
 * 
 * @param {Object} feedbackScore - Feedback scoring result
 * @param {Object} correlation - Promise-feedback correlation
 * @param {Object} trace - Interaction trace
 * @param {Object} expectation - Promise/expectation
 * @returns {Object} Evidence object
 */
export { buildUIFeedbackEvidence } from './ui-feedback-intelligence/build-evidence.js';




