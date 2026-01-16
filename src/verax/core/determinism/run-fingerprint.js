/**
 * PHASE 25 — Run Fingerprint
 * 
 * Computes stable run fingerprint from deterministic inputs.
 * Used to verify that repeated runs have identical inputs.
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname as _dirname } from 'path';
import { getVeraxVersion } from '../run-id.js';

/**
 * Compute run fingerprint from deterministic inputs
 * 
 * @param {Object} params - Run parameters
 * @param {string} params.url - Target URL
 * @param {string} params.projectDir - Project directory
 * @param {string} params.manifestPath - Manifest path (optional)
 * @param {Object} params.policyHash - Policy hash (optional)
 * @param {string} params.fixtureId - Fixture ID (optional)
 * @returns {string} Run fingerprint (hex hash)
 */
export function computeRunFingerprint(params) {
  const {
    url,
    projectDir,
    // @ts-expect-error - Private field documented but not in type
    _manifestPath = null,
    policyHash = null,
    fixtureId = null
  } = params;
  
  // Compute source hash (hash of all source files)
  const srcHash = computeSourceHash(projectDir);
  
  // Compute policy hash if not provided
  const computedPolicyHash = policyHash || computePolicyHash(projectDir);
  
  // Get VERAX version
  const veraxVersion = getVeraxVersion();
  
  // Build fingerprint input
  const fingerprintInput = {
    url: normalizeUrl(url),
    srcHash,
    policyHash: computedPolicyHash,
    veraxVersion,
    fixtureId: fixtureId || null
  };
  
  // Generate stable hash
  const configString = JSON.stringify(fingerprintInput, Object.keys(fingerprintInput).sort());
  const hash = createHash('sha256').update(configString).digest('hex');
  
  // @ts-expect-error - digest returns string
  return hash.substring(0, 32); // 32 chars for readability
}

/**
 * Compute source hash (hash of all source files in project)
 */
function computeSourceHash(projectDir) {
  try {
    // For now, use a simple approach: hash package.json + src directory structure
    // In production, this should hash all source files
    const packagePath = resolve(projectDir, 'package.json');
    if (existsSync(packagePath)) {
      const pkgContent = readFileSync(packagePath, 'utf-8');
      // @ts-expect-error - digest returns string
      return createHash('sha256').update(pkgContent).digest('hex').substring(0, 16);
    }
    return 'no-source';
  } catch {
    return 'unknown';
  }
}

/**
 * Compute policy hash (hash of guardrails/confidence policies)
 */
function computePolicyHash(projectDir) {
  try {
    // Hash default policies (in production, should hash all policy files)
    const policyPaths = [
      resolve(projectDir, '.verax', 'guardrails.policy.json'),
      resolve(projectDir, '.verax', 'confidence.policy.json')
    ];
    
    const hashes = [];
    for (const path of policyPaths) {
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8');
        // @ts-expect-error - digest returns string
        hashes.push(createHash('sha256').update(content).digest('hex').substring(0, 8));
      }
    }
    
    if (hashes.length > 0) {
      // @ts-expect-error - digest returns string
      return createHash('sha256').update(hashes.join('|')).digest('hex').substring(0, 16);
    }
    
    return 'default-policy';
  } catch {
    return 'unknown-policy';
  }
}

/**
 * Normalize URL for fingerprint
 */
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const urlObj = new URL(url);
    // Normalize: remove trailing slash, lowercase host
    return `${urlObj.protocol}//${urlObj.host.toLowerCase()}${urlObj.pathname.replace(/\/$/, '') || '/'}`;
  } catch {
    return url;
  }
}

