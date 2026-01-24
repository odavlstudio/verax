/**
 * PHASE 5: RUN MANIFEST
 * 
 * Single source of truth for run metadata.
 * Written FIRST, referenced by all later stages.
 */

import { mkdirSync, readFileSync } from 'fs';
import { atomicWriteJsonSync } from '../../cli/util/atomic-write.js';
import { getTimeProvider } from '../../cli/util/support/time-provider.js';

import { getRunArtifactDir, getVeraxVersion } from './run-id.js';

/**
 * Create run manifest at start of execution
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run identifier (deterministic)
 * @param {Object} params - Run parameters
 * @param {string} params.url - Target URL
 * @param {Object} params.safetyFlags - Safety flags
 * @param {string} params.baseOrigin - Base origin
 * @param {Object} params.scanBudget - Scan budget
 * @param {string} params.manifestPath - Optional manifest path
 * @param {Array<string>} params.argv - Command line arguments
 * @returns {Object} Run manifest data
 */
export function createRunManifest(projectDir, runId, params) {
  const { url, safetyFlags, baseOrigin, scanBudget, manifestPath, argv = [] } = params;
  
  const runManifest = {
    runId,
    veraxVersion: getVeraxVersion(),
    nodeVersion: process.version,
    // Playwright version would be detected from node_modules if needed
    playwrightVersion: 'latest',
    url,
    baseOrigin,
    flags: {
      allowWrites: false,  // CONSTITUTIONAL: Always false (read-only mode)
      allowRiskyActions: safetyFlags.allowRiskyActions || false,
      allowCrossOrigin: safetyFlags.allowCrossOrigin || false
    },
    safeMode: {
      enabled: true,  // Always enabled (constitutional enforcement)
      writesBlocked: true,  // CONSTITUTIONAL: Always blocked
      riskyActionsBlocked: !safetyFlags.allowRiskyActions,
      crossOriginBlocked: !safetyFlags.allowCrossOrigin
    },
    budget: {
      maxScanDurationMs: scanBudget.maxScanDurationMs,
      maxInteractionsPerPage: scanBudget.maxInteractionsPerPage,
      maxUniqueUrls: scanBudget.maxUniqueUrls,
      interactionTimeoutMs: scanBudget.interactionTimeoutMs,
      navigationTimeoutMs: scanBudget.navigationTimeoutMs,
      stabilizationWindowMs: scanBudget.stabilizationWindowMs,
      stabilizationSampleMidMs: scanBudget.stabilizationSampleMidMs,
      stabilizationSampleEndMs: scanBudget.stabilizationSampleEndMs,
      networkWaitMs: scanBudget.networkWaitMs,
      settleTimeoutMs: scanBudget.settleTimeoutMs,
      settleIdleMs: scanBudget.settleIdleMs,
      settleDomStableMs: scanBudget.settleDomStableMs,
      navigationStableWaitMs: scanBudget.navigationStableWaitMs
    },
    manifestPath,
    command: argv.join(' '),
    argv,
    startTime: getTimeProvider().iso(),
    artifactHashes: {} // Will be populated after artifacts are written
  };
  
  // Ensure run directory exists
  const runDir = getRunArtifactDir(projectDir, runId);
  mkdirSync(runDir, { recursive: true });
  
  // Write run manifest
  const runManifestPath = `${runDir}/run-manifest.json`;
  atomicWriteJsonSync(runManifestPath, runManifest);
  
  return runManifest;
}

/**
 * Update run manifest with artifact hashes
 * 
 * @param {string} projectDir - Project directory
 * @param {string} runId - Run identifier
 * @param {Object} hashes - Map of artifact names to hashes
 */
export function updateRunManifestHashes(projectDir, runId, hashes) {
  const runDir = getRunArtifactDir(projectDir, runId);
  const runManifestPath = `${runDir}/run-manifest.json`;
  
  try {
  // @ts-expect-error - readFileSync with encoding returns string
    const runManifest = JSON.parse(readFileSync(runManifestPath, 'utf-8'));
    runManifest.artifactHashes = hashes;
    runManifest.endTime = getTimeProvider().iso();
    atomicWriteJsonSync(runManifestPath, runManifest);
  } catch (error) {
    // Run manifest not found or invalid - continue without update
  }
}



