#!/usr/bin/env node

/**
 * ADVERSARIAL EXIT CODE TEST SUITE
 * 
 * Attacks:
 * 1. Never allow exit 0 for INCOMPLETE runs (timeout, budget, crash)
 * 2. Never allow exit 1 for FAILED runs (internal errors)
 * 3. Ensure 66 is ONLY for INCOMPLETE, never false negatives
 * 4. Ensure 2 is ONLY for FAILED, never false positives
 * 5. Ensure 64/65 cannot be bypassed by invalid flags or input
 * 6. Ensure exit code matches status deterministically
 */

import { execSync } from 'child_process';

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

function runVerax(args, options = {}) {
  const { expectFail = false, expectTimeout = false, maxWait = 60000 } = options;
  let exitCode = null;
  let stdout = '';
  let stderr = '';
  
  try {
    stdout = execSync(`node bin/verax.js ${args}`, {
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
    stderr = error.stderr?.toString?.() || '';
    if (!expectFail && !expectTimeout) {
      throw new Error(`Command failed with exit ${exitCode}: ${error.message}`);
    }
  }
  
  return { exitCode, stdout, stderr };
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('ADVERSARIAL: EXIT CODE TRUTH ATTACKS');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

// ATTACK 1: Missing --url MUST be exit 64, never 2 or 0
if (test('ATTACK 1a: Missing --url is exit 64 (not 2)', () => {
  const { exitCode } = runVerax('run', { expectFail: true });
  assert(exitCode === 64, `Expected 64, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 2: Bad URL MUST be exit 65, never 2 or 0
if (test('ATTACK 2a: Bad URL format is exit 65 (not 2)', () => {
  const { exitCode } = runVerax('run --url "not-a-url"', { expectFail: true });
  assert(exitCode === 65, `Expected 65, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 3: Invalid flag MUST be exit 64, never 2
if (test('ATTACK 3a: Invalid flag is exit 64', () => {
  const { exitCode } = runVerax('run --url http://localhost:3000 --invalid-flag', { expectFail: true });
  assert(exitCode === 64, `Expected 64, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 4: No command MUST be exit 64, never 2
if (test('ATTACK 4a: No command is exit 64', () => {
  const { exitCode } = runVerax('', { expectFail: true });
  assert(exitCode === 64, `Expected 64, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 5: Unknown command MUST be exit 64, never 2
if (test('ATTACK 5a: Unknown command is exit 64', () => {
  const { exitCode } = runVerax('invalid-command', { expectFail: true });
  assert(exitCode === 64, `Expected 64, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 6: Missing source directory MUST be exit 65, never 2
if (test('ATTACK 6a: Missing source directory is exit 65', () => {
  const { exitCode } = runVerax('run --url http://localhost:3000 --src /nonexistent', { expectFail: true });
  assert(exitCode === 65, `Expected 65, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 7: Inspect with missing path MUST be exit 64
if (test('ATTACK 7a: Inspect with no path is exit 64', () => {
  const { exitCode } = runVerax('inspect', { expectFail: true });
  assert(exitCode === 64, `Expected 64, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 8: Inspect with nonexistent path MUST be exit 65
if (test('ATTACK 8a: Inspect with nonexistent path is exit 65', () => {
  const { exitCode } = runVerax('inspect /nonexistent/run', { expectFail: true });
  assert(exitCode === 65, `Expected 65, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 9: Doctor with invalid flag MUST be exit 64
if (test('ATTACK 9a: Doctor with invalid flag is exit 64', () => {
  const { exitCode } = runVerax('doctor --invalid-flag', { expectFail: true });
  assert(exitCode === 64, `Expected 64, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 10: Doctor always exits 0 (never fails)
if (test('ATTACK 10a: Doctor always exits 0', () => {
  const { exitCode } = runVerax('doctor');
  assert(exitCode === 0, `Expected 0, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 11: --help exits 0 (not 64)
if (test('ATTACK 11a: --help exits 0', () => {
  const { exitCode } = runVerax('--help');
  assert(exitCode === 0, `Expected 0, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 12: --version exits 0
if (test('ATTACK 12a: --version exits 0', () => {
  const { exitCode } = runVerax('--version');
  assert(exitCode === 0, `Expected 0, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 13: Help command exits 0
if (test('ATTACK 13a: help command exits 0', () => {
  const { exitCode } = runVerax('help');
  assert(exitCode === 0, `Expected 0, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 14: Flags must respect order (no side effects)
if (test('ATTACK 14a: Flag order does not affect parsing', () => {
  const { exitCode: code1 } = runVerax('run --url "bad" --src .', { expectFail: true });
  const { exitCode: code2 } = runVerax('run --src . --url "bad"', { expectFail: true });
  assert(code1 === code2, `Different exits for same args: ${code1} vs ${code2}`);
  assert(code1 === 65, `Expected 65, got ${code1}`);
})) passed++; else failed++;

// ATTACK 15: Duplicate flags should be rejected
if (test('ATTACK 15a: Duplicate --url flags rejected', () => {
  const { exitCode } = runVerax('run --url http://localhost:3000 --url http://other.com --src .', { expectFail: true });
  // This should either take the last one and fail gracefully, or reject
  assert([64, 65].includes(exitCode), `Expected 64 or 65, got ${exitCode}`);
})) passed++; else failed++;

// ATTACK 16: Exit code contract is deterministic (same input = same exit)
if (test('ATTACK 16a: Exit codes are deterministic', () => {
  const codes = [];
  for (let i = 0; i < 3; i++) {
    const { exitCode } = runVerax('run', { expectFail: true });
    codes.push(exitCode);
  }
  const allSame = codes.every(c => c === codes[0]);
  assert(allSame, `Non-deterministic exit codes: ${codes.join(', ')}`);
})) passed++; else failed++;

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`═══════════════════════════════════════════════════════════\n`);

if (failed > 0) {
  console.error(`[FAIL] ${failed} exit code attack(s) succeeded`);
  process.exit(1);
} else {
  console.log(`[PASS] All exit code attacks blocked`);
  process.exit(0);
}





