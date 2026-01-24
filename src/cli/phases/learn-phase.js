import { extractExpectations } from '../util/observation/expectation-extractor.js';

/**
 * Learn Phase
 * 
 * @param {Object} projectProfile - Project metadata
 * @returns {Promise<Object>} { expectations, skipped }
 */
export async function learnPhase(projectProfile) {
  const result = await extractExpectations(projectProfile, projectProfile.sourceRoot);
  return {
    expectations: result.expectations,
    skipped: result.skipped,
  };
}
