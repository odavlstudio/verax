import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSilentFailures } from '../../src/cli/util/detection-engine.js';
import { batchValidateFindings } from '../../src/verax/detect/constitution-validator.js';

test('CONTRACT: UNKNOWN_INTENT must never yield CONFIRMED dead_interaction_silent_failure', async () => {
  const learnData = {
    expectations: [
      {
        id: 'exp_dead',
        type: 'interaction',
        category: 'button',
        promise: { kind: 'click', value: 'Unknown intent button' },
        action: 'click',
        expectedOutcome: 'ui-change',
      }
    ]
  };

  const observeData = {
    observations: [
      {
        id: 'exp_dead',
        type: 'interaction',
        action: 'click',
        attempted: true,
        actionSuccess: true,
        observed: false,
        evidenceFiles: ['exp_1_before.png', 'exp_1_after.png', 'exp_1_dom_diff.json'],
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
              hasOnClick: false, // critical: unknown intent
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

  const raw = await detectSilentFailures(learnData, observeData);
  const { valid } = batchValidateFindings(raw);

  const confirmedDead = valid.filter(
    (f) => f.type === 'dead_interaction_silent_failure' && f.status === 'CONFIRMED'
  );
  assert.equal(confirmedDead.length, 0);

  // Must record an auditable silence/gap marker on the observation (NOT a finding)
  const obs = observeData.observations[0];
  assert.ok(obs, 'expected observation');
  assert.equal(obs.silenceDetected?.kind, 'intent_blocked');
  assert.equal(obs.silenceDetected?.code, 'unknown_click_intent');
  assert.equal(obs.silenceDetected?.expectationId, 'exp_dead');
  assert.ok(Array.isArray(obs.silenceDetected?.intentReasons), 'intentReasons must be array');

  // Safety: no selectors / no blobs
  const silenceJson = JSON.stringify(obs.silenceDetected);
  assert.ok(!silenceJson.includes('selector'), 'silence record must not contain selector');
  assert.ok(silenceJson.length < 1200, 'silence record must be small');
});
