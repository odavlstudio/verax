/**
 * HUMAN NAVIGATOR
 * 
 * Simulates real human navigation patterns:
 * - CTA-first discovery (primary action buttons)
 * - Smart waits (network idle, DOM stable, content visible)
 * - Fallback strategies (HIGH -> MEDIUM -> fail)
 * - Mobile viewport support
 * 
 * Stage 3: Human Reality Coverage
 */

const VIEWPORT_PRESETS = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 375, height: 667 }, // iPhone SE
  tablet: { width: 768, height: 1024 }
};

const CTA_INTENT_KEYWORDS = [
  'buy', 'purchase', 'order', 'checkout', 'cart',
  'subscribe', 'sign up', 'signup', 'register', 'join',
  'start', 'begin', 'get started', 'try',
  'contact', 'demo', 'learn more', 'download'
];

const SELECTOR_STRATEGIES = {
  HIGH: ['data-testid', 'data-guardian', 'data-qa', 'data-test'],
  MEDIUM: ['role', 'aria-label', 'aria-labelledby', 'id'],
  LOW: ['class', 'nth-child', 'text']
};

/**
 * Discover primary CTAs on a page using human-like heuristics
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array>} - List of CTA candidates with metadata
 */
async function discoverPrimaryCTAs(page) {
  const ctaCandidates = await page.evaluate((intentKeywords) => {
    const candidates = [];
    
    // Find all interactive elements
    const elements = document.querySelectorAll('button, a[href], [role="button"]');
    
    elements.forEach((el, index) => {
      // Skip hidden elements
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (window.getComputedStyle(el).display === 'none') return;
      if (window.getComputedStyle(el).visibility === 'hidden') return;
      
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      
      // Check for intent keywords
      const matchesIntent = intentKeywords.some(keyword => 
        text.includes(keyword) || ariaLabel.includes(keyword)
      );
      
      // Check for prominent positioning (hero section, above fold)
      const isAboveFold = rect.top < window.innerHeight;
      const isLarge = rect.width >= 100 && rect.height >= 30;
      
      // Check for visual prominence
      const styles = window.getComputedStyle(el);
      const hasPrimaryColor = styles.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                              styles.backgroundColor !== 'transparent';
      
      // Assign confidence score
      let confidence = 0;
      if (matchesIntent) confidence += 50;
      if (isAboveFold) confidence += 20;
      if (isLarge) confidence += 15;
      if (hasPrimaryColor) confidence += 10;
      if (index < 3) confidence += 5; // First few elements get bonus
      
      if (confidence > 30) {
        candidates.push({
          text: text.substring(0, 100),
          ariaLabel,
          role,
          selector: generateSelector(el),
          position: { top: rect.top, left: rect.left },
          size: { width: rect.width, height: rect.height },
          confidence,
          isAboveFold,
          matchesIntent
        });
      }
    });
    
    function generateSelector(el) {
      // Try data attributes first
      if (el.dataset.testid) return `[data-testid="${el.dataset.testid}"]`;
      if (el.dataset.guardian) return `[data-guardian="${el.dataset.guardian}"]`;
      if (el.dataset.qa) return `[data-qa="${el.dataset.qa}"]`;
      
      // Try ID
      if (el.id) return `#${el.id}`;
      
      // Try role + aria-label
      const role = el.getAttribute('role');
      const ariaLabel = el.getAttribute('aria-label');
      if (role && ariaLabel) return `[role="${role}"][aria-label="${ariaLabel}"]`;
      if (ariaLabel) return `[aria-label="${ariaLabel}"]`;
      
      // Fallback to text content
      const text = (el.innerText || el.textContent || '').trim();
      if (text && text.length < 50) {
        return `text="${text}"`;
      }
      
      // Last resort: tag + class
      const classes = el.className ? `.${el.className.split(' ')[0]}` : '';
      return `${el.tagName.toLowerCase()}${classes}`;
    }
    
    return candidates;
  }, CTA_INTENT_KEYWORDS);
  
  // Sort by confidence (highest first)
  ctaCandidates.sort((a, b) => b.confidence - a.confidence);
  
  return ctaCandidates;
}

