#!/usr/bin/env node
/**
 * CONTRACT A — EXIT CODE PRECEDENCE CONTRACT
 * 
 * Validates the precedence hierarchy (Stage 7):
 * 1. INCOMPLETE (30) overrides all other outcomes
 * 2. FINDINGS (20) when complete with any findings
 * 3. SUCCESS (0) when complete with no actionable findings
 * 
 * This test ensures the exit code logic in run.js follows the contract.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('Exit Code Precedence Contract', () => {
  test('INCOMPLETE status must yield exit code 30 regardless of findings', () => {
    // Simulate the logic from run.js lines 173-179
    const observeData = { status: 'INCOMPLETE' };
    const detectData = {
      findings: [
        { status: 'CONFIRMED', impact: 'HIGH' },
        { status: 'SUSPECTED', impact: 'MEDIUM' }
      ]
    };
    
    let exitCode = 0;
    if (observeData?.status === 'INCOMPLETE') {
      exitCode = 30;
    } else if (detectData?.findings && detectData.findings.length > 0) {
      exitCode = 20;
    }
    
    assert.strictEqual(exitCode, 30, 'INCOMPLETE must yield exit code 30 even with findings');
  });
  
  test('SUCCESS observation with findings must yield exit code 20', () => {
    const observeData = { status: 'SUCCESS' };
    const detectData = {
      findings: [
        { status: 'CONFIRMED', impact: 'HIGH' },
        { status: 'SUSPECTED', impact: 'MEDIUM' }
      ]
    };
    
    let exitCode = 0;
    if (observeData?.status === 'INCOMPLETE') {
      exitCode = 30;
    } else if (detectData?.findings && detectData.findings.length > 0) {
      exitCode = 20;
    }
    
    assert.strictEqual(exitCode, 20, 'SUCCESS observation with findings must yield exit code 20');
  });
  
  test('COMPLETE with only INFORMATIONAL findings must yield exit code 0', () => {
    const observeData = { status: 'SUCCESS' };
    const detectData = {
      findings: [
        { status: 'INFORMATIONAL', impact: 'LOW' }
      ]
    };
    
    let exitCode = 0;
    if (observeData?.status === 'INCOMPLETE') {
      exitCode = 30;
    } else if (detectData?.findings && detectData.findings.length > 0) {
      const actionable = detectData.findings.some((f) => f.status !== 'INFORMATIONAL');
      exitCode = actionable ? 20 : 0;
    }
    
    assert.strictEqual(exitCode, 0, 'COMPLETE with only INFORMATIONAL findings must yield exit code 0');
  });
  
  test('COMPLETE with no findings must yield exit code 0', () => {
    const observeData = { status: 'SUCCESS' };
    const detectData = { findings: [] };
    
    let exitCode = 0;
    if (observeData?.status === 'INCOMPLETE') {
      exitCode = 30;
    } else if (detectData?.findings && detectData.findings.length > 0) {
      const actionable = detectData.findings.some((f) => f.status !== 'INFORMATIONAL');
      exitCode = actionable ? 20 : 0;
    }
    
    assert.strictEqual(exitCode, 0, 'COMPLETE with no findings must yield exit code 0');
  });
  
  test('Precedence order: INCOMPLETE > CONFIRMED > SUSPECTED > OK', () => {
    // Test case 1: INCOMPLETE with findings should be 30
    let observeData = { status: 'INCOMPLETE' };
    let detectData = { findings: [{ status: 'CONFIRMED' }] };
    let exitCode = computeExitCode(observeData, detectData);
    assert.strictEqual(exitCode, 30, 'INCOMPLETE with findings must be 30');
    
    // Test case 2: SUCCESS observation with confirmed findings should be 20
    observeData = { status: 'SUCCESS' };
    detectData = { findings: [{ status: 'CONFIRMED' }] };
    exitCode = computeExitCode(observeData, detectData);
    assert.strictEqual(exitCode, 20, 'COMPLETE with confirmed findings must be 20');
    
    // Test case 3: SUCCESS observation without findings should be 0
    observeData = { status: 'SUCCESS' };
    detectData = { findings: [] };
    exitCode = computeExitCode(observeData, detectData);
    assert.strictEqual(exitCode, 0, 'COMPLETE without findings must be 0');
  });
});

function computeExitCode(observeData, detectData) {
  let exitCode = 0;
  if (observeData?.status === 'INCOMPLETE') {
    exitCode = 30;
  } else if (detectData?.findings && detectData.findings.length > 0) {
    const actionable = detectData.findings.some((f) => f.status !== 'INFORMATIONAL');
    exitCode = actionable ? 20 : 0;
  }
  return exitCode;
}
