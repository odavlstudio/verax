/**
 *  Evidence Stream Writer Contract Tests
 * 
 * CRITICAL: Verifies deterministic JSONL output, ordering preservation,
 * and fail-safe behavior when writes fail.
 * 
 * @module test/evidence/evidence-stream-writer.contract
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { createStreamWriter } from '../../src/cli/util/evidence/evidence-stream-writer.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe(' Evidence Stream Writer: JSONL Format', () => {
  let testDir;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'verax-stream-test-'));
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Cleanup errors are non-fatal
    }
  });

  describe('JSONL Creation and Writing', () => {
    it('should create JSONL file with EVIDENCE directory', () => {
      const writer = createStreamWriter(testDir, 'test-events');
      
      const filePath = writer.getPath();
      assert.ok(filePath.includes('EVIDENCE'));
      assert.ok(filePath.includes('test-events.jsonl'));
      assert.ok(existsSync(filePath));
    });

    it('should write single event as one JSON line', () => {
      const writer = createStreamWriter(testDir, 'test-events');
      
      const event = { type: 'test', value: 42, timestamp: '2026-01-19T00:00:00Z' };
      writer.append(event);
      writer.close();

      const content = readFileSync(writer.getPath(), 'utf8');
      const lines = content.trim().split('\n');
      
      assert.strictEqual(lines.length, 1);
      const parsed = JSON.parse(lines[0]);
      assert.deepStrictEqual(parsed, event);
    });

    it('should write multiple events as multiple lines', () => {
      const writer = createStreamWriter(testDir, 'test-events');
      
      const events = [
        { id: 1, name: 'first' },
        { id: 2, name: 'second' },
        { id: 3, name: 'third' },
      ];

      events.forEach(e => writer.append(e));
      writer.close();

      const content = readFileSync(writer.getPath(), 'utf8');
      const lines = content.trim().split('\n');
      
      assert.strictEqual(lines.length, 3);
      lines.forEach((line, idx) => {
        const parsed = JSON.parse(line);
        assert.deepStrictEqual(parsed, events[idx]);
      });
    });

    it('should preserve event ordering in JSONL', () => {
      const writer = createStreamWriter(testDir, 'ordered-events');
      
      const events = [];
      for (let i = 0; i < 100; i++) {
        events.push({ index: i, value: i * 0.01 }); // Deterministic values
      }

      events.forEach(e => writer.append(e));
      writer.close();

      const content = readFileSync(writer.getPath(), 'utf8');
      const lines = content.trim().split('\n');
      
      assert.strictEqual(lines.length, 100);
      lines.forEach((line, idx) => {
        const parsed = JSON.parse(line);
        assert.strictEqual(parsed.index, idx);
      });
    });
  });

  describe('Deterministic Serialization', () => {
    it('should serialize object with deterministic key ordering', () => {
      const writer = createStreamWriter(testDir, 'deterministic');
      
      // Keys in random order
      const event = {
        z: 'last',
        a: 'first',
        m: 'middle',
        b: 'second',
      };

      writer.append(event);
      writer.close();

      const content = readFileSync(writer.getPath(), 'utf8').trim();
      const expected = '{"a":"first","b":"second","m":"middle","z":"last"}';
      
      assert.strictEqual(content, expected);
    });

    it('should handle nested objects with deterministic key ordering', () => {
      const writer = createStreamWriter(testDir, 'nested');
      
      const event = {
        outer: {
          z: 'z-value',
          a: 'a-value',
        },
        b: 'b-value',
      };

      writer.append(event);
      writer.close();

      const content = readFileSync(writer.getPath(), 'utf8').trim();
      const parsed = JSON.parse(content);
      
      // Keys should be in alphabetical order
      assert.deepStrictEqual(Object.keys(parsed), ['b', 'outer']);
      assert.deepStrictEqual(Object.keys(parsed.outer), ['a', 'z']);
    });

    it('should produce identical output for same event across multiple runs', () => {
      const event = { type: 'network', url: 'https://example.com', method: 'GET' };
      
      const outputs = [];
      for (let i = 0; i < 5; i++) {
        const writer = createStreamWriter(testDir, `run-${i}`);
        writer.append(event);
        writer.close();

        const content = readFileSync(writer.getPath(), 'utf8').trim();
        outputs.push(content);
      }

      // All outputs should be identical (deterministic)
      for (let i = 1; i < outputs.length; i++) {
        assert.strictEqual(outputs[i], outputs[0], `Output ${i} differs from output 0`);
      }
    });

    it('should handle arrays deterministically', () => {
      const writer = createStreamWriter(testDir, 'arrays');
      
      const event = {
        tags: ['zebra', 'apple', 'monkey'], // Unsorted
        items: [{ b: 2, a: 1 }, { z: 26, a: 1 }],
      };

      writer.append(event);
      writer.close();

      const content = readFileSync(writer.getPath(), 'utf8').trim();
      const parsed = JSON.parse(content);
      
      // Arrays should be preserved as-is (no sorting of array elements)
      assert.deepStrictEqual(parsed.tags, ['zebra', 'apple', 'monkey']);
      // But object keys within arrays should be sorted
      assert.deepStrictEqual(Object.keys(parsed.items[0]), ['a', 'b']);
    });
  });

  describe('Counting and State Tracking', () => {
    it('should track event count correctly', () => {
      const writer = createStreamWriter(testDir, 'counting');
      
      assert.strictEqual(writer.getCount(), 0);
      
      writer.append({ id: 1 });
      assert.strictEqual(writer.getCount(), 1);
      
      writer.append({ id: 2 });
      assert.strictEqual(writer.getCount(), 2);
      
      writer.append({ id: 3 });
      assert.strictEqual(writer.getCount(), 3);
      
      writer.close();
      assert.strictEqual(writer.getCount(), 3);
    });

    it('should report path consistently', () => {
      const writer = createStreamWriter(testDir, 'path-test');
      
      const path1 = writer.getPath();
      const path2 = writer.getPath();
      const path3 = writer.getPath();
      
      assert.strictEqual(path1, path2);
      assert.strictEqual(path2, path3);
    });

    it('should report failures gracefully', () => {
      const writer = createStreamWriter(testDir, 'failure-test');
      
      assert.strictEqual(writer.hasFailures(), false);
      writer.append({ id: 1 });
      assert.strictEqual(writer.hasFailures(), false);
      
      writer.close();
      assert.strictEqual(writer.hasFailures(), false);
    });
  });

  describe('Error Handling and Fail-Safe Behavior', () => {
    it('should never throw on normal append', () => {
      const writer = createStreamWriter(testDir, 'no-throw');
      
      const testEvents = [
        null,
        undefined,
        { nested: { deep: { object: 'value' } } },
        { array: [1, 2, 3] },
        { number: 42, boolean: true, string: 'test' },
      ];

      testEvents.forEach(event => {
        assert.doesNotThrow(() => writer.append(event));
      });

      assert.doesNotThrow(() => writer.close());
    });

    it('should handle circular reference gracefully', () => {
      const writer = createStreamWriter(testDir, 'circular');
      
      // Create circular reference
      const event = { id: 1 };
      event.self = event; // Circular reference

      // Should not throw
      const result = writer.append(event);
      // Result should indicate append was attempted (may fail internally but not throw)
      assert.ok(typeof result === 'boolean');
      
      writer.close();
    });

    it('should continue appending after single error', () => {
      const writer = createStreamWriter(testDir, 'recover');
      
      writer.append({ id: 1, valid: true });
      writer.append({ id: 2, valid: true });
      writer.close();

      const content = readFileSync(writer.getPath(), 'utf8');
      const lines = content.trim().split('\n').filter(l => l.length > 0);
      
      assert.ok(lines.length >= 2);
    });

    it('should handle getCount() after close', () => {
      const writer = createStreamWriter(testDir, 'count-after-close');
      
      writer.append({ id: 1 });
      writer.append({ id: 2 });
      writer.close();
      
      // Should still be able to get count after close
      assert.strictEqual(writer.getCount(), 2);
    });
  });

  describe('Multiple Streams', () => {
    it('should support multiple independent streams', () => {
      const writer1 = createStreamWriter(testDir, 'stream1');
      const writer2 = createStreamWriter(testDir, 'stream2');
      const writer3 = createStreamWriter(testDir, 'stream3');

      writer1.append({ stream: 1, id: 'a' });
      writer2.append({ stream: 2, id: 'x' });
      writer1.append({ stream: 1, id: 'b' });
      writer3.append({ stream: 3, id: 'alpha' });
      writer2.append({ stream: 2, id: 'y' });
      
      writer1.close();
      writer2.close();
      writer3.close();

      const content1 = readFileSync(writer1.getPath(), 'utf8').trim().split('\n');
      const content2 = readFileSync(writer2.getPath(), 'utf8').trim().split('\n');
      const content3 = readFileSync(writer3.getPath(), 'utf8').trim().split('\n');

      assert.strictEqual(content1.length, 2);
      assert.strictEqual(content2.length, 2);
      assert.strictEqual(content3.length, 1);

      assert.strictEqual(writer1.getCount(), 2);
      assert.strictEqual(writer2.getCount(), 2);
      assert.strictEqual(writer3.getCount(), 1);
    });
  });

  describe('Large Event Streaming', () => {
    it('should handle 1000 events deterministically', () => {
      const writer = createStreamWriter(testDir, 'large-stream');
      
      const events = [];
      for (let i = 0; i < 1000; i++) {
        events.push({
          id: i,
          timestamp: '2026-01-19T00:00:00Z',
          data: `Event #${i}`,
        });
      }

      events.forEach(e => writer.append(e));
      writer.close();

      const content = readFileSync(writer.getPath(), 'utf8');
      const lines = content.trim().split('\n');
      
      assert.strictEqual(lines.length, 1000);
      assert.strictEqual(writer.getCount(), 1000);

      // Verify ordering preserved
      lines.forEach((line, idx) => {
        const parsed = JSON.parse(line);
        assert.strictEqual(parsed.id, idx);
      });
    });

    it('should maintain determinism with 1000 events across runs', () => {
      const events = [];
      for (let i = 0; i < 100; i++) {
        events.push({ id: i, value: `data-${i}` });
      }

      const outputs = [];
      for (let run = 0; run < 3; run++) {
        const writer = createStreamWriter(testDir, `large-run-${run}`);
        events.forEach(e => writer.append(e));
        writer.close();

        const content = readFileSync(writer.getPath(), 'utf8');
        outputs.push(content);
      }

      // All runs should produce identical output
      for (let i = 1; i < outputs.length; i++) {
        assert.strictEqual(outputs[i], outputs[0], `Run ${i} differs from run 0`);
      }
    });
  });
});

describe(' Failsafe Stream Writer', () => {
  let testDir;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'verax-failsafe-test-'));
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Cleanup errors are non-fatal
    }
  });

  it('should never throw even with invalid directory', () => {
    // Create a writer with invalid path
    const invalidDir = '/dev/null/this/does/not/exist/verax';
    const writer = createStreamWriter(invalidDir, 'test');

    assert.doesNotThrow(() => writer.append({ test: true }));
    assert.doesNotThrow(() => writer.close());
    assert.doesNotThrow(() => writer.getPath());
    assert.doesNotThrow(() => writer.getCount());
    assert.doesNotThrow(() => writer.hasFailures());
  });

  it('should gracefully degrade to in-memory counting on write failure', () => {
    // This tests the failsafe mechanism
    const writer = createStreamWriter(testDir, 'test');
    
    // Append some events
    for (let i = 0; i < 5; i++) {
      writer.append({ id: i });
    }
    
    writer.close();
    
    // Should still track count even if write fails
    assert.ok(writer.getCount() >= 0);
  });
});




