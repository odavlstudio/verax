import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

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

export function getUrlPath(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  return normalized.pathname + normalized.hash;
}

export function getScreenshotHash(screenshotPath) {
  try {
    if (!existsSync(screenshotPath)) return null;
    const imageData = readFileSync(screenshotPath);
    return createHash('md5').update(imageData).digest('hex');
  } catch (error) {
    return null;
  }
}

