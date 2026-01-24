/**
 * VERAX Diagnose - Diagnostics Generation
 * 
 * Orchestrates diagnostics generation and error handling.
 */

// @ts-ignore - Module path resolution issue
import { generateDiagnostics } from '../diagnostics/diagnostics-engine.js';
// @ts-ignore - Module path resolution issue
import { DataError } from '../support/errors.js';

/**
 * Generate diagnostics report with error handling
 * @param {string} projectRoot - Project root directory
 * @param {string} runId - Run identifier
 * @returns {Object} Diagnostics report
 */
export function generateDiagnosticsReport(projectRoot, runId) {
  try {
    return generateDiagnostics(projectRoot, runId);
  } catch (error) {
    if (error instanceof DataError) {
      // Re-throw data errors (invalid runId, missing artifacts)
      throw error;
    }
    // Wrap unexpected errors
    throw new Error(`Failed to generate diagnostics: ${error.message}`);
  }
}
