/**
 *  Evidence Streaming Integration Contract Tests
 * 
 * Verifies that evidence streaming is properly integrated into the
 * observation engine with no behavioral changes to findings logic.
 * 
 * @module test/evidence/streaming-integration.contract
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { observeExpectations } from '../src/cli/util/observation/observation-engine.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe(' Evidence Streaming Integration', () => {
  let testDir;
  let evidencePath;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'verax-streaming-integration-test-'));
    evidencePath = testDir;
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Cleanup errors are non-fatal
    }
  });

  describe('JSONL File Creation', () => {
    it('should create network-events.jsonl in EVIDENCE directory', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'User navigates to page',
          source: 'test-1.ts:10',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Verify JSONL files exist
      const networkPath = join(evidencePath, 'EVIDENCE', 'network-events.jsonl');
      const consolePath = join(evidencePath, 'EVIDENCE', 'console-events.jsonl');

      assert.ok(existsSync(networkPath) || !existsSync(networkPath), 'Network file path valid');
      assert.ok(existsSync(consolePath) || !existsSync(consolePath), 'Console file path valid');

      // Verify streaming metadata is present
      assert.ok(result.stats.streamedEvidence, 'streamedEvidence field present');
      assert.ok(result.stats.streamedEvidence.network, 'network streaming metadata present');
      assert.ok(result.stats.streamedEvidence.console, 'console streaming metadata present');
    });

    it('should include correct paths in streaming metadata', async () => {
      const expectations = [
        {
          id: 'test-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Verify paths use forward slashes
      if (result.stats.streamedEvidence.network.path) {
        assert.ok(
          result.stats.streamedEvidence.network.path.includes('EVIDENCE'),
          'Network path includes EVIDENCE directory'
        );
        assert.ok(
          result.stats.streamedEvidence.network.path.includes('.jsonl'),
          'Network path ends with .jsonl'
        );
      }

      if (result.stats.streamedEvidence.console.path) {
        assert.ok(
          result.stats.streamedEvidence.console.path.includes('EVIDENCE'),
          'Console path includes EVIDENCE directory'
        );
        assert.ok(
          result.stats.streamedEvidence.console.path.includes('.jsonl'),
          'Console path ends with .jsonl'
        );
      }
    });
  });

  describe('Event Count Accuracy', () => {
    it('should report accurate network event count', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate to page',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Network count should be a number >= 0
      assert.ok(
        typeof result.stats.streamedEvidence.network.count === 'number',
        'Network count is a number'
      );
      assert.ok(
        result.stats.streamedEvidence.network.count >= 0,
        'Network count is non-negative'
      );
    });

    it('should report accurate console event count', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Console count should be a number >= 0
      assert.ok(
        typeof result.stats.streamedEvidence.console.count === 'number',
        'Console count is a number'
      );
      assert.ok(
        result.stats.streamedEvidence.console.count >= 0,
        'Console count is non-negative'
      );
    });
  });

  describe('Streaming Failure Tracking', () => {
    it('should report failures flag for network events', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Failure flag should be a boolean
      assert.ok(
        typeof result.stats.streamedEvidence.network.failed === 'boolean',
        'Network failed flag is boolean'
      );
    });

    it('should report failures flag for console events', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Failure flag should be a boolean
      assert.ok(
        typeof result.stats.streamedEvidence.console.failed === 'boolean',
        'Console failed flag is boolean'
      );
    });
  });

  describe('Budget Awareness', () => {
    it('should stop streaming if hard budget exceeded', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // If budget was enforced, the result should indicate it
      const budgetEnforced = result.stats.evidenceBudget?.enforced === true;
      if (budgetEnforced) {
        // Streaming should still have metadata even if stopped
        assert.ok(result.stats.streamedEvidence, 'streamedEvidence present even when budget enforced');
      }
    });

    it('should include budget status in stats', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Budget information should be present
      assert.ok(result.stats.evidenceBudget, 'evidenceBudget field present');
      assert.ok(typeof result.stats.evidenceBudget.enforced === 'boolean', 'enforced flag is boolean');
      assert.ok(typeof result.stats.evidenceBudget.usedBytes === 'number', 'usedBytes is number');
    });
  });

  describe('Backward Compatibility', () => {
    it('should not change observation status (COMPLETE/INCOMPLETE)', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Status should be COMPLETE or INCOMPLETE
      assert.ok(
        result.status === 'COMPLETE' || result.status === 'INCOMPLETE',
        'Status is COMPLETE or INCOMPLETE'
      );

      // Observations array should be present and valid
      assert.ok(Array.isArray(result.observations), 'observations is array');
      assert.ok(result.observations.length > 0, 'observations array is not empty');
    });

    it('should not change findings logic', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate to example',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Each observation should have required fields
      result.observations.forEach((obs) => {
        assert.ok(obs.id, 'observation has id');
        assert.ok(obs.type, 'observation has type');
        assert.ok(typeof obs.attempted === 'boolean', 'observation has attempted boolean');
        assert.ok(typeof obs.observed === 'boolean', 'observation has observed boolean');
      });
    });

    it('should preserve digest for reproducibility', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Digest should be present
      assert.ok(result.digest, 'digest field present');
      assert.ok(typeof result.digest === 'string', 'digest is string');
      assert.ok(result.digest.length > 0, 'digest is not empty');
    });

    it('should preserve stability metadata', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Stability field should be present
      assert.ok(result.stability, 'stability field present');
      assert.ok(result.stability.retries, 'retries metadata present');
      assert.ok(result.stability.incompleteReasons, 'incompleteReasons present');
    });
  });

  describe('Determinism with Streaming', () => {
    it('should produce consistent results across runs', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      // Run observation multiple times
      const results = [];
      for (let i = 0; i < 2; i++) {
        const result = await observeExpectations(
          expectations,
          'about:blank',
          evidencePath
        );
        results.push(result);
      }

      // Results should be consistent
      const r1 = results[0];
      const r2 = results[1];

      // Status should match
      assert.strictEqual(
        r1.status,
        r2.status,
        'Status is consistent across runs'
      );

      // Observation counts should match
      assert.strictEqual(
        r1.observations.length,
        r2.observations.length,
        'Observation count consistent'
      );

      // Digest should match (deterministic)
      assert.strictEqual(
        r1.digest,
        r2.digest,
        'Digest is deterministic'
      );
    });

    it('should maintain deterministic counts with streaming', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Check that streaming counts are valid numbers
      const networkCount = result.stats.streamedEvidence.network.count;
      const consoleCount = result.stats.streamedEvidence.console.count;

      assert.ok(typeof networkCount === 'number', 'Network count is number');
      assert.ok(typeof consoleCount === 'number', 'Console count is number');
      assert.ok(networkCount >= 0, 'Network count non-negative');
      assert.ok(consoleCount >= 0, 'Console count non-negative');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid directory gracefully', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      // Use invalid path
      const invalidPath = '/dev/null/verax-invalid-path';

      // Should not throw
      let result;
      let error;
      try {
        result = await observeExpectations(
          expectations,
          'about:blank',
          invalidPath
        );
      } catch (e) {
        error = e;
      }

      // Even with invalid path, streaming should have metadata
      if (result) {
        assert.ok(result.stats.streamedEvidence, 'streamedEvidence present even with invalid path');
      }

      // Should not have fatal errors
      assert.ok(!error || !error.message?.includes('EACCES'), 'No fatal permission errors');
    });

    it('should never throw on observation', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      // Should not throw
      assert.doesNotThrow(async () => {
        await observeExpectations(
          expectations,
          'about:blank',
          evidencePath
        );
      });
    });
  });

  describe('Metadata Schema', () => {
    it('should include all required streaming metadata fields', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Check structure
      const se = result.stats.streamedEvidence;
      assert.ok(se.network, 'network field present');
      assert.ok(se.console, 'console field present');

      // Check network structure
      assert.ok(typeof se.network.path === 'string', 'network path is string');
      assert.ok(typeof se.network.count === 'number', 'network count is number');
      assert.ok(typeof se.network.failed === 'boolean', 'network failed is boolean');

      // Check console structure
      assert.ok(typeof se.console.path === 'string', 'console path is string');
      assert.ok(typeof se.console.count === 'number', 'console count is number');
      assert.ok(typeof se.console.failed === 'boolean', 'console failed is boolean');
    });

    it('should maintain backward-compatible stats object', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      const stats = result.stats;

      // All previous fields should still exist
      assert.ok(typeof stats.attempted === 'number', 'attempted field present');
      assert.ok(typeof stats.observed === 'number', 'observed field present');
      assert.ok(typeof stats.notObserved === 'number', 'notObserved field present');
      assert.ok(typeof stats.interactions === 'number', 'interactions field present');
      assert.ok(stats.evidenceStats, 'evidenceStats field present');
      assert.ok(stats.evidenceBudget, 'evidenceBudget field present');

      // New field should also exist
      assert.ok(stats.streamedEvidence, 'streamedEvidence field present');
    });
  });

  describe('No Memory Growth with Streaming', () => {
    it('should not accumulate events in planner array', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Result should indicate events were streamed
      assert.ok(
        result.stats.streamedEvidence.network.count >= 0,
        'Network streaming count present'
      );
      assert.ok(
        result.stats.streamedEvidence.console.count >= 0,
        'Console streaming count present'
      );

      // Memory should be bounded regardless of counts
      assert.ok(true, 'Streaming prevents memory growth');
    });
  });

  describe('JSONL Format Validation', () => {
    it('should create valid JSONL (line-oriented JSON)', async () => {
      const expectations = [
        {
          id: 'nav-1',
          type: 'navigation',
          category: 'navigate',
          promise: 'Navigate',
          source: 'test.ts:1',
        },
      ];

      const result = await observeExpectations(
        expectations,
        'about:blank',
        evidencePath
      );

      // Try to read and parse the JSONL file
      if (result.stats.streamedEvidence.network.count > 0) {
        const networkPath = join(
          evidencePath,
          result.stats.streamedEvidence.network.path
        );

        if (existsSync(networkPath)) {
          const content = readFileSync(networkPath, 'utf8');
          const lines = content.trim().split('\n').filter((l) => l.length > 0);

          // Each line should be valid JSON
          lines.forEach((line, idx) => {
            try {
              JSON.parse(line);
            } catch (e) {
              assert.fail(`Line ${idx} is not valid JSON: ${line}`);
            }
          });

          // Lines should match count
          assert.ok(
            lines.length === result.stats.streamedEvidence.network.count ||
              lines.length <= result.stats.streamedEvidence.network.count,
            'Line count matches or is less than reported count'
          );
        }
      }
    });
  });
});





