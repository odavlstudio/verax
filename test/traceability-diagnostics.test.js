/**
 * PHASE 4 TESTS: Traceability-First Diagnostics
 * 
 * Tests that diagnostic information is captured for every attempted expectation,
 * providing transparent troubleshooting without opaque "action-failed" messages.
 * 
 * Contract: Every expectation attempt gets a deterministic diagnostic record
 * including phaseOutcome, evidenceSignals, and shortReason.
 */

import assert from 'assert';
import test from 'node:test';
import { DiagnosticsCollector, attemptToDiagnostic, PHASE_OUTCOMES } from '../src/cli/util/observation/diagnostics-collector.js';

test('DiagnosticsCollector', async (suite) => {
  await suite.test('should initialize empty', () => {
    const collector = new DiagnosticsCollector();
    assert.deepStrictEqual(collector.getAll(), []);
  });

  await suite.test('should record diagnostic entry', () => {
    const collector = new DiagnosticsCollector();
    const entry = {
      expectationId: 'nav-1',
      kind: 'navigate',
      sourceRef: { file: 'app.jsx', line: 5 },
      selector: 'a[href="/about"]',
      phaseOutcome: PHASE_OUTCOMES.SUCCESS,
      evidenceSignals: { urlChanged: true, domChanged: false },
      shortReason: 'Navigation successful',
      details: { matchedCount: 1 },
    };

    collector.record(entry);
    const all = collector.getAll();

    assert.strictEqual(all.length, 1);
    assert.strictEqual(all[0].expectationId, 'nav-1');
    assert.strictEqual(all[0].phaseOutcome, PHASE_OUTCOMES.SUCCESS);
  });

  await suite.test('should truncate long reasons', () => {
    const collector = new DiagnosticsCollector();
    const longReason = 'a'.repeat(200);
    const entry = {
      expectationId: 'test-1',
      kind: 'click',
      shortReason: longReason,
    };

    collector.record(entry);
    const diagnostic = collector.getAll()[0];

    assert(diagnostic.shortReason.length <= 120);
    assert.strictEqual(diagnostic.shortReason, 'a'.repeat(120));
  });

  await suite.test('should normalize evidence signals', () => {
    const collector = new DiagnosticsCollector();
    const entry = {
      expectationId: 'test-1',
      kind: 'submit',
      evidenceSignals: {
        urlChanged: false,
        domChanged: undefined,
        feedbackSeen: true,
      },
    };

    collector.record(entry);
    const diagnostic = collector.getAll()[0];

    assert.strictEqual(diagnostic.evidenceSignals.urlChanged, false);
    assert.strictEqual(diagnostic.evidenceSignals.domChanged, false);
    assert.strictEqual(diagnostic.evidenceSignals.feedbackSeen, true);
    assert.strictEqual(diagnostic.evidenceSignals.networkSeen, false);
  });

  await suite.test('should get diagnostics by expectation ID', () => {
    const collector = new DiagnosticsCollector();
    collector.record({ expectationId: 'exp-1', kind: 'navigate', phaseOutcome: PHASE_OUTCOMES.SUCCESS });
    collector.record({ expectationId: 'exp-2', kind: 'click', phaseOutcome: PHASE_OUTCOMES.SELECTOR_NOT_FOUND });
    collector.record({ expectationId: 'exp-1', kind: 'submit', phaseOutcome: PHASE_OUTCOMES.OUTCOME_TIMEOUT });

    const exp1Diagnostics = collector.getByExpectationId('exp-1');
    assert.strictEqual(exp1Diagnostics.length, 2);
    assert(exp1Diagnostics.every(d => d.expectationId === 'exp-1'));
  });

  await suite.test('should count diagnostics by outcome', () => {
    const collector = new DiagnosticsCollector();
    collector.record({ expectationId: 'exp-1', phaseOutcome: PHASE_OUTCOMES.SUCCESS });
    collector.record({ expectationId: 'exp-2', phaseOutcome: PHASE_OUTCOMES.SUCCESS });
    collector.record({ expectationId: 'exp-3', phaseOutcome: PHASE_OUTCOMES.SELECTOR_NOT_FOUND });
    collector.record({ expectationId: 'exp-4', phaseOutcome: PHASE_OUTCOMES.ELEMENT_HIDDEN });

    const counts = collector.countByOutcome();
    assert.strictEqual(counts[PHASE_OUTCOMES.SUCCESS], 2);
    assert.strictEqual(counts[PHASE_OUTCOMES.SELECTOR_NOT_FOUND], 1);
    assert.strictEqual(counts[PHASE_OUTCOMES.ELEMENT_HIDDEN], 1);
  });
});

