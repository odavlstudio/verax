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
import { resolveVeraxOutDir } from './default-output-dir.js';

function uniqueBases(bases) {
  const seen = new Set();
  const out = [];
  for (const b of bases) {
    const k = String(b || '').replace(/\\/g, '/');
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(b);
  }
  return out;
}

/**
 * Resolve run directory from runId, supporting both new and legacy structures
 * 
 * @param {string} projectRoot - Project root directory
 * @param {string} runId - Run identifier
 * @param {string} [scanId] - Optional scan identifier
 * @param {string|null} [outDir] - Optional output directory override (same semantics as --out)
 * @returns {string} Absolute path to run directory
 */
export function resolveRunDir(projectRoot, runId, scanId = null, outDir = null) {
  const defaultOut = resolveVeraxOutDir(projectRoot, outDir);
  const legacyOut = resolve(projectRoot, '.verax');
  const bases = uniqueBases([defaultOut, legacyOut]);

  for (const base of bases) {
    // Strategy 1: If scanId provided, try nested runs/<scanId>/<runId> first
    if (scanId) {
      const nested = resolve(base, 'runs', scanId, runId);
      if (existsSync(nested)) return nested;
    }

    // Strategy 2: Legacy direct runs/<runId>
    const direct = resolve(base, 'runs', runId);
    if (existsSync(direct)) return direct;

    // Strategy 3: Search nested runs/<scanId>/<runId>
    const runsRoot = resolve(base, 'runs');
    if (existsSync(runsRoot)) {
      try {
        const rawDirents = readdirSync(runsRoot, { withFileTypes: true });
        const scanDirs = Array.isArray(rawDirents)
          ? rawDirents.filter((/** @type {any} */ e) => Boolean(e) && typeof e === 'object' && 'isDirectory' in e && typeof e.isDirectory === 'function')
          : [];
        const scanNames = scanDirs
          .filter((e) => e.isDirectory())
          .map((e) => e.name);

        for (const scan of scanNames) {
          const candidatePath = resolve(runsRoot, scan, runId);
          if (existsSync(candidatePath)) return candidatePath;
        }
      } catch {
        // continue
      }
    }
  }

  // Not found - return preferred location in default output directory
  if (scanId) return resolve(defaultOut, 'runs', scanId, runId);
  return resolve(defaultOut, 'runs', runId);
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
  
  // Legacy nested: .verax/runs/<scanId>/<runId>
  const legacyNestedMatch = normalized.match(/\/runs\/([^/]+)\/([^/]+)(?:\/|$)/);
  if (legacyNestedMatch) {
    return { scanId: legacyNestedMatch[1], runId: legacyNestedMatch[2] };
  }

  // Legacy direct: .verax/runs/<runId>
  const legacyDirectMatch = normalized.match(/\/runs\/([^/]+)(?:\/|$)/);
  if (legacyDirectMatch) {
    return { scanId: null, runId: legacyDirectMatch[1] };
  }

  return { scanId: null, runId: basename(runDirPath) };
}

