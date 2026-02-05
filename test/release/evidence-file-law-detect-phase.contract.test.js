import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectPhase } from '../../src/cli/phases/detect-phase.js';

function makeLearnObserve({ evidenceFiles }) {
  const learnData = {
    expectations: [
      {
        id: 'exp_1',
        type: 'navigation',
        category: 'navigation',
        promise: { kind: 'navigate', value: '/next' },
        action: 'click',
        expectedOutcome: 'navigation',
      },
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
        evidenceFiles,
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
        },
      },
    ],
    stats: { attempted: 1, observed: 0, completed: 0, totalExpectations: 1, skippedReasons: {} },
    status: 'SUCCESS',
  };

  return { learnData, observeData };
}

test('CONTRACT: detectPhase downgrades CONFIRMED silent-failure when referenced evidence missing on disk', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'verax-evlaw-'));
  const evidenceDir = join(runDir, 'evidence');
  mkdirSync(evidenceDir, { recursive: true });

  // Only create screenshots; omit dom_diff to trigger downgrade.
  writeFileSync(join(evidenceDir, 'exp_1_before.png'), Buffer.from([0]));
  writeFileSync(join(evidenceDir, 'exp_1_after.png'), Buffer.from([0]));

  const { learnData, observeData } = makeLearnObserve({
    evidenceFiles: ['exp_1_before.png', 'exp_1_after.png', 'exp_1_dom_diff.json'],
  });

  try {
    const result = await detectPhase({
      learnData,
      observeData,
      projectRoot: '.',
      evidenceDir,
      events: { emit() {} },
    });

    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].type, 'broken_navigation_promise');
    assert.equal(result.findings[0].status, 'SUSPECTED');
    assert.ok(
      result.findings[0]?.enrichment?.evidenceFileLawDowngradeReasons?.includes('evidence_file_missing'),
      'must record evidence_file_missing downgrade reason'
    );
  } finally {
    try { rmSync(runDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

test('CONTRACT: detectPhase preserves CONFIRMED when referenced evidence exists on disk', async () => {
  const runDir = mkdtempSync(join(tmpdir(), 'verax-evlaw-'));
  const evidenceDir = join(runDir, 'evidence');
  mkdirSync(evidenceDir, { recursive: true });

  writeFileSync(join(evidenceDir, 'exp_1_before.png'), Buffer.from([0]));
  writeFileSync(join(evidenceDir, 'exp_1_after.png'), Buffer.from([0]));
  writeFileSync(join(evidenceDir, 'exp_1_dom_diff.json'), JSON.stringify({ changed: false }));

  const { learnData, observeData } = makeLearnObserve({
    evidenceFiles: ['exp_1_before.png', 'exp_1_after.png', 'exp_1_dom_diff.json'],
  });

  try {
    const result = await detectPhase({
      learnData,
      observeData,
      projectRoot: '.',
      evidenceDir,
      events: { emit() {} },
    });

    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].type, 'broken_navigation_promise');
    assert.equal(result.findings[0].status, 'CONFIRMED');
  } finally {
    try { rmSync(runDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});
