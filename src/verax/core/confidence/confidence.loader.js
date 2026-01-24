/**
 * PHASE 21.4 — Confidence Policy Loader
 * 
 * Loads confidence policies from files or uses defaults.
 * Validates policies and enforces truth locks.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { validateConfidencePolicy } from './confidence.schema.js';
import { DEFAULT_CONFIDENCE_POLICY } from './confidence.defaults.js';

/**
 * Load confidence policy
 * 
 * @param {string|null} policyPath - Path to custom policy file (optional)
 * @param {string} projectDir - Project directory
 * @returns {Object} Confidence policy
 * @throws {Error} If policy is invalid
 */
export function loadConfidencePolicy(policyPath = null, projectDir = null) {
  // If no custom policy path, use defaults
  if (!policyPath) {
    return DEFAULT_CONFIDENCE_POLICY;
  }
  
  // Resolve policy path
  const resolvedPath = projectDir ? resolve(projectDir, policyPath) : resolve(policyPath);
  
  // Check if file exists
  if (!existsSync(resolvedPath)) {
    throw new Error(`Confidence policy file not found: ${resolvedPath}`);
  }
  
  // Read and parse policy
  let policy;
  try {
    const policyContent = readFileSync(resolvedPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    policy = JSON.parse(policyContent);
  } catch (error) {
    throw new Error(`Failed to load confidence policy: ${error.message}`);
  }
  
  // Validate policy
  try {
    validateConfidencePolicy(policy);
  } catch (error) {
    throw new Error(`Invalid confidence policy: ${error.message}`);
  }
  
  // HARD LOCK: Enforce truth locks from defaults (cannot be overridden)
  // Defaults override any custom values
  policy.truthLocks = {
    ...policy.truthLocks,
    ...DEFAULT_CONFIDENCE_POLICY.truthLocks  // Defaults take precedence
  };
  
  // Mark as custom
  policy.source = 'custom';
  
  return policy;
}

/**
 * Get policy report metadata
 * 
 * @param {Object} policy - Confidence policy
 * @returns {Object} Policy report metadata
 */
export function getPolicyReport(policy) {
  return {
    version: policy.version,
    source: policy.source,
    thresholds: policy.thresholds,
    weights: policy.weights,
    truthLocks: Object.keys(policy.truthLocks)
  };
}




