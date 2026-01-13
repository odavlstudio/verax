import { test } from 'node:test';
import assert from 'node:assert';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';
import { createBrowser, navigateToUrl, closeBrowser } from '../src/verax/observe/browser.js';
import { discoverInteractions } from '../src/verax/observe/interaction-discovery.js';
import { HumanBehaviorDriver } from '../src/verax/observe/human-driver.js';
import { DEFAULT_SCAN_BUDGET } from '../src/verax/shared/scan-budget.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_DIR = resolve(__dirname, 'fixtures', 'user-simulation');
const TEST_FILE = resolve(TEST_DIR, 'test-upload.txt');

async function createTestPage() {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(TEST_FILE, 'VERAX test file content');
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>User Simulation Test</title>
  <style>
    .hoverable { cursor: pointer; }
    .hoverable:hover + .popup { display: block; }
    .popup { display: none; position: absolute; background: #fff; border: 1px solid #000; padding: 10px; }
    #keyboard-btn { padding: 10px; margin: 10px; }
  </style>
</head>
<body>
  <h1>User Simulation Test Page</h1>
  
  <div class="hoverable" id="hover-target" aria-haspopup="true">
    Hover me
  </div>
  <div class="popup" id="hover-popup" role="menu">Hover content revealed</div>
  
  <button id="keyboard-btn" tabindex="0">Keyboard Accessible Button</button>
  <a href="#keyboard-link" id="keyboard-link" tabindex="0">Keyboard Accessible Link</a>
  
  <form id="upload-form" action="/upload" method="post" enctype="multipart/form-data">
    <input type="file" id="file-input" name="file" accept=".txt">
    <button type="submit">Upload</button>
  </form>
  
  <div id="keyboard-result"></div>
  <div id="hover-result"></div>
  <div id="upload-result"></div>
  
  <script>
    document.getElementById('keyboard-btn').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        document.getElementById('keyboard-result').textContent = 'Keyboard navigation worked';
      }
    });
    
    document.getElementById('hover-target').addEventListener('mouseenter', function() {
      document.getElementById('hover-result').textContent = 'Hover interaction worked';
    });
    
    document.getElementById('upload-form').addEventListener('submit', function(e) {
      e.preventDefault();
      const fileInput = document.getElementById('file-input');
      if (fileInput.files.length > 0) {
        document.getElementById('upload-result').textContent = 'File uploaded: ' + fileInput.files[0].name;
      }
    });
  </script>
</body>
</html>`;
  
  const htmlPath = resolve(TEST_DIR, 'index.html');
  writeFileSync(htmlPath, html);
  return htmlPath;
}

test('discoverInteractions finds hoverable elements', async () => {
  const htmlPath = await createTestPage();
  const { browser, page } = await createBrowser();
  
  try {
    await navigateToUrl(page, `file://${htmlPath}`, DEFAULT_SCAN_BUDGET);
    const { interactions } = await discoverInteractions(page, 'file://', DEFAULT_SCAN_BUDGET);
    
    const hoverInteraction = interactions.find(i => i.type === 'hover');
    assert.ok(hoverInteraction, 'Should discover hover interaction');
    assert.strictEqual(hoverInteraction.label, 'Hover me');
    assert.ok(hoverInteraction.selector.includes('hover-target') || hoverInteraction.selector.includes('[aria-haspopup]'));
  } finally {
    await closeBrowser(browser);
  }
});

test('discoverInteractions finds keyboard-accessible elements', async () => {
  const htmlPath = await createTestPage();
  const { browser, page } = await createBrowser();
  
  try {
    await navigateToUrl(page, `file://${htmlPath}`, DEFAULT_SCAN_BUDGET);
    const { interactions } = await discoverInteractions(page, 'file://', DEFAULT_SCAN_BUDGET);
    
    const keyboardInteraction = interactions.find(i => i.type === 'keyboard');
    assert.ok(keyboardInteraction, 'Should discover keyboard interaction');
    assert.ok(keyboardInteraction.selector.includes('keyboard-btn') || keyboardInteraction.selector.includes('keyboard-link'));
  } finally {
    await closeBrowser(browser);
  }
});

