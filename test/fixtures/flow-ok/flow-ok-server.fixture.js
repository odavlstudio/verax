import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  
  if (req.url === '/' || req.url === '/step1') {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Flow OK - Multi-Step Flow</title>
      </head>
      <body>
        <h1>Flow Step 1: Initial Page</h1>
        <p>This page demonstrates a 2-step flow where step 2 has proper error handling.</p>
        <a href="/step2" id="step1-link">Step 2: Navigate</a>
      </body>
      </html>
    `;
    res.writeHead(200);
    res.end(html);
  } else if (req.url === '/step2') {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Flow OK - Step 2</title>
      </head>
      <body>
        <h1>Flow Step 2: API Interaction</h1>
        <p>Click the button to trigger a network request.</p>
        <button id="api-button">Fetch Data</button>
        <div id="result"></div>
        <script>
          document.getElementById('api-button').addEventListener('click', function() {
            // Network request with error handling and visible feedback
            fetch('/api/data')
              .then(r => r.json())
              .then(data => {
                document.getElementById('result').innerHTML = '<p>Success: ' + JSON.stringify(data) + '</p>';
              })
              .catch(e => {
                // Visible feedback on error
                document.getElementById('result').innerHTML = '<p style="color: red;">Error loading data: ' + e.message + '</p>';
              });
          });
        </script>
      </body>
      </html>
    `;
    res.writeHead(200);
    res.end(html);
  } else if (req.url === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Success' }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// No default PORT - use ephemeral port (0) to avoid EADDRINUSE errors
// The test will call server.listen(0) to get a random available port

// Export only - do not auto-start server to prevent Node test runner from treating this as a test
export { server };


