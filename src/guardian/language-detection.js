/**
 * Language Detection
 * 
 * Deterministic language detection from HTML attributes.
 * No guessing, no AI. Only reads explicit language declarations.
 */

/**
 * Detect page language from HTML
 * 
 * Detection order:
 * 1. <html lang="..."> attribute
 * 2. <meta http-equiv="content-language" ...> attribute
 * 3. fallback: "unknown"
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<string>} BCP-47 language code or "unknown"
 */
async function detectLanguage(page) {
  try {
    // Try <html lang="...">
    const htmlLang = await page.evaluate(() => {
      const htmlElement = document.documentElement;
      return htmlElement.getAttribute('lang');
    });

    if (htmlLang && htmlLang.trim()) {
      // Return the language code (e.g., "de", "de-DE", "en", "en-US")
      return htmlLang.trim().toLowerCase();
    }

    // Try <meta http-equiv="content-language" ...>
    const metaLang = await page.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="content-language"]');
      return meta ? meta.getAttribute('content') : null;
    });

    if (metaLang && metaLang.trim()) {
      return metaLang.trim().toLowerCase();
    }

    // Fallback
    return 'unknown';
  } catch (error) {
    // If evaluation fails, return unknown
    return 'unknown';
  }
}

/**
 * Parse BCP-47 language code to get primary language
 * e.g., "de-DE" -> "de", "en-US" -> "en"
 */
function getPrimaryLanguage(languageCode) {
  if (!languageCode || languageCode === 'unknown') {
    return 'unknown';
  }

  // Extract primary language (before first hyphen)
  const primary = languageCode.split('-')[0].toLowerCase();
  return primary || 'unknown';
}

/**
 * Get human-readable language name from code
 */
const LANGUAGE_NAMES = {
  'de': 'German',
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'pt': 'Portuguese',
  'it': 'Italian',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'ar': 'Arabic',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ru': 'Russian',
  'pl': 'Polish',
  'unknown': 'Unknown'
};

function getLanguageName(languageCode) {
  if (!languageCode || languageCode === 'unknown') {
    return 'Unknown';
  }

  const primary = getPrimaryLanguage(languageCode);
  return LANGUAGE_NAMES[primary] || `Unknown (${primary})`;
}

module.exports = {
  detectLanguage,
  getPrimaryLanguage,
  getLanguageName,
  LANGUAGE_NAMES
};
