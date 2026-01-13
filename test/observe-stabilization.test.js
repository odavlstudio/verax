import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { tmpdir } from 'os';
import { observe } from '../src/verax/observe/index.js';
import { runInteraction } from '../src/verax/observe/interaction-runner.js';
import { createScanBudget } from '../src/verax/shared/scan-budget.js';
import { generateRunId } from '../src/verax/shared/artifact-manager.js';

function createTempDir() {
  const tempDir = resolve(tmpdir(), `verax-observe-stabilization-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function loadFixture(name) {
  const fixturePath = resolve(process.cwd(), 'test', 'fixtures', 'settle', name);
  return readFileSync(fixturePath, 'utf-8');
}

function prepareFixtureInTemp(name) {
  const tempDir = createTempDir();
  const htmlFile = join(tempDir, 'index.html');
  writeFileSync(htmlFile, loadFixture(name));
  const manifestPath = join(tempDir, 'manifest.json');
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify({ version: 1, projectDir: tempDir }));
  return { tempDir, htmlFile, manifestPath };
}

test('async DOM updates are captured during settle window', { timeout: 45000 }, async () => {
  const { tempDir, htmlFile, manifestPath } = prepareFixtureInTemp('async-update.html');
  const url = `file://${htmlFile.replace(/\\/g, '/')}`;

  try {
    const runId = generateRunId();
    const observation = await observe(url, manifestPath, null, {}, tempDir, runId);
    const tracesContent = JSON.parse(readFileSync(observation.tracesPath, 'utf-8'));
    const trace = tracesContent.traces.find(t => t.interaction.selector.includes('delayed-update'));

    assert.ok(trace, 'Trace for delayed update button should exist');
    assert.ok(trace.dom && trace.dom.settle, 'Settle samples should be recorded');
    const samples = trace.dom.settle.samples;

    assert.strictEqual(samples.length, 3, 'Should capture three settle samples');
    assert.notStrictEqual(samples[0], samples[2], 'Final settle sample should reflect async DOM change');
    assert.strictEqual(trace.dom.settle.domChangedDuringSettle, true);
    assert.strictEqual(trace.dom.afterHash, samples[2]);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('stable DOM keeps settle samples unchanged', { timeout: 45000 }, async () => {
  const { tempDir, htmlFile, manifestPath } = prepareFixtureInTemp('no-change.html');
  const url = `file://${htmlFile.replace(/\\/g, '/')}`;

  try {
    const runId = generateRunId();
    const observation = await observe(url, manifestPath, null, {}, tempDir, runId);
    const tracesContent = JSON.parse(readFileSync(observation.tracesPath, 'utf-8'));
    const trace = tracesContent.traces.find(t => t.interaction.selector.includes('noop'));

    assert.ok(trace, 'Trace for noop button should exist');
    assert.ok(trace.dom && trace.dom.settle, 'Settle samples should be recorded');

    const samples = trace.dom.settle.samples;
    assert.strictEqual(samples.length, 3, 'Should capture three settle samples');
    assert.strictEqual(samples[0], samples[1]);
    assert.strictEqual(samples[1], samples[2]);
    assert.strictEqual(trace.dom.settle.domChangedDuringSettle, false);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('timeouts capture phase information', async () => {
  const screenshotsDir = createTempDir();

  try {
    const fakePage = {
      url: () => 'http://example.com',
      screenshot: async () => {},
      waitForTimeout: async () => {},
      waitForNavigation: () => Promise.resolve(null),
      evaluate: async () => 'stable dom',
      on: () => {},
      removeListener: () => {},
      goBack: async () => {},
      addInitScript: async () => {}
    };

    const locator = {
      scrollIntoViewIfNeeded: async () => {},
      hover: async () => {},
      focus: async () => {},
      click: async () => {
        const error = new Error('TimeoutError');
        error.name = 'TimeoutError';
        throw error;
      }
    };

    const interaction = {
      type: 'button',
      selector: '#slow-button',
      label: 'Slow Button',
      element: locator,
      isExternal: false
    };

    const trace = await runInteraction(
      fakePage,
      interaction,
      Date.now(),
      0,
      screenshotsDir,
      'http://example.com',
      Date.now(),
      createScanBudget({ navigationTimeoutMs: 100, maxScanDurationMs: 20000 })
    );

    assert.ok(trace && trace.policy && (trace.policy.timeout || trace.policy.executionError), 'Policy should be recorded');
    assert.strictEqual(trace.policy.reason, 'interaction_timeout');
    assert.strictEqual(trace.policy.phase, 'click');
    assert.ok(trace.after && trace.after.screenshot.endsWith('.png'));
    assert.ok(trace.dom && trace.dom.afterHash, 'After hash should still be captured');
  } finally {
    cleanupTempDir(screenshotsDir);
  }
});
