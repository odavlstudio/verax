#!/usr/bin/env node

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRiskSummary } from '../../src/cli/util/detection/risk-framing.js';

function makeFinding({
  status = 'CONFIRMED',
  type = 'navigation_silent_failure',
  severity = 'HIGH',
  confidence = 0.8,
  silenceKind = 'NO_NAVIGATION'
} = {}) {
  return {
    status,
    type,
    severity,
    confidence,
    silenceKind
  };
}

test('Deterministic: NO_NAVIGATION + HIGH severity + high confidence', () => {
  const finding = makeFinding({
    status: 'CONFIRMED',
    type: 'navigation_silent_failure',
    severity: 'HIGH',
    confidence: 0.85,
    silenceKind: 'NO_NAVIGATION'
  });
  const a = generateRiskSummary(finding);
  const b = generateRiskSummary(finding);
  assert.deepEqual(a, b);
  assert.equal(a.riskSummary, 'Users cannot proceed to next step; action silently failed.');
});

test('Deterministic: BLOCKED_WITHOUT_MESSAGE + MEDIUM severity + high confidence', () => {
  const finding = makeFinding({
    status: 'CONFIRMED',
    type: 'network_silent_failure',
    severity: 'MEDIUM',
    confidence: 0.75,
    silenceKind: 'BLOCKED_WITHOUT_MESSAGE'
  });
  const out = generateRiskSummary(finding);
  assert.equal(out.riskSummary, 'Request may have failed silently; user may retry or abandon.');
});

test('Deterministic: STALLED_LOADING + HIGH severity + low confidence (risk uncertain)', () => {
  const finding = makeFinding({
    status: 'SUSPECTED',
    type: 'no_effect_silent_failure',
    severity: 'HIGH',
    confidence: 0.65,
    silenceKind: 'STALLED_LOADING'
  });
  const out = generateRiskSummary(finding);
  assert.equal(
    out.riskSummary,
    'Risk uncertain due to incomplete evidence; Loading indicator without progress; user likely to abandon workflow.'
  );
});

test('Deterministic: UNKNOWN_SILENCE + MEDIUM severity + high confidence', () => {
  const finding = makeFinding({
    status: 'CONFIRMED',
    type: 'silent_failure',
    severity: 'MEDIUM',
    confidence: 0.72,
    silenceKind: 'UNKNOWN_SILENCE'
  });
  const out = generateRiskSummary(finding);
  assert.equal(out.riskSummary, 'Unexpected behavior observed; user may be confused.');
});

test('Graceful fallback: maps undefined silenceKind with severity mapping', () => {
  const finding = makeFinding({
    status: 'CONFIRMED',
    type: 'silent_failure',
    severity: 'MEDIUM',
    confidence: 0.8,
    silenceKind: undefined
  });
  const out = generateRiskSummary(finding);
  assert.ok(out.riskSummary);
  // When silenceKind is undefined, function defaults to generic fallback based on severity
  // For MEDIUM severity: 'Navigation was expected but did not occur; user may be blocked.'
  assert.equal(out.riskSummary, 'Navigation was expected but did not occur; user may be blocked.');
});

test('No semantic changes: severity, confidence, status untouched', () => {
  const finding = makeFinding({
    status: 'CONFIRMED',
    type: 'silent_failure',
    severity: 'HIGH',
    confidence: 0.88,
    silenceKind: 'NO_NAVIGATION'
  });
  const orig = { ...finding };
  generateRiskSummary(finding);
  assert.equal(finding.status, orig.status);
  assert.equal(finding.severity, orig.severity);
  assert.equal(finding.confidence, orig.confidence);
});

test('Does not apply to non-silent-failure findings', () => {
  const finding = {
    status: 'CONFIRMED',
    type: 'informational',
    severity: 'HIGH',
    confidence: 0.9,
    silenceKind: 'NO_NAVIGATION'
  };
  const out = generateRiskSummary(finding);
  assert.deepEqual(out, {});
});

test('Does not apply to SUSPECTED findings that are not silent failures', () => {
  const finding = {
    status: 'CONFIRMED',
    type: 'coverage_gap',
    severity: 'MEDIUM',
    confidence: 0.75,
    silenceKind: 'NO_NAVIGATION'
  };
  const out = generateRiskSummary(finding);
  assert.deepEqual(out, {});
});

test('NO_FEEDBACK + MEDIUM severity + low confidence', () => {
  const finding = makeFinding({
    status: 'SUSPECTED',
    type: 'missing_feedback_silent_failure',
    severity: 'MEDIUM',
    confidence: 0.65,
    silenceKind: 'NO_FEEDBACK'
  });
  const out = generateRiskSummary(finding);
  assert.equal(
    out.riskSummary,
    'Risk uncertain due to incomplete evidence; Feedback was expected but not shown; user unsure of outcome.'
  );
});

test('NO_UI_CHANGE + LOW severity + high confidence', () => {
  const finding = makeFinding({
    status: 'CONFIRMED',
    type: 'no_effect_silent_failure',
    severity: 'LOW',
    confidence: 0.8,
    silenceKind: 'NO_UI_CHANGE'
  });
  const out = generateRiskSummary(finding);
  assert.equal(out.riskSummary, 'UI change may not have occurred; unclear if critical.');
});

test('Confidence boundary: exactly 0.7 is NOT low (>= 0.7)', () => {
  const finding = makeFinding({
    status: 'CONFIRMED',
    type: 'navigation_silent_failure',
    severity: 'HIGH',
    confidence: 0.7,
    silenceKind: 'NO_NAVIGATION'
  });
  const out = generateRiskSummary(finding);
  // At confidence 0.7, lowConfidence is false (< 0.7 check)
  assert.equal(out.riskSummary, 'Users cannot proceed to next step; action silently failed.');
});

test('Confidence boundary: 0.69 is low (< 0.7)', () => {
  const finding = makeFinding({
    status: 'CONFIRMED',
    type: 'navigation_silent_failure',
    severity: 'HIGH',
    confidence: 0.69,
    silenceKind: 'NO_NAVIGATION'
  });
  const out = generateRiskSummary(finding);
  // At confidence 0.69, lowConfidence is true
  assert.equal(
    out.riskSummary,
    'Risk uncertain due to incomplete evidence; Users cannot proceed to next step; action silently failed.'
  );
});




