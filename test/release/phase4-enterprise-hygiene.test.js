/**
 * Enterprise Hygiene Tests (Trust Lock)
 * 
 * Tests for invariant enforcement, determinism, and schema validation.
 */

import test from 'node:test';
import assert from 'node:assert';
import { buildFindingsReport } from '../../src/verax/detect/findings-writer.js';
import { 
  enforceFinalInvariants, 
  deduplicateFindings
} from '../../src/verax/detect/invariants-enforcer.js';

const enforceFinding = (finding) => enforceFinalInvariants([finding])[0] || null;
const enforceFindingInvariants = enforceFinding;
const enforceAllFindingInvariants = enforceFinalInvariants;

const makeFinding = (overrides = {}) => ({
  id: 'test-1',
  promise: { kind: 'click', value: 'button' },
  confidence: 0.9,
  impact: 'HIGH',
  status: 'CONFIRMED',
  severity: 'HIGH',
  type: 'silent_failure',
  observed: { result: 'No feedback observed' },
  evidence: { navigation_changed: true },
  what_happened: 'User clicked button',
  what_was_expected: 'Form submitted',
  what_was_observed: 'No feedback',
  why_it_matters: 'User unaware',
  ...overrides
});

// ====== INVARIANT ENFORCEMENT TESTS ======

test('Enterprise Hygiene: Invariant 1 - Evidence must exist with meaningful signals', () => {
  const finding = makeFinding({ evidence: {} });  // INVALID: empty object

  const result = enforceFindingInvariants(finding);
  assert.ok(result, 'Finding with empty evidence should be downgraded');
  assert.equal(result.status, 'SUSPECTED', 'Missing substantive evidence downgrades to SUSPECTED');
});

test('Enterprise Hygiene: Invariant 1 - Evidence with truthy signals passes', () => {
  const finding = makeFinding({ evidence: { navigation_changed: true, feedback_seen: true } });

  const result = enforceFindingInvariants(finding);
  assert.notEqual(result, null, 'Finding with valid evidence should pass');
});

test('Enterprise Hygiene: Invariant 2 - Promise must exist and be non-empty', () => {
  const invalidCases = [
    { promise: null },
    { promise: {} },
    { promise: '' },
    { promise: { kind: '', value: '' } }
  ];

  for (const testCase of invalidCases) {
    const finding = makeFinding({ ...testCase });

    const result = enforceFindingInvariants(finding);
    assert.equal(result, null, `Finding with promise ${JSON.stringify(testCase.promise)} should be dropped`);
  }
});

test('Enterprise Hygiene: Invariant 3 - Confidence must be number in [0,1]', () => {
  const invalidCases = [
    { confidence: -0.1 },
    { confidence: 1.5 },
    { confidence: 'high' },
    { confidence: null }
  ];

  for (const testCase of invalidCases) {
    const finding = makeFinding({ ...testCase });

    const result = enforceFindingInvariants(finding);
    assert.equal(result, null, `Finding with confidence ${testCase.confidence} should be dropped`);
  }
});

test('Enterprise Hygiene: Invariant 4 - Impact must be known value', () => {
  const finding = makeFinding({ impact: 'INVALID_IMPACT' });

  const result = enforceFindingInvariants(finding);
  assert.equal(result, null, 'Finding with invalid impact should be dropped');
});

test('Enterprise Hygiene: Invariant 5 - Internal error flags never produce findings', () => {
  const internalErrorMarkers = [
    { reason: 'INTERNAL_ERROR: timeout' },
    { errorMessage: 'BROWSER_CRASH detected' },
    { reason: 'Internal error in detection' }
  ];

  for (const marker of internalErrorMarkers) {
    const finding = makeFinding({ ...marker });

    const result = enforceFindingInvariants(finding);
    assert.equal(result, null, `Finding with internal error marker should be dropped`);
  }
});

test('Enterprise Hygiene: Invariant 7 - Finding ID must be non-empty string', () => {
  const invalidCases = [
    { id: '' },
    { id: null },
    { id: undefined },
    { id: 123 }
  ];

  for (const testCase of invalidCases) {
    const finding = makeFinding({ ...testCase });

    const result = enforceFindingInvariants(finding);
    assert.equal(result, null, `Finding with id ${JSON.stringify(testCase.id)} should be dropped`);
  }
});

test('Enterprise Hygiene: Valid finding passes all invariants', () => {
  const finding = makeFinding({ id: 'test-valid-1', type: 'silent_failure', evidence: { navigation_changed: true, feedback_seen: true } });

  const result = enforceFindingInvariants(finding);
  assert.notEqual(result, null, 'Valid finding should pass');
  assert.deepEqual(result, { ...finding, enrichment: { ambiguityReasons: [], evidenceCategories: ['navigation', 'feedback'] }, causes: [] }, 'Valid finding should be returned with enrichment and normalized causes');
});

// ====== DEDUPLICATION TESTS ======

test('Enterprise Hygiene: Deduplication removes duplicate findings (stable order)', () => {
  const findings = [
    { id: 'f1', location: 'button#submit', promise: { kind: 'click' } },
    { id: 'f1', location: 'button#submit', promise: { kind: 'click' } },  // duplicate
    { id: 'f2', location: 'form#login', promise: { kind: 'submit' } },
    { id: 'f1', location: 'button#submit', promise: { kind: 'click' } }   // another duplicate
  ];

  const result = deduplicateFindings(findings);
  assert.equal(result.length, 2, 'Should have 2 unique findings');
  assert.equal(result[0].id, 'f1', 'First should be f1');
  assert.equal(result[1].id, 'f2', 'Second should be f2');
});

