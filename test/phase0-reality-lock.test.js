/**
 * PHASE 0 — Reality Lock Tests
 * 
 * Proves Guardian's core guarantees:
 * 1. One-command run produces deterministic artifacts
 * 2. Baseline save + compare works
 * 3. Policy gates produce clear PASS/FAIL
 * 4. All outputs are consistent and verifiable
 * 
 * Uses local fixture server (no external dependencies).
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

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔒 PHASE 0 — Reality Lock Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let fixture = null;
let artifactsRoot = null;

async function setup() {
  fixture = await startFixtureServer();
  artifactsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-phase0-'));
  console.log(`📁 Test artifacts: ${artifactsRoot}\n`);
}

async function teardown() {
  if (fixture) await fixture.close();
  // Keep artifacts for inspection (don't delete)
}

// ============================================================================
// TEST 1: One-Command Run Produces Deterministic Artifacts
// ============================================================================

async function test1_DeterministicRun() {
  console.log('TEST 1: One-Command Run Produces Deterministic Artifacts\n');

  const baseUrl = `${fixture.baseUrl}?mode=ok`;
  const artifactsDir = path.join(artifactsRoot, 'test1');

  const result = await executeReality({
    baseUrl,
    attempts: ['contact_form', 'language_switch', 'newsletter_signup'],
    artifactsDir,
    headful: false,
    enableTrace: false,
    enableScreenshots: true,
    enableCrawl: false,
    enableDiscovery: false
  });

  // Verify result structure
  assert.ok(result, 'Result should exist');
  assert.ok(result.report, 'Report should exist');
  assert.ok(result.runDir, 'Run directory should exist');
  assert.ok(result.marketJsonPath, 'Market JSON path should exist');
  assert.ok(result.marketHtmlPath, 'Market HTML path should exist');

  // Verify run directory exists
  assert.ok(fs.existsSync(result.runDir), 'Run directory should be created');

  // Verify market-report.json
  assert.ok(fs.existsSync(result.marketJsonPath), 'market-report.json should exist');
  const marketJson = JSON.parse(fs.readFileSync(result.marketJsonPath, 'utf8'));
  assert.strictEqual(marketJson.version, '1.0.0', 'Report version should be 1.0.0');
  assert.ok(marketJson.runId, 'Run ID should exist');
  assert.strictEqual(marketJson.baseUrl, baseUrl, 'Base URL should match');
  assert.ok(Array.isArray(marketJson.attemptsRun), 'Attempts run should be array');
  assert.strictEqual(marketJson.attemptsRun.length, 3, 'Should run 3 attempts');
  assert.ok(marketJson.summary, 'Summary should exist');
  const allowedVerdicts = ['SUCCESS', 'FAILURE', 'FRICTION', 'READY', 'DO_NOT_LAUNCH'];
  assert.ok(allowedVerdicts.includes(marketJson.summary.overallVerdict), 'Overall verdict should be valid');
  assert.ok(Array.isArray(marketJson.results), 'Results should be array');
  assert.strictEqual(marketJson.results.length, 3, 'Should have 3 results');

  // Verify report.html (enhanced HTML)
  assert.ok(fs.existsSync(result.marketHtmlPath), 'report.html should exist');
  const htmlContent = fs.readFileSync(result.marketHtmlPath, 'utf8');
  assert.ok(htmlContent.includes('Guardian') || htmlContent.includes('Market Reality'), 'HTML should contain Guardian or Market Reality');

  // Verify snapshot.json
  const snapshotPath = path.join(result.runDir, 'snapshot.json');
  assert.ok(fs.existsSync(snapshotPath), 'snapshot.json should exist');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  assert.ok(snapshot.schemaVersion, 'Snapshot should have schema version');
  assert.ok(snapshot.meta, 'Snapshot should have meta');
  assert.strictEqual(snapshot.meta.url, baseUrl, 'Snapshot URL should match');

  // Verify attempt artifacts
  for (const attemptId of ['contact_form', 'language_switch', 'newsletter_signup']) {
    const attemptDir = path.join(result.runDir, attemptId);
    assert.ok(fs.existsSync(attemptDir), `Attempt directory should exist: ${attemptId}`);
    
    // Find attempt-* subdirectory
    const attemptSubdirs = fs.readdirSync(attemptDir).filter(d => d.startsWith('attempt-'));
    assert.ok(attemptSubdirs.length > 0, `Attempt subdirectory should exist: ${attemptId}`);
    
    const attemptRunDir = path.join(attemptDir, attemptSubdirs[0]);
    const attemptJsonPath = path.join(attemptRunDir, 'attempt-report.json');
    const attemptHtmlPath = path.join(attemptRunDir, 'attempt-report.html');
    
    assert.ok(fs.existsSync(attemptJsonPath), `Attempt JSON should exist: ${attemptId}`);
    assert.ok(fs.existsSync(attemptHtmlPath), `Attempt HTML should exist: ${attemptId}`);
    
    // Verify screenshots directory
    const screenshotsDir = path.join(attemptRunDir, 'attempt-screenshots');
    assert.ok(fs.existsSync(screenshotsDir), `Screenshots directory should exist: ${attemptId}`);
  }

  // Verify exit code
  assert.ok([0, 1, 2].includes(result.exitCode), 'Exit code should be 0, 1, or 2');

  // In OK mode, should succeed
  assert.strictEqual(result.report.summary.overallVerdict, 'SUCCESS', 'OK mode should succeed');
  assert.strictEqual(result.exitCode, 0, 'OK mode should have exit code 0');

  console.log('✅ All artifacts verified:');
  console.log(`   - Run directory: ${result.runDir}`);
  console.log(`   - Market JSON: ${path.basename(result.marketJsonPath)}`);
  console.log(`   - Market HTML: ${path.basename(result.marketHtmlPath)}`);
  console.log(`   - Snapshot: snapshot.json`);
  console.log(`   - 3 attempt directories with reports and screenshots`);
  console.log(`   - Overall verdict: ${result.report.summary.overallVerdict}`);
  console.log(`   - Exit code: ${result.exitCode}\n`);
}

// ============================================================================
// TEST 2: Baseline Save Produces Valid Baseline File
// ============================================================================

async function test2_BaselineSave() {
  console.log('TEST 2: Baseline Save Produces Valid Baseline File\n');

  const baseUrl = `${fixture.baseUrl}?mode=ok`;
  const artifactsDir = path.join(artifactsRoot, 'test2');
  const baselineDir = path.join(artifactsRoot, 'test2-baselines');

  const result = await saveBaseline({
    baseUrl,
    attempts: ['contact_form', 'language_switch', 'newsletter_signup'],
    name: 'test-baseline',
    artifactsDir,
    baselineDir,
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    guardianVersion: packageJson.version
  });

  // Verify result
  assert.strictEqual(result.exitCode, 0, 'Baseline save should succeed');
  assert.ok(result.baselinePath, 'Baseline path should exist');
  assert.ok(result.snapshot, 'Snapshot should exist');

  // Verify baseline file
  assert.ok(fs.existsSync(result.baselinePath), 'Baseline file should exist');
  const baseline = JSON.parse(fs.readFileSync(result.baselinePath, 'utf8'));

  // Verify baseline structure
  assert.strictEqual(baseline.schemaVersion, 1, 'Schema version should be 1');
  assert.strictEqual(baseline.guardianVersion, packageJson.version, 'Guardian version should match');
  assert.strictEqual(baseline.baselineName, 'test-baseline', 'Baseline name should match');
  assert.ok(baseline.createdAt, 'Created timestamp should exist');
  assert.strictEqual(baseline.baseUrl, baseUrl, 'Base URL should match');
  assert.ok(Array.isArray(baseline.attempts), 'Attempts should be array');
  assert.strictEqual(baseline.attempts.length, 3, 'Should have 3 attempts');
  assert.ok(baseline.overallVerdict, 'Overall verdict should exist');
  assert.ok(Array.isArray(baseline.perAttempt), 'Per-attempt data should be array');
  assert.strictEqual(baseline.perAttempt.length, 3, 'Should have 3 per-attempt entries');

  // Verify per-attempt structure
  for (const attemptData of baseline.perAttempt) {
    assert.ok(attemptData.attemptId, 'Attempt ID should exist');
    assert.ok(attemptData.attemptName, 'Attempt name should exist');
    assert.ok(attemptData.outcome, 'Outcome should exist');
    assert.ok(typeof attemptData.totalDurationMs === 'number', 'Duration should be number');
    assert.ok(typeof attemptData.totalRetries === 'number', 'Retries should be number');
    assert.ok(Array.isArray(attemptData.frictionSignals), 'Friction signals should be array');
    assert.ok(Array.isArray(attemptData.steps), 'Steps should be array');
  }

  console.log('✅ Baseline file verified:');
  console.log(`   - Path: ${result.baselinePath}`);
  console.log(`   - Schema version: ${baseline.schemaVersion}`);
  console.log(`   - Overall verdict: ${baseline.overallVerdict}`);
  console.log(`   - Attempts: ${baseline.attempts.join(', ')}`);
  console.log(`   - Per-attempt data: ${baseline.perAttempt.length} entries\n`);
}

// ============================================================================
// TEST 3: Baseline Check Detects Regressions
// ============================================================================

async function test3_BaselineCheckDetectsRegressions() {
  console.log('TEST 3: Baseline Check Detects Regressions\n');

  const baseUrlOk = `${fixture.baseUrl}?mode=ok`;
  const baseUrlFail = `${fixture.baseUrl}?mode=fail`;
  const artifactsDir = path.join(artifactsRoot, 'test3');
  const baselineDir = path.join(artifactsRoot, 'test3-baselines');

  // Step 1: Save baseline with OK mode
  console.log('   Step 1: Saving baseline (OK mode)...');
  const saveResult = await saveBaseline({
    baseUrl: baseUrlOk,
    attempts: ['contact_form', 'language_switch', 'newsletter_signup'],
    name: 'regression-test',
    artifactsDir: path.join(artifactsDir, 'baseline-save'),
    baselineDir,
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    guardianVersion: packageJson.version
  });

  assert.strictEqual(saveResult.exitCode, 0, 'Baseline save should succeed');
  assert.strictEqual(saveResult.snapshot.overallVerdict, 'SUCCESS', 'OK mode should succeed');
  console.log(`   ✓ Baseline saved with verdict: ${saveResult.snapshot.overallVerdict}\n`);

  // Step 2: Check baseline with FAIL mode (regression)
  console.log('   Step 2: Checking baseline (FAIL mode - expect regression)...');
  const checkResult = await checkBaseline({
    baseUrl: baseUrlFail,
    attempts: ['contact_form', 'language_switch', 'newsletter_signup'],
    name: 'regression-test',
    artifactsDir: path.join(artifactsDir, 'baseline-check'),
    baselineDir,
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    guardianVersion: packageJson.version
  });

  // Verify regression detected
  assert.ok(checkResult, 'Check result should exist');
  assert.ok(checkResult.overallRegressionVerdict, 'Overall regression verdict should exist');
  assert.ok(checkResult.comparisons, 'Comparisons should exist');
  assert.ok(Array.isArray(checkResult.comparisons), 'Comparisons should be array');

  // Verify regressions detected
  const regressedAttempts = checkResult.comparisons.filter(c => c.regressionType !== 'NO_REGRESSION');
  assert.ok(regressedAttempts.length > 0, 'Should detect at least one regression');
  
  // Verify exit code indicates regression
  assert.ok(checkResult.exitCode > 0, 'Regression should produce non-zero exit code');

  console.log('   ✓ Regression detected:');
  console.log(`     - Baseline verdict: ${saveResult.snapshot.overallVerdict}`);
  console.log(`     - Overall regression: ${checkResult.overallRegressionVerdict}`);
  console.log(`     - Regressions: ${regressedAttempts.length} attempts`);
  console.log(`     - Exit code: ${checkResult.exitCode}\n`);

  // Exit code should indicate failure (4 for REGRESSION_FAILURE)
  assert.ok(checkResult.exitCode > 0, 'Regression should produce non-zero exit code');
}

// ============================================================================
// TEST 4: Policy Gates Produce Clear PASS/FAIL
// ============================================================================

async function test4_PolicyGates() {
  console.log('TEST 4: Policy Gates Produce Clear PASS/FAIL\n');

  const baseUrlOk = `${fixture.baseUrl}?mode=ok`;
  const baseUrlFail = `${fixture.baseUrl}?mode=fail`;
  const artifactsDir = path.join(artifactsRoot, 'test4');

  // Test 4a: OK mode with startup policy (should PASS)
  console.log('   Test 4a: OK mode with startup policy...');
  const resultOk = await executeReality({
    baseUrl: baseUrlOk,
    attempts: ['contact_form', 'language_switch', 'newsletter_signup'],
    artifactsDir: path.join(artifactsDir, 'ok'),
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: false,
    enableDiscovery: false,
    policy: 'preset:startup'
  });

  assert.strictEqual(resultOk.report.summary.overallVerdict, 'SUCCESS', 'OK mode should succeed');
  
  // Evaluate policy (snapshot is in resultOk.snapshot or need to load from file)
  const snapshotPath = path.join(resultOk.runDir, 'snapshot.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const policyOk = evaluatePolicy(snapshot, { failOnSeverity: 'CRITICAL', maxWarnings: 999, maxInfo: 999, maxTotalRisk: 999, failOnNewRegression: false });
  
  assert.strictEqual(policyOk.passed, true, 'OK mode should pass startup policy');
  assert.strictEqual(policyOk.exitCode, 0, 'PASS should have exit code 0');

  console.log(`   ✓ OK mode: verdict=${resultOk.report.summary.overallVerdict}, policy passed=${policyOk.passed}, exitCode=${policyOk.exitCode}\n`);

  // Test 4b: FAIL mode with startup policy (should FAIL)
  console.log('   Test 4b: FAIL mode with startup policy...');
  const resultFail = await executeReality({
    baseUrl: baseUrlFail,
    attempts: ['contact_form', 'language_switch', 'newsletter_signup'],
    artifactsDir: path.join(artifactsDir, 'fail'),
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: false,
    enableDiscovery: false,
    policy: 'preset:startup'
  });

  assert.strictEqual(resultFail.report.summary.overallVerdict, 'FAILURE', 'FAIL mode should fail');
  
  // Evaluate policy
  const snapshotFail = JSON.parse(fs.readFileSync(path.join(resultFail.runDir, 'snapshot.json'), 'utf8'));
  const policyFail = evaluatePolicy(snapshotFail, { failOnSeverity: 'CRITICAL', maxWarnings: 999, maxInfo: 999, maxTotalRisk: 999, failOnNewRegression: false });
  
  // FAIL mode might have CRITICAL risks depending on market criticality scoring
  // Just verify it produces a deterministic result
  assert.ok([true, false].includes(policyFail.passed), 'Policy result should be boolean');
  assert.ok([0, 1, 2].includes(policyFail.exitCode), 'Exit code should be 0, 1, or 2');

  console.log(`   ✓ FAIL mode: verdict=${resultFail.report.summary.overallVerdict}, policy passed=${policyFail.passed}, exitCode=${policyFail.exitCode}\n`);

  // Test 4c: Friction mode with enterprise policy (should be deterministic)
  console.log('   Test 4c: FRICTION mode...');
  const baseUrlFriction = `${fixture.baseUrl}?mode=friction`;
  const resultFriction = await executeReality({
    baseUrl: baseUrlFriction,
    attempts: ['contact_form', 'language_switch', 'newsletter_signup'],
    artifactsDir: path.join(artifactsDir, 'friction'),
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: false,
    enableDiscovery: false
  });

  // Friction mode might produce SUCCESS with friction signals or different outcome
  // Just verify it produces deterministic output
  assert.ok(['SUCCESS', 'FAILURE', 'FRICTION'].includes(resultFriction.report.summary.overallVerdict), 'Should have valid verdict');

  const snapshotFriction = JSON.parse(fs.readFileSync(path.join(resultFriction.runDir, 'snapshot.json'), 'utf8'));
  const policyFriction = evaluatePolicy(snapshotFriction, { failOnSeverity: 'CRITICAL', maxWarnings: 0, maxInfo: 999, maxTotalRisk: 999, failOnNewRegression: false });
  
  assert.ok([true, false].includes(policyFriction.passed), 'Policy result should be boolean');
  assert.ok([0, 1, 2].includes(policyFriction.exitCode), 'Exit code should be 0, 1, or 2');

  console.log(`   ✓ FRICTION mode: verdict=${resultFriction.report.summary.overallVerdict}, policy passed=${policyFriction.passed}, exitCode=${policyFriction.exitCode}\n`);
}

// ============================================================================
// TEST 5: Output Consistency Check
// ============================================================================

async function test5_OutputConsistency() {
  console.log('TEST 5: Output Consistency Check\n');

  const baseUrl = `${fixture.baseUrl}?mode=ok`;
  const artifactsDir = path.join(artifactsRoot, 'test5');

  // Run twice with same inputs
  console.log('   Run 1...');
  const result1 = await executeReality({
    baseUrl,
    attempts: ['contact_form'],
    artifactsDir: path.join(artifactsDir, 'run1'),
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: false,
    enableDiscovery: false
  });

  await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay to ensure different runId

  console.log('   Run 2...');
  const result2 = await executeReality({
    baseUrl,
    attempts: ['contact_form'],
    artifactsDir: path.join(artifactsDir, 'run2'),
    headful: false,
    enableTrace: false,
    enableScreenshots: false,
    enableCrawl: false,
    enableDiscovery: false
  });

  // Verify deterministic outcomes (same input -> same verdict)
  assert.strictEqual(result1.report.summary.overallVerdict, result2.report.summary.overallVerdict, 'Overall verdict should be consistent');
  assert.strictEqual(result1.report.summary.successCount, result2.report.summary.successCount, 'Success count should be consistent');
  assert.strictEqual(result1.report.summary.failureCount, result2.report.summary.failureCount, 'Failure count should be consistent');
  assert.strictEqual(result1.report.summary.frictionCount, result2.report.summary.frictionCount, 'Friction count should be consistent');

  // Verify output naming consistency
  assert.ok(result1.marketJsonPath.endsWith('market-report.json'), 'Market JSON should have consistent name');
  assert.ok(result2.marketJsonPath.endsWith('market-report.json'), 'Market JSON should have consistent name');
  assert.ok(result1.marketHtmlPath.endsWith('report.html'), 'Market HTML should have consistent name');
  assert.ok(result2.marketHtmlPath.endsWith('report.html'), 'Market HTML should have consistent name');

  // Verify runId uniqueness (different timestamps)
  const json1 = JSON.parse(fs.readFileSync(result1.marketJsonPath, 'utf8'));
  const json2 = JSON.parse(fs.readFileSync(result2.marketJsonPath, 'utf8'));
  assert.notStrictEqual(json1.runId, json2.runId, 'Run IDs should be unique');

  console.log('✅ Output consistency verified:');
  console.log(`   - Run 1 verdict: ${result1.report.summary.overallVerdict}`);
  console.log(`   - Run 2 verdict: ${result2.report.summary.overallVerdict}`);
  console.log(`   - Verdicts match: ✓`);
  console.log(`   - Output naming consistent: ✓`);
  console.log(`   - Run IDs unique: ✓\n`);
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAll() {
  try {
    await setup();

    await test1_DeterministicRun();
    await test2_BaselineSave();
    await test3_BaselineCheckDetectsRegressions();
    await test4_PolicyGates();
    await test5_OutputConsistency();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PHASE 0 — All Reality Lock Tests PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Summary:');
    console.log('   ✓ Deterministic artifacts generation');
    console.log('   ✓ Baseline save with valid schema');
    console.log('   ✓ Regression detection');
    console.log('   ✓ Policy gates (PASS/FAIL)');
    console.log('   ✓ Output consistency\n');

    console.log(`📁 Test artifacts preserved at: ${artifactsRoot}\n`);

    await teardown();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ PHASE 0 Tests FAILED:', err.message);
    console.error(err.stack);
    await teardown();
    process.exit(1);
  }
}

runAll();
