/**
 * Redaction Configuration
 * 
 * Controls sensitive data masking in artifacts.
 * Configured via environment variables only (no CLI flags).
 */

export function getRedactionConfig() {
  return {
    // Enable/disable redaction by component
    visual: process.env.VERAX_REDACT_VISUAL !== '0', // default true
    dom: process.env.VERAX_REDACT_DOM !== '0', // default true
    
    // Redaction rules version for metadata tracking
    rulesVersion: process.env.VERAX_REDACT_RULES_VERSION || '6A-1',
    
    // Masking color (RGB) for screenshot overlays
    maskColor: { r: 0, g: 0, b: 0, alpha: 1.0 },
    
    // Padding around detected regions (pixels)
    maskPadding: 2,
  };
}

/**
 * Sensitive CSS selectors that indicate input fields containing sensitive data
 */
export const SENSITIVE_SELECTORS = [
  'input[type="password"]',
  'input[name*="pass" i]',
  'input[id*="pass" i]',
  'input[name*="token" i]',
  'input[id*="token" i]',
  'input[name*="key" i]',
  'input[id*="key" i]',
  'input[name*="secret" i]',
  'input[id*="secret" i]',
  'input[name*="email" i]',
  'input[id*="email" i]',
  'input[name*="phone" i]',
  'input[id*="phone" i]',
  'textarea',
  '[autocomplete="cc-number"]',
  '[autocomplete="cc-csc"]',
  '[autocomplete="cc-exp"]',
  '[data-verax-redact="true"]',
];

/**
 * Patterns for detecting sensitive text content
 * Used for both screenshot text detection and DOM redaction
 */
export const SENSITIVE_PATTERNS = {
  // Email pattern: simple version that avoids false positives
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // JWT-like tokens (base64url with dots): xxxxx.yyyyy.zzzzz
  jwt: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  
  // Bearer token (common auth pattern)
  bearer: /bearer\s+[A-Za-z0-9._-]{20,}/gi,
  
  // API key pattern: 32-64 hex or base64 characters, often after "key=" or "api_key="
  apiKey: /(?:api_?key|token|auth)\s*[:=]\s*[A-Za-z0-9_\-+/=]{32,}/gi,
  
  // Credit card: 13-19 digit sequences (basic pattern, no Luhn check to avoid false negatives)
  creditCard: /\b\d{13,19}\b/g,
  
  // Phone number: US format or international variants
  phone: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
  
  // Bitcoin/crypto addresses
  btcAddress: /\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g,
  
  // SSN-like pattern: XXX-XX-XXXX
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
};

/**
 * Pattern groups for DOM redaction
 */
export const REDACTION_PATTERN_GROUPS = {
  credentials: [
    SENSITIVE_PATTERNS.email,
    SENSITIVE_PATTERNS.jwt,
    SENSITIVE_PATTERNS.bearer,
    SENSITIVE_PATTERNS.apiKey,
    SENSITIVE_PATTERNS.creditCard,
    SENSITIVE_PATTERNS.phone,
    SENSITIVE_PATTERNS.ssn,
  ],
  crypto: [
    SENSITIVE_PATTERNS.btcAddress,
  ],
};








