/**
 * Verification script for expectation-driven execution
 */

import { scan } from '../src/verax/index.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixturesDir = resolve(__dirname, 'fixtures');
const staticSiteDir = resolve(fixturesDir, 'expectation-test');
const manifestPath = resolve(staticSiteDir, 'manifest.json');

const PORT = 3457;
let server;

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        let filePath;
        if (req.url === '/' || req.url === '/index.html') {
          filePath = resolve(staticSiteDir, 'index.html');
        } else if (req.url === '/working.html') {
          filePath = resolve(staticSiteDir, 'working.html');
        } else {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        
        const content = readFileSync(filePath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } catch (error) {
        res.writeHead(500);
        res.end('Server error');
      }
    });
    
    server.listen(PORT, () => {
      resolve();
    });
    
    server.on('error', reject);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function main() {
  try {
    await startServer();
    const url = `http://localhost:${PORT}`;
    
    console.log('Running expectation-driven execution verification...');
    console.log(`URL: ${url}`);
    console.log(`Manifest: ${manifestPath}\n`);
    
    const result = await scan(staticSiteDir, url, manifestPath);
    
    const observation = result.observation;
    const _findings = result.findings;
    
    // Extract metrics
    const expectationExecution = observation.expectationExecution || {};
    const totalProven = expectationExecution.totalProvenExpectations || 0;
    const executedCount = expectationExecution.executedCount || 0;
    const coverageGapsCount = expectationExecution.coverageGapsCount || 0;
    
    // Count outcomes
    const results = expectationExecution.results || [];
    const verifiedCount = results.filter(r => r.outcome === 'VERIFIED').length;
    const silentFailureCount = results.filter(r => r.outcome === 'SILENT_FAILURE').length;
    const coverageGapCount = results.filter(r => r.outcome === 'COVERAGE_GAP').length;
    const budgetExceededCount = results.filter(r => r.reason === 'budget_exceeded').length;
    
    // Check assertion
    let assertCheck = 'PASSED';
    try {
      if (executedCount !== totalProven) {
        assertCheck = `FAILED: Expected ${totalProven} executed but got ${executedCount}`;
      }
      if (budgetExceededCount > 0) {
        assertCheck = `FAILED: Found ${budgetExceededCount} executed expectations with budget_exceeded (should be 0)`;
      }
    } catch (error) {
      assertCheck = `FAILED: ${error.message}`;
    }
    
    console.log('\n=== VERIFICATION RESULTS ===');
    console.log(`provenExpectationsTotal: ${totalProven}`);
    console.log(`verifiedCount: ${verifiedCount}`);
    console.log(`silentFailureCount: ${silentFailureCount}`);
    console.log(`coverageGapCount: ${coverageGapCount}`);
    console.log(`budgetExceededCount: ${budgetExceededCount}`);
    console.log(`assertCheck: ${assertCheck}`);
    console.log(`\nexecutedCount: ${executedCount}`);
    console.log(`coverageGapsCount: ${coverageGapsCount}`);
    
    // Show individual results
    console.log('\n=== INDIVIDUAL EXPECTATION RESULTS ===');
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.expectationId || `exp-${i}`}: ${r.outcome}${r.reason ? ` (${r.reason})` : ''}`);
    });
    
    await stopServer();
    
    // Exit with error if assertion failed
    if (assertCheck !== 'PASSED') {
      process.exit(1);
    }
    
    // Require at least one VERIFIED and one SILENT_FAILURE
    if (verifiedCount < 1 || silentFailureCount < 1) {
      console.log('\n⚠️  WARNING: Expected at least 1 VERIFIED and 1 SILENT_FAILURE');
      console.log(`   Got: ${verifiedCount} VERIFIED, ${silentFailureCount} SILENT_FAILURE`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    await stopServer();
    process.exit(1);
  }
}

main();

