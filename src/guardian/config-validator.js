/**
 * CONFIG SCHEMA VALIDATOR
 * 
 * Validates guardian.config.json against strict schema.
 * Provides clear error messages when config is invalid.
 */

const fs = require('fs');
const path = require('path');

// SCHEMA: Strict definition of valid config structure
const CONFIG_SCHEMA = {
  crawl: {
    type: 'object',
    properties: {
      maxPages: { type: 'number', min: 1, max: 1000 },
      maxDepth: { type: 'number', min: 1, max: 10 },
      timeout: { type: 'number', min: 1000, max: 180000 }
    },
    additionalProperties: false
  },
  timeouts: {
    type: 'object',
    properties: {
      navigationMs: { type: 'number', min: 5000, max: 180000 },
      attemptMs: { type: 'number', min: 5000, max: 300000 }
    },
    additionalProperties: false
  },
  output: {
    type: 'object',
    properties: {
      dir: { type: 'string', minLength: 1 }
    },
    additionalProperties: false
  },
  media: {
    type: 'object',
    properties: {
      screenshots: { type: 'boolean' },
      traces: { type: 'boolean' },
      video: { type: 'boolean' }
    },
    additionalProperties: false
  },
  preset: {
    type: 'string',
    enum: ['startup', 'custom', 'landing', 'full']
  },
  headful: {
    type: 'boolean'
  },
  fast: {
    type: 'boolean'
  }
};

// ALLOWED TOP-LEVEL KEYS
const ALLOWED_KEYS = Object.keys(CONFIG_SCHEMA);

/**
 * Validate a single config value against its schema definition
 * @param {*} value - Value to validate
 * @param {object} schema - Schema definition for this value
 * @param {string} path - Path to this value (for error messages)
 * @returns {string|null} Error message if invalid, null if valid
 */
function validateValue(value, schema, valuePath) {
  // Type check
  if (schema.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== schema.type) {
      return `${valuePath}: expected ${schema.type}, got ${actualType}`;
    }
  }

  // Enum check
  if (schema.enum && !schema.enum.includes(value)) {
    return `${valuePath}: must be one of [${schema.enum.join(', ')}], got "${value}"`;
  }

  // Numeric constraints
  if (schema.type === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      return `${valuePath}: must be >= ${schema.min}, got ${value}`;
    }
    if (schema.max !== undefined && value > schema.max) {
      return `${valuePath}: must be <= ${schema.max}, got ${value}`;
    }
  }

  // String constraints
  if (schema.type === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      return `${valuePath}: must have at least ${schema.minLength} characters`;
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      return `${valuePath}: must have at most ${schema.maxLength} characters`;
    }
  }

  return null;
}

/**
 * Validate entire config object
 * @param {object} config - Config object to validate
 * @returns {object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateConfig(config) {
  const errors = [];
  const warnings = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {
      valid: false,
      errors: ['Config must be an object'],
      warnings: []
    };
  }

  // Check for unknown keys
  for (const key of Object.keys(config)) {
    if (!ALLOWED_KEYS.includes(key)) {
      errors.push(`Unknown config key: "${key}". Allowed keys: ${ALLOWED_KEYS.join(', ')}`);
    }
  }

  // Validate each section
  for (const key of ALLOWED_KEYS) {
    const value = config[key];
    const schemaEntry = CONFIG_SCHEMA[key];

    if (value === undefined) {
      continue; // Optional
    }

    if (schemaEntry.type === 'object') {
      // Validate nested object
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${key}: expected object, got ${typeof value}`);
        continue;
      }

      // Check for unknown nested keys
      for (const nestedKey of Object.keys(value)) {
        if (!schemaEntry.properties || !schemaEntry.properties[nestedKey]) {
          if (schemaEntry.additionalProperties === false) {
            errors.push(`${key}.${nestedKey}: unknown property (additional properties not allowed)`);
          } else {
            warnings.push(`${key}.${nestedKey}: unknown property (will be ignored)`);
          }
          continue;
        }

        const nestedSchema = schemaEntry.properties[nestedKey];
        const error = validateValue(value[nestedKey], nestedSchema, `${key}.${nestedKey}`);
        if (error) {
          errors.push(error);
        }
      }
    } else {
      // Validate simple value
      const error = validateValue(value, schemaEntry, key);
      if (error) {
        errors.push(error);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Load and validate guardian.config.json from disk
 * @param {string} projectRoot - Project root directory
 * @returns {object} { valid: boolean, config: object|null, errors: string[], warnings: string[] }
 */
function loadAndValidateConfig(projectRoot) {
  const configPath = path.join(projectRoot, 'guardian.config.json');

  // File doesn't exist - not an error, just use defaults
  if (!fs.existsSync(configPath)) {
    return {
      valid: true,
      config: null,
      errors: [],
      warnings: [],
      source: 'defaults (no guardian.config.json found)'
    };
  }

  // Read file
  let configText;
  try {
    configText = fs.readFileSync(configPath, 'utf-8');
  } catch (err) {
    return {
      valid: false,
      config: null,
      errors: [`Cannot read guardian.config.json: ${err.message}`],
      warnings: [],
      source: configPath
    };
  }

  // Parse JSON
  let configObject;
  try {
    configObject = JSON.parse(configText);
  } catch (err) {
    return {
      valid: false,
      config: null,
      errors: [`Invalid JSON in guardian.config.json: ${err.message}`],
      warnings: [],
      source: configPath
    };
  }

  // Validate against schema
  const validation = validateConfig(configObject);

  return {
    valid: validation.valid,
    config: validation.valid ? configObject : null,
    errors: validation.errors,
    warnings: validation.warnings,
    source: configPath
  };
}

/**
 * Print validation errors and warnings in user-friendly format
 * @param {object} validation - Result from loadAndValidateConfig
 */
function reportConfigIssues(validation) {
  if (validation.warnings && validation.warnings.length > 0) {
    console.warn('\n⚠️  Config Warnings:');
    validation.warnings.forEach(w => console.warn(`  - ${w}`));
  }

  if (validation.errors && validation.errors.length > 0) {
    console.error('\n❌ Config Errors:');
    validation.errors.forEach(e => console.error(`  - ${e}`));
    console.error('\nSource:', validation.source);
    console.error('\nFix your guardian.config.json and try again.');
    console.error('\nAllowed properties:', ALLOWED_KEYS.join(', '));
  }
}

/**
 * Get default config (when no guardian.config.json exists)
 * @returns {object} Default config values
 */
function getDefaultConfig() {
  const os = require('os');
  const path = require('path');
  return {
    crawl: {
      maxPages: 10,
      maxDepth: 2
    },
    timeouts: {
      navigationMs: 20000
    },
    output: {
      dir: path.join(os.tmpdir(), 'odavl-guardian')
    }
  };
}

module.exports = {
  CONFIG_SCHEMA,
  ALLOWED_KEYS,
  validateConfig,
  loadAndValidateConfig,
  reportConfigIssues,
  getDefaultConfig,
  validateValue
};
