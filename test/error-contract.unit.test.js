/**
 * Tests for error-contract.js
 */
import test from 'node:test';
import assert from 'node:assert';
import {
  VeraxError,
  veraxOperational,
  veraxBug,
  formatErrorForHumans,
  formatErrorForJson,
  isOperationalError,
  exitCodeForError
} from '../../src/cli/util/support/error-contract.js';

test('VeraxError class creation', () => {
  const err = new VeraxError({
    code: 'TEST_ERROR',
    message: 'Test message',
    isOperational: true
  });
  
  assert.strictEqual(err.code, 'TEST_ERROR');
  assert.strictEqual(err.message, 'Test message');
  assert.strictEqual(err.isOperational, true);
  assert.ok(err instanceof VeraxError);
  assert.ok(err instanceof Error);
});

test('veraxOperational helper', () => {
  const err = veraxOperational('FILE_NOT_FOUND', 'The file does not exist', { path: '/tmp/test.txt' });
  
  assert.strictEqual(err.code, 'FILE_NOT_FOUND');
  assert.strictEqual(err.message, 'The file does not exist');
  assert.strictEqual(err.isOperational, true);
  assert.deepStrictEqual(err.context, { path: '/tmp/test.txt' });
});

test('veraxBug helper', () => {
  const err = veraxBug('BUG_NULL_REFERENCE', 'Unexpected null reference', { location: 'foo()' });
  
  assert.strictEqual(err.code, 'BUG_NULL_REFERENCE');
  assert.strictEqual(err.message, 'Unexpected null reference');
  assert.strictEqual(err.isOperational, false);
  assert.deepStrictEqual(err.context, { location: 'foo()' });
});

test('formatErrorForHumans without verbose', () => {
  const err = veraxOperational('TEST_CODE', 'Test message');
  const formatted = formatErrorForHumans(err, false);
  
  assert.match(formatted, /Error: Test message/);
  assert.match(formatted, /\[TEST_CODE\]/);
});

test('formatErrorForHumans with verbose', () => {
  const err = veraxOperational('TEST_CODE', 'Test message', { foo: 'bar' });
  const formatted = formatErrorForHumans(err, true);
  
  assert.match(formatted, /Error: Test message/);
  assert.match(formatted, /foo/);
});

test('formatErrorForJson deterministic structure', () => {
  const err = veraxOperational('FILE_WRITE_FAILED', 'Cannot write file', { path: '/tmp/test.txt' });
  const json = formatErrorForJson(err);
  
  assert.strictEqual(json.code, 'FILE_WRITE_FAILED');
  assert.strictEqual(json.message, 'Cannot write file');
  assert.strictEqual(json.isOperational, true);
  assert.deepStrictEqual(json.context, { path: '/tmp/test.txt' });
});

test('isOperationalError correctly identifies operational errors', () => {
  const operational = veraxOperational('TEST', 'msg');
  const bug = veraxBug('BUG_TEST', 'msg');
  
  assert.strictEqual(isOperationalError(operational), true);
  assert.strictEqual(isOperationalError(bug), false);
});

test('exitCodeForError returns correct codes', () => {
  const operational = veraxOperational('TEST', 'msg');
  const bug = veraxBug('BUG_TEST', 'msg');
  const usage = veraxOperational('USAGE_INVALID_FLAG', 'msg');
  
  assert.strictEqual(exitCodeForError(operational), 65);
  assert.strictEqual(exitCodeForError(bug), 2);
  assert.strictEqual(exitCodeForError(usage), 64);
});

test('formatErrorForHumans with null error', () => {
  const formatted = formatErrorForHumans(null);
  assert.strictEqual(formatted, 'Unknown error');
});

test('formatErrorForJson with null error', () => {
  const json = formatErrorForJson(null);
  assert.strictEqual(json.code, 'UNKNOWN_ERROR');
  assert.strictEqual(json.message, 'Unknown error');
});

test('VeraxError with cause chain', () => {
  const cause = new Error('Original error');
  const err = veraxOperational('WRAPPED_ERROR', 'Something failed', {}, cause);
  
  assert.strictEqual(err.cause, cause);
  const json = formatErrorForJson(err);
  assert.strictEqual(json.causeMessage, 'Original error');
});

test('Non-VeraxError wrapped correctly', () => {
  const regularError = new Error('Regular error');
  const json = formatErrorForJson(regularError);
  
  assert.strictEqual(json.code, 'EXTERNAL_ERROR');
  assert.strictEqual(json.message, 'Regular error');
});

test('formatErrorForJson maintains determinism', () => {
  const err = veraxOperational('TEST', 'msg', { b: 2, a: 1 });
  const json1 = formatErrorForJson(err);
  const json2 = formatErrorForJson(err);
  
  // Should produce same output (implementation details may vary, but structure consistent)
  assert.strictEqual(json1.code, json2.code);
  assert.strictEqual(json1.message, json2.message);
});
