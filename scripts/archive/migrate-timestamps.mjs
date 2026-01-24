#!/usr/bin/env node
/**
 * BATCH MIGRATION SCRIPT
 * Migrates all remaining new Date().toISOString() calls to getTimeProvider().iso()
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const files = [
  'src/verax/core/determinism-model.js',
  'src/verax/core/ga/ga-report-writer.js',
  'src/verax/core/ga/ga.contract.js',
  'src/verax/core/guardrails/guardrails-report-writer.js',
  'src/verax/core/integrity/integrity.js',
  'src/verax/core/integrity/poisoning.js',
  'src/verax/core/observe/run-timeline.js',
  'src/verax/core/perf/perf.report.js',
  'src/verax/core/pipeline-tracker.js',
  'src/verax/core/release/provenance.builder.js',
  'src/verax/core/release/release-report-writer.js',
  'src/verax/core/release/reproducibility.check.js',
  'src/verax/core/release/sbom.builder.js',
  'src/verax/core/report/cross-index.js',
  'src/verax/core/report/human-summary.js',
  'src/verax/core/run-manifest.js',
  'src/verax/core/security/secrets.scan.js',
  'src/verax/core/security/security-report.js',
  'src/verax/core/security/supplychain.policy.js',
  'src/verax/core/security/vuln.scan.js',
  'src/verax/core/truth/truth.certificate.js',
];

let migrated = 0;
let errors = 0;

for (const file of files) {
  try {
    const filePath = resolve(process.cwd(), file);
    const content = readFileSync(filePath, 'utf8');
    
    // Replace all occurrences
    const updated = content.replace(/new Date\([^)]*\)\.toISOString\(\)/g, 'getTimeProvider().iso()');
    
    if (content !== updated) {
      // Add import if not present
      let final = updated;
      if (!updated.includes('getTimeProvider')) {
        // Determine correct import path based on file location
        const depth = file.split('/').length - 2; // Subtract 'src' and filename
        const importPath = '../'.repeat(depth) + 'cli/util/time-provider.js';
        
        // Find first import statement and add after it
        const importMatch = updated.match(/^((?:\/\*[\s\S]*?\*\/\s*)?(?:import .+?;\s*)+)/m);
        if (importMatch) {
          final = updated.replace(importMatch[0], importMatch[0] + `import { getTimeProvider } from '${importPath}';\n`);
        } else {
          // No imports found, add at top after comments
          const commentMatch = updated.match(/^((?:\/\*[\s\S]*?\*\/\s*)*)/);
          if (commentMatch) {
            final = updated.replace(commentMatch[0], commentMatch[0] + `import { getTimeProvider } from '${importPath}';\n\n`);
          } else {
            final = `import { getTimeProvider } from '${importPath}';\n\n` + updated;
          }
        }
      }
      
      writeFileSync(filePath, final, 'utf8');
      console.log(`✓ ${file}`);
      migrated++;
    } else {
      console.log(`  ${file} (no changes)`);
    }
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
    errors++;
  }
}

console.log(`\nMigrated: ${migrated} files`);
if (errors > 0) {
  console.error(`Errors: ${errors} files`);
  process.exit(1);
}
