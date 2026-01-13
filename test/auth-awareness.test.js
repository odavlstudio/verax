import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { HumanBehaviorDriver } from '../src/verax/observe/human-driver.js';
import { discoverInteractions } from '../src/verax/observe/interaction-discovery.js';
import { runInteraction } from '../src/verax/observe/interaction-runner.js';
import { DEFAULT_SCAN_BUDGET } from '../src/verax/shared/scan-budget.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('login form detection and execution', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route('**/*', route => route.fulfill({ body: `
    <!DOCTYPE html>
    <html>
    <head><title>Login Test</title></head>
    <body>
      <form id="loginForm">
        <input type="email" name="email" placeholder="Email" />
        <input type="password" name="password" placeholder="Password" />
        <button type="submit">Login</button>
      </form>
      <script>
        document.getElementById('loginForm').addEventListener('submit', (e) => {
          e.preventDefault();
          localStorage.setItem('token', 'test-token-123');
          window.location.href = '/dashboard';
        });
      </script>
    </body>
    </html>
  `, contentType: 'text/html' }));

  await page.goto('http://localhost:8080');
  await page.waitForTimeout(100);

  const result = await discoverInteractions(page, 'http://localhost');
  const interactions = result.interactions || [];
  const loginInteraction = interactions.find(i => i.type === 'login');
  
  assert.ok(loginInteraction, 'Login interaction should be discovered');
  assert.strictEqual(loginInteraction.type, 'login');
  // Login form detection can be based on password input OR form context with login semantics
  // Don't assert on hasPasswordInput as it's an internal signal, not the contract

  const screenshotsDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const timestamp = Date.now().toString();
  const trace = await runInteraction(page, loginInteraction, timestamp, 0, screenshotsDir, 'http://localhost:8080', Date.now(), DEFAULT_SCAN_BUDGET);

  assert.ok(trace.login, 'Trace should contain login metadata');
  assert.strictEqual(trace.interactionType, 'login');
  assert.strictEqual(trace.login.submitted, true, 'Login should be submitted');
  assert.ok(trace.login.storageChanged || trace.login.cookiesChanged || trace.login.redirected, 'Login should produce observable change');

  await browser.close();
});

test('login silent failure detection - no redirect or storage change', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.route('**/*', route => route.fulfill({ body: `
    <!DOCTYPE html>
    <html>
    <head><title>Login Silent Failure</title></head>
    <body>
      <form id="loginForm">
        <input type="email" name="email" />
        <input type="password" name="password" />
        <button type="submit">Login</button>
      </form>
      <script>
        document.getElementById('loginForm').addEventListener('submit', (e) => {
          e.preventDefault();
          // Do nothing - silent failure
        });
      </script>
    </body>
    </html>
  `, contentType: 'text/html' }));

  await page.goto('http://localhost:8080');
  await page.waitForTimeout(100);

  const result = await discoverInteractions(page, 'http://localhost:8080');
  const interactions = result.interactions || [];
  const loginInteraction = interactions.find(i => i.type === 'login');
  
  assert.ok(loginInteraction, 'Login interaction should be discovered');

  const screenshotsDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const timestamp = Date.now().toString();
  const trace = await runInteraction(page, loginInteraction, timestamp, 0, screenshotsDir, 'http://localhost:8080', Date.now(), DEFAULT_SCAN_BUDGET);

  assert.ok(trace.login, 'Trace should contain login metadata');
  assert.strictEqual(trace.login.submitted, true, 'Login should be submitted');
  
  // This should be detected as silent failure - no redirect, no storage change, no network
  const isSilentFailure = !trace.login.redirected && 
                          !trace.login.storageChanged && 
                          !trace.login.cookiesChanged &&
                          (!trace.sensors?.network?.totalRequests || trace.sensors.network.totalRequests === 0);
  assert.ok(isSilentFailure, 'Login should be detected as silent failure');

  await browser.close();
});

test('logout detection and execution', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route('**/*', route => route.fulfill({ body: `
    <!DOCTYPE html>
    <html>
    <head><title>Logout Test</title></head>
    <body>
      <button id="logoutBtn">Logout</button>
      <script>
        // Set initial session state
        localStorage.setItem('token', 'test-token');
        localStorage.setItem('user', 'test-user');
        
        document.getElementById('logoutBtn').addEventListener('click', () => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        });
      </script>
    </body>
    </html>
  `, contentType: 'text/html' }));

  await page.goto('http://localhost:8080');
  await page.waitForTimeout(100);

  const result = await discoverInteractions(page, 'http://localhost:8080');
  const interactions = result.interactions || [];
  const logoutInteraction = interactions.find(i => i.type === 'logout');
  
  assert.ok(logoutInteraction, 'Logout interaction should be discovered');
  assert.strictEqual(logoutInteraction.type, 'logout');

  const screenshotsDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const timestamp = Date.now().toString();
  const trace = await runInteraction(page, logoutInteraction, timestamp, 0, screenshotsDir, 'http://localhost:8080', Date.now(), DEFAULT_SCAN_BUDGET);

  assert.ok(trace.logout, 'Trace should contain logout metadata');
  assert.strictEqual(trace.interactionType, 'logout');
  assert.strictEqual(trace.logout.clicked, true, 'Logout should be clicked');
  assert.ok(trace.logout.storageChanged || trace.logout.redirected, 'Logout should produce observable change');

  await browser.close();
});

test('logout silent failure detection - no state change', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route('**/*', route => route.fulfill({ body: `
    <!DOCTYPE html>
    <html>
    <head><title>Logout Silent Failure</title></head>
    <body>
      <button id="logoutBtn">Logout</button>
      <script>
        localStorage.setItem('token', 'test-token');
        
        document.getElementById('logoutBtn').addEventListener('click', () => {
          // Do nothing - silent failure
        });
      </script>
    </body>
    </html>
  `, contentType: 'text/html' }));

  await page.goto('http://localhost:8080');
  await page.waitForTimeout(100);

  const result = await discoverInteractions(page, 'http://localhost:8080');
  const interactions = result.interactions || [];
  const logoutInteraction = interactions.find(i => i.type === 'logout');
  
  assert.ok(logoutInteraction, 'Logout interaction should be discovered');

  const screenshotsDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const timestamp = Date.now().toString();
  const trace = await runInteraction(page, logoutInteraction, timestamp, 0, screenshotsDir, 'http://localhost:8080', Date.now(), DEFAULT_SCAN_BUDGET);

  assert.ok(trace.logout, 'Trace should contain logout metadata');
  assert.strictEqual(trace.logout.clicked, true, 'Logout should be clicked');
  
  // This should be detected as silent failure - no redirect, no storage change
  const isSilentFailure = !trace.logout.redirected && 
                          !trace.logout.storageChanged && 
                          !trace.logout.cookiesChanged;
  assert.ok(isSilentFailure, 'Logout should be detected as silent failure');

  await browser.close();
});

test('protected route detection - redirect to login', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/admin')) {
      return route.fulfill({ body: '<!DOCTYPE html><html><body><script>if (!localStorage.getItem("token")) { window.location.href = "/login"; }</script><h1>Admin</h1></body></html>', contentType: 'text/html' });
    }
    return route.fulfill({ body: `
    <!DOCTYPE html>
    <html>
    <head><title>Protected Route Test</title></head>
    <body>
      <a href="/admin/dashboard">Admin Dashboard</a>
    </body>
    </html>
  `, contentType: 'text/html' });
  });

  await page.goto('http://localhost:8080');
  await page.waitForTimeout(100);

  const result = await discoverInteractions(page, 'http://localhost:8080');
  const interactions = result.interactions || [];
  const authGuardInteraction = interactions.find(i => i.type === 'auth_guard' && i.href?.includes('/admin'));
  
  assert.ok(authGuardInteraction, 'Protected route interaction should be discovered');
  assert.strictEqual(authGuardInteraction.type, 'auth_guard');

  const screenshotsDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const timestamp = Date.now().toString();
  
  const trace = await runInteraction(page, authGuardInteraction, timestamp, 0, screenshotsDir, 'http://localhost:8080', Date.now(), DEFAULT_SCAN_BUDGET);

  assert.ok(trace.authGuard, 'Trace should contain auth guard metadata');
  assert.strictEqual(trace.interactionType, 'auth_guard');
  // Protected route should either redirect to login or show access denied
  assert.ok(trace.authGuard.isProtected || trace.authGuard.redirectedToLogin || trace.authGuard.hasAccessDenied, 
            'Protected route should be detected as protected');

  await browser.close();
});

test('protected route silent failure - accessible without auth', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route('**/*', route => route.fulfill({ body: `
    <!DOCTYPE html>
    <html>
    <head><title>Unprotected Admin Route</title></head>
    <body>
      <a href="/admin/dashboard">Admin Dashboard</a>
      <h1>Admin Content (Should Be Protected!)</h1>
    </body>
    </html>
  `, contentType: 'text/html' }));

  await page.goto('http://localhost:8080');
  await page.waitForTimeout(100);

  const result = await discoverInteractions(page, 'http://localhost:8080');
  const interactions = result.interactions || [];
  const authGuardInteraction = interactions.find(i => i.type === 'auth_guard' && i.href?.includes('/admin'));
  
  assert.ok(authGuardInteraction, 'Protected route interaction should be discovered');

  const screenshotsDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const timestamp = Date.now().toString();
  
  const trace = await runInteraction(page, authGuardInteraction, timestamp, 0, screenshotsDir, 'http://localhost:8080', Date.now(), DEFAULT_SCAN_BUDGET);

  assert.ok(trace.authGuard, 'Trace should contain auth guard metadata');
  
  // This should be detected as silent failure - route is accessible without authentication
  const isSilentFailure = !trace.authGuard.isProtected && 
                          trace.authGuard.httpStatus !== 401 && 
                          trace.authGuard.httpStatus !== 403 &&
                          !trace.authGuard.redirectedToLogin;
  assert.ok(isSilentFailure, 'Unprotected admin route should be detected as silent failure');

  await browser.close();
});

test('session state tracking for login', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route('**/*', route => route.fulfill({ body: `
    <!DOCTYPE html>
    <html>
    <head><title>Session Tracking Test</title></head>
    <body>
      <form id="loginForm">
        <input type="email" name="email" />
        <input type="password" name="password" />
        <button type="submit">Login</button>
      </form>
      <script>
        document.getElementById('loginForm').addEventListener('submit', (e) => {
          e.preventDefault();
          localStorage.setItem('auth_token', 'token-123');
          localStorage.setItem('user_id', 'user-456');
          sessionStorage.setItem('session_id', 'session-789');
        });
      </script>
    </body>
    </html>
  `, contentType: 'text/html' }));

  await page.goto('http://localhost:8080');
  await page.waitForTimeout(100);

  const humanDriver = new HumanBehaviorDriver({}, DEFAULT_SCAN_BUDGET);
  const beforeState = await humanDriver.captureSessionState(page);
  
  assert.strictEqual(Object.keys(beforeState.localStorage).length, 0, 'Before login, localStorage should be empty');
  assert.strictEqual(Object.keys(beforeState.sessionStorage).length, 0, 'Before login, sessionStorage should be empty');

  const result = await discoverInteractions(page, 'http://localhost:8080');
  const interactions = result.interactions || [];
  const loginInteraction = interactions.find(i => i.type === 'login');
  
  const screenshotsDir = mkdtempSync(join(tmpdir(), 'verax-test-'));
  const timestamp = Date.now().toString();
  const trace = await runInteraction(page, loginInteraction, timestamp, 0, screenshotsDir, 'http://localhost:8080', Date.now(), DEFAULT_SCAN_BUDGET);

  assert.ok(trace.session, 'Trace should contain session state after login');
  assert.ok(trace.login.storageChanged, 'Login should change storage');
  
  const afterState = trace.session;
  assert.ok(Object.keys(afterState.localStorage).length > 0, 'After login, localStorage should have keys');

  await browser.close();
});

