import { learn } from './learn/index.js';
import { observe } from './observe/index.js';
import { detect } from './detect/index.js';
import { writeScanSummary } from './scan-summary-writer.js';
import { validateRoutes } from './learn/route-validator.js';
import { createScanBudgetWithProfile } from './shared/budget-profiles.js';
import { computeObservationSummary, writeEvidenceIndex } from './detect/verdict-engine.js';
import SilenceTracker from './core/silence-model.js';
import { generateRunId, getRunArtifactDir, getArtifactPath } from './core/run-id.js';
import { createRunManifest, updateRunManifestHashes } from './core/run-manifest.js';
import { computeArtifactHashes } from './core/run-id.js';

export async function scan(projectDir, url, manifestPath = null, scanBudgetOverride = null, safetyFlags = {}) {
  // If manifestPath is provided, read it first before learn() overwrites it
  let loadedManifest = null;
  if (manifestPath) {
    const { readFileSync } = await import('fs');
    try {
      const manifestContent = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      loadedManifest = manifestContent;
    } catch (e) {
      // Fall through to learn if we can't read the manifest
    }
  }
  
  const learnedManifest = await learn(projectDir);
  
  // Merge: prefer loaded manifest for routes, but use learned for project type and truth
  let manifest;
  if (loadedManifest) {
    manifest = {
      ...learnedManifest,
      projectType: loadedManifest.projectType || learnedManifest.projectType,
      publicRoutes: loadedManifest.publicRoutes || learnedManifest.publicRoutes,
      routes: loadedManifest.routes || learnedManifest.routes,
      internalRoutes: loadedManifest.internalRoutes || learnedManifest.internalRoutes,
      staticExpectations: loadedManifest.staticExpectations || learnedManifest.staticExpectations,
      manifestPath: manifestPath
    };
  } else {
    manifest = learnedManifest;
  }
  
  if (!url) {
    return { manifest, observation: null, findings: null, scanSummary: null, validation: null };
  }
  
  // manifestForValidation uses the provided/merged manifest (which may have been modified)
  const manifestForValidation = {
    projectType: manifest.projectType,
    publicRoutes: manifest.publicRoutes,
    routes: manifest.routes,
    manifestPath: manifest.manifestPath
  };
  
  let validation = await validateRoutes(manifestForValidation, url);
  
  if (!validation) {
    // validateRoutes might return null if routes cannot be validated
    validation = { 
      routesValidated: 0, 
      routesReachable: 0, 
      routesUnreachable: 0, 
      details: [], 
      warnings: []
    };
  }
  if (validation.warnings && validation.warnings.length > 0) {
    if (!manifest.learnTruth.warnings) {
      manifest.learnTruth.warnings = [];
    }
    manifest.learnTruth.warnings.push(...validation.warnings);
  }
  
  // Use budget profile if no override provided
  const scanBudget = scanBudgetOverride || createScanBudgetWithProfile();
  
  // PHASE 5: Generate deterministic runId and create run manifest
  const { getBaseOrigin } = await import('./observe/domain-boundary.js');
  const baseOrigin = getBaseOrigin(url);
  const runId = generateRunId({
    url,
    safetyFlags,
    baseOrigin,
    scanBudget,
    manifestPath
  });
  
  // Create run manifest at start of execution
  const runManifest = createRunManifest(projectDir, runId, {
    url,
    safetyFlags,
    baseOrigin,
    scanBudget,
    manifestPath,
    argv: process.argv
  });
  
  const usedManifestPath = manifestPath || manifest.manifestPath;
  const observation = await observe(url, usedManifestPath, scanBudget, safetyFlags, projectDir, runId);

  // Write a copy of the manifest into canonical run directory for replay integrity
  try {
    const { writeFileSync } = await import('fs');
    const manifestCopyPath = getArtifactPath(projectDir, runId, 'manifest.json');
    writeFileSync(manifestCopyPath, JSON.stringify(manifest, null, 2));
  } catch {
    // Ignore write errors
  }
  
  // Create silence tracker from observation silences
  const silenceTracker = new SilenceTracker();
  if (observation.silences && observation.silences.entries) {
    silenceTracker.recordBatch(observation.silences.entries);
  }
  
  const findings = await detect(usedManifestPath, observation.tracesPath, validation, observation.expectationCoverageGaps || [], silenceTracker);
  
  const learnTruthWithValidation = {
    ...manifest.learnTruth,
    validation: validation
  };
  
  const runDir = getRunArtifactDir(projectDir, runId);
  const scanSummary = writeScanSummary(
    projectDir,
    url,
    manifest.projectType,
    learnTruthWithValidation,
    observation.observeTruth,
    findings.detectTruth,
    manifest.manifestPath,
    observation.tracesPath,
    findings.findingsPath,
    runDir,
    findings.findings // PHASE 7: Pass findings array for decision snapshot
  );
  
  // Compute observation summary from scan results (not a verdict)
  // Pass observation object (which includes traces) to observation engine
  const observeTruthWithTraces = {
    ...observation.observeTruth,
    traces: observation.traces || []
  };
  const observationSummary = computeObservationSummary(
    findings.findings || [],
    observeTruthWithTraces,
    manifest.learnTruth,
    findings.coverageGaps || [],
    observation.observeTruth?.budgetExceeded,
    findings.detectTruth, // Pass detectTruth for silence data
    projectDir, // Pass projectDir for evidence validation
    silenceTracker // Pass silenceTracker for evidence integrity tracking
  );

  // Write evidence index
  const evidenceIndexPath = await writeEvidenceIndex(
    projectDir,
    observationSummary.evidenceIndex || [],
    observation.tracesPath,
    findings.findingsPath,
    runDir
  );
  observationSummary.evidenceIndexPath = evidenceIndexPath;
  
  // PHASE 5: Compute artifact hashes and update run manifest
  const artifactHashes = computeArtifactHashes(projectDir, runId);
  updateRunManifestHashes(projectDir, runId, artifactHashes);

  return { 
    manifest, 
    observation, 
    findings, 
    scanSummary, 
    validation, 
    coverageGaps: findings.coverageGaps || [],
    observationSummary,
    runId,
    runManifest
  };
}

export { learn } from './learn/index.js';
export { observe } from './observe/index.js';
export { detect } from './detect/index.js';
