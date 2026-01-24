/**
 * Evidence capture service should never silently succeed on empty DOM signatures.
 */
import test from 'node:test';
import assert from 'node:assert';
import {
  captureDomSignatureSafe,
  EVIDENCE_CAPTURE_STAGE,
  EVIDENCE_CAPTURE_FAILURE_CODES
} from '../src/verax/core/evidence/evidence-capture-service.js';

// Helper fake page that returns the provided value or throws.
function makeFakePage(evaluateImpl) {
  return {
    evaluate: evaluateImpl
  };
}

test('captureDomSignatureSafe returns failure when DOM capture returns null', async () => {
  const page = makeFakePage(async () => {
    throw new Error('dom capture failed');
  });

  const result = await captureDomSignatureSafe(page);

  assert.strictEqual(result.success, false);
  assert.strictEqual(result.domSignature, null);
  assert.ok(result.failure, 'failure should be recorded');
  assert.strictEqual(result.failure.stage, EVIDENCE_CAPTURE_STAGE.DOM_SIGNATURE);
  assert.strictEqual(result.failure.reasonCode, EVIDENCE_CAPTURE_FAILURE_CODES.DOM_SIGNATURE_FAILED);
  assert.match(result.failure.reason, /empty result|failed/i);
});

test('captureDomSignatureSafe returns success with a digest when capture succeeds', async () => {
  const page = makeFakePage(async () => 'Hello World');

  const result = await captureDomSignatureSafe(page);

  assert.strictEqual(result.success, true);
  assert.ok(typeof result.domSignature === 'string');
  assert.strictEqual(result.domSignature.length, 64);
  assert.strictEqual(result.failure, null);
});
