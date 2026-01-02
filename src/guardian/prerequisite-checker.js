/**
 * Phase 7.4: Prerequisite Checker
 * 
 * Validates hard prerequisites before executing attempts.
 * Enables early skip of impossible attempts to save time.
 */

/**
 * Define prerequisites for each attempt type
 * Returns deterministic checks that can fail fast
 */
const ATTEMPT_PREREQUISITES = {
  checkout: {
    description: 'Checkout requires accessible checkout page or cart',
    checks: [
      {
        type: 'elementExists',
        selector: 'a[href*="checkout"], a[href*="cart"], [data-guardian="checkout-link"], [data-guardian="cart-link"]',
        reason: 'No checkout/cart link found on page'
      }
    ]
  },
  login: {
    description: 'Login requires accessible login page',
    checks: [
      {
        type: 'elementExists',
        selector: 'a[href*="login"], a[href*="signin"], a:has-text("Login"), a:has-text("Sign in"), [data-guardian="account-login-link"], input[type="email"][id*="login"], input[type="email"][name*="login"]',
        reason: 'No login link or login form found'
      }
    ]
  },
  newsletter_signup: {
    description: 'Newsletter requires email input',
    checks: [
      {
        type: 'elementExists',
        selector: 'input[type="email"], input[placeholder*="email" i], input[name*="email"], [data-guardian="email-input"]',
        reason: 'No email input found for newsletter'
      }
    ]
  },
  signup: {
    description: 'Signup requires accessible signup page',
    checks: [
      {
        type: 'elementExists',
        selector: 'a[href*="signup"], a[href*="register"], a:has-text("Sign up"), a:has-text("Register"), [data-guardian="signup-link"]',
        reason: 'No signup/register link found'
      }
    ]
  }
};

/**
 * Check if an attempt's prerequisites are met
 * @param {Page} page - Playwright page
 * @param {string} attemptId - Attempt identifier
 * @param {number} timeout - Max time to check (short, e.g., 2000ms)
 * @returns {Promise<{canProceed: boolean, reason: string|null}>}
 */
async function checkPrerequisites(page, attemptId, timeout = 2000) {
  const prereqs = ATTEMPT_PREREQUISITES[attemptId];
  
  // No prerequisites defined = can proceed
  if (!prereqs || !prereqs.checks || prereqs.checks.length === 0) {
    return { canProceed: true, reason: null };
  }

  // Check each prerequisite
  for (const check of prereqs.checks) {
    if (check.type === 'elementExists') {
      try {
        // Quick check with short timeout
        const exists = await page.locator(check.selector).first().isVisible({ timeout });
        if (!exists) {
          return { canProceed: false, reason: check.reason };
        }
      } catch (_err) {
        // Element not found = prerequisite failed
        return { canProceed: false, reason: check.reason };
      }
    }
  }

  return { canProceed: true, reason: null };
}

/**
 * Get list of attempt IDs that have prerequisites defined
 * @returns {string[]}
 */
function getAttemptsWithPrerequisites() {
  return Object.keys(ATTEMPT_PREREQUISITES);
}

module.exports = {
  checkPrerequisites,
  getAttemptsWithPrerequisites,
  ATTEMPT_PREREQUISITES
};
