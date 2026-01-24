#!/usr/bin/env node
/**
 * ADD MISSING IMPORTS ONLY
 * Adds getTimeProvider import to files that use it but don't import it
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixes = [
  { file: 'src/verax/core/determinism/engine.js', depth: 3 },
  { file: 'src/verax/core/determinism/report-writer.js', depth: 3 },
  { file: 'src/verax/core/determinism-model.js', depth: 2 },
  { file: 'src/verax/core/ga/ga-report-writer.js', depth: 3 },
  { file: 'src/verax/core/ga/ga.contract.js', depth: 3 },
  { file: 'src/verax/core/guardrails/guardrails-report-writer.js', depth: 3 },
  { file: 'src/verax/core/integrity/integrity.js', depth: 3 },
  { file: 'src/verax/core/integrity/poisoning.js', depth: 3 },
  { file: 'src/verax/core/observe/run-timeline.js', depth: 3 },
  { file: 'src/verax/core/perf/perf.report.js', depth: 3 },
  { file: 'src/verax/core/pipeline-tracker.js', depth: 2 },
  { file: 'src/verax/core/release/provenance.builder.js', depth: 3 },
  { file: 'src/verax/core/release/release-report-writer.js', depth: 3 },
  { file: 'src/verax/core/release/reproducibility.check.js', depth: 3 },
  { file: 'src/verax/core/release/sbom.builder.js', depth: 3 },
  { file: 'src/verax/core/report/cross-index.js', depth: 3 },
  { file: 'src/verax/core/report/human-summary.js', depth: 3 },
  { file: 'src/verax/core/run-manifest.js', depth: 2 },
  { file: 'src/verax/core/security/secrets.scan.js', depth: 3 },
  { file: 'src/verax/core/security/security-report.js', depth: 3 },
  { file: 'src/verax/core/security/supplychain.policy.js', depth: 3 },
  { file: 'src/verax/core/security/vuln.scan.js', depth: 3 },
  { file: 'src/verax/core/truth/truth.certificate.js', depth: 3 },
];

let fixed = 0;

for (const {file, depth} of fixes) {
  try {
    const filePath = resolve(process.cwd(), file);
    const content = readFileSync(filePath, 'utf8');
    
    // Check if import already exists
    if (content.includes('getTimeProvider')) {
      const hasImport = content.match(/import.*getTimeProvider/);
      if (hasImport) {
        console.log(`  ${file} (already has import)`);
        continue;
      }
    }
    
    // Check if file uses getTimeProvider
    if (!content.includes('getTimeProvider()')) {
      console.log(`  ${file} (doesn't use getTimeProvider)`);
      continue;
    }
    
    const importPath = '../'.repeat(depth) + 'cli/util/time-provider.js';
    const importLine = `import { getTimeProvider } from '${importPath}';\n`;
    
    // Find first import and add after it
    const importRegex = /^import .+;$/m;
    const match = content.match(importRegex);
    
    if (match) {
      const insertPos = match.index + match[0].length + 1;
      const updated = content.slice(0, insertPos) + importLine + content.slice(insertPos);
      writeFileSync(filePath, updated, 'utf8');
      console.log(`✓ ${file}`);
      fixed++;
    } else {
      console.warn(`⚠ ${file}: No import found to insert after`);
    }
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
  }
}

console.log(`\nAdded imports to ${fixed} files`);
