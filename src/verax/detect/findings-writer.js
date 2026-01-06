import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

export function writeFindings(projectDir, url, findings) {
  const detectDir = resolve(projectDir, '.veraxverax', 'detect');
  mkdirSync(detectDir, { recursive: true });
  
  const findingsPath = resolve(detectDir, 'findings.json');
  
  const findingsReport = {
    version: 1,
    detectedAt: new Date().toISOString(),
    url: url,
    findings: findings,
    notes: []
  };
  
  writeFileSync(findingsPath, JSON.stringify(findingsReport, null, 2) + '\n');
  
  return {
    ...findingsReport,
    findingsPath: findingsPath
  };
}

