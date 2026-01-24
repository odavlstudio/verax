/**
 * Wave 9 — Expectation Coverage Signal
 * 
 * Computes and explains expectation coverage.
 */

/**
 * Calculate expectation coverage
 * @param {Object} context - Coverage context
 * @returns {Object} { discovered: number, exercised: number, coveragePercent: number, explanation: string }
 */
export function calculateCoverage(context = {}) {
  const {
    expectationsTotal = 0,
    expectationsUsed = 0
  } = context;
  
  const discovered = expectationsTotal;
  const exercised = expectationsUsed;
  
  let coveragePercent = 0;
  if (discovered > 0) {
    coveragePercent = Math.round((exercised / discovered) * 100);
  }
  
  let explanation = '';
  if (discovered === 0) {
    explanation = 'No expectations found in code';
  } else if (coveragePercent === 100) {
    explanation = 'All expectations were exercised';
  } else if (coveragePercent >= 50) {
    explanation = `${discovered - exercised} expectation(s) not exercised during scan`;
  } else {
    explanation = `Most expectations (${discovered - exercised}) were not exercised`;
  }
  
  return {
    discovered,
    exercised,
    coveragePercent,
    explanation
  };
}




