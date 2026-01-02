/**
 * PHASE 1 — Baseline Expansion (Signup/Login/Checkout)
 * Ensures new attempts are deterministic, baselines detect regressions, and policy gates trip.
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

const ATTEMPTS = ['signup', 'login', 'checkout'];

async function withFixture(fn) {
  const fixture = await startFixtureServer();
  try {
    await fn(fixture);
  } finally {
    await fixture.close();
  }
}

async function runReality({ baseUrl, artifactsDir, storageDir }) {
  return executeReality({
    baseUrl,
    attempts: ATTEMPTS,
    artifactsDir,
    storageDir,
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: false,
    enableDiscovery: false
  });
}

async function testRealityOk() {
  console.log('\nTEST 1: Reality run (mode=ok) succeeds for signup/login/checkout');
  await withFixture(async (fixture) => {
    const artifactsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase1-ok-'));
    const baseUrl = `${fixture.baseUrl}?mode=ok`;
    const result = await runReality({ baseUrl, artifactsDir: artifactsRoot });

    assert.strictEqual(result.report.summary.overallVerdict, 'SUCCESS');
    assert.strictEqual(result.report.results.length, ATTEMPTS.length);
    result.report.results.forEach(r => assert.strictEqual(r.outcome, 'SUCCESS'));

    // Verify snapshot exists and attempts recorded
    const snapshotPath = path.join(result.runDir, 'snapshot.json');
    assert.ok(fs.existsSync(snapshotPath), 'snapshot.json should exist');
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    assert.strictEqual(snapshot.attempts.length, ATTEMPTS.length);
    console.log('✅ Reality OK run passed:', result.runDir);
  });
}

async function testBaselineAndRegression() {
  console.log('\nTEST 2: Baseline save (ok) then regression detection (fail)');
  await withFixture(async (fixture) => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase1-baseline-'));
    const baselineDir = path.join(tmpRoot, 'baselines');

    const baseOk = `${fixture.baseUrl}?mode=ok`;
    const baseFail = `${fixture.baseUrl}?mode=fail`;

    const saveRes = await saveBaseline({
      baseUrl: baseOk,
      attempts: ATTEMPTS,
      name: 'phase1-baseline',
      artifactsDir: path.join(tmpRoot, 'save'),
      baselineDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      guardianVersion: packageJson.version
    });

    assert.strictEqual(saveRes.exitCode, 0);
    assert.ok(fs.existsSync(saveRes.baselinePath));
    assert.strictEqual(saveRes.snapshot.attempts.length, ATTEMPTS.length);
    assert.strictEqual(saveRes.snapshot.overallVerdict, 'SUCCESS');

    const checkRes = await checkBaseline({
      baseUrl: baseFail,
      name: 'phase1-baseline',
      attempts: ATTEMPTS,
      artifactsDir: path.join(tmpRoot, 'check'),
      baselineDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      guardianVersion: packageJson.version
    });

    const regressions = checkRes.comparisons.filter(c => c.regressionType !== 'NO_REGRESSION');
    assert.ok(regressions.length > 0, 'Should detect regressions');
    assert.ok(checkRes.exitCode > 0, 'Regression should yield non-zero exit code');
    console.log('✅ Regression detected:', checkRes.overallRegressionVerdict, 'exit', checkRes.exitCode);
  });
}

async function testPolicyGateFailsOnRegression() {
  console.log('\nTEST 3: Policy gate fails when baseline regression exists');
  await withFixture(async (fixture) => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase1-policy-'));
    const storageDir = path.join(tmpRoot, 'storage');

    // Seed baseline via ok run (auto-baseline)
    await runReality({ baseUrl: `${fixture.baseUrl}?mode=ok`, artifactsDir: path.join(tmpRoot, 'ok'), storageDir });

    // Fail run should compare to seeded baseline and produce regressions
    const failRun = await runReality({ baseUrl: `${fixture.baseUrl}?mode=fail`, artifactsDir: path.join(tmpRoot, 'fail'), storageDir });
    const snapshot = JSON.parse(fs.readFileSync(path.join(failRun.runDir, 'snapshot.json'), 'utf8'));

    const policyResult = evaluatePolicy(snapshot, undefined);
    assert.strictEqual(policyResult.passed, false, 'Policy should fail with regressions/risks');
    assert.ok([1, 2].includes(policyResult.exitCode));
    console.log('✅ Policy gate failed as expected with exit', policyResult.exitCode);
  });
}

async function main() {
  try {
    await testRealityOk();
    await testBaselineAndRegression();
    await testPolicyGateFailsOnRegression();
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PHASE 1 — Baseline Expansion tests passed');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);
  } catch (err) {
    console.error('❌ PHASE 1 tests failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
