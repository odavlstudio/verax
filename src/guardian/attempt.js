/**
 * Guardian Attempt Mode
 * Single user attempt execution orchestration
 * Phase 2: Soft failure detection via validators
 * 
 * @typedef {import('./truth/attempt.contract.js').AttemptResult} AttemptResult
 */

const { GuardianBrowser } = require('./browser');
const { AttemptEngine } = require('./attempt-engine');
const { AttemptReporter } = require('./attempt-reporter');
const { getAttemptDefinition } = require('./attempt-registry');
const { toCanonicalVerdict, mapExitCodeFromCanonical } = require('./verdicts');
const GuardianNetworkTrace = require('./network-trace');
const fs = require('fs');
const path = require('path');

/**
 * Programmatic API for executing attempts
 * Returns result object instead of calling process.exit
 * @param {Object} config - Configuration
 * @param {string} config.baseUrl - Base URL to test
 * @param {string} [config.attemptId] - Attempt identifier
 * @param {string} [config.artifactsDir] - Artifacts directory
 * @param {boolean} [config.enableTrace] - Enable network trace
 * @param {boolean} [config.headful] - Run in headful mode
 * @param {boolean} [config.quiet] - Quiet mode
 * @param {number} [config.timeout] - Timeout in milliseconds
 * @returns {Promise<Object>} Result with outcome, exitCode, paths, etc.
 */
