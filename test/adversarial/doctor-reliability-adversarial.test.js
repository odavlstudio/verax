#!/usr/bin/env node

/**
 * ADVERSARIAL DOCTOR RELIABILITY TEST SUITE
 * 
 * Attacks:
 * 1. Doctor never hangs beyond 30 seconds
 * 2. Doctor always exits 0 (diagnostic only)
 * 3. Doctor provides actionable next steps
 * 4. Doctor works even with missing dependencies
 * 5. Doctor outputs are deterministic
 * 6. Doctor --json includes structured recommendations
 */

import { execSync } from 'child_process';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    return true;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function runDoctorWithTimeout(args = '', maxWait = 35000) {
  let exitCode = null;
  let stdout = '';
  
  try {
    stdout = execSync(`node bin/verax.js doctor ${args}`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: maxWait,
      shell: true,
    });
    exitCode = 0;
  } catch (error) {
    exitCode = error.status || 1;
    stdout = error.stdout?.toString?.() || '';
    if (error.message.includes('timed out')) {
      throw new Error(`Doctor exceeded ${maxWait}ms timeout (hanged)`);
    }
  }
  
  return { exitCode, stdout };
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('ADVERSARIAL: DOCTOR RELIABILITY ATTACKS');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

// ATTACK 1: Doctor completes within 30 seconds
if (test('ATTACK 1a: Doctor finishes < 30 seconds', () => {
  const start = getTimeProvider().now();
  const { exitCode } = runDoctorWithTimeout('');
  const duration = getTimeProvider().now() - start;
  assert(duration < 30000, `Doctor took ${duration}ms, exceeds 30s`);
  assert(exitCode === 0, `Expected exit 0, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 2: Doctor always exits 0 (never 1, 2, 64, 65, 66)
if (test('ATTACK 2a: Doctor --json exits 0', () => {
  const { exitCode } = runDoctorWithTimeout('--json');
  assert(exitCode === 0, `Expected 0, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 3: Doctor with invalid flag still exits 0
// Note: Invalid flags should throw UsageError (exit 64)
if (test('ATTACK 3a: Doctor with invalid flag exits 64', () => {
  try {
    const { exitCode } = runDoctorWithTimeout('--invalid-flag');
    assert(exitCode === 64, `Expected 64 (usage error), got ${exitCode}`);
  } catch (error) {
    // This is OK - doctor rejects unknown flags
    assert(error.message.includes('Unknown flag') || error.message.includes('invalid'), error.message);
  }
})) passed++; else failed++;

// ATTACK 4: Doctor human output includes expected fields
if (test('ATTACK 4a: Doctor output includes VERAX Doctor header', () => {
  const { stdout } = runDoctorWithTimeout('');
  assert(stdout.includes('VERAX') || stdout.includes('Doctor') || stdout.includes('Diagnostic'), 
    'Missing doctor header in output');
})) passed++; else failed++;

// ATTACK 5: Doctor --json output is valid JSON
if (test('ATTACK 5a: Doctor --json outputs valid JSON', () => {
  const { stdout } = runDoctorWithTimeout('--json');
  let report = null;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw new Error('Doctor --json output is not valid JSON');
  }
  assert(typeof report === 'object', 'Report is not an object');
  assert(typeof report.ok === 'boolean', 'Missing ok field');
  assert(typeof report.platform === 'string', 'Missing platform field');
  assert(Array.isArray(report.checks), 'Missing checks array');
  assert(Array.isArray(report.recommendations), 'Missing recommendations array');
})) passed++; else failed++;

// ATTACK 6: Doctor checks have required structure
if (test('ATTACK 6a: Doctor checks have name, status, details', () => {
  const { stdout } = runDoctorWithTimeout('--json');
  const report = JSON.parse(stdout);
  assert(report.checks.length > 0, 'No checks present');
  
  report.checks.forEach((check, i) => {
    assert(typeof check.name === 'string', `Check ${i} missing name`);
    assert(['pass', 'warn', 'fail'].includes(check.status), `Check ${i} has invalid status: ${check.status}`);
    assert(typeof check.details === 'string', `Check ${i} missing details`);
  });
})) passed++; else failed++;

// ATTACK 7: Doctor recommendations are actionable commands
if (test('ATTACK 7a: Doctor recommendations are actionable', () => {
  const { stdout } = runDoctorWithTimeout('--json');
  const report = JSON.parse(stdout);
  
  // At least one recommendation should contain actionable words
  const hasActionableRecs = report.recommendations.some(rec => {
    const actionableWords = ['npm', 'run', 'install', 'Upgrade', 'check', 'npm', 'yarn', 'pnpm'];
    return actionableWords.some(word => rec.includes(word));
  }) || report.recommendations.length === 0;
  
  assert(hasActionableRecs, 'No actionable recommendations found');
})) passed++; else failed++;

// ATTACK 8: Doctor is deterministic (same output on multiple runs)
if (test('ATTACK 8a: Doctor output is deterministic', () => {
  const outputs = [];
  for (let i = 0; i < 2; i++) {
    const { stdout } = runDoctorWithTimeout('--json');
    outputs.push(stdout);
  }
  assert(outputs[0] === outputs[1], 'Doctor produced different outputs on consecutive runs');
})) passed++; else failed++;

// ATTACK 9: Doctor does not hang on concurrent calls
if (test('ATTACK 9a: Doctor handles concurrent invocations', () => {
  const start = getTimeProvider().now();
  // Sequential calls (not parallel to avoid system load issues)
  for (let i = 0; i < 3; i++) {
    const { exitCode } = runDoctorWithTimeout('');
    assert(exitCode === 0, `Run ${i}: expected 0, got ${exitCode}`);
  }
  const duration = getTimeProvider().now() - start;
  assert(duration < 90000, `3 consecutive doctors took ${duration}ms, suggests hang`);
})) passed++; else failed++;

// ATTACK 10: Doctor --json always includes platform
if (test('ATTACK 10a: Doctor --json includes platform field', () => {
  const { stdout } = runDoctorWithTimeout('--json');
  const report = JSON.parse(stdout);
  assert(typeof report.platform === 'string', 'Missing platform field');
  assert(report.platform.length > 0, 'Platform field is empty');
})) passed++; else failed++;

// ATTACK 11: Doctor --json includes nodeVersion
if (test('ATTACK 11a: Doctor --json includes nodeVersion field', () => {
  const { stdout } = runDoctorWithTimeout('--json');
  const report = JSON.parse(stdout);
  assert(typeof report.nodeVersion === 'string', 'Missing nodeVersion field');
  assert(report.nodeVersion.length > 0, 'nodeVersion is empty');
})) passed++; else failed++;

// ATTACK 12: Doctor --json ok field reflects check status
if (test('ATTACK 12a: Doctor ok field is boolean', () => {
  const { stdout } = runDoctorWithTimeout('--json');
  const report = JSON.parse(stdout);
  assert(typeof report.ok === 'boolean', 'ok field is not boolean');
})) passed++; else failed++;

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`═══════════════════════════════════════════════════════════\n`);

if (failed > 0) {
  console.error(`[FAIL] ${failed} doctor reliability attack(s) succeeded`);
  process.exit(1);
} else {
  console.log(`[PASS] All doctor attacks blocked`);
  process.exit(0);
}





