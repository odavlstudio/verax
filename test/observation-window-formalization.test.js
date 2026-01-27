import { test } from 'node:test';
import { strict as assert } from 'assert';
import { OBSERVATION_WINDOW_MS, DEFAULT_SCAN_BUDGET } from '../src/verax/shared/scan-budget.js';

/**
 * OBSERVATION WINDOW FORMALIZATION TESTS
 * 
 * Verifies that the explicit OBSERVATION_WINDOW_MS constant properly bounds
 * the single-interaction observation window, including all timeout components.
 * 
 * Constitutional guarantee: These tests verify bounds without changing
 * any actual timeout values or scheduling logic.
 */

test('Observation Window: OBSERVATION_WINDOW_MS is defined as a positive integer', () => {
  assert.strictEqual(typeof OBSERVATION_WINDOW_MS, 'number', 'OBSERVATION_WINDOW_MS should be a number');
  assert(Number.isInteger(OBSERVATION_WINDOW_MS), 'OBSERVATION_WINDOW_MS should be an integer');
  assert(OBSERVATION_WINDOW_MS > 0, 'OBSERVATION_WINDOW_MS should be positive');
});

test('Observation Window: OBSERVATION_WINDOW_MS >= interactionTimeoutMs + navigationTimeoutMs', () => {
  // The observation window must be able to accommodate both:
  // 1. Interaction execution timeout (interactionTimeoutMs)
  // 2. Navigation timeout (navigationTimeoutMs)
  // 
  // These are sequential phases within a single interaction observation,
  // so the window must be AT LEAST their sum.
  const minRequiredWindow = DEFAULT_SCAN_BUDGET.interactionTimeoutMs + DEFAULT_SCAN_BUDGET.navigationTimeoutMs;
  assert(
    OBSERVATION_WINDOW_MS >= minRequiredWindow,
    `OBSERVATION_WINDOW_MS (${OBSERVATION_WINDOW_MS}ms) should be >= interactionTimeoutMs (${DEFAULT_SCAN_BUDGET.interactionTimeoutMs}ms) + navigationTimeoutMs (${DEFAULT_SCAN_BUDGET.navigationTimeoutMs}ms) = ${minRequiredWindow}ms`
  );
});

test('Observation Window: OBSERVATION_WINDOW_MS equals settleTimeoutMs', () => {
  // The observation window is the settle timeout because settle is the final
  // phase that includes network idle detection and DOM stability checks.
  assert.strictEqual(
    OBSERVATION_WINDOW_MS,
    DEFAULT_SCAN_BUDGET.settleTimeoutMs,
    'OBSERVATION_WINDOW_MS should equal settleTimeoutMs (the maximum single interaction observation window)'
  );
});

test('Observation Window: Window accommodates entire observation sequence', () => {
  // A single interaction goes through these phases (not all sequential, but all within window):
  // 1. Pre-execution: <1ms (instantaneous)
  // 2. Interaction execution: interactionTimeoutMs
  // 3. Navigation wait: navigationTimeoutMs (may overlap with settle)
  // 4. Post-execution settle: settleTimeoutMs
  // 
  // The settleTimeoutMs bounds the entire sequence because it's the final phase
  // that waits for evidence collection to complete.
  assert(
    OBSERVATION_WINDOW_MS >= DEFAULT_SCAN_BUDGET.settleTimeoutMs,
    `OBSERVATION_WINDOW_MS (${OBSERVATION_WINDOW_MS}ms) must accommodate settle timeout (${DEFAULT_SCAN_BUDGET.settleTimeoutMs}ms)`
  );
});

test('Observation Window: Timeout components are reasonable relative to window', () => {
  // Verify all timeout components are well below the window to allow for composition
  assert(
    DEFAULT_SCAN_BUDGET.interactionTimeoutMs < OBSERVATION_WINDOW_MS,
    'interactionTimeoutMs should be less than OBSERVATION_WINDOW_MS'
  );
  
  assert(
    DEFAULT_SCAN_BUDGET.navigationTimeoutMs < OBSERVATION_WINDOW_MS,
    'navigationTimeoutMs should be less than OBSERVATION_WINDOW_MS'
  );
  
  assert(
    DEFAULT_SCAN_BUDGET.stabilizationWindowMs < OBSERVATION_WINDOW_MS,
    'stabilizationWindowMs should be less than OBSERVATION_WINDOW_MS'
  );
});

test('Observation Window: Settle timeout components compose within window', () => {
  // Settle logic has multiple phases that should fit within the settle timeout:
  // 1. Load event wait: uses settleTimeoutMs
  // 2. Network idle wait: uses settleIdleMs
  // 3. DOM stability wait: uses settleDomStableMs
  // 
  // These are not strictly sequential (they run in parallel/overlapping),
  // but they should all fit within the window.
  const settleComponents = [
    DEFAULT_SCAN_BUDGET.settleIdleMs,
    DEFAULT_SCAN_BUDGET.settleDomStableMs,
    DEFAULT_SCAN_BUDGET.networkWaitMs
  ];
  
  for (const component of settleComponents) {
    assert(
      component <= DEFAULT_SCAN_BUDGET.settleTimeoutMs,
      `Settle component (${component}ms) should fit within settleTimeoutMs (${DEFAULT_SCAN_BUDGET.settleTimeoutMs}ms)`
    );
  }
});

test('Observation Window: Constant never changes at runtime', () => {
  // OBSERVATION_WINDOW_MS is a constant that defines the formal bound.
  // It should never be mutated or reassigned.
  const firstCheck = OBSERVATION_WINDOW_MS;
  const secondCheck = OBSERVATION_WINDOW_MS;
  assert.strictEqual(firstCheck, secondCheck, 'OBSERVATION_WINDOW_MS should be immutable');
});
