/**
 * Snapshot v1 + Auto-baseline Tests
 * Validates the new Market Reality Snapshot behavior
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const packageJson = require('../package.json');
const { startFixtureServer } = require('./fixture-server');
const { executeReality } = require('../src/guardian/reality');
const { SnapshotBuilder, saveSnapshot, loadSnapshot } = require('../src/guardian/snapshot');
const { baselineExists, loadBaseline, urlToSlug, getBaselineFilePath } = require('../src/guardian/baseline-storage');

async function runTests() {
  console.log('\n🧪 Snapshot v1 + Auto-Baseline Tests');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Start fixture server
  console.log('🔨 Starting fixture server...');
  const fixture = await startFixtureServer();
  console.log(`✅ Fixture running at ${fixture.baseUrl}`);

  // Use temp directory for all test storage
  const tempStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-snapshot-'));
  const tempArtifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-artifacts-'));

  let testsPassed = 0;
  let testsFailed = 0;

  // ========== TEST 1: Snapshot Schema Validation ==========
  console.log('\n📋 Test 1: Snapshot schema validation');
  try {
    const builder = new SnapshotBuilder(fixture.baseUrl, 'test-run-1', packageJson.version);
    builder.setArtifactDir(tempArtifactsDir);

    const snapshot = builder.getSnapshot();

    // Validate required fields
    assert.strictEqual(snapshot.schemaVersion, 'v1', 'schemaVersion should be v1');
    assert.ok(snapshot.meta.createdAt, 'meta.createdAt required');
    assert.ok(snapshot.meta.url, 'meta.url required');
    assert.ok(snapshot.meta.runId, 'meta.runId required');
    assert.ok(Array.isArray(snapshot.attempts), 'attempts must be array');
    assert.ok(Array.isArray(snapshot.signals), 'signals must be array');
    assert.ok(snapshot.evidence, 'evidence required');
    assert.ok(snapshot.baseline, 'baseline required');

    console.log('✅ Test 1 passed: Snapshot schema valid');
    testsPassed++;
  } catch (err) {
    console.error(`❌ Test 1 failed: ${err.message}`);
    testsFailed++;
  }

  // ========== TEST 2: Auto-baseline on first run ==========
  console.log('\n📋 Test 2: Auto-baseline created on first reality run');
  try {
    const testUrl = `${fixture.baseUrl}?mode=ok`;

    // Verify no baseline exists
    assert.strictEqual(baselineExists(testUrl, tempStorageDir), false, 'Baseline should not exist yet');

    // Run reality
    const result1 = await executeReality({
      baseUrl: testUrl,
      artifactsDir: path.join(tempArtifactsDir, 'test2-run1'),
      storageDir: tempStorageDir,
      enableCrawl: false, // Skip crawl for speed
      headful: false,
      enableTrace: false,
      enableScreenshots: false
    });

    // Verify baseline was created
    assert.strictEqual(baselineExists(testUrl, tempStorageDir), true, 'Baseline should exist after first run');
    assert.strictEqual(result1.baselineCreated, true, 'baselineCreated flag should be true');
    assert.strictEqual(result1.exitCode, 0, 'First run should exit with 0');

    // Verify snapshot file exists
    assert.ok(fs.existsSync(result1.snapshotPath), 'snapshot.json should exist');

    const snapshot1 = loadSnapshot(result1.snapshotPath);
    assert.ok(snapshot1, 'snapshot.json should be valid JSON');
    assert.strictEqual(snapshot1.baseline.baselineCreatedThisRun, true, 'baseline.baselineCreatedThisRun should be true');

    console.log('✅ Test 2 passed: Auto-baseline created on first run');
    testsPassed++;
  } catch (err) {
    console.error(`❌ Test 2 failed: ${err.message}`);
    testsFailed++;
  }

  // ========== TEST 3: Second run compares against baseline ==========
  console.log('\n📋 Test 3: Second run compares against baseline');
  try {
    const testUrl = `${fixture.baseUrl}?mode=ok`;

    // First run (if not done by Test 2)
    if (!baselineExists(testUrl, tempStorageDir)) {
      await executeReality({
        baseUrl: testUrl,
        artifactsDir: path.join(tempArtifactsDir, 'test3-run1'),
        storageDir: tempStorageDir,
        enableCrawl: false,
        headful: false,
        enableTrace: false,
        enableScreenshots: false
      });
    }

    // Second run
    const result2 = await executeReality({
      baseUrl: testUrl,
      artifactsDir: path.join(tempArtifactsDir, 'test3-run2'),
      storageDir: tempStorageDir,
      enableCrawl: false,
      headful: false,
      enableTrace: false,
      enableScreenshots: false
    });

    assert.strictEqual(result2.baselineCreated, false, 'baselineCreated should be false on second run');
    assert.ok(result2.diffResult, 'diffResult should exist on second run');

    const snapshot2 = loadSnapshot(result2.snapshotPath);
    assert.strictEqual(snapshot2.baseline.baselineFound, true, 'baseline.baselineFound should be true');

    console.log('✅ Test 3 passed: Second run compares against baseline');
    testsPassed++;
  } catch (err) {
    console.error(`❌ Test 3 failed: ${err.message}`);
    testsFailed++;
  }

  // ========== TEST 4: URL to slug conversion safety ==========
  console.log('\n📋 Test 4: URL to slug conversion (collision safety)');
  try {
    const slug1 = urlToSlug('https://example.com');
    const slug2 = urlToSlug('https://example.com:8080');
    const slug3 = urlToSlug('https://example.com/path');

    assert.ok(slug1, 'slug should be generated');
    assert.notStrictEqual(slug1, slug2, 'different URLs should produce different slugs');
    assert.notStrictEqual(slug1, slug3, 'different paths should produce different slugs');
    // Slug includes hostname and hash for uniqueness
    assert.ok(slug1.length > 8, 'slug should have reasonable length with hash');

    console.log('✅ Test 4 passed: URL slugs are safe and unique');
    testsPassed++;
  } catch (err) {
    console.error(`❌ Test 4 failed: ${err.message}`);
    testsFailed++;
  }

  // ========== TEST 5: Snapshot with attempt results ==========
  console.log('\n📋 Test 5: Snapshot includes attempt results and signals');
  try {
    const result = await executeReality({
      baseUrl: `${fixture.baseUrl}?mode=ok`,
      artifactsDir: path.join(tempArtifactsDir, 'test5'),
      storageDir: tempStorageDir,
      enableCrawl: false,
      headful: false,
      enableTrace: false,
      enableScreenshots: false
    });

    const snapshot = loadSnapshot(result.snapshotPath);

    assert.ok(Array.isArray(snapshot.attempts), 'snapshot.attempts should be array');
    assert.ok(snapshot.attempts.length > 0, 'snapshot should have at least one attempt');

    const firstAttempt = snapshot.attempts[0];
    assert.ok(firstAttempt.attemptId, 'attempt should have id');
    assert.ok(firstAttempt.outcome, 'attempt should have outcome');
    assert.ok(['SUCCESS', 'FAILURE', 'FRICTION'].includes(firstAttempt.outcome), 'outcome should be valid');

    // Check signals
    assert.ok(Array.isArray(snapshot.signals), 'snapshot.signals should be array');

    console.log('✅ Test 5 passed: Snapshot includes attempt results');
    testsPassed++;
  } catch (err) {
    console.error(`❌ Test 5 failed: ${err.message}`);
    testsFailed++;
  }

  // ========== TEST 6: Atomic snapshot save ==========
  console.log('\n📋 Test 6: Atomic snapshot save (no partial writes)');
  try {
    const testPath = path.join(tempStorageDir, 'atomic-test', 'snapshot.json');
    const testData = { test: 'data', timestamp: new Date().toISOString() };

    await saveSnapshot(testData, testPath);

    assert.ok(fs.existsSync(testPath), 'snapshot file should exist');
    assert.ok(!fs.existsSync(`${testPath}.tmp`), 'no temp file should be left');

    const loaded = loadSnapshot(testPath);
    assert.deepStrictEqual(loaded, testData, 'saved and loaded data should match');

    console.log('✅ Test 6 passed: Atomic snapshot save works');
    testsPassed++;
  } catch (err) {
    console.error(`❌ Test 6 failed: ${err.message}`);
    testsFailed++;
  }

  // ========== TEST 7: Evidence paths in snapshot ==========
  console.log('\n📋 Test 7: Evidence artifact paths in snapshot');
  try {
    const result = await executeReality({
      baseUrl: `${fixture.baseUrl}?mode=ok`,
      artifactsDir: path.join(tempArtifactsDir, 'test7'),
      storageDir: tempStorageDir,
      enableCrawl: false,
      headful: false,
      enableTrace: false,
      enableScreenshots: false
    });

    const snapshot = loadSnapshot(result.snapshotPath);

    assert.ok(snapshot.evidence.artifactDir, 'evidence.artifactDir required');
    assert.ok(snapshot.evidence.marketReportJson, 'evidence.marketReportJson should be set');
    assert.ok(snapshot.evidence.marketReportHtml || true, 'evidence may have html report');
    assert.ok(typeof snapshot.evidence.attemptArtifacts === 'object', 'evidence.attemptArtifacts should be object');

    console.log('✅ Test 7 passed: Evidence paths tracked in snapshot');
    testsPassed++;
  } catch (err) {
    console.error(`❌ Test 7 failed: ${err.message}`);
    testsFailed++;
  }

  // ========== CLEANUP ==========
  console.log('\n🧹 Cleaning up...');
  try {
    await fixture.server.close();
    console.log('✅ Fixture server closed');
  } catch (err) {
    // Ignore cleanup errors
  }

  // ========== SUMMARY ==========
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n✅ Tests passed: ${testsPassed}`);
  console.log(`❌ Tests failed: ${testsFailed}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('❌ Test suite error:', err);
  process.exit(1);
});
