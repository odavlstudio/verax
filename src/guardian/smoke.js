const { AttemptEngine } = require('./attempt-engine');
const { getAttemptDefinition } = require('./attempt-registry');
const { BrowserPool } = require('./browser-pool');
const { checkPrerequisites } = require('./prerequisite-checker');
const { validateParallel, executeParallel } = require('./parallel-executor');
const { getTimeoutProfile } = require('./timeout-profiles');
const { isCiMode } = require('./ci-mode');
const { createCanonicalOutput } = require('./output-contract');

const SMOKE_ATTEMPTS = ['universal_reality', 'login', 'signup', 'contact_form'];
const DEFAULT_PARALLEL = 2;
const DEFAULT_BUDGET_MS = 30000;
const DEFAULT_PREREQ_TIMEOUT = 2000;
const SMOKE_BROWSER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--proxy-bypass-list=*'];

function validateUrl(url) {
  try {
     
    new URL(url);
    return true;
  } catch (_e) {
    return false;
  }
}

function summarizeResults(results) {
  const success = results.filter(r => r.outcome === 'SUCCESS').length;
  const friction = results.filter(r => r.outcome === 'FRICTION').length;
  const failure = results.filter(r => r.outcome === 'FAILURE').length;
  const skipped = results.filter(r => r.outcome === 'SKIPPED').length;
  return { success, friction, failure, skipped };
}

function authPathStatus(results) {
  const authResults = results.filter(r => r.attemptId === 'login' || r.attemptId === 'signup');
  const hasAuthSuccess = authResults.some(r => r.outcome === 'SUCCESS' || r.outcome === 'FRICTION');
  const authFailures = authResults.filter(r => r.outcome === 'FAILURE').length;
  return { hasAuthSuccess, authFailures };
}

function chooseExitCode({ failure, friction }, timedOut, authMissing, authFailuresToIgnore = 0) {
  const effectiveFailures = Math.max(0, failure - authFailuresToIgnore);
  if (timedOut || authMissing || effectiveFailures > 0) return 2;
  if (friction > 0) return 1;
  return 0;
}

