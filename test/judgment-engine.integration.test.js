/**
 * STAGE 4: Detection & Judgment Engine 2.0 - Comprehensive Tests
 * 
 * Tests all judgment engine components:
 * - Outcome → Judgment mapping
 * - Judgment object creation
 * - Evidence law enforcement
 * - Severity mapping
 * - Exit code contract
 * - Determinism lock
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// STAGE 4 modules
import { 
  JUDGMENT_TYPES, 
  mapOutcomeToJudgment 
} from '../src/verax/detect/judgment-mapper.js';

import { 
  createJudgment, 
  generateDeterminismHash 
} from '../src/verax/detect/judgment-builder.js';

import { 
  enforceEvidenceLaw,
  EvidenceLawViolation 
} from '../src/verax/detect/evidence-law-enforcer.js';

import { 
  SEVERITY_LEVELS,
  deriveSeverity 
} from '../src/verax/detect/severity-mapper.js';

import { 
  EXIT_CODES,
  determineExitCode,
  countJudgmentTypes 
} from '../src/verax/detect/exit-code-mapper.js';

import { 
  sortJudgmentsDeterministically,
  generateJudgmentArrayHash,
  areJudgmentArraysEquivalent,
  verifyDeterminismContract,
  createJudgmentSnapshot 
} from '../src/verax/detect/determinism-lock.js';

// STAGE 3 modules (dependencies)
import { OUTCOME_TYPES } from '../src/cli/util/observation/outcome-truth-matrix.js';
import { ACKNOWLEDGMENT_LEVELS } from '../src/cli/util/observation/progressive-acknowledgment.js';
import { SILENCE_KINDS } from '../src/cli/util/observation/silence-classifier.js';

describe('STAGE 4.1: Outcome → Judgment Mapping', () => {
  it('maps success → PASS', () => {
    const judgment = mapOutcomeToJudgment(OUTCOME_TYPES.SUCCESS);
    assert.equal(judgment, JUDGMENT_TYPES.PASS);
  });

  it('maps partial_success → WEAK_PASS', () => {
    const judgment = mapOutcomeToJudgment(OUTCOME_TYPES.PARTIAL_SUCCESS);
    assert.equal(judgment, JUDGMENT_TYPES.WEAK_PASS);
  });

  it('maps misleading → FAILURE_MISLEADING', () => {
    const judgment = mapOutcomeToJudgment(OUTCOME_TYPES.MISLEADING);
    assert.equal(judgment, JUDGMENT_TYPES.FAILURE_MISLEADING);
  });

  it('maps silent_failure → FAILURE_SILENT', () => {
    const judgment = mapOutcomeToJudgment(OUTCOME_TYPES.SILENT_FAILURE);
    assert.equal(judgment, JUDGMENT_TYPES.FAILURE_SILENT);
  });

  it('maps ambiguous → NEEDS_REVIEW', () => {
    const judgment = mapOutcomeToJudgment(OUTCOME_TYPES.AMBIGUOUS);
    assert.equal(judgment, JUDGMENT_TYPES.NEEDS_REVIEW);
  });

  it('throws on unknown outcome', () => {
    assert.throws(() => {
      mapOutcomeToJudgment('UNKNOWN');
    }, /Unknown outcome/);
  });
});

describe('STAGE 4.2: Judgment Object Creation', () => {
  it('creates judgment with determinismHash', () => {
    const promiseCapture = {
      id: 'p-001',
      promiseKind: 'navigate',
      intent: 'Navigate to /dashboard',
    };

    const observation = {
      outcome: OUTCOME_TYPES.SUCCESS,
      acknowledgmentLevel: ACKNOWLEDGMENT_LEVELS.STRONG,
      silenceKind: SILENCE_KINDS.NONE,
      signals: ['navigation', 'content'],
    };

    const judgment = createJudgment(promiseCapture, observation);

    assert.ok(judgment.id);
    assert.equal(judgment.promiseId, 'p-001');
    assert.equal(judgment.promiseKind, 'navigate');
    assert.equal(judgment.outcome, OUTCOME_TYPES.SUCCESS);
    assert.equal(judgment.judgment, JUDGMENT_TYPES.PASS);
    assert.equal(judgment.severity, SEVERITY_LEVELS.CRITICAL);
    assert.ok(judgment.determinismHash);
    assert.ok(judgment.reason);
    assert.ok(Array.isArray(judgment.evidenceRefs));
  });

  it('generates same determinismHash for identical evidence', () => {
    const evidence1 = { outcome: 'success', signals: ['a', 'b'] };
    const evidence2 = { outcome: 'success', signals: ['a', 'b'] };

    const hash1 = generateDeterminismHash(evidence1);
    const hash2 = generateDeterminismHash(evidence2);

    assert.equal(hash1, hash2);
  });

  it('generates different determinismHash for different evidence', () => {
    const evidence1 = { outcome: 'success', signals: ['a', 'b'] };
    const evidence2 = { outcome: 'success', signals: ['a', 'c'] };

    const hash1 = generateDeterminismHash(evidence1);
    const hash2 = generateDeterminismHash(evidence2);

    assert.notEqual(hash1, hash2);
  });
});

describe('STAGE 4.3: Evidence Law Enforcement', () => {
  it('allows FAILURE_SILENT with strong acknowledgment', () => {
    const observation = {
      acknowledgmentLevel: ACKNOWLEDGMENT_LEVELS.STRONG,
      silenceKind: SILENCE_KINDS.UNRECOVERABLE,
      signals: ['error', 'no_navigation'],
    };

    assert.doesNotThrow(() => {
      enforceEvidenceLaw(JUDGMENT_TYPES.FAILURE_SILENT, observation);
    });
  });

  it('throws for FAILURE_SILENT without strong evidence', () => {
    const observation = {
      acknowledgmentLevel: ACKNOWLEDGMENT_LEVELS.WEAK,
      silenceKind: SILENCE_KINDS.UNRECOVERABLE,
    };

    assert.throws(() => {
      enforceEvidenceLaw(JUDGMENT_TYPES.FAILURE_SILENT, observation);
    }, EvidenceLawViolation);
  });

  it('throws for FAILURE_SILENT with recoverable silence', () => {
    const observation = {
      acknowledgmentLevel: ACKNOWLEDGMENT_LEVELS.STRONG,
      silenceKind: SILENCE_KINDS.RECOVERABLE,
    };

    assert.throws(() => {
      enforceEvidenceLaw(JUDGMENT_TYPES.FAILURE_SILENT, observation);
    }, /Recoverable silence cannot be FAILURE_SILENT/);
  });

  it('allows FAILURE_MISLEADING with strong ack + error', () => {
    const observation = {
      acknowledgmentLevel: ACKNOWLEDGMENT_LEVELS.STRONG,
      signals: ['navigation', 'error'],
    };

    assert.doesNotThrow(() => {
      enforceEvidenceLaw(JUDGMENT_TYPES.FAILURE_MISLEADING, observation);
    });
  });

  it('throws for FAILURE_MISLEADING without contradiction', () => {
    const observation = {
      acknowledgmentLevel: ACKNOWLEDGMENT_LEVELS.STRONG,
      signals: ['navigation'],
    };

    assert.throws(() => {
      enforceEvidenceLaw(JUDGMENT_TYPES.FAILURE_MISLEADING, observation);
    }, /No contradiction found/);
  });

  it('allows PASS and WEAK_PASS without restrictions', () => {
    const observation = {
      acknowledgmentLevel: ACKNOWLEDGMENT_LEVELS.WEAK,
    };

    assert.doesNotThrow(() => {
      enforceEvidenceLaw(JUDGMENT_TYPES.PASS, observation);
      enforceEvidenceLaw(JUDGMENT_TYPES.WEAK_PASS, observation);
    });
  });
});

describe('STAGE 4.4: Severity Mapping', () => {
  it('derives CRITICAL for navigate + FAILURE_SILENT', () => {
    const severity = deriveSeverity(JUDGMENT_TYPES.FAILURE_SILENT, 'navigate');
    assert.equal(severity, SEVERITY_LEVELS.CRITICAL);
  });

  it('derives CRITICAL for submit + FAILURE_MISLEADING', () => {
    const severity = deriveSeverity(JUDGMENT_TYPES.FAILURE_MISLEADING, 'submit');
    assert.equal(severity, SEVERITY_LEVELS.CRITICAL);
  });

  it('derives HIGH for feedback + FAILURE_SILENT', () => {
    const severity = deriveSeverity(JUDGMENT_TYPES.FAILURE_SILENT, 'feedback');
    assert.equal(severity, SEVERITY_LEVELS.HIGH);
  });

  it('derives MEDIUM for read + FAILURE_SILENT', () => {
    const severity = deriveSeverity(JUDGMENT_TYPES.FAILURE_SILENT, 'read');
    assert.equal(severity, SEVERITY_LEVELS.MEDIUM);
  });

  it('derives LOW for read + WEAK_PASS', () => {
    const severity = deriveSeverity(JUDGMENT_TYPES.WEAK_PASS, 'read');
    assert.equal(severity, SEVERITY_LEVELS.LOW);
  });

  it('derives CRITICAL for auth + any failure', () => {
    const severity1 = deriveSeverity(JUDGMENT_TYPES.FAILURE_SILENT, 'auth');
    const severity2 = deriveSeverity(JUDGMENT_TYPES.FAILURE_MISLEADING, 'auth');
    
    assert.equal(severity1, SEVERITY_LEVELS.CRITICAL);
    assert.equal(severity2, SEVERITY_LEVELS.CRITICAL);
  });
});

describe('STAGE 4.5: Exit Code Contract', () => {
  it('returns 0 for all PASS judgments', () => {
    const judgments = [
      { judgment: JUDGMENT_TYPES.PASS },
      { judgment: JUDGMENT_TYPES.PASS },
    ];

    const exitCode = determineExitCode(judgments);
    assert.equal(exitCode, EXIT_CODES.SUCCESS);
  });

  it('returns 0 for all WEAK_PASS judgments', () => {
    const judgments = [
      { judgment: JUDGMENT_TYPES.WEAK_PASS },
      { judgment: JUDGMENT_TYPES.WEAK_PASS },
    ];

    const exitCode = determineExitCode(judgments);
    assert.equal(exitCode, EXIT_CODES.SUCCESS);
  });

  it('returns 10 for NEEDS_REVIEW only', () => {
    const judgments = [
      { judgment: JUDGMENT_TYPES.NEEDS_REVIEW },
    ];

    const exitCode = determineExitCode(judgments);
    assert.equal(exitCode, EXIT_CODES.NEEDS_REVIEW);
  });

  it('returns 20 for FAILURE_SILENT present', () => {
    const judgments = [
      { judgment: JUDGMENT_TYPES.PASS },
      { judgment: JUDGMENT_TYPES.FAILURE_SILENT },
    ];

    const exitCode = determineExitCode(judgments);
    assert.equal(exitCode, EXIT_CODES.FAILURE_SILENT);
  });

  it('returns 30 for FAILURE_MISLEADING present', () => {
    const judgments = [
      { judgment: JUDGMENT_TYPES.PASS },
      { judgment: JUDGMENT_TYPES.FAILURE_MISLEADING },
    ];

    const exitCode = determineExitCode(judgments);
    assert.equal(exitCode, EXIT_CODES.FAILURE_MISLEADING);
  });

  it('returns 30 for both MISLEADING and SILENT (MISLEADING has priority)', () => {
    const judgments = [
      { judgment: JUDGMENT_TYPES.FAILURE_SILENT },
      { judgment: JUDGMENT_TYPES.FAILURE_MISLEADING },
    ];

    const exitCode = determineExitCode(judgments);
    assert.equal(exitCode, EXIT_CODES.FAILURE_MISLEADING);
  });

  it('returns 40 for infra failure', () => {
    const exitCode = determineExitCode([], { infraFailure: true });
    assert.equal(exitCode, EXIT_CODES.INFRA_FAILURE);
  });

  it('returns 50 for evidence law violation', () => {
    const exitCode = determineExitCode([], { evidenceLawViolated: true });
    assert.equal(exitCode, EXIT_CODES.EVIDENCE_LAW_VIOLATED);
  });

  it('respects precedence: 50 > 40 > 30 > 20 > 10 > 0', () => {
    // Evidence law > infra
    assert.equal(
      determineExitCode([], { evidenceLawViolated: true, infraFailure: true }),
      EXIT_CODES.EVIDENCE_LAW_VIOLATED
    );

    // Infra > misleading
    assert.equal(
      determineExitCode([{ judgment: JUDGMENT_TYPES.FAILURE_MISLEADING }], { infraFailure: true }),
      EXIT_CODES.INFRA_FAILURE
    );

    // Misleading > silent
    assert.equal(
      determineExitCode([
        { judgment: JUDGMENT_TYPES.FAILURE_SILENT },
        { judgment: JUDGMENT_TYPES.FAILURE_MISLEADING },
      ]),
      EXIT_CODES.FAILURE_MISLEADING
    );

    // Silent > review
    assert.equal(
      determineExitCode([
        { judgment: JUDGMENT_TYPES.NEEDS_REVIEW },
        { judgment: JUDGMENT_TYPES.FAILURE_SILENT },
      ]),
      EXIT_CODES.FAILURE_SILENT
    );

    // Review > success
    assert.equal(
      determineExitCode([
        { judgment: JUDGMENT_TYPES.PASS },
        { judgment: JUDGMENT_TYPES.NEEDS_REVIEW },
      ]),
      EXIT_CODES.NEEDS_REVIEW
    );
  });

  it('counts judgment types correctly', () => {
    const judgments = [
      { judgment: JUDGMENT_TYPES.PASS },
      { judgment: JUDGMENT_TYPES.PASS },
      { judgment: JUDGMENT_TYPES.WEAK_PASS },
      { judgment: JUDGMENT_TYPES.FAILURE_SILENT },
    ];

    const counts = countJudgmentTypes(judgments);
    
    assert.equal(counts[JUDGMENT_TYPES.PASS], 2);
    assert.equal(counts[JUDGMENT_TYPES.WEAK_PASS], 1);
    assert.equal(counts[JUDGMENT_TYPES.FAILURE_SILENT], 1);
    assert.equal(counts[JUDGMENT_TYPES.NEEDS_REVIEW], 0);
  });
});

describe('STAGE 4.6: Determinism Lock', () => {
  it('sorts judgments deterministically by promiseId', () => {
    const judgments = [
      { promiseId: 'p-003', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'aaa' },
      { promiseId: 'p-001', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'bbb' },
      { promiseId: 'p-002', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'ccc' },
    ];

    const sorted = sortJudgmentsDeterministically(judgments);

    assert.equal(sorted[0].promiseId, 'p-001');
    assert.equal(sorted[1].promiseId, 'p-002');
    assert.equal(sorted[2].promiseId, 'p-003');
  });

  it('sorts by judgment severity within same promiseId', () => {
    const judgments = [
      { promiseId: 'p-001', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'aaa' },
      { promiseId: 'p-001', judgment: JUDGMENT_TYPES.FAILURE_SILENT, severity: SEVERITY_LEVELS.CRITICAL, determinismHash: 'bbb' },
      { promiseId: 'p-001', judgment: JUDGMENT_TYPES.NEEDS_REVIEW, severity: SEVERITY_LEVELS.MEDIUM, determinismHash: 'ccc' },
    ];

    const sorted = sortJudgmentsDeterministically(judgments);

    assert.equal(sorted[0].judgment, JUDGMENT_TYPES.FAILURE_SILENT);
    assert.equal(sorted[1].judgment, JUDGMENT_TYPES.NEEDS_REVIEW);
    assert.equal(sorted[2].judgment, JUDGMENT_TYPES.PASS);
  });

  it('generates same hash for identical judgment arrays', () => {
    const judgments1 = [
      { promiseId: 'p-001', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'aaa' },
      { promiseId: 'p-002', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'bbb' },
    ];

    const judgments2 = [
      { promiseId: 'p-002', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'bbb' },
      { promiseId: 'p-001', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'aaa' },
    ];

    const hash1 = generateJudgmentArrayHash(judgments1);
    const hash2 = generateJudgmentArrayHash(judgments2);

    assert.equal(hash1, hash2);
  });

  it('generates different hash for different judgment arrays', () => {
    const judgments1 = [
      { promiseId: 'p-001', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'aaa' },
    ];

    const judgments2 = [
      { promiseId: 'p-001', judgment: JUDGMENT_TYPES.FAILURE_SILENT, severity: SEVERITY_LEVELS.CRITICAL, determinismHash: 'bbb' },
    ];

    const hash1 = generateJudgmentArrayHash(judgments1);
    const hash2 = generateJudgmentArrayHash(judgments2);

    assert.notEqual(hash1, hash2);
  });

  it('detects equivalent judgment arrays', () => {
    const judgments1 = [
      { promiseId: 'p-001', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'aaa' },
    ];

    const judgments2 = [
      { promiseId: 'p-001', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'aaa' },
    ];

    assert.ok(areJudgmentArraysEquivalent(judgments1, judgments2));
  });

  it('detects non-equivalent judgment arrays', () => {
    const judgments1 = [
      { promiseId: 'p-001', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'aaa' },
    ];

    const judgments2 = [
      { promiseId: 'p-002', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'bbb' },
    ];

    assert.ok(!areJudgmentArraysEquivalent(judgments1, judgments2));
  });

  it('verifies determinism contract - valid judgments', () => {
    const judgments = [
      { 
        id: 'j-001',
        promiseId: 'p-001', 
        judgment: JUDGMENT_TYPES.PASS, 
        severity: SEVERITY_LEVELS.LOW, 
        determinismHash: 'a'.repeat(64),
      },
    ];

    assert.doesNotThrow(() => {
      verifyDeterminismContract(judgments);
    });
  });

  it('verifies determinism contract - throws for missing hash', () => {
    const judgments = [
      { 
        id: 'j-001',
        promiseId: 'p-001', 
        judgment: JUDGMENT_TYPES.PASS, 
        severity: SEVERITY_LEVELS.LOW, 
        // Missing determinismHash
      },
    ];

    assert.throws(() => {
      verifyDeterminismContract(judgments);
    }, /missing determinismHash/);
  });

  it('verifies determinism contract - throws for invalid hash', () => {
    const judgments = [
      { 
        id: 'j-001',
        promiseId: 'p-001', 
        judgment: JUDGMENT_TYPES.PASS, 
        severity: SEVERITY_LEVELS.LOW, 
        determinismHash: 'invalid',
      },
    ];

    assert.throws(() => {
      verifyDeterminismContract(judgments);
    }, /Invalid determinismHash format/);
  });

  it('verifies determinism contract - throws for duplicate promiseIds', () => {
    const judgments = [
      { 
        id: 'j-001',
        promiseId: 'p-001', 
        judgment: JUDGMENT_TYPES.PASS, 
        severity: SEVERITY_LEVELS.LOW, 
        determinismHash: 'a'.repeat(64),
      },
      { 
        id: 'j-002',
        promiseId: 'p-001', // Duplicate
        judgment: JUDGMENT_TYPES.PASS, 
        severity: SEVERITY_LEVELS.LOW, 
        determinismHash: 'b'.repeat(64),
      },
    ];

    assert.throws(() => {
      verifyDeterminismContract(judgments);
    }, /Duplicate promiseId/);
  });

  it('creates judgment snapshot with hash and counts', () => {
    const judgments = [
      { promiseId: 'p-001', judgment: JUDGMENT_TYPES.PASS, severity: SEVERITY_LEVELS.LOW, determinismHash: 'aaa' },
      { promiseId: 'p-002', judgment: JUDGMENT_TYPES.FAILURE_SILENT, severity: SEVERITY_LEVELS.CRITICAL, determinismHash: 'bbb' },
    ];

    const snapshot = createJudgmentSnapshot(judgments);

    assert.ok(snapshot.hash);
    assert.equal(snapshot.totalCount, 2);
    assert.equal(snapshot.countsByType[JUDGMENT_TYPES.PASS], 1);
    assert.equal(snapshot.countsByType[JUDGMENT_TYPES.FAILURE_SILENT], 1);
    assert.equal(snapshot.countsBySeverity[SEVERITY_LEVELS.LOW], 1);
    assert.equal(snapshot.countsBySeverity[SEVERITY_LEVELS.CRITICAL], 1);
    assert.ok(Array.isArray(snapshot.judgments));
  });
});

describe('STAGE 4: End-to-End Integration', () => {
  it('processes complete judgment pipeline', () => {
    // 1. Create promise capture
    const promiseCapture = {
      id: 'p-001',
      promiseKind: 'navigate',
      intent: 'Navigate to /dashboard',
    };

    // 2. Create observation (STAGE 3 output)
    const observation = {
      outcome: OUTCOME_TYPES.SILENT_FAILURE,
      acknowledgmentLevel: ACKNOWLEDGMENT_LEVELS.STRONG,
      silenceKind: SILENCE_KINDS.UNRECOVERABLE,
      signals: ['error', 'no_navigation'],
    };

    // 3. Create judgment (STAGE 4)
    const judgment = createJudgment(promiseCapture, observation);

    // 4. Verify judgment
    assert.equal(judgment.outcome, OUTCOME_TYPES.SILENT_FAILURE);
    assert.equal(judgment.judgment, JUDGMENT_TYPES.FAILURE_SILENT);
    assert.equal(judgment.severity, SEVERITY_LEVELS.CRITICAL);
    assert.ok(judgment.determinismHash);

    // 5. Verify evidence law
    assert.doesNotThrow(() => {
      enforceEvidenceLaw(judgment.judgment, observation);
    });

    // 6. Determine exit code
    const exitCode = determineExitCode([judgment]);
    assert.equal(exitCode, EXIT_CODES.FAILURE_SILENT);

    // 7. Verify determinism
    assert.doesNotThrow(() => {
      verifyDeterminismContract([judgment]);
    });
  });

  it('handles multiple judgments with deterministic ordering', () => {
    const judgments = [
      createJudgment(
        { id: 'p-003', promiseKind: 'read', intent: 'Read data' },
        { outcome: OUTCOME_TYPES.SUCCESS, acknowledgmentLevel: ACKNOWLEDGMENT_LEVELS.STRONG, signals: [] }
      ),
      createJudgment(
        { id: 'p-001', promiseKind: 'navigate', intent: 'Navigate' },
        { outcome: OUTCOME_TYPES.SILENT_FAILURE, acknowledgmentLevel: ACKNOWLEDGMENT_LEVELS.STRONG, silenceKind: SILENCE_KINDS.UNRECOVERABLE, signals: ['error'] }
      ),
      createJudgment(
        { id: 'p-002', promiseKind: 'submit', intent: 'Submit form' },
        { outcome: OUTCOME_TYPES.MISLEADING, acknowledgmentLevel: ACKNOWLEDGMENT_LEVELS.STRONG, signals: ['navigation', 'error'] }
      ),
    ];

    // Sort deterministically
    const sorted = sortJudgmentsDeterministically(judgments);
    
    // Verify order: p-001, p-002, p-003
    assert.equal(sorted[0].promiseId, 'p-001');
    assert.equal(sorted[1].promiseId, 'p-002');
    assert.equal(sorted[2].promiseId, 'p-003');

    // Verify determinism
    verifyDeterminismContract(sorted);

    // Create snapshot
    const snapshot = createJudgmentSnapshot(sorted);
    assert.equal(snapshot.totalCount, 3);

    // Determine exit code (FAILURE_MISLEADING has highest priority)
    const exitCode = determineExitCode(sorted);
    assert.equal(exitCode, EXIT_CODES.FAILURE_MISLEADING);
  });
});
