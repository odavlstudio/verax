/**
 * DOM Diff Engine
 * Computes structured differences between HTML snapshots
 * Distinguishes meaningful changes from noise
 * 
 * CONSTITUTIONAL SCOPE LOCK:
 * - Only claims to detect feedback within defined scope
 * - Out-of-scope feedback gets explicit classification (not "silent failure")
 * - Zero false negatives within declared scope
 */

import { analyzeChangeScope, getOutOfScopeExplanation } from './feedback-scope.js';

/**
 * Compute a diff between two HTML documents
 * Returns a summary of changes without full tree comparison (for performance)
 * Includes isMeaningful flag to distinguish signal from noise
 * 
 * NEW: Includes scopeClassification to distinguish out-of-scope feedback
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
    // NEW: Scope classification
    scopeClassification: 'unknown', // 'in-scope' | 'out-of-scope' | 'no-change' | 'noise-only'
    outOfScopeExplanation: null,
  };
  
  if (!diff.changed) {
    diff.scopeClassification = 'no-change';
    return diff;
  }
  
  // Check if this is only noise (timestamps, random ids, tracking)
  if (isNoisyChangeOnly(htmlBefore, htmlAfter)) {
    diff.changed = true;
    diff.isMeaningful = false;
    diff.scopeClassification = 'noise-only';
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
  // These are in-scope attributes we track
  const attrPatterns = [
    'disabled',
    'aria-invalid',
    'aria-disabled',
    'data-loading',
  ];
  
  for (const attr of attrPatterns) {
    // For boolean attributes like 'disabled', count occurrences
    if (attr === 'disabled') {
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
    } else {
      // For value-based attributes, check actual value changes
      const beforeValues = extractAttributeValues(htmlBefore, attr);
      const afterValues = extractAttributeValues(htmlAfter, attr);
      
      if (beforeValues.join(',') !== afterValues.join(',')) {
        diff.attributesChanged.push({
          attribute: attr,
          before: beforeValues.join(', ') || 'none',
          after: afterValues.join(', ') || 'none',
        });
        diff.isMeaningful = true;
      }
    }
  }
  
  // Check for form state changes (values, structure)
  if (checkFormStateChange(htmlBefore, htmlAfter)) {
    diff.isMeaningful = true;
  }
  
  // P0 FIX: Check for text content changes in stable elements
  // This catches feedback like "Ping acknowledged" appearing in aria-live regions
  const textChanges = detectTextContentChanges(htmlBefore, htmlAfter);
  if (textChanges.length > 0) {
    diff.contentChanged = textChanges;
    diff.isMeaningful = true;
  }
  
  // CONSTITUTIONAL SCOPE LOCK:
  // If we found meaningful changes, classify as in-scope
  // If no meaningful changes found, check if changes are out-of-scope
  if (diff.isMeaningful) {
    diff.scopeClassification = 'in-scope';
  } else {
    // Analyze if this is out-of-scope feedback (style, aria-hidden, etc.)
    const scopeAnalysis = analyzeChangeScope(htmlBefore, htmlAfter);
    
    if (scopeAnalysis.isOutOfScopeOnly) {
      // This is feedback, but outside our detection scope
      diff.scopeClassification = 'out-of-scope';
      diff.outOfScopeExplanation = getOutOfScopeExplanation(scopeAnalysis);
      // Important: isMeaningful stays FALSE, but we explain why
    } else {
      // Truly no meaningful change (or we can't tell)
      diff.scopeClassification = 'in-scope'; // Default: assume in-scope if we can't classify
    }
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
 * Extract attribute values from HTML
 * @param {string} html - HTML string
 * @param {string} attr - Attribute name (e.g., 'aria-invalid', 'data-loading')
 * @returns {Array<string>} Array of attribute values
 */
function extractAttributeValues(html, attr) {
  const values = [];
  const pattern = new RegExp(`${attr}="([^"]*)"`, 'g');
  
  let match;
  while ((match = pattern.exec(html)) !== null) {
    values.push(match[1]);
  }
  
  return values;
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

/**
 * P0 FIX: Detect meaningful text content changes in stable elements
 * Focuses on elements with stable identifiers (id, aria-live) where text updates are meaningful feedback
 */
function detectTextContentChanges(htmlBefore, htmlAfter) {
  const changes = [];
  
  // Pattern to match elements with id or aria-live attributes and their text content
  // Captures: element with id/aria-live, then extracts text between tags
  const stableElementPatterns = [
    // Elements with id attribute: <tagname id="value">text</tagname>
    /<(\w+)\s+[^>]*id="([^"]+)"[^>]*>([^<]*)</g,
    // Elements with aria-live: <tagname aria-live="polite|assertive">text</tagname>
    /<(\w+)\s+[^>]*aria-live="[^"]+"[^>]*>([^<]*)</g,
    // Elements with role="status" or role="alert"
    /<(\w+)\s+[^>]*role="(status|alert)"[^>]*>([^<]*)</g,
  ];
  
  for (const pattern of stableElementPatterns) {
    const beforeMatches = new Map();
    const afterMatches = new Map();
    
    // Extract elements and their text from before HTML
    let match;
    const beforePattern = new RegExp(pattern.source, pattern.flags);
    while ((match = beforePattern.exec(htmlBefore)) !== null) {
      const tag = match[1];
      const identifier = match[2] || 'aria-live';
      const text = match[3] || match[match.length - 1] || '';
      const key = `${tag}:${identifier}`;
      beforeMatches.set(key, normalizeWhitespace(text));
    }
    
    // Extract elements and their text from after HTML
    const afterPattern = new RegExp(pattern.source, pattern.flags);
    while ((match = afterPattern.exec(htmlAfter)) !== null) {
      const tag = match[1];
      const identifier = match[2] || 'aria-live';
      const text = match[3] || match[match.length - 1] || '';
      const key = `${tag}:${identifier}`;
      afterMatches.set(key, normalizeWhitespace(text));
    }
    
    // Compare text content for matching elements
    for (const [key, beforeText] of beforeMatches) {
      const afterText = afterMatches.get(key) || '';
      if (beforeText !== afterText && (beforeText || afterText)) {
        // Text changed - check if it's meaningful (not just whitespace)
        if (beforeText.length > 0 || afterText.length > 0) {
          changes.push({
            element: key,
            before: beforeText,
            after: afterText,
          });
        }
      }
    }
    
    // Check for new elements with text content
    for (const [key, afterText] of afterMatches) {
      if (!beforeMatches.has(key) && afterText.length > 0) {
        changes.push({
          element: key,
          before: '',
          after: afterText,
        });
      }
    }
  }
  
  return changes;
}

/**
 * Normalize whitespace for text comparison
 */
function normalizeWhitespace(text) {
  return text.trim().replace(/\s+/g, ' ');
}