test('attemptToDiagnostic', async (suite) => {
  await suite.test('should convert success attempt', () => {
    const expectation = {
      id: 'nav-1',
      category: 'navigate',
      source: { file: 'app.jsx', line: 10 },
      selector: 'a[href="/about"]',
    };

    const attempt = {
      attempted: true,
      reason: 'success',
      action: 'click',
      signals: { urlChanged: true },
      evidence: { urlChanged: true, networkRequestCount: 1 },
    };

    const diagnostic = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diagnostic.expectationId, 'nav-1');
    assert.strictEqual(diagnostic.kind, 'navigate');
    assert.strictEqual(diagnostic.phaseOutcome, PHASE_OUTCOMES.SUCCESS);
    assert.strictEqual(diagnostic.shortReason, 'Expectation met');
    assert.strictEqual(diagnostic.evidenceSignals.urlChanged, true);
  });

  await suite.test('should convert selector-not-found attempt', () => {
    const expectation = {
      id: 'btn-1',
      category: 'click',
      source: { file: 'form.jsx', line: 20 },
    };

    const attempt = {
      attempted: false,
      reason: 'selector-not-found',
    };

    const diagnostic = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diagnostic.phaseOutcome, PHASE_OUTCOMES.SELECTOR_NOT_FOUND);
    assert.strictEqual(diagnostic.shortReason, 'Element selector not found in DOM');
  });

  await suite.test('should convert element-not-visible attempt', () => {
    const expectation = {
      id: 'hidden-1',
      category: 'click',
    };

    const attempt = {
      attempted: true,
      reason: 'element-not-visible',
    };

    const diagnostic = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diagnostic.phaseOutcome, PHASE_OUTCOMES.ELEMENT_HIDDEN);
    assert.strictEqual(diagnostic.shortReason, 'Element found but hidden from view');
  });

  await suite.test('should convert element-disabled attempt', () => {
    const expectation = {
      id: 'disabled-1',
      category: 'submit',
    };

    const attempt = {
      attempted: true,
      reason: 'element-disabled',
    };

    const diagnostic = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diagnostic.phaseOutcome, PHASE_OUTCOMES.ELEMENT_DISABLED);
    assert.strictEqual(diagnostic.shortReason, 'Element found but disabled');
  });

  await suite.test('should convert not-clickable attempt', () => {
    const expectation = {
      id: 'click-1',
      category: 'click',
    };

    const attempt = {
      attempted: true,
      reason: 'not-clickable',
    };

    const diagnostic = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diagnostic.phaseOutcome, PHASE_OUTCOMES.NOT_CLICKABLE);
    assert.strictEqual(diagnostic.shortReason, 'Element not in clickable state');
  });

  await suite.test('should convert navigation-timeout attempt', () => {
    const expectation = {
      id: 'nav-timeout-1',
      category: 'navigate',
    };

    const attempt = {
      attempted: true,
      reason: 'navigation-timeout',
    };

    const diagnostic = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diagnostic.phaseOutcome, PHASE_OUTCOMES.NAV_TIMEOUT);
    assert.strictEqual(diagnostic.shortReason, 'Navigation did not complete in time');
  });

  await suite.test('should convert outcome-timeout attempt', () => {
    const expectation = {
      id: 'outcome-1',
      category: 'validation',
    };

    const attempt = {
      attempted: true,
      reason: 'outcome-timeout',
    };

    const diagnostic = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diagnostic.phaseOutcome, PHASE_OUTCOMES.OUTCOME_TIMEOUT);
    assert.strictEqual(diagnostic.shortReason, 'Expectation not met within timeout');
  });

  await suite.test('should convert blocked-by-auth attempt', () => {
    const expectation = {
      id: 'auth-1',
      category: 'click',
    };

    const attempt = {
      attempted: false,
      reason: 'blocked-by-auth',
    };

    const diagnostic = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diagnostic.phaseOutcome, PHASE_OUTCOMES.BLOCKED_BY_AUTH);
    assert.strictEqual(diagnostic.shortReason, 'Action blocked by authentication state');
  });

  await suite.test('should convert error attempt', () => {
    const expectation = {
      id: 'error-1',
      category: 'click',
    };

    const attempt = {
      attempted: true,
      reason: 'error:Element handle is not an HTMLElement',
    };

    const diagnostic = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diagnostic.phaseOutcome, PHASE_OUTCOMES.UNKNOWN_FAILURE);
    assert(diagnostic.shortReason.includes('Error:'));
    assert(diagnostic.shortReason.includes('Element handle'));
  });

  await suite.test('should include source reference', () => {
    const expectation = {
      id: 'test-1',
      category: 'navigate',
      source: { file: 'app.jsx', line: 42 },
    };

    const attempt = {
      attempted: true,
      reason: 'success',
    };

    const diagnostic = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diagnostic.sourceRef.file, 'app.jsx');
    assert.strictEqual(diagnostic.sourceRef.line, 42);
  });

  await suite.test('should handle missing evidence gracefully', () => {
    const expectation = {
      id: 'test-1',
      category: 'click',
    };

    const attempt = {
      attempted: true,
      reason: 'success',
    };

    const diagnostic = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diagnostic.evidenceSignals.urlChanged, false);
    assert.strictEqual(diagnostic.evidenceSignals.domChanged, false);
    assert.strictEqual(diagnostic.evidenceSignals.feedbackSeen, false);
    assert.strictEqual(diagnostic.evidenceSignals.networkSeen, false);
  });

  await suite.test('should build details object', () => {
    const expectation = {
      id: 'test-1',
      category: 'click',
    };

    const attempt = {
      attempted: true,
      reason: 'success',
      action: 'click',
      evidence: { files: ['file1.json', 'file2.json'] },
    };

    const diagnostic = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diagnostic.details.actionTaken, 'click');
    assert(!Object.prototype.hasOwnProperty.call(diagnostic.details, 'attemptedFlag'), 'attemptedFlag should not be in details');
    assert(!Object.prototype.hasOwnProperty.call(diagnostic.details, 'evidenceFileCount'), 'evidenceFileCount should not be in details');
  });
});

