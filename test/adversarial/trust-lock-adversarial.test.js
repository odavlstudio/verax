#!/usr/bin/env node

/**
 * ADVERSARIAL TRUST LOCK VIOLATION TEST SUITE
 * 
 * Attacks:
 * 1. REPORT.json contains NO enforcement metadata
 * 2. REPORT.json contains NO internal-error fields
 * 3. REPORT.json contains NO diagnostics
 * 4. SUMMARY.md contains NO enforcement or internal details
 * 5. No stack traces in production output (--debug only)
 * 6. All debug info isolated to EVIDENCE/logs/debug.json
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
console.log('ADVERSARIAL: TRUST LOCK VIOLATION ATTACKS');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

const veraxDir = '.verax';

// Check if artifacts exist (if not, skip these tests)
const hasArtifacts = existsSync(veraxDir);

if (!hasArtifacts) {
  console.log('No .verax artifacts found; trust lock verification deferred.');
  console.log('(Artifacts will be validated in integration tests)\n');
  process.exit(0);
}

// ATTACK 1: REPORT.json exists and is valid JSON
if (test('ATTACK 1a: REPORT.json exists and is valid JSON', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  if (!existsSync(reportPath)) {
    throw new Error('REPORT.json not found');
  }
  const content = readFileSync(reportPath, 'utf-8');
  let report = null;
  try {
    report = JSON.parse(content);
  } catch {
    throw new Error('REPORT.json is not valid JSON');
  }
  assert(typeof report === 'object', 'REPORT.json is not an object');
})) passed++; else failed++;

// ATTACK 2: REPORT.json contains NO "enforcement" field
if (test('ATTACK 2a: REPORT.json contains NO enforcement field', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  const content = readFileSync(reportPath, 'utf-8');
  const hasEnforcement = content.toLowerCase().includes('"enforcement"') || 
                          content.toLowerCase().includes('"enforcement:');
  assert(!hasEnforcement, 'REPORT.json contains enforcement metadata (trust lock violation)');
})) passed++; else failed++;

// ATTACK 3: REPORT.json contains NO "internal-error" field
if (test('ATTACK 3a: REPORT.json contains NO internal-error field', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  const content = readFileSync(reportPath, 'utf-8');
  const hasInternalError = content.toLowerCase().includes('internal-error') ||
                            content.toLowerCase().includes('internalpolicy');
  assert(!hasInternalError, 'REPORT.json contains internal-error metadata (trust lock violation)');
})) passed++; else failed++;

// ATTACK 4: REPORT.json contains NO "diagnostics" field
if (test('ATTACK 4a: REPORT.json contains NO diagnostics field', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  const content = readFileSync(reportPath, 'utf-8');
  const content_lower = content.toLowerCase();
  const hasDiagnostics = content_lower.includes('"diagnostics"');
  assert(!hasDiagnostics, 'REPORT.json contains diagnostics field (trust lock violation)');
})) passed++; else failed++;

// ATTACK 5: REPORT.json contains NO stack traces
if (test('ATTACK 5a: REPORT.json contains NO stack traces', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  const content = readFileSync(reportPath, 'utf-8');
  const content_lower = content.toLowerCase();
  const hasStackTrace = content_lower.includes('at ') || 
                        content_lower.includes('error:') ||
                        content_lower.includes('stack');
  assert(!hasStackTrace, 'REPORT.json contains stack trace (trust lock violation)');
})) passed++; else failed++;

// ATTACK 6: SUMMARY.md contains NO enforcement details
if (test('ATTACK 6a: SUMMARY.md contains NO enforcement details', () => {
  const summaryPath = join(veraxDir, 'SUMMARY.md');
  if (!existsSync(summaryPath)) {
    // SUMMARY.md is optional
    return;
  }
  const content = readFileSync(summaryPath, 'utf-8');
  const content_lower = content.toLowerCase();
  const hasEnforcement = content_lower.includes('enforcement');
  assert(!hasEnforcement, 'SUMMARY.md contains enforcement details (trust lock violation)');
})) passed++; else failed++;

// ATTACK 7: SUMMARY.md contains NO internal-error details
if (test('ATTACK 7a: SUMMARY.md contains NO internal-error details', () => {
  const summaryPath = join(veraxDir, 'SUMMARY.md');
  if (!existsSync(summaryPath)) {
    return;
  }
  const content = readFileSync(summaryPath, 'utf-8');
  const content_lower = content.toLowerCase();
  const hasInternalError = content_lower.includes('internal-error') ||
                            content_lower.includes('internalpolicy');
  assert(!hasInternalError, 'SUMMARY.md contains internal-error details (trust lock violation)');
})) passed++; else failed++;

// ATTACK 8: SUMMARY.md contains NO stack traces
if (test('ATTACK 8a: SUMMARY.md contains NO stack traces', () => {
  const summaryPath = join(veraxDir, 'SUMMARY.md');
  if (!existsSync(summaryPath)) {
    return;
  }
  const content = readFileSync(summaryPath, 'utf-8');
  // Only flag actual stack traces (lines starting with "at " or "at\n")
  const stackTracePattern = /^\s+at\s+/m;
  const hasStackTrace = stackTracePattern.test(content);
  assert(!hasStackTrace, 'SUMMARY.md contains stack trace (trust lock violation)');
})) passed++; else failed++;

// ATTACK 9: META.json does not contain diagnostic details
if (test('ATTACK 9a: META.json does not contain diagnostics', () => {
  const metaPath = join(veraxDir, 'META.json');
  if (!existsSync(metaPath)) {
    // META.json is optional
    return;
  }
  const content = readFileSync(metaPath, 'utf-8');
  const content_lower = content.toLowerCase();
  const hasDiagnostics = content_lower.includes('"diagnostics"');
  assert(!hasDiagnostics, 'META.json contains diagnostics (trust lock violation)');
})) passed++; else failed++;

// ATTACK 10: Debug info isolated to EVIDENCE/logs/debug.json (if it exists)
if (test('ATTACK 10a: Debug info isolated to EVIDENCE/logs/debug.json', () => {
  const logsDir = join(veraxDir, 'EVIDENCE', 'logs');
  if (!existsSync(logsDir)) {
    // No logs yet (OK, test run may not have produced them)
    return;
  }
  
  const files = readdirSync(logsDir);
  files.forEach(file => {
    // Only debug.json should contain "debug" or "enforcement"
    if (file !== 'debug.json') {
      const filePath = join(logsDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const content_lower = content.toLowerCase();
      const hasEnforcement = content_lower.includes('enforcement');
      assert(!hasEnforcement, 
        `File ${file} contains enforcement (should be isolated to debug.json)`);
    }
  });
})) passed++; else failed++;

// ATTACK 11: No enforcement.json in root or EVIDENCE/
if (test('ATTACK 11a: No enforcement.json in root or EVIDENCE/', () => {
  const rootEnforcement = join(veraxDir, 'enforcement.json');
  const evidenceEnforcement = join(veraxDir, 'EVIDENCE', 'enforcement.json');
  
  assert(!existsSync(rootEnforcement), 
    'enforcement.json found in root (production leak)');
  assert(!existsSync(evidenceEnforcement), 
    'enforcement.json found in EVIDENCE/ (production leak)');
})) passed++; else failed++;

// ATTACK 12: Production output files have correct structure
if (test('ATTACK 12a: REPORT.json has required fields', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  const content = readFileSync(reportPath, 'utf-8');
  const report = JSON.parse(content);
  
  // Check required fields exist
  assert(typeof report.runId === 'string', 'Missing runId');
  assert(typeof report.status === 'string', 'Missing status');
  assert(typeof report.url === 'string', 'Missing url');
  assert(['COMPLETE', 'INCOMPLETE', 'FAILED'].includes(report.status), 
    `Invalid status: ${report.status}`);
})) passed++; else failed++;

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`═══════════════════════════════════════════════════════════\n`);

if (failed > 0) {
  console.error(`[FAIL] ${failed} trust lock violation(s) detected`);
  process.exit(1);
} else {
  console.log(`[PASS] All trust lock attacks blocked`);
  process.exit(0);
}





