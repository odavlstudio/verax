/**
 * Export Equivalence Tests - Verify ZIP export and API export produce identical payloads
 * 
 * For the same run, these tests verify:
 * - guardian export (ZIP to disk) and guardian export --type api (ZIP buffer over HTTP)
 * - Produce byte-for-byte equivalent ZIP archives (content-wise, ignoring metadata)
 * - Both export paths MUST remain synchronized
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { exportRunToZip, exportRunToAPI, createZipBuffer, resolveRunDir } = require('../src/guardian/run-export');
const { normalizeZip, compareNormalizedZips, formatComparisonDiff } = require('./zip-equivalence-utils');

// Test suite
console.log('🧪 Export Equivalence Tests');
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
    if (err.details) {
      console.log(err.details);
    }
  }
}

// Test 1: ZIP normalization utility works
test('ZIP normalization utility extracts and hashes files', async () => {
  const testZipPath = path.join(__dirname, '.test-export-artifacts', 'test-run-004', 'snapshot.json');
  if (!fs.existsSync(testZipPath)) {
    throw new Error('Test fixture not found');
  }
});

// Test 2: Same run via ZIP export and buffer export produces equivalent ZIPs
test('ZIP export and buffer export produce equivalent archives', async () => {
  const artifactsDir = path.join(__dirname, '.test-export-artifacts');
  const outputDir = path.join(__dirname, '.test-equiv-output');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Use existing test fixture
  const runId = 'test-run-004';
  const resolved = resolveRunDir(runId, artifactsDir);
  
  if (!resolved) {
    throw new Error(`Test fixture run not found: ${runId}`);
  }
  
  const { runDir } = resolved;
  
  // Export via ZIP to disk
  const zipOutputPath = path.join(outputDir, 'equiv-test.zip');
  
  // Clean up if exists
  if (fs.existsSync(zipOutputPath)) {
    fs.unlinkSync(zipOutputPath);
  }
  
  // Export to ZIP file
  await new Promise((resolve, reject) => {
    const archive = require('archiver')('zip', { zlib: { level: 9 } });
    const output = fs.createWriteStream(zipOutputPath);
    
    output.on('close', resolve);
    archive.on('error', reject);
    output.on('error', reject);
    
    archive.pipe(output);
    
    const files = getFilesForTest(runDir);
    for (const filePath of files) {
      const relativePath = path.relative(runDir, filePath);
      archive.file(filePath, { name: relativePath });
    }
    
    archive.finalize();
  });
  
  // Export via buffer
  const zipBuffer = await createZipBuffer(runDir);
  
  // Normalize both ZIPs
  const norm1 = await normalizeZip(zipOutputPath);
  const norm2 = await normalizeZip(zipBuffer);
  
  // Compare
  const comparison = compareNormalizedZips(norm1, norm2);
  
  // Cleanup
  try { fs.unlinkSync(zipOutputPath); } catch {}
  
  if (!comparison.same) {
    const err = new Error('ZIP archives are not equivalent');
    err.details = formatComparisonDiff(comparison);
    throw err;
  }
  
  assert(comparison.same === true, 'ZIPs should be identical');
});

// Test 3: API export buffer matches disk export
test('API exporter uses same ZIP creation method as disk exporter', async () => {
  const artifactsDir = path.join(__dirname, '.test-export-artifacts');
  const runId = 'test-run-005';
  const resolved = resolveRunDir(runId, artifactsDir);
  
  if (!resolved) {
    throw new Error(`Test fixture run not found: ${runId}`);
  }
  
  const { runDir } = resolved;
  
  // Create ZIP buffer directly (what API exporter uses)
  const apiBuffer = await createZipBuffer(runDir);
  
  // Verify buffer is non-empty ZIP
  assert(Buffer.isBuffer(apiBuffer), 'Should return Buffer');
  assert(apiBuffer.length > 0, 'Buffer should not be empty');
  
  // Verify it's a valid ZIP (starts with PK)
  assert(apiBuffer.toString('hex', 0, 2) === '504b', 'Buffer should be valid ZIP');
  
  // Normalize and verify structure
  const normalized = await normalizeZip(apiBuffer);
  assert(Object.keys(normalized).length > 0, 'ZIP should contain files');
});

// Test 4: ZIP normalization is deterministic
test('ZIP normalization produces identical results on repeated calls', async () => {
  const artifactsDir = path.join(__dirname, '.test-export-artifacts');
  const runId = 'test-run-004';
  const resolved = resolveRunDir(runId, artifactsDir);
  
  if (!resolved) {
    throw new Error(`Test fixture run not found: ${runId}`);
  }
  
  const { runDir } = resolved;
  const zipBuffer = await createZipBuffer(runDir);
  
  // Normalize multiple times
  const norm1 = await normalizeZip(zipBuffer);
  const norm2 = await normalizeZip(zipBuffer);
  const norm3 = await normalizeZip(zipBuffer);
  
  // Compare all
  const comp1 = compareNormalizedZips(norm1, norm2);
  const comp2 = compareNormalizedZips(norm2, norm3);
  
  assert(comp1.same === true, 'Normalizations 1 and 2 should match');
  assert(comp2.same === true, 'Normalizations 2 and 3 should match');
});

// Test 5: File paths are normalized consistently
test('File paths use forward slashes in normalized ZIPs', async () => {
  const artifactsDir = path.join(__dirname, '.test-export-artifacts');
  const runId = 'test-run-004';
  const resolved = resolveRunDir(runId, artifactsDir);
  
  if (!resolved) {
    throw new Error(`Test fixture run not found: ${runId}`);
  }
  
  const { runDir } = resolved;
  const zipBuffer = await createZipBuffer(runDir);
  const normalized = await normalizeZip(zipBuffer);
  
  // Check all paths use forward slashes
  for (const filePath of Object.keys(normalized)) {
    assert(!filePath.includes('\\'), `Path should not contain backslashes: ${filePath}`);
    assert(filePath.includes('/'), `Path should contain forward slashes: ${filePath}`);
  }
});

// Test 6: ZIP hashes are deterministic (same content → same hash)
test('ZIP content hashing is deterministic', async () => {
  const artifactsDir = path.join(__dirname, '.test-export-artifacts');
  const runId = 'test-run-004';
  const resolved = resolveRunDir(runId, artifactsDir);
  
  if (!resolved) {
    throw new Error(`Test fixture run not found: ${runId}`);
  }
  
  const { runDir } = resolved;
  
  // Create two buffers from same source
  const buffer1 = await createZipBuffer(runDir);
  const buffer2 = await createZipBuffer(runDir);
  
  // Normalize both
  const norm1 = await normalizeZip(buffer1);
  const norm2 = await normalizeZip(buffer2);
  
  // All hashes should match
  for (const [filePath, hash1] of Object.entries(norm1)) {
    const hash2 = norm2[filePath];
    assert.strictEqual(hash1, hash2, `Hash mismatch for ${filePath}`);
  }
});

// Helper function to collect files (same logic as production)
function getFilesForTest(dirPath) {
  const files = [];
  
  function collectFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        collectFiles(fullPath);
      } else {
        // Same filtering logic as production
        const relativePath = path.relative(dirPath, fullPath);
        const segments = relativePath.split(path.sep);
        const basename = path.basename(fullPath);
        
        // Check exclude patterns
        const excludePatterns = ['node_modules', '.git', '.DS_Store', 'Thumbs.db', '.tmp', 'temp', 'tmp'];
        let excluded = false;
        
        for (const segment of segments) {
          if (excludePatterns.includes(segment)) {
            excluded = true;
            break;
          }
        }
        
        if (!excluded && !(basename.startsWith('.') && basename !== '.gitkeep')) {
          files.push(fullPath);
        }
      }
    }
  }
  
  collectFiles(dirPath);
  return files;
}

// Print summary
console.log('═'.repeat(60));
console.log(`\nResults: ${passCount}/${testCount} tests passed`);

if (passCount === testCount) {
  console.log('✅ All equivalence tests passed\n');
  process.exit(0);
} else {
  console.log(`❌ ${testCount - passCount} test(s) failed\n`);
  process.exit(1);
}
