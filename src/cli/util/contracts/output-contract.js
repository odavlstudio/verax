/**
 * STAGE 6.2: Output Contract 2.0
 * 
 * Validates canonical artifacts are present and have correct structure.
 * Canonical artifacts:
 * - summary.json (executive summary with status and seal)
 * - judgments.json (ordered human-readable judgments)
 * - coverage.json (execution truth)
 * - run.meta.json (run context)
 * - findings.json (raw findings data)
 * 
 * Run fails if contract violated.
 */

import { existsSync, readFileSync } from 'fs';
import { ARTIFACT_REGISTRY as _ARTIFACT_REGISTRY } from '../../../verax/core/artifacts/registry.js';

export const OUTPUT_CONTRACTS = {
  SUMMARY: 'summary.json',
  JUDGMENTS: 'judgments.json',
  COVERAGE: 'coverage.json',
  RUN_META: 'run.meta.json',
  FINDINGS: 'findings.json',
};

export const CONTRACT_VIOLATION_CODES = {
  MISSING_SUMMARY: 'CONTRACT_MISSING_SUMMARY',
  INVALID_SUMMARY: 'CONTRACT_INVALID_SUMMARY',
  MISSING_RUN_META: 'CONTRACT_MISSING_RUN_META',
  INVALID_RUN_META: 'CONTRACT_INVALID_RUN_META',
  MISSING_FINDINGS: 'CONTRACT_MISSING_FINDINGS',
  INVALID_FINDINGS: 'CONTRACT_INVALID_FINDINGS',
  INVALID_COVERAGE: 'CONTRACT_INVALID_COVERAGE',
  INVALID_JUDGMENTS: 'CONTRACT_INVALID_JUDGMENTS',
  MISSING_REQUIRED_FIELD: 'CONTRACT_MISSING_REQUIRED_FIELD',
};

/**
 * Validate all canonical artifacts exist and have correct structure
 * @param {Object} paths - Run paths from getRunPaths()
 * @returns {Object} { valid: boolean, violations: Array<{code, message}> }
 */
