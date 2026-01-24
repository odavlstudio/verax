import { getTimeProvider } from '../../cli/util/support/time-provider.js';
/**
 * Wave 9 — Artifact Manager
 *
 * Manages the new artifact directory structure:
 * .verax/runs/<runId>/
 *   - summary.json (overall scan results, metrics)
 *   - findings.json (all findings)
 *   - traces.jsonl (one JSON per line, per interaction)
 *   - evidence/ (screenshots, network logs, etc.)
 *   - flows/ (flow diagrams if enabled)
 *
 * All artifacts are redacted before writing.
 * All writes use atomic operations to prevent corruption (Week 3).
 */

import { existsSync, appendFileSync } from 'fs';
import { resolve } from 'path';
import { atomicWriteFileSync, atomicWriteJsonSync, atomicMkdirSync } from '../../cli/util/atomic-write.js';
import { generateRunId as generateDeterministicRunId } from '../core/run-id.js';
import { generateScanId, generateUniqueRunId } from '../../cli/util/support/run-id.js';

const ZERO_BUDGET = Object.freeze({
  maxScanDurationMs: 0,
  maxInteractionsPerPage: 0,
  maxUniqueUrls: 0,
  interactionTimeoutMs: 0,
  navigationTimeoutMs: 0,
});

/**
 * Generate a unique run ID.
 * @returns {string} - 8-character hex ID
 */
export function generateRunId(seed = 'about:blank') {
  let baseOrigin = 'about:blank';
  try {
    baseOrigin = new URL(seed).origin;
  } catch {
    baseOrigin = seed;
  }
  return generateDeterministicRunId({
    url: seed,
    safetyFlags: {},
    baseOrigin,
    scanBudget: ZERO_BUDGET,
    manifestPath: null,
  });
}

/**
 * Create artifact directory structure.
 * @param {string} projectRoot - Project root directory
 * @param {string} runId - Run identifier
 * @returns {Object} - Paths to each artifact location
 */
export function initArtifactPaths(projectRoot, runId = null, seed = projectRoot) {
  const scanId = generateScanId({ url: typeof seed === 'string' ? seed : 'about:blank', srcPath: projectRoot });
  const id = runId || generateUniqueRunId();
  const runDir = resolve(projectRoot, '.verax', 'runs', scanId, id);

  const paths = {
    scanId,
    runId: id,
    runDir,
    summary: resolve(runDir, 'summary.json'),
    findings: resolve(runDir, 'findings.json'),
    expectations: resolve(runDir, 'expectations.json'),
    traces: resolve(runDir, 'traces.jsonl'),
    evidence: resolve(runDir, 'evidence'),
    flows: resolve(runDir, 'flows'),
    artifacts: resolve(projectRoot, '.verax', 'artifacts') // Legacy compat
  };

  // Create directories using atomic mkdir
  [resolve(projectRoot, '.verax', 'runs', scanId), runDir, paths.evidence, paths.flows].forEach(dir => {
    if (!existsSync(dir)) {
      // @ts-ignore - atomicMkdirSync supports recursive option
      atomicMkdirSync(dir, { recursive: true });
    }
  });

  return paths;
}

/**
 * Compute expectations summary from manifest
 * @param {Object} manifest - Manifest object
 * @returns {Object} Expectations summary
 */
export function computeExpectationsSummary(manifest) {
  const staticExpectations = manifest.staticExpectations || [];
  const spaExpectations = manifest.spaExpectations || [];
  const actionContracts = manifest.actionContracts || [];
  const proven = (item) => item && item.proof === 'PROVEN_EXPECTATION';
  
  // Count by type
  let navigation = 0;
  let networkActions = 0;
  let stateActions = 0;
  
  // Static expectations: navigation, form_submission, network_action, state_action
  for (const exp of staticExpectations) {
    if (!proven(exp)) continue;
    if (exp.type === 'navigation' || exp.type === 'spa_navigation') {
      navigation++;
    } else if (exp.type === 'form_submission') {
      networkActions++; // Form submissions are network actions
    } else if (exp.type === 'network_action') {
      networkActions++;
    } else if (exp.type === 'state_action') {
      stateActions++;
    }
  }
  
  // SPA expectations: navigation
  for (const exp of spaExpectations) {
    if (!proven(exp)) continue;
    if (exp.type === 'navigation') {
      navigation++;
    }
  }
  
  // Action contracts: network and state actions
  for (const contract of actionContracts) {
    if (!proven(contract)) continue;
    if (contract.kind === 'NETWORK_ACTION' || contract.kind === 'network' || contract.kind === 'fetch' || contract.kind === 'axios') {
      networkActions++;
    } else if (contract.kind === 'STATE_ACTION' || contract.kind === 'state' || contract.kind === 'redux' || contract.kind === 'zustand') {
      stateActions++;
    }
  }
  
  const total = navigation + networkActions + stateActions;
  
  return {
    total,
    navigation,
    networkActions,
    stateActions
  };
}

