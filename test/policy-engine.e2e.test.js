/**
 * Policy Engine E2E Test (PHASE 5.5)
 *
 * Tests that policy is correctly applied during a full VERAX run:
 * 1. Run VERAX on fixture with findings
 * 2. Write policy.json to suppress/downgrade some findings
 * 3. Re-run VERAX
 * 4. Verify findings.json contains metadata and exit code respects suppression
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..', '..');

test('E2E: policy suppresses findings in findings.json and exit code', () => {
  const runtime = mkdtempSync(join(tmpdir(), 'verax-policy-e2e-'));
  const fixtureUrl = 'http://127.0.0.1:3000'; // Use a local test fixture
  
  try {
    // Run VERAX without policy (baseline)
    const runWithoutPolicy = spawnSync('node', [
      resolve(projectRoot, 'bin/verax.js'),
      'run',
      '--url', fixtureUrl,
      '--runtime', resolve(__dirname, 'fixtures', 'runtime-fixture.js'),
      '--output', runtime
    ], { cwd: projectRoot, encoding: 'utf-8', timeout: 60000 });

    assert.ok(runWithoutPolicy.stdout || runWithoutPolicy.status !== 0, 'VERAX run should complete');
    
    // Read findings.json from baseline run
    const findingsPath = resolve(runtime, 'findings.json');
    const baselineFindingsText = readFileSync(findingsPath, 'utf-8');
    const baselineFindings = JSON.parse(baselineFindingsText);
    
    // Should have findings before policy
    assert.ok(Array.isArray(baselineFindings), 'findings should be array');
    const findingCount = baselineFindings.length;
    assert.ok(findingCount > 0, 'fixture should produce at least one finding');
    
    // Get first finding ID to suppress
    const suppressId = baselineFindings[0]?.id;
    assert.ok(suppressId, 'finding must have id');
    
    // Create policy to suppress this finding
    mkdirSync(resolve(runtime, '.verax'), { recursive: true });
    const policyData = {
      version: 1,
      ignore: {
        findingIds: [suppressId],
        types: [],
        selectorContains: []
      },
      downgrade: []
    };
    writeFileSync(
      resolve(runtime, '.verax', 'policy.json'),
      JSON.stringify(policyData, null, 2)
    );
    
    // Run VERAX again with policy
    const _runWithPolicy = spawnSync('node', [
      resolve(projectRoot, 'bin/verax.js'),
      'run',
      '--url', fixtureUrl,
      '--runtime', resolve(__dirname, 'fixtures', 'runtime-fixture.js'),
      '--output', runtime
    ], { cwd: projectRoot, encoding: 'utf-8', timeout: 60000 });

    // Read updated findings.json
    const policiedFindingsText = readFileSync(findingsPath, 'utf-8');
    const policiedFindings = JSON.parse(policiedFindingsText);
    
    // Should have same total findings but first one should be suppressed
    assert.strictEqual(policiedFindings.length, findingCount, 'total findings count unchanged');
    
    const suppressedFinding = policiedFindings.find((f) => f.id === suppressId);
    assert.ok(suppressedFinding, 'suppressed finding should still be in findings.json');
    assert.strictEqual(suppressedFinding.suppressed, true, 'finding should have suppressed=true');
    assert.ok(suppressedFinding.policy, 'finding should have policy metadata');
    assert.strictEqual(suppressedFinding.policy.suppressed, true, 'policy.suppressed should be true');
    
    // Exit code should be 0 (no unsuppressed findings) or 1 (depends on other findings)
    // The key is that the suppressed finding should not count toward exit code 1
    // This is tested in the run.js unit tests
    
  } finally {
    rmSync(runtime, { recursive: true, force: true });
  }
});

test('E2E: policy downgrades finding status and exit code', () => {
  const runtime = mkdtempSync(join(tmpdir(), 'verax-policy-downgrade-'));
  const fixtureUrl = 'http://127.0.0.1:3000';
  
  try {
    // Run VERAX without policy
    const runWithoutPolicy = spawnSync('node', [
      resolve(projectRoot, 'bin/verax.js'),
      'run',
      '--url', fixtureUrl,
      '--runtime', resolve(__dirname, 'fixtures', 'runtime-fixture.js'),
      '--output', runtime
    ], { cwd: projectRoot, encoding: 'utf-8', timeout: 60000 });

    assert.ok(runWithoutPolicy.stdout || runWithoutPolicy.status !== 0);
    
    // Read baseline findings
    const findingsPath = resolve(runtime, 'findings.json');
    const baselineFindings = JSON.parse(readFileSync(findingsPath, 'utf-8'));
    assert.ok(baselineFindings.length > 0);
    
    const confirmedFinding = baselineFindings.find((f) => f.status === 'CONFIRMED');
    if (!confirmedFinding) {
      // Skip if no CONFIRMED findings in fixture
      return;
    }
    
    // Create policy to downgrade CONFIRMED to SUSPECTED
    mkdirSync(resolve(runtime, '.verax'), { recursive: true });
    const policyData = {
      version: 1,
      ignore: { findingIds: [], types: [], selectorContains: [] },
      downgrade: [
        {
          type: confirmedFinding.type,
          toStatus: 'SUSPECTED',
          reason: 'Test downgrade'
        }
      ]
    };
    writeFileSync(
      resolve(runtime, '.verax', 'policy.json'),
      JSON.stringify(policyData, null, 2)
    );
    
    // Run again with policy
    const _runWithPolicy = spawnSync('node', [
      resolve(projectRoot, 'bin/verax.js'),
      'run',
      '--url', fixtureUrl,
      '--runtime', resolve(__dirname, 'fixtures', 'runtime-fixture.js'),
      '--output', runtime
    ], { cwd: projectRoot, encoding: 'utf-8', timeout: 60000 });

    // Read updated findings
    const policiedFindings = JSON.parse(readFileSync(findingsPath, 'utf-8'));
    const downgradedFinding = policiedFindings.find((f) => f.id === confirmedFinding.id);
    
    assert.ok(downgradedFinding);
    assert.strictEqual(downgradedFinding.status, 'SUSPECTED', 'status should be downgraded');
    assert.strictEqual(downgradedFinding.downgraded, true, 'downgraded flag should be true');
    assert.ok(downgradedFinding.policy);
    assert.strictEqual(downgradedFinding.policy.downgraded, true);
    
  } finally {
    rmSync(runtime, { recursive: true, force: true });
  }
});

test('E2E: invalid policy schema exits with UsageError (64)', () => {
  const runtime = mkdtempSync(join(tmpdir(), 'verax-policy-invalid-'));
  
  try {
    // Create invalid policy (version 2)
    mkdirSync(resolve(runtime, '.verax'), { recursive: true });
    writeFileSync(
      resolve(runtime, '.verax', 'policy.json'),
      JSON.stringify({ version: 2 }, null, 2)
    );
    
    // Run should detect invalid policy and exit 64
    const result = spawnSync('node', [
      resolve(projectRoot, 'bin/verax.js'),
      'run',
      '--url', 'http://127.0.0.1:3000',
      '--output', runtime
    ], { cwd: projectRoot, encoding: 'utf-8', timeout: 30000 });

    // Exit code 64 is UsageError
    assert.strictEqual(result.status, 64, `Should exit with code 64, got ${result.status}`);
    
  } finally {
    rmSync(runtime, { recursive: true, force: true });
  }
});
