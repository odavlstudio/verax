/**
 * PHASE 3: Interaction Intent Engine
 * Classifies runtime user actions as INTENTFUL or non-intentful
 * Based on observable facts ONLY (visibility, disability, noop markers)
 */

/**
 * Classify if an interaction is INTENTFUL (observable intent to affect state)
 * 
 * INTENTFUL = ALL of:
 * - element is visible and has non-zero bounding box
 * - element is not disabled/aria-disabled
 * - element is user-facing (not nav boilerplate)
 * - element is not explicitly noop (href="#", role=presentation)
 * 
 * @param {Object} record - Interaction intent record with element metadata
 * @returns {Object} {intentful: boolean, reason?: string}
 */
export function classifyInteractionIntent(record) {
  // Validate record structure
  if (!record || typeof record !== 'object') {
    return { intentful: false, reason: 'invalid-record' };
  }

  // Check 1: Visibility (bounding box check)
  if (!record.visible || record.boundingBox?.width <= 0 || record.boundingBox?.height <= 0) {
    return { intentful: false, reason: 'not-visible' };
  }

  // Check 2: Disabled state
  if (record.disabled === true || record.ariaDisabled === true) {
    return { intentful: false, reason: 'disabled' };
  }

  // Check 3: Explicit noop markers
  if (isNoopElement(record)) {
    return { intentful: false, reason: 'noop-marker' };
  }

  // Check 4: User-facing (not nav boilerplate)
  if (isNavBoilerplate(record)) {
    return { intentful: false, reason: 'nav-boilerplate' };
  }

  // All checks passed
  return { intentful: true };
}

/**
 * Check if element is explicitly marked as non-functional
 */
function isNoopElement(record) {
  // href noop markers (we store only kind, not the URL value)
  if (record.tagName === 'A') {
    const hrefKind = record.href?.kind || null;
    if (hrefKind === 'noop_hash' || hrefKind === 'noop_js') {
      return true;
    }
  }

  // role=presentation (semantic no-op)
  if (record.role === 'presentation' || record.role === 'none') {
    return true;
  }

  // Button with type=button and no onclick/form
  if (record.tagName === 'BUTTON' && record.type === 'button' &&
      !record.hasOnClick && !(record.form?.associated === true)) {
    return true;
  }

  return false;
}

/**
 * Check if element is nav boilerplate (not user intent)
 * Nav elements: header, nav, footer, aside (unless explicitly clicked)
 */
function isNavBoilerplate(record) {
  if (!record.containerTagName) {
    return false;
  }

  const navTags = ['header', 'nav', 'footer', 'aside'];
  const inNavContainer = navTags.includes(record.containerTagName.toLowerCase());

  // If in nav container, likely boilerplate unless it's a primary action
  if (inNavContainer) {
    // Exception: menu items (role=menuitem) and direct links are often intentful
    if (record.role === 'menuitem' || record.role === 'link' || record.role === 'button') {
      return false; // Treat as intentful
    }
    return true; // Likely boilerplate
  }

  return false;
}

/**
 * Evaluate if an interaction received acknowledgment
 * 
 * Acknowledgment signals (from PHASE 1 + PHASE 2):
 * - routeChanged: navigation signal
 * - outcomeAcknowledged: outcome watcher detected change
 * - delayedAcknowledgment: outcome took >6s
 * - meaningfulUIChange: UI mutations detected
 * - feedbackAppeared: feedback element visible
 * - networkActivity: correlated network request
 * 
 * @param {Object} signals - Evidence signals from bundle
 * @returns {Object} {acknowledged: boolean, signalCount: number, signals: string[]}
 */
export function evaluateAcknowledgment(signals) {
  if (!signals || typeof signals !== 'object') {
    return { acknowledged: false, signalCount: 0, signals: [] };
  }

  const acknowledgmentSignals = [
    'routeChanged',
    'outcomeAcknowledged',
    'delayedAcknowledgment',
    'meaningfulUIChange',
    'feedbackAppeared',
    'correlatedNetworkActivity', // Changed from networkActivity to match evidence-engine
    'navigationChanged',
    'domChanged'
  ];

  const detectedSignals = acknowledgmentSignals.filter(sig => signals[sig] === true);
  const acknowledged = detectedSignals.length > 0;

  return {
    acknowledged,
    signalCount: detectedSignals.length,
    signals: detectedSignals
  };
}

/**
 * Determine confidence level for interaction-based finding
 * 
 * Base confidence: 0.8 (high, backed by evidence)
 * Reduce by 0.1 if element location is ambiguous
 * 
 * @param {Object} record - Interaction intent record
 * @param {Object} _signals - Evidence signals
 * @returns {number} Confidence level 0.0-1.0
 */
export function calculateInteractionConfidence(record, _signals) {
  let confidence = 0.8; // Base: high confidence (observable evidence)

  // Reduce if element is ambiguous
  if (record && (record.containerTagName === 'nav' || record.containerTagName === 'footer')) {
    confidence -= 0.1;
  }

  // Reduce if nested in link/button (click target ambiguity)
  if (record && record.nestedInButton === true) {
    confidence -= 0.1;
  }

  return Math.max(0.5, confidence); // Floor at 0.5
}

/**
 * Create a bounded selector path for DOM location
 * Returns path like: main > div.content > button#submit (max 3 levels)
 * 
 * @param {Object} record - Interaction intent record with selectorPath
 * @returns {string} Bounded selector path
 */
export function createBoundedSelectorPath(record) {
  // NOTE: This function name is legacy; the engine no longer captures selectors.
  // Provide a coarse, non-identifying location string instead.
  const container = record?.containerTagName ? String(record.containerTagName) : 'document';
  const tag = record?.tagName ? String(record.tagName).toLowerCase() : 'unknown';
  return `${container} > ${tag}`;
}

/**
 * Generate a deterministic ID for interaction intent record
 * (no timestamps, for reproducibility)
 * 
 * @param {Object} record - Interaction intent record
 * @returns {string} Stable hash-based ID
 */
export function generateInteractionIntentId(record) {
  if (!record) return 'unknown';
  
  // Create stable string from observable properties
  const parts = [
    record.tagName || 'unknown',
    record.eventType || 'unknown',
    record.role || 'no-role',
    record.type || 'no-type',
    record.href?.kind || 'no-href',
    record.form?.associated === true ? 'in-form' : 'no-form',
    record.form?.isSubmitControl === true ? 'submit' : 'no-submit',
    record.aria?.expanded ? `aria-expanded:${record.aria.expanded}` : 'no-aria-expanded',
    record.aria?.pressed ? `aria-pressed:${record.aria.pressed}` : 'no-aria-pressed',
    record.aria?.checked ? `aria-checked:${record.aria.checked}` : 'no-aria-checked',
  ];

  const stableString = parts.join('|');
  
  // Simple hash: sum of character codes (deterministic, not cryptographic)
  let hash = 0;
  for (let i = 0; i < stableString.length; i++) {
    hash = ((hash << 5) - hash) + stableString.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `interaction_${Math.abs(hash).toString(36)}`;
}
