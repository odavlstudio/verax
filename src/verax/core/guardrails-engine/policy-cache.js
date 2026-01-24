/**
 * Internal: Cached guardrails policy access
 */

import { loadGuardrailsPolicy } from '../guardrails/policy.loader.js';

let cachedPolicy = null;

export function getGuardrailsPolicy(policyPath = null, projectDir = null) {
  if (!cachedPolicy) {
    cachedPolicy = loadGuardrailsPolicy(policyPath, projectDir);
  }
  return cachedPolicy;
}
