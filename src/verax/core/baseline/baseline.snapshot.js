/**
 * PHASE 21.11 — Immutable Baseline Snapshot
 * 
 * Creates a snapshot of all core contracts, policies, and criteria.
 * Any drift from this baseline after GA is BLOCKING.
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { VERAX_PRODUCT_DEFINITION } from '../product-definition.js';

/**
 * Compute SHA256 hash of content
 */
function hashContent(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Load and hash a file
 */
function hashFile(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const content = readFileSync(filePath, 'utf-8');
    return hashContent(content);
  } catch {
    return null;
  }
}

/**
 * Get git commit hash
 */
function getGitCommit() {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Check if git repo is dirty
 */
function isGitDirty() {
  try {
    const { execSync } = require('child_process');
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get VERAX version
 */
function getVeraxVersion() {
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Build baseline snapshot
 * 
 * @param {string} projectDir - Project directory
 * @returns {Object} Baseline snapshot
 */
export function buildBaselineSnapshot(projectDir) {
  const coreDir = resolve(projectDir, 'src', 'verax', 'core');
  
  // Core contracts
  const evidenceLaw = hashContent(JSON.stringify(VERAX_PRODUCT_DEFINITION.evidenceLaw));
  const productDefinition = hashFile(resolve(coreDir, 'product-definition.js'));
  
  // Confidence defaults
  const confidenceEngine = hashFile(resolve(coreDir, 'confidence-engine.js'));
  const confidenceDefaults = hashFile(resolve(coreDir, 'confidence-engine-refactor.js'));
  
  // Guardrails defaults
  const guardrailsDefaults = hashFile(resolve(coreDir, 'guardrails', 'defaults.json'));
  const guardrailsContract = hashFile(resolve(coreDir, 'guardrails', 'contract.js'));
  
  // GA criteria
  const gaContract = hashFile(resolve(coreDir, 'ga', 'ga.contract.js'));
  
  // Performance budgets
  const perfContract = hashFile(resolve(coreDir, 'perf', 'perf.contract.js'));
  const perfProfiles = hashFile(resolve(projectDir, 'src', 'verax', 'shared', 'budget-profiles.js'));
  
  // Security policies
  const supplychainPolicy = hashFile(resolve(coreDir, 'security', 'supplychain.policy.js'));
  const supplychainDefaults = hashFile(resolve(coreDir, 'security', 'supplychain.defaults.json'));
  
  // Failure taxonomy
  const failureTypes = hashFile(resolve(coreDir, 'failures', 'failure.types.js'));
  const failureLedger = hashFile(resolve(coreDir, 'failures', 'failure.ledger.js'));
  
  // Contracts
  const contractsIndex = hashFile(resolve(coreDir, 'contracts', 'index.js'));
  const contractsValidators = hashFile(resolve(coreDir, 'contracts', 'validators.js'));
  const contractsTypes = hashFile(resolve(coreDir, 'contracts', 'types.js'));
  
  // Determinism
  const determinismContract = hashFile(resolve(coreDir, 'determinism', 'contract.js'));
  
  // Evidence builder
  const evidenceBuilder = hashFile(resolve(coreDir, 'evidence-builder.js'));
  
  const snapshot = {
    version: 1,
    timestamp: new Date().toISOString(),
    veraxVersion: getVeraxVersion(),
    gitCommit: getGitCommit(),
    gitDirty: isGitDirty(),
    
    hashes: {
      // Core contracts
      evidenceLaw,
      productDefinition,
      
      // Confidence
      confidenceEngine,
      confidenceDefaults,
      
      // Guardrails
      guardrailsDefaults,
      guardrailsContract,
      
      // GA
      gaContract,
      
      // Performance
      perfContract,
      perfProfiles,
      
      // Security
      supplychainPolicy,
      supplychainDefaults,
      
      // Failures
      failureTypes,
      failureLedger,
      
      // Contracts
      contractsIndex,
      contractsValidators,
      contractsTypes,
      
      // Determinism
      determinismContract,
      
      // Evidence
      evidenceBuilder
    },
    
    // Combined hash for quick comparison
    baselineHash: hashContent(JSON.stringify({
      evidenceLaw,
      productDefinition,
      confidenceEngine,
      confidenceDefaults,
      guardrailsDefaults,
      guardrailsContract,
      gaContract,
      perfContract,
      perfProfiles,
      supplychainPolicy,
      supplychainDefaults,
      failureTypes,
      failureLedger,
      contractsIndex,
      contractsValidators,
      contractsTypes,
      determinismContract,
      evidenceBuilder
    }))
  };
  
  return snapshot;
}

/**
 * Write baseline snapshot to file
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} snapshot - Baseline snapshot
 * @param {boolean} gaStatus - GA status
 * @returns {string} Path to written file
 */
export function writeBaselineSnapshot(projectDir, snapshot, gaStatus = false) {
  const snapshotWithGA = {
    ...snapshot,
    gaStatus: gaStatus ? 'GA-READY' : 'PRE-GA',
    frozen: gaStatus // After GA, baseline is frozen
  };
  
  const outputPath = resolve(projectDir, 'baseline.snapshot.json');
  writeFileSync(outputPath, JSON.stringify(snapshotWithGA, null, 2), 'utf-8');
  return outputPath;
}

/**
 * Load baseline snapshot from file
 * 
 * @param {string} projectDir - Project directory
 * @returns {Object|null} Baseline snapshot or null
 */
export function loadBaselineSnapshot(projectDir) {
  const snapshotPath = resolve(projectDir, 'baseline.snapshot.json');
  
  if (!existsSync(snapshotPath)) {
    return null;
  }
  
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(readFileSync(snapshotPath, 'utf-8'));
  } catch {
    return null;
  }
}

