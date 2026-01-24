/**
 * Constitutional Tests — Evidence and Validation
 * 
 * Tests that enforce VERAX's written CORE principles:
 * - Evidence Law (CONFIRMED requires evidence)
 * - No Guessing (inference without signal)
 * - Required Fields (missing fields)
 * - Confidence Bounds (0–1)
 * - Status Semantics (CONFIRMED, SUSPECTED, INFORMATIONAL)
 */

import { validateFindingConstitution, applyValidationResult, batchValidateFindings, validateAndSanitizeFinding } from '../../src/verax/detect/constitution-validator.js';
import { canonicalizeFinding, createFinding, ALLOWED_FINDING_TYPES as _ALLOWED_FINDING_TYPES } from '../../src/verax/detect/finding-contract.js';

// Test utilities
function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED: ${message} (expected ${expected}, got ${actual})`);
  }
}

function assertContains(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(`ASSERTION FAILED: ${message} (expected to contain "${needle}", got "${haystack}")`);
  }
}

// ============================================================================
// EVIDENCE LAW TESTS
// ============================================================================

export async function test_confirmedWithoutEvidenceIsDowngraded() {
  const finding = createFinding({
    type: 'silent_failure',
    status: 'CONFIRMED',
    confidence: 0.8,
    evidence: {}, // Empty evidence!
    impact: 'Test'
  });

  const result = validateFindingConstitution(finding);
  assert(!result.valid, 'Should be invalid');
  assert(result.action === 'DOWNGRADE', 'Should downgrade CONFIRMED without evidence');
  assert(result.downgrade.status === 'SUSPECTED', 'Should downgrade to SUSPECTED');

  const downgraded = applyValidationResult(finding, result);
  assertEqual(downgraded.status, 'SUSPECTED', 'Status should be SUSPECTED after downgrade');

  return { passed: true };
}

export async function test_confirmedWithoutEvidenceFields() {
  const finding = createFinding({
    type: 'silent_failure',
    status: 'CONFIRMED',
    confidence: 0.8,
    evidence: null, // No evidence object
    impact: 'Test'
  });

  const result = validateFindingConstitution(finding);
  assert(!result.valid, 'Should be invalid');
  assertContains(result.reason, 'evidence', 'Should mention evidence in reason');

  return { passed: true };
}

export async function test_confirmedWithValidEvidence() {
  const finding = createFinding({
    type: 'silent_failure',
    status: 'CONFIRMED',
    confidence: 0.8,
    evidence: {
      before: 'screenshot-1.png',
      after: 'screenshot-2.png'
    },
    impact: 'Test'
  });

  const result = validateFindingConstitution(finding);
  assert(result.valid, 'Should be valid with evidence');

  return { passed: true };
}

export async function test_suspectedDoesNotRequireEvidence() {
  const finding = createFinding({
    type: 'silent_failure',
    status: 'SUSPECTED',
    confidence: 0.5,
    evidence: {}, // Empty
    impact: 'Test'
  });

  const result = validateFindingConstitution(finding);
  assert(result.valid, 'SUSPECTED does not require evidence');

  return { passed: true };
}

// ============================================================================
// NO GUESSING TESTS
// ============================================================================

export async function test_highConfidenceWithoutEvidenceIsRejected() {
  const finding = createFinding({
    type: 'silent_failure',
    status: 'SUSPECTED',
    confidence: 0.95, // High confidence
    evidence: {}, // Zero evidence
    impact: 'Test'
  });

  const result = validateFindingConstitution(finding);
  assert(!result.valid, 'Should reject high confidence with zero evidence');
  assert(result.action === 'DROP', 'Should DROP (guessing)');

  return { passed: true };
}

export async function test_lowConfidenceWithoutEvidenceIsAllowed() {
  const finding = createFinding({
    type: 'silent_failure',
    status: 'SUSPECTED',
    confidence: 0.3, // Low confidence
    evidence: {}, // Zero evidence
    impact: 'Test'
  });

  const result = validateFindingConstitution(finding);
  assert(result.valid, 'Low confidence without evidence is acceptable (uncertainty)');

  return { passed: true };
}

// ============================================================================
// REQUIRED FIELDS TESTS
// ============================================================================

export async function test_missingIdIsRejected() {
  const finding = {
    type: 'silent_failure',
    status: 'SUSPECTED',
    severity: 'HIGH',
    confidence: 0.5,
    promise: { kind: 'navigation', value: '/about' },
    observed: { result: 'no change' },
    evidence: { signal: true },
    impact: 'Test'
    // missing: id
  };

  const result = validateFindingConstitution(finding);
  assert(!result.valid, 'Should be invalid without id');
  assertContains(result.reason, 'id', 'Should mention missing id');

  return { passed: true };
}

export async function test_missingTypeIsRejected() {
  const finding = {
    id: 'test-1',
    status: 'SUSPECTED',
    severity: 'HIGH',
    confidence: 0.5,
    promise: { kind: 'navigation', value: '/about' },
    observed: { result: 'no change' },
    evidence: { signal: true },
    impact: 'Test'
    // missing: type
  };

  const result = validateFindingConstitution(finding);
  assert(!result.valid, 'Should be invalid without type');

  return { passed: true };
}

export async function test_allRequiredFieldsPresent() {
  const finding = createFinding({
    type: 'silent_failure',
    status: 'SUSPECTED',
    confidence: 0.5,
    evidence: { signal: true },
    impact: 'Test'
  });

  const result = validateFindingConstitution(finding);
  assert(result.valid, 'Should be valid with all required fields');

  return { passed: true };
}

// ============================================================================
// CONFIDENCE BOUNDS TESTS
// ============================================================================

export async function test_confidenceAboveOne() {
  const finding = createFinding({
    type: 'silent_failure',
    confidence: 1.5, // Invalid
    impact: 'Test'
  });

  const result = validateFindingConstitution(finding);
  assert(!result.valid, 'Should reject confidence > 1');
  assertContains(result.reason, 'confidence', 'Should mention confidence');

  return { passed: true };
}

export async function test_confidenceBelowZero() {
  const finding = createFinding({
    type: 'silent_failure',
    confidence: -0.1, // Invalid
    impact: 'Test'
  });

  const result = validateFindingConstitution(finding);
  assert(!result.valid, 'Should reject confidence < 0');

  return { passed: true };
}

export async function test_confidenceAtBoundaries() {
  const finding0 = createFinding({
    type: 'silent_failure',
    confidence: 0,
    impact: 'Test'
  });

  const finding1 = createFinding({
    type: 'silent_failure',
    confidence: 1,
    evidence: { signal: true }, // Need evidence for high confidence
    impact: 'Test'
  });

  assert(validateFindingConstitution(finding0).valid, '0 confidence should be valid');
  assert(validateFindingConstitution(finding1).valid, '1 confidence should be valid with evidence');

  return { passed: true };
}

// ============================================================================
// STATUS SEMANTICS TESTS
// ============================================================================

export async function test_validStatuses() {
  for (const status of ['CONFIRMED', 'SUSPECTED', 'INFORMATIONAL']) {
    const finding = createFinding({
      type: 'silent_failure',
      status,
      evidence: status === 'CONFIRMED' ? { signal: true } : {},
      impact: 'Test'
    });

    const result = validateFindingConstitution(finding);
    assert(result.valid, `Status ${status} should be valid`);
  }

  return { passed: true };
}

export async function test_invalidStatus() {
  const finding = createFinding({
    type: 'silent_failure',
    status: 'UNKNOWN',
    impact: 'Test'
  });

  const result = validateFindingConstitution(finding);
  assert(!result.valid, 'Should reject unknown status');

  return { passed: true };
}

// ============================================================================
// BATCH VALIDATION TESTS
// ============================================================================

export async function test_batchValidateMixedFindings() {
  const findings = [
    createFinding({ type: 'silent_failure', confidence: 0.5, evidence: { signal: true } }), // valid
    createFinding({ type: 'silent_failure', confidence: 0.95 }), // will be dropped (guessing)
    createFinding({ type: 'silent_failure', status: 'CONFIRMED' }), // will be downgraded
  ];

  const { valid, dropped, downgraded } = batchValidateFindings(findings);

  assert(valid.length === 2, `Should have 2 valid findings, got ${valid.length}`);
  assert(dropped === 1, `Should have 1 dropped, got ${dropped}`);
  assert(downgraded === 1, `Should have 1 downgraded, got ${downgraded}`);

  // Check that downgraded finding has SUSPECTED status
  const downgradedFinding = valid.find(f => f.status === 'SUSPECTED');
  assert(downgradedFinding !== undefined, 'Should have a SUSPECTED (downgraded) finding');

  return { passed: true };
}

// ============================================================================
// SANITIZE PIPELINE TESTS
// ============================================================================

export async function test_validateAndSanitizePipeline() {
  // Valid finding
  const valid = createFinding({ type: 'silent_failure', confidence: 0.5, evidence: { signal: true } });
  const sanitized = validateAndSanitizeFinding(valid);
  assert(sanitized !== null, 'Valid finding should pass through');

  // Guessing (high confidence, no evidence)
  const guessing = createFinding({ type: 'silent_failure', confidence: 0.95 });
  const dropped = validateAndSanitizeFinding(guessing);
  assert(dropped === null, 'Guessing should be dropped');

  // Downgrade
  const toDowngrade = createFinding({ type: 'silent_failure', status: 'CONFIRMED' });
  const downgraded = validateAndSanitizeFinding(toDowngrade);
  assert(downgraded !== null, 'Should downgrade, not drop');
  assertEqual(downgraded.status, 'SUSPECTED', 'Should be downgraded to SUSPECTED');

  return { passed: true };
}

// ============================================================================
// FINDING CONTRACT CANONICALIZATION TESTS
// ============================================================================

export async function test_canonicalizeConvertsFindingShape() {
  const raw = {
    type: 'silent_failure',
    what_was_expected: 'Navigation to /about',
    what_was_observed: 'No change',
    why_it_matters: 'User saw no feedback',
    evidence: { before: 'img1.png', after: 'img2.png' },
    outcome: 'SILENT_FAILURE'
  };

  const canonical = canonicalizeFinding(raw);

  assert(canonical.id !== undefined, 'Should have id');
  assertEqual(canonical.type, 'silent_failure', 'Type should match');
  assertEqual(canonical.status, 'SUSPECTED', 'Outcome:SILENT_FAILURE maps to SUSPECTED');
  assert(canonical.promise !== undefined, 'Should have promise object');
  assert(canonical.observed !== undefined, 'Should have observed object');
  assert(canonical.impact !== undefined, 'Should have impact');

  return { passed: true };
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

export async function runAllConstitutionalTests() {
  const tests = [
    // Evidence Law
    { name: 'test_confirmedWithoutEvidenceIsDowngraded', fn: test_confirmedWithoutEvidenceIsDowngraded },
    { name: 'test_confirmedWithoutEvidenceFields', fn: test_confirmedWithoutEvidenceFields },
    { name: 'test_confirmedWithValidEvidence', fn: test_confirmedWithValidEvidence },
    { name: 'test_suspectedDoesNotRequireEvidence', fn: test_suspectedDoesNotRequireEvidence },

    // No Guessing
    { name: 'test_highConfidenceWithoutEvidenceIsRejected', fn: test_highConfidenceWithoutEvidenceIsRejected },
    { name: 'test_lowConfidenceWithoutEvidenceIsAllowed', fn: test_lowConfidenceWithoutEvidenceIsAllowed },

    // Required Fields
    { name: 'test_missingIdIsRejected', fn: test_missingIdIsRejected },
    { name: 'test_missingTypeIsRejected', fn: test_missingTypeIsRejected },
    { name: 'test_allRequiredFieldsPresent', fn: test_allRequiredFieldsPresent },

    // Confidence Bounds
    { name: 'test_confidenceAboveOne', fn: test_confidenceAboveOne },
    { name: 'test_confidenceBelowZero', fn: test_confidenceBelowZero },
    { name: 'test_confidenceAtBoundaries', fn: test_confidenceAtBoundaries },

    // Status Semantics
    { name: 'test_validStatuses', fn: test_validStatuses },
    { name: 'test_invalidStatus', fn: test_invalidStatus },

    // Batch & Pipeline
    { name: 'test_batchValidateMixedFindings', fn: test_batchValidateMixedFindings },
    { name: 'test_validateAndSanitizePipeline', fn: test_validateAndSanitizePipeline },

    // Canonicalization
    { name: 'test_canonicalizeConvertsFindingShape', fn: test_canonicalizeConvertsFindingShape }
  ];

  let passed = 0;
  let failed = 0;

  console.log('');
  console.log('========================================');
  console.log('Constitutional Tests — Evidence Enforcement');
  console.log('========================================');
  console.log('');

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✓ ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`✗ ${test.name} FAILED: ${error.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('========================================');
  console.log(`Constitutional Tests: ${passed} passed, ${failed} failed`);
  console.log('========================================');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if executed directly
const scriptPath = process.argv[1];
const currentFile = new URL(import.meta.url).pathname;
if (scriptPath === currentFile || scriptPath.endsWith('constitution.test.js')) {
  runAllConstitutionalTests().catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
}
