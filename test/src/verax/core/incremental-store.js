/**
 * Incremental Store
 * Stores lightweight snapshots from previous runs for incremental execution.
 * 
 * Snapshot contains:
 * - Route signatures (hash of route path + sourceRef)
 * - Expectation signatures (hash of expectation properties)
 * - Interaction signatures (hash of interaction selector + type)
 */

import { createHash } from 'crypto';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { getRunArtifactDir } from './run-id.js';

/**
 * Compute deterministic hash/signature for a route
 */
export function computeRouteSignature(route) {
  const key = `${route.path || ''}|${route.sourceRef || ''}|${JSON.stringify(route.isDynamic || false)}|${route.examplePath || ''}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * Compute deterministic hash/signature for an expectation
 */
export function computeExpectationSignature(expectation) {
  const key = `${expectation.type || ''}|${expectation.fromPath || ''}|${expectation.targetPath || ''}|${expectation.sourceRef || ''}|${expectation.proof?.sourceRef || ''}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * Compute deterministic hash/signature for an interaction
 */
export function computeInteractionSignature(interaction, url) {
  const key = `${interaction.type || ''}|${interaction.selector || ''}|${url || ''}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * Load previous snapshot if it exists
 */
export function loadPreviousSnapshot(projectDir, runId) {
  if (!runId) {
    return null; // No runId, no snapshot
  }
  const runDir = getRunArtifactDir(projectDir, runId);
  const snapshotPath = resolve(runDir, 'incremental-snapshot.json');
  if (!existsSync(snapshotPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(snapshotPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save current snapshot
 */
export function saveSnapshot(projectDir, snapshot, runId) {
  if (!runId) {
    throw new Error('runId is required for saveSnapshot');
  }
  const runDir = getRunArtifactDir(projectDir, runId);
  mkdirSync(runDir, { recursive: true });
  const snapshotPath = resolve(runDir, 'incremental-snapshot.json');
  
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
}

/**
 * Build snapshot from manifest and observed interactions
 */
export function buildSnapshot(manifest, observedInteractions = []) {
  const routes = manifest.routes || [];
  const expectations = manifest.staticExpectations || [];
  
  const routeSignatures = routes.map(r => ({
    path: r.path,
    signature: computeRouteSignature(r),
    sourceRef: r.sourceRef
  }));
  
  const expectationSignatures = expectations.map(e => ({
    type: e.type,
    fromPath: e.fromPath,
    targetPath: e.targetPath,
    signature: computeExpectationSignature(e),
    sourceRef: e.sourceRef
  }));
  
  // Group interaction signatures by URL
  const interactionSignaturesByUrl = {};
  for (const interaction of observedInteractions) {
    const url = interaction.url || '*';
    if (!interactionSignaturesByUrl[url]) {
      interactionSignaturesByUrl[url] = [];
    }
    interactionSignaturesByUrl[url].push({
      type: interaction.type,
      selector: interaction.selector,
      signature: computeInteractionSignature(interaction, url)
    });
  }
  
  return {
    timestamp: Date.now(),
    routes: routeSignatures,
    expectations: expectationSignatures,
    interactions: interactionSignaturesByUrl,
    manifestVersion: manifest.learnTruth?.version || '1.0'
  };
}

/**
 * Compare old and new snapshots to detect changes
 */
export function compareSnapshots(oldSnapshot, newSnapshot) {
  if (!oldSnapshot) {
    return {
      hasChanges: true,
      changedRoutes: [],
      changedExpectations: [],
      unchangedRoutes: [],
      unchangedExpectations: []
    };
  }
  
  // Compare routes
  const oldRouteSigs = new Map(oldSnapshot.routes.map(r => [r.path, r.signature]));
  const newRouteSigs = new Map(newSnapshot.routes.map(r => [r.path, r.signature]));
  
  const changedRoutes = [];
  const unchangedRoutes = [];
  
  for (const newRoute of newSnapshot.routes) {
    const oldSig = oldRouteSigs.get(newRoute.path);
    if (oldSig !== newRoute.signature) {
      changedRoutes.push(newRoute.path);
    } else {
      unchangedRoutes.push(newRoute.path);
    }
  }
  
  // Check for removed routes
  for (const oldRoute of oldSnapshot.routes) {
    if (!newRouteSigs.has(oldRoute.path)) {
      changedRoutes.push(oldRoute.path); // Removed route triggers re-scan
    }
  }
  
  // Compare expectations
  const oldExpSigs = new Set(oldSnapshot.expectations.map(e => e.signature));
  const newExpSigs = new Set(newSnapshot.expectations.map(e => e.signature));
  
  const changedExpectations = [];
  const unchangedExpectations = [];
  
  for (const newExp of newSnapshot.expectations) {
    if (oldExpSigs.has(newExp.signature)) {
      unchangedExpectations.push(newExp.signature);
    } else {
      changedExpectations.push(newExp.signature);
    }
  }
  
  // Check for removed expectations
  for (const oldExp of oldSnapshot.expectations) {
    if (!newExpSigs.has(oldExp.signature)) {
      changedExpectations.push(oldExp.signature);
    }
  }
  
  const hasChanges = changedRoutes.length > 0 || changedExpectations.length > 0;
  
  return {
    hasChanges,
    changedRoutes,
    changedExpectations,
    unchangedRoutes,
    unchangedExpectations
  };
}

/**
 * Check if interaction should be skipped based on incremental snapshot
 */
export function shouldSkipInteractionIncremental(interaction, url, oldSnapshot, snapshotDiff) {
  if (!oldSnapshot || !snapshotDiff) {
    return false; // No snapshot, don't skip
  }
  
  // If route changed, don't skip (re-scan everything on that route)
  const urlPath = extractPathFromUrl(url);
  const routeChanged = snapshotDiff.changedRoutes.some(routePath => {
    const normalizedRoute = normalizePath(routePath);
    const normalizedUrl = normalizePath(urlPath);
    return normalizedRoute === normalizedUrl || normalizedUrl.startsWith(normalizedRoute);
  });
  
  if (routeChanged) {
    return false; // Route changed, re-scan
  }
  
  // If expectations changed, don't skip (may affect this interaction)
  if (snapshotDiff.changedExpectations.length > 0) {
    return false; // Expectations changed, re-scan
  }
  
  // Check if this exact interaction was seen before
  const interactionSig = computeInteractionSignature(interaction, url);
  const oldInteractions = oldSnapshot.interactions[url] || oldSnapshot.interactions['*'] || [];
  const wasSeenBefore = oldInteractions.some(i => i.signature === interactionSig);
  
  // Only skip if route unchanged AND expectations unchanged AND interaction was seen
  if (wasSeenBefore && snapshotDiff.unchangedRoutes.length > 0) {
    return true; // Unchanged route, unchanged expectations, seen interaction
  }
  
  return false; // Conservative: don't skip if uncertain
}

/**
 * Extract path from URL
 */
function extractPathFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return url || '*';
  }
}

/**
 * Normalize path for comparison
 */
function normalizePath(path) {
  if (!path) return '/';
  return path.replace(/\/$/, '') || '/';
}
