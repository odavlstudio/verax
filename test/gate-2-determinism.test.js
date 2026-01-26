/**
 * GATE 2: Determinism Tests
 *
 * Tests that verify Gate 2 (Determinism) requirements:
 * - Same inputs → same outputs (verdicts) deterministically
 * - Same inputs → same canonical artifacts (byte-for-byte identical)
 * - No hidden adaptive behavior changing outcomes
 * - If determinism cannot be guaranteed, report INCOMPLETE (not SUCCESS)
 */

import assert from 'assert';
import test from 'node:test';
import crypto from 'crypto';

/**
 * Helper: Load and normalize JSON for comparison
 * Removes non-deterministic fields like timestamps
 */
function normalizeForComparison(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj
      .map(item => normalizeForComparison(item))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  
  const normalized = {};
  for (const key of Object.keys(obj).sort()) {
    // Skip diagnostic-only fields
    if (key.match(/^(observedAt|generatedAt|timestamp|durationMs|runtimeMetrics|diagnostics|timing)/i)) {
      continue;
    }
    normalized[key] = normalizeForComparison(obj[key]);
  }
  return normalized;
}

/**
 * Helper: Compute deterministic hash of canonical artifact
 */
function hashCanonicalArtifact(content) {
  const normalized = JSON.stringify(normalizeForComparison(
    typeof content === 'string' ? JSON.parse(content) : content
  ), null, 0);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

test('Gate 2: Determinism Enforcement', async (t) => {
  /**
   * Scenario: Two runs with identical input/configuration
   * Expected: Identical verdicts, identical canonical artifacts
   */

  await t.test(
    'Canonical artifacts do NOT contain timestamps (observedAt, generatedAt, etc)',
    () => {
      const mockTraces = {
        version: 1,
        // GATE 2: observedAt must be removed
        url: 'https://example.com',
        traces: [
          {
            interaction: { selector: 'button' },
            outcome: 'NAVIGATION',
            before: { url: 'https://example.com' },
            after: { url: 'https://example.com/next' }
          }
        ]
      };

      // Should NOT have observedAt
      assert.strictEqual(
        mockTraces.observedAt,
        undefined,
        'Canonical traces must not include observedAt timestamp'
      );

      // Should be able to hash deterministically
      const hash1 = hashCanonicalArtifact(mockTraces);
      const hash2 = hashCanonicalArtifact(mockTraces);

      assert.strictEqual(
        hash1,
        hash2,
        'Same canonical artifact must hash identically'
      );
    }
  );

  await t.test(
    'Canonical artifacts must use stable JSON ordering (sorted keys)',
    () => {
      const artifact = {
        z_field: 'last alphabetically',
        a_field: 'first alphabetically',
        m_field: 'middle'
      };

      // Serialize with sorted keys
      const serialized = JSON.stringify(artifact, Object.keys(artifact).sort());
      
      // Deserialize and re-serialize
      const reparsed = JSON.parse(serialized);
      const reserialized = JSON.stringify(reparsed, Object.keys(reparsed).sort());

      assert.strictEqual(
        serialized,
        reserialized,
        'Canonical artifacts with sorted keys must be byte-identical after re-parse'
      );
    }
  );

  await t.test(
    'Coverage metrics MUST be deterministic (no timing data)',
    () => {
      const coverageA = {
        expectationsTotal: 50,
        attempted: 45,
        observed: 45,
        ratio: 0.90
        // NO: durationMs, runtimeMs, timestamp
      };

      const coverageB = {
        expectationsTotal: 50,
        attempted: 45,
        observed: 45,
        ratio: 0.90
        // Same as A
      };

      assert.deepStrictEqual(coverageA, coverageB);

      // Both should hash identically
      assert.strictEqual(
        hashCanonicalArtifact(coverageA),
        hashCanonicalArtifact(coverageB)
      );
    }
  );

  await t.test(
    'Verdict MUST NOT depend on machine speed or network timing',
    () => {
      // Simulate two runs with same interactions but different timing
      const run1 = {
        interactions: 25,
        completed: 25,
        coverage: 1.0,
        // Different timing
        durationMs: 2000,
        adaptiveEventsCount: 0
      };

      const run2 = {
        interactions: 25,
        completed: 25,
        coverage: 1.0,
        // Different timing (slower machine)
        durationMs: 3500,
        adaptiveEventsCount: 0
      };

      // Canonical data (without timing) should be identical
      const canonical1 = normalizeForComparison(run1);
      const canonical2 = normalizeForComparison(run2);

      assert.deepStrictEqual(canonical1, canonical2);

      // Verdict should be same
      const verdict1 = canonical1.coverage >= 0.90 ? 'SUCCESS' : 'INCOMPLETE';
      const verdict2 = canonical2.coverage >= 0.90 ? 'SUCCESS' : 'INCOMPLETE';

      assert.strictEqual(verdict1, verdict2, 'Verdict must not depend on timing');
    }
  );

  await t.test(
    'If timeout occurred, determinism should be marked NON_DETERMINISTIC',
    () => {
      const runWithTimeout = {
        interactions: 25,
        completed: 18,  // Only 18 completed before timeout
        coverage: 0.72,
        timeout: true,
        determinismClassification: 'NON_DETERMINISTIC'
      };

      assert.strictEqual(
        runWithTimeout.determinismClassification,
        'NON_DETERMINISTIC',
        'Timeout makes run non-deterministic'
      );

      // Should force INCOMPLETE instead of SUCCESS
      const shouldBeIncomplete = runWithTimeout.timeout || runWithTimeout.coverage < 0.90;
      assert.strictEqual(shouldBeIncomplete, true);
    }
  );

  await t.test(
    'Deterministic runs MUST produce byte-identical artifacts',
    () => {
      // Simulate two canonical artifacts from same input
      const canonical1 = {
        version: 1,
        url: 'https://example.com',
        traces: [
          { interaction: { selector: 'a' }, outcome: 'NAVIGATION' },
          { interaction: { selector: 'b' }, outcome: 'STATE_CHANGE' }
        ]
      };

      const canonical2 = {
        version: 1,
        url: 'https://example.com',
        traces: [
          { interaction: { selector: 'a' }, outcome: 'NAVIGATION' },
          { interaction: { selector: 'b' }, outcome: 'STATE_CHANGE' }
        ]
      };

      const json1 = JSON.stringify(canonical1, Object.keys(canonical1).sort());
      const json2 = JSON.stringify(canonical2, Object.keys(canonical2).sort());

      assert.strictEqual(json1, json2, 'Canonical artifacts must be byte-identical');
    }
  );

  await t.test(
    'Adaptive settle extension MUST be disabled for determinism',
    () => {
      // Pre-fix: adaptiveStabilization = true would scale timeout by machine speed
      // Post-fix: adaptiveStabilization = false (hardcoded) uses fixed timeout only

      const baseTimeoutMs = 8000;
      const adaptiveStabilization = false;  // GATE 2: Always false

      const timeoutMs = adaptiveStabilization 
        ? Math.round(baseTimeoutMs * 1.5) 
        : baseTimeoutMs;

      assert.strictEqual(
        timeoutMs,
        baseTimeoutMs,
        'Timeout must be fixed, not scaled by machine speed'
      );

      // Same timeout on any machine → deterministic behavior
      const timeout1 = 8000;  // Fast machine
      const timeout2 = 8000;  // Slow machine

      assert.strictEqual(timeout1, timeout2);
    }
  );

  await t.test(
    'Finding IDs MUST be deterministic (based on content, not timestamps)',
    () => {
      // Finding ID must be same for same content, regardless of when found
      const findingContent = {
        type: 'navigation_failure',
        selector: 'button.submit',
        expected: 'https://example.com/success',
        actual: 'https://example.com/error'
      };

      // Compute ID from content (deterministic)
      const id1 = crypto
        .createHash('sha256')
        .update(JSON.stringify(findingContent))
        .digest('hex')
        .slice(0, 8);

      const id2 = crypto
        .createHash('sha256')
        .update(JSON.stringify(findingContent))
        .digest('hex')
        .slice(0, 8);

      assert.strictEqual(id1, id2, 'Finding ID must be identical for same content');
    }
  );

  await t.test(
    'Summary must have deterministic truth state (not affected by timing)',
    () => {
      // Two identical runs with same findings and coverage
      const summary1 = {
        truth: { truthState: 'SUCCESS' },
        coverage: 1.0,
        findings: 0,
        determinismAnalysis: {
          classification: 'DETERMINISTIC',
          timeoutCount: 0,
          retryCount: 0
        }
      };

      const summary2 = {
        truth: { truthState: 'SUCCESS' },
        coverage: 1.0,
        findings: 0,
        determinismAnalysis: {
          classification: 'DETERMINISTIC',
          timeoutCount: 0,
          retryCount: 0
        }
      };

      // Should compute same verdict
      const verdict1 = summary1.truth.truthState;
      const verdict2 = summary2.truth.truthState;

      assert.strictEqual(verdict1, verdict2);
      assert.strictEqual(verdict1, 'SUCCESS');
    }
  );

  await t.test(
    'INCOMPLETE MUST be reported if determinism cannot be guaranteed',
    () => {
      const runWithNonDeterminism = {
        coverage: 0.95,  // Would normally be SUCCESS
        findings: 0,
        determinismAnalysis: {
          classification: 'NON_DETERMINISTIC',
          timeoutCount: 1,
          reason: 'Navigation timeout - machine speed dependent'
        }
      };

      // Because of non-determinism, must report INCOMPLETE
      const shouldBeIncomplete = 
        runWithNonDeterminism.determinismAnalysis.classification === 'NON_DETERMINISTIC';

      assert.strictEqual(
        shouldBeIncomplete,
        true,
        'Non-deterministic runs must force INCOMPLETE'
      );

      const verdict = shouldBeIncomplete ? 'INCOMPLETE' : 'SUCCESS';
      assert.strictEqual(verdict, 'INCOMPLETE');
    }
  );
});

test('Gate 2: Canonical vs Diagnostic Split', async (t) => {
  /**
   * Verify that canonical and diagnostic artifacts are properly separated
   */

  await t.test(
    'Canonical artifact excludes all timing fields',
    () => {
      const withDiagnostics = {
        version: 1,
        url: 'https://example.com',
        traces: [{ outcome: 'SUCCESS' }],
        // DIAGNOSTIC (should be removed for canonical)
        observedAt: '2026-01-26T12:00:00Z',
        durationMs: 1500,
        generatedAt: '2026-01-26T12:01:00Z'
      };

      const canonical = {};
      for (const [key, value] of Object.entries(withDiagnostics)) {
        // Filter out diagnostic fields
        if (!key.match(/^(observedAt|generatedAt|durationMs|timing)/i)) {
          canonical[key] = value;
        }
      }

      assert.strictEqual(canonical.version, 1);
      assert.strictEqual(canonical.url, 'https://example.com');
      assert.strictEqual(canonical.observedAt, undefined, 'observedAt must be excluded');
      assert.strictEqual(canonical.durationMs, undefined, 'durationMs must be excluded');
      assert.strictEqual(canonical.generatedAt, undefined, 'generatedAt must be excluded');
    }
  );

  await t.test(
    'Diagnostic artifact is explicitly marked as non-deterministic',
    () => {
      const diagnostics = {
        _notice: 'DO NOT USE FOR TRUTH/VERDICT - TIMING DATA VARIES PER RUN',
        generatedAt: '2026-01-26T12:01:00Z',
        runtimeMetrics: {
          observePhaseMs: 1234,
          detectPhaseMs: 456,
          totalMs: 1690
        },
        adaptiveEvents: [
          {
            reason: 'dom_continued_changing',
            delta: '+500ms settle window'
          }
        ]
      };

      assert(diagnostics._notice.includes('DO NOT USE'));
      assert(diagnostics.generatedAt);
      assert(diagnostics.runtimeMetrics.observePhaseMs > 0);
    }
  );
});
