/**
 * STAGE 6.1: Canonical Naming Law
 * 
 * Generates human-readable, deterministic names for runs and scans.
 * Names must explain purpose (e.g., scan-login-flow, run-auth-failed-recovery)
 * 
 * Rules:
 * - No hash-only directories
 * - Names are deterministic (same input = same name)
 * - Names explain purpose based on URL and test configuration
 * - All names are lowercase with hyphens
 */

import { createHash } from 'crypto';
import { getTimeProvider } from './time-provider.js';
/**
 * Generate human-readable, deterministic scan name
 * Format: scan-<host>-<purpose>-<hash>
 * 
 * @param {Object} [params]
 * @param {string} [params.url] - The URL being tested
 * @param {string} [params.srcPath] - Source path (for fingerprinting)
 * @param {Object} [params.config] - Config object
 * @returns {string} Human-readable scan name (e.g., "scan-auth-login-flow-a3f1")
 */
export function generateCanonicalScanName(params = {}) {
  const { url = 'about:blank', srcPath = '', config = {} } = params || {};
  let host = extractHostSegment(url);
  let purpose = extractPurpose(url, config);
  
  // Build deterministic fingerprint from all parameters
  const fingerprint = generateDeterministicFingerprint({
    url,
    srcPath,
    configProfile: config.profile || 'standard',
    learnPaths: Array.isArray(config.learnPaths) ? config.learnPaths.sort() : [],
  });
  
  // Build human-readable name: scan-<purpose>-<host>-<4char-hash>
  const parts = ['scan', purpose, host, String(fingerprint).substring(0, 4)];
  return parts.filter(Boolean).join('-').toLowerCase();
}

/**
 * Generate human-readable, deterministic run name
 * Format: run-<date>-<sequence>
 * 
 * @param {Object} [params]
 * @param {string} [params.scanName] - Parent scan name
 * @param {number} [params.runSequence] - Sequential run number (1, 2, 3...)
 * @param {Date|string|null} [params.timestamp] - Run timestamp
 * @returns {string} Human-readable run name (e.g., "run-2026-01-24-0001")
 */
export function generateCanonicalRunName(params = {}) {
  const { scanName: _scanName = '', runSequence = 0, timestamp = null } = params || {};
  const tp = getTimeProvider();
  const ms = timestamp
    ? (timestamp instanceof Date ? timestamp.getTime() : tp.parse(timestamp))
    : tp.now();
  const iso = tp.fromEpochMs(ms) || tp.iso();
  const dateStr = (iso || '').split('T')[0] || 'unknown-date';
  const seq = String(runSequence).padStart(4, '0'); // 0001, 0002, etc.
  
  return `run-${dateStr}-${seq}`;
}

/**
 * Extract meaningful purpose from URL
 * Examples:
 * - https://myapp.com/login -> "login"
 * - https://myapp.com/auth/oauth -> "auth-oauth"
 * - https://myapp.com/checkout -> "checkout"
 * - https://myapp.com -> "homepage"
 * 
 * @param {string} url
 * @param {Object} [_config]
 * @returns {string} Purpose identifier (lowercase, hyphenated)
 */
export function extractPurpose(url, _config = {}) {
  if (!url || url === 'about:blank') {
    return 'smoke';
  }
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase().replace(/^\/+|\/+$/g, '');
    
    if (!pathname) {
      return 'homepage';
    }
    
    // Take first 2 path segments for purpose
    const segments = pathname.split('/').filter(Boolean).slice(0, 2);
    
    // Map common paths to human-readable purposes
    const purposeMap = {
      'login': 'login',
      'auth': 'auth',
      'signin': 'signin',
      'signup': 'signup',
      'register': 'register',
      'oauth': 'oauth',
      'checkout': 'checkout',
      'payment': 'payment',
      'confirm': 'confirm',
      'verify': 'verify',
      'reset': 'reset',
      'forgot': 'forgot-password',
      'password': 'password',
      'account': 'account',
      'profile': 'profile',
      'settings': 'settings',
      'dashboard': 'dashboard',
      'admin': 'admin',
      'api': 'api',
    };
    
    // Check if first segment is in the map
    const firstSeg = segments[0];
    if (purposeMap[firstSeg]) {
      if (segments.length > 1) {
        return `${purposeMap[firstSeg]}-${segments[1].substring(0, 6)}`;
      }
      return purposeMap[firstSeg];
    }
    
    // Otherwise use path segments directly
    return segments.slice(0, 2).join('-').substring(0, 20);
  } catch {
    return 'unknown';
  }
}

