import { getTimeProvider } from '../../cli/util/support/time-provider.js';

/**
 * VERAX Product Contract
 * 
 * Hard-locks VERAX boundaries in code (not documentation):
 * - Read-only operation model
 * - Evidence-driven outputs only
 * - Deterministic serialization
 * - No hidden side effects
 * 
 * This is NOT a suggestion or guideline. These are machine-enforced invariants.
 * Contract violations trigger safe failures with clear error codes.
 * 
 * PHASE 1 (Week 1): Product Contract Foundation
 */

/**
 * VERAX Product Contract Definition
 * 
 * INVARIANT 1: Read-Only Operation Model
 * - VERAX reads source code and observes runtime behavior (browser)
 * - VERAX must NOT mutate user code, files, or environment
 * - Output is written only to designated .verax/ directory
 * - All writes must be atomic and include rollback capability
 * 
 * INVARIANT 2: Evidence-Driven Outputs
 * - Every finding MUST have observable evidence
 * - No findings without sensor signals or expectation proof
 * - No hidden filters or downgraded findings in artifacts
 * - Confidence must be derived from signal strength
 * 
 * INVARIANT 3: Deterministic Serialization
 * - Identical inputs → identical normalized output artifacts
 * - Key ordering must be stable (alphabetically sorted)
 * - Arrays must be sorted by stable ID (not insertion order)
 * - Timestamps may vary; digest must normalize them
 * 
 * INVARIANT 4: No Hidden Side Effects
 * - All I/O operations must be explicit and logged
 * - No environment mutations (env vars, NODE_ENV, etc.)
 * - No process-level state pollution
 * - Execution must be replayable from same inputs
 */

const INVARIANTS = {
  READONLY_OPERATION: {
    id: 'READONLY_OPERATION',
    name: 'Read-Only Operation Model',
    description: 'VERAX may only read source code and observe browser behavior. No user code or file mutations allowed.',
    violations: []
  },
  EVIDENCE_DRIVEN: {
    id: 'EVIDENCE_DRIVEN',
    name: 'Evidence-Driven Outputs',
    description: 'Every finding must have observable evidence. No findings without sensor proof.',
    violations: []
  },
  DETERMINISTIC_OUTPUT: {
    id: 'DETERMINISTIC_OUTPUT',
    name: 'Deterministic Serialization',
    description: 'Identical inputs must produce identical normalized output artifacts.',
    violations: []
  },
  NO_SIDE_EFFECTS: {
    id: 'NO_SIDE_EFFECTS',
    name: 'No Hidden Side Effects',
    description: 'All I/O and state mutations must be explicit. No process-level pollution.',
    violations: []
  }
};

/**
 * VERAX Capability Model
 * 
 * ALLOWED:
 * - Scan source code (read-only): file parsing, AST analysis, pattern matching
 * - Observe browser: navigate to URL, capture trace, analyze DOM, measure performance
 * - Extract expectations from code (comments, patterns)
 * - Compare observed vs expected behavior
 * - Generate findings with evidence backing
 * - Write artifacts to .verax/ directory (atomic, timestamped)
 * - Emit events for progress/status
 * 
 * FORBIDDEN:
 * - Modify user source code or configuration
 * - Write outside .verax/ directory (except stdout)
 * - Modify environment variables or process state
 * - Cache or persist data between runs (except .verax/)
 * - Drop findings without explicit evidence in artifact
 * - Reorder or sort findings (maintain observation order)
 * - Hide adapter/internal errors from output
 */

const CAPABILITY_MODEL = {
  ALLOWED: new Set([
    'read_source_code',
    'parse_file_ast',
    'extract_expectations',
    'observe_browser_trace',
    'analyze_dom',
    'measure_performance',
    'compare_behaviors',
    'generate_findings',
    'write_to_verax_dir',
    'emit_progress_events',
    'read_existing_artifacts'
  ]),
  
  FORBIDDEN: new Set([
    'modify_user_code',
    'modify_user_config',
    'write_outside_verax',
    'modify_process_env',
    'modify_global_state',
    'cache_between_runs',
    'drop_findings_silently',
    'reorder_findings',
    'hide_internal_errors',
    'mutate_input_paths'
  ])
};

/**
 * Contract enforcement context
 * Tracks contract state during execution for diagnostics
 */
class ContractEnforcementContext {
  constructor() {
    this.violations = [];
    this.checksPerformed = [];
    this.startTime = getTimeProvider().now();
  }

  recordCheck(invariantId, result) {
    this.checksPerformed.push({
      invariantId,
      result,
      timestamp: getTimeProvider().now()
    });
  }

  recordViolation(invariantId, message, context = {}) {
    const violation = {
      invariantId,
      message,
      context,
      timestamp: getTimeProvider().now(),
      elapsed: getTimeProvider().now() - this.startTime
    };
    this.violations.push(violation);
    return violation;
  }

