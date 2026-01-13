/**
 * Root-level artifacts helper
 * Enforces strict routing of outputs to artifacts/* subdirectories.
 */
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

const BASE = 'artifacts';
const TYPE_DIRS = {
  'test-runs': 'test-runs',
  'tmp': 'tmp',
  'debug': 'debug',
  'logs': 'logs',
  'legacy': 'legacy',
};

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get an absolute path for an artifact output, enforcing isolation.
 * @param {('test-runs'|'tmp'|'debug'|'logs'|'legacy')} type
 * @param {string} name - filename or subpath (no leading slashes)
 * @returns {string} absolute path to write into
 */
export function getArtifactPath(type, name) {
  const subDir = TYPE_DIRS[type];
  if (!subDir) throw new Error(`Unknown artifact type: ${type}`);
  const dir = resolve(BASE, subDir);
  ensureDir(dir);
  return resolve(dir, name);
}

/**
 * Get directory for a given artifact type.
 */
export function getArtifactDir(type) {
  const subDir = TYPE_DIRS[type];
  if (!subDir) throw new Error(`Unknown artifact type: ${type}`);
  const dir = resolve(BASE, subDir);
  ensureDir(dir);
  return dir;
}
