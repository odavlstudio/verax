const fs = require('fs');

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function deriveAttemptSummary(attempts = []) {
  const summary = {
    total: 0,
    executed: 0,
    skipped: 0,
    notApplicable: 0,
    failed: 0,
    friction: 0,
    success: 0
  };

  for (const attempt of attempts) {
    if (!attempt) continue;
    const outcome = (attempt.outcome || '').toUpperCase();
    summary.total += 1;

    const executedFlag =
      attempt.executed === true ||
      (attempt.executed === undefined && ['SUCCESS', 'FAILURE', 'FRICTION'].includes(outcome));

    if (executedFlag) {
      summary.executed += 1;
      if (outcome === 'SUCCESS') summary.success += 1;
      if (outcome === 'FAILURE') summary.failed += 1;
      if (outcome === 'FRICTION') summary.friction += 1;
    } else if (outcome === 'SKIPPED') {
      summary.skipped += 1;
    } else if (outcome === 'NOT_APPLICABLE' || outcome === 'DISCOVERY_FAILED') {
      summary.notApplicable += 1;
    }
  }

  return summary;
}

function deriveCoveragePercent(snapshotCoverage = {}, attemptSummary = null) {
  const counts = snapshotCoverage?.counts || snapshotCoverage || {};
  const attemptBased = attemptSummary && attemptSummary.total > 0
    ? Math.max(0, Math.min(100, Math.round((attemptSummary.executed / attemptSummary.total) * 100)))
    : null;

  if (counts.percent !== null) {
    // Override obviously-wrong zero when we have executed attempts and a computed percent
    if (counts.percent === 0 && attemptBased !== null && attemptSummary.executed > 0) {
      return attemptBased;
    }
    return counts.percent;
  }

  if (attemptBased !== null) {
    return attemptBased;
  }

  const executed = counts.executedCount ?? attemptSummary?.executed ?? 0;
  const enabled = counts.enabledPlannedCount ?? attemptSummary?.total ?? 0;
  const excluded = counts.excludedNotApplicableFromTotal ?? counts.skippedNotApplicable ?? attemptSummary?.notApplicable ?? 0;
  const userFiltered = counts.skippedUserFiltered ?? attemptSummary?.skipped ?? 0;

  const denominator = Math.max(enabled - excluded - userFiltered, 0);
  if (denominator === 0) return 0;
  return Math.max(0, Math.min(100, Math.round((executed / denominator) * 100)));
}

function deriveUntested(snapshotCoverage = {}, attempts = []) {
  const details = [];
  const addDetail = (items, label) => {
    (items || []).forEach(item => {
      if (item?.attempt) {
        details.push(`${label}:${item.attempt}${item.reason ? ` (${item.reason})` : ''}`);
      }
    });
  };

  addDetail(snapshotCoverage.skippedNotApplicable, 'n/a');
  addDetail(snapshotCoverage.skippedUserFiltered, 'skipped');
  addDetail(snapshotCoverage.skippedDisabledByPreset, 'disabled');
  addDetail(snapshotCoverage.skippedMissing, 'missing');

  if (details.length === 0 && attempts.length > 0) {
    attempts.filter(a => !a.executed && a.outcome === 'SKIPPED').forEach(a => details.push(`skipped:${a.attemptId}`));
    attempts.filter(a => a.outcome === 'NOT_APPLICABLE').forEach(a => details.push(`n/a:${a.attemptId}`));
  }

  return details;
}

function deriveFromSnapshot(snapshot) {
  if (!snapshot) return null;
  const verdict = snapshot.verdict?.verdict || snapshot.meta?.result || null;
  if (!verdict) return null;

  const attempts = snapshot.attempts || [];
  const attemptSummary = deriveAttemptSummary(attempts);
  const coveragePercent = deriveCoveragePercent(snapshot.meta?.coverage || snapshot.coverage || {}, attemptSummary);
  const evidenceCompleteness = snapshot.meta?.evidenceMetrics?.completeness ?? snapshot.evidenceMetrics?.completeness ?? null;
  const confidenceScore = snapshot.verdict?.confidence?.score ?? null;
  const confidenceBasis = snapshot.verdict?.confidence?.basis ?? '';
  const exitCode = snapshot.meta?.exitCode ?? null;
  const untested = deriveUntested(snapshot.meta?.coverage || snapshot.coverage || {}, attempts);

  return {
    source: 'snapshot',
    finalVerdict: verdict,
    exitCode,
    coveragePercent,
    confidenceScore,
    confidenceBasis,
    evidenceCompleteness,
    attemptSummary,
    untested
  };
}

