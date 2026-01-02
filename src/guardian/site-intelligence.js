/**
 * ODAVL Guardian Site Intelligence Engine
 * Phase 10: Core intelligence layer that understands sites before attempting flows
 * 
 * CRITICAL: This is NOT heuristics. This is CORE INTELLIGENCE.
 * Guardian must UNDERSTAND before ACTING.
 */

/**
 * Site types Guardian can classify
 */
const SITE_TYPES = {
  MARKETING: 'marketing',
  SAAS: 'saas_application',
  ECOMMERCE: 'ecommerce',
  DOCUMENTATION: 'documentation',
  BLOG: 'blog',
  UNKNOWN: 'unknown'
};

/**
 * Capabilities a site might support
 */
const CAPABILITIES = {
  SUPPORTS_LOGIN: 'supports_login',
  SUPPORTS_SIGNUP: 'supports_signup',
  SUPPORTS_CHECKOUT: 'supports_checkout',
  SUPPORTS_FORMS: 'supports_forms',
  SUPPORTS_PRIMARY_CTA: 'supports_primary_cta',
  SUPPORTS_LANGUAGE_SWITCH: 'supports_language_switch',
  SUPPORTS_PRICING: 'supports_pricing',
  SUPPORTS_CONTACT: 'supports_contact',
  SUPPORTS_NEWSLETTER: 'supports_newsletter'
};

/**
 * Analyze a page to classify site type and detect capabilities
 * @param {Page} page - Playwright page object
 * @param {string} baseUrl - Base URL of the site
 * @returns {Promise<Object>} Intelligence report
 */
async function analyzeSite(page, baseUrl) {
  const intelligence = {
    siteType: SITE_TYPES.UNKNOWN,
    confidence: 0,
    detectedSignals: [],
    capabilities: {},
    flowApplicability: {},
    timestamp: new Date().toISOString()
  };

  try {
    // Navigate to base URL if not already there
    const currentUrl = page.url();
    if (!currentUrl.startsWith(baseUrl)) {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    }

    // Collect signals from the page
    const signals = await collectPageSignals(page, baseUrl);
    intelligence.detectedSignals = signals;

    // Classify site type
    const classification = classifySiteType(signals);
    intelligence.siteType = classification.siteType;
    intelligence.confidence = classification.confidence;

    // Detect capabilities
    intelligence.capabilities = detectCapabilities(signals);

    // Determine flow applicability
    intelligence.flowApplicability = determineFlowApplicability(intelligence.capabilities, intelligence.siteType);

    return intelligence;
  } catch (error) {
    console.warn(`⚠️  Site intelligence analysis failed: ${error.message}`);
    // Return conservative defaults on failure
    return {
      ...intelligence,
      siteType: SITE_TYPES.UNKNOWN,
      confidence: 0,
      detectedSignals: [{ type: 'error', message: error.message }],
      capabilities: getConservativeCapabilities(),
      flowApplicability: getConservativeFlowApplicability()
    };
  }
}

/**
 * Collect signals from the page for classification
 * @param {Page} page - Playwright page
 * @param {string} baseUrl - Base URL
 * @returns {Promise<Array>} Array of detected signals
 */
