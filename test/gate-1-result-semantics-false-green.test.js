/**
 * GATE 1: Result Semantics Integrity  
 *
 * Test: INCOMPLETE must never be misreported as SUCCESS
 *
 * Vision Contract (Section 6):
 * "An INCOMPLETE result must NEVER be interpreted as safe."
 *
 * Bug scenario: When budget is exceeded (coverage capped) but zero findings exist,
 * the system must NOT exit with code 0 (SUCCESS).
 * It MUST exit with code 30 (INCOMPLETE).
 *
 * This test verifies the gate is locked in place.
 */

import assert from 'assert';
import test from 'node:test';
import { classifyRunTruth } from '../src/verax/core/truth-classifier.js';

test('Gate 1: Result Semantics - False Green Prevention', async (t) => {
  /**
   * Scenario: Budget hit, coverage capped, but zero findings detected.
   *
   * Expected: INCOMPLETE (exit code 30)
   * False green (bug): SUCCESS (exit code 0)
   *
   * The fix: Pass isIncomplete=true when coverage is below threshold,
   * forcing truthState to INCOMPLETE regardless of findings count.
   */

  await t.test(
    'Coverage below threshold + zero findings MUST return INCOMPLETE (not SUCCESS)',
    () => {
      // Setup: 50 interactions discovered, but only 10 tested (budget capped)
      const input = {
        expectationsTotal: 50,          // Total discovered
        attempted: 10,                   // Actually attempted
        observed: 10,                    // Successfully observed
        silentFailures: 0,               // ← NO FINDINGS (would normally = SUCCESS)
        coverageRatio: 10 / 50,          // 20% (far below 90% threshold)
        hasInfraFailure: false,
        isIncomplete: true,              // ← KEY: Set to true because coverage < threshold
        incompleteReasons: ['coverage_below_threshold'],
      };

      const result = classifyRunTruth(input, { minCoverage: 0.90 });

      assert.strictEqual(
        result.truthState,
        'INCOMPLETE',
        'Coverage 20% < 90% threshold MUST produce INCOMPLETE, not SUCCESS'
      );

      assert(
        result.whatThisMeans.includes('MUST NOT BE TREATED AS SAFE'),
        'INCOMPLETE must include safety warning'
      );
    }
  );

  await t.test(
    'At threshold: 90% coverage + zero findings => SUCCESS',
    () => {
      const input = {
        expectationsTotal: 100,
        attempted: 90,
        observed: 90,
        silentFailures: 0,
        coverageRatio: 0.90,             // Exactly at 90% threshold
        hasInfraFailure: false,
        isIncomplete: false,             // Not below threshold
        incompleteReasons: [],
      };

      const result = classifyRunTruth(input, { minCoverage: 0.90 });

      assert.strictEqual(
        result.truthState,
        'SUCCESS',
        'At 90% threshold with zero findings should be SUCCESS'
      );

      assert.strictEqual(
        result.confidence,
        'HIGH',
        'Threshold met should have HIGH confidence'
      );
    }
  );

  await t.test(
    'Below threshold by 1%: 89% coverage + zero findings => INCOMPLETE',
    () => {
      const input = {
        expectationsTotal: 100,
        attempted: 89,
        observed: 89,
        silentFailures: 0,
        coverageRatio: 0.89,             // 1% below threshold
        hasInfraFailure: false,
        isIncomplete: true,              // Below threshold
        incompleteReasons: ['coverage_below_threshold'],
      };

      const result = classifyRunTruth(input, { minCoverage: 0.90 });

      assert.strictEqual(
        result.truthState,
        'INCOMPLETE',
        '89% coverage must be INCOMPLETE, not SUCCESS'
      );

      assert.strictEqual(
        result.confidence,
        'MEDIUM',
        'Partial coverage should have MEDIUM confidence'
      );
    }
  );

  await t.test(
    'Budget exceeded flag forces INCOMPLETE even if coverage would pass',
    () => {
      const input = {
        expectationsTotal: 20,
        attempted: 20,                   // Full attempt
        observed: 20,                    // Full observation
        silentFailures: 0,               // No failures
        coverageRatio: 1.0,              // 100% coverage (would normally = SUCCESS)
        hasInfraFailure: false,
        isIncomplete: true,              // ← Set due to budgetExceeded flag
        incompleteReasons: ['budget_exceeded'],
      };

      const result = classifyRunTruth(input, { minCoverage: 0.90 });

      assert.strictEqual(
        result.truthState,
        'INCOMPLETE',
        'Budget exceeded MUST override coverage and force INCOMPLETE'
      );

      assert(
        result.reason.includes('budget'),
        'Reason must explain budget was exceeded'
      );
    }
  );

  await t.test(
    'Empty site (0 expectations) => SUCCESS (safe edge case)',
    () => {
      const input = {
        expectationsTotal: 0,            // Empty site
        attempted: 0,
        observed: 0,
        silentFailures: 0,
        coverageRatio: 1.0,              // NaN or 1.0 for empty
        hasInfraFailure: false,
        isIncomplete: false,
        incompleteReasons: [],
      };

      const result = classifyRunTruth(input, { minCoverage: 0.90 });

      assert.strictEqual(
        result.truthState,
        'SUCCESS',
        'Empty site is safe to report as SUCCESS'
      );
    }
  );

  await t.test(
    'Findings present => FINDINGS (even if coverage low)',
    () => {
      const input = {
        expectationsTotal: 50,
        attempted: 10,
        observed: 10,
        silentFailures: 3,               // ← FINDINGS present
        coverageRatio: 0.20,             // Low coverage
        hasInfraFailure: false,
        isIncomplete: true,
        incompleteReasons: ['coverage_below_threshold'],
      };

      const result = classifyRunTruth(input, { minCoverage: 0.90 });

      assert.strictEqual(
        result.truthState,
        'FINDINGS',
        'FINDINGS take precedence—report actionable bugs'
      );

      assert.strictEqual(
        result.confidence,
        'HIGH',
        'Findings have HIGH confidence'
      );
    }
  );

  await t.test(
    'Infrastructure failure => INCOMPLETE (not SUCCESS)',
    () => {
      const input = {
        expectationsTotal: 25,
        attempted: 25,
        observed: 25,
        silentFailures: 0,
        coverageRatio: 1.0,              // 100% coverage (would normally = SUCCESS)
        hasInfraFailure: true,           // ← Browser crash or artifact failure
        isIncomplete: true,
        incompleteReasons: ['infra_failure'],
      };

      const result = classifyRunTruth(input, { minCoverage: 0.90 });

      assert.strictEqual(
        result.truthState,
        'INCOMPLETE',
        'Infrastructure failure must be INCOMPLETE'
      );

      assert.strictEqual(
        result.confidence,
        'LOW',
        'Infrastructure issues reduce confidence'
      );
    }
  );
});
