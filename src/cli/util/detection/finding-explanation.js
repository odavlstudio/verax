const EXPECTED_TEMPLATES = {
  navigate: (value) => `Navigating to ${value || 'the target page'} should show the expected content.`,
  navigation: (value) => `Navigating to ${value || 'the target page'} should show the expected content.`,
  click: (value) => `Clicking ${value || 'the element'} should produce a visible result or feedback.`,
  submit: (value) => `Submitting ${value || 'the form'} should show success or error feedback.`,
  form_submission: (value) => `Submitting ${value || 'the form'} should show success or error feedback.`,
  network_action: (value) => `Triggering ${value || 'the request'} should complete with user-visible confirmation.`,
  state_mutation: (value) => `State change ${value || 'requested'} should update visible UI or feedback.`,
  validation: (value) => `Validation for ${value || 'the input'} should show user-visible feedback.`
};

function baseClassification(classification) {
  if (!classification) return 'unknown';
  return String(classification).split(':')[0];
}

function expectedOutcome(finding) {
  const kind = finding?.promise?.kind || finding?.type || 'unknown';
  const value = finding?.promise?.value;
  const template = EXPECTED_TEMPLATES[kind] || ((v) => `Expected user-visible result for ${v || kind}.`);
  return template(value);
}

function observedOutcome(finding) {
  const classification = baseClassification(finding?.classification || finding?.status);
  const reason = finding?.reason;
  if (classification === 'observed') {
    return 'Expected outcome was observed during execution.';
  }
  if (classification === 'silent-failure') {
    const taxonomy = String(finding?.classification || '').split(':')[1] || 'no-change';
    return `Action executed but expected effect was not observed (${taxonomy}).${reason ? ' Reason: ' + reason : ''}`;
  }
  if (classification === 'coverage-gap') {
    return reason ? `Expectation not verified: ${reason}` : 'Expectation was not verified (coverage gap).';
  }
  if (classification === 'unproven') {
    return reason ? `Attempted but unproven: ${reason}` : 'Attempted but no confirming evidence was captured.';
  }
  return reason ? `Recorded outcome: ${reason}` : 'Outcome could not be determined from collected signals.';
}

function evidenceSummary(finding) {
  const evidence = Array.isArray(finding?.evidence) ? finding.evidence : [];
  const counts = evidence.reduce((acc, item) => {
    const type = (item?.type || 'unknown').toLowerCase();
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const parts = Object.keys(counts)
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((type) => `${type}:${counts[type]}`);
  const hasDomChange = finding?.domChanged === true || finding?.domChange === true || finding?.signals?.uiSignals?.diff?.changed === true;
  if (hasDomChange) {
    parts.push('dom-change:yes');
  }
  return parts.length > 0
    ? `Evidence signals → ${parts.join(', ')}`
    : 'Evidence signals → none recorded.';
}

function whyThisMatters(finding) {
  const classification = baseClassification(finding?.classification || finding?.status);
  const impact = (finding?.impact || finding?.severity || '').toUpperCase();
  if (classification === 'silent-failure') {
    return 'Users cannot confirm the action succeeded because no expected feedback appeared.';
  }
  if (classification === 'coverage-gap') {
    return 'The promised behavior was not verified, so confidence in this area is limited.';
  }
  if (classification === 'unproven') {
    return 'The action was attempted but not proven, so the outcome remains unknown to users.';
  }
  if (classification === 'observed') {
    return 'Observed behavior matched the expectation based on collected signals.';
  }
  if (impact === 'HIGH' || impact === 'CRITICAL') {
    return 'Potentially blocks a primary user path until feedback is confirmed.';
  }
  if (impact === 'MEDIUM') {
    return 'May impair user feedback or clarity for this action.';
  }
  return 'Impact could not be determined from the available signals.';
}

export function formatFindingExplanation(finding) {
  return {
    expectedOutcome: expectedOutcome(finding),
    observedOutcome: observedOutcome(finding),
    evidenceSummary: evidenceSummary(finding),
    whyThisMatters: whyThisMatters(finding),
  };
}








