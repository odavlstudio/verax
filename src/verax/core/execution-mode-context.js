/**
 * Execution Mode Context Manager
 * 
 * Manages execution mode detection and provides context throughout the scan pipeline.
 * Responsible for:
 * - Detecting mode at scan start
 * - Passing mode through all phases
 * - Applying ceilings to confidence calculations
 * - Injecting mode explanations into output
 */

import { detectExecutionMode, applyConfidenceCeiling, CONFIDENCE_CEILINGS as _CONFIDENCE_CEILINGS } from './execution-mode-detector.js';

/**
 * Execution mode context object
 */
class ExecutionModeContext {
  constructor(mode, ceiling, explanation, reason) {
    this.mode = mode;
    this.ceiling = ceiling;
    this.explanation = explanation;
    this.reason = reason;
  }

  /**
   * Apply ceiling to a confidence score
   * @param {number} score - Confidence score (0..1)
   * @returns {number} - Capped score
   */
  applyCeiling(score) {
    return applyConfidenceCeiling(score, this.mode);
  }

  /**
   * Get CLI explanation for output
   * @returns {string} - Human-readable explanation
   */
  getCliExplanation() {
    const ceilingPct = Math.round(this.ceiling * 100);
    if (this.mode === 'WEB_SCAN_LIMITED') {
      return `Running ${this.mode} mode: analyzing URL without access to source code. Confidence limited to ${ceilingPct}%.`;
    } else {
      return `Running ${this.mode} mode: full project analysis with source code available.`;
    }
  }

  /**
   * Get JSON-serializable context
   * @returns {Object}
   */
  toJSON() {
    return {
      mode: this.mode,
      ceiling: this.ceiling,
      explanation: this.explanation,
      reason: this.reason
    };
  }
}

/**
 * Detect and create execution mode context for a scan
 * @param {string} srcPath - Source code path
 * @param {string} url - Target URL
 * @returns {ExecutionModeContext}
 */
export function createExecutionModeContext(srcPath, url) {
  const modeInfo = detectExecutionMode(srcPath, url);
  return new ExecutionModeContext(
    modeInfo.mode,
    modeInfo.ceiling,
    modeInfo.explanation,
    modeInfo.reason
  );
}

export { ExecutionModeContext };



