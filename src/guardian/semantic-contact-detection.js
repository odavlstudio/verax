/**
 * Semantic Contact Detection
 * 
 * Deterministic, multilingual detection of contact links and elements.
 * Returns ranked candidates with source, confidence, and matched tokens.
 */

const { getTokensForTarget, normalizeText, getMatchedToken } = require('./semantic-targets');

/**
 * Confidence levels
 */
const CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * Detection sources
 */
const DETECTION_SOURCE = {
  DATA_GUARDIAN: 'data-guardian',
  ARIA: 'aria',
  HREF: 'href',
  TEXT: 'text',
  NAV_FOOTER: 'nav/footer',
  HEURISTIC: 'heuristic'
};

/**
 * Detect contact candidates on page
 * 
 * @param {Page} page - Playwright page object
 * @param {string} baseUrl - Base URL for relative link resolution
 * @returns {Promise<Array>} Array of contact candidates, ranked by confidence
 */
async function detectContactCandidates(page, baseUrl = '') {
  const candidates = [];

  try {
    const pageData = await page.evaluate(async () => {
      const results = [];

      // Find all clickable/linkable elements
      const elements = document.querySelectorAll('a, button, [role="link"], [role="button"], [data-guardian], .nav a, footer a');

      for (const el of elements) {
        const data = {
          tagName: el.tagName.toLowerCase(),
          text: el.textContent?.trim() || '',
          href: el.href || el.getAttribute('href') || '',
          dataGuardian: el.getAttribute('data-guardian') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          title: el.getAttribute('title') || '',
          className: el.className,
          isInNav: !!el.closest('nav, [role="navigation"]'),
          isInFooter: !!el.closest('footer, [role="contentinfo"]')
        };

        results.push(data);
      }

      return results;
    });

    // Process each element
    for (const element of pageData) {
      const contactCandidates = evaluateElement(element, baseUrl);
      candidates.push(...contactCandidates);
    }

    // Sort by confidence (high > medium > low) and then by detection order
    candidates.sort((a, b) => {
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    });

    // Remove duplicates (same href or same text)
    const seen = new Set();
    const deduplicated = [];

    for (const candidate of candidates) {
      const key = `${candidate.matchedText}:${candidate.href}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(candidate);
      }
    }

    return deduplicated;
  } catch (error) {
    console.warn(`Failed to detect contact candidates: ${error.message}`);
    return candidates;
  }
}

/**
 * Evaluate a single element for contact relevance
 */
function evaluateElement(element, baseUrl = '') {
  const candidates = [];
  const contactTokens = getTokensForTarget('contact');

  // Rule A: data-guardian attribute (highest priority)
  if (element.dataGuardian) {
    const normalized = normalizeText(element.dataGuardian);
    if (normalized.includes('contact')) {
      candidates.push({
        selector: buildSelector(element),
        matchedText: element.text || element.dataGuardian,
        matchedToken: 'contact',
        source: DETECTION_SOURCE.DATA_GUARDIAN,
        confidence: CONFIDENCE.HIGH,
        href: element.href,
        ariaLabel: element.ariaLabel
      });
      return candidates;
    }
  }

  // Rule B: href-based detection
  if (element.href) {
    const normalizedHref = normalizeText(element.href);
    const matchedToken = getMatchedToken(normalizedHref, contactTokens);

    if (matchedToken) {
      candidates.push({
        selector: buildSelector(element),
        matchedText: element.text || element.href,
        matchedToken: matchedToken,
        source: DETECTION_SOURCE.HREF,
        confidence: CONFIDENCE.HIGH,
        href: element.href,
        ariaLabel: element.ariaLabel
      });
    }
  }

  // Rule C: visible text-based detection
  if (element.text) {
    const normalizedText = normalizeText(element.text);
    const matchedToken = getMatchedToken(normalizedText, contactTokens);

    if (matchedToken) {
      // Higher confidence if in nav or footer
      let confidence = CONFIDENCE.MEDIUM;
      let source = DETECTION_SOURCE.TEXT;

      if (element.isInNav || element.isInFooter) {
        confidence = CONFIDENCE.HIGH;
        source = element.isInNav ? DETECTION_SOURCE.NAV_FOOTER : DETECTION_SOURCE.NAV_FOOTER;
      }

      candidates.push({
        selector: buildSelector(element),
        matchedText: element.text,
        matchedToken: matchedToken,
        source: source,
        confidence: confidence,
        href: element.href,
        ariaLabel: element.ariaLabel
      });
    }
  }

  // Rule D: aria-label or title attribute
  if (element.ariaLabel || element.title) {
    const textToCheck = element.ariaLabel || element.title;
    const normalizedText = normalizeText(textToCheck);
    const matchedToken = getMatchedToken(normalizedText, contactTokens);

    if (matchedToken) {
      candidates.push({
        selector: buildSelector(element),
        matchedText: textToCheck,
        matchedToken: matchedToken,
        source: DETECTION_SOURCE.ARIA,
        confidence: CONFIDENCE.MEDIUM,
        href: element.href,
        ariaLabel: element.ariaLabel
      });
    }
  }

  return candidates;
}

/**
 * Build a CSS selector for an element
 */
function buildSelector(element) {
  // Prefer data-guardian if available
  if (element.dataGuardian) {
    return `[data-guardian="${element.dataGuardian}"]`;
  }

  // For links/buttons, use href or text
  if (element.tagName === 'a' && element.href) {
    // Use href in selector
    return `a[href*="${normalizeHrefForSelector(element.href)}"]`;
  }

  if (element.ariaLabel) {
    return `${element.tagName}[aria-label*="${element.ariaLabel}"]`;
  }

  // Fallback
  return `${element.tagName}`;
}

/**
 * Normalize href for use in CSS selector
 */
function normalizeHrefForSelector(href) {
  // Extract path portion
  try {
    const url = new URL(href, 'http://localhost');
    return url.pathname.split('/').filter(p => p)[0] || '';
  } catch {
    // If URL parsing fails, extract first path component
    return href.split('/')[1] || '';
  }
}

/**
 * Format detection result for human-readable output
 */
function formatDetectionResult(candidate, language = 'unknown') {
  const languageStr = language !== 'unknown' ? `lang=${language}` : 'lang=unknown';
  const parts = [
    `Contact detected`,
    `(${languageStr}`,
    `source=${candidate.source}`,
    `token=${candidate.matchedToken}`,
    `confidence=${candidate.confidence})`
  ];

  return parts.join(', ');
}

/**
 * Get hint message if contact not found
 */
function getNoContactFoundHint() {
  return 'No contact found. Consider adding a stable marker like data-guardian="contact" or ensure contact link text/href is recognizable.';
}

module.exports = {
  detectContactCandidates,
  formatDetectionResult,
  getNoContactFoundHint,
  CONFIDENCE,
  DETECTION_SOURCE
};
