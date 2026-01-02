/**
 * Auto-Attempt Builder (Phase 2)
 * 
 * Converts discovered interactions into safe, executable attempt definitions.
 * - Filters by safety/confidence
 * - Generates deterministic steps (navigate → interact → validate)
 * - Deduplicates attempts
 * - Applies minimal validators
 * 
 * NO AI. Pure deterministic logic.
 */

const crypto = require('crypto');

/**
 * @typedef {Object} AutoAttemptDefinition
 * @property {string} attemptId - unique ID (e.g., "auto-navigate-about")
 * @property {string} name - human-readable name
 * @property {string} goal - what the attempt is testing
 * @property {Array<Object>} steps - execution steps
 * @property {Array<Object>} validators - success validators
 * @property {string} riskCategory - TRUST, REVENUE, LEAD, UNKNOWN
 * @property {string} source - 'auto-generated'
 * @property {Object} metadata - discovery metadata (interaction, confidence, etc.)
 */

/**
 * Generate stable hash for deduplication
 */
function generateAttemptHash(interaction) {
  const key = `${interaction.pageUrl}|${interaction.type}|${interaction.selector}|${interaction.text || ''}`;
  return crypto.createHash('md5').update(key).digest('hex').substring(0, 8);
}

/**
 * Generate attemptId from interaction
 */
function generateAttemptId(interaction, hash) {
  const prefix = 'auto';
  const interactionClass = (interaction.interactionClass || 'action').toLowerCase();
  const sanitizedText = (interaction.text || interaction.ariaLabel || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 20);
  
  return `${prefix}-${interactionClass}-${sanitizedText}-${hash}`;
}

/**
 * Generate human-readable name
 */
function generateAttemptName(interaction) {
  const className = interaction.interactionClass || 'Interaction';
  const text = interaction.text || interaction.ariaLabel || interaction.selector;
  return `Auto ${className}: ${text.substring(0, 50)}`;
}

/**
 * Generate goal statement
 */
function generateGoal(interaction) {
  const action = interaction.type === 'NAVIGATE' ? 'Navigate to' :
                 interaction.type === 'CLICK' ? 'Click' :
                 interaction.type === 'FORM_FILL' ? 'Fill form' : 'Interact with';
  const target = interaction.text || interaction.ariaLabel || interaction.selector;
  return `${action} "${target}" and verify page remains responsive`;
}

/**
 * Generate execution steps for an interaction
 */
function generateSteps(interaction) {
  const steps = [];

  // Step 1: Navigate to page where interaction was found
  steps.push({
    id: 'navigate_to_page',
    type: 'navigate',
    target: interaction.pageUrl,
    description: `Navigate to ${interaction.pageUrl}`
  });

  // Step 2: Wait for element to be visible
  steps.push({
    id: 'wait_for_element',
    type: 'waitFor',
    target: interaction.selector,
    timeout: 10000,
    description: `Wait for element: ${interaction.selector}`
  });

  // Step 3: Execute interaction
  if (interaction.type === 'NAVIGATE') {
    steps.push({
      id: 'click_link',
      type: 'click',
      target: interaction.selector,
      description: `Click link: ${interaction.text || interaction.selector}`
    });
  } else if (interaction.type === 'CLICK') {
    steps.push({
      id: 'click_button',
      type: 'click',
      target: interaction.selector,
      description: `Click button: ${interaction.text || interaction.selector}`
    });
  } else if (interaction.type === 'FORM_FILL') {
    // Fill form fields with safe test data
    steps.push({
      id: 'fill_form',
      type: 'fillForm',
      target: interaction.selector,
      formData: generateFormData(interaction.formFields || []),
      description: `Fill form: ${interaction.formId || interaction.selector}`
    });
  }

  // Step 4: Wait briefly for DOM updates
  steps.push({
    id: 'wait_for_update',
    type: 'wait',
    duration: 500,
    description: 'Wait for DOM update'
  });

  return steps;
}

/**
 * Generate safe form data
 */
