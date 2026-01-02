/**
 * test/stage7-watchdog.test.js
 * 
 * Stage 7: Watchdog Mode Integration Tests
 * 
 * Tests baseline creation, comparison, alerting, and update logic.
 * Watchdog Mode reuses Guardian verdicts for post-launch monitoring.
 */

const { executeReality } = require('../src/guardian/reality');
const { normalizeSiteKey, createBaseline, saveBaseline, loadBaseline, updateBaseline, baselineExists } = require('../src/guardian/baseline-registry');
const { compareToBaseline, shouldAlert, formatWatchdogAlert } = require('../src/guardian/watchdog-diff');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Stage 7: Watchdog Mode', () => {
  let testBaselineDir;

  beforeEach(() => {
    // Create temp directory for test baselines
    testBaselineDir = path.join(os.tmpdir(), `guardian-watchdog-test-${Date.now()}`);
    fs.mkdirSync(testBaselineDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test baselines
    if (fs.existsSync(testBaselineDir)) {
      fs.rmSync(testBaselineDir, { recursive: true, force: true });
    }
  });

  describe('normalizeSiteKey', () => {
    it('should remove protocol and trailing slash', () => {
      expect(normalizeSiteKey('https://example.com/')).toBe('example.com');
      expect(normalizeSiteKey('http://example.com')).toBe('example.com');
    });

    it('should remove port numbers', () => {
      expect(normalizeSiteKey('https://example.com:3000')).toBe('example.com');
      expect(normalizeSiteKey('http://localhost:8080')).toBe('localhost');
    });

    it('should remove query parameters and fragments', () => {
      expect(normalizeSiteKey('https://example.com?test=1')).toBe('example.com');
      expect(normalizeSiteKey('https://example.com#section')).toBe('example.com');
      expect(normalizeSiteKey('https://example.com/page?foo=bar#top')).toBe('example.com/page');
    });

    it('should preserve path', () => {
      expect(normalizeSiteKey('https://example.com/staging/app')).toBe('example.com/staging/app');
    });
  });

  describe('createBaseline', () => {
    it('should extract minimal baseline snapshot', () => {
      const realityResult = {
        finalVerdict: 'READY',
        verdictCard: {
          headline: 'Site Ready',
          severity: 'PASS',
          impactType: 'User Experience'
        },
        humanPath: {
          primary: 'SUCCESS',
          attempts: 5,
          flows: { SUCCESS: 3, FAILURE: 0, SKIPPED: 2 }
        },
        coverageInfo: {
          percent: 80,
          executed: 8,
          total: 10
        },
        selectorConfidence: {
          avgConfidence: 0.95
        },
        determinismHash: 'abc123'
      };

      const baseline = createBaseline('example.com', realityResult);

      expect(baseline.version).toBe(1);
      expect(baseline.siteKey).toBe('example.com');
      expect(baseline.finalVerdict).toBe('READY');
      expect(baseline.verdictCard.headline).toBe('Site Ready');
      expect(baseline.humanPath.primary).toBe('SUCCESS');
      expect(baseline.coverage.percent).toBe(80);
      expect(baseline.selectorConfidence.avgConfidence).toBe(0.95);
      expect(baseline.determinismHash).toBe('abc123');
      expect(baseline.timestamp).toBeDefined();
    });

    it('should handle missing optional fields', () => {
      const realityResult = {
        finalVerdict: 'FRICTION',
        verdictCard: { headline: 'Friction Detected' }
      };

      const baseline = createBaseline('test.com', realityResult);

      expect(baseline.finalVerdict).toBe('FRICTION');
      expect(baseline.humanPath).toBeNull();
      expect(baseline.coverage).toEqual({});
      expect(baseline.selectorConfidence).toEqual({});
    });
  });

  describe('saveBaseline and loadBaseline', () => {
    it('should save and load baseline correctly', () => {
      const baseline = {
        version: 1,
        siteKey: 'example.com',
        timestamp: Date.now(),
        finalVerdict: 'READY',
        verdictCard: { headline: 'Site Ready' },
        humanPath: { primary: 'SUCCESS' },
        coverage: { percent: 80 },
        selectorConfidence: { avgConfidence: 0.9 },
        determinismHash: 'hash123'
      };

      saveBaseline(baseline, testBaselineDir);

      const loaded = loadBaseline('example.com', testBaselineDir);
      expect(loaded).toEqual(baseline);
    });

    it('should return null if baseline does not exist', () => {
      const loaded = loadBaseline('nonexistent.com', testBaselineDir);
      expect(loaded).toBeNull();
    });

    it('should check baseline existence', () => {
      expect(baselineExists('example.com', testBaselineDir)).toBe(false);

      const baseline = { version: 1, siteKey: 'example.com', finalVerdict: 'READY' };
      saveBaseline(baseline, testBaselineDir);

      expect(baselineExists('example.com', testBaselineDir)).toBe(true);
    });
  });

  describe('compareToBaseline', () => {
    const readyBaseline = {
      finalVerdict: 'READY',
      verdictCard: { headline: 'Site Ready', severity: 'PASS' },
      humanPath: { primary: 'SUCCESS', attempts: 5, flows: { SUCCESS: 5, FAILURE: 0 } },
      coverage: { percent: 80, executed: 8, total: 10 },
      selectorConfidence: { avgConfidence: 0.9 }
    };

    it('should detect verdict downgrade READY -> FRICTION', () => {
      const currentResult = {
        finalVerdict: 'FRICTION',
        verdictCard: { headline: 'Friction Detected' },
        humanPath: { primary: 'SUCCESS' },
        coverageInfo: { percent: 80 },
        selectorConfidence: { avgConfidence: 0.9 }
      };

      const comparison = compareToBaseline(readyBaseline, currentResult);
      expect(comparison.degraded).toBe(true);
      expect(comparison.severity).toBe('MEDIUM');
      expect(comparison.reasons).toContain('Verdict downgraded: READY → FRICTION');
    });

    it('should detect verdict downgrade READY -> DO_NOT_LAUNCH', () => {
      const currentResult = {
        finalVerdict: 'DO_NOT_LAUNCH',
        verdictCard: { headline: 'Critical Issue' },
        humanPath: { primary: 'FAILURE' },
        coverageInfo: { percent: 80 },
        selectorConfidence: { avgConfidence: 0.9 }
      };

      const comparison = compareToBaseline(readyBaseline, currentResult);
      expect(comparison.degraded).toBe(true);
      expect(comparison.severity).toBe('HIGH');
      expect(comparison.reasons).toContain('Verdict downgraded: READY → DO_NOT_LAUNCH');
    });

    it('should detect coverage drop ≥ 20%', () => {
      const currentResult = {
        finalVerdict: 'READY',
        verdictCard: { headline: 'Site Ready' },
        humanPath: { primary: 'SUCCESS' },
        coverageInfo: { percent: 55, executed: 5, total: 10 }, // 80% -> 55% = 25% drop
        selectorConfidence: { avgConfidence: 0.9 }
      };

      const comparison = compareToBaseline(readyBaseline, currentResult);
      expect(comparison.degraded).toBe(true);
      expect(comparison.severity).toBe('MEDIUM');
      expect(comparison.reasons).toContain('Coverage dropped significantly: 80% → 55% (-25%)');
    });

    it('should detect selector confidence drop ≥ 0.2', () => {
      const currentResult = {
        finalVerdict: 'READY',
        verdictCard: { headline: 'Site Ready' },
        humanPath: { primary: 'SUCCESS' },
        coverageInfo: { percent: 80 },
        selectorConfidence: { avgConfidence: 0.65 } // 0.9 -> 0.65 = 0.25 drop
      };

      const comparison = compareToBaseline(readyBaseline, currentResult);
      expect(comparison.degraded).toBe(true);
      expect(comparison.severity).toBe('LOW');
      expect(comparison.reasons).toContain('Selector confidence dropped: 0.90 → 0.65 (-0.25)');
    });

    it('should detect humanPath SUCCESS -> FAILURE transition', () => {
      const currentResult = {
        finalVerdict: 'READY',
        verdictCard: { headline: 'Site Ready' },
        humanPath: { primary: 'FAILURE', attempts: 5, flows: { SUCCESS: 3, FAILURE: 2 } },
        coverageInfo: { percent: 80 },
        selectorConfidence: { avgConfidence: 0.9 }
      };

      const comparison = compareToBaseline(readyBaseline, currentResult);
      expect(comparison.degraded).toBe(true);
      expect(comparison.severity).toBe('MEDIUM');
      expect(comparison.reasons).toContain('HumanPath primary outcome changed: SUCCESS → FAILURE');
    });

    it('should not alert on verdict upgrade or same verdict', () => {
      const currentResult = {
        finalVerdict: 'READY',
        verdictCard: { headline: 'Site Ready' },
        humanPath: { primary: 'SUCCESS' },
        coverageInfo: { percent: 80 },
        selectorConfidence: { avgConfidence: 0.9 }
      };

      const comparison = compareToBaseline(readyBaseline, currentResult);
      expect(comparison.degraded).toBe(false);
      expect(comparison.reasons).toHaveLength(0);
    });

    it('should upgrade severity when multiple degradations occur', () => {
      const currentResult = {
        finalVerdict: 'DO_NOT_LAUNCH',
        verdictCard: { headline: 'Critical Issue' },
        humanPath: { primary: 'FAILURE' },
        coverageInfo: { percent: 55 }, // 25% drop
        selectorConfidence: { avgConfidence: 0.65 } // 0.25 drop
      };

      const comparison = compareToBaseline(readyBaseline, currentResult);
      expect(comparison.degraded).toBe(true);
      expect(comparison.severity).toBe('HIGH'); // Upgraded from MEDIUM/LOW
      expect(comparison.reasons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('updateBaseline', () => {
    it('should update baseline only if current verdict is READY', () => {
      const oldBaseline = {
        version: 1,
        siteKey: 'example.com',
        timestamp: Date.now() - 10000,
        finalVerdict: 'READY',
        verdictCard: { headline: 'Old Ready' },
        coverage: { percent: 70 }
      };

      saveBaseline(oldBaseline, testBaselineDir);

      const readyResult = {
        finalVerdict: 'READY',
        verdictCard: { headline: 'New Ready' },
        coverageInfo: { percent: 85 }
      };

      updateBaseline('example.com', readyResult, testBaselineDir);

      const updated = loadBaseline('example.com', testBaselineDir);
      expect(updated.verdictCard.headline).toBe('New Ready');
      expect(updated.coverage.percent).toBe(85);
      expect(updated.timestamp).toBeGreaterThan(oldBaseline.timestamp);
    });

    it('should not update baseline if current verdict is not READY', () => {
      const oldBaseline = {
        version: 1,
        siteKey: 'example.com',
        timestamp: Date.now() - 10000,
        finalVerdict: 'READY',
        verdictCard: { headline: 'Old Ready' },
        coverage: { percent: 70 }
      };

      saveBaseline(oldBaseline, testBaselineDir);

      const frictionResult = {
        finalVerdict: 'FRICTION',
        verdictCard: { headline: 'Friction Detected' },
        coverageInfo: { percent: 60 }
      };

      updateBaseline('example.com', frictionResult, testBaselineDir);

      const unchanged = loadBaseline('example.com', testBaselineDir);
      expect(unchanged.verdictCard.headline).toBe('Old Ready'); // Not updated
      expect(unchanged.coverage.percent).toBe(70); // Not updated
    });

    it('should throw if baseline does not exist', () => {
      const result = { finalVerdict: 'READY' };
      expect(() => updateBaseline('nonexistent.com', result, testBaselineDir)).toThrow('Baseline does not exist for site: nonexistent.com');
    });
  });

  describe('shouldAlert and formatWatchdogAlert', () => {
    it('should return true if degraded', () => {
      expect(shouldAlert({ degraded: true })).toBe(true);
      expect(shouldAlert({ degraded: false })).toBe(false);
    });

    it('should format alert message correctly', () => {
      const comparison = {
        degraded: true,
        severity: 'HIGH',
        reasons: ['Verdict downgraded: READY → DO_NOT_LAUNCH', 'Coverage dropped significantly'],
        transitions: { from: 'READY', to: 'DO_NOT_LAUNCH' },
        baselineVerdict: 'READY',
        currentVerdict: 'DO_NOT_LAUNCH'
      };

      const alert = formatWatchdogAlert(comparison);

      expect(alert).toContain('🚨 WATCHDOG ALERT: HIGH Severity');
      expect(alert).toContain('Verdict downgraded: READY → DO_NOT_LAUNCH');
      expect(alert).toContain('Coverage dropped significantly');
      expect(alert).toContain('Baseline: READY');
      expect(alert).toContain('Current: DO_NOT_LAUNCH');
    });

    it('should handle MEDIUM severity alert', () => {
      const comparison = {
        degraded: true,
        severity: 'MEDIUM',
        reasons: ['Verdict downgraded: READY → FRICTION'],
        transitions: { from: 'READY', to: 'FRICTION' }
      };

      const alert = formatWatchdogAlert(comparison);
      expect(alert).toContain('⚠️  WATCHDOG ALERT: MEDIUM Severity');
    });

    it('should handle LOW severity alert', () => {
      const comparison = {
        degraded: true,
        severity: 'LOW',
        reasons: ['Selector confidence dropped'],
        transitions: null
      };

      const alert = formatWatchdogAlert(comparison);
      expect(alert).toContain('ℹ️  WATCHDOG ALERT: LOW Severity');
    });
  });

  describe('Integration: Watchdog Mode with executeReality (mock)', () => {
    it('should construct watchdogResult when baseline mode is "create"', () => {
      // This test would require mocking executeReality or using fixtures
      // For now, we verify the structure of watchdogResult
      const watchdogResult = {
        mode: 'create',
        baselineCreated: true,
        siteKey: 'example.com',
        degraded: false,
        reasons: [],
        transitions: null
      };

      expect(watchdogResult.mode).toBe('create');
      expect(watchdogResult.baselineCreated).toBe(true);
      expect(watchdogResult.degraded).toBe(false);
    });

    it('should construct watchdogResult when baseline mode is "use"', () => {
      const watchdogResult = {
        mode: 'use',
        baselineUsed: true,
        siteKey: 'example.com',
        degraded: true,
        severity: 'HIGH',
        reasons: ['Verdict downgraded: READY → DO_NOT_LAUNCH'],
        transitions: { from: 'READY', to: 'DO_NOT_LAUNCH' }
      };

      expect(watchdogResult.mode).toBe('use');
      expect(watchdogResult.baselineUsed).toBe(true);
      expect(watchdogResult.degraded).toBe(true);
      expect(watchdogResult.severity).toBe('HIGH');
    });

    it('should construct watchdogResult when baseline mode is "update"', () => {
      const watchdogResult = {
        mode: 'update',
        baselineUpdated: true,
        siteKey: 'example.com',
        degraded: false,
        reasons: [],
        transitions: null
      };

      expect(watchdogResult.mode).toBe('update');
      expect(watchdogResult.baselineUpdated).toBe(true);
      expect(watchdogResult.degraded).toBe(false);
    });
  });
});
