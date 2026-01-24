/**
 * PHASE H6 - Monorepo Resolution Module
 * 
 * Deterministically selects the correct app root in a monorepo.
 * Records all decision logic in metadata for auditability.
 * 
 * Algorithm:
 * 1. Scan workspace for app root candidates
 * 2. For single candidate: return it
 * 3. For multiple: apply deterministic tie-breaks
 * 4. Record decision trail in run.meta.json
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, relative } from 'path';
import { findAppRootCandidates, detectFramework as _detectFramework } from '../detection/framework-detector.js';

/**
 * Detect if path contains monorepo workspace markers
 */
function isMonorepo(rootPath) {
  // Check for workspace configuration files
  const workspaceMarkers = [
    'pnpm-workspace.yaml',
    'lerna.json',
    'nx.json',
    'turbo.json',
    // package.json with workspaces field
  ];

  for (const marker of workspaceMarkers) {
    if (existsSync(resolve(rootPath, marker))) {
      return true;
    }
  }

  // Check package.json for workspaces
  try {
    const pkgPath = resolve(rootPath, 'package.json');
    if (existsSync(pkgPath)) {
  // @ts-expect-error - readFileSync with encoding returns string
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg.workspaces || pkg.packages) {
        return true;
      }
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Detect package manager used in workspace
 */
function detectPackageManager(rootPath) {
  const markers = [
    { file: 'pnpm-lock.yaml', manager: 'pnpm' },
    { file: 'yarn.lock', manager: 'yarn' },
    { file: 'package-lock.json', manager: 'npm' },
    { file: 'bun.lockb', manager: 'bun' },
  ];

  for (const { file, manager } of markers) {
    if (existsSync(resolve(rootPath, file))) {
      return manager;
    }
  }

  return 'npm'; // default
}

/**
 * Resolve app root in a monorepo or single-app workspace
 * Returns: { appRoot, isMonorepo, decision, candidates, evidence }
 */
export function resolveAppRoot(workspaceRoot) {
  const isMonorepoWorkspace = isMonorepo(workspaceRoot);
  const packageManager = detectPackageManager(workspaceRoot);

  const result = {
    appRoot: workspaceRoot, // default
    isMonorepo: isMonorepoWorkspace,
    packageManager,
    decision: null,
    candidates: [],
    evidence: [],
  };

  if (!isMonorepoWorkspace) {
    result.evidence.push('No monorepo markers found; treating as single-app workspace');
    result.decision = 'single-app-default';
    return result;
  }

  // Scan for app candidates
  const candidates = findAppRootCandidates(workspaceRoot);
  result.candidates = candidates.map(c => ({
    path: relative(workspaceRoot, c.path),
    framework: c.framework,
    confidence: c.confidence,
    hasDevScript: c.hasDevScript,
  }));

  result.evidence.push(`Monorepo workspace detected (${packageManager})`);
  result.evidence.push(`Found ${candidates.length} app candidates`);

  if (candidates.length === 0) {
    result.evidence.push('No app candidates found; using workspace root');
    result.decision = 'no-candidates-fallback-root';
    return result;
  }

  if (candidates.length === 1) {
    result.appRoot = candidates[0].path;
    result.evidence.push(`Single candidate found: ${relative(workspaceRoot, candidates[0].path)}`);
    result.decision = 'single-candidate';
    return result;
  }

  // Multiple candidates: apply deterministic tie-breaking
  // Already sorted by findAppRootCandidates:
  // 1. Highest framework confidence
  // 2. Has dev script
  // 3. Shallowest depth
  // 4. Alphabetical path

  const best = candidates[0];
  const tieBreakers = [];

  // Reason code
  if (best.confidence > candidates[1].confidence) {
    tieBreakers.push(`highest-framework-confidence:${best.framework}-${best.confidence}%`);
  }
  if (best.hasDevScript && !candidates[1].hasDevScript) {
    tieBreakers.push('has-dev-script');
  }
  if (best.depth < candidates[1].depth) {
    tieBreakers.push('shallowest-depth');
  }
  if (best.path < candidates[1].path) {
    tieBreakers.push('alphabetical-first');
  }

  result.appRoot = best.path;
  result.evidence.push(
    `Multiple candidates (${candidates.length}); selected: ${relative(workspaceRoot, best.path)}`
  );
  result.evidence.push(`Tie-breakers applied: ${tieBreakers.join(' > ')}`);
  result.decision = 'monorepo-tie-break';

  return result;
}

/**
 * Export for testing
 */
export const _internal = {
  isMonorepo,
  detectPackageManager,
};



