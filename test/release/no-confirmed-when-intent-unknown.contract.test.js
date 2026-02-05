import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSilentFailures } from '../../src/cli/util/detection-engine.js';
import { classifyRunTruth, summarizeCriticalSilences } from '../../src/verax/core/truth-classifier.js';

test('CONTRACT: UNKNOWN_INTENT yields no CONFIRMED finding and forces INCOMPLETE via critical silence', async () => {
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
              hasOnClick: false, // UNKNOWN_INTENT
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
    ],
    stats: { totalExpectations: 1, attempted: 1, completed: 1, observed: 1, skippedReasons: {} },
    status: 'SUCCESS',
  };

  const findings = await detectSilentFailures(learnData, observeData);
  assert.equal(findings.length, 0);

  // Detection mutates the observation with a silence record (auditable gap).
  assert.equal(observeData.observations[0].silenceDetected?.kind, 'intent_blocked');

  const critical = summarizeCriticalSilences(observeData.observations);
  const truth = classifyRunTruth(
    {
      expectationsTotal: 1,
      attempted: 1,
      observed: 1,
      silentFailures: 0,
      coverageRatio: 1.0,
      hasInfraFailure: false,
      isIncomplete: false,
      ...critical,
    },
    { minCoverage: 0.9 }
  );
  assert.equal(truth.truthState, 'INCOMPLETE');
});

