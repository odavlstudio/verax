/**
 * DETERMINISM CONTRACT TEST
 * 
 * CRITICAL INVARIANT: VERAX must produce byte-identical artifacts across identical runs.
 * 
 * This test enforces ZERO tolerance for nondeterministic time sources in src/.
 * 
 * RULE: NO `new Date()` or `Date.now()` calls in src/ except time-provider.js
 * 
 * WHY: Timestamps embedded in artifacts break determinism guarantee.
 * 
 * CORRECT: getTimeProvider().iso() or getTimeProvider().now()
 * 
 * This test MUST fail if ANY new Date() usage is added to src/.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcDir = resolve(__dirname, '../../src');

/**
 * Recursively scan directory for JS files
 */
function* scanJsFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* scanJsFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      yield fullPath;
    }
  }
}

/**
 * Find timestamp embedding in artifacts (.toISOString() usage)
 * 
 * RULE: Date.now() for timing/duration is DETERMINISTIC (allowed)
 * RULE: new Date().toISOString() embeds timestamp in artifacts (FORBIDDEN)
 */
function findNativeDateUsage(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const violations = [];
  
  // CRITICAL: Only catch timestamp embedding in artifacts
  // Pattern: new Date().toISOString()
  const timestampPattern = /new Date\([^)]*\)\.toISOString\(\)/g;
  let match;
  while ((match = timestampPattern.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    violations.push({
      type: 'new Date().toISOString()',
      line: lineNum,
      snippet: getLineSnippet(content, lineNum)
    });
  }
  
  return violations;
}

/**
 * Get line snippet for error reporting
 */
function getLineSnippet(content, lineNum) {
  const lines = content.split('\n');
  return lines[lineNum - 1]?.trim() || '';
}

/**
 * DETERMINISM CONTRACT: No timestamp embedding in artifacts
 * 
 * ALLOWS: Date.now() for timing/duration (deterministic)
 * FORBIDS: new Date().toISOString() in artifacts (nondeterministic)
 */
test('MUST NOT embed timestamps in artifacts via new Date().toISOString()', () => {
  const violations = [];
  
  // Scan all JS files in src/
  for (const filePath of scanJsFiles(srcDir)) {
    const relativePath = relative(srcDir, filePath).replace(/\\/g, '/');
    
    // ALLOWLIST: time-provider.js is the ONLY allowed file
    if (relativePath === 'cli/util/support/time-provider.js') {
      continue;
    }
    
    // Find violations
    const fileViolations = findNativeDateUsage(filePath);
    if (fileViolations.length > 0) {
      violations.push({
        file: relativePath,
        violations: fileViolations
      });
    }
  }
  
  // Report violations
  if (violations.length > 0) {
    const report = violations.map(v => {
      const lines = v.violations.map(vv => 
        `    Line ${vv.line}: ${vv.type} - ${vv.snippet}`
      ).join('\n');
      return `  ${v.file}:\n${lines}`;
    }).join('\n\n');
    
    throw new Error(
      `DETERMINISM VIOLATION: Found timestamp embedding in ${violations.length} file(s):\n\n${report}\n\n` +
      `RULE: Use getTimeProvider().iso() instead of new Date().toISOString()\n` +
      `WHY: Timestamps in artifacts break byte-identical guarantee.\n` +
      `FIX: Import { getTimeProvider } from '../../cli/util/support/time-provider.js'\n` +
      `NOTE: Date.now() for timing/duration is ALLOWED (deterministic)`
    );
  }
  
  // Success - zero violations
  assert.deepEqual(violations, []);
});


