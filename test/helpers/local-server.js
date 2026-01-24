/**
 * Local Test Server Utility
 * Serves a test fixture directory on a free port
 * Provides deterministic, reliable server startup/shutdown for integration tests
 */

import http from 'http';
import { readFileSync } from 'fs';
import { resolve as resolvePath, extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Find a free port by attempting to bind
 * @returns {Promise<number>}
 */
export async function findFreePort(startPort = 3000) {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      const available = await new Promise((resolve) => {
        const server = http.createServer();
        
        server.once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            resolve(false);
          } else {
            resolve(false);
          }
        });

        server.once('listening', () => {
          server.close(() => {
            resolve(true);
          });
        });

        server.listen(port, 'localhost');
      });

      if (available) {
        return port;
      }
    } catch (err) {
      // Continue to next port
    }
  }
  
  throw new Error('Could not find a free port');
}

/**
 * MIME type mapping
 */
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};

/**
 * Start a local HTTP server serving a fixture directory
 * @param {string} fixtureDir - Absolute path to fixture directory
 * @param {number} port - Port to listen on
 * @returns {Promise<{ url: string, server: http.Server, close: () => Promise<void> }>}
 */
export async function startLocalServer(fixtureDir, port = null) {
  if (!port) {
    port = await findFreePort();
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        // Default to index.html for root
        let filePath = req.url === '/' ? '/index.html' : req.url;
        
        // Remove query string
        if (filePath.includes('?')) {
          filePath = filePath.split('?')[0];
        }

        // Build full path
        const fullPath = resolvePath(join(fixtureDir, filePath));

        // Security: prevent directory traversal
        if (!fullPath.startsWith(fixtureDir)) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
          return;
        }

        // Read and serve the file
        try {
          const content = readFileSync(fullPath);
          const ext = extname(fullPath);
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        } catch (error) {
          if (error.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
          } else {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server Error');
          }
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      }
    });

    server.on('error', reject);
    server.listen(port, 'localhost', () => {
      const url = `http://localhost:${port}`;

      // Add to global tracker for cleanup
      if (global.__veraxTestServers) {
        global.__veraxTestServers.add(server);
      }

      const close = () => {
        return new Promise((resolveClose, _rejectClose) => {
          if (global.__veraxTestServers) {
            global.__veraxTestServers.delete(server);
          }
          server.close(resolveClose);
          server.closeAllConnections?.();
        });
      };

      resolve({ url, server, close });
    });
  });
}

/**
 * Start a server and ensure it's ready for requests
 * @param {string} fixtureDir - Absolute path to fixture directory
 * @param {number} port - Optional port
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function setupLocalServer(fixtureDir, port = null) {
  const { url, close } = await startLocalServer(fixtureDir, port);
  
  // Wait a moment for server to be fully ready
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return { url, close };
}
