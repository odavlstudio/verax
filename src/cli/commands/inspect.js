/*
Command: verax inspect
Purpose: Validate and summarize an existing run directory without modifying artifacts.
Required: <runPath>
Optional: --json
Outputs: Exactly one RESULT/REASON/ACTION block (JSON or text) plus optional JSON payload of run metadata.
Exit Codes: 0 SUCCESS | 50 EVIDENCE_LAW_VIOLATION | 40 INFRA_FAILURE | 64 USAGE_ERROR
Forbidden: artifact mutation; multiple RESULT/REASON/ACTION blocks; unsupported flags; non-deterministic logs without --debug.
*/

import { resolve } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { DataError, UsageError } from '../util/support/errors.js';
import { MANIFEST_FILENAME, verifyRunIntegrityManifest } from '../util/evidence/integrity-manifest.js';
import { buildOutcome, EXIT_CODES } from '../config/cli-contract.js';

export async function inspectCommand(runPath, options = {}) {
  const { json: _json = false } = options;
  
  if (!runPath) {
    throw new UsageError('inspect requires <runPath> argument');
  }

  const fullPath = resolve(runPath);
  
  if (!existsSync(fullPath)) {
    throw new DataError(`Run directory not found: ${fullPath}`);
  }
  
  const requiredFiles = ['summary.json', 'findings.json'];
  const missingFiles = [];
  
  for (const file of requiredFiles) {
    const filePath = `${fullPath}/${file}`;
    if (!existsSync(filePath)) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    throw new DataError(`Invalid run directory. Missing files: ${missingFiles.join(', ')}`);
  }
  
  let summary;
  let findings;
  
  try {
    summary = JSON.parse(readFileSync(`${fullPath}/summary.json`, 'utf-8').toString());
  } catch (error) {
    throw new DataError(`Failed to parse summary.json: ${error.message}`);
  }
  
  try {
    findings = JSON.parse(readFileSync(`${fullPath}/findings.json`, 'utf-8').toString());
  } catch (error) {
    throw new DataError(`Failed to parse findings.json: ${error.message}`);
  }
  
  const evidenceDir = `${fullPath}/evidence`;
  const hasEvidence = existsSync(evidenceDir);
  let evidenceCount = 0;
  
  if (hasEvidence) {
    try {
      evidenceCount = readdirSync(evidenceDir).sort((a, b) => a.localeCompare(b, 'en')).length;
    } catch {
      evidenceCount = 0;
    }
  }
  
  const findingsCount = (() => {
    if (Array.isArray(findings)) return findings.length;
    if (Array.isArray(findings?.findings)) return findings.findings.length;
    if (typeof findings?.total === 'number') return findings.total;
    return 0;
  })();

  const summaryCount = (() => {
    if (typeof summary?.findingsCount === 'number') return summary.findingsCount;
    if (summary?.findingsCounts) {
      return Object.values(summary.findingsCounts).reduce((acc, val) => acc + (typeof val === 'number' ? val : 0), 0);
    }
    if (summary?.observations?.discrepanciesObserved !== undefined) {
      return summary.observations.discrepanciesObserved;
    }
    return null;
  })();

  const warnings = [];
  if (summaryCount !== null && summaryCount !== findingsCount) {
    warnings.push(`findings.json count (${findingsCount}) differs from summary (${summaryCount})`);
  }

  const manifestPath = `${fullPath}/${MANIFEST_FILENAME}`;
  let integrityResult = {
    status: 'MISSING',
    missing: [],
    mismatched: [],
    extraArtifacts: [],
  };
  
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8').toString());
      integrityResult = verifyRunIntegrityManifest(fullPath, manifest);
    } catch (error) {
      integrityResult = {
        status: 'FAILED',
        missing: [],
        mismatched: [],
        extraArtifacts: [],
        error: error.message,
      };
    }
  }
  
  const output = {
    runId: summary.runId || 'unknown',
    status: summary.status || 'unknown',
    startedAt: summary.startedAt || null,
    completedAt: summary.completedAt || null,
    url: summary.url || null,
    findingsCount,
    evidenceDir: hasEvidence ? evidenceDir : null,
    evidenceFileCount: evidenceCount,
    warnings,
    integrity: integrityResult,
  };

  const evidenceIssues = integrityResult.status !== 'OK' && integrityResult.status !== 'MISSING' ? true : false;
  const exitCode = evidenceIssues ? EXIT_CODES.EVIDENCE_VIOLATION : EXIT_CODES.SUCCESS;
  const reason = evidenceIssues
    ? 'Artifacts failed integrity validation'
    : `Run ${output.status} with ${output.findingsCount} findings`;
  const action = evidenceIssues
    ? `Repair or regenerate run artifacts in ${fullPath}`
    : `Review findings in ${fullPath}`;

  const outcome = buildOutcome({
    command: 'inspect',
    exitCode,
    reason,
    action,
  });

  return { outcome, jsonPayload: output };
}



