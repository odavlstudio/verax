/**
 * Run Manifest
 * 
 * Audit trail for every VERAX run.
 * Contains: version, git state, config hash, policy hash, timestamp.
 * Enables retrospective audit of what rules and policies were active.
 */

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { VERSION } from '../../../version.js';
import { getTimeProvider } from './time-provider.js';

/**
 * Capture git information (if in a git repo)
 */
function getGitInfo() {
  try {
    const commit = execSync('git rev-parse HEAD', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    const dirty = execSync('git status --porcelain', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim().length > 0;

    return {
      commit,
      branch,
      dirty,
    };
  } catch (error) {
    // Not in a git repo, or git not available
    return {
      commit: null,
      branch: null,
      dirty: null,
    };
  }
}

/**
 * Compute hash of configuration object
 */
export function hashConfig(config) {
  const configStr = JSON.stringify(config, Object.keys(config).sort());
  return String(createHash('sha256').update(configStr).digest('hex')).substring(0, 16);
}

/**
 * Compute hash of policy object
 */
export function hashPolicy(policy) {
  const policyStr = JSON.stringify(policy, Object.keys(policy).sort());
  return String(createHash('sha256').update(policyStr).digest('hex')).substring(0, 16);
}

/**
 * Create run manifest with audit information
 * 
 * @param {Object} options
 * @param {string} options.runId - Current run ID
 * @param {string} options.scanId - Parent scan ID
 * @param {Object} options.config - VERAX configuration used
 * @param {Object} options.policy - Enterprise policy used
 * @param {boolean} options.redactionDisabled - Whether redaction was disabled
 * @returns {Object} Run manifest
 */
export function createRunManifest(options) {
  const {
    runId,
    scanId,
    config,
    policy,
    redactionDisabled = false,
  } = options;

  const gitInfo = getGitInfo();
  const timestamp = getTimeProvider().iso();
  const configHash = hashConfig(config);
  const policyHash = hashPolicy(policy);

  return {
    // Identifiers
    version: VERSION,
    runId,
    scanId,
    timestamp,

    // Configuration audit trail
    config: {
      hash: configHash,
      url: config.url,
      src: config.src,
      out: config.out,
      minCoverage: config.minCoverage,
      ciMode: config.ciMode || false,
    },

    // Policy audit trail
    policy: {
      hash: policyHash,
      retention: {
        keepRuns: policy.retention.keepRuns,
        disableRetention: policy.retention.disableRetention,
      },
      redaction: {
        enabled: policy.redaction.enabled,
        disabled: redactionDisabled, // Whether user explicitly disabled it
      },
      coverage: {
        minCoverage: policy.coverage.minCoverage,
      },
      frameworks: {
        allowlist: policy.frameworks.allowlist,
        denylist: policy.frameworks.denylist,
      },
    },

    // Git information (for reproducibility)
    git: gitInfo,

    // Runtime information
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
    },

    // Audit markers
    audit: {
      redactionDisabledExplicitly: redactionDisabled,
    },
  };
}

/**
 * Serialize manifest to JSON
 */
export function manifestToJson(manifest) {
  return JSON.stringify(manifest, null, 2);
}
