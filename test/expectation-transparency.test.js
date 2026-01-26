/**
 * PHASE 2 — EXPECTATION TRANSPARENCY (Pre-Run Truth Lock)
 *
 * Verifies that VERAX exposes expectation scope before observation, fails fast on
 * empty expectations, and keeps JSON mode noise-free.
 */

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { getTimeProvider } from '../src/cli/util/support/time-provider.js';

const expectationModulePath = new URL('../src/cli/util/observation/expectation-extractor.js', import.meta.url).href;
const runtimeReadinessModulePath = new URL('../src/cli/util/observation/runtime-readiness.js', import.meta.url).href;
const observationEngineModulePath = new URL('../src/cli/util/observation/observation-engine.js', import.meta.url).href;
const detectPhaseModulePath = new URL('../src/cli/phases/detect-phase.js', import.meta.url).href;
const projectDiscoveryModulePath = new URL('../src/cli/util/config/project-discovery.js', import.meta.url).href;
const eventsModulePath = new URL('../src/cli/util/support/events.js', import.meta.url).href;

const testState = {
  expectations: [],
  observeData: null,
  detectData: null,
  discoveryProfile: null,
  ensureRuntimeReadyCalls: 0,
};

const defaultObserveData = (expectations) => ({
  observations: [],
  stats: {
    attempted: expectations.length,
    observed: expectations.length,
    completed: expectations.length,
    skipped: 0,
    skippedReasons: {},
  },
  stability: { incompleteReasons: [] },
  status: 'COMPLETE',
  timings: { observeMs: 0, totalMs: 0 },
});

const defaultDetectData = {
  findings: [],
  stats: {
    silentFailures: 0,
    coverageGaps: 0,
    unproven: 0,
    informational: 0,
    byStatus: {},
  },
  timings: { detectMs: 0, totalMs: 0 },
  status: 'COMPLETE',
};

mock.module(expectationModulePath, () => ({
  extractExpectations: async () => ({
    expectations: testState.expectations,
    skipped: {},
  }),
}));

mock.module(runtimeReadinessModulePath, () => ({
  ensureRuntimeReady: async () => {
    testState.ensureRuntimeReadyCalls += 1;
    return { ready: true };
  },
  checkRuntimeReadiness: async () => ({ ready: true }),
  formatRuntimeReadinessMessage: () => 'runtime not ready',
}));

mock.module(observationEngineModulePath, () => ({
  observeExpectations: async (expectations) => testState.observeData || defaultObserveData(expectations),
}));

mock.module(detectPhaseModulePath, () => ({
  detectPhase: async () => testState.detectData || defaultDetectData,
}));

mock.module(projectDiscoveryModulePath, () => ({
  discoverProject: async (srcPath) => testState.discoveryProfile || {
    framework: 'unknown',
    router: null,
    sourceRoot: srcPath,
    packageManager: 'npm',
    detectedAt: getTimeProvider().iso(),
    fileCount: 1,
  },
}));

mock.module(eventsModulePath, () => ({
  RunEventEmitter: class {
    constructor() {
      this.events = [];
    }
    emit(event) {
      this.events.push(event);
    }
    on() {}
    startHeartbeat() {}
    stopHeartbeat() {}
    getEvents() {
      return this.events;
    }
  },
}));

const { runCommand } = await import('../src/cli/commands/run.js');

function resetState() {
  testState.expectations = [];
  testState.observeData = null;
  testState.detectData = null;
  testState.discoveryProfile = null;
  testState.ensureRuntimeReadyCalls = 0;
}

function createTempProject() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'verax-phase2-'));
  const srcDir = join(projectRoot, 'src');
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(join(srcDir, 'index.js'), 'console.log("hello");');
  const outDir = join(projectRoot, 'out');
  mkdirSync(outDir, { recursive: true });
  return { projectRoot, srcDir, outDir };
}

function cleanupTempProject(projectRoot) {
  rmSync(projectRoot, { recursive: true, force: true });
}

