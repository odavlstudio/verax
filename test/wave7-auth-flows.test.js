import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { chromium } from 'playwright';
import http from 'http';

import { validateFlowSpec, resolveSecrets, extractSecretValues } from '../src/verax/flow/flow-spec.js';
import { redactString, redactObject, redactJSON } from '../src/verax/flow/redaction.js';
import { executeFlow } from '../src/verax/flow/flow-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures');

describe('Wave 7: Flow Spec & Validation', () => {
  it('validates a valid flow spec', () => {
    const spec = {
      name: 'login',
      baseUrl: 'http://localhost:3000',
      steps: [{ type: 'goto', url: '/login' }]
    };

    const validated = validateFlowSpec(spec);
    assert.strictEqual(validated.name, 'login');
    assert.ok(validated.allowlist);
    assert.ok(Array.isArray(validated.steps));
  });

  it('rejects missing name', () => {
    const spec = {
      baseUrl: 'http://localhost:3000',
      steps: [{ type: 'goto', url: '/login' }]
    };

    assert.throws(() => validateFlowSpec(spec), /must have a "name"/);
  });

  it('rejects invalid step type', () => {
    const spec = {
      name: 'test',
      baseUrl: 'http://localhost:3000',
      steps: [{ type: 'invalid', url: '/login' }]
    };

    assert.throws(() => validateFlowSpec(spec), /must be one of/);
  });

  it('resolves environment variable references', () => {
    process.env.TEST_EMAIL = 'user@example.com';
    const value = resolveSecrets('Email: $ENV:TEST_EMAIL', {});
    assert.strictEqual(value, 'Email: user@example.com');
  });

  it('throws on missing environment variable', () => {
    delete process.env.NONEXISTENT_VAR;
    assert.throws(() => resolveSecrets('$ENV:NONEXISTENT_VAR', {}), /not found/);
  });

  it('extracts secret values from environment', () => {
    process.env.VERAX_USER_EMAIL = 'test@example.com';
    process.env.VERAX_USER_PASSWORD = 'secret123';

    const secrets = {
      emailEnv: 'VERAX_USER_EMAIL',
      passwordEnv: 'VERAX_USER_PASSWORD'
    };

    const values = extractSecretValues(secrets);
    assert.ok(values.has('test@example.com'));
    assert.ok(values.has('secret123'));
  });
});

describe('Wave 7: Redaction', () => {
  it('redacts secrets from strings', () => {
    const secrets = new Set(['password123', 'user@example.com']);
    const str = 'Login with user@example.com and password123';
    const redacted = redactString(str, secrets);

    assert.strictEqual(redacted, 'Login with ***REDACTED*** and ***REDACTED***');
  });

  it('redacts secrets from objects recursively', () => {
    const secrets = new Set(['secret123']);
    const obj = {
      user: 'admin',
      pass: 'secret123',
      nested: {
        token: 'secret123'
      }
    };

    const redacted = redactObject(obj, secrets);
    assert.strictEqual(redacted.pass, '***REDACTED***');
    assert.strictEqual(redacted.nested.token, '***REDACTED***');
  });

  it('redacts secrets from JSON strings', () => {
    const secrets = new Set(['secret123']);
    const json = JSON.stringify({ password: 'secret123', user: 'admin' });
    const redacted = redactJSON(json, secrets);

    assert.ok(redacted.includes('***REDACTED***'));
    assert.ok(!redacted.includes('secret123'));
  });

  it('handles empty secret set gracefully', () => {
    const str = 'No redaction here';
    const redacted = redactString(str, new Set());
    assert.strictEqual(redacted, str);
  });
});

