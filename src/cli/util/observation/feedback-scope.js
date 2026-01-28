/**
 * CONSTITUTIONAL FEEDBACK SCOPE
 * 
 * This is the single source of truth defining what feedback VERAX can and cannot detect.
 * 
 * DESIGN PHILOSOPHY:
 * - Be conservative: Only claim to detect what we can reliably detect
 * - Be honest: Explicitly declare what is out of scope
 * - Zero false negatives: Within our scope, we MUST detect all feedback
 * - No silent surprises: Out-of-scope feedback gets explicit classification
 * 
 * WHY THIS MATTERS:
 * False negatives are worse than false positives. If we claim something is a "silent failure"
 * when it actually provided feedback (that we just can't see), we destroy trust.
 */

/**
 * IN-SCOPE FEEDBACK
 * 
 * Feedback patterns that VERAX guarantees to detect with zero false negatives.
 * These are patterns where we have high confidence in detection reliability.
 */
export const IN_SCOPE_FEEDBACK = {
  
  // TEXT CONTENT CHANGES
  // We detect text appearing/changing in stable elements
  textContent: {
    patterns: [
      'aria-live regions (polite, assertive)',
      'Elements with id attributes',
      'role="status" elements',
      'role="alert" elements',
    ],
    implementation: 'detectTextContentChanges() in dom-diff.js',
    confidence: 'HIGH',
    rationale: 'Text changes in identified elements are deterministic and DOM-stable'
  },
  
  // ATTRIBUTE CHANGES (WHITELISTED)
  // We detect changes to specific semantic attributes
  attributes: {
    patterns: [
      'disabled attribute (buttons, inputs)',
      'aria-invalid attribute (form validation)',
      'aria-disabled attribute (a11y state)',
      'data-loading attribute (explicit loading flag)',
    ],
    implementation: 'attrPatterns whitelist in dom-diff.js',
    confidence: 'HIGH',
    rationale: 'These attributes have clear semantics and are commonly used for state'
  },
  
  // STRUCTURAL CHANGES (FEEDBACK ELEMENTS)
  // We detect new elements with feedback-specific roles/classes
  structure: {
    patterns: [
      'New role="alert" elements',
      'New role="status" elements',
      'New aria-live elements',
      'New toast/error/success/modal/dialog elements (class-based)',
      'New data-error or data-success attributes',
    ],
    implementation: 'feedbackPatterns in dom-diff.js',
    confidence: 'MEDIUM-HIGH',
    rationale: 'Element addition/removal is reliable, but class names are conventional'
  },
  
  // FORM STATE CHANGES
  // We detect form input value changes
  formState: {
    patterns: [
      'Input value changes',
      'Form structure changes',
    ],
    implementation: 'checkFormStateChange() in dom-diff.js',
    confidence: 'MEDIUM',
    rationale: 'Input values are stable but extraction is regex-based'
  }
};

/**
 * OUT-OF-SCOPE FEEDBACK
 * 
 * Feedback patterns that VERAX intentionally does NOT detect.
 * These require capabilities we don't have (CSS parsing, visual diffing, etc.).
 * 
 * CRITICAL: When these changes occur, they MUST NOT be classified as "silent failure"
 */