/**
 * Write summary.json with metadata and metrics.
 * Uses atomic write to prevent corruption (Week 3).
 * @param {Object} paths - Artifact paths from initArtifactPaths
 * @param {Object} summary - Summary data { url, duration, findings, metrics, manifest, contextCheck }
 */
export function writeSummary(paths, summary) {
  const expectationsSummary = summary.manifest 
    ? computeExpectationsSummary(summary.manifest)
    : { total: 0, navigation: 0, networkActions: 0, stateActions: 0 };
  
  const contextCheck = summary.contextCheck || {
    ran: false,
    forced: false,
    matchedRoutesCount: 0,
    matchedLinksCount: 0,
    sampleMatched: []
  };
  
  const metrics = summary.metrics || {
    learnMs: 0,
    validateMs: 0,
    observeMs: 0,
    detectMs: 0,
    totalMs: 0
  };
  
  const safety = summary.safety || {
    publicUrlConfirmed: false,
    usedYesFlag: false
  };
  
  const data = {
    runId: paths.runId,
    timestamp: getTimeProvider().iso(),
    url: summary.url,
    projectRoot: summary.projectRoot,
    expectationsSummary: expectationsSummary,
    contextCheck: {
      ran: contextCheck.ran,
      forced: contextCheck.forced || false,
      matchedRoutesCount: contextCheck.matchedRoutesCount || 0,
      matchedLinksCount: contextCheck.matchedLinksCount || 0,
      sampleMatched: (contextCheck.sampleMatched || []).slice(0, 5)
    },
    safety: {
      publicUrlConfirmed: safety.publicUrlConfirmed || false,
      usedYesFlag: safety.usedYesFlag || false
    },
    metrics: {
      learnMs: metrics.learnMs || 0,
      validateMs: metrics.validateMs || 0,
      observeMs: metrics.observeMs || 0,
      detectMs: metrics.detectMs || 0,
      totalMs: metrics.totalMs || 0
    },
    findingsCounts: summary.findingsCounts || {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      UNKNOWN: 0
    },
    topFindings: summary.topFindings || [],
    cacheStats: summary.cacheStats || {},
    progressStats: summary.progressStats || null,
    interactionStats: summary.interactionStats || null,
    expectationUsageStats: summary.expectationUsageStats || null,
    runOverview: summary.runOverview || null,
    coverage: summary.coverage || null,
    coverageGaps: summary.coverageGaps || []
  };

  atomicWriteJsonSync(paths.summary, data);
}

/**
 * Write findings.json with all detected issues.
 * Uses atomic write to prevent corruption (Week 3).
 * @param {Object} paths - Artifact paths
 * @param {Array} findings - Array of finding objects
 */
export function writeFindings(paths, findings) {
  const data = {
    runId: paths.runId,
    timestamp: getTimeProvider().iso(),
    total: findings.length,
    findings
  };

  atomicWriteJsonSync(paths.findings, data);
}

/**
 * Append a trace to traces.jsonl (one JSON object per line).
 * @param {Object} paths - Artifact paths
 * @param {Object} trace - Trace object to append
 */
export function appendTrace(paths, trace) {
  const line = JSON.stringify(trace) + '\n';
  appendFileSync(paths.traces, line);
}

/**
 * Write evidence file (screenshot, network log, etc.).
 * Uses atomic write to prevent corruption (Week 3).
 * @param {Object} paths - Artifact paths
 * @param {string} filename - Evidence filename
 * @param {*} data - Data to write (string or buffer)
 */
export function writeEvidence(paths, filename, data) {
  const filepath = resolve(paths.evidence, filename);
  
  atomicWriteFileSync(filepath, data);
}

/**
 * Get all artifact paths for a given run.
 * @param {string} projectRoot - Project root
 * @param {string} runId - Run identifier
 * @returns {Object} - Paths object
 */
export function getArtifactPaths(projectRoot, runId) {
  return initArtifactPaths(projectRoot, runId);
}



