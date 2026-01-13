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

// No default PORT - use ephemeral port (0) to avoid EADDRINUSE errors
// The test will call server.listen(0) to get a random available port

// Export only - do not auto-start server to prevent Node test runner from treating this as a test
export { server };



