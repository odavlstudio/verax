/**
 * Sensor semantics normalization must preserve legacy boolean outcomes.
 */
import test from 'node:test';
import assert from 'node:assert';
import { normalizeSensorState, SENSOR_STATE } from '../src/verax/shared/sensors/normalize-sensor-state.js';
import { hasNetworkData, hasConsoleData, hasUiData, hasAnyFeedback } from '../src/verax/detect/confidence/sensor-presence.js';
import { computeConfidence } from '../src/verax/core/confidence/index.js';

// Legacy predicates (pre-normalization) for equivalence checks
function legacyHasNetworkData(networkSummary) {
  if (!networkSummary || typeof networkSummary !== 'object') return false;
  const hasRequests = (networkSummary.totalRequests || 0) > 0;
  const hasFailures = (networkSummary.failedRequests || 0) > 0;
  const hasSlow = (networkSummary.slowRequests || 0) > 0;
  const hasFailedUrls = Array.isArray(networkSummary.topFailedUrls) && networkSummary.topFailedUrls.length > 0;
  const hasSlowUrls = Array.isArray(networkSummary.topSlowUrls) && networkSummary.topSlowUrls.length > 0;
  return hasRequests || hasFailures || hasSlow || hasFailedUrls || hasSlowUrls;
}

function legacyHasConsoleData(consoleSummary) {
  if (!consoleSummary || typeof consoleSummary !== 'object') return false;
  const hasMessages = (consoleSummary.totalMessages || 0) > 0;
  const hasErrors = (consoleSummary.errors || 0) > 0 || (consoleSummary.pageErrorCount || 0) > 0;
  const hasWarnings = (consoleSummary.warnings || 0) > 0;
  const hasEntries = Array.isArray(consoleSummary.entries) && consoleSummary.entries.length > 0;
  return hasMessages || hasErrors || hasWarnings || hasEntries;
}

function legacyHasUiData(uiSignals) {
  if (!uiSignals || typeof uiSignals !== 'object') return false;
  const diff = uiSignals.diff || uiSignals;
  const hasAnyDelta = diff.hasAnyDelta === true || diff.changed === true;
  const hasDomChange = diff.domChanged === true;
  const hasVisibleChange = diff.visibleChanged === true;
  const hasAriaChange = diff.ariaChanged === true;
  const hasFocusChange = diff.focusChanged === true;
  const hasTextChange = diff.textChanged === true;
  const hasChangesField = uiSignals.changes && typeof uiSignals.changes === 'object';
  return hasAnyDelta || hasDomChange || hasVisibleChange || hasAriaChange || hasFocusChange || hasTextChange || hasChangesField;
}

function legacyHasAnyFeedback(uiSignals = {}) {
  const before = uiSignals.before || {};
  const after = uiSignals.after || {};
  return (
    before.hasErrorSignal || after.hasErrorSignal ||
    before.hasLoadingIndicator || after.hasLoadingIndicator ||
    before.hasStatusSignal || after.hasStatusSignal ||
    before.hasLiveRegion || after.hasLiveRegion ||
    before.hasDialog || after.hasDialog ||
    (before.disabledElements?.length || 0) > 0 ||
    (after.disabledElements?.length || 0) > 0
  );
}

// --- Normalization semantics ---

test('normalizeSensorState classifies ABSENT/EMPTY/PRESENT/FAILED without altering data', () => {
  const absent = normalizeSensorState(null);
  assert.strictEqual(absent.state, SENSOR_STATE.ABSENT);

  const empty = normalizeSensorState({}, { hasData: () => false });
  assert.strictEqual(empty.state, SENSOR_STATE.EMPTY);

  const present = normalizeSensorState({ foo: 1 }, { hasData: () => true });
  assert.strictEqual(present.state, SENSOR_STATE.PRESENT);

  const failed = normalizeSensorState({ foo: 1 }, { failed: true, error: new Error('boom') });
  assert.strictEqual(failed.state, SENSOR_STATE.FAILED);
  assert.ok(failed.error instanceof Error || failed.error === null);
});

// --- Equivalence: network ---

const networkSamples = [
  undefined,
  null,
  {},
  { totalRequests: 0, failedRequests: 0, slowRequests: 0 },
  { totalRequests: 1 },
  { failedRequests: 1 },
  { slowRequests: 1 },
  { topFailedUrls: [{ url: 'x' }] },
  { topSlowUrls: [{ url: 'y' }] }
];

for (const sample of networkSamples) {
  test(`hasNetworkData matches legacy for sample ${JSON.stringify(sample)}`, () => {
    assert.strictEqual(hasNetworkData(sample), legacyHasNetworkData(sample));
  });
}

// --- Equivalence: console ---

const consoleSamples = [
  undefined,
  null,
  {},
  { totalMessages: 0, errors: 0, warnings: 0 },
  { errors: 1 },
  { warnings: 1 },
  { totalMessages: 2 },
  { entries: [{ type: 'log' }] },
  { pageErrorCount: 1 }
];

for (const sample of consoleSamples) {
  test(`hasConsoleData matches legacy for sample ${JSON.stringify(sample)}`, () => {
    assert.strictEqual(hasConsoleData(sample), legacyHasConsoleData(sample));
  });
}

// --- Equivalence: UI data ---

const uiSamples = [
  undefined,
  null,
  {},
  { diff: { changed: true } },
  { diff: { domChanged: true } },
  { diff: { visibleChanged: true } },
  { diff: { ariaChanged: true } },
  { diff: { focusChanged: true } },
  { diff: { textChanged: true } },
  { changes: { any: true } }
];

for (const sample of uiSamples) {
  test(`hasUiData matches legacy for sample ${JSON.stringify(sample)}`, () => {
    assert.strictEqual(hasUiData(sample), legacyHasUiData(sample));
  });
}

// --- Equivalence: UI feedback ---

const feedbackSamples = [
  undefined,
  {},
  { before: { hasLoadingIndicator: true } },
  { after: { hasErrorSignal: true } },
  { before: { disabledElements: [{ id: 1 }] } },
  { after: { hasLiveRegion: true } }
];

for (const sample of feedbackSamples) {
  test(`hasAnyFeedback matches legacy for sample ${JSON.stringify(sample)}`, () => {
    assert.strictEqual(hasAnyFeedback(sample), legacyHasAnyFeedback(sample));
  });
}

// --- Confidence and Evidence Law remain unchanged ---

test('CONFIRMED without evidence still downgrades (Evidence Law)', () => {
  const result = computeConfidence({
    findingType: 'test-finding',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {},
    comparisons: {},
    evidence: { isComplete: false, signals: {} },
    truthStatus: 'CONFIRMED'
  });

  assert.strictEqual(result.truthStatus, 'SUSPECTED');
});

test('CONFIRMED with substantive evidence remains CONFIRMED', () => {
  const result = computeConfidence({
    findingType: 'test-finding',
    expectation: { proof: 'PROVEN_EXPECTATION' },
    sensors: {
      network: { totalRequests: 1, failedRequests: 0, successfulRequests: 1, hasNetworkActivity: true },
      console: { errors: 0, warnings: 0, logs: 0 },
      uiSignals: { diff: { changed: true } }
    },
    comparisons: { hasUrlChange: true },
    evidence: {
      isComplete: true,
      before: { screenshot: 'a', url: 'http://before' },
      after: { screenshot: 'b', url: 'http://after' },
      signals: {
        network: { totalRequests: 1, failedRequests: 0, successfulRequests: 1, hasNetworkActivity: true }
      }
    },
    truthStatus: 'CONFIRMED'
  });

  assert.strictEqual(result.truthStatus, 'CONFIRMED');
});
