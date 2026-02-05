/**
 * STAGE 4: Truth Classification Engine
 * 
 * Centralizes run classification logic into explicit, auditable truth statements.
 * Answers: WHAT happened, HOW COMPLETE was it, WHETHER to trust it, WHAT to do next.
 * 
 * Non-negotiable rules prevent ambiguity in user-facing truth.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * V1 OUTPUT CONTRACT — Final Truth Guarantees
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Every `verax run` output MUST communicate:
 * 
 * 1. WHAT WAS OBSERVED
 *    - Total expectations extracted (learn phase)
 *    - Expectations attempted (observe phase)
 *    - Expectations observed successfully (detect phase)
 *    - Present in: summary.json.observe, CLI human output, truth.coverageSummary
 * 
 * 2. WHAT WAS NOT OBSERVED
 *    - Unattempted count: expectationsTotal - attempted
 *    - Breakdown by reason: {timeout: N, budget: M, ...}
 *    - Present in: summary.json.observe.unattemptedReasons, truth.coverageSummary.unattemptedBreakdown
 * 
 * 3. WHETHER THIS RESULT IS SAFE TO TRUST
 *    - SUCCESS: All expectations attempted, zero findings, coverage ≥ threshold
 *    - INCOMPLETE: Partial coverage — MUST NOT be treated as safe
 *    - FINDINGS: Confirmed findings detected (action required)
 *    - Present in: summary.json.truth.truthState, CLI final line
 * 
 * 4. INCOMPLETE IS DANGEROUS (safety-critical)
 *    - MUST include explicit warning: "This result should NOT be treated as safe"
 *    - MUST appear in:
 *      a) summary.json.truth.explanation (machine-readable)
 *      b) CLI human output (user-visible)
 *      c) CLI --json final outcome (programmatic access)
 *    - Cannot be misinterpreted — language must be unambiguous
 * 
 * 5. COVERAGE TRANSPARENCY
 *    - Always visible in summary.json:
 *      - observe.expectationsTotal
 *      - observe.attempted
 *      - observe.observed
 *      - observe.unattemptedReasons (breakdown object)
 *      - truth.coverageSummary (consolidated view)
 *    - Always visible in CLI human output (concise):
 *      - "X of Y interactions were not exercised. Primary cause(s): timeout, budget."
 * 
 * 6. DETERMINISM
 *    - Same inputs + same environment + stable site state → identical normalized artifacts
 *    - Some metadata may vary between runs (timestamps, run IDs)
 *    - All counts and reason breakdowns must be deterministically ordered
 * 
 * 7. UNAMBIGUOUS STATES
 *    - SUCCESS: Zero ambiguity — safe to proceed
 *    - FINDINGS: Confirmed issues detected — user must act
 *    - INCOMPLETE: Partial data — dangerous to trust, user must re-run
 *    - No intermediate states allowed
 */

/**
 * @typedef {Object} TruthResult
 * @property {string} truthState - "SUCCESS" | "FINDINGS" | "INCOMPLETE"
 * @property {string} confidence - "HIGH" | "MEDIUM" | "LOW"
 * @property {string} reason - Why this classification was chosen
 * @property {string} whatThisMeans - Plain English explanation for user
 * @property {string} recommendedAction - What the user should do next
 * @property {string} [action] - Optional override action message
 * @property {{ expectationsTotal?: number, attempted?: number, observed?: number, unattemptedCount?: number, unattemptedBreakdown?: Record<string, number> }} [coverageSummary]
 */

/**
 * Classify the overall truth state of a run based on results.
 * 
 * Rules (non-negotiable):
 * 
 * SUCCESS:
 *   - expectationsTotal === 0 (empty site), OR
 *   - attempted === expectationsTotal AND silentFailures === 0 AND coverage >= threshold
 * 
 * INCOMPLETE:
 *   - attempted < expectationsTotal, OR
 *   - coverage < threshold, OR
 *   - budget/time limits hit
 *   AND no infrastructure crash
 * 
 * FINDINGS:
 *   - confirmed silent failures exist
 * 
 * Confidence (HIGH/MEDIUM/LOW):
 *   - HIGH: coverage >= threshold AND attempted === expectationsTotal
 *   - MEDIUM: attempted > 0 but coverage < threshold
 *   - LOW: attempted === 0 OR infra instability detected
 * 
 * @param {{
 *   expectationsTotal?: number;
 *   attempted?: number;
 *   observed?: number;
 *   silentFailures?: number;
 *   coverageRatio?: number;
 *   criticalSilenceCount?: number;
 *   criticalSilenceKinds?: string[];
 *   hasInfraFailure?: boolean;
 *   isIncomplete?: boolean;
 *   incompleteReasons?: string[];
 * }} runSummary - Summary object with coverage, expectations, findings
 * @param {{ minCoverage?: number }} thresholds - Minimum coverage threshold (0-1)
 * @returns {TruthResult}
 */
