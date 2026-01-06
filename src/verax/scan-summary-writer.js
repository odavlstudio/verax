import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

export function writeScanSummary(projectDir, url, projectType, learnTruth, observeTruth, detectTruth, manifestPath, tracesPath, findingsPath) {
  const scanDir = resolve(projectDir, '.veraxverax', 'scan');
  mkdirSync(scanDir, { recursive: true });
  
  const summary = {
    version: 1,
    scannedAt: new Date().toISOString(),
    url: url,
    projectType: projectType,
    truth: {
      learn: learnTruth,
      observe: observeTruth,
      detect: detectTruth
    },
    paths: {
      manifest: manifestPath,
      traces: tracesPath,
      findings: findingsPath
    }
  };
  
  const summaryPath = resolve(scanDir, 'scan-summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  
  return {
    ...summary,
    summaryPath: summaryPath
  };
}

