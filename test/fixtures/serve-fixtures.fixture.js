/**
 * CI Fixture Server
 * 
 * Starts a lightweight HTTP server that serves one of the test fixtures.
 * Used for deterministic VERAX scanning in CI environments.
 * 
 * Exit codes:
 * - 0: Successful start and shutdown
 * - 1: Port binding failed
 * - 2: Signal (SIGTERM, SIGINT) received
 */

import http from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Select fixture to serve (one that produces findings deterministically)
const FIXTURE_PATH = resolve(__dirname, 'static-buttons');
const DEFAULT_PORT = 3456;

export function createFixtureServer() {
  return http.createServer((req, res) => {
    try {
      // Route index.html
      if (req.url === '/' || req.url === '/index.html') {
        const content = readFileSync(resolve(FIXTURE_PATH, 'index.html'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }

      // Route pricing.html
      if (req.url === '/pricing' || req.url === '/pricing.html') {
        const content = readFileSync(resolve(FIXTURE_PATH, 'pricing.html'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }

      // Route about.html
      if (req.url === '/about' || req.url === '/about.html') {
        const content = readFileSync(resolve(FIXTURE_PATH, 'about.html'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }

      // Route success.html
      if (req.url === '/success' || req.url === '/success.html') {
        const content = readFileSync(resolve(FIXTURE_PATH, 'success.html'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }

      // Route submit.html
      if (req.url === '/submit' || req.url === '/submit.html') {
        const content = readFileSync(resolve(FIXTURE_PATH, 'submit.html'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Error: ' + error.message);
    }
  });
}

// Backward-compatible singleton server (legacy tests / scripts)
const server = createFixtureServer();

// Find available port
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;

// Only start server if run directly, not when imported by test runner
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
  server.listen(PORT, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${PORT}`;
    console.log(`Fixture server running at ${url}`);
    console.log(`Fixture: ${FIXTURE_PATH}`);
    console.log(`PID: ${process.pid}`);
  });
}

export { server, PORT };

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

// Handle errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('Server error:', error);
    process.exit(1);
  }
});

