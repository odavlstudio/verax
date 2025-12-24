/**
 * Semantic Contact Finder Integration
 * 
 * Integrates semantic contact detection into the scanning flow.
 * Works with Playwright to find contact links/forms in real pages.
 */

const { detectLanguage, getPrimaryLanguage, getLanguageName } = require('./language-detection');
const { detectContactCandidates, formatDetectionResult, getNoContactFoundHint } = require('./semantic-contact-detection');
const { getTokensForTarget, normalizeText } = require('./semantic-targets');

/**
 * Find contact elements on a page using semantic detection
 * 
 * @param {Page} page - Playwright page object
 * @param {string} baseUrl - Base URL for relative links
 * @returns {Promise<Object>} Detection result with language, candidates, and recommendations
 */
async function findContactOnPage(page, baseUrl = '') {
  const result = {
    language: 'unknown',
    languageName: 'Unknown',
    candidates: [],
    found: false,
    hint: ''
  };

  try {
    // Detect language
    result.language = await detectLanguage(page);
    result.languageName = getLanguageName(result.language);

    // Find contact candidates
    const candidates = await detectContactCandidates(page, baseUrl);
    result.candidates = candidates;

    if (candidates.length > 0) {
      result.found = true;
      result.primaryCandidate = candidates[0]; // Highest confidence
    } else {
      result.hint = getNoContactFoundHint();
    }

    return result;
  } catch (error) {
    console.warn(`Contact detection failed: ${error.message}`);
    result.hint = `Contact detection failed: ${error.message}. Fallback to default selectors.`;
    return result;
  }
}

/**
 * Generate Playwright selectors from semantic candidates
 * Returns a fallback selector chain compatible with attempt registry
 */
function generateSelectorsFromCandidates(candidates) {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  // Take top 3 candidates, prefer high confidence
  const topCandidates = candidates.slice(0, 3);

  // Build selector chain
  const selectors = topCandidates
    .map(c => c.selector)
    .filter(Boolean)
    .join(', ');

  return selectors || null;
}

/**
 * Format detection output for CLI reporting
 */
function formatDetectionForReport(detectionResult) {
  const lines = [];

  lines.push(`🌍 Language Detection: ${detectionResult.languageName}`);
  lines.push(`   (lang=${detectionResult.language})`);

  if (detectionResult.found && detectionResult.candidates.length > 0) {
    lines.push('');
    lines.push(`✅ Contact Detection Results (${detectionResult.candidates.length} candidate${detectionResult.candidates.length > 1 ? 's' : ''})`);

    detectionResult.candidates.forEach((candidate, idx) => {
      const formatted = formatDetectionResult(candidate, detectionResult.language);
      lines.push(`   ${idx + 1}. ${formatted}`);
      if (candidate.matchedText) {
        lines.push(`      Text: "${candidate.matchedText}"`);
      }
      if (candidate.href) {
        lines.push(`      Link: ${candidate.href}`);
      }
    });
  } else {
    lines.push('');
    lines.push('❌ No contact found');
    if (detectionResult.hint) {
      lines.push(`   💡 ${detectionResult.hint}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  findContactOnPage,
  generateSelectorsFromCandidates,
  formatDetectionForReport
};
