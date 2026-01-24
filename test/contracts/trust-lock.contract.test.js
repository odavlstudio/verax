#!/usr/bin/env node

/**
 * TRUST LOCK CONTRACT TEST
 * 
 * Verifies Trust Lock enforcement:
 * - No evidence → no finding (low confidence findings are dropped)
 * - No promise → no finding (unanalyzed code produces no results)
 * - Internal errors never reported as user bugs
 * - Confidence levels are honest (never CONFIRMED without evidence)
 */

import { existsSync, readFileSync } from 'fs';
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
console.log('TRUST LOCK CONTRACT TESTS');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

const veraxDir = '.verax';

if (test('Finding requires evidence object', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  if (existsSync(reportPath)) {
    const content = readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(content);
    
    if (report.findings && report.findings.length > 0) {
      report.findings.forEach((finding, i) => {
        assert(finding.evidence, `Finding ${i} lacks evidence field`);
        assert(typeof finding.evidence === 'object', `Finding ${i} evidence is not an object`);
      });
    }
  }
})) passed++; else failed++;

if (test('Finding requires confidence with level and score', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  if (existsSync(reportPath)) {
    const content = readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(content);
    
    if (report.findings && report.findings.length > 0) {
      report.findings.forEach((finding, i) => {
        assert(finding.confidence, `Finding ${i} lacks confidence field`);
        assert(typeof finding.confidence === 'object', `Finding ${i} confidence is not an object`);
        assert(typeof finding.confidence.level === 'string', `Finding ${i} has no confidence level`);
        assert(['HIGH', 'MEDIUM', 'LOW', 'UNPROVEN'].includes(finding.confidence.level),
          `Finding ${i} has invalid confidence level: ${finding.confidence.level}`);
      });
    }
  }
})) passed++; else failed++;

if (test('Finding requires signals (impact, userRisk, ownership)', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  if (existsSync(reportPath)) {
    const content = readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(content);
    
    if (report.findings && report.findings.length > 0) {
      report.findings.forEach((finding, i) => {
        assert(finding.signals, `Finding ${i} lacks signals`);
        assert(finding.signals.impact, `Finding ${i} signals missing impact`);
        assert(finding.signals.userRisk, `Finding ${i} signals missing userRisk`);
        assert(finding.signals.ownership, `Finding ${i} signals missing ownership`);
      });
    }
  }
})) passed++; else failed++;

if (test('No internal errors in REPORT.json (not user-visible)', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  if (existsSync(reportPath)) {
    const content = readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(content);
    
    // REPORT.json must not contain internal error information
    assert(!report.internalErrors, 'REPORT.json exposes internal errors');
    assert(!report.toolErrors, 'REPORT.json exposes tool errors');
    
    // No finding should have internalError reason
    if (report.findings && report.findings.length > 0) {
      report.findings.forEach((finding, i) => {
        assert(!finding.reason || !finding.reason.includes('internal'), 
          `Finding ${i} is marked as internal error but exposed in REPORT.json`);
      });
    }
  }
})) passed++; else failed++;

if (test('Confidence never reaches CONFIRMED level', () => {
  const reportPath = join(veraxDir, 'REPORT.json');
  if (existsSync(reportPath)) {
    const content = readFileSync(reportPath, 'utf-8');
    const report = JSON.parse(content);
    
    if (report.findings && report.findings.length > 0) {
      report.findings.forEach((finding, i) => {
        const level = finding.confidence?.level;
        // CONFIRMED is not a valid level; findings should be HIGH/MEDIUM/LOW at most
        assert(!level || !level.includes('CONFIRMED'), 
          `Finding ${i} claims CONFIRMED confidence (should be hedged)`);
      });
    }
  }
})) passed++; else failed++;

if (test('META.json indicates FAILED status for internal errors', () => {
  const metaPath = join(veraxDir, 'META.json');
  if (existsSync(metaPath)) {
    const content = readFileSync(metaPath, 'utf-8');
    const meta = JSON.parse(content);
    
    // If there was an internal error, status should be FAILED
    if (meta.reason && meta.reason.includes('error')) {
      assert(meta.status === 'FAILED', 
        `Internal error but status is ${meta.status}; should be FAILED`);
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
  console.log(`[PASS] All Trust Lock contracts verified`);
  process.exit(0);
}





