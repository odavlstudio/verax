#!/usr/bin/env node
// Tiny HTTP fixture server for VERAX network tests
import http from 'http';
import { createReadStream, statSync, existsSync } from 'fs';
import { extname, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = __filename.split(sep).slice(0, -1).join(sep);

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function pickPort(preferred = 4173, attempts = 10) {
  return new Promise((resolvePort, reject) => {
    let port = preferred;
    const tryListen = (attempt) => {
      const server = http.createServer();
      server.once('error', (err) => {
        server.close();
        if ((err instanceof Error && 'code' in err && err.code === 'EADDRINUSE') && attempt < attempts) {
          port += 1;
          tryListen(attempt + 1);
        } else {
          reject(err);
        }
      });
      server.once('listening', () => {
        const addr = server.address();
        const chosen = typeof addr === 'object' && addr !== null && 'port' in addr ? addr.port : port;
        server.close(() => resolvePort(chosen));
      });
      server.listen(port, '127.0.0.1');
    };
    tryListen(0);
  });
}

function serveFile(rootDir, urlPath, res) {
  const safePath = urlPath.split('?')[0].split('#')[0];
  let target = safePath === '/' ? 'index.html' : safePath.replace(/^\//, '');
  
  // If target doesn't have extension, try adding .html
  if (target && !extname(target) && target !== '/') {
    const withHtml = target + '.html';
    const withHtmlPath = resolve(rootDir, withHtml);
    if (existsSync(withHtmlPath)) {
      target = withHtml;
    }
  }
  
  const filePath = resolve(rootDir, target);
  if (!existsSync(filePath)) return false;
  const stats = statSync(filePath);
  if (stats.isDirectory()) return false;
  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const rootArgIndex = args.findIndex(a => a === '--root');
  const rootDir = rootArgIndex >= 0 && args[rootArgIndex + 1]
    ? resolve(args[rootArgIndex + 1])
    : process.cwd();

  const preferredPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 4173;
  const port = await pickPort(preferredPort);

  const server = http.createServer((req, res) => {
    const { url = '' } = req;

    // API endpoints
    if (url.startsWith('/api/ok')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }
    if (url.startsWith('/api/fail')) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false }));
    }
    if (url.startsWith('/api/slow')) {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      }, 2500); // 2500ms to exceed 2000ms slow threshold
      return;
    }

    // Static files
    const served = serveFile(rootDir, url, res);
    if (!served) {
      // fallback index.html for SPA
      const fallback = resolve(rootDir, 'index.html');
      if (existsSync(fallback)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        createReadStream(fallback).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(JSON.stringify({ port, rootDir }, null, 2));
  });
}

main().catch((err) => {
  console.error('Fixture server failed:', err.message);
  process.exitCode = 1;
});
