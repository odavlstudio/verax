/**
 * CONTRACT TEST: Retention activeRunId Always Provided
 * 
 * HARD GUARD: The run command MUST always pass activeRunId when calling applyRetention.
 * This prevents accidental deletion of the current run.
 * 
 * This test verifies that the contract is locked in place.
 */

import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('Retention HARD GUARD: run.js always passes activeRunId', async (_t) => {
  // Read the run.js file to verify activeRunId is always passed
  const runCommandPath = join(__dirname, '../../src/cli/commands/run.js');
  const content = readFileSync(runCommandPath, 'utf-8');
  
  // Find all applyRetention calls
  const retentionCalls = content.match(/applyRetention\s*\(\s*\{[^}]+activeRunId\s*:\s*([^,}]+)[^}]*\}/g);
  
  assert.ok(retentionCalls && retentionCalls.length > 0, 'Should have at least one applyRetention call with activeRunId');
  
  // Verify activeRunId is set to runId (the current run's ID)
  const hasRunIdReference = retentionCalls.some(call => call.includes('activeRunId: runId'));
  assert.ok(hasRunIdReference, 'activeRunId should reference runId variable (current run)');
  
  // Ensure no call to applyRetention without activeRunId
  const allRetentionCalls = content.match(/applyRetention\s*\(\s*\{[^}]*\}/g) || [];
  const retentionWithoutActiveRunId = allRetentionCalls.filter(call => !call.includes('activeRunId'));
  
  assert.strictEqual(retentionWithoutActiveRunId.length, 0, 'No applyRetention call should omit activeRunId');
});

test('Retention error handling: missing activeRunId returns error (not silent no-op)', async (_t) => {
  // Verify the retention function itself guards against missing activeRunId
  const retentionPath = join(__dirname, '../../src/cli/util/support/retention.js');
  const content = readFileSync(retentionPath, 'utf-8');
  
  // Check for the HARD GUARD that returns error if activeRunId is missing
  const hasHardGuard = content.includes('activeRunId === null') || 
                       content.includes('activeRunId === undefined') || 
                       content.includes('activeRunId === \'\'');
  
  assert.ok(hasHardGuard, 'Should have HARD GUARD checking for missing activeRunId');
  
  // Verify it returns an error (not silent skip)
  const returnsError = content.includes('errors: [') && content.includes('activeRunId is required');
  assert.ok(returnsError, 'Should return error message when activeRunId is missing');
});
