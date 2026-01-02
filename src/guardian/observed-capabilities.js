/**
 * Observed Capabilities Extractor
 * Phase 11: Extract what's actually observable on the site
 * 
 * CORE PRINCIPLE: VISIBLE = MUST WORK, NOT VISIBLE = NOT APPLICABLE
 * 
 * This module maps observable UI elements to capabilities.
 * If a capability is not observed, any attempt targeting it is NOT_APPLICABLE.
 * NOT_APPLICABLE results do NOT count as failures or friction.
 */

/**
 * Capability mappings: what to look for on the page
 */
const CAPABILITY_MAPPINGS = {
  // Login/Authentication capabilities
  login: {
    selectors: [
      'a[href*="login"]',
      'a[href*="signin"]',
      'a[href*="auth"]',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'button:has-text("Sign In")',
      'a:has-text("Login")',
      'a:has-text("Sign in")',
      'a:has-text("Sign In")',
      '[data-testid*="login"]',
      '[data-guardian*="login"]'
    ],
    textPatterns: ['login', 'sign in', 'signin', 'sign-in'],
    attemptIds: ['login', 'login_flow']
  },

  // Signup/Registration capabilities
  signup: {
    selectors: [
      'a[href*="signup"]',
      'a[href*="register"]',
      'a[href*="join"]',
      'a[href*="onboarding"]',
      'button:has-text("Sign up")',
      'button:has-text("Sign Up")',
      'button:has-text("Register")',
      'button:has-text("Get started")',
      'a:has-text("Sign up")',
      'a:has-text("Sign Up")',
      'a:has-text("Register")',
      '[data-testid*="signup"]',
      '[data-guardian*="signup"]'
    ],
    textPatterns: ['signup', 'sign up', 'register', 'get started', 'join'],
    attemptIds: ['signup', 'signup_flow']
  },

  // Checkout/Payment capabilities
  checkout: {
    selectors: [
      'a[href*="checkout"]',
      'a[href*="cart"]',
      'a[href*="cart"]',
      'button:has-text("Checkout")',
      'button:has-text("Buy")',
      'button:has-text("Purchase")',
      'button:has-text("Add to cart")',
      'a:has-text("Checkout")',
      '[data-testid*="checkout"]',
      '[data-guardian*="checkout"]'
    ],
    textPatterns: ['checkout', 'add to cart', 'buy', 'purchase', 'add to cart'],
    attemptIds: ['checkout', 'checkout_flow']
  },

  // Contact form capability
  contact_form: {
    selectors: [
      'a[href*="contact"]',
      'form[action*="contact"]',
      'input[name*="email"]',
      'textarea[name*="message"]',
      'button:has-text("Contact")',
      'a:has-text("Contact")',
      '[data-guardian*="contact"]',
      '[data-testid*="contact"]'
    ],
    textPatterns: ['contact', 'contact us', 'get in touch'],
    attemptIds: ['contact_form', 'contact_discovery_v2']
  },

  // Newsletter signup capability
  newsletter_signup: {
    selectors: [
      'a[href*="newsletter"]',
      'input[name*="newsletter"]',
      'input[placeholder*="email"]',
      'button:has-text("Subscribe")',
      'button:has-text("Sign up")',
      'a:has-text("Subscribe")',
      '[data-guardian*="newsletter"]',
      '[data-testid*="newsletter"]'
    ],
    textPatterns: ['newsletter', 'subscribe', 'email'],
    attemptIds: ['newsletter_signup']
  },

  // Language switch capability
  language_switch: {
    selectors: [
      'button:has-text("Language")',
      'button:has-text("Lang")',
      '[data-guardian*="lang"]',
      '[data-testid*="lang"]',
      'a[href*="lang"]',
      'a[hreflang]'
    ],
    textPatterns: ['language', 'lang', 'deutsch', 'english', 'français'],
    attemptIds: ['language_switch']
  },

  // Primary CTAs (always present on marketing sites)
  primary_ctas: {
    selectors: [
      'button',
      'a[class*="button"]',
      'a[class*="cta"]',
      '[role="button"]'
    ],
    minCount: 1,
    attemptIds: ['primary_ctas']
  }
};

/**
 * Extract observed capabilities from site intelligence data
 * 
 * @param {Object} siteIntelligence - Result from analyzeSite()
 * @returns {Object} Observed capabilities map
 */
