/**
 * PHASE 21.7 — Reproducibility Check
 * 
 * Verifies that same commit + same policies = same hashes.
 * Difference = NON_REPRODUCIBLE (BLOCKING for GA).
 */

import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

import { resolve } from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';

/**
 * Get current git commit
 * 
 * @param {string} projectDir - Project directory
 * @returns {string|null} Commit hash or null
 */
function getGitCommit(projectDir) {
  try {
    const result = execSync('git rev-parse HEAD', { 
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Get policy hashes
 * 
 * @param {string} projectDir - Project directory
 * @returns {Promise<Object>} Policy hashes
 */
async function getPolicyHashes(projectDir) {
  try {
    const { loadGuardrailsPolicy } = await import('../guardrails/policy.loader.js');
    const { loadConfidencePolicy } = await import('../confidence/confidence.loader.js');
    
    const guardrails = loadGuardrailsPolicy(null, projectDir);
    const confidence = loadConfidencePolicy(null, projectDir);
    
    const guardrailsHash = createHash('sha256')
      .update(JSON.stringify(guardrails, null, 0))
      .digest('hex');
    
    const confidenceHash = createHash('sha256')
      .update(JSON.stringify(confidence, null, 0))
      .digest('hex');
    
    return {
      guardrails: guardrailsHash,
      confidence: confidenceHash
    };
  } catch {
    return {
      guardrails: null,
      confidence: null
    };
  }
}

/**
 * Get artifact hashes
 * 
 * @param {string} projectDir - Project directory
 * @returns {Object} Artifact hashes
 */
function getArtifactHashes(projectDir) {
  const hashes = {};
  
  // Hash key files
  const keyFiles = [
    'package.json',
    'bin/verax.js',
    'src/cli/entry.js'
  ];
  
  for (const file of keyFiles) {
    const filePath = resolve(projectDir, file);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath);
        hashes[file] = createHash('sha256').update(content).digest('hex');
      } catch {
        hashes[file] = null;
      }
    } else {
      hashes[file] = null;
    }
  }
  
  return hashes;
}

/**
 * Load previous reproducibility report
 * 
 * @param {string} projectDir - Project directory
 * @returns {Object|null} Previous report or null
 */
function loadPreviousReport(projectDir) {
  const reportPath = resolve(projectDir, 'release', 'reproducibility.report.json');
  if (!existsSync(reportPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(reportPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Check reproducibility
 * 
 * @param {string} projectDir - Project directory
 * @returns {Promise<Object>} Reproducibility check result
 */
export async function checkReproducibility(projectDir) {
  const gitCommit = getGitCommit(projectDir);
  const policyHashes = await getPolicyHashes(projectDir);
  const artifactHashes = getArtifactHashes(projectDir);
  
  const current = {
    gitCommit,
    policies: policyHashes,
    artifacts: artifactHashes,
    checkedAt: getTimeProvider().iso()
  };
  
  const previous = loadPreviousReport(projectDir);
  
  let reproducible = true;
  const differences = [];
  
  if (previous) {
    // Compare with previous build
    if (previous.gitCommit !== gitCommit) {
      reproducible = false;
      differences.push({
        type: 'git_commit',
        previous: previous.gitCommit,
        current: gitCommit,
        message: 'Git commit changed'
      });
    }
    
    if (previous.policies?.guardrails !== policyHashes.guardrails) {
      reproducible = false;
      differences.push({
        type: 'guardrails_policy',
        previous: previous.policies?.guardrails,
        current: policyHashes.guardrails,
        message: 'Guardrails policy changed'
      });
    }
    
    if (previous.policies?.confidence !== policyHashes.confidence) {
      reproducible = false;
      differences.push({
        type: 'confidence_policy',
        previous: previous.policies?.confidence,
        current: policyHashes.confidence,
        message: 'Confidence policy changed'
      });
    }
    
    // Compare artifact hashes
    for (const [file, hash] of Object.entries(artifactHashes)) {
      if (previous.artifacts?.[file] !== hash) {
        reproducible = false;
        differences.push({
          type: 'artifact',
          file,
          previous: previous.artifacts?.[file],
          current: hash,
          message: `Artifact ${file} changed`
        });
      }
    }
  }
  
  const verdict = reproducible ? 'REPRODUCIBLE' : 'NON_REPRODUCIBLE';
  
  const report = {
    verdict,
    reproducible,
    differences,
    current,
    previous: previous || null,
    checkedAt: getTimeProvider().iso()
  };
  
  return report;
}

/**
 * Write reproducibility report
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} report - Reproducibility report
 * @returns {string} Path to written file
 */
export function writeReproducibilityReport(projectDir, report) {
  const outputDir = resolve(projectDir, 'release');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = resolve(outputDir, 'reproducibility.report.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  
  return outputPath;
}




