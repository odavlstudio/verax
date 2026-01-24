#!/usr/bin/env node

/**
 * UTIL STRUCTURE CONTRACT
 * Ensures util files are grouped by concern (observation, detection, evidence, config, support)
 * and no longer live at util root.
 */

import assert from 'assert';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

const UTIL_ROOT = resolve(process.cwd(), 'src', 'cli', 'util');

function expectExists(relPath) {
  const target = join(UTIL_ROOT, relPath);
  assert.ok(existsSync(target), `${relPath} must exist at ${target}`);
}

function expectMissing(relPath) {
  const target = join(UTIL_ROOT, relPath);
  assert.ok(!existsSync(target), `${relPath} must be removed from util root`);
}

function verifyMoved(group, folder, files) {
  files.forEach((file) => {
    expectExists(join(folder, file));
    expectMissing(file);
  });
  console.log(`✓ ${group} files grouped under ${folder}`);
}

verifyMoved('observation', 'observation', [
  'observation-engine.js',
  'interaction-planner.js',
  'expectation-extractor.js',
  'runtime-budget.js',
]);

verifyMoved('detection', 'detection', [
  'detection-engine.js',
  'silent-failure-classifier.js',
  'evidence-law.js',
  'risk-framing.js',
]);

verifyMoved('evidence', 'evidence', [
  'evidence-manifest.js',
  'evidence-stream-writer.js',
  'redact.js',
  'dom-redactor.js',
  'screenshot-redactor.js',
  'evidence-size-tracker.js',
  'evidence-budget.js',
]);

verifyMoved('config', 'config', [
  'defaults.js',
  'load-config.js',
]);

verifyMoved('support', 'support', [
  'errors.js',
  'events.js',
  'paths.js',
  'run-id.js',
  'idgen.js',
  'cleanup-logger.js',
]);


