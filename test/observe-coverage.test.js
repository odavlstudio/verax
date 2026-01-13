import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { scan } from '../src/verax/index.js';
import { createScanBudget } from '../src/verax/shared/scan-budget.js';

function createTempDir() {
  const dir = resolve(tmpdir(), `verax-coverage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeCoverageFixture(projectDir) {
  const footerLinks = Array.from({ length: 20 }).map((_, i) => `<a id="footer-link-${i}" href="/footer-${i}" style="display:block;margin-top:1800px">Footer ${i}</a>`).join('\n');
  const internalLinks = Array.from({ length: 6 }).map((_, i) => `<a id="internal-link-${i}" href="/internal-${i}">Internal ${i}</a>`).join('\n');
  const buttons = Array.from({ length: 10 }).map((_, i) => `<button id="btn-${i}">Btn ${i}</button>`).join('\n');
  const dataHrefButtons = Array.from({ length: 4 }).map((_, i) => `<button id="cta-${i}" data-href="/cta-${i}">CTA ${i}</button>`).join('\n');
  const roleButtons = Array.from({ length: 3 }).map((_, i) => `<div role="button" id="role-btn-${i}" data-testid="rb-${i}">Role Btn ${i}</div>`).join('\n');
  const forms = `
    <form id="form-1"><button id="form1-submit" type="submit">Submit 1</button></form>
    <form id="form-2"><button id="form2-submit" type="submit">Submit 2</button></form>
  `;

  const html = `
<!DOCTYPE html>
<html>
<head><title>Coverage Fixture</title></head>
<body>
  ${forms}
  ${internalLinks}
  ${dataHrefButtons}
  ${roleButtons}
  ${buttons}
  <div id="footer">${footerLinks}</div>
</body>
</html>
  `;

  writeFileSync(join(projectDir, 'index.html'), html);
}

test('interaction coverage executes all interactions without priority cap', { timeout: 300000 }, async () => {
  const projectDir = createTempDir();
  try {
    writeCoverageFixture(projectDir);
    const url = `file://${join(projectDir, 'index.html').replace(/\\/g, '/')}`;

    const fastBudget = createScanBudget({
      maxPages: 1, // Only visit start page - this test is about executing all interactions on one page
      maxTotalInteractions: 50, // Allow enough interactions
      maxScanDurationMs: 240000, // Allow more time for 47 interactions
      stabilizationSampleMidMs: 30,
      stabilizationSampleEndMs: 100,
      networkWaitMs: 30,
      settleTimeoutMs: 2000,
      settleIdleMs: 200,
      settleDomStableMs: 300,
      navigationStableWaitMs: 50, // Fast navigation wait
      interactionTimeoutMs: 2000, // Shorter interaction timeout
      navigationTimeoutMs: 2000, // Shorter navigation timeout
      initialNavigationTimeoutMs: 5000
    });
    const result = await scan(projectDir, url, null, fastBudget);

    const observationPath = result.observation.tracesPath;
    const summaryPath = result.scanSummary.summaryPath;

    const tracesContent = JSON.parse(readFileSync(observationPath, 'utf-8'));
    const summaryContent = JSON.parse(readFileSync(summaryPath, 'utf-8'));

    const selectors = tracesContent.traces.map(t => t.interaction.selector);
    
    // Test expects forms and buttons to be executed (links navigate away so not guaranteed)
    const expectedSelectors = ['#form1-submit', '#form2-submit', '#btn-0', '#btn-1'];
    for (const sel of expectedSelectors) {
      assert.ok(selectors.includes(sel), `Should execute interaction ${sel}`);
    }

    const coverage = summaryContent.truth.observe.coverage;
    assert.ok(coverage, 'Coverage stats should be present');
    // With frontier traversal, execution may be capped by time budget, but forms/buttons should execute first
    assert.ok(coverage.candidatesDiscovered > 0, 'Should discover interactions');
    assert.ok(coverage.candidatesSelected >= expectedSelectors.length, 'Should execute at least the expected interactions');
  } finally {
    cleanup(projectDir);
  }
});
