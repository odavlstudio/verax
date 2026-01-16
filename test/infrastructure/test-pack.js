#!/usr/bin/env node

/**
 * Test Pack Script for VERAX CLI
 * 
 * Verifies that:
 * 1) npm pack creates tarball
 * 2) Tarball can be installed
 * 3) verax --version outputs correct version
 * 4) verax --help works
 * 5) verax doctor --json works
 * 6) Cleanup happens successfully
 * 
 * Works on Windows PowerShell and Unix shells
 */

import { execSync, spawn } from 'child_process';
import { rmSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * Run installed verax CLI with timeout enforcement
 * NO npx usage - directly runs node with the installed verax binary
 * 
 * @param {string} installDir - Path to npm install directory
 * @param {string[]} args - CLI arguments (e.g., ['doctor', '--json'])
 * @param {object} options - { timeoutMs, env }
 */
async function runInstalledVerax(installDir, args, options = {}) {
  const { timeoutMs = 10000, env = { ...process.env } } = options;
  
  // Resolve the installed verax binary path
  // On Windows, use direct node execution to avoid .cmd spawn issues (EINVAL)
  // On Unix, can use the shell script wrapper
  const veraxJs = join(installDir, 'node_modules', '@veraxhq', 'verax', 'bin', 'verax.js');
  const veraxBinUnix = join(installDir, 'node_modules', '.bin', 'verax');
  
  let command;
  let finalArgs;
  
  if (existsSync(veraxJs)) {
    // Use node directly with the JS file (works everywhere)
    command = process.execPath; // node executable
    finalArgs = [veraxJs, ...args];
  } else if (process.platform !== 'win32' && existsSync(veraxBinUnix)) {
    // Use Unix wrapper if available (not on Windows)
    command = veraxBinUnix;
    finalArgs = args;
  } else {
    // Debug: list what actually exists
    const nodeModulesPath = join(installDir, 'node_modules');
    let debugInfo = `Could not find verax binary in ${installDir}.`;
    debugInfo += `\nChecked: ${veraxJs} and Unix bin wrapper`;
    
    if (existsSync(nodeModulesPath)) {
      const binPath = join(nodeModulesPath, '.bin');
      if (existsSync(binPath)) {
        const { readdirSync } = await import('fs');
        const binFiles = readdirSync(binPath);
        debugInfo += `\n.bin directory exists with files: ${binFiles.slice(0, 10).join(', ')}`;
      } else {
        debugInfo += `\n.bin directory does NOT exist at ${binPath}`;
      }
      
      const veraxPkgPath = join(nodeModulesPath, '@veraxhq');
      if (existsSync(veraxPkgPath)) {
        debugInfo += `\n@veraxhq directory exists`;
      } else {
        debugInfo += `\n@veraxhq directory does NOT exist at ${veraxPkgPath}`;
      }
    } else {
      debugInfo += `\nnode_modules directory does NOT exist at ${nodeModulesPath}`;
    }
    
    throw new Error(debugInfo);
  }
  
  return new Promise((resolve, reject) => {
    const child = spawn(command, finalArgs, {
      cwd: installDir,
      env,
      shell: false, // NO shell - direct execution
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;
    
    // Capture output
    child.stdout?.on('data', (data) => { stdout += data; });
    child.stderr?.on('data', (data) => { stderr += data; });
    
    // Timeout enforcement
    const timer = setTimeout(() => {
      if (!killed) {
        timedOut = true;
        child.kill('SIGTERM');
        
        // Force kill after 1 second
        setTimeout(() => {
          if (!killed) {
            child.kill('SIGKILL');
          }
        }, 1000);
      }
    }, timeoutMs);
    
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      killed = true;
      
      if (timedOut) {
        const debugInfo = [
          `Command timed out after ${timeoutMs}ms`,
          `Command: ${command} ${finalArgs.join(' ')}`,
          `Last 200 chars of stdout: ${stdout.slice(-200)}`,
          `Last 200 chars of stderr: ${stderr.slice(-200)}`,
        ].join('\n');
        reject(new Error(debugInfo));
      } else if (code !== 0) {
        const debugInfo = [
          `Command exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`,
          `Command: ${command} ${finalArgs.join(' ')}`,
          `Stdout: ${stdout.slice(-500)}`,
          `Stderr: ${stderr.slice(-500)}`,
        ].join('\n');
        reject(new Error(debugInfo));
      } else {
        resolve({ stdout, stderr, code });
      }
    });
    
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn ${command}: ${err.message}`));
    });
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const expectedVersion = '0.2.0';
const tempDir = join(projectRoot, '.tmp-pack-test');

console.log(`Testing VERAX CLI v${expectedVersion} packaging...`);
console.log(`Project root: ${projectRoot}`);
console.log(`Temp directory: ${tempDir}\n`);

(async () => {
try {
  // Step 1: npm pack
  console.log('Step 1: Creating tarball with npm pack...');
  /** @type {any} */
  const packOpts = { cwd: projectRoot, encoding: 'utf8', shell: true };
  const packOutput = String(execSync('npm pack --silent', packOpts)).trim();
  const tarballName = packOutput.split('\n').pop().trim();
  const tarballPath = resolve(projectRoot, tarballName);
  console.log(`✓ Created: ${tarballName}\n`);

  // Verify tarball exists and has correct version
  if (!tarballName.includes('0.2.0')) {
    throw new Error(`Tarball name missing 0.2.0: ${tarballName}`);
  }

  // Step 2: Create temp installation directory
  console.log('Step 2: Setting up temp installation...');
  mkdirSync(tempDir, { recursive: true });
  const installDir = join(tempDir, 'install');
  mkdirSync(installDir, { recursive: true });
  
  // Debug: Check what's in installDir before npm install
  const { readdirSync } = await import('fs');
  const beforeFiles = readdirSync(installDir);
  console.log(`Before npm install, installDir contains: ${beforeFiles.length} files: ${beforeFiles.join(', ') || '(empty)'}`);
  
  console.log(`✓ Created: ${installDir}\n`);

  // Step 3: Install from tarball
  console.log('Step 3: Installing from tarball...');
  /** @type {any} */
  const installOptions = {
    cwd: projectRoot, // Run from project root
    encoding: 'utf8',
    shell: true,
  };
  try {
    // Use --prefix to force installation in installDir and avoid parent package.json
    const installOutput = execSync(`npm install --save-dev --prefix "${installDir}" "${tarballPath}"`, installOptions);
    console.log(`npm install output: ${String(installOutput).slice(0, 500)}`);
  } catch (installError) {
    throw new Error(`npm install failed: ${installError.message}\nStderr: ${installError.stderr?.toString()}`);
  }
  
  // Verify installation created node_modules
  const nodeModulesPath = join(installDir, 'node_modules');
  if (!existsSync(nodeModulesPath)) {
    throw new Error(`npm install completed but node_modules was not created at ${nodeModulesPath}`);
  }
  console.log(`✓ Installation complete\n`);

  // Step 4: Test verax --version
  console.log('Step 4: Testing verax --version...');
  const versionResult = await runInstalledVerax(installDir, ['--version'], {
    timeoutMs: 5000,
  });
  const versionOutput = versionResult.stdout.trim();

  if (!versionOutput.includes(expectedVersion)) {
    throw new Error(
      `Version mismatch! Expected '${expectedVersion}' in output, got: ${versionOutput}`
    );
  }
  console.log(`✓ Version correct: ${versionOutput}\n`);

  // Step 5: Test verax --help
  console.log('Step 5: Testing verax --help...');
  const helpResult = await runInstalledVerax(installDir, ['--help'], {
    timeoutMs: 5000,
  });
  const helpOutput = helpResult.stdout.trim();

  if (
    !helpOutput.includes('verax run') ||
    !helpOutput.includes('verax doctor') ||
    !helpOutput.includes('verax inspect')
  ) {
    throw new Error(
      `Help output missing expected commands:\n${helpOutput}`
    );
  }
  console.log(`✓ Help output correct (contains: run, doctor, inspect)\n`);

  // Step 6: Test verax doctor --json
  console.log('Step 6: Testing verax doctor --json...');
  const doctorResult = await runInstalledVerax(installDir, ['doctor', '--json'], {
    timeoutMs: 15000, // Longer timeout for browser launch
    env: {
      ...process.env,
      VERAX_DOCTOR_SMOKE_TIMEOUT_MS: '3000', // Fast smoke test for CI
    },
  });
  const doctorOutput = doctorResult.stdout.trim();

  try {
    const doctorJson = JSON.parse(doctorOutput);
    if (!Array.isArray(doctorJson.checks)) {
      throw new Error('doctor output missing checks array');
    }
    console.log(
      `✓ Doctor output valid JSON with ${doctorJson.checks.length} checks\n`
    );
  } catch (e) {
    throw new Error(
      `Doctor JSON parse error: ${e.message}\nOutput: ${doctorOutput}`
    );
  }

  // Step 7: Cleanup
  console.log('Step 7: Cleanup...');
  rmSync(tempDir, { recursive: true, force: true });
  rmSync(tarballPath, { force: true });
  console.log(`✓ Cleaned up temp directory\n`);

  // Success
  console.log('✅ All tests passed!');
  console.log(`VERAX v${expectedVersion} is ready for release.\n`);

  // Force deterministic exit after all cleanup to avoid lingering handles on Windows
  process.exit(0);
} catch (error) {
  console.error(`❌ Test failed: ${error.message}\n`);
  
  // Cleanup on failure
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
  
  // Force deterministic exit with error code
  process.exit(1);
}
})().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
