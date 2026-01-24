/**
 * UNIT TESTS — Evidence Categories & Ambiguity Engine
 * 
 * Tests for constitution enforcement:
 * A) Evidence categories and downgrades
 * B) Ambiguity detection and recording
 * C) Artifact integrity validation
 */

import assert from 'assert';
import { 
  validateFindingConstitution, 
  applyValidationResult,
  validateAndSanitizeFinding as _validateAndSanitizeFinding,
  batchValidateFindings as _batchValidateFindings
} from '../../src/verax/detect/constitution-validator.js';

import {
  validateArtifactIntegrity,
  applyIntegrityFixes
} from '../../src/cli/util/integrity-validator.js';

// ============================================================================
// A) EVIDENCE CATEGORIES TESTS
// ============================================================================

function test_confirmedWithOnlyConsoleErrorsDowngradesToSuspected() {
  // SETUP: CONFIRMED finding with ONLY console errors (weak evidence)
  const finding = {
    id: 'test-1',
    type: 'dead_interaction_silent_failure',
    status: 'CONFIRMED',
    severity: 'MEDIUM',
    confidence: 0.8,
    promise: { kind: 'click', value: 'button' },
    observed: { result: 'no feedback' },
    evidence: {
      consoleErrors: ['Error: something broke']
    },
    impact: 'Click produced no feedback'
  };

  // ACT: Validate
  const result = validateFindingConstitution(finding);
  const sanitized = applyValidationResult(finding, result);

  // ASSERT: Must downgrade to SUSPECTED (no strong categories)
  assert.strictEqual(result.valid, false, 'Should fail validation');
  assert.strictEqual(result.action, 'DOWNGRADE', 'Should downgrade');
  assert.strictEqual(sanitized.status, 'SUSPECTED', 'Status must be SUSPECTED');
  console.log('✓ test_confirmedWithOnlyConsoleErrorsDowngradesToSuspected');
}

function test_confirmedWithBlockedWriteDowngradesToSuspected() {
  // SETUP: CONFIRMED with blockedWrites (weak evidence)
  const finding = {
    id: 'test-2',
    type: 'silent_submission',
    status: 'CONFIRMED',
    severity: 'HIGH',
    confidence: 0.85,
    promise: { kind: 'submit', value: 'form' },
    observed: { result: 'no confirmation' },
    evidence: {
      blockedWrites: true,
      submission_attempted: true
    },
    impact: 'Form submission silent'
  };

  // ACT
  const result = validateFindingConstitution(finding);
  const sanitized = applyValidationResult(finding, result);

  // ASSERT
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.action, 'DOWNGRADE');
  assert.strictEqual(sanitized.status, 'SUSPECTED');
  console.log('✓ test_confirmedWithBlockedWriteDowngradesToSuspected');
}

function test_confirmedWithNavigationEvidenceStaysConfirmed() {
  // SETUP: CONFIRMED with strong navigation evidence
  const finding = {
    id: 'test-3',
    type: 'broken_navigation_promise',
    status: 'CONFIRMED',
    severity: 'HIGH',
    confidence: 0.85,
    promise: { kind: 'navigation', value: '/page' },
    observed: { result: 'URL did not change' },
    evidence: {
      navigationChanged: false,
      intended_destination: '/page'
    },
    impact: 'Navigation promise broken'
  };

  // ACT
  const result = validateFindingConstitution(finding);
  const sanitized = applyValidationResult(finding, result);

  // ASSERT: Should stay CONFIRMED (strong evidence)
  assert.strictEqual(result.valid, true, 'Should pass validation');
  assert.strictEqual(sanitized.status, 'CONFIRMED', 'Should remain CONFIRMED');
  console.log('✓ test_confirmedWithNavigationEvidenceStaysConfirmed');
}

function test_confirmedWithMeaningfulDomChangeStaysConfirmed() {
  // SETUP: CONFIRMED with meaningful_dom evidence
  const finding = {
    id: 'test-4',
    type: 'dead_interaction_silent_failure',
    status: 'CONFIRMED',
    severity: 'MEDIUM',
    confidence: 0.8,
    promise: { kind: 'click', value: 'button' },
    observed: { result: 'no change' },
    evidence: {
      meaningfulDomChange: false,
      action_attempted: true,
      dom_diff: { added: [], removed: [], modified: [] }
    },
    impact: 'Button click had no effect'
  };

  // ACT
  const result = validateFindingConstitution(finding);
  const sanitized = applyValidationResult(finding, result);

  // ASSERT
  assert.strictEqual(result.valid, true);
  assert.strictEqual(sanitized.status, 'CONFIRMED');
  console.log('✓ test_confirmedWithMeaningfulDomChangeStaysConfirmed');
}

