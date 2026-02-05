import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSilentFailures } from '../../src/cli/util/detection-engine.js';
import { batchValidateFindings } from '../../src/verax/detect/constitution-validator.js';

function baseLearn() {
  return {
    expectations: [
      {
        id: 'exp_submit',
        type: 'interaction',
        category: 'form',
        promise: { kind: 'submit', value: 'Submit Form' },
        action: 'submit',
        expectedOutcome: 'ui-change',
      }
    ]
  };
}

function baseSignals(overrides = {}) {
  return {
    navigationChanged: false,
    routeChanged: false,
    meaningfulDomChange: false,
    meaningfulUIChange: false,
    feedbackSeen: false,
    ariaLiveUpdated: false,
    ariaRoleAlertsDetected: false,
    submissionTriggered: true,
    networkAttemptAfterSubmit: false,
    ...overrides,
  };
}

function baseObservation(overrides = {}) {
  return {
    id: 'exp_submit',
    type: 'interaction',
    action: 'submit',
    attempted: true,
    actionSuccess: true,
    observed: false,
    evidenceFiles: ['exp_1_before.png', 'exp_1_after.png', 'exp_1_dom_diff.json'],
    signals: baseSignals(),
    ...overrides,
  };
}

test('CONTRACT: UNKNOWN_SUBMISSION_INTENT must not emit silent_submission; must record submission_ambiguous silence', async () => {
  const learnData = baseLearn();
  const observeData = {
    observations: [
      baseObservation({
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
              hasOnClick: true,
              aria: { expanded: null, pressed: null, checked: null },
              control: { checked: null },
              after: null,
              delta: null,
              eventType: 'submit',
              capturedAt: '2026-01-01T00:00:00.000Z',
            }
          }
        }
      })
    ]
  };

  const raw = await detectSilentFailures(learnData, observeData);
  const { valid } = batchValidateFindings(raw);

  const silent = valid.filter((f) => f.type === 'silent_submission');
  assert.equal(silent.length, 0);

  const obs = observeData.observations[0];
  assert.ok(obs, 'expected observation');
  assert.equal(obs.silenceDetected?.kind, 'submission_ambiguous');
  assert.equal(obs.silenceDetected?.code, 'unknown_submission_intent');
  assert.equal(obs.silenceDetected?.expectationId, 'exp_submit');
  assert.ok(Array.isArray(obs.silenceDetected?.intentReasons), 'intentReasons must be array');

  const silenceJson = JSON.stringify(obs.silenceDetected);
  assert.ok(!silenceJson.includes('selector'), 'silence record must not contain selector');
  assert.ok(silenceJson.length < 1200, 'silence record must be small');
});

test('CONTRACT: silent_submission emits only when submit intent + submissionTriggered + no effect signals', async () => {
  const learnData = baseLearn();
  const observeData = {
    observations: [
      baseObservation({
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
              hasOnClick: true,
              aria: { expanded: null, pressed: null, checked: null },
              control: { checked: null },
              after: null,
              delta: null,
              eventType: 'submit',
              capturedAt: '2026-01-01T00:00:00.000Z',
            }
          }
        }
      })
    ]
  };

  const raw = await detectSilentFailures(learnData, observeData);
  const { valid } = batchValidateFindings(raw);

  const silent = valid.filter((f) => f.type === 'silent_submission');
  assert.equal(silent.length, 1);

  const obs = observeData.observations[0];
  assert.ok(!obs.silenceDetected, 'provable silent submission should not record ambiguity silence');
});

