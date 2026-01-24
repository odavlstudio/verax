/**
 * PHASE 21.4 — Guardrails Policy Loader
 * 
 * Loads guardrails policies from files or uses defaults.
 * Validates policies and ensures all rules are mandatory.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { validateGuardrailsPolicy } from './policy.schema.js';
import { DEFAULT_GUARDRAILS_POLICY } from './policy.defaults.js';

/**
 * Load guardrails policy
 * 
 * @param {string|null} policyPath - Path to custom policy file (optional)
 * @param {string} projectDir - Project directory
 * @returns {Object} Guardrails policy
 * @throws {Error} If policy is invalid
 */
export function loadGuardrailsPolicy(policyPath = null, projectDir = null) {
  // If no custom policy path, use defaults
  if (!policyPath) {
    return DEFAULT_GUARDRAILS_POLICY;
  }
  
  // Resolve policy path
  const resolvedPath = projectDir ? resolve(projectDir, policyPath) : resolve(policyPath);
  
  // Check if file exists
  if (!existsSync(resolvedPath)) {
    throw new Error(`Guardrails policy file not found: ${resolvedPath}`);
  }
  
  // Read and parse policy
  let policy;
  try {
    const policyContent = readFileSync(resolvedPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    policy = JSON.parse(policyContent);
  } catch (error) {
    throw new Error(`Failed to load guardrails policy: ${error.message}`);
  }
  
  // Validate policy
  try {
    validateGuardrailsPolicy(policy);
  } catch (error) {
    throw new Error(`Invalid guardrails policy: ${error.message}`);
  }
  
  // Mark as custom
  policy.source = 'custom';
  
  // HARD LOCK: Ensure all rules are mandatory
  for (const rule of policy.rules) {
    if (rule.mandatory !== true) {
      throw new Error(`Guardrails rule ${rule.id} cannot be disabled (mandatory must be true)`);
    }
  }
  
  return policy;
}

/**
 * Get policy report metadata
 * 
 * @param {Object} policy - Guardrails policy
 * @returns {Object} Policy report metadata
 */
export function getPolicyReport(policy) {
  return {
    version: policy.version,
    source: policy.source,
    ruleCount: policy.rules.length,
    rules: policy.rules.map(rule => ({
      id: rule.id,
      category: rule.category,
      action: rule.action,
      mandatory: rule.mandatory
    }))
  };
}




