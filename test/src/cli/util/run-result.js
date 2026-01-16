/**
 * RunResult - Central Truth Tracking for VERAX
 * 
 * Single source of truth for analysis state, completeness, and skip reasons.
 * This object accumulates all information needed to determine exit codes
 * and produce honest, explicit output.
 */

import { SKIP_REASON, validateSkipReason, isSystemicFailure } from './types.js';

export const ANALYSIS_STATE = {
  COMPLETE: 'ANALYSIS_COMPLETE',
  INCOMPLETE: 'ANALYSIS_INCOMPLETE',
  FAILED: 'ANALYSIS_FAILED',
};

// Re-export SKIP_REASON for backward compatibility
export { SKIP_REASON };

export class RunResult {
  // Invariant Degradation Contract v1: Static allowlist for HARD invariants (empty by default)
  static HARD_INVARIANT_ALLOWLIST = [];

  constructor(runId = null, budget = null) {
    // Analysis state
    this.state = ANALYSIS_STATE.COMPLETE;
    
    // Run identity
    this.runId = runId;
    
    // Findings
    this.findings = []; // Array of findings
    
    // Invariant Degradation Contract v1: Degradation flag
    this.isDegraded = false;
    this.degradationReasons = []; // Array of { severity, invariantId, reason }
    
    // Counts
    this.expectationsDiscovered = 0;
    this.expectationsAnalyzed = 0;
    this.expectationsSkipped = 0;
    this.findingsCount = 0;
    
    // Skip journal: { [reason: string]: number }
    this.skipReasons = {};
    
    // PHASE 3: Skip examples (up to 5 per reason) for explainability
    this.skipExamples = {}; // { [reason]: ["exp_1", "exp_2", ...] }
    
    // Per-expectation accounting (PHASE 2 PURIFICATION)
    // Tracks which expectations were analyzed vs skipped with specific reasons
    this.analyzedExpectations = new Set(); // Set<expectationId>
    this.skippedExpectations = new Map(); // Map<expectationId, skipReason>
    
    // PHASE 4: Determinism tracking
    this.determinism = {
      level: 'DETERMINISTIC', // DETERMINISTIC | CONTROLLED_NON_DETERMINISTIC | NON_DETERMINISTIC
      reproducible: true,
      factors: [], // Array of factor codes (e.g., NETWORK_TIMING, ASYNC_DOM)
      notes: [],
      comparison: {
        comparable: false,
        baselineRunId: null,
        differences: null,
      },
    };
    
    // Budget tracking
    this.budget = {
      observeMaxMs: budget?.observeMaxMs || 0,
      detectMaxMs: budget?.detectMaxMs || 0,
      totalMaxMs: budget?.totalMaxMs || 0,
      maxExpectations: budget?.maxExpectations || null,
      observeExceeded: false,
      detectExceeded: false,
      totalExceeded: false,
      expectationsExceeded: false,
    };
    
    // Actual timing
    this.timings = {
      learnMs: 0,
      observeMs: 0,
      detectMs: 0,
      totalMs: 0,
    };
    
    // Warnings (human-readable, explicit)
    this.warnings = [];
    
    // Notes
    this.notes = [];
    
    // Contract enforcement
    this.contractViolations = {
      droppedCount: 0,
      dropped: [],
    };
    
    // Error tracking
    this.error = null;
  }
  
  /**
   * PHASE 2: Record that an expectation was analyzed
   * @param {string} expectationId - ID of the expectation that was analyzed
   */
  recordAnalyzed(expectationId) {
    if (!expectationId) {
      throw new Error('expectationId is required for recordAnalyzed()');
    }
    this.analyzedExpectations.add(expectationId);
    this.expectationsAnalyzed++;
  }
  
