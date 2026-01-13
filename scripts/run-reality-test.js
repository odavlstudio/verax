#!/usr/bin/env node
import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const projectDir = resolve(rootDir, 'artifacts', 'test-fixtures', 'absolute-reality-static');
const serverScript = resolve(rootDir, 'scripts', 'fixture-server.js');

// Start server
console.log('Starting server...');
const server = spawn('node', [serverScript, '--root', projectDir], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false, // Keep in same process group for cleanup
  windowsHide: true // Hide console window on Windows
});

// CRITICAL: Unref to prevent blocking Node exit on Windows
server.unref();

let serverReady = false;
let serverPort = null;
let cleanupInProgress = false;
let veraxProcess = null;

// Graceful cleanup function
async function cleanup() {
  if (cleanupInProgress) return;
  cleanupInProgress = true;
  
  // Kill VERAX process first
  if (veraxProcess && !veraxProcess.killed) {
    veraxProcess.kill('SIGTERM');
    await new Promise(resolve => {
      veraxProcess.once('exit', resolve);
      setTimeout(() => {
        if (!veraxProcess.killed) veraxProcess.kill('SIGKILL');
        resolve();
      }, 1000);
    });
  }
  
  // Kill server and wait for it to exit
  if (server && !server.killed) {
    server.kill('SIGTERM');
    await new Promise(resolve => {
      server.once('exit', resolve);
      setTimeout(() => {
        if (!server.killed) server.kill('SIGKILL');
        resolve();
      }, 1000);
    });
  }
  
  // Close streams
  if (veraxProcess) {
    try {
      if (veraxProcess.stdout) veraxProcess.stdout.destroy();
      if (veraxProcess.stderr) veraxProcess.stderr.destroy();
      if (veraxProcess.stdin) veraxProcess.stdin.destroy();
    } catch (streamError) {
      // Ignore stream cleanup errors
    }
  }
  if (server) {
    try {
      if (server.stdout) server.stdout.destroy();
      if (server.stderr) server.stderr.destroy();
      // @ts-expect-error - stdin not configured in stdio
      if (server.stdin) server.stdin.destroy();
    } catch (streamError) {
      // Ignore stream cleanup errors
    }
  }
  
  // Force unref both processes to ensure Node can exit
  if (veraxProcess) {
    try { veraxProcess.unref(); } catch (e) { /* ignore */ }
  }
  if (server) {
    try { server.unref(); } catch (e) { /* ignore */ }
  }
}
// Register cleanup handlers for all exit scenarios
process.on('exit', () => { cleanupInProgress || cleanup(); });
process.on('SIGINT', async () => { await cleanup(); process.exit(130); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(143); });
process.on('uncaughtException', async (err) => { console.error(err); await cleanup(); process.exit(1); });
server.stdout.on('data', (data) => {
  const output = data.toString();
  try {
    const config = JSON.parse(output.trim());
    if (config.port) {
      serverPort = config.port;
      serverReady = true;
      console.log(`Server running on port ${serverPort}`);
      
      // Wait a bit for server to be ready
      setTimeout(async () => {
        const url = `http://127.0.0.1:${serverPort}`;
        console.log(`\nRunning VERAX scan on ${url}...\n`);
        
        const verax = spawn('node', [
          resolve(rootDir, 'bin/verax.js'),
          '--project-dir', projectDir,
          '--url', url
        ], {
          cwd: rootDir,
          stdio: ['ignore', 'inherit', 'inherit'],
          detached: false, // Keep in same process group for cleanup
          windowsHide: true // Hide console window on Windows
        });
        
        // CRITICAL: Unref to prevent blocking Node exit on Windows
        verax.unref();
        
        veraxProcess = verax;
        
        verax.on('close', async (code) => {
          console.log(`\nVERAX exited with code ${code}`);
          await cleanup();
          // Use setImmediate to allow event loop cleanup
          setImmediate(() => {
            process.exit(code || 0);
          });
        });
        
        verax.on('error', async (err) => {
          console.error('VERAX error:', err);
          await cleanup();
          setImmediate(() => {
            process.exit(1);
          });
        });
      }, 2000);
    }
  } catch (e) {
    // Not JSON yet
  }
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

server.on('error', async (err) => {
  console.error('Failed to start server:', err);
  await cleanup();
  process.exitCode = 1;
  process.exit(1);
});

// Timeout
setTimeout(async () => {
  if (!serverReady) {
    console.error('Server failed to start');
    await cleanup();
    process.exitCode = 1;
    process.exit(1);
  }
}, 10000);

