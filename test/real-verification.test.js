/**
 * REAL VERIFICATION: Expectation-Driven Execution
 * Run on nav-broken fixture
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { scan } from '../src/verax/index.js';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { createServer } from 'http';
import { promisify } from 'util';

function createTempDir() {
  const tempDir = join(process.cwd(), 'artifacts', 'temp-installs', `real-verify-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    // Ignore
  }
}

test('REAL VERIFICATION: expectation-driven execution with HTTP server', async () => {
  const tempDir = createTempDir();
  
  try {
    // Create fixture with working navigation and failing navigation
    writeFileSync(join(tempDir, 'index.html'), `
      <html>
        <body>
          <h1>Home</h1>
          <a id="working-link" href="/page1">Page 1 (works)</a>
          <a id="broken-link" href="javascript:void(0)">Page 2 (does nothing)</a>
        </body>
      </html>
    `);
    
    writeFileSync(join(tempDir, 'page1.html'), `
      <html>
        <body>
          <h1>Page 1</h1>
        </body>
      </html>
    `);
    
    // Create manifest directly with 2 PROVEN navigation expectations
    const manifestPath = join(tempDir, 'verax-manifest.json');
    const manifestContent = {
      projectDir: tempDir,
      entryUrl: 'http://localhost:PORT/index.html',
      manifestVersion: '1.0.0',
      expectationsStatus: 'PROVEN_EXPECTATIONS_AVAILABLE',
      staticExpectations: [
      {
        id: 'exp1',
        fromPath: '/',
        type: 'navigation',
        targetPath: '/page1',
        evidence: { source: 'index.html', selectorHint: '#working-link' },
        proof: 'PROVEN_EXPECTATION',
        sourceRef: 'index.html:5'
      },
      {
        id: 'exp2',
        fromPath: '/',
        type: 'navigation',
        targetPath: '/page2',
        evidence: { source: 'index.html', selectorHint: '#broken-link' },
        proof: 'PROVEN_EXPECTATION',
        sourceRef: 'index.html:6'
      }
      ]
    };
    writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2));
    const manifest = { manifestPath };
    
    // Create HTTP server - page2 returns 404 to simulate broken link
    const server = createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(tempDir, 'index.html')));
      } else if (req.url === '/page1' || req.url === '/page1.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(join(tempDir, 'page1.html')));
      } else if (req.url === '/page2' || req.url === '/page2.html') {
        // Broken - return 404
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    
    await promisify(server.listen.bind(server))(0);
    const port = server.address().port;
    const url = `http://localhost:${port}/index.html`;
    
    try {
      // Run scan
      const result = await scan(tempDir, url, manifest.manifestPath);

      // Verify observation has expectationExecution
      assert.ok(result.observation.expectationExecution, 'Must have expectationExecution');
      
      const expExec = result.observation.expectationExecution;
      
      // Read manifest to get PROVEN count
      const manifestData = JSON.parse(readFileSync(manifest.manifestPath, 'utf-8'));
      const provenExpectations = manifestData.staticExpectations.filter(e => 
        e.proof === 'PROVEN_EXPECTATION' || e.sourceRef
      );
  
  console.log('\n═══════════════════════════════════════════════════');
      console.log('REAL VERIFICATION: HTTP server with mixed navigation');
  console.log('═══════════════════════════════════════════════════');
      console.log(`Temp dir: ${tempDir}`);
  console.log(`URL: ${url}`);
  console.log(`Manifest PROVEN expectations: ${provenExpectations.length}`);
  console.log('');
  console.log('EXPECTATION EXECUTION RESULTS:');
  console.log(`  provenExpectationsTotal: ${expExec.totalProvenExpectations}`);
  console.log(`  executedCount: ${expExec.executedCount}`);
  console.log(`  coverageGapsCount: ${expExec.coverageGapsCount}`);
  console.log('');
  
  // Count outcomes
  const verified = expExec.results.filter(r => r.outcome === 'VERIFIED').length;
  const silentFailures = expExec.results.filter(r => r.outcome === 'SILENT_FAILURE').length;
  const budgetExceeded = result.coverageGaps ? result.coverageGaps.filter(g => g.reason === 'budget_exceeded').length : 0;
  
  console.log('OUTCOME BREAKDOWN:');
  console.log(`  verifiedCount: ${verified}`);
  console.log(`  silentFailureCount: ${silentFailures}`);
  console.log(`  coverageGapCount: ${result.coverageGaps ? result.coverageGaps.length : 0}`);
  console.log(`  budgetExceededCount: ${budgetExceeded}`);
  console.log('');
  
  // ASSERTION: All expectations accounted for
  // Note: executedCount = all attempted (including those that became COVERAGE_GAP)
  // coverageGapsCount = count of COVERAGE_GAP outcomes (subset of executed)
  // The assertion is: executedCount === totalProvenExpectations (all were attempted)
  console.log('ASSERTION CHECK:');
  console.log(`  executedCount (all attempted) = ${expExec.executedCount}`);
  console.log(`  Total PROVEN expectations = ${expExec.totalProvenExpectations}`);
  
  assert.strictEqual(
    expExec.executedCount,
    expExec.totalProvenExpectations,
    `All expectations must be attempted: ${expExec.executedCount} !== ${expExec.totalProvenExpectations}`
  );
  
  console.log(`  ✅ ASSERTION PASSED: ${expExec.executedCount} === ${expExec.totalProvenExpectations}`);
  console.log('');
  
  // Show detailed results
  console.log('DETAILED RESULTS:');
  for (const res of expExec.results) {
    console.log(`  [${res.outcome}] ${res.type} from ${res.fromPath}${res.reason ? ` - ${res.reason}` : ''}`);
  }
  
  if (result.coverageGaps && result.coverageGaps.length > 0) {
    console.log('');
    console.log('COVERAGE GAPS:');
    for (const gap of result.coverageGaps) {
      console.log(`  [COVERAGE_GAP] ${gap.type} - ${gap.reason}`);
    }
  }
  
  console.log('');
  console.log('FINDINGS:');
  console.log(`  Total findings: ${result.findings.findings.length}`);
  for (const finding of result.findings.findings) {
    console.log(`  - ${finding.type}: ${finding.reason}`);
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ REAL VERIFICATION COMPLETE');
      } finally {
        await promisify(server.close.bind(server))();
      }
    } finally {
      cleanupTempDir(tempDir);
    }
  console.log('═══════════════════════════════════════════════════');
});
