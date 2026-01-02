/**
 * Human Intent Resolver
 * 
 * Determines what a real human visitor would realistically try to do on this site.
 * This layer ensures Guardian only executes attempts that align with genuine human behavior.
 * 
 * Core principle:
 * - A human visits a site with a PRIMARY GOAL based on what they see
 * - They will NOT attempt actions unrelated to that goal
 * - Attempts that don't match the human goal should be marked NOT_APPLICABLE
 */

/**
 * Human goal types (what a visitor would actually try to do)
 */
const HUMAN_GOALS = {
  BUY: 'BUY',                   // Purchase products (ecommerce)
  SIGN_UP: 'SIGN_UP',           // Create account / subscribe (SaaS, apps)
  READ: 'READ',                 // Read content (docs, blogs, news)
  CONTACT: 'CONTACT',           // Contact business (marketing sites)
  USE_SERVICE: 'USE_SERVICE',   // Use an existing account (login-first apps)
  EXPLORE: 'EXPLORE'            // Unclear intent (fallback)
};

/**
 * Mapping: which attempts align with which human goals
 * If an attempt is not listed for a goal, it's FORBIDDEN for that goal
 */
const GOAL_TO_VALID_ATTEMPTS = {
  [HUMAN_GOALS.BUY]: [
    'site_smoke',
    'primary_ctas',
    'checkout',
    'language_switch',
    'universal_reality',
    'contact_discovery_v2',
    'signup',              // Some shops require account
    'login'                // Returning customers
  ],
  
  [HUMAN_GOALS.SIGN_UP]: [
    'site_smoke',
    'primary_ctas',
    'signup',
    'login',
    'language_switch',
    'universal_reality',
    'contact_discovery_v2',
    'newsletter_signup'
  ],
  
  [HUMAN_GOALS.READ]: [
    'site_smoke',
    'primary_ctas',
    'language_switch',
    'universal_reality',
    'contact_discovery_v2',
    'contact_form',
    'newsletter_signup'
  ],
  
  [HUMAN_GOALS.CONTACT]: [
    'site_smoke',
    'primary_ctas',
    'contact_form',
    'contact_discovery_v2',
    'language_switch',
    'universal_reality',
    'newsletter_signup'
  ],
  
  [HUMAN_GOALS.USE_SERVICE]: [
    'site_smoke',
    'login',
    'signup',              // First time users
    'language_switch',
    'universal_reality',
    'contact_discovery_v2'
  ],
  
  [HUMAN_GOALS.EXPLORE]: [
    // When intent is unclear, allow most attempts (conservative)
    'site_smoke',
    'primary_ctas',
    'contact_discovery_v2',
    'universal_reality',
    'login',
    'signup',
    'checkout',
    'contact_form',
    'language_switch',
    'newsletter_signup'
  ]
};

/**
 * Resolve human intent based on site profile and detected capabilities
 * 
 * @param {Object} params
 * @param {string} params.siteProfile - 'ecommerce', 'saas', 'content', 'unknown'
 * @param {Object} params.introspection - Site capabilities from inspectSite()
 * @param {string} params.entryUrl - The URL being tested
 * @returns {Object} Intent resolution result
 */
function resolveHumanIntent({ siteProfile, introspection, entryUrl }) {
  let primaryGoal = HUMAN_GOALS.EXPLORE;
  const secondaryGoals = [];
  let confidence = 0;
  let reasoning = '';

  // Rule 1: Ecommerce sites → primary goal is BUY
  if (siteProfile === 'ecommerce' || introspection.hasCheckout) {
    primaryGoal = HUMAN_GOALS.BUY;
    confidence = 0.95;
    reasoning = 'Site has checkout/cart capabilities → human intent is to BUY products';
    
    // Secondary: might also sign up or contact support
    if (introspection.hasSignup) secondaryGoals.push(HUMAN_GOALS.SIGN_UP);
    if (introspection.hasContactForm) secondaryGoals.push(HUMAN_GOALS.CONTACT);
  }
  
  // Rule 2: SaaS with signup (no checkout) → primary goal is SIGN_UP
  else if (siteProfile === 'saas' && (introspection.hasSignup || introspection.hasLogin)) {
    // Distinguish between signup-first vs login-first
    if (introspection.hasSignup || (!introspection.hasLogin && introspection.hasSignup)) {
      primaryGoal = HUMAN_GOALS.SIGN_UP;
      confidence = 0.9;
      reasoning = 'Site has signup capability → human intent is to SIGN_UP for service';
    } else if (introspection.hasLogin && !introspection.hasSignup) {
      primaryGoal = HUMAN_GOALS.USE_SERVICE;
      confidence = 0.85;
      reasoning = 'Site requires login (no visible signup) → human intent is to USE_SERVICE';
    } else {
      primaryGoal = HUMAN_GOALS.SIGN_UP;
      confidence = 0.8;
      reasoning = 'SaaS site with auth → human intent is to SIGN_UP';
    }
    
    if (introspection.hasContactForm) secondaryGoals.push(HUMAN_GOALS.CONTACT);
  }
  
  // Rule 3: Content sites → primary goal is READ
  else if (siteProfile === 'content' || introspection.hasContentSignals) {
    primaryGoal = HUMAN_GOALS.READ;
    confidence = 0.85;
    reasoning = 'Content-focused site → human intent is to READ articles/documentation';
    
    if (introspection.hasContactForm) secondaryGoals.push(HUMAN_GOALS.CONTACT);
    // Note: Newsletter on content sites doesn't mean full account signup - handled in valid attempts
  }
  
  // Rule 4: Marketing/landing pages (contact form but no other strong signals)
  else if (introspection.hasContactForm && !introspection.hasLogin && !introspection.hasSignup && !introspection.hasCheckout) {
    primaryGoal = HUMAN_GOALS.CONTACT;
    confidence = 0.8;
    reasoning = 'Marketing site with contact form → human intent is to CONTACT business';
    
    if (introspection.hasNewsletter) secondaryGoals.push(HUMAN_GOALS.SIGN_UP);
  }
  
  // Rule 5: Login-only sites (no signup visible)
  else if (introspection.hasLogin && !introspection.hasSignup && !introspection.hasCheckout) {
    primaryGoal = HUMAN_GOALS.USE_SERVICE;
    confidence = 0.75;
    reasoning = 'Login-only site → human intent is to USE_SERVICE with existing account';
  }
  
  // Rule 6: Unknown/ambiguous → EXPLORE (allow most things)
  else {
    primaryGoal = HUMAN_GOALS.EXPLORE;
    confidence = 0.3;
    reasoning = 'Site intent unclear → human may EXPLORE various capabilities';
    
    // For unknown sites, mark common actions as secondary
    if (introspection.hasContactForm) secondaryGoals.push(HUMAN_GOALS.CONTACT);
    if (introspection.hasSignup) secondaryGoals.push(HUMAN_GOALS.SIGN_UP);
    if (introspection.hasCheckout) secondaryGoals.push(HUMAN_GOALS.BUY);
  }

  return {
    primaryGoal,
    secondaryGoals,
    confidence,
    reasoning,
    siteProfile
  };
}