export function classifyRunTruth(runSummary, thresholds = {}) {
  const {
    expectationsTotal = 0,
    attempted = 0,
    silentFailures = 0,
    coverageRatio = 0,
    criticalSilenceCount = 0,
    criticalSilenceKinds = [],
    hasInfraFailure = false,
    isIncomplete = false,
  } = runSummary || {};

  const minCoverage = thresholds?.minCoverage ?? 0.90;
  const hasCriticalSilence = Number(criticalSilenceCount || 0) > 0;

  // === INFRA FAILURE → treated as INCOMPLETE for Vision 1.0 ===
  if (hasInfraFailure || (isIncomplete && attempted === 0 && expectationsTotal > 0)) {
    return {
      truthState: 'INCOMPLETE',
      confidence: attempted === 0 ? 'LOW' : 'MEDIUM',
      reason: 'Observation infrastructure failure or incomplete run with zero attempts',
      whatThisMeans:
        'The browser observation infrastructure did not complete. ' +
        'Results are partial and cannot be trusted. THIS RESULT MUST NOT BE TREATED AS SAFE.',
      recommendedAction:
        'Check Playwright/Chromium setup and rerun with --debug. Ensure the target URL is reachable.',
    };
  }

  // === EMPTY SITE (NO EXPECTATIONS) ===
  // This should only occur when source code analysis found no testable interactions.
  // With --src mandatory, URL-only mode is impossible.
  if (expectationsTotal === 0) {
    return {
      truthState: 'SUCCESS',
      confidence: 'HIGH',
      reason: 'No testable expectations found (empty or static page)',
      whatThisMeans:
        'The page has no interactive elements or forms to test. ' +
        'VERAX found nothing to verify, so there are no silent failures to detect.',
      recommendedAction:
        'If you expected to find interactions, verify the page loaded correctly or check your source discovery settings.',
    };
  }

  // === CONFIRMED FAILURES DETECTED (takes precedence over incomplete) ===
  if (silentFailures > 0) {
    return {
      truthState: 'FINDINGS',
      confidence: 'HIGH',
      reason: `${silentFailures} silent failure(s) detected across ${attempted} attempts`,
      whatThisMeans:
        'The browser detected one or more interactions that appeared to work but ' +
        'did not produce the expected outcome. Users may experience broken flows.',
      recommendedAction: `Review and fix the ${silentFailures} finding(s). Re-run to confirm.`,
    };
  }

  // === INCOMPLETE RUN (must not be treated as safe) ===
  if (isIncomplete || hasCriticalSilence) {
    const coverageTooLow = coverageRatio < minCoverage && expectationsTotal > 0;
    const notFullAttempt = attempted < expectationsTotal;
    const silenceKinds = Array.isArray(criticalSilenceKinds) ? criticalSilenceKinds : [];
    const silenceText = hasCriticalSilence
      ? `Critical ambiguity detected (${Number(criticalSilenceCount || 0)}): ${silenceKinds.slice(0, 3).join(', ') || 'unknown'}.`
      : '';
    const reason = hasCriticalSilence
      ? silenceText
      : notFullAttempt && coverageTooLow
          ? `Only ${attempted}/${expectationsTotal} attempted (${(coverageRatio * 100).toFixed(1)}% observed)`
          : notFullAttempt
            ? `Only ${attempted}/${expectationsTotal} expectations attempted`
            : `Coverage ${(coverageRatio * 100).toFixed(1)}% below threshold ${(minCoverage * 100).toFixed(0)}%`;

    const confidence =
      attempted === 0
        ? 'LOW'
        : hasCriticalSilence
          ? 'MEDIUM'
          : coverageRatio > 0.5
          ? 'MEDIUM'
          : 'LOW';

    return {
      truthState: 'INCOMPLETE',
      confidence,
      reason,
      whatThisMeans:
        (hasCriticalSilence
          ? 'The run observed one or more interactions with ambiguous intent or missing required observables. '
          : 'The run did not complete observation of all public flows. ') +
        'Results are partial and cannot rule out silent failures. ' +
        'THIS RESULT MUST NOT BE TREATED AS SAFE.',
      recommendedAction:
        (hasCriticalSilence
          ? 'Review the recorded silence/gap reasons and adjust your site instrumentation or observation settings, then rerun. '
          : 'Increase --min-coverage threshold, extend budget, or investigate why observations were limited. ') +
        'Re-run to achieve full coverage before trusting results.',
    };
  }

  // === FULL COVERAGE, NO FAILURES ===
  const isFull = attempted === expectationsTotal;
  const noFailures = silentFailures === 0;
  const coverageOk = coverageRatio >= minCoverage;

  if (coverageOk && noFailures && !hasCriticalSilence) {
    const reasonMessage = isFull 
      ? `All ${attempted}/${expectationsTotal} expectations attempted, zero failures`
      : `Coverage ${(coverageRatio * 100).toFixed(1)}% meets threshold (${(minCoverage * 100).toFixed(0)}%), no silent failures`;
    const whatThisMessage = isFull
      ? 'Covered public flows were exercised in the real browser and no silent failures were observed in the attempted interactions.'
      : 'Sufficient public flows were exercised in the real browser and no silent failures were observed in the attempted interactions.';


    return {
      truthState: 'SUCCESS',
      confidence: 'HIGH',
      reason: reasonMessage,
      whatThisMeans: whatThisMessage,
      recommendedAction:
        'Treat this as advisory for covered flows. Expand coverage for critical paths and rerun when site state or environment changes.',
    };
  }

  // === PARTIAL COVERAGE ===
  const coverageTooLow = coverageRatio < minCoverage && expectationsTotal > 0;
  const notFullAttempt = attempted < expectationsTotal;

  if (coverageTooLow || notFullAttempt || isIncomplete) {
    const reason =
      notFullAttempt && coverageTooLow
        ? `Only ${attempted}/${expectationsTotal} attempted (${(coverageRatio * 100).toFixed(1)}% observed)`
        : notFullAttempt
          ? `Only ${attempted}/${expectationsTotal} expectations attempted`
          : `Coverage ${(coverageRatio * 100).toFixed(1)}% below threshold ${(minCoverage * 100).toFixed(0)}%`;

    const confidence =
      attempted === 0
        ? 'LOW'
        : coverageRatio > 0.5
          ? 'MEDIUM'
          : 'LOW';

    return {
      truthState: 'INCOMPLETE',
      confidence,
      reason,
      whatThisMeans:
        'The run did not complete observation of all public flows. ' +
        'Results are partial and cannot rule out silent failures in untested areas. ' +
        'THIS RESULT MUST NOT BE TREATED AS SAFE.',
      recommendedAction:
        'Increase --min-coverage threshold, extend budget, or investigate why observations were limited. ' +
        'Re-run to achieve full coverage before trusting results.',
    };
  }

  // === FALLBACK (should not reach) ===
  return {
    truthState: 'INCOMPLETE',
    confidence: 'LOW',
    reason: 'Unexpected classification state',
    whatThisMeans: 'The run result does not match any known pattern. Review logs.',
    recommendedAction: 'Re-run with --debug for detailed diagnostics.',
  };
}

