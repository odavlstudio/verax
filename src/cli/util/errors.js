/**
 * CLI Error System
 * Maps errors to exit codes:
 * - 0: success (tool executed)
 * - 2: internal crash
 * - 64: invalid CLI usage
 * - 65: invalid input data
 */

export class CLIError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = 'CLIError';
    this.exitCode = exitCode;
  }
}

export class UsageError extends CLIError {
  constructor(message) {
    super(message, 64);
    this.name = 'UsageError';
  }
}

export class DataError extends CLIError {
  constructor(message) {
    super(message, 65);
    this.name = 'DataError';
  }
}

export class CrashError extends CLIError {
  constructor(message) {
    super(message, 2);
    this.name = 'CrashError';
  }
}

export function getExitCode(error) {
  if (error instanceof CLIError) {
    return error.exitCode;
  }
  return 2; // default to crash
}
