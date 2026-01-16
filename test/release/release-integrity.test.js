/**
 * PHASE 21.7 — Release Integrity Tests
 * 
 * Tests for release provenance, SBOM, and reproducibility checks.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { buildProvenance, writeProvenance } from '../src/verax/core/release/provenance.builder.js';
import { buildSBOM, writeSBOM } from '../src/verax/core/release/sbom.builder.js';
import { checkReproducibility, writeReproducibilityReport } from '../src/verax/core/release/reproducibility.check.js';
import { enforceReleaseReadiness } from '../src/verax/core/release/release.enforcer.js';

const projectRoot = resolve(process.cwd());
const testDir = resolve(projectRoot, '.test-release-integrity');

describe('Phase 21.7: Release Integrity', () => {
  test.beforeEach(() => {
    // Clean test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });
  
  test.afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('Provenance Builder', () => {
    test('should build provenance with all required fields', async () => {
      const provenance = await buildProvenance(projectRoot);
      
      assert.ok(Object.prototype.hasOwnProperty.call(provenance, 'version'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance, 'git'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance.git, 'commit'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance.git, 'dirty'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance, 'env'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance.env, 'node'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance.env, 'os'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance.env, 'arch'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance, 'policies'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance.policies, 'guardrails'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance.policies, 'confidence'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance, 'gaStatus'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance, 'artifacts'));
      assert.ok(Object.prototype.hasOwnProperty.call(provenance, 'hashes'));
      assert.strictEqual(provenance.git.dirty, false);
    });
    
    test('should write provenance to file', async () => {
      const provenance = await buildProvenance(projectRoot);
      const path = writeProvenance(testDir, provenance);
      
      assert.ok(existsSync(path));
      const written = JSON.parse(readFileSync(path, 'utf-8'));
      assert.deepStrictEqual(written, provenance);
    });
  });
  
  describe('SBOM Builder', () => {
    test('should build SBOM with CycloneDX format', async () => {
      const sbom = await buildSBOM(projectRoot);
      
      assert.strictEqual(sbom.bomFormat, 'CycloneDX');
      assert.strictEqual(sbom.specVersion, '1.4');
      assert.ok(Object.prototype.hasOwnProperty.call(sbom, 'metadata'));
      assert.ok(Object.prototype.hasOwnProperty.call(sbom, 'components'));
      assert.ok(Array.isArray(sbom.components));
      assert.ok(sbom.components.length > 0);
    });
    
    test('should include main package in SBOM', async () => {
      const sbom = await buildSBOM(projectRoot);
      const mainComponent = sbom.components.find(c => c.type === 'application');
      
      assert.ok(mainComponent);
      assert.ok(mainComponent.name);
      assert.ok(mainComponent.version);
    });
    
    test('should write SBOM to file', async () => {
      const sbom = await buildSBOM(projectRoot);
      const path = writeSBOM(testDir, sbom);
      
      assert.ok(existsSync(path));
      const written = JSON.parse(readFileSync(path, 'utf-8'));
      assert.deepStrictEqual(written, sbom);
    });
  });
  
  describe('Reproducibility Check', () => {
    test('should check reproducibility and generate report', async () => {
      const report = await checkReproducibility(projectRoot);
      
      assert.ok(Object.prototype.hasOwnProperty.call(report, 'verdict'));
      assert.ok(['REPRODUCIBLE', 'NON_REPRODUCIBLE'].includes(report.verdict));
      assert.ok(Object.prototype.hasOwnProperty.call(report, 'reproducible'));
      assert.ok(Object.prototype.hasOwnProperty.call(report, 'current'));
      assert.ok(Object.prototype.hasOwnProperty.call(report.current, 'gitCommit'));
      assert.ok(Object.prototype.hasOwnProperty.call(report.current, 'policies'));
      assert.ok(Object.prototype.hasOwnProperty.call(report.current, 'artifacts'));
    });
    
    test('should write reproducibility report to file', async () => {
      const report = await checkReproducibility(projectRoot);
      const path = writeReproducibilityReport(testDir, report);
      
      assert.ok(existsSync(path));
      const written = JSON.parse(readFileSync(path, 'utf-8'));
      assert.deepStrictEqual(written, report);
    });
  });
  
  describe('Release Enforcer', () => {
    test('should block release when provenance is missing', async () => {
      // Don't create provenance
      await assert.rejects(async () => {
        await enforceReleaseReadiness(testDir, 'release');
      }, /Cannot release/);
    });
    
    test('should block release when SBOM is missing', async () => {
      // Create provenance but not SBOM
      const provenance = await buildProvenance(projectRoot);
      writeProvenance(testDir, provenance);
      
      await assert.rejects(async () => {
        await enforceReleaseReadiness(testDir, 'release');
      }, /Cannot release/);
    });
    
    test('should block release when reproducibility report is missing', async () => {
      // Create provenance and SBOM but not reproducibility report
      const provenance = await buildProvenance(projectRoot);
      writeProvenance(testDir, provenance);
      
      const sbom = await buildSBOM(projectRoot);
      writeSBOM(testDir, sbom);
      
      await assert.rejects(async () => {
        await enforceReleaseReadiness(testDir, 'release');
      }, /Cannot release/);
    });
    
    test('should block release when reproducibility is NON_REPRODUCIBLE', async () => {
      // Create all files but with non-reproducible report
      const provenance = await buildProvenance(projectRoot);
      writeProvenance(testDir, provenance);
      
      const sbom = await buildSBOM(projectRoot);
      writeSBOM(testDir, sbom);
      
      const report = {
        verdict: 'NON_REPRODUCIBLE',
        reproducible: false,
        differences: [{ type: 'test', message: 'Test difference' }],
        current: {},
        checkedAt: new Date().toISOString()
      };
      writeReproducibilityReport(testDir, report);
      
      await assert.rejects(async () => {
        await enforceReleaseReadiness(testDir, 'release');
      }, /Cannot release/);
    });
  });
});


