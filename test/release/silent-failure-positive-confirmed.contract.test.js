import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectPhase } from '../../src/cli/phases/detect-phase.js';

test('CONTRACT: fully gated synthetic dead interaction stays CONFIRMED (Phase 8/9 compatible)', async () => {
  const base = mkdtempSync(join(tmpdir(), 'verax-positive-'));
  const evidenceDir = join(base, 'evidence');
  mkdirSync(evidenceDir, { recursive: true });

  // Minimal evidence files for state comparison + expNum mapping.
  writeFileSync(join(evidenceDir, 'exp_1_before.png'), Buffer.from([0]));
  writeFileSync(join(evidenceDir, 'exp_1_after.png'), Buffer.from([0]));
  writeFileSync(join(evidenceDir, 'exp_1_dom_diff.json'), JSON.stringify({ changed: false, isMeaningful: false }) + '\n', 'utf8');

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
              hasOnClick: true,
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
    stats: { totalExpectations: 1, attempted: 1, completed: 1, observed: 0, skippedReasons: {} },
    status: 'SUCCESS',
  };

  try {
    const detectData = await detectPhase({
      learnData,
      observeData,
      projectRoot: '.',
      evidenceDir,
      events: { emit() {} },
    });

    assert.equal(detectData.findings.length, 1);
    assert.equal(detectData.findings[0].type, 'dead_interaction_silent_failure');
    assert.equal(detectData.findings[0].status, 'CONFIRMED');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