function extractObservedCapabilities(siteIntelligence) {
  const observed = {
    timestamp: new Date().toISOString(),
    capabilities: {},
    mapping: {} // Maps capability name to evidence
  };

  if (!siteIntelligence || !siteIntelligence.capabilities) {
    // Conservative: if no intelligence, assume ALL capabilities present
    // This prevents false NOT_APPLICABLE when analysis fails
    return {
      ...observed,
      capabilities: {
        login: true,
        signup: true,
        checkout: true,
        contact_form: true,
        newsletter_signup: true,
        language_switch: true,
        primary_ctas: true
      }
    };
  }

  // Map site-intelligence capabilities to observed capabilities
  const caps = siteIntelligence.capabilities || {};

  observed.capabilities.login = (
    caps.supports_login?.supported === true ||
    caps[Object.keys(CAPABILITY_MAPPINGS).find(k => k === 'login')]?.supported === true
  );
  observed.mapping.login = caps.supports_login || {};

  observed.capabilities.signup = (
    caps.supports_signup?.supported === true ||
    caps[Object.keys(CAPABILITY_MAPPINGS).find(k => k === 'signup')]?.supported === true
  );
  observed.mapping.signup = caps.supports_signup || {};

  observed.capabilities.checkout = (
    caps.supports_checkout?.supported === true ||
    caps[Object.keys(CAPABILITY_MAPPINGS).find(k => k === 'checkout')]?.supported === true
  );
  observed.mapping.checkout = caps.supports_checkout || {};

  observed.capabilities.contact_form = (
    caps.supports_contact?.supported === true ||
    caps[Object.keys(CAPABILITY_MAPPINGS).find(k => k === 'contact_form')]?.supported === true
  );
  observed.mapping.contact_form = caps.supports_contact || {};

  observed.capabilities.newsletter_signup = (
    caps.supports_newsletter?.supported === true ||
    caps[Object.keys(CAPABILITY_MAPPINGS).find(k => k === 'newsletter_signup')]?.supported === true
  );
  observed.mapping.newsletter_signup = caps.supports_newsletter || {};

  observed.capabilities.language_switch = (
    caps.supports_language_switch?.supported === true ||
    caps[Object.keys(CAPABILITY_MAPPINGS).find(k => k === 'language_switch')]?.supported === true
  );
  observed.mapping.language_switch = caps.supports_language_switch || {};

  // Primary CTAs: assume true unless we have explicit evidence of none
  observed.capabilities.primary_ctas = (
    caps.supports_primary_cta?.supported !== false
  );
  observed.mapping.primary_ctas = caps.supports_primary_cta || { supported: true };

  // PHASE 11: Internal/admin surfaces detection
  // Requires BOTH URL pattern AND UI label evidence to avoid false positives
  observed.capabilities.internal_admin = detectInternalSurfaces(siteIntelligence);
  observed.mapping.internal_admin = { detected: observed.capabilities.internal_admin };

  return observed;
}

/**
 * Detect internal/admin surfaces with strong evidence requirements
 * PHASE 11: Internal surfaces must NOT penalize public readiness
 * 
 * Detection requires BOTH:
 * - URL pattern (/admin, /wp-admin, /internal, /dashboard, /staff)
 * - UI label evidence ("Admin", "Staff", "Internal", "Management")
 * 
 * @param {Object} siteIntelligence - Site intelligence data
 * @returns {boolean} - true if internal admin surface detected
 */
