/**
 * Unit Tests: Stable ID Generation
 * 
 * Verifies deterministic ID generation for observable layers
 */

import test from 'node:test';
import assert from 'node:assert';
import { stableHashId, createCounterId } from '../src/verax/observe/stable-id.js';

test('stableHashId - determinism: identical inputs produce identical IDs', () => {
  const id1 = stableHashId('obs-nav', { url: '/home', selector: 'a.btn' });
  const id2 = stableHashId('obs-nav', { url: '/home', selector: 'a.btn' });
  
  assert.strictEqual(id1, id2, 'Identical inputs must produce identical IDs');
});

test('stableHashId - key order independence: sorted internally', () => {
  const id1 = stableHashId('obs-nav', { url: '/home', selector: 'a.btn', type: 'click' });
  const id2 = stableHashId('obs-nav', { selector: 'a.btn', type: 'click', url: '/home' });
  
  assert.strictEqual(id1, id2, 'Key order should not affect hash');
});

test('stableHashId - different inputs produce different IDs', () => {
  const id1 = stableHashId('obs-nav', { url: '/home' });
  const id2 = stableHashId('obs-nav', { url: '/about' });
  
  assert.notStrictEqual(id1, id2, 'Different inputs must produce different IDs');
});

test('stableHashId - different prefixes produce different IDs', () => {
  const id1 = stableHashId('obs-nav', { url: '/home' });
  const id2 = stableHashId('obs-net', { url: '/home' });
  
  assert.notStrictEqual(id1, id2, 'Different prefixes must produce different IDs');
});

test('stableHashId - null/undefined handling', () => {
  const id1 = stableHashId('test', null);
  const id2 = stableHashId('test', undefined);
  const id3 = stableHashId('test', {});
  
  // null and undefined should produce same hash (both become empty string)
  assert.strictEqual(id1, id2, 'null and undefined should produce same ID');
  assert.notStrictEqual(id1, id3, 'empty vs null should differ');
});

test('stableHashId - nested objects deterministic', () => {
  const id1 = stableHashId('test', { 
    outer: { inner: 'value', num: 42 },
    array: [1, 2, 3]
  });
  const id2 = stableHashId('test', { 
    array: [1, 2, 3],
    outer: { num: 42, inner: 'value' }
  });
  
  assert.strictEqual(id1, id2, 'Nested objects with different key order should produce same ID');
});

test('stableHashId - array order matters', () => {
  const id1 = stableHashId('test', { items: [1, 2, 3] });
  const id2 = stableHashId('test', { items: [3, 2, 1] });
  
  assert.notStrictEqual(id1, id2, 'Array order should affect hash');
});

test('stableHashId - format: prefix-hash', () => {
  const id = stableHashId('obs-nav', { url: '/test' });
  
  assert.ok(id.startsWith('obs-nav-'), 'ID should start with prefix');
  assert.ok(/^obs-nav-[a-f0-9]{8}$/.test(id), 'ID should be prefix-hash format with 8 hex chars');
});

test('createCounterId - incremental IDs', () => {
  const gen = createCounterId('loading');
  
  assert.strictEqual(gen(), 'loading-1');
  assert.strictEqual(gen(), 'loading-2');
  assert.strictEqual(gen(), 'loading-3');
});

test('createCounterId - independent generators', () => {
  const gen1 = createCounterId('loading');
  const gen2 = createCounterId('nav');
  
  assert.strictEqual(gen1(), 'loading-1');
  assert.strictEqual(gen2(), 'nav-1');
  assert.strictEqual(gen1(), 'loading-2');
  assert.strictEqual(gen2(), 'nav-2');
});

test('createCounterId - deterministic across restarts (within process)', () => {
  // Each generator starts from 1
  const gen = createCounterId('test');
  assert.strictEqual(gen(), 'test-1');
  assert.strictEqual(gen(), 'test-2');
});
