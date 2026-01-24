/*
Command: verax gate
Purpose: Execute a VERAX run and emit a deterministic release gate decision.
Required: --url <url>
Optional: --src, --out, --json, --debug/--verbose, --auth-storage, --auth-cookie, --auth-header, --auth-mode, --fail-on-incomplete.
Outputs: gate.json alongside run artifacts plus exactly one RESULT/REASON/ACTION block (JSON or text) summarizing the gate decision.
Exit Codes:
- 0  SUCCESS (gate pass)
- 10 NEEDS_REVIEW
- 20 FAILURE_CONFIRMED
- 30 FAILURE_INCOMPLETE
- 40 INFRA_FAILURE
- 50 EVIDENCE_LAW_VIOLATION
- 64 USAGE_ERROR
Forbidden: duplicate RESULT blocks; silent gate report omissions; unsupported flags; partial run reuse or missing gate.json.
*/

import { join } from 'path';
import { analyzeRun, computeGateDecision, generateGateReport, writeGateReport } from '../../verax/gate-engine.js';
import { buildOutcome, EXIT_CODES, outcomeFromError } from '../config/cli-contract.js';
import { UsageError, DataError } from '../util/support/errors.js';

export async function gateCommand(options = {}) {
  const {
    url,
    projectRoot = '.',
    json: _json = false,
    failOnIncomplete = true,
    // Pass-through run options
    src = '.',
    out = '.verax',
    verbose = false,
    debug = false,
    authConfig = {},
  } = options;

  if (!url) {
    throw new UsageError('gate requires --url <url>');
  }

  const mergedAuthConfig = Object.keys(authConfig || {}).length > 0 ? authConfig : {
    authStorage: options.authStorage || null,
    authStorageState: options.authStorageState,
    authCookies: options.authCookies || [],
    authHeaders: options.authHeaders || [],
    authMode: options.authMode || 'auto',
  };

  try {
    const { runCommand } = await import('./run.js');

    const runResult = await runCommand({
      url,
      projectRoot,
      src,
      out,
      json: false,
      verbose,
      debug,
      authConfig: mergedAuthConfig,
      retainRuns: 10,
      noRetention: false,
    });

    const runExitCode = runResult?.exitCode ?? EXIT_CODES.INFRA_FAILURE;
    const runId = runResult?.runId;
    const runDir = runResult?.paths?.baseDir;

    if (!runId || !runDir) {
      throw new DataError('Could not determine run artifacts for gate evaluation');
    }

    const analysis = await analyzeRun(projectRoot, runId, {
      failOnIncomplete,
      runExitCode,
      runDir,
    });

    const decision = computeGateDecision(analysis);
    const report = generateGateReport(analysis, decision);
    writeGateReport(analysis.runDir, report);

    const outcome = buildOutcome({
      command: 'gate',
      exitCode: decision.exitCode,
      reason: decision.reason,
      action: `Inspect gate report at ${join(analysis.runDir, 'gate.json')}`,
    });

    const jsonPayload = {
      type: 'gate-complete',
      runId,
      decision: decision.outcome,
      reason: decision.reason,
      exitCode: decision.exitCode,
      findings: report.findings,
      stability: report.stability,
      triage: report.triage,
    };

    return { outcome, jsonPayload };
  } catch (error) {
    const outcome = outcomeFromError(error, { command: 'gate' });
    const jsonPayload = {
      type: 'gate-error',
      error: error.message,
    };
    return { outcome, jsonPayload };
  }
}