function detectInternalSurfaces(siteIntelligence) {
  if (!siteIntelligence || !siteIntelligence.crawl || !siteIntelligence.crawl.discovered) {
    return false;
  }

  const discovered = siteIntelligence.crawl.discovered;
  const internalUrlPatterns = ['/admin', '/wp-admin', '/internal', '/dashboard', '/staff', '/management'];
  const internalLabelPatterns = ['admin', 'staff', 'internal', 'management', 'dashboard'];

  // Check each discovered URL (can be string or object with url + metadata)
  for (const urlEntry of discovered) {
    // Handle both string URLs and object format
    let url = '';
    let text = '';
    
    if (typeof urlEntry === 'string') {
      url = urlEntry;
    } else if (urlEntry && typeof urlEntry === 'object') {
      url = urlEntry.url || urlEntry.href || '';
      text = urlEntry.text || urlEntry.label || urlEntry.linkText || '';
    }
    
    // Check if URL matches internal pattern
    const hasInternalUrl = internalUrlPatterns.some(pattern => url.toLowerCase().includes(pattern));
    
    // Check if text/label matches internal pattern (case-insensitive)
    const hasInternalLabel = text && internalLabelPatterns.some(pattern => 
      text.toLowerCase().includes(pattern)
    );
    
    // Require BOTH URL and label evidence to minimize false positives
    if (hasInternalUrl && hasInternalLabel) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a capability is observed
 * 
 * @param {Object} observedCapabilities - Result from extractObservedCapabilities()
 * @param {string} capabilityName - Name of capability (e.g., 'login', 'signup')
 * @returns {boolean} True if capability is observed
 */
function isCapabilityObserved(observedCapabilities, capabilityName) {
  if (!observedCapabilities || !observedCapabilities.capabilities) {
    return false;
  }
  return observedCapabilities.capabilities[capabilityName] === true;
}

/**
 * Get applicable attempts based on observed capabilities
 * Maps attempt IDs to the capabilities they require
 * 
 * @param {Array} attemptIds - List of attempt IDs to filter
 * @param {Object} observedCapabilities - Result from extractObservedCapabilities()
 * @returns {Object} { applicable: Array, notApplicable: Array }
 */
function filterAttemptsByObservedCapabilities(attemptIds, observedCapabilities) {
  const applicable = [];
  const notApplicable = [];

  if (!attemptIds || !Array.isArray(attemptIds)) {
    return { applicable: [], notApplicable: [] };
  }

  for (const attemptId of attemptIds) {
    // Find which capability this attempt requires
    let requiredCapability = null;
    for (const [capName, mapping] of Object.entries(CAPABILITY_MAPPINGS)) {
      if (mapping.attemptIds.includes(attemptId)) {
        requiredCapability = capName;
        break;
      }
    }

    // If no capability mapping, always run (universal attempt)
    if (!requiredCapability) {
      applicable.push(attemptId);
      continue;
    }

    // Check if capability is observed
    if (isCapabilityObserved(observedCapabilities, requiredCapability)) {
      applicable.push(attemptId);
    } else {
      notApplicable.push({
        attemptId,
        reason: `Capability not observed: ${requiredCapability}`,
        capabilityRequired: requiredCapability
      });
    }
  }

  return { applicable, notApplicable };
}

/**
 * Get applicable flows based on observed capabilities
 * 
 * @param {Array} flowIds - List of flow IDs to filter
 * @param {Object} observedCapabilities - Result from extractObservedCapabilities()
 * @returns {Object} { applicable: Array, notApplicable: Array }
 */
function filterFlowsByObservedCapabilities(flowIds, observedCapabilities) {
  const applicable = [];
  const notApplicable = [];

  if (!flowIds || !Array.isArray(flowIds)) {
    return { applicable: [], notApplicable: [] };
  }

  const flowCapabilityMap = {
    'login_flow': 'login',
    'signup_flow': 'signup',
    'checkout_flow': 'checkout',
    'contact_flow': 'contact_form'
  };

  for (const flowId of flowIds) {
    const requiredCapability = flowCapabilityMap[flowId];

    // If no mapping, always run
    if (!requiredCapability) {
      applicable.push(flowId);
      continue;
    }

    // Check if capability is observed
    if (isCapabilityObserved(observedCapabilities, requiredCapability)) {
      applicable.push(flowId);
    } else {
      notApplicable.push({
        flowId,
        reason: `Capability not observed: ${requiredCapability}`,
        capabilityRequired: requiredCapability
      });
    }
  }

  return { applicable, notApplicable };
}

/**
 * Create NOT_APPLICABLE result for an attempt
 * 
 * @param {string} attemptId - Attempt ID
 * @param {string} capabilityName - Name of unobserved capability
 * @returns {Object} Result object with NOT_APPLICABLE outcome
 */
function createNotApplicableAttemptResult(attemptId, capabilityName) {
  return {
    attemptId,
    attemptName: attemptId,
    goal: 'Unknown',
    riskCategory: 'UNKNOWN',
    source: 'capability-check',
    outcome: 'NOT_APPLICABLE',
    skipReason: `Capability not observed: ${capabilityName}`,
    skipReasonCode: 'NOT_APPLICABLE',  // CRITICAL: Must match SKIP_CODES.NOT_APPLICABLE for coverage calculation
    exitCode: 0, // NOT_APPLICABLE doesn't affect exit code
    executed: false,
    steps: [],
    friction: null,
    error: null
  };
}

/**
 * Create NOT_APPLICABLE result for a flow
 * 
 * @param {string} flowId - Flow ID
 * @param {string} capabilityName - Name of unobserved capability
 * @returns {Object} Result object with NOT_APPLICABLE outcome
 */
function createNotApplicableFlowResult(flowId, capabilityName) {
  return {
    flowId,
    flowName: flowId,
    outcome: 'NOT_APPLICABLE',
    skipReason: `Capability not observed: ${capabilityName}`,
    skipReasonCode: 'NOT_OBSERVABLE',
    success: null,
    executed: false,
    steps: [],
    error: null
  };
}

module.exports = {
  CAPABILITY_MAPPINGS,
  extractObservedCapabilities,
  isCapabilityObserved,
  filterAttemptsByObservedCapabilities,
  filterFlowsByObservedCapabilities,
  createNotApplicableAttemptResult,
  createNotApplicableFlowResult
};
