import http from 'http';

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  
  if (req.url === '/') {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Flow Broken - 2 Step Flow with Silent Failure</title>
      </head>
      <body>
        <h1>Multi-Step Flow Test: Silent Failure</h1>
        <p>Step 1: Click navigation link to go to step 2</p>
        <a href="/after-nav" id="step1-link" style="display:inline-block; padding:10px; background:#blue; color:white;">Step 1: Navigate</a>
      </body>
      </html>
    `;
    res.writeHead(200);
    res.end(html);
  } else if (req.url === '/after-nav') {
    // This page is reached after click, simulating the flow
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Flow Broken - Step 2</title>
      </head>
      <body>
        <h1>Step 2: API Request with Silent Failure</h1>
        <button id="step2-button">Fetch Data (Silent Failure)</button>
        <div id="result"></div>
        <script>
          document.getElementById('step2-button').addEventListener('click', function() {
            fetch('/api/data-not-found')
              .then(r => r.json())
              .catch(e => {
                // SILENT FAILURE - no UI update
                console.log('Silent fail');
              });
          });
        </script>
      </body>
      </html>
    `;
    res.writeHead(200);
    res.end(html);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Use PORT env variable or ephemeral port to avoid EADDRINUSE
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 0;

// Only start server if run directly - be very explicit about what we check
const isDirectRun = process.argv[1] && (
  process.argv[1].includes('/flow-broken/server.js') ||
  process.argv[1].includes('\\flow-broken\\server.js') ||
  process.argv[1].endsWith('flow-broken/server.js')
);

if (isDirectRun) {
  server.listen(PORT, () => {
    const addr = server.address();
    const actualPort = typeof addr === 'object' && addr && addr.port ? addr.port : PORT;
    console.log(`Flow broken fixture running on http://127.0.0.1:${actualPort}`);
    console.error(`Server listening on port ${actualPort}`);
  });
}

export { server, PORT };


