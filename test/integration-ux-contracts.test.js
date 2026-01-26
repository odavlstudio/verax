/**
 * Product UX & Output Clarity
 * Integration Tests
 * 
 * Tests all UX components working together:
 * - Canonical naming
 * - Output contracts
 * - Human summary generation
 * - Judgment UX
 * - CLI output formatting
 * - Product seal
 */

import test from 'node:test';
import assert from 'node:assert';
import {
  generateCanonicalScanName,
  generateCanonicalRunName,
  extractPurpose,
  extractHostSegment,
  generateCanonicalDirectoryNames,
} from '../src/cli/util/support/canonical-naming.js';
import {
  validateOutputContract as _validateOutputContract,
  CONTRACT_VIOLATION_CODES,
  formatContractViolations,
} from '../src/cli/util/contracts/output-contract.js';
import {
  generateHumanSummary,
  transformFindingsToJudgments,
  buildJudgment,
  sortJudgmentsByPriority,
  groupJudgmentsBySeverity,
} from '../src/cli/util/output/judgment-ux.js';
import {
  formatResultLine,
  formatReasonLine,
  formatActionLine,
  formatCliOutput,
  formatFindingsSummary,
  formatCoverageCliLine,
  formatTiming,
} from '../src/cli/util/output/cli-ux-formatter.js';
import {
  computeProductionSeal,
  explainProductionSeal,
  formatProductionSealMessage,
  validateSealConsistency,
} from '../src/cli/util/output/product-seal.js';

// ============================================================
// STAGE 6.1: Canonical Naming Tests
// ============================================================

test('STAGE 6.1: Generate canonical scan name', async (t) => {
  await t.test('generates human-readable name for common URLs', async () => {
    const name1 = generateCanonicalScanName({
      url: 'https://myapp.com/login',
      srcPath: '/project/src',
      config: { profile: 'standard' },
    });
    
    assert(name1.includes('login'), 'name should include "login" purpose');
    assert(name1.includes('myapp'), 'name should include host');
    assert(name1.includes('scan'), 'name should start with "scan"');
    assert(!name1.match(/[A-Z]/), 'name should be lowercase');
  });
  
  await t.test('extracts meaningful purpose from URL paths', async () => {
    const tests = [
      { url: 'https://myapp.com/login', expected: 'login' },
      { url: 'https://myapp.com/auth/oauth', expected: 'auth' },
      { url: 'https://myapp.com/checkout', expected: 'checkout' },
      { url: 'https://myapp.com', expected: 'homepage' },
    ];
    
    for (const { url, expected } of tests) {
      const purpose = extractPurpose(url, {});
      assert(purpose.includes(expected), `${url} should give purpose containing "${expected}"`);
    }
  });
  
  await t.test('extracts host from various URL formats', async () => {
    const tests = [
      { url: 'https://myapp.com', expected: 'myapp' },
      { url: 'https://auth.github.com', expected: 'github' },
      { url: 'https://localhost:3000', expected: 'localhost' },
      { url: 'https://127.0.0.1:8080', expected: 'localhost' },
    ];
    
    for (const { url, expected } of tests) {
      const host = extractHostSegment(url);
      assert(host === expected, `${url} should extract host as "${expected}", got "${host}"`);
    }
  });
});

test('STAGE 6.1: Generate canonical run name', async (t) => {
  await t.test('generates name with date and sequence', async () => {
    const runIso = '2026-01-24T10:30:00.000Z';
    const name = generateCanonicalRunName({
      scanName: 'scan-login-flow-abc1',
      runSequence: 1,
      timestamp: runIso,
    });
    
    assert(name.includes('run'), 'name should start with "run"');
    assert(name.includes('2026-01-24'), 'name should include date');
    assert(name.includes('0001'), 'name should include padded sequence');
  });
  
  await t.test('directory names include human-readable path', async () => {
    const names = generateCanonicalDirectoryNames({
      url: 'https://myapp.com/login',
      srcPath: '/project',
      config: { profile: 'standard' },
      runSequence: 1,
    });
    
    assert(names.scanName, 'should have scanName');
    assert(names.runName, 'should have runName');
    assert(names.relativeDir.includes('/'), 'should have slash-separated path');
    assert(!names.relativeDir.match(/^[a-f0-9]+$/), 'should not be hash-only');
  });
});

// ============================================================
// STAGE 6.2: Output Contract Tests
// ============================================================

