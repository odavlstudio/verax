/**
 * Path Normalization Tests (ISSUE #25 - Batch A4.1)
 * Ensures deterministic path output across Windows/POSIX platforms
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeToPosixPath } from '../src/cli/util/support/normalize-path.js';

test('normalizeToPosixPath: converts Windows backslashes to forward slashes', () => {
  const result = normalizeToPosixPath('a\\b\\c');
  assert.strictEqual(result, 'a/b/c');
});

test('normalizeToPosixPath: preserves already-POSIX paths', () => {
  const result = normalizeToPosixPath('a/b/c');
  assert.strictEqual(result, 'a/b/c');
});

test('normalizeToPosixPath: handles mixed separators', () => {
  const result = normalizeToPosixPath('a\\b/c\\d');
  assert.strictEqual(result, 'a/b/c/d');
});

test('normalizeToPosixPath: handles empty input', () => {
  const result = normalizeToPosixPath('');
  assert.strictEqual(result, '');
});

test('normalizeToPosixPath: handles undefined input', () => {
  const result = normalizeToPosixPath(undefined);
  assert.strictEqual(result, '');
});

test('normalizeToPosixPath: handles null input', () => {
  const result = normalizeToPosixPath(null);
  assert.strictEqual(result, '');
});

test('normalizeToPosixPath: preserves absolute Windows paths (drive letters)', () => {
  const result = normalizeToPosixPath('C:\\Users\\test\\file.txt');
  assert.strictEqual(result, 'C:/Users/test/file.txt');
});

test('normalizeToPosixPath: preserves absolute POSIX paths', () => {
  const result = normalizeToPosixPath('/usr/local/bin/file');
  assert.strictEqual(result, '/usr/local/bin/file');
});

test('normalizeToPosixPath: deterministic output for identical inputs', () => {
  const input = 'path\\to\\file.txt';
  const result1 = normalizeToPosixPath(input);
  const result2 = normalizeToPosixPath(input);
  assert.strictEqual(result1, result2);
  assert.strictEqual(result1, 'path/to/file.txt');
});




