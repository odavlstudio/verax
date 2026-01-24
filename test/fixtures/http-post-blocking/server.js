/**
 * HTTP Test Server Fixture
 * 
 * Serves a simple HTML page with a button that triggers a POST request.
 * Tracks whether POST was received (counter).
 * 
 * Usage:
 *   import { createTestServer } from './server.js'
 *   const { server, port, getCounter } = await createTestServer();
 *   const counter = getCounter(); // POST count
 *   await server.close();
 */

import { createServer } from 'http';
import { URL } from 'url';

let requestCounter = 0;

function createTestServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');

      // Handle GET / - serve HTML page
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html>
<head>
  <title>POST Test Page</title>
</head>
<body>
  <h1>POST Blocking Test</h1>
  <p>Click the button to trigger a POST request:</p>
  <button id="test-btn">Send POST to /api/save</button>
  
  <script>
    document.getElementById('test-btn').addEventListener('click', async () => {
      try {
        const response = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save', data: 'test' })
        });
        const result = await response.json();
        alert('POST succeeded: ' + JSON.stringify(result));
      } catch (err) {
        alert('POST failed: ' + err.message);
      }
    });
  </script>
</body>
</html>`);
        return;
      }

      // Handle POST /api/save - increment counter
      if (req.method === 'POST' && url.pathname === '/api/save') {
        requestCounter++;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          counter: requestCounter,
          message: 'POST request received'
        }));
        return;
      }

      // Handle GET /api/counter - expose counter for test verification
      if (req.method === 'GET' && url.pathname === '/api/counter') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          counter: requestCounter
        }));
        return;
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    });

    // Listen on ephemeral port (0 = auto-assign)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = addr.port;

      resolve({
        server,
        port,
        /**
         * Get current POST counter
         */
        getCounter() {
          return requestCounter;
        },
        /**
         * Reset counter (for multiple test runs)
         */
        resetCounter() {
          requestCounter = 0;
        }
      });
    });
  });
}

export { createTestServer };