/**
 * Choose the primary CTA deterministically
 * @param {Array} ctaCandidates - List of CTA candidates
 * @returns {Object|null} - Selected CTA or null
 */
function choosePrimaryCTA(ctaCandidates) {
  if (ctaCandidates.length === 0) return null;
  
  // Tie-breaking rules:
  // 1. Highest confidence
  // 2. If tied, prefer above fold
  // 3. If tied, prefer larger size
  // 4. If tied, prefer leftmost position
  
  const sorted = [...ctaCandidates].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.isAboveFold !== a.isAboveFold) return b.isAboveFold ? 1 : -1;
    const sizeA = a.size.width * a.size.height;
    const sizeB = b.size.width * b.size.height;
    if (sizeB !== sizeA) return sizeB - sizeA;
    return a.position.left - b.position.left;
  });
  
  return sorted[0];
}

/**
 * Try selector with fallback strategy
 * @param {Page} page - Playwright page
 * @param {String} primarySelector - Primary selector to try
 * @param {Object} options - Options with fallbackSelectors
 * @returns {Promise<Object>} - Result with selector used and confidence
 */
async function trySelectorWithFallback(page, primarySelector, options = {}) {
  const fallbackSelectors = options.fallbackSelectors || [];
  const timeout = options.timeout || 5000;
  
  const attempts = [
    { selector: primarySelector, confidence: 'HIGH', strategy: 'primary' },
    ...fallbackSelectors.map(s => ({ 
      selector: s, 
      confidence: inferConfidenceFromSelector(s), 
      strategy: 'fallback' 
    }))
  ];
  
  for (const attempt of attempts) {
    try {
      const element = await page.locator(attempt.selector).first();
      await element.waitFor({ state: 'visible', timeout: timeout });
      
      return {
        success: true,
        element,
        selectorUsed: attempt.selector,
        confidence: attempt.confidence,
        strategy: attempt.strategy,
        attemptCount: attempts.indexOf(attempt) + 1
      };
    } catch (err) {
      // Continue to next fallback
      continue;
    }
  }
  
  // All selectors failed
  return {
    success: false,
    selectorUsed: null,
    confidence: null,
    strategy: 'failed',
    attemptCount: attempts.length,
    error: 'SELECTOR_MISSING',
    attempts: attempts.map(a => a.selector)
  };
}

/**
 * Infer selector confidence from selector string
 * @param {String} selector - CSS selector
 * @returns {String} - HIGH, MEDIUM, or LOW
 */
