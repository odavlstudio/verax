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

// Use PORT env variable or ephemeral port to avoid EADDRINUSE
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 0;

// Only start server if run directly - be very explicit about what we check
const isDirectRun = process.argv[1] && (
  process.argv[1].includes('/flow-ok/server.js') ||
  process.argv[1].includes('\\flow-ok\\server.js') ||
  process.argv[1].endsWith('flow-ok/server.js')
);

if (isDirectRun) {
  server.listen(PORT, () => {
    const addr = server.address();
    const actualPort = typeof addr === 'object' && addr && addr.port ? addr.port : PORT;
    console.log(`Flow OK fixture running on http://127.0.0.1:${actualPort}`);
    console.error(`Server listening on port ${actualPort}`);
  });
}

export { server, PORT };



