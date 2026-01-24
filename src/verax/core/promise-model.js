/**
 * PROMISE MODEL - Canonical representation of what interactions promise
 * 
 * A Promise is a technical contract between code and user:
 * "When user executes this interaction, this observable signal will change"
 * 
 * CRITICAL: Promises are derived ONLY from observable technical signals.
 * No business logic, no semantics, no guessing what "should" happen.
 */

/**
 * Canonical Promise Types - What observable outcome is promised
 */
export const PROMISE_TYPES = {
  // URL or route path changes (including client-side routing)
  NAVIGATION_PROMISE: 'NAVIGATION_PROMISE',
  
  // HTTP request sent + success/error response handling
  SUBMISSION_PROMISE: 'SUBMISSION_PROMISE',
  
  // DOM or application state changes (not just network)
  STATE_CHANGE_PROMISE: 'STATE_CHANGE_PROMISE',
  
  // Visual or textual feedback to user (spinner, toast, modal, etc.)
  FEEDBACK_PROMISE: 'FEEDBACK_PROMISE'
};

/**
 * Promise Type Definitions
 */
export const PROMISE_DEFINITIONS = {
  NAVIGATION_PROMISE: {
    title: 'Navigation',
    description: 'Interaction implies a change in page URL or client-side route',
    example: 'Clicking a link; navigating to next step in wizard',
    expected_signal: 'window.location changes OR route state changes'
  },
  
  SUBMISSION_PROMISE: {
    title: 'Submission',
    description: 'Interaction implies form/data submission with response handling',
    example: 'Clicking "Send", "Submit", "Save"; HTTP request with success/error handling',
    expected_signal: 'HTTP request sent AND response triggers success feedback OR error message'
  },
  
  STATE_CHANGE_PROMISE: {
    title: 'State Change',
    description: 'Interaction implies application/DOM state change (cart, filters, view)',
    example: 'Adding to cart; toggling visibility; filtering; sorting',
    expected_signal: 'DOM change or app state variable changes'
  },
  
  FEEDBACK_PROMISE: {
    title: 'Feedback',
    description: 'Interaction implies user-visible feedback (confirmation, error, info)',
    example: 'Click should trigger spinner, toast, modal, or message',
    expected_signal: 'Visual/textual feedback appears: spinner, toast, error, success message'
  }
};

/**
 * PromiseDescriptor - What a specific interaction promises
 * 
 * @typedef {Object} PromiseDescriptor
 * @property {string} type - One of PROMISE_TYPES
 * @property {string} source - What interaction type implied this promise (button_click, form_submit, link_click, etc.)
 * @property {string} expected_signal - What observable signal would satisfy this promise
 * @property {Object} context - Additional context about the promise
 *   - {string} [target] - Target URL/route for NAVIGATION
 *   - {string} [endpoint] - Endpoint for SUBMISSION
 *   - {string} [stateKey] - State variable for STATE_CHANGE
 *   - {Array} [feedbackTypes] - Types of feedback for FEEDBACK (spinner, toast, modal, message)
 * @property {string} [reason] - If UNPROVEN, why promise is ambiguous
 */

/**
 * Infer Promise from interaction type and context
 * 
 * Returns a PromiseDescriptor or null if no promise can be inferred
 */
export function inferPromiseFromInteraction(interaction) {
  if (!interaction) return null;
  
  const type = interaction.type?.toLowerCase() || '';
  const label = interaction.label?.toLowerCase() || '';
  const ariaLabel = interaction.ariaLabel?.toLowerCase() || '';
  const allText = `${type} ${label} ${ariaLabel}`.toLowerCase();
  
  // NAVIGATION_PROMISE: links, navigation buttons
  if (type === 'link' || type === 'navigation_link') {
    return {
      type: PROMISE_TYPES.NAVIGATION_PROMISE,
      source: 'link_click',
      expected_signal: 'URL or client-side route changes',
      context: { target: interaction.href }
    };
  }
  
  // NAVIGATION_PROMISE: "next", "go to", "navigate" buttons
  if (type === 'button' && (
    allText.includes('next') || 
    allText.includes('goto') || 
    allText.includes('go to') ||
    allText.includes('navigate') ||
    allText.includes('back') ||
    allText.includes('previous')
  )) {
    return {
      type: PROMISE_TYPES.NAVIGATION_PROMISE,
      source: 'navigation_button',
      expected_signal: 'URL or client-side route changes',
      context: {}
    };
  }
  
  // SUBMISSION_PROMISE: form submit, "send", "submit", "save" buttons
  if (type === 'form_submit' || (type === 'button' && (
    allText.includes('submit') ||
    allText.includes('send') ||
    allText.includes('save') ||
    allText.includes('apply') ||
    allText.includes('confirm') ||
    allText.includes('post')
  ))) {
    return {
      type: PROMISE_TYPES.SUBMISSION_PROMISE,
      source: 'form_submit',
      expected_signal: 'HTTP request sent AND success or error feedback displayed',
      context: {}
    };
  }
  
  // FEEDBACK_PROMISE: buttons with generic labels (click, press, tap)
  // These usually expect some feedback but promise type is ambiguous
  if (type === 'button' && (
    allText.includes('click') || 
    allText.includes('tap') ||
    allText.includes('press') ||
    allText.length === 0
  )) {
    return {
      type: PROMISE_TYPES.FEEDBACK_PROMISE,
      source: 'generic_button',
      expected_signal: 'Visual or textual feedback appears',
      context: {},
      reason: 'Generic button label; promise type cannot be determined'
    };
  }
  
  // STATE_CHANGE_PROMISE: toggle, add, remove, filter, sort
  if (allText.includes('toggle') ||
    allText.includes('add') ||
    allText.includes('remove') ||
    allText.includes('delete') ||
    allText.includes('filter') ||
    allText.includes('sort') ||
    allText.includes('show') ||
    allText.includes('hide') ||
    allText.includes('cart')) {
    return {
      type: PROMISE_TYPES.STATE_CHANGE_PROMISE,
      source: 'state_action_button',
      expected_signal: 'DOM or application state changes',
      context: {}
    };
  }
  
  // Default to FEEDBACK_PROMISE if interaction is a button but type unclear
  if (type === 'button') {
    return {
      type: PROMISE_TYPES.FEEDBACK_PROMISE,
      source: 'button',
      expected_signal: 'User-visible feedback or state change',
      context: {},
      reason: 'Button intent unclear; assuming feedback expected'
    };
  }
  
  // No promise can be inferred
  return null;
}

/**
 * Validate that a promise descriptor is well-formed
 */
export function isValidPromiseDescriptor(promise) {
  return promise &&
    Object.values(PROMISE_TYPES).includes(promise.type) &&
    typeof promise.source === 'string' &&
    typeof promise.expected_signal === 'string';
}

/**
 * Format Promise for human display
 */
export function formatPromiseForDisplay(promise) {
  if (!promise) return 'No promise';
  
  const def = PROMISE_DEFINITIONS[promise.type] || {};
  return {
    type: promise.type,
    title: def.title || promise.type,
    expected: promise.expected_signal,
    source: promise.source
  };
}

/**
 * Create a promise descriptor explicitly
 */
export function createPromiseDescriptor(type, source, expected_signal, context = {}, reason = null) {
  if (!Object.values(PROMISE_TYPES).includes(type)) {
    throw new Error(`Invalid promise type: ${type}`);
  }
  
  const descriptor = {
    type,
    source,
    expected_signal,
    context
  };
  
  if (reason) {
    descriptor.reason = reason;
  }
  
  return descriptor;
}

export default PROMISE_TYPES;



