import { learn } from './learn/index.js';
import { observe } from './observe/index.js';
import { detect } from './detect/index.js';
import { writeScanSummary } from './scan-summary-writer.js';
import { validateRoutes } from './learn/route-validator.js';

export async function scan(projectDir, url, manifestPath = null) {
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
  
  const validation = await validateRoutes(manifestForValidation, url);
  
  if (validation.warnings && validation.warnings.length > 0) {
    if (!manifest.learnTruth.warnings) {
      manifest.learnTruth.warnings = [];
    }
    manifest.learnTruth.warnings.push(...validation.warnings);
  }
  
  const usedManifestPath = manifestPath || manifest.manifestPath;
  const observation = await observe(url, usedManifestPath);
  const findings = await detect(usedManifestPath, observation.tracesPath, validation);
  
  const learnTruthWithValidation = {
    ...manifest.learnTruth,
    validation: validation
  };
  
  const scanSummary = writeScanSummary(
    projectDir,
    url,
    manifest.projectType,
    learnTruthWithValidation,
    observation.observeTruth,
    findings.detectTruth,
    manifest.manifestPath,
    observation.tracesPath,
    findings.findingsPath
  );
  
  return { manifest, observation, findings, scanSummary, validation };
}

export { learn } from './learn/index.js';
export { observe } from './observe/index.js';
export { detect } from './detect/index.js';

