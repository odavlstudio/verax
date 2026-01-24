/**
 * Failures module exports
 * Central export point for failure-related types and utilities
 */

export { FAILURE_CODE, EXECUTION_PHASE, FAILURE_SEVERITY, FAILURE_CATEGORY } from './failure.types.js';
export { FailureLedger } from './failure.ledger.js';
export { errorToFailure, createIOFailure, createInternalFailure } from './failure.factory.js';
export { formatFailureSummary, getExitCodeFromLedger } from './failure-summary.js';




