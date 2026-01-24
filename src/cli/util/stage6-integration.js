/**
 * STAGE 6 Integration Layer
 * 
 * Integrates all Stage 6 components into the run command:
 * - Canonical naming (STAGE 6.1)
 * - Output contracts (STAGE 6.2)
 * - Human summaries (STAGE 6.3)
 * - Judgment UX (STAGE 6.4)
 * - CLI output (STAGE 6.5)
 * - Product seal (STAGE 6.6)
 */

import { getRunPaths, ensureRunDirectories as _ensureRunDirectories } from './support/paths.js';
import { generateCanonicalDirectoryNames as _generateCanonicalDirectoryNames, formatRunMetadata as _formatRunMetadata } from './support/canonical-naming.js';
import { validateOutputContract, formatContractViolations as _formatContractViolations } from './contracts/output-contract.js';
import { generateHumanSummary } from './output/human-summary-generator.js';
import { transformFindingsToJudgments } from './output/judgment-ux.js';
import { formatCliOutput, formatCoverageCliLine, formatTiming } from './output/cli-ux-formatter.js';
import { computeProductionSeal, formatProductionSealMessage } from './output/product-seal.js';
import { atomicWriteJson, atomicWriteText } from './support/atomic-write.js';

/**
 * Apply Stage 6 naming to run paths
 * @param {string} projectRoot
 * @param {string} outDir
 * @param {string} url
 * @param {string} srcPath
 * @param {Object} config
 * @param {number} runSequence
 * @returns {Object} Enhanced paths object
 */
export function applyStage6Naming(projectRoot, outDir, url, srcPath, config, runSequence = 0) {
  const scanId = 'temp'; // Legacy, not used with canonical naming
  const runId = 'temp';  // Legacy, not used with canonical naming
  
  const paths = getRunPaths(projectRoot, outDir, scanId, runId, {
    url,
    srcPath,
    config,
    runSequence,
  });
  
  return paths;
}

/**
 * Validate output contract after run
 * @param {Object} paths
 * @returns {Object} Validation result
 */
export function validateOutputContractAfterRun(paths) {
  return validateOutputContract(paths);
}

/**
 * Generate and write human summary
 * @param {Object} context
 * @param {Object} context.meta - Run metadata
 * @param {Object} context.summary - summary.json data
 * @param {Array} context.findings - Findings array
 * @param {Object} context.coverage - Coverage data
 * @param {Object} context.projectProfile - Project profile
 * @param {Object} context.paths - Paths object containing artifact locations
 * @param {string} context.paths.humanSummaryMd - Path to write summary
 */
export function generateAndWriteHumanSummary(context) {
  const { paths, ...summaryContext } = context;
  
  const markdown = generateHumanSummary(summaryContext);
  if (paths && paths.humanSummaryMd) {
    atomicWriteText(paths.humanSummaryMd, markdown);
  }
  
  return markdown;
}

/**
 * Generate and write judgments.json
 * @param {Array} findings
 * @param {string} filePath
 * @returns {Object} Judgment data
 */
export function generateAndWriteJudgments(findings, filePath) {
  const judgmentData = transformFindingsToJudgments(findings);
  
  if (filePath) {
    atomicWriteJson(filePath, {
      contractVersion: 1,
      summary: judgmentData.summary,
      byPriority: judgmentData.byPriority,
      bySeverity: judgmentData.bySeverity,
    });
  }
  
  return judgmentData;
}

/**
 * Format complete run output with all Stage 6 features
 * @param {Object} context
 * @returns {string} Formatted CLI output
 */
export function formatCompleteRunOutput(context) {
  const {
    summary = {},
    findings = [],
    coverage = {},
    paths = {},
  } = context;
  
  const output = formatCliOutput({
    summary,
    findings,
    coverage,
    displayRunName: paths.displayRunName,
    artifactDir: paths.baseDir,
  });
  
  return output;
}

/**
 * Compute and validate product seal
 * @param {Object} context
 * @returns {Object} { seal, explanation, message }
 */
export function computeAndValidateProductSeal(context) {
  const seal = computeProductionSeal(context);
  
  const message = formatProductionSealMessage({
    ...context,
    seal,
  });
  
  return {
    seal,
    message,
    isGraded: seal === 'PRODUCTION_GRADE',
  };
}

/**
 * Log human-readable summary to console
 * @param {Object} context
 */
export function logRunSummary(context) {
  console.log('');
  console.log(formatCompleteRunOutput(context));
  console.log('');
  console.log(formatCoverageCliLine(context.coverage));
  console.log(formatTiming(context.meta?.startedAt, context.meta?.completedAt));
  console.log('');
}

/**
 * Enhance summary.json with Stage 6 seal
 * @param {Object} summaryData
 * @param {Object} context
 * @returns {Object} Enhanced summary
 */
export function enhanceSummaryWithStage6(summaryData, context) {
  const seal = computeProductionSeal(context);
  
  return {
    ...summaryData,
    productionSeal: seal,
    stage6Applied: true,
  };
}
