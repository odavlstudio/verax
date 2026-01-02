/**
 * Live Guardian CLI
 * Periodically run journey scans and compare against baseline.
 */

const fs = require('fs');
const path = require('path');
const { runJourneyScanCLI } = require('./journey-scan-cli');
const { getJourneyDefinition } = require('./journey-definitions');
const { detectIntent } = require('./intent-detector');
const { JourneyScanner } = require('./journey-scanner');
const { buildBaselineFromJourneyResult, compareAgainstBaseline, classifySeverity } = require('./drift-detector');
const { shouldEmitAlert, recordAlert } = require('./alert-ledger');

async function runLiveCLI(config) {
  const { baseUrl, artifactsDir = './.odavlguardian', intervalMinutes = null, headless = true, timeout = 20000, preset, presetProvided = false, cooldownMinutes = 60 } = config;

  // Ensure output directories
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
  const baselinePath = path.join(artifactsDir, 'baseline.json');

  async function singleRunEvaluate() {
    // Auto intent + journey selection if preset not provided
    let finalPreset = preset || 'saas';
    let intentDetection = null;
    if (!presetProvided) {
      intentDetection = await detectIntent(baseUrl, { timeout, headless });
      if (intentDetection.intent === 'saas') finalPreset = 'saas';
      else if (intentDetection.intent === 'shop') finalPreset = 'shop';
      else if (intentDetection.intent === 'landing') finalPreset = 'landing';
      else finalPreset = 'landing';
    }

    const journey = getJourneyDefinition(finalPreset);
    const scanner = new JourneyScanner({ timeout, headless, screenshotDir: path.join(artifactsDir, 'screenshots') });
    const result = await scanner.scan(baseUrl, journey);
    if (intentDetection) result.intentDetection = intentDetection;

    // Baseline capture on first run
    if (!fs.existsSync(baselinePath)) {
      const baseline = buildBaselineFromJourneyResult(result);
      fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), 'utf8');
      console.log('📌 Baseline captured.');
      return { result, baseline, drift: { hasDrift: false, reasons: [] }, exitCode: 0 };
    }

    // Load baseline and compare
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const drift = compareAgainstBaseline(baseline, result);
    const severity = classifySeverity(drift, result);

    // Write report and baseline comparison summary
    const { HumanReporter } = require('./human-reporter');
    result.baseline = baseline;
    result.drift = drift;
    result.severity = severity;
    const reporter = new HumanReporter();
    reporter.generateSummary(result, artifactsDir);
    reporter.generateJSON(result, artifactsDir);

    if (drift.hasDrift) {
      const alertDecision = shouldEmitAlert(drift.reasons, severity, artifactsDir, cooldownMinutes);
      
      if (alertDecision.emit) {
        console.log(`🚨 Guardian detected a behavioral regression (${severity}):`);
        for (const r of drift.reasons) console.log(`– ${r}`);
        recordAlert(alertDecision.signature, severity, artifactsDir);
        return { result, baseline, drift, severity, exitCode: 3 };
      } else {
        console.log(`✅ Drift detected but alert suppressed (${alertDecision.reason})`);
        return { result, baseline, drift, severity, exitCode: 0 };
      }
    }

    console.log('✅ No regression detected.');
    return { result, baseline, drift, severity, exitCode: 0 };
  }

  if (intervalMinutes && intervalMinutes > 0) {
    let running = true;
    const handleSigint = () => { running = false; console.log('\n🛑 Live Guardian stopped.'); return { exitCode: 0, stopped: true }; };
    process.on('SIGINT', handleSigint);
    console.log(`⏱️  Live mode: every ${intervalMinutes} minute(s)`);
    while (running) {
      const { exitCode } = await singleRunEvaluate();
      if (exitCode === 3) return { exitCode: 3, critical: true };
      await new Promise(r => setTimeout(r, intervalMinutes * 60 * 1000));
    }
    return { exitCode: 0, stopped: true };
  } else {
    const { exitCode } = await singleRunEvaluate();
    return { exitCode };
  }
}

module.exports = { runLiveCLI };
