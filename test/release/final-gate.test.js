/**
 * Final Gate Test - Installability & CLI Surface
 * 
 * This test ensures VERAX is actually installable and the CLI is executable.
 * It validates the CLI surface only (--version, --help, pilot-scope routing).
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
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


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
    const packDest = join(tmpdir(), `verax-pack-dest-${getTimeProvider().now()}`);
    mkdirSync(packDest, { recursive: true });

    const packResult = await runCommand('npm', ['pack', '--pack-destination', packDest], projectRoot, 30000);
    assert.strictEqual(packResult.code, 0, `npm pack should succeed: ${packResult.stderr}`);
    
    assert.ok(packResult.stdout.includes('.tgz'), 'npm pack stdout should confirm tarball generation');
    
    // Root hygiene guarantee: no tarball should be written to project root
    const tarballs = readdirSync(projectRoot).filter(f => f.endsWith('.tgz'));
    assert.strictEqual(tarballs.length, 0, 'npm pack must not write tarball to repo root');

    const packed = readdirSync(packDest).filter(f => f.endsWith('.tgz'));
    assert.ok(packed.length > 0, 'tarball should exist in pack destination');

    try {
      rmSync(packDest, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('tarball extracts and package structure is valid', async () => {
    tempDir = join(tmpdir(), `verax-final-gate-${getTimeProvider().now()}`);
    mkdirSync(tempDir, { recursive: true });
    const packDest = join(tempDir, 'pack');
    mkdirSync(packDest, { recursive: true });

    // Generate tarball into a temp destination (never repo root).
    const packResult = await runCommand('npm', ['pack', '--pack-destination', packDest], projectRoot, 30000);
    assert.strictEqual(packResult.code, 0, `npm pack should succeed: ${packResult.stderr}`);

    // Find the tarball
    const tarballs = readdirSync(packDest).filter(f => f.endsWith('.tgz'));
    assert.ok(tarballs.length > 0, 'tarball should exist in pack destination');
    const tarballName = tarballs[0];
    const tarballPath = join(packDest, tarballName);

    // Extract tarball to tempDir using system tar (bsdtar on Windows)
    const extract = await runCommand('tar', ['-xf', tarballPath, '-C', tempDir], projectRoot, 30000);
    assert.strictEqual(extract.code, 0, `tar extract should succeed. stderr: ${extract.stderr}`);

    const extractedRoot = join(tempDir, 'package');
    assert.ok(existsSync(extractedRoot), 'extracted package directory should exist');

    // Validate structure
    assert.ok(existsSync(join(extractedRoot, 'package.json')), 'package.json should exist');
    const extractedPkg = JSON.parse(readFileSync(join(extractedRoot, 'package.json'), 'utf8'));
    assert.ok(extractedPkg.bin && extractedPkg.bin.verax, 'bin.verax should be defined in package.json');
    assert.ok(existsSync(join(extractedRoot, 'bin', 'verax.js')), 'bin/verax.js should exist');

    // Cleanup: remove test tarball
    rmSync(tarballPath, { force: true });
  });

  test('installed CLI has correct surface', async () => {
    assert.ok(tempDir, 'tempDir should be set from previous test');

    // Execute CLI directly from extracted package to avoid npm install
    const extractedRoot = join(tempDir, 'package');
    const cliPath = join(extractedRoot, 'bin', 'verax.js');
    assert.ok(existsSync(cliPath), 'CLI entry point should exist');

    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

    // Test --version
    const versionResult = await runCommand('node', [cliPath, '--version'], extractedRoot, 10000);
    assert.strictEqual(versionResult.code, 0, `verax --version should succeed: ${versionResult.stderr}`);
    assert.ok(versionResult.stdout.includes(pkg.version), `version should be ${pkg.version}, got: ${versionResult.stdout}`);

    // Test --help
    const helpResult = await runCommand('node', [cliPath, '--help'], extractedRoot, 10000);
    assert.strictEqual(helpResult.code, 0, `verax --help should succeed: ${helpResult.stderr}`);
    assert.ok(helpResult.stdout.includes('verax run'), 'help should mention "run" command');
    assert.ok(helpResult.stdout.includes('verax bundle'), 'help should mention "bundle" command');
    assert.ok(helpResult.stdout.includes('verax version'), 'help should mention "version" command');
    assert.ok(helpResult.stdout.includes('verax help'), 'help should mention "help" command');
    assert.strictEqual(helpResult.stdout.includes('verax doctor'), false, 'help must NOT mention "doctor" command');
    assert.strictEqual(helpResult.stdout.includes('verax inspect'), false, 'help must NOT mention "inspect" command');

    // Test bundle command is reachable (usage error without args)
    const bundleResult = await runCommand('node', [cliPath, 'bundle'], extractedRoot, 10000);
    assert.strictEqual(bundleResult.code, 64, `verax bundle (no args) should exit 64: ${bundleResult.stderr}`);

    // Test out-of-scope command rejection
    const doctorResult = await runCommand('node', [cliPath, 'doctor', '--json'], extractedRoot, 10000);
    assert.strictEqual(doctorResult.code, 64, `verax doctor should be out of scope: ${doctorResult.stderr}`);
    assert.strictEqual(doctorResult.stdout.trim(), '', 'out-of-scope command must not emit stdout');
    assert.strictEqual(
      doctorResult.stderr.trim(),
      "Command 'doctor' is out of scope for VERAX 0.4.9 pilot surface. Supported: run, bundle, readiness, capability-bundle, version, help.",
      'out-of-scope command must emit pilot-scope message to stderr'
    );
  });
});