/**
 * Extract hostname identifier from URL
 * Examples:
 * - https://myapp.com -> "myapp"
 * - https://auth.github.com -> "github"
 * - https://localhost:3000 -> "localhost"
 * 
 * @param {string} url
 * @returns {string} Host identifier (lowercase, alphanumeric-hyphen only)
 */
export function extractHostSegment(url) {
  if (!url || url === 'about:blank') {
    return 'blank';
  }
  
  try {
    const urlObj = new URL(url);
    let host = urlObj.hostname || 'unknown';
    
    // For localhost or 127.0.0.1, use "localhost"
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      return 'localhost';
    }
    
    // Extract primary domain (remove www., subdomains, etc.)
    const parts = host.split('.');
    if (parts.length >= 2) {
      // For github.com, use "github"
      // For auth.github.com, use "github"
      // For company.co.uk, use "company"
      const candidate = parts[parts.length - 2]; // Second-to-last part
      return sanitizeHostName(candidate);
    }
    
    return sanitizeHostName(host);
  } catch {
    return 'unknown';
  }
}

/**
 * Sanitize hostname to alphanumeric and hyphens only
 * @param {string} host
 * @returns {string}
 */
function sanitizeHostName(host) {
  return host
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 20);
}

/**
 * Generate deterministic fingerprint from inputs
 * @param {Object} inputs
 * @returns {string} 8-char hex string
 */
function generateDeterministicFingerprint(inputs) {
  const normalized = JSON.stringify({
    url: inputs.url || '',
    profile: inputs.configProfile || 'standard',
    learnPaths: inputs.learnPaths || [],
  }).replace(/\s+/g, '');
  
  const hash = createHash('sha256')
    .update(normalized)
    .digest('hex');
  
  return String(hash).substring(0, 8);
}

/**
 * Generate human-readable run directory name from components
 * Format: scan-<purpose>-<host>-<hash>/run-<date>-<seq>
 * 
 * @param {Object} [params]
 * @param {string} [params.url]
 * @param {string} [params.srcPath]
 * @param {Object} [params.config]
 * @param {number} [params.runSequence]
 * @returns {Object} { scanName, runName, relativeDir }
 */
export function generateCanonicalDirectoryNames(params = {}) {
  const { url = 'about:blank', srcPath = '', config = {}, runSequence = 0 } = params || {};
  const scanName = generateCanonicalScanName({ url, srcPath, config });
  const runName = generateCanonicalRunName({ 
    scanName, 
    runSequence, 
    timestamp: getTimeProvider().date() 
  });
  
  return {
    scanName,
    runName,
    relativeDir: `${scanName}/${runName}`,
  };
}

/**
 * Extract meaningful name from findings/judgments for user-facing output
 * Returns a short, descriptive label for a finding
 * 
 * @param {Object} finding
 * @returns {string} Human-readable label
 */
export function getFindingLabel(finding = {}) {
  const type = finding.type || 'unknown';
  const outcome = finding.outcome || 'unknown';
  
  const labelMap = {
    'SILENT_FAILURE': 'Silent Failure',
    'UNMET_EXPECTATION': 'Unmet Expectation',
    'COVERAGE_GAP': 'Coverage Gap',
    'UI_FEEDBACK_MISSING': 'Missing UI Feedback',
    'PROMISE_UNPROVEN': 'Unproven Promise',
    'FLOW_BREAK': 'Flow Break',
    'NAVIGATION_FAILURE': 'Navigation Failed',
    'INTERACTION_BLOCKED': 'Interaction Blocked',
    'TIMEOUT': 'Timeout Occurred',
    'NETWORK_ERROR': 'Network Error',
  };
  
  return labelMap[type] || `${type} (${outcome})`;
}

/**
 * Format run metadata for human display
 * @param {string} scanName
 * @param {string} runName
 * @returns {Object} { displayName, shortName }
 */
export function formatRunMetadata(scanName, runName) {
  return {
    displayName: `${scanName} / ${runName}`,
    shortName: runName,
    scanName: scanName,
  };
}
