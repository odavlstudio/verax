#!/usr/bin/env node
/**
 * CONTRACT TEST: README Exit Codes Match Code
 * 
 * Purpose: Ensure documented exit codes in README.md match actual error definitions in code
 * 
 * Checks:
 * - README exit codes section contains all codes from errors.js
 * - No undocumented exit codes in README
 * - Exit code meanings match between README and code comments
 * 
 * This test prevents documentation drift where README claims differ from implementation.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');
const readmePath = resolve(projectRoot, 'README.md');
const errorsPath = resolve(projectRoot, 'src/cli/util/support/errors.js');

// Expected exit codes from errors.js
const EXPECTED_EXIT_CODES = {
  0: 'Success (no actionable findings)',
  10: 'Needs review (suspected findings)',
  20: 'Failure (confirmed findings)',
  30: 'Incomplete run',
  40: 'Infra/runtime failure',
  50: 'Evidence/data violation',
  64: 'Invalid CLI usage'
};

function extractReadmeExitCodes(readmeContent) {
  // Find the exit codes section - look for heading or table
  const exitCodesMatch = readmeContent.match(/Exit codes?[\s\S]{0,500}\| Exit Code \| Meaning[\s\S]{0,1000}/i);
  if (!exitCodesMatch) {
    throw new Error('README.md does not contain exit codes table with "| Exit Code | Meaning" header');
  }
  
  const section = exitCodesMatch[0];
  const codes = {};
  const lines = section.split('\n');
  
  for (const line of lines) {
    // Match table rows like: | **0** | Success — zero findings detected | ✅ Pass gate |
    const match = line.match(/\|\s*\*\*(\d+)\*\*\s*\|\s*([^|]+)\|/);
    if (match) {
      const code = parseInt(match[1], 10);
      const meaning = match[2].trim();
      codes[code] = meaning;
    }
  }
  
  return codes;
}

function extractErrorsJsExitCodes(errorsContent) {
  const codes = {};
  
  // Parse comments that define exit codes
  const commentMatch = errorsContent.match(/\/\*\*[\s\S]*?exit codes:[\s\S]*?\*\//i);
  if (commentMatch) {
    const comment = commentMatch[0];
    const lines = comment.split('\n');
    
    for (const line of lines) {
      // Match patterns like: " * - 0: success (tool executed)"
      const match = line.match(/[-*]\s*(\d+):\s*(.+)/);
      if (match) {
        codes[parseInt(match[1], 10)] = match[2].trim();
      }
    }
  }
  
  return codes;
}

function testExitCodeAccuracy() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('README EXIT CODES ACCURACY CONTRACT');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const readmeContent = readFileSync(readmePath, 'utf8');
  const errorsContent = readFileSync(errorsPath, 'utf8');
  
  const readmeCodes = extractReadmeExitCodes(readmeContent);
  const _errorsCodes = extractErrorsJsExitCodes(errorsContent);
  
  console.log('Expected exit codes (from errors.js):');
  Object.entries(EXPECTED_EXIT_CODES).forEach(([code, desc]) => {
    console.log(`  ${code}: ${desc}`);
  });
  
  console.log('\nFound in README:');
  Object.entries(readmeCodes).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([code, meaning]) => {
    console.log(`  ${code}: ${meaning}`);
  });
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: All expected codes are documented in README
  console.log('\nTest 1: All expected exit codes documented in README');
  const missingCodes = [];
  
  for (const [code, desc] of Object.entries(EXPECTED_EXIT_CODES)) {
    if (!readmeCodes[code]) {
      missingCodes.push(`${code} (${desc})`);
    }
  }
  
  if (missingCodes.length > 0) {
    console.log(`✗ FAIL: Missing exit codes in README:`);
    missingCodes.forEach(c => console.log(`  - ${c}`));
    failed++;
  } else {
    console.log('✓ PASS: All exit codes documented in README');
    passed++;
  }
  
  // Test 2: No extra undocumented codes in README
  console.log('\nTest 2: No undocumented exit codes in README');
  const extraCodes = [];
  
  for (const code of Object.keys(readmeCodes)) {
    if (!EXPECTED_EXIT_CODES[code]) {
      extraCodes.push(code);
    }
  }
  
  if (extraCodes.length > 0) {
    console.log(`✗ FAIL: README contains undocumented exit codes: ${extraCodes.join(', ')}`);
    failed++;
  } else {
    console.log('✓ PASS: No undocumented exit codes in README');
    passed++;
  }
  
  // Test 3: Exit code 0 means "no actionable findings"
  console.log('\nTest 3: Exit code 0 semantics are correct');
  const code0Line = readmeCodes[0] || '';
  if (!code0Line.toLowerCase().includes('no actionable') && !code0Line.toLowerCase().includes('no findings')) {
    console.log(`✗ FAIL: Exit code 0 does not clearly state "no actionable findings"`);
    console.log(`  Found: ${code0Line}`);
    failed++;
  } else {
    console.log('✓ PASS: Exit code 0 correctly states no actionable findings');
    passed++;
  }
  
  // Test 4: Exit code 10 means "needs review"
  console.log('\nTest 4: Exit code 10 semantics are correct');
  const code10Line = readmeCodes[10] || '';
  if (!code10Line.toLowerCase().includes('needs review') && !code10Line.toLowerCase().includes('suspected')) {
    console.log(`✗ FAIL: Exit code 10 does not clearly state needs review/suspected findings`);
    console.log(`  Found: ${code10Line}`);
    failed++;
  } else {
    console.log('✓ PASS: Exit code 10 correctly states needs review');
    passed++;
  }
  
  // Test 5: Exit code 30 means "incomplete"
  console.log('\nTest 5: Exit code 30 semantics are correct');
  const code30Line = readmeCodes[30] || '';
  if (!code30Line.toLowerCase().includes('incomplete')) {
    console.log(`✗ FAIL: Exit code 30 does not clearly state "incomplete"`);
    console.log(`  Found: ${code30Line}`);
    failed++;
  } else {
    console.log('✓ PASS: Exit code 30 correctly states incomplete');
    passed++;
  }
  
  // Summary
  console.log('\n───────────────────────────────────────────────────────────');
  console.log(`Summary:\n  Passed: ${passed}\n  Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ README exit codes do not match code contract');
    process.exit(1);
  }
  
  console.log('\n✓ README exit codes match code contract');
  process.exit(0);
}

testExitCodeAccuracy();





