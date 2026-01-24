/**
 * Silent Failure Intelligence (Evidence-Based)
 *
 * Derives conservative classification from existing evidence signals only.
 * No detection changes. Deterministic output.
 */

/**
 * Classify the kind of silence based on evidence signals.
 * @param {Object} finding - Existing finding object
 * @returns {{ silenceKind?: string, silenceExplanation?: string, userRisk?: 'LOW'|'MEDIUM'|'HIGH' }}
 */
export function classifySilentFailure(finding) {
  // Only apply to CONFIRMED/SUSPECTED silent failures
  const status = (finding.status || finding.severity || '').toUpperCase();
  const type = String(finding.type || '').toLowerCase();
  const isSilentFailure = type.includes('silent_failure');
  if (!isSilentFailure || (status !== 'CONFIRMED' && status !== 'SUSPECTED')) {
    return {};
  }

  const signals = finding.evidencePackage?.signals || finding.evidence?.signals || {};
  const nav = signals.navigation || {};
  const ui = signals.uiSignals || {};
  const feedback = signals.uiFeedback || {};
  const network = signals.network || {};

  // Determine missing observable signals
  const noNavigation = nav.urlChanged === false;
  const noUiChange = ui.changed === false;
  const hasLoading = ui.hasLoadingIndicator === true;
  const stalledLoading = hasLoading && ui.changed === false; // loading shown, no change observed
  const failedRequests = Number(network.failedRequests || 0) > 0;
  const noFeedbackScore = typeof feedback.overallUiFeedbackScore === 'number' ? feedback.overallUiFeedbackScore <= 0 : true;
  const noFeedback = noUiChange && noFeedbackScore; // no UI change and no feedback signals

  // Deterministic precedence of user-visible silence kinds
  let silenceKind = 'UNKNOWN_SILENCE';
  let silenceExplanation = 'Expected user-visible outcome was not observed; evidence incomplete.';

  if (noNavigation) {
    silenceKind = 'NO_NAVIGATION';
    silenceExplanation = 'Expected navigation but URL did not change.';
  } else if (failedRequests && noUiChange) {
    silenceKind = 'BLOCKED_WITHOUT_MESSAGE';
    silenceExplanation = 'Network failed or request was blocked, and no user-visible message was observed.';
  } else if (stalledLoading) {
    silenceKind = 'STALLED_LOADING';
    silenceExplanation = 'Loading indicator appeared but no progress or state change was observed.';
  } else if (noUiChange) {
    silenceKind = 'NO_UI_CHANGE';
    silenceExplanation = 'Expected UI to change but no visible DOM change was observed.';
  } else if (noFeedback) {
    silenceKind = 'NO_FEEDBACK';
    silenceExplanation = 'Expected user-visible feedback but none was observed.';
  }

  // Conservative user risk derived from status + kind (no business logic)
  /** @type {'LOW'|'MEDIUM'|'HIGH'} */
  let userRisk = 'LOW';
  const isConfirmed = status === 'CONFIRMED';
  if (isConfirmed) {
    if (silenceKind === 'NO_NAVIGATION' || silenceKind === 'BLOCKED_WITHOUT_MESSAGE') {
      userRisk = 'HIGH';
    } else if (silenceKind === 'STALLED_LOADING' || silenceKind === 'NO_UI_CHANGE' || silenceKind === 'NO_FEEDBACK') {
      userRisk = 'MEDIUM';
    } else {
      userRisk = 'LOW';
    }
  } else { // SUSPECTED
    if (silenceKind === 'NO_NAVIGATION' || silenceKind === 'BLOCKED_WITHOUT_MESSAGE') {
      userRisk = 'MEDIUM';
    } else if (silenceKind === 'STALLED_LOADING' || silenceKind === 'NO_UI_CHANGE' || silenceKind === 'NO_FEEDBACK') {
      userRisk = 'LOW';
    } else {
      userRisk = 'LOW';
    }
  }

  return { silenceKind, silenceExplanation, userRisk };
}








