import { strictEqual } from 'node:assert';
import { describe, it } from 'node:test';
import { getLatencyBucket } from '../src/cli/util/observation/outcome-watcher.js';

/**
 *  Outcome Watcher Unit Tests
 * Tests latency bucketing and signal detection logic
 */

describe('Outcome Watcher - Latency Bucketing', () => {
  it('should categorize 0-3s latency', () => {
    strictEqual(getLatencyBucket(0), '0-3s');
    strictEqual(getLatencyBucket(1500), '0-3s');
    strictEqual(getLatencyBucket(2999), '0-3s');
  });

  it('should categorize 3-6s latency', () => {
    strictEqual(getLatencyBucket(3000), '3-6s');
    strictEqual(getLatencyBucket(4500), '3-6s');
    strictEqual(getLatencyBucket(5999), '3-6s');
  });

  it('should categorize 6-10s latency', () => {
    strictEqual(getLatencyBucket(6000), '6-10s');
    strictEqual(getLatencyBucket(8000), '6-10s');
    strictEqual(getLatencyBucket(9999), '6-10s');
  });

  it('should categorize >10s latency', () => {
    strictEqual(getLatencyBucket(10000), '>10s');
    strictEqual(getLatencyBucket(15000), '>10s');
    strictEqual(getLatencyBucket(30000), '>10s');
  });
});

// Note: Integration tests for actual browser-based signal detection
// are in test/integration/delayed-outcome.integration.test.js
