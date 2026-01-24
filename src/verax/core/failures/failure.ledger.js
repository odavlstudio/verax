/**
 * PHASE 21.5 — Failure Ledger
 * 
 * Enterprise artifact that records all failures (even recovered ones).
 * Deterministic, append-only, never missing.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname as _dirname } from 'path';
import { validateFailure } from './failure.types.js';
// Use CLI time provider shared across modules
import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

/**
 * Failure Ledger
 * 
 * Maintains an ordered list of all failures during execution.
 */
export class FailureLedger {
  constructor(runId, projectDir) {
    this.runId = runId;
    this.projectDir = projectDir;
    this.failures = [];
    this.timeProvider = getTimeProvider();
    this.startTime = this.timeProvider.now();
  }
  
  /**
   * Record a failure
   * 
   * @param {Object} failure - Failure object
   * @ts-expect-error - Failure type not imported
   */
  record(failure) {
    validateFailure(failure);
    
    // Add sequence number for deterministic ordering
    const sequencedFailure = {
      ...failure,
      sequence: this.failures.length,
      relativeTime: this.timeProvider.now() - this.startTime
    };
    
    this.failures.push(sequencedFailure);
  }
  
  /**
   * Get failure summary
   * 
   * @returns {Object} Summary with counts by severity
   */
  getSummary() {
    const summary = {
      total: this.failures.length,
      bySeverity: {
        BLOCKING: 0,
        DEGRADED: 0,
        WARNING: 0
      },
      byCategory: {},
      byPhase: {},
      highestSeverity: null
    };
    
    for (const failure of this.failures) {
      summary.bySeverity[failure.severity] = (summary.bySeverity[failure.severity] || 0) + 1;
      summary.byCategory[failure.category] = (summary.byCategory[failure.category] || 0) + 1;
      summary.byPhase[failure.phase] = (summary.byPhase[failure.phase] || 0) + 1;
    }
    
    // Determine highest severity
    if (summary.bySeverity.BLOCKING > 0) {
      summary.highestSeverity = 'BLOCKING';
    } else if (summary.bySeverity.DEGRADED > 0) {
      summary.highestSeverity = 'DEGRADED';
    } else if (summary.bySeverity.WARNING > 0) {
      summary.highestSeverity = 'WARNING';
    }
    
    return summary;
  }
  
  /**
   * Get highest severity for exit code determination
   * 
   * @returns {string|null} Highest severity or null if no failures
   */
  getHighestSeverity() {
    const summary = this.getSummary();
    return summary.highestSeverity;
  }
  
  /**
   * Write ledger to file
   * 
   * @returns {string} Path to ledger file
   */
  write() {
    if (!this.runId || !this.projectDir) {
      throw new Error('Cannot write failure ledger: runId and projectDir required');
    }
    
    const runsDir = resolve(this.projectDir, '.verax', 'runs', this.runId);
    mkdirSync(runsDir, { recursive: true });
    
    const ledgerPath = resolve(runsDir, 'failure.ledger.json');
    
    const ledgerData = {
      runId: this.runId,
      startTime: this.startTime,
      endTime: this.timeProvider.now(),
      duration: this.timeProvider.now() - this.startTime,
      summary: this.getSummary(),
      failures: this.failures
    };
    
    writeFileSync(ledgerPath, JSON.stringify(ledgerData, null, 2), 'utf-8');
    
    return ledgerPath;
  }
  
  /**
   * Export ledger data (for testing)
   * 
   * @returns {Object} Ledger data
   */
  export() {
    return {
      runId: this.runId,
      startTime: this.startTime,
      summary: this.getSummary(),
      failures: this.failures
    };
  }
}




