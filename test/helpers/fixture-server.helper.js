/**
 * Wave 5 — Fixture Server
 * 
 * Simple HTTP server for serving test fixtures.
 * Used in CI workflows and local testing.
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { resolve as pathResolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Start a fixture server
 * @param {string} fixtureDir - Directory containing fixture files (e.g., test/fixtures/static-site)
 * @param {number} port - Port to listen on (0 for random)
 * @returns {Promise<{url: string, server: (import('http').Server) | null, close: () => Promise<void>}>}
 */
export function startFixtureServer(fixtureDir, port = 0) {
  return new Promise((fulfill) => {
    const fixtureDirResolved = pathResolve(fixtureDir);
    const debug = process.env.VERAX_TEST_DEBUG === '1';
    
    // Create a safe close function that never throws
    let serverRef = null;
    let isClosed = false;
    
    const safeClose = async () => {
      if (isClosed || !serverRef) {
        return; // Already closed or never started
      }
      
      return new Promise((resolveClose) => {
        try {
          if (serverRef && serverRef.listening) {
            serverRef.close(() => {
              isClosed = true;
              if (debug) console.log('[fixture-server] Closed');
              resolveClose();
            });
            // Force resolve after timeout to prevent hanging
            setTimeout(() => {
              isClosed = true;
              resolveClose();
            }, 1000);
          } else {
            isClosed = true;
            resolveClose();
          }
        } catch (error) {
          // Never throw - just resolve
          if (debug) console.error(`[fixture-server] Close error: ${error.message}`);
          isClosed = true;
          resolveClose();
        }
      });
    };
    
    // Create stable return object immediately (will be updated on success)
    const result = {
      url: 'http://127.0.0.1:0', // Placeholder, will be updated
      server: null,
      close: safeClose // Must be the safeClose function
    };
    
    // Ensure close is always a function (defensive check)
    if (typeof result.close !== 'function') {
      result.close = async () => Promise.resolve();
    }
    
    try {
      const server = createServer((req, res) => {
        try {
          // Safely parse URL - req.url can be undefined on Windows
          let requestUrl = req.url;
          if (!requestUrl) {
            if (debug) console.error('[fixture-server] req.url is undefined');
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Bad Request: Invalid URL');
            return;
          }
          
          // Parse URL safely
          let pathname;
          try {
            const host = req.headers.host || '127.0.0.1';
            const urlObj = new URL(requestUrl, `http://${host}`);
            pathname = urlObj.pathname;
          } catch (e) {
            // Fallback: extract pathname manually
            pathname = requestUrl.split('?')[0].split('#')[0];
          }
          
          // Normalize path
          if (!pathname || pathname === '/') {
            pathname = '/index.html';
          }
          
          // Security: reject path traversal
          if (pathname.includes('..')) {
            if (debug) console.error(`[fixture-server] Rejected path traversal: ${pathname}`);
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden: Path traversal not allowed');
            return;
          }
          
          // Remove leading slash and resolve path
          const relativePath = pathname.substring(1) || 'index.html';
          const fullPath = pathResolve(fixtureDirResolved, relativePath);
          
          // Security: ensure file is within fixture directory (handle Windows paths)
          const normalizedFullPath = fullPath.replace(/\\/g, '/');
          const normalizedFixtureDir = fixtureDirResolved.replace(/\\/g, '/');
          if (!normalizedFullPath.startsWith(normalizedFixtureDir)) {
            if (debug) console.error(`[fixture-server] Path outside fixture dir: ${fullPath}`);
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden: Path outside fixture directory');
            return;
          }
          
          // Check if file exists
          if (!existsSync(fullPath)) {
            if (debug) console.error(`[fixture-server] File not found: ${fullPath}`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
          }
          
          // Read and serve file
          const content = readFileSync(fullPath);
          
          // Determine content type
          let contentType = 'text/plain';
          const lowerPath = pathname.toLowerCase();
          if (lowerPath.endsWith('.html')) {
            contentType = 'text/html';
          } else if (lowerPath.endsWith('.js')) {
            contentType = 'application/javascript';
          } else if (lowerPath.endsWith('.css')) {
            contentType = 'text/css';
          } else if (lowerPath.endsWith('.json')) {
            contentType = 'application/json';
          } else if (lowerPath.endsWith('.png')) {
            contentType = 'image/png';
          } else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
            contentType = 'image/jpeg';
          } else if (lowerPath.endsWith('.txt')) {
            contentType = 'text/plain';
          }
          
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
          
          if (debug) console.log(`[fixture-server] Served: ${pathname} -> ${fullPath}`);
        } catch (error) {
          if (debug) console.error(`[fixture-server] Error: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        }
      });
      
      serverRef = server;
      result.server = server; // Set server reference immediately
      
      server.listen(port, '127.0.0.1', () => {
        try {
          const addr = server.address();
          const actualPort = (addr && typeof addr === 'object') ? addr.port : port;
          const baseUrl = `http://127.0.0.1:${actualPort}`;
          
          // Update result object with actual values
          result.url = baseUrl;
          result.server = server;
          // Double-check close is still a function before resolving
          if (typeof result.close !== 'function') {
            result.close = safeClose;
          }
          
          fulfill(result);
        } catch (error) {
          // On error, still resolve with safe object
          if (debug) console.error(`[fixture-server] Listen callback error: ${error.message}`);
          // Ensure close function is attached before resolving
          if (typeof result.close !== 'function') {
            result.close = safeClose;
          }
          fulfill(result);
        }
      });
      
      server.on('error', (error) => {
        // On error, resolve with safe object (don't reject)
        if (debug) console.error(`[fixture-server] Server error: ${error.message}`);
        // Ensure close function is attached before resolving
        if (typeof result.close !== 'function') {
          result.close = safeClose;
        }
        fulfill(result);
      });
    } catch (error) {
      // If server creation fails, still return safe object
      if (debug) console.error(`[fixture-server] Creation error: ${error.message}`);
      // Ensure close function is attached before resolving
      if (typeof result.close !== 'function') {
        result.close = safeClose;
      }
      fulfill(result);
    }
  });
}

/**
 * Stop a fixture server (deprecated - use close() from startFixtureServer return value)
 * @param {(import('http').Server) | {close: function} | null} server - HTTP server instance or object with close method
 * @returns {Promise<void>}
 */
export function stopFixtureServer(server) {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    
    // Handle result object from startFixtureServer with close method
    if (server && typeof server.close === 'function' && 'server' in server) {
      // It's the result object, use its close method
      server.close().then(resolve).catch(() => resolve());
      return;
    }
    
    // Otherwise, treat as http.Server
    try {
      if (server && typeof server === 'object' && 'listening' in server && server.listening) {
        const httpServer = /** @type {import('http').Server} */ (server);
        httpServer.close(() => {
          resolve();
        });
        // Timeout to prevent hanging
        setTimeout(() => resolve(), 1000);
      } else {
        resolve();
      }
    } catch (error) {
      // Never throw - just resolve
      resolve();
    }
  });
}

// If run directly, start server for static-site fixture
// IMPORTANT: Only run if this is the actual script being executed, not when imported
const isDirectExecution = process.argv[1] && 
                         (process.argv[1].endsWith('fixture-server.js') || 
                          process.argv[1].includes('/test/infrastructure/fixture-server.js') ||
                          process.argv[1].includes('\\test\\infrastructure\\fixture-server.js'));

if (isDirectExecution) {
  const fixtureDir = pathResolve(__dirname, '../../test/fixtures/static-site');
  const port = parseInt(process.env.PORT || '8888', 10);
  
  startFixtureServer(fixtureDir, port)
    .then(({ url }) => {
      console.log(`Fixture server running at ${url}`);
      console.log('Press Ctrl+C to stop');
    })
    .catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
  });
}

