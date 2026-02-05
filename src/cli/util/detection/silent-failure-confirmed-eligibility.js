/**
 * Silent-Failure CONFIRMED Eligibility — SSOT
 *
 * Goal: Make it impossible to emit CONFIRMED for the 3 silent-failure types unless
 * all required proof gates are satisfied using only existing signals/artifacts.
 *
 * No selectors. No HTML blobs. Deterministic codes only.
 */

export const SILENT_FAILURE_TYPES = Object.freeze({
  DEAD_INTERACTION: 'dead_interaction_silent_failure',
  BROKEN_NAV: 'broken_navigation_promise',
  SILENT_SUBMISSION: 'silent_submission',
});

function isBool(x) {
  return x === true || x === false;
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function extractExpNumsFromEvidenceFiles(files) {
  const list = Array.isArray(files) ? files : [];
  const nums = new Set();
  for (const f of list) {
    if (typeof f !== 'string') continue;
    const m = /(?:^|\/)exp_(\d+)_/i.exec(f);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) nums.add(n);
  }
  return Array.from(nums).sort((a, b) => a - b);
}

function hasStateComparisonEvidence(evidenceFiles) {
  if (!Array.isArray(evidenceFiles)) return false;
  const hasBefore = evidenceFiles.some(f => typeof f === 'string' && f.includes('before') && f.endsWith('.png'));
  const hasAfter = evidenceFiles.some(f => typeof f === 'string' && f.includes('after') && f.endsWith('.png'));
  const hasDomDiff = evidenceFiles.some(f => typeof f === 'string' && f.includes('dom_diff') && f.endsWith('.json'));
  return hasBefore && hasAfter && hasDomDiff;
}

function hasAnyStrongProofArtifact(evidenceFiles, routeData, signals) {
  const files = Array.isArray(evidenceFiles) ? evidenceFiles : [];
  const hasDomDiff = files.some((f) => typeof f === 'string' && f.includes('dom_diff') && f.endsWith('.json'));
  const hasNetwork = files.some((f) => typeof f === 'string' && f.includes('network') && f.endsWith('.json'));
  const hasBeforeAfterPair = files.some(f => typeof f === 'string' && f.includes('before') && f.endsWith('.png')) &&
    files.some(f => typeof f === 'string' && f.includes('after') && f.endsWith('.png'));
  const hasRouteEvidence = routeData && typeof routeData === 'object';
  const feedbackAvailable = signals && (isBool(signals.feedbackSeen) || isBool(signals.ariaLiveUpdated) || isBool(signals.ariaRoleAlertsDetected));
  const networkAvailable = signals && (isBool(signals.correlatedNetworkActivity) || isBool(signals.networkActivity) || isBool(signals.networkAttemptAfterSubmit));
  return hasDomDiff || hasNetwork || hasBeforeAfterPair || hasRouteEvidence || feedbackAvailable || networkAvailable;
}

/**
 * Evaluate CONFIRMED eligibility for the 3 silent-failure types.
 *
 * Returns { eligible, missing } where missing is deterministic codes.
 *
 * @param {{
 *  type: string;
 *  attempted: boolean;
 *  actionSuccess: boolean;
 *  intent?: string|null;
 *  navIntent?: string|null;
 *  submissionTriggered?: boolean|null;
 *  signals?: any;
 *  elementSnapshotActionable?: boolean;
 *  navObservablesAvailable?: boolean|null;
 *  evidenceFiles?: string[];
 *  routeData?: any;
 * }} input
 */
export function evaluateSilentFailureConfirmedEligibility(input) {
  const missing = [];
  const t = input?.type;

  const attempted = input?.attempted === true;
  const actionSuccess = input?.actionSuccess === true;
  const actionable = input?.elementSnapshotActionable === true;
  const evidenceFiles = Array.isArray(input?.evidenceFiles) ? input.evidenceFiles : [];
  const signals = input?.signals || {};
  const routeData = input?.routeData || null;

  if (!attempted) missing.push('not_attempted');
  if (!actionSuccess) missing.push('action_not_executed');
  if (!actionable) missing.push('non_actionable_snapshot');

  // Common: evidence mapping by expNum must be provable (single expNum across evidence refs).
  const expNums = extractExpNumsFromEvidenceFiles(evidenceFiles);
  if (expNums.length === 0) missing.push('unmapped_expnum');
  if (expNums.length > 1) missing.push('ambiguous_expnum');

  if (t === SILENT_FAILURE_TYPES.DEAD_INTERACTION) {
    if (typeof input?.intent !== 'string' || input.intent.length === 0) missing.push('missing_intent');
    if (input?.intent === 'UNKNOWN_INTENT') missing.push('unknown_intent');
    if (!hasStateComparisonEvidence(evidenceFiles)) missing.push('missing_state_comparison_evidence');
    if (!hasAnyStrongProofArtifact(evidenceFiles, routeData, signals)) missing.push('missing_strong_proof_artifact');
  } else if (t === SILENT_FAILURE_TYPES.BROKEN_NAV) {
    if (typeof input?.navIntent !== 'string' || input.navIntent.length === 0) missing.push('missing_navigation_intent');
    if (input?.navIntent === 'UNKNOWN_NAV_INTENT') missing.push('unknown_navigation_intent');
    if (input?.navObservablesAvailable !== true) missing.push('navigation_observables_unavailable');
    if (!hasStateComparisonEvidence(evidenceFiles)) missing.push('missing_state_comparison_evidence');
    if (!hasAnyStrongProofArtifact(evidenceFiles, routeData, signals)) missing.push('missing_strong_proof_artifact');
  } else if (t === SILENT_FAILURE_TYPES.SILENT_SUBMISSION) {
    // Trigger must be explicitly proven.
    if (input?.submissionTriggered !== true) missing.push('submission_not_triggered');
    // Observables must be present (explicit booleans), even if false.
    const hasAnyOutcomeObservable =
      isBool(signals.networkAttemptAfterSubmit) ||
      isBool(signals.navigationChanged) ||
      isBool(signals.routeChanged) ||
      isBool(signals.feedbackSeen) ||
      isBool(signals.ariaLiveUpdated) ||
      isBool(signals.ariaRoleAlertsDetected);
    if (!hasAnyOutcomeObservable) missing.push('submission_observables_missing');
    if (!hasStateComparisonEvidence(evidenceFiles)) missing.push('missing_state_comparison_evidence');
    if (!hasAnyStrongProofArtifact(evidenceFiles, routeData, signals)) missing.push('missing_strong_proof_artifact');
  } else {
    // Not a target type: do not block.
    return { eligible: true, missing: [] };
  }

  const missingCodes = uniqueSorted(missing);
  return { eligible: missingCodes.length === 0, missing: missingCodes };
}

