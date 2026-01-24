/**
 * CLI Error System (Stage 7)
 * Exit code mapping aligns with the CLI contract:
 * - 40: infra/runtime failure
 * - 50: evidence/data violation
 * - 64: invalid CLI usage
 */

export class CLIError extends Error {
  constructor(message, exitCode = 40, action = 'Re-run with --debug for stack trace') {
    super(message);
    this.name = 'CLIError';
    this.exitCode = exitCode;
    this.action = action;
  }
}

export class UsageError extends CLIError {
  constructor(message) {
    super(message, 64, 'Fix CLI usage and retry');
    this.name = 'UsageError';
  }
}

export class DataError extends CLIError {
  constructor(message) {
    super(message, 50, 'Repair or regenerate required artifacts');
    this.name = 'DataError';
  }
}

export class CrashError extends CLIError {
  constructor(message) {
    super(message, 40, 'Re-run with --debug for stack trace');
    this.name = 'CrashError';
  }
}

export class IncompleteError extends CLIError {
  constructor(message, action = 'Increase coverage or rerun with higher budget') {
    super(message, 30, action);
    this.name = 'IncompleteError';
  }
}

export function getExitCode(error) {
  if (error instanceof CLIError) {
    return error.exitCode;
  }
  return 40; // default to infra/runtime failure
}



