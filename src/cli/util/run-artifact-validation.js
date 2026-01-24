/**
 * Run Artifact Validation — Week 3 Integrity
 * 
 * Strict validation when reading run artifacts:
 * - Detect invalid JSON (syntax errors, truncation)
 * - Verify required fields present
 * - Detect missing referenced files
 * - Report corruption deterministically as INCOMPLETE/FAIL_DATA
 * 
 * Never silently accept corrupted artifacts.
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { basename, resolve } from 'path';
import { getTimeProvider } from './support/time-provider.js';

/**
 * Validation result object
 */
export class ValidationResult {
  constructor() {
    this.valid = true;
    this.errors = [];
    this.warnings = [];
    this.missingFiles = [];
    this.corruptedFiles = [];
  }

  addError(message, context = {}) {
    this.valid = false;
    this.errors.push({ message, context, timestamp: getTimeProvider().now() });
  }

  addWarning(message, context = {}) {
    this.warnings.push({ message, context, timestamp: getTimeProvider().now() });
  }

  addMissingFile(filePath) {
    this.valid = false;
    this.missingFiles.push(filePath);
  }

  addCorruptedFile(filePath, reason) {
    this.valid = false;
    this.corruptedFiles.push({ filePath, reason });
  }

  getSummary() {
    return {
      valid: this.valid,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      missingFileCount: this.missingFiles.length,
      corruptedFileCount: this.corruptedFiles.length,
    };
  }
}

/**
 * Validate a JSON file for integrity
 * - Checks existence
 * - Checks file size > 0
 * - Attempts to parse JSON
 * - Verifies required fields (if provided)
 * 
 * @param {string} filePath - Path to JSON file
 * @param {Array<string>} [requiredFields] - Array of required top-level field names
 * @param {ValidationResult} result - Accumulator for errors
 * @returns {Object|null} Parsed JSON or null if invalid
 */
export function validateJsonFile(filePath, requiredFields = [], result = null) {
  const r = result || new ValidationResult();

  // Check existence
  if (!existsSync(filePath)) {
    r.addMissingFile(filePath);
    return null;
  }

  // Check file size
  try {
    const stats = statSync(filePath);
    if (stats.size === 0) {
      r.addCorruptedFile(filePath, 'File is empty (zero bytes)');
      return null;
    }
  } catch (error) {
    r.addError(`Failed to stat ${filePath}: ${error.message}`);
    return null;
  }

  // Try to read and parse JSON
  let parsed;
  try {
    const content = /** @type {string} */ (readFileSync(filePath, 'utf-8'));
    parsed = JSON.parse(content);
  } catch (error) {
    const reason = error instanceof SyntaxError
      ? `JSON syntax error: ${error.message}`
      : `Failed to read file: ${error.message}`;
    r.addCorruptedFile(filePath, reason);
    return null;
  }

  // Verify required fields
  if (requiredFields && Array.isArray(requiredFields)) {
    for (const field of requiredFields) {
      if (!(field in parsed)) {
        r.addError(
          `Missing required field: ${field}`,
          { filePath, missingField: field }
        );
      }
    }
  }

  return parsed;
}

/**
 * Validate a run directory for completeness
 * 
 * Checks:
 * - Completion sentinel exists
 * - summary.json valid
 * - findings.json valid (if present)
 * - evidence directory exists
 * - No truncated or missing critical files
 * 
 * @param {string} runDir - Run directory path
 * @returns {ValidationResult} Validation result with all errors/warnings
 */
