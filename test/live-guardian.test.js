/**
 * Live Guardian Tests
 * - Scheduler state persistence
 * - Baseline comparison logic  
 * - Alert triggering on real regressions
 * Uses assert instead of ava
 */

const assert = require('assert');
const { LiveState } = require('../src/guardian/live-state');
const { extractHumanOutcomes, compareHumanOutcomes, shouldAlert, formatComparisonForAlert } = require('../src/guardian/live-baseline-compare');
const fs = require('fs');
const path = require('path');
const os = require('os');

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
    process.exit(1);
  }
}

// Test 1: Live State persistence
test('LiveState: start and save state', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-test-'));
  const stateFile = path.join(tmpDir, 'live-state.json');
  const state = new LiveState(stateFile);

  state.start(60);
  const s = state.getState();

  assert.strictEqual(s.running, true);
  assert.strictEqual(s.intervalMinutes, 60);
  assert.ok(s.nextRunTime);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
});

test('LiveState: stop clears state', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-test-'));
  const stateFile = path.join(tmpDir, 'live-state.json');
  const state = new LiveState(stateFile);

  state.start(60);
  state.stop();
  const s = state.getState();

  assert.strictEqual(s.running, false);
  assert.strictEqual(s.nextRunTime, null);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
});

test('LiveState: updateLastRun sets next run time', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-test-'));
  const stateFile = path.join(tmpDir, 'live-state.json');
  const state = new LiveState(stateFile);

  state.start(60);
  const beforeUpdate = state.getState().nextRunTime;
  
  state.updateLastRun('run123');
  const afterUpdate = state.getState().nextRunTime;
  assert.ok(afterUpdate > beforeUpdate);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
});

// Test 2: Baseline comparison - extract outcomes
test('extractHumanOutcomes: captures journey and attempt states', () => {
  const snapshot = {
    journey: {
      completedGoal: true,
      abandoned: false,
      frustrationLevel: 5,
      attemptPath: [
        { attemptId: 'site_smoke', outcome: 'SUCCESS' }
      ]
    },
    attempts: [
      { attemptId: 'site_smoke', outcome: 'SUCCESS' }
    ],
    finalVerdict: 'READY',
    exitCode: 0
  };

  const outcomes = extractHumanOutcomes(snapshot);

  assert.strictEqual(outcomes.journey.completed, true);
  assert.strictEqual(outcomes.journey.abandoned, false);
  assert.strictEqual(outcomes.attempts[0].outcome, 'SUCCESS');
  assert.strictEqual(outcomes.verdict, 'READY');
});

test('extractHumanOutcomes: handles missing data gracefully', () => {
  const outcomes = extractHumanOutcomes(null);
  assert.strictEqual(outcomes, null);

  const outcomes2 = extractHumanOutcomes({});
  assert.strictEqual(outcomes2.journey.completed, false);
  assert.strictEqual(outcomes2.journey.abandoned, false);
  assert.deepStrictEqual(outcomes2.attempts, []);
});

// Test 3: Baseline comparison - detect regressions
test('compareHumanOutcomes: detects CRITICAL regression when journey completion is lost', () => {
  const baseline = extractHumanOutcomes({
    journey: { completedGoal: true, abandoned: false, attemptPath: [] },
    attempts: [{ attemptId: 'site_smoke', outcome: 'SUCCESS' }],
    finalVerdict: 'READY'
  });

  const current = extractHumanOutcomes({
    journey: { completedGoal: false, abandoned: false, attemptPath: [] },
    attempts: [{ attemptId: 'site_smoke', outcome: 'FAILURE' }],
    finalVerdict: 'DO_NOT_LAUNCH'
  });

  const comparison = compareHumanOutcomes(baseline, current);

  assert.strictEqual(comparison.hasRegressions, true);
  const criticalDiffs = comparison.diffs.filter(d => d.type === 'JOURNEY_COMPLETION_LOST');
  assert.strictEqual(criticalDiffs.length, 1);
  assert.strictEqual(criticalDiffs[0].severity, 'CRITICAL');
});

test('compareHumanOutcomes: detects CRITICAL regression when journey is abandoned', () => {
  const baseline = extractHumanOutcomes({
    journey: { completedGoal: true, abandoned: false, attemptPath: [] },
    attempts: [],
    finalVerdict: 'READY'
  });

  const current = extractHumanOutcomes({
    journey: { completedGoal: false, abandoned: true, attemptPath: [] },
    attempts: [],
    finalVerdict: 'DO_NOT_LAUNCH'
  });

  const comparison = compareHumanOutcomes(baseline, current);

  assert.strictEqual(comparison.hasRegressions, true);
  const abandonmentDiffs = comparison.diffs.filter(d => d.type === 'JOURNEY_ABANDONMENT');
  assert.strictEqual(abandonmentDiffs.length, 1);
});