function inferConfidenceFromSelector(selector) {
  if (!selector) return 'LOW';
  
  const sel = selector.toLowerCase();
  
  // HIGH confidence
  if (sel.includes('data-testid') || 
      sel.includes('data-guardian') || 
      sel.includes('data-qa')) {
    return 'HIGH';
  }
  
  // MEDIUM confidence
  if (sel.includes('role=') || 
      sel.includes('aria-label') || 
      sel.match(/^#[a-z]/)) { // ID selector
    return 'MEDIUM';
  }
  
  // LOW confidence
  return 'LOW';
}

/**
 * Click element and wait for navigation/state change with smart waits
 * @param {Page} page - Playwright page
 * @param {Locator} element - Element to click
 * @param {Object} options - Wait options
 * @returns {Promise<Object>} - Result with outcome and evidence
 */
async function clickAndWaitSmart(page, element, options = {}) {
  const maxWait = options.maxWait || 10000;
  const minWait = options.minWait || 500;
  
  const beforeUrl = page.url();
  const beforeTitle = await page.title();
  
  try {
    // Click the element
    await element.click({ timeout: 5000 });
    
    // Wait minimum time for any effects
    await page.waitForTimeout(minWait);
    
    // Try smart waits (any of these satisfies the condition)
    const waitPromises = [
      // Wait for network idle
      page.waitForLoadState('networkidle', { timeout: maxWait }).catch(() => null),
      
      // Wait for DOM content loaded
      page.waitForLoadState('domcontentloaded', { timeout: maxWait }).catch(() => null),
      
      // Wait for URL change
      page.waitForURL(url => url !== beforeUrl, { timeout: maxWait }).catch(() => null),
      
      // Wait for new content (heading, section, modal)
      page.locator('h1, h2, [role="dialog"], .modal, .success, [data-testid*="success"]')
        .first()
        .waitFor({ state: 'visible', timeout: maxWait })
        .catch(() => null)
    ];
    
    await Promise.race(waitPromises);
    
    const afterUrl = page.url();
    const afterTitle = await page.title();
    
    // Determine outcome
    const urlChanged = afterUrl !== beforeUrl;
    const titleChanged = afterTitle !== beforeTitle;
    const hasNewContent = await page.locator('h1, h2, [role="dialog"]').count() > 0;
    
    return {
      success: true,
      outcome: urlChanged || titleChanged || hasNewContent ? 'SUCCESS' : 'NO_CHANGE',
      evidence: {
        urlChanged,
        titleChanged,
        beforeUrl,
        afterUrl,
        hasNewContent
      }
    };
  } catch (err) {
    return {
      success: false,
      outcome: 'FAILURE',
      error: err.message,
      evidence: {
        urlChanged: false,
        titleChanged: false,
        beforeUrl,
        afterUrl: page.url()
      }
    };
  }
}

/**
 * Execute human-like navigation path
 * @param {Page} page - Playwright page
 * @param {Object} options - Options with viewport, attempts
 * @returns {Promise<Object>} - Human path result
 */
async function executeHumanPath(page, options = {}) {
  const viewport = options.viewport || 'desktop';
  
  // Set viewport
  const viewportSize = VIEWPORT_PRESETS[viewport] || VIEWPORT_PRESETS.desktop;
  await page.setViewportSize(viewportSize);
  
  const path = {
    viewport,
    viewportSize,
    steps: [],
    outcome: 'UNKNOWN',
    startUrl: page.url(),
    endUrl: null,
    duration: 0
  };
  
  const startTime = Date.now();
  
  try {
    // Step 1: Discover primary CTAs
    const ctaCandidates = await discoverPrimaryCTAs(page);
    
    path.steps.push({
      step: 1,
      action: 'discover_cta',
      candidatesFound: ctaCandidates.length,
      topCandidate: ctaCandidates[0] || null
    });
    
    if (ctaCandidates.length === 0) {
      path.outcome = 'NO_CTA_FOUND';
      path.endUrl = page.url();
      path.duration = Date.now() - startTime;
      return path;
    }
    
    // Step 2: Choose primary CTA
    const primaryCTA = choosePrimaryCTA(ctaCandidates);
    
    path.steps.push({
      step: 2,
      action: 'choose_cta',
      selected: primaryCTA.text,
      selector: primaryCTA.selector,
      confidence: primaryCTA.confidence
    });
    
    // Step 3: Try clicking CTA with fallback
    const clickResult = await trySelectorWithFallback(page, primaryCTA.selector, {
      fallbackSelectors: generateFallbackSelectors(primaryCTA),
      timeout: 5000
    });
    
    if (!clickResult.success) {
      path.outcome = 'CTA_NOT_CLICKABLE';
      path.steps.push({
        step: 3,
        action: 'click_cta',
        result: 'FAILED',
        error: clickResult.error,
        attemptsCount: clickResult.attemptCount
      });
      path.endUrl = page.url();
      path.duration = Date.now() - startTime;
      return path;
    }
    
    // Step 4: Click and wait for navigation
    const navResult = await clickAndWaitSmart(page, clickResult.element, {
      maxWait: 10000,
      minWait: 500
    });
    
    path.steps.push({
      step: 3,
      action: 'click_cta',
      result: navResult.outcome,
      selectorUsed: clickResult.selectorUsed,
      confidence: clickResult.confidence,
      evidence: navResult.evidence
    });
    
    // Step 5: Check for confirmation/success elements
    const successPatterns = [
      '[data-testid*="success"]',
      '[data-testid*="confirm"]',
      '.success',
      '.confirmation',
      '[role="alert"]',
      'text=/thank you|success|confirmed|complete/i'
    ];
    
    let foundSuccess = false;
    for (const pattern of successPatterns) {
      try {
        const count = await page.locator(pattern).count();
        if (count > 0) {
          foundSuccess = true;
          path.steps.push({
            step: 4,
            action: 'verify_success',
            result: 'SUCCESS',
            pattern
          });
          break;
        }
      } catch (err) {
        // Continue checking
      }
    }
    
    if (!foundSuccess) {
      path.steps.push({
        step: 4,
        action: 'verify_success',
        result: 'NOT_FOUND'
      });
    }
    
    // Determine final outcome
    if (navResult.outcome === 'SUCCESS' && foundSuccess) {
      path.outcome = 'SUCCESS';
    } else if (navResult.outcome === 'SUCCESS') {
      path.outcome = 'NAVIGATION_SUCCESS';
    } else if (navResult.outcome === 'NO_CHANGE') {
      path.outcome = 'NO_CHANGE';
    } else {
      path.outcome = 'FAILURE';
    }
    
  } catch (err) {
    path.outcome = 'ERROR';
    path.error = err.message;
    path.steps.push({
      action: 'error',
      error: err.message
    });
  }
  
  path.endUrl = page.url();
  path.duration = Date.now() - startTime;
  
  return path;
}

/**
 * Generate fallback selectors for a CTA
 * @param {Object} cta - CTA object with metadata
 * @returns {Array<String>} - List of fallback selectors
 */
function generateFallbackSelectors(cta) {
  const fallbacks = [];
  
  // Try role + aria-label
  if (cta.role && cta.ariaLabel) {
    fallbacks.push(`[role="${cta.role}"][aria-label="${cta.ariaLabel}"]`);
  }
  
  // Try aria-label alone
  if (cta.ariaLabel) {
    fallbacks.push(`[aria-label="${cta.ariaLabel}"]`);
  }
  
  // Try text content
  if (cta.text && cta.text.length < 50) {
    fallbacks.push(`text="${cta.text}"`);
  }
  
  // Try role + text
  if (cta.role && cta.text && cta.text.length < 50) {
    fallbacks.push(`${cta.role}:has-text("${cta.text}")`);
  }
  
  return fallbacks;
}

/**
 * Execute human path with both desktop and mobile
 * @param {Page} page - Playwright page
 * @param {String} url - URL to navigate to
 * @returns {Promise<Object>} - Results for both viewports
 */
async function executeMultiViewportPath(page, url) {
  const results = {
    url,
    desktop: null,
    mobile: null,
    verdict: 'UNKNOWN'
  };
  
  // Desktop path
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  results.desktop = await executeHumanPath(page, { viewport: 'desktop' });
  
  // Mobile path
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  results.mobile = await executeHumanPath(page, { viewport: 'mobile' });
  
  // Determine overall verdict
  // Only full SUCCESS (with confirmation) should be considered success
  // NAVIGATION_SUCCESS without confirmation is considered FRICTION
  const desktopSuccess = results.desktop.outcome === 'SUCCESS';
  const mobileSuccess = results.mobile.outcome === 'SUCCESS';
  
  const desktopPartial = results.desktop.outcome === 'NAVIGATION_SUCCESS';
  const mobilePartial = results.mobile.outcome === 'NAVIGATION_SUCCESS';
  
  if (desktopSuccess && mobileSuccess) {
    results.verdict = 'READY';
  } else if (desktopSuccess || mobileSuccess || desktopPartial || mobilePartial) {
    results.verdict = 'FRICTION';
  } else {
    results.verdict = 'DO_NOT_LAUNCH';
  }
  
  return results;
}

module.exports = {
  discoverPrimaryCTAs,
  choosePrimaryCTA,
  trySelectorWithFallback,
  inferConfidenceFromSelector,
  clickAndWaitSmart,
  executeHumanPath,
  executeMultiViewportPath,
  generateFallbackSelectors,
  VIEWPORT_PRESETS,
  CTA_INTENT_KEYWORDS,
  SELECTOR_STRATEGIES
};