async function executeAttempt(config) {
  const {
    baseUrl,
    attemptId = 'contact_form',
    artifactsDir = './artifacts',
    enableTrace = true,
    headful = false,
    quiet = false,
    // Phase 7.3: Accept browser context from pool
    browserContext = null,
    browserPage = null
  } = config;

  const log = (...args) => {
    if (!quiet) console.log(...args);
  };

  // Validate baseUrl
  try {
    new URL(baseUrl);
  } catch (_e) {
    throw new Error(`Invalid URL: ${baseUrl}`);
  }

  const browser = new GuardianBrowser();
  let attemptResult = null;
  let runDir = null;
  const usingPoolContext = browserContext && browserPage;

  try {
    // Prepare artifacts directory
    const now = new Date();
    const dateStr = now.toISOString()
      .replace(/[:\-]/g, '')
      .substring(0, 15)
      .replace('T', '-');
    const runId = `attempt-${dateStr}`;
    runDir = path.join(artifactsDir, runId);

    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }

    log(`\n📁 Artifacts: ${runDir}`);

    // Phase 7.3: Use pool context or launch own browser
    if (usingPoolContext) {
      browser.useContext(browserContext, browserPage, config.timeout || 30000);
      if (!quiet) {
        // Silent - don't log for each attempt in pool mode
      }
    } else {
      // Legacy mode: launch own browser
      log(`\n🚀 Launching browser...`);
      const browserOptions = { 
        headless: !headful,
        args: !headful ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
      };
      await browser.launch(30000, browserOptions);
      log(`✅ Browser launched`);
    }

    // Start trace if enabled
    let tracePath = null;
    if (enableTrace && browser.context) {
      const networkTrace = new GuardianNetworkTrace({ enableTrace: true });
      tracePath = await networkTrace.startTrace(browser.context, runDir);
      if (tracePath) {
        log(`📹 Trace recording started`);
      }
    }

    // Execute attempt
    log(`\n🎬 Executing attempt...`);
    const engine = new AttemptEngine({
      attemptId,
      timeout: config.timeout || 30000,
      frictionThresholds: config.frictionThresholds || {
        totalDurationMs: 2500,
        stepDurationMs: 1500,
        retryCount: 1
      }
    });

    // Get validators from attempt definition (Phase 2)
    const attemptDef = getAttemptDefinition(attemptId);
    const validators = attemptDef?.validators || [];

    attemptResult = await engine.executeAttempt(browser.page, attemptId, baseUrl, runDir, validators);

    log(`\n✅ Attempt completed: ${attemptResult.outcome}`);

    // Stop trace if enabled
    if (enableTrace && browser.context && tracePath) {
      const networkTrace = new GuardianNetworkTrace({ enableTrace: true });
      await networkTrace.stopTrace(browser.context, tracePath);
      log(`✅ Trace saved: trace.zip`);
    }

    // Generate reports
    log(`\n📊 Generating reports...`);
    const reporter = new AttemptReporter();
    const report = reporter.createReport(attemptResult, baseUrl, attemptId);

    // Save JSON report
    const jsonPath = reporter.saveJsonReport(report, runDir);
    log(`✅ JSON report: ${path.basename(jsonPath)}`);

    // Save HTML report
    const htmlContent = reporter.generateHtmlReport(report);
    const htmlPath = reporter.saveHtmlReport(htmlContent, runDir);
    log(`✅ HTML report: ${path.basename(htmlPath)}`);

    // Persist deterministic attempt evidence (attempt.json + steps log)
    const attemptJsonPath = path.join(runDir, 'attempt.json');
    const attemptSnapshot = {
      attemptId,
      baseUrl,
      outcome: attemptResult.outcome,
      startedAt: attemptResult.startedAt,
      endedAt: attemptResult.endedAt,
      totalDurationMs: attemptResult.totalDurationMs,
      friction: attemptResult.friction,
      validators: attemptResult.validators,
      softFailures: attemptResult.softFailures,
      successReason: attemptResult.successReason,
      error: attemptResult.error,
      steps: attemptResult.steps
    };
    fs.writeFileSync(attemptJsonPath, JSON.stringify(attemptSnapshot, null, 2));

    const stepsLogPath = path.join(runDir, 'steps.jsonl');
    const stepsLog = (attemptResult.steps || []).map(s => JSON.stringify(s)).join('\n');
    fs.writeFileSync(stepsLogPath, stepsLog + (stepsLog ? '\n' : ''));

    // Display summary
    log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const outcomeEmoji = attemptResult.outcome === 'SUCCESS' ? '🟢' : 
                          attemptResult.outcome === 'FRICTION' ? '🟡' : '🔴';

    log(`\n${outcomeEmoji} ${attemptResult.outcome}`);

    if (attemptResult.outcome === 'SUCCESS') {
      log(`\n✅ User successfully completed the attempt!`);
      log(`   ${attemptResult.successReason}`);
    } else if (attemptResult.outcome === 'FRICTION') {
      log(`\n⚠️  Attempt succeeded but with friction:`);
      attemptResult.friction.reasons.forEach(reason => {
        log(`   • ${reason}`);
      });
    } else {
      log(`\n❌ Attempt failed:`);
      log(`   ${attemptResult.error}`);
    }

    log(`\n⏱️  Duration: ${attemptResult.totalDurationMs}ms`);
    log(`📋 Steps: ${attemptResult.steps.length}`);

    if (attemptResult.steps.length > 0) {
      const failedSteps = attemptResult.steps.filter(s => s.status === 'failed');
      if (failedSteps.length > 0) {
        log(`❌ Failed steps: ${failedSteps.length}`);
        failedSteps.forEach(step => {
          log(`   • ${step.id}: ${step.error}`);
        });
      }

      const retriedSteps = attemptResult.steps.filter(s => s.retries > 0);
      if (retriedSteps.length > 0) {
        log(`🔄 Steps with retries: ${retriedSteps.length}`);
        retriedSteps.forEach(step => {
          log(`   • ${step.id}: ${step.retries} retries`);
        });
      }
    }

    log(`\n💾 Full report: ${runDir}`);
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Phase 7.3: Close browser only if we own it (not using pool)
    if (!usingPoolContext) {
      try {
        await browser.close();
      } catch (_closeErr) {
        // Ignore browser close errors
      }
    }

    // Determine exit code using canonical authority
    const canonicalVerdict = toCanonicalVerdict(attemptResult.outcome);
    const exitCode = mapExitCodeFromCanonical(canonicalVerdict);

    // Return structured result
    return {
      outcome: attemptResult.outcome,
      exitCode,
      attemptResult,
      artifactsDir: runDir,
      reportJsonPath: path.join(runDir, 'attempt-report.json'),
      reportHtmlPath: path.join(runDir, 'attempt-report.html'),
      attemptJsonPath,
      stepsLogPath,
      tracePath: enableTrace ? path.join(runDir, 'trace.zip') : null,
      steps: attemptResult.steps,
      friction: attemptResult.friction,
      error: attemptResult.error,
      successReason: attemptResult.successReason
    };

  } catch (err) {
    // Phase 7.3: Only close if we own the browser
    if (!usingPoolContext) {
      await browser.close().catch(() => {});
    }
    throw err;
  }
}

/**
 * CLI wrapper for executeAttempt that prints output and calls process.exit
 */
async function runAttemptCLI(config) {
  const {
    baseUrl,
    attemptId = 'contact_form',
    headful = false
  } = config;

  console.log(`\n🛡️  ODAVL Guardian — Single User Attempt (Phase 1)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📍 Target: ${baseUrl}`);
  console.log(`🎯 Attempt: ${attemptId}`);
  console.log(`⚙️  Mode: ${headful ? 'headed' : 'headless'}`);

  try {
    const result = await executeAttempt(config);
    return result;
  } catch (err) {
    throw err;
  }
}

module.exports = { executeAttempt, runAttemptCLI };
