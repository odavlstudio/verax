import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateRunId } from '../../src/verax/core/run-id.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');

const ZERO_BUDGET = {
  maxScanDurationMs: 0,
  maxInteractionsPerPage: 0,
  maxUniqueUrls: 0,
  interactionTimeoutMs: 0,
  navigationTimeoutMs: 0,
};

test('config system is absent', () => {
  const configPath = resolve(ROOT, 'src', 'verax', 'shared', 'config-loader.js');
  assert.equal(existsSync(configPath), false, 'config-loader.js must not exist');
});

test('run IDs are deterministic', () => {
  const params = {
    url: 'https://example.com',
    safetyFlags: { allowRiskyActions: false, allowCrossOrigin: false },
    baseOrigin: 'https://example.com',
    scanBudget: ZERO_BUDGET,
    manifestPath: null,
  };
  const first = generateRunId(params);
  const second = generateRunId(params);
  assert.equal(first, second, 'run IDs must be stable for identical inputs');
  assert.ok(first.length > 0, 'run ID should not be empty');
});

test('interactive mode is disabled', () => {
  const result = spawnSync('node', ['src/cli/entry.js'], {
    cwd: ROOT,
    encoding: 'utf-8',
  });
  assert.equal(result.status, 64, 'entry without args must exit with usage error');
  assert.match(result.stdout || '', /USAGE:/, 'help text should be printed');
});
