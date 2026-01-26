/**
 * Enterprise Policy Configuration
 * 
 * Centralized configuration for enterprise governance controls.
 * Supports multiple sources: CLI args, environment variables, policy file.
 * Validation enforces safe defaults and prevents misconfiguration.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, extname } from 'path';
import YAML from 'yaml';

/**
 * Default enterprise policy (safe, conservative defaults)
 */
export const DEFAULT_ENTERPRISE_POLICY = {
  retention: {
    keepRuns: 10,                              // Keep last 10 runs
    disableRetention: false,                   // Retention is ON by default
  },
  redaction: {
    enabled: true,                             // Redaction is ON by default
    requireExplicitOptOut: true,               // Must explicitly opt out
  },
  coverage: {
    minCoverage: 0.6,                          // 60% minimum coverage required
  },
  frameworks: {
    allowlist: null,                           // null = allow all supported frameworks
    denylist: [],                              // Empty = no frameworks denied
  },
  audit: {
    recordManifest: true,                      // Always record run manifest
  },
};

/**
 * Load and validate enterprise policy from multiple sources.
 * Priority: CLI args > env vars > policy file > defaults
 * 
 * @param {{
 *   policyFile?: string;
 *   retainRuns?: number;
 *   disableRetention?: boolean;
 *   disableRedaction?: boolean;
 *   minCoverage?: number;
 *   frameworkAllowlist?: string;
 *   frameworkDenylist?: string;
 * }} cliArgs - Parsed CLI arguments
 * @returns {Object} Validated policy object
 * @throws {UsageError} If policy is invalid
 */
export function loadEnterprisePolicy(cliArgs = /** @type {const} */ ({})) {
  const policy = { ...DEFAULT_ENTERPRISE_POLICY };

  // 1. Load from policy file if provided
  if (cliArgs.policyFile) {
    const filePath = resolve(cliArgs.policyFile);
    if (!existsSync(filePath)) {
      throw new Error(`USAGE_ERROR: Policy file not found: ${filePath}`);
    }

    const filePolicy = parsePolicyFile(filePath);
    deepMerge(policy, filePolicy);
  }

  // 2. Apply environment variables
  if (process.env.VERAX_POLICY_RETAIN_RUNS) {
    const val = parseInt(process.env.VERAX_POLICY_RETAIN_RUNS, 10);
    if (isNaN(val) || val < 0) {
      throw new Error(
        `USAGE_ERROR: VERAX_POLICY_RETAIN_RUNS must be non-negative integer, got: ${process.env.VERAX_POLICY_RETAIN_RUNS}`
      );
    }
    policy.retention.keepRuns = val;
  }

  if (process.env.VERAX_POLICY_DISABLE_RETENTION === 'true') {
    policy.retention.disableRetention = true;
  }

  if (process.env.VERAX_POLICY_DISABLE_REDACTION === 'true') {
    policy.redaction.enabled = false;
  }

  if (process.env.VERAX_POLICY_MIN_COVERAGE) {
    const val = parseFloat(process.env.VERAX_POLICY_MIN_COVERAGE);
    if (isNaN(val) || val < 0 || val > 1) {
      throw new Error(
        `USAGE_ERROR: VERAX_POLICY_MIN_COVERAGE must be between 0 and 1, got: ${process.env.VERAX_POLICY_MIN_COVERAGE}`
      );
    }
    policy.coverage.minCoverage = val;
  }

  // 3. Apply CLI arguments (highest priority)
  if (cliArgs.retainRuns !== undefined) {
    if (typeof cliArgs.retainRuns !== 'number' || cliArgs.retainRuns < 0) {
      throw new Error(
        `USAGE_ERROR: --retain-runs must be non-negative integer, got: ${cliArgs.retainRuns}`
      );
    }
    policy.retention.keepRuns = cliArgs.retainRuns;
  }

  if (cliArgs.disableRetention === true) {
    policy.retention.disableRetention = true;
  }

  if (cliArgs.disableRedaction === true) {
    policy.redaction.enabled = false;
  }

  if (cliArgs.minCoverage !== undefined) {
    if (typeof cliArgs.minCoverage !== 'number' || cliArgs.minCoverage < 0 || cliArgs.minCoverage > 1) {
      throw new Error(
        `USAGE_ERROR: --min-coverage must be between 0 and 1, got: ${cliArgs.minCoverage}`
      );
    }
    policy.coverage.minCoverage = cliArgs.minCoverage;
  }

  if (cliArgs.frameworkAllowlist) {
    policy.frameworks.allowlist = parseFrameworkList(cliArgs.frameworkAllowlist);
  }

  if (cliArgs.frameworkDenylist) {
    policy.frameworks.denylist = parseFrameworkList(cliArgs.frameworkDenylist);
  }

  // Validate policy consistency
  validatePolicy(policy);

  return policy;
}

