import { join, isAbsolute } from 'path';
import { mkdirSync } from 'fs';
import { generateCanonicalDirectoryNames } from './canonical-naming.js';

/**
 * Build run artifact paths with canonical human-readable names
 * 
 * STAGE 6.1: Outputs use human-readable directory names:
 * - .verax/scans/scan-login-flow-auth-1a2b/run-2026-01-24-0001/
 * instead of hash-based:
 * - .verax/runs/a3f1b2c9/9x8y7z6w/
 */
export function getRunPaths(projectRoot, outDir, scanId, runId, options = {}) {
  const outBase = isAbsolute(outDir) ? outDir : join(projectRoot, outDir);
  
  // Use canonical naming if options provided (new code path)
  // Otherwise fall back to legacy paths for backward compatibility
  let baseDir, scanBaseDir, displayScanName, displayRunName;
  
  if (options.url && options.srcPath !== undefined) {
    // New canonical naming path
    const names = generateCanonicalDirectoryNames({
      url: options.url,
      srcPath: options.srcPath,
      config: options.config || {},
      runSequence: options.runSequence || 0,
    });
    
    displayScanName = names.scanName;
    displayRunName = names.runName;
    
    // Use human-readable directory structure: scans/<scanName>/<runName>
    scanBaseDir = join(outBase, 'scans', names.scanName);
    baseDir = join(scanBaseDir, names.runName);
  } else {
    // Legacy path for backward compatibility
    baseDir = join(outBase, 'runs', scanId, runId);
    scanBaseDir = join(outBase, 'runs', scanId);
    displayScanName = scanId;
    displayRunName = runId;
  }
  
  return {
    // Legacy identifiers (for backward compatibility)
    scanId,
    runId,
    
    // Display names for human output
    displayScanName,
    displayRunName,
    
    // Paths
    baseDir,
    scanBaseDir,
    runStatusJson: join(baseDir, 'run.status.json'),
    runManifestJson: join(baseDir, 'run-manifest.json'),
    runMetaJson: join(baseDir, 'run.meta.json'),
    summaryJson: join(baseDir, 'summary.json'),
    judgmentsJson: join(baseDir, 'judgments.json'),
    coverageJson: join(baseDir, 'coverage.json'),
    humanSummaryMd: join(baseDir, 'verax-summary.md'),
    findingsJson: join(baseDir, 'findings.json'),
    tracesJsonl: join(baseDir, 'traces.jsonl'),
    evidenceDir: join(baseDir, 'evidence'),
    learnJson: join(baseDir, 'learn.json'),
    observeJson: join(baseDir, 'observe.json'),
    latestPointerJson: join(scanBaseDir, 'latest.json'),
    runsRootLatestJson: join(outBase, 'runs', 'latest.json'),
    runsRootLatestTxt: join(outBase, 'runs', 'latest.txt'),
  };
}

/**
 * Ensure all required directories exist
 */
export function ensureRunDirectories(paths) {
  mkdirSync(paths.scanBaseDir, { recursive: true });
  mkdirSync(paths.baseDir, { recursive: true });
  mkdirSync(paths.evidenceDir, { recursive: true });
}




