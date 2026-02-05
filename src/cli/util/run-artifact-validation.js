/**
 * Run Artifact Validation — Week 3 Integrity
 * 
 * Strict validation when reading run artifacts:
 * - Detect invalid JSON (syntax errors, truncation)
 * - Verify required fields present
 * - Detect missing referenced files
 * - Report corruption deterministically as INCOMPLETE (Vision 1.0)
 * 
 * Never silently accept corrupted artifacts.
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { basename, resolve } from 'path';
import { getTimeProvider } from './support/time-provider.js';
import { getRunArtifactDefinitions, ARTIFACT_REGISTRY } from '../../verax/core/artifacts/registry.js';
import { EXIT_CODES } from '../../verax/shared/exit-codes.js';
import { validateArtifactIntegrity } from './integrity-validator.js';

function normalizeEvidenceRef(ref) {
  if (typeof ref !== 'string') return null;
  const raw = ref.trim();
  if (!raw) return null;
  const replaced = raw.replace(/\\/g, '/');
  const withoutPrefix = replaced.startsWith('./') ? replaced.slice(2) : replaced;
  if (/^[a-zA-Z]:\//.test(withoutPrefix)) return null;
  if (withoutPrefix.startsWith('/') || withoutPrefix.startsWith('\\\\')) return null;
  if (withoutPrefix.includes('..')) return null;
  return withoutPrefix;
}

function extractExpNumFromEvidenceFiles(files) {
  const list = Array.isArray(files) ? files : [];
  const nums = new Set();
  for (const f of list) {
    if (typeof f !== 'string') continue;
    const m = /(?:^|\/)exp_(\d+)_/i.exec(f);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) nums.add(n);
  }
  const arr = Array.from(nums).sort((a, b) => a - b);
  return arr;
}

function buildObserveEvidenceByExpNum(observe) {
  /** @type {Map<number, Set<string>>} */
  const map = new Map();
  const observations = Array.isArray(observe?.observations) ? observe.observations : [];

  for (const obs of observations) {
    const evidenceFiles = Array.isArray(obs?.evidenceFiles) ? obs.evidenceFiles : [];
    const expNums = extractExpNumFromEvidenceFiles(evidenceFiles);
    if (expNums.length !== 1) continue;
    const expNum = expNums[0];

    if (!map.has(expNum)) map.set(expNum, new Set());
    const set = map.get(expNum);
    for (const f of evidenceFiles) {
      const n = normalizeEvidenceRef(f);
      if (n) set.add(n);
    }
  }

  return map;
}

/**
 * Validation result object
 */
export class ValidationResult {
  constructor() {
    this.valid = true;
    this.errors = [];
    this.warnings = [];
    this.missingFiles = [];
    this.missingOptionalFiles = [];
    this.corruptedFiles = [];
    this.corruptedOptionalFiles = [];
  }

  addError(message, context = {}) {
    this.valid = false;
    this.errors.push({ message, context, timestamp: getTimeProvider().now() });
  }

  addWarning(message, context = {}) {
    this.warnings.push({ message, context, timestamp: getTimeProvider().now() });
  }

  addMissingFile(filePath, { required = true } = {}) {
    if (required) {
      this.valid = false;
      this.missingFiles.push(filePath);
      return;
    }
    this.missingOptionalFiles.push(filePath);
  }

  addCorruptedFile(filePath, reason, { required = true } = {}) {
    if (required) {
      this.valid = false;
      this.corruptedFiles.push({ filePath, reason });
      return;
    }
    this.corruptedOptionalFiles.push({ filePath, reason });
  }

