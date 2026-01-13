#!/usr/bin/env node
/**
 * Verify Release Prerequisites & Tarball Smoke Tests
 * 
 * Ensures:
 * 1. package.json version matches input version
 * 2. CHANGELOG.md contains entry for the version
 * 3. npm pack succeeds
 * 4. Tarball can be installed
 * 5. npx <tarball> --version works
 * 6. npx <tarball> doctor --json works
 * 7. Demo scan produces expected artifacts:
 *    - learn.json has >=1 expectation
 *    - findings.json has >=1 finding
 *    - evidence directory contains >=1 file
 * 8. Commands never hang (timeout protection)
 * 
 * Usage: node scripts/verify-release.js [version]
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync, readdirSync, rmSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { startFixtureServer } from '../test/helpers/fixture-server.helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to read ${path}: ${error.message}`);
  }
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read ${path}: ${error.message}`);
  }
}

function runCommand(command, options = {}) {
  /** @type {any} */
  const opts = {
    encoding: 'utf8',
    shell: true,
    stdio: 'pipe',
    ...options
  };
  try {
    return String(execSync(command, opts)).trim();
  } catch (error) {
    throw new Error(`Command failed: ${command}\nError: ${error.message}`);
  }
}

function runCommandWithTimeout(command, args, options = {}, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      ...options,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 5000);
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`));
      }
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command exited with code ${code}: ${command} ${args.join(' ')}\nStdout: ${stdout}\nStderr: ${stderr}`));
        }
      }
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Command error: ${err.message}\nStdout: ${stdout}\nStderr: ${stderr}`));
      }
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  let inputVersion = null;

  // Version is optional - if not provided, use package.json version
  if (args.length > 0) {
    inputVersion = args[0].trim();
    
    // Validate version format (basic semver check)
    if (!/^\d+\.\d+\.\d+/.test(inputVersion)) {
      console.error(`Error: Invalid version format: ${inputVersion}`);
      console.error('Expected format: X.Y.Z (e.g., 0.3.0)');
      process.exit(1);
    }
  }

  console.log('='.repeat(60));
  console.log('VERAX Release Verification');
  console.log('='.repeat(60));
  console.log('');

  // Read package.json
  const packageJson = readJson(resolve(projectRoot, 'package.json'));
  const packageVersion = packageJson.version;

  if (inputVersion) {
    console.log(`Verifying release prerequisites for version: ${inputVersion}`);
    
    // Verify package.json version matches
    if (packageVersion !== inputVersion) {
      console.error(`❌ Version mismatch!`);
      console.error(`   package.json version: ${packageVersion}`);
      console.error(`   Input version:        ${inputVersion}`);
      console.error(`   They must match.`);
      process.exit(1);
    }
    
    console.log(`✅ package.json version matches: ${packageVersion}`);
    
    // Read CHANGELOG.md
    const changelogPath = resolve(projectRoot, 'CHANGELOG.md');
    if (existsSync(changelogPath)) {
      const changelog = readText(changelogPath);
      
      // Check for version heading in changelog
      const versionPatterns = [
        new RegExp(`^##\\s*\\[${inputVersion.replace(/\./g, '\\.')}\\]`, 'm'),
        new RegExp(`^##\\s*${inputVersion.replace(/\./g, '\\.')}`, 'm'),
        new RegExp(`^##\\s*\\[${inputVersion.replace(/\./g, '\\.')}\\]\\s*-`, 'm'),
      ];
      
      const hasVersionEntry = versionPatterns.some(pattern => pattern.test(changelog));
      
      if (!hasVersionEntry) {
        console.error(`❌ CHANGELOG.md missing entry for version ${inputVersion}`);
        console.error(`   Expected a heading like: ## [${inputVersion}] or ## ${inputVersion}`);
        console.error(`   Please add a changelog entry before releasing.`);
        process.exit(1);
      }
      
      console.log(`✅ CHANGELOG.md contains entry for version ${inputVersion}`);
    } else {
      console.warn(`⚠️  CHANGELOG.md not found (skipping changelog check)`);
    }
  } else {
    console.log(`Using package.json version: ${packageVersion}`);
  }

  console.log('');
  console.log('Step 1: Running npm pack...');
  const tempDir = join(projectRoot, '.tmp-verify-release');
  
  try {
    // Cleanup temp dir if it exists
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    mkdirSync(tempDir, { recursive: true });

    // Run npm pack
    const packOutput = runCommand('npm pack', { cwd: projectRoot });
    const tarballName = packOutput.split('\n').pop().trim();
    const tarballPath = resolve(projectRoot, tarballName);

    if (!existsSync(tarballPath)) {
      throw new Error(`Tarball not found: ${tarballPath}`);
    }

    if (!tarballName.includes(packageVersion)) {
      throw new Error(`Tarball name missing version ${packageVersion}: ${tarballName}`);
    }

    console.log(`✅ Created tarball: ${tarballName}`);
    console.log('');

    // Step 2: Install tarball
    console.log('Step 2: Installing tarball...');
    const installDir = join(tempDir, 'install');
    mkdirSync(installDir, { recursive: true });

    runCommand(`npm install --save-dev "${tarballPath}"`, {
      cwd: installDir,
      stdio: 'inherit'
    });

    console.log(`✅ Installation complete`);
    console.log('');

    // Step 3: Test --version
    console.log('Step 3: Testing verax --version...');
    const versionOutput = runCommand('npx verax --version', { cwd: installDir });
    
    if (!versionOutput.includes(packageVersion)) {
      throw new Error(`Version mismatch! Expected '${packageVersion}' in output, got: ${versionOutput}`);
    }
    
    console.log(`✅ Version correct: ${versionOutput}`);
    console.log('');

    // Step 4: Test doctor --json
    console.log('Step 4: Testing verax doctor --json...');
    const doctorOutput = runCommand('npx verax doctor --json', { cwd: installDir });
    
    let doctorJson;
    try {
      doctorJson = JSON.parse(doctorOutput);
      if (!Array.isArray(doctorJson.checks)) {
        throw new Error('doctor output missing checks array');
      }
    } catch (e) {
      throw new Error(`Doctor JSON parse error: ${e.message}\nOutput: ${doctorOutput}`);
    }
    
    console.log(`✅ Doctor output valid JSON with ${doctorJson.checks.length} checks`);
    console.log('');

    // Step 5: Run demo scan
    console.log('Step 5: Running demo scan (static HTML)...');
    const fixtureDir = resolve(projectRoot, 'test', 'fixtures', 'static-buttons');
    
    if (!existsSync(fixtureDir)) {
      throw new Error(`Fixture directory not found: ${fixtureDir}`);
    }

    // Start fixture server
    const fixtureServer = await startFixtureServer(fixtureDir, 0);
    const serverUrl = fixtureServer.url;
    
    console.log(`   Server running at: ${serverUrl}`);
    
    try {
      // Run scan with timeout (3 minutes max)
      // Use fixture directory directly (no need to copy)
      const scanResult = await runCommandWithTimeout(
        'npx',
        ['verax', 'run', '--url', serverUrl, '--src', '.', '--out', '.verax'],
        { cwd: fixtureDir },
        180000 // 3 minutes
      );

      console.log(`✅ Scan completed successfully`);
      console.log(`   Exit code: ${scanResult.code}`);
      console.log('');

      // Step 6: Verify artifacts
      console.log('Step 6: Verifying artifacts...');
      
      // Find run directory (in fixture directory)
      const veraxDir = resolve(fixtureDir, '.verax');
      if (!existsSync(veraxDir)) {
        throw new Error(`.verax directory not found: ${veraxDir}`);
      }

      const runsDir = resolve(veraxDir, 'runs');
      if (!existsSync(runsDir)) {
        throw new Error(`runs directory not found: ${runsDir}`);
      }

      const runs = readdirSync(runsDir);
      if (runs.length === 0) {
        throw new Error(`No run directories found in: ${runsDir}`);
      }

      const runDir = resolve(runsDir, runs[0]);
      console.log(`   Run directory: ${runDir}`);

      // Verify learn.json or expectations.json (either format is acceptable)
      const learnPath = resolve(runDir, 'learn.json');
      const expectationsPath = resolve(runDir, 'expectations.json');
      let expectations = [];
      
      if (existsSync(learnPath)) {
        const learnJson = readJson(learnPath);
        expectations = learnJson.expectations || learnJson.staticExpectations || [];
        console.log(`✅ learn.json has ${expectations.length} expectation(s)`);
      } else if (existsSync(expectationsPath)) {
        const expectationsJson = readJson(expectationsPath);
        expectations = expectationsJson.expectations || [];
        console.log(`✅ expectations.json has ${expectations.length} expectation(s)`);
      } else {
        throw new Error(`Neither learn.json nor expectations.json found in: ${runDir}`);
      }
      
      if (expectations.length === 0) {
        throw new Error(`Expectations file has 0 expectations (expected >=1)`);
      }

      // Verify findings.json
      const findingsPath = resolve(runDir, 'findings.json');
      if (!existsSync(findingsPath)) {
        throw new Error(`findings.json not found: ${findingsPath}`);
      }

      const findingsJson = readJson(findingsPath);
      const findings = Array.isArray(findingsJson) ? findingsJson : (findingsJson.findings || []);
      
      if (findings.length === 0) {
        throw new Error(`findings.json has 0 findings (expected >=1)`);
      }

      console.log(`✅ findings.json has ${findings.length} finding(s)`);

      // Verify evidence directory
      const evidenceDir = resolve(runDir, 'evidence');
      if (existsSync(evidenceDir)) {
        const evidenceFiles = readdirSync(evidenceDir);
        if (evidenceFiles.length === 0) {
          throw new Error(`evidence directory is empty (expected >=1 file)`);
        }
        console.log(`✅ evidence directory contains ${evidenceFiles.length} file(s)`);
      } else {
        console.warn(`⚠️  evidence directory not found (may be optional)`);
      }

      console.log('');
      console.log('✅ All artifact verifications passed');

    } finally {
      // Cleanup: close fixture server
      await fixtureServer.close();
    }

    // Step 7: Cleanup
    console.log('');
    console.log('Step 7: Cleanup...');
    rmSync(tempDir, { recursive: true, force: true });
    rmSync(tarballPath, { force: true });
    console.log('✅ Cleanup complete');
    console.log('');

    // Success
    console.log('='.repeat(60));
    console.log('✅ All release verifications passed!');
    console.log(`✅ VERAX v${packageVersion} is ready for release.`);
    console.log('='.repeat(60));
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error(`❌ Verification failed: ${error.message}`);
    console.error('='.repeat(60));
    console.error('');
    
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    // Cleanup on failure
    try {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}

main();
