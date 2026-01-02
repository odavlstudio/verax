/**
 * Coverage Model — Truth-Safe Coverage Analysis
 * 
 * Computes coverage metrics with explicit status and reasons.
 * Guardian must NEVER say READY if coverage is insufficient or critical steps are untestable.
 */

const COVERAGE_THRESHOLD = 0.7;  // 70% minimum coverage for READY eligibility

const NA_CATEGORY = {
  BY_DESIGN: 'NA_BY_DESIGN',           // Intentionally skipped (non-critical, allowed)
  BY_UNCERTAINTY: 'NA_BY_UNCERTAINTY'  // Selector missing/ambiguous, MUST affect verdict
};

const MISSING_REASON = {
  SELECTOR_MISSING: 'SELECTOR_MISSING',
  SELECTOR_AMBIGUOUS: 'SELECTOR_AMBIGUOUS',
  TIMEOUT: 'TIMEOUT',
  NAVIGATION_BLOCKED: 'NAVIGATION_BLOCKED',
  USER_FILTERED: 'USER_FILTERED',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
};

const SELECTOR_CONFIDENCE = {
  HIGH: 'HIGH',      // data-testid, data-guardian
  MEDIUM: 'MEDIUM',  // role-based, aria-label
  LOW: 'LOW'         // class, nth-child, text
};

/**
 * Compute coverage summary before decision authority
 * 
 * @param {Array} attempts - Attempt results
 * @param {Array} flows - Flow results
 * @param {Object} audit - Audit information with coverage breakdown
 * @returns {Object} Coverage summary with status and reasons
 */
function computeCoverageSummary(attempts = [], flows = [], audit = {}) {
  // Count outcomes
  const executedAttempts = (audit.executedAttempts || []).length;
  const totalAttempts = audit.totalAttempts || attempts.length;
  
  // Count NOT_APPLICABLE by category
  const naByDesign = (audit.notTested?.notApplicable || []).filter(
    a => a.reason && a.reason.includes('DESIGN')
  ).length;
  
  const naByUncertainty = (audit.notTested?.notApplicable || []).filter(
    a => !a.reason || !a.reason.includes('DESIGN')
  ).length;
  
  const skippedUserFiltered = (audit.notTested?.userFiltered || []).length;
  const skippedDisabled = (audit.notTested?.disabledByPreset || []).length;
  
  // Compute critical tests: total excluding non-critical skips
  // NA_BY_DESIGN is intentional, so not counted against coverage
  const criticalTotal = executedAttempts + naByUncertainty + skippedUserFiltered + skippedDisabled;
  const criticalTested = executedAttempts;
  const criticalSkipped = totalAttempts - executedAttempts;
  
  // Coverage ratio: tested / (total - NA_BY_DESIGN)
  const coverageRatio = criticalTotal > 0 
    ? criticalTested / criticalTotal 
    : 0;
  
  // Coverage status
  const coverageStatus = coverageRatio >= COVERAGE_THRESHOLD 
    ? 'OK'
    : 'INSUFFICIENT';
  
  // Build missing reasons
  const missingReasons = [];
  
  if (naByUncertainty > 0) {
    missingReasons.push({
      code: MISSING_REASON.SELECTOR_MISSING,
      count: naByUncertainty,
      message: `${naByUncertainty} critical step(s) had missing/ambiguous selectors`
    });
  }
  
  if (skippedUserFiltered > 0) {
    missingReasons.push({
      code: MISSING_REASON.USER_FILTERED,
      count: skippedUserFiltered,
      message: `${skippedUserFiltered} step(s) filtered by user`
    });
  }
  
  if (coverageStatus === 'INSUFFICIENT') {
    missingReasons.push({
      code: 'COVERAGE_INSUFFICIENT',
      ratio: coverageRatio.toFixed(2),
      threshold: COVERAGE_THRESHOLD,
      message: `Coverage ${(coverageRatio * 100).toFixed(1)}% below threshold ${(COVERAGE_THRESHOLD * 100).toFixed(0)}%`
    });
  }
  
  return {
    criticalTotal,
    criticalTested,
    criticalSkipped,
    coverageRatio,
    coverageStatus,
    missingReasons,
    naByDesignCount: naByDesign,
    naByUncertaintyCount: naByUncertainty,
    userFilteredCount: skippedUserFiltered
  };
}

