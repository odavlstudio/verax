import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { detectProjectType } from '../src/verax/learn/project-detector.js';

test('detectProjectType recognizes vue_router when vue-router is in dependencies', async () => {
  const fixtureDir = resolve('./test/fixtures/vue-router-app');
  const projectType = await detectProjectType(fixtureDir);
  assert.strictEqual(projectType, 'vue_router', 'Should detect vue_router project type');
});

test('detectProjectType recognizes vue_spa when only vue is in dependencies', async () => {
  const { mkdirSync, writeFileSync, rmSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  
  const tempDir = join(tmpdir(), `verax-vue-spa-test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  
  try {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      dependencies: {
        vue: '^3.0.0'
      }
    }));
    
    const projectType = await detectProjectType(tempDir);
    assert.strictEqual(projectType, 'vue_spa', 'Should detect vue_spa when only vue is present');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
