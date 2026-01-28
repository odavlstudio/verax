#!/usr/bin/env node
/**
 * Test fixture server for VERAX audit
 * Serves test fixtures on a local port for VERAX to scan
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');
const port = process.env.AUDIT_PORT || 5000;

const server = http.createServer((req, res) => {
  let filePath = path.join(fixturesDir, req.url === '/' ? 'index.html' : req.url);
  
  // Prevent directory traversal
  if (!filePath.startsWith(fixturesDir)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  try {
    const stat = fs.statSync(filePath);
    
    if (!stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const contentType = filePath.endsWith('.html') ? 'text/html' : 'text/plain';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server Error');
  }
});

server.listen(port, () => {
  console.log(`VERAX audit fixture server listening on http://127.0.0.1:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
