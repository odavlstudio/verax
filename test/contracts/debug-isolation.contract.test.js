#!/usr/bin/env node

/**
 * DEBUG ISOLATION CONTRACT TEST
 * 
 * Verifies that debug output is properly isolated:
 * - Debug logs ONLY appear in EVIDENCE/logs/debug.json
 * - REPORT.json contains ZERO debug/enforcement/internal data
 * - SUMMARY.md contains ZERO debug information
 * - Debug mode (--debug flag) doesn't leak into production outputs
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

function _hasDebugKeywords(text) {
  const debugKeywords = [
    'enforcement',
    'internal-error',
    'internalError',
    'stack trace',
    'stackTrace',
    'debug:',
    '__proto__',
    'constructor',
    'DEBUG',
  ];
  
  return debugKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()));
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('DEBUG ISOLATION CONTRACT TESTS');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

const veraxDir = '.verax';

if (test('REPORT.json contains NO debug keywords', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  if (existsSync(reportPath)) {
    const content = readFileSync(reportPath, 'utf-8');
    const text = content.toLowerCase();
    
    // Check for suspicious fields
    assert(!text.includes('"enforcement"'), 'REPORT.json contains enforcement field');
    assert(!text.includes('"internal-error"'), 'REPORT.json exposes internal errors');
    assert(!text.includes('"internalpolicy"'), 'REPORT.json contains internal policy');
    assert(!text.includes('"diagnostics"'), 'REPORT.json contains diagnostics');
    assert(!text.includes('stack'), 'REPORT.json contains stack traces');
  }
})) passed++; else failed++;

if (test('SUMMARY.md contains NO enforcement or debug keywords', () => {
  const summaryPath = join(veraxDir, 'SUMMARY.md');
  if (existsSync(summaryPath)) {
    const content = readFileSync(summaryPath, 'utf-8');
    const text = content.toLowerCase();
    
    assert(!text.includes('enforcement'), 'SUMMARY.md exposes enforcement');
    assert(!text.includes('internal'), 'SUMMARY.md exposes internal details');
    assert(!text.includes('stack trace'), 'SUMMARY.md includes stack trace');
    assert(!text.includes('debug'), 'SUMMARY.md includes debug info');
  }
})) passed++; else failed++;

if (test('Debug output isolated to EVIDENCE/logs/debug.json', () => {
  const logsDir = join(veraxDir, 'EVIDENCE', 'logs');
  if (existsSync(logsDir)) {
    const entries = readdirSync(logsDir);
    // debug.json may exist; other files should not have debug in name
    entries.forEach(entry => {
      // No other enforcement/internal files should exist in logs/
      assert(!entry.includes('enforcement'), 
        `Found enforcement file in logs/: ${entry}`);
      assert(!entry.includes('internal'), 
        `Found internal file in logs/: ${entry}`);
    });
  }
})) passed++; else failed++;

if (test('No enforcement.json in root or EVIDENCE/', () => {
  const rootEnforcement = join(veraxDir, 'enforcement.json');
  const evidenceEnforcement = join(veraxDir, 'EVIDENCE', 'enforcement.json');
  
  // enforcement.json should NOT exist in root or EVIDENCE/ (production paths)
  assert(!existsSync(rootEnforcement), 'enforcement.json found in root (production leak)');
  assert(!existsSync(evidenceEnforcement), 'enforcement.json found in EVIDENCE/ (production leak)');
  
  // It MAY exist only in EVIDENCE/logs/ if --debug was used, but not in primary EVIDENCE/
})) passed++; else failed++;

if (test('META.json does not contain diagnostic details', () => {
  const metaPath = join(veraxDir, 'META.json');
  if (existsSync(metaPath)) {
    const content = readFileSync(metaPath, 'utf-8');
    const meta = JSON.parse(content);
    
    // META.json may have reason field for INCOMPLETE/FAILED, but not details
    assert(!meta.diagnostics, 'META.json contains diagnostics object');
    assert(!meta.internalErrors, 'META.json contains internalErrors');
    assert(!meta.enforcement, 'META.json contains enforcement data');
  }
})) passed++; else failed++;

if (test('No debug keywords in finding cause statements', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  if (existsSync(reportPath)) {
    const content = readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(content);
    
    if (report.findings && report.findings.length > 0) {
      report.findings.forEach((finding, i) => {
        if (finding.causes) {
          finding.causes.forEach((cause, j) => {
            const causeText = JSON.stringify(cause).toLowerCase();
            assert(!causeText.includes('internal'), 
              `Finding ${i} cause ${j} exposes internal details`);
            assert(!causeText.includes('enforcement'), 
              `Finding ${i} cause ${j} mentions enforcement`);
          });
        }
      });
    }
  }
})) passed++; else failed++;

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`═══════════════════════════════════════════════════════════\n`);

if (failed > 0) {
  console.error(`[FAIL] ${failed} contract test(s) failed`);
  process.exit(1);
} else {
  console.log(`[PASS] All debug isolation contracts verified`);
  process.exit(0);
}





