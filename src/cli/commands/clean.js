/*
Command: verax clean
Purpose: Clean up old run artifacts with retention policies (defaults to dry-run for safety).
Required: none
Optional: --keep-last <N>, --older-than <days>, --allow-delete-confirmed, --no-dry-run, --json
Outputs: Exactly one RESULT/REASON/ACTION block (JSON or text) summarizing cleanup.
Exit Codes: 0 SUCCESS | 40 INFRA_FAILURE | 64 USAGE_ERROR
Forbidden: deletion without explicit flags; multiple RESULT blocks; interactive prompts.
*/

import { join } from 'path';
import { buildOutcome as _buildOutcome, EXIT_CODES as _EXIT_CODES } from '../config/cli-contract.js';
import { existsSync } from 'fs';
import {
  loadRuns,
  buildCleanupPlan,
  executeCleanup,
  summarizeCleanup,
} from '../../verax/cleanup-engine.js';

export async function cleanCommand(options = {}) {
  const {
    projectRoot = '.',
    keepLast = 10,
    olderThanDays = null,
    allowDeleteConfirmed = false,
    dryRun = true,
    json = false,
  } = options;

  const runsDir = join(projectRoot, '.verax', 'runs');

  if (!existsSync(runsDir)) {
    if (json) {
      console.log(JSON.stringify({
        type: 'cleanup-complete',
        operation: 'SKIPPED',
        reason: 'No runs directory found',
        totalRuns: 0,
        deleted: 0,
        kept: 0,
        protected: 0,
      }));
    } else {
      console.log('No runs directory found. Nothing to clean.');
    }
    return { code: 0 };
  }

  try {
    // Load all runs
    const runs = loadRuns(runsDir);

    if (runs.length === 0) {
      if (json) {
        console.log(JSON.stringify({
          type: 'cleanup-complete',
          operation: 'SKIPPED',
          reason: 'No runs found',
          totalRuns: 0,
          deleted: 0,
          kept: 0,
          protected: 0,
        }));
      } else {
        console.log('No runs found. Nothing to clean.');
      }
      return { code: 0 };
    }

    // Build cleanup plan
    const plan = buildCleanupPlan(runs, {
      keepLast,
      olderThanDays,
      allowDeleteConfirmed,
    });

    // Execute cleanup
    const result = executeCleanup(plan, dryRun);

    // Summarize
    const summary = summarizeCleanup(plan, result);

    if (json) {
      console.log(JSON.stringify({
        type: 'cleanup-complete',
        ...summary,
      }));
    } else {
      // Human-readable output
      console.log(`\n=== VERAX Run Cleanup ${dryRun ? '(DRY RUN)' : ''} ===\n`);
      console.log(`Total runs: ${summary.totalRuns}`);
      console.log(`To delete: ${summary.deleted}`);
      console.log(`To keep: ${summary.kept}`);
      console.log(`Protected: ${summary.protected}`);

      if (summary.protected > 0) {
        console.log('\nProtection reasons:');
        for (const [reason, count] of Object.entries(summary.protectedReasons)) {
          console.log(`  - ${reason}: ${count} runs`);
        }
      }

      if (summary.errors > 0) {
        console.log(`\n⚠️  Errors: ${summary.errors}`);
      }

      if (summary.deleted > 0) {
        console.log('\nRuns to delete:');
        for (const runId of summary.deletedRuns.slice(0, 10)) {
          console.log(`  - ${runId}`);
        }
        if (summary.deletedRuns.length > 10) {
          console.log(`  ... and ${summary.deletedRuns.length - 10} more`);
        }
      }

      if (dryRun && summary.deleted > 0) {
        console.log('\n💡 This was a dry run. Use --no-dry-run to actually delete runs.');
      } else if (!dryRun && summary.deleted > 0) {
        console.log(`\n✅ Successfully deleted ${summary.deleted} runs.`);
      } else {
        console.log('\n✅ No runs to delete.');
      }
    }

    return { deleted: summary.deleted, kept: summary.kept, totalRuns: summary.totalRuns };
  } catch (error) {
    if (json) {
      console.log(JSON.stringify({
        type: 'cleanup-error',
        error: error.message,
      }));
    } else {
      console.error(`Error during cleanup: ${error.message}`);
    }
    return { code: 1 };
  }
}
