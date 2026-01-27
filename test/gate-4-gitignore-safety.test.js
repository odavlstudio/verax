/**
 * GITIGNORE ENFORCEMENT TEST
 * 
 * Ensures .verax/ is in .gitignore to prevent accidental
 * commit of sensitive artifacts, screenshots, and traces.
 */

import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';

test('CRITICAL: .verax/ must be in .gitignore', () => {
  const gitignorePath = resolve(process.cwd(), '.gitignore');
  const gitignoreContent = readFileSync(gitignorePath, 'utf-8');

  // Check for multiple variations to be thorough
  const hasVeraxEntry = gitignoreContent.includes('.verax/');
  const hasVeraxWildcard = gitignoreContent.includes('**/.verax/');
  
  assert.ok(
    hasVeraxEntry || hasVeraxWildcard,
    '.verax/ must be in .gitignore to prevent accidental commit of sensitive artifacts'
  );
});

test('CRITICAL: artifacts/ must be in .gitignore', () => {
  const gitignorePath = resolve(process.cwd(), '.gitignore');
  const gitignoreContent = readFileSync(gitignorePath, 'utf-8');

  const hasArtifactsEntry = gitignoreContent.includes('artifacts/');
  
  assert.ok(
    hasArtifactsEntry,
    'artifacts/ must be in .gitignore to prevent accidental commit of test outputs'
  );
});

test('CRITICAL: .verax/ entry is not commented out', () => {
  const gitignorePath = resolve(process.cwd(), '.gitignore');
  const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
  
  const lines = gitignoreContent.split('\n');
  
  let foundActive = false;
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed.length === 0) {
      continue;
    }
    
    if (trimmed === '.verax/' || trimmed === '**/.verax/') {
      foundActive = true;
      break;
    }
  }
  
  assert.ok(
    foundActive,
    '.verax/ entry must be active (not commented out) in .gitignore'
  );
});
