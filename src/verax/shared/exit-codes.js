/**
 * VERAX Exit Codes (Official Contract)
 *
 * This module exists to keep exit codes consistent across:
 * - CLI contract (src/cli/config/cli-contract.js)
 * - Core/runtime helpers (src/verax/**)
 * - Tests
 *
 * Official set (and ONLY set):
 * - SUCCESS = 0
 * - FINDINGS = 20
 * - INCOMPLETE = 30
 * - INVARIANT_VIOLATION = 50
 * - USAGE_ERROR = 64
 */
export const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  FINDINGS: 20,
  INCOMPLETE: 30,
  INVARIANT_VIOLATION: 50,
  USAGE_ERROR: 64,
});

export const OFFICIAL_EXIT_CODE_SET = Object.freeze(new Set(Object.values(EXIT_CODES)));