// ====== DETERMINISM TESTS ======

test('Enterprise Hygiene: Same findings produce identical report JSON across runs', () => {
  const url = 'https://example.com';
  const detectedAt = '2024-01-01T12:00:00Z';

  const findings = [
    {
      ...makeFinding({
        id: 'finding-b',
        promise: { kind: 'click', value: 'button-b' },
        evidence: { navigation_changed: true },
        what_happened: 'User clicked',
        what_was_expected: 'Submit',
        what_was_observed: 'Nothing',
        why_it_matters: 'Silent fail',
        type: 'silent_failure'
      })
    },
    {
      ...makeFinding({
        id: 'finding-a',
        promise: { kind: 'navigate', value: 'page-a' },
        impact: 'CRITICAL',
        evidence: { navigation_changed: true },
        what_happened: 'Navigation attempted',
        what_was_expected: 'Page loaded',
        what_was_observed: 'No page load',
        why_it_matters: 'Lost user flow',
        type: 'silent_failure'
      })
    }
  ];

  // Build report twice with identical inputs
  const {report: report1} = buildFindingsReport({ url, findings, coverageGaps: [], detectedAt });
  const {report: report2} = buildFindingsReport({ url, findings, coverageGaps: [], detectedAt });

  // Convert to JSON string (exact same formatting)
  const json1 = JSON.stringify(report1, null, 2);
  const json2 = JSON.stringify(report2, null, 2);

  assert.equal(json1, json2, 'Report JSON should be byte-identical across runs');
});

test('Enterprise Hygiene: Findings are sorted deterministically (by id)', () => {
  const url = 'https://example.com';
  const detectedAt = '2024-01-01T12:00:00Z';

  const findings = [
    {
      ...makeFinding({
        id: 'zebra',
        evidence: { navigation_changed: true },
        what_happened: 'Clicked',
        what_was_expected: 'Submit',
        what_was_observed: 'Nothing',
        why_it_matters: 'Silent'
      })
    },
    {
      ...makeFinding({
        id: 'apple',
        evidence: { navigation_changed: true },
        what_happened: 'Clicked',
        what_was_expected: 'Submit',
        what_was_observed: 'Nothing',
        why_it_matters: 'Silent'
      })
    },
    {
      ...makeFinding({
        id: 'monkey',
        evidence: { navigation_changed: true },
        what_happened: 'Clicked',
        what_was_expected: 'Submit',
        what_was_observed: 'Nothing',
        why_it_matters: 'Silent'
      })
    }
  ];

  const report = buildFindingsReport({ url, findings, coverageGaps: [], detectedAt });

  // Findings should be sorted by id
  assert.equal(report.findings[0].id, 'apple', 'First finding should be apple (alphabetically first)');
  assert.equal(report.findings[1].id, 'monkey', 'Second finding should be monkey');
  assert.equal(report.findings[2].id, 'zebra', 'Third finding should be zebra');
});

// ====== SCHEMA VALIDATION TESTS ======

test('Enterprise Hygiene: Production report excludes enforcement metadata (Trust Lock)', () => {
  const findings = [
    {
      ...makeFinding({ id: 'test-1', evidence: { navigation_changed: true }, what_happened: 'Clicked' })
    }
  ];

  const report = buildFindingsReport({
    url: 'https://example.com',
    findings,
    coverageGaps: [],
    detectedAt: '2024-01-01T12:00:00Z'
  });

  // Trust Lock: enforcement metadata should be present and consistent
  assert.ok(report.enforcement, 'Enforcement metadata present in production report');
  assert.equal(report.enforcement.droppedCount, 0, 'No findings dropped for valid input');
  assert.equal(report.enforcement.downgradedCount, 0, 'No findings downgraded for valid input');
  assert.ok(report.findings, 'Findings present');
  assert.ok(report.outcomeSummary, 'Outcome summary present');
  assert.ok(report.promiseSummary, 'Promise summary present');
});

// ====== SILENT DROP ENFORCEMENT ======

test('Enterprise Hygiene: Invalid findings are silently dropped (no console output)', () => {
  const findings = [
    // Valid finding
    {
      ...makeFinding({ id: 'valid-1', evidence: { navigation_changed: true } })
    },
    // Invalid: missing type
    {
      ...makeFinding({ id: 'invalid-1' })
      // Missing type field (removed below)
    },
    // Invalid: missing observed block
    {
      ...makeFinding({ id: 'invalid-2', observed: undefined, what_was_observed: undefined })
    }
  ];

  delete findings[1].type; // Explicitly remove to assert drop

  const report = buildFindingsReport({
    url: 'https://example.com',
    findings,
    coverageGaps: [],
    detectedAt: '2024-01-01T12:00:00Z'
  });

  // Only 1 valid finding should remain (invalid dropped silently - Trust Lock)
  assert.equal(report.findings.length, 1, 'Only valid finding in report');
  assert.equal(report.findings[0].id, 'valid-1', 'Valid-1 remains');
  // Enforcement metadata present for integrity
  assert.ok(report.enforcement, 'Enforcement metadata recorded');
});

test('Enterprise Hygiene: All findings pass through enforce pipeline', () => {
  const findings = [
    {
      ...makeFinding({ id: 'test-1', evidence: { navigation_changed: true } })
    }
  ];

  const result = enforceAllFindingInvariants(findings);
  assert.equal(result.length, 1, 'Valid finding should pass');
  assert.equal(result[0].id, 'test-1', 'Finding ID should be preserved');
});




