/**
 * PHASE 2 — Auto-Attempt Generation Tests
 * Ensures discovered interactions convert to safe, deterministic auto-attempts
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const packageJson = require('../package.json');
const { executeReality } = require('../src/guardian/reality');
const { saveBaseline, checkBaseline } = require('../src/guardian/baseline');
const { evaluatePolicy } = require('../src/guardian/policy');
const { startFixtureServer } = require('./fixture-server');

async function withFixture(fn) {
  const fixture = await startFixtureServer();
  try {
    await fn(fixture);
  } finally {
    await fixture.close();
  }
}

async function runRealityWithAutoAttempts({ baseUrl, artifactsDir, enableAutoAttempts = true }) {
  return executeReality({
    baseUrl,
    attempts: [], // No manual attempts
    artifactsDir,
    storageDir: path.join(artifactsDir, 'storage'),
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: false,
    enableDiscovery: true,
    enableAutoAttempts,
    maxPages: 5,
    autoAttemptOptions: {
      minConfidence: 50,
      maxAttempts: 10
    }
  });
}

async function testAutoAttemptGeneration() {
  console.log('\nTEST 1: Auto-attempts generated deterministically from discovery');
  await withFixture(async (fixture) => {
    const artifactsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase2-gen-'));
    const baseUrl = `${fixture.baseUrl}?mode=ok`;
    
    const result = await runRealityWithAutoAttempts({ baseUrl, artifactsDir: artifactsRoot });

    // Should have generated auto-attempts
    const autoAttempts = result.attemptResults.filter(a => a.source === 'auto-generated');
    assert.ok(autoAttempts.length > 0, 'Should generate at least one auto-attempt');
    console.log(`✅ Generated ${autoAttempts.length} auto-attempts`);

    // Verify snapshot includes auto-attempts
    assert.strictEqual(result.snapshot.attempts.length, autoAttempts.length);
    
    // Verify all attempts have required metadata
    autoAttempts.forEach(attempt => {
      assert.ok(attempt.attemptId.startsWith('auto-'), `Attempt ID should start with 'auto-': ${attempt.attemptId}`);
      assert.strictEqual(attempt.source, 'auto-generated');
      assert.ok(attempt.riskCategory, 'Should have risk category');
    });

    console.log('✅ Auto-attempts have correct structure and metadata');
    console.log('Run dir:', result.runDir);
  });
}

async function testDeterministicGeneration() {
  console.log('\nTEST 2: Same site → same auto-attempt set (deterministic)');
  await withFixture(async (fixture) => {
    const artifactsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase2-determ-'));
    const baseUrl = `${fixture.baseUrl}?mode=ok`;

    // Run 1
    const result1 = await runRealityWithAutoAttempts({ 
      baseUrl, 
      artifactsDir: path.join(artifactsRoot, 'run1')
    });
    const attemptIds1 = result1.attemptResults
      .filter(a => a.source === 'auto-generated')
      .map(a => a.attemptId)
      .sort();

    // Run 2
    const result2 = await runRealityWithAutoAttempts({ 
      baseUrl, 
      artifactsDir: path.join(artifactsRoot, 'run2')
    });
    const attemptIds2 = result2.attemptResults
      .filter(a => a.source === 'auto-generated')
      .map(a => a.attemptId)
      .sort();

    // Should be identical
    assert.deepStrictEqual(attemptIds1, attemptIds2, 'Auto-attempts should be deterministic');
    console.log(`✅ Both runs generated identical ${attemptIds1.length} auto-attempts`);
    console.log('Sample IDs:', attemptIds1.slice(0, 3));
  });
}

async function testBaselineWithAutoAttempts() {
  console.log('\nTEST 3: Baseline saved with auto-attempts');
  await withFixture(async (fixture) => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase2-baseline-'));
    const baselineDir = path.join(tmpRoot, 'baselines');
    const baseOk = `${fixture.baseUrl}?mode=ok`;

    const saveRes = await saveBaseline({
      baseUrl: baseOk,
      attempts: [], // No manual attempts
      name: 'phase2-auto-baseline',
      artifactsDir: path.join(tmpRoot, 'save'),
      baselineDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableDiscovery: true,
      enableAutoAttempts: true,
      maxPages: 5,
      autoAttemptOptions: { minConfidence: 50, maxAttempts: 10 },
      guardianVersion: packageJson.version
    });

    assert.strictEqual(saveRes.exitCode, 0);
    assert.ok(fs.existsSync(saveRes.baselinePath));

    const baseline = JSON.parse(fs.readFileSync(saveRes.baselinePath, 'utf8'));
    // baseline.attempts is an array of attempt IDs (strings)
    const autoAttempts = baseline.attempts.filter(id => 
      id && id.startsWith('auto-')
    );
    
    assert.ok(autoAttempts.length > 0, 'Baseline should include auto-attempts');
    console.log(`✅ Baseline saved with ${autoAttempts.length} auto-attempts`);
  });
}

async function testRegressionDetection() {
  console.log('\nTEST 4: Breaking auto-attempt interaction triggers regression');
  await withFixture(async (fixture) => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase2-regression-'));
    const baselineDir = path.join(tmpRoot, 'baselines');
    const baseOk = `${fixture.baseUrl}?mode=ok`;
    const baseFail = `${fixture.baseUrl}?mode=fail`;

    // Save baseline with auto-attempts (mode=ok)
    const saveRes = await saveBaseline({
      baseUrl: baseOk,
      attempts: [],
      name: 'phase2-regression-baseline',
      artifactsDir: path.join(tmpRoot, 'save'),
      baselineDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableDiscovery: true,
      enableAutoAttempts: true,
      maxPages: 5,
      autoAttemptOptions: { minConfidence: 50, maxAttempts: 10 },
      guardianVersion: packageJson.version
    });

    assert.strictEqual(saveRes.exitCode, 0);
    const savedAttemptCount = saveRes.snapshot.attempts.length;
    console.log(`Baseline saved with ${savedAttemptCount} auto-attempts`);

    // Check against fail mode
    const checkRes = await checkBaseline({
      baseUrl: baseFail,
      name: 'phase2-regression-baseline',
      attempts: [],
      artifactsDir: path.join(tmpRoot, 'check'),
      baselineDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableDiscovery: true,
      enableAutoAttempts: true,
      maxPages: 5,
      autoAttemptOptions: { minConfidence: 50, maxAttempts: 10 },
      guardianVersion: packageJson.version
    });

    // Should detect regressions
    const regressions = checkRes.comparisons.filter(c => c.regressionType !== 'NO_REGRESSION');
    assert.ok(regressions.length > 0, 'Should detect regressions in auto-attempts');
    assert.ok(checkRes.exitCode > 0, 'Regression should yield non-zero exit code');
    
    console.log(`✅ Detected ${regressions.length} regressions in auto-attempts`);
  });
}

async function testPolicyWithAutoAttempts() {
  console.log('\nTEST 5: Policy gate reflects auto-attempt regressions');
  await withFixture(async (fixture) => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase2-policy-'));
    const baselineDir = path.join(tmpRoot, 'baselines');
    const baseOk = `${fixture.baseUrl}?mode=ok`;
    const baseFail = `${fixture.baseUrl}?mode=fail`;

    // Save baseline (mode=ok)
    await saveBaseline({
      baseUrl: baseOk,
      attempts: [],
      name: 'phase2-policy-baseline',
      artifactsDir: path.join(tmpRoot, 'save'),
      baselineDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableDiscovery: true,
      enableAutoAttempts: true,
      maxPages: 5,
      autoAttemptOptions: { minConfidence: 50, maxAttempts: 10 },
      guardianVersion: packageJson.version
    });

    // Check with fail mode (should have regressions)
    const checkRes = await checkBaseline({
      baseUrl: baseFail,
      name: 'phase2-policy-baseline',
      attempts: [],
      artifactsDir: path.join(tmpRoot, 'check'),
      baselineDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableDiscovery: true,
      enableAutoAttempts: true,
      maxPages: 5,
      autoAttemptOptions: { minConfidence: 50, maxAttempts: 10 },
      guardianVersion: packageJson.version
    });

    // Should detect regressions and fail
    assert.ok(checkRes.exitCode > 0, 'Policy should fail');
    console.log(`✅ Policy gate failed as expected with exit ${checkRes.exitCode}`);
  });
}

async function testMixedManualAndAutoAttempts() {
  console.log('\nTEST 6: Manual + auto-attempts merge correctly');
  await withFixture(async (fixture) => {
    const artifactsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase2-mixed-'));
    const baseUrl = `${fixture.baseUrl}?mode=ok`;
    
    const result = await executeReality({
      baseUrl,
      attempts: ['contact_form', 'newsletter_signup'], // Manual attempts
      artifactsDir: artifactsRoot,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableCrawl: false,
      enableDiscovery: true,
      enableAutoAttempts: true,
      maxPages: 5,
      autoAttemptOptions: {
        minConfidence: 50,
        maxAttempts: 10
      }
    });

    const manualAttempts = result.attemptResults.filter(a => a.source !== 'auto-generated');
    const autoAttempts = result.attemptResults.filter(a => a.source === 'auto-generated');

    assert.ok(manualAttempts.length >= 2, 'Should include manual attempts');
    assert.ok(autoAttempts.length > 0, 'Should include auto-generated attempts');
    
    console.log(`✅ Mixed run: ${manualAttempts.length} manual + ${autoAttempts.length} auto`);
  });
}

async function main() {
  try {
    await testAutoAttemptGeneration();
    await testDeterministicGeneration();
    await testBaselineWithAutoAttempts();
    await testRegressionDetection();
    await testPolicyWithAutoAttempts();
    await testMixedManualAndAutoAttempts();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PHASE 2 — Auto-Attempt Generation tests passed');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);
  } catch (err) {
    console.error('❌ PHASE 2 tests failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
