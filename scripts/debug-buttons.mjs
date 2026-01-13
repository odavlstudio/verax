import { observe } from '../src/verax/observe/index.js';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import http from 'http';

async function main() {
  const tempDir = mkdtempSync(join(tmpdir(), 'verax-debug-'));
  const indexHtml = [
    '<!DOCTYPE html>','<html><body>',
    "<button id='test-button'>Test</button>",
    "<button data-testid='test-button-2'>Test 2</button>",
    "<a href='/about.html' id='test-link'>Link</a>",
    '</body></html>'
  ].join('');
  writeFileSync(join(tempDir, 'index.html'), indexHtml);

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(readFileSync(join(tempDir, 'index.html')));
  });

  await new Promise(resolve => server.listen(8006, resolve));

  const start = Date.now();
  const result = await observe('http://localhost:8006/index.html');
  console.log('elapsed ms', Date.now() - start);
  const observation = JSON.parse(readFileSync(result.tracesPath, 'utf-8'));
  const traces = observation.traces.map(t => ({
    type: t.interaction.type,
    selector: t.interaction.selector,
    policy: t.policy
  }));
  console.log('coverage', observation.coverage);
  console.log('traces', traces);

  server.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
