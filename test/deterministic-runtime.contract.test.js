/**
 * CONTRACT TEST: Deterministic Runtime Layers
 * 
 * VERAX CONSTITUTION: No Date.now() or Math.random() influencing findings/IDs/artifacts in observe/detect layers.
 * 
 * CLARIFICATION: Date.now() is permitted ONLY in timing/telemetry contexts (timeouts, performance metrics)
 * that are NOT persisted into deterministic output (findings.json, run IDs, stable artifacts).
 * All user-facing findings, IDs, and comparison artifacts must be deterministic.
 * 
 * This test scans runtime code for non-deterministic patterns that would
 * violate the deterministic output guarantee for findings.
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const _RUNTIME_LAYERS = [
  'src/verax/observe',
  'src/verax/detect'
];

function scanDirectory(dir, pattern, results = []) {
  const entries = readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      scanDirectory(fullPath, pattern, results);
    } else if (entry.endsWith('.js') || entry.endsWith('.mjs') || entry.endsWith('.ts')) {
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = pattern.exec(line);
        
        if (match) {
          // Skip comments
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
            continue;
          }
          
          results.push({
            file: fullPath,
            line: i + 1,
            content: line.trim(),
            violation: match[0]
          });
        }
      }
    }
  }
  
  return results;
}

test('CONTRACT: No Date.now() in observe/ runtime layer', () => {
  const violations = [];
  
  scanDirectory('src/verax/observe', /Date\.now\(\)/g, violations);
  
  // Filter out page.evaluate() contexts - they run in browser and cannot use Node timeProvider
  // Only flag Date.now() in Node.js runtime contexts
  const nodeRuntimeViolations = violations.filter(v => {
    // Check if violation is within page.evaluate() context
    const fileContent = fs.readFileSync(v.file, 'utf-8');
    const lines = fileContent.split('\n');
    let _inEvaluate = false;
    let evaluateDepth = 0;
    
    for (let i = 0; i < Math.min(v.line, lines.length); i++) {
      const line = lines[i];
      evaluateDepth += (line.match(/page\.evaluate\(/g) || []).length;
      evaluateDepth -= (line.match(/\);/g) || []).filter((_, idx) => {
        const before = line.substring(0, idx);
        return before.includes('resolve') || before.includes('Promise');
      }).length;
    }
    
    // If we're inside an evaluate block, skip this violation
    return evaluateDepth === 0;
  });
  
  if (nodeRuntimeViolations.length > 0) {
    const message = 'Date.now() found in observe/ Node runtime layer:\n' +
      nodeRuntimeViolations.map(v => `  ${v.file}:${v.line} - ${v.content}`).join('\n');
    assert.fail(message);
  }
  
  assert.ok(true, 'No Date.now() violations in observe/ Node runtime');
});

test('CONTRACT: No Math.random() in observe/ runtime layer', () => {
  const violations = [];
  
  scanDirectory('src/verax/observe', /Math\.random\(\)/g, violations);
  
  if (violations.length > 0) {
    const message = 'Math.random() found in observe/ runtime layer:\n' +
      violations.map(v => `  ${v.file}:${v.line} - ${v.content}`).join('\n');
    assert.fail(message);
  }
  
  assert.ok(true, 'No Math.random() violations in observe/');
});

test('CONTRACT: No Date.now() in detect/ runtime layer', () => {
  const violations = [];
  
  scanDirectory('src/verax/detect', /Date\.now\(\)/g, violations);
  
  if (violations.length > 0) {
    const message = 'Date.now() found in detect/ runtime layer:\n' +
      violations.map(v => `  ${v.file}:${v.line} - ${v.content}`).join('\n');
    assert.fail(message);
  }
  
  assert.ok(true, 'No Date.now() violations in detect/');
});

test('CONTRACT: No Math.random() in detect/ runtime layer', () => {
  const violations = [];
  
  scanDirectory('src/verax/detect', /Math\.random\(\)/g, violations);
  
  if (violations.length > 0) {
    const message = 'Math.random() found in detect/ runtime layer:\n' +
      violations.map(v => `  ${v.file}:${v.line} - ${v.content}`).join('\n');
    assert.fail(message);
  }
  
  assert.ok(true, 'No Math.random() violations in detect/');
});

test('CONTRACT: observed-expectation.js uses deterministic IDs', () => {
  const content = readFileSync('src/verax/observe/observed-expectation.js', 'utf-8');
  
  // Should import stableHashId
  assert.ok(content.includes('stableHashId'), 'Must import stableHashId utility');
  
  // Should not use Date.now() for IDs
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('Date.now()') && line.includes('id:')) {
      assert.fail(`observed-expectation.js:${i + 1} still uses Date.now() for ID: ${line.trim()}`);
    }
  }
  
  assert.ok(true, 'observed-expectation.js uses deterministic IDs');
});

test('CONTRACT: loading-sensor.js uses deterministic windowId', () => {
  const content = readFileSync('src/verax/observe/loading-sensor.js', 'utf-8');
  
  // Should import stable ID utilities or use counter
  assert.ok(
    content.includes('createCounterId') || content.includes('stableHashId'),
    'Must use deterministic ID generation'
  );
  
  // Should not use Math.random() for windowId
  if (content.includes('Math.random()')) {
    assert.fail('loading-sensor.js still uses Math.random()');
  }
  
  assert.ok(true, 'loading-sensor.js uses deterministic windowId');
});
