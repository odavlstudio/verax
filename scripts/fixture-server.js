/**
 * Minimal static file server for local fixtures
 * Usage:
 *   node scripts/fixture-server.js [rootDir] [port]
 * Defaults:
 *   rootDir: ./test/fixtures/static-buttons
 *   port: 3456
 */

import http from 'http';
import { createReadStream, statSync, existsSync } from 'fs';
import { extname, join, normalize, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = normalize(resolve(__filename, '..'));

const DEFAULT_ROOT = resolve(process.cwd(), 'test/fixtures/static-buttons');
const rootDir = resolve(process.argv[2] || process.env.VERAX_FIXTURE_DIR || DEFAULT_ROOT);
const port = parseInt(process.argv[3] || process.env.VERAX_FIXTURE_PORT || '3456', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function safePath(urlPath) {
  // Strip query/hash and normalize
  const clean = urlPath.split('?')[0].split('#')[0];
  const decoded = decodeURIComponent(clean);
  // Prevent path traversal
  const full = resolve(rootDir, '.' + decoded);
  if (!full.startsWith(rootDir)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  try {
    let filePath = safePath(req.url || '/');
    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad request');
      return;
    }

    // If path is a directory, serve index.html
    let stats;
    if (existsSync(filePath)) {
      stats = statSync(filePath);
      if (stats.isDirectory()) {
        filePath = join(filePath, 'index.html');
      }
    }

    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    const stream = createReadStream(filePath);
    stream.on('error', () => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    });
    stream.pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[fixture-server] Serving ${rootDir} at http://127.0.0.1:${port}`);
});