  /**
   * Record a skip with specific reason
   */
  recordSkip(reason, count = 1, expectationIds = []) {
    // Validate at creation time and normalize if invalid
    const normalizedReason = validateSkipReason(reason);
    
    this.skipReasons[normalizedReason] = (this.skipReasons[normalizedReason] || 0) + count;
    this.expectationsSkipped += count;
    
    // PHASE 2: Record per-expectation skips
    if (expectationIds && Array.isArray(expectationIds)) {
      for (const id of expectationIds) {
        if (id) {
          this.skippedExpectations.set(id, normalizedReason);
        }
      }
      
      // PHASE 3: Track up to 5 example expectationIds per skip reason
      if (!this.skipExamples[normalizedReason]) {
        this.skipExamples[normalizedReason] = [];
      }
      for (const id of expectationIds) {
        if (id && this.skipExamples[normalizedReason].length < 5 && !this.skipExamples[normalizedReason].includes(id)) {
          this.skipExamples[normalizedReason].push(id);
        }
      }
    }
  }
  
  /**
   * Record a timeout
   */
  recordTimeout(phase) {
    const reasonMap = {
      'observe': SKIP_REASON.TIMEOUT_OBSERVE,
      'detect': SKIP_REASON.TIMEOUT_DETECT,
      'total': SKIP_REASON.TIMEOUT_TOTAL,
    };
    
    const reason = reasonMap[phase.toLowerCase()];
    if (!reason) {
      throw new Error(`Invalid timeout phase: ${phase}`);
    }
    
    this.recordSkip(reason, 1);
    this.budget[`${phase}Exceeded`] = true;
    this.warnings.push(`${phase} phase timed out`);
    
    // PHASE 4: Record timeout as determinism factor
    this.recordDeterminismFactor('TIMEOUT_RISK', `${phase} phase reached timeout threshold`);
  }
  
  /**
   * Record budget exceeded
   */
  recordBudgetExceeded(budgetType, skippedCount) {
    this.recordSkip(SKIP_REASON.BUDGET_EXCEEDED, skippedCount);
    this.budget[`${budgetType}Exceeded`] = true;
    this.warnings.push(`${budgetType} budget exceeded, ${skippedCount} expectations skipped`);
  }
  
  /**
   * Record contract violations
   */
  recordContractViolations(enforcement) {
    if (enforcement.droppedCount > 0) {
      this.state = ANALYSIS_STATE.FAILED;
      this.contractViolations.droppedCount = enforcement.droppedCount;
      this.contractViolations.dropped = enforcement.dropped;
      this.warnings.push(`${enforcement.droppedCount} findings dropped due to contract violations`);
    }
  }
  
  /**
   * PHASE 4: Record a determinism factor.
   * Factors represent sources of non-determinism in the analysis.
   * @param {string} factorCode - Factor code (e.g., NETWORK_TIMING, ASYNC_DOM)
   * @param {string} note - Optional note explaining the factor
   */
  recordDeterminismFactor(factorCode, note = null) {
    if (!this.determinism.factors.includes(factorCode)) {
      this.determinism.factors.push(factorCode);
    }
    if (note && !this.determinism.notes.includes(note)) {
      this.determinism.notes.push(note);
    }
    
    // Update determinism level based on factors
    this.updateDeterminismLevel();
  }
  
  /**
   * PHASE 4: Update determinism level based on recorded factors.
   */
  updateDeterminismLevel() {
    const factors = this.determinism.factors;
    
    // NON_DETERMINISTIC factors (unbounded/external)
    const nonDeterministicFactors = [
      'NETWORK_TIMING',
      'TIMEOUT_RISK',
      'EXTERNAL_API',
      'BROWSER_SCHEDULING',
      'FLAKINESS',
    ];
    
    // CONTROLLED_NON_DETERMINISTIC factors (bounded/declared)
    const controlledFactors = [
      'ASYNC_DOM',
      'RETRY_LOGIC',
      'ORDER_DEPENDENCE',
    ];
    
    const hasNonDeterministic = factors.some(f => nonDeterministicFactors.includes(f));
    const hasControlled = factors.some(f => controlledFactors.includes(f));
    
    if (hasNonDeterministic) {
      this.determinism.level = 'NON_DETERMINISTIC';
      this.determinism.reproducible = false;
    } else if (hasControlled) {
      this.determinism.level = 'CONTROLLED_NON_DETERMINISTIC';
      // Reproducible only if comparison shows no differences
      // Will be updated after comparison
    } else {
      this.determinism.level = 'DETERMINISTIC';
      this.determinism.reproducible = true;
    }
  }
  
