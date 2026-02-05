#!/usr/bin/env node

/**
 * VERAX CLI Shim
 * Delegates to src/cli/entry.js
 */

import('../src/cli/entry.js').catch(async (error) => {
  try {
    const { EXIT_CODES, buildOutcome, emitOutcome } = await import('../src/cli/config/cli-contract.js');
    const outcome = buildOutcome({
      command: 'verax',
      exitCode: EXIT_CODES.INVARIANT_VIOLATION,
      reason: `Failed to load CLI: ${error instanceof Error ? error.message : String(error)}`,
      action: 'Reinstall package or re-run with a valid installation',
    });
    emitOutcome(outcome, { json: false });
    process.exit(outcome.exitCode);
  } catch {
    // Last resort: still avoid non-contract exit codes.
    try {
      process.stdout.write('RESULT INVARIANT_VIOLATION\n');
      process.stdout.write('REASON Failed to load CLI\n');
      process.stdout.write('ACTION Reinstall package or re-run with a valid installation\n');
    } catch {
      // ignore
    }
    process.exit(50);
  }
});