async function collectPageSignals(page, baseUrl) {
  const signals = [];

  try {
    // URL pattern analysis
    const url = page.url();
    const urlSignals = analyzeUrlPatterns(url, baseUrl);
    signals.push(...urlSignals);

    // DOM-based detection
    const domSignals = await page.evaluate(() => {
      const signals = [];

      // Login indicators (CSS + text matches)
      const loginSelectors = [
        'a[href*="login"]',
        'a[href*="signin"]',
        'input[type="password"]',
        '[data-testid*="login"]',
        '[data-guardian*="login"]'
      ];
      for (const selector of loginSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          signals.push({
            type: 'login_indicator',
            selector,
            count: elements.length,
            text: Array.from(elements).slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean)
          });
        }
      }
      const loginTextCandidates = ['Login', 'Sign in'];
      for (const text of loginTextCandidates) {
        const elements = Array.from(document.querySelectorAll('button, a')).filter(el => (el.textContent || '').toLowerCase().includes(text.toLowerCase()));
        if (elements.length > 0) {
          signals.push({
            type: 'login_indicator',
            selector: `text:${text}`,
            count: elements.length,
            text: elements.slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean)
          });
        }
      }

      // Signup indicators (CSS + text matches)
      const signupSelectors = [
        'a[href*="signup"]',
        'a[href*="register"]',
        'a[href*="join"]',
        '[data-testid*="signup"]',
        '[data-guardian*="signup"]'
      ];

      for (const selector of signupSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          signals.push({
            type: 'signup_indicator',
            selector,
            count: elements.length,
            text: Array.from(elements).slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean)
          });
        }
      }
      const signupTextCandidates = ['Sign up', 'Register', 'Get started'];
      for (const text of signupTextCandidates) {
        const elements = Array.from(document.querySelectorAll('button, a')).filter(el => (el.textContent || '').toLowerCase().includes(text.toLowerCase()));
        if (elements.length > 0) {
          signals.push({
            type: 'signup_indicator',
            selector: `text:${text}`,
            count: elements.length,
            text: elements.slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean)
          });
        }
      }

      // E-commerce indicators (CSS + text matches)
      const commerceSelectors = [
        'a[href*="cart"]',
        'a[href*="checkout"]',
        'a[href*="shop"]',
        '[data-testid*="cart"]',
        '[data-testid*="checkout"]'
      ];

      for (const selector of commerceSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          signals.push({
            type: 'commerce_indicator',
            selector,
            count: elements.length,
            text: Array.from(elements).slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean)
          });
        }
      }
      const commerceTextCandidates = ['Add to cart', 'Buy', 'Purchase'];
      for (const text of commerceTextCandidates) {
        const elements = Array.from(document.querySelectorAll('button, a')).filter(el => (el.textContent || '').toLowerCase().includes(text.toLowerCase()));
        if (elements.length > 0) {
          signals.push({
            type: 'commerce_indicator',
            selector: `text:${text}`,
            count: elements.length,
            text: elements.slice(0, 3).map(el => el.textContent?.trim()).filter(Boolean)
          });
        }
      }

      // Pricing indicators
      const pricingSelectors = [
        'a[href*="pricing"]',
        'a[href*="plans"]',
        '[class*="price"]',
        '[class*="pricing"]'
      ];

      for (const selector of pricingSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          signals.push({
            type: 'pricing_indicator',
            selector,
            count: elements.length
          });
        }
      }

      // Dashboard/App indicators
      const dashboardSelectors = [
        'a[href*="/app"]',
        'a[href*="/dashboard"]',
        'a[href*="/console"]'
      ];

      for (const selector of dashboardSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          signals.push({
            type: 'dashboard_indicator',
            selector,
            count: elements.length
          });
        }
      }

      // Documentation indicators
      const docsSelectors = [
        'a[href*="/docs"]',
        'a[href*="/documentation"]',
        'a[href*="/guide"]'
      ];

      for (const selector of docsSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          signals.push({
            type: 'docs_indicator',
            selector,
            count: elements.length
          });
        }
      }

      // Form indicators
      const forms = document.querySelectorAll('form');
      if (forms.length > 0) {
        signals.push({
          type: 'form_indicator',
          count: forms.length
        });
      }

      // Contact form indicators
      const contactSelectors = [
        'a[href*="contact"]',
        'form[action*="contact"]',
        'input[name*="email"]',
        '[data-guardian*="contact"]'
      ];

      for (const selector of contactSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          signals.push({
            type: 'contact_indicator',
            selector,
            count: elements.length
          });
        }
      }

      // Primary CTA detection
      const ctaSelectors = [
        'button',
        'a[class*="button"]',
        'a[class*="cta"]',
        '[role="button"]'
      ];

      let ctaCount = 0;
      for (const selector of ctaSelectors) {
        ctaCount += document.querySelectorAll(selector).length;
      }

      if (ctaCount > 0) {
        signals.push({
          type: 'cta_indicator',
          count: ctaCount
        });
      }

      return signals;
    });

    signals.push(...domSignals);

    return signals;
  } catch (error) {
    console.warn(`⚠️  Signal collection failed: ${error.message}`);
    return signals;
  }
}

/**
 * Analyze URL patterns for classification hints
 * @param {string} url - Current URL
 * @param {string} baseUrl - Base URL
 * @returns {Array} URL-based signals
 */
function analyzeUrlPatterns(url, baseUrl) {
  const signals = [];
  const urlLower = url.toLowerCase();

  if (urlLower.includes('/app') || urlLower.includes('/dashboard')) {
    signals.push({ type: 'url_pattern', pattern: 'app/dashboard', indicator: 'saas' });
  }

  if (urlLower.includes('/shop') || urlLower.includes('/store') || urlLower.includes('/products')) {
    signals.push({ type: 'url_pattern', pattern: 'shop/store', indicator: 'ecommerce' });
  }

  if (urlLower.includes('/docs') || urlLower.includes('/documentation')) {
    signals.push({ type: 'url_pattern', pattern: 'docs', indicator: 'documentation' });
  }

  if (urlLower.includes('/blog') || urlLower.includes('/articles')) {
    signals.push({ type: 'url_pattern', pattern: 'blog', indicator: 'blog' });
  }

  return signals;
}

