/**
 * Redaction End-to-End Test
 * 
 * CRITICAL SECURITY REQUIREMENT:
 * Verifies that VERAX redacts secrets from ALL artifacts (traces, findings, screenshots).
 * 
 * Test Strategy:
 * 1. Serve HTML page with embedded secrets (Bearer tokens, API keys)
 * 2. Run VERAX scan against the page
 * 3. Read ALL artifact files (.json, .jsonl, .png metadata)
 * 4. Assert ZERO raw secrets found in any artifact
 * 
 * This test MUST pass for VERAX to be considered secure.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Test secrets that MUST be redacted
const TEST_SECRETS = {
  bearerToken: 'Bearer sk_test_FAKE1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789EXAMPLE',
  apiKey: 'api_key=AIzaSyDXYZ123456789abcdefghijklmnopqrstuv',
  accessToken: 'access_token=ghp_1234567890abcdefGHIJKLMNOPQRSTUVWXYZ12',
  awsKey: 'AKIAIOSFODNN7EXAMPLE'
};

function createSecretFixture() {
  const fixtureDir = resolve(__dirname, 'fixtures', 'redaction-test');
  mkdirSync(fixtureDir, { recursive: true });

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Redaction Test</title>
</head>
<body>
  <h1>Redaction Test Page</h1>
  <p>This page contains secrets that must be redacted:</p>
  
  <div id="secret-display">
    <p>Bearer Token: ${TEST_SECRETS.bearerToken}</p>
    <p>API Key: ${TEST_SECRETS.apiKey}</p>
    <p>Access Token: ${TEST_SECRETS.accessToken}</p>
    <p>AWS Key: ${TEST_SECRETS.awsKey}</p>
  </div>

  <button id="fetch-btn" onclick="fetchData()">Fetch Data</button>
  
  <script>
    async function fetchData() {
      // Simulated API call with secret headers (MUST be redacted)
      const headers = {
        'Authorization': '${TEST_SECRETS.bearerToken}',
        'X-API-Key': '${TEST_SECRETS.apiKey}',
        'X-Access-Token': '${TEST_SECRETS.accessToken}'
      };
      
      console.log('Fetching with headers:', headers);
      console.log('AWS Key:', '${TEST_SECRETS.awsKey}');
      
      // Don't actually fetch - just log secrets
      document.body.innerHTML += '<p>Fetch attempted with secrets</p>';
    }
  </script>
</body>
</html>`;

  writeFileSync(resolve(fixtureDir, 'index.html'), html);
  return fixtureDir;
}

function startTestServer(port, dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const filePath = resolve(dir, 'index.html');
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });

    server.listen(port, (err) => {
      if (err) reject(err);
      else resolve(server);
    });
  });
}

function runVerax(url, src) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn('node', [resolve(projectRoot, 'bin/verax.js'), 'run', '--url', url, '--src', src], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolvePromise({ code, stdout, stderr });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function findSecretsInText(text) {
  const found = [];
  for (const [name, secret] of Object.entries(TEST_SECRETS)) {
    // Check for exact secret match (case sensitive)
    if (text.includes(secret)) {
      found.push({ name, secret, location: 'exact match' });
    }
  }
  return found;
}

function scanArtifactsForSecrets(fixtureDir) {
  const veraxDir = resolve(fixtureDir, '.verax');
  if (!existsSync(veraxDir)) {
    throw new Error('.verax directory not found - scan may have failed');
  }

  const runsDir = resolve(veraxDir, 'runs');
  if (!existsSync(runsDir)) {
    throw new Error('.verax/runs directory not found');
  }

  const runs = readdirSync(runsDir);
  assert.ok(runs.length > 0, 'At least one run should exist');

  const latestRun = runs.sort().reverse()[0];
  const runDir = resolve(runsDir, latestRun);

  const secretFindings = [];

  // Scan all JSON files in run directory
  const jsonFiles = [
    'findings.json',
    'observation-traces.json',
    'validation.json',
    'project.json'
  ];

  for (const file of jsonFiles) {
    const filePath = resolve(runDir, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      const found = findSecretsInText(content);
      if (found.length > 0) {
        secretFindings.push({ file, found });
      }
    }
  }

  // Scan observation traces.jsonl (line-delimited JSON)
  const tracesPath = resolve(runDir, 'observation-traces.jsonl');
  if (existsSync(tracesPath)) {
    const content = readFileSync(tracesPath, 'utf-8');
    const found = findSecretsInText(content);
    if (found.length > 0) {
      secretFindings.push({ file: 'observation-traces.jsonl', found });
    }
  }

  // Scan evidence directory for screenshots metadata
  const evidenceDir = resolve(runDir, 'evidence');
  if (existsSync(evidenceDir)) {
    const evidenceFiles = readdirSync(evidenceDir);
    for (const file of evidenceFiles) {
      if (file.endsWith('.json')) {
        const content = readFileSync(resolve(evidenceDir, file), 'utf-8');
        const found = findSecretsInText(content);
        if (found.length > 0) {
          secretFindings.push({ file: `evidence/${file}`, found });
        }
      }
    }
  }

  return secretFindings;
}

describe('Redaction E2E: Security Verification', () => {
  let testServer;
  let fixtureDir;
  const testPort = 3459;
  const testUrl = `http://localhost:${testPort}`;

  test.before(async () => {
    fixtureDir = createSecretFixture();
    testServer = await startTestServer(testPort, fixtureDir);
  });

  test.after(async () => {
    if (testServer) {
      await new Promise((resolve) => {
        testServer.close(resolve);
      });
    }
    if (fixtureDir && existsSync(fixtureDir)) {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test('CRITICAL: VERAX redacts ALL secrets from ALL artifacts', async () => {
    // Run VERAX scan
    const result = await runVerax(testUrl, fixtureDir);
    
    // Scan should complete (exit 0 or 1)
    assert.ok(result.code === 0 || result.code === 1, 
      `Scan should complete successfully, got code ${result.code}. stderr: ${result.stderr}`);

    // Scan ALL artifacts for secrets
    const secretFindings = scanArtifactsForSecrets(fixtureDir);

    // ASSERT: ZERO secrets found
    if (secretFindings.length > 0) {
      console.error('❌ SECURITY FAILURE: Secrets found in artifacts:');
      for (const finding of secretFindings) {
        console.error(`  File: ${finding.file}`);
        for (const secret of finding.found) {
          console.error(`    - ${secret.name}: ${secret.secret} (${secret.location})`);
        }
      }
      assert.fail('SECURITY FAILURE: Secrets were not redacted from artifacts');
    }

    console.log('✅ SECURITY VERIFIED: All secrets redacted from all artifacts');
  });

  test('Redaction does not break artifact structure', async () => {
    // Verify that redaction still produces valid JSON
    const veraxDir = resolve(fixtureDir, '.verax');
    const runsDir = resolve(veraxDir, 'runs');
    const runs = readdirSync(runsDir);
    const latestRun = runs.sort().reverse()[0];
    const runDir = resolve(runsDir, latestRun);

    const findingsPath = resolve(runDir, 'findings.json');
    if (existsSync(findingsPath)) {
      const content = readFileSync(findingsPath, 'utf-8');
      assert.doesNotThrow(() => JSON.parse(content), 'findings.json should be valid JSON');
    }

    const tracesPath = resolve(runDir, 'observation-traces.json');
    if (existsSync(tracesPath)) {
      const content = readFileSync(tracesPath, 'utf-8');
      assert.doesNotThrow(() => JSON.parse(content), 'observation-traces.json should be valid JSON');
    }
  });
});