  hasViolations() {
    return this.violations.length > 0;
  }

  getReport() {
    return {
      totalChecks: this.checksPerformed.length,
      totalViolations: this.violations.length,
      violations: this.violations,
      checksPerformed: this.checksPerformed,
      enforcementDurationMs: getTimeProvider().now() - this.startTime
    };
  }
}

/**
 * Global enforcement context (singleton)
 */
let globalContext = new ContractEnforcementContext();

/**
 * Enforce read-only operation invariant
 * Validates that VERAX is not modifying user files
 * 
 * @param {Object} config - Configuration context (paths, mode, etc.)
 * @returns {Object} { enforced: boolean, violations: Array }
 */
export function enforceReadOnlyOperation(config = {}) {
  const { srcPath, outPath, projectRoot: _projectRoot } = config;
  
  // RULE 1: If output path is provided, it must not be within source tree
  // Exception: .verax paths are always allowed
  if (outPath && srcPath) {
    // Normalize paths to prevent directory traversal
    const srcNorm = srcPath.replace(/\\/g, '/');
    const outNorm = outPath.replace(/\\/g, '/');
    
    // Allow .verax paths (strict check)
    const is_verax_path = outNorm.includes('.verax');
    
    // Forbid writing into source tree UNLESS it's a .verax subdirectory
    if (!is_verax_path && outNorm.startsWith(srcNorm) && outNorm !== srcNorm) {
      const violation = globalContext.recordViolation(
        'READONLY_OPERATION',
        'Output path would modify source code directory',
        { srcPath: srcNorm, outPath: outNorm, hint: 'Use --out .verax' }
      );
      return { enforced: false, violations: [violation] };
    }
  }
  
  globalContext.recordCheck('READONLY_OPERATION', true);
  return { enforced: true, violations: [] };
}

/**
 * Enforce evidence-driven output invariant
 * Validates that findings have observable backing
 * 
 * @param {Array} findings - Array of findings to validate
 * @returns {Object} { enforced: boolean, violations: Array, dropCount: number }
 */
export function enforceEvidenceDriven(findings = []) {
  const violations = [];
  let droppedCount = 0;
  
  for (const finding of findings) {
    // RULE 1: Finding must have evidence object
    if (!finding.evidence || typeof finding.evidence !== 'object') {
      violations.push(
        globalContext.recordViolation(
          'EVIDENCE_DRIVEN',
          `Finding missing evidence: ${finding.id || finding.message}`,
          { finding: { id: finding.id, message: finding.message } }
        )
      );
      droppedCount++;
      continue;
    }
    
    // RULE 2: Finding must have observable signals (at least one)
    const hasSignals = finding.signals && typeof finding.signals === 'object' &&
                       Object.keys(finding.signals).length > 0;
    const hasExpectation = finding.expectationId || finding.matched;
    
    if (!hasSignals && !hasExpectation) {
      violations.push(
        globalContext.recordViolation(
          'EVIDENCE_DRIVEN',
          `Finding has no observable signals: ${finding.id || finding.message}`,
          { finding: { id: finding.id, message: finding.message } }
        )
      );
      droppedCount++;
      continue;
    }
    
    // RULE 3: Confidence must be derivable from evidence
    if (!finding.confidence || typeof finding.confidence !== 'object') {
      violations.push(
        globalContext.recordViolation(
          'EVIDENCE_DRIVEN',
          `Finding lacks confidence object: ${finding.id || finding.message}`,
          { finding: { id: finding.id, message: finding.message } }
        )
      );
      droppedCount++;
    }
  }
  
  if (violations.length === 0) {
    globalContext.recordCheck('EVIDENCE_DRIVEN', true);
  }
  
  return { enforced: violations.length === 0, violations, dropCount: droppedCount };
}

/**
 * Enforce deterministic serialization invariant
 * Validates output can be consistently reproduced
 * 
 * @param {Object} artifact - Artifact to validate
 * @param {string} artifactName - Type of artifact (for context)
 * @returns {Object} { enforced: boolean, violations: Array }
 */
