import { resolve } from 'path';
import { getUrlPath, getScreenshotHash } from './evidence-validator.js';

export function hasMeaningfulUrlChange(beforeUrl, afterUrl) {
  const beforePath = getUrlPath(beforeUrl);
  const afterPath = getUrlPath(afterUrl);
  
  if (!beforePath || !afterPath) return false;
  
  if (beforePath === afterPath) return false;
  
  const beforeNormalized = beforePath.replace(/\/$/, '') || '/';
  const afterNormalized = afterPath.replace(/\/$/, '') || '/';
  
  return beforeNormalized !== afterNormalized;
}

export function hasVisibleChange(beforeScreenshot, afterScreenshot, projectDir) {
  const beforePath = resolve(projectDir, '.veraxverax', 'observe', beforeScreenshot);
  const afterPath = resolve(projectDir, '.veraxverax', 'observe', afterScreenshot);
  
  const beforeHash = getScreenshotHash(beforePath);
  const afterHash = getScreenshotHash(afterPath);
  
  if (!beforeHash || !afterHash) return false;
  
  return beforeHash !== afterHash;
}

export function hasDomChange(trace) {
  if (!trace.dom || !trace.dom.beforeHash || !trace.dom.afterHash) {
    return false;
  }
  
  return trace.dom.beforeHash !== trace.dom.afterHash;
}

