import { describe, it, beforeEach } from 'node:test';
import assert from 'assert';
import { Buffer } from 'buffer';
import { EvidenceSizeTracker } from '../../src/cli/util/evidence/evidence-size-tracker.js';

/**
 *  Evidence size accounting (instrumentation only)
 * 
 * Contract tests for EvidenceSizeTracker.
 * 
 * This test suite validates that:
 * 1. Byte counting is correct for strings, buffers, and objects
 * 2. Type aggregation works properly
 * 3. Tracker never throws or crashes
 * 4. Integration does NOT affect existing outputs
 */

describe('EvidenceSizeTracker ( Evidence size accounting)', () => {
  //  Evidence size accounting (instrumentation only)
  let tracker;

  beforeEach(() => {
    tracker = new EvidenceSizeTracker();
  });

  describe('record() - String handling', () => {
    it('should count UTF-8 byte length for ASCII strings', () => {
      const testString = 'hello';
      const bytes = tracker.record('json', testString);
      
      // 'hello' is 5 bytes in UTF-8
      assert.strictEqual(bytes, 5);
      assert.strictEqual(tracker.totalBytes, 5);
      assert.strictEqual(tracker.byType.json, 5);
    });

    it('should count UTF-8 byte length for multi-byte characters', () => {
      const testString = '🎉'; // emoji, 4 bytes in UTF-8
      const bytes = tracker.record('json', testString);
      
      assert.strictEqual(bytes, 4);
      assert.strictEqual(tracker.totalBytes, 4);
      assert.strictEqual(tracker.byType.json, 4);
    });

    it('should handle empty strings', () => {
      const bytes = tracker.record('json', '');
      
      assert.strictEqual(bytes, 0);
      assert.strictEqual(tracker.totalBytes, 0);
      assert.strictEqual(tracker.byType.json, 0);
    });

    it('should accumulate multiple strings', () => {
      tracker.record('dom', 'hello');
      tracker.record('dom', 'world');
      
      // 'hello' = 5, 'world' = 5, total = 10
      assert.strictEqual(tracker.totalBytes, 10);
      assert.strictEqual(tracker.byType.dom, 10);
    });
  });

  describe('record() - Buffer handling', () => {
    it('should count buffer length', () => {
      const buf = Buffer.from('hello', 'utf-8');
      const bytes = tracker.record('screenshots', buf);
      
      assert.strictEqual(bytes, 5);
      assert.strictEqual(tracker.totalBytes, 5);
      assert.strictEqual(tracker.byType.screenshots, 5);
    });

    it('should handle empty buffers', () => {
      const buf = Buffer.alloc(0);
      const bytes = tracker.record('screenshots', buf);
      
      assert.strictEqual(bytes, 0);
      assert.strictEqual(tracker.totalBytes, 0);
      assert.strictEqual(tracker.byType.screenshots, 0);
    });

    it('should accumulate multiple buffers', () => {
      tracker.record('screenshots', Buffer.from('ab', 'utf-8'));
      tracker.record('screenshots', Buffer.from('cd', 'utf-8'));
      
      // 2 + 2 = 4 bytes
      assert.strictEqual(tracker.totalBytes, 4);
      assert.strictEqual(tracker.byType.screenshots, 4);
    });
  });

  describe('record() - Object handling', () => {
    it('should serialize and count object byte length', () => {
      const obj = { key: 'value' };
      const bytes = tracker.record('json', obj);
      
      // JSON.stringify({ key: 'value' }) = '{"key":"value"}' = 15 bytes
      const json = JSON.stringify(obj);
      const expectedBytes = Buffer.byteLength(json, 'utf-8');
      
      assert.strictEqual(bytes, expectedBytes);
      assert.strictEqual(tracker.totalBytes, expectedBytes);
      assert.strictEqual(tracker.byType.json, expectedBytes);
    });

    it('should handle nested objects', () => {
      const obj = { nested: { deep: { value: 'test' } } };
      const bytes = tracker.record('json', obj);
      
      const json = JSON.stringify(obj);
      const expectedBytes = Buffer.byteLength(json, 'utf-8');
      
      assert.strictEqual(bytes, expectedBytes);
      assert.strictEqual(tracker.totalBytes, expectedBytes);
    });

    it('should handle arrays', () => {
      const arr = ['a', 'b', 'c'];
      const bytes = tracker.record('json', arr);
      
      const json = JSON.stringify(arr);
      const expectedBytes = Buffer.byteLength(json, 'utf-8');
      
      assert.strictEqual(bytes, expectedBytes);
      assert.strictEqual(tracker.totalBytes, expectedBytes);
    });

    it('should handle objects with multi-byte characters', () => {
      const obj = { emoji: '🎉' };
      const bytes = tracker.record('json', obj);
      
      const json = JSON.stringify(obj);
      const expectedBytes = Buffer.byteLength(json, 'utf-8');
      
      assert.strictEqual(bytes, expectedBytes);
      assert.strictEqual(tracker.totalBytes, expectedBytes);
    });
  });

  describe('record() - Type normalization', () => {
    it('should normalize "screenshots" type', () => {
      tracker.record('screenshots', 'data');
      assert.strictEqual(tracker.byType.screenshots, 4);
    });

    it('should normalize "network" type', () => {
      tracker.record('network', 'data');
      assert.strictEqual(tracker.byType.network, 4);
    });

    it('should normalize "console" type', () => {
      tracker.record('console', 'data');
      assert.strictEqual(tracker.byType.console, 4);
    });

    it('should normalize "dom" type', () => {
      tracker.record('dom', 'data');
      assert.strictEqual(tracker.byType.dom, 4);
    });

    it('should normalize "json" type', () => {
      tracker.record('json', 'data');
      assert.strictEqual(tracker.byType.json, 4);
    });

    it('should map screenshot alias to screenshots', () => {
      tracker.record('screenshot', 'data');
      assert.strictEqual(tracker.byType.screenshots, 4);
    });

    it('should map request alias to network', () => {
      tracker.record('request', { url: 'test' });
      assert(tracker.byType.network > 0);
    });

    it('should map html alias to dom', () => {
      tracker.record('html', '<div>test</div>');
      assert.strictEqual(tracker.byType.dom, '<div>test</div>'.length);
    });

    it('should map unknown type to "other"', () => {
      tracker.record('unknown-type', 'data');
      assert.strictEqual(tracker.byType.other, 4);
    });

    it('should be case-insensitive for type names', () => {
      tracker.record('NETWORK', 'data');
      assert.strictEqual(tracker.byType.network, 4);
    });
  });

  describe('record() - Null/undefined handling', () => {
    it('should handle null values', () => {
      const bytes = tracker.record('json', null);
      assert.strictEqual(bytes, 0);
      assert.strictEqual(tracker.totalBytes, 0);
    });

    it('should handle undefined values', () => {
      const bytes = tracker.record('json', undefined);
      assert.strictEqual(bytes, 0);
      assert.strictEqual(tracker.totalBytes, 0);
    });

    it('should handle null type name', () => {
      const bytes = tracker.record(null, 'data');
      assert.strictEqual(bytes, 4);
      assert.strictEqual(tracker.byType.other, 4);
    });
  });

  describe('record() - Error handling (never throws)', () => {
    it('should not throw on circular reference', () => {
      const obj = { a: 1 };
      obj.self = obj; // Circular reference
      
      assert.doesNotThrow(() => {
        tracker.record('json', obj);
      });
    });

    it('should not throw on invalid JSON', () => {
      const error = new Error('test');
      assert.doesNotThrow(() => {
        tracker.record('json', error);
      });
    });

    it('should not throw on any value type', () => {
      assert.doesNotThrow(() => {
        tracker.record('other', 123); // number
        tracker.record('other', true); // boolean
        tracker.record('other', Symbol('test')); // symbol
      });
    });

    it('should return 0 on error', () => {
      const obj = { a: 1 };
      obj.self = obj;
      
      const bytes = tracker.record('json', obj);
      assert.strictEqual(bytes, 0);
    });
  });

  describe('Aggregation across multiple types', () => {
    it('should aggregate across all types', () => {
      tracker.record('screenshots', Buffer.from('abc'));
      tracker.record('network', { url: 'http://example.com' });
      tracker.record('console', 'error message');
      tracker.record('dom', '<html>test</html>');
      tracker.record('json', { data: 'value' });
      
      const stats = tracker.getStats();
      assert.strictEqual(stats.totalBytes, tracker.byType.screenshots + tracker.byType.network + tracker.byType.console + tracker.byType.dom + tracker.byType.json);
      assert(stats.totalBytes > 0);
    });

    it('should separate stats by type', () => {
      tracker.record('screenshots', 'data1');
      tracker.record('network', 'data2');
      tracker.record('console', 'data3');
      
      const stats = tracker.getStats();
      assert(stats.byType.screenshots > 0);
      assert(stats.byType.network > 0);
      assert(stats.byType.console > 0);
      assert.strictEqual(stats.byType.dom, 0);
      assert.strictEqual(stats.byType.json, 0);
      assert.strictEqual(stats.byType.other, 0);
    });
  });

  describe('getStats()', () => {
    it('should return object with totalBytes and byType', () => {
      tracker.record('network', 'test');
      const stats = tracker.getStats();
      
      assert(typeof stats === 'object');
      assert('totalBytes' in stats);
      assert('byType' in stats);
      assert(typeof stats.totalBytes === 'number');
      assert(typeof stats.byType === 'object');
    });

    it('should return a copy of byType', () => {
      tracker.record('network', 'test');
      const stats1 = tracker.getStats();
      const stats2 = tracker.getStats();
      
      // Modify returned copy
      stats1.byType.network = 999;
      
      // Original should not be affected
      assert.notStrictEqual(stats1.byType.network, stats2.byType.network);
    });

    it('should initialize all type counters to zero', () => {
      const stats = tracker.getStats();
      
      assert.strictEqual(stats.byType.screenshots, 0);
      assert.strictEqual(stats.byType.network, 0);
      assert.strictEqual(stats.byType.console, 0);
      assert.strictEqual(stats.byType.dom, 0);
      assert.strictEqual(stats.byType.json, 0);
      assert.strictEqual(stats.byType.other, 0);
    });

    it('should accurately reflect accumulated totals', () => {
      const bytes1 = tracker.record('network', 'hello');
      const bytes2 = tracker.record('network', 'world');
      
      const stats = tracker.getStats();
      assert.strictEqual(stats.totalBytes, bytes1 + bytes2);
      assert.strictEqual(stats.byType.network, bytes1 + bytes2);
    });
  });

  describe('Idempotency and safety', () => {
    it('should be safe to call record() many times', () => {
      for (let i = 0; i < 1000; i++) {
        assert.doesNotThrow(() => {
          tracker.record('json', `item-${i}`);
        });
      }
      
      assert(tracker.totalBytes > 0);
    });

    it('should accumulate correctly over many calls', () => {
      tracker.record('json', 'abc');
      tracker.record('json', 'def');
      tracker.record('json', 'ghi');
      
      // Each string: 3 bytes
      assert.strictEqual(tracker.totalBytes, 9);
    });
  });

  describe('Integration scenarios', () => {
    it('should track evidence from observation-like workflow', () => {
      // Simulate network event recording
      tracker.record('network', { url: 'http://example.com', status: 200, headers: {} });
      
      // Simulate console event recording
      tracker.record('console', { type: 'error', text: 'Something went wrong' });
      
      // Simulate evidence file recording
      tracker.record('screenshots', 'screenshot_data');
      
      // Simulate signals as JSON
      tracker.record('json', { navigationChanged: true, domChanged: false });
      
      const stats = tracker.getStats();
      
      // All types should have recorded data
      assert(stats.byType.network > 0);
      assert(stats.byType.console > 0);
      assert(stats.byType.screenshots > 0);
      assert(stats.byType.json > 0);
      
      // Total should be sum of all
      assert.strictEqual(
        stats.totalBytes,
        stats.byType.network + stats.byType.console + stats.byType.screenshots + stats.byType.json
      );
    });

    it('should never block or affect existing outputs', () => {
      // Even with many records, should not impact perf or throw
      for (let i = 0; i < 100; i++) {
        tracker.record('network', { id: i, data: 'x'.repeat(1000) });
      }
      
      assert(tracker.totalBytes > 0);
      const stats = tracker.getStats();
      assert.strictEqual(typeof stats.totalBytes, 'number');
      assert.strictEqual(typeof stats.byType, 'object');
    });
  });

  describe(' Contract guarantees', () => {
    it('should NEVER throw on any input', () => {
      const testCases = [
        ['network', { url: 'http://example.com' }],
        ['console', 'log message'],
        ['json', { nested: { deep: { value: null } } }],
        ['screenshots', Buffer.from('binary')],
        ['dom', '<div>HTML</div>'],
        [null, 'data'],
        ['unknown', undefined],
        [Symbol('test'), null],
      ];

      testCases.forEach(([type, value]) => {
        assert.doesNotThrow(() => {
          tracker.record(type, value);
        });
      });
    });

    it('should be read-only instrumentation only (no side effects)', () => {
      // Record should not modify input
      const obj = { name: 'test' };
      const objStringBefore = JSON.stringify(obj);
      
      tracker.record('json', obj);
      
      const objStringAfter = JSON.stringify(obj);
      assert.strictEqual(objStringBefore, objStringAfter);
    });

    it('should provide getStats() without side effects', () => {
      tracker.record('network', 'test');
      
      const stats1 = tracker.getStats();
      const stats2 = tracker.getStats();
      
      // Multiple calls should return same values
      assert.strictEqual(stats1.totalBytes, stats2.totalBytes);
      assert.strictEqual(stats1.byType.network, stats2.byType.network);
    });
  });
});