export const OUT_OF_SCOPE_FEEDBACK = {
  
  // VISUAL/STYLE CHANGES
  // We cannot detect visual changes without CSS parsing or visual diffing
  visual: {
    patterns: [
      'style attribute changes (display, visibility, opacity)',
      'CSS class changes (unless class name matches feedback pattern)',
      'CSS animations/transitions',
      'Color changes',
      'Layout shifts',
      'Element positioning (absolute, fixed, sticky)',
    ],
    rationale: 'Requires CSS parsing or visual diff (screenshot comparison)',
    impact: 'HIGH - affects loading spinners, modals, visibility toggles',
    examples: [
      '<div style="display: none"> → style="display: block"',
      '<div class="hidden"> → class="visible"',
      'Spinner appears via CSS class change',
      'Modal opens via style attribute',
    ]
  },
  
  // ACCESSIBILITY ATTRIBUTES (NON-WHITELISTED)
  // Many a11y attributes are not in our whitelist
  accessibility: {
    patterns: [
      'aria-hidden changes',
      'aria-expanded changes',
      'aria-selected changes',
      'aria-busy changes',
      'aria-pressed changes',
      'aria-checked changes (outside form inputs)',
      'aria-current changes',
      'role changes (dynamic role updates)',
    ],
    rationale: 'Not in attribute whitelist; would need value tracking',
    impact: 'MEDIUM - affects menu toggles, accordions, tabs, dynamic UI',
    examples: [
      '<nav aria-hidden="true"> → aria-hidden="false"',
      '<button aria-expanded="false"> → aria-expanded="true"',
      'Menu expands via aria-expanded',
    ]
  },
  
  // CUSTOM DATA ATTRIBUTES (NON-WHITELISTED)
  // We only track data-loading, not other data-* attributes
  customData: {
    patterns: [
      'data-state changes',
      'data-status changes',
      'data-error changes (unless element added)',
      'data-success changes (unless element added)',
      'Any custom data-* attribute not in whitelist',
    ],
    rationale: 'Whitelist approach - can\'t track all custom patterns',
    impact: 'LOW-MEDIUM - affects custom component frameworks',
    examples: [
      '<div data-state="idle"> → data-state="loading"',
      '<form data-validation="pending"> → data-validation="complete"',
    ]
  },
  
  // TIMING/ANIMATION
  // We don't detect feedback that requires timing observation
  timing: {
    patterns: [
      'CSS transition start/end',
      'Animation completion',
      'Delayed visibility changes',
      'Progressive reveals',
    ],
    rationale: 'Would require polling or mutation observers',
    impact: 'LOW - mostly aesthetic feedback',
    examples: [
      'Fade-in animation',
      'Slide transition',
      'Progressive loading bar',
    ]
  },
  
  // VIEWPORT/SCROLL
  // We don't track scroll position or viewport changes
  viewport: {
    patterns: [
      'Scroll position changes',
      'Element scrolled into view',
      'Viewport size changes',
      'Sticky header state',
    ],
    rationale: 'Would require viewport tracking',
    impact: 'LOW - secondary feedback mechanism',
    examples: [
      'Form error scrolled into view',
      'Success message at top of page (requires scroll)',
    ]
  }
};

/**
 * Check if a DOM change involves ONLY out-of-scope patterns
 * 
 * This is the critical function for the constitutional scope lock.
 * 
 * @param {string} htmlBefore - HTML before interaction
 * @param {string} htmlAfter - HTML after interaction
 * @returns {Object} { isOutOfScopeOnly: boolean, patterns: string[] }
 */
export function analyzeChangeScope(htmlBefore, htmlAfter) {
  const result = {
    isOutOfScopeOnly: false,
    detectedPatterns: [],
    scopeCategory: null
  };
  
  // Quick check: if no change, not out-of-scope
  if (htmlBefore === htmlAfter) {
    return result;
  }
  
  // Check for out-of-scope patterns
  const outOfScopePatterns = [];
  
  // Pattern 1: style attribute changes (very common)
  const styleChanges = detectStyleAttributeChanges(htmlBefore, htmlAfter);
  if (styleChanges.length > 0) {
    outOfScopePatterns.push({
      category: 'visual',
      pattern: 'style attribute changes',
      details: styleChanges
    });
  }
  
  // Pattern 2: class attribute changes (without feedback keywords)
  const classChanges = detectClassChanges(htmlBefore, htmlAfter);
  if (classChanges.length > 0) {
    outOfScopePatterns.push({
      category: 'visual',
      pattern: 'class changes (non-feedback)',
      details: classChanges
    });
  }
  
  // Pattern 3: aria-hidden changes
  const ariaHiddenChanges = detectAriaHiddenChanges(htmlBefore, htmlAfter);
  if (ariaHiddenChanges.length > 0) {
    outOfScopePatterns.push({
      category: 'accessibility',
      pattern: 'aria-hidden changes',
      details: ariaHiddenChanges
    });
  }
  
  // Pattern 4: other aria-* changes (not in whitelist)
  const otherAriaChanges = detectOtherAriaChanges(htmlBefore, htmlAfter);
  if (otherAriaChanges.length > 0) {
    outOfScopePatterns.push({
      category: 'accessibility',
      pattern: 'aria-* attribute changes',
      details: otherAriaChanges
    });
  }
  
  if (outOfScopePatterns.length > 0) {
    result.isOutOfScopeOnly = true;
    result.detectedPatterns = outOfScopePatterns;
    // Determine primary category (first detected)
    result.scopeCategory = outOfScopePatterns[0].category;
  }
  
  return result;
}

