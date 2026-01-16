import http from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(readFileSync(resolve(__dirname, 'index.html')));
  } else if (req.url === '/api/contact' && req.method === 'POST') {
    // This should be blocked by VERAX
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 4567;
server.listen(PORT, () => {
  console.log(`POST form test server running at http://localhost:${PORT}`);
});
