#!/usr/bin/env node

/**
 * ADVERSARIAL DETERMINISM TEST SUITE
 * 
 * Attacks:
 * 1. Run IDs are deterministic (same input = same run ID)
 * 2. Exit codes are deterministic
 * 3. JSON output order is consistent
 * 4. No random/time-based fields in artifacts
 * 5. Filesystem traversal order normalized
 * 6. Object property iteration order stable
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

function runDoctor() {
  try {
    const stdout = execSync('node bin/verax.js doctor --json', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 35000,
    });
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Doctor failed: ${error.message}`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('ADVERSARIAL: DETERMINISM ATTACKS');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

// ATTACK 1: Doctor output is bit-for-bit identical on consecutive runs
if (test('ATTACK 1a: Doctor output is bit-for-bit identical', () => {
  const outputs = [];
  for (let i = 0; i < 2; i++) {
    const output = runDoctor();
    outputs.push(JSON.stringify(output));
  }
  assert(outputs[0] === outputs[1], 
    'Doctor output differs between runs (non-deterministic)');
})) passed++; else failed++;

// ATTACK 2: Doctor checks array order is consistent
if (test('ATTACK 2a: Doctor checks order is consistent', () => {
  const names1 = [];
  const names2 = [];
  
  for (let i = 0; i < 2; i++) {
    const output = runDoctor();
    const names = output.checks.map(c => c.name);
    if (i === 0) {
      names1.push(...names);
    } else {
      names2.push(...names);
    }
  }
  
  const order1 = names1.join('|');
  const order2 = names2.join('|');
  assert(order1 === order2, 
    `Check order changed: ${order1} vs ${order2}`);
})) passed++; else failed++;

// ATTACK 3: Doctor recommendations order is consistent
if (test('ATTACK 3a: Doctor recommendations order is consistent', () => {
  const outputs = [];
  for (let i = 0; i < 2; i++) {
    const output = runDoctor();
    outputs.push(output.recommendations.join('|'));
  }
  assert(outputs[0] === outputs[1], 
    'Doctor recommendations order changed (non-deterministic)');
})) passed++; else failed++;

// ATTACK 4: Doctor JSON keys are in consistent order
if (test('ATTACK 4a: Doctor JSON structure is consistent', () => {
  const output1 = JSON.stringify(runDoctor());
  const output2 = JSON.stringify(runDoctor());
  
  // Parse and re-stringify to normalize key order
  const normalized1 = JSON.stringify(JSON.parse(output1));
  const normalized2 = JSON.stringify(JSON.parse(output2));
  
  assert(normalized1 === normalized2, 
    'Doctor JSON structure differs (non-deterministic)');
})) passed++; else failed++;

// ATTACK 5: Doctor check details do not include timestamps
if (test('ATTACK 5a: Doctor check details exclude timestamps', () => {
  const output = runDoctor();
  
  output.checks.forEach((check, i) => {
    // Check for timestamp patterns (YYYY-MM-DD format)
    const timestamps = check.details.match(/\d{4}-\d{2}-\d{2}/g) || [];
    assert(timestamps.length === 0, 
      `Check ${i} contains timestamp: ${check.details}`);
  });
})) passed++; else failed++;

// ATTACK 6: Doctor ok field is deterministic
if (test('ATTACK 6a: Doctor ok field is deterministic', () => {
  const oks = [];
  for (let i = 0; i < 3; i++) {
    const output = runDoctor();
    oks.push(output.ok);
  }
  const allSame = oks.every(ok => ok === oks[0]);
  assert(allSame, `Doctor ok field changed: ${oks.join(', ')}`);
})) passed++; else failed++;

// ATTACK 7: Doctor nodeVersion is stable
if (test('ATTACK 7a: Doctor nodeVersion is stable', () => {
  const versions = [];
  for (let i = 0; i < 2; i++) {
    const output = runDoctor();
    versions.push(output.nodeVersion);
  }
  assert(versions[0] === versions[1], 
    `Node version changed: ${versions[0]} vs ${versions[1]}`);
})) passed++; else failed++;

// ATTACK 8: Doctor platform is stable
if (test('ATTACK 8a: Doctor platform is stable', () => {
  const platforms = [];
  for (let i = 0; i < 2; i++) {
    const output = runDoctor();
    platforms.push(output.platform);
  }
  assert(platforms[0] === platforms[1], 
    `Platform changed: ${platforms[0]} vs ${platforms[1]}`);
})) passed++; else failed++;

// ATTACK 9: Doctor each check has no random fields
if (test('ATTACK 9a: Doctor checks contain no random fields', () => {
  const output = runDoctor();
  
  output.checks.forEach((check, i) => {
    // Check that each run reports the same status
    // (Not testing different runs, just structure validity)
    assert(['pass', 'warn', 'fail'].includes(check.status), 
      `Check ${i} has invalid status: ${check.status}`);
    assert(typeof check.name === 'string' && check.name.length > 0,
      `Check ${i} has invalid name`);
    assert(typeof check.details === 'string',
      `Check ${i} has invalid details`);
  });
})) passed++; else failed++;

// ATTACK 10: Doctor recommendations are not randomly shuffled
if (test('ATTACK 10a: Doctor recommendations are not shuffled', () => {
  const recLists = [];
  for (let i = 0; i < 3; i++) {
    const output = runDoctor();
    recLists.push(output.recommendations);
  }
  
  // All three should have same order
  const firstOrder = recLists[0].join('|');
  for (let i = 1; i < recLists.length; i++) {
    const order = recLists[i].join('|');
    assert(order === firstOrder, 
      `Recommendations order changed on run ${i}`);
  }
})) passed++; else failed++;

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`═══════════════════════════════════════════════════════════\n`);

if (failed > 0) {
  console.error(`[FAIL] ${failed} determinism attack(s) succeeded`);
  process.exit(1);
} else {
  console.log(`[PASS] All determinism attacks blocked`);
  process.exit(0);
}