  getSummary() {
    return {
      valid: this.valid,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      missingFileCount: this.missingFiles.length,
      missingOptionalFileCount: this.missingOptionalFiles.length,
      corruptedFileCount: this.corruptedFiles.length,
      corruptedOptionalFileCount: this.corruptedOptionalFiles.length,
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
 * @param {{ required?: boolean }} [options] - Whether this artifact is required
 * @returns {Object|null} Parsed JSON or null if invalid
 */
export function validateJsonFile(filePath, requiredFields = [], result = null, options = {}) {
  const r = result || new ValidationResult();
  const required = options?.required !== false;

  // Check existence
  if (!existsSync(filePath)) {
    r.addMissingFile(filePath, { required });
    if (!required) {
      r.addWarning(`Optional artifact missing: ${filePath}`);
    } else {
      r.addError(`Required artifact missing: ${basename(filePath)}`, { filePath });
    }
    return null;
  }

  // Check file size
  try {
    const stats = statSync(filePath);
    if (stats.size === 0) {
      const reason = 'File is empty (zero bytes)';
      r.addCorruptedFile(filePath, reason, { required });
      if (!required) {
        r.addWarning(`Optional artifact corrupted: ${filePath}`, { reason });
      } else {
        r.addError(`Required artifact corrupted: ${basename(filePath)}`, { filePath, reason });
      }
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
    r.addCorruptedFile(filePath, reason, { required });
    if (!required) {
      r.addWarning(`Optional artifact corrupted: ${filePath}`, { reason });
    } else {
      r.addError(`Required artifact corrupted: ${basename(filePath)}`, { filePath, reason });
    }
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

function ensureArtifactFile(def, runDir, result) {
  const fullPath = resolve(runDir, def.filename);
  const required = def.required === true || def.status === 'REQUIRED';

  if (!existsSync(fullPath)) {
    result.addMissingFile(fullPath, { required });
    if (!required) {
      result.addWarning(`Optional artifact missing: ${def.filename}`);
    } else {
      result.addError(`Required artifact missing: ${def.filename}`);
    }
    return { ok: false, path: fullPath };
  }

  try {
    const stats = statSync(fullPath);
    if (!stats.isFile()) {
      const msg = `Expected file but found non-file: ${def.filename}`;
      if (required) result.addError(msg, { path: fullPath });
      else result.addWarning(msg, { path: fullPath });
      return { ok: false, path: fullPath };
    }
    if (stats.size === 0) {
      const msg = `Artifact is empty (zero bytes): ${def.filename}`;
      result.addCorruptedFile(fullPath, msg, { required });
      if (required) result.addError(msg, { path: fullPath });
      else result.addWarning(msg, { path: fullPath });
      return { ok: false, path: fullPath };
    }
  } catch (e) {
    const msg = `Failed to stat artifact: ${def.filename}`;
    if (required) result.addError(msg, { path: fullPath, error: e?.message });
    else result.addWarning(msg, { path: fullPath, error: e?.message });
    return { ok: false, path: fullPath };
  }

  return { ok: true, path: fullPath };
}

function ensureArtifactDirectory(def, runDir, result) {
  const fullPath = resolve(runDir, def.filename);
  const required = def.required === true || def.status === 'REQUIRED';

  if (!existsSync(fullPath)) {
    result.addMissingFile(fullPath, { required });
    if (required) result.addError(`Required artifact directory missing: ${def.filename}`, { path: fullPath });
    else result.addWarning(`Optional artifact directory missing: ${def.filename}`, { path: fullPath });
    return { ok: false, path: fullPath };
  }

  try {
    const stats = statSync(fullPath);
    if (!stats.isDirectory()) {
      const msg = `Expected directory but found non-directory: ${def.filename}`;
      if (required) result.addError(msg, { path: fullPath });
      else result.addWarning(msg, { path: fullPath });
      return { ok: false, path: fullPath };
    }
  } catch (e) {
    const msg = `Failed to stat artifact directory: ${def.filename}`;
    if (required) result.addError(msg, { path: fullPath, error: e?.message });
    else result.addWarning(msg, { path: fullPath, error: e?.message });
    return { ok: false, path: fullPath };
  }

  return { ok: true, path: fullPath };
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

  // === Authoritative contract checks (single source of truth) ===
  // Only validate artifacts that are in the `verax run` contract scope.
  const defs = getRunArtifactDefinitions();

  /** @type {Record<string, string[]>} */
  const requiredFieldsByKey = {
    runStatus: ['status', 'runId', 'startedAt'],
    runMeta: ['contractVersion', 'veraxVersion', 'startedAt'],
    summary: ['runId', 'status', 'startedAt'],
    findings: ['findings', 'stats'],
    learn: ['contractVersion', 'expectations', 'stats', 'skipped'],
    observe: ['observations', 'stats'],
    project: ['contractVersion', 'framework', 'sourceRoot'],
    judgments: ['contractVersion'],
    coverage: ['contractVersion'],
    runManifest: ['runId', 'scanId', 'config', 'policy'],
    // run.digest.json is best-effort and not schema-stable; validate parse only.
    runDigest: [],
  };

  let summary = null;
  let findings = null;
  let runStatus = null;
  let observe = null;

  for (const def of defs) {
    const required = def.required === true || def.status === 'REQUIRED';

    if (def.type === 'directory') {
      ensureArtifactDirectory(def, runDir, result);
      continue;
    }

    if (def.filename.endsWith('.json')) {
      const requiredFields = requiredFieldsByKey[def.key] || (required ? ['contractVersion'] : []);
      const parsed = validateJsonFile(resolve(runDir, def.filename), requiredFields, result, { required });
      if (def.key === 'summary') summary = parsed;
      if (def.key === 'findings') findings = parsed;
      if (def.key === 'runStatus') runStatus = parsed;
      if (def.key === 'observe') observe = parsed;
      continue;
    }

    ensureArtifactFile(def, runDir, result);
  }

  if (summary && summary.runId && summary.runId !== runIdFromDir) {
    result.addError('summary.runId does not match run directory name', {
      expected: runIdFromDir,
      actual: summary.runId,
    });
  }

  // (parsed above for invariants)

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

    // Invariant: findings must not reference missing evidence files on disk
    try {
      const evidenceDir = resolve(runDir, ARTIFACT_REGISTRY.evidenceDir.filename);
      const integrity = validateArtifactIntegrity({ summary, findingsData: findings, evidenceDir });
      if (integrity.issues?.missingEvidenceFiles?.length > 0) {
        result.addError('findings reference missing evidence files', {
          missingEvidenceFiles: integrity.issues.missingEvidenceFiles.slice(0, 5),
          missingCount: integrity.issues.missingEvidenceFiles.length,
        });
      }
    } catch {
      // Non-fatal: validation should not crash on unexpected filesystem issues.
    }
  }

  // Manifest coverage law (strict): if integrity.manifest.json exists, it must include all findings evidence refs.
  const integrityManifestPath = resolve(runDir, 'integrity.manifest.json');
  if (findings && existsSync(integrityManifestPath)) {
    try {
      const content = /** @type {string} */ (readFileSync(integrityManifestPath, 'utf-8'));
      const manifest = JSON.parse(content);
      const artifactsArray = Array.isArray(manifest?.artifacts) ? manifest.artifacts : null;
      if (!artifactsArray) {
        result.addCorruptedFile(integrityManifestPath, 'Integrity manifest missing artifacts array (cannot verify proof chain)', { required: true });
      } else {
        const manifestPaths = new Set(
          artifactsArray
            .map((a) => (typeof a?.path === 'string' ? a.path : null))
            .filter((p) => typeof p === 'string' && p.length > 0)
            .map((p) => String(p).trim().replace(/\\/g, '/'))
        );

        const missing = [];
        const findingsList = Array.isArray(findings.findings) ? findings.findings : [];
        for (const f of findingsList) {
          const evidenceFiles = f?.evidence?.evidence_files || f?.evidence?.evidenceFiles || [];
          if (!Array.isArray(evidenceFiles)) continue;
          for (const ref of evidenceFiles) {
            const normalized = normalizeEvidenceRef(ref);
            if (!normalized) {
              result.addCorruptedFile(resolve(runDir, ARTIFACT_REGISTRY.findings.filename), 'Invalid evidence file ref in findings.json', { required: true });
              continue;
            }
            const requiredPath = `evidence/${normalized}`;
            if (!manifestPaths.has(requiredPath)) {
              missing.push({ findingId: f?.id || null, missingPath: requiredPath });
              if (missing.length >= 5) break;
            }
          }
          if (missing.length >= 5) break;
        }

        if (missing.length > 0) {
          result.addCorruptedFile(
            integrityManifestPath,
            'Integrity manifest does not cover findings evidence references (proof chain broken)',
            { required: true }
          );
          result.addError('integrity.manifest.json missing findings evidence paths', { missing });
        }
      }
    } catch (e) {
      result.addCorruptedFile(integrityManifestPath, `Failed to parse integrity.manifest.json: ${e?.message || 'unknown'}`, { required: true });
    }
  }

  // Observe ↔ findings minimal consistency (strict for CONFIRMED silent failures)
  if (findings && observe) {
    try {
      const observeEvidenceByExpNum = buildObserveEvidenceByExpNum(observe);
      const STRICT_SILENT_FAILURE_TYPES = new Set([
        'dead_interaction_silent_failure',
        'broken_navigation_promise',
        'silent_submission',
      ]);
      const findingsList = Array.isArray(findings.findings) ? findings.findings : [];
      for (const f of findingsList) {
        if (f?.status !== 'CONFIRMED') continue;
        if (!STRICT_SILENT_FAILURE_TYPES.has(f?.type)) continue;

        const evidenceFiles = f?.evidence?.evidence_files || f?.evidence?.evidenceFiles || [];
        const normalizedRefs = Array.isArray(evidenceFiles)
          ? evidenceFiles.map(normalizeEvidenceRef).filter(Boolean)
          : [];

        const expNums = extractExpNumFromEvidenceFiles(normalizedRefs);
        const mapped = expNums.length === 1 ? observeEvidenceByExpNum.get(expNums[0]) : null;
        const ok = mapped instanceof Set && normalizedRefs.every((r) => mapped.has(r));
        if (!ok) {
          result.addCorruptedFile(
            resolve(runDir, ARTIFACT_REGISTRY.findings.filename),
            'CONFIRMED silent-failure finding evidence not traceable to observe.json',
            { required: true }
          );
          break;
        }
      }
    } catch {
      // ignore consistency validation errors
    }
  }

  // Validate traces.jsonl (REQUIRED) format: warn for invalid JSON lines, error only if missing/empty.
  const tracesPath = resolve(runDir, ARTIFACT_REGISTRY.traces.filename);
  if (existsSync(tracesPath)) {
    try {
      const content = /** @type {string} */ (readFileSync(tracesPath, 'utf-8'));
      const trimmed = content.trim();
      if (trimmed.length === 0) {
        result.addError('traces.jsonl is empty', { tracesPath });
      } else {
        const lines = trimmed.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
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
 * @returns {string} Run status: 'SUCCESS' | 'FINDINGS' | 'INCOMPLETE'
  */
export function determineRunStatus(validation, existingStatus = null) {
  if (!validation || !validation.valid) {
    return 'INCOMPLETE';
  }
  const allowed = new Set(['SUCCESS', 'FINDINGS', 'INCOMPLETE']);
  if (typeof existingStatus === 'string' && allowed.has(existingStatus)) return existingStatus;
  return 'SUCCESS';
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
    // Corrupted artifacts → 50; otherwise INCOMPLETE → 30
    if (validation && Array.isArray(validation.corruptedFiles) && validation.corruptedFiles.length > 0) {
      return EXIT_CODES.INVARIANT_VIOLATION;
    }
    return EXIT_CODES.INCOMPLETE;
  }
  return EXIT_CODES.SUCCESS;
}

/**
 * Export for tests
 */
export function createValidationResult() {
  return new ValidationResult();
}
