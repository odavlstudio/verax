/**
 * test/stage7-watchdog-simple.test.js
 * 
 * Stage 7: Watchdog Mode Integration Tests (Simple Node.js runner)
 */

const { normalizeSiteKey, createBaseline, saveBaseline, loadBaseline, updateBaseline, baselineExists, getBaselineDir } = require('../src/guardian/baseline-registry');
const { compareToBaseline, shouldAlert, formatWatchdogAlert } = require('../src/guardian/watchdog-diff');
const fs = require('fs');
const path = require('path');
const os = require('os');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`  ✅ ${message}`);
    testsPassed++;
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ FAILED: ${message}`);
    console.error(`   Expected: ${JSON.stringify(expected)}`);
    console.error(`   Actual: ${JSON.stringify(actual)}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`  ✅ ${message}`);
    testsPassed++;
  }
}

function assertContains(array, item, message) {
  if (!array.includes(item)) {
    console.error(`❌ FAILED: ${message}`);
    console.error(`   Array does not contain: ${item}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`  ✅ ${message}`);
    testsPassed++;
  }
}

console.log('🧪 Stage 7: Watchdog Mode Tests');
console.log('━'.repeat(70));

// Test 1: normalizeSiteKey
console.log('\n📝 Test 1: normalizeSiteKey()');
try {
  assertEquals(normalizeSiteKey('https://example.com/'), 'example.com', 'Remove protocol and trailing slash');
  assertEquals(normalizeSiteKey('http://example.com'), 'example.com', 'Remove http protocol');
  assertEquals(normalizeSiteKey('https://example.com:3000'), 'example.com', 'Remove port');
  assertEquals(normalizeSiteKey('http://localhost:8080'), 'localhost', 'Remove localhost port');
  assertEquals(normalizeSiteKey('https://example.com?test=1'), 'example.com', 'Remove query params');
  assertEquals(normalizeSiteKey('https://example.com#section'), 'example.com', 'Remove fragment');
  assertEquals(normalizeSiteKey('https://example.com/staging/app'), 'example.com/staging/app', 'Preserve path');
  console.log('✅ Test 1 PASSED\n');
} catch (e) {
  console.log('❌ Test 1 FAILED\n');
}

// Test 2: createBaseline
console.log('📝 Test 2: createBaseline()');
try {
  const runResult = {
    finalDecision: {
      finalVerdict: 'READY',
      humanPath: ['site_smoke → SUCCESS'],
      coverageInfo: { avgConfidence: 0.95 }
    },
    verdictCard: { headline: 'Site Ready', severity: 'PASS', impact: { type: 'User Experience' } },
    attemptResults: [
      { attemptId: 'site_smoke', outcome: 'SUCCESS' }
    ],
    flowResults: [],
    coverageSignal: { percent: 80, executed: 8, total: 10 },
    determinismHash: 'abc123'
  };

  const baseline = createBaseline(runResult);
  
  assertEquals(baseline.version, 1, 'version = 1');
  assertEquals(baseline.finalVerdict, 'READY', 'finalVerdict preserved');
  assertEquals(baseline.verdictCard.headline, 'Site Ready', 'verdictCard.headline preserved');
  assert(baseline.timestamp, 'timestamp exists');
  assertEquals(baseline.coverage.percent, 80, 'coverage.percent preserved');
  assertEquals(baseline.selectorConfidence.avgConfidence, 0.95, 'selectorConfidence preserved');
  assertEquals(baseline.determinismHash, 'abc123', 'determinismHash preserved');
  console.log('✅ Test 2 PASSED\n');
} catch (e) {
  console.log('❌ Test 2 FAILED\n');
}

// Test 3: saveBaseline and loadBaseline
console.log('📝 Test 3: saveBaseline() and loadBaseline()');
try {
  const runResult = {
    finalDecision: {
      finalVerdict: 'READY',
      humanPath: [],
      coverageInfo: { avgConfidence: 0.85 }
    },
    verdictCard: { headline: 'Test', severity: 'PASS' },
    attemptResults: [],
    flowResults: [],
    coverageSignal: { percent: 75, executed: 7, total: 10 },
    determinismHash: 'hash123'
  };

  const baseline = createBaseline(runResult);
  const siteKey = 'test.com';

  saveBaseline(siteKey, baseline);
  const loaded = loadBaseline(siteKey);
  
  assertEquals(loaded.finalVerdict, 'READY', 'Loaded verdict matches');
  assertEquals(loaded.coverage.percent, 75, 'Loaded coverage matches');
  
  const nonExistent = loadBaseline('nonexistent.com');
  assertEquals(nonExistent, null, 'Returns null for nonexistent baseline');
  
  assert(baselineExists(siteKey), 'baselineExists returns true');
  assert(!baselineExists('missing.com'), 'baselineExists returns false for missing');

  // Cleanup
  const baselinePath = path.join(getBaselineDir(), `${siteKey}.json`);
  if (fs.existsSync(baselinePath)) {
    fs.unlinkSync(baselinePath);
  }
  
  console.log('✅ Test 3 PASSED\n');
} catch (e) {
  console.error(e.message);
  console.log('❌ Test 3 FAILED\n');
}

// Test 4: compareToBaseline - verdict downgrades
console.log('📝 Test 4: compareToBaseline() - verdict downgrades');
try {
  const readyBaseline = {
    finalVerdict: 'READY',
    verdictCard: { headline: 'Site Ready' },
    humanPath: { attempts: [{ attemptId: 'site_smoke', outcome: 'SUCCESS' }] },
    coverage: { percent: 80 },
    selectorConfidence: { avgConfidence: 0.9 }
  };

  // READY -> FRICTION = MEDIUM
  const frictionRun = {
    finalDecision: { finalVerdict: 'FRICTION' },
    verdictCard: { headline: 'Friction' },
    attemptResults: [{ attemptId: 'site_smoke', outcome: 'SUCCESS' }],
    coverageSignal: { percent: 80, executed: 8, total: 10 }
  };
  
  const frictionComp = compareToBaseline(frictionRun, readyBaseline);
  assert(frictionComp.degraded, 'READY→FRICTION is degraded');
  assertEquals(frictionComp.severity, 'MEDIUM', 'READY→FRICTION severity is MEDIUM');
  assertContains(frictionComp.reasons, 'Verdict downgraded from READY to FRICTION', 'Reason includes downgrade');

  // READY -> DO_NOT_LAUNCH = HIGH
  const dontLaunchRun = {
    finalDecision: { finalVerdict: 'DO_NOT_LAUNCH' },
    verdictCard: { headline: 'Critical' },
    attemptResults: [{ attemptId: 'site_smoke', outcome: 'FAILURE' }],
    coverageSignal: { percent: 80, executed: 8, total: 10 }
  };
  
  const dontLaunchComp = compareToBaseline(dontLaunchRun, readyBaseline);
  assert(dontLaunchComp.degraded, 'READY→DO_NOT_LAUNCH is degraded');
  assertEquals(dontLaunchComp.severity, 'HIGH', 'READY→DO_NOT_LAUNCH severity is HIGH');

  console.log('✅ Test 4 PASSED\n');
} catch (e) {
  console.log('❌ Test 4 FAILED\n');
}

// Test 5: compareToBaseline - coverage and confidence drops
console.log('📝 Test 5: compareToBaseline() - coverage and confidence');
try {
  const baseline = {
    finalVerdict: 'READY',
    verdictCard: { headline: 'Ready' },
    humanPath: { attempts: [{ attemptId: 'site_smoke', outcome: 'SUCCESS' }] },
    coverage: { percent: 80, executed: 8, total: 10 },
    selectorConfidence: { avgConfidence: 0.9 }
  };

  // Coverage drop ≥ 20%
  const coverageDrop = {
    finalDecision: { finalVerdict: 'READY' },
    verdictCard: { headline: 'Ready' },
    attemptResults: [{ attemptId: 'site_smoke', outcome: 'SUCCESS' }],
    coverageSignal: { percent: 55, executed: 5, total: 10 }
  };
  
  const coverageComp = compareToBaseline(coverageDrop, baseline);
  assert(coverageComp.degraded, 'Coverage drop ≥20% is degraded');
  assertEquals(coverageComp.severity, 'MEDIUM', 'Coverage drop severity is MEDIUM');

  // Confidence drop ≥ 0.2
  const confidenceDrop = {
    finalDecision: { finalVerdict: 'READY', coverageInfo: { avgConfidence: 0.65 } },
    verdictCard: { headline: 'Ready' },
    attemptResults: [{ attemptId: 'site_smoke', outcome: 'SUCCESS' }],
    coverageSignal: { percent: 80, executed: 8, total: 10 }
  };
  
  const confidenceComp = compareToBaseline(confidenceDrop, baseline);
  assert(confidenceComp.degraded, 'Confidence drop ≥0.2 is degraded');
  assertEquals(confidenceComp.severity, 'MEDIUM', 'Confidence drop severity is MEDIUM');

  console.log('✅ Test 5 PASSED\n');
} catch (e) {
  console.log('❌ Test 5 FAILED\n');
}

// Test 6: updateBaseline
console.log('📝 Test 6: updateBaseline()');
try {
  const siteKey = 'update-test.com';
  
  const oldBaseline = {
    version: 1,
    timestamp: Date.now() - 10000,
    finalVerdict: 'READY',
    verdictCard: { headline: 'Old' },
    coverage: { percent: 70 }
  };

  saveBaseline(siteKey, oldBaseline);

  // Update with READY verdict
  const readyUpdate = {
    finalDecision: {
      finalVerdict: 'READY',
      coverageInfo: { avgConfidence: 0.85 }
    },
    verdictCard: { headline: 'New' },
    coverageSignal: { percent: 85, executed: 8, total: 10 },
    attemptResults: [],
    flowResults: []
  };

  updateBaseline(siteKey, readyUpdate);
  const updated = loadBaseline(siteKey);
  assertEquals(updated.verdictCard.headline, 'New', 'Baseline updated with READY');
  assertEquals(updated.coverage.percent, 85, 'Coverage updated');

  // Attempt to update with FRICTION (should not update)
  const frictionUpdate = {
    finalDecision: {
      finalVerdict: 'FRICTION',
      coverageInfo: { avgConfidence: 0.75 }
    },
    verdictCard: { headline: 'Friction' },
    coverageSignal: { percent: 60, executed: 6, total: 10 },
    attemptResults: [],
    flowResults: []
  };

  try {
    updateBaseline(siteKey, frictionUpdate);
    throw new Error('Should have thrown error for FRICTION update');
  } catch (e) {
    assert(e.message.includes('only READY verdicts'), 'Error message correct');
  }
  
  const unchanged = loadBaseline(siteKey);
  assertEquals(unchanged.verdictCard.headline, 'New', 'Baseline NOT updated with FRICTION');
  assertEquals(unchanged.coverage.percent, 85, 'Coverage NOT changed');

  // Cleanup
  const baselinePath = path.join(getBaselineDir(), `${siteKey}.json`);
  if (fs.existsSync(baselinePath)) {
    fs.unlinkSync(baselinePath);
  }

  console.log('✅ Test 6 PASSED\n');
} catch (e) {
  console.error(e.message);
  console.log('❌ Test 6 FAILED\n');
}

// Test 7: shouldAlert and formatWatchdogAlert
console.log('📝 Test 7: shouldAlert() and formatWatchdogAlert()');
try {
  assert(shouldAlert({ degraded: true }), 'shouldAlert true when degraded');
  assert(!shouldAlert({ degraded: false }), 'shouldAlert false when not degraded');

  const comparison = {
    degraded: true,
    severity: 'HIGH',
    reasons: ['Verdict downgraded from READY to DO_NOT_LAUNCH', 'Coverage dropped'],
    transitions: { from: 'READY', to: 'DO_NOT_LAUNCH' }
  };

  const alert = formatWatchdogAlert(comparison);
  assert(alert.includes('🚨 WATCHDOG ALERT'), 'Alert includes watchdog header');
  assert(alert.includes('Severity: HIGH'), 'Alert includes HIGH severity');
  assert(alert.includes('Verdict downgraded'), 'Alert includes reason');
  assert(alert.includes('Verdict: READY → DO_NOT_LAUNCH'), 'Alert includes verdict transition');

  console.log('✅ Test 7 PASSED\n');
} catch (e) {
  console.error(e.message);
  console.log('❌ Test 7 FAILED\n');
}

console.log('━'.repeat(70));
console.log(`\n✅ Tests passed: ${testsPassed}`);
console.log(`❌ Tests failed: ${testsFailed}`);

if (testsFailed === 0) {
  console.log('\n🎉 All Stage 7 Watchdog Mode tests PASSED!\n');
  process.exit(0);
} else {
  console.log('\n❌ Some tests FAILED\n');
  process.exit(1);
}
