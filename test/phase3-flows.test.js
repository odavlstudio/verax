const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const packageJson = require('../package.json');
const { executeReality } = require('../src/guardian/reality');
const { saveBaseline, checkBaseline } = require('../src/guardian/baseline');
const { startFixtureServer } = require('./fixture-server');

async function withFixture(fn) {
  const fixture = await startFixtureServer();
  try {
    await fn(fixture);
  } finally {
    await fixture.close();
  }
}

async function runRealityWithFlows({ baseUrl, artifactsDir }) {
  return executeReality({
    baseUrl,
    attempts: [],
    artifactsDir,
    storageDir: path.join(artifactsDir, 'storage'),
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: false,
    enableDiscovery: false,
    enableAutoAttempts: false,
    enableFlows: true,
    flowOptions: { screenshotOnStep: false }
  });
}

async function testFlowsSucceed() {
  console.log('\nTEST 1: Intent flows succeed on happy path');
  await withFixture(async (fixture) => {
    const artifactsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase3-flows-ok-'));
    const baseUrl = `${fixture.baseUrl}?mode=ok`;

    const result = await runRealityWithFlows({ baseUrl, artifactsDir: artifactsRoot });
    const flows = result.flowResults || [];

    assert.strictEqual(flows.length, 3, 'Should execute three curated flows');
    flows.forEach(f => assert.strictEqual(f.outcome, 'SUCCESS', `Flow ${f.flowId} should succeed`));

    assert.ok(result.snapshot.flows.length === 3, 'Snapshot should capture all flows');
    console.log('✅ All flows succeeded');
  });
}

async function testFlowRegressionDetection() {
  console.log('\nTEST 2: Flow regressions detected via baseline');
  await withFixture(async (fixture) => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase3-flow-reg-'));
    const baselineDir = path.join(tmpRoot, 'baselines');
    const baseOk = `${fixture.baseUrl}?mode=ok`;
    const baseFail = `${fixture.baseUrl}?mode=fail`;

    const saveRes = await saveBaseline({
      baseUrl: baseOk,
      attempts: [],
      name: 'phase3-flow-baseline',
      artifactsDir: path.join(tmpRoot, 'save'),
      baselineDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableDiscovery: false,
      enableAutoAttempts: false,
      enableFlows: true,
      flowOptions: { screenshotOnStep: false },
      guardianVersion: packageJson.version
    });

    assert.strictEqual(saveRes.exitCode, 0);

    const checkRes = await checkBaseline({
      baseUrl: baseFail,
      name: 'phase3-flow-baseline',
      attempts: [],
      artifactsDir: path.join(tmpRoot, 'check'),
      baselineDir,
      headful: false,
      enableTrace: false,
      enableScreenshots: false,
      enableDiscovery: false,
      enableAutoAttempts: false,
      enableFlows: true,
      flowOptions: { screenshotOnStep: false }
    });

    const flowRegressions = (checkRes.flowComparisons || []).filter(c => c.regressionType !== 'NO_REGRESSION');
    assert.ok(flowRegressions.length > 0, 'Should detect regressions in flows');
    assert.ok(checkRes.exitCode > 0, 'Regression should produce non-zero exit');
    console.log(`✅ Detected ${flowRegressions.length} flow regressions (exit ${checkRes.exitCode})`);
  });
}

async function testFlowsIncludedInReport() {
  console.log('\nTEST 3: Flow results appear in reports');
  await withFixture(async (fixture) => {
    const artifactsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase3-flow-report-'));
    const baseUrl = `${fixture.baseUrl}?mode=ok`;

    const result = await runRealityWithFlows({ baseUrl, artifactsDir: artifactsRoot });
    const reportPath = path.join(result.runDir, 'market-report.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    assert.ok(Array.isArray(report.flows), 'Report should include flows array');
    assert.strictEqual(report.flows.length, 3, 'Report should list three flows');
    assert.strictEqual(report.flowSummary.success, 3, 'All flows should be successful');
    console.log('✅ Flows captured in market report');
  });
}

async function main() {
  try {
    await testFlowsSucceed();
    await testFlowRegressionDetection();
    await testFlowsIncludedInReport();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PHASE 3 — Intent Flow tests passed');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);
  } catch (err) {
    console.error('❌ PHASE 3 tests failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
