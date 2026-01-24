import { resolve } from 'path';
import { atomicWriteJson } from '../support/atomic-write.js';
import { ARTIFACT_REGISTRY } from '../../../verax/core/artifacts/registry.js';

/**
 * Write coverage.json using observation stats (deterministic, evidence-based)
 * Ensures canonical fields for Output Contract 2.0
 *
 * @param {string} runDir
 * @param {Object} observeData
 * @param {number} minCoverage
 */
export function writeCoverageJson(runDir, observeData, minCoverage = 0.9) {
  const coveragePath = resolve(runDir, 'coverage.json');

  const total = Number(observeData?.stats?.totalExpectations || 0);
  const attempted = Number(observeData?.stats?.attempted || 0);
  const observed = Number(observeData?.stats?.observed || observeData?.stats?.completed || 0);
  const skipped = Math.max(0, total - attempted);

  const skippedReasonsMap = observeData?.stats?.skippedReasons || {};
  const legalReasons = ['auth_required', 'infra_failure'];
  let legallySkipped = 0;
  let illegallySkipped = 0;
  const skipReasonCounts = {};
  const illegalSkipReasons = [];

  Object.keys(skippedReasonsMap).forEach((key) => {
    const count = Number(skippedReasonsMap[key] || 0);
    const reason = String(key || 'unknown').toLowerCase();
    skipReasonCounts[reason] = count;
    if (legalReasons.includes(reason)) legallySkipped += count; else illegallySkipped += count;
    if (!legalReasons.includes(reason)) illegalSkipReasons.push(reason);
  });

  const denominator = Math.max(0, total - legallySkipped);
  const coverageRatio = denominator > 0 ? observed / denominator : 0;
  const coveragePercent = Math.round(coverageRatio * 100);

  const payload = {
    contractVersion: ARTIFACT_REGISTRY.coverage?.contractVersion || 1,
    total,
    attempted,
    observed,
    skipped,
    legallySkipped,
    illegallySkipped,
    attemptedNotObserved: Math.max(0, attempted - observed),
    skipReasonCounts,
    illegalSkipReasons,
    coverageRatio,
    coveragePercent,
    threshold: minCoverage,
    status: total === 0 ? 'INCOMPLETE' : (coverageRatio >= minCoverage ? 'PASS' : 'FAIL'),
  };

  atomicWriteJson(coveragePath, payload);
}
