/**
 * Live Guardian Alert System
 * Generates and persists alerts for human-impacting regressions
 */

const fs = require('fs');
const path = require('path');

function createAlert({
  runId,
  baselineRunId,
  severity,
  message,
  diffs,
  baselineVerdict,
  currentVerdict
}) {
  return {
    timestamp: new Date().toISOString(),
    runId,
    baselineRunId,
    severity,
    message,
    diffs,
    verdictChange: baselineVerdict ? `${baselineVerdict} → ${currentVerdict}` : null
  };
}

function saveAlert(alert, runDir) {
  const alertPath = path.join(runDir, 'live-alert.json');
  fs.writeFileSync(alertPath, JSON.stringify(alert, null, 2));
  return alertPath;
}

function printAlert(alert) {
  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('🚨 LIVE GUARDIAN ALERT');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Timestamp: ${alert.timestamp}`);
  console.log(`Severity:  ${alert.severity}`);
  console.log('');
  console.log(alert.message);
  console.log('');
  if (alert.verdictChange) {
    console.log(`Verdict Change: ${alert.verdictChange}`);
  }
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
}

module.exports = {
  createAlert,
  saveAlert,
  printAlert
};
