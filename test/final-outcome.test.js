#!/usr/bin/env node
/**
 * Unit tests for final-outcome.js
 * Tests the deterministic merge logic for verdict and exit code resolution
 */

const assert = require('assert');
const { computeFinalOutcome } = require('../src/guardian/final-outcome');

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(`   ${err.message}`);
    process.exit(1);
  }
}

// TEST 1: READY + clean policy → final READY exit 0
test('Scenario 1: Rules READY + policy clean → final READY exit 0', () => {
  const result = computeFinalOutcome({
    rulesVerdict: 'READY',
    rulesExitCode: 0,
    rulesReasons: [
      { ruleId: 'all_goals_reached', message: 'All goals reached', category: 'SUCCESS', priority: 50 }
    ],
    rulesTriggeredIds: ['all_goals_reached'],
    policySignals: {},
    policyEval: { passed: true, exitCode: 0, reasons: [] },
    coverage: { gaps: 0, total: 10, executed: 10 }
  });

  assert.strictEqual(result.finalVerdict, 'READY', 'Expected final verdict to be READY');
  assert.strictEqual(result.finalExitCode, 0, 'Expected exit code to be 0');
  assert.strictEqual(result.source, 'rules-engine-clean', 'Expected source to be rules-engine-clean');
  assert.ok(result.mergeInfo, 'Expected mergeInfo to exist');
  assert.strictEqual(result.mergeInfo.decision, 'READY confirmed (rules engine + clean policy)');
});

// TEST 2: READY + coverage gaps → final FRICTION exit 1
test('Scenario 2: Rules READY + coverage gaps → final FRICTION exit 1', () => {
  const result = computeFinalOutcome({
    rulesVerdict: 'READY',
    rulesExitCode: 0,
    rulesReasons: [
      { ruleId: 'all_goals_reached', message: 'All goals reached', category: 'SUCCESS', priority: 50 }
    ],
    rulesTriggeredIds: ['all_goals_reached'],
    policySignals: {},
    policyEval: { passed: false, exitCode: 2, reasons: ['Coverage gaps detected: 3 of 6 attempts not executed'] },
    coverage: { gaps: 3, total: 6, executed: 3 }
  });

  assert.strictEqual(result.finalVerdict, 'FRICTION', 'Expected final verdict to be FRICTION due to coverage gaps');
  assert.strictEqual(result.finalExitCode, 1, 'Expected exit code to be 1');
  assert.strictEqual(result.source, 'policy-downgrade-coverage', 'Expected source to be policy-downgrade-coverage');
  assert.ok(result.triggeredRuleIds.includes('ready_downgraded_coverage_gaps'), 'Expected downgrade rule to be triggered');
  assert.ok(result.mergeInfo, 'Expected mergeInfo to exist');
  assert.ok(result.mergeInfo.decision.includes('coverage gaps'), 'Expected decision to mention coverage gaps');
});

// TEST 3: FRICTION + clean policy → final FRICTION exit 1
test('Scenario 3: Rules FRICTION + policy clean → final FRICTION exit 1', () => {
  const result = computeFinalOutcome({
    rulesVerdict: 'FRICTION',
    rulesExitCode: 1,
    rulesReasons: [
      { ruleId: 'partial_success', message: 'Some attempts had friction', category: 'WARNING', priority: 70 }
    ],
    rulesTriggeredIds: ['partial_success'],
    policySignals: {},
    policyEval: { passed: true, exitCode: 0, reasons: [] },
    coverage: { gaps: 0, total: 5, executed: 5 }
  });

  assert.strictEqual(result.finalVerdict, 'FRICTION', 'Expected final verdict to be FRICTION');
  assert.strictEqual(result.finalExitCode, 1, 'Expected exit code to be 1');
  assert.strictEqual(result.source, 'rules-engine-friction', 'Expected source to be rules-engine-friction');
  assert.ok(result.mergeInfo, 'Expected mergeInfo to exist');
  assert.strictEqual(result.mergeInfo.decision, 'Rules engine returned FRICTION (preserved)');
});

// TEST 4: DO_NOT_LAUNCH + anything → final DO_NOT_LAUNCH exit 2
test('Scenario 4: Rules DO_NOT_LAUNCH + anything → final DO_NOT_LAUNCH exit 2', () => {
  const result = computeFinalOutcome({
    rulesVerdict: 'DO_NOT_LAUNCH',
    rulesExitCode: 2,
    rulesReasons: [
      { ruleId: 'critical_failure', message: 'Critical flows failed', category: 'FAILURE', priority: 10 }
    ],
    rulesTriggeredIds: ['critical_failure'],
    policySignals: {},
    policyEval: { passed: true, exitCode: 0, reasons: [] }, // Even with clean policy
    coverage: { gaps: 0, total: 10, executed: 10 } // Even with full coverage
  });

  assert.strictEqual(result.finalVerdict, 'DO_NOT_LAUNCH', 'Expected final verdict to be DO_NOT_LAUNCH');
  assert.strictEqual(result.finalExitCode, 2, 'Expected exit code to be 2');
  assert.strictEqual(result.source, 'rules-engine-critical', 'Expected source to be rules-engine-critical');
  assert.ok(result.mergeInfo, 'Expected mergeInfo to exist');
  assert.ok(result.mergeInfo.decision.includes('DO_NOT_LAUNCH'), 'Expected decision to mention DO_NOT_LAUNCH');
});

