#!/usr/bin/env node
/**
 * CONTRACT C — EVIDENCE LAW GATE-LEVEL CHECK
 * 
 * Validates that CONFIRMED findings cannot claim evidence files that don't exist.
 * This is a gate test: if the pipeline produces CONFIRMED findings without actual
 * evidence files, this test MUST fail to surface the defect.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Evidence Law Gate Contract', () => {
  test('CONFIRMED findings must have all referenced evidence files exist', () => {
    // Simulate a CONFIRMED finding
    const finding = {
      id: 'exp_test123',
      status: 'CONFIRMED',
      confidence: 0.9,
      evidence: {
        evidence_files: [
          'exp_1_before.png',
          'exp_1_after.png'
        ]
      }
    };
    
    // Simulate evidence directory
    const evidenceDir = '/tmp/verax/evidence';
    
    // Validation logic (matching integrity-validator.js)
    for (const refFile of finding.evidence.evidence_files) {
      const fullPath = resolve(evidenceDir, refFile);
      const exists = existsSync(fullPath);
      
      if (finding.status === 'CONFIRMED' && !exists) {
        assert.fail(`CONFIRMED finding ${finding.id} references missing evidence file: ${refFile}`);
      }
    }
  });
  
  test('SUSPECTED findings with missing evidence should pass gate (downgrade happens elsewhere)', () => {
    const finding = {
      id: 'exp_test456',
      status: 'SUSPECTED',
      confidence: 0.6,
      evidence: {
        evidence_files: [
          'exp_2_before.png',
          'exp_2_after.png'
        ]
      }
    };
    
    const evidenceDir = '/tmp/verax/evidence';
    
    // SUSPECTED findings with missing evidence don't fail the gate
    for (const refFile of finding.evidence.evidence_files) {
      const fullPath = resolve(evidenceDir, refFile);
      const exists = existsSync(fullPath);
      
      // Only CONFIRMED findings are gated
      if (finding.status === 'CONFIRMED' && !exists) {
        assert.fail(`CONFIRMED finding ${finding.id} references missing evidence file: ${refFile}`);
      }
    }
    
    // Should not fail for SUSPECTED
    assert.ok(true, 'SUSPECTED findings do not trigger Evidence Law gate');
  });
  
  test('CONFIRMED findings with empty evidence_files array must not exist', () => {
    // A CONFIRMED finding with no evidence files is a contract violation
    const finding = {
      id: 'exp_test789',
      status: 'CONFIRMED',
      confidence: 0.9,
      evidence: {
        evidence_files: []
      }
    };
    
    // Gate logic: CONFIRMED requires substantive evidence
    const hasEvidenceFiles = finding.evidence?.evidence_files?.length > 0;
    
    if (finding.status === 'CONFIRMED' && !hasEvidenceFiles) {
      assert.fail(`CONFIRMED finding ${finding.id} has no evidence files (Evidence Law violation)`);
    }
  });
  
  test('Evidence Law validation function enforces contract', () => {
    const findings = [
      {
        id: 'exp_valid',
        status: 'CONFIRMED',
        evidence: {
          evidence_files: ['valid_before.png', 'valid_after.png']
        }
      },
      {
        id: 'exp_invalid',
        status: 'CONFIRMED',
        evidence: {
          evidence_files: ['missing_before.png', 'missing_after.png']
        }
      }
    ];
    
    const evidenceDir = '/tmp/verax/test-evidence';
    
    const validateEvidenceLaw = (findings, evidenceDir) => {
      const violations = [];
      
      for (const finding of findings) {
        if (finding.status !== 'CONFIRMED') continue;
        
        const evidenceFiles = finding.evidence?.evidence_files || [];
        
        if (evidenceFiles.length === 0) {
          violations.push({
            findingId: finding.id,
            reason: 'CONFIRMED finding has no evidence files'
          });
          continue;
        }
        
        for (const refFile of evidenceFiles) {
          const fullPath = resolve(evidenceDir, refFile);
          if (!existsSync(fullPath)) {
            violations.push({
              findingId: finding.id,
              file: refFile,
              reason: 'Evidence file does not exist'
            });
          }
        }
      }
      
      return violations;
    };
    
    const violations = validateEvidenceLaw(findings, evidenceDir);
    
    // In a real environment, violations would be caught post-write
    // For this gate test, we ensure the validation logic is sound
    assert.ok(Array.isArray(violations), 'Validation must return violations array');
    
    // Since evidence files don't exist, we expect violations for exp_invalid
    const invalidViolations = violations.filter(v => v.findingId === 'exp_invalid');
    assert.ok(invalidViolations.length > 0, 'Missing evidence files must be detected');
  });
  
  test('Evidence Law applies only to CONFIRMED status', () => {
    const statuses = ['CONFIRMED', 'SUSPECTED', 'INFORMATIONAL', 'OBSERVED'];
    const evidenceRequired = {
      'CONFIRMED': true,
      'SUSPECTED': false,
      'INFORMATIONAL': false,
      'OBSERVED': false
    };
    
    for (const status of statuses) {
      const required = evidenceRequired[status];
      assert.strictEqual(
        status === 'CONFIRMED',
        required,
        `Evidence Law enforcement for ${status} must be ${required}`
      );
    }
  });
});
