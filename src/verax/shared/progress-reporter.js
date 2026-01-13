/**
 * Wave 4 — Progress Reporter
 * 
 * Reports real-time progress during scan phases with actual counts.
 */

/**
 * Progress reporter that tracks real progress metrics
 */
export class ProgressReporter {
  constructor(options = {}) {
    this.output = options.output || process.stderr;
    this.silent = options.silent || false;
    this.explain = options.explain || false;
    
    // Phase tracking
    this.currentPhase = null;
    this.phaseProgress = {
      learn: { current: 0, total: 0, details: [] },
      validate: { current: 0, total: 0, details: [] },
      observe: { current: 0, total: 0, details: [] },
      detect: { current: 0, total: 0, details: [] }
    };
    
    // Interaction stats
    this.interactionStats = {
      discovered: 0,
      executed: 0,
      skipped: 0,
      skippedByReason: {}
    };
    
    // Expectation stats
    this.expectationStats = {
      total: 0,
      used: 0,
      unused: 0,
      unusedByReason: {}
    };
  }
  
  /**
   * Report phase start
   */
  startPhase(phase, message) {
    this.currentPhase = phase;
    if (!this.silent) {
      this.output.write(`[VERAX] [${phase}] ${message}\n`);
    }
  }
  
  /**
   * Report learn phase progress
   */
  reportLearnProgress(current, total, details = []) {
    this.phaseProgress.learn.current = current;
    this.phaseProgress.learn.total = total;
    this.phaseProgress.learn.details = details;
    
    if (!this.silent && total > 0) {
      this.output.write(`[VERAX] [1/4] Learn: ${current}/${total} expectations discovered\n`);
    }
  }
  
  /**
   * Report validate phase progress
   */
  reportValidateProgress(current, total) {
    this.phaseProgress.validate.current = current;
    this.phaseProgress.validate.total = total;
    
    if (!this.silent && total > 0) {
      this.output.write(`[VERAX] [2/4] Validate: ${current}/${total} routes checked\n`);
    }
  }
  
  /**
   * Report observe phase progress
   */
  reportObserveProgress(discovered, executed, skipped = 0, skippedByReason = {}) {
    this.interactionStats.discovered = discovered;
    this.interactionStats.executed = executed;
    this.interactionStats.skipped = skipped;
    this.interactionStats.skippedByReason = skippedByReason;
    
    if (!this.silent) {
      this.output.write(`[VERAX] [3/4] Observe: ${executed}/${discovered} interactions executed`);
      if (skipped > 0) {
        const reasons = Object.entries(skippedByReason)
          .map(([reason, count]) => `${reason}=${count}`)
          .join(', ');
        this.output.write(` (skipped: ${skipped} [${reasons}])\n`);
      } else {
        this.output.write('\n');
      }
    }
  }
  
  /**
   * Report detect phase progress
   */
  reportDetectProgress(evaluated, total, used = 0, unused = 0, unusedByReason = {}) {
    this.phaseProgress.detect.current = evaluated;
    this.phaseProgress.detect.total = total;
    this.expectationStats.total = total;
    this.expectationStats.used = used;
    this.expectationStats.unused = unused;
    this.expectationStats.unusedByReason = unusedByReason;
    
    if (!this.silent && total > 0) {
      this.output.write(`[VERAX] [4/4] Detect: ${evaluated}/${total} expectations evaluated`);
      if (unused > 0) {
        const reasons = Object.entries(unusedByReason)
          .map(([reason, count]) => `${reason}=${count}`)
          .join(', ');
        this.output.write(` (unused: ${unused} [${reasons}])\n`);
      } else {
        this.output.write('\n');
      }
    }
  }
  
  /**
   * Get progress statistics
   */
  getProgressStats() {
    return {
      learn: {
        current: this.phaseProgress.learn.current,
        total: this.phaseProgress.learn.total
      },
      validate: {
        current: this.phaseProgress.validate.current,
        total: this.phaseProgress.validate.total
      },
      observe: {
        current: this.interactionStats.executed,
        total: this.interactionStats.discovered
      },
      detect: {
        current: this.phaseProgress.detect.current,
        total: this.phaseProgress.detect.total
      }
    };
  }
  
  /**
   * Get interaction statistics
   */
  getInteractionStats() {
    return {
      discovered: this.interactionStats.discovered,
      executed: this.interactionStats.executed,
      skipped: this.interactionStats.skipped,
      skippedByReason: this.interactionStats.skippedByReason
    };
  }
  
  /**
   * Get expectation usage statistics
   */
  getExpectationUsageStats() {
    return {
      total: this.expectationStats.total,
      used: this.expectationStats.used,
      unused: this.expectationStats.unused,
      unusedByReason: this.expectationStats.unusedByReason
    };
  }
}

