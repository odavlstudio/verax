/**
 * Policy Loader (PHASE 5.5)
 *
 * Reads and validates .verax/policy.json for enterprise false-positive control.
 * Evidence-only: policies are explicit user intent, not heuristics.
 * Deterministic: same policy + same artifacts => identical output.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { UsageError, DataError } from '../support/errors.js';

const POLICY_FILE = '.verax/policy.json';
const _SCHEMA_VERSION = 1;

/**
 * Load policy from .verax/policy.json if present
 * @param {string} projectRoot
 * @returns {Object} Validated policy object or null
 */
export function loadPolicy(projectRoot) {
  const policyPath = resolve(projectRoot, POLICY_FILE);
  
  if (!existsSync(policyPath)) {
    return null;
  }

  let raw;
  try {
    const content = String(readFileSync(policyPath, 'utf-8'));
    raw = JSON.parse(content);
  } catch (error) {
    throw new DataError(`Failed to parse ${POLICY_FILE}: ${error.message}`);
  }

  validatePolicy(raw);
  return normalizePolicy(raw);
}

/**
 * Validate policy schema
 * @param {Object} policy
 * @throws {UsageError} if schema invalid
 */
export function validatePolicy(policy) {
  if (typeof policy !== 'object' || policy === null) {
    throw new UsageError('policy must be a JSON object');
  }

  const version = policy.version ?? 1;
  if (typeof version !== 'number' || version !== 1) {
    throw new UsageError(`policy.version must be 1, got: ${version}`);
  }

  // Validate ignore section
  if ('ignore' in policy && typeof policy.ignore === 'object' && policy.ignore !== null) {
    const ignore = policy.ignore;
    
    if ('findingIds' in ignore) {
      if (!Array.isArray(ignore.findingIds)) {
        throw new UsageError('policy.ignore.findingIds must be an array');
      }
      for (const id of ignore.findingIds) {
        if (typeof id !== 'string') {
          throw new UsageError('policy.ignore.findingIds items must be strings');
        }
      }
    }

    if ('types' in ignore) {
      if (!Array.isArray(ignore.types)) {
        throw new UsageError('policy.ignore.types must be an array');
      }
      for (const type of ignore.types) {
        if (typeof type !== 'string') {
          throw new UsageError('policy.ignore.types items must be strings');
        }
      }
    }

    if ('selectorContains' in ignore) {
      if (!Array.isArray(ignore.selectorContains)) {
        throw new UsageError('policy.ignore.selectorContains must be an array');
      }
      for (const sel of ignore.selectorContains) {
        if (typeof sel !== 'string') {
          throw new UsageError('policy.ignore.selectorContains items must be strings');
        }
      }
    }
  }

  // Validate downgrade section
  if ('downgrade' in policy) {
    if (!Array.isArray(policy.downgrade)) {
      throw new UsageError('policy.downgrade must be an array');
    }

    for (let i = 0; i < policy.downgrade.length; i++) {
      const rule = policy.downgrade[i];
      if (typeof rule !== 'object' || rule === null) {
        throw new UsageError(`policy.downgrade[${i}] must be an object`);
      }

      if ('type' in rule && typeof rule.type !== 'string') {
        throw new UsageError(`policy.downgrade[${i}].type must be a string`);
      }

      if ('toStatus' in rule && typeof rule.toStatus !== 'string') {
        throw new UsageError(`policy.downgrade[${i}].toStatus must be a string`);
      }

      if ('reason' in rule && typeof rule.reason !== 'string') {
        throw new UsageError(`policy.downgrade[${i}].reason must be a string`);
      }

      if ('selectorContains' in rule && typeof rule.selectorContains !== 'string') {
        throw new UsageError(`policy.downgrade[${i}].selectorContains must be a string`);
      }
    }
  }
}

/**
 * Normalize policy to guaranteed structure
 * @param {Object} raw
 * @returns {Object} Normalized policy
 */
function normalizePolicy(raw) {
  return {
    version: raw.version ?? 1,
    ignore: {
      findingIds: raw.ignore?.findingIds ?? [],
      types: raw.ignore?.types ?? [],
      selectorContains: raw.ignore?.selectorContains ?? []
    },
    downgrade: raw.downgrade ?? []
  };
}

/**
 * Check if a finding matches any ignore rule
 * @param {Object} finding
 * @param {Object} policy
 * @returns {boolean}
 */
export function isIgnored(finding, policy) {
  if (!policy) return false;
  
  const ignore = policy.ignore || {};

  // Match by finding ID
  if (ignore.findingIds && ignore.findingIds.includes(finding.id)) {
    return true;
  }

  // Match by type
  if (ignore.types && ignore.types.includes(finding.type)) {
    return true;
  }

  // Match by selector substring
  if (ignore.selectorContains && finding.selector) {
    for (const substr of ignore.selectorContains) {
      if (finding.selector.includes(substr)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Find downgrade rule for a finding
 * @param {Object} finding
 * @param {Object} policy
 * @returns {Object|null} Matched downgrade rule or null
 */
export function findDowngradeRule(finding, policy) {
  if (!policy || !policy.downgrade) return null;

  for (const rule of policy.downgrade) {
    let matches = true;

    // Check type match
    if ('type' in rule && rule.type !== finding.type) {
      matches = false;
    }

    // Check selector substring match
    if (matches && 'selectorContains' in rule) {
      if (!finding.selector || !finding.selector.includes(rule.selectorContains)) {
        matches = false;
      }
    }

    if (matches) {
      return rule;
    }
  }

  return null;
}

/**
 * Apply policy to findings (mutates findings with policy metadata)
 * @param {Array} findings
 * @param {Object} policy
 * @returns {Array} Updated findings with policy metadata
 */
export function applyPolicy(findings, policy) {
  if (!findings || !Array.isArray(findings)) {
    return findings;
  }

  return findings.map((finding) => {
    const ignored = isIgnored(finding, policy);
    const downgradeRule = findDowngradeRule(finding, policy);

    const updated = { ...finding };

    if (ignored) {
      updated.suppressed = true;
      updated.policy = {
        suppressed: true,
        downgraded: false,
        rule: { kind: 'ignore' }
      };
    } else if (downgradeRule) {
      updated.suppressed = false;
      updated.downgraded = true;
      updated.status = downgradeRule.toStatus;
      updated.policy = {
        suppressed: false,
        downgraded: true,
        rule: {
          kind: 'downgrade',
          type: downgradeRule.type,
          toStatus: downgradeRule.toStatus,
          reason: downgradeRule.reason,
          selectorContains: downgradeRule.selectorContains
        }
      };
    } else {
      updated.suppressed = false;
      updated.downgraded = false;
    }

    return updated;
  });
}

/**
 * Filter findings to exclude suppressed ones
 * @param {Array} findings
 * @returns {Array} Non-suppressed findings
 */
export function filterSuppressed(findings) {
  if (!findings || !Array.isArray(findings)) {
    return findings;
  }
  return findings.filter(f => !f.suppressed);
}

/**
 * Count non-suppressed findings by severity
 * @param {Array} findings
 * @returns {Object} Counts by severity
 */
export function countNonSuppressedFindings(findings) {
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  
  if (!findings || !Array.isArray(findings)) {
    return counts;
  }

  for (const finding of findings) {
    if (!finding.suppressed) {
      const severity = finding.severity || 'UNKNOWN';
      if (severity in counts) {
        counts[severity] += 1;
      }
    }
  }

  return counts;
}
