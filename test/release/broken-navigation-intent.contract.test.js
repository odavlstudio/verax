import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSilentFailures } from '../../src/cli/util/detection-engine.js';
import { batchValidateFindings } from '../../src/verax/detect/constitution-validator.js';

test('CONTRACT: ambiguous navigation intent => no broken_navigation_promise, but silenceDetected recorded', async () => {
  const learnData = {
    expectations: [
      {
        id: 'exp_nav',
        type: 'navigation',
        promise: { kind: 'navigate', value: '/next' },
        confidence: 1,
      }
    ]
  };

  const observeData = {
    observations: [
      {
        id: 'exp_nav',
        type: 'navigation',
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
              href: { present: false, kind: null }, // ambiguous: no href
              form: { associated: false, isSubmitControl: false, method: null, hasAction: false },
              hasOnClick: false, // ambiguous: no explicit click handler marker
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
            hasTransitions: false,
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

  const raw = await detectSilentFailures(learnData, observeData);
  const { valid } = batchValidateFindings(raw);

  const broken = valid.filter((f) => f.type === 'broken_navigation_promise');
  assert.equal(broken.length, 0);

  const obs = observeData.observations[0];
  assert.equal(obs.silenceDetected?.kind, 'navigation_ambiguous');
  assert.equal(obs.silenceDetected?.code, 'navigation_intent_unresolved');
  assert.equal(obs.silenceDetected?.expectationId, 'exp_nav');
  assert.ok(typeof obs.silenceDetected?.intent === 'string');
  assert.ok(Array.isArray(obs.silenceDetected?.intentReasons));

  const silenceJson = JSON.stringify(obs.silenceDetected);
  assert.ok(!silenceJson.includes('selector'), 'silence record must not contain selector');
  assert.ok(silenceJson.length < 1200, 'silence record must be small');
});

