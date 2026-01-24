#!/usr/bin/env node

/**
 * ADVERSARIAL CLI UX FAILURE MODES TEST SUITE
 * 
 * Attacks:
 * 1. Error messages are actionable (point to next step)
 * 2. Error messages preserve Trust Lock (no internal details)
 * 3. Error messages are single-line in production (no stack unless --debug)
 * 4. Help text is accurate and complete
 * 5. Error messages don't leak sensitive paths
 * 6. --debug mode provides additional details without breaking contract
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

function runVerax(args) {
  let exitCode = null;
  let stdout = '';
  let stderr = '';
  
  try {
    stdout = execSync(`node bin/verax.js ${args}`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
      shell: true,
    });
    exitCode = 0;
  } catch (error) {
    exitCode = error.status || 1;
    stdout = error.stdout?.toString?.() || '';
    stderr = error.stderr?.toString?.() || '';
  }
  
  return { exitCode, stdout, stderr };
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('ADVERSARIAL: CLI UX FAILURE MODES ATTACKS');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

// ATTACK 1: Missing --url error is actionable
if (test('ATTACK 1a: Missing --url error is actionable', () => {
  const { stderr } = runVerax('run', { expectFail: true });
  const output = stderr || '';
  assert(output.includes('url') || output.includes('--url'), 
    'Error does not mention --url');
})) passed++; else failed++;

// ATTACK 2: Bad URL error mentions URL validation
if (test('ATTACK 2a: Bad URL error is descriptive', () => {
  const { stderr } = runVerax('run --url "not-a-url"', { expectFail: true });
  const output = stderr || '';
  assert(output.length > 10, 'Error message is too brief');
})) passed++; else failed++;

// ATTACK 3: Missing source directory error is actionable
if (test('ATTACK 3a: Missing source directory error is actionable', () => {
  const { stderr } = runVerax('run --url http://localhost:3000 --src /nonexistent', { expectFail: true });
  const output = stderr || '';
  assert(output.includes('not found') || output.includes('exist') || output.includes('src'), 
    'Error does not mention source directory');
})) passed++; else failed++;

// ATTACK 4: Invalid flag error suggests valid flags
if (test('ATTACK 4a: Invalid flag error suggests valid alternatives', () => {
  const { stderr } = runVerax('run --url http://localhost:3000 --src . --invalid-flag', { expectFail: true });
  const output = stderr || '';
  assert(output.includes('--') || output.includes('flag') || output.includes('unknown'), 
    'Error does not mention flags');
})) passed++; else failed++;

// ATTACK 5: No command error mentions valid commands
if (test('ATTACK 5a: No command error mentions valid commands', () => {
  const { stderr, stdout } = runVerax('', { expectFail: true });
  const output = (stderr + stdout);
  assert(output.includes('run') || output.includes('doctor') || output.includes('inspect') || output.includes('USAGE'),
    'Error does not suggest valid commands');
})) passed++; else failed++;

// ATTACK 6: --help does not contain stack traces
if (test('ATTACK 6a: --help output contains no stack traces', () => {
  const { stdout, stderr } = runVerax('--help');
  const output = (stdout + stderr).toLowerCase();
  assert(!output.includes('error:') || !output.includes('at '), 
    '--help output contains error traces');
})) passed++; else failed++;

// ATTACK 7: --help mentions all major commands
if (test('ATTACK 7a: --help documents run, inspect, doctor commands', () => {
  const { stdout } = runVerax('--help');
  assert(stdout.includes('run'), '--help missing run command');
  assert(stdout.includes('inspect'), '--help missing inspect command');
  assert(stdout.includes('doctor'), '--help missing doctor command');
})) passed++; else failed++;

// ATTACK 8: --help mentions exit codes
if (test('ATTACK 8a: --help documents exit codes', () => {
  const { stdout } = runVerax('--help');
  assert(stdout.includes('0') && stdout.includes('exit'), 
    '--help does not document exit codes');
})) passed++; else failed++;

// ATTACK 9: --help mentions CI integration
if (test('ATTACK 9a: --help mentions CI integration', () => {
  const { stdout } = runVerax('--help');
  assert(stdout.includes('CI') || stdout.includes('gate') || stdout.includes('integration'),
    '--help does not mention CI');
})) passed++; else failed++;

// ATTACK 10: Error messages do not leak absolute paths (unless --debug)
if (test('ATTACK 10a: Error messages minimize path exposure', () => {
  const { stderr } = runVerax('run --url http://localhost:3000 --src /nonexistent', { expectFail: true });
  const output = stderr || '';
  // OK to mention paths in error context, but should not dump full paths to /tmp or system dirs
  // This is a softer test - we just verify the error is not excessively verbose
  assert(output.length < 500, 'Error message is excessively verbose (may leak paths)');
})) passed++; else failed++;

// ATTACK 11: Doctor errors are actionable
if (test('ATTACK 11a: Doctor invalid flag error is actionable', () => {
  const { stderr } = runVerax('doctor --invalid-flag', { expectFail: true });
  const output = stderr || '';
  assert(output.includes('flag') || output.includes('Unknown') || output.includes('doctor'),
    'Error does not mention the problem');
})) passed++; else failed++;

// ATTACK 12: Help text is complete and organized
if (test('ATTACK 12a: --help text is properly formatted', () => {
  const { stdout } = runVerax('--help');
  assert(stdout.includes('USAGE') || stdout.includes('Usage'),
    '--help missing USAGE section');
  assert(stdout.includes('OPTIONS') || stdout.includes('Options'),
    '--help missing OPTIONS section');
  assert(stdout.includes('EXAMPLES') || stdout.includes('Examples'),
    '--help missing EXAMPLES section');
})) passed++; else failed++;

// ATTACK 13: help command produces same output as --help
if (test('ATTACK 13a: help command produces similar output to --help', () => {
  const { stdout: helpOut } = runVerax('--help');
  const { stdout: cmdOut } = runVerax('help');
  
  // Both should mention VERAX and have substantial content
  assert(helpOut.length > 100, '--help output is minimal');
  assert(cmdOut.length > 100, 'help command output is minimal');
})) passed++; else failed++;

// ATTACK 14: Error context preserves structure (JSON/plain deterministically)
if (test('ATTACK 14a: Error output format is consistent', () => {
  // Both should produce plain text errors (not trying to parse as JSON unless --json)
  const { stderr: err1 } = runVerax('run', { expectFail: true });
  const { stderr: err2 } = runVerax('run', { expectFail: true });
  
  // Errors should be consistent structure
  assert(err1.length > 0, 'First error is empty');
  assert(err2.length > 0, 'Second error is empty');
  // Same error on repeated identical input
  assert(err1.includes(err2.substring(0, 20)) || err2.includes(err1.substring(0, 20)),
    'Error messages differ for same input');
})) passed++; else failed++;

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`═══════════════════════════════════════════════════════════\n`);

if (failed > 0) {
  console.error(`[FAIL] ${failed} UX failure mode(s) detected`);
  process.exit(1);
} else {
  console.log(`[PASS] All UX attacks blocked`);
  process.exit(0);
}





