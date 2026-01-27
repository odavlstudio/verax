import { getTimeProvider } from '../../../cli/util/support/time-provider.js';
/**
 * PHASE 18 — Determinism Engine
 * PHASE 21.2 — Determinism Truth Lock: Enforces HARD verdict
 * 
 * Runs the same scan multiple times and compares results for determinism.
 * PHASE 21.2: Also checks DecisionRecorder for adaptive events that break determinism.
 */

import { readFileSync, existsSync } from 'fs';
import { join as _join, resolve } from 'path';
import { normalizeArtifact } from './normalize.js';
import { diffArtifacts } from './diff.js';
import { computeFindingIdentity } from './finding-identity.js';
import { computeDeterminismVerdict, DETERMINISM_VERDICT } from './contract.js';
import { DecisionRecorder } from '../determinism-model.js';

/**
 * PHASE 18: Determinism verdict (re-exported from contract for backward compatibility)
 */
export { DETERMINISM_VERDICT, DETERMINISM_REASON } from './contract.js';

/**
 * PHASE 18: Run determinism check
 * 
 * @param {Function} runFn - Function that executes a scan and returns artifact paths or in-memory artifacts
 * @param {Object} options - Options
 * @param {number} options.runs - Number of runs (default: 2)
 * @param {Object} options.config - Configuration for runs
 * @param {boolean} options.normalize - Whether to normalize artifacts (default: true)
 * @returns {Promise<Object>} { verdict, summary, diffs, runsMeta }
 */
export async function runDeterminismCheck(runFn, options = { runs: 2, config: {}, normalize: true }) {
  const { runs = 2, config = {}, normalize = true } = options;
  
  const runsMeta = [];
  const runArtifacts = [];
  
  // Execute runs
  for (let i = 0; i < runs; i++) {
    const runResult = await runFn(config);
    runsMeta.push({
      runIndex: i + 1,
      runId: runResult.runId || null,
      timestamp: getTimeProvider().iso(),
      artifactPaths: runResult.artifactPaths || {},
      artifacts: runResult.artifacts || {},
    });
    
    // Load artifacts if paths provided
    const artifacts = {};
    if (runResult.artifactPaths) {
      for (const [key, path] of Object.entries(runResult.artifactPaths)) {
        try {
          const content = readFileSync(path, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
          artifacts[key] = JSON.parse(content);
        } catch (error) {
          // Artifact not found or invalid
        }
      }
    } else if (runResult.artifacts) {
      Object.assign(artifacts, runResult.artifacts);
    }
    
    runArtifacts.push(artifacts);
  }
  
  // Compare runs
  const diffs = [];
  const allArtifacts = new Set();
  
  // Collect all artifact names
  for (const artifacts of runArtifacts) {
    for (const key of Object.keys(artifacts)) {
      allArtifacts.add(key);
    }
  }
  
  // Compare each artifact across runs
  for (const artifactName of allArtifacts) {
    const artifacts = runArtifacts.map(run => run[artifactName]);
    
    // Normalize if requested
    const normalizedArtifacts = normalize
      ? artifacts.map(art => art ? normalizeArtifact(artifactName, art) : null)
      : artifacts;
    
    // Compare first run with all subsequent runs
    for (let i = 1; i < normalizedArtifacts.length; i++) {
      const artifactA = normalizedArtifacts[0];
      const artifactB = normalizedArtifacts[i];
      
      // Build finding identity map for findings artifacts
      let findingIdentityMap = null;
      if (artifactName === 'findings' && artifactA && artifactB) {
        findingIdentityMap = buildFindingIdentityMap(artifactA, artifactB);
      }
      
      const artifactDiffs = diffArtifacts(artifactA, artifactB, artifactName, findingIdentityMap);
      
      // Add run context to diffs
      for (const diff of artifactDiffs) {
        diff.runA = 1;
        diff.runB = i + 1;
      }
      
      diffs.push(...artifactDiffs);
    }
  }  // HARD RULE: If adaptive events exist → verdict MUST be NON_DETERMINISTIC
  let adaptiveVerdict = null;
  let adaptiveReasons = [];
  let adaptiveEvents = [];
  
  // Try to load decisions.json from first run
  if (runsMeta.length > 0 && runsMeta[0].artifactPaths?.runDir) {
    const runDir = runsMeta[0].artifactPaths.runDir;
    const decisionsPath = resolve(runDir, 'decisions.json');
    
    if (existsSync(decisionsPath)) {
      try {
  // @ts-expect-error - readFileSync with encoding returns string
        const decisionsData = JSON.parse(readFileSync(decisionsPath, 'utf-8'));
        const decisionRecorder = DecisionRecorder.fromExport(decisionsData);
        const adaptiveCheck = computeDeterminismVerdict(decisionRecorder);
        
        adaptiveVerdict = adaptiveCheck.verdict;
        adaptiveReasons = adaptiveCheck.reasons;
        adaptiveEvents = adaptiveCheck.adaptiveEvents;
      } catch (error) {
        // Ignore errors reading decisions
      }
    }
  }  // HARD RULE: If adaptive events exist → verdict MUST be NON_DETERMINISTIC (even if artifacts match)
  const blockerDiffs = diffs.filter(d => d.severity === 'BLOCKER');
  const artifactVerdict = blockerDiffs.length === 0 ? DETERMINISM_VERDICT.DETERMINISTIC : DETERMINISM_VERDICT.NON_DETERMINISTIC;  const verdict = (adaptiveVerdict === DETERMINISM_VERDICT.NON_DETERMINISTIC) 
    ? DETERMINISM_VERDICT.NON_DETERMINISTIC 
    : artifactVerdict;
  
  // Build summary
  const summary = buildSummary(diffs, runsMeta);  if (adaptiveVerdict === DETERMINISM_VERDICT.NON_DETERMINISTIC) {
    summary.adaptiveEventsDetected = true;
    summary.adaptiveEventCount = adaptiveEvents.length;
    summary.adaptiveReasons = adaptiveReasons;
  }
  
  return {
    verdict,
    summary,
    diffs,
    runsMeta,    adaptiveVerdict,
    adaptiveReasons,
    adaptiveEvents
  };
}

/**
 * Build finding identity map for matching findings across runs
 */
function buildFindingIdentityMap(artifactA, artifactB) {
  const map = new Map();
  
  const findingsA = artifactA.findings || [];
  const findingsB = artifactB.findings || [];
  
  // Build identity for findings in both runs
  for (const finding of [...findingsA, ...findingsB]) {
    const identity = computeFindingIdentity(finding);
    map.set(finding, identity);
  }
  
  return map;
}

/**
 * Build summary from diffs
 */
function buildSummary(diffs, _runsMeta) {
  const blockerCount = diffs.filter(d => d.severity === 'BLOCKER').length;
  const warnCount = diffs.filter(d => d.severity === 'WARN').length;
  const infoCount = diffs.filter(d => d.severity === 'INFO').length;
  
  // Group by reason code
  const reasonCounts = {};
  for (const diff of diffs) {
    const code = diff.reasonCode || 'UNKNOWN';
    reasonCounts[code] = (reasonCounts[code] || 0) + 1;
  }
  
  // Top reasons
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));
  
  // Stability score (0..1)
  const totalDiffs = diffs.length;
  const stabilityScore = totalDiffs === 0 ? 1.0 : Math.max(0, 1.0 - (blockerCount * 0.5 + warnCount * 0.2 + infoCount * 0.1) / Math.max(1, totalDiffs));
  
  return {
    totalDiffs,
    blockerCount,
    warnCount,
    infoCount,
    topReasons,
    stabilityScore,
  };
}




