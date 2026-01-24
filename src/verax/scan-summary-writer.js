import { getTimeProvider } from '../cli/util/support/time-provider.js';
import { resolve } from 'path';
import { mkdirSync, readFileSync, existsSync } from 'fs';
import { atomicWriteJsonSync } from '../cli/util/atomic-write.js';
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
  // @ts-expect-error - readFileSync with encoding returns string
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      expectationsSummary = computeExpectationsSummary(manifest);
    } catch (error) {
      // Ignore errors reading manifest
    }
  }
  
  // Compute silence impact summary from detected silences
  let silenceImpactSummary = null;
  if (detectTruth?.silences?.entries) {
    silenceImpactSummary = createImpactSummary(detectTruth.silences.entries);
  }
  
  // Compute determinism summary from decisions.json if available
  let determinismSummary = null;
  if (runDirOpt && observeTruth?.runId) {
    const decisionsPath = resolve(runDirOpt, 'decisions.json');
    if (existsSync(decisionsPath)) {
      try {
  // @ts-expect-error - readFileSync with encoding returns string
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
  
  // Compute decision snapshot from findings and detection truth
  let decisionSnapshot = null;
  if (findingsArray && detectTruth && observeTruth) {
    const silences = detectTruth.silences;
    decisionSnapshot = computeDecisionSnapshot(findingsArray, detectTruth, observeTruth, silences);
  }
  
  const summary = {
    version: 1,
    scannedAt: getTimeProvider().iso(),
    url: url,
    projectType: projectType,
    expectationsSummary: expectationsSummary,
    // Decision snapshot first (most important for human decision-making)
    decisionSnapshot: decisionSnapshot,
    // Interpretation guards (explicit warnings for misreading summary)
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
    // Silence lifecycle and impact summary
    silenceLifecycle: detectTruth?.silences ? {
      total: detectTruth.silences.total || 0,
      byType: detectTruth.silences.summary?.byType || {},
      byEvaluationStatus: detectTruth.silences.summary?.byEvaluationStatus || {},
      byOutcome: detectTruth.silences.summary?.byOutcome || {},
      withPromiseAssociation: detectTruth.silences.summary?.withPromiseAssociation || 0,
      impactSummary: silenceImpactSummary
    } : null,
    // Determinism summary
    determinism: determinismSummary,
    paths: {
      manifest: manifestPath,
      traces: tracesPath,
      findings: findingsPath
    }
  };
  
  const summaryPath = resolve(scanDir, 'scan-summary.json');
  atomicWriteJsonSync(summaryPath, summary);
  
  return {
    ...summary,
    summaryPath: summaryPath
  };
}




