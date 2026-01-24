/**
 *  Transactional Artifacts Tests
 * 
 * Verifies ALL-OR-NOTHING artifact writes with staging.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, rmSync, existsSync, writeFileSync, readdirSync as _readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';
import {
  createStagingDir,
  commitStagingDir,
  rollbackStagingDir,
  getStagingPath,
  getFinalPath,
  hasStagingDir,
  listStagingFiles,
} from '../../src/verax/core/integrity/transaction.js';

const testDir = join(tmpdir(), `verax-transaction-test-${getTimeProvider().now()}`);

describe(' Transactional Artifacts', () => {
  test.beforeEach(() => {
    if (rmSync(testDir, { recursive: true, force: true })) {
      // Cleanup
    }
    mkdirSync(testDir, { recursive: true });
  });
  
  test.afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });
  
  test('should create staging directory', () => {
    const result = createStagingDir(testDir);
    
    assert.strictEqual(result.ok, true);
    assert.strictEqual(typeof result.stagingDir, 'string');
    assert.ok(existsSync(result.stagingDir));
    assert.ok(result.stagingDir.endsWith('.staging'));
  });
  
  test('should clean up existing staging on create', () => {
    // Create staging with files
    const result1 = createStagingDir(testDir);
    writeFileSync(join(result1.stagingDir, 'old.json'), '{}');
    
    // Create again
    const result2 = createStagingDir(testDir);
    
    assert.strictEqual(result2.ok, true);
    assert.ok(existsSync(result2.stagingDir));
    assert.ok(!existsSync(join(result2.stagingDir, 'old.json')));
  });
  
  test('should commit staging directory atomically', () => {
    const result = createStagingDir(testDir);
    const stagingDir = result.stagingDir;
    
    // Write artifacts to staging
    writeFileSync(join(stagingDir, 'summary.json'), JSON.stringify({ test: 1 }));
    writeFileSync(join(stagingDir, 'findings.json'), JSON.stringify({ test: 2 }));
    
    // Commit
    const commitResult = commitStagingDir(testDir);
    
    assert.strictEqual(commitResult.ok, true);
    assert.ok(!existsSync(stagingDir)); // Staging removed
    
    // Check artifacts directory
    const artifactsDir = join(testDir, 'artifacts');
    assert.ok(existsSync(artifactsDir));
    assert.ok(existsSync(join(artifactsDir, 'summary.json')));
    assert.ok(existsSync(join(artifactsDir, 'findings.json')));
  });
  
  test('should fail commit if staging does not exist', () => {
    const result = commitStagingDir(testDir);
    
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.message.includes('does not exist'));
  });
  
  test('should rollback staging directory', () => {
    const result = createStagingDir(testDir);
    const stagingDir = result.stagingDir;
    
    writeFileSync(join(stagingDir, 'test.json'), '{}');
    
    const rollbackResult = rollbackStagingDir(testDir);
    
    assert.strictEqual(rollbackResult.ok, true);
    assert.ok(!existsSync(stagingDir));
  });
  
  test('should handle rollback when staging does not exist', () => {
    const result = rollbackStagingDir(testDir);
    assert.strictEqual(result.ok, true);
  });
  
  test('should get staging path', () => {
    const path = getStagingPath(testDir, 'summary.json');
    assert.ok(path.includes('.staging'));
    assert.ok(path.endsWith('summary.json'));
  });
  
  test('should get final path', () => {
    const path = getFinalPath(testDir, 'summary.json');
    assert.ok(path.includes('artifacts'));
    assert.ok(path.endsWith('summary.json'));
  });
  
  test('should check if staging directory exists', () => {
    assert.strictEqual(hasStagingDir(testDir), false);
    
    createStagingDir(testDir);
    assert.strictEqual(hasStagingDir(testDir), true);
    
    commitStagingDir(testDir);
    assert.strictEqual(hasStagingDir(testDir), false);
  });
  
  test('should list files in staging', () => {
    createStagingDir(testDir);
    const stagingDir = join(testDir, '.staging');
    
    writeFileSync(join(stagingDir, 'file1.json'), '{}');
    writeFileSync(join(stagingDir, 'file2.json'), '{}');
    
    const files = listStagingFiles(testDir);
    
    assert.strictEqual(files.length, 2);
    assert.ok(files.includes('file1.json'));
    assert.ok(files.includes('file2.json'));
  });
  
  test('should return empty list when staging does not exist', () => {
    const files = listStagingFiles(testDir);
    assert.strictEqual(files.length, 0);
  });
  
  test('transactional workflow: write-commit', () => {
    // Phase 1: Create staging
    const createResult = createStagingDir(testDir);
    assert.ok(createResult.ok);
    
    // Phase 2: Write artifacts to staging
    const stagingPath1 = getStagingPath(testDir, 'summary.json');
    const stagingPath2 = getStagingPath(testDir, 'findings.json');
    writeFileSync(stagingPath1, JSON.stringify({ data: 1 }));
    writeFileSync(stagingPath2, JSON.stringify({ data: 2 }));
    
    // Phase 3: Verify staging has files
    assert.strictEqual(listStagingFiles(testDir).length, 2);
    
    // Phase 4: Commit
    const commitResult = commitStagingDir(testDir);
    assert.ok(commitResult.ok);
    
    // Phase 5: Verify final artifacts
    const finalPath1 = getFinalPath(testDir, 'summary.json');
    const finalPath2 = getFinalPath(testDir, 'findings.json');
    assert.ok(existsSync(finalPath1));
    assert.ok(existsSync(finalPath2));
    
    // Staging should be gone
    assert.ok(!hasStagingDir(testDir));
  });
  
  test('transactional workflow: write-rollback', () => {
    // Phase 1: Create staging
    createStagingDir(testDir);
    
    // Phase 2: Write artifacts to staging
    const stagingPath = getStagingPath(testDir, 'summary.json');
    writeFileSync(stagingPath, JSON.stringify({ data: 1 }));
    
    // Phase 3: Rollback
    const rollbackResult = rollbackStagingDir(testDir);
    assert.ok(rollbackResult.ok);
    
    // Phase 4: Verify no artifacts in final location
    const finalPath = getFinalPath(testDir, 'summary.json');
    assert.ok(!existsSync(finalPath));
    
    // Staging should be gone
    assert.ok(!hasStagingDir(testDir));
  });
  
  test('should replace existing artifacts directory on commit', () => {
    // Create old artifacts
    const artifactsDir = join(testDir, 'artifacts');
    mkdirSync(artifactsDir, { recursive: true });
    writeFileSync(join(artifactsDir, 'old.json'), '{}');
    
    // Create staging with new artifacts
    createStagingDir(testDir);
    const stagingPath = getStagingPath(testDir, 'new.json');
    writeFileSync(stagingPath, '{}');
    
    // Commit
    commitStagingDir(testDir);
    
    // Verify old artifact is gone, new is present
    assert.ok(!existsSync(join(artifactsDir, 'old.json')));
    assert.ok(existsSync(join(artifactsDir, 'new.json')));
  });
});


