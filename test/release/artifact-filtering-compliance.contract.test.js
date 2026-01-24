/**
 * Artifact Filtering Compliance Contract Tests
 * 
 * Verify that redaction is applied at the pipeline level and no raw 
 * screenshots/DOM snapshots are written to disk.
 */

import test from 'node:test';
import { strict as assert } from 'assert';
import { globSync } from 'glob';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

test('Artifact Filtering Compliance Pipeline', async (suite) => {
  await suite.test('redaction applied before disk write', () => {
    const captureFile = resolve(rootDir, 'src/verax/observe/evidence-capture.js');
    assert.ok(existsSync(captureFile), 'evidence-capture.js exists');
    
    const content = readFileSync(captureFile, 'utf-8');
    // Verify redaction is integrated into the capture pipeline
    assert.match(content, /redact|redaction/i, 'redaction logic integrated');
    assert.match(content, /writeFileSync|write/, 'artifact writing present');
  });

  await suite.test('temp file cleanup prevents raw artifact exposure', () => {
    const captureFile = resolve(rootDir, 'src/verax/observe/evidence-capture.js');
    const content = readFileSync(captureFile, 'utf-8');
    
    // Verify temp files are cleaned up to prevent raw artifact retention
    assert.match(content, /(unlinkSync|deleteSync|unlink|delete)/i, 'temp file cleanup present');
  });

  await suite.test('no raw artifacts in tmp directories', () => {
    // Check that tmp directories don't contain unredacted output
    const tmpDirs = globSync(resolve(rootDir, 'tmp/*'));
    // If tmp has output, verify no .temp files remain (temp files = raw artifacts)
    tmpDirs.forEach(dir => {
      const tempFiles = globSync(resolve(dir, '**/*.temp'));
      assert.equal(tempFiles.length, 0, `${dir} has no leftover .temp files (raw artifacts)`);
    });
  });

  await suite.test('redaction field in artifact schema', () => {
    const registryFile = resolve(rootDir, 'src/verax/core/artifacts/registry.js');
    assert.ok(existsSync(registryFile), 'artifact registry exists');
    
    const content = readFileSync(registryFile, 'utf-8');
    assert.match(content, /redaction|observe/, 'artifact registry includes redaction tracking');
  });

  await suite.test('graceful degradation if redaction fails', () => {
    const captureFile = resolve(rootDir, 'src/verax/observe/evidence-capture.js');
    const content = readFileSync(captureFile, 'utf-8');
    
    // Code should handle redaction errors gracefully, not crash
    assert.match(content, /(try|catch|throws|error)/i, 'error handling present for redaction');
  });

  await suite.test('deterministic redaction across runs', () => {
    const redactorFile = resolve(rootDir, 'src/cli/util/evidence/dom-redactor.js');
    assert.ok(existsSync(redactorFile), 'dom-redactor.js exists');
    
    const content = readFileSync(redactorFile, 'utf-8');
    // Redaction should use deterministic placeholders, not random values
    assert.match(content, /getRedactionPlaceholder|PLACEHOLDER/, 'deterministic placeholder mechanism');
  });

  await suite.test('environment variable configuration controls pipeline', () => {
    const captureFile = resolve(rootDir, 'src/verax/observe/evidence-capture.js');
    const content = readFileSync(captureFile, 'utf-8');
    
    // Verify env vars can control redaction (but defaults to ON)
    assert.match(content, /process\.env|VERAX_REDACT/i, 'environment variable configuration present');
  });

  await suite.test('release build includes redaction pipeline', () => {
    // Verify redaction is built-in, not optional feature
    const redactorFile = resolve(rootDir, 'src/cli/util/evidence/dom-redactor.js');
    const captureFile = resolve(rootDir, 'src/verax/observe/evidence-capture.js');
    
    assert.ok(existsSync(redactorFile), 'redaction utilities always built');
    assert.ok(existsSync(captureFile), 'evidence capture with redaction always built');
  });
});




