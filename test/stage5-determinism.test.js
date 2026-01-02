/**
 * Stage 5: Determinism Integration Test
 * 
 * Verifies that same inputs => same verdict and determinism hash
 * Runs the same scenario 5 times and asserts consistency
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { tmpdir } = require('os');
const { mkdtempSync, rmSync } = require('fs');

console.log('🧪 Stage 5: Determinism Test');
console.log('━'.repeat(70));

// Create test fixture server
let server;
let baseUrl;

function createFixtureServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      // Simple deterministic page
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Determinism Test</title></head>
        <body>
          <h1>Test Page</h1>
          <p>This is a deterministic test page.</p>
          <a href="/page2">Link to Page 2</a>
        </body>
        </html>
      `);
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`✅ Test server started: ${baseUrl}\n`);
      resolve();
    });
  });
}

function stopFixtureServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('\n✅ Test server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runGuardian(runNum) {
  return new Promise((resolve, reject) => {
    const tempDir = mkdtempSync(path.join(tmpdir(), `guardian-det-${runNum}-`));
    
    const args = [
      'bin/guardian.js',
      'reality',
      '--url', baseUrl,
      '--artifacts', tempDir,
      '--fast',
      '--preset', 'landing',
      '--attempts', 'site_smoke'
    ];

    const guardian = spawn('node', args, {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    let stdout = '';
    let stderr = '';

    guardian.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    guardian.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    guardian.on('close', (code) => {
      // Find decision.json
      let decisionPath = null;
      let decision = null;

      try {
        const dirs = fs.readdirSync(tempDir);
        const runDir = dirs.find(d => d.includes('PENDING') || d.includes('READY') || d.includes('FRICTION'));
        if (runDir) {
          decisionPath = path.join(tempDir, runDir, 'decision.json');
          if (fs.existsSync(decisionPath)) {
            decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
          }
        }
      } catch (err) {
        console.error(`⚠️  Failed to read decision for run ${runNum}: ${err.message}`);
      }

      // Cleanup
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}

      resolve({
        exitCode: code,
        decision,
        stdout,
        stderr
      });
    });

    guardian.on('error', (err) => {
      reject(err);
    });
  });
}

async function runDeterminismTest() {
  try {
    await createFixtureServer();

    console.log('🎬 Running 5 identical scenarios...\n');

    const results = [];
    for (let i = 1; i <= 5; i++) {
      process.stdout.write(`  Run ${i}/5...`);
      const result = await runGuardian(i);
      results.push(result);
      console.log(` ✅ (exit ${result.exitCode})`);
    }

    console.log('\n📊 Analyzing results...\n');

    // Extract verdicts and hashes
    const verdicts = results.map(r => r.decision?.finalVerdict).filter(Boolean);
    const hashes = results.map(r => r.decision?.determinismHash).filter(Boolean);
    const exitCodes = results.map(r => r.exitCode);

    console.log('Verdicts:', verdicts);
    console.log('Hashes:', hashes);
    console.log('Exit codes:', exitCodes);

    // Assertions
    const assertions = [];

    // All runs should have a decision
    if (verdicts.length !== 5) {
      assertions.push(`❌ Expected 5 decisions, got ${verdicts.length}`);
    } else {
      assertions.push(`✅ All 5 runs produced decisions`);
    }

    // All runs should have determinism hash
    if (hashes.length !== 5) {
      assertions.push(`❌ Expected 5 determinism hashes, got ${hashes.length}`);
    } else {
      assertions.push(`✅ All 5 runs have determinism hashes`);
    }

    // All verdicts should be identical
    const firstVerdict = verdicts[0];
    const allVerdictsSame = verdicts.every(v => v === firstVerdict);
    if (!allVerdictsSame) {
      assertions.push(`❌ Verdicts differ: ${JSON.stringify(verdicts)}`);
    } else {
      assertions.push(`✅ All verdicts identical: ${firstVerdict}`);
    }

    // All hashes should be identical
    const firstHash = hashes[0];
    const allHashesSame = hashes.every(h => h === firstHash);
    if (!allHashesSame) {
      assertions.push(`❌ Determinism hashes differ`);
      console.log('   Hash details:', hashes.map((h, i) => `Run ${i + 1}: ${h}`));
    } else {
      assertions.push(`✅ All determinism hashes identical`);
      console.log(`   Hash: ${firstHash.substring(0, 16)}...`);
    }

    // All exit codes should be identical
    const firstExitCode = exitCodes[0];
    const allExitCodesSame = exitCodes.every(c => c === firstExitCode);
    if (!allExitCodesSame) {
      assertions.push(`❌ Exit codes differ: ${JSON.stringify(exitCodes)}`);
    } else {
      assertions.push(`✅ All exit codes identical: ${firstExitCode}`);
    }

    console.log('\n━'.repeat(70));
    assertions.forEach(a => console.log(a));
    console.log('━'.repeat(70));

    const failed = assertions.some(a => a.startsWith('❌'));

    await stopFixtureServer();

    if (failed) {
      console.log('\n❌ Determinism test FAILED\n');
      process.exit(1);
    } else {
      console.log('\n✅ Determinism test PASSED\n');
      process.exit(0);
    }

  } catch (err) {
    console.error(`\n❌ Test error: ${err.message}`);
    if (err.stack) console.error(err.stack);
    await stopFixtureServer();
    process.exit(1);
  }
}

runDeterminismTest();
