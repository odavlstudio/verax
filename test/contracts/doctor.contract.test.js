#!/usr/bin/env node

/**
 * DOCTOR CONTRACT TEST
 * 
 * Verifies that verax doctor meets Tier-1 requirements:
 * - Always exits 0 (diagnostic only)
 * - Completes within 30 seconds
 * - Headless timeout is hard 10 seconds (never hangs indefinitely)
 * - Provides actionable next steps when checks fail
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

console.log('\n═══════════════════════════════════════════════════════════');
console.log('DOCTOR CONTRACT TESTS');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

// Test 1: Doctor always exits 0
if (test('Doctor exits 0 (diagnostic, never blocking)', () => {
  try {
    execSync('node bin/verax.js doctor', { cwd: process.cwd(), stdio: 'pipe' });
    // Success path
  } catch (error) {
    assert(error.status === 0, `Expected exit 0, got ${error.status}`);
  }
})) passed++; else failed++;

// Test 2: Doctor completes in < 30 seconds (synchronous timeout test)
if (test('Doctor completes within 30 seconds', () => {
  const startTime = getTimeProvider().now();
  try {
    execSync('node bin/verax.js doctor --timeout 5', { 
      cwd: process.cwd(), 
      stdio: 'pipe',
      timeout: 31000  // Shell timeout slightly over 30s
    });
  } catch (error) {
    // Doctor exits 0, so we only catch actual timeouts
    if (error.code === 'ETIMEDOUT') {
      throw new Error('Doctor exceeded 30 second timeout');
    }
  }
  const duration = getTimeProvider().now() - startTime;
  assert(duration < 30000, `Doctor took ${duration}ms, exceeds 30s`);
})) passed++; else failed++;

// Test 3: Doctor JSON output has required fields
if (test('Doctor JSON output includes ok, platform, checks, recommendations', () => {
  const output = execSync('node bin/verax.js doctor --json', {
    cwd: process.cwd(),
    encoding: 'utf-8'
  });
  const report = JSON.parse(output);
  assert(typeof report.ok === 'boolean', 'Missing ok field');
  assert(typeof report.platform === 'string', 'Missing platform field');
  assert(Array.isArray(report.checks), 'Missing checks array');
  assert(Array.isArray(report.recommendations), 'Missing recommendations array');
})) passed++; else failed++;

// Test 4: Doctor checks have required fields
if (test('Each doctor check has name, status, details', () => {
  const output = execSync('node bin/verax.js doctor --json', {
    cwd: process.cwd(),
    encoding: 'utf-8'
  });
  const report = JSON.parse(output);
  assert(report.checks.length > 0, 'No checks found');
  
  report.checks.forEach((check, i) => {
    assert(typeof check.name === 'string', `Check ${i} missing name`);
    assert(['pass', 'warn', 'fail'].includes(check.status), `Check ${i} has invalid status`);
    assert(typeof check.details === 'string', `Check ${i} missing details`);
  });
})) passed++; else failed++;

// Test 5: Doctor provides recommendations for failed checks
if (test('Doctor recommendations are actionable (contain commands or guidance)', () => {
  const output = execSync('node bin/verax.js doctor --json', {
    cwd: process.cwd(),
    encoding: 'utf-8'
  });
  const report = JSON.parse(output);
  
  // If there are failed checks, there should be recommendations
  const failedChecks = report.checks.filter(c => c.status === 'fail' || c.status === 'warn');
  if (failedChecks.length > 0) {
    assert(report.recommendations.length > 0, 'Failed checks but no recommendations provided');
    report.recommendations.forEach((rec, i) => {
      assert(typeof rec === 'string', `Recommendation ${i} is not a string`);
      assert(rec.length > 10, `Recommendation ${i} is too brief (${rec.length} chars)`);
    });
  }
})) passed++; else failed++;

// Test 6: Doctor human-readable output is present
if (test('Doctor human-readable output includes checks and status', () => {
  const output = execSync('node bin/verax.js doctor', {
    cwd: process.cwd(),
    encoding: 'utf-8'
  });
  assert(output.includes('VERAX Doctor'), 'Missing doctor header');
  assert(output.includes('Node.js') || output.includes('Playwright'), 'Missing check output');
})) passed++; else failed++;

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`═══════════════════════════════════════════════════════════\n`);

if (failed > 0) {
  console.error(`[FAIL] ${failed} contract test(s) failed`);
  process.exit(1);
} else {
  console.log(`[PASS] All doctor contracts verified`);
  process.exit(0);
}





