/**
 * Evidence Law enforcement utilities
 * Substantive evidence requires at least one observable signal beyond screenshots.
 */

/**
 * Determine whether observation signals contain substantive evidence.
 * Substantive signals include navigation/route change, network activity,
 * meaningful DOM mutation, or explicit user-visible feedback.
 */
export function isSubstantiveEvidence(signals = {}) {
  if (!signals || typeof signals !== 'object') return false;

  /** @type {any} */
  const sig = signals;
  const navigationSignals = Boolean(
    sig.navigationChanged ||
    sig.clientSideRoutingDetected ||
    sig.reactEffectNavigation ||
    sig.vueRouterTransition ||
    sig.nextJsPageSwap ||
    sig.nextJsLayoutTransition
  );

  const networkSignals = Boolean(
    sig.correlatedNetworkActivity ||
    sig.networkActivity
  );

  const domSignals = Boolean(
    sig.meaningfulDomChange ||
    sig.domChanged
  );

  const feedbackSignals = Boolean(
    sig.feedbackSeen ||
    sig.ariaLiveUpdated ||
    sig.ariaRoleAlertsDetected
  );

  return navigationSignals || networkSignals || domSignals || feedbackSignals;
}

/**
 * Enforce Evidence Law on a finding at the write boundary.
 * If a silent-failure finding lacks substantive evidence, downgrade to unproven
 * and record enforcement metadata.
 */
export function enforceEvidenceLawOnFinding(finding) {
  if (!finding || typeof finding !== 'object') return finding;

  const clone = { ...finding };
  const classification = clone.classification || '';
  const isSilentFailure = classification.startsWith('silent-failure');
  const substantive = isSubstantiveEvidence(clone.evidenceSignals || {});

  if (isSilentFailure && !substantive) {
    clone.classification = 'unproven';
    clone.reason = clone.reason || 'Downgraded: no substantive evidence (Evidence Law)';
    clone.confidence = 0;
    clone.evidenceLaw = {
      enforced: true,
      substantive: false,
      reason: 'No substantive navigation/network/dom/feedback signals',
    };
  } else {
    clone.evidenceLaw = {
      enforced: true,
      substantive,
    };
  }

  return clone;
}