export function validateOutputContract(paths) {
  const violations = [];
  
  // Validate summary.json
  const summaryViolation = validateSummaryJson(paths.summaryJson);
  if (summaryViolation) violations.push(summaryViolation);
  
  // Validate run.meta.json
  const metaViolation = validateRunMetaJson(paths.runMetaJson);
  if (metaViolation) violations.push(metaViolation);
  
  // Validate findings.json
  const findingsViolation = validateFindingsJson(paths.findingsJson);
  if (findingsViolation) violations.push(findingsViolation);
  
  // Validate coverage.json (optional but must be valid if present)
  if (existsSync(paths.coverageJson)) {
    const coverageViolation = validateCoverageJson(paths.coverageJson);
    if (coverageViolation) violations.push(coverageViolation);
  }
  
  // Validate judgments.json (optional but must be valid if present)
  if (existsSync(paths.judgmentsJson)) {
    const judgementsViolation = validateJudgementsJson(paths.judgmentsJson);
    if (judgementsViolation) violations.push(judgementsViolation);
  }
  
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Validate summary.json structure and required fields
 * @param {string} filePath
 * @returns {Object|null} Violation object if invalid, null if valid
 */
function validateSummaryJson(filePath) {
  if (!existsSync(filePath)) {
    return {
      code: CONTRACT_VIOLATION_CODES.MISSING_SUMMARY,
      message: 'summary.json is missing',
      artifact: 'summary.json',
    };
  }
  
  try {
    const data = JSON.parse(String(readFileSync(filePath, 'utf8')));
    
    // Required fields in summary
    const required = ['contractVersion', 'runId', 'status', 'startedAt'];
    for (const field of required) {
      if (!(field in data)) {
        return {
          code: CONTRACT_VIOLATION_CODES.MISSING_REQUIRED_FIELD,
          message: `summary.json missing required field: ${field}`,
          artifact: 'summary.json',
          field,
        };
      }
    }
    
    // Validate contract version
    if (typeof data.contractVersion !== 'number' || data.contractVersion < 1) {
      return {
        code: CONTRACT_VIOLATION_CODES.INVALID_SUMMARY,
        message: 'summary.json has invalid contractVersion',
        artifact: 'summary.json',
      };
    }
    
    // Validate status
    const validStatuses = ['RUNNING', 'COMPLETE', 'INCOMPLETE', 'FAILED', 'TIMEOUT'];
    if (!validStatuses.includes(data.status)) {
      return {
        code: CONTRACT_VIOLATION_CODES.INVALID_SUMMARY,
        message: `summary.json has invalid status: ${data.status}`,
        artifact: 'summary.json',
      };
    }
    
    return null;
  } catch (error) {
    return {
      code: CONTRACT_VIOLATION_CODES.INVALID_SUMMARY,
      message: `summary.json is malformed: ${error.message}`,
      artifact: 'summary.json',
      error: error.message,
    };
  }
}

/**
 * Validate run.meta.json structure and required fields
 * @param {string} filePath
 * @returns {Object|null} Violation object if invalid, null if valid
 */
function validateRunMetaJson(filePath) {
  if (!existsSync(filePath)) {
    return {
      code: CONTRACT_VIOLATION_CODES.MISSING_RUN_META,
      message: 'run.meta.json is missing',
      artifact: 'run.meta.json',
    };
  }
  
  try {
    const data = JSON.parse(String(readFileSync(filePath, 'utf8')));
    
    // Required fields
    const required = ['contractVersion', 'command', 'url', 'startedAt'];
    for (const field of required) {
      if (!(field in data)) {
        return {
          code: CONTRACT_VIOLATION_CODES.MISSING_REQUIRED_FIELD,
          message: `run.meta.json missing required field: ${field}`,
          artifact: 'run.meta.json',
          field,
        };
      }
    }
    
    // Validate contract version
    if (typeof data.contractVersion !== 'number' || data.contractVersion < 1) {
      return {
        code: CONTRACT_VIOLATION_CODES.INVALID_RUN_META,
        message: 'run.meta.json has invalid contractVersion',
        artifact: 'run.meta.json',
      };
    }
    
    return null;
  } catch (error) {
    return {
      code: CONTRACT_VIOLATION_CODES.INVALID_RUN_META,
      message: `run.meta.json is malformed: ${error.message}`,
      artifact: 'run.meta.json',
      error: error.message,
    };
  }
}

/**
 * Validate findings.json structure
 * @param {string} filePath
 * @returns {Object|null} Violation object if invalid, null if valid
 */
function validateFindingsJson(filePath) {
  if (!existsSync(filePath)) {
    return {
      code: CONTRACT_VIOLATION_CODES.MISSING_FINDINGS,
      message: 'findings.json is missing',
      artifact: 'findings.json',
    };
  }
  
  try {
    const data = JSON.parse(String(readFileSync(filePath, 'utf8')));
    
    // Findings should be an object with findings array
    if (!Array.isArray(data.findings) && !(data instanceof Array)) {
      return {
        code: CONTRACT_VIOLATION_CODES.INVALID_FINDINGS,
        message: 'findings.json findings field must be an array',
        artifact: 'findings.json',
      };
    }
    
    // Validate finding structure
    const findings = Array.isArray(data) ? data : data.findings || [];
    for (let i = 0; i < Math.min(findings.length, 5); i++) {
      const finding = findings[i];
      if (!finding.id || !finding.type || !finding.outcome) {
        return {
          code: CONTRACT_VIOLATION_CODES.INVALID_FINDINGS,
          message: `findings.json finding ${i} missing required fields (id, type, outcome)`,
          artifact: 'findings.json',
          findingIndex: i,
        };
      }
    }
    
    return null;
  } catch (error) {
    return {
      code: CONTRACT_VIOLATION_CODES.INVALID_FINDINGS,
      message: `findings.json is malformed: ${error.message}`,
      artifact: 'findings.json',
      error: error.message,
    };
  }
}

/**
 * Validate coverage.json if present
 * @param {string} filePath
 * @returns {Object|null} Violation object if invalid, null if valid
 */
function validateCoverageJson(filePath) {
  try {
    const data = JSON.parse(String(readFileSync(filePath, 'utf8')));
    
    // Should have coverage metrics
    if (typeof data.coverageRatio !== 'number' || data.coverageRatio < 0 || data.coverageRatio > 1) {
      return {
        code: CONTRACT_VIOLATION_CODES.INVALID_COVERAGE,
        message: 'coverage.json has invalid coverageRatio',
        artifact: 'coverage.json',
      };
    }
    
    return null;
  } catch (error) {
    return {
      code: CONTRACT_VIOLATION_CODES.INVALID_COVERAGE,
      message: `coverage.json is malformed: ${error.message}`,
      artifact: 'coverage.json',
      error: error.message,
    };
  }
}

/**
 * Validate judgments.json if present
 * @param {string} filePath
 * @returns {Object|null} Violation object if invalid, null if valid
 */
function validateJudgementsJson(filePath) {
  try {
    const data = JSON.parse(String(readFileSync(filePath, 'utf8')));
    
    // Should be an array or have judgments array
    const judgments = Array.isArray(data) ? data : data.judgments || [];
    if (!Array.isArray(judgments)) {
      return {
        code: CONTRACT_VIOLATION_CODES.INVALID_JUDGMENTS,
        message: 'judgments.json must contain an array of judgments',
        artifact: 'judgments.json',
      };
    }
    
    // Validate judgment structure (sample check)
    for (let i = 0; i < Math.min(judgments.length, 3); i++) {
      const judgment = judgments[i];
      if (!judgment.id || !judgment.title) {
        return {
          code: CONTRACT_VIOLATION_CODES.INVALID_JUDGMENTS,
          message: `judgments.json judgment ${i} missing id or title`,
          artifact: 'judgments.json',
          judgmentIndex: i,
        };
      }
    }
    
    return null;
  } catch (error) {
    return {
      code: CONTRACT_VIOLATION_CODES.INVALID_JUDGMENTS,
      message: `judgments.json is malformed: ${error.message}`,
      artifact: 'judgments.json',
      error: error.message,
    };
  }
}

/**
 * Format contract violations for human display
 * @param {Array} violations
 * @returns {string} Formatted message
 */
export function formatContractViolations(violations) {
  if (!violations || violations.length === 0) {
    return 'All artifacts validated successfully.';
  }
  
  const lines = ['Contract violations detected:'];
  for (const violation of violations) {
    const artifact = violation.artifact || 'unknown';
    lines.push(`  - [${artifact}] ${violation.code}: ${violation.message}`);
    if (violation.field) {
      lines.push(`    Field: ${violation.field}`);
    }
    if (violation.error) {
      lines.push(`    Error: ${violation.error}`);
    }
  }
  
  return lines.join('\n');
}
