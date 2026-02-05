/**
 * Submission Intent — deterministic, unit-testable.
 *
 * Used to gate silent form submission findings.
 * No selectors. No text. No HTML.
 */

export const SUBMISSION_INTENTS = Object.freeze({
  FORM_SUBMISSION_INTENT: 'FORM_SUBMISSION_INTENT',
  UNKNOWN_SUBMISSION_INTENT: 'UNKNOWN_SUBMISSION_INTENT',
});

function capReasonStrings(reasons) {
  if (!Array.isArray(reasons)) return [];
  return reasons
    .filter(r => typeof r === 'string' && r.length > 0)
    .slice(0, 8)
    .map(r => (r.length > 80 ? r.slice(0, 80) : r));
}

/**
 * @param {Object} params
 * @param {Object|null} params.elementSnapshot
 * @param {string} params.actionType - e.g. "submit"
 * @returns {{ intent: keyof typeof SUBMISSION_INTENTS, reasons: string[] }}
 */
export function inferSubmissionIntent({ elementSnapshot, actionType }) {
  /** @type {string[]} */
  const reasons = [];

  if (actionType !== 'submit') {
    return { intent: SUBMISSION_INTENTS.UNKNOWN_SUBMISSION_INTENT, reasons: ['unsupported_action'] };
  }

  if (!elementSnapshot || typeof elementSnapshot !== 'object') {
    return { intent: SUBMISSION_INTENTS.UNKNOWN_SUBMISSION_INTENT, reasons: ['missing_element_snapshot'] };
  }

  const form = elementSnapshot.form || {};
  if (form.associated === true && form.isSubmitControl === true) {
    reasons.push('submit_control_in_form');
    return { intent: SUBMISSION_INTENTS.FORM_SUBMISSION_INTENT, reasons };
  }

  reasons.push('insufficient_submission_semantics');
  return { intent: SUBMISSION_INTENTS.UNKNOWN_SUBMISSION_INTENT, reasons: capReasonStrings(reasons) };
}