describe('Wave 7: Flow Engine Execution', () => {
  let browser;
  let server;
  const port = 9876;

  beforeEach(async () => {
    // Start test server
    server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === '/login') {
        const html = readFileSync(resolve(fixturesDir, 'auth-flow-app', 'index.html'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } else if (req.url === '/api/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          const data = JSON.parse(body);
          const password = process.env.VERAX_USER_PASSWORD || 'correct-password';
          if (data.password === password) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ name: 'Test User', success: true }));
          } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
          }
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    await new Promise(resolve => server.listen(port, resolve));
    browser = await chromium.launch({ headless: true });
  });

  afterEach(async () => {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  });

  it('executes successful login flow', async () => {
    process.env.VERAX_USER_EMAIL = 'test@example.com';
    process.env.VERAX_USER_PASSWORD = 'correct-password';

    const spec = JSON.parse(
      readFileSync(resolve(fixturesDir, 'auth-flow-app', 'login-flow.json'), 'utf-8')
    );
    spec.baseUrl = `http://localhost:${port}`;

    const validated = validateFlowSpec(spec);
    const context = await browser.newContext();
    const page = await context.newPage();

    const result = await executeFlow(page, validated, {});

    assert.strictEqual(result.success, true, `Flow failed with findings: ${JSON.stringify(result.findings)}`);
    assert.strictEqual(result.findings.length, 0);
    assert.ok(result.stepResults.length > 0);

    await context.close();
  });

  it('blocks click on denyKeyword element', async () => {
    const spec = {
      name: 'dangerous-flow',
      baseUrl: `http://localhost:${port}`,
      allowlist: { domains: ['localhost'], pathsPrefix: ['/'] },
      denyKeywords: ['delete', 'remove'],
      secrets: {},
      steps: [
        { type: 'click', selector: 'button#delete' } // Button that should be blocked
      ]
    };

    const validated = validateFlowSpec(spec);
    const context = await browser.newContext();
    const page = await context.newPage();

    // Add a test page with delete button - don't navigate, just set content
    await page.setContent(`
      <html><body>
        <button id="delete">Delete Account</button>
      </body></html>
    `);

    const result = await executeFlow(page, validated, {});

    // Should fail due to denyKeyword match on "Delete Account" button text
    assert.strictEqual(result.success, false, `Expected failure but got success. Findings: ${JSON.stringify(result.findings)}`);
    const dangerousStep = result.findings.find(f => f.type === 'blocked_by_safety_gate');
    assert.ok(dangerousStep, `Should block dangerous click. Got findings: ${JSON.stringify(result.findings)}`);

    await context.close();
  });

  it('redacts secrets from step results', async () => {
    process.env.VERAX_USER_EMAIL = 'test@example.com';
    process.env.VERAX_USER_PASSWORD = 'correct-password';

    const spec = JSON.parse(
      readFileSync(resolve(fixturesDir, 'auth-flow-app', 'login-flow.json'), 'utf-8')
    );
    spec.baseUrl = `http://localhost:${port}`;

    const validated = validateFlowSpec(spec);
    const context = await browser.newContext();
    const page = await context.newPage();

    const result = await executeFlow(page, validated, {});

    // Serialize to JSON and check no secrets are present
    const json = JSON.stringify(result);
    assert.ok(!json.includes('test@example.com'));
    assert.ok(!json.includes('correct-password'));

    await context.close();
  });

  it('enforces allowlist on goto step', async () => {
    const spec = {
      name: 'blocked-flow',
      baseUrl: `http://localhost:${port}`,
      allowlist: { domains: ['safe-domain.com'], pathsPrefix: ['/'] },
      denyKeywords: [],
      secrets: {},
      steps: [
        { type: 'goto', url: 'http://evil.com/page' }
      ]
    };

    const validated = validateFlowSpec(spec);
    const context = await browser.newContext();
    const page = await context.newPage();

    const result = await executeFlow(page, validated, {});

    // Should fail due to allowlist violation
    assert.strictEqual(result.success, false);
    const blockingFinding = result.findings.find(f => f.type === 'unexpected_navigation');
    assert.ok(blockingFinding);

    await context.close();
  });
});
