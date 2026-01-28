#!/usr/bin/env node

/**
 * Stage 2: Compare two VERAX runs for determinism
 * 
 * Purpose: Verify that identical inputs produce identical artifacts
 * (except for allowed time fields like timestamps, durations)
 * 
 * Usage: node test/tools/compare-runs.mjs <run1-dir> <run2-dir>
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const ALLOWED_TIME_FIELDS = [
  'startedAt',
  'completedAt',
  'observedAt',
  'detectedAt',
  'learnedAt',
  'totalMs',
  'duration_ms',
  'durationMs',
  'duration',
  'timestamp',
  'timings',
];

/**
 * Recursively remove allowed time fields from object
 */
function normalizeForComparison(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeForComparison(item));
  }
  if (typeof obj !== 'object') return obj;

  const normalized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (ALLOWED_TIME_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      // Skip time fields
      continue;
    }
    normalized[key] = normalizeForComparison(value);
  }
  return normalized;
}

/**
 * Deep equality check with informative diff reporting
 */
function deepEqual(a, b, path = '') {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);

  if (JSON.stringify(normA) === JSON.stringify(normB)) {
    return { equal: true, diffs: [] };
  }

  const diffs = [];

  if (typeof normA !== typeof normB) {
    diffs.push(`Type mismatch at ${path}: ${typeof normA} vs ${typeof normB}`);
    return { equal: false, diffs };
  }

  if (Array.isArray(normA) && Array.isArray(normB)) {
    if (normA.length !== normB.length) {
      diffs.push(`Array length mismatch at ${path}: ${normA.length} vs ${normB.length}`);
    }
    for (let i = 0; i < Math.max(normA.length, normB.length); i++) {
      const result = deepEqual(normA[i], normB[i], `${path}[${i}]`);
      if (!result.equal) diffs.push(...result.diffs);
    }
  } else if (typeof normA === 'object' && normA !== null && typeof normB === 'object' && normB !== null) {
    const keysA = new Set(Object.keys(normA));
    const keysB = new Set(Object.keys(normB));

    for (const key of keysA) {
      if (!keysB.has(key)) {
        diffs.push(`Missing key in run2 at ${path}.${key}`);
      } else {
        const result = deepEqual(normA[key], normB[key], `${path}.${key}`);
        if (!result.equal) diffs.push(...result.diffs);
      }
    }
    for (const key of keysB) {
      if (!keysA.has(key)) {
        diffs.push(`Extra key in run2 at ${path}.${key}`);
      }
    }
  } else {
    diffs.push(`Value mismatch at ${path}: ${JSON.stringify(normA)} vs ${JSON.stringify(normB)}`);
  }

  return { equal: diffs.length === 0, diffs };
}

/**
 * Compare two artifact files
 */
function compareArtifact(run1Dir, run2Dir, artifactName) {
  try {
    const path1 = join(run1Dir, artifactName);
    const path2 = join(run2Dir, artifactName);

    const content1 = JSON.parse(readFileSync(path1, 'utf-8'));
    const content2 = JSON.parse(readFileSync(path2, 'utf-8'));

    return deepEqual(content1, content2);
  } catch (error) {
    return {
      equal: false,
      diffs: [`Error comparing ${artifactName}: ${error.message}`],
    };
  }
}

/**
 * Main comparison logic
 */
function main() {
  const [run1Dir, run2Dir] = process.argv.slice(2);

  if (!run1Dir || !run2Dir) {
    console.error('Usage: node test/tools/compare-runs.mjs <run1-dir> <run2-dir>');
    process.exit(1);
  }

  const artifactsToCompare = [
    'summary.json',
    'findings.json',
    'learn.json',
    'observe.json',
  ];

  let allEqual = true;
  const results = {};

  for (const artifact of artifactsToCompare) {
    const result = compareArtifact(run1Dir, run2Dir, artifact);
    results[artifact] = result;
    
    if (!result.equal) {
      allEqual = false;
      console.error(`\n❌ MISMATCH: ${artifact}`);
      for (const diff of result.diffs.slice(0, 5)) {
        console.error(`   ${diff}`);
      }
      if (result.diffs.length > 5) {
        console.error(`   ... and ${result.diffs.length - 5} more diffs`);
      }
    } else {
      console.log(`✓ ${artifact} matches`);
    }
  }

  if (allEqual) {
    console.log('\n✅ All artifacts are deterministically identical');
    process.exit(0);
  } else {
    console.error('\n❌ Determinism check FAILED');
    process.exit(1);
  }
}

main();
