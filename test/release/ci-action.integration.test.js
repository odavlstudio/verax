/**
 * CI GitHub Action Integration Tests (PHASE 5.7)
 *
 * Validates GitHub Action configuration and artifact packing logic.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import YAML from 'yaml';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';
import { 
  findLatestRun, 
  listFilesRecursive, 
  createManifest, 
  packArtifacts 
} from '../../src/cli/util/ci/artifact-pack.js';

const ACTION_YML_PATH = '.github/actions/verax/action.yml';

function safeRemove(dir) {
  if (!dir) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      return;
    } catch (error) {
      if (error.code === 'ENOENT') return;
      if (attempt === 2 && (error.code === 'ENOTEMPTY' || error.code === 'EBUSY')) {
        return;
      }
    }
  }
}

test('[ci-action] action.yml is valid YAML', () => {
  const content = readFileSync(ACTION_YML_PATH, 'utf-8');
  const parsed = YAML.parse(content);
  
  assert.ok(parsed, 'action.yml should parse as valid YAML');
  assert.equal(parsed.name, 'VERAX CI (Pilot)', 'action name should match');
  assert.equal(parsed.runs.using, 'composite', 'should be composite action');
  
  // Validate required inputs
  assert.ok(parsed.inputs.url, 'should have url input');
  assert.equal(parsed.inputs.url.required, true, 'url should be required');
  
  // Validate optional inputs with defaults
  assert.equal(parsed.inputs.out.default, '.verax', 'out default should be .verax');
  assert.equal(parsed.inputs.ci_mode.default, 'strict', 'ci_mode default should be strict');
  assert.equal(parsed.inputs.fail_on_incomplete.default, 'true', 'fail_on_incomplete default should be true');
  assert.equal(parsed.inputs.upload_artifacts.default, 'true', 'upload_artifacts default should be true');
  
  // Validate outputs
  assert.ok(parsed.outputs.exit_code, 'should have exit_code output');
  assert.ok(parsed.outputs.run_dir, 'should have run_dir output');
  assert.ok(parsed.outputs.bundle_dir, 'should have bundle_dir output');
  
  // Validate steps exist
  assert.ok(Array.isArray(parsed.runs.steps), 'should have steps array');
  assert.ok(parsed.runs.steps.length >= 3, 'should have at least 3 steps');
});

test('[ci-action] action.yml command construction includes all flags', () => {
  const content = readFileSync(ACTION_YML_PATH, 'utf-8');
  const parsed = YAML.parse(content);
  
  const runStep = parsed.runs.steps.find(s => s.name === 'Run VERAX');
  assert.ok(runStep, 'should have Run VERAX step');
  
  const script = runStep.run;
  
  // Check base command
  assert.ok(script.includes('npx verax run'), 'should call verax run');
  assert.ok(script.includes('--url ${{ inputs.url }}'), 'should include url flag');
  assert.ok(script.includes('--out $OUT'), 'should include out flag');
  assert.ok(script.includes('--min-coverage ${{ inputs.min_coverage }}'), 'should include min_coverage flag');
  assert.ok(script.includes('--ci-mode ${{ inputs.ci_mode }}'), 'should include ci_mode flag');
  
  // Check exit code handling
  assert.ok(script.includes('case $VERAX_EXIT_CODE in'), 'should handle exit codes with case statement');
  assert.ok(script.includes('0)'), 'should handle exit 0');
  assert.ok(script.includes('20)'), 'should handle exit 20 (FINDINGS)');
  assert.ok(script.includes('30)'), 'should handle exit 30 (INCOMPLETE)');
  assert.ok(script.includes('50 | 64)'), 'should handle exits 50/64 (errors)');
  
  // Check fail_on_incomplete logic
  assert.ok(script.includes('if [ "${{ inputs.fail_on_incomplete }}" == "true" ]'), 'should check fail_on_incomplete');
});

test('[ci-action] findLatestRun prefers scan latest.json over directory scan', (t) => {
  const testDir = join(tmpdir(), `verax-test-latest-${getTimeProvider().now()}`);
  const runsDir = join(testDir, 'runs');
  
  mkdirSync(runsDir, { recursive: true });
  
  t.after(() => {
    safeRemove(testDir);
  });
  
  // Create scan directory with multiple runs
  const scanDir = join(runsDir, 'scan-test');
  mkdirSync(scanDir, { recursive: true });

  const run1 = join(scanDir, '2025-01-10T10-00-00-000Z_aaaa');
  const run2 = join(scanDir, '2025-01-10T11-00-00-000Z_bbbb');
  const run3 = join(scanDir, '2025-01-10T12-00-00-000Z_cccc');

  mkdirSync(run1, { recursive: true });
  mkdirSync(run2, { recursive: true });
  mkdirSync(run3, { recursive: true });

  // Write scan/latest.json pointing to run2 (NOT the newest)
  writeFileSync(join(scanDir, 'latest.json'), JSON.stringify({ runId: '2025-01-10T11-00-00-000Z_bbbb' }));

  const result = findLatestRun(runsDir);

  assert.equal(result, run2, 'should prefer scan latest.json over newest directory');
});

test('[ci-action] listFilesRecursive produces sorted deterministic output', (t) => {
  const testDir = join(tmpdir(), `verax-test-list-${getTimeProvider().now()}`);
  
  mkdirSync(testDir, { recursive: true });
  
  t.after(() => {
    safeRemove(testDir);
  });
  
  // Create files in non-alphabetical order
  writeFileSync(join(testDir, 'z-file.json'), '{}');
  writeFileSync(join(testDir, 'a-file.json'), '{}');
  mkdirSync(join(testDir, 'nested'), { recursive: true });
  writeFileSync(join(testDir, 'nested', 'b-file.json'), '{}');
  writeFileSync(join(testDir, 'm-file.json'), '{}');
  
  const files = listFilesRecursive(testDir);
  
  assert.deepEqual(files, [
    'a-file.json',
    'm-file.json',
    'nested/b-file.json',
    'z-file.json',
  ], 'files should be sorted lexicographically');
});

test('[ci-action] createManifest includes run metadata and sorted files', (t) => {
  const testDir = join(tmpdir(), `verax-test-manifest-${getTimeProvider().now()}`);
  const runDir = join(testDir, '2025-01-10T10-00-00-000Z');
  
  mkdirSync(runDir, { recursive: true });
  
  t.after(() => {
    safeRemove(testDir);
  });
  
  // Create run metadata
  writeFileSync(join(runDir, 'run.meta.json'), JSON.stringify({
    veraxVersion: '5.7.0',
    url: 'https://example.com',
    startedAt: '2025-01-10T10:00:00.000Z',
  }));
  
  // Create summary
  writeFileSync(join(runDir, 'summary.json'), JSON.stringify({
    status: 'SUCCESS',
    url: 'https://example.com',
    findingsCounts: { HIGH: 2, MEDIUM: 1, LOW: 0, UNKNOWN: 0 },
  }));
  
  const files = ['run.meta.json', 'summary.json', 'evidence/e1.json'];
  const manifest = createManifest(runDir, files);
  
  assert.equal(manifest.packVersion, 1, 'manifest should have packVersion 1');
  assert.equal(manifest.runId, '2025-01-10T10-00-00-000Z', 'manifest should include runId');
  assert.equal(manifest.veraxVersion, '5.7.0', 'manifest should include veraxVersion');
  assert.equal(manifest.url, 'https://example.com', 'manifest should include url');
  assert.equal(manifest.status, 'SUCCESS', 'manifest should include status');
  assert.deepEqual(manifest.findingsCounts, { HIGH: 2, MEDIUM: 1, LOW: 0, UNKNOWN: 0 }, 'manifest should include findingsCounts');
  assert.deepEqual(manifest.files, files.sort(), 'manifest files should be sorted');
  assert.equal(manifest.fileCount, 3, 'manifest should include fileCount');
  assert.ok(manifest.packedAt, 'manifest should include packedAt timestamp');
});

test('[ci-action] packArtifacts creates bundle with manifest', (t) => {
  const testDir = join(tmpdir(), `verax-test-pack-${getTimeProvider().now()}`);
  const runDir = join(testDir, '2025-01-10T10-00-00-000Z');
  const bundleDir = join(testDir, 'bundle');
  
  mkdirSync(runDir, { recursive: true });
  
  t.after(() => {
    safeRemove(testDir);
  });
  
  // Create run files
  writeFileSync(join(runDir, 'summary.json'), JSON.stringify({
    status: 'SUCCESS',
    findingsCounts: { HIGH: 1, MEDIUM: 0, LOW: 0, UNKNOWN: 0 },
  }));
  
  mkdirSync(join(runDir, 'evidence'), { recursive: true });
  writeFileSync(join(runDir, 'evidence', 'e1.json'), JSON.stringify({ id: 'e1' }));
  
  const result = packArtifacts(runDir, bundleDir);
  
  assert.equal(result.success, true, 'packing should succeed');
  assert.equal(result.fileCount, 2, 'should pack 2 files');
  assert.equal(result.manifest.runId, '2025-01-10T10-00-00-000Z', 'manifest should include runId');
  assert.equal(result.manifest.status, 'SUCCESS', 'manifest should include status');
  
  // Verify manifest.json was created
  const manifestPath = join(bundleDir, 'manifest.json');
  const manifestContent = readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestContent);
  
  assert.equal(manifest.packVersion, 1, 'manifest should have packVersion 1');
  assert.equal(manifest.fileCount, 2, 'manifest should count 2 files');
  
  // Verify files were copied
  const summaryPath = join(bundleDir, 'summary.json');
  const evidencePath = join(bundleDir, 'evidence', 'e1.json');
  
  assert.ok(readFileSync(summaryPath, 'utf-8'), 'summary.json should be copied');
  assert.ok(readFileSync(evidencePath, 'utf-8'), 'evidence/e1.json should be copied');
});

test('[ci-action] packArtifacts determinism: file order stable across runs', (t) => {
  // Use mkdtemp to prevent cross-file collisions under deterministic VERAX_TEST_TIME.
  const testDir = mkdtempSync(join(tmpdir(), `verax-test-determinism-${getTimeProvider().now()}-`));
  const runDir = join(testDir, '2025-01-10T10-00-00-000Z');
  const bundle1 = join(testDir, 'bundle1');
  const bundle2 = join(testDir, 'bundle2');
  
  mkdirSync(runDir, { recursive: true });
  
  t.after(() => {
    safeRemove(testDir);
  });
  
  // Create files in random order
  writeFileSync(join(runDir, 'zebra.json'), '{}');
  writeFileSync(join(runDir, 'alpha.json'), '{}');
  mkdirSync(join(runDir, 'middle'), { recursive: true });
  writeFileSync(join(runDir, 'middle', 'beta.json'), '{}');
  
  // Pack twice
  const result1 = packArtifacts(runDir, bundle1);
  const result2 = packArtifacts(runDir, bundle2);
  
  // Read manifests
  const manifest1 = JSON.parse(readFileSync(join(bundle1, 'manifest.json'), 'utf-8'));
  const manifest2 = JSON.parse(readFileSync(join(bundle2, 'manifest.json'), 'utf-8'));
  
  // Verify file lists are identical (same order)
  assert.deepEqual(manifest1.files, manifest2.files, 'file lists should be identical across runs');
  assert.deepEqual(result1.manifest.files, result2.manifest.files, 'result manifests should be identical');
  
  // Verify sorting
  const expectedOrder = [
    'alpha.json',
    'middle/beta.json',
    'zebra.json',
  ];
  
  assert.deepEqual(manifest1.files, expectedOrder, 'files should be sorted alphabetically');
});
