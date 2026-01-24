/**
 * PHASE 21.4 — Guardrails Policy Schema
 * 
 * Defines the structure for guardrails policies.
 * All rules are mandatory and cannot be disabled.
 */

/**
 * Guardrails Policy Schema
 * 
 * @typedef {Object} GuardrailsPolicy
 * @property {string} version - Policy version
 * @property {string} source - 'default' | 'custom'
 * @property {Array<GuardrailsRule>} rules - Array of guardrails rules
 */

/**
 * Guardrails Rule
 * 
 * @typedef {Object} GuardrailsRule
 * @property {string} id - Stable rule identifier
 * @property {string} category - Rule category (network, navigation, ui-feedback, validation, state)
 * @property {string} trigger - Trigger condition description
 * @property {string} action - Action type (BLOCK / DOWNGRADE / INFO)
 * @property {number} confidenceDelta - Confidence adjustment (must be ≤ 0)
 * @property {Array<string>} appliesTo - Capabilities list this rule applies to
 * @property {boolean} mandatory - Always true (cannot be disabled)
 * @property {Object} evaluation - Evaluation function parameters
 */

/**
 * Validate guardrails policy
 * 
 * @param {Object} policy - Policy to validate
 * @throws {Error} If policy is invalid
 */
export function validateGuardrailsPolicy(policy) {
  if (!policy) {
    throw new Error('Guardrails policy is required');
  }
  
  if (!policy.version || typeof policy.version !== 'string') {
    throw new Error('Guardrails policy must have a version string');
  }
  
  if (!policy.rules || !Array.isArray(policy.rules)) {
    throw new Error('Guardrails policy must have a rules array');
  }
  
  for (const rule of policy.rules) {
    validateGuardrailsRule(rule);
  }
}

/**
 * Validate a guardrails rule
 * 
 * @param {Object} rule - Rule to validate
 * @throws {Error} If rule is invalid
 */
export function validateGuardrailsRule(rule) {
  if (!rule.id || typeof rule.id !== 'string') {
    throw new Error('Guardrails rule must have a stable id string');
  }
  
  if (!rule.category || typeof rule.category !== 'string') {
    throw new Error('Guardrails rule must have a category string');
  }
  
  const validCategories = ['network', 'navigation', 'ui-feedback', 'validation', 'state'];
  if (!validCategories.includes(rule.category)) {
    throw new Error(`Guardrails rule category must be one of: ${validCategories.join(', ')}`);
  }
  
  if (!rule.action || typeof rule.action !== 'string') {
    throw new Error('Guardrails rule must have an action string');
  }
  
  const validActions = ['BLOCK', 'DOWNGRADE', 'INFO'];
  if (!validActions.includes(rule.action)) {
    throw new Error(`Guardrails rule action must be one of: ${validActions.join(', ')}`);
  }
  
  if (typeof rule.confidenceDelta !== 'number') {
    throw new Error('Guardrails rule must have a confidenceDelta number');
  }
  
  // HARD LOCK: Confidence delta must be ≤ 0 (can only decrease confidence)
  if (rule.confidenceDelta > 0) {
    throw new Error('Guardrails rule confidenceDelta must be ≤ 0 (cannot increase confidence)');
  }
  
  if (!Array.isArray(rule.appliesTo)) {
    throw new Error('Guardrails rule appliesTo must be an array');
  }
  
  // HARD LOCK: All rules are mandatory
  if (rule.mandatory !== true) {
    throw new Error('Guardrails rule must have mandatory: true (cannot be disabled)');
  }
  
  if (!rule.trigger || typeof rule.trigger !== 'string') {
    throw new Error('Guardrails rule must have a trigger description');
  }
  
  if (!rule.evaluation || typeof rule.evaluation !== 'object') {
    throw new Error('Guardrails rule must have an evaluation object');
  }
}




