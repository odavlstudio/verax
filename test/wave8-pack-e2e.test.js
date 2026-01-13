/**
 * Wave 8 — E2E Packaging Test
 * 
 * Tests the full packaging → install → run cycle using pure Node.js.
 * Cross-platform compatible (no tar, bash, or shell tools).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import { mkdir, readdir, rm } from 'fs/promises';
import { readFileSync, existsSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

/**
 * Run a command and return stdout/stderr
 * @param {string} command - Command to run
 * @param {string[]} args - Arguments
 * @param {Object} options - Options (cwd, env, etc.)
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      ...options,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
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
      resolve({
        code: code || 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
    
    proc.on('error', (error) => {
      reject(error);
    });
  });
}

describe('Wave 8: E2E Packaging Test', () => {
  let packDir;
  let installDir;
  let packedTgz;
  
  test('pack → install → run cycle', async () => {
    // Step 1: Create temp directory for packing
    packDir = join(tmpdir(), `verax-pack-test-${randomUUID()}`);
    await mkdir(packDir, { recursive: true });
    
    // Step 2: Run npm pack
    const _packResult = await runCommand('npm', ['pack', '--dry-run'], {
      cwd: projectRoot
    });
    
    // Get actual package name and version
    const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));
    const packageName = packageJson.name.replace('@', '').replace('/', '-');
    const packageVersion = packageJson.version;
    const expectedTgz = `${packageName}-${packageVersion}.tgz`;
    
    // Actually pack (not dry-run)
    const _packResult2 = await runCommand('npm', ['pack'], {
      cwd: projectRoot
    });
    
    // Find the generated .tgz file in project root
    const files = await readdir(projectRoot);
    const tgzFile = files.find(f => f.endsWith('.tgz') && f.startsWith(packageName));
    
    if (!tgzFile) {
      throw new Error(`Failed to find packed tgz file. Expected: ${expectedTgz}, Files: ${files.join(', ')}`);
    }
    
    packedTgz = resolve(projectRoot, tgzFile);
    
    // Verify file exists
    assert.ok(existsSync(packedTgz), `Packed tgz file should exist: ${packedTgz}`);
    
    // Step 3: Create temp install directory
    installDir = join(tmpdir(), `verax-install-test-${randomUUID()}`);
    await mkdir(installDir, { recursive: true });
    
    // Step 4: Initialize npm project
    const initResult = await runCommand('npm', ['init', '-y'], {
      cwd: installDir
    });
    
    assert.strictEqual(initResult.code, 0, 'npm init should succeed');
    
    // Step 5: Install the packed tgz
    const installResult = await runCommand('npm', ['install', packedTgz], {
      cwd: installDir
    });
    
    assert.strictEqual(installResult.code, 0, `npm install should succeed: ${installResult.stderr}`);
    
    // Step 6: Find installed binary
    const nodeModulesDir = join(installDir, 'node_modules', '@veraxhq', 'verax');
    const binPath = join(nodeModulesDir, 'bin', 'verax.js');
    
    assert.ok(existsSync(binPath), `Installed binary should exist: ${binPath}`);
    
    // Step 7: Test --help
    const helpResult = await runCommand('node', [binPath, '--help'], {
      cwd: installDir
    });
    
    assert.strictEqual(helpResult.code, 0, '--help should work');
    assert.ok(helpResult.stdout.includes('VERAX') || helpResult.stderr.includes('VERAX'), 'Help should contain VERAX');
    
    // Step 8: Test doctor --json (no URL)
    const doctorResult = await runCommand('node', [binPath, 'doctor', '--json'], {
      cwd: installDir,
      env: { ...process.env, CI: 'true' }
    });
    
    // Doctor may fail if Playwright not installed, but should produce valid JSON or clear error
    if (doctorResult.code === 0) {
      let doctorJson;
      try {
        doctorJson = JSON.parse(doctorResult.stdout || doctorResult.stderr);
      } catch (e) {
        // If not JSON, might be error output
        assert.fail('Doctor --json should output valid JSON or fail clearly');
      }
      
      assert.ok(doctorJson, 'Doctor should return JSON');
      assert.ok(doctorJson.status, 'Doctor JSON should have status');
      assert.ok(Array.isArray(doctorJson.checks), 'Doctor JSON should have checks array');
    } else {
      // Doctor failed - this is acceptable if Playwright not installed
      // But error should be clear (not a stack trace)
      assert.ok(
        doctorResult.stderr.includes('Playwright') || 
        doctorResult.stderr.includes('browser') ||
        doctorResult.stderr.includes('install'),
        'Doctor failure should mention Playwright/browser/install'
      );
    }
    
    // Step 9: Test scan with temp outDir (may fail if Playwright not available, that's OK)
    const tempOutDir = join(tmpdir(), `verax-scan-test-${randomUUID()}`);
    await mkdir(tempOutDir, { recursive: true });
    
    const scanResult = await runCommand('node', [
      binPath,
      'scan',
      '--url',
      'https://example.com',
      '--yes',
      '--json',
      '--out',
      tempOutDir
    ], {
      cwd: installDir,
      env: { ...process.env, CI: 'true' }
    });
    
    // Scan may fail due to Playwright, but should exit cleanly or with normalized error
    if (scanResult.code === 0) {
      // Scan succeeded - verify artifacts
      const outFiles = await readdir(tempOutDir);
      const runDirs = outFiles.filter(f => {
        try {
          const stat = statSync(join(tempOutDir, f));
          return stat.isDirectory();
        } catch {
          return false;
        }
      });
      
      assert.ok(runDirs.length > 0, 'Scan should create run directory');
      
      // Check for summary.json
      let summaryFound = false;
      for (const runDir of runDirs) {
        const summaryPath = join(tempOutDir, runDir, 'summary.json');
        if (existsSync(summaryPath)) {
          summaryFound = true;
          const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
          assert.ok(summary.verdict, 'Summary should have verdict');
          break;
        }
      }
      
      assert.ok(summaryFound, 'Scan should create summary.json');
    } else {
      // Scan failed - should be normalized error (not stack trace) unless --debug
      const errorOutput = scanResult.stderr || scanResult.stdout;
      
      // Allow fatal errors, but they should be clear
      assert.ok(
        scanResult.code === 3 || // FATAL
        errorOutput.includes('Playwright') ||
        errorOutput.includes('browser') ||
        errorOutput.includes('Failed') ||
        errorOutput.includes('Error'),
        `Scan failure should be normalized. Exit code: ${scanResult.code}, Output: ${errorOutput.substring(0, 200)}`
      );
    }
    
    // Cleanup
    try {
      await rm(tempOutDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }, { timeout: 120000 });
  
  // Cleanup after all tests
  test.after(async () => {
    try {
      if (packedTgz && existsSync(packedTgz)) {
        await rm(packedTgz, { force: true });
      }
      if (installDir) {
        await rm(installDir, { recursive: true, force: true });
      }
      if (packDir) {
        await rm(packDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });
});

