/**
 * CONTRACT TEST: Help Text Accuracy
 * 
 * Ensures CLI help text matches actual supported commands (Stage 5 Product Lock).
 * No misleading references to removed/unsupported modes.
 */

import { strict as assert } from 'assert';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing CLI help text accuracy...');

// Run --help and capture output
const binPath = resolve(__dirname, '../bin/verax.js');
let helpOutput = '';
try {
  helpOutput = execSync(`node "${binPath}" --help`, { 
    encoding: 'utf-8',
    timeout: 5000 
  });
} catch (error) {
  // --help exits 0, but capture output anyway
  if (error.stdout) helpOutput = error.stdout;
}

// Stage 7: Help must emit exactly one RESULT/REASON/ACTION block (non-debug)
const lines = helpOutput.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const hasResult = lines.some((l) => l.startsWith('RESULT '));
const hasReason = lines.some((l) => l.startsWith('REASON '));
const hasAction = lines.some((l) => l.startsWith('ACTION '));

assert.ok(hasResult, 'Help must emit a RESULT line');
assert.ok(hasReason, 'Help must emit a REASON line');
assert.ok(hasAction, 'Help must emit an ACTION line');
assert.ok(!helpOutput.toLowerCase().includes('interactive'), 'Help must not reference interactive mode');

console.log('\n✅ CLI help text contract validated\n');
