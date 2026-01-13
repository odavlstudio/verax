import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { learn } from '../src/verax/learn/index.js';
import { detect } from '../src/verax/detect/index.js';

function createTempDir() {
  const dir = resolve(tmpdir(), `verax-zero-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

test('manifest-writer does not import legacy SPA expectation extractors', async () => {
  const src = readFileSync(resolve(process.cwd(), 'src', 'verax', 'learn', 'manifest-writer.js'), 'utf-8');
  assert.ok(!src.includes('extractASTContracts'), 'No legacy extractASTContracts import');
  assert.ok(!src.includes('contractsToExpectations'), 'No legacy contractsToExpectations usage');
});

test('No fallback expectations for Next.js app with no extractable effects', async () => {
  // Create a minimal Next.js App Router project with no Link/handlers to extract
  const tempDir = createTempDir();
  mkdirSync(join(tempDir, 'app'), { recursive: true });
  writeFileSync(join(tempDir, 'app', 'page.tsx'), `export default function Page(){ return <div>Home</div>; }`);
  const manifest = await learn(tempDir);
  // Zero-heuristic: no invented expectations
  assert.strictEqual(manifest.projectType, 'nextjs_app_router');
  assert.strictEqual(manifest.expectationsStatus, 'NO_PROVEN_EXPECTATIONS');
  assert.ok(!manifest.spaExpectations || manifest.spaExpectations.length === 0);
  assert.ok(Array.isArray(manifest.coverageGaps));
  assert.ok(manifest.coverageGaps.length > 0);
});

test('Detect produces 0 findings when expectationsStatus is NO_PROVEN_EXPECTATIONS', async () => {
  const tempDir = createTempDir();
  const manifestPath = join(tempDir, 'manifest.json');
  const tracesPath = join(tempDir, 'traces.json');

  // Minimal manifest with NO_PROVEN_EXPECTATIONS
  const manifest = {
    version: 1,
    projectDir: tempDir,
    projectType: 'react_spa',
    expectationsStatus: 'NO_PROVEN_EXPECTATIONS',
    codeIntelligence: { routesFound: 0, handlersFound: 0, effectsFound: 0 },
    learnedAt: new Date().toISOString()
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Minimal observation with a single interaction
  const traces = {
    url: 'http://localhost/',
    traces: [
      {
        interaction: { type: 'click', selector: '#btn', label: 'Button' },
        before: { url: 'http://localhost/', screenshot: null },
        after: { url: 'http://localhost/', screenshot: null },
        sensors: {},
        meta: {}
      }
    ]
  };
  writeFileSync(tracesPath, JSON.stringify(traces, null, 2));

  const result = await detect(manifestPath, tracesPath);
  const findingsFile = result.findingsPath;
  assert.ok(existsSync(findingsFile));
  const content = JSON.parse(readFileSync(findingsFile, 'utf-8'));
  assert.strictEqual(content.total, 0);
  assert.ok(Array.isArray(content.coverageGaps));
  assert.ok(content.coverageGaps.length > 0);
});
