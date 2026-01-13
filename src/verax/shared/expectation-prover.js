/**
 * NO-GUESSING GUARANTEE
 * 
 * VERAX only generates findings from PROVEN expectations.
 * Unproven expectations become coverage gaps, not failures.
 * 
 * This module provides the single source of truth for "what is proven?"
 */

/**
 * Check if an expectation is PROVEN.
 * 
 * ABSOLUTE RULES:
 * - Returns true ONLY if the expectation has definitive code evidence
 * - Returns false for heuristic/label-matched/guessed expectations
 * 
 * @param {Object} expectation - Expectation object to check
 * @returns {boolean} - true if PROVEN, false otherwise
 */
export function isProvenExpectation(expectation) {
  if (!expectation) {
    return false;
  }
  
  // Rule 1: Explicit proof marker
  if (expectation.proof === 'PROVEN_EXPECTATION') {
    return true;
  }
  
  // Rule 2: Has sourceRef with file + line (code location)
  if (expectation.sourceRef) {
    const ref = expectation.sourceRef;
    // Must include file path AND line number (format: "file.js:123")
    if (typeof ref === 'string' && ref.includes(':')) {
      const parts = ref.split(':');
      if (parts.length >= 2 && parts[1].match(/^\d+$/)) {
        return true;
      }
    }
  }
  
  // Rule 3: Static HTML expectations with evidence.source (file path)
  if (expectation.evidence && expectation.evidence.source) {
    // Static HTML parsing provides file path as evidence
    return true;
  }
  
  // Rule 4: Explicit proven flag
  if (expectation.proven === true) {
    return true;
  }
  
  // Everything else is unproven
  return false;
}

/**
 * Create a coverage gap entry for an unproven expectation.
 * 
 * @param {Object} expectation - The unproven expectation
 * @param {Object} interaction - The interaction that triggered this gap
 * @returns {Object} - Coverage gap entry
 */
export function createCoverageGap(expectation, interaction) {
  return {
    expectationId: expectation.id || null,
    type: expectation.type || 'unknown',
    reason: 'UNPROVEN_EXPECTATION',
    source: expectation.sourceRef || expectation.source?.file || expectation.evidence?.source || null,
    interaction: {
      type: interaction.type,
      selector: interaction.selector,
      label: interaction.label || null
    },
    metadata: {
      proof: expectation.proof || 'none',
      expectationType: expectation.type,
      targetPath: expectation.targetPath || null
    }
  };
}
