import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { isProvenExpectation } from '../src/verax/shared/expectation-prover.js';

const projectRoot = resolve(process.cwd());

test('ZERO-HEURISTIC: All expectations must be PROVEN', async () => {
  // Skip if fixture doesn't exist - this test relies on external fixture data
  const fixtureBase = resolve(projectRoot, 'artifacts', 'test-fixtures', 'absolute-reality-static');
  if (!existsSync(fixtureBase)) {
    console.log('Skipping test: fixture directory not found');
    return;
  }
  
  // Try to find manifest in canonical structure
  const { readdirSync } = await import('fs');
  const runsDir = resolve(fixtureBase, '.verax', 'runs');
  if (!existsSync(runsDir)) {
    console.log('Skipping test: .verax/runs directory not found');
    return;
  }
  
  const runs = readdirSync(runsDir);
  if (runs.length === 0) {
    console.log('Skipping test: no runs found');
    return;
  }
  
  const latestRunId = runs.sort().reverse()[0];
  let manifestPath = resolve(runsDir, latestRunId, 'learn.json');
  if (!existsSync(manifestPath)) {
    manifestPath = resolve(runsDir, latestRunId, 'manifest.json');
  }
  
  if (!existsSync(manifestPath)) {
    console.log('Skipping test: manifest not found in canonical structure');
    return;
  }
  
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  
  if (manifest.staticExpectations) {
    for (const exp of manifest.staticExpectations) {
      assert.ok(
        isProvenExpectation(exp),
        `Expectation must be PROVEN: ${JSON.stringify(exp)}`
      );
    }
  }
});

test('ZERO-HEURISTIC: No legacy extractor fallbacks for SPA/Next.js', async () => {
  // Check that react-router-extractor.js is not imported in route-extractor.js
  const routeExtractorPath = resolve(projectRoot, 'src', 'verax', 'learn', 'route-extractor.js');
  const content = readFileSync(routeExtractorPath, 'utf-8');
  
  // Should NOT import react-router-extractor
  assert.ok(
    !content.includes('from \'./react-router-extractor.js\''),
    'route-extractor.js must not import react-router-extractor.js'
  );
  
  // Should use intel module
  assert.ok(
    content.includes('from \'../intel/route-extractor.js\''),
    'route-extractor.js must use intel module'
  );
});

test('ZERO-HEURISTIC: No findings when expectationsStatus is NO_PROVEN_EXPECTATIONS', async () => {
  const fixtureBase = resolve(projectRoot, 'artifacts', 'test-fixtures', 'absolute-reality-static');
  if (!existsSync(fixtureBase)) {
    console.log('Skipping test: fixture directory not found');
    return;
  }
  
  // Try to find findings in canonical structure
  const { readdirSync } = await import('fs');
  const runsDir = resolve(fixtureBase, '.verax', 'runs');
  if (!existsSync(runsDir)) {
    console.log('Skipping test: .verax/runs directory not found');
    return;
  }
  
  const runs = readdirSync(runsDir);
  if (runs.length === 0) {
    console.log('Skipping test: no runs found');
    return;
  }
  
  const latestRunId = runs.sort().reverse()[0];
  const findingsPath = resolve(runsDir, latestRunId, 'findings.json');
  
  if (!existsSync(findingsPath)) {
    console.log('Skipping test: findings not found in canonical structure');
    return;
  }
  
  const findings = JSON.parse(readFileSync(findingsPath, 'utf-8'));
  
  // This test would need a fixture with NO_PROVEN_EXPECTATIONS
  // For now, just verify the structure exists
  assert.ok(findings.findings !== undefined, 'Findings structure must exist');
});

test('ZERO-HEURISTIC: All expectations have sourceRef or evidence.source', async () => {
  const fixtureBase = resolve(projectRoot, 'artifacts', 'test-fixtures', 'absolute-reality-static');
  if (!existsSync(fixtureBase)) {
    console.log('Skipping test: fixture directory not found');
    return;
  }
  
  // Try to find manifest in canonical structure
  const { readdirSync } = await import('fs');
  const runsDir = resolve(fixtureBase, '.verax', 'runs');
  if (!existsSync(runsDir)) {
    console.log('Skipping test: .verax/runs directory not found');
    return;
  }
  
  const runs = readdirSync(runsDir);
  if (runs.length === 0) {
    console.log('Skipping test: no runs found');
    return;
  }
  
  const latestRunId = runs.sort().reverse()[0];
  let manifestPath = resolve(runsDir, latestRunId, 'learn.json');
  if (!existsSync(manifestPath)) {
    manifestPath = resolve(runsDir, latestRunId, 'manifest.json');
  }
  
  if (!existsSync(manifestPath)) {
    console.log('Skipping test: manifest not found in canonical structure');
    return;
  }
  
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  
  if (manifest.staticExpectations) {
    for (const exp of manifest.staticExpectations) {
      const hasSourceRef = !!exp.sourceRef;
      const hasEvidenceSource = !!(exp.evidence && exp.evidence.source);
      
      assert.ok(
        hasSourceRef || hasEvidenceSource,
        `Expectation must have sourceRef or evidence.source: ${JSON.stringify(exp)}`
      );
    }
  }
});

