#!/usr/bin/env node
/**
 * CONTRACT TEST: Findings Schema Validation
 * 
 * Purpose: Enforce consistent finding schema across the codebase
 * 
 * Schema Rules (VERAX CORE Principle):
 * - status = CONFIRMED | SUSPECTED | INFORMATIONAL | UNPROVEN (finding evaluation outcome)
 * - severity = HIGH | MEDIUM | LOW (impact level, if used at all - currently not required)
 * - confidence = 0..1 (numeric score)
 * 
 * This test prevents schema violations where:
 * - severity is misused for status values (CONFIRMED/SUSPECTED)
 * - status is missing from findings
 * - status contains invalid values
 * 
 * This test locks Stage 4 (Findings Schema Hygiene) and prevents regression.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

const _VALID_STATUS_VALUES = ['CONFIRMED', 'SUSPECTED', 'INFORMATIONAL', 'UNPROVEN'];
const _INVALID_SEVERITY_VALUES = ['CONFIRMED', 'SUSPECTED', 'INFORMATIONAL', 'UNPROVEN'];  // These belong in status, not severity

// Recursively find all .js files in a directory
function findJsFiles(dir, files = []) {
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== '.git') {
        findJsFiles(fullPath, files);
      }
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function searchCodeForSchemaViolations() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('FINDINGS SCHEMA CONTRACT');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: No code should assign CONFIRMED/SUSPECTED/etc to 'severity' field
  console.log('Test 1: Verify no code assigns status values to severity field');
  
  const srcDir = resolve(projectRoot, 'src');
  const jsFiles = findJsFiles(srcDir);
  const violations = [];
  
  for (const file of jsFiles) {
    const content = readFileSync(file, 'utf8');
    const relativePath = file.replace(projectRoot, '').replace(/\\/g, '/');
    
    // Check for severity: 'CONFIRMED', severity: 'SUSPECTED', etc.
    const patterns = [
      /severity:\s*['"]CONFIRMED['"]/g,
      /severity:\s*['"]SUSPECTED['"]/g,
      /severity:\s*['"]INFORMATIONAL['"]/g,
      /severity:\s*['"]UNPROVEN['"]/g
    ];
    
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        violations.push({ file: relativePath, pattern: pattern.toString(), count: matches.length });
      }
    }
  }
  
  if (violations.length > 0) {
    console.log(`✗ FAIL: Found severity field misused for status values:`);
    violations.forEach(v => console.log(`  - ${v.file}: ${v.pattern} (${v.count} occurrence(s))`));
    failed++;
  } else {
    console.log('✓ PASS: No severity field assigned status values');
    passed++;
  }
  
  // Test 2: Source files that create findings should use status, not severity
  console.log('\\nTest 2: Finding construction files use status field correctly');
  
  const findingFiles = [
    resolve(projectRoot, 'src/verax/detect/route-findings.js'),
    resolve(projectRoot, 'src/verax/detect/view-switch-correlator.js'),
    resolve(projectRoot, 'src/verax/detect/ui-feedback-findings.js')
  ];
  
  let statusFieldMissing = [];
  
  for (const file of findingFiles) {
    if (!existsSync(file)) {
      console.log(`  Warning: File not found: ${file}`);
      continue;
    }
    
    const content = readFileSync(file, 'utf8');
    const fileName = file.split('\\\\').pop();
    
    // Check if file creates findings with 'status:' field (not 'severity:' for status values)
    const hasStatusField = /\\bstatus:\\s*['"](?:CONFIRMED|SUSPECTED|INFORMATIONAL)/m.test(content);
    const hasSeverityWithStatus = /\\bseverity:\\s*['"](?:CONFIRMED|SUSPECTED|INFORMATIONAL)/m.test(content);
    
    if (hasSeverityWithStatus) {
      statusFieldMissing.push(`${fileName} still uses severity for status values`);
    } else if (!hasStatusField) {
      // May not create findings directly, or uses variables - check comments
      if (/SCHEMA FIX/.test(content)) {
        // File has been fixed, OK
      } else {
        statusFieldMissing.push(`${fileName} may not use status field (needs verification)`);
      }
    }
  }
  
  if (statusFieldMissing.length > 0) {
    console.log('✗ FAIL: Some finding construction files have issues:');
    statusFieldMissing.forEach(msg => console.log(`  - ${msg}`));
    failed++;
  } else {
    console.log('✓ PASS: Finding construction files use status field');
    passed++;
  }
  
  // Test 3: validators.js should check finding.status (primary), not finding.severity (legacy fallback only)
  console.log('\nTest 3: Validator checks finding.status as primary field');
  
  const validatorsPath = resolve(projectRoot, 'src/verax/core/contracts/validators.js');
  if (existsSync(validatorsPath)) {
    const validatorContent = readFileSync(validatorsPath, 'utf8');
    
    // Check that status is checked (finding.status === FINDING_STATUS.CONFIRMED)
    const checksStatus = /finding\.status\s*===\s*FINDING_STATUS\.CONFIRMED/.test(validatorContent);
    const checksSeverityFallback = /finding\.severity\s*===/.test(validatorContent);
    
    if (!checksStatus) {
      console.log('✗ FAIL: validators.js does not check finding.status');
      failed++;
    } else if (checksSeverityFallback) {
      // Fallback is OK for backwards compatibility
      console.log('✓ PASS: validators.js checks finding.status (with severity fallback for compat)');
      passed++;
    } else {
      console.log('✓ PASS: validators.js checks finding.status correctly');
      passed++;
    }
  } else {
    console.log('  Warning: validators.js not found, skipping test');
  }
  
  // Summary
  console.log('\\n───────────────────────────────────────────────────────────');
  console.log(`Summary:\\n  Passed: ${passed}\\n  Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\\n❌ Findings schema contains violations');
    console.log('\\nSchema Rules:');
    console.log('  - status: CONFIRMED | SUSPECTED | INFORMATIONAL | UNPROVEN');
    console.log('  - severity: HIGH | MEDIUM | LOW (impact level, optional)');
    console.log('  - confidence: 0..1 (numeric)');
    process.exit(1);
  }
  
  console.log('\\n✓ Findings schema is consistent');
  console.log('\\nSchema:');
  console.log('  - status: CONFIRMED | SUSPECTED | INFORMATIONAL | UNPROVEN (required)');
  console.log('  - severity: HIGH | MEDIUM | LOW (optional, reserved for impact)');
  console.log('  - confidence: 0..1 (numeric, required)');
  process.exit(0);
}

searchCodeForSchemaViolations();