test('Phase 2 — Expectation Transparency', async (suite) => {
  await suite.test('prints pre-run expectation summary once with correct counts', async () => {
    resetState();
    const { projectRoot, srcDir, outDir } = createTempProject();
    const navExpectation = { promise: { kind: 'navigate', value: '/home' }, source: { file: 'src/pages/home.tsx', line: 1, column: 1 } };
    const formExpectation = { promise: { kind: 'submit', value: 'form submit' }, source: { file: 'src/components/Form.tsx', line: 5, column: 1 }, category: 'form' };
    const validationExpectation = { promise: { kind: 'validation', value: 'required' }, source: { file: 'src/components/Form.tsx', line: 10, column: 1 }, category: 'validation' };
    const otherExpectation = { promise: { kind: 'click', value: 'CTA' }, source: { file: 'src/components/Button.tsx', line: 3, column: 1 }, type: 'interaction' };
    testState.expectations = [navExpectation, formExpectation, validationExpectation, otherExpectation];

    const logs = [];
    const logMock = mock.method(console, 'log', (...args) => {
      logs.push(args.join(' '));
    });

    try {
      const result = await runCommand({
        url: 'https://example.com',
        src: srcDir,
        out: outDir,
        json: false,
        isFirstRun: false,
        explainExpectations: false,
      });

      assert.equal(result.exitCode, 0, 'Run should complete without failures');
      const output = logs.join('\n');
      const summaryCount = (output.match(/VERAX will analyze the following user-facing promises:/g) || []).length;
      assert.equal(summaryCount, 1, 'Expectation summary must be printed exactly once');
      assert.match(output, /Navigation:\s+1/);
      assert.match(output, /Form submissions:\s+1/);
      assert.match(output, /Validation feedback:\s+1/);
      assert.match(output, /Other interactions:\s+1/);
      assert.match(output, new RegExp(`Source analyzed: ${resolve(srcDir).replace(/\\/g, '\\\\')}`));
      assert.match(output, /Framework detected: unknown/);
      assert.strictEqual(output.includes('Example expectations:'), false, 'Explain block should not print without flag');
    } finally {
      logMock.restore();
      cleanupTempProject(projectRoot);
      resetState();
    }
  });

  await suite.test('exits with usage error and does not launch browser when expectations are empty', async () => {
    resetState();
    const { projectRoot, srcDir, outDir } = createTempProject();
    testState.expectations = [];

    const result = await runCommand({
      url: 'https://example.com',
      src: srcDir,
      out: outDir,
      json: false,
      isFirstRun: false,
    });

    assert.equal(result.exitCode, 64, 'Empty expectations must fail with USAGE_ERROR (64)');
    assert.match(
      result.outcome.reason,
      /No observable user-facing promises were found in the provided source.\nVERAX requires frontend code with navigation, forms, or interactive UI./
    );
    assert.equal(testState.ensureRuntimeReadyCalls, 0, 'Observation readiness must not run when expectations are empty');

    cleanupTempProject(projectRoot);
    resetState();
  });

  await suite.test('--explain-expectations prints top examples only when enabled', async () => {
    resetState();
    const { projectRoot, srcDir, outDir } = createTempProject();
    testState.expectations = Array.from({ length: 12 }).map((_, idx) => ({
      promise: { kind: idx % 2 === 0 ? 'navigate' : 'submit', value: `/path-${idx}` },
      source: { file: `src/pages/page-${idx}.tsx`, line: idx + 1, column: 1 },
      type: idx % 2 === 0 ? 'navigation' : 'interaction',
    }));

    const logs = [];
    const logMock = mock.method(console, 'log', (...args) => logs.push(args.join(' ')));

    try {
      const result = await runCommand({
        url: 'https://example.com',
        src: srcDir,
        out: outDir,
        json: false,
        isFirstRun: false,
        explainExpectations: true,
      });

      assert.equal(result.exitCode, 0);
      const output = logs.join('\n');
      assert.match(output, /Example expectations:/);
      const previewLines = (output.match(/\u2022 /g) || []);
      assert(previewLines.length >= 11, 'Explain block should list up to 10 expectations plus summary header');
      assert.match(output, /page-0\.tsx:1/);
      assert.match(output, /page-9\.tsx:10/);
      assert.strictEqual(output.includes('page-11.tsx:12'), false, 'Only the first 10 expectations should be listed');
    } finally {
      logMock.restore();
      cleanupTempProject(projectRoot);
      resetState();
    }
  });

  await suite.test('suppresses expectation output in JSON mode', async () => {
    resetState();
    const { projectRoot, srcDir, outDir } = createTempProject();
    testState.expectations = [
      { promise: { kind: 'navigate', value: '/json' }, source: { file: 'src/pages/json.tsx', line: 1, column: 1 } },
    ];

    const logs = [];
    const logMock = mock.method(console, 'log', (...args) => logs.push(args.join(' ')));

    try {
      const result = await runCommand({
        url: 'https://example.com',
        src: srcDir,
        out: outDir,
        json: true,
        isFirstRun: false,
        explainExpectations: true,
      });

      assert.equal(result.exitCode, 0);
      const output = logs.join('\n');
      assert.strictEqual(output.includes('VERAX will analyze the following user-facing promises:'), false);
      assert.strictEqual(output.includes('Example expectations:'), false);
    } finally {
      logMock.restore();
      cleanupTempProject(projectRoot);
      resetState();
    }
  });
});