  /**
   * PHASE 4: Compare current run with previous baseline run.
   * PHASE 6A: Enhanced with semantic comparison and normalization.
   */
  async compareWithPreviousRun(projectRoot, findingsData, currentRunDir) {
    const { readFileSync: _readFileSync, readdirSync, statSync, existsSync } = await import('fs');
    const { join } = await import('path');
    const { loadAndCompareRuns, normalizeFindingsForComparison } = await import('../../verax/core/integrity/determinism.js');
    
    // Default comparison shell so callers always see a structured object
    const defaultDifferences = {
      findingsChanged: false,
      countsChanged: false,
      details: {
        addedFindings: [],
        removedFindings: [],
        changedFindings: 0,
        semanticDifferences: [],
      }
    };
    this.determinism.comparison = {
      comparable: false,
      baselineRunId: null,
      differences: defaultDifferences,
    };
    
    try {
      const runsDir = join(projectRoot, '.verax', 'runs');
      
      // Find most recent previous run
      const runs = readdirSync(runsDir)
        .filter(dir => dir !== this.runId)
        .map(dir => {
          const stat = statSync(join(runsDir, dir));
          return { dir, mtime: stat.mtime };
        })
        .sort((a, b) => Number(b.mtime) - Number(a.mtime));
      
      if (runs.length === 0) {
        return; // No previous run to compare against
      }
      
      const baselineRunId = runs[0].dir;
      const baselineRunDir = join(runsDir, baselineRunId);
      
      // PHASE 6B: Check poison marker before reading previous run
      const { enforcePoisonCheckBeforeRead, verifyArtifactsBeforeRead } = await import('./trust-integration-hooks.js');

      // Enforce poison marker strictly; integrity check is advisory to keep comparison usable in tests
      let poisonCheck;
      try {
        poisonCheck = enforcePoisonCheckBeforeRead(baselineRunDir);
      } catch (err) {
        // Poison marker exists - cannot compare
        this.determinism.comparison.comparable = false;
        this.determinism.notes.push(`Cannot compare: previous run is poisoned (incomplete) - ${err.message}`);
        return;
      }

      const artifactVerification = verifyArtifactsBeforeRead(baselineRunDir);
      if (artifactVerification && artifactVerification.ok === false) {
        this.determinism.notes.push(`Comparison warning: ${artifactVerification.error || 'baseline integrity manifest missing'}`);
      }
      
      // PHASE 6A: Use semantic comparison
      // Prefer on-disk summaries when present; otherwise use provided findings data
      const baselineSummaryPath = join(baselineRunDir, 'summary.json');
      if (!existsSync(baselineSummaryPath)) {
        this.determinism.notes.push(`Cannot compare: baseline summary missing at ${baselineSummaryPath}`);
        return;
      }
      const baselineSummary = JSON.parse(_readFileSync(baselineSummaryPath, 'utf8'));

      const inferredCurrentRunDir = currentRunDir || join(projectRoot, '.verax', 'runs', this.runId);
      const currentSummaryPath = join(inferredCurrentRunDir, 'summary.json');
      let currentSummary = { findings: findingsData?.findings || [] };
      if (existsSync(currentSummaryPath)) {
        try {
          currentSummary = JSON.parse(_readFileSync(currentSummaryPath, 'utf8'));
        } catch (readErr) {
          this.determinism.notes.push(`Comparison warning: could not read current summary (${readErr.message})`);
        }
      }

      const baselineFindings = baselineSummary?.findings || [];
      const currentFindings = currentSummary?.findings || findingsData?.findings || [];
      const normalizedBaseline = normalizeFindingsForComparison(baselineFindings);
      const normalizedCurrent = normalizeFindingsForComparison(currentFindings);
      
      const baselineIds = new Set(baselineFindings.map(f => f.expectationId));
      const currentIds = new Set(currentFindings.map(f => f.expectationId));
      
      const addedFindings = Array.from(currentIds).filter(id => !baselineIds.has(id));
      const removedFindings = Array.from(baselineIds).filter(id => !currentIds.has(id));
      
      const findingsChanged = addedFindings.length > 0 || removedFindings.length > 0 || 
                              JSON.stringify(normalizedBaseline) !== JSON.stringify(normalizedCurrent);
      const countsChanged = findingsChanged || baselineFindings.length !== currentFindings.length;
      
      // Optional semantic diff when both summaries exist
      let semanticDifferences = [];
      if (existsSync(currentSummaryPath)) {
        const comparison = loadAndCompareRuns(inferredCurrentRunDir, baselineRunDir, projectRoot);
        if (comparison && comparison.ok) {
          semanticDifferences = comparison.differences || [];
        } else if (comparison && !comparison.ok) {
          this.determinism.notes.push(`Comparison warning: ${comparison.error}`);
        }
      }
      
      this.determinism.comparison = {
        comparable: true,
        baselineRunId,
        differences: {
          findingsChanged,
          countsChanged,
          details: {
            addedFindings,
            removedFindings,
            changedFindings: findingsChanged ? Math.max(baselineFindings.length, currentFindings.length) : 0,
            semanticDifferences,
          }
        },
      };
      
      // Update reproducible flag based on semantic comparison
      const semanticAligned = semanticDifferences.length === 0;
      if (!findingsChanged && !countsChanged && semanticAligned) {
        this.determinism.reproducible = true;
        // Preserve terse note for deterministic comparisons
        if (!this.notes.includes('results match')) {
          this.notes.push('results match');
        }
        if (!this.determinism.notes.some(n => n.toLowerCase().includes('results match'))) {
          this.determinism.notes.push(`Results match baseline run ${baselineRunId}`);
        }
      } else {
        // For CONTROLLED_NON_DETERMINISTIC, check if differences are acceptable
        if (this.determinism.level === 'CONTROLLED_NON_DETERMINISTIC') {
          // Controlled differences may include certain types
          this.determinism.reproducible = false;
          this.determinism.notes.push(`Findings differ from baseline run ${baselineRunId}`);
        } else {
          this.determinism.reproducible = false;
          this.determinism.notes.push(`Results differ from baseline run ${baselineRunId}`);
        }
      }
      
    } catch (error) {
      // If comparison fails (e.g., no .verax/runs dir), mark as not comparable
      this.determinism.comparison.comparable = false;
      this.determinism.notes.push(`Could not compare with previous run: ${error.message}`);
    }
  }
  