/**
 * Count "critical" silence/gap records that must block SUCCESS.
 * Deterministic: returns kinds in stable sorted order.
 *
 * @param {Array<{ silenceDetected?: { kind?: string } }>} observations
 * @returns {{ criticalSilenceCount: number, criticalSilenceKinds: string[] }}
 */
export function summarizeCriticalSilences(observations) {
  const criticalKinds = new Set(['intent_blocked', 'navigation_ambiguous', 'submission_ambiguous']);
  /** @type {Record<string, number>} */
  const counts = {};
  const list = Array.isArray(observations) ? observations : [];
  for (const obs of list) {
    const kind = obs?.silenceDetected?.kind;
    if (typeof kind !== 'string') continue;
    if (!criticalKinds.has(kind)) continue;
    counts[kind] = (counts[kind] || 0) + 1;
  }
  const kinds = Object.keys(counts).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const total = kinds.reduce((acc, k) => acc + Number(counts[k] || 0), 0);
  return { criticalSilenceCount: total, criticalSilenceKinds: kinds };
}

/**
 * Format truth result as a human-readable paragraph (CLI output).
 * @param {TruthResult} truth - Classified truth result
 * @returns {string} Single paragraph suitable for CLI output
 */
export function formatTruthAsText(truth) {
  if (!truth) {
    return 'Result classification unavailable.';
  }

  const confidenceText = truth.confidence;

  // INCOMPLETE: provide explicit coverage transparency with top reasons and safety warning
  if (truth.truthState === 'INCOMPLETE' && truth.coverageSummary) {
    const cs = truth.coverageSummary || {};
    const total = Number(cs.expectationsTotal || 0);
    const unattempted = Number(cs.unattemptedCount || Math.max(0, total - Number(cs.attempted || 0)));
    const breakdown = typeof cs.unattemptedBreakdown === 'object' && cs.unattemptedBreakdown ? cs.unattemptedBreakdown : {};
    // Deterministic top reasons: sort by count desc, then key asc
    /** @type {Array<[string, number]>} */
    const entries = Object.entries(breakdown).map(([k, v]) => [k, Number(v || 0)]);
    entries.sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });
    const topReasons = entries.slice(0, 2).map(([k]) => k);
    const reasonsText = topReasons.length > 0 ? ` Primary cause(s): ${topReasons.join(', ')}.` : '';

    const actionText = truth.action ?? truth.recommendedAction ?? '';
    return (
      `INCOMPLETE (${confidenceText} confidence). Coverage was partial: ${unattempted} of ${total} interactions were not exercised.` +
      `${reasonsText} ` +
      `THIS RESULT MUST NOT BE TREATED AS SAFE. Partial coverage cannot rule out silent failures. ` +
      `${actionText}`
    );
  }

  const confidence = truth.confidence || 'UNKNOWN';
  const actionText = truth.action ?? truth.recommendedAction ?? '';
  return (
    `${truth.truthState}. ${truth.whatThisMeans} ` +
    `Confidence: ${confidence}. ` +
    `${actionText}`
  );
}