function deriveFromDecision(decision) {
  if (!decision) return null;
  const verdict = decision.finalVerdict || null;
  if (!verdict) return null;
  const attempts = Array.isArray(decision.outcomes?.attempts) ? decision.outcomes.attempts : [];
  const attemptSummary = deriveAttemptSummary(attempts);
  const coverageCounts = decision.coverage || {};
  const coveragePercent = deriveCoveragePercent(coverageCounts, attemptSummary);
  const confidenceScore = decision.confidence?.score ?? null;
  const evidenceCompleteness = decision.inputs?.policy?.evidenceCompleteness ?? null;
  const untested = deriveUntested(coverageCounts, attempts);

  return {
    source: 'decision',
    finalVerdict: verdict,
    exitCode: decision.exitCode ?? null,
    coveragePercent,
    confidenceScore,
    confidenceBasis: decision.confidence?.basis || '',
    evidenceCompleteness,
    attemptSummary,
    untested
  };
}

function buildCanonicalTruth({ snapshotPath, decisionPath, snapshot, decision }) {
  const snapCandidates = [];
  if (snapshot) snapCandidates.push(snapshot);
  if (snapshotPath) {
    const snapFromDisk = safeReadJson(snapshotPath);
    if (snapFromDisk) snapCandidates.push(snapFromDisk);
  }

  let snapCanonical = null;
  for (const candidate of snapCandidates) {
    const derived = deriveFromSnapshot(candidate);
    if (!derived) continue;
    if (!snapCanonical || (derived.attemptSummary?.total || 0) > (snapCanonical.attemptSummary?.total || 0)) {
      snapCanonical = derived;
    }
  }

  const decObj = decision || (decisionPath ? safeReadJson(decisionPath) : null);

  let decCanonical = deriveFromDecision(decObj);
  if (!decCanonical && decisionPath && !decision) {
    decCanonical = deriveFromDecision(safeReadJson(decisionPath));
  }

  let canonical = snapCanonical || decCanonical;

  // Prefer the source with richer attempt data when both exist
  if (snapCanonical && decCanonical) {
    const snapAttempts = snapCanonical.attemptSummary?.total || 0;
    const decAttempts = decCanonical.attemptSummary?.total || 0;
    canonical = snapAttempts >= decAttempts ? snapCanonical : decCanonical;
  }

  if (!canonical) {
    throw new Error('Canonical truth could not be derived: missing snapshot/decision verdict');
  }

  // Fill gaps from the other source if available
  if (canonical === snapCanonical && decCanonical) {
    canonical.exitCode = canonical.exitCode ?? decCanonical.exitCode;
    const decCoverage = decCanonical.coveragePercent ?? 0;
    if (canonical.coveragePercent === null || (canonical.coveragePercent === 0 && decCoverage > 0)) {
      canonical.coveragePercent = decCoverage;
    }
    const decConfidence = decCanonical.confidenceScore ?? 0;
    if (canonical.confidenceScore === null || (canonical.confidenceScore === 0 && decConfidence > 0)) {
      canonical.confidenceScore = decConfidence;
    }
    canonical.confidenceBasis = canonical.confidenceBasis || decCanonical.confidenceBasis || '';
    canonical.evidenceCompleteness = canonical.evidenceCompleteness ?? decCanonical.evidenceCompleteness;
    if (!canonical.attemptSummary || canonical.attemptSummary.total === 0) {
      canonical.attemptSummary = decCanonical.attemptSummary;
    }
    if ((!canonical.untested || canonical.untested.length === 0) && decCanonical.untested?.length) {
      canonical.untested = decCanonical.untested;
    }
  }
  if (canonical === decCanonical && snapCanonical) {
    canonical.coveragePercent = canonical.coveragePercent ?? snapCanonical.coveragePercent;
    if (canonical.confidenceScore === null || (canonical.confidenceScore === 0 && (snapCanonical.confidenceScore ?? 0) > 0)) {
      canonical.confidenceScore = snapCanonical.confidenceScore;
    }
    if (canonical.evidenceCompleteness === null && snapCanonical.evidenceCompleteness !== null) {
      canonical.evidenceCompleteness = snapCanonical.evidenceCompleteness;
    }
    canonical.confidenceBasis = canonical.confidenceBasis || snapCanonical.confidenceBasis || '';
    if (!canonical.attemptSummary || canonical.attemptSummary.total === 0) {
      canonical.attemptSummary = snapCanonical.attemptSummary;
    }
    if ((!canonical.untested || canonical.untested.length === 0) && snapCanonical.untested?.length) {
      canonical.untested = snapCanonical.untested;
    }
  }

  // Final enrichment from on-disk snapshot if present
  if (snapshotPath) {
    const snapFromDisk = deriveFromSnapshot(safeReadJson(snapshotPath));
    if (snapFromDisk) {
      if (canonical.confidenceScore === null || (canonical.confidenceScore === 0 && (snapFromDisk.confidenceScore ?? 0) > 0)) {
        canonical.confidenceScore = snapFromDisk.confidenceScore;
      }
      if (!canonical.confidenceBasis && snapFromDisk.confidenceBasis) {
        canonical.confidenceBasis = snapFromDisk.confidenceBasis;
      }
      if (canonical.evidenceCompleteness === null && snapFromDisk.evidenceCompleteness !== null) {
        canonical.evidenceCompleteness = snapFromDisk.evidenceCompleteness;
      }
    }
  }

  // Choose the strongest available confidence and evidence signals
  const confidenceCandidates = [
    canonical.confidenceScore,
    snapCanonical?.confidenceScore,
    decCanonical?.confidenceScore
  ].filter(v => v !== null && v !== undefined);
  
  if (confidenceCandidates.length > 0) {
    // Prefer non-zero confidence; fallback to first available
    const bestConfidence = confidenceCandidates.find(v => v > 0);
    canonical.confidenceScore = bestConfidence !== undefined ? bestConfidence : confidenceCandidates[0];
  }
  
  // Merge confidence basis from richest source
  if (!canonical.confidenceBasis || canonical.confidenceBasis === '') {
    canonical.confidenceBasis = snapCanonical?.confidenceBasis || decCanonical?.confidenceBasis || '';
  }
  if (canonical.evidenceCompleteness === null) {
    const completenessCandidates = [snapCanonical?.evidenceCompleteness, decCanonical?.evidenceCompleteness].filter(v => v !== null);
    if (completenessCandidates.length > 0) {
      canonical.evidenceCompleteness = completenessCandidates[0];
    }
  }

  // Normalize required fields (preserve non-zero confidence)
  canonical.coveragePercent = canonical.coveragePercent ?? 0;
  // CRITICAL: Confidence must exist; default to 0 only if truly absent everywhere
  if (canonical.confidenceScore === null || canonical.confidenceScore === undefined) {
    canonical.confidenceScore = 0;
  }
  canonical.attemptSummary = canonical.attemptSummary || deriveAttemptSummary();
  canonical.untested = canonical.untested || [];

  // CRITICAL: Preserve computed confidence in frozen object
  const frozenCanonical = {
    source: canonical.source,
    finalVerdict: canonical.finalVerdict,
    exitCode: canonical.exitCode,
    coveragePercent: canonical.coveragePercent,
    confidenceScore: canonical.confidenceScore,
    confidenceBasis: canonical.confidenceBasis || '',
    evidenceCompleteness: canonical.evidenceCompleteness,
    attemptSummary: Object.freeze({ ...canonical.attemptSummary }),
    untested: Object.freeze([...(canonical.untested || [])])
  };

  return Object.freeze(frozenCanonical);
}

function loadCanonicalTruth(params) {
  return buildCanonicalTruth(params || {});
}

function assertCanonicalConsistency(canonical, proposedVerdict, context = 'report') {
  if (!canonical) {
    throw new Error('Canonical truth missing for consistency check');
  }
  if (proposedVerdict && proposedVerdict !== canonical.finalVerdict) {
    throw new Error(`Canonical verdict mismatch in ${context}: ${proposedVerdict} !== ${canonical.finalVerdict}`);
  }
}

module.exports = {
  buildCanonicalTruth,
  loadCanonicalTruth,
  assertCanonicalConsistency,
  deriveAttemptSummary,
  deriveFromSnapshot,
  deriveFromDecision
};
