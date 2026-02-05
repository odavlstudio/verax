import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSilentFailures } from '../../src/cli/util/detection-engine.js';

test('CONTRACT: dead_interaction_silent_failure cannot be CONFIRMED when expNum mapping is unprovable', async () => {
  const learnData = {
    expectations: [
      { id: 'exp_1', type: 'interaction', category: 'button', promise: { kind: 'click', value: 'x' }, action: 'click', expectedOutcome: 'ui-change' }
    ],
    skipped: [],
  };

  const observeData = {
    observations: [
      {
        id: 'exp_1',
        type: 'interaction',
        action: 'click',
        attempted: true,
        actionSuccess: true,
        observed: false,
        evidenceFiles: ['before.png', 'after.png', 'dom_diff.json'], // passes state-comparison check but lacks exp_<N>_ mapping
        evidence: {
          interactionIntent: {
            record: {
              tagName: 'BUTTON',
              role: null,
              type: 'button',
              disabled: false,
              ariaDisabled: false,
              visible: true,
              boundingBox: { width: 120, height: 32 },
              containerTagName: 'main',
              href: { present: false, kind: null },
              form: { associated: false, isSubmitControl: false, method: null, hasAction: false },
              hasOnClick: false,
              aria: { expanded: false, pressed: null, checked: null },
              control: { checked: null },
              after: null,
              delta: null,
              eventType: 'click',
              capturedAt: '2026-01-01T00:00:00.000Z',
            }
          }
        },
        signals: {
          navigationChanged: false,
          routeChanged: false,
          meaningfulDomChange: false,
          meaningfulUIChange: false,
          feedbackSeen: false,
          ariaLiveUpdated: false,
          ariaRoleAlertsDetected: false,
          correlatedNetworkActivity: false,
          networkActivity: false,
        }
      }
    ]
  };

  const findings = await detectSilentFailures(learnData, observeData);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, 'dead_interaction_silent_failure');
  assert.equal(findings[0].status, 'SUSPECTED');
  assert.ok(Array.isArray(findings[0]?.enrichment?.confirmedEligibilityMissing));
  assert.ok(findings[0].enrichment.confirmedEligibilityMissing.includes('unmapped_expnum'));
});

test('CONTRACT: broken_navigation_promise cannot be CONFIRMED when expNum mapping is unprovable', async () => {
  const learnData = {
    expectations: [
      { id: 'exp_1', type: 'navigation', category: 'navigation', promise: { kind: 'navigate', value: '/next' }, action: 'click', expectedOutcome: 'navigation' }
    ],
    skipped: [],
  };

  const observeData = {
    observations: [
      {
        id: 'exp_1',
        type: 'navigation',
        action: 'click',
        attempted: true,
        actionSuccess: true,
        observed: false,
        evidenceFiles: ['before.png', 'after.png', 'dom_diff.json'], // no exp_<N>_
        evidence: {
          interactionIntent: {
            record: {
              tagName: 'A',
              role: null,
              type: null,
              disabled: false,
              ariaDisabled: false,
              visible: true,
              boundingBox: { width: 120, height: 32 },
              containerTagName: 'main',
              href: { present: true, kind: 'same_origin' },
              form: { associated: false, isSubmitControl: false, method: null, hasAction: false },
              hasOnClick: false,
              aria: { expanded: null, pressed: null, checked: null },
              control: { checked: null },
              after: null,
              delta: null,
              eventType: 'click',
              capturedAt: '2026-01-01T00:00:00.000Z',
            }
          },
          routeData: {
            before: { url: 'http://example.test/', path: '/', title: 'Home', timestamp: 1 },
            after: { url: 'http://example.test/', path: '/', title: 'Home', timestamp: 2 },
            transitions: [],
            signatureChanged: false,
          }
        },
        signals: {
          navigationChanged: false,
          routeChanged: false,
          meaningfulDomChange: false,
          meaningfulUIChange: false,
          feedbackSeen: false,
          correlatedNetworkActivity: false,
          networkActivity: false,
        }
      }
    ]
  };

  const findings = await detectSilentFailures(learnData, observeData);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, 'broken_navigation_promise');
  assert.equal(findings[0].status, 'SUSPECTED');
  assert.ok(Array.isArray(findings[0]?.enrichment?.confirmedEligibilityMissing));
  assert.ok(findings[0].enrichment.confirmedEligibilityMissing.includes('unmapped_expnum'));
});

test('CONTRACT: silent_submission cannot be CONFIRMED when expNum mapping is unprovable', async () => {
  const learnData = {
    expectations: [
      { id: 'exp_1', type: 'interaction', category: 'form', promise: { kind: 'submit', value: 'form' }, action: 'submit', expectedOutcome: 'ui-change' }
    ],
    skipped: [],
  };

  const observeData = {
    observations: [
      {
        id: 'exp_1',
        type: 'interaction',
        action: 'submit',
        attempted: true,
        actionSuccess: true,
        observed: false,
        evidenceFiles: ['before.png', 'after.png', 'dom_diff.json'], // no exp_<N>_
        evidence: {
          interactionIntent: {
            record: {
              tagName: 'BUTTON',
              role: null,
              type: 'submit',
              disabled: false,
              ariaDisabled: false,
              visible: true,
              boundingBox: { width: 120, height: 32 },
              containerTagName: 'main',
              href: { present: false, kind: null },
              form: { associated: true, isSubmitControl: true, method: 'POST', hasAction: true },
              hasOnClick: false,
              aria: { expanded: null, pressed: null, checked: null },
              control: { checked: null },
              after: null,
              delta: null,
              eventType: 'click',
              capturedAt: '2026-01-01T00:00:00.000Z',
            }
          }
        },
        signals: {
          submissionTriggered: true,
          networkAttemptAfterSubmit: false,
          navigationChanged: false,
          routeChanged: false,
          meaningfulDomChange: false,
          meaningfulUIChange: false,
          feedbackSeen: false,
          ariaLiveUpdated: false,
          ariaRoleAlertsDetected: false,
        }
      }
    ]
  };

  const findings = await detectSilentFailures(learnData, observeData);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, 'silent_submission');
  assert.equal(findings[0].status, 'SUSPECTED');
  assert.ok(Array.isArray(findings[0]?.enrichment?.confirmedEligibilityMissing));
  assert.ok(findings[0].enrichment.confirmedEligibilityMissing.includes('unmapped_expnum'));
});

