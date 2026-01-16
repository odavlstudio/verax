#!/usr/bin/env node
/**
 * HTTP Server for POST Blocking Test
 * Serves an HTML page with POST form + tracks if POST was received
 */

import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Track whether POST was received
let postReceived = false;

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/' && req.method === 'GET') {
    // Serve HTML with POST form
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>POST Blocking Test</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    button { padding: 10px 20px; cursor: pointer; }
    #result { margin-top: 20px; padding: 10px; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <h1>POST Request Test</h1>
  
  <button id="post-btn">Submit POST Request</button>
  
  <div id="result">
    <h2>Results:</h2>
    <p id="post-result">POST Result: (pending)</p>
  </div>

  <script>
    // POST promise - should be blocked by VERAX
    window.postRequest = function() {
      return fetch('/api/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      }).then(r => r.json()).catch(e => ({ error: e.message }));
    };

    document.getElementById('post-btn').addEventListener('click', async () => {
      const result = await window.postRequest();
      document.getElementById('post-result').innerText = 
        'POST Result: ' + (result.error ? 'Error: ' + result.error : 'Success');
    });
  </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  if (req.url === '/api/write' && req.method === 'POST') {
    // Track that POST was received
    postReceived = true;

    // Collect body
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, received: body }));
    });
    return;
  }

  if (req.url === '/api/write-check' && req.method === 'GET') {
    // Return whether POST was received
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ postReceived }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// Start server on ephemeral port (0)
server.listen(0, 'localhost', () => {
  const port = server.address().port;
  // Print port to stdout so parent process can read it
  console.log(`READY:${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});