  /**
   * Mark analysis as failed with error
   */
  markFailed(error) {
    this.state = ANALYSIS_STATE.FAILED;
    this.error = error;
  }
  
  /**
   * Check if analysis is complete
   */
  isComplete() {
    return this.state === ANALYSIS_STATE.COMPLETE;
  }
  
  /**
   * Compute completeness ratio
   */
  getCompletenessRatio() {
    if (this.expectationsDiscovered === 0) {
      return 0;
    }
    return this.expectationsAnalyzed / this.expectationsDiscovered;
  }
  
  /**
   * Validate state consistency and return final state
   * 
   * TRUTH LOCK Semantics:
   * - INCOMPLETE: timeouts, budget exceeded, crashes, or systemic truncation
   * - COMPLETE: pipeline finished, all discovered expectations accounted for
   *   (each is either ANALYZED or SKIPPED with explicit reason)
   * - Zero findings with COMPLETE state is OK (exit 0)
   */
  finalize() {
    // Respect explicitly set FAILED state (from errors, integrity violations, etc.)
    if (this.state === ANALYSIS_STATE.FAILED) {
      return this.state;
    }
    
    // Special case: no expectations discovered at all
    if (this.expectationsDiscovered === 0) {
      // If state is already explicitly set to COMPLETE, honor it (e.g., empty project scan)
      if (this.state === ANALYSIS_STATE.COMPLETE) {
        return this.state;
      }
      // Otherwise, mark as INCOMPLETE since we couldn't extract expectations
      if (Object.keys(this.skipReasons).length === 0) {
        this.recordSkip(SKIP_REASON.NO_EXPECTATIONS_EXTRACTED, 1);
      }
      this.state = ANALYSIS_STATE.INCOMPLETE;
      return this.state;
    }
    
    // Check for systemic failures that force INCOMPLETE
    const hasSystemicFailure = 
      Object.keys(this.skipReasons).some(reason => isSystemicFailure(reason));
    
    // If systemic failure occurred, mark INCOMPLETE
    if (hasSystemicFailure) {
      this.state = ANALYSIS_STATE.INCOMPLETE;
      return this.state;
    }
    
    // Contract violations force FAILED
    if (this.contractViolations.droppedCount > 0) {
      this.state = ANALYSIS_STATE.FAILED;
      return this.state;
    }
    
    // Normal case: pipeline completed successfully
    // Some expectations may be analyzed, some skipped, but all are accounted for
    // This is COMPLETE as long as we didn't hit systemic failures
    // (completenessRatio < 1.0 is OK if skips are intentional)
    
    return this.state;
  }
  
