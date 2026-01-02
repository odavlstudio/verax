/**
 * Report Unification Test
 * 
 * Stage 3 regression test: Ensure all reports (JSON, HTML) are consistent with canonical truth.
 * Tests:
 * 1. decision.json finalVerdict matches canonical.finalVerdict
 * 2. snapshot.json verdict.verdict matches canonical.finalVerdict
 * 3. market-report.json canonical object is included and matches verdict
 * 4. report.html renders canonical verdict text
 * 5. market-report.html renders canonical verdict with proper emoji
 * 6. Coverage metrics are consistent across all reports
 * 7. Evidence completeness is included in all JSON artifacts
 * 8. Failure counts only include executed failures, not untested
 * 
 * Test Fixture: example.com with 1 executed test, 3 untested
 * Expected Outcome: FRICTION verdict with 25% coverage, confidence=1, 0 failures
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

describe('Stage 3: Report Unification Lock', () => {
  let artifacts;
  let decision;
  let snapshot;
  let marketReport;
  let reportHtml;
  let marketReportHtml;
  
  before(() => {
    // Find latest .tmp-report-unify artifacts
    const baseDir = path.join(__dirname, '..', '.tmp-report-unify');
    if (!fs.existsSync(baseDir)) {
      console.warn('⚠️  Skipping report unification tests - no artifacts found');
      console.warn('   Run: node bin/guardian.js reality --url https://example.com --artifacts .tmp-report-unify');
      this.skip();
    }
    
    const dirs = fs.readdirSync(baseDir).filter(f => {
      const fullPath = path.join(baseDir, f);
      return fs.statSync(fullPath).isDirectory();
    });
    
    if (dirs.length === 0) {
      this.skip();
    }
    
    // Sort by modification time and get latest
    const latest = dirs.sort((a, b) => {
      const timeA = fs.statSync(path.join(baseDir, a)).mtimeMs;
      const timeB = fs.statSync(path.join(baseDir, b)).mtimeMs;
      return timeB - timeA;
    })[0];
    
    artifacts = path.join(baseDir, latest);
    
    // Load artifacts
    const decisionPath = path.join(artifacts, 'decision.json');
    const snapshotPath = path.join(artifacts, 'snapshot.json');
    const marketPath = path.join(artifacts, 'market-report.json');
    const reportPath = path.join(artifacts, 'report.html');
    const marketHtmlPath = path.join(artifacts, 'market-report.html');
    
    try {
      decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
    } catch (e) {
      console.error(`Failed to load decision.json: ${e.message}`);
    }
    
    try {
      snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    } catch (e) {
      console.error(`Failed to load snapshot.json: ${e.message}`);
    }
    
    try {
      marketReport = JSON.parse(fs.readFileSync(marketPath, 'utf8'));
    } catch (e) {
      console.error(`Failed to load market-report.json: ${e.message}`);
    }
    
    try {
      reportHtml = fs.readFileSync(reportPath, 'utf8');
    } catch (e) {
      console.error(`Failed to load report.html: ${e.message}`);
    }
    
    try {
      marketReportHtml = fs.readFileSync(marketHtmlPath, 'utf8');
    } catch (e) {
      console.error(`Failed to load market-report.html: ${e.message}`);
    }
  });
  
  describe('Verdict Consistency', () => {
    it('decision.json has finalVerdict', () => {
      assert(decision, 'decision.json loaded');
      assert(decision.finalVerdict, 'decision.finalVerdict exists');
    });
    
    it('snapshot.json has verdict.verdict', () => {
      assert(snapshot, 'snapshot.json loaded');
      assert(snapshot.verdict, 'snapshot.verdict exists');
      assert(snapshot.verdict.verdict, 'snapshot.verdict.verdict exists');
    });
    
    it('market-report.json has canonical.finalVerdict', () => {
      assert(marketReport, 'market-report.json loaded');
      assert(marketReport.canonical, 'market-report.canonical exists');
      assert(marketReport.canonical.finalVerdict, 'market-report.canonical.finalVerdict exists');
    });
    
    it('decision verdict matches market-report canonical verdict', () => {
      assert.strictEqual(
        decision.finalVerdict,
        marketReport.canonical.finalVerdict,
        `verdict mismatch: decision=${decision.finalVerdict} != market=${marketReport.canonical.finalVerdict}`
      );
    });
    
    it('snapshot verdict matches decision verdict', () => {
      assert.strictEqual(
        snapshot.verdict.verdict,
        decision.finalVerdict,
        `verdict mismatch: snapshot=${snapshot.verdict.verdict} != decision=${decision.finalVerdict}`
      );
    });
    
    it('all three artifacts agree on verdict', () => {
      const verdicts = [
        decision.finalVerdict,
        snapshot.verdict.verdict,
        marketReport.canonical.finalVerdict
      ];
      const allSame = verdicts.every(v => v === verdicts[0]);
      assert(allSame, `verdicts not unified: ${verdicts.join(' vs ')}`);
    });
  });
  
  describe('Canonical Object Completeness', () => {
    it('canonical has coveragePercent', () => {
      assert(
        marketReport.canonical.coveragePercent !== undefined,
        'canonical.coveragePercent exists'
      );
    });
    
    it('canonical has confidenceScore', () => {
      assert(
        marketReport.canonical.confidenceScore !== undefined,
        'canonical.confidenceScore exists'
      );
    });
    
    it('canonical has evidenceCompleteness', () => {
      assert(
        marketReport.canonical.evidenceCompleteness !== undefined,
        'canonical.evidenceCompleteness exists'
      );
    });
    
    it('canonical has attemptSummary', () => {
      assert(
        marketReport.canonical.attemptSummary,
        'canonical.attemptSummary exists'
      );
    });
  });
  
  describe('Coverage Metrics Consistency', () => {
    it('market-report.summary.coveragePercent matches canonical', () => {
      assert.strictEqual(
        marketReport.summary.coveragePercent,
        marketReport.canonical.coveragePercent,
        'summary and canonical coverage should match'
      );
    });
    
    it('market-report.summary.confidenceScore matches canonical', () => {
      assert.strictEqual(
        marketReport.summary.confidenceScore,
        marketReport.canonical.confidenceScore,
        'summary and canonical confidence should match'
      );
    });
    
    it('snapshot confidence matches market-report confidence', () => {
      assert.strictEqual(
        snapshot.verdict.confidence?.score,
        marketReport.canonical.confidenceScore,
        'snapshot and market confidence should match'
      );
    });
  });
  
  describe('Failure Count Correctness', () => {
    it('summary.failureCount only counts FAILURE outcome', () => {
      const executedFailures = marketReport.results.filter(r => r.outcome === 'FAILURE').length;
      assert.strictEqual(
        marketReport.summary.failureCount,
        executedFailures,
        'failureCount should only include FAILURE outcome, not untested/skipped'
      );
    });
    
    it('untested count does not include executed failures', () => {
      const attemptCounts = marketReport.canonical.attemptSummary;
      const untestedCount = (attemptCounts.skipped || 0) + (attemptCounts.notApplicable || 0);
      assert(
        untestedCount > 0,
        'test fixture should have untested attempts'
      );
      // Verify failureCount is separate from untestedCount
      assert(
        marketReport.summary.failureCount === 0 || untestedCount === 0 || 
        (marketReport.summary.failureCount + untestedCount <= attemptCounts.total),
        'failures and untested should not double-count'
      );
    });
  });
  
  describe('HTML Report Rendering', () => {
    it('report.html contains verdict text', () => {
      assert(
        reportHtml && reportHtml.length > 0,
        'report.html exists and is not empty'
      );
      assert(
        reportHtml.includes(decision.finalVerdict),
        `report.html should contain verdict "${decision.finalVerdict}"`
      );
    });
    
    it('report.html contains coverage metric', () => {
      assert(
        reportHtml.includes('Coverage') || reportHtml.includes('coverage'),
        'report.html should display coverage metric'
      );
    });
    
    it('market-report.html contains verdict', () => {
      assert(
        marketReportHtml && marketReportHtml.length > 0,
        'market-report.html exists and is not empty'
      );
      assert(
        marketReportHtml.includes(decision.finalVerdict) || 
        marketReportHtml.includes(decision.finalVerdict.toLowerCase()),
        `market-report.html should contain verdict "${decision.finalVerdict}"`
      );
    });
    
    it('market-report.html uses canonical verdict emoji correctly', () => {
      // READY → 🟢, FRICTION → 🟡, FAILURE/DO_NOT_LAUNCH → 🔴
      const verdict = decision.finalVerdict;
      let expectedEmoji;
      if (verdict === 'READY' || verdict === 'SUCCESS') {
        expectedEmoji = '🟢';
      } else if (verdict === 'FRICTION') {
        expectedEmoji = '🟡';
      } else {
        expectedEmoji = '🔴';
      }
      
      if (expectedEmoji) {
        assert(
          marketReportHtml.includes(expectedEmoji),
          `market-report.html should contain emoji ${expectedEmoji} for ${verdict} verdict`
        );
      }
    });
  });
  
  describe('Decision Artifact Correctness', () => {
    it('decision.exitCode matches verdict (1 for FRICTION/FAILURE, 0 for SUCCESS)', () => {
      const expectedExitCode = 
        decision.finalVerdict === 'READY' || decision.finalVerdict === 'SUCCESS' ? 0 : 1;
      assert.strictEqual(
        decision.exitCode,
        expectedExitCode,
        `exit code should be ${expectedExitCode} for ${decision.finalVerdict} verdict`
      );
    });
    
    it('decision.reasons are included', () => {
      assert(
        Array.isArray(decision.reasons) && decision.reasons.length > 0,
        'decision.reasons should be a non-empty array'
      );
    });
  });
  
  describe('Test Fixture Validation (example.com)', () => {
    it('test fixture has at least 1 executed attempt', () => {
      const executedCount = marketReport.results.filter(r => 
        ['SUCCESS', 'FAILURE', 'FRICTION'].includes(r.outcome)
      ).length;
      assert(executedCount > 0, 'fixture should have executed attempts');
    });
    
    it('test fixture has untested attempts', () => {
      const untestedCount = marketReport.results.filter(r => 
        ['SKIPPED', 'NOT_APPLICABLE', 'UNTESTED'].includes(r.outcome)
      ).length;
      assert(untestedCount > 0, 'fixture should have untested attempts');
    });
    
    it('coverage is less than 100% (due to untested)', () => {
      assert(
        marketReport.canonical.coveragePercent < 100,
        'coverage should be partial due to untested attempts'
      );
    });
  });
});
