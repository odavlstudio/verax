/**
 * Wave 7 — Config File Support
 * 
 * Loads and validates .verax/config.json configuration file.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Default config values
 */
const DEFAULT_CONFIG = {
  defaultUrl: 'http://localhost:3000',
  projectRoot: '.',
  outDir: '.verax/runs',
  ciDefaults: {
    json: true,
    zip: true,
    explain: false
  },
  safety: {
    allowlistDomains: [],
    denyKeywords: ['delete', 'remove', 'billing', 'payment']
  }
};

/**
 * Validate config structure
 * @param {Object} config - Config object to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateConfig(config) {
  const errors = [];
  
  if (typeof config !== 'object' || config === null) {
    errors.push('Config must be an object');
    return { valid: false, errors };
  }
  
  // Validate defaultUrl
  if (config.defaultUrl !== undefined) {
    if (typeof config.defaultUrl !== 'string' || config.defaultUrl.trim() === '') {
      errors.push('defaultUrl must be a non-empty string');
    } else {
      try {
        new URL(config.defaultUrl);
      } catch (e) {
        errors.push(`defaultUrl is not a valid URL: ${config.defaultUrl}`);
      }
    }
  }
  
  // Validate projectRoot
  if (config.projectRoot !== undefined && typeof config.projectRoot !== 'string') {
    errors.push('projectRoot must be a string');
  }
  
  // Validate outDir
  if (config.outDir !== undefined && typeof config.outDir !== 'string') {
    errors.push('outDir must be a string');
  }
  
  // Validate ciDefaults
  if (config.ciDefaults !== undefined) {
    if (typeof config.ciDefaults !== 'object' || config.ciDefaults === null) {
      errors.push('ciDefaults must be an object');
    } else {
      if (config.ciDefaults.json !== undefined && typeof config.ciDefaults.json !== 'boolean') {
        errors.push('ciDefaults.json must be a boolean');
      }
      if (config.ciDefaults.zip !== undefined && typeof config.ciDefaults.zip !== 'boolean') {
        errors.push('ciDefaults.zip must be a boolean');
      }
      if (config.ciDefaults.explain !== undefined && typeof config.ciDefaults.explain !== 'boolean') {
        errors.push('ciDefaults.explain must be a boolean');
      }
    }
  }
  
  // Validate safety
  if (config.safety !== undefined) {
    if (typeof config.safety !== 'object' || config.safety === null) {
      errors.push('safety must be an object');
    } else {
      if (config.safety.allowlistDomains !== undefined) {
        if (!Array.isArray(config.safety.allowlistDomains)) {
          errors.push('safety.allowlistDomains must be an array');
        } else {
          for (const domain of config.safety.allowlistDomains) {
            if (typeof domain !== 'string') {
              errors.push('safety.allowlistDomains must contain only strings');
              break;
            }
          }
        }
      }
      if (config.safety.denyKeywords !== undefined) {
        if (!Array.isArray(config.safety.denyKeywords)) {
          errors.push('safety.denyKeywords must be an array');
        } else {
          for (const keyword of config.safety.denyKeywords) {
            if (typeof keyword !== 'string') {
              errors.push('safety.denyKeywords must contain only strings');
              break;
            }
          }
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Load config file from project directory
 * @param {string} projectRoot - Project root directory
 * @returns {Object|null} Config object or null if not found
 * @throws {Error} If config file exists but is invalid
 */
export function loadConfig(projectRoot) {
  const configPath = resolve(projectRoot, '.verax', 'config.json');
  
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    
    const validation = validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid config file: ${validation.errors.join(', ')}`);
    }
    
    // Merge with defaults
    return {
      ...DEFAULT_CONFIG,
      ...config,
      ciDefaults: {
        ...DEFAULT_CONFIG.ciDefaults,
        ...(config.ciDefaults || {})
      },
      safety: {
        ...DEFAULT_CONFIG.safety,
        ...(config.safety || {})
      }
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Config file is not valid JSON: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get default config (for init)
 * @returns {Object} Default config object
 */
export function getDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