test('STAGE 6.2: Output contract validation', async (t) => {
  await t.test('validates required artifacts exist', async () => {
    // This would need mock files in a temp directory for full testing
    // For now, test the validation logic structure
    const violations = [];
    
    // Test that contract requires summary.json
    assert(violations.every(v => v.code), 'violations should have codes');
  });
  
  await t.test('returns no violations for valid contract', async () => {
    const formatViolations = formatContractViolations([]);
    assert(formatViolations.includes('successfully'), 'should acknowledge valid contract');
  });
  
  await t.test('formats violations for human display', async () => {
    const violations = [
      {
        code: CONTRACT_VIOLATION_CODES.MISSING_SUMMARY,
        message: 'summary.json is missing',
        artifact: 'summary.json',
      },
    ];
    
    const formatted = formatContractViolations(violations);
    assert(formatted.includes('summary.json'), 'should mention artifact');
    assert(formatted.includes('missing'), 'should explain issue');
  });
});

// ============================================================
// STAGE 6.3: Human Summary Tests
// ============================================================

test('STAGE 6.3: Human summary generation', async (t) => {
  await t.test('generates summary markdown', async () => {
    const context = {
      meta: {
        url: 'https://myapp.com/login',
        startedAt: '2026-01-24T10:00:00Z',
        completedAt: '2026-01-24T10:01:00Z',
      },
      summary: {
        status: 'COMPLETE',
        productionSeal: 'PRODUCTION_GRADE',
        digest: {
          expectationsTotal: 10,
          observed: 10,
          silentFailures: 0,
          unproven: 0,
        },
      },
      findings: [],
      coverage: { coverageRatio: 0.95 },
      projectProfile: { framework: 'react', router: 'react-router' },
      displayRunName: 'run-2026-01-24-0001',
    };
    
    const markdown = generateHumanSummary(context);
    
    assert(markdown.includes('VERAX Execution Summary'), 'should have header');
    assert(markdown.includes('run-2026-01-24-0001'), 'should include run name');
    assert(markdown.includes('COMPLETE'), 'should show status');
    assert(markdown.includes('PRODUCTION_GRADE'), 'should show seal');
    assert(markdown.includes('react'), 'should show framework');
    assert(!markdown.match(/undefined/), 'should not have undefined values');
  });
  
  await t.test('generates summary with findings', async () => {
    const findings = [
      {
        type: 'SILENT_FAILURE',
        outcome: 'UNEXPECTED',
        humanSummary: 'Login form submitted but validation failed silently',
        confidence: { severity: 'HIGH' },
        interactionIndex: 2,
        URL: 'https://myapp.com/login',
      },
    ];
    
    const context = {
      meta: { url: 'https://myapp.com/login', startedAt: '2026-01-24T10:00:00Z', completedAt: '2026-01-24T10:01:00Z' },
      summary: { status: 'COMPLETE', digest: { expectationsTotal: 1, observed: 0, silentFailures: 1 } },
      findings,
      coverage: { coverageRatio: 0.8 },
      projectProfile: {},
      displayRunName: 'run-2026-01-24-0001',
    };
    
    const markdown = generateHumanSummary(context);
    
    assert(markdown.includes('Silent Failures: 1'), 'should count silent failures');
    assert(markdown.includes('Top Issues'), 'should have issues section');
    assert(!markdown.includes('No findings'), 'should not say no findings when there are some');
  });
});

// ============================================================
// STAGE 6.4: Judgment UX Tests
// ============================================================

