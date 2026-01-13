import { scan } from '../src/verax/index.js';
import { tmpdir } from 'os';
import { resolve, join } from 'path';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';

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

(async () => {
  const projectDir = createTempDir();
  try {
    writeCoverageFixture(projectDir);
    const url = `file://${join(projectDir, 'index.html').replace(/\\/g, '/')}`;
    const result = await scan(projectDir, url);

    const tracesContent = JSON.parse(readFileSync(result.observation.tracesPath, 'utf-8'));
    const summaryContent = JSON.parse(readFileSync(result.scanSummary.summaryPath, 'utf-8'));

    const selectedSelectors = tracesContent.traces.slice(0, 10).map(t => t.interaction.selector);
    console.log('First selectors:', selectedSelectors);
    console.log('Traces count:', tracesContent.traces.length);
    console.log('Coverage:', summaryContent.truth.observe.coverage);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    cleanup(projectDir);
  }
})();
