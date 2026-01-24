/**
 * Gate Engine (PHASE 5.9)
 *
 * Enterprise CI release gate orchestration.
 * Evidence-only, deterministic decision-making.
 */

import { join } from 'path';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { getTimeProvider } from '../cli/util/support/time-provider.js';
import { EXIT_CODES } from '../cli/config/cli-contract.js';

/**
 * Analyze run artifacts and generate gate report
 * @param {string} projectRoot - Project root directory
 * @param {string} runId - Run ID to analyze
 * @param {Object} options - Gate options
 * @returns {Promise<Object>} Gate analysis result
 */
export async function analyzeRun(projectRoot, runId, options = {}) {
  const {
    failOnIncomplete = true,
    runExitCode = 0,
    runDir: providedRunDir,
  } = options;

  const runDir = providedRunDir || join(projectRoot, '.verax', 'runs', runId);

  if (!existsSync(runDir)) {
    throw new Error(`Run directory not found: ${runDir}`);
  }

  // Load run artifacts
  const summaryPath = join(runDir, 'summary.json');
  const runMetaPath = join(runDir, 'run.meta.json');
  const policyPath = join(projectRoot, '.verax', 'policy.json');

  let summary = null;
  let runMeta = null;
  let policy = null;

  if (existsSync(summaryPath)) {
    try {
      summary = JSON.parse(String(readFileSync(summaryPath, 'utf-8')));
    } catch (e) {
      // Ignore parse errors
    }
  }

  if (existsSync(runMetaPath)) {
    try {
      runMeta = JSON.parse(String(readFileSync(runMetaPath, 'utf-8')));
    } catch (e) {
      // Ignore parse errors
    }
  }

  if (existsSync(policyPath)) {
    try {
      policy = JSON.parse(String(readFileSync(policyPath, 'utf-8')));
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Compute non-suppressed findings
  const findingsCounts = summary?.findingsCounts || { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  
  // Apply policy suppressions if policy exists
  let nonSuppressedCounts = { ...findingsCounts };
  if (policy && policy.ignore && Array.isArray(policy.ignore)) {
    // For gate purposes, we count suppressed findings as non-actionable
    // This is a simplification - in reality we'd need to load findings and check suppressions
    // For now, we trust that the run command already applied policy
  }

  // Check for stability artifact
  let stabilityClassification = 'UNKNOWN';
  const stabilityPath = join(runDir, 'stability.json');
  if (existsSync(stabilityPath)) {
    try {
      const stability = JSON.parse(String(readFileSync(stabilityPath, 'utf-8')));
      stabilityClassification = stability.classification || 'UNKNOWN';
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Check for triage artifact
  let triageTrust = 'UNKNOWN';
  const triagePath = join(runDir, 'triage.json');
  if (existsSync(triagePath)) {
    try {
      const triage = JSON.parse(String(readFileSync(triagePath, 'utf-8')));
      triageTrust = triage.trustLevel || 'UNKNOWN';
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Check for diagnostics artifact
  let diagnosticsTiming = null;
  const diagnosticsPath = join(runDir, 'diagnostics.json');
  if (existsSync(diagnosticsPath)) {
    try {
      const diagnostics = JSON.parse(String(readFileSync(diagnosticsPath, 'utf-8')));
      diagnosticsTiming = diagnostics.timing || null;
    } catch (e) {
      // Ignore parse errors
    }
  }

  return {
    runId,
    runDir,
    runMeta,
    summary,
    runExitCode,
    findingsCounts: nonSuppressedCounts,
    stabilityClassification,
    triageTrust,
    diagnosticsTiming,
    failOnIncomplete,
  };
}

/**
 * Compute gate decision based on evidence.
 * 
 * DECISION ORDER (priority from highest to lowest):
 * 1. INFRA_FAILURE (40) - Tool crash/internal error
 * 2. USAGE_ERROR (64) - Usage errors
 * 3. EVIDENCE_VIOLATION (50) - Artifact validation failures
 * 4. INCOMPLETE (30) - Run incomplete with fail-on-incomplete=true
 * 5. FAILURE_CONFIRMED (20) - Actionable findings detected
 * 6. NEEDS_REVIEW (10) - Suspected only or fail-on-incomplete=false
 * 7. PASS (0) - All checks passed
 * 
 * This is a pure function - no I/O, no side effects, deterministic output.
 * 
 * @param {Object} analysis - Analysis result from analyzeRun
 * @returns {Object} Gate decision with outcome and reason
 */
export function computeGateDecision(analysis) {
  const {
    runExitCode,
    findingsCounts,
    stabilityClassification,
    failOnIncomplete,
    _summary,
  } = analysis;

  if (runExitCode === EXIT_CODES.INFRA_FAILURE) {
    return {
      outcome: 'INFRA_FAILURE',
      reason: 'Underlying scan failed to execute',
      exitCode: EXIT_CODES.INFRA_FAILURE,
    };
  }

  if (runExitCode === EXIT_CODES.USAGE_ERROR) {
    return {
      outcome: 'USAGE_ERROR',
      reason: 'Usage error (scan invocation invalid)',
      exitCode: EXIT_CODES.USAGE_ERROR,
    };
  }

  if (runExitCode === EXIT_CODES.EVIDENCE_VIOLATION) {
    return {
      outcome: 'EVIDENCE_VIOLATION',
      reason: 'Artifacts failed validation',
      exitCode: EXIT_CODES.EVIDENCE_VIOLATION,
    };
  }

  if (runExitCode === EXIT_CODES.FAILURE_INCOMPLETE && failOnIncomplete) {
    return {
      outcome: 'INCOMPLETE',
      reason: 'Run incomplete and gating requires completeness',
      exitCode: EXIT_CODES.FAILURE_INCOMPLETE,
    };
  }

  const hasActionableFindings = 
    Number(findingsCounts.HIGH || 0) > 0 ||
    Number(findingsCounts.MEDIUM || 0) > 0 ||
    Number(findingsCounts.LOW || 0) > 0;
  const hasSuspectedOnly = Number(findingsCounts.UNKNOWN || 0) > 0 && !hasActionableFindings;

  if (runExitCode === EXIT_CODES.FAILURE_CONFIRMED || hasActionableFindings) {
    return {
      outcome: 'FAILURE_CONFIRMED',
      reason: `Actionable findings detected: HIGH=${findingsCounts.HIGH || 0} MEDIUM=${findingsCounts.MEDIUM || 0} LOW=${findingsCounts.LOW || 0}`,
      exitCode: EXIT_CODES.FAILURE_CONFIRMED,
    };
  }

  if (runExitCode === EXIT_CODES.NEEDS_REVIEW || hasSuspectedOnly) {
    return {
      outcome: 'NEEDS_REVIEW',
      reason: 'Suspected findings require review',
      exitCode: EXIT_CODES.NEEDS_REVIEW,
    };
  }

  if (runExitCode === EXIT_CODES.FAILURE_INCOMPLETE && !failOnIncomplete) {
    return {
      outcome: 'NEEDS_REVIEW',
      reason: 'Run incomplete but fail-on-incomplete=false; manual review required',
      exitCode: EXIT_CODES.NEEDS_REVIEW,
    };
  }

  // Check stability classification - UNSTABLE without findings requires review
  if (stabilityClassification === 'UNSTABLE' && !hasActionableFindings) {
    return {
      outcome: 'NEEDS_REVIEW',
      reason: 'Stability classification is UNSTABLE',
      exitCode: EXIT_CODES.NEEDS_REVIEW,
    };
  }

  return {
    outcome: 'PASS',
    reason: 'All gate checks passed',
    exitCode: EXIT_CODES.SUCCESS,
  };
}

/**
 * Generate gate report and write to run directory
 * @param {Object} analysis - Analysis result
 * @param {Object} decision - Gate decision
 * @returns {Object} Gate report
 */
export function generateGateReport(analysis, decision) {
  const {
    runId,
    runMeta,
    summary,
    runExitCode,
    findingsCounts,
    stabilityClassification,
    triageTrust,
    diagnosticsTiming,
    failOnIncomplete,
  } = analysis;

  const timeProvider = getTimeProvider();

  const report = {
    gateVersion: 1,
    generatedAt: timeProvider.iso(),
    runId,
    meta: {
      veraxVersion: runMeta?.veraxVersion || 'unknown',
      url: summary?.url || runMeta?.url || 'unknown',
      profile: runMeta?.profile || 'unknown',
    },
    run: {
      status: summary?.status || 'UNKNOWN',
      exitCode: runExitCode,
      startedAt: runMeta?.startedAt || null,
      completedAt: runMeta?.completedAt || null,
    },
    findings: {
      nonSuppressed: findingsCounts,
      hasActionable: (findingsCounts.HIGH || 0) > 0 || (findingsCounts.MEDIUM || 0) > 0 || (findingsCounts.LOW || 0) > 0,
    },
    stability: {
      classification: stabilityClassification,
      available: stabilityClassification !== 'UNKNOWN',
    },
    triage: {
      trustLevel: triageTrust,
      available: triageTrust !== 'UNKNOWN',
    },
    diagnostics: {
      timing: diagnosticsTiming,
      available: diagnosticsTiming !== null,
    },
    gate: {
      failOnIncomplete,
      decision: decision.outcome,
      reason: decision.reason,
      exitCode: decision.exitCode,
    },
  };

  return report;
}

/**
 * Write gate report to run directory
 * @param {string} runDir - Run directory path
 * @param {Object} report - Gate report
 */
export function writeGateReport(runDir, report) {
  const gatePath = join(runDir, 'gate.json');
  writeFileSync(gatePath, JSON.stringify(report, null, 2));
}
