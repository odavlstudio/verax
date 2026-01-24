/**
 * CI Artifact Packer (PHASE 5.7)
 *
 * Deterministically packs VERAX run artifacts for CI upload.
 * Creates manifest with sorted file listing for reproducibility.
 */

import { readdirSync, statSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs';
import { join, relative, basename } from 'path';
import { existsSync } from 'fs';
import { getTimeProvider } from '../support/time-provider.js';

/**
 * Find latest run directory
 * @param {string} runsDir - Path to .verax/runs directory
 * @returns {string|null} Path to latest run directory or null
 */
export function findLatestRun(runsDir) {
  if (!existsSync(runsDir)) {
    return null;
  }
  
  // Check for latest.txt first (deterministic)
  const latestFile = join(runsDir, 'latest.txt');
  if (existsSync(latestFile)) {
    const latestRunId = String(readFileSync(latestFile, 'utf-8')).trim();
    const latestRunDir = join(runsDir, latestRunId);
    if (existsSync(latestRunDir) && statSync(latestRunDir).isDirectory()) {
      return latestRunDir;
    }
  }
  
  // Fallback: find newest directory by name (ISO 8601 timestamp prefix)
  const entries = readdirSync(runsDir)
    .sort((a, b) => a.localeCompare(b, 'en'))
    .filter(name => {
      const path = join(runsDir, name);
      return statSync(path).isDirectory() && name !== 'latest.txt';
    })
    .reverse(); // Newest first (lexicographic sort of ISO timestamps)
  
  return entries.length > 0 ? join(runsDir, entries[0]) : null;
}

/**
 * Recursively list all files in a directory
 * @param {string} dir - Directory to scan
 * @param {string} baseDir - Base directory for relative paths
 * @returns {Array<string>} Sorted array of relative file paths (forward slashes)
 */
export function listFilesRecursive(dir, baseDir = dir) {
  const files = [];
  
  function scan(currentDir) {
    const entries = readdirSync(currentDir).sort((a, b) => a.localeCompare(b, 'en'));
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (stat.isFile()) {
        const relativePath = relative(baseDir, fullPath);
        // Normalize to forward slashes for determinism across platforms
        files.push(relativePath.replace(/\\/g, '/'));
      }
    }
  }
  
  scan(dir);
  
  // Sort deterministically (lexicographic)
  return files.sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * Create manifest.json for artifact bundle
 * @param {string} runDir - Source run directory
 * @param {Array<string>} files - List of included files (relative paths)
 * @returns {Object} Manifest object
 */
export function createManifest(runDir, files) {
  const runId = basename(runDir);
  const timeProvider = getTimeProvider();
  
  // Try to read run metadata
  let runMeta = null;
  const runMetaPath = join(runDir, 'run-meta.json');
  if (existsSync(runMetaPath)) {
    try {
      runMeta = JSON.parse(String(readFileSync(runMetaPath, 'utf-8')));
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Try to read summary
  let summary = null;
  const summaryPath = join(runDir, 'summary.json');
  if (existsSync(summaryPath)) {
    try {
      summary = JSON.parse(String(readFileSync(summaryPath, 'utf-8')));
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  return {
    packVersion: 1,
    runId,
    packedAt: timeProvider.iso(),
    veraxVersion: runMeta?.veraxVersion || 'unknown',
    url: runMeta?.url || summary?.url || 'unknown',
    status: summary?.status || 'UNKNOWN',
    findingsCounts: summary?.findingsCounts || { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
    files: files.sort((a, b) => a.localeCompare(b, 'en')), // Ensure sorted
    fileCount: files.length,
  };
}

/**
 * Pack run artifacts into a bundle directory
 * @param {string} runDir - Source run directory
 * @param {string} bundleDir - Target bundle directory
 * @returns {Object} Result with success status and manifest
 */
export function packArtifacts(runDir, bundleDir) {
  if (!existsSync(runDir)) {
    throw new Error(`Run directory not found: ${runDir}`);
  }
  
  // Create bundle directory
  mkdirSync(bundleDir, { recursive: true });
  
  // List all files
  const files = listFilesRecursive(runDir);
  
  // Copy files to bundle
  for (const file of files) {
    const srcPath = join(runDir, file);
    const destPath = join(bundleDir, file);
    
    // Create parent directory if needed
    const destDir = join(destPath, '..');
    mkdirSync(destDir, { recursive: true });
    
    copyFileSync(srcPath, destPath);
  }
  
  // Create manifest
  const manifest = createManifest(runDir, files);
  const manifestPath = join(bundleDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  return {
    success: true,
    bundleDir,
    manifest,
    fileCount: files.length,
  };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const runDir = process.argv[2];
  const bundleDir = process.argv[3];
  
  if (!runDir || !bundleDir) {
    console.error('Usage: node artifact-pack.js <runDir> <bundleDir>');
    process.exit(64);
  }
  
  try {
    const result = packArtifacts(runDir, bundleDir);
    console.log(`✓ Packed ${result.fileCount} files to ${result.bundleDir}`);
    console.log(`  Run ID: ${result.manifest.runId}`);
    console.log(`  Status: ${result.manifest.status}`);
    console.log(`  Findings: HIGH=${result.manifest.findingsCounts.HIGH} MEDIUM=${result.manifest.findingsCounts.MEDIUM} LOW=${result.manifest.findingsCounts.LOW}`);
  } catch (error) {
    console.error(`Error packing artifacts: ${error.message}`);
    process.exit(1);
  }
}
