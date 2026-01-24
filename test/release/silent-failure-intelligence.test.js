#!/usr/bin/env node

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySilentFailure } from '../../src/cli/util/detection/silent-failure-intelligence.js';

function makeFinding({ status = 'CONFIRMED', type = 'navigation_silent_failure', signals = {} } = {}) {
  return {
    status,
    type,
    evidencePackage: { signals }
  };
}

test('Deterministic: NO_NAVIGATION classification', () => {
  const finding = makeFinding({
    status: 'CONFIRMED',
    type: 'navigation_silent_failure',
    signals: { navigation: { urlChanged: false } }
  });
  const a = classifySilentFailure(finding);
  const b = classifySilentFailure(finding);
  assert.deepEqual(a, b);
  assert.equal(a.silenceKind, 'NO_NAVIGATION');
  assert.equal(a.silenceExplanation, 'Expected navigation but URL did not change.');
  assert.equal(a.userRisk, 'HIGH');
});

test('Deterministic: STALLED_LOADING classification', () => {
  const finding = makeFinding({
    status: 'SUSPECTED',
    type: 'no_effect_silent_failure',
    signals: { uiSignals: { hasLoadingIndicator: true, changed: false } }
  });
  const out = classifySilentFailure(finding);
  assert.equal(out.silenceKind, 'STALLED_LOADING');
  assert.equal(out.silenceExplanation, 'Loading indicator appeared but no progress or state change was observed.');
  assert.equal(out.userRisk, 'LOW'); // SUSPECTED → LOW for stalled loading
});

test('Graceful fallback: UNKNOWN_SILENCE when evidence insufficient', () => {
  const finding = makeFinding({ status: 'CONFIRMED', type: 'silent_failure', signals: {} });
  const out = classifySilentFailure(finding);
  assert.equal(out.silenceKind, 'UNKNOWN_SILENCE');
  assert.equal(out.silenceExplanation, 'Expected user-visible outcome was not observed; evidence incomplete.');
  assert.equal(out.userRisk, 'LOW');
});

test('No semantic changes: severity/confidence untouched', () => {
  const finding = {
    status: 'CONFIRMED',
    type: 'silent_failure',
    confidence: 0.72,
    evidencePackage: { signals: { uiSignals: { changed: false } } }
  };
  const out = classifySilentFailure(finding);
  assert.equal(finding.status, 'CONFIRMED');
  assert.equal(finding.confidence, 0.72);
  assert.ok(out.silenceKind);
});