/**
 * Build a summary-ready truth block for JSON output.
 * @param {TruthResult} truth - Classified truth result
 * @returns {Object} Truth block for inclusion in summary.json
 */
export function buildTruthBlock(truth, coverageContext = {}) {
  // Prepare deterministic coverageSummary
  const expectationsTotal = Number(coverageContext.expectationsTotal || 0);
  const attempted = Number(coverageContext.attempted || 0);
  const observed = Number(coverageContext.observed || 0);
  const coverageRatio = Number(
    typeof coverageContext.coverageRatio === 'number' ? coverageContext.coverageRatio : (expectationsTotal > 0 ? observed / expectationsTotal : 0)
  );
  const threshold = Number(
    typeof coverageContext.threshold === 'number' ? coverageContext.threshold : 0.90
  );
  const unattemptedCount = Number(
    typeof coverageContext.unattemptedCount === 'number' ? coverageContext.unattemptedCount : Math.max(0, expectationsTotal - attempted)
  );
  const rawBreakdown = (typeof coverageContext.unattemptedBreakdown === 'object' && coverageContext.unattemptedBreakdown) ? coverageContext.unattemptedBreakdown : {};
  // Sort keys deterministically (asc) and ensure numeric values
  const sortedKeys = Object.keys(rawBreakdown).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const unattemptedBreakdown = {};
  for (const k of sortedKeys) {
    unattemptedBreakdown[k] = Number(rawBreakdown[k] || 0);
  }
  const incompleteReasons = Array.isArray(coverageContext.incompleteReasons) ? coverageContext.incompleteReasons : [];

  return {
    truthState: truth.truthState,
    confidence: truth.confidence,
    reason: truth.reason,
    explanation: truth.whatThisMeans,
    action: truth.recommendedAction,
    coverageSummary: {
      expectationsTotal,
      attempted,
      observed,
      coverageRatio,
      threshold,
      unattemptedCount,
      unattemptedBreakdown,
      incompleteReasons,
    },
  };
}