/**
 * Compute selector confidence aggregates
 * 
 * @param {Array} attempts - Attempt results with interaction details
 * @returns {Object} Selector confidence summary
 */
function computeSelectorConfidence(attempts = []) {
  const confidences = [];
  const interactions = [];
  
  // Collect selector confidences from all attempts
  attempts.forEach(attempt => {
    if (attempt.interactions && Array.isArray(attempt.interactions)) {
      attempt.interactions.forEach(interaction => {
        const confidence = inferSelectorConfidence(interaction);
        confidences.push(confidence);
        interactions.push({
          step: interaction.step || interaction.description || 'unknown',
          confidence,
          selector: interaction.selector || 'none'
        });
      });
    }
  });
  
  // Aggregate
  const confidenceMap = {
    [SELECTOR_CONFIDENCE.HIGH]: 0,
    [SELECTOR_CONFIDENCE.MEDIUM]: 0,
    [SELECTOR_CONFIDENCE.LOW]: 0
  };
  
  confidences.forEach(c => {
    confidenceMap[c] = (confidenceMap[c] || 0) + 1;
  });
  
  const total = confidences.length;
  const minConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => {
        const order = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return order[a] < order[b] ? a : b;
      })
    : null;
  
  const avgConfidence = total > 0
    ? (confidenceMap[SELECTOR_CONFIDENCE.HIGH] * 3 + 
       confidenceMap[SELECTOR_CONFIDENCE.MEDIUM] * 2 + 
       confidenceMap[SELECTOR_CONFIDENCE.LOW] * 1) / (total * 3)
    : 0;
  
  return {
    selectorConfidenceMin: minConfidence,
    selectorConfidenceAvg: avgConfidence,
    confidenceCounts: confidenceMap,
    interactions: interactions.slice(0, 10)  // Top 10 interactions
  };
}

/**
 * Infer selector confidence from selector attributes
 * 
 * @param {Object} interaction - Interaction object
 * @returns {string} Confidence level
 */
function inferSelectorConfidence(interaction) {
  const selector = (interaction.selector || '').toLowerCase();
  
  // HIGH: data-testid, data-guardian
  if (selector.includes('data-testid') || 
      selector.includes('data-guardian') ||
      selector.includes('[data-testid') ||
      selector.includes('[data-guardian')) {
    return SELECTOR_CONFIDENCE.HIGH;
  }
  
  // MEDIUM: role-based, aria-label, id
  if (selector.includes('role=') || 
      selector.includes('[role=') ||
      selector.includes('aria-label') ||
      selector.includes('[aria-label') ||
      selector.match(/^#[\w-]+$/) ||  // #id
      selector.includes('[id=')) {
    return SELECTOR_CONFIDENCE.MEDIUM;
  }
  
  // LOW: class, nth-child, text, universal
  return SELECTOR_CONFIDENCE.LOW;
}

/**
 * Determine if NOT_APPLICABLE is by design or by uncertainty
 * 
 * @param {Object} skipReason - Skip reason details
 * @returns {string} NA_CATEGORY
 */
function categorizeNotApplicable(skipReason = {}) {
  const code = skipReason.skipReasonCode || skipReason.code || '';
  const message = skipReason.message || '';
  
  // BY_DESIGN: intentional, non-critical
  if (code.includes('DESIGN') || 
      message.includes('not critical') ||
      message.includes('intentional')) {
    return NA_CATEGORY.BY_DESIGN;
  }
  
  // BY_UNCERTAINTY: selector missing, ambiguous UI, etc.
  if (code.includes('SELECTOR') ||
      message.includes('selector') ||
      message.includes('ambiguous') ||
      message.includes('uncertain')) {
    return NA_CATEGORY.BY_UNCERTAINTY;
  }
  
  // Default to BY_UNCERTAINTY (safer for verdict)
  return NA_CATEGORY.BY_UNCERTAINTY;
}

module.exports = {
  computeCoverageSummary,
  computeSelectorConfidence,
  inferSelectorConfidence,
  categorizeNotApplicable,
  COVERAGE_THRESHOLD,
  NA_CATEGORY,
  MISSING_REASON,
  SELECTOR_CONFIDENCE
};