/**
 * Classify site type based on collected signals
 * @param {Array} signals - Collected signals
 * @returns {Object} Classification result with type and confidence
 */
function classifySiteType(signals) {
  const scores = {
    [SITE_TYPES.MARKETING]: 0,
    [SITE_TYPES.SAAS]: 0,
    [SITE_TYPES.ECOMMERCE]: 0,
    [SITE_TYPES.DOCUMENTATION]: 0,
    [SITE_TYPES.BLOG]: 0
  };

  // Score based on signals
  for (const signal of signals) {
    switch (signal.type) {
      case 'login_indicator':
        scores[SITE_TYPES.SAAS] += 3;
        break;
      case 'signup_indicator':
        scores[SITE_TYPES.SAAS] += 2;
        scores[SITE_TYPES.MARKETING] += 1;
        break;
      case 'commerce_indicator':
        scores[SITE_TYPES.ECOMMERCE] += 5;
        break;
      case 'dashboard_indicator':
        scores[SITE_TYPES.SAAS] += 4;
        break;
      case 'docs_indicator':
        scores[SITE_TYPES.DOCUMENTATION] += 5;
        break;
      case 'pricing_indicator':
        scores[SITE_TYPES.SAAS] += 2;
        scores[SITE_TYPES.MARKETING] += 1;
        break;
      case 'contact_indicator':
        scores[SITE_TYPES.MARKETING] += 2;
        break;
      case 'cta_indicator':
        scores[SITE_TYPES.MARKETING] += 1;
        break;
      case 'url_pattern':
        if (signal.indicator === 'saas') scores[SITE_TYPES.SAAS] += 3;
        if (signal.indicator === 'ecommerce') scores[SITE_TYPES.ECOMMERCE] += 3;
        if (signal.indicator === 'documentation') scores[SITE_TYPES.DOCUMENTATION] += 3;
        if (signal.indicator === 'blog') scores[SITE_TYPES.BLOG] += 3;
        break;
    }
  }

  // Find highest score
  let maxScore = 0;
  let siteType = SITE_TYPES.UNKNOWN;

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      siteType = type;
    }
  }

  // Calculate confidence (0-1)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.min(maxScore / totalScore, 1) : 0;

  // If no strong signals, default to marketing with low confidence
  if (maxScore === 0) {
    return {
      siteType: SITE_TYPES.MARKETING,
      confidence: 0.3
    };
  }

  return {
    siteType,
    confidence: Math.round(confidence * 100) / 100
  };
}

/**
 * Detect what capabilities the site actually supports
 * @param {Array} signals - Collected signals
 * @returns {Object} Capability map with evidence
 */
function detectCapabilities(signals) {
  const capabilities = {};

  // Login detection
  const hasLoginSignals = signals.some(s => s.type === 'login_indicator');
  capabilities[CAPABILITIES.SUPPORTS_LOGIN] = {
    supported: hasLoginSignals,
    confidence: hasLoginSignals ? 0.9 : 0.1,
    evidence: signals.filter(s => s.type === 'login_indicator').slice(0, 2)
  };

  // Signup detection
  const hasSignupSignals = signals.some(s => s.type === 'signup_indicator');
  capabilities[CAPABILITIES.SUPPORTS_SIGNUP] = {
    supported: hasSignupSignals,
    confidence: hasSignupSignals ? 0.9 : 0.1,
    evidence: signals.filter(s => s.type === 'signup_indicator').slice(0, 2)
  };

  // Checkout detection
  const hasCommerceSignals = signals.some(s => s.type === 'commerce_indicator');
  capabilities[CAPABILITIES.SUPPORTS_CHECKOUT] = {
    supported: hasCommerceSignals,
    confidence: hasCommerceSignals ? 0.9 : 0.1,
    evidence: signals.filter(s => s.type === 'commerce_indicator').slice(0, 2)
  };

  // Forms detection
  const hasFormSignals = signals.some(s => s.type === 'form_indicator');
  capabilities[CAPABILITIES.SUPPORTS_FORMS] = {
    supported: hasFormSignals,
    confidence: hasFormSignals ? 0.8 : 0.2,
    evidence: signals.filter(s => s.type === 'form_indicator').slice(0, 1)
  };

  // Primary CTA detection
  const hasCtaSignals = signals.some(s => s.type === 'cta_indicator');
  capabilities[CAPABILITIES.SUPPORTS_PRIMARY_CTA] = {
    supported: hasCtaSignals,
    confidence: hasCtaSignals ? 0.8 : 0.2,
    evidence: signals.filter(s => s.type === 'cta_indicator').slice(0, 1)
  };

  // Pricing detection
  const hasPricingSignals = signals.some(s => s.type === 'pricing_indicator');
  capabilities[CAPABILITIES.SUPPORTS_PRICING] = {
    supported: hasPricingSignals,
    confidence: hasPricingSignals ? 0.8 : 0.2,
    evidence: signals.filter(s => s.type === 'pricing_indicator').slice(0, 2)
  };

  // Contact detection
  const hasContactSignals = signals.some(s => s.type === 'contact_indicator');
  capabilities[CAPABILITIES.SUPPORTS_CONTACT] = {
    supported: hasContactSignals,
    confidence: hasContactSignals ? 0.8 : 0.2,
    evidence: signals.filter(s => s.type === 'contact_indicator').slice(0, 2)
  };

  return capabilities;
}