function test_confirmedWithNetworkActivityStaysConfirmed() {
  // SETUP: CONFIRMED with network evidence
  const finding = {
    id: 'test-5',
    type: 'silent_submission',
    status: 'CONFIRMED',
    severity: 'HIGH',
    confidence: 0.8,
    promise: { kind: 'submit', value: 'form' },
    observed: { result: 'no feedback' },
    evidence: {
      correlatedNetworkActivity: true,
      network_request: { method: 'POST', status: 200 },
      feedbackSeen: false
    },
    impact: 'Submission silent'
  };

  // ACT
  const result = validateFindingConstitution(finding);
  const sanitized = applyValidationResult(finding, result);

  // ASSERT
  assert.strictEqual(result.valid, true);
  assert.strictEqual(sanitized.status, 'CONFIRMED');
  console.log('✓ test_confirmedWithNetworkActivityStaysConfirmed');
}

function test_confirmedWithFeedbackEvidenceStaysConfirmed() {
  // SETUP: CONFIRMED with feedback evidence
  const finding = {
    id: 'test-6',
    type: 'silent_submission',
    status: 'CONFIRMED',
    severity: 'HIGH',
    confidence: 0.8,
    promise: { kind: 'submit', value: 'form' },
    observed: { result: 'silent' },
    evidence: {
      feedbackSeen: false,
      status_message: 'submitted',
      aria_live: 'polite'
    },
    impact: 'Form silent'
  };

  // ACT
  const result = validateFindingConstitution(finding);
  const sanitized = applyValidationResult(finding, result);

  // ASSERT
  assert.strictEqual(result.valid, true);
  assert.strictEqual(sanitized.status, 'CONFIRMED');
  console.log('✓ test_confirmedWithFeedbackEvidenceStaysConfirmed');
}

// ============================================================================
// B) AMBIGUITY ENGINE TESTS
// ============================================================================

function test_ambiguityReasonsRecordedInEnrichment() {
  // SETUP: Finding with network-only evidence (network is strong but creates ambiguity)
  const finding = {
    id: 'test-7',
    type: 'silent_submission',
    status: 'CONFIRMED',
    severity: 'HIGH',
    confidence: 0.75,
    promise: { kind: 'submit', value: 'form' },
    observed: { result: 'no ui change' },
    evidence: {
      correlatedNetworkActivity: true,
      networkActivity: { method: 'POST', status: 200 }
      // NO navigation, meaningful_dom, or feedback (only network, which IS strong)
    },
    impact: 'Submission unclear',
    enrichment: {}
  };

  // ACT: This will stay CONFIRMED (network is strong) but record ambiguity
  const result = validateFindingConstitution(finding);
  const sanitized = applyValidationResult(finding, result);

  // ASSERT: Should stay CONFIRMED but with ambiguity reason recorded
  assert.strictEqual(result.valid, true, 'Should pass validation (network is strong)');
  assert.strictEqual(sanitized.status, 'CONFIRMED', 'Should stay CONFIRMED');
  assert(Array.isArray(sanitized.enrichment.ambiguityReasons), 'Should have ambiguity reasons');
  assert(sanitized.enrichment.ambiguityReasons.length > 0, 'Should have at least one ambiguity');
  assert(sanitized.enrichment.ambiguityReasons[0].includes('network_only'), 'Should be network_only ambiguity');
  console.log('✓ test_ambiguityReasonsRecordedInEnrichment');
}

function test_blockedWriteAmbiguityRecorded() {
  // SETUP: Finding with blocked_write evidence
  const finding = {
    id: 'test-8',
    type: 'silent_submission',
    status: 'SUSPECTED',
    severity: 'HIGH',
    confidence: 0.7,
    promise: { kind: 'submit', value: 'form' },
    observed: { result: 'blocked' },
    evidence: {
      blockedWrites: true,
      meaningfulDomChange: true
    },
    impact: 'Submission blocked',
    enrichment: {}
  };

  // ACT
  const result = validateFindingConstitution(finding);
  const sanitized = applyValidationResult(finding, result);

  // ASSERT: Should record blocked_write ambiguity
  assert.strictEqual(result.valid, true);
  assert(Array.isArray(sanitized.enrichment.ambiguityReasons), 'Should record ambiguity');
  assert(sanitized.enrichment.ambiguityReasons.some(r => r.includes('blocked_write')), 
    'Should include blocked_write ambiguity');
  console.log('✓ test_blockedWriteAmbiguityRecorded');
}

function test_evidenceCategoriesRecordedInEnrichment() {
  // SETUP: Finding with multiple strong categories
  const finding = {
    id: 'test-9',
    type: 'broken_navigation_promise',
    status: 'CONFIRMED',
    severity: 'HIGH',
    confidence: 0.85,
    promise: { kind: 'navigation', value: '/page' },
    observed: { result: 'no nav' },
    evidence: {
      navigationChanged: false,
      meaningfulDomChange: true,
      feedbackSeen: true
    },
    impact: 'Nav broken',
    enrichment: {}
  };

  // ACT
  const result = validateFindingConstitution(finding);
  const sanitized = applyValidationResult(finding, result);

  // ASSERT: Should record evidence categories
  assert.strictEqual(result.valid, true);
  assert(Array.isArray(sanitized.enrichment.evidenceCategories), 'Should record categories');
  assert(sanitized.enrichment.evidenceCategories.includes('navigation'), 'Should include navigation');
  assert(sanitized.enrichment.evidenceCategories.includes('meaningful_dom'), 'Should include meaningful_dom');
  assert(sanitized.enrichment.evidenceCategories.includes('feedback'), 'Should include feedback');
  console.log('✓ test_evidenceCategoriesRecordedInEnrichment');
}