test('discoverInteractions finds file upload inputs', async () => {
  const htmlPath = await createTestPage();
  const { browser, page } = await createBrowser();
  
  try {
    await navigateToUrl(page, `file://${htmlPath}`, DEFAULT_SCAN_BUDGET);
    const { interactions } = await discoverInteractions(page, 'file://', DEFAULT_SCAN_BUDGET);
    
    const fileInteraction = interactions.find(i => i.type === 'file_upload');
    assert.ok(fileInteraction, 'Should discover file upload interaction');
    assert.ok(fileInteraction.selector.includes('file-input'));
  } finally {
    await closeBrowser(browser);
  }
});

test('performKeyboardNavigation triggers Enter key', async () => {
  const htmlPath = await createTestPage();
  const { browser, page } = await createBrowser();
  
  try {
    await navigateToUrl(page, `file://${htmlPath}`, DEFAULT_SCAN_BUDGET);
    const { interactions: _interactions } = await discoverInteractions(page, 'file://', DEFAULT_SCAN_BUDGET);
    
    const driver = new HumanBehaviorDriver({}, DEFAULT_SCAN_BUDGET);
    const result = await driver.performKeyboardNavigation(page, 5);
    
    assert.ok(result.focusOrder, 'Should have focus order');
    assert.ok(result.actions, 'Should have actions');
    assert.ok(result.actions.length > 0, 'Should perform actions');
    
    await page.waitForTimeout(300);
    
    const keyboardResult = await page.evaluate(() => {
      return document.getElementById('keyboard-result')?.textContent || '';
    });
    assert.ok(keyboardResult.includes('Keyboard navigation worked'), 'Keyboard navigation should trigger result');
  } finally {
    await closeBrowser(browser);
  }
});

test('hoverAndObserve reveals hover content', async () => {
  const htmlPath = await createTestPage();
  const { browser, page } = await createBrowser();
  
  try {
    await navigateToUrl(page, `file://${htmlPath}`, DEFAULT_SCAN_BUDGET);
    const { interactions } = await discoverInteractions(page, 'file://', DEFAULT_SCAN_BUDGET);
    const hoverInteraction = interactions.find(i => i.type === 'hover');
    
    assert.ok(hoverInteraction, 'Should find hover interaction');
    
    const driver = new HumanBehaviorDriver({}, DEFAULT_SCAN_BUDGET);
    const result = await driver.hoverAndObserve(page, hoverInteraction.element);
    
    assert.ok(result.hovered, 'Should hover element');
    assert.ok(result.selector, 'Should have selector');
    
    await page.waitForTimeout(300);
    
    const hoverResult = await page.evaluate(() => {
      return document.getElementById('hover-result')?.textContent || '';
    });
    assert.ok(hoverResult.includes('Hover interaction worked'), 'Hover should trigger result');
  } finally {
    await closeBrowser(browser);
  }
});

test('uploadFile attaches file and submits form', async () => {
  const htmlPath = await createTestPage();
  const { browser, page } = await createBrowser();
  
  try {
    await navigateToUrl(page, `file://${htmlPath}`, DEFAULT_SCAN_BUDGET);
    const { interactions } = await discoverInteractions(page, 'file://', DEFAULT_SCAN_BUDGET);
    const fileInteraction = interactions.find(i => i.type === 'file_upload');
    
    assert.ok(fileInteraction, 'Should find file upload interaction');
    
    const driver = new HumanBehaviorDriver({}, DEFAULT_SCAN_BUDGET);
    const result = await driver.uploadFile(page, fileInteraction.element, TEST_FILE);
    
    assert.ok(result.attached, 'Should attach file');
    assert.ok(result.filePath, 'Should have file path');
    assert.ok(result.submitted, 'Should submit form');
    
    await page.waitForTimeout(300);
    
    const uploadResult = await page.evaluate(() => {
      return document.getElementById('upload-result')?.textContent || '';
    });
    assert.ok(uploadResult.includes('File uploaded'), 'File upload should trigger result');
  } finally {
    await closeBrowser(browser);
  }
});

