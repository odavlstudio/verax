/**
 * Phase 6: Enterprise Hardening - Centralized Budget Configuration
 * 
 * Explicit limits to prevent runaway execution in large repositories.
 * All limits are configurable via environment variables.
 * 
 * When exceeded → mark run INCOMPLETE (exit 30) with reason.
 * No guessing. Fail safely.
 */

/**
 * Parse integer from env var with default fallback
 * @param {string} envVar 
 * @param {number} defaultValue 
 * @returns {number}
 */
function parseEnvInt(envVar, defaultValue) {
  const val = process.env[envVar];
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) || parsed < 0 ? defaultValue : parsed;
}

/**
 * Default budget configuration
 * Tuned for enterprise repositories while maintaining forensic quality.
 */
export const DEFAULT_BUDGETS = {
  // Maximum expectations to extract per run
  // Prevents flooding from auto-generated forms, infinite scrolls, etc.
  MAX_EXPECTATIONS: 200,
  
  // Maximum interactions to execute during observation
  // Prevents runaway interaction loops
  MAX_INTERACTIONS: 150,
  
  // Maximum evidence files per finding
  // Prevents evidence bloat from repeated failures
  MAX_EVIDENCE_FILES: 10,
  
  // Maximum total runtime in milliseconds (30 minutes)
  // Hard cap to prevent hanging in CI
  MAX_RUNTIME_MS: 30 * 60 * 1000,
  
  // Maximum evidence directory size (bytes)
  // Already exists in evidence budget, included for completeness
  MAX_EVIDENCE_BYTES: 50 * 1024 * 1024, // 50MB
};

/**
 * Load budget configuration from environment variables
 * @returns {Object} Budget configuration
 */
export function loadBudgets() {
  return {
    MAX_EXPECTATIONS: parseEnvInt('VERAX_MAX_EXPECTATIONS', DEFAULT_BUDGETS.MAX_EXPECTATIONS),
    MAX_INTERACTIONS: parseEnvInt('VERAX_MAX_INTERACTIONS', DEFAULT_BUDGETS.MAX_INTERACTIONS),
    MAX_EVIDENCE_FILES: parseEnvInt('VERAX_MAX_EVIDENCE_FILES', DEFAULT_BUDGETS.MAX_EVIDENCE_FILES),
    MAX_RUNTIME_MS: parseEnvInt('VERAX_MAX_RUNTIME_MS', DEFAULT_BUDGETS.MAX_RUNTIME_MS),
    MAX_EVIDENCE_BYTES: parseEnvInt('VERAX_MAX_EVIDENCE_BYTES', DEFAULT_BUDGETS.MAX_EVIDENCE_BYTES),
  };
}

/**
 * Check if expectations count exceeds budget
 * @param {number} count 
 * @param {Object} budgets 
 * @returns {{exceeded: boolean, reason: string|null}}
 */
export function checkExpectationsBudget(count, budgets = loadBudgets()) {
  if (count > budgets.MAX_EXPECTATIONS) {
    return {
      exceeded: true,
      reason: `Expectations budget exceeded: ${count} > ${budgets.MAX_EXPECTATIONS}`,
    };
  }
  return { exceeded: false, reason: null };
}

/**
 * Check if interactions count exceeds budget
 * @param {number} count 
 * @param {Object} budgets 
 * @returns {{exceeded: boolean, reason: string|null}}
 */
export function checkInteractionsBudget(count, budgets = loadBudgets()) {
  if (count > budgets.MAX_INTERACTIONS) {
    return {
      exceeded: true,
      reason: `Interactions budget exceeded: ${count} > ${budgets.MAX_INTERACTIONS}`,
    };
  }
  return { exceeded: false, reason: null };
}

/**
 * Check if runtime exceeds budget
 * @param {number} elapsedMs 
 * @param {Object} budgets 
 * @returns {{exceeded: boolean, reason: string|null}}
 */
export function checkRuntimeBudget(elapsedMs, budgets = loadBudgets()) {
  if (elapsedMs > budgets.MAX_RUNTIME_MS) {
    return {
      exceeded: true,
      reason: `Runtime budget exceeded: ${Math.round(elapsedMs / 1000)}s > ${Math.round(budgets.MAX_RUNTIME_MS / 1000)}s`,
    };
  }
  return { exceeded: false, reason: null };
}

/**
 * Check if evidence files count exceeds budget per finding
 * @param {number} count 
 * @param {Object} budgets 
 * @returns {{exceeded: boolean, reason: string|null}}
 */
export function checkEvidenceFilesBudget(count, budgets = loadBudgets()) {
  if (count > budgets.MAX_EVIDENCE_FILES) {
    return {
      exceeded: true,
      reason: `Evidence files budget exceeded: ${count} > ${budgets.MAX_EVIDENCE_FILES}`,
    };
  }
  return { exceeded: false, reason: null };
}