test('compareHumanOutcomes: detects HIGH regression when attempt flips from SUCCESS to FAILURE', () => {
  const baseline = extractHumanOutcomes({
    journey: { completedGoal: true, abandoned: false, attemptPath: [] },
    attempts: [{ attemptId: 'site_smoke', outcome: 'SUCCESS' }],
    finalVerdict: 'READY'
  });

  const current = extractHumanOutcomes({
    journey: { completedGoal: true, abandoned: false, attemptPath: [] },
    attempts: [{ attemptId: 'site_smoke', outcome: 'FAILURE' }],
    finalVerdict: 'READY'
  });

  const comparison = compareHumanOutcomes(baseline, current);

  assert.strictEqual(comparison.hasRegressions, true);
  const attemptDiffs = comparison.diffs.filter(d => d.type === 'ATTEMPT_REGRESSION');
  assert.strictEqual(attemptDiffs.length, 1);
  assert.strictEqual(attemptDiffs[0].severity, 'HIGH');
});

test('compareHumanOutcomes: detects no regression when behavior unchanged', () => {
  const baseline = extractHumanOutcomes({
    journey: { completedGoal: true, abandoned: false, attemptPath: [] },
    attempts: [{ attemptId: 'site_smoke', outcome: 'SUCCESS' }],
    finalVerdict: 'READY'
  });

  const current = extractHumanOutcomes({
    journey: { completedGoal: true, abandoned: false, attemptPath: [] },
    attempts: [{ attemptId: 'site_smoke', outcome: 'SUCCESS' }],
    finalVerdict: 'READY'
  });

  const comparison = compareHumanOutcomes(baseline, current);

  assert.strictEqual(comparison.hasRegressions, false);
  assert.strictEqual(comparison.diffs.length, 0);
});

// Test 4: Alert triggering
test('shouldAlert: returns true for CRITICAL severity diffs', () => {
  const comparison = {
    hasRegressions: true,
    diffs: [
      { type: 'JOURNEY_COMPLETION_LOST', severity: 'CRITICAL', message: 'Journey lost' }
    ]
  };

  assert.strictEqual(shouldAlert(comparison), true);
});

test('shouldAlert: returns true for HIGH severity diffs', () => {
  const comparison = {
    hasRegressions: true,
    diffs: [
      { type: 'ATTEMPT_REGRESSION', severity: 'HIGH', message: 'Attempt failed' }
    ]
  };

  assert.strictEqual(shouldAlert(comparison), true);
});

test('shouldAlert: returns false when no regressions', () => {
  const comparison = {
    hasRegressions: false,
    diffs: []
  };

  assert.strictEqual(shouldAlert(comparison), false);
});

test('shouldAlert: returns false for null comparison', () => {
  assert.strictEqual(shouldAlert(null), false);
  assert.strictEqual(shouldAlert(undefined), false);
});

// Test 5: Alert formatting
test('formatComparisonForAlert: formats critical and high diffs correctly', () => {
  const comparison = {
    diffs: [
      { type: 'JOURNEY_COMPLETION_LOST', severity: 'CRITICAL', message: 'Journey lost' },
      { type: 'ATTEMPT_REGRESSION', severity: 'HIGH', message: 'Attempt failed' }
    ]
  };

  const alert = formatComparisonForAlert(comparison);

  assert.strictEqual(alert.severity, 'CRITICAL');
  assert.ok(alert.message.includes('CRITICAL'));
  assert.ok(alert.message.includes('Journey lost'));
  assert.ok(alert.message.includes('HIGH'));
  assert.ok(alert.message.includes('Attempt failed'));
  assert.strictEqual(alert.diffCount, 2);
});

// Test 6: Abandoned journey can never produce READY verdict
test('abandoned journey blocks READY verdict (comparison detects abandonment)', () => {
  const baseline = extractHumanOutcomes({
    journey: { completedGoal: true, abandoned: false, attemptPath: [] },
    attempts: [],
    finalVerdict: 'READY'
  });

  const abandoned = extractHumanOutcomes({
    journey: { completedGoal: false, abandoned: true, attemptPath: [] },
    attempts: [],
    finalVerdict: 'READY' // If someone tries to report READY on abandon
  });

  const comparison = compareHumanOutcomes(baseline, abandoned);

  // The comparison must detect the abandonment
  assert.strictEqual(comparison.hasRegressions, true);
  const abandonmentFound = comparison.diffs.some(d => d.type === 'JOURNEY_ABANDONMENT');
  assert.ok(abandonmentFound);
});

console.log('\n✅ All Live Guardian unit tests passed!\n');
