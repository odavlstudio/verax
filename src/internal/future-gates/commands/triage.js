// ⚠️ FROZEN FOR V1 — Not part of VERAX v1 product guarantee
// Finding triage [ALPHA] — Not core to scan workflow.

/*
Command: verax triage [ALPHA]
Purpose: Generate incident triage report from existing run artifacts.
Required: <runId>
Optional: --json
Outputs: Exactly one RESULT/REASON/ACTION block (JSON or text) plus triage.json artifact.
Exit Codes: 0 SUCCESS | 50 EVIDENCE_VIOLATION | 40 INFRA_FAILURE | 64 USAGE_ERROR
Forbidden: run artifact mutation outside triage.json; multiple RESULT blocks; interactive prompts.
*/

import { resolve, basename } from 'path';
import { writeFileSync, existsSync } from 'fs';
import { generateTriage } from '../util/triage/triage-engine.js';
import { UsageError, DataError } from '../util/support/errors.js';
import { buildOutcome as _buildOutcome, EXIT_CODES as _EXIT_CODES } from '../config/cli-contract.js';

export async function triageCommand(options = {}) {
  const { projectRoot = process.cwd(), runId, json = false } = options;

  if (!runId) {
    throw new UsageError('triage command requires a <runId> argument');
  }

  let resolvedRunId = runId;
  let resolvedProjectRoot = projectRoot;

  if (runId.includes('/') || runId.includes('\\')) {
    const runPath = resolve(runId);
    if (!existsSync(runPath)) {
      throw new DataError(`Run directory not found: ${runPath}`);
    }
    resolvedRunId = basename(runPath);
    const parts = runPath.split(/[/\\]/);
    const veraxIndex = parts.lastIndexOf('.verax');
    if (veraxIndex > 0) {
      resolvedProjectRoot = parts.slice(0, veraxIndex).join('/');
    }
  }

  let triage;
  try {
    triage = generateTriage(resolvedProjectRoot, resolvedRunId);
  } catch (error) {
    if (error instanceof DataError) {
      throw error;
    }
    throw new Error(`Failed to generate triage report: ${error.message}`);
  }

  const runDir = resolve(resolvedProjectRoot, '.verax', 'runs', resolvedRunId);
  const triagePath = resolve(runDir, 'triage.json');
  writeFileSync(triagePath, JSON.stringify(triage, null, 2) + '\n');

  if (json) {
    console.log(JSON.stringify(triage, null, 2));
  } else {
    printTriageSummary(triage, triagePath);
  }

  return { triage, triagePath };
}

function printTriageSummary(triage, triagePath) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  VERAX Incident Triage Report');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  console.log(`Run ID:        ${triage.meta.runId}`);
  console.log(`Trust Level:   ${triage.trust.level} (confidence ${formatPercent(triage.trust.confidence)})`);
  console.log(`State:         ${triage.status.state}`);
  console.log('');

  console.log('ACTION PLAN');
  if (Array.isArray(triage.actionPlan) && triage.actionPlan.length > 0) {
    triage.actionPlan.forEach((step, idx) => {
      console.log(`  ${idx + 1}. ${step.title}`);
      if (step.rationale) {
        console.log(`     • Reason: ${step.rationale}`);
      }
      if (Array.isArray(step.evidence) && step.evidence.length > 0) {
        console.log(`     • Evidence: ${step.evidence.join(', ')}`);
      }
    });
  } else {
    console.log('  (No actions recommended)');
  }
  console.log('');

  if (triage.missingInputs?.length) {
    console.log('Missing optional artifacts:');
    for (const name of triage.missingInputs) {
      console.log(`  - ${name}`);
    }
    console.log('');
  }

  console.log(`Report written to: ${triagePath}`);
  console.log('');
}

function formatPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'unknown';
  return `${Math.round(value * 100)}%`;
}
