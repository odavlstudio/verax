/**
 * CLI Contract — Stage 7
 *
 * Single source of truth for exit codes and RESULT/REASON/ACTION output.
 * All commands must emit exactly one RESULT, one REASON, and one ACTION line
 * unless the caller requests JSON streaming output.
 */

import { UsageError, DataError, CLIError } from '../util/support/errors.js';
import { formatErrorForHumans } from '../util/support/error-contract.js';
import { formatTruthAsText } from '../../verax/core/truth-classifier.js';
import { EXIT_CODES as OFFICIAL_EXIT_CODES } from '../../verax/shared/exit-codes.js';

/**
 * @typedef {object} OutcomeParams
 * @property {string} [command]
 * @property {number} exitCode
 * @property {string} [result]
 * @property {string} reason
 * @property {string} action
 * @property {import('../../verax/core/truth-classifier.js').TruthResult} [truth]
 * @property {object} [digest]
 * @property {string} [runId]
 * @property {string} [url]
 * @property {boolean} [isFirstRun]
 */

export const EXIT_CODES = OFFICIAL_EXIT_CODES;

const RESULT_LABELS = {
  [EXIT_CODES.SUCCESS]: 'SUCCESS',
  [EXIT_CODES.FINDINGS]: 'FINDINGS',
  [EXIT_CODES.INCOMPLETE]: 'INCOMPLETE',
  [EXIT_CODES.INVARIANT_VIOLATION]: 'INVARIANT_VIOLATION',
  [EXIT_CODES.USAGE_ERROR]: 'USAGE_ERROR',
};

const VALID_EXIT_CODES = new Set(Object.values(EXIT_CODES));

function sanitize(value) {
  if (value === undefined || value === null) return '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text;
}

function normalizeExitCode(exitCode) {
  if (VALID_EXIT_CODES.has(exitCode)) return exitCode;
  return EXIT_CODES.INCOMPLETE;
}

function defaultActionForExit(exitCode) {
  switch (exitCode) {
    case EXIT_CODES.SUCCESS:
      return 'Proceed';
    case EXIT_CODES.FINDINGS:
      return 'Address findings and rerun';
    case EXIT_CODES.INCOMPLETE:
      return 'Increase coverage or rerun with higher budget';
    case EXIT_CODES.INVARIANT_VIOLATION:
      return 'Repair or regenerate required artifacts';
    case EXIT_CODES.USAGE_ERROR:
      return 'Fix CLI usage and retry';
    default:
      return 'Re-run with --debug for stack trace';
  }
}

/**
 * Build outcome object from parameters.
 * @param {OutcomeParams} params
 */
export function buildOutcome({
  command,
  exitCode,
  result,
  reason,
  action,
  truth,
  digest,
  runId,
  url,
  isFirstRun,
}) {
  const normalizedExit = Number.isFinite(exitCode) ? normalizeExitCode(exitCode) : EXIT_CODES.INCOMPLETE;
  return {
    command: command || 'verax',
    exitCode: normalizedExit,
    result: result || RESULT_LABELS[normalizedExit] || 'UNKNOWN',
    reason: sanitize(reason) || 'No reason provided',
    action: sanitize(action) || 'No action provided',
    // Phase 2: augment with truth-first extras
    truth: truth || null,
    digest: digest || null,
    runId: runId || null,
    url: url || null,
    isFirstRun: isFirstRun || false,
  };
}

export function emitOutcome(outcome, { json = false, stream = process.stdout } = {}) {
  if (!outcome) return;
  if (json) {
    stream.write(`${JSON.stringify({
      command: outcome.command,
      exitCode: outcome.exitCode,
      result: outcome.result,
      reason: outcome.reason,
      action: outcome.action,
      // Phase 2: include truth + digest + run meta in final JSON line
      truth: outcome.truth || null,
      digest: outcome.digest || null,
      runId: outcome.runId || null,
      url: outcome.url || null,
    })}\n`);
    return;
  }
  // Phase 2: Single concise paragraph, truth-first (but skip for first-run; use summary block instead)
  if (outcome.truth && outcome.isFirstRun !== true) {
    const paragraph = formatTruthAsText(outcome.truth);
    stream.write(`${paragraph}\n`);
  }

  // Always emit RESULT/REASON/ACTION block for contract compatibility
  stream.write(`RESULT ${outcome.result}\n`);
  stream.write(`REASON ${outcome.reason}\n`);
  stream.write(`ACTION ${outcome.action}\n`);
}

export function outcomeFromError(error, { command = 'verax' } = {}) {
  if (!error) {
    return buildOutcome({
      command,
      exitCode: EXIT_CODES.INCOMPLETE,
      reason: 'Unknown error',
      action: defaultActionForExit(EXIT_CODES.INCOMPLETE),
    });
  }

  if (error instanceof UsageError) {
    const exitCode = EXIT_CODES.USAGE_ERROR;
    return buildOutcome({
      command,
      exitCode,
      reason: error.message,
      action: error.action || defaultActionForExit(exitCode),
    });
  }

  if (error instanceof DataError) {
    const exitCode = EXIT_CODES.INVARIANT_VIOLATION;
    return buildOutcome({
      command,
      exitCode,
      reason: error.message,
      action: error.action || defaultActionForExit(exitCode),
    });
  }

  if (error instanceof CLIError) {
    const exitCode = normalizeExitCode(error.exitCode);
    return buildOutcome({
      command,
      exitCode,
      reason: error.message,
      action: error.action || defaultActionForExit(exitCode),
    });
  }

  const inferredExit = normalizeExitCode(error?.exitCode);
  const reason = formatErrorForHumans(error, false);
  return buildOutcome({
    command,
    exitCode: inferredExit,
    reason,
    action: defaultActionForExit(inferredExit),
  });
}