// ============================================================================
// C) ARTIFACT INTEGRITY TESTS
// ============================================================================

function test_integrityValidationConsistentCounts() {
  // SETUP: Matching summary and findings
  const summary = {
    silentFailures: 2,
    findingsCounts: {
      HIGH: 1,
      MEDIUM: 1,
      LOW: 0
    }
  };

  const findingsData = {
    findings: [
      {
        id: 'f1',
        type: 'broken_navigation_promise',
        status: 'CONFIRMED',
        severity: 'HIGH'
      },
      {
        id: 'f2',
        type: 'dead_interaction_silent_failure',
        status: 'SUSPECTED',
        severity: 'MEDIUM'
      }
    ]
  };

  // ACT
  const report = validateArtifactIntegrity({
    summary,
    findingsData,
    evidenceDir: '/nonexistent' // No evidence refs in this test
  });

  // ASSERT: Should be consistent
  assert.strictEqual(report.consistent, true, 'Counts should match');
  assert.strictEqual(report.severityLevel, 0, 'Should be OK');
  assert.strictEqual(report.shouldMarkIncomplete, false, 'Should not mark incomplete');
  console.log('✓ test_integrityValidationConsistentCounts');
}

function test_integrityValidationCountMismatchCritical() {
  // SETUP: Mismatched counts
  const summary = {
    silentFailures: 5, // Says 5
    findingsCounts: {
      HIGH: 2,
      MEDIUM: 3,
      LOW: 0
    }
  };

  const findingsData = {
    findings: [
      { id: 'f1', severity: 'HIGH', status: 'CONFIRMED' },
      { id: 'f2', severity: 'MEDIUM', status: 'SUSPECTED' }
      // Only 2 findings, but summary says 5!
    ]
  };

  // ACT
  const report = validateArtifactIntegrity({
    summary,
    findingsData,
    evidenceDir: '/nonexistent'
  });

  // ASSERT: Should be critical
  assert.strictEqual(report.consistent, false);
  assert.strictEqual(report.severityLevel, 2, 'Should be CRITICAL');
  assert.strictEqual(report.shouldMarkIncomplete, true, 'Should mark INCOMPLETE');
  assert(report.issues.countMismatches.length > 0, 'Should have count mismatch');
  console.log('✓ test_integrityValidationCountMismatchCritical');
}

function test_integrityFixesDowngradeConfirmedWithMissingEvidence() {
  // SETUP: Findings with some CONFIRMED that need downgrading
  const findings = [
    {
      id: 'f1',
      type: 'broken_navigation_promise',
      status: 'CONFIRMED',
      severity: 'HIGH',
      enrichment: {}
    },
    {
      id: 'f2',
      type: 'silent_submission',
      status: 'SUSPECTED',
      severity: 'HIGH',
      enrichment: {}
    }
  ];

  const requiredDowngrades = [
    { findingId: 'f1', reason: 'Evidence file missing: screenshot.png' }
  ];

  // ACT
  const fixed = applyIntegrityFixes(findings, requiredDowngrades);

  // ASSERT: f1 should be downgraded, f2 unchanged
  assert.strictEqual(fixed[0].status, 'SUSPECTED', 'f1 should be downgraded');
  assert.strictEqual(fixed[0].enrichment.integrityDowngradeReason, 'Evidence file missing: screenshot.png');
  assert.strictEqual(fixed[1].status, 'SUSPECTED', 'f2 should stay SUSPECTED');
  console.log('✓ test_integrityFixesDowngradeConfirmedWithMissingEvidence');
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

export function runEvidenceAndAmbiguityTests() {
  console.log('\n=== EVIDENCE CATEGORIES & AMBIGUITY TESTS ===\n');
  
  // Evidence categories
  test_confirmedWithOnlyConsoleErrorsDowngradesToSuspected();
  test_confirmedWithBlockedWriteDowngradesToSuspected();
  test_confirmedWithNavigationEvidenceStaysConfirmed();
  test_confirmedWithMeaningfulDomChangeStaysConfirmed();
  test_confirmedWithNetworkActivityStaysConfirmed();
  test_confirmedWithFeedbackEvidenceStaysConfirmed();
  
  // Ambiguity engine
  test_ambiguityReasonsRecordedInEnrichment();
  test_blockedWriteAmbiguityRecorded();
  test_evidenceCategoriesRecordedInEnrichment();
  
  // Artifact integrity
  test_integrityValidationConsistentCounts();
  test_integrityValidationCountMismatchCritical();
  test_integrityFixesDowngradeConfirmedWithMissingEvidence();
  
  console.log('\n=== ALL EVIDENCE & AMBIGUITY TESTS PASSED ===\n');
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runEvidenceAndAmbiguityTests();
  } catch (error) {
    console.error('TEST FAILED:', error.message);
    process.exit(1);
  }
}