/**
 * Determine which flows are applicable based on capabilities
 * @param {Object} capabilities - Detected capabilities
 * @param {string} siteType - Classified site type
 * @returns {Object} Flow applicability map
 */
function determineFlowApplicability(capabilities, siteType) {
  const applicability = {};

  // Signup flow
  const supportsSignup = capabilities[CAPABILITIES.SUPPORTS_SIGNUP]?.supported;
  applicability.signup_flow = {
    applicable: supportsSignup === true,
    reason: supportsSignup ? 'Signup elements detected' : 'No signup elements found',
    confidence: capabilities[CAPABILITIES.SUPPORTS_SIGNUP]?.confidence || 0
  };

  // Login flow
  const supportsLogin = capabilities[CAPABILITIES.SUPPORTS_LOGIN]?.supported;
  applicability.login_flow = {
    applicable: supportsLogin === true,
    reason: supportsLogin ? 'Login elements detected' : 'No login elements found',
    confidence: capabilities[CAPABILITIES.SUPPORTS_LOGIN]?.confidence || 0
  };

  // Checkout flow
  const supportsCheckout = capabilities[CAPABILITIES.SUPPORTS_CHECKOUT]?.supported;
  applicability.checkout_flow = {
    applicable: supportsCheckout === true,
    reason: supportsCheckout ? 'Checkout/commerce elements detected' : 'No checkout elements found',
    confidence: capabilities[CAPABILITIES.SUPPORTS_CHECKOUT]?.confidence || 0
  };

  return applicability;
}

/**
 * Get conservative capabilities when analysis fails
 * @returns {Object} Conservative capability map
 */
function getConservativeCapabilities() {
  return {
    [CAPABILITIES.SUPPORTS_LOGIN]: { supported: false, confidence: 0, evidence: [] },
    [CAPABILITIES.SUPPORTS_SIGNUP]: { supported: false, confidence: 0, evidence: [] },
    [CAPABILITIES.SUPPORTS_CHECKOUT]: { supported: false, confidence: 0, evidence: [] },
    [CAPABILITIES.SUPPORTS_FORMS]: { supported: false, confidence: 0, evidence: [] },
    [CAPABILITIES.SUPPORTS_PRIMARY_CTA]: { supported: true, confidence: 0.5, evidence: [] },
    [CAPABILITIES.SUPPORTS_PRICING]: { supported: false, confidence: 0, evidence: [] },
    [CAPABILITIES.SUPPORTS_CONTACT]: { supported: false, confidence: 0, evidence: [] }
  };
}

/**
 * Get conservative flow applicability when analysis fails
 * @returns {Object} Conservative applicability map
 */
function getConservativeFlowApplicability() {
  return {
    signup_flow: { applicable: false, reason: 'Analysis failed; conservative default', confidence: 0 },
    login_flow: { applicable: false, reason: 'Analysis failed; conservative default', confidence: 0 },
    checkout_flow: { applicable: false, reason: 'Analysis failed; conservative default', confidence: 0 }
  };
}

/**
 * Check if a specific flow is applicable based on intelligence
 * @param {Object} intelligence - Site intelligence data
 * @param {string} flowId - Flow identifier
 * @returns {boolean} True if flow is applicable
 */
function isFlowApplicable(intelligence, flowId) {
  if (!intelligence || !intelligence.flowApplicability) {
    // Conservative: if no intelligence, don't run the flow
    return false;
  }

  const applicability = intelligence.flowApplicability[flowId];
  if (!applicability) {
    // Unknown flow, conservative approach
    return false;
  }

  return applicability.applicable === true;
}

module.exports = {
  analyzeSite,
  isFlowApplicable,
  SITE_TYPES,
  CAPABILITIES
};
