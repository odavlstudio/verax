/**
 * Phase F2 – Soft Evidence Budget (warnings only, NO enforcement)
 * 
 * CRITICAL: This is a soft budget implementation.
 * - Emits warnings when evidence size exceeds threshold
 * - NEVER blocks, throws, or alters behavior
 * - NEVER trims or discards evidence
 * - Hard enforcement happens in Phase F3
 * 
 * @module evidence-budget
 */

// Phase F2 – Default soft budget limits (instrumentation only)
const DEFAULT_MAX_EVIDENCE_BYTES = 50 * 1024 * 1024; // 50MB
const DEFAULT_WARNING_THRESHOLD = 0.8; // 80%

/**
 * Check evidence size against soft budget limits.
 * 
 * Phase F2 – Soft budget only. Enforcement happens in Phase F3.
 * 
 * @param {Object} evidenceStats - Evidence statistics from EvidenceSizeTracker
 * @param {number} evidenceStats.totalBytes - Total bytes of evidence collected
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.maxBytes] - Maximum evidence bytes (default: 50MB)
 * @param {number} [options.warningThreshold] - Warning threshold (default: 0.8)
 * @returns {Object} Budget check result with level, percentUsed, maxBytes, usedBytes
 */
export function checkBudget(evidenceStats, options = {}) {
  try {
    // Phase F2 – Apply defaults
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_EVIDENCE_BYTES;
    const warningThreshold = options.warningThreshold ?? DEFAULT_WARNING_THRESHOLD;
    
    // Phase F2 – Safe extraction of total bytes
    const usedBytes = evidenceStats?.totalBytes ?? 0;
    
    // Phase F2 – Calculate percentage used (avoid division by zero)
    const percentUsed = maxBytes > 0 ? usedBytes / maxBytes : 0;
    
    // Phase F2 – Determine budget level (warning only, never blocks)
    const level = percentUsed >= warningThreshold ? 'warning' : 'ok';
    
    return {
      level,
      percentUsed,
      maxBytes,
      usedBytes,
    };
  } catch (error) {
    // Phase F2 – Never throw, return safe defaults
    return {
      level: 'ok',
      percentUsed: 0,
      maxBytes: DEFAULT_MAX_EVIDENCE_BYTES,
      usedBytes: 0,
    };
  }
}

/**
 * Check if evidence budget hard limit has been exceeded.
 * 
 * Phase F3 – Hard budget enforcement to prevent OOM.
 * CRITICAL: This enforces hard stop when budget exceeded.
 * 
 * @param {Object} evidenceStats - Evidence statistics from EvidenceSizeTracker
 * @param {number} evidenceStats.totalBytes - Total bytes of evidence collected
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.maxBytes] - Maximum evidence bytes (default: 50MB)
 * @returns {Object} Hard budget check result with exceeded, level, reason, maxBytes, usedBytes
 */
export function checkHardBudget(evidenceStats, options = {}) {
  try {
    // Phase F3 – Apply defaults for hard limit
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_EVIDENCE_BYTES;
    
    // Phase F3 – Safe extraction of total bytes
    const usedBytes = evidenceStats?.totalBytes ?? 0;
    
    // Phase F3 – Check if hard limit exceeded
    const exceeded = usedBytes > maxBytes;
    
    if (exceeded) {
      return {
        exceeded: true,
        level: 'hard-stop',
        reason: 'evidence-budget-exceeded',
        maxBytes,
        usedBytes,
      };
    }
    
    return {
      exceeded: false,
      level: 'ok',
      maxBytes,
      usedBytes,
    };
  } catch (error) {
    // Phase F3 – Never throw, return safe defaults (assume not exceeded on error)
    return {
      exceeded: false,
      level: 'ok',
      maxBytes: DEFAULT_MAX_EVIDENCE_BYTES,
      usedBytes: 0,
    };
  }
}

/**
 * Format evidence size in human-readable format.
 * 
 * Phase F2 – Helper for warning messages.
 * 
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted size (e.g., "45MB", "1.2GB")
 */
export function formatBytes(bytes) {
  try {
    if (bytes === 0) return '0B';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  } catch (error) {
    // Phase F2 – Never throw
    return '0B';
  }
}

/**
 * Emit budget warning to console.
 * 
 * Phase F2 – Soft budget only. Enforcement happens in Phase F3.
 * CRITICAL: This NEVER throws, NEVER blocks, NEVER alters execution.
 * 
 * @param {Object} budgetResult - Result from checkBudget()
 */
export function emitBudgetWarning(budgetResult) {
  try {
    // Phase F2 – Only warn if level is 'warning'
    if (budgetResult.level !== 'warning') {
      return;
    }
    
    const percentUsed = Math.round(budgetResult.percentUsed * 100);
    const usedFormatted = formatBytes(budgetResult.usedBytes);
    const maxFormatted = formatBytes(budgetResult.maxBytes);
    
    // Phase F2 – Emit warning (non-fatal, informational only)
    console.warn(
      `WARNING: Evidence size reached ${percentUsed}% of configured budget (${usedFormatted} / ${maxFormatted})`
    );
  } catch (error) {
    // Phase F2 – Never throw, silently continue
    // Logging failure must not affect execution
  }
}