async function executeSmoke(config) {
  const baseUrl = config.baseUrl;
  if (!validateUrl(baseUrl)) {
    throw new Error(`Invalid URL: ${baseUrl}`);
  }

  const savedNoProxy = { NO_PROXY: process.env.NO_PROXY, no_proxy: process.env.no_proxy };
  const forcedNoProxy = (process.env.NO_PROXY || process.env.no_proxy)
    ? `${process.env.NO_PROXY || process.env.no_proxy},127.0.0.1,localhost`
    : '127.0.0.1,localhost';
  process.env.NO_PROXY = forcedNoProxy;
  process.env.no_proxy = forcedNoProxy;

  const ciMode = isCiMode();
  const timeoutProfile = getTimeoutProfile('fast');
  const resolvedTimeout = timeoutProfile.default;
  const budgetMs = Number(process.env.GUARDIAN_SMOKE_BUDGET_MS || config.timeBudgetMs || DEFAULT_BUDGET_MS);

  const parallelValidation = validateParallel(DEFAULT_PARALLEL);
  if (!parallelValidation.valid) {
    throw new Error(parallelValidation.error || 'Invalid parallel value');
  }
  const parallel = parallelValidation.parallel || DEFAULT_PARALLEL;

  if (!ciMode) {
    console.log('\nSMOKE MODE: Fast market sanity check (<30s)');
    console.log(`Target: ${baseUrl}`);
    console.log(`Attempts: ${SMOKE_ATTEMPTS.join(', ')}`);
  } else {
    console.log('SMOKE MODE: Fast market sanity check (<30s)');
    console.log(`Target: ${baseUrl}`);
    console.log(`Attempts: ${SMOKE_ATTEMPTS.join(', ')}`);
  }

  const browserPool = new BrowserPool();
  await browserPool.launch({ headless: !config.headful, timeout: resolvedTimeout, args: SMOKE_BROWSER_ARGS });

  const startedAt = Date.now();
  let timedOut = false;
  let shouldStop = false;
  const attemptResults = [];

  const budgetTimer = setTimeout(() => {
    timedOut = true;
    shouldStop = true;
  }, budgetMs);

  const attemptRunner = async (attemptId) => {
    if (timedOut) {
      return null;
    }

    const attemptDef = getAttemptDefinition(attemptId);
    if (!attemptDef) {
      return {
        attemptId,
        attemptName: attemptId,
        outcome: 'FAILURE',
        error: `Attempt ${attemptId} not found`,
        friction: null
      };
    }

    let context = null;
    let page = null;
    let result;

    try {
      const ctx = await browserPool.createContext({
        timeout: resolvedTimeout,
        ignoreHTTPSErrors: true
      });
      context = ctx.context;
      page = ctx.page;
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: resolvedTimeout });
      const prereq = await checkPrerequisites(page, attemptId, DEFAULT_PREREQ_TIMEOUT);
      if (!prereq.canProceed) {
        result = {
          attemptId,
          attemptName: attemptDef.name,
          outcome: 'SKIPPED',
          skipReason: prereq.reason,
          friction: null,
          error: null
        };
      } else {
        const engine = new AttemptEngine({
          attemptId,
          timeout: resolvedTimeout,
          frictionThresholds: {
            totalDurationMs: 5000,
            stepDurationMs: 2500,
            retryCount: 0
          },
          maxStepRetries: 1
        });

        const attemptResult = await engine.executeAttempt(page, attemptId, baseUrl, null, attemptDef.validators || []);
        result = {
          attemptId,
          attemptName: attemptDef.name,
          outcome: attemptResult.outcome,
          friction: attemptResult.friction,
          error: attemptResult.error,
          successReason: attemptResult.successReason,
          skipReason: null
        };
      }
    } catch (err) {
      result = {
        attemptId,
        attemptName: attemptDef?.name || attemptId,
        outcome: 'FAILURE',
        friction: null,
        error: err.message,
        skipReason: null
      };
    } finally {
      if (context) {
        await browserPool.closeContext(context);
      }
    }

    // Enforce fail-fast
    if (result.outcome === 'FAILURE') {
      shouldStop = true;
    }

    // Enforce budget after attempt completes
    if (Date.now() - startedAt >= budgetMs) {
      timedOut = true;
      shouldStop = true;
    }

    return result;
  };

  const parallelResults = await executeParallel(
    SMOKE_ATTEMPTS,
    attemptRunner,
    parallel,
    { shouldStop: () => shouldStop }
  );

  clearTimeout(budgetTimer);
  for (const r of parallelResults) {
    if (r) {
      attemptResults.push(r);
    }
  }

  if (process.env.GUARDIAN_SMOKE_DEBUG) {
    console.log('DEBUG attempt results:', JSON.stringify(attemptResults, null, 2));
  }

  const summary = summarizeResults(attemptResults);
  const authStatus = authPathStatus(attemptResults);
  const effectiveFailures = Math.max(0, summary.failure - (authStatus.hasAuthSuccess ? authStatus.authFailures : 0));
  const exitCode = chooseExitCode({ ...summary, failure: effectiveFailures }, timedOut, !authStatus.hasAuthSuccess, 0);

  const elapsed = Date.now() - startedAt;

  const lines = [];
  lines.push(`Summary: success=${summary.success}, friction=${summary.friction}, failure=${effectiveFailures}, skipped=${summary.skipped}`);
  if (timedOut) {
    lines.push(`Result: FAILURE (time budget exceeded at ${elapsed}ms)`);
  } else if (!authStatus.hasAuthSuccess) {
    lines.push('Result: FAILURE (auth path unreachable)');
  } else if (exitCode === 2) {
    lines.push('Result: FAILURE');
  } else if (exitCode === 1) {
    lines.push('Result: FRICTION');
  } else {
    lines.push('Result: PASS');
  }

  for (const line of lines) {
    console.log(line);
  }

  await browserPool.close();

  // Restore proxy env vars
  if (savedNoProxy.NO_PROXY !== undefined) {
    process.env.NO_PROXY = savedNoProxy.NO_PROXY;
  } else {
    delete process.env.NO_PROXY;
  }
  if (savedNoProxy.no_proxy !== undefined) {
    process.env.no_proxy = savedNoProxy.no_proxy;
  } else {
    delete process.env.no_proxy;
  }

  // Build canonical output
  const canonicalOutput = createCanonicalOutput({
    version: require('../../package.json').version,
    command: 'smoke',
    verdict: exitCode === 0 ? 'READY' : (exitCode === 1 ? 'FRICTION' : 'DO_NOT_LAUNCH'),
    exitCode,
    summary: {
      headline: exitCode === 0 ? 'Smoke test passed' : 'Smoke test failed',
      reasons: attemptResults.filter(a => a.outcome !== 'SUCCESS').map(a => `${a.attemptId}: ${a.outcome}`).slice(0, 5),
      coverage: null
    },
    artifacts: null,
    policyStatus: null,
    meta: {
      runId: `smoke-${Date.now()}`,
      timestamp: new Date().toISOString(),
      baseUrl: attemptResults[0]?.baseUrl || 'unknown',
      durationMs: elapsed
    }
  });

  // Return both canonical and legacy fields
  return {
    ...canonicalOutput,
    // Legacy fields for backward compatibility
    attemptResults,
    timedOut,
    authAvailable: authStatus.hasAuthSuccess,
    elapsed
  };
}

async function runSmokeCLI(config) {
  const result = await executeSmoke(config);
  return result;
}

module.exports = {
  executeSmoke,
  runSmokeCLI,
  SMOKE_ATTEMPTS
};
