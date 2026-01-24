#!/usr/bin/env node

/**
 * NO-GUESSING TERM GUARD
 *
 * Fails if any forbidden terms reappear anywhere in the repo.
 * Scope: source + tests + docs (excluding vendor/build outputs).
 */

import { readdirSync, readFileSync } from 'fs';
import { join, extname, relative } from 'path';

const forbiddenTokens = [
  ['in', 'fer'],
  ['in', 'ference'],
  ['heur', 'istic'],
  ['as', 'sume'],
  ['best', 'effort']
];

const forbidden = forbiddenTokens.map(parts => {
  if (parts[0] === 'best') {
    return new RegExp(parts[0] + '[- ]' + parts[1], 'i');
  }
  return new RegExp(parts.join(''), 'i');
});

const allowedExt = new Set([
  '.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx', '.json', '.md',
  '.yml', '.yaml', '.txt', '.html', '.css', '.mjs'
]);

const skipSegments = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'coverage',
  'tmp/logs'
]);

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    return true;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function shouldSkipPath(relPath) {
  return relPath.split(/\\|\//).some(part => skipSegments.has(part));
}

function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(process.cwd(), full);
    if (shouldSkipPath(rel)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function scanRepo() {
  const matches = [];
  const files = collectFiles(process.cwd());

  for (const file of files) {
    const rel = relative(process.cwd(), file);

    // Check file name/path first
    if (forbidden.some(rx => rx.test(rel))) {
      matches.push({ file: rel, location: 'path', snippet: rel });
      continue;
    }

    const ext = extname(file).toLowerCase();
    if (!allowedExt.has(ext)) {
      continue; // Skip non-text files to keep scan fast
    }

    const content = readFileSync(file, 'utf8');
    for (const rx of forbidden) {
      const found = content.match(rx);
      if (found) {
        const idx = found.index ?? content.indexOf(found[0]);
        const context = content.slice(Math.max(0, idx - 20), Math.min(content.length, idx + 20)).replace(/\s+/g, ' ');
        matches.push({ file: rel, location: 'content', snippet: context });
        break; // One match per file is enough
      }
    }
  }

  return matches;
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('NO-GUESSING TERM GUARD');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

const matches = scanRepo();

if (test('Repository contains no forbidden terms', () => {
  assert(matches.length === 0, `Forbidden terms found in ${matches.length} file(s)`);
})) {
  passed++;
} else {
  failed++;
}

if (matches.length > 0) {
  console.error('\nForbidden term details:');
  for (const match of matches.slice(0, 20)) {
    console.error(`- ${match.file} [${match.location}] -> ${match.snippet}`);
  }
  if (matches.length > 20) {
    console.error(`...and ${matches.length - 20} more`);
  }
}

console.log('\nSummary:');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failed > 0) {
  process.exitCode = 1;
}





