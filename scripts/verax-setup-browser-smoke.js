import { chromium } from 'playwright';
import { observeExpectations } from '../src/cli/util/observation/observation-engine.js';

async function main() {
  // Minimal call using the public observeExpectations API with a custom browserFactory
  const url = 'http://127.0.0.1:3456/index.html';
  const expectations = [
    {
      category: 'button',
      type: 'interaction',
      promise: { kind: 'click', value: 'Working Button' },
      source: { file: 'index.html', line: 8, column: 3 },
      selector: 'button:contains("Working Button")',
      action: 'click',
      expectedOutcome: 'ui-change',
      confidenceHint: 'low',
      id: 'exp_manual1'
    }
  ];
  const res = await observeExpectations(expectations, url, './tmp', null, {
    browserFactory: (opts) => chromium.launch({ ...opts, headless: true, timeout: 45000 })
  });
  console.log(JSON.stringify({ status: res.status, stats: res.stats }));
}

main().catch(err => { console.error(err); process.exit(1); });
