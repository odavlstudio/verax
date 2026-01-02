/**
 * First-Run Experience Tests
 * 
 * Verify that:
 * - First-run intro appears on first execution
 * - First-run intro does NOT appear on second run
 * - First-run intro skips in CI environment
 * - First-run intro skips in quiet mode
 * - First-run detection is stable
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { isCI, isNonInteractive, isQuietMode, isFirstRun, getFirstRunIntro, printFirstRunIntroIfNeeded } = require('../src/guardian/first-run');

console.log('🧪 First-Run Experience Tests');
console.log('═'.repeat(60));

let testCount = 0;
let passCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✅ Test ${testCount}: ${name}`);
  } catch (err) {
    console.log(`❌ Test ${testCount}: ${name}`);
    console.log(`   Error: ${err.message}`);
  }
}

// Test 1: CI detection works for all CI variables
test('CI detection recognizes CI environment variables', () => {
  const originalEnv = process.env;
  
  // Test each CI variable
  const ciVars = ['CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'CIRCLECI', 'TRAVIS'];
  
  for (const varName of ciVars) {
    process.env[varName] = 'true';
    assert(isCI() === true, `Should detect ${varName} as CI`);
    delete process.env[varName];
  }
  
  // Verify not CI when clean
  assert(isCI() === false, 'Should not detect CI when no env vars set');
});

// Test 2: Quiet mode detection works
test('Quiet mode detection identifies --quiet and -q flags', () => {
  assert(isQuietMode(['--quiet']) === true, 'Should detect --quiet');
  assert(isQuietMode(['-q']) === true, 'Should detect -q');
  assert(isQuietMode(['--other']) === false, 'Should not detect other flags');
  assert(isQuietMode([]) === false, 'Should not detect in empty args');
});

// Test 3: First-run detection - no artifacts yet
test('First-run detection returns true when artifacts dir missing', () => {
  const tmpDir = path.join(__dirname, '.test-first-run-' + Date.now());
  
  try {
    assert(isFirstRun(tmpDir) === true, 'Should be first run when dir missing');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
});

// Test 4: First-run detection - with artifacts dir but no LATEST
test('First-run detection returns true when LATEST.json missing', () => {
  const tmpDir = path.join(__dirname, '.test-first-run-' + Date.now());
  
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    assert(isFirstRun(tmpDir) === true, 'Should be first run when LATEST.json missing');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
});

// Test 5: First-run detection - with LATEST but no run
test('First-run detection returns true when LATEST points to missing run', () => {
  const tmpDir = path.join(__dirname, '.test-first-run-' + Date.now());
  const latestPath = path.join(tmpDir, 'LATEST.json');
  
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(latestPath, JSON.stringify({ pointedRun: 'nonexistent-run' }), 'utf8');
    assert(isFirstRun(tmpDir) === true, 'Should be first run when pointed run missing');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
});

// Test 6: First-run detection - with valid LATEST
test('First-run detection returns false when LATEST points to existing run', () => {
  const tmpDir = path.join(__dirname, '.test-first-run-' + Date.now());
  const latestPath = path.join(tmpDir, 'LATEST.json');
  const runDir = path.join(tmpDir, 'test-run-001');
  
  try {
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(latestPath, JSON.stringify({ pointedRun: 'test-run-001' }), 'utf8');
    assert(isFirstRun(tmpDir) === false, 'Should not be first run when run exists');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
});

// Test 7: First-run detection - invalid LATEST.json
test('First-run detection returns true when LATEST.json is invalid', () => {
  const tmpDir = path.join(__dirname, '.test-first-run-' + Date.now());
  const latestPath = path.join(tmpDir, 'LATEST.json');
  
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(latestPath, 'invalid json {{{', 'utf8');
    assert(isFirstRun(tmpDir) === true, 'Should be first run when LATEST.json invalid');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
});

// Test 8: First-run intro message is formatted correctly
test('First-run intro message contains required text', () => {
  const intro = getFirstRunIntro();
  
  assert(intro.includes('Guardian'), 'Should mention Guardian');
  assert(intro.includes('READY'), 'Should explain READY outcome');
  assert(intro.includes('FRICTION'), 'Should explain FRICTION outcome');
  assert(intro.includes('DO_NOT_LAUNCH'), 'Should explain DO_NOT_LAUNCH outcome');
  assert(intro.includes('real user'), 'Should mention real user behavior');
});

// Test 9: First-run intro message is professional
test('First-run intro message is well-formatted', () => {
  const intro = getFirstRunIntro();
  
  // Should not have excessive emojis
  const emojiCount = (intro.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  assert(emojiCount === 0, 'Should not have emojis (professional tone)');
  
  // Should have line breaks for readability
  const lines = intro.split('\n');
  assert(lines.length > 5, 'Should have multiple lines for readability');
  
  // Should not be excessively long
  assert(intro.length < 500, 'Should be concise');
});

// Test 10: printFirstRunIntroIfNeeded skips in CI
test('printFirstRunIntroIfNeeded skips in CI environment', () => {
  const originalEnv = process.env.CI;
  const originalLog = console.log;
  
  let logged = false;
  console.log = function() { logged = true; };
  
  try {
    process.env.CI = 'true';
    printFirstRunIntroIfNeeded({ artifactsDir: '/tmp/nonexistent' }, []);
    assert(logged === false, 'Should not log in CI');
  } finally {
    console.log = originalLog;
    if (originalEnv) {
      process.env.CI = originalEnv;
    } else {
      delete process.env.CI;
    }
  }
});

// Test 11: printFirstRunIntroIfNeeded skips in quiet mode
test('printFirstRunIntroIfNeeded skips in quiet mode', () => {
  const originalLog = console.log;
  
  let logged = false;
  console.log = function() { logged = true; };
  
  try {
    // Use a temp dir that doesn't exist (so isFirstRun is true)
    const tmpDir = path.join(__dirname, '.test-first-run-' + Date.now());
    printFirstRunIntroIfNeeded({ artifactsDir: tmpDir }, ['--quiet']);
    assert(logged === false, 'Should not log in quiet mode');
  } finally {
    console.log = originalLog;
  }
});

// Test 12: printFirstRunIntroIfNeeded skips on second run
test('printFirstRunIntroIfNeeded skips when not first run', () => {
  const tmpDir = path.join(__dirname, '.test-first-run-' + Date.now());
  const latestPath = path.join(tmpDir, 'LATEST.json');
  const runDir = path.join(tmpDir, 'test-run-001');
  
  const originalLog = console.log;
  let logged = false;
  console.log = function() { logged = true; };
  
  try {
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(latestPath, JSON.stringify({ pointedRun: 'test-run-001' }), 'utf8');
    printFirstRunIntroIfNeeded({ artifactsDir: tmpDir }, []);
    assert(logged === false, 'Should not log on second run');
  } finally {
    console.log = originalLog;
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
});

// Test 13: printFirstRunIntroIfNeeded logs on first run (when TTY and interactive)
test('printFirstRunIntroIfNeeded logs message on first run (mocked)', () => {
  const tmpDir = path.join(__dirname, '.test-first-run-' + Date.now());
  
  // Mock stdout.isTTY to be true
  const originalTTY = process.stdout.isTTY;
  process.stdout.isTTY = true;
  
  const originalLog = console.log;
  let loggedText = '';
  console.log = function(text) { loggedText = text || ''; };
  
  try {
    // First run, interactive, not CI, not quiet
    printFirstRunIntroIfNeeded({ artifactsDir: tmpDir }, []);
    assert(loggedText.includes('Guardian'), 'Should log intro on first run');
  } finally {
    console.log = originalLog;
    process.stdout.isTTY = originalTTY;
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
});

// Test 14: First-run detection is consistent
test('First-run detection is deterministic', () => {
  const tmpDir = path.join(__dirname, '.test-first-run-' + Date.now());
  
  try {
    // Call multiple times - should return same result
    const result1 = isFirstRun(tmpDir);
    const result2 = isFirstRun(tmpDir);
    const result3 = isFirstRun(tmpDir);
    
    assert(result1 === result2, 'First call should match second call');
    assert(result2 === result3, 'Second call should match third call');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
});

// Test 15: All conditions together - first run should show, second run should not
test('Complete flow: intro shows first run, hidden on second run', () => {
  const tmpDir = path.join(__dirname, '.test-first-run-' + Date.now());
  
  const originalLog = console.log;
  let logs = [];
  console.log = function(text) { logs.push(text); };
  
  const originalTTY = process.stdout.isTTY;
  process.stdout.isTTY = true;
  
  try {
    // First run - should log
    logs = [];
    printFirstRunIntroIfNeeded({ artifactsDir: tmpDir }, []);
    assert(logs.length > 0, 'Should log on first run');
    
    // Create run directory to simulate second execution
    const runDir = path.join(tmpDir, 'test-run-001');
    const latestPath = path.join(tmpDir, 'LATEST.json');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(latestPath, JSON.stringify({ pointedRun: 'test-run-001' }), 'utf8');
    
    // Second run - should not log
    logs = [];
    printFirstRunIntroIfNeeded({ artifactsDir: tmpDir }, []);
    assert(logs.length === 0, 'Should not log on second run');
  } finally {
    console.log = originalLog;
    process.stdout.isTTY = originalTTY;
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
});

// Print summary
console.log('═'.repeat(60));
console.log(`\nResults: ${passCount}/${testCount} tests passed`);

if (passCount === testCount) {
  console.log('✅ All first-run experience tests passed\n');
  process.exit(0);
} else {
  console.log(`❌ ${testCount - passCount} test(s) failed\n`);
  process.exit(1);
}