test('Diagnostics determinism', async (suite) => {
  await suite.test('same inputs produce same diagnostic output', () => {
    const expectation = {
      id: 'test-1',
      category: 'navigate',
      source: { file: 'app.jsx', line: 5 },
      selector: 'a[href="/test"]',
    };

    const attempt = {
      attempted: true,
      reason: 'success',
      action: 'click',
      signals: { urlChanged: true },
      evidence: { urlChanged: true, networkRequestCount: 2 },
    };

    const diag1 = attemptToDiagnostic(expectation, attempt);
    const diag2 = attemptToDiagnostic(expectation, attempt);

    // Should be identical (deterministic)
    assert.deepStrictEqual(diag1, diag2);
  });

  await suite.test('diagnostics order is stable for collector', () => {
    const collector1 = new DiagnosticsCollector();
    const collector2 = new DiagnosticsCollector();

    const entries = [
      { expectationId: 'a', kind: 'navigate' },
      { expectationId: 'b', kind: 'click' },
      { expectationId: 'c', kind: 'submit' },
    ];

    for (const entry of entries) {
      collector1.record(entry);
      collector2.record(entry);
    }

    assert.deepStrictEqual(collector1.getAll(), collector2.getAll());
  });

  await suite.test('short reason normalization is deterministic', () => {
    const expectation = {
      id: 'test-1',
      category: 'click',
    };

    const attempt = {
      attempted: true,
      reason: 'error:Some very long error message that exceeds one hundred and twenty characters and should be truncated deterministically',
    };

    const diag1 = attemptToDiagnostic(expectation, attempt);
    const diag2 = attemptToDiagnostic(expectation, attempt);

    assert.strictEqual(diag1.shortReason, diag2.shortReason);
    assert(diag1.shortReason.length <= 120, `Short reason should be max 120 chars, got ${diag1.shortReason.length}`);
  });
});

test('PHASE_OUTCOMES', async (suite) => {
  await suite.test('should have all required outcome types', () => {
    const required = [
      'SUCCESS',
      'SELECTOR_NOT_FOUND',
      'ELEMENT_HIDDEN',
      'ELEMENT_DISABLED',
      'NOT_CLICKABLE',
      'NAV_TIMEOUT',
      'OUTCOME_TIMEOUT',
      'BLOCKED_BY_AUTH',
      'RUNTIME_NOT_READY',
      'UNSUPPORTED_PROMISE',
      'UNKNOWN_FAILURE',
    ];

    for (const outcome of required) {
      assert(PHASE_OUTCOMES[outcome], `Missing outcome: ${outcome}`);
      assert.strictEqual(PHASE_OUTCOMES[outcome], outcome);
    }
  });
});