// TEST 5: READY + policy hard failure (exitCode=1) → final FRICTION exit 1
test('Scenario 5: Rules READY + policy hard failure → final FRICTION exit 1', () => {
  const result = computeFinalOutcome({
    rulesVerdict: 'READY',
    rulesExitCode: 0,
    rulesReasons: [
      { ruleId: 'all_goals_reached', message: 'All goals reached', category: 'SUCCESS', priority: 50 }
    ],
    rulesTriggeredIds: ['all_goals_reached'],
    policySignals: {},
    policyEval: { passed: false, exitCode: 1, reasons: ['Critical policy conditions not met'] },
    coverage: { gaps: 0, total: 10, executed: 10 }
  });

  assert.strictEqual(result.finalVerdict, 'FRICTION', 'Expected final verdict to be FRICTION due to policy hard failure');
  assert.strictEqual(result.finalExitCode, 1, 'Expected exit code to be 1');
  assert.strictEqual(result.source, 'policy-downgrade-hard', 'Expected source to be policy-downgrade-hard');
  assert.ok(result.triggeredRuleIds.includes('policy_hard_failure'), 'Expected hard failure rule to be triggered');
});

// TEST 6: FRICTION + coverage gaps → final FRICTION exit 1 (no change, but policy warnings added)
test('Scenario 6: Rules FRICTION + coverage gaps → final FRICTION exit 1', () => {
  const result = computeFinalOutcome({
    rulesVerdict: 'FRICTION',
    rulesExitCode: 1,
    rulesReasons: [
      { ruleId: 'partial_success', message: 'Some attempts had friction', category: 'WARNING', priority: 70 }
    ],
    rulesTriggeredIds: ['partial_success'],
    policySignals: {},
    policyEval: { passed: false, exitCode: 2, reasons: ['Coverage gaps detected'] },
    coverage: { gaps: 2, total: 8, executed: 6 }
  });

  assert.strictEqual(result.finalVerdict, 'FRICTION', 'Expected final verdict to be FRICTION');
  assert.strictEqual(result.finalExitCode, 1, 'Expected exit code to be 1');
  assert.strictEqual(result.source, 'rules-engine-friction', 'Expected source to be rules-engine-friction');
  // Check that policy warning was added to reasons
  const hasPolicyWarning = result.reasons.some(r => r.ruleId === 'policy_coverage_warning');
  assert.ok(hasPolicyWarning, 'Expected policy coverage warning to be added to reasons');
});

// TEST 7: Fallback safety (unknown verdict) → DO_NOT_LAUNCH exit 2
test('Scenario 7: Unknown verdict → fallback DO_NOT_LAUNCH exit 2', () => {
  const result = computeFinalOutcome({
    rulesVerdict: 'UNKNOWN_STATE', // Invalid verdict
    rulesExitCode: 99,
    rulesReasons: [],
    rulesTriggeredIds: [],
    policySignals: {},
    policyEval: { passed: true, exitCode: 0, reasons: [] },
    coverage: { gaps: 0, total: 5, executed: 5 }
  });

  assert.strictEqual(result.finalVerdict, 'DO_NOT_LAUNCH', 'Expected fallback to DO_NOT_LAUNCH');
  assert.strictEqual(result.finalExitCode, 2, 'Expected exit code to be 2');
  assert.strictEqual(result.source, 'fallback', 'Expected source to be fallback');
  assert.ok(result.triggeredRuleIds.includes('fallback_safety'), 'Expected fallback_safety rule to be triggered');
});

console.log('\n🎯 All tests passed!');
console.log('\nTest scenarios covered:');
console.log('  1. READY + clean policy → READY (exit 0)');
console.log('  2. READY + coverage gaps → FRICTION (exit 1)');
console.log('  3. FRICTION + clean policy → FRICTION (exit 1)');
console.log('  4. DO_NOT_LAUNCH + anything → DO_NOT_LAUNCH (exit 2)');
console.log('  5. READY + policy hard failure → FRICTION (exit 1)');
console.log('  6. FRICTION + coverage gaps → FRICTION (exit 1)');
console.log('  7. Unknown verdict → fallback DO_NOT_LAUNCH (exit 2)');
console.log('\n✅ Final outcome merge logic is deterministic and correct.');