test('keyboard navigation detects silent failure when no effect', async () => {
  const html = `<!DOCTYPE html>
<html>
<body>
  <button id="broken-btn" tabindex="0">Broken Button</button>
  <script>
    document.getElementById('broken-btn').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        // Promise triggered but no visible feedback, no network, no DOM change
        Promise.resolve().then(() => {});
      }
    });
  </script>
</body>
</html>`;
  
  const htmlPath = resolve(TEST_DIR, 'silent-failure-keyboard.html');
  writeFileSync(htmlPath, html);
  
  const { browser, page } = await createBrowser();
  
  try {
    await navigateToUrl(page, `file://${htmlPath}`, DEFAULT_SCAN_BUDGET);
    const { interactions } = await discoverInteractions(page, 'file://', DEFAULT_SCAN_BUDGET);
    const keyboardInteraction = interactions.find(i => i.type === 'keyboard');
    
    assert.ok(keyboardInteraction, 'Should find keyboard interaction');
    
    const driver = new HumanBehaviorDriver({}, DEFAULT_SCAN_BUDGET);
    const result = await driver.performKeyboardNavigation(page, 3);
    
    assert.ok(result.focusOrder.length > 0, 'Should have focus order');
    assert.ok(result.actions.length > 0, 'Should have actions');
    
    // Verify no visible effect occurred
    const hasEffect = await page.evaluate(() => {
      return document.getElementById('result') !== null || 
             document.body.textContent.includes('success') ||
             document.body.textContent.includes('result');
    });
    assert.ok(!hasEffect, 'Should have no visible effect (silent failure scenario)');
  } finally {
    await closeBrowser(browser);
  }
});

test('hover detects silent failure when no reveal', async () => {
  const html = `<!DOCTYPE html>
<html>
<body>
  <div id="broken-hover" aria-haspopup="true" data-hover="true">Hover me (broken)</div>
  <script>
    document.getElementById('broken-hover').addEventListener('mouseenter', function() {
      // Hover handler exists but reveals nothing
      Promise.resolve().then(() => {});
    });
  </script>
</body>
</html>`;
  
  const htmlPath = resolve(TEST_DIR, 'silent-failure-hover.html');
  writeFileSync(htmlPath, html);
  
  const { browser, page } = await createBrowser();
  
  try {
    await navigateToUrl(page, `file://${htmlPath}`, DEFAULT_SCAN_BUDGET);
    const { interactions } = await discoverInteractions(page, 'file://', DEFAULT_SCAN_BUDGET);
    const hoverInteraction = interactions.find(i => i.type === 'hover');
    
    assert.ok(hoverInteraction, 'Should find hover interaction');
    
    const driver = new HumanBehaviorDriver({}, DEFAULT_SCAN_BUDGET);
    const result = await driver.hoverAndObserve(page, hoverInteraction.element);
    
    assert.ok(result.hovered, 'Should hover element');
    
    // Verify no popup/reveal occurred
    const hasReveal = await page.evaluate(() => {
      const popups = document.querySelectorAll('[role="menu"], .popup, [data-hover-visible]');
      return Array.from(popups).some(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    });
    assert.ok(!hasReveal, 'Should have no reveal (silent failure scenario)');
  } finally {
    await closeBrowser(browser);
  }
});

test('file upload detects silent failure when no effect', async () => {
  const html = `<!DOCTYPE html>
<html>
<body>
  <form id="broken-upload-form" action="/upload" method="post" enctype="multipart/form-data">
    <input type="file" id="broken-file-input" name="file">
    <button type="submit">Upload</button>
  </form>
  <script>
    document.getElementById('broken-upload-form').addEventListener('submit', function(e) {
      e.preventDefault();
      // Form submitted but no feedback, no network request, no DOM change
      Promise.resolve().then(() => {});
    });
  </script>
</body>
</html>`;
  
  const htmlPath = resolve(TEST_DIR, 'silent-failure-upload.html');
  writeFileSync(htmlPath, html);
  
  const { browser, page } = await createBrowser();
  
  try {
    await navigateToUrl(page, `file://${htmlPath}`, DEFAULT_SCAN_BUDGET);
    const { interactions } = await discoverInteractions(page, 'file://', DEFAULT_SCAN_BUDGET);
    const fileInteraction = interactions.find(i => i.type === 'file_upload');
    
    assert.ok(fileInteraction, 'Should find file upload interaction');
    
    const driver = new HumanBehaviorDriver({}, DEFAULT_SCAN_BUDGET);
    const result = await driver.uploadFile(page, fileInteraction.element, TEST_FILE);
    
    assert.ok(result.attached, 'Should attach file');
    assert.ok(result.submitted, 'Should submit form');
    
    await page.waitForTimeout(300);
    
    // Verify no visible feedback occurred
    const hasFeedback = await page.evaluate(() => {
      return document.getElementById('upload-result') !== null ||
             document.body.textContent.includes('uploaded') ||
             document.body.textContent.includes('success');
    });
    assert.ok(!hasFeedback, 'Should have no visible feedback (silent failure scenario)');
  } finally {
    await closeBrowser(browser);
  }
});

