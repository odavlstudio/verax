/**
 * PHASE 25 — Run Fingerprint
 * 
 * Computes stable run fingerprint from deterministic inputs.
 * Used to verify that repeated runs have identical inputs.
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname as _dirname, relative } from 'path';
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
  const configString = JSON.stringify(
    fingerprintInput,
    Object.keys(fingerprintInput).sort((a, b) => a.localeCompare(b, 'en'))
  );
  const hash = createHash('sha256').update(configString).digest('hex');
  
  // @ts-expect-error - digest returns string
  return hash.substring(0, 32); // 32 chars for readability
}

/**
 * Compute source hash (hash of all source files in project)
 */
function computeSourceHash(projectDir) {
  try {
    const root = resolve(projectDir);
    const hash = createHash('sha256');

    const ignored = new Set([
      'node_modules',
      '.git',
      '.verax',
      'artifacts',
      'dist',
      'build',
      'coverage',
      'tmp',
      'temp',
      '.cache',
      '.turbo',
    ]);

    const stack = [root];

    while (stack.length > 0) {
      const current = stack.pop();
      const entries = readdirSync(current, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name, 'en'));

      for (const entry of entries) {
        if (ignored.has(entry.name)) continue;

        const fullPath = resolve(current, entry.name);

        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }

        if (entry.isFile()) {
          const relPath = relative(root, fullPath).split('\\').join('/');
          const content = readFileSync(fullPath);
          hash.update(relPath);
          hash.update(content);
        }
      }
    }

    const digest = hash.digest('hex');
    return digest.substring(0, 16);
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




