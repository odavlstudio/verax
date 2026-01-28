#!/usr/bin/env node
/**
 * VERAX Release Audit Fixture Servers
 * 
 * Serves 3 test scenarios for final release validation:
 * - Port 5001: Golden Path (should pass)
 * - Port 5002: Silent Failure (should find issues)
 * - Port 5003: Ambiguous (should mark incomplete)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, 'fixtures');

const scenarios = [
  { port: 5001, file: 'golden-path.html', name: 'Golden Path' },
  { port: 5002, file: 'silent-failure.html', name: 'Silent Failure' },
  { port: 5003, file: 'ambiguous.html', name: 'Ambiguous/Partial' },
];

function createServer(scenario) {
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      const filePath = path.join(fixturesDir, scenario.file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } catch (err) {
        res.writeHead(500);
        res.end(`Error: ${err.message}`);
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(scenario.port, () => {
    console.log(`[FIXTURE] ${scenario.name} listening on http://127.0.0.1:${scenario.port}`);
  });

  return server;
}

// Start all three servers
const servers = scenarios.map(createServer);

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[FIXTURE] Shutting down servers...');
  servers.forEach(s => s.close());
  process.exit(0);
});

console.log('[FIXTURE] Release audit servers started');
