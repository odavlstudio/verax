/**
 * CLI Contract — Stage 7
 *
 * Single source of truth for exit codes and RESULT/REASON/ACTION output.
 * All commands must emit exactly one RESULT, one REASON, and one ACTION line
 * unless the caller requests JSON streaming output.
 */

import { UsageError, DataError, CLIError } from '../util/support/errors.js';
import { formatErrorForHumans } from '../util/support/error-contract.js';

/**
 * @typedef {object} OutcomeParams
 * @property {string} [command]
 * @property {number} exitCode
 * @property {string} [result]
 * @property {string} reason
 * @property {string} action
 */

export const EXIT_CODES = {
  SUCCESS: 0,
  NEEDS_REVIEW: 10,
  FAILURE_CONFIRMED: 20,
  FAILURE_INCOMPLETE: 30,
  INFRA_FAILURE: 40,
  EVIDENCE_VIOLATION: 50,
  USAGE_ERROR: 64,
};

const RESULT_LABELS = {
  [EXIT_CODES.SUCCESS]: 'SUCCESS',
  [EXIT_CODES.NEEDS_REVIEW]: 'NEEDS_REVIEW',
  [EXIT_CODES.FAILURE_CONFIRMED]: 'FAILURE_CONFIRMED',
  [EXIT_CODES.FAILURE_INCOMPLETE]: 'INCOMPLETE',
  [EXIT_CODES.INFRA_FAILURE]: 'INFRA_FAILURE',
  [EXIT_CODES.EVIDENCE_VIOLATION]: 'EVIDENCE_LAW_VIOLATION',
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
  return EXIT_CODES.INFRA_FAILURE;
}

function defaultActionForExit(exitCode) {
  switch (exitCode) {
    case EXIT_CODES.SUCCESS:
      return 'Proceed';
    case EXIT_CODES.NEEDS_REVIEW:
      return 'Review findings and confirm';
    case EXIT_CODES.FAILURE_CONFIRMED:
      return 'Address findings and rerun';
    case EXIT_CODES.FAILURE_INCOMPLETE:
      return 'Increase coverage or rerun with higher budget';
    case EXIT_CODES.EVIDENCE_VIOLATION:
      return 'Repair or regenerate required artifacts';
    case EXIT_CODES.USAGE_ERROR:
      return 'Fix CLI usage and retry';
    case EXIT_CODES.INFRA_FAILURE:
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
}) {
  const normalizedExit = Number.isFinite(exitCode) ? normalizeExitCode(exitCode) : EXIT_CODES.INFRA_FAILURE;
  return {
    command: command || 'verax',
    exitCode: normalizedExit,
    result: result || RESULT_LABELS[normalizedExit] || 'UNKNOWN',
    reason: sanitize(reason) || 'No reason provided',
    action: sanitize(action) || 'No action provided',
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
    })}\n`);
    return;
  }

  stream.write(`RESULT ${outcome.result}\n`);
  stream.write(`REASON ${outcome.reason}\n`);
  stream.write(`ACTION ${outcome.action}\n`);
}

export function outcomeFromError(error, { command = 'verax' } = {}) {
  if (!error) {
    return buildOutcome({
      command,
      exitCode: EXIT_CODES.INFRA_FAILURE,
      reason: 'Unknown error',
      action: defaultActionForExit(EXIT_CODES.INFRA_FAILURE),
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
    const exitCode = EXIT_CODES.EVIDENCE_VIOLATION;
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