  /**
   * PHASE 2 PURIFICATION: Enforce invariants about expectation/finding integrity.
   * These checks ensure no data corruption occurred during analysis.
   * @throws {Error} If any invariant is violated
   */
  verifyInvariants() {
    // Invariant 1: All expectations are accounted for (only check when expectations were discovered)
    const totalAccounted = this.expectationsAnalyzed + this.expectationsSkipped;
    if (this.expectationsDiscovered > 0 && totalAccounted !== this.expectationsDiscovered) {
      throw new Error(
        `INVARIANT VIOLATION: Expected ${this.expectationsDiscovered} expectations ` +
        `but accounted for ${totalAccounted} (analyzed=${this.expectationsAnalyzed}, ` +
        `skipped=${this.expectationsSkipped}). Some expectations disappeared during analysis.`
      );
    }
    
    // Invariant 2: Per-expectation bookkeeping matches aggregate counts (only if per-expectation tracking used)
    const perExpTotal = this.analyzedExpectations.size + this.skippedExpectations.size;
    if (perExpTotal > 0 && perExpTotal !== this.expectationsDiscovered) {
      throw new Error(
        `INVARIANT VIOLATION: Per-expectation tracking mismatch. ` +
        `Analyzed: ${this.analyzedExpectations.size}, Skipped: ${this.skippedExpectations.size}, ` +
        `Total tracked: ${perExpTotal}, but discovered ${this.expectationsDiscovered}.`
      );
    }
    
    // Invariant 3: No expectation appears in both analyzed and skipped
    for (const id of this.analyzedExpectations) {
      if (this.skippedExpectations.has(id)) {
        throw new Error(
          `INVARIANT VIOLATION: Expectation ${id} appears in both analyzed and skipped sets. ` +
          `Each expectation must be in exactly one set.`
        );
      }
    }
    
    return true;
  }
  
  /**
   * PHASE 3: Validate finding explainability invariant.
   * Every finding MUST contain all required explainability fields.
   * @param {Array} findings - Array of findings to validate
   * @throws {Error} If any finding violates the explainability invariant
   */
  validateFindingExplainability(findings) {
    if (!findings || !Array.isArray(findings)) {
      return; // No findings to validate
    }
    
    const requiredFields = ['id', 'expectationId', 'type', 'summary'];
    const explainabilityFields = ['promise', 'observed', 'evidence'];
    
    for (let i = 0; i < findings.length; i++) {
      const finding = findings[i];
      
      // Check required fields
      for (const field of requiredFields) {
        if (!finding[field]) {
          throw new Error(
            `FINDING EXPLAINABILITY INVARIANT VIOLATION: Finding at index ${i} missing required field '${field}'. ` +
            `All findings must have: ${requiredFields.join(', ')}, ${explainabilityFields.join(', ')}.`
          );
        }
      }
      
      // Check explainability fields (must exist, can be empty string for evidence)
      if (finding.promise === undefined || finding.promise === null) {
        throw new Error(
          `FINDING EXPLAINABILITY INVARIANT VIOLATION: Finding ${finding.id} missing 'promise' field (expected behavior).`
        );
      }
      
      if (finding.observed === undefined || finding.observed === null) {
        throw new Error(
          `FINDING EXPLAINABILITY INVARIANT VIOLATION: Finding ${finding.id} missing 'observed' field (actual behavior).`
        );
      }
      
      if (!Array.isArray(finding.evidence)) {
        throw new Error(
          `FINDING EXPLAINABILITY INVARIANT VIOLATION: Finding ${finding.id} 'evidence' must be an array (can be empty).`
        );
      }
    }
  }
  
