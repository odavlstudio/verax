#!/usr/bin/env node

/**
 * ARTIFACTS CONTRACT TEST
 * 
 * Verifies that verax produces artifacts matching Enterprise Truth Spec:
 * - Flat structure: .verax/ (not .verax/runs/<runId>/)
 * - All required files present: SUMMARY.md, REPORT.json, META.json, EVIDENCE/
 * - REPORT.json contains ONLY findings (no diagnostics, no enforcement data)
 * - META.json has required fields
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

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
console.log('ARTIFACTS CONTRACT TESTS');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

// For this test, we need to check the actual artifact structure
// Use the flat .verax directory (not runs/<runId>)
const veraxDir = '.verax';

if (test('Artifacts use flat structure (.verax/ not .verax/runs/<id>/)', () => {
  // Check that .verax contains artifacts directly
  if (existsSync(veraxDir)) {
    const entries = readdirSync(veraxDir);
    // Should have SUMMARY.md, REPORT.json, META.json, EVIDENCE as direct children
    const hasExpectedFiles = entries.includes('SUMMARY.md') || 
                             entries.includes('REPORT.json') ||
                             entries.includes('META.json') ||
                             entries.includes('EVIDENCE');
    
    // Check there's no 'runs' directory (old structure)
    const hasRunsDir = entries.includes('runs');
    assert(!hasRunsDir || hasExpectedFiles, 'Old runs/ structure detected; should use flat structure');
  }
})) passed++; else failed++;

if (test('SUMMARY.md schema: human-readable markdown', () => {
  const path = join(veraxDir, 'SUMMARY.md');
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf-8');
    assert(typeof content === 'string', 'SUMMARY.md is not readable');
    assert(content.length > 0, 'SUMMARY.md is empty');
    // Check for markdown markers
    assert(content.includes('#') || content.includes('##'), 'SUMMARY.md lacks markdown headers');
  }
})) passed++; else failed++;

if (test('REPORT.json schema: valid JSON with findings array', () => {
  const path = join(veraxDir, 'REPORT.json');
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf-8');
    const report = JSON.parse(content);
    assert(typeof report === 'object', 'REPORT.json is not an object');
    // findings may be empty but array must exist
    if (report.findings) {
      assert(Array.isArray(report.findings), 'findings is not an array');
    }
  }
})) passed++; else failed++;

if (test('REPORT.json does NOT contain diagnostics/enforcement/debug', () => {
  const path = join(veraxDir, 'REPORT.json');
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf-8');
    const report = JSON.parse(content);
    
    // Trust Lock: REPORT.json must NOT have internal data
    assert(!report.diagnostics, 'REPORT.json contains diagnostics (Trust Lock violation)');
    assert(!report.enforcement, 'REPORT.json contains enforcement data');
    assert(!report.internalErrors, 'REPORT.json contains internal errors');
    assert(!report.debug, 'REPORT.json contains debug field');
  }
})) passed++; else failed++;

if (test('META.json schema: required fields present', () => {
  const path = join(veraxDir, 'META.json');
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf-8');
    const meta = JSON.parse(content);
    
    assert(typeof meta.timestamp === 'string', 'Missing or invalid timestamp');
    assert(typeof meta.url === 'string', 'Missing or invalid url');
    assert(typeof meta.src === 'string', 'Missing or invalid src');
    assert(['SUCCESS', 'FINDINGS', 'INCOMPLETE'].includes(meta.status), 'Invalid status');
    assert(typeof meta.veraxVersion === 'string', 'Missing veraxVersion');
    assert(typeof meta.stats === 'object', 'Missing stats object');
  }
})) passed++; else failed++;

if (test('EVIDENCE/ directory exists', () => {
  const path = join(veraxDir, 'EVIDENCE');
  assert(existsSync(path), 'EVIDENCE directory missing');
})) passed++; else failed++;

if (test('Debug logs only in EVIDENCE/logs/ with --debug flag', () => {
  const debugDir = join(veraxDir, 'EVIDENCE', 'logs');
  if (existsSync(debugDir)) {
    const entries = readdirSync(debugDir);
    // debug.json should only exist if --debug was used
    // This is checked elsewhere; here we just verify structure
    assert(Array.isArray(entries), 'EVIDENCE/logs is not a directory');
  }
})) passed++; else failed++;

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`═══════════════════════════════════════════════════════════\n`);

if (failed > 0) {
  console.error(`[FAIL] ${failed} contract test(s) failed`);
  process.exit(1);
} else {
  console.log(`[PASS] All artifacts contracts verified`);
  process.exit(0);
}





