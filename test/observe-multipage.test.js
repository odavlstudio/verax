import { test } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { observe } from '../src/verax/observe/index.js';
import { createScanBudget } from '../src/verax/shared/scan-budget.js';
import { generateRunId } from '../src/verax/shared/artifact-manager.js';

function createTempDir() {
  const dir = resolve(tmpdir(), `verax-multipage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('multi-page traversal visits all reachable pages and executes interactions', async () => {
  const projectDir = createTempDir();
  try {
    const page1 = `<!DOCTYPE html><html><body>
      <a id="link-to-page2" href="./page2.html">Go to page 2</a>
      <button id="page1-btn">Page1 Btn</button>
    </body></html>`;
    const page2 = `<!DOCTYPE html><html><body>
      <button id="page2-btn">Page2 Btn</button>
      <a id="link-back" href="./page1.html">Back</a>
    </body></html>`;

    writeFileSync(join(projectDir, 'page1.html'), page1);
    writeFileSync(join(projectDir, 'page2.html'), page2);

    const startUrl = `file://${join(projectDir, 'page1.html').replace(/\\/g, '/')}`;
    const budget = createScanBudget({ 
      maxPages: 10, 
      maxScanDurationMs: 120000,
      navigationTimeoutMs: 3000,
      interactionTimeoutMs: 3000
    });
     const runId = generateRunId();
     const observation = await observe(startUrl, null, budget, {}, projectDir, runId);

    const selectors = observation.traces.map(t => t.interaction.selector);
    assert.ok(selectors.find(s => s.includes('link-to-page2')), 'Should click link to page 2');
    assert.ok(selectors.find(s => s.includes('page1-btn')), 'Should execute page 1 button');
    assert.ok(selectors.find(s => s.includes('page2-btn')), 'Should execute page 2 button');

    const coverage = observation.coverage;
    assert.ok(coverage.pagesVisited >= 2, 'Should visit at least two pages');
    assert.ok(coverage.pagesDiscovered >= 2, 'Should discover at least two pages');
    assert.strictEqual(coverage.capped, false, 'Traversal should not be capped');
  } finally {
    cleanup(projectDir);
  }
});