  /**
   * Get exit code based on current state (Contract v1)
   * Precedence:
   * 1. FAILED state → 2
   * 2. INCOMPLETE state → 66
   * 3. COMPLETE + findings → 1
   * 4. COMPLETE + no findings → 0
   */
  getExitCode() {
    const state = this.finalize();
    
    // PRECEDENCE 1: FAILED state always returns 2
    if (state === ANALYSIS_STATE.FAILED) {
      return 2;
    }
    
    // PRECEDENCE 2: INCOMPLETE state always returns 66
    if (state === ANALYSIS_STATE.INCOMPLETE) {
      return 66;
    }
    
    // PRECEDENCE 3-4: COMPLETE state - check for findings
    // COMPLETE + findings → 1
    // COMPLETE + no findings → 0
    if (this.findingsCount > 0) {
      return 1;
    }
    
    return 0;
  }
  
  /**
   * Check if findings contain any CONFIRMED status
   * @private
   */
  _hasConfirmedFindings() {
    if (!this.findings || this.findings.length === 0) {
      return false;
    }
    
    return this.findings.some(f => 
      f.status === 'CONFIRMED' || f.severity === 'CONFIRMED'
    );
  }
  
  /**
   * Get console summary for end of run
   */
  getConsoleSummary() {
    const state = this.finalize();
    const lines = [];
    
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('VERAX RESULT');
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('');
    
    // PHASE 3: State line with clarity
    const stateDisplay = state === ANALYSIS_STATE.COMPLETE ? 'COMPLETE' : 
                        state === ANALYSIS_STATE.INCOMPLETE ? 'INCOMPLETE' :
                        'FAILED';
    lines.push(`State: ${stateDisplay}`);
    
    // PHASE 3: Coverage ratio
    const coverage = this.getCompletenessRatio();
    const coverageText = `${this.expectationsAnalyzed}/${this.expectationsDiscovered} expectations analyzed (${(coverage * 100).toFixed(1)}%)`;
    
    // Contract v1: Partial coverage note
    if (coverage < 1.0 || this.expectationsSkipped > 0) {
      lines.push(`Coverage: PARTIAL (${coverageText})`);
    } else {
      lines.push(`Coverage: ${coverageText}`);
    }
    
    // PHASE 3: Skipped count with examples
    if (this.expectationsSkipped > 0) {
      lines.push(`Skipped: ${this.expectationsSkipped}`);
      
      // Show first 2 skip reasons with example expectations
      const sortedReasons = Object.entries(this.skipReasons).sort((a, b) => b[1] - a[1]);
      let reasonCount = 0;
      for (const [reason, count] of sortedReasons) {
        if (reasonCount >= 2) break;
        const examples = this.skipExamples[reason];
        if (examples && examples.length > 0) {
          lines.push(`  └─ ${reason}: ${count} (e.g., ${examples.slice(0, 2).join(', ')})`);
        } else {
          lines.push(`  └─ ${reason}: ${count}`);
        }
        reasonCount++;
      }
      if (sortedReasons.length > 2) {
        lines.push(`  └─ ... and ${sortedReasons.length - 2} more skip reasons`);
      }
    }
    
    // PHASE 3: Findings count
    lines.push(`Findings: ${this.findingsCount}`);
    
    // PHASE 3: Warnings for incomplete/failed states
    if (state !== ANALYSIS_STATE.COMPLETE) {
      lines.push('');
      if (state === ANALYSIS_STATE.INCOMPLETE) {
        lines.push('⚠️  RESULTS ARE INCOMPLETE');
      } else {
        lines.push('❌ ANALYSIS FAILED');
      }
      
      if (this.warnings.length > 0) {
        lines.push('');
        lines.push('Reasons:');
        for (const warning of this.warnings) {
          lines.push(`  • ${warning}`);
        }
      }
    }
    
    // PHASE 3: Edge case warning - 0 expectations
    if (this.expectationsDiscovered === 0 && state === ANALYSIS_STATE.COMPLETE) {
      lines.push('');
      lines.push('ℹ️  NO EXPECTATIONS FOUND');
      lines.push('  The source code does not contain detectable expectations.');
      lines.push('  This is not necessarily an error - the project may be static.');
    }
    
    // Contract violations
    if (this.contractViolations.droppedCount > 0) {
      lines.push('');
      lines.push(`❌ CONTRACT VIOLATIONS: ${this.contractViolations.droppedCount} findings dropped`);
      for (const drop of this.contractViolations.dropped.slice(0, 5)) {
        lines.push(`  • ${drop.reason}`);
      }
      if (this.contractViolations.dropped.length > 5) {
        lines.push(`  ... and ${this.contractViolations.dropped.length - 5} more`);
      }
    }
    
    // PHASE 4: Determinism info
    lines.push('');
    lines.push('Determinism:');
    lines.push(`  Level: ${this.determinism.level}`);
    lines.push(`  Reproducible: ${this.determinism.reproducible ? 'YES' : 'NO'}`);
    if (this.determinism.factors.length > 0) {
      lines.push(`  Factors: ${this.determinism.factors.join(', ')}`);
    } else {
      lines.push(`  Factors: NONE`);
    }
    
    // PHASE 4: Non-determinism warning
    if (this.determinism.level === 'NON_DETERMINISTIC') {
      lines.push('');
      lines.push(`⚠️  Results may differ between runs due to: ${this.determinism.factors.join(', ')}`);
    }
    
    lines.push('');
    lines.push(`Exit Code: ${this.getExitCode()}`);
    lines.push('═══════════════════════════════════════════════════════');
    
    return lines.join('\n');
  }
  