/**
 * Detect style attribute value changes
 */
function detectStyleAttributeChanges(htmlBefore, htmlAfter) {
  const changes = [];
  
  // Look for style="..." patterns and compare values
  const stylePattern = /style="([^"]*)"/g;
  
  const beforeStyles = new Map();
  const afterStyles = new Map();
  
  let match;
  while ((match = stylePattern.exec(htmlBefore)) !== null) {
    const styleValue = match[1];
    beforeStyles.set(styleValue, (beforeStyles.get(styleValue) || 0) + 1);
  }
  
  const afterPattern = /style="([^"]*)"/g;
  while ((match = afterPattern.exec(htmlAfter)) !== null) {
    const styleValue = match[1];
    afterStyles.set(styleValue, (afterStyles.get(styleValue) || 0) + 1);
  }
  
  // Check for display/visibility changes (common feedback mechanism)
  for (const [style, count] of afterStyles) {
    if (!beforeStyles.has(style) || beforeStyles.get(style) !== count) {
      // Common visibility patterns
      if (style.includes('display:') || style.includes('visibility:') || 
          style.includes('opacity:') || style.includes('display :')) {
        changes.push({
          type: 'visibility',
          style: style.substring(0, 50) // Truncate for readability
        });
      }
    }
  }
  
  // Check for styles removed
  for (const [style, count] of beforeStyles) {
    if (!afterStyles.has(style) || afterStyles.get(style) !== count) {
      if (style.includes('display:') || style.includes('visibility:') || 
          style.includes('opacity:')) {
        changes.push({
          type: 'visibility',
          style: style.substring(0, 50)
        });
      }
    }
  }
  
  return changes;
}

/**
 * Detect class attribute changes (excluding feedback keywords)
 */
function detectClassChanges(htmlBefore, htmlAfter) {
  const changes = [];
  
  // Feedback keywords that ARE in scope
  const feedbackKeywords = ['toast', 'error', 'success', 'modal', 'dialog', 'alert'];
  
  const classPattern = /class="([^"]*)"/g;
  
  const beforeClasses = new Set();
  const afterClasses = new Set();
  
  let match;
  while ((match = classPattern.exec(htmlBefore)) !== null) {
    beforeClasses.add(match[1]);
  }
  
  const afterPattern = /class="([^"]*)"/g;
  while ((match = afterPattern.exec(htmlAfter)) !== null) {
    afterClasses.add(match[1]);
  }
  
  // Find classes that changed
  for (const classValue of afterClasses) {
    if (!beforeClasses.has(classValue)) {
      // Check if this class contains feedback keywords (those are in-scope)
      const hasFeedbackKeyword = feedbackKeywords.some(kw => 
        classValue.toLowerCase().includes(kw)
      );
      
      if (!hasFeedbackKeyword) {
        changes.push({
          type: 'class-added',
          class: classValue
        });
      }
    }
  }
  
  for (const classValue of beforeClasses) {
    if (!afterClasses.has(classValue)) {
      const hasFeedbackKeyword = feedbackKeywords.some(kw => 
        classValue.toLowerCase().includes(kw)
      );
      
      if (!hasFeedbackKeyword) {
        changes.push({
          type: 'class-removed',
          class: classValue
        });
      }
    }
  }
  
  return changes;
}

/**
 * Detect aria-hidden attribute changes
 */
function detectAriaHiddenChanges(htmlBefore, htmlAfter) {
  const changes = [];
  
  const ariaHiddenPattern = /aria-hidden="(true|false)"/g;
  
  const beforeValues = [];
  const afterValues = [];
  
  let match;
  while ((match = ariaHiddenPattern.exec(htmlBefore)) !== null) {
    beforeValues.push(match[1]);
  }
  
  const afterPattern = /aria-hidden="(true|false)"/g;
  while ((match = afterPattern.exec(htmlAfter)) !== null) {
    afterValues.push(match[1]);
  }
  
  // Simple heuristic: if count or values differ, there's a change
  if (beforeValues.length !== afterValues.length || 
      beforeValues.join(',') !== afterValues.join(',')) {
    changes.push({
      type: 'aria-hidden',
      before: beforeValues.join(', ') || 'none',
      after: afterValues.join(', ') || 'none'
    });
  }
  
  return changes;
}

