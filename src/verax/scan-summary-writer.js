import { resolve } from 'path';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { computeExpectationsSummary } from './shared/artifact-manager.js';
import { createImpactSummary } from './core/silence-impact.js';
import { computeDecisionSnapshot } from './core/decision-snapshot.js';

export function writeScanSummary(projectDir, url, projectType, learnTruth, observeTruth, detectTruth, manifestPath, tracesPath, findingsPath, runDirOpt, findingsArray = null) {
  if (!runDirOpt) {
    throw new Error('runDirOpt is required');
  }
  const scanDir = resolve(runDirOpt);
  mkdirSync(scanDir, { recursive: true });
  
  // Compute expectations summary from manifest
  let expectationsSummary = { total: 0, navigation: 0, networkActions: 0, stateActions: 0 };
  if (manifestPath && existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      expectationsSummary = computeExpectationsSummary(manifest);
    } catch (error) {
      // Ignore errors reading manifest
    }
  }
  
  // PHASE 4: Compute silence impact summary
  let silenceImpactSummary = null;
  if (detectTruth?.silences?.entries) {
    silenceImpactSummary = createImpactSummary(detectTruth.silences.entries);
  }
  
  // PHASE 6: Compute determinism summary from decisions.json
  let determinismSummary = null;
  if (runDirOpt && observeTruth?.runId) {
    const decisionsPath = resolve(runDirOpt, 'decisions.json');
    if (existsSync(decisionsPath)) {
      try {
        const decisions = JSON.parse(readFileSync(decisionsPath, 'utf-8'));
        const { DecisionRecorder } = require('./core/determinism-model.js');
        const recorder = DecisionRecorder.fromExport(decisions);
        const summary = recorder.getSummary();
        
        determinismSummary = {
          isDeterministic: summary.isDeterministic,
          totalDecisions: summary.totalDecisions,
          decisionsByCategory: summary.decisionsByCategory,
          decisionsPath: decisionsPath
        };
      } catch (error) {
        // Ignore errors reading decisions
      }
    }
  }
  
  // PHASE 7: Compute decision snapshot (answers 6 mandatory questions)
  let decisionSnapshot = null;
  if (findingsArray && detectTruth && observeTruth) {
    const silences = detectTruth.silences;
    decisionSnapshot = computeDecisionSnapshot(findingsArray, detectTruth, observeTruth, silences);
  }
  
  const summary = {
    version: 1,
    scannedAt: new Date().toISOString(),
    url: url,
    projectType: projectType,
    expectationsSummary: expectationsSummary,
    // PHASE 7: Decision snapshot first (most important for human decision-making)
    decisionSnapshot: decisionSnapshot,
    // PHASE 7: Misinterpretation guards (explicit warnings)
    interpretationGuards: {
      zeroFindings: 'Zero findings does NOT mean no problems. Check unverified count and confidence level.',
      deterministicRun: 'Deterministic run does NOT mean correct site. Only means scan was reproducible.',
      highSilenceImpact: 'High silence impact does NOT mean failures exist. Only means unknowns affect confidence.'
    },
    truth: {
      learn: learnTruth,
      observe: observeTruth,
      detect: detectTruth
    },
    // PHASE 4: Add silence lifecycle and impact summary
    silenceLifecycle: detectTruth?.silences ? {
      total: detectTruth.silences.total || 0,
      byType: detectTruth.silences.summary?.byType || {},
      byEvaluationStatus: detectTruth.silences.summary?.byEvaluationStatus || {},
      byOutcome: detectTruth.silences.summary?.byOutcome || {},
      withPromiseAssociation: detectTruth.silences.summary?.withPromiseAssociation || 0,
      impactSummary: silenceImpactSummary
    } : null,
    // PHASE 6: Add determinism summary
    determinism: determinismSummary,
    paths: {
      manifest: manifestPath,
      traces: tracesPath,
      findings: findingsPath
    }
  };
  
  const summaryPath = resolve(scanDir, 'scan-summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  
  return {
    ...summary,
    summaryPath: summaryPath
  };
}