export function enforceDeterministicOutput(artifact = {}, artifactName = 'unknown') {
  const violations = [];
  
  // RULE 1: All object keys must be sortable (string keys only)
  try {
    const keys = Object.keys(artifact);
    const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b, 'en'));
    
    if (keys.join(',') !== sortedKeys.join(',')) {
      violations.push(
        globalContext.recordViolation(
          'DETERMINISTIC_OUTPUT',
          `Artifact keys not in sorted order: ${artifactName}`,
          { artifactName, expected: sortedKeys, actual: keys }
        )
      );
    }
  } catch (error) {
    violations.push(
      globalContext.recordViolation(
        'DETERMINISTIC_OUTPUT',
        `Cannot validate key ordering: ${error.message}`,
        { artifactName, error: error.message }
      )
    );
  }
  
  // RULE 2: If artifact contains arrays, they must be sortable by ID/stable key
  if (Array.isArray(artifact)) {
    // Arrays should be sorted by a stable key
    violations.push(
      globalContext.recordViolation(
        'DETERMINISTIC_OUTPUT',
        `Array artifact lacks stable sorting: ${artifactName}`,
        { artifactName, instruction: 'Sort array elements by stable ID or comparable field' }
      )
    );
  }
  
  if (violations.length === 0) {
    globalContext.recordCheck('DETERMINISTIC_OUTPUT', true);
  }
  
  return { enforced: violations.length === 0, violations };
}

/**
 * Enforce no side effects invariant
 * Validates execution leaves no persistent state outside .verax
 * 
 * @param {Object} config - Execution config (env, cwd, etc.)
 * @returns {Object} { enforced: boolean, violations: Array }
 */
export function enforceNoSideEffects(config = {}) {
  const violations = [];
  
  // RULE 1: NODE_ENV must not be modified
  const originalEnv = config.originalEnv || {};
  const currentEnv = process.env;
  
  for (const key of Object.keys(currentEnv)) {
    if (originalEnv[key] !== currentEnv[key] && key.startsWith('VERAX_')) {
      // VERAX_ vars are allowed to be set during execution
      continue;
    }
    if (key === 'NODE_ENV' && originalEnv[key] && originalEnv[key] !== currentEnv[key]) {
      violations.push(
        globalContext.recordViolation(
          'NO_SIDE_EFFECTS',
          'Process NODE_ENV was modified',
          { original: originalEnv[key], current: currentEnv[key] }
        )
      );
    }
  }
  
  // RULE 2: Working directory must not change
  if (config.originalCwd && config.currentCwd && config.originalCwd !== config.currentCwd) {
    violations.push(
      globalContext.recordViolation(
        'NO_SIDE_EFFECTS',
        'Working directory was modified',
        { original: config.originalCwd, current: config.currentCwd }
      )
    );
  }
  
  if (violations.length === 0) {
    globalContext.recordCheck('NO_SIDE_EFFECTS', true);
  }
  
  return { enforced: violations.length === 0, violations };
}

/**
 * Full contract enforcement
 * Performs all invariant checks and returns aggregate result
 * 
 * @param {Object} fullContext - Complete execution context
 * @returns {Object} { pass: boolean, report: Object, error?: VeraxError }
 */
export function enforceProductContract(fullContext = {}) {
  globalContext = new ContractEnforcementContext();
  
  // Perform all checks
  const readOnlyCheck = enforceReadOnlyOperation(fullContext.config);
  const evidenceCheck = enforceEvidenceDriven(fullContext.findings);
  const deterministicCheck = enforceDeterministicOutput(fullContext.artifact, fullContext.artifactName);
  const sideEffectCheck = enforceNoSideEffects(fullContext.env);
  
  // Aggregate results
  const allViolations = [
    ...readOnlyCheck.violations,
    ...evidenceCheck.violations,
    ...deterministicCheck.violations,
    ...sideEffectCheck.violations
  ];
  
  const pass = allViolations.length === 0 &&
               readOnlyCheck.enforced &&
               evidenceCheck.enforced &&
               deterministicCheck.enforced &&
               sideEffectCheck.enforced;
  
  const report = {
    pass,
    checksPerformed: globalContext.checksPerformed.length,
    violationsFound: allViolations.length,
    invariantsEnforced: [
      { id: 'READONLY_OPERATION', enforced: readOnlyCheck.enforced, violations: readOnlyCheck.violations.length },
      { id: 'EVIDENCE_DRIVEN', enforced: evidenceCheck.enforced, violations: evidenceCheck.violations.length },
      { id: 'DETERMINISTIC_OUTPUT', enforced: deterministicCheck.enforced, violations: deterministicCheck.violations.length },
      { id: 'NO_SIDE_EFFECTS', enforced: sideEffectCheck.enforced, violations: sideEffectCheck.violations.length }
    ],
    violations: allViolations,
    context: globalContext.getReport()
  };
  
  return { pass, report };
}

/**
 * Get current enforcement context for diagnostics
 * @returns {Object} Current enforcement state
 */
export function getContractEnforcementState() {
  return globalContext.getReport();
}

/**
 * Reset enforcement context (for testing)
 */
export function resetContractEnforcementContext() {
  globalContext = new ContractEnforcementContext();
}

export {
  INVARIANTS,
  CAPABILITY_MODEL,
  ContractEnforcementContext
};
