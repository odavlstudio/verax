import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { getScreenshotDir } from '../core/run-id.js';

/**
 * Normalize URL into structured components
 * @param {string} url - URL to normalize
 * @returns {object|null} Normalized URL parts or null if invalid
 */
export function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      origin: urlObj.origin,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash
    };
  } catch (error) {
    return null;
  }
}

/**
 * Extract pathname + hash from URL
 * @param {string} url - URL to extract path from
 * @returns {string|null} Path portion (pathname + hash) or null if invalid
 */
export function getUrlPath(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  return normalized.pathname + normalized.hash;
}

/**
 * Compute MD5 hash of screenshot file
 * @param {string} screenshotPath - Absolute path to screenshot file
 * @returns {string|null} MD5 hash or null if file missing/unreadable
 */
export function getScreenshotHash(screenshotPath) {
  try {
    if (!existsSync(screenshotPath)) return null;
    const imageBuffer = /** @type {Buffer} */ (readFileSync(screenshotPath));
    const hash = /** @type {string} */ (createHash('md5').update(imageBuffer).digest('hex'));
    return hash;
  } catch (error) {
    return null;
  }
}

/**
 * Check if URLs have meaningfully different paths (ignoring trailing slashes)
 * @param {string} beforeUrl - URL before action
 * @param {string} afterUrl - URL after action
 * @returns {boolean} True if paths differ meaningfully
 */
export function hasMeaningfulUrlChange(beforeUrl, afterUrl) {
  const beforePath = getUrlPath(beforeUrl);
  const afterPath = getUrlPath(afterUrl);
  
  if (!beforePath || !afterPath) return false;
  
  if (beforePath === afterPath) return false;
  
  const beforeNormalized = beforePath.replace(/\/$/, '') || '/';
  const afterNormalized = afterPath.replace(/\/$/, '') || '/';
  
  return beforeNormalized !== afterNormalized;
}

/**
 * Check if screenshots have different visual content (via hash comparison)
 * @param {string} beforeScreenshot - Filename of before screenshot
 * @param {string} afterScreenshot - Filename of after screenshot
 * @param {string} projectDir - Project root directory
* @param {string} [runId] - Test run identifier (optional for backward compatibility)
 * @returns {boolean} True if screenshots differ
 */
export function hasVisibleChange(beforeScreenshot, afterScreenshot, projectDir, runId = '') {
  // Graceful fallback: if runId not provided, use generic screenshots dir
  if (!runId) {
    return false; // Cannot compare without run directory
  }
  const screenshotsDir = getScreenshotDir(projectDir, runId);
  const beforePath = resolve(screenshotsDir, beforeScreenshot);
  const afterPath = resolve(screenshotsDir, afterScreenshot);
  
  const beforeHash = getScreenshotHash(beforePath);
  const afterHash = getScreenshotHash(afterPath);
  
  if (!beforeHash || !afterHash) return false;
  
  return beforeHash !== afterHash;
}

/**
 * Check if DOM hashes indicate structural change
 * @param {object} trace - Trace object with dom.beforeHash and dom.afterHash
 * @returns {boolean} True if DOM hashes differ
 */
export function hasDomChange(trace) {
  if (!trace.dom || !trace.dom.beforeHash || !trace.dom.afterHash) {
    return false;
  }
  
  return trace.dom.beforeHash !== trace.dom.afterHash;
}
