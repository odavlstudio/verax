import { strictEqual, _deepStrictEqual } from 'node:assert';
import { describe, it } from 'node:test';
import { 
  parseAuthCookie, 
  parseAuthHeader, 
  redactCookie, 
  redactHeader,
  validateAuthConfig 
} from '../src/cli/util/auth/auth-utils.js';

/**
 * PHASE 2A: Auth Utils Unit Tests
 * Tests cookie/header parsing, redaction, and validation
 */

describe('Auth Utils - Cookie Parsing', () => {
  it('should parse simple cookie', () => {
    const result = parseAuthCookie('session=abc123');
    strictEqual(result.name, 'session');
    strictEqual(result.value, 'abc123');
  });

  it('should parse cookie with domain and path', () => {
    const result = parseAuthCookie('token=xyz789;domain=example.com;path=/api');
    strictEqual(result.name, 'token');
    strictEqual(result.value, 'xyz789');
    strictEqual(result.domain, 'example.com');
    strictEqual(result.path, '/api');
  });

  it('should parse cookie with secure and httpOnly flags', () => {
    const result = parseAuthCookie('auth=secret;secure;httpOnly');
    strictEqual(result.name, 'auth');
    strictEqual(result.value, 'secret');
    strictEqual(result.secure, true);
    strictEqual(result.httpOnly, true);
  });

  it('should parse cookie with sameSite attribute', () => {
    const result = parseAuthCookie('sid=test;sameSite=Strict');
    strictEqual(result.name, 'sid');
    strictEqual(result.value, 'test');
    strictEqual(result.sameSite, 'Strict');
  });

  it('should return error for invalid cookie format', () => {
    const result1 = parseAuthCookie('invalid');
    strictEqual(typeof result1.error, 'string');
    
    const result2 = parseAuthCookie('');
    strictEqual(typeof result2.error, 'string');
  });
});

describe('Auth Utils - Header Parsing', () => {
  it('should parse simple header', () => {
    const result = parseAuthHeader('Authorization: Bearer token123');
    strictEqual(result.name, 'Authorization');
    strictEqual(result.value, 'Bearer token123');
  });

  it('should parse header with whitespace', () => {
    const result = parseAuthHeader('  X-API-Key  :  abc123  ');
    strictEqual(result.name, 'X-API-Key');
    strictEqual(result.value, 'abc123');
  });

  it('should parse header with colon in value', () => {
    const result = parseAuthHeader('Custom-Header: value:with:colons');
    strictEqual(result.name, 'Custom-Header');
    strictEqual(result.value, 'value:with:colons');
  });

  it('should return error for invalid header format', () => {
    const result1 = parseAuthHeader('NoColonHeader');
    strictEqual(typeof result1.error, 'string');
    
    const result2 = parseAuthHeader('');
    strictEqual(typeof result2.error, 'string');
  });
});

describe('Auth Utils - Cookie Redaction', () => {
  it('should redact cookie value with SHA256 hash', () => {
    const cookie = { name: 'session', value: 'secret123', domain: 'example.com' };
    const redacted = redactCookie(cookie);
    
    strictEqual(redacted.name, 'session');
    strictEqual(redacted.domain, 'example.com');
    strictEqual(typeof redacted.valueHash, 'string');
    strictEqual(redacted.valueHash.startsWith('[REDACTED:'), true);
    strictEqual(redacted.valueHash.length, 19); // "[REDACTED:" + 8 chars + "]"
  });

  it('should produce deterministic hash for same value', () => {
    const cookie1 = { name: 'auth', value: 'test123' };
    const cookie2 = { name: 'auth', value: 'test123' };
    
    const redacted1 = redactCookie(cookie1);
    const redacted2 = redactCookie(cookie2);
    
    strictEqual(redacted1.valueHash, redacted2.valueHash);
  });
});

describe('Auth Utils - Header Redaction', () => {
  it('should redact header value with SHA256 hash', () => {
    const header = { name: 'Authorization', value: 'Bearer secret' };
    const redacted = redactHeader(header);
    
    strictEqual(redacted.name, 'Authorization');
    strictEqual(typeof redacted.valueHash, 'string');
    strictEqual(redacted.valueHash.startsWith('[REDACTED:'), true);
  });

  it('should produce deterministic hash for same value', () => {
    const header1 = { name: 'X-API-Key', value: 'key123' };
    const header2 = { name: 'X-API-Key', value: 'key123' };
    
    const redacted1 = redactHeader(header1);
    const redacted2 = redactHeader(header2);
    
    strictEqual(redacted1.valueHash, redacted2.valueHash);
  });
});

describe('Auth Utils - Config Validation', () => {
  it('should validate empty config', () => {
    const result = validateAuthConfig({});
    strictEqual(result.valid, true);
  });

  it('should validate config with storage only', () => {
    const result = validateAuthConfig({ authStorage: 'test.json' });
    strictEqual(result.valid, true);
  });

  it('should reject conflicting storage and cookies', () => {
    const result = validateAuthConfig({ 
      authStorage: 'test.json', 
      authCookies: ['session=abc'] 
    });
    strictEqual(result.valid, false);
    strictEqual(result.errors.length > 0, true);
  });

  it('should reject invalid auth-mode', () => {
    const result = validateAuthConfig({ authMode: 'invalid' });
    strictEqual(result.valid, false);
    strictEqual(result.errors.some(e => e.includes('auth-mode')), true);
  });

  it('should accept valid auth-mode strict', () => {
    const result = validateAuthConfig({ authMode: 'strict' });
    strictEqual(result.valid, true);
  });
});
