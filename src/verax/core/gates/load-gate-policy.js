// @ts-nocheck
/**
 * Gate Policy Loader (optional, safe defaults)
 *
 * Loads policy from .verax/gates.policy.json if present.
 * Returns sensible defaults if missing or invalid.
 * No side effects; pure function.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Default gate enforcement policy (no enforcement)
 */
export const DEFAULT_GATE_POLICY = {
  enforcement: {
    enabled: false,
    failOn: ['FAIL'],
    scope: {
      truthStatus: null,
      decisionUsefulness: null
    }
  }
};

/**
 * Validate gate policy shape.
 * Returns true if policy is structurally valid.
 *
 * @param {Object} policy - Policy object to validate
 * @returns {boolean} true if valid, false otherwise
 */
function isValidPolicy(policy) {
  if (!policy || typeof policy !== 'object') return false;

  const e = policy.enforcement;
  if (!e || typeof e !== 'object') return false;

  // enabled must be boolean
  if (typeof e.enabled !== 'boolean') return false;

  // failOn must be array of strings
  if (!Array.isArray(e.failOn)) return false;
  if (!e.failOn.every(v => typeof v === 'string')) return false;

  // scope is optional; if present, must be object
  if (e.scope && typeof e.scope !== 'object') return false;

  return true;
}

/**
 * Load gate policy from .verax/gates.policy.json.
 * Returns DEFAULT_GATE_POLICY if file missing or invalid.
 *
 * @param {string} projectDir - Project directory (where .verax/ lives)
 * @returns {Object} Policy object with enforcement config
 */
export function loadGatePolicy(projectDir = process.cwd()) {
  const policyPath = resolve(projectDir, '.verax', 'gates.policy.json');

  // If file doesn't exist, return defaults
  if (!existsSync(policyPath)) {
    // Safety: missing policy keeps enforcement disabled
    return DEFAULT_GATE_POLICY;
  }

  try {
    const content = readFileSync(policyPath, 'utf-8');
    const parsed = JSON.parse(content);

    // If invalid structure, return defaults
    if (!isValidPolicy(parsed)) {
      return DEFAULT_GATE_POLICY;
    }

    return parsed;
  } catch (err) {
    // On any error (parse, read, etc.), return defaults
    return DEFAULT_GATE_POLICY;
  }
}

/**
 * Check if a finding matches the policy scope.
 * Scope is optional; if not specified, all findings match.
 *
 * @param {Object} scope - Scope object { truthStatus, decisionUsefulness }
 * @param {string} truthStatus - Finding truthStatus
 * @param {string} decisionUsefulness - Finding decisionUsefulness
 * @returns {boolean} true if finding matches scope
 */
export function matchesPolicyScope(scope = {}, truthStatus = null, decisionUsefulness = null) {
  if (!scope) return true;

  // If truthStatus list specified, finding must match
  if (Array.isArray(scope.truthStatus) && scope.truthStatus.length > 0) {
    if (!scope.truthStatus.includes(truthStatus)) {
      return false;
    }
  }

  // If decisionUsefulness list specified, finding must match
  if (Array.isArray(scope.decisionUsefulness) && scope.decisionUsefulness.length > 0) {
    if (!scope.decisionUsefulness.includes(decisionUsefulness)) {
      return false;
    }
  }

  return true;
}
