import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTimeout, RUNTIME_STABILITY_CONTRACT, isRetryAllowed } from '../src/verax/core/runtime-stability-contract.js';
import { resolveFailureMode } from '../src/verax/core/failures/failure-mode-matrix.js';
import { evaluateFrameworkSupport } from '../src/verax/core/framework-support.js';

// A) Runtime stability envelope contract
test('runtime stability envelope exposes deterministic retry+timeout rules', () => {
  assert.equal(RUNTIME_STABILITY_CONTRACT.maxRetriesPerInteraction, 2, 'max retries should be fixed at 2');
  const navTimeout = classifyTimeout('navigation');
  assert.equal(navTimeout.verdict, 'INCOMPLETE');
  assert.equal(navTimeout.reasonCode, 'navigation_timeout');

  const selector = classifyTimeout('selector');
  assert.equal(selector.verdict, 'UNPROVEN');
  assert.equal(selector.reasonCode, 'selector_not_found');

  const retryable = isRetryAllowed(new Error('element is not attached to the DOM'));
  assert.equal(retryable, true, 'DOM detachment should be retryable');
  const notRetryable = isRetryAllowed(new Error('timeout exceeded'), 'settle');
  assert.equal(notRetryable, false, 'settle timeouts must not retry');
});

// B) Failure mode matrix mapping
test('failure mode matrix maps causes to single classification', () => {
  const mode = resolveFailureMode('network_blocked');
  assert.equal(mode.verdict, 'INCOMPLETE');
  assert.equal(mode.reason, 'network_unavailable');
  assert.ok(mode.message.includes('Network'));

  const selector = resolveFailureMode('selector_not_found');
  assert.equal(selector.verdict, 'UNPROVEN');
  assert.equal(selector.reason, 'selector mismatch');
});

// C) Framework surface contract
test('framework support explicitly rejects unsupported frameworks', () => {
  const supported = evaluateFrameworkSupport('react_spa');
  assert.equal(supported.status, 'supported');

  const unsupported = evaluateFrameworkSupport('vue_router');
  assert.equal(unsupported.status, 'unsupported');
  assert.ok(unsupported.warning && unsupported.warning.length > 0, 'unsupported frameworks must emit warning text');
});
