/**
 * Wave 7 — Flow Specification Parser & Validator
 *
 * Validates and normalizes flow spec JSON.
 * No guessing: explicit selectors, URLs, and step definitions only.
 */

const ALLOWED_STEP_TYPES = ['goto', 'fill', 'click', 'expect'];
const ALLOWED_EXPECT_KINDS = ['selector', 'url', 'route'];

/**
 * Validate and normalize a flow spec.
 *
 * @param {Object} spec - Flow spec object
 * @returns {Object} - Normalized spec
 * @throws {Error} - On validation failure
 */
export function validateFlowSpec(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('Flow spec must be a valid JSON object');
  }

  if (!spec.name || typeof spec.name !== 'string') {
    throw new Error('Flow spec must have a "name" property');
  }

  if (!spec.baseUrl || typeof spec.baseUrl !== 'string') {
    throw new Error('Flow spec must have a "baseUrl" property');
  }

  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    throw new Error('Flow spec must have a "steps" array with at least one step');
  }

  // Validate allowlist
  const allowlist = spec.allowlist || { domains: [], pathsPrefix: ['/'] };
  if (!Array.isArray(allowlist.domains)) {
    allowlist.domains = [];
  }
  if (!Array.isArray(allowlist.pathsPrefix)) {
    allowlist.pathsPrefix = ['/'];
  }


  // Validate steps
  const steps = spec.steps.map((step, idx) => {
    if (!step.type || !ALLOWED_STEP_TYPES.includes(step.type)) {
      throw new Error(`Step ${idx}: type must be one of ${ALLOWED_STEP_TYPES.join(', ')}`);
    }

    if (step.type === 'goto') {
      if (!step.url || typeof step.url !== 'string') {
        throw new Error(`Step ${idx}: goto requires url`);
      }
      return step;
    }

    if (step.type === 'fill') {
      if (!step.selector || typeof step.selector !== 'string') {
        throw new Error(`Step ${idx}: fill requires selector`);
      }
      if (step.value === undefined) {
        throw new Error(`Step ${idx}: fill requires value`);
      }
      return step;
    }

    if (step.type === 'click') {
      if (!step.selector || typeof step.selector !== 'string') {
        throw new Error(`Step ${idx}: click requires selector`);
      }
      return step;
    }

    if (step.type === 'expect') {
      if (!step.kind || !ALLOWED_EXPECT_KINDS.includes(step.kind)) {
        throw new Error(`Step ${idx}: expect requires kind one of ${ALLOWED_EXPECT_KINDS.join(', ')}`);
      }
      if (step.kind === 'selector' && !step.selector) {
        throw new Error(`Step ${idx}: expect selector requires selector`);
      }
      if (step.kind === 'url' && !step.prefix) {
        throw new Error(`Step ${idx}: expect url requires prefix`);
      }
      if (step.kind === 'route' && !step.path) {
        throw new Error(`Step ${idx}: expect route requires path`);
      }
      return step;
    }

    return step;
  });

  return {
    name: spec.name,
    baseUrl: spec.baseUrl,
    allowlist,
    secrets: spec.secrets || {},
    steps
  };
}

/**
 * Resolve environment variable references like $ENV:VERAX_USER_EMAIL.
 * Returns actual value or throws if not found.
 *
 * @param {string} value - String containing $ENV:VARNAME references
 * @returns {string} - Resolved value
 */
export function resolveSecrets(value, _secrets = {}) {
  if (typeof value !== 'string') return value;

  // Replace $ENV:VARNAME with actual env var value
  return value.replace(/\$ENV:([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    const envValue = process.env[varName];
    if (!envValue) {
      throw new Error(`Environment variable not found: ${varName}`);
    }
    return envValue;
  });
}

/**
 * Extract all secret values from a resolved context for redaction.
 *
 * @param {Object} secrets - Map of secret keys to env var names
 * @returns {Set} - Set of actual secret values to redact
 */
export function extractSecretValues(secrets = {}) {
  const values = new Set();
  for (const envVar of Object.values(secrets)) {
    const value = process.env[envVar];
    if (value) {
      values.add(value);
    }
  }
  return values;
}



