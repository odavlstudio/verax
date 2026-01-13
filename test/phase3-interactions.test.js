import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runInteraction } from '../src/verax/observe/interaction-runner.js';
import { DEFAULT_SCAN_BUDGET } from '../src/verax/shared/scan-budget.js';
import { detect } from '../src/verax/detect/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = resolve(__dirname, 'fixtures/phase3-interactions/index.html');
const uploadFixture = resolve(__dirname, 'fixtures/uploads/sample.txt');

function makeTempDirs() {
  const root = mkdtempSync(join(tmpdir(), 'verax-phase3-'));
  const screenshotsDir = join(root, 'screenshots');
  mkdirSync(screenshotsDir, { recursive: true });
  return { root, screenshotsDir };
}

function baseManifest(projectDir) {
  return {
    projectDir,
    routes: [{ path: '/', component: 'App', isRoot: true, isDynamic: false, extractedAt: new Date().toISOString(), filename: 'App.js' }],
    interactions: [],
    staticExpectations: []
  };
}

function keyboardTrace() {
  return {
    interaction: { type: 'keyboard', selector: 'body', label: 'Keyboard sweep' },
    before: { url: 'http://localhost/', screenshot: 'before.png' },
    after: { url: 'http://localhost/', screenshot: 'after.png' },
    dom: { beforeHash: 'h1', afterHash: 'h1', settle: { domChangedDuringSettle: false, samples: ['h1', 'h1', 'h1'] } },
    sensors: { network: { totalRequests: 0, failedRequests: 0 }, uiSignals: { diff: { changed: false } } },
    keyboard: { focusOrder: ['body'], actions: [{ action: 'enter', target: 'body' }] }
  };
}

function hoverTrace() {
  return {
    interaction: { type: 'hover', selector: '#hover', label: 'Hover target' },
    before: { url: 'http://localhost/', screenshot: 'before.png' },
    after: { url: 'http://localhost/', screenshot: 'after.png' },
    dom: { beforeHash: 'h2', afterHash: 'h2', settle: { domChangedDuringSettle: false, samples: ['h2', 'h2', 'h2'] } },
    sensors: { network: { totalRequests: 0, failedRequests: 0 }, uiSignals: { diff: { changed: false } } },
    hover: { selector: '#hover' }
  };
}

function fileUploadTrace() {
  return {
    interaction: { type: 'file_upload', selector: '#file', label: 'Upload' },
    before: { url: 'http://localhost/', screenshot: 'before.png' },
    after: { url: 'http://localhost/', screenshot: 'after.png' },
    dom: { beforeHash: 'h3', afterHash: 'h3', settle: { domChangedDuringSettle: false, samples: ['h3', 'h3', 'h3'] } },
    sensors: { network: { totalRequests: 0, failedRequests: 0 }, uiSignals: { diff: { changed: false } } },
    fileUpload: { attached: true, filePath: 'sample.txt', submitted: false }
  };
}

async function runDetect(manifest, traces) {
  const manifestPath = join(manifest.projectDir, 'manifest.json');
  const tracesPath = join(manifest.projectDir, 'traces.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  writeFileSync(tracesPath, JSON.stringify({ url: 'http://localhost/', traces }, null, 2));
  return detect(manifestPath, tracesPath);
}

test('keyboard navigation triggers enter and DOM effect', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file://${fixtureHtml}`);
  const { screenshotsDir } = makeTempDirs();
  const trace = await runInteraction(
    page,
    { type: 'keyboard', selector: 'body', label: 'Keyboard sweep', element: page.locator('body') },
    Date.now(),
    0,
    screenshotsDir,
    page.url(),
    Date.now(),
    DEFAULT_SCAN_BUDGET
  );

  assert.ok(trace.keyboard, 'Should include keyboard metadata');
  assert.ok(trace.keyboard.actions, 'Should record keyboard actions');
  assert.ok(trace.keyboard.actions.some(a => a.action === 'enter'), 'Should trigger enter on actionable element');
  const status = await page.evaluate(() => document.getElementById('keyboard-status')?.textContent);
  assert.equal(status, 'enter-fired', 'Should have triggered button click via keyboard');
  await browser.close();
});

test('hover interaction reveals content', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file://${fixtureHtml}`);
  const { screenshotsDir } = makeTempDirs();
  const trace = await runInteraction(
    page,
    { type: 'hover', selector: '#hover-target', label: 'Hover target', element: page.locator('#hover-target') },
    Date.now(),
    1,
    screenshotsDir,
    page.url(),
    Date.now(),
    DEFAULT_SCAN_BUDGET
  );

  const menuVisible = await page.evaluate(() => document.getElementById('hover-menu').getAttribute('data-hovered'));
  assert.equal(menuVisible, 'true');
  assert.ok(trace.hover, 'Should include hover metadata');
  assert.ok(trace.hover.selector, 'Should record hovered selector');
  await browser.close();
});

test('file upload attaches deterministic file and submits', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file://${fixtureHtml}`);
  const { screenshotsDir } = makeTempDirs();
  const trace = await runInteraction(
    page,
    { type: 'file_upload', selector: '#file-input', label: 'Upload', element: page.locator('#file-input'), uploadFilePath: uploadFixture },
    Date.now(),
    2,
    screenshotsDir,
    page.url(),
    Date.now(),
    DEFAULT_SCAN_BUDGET
  );

  assert.ok(trace.fileUpload, 'Should include file upload metadata');
  assert.ok(trace.fileUpload.attached, 'File should be attached');
  assert.ok(trace.fileUpload.filePath, 'File path should be recorded');
  await browser.close();
});

test('detect keyboard_silent_failure for no-effect trace', async () => {
  const { root } = makeTempDirs();
  const result = await runDetect(baseManifest(root), [keyboardTrace()]);
  assert.ok(result.findings.some(f => f.type === 'keyboard_silent_failure'));
});

test('detect hover_silent_failure for no-effect trace', async () => {
  const { root } = makeTempDirs();
  const result = await runDetect(baseManifest(root), [hoverTrace()]);
  assert.ok(result.findings.some(f => f.type === 'hover_silent_failure'));
});

test('detect file_upload_silent_failure for no-effect trace', async () => {
  const { root } = makeTempDirs();
  const result = await runDetect(baseManifest(root), [fileUploadTrace()]);
  assert.ok(result.findings.some(f => f.type === 'file_upload_silent_failure'));
});