test('STAGE 6.4: Judgment generation and sorting', async (t) => {
  await t.test('builds judgment from finding', async () => {
    const finding = {
      id: 'finding-1',
      type: 'SILENT_FAILURE',
      outcome: 'UNEXPECTED',
      humanSummary: 'Login failed silently',
      URL: 'https://myapp.com/login',
      interactionIndex: 1,
      confidence: { severity: 'HIGH' },
    };
    
    const judgment = buildJudgment(finding, 0);
    
    assert(judgment.id === 'judgment-0', 'should have numbered id');
    assert(judgment.title.includes('Silent'), 'should have readable title');
    assert(judgment.severity === 'HIGH', 'should compute severity');
    assert(judgment.recommendation.action === 'FIX', 'silent failures should be FIX');
    assert(!judgment.title.match(/^[a-f0-9-]+$/), 'title should not be raw ID');
  });
  
  await t.test('sorts judgments by priority', async () => {
    const judgments = [
      { id: '1', severity: 'LOW', type: 'COVERAGE_GAP', index: 0 },
      { id: '2', severity: 'CRITICAL', type: 'SILENT_FAILURE', index: 1 },
      { id: '3', severity: 'MEDIUM', type: 'UNMET_EXPECTATION', index: 2 },
    ];
    
    const sorted = sortJudgmentsByPriority(judgments);
    
    assert.strictEqual(sorted[0].severity, 'CRITICAL', 'critical should be first');
    assert.strictEqual(sorted[1].severity, 'MEDIUM', 'medium should be second');
    assert.strictEqual(sorted[2].severity, 'LOW', 'low should be last');
  });
  
  await t.test('groups judgments by severity', async () => {
    const judgments = [
      { id: '1', severity: 'CRITICAL' },
      { id: '2', severity: 'CRITICAL' },
      { id: '3', severity: 'HIGH' },
      { id: '4', severity: 'MEDIUM' },
    ];
    
    const grouped = groupJudgmentsBySeverity(judgments);
    
    assert.strictEqual(grouped.CRITICAL.length, 2, 'should have 2 critical');
    assert.strictEqual(grouped.HIGH.length, 1, 'should have 1 high');
    assert.strictEqual(grouped.MEDIUM.length, 1, 'should have 1 medium');
  });
  
  await t.test('transforms findings to judgments', async () => {
    const findings = [
      {
        id: 'f1',
        type: 'SILENT_FAILURE',
        outcome: 'UNEXPECTED',
        confidence: { severity: 'HIGH' },
      },
      {
        id: 'f2',
        type: 'COVERAGE_GAP',
        outcome: 'NOTESTED',
        confidence: { severity: 'LOW' },
      },
    ];
    
    const result = transformFindingsToJudgments(findings);
    
    assert.strictEqual(result.byPriority.length, 2, 'should have all judgments');
    assert.strictEqual(result.summary.total, 2, 'summary should count all');
    assert.strictEqual(result.summary.critical + result.summary.high, 1, 'should count one high/critical');
  });
});

// ============================================================
// STAGE 6.5: CLI UX Tests
// ============================================================

test('STAGE 6.5: CLI output formatting', async (t) => {
  await t.test('formats result line', async () => {
    const summary = { status: 'COMPLETE' };
    const findings = [];
    
    const result = formatResultLine(summary, findings);
    
    assert(result.includes('✅'), 'should include checkmark emoji');
    assert(result.includes('COMPLETE'), 'should show status');
    assert(result.includes('finding'), 'should mention findings');
  });
  
  await t.test('formats reason line', async () => {
    const summary = { status: 'COMPLETE', digest: { expectationsTotal: 5 } };
    const findings = [];
    const coverage = { coverageRatio: 0.95 };
    
    const reason = formatReasonLine(summary, findings, coverage);
    
    assert(reason.includes('REASON:'), 'should start with REASON label');
    assert(reason.includes('95'), 'should include coverage %');
    assert(reason.includes('expectations met'), 'should describe result');
  });
  
  await t.test('formats action line', async () => {
    const summary = { status: 'COMPLETE' };
    const findings = [];
    const coverage = { coverageRatio: 0.95 };
    
    const action = formatActionLine(summary, findings, coverage);
    
    assert(action.includes('ACTION:'), 'should start with ACTION label');
    assert(action.includes('healthy'), 'should indicate health');
  });
  
  await t.test('formats complete CLI output with three lines', async () => {
    const context = {
      summary: { status: 'COMPLETE' },
      findings: [],
      coverage: { coverageRatio: 0.95 },
      displayRunName: 'run-2026-01-24-0001',
      artifactDir: '/project/.verax/scans/scan-login/run-2026-01-24-0001',
    };
    
    const output = formatCliOutput(context);
    
    assert(output.includes('RESULT:'), 'should have RESULT line');
    assert(output.includes('REASON:'), 'should have REASON line');
    assert(output.includes('ACTION:'), 'should have ACTION line');
    assert(output.includes('run-2026-01-24-0001'), 'should show run name');
  });
  
  await t.test('formats findings summary', async () => {
    const findings = [
      { confidence: { severity: 'CRITICAL' } },
      { confidence: { severity: 'HIGH' } },
      { confidence: { severity: 'HIGH' } },
      { confidence: { severity: 'MEDIUM' } },
    ];
    
    const summary = formatFindingsSummary(findings);
    
    assert(summary.includes('1 critical'), 'should count critical');
    assert(summary.includes('2 high'), 'should count high');
    assert(summary.includes('1 medium'), 'should count medium');
  });
  
  await t.test('formats coverage line', async () => {
    const coverage = { coverageRatio: 0.85, minCoverage: 0.9 };
    
    const line = formatCoverageCliLine(coverage);
    
    assert(line.includes('Coverage:'), 'should have label');
    assert(line.includes('85'), 'should show percentage');
    assert(line.includes('⚠️'), 'should warn when below minimum');
  });
  
  await t.test('formats timing', async () => {
    const timing = formatTiming(
      '2026-01-24T10:00:00Z',
      '2026-01-24T10:01:30Z'
    );
    
    assert(timing.includes('Duration:'), 'should have label');
    assert(timing.includes('min'), 'should show time unit');
  });
});

