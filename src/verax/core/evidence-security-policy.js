/**
 * GATE 4: EVIDENCE SECURITY & PRIVACY
 * 
 * Single source of truth for evidence security, redaction, and retention policies.
 * Defines what is considered sensitive, what must be redacted by default,
 * and what can be optionally preserved behind explicit flags.
 * 
 * PRINCIPLE: Safe-by-default is mandatory.
 * VERAX does NOT store credentials, secrets, or personal data in screenshots,
 * traces, or artifacts unless explicitly opted-in by the user.
 */

// ============================================================================
// EVIDENCE TYPES AND SENSITIVITY CLASSIFICATION
// ============================================================================

/**
 * Evidence types captured during observation
 */
export const EVIDENCE_TYPES = {
  SCREENSHOT: 'screenshot',        // Browser screenshots
  NETWORK_TRACE: 'network-trace',  // HTTP request/response metadata
  CONSOLE_LOG: 'console-log',      // Browser console output
  INTERACTION_TRACE: 'trace',      // Event log and DOM changes
  CANONICAL_ARTIFACT: 'canonical'  // Deterministic, PII-free truth
};

// ============================================================================
// SENSITIVE DATA PATTERNS (Field Names, Attributes, Content)
// ============================================================================

/**
 * Field names that indicate sensitive inputs.
 * Used to identify password fields, email fields, auth fields, etc.
 */
export const SENSITIVE_FIELD_NAMES = [
  'password', 'passwd', 'pwd',
  'pin', 'pincode',
  'email', 'e-mail', 'mail',
  'phone', 'tel', 'telephone',
  'mobile', 'cell',
  'ssn', 'social-security',
  'credit', 'card', 'cardnumber', 'ccnumber',
  'cvv', 'cvc', 'cve', 'cvx',
  'token', 'auth', 'authorization',
  'secret', 'apikey', 'api-key',
  'key', 'privatekey', 'private-key',
  'session', 'sessionid', 'session-id',
  'cookie', 'cookieid', 'cookie-id',
  'oauth', 'jwt', 'bearer',
  'bearer-token', 'access-token', 'access_token',
  'refresh-token', 'refresh_token',
  'dob', 'date-of-birth', 'birthdate',
  'drivers', 'license', 'drivers-license',
  'passport', 'passport-number',
  'tax', 'tax-id', 'taxid',
  'otp', 'mfa', 'two-factor', 'totp', 'authenticator'
];

/**
 * HTML input type attributes that are inherently sensitive
 */
export const SENSITIVE_INPUT_TYPES = [
  'password',
  'email',
  'tel',
  'number'  // Credit card numbers, SSN, phone
];

/**
 * HTML attributes that indicate sensitive data handling
 */
export const SENSITIVE_ATTRIBUTES = [
  'autocomplete=password',
  'autocomplete=email',
  'autocomplete=tel',
  'autocomplete=username'
];

/**
 * Query parameter patterns to redact from URLs and network traces
 */
export const SENSITIVE_QUERY_PATTERNS = [
  /[?&]token([=&]|$)/i,
  /[?&]auth([=&]|$)/i,
  /[?&]authorization([=&]|$)/i,
  /[?&]api[_-]?key([=&]|$)/i,
  /[?&]apikey([=&]|$)/i,
  /[?&]secret([=&]|$)/i,
  /[?&]key([=&]|$)/i,
  /[?&]password([=&]|$)/i,
  /[?&]passwd([=&]|$)/i,
  /[?&]pwd([=&]|$)/i,
  /[?&]session([=&]|$)/i,
  /[?&]sessionid([=&]|$)/i,
  /[?&]session[_-]?id([=&]|$)/i,
  /[?&]bearer([=&]|$)/i,
  /[?&]access[_-]?token([=&]|$)/i,
  /[?&]refresh[_-]?token([=&]|$)/i,
  /[?&]jwt([=&]|$)/i,
  /[?&]email([=&]|$)/i,
  /[?&]phone([=&]|$)/i,
  /[?&]tel([=&]|$)/i,
  /[?&]mobile([=&]|$)/i,
  /[?&]ssn([=&]|$)/i,
  /[?&]social[_-]?security([=&]|$)/i,
  /[?&]credit([=&]|$)/i,
  /[?&]card([=&]|$)/i,
  /[?&]cvv([=&]|$)/i,
  /[?&]cvc([=&]|$)/i,
  /[?&]dob([=&]|$)/i,
  /[?&]birthdate([=&]|$)/i,
  /[?&]passport([=&]|$)/i,
  /[?&]oauth([=&]|$)/i,
  /[?&]otp([=&]|$)/i,
  /[?&]mfa([=&]|$)/i,
  /[?&]totp([=&]|$)/i
];

