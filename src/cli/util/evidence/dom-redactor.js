/**
 * DOM Snapshot Redaction Engine
 * 
 * Redacts sensitive data from HTML/DOM snapshots before writing to disk.
 * Uses deterministic regex patterns and stable hashing for placeholders.
 */

import { createHash } from 'crypto';
import { SENSITIVE_PATTERNS } from '../config/redaction-config.js';

/**
 * Generate deterministic hash-based placeholder for redacted value
 * @param {string} original - Original sensitive value
 * @returns {string} Placeholder like "[REDACTED:a1b2c3d4]"
 */
export function getRedactionPlaceholder(original) {
  const hash = createHash('sha256').update(original).digest('hex').slice(0, 8);
  return `[REDACTED:${hash}]`;
}

/**
 * Redact sensitive patterns from text content
 * @param {string} text - Input text
 * @returns {Object} { redacted: string, count: number, hash: string (of original) }
 */
export function redactTextPatterns(text) {
  if (!text || typeof text !== 'string') {
    return { redacted: text, count: 0, replacements: [] };
  }
  
  let redacted = text;
  let count = 0;
  const replacements = [];
  
  // Redact emails
  const emailMatches = text.matchAll(SENSITIVE_PATTERNS.email);
  for (const match of emailMatches) {
    const placeholder = getRedactionPlaceholder(match[0]);
    redacted = redacted.replace(match[0], placeholder);
    count++;
    replacements.push({ original: match[0], placeholder, type: 'email' });
  }
  
  // Redact JWT tokens
  const jwtMatches = text.matchAll(SENSITIVE_PATTERNS.jwt);
  for (const match of jwtMatches) {
    const placeholder = getRedactionPlaceholder(match[0]);
    redacted = redacted.replace(match[0], placeholder);
    count++;
    replacements.push({ original: match[0], placeholder, type: 'jwt' });
  }
  
  // Redact bearer tokens
  const bearerMatches = text.matchAll(SENSITIVE_PATTERNS.bearer);
  for (const match of bearerMatches) {
    const placeholder = getRedactionPlaceholder(match[0]);
    redacted = redacted.replace(match[0], placeholder);
    count++;
    replacements.push({ original: match[0], placeholder, type: 'bearer' });
  }
  
  // Redact API keys
  const apiKeyMatches = text.matchAll(SENSITIVE_PATTERNS.apiKey);
  for (const match of apiKeyMatches) {
    const placeholder = getRedactionPlaceholder(match[0]);
    redacted = redacted.replace(match[0], placeholder);
    count++;
    replacements.push({ original: match[0], placeholder, type: 'apiKey' });
  }
  
  // Redact phone numbers
  const phoneMatches = text.matchAll(SENSITIVE_PATTERNS.phone);
  for (const match of phoneMatches) {
    const placeholder = getRedactionPlaceholder(match[0]);
    redacted = redacted.replace(match[0], placeholder);
    count++;
    replacements.push({ original: match[0], placeholder, type: 'phone' });
  }
  
  // Redact SSN
  const ssnMatches = text.matchAll(SENSITIVE_PATTERNS.ssn);
  for (const match of ssnMatches) {
    const placeholder = getRedactionPlaceholder(match[0]);
    redacted = redacted.replace(match[0], placeholder);
    count++;
    replacements.push({ original: match[0], placeholder, type: 'ssn' });
  }
  
  // Redact credit cards (careful: can have false positives with long sequences)
  const ccMatches = text.matchAll(SENSITIVE_PATTERNS.creditCard);
  for (const match of ccMatches) {
    // Only redact if likely to be credit card (13-19 digits, consecutive)
    if (match[0].length >= 13 && match[0].length <= 19) {
      const placeholder = getRedactionPlaceholder(match[0]);
      redacted = redacted.replace(match[0], placeholder);
      count++;
      replacements.push({ original: match[0], placeholder, type: 'creditCard' });
    }
  }
  
  // Redact Bitcoin addresses
  const btcMatches = text.matchAll(SENSITIVE_PATTERNS.btcAddress);
  for (const match of btcMatches) {
    const placeholder = getRedactionPlaceholder(match[0]);
    redacted = redacted.replace(match[0], placeholder);
    count++;
    replacements.push({ original: match[0], placeholder, type: 'btcAddress' });
  }
  
  return { redacted, count, replacements };
}

/**
 * Redact password field values in HTML
 * All password fields get simple "[REDACTED]" treatment
 * @param {string} html - HTML content
 * @returns {Object} { redacted: string, count: number }
 */
export function redactPasswordFields(html) {
  if (!html || typeof html !== 'string') {
    return { redacted: html, count: 0 };
  }
  
  let redacted = html;
  let count = 0;
  
  // Match value attributes in password inputs
  const passwordInputRegex = /<input[^>]*type=['"]*password['"]*[^>]*value=['"]*([^'"]*)['"]*[^>]*>/gi;
  redacted = redacted.replace(passwordInputRegex, (match) => {
    // Replace the value with [REDACTED]
    const replaced = match.replace(/value=['"]*[^'"]*['"]*/, 'value="[REDACTED]"');
    count++;
    return replaced;
  });
  
  return { redacted, count };
}

/**
 * Redact DOM snapshot HTML
 * Applies all redaction rules to HTML content
 * @param {string} html - HTML snapshot
 * @returns {Object} { redacted: string, stats: { textReplacements, passwordFields } }
 */
export function redactDOMSnapshot(html) {
  if (!html) {
    return { redacted: html, stats: { textReplacements: 0, passwordFields: 0 } };
  }
  
  let redacted = html;
  let stats = { textReplacements: 0, passwordFields: 0 };
  
  // Redact password field values
  const pwResult = redactPasswordFields(redacted);
  redacted = pwResult.redacted;
  stats.passwordFields = pwResult.count;
  
  // Redact sensitive text patterns
  const textResult = redactTextPatterns(redacted);
  redacted = textResult.redacted;
  stats.textReplacements = textResult.count;
  
  return { redacted, stats };
}








