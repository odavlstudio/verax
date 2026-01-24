/**
 * PHASE 5: DETERMINISTIC RUN IDENTIFICATION
 * 
 * Generates stable, deterministic runId based on run parameters (NOT timestamps).
 * Provides utilities for artifact path resolution.
 */

import { createHash } from 'crypto';
import { join } from 'path';
import { readFileSync } from 'fs';
import { VERSION } from '../../version.js';

/**
 * Get VERAX version from package.json
 */
export function getVeraxVersion() {
  return VERSION;
}

/**
 * Generate deterministic runId from run parameters
 * 
 * CRITICAL: NO timestamps, NO random values
 * Hash must be identical for identical inputs
 * 
 * @param {Object} params - Run parameters
 * @param {string} params.url - Target URL
 * @param {Object} params.safetyFlags - Safety flags (allowRiskyActions, allowCrossOrigin)
 * @param {string} params.baseOrigin - Base origin
 * @param {Object} params.scanBudget - Scan budget configuration
 * @param {string} params.manifestPath - Optional manifest path
 * @returns {string} Deterministic runId (hex hash)
 */
export function generateRunId(params) {
  const { url, safetyFlags = {}, baseOrigin, scanBudget, manifestPath = null } = params;
  
  // Sort flags deterministically (allowWrites permanently false - constitutional)
  const sortedFlags = {
    allowCrossOrigin: safetyFlags.allowCrossOrigin || false,
    allowRiskyActions: safetyFlags.allowRiskyActions || false,
    allowWrites: false  // CONSTITUTIONAL: Always false (read-only mode)
  };
  
  // Create deterministic representation
  const runConfig = {
    url,
    flags: sortedFlags,
    baseOrigin,
    budget: {
      maxScanDurationMs: scanBudget.maxScanDurationMs,
      maxInteractionsPerPage: scanBudget.maxInteractionsPerPage,
      maxUniqueUrls: scanBudget.maxUniqueUrls,
      interactionTimeoutMs: scanBudget.interactionTimeoutMs,
      navigationTimeoutMs: scanBudget.navigationTimeoutMs
    },
    manifestPath,
    veraxVersion: getVeraxVersion()
  };
  
  // Generate stable hash
  // Sort keys at all levels for deterministic serialization
  const configString = JSON.stringify(runConfig, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort((a, b) => a.localeCompare(b, 'en')).reduce((sorted, k) => {
        sorted[k] = value[k];
        return sorted;
      }, {});
    }
    return value;
  });
  const hash = createHash('sha256').update(configString).digest('hex');
  
  // Return first 16 chars for readability (still collision-resistant)
  // @ts-expect-error - digest returns string
  return hash.substring(0, 16);
}

/**
 * Get artifact directory for a run
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run identifier
 * @returns {string} Absolute path to run artifact directory
 */
export function getRunArtifactDir(projectDir, runId) {
  return join(projectDir, '.verax', 'runs', runId);
}

/**
 * Get artifact file path
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run identifier
 * @param {string} artifactName - Artifact filename (e.g., 'traces.json', 'findings.json')
 * @returns {string} Absolute path to artifact file
 */
export function getArtifactPath(projectDir, runId, artifactName) {
  return join(getRunArtifactDir(projectDir, runId), artifactName);
}

/**
 * Get screenshot directory path
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run identifier
 * @returns {string} Absolute path to screenshots directory
 */
export function getScreenshotDir(projectDir, runId) {
  return join(getRunArtifactDir(projectDir, runId), 'evidence', 'screenshots');
}

/**
 * Get all expected artifact paths for a run
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run identifier
 * @returns {Object} Map of artifact names to paths
 */
export function getExpectedArtifacts(projectDir, runId) {
  const runDir = getRunArtifactDir(projectDir, runId);
  return {
    runManifest: join(runDir, 'run-manifest.json'),
    manifest: join(runDir, 'manifest.json'),
    traces: join(runDir, 'traces.json'),
    findings: join(runDir, 'findings.json'),
    silences: join(runDir, 'silences.json'),
    screenshotDir: join(runDir, 'evidence', 'screenshots')
  };
}

/**
 * Compute SHA256 hash of a file
 * 
 * @param {string} filePath - Path to file
 * @returns {string} Hex hash
 */
export function computeFileHash(filePath) {
  try {
    const content = readFileSync(filePath);
    // @ts-expect-error - digest returns string
    return createHash('sha256').update(content).digest('hex');
  } catch (error) {
    return null;
  }
}

/**
 * Compute hashes for all artifacts in a run
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run identifier
 * @returns {Object} Map of artifact names to hashes
 */
export function computeArtifactHashes(projectDir, runId) {
  const artifacts = getExpectedArtifacts(projectDir, runId);
  const hashes = {};
  
  for (const [name, path] of Object.entries(artifacts)) {
    if (name === 'screenshotDir') continue; // Directory, not file
    const hash = computeFileHash(path);
    if (hash) {
      hashes[name] = hash;
    }
  }
  
  return hashes;
}



