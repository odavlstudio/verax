/*
Command: verax diagnose [ALPHA]
Purpose: Generate post-hoc diagnostics for an existing run (explains HOW and WHY run behaved).
Required: <runId>
Optional: --json
Outputs: Exactly one RESULT/REASON/ACTION block (JSON or text) plus diagnostics.json artifact.
Exit Codes: 0 SUCCESS | 50 EVIDENCE_VIOLATION | 40 INFRA_FAILURE | 64 USAGE_ERROR
Forbidden: artifact mutation outside diagnostics.json; multiple RESULT blocks; interactive prompts.
*/

import { UsageError } from '../util/support/errors.js';
import { buildOutcome as _buildOutcome, EXIT_CODES as _EXIT_CODES } from '../config/cli-contract.js';
import { resolveRunId } from '../util/internals/diagnose/run-id-resolver.js';
import { generateDiagnosticsReport } from '../util/internals/diagnose/diagnostics-generator.js';
import { writeDiagnosticsArtifact } from '../util/internals/diagnose/artifact-writer.js';
import { printDiagnosticsSummary } from '../util/internals/diagnose/output-formatter.js';

/**
 * Execute diagnose command
 * @param {Object} options - Command options
 * @param {string} options.runId - Run identifier or path to run directory
 * @param {boolean} options.json - Output JSON format
 * @param {string} options.projectRoot - Project root directory
 * @returns {Promise<Object>} Diagnostics report
 */
export async function diagnoseCommand(options) {
  const { runId, json = false, projectRoot = process.cwd() } = options;
  
  if (!runId) {
    throw new UsageError('diagnose command requires a <runId> argument');
  }
  
  // Resolve runId: could be just ID or full path
  const { resolvedRunId, resolvedProjectRoot } = resolveRunId(runId, projectRoot);
  
  // Generate diagnostics
  const diagnostics = generateDiagnosticsReport(resolvedProjectRoot, resolvedRunId);
  
  // Write diagnostics.json to run directory
  const diagnosticsPath = writeDiagnosticsArtifact(resolvedProjectRoot, resolvedRunId, diagnostics);
  
  // Output
  if (json) {
    console.log(JSON.stringify(diagnostics, null, 2));
  } else {
    printDiagnosticsSummary(diagnostics, diagnosticsPath);
  }
  
  return { diagnostics, diagnosticsPath };
}
