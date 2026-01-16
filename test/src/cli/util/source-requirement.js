import { existsSync, readdirSync, statSync } from 'fs';
import { extname, join, resolve } from 'path';
import { DataError } from './errors.js';
import { getSourceCodeRequirementBanner } from '../../verax/core/product-definition.js';

const CODE_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.html']);

function safeReaddir(dirPath) {
  try {
    return readdirSync(dirPath);
  } catch {
    return [];
  }
}

function directoryHasCode(dirPath) {
  const entries = safeReaddir(dirPath);
  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }

    if (stats.isFile() && CODE_EXTS.has(extname(entry).toLowerCase())) {
      return true;
    }

    if (stats.isDirectory() && (entry === 'src' || entry === 'app')) {
      const nested = safeReaddir(fullPath).slice(0, 50);
      if (nested.some((name) => CODE_EXTS.has(extname(name).toLowerCase()))) {
        return true;
      }
    }
  }
  return false;
}

export function assertHasLocalSource(srcPath) {
  const resolved = resolve(srcPath);
  const hasPackageJson = existsSync(join(resolved, 'package.json'));
  const hasIndexHtml = existsSync(join(resolved, 'index.html'));
  const hasCodeFiles = directoryHasCode(resolved);

  if (!hasPackageJson && !hasIndexHtml && !hasCodeFiles) {
    const banner = getSourceCodeRequirementBanner();
    throw new DataError(
      `${banner} Provide --src pointing to your repository so VERAX can analyze expectations. See docs/README.md for the canonical product contract.`
    );
  }

  return { hasPackageJson, hasIndexHtml, hasCodeFiles };
}
