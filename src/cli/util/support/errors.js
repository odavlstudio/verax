/**
 * CLI Error System (Stage 7)
 * Exit code mapping aligns with the CLI contract:
 * - 50: invariant violation (internal error, evidence/data violation)
 * - 64: invalid CLI usage
 */

import { EXIT_CODES } from '../../../verax/shared/exit-codes.js';

export class CLIError extends Error {
  /**
   * @param {string} message
   * @param {number} [exitCode]
   * @param {string} [action]
   */
  constructor(message, exitCode = EXIT_CODES.INVARIANT_VIOLATION, action = 'Re-run with --debug for stack trace') {
    super(message);
    this.name = 'CLIError';
    this.exitCode = exitCode;
    this.action = action;
  }
}

export class UsageError extends CLIError {
  constructor(message) {
    super(message, EXIT_CODES.USAGE_ERROR, 'Fix CLI usage and retry');
    this.name = 'UsageError';
  }
}

export class DataError extends CLIError {
  constructor(message) {
    super(message, EXIT_CODES.INVARIANT_VIOLATION, 'Repair or regenerate required artifacts');
    this.name = 'DataError';
  }
}

export class CrashError extends CLIError {
  constructor(message) {
    super(message, EXIT_CODES.INVARIANT_VIOLATION, 'Re-run with --debug for stack trace');
    this.name = 'CrashError';
  }
}

export class IncompleteError extends CLIError {
  constructor(message, action = 'Increase coverage or rerun with higher budget') {
    super(message, EXIT_CODES.INCOMPLETE, action);
    this.name = 'IncompleteError';
  }
}

export function getExitCode(error) {
  if (error instanceof CLIError) {
    return error.exitCode;
  }
  return EXIT_CODES.INVARIANT_VIOLATION;
}



