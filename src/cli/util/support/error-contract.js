/**
 * VERAX Error Contract
 * 
 * Central error handling for transparent, deterministic error reporting.
 * No silent failures. Every error must have:
 * - code: machine-readable error identifier
 * - message: human-readable explanation
 * - context: relevant diagnostic data (JSON-safe, bounded)
 * - isOperational: true if expected/recoverable, false if bug
 * 
 * RULES:
 * - Never create errors without explicit code and message
 * - Keep context small (< 5KB) and meaningful
 * - No random IDs - use deterministic codes
 * - JSON output must be deterministic for testing
 */

import { EXIT_CODES } from '../../../verax/shared/exit-codes.js';

export class VeraxError extends Error {
  constructor(options = {}) {
    const {
      code = 'UNKNOWN_ERROR',
      message = 'An unknown error occurred',
      cause = null,
      context = {},
      isOperational = false
    } = options;

    super(message);
    this.name = 'VeraxError';
    this.code = code;
    this.cause = cause;
    this.context = context;
    this.isOperational = isOperational;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, VeraxError.prototype);
  }
}

/**
 * Create an operational error (expected, handled)
 * @param {string} code - Error code (e.g., 'INVALID_CONFIG', 'FILE_NOT_FOUND')
 * @param {string} message - Human-readable message
 * @param {object} context - Optional diagnostic context
 * @param {Error} cause - Optional underlying error
 * @returns {VeraxError}
 */
export function veraxOperational(code, message, context, cause) {
  return new VeraxError({
    code,
    message,
    context: context || {},
    cause,
    isOperational: true
  });
}

/**
 * Create a bug error (unexpected, likely crash)
 * @param {string} code - Error code (e.g., 'BUG_INVALID_STATE', 'BUG_NULL_REFERENCE')
 * @param {string} message - Human-readable message
 * @param {object} context - Optional diagnostic context
 * @param {Error} cause - Optional underlying error
 * @returns {VeraxError}
 */
export function veraxBug(code, message, context, cause) {
  return new VeraxError({
    code,
    message,
    context: context || {},
    cause,
    isOperational: false
  });
}

/**
 * Format error for human-readable console output
 * @param {Error} err
 * @param {boolean} verbose - If true, include stack trace
 * @returns {string}
 */
export function formatErrorForHumans(err, verbose = false) {
  if (!err) return 'Unknown error';

  if (err instanceof VeraxError) {
    let output = `Error: ${err.message}`;
    if (err.code) {
      output += ` [${err.code}]`;
    }
    if (verbose && err.stack) {
      output += `\n${err.stack}`;
    }
    if (verbose && err.context && Object.keys(err.context).length > 0) {
      output += `\nContext: ${JSON.stringify(err.context, null, 2)}`;
    }
    if (verbose && err.cause) {
      output += `\nCause: ${err.cause.message}`;
    }
    return output;
  }

  // Non-VeraxError
  let output = `Error: ${err.message || String(err)}`;
  if (verbose && err.stack) {
    output += `\n${err.stack}`;
  }
  return output;
}

/**
 * Format error for JSON output (deterministic, structured)
 * @param {Error} err
 * @returns {object}
 */
export function formatErrorForJson(err) {
  if (!err) {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error',
      context: {}
    };
  }

  if (err instanceof VeraxError) {
    const output = {
      code: err.code,
      message: err.message,
      isOperational: err.isOperational,
      context: err.context || {}
    };

    if (err.cause) {
      output.causeMessage = err.cause.message;
      output.causeCode = err.cause.code || undefined;
    }

    return output;
  }

  // Non-VeraxError: wrap it
  return {
    code: 'EXTERNAL_ERROR',
    message: err.message || String(err),
    causeMessage: err.stack ? err.stack.split('\n')[0] : undefined,
    context: {}
  };
}

/**
 * Check if an error is operational (recoverable)
 * @param {Error} err
 * @returns {boolean}
 */
export function isOperationalError(err) {
  if (err instanceof VeraxError) {
    return err.isOperational;
  }
  return false;
}

/**
 * Exit code for an error
 * @param {Error} err
 * @returns {number}
 */
export function exitCodeForError(err) {
  if (!err) return EXIT_CODES.INVARIANT_VIOLATION;

  if (err instanceof VeraxError) {
    // Operational errors → usage/data categories
    if (err.isOperational) {
      // Some codes map to specific exit codes
      if (err.code.startsWith('USAGE_')) return EXIT_CODES.USAGE_ERROR;
      return EXIT_CODES.INVARIANT_VIOLATION;
    }
    // Bugs → invariant violation (internal crash)
    return EXIT_CODES.INVARIANT_VIOLATION;
  }

  // Unknown errors → invariant violation
  return EXIT_CODES.INVARIANT_VIOLATION;
}
