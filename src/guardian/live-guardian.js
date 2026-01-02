/**
 * Live Guardian Scheduler
 * Continuously runs guardian reality on schedule, compares outcomes, and alerts
 */

const { LiveState } = require('./live-state');
const {
  extractHumanOutcomes,
  compareHumanOutcomes,
  shouldAlert,
  formatComparisonForAlert
} = require('./live-baseline-compare');
const { createAlert, saveAlert, printAlert } = require('./live-alert');
const { loadSnapshot } = require('./snapshot');
const path = require('path');
const { resolveArtifactsDir } = require('./runtime-root');

let globalIntervalId = null;
let isRunning = false;

class LiveGuardian {
  constructor(baseUrl, outputDir = null) {
    this.baseUrl = baseUrl;
    // Resolve output directory to runtime root
    this.outputDir = resolveArtifactsDir(outputDir);
    this.liveState = new LiveState(path.join(this.outputDir, 'live-state.json'));
  }

  start(intervalMinutes, executeRealityFn) {
    if (this.liveState.getState().running) {
      console.log('❌ Live Guardian already running');
      return;
    }

    console.log(`🚀 Starting Live Guardian`);
    console.log(`   Base URL: ${this.baseUrl}`);
    console.log(`   Interval: ${intervalMinutes} minute(s)`);

    this.liveState.start(intervalMinutes);

    // Immediately run the first cycle
    this._executeCycle(executeRealityFn);

    // Schedule subsequent cycles
    globalIntervalId = setInterval(() => {
      if (this.liveState.isTimeForRun()) {
        this._executeCycle(executeRealityFn);
      }
    }, 10 * 1000); // Check every 10 seconds if it's time to run

    console.log('✅ Live Guardian started');
  }

  stop() {
    if (!this.liveState.getState().running) {
      console.log('❌ Live Guardian not running');
      return;
    }

    if (globalIntervalId) {
      clearInterval(globalIntervalId);
      globalIntervalId = null;
    }

    this.liveState.stop();
    console.log('✅ Live Guardian stopped');
  }

  status() {
    const status = this.liveState.getStatus();
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Live Guardian Status');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Running:       ${status.running ? '✅ YES' : '❌ NO'}`);
    console.log(`Interval:      ${status.intervalMinutes ? `${status.intervalMinutes} minute(s)` : 'N/A'}`);
    console.log(`Last Run:      ${status.lastRunTime || 'Never'}`);
    console.log(`Next Run:      ${status.nextRunTime || 'N/A'}`);
    console.log(`Last Run ID:   ${status.lastRunId || 'N/A'}`);
    console.log(`Baseline ID:   ${status.baselineRunId || 'Not set'}`);
    if (status.lastAlert) {
      console.log(`Last Alert:    ${status.lastAlert.severity} at ${status.lastAlert.timestamp}`);
    } else {
      console.log(`Last Alert:    None`);
    }
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  }

  async _executeCycle(executeRealityFn) {
    if (isRunning) {
      console.log('⏭️  Skipping cycle (previous run still in progress)');
      return;
    }

    isRunning = true;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const cycleId = `live_${timestamp}`;

      console.log(`\n⏱️  [${new Date().toISOString()}] Starting cycle: ${cycleId}`);

      // Execute reality
      let result;
      try {
        result = await executeRealityFn({
          baseUrl: this.baseUrl,
          outputDir: this.outputDir,
          cycleId
        });
      } catch (execErr) {
        console.error(`❌ Reality execution threw error: ${execErr.message}`);
        isRunning = false;
        return;
      }

      if (!result || !result.runDir) {
        console.log('❌ Reality execution failed');
        isRunning = false;
        return;
      }

      const runId = path.basename(result.runDir);
      this.liveState.updateLastRun(runId);

      console.log(`✅ Cycle completed: ${runId}`);

      // Load current snapshot
      const snapshotPath = path.join(result.runDir, 'snapshot.json');
      const currentSnapshot = loadSnapshot(snapshotPath);

      if (!currentSnapshot) {
        console.log('⚠️  Could not load current snapshot');
        isRunning = false;
        return;
      }

      // Extract human outcomes
      const currentOutcomes = extractHumanOutcomes(currentSnapshot);

      // Check if baseline exists
      const baselineRunId = this.liveState.getState().baselineRunId;

      if (!baselineRunId) {
        // First run: set as baseline
        console.log('📍 Setting as baseline (first live run)');
        this.liveState.setBaseline(runId);
        console.log(`✅ Baseline set: ${runId}`);
        isRunning = false;
        return;
      }

      // Load baseline snapshot
      const baselineRunDir = path.join(this.outputDir, baselineRunId);
      const baselineSnapshotPath = path.join(baselineRunDir, 'snapshot.json');
      const baselineSnapshot = loadSnapshot(baselineSnapshotPath);

      if (!baselineSnapshot) {
        console.log('⚠️  Could not load baseline snapshot; resetting baseline');
        this.liveState.setBaseline(runId);
        isRunning = false;
        return;
      }

      const baselineOutcomes = extractHumanOutcomes(baselineSnapshot);

      // Compare outcomes
      const comparison = compareHumanOutcomes(baselineOutcomes, currentOutcomes);

      if (comparison.hasRegressions) {
        console.log('🔴 Regressions detected!');

        // Format alert
        const alertInfo = formatComparisonForAlert(comparison);

        if (shouldAlert(comparison)) {
          const alert = createAlert({
            runId,
            baselineRunId,
            severity: alertInfo.severity,
            message: alertInfo.message,
            diffs: alertInfo.details,
            baselineVerdict: baselineOutcomes.verdict,
            currentVerdict: currentOutcomes.verdict
          });

          // Save and print alert
          saveAlert(alert, result.runDir);
          printAlert(alert);

          // Record in state
          this.liveState.recordAlert({
            severity: alert.severity,
            runId: alert.runId,
            timestamp: alert.timestamp
          });
        }
      } else {
        console.log('✅ No regressions detected');
      }
    } catch (err) {
      console.error('❌ Cycle error:', err.message);
    } finally {
      isRunning = false;
    }
  }
}

module.exports = { LiveGuardian };
