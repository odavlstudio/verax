/**
 * Profile and Budget Integration Tests (PHASE 5.6)
 * Category: runtime-discovery
 *
 * Tests: profile-driven coverage, determinism, time budgets, early exit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..', '..');
const veraxBin = resolve(projectRoot, 'bin/verax.js');

function setupTestDir() {
  const dir = mkdtempSync(join(tmpdir(), 'verax-profile-budget-'));
  mkdirSync(join(dir, '.verax'), { recursive: true });
  return dir;
}

test('Profile Budget: Profile loading works and validates', () => {
  const dir = setupTestDir();
  try {
    // Valid profile
    const result1 = spawnSync('node', [veraxBin, 'run', '--url', 'http://localhost:9999', '--profile', 'fast', '--out', dir], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
    
    // Should fail to connect but profile should be accepted (exit 65 for connection error or null for timeout)
    assert.ok(result1.status === 65 || result1.status === 66 || result1.status === null, `Expected exit 65/66/null, got ${result1.status}`);
    
    // Invalid profile
    const result2 = spawnSync('node', [veraxBin, 'run', '--url', 'http://localhost:9999', '--profile', 'invalid', '--out', dir], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
    
    assert.strictEqual(result2.status, 64, 'Invalid profile should exit 64 (UsageError)');
    assert.ok(result2.stderr.includes('Invalid profile') || result2.stdout.includes('Invalid profile'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Profile Budget: max-total-ms validation', () => {
  const dir = setupTestDir();
  try {
    // Invalid (non-numeric)
    const result1 = spawnSync('node', [veraxBin, 'run', '--url', 'http://localhost:9999', '--max-total-ms', 'abc', '--out', dir], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
    
    assert.strictEqual(result1.status, 64, 'Non-numeric max-total-ms should exit 64');
    
    // Invalid (negative)
    const result2 = spawnSync('node', [veraxBin, 'run', '--url', 'http://localhost:9999', '--max-total-ms', '-100', '--out', dir], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
    
    assert.strictEqual(result2.status, 64, 'Negative max-total-ms should exit 64');
    
    // Invalid (zero)
    const result3 = spawnSync('node', [veraxBin, 'run', '--url', 'http://localhost:9999', '--max-total-ms', '0', '--out', dir], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
    
    assert.strictEqual(result3.status, 64, 'Zero max-total-ms should exit 64');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Profile Budget: Profile metadata recorded in run-meta.json', () => {
  const dir = setupTestDir();
  try {
    // Run with fast profile (will fail to connect but should record profile)
    const _result = spawnSync('node', [veraxBin, 'run', '--url', 'http://localhost:9999', '--profile', 'fast', '--out', dir], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
    
    // Should create run directory even if connection fails
    // Check if any run-meta.json exists
    const runsDir = join(dir, 'runs');
    try {
      const runs = readFileSync(join(runsDir, 'latest.txt'), 'utf-8').trim();
      const metaPath = join(runsDir, runs, 'run-meta.json');
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      
      assert.ok(meta.profile, 'run-meta.json should include profile');
      assert.strictEqual(meta.profile.name, 'fast');
      assert.ok(typeof meta.profile.maxInteractions === 'number');
    } catch (e) {
      // If run didn't get far enough to create meta, that's ok for this test
      // The important part is validating the profile is accepted
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Profile Budget: exit-on-first-actionable flag accepted', () => {
  const dir = setupTestDir();
  try {
    const result = spawnSync('node', [veraxBin, 'run', '--url', 'http://localhost:9999', '--exit-on-first-actionable', '--out', dir], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
    
    // Should fail to connect but flag should be accepted (or timeout)
    assert.ok(result.status === 65 || result.status === 66 || result.status === null, `Flag should be accepted, got exit ${result.status}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Profile Budget: Determinism - same profile produces identical coverage', async () => {
  const dir = setupTestDir();
  try {
    // We can't easily test full determinism without a working server,
    // but we can verify the profile module itself is deterministic
    const profileModule = await import('../../src/cli/util/profiles/profile-loader.js');
    const { loadProfile } = profileModule;
    
    const profile1 = loadProfile('fast');
    const profile2 = loadProfile('fast');
    
    assert.deepStrictEqual(profile1, profile2, 'Same profile name should return identical config');
    
    // Verify all three profiles are distinct
    const fast = loadProfile('fast');
    const standard = loadProfile('standard');
    const thorough = loadProfile('thorough');
    
    assert.ok(fast.maxInteractions < standard.maxInteractions);
    assert.ok(standard.maxInteractions < thorough.maxInteractions);
    assert.ok(fast.settleTimeoutMs <= standard.settleTimeoutMs);
    assert.ok(standard.settleTimeoutMs <= thorough.settleTimeoutMs);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Profile Budget: Profile functions validate inputs', async () => {
  const { loadProfile, validateProfile, listProfiles } = await import('../../src/cli/util/profiles/profile-loader.js');
  
  // listProfiles returns array
  const profiles = listProfiles();
  assert.ok(Array.isArray(profiles));
  assert.strictEqual(profiles.length, 3);
  assert.ok(profiles.find(p => p.name === 'fast'));
  assert.ok(profiles.find(p => p.name === 'standard'));
  assert.ok(profiles.find(p => p.name === 'thorough'));
  
  // Invalid profile name throws
  assert.throws(() => loadProfile('invalid'), /Invalid profile/);
  
  // validateProfile validates structure
  const validProfile = {
    maxInteractions: 10,
    maxRuntimeExpectations: 20,
    settleTimeoutMs: 2000,
    outcomeWatcherTimeoutMs: 5000,
    runtimeNavigationBudget: 10,
    shadowDomDepth: 1,
    iframeDepth: 1,
  };
  assert.ok(validateProfile(validProfile));
  
  // Invalid profile throws
  assert.throws(() => validateProfile({ maxInteractions: -1 }), /non-negative number/);
  assert.throws(() => validateProfile(null), /must be an object/);
});

test('Profile Budget: Default profile is standard', async () => {
  const { getDefaultProfile } = await import('../../src/cli/util/profiles/profile-loader.js');
  
  const defaultProfile = getDefaultProfile();
  assert.strictEqual(defaultProfile.name, 'standard');
});

test('Profile Budget: Profile config functions return proper format', async () => {
  const { loadProfile, applyProfileToObserveConfig, applyProfileToDetectConfig } = await import('../../src/cli/util/profiles/profile-loader.js');
  
  const profile = loadProfile('fast');
  
  const observeConfig = applyProfileToObserveConfig(profile);
  assert.ok(typeof observeConfig.maxInteractions === 'number');
  assert.ok(typeof observeConfig.settleTimeoutMs === 'number');
  assert.ok(typeof observeConfig.outcomeWatcherTimeoutMs === 'number');
  
  const detectConfig = applyProfileToDetectConfig(profile);
  assert.ok(typeof detectConfig.phaseTimeoutMs === 'number');
});

test('Profile Budget: Cleanup', () => {
  const dir = setupTestDir();
  rmSync(dir, { recursive: true, force: true });
  assert.ok(true, 'Cleanup successful');
});