export function validateRunDirectory(runDir) {
  const result = new ValidationResult();

  if (!runDir || typeof runDir !== 'string') {
    result.addError('Invalid runDir parameter');
    return result;
  }

  if (!existsSync(runDir)) {
    result.addError(`Run directory does not exist: ${runDir}`);
    return result;
  }

  const runIdFromDir = basename(runDir);

  // Check completion sentinel (critical for deterministic INCOMPLETE classification)
  const sentinelPath = resolve(runDir, '.run-complete');
  if (!existsSync(sentinelPath)) {
    result.addError('Run completion sentinel missing (.run-complete)', {
      runDir,
      diagnosis: 'This run appears incomplete or crashed during finalization',
    });
  }
  // Started and finalized sentinels are advisory markers for lifecycle checks
  const startedPath = resolve(runDir, '.run-started');
  const finalizedPath = resolve(runDir, '.run-finalized');
  if (!existsSync(startedPath)) {
    result.addWarning('Run start sentinel missing (.run-started)', { runDir });
  }
  if (!existsSync(finalizedPath)) {
    result.addWarning('Run finalization sentinel missing (.run-finalized)', { runDir });
  }

  // Validate summary.json (REQUIRED)
  const summaryPath = resolve(runDir, 'summary.json');
  const summary = validateJsonFile(summaryPath, ['runId', 'status', 'startedAt'], result);
  
  if (!summary) {
    result.addError('Critical artifact missing or corrupted: summary.json');
  }

  if (summary && summary.runId && summary.runId !== runIdFromDir) {
    result.addError('summary.runId does not match run directory name', {
      expected: runIdFromDir,
      actual: summary.runId,
    });
  }

  // Validate findings.json (REQUIRED)
  const findingsPath = resolve(runDir, 'findings.json');
  const findings = validateJsonFile(findingsPath, ['findings', 'stats'], result);
  
  if (!findings) {
    result.addError('Critical artifact missing or corrupted: findings.json');
  }

  // Validate observe.json (critical observation trace)
  const observePath = resolve(runDir, 'observe.json');
  const observe = validateJsonFile(observePath, ['observations', 'stats'], result);
  if (!observe) {
    result.addError('Critical artifact missing or corrupted: observe.json');
  }

  // Validate run.meta.json
  const runMetaPath = resolve(runDir, 'run.meta.json');
  const runMeta = validateJsonFile(runMetaPath, ['contractVersion', 'veraxVersion', 'startedAt'], result);
  if (!runMeta) {
    result.addError('Critical artifact missing or corrupted: run.meta.json');
  }

  // Validate Output Contract 2.0 artifacts when present
  const judgmentsPath = resolve(runDir, 'judgments.json');
  const coveragePath = resolve(runDir, 'coverage.json');
  let _judgments = null;
  let _coverage = null;
  if (existsSync(judgmentsPath)) {
    _judgments = validateJsonFile(judgmentsPath, ['judgments', 'counts'], result);
  } else {
    result.addWarning('Optional artifact missing: judgments.json (Stage 6)');
  }
  if (existsSync(coveragePath)) {
    _coverage = validateJsonFile(coveragePath, ['total', 'observed', 'coverageRatio', 'threshold'], result);
  } else {
    result.addWarning('Optional artifact missing: coverage.json (Stage 6)');
  }

  // Validate run.status.json
  const runStatusPath = resolve(runDir, 'run.status.json');
  const runStatus = validateJsonFile(runStatusPath, ['status', 'runId', 'startedAt'], result);
  if (!runStatus) {
    result.addError('Critical artifact missing or corrupted: run.status.json');
  }

  if (runStatus && runStatus.runId && runStatus.runId !== runIdFromDir) {
    result.addError('run.status.json runId does not match run directory name', {
      expected: runIdFromDir,
      actual: runStatus.runId,
    });
  }

  // Invariant: summary.status must match run.status.json
  if (summary && runStatus && summary.status !== runStatus.status) {
    result.addError('Summary status does not match run.status.json', {
      summaryStatus: summary.status,
      runStatusStatus: runStatus.status,
    });
  }

  // Invariant: findings counts must match summary
  if (summary && findings) {
    const findingsCountFromSummary = sumFindingsCounts(summary.findingsCounts || {});
    const findingsTotal = getFindingsTotal(findings);
    const findingsLen = Array.isArray(findings.findings) ? findings.findings.length : 0;

    if (Number.isFinite(findingsTotal) && findingsTotal !== findingsCountFromSummary) {
      result.addError('findings.stats.total does not match summary.findingsCounts total', {
        summaryFindingsTotal: findingsCountFromSummary,
        findingsStatsTotal: findingsTotal,
      });
    }

    if (Number.isFinite(findingsTotal) && findingsLen !== findingsTotal) {
      result.addError('findings.stats.total does not match findings array length', {
        findingsStatsTotal: findingsTotal,
        findingsLength: findingsLen,
      });
    }
  }

  // Check evidence directory exists
  const evidenceDir = resolve(runDir, 'evidence');
  if (!existsSync(evidenceDir)) {
    result.addWarning('Evidence directory missing (expected for runs with observations)', { evidenceDir });
  }

  // Optional: Validate traces.jsonl if it exists
  const tracesPath = resolve(runDir, 'traces.jsonl');
  if (existsSync(tracesPath)) {
    try {
      const content = /** @type {string} */ (readFileSync(tracesPath, 'utf-8'));
      const trimmed = content.trim();
      if (trimmed.length === 0) {
        result.addWarning('traces.jsonl is empty', { tracesPath });
      } else {
        const lines = trimmed.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue; // Skip empty lines
          
          try {
            JSON.parse(line);
          } catch (error) {
            result.addWarning(
              `traces.jsonl line ${i + 1} is not valid JSON`,
              { lineNumber: i + 1, error: error.message }
            );
          }
        }
      }
    } catch (error) {
      result.addWarning(`Failed to validate traces.jsonl: ${error.message}`);
    }
  }

  return result;
}

/**
 * Determine run status based on validation
 * 
 * @param {ValidationResult} validation - Validation result
 * @param {string} [existingStatus] - Status from summary if available
 * @returns {string} Run status: 'COMPLETE', 'INCOMPLETE', or 'FAIL_DATA'
 */
export function determineRunStatus(validation, existingStatus = null) {
  if (!validation || !validation.valid) {
    if (validation && validation.corruptedFiles && validation.corruptedFiles.length > 0) {
      return 'FAIL_DATA';
    }

    if (validation && validation.missingFiles && validation.missingFiles.length > 0) {
      return 'INCOMPLETE';
    }

    if (validation && validation.errors && 
        validation.errors.some(e => e.message.includes('completion sentinel'))) {
      return 'INCOMPLETE';
    }

    return 'FAIL_DATA';
  }

  return existingStatus || 'COMPLETE';
}

function sumFindingsCounts(findingsCounts) {
  const values = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
  return values.reduce((acc, key) => acc + (Number(findingsCounts[key]) || 0), 0);
}

function getFindingsTotal(findings) {
  if (!findings) return 0;
  const statsTotal = Number(findings.stats?.total ?? findings.total ?? 0);
  return Number.isFinite(statsTotal) ? statsTotal : 0;
}

export function validationExitCode(validation) {
  if (!validation || !validation.valid) {
    // New explicit contract: incomplete artifacts → 30, corrupted data → 30
    return 30;
  }
  return 0;
}

/**
 * Export for tests
 */
export function createValidationResult() {
  return new ValidationResult();
}
