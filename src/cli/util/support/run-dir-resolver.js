/**
 * Run Directory Resolution
 * 
 * Resolves run directories supporting both:
 * - NEW: .verax/scans/<scanId>/runs/<runId>/
 * - LEGACY: .verax/runs/<runId>/ or .verax/runs/<scanId>/<runId>/
 * 
 * Provides backward compatibility while transitioning to the canonical structure.
 */

import { resolve, join, basename } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';

/**
 * Resolve run directory from runId, supporting both new and legacy structures
 * 
 * @param {string} projectRoot - Project root directory
 * @param {string} runId - Run identifier
 * @param {string} [scanId] - Optional scan identifier (for new structure)
 * @returns {string} Absolute path to run directory
 */
export function resolveRunDir(projectRoot, runId, scanId = null) {
  // Strategy 1: If scanId provided, try new structure first
  if (scanId) {
    const newPath = resolve(projectRoot, '.verax', 'scans', scanId, 'runs', runId);
    if (existsSync(newPath)) {
      return newPath;
    }
  }

  // Strategy 2: Search in .verax/scans/ for any scan containing this runId
  const scansBase = resolve(projectRoot, '.verax', 'scans');
  if (existsSync(scansBase)) {
    try {
      const rawDirents = readdirSync(scansBase, { withFileTypes: true });
      const scanDirs = Array.isArray(rawDirents)
        ? rawDirents.filter((/** @type {any} */ e) => Boolean(e) && typeof e === 'object' && 'isDirectory' in e && typeof e.isDirectory === 'function')
        : [];
      const scanNames = scanDirs
        .filter((e) => e.isDirectory())
        .map((e) => e.name);

      for (const scan of scanNames) {
        const candidatePath = resolve(scansBase, scan, 'runs', runId);
        if (existsSync(candidatePath)) {
          return candidatePath;
        }
      }
    } catch {
      // Continue to fallback
    }
  }

  // Strategy 3: Legacy path - .verax/runs/<runId>/
  const legacyDirect = resolve(projectRoot, '.verax', 'runs', runId);
  if (existsSync(legacyDirect)) {
    return legacyDirect;
  }

  // Strategy 4: Legacy nested path - .verax/runs/<scanId>/<runId>/
  const legacyNested = resolve(projectRoot, '.verax', 'runs');
  if (existsSync(legacyNested)) {
    try {
      const rawDirents = readdirSync(legacyNested, { withFileTypes: true });
      const scanDirs = Array.isArray(rawDirents)
        ? rawDirents.filter((/** @type {any} */ e) => Boolean(e) && typeof e === 'object' && 'isDirectory' in e && typeof e.isDirectory === 'function')
        : [];
      const scanNames = scanDirs
        .filter((e) => e.isDirectory())
        .map((e) => e.name);

      for (const scan of scanNames) {
        const candidatePath = resolve(legacyNested, scan, runId);
        if (existsSync(candidatePath)) {
          return candidatePath;
        }
      }
    } catch {
      // Not found
    }
  }

  // Not found - return the preferred new path (caller will handle missing dir)
  if (scanId) {
    return resolve(projectRoot, '.verax', 'scans', scanId, 'runs', runId);
  }
  return resolve(projectRoot, '.verax', 'runs', runId);
}

/**
 * Resolve run directory from a path that might be:
 * - A direct run directory path
 * - A scan directory path (resolve to latest run via latest.json)
 * - A runId string
 * 
 * @param {string} projectRoot - Project root directory
 * @param {string} pathOrRunId - Path or run identifier
 * @returns {string} Absolute path to run directory
 */
export function resolveRunPath(projectRoot, pathOrRunId) {
  const fullPath = resolve(pathOrRunId);
  
  // Check if it's a direct run directory with summary.json
  if (existsSync(join(fullPath, 'summary.json'))) {
    return fullPath;
  }

  // Check if it's a scan directory with latest.json pointer
  const latestPointer = join(fullPath, 'latest.json');
  if (existsSync(latestPointer)) {
    try {
      const latest = JSON.parse(String(readFileSync(latestPointer, 'utf-8')));
      if (latest?.baseDir && existsSync(latest.baseDir)) {
        return latest.baseDir;
      }
      if (latest?.runId) {
        const runsDir = join(fullPath, 'runs');
        const runPath = join(runsDir, latest.runId);
        if (existsSync(runPath)) {
          return runPath;
        }
      }
    } catch {
      // Fall through
    }
  }

  // Check if it's a scan directory with runs/ subdirectory
  const runsDir = join(fullPath, 'runs');
  if (existsSync(runsDir)) {
    const rawDirents = readdirSync(runsDir, { withFileTypes: true });
    const runDirents = Array.isArray(rawDirents)
      ? rawDirents.filter((/** @type {any} */ e) => Boolean(e) && typeof e === 'object' && 'isDirectory' in e && typeof e.isDirectory === 'function')
      : [];
    const runEntries = runDirents
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    if (runEntries.length > 0) {
      // Return the latest run (lexicographically last, which is chronologically last for our naming)
      return join(runsDir, runEntries[runEntries.length - 1]);
    }
  }

  // Treat as runId and resolve
  const runId = basename(pathOrRunId);
  return resolveRunDir(projectRoot, runId);
}

/**
 * Extract scanId and runId from a run directory path
 * 
 * @param {string} runDirPath - Full path to run directory
 * @returns {{scanId: string|null, runId: string|null}}
 */
export function extractIdentifiers(runDirPath) {
  const normalized = runDirPath.replace(/\\/g, '/');
  
  // New structure: .verax/scans/<scanId>/runs/<runId>
  const newMatch = normalized.match(/\.verax\/scans\/([^/]+)\/runs\/([^/]+)/);
  if (newMatch) {
    return { scanId: newMatch[1], runId: newMatch[2] };
  }

  // Legacy nested: .verax/runs/<scanId>/<runId>
  const legacyNestedMatch = normalized.match(/\.verax\/runs\/([^/]+)\/([^/]+)/);
  if (legacyNestedMatch) {
    return { scanId: legacyNestedMatch[1], runId: legacyNestedMatch[2] };
  }

  // Legacy direct: .verax/runs/<runId>
  const legacyDirectMatch = normalized.match(/\.verax\/runs\/([^/]+)/);
  if (legacyDirectMatch) {
    return { scanId: null, runId: legacyDirectMatch[1] };
  }

  return { scanId: null, runId: basename(runDirPath) };
}

