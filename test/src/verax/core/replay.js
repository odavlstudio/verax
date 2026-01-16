/**
 * PHASE 5: REPLAY MODE
 * 
 * Load artifacts from previous run and recompute summaries without browser/network.
 * Output must be identical to original run.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { computeFileHash } from './run-id.js';
import SilenceTracker from './silence-model.js';

/**
 * Load artifacts from a run directory
 * 
 * @param {string} runDir - Path to run directory (.verax/runs/<runId>)
 * @returns {Object} Loaded artifacts with integrity status
 */
export function loadRunArtifacts(runDir) {
  const artifacts = {
    runManifest: null,
    traces: null,
    findings: null,
    manifest: null,
    integrityViolations: []
  };
  
  // Load run manifest first
  const runManifestPath = join(runDir, 'run-manifest.json');
  if (!existsSync(runManifestPath)) {
    throw new Error(`Run manifest not found: ${runManifestPath}`);
  }
  
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    artifacts.runManifest = JSON.parse(readFileSync(runManifestPath, 'utf-8'));
  } catch (error) {
    throw new Error(`Failed to parse run manifest: ${error.message}`);
  }
  
  // Load and verify each artifact
  const expectedHashes = artifacts.runManifest.artifactHashes || {};
  
  // Load traces
  const tracesPath = join(runDir, 'traces.json');
  if (existsSync(tracesPath)) {
    try {
  // @ts-expect-error - readFileSync with encoding returns string
      artifacts.traces = JSON.parse(readFileSync(tracesPath, 'utf-8'));
      
      // Verify hash
      if (expectedHashes.traces) {
        const actualHash = computeFileHash(tracesPath);
        if (actualHash !== expectedHashes.traces) {
          artifacts.integrityViolations.push({
            artifact: 'traces.json',
            path: tracesPath,
            expectedHash: expectedHashes.traces,
            actualHash,
            reason: 'hash_mismatch'
          });
        }
      }
    } catch (error) {
      artifacts.integrityViolations.push({
        artifact: 'traces.json',
        path: tracesPath,
        reason: 'parse_error',
        error: error.message
      });
    }
  } else if (expectedHashes.traces) {
    artifacts.integrityViolations.push({
      artifact: 'traces.json',
      path: tracesPath,
      expectedHash: expectedHashes.traces,
      reason: 'file_missing'
    });
  }
  
  // Load findings
  const findingsPath = join(runDir, 'findings.json');
  if (existsSync(findingsPath)) {
    try {
  // @ts-expect-error - readFileSync with encoding returns string
      artifacts.findings = JSON.parse(readFileSync(findingsPath, 'utf-8'));
      
      // Verify hash
      if (expectedHashes.findings) {
        const actualHash = computeFileHash(findingsPath);
        if (actualHash !== expectedHashes.findings) {
          artifacts.integrityViolations.push({
            artifact: 'findings.json',
            path: findingsPath,
            expectedHash: expectedHashes.findings,
            actualHash,
            reason: 'hash_mismatch'
          });
        }
      }
    } catch (error) {
      artifacts.integrityViolations.push({
        artifact: 'findings.json',
        path: findingsPath,
        reason: 'parse_error',
        error: error.message
      });
    }
  }
  
  // Load manifest
  const manifestPath = join(runDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    try {
  // @ts-expect-error - readFileSync with encoding returns string
      artifacts.manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      
      // Verify hash
      if (expectedHashes.manifest) {
        const actualHash = computeFileHash(manifestPath);
        if (actualHash !== expectedHashes.manifest) {
          artifacts.integrityViolations.push({
            artifact: 'manifest.json',
            path: manifestPath,
            expectedHash: expectedHashes.manifest,
            actualHash,
            reason: 'hash_mismatch'
          });
        }
      }
    } catch (error) {
      artifacts.integrityViolations.push({
        artifact: 'manifest.json',
        path: manifestPath,
        reason: 'parse_error',
        error: error.message
      });
    }
  }
  
  return artifacts;
}

/**
 * Replay a previous run from artifacts
 * 
 * @param {string} runDir - Path to run directory
 * @returns {Promise<any>} Replay result with observation summary
 */
export async function replayRun(runDir) {
  // Load artifacts
  const artifacts = loadRunArtifacts(runDir);
  
  // Check for critical integrity violations
  if (artifacts.integrityViolations.length > 0) {
    // Record integrity violations as silences
    const silenceTracker = new SilenceTracker();
    for (const violation of artifacts.integrityViolations) {
      silenceTracker.record({
        scope: 'integrity',
        reason: violation.reason,
        description: `Artifact integrity violation: ${violation.artifact}`,
        context: {
          artifact: violation.artifact,
          path: violation.path,
          expectedHash: violation.expectedHash,
          actualHash: violation.actualHash,
          error: violation.error
        },
        impact: 'replay_affected'
      });
    }
    
    // Return early with integrity violations
    return {
      runManifest: artifacts.runManifest,
      integrityViolations: artifacts.integrityViolations,
      silences: silenceTracker.export(),
      replaySuccessful: false
    };
  }
  
  // Artifacts are valid - recompute summaries
  if (!artifacts.traces) {
    throw new Error('No traces found - cannot replay run');
  }
  
  // Extract data from artifacts
  const traces = artifacts.traces.traces || [];
  const findings = artifacts.findings?.findings || [];
  const observeTruth = artifacts.traces.observeTruth || {
    interactionsObserved: traces.length
  };
  
  // Import verdict engine to recompute summary
  const { computeObservationSummary } = await import('../detect/verdict-engine.js');
  
  // Create silence tracker from loaded silences
  const silenceTracker = new SilenceTracker();
  if (artifacts.traces.silences && artifacts.traces.silences.entries) {
    silenceTracker.recordBatch(artifacts.traces.silences.entries);
  }
  
  // Recompute observation summary (no browser, just from loaded data)
  const observationSummary = computeObservationSummary(
    findings,
    { ...observeTruth, traces },
    artifacts.manifest?.learnTruth || {},
    [],
    observeTruth.budgetExceeded,
    null,
    null,
    silenceTracker
  );
  
  return {
    runManifest: artifacts.runManifest,
    observationSummary,
    traces,
    findings,
    manifest: artifacts.manifest,
    integrityViolations: [],
    silences: silenceTracker.export(),
    replaySuccessful: true
  };
}
