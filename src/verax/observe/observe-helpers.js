/**
 * PHASE 21.3 — Observe Helpers
 * 
 * Helper functions extracted from observe/index.js to keep it slim
 */

import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { writeTraces } from './traces-writer.js';

/**
 * Setup manifest and expectations
 */
export async function setupManifestAndExpectations(manifestPath, projectDir, page, url, screenshotsDir, scanBudget, startTime, silenceTracker) {
  const { readFileSync, existsSync } = await import('fs');
  const { loadPreviousSnapshot, saveSnapshot: _saveSnapshot, buildSnapshot, compareSnapshots } = await import('../core/incremental-store.js');
  const { executeProvenExpectations } = await import('./expectation-executor.js');
  const { isProvenExpectation } = await import('../shared/expectation-prover.js');
  
  let manifest = null;
  let expectationResults = null;
  let expectationCoverageGaps = [];
  let incrementalMode = false;
  let snapshotDiff = null;
  let oldSnapshot = null;

  if (manifestPath && existsSync(manifestPath)) {
    try {
      const manifestContent = readFileSync(manifestPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
      manifest = JSON.parse(manifestContent);
      
      oldSnapshot = loadPreviousSnapshot(projectDir);
      if (oldSnapshot) {
        const currentSnapshot = buildSnapshot(manifest, []);
        snapshotDiff = compareSnapshots(oldSnapshot, currentSnapshot);
        incrementalMode = !snapshotDiff.hasChanges;
      }
      
      const provenCount = (manifest.staticExpectations || []).filter(exp => isProvenExpectation(exp)).length;
      if (provenCount > 0) {
        expectationResults = await executeProvenExpectations(page, manifest, url, screenshotsDir, scanBudget, startTime, projectDir);
        expectationCoverageGaps = expectationResults.coverageGaps || [];
      }
    } catch (err) {
      silenceTracker.record({
        scope: 'discovery',
        reason: 'discovery_error',
        description: 'Manifest load or expectation execution failed',
        context: { error: err?.message },
        impact: 'incomplete_check'
      });
    }
  }

  return { manifest, expectationResults, expectationCoverageGaps, incrementalMode, snapshotDiff, oldSnapshot };
}

/**
 * Process traversal results and build observation
 */
export async function processTraversalResults(traversalResult, expectationResults, expectationCoverageGaps, remainingInteractionsGaps, frontier, scanBudget, page, url, finalTraces, finalSkippedInteractions, finalObservedExpectations, silenceTracker, manifest, incrementalMode, snapshotDiff, projectDir, runId) {
  // Combine all coverage gaps
  const allCoverageGaps = [...expectationCoverageGaps];
  if (remainingInteractionsGaps.length > 0) {
    allCoverageGaps.push(...remainingInteractionsGaps.map(gap => ({
      expectationId: null,
      type: gap.interaction.type,
      reason: gap.reason,
      fromPath: gap.url,
      source: null,
      evidence: { interaction: gap.interaction }
    })));
  }
  
  if (frontier.frontierCapped) {
    allCoverageGaps.push({
      expectationId: null,
      type: 'navigation',
      reason: 'frontier_capped',
      fromPath: page.url(),
      source: null,
      evidence: { message: `Frontier capped at ${scanBudget.maxUniqueUrls || 'unlimited'} unique URLs` }
    });
  }

  // Build coverage object
  const coverage = {
    candidatesDiscovered: traversalResult.totalInteractionsDiscovered,
    candidatesSelected: traversalResult.totalInteractionsExecuted,
    cap: scanBudget.maxTotalInteractions,
    capped: traversalResult.totalInteractionsExecuted >= scanBudget.maxTotalInteractions || remainingInteractionsGaps.length > 0,
    pagesVisited: frontier.pagesVisited,
    pagesDiscovered: frontier.pagesDiscovered,
    skippedInteractions: finalSkippedInteractions.length,
    interactionsDiscovered: traversalResult.totalInteractionsDiscovered,
    interactionsExecuted: traversalResult.totalInteractionsExecuted
  };
  
  // Build warnings
  const observeWarnings = [];
  if (coverage.capped) {
    observeWarnings.push({
      code: 'INTERACTIONS_CAPPED',
      message: `Interaction execution capped. Visited ${coverage.pagesVisited} pages, discovered ${coverage.pagesDiscovered}, executed ${coverage.candidatesSelected} of ${coverage.candidatesDiscovered} interactions. Coverage incomplete.`
    });
  }
  if (finalSkippedInteractions.length > 0) {
    observeWarnings.push({
      code: 'INTERACTIONS_SKIPPED',
      message: `Skipped ${finalSkippedInteractions.length} dangerous interactions`,
      details: finalSkippedInteractions
    });
  }

  // Append expectation traces
  if (expectationResults?.results) {
    for (const result of expectationResults.results) {
      if (result.trace) {
        result.trace.expectationDriven = true;
        result.trace.expectationId = result.expectationId;
        result.trace.expectationOutcome = result.outcome;
        finalTraces.push(result.trace);
      }
    }
  }

  // Write traces
  const observation = writeTraces(projectDir, url, finalTraces, coverage, observeWarnings, finalObservedExpectations, silenceTracker, runId);
  observation.silences = silenceTracker.getDetailedSummary();

  // Add expectation execution results
  if (expectationResults) {
    observation.expectationExecution = {
      totalProvenExpectations: expectationResults.totalProvenExpectations,
      executedCount: expectationResults.executedCount,
      coverageGapsCount: allCoverageGaps.length,
      results: expectationResults.results.map(r => ({
        expectationId: r.expectationId,
        type: r.type,
        fromPath: r.fromPath,
        outcome: r.outcome,
        reason: r.reason
      }))
    };
    observation.expectationCoverageGaps = allCoverageGaps;
  }
  
  // Add incremental mode metadata
  if (manifest) {
    const { buildSnapshot, saveSnapshot } = await import('../core/incremental-store.js');
    const observedInteractions = finalTraces
      .filter(t => t.interaction && !t.incremental)
      .map(t => ({
        type: t.interaction?.type,
        selector: t.interaction?.selector,
        url: t.before?.url || url
      }));
    
    const currentSnapshot = buildSnapshot(manifest, observedInteractions);
    saveSnapshot(projectDir, currentSnapshot, runId);
    
    observation.incremental = {
      enabled: incrementalMode,
      snapshotDiff: snapshotDiff,
      skippedInteractionsCount: finalSkippedInteractions.filter(s => s.reason === 'incremental_unchanged').length
    };
  }

  return observation;
}

/**
 * Write determinism artifacts
 */
export async function writeDeterminismArtifacts(projectDir, runId, decisionRecorder) {  const { writeDeterminismContract } = await import('../core/determinism/contract-writer.js');
  const { getRunArtifactDir } = await import('../core/run-id.js');
  const runDir = getRunArtifactDir(projectDir, runId);
  writeDeterminismContract(runDir, decisionRecorder);
  if (!runId || !projectDir) return;
  
  const runsDir = resolve(projectDir, '.verax', 'runs', runId);
  mkdirSync(runsDir, { recursive: true });
  const decisionsPath = resolve(runsDir, 'decisions.json');
  writeFileSync(decisionsPath, JSON.stringify(decisionRecorder.export(), null, 2), 'utf-8');
  
  const { writeDeterminismReport } = await import('../core/determinism/report-writer.js');
  writeDeterminismReport(runsDir, decisionRecorder);
}