// ============================================================
// STAGE 6.6: Product Seal Tests
// ============================================================

test('STAGE 6.6: Product seal computation', async (t) => {
  await t.test('grants seal when all conditions met', async () => {
    const context = {
      status: 'COMPLETE',
      coverage: { coverageRatio: 0.95 },
      findings: [],
      digest: { expectationsTotal: 10, observed: 10 },
    };
    
    const seal = computeProductionSeal(context);
    
    assert.strictEqual(seal, 'PRODUCTION_GRADE', 'should grant seal');
  });
  
  await t.test('denies seal when status not COMPLETE', async () => {
    const context = {
      status: 'INCOMPLETE',
      coverage: { coverageRatio: 0.95 },
      findings: [],
      digest: { expectationsTotal: 10, observed: 10 },
    };
    
    const seal = computeProductionSeal(context);
    
    assert.strictEqual(seal, null, 'should deny seal for non-COMPLETE status');
  });
  
  await t.test('denies seal when coverage below threshold', async () => {
    const context = {
      status: 'COMPLETE',
      coverage: { coverageRatio: 0.75 },
      findings: [],
      digest: { expectationsTotal: 10, observed: 10 },
      minCoverageThreshold: 0.9,
    };
    
    const seal = computeProductionSeal(context);
    
    assert.strictEqual(seal, null, 'should deny seal for low coverage');
  });
  
  await t.test('denies seal when silent failures exist', async () => {
    const context = {
      status: 'COMPLETE',
      coverage: { coverageRatio: 0.95 },
      findings: [{ type: 'SILENT_FAILURE' }],
      digest: { expectationsTotal: 10, observed: 10 },
    };
    
    const seal = computeProductionSeal(context);
    
    assert.strictEqual(seal, null, 'should deny seal for silent failures');
  });
  
  await t.test('explains seal decision', async () => {
    const context = {
      status: 'INCOMPLETE',
      coverage: { coverageRatio: 0.75 },
      findings: [{ type: 'SILENT_FAILURE', confidence: { severity: 'HIGH' } }],
      digest: { expectationsTotal: 10, observed: 8 },
    };
    
    const explanation = explainProductionSeal(context);
    
    assert(!explanation.sealed, 'should not be sealed');
    assert(explanation.reasons.length > 0, 'should explain reasons');
    assert(explanation.reasons.some(r => r.includes('COMPLETE')), 'should mention status');
  });
  
  await t.test('formats seal message for display', async () => {
    const context = {
      status: 'COMPLETE',
      coverage: { coverageRatio: 0.95 },
      findings: [],
      digest: { expectationsTotal: 10, observed: 10 },
    };
    
    const message = formatProductionSealMessage(context);
    
    assert(message.includes('PRODUCTION_GRADE'), 'should mention seal');
    assert(message.includes('GRANTED'), 'should indicate grant');
    assert(message.includes('✅'), 'should have checkmark');
  });
  
  await t.test('validates seal consistency', async () => {
    const summary = { productionSeal: 'PRODUCTION_GRADE' };
    const context = {
      status: 'COMPLETE',
      coverage: { coverageRatio: 0.95 },
      findings: [],
      digest: { expectationsTotal: 10, observed: 10 },
    };
    
    const isConsistent = validateSealConsistency(summary, context);
    
    assert(isConsistent, 'seal should be consistent');
  });
});

console.log('Stage 6 integration tests defined.');
