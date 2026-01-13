/**
 * PHASE 5 TEST SUITE: DETERMINISM & REPLAY
 * 
 * Verifies that VERAX produces deterministic, replayable, audit-grade results:
 * 1. Identical inputs produce identical runId
 * 2. Identical inputs produce identical artifact structure and ordering
 * 3. Replay mode reproduces identical CLI output without browser
 * 4. Modified/missing artifacts produce integrity silences
 * 5. Replay operates without browser or network
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const tmpDir = join(projectRoot, 'tmp', 'phase5-test');

describe('Phase 5: Determinism & Replay', () => {
  before(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    mkdirSync(tmpDir, { recursive: true });
  });
  
  after(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
  
  describe('Step 1: Stable runId Generation', () => {
    it('should generate identical runId for identical inputs', async () => {
      const { generateRunId } = await import('../src/verax/core/run-id.js');
      
      const params = {
        url: 'http://localhost:3000',
        safetyFlags: { allowWrites: false, allowRiskyActions: false, allowCrossOrigin: false },
        baseOrigin: 'http://localhost:3000',
        scanBudget: {
          maxScanDurationMs: 30000,
          maxInteractionsPerPage: 10,
          maxUniqueUrls: 5,
          interactionTimeoutMs: 2000,
          navigationTimeoutMs: 2000
        },
        manifestPath: null
      };
      
      const runId1 = generateRunId(params);
      const runId2 = generateRunId(params);
      
      assert.strictEqual(runId1, runId2, 'RunId should be identical for identical inputs');
      assert.ok(runId1.length === 16, 'RunId should be 16 characters');
      assert.ok(/^[a-f0-9]+$/.test(runId1), 'RunId should be hex');
    });
    
    it('should generate different runId for different URLs', async () => {
      const { generateRunId } = await import('../src/verax/core/run-id.js');
      
      const params1 = {
        url: 'http://localhost:3000',
        safetyFlags: {},
        baseOrigin: 'http://localhost:3000',
        scanBudget: { maxScanDurationMs: 30000, maxInteractionsPerPage: 10 },
        manifestPath: null
      };
      
      const params2 = {
        ...params1,
        url: 'http://localhost:4000',
        baseOrigin: 'http://localhost:4000'
      };
      
      const runId1 = generateRunId(params1);
      const runId2 = generateRunId(params2);
      
      assert.notStrictEqual(runId1, runId2, 'Different URLs should produce different runIds');
    });
    
    it('should generate different runId for different safety flags', async () => {
      const { generateRunId } = await import('../src/verax/core/run-id.js');
      
      const baseParams = {
        url: 'http://localhost:3000',
        baseOrigin: 'http://localhost:3000',
        scanBudget: { 
          maxScanDurationMs: 30000, 
          maxInteractionsPerPage: 10,
          maxUniqueUrls: 5,
          interactionTimeoutMs: 2000,
          navigationTimeoutMs: 2000
        },
        manifestPath: null
      };
      
      const params1 = { ...baseParams, safetyFlags: { allowWrites: false, allowRiskyActions: false, allowCrossOrigin: false } };
      const params2 = { ...baseParams, safetyFlags: { allowWrites: true, allowRiskyActions: false, allowCrossOrigin: false } };
      
      const runId1 = generateRunId(params1);
      const runId2 = generateRunId(params2);
      
      assert.notStrictEqual(runId1, runId2, 'Different safety flags should produce different runIds');
    });
    
    it('should NOT include timestamps in runId', async () => {
      const { generateRunId } = await import('../src/verax/core/run-id.js');
      
      const params = {
        url: 'http://localhost:3000',
        safetyFlags: {},
        baseOrigin: 'http://localhost:3000',
        scanBudget: { maxScanDurationMs: 30000, maxInteractionsPerPage: 10 },
        manifestPath: null
      };
      
      const runId1 = generateRunId(params);
      
      // Wait a bit and generate again
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const runId2 = generateRunId(params);
      
      assert.strictEqual(runId1, runId2, 'RunId should not change over time for same inputs');
    });
  });
  
  describe('Step 2: Run Manifest Creation', () => {
    it('should create run manifest with all required fields', async () => {
      const { createRunManifest } = await import('../src/verax/core/run-manifest.js');
      const { generateRunId } = await import('../src/verax/core/run-id.js');
      
      const testDir = join(tmpDir, 'manifest-test');
      mkdirSync(testDir, { recursive: true });
      
      const params = {
        url: 'http://localhost:3000',
        safetyFlags: { allowWrites: true, allowRiskyActions: false, allowCrossOrigin: false },
        baseOrigin: 'http://localhost:3000',
        scanBudget: {
          maxScanDurationMs: 30000,
          maxInteractionsPerPage: 10,
          maxUniqueUrls: 5,
          interactionTimeoutMs: 2000,
          navigationTimeoutMs: 2000,
          stabilizationWindowMs: 600,
          stabilizationSampleMidMs: 150,
          stabilizationSampleEndMs: 300,
          networkWaitMs: 100,
          settleTimeoutMs: 5000,
          settleIdleMs: 500,
          settleDomStableMs: 500,
          navigationStableWaitMs: 200
        },
        manifestPath: null,
        argv: ['node', 'verax.js', '--url', 'http://localhost:3000']
      };
      
      const runId = generateRunId(params);
      const manifest = createRunManifest(testDir, runId, params);
      
      assert.ok(manifest.runId, 'Manifest should have runId');
      assert.ok(manifest.veraxVersion, 'Manifest should have veraxVersion');
      assert.ok(manifest.nodeVersion, 'Manifest should have nodeVersion');
      assert.strictEqual(manifest.url, 'http://localhost:3000', 'Manifest should have correct URL');
      assert.strictEqual(manifest.baseOrigin, 'http://localhost:3000', 'Manifest should have baseOrigin');
      assert.ok(manifest.flags, 'Manifest should have flags');
      assert.strictEqual(manifest.flags.allowWrites, true, 'Flags should match');
      assert.ok(manifest.safeMode, 'Manifest should have safeMode');
      assert.ok(manifest.budget, 'Manifest should have budget');
      assert.ok(manifest.startTime, 'Manifest should have startTime');
      assert.ok(Array.isArray(manifest.argv), 'Manifest should have argv');
      
      // Verify file was written
      const manifestPath = join(testDir, '.verax', 'runs', runId, 'run-manifest.json');
      assert.ok(existsSync(manifestPath), 'Run manifest file should exist');
      
      const loaded = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      assert.strictEqual(loaded.runId, runId, 'Loaded manifest should have correct runId');
    });
  });
  
  describe('Step 3: Deterministic Ordering', () => {
    it('should sort silence entries deterministically', async () => {
      const SilenceTracker = (await import('../src/verax/core/silence-model.js')).default;
      
      const tracker = new SilenceTracker();
      
      // Add entries in random order
      tracker.record({ scope: 'interaction', reason: 'timeout', description: 'Timeout Z' });
      tracker.record({ scope: 'safety', reason: 'blocked_action', description: 'Blocked A' });
      tracker.record({ scope: 'interaction', reason: 'budget_exceeded', description: 'Budget B' });
      tracker.record({ scope: 'safety', reason: 'blocked_action', description: 'Blocked C' });
      
      const exported = tracker.export();
      const entries = exported.entries;
      
      // Verify ordering: sorted by scope, then reason, then description
      assert.ok(entries.length === 4, 'Should have 4 entries');
      
      // Check that entries are sorted
      for (let i = 1; i < entries.length; i++) {
        const prev = entries[i - 1];
        const curr = entries[i];
        
        if (prev.scope !== curr.scope) {
          assert.ok(prev.scope < curr.scope, 'Entries should be sorted by scope');
        } else if (prev.reason !== curr.reason) {
          assert.ok(prev.reason < curr.reason, 'Entries should be sorted by reason within scope');
        } else {
          assert.ok(prev.description <= curr.description, 'Entries should be sorted by description within reason');
        }
      }
    });
  });
  
  describe('Step 4: Integrity Verification', () => {
    it('should compute file hashes correctly', async () => {
      const { computeFileHash } = await import('../src/verax/core/run-id.js');
      
      const testFile = join(tmpDir, 'test-hash.json');
      const content = JSON.stringify({ test: 'data' }, null, 2);
      writeFileSync(testFile, content);
      
      const hash1 = computeFileHash(testFile);
      const hash2 = computeFileHash(testFile);
      
      assert.ok(hash1, 'Should compute hash');
      assert.strictEqual(hash1, hash2, 'Hash should be deterministic');
      assert.ok(hash1.length === 64, 'Hash should be SHA256 (64 hex chars)');
      assert.ok(/^[a-f0-9]+$/.test(hash1), 'Hash should be hex');
      
      // Modify file
      writeFileSync(testFile, JSON.stringify({ test: 'modified' }, null, 2));
      const hash3 = computeFileHash(testFile);
      
      assert.notStrictEqual(hash1, hash3, 'Hash should change when content changes');
    });
    
    it('should detect missing artifacts', async () => {
      const { loadRunArtifacts } = await import('../src/verax/core/replay.js');
      
      const testRunDir = join(tmpDir, 'missing-artifacts');
      mkdirSync(testRunDir, { recursive: true });
      
      // Create minimal run manifest with expected hashes
      const runManifest = {
        runId: 'test-missing',
        artifactHashes: {
          traces: 'abc123',
          findings: 'def456'
        }
      };
      
      writeFileSync(join(testRunDir, 'run-manifest.json'), JSON.stringify(runManifest, null, 2));
      
      // Don't create the artifacts - they should be detected as missing
      const artifacts = loadRunArtifacts(testRunDir);
      
      assert.ok(artifacts.integrityViolations.length > 0, 'Should detect missing artifacts');
      assert.ok(
        artifacts.integrityViolations.some(v => v.reason === 'file_missing'),
        'Should report file_missing reason'
      );
    });
    
    it('should detect modified artifacts', async () => {
      const { loadRunArtifacts } = await import('../src/verax/core/replay.js');
      const { computeFileHash } = await import('../src/verax/core/run-id.js');
      
      const testRunDir = join(tmpDir, 'modified-artifacts');
      mkdirSync(testRunDir, { recursive: true });
      
      // Create traces file
      const tracesContent = JSON.stringify({ version: 1, traces: [] }, null, 2);
      const tracesPath = join(testRunDir, 'traces.json');
      writeFileSync(tracesPath, tracesContent);
      
      const originalHash = computeFileHash(tracesPath);
      
      // Create run manifest with original hash
      const runManifest = {
        runId: 'test-modified',
        artifactHashes: {
          traces: originalHash
        }
      };
      
      writeFileSync(join(testRunDir, 'run-manifest.json'), JSON.stringify(runManifest, null, 2));
      
      // Modify the traces file
      writeFileSync(tracesPath, JSON.stringify({ version: 1, traces: [{ modified: true }] }, null, 2));
      
      // Load artifacts - should detect modification
      const artifacts = loadRunArtifacts(testRunDir);
      
      assert.ok(artifacts.integrityViolations.length > 0, 'Should detect modified artifacts');
      const violation = artifacts.integrityViolations.find(v => v.artifact === 'traces.json');
      assert.ok(violation, 'Should report traces.json violation');
      assert.strictEqual(violation.reason, 'hash_mismatch', 'Should report hash_mismatch');
      assert.strictEqual(violation.expectedHash, originalHash, 'Should include expected hash');
      assert.notStrictEqual(violation.actualHash, originalHash, 'Should include different actual hash');
    });
  });
  
  describe('Step 5: Replay Mode', () => {
    it('should fail replay with invalid run directory', async () => {
      const { replayRun } = await import('../src/verax/core/replay.js');
      
      await assert.rejects(
        async () => await replayRun(join(tmpDir, 'nonexistent')),
        /Run manifest not found/,
        'Should reject with missing manifest error'
      );
    });
    
    it('should detect integrity violations during replay', async () => {
      const { replayRun } = await import('../src/verax/core/replay.js');
      const { computeFileHash } = await import('../src/verax/core/run-id.js');
      
      const testRunDir = join(tmpDir, 'replay-violations');
      mkdirSync(testRunDir, { recursive: true });
      
      // Create traces with original hash
      const tracesContent = JSON.stringify({ 
        version: 1, 
        traces: [],
        observeTruth: { interactionsObserved: 0 }
      }, null, 2);
      const tracesPath = join(testRunDir, 'traces.json');
      writeFileSync(tracesPath, tracesContent);
      
      const originalHash = computeFileHash(tracesPath);
      
      // Create run manifest
      const runManifest = {
        runId: 'replay-test',
        url: 'http://localhost:3000',
        artifactHashes: {
          traces: originalHash
        }
      };
      
      writeFileSync(join(testRunDir, 'run-manifest.json'), JSON.stringify(runManifest, null, 2));
      
      // Modify traces
      writeFileSync(tracesPath, JSON.stringify({ 
        version: 1, 
        traces: [{ tampered: true }],
        observeTruth: { interactionsObserved: 1 }
      }, null, 2));
      
      // Replay should detect violation
      const result = await replayRun(testRunDir);
      
      assert.strictEqual(result.replaySuccessful, false, 'Replay should fail');
      assert.ok(result.integrityViolations.length > 0, 'Should have violations');
      assert.ok(result.silences, 'Should record silences');
      assert.ok(result.silences.entries.length > 0, 'Should have silence entries');
      
      const integritySilence = result.silences.entries.find(s => s.scope === 'integrity');
      assert.ok(integritySilence, 'Should have integrity silence');
    });
  });
  
  describe('Integration: Full Determinism', () => {
    it('should produce identical runId for identical scan parameters', async () => {
      const { generateRunId } = await import('../src/verax/core/run-id.js');
      
      const params = {
        url: 'http://example.com',
        safetyFlags: { allowWrites: false, allowRiskyActions: false, allowCrossOrigin: false },
        baseOrigin: 'http://example.com',
        scanBudget: {
          maxScanDurationMs: 30000,
          maxInteractionsPerPage: 10,
          maxUniqueUrls: 5,
          interactionTimeoutMs: 2000,
          navigationTimeoutMs: 2000
        },
        manifestPath: null
      };
      
      // Generate multiple times
      const ids = [];
      for (let i = 0; i < 5; i++) {
        ids.push(generateRunId(params));
      }
      
      // All should be identical
      const uniqueIds = new Set(ids);
      assert.strictEqual(uniqueIds.size, 1, 'All runIds should be identical');
    });
    
    it('should sort silences deterministically regardless of insertion order', async () => {
      const SilenceTracker = (await import('../src/verax/core/silence-model.js')).default;
      
      // Create two trackers with same entries in different order
      const tracker1 = new SilenceTracker();
      tracker1.record({ scope: 'safety', reason: 'blocked_action', description: 'Action 1' });
      tracker1.record({ scope: 'interaction', reason: 'timeout', description: 'Timeout 1' });
      tracker1.record({ scope: 'safety', reason: 'blocked_network_write', description: 'Network 1' });
      
      const tracker2 = new SilenceTracker();
      tracker2.record({ scope: 'interaction', reason: 'timeout', description: 'Timeout 1' });
      tracker2.record({ scope: 'safety', reason: 'blocked_network_write', description: 'Network 1' });
      tracker2.record({ scope: 'safety', reason: 'blocked_action', description: 'Action 1' });
      
      const export1 = tracker1.export();
      const export2 = tracker2.export();
      
      // Entries should be in identical order
      assert.strictEqual(export1.entries.length, export2.entries.length, 'Should have same number of entries');
      
      for (let i = 0; i < export1.entries.length; i++) {
        const e1 = export1.entries[i];
        const e2 = export2.entries[i];
        assert.strictEqual(e1.scope, e2.scope, `Entry ${i} scope should match`);
        assert.strictEqual(e1.reason, e2.reason, `Entry ${i} reason should match`);
        assert.strictEqual(e1.description, e2.description, `Entry ${i} description should match`);
      }
    });
  });
});
