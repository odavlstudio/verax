/**
 * TRUST SURFACE LOCK: Coverage Cap Regression Test
 * 
 * Ensures that coverageRatio NEVER exceeds 1.0 (100%)
 * Even if attempted > expectationsTotal due to bugs or edge cases
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync, readFileSync } from 'fs';
import { getTimeProvider } from '../src/cli/util/support/time-provider.js';
import { writeSummaryJson } from '../src/cli/util/evidence/summary-writer.js';

describe('TRUST SURFACE LOCK: Coverage Cap at 100%', () => {
  
  it('coverageRatio capped at 1.0 when attempted > expectationsTotal', () => {
    const testDir = join(tmpdir(), `verax-test-${getTimeProvider().now()}`);
    mkdirSync(testDir, { recursive: true });
    const summaryPath = join(testDir, 'summary.json');
    
    try {
      // SCENARIO: Bug causes attempted to exceed expectationsTotal
      const summaryData = {
        runId: 'test-run',
        status: 'SUCCESS',
        startedAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:01:00Z',
        command: 'verax run',
        url: 'http://test.com',
        notes: '',
      };
      
      const stats = {
        expectationsTotal: 10,
        attempted: 12, // BUG: Exceeded total!
        observed: 10,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        UNKNOWN: 0,
      };
      
      writeSummaryJson(summaryPath, summaryData, stats, null);
      
      // Read back and verify cap
      const written = JSON.parse(readFileSync(summaryPath, 'utf8'));
      
      // CRITICAL: coverageRatio MUST be capped at 1.0
      assert.strictEqual(
        written.observe.coverageRatio,
        1.0,
        `Coverage ratio MUST be capped at 1.0 when attempted (${stats.attempted}) > expectationsTotal (${stats.expectationsTotal})`
      );
      
      // Counts should still be accurate
      assert.strictEqual(written.observe.expectationsTotal, 10);
      assert.strictEqual(written.observe.attempted, 12);
      
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  it('coverageRatio = 1.0 when attempted === expectationsTotal', () => {
    const testDir = join(tmpdir(), `verax-test-${getTimeProvider().now()}`);
    mkdirSync(testDir, { recursive: true });
    const summaryPath = join(testDir, 'summary.json');
    
    try {
      const summaryData = {
        runId: 'test-run',
        status: 'SUCCESS',
        startedAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:01:00Z',
        command: 'verax run',
        url: 'http://test.com',
        notes: '',
      };
      
      const stats = {
        expectationsTotal: 10,
        attempted: 10,
        observed: 10,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        UNKNOWN: 0,
      };
      
      writeSummaryJson(summaryPath, summaryData, stats, null);
      
      const written = JSON.parse(readFileSync(summaryPath, 'utf8'));
      
      assert.strictEqual(written.observe.coverageRatio, 1.0);
      assert.strictEqual(written.observe.expectationsTotal, 10);
      assert.strictEqual(written.observe.attempted, 10);
      
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  it('coverageRatio < 1.0 when attempted < expectationsTotal', () => {
    const testDir = join(tmpdir(), `verax-test-${getTimeProvider().now()}`);
    mkdirSync(testDir, { recursive: true });
    const summaryPath = join(testDir, 'summary.json');
    
    try {
      const summaryData = {
        runId: 'test-run',
        status: 'INCOMPLETE',
        startedAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:01:00Z',
        command: 'verax run',
        url: 'http://test.com',
        notes: '',
      };
      
      const stats = {
        expectationsTotal: 10,
        attempted: 7, // Partial coverage
        observed: 7,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        UNKNOWN: 0,
      };
      
      writeSummaryJson(summaryPath, summaryData, stats, null);
      
      const written = JSON.parse(readFileSync(summaryPath, 'utf8'));
      
      assert.strictEqual(written.observe.coverageRatio, 0.7);
      assert.ok(written.observe.coverageRatio < 1.0);
      
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  it('coverageRatio = 0 when expectationsTotal = 0', () => {
    const testDir = join(tmpdir(), `verax-test-${getTimeProvider().now()}`);
    mkdirSync(testDir, { recursive: true });
    const summaryPath = join(testDir, 'summary.json');
    
    try {
      const summaryData = {
        runId: 'test-run',
        status: 'SUCCESS',
        startedAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:01:00Z',
        command: 'verax run',
        url: 'http://test.com',
        notes: '',
      };
      
      const stats = {
        expectationsTotal: 0,
        attempted: 0,
        observed: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        UNKNOWN: 0,
      };
      
      writeSummaryJson(summaryPath, summaryData, stats, null);
      
      const written = JSON.parse(readFileSync(summaryPath, 'utf8'));
      
      // Empty site: coverage = 0 is acceptable
      assert.strictEqual(written.observe.coverageRatio, 0);
      
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