/**
 * Parse a policy file (YAML or JSON)
 * @param {string} filePath - Path to policy file
 * @returns {Object} Parsed policy
 */
function parsePolicyFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  const content = String(readFileSync(filePath, 'utf-8'));

  try {
    if (ext === '.json') {
      return JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      return YAML.parse(content);
    } else {
      throw new Error(`Unsupported policy file format: ${ext}. Use .json or .yaml`);
    }
  } catch (error) {
    throw new Error(`Failed to parse policy file: ${error.message}`);
  }
}

/**
 * Parse comma-separated framework list
 */
function parseFrameworkList(str) {
  return str
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);
}

/**
 * Validate policy for consistency and constraints
 */
function validatePolicy(policy) {
  // Validate retention settings
  if (typeof policy.retention.keepRuns !== 'number' || policy.retention.keepRuns < 0) {
    throw new Error(
      `USAGE_ERROR: retention.keepRuns must be non-negative integer, got: ${policy.retention.keepRuns}`
    );
  }

  // Validate coverage
  if (typeof policy.coverage.minCoverage !== 'number' || policy.coverage.minCoverage < 0 || policy.coverage.minCoverage > 1) {
    throw new Error(
      `USAGE_ERROR: coverage.minCoverage must be between 0 and 1, got: ${policy.coverage.minCoverage}`
    );
  }

  // Validate framework lists
  if (policy.frameworks.allowlist && !Array.isArray(policy.frameworks.allowlist)) {
    throw new Error(`USAGE_ERROR: frameworks.allowlist must be array or null`);
  }
  if (!Array.isArray(policy.frameworks.denylist)) {
    throw new Error(`USAGE_ERROR: frameworks.denylist must be array`);
  }

  // Check for conflicting allowlist/denylist
  if (policy.frameworks.allowlist && policy.frameworks.denylist.length > 0) {
    const overlap = policy.frameworks.allowlist.filter(f => policy.frameworks.denylist.includes(f));
    if (overlap.length > 0) {
      throw new Error(
        `USAGE_ERROR: Framework(s) cannot be both allowlisted and denylisted: ${overlap.join(', ')}`
      );
    }
  }
}

/**
 * Deep merge objects (for combining policy sources)
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      if (typeof target[key] !== 'object' || target[key] === null) {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

/**
 * Get a policy hash for audit trail (simple sha256)
 */
export async function getPolicyHash(policy) {
  const crypto = await import('crypto');
  const policyStr = JSON.stringify(policy, Object.keys(policy).sort());
  return crypto.createHash('sha256').update(policyStr).digest('hex');
}

/**
 * Check if redaction is disabled (requires warning)
 */
export function isRedactionDisabled(policy) {
  return policy.redaction.enabled === false;
}

/**
 * Get framework allowlist (null = all supported, array = specific list)
 */
export function getFrameworkAllowlist(policy) {
  return policy.frameworks.allowlist;
}

/**
 * Check if framework is allowed by policy
 */
export function isFrameworkAllowed(policy, framework) {
  const allowlist = getFrameworkAllowlist(policy);
  const denylist = policy.frameworks.denylist || [];

  // If on denylist, definitely not allowed
  if (denylist.includes(framework.toLowerCase())) {
    return false;
  }

  // If allowlist is null, all supported frameworks are allowed
  if (allowlist === null) {
    return true;
  }

  // If allowlist is specified, must be in it
  return allowlist.includes(framework.toLowerCase());
}
