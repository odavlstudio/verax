import { resolve, dirname } from 'path';
import { mkdirSync } from 'fs';
import { atomicWriteJsonSync } from '../cli/util/atomic-write.js';

function resolveScreenshotPath(screenshotsDir, relativePath) {
  if (!relativePath || !screenshotsDir) return null;
  const observeDir = dirname(screenshotsDir);
  return resolve(observeDir, relativePath);
}

function findEvidenceForFinding(finding, evidenceIndex) {
  if (!Array.isArray(evidenceIndex)) return null;
  if (finding.expectationId) {
    const byExpectation = evidenceIndex.find(e => e.expectationId === finding.expectationId);
    if (byExpectation) return byExpectation;
  }
  const selector = finding.interaction?.selector;
  if (selector) {
    const bySelector = evidenceIndex.find(e => e.interaction?.selector === selector);
    if (bySelector) return bySelector;
  }
  return evidenceIndex[0] || null;
}

function buildEvidenceEntries(findings, evidenceIndex, tracesPath, screenshotsDir) {
  const seen = new Set();
  const entries = [];
  (findings || []).forEach((finding, idx) => {
    const evidence = findEvidenceForFinding(finding, evidenceIndex);
    const findingId = finding.findingId || finding.id || `finding-${idx}`;
    if (seen.has(findingId)) return;
    seen.add(findingId);
    entries.push({
      findingId,
      findingType: finding.type || 'finding',
      expectationId: finding.expectationId || null,
      interactionSelector: finding.interaction?.selector || null,
      evidenceId: evidence?.id || null,
      paths: {
        beforeScreenshot: resolveScreenshotPath(screenshotsDir, evidence?.evidence?.beforeScreenshot || null),
        afterScreenshot: resolveScreenshotPath(screenshotsDir, evidence?.evidence?.afterScreenshot || null),
        traceFile: tracesPath || null,
        networkTrace: null
      }
    });
  });
  return entries;
}

export function writeEvidenceIndex(projectDir, findings, verdict, tracesPath, screenshotsDir) {
  const artifactsDir = resolve(projectDir, 'artifacts');
  mkdirSync(artifactsDir, { recursive: true });
  const items = buildEvidenceEntries(findings, verdict?.evidenceIndex || [], tracesPath, screenshotsDir);
  const evidenceIndexPath = resolve(artifactsDir, 'evidence-index.json');
  const payload = {
    version: 1,
    tracesPath,
    items
  };
  atomicWriteJsonSync(evidenceIndexPath, payload);
  return { evidenceIndexPath, items };
}