function generateFormData(fieldTypes) {
  const data = {};
  fieldTypes.forEach((type, idx) => {
    if (type === 'email') {
      data[`email_${idx}`] = `autotest${idx}@example.com`;
    } else if (type === 'text') {
      data[`text_${idx}`] = `Auto test ${idx}`;
    } else if (type === 'password') {
      data[`password_${idx}`] = 'AutoTest123!';
    } else if (type === 'tel') {
      data[`tel_${idx}`] = '5551234567';
    } else if (type === 'url') {
      data[`url_${idx}`] = 'https://example.com';
    }
  });
  return data;
}

/**
 * Generate minimal validators for auto-attempts
 * Focus on: page responsive, no critical errors, state changed
 */
function generateValidators(interaction) {
  const validators = [];

  // Validator 1: Page is still responsive (no crash)
  validators.push({
    type: 'elementVisible',
    selector: 'body'
  });

  // Validator 2: No console errors above 'error' level
  validators.push({
    type: 'noConsoleErrorsAbove',
    minSeverity: 'error'
  });

  return validators;
}

/**
 * Determine risk category for auto-attempt
 * Auto-attempts are lower priority than manual intent flows
 */
function determineRiskCategory(interaction) {
  const { interactionClass, text = '', ariaLabel = '' } = interaction;
  const combinedText = `${text} ${ariaLabel}`.toLowerCase();

  // Navigation to key pages: TRUST
  if (interactionClass === 'NAVIGATION') {
    if (combinedText.includes('about') || combinedText.includes('contact') ||
        combinedText.includes('help') || combinedText.includes('support')) {
      return 'TRUST';
    }
  }

  // Forms: LEAD
  if (interactionClass === 'SUBMISSION') {
    return 'LEAD';
  }

  // Default: lower priority
  return 'DISCOVERY';
}

/**
 * Build auto-attempt from discovered interaction
 */
function buildAutoAttempt(interaction) {
  const hash = generateAttemptHash(interaction);
  const attemptId = generateAttemptId(interaction, hash);
  const name = generateAttemptName(interaction);
  const goal = generateGoal(interaction);
  const steps = generateSteps(interaction);
  const validators = generateValidators(interaction);
  const riskCategory = determineRiskCategory(interaction);

  return {
    id: attemptId,          // Registry expects 'id'
    attemptId,              // Keep for backwards compatibility
    name,
    goal,
    baseSteps: steps,       // Engine expects 'baseSteps'
    successConditions: [
      { type: 'selector', target: 'body', description: 'Page loaded and responsive' }
    ],
    validators,
    riskCategory,
    source: 'auto-generated',
    metadata: {
      discoveryInteractionId: interaction.interactionId,
      discoveredUrl: interaction.pageUrl,
      interactionType: interaction.type,
      interactionClass: interaction.interactionClass,
      confidenceScore: interaction.confidenceScore,
      selector: interaction.selector,
      text: interaction.text,
      ariaLabel: interaction.ariaLabel
    }
  };
}

/**
 * Main function: Convert discovered interactions to auto-attempts
 * @param {Array<Object>} interactions - discovered interactions from DiscoveryEngine
 * @param {Object} options - filtering options
 * @returns {Array<AutoAttemptDefinition>} auto-attempt definitions
 */
function buildAutoAttempts(interactions, options = {}) {
  const {
    minConfidence = 60,
    maxAttempts = 10,
    excludeRisky = true,
    includeClasses = ['NAVIGATION', 'ACTION', 'SUBMISSION', 'TOGGLE']
  } = options;

  // Filter safe, high-confidence interactions
  const filtered = interactions.filter(interaction => {
    if (excludeRisky && interaction.isRisky) return false;
    if (interaction.confidenceScore < minConfidence) return false;
    if (!includeClasses.includes(interaction.interactionClass)) return false;
    return true;
  });

  // Sort by confidence (highest first)
  filtered.sort((a, b) => b.confidenceScore - a.confidenceScore);

  // Deduplicate by hash
  const seen = new Set();
  const unique = [];
  for (const interaction of filtered) {
    const hash = generateAttemptHash(interaction);
    if (!seen.has(hash)) {
      seen.add(hash);
      unique.push(interaction);
    }
  }

  // Limit to maxAttempts
  const limited = unique.slice(0, maxAttempts);

  // Build attempts
  return limited.map(interaction => buildAutoAttempt(interaction));
}

module.exports = {
  buildAutoAttempts,
  buildAutoAttempt,
  generateAttemptId,
  generateSteps,
  generateValidators
};
