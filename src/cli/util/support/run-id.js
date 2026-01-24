import { generateRunId as generateDeterministicRunId } from '../../../verax/core/run-id.js';
import { createHash as _createHash, randomBytes } from 'crypto';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { getTimeProvider } from './time-provider.js';

const ZERO_BUDGET = Object.freeze({
  maxScanDurationMs: 0,
  maxInteractionsPerPage: 0,
  maxUniqueUrls: 0,
  interactionTimeoutMs: 0,
  navigationTimeoutMs: 0,
});

// Deterministic run ID wrapper to align CLI with core generator (no time/randomness)
export function generateRunId(url = 'about:blank') {
  let baseOrigin = 'about:blank';
  try {
    baseOrigin = new URL(url).origin;
  } catch {
    baseOrigin = url;
  }
  return generateDeterministicRunId({
    url,
    safetyFlags: {},
    baseOrigin,
    scanBudget: ZERO_BUDGET,
    manifestPath: null,
  });
}

/**
 * Generate deterministic scanId from url + src root fingerprint + relevant config
 * @param {{url?: string, srcPath?: string, config?: Object}} params
 * @returns {string} 16-char hex scanId
 */
export function generateScanId({ url = 'about:blank', srcPath: _srcPath = '', config = {} } = {}) {
  let host = 'about-blank';
  try {
    host = new URL(url).hostname.replace(/\./g, '-');
  } catch {
    host = (url || 'about-blank').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  }
  const cfg = normalizeConfig(config);
  const profile = String(cfg.profile || 'standard').toLowerCase();
  const pkgName = (cfg.packageName || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const parts = ['scan', host, profile];
  if (pkgName) parts.push(pkgName);
  // Deterministic, human-readable, no hash-only directories
  return parts.filter(Boolean).join('-');
}

function normalizeConfig(cfg) {
  // Only include relevant, stable fields
  const normalized = {
    profile: cfg.profile || 'standard',
    learnPaths: Array.isArray(cfg.learnPaths) ? [...cfg.learnPaths].sort() : [],
    allowEmptyLearn: Boolean(cfg.allowEmptyLearn),
  };

  // Optionally include package.json name to differentiate monorepos
  try {
    const pkgPath = resolve(cfg.projectRoot || process.cwd(), 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8').toString());
      normalized.packageName = pkg.name || null;
    }
  } catch {
    // ignore
  }
  return normalized;
}

/**
 * Generate unique per-execution runId
 * Must never collide across executions
 * @returns {string} runId string
 */
export function generateUniqueRunId() {
  const tp = getTimeProvider();
  const ts = tp.iso().replace(/[:.]/g, '-');
  const rand = randomBytes(4).toString('hex');
  // Use ISO-like prefix for readability, plus random suffix
  return `${ts}_${rand}`;
}



