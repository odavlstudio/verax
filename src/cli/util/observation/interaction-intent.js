/**
 * Interaction Intent (Click) — Minimal, deterministic, unit-testable.
 *
 * This model is used by detection (e.g., dead-interaction) to determine
 * what observable outcome a click reasonably promises, based only on
 * element semantics (no selectors, no text, no HTML blobs).
 */

export const INTERACTION_INTENTS = Object.freeze({
  NAVIGATION_INTENT: 'NAVIGATION_INTENT',
  SUBMISSION_INTENT: 'SUBMISSION_INTENT',
  ASYNC_FEEDBACK_INTENT: 'ASYNC_FEEDBACK_INTENT',
  TOGGLE_INTENT: 'TOGGLE_INTENT',
  UNKNOWN_INTENT: 'UNKNOWN_INTENT',
});

/**
 * @typedef {Object} IntentResult
 * @property {keyof typeof INTERACTION_INTENTS} intent
 * @property {string[]} reasons - Deterministic reason codes
 */

function isString(v) {
  return typeof v === 'string' && v.length > 0;
}

function toUpperOrNull(v) {
  return isString(v) ? String(v).toUpperCase() : null;
}

function getHrefKind(elementSnapshot) {
  const kind = elementSnapshot?.href?.kind;
  return isString(kind) ? kind : null;
}

function hasToggleSemantics(elementSnapshot) {
  const aria = elementSnapshot?.aria || {};
  const expanded = aria.expanded;
  const pressed = aria.pressed;
  const checked = aria.checked;
  const hasAriaToggle =
    expanded !== null && expanded !== undefined ||
    pressed !== null && pressed !== undefined ||
    checked !== null && checked !== undefined;

  const controlChecked = elementSnapshot?.control?.checked;
  const hasCheckableControl = typeof controlChecked === 'boolean';

  return hasAriaToggle || hasCheckableControl;
}

/**
 * Infer intent for a click interaction.
 *
 * Input `elementSnapshot` is expected to be a minimal safe snapshot captured
 * before the click (and optionally containing `form`/`href`/`aria` fields).
 *
 * @param {Object} params
 * @param {Object|null} params.elementSnapshot
 * @param {string} params.actionType - e.g. "click"
 * @returns {IntentResult}
 */
export function inferInteractionIntent({ elementSnapshot, actionType }) {
  /** @type {string[]} */
  const reasons = [];

  if (actionType !== 'click') {
    return { intent: INTERACTION_INTENTS.UNKNOWN_INTENT, reasons: ['unsupported_action'] };
  }

  if (!elementSnapshot || typeof elementSnapshot !== 'object') {
    return { intent: INTERACTION_INTENTS.UNKNOWN_INTENT, reasons: ['missing_element_snapshot'] };
  }

  if (elementSnapshot.disabled === true || elementSnapshot.ariaDisabled === true) {
    return { intent: INTERACTION_INTENTS.UNKNOWN_INTENT, reasons: ['element_disabled'] };
  }

  const tagName = toUpperOrNull(elementSnapshot.tagName) || 'UNKNOWN';
  const role = toUpperOrNull(elementSnapshot.role);
  const inputType = toUpperOrNull(elementSnapshot.type);

  // 1) NAVIGATION_INTENT: anchor/link semantics with href present (we never store the href value)
  if (tagName === 'A' || role === 'LINK') {
    const hrefKind = getHrefKind(elementSnapshot);
    if (hrefKind) {
      reasons.push('anchor_like_with_href');
      if (hrefKind === 'noop_hash' || hrefKind === 'noop_js') {
        reasons.push('href_noop_marker');
      }
      return { intent: INTERACTION_INTENTS.NAVIGATION_INTENT, reasons };
    }
  }

  // 2) SUBMISSION_INTENT: submit controls associated with a form
  const inForm = elementSnapshot?.form?.associated === true;
  const submitControl = elementSnapshot?.form?.isSubmitControl === true ||
    inputType === 'SUBMIT' ||
    (tagName === 'BUTTON' && inputType === 'SUBMIT');

  if (inForm && submitControl) {
    reasons.push('submit_control_in_form');
    return { intent: INTERACTION_INTENTS.SUBMISSION_INTENT, reasons };
  }

  // 3) TOGGLE_INTENT: toggle semantics via aria-* or checkable controls
  if (hasToggleSemantics(elementSnapshot)) {
    reasons.push('toggle_semantics_present');
    return { intent: INTERACTION_INTENTS.TOGGLE_INTENT, reasons };
  }

  // 4) ASYNC_FEEDBACK_INTENT: explicit click handler marker
  // Note: `hasOnClick` is conservative (doesn't detect addEventListener), but is deterministic.
  if (elementSnapshot.hasOnClick === true) {
    reasons.push('explicit_onclick_handler');
    return { intent: INTERACTION_INTENTS.ASYNC_FEEDBACK_INTENT, reasons };
  }

  // 5) UNKNOWN_INTENT: no concrete semantics available
  reasons.push('insufficient_semantics');
  return { intent: INTERACTION_INTENTS.UNKNOWN_INTENT, reasons };
}

