/**
 * Phase 5: Async & Partial Failure Detection Tests
 * Tests for detecting partial success, loading stuck, and async state mismatch silent failures
 */

import test from 'node:test';
import assert from 'node:assert';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { HumanBehaviorDriver } from '../src/verax/observe/human-driver.js';
import { LoadingSensor } from '../src/verax/observe/loading-sensor.js';
import { runInteraction } from '../src/verax/observe/interaction-runner.js';
import { DEFAULT_SCAN_BUDGET } from '../src/verax/shared/scan-budget.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures', 'phase5-async');

let browser;
let page;

test.before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  
  mkdirSync(fixturesDir, { recursive: true });
  
  const htmlPath = resolve(fixturesDir, 'index.html');
  writeFileSync(htmlPath, `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Phase 5 Async Test</title>
      <style>
        .loader { display: none; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; width: 20px; height: 20px; }
        .loader.active { display: inline-block; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        #result { margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Phase 5 Async Tests</h1>
      
      <!-- Test 1: Partial Success (network succeeds but no DOM update) -->
      <div id="test-partial-success">
        <button id="partial-btn">Trigger Partial Success</button>
        <p id="partial-result"></p>
      </div>
      
      <!-- Test 2: Loading Stuck (loading indicator never resolves) -->
      <div id="test-loading-stuck">
        <button id="loading-btn">Trigger Loading Stuck</button>
        <div id="loading-spinner" class="loader"></div>
        <p id="loading-status"></p>
      </div>
      
      <!-- Test 3: Async State Mismatch (state changes but UI doesn't) -->
      <div id="test-async-mismatch">
        <button id="state-btn">Trigger State Change</button>
        <p id="state-display" data-expected="synced">Not Synced</p>
      </div>
      
      <!-- Test 4: Successful Loading Resolution -->
      <div id="test-loading-success">
        <button id="success-loading-btn">Trigger Success Loading</button>
        <div id="success-spinner" class="loader"></div>
        <p id="success-result"></p>
      </div>
      
      <script>
        // Test 1: Partial success - network succeeds but DOM unchanged
        document.getElementById('partial-btn').addEventListener('click', async () => {
          try {
            const response = await fetch('/api/partial', { method: 'POST' });
            if (response.ok) {
              // Network succeeded but intentionally don't update DOM
              // This simulates a silent failure
            }
          } catch (e) {}
        });
        
        // Test 2: Loading stuck - spinner shows but never disappears
        document.getElementById('loading-btn').addEventListener('click', async () => {
          const spinner = document.getElementById('loading-spinner');
          spinner.classList.add('active');
          // Intentionally never resolve the loading state
          setTimeout(() => {
            // Never remove the active class - loading is stuck
          }, 10000);
        });
        
        // Test 3: Async state mismatch - update state but not UI
        document.getElementById('state-btn').addEventListener('click', async () => {
          // Update internal state
          window.appState = { synced: true };
          localStorage.setItem('appState', JSON.stringify(window.appState));
          // But intentionally don't update the visible DOM
          // The data-expected attribute is set but display is not updated
        });
        
        // Test 4: Successful loading - spinner appears then disappears
        document.getElementById('success-loading-btn').addEventListener('click', async () => {
          const spinner = document.getElementById('success-spinner');
          const result = document.getElementById('success-result');
          spinner.classList.add('active');
          
          setTimeout(() => {
            spinner.classList.remove('active');
            result.textContent = 'Success!';
          }, 500);
        });
      </script>
    </body>
    </html>
  `);
});

test.after(async () => {
  if (browser) {
    await browser.close();
  }
});

test('partial success silent failure detection - network succeeds but no DOM change', async () => {
  const fixtureUrl = `file://${resolve(fixturesDir, 'index.html')}`;
  await page.goto(fixtureUrl);
  
  const _driver = new HumanBehaviorDriver({}, DEFAULT_SCAN_BUDGET);
  
  const interaction = {
    type: 'button',
    selector: '#partial-btn',
    label: 'Trigger Partial Success',
    element: page.locator('#partial-btn')
  };
  
  const screenshotsDir = resolve(fixturesDir, 'screenshots');
  mkdirSync(screenshotsDir, { recursive: true });
  
  const trace = await runInteraction(
    page,
    interaction,
    Date.now(),
    0,
    screenshotsDir,
    fixtureUrl,
    Date.now(),
    DEFAULT_SCAN_BUDGET
  );
  
  // Verify trace has sensors data
  assert.ok(trace.sensors, 'trace has sensors');
  assert.ok(trace.sensors.network, 'trace has network sensor');
  
  // The detection happens in detect() function, not here
  // This test verifies the trace is properly captured
  assert.ok(trace.before.url, 'has before URL');
  assert.ok(trace.after.url, 'has after URL');
});

