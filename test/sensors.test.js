import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import http from 'http';
import { NetworkSensor } from '../src/verax/observe/network-sensor.js';
import { ConsoleSensor } from '../src/verax/observe/console-sensor.js';
import { UISignalSensor } from '../src/verax/observe/ui-signal-sensor.js';

let browser;
let context;
let page;
let testServer;

before(async () => {
  browser = await chromium.launch();
  context = await browser.newContext();

  // Create a simple HTTP server for tests that need real network requests
  testServer = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><img src="/api/test.jpg"></body></html>');
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((resolve) => {
    testServer.listen(0, () => {
      resolve();
    });
  });
});

after(async () => {
  await context.close();
  await browser.close();
  await new Promise((resolve) => {
    testServer.close(() => {
      resolve();
    });
  });
});

const sequential = { concurrency: false };

test('NetworkSensor tracks successful requests', sequential, async () => {
  page = await context.newPage();
  const sensor = new NetworkSensor();

  const windowId = sensor.startWindow(page);

  await page.goto('about:blank');

  const summary = sensor.stopWindow(windowId);

  assert.equal(summary.totalRequests, 0);
  assert.equal(summary.failedRequests, 0);
  assert.equal(summary.slowRequestsCount, 0);

  await page.close();
});

test('NetworkSensor tracks failed requests', sequential, async () => {
  page = await context.newPage();
  const sensor = new NetworkSensor();

  const port = testServer.address().port;

  await page.route('**/api/**', (route) => {
    route.abort('failed');
  });

  const windowId = sensor.startWindow(page);

  try {
    await page.goto(`http://localhost:${port}/`, {
      waitUntil: 'networkidle'
    });
  } catch {
    // Expected to fail
  }

  const summary = sensor.stopWindow(windowId);

  assert.equal(summary.failedRequests, 1);
  assert.ok(Object.keys(summary.failedByStatus).length > 0 || summary.unfinishedCount > 0);

  await page.close();
});

test('ConsoleSensor captures console errors', sequential, async () => {
  page = await context.newPage();
  const sensor = new ConsoleSensor();

  const windowId = sensor.startWindow(page);

  await page.goto('data:text/html,<html><body><script>console.error("test error");</script></body></html>');

  const summary = sensor.stopWindow(windowId, page);

  assert.ok(summary.consoleErrorCount > 0);
  assert.ok(summary.lastErrors.length > 0);
  assert.ok(summary.hasErrors);

  await page.close();
});

test('ConsoleSensor captures page errors', sequential, async () => {
  page = await context.newPage();
  const sensor = new ConsoleSensor();

  const windowId = sensor.startWindow(page);

  await page.goto('data:text/html,<html><body><script>throw new Error("page error");</script></body></html>');

  const summary = sensor.stopWindow(windowId, page);

  assert.ok(summary.pageErrorCount > 0);
  assert.ok(summary.hasErrors);

  await page.close();
});

test('UISignalSensor detects loading indicators', sequential, async () => {
  page = await context.newPage();
  const sensor = new UISignalSensor();

  await page.goto('data:text/html,<html><body>No loading</body></html>');
  const snapshotBefore = await sensor.snapshot(page);

  assert.equal(snapshotBefore.hasLoadingIndicator, false);
  assert.equal(snapshotBefore.hasDialog, false);

  await page.evaluate(() => {
    const div = document.createElement('div');
    div.setAttribute('aria-busy', 'true');
    document.body.appendChild(div);
  });

  const snapshotAfter = await sensor.snapshot(page);

  assert.equal(snapshotAfter.hasLoadingIndicator, true);

  await page.close();
});

test('UISignalSensor detects error signals', sequential, async () => {
  page = await context.newPage();
  const sensor = new UISignalSensor();

  await page.goto('data:text/html,<html><body><div role="alert">Error message</div></body></html>');
  const snapshot = await sensor.snapshot(page);

  assert.equal(snapshot.hasErrorSignal, true);

  await page.close();
});

test('UISignalSensor diffs snapshots correctly', sequential, async () => {
  page = await context.newPage();
  const sensor = new UISignalSensor();

  await page.goto('data:text/html,<html><body>Initial</body></html>');
  const beforeSnapshot = await sensor.snapshot(page);

  await page.evaluate(() => {
    const div = document.createElement('div');
    div.setAttribute('aria-busy', 'true');
    document.body.appendChild(div);
  });

  const afterSnapshot = await sensor.snapshot(page);
  const diff = sensor.diff(beforeSnapshot, afterSnapshot);

  assert.equal(diff.changed, true);
  assert.equal(typeof diff.explanation, 'string');

  await page.close();
});
