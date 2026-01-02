/**
 * Golden Path Reality Proof Test
 * 
 * Ensures Guardian NEVER blocks launch (DO_NOT_LAUNCH) on simple static websites
 * where there's nothing to test but the site is technically working.
 * 
 * Golden Path = static landing/docs/blog with no login/signup/checkout
 */

const http = require('http');
const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Golden Path: Simple static landing page
function startGoldenPathServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html');
      
      if (req.url === '/') {
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>Simple Landing Page</title>
          </head>
          <body>
            <h1>Welcome to Our Product</h1>
            <p>This is a simple, static landing page.</p>
            <p>No forms, no signup, no checkout.</p>
            <a href="/about">Learn More</a>
            <a href="/docs">Documentation</a>
          </body>
          </html>
        `);
      } else if (req.url === '/about') {
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html><head><title>About Us</title></head>
          <body><h1>About Us</h1><p>Company info here.</p></body>
          </html>
        `);
      } else if (req.url === '/docs') {
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html><head><title>Documentation</title></head>
          <body><h1>Docs</h1><p>Read our documentation.</p></body>
          </html>
        `);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

(async () => {
  console.log('🛡️  Golden Path Reality Proof');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { server, port } = await startGoldenPathServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    console.log('📋 Testing: Simple static landing page');
    console.log(`   URL: ${baseUrl}`);
    
    const artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-golden-'));
    
    // Wait a bit for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const result = spawnSync(process.execPath, [
      'bin/guardian.js',
      'reality',
      '--url', baseUrl,
      '--preset', 'landing',
      '--fast',
      '--timeout', '30000',
      '--artifacts', artifactsDir
    ], { 
      encoding: 'utf8', 
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    console.log(result.stdout);
    if (result.stderr) console.error('STDERR:', result.stderr);

    // GOLDEN PATH RULE 1: Guardian must NOT crash
    assert.ok(
      result.status !== null,
      'Guardian must complete execution (not crash)'
    );
    console.log(`✅ Guardian completed (exit code: ${result.status})`);

    // Find run directory
    const runDirs = fs.readdirSync(artifactsDir)
      .filter(d => d !== 'latest')
      .filter(d => fs.statSync(path.join(artifactsDir, d)).isDirectory())
      .sort()
      .reverse();
    
    assert.ok(runDirs.length > 0, 'Run directory must be created');
    const runDir = runDirs[0];

    // GOLDEN PATH RULE 2: decision.json must exist
    const decisionPath = path.join(artifactsDir, runDir, 'decision.json');
    assert.ok(fs.existsSync(decisionPath), 'decision.json must exist');
    console.log(`✅ decision.json exists`);

    const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
    
    // GOLDEN PATH RULE 3: Verdict must be READY or FRICTION (NOT DO_NOT_LAUNCH)
    assert.ok(
      decision.finalVerdict === 'READY' || decision.finalVerdict === 'FRICTION',
      `Golden Path violation: verdict must be READY or FRICTION, got ${decision.finalVerdict}`
    );
    console.log(`✅ Golden Path safe verdict: ${decision.finalVerdict}`);

    // GOLDEN PATH RULE 4: Exit code must be 0 or 1 (NOT 2)
    assert.ok(
      result.status === 0 || result.status === 1,
      `Golden Path violation: exit code must be 0 or 1, got ${result.status}`
    );
    console.log(`✅ Golden Path safe exit code: ${result.status}`);

    // GOLDEN PATH RULE 5: summary.md must exist
    const summaryPath = path.join(artifactsDir, runDir, 'summary.md');
    assert.ok(fs.existsSync(summaryPath), 'summary.md must exist');
    console.log(`✅ summary.md exists`);

    // Explain the Golden Path
    console.log('\n📖 Golden Path Explanation:');
    console.log('   Static sites with no interactive elements are SAFE.');
    console.log('   Even if Guardian finds "nothing to test", that is NOT a launch blocker.');
    console.log('   The site works, the user can read content, and there\'s no broken flow.');
    console.log('   Verdict: FRICTION (acknowledge limited testing) or READY (site is functional)');

    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Golden Path VERIFIED');
    console.log('   Guardian will NOT block simple static sites from launching.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    process.exit(0);

  } catch (err) {
    console.error('\n❌ GOLDEN PATH VIOLATED');
    console.error(err.message);
    console.error(err.stack);
    console.error('\nThis means Guardian is incorrectly blocking safe static websites.');
    process.exit(1);
  } finally {
    server.close();
  }
})();
