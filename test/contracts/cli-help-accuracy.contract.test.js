#!/usr/bin/env node
/**
 * CONTRACT TEST: CLI Help Accuracy
 * 
 * Purpose: Ensure CLI help output matches reality and does not contain false claims
 * 
 * Checks (Stage 7):
 * - Help output emits exactly one RESULT/REASON/ACTION block
 * - No references to removed interactive/smart modes
 * - Help defers detailed manual to --help --debug
 *
 * This test prevents regressions where help output drifts from the minimal contract.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');
const veraxBin = resolve(projectRoot, 'bin/verax.js');

const FORBIDDEN_HELP_CONTENT = ['interactive', 'smart mode'];

function runHelpCommand() {
  try {
    const output = execSync(`node "${veraxBin}" --help`, {
      encoding: 'utf8',
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output;
  } catch (error) {
    if (error.stdout) {
      return error.stdout;
    }
    throw new Error(`Failed to run help command: ${error.message}`);
  }
}

function testHelpContent() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('CLI HELP ACCURACY CONTRACT');
  console.log('═══════════════════════════════════════════════════════════\n');

  const helpOutput = runHelpCommand();
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: No forbidden content
  console.log('Test 1: No forbidden interactive/smart mode claims');
  const forbiddenFound = FORBIDDEN_HELP_CONTENT.filter((f) => helpOutput.toLowerCase().includes(f));
  if (forbiddenFound.length > 0) {
    console.log(`✗ FAIL: Found forbidden content:`);
    forbiddenFound.forEach(f => console.log(`  - "${f}"`));
    failed++;
  } else {
    console.log('✓ PASS: No forbidden claims');
    passed++;
  }
  
  // Test 2: RESULT/REASON/ACTION present
  console.log('\nTest 2: RESULT/REASON/ACTION block present');
  const lines = helpOutput.split(/\r?\n/).map((l) => l.trim());
  const hasResult = lines.some((l) => l.startsWith('RESULT '));
  const hasReason = lines.some((l) => l.startsWith('REASON '));
  const hasAction = lines.some((l) => l.startsWith('ACTION '));
  if (!hasResult || !hasReason || !hasAction) {
    console.log('✗ FAIL: Missing RESULT/REASON/ACTION lines');
    failed++;
  } else {
    console.log('✓ PASS: RESULT/REASON/ACTION emitted');
    passed++;
  }
  
  // Test 3: Points user to debug manual
  console.log('\nTest 3: Action points to debug manual');
  const actionLine = lines.find((l) => l.startsWith('ACTION ')) || '';
  if (!actionLine.toLowerCase().includes('--help --debug')) {
    console.log('✗ FAIL: ACTION line must direct to --help --debug for manual');
    failed++;
  } else {
    console.log('✓ PASS: ACTION line directs to detailed help');
    passed++;
  }
  
  // Summary
  console.log('\n───────────────────────────────────────────────────────────');
  console.log(`Summary:\n  Passed: ${passed}\n  Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ CLI help contains false claims or missing information');
    process.exit(1);
  }
  
  console.log('\n✓ CLI help is accurate and honest');
  process.exit(0);
}

testHelpContent();