/**
 * Detect other aria-* attribute changes (not in whitelist)
 */
function detectOtherAriaChanges(htmlBefore, htmlAfter) {
  const changes = [];
  
  // Attributes NOT in our whitelist (aria-invalid, aria-disabled are whitelisted)
  const outOfScopeAria = [
    'aria-expanded',
    'aria-selected',
    'aria-busy',
    'aria-pressed',
    'aria-checked',
    'aria-current'
  ];
  
  for (const attr of outOfScopeAria) {
    // More robust pattern matching - look for attribute=value patterns
    const pattern = new RegExp(`${attr}="([^"]*)"`, 'g');
    
    const beforeMatches = [];
    const afterMatches = [];
    
    let match;
    while ((match = pattern.exec(htmlBefore)) !== null) {
      beforeMatches.push(match[1]);
    }
    
    // Reset pattern for after HTML
    const afterPattern = new RegExp(`${attr}="([^"]*)"`, 'g');
    while ((match = afterPattern.exec(htmlAfter)) !== null) {
      afterMatches.push(match[1]);
    }
    
    // Check if values changed
    if (beforeMatches.length !== afterMatches.length ||
        beforeMatches.join(',') !== afterMatches.join(',')) {
      changes.push({
        type: attr,
        before: beforeMatches.join(', ') || 'none',
        after: afterMatches.join(', ') || 'none'
      });
    }
  }
  
  return changes;
}

/**
 * Get human-readable explanation for out-of-scope feedback
 */
export function getOutOfScopeExplanation(scopeAnalysis) {
  if (!scopeAnalysis.isOutOfScopeOnly) {
    return null;
  }
  
  const category = scopeAnalysis.scopeCategory;
  const patterns = scopeAnalysis.detectedPatterns;
  
  const explanations = {
    visual: 'This interaction produced visual feedback (style/class changes) that VERAX cannot detect. ' +
            'VERAX tracks text content and semantic attributes, but not CSS-based visibility changes. ' +
            'This is NOT a silent failure - it\'s feedback outside VERAX\'s observable scope.',
    
    accessibility: 'This interaction produced accessibility feedback (aria-* attributes) that VERAX cannot detect. ' +
                   'VERAX tracks aria-invalid and aria-disabled, but not aria-hidden, aria-expanded, or aria-selected. ' +
                   'This is NOT a silent failure - it\'s a11y feedback outside VERAX\'s current scope.',
    
    customData: 'This interaction produced feedback via custom data attributes that VERAX cannot detect. ' +
                'VERAX only tracks data-loading. This is NOT a silent failure - it\'s custom feedback outside VERAX\'s scope.'
  };
  
  return {
    summary: explanations[category] || 'This interaction produced feedback outside VERAX\'s observable scope.',
    category,
    patterns: patterns.map(p => `${p.pattern} (${p.category})`),
    whatToDoNext: 'Verify this interaction manually or use visual regression testing for style-based feedback.'
  };
}

/**
 * Get scope documentation for users
 */
export function getScopeDocumentation() {
  return {
    title: 'VERAX Feedback Detection Scope',
    version: '1.0.0',
    philosophy: 'VERAX is conservative: it only claims to detect feedback it can reliably detect. ' +
                'Out-of-scope feedback is explicitly classified, not falsely reported as "silent failure".',
    
    inScope: {
      summary: 'VERAX guarantees to detect these feedback patterns with zero false negatives',
      categories: Object.keys(IN_SCOPE_FEEDBACK),
      details: IN_SCOPE_FEEDBACK
    },
    
    outOfScope: {
      summary: 'VERAX intentionally does NOT detect these feedback patterns',
      categories: Object.keys(OUT_OF_SCOPE_FEEDBACK),
      details: OUT_OF_SCOPE_FEEDBACK,
      rationale: 'These patterns require CSS parsing, visual diffing, or timing observation that VERAX does not implement. ' +
                 'False negatives are worse than clear scope boundaries.'
    }
  };
}
