/**
 * Contract Test Harness
 * Provides utilities for spawning CLI and capturing results deterministically
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Spawn guardian CLI and capture exit code + output
 */
function spawnGuardianCLI(args, options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    timeout = 60000,
  } = options;

  return new Promise((resolve, reject) => {
    const guardianPath = path.join(__dirname, '..', '..', 'bin', 'guardian.js');
    const child = spawn(process.execPath, [guardianPath, ...args], {
      cwd,
      env: { ...env, FORCE_COLOR: '0', CI: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      reject(new Error(`CLI timeout after ${timeout}ms`));
    }, timeout);

    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (!timedOut) {
        resolve({
          exitCode: code !== null ? code : (signal ? 127 : null),
          stdout,
          stderr,
        });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Create temporary workspace for test isolation
 * 
 * Creates a temp directory with an artifacts subdirectory.
 * Sets GUARDIAN_ARTIFACTS_DIR environment variable so CLI uses it.
 */
function createTempWorkspace(prefix = 'guardian-test-') {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const artifactsDir = path.join(tempDir, '.odavlguardian');
  fs.mkdirSync(artifactsDir, { recursive: true });
  
  // Set environment variable so Guardian CLI uses this artifacts directory
  process.env.GUARDIAN_ARTIFACTS_DIR = artifactsDir;
  
  return { tempDir, artifactsDir };
}

/**
 * Cleanup temp workspace
 */
function cleanupTempWorkspace(tempDir) {
  try {
    // Clear the environment variable
    delete process.env.GUARDIAN_ARTIFACTS_DIR;
    
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn(`Cleanup warning: ${err.message}`);
  }
}

/**
 * Read and parse JSON file safely
 */
function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Check if log file contains specific content
 */
function logContains(logPath, searchString) {
  if (!fs.existsSync(logPath)) return false;
  const content = fs.readFileSync(logPath, 'utf-8');
  return content.includes(searchString);
}

/**
 * Find latest log file in logs directory
 */
function findLatestLog(artifactsDir) {
  const logsDir = path.join(artifactsDir, 'logs');
  if (!fs.existsSync(logsDir)) return null;
  const logs = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
  if (logs.length === 0) return null;
  logs.sort();
  return path.join(logsDir, logs[logs.length - 1]);
}

module.exports = {
  spawnGuardianCLI,
  createTempWorkspace,
  cleanupTempWorkspace,
  readJSON,
  logContains,
  findLatestLog,
};
