/**
 * Semantic Targets & Multilingual Dictionary
 * 
 * Provides deterministic, language-independent detection of semantic targets
 * (contact, about, etc.) using normalized tokens from multiple languages.
 */

/**
 * Multilingual dictionary for semantic targets
 * Keys: target names, Values: arrays of normalized token variants
 */
const SEMANTIC_DICTIONARY = {
  contact: [
    // English
    'contact', 'contactus', 'contact-us', 'contact us', 'get in touch', 'getintouch',
    'reach out', 'reachout', 'contact form', 'contactform', 'contact page', 'contactpage',
    'inquiry', 'inquiries', 'message us', 'messageus', 'write to us', 'writetus',
    // German
    'kontakt', 'kontaktieren', 'kontaktaufnahme', 'kontaktformular', 'kontakten',
    'kontakts', 'kontakt formular', 'kontakt-formular', 'anfrage', 'anfragen',
    // Spanish
    'contacto', 'contactanos', 'contacta', 'formulario de contacto',
    'pongase en contacto', 'ponte en contacto', 'escribenos', 'escriba',
    // French
    'contact', 'contactez', 'contactez-nous', 'formulaire de contact',
    'nous contacter', 'nous ecrire',
    // Portuguese
    'contato', 'contacto', 'formulario de contato', 'entre em contato',
    'fale conosco', 'escreva para nos',
    // Italian
    'contatti', 'contatto', 'contattaci', 'modulo di contatto',
    'modulo contatti', 'mettersi in contatto',
    // Dutch
    'contact', 'contacteer', 'contact opnemen', 'contactformulier',
    // Swedish
    'kontakt', 'kontakta', 'kontaktformular',
    // Arabic
    'تواصل', 'اتصل', 'استفسار', 'استفسارات', 'نموذج الاتصال', 'نموذج تواصل',
    // Chinese
    '联系', '联系我们', '联系表单', '留言', '反馈'
  ],
  about: [
    // English
    'about', 'about us', 'aboutus', 'our story', 'about-us',
    'company', 'team', 'who we are', 'whoweare', 'more about us',
    // German
    'uber', 'über', 'ueber', 'uber uns', 'über uns', 'ueber uns',
    'uber unsere', 'über unsere', 'ueber unsere', 'team', 'unternehmen',
    // Spanish
    'acerca', 'acerca de', 'acerca de nosotros', 'sobre nosotros',
    'quienes somos', 'quiénes somos', 'nuestra empresa',
    // French
    'a propos', 'à propos', 'a propos de nous', 'à propos de nous',
    'qui sommes nous', 'qui nous sommes', 'notre histoire',
    // Portuguese
    'sobre', 'sobre nos', 'sobre nós', 'quem somos',
    // Italian
    'chi siamo', 'chi siamo noi', 'la nostra storia',
    // Dutch
    'over', 'over ons', 'wie zijn we',
    // Swedish
    'om', 'om oss', 'var historia',
    // Arabic
    'عن', 'عننا', 'عن الشركة', 'فريقنا', 'قصتنا'
  ]
};

/**
 * Normalize text for comparison
 * - Lowercase
 * - Trim whitespace
 * - Remove diacritics (é → e, ü → u, etc.)
 * - Remove punctuation
 * - Collapse multiple spaces
 */
function normalizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }

  // Lowercase
  let normalized = text.toLowerCase();

  // Remove diacritics using Unicode normalization
  // NFD: decompose accented characters, then filter combining marks
  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Remove punctuation and special characters, keep spaces
  normalized = normalized.replace(/[^\w\s]/g, ' ');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Check if normalized text includes any token from the list
 * Matches whole words/tokens at word boundaries where appropriate
 */
function includesAnyToken(normalizedText, tokenList) {
  if (!normalizedText || !Array.isArray(tokenList)) {
    return false;
  }

  // Check each token
  for (const token of tokenList) {
    // Normalize the token
    const normalizedToken = normalizeText(token);

    if (!normalizedToken) {
      continue;
    }

    // For very short tokens (<=4 chars), require word boundary
    // For longer tokens (>4 chars), allow substring matching
    if (normalizedToken.length <= 4) {
      // Word boundary match
      const wordBoundaryRegex = new RegExp(`\\b${normalizedToken}\\b`);
      if (wordBoundaryRegex.test(normalizedText)) {
        return true;
      }
    } else {
      // Substring match
      if (normalizedText.includes(normalizedToken)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get the best matching token from a list for a given text
 * Returns the token that was matched, or null
 */
function getMatchedToken(normalizedText, tokenList) {
  if (!normalizedText || !Array.isArray(tokenList)) {
    return null;
  }

  for (const token of tokenList) {
    const normalizedToken = normalizeText(token);

    if (!normalizedToken) {
      continue;
    }

    if (normalizedToken.length <= 4) {
      const wordBoundaryRegex = new RegExp(`\\b${normalizedToken}\\b`);
      if (wordBoundaryRegex.test(normalizedText)) {
        return token;
      }
    } else {
      if (normalizedText.includes(normalizedToken)) {
        return token;
      }
    }
  }

  return null;
}

/**
 * Get all target names available in dictionary
 */
function getAvailableTargets() {
  return Object.keys(SEMANTIC_DICTIONARY);
}

/**
 * Check if a semantic target exists in dictionary
 */
function isValidTarget(targetName) {
  return targetName in SEMANTIC_DICTIONARY;
}

/**
 * Get token list for a specific target
 */
function getTokensForTarget(targetName) {
  return SEMANTIC_DICTIONARY[targetName] || [];
}

module.exports = {
  SEMANTIC_DICTIONARY,
  normalizeText,
  includesAnyToken,
  getMatchedToken,
  getAvailableTargets,
  isValidTarget,
  getTokensForTarget
};
