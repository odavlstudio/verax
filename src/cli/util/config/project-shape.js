import { readdirSync, statSync, existsSync } from 'fs';
import { resolve, join } from 'path';

/**
 * Deterministic project shape detection
 * Scans common monorepo layouts to suggest source directories.
 * No detection logic changes; pure filesystem heuristics.
 */

const PRIORITY_DIRS = ['apps', 'packages', 'services', 'frontend', 'web'];

function isWebModule(dirPath) {
  // Consider a directory a candidate if it contains package.json or index.html or a src folder
  try {
    if (existsSync(resolve(dirPath, 'package.json'))) return true;
    if (existsSync(resolve(dirPath, 'index.html'))) return true;
    if (existsSync(resolve(dirPath, 'src'))) return true;
  } catch {
    // ignore
  }
  return false;
}

function listSubdirs(absPath) {
  try {
    return readdirSync(absPath)
      .sort((a, b) => a.localeCompare(b, 'en'))
      .map((name) => ({ name, abs: resolve(absPath, name) }))
      .filter((entry) => {
        try {
          return statSync(entry.abs).isDirectory();
        } catch {
          return false;
        }
      })
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Scan repository root for source candidates in deterministic order.
 * Returns relative paths from root.
 */
export function scanRepoForSourceCandidates(rootDir) {
  const root = resolve(rootDir);
  const candidates = new Set();

  // Direct root candidates
  if (existsSync(resolve(root, 'src'))) candidates.add('src');
  if (existsSync(resolve(root, 'index.html'))) candidates.add('.');

  // Priority dirs (apps, packages, services, frontend, web)
  for (const top of PRIORITY_DIRS) {
    const topPath = resolve(root, top);
    if (!existsSync(topPath)) continue;
    const subdirs = listSubdirs(topPath).sort((a, b) => a.localeCompare(b));
    if (subdirs.length === 0 && isWebModule(topPath)) {
      candidates.add(top); // top itself is a candidate
      continue;
    }
    for (const name of subdirs) {
      const subAbs = resolve(topPath, name);
      if (isWebModule(subAbs)) {
        candidates.add(join(top, name).replace(/\\/g, '/'));
      }
    }
  }

  // Fallback: common single-app folders
  const commonSingle = ['app', 'site'];
  for (const name of commonSingle) {
    const abs = resolve(root, name);
    if (existsSync(abs) && isWebModule(abs)) candidates.add(name);
  }

  // Deterministic ordering: lexicographic on normalized paths
  return Array.from(candidates).sort((a, b) => String(a).localeCompare(String(b)));
}

/**
 * Select best default src from candidates.
 * Returns { selected, candidates, ambiguous }
 */
export function selectBestDefaultSrc(rootDir) {
  const candidates = scanRepoForSourceCandidates(rootDir);

  if (candidates.length === 0) {
    // No candidates found; default to root
    return { selected: '.', candidates, ambiguous: false };
  }

  if (candidates.length === 1) {
    return { selected: candidates[0], candidates, ambiguous: false };
  }

  // Prefer 'src' when present and unique significant signal
  if (candidates.includes('src')) {
    // If multiple candidates but src exists and others are top-level containers, still ambiguous
    return { selected: null, candidates, ambiguous: true };
  }

  // Multiple viable candidates -> ambiguous
  return { selected: null, candidates, ambiguous: true };
}