/**
 * Determine if an attempt should be executed based on human intent
 * 
 * @param {string} attemptId - The attempt to check
 * @param {Object} intentResolution - Result from resolveHumanIntent()
 * @returns {Object} Decision { shouldExecute: boolean, reason: string }
 */
function shouldExecuteAttempt(attemptId, intentResolution) {
  const { primaryGoal, secondaryGoals } = intentResolution;
  
  // Check if attempt is valid for primary goal
  const validForPrimary = GOAL_TO_VALID_ATTEMPTS[primaryGoal]?.includes(attemptId);
  
  if (validForPrimary) {
    return {
      shouldExecute: true,
      reason: `Aligns with human goal: ${primaryGoal}`,
      humanReason: getHumanReadableReason(attemptId, primaryGoal, true)
    };
  }
  
  // Check secondary goals
  for (const secondaryGoal of secondaryGoals) {
    const validForSecondary = GOAL_TO_VALID_ATTEMPTS[secondaryGoal]?.includes(attemptId);
    if (validForSecondary) {
      return {
        shouldExecute: true,
        reason: `Aligns with secondary goal: ${secondaryGoal}`,
        humanReason: getHumanReadableReason(attemptId, secondaryGoal, false)
      };
    }
  }
  
  // Not aligned with any goal
  return {
    shouldExecute: false,
    reason: `Not aligned with human intent (primary: ${primaryGoal}, secondary: ${secondaryGoals.join(', ')})`,
    humanReason: getHumanReadableReason(attemptId, primaryGoal, false)
  };
}

/**
 * Generate human-readable explanation for why an attempt should/shouldn't execute
 */
function getHumanReadableReason(attemptId, goal, shouldExecute) {
  const attemptLabels = {
    'checkout': 'trying to purchase',
    'login': 'logging in',
    'signup': 'signing up',
    'contact_form': 'contacting the business',
    'newsletter_signup': 'subscribing to newsletter',
    'language_switch': 'switching language',
    'site_smoke': 'checking if site loads',
    'primary_ctas': 'exploring main actions',
    'universal_reality': 'basic site verification',
    'contact_discovery_v2': 'finding contact information'
  };

  const goalExplanations = {
    [HUMAN_GOALS.BUY]: 'buy something',
    [HUMAN_GOALS.SIGN_UP]: 'sign up for the service',
    [HUMAN_GOALS.READ]: 'read content',
    [HUMAN_GOALS.CONTACT]: 'contact the business',
    [HUMAN_GOALS.USE_SERVICE]: 'use an existing account',
    [HUMAN_GOALS.EXPLORE]: 'explore the site'
  };

  const attemptLabel = attemptLabels[attemptId] || attemptId;
  const goalLabel = goalExplanations[goal] || goal;

  if (shouldExecute) {
    return `A visitor wanting to ${goalLabel} would naturally try ${attemptLabel}`;
  } else {
    return `A visitor wanting to ${goalLabel} would NOT try ${attemptLabel}`;
  }
}

/**
 * Get list of forbidden attempts for a given intent resolution
 * 
 * @param {Array} allAttempts - List of all attempt IDs
 * @param {Object} intentResolution - Result from resolveHumanIntent()
 * @returns {Array} List of {attemptId, reason} for forbidden attempts
 */
function getForbiddenAttempts(allAttempts, intentResolution) {
  const forbidden = [];
  
  for (const attemptId of allAttempts) {
    const decision = shouldExecuteAttempt(attemptId, intentResolution);
    if (!decision.shouldExecute) {
      forbidden.push({
        attemptId,
        reason: decision.reason,
        humanReason: decision.humanReason
      });
    }
  }
  
  return forbidden;
}

module.exports = {
  HUMAN_GOALS,
  resolveHumanIntent,
  shouldExecuteAttempt,
  getForbiddenAttempts,
  getHumanReadableReason
};
