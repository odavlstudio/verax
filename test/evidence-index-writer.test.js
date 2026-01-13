import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { writeEvidenceIndex } from '../src/verax/detect/evidence-index.js';
import { generateRunId } from '../src/verax/shared/artifact-manager.js';

test('evidence index contains paths for all findings', async () => {
  const projectDir = mkdtempSync(join(tmpdir(), 'verax-evidence-'));
  const runId = generateRunId();
  const runDir = resolve(projectDir, '.verax', 'runs', runId);
  const evidenceDir = resolve(runDir, 'evidence');
  const screenshotsDir = resolve(evidenceDir, 'screenshots');
  mkdirSync(screenshotsDir, { recursive: true });

  const beforeRel = 'before.png';
  const afterRel = 'after.png';
  writeFileSync(resolve(screenshotsDir, beforeRel), 'a');
  writeFileSync(resolve(screenshotsDir, afterRel), 'b');

  const tracesPath = resolve(runDir, 'observation-traces.json');
  writeFileSync(tracesPath, '{}');
  const findingsPath = resolve(runDir, 'findings.json');
  writeFileSync(findingsPath, '{}');

  const evidenceIndex = [
    {
      id: 'trace-0',
      expectationId: 'exp-1',
      interaction: { selector: '#nav' },
      resultType: 'UNKNOWN',
      evidence: {
        beforeUrl: null,
        afterUrl: null,
        beforeScreenshot: resolve(screenshotsDir, beforeRel),
        afterScreenshot: resolve(screenshotsDir, afterRel)
      }
    }
  ];

  const evidenceIndexPath = await writeEvidenceIndex(projectDir, evidenceIndex, tracesPath, findingsPath, runDir);
  const content = JSON.parse(readFileSync(evidenceIndexPath, 'utf-8'));

  assert.ok(evidenceIndexPath.endsWith('evidence-index.json'));
  assert.strictEqual(content.evidence.length, evidenceIndex.length);
  const item = content.evidence[0];
  assert.strictEqual(item.id, 'trace-0');
  assert.ok(item.evidence.beforeScreenshot.endsWith('before.png'));
  assert.ok(item.evidence.afterScreenshot.endsWith('after.png'));
  assert.strictEqual(item.evidence.traceFile, tracesPath);
});
