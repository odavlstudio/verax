#!/usr/bin/env node
/**
 * Root Pollution Guard
 * Enforces strict Tier-1 root contract.
 * Only 5 functional directories + allowed files may exist at root.
 */
import { resolve } from 'path';
import { readdirSync } from 'fs';

const projectRoot = resolve('.');

// Only 5 functional directories allowed (tracked in Git)
const ALLOWED_DIRS = new Set([
  '.github',
  'bin',
  'src',
  'test',
  'scripts',
]);

// Allowed files only
const ALLOWED_FILES = new Set([
  'package.json',
  'package-lock.json',
  'README.md',
  'LICENSE',
  '.nvmrc',
  '.gitignore',
  'VERAX — Product Constitution.md',
  'ROOT_CONTRACT.md',
]);

// Environment folders to ignore (not part of contract)
const IGNORED_ENV = new Set([
  '.git',
  'node_modules',
  '.verax',          // Local-only, must be git-ignored
  'artifacts',       // Local-only, must be git-ignored
  '.test-temp-artifacts', // Test-generated, git-ignored
  '.verax',               // Test-generated, git-ignored
]);

function getWorkingTopLevelEntries() {
  const entries = readdirSync(projectRoot, { withFileTypes: true });
  return entries.map((d) => d.name);
}

function main() {
  const entries = getWorkingTopLevelEntries();
  const violations = entries.filter((e) => {
    const isAllowedDir = ALLOWED_DIRS.has(e);
    const isAllowedFile = ALLOWED_FILES.has(e);
    const isIgnoredEnv = IGNORED_ENV.has(e);
    return !isAllowedDir && !isAllowedFile && !isIgnoredEnv;
  });

  if (violations.length > 0) {
    const msg = [
      'Root pollution detected. This project enforces a strict root contract.',
      '',
      'FUNCTIONAL DIRECTORIES ONLY (5 allowed, tracked in Git):',
      ...Array.from(ALLOWED_DIRS).sort().map((v) => `  - ${v}/`),
      '',
      'FILES ONLY (no directories except above):',
      ...Array.from(ALLOWED_FILES).sort().map((v) => `  - ${v}`),
      '',
      'LOCAL-ONLY (git-ignored, never tracked):',
      ...Array.from(IGNORED_ENV).sort().map((v) => `  - ${v}/`),
      '',
      'VIOLATIONS FOUND:',
      ...violations.map((v) => `  ✗ ${v}`),
      '',
      'ACTION: Delete or move to scripts/legacy/ or artifacts/* per ROOT_CONTRACT.md',
    ].join('\n');
    console.error(msg);
    process.exit(1);
  }
}

main();
