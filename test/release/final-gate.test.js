/**
 * Final Gate Test - Installability & CLI Surface
 * 
 * This test ensures VERAX is actually installable and the CLI is executable.
 * It validates the CLI surface only (--version, --help, doctor --json).
 * Full integration tests with Playwright belong in verify-release.js.
 * 
 * Note: These tests are legitimately slow (~15s) due to npm pack/install.
 * Test runner provides 120s timeout budget for this suite.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..', '..');

function runCommand(command, args, cwd, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    // Resolve npm path safely
    let resolvedCommand = command;
    if (command === 'npm') {
      resolvedCommand = process.env.npm_command || 'npm';
    } else if (command === 'test') {
      // 'test' should be 'npm', not a spawn command
      resolvedCommand = process.env.npm_command || 'npm';
    }
    const proc = spawn(resolvedCommand, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    // Close stdin immediately to prevent hanging
    proc.stdin.end();

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
      reject(new Error(`Command timeout after ${timeoutMs}ms: ${command} ${args.join(' ')}`));
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (!timedOut) {
        resolve({ code: code ?? 0, stdout, stderr });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('Final Gate: VERAX Installability & CLI', () => {
  let tempDir = null;

  // Cleanup after all tests
  test.after('cleanup temp directory', () => {
    if (tempDir && existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  test('npm pack creates valid tarball', async () => {
    const packResult = await runCommand('npm', ['pack'], projectRoot, 30000);
    assert.strictEqual(packResult.code, 0, `npm pack should succeed: ${packResult.stderr}`);
    
    const tarballs = readdirSync(projectRoot).filter(f => f.endsWith('.tgz'));
    assert.ok(tarballs.length > 0, 'npm pack should create a .tgz file');
  });

  test('tarball installs in isolated directory', async () => {
    tempDir = join(tmpdir(), `verax-final-gate-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    // Find the tarball
    const tarballs = readdirSync(projectRoot).filter(f => f.endsWith('.tgz'));
    assert.ok(tarballs.length > 0, 'tarball should exist');
    const tarballName = tarballs[0];
    const tarballPath = join(projectRoot, tarballName);

    // Install from tarball
    const installResult = await runCommand('npm', ['install', '--production', tarballPath], tempDir, 120000);
    assert.strictEqual(installResult.code, 0, `npm install should succeed. stderr: ${installResult.stderr}`);

    // Verify package directory exists
    const packageDir = join(tempDir, 'node_modules', '@veraxhq', 'verax');
    assert.ok(existsSync(packageDir), 'package should be installed');
  });

  test('installed CLI has correct surface', async () => {
    assert.ok(tempDir, 'tempDir should be set from previous test');

    const cliPath = join(tempDir, 'node_modules', '@veraxhq', 'verax', 'bin', 'verax.js');
    assert.ok(existsSync(cliPath), 'CLI entry point should exist');

    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

    // Test --version
    const versionResult = await runCommand('node', [cliPath, '--version'], tempDir, 10000);
    assert.strictEqual(versionResult.code, 0, `verax --version should succeed: ${versionResult.stderr}`);
    assert.ok(versionResult.stdout.includes(pkg.version), `version should be ${pkg.version}, got: ${versionResult.stdout}`);

    // Test --help
    const helpResult = await runCommand('node', [cliPath, '--help'], tempDir, 10000);
    assert.strictEqual(helpResult.code, 0, `verax --help should succeed: ${helpResult.stderr}`);
    assert.ok(helpResult.stdout.includes('run'), 'help should mention "run" command');
    assert.ok(helpResult.stdout.includes('doctor'), 'help should mention "doctor" command');
    assert.ok(helpResult.stdout.includes('inspect'), 'help should mention "inspect" command');

    // Test doctor --json
    const doctorResult = await runCommand('node', [cliPath, 'doctor', '--json'], tempDir, 30000);
    assert.strictEqual(doctorResult.code, 0, `verax doctor --json should succeed: ${doctorResult.stderr}`);
    
    try {
      const doctorJson = JSON.parse(doctorResult.stdout);
      assert.ok(typeof doctorJson === 'object', 'doctor --json should output JSON object');
      assert.ok('ok' in doctorJson, 'doctor output should have "ok" field');
      assert.ok(Array.isArray(doctorJson.checks), 'doctor output should have "checks" array');
      assert.ok(doctorJson.checks.length > 0, 'doctor should report checks');
      assert.ok(doctorJson.checks[0].name, 'doctor checks should have "name" field');
      assert.ok(typeof doctorJson.checks[0].status === 'string', 'doctor checks should have "status" field');
    } catch (e) {
      assert.fail(`doctor --json should output valid JSON: ${doctorResult.stdout}`);
    }
  });
});

