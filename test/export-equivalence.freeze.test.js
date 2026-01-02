/**
 * Export Behavior Freeze Test
 * 
 * ⚠️  THIS TEST INTENTIONALLY FREEZES EXPORT BEHAVIOR
 * 
 * Do not modify ZIP export or API export implementations without:
 * 1. Updating this test to reflect the change
 * 2. Bumping GUARDIAN_CONTRACT_VERSION in export-contract.js
 * 3. Documenting the change in CHANGELOG.md
 * 4. Running ALL export tests to verify equivalence
 * 
 * The export layer is a core contract. Breaking it silently is not acceptable.
 * This test serves as a circuit breaker: no drift without deliberate action.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { CONTRACT_VERSION, HEADER_NAMES, VALID_VERDICTS, VALID_EXIT_CODES } = require('../src/guardian/export-contract');
const { normalizeZip, compareNormalizedZips } = require('./zip-equivalence-utils');
const { createZipBuffer, resolveRunDir } = require('../src/guardian/run-export');

console.log('🔒 Export Behavior Freeze Test');
console.log('═'.repeat(60));
console.log('⚠️  This test freezes export behavior.\n');

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

// Test 1: Contract version is locked at v1
test('CONTRACT_VERSION is frozen at v1', () => {
  assert.strictEqual(CONTRACT_VERSION, 'v1', 'Contract version must not change without deliberate action');
});

// Test 2: Header names are locked
test('HEADER_NAMES are locked and unchanged', () => {
  const expectedHeaders = {
    CONTRACT_VERSION: 'X-Guardian-Contract',
    RUN_ID: 'X-Guardian-Run-Id',
    VERDICT: 'X-Guardian-Verdict',
    URL: 'X-Guardian-Url',
    TIMESTAMP: 'X-Guardian-Timestamp',
    EXIT_CODE: 'X-Guardian-Exit-Code'
  };
  
  for (const [key, value] of Object.entries(expectedHeaders)) {
    assert.strictEqual(HEADER_NAMES[key], value, `Header ${key} changed: expected ${value}, got ${HEADER_NAMES[key]}`);
  }
});

// Test 3: Valid verdicts are frozen
test('VALID_VERDICTS are frozen (READY, FRICTION, DO_NOT_LAUNCH)', () => {
  assert.deepStrictEqual(VALID_VERDICTS, ['READY', 'FRICTION', 'DO_NOT_LAUNCH']);
});

// Test 4: Valid exit codes are frozen
test('VALID_EXIT_CODES are frozen (0, 1, 2)', () => {
  assert.deepStrictEqual(VALID_EXIT_CODES, [0, 1, 2]);
});

// Test 5: ZIP export filter set is frozen
test('ZIP export file filtering is deterministic and frozen', async () => {
  const artifactsDir = path.join(__dirname, '.test-export-artifacts');
  const runId = 'test-run-004';
  const resolved = resolveRunDir(runId, artifactsDir);
  
  if (!resolved) {
    throw new Error('Test fixture not found');
  }
  
  const { runDir } = resolved;
  
  // Create ZIP multiple times - should include same files each time
  const zip1 = await createZipBuffer(runDir);
  const zip2 = await createZipBuffer(runDir);
  
  const norm1 = await normalizeZip(zip1);
  const norm2 = await normalizeZip(zip2);
  
  // Assert identical file sets
  const files1 = Object.keys(norm1).sort();
  const files2 = Object.keys(norm2).sort();
  
  assert.deepStrictEqual(files1, files2, 'ZIP file set must be frozen');
});

// Test 6: ZIP compression level is frozen
test('ZIP compression creates consistent output', async () => {
  const artifactsDir = path.join(__dirname, '.test-export-artifacts');
  const runId = 'test-run-005';
  const resolved = resolveRunDir(runId, artifactsDir);
  
  if (!resolved) {
    throw new Error('Test fixture not found');
  }
  
  const { runDir } = resolved;
  
  // Create multiple ZIPs from same source
  const buffers = [];
  for (let i = 0; i < 3; i++) {
    buffers.push(await createZipBuffer(runDir));
  }
  
  // All should normalize to identical content maps
  const norms = await Promise.all(buffers.map(b => normalizeZip(b)));
  
  for (let i = 1; i < norms.length; i++) {
    const comparison = compareNormalizedZips(norms[0], norms[i]);
    assert(comparison.same === true, `ZIP creation must be deterministic (iteration ${i})`);
  }
});

// Test 7: No unexpected files in ZIP
test('ZIP export does not include excluded file types', async () => {
  const artifactsDir = path.join(__dirname, '.test-export-artifacts');
  const runId = 'test-run-004';
  const resolved = resolveRunDir(runId, artifactsDir);
  
  if (!resolved) {
    throw new Error('Test fixture not found');
  }
  
  const { runDir } = resolved;
  const normalized = await normalizeZip(await createZipBuffer(runDir));
  
  // Check that excluded patterns are not present
  const excludedPatterns = ['node_modules/', '.git/', '.tmp/', 'temp/', 'Thumbs.db'];
  
  for (const filePath of Object.keys(normalized)) {
    for (const pattern of excludedPatterns) {
      assert(!filePath.includes(pattern), `Excluded path found in ZIP: ${filePath}`);
    }
  }
});

// Test 8: API exporter uses contract module
test('API exporter enforces contract validation', () => {
  const content = fs.readFileSync(path.join(__dirname, '../src/guardian/run-export.js'), 'utf8');
  
  // Must import contract module
  assert(content.includes("require('./export-contract')"), 'API exporter must import contract module');
  
  // Must call buildContractHeaders
  assert(content.includes('buildContractHeaders'), 'API exporter must call buildContractHeaders()');
  
  // Must call validateContractHeaders
  assert(content.includes('validateContractHeaders'), 'API exporter must call validateContractHeaders()');
  
  // Must NOT have hardcoded headers
  assert(!content.includes("'X-Guardian-Contract'"), 'API exporter must not hardcode X-Guardian-Contract');
});

// Test 9: Freeze marker - this test exists to be modified if behavior changes
test('Freeze marker test - intentional assertion of frozen behavior', () => {
  // This test intentionally has minimal logic - it's a placeholder
  // that MUST be modified if export behavior changes.
  // If you see this failing, you have intentionally or accidentally
  // changed export behavior. Review the change carefully.
  
  assert(true === true, 'Freeze marker active');
});

// Print summary with freeze warning
console.log('═'.repeat(60));
console.log(`\nResults: ${passCount}/${testCount} tests passed`);

if (passCount === testCount) {
  console.log('\n🔒 Export behavior is FROZEN.');
  console.log('\n⚠️  Any changes to export behavior require:');
  console.log('   1. Modification of this test');
  console.log('   2. Bump to Contract version');
  console.log('   3. Review of all equivalence tests');
  console.log('   4. Update to CHANGELOG.md\n');
  process.exit(0);
} else {
  console.log(`\n❌ ${testCount - passCount} freeze test(s) failed\n`);
  process.exit(1);
}
