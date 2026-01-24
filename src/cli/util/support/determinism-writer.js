import { getTimeProvider } from './time-provider.js';
/**
 * PHASE 18 — Determinism Report Writer
 * 
 * Writes determinism check results to artifact.
 */

import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { ARTIFACT_REGISTRY, getArtifactVersions } from '../../../verax/core/artifacts/registry.js'; // eslint-disable-line no-unused-vars

let reportCounter = 0;

/**
 * PHASE 18: Write determinism report
 * PHASE 25: Enhanced with runFingerprint, contract validation, and structured verdicts
 * 
 * @param {Object} determinismResult - Result from runDeterminismCheck
 * @param {Array} verificationResults - Verification results for each run
 * @param {string} outDir - Output directory
 * @returns {Promise<string>} Path to determinism report
 */
export async function writeDeterminismReport(determinismResult, verificationResults, outDir) {
  const reportsDir = resolve(outDir, 'determinism');
  mkdirSync(reportsDir, { recursive: true });

  reportCounter += 1;
  const reportId = `determinism-${reportCounter.toString().padStart(6, '0')}`;
  const reportPath = resolve(reportsDir, `${reportId}.json`);
  
  // PHASE 25: Check run fingerprints
  const runFingerprints = [];
  const runFingerprintMismatches = [];
  for (const runMeta of determinismResult.runsMeta) {
    if (runMeta.runFingerprint) {
      runFingerprints.push(runMeta.runFingerprint);
    }
  }
  if (runFingerprints.length > 1) {
    const firstFingerprint = runFingerprints[0];
    for (let i = 1; i < runFingerprints.length; i++) {
      if (runFingerprints[i] !== firstFingerprint) {
        runFingerprintMismatches.push({
          runIndex: i + 1,
          expected: firstFingerprint,
          actual: runFingerprints[i]
        });
      }
    }
  }
  
  // PHASE 25: Check verifier errors
  const verifierErrors = [];
  for (const verification of verificationResults) {
    if (verification.verification && !verification.verification.ok) {
      verifierErrors.push({
        runId: verification.runId,
        errors: verification.verification.errors || [],
        verdictStatus: verification.verification.verdictStatus
      });
    }
  }
  
  // PHASE 25: Determine final verdict with expected/unexpected distinction
  let finalVerdict = determinismResult.verdict;
  if (runFingerprintMismatches.length > 0) {
    finalVerdict = 'NON_DETERMINISTIC_UNEXPECTED';
  } else if (verifierErrors.length > 0) {
    finalVerdict = 'NON_DETERMINISTIC_UNEXPECTED';
  } else if (determinismResult.adaptiveEvents && determinismResult.adaptiveEvents.length > 0) {
    finalVerdict = 'NON_DETERMINISTIC_EXPECTED';
  } else if (determinismResult.diffs && determinismResult.diffs.length > 0) {
    const blockerDiffs = determinismResult.diffs.filter(d => d.severity === 'BLOCKER');
    if (blockerDiffs.length > 0) {
      finalVerdict = 'NON_DETERMINISTIC_UNEXPECTED';
    } else {
      finalVerdict = 'NON_DETERMINISTIC_EXPECTED';
    }
  }
  
  // PHASE 25: Build top reasons
  const topReasons = [];
  if (runFingerprintMismatches.length > 0) {
    topReasons.push({ code: 'RUN_FINGERPRINT_MISMATCH', count: runFingerprintMismatches.length });
  }
  if (verifierErrors.length > 0) {
    topReasons.push({ code: 'VERIFIER_ERRORS_DETECTED', count: verifierErrors.length });
  }
  if (determinismResult.adaptiveEvents && determinismResult.adaptiveEvents.length > 0) {
    topReasons.push({ code: 'EXPECTED_ADAPTIVE_BEHAVIOR', count: determinismResult.adaptiveEvents.length });
  }
  if (determinismResult.diffs && determinismResult.diffs.length > 0) {
    const blockerCount = determinismResult.diffs.filter(d => d.severity === 'BLOCKER').length;
    if (blockerCount > 0) {
      topReasons.push({ code: 'ARTIFACT_DIFF_DETECTED', count: blockerCount });
    }
  }
  
  const report = {
    version: 2, // PHASE 25: Bump version
    contractVersion: 1,
    artifactVersions: getArtifactVersions(),
    generatedAt: getTimeProvider().iso(),
    verdict: finalVerdict,
    summary: {
      ...determinismResult.summary,
      runFingerprintMismatches: runFingerprintMismatches.length,
      verifierErrors: verifierErrors.length,
      topReasons: topReasons.slice(0, 10)
    },
    runsMeta: determinismResult.runsMeta,
    runFingerprints,
    runFingerprintMismatches,
    verificationResults,
    verifierErrors,
    normalizationRulesApplied: [
      'Stripped timestamps (startedAt, completedAt, detectedAt, etc.)',
      'Stripped runId fields',
      'Normalized absolute paths to relative',
      'Normalized floating scores to 3 decimals',
      'Sorted arrays by stable keys',
      'Normalized evidence paths but preserved presence/absence',
    ],
    diffs: determinismResult.diffs,
    adaptiveEvents: determinismResult.adaptiveEvents || [],
    stabilityScore: determinismResult.summary.stabilityScore,
  };
  
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  
  return reportPath;
}




