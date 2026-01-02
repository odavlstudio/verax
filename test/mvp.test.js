const http = require('http');
const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🧪 MVP Test Suite');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Test 1: CLI smoke test (no browser launch)
console.log('📋 Test 1: CLI smoke test');

try {
  // Test --version flag
  const versionResult = spawnSync(process.execPath, [
    'bin/guardian.js',
    '--version'
  ], { 
    encoding: 'utf8', 
    timeout: 5000
  });

  assert.strictEqual(versionResult.status, 0, 'Version command should exit 0');
  assert.ok(versionResult.stdout.trim().match(/^\d+\.\d+\.\d+$/), 'Version should be semver format');
  console.log(`✅ Version check: ${versionResult.stdout.trim()}`);
} catch (err) {
  console.error('\n❌ TEST FAILED');
  console.error(err.message);
  process.exit(1);
}

// Test 2: --help flag
try {
  const helpResult = spawnSync(process.execPath, [
    'bin/guardian.js',
    '--help'
  ], { 
    encoding: 'utf8', 
    timeout: 5000
  });

  assert.strictEqual(helpResult.status, 0, 'Help command should exit 0');
  assert.ok(helpResult.stdout.includes('guardian reality'), 'Help should mention reality command');
  console.log('✅ Help command works');
} catch (err) {
  console.error('\n❌ TEST FAILED');
  console.error(err.message);
  process.exit(1);
}

// Test 3: Core modules load without errors
try {
  const { SnapshotBuilder } = require('../src/guardian/snapshot');
  const { executeAttempt } = require('../src/guardian/attempt');
  const { GuardianCrawler } = require('../src/guardian/crawler');
  
  // Verify SnapshotBuilder works
  const builder = new SnapshotBuilder('https://example.com', 'test-run', '2.0.1');
  assert.ok(builder, 'SnapshotBuilder should instantiate');
  assert.ok(typeof builder.setHumanIntent === 'function', 'setHumanIntent should exist');
  
  console.log('✅ Core modules load successfully');
} catch (err) {
  console.error('\n❌ TEST FAILED');
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
}

// Test 4: Verify artifactsDir defaults to temp (not CWD)
try {
  const { getDefaultConfig } = require('../src/guardian/config-validator');
  const defaultConfig = getDefaultConfig();
  
  assert.ok(defaultConfig.output, 'Default config should have output');
  assert.ok(defaultConfig.output.dir, 'Default config should have output.dir');
  
  // Should NOT be in CWD
  assert.ok(!defaultConfig.output.dir.startsWith('./'), 'Artifacts dir should not be in CWD');
  assert.ok(!defaultConfig.output.dir.startsWith('.\\'), 'Artifacts dir should not be in CWD (Windows)');
  
  // Should be in temp
  const tmpdir = os.tmpdir();
  assert.ok(defaultConfig.output.dir.includes(tmpdir) || defaultConfig.output.dir.includes('odavl-guardian'), 
    'Artifacts dir should be in temp directory');
  
  console.log('✅ Runtime isolation verified (no CWD writes by default)');
} catch (err) {
  console.error('\n❌ TEST FAILED');
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
}

// Summary
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ All tests PASSED');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

process.exit(0);
