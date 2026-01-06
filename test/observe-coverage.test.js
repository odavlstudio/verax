import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { scan } from '../src/verax/index.js';

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

test('interaction coverage is capped with prioritized ordering and warnings', { timeout: 70000 }, async () => {
  const projectDir = createTempDir();
  try {
    writeCoverageFixture(projectDir);
    const url = `file://${join(projectDir, 'index.html').replace(/\\/g, '/')}`;

    const result = await scan(projectDir, url);

    const observationPath = result.observation.tracesPath;
    const summaryPath = result.scanSummary.summaryPath;

    const tracesContent = JSON.parse(readFileSync(observationPath, 'utf-8'));
    const summaryContent = JSON.parse(readFileSync(summaryPath, 'utf-8'));

    const selectedSelectors = tracesContent.traces.slice(0, 5).map(t => t.interaction.selector);
    const expectedStart = ['#form1-submit', '#form2-submit', '#internal-link-0', '#internal-link-1', '#internal-link-2'];
    assert.deepStrictEqual(selectedSelectors, expectedStart, 'Prioritized selection should choose forms and internal links first');

    const coverage = summaryContent.truth.observe.coverage;
    assert.ok(coverage, 'Coverage stats should be present');
    assert.strictEqual(coverage.capped, true);
    assert.strictEqual(coverage.cap, 30);
    assert.ok(coverage.candidatesDiscovered > coverage.cap, 'Should discover more than cap');
    assert.strictEqual(coverage.candidatesSelected, 30, 'Should select exactly cap interactions');

    const warnings = summaryContent.truth.observe.warnings || [];
    const cappedWarning = warnings.find(w => w.code === 'INTERACTIONS_CAPPED');
    assert.ok(cappedWarning, 'INTERACTIONS_CAPPED warning should be emitted');
  } finally {
    cleanup(projectDir);
  }
});