/**
 * Console log patterns to redact
 */
export const SENSITIVE_LOG_PATTERNS = [
  /\btoken[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi,
  /\bauth[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi,
  /\bapi[_-]?key[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi,
  /\bsecret[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi,
  /\bpassword[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi,
  /\bpasswd[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi,
  /\bpwd[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi,
  /\bsession[_-]?id[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi,
  /\bbearer\s+[a-zA-Z0-9._-]+/gi,
  /\b(Bearer|Authorization):\s*[a-zA-Z0-9._-]+/gi,
  /\baccess[_-]?token[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi,
  /\brefresh[_-]?token[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi,
  /\bjwt[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi,
  /\bemail[=:]\s*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  /\bphone[=:]\s*[\d+()\s-]+/gi,
  /\btel[=:]\s*[\d+()\s-]+/gi,
  /\bccnumber[=:]\s*[\d\s-]{10,}/gi,
  /\bcvv[=:]\s*[\d]{3,4}/gi,
  /\bcvc[=:]\s*[\d]{3,4}/gi
];

// ============================================================================
// REDACTION MODES
// ============================================================================

export const REDACTION_MODE = {
  ENABLED: 'enabled',      // Redaction applied by default (SAFE-BY-DEFAULT)
  DISABLED: 'disabled'     // Redaction disabled (explicit opt-out, dangerous)
};

// ============================================================================
// SECURITY POLICY CLASS
// ============================================================================

/**
 * Security policy for evidence handling and redaction
 */
export class EvidenceSecurityPolicy {
  constructor(options = {}) {
    // SAFE-BY-DEFAULT: Redaction enabled unless explicitly disabled
    this.redactionMode = options.redactionMode || REDACTION_MODE.ENABLED;
    
    // Screenshot redaction settings
    this.screenshotRedaction = {
      enabled: this.redactionMode === REDACTION_MODE.ENABLED,
      redactInputFields: true,        // password, email, tel, text in forms
      redactSensitiveAttributes: true, // autocomplete="password", etc.
      redactSensitiveText: true,       // Email addresses, phone numbers
      blurRadius: options.blurRadius || 20
    };

    // Network trace sanitization
    this.networkTraceSanitization = {
      enabled: this.redactionMode === REDACTION_MODE.ENABLED,
      maskQueryParams: true,           // Remove sensitive query params
      maskHeaders: true,               // Remove Authorization, Cookie headers
      removeRequestBody: true,         // Never store POST/PUT bodies
      removeResponseBody: true,        // Never store response bodies
      maskSensitivePatterns: true      // Redact token values in traces
    };

    // Console log filtering
    this.consoleLogFiltering = {
      enabled: this.redactionMode === REDACTION_MODE.ENABLED,
      filterSensitivePatterns: true,   // Remove token/secret logs
      preserveErrorStructure: true     // Keep error type + message
    };

    // Canonical artifact safety
    this.canonicalArtifactSafety = {
      enforceNoPII: true,              // MANDATORY: No PII in canonical
      enforceNoSecrets: true,          // MANDATORY: No secrets in canonical
      enforceNoCredentials: true       // MANDATORY: No credentials in canonical
    };

    // Diagnostics artifact handling
    this.diagnosticsHandling = {
      enabled: options.includeDiagnostics || false,  // Opt-in (explicit flag)
      separateFromCanonical: true,     // Never mix with canonical
      stayRedacted: true               // Still redacted even in diagnostics
    };

    // Retention policy
    this.retentionPolicy = {
      keepLastNRuns: options.retainRuns || 5,  // Keep last 5 runs by default
      deleteOlderRuns: true
    };
  }

  /**
   * Check if field name is sensitive
   */
  isSensitiveField(fieldName) {
    if (!fieldName) return false;
    const normalized = fieldName.toLowerCase().replace(/[-_]/g, '');
    return SENSITIVE_FIELD_NAMES.some(pattern => 
      normalized.includes(pattern.replace(/[-_]/g, ''))
    );
  }

  /**
   * Check if input type is sensitive
   */
  isSensitiveInputType(inputType) {
    if (!inputType) return false;
    return SENSITIVE_INPUT_TYPES.includes(inputType.toLowerCase());
  }

  /**
   * Check if element has sensitive attribute
   */
  hasSensitiveAttribute(element) {
    if (!element) return false;
    
    // Check autocomplete attribute
    const autocomplete = element.getAttribute?.('autocomplete') || '';
    if (SENSITIVE_ATTRIBUTES.some(attr => autocomplete.includes(attr.split('=')[1]))) {
      return true;
    }
    
    // Check id and name attributes
    const id = (element.id || '').toLowerCase();
    const name = (element.name || '').toLowerCase();
    
    return SENSITIVE_FIELD_NAMES.some(pattern => 
      id.includes(pattern) || name.includes(pattern)
    );
  }

  /**
   * Check if query string contains sensitive params
   */
  hasSensitiveQueryParams(queryString) {
    if (!queryString) return false;
    return SENSITIVE_QUERY_PATTERNS.some(pattern => pattern.test(queryString));
  }

  /**
   * Mask sensitive query parameters in URL
   */
  maskSensitiveQueryParams(url) {
    if (!url) return url;
    if (!this.networkTraceSanitization.enabled) return url;

    try {
      const urlObj = new URL(url);
      let masked = false;

      // Iterate over all search params
      const params = new URLSearchParams(urlObj.search);
      const keysToRedact = [];

      for (const [key] of params.entries()) {
        // Check if key matches any sensitive pattern
        const pattern = SENSITIVE_QUERY_PATTERNS.find(p => {
          const testUrl = `?${key}=value`;
          return p.test(testUrl);
        });

        if (pattern) {
          keysToRedact.push(key);
          masked = true;
        }
      }

      // Redact identified keys
      keysToRedact.forEach(key => {
        params.set(key, '[REDACTED]');
      });

      if (masked) {
        urlObj.search = params.toString();
        return urlObj.toString();
      }
    } catch (e) {
      // Invalid URL, return unchanged
    }

    return url;
  }

  /**
   * Filter sensitive patterns from log text
   */
  filterSensitiveLog(logText) {
    if (!logText) return logText;
    if (!this.consoleLogFiltering.enabled) return logText;

    let filtered = logText;

    // Apply all sensitive log patterns
    SENSITIVE_LOG_PATTERNS.forEach(pattern => {
      filtered = filtered.replace(pattern, '[REDACTED]');
    });

    return filtered;
  }

  /**
   * Sanitize trace data (remove sensitive fields)
   */
  sanitizeTrace(trace) {
    if (!trace) return trace;
    if (!this.networkTraceSanitization.enabled) return trace;

    const sanitized = { ...trace };

    // Remove request/response bodies
    if (this.networkTraceSanitization.removeRequestBody && sanitized.request) {
      sanitized.request = { ...sanitized.request };
      delete sanitized.request.body;
      delete sanitized.request.postData;
    }
    if (this.networkTraceSanitization.removeResponseBody && sanitized.response) {
      sanitized.response = { ...sanitized.response };
      delete sanitized.response.body;
      delete sanitized.response.content;
    }

    // Mask sensitive headers
    if (this.networkTraceSanitization.maskHeaders) {
      if (sanitized.request && sanitized.request.headers) {
        const headers = { ...sanitized.request.headers };
        const sensitiveHeaderNames = ['authorization', 'cookie', 'x-auth-token', 'x-api-key', 'x-csrf-token'];
        
        // Check all header keys (case-insensitive)
        Object.keys(headers).forEach(key => {
          if (sensitiveHeaderNames.includes(key.toLowerCase())) {
            headers[key] = '[REDACTED]';
          }
        });
        sanitized.request.headers = headers;
      }

      if (sanitized.response && sanitized.response.headers) {
        const headers = { ...sanitized.response.headers };
        const sensitiveHeaderNames = ['set-cookie', 'authorization', 'x-auth-token'];
        
        // Check all header keys (case-insensitive)
        Object.keys(headers).forEach(key => {
          if (sensitiveHeaderNames.includes(key.toLowerCase())) {
            headers[key] = '[REDACTED]';
          }
        });
        sanitized.response.headers = headers;
      }
    }

    // Mask URL query params
    if (this.networkTraceSanitization.maskQueryParams && sanitized.request && sanitized.request.url) {
      sanitized.request.url = this.maskSensitiveQueryParams(sanitized.request.url);
    }

    return sanitized;
  }

  /**
   * Check if URL is safe (no sensitive query params)
   */
  isUrlSafe(url) {
    if (!url) return true;
    return !this.hasSensitiveQueryParams(url);
  }

  /**
   * Get redaction summary for user awareness
   */
  getRedactionSummary() {
    return {
      mode: this.redactionMode,
      screenshot: this.screenshotRedaction.enabled,
      networkTraces: this.networkTraceSanitization.enabled,
      consoleLogs: this.consoleLogFiltering.enabled,
      canonicalArtifacts: {
        noPII: this.canonicalArtifactSafety.enforceNoPII,
        noSecrets: this.canonicalArtifactSafety.enforceNoSecrets,
        noCredentials: this.canonicalArtifactSafety.enforceNoCredentials
      },
      diagnostics: {
        enabled: this.diagnosticsHandling.enabled,
        separate: this.diagnosticsHandling.separateFromCanonical,
        stillRedacted: this.diagnosticsHandling.stayRedacted
      },
      retentionDays: this.retentionPolicy.keepLastNRuns
    };
  }
}

// ============================================================================
// DEFAULT POLICY (SAFE-BY-DEFAULT)
// ============================================================================

export const defaultSecurityPolicy = new EvidenceSecurityPolicy();

// ============================================================================
// POLICY CREATION FROM CLI OPTIONS
// ============================================================================

/**
 * Create security policy from CLI options
 */
export function createSecurityPolicyFromCli(cliOptions = {}) {
  const redactionMode = cliOptions.noRedaction ? REDACTION_MODE.DISABLED : REDACTION_MODE.ENABLED;
  
  // Print warning if redaction disabled
  if (redactionMode === REDACTION_MODE.DISABLED) {
    console.warn('⚠️  WARNING: --no-redaction flag detected.');
    console.warn('   VERAX will NOT redact sensitive data from screenshots, traces, or logs.');
    console.warn('   Artifacts may contain passwords, emails, tokens, and other credentials.');
    console.warn('   Only use this flag in secure, isolated testing environments.');
    console.warn('   See: https://verax.dev/security for more information.\n');
  }

  return new EvidenceSecurityPolicy({
    redactionMode,
    includeDiagnostics: cliOptions.includeDiagnostics || false,
    retainRuns: cliOptions.retainRuns !== undefined ? cliOptions.retainRuns : 5,
    blurRadius: cliOptions.blurRadius || 20
  });
}
