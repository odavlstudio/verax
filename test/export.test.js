/**
 * Export Command Tests
 * Tests for guardian export functionality
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { exportRun, resolveRunDir, shouldIncludeFile, collectFiles } = require('../src/guardian/run-export');
const archiver = require('archiver');

const TEST_ARTIFACTS_DIR = path.join(__dirname, '.test-export-artifacts');
const TEST_OUTPUT_DIR = path.join(__dirname, '.test-export-output');

// Test fixture: minimal Guardian run structure
function createTestRun(runId, url, verdict) {
  const runDir = path.join(TEST_ARTIFACTS_DIR, runId);
  
  fs.mkdirSync(runDir, { recursive: true });
  
  // Create META.json
  const meta = {
    version: 1,
    timestamp: new Date().toISOString(),
    url: url,
    siteSlug: url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-'),
    policy: 'custom',
    result: verdict,
    durationMs: 12345,
    attempts: []
  };
  fs.writeFileSync(path.join(runDir, 'META.json'), JSON.stringify(meta, null, 2));
  
  // Create decision.json
  const decision = {
    runId,
    url,
    finalVerdict: verdict,
    exitCode: verdict === 'READY' ? 0 : 1,
    timestamp: meta.timestamp
  };
  fs.writeFileSync(path.join(runDir, 'decision.json'), JSON.stringify(decision, null, 2));
  
  // Create summary.md
  fs.writeFileSync(path.join(runDir, 'summary.md'), `# Guardian Run Summary\n\nVerdict: ${verdict}\n`);
  
  // Create snapshot.json
  fs.writeFileSync(path.join(runDir, 'snapshot.json'), JSON.stringify({ pages: [] }, null, 2));
  
  // Create manifest.json
  fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify({ files: [] }, null, 2));
  
  // Create report.html
  fs.writeFileSync(path.join(runDir, 'report.html'), '<html><body>Report</body></html>');
  
  // Create attempt folder with artifacts
  const attemptDir = path.join(runDir, 'site_smoke');
  fs.mkdirSync(attemptDir, { recursive: true });
  fs.writeFileSync(path.join(attemptDir, 'attempt.json'), JSON.stringify({ id: 'site_smoke' }));
  fs.writeFileSync(path.join(attemptDir, 'screenshot.png'), 'fake-image-data');
  
  return { runDir, runId, meta };
}

// Create LATEST.json pointer
function createLatestPointer(runId) {
  const meta = JSON.parse(fs.readFileSync(path.join(TEST_ARTIFACTS_DIR, runId, 'META.json'), 'utf8'));
  const pointer = {
    version: 1,
    timestamp: new Date().toISOString(),
    pointedRun: runId,
    pointedRunMeta: {
      timestamp: meta.timestamp,
      url: meta.url,
      siteSlug: meta.siteSlug,
      policy: meta.policy,
      result: meta.result,
      durationMs: meta.durationMs
    }
  };
  fs.writeFileSync(path.join(TEST_ARTIFACTS_DIR, 'LATEST.json'), JSON.stringify(pointer, null, 2));
}

// Cleanup test directories
function cleanup() {
  if (fs.existsSync(TEST_ARTIFACTS_DIR)) {
    fs.rmSync(TEST_ARTIFACTS_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
  }
}

// Extract ZIP for verification (simple check without unzip library)
function countZipEntries(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  // Simple ZIP validation: check magic bytes
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
    throw new Error('Not a valid ZIP file');
  }
  return true; // File is valid ZIP
}

// Run tests
async function runTests() {
  console.log('Running export command tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Setup
  cleanup();
  fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  
  // Test 1: shouldIncludeFile filters correctly
  try {
    console.log('Test 1: File filtering...');
    const runDir = '/fake/run';
    
    assert.strictEqual(shouldIncludeFile('/fake/run/decision.json', runDir), true, 'Should include decision.json');
    assert.strictEqual(shouldIncludeFile('/fake/run/node_modules/pkg/index.js', runDir), false, 'Should exclude node_modules');
    assert.strictEqual(shouldIncludeFile('/fake/run/.git/config', runDir), false, 'Should exclude .git');
    assert.strictEqual(shouldIncludeFile('/fake/run/.DS_Store', runDir), false, 'Should exclude .DS_Store');
    assert.strictEqual(shouldIncludeFile('/fake/run/temp/file.txt', runDir), false, 'Should exclude temp');
    assert.strictEqual(shouldIncludeFile('/fake/run/screenshot.png', runDir), true, 'Should include screenshot');
    
    console.log('  ✓ File filtering works correctly\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    failed++;
  }
  
  // Test 2: resolveRunDir with explicit runId
  try {
    console.log('Test 2: Resolve run directory with explicit runId...');
    const testRun = createTestRun('test-run-001', 'https://example.com', 'READY');
    
    const resolved = resolveRunDir('test-run-001', TEST_ARTIFACTS_DIR);
    assert(resolved !== null, 'Should resolve existing run');
    assert.strictEqual(resolved.runId, 'test-run-001', 'Should return correct runId');
    assert(resolved.meta, 'Should return meta');
    assert.strictEqual(resolved.meta.url, 'https://example.com', 'Should return correct URL');
    
    console.log('  ✓ Run directory resolution works\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    failed++;
  }
  
  // Test 3: resolveRunDir with LATEST pointer
  try {
    console.log('Test 3: Resolve run directory using LATEST pointer...');
    createTestRun('test-run-002', 'https://test.com', 'FRICTION');
    createLatestPointer('test-run-002');
    
    const resolved = resolveRunDir(null, TEST_ARTIFACTS_DIR);
    assert(resolved !== null, 'Should resolve latest run');
    assert.strictEqual(resolved.runId, 'test-run-002', 'Should return latest runId');
    assert.strictEqual(resolved.meta.url, 'https://test.com', 'Should return correct URL');
    
    console.log('  ✓ LATEST pointer resolution works\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    failed++;
  }
  
  // Test 4: resolveRunDir returns null for missing run
  try {
    console.log('Test 4: Handle missing run gracefully...');
    const resolved = resolveRunDir('nonexistent-run', TEST_ARTIFACTS_DIR);
    assert.strictEqual(resolved, null, 'Should return null for missing run');
    
    console.log('  ✓ Missing run handled correctly\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    failed++;
  }
  
  // Test 5: collectFiles gathers all artifacts
  try {
    console.log('Test 5: Collect files from run directory...');
    const testRun = createTestRun('test-run-003', 'https://collect.com', 'READY');
    
    const files = collectFiles(testRun.runDir, testRun.runDir);
    assert(files.length > 0, 'Should collect files');
    
    const filenames = files.map(f => path.basename(f));
    assert(filenames.includes('META.json'), 'Should include META.json');
    assert(filenames.includes('decision.json'), 'Should include decision.json');
    assert(filenames.includes('summary.md'), 'Should include summary.md');
    assert(filenames.includes('attempt.json'), 'Should include attempt artifacts');
    
    console.log(`  ✓ Collected ${files.length} files\n`);
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    failed++;
  }
  
  // Test 6: Export creates valid ZIP with correct content
  try {
    console.log('Test 6: Export run to ZIP file...');
    const testRun = createTestRun('test-run-004', 'https://export.com', 'READY');
    const outputPath = path.join(TEST_OUTPUT_DIR, 'test-export.zip');
    
    const exitCode = await exportRun({
      run: 'test-run-004',
      out: outputPath,
      artifactsDir: TEST_ARTIFACTS_DIR
    });
    
    assert.strictEqual(exitCode, 0, 'Should exit with code 0');
    assert(fs.existsSync(outputPath), 'ZIP file should exist');
    
    const stats = fs.statSync(outputPath);
    assert(stats.size > 0, 'ZIP file should not be empty');
    
    // Validate ZIP structure
    const isValidZip = countZipEntries(outputPath);
    assert(isValidZip, 'Should be valid ZIP file');
    
    console.log(`  ✓ Created ZIP file (${stats.size} bytes)\n`);
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    failed++;
  }
  
  // Test 7: Export latest run without explicit runId
  try {
    console.log('Test 7: Export latest run...');
    createTestRun('test-run-005', 'https://latest.com', 'READY');
    createLatestPointer('test-run-005');
    
    const outputPath = path.join(TEST_OUTPUT_DIR, 'test-export-latest.zip');
    
    const exitCode = await exportRun({
      run: null, // Use latest
      out: outputPath,
      artifactsDir: TEST_ARTIFACTS_DIR
    });
    
    assert.strictEqual(exitCode, 0, 'Should exit with code 0');
    assert(fs.existsSync(outputPath), 'ZIP file should exist');
    
    console.log('  ✓ Latest run exported successfully\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    failed++;
  }
  
  // Test 8: Export fails for missing run
  try {
    console.log('Test 8: Fail gracefully for missing run...');
    const outputPath = path.join(TEST_OUTPUT_DIR, 'test-export-missing.zip');
    
    const exitCode = await exportRun({
      run: 'nonexistent-run-999',
      out: outputPath,
      artifactsDir: TEST_ARTIFACTS_DIR
    });
    
    assert.strictEqual(exitCode, 2, 'Should exit with code 2 for missing run');
    assert(!fs.existsSync(outputPath), 'Should not create ZIP for missing run');
    
    console.log('  ✓ Missing run error handled correctly\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    failed++;
  }
  
  // Test 9: Export fails if output file exists
  try {
    console.log('Test 9: Fail if output file already exists...');
    const testRun = createTestRun('test-run-006', 'https://exists.com', 'READY');
    const outputPath = path.join(TEST_OUTPUT_DIR, 'test-export-exists.zip');
    
    // Create existing file
    fs.writeFileSync(outputPath, 'existing content');
    
    const exitCode = await exportRun({
      run: 'test-run-006',
      out: outputPath,
      artifactsDir: TEST_ARTIFACTS_DIR
    });
    
    assert.strictEqual(exitCode, 2, 'Should exit with code 2 for existing file');
    
    // File should still contain original content
    const content = fs.readFileSync(outputPath, 'utf8');
    assert.strictEqual(content, 'existing content', 'Should not overwrite existing file');
    
    console.log('  ✓ Existing file protection works\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    failed++;
  }
  
  // Test 10: Export fails if output directory doesn't exist
  try {
    console.log('Test 10: Fail if output directory does not exist...');
    const testRun = createTestRun('test-run-007', 'https://nodir.com', 'READY');
    const outputPath = path.join(TEST_OUTPUT_DIR, 'nonexistent', 'test.zip');
    
    const exitCode = await exportRun({
      run: 'test-run-007',
      out: outputPath,
      artifactsDir: TEST_ARTIFACTS_DIR
    });
    
    assert.strictEqual(exitCode, 2, 'Should exit with code 2 for missing directory');
    
    console.log('  ✓ Output directory validation works\n');
    passed++;
  } catch (err) {
    console.error('  ✗ FAILED:', err.message, '\n');
    failed++;
  }
  
  // Cleanup
  cleanup();
  
  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tests completed: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal test error:', err);
  cleanup();
  process.exit(1);
});
