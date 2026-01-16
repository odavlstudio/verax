/**
 * DOM Diff Engine
 * Computes structured differences between HTML snapshots
 * Distinguishes meaningful changes from noise
 */

/**
 * Compute a diff between two HTML documents
 * Returns a summary of changes without full tree comparison (for performance)
 * Includes isMeaningful flag to distinguish signal from noise
 */
export function computeDOMDiff(htmlBefore, htmlAfter) {
  const _before = parseHTML(htmlBefore);
  const _after = parseHTML(htmlAfter);
  
  const diff = {
    htmlLengthBefore: htmlBefore.length,
    htmlLengthAfter: htmlAfter.length,
    changed: htmlBefore !== htmlAfter,
    isMeaningful: false,
    elementsRemoved: [],
    elementsAdded: [],
    attributesChanged: [],
    contentChanged: [],
  };
  
  if (!diff.changed) {
    return diff;
  }
  
  // Check if this is only noise (timestamps, random ids, tracking)
  if (isNoisyChangeOnly(htmlBefore, htmlAfter)) {
    diff.changed = true;
    diff.isMeaningful = false;
    return diff;
  }
  
  // Quick heuristics for specific changes
  // Check for new elements with specific roles/classes that indicate feedback
  const feedbackPatterns = [
    'role="alert"',
    'role="status"',
    'aria-live',
    'class="toast"',
    'class="error"',
    'class="success"',
    'class="modal"',
    'class="dialog"',
    '[data-error]',
    '[data-success]',
  ];
  
  for (const pattern of feedbackPatterns) {
    if (!htmlBefore.includes(pattern) && htmlAfter.includes(pattern)) {
      diff.elementsAdded.push(pattern);
      diff.isMeaningful = true;
    }
    if (htmlBefore.includes(pattern) && !htmlAfter.includes(pattern)) {
      diff.elementsRemoved.push(pattern);
      diff.isMeaningful = true;
    }
  }
  
  // Check for attribute changes (disabled, aria-invalid, etc.)
  const attrPatterns = [
    'disabled',
    'aria-invalid',
    'aria-disabled',
    'data-loading',
  ];
  
  for (const attr of attrPatterns) {
    const beforeCount = countOccurrences(htmlBefore, attr);
    const afterCount = countOccurrences(htmlAfter, attr);
    
    if (beforeCount !== afterCount) {
      diff.attributesChanged.push({
        attribute: attr,
        before: beforeCount,
        after: afterCount,
      });
      diff.isMeaningful = true;
    }
  }
  
  // Check for form state changes (values, structure)
  if (checkFormStateChange(htmlBefore, htmlAfter)) {
    diff.isMeaningful = true;
  }
  
  return diff;
}

/**
 * Parse HTML and return basic structure info
 */
function parseHTML(html) {
  return {
    bodyLength: html.length,
    hasHead: html.includes('<head'),
    hasBody: html.includes('<body'),
    formCount: countOccurrences(html, '<form'),
    inputCount: countOccurrences(html, '<input'),
    buttonCount: countOccurrences(html, '<button'),
  };
}

/**
 * Count occurrences of a substring
 */
function countOccurrences(str, substr) {
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(substr, pos)) !== -1) {
    count++;
    pos += substr.length;
  }
  return count;
}

/**
 * Detect if DOM appears to have feedback elements
 */
export function hasFeedbackElements(html) {
  const feedbackIndicators = [
    'role="alert"',
    'role="status"',
    'aria-live="polite"',
    'aria-live="assertive"',
    'toast',
    'error',
    'success',
    'validation',
  ];
  
  return feedbackIndicators.some(indicator => 
    html.includes(indicator)
  );
}

/**
 * Detect if DOM appears to have validation errors
 */
export function hasValidationErrors(html) {
  const errorPatterns = [
    'aria-invalid="true"',
    'aria-invalid=\'true\'',
    'invalid',
    'error',
    'required',
  ];
  
  return errorPatterns.some(pattern => html.includes(pattern));
}

/**
 * Check if the HTML change is only noise (timestamps, random IDs, tracking pixels)
 * Returns true if ONLY noise detected, false if meaningful changes exist
 */
function isNoisyChangeOnly(htmlBefore, htmlAfter) {
  // Make a copy and remove known noise patterns
  let before = htmlBefore;
  let after = htmlAfter;
  
  // Remove timestamps (ISO, Unix, etc.)
  const timestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^"']*/g;
  before = before.replace(timestampPattern, '[TIMESTAMP]');
  after = after.replace(timestampPattern, '[TIMESTAMP]');
  
  // Remove UUID-like patterns
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  before = before.replace(uuidPattern, '[UUID]');
  after = after.replace(uuidPattern, '[UUID]');
  
  // Remove random hash-like values
  const hashPattern = /[a-f0-9]{32,}/g;
  before = before.replace(hashPattern, '[HASH]');
  after = after.replace(hashPattern, '[HASH]');
  
  // Remove tracking params (ga, fbclid, etc.)
  const trackingPattern = /[?&](ga[a-z_]*|fbclid|utm_[a-z]*|gclid|msclkid)=[^&"']*/g;
  before = before.replace(trackingPattern, '[TRACKING]');
  after = after.replace(trackingPattern, '[TRACKING]');
  
  // Remove data-testid and similar noise attrs
  const testIdPattern = /data-testid="[^"]*"/g;
  before = before.replace(testIdPattern, '');
  after = after.replace(testIdPattern, '');
  
  // If they're now equal, it was only noise
  return before === after;
}

/**
 * Check for meaningful form state changes
 */
function checkFormStateChange(htmlBefore, htmlAfter) {
  // Check for form input value changes (meaningful state change)
  const beforeInputs = extractInputValues(htmlBefore);
  const afterInputs = extractInputValues(htmlAfter);
  
  if (beforeInputs.size !== afterInputs.size) {
    return true;
  }
  
  for (const [key, value] of beforeInputs) {
    if (afterInputs.get(key) !== value) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract input name-value pairs from HTML
 */
function extractInputValues(html) {
  const values = new Map();
  const inputPattern = /<input[^>]*name="([^"]*)"[^>]*value="([^"]*)"/g;
  let match;
  while ((match = inputPattern.exec(html)) !== null) {
    values.set(match[1], match[2]);
  }
  return values;
}