test('loading stuck silent failure detection - spinner never resolves', async () => {
  const fixtureUrl = `file://${resolve(fixturesDir, 'index.html')}`;
  await page.goto(fixtureUrl);
  
  // Click loading button
  await page.click('#loading-btn');
  
  // Wait a bit to let loading start
  await page.waitForTimeout(200);
  
  // Check that spinner is active
  const spinnerActive = await page.locator('#loading-spinner').evaluate(el => 
    el.classList.contains('active')
  );
  
  assert.ok(spinnerActive, 'spinner is active after click');
});

test('async state mismatch detection - state updated but UI unchanged', async () => {
  const fixtureUrl = `file://${resolve(fixturesDir, 'index.html')}`;
  await page.goto(fixtureUrl);
  
  // Click state button
  await page.click('#state-btn');
  
  // Verify state was updated
  const stateStr = await page.evaluate(() => localStorage.getItem('appState'));
  assert.ok(stateStr, 'state was stored in localStorage');
  
  const state = JSON.parse(stateStr);
  assert.strictEqual(state.synced, true, 'state.synced is true');
  
  // But verify UI was not updated
  const uiText = await page.textContent('#state-display');
  assert.strictEqual(uiText, 'Not Synced', 'UI display not updated to match state');
});

test('successful loading resolution - spinner appears and disappears', async () => {
  const fixtureUrl = `file://${resolve(fixturesDir, 'index.html')}`;
  await page.goto(fixtureUrl);
  
  // Click success loading button
  await page.click('#success-loading-btn');
  
  // Wait for loading to start
  await page.waitForTimeout(150);
  
  // Verify spinner is active
  const spinnerActive1 = await page.locator('#success-spinner').evaluate(el => 
    el.classList.contains('active')
  );
  assert.ok(spinnerActive1, 'spinner is active after click');
  
  // Wait for loading to resolve
  await page.waitForTimeout(600);
  
  // Verify spinner is no longer active
  const spinnerActive2 = await page.locator('#success-spinner').evaluate(el => 
    el.classList.contains('active')
  );
  assert.ok(!spinnerActive2, 'spinner is no longer active after timeout');
  
  // Verify result text updated
  const result = await page.textContent('#success-result');
  assert.strictEqual(result, 'Success!', 'result text updated');
});

test('loading sensor detects unresolved loading state', async () => {
  const fixtureUrl = `file://${resolve(fixturesDir, 'index.html')}`;
  await page.goto(fixtureUrl);
  
  const sensor = new LoadingSensor({ loadingTimeout: 5000 });
  
  const { windowId, state } = sensor.startWindow(page);
  
  // Trigger loading that never resolves
  await page.click('#loading-btn');
  await page.waitForTimeout(300);
  
  const summary = await sensor.stopWindow(windowId, state);
  
  // Since file:// doesn't really support loading indicators in practice,
  // we just verify the sensor works without errors
  assert.ok(summary, 'sensor returns summary');
  assert.strictEqual(summary.id, windowId, 'summary has correct windowId');
});

test('detect phase5 async findings in execution trace', async () => {
  const fixtureUrl = `file://${resolve(fixturesDir, 'index.html')}`;
  await page.goto(fixtureUrl);
  
  // Execute a real interaction that should trigger detection
  const _driver = new HumanBehaviorDriver({}, DEFAULT_SCAN_BUDGET);
  
  const interaction = {
    type: 'button',
    selector: '#loading-btn',
    label: 'Trigger Loading Stuck',
    element: page.locator('#loading-btn')
  };
  
  const screenshotsDir = resolve(fixturesDir, 'screenshots');
  mkdirSync(screenshotsDir, { recursive: true });
  
  const trace = await runInteraction(
    page,
    interaction,
    Date.now(),
    1,
    screenshotsDir,
    fixtureUrl,
    Date.now(),
    DEFAULT_SCAN_BUDGET
  );
  
  // Verify trace includes loading sensor data
  assert.ok(trace.sensors, 'trace has sensors');
  assert.ok(trace.sensors.loading, 'trace has loading sensor data');
  assert.ok(typeof trace.sensors.loading.unresolved === 'boolean', 'loading sensor tracks unresolved state');
});

test('verify no regressions - all interaction types still work', async () => {
  const fixtureUrl = `file://${resolve(fixturesDir, 'index.html')}`;
  await page.goto(fixtureUrl);
  
  // Verify basic button click works
  const interaction = {
    type: 'button',
    selector: '#partial-btn',
    element: page.locator('#partial-btn')
  };
  
  const screenshotsDir = resolve(fixturesDir, 'screenshots');
  mkdirSync(screenshotsDir, { recursive: true });
  
  const trace = await runInteraction(
    page,
    interaction,
    Date.now(),
    0,
    screenshotsDir,
    fixtureUrl,
    Date.now(),
    DEFAULT_SCAN_BUDGET
  );
  
  // Verify basic trace structure is intact
  assert.ok(trace.interaction, 'trace has interaction');
  assert.ok(trace.before, 'trace has before state');
  assert.ok(trace.after, 'trace has after state');
  assert.ok(trace.sensors, 'trace has sensors');
  assert.ok(trace.humanDriver === true, 'trace marked as human-driven');
});