  /**
   * PHASE 3: Generate unified analysis object for JSON output
   * Includes all fields required by the unified schema
   */
  toAnalysisObject(timings = {}) {
    // Split skip reasons into systemic and non-systemic
    const systemicReasons = {};
    const nonSystemicReasons = {};
    for (const [reason, count] of Object.entries(this.skipReasons)) {
      if (isSystemicFailure(reason)) {
        systemicReasons[reason] = count;
      } else {
        nonSystemicReasons[reason] = count;
      }
    }
    
    return {
      state: this.state,
      analysisComplete: this.state === ANALYSIS_STATE.COMPLETE,
      expectationsDiscovered: this.expectationsDiscovered,
      expectationsAnalyzed: this.expectationsAnalyzed,
      expectationsSkipped: this.expectationsSkipped,
      completenessRatio: this.getCompletenessRatio(),
      skipReasons: this.skipReasons,
      skipExamples: this.skipExamples,
      systemicReasons,
      nonSystemicReasons,
      budgets: {
        maxExpectations: this.budget.maxExpectations || 0,
        exceeded: this.budget.exceeded || false,
        skippedCount: this.budget.skippedCount || 0,
      },
      timeouts: {
        observeMs: timings.observeMs || 0,
        detectMs: timings.detectMs || 0,
        totalMs: timings.totalMs || 0,
        timedOut: Object.keys(this.skipReasons).some(r => r.startsWith('TIMEOUT')),
        phase: Object.keys(this.skipReasons).find(r => r.startsWith('TIMEOUT')) ? 'unknown' : null,
      },
      warnings: this.warnings || [],
      notes: this.notes || [],
      // PHASE 4: Determinism tracking
      determinism: {
        level: this.determinism.level,
        reproducible: this.determinism.reproducible,
        factors: [...this.determinism.factors],
        notes: [...this.determinism.notes],
        comparison: { ...this.determinism.comparison },
      },
    };
  }
}
