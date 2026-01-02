/**
 * Baseline Storage Management
 * Handles persistent baseline storage with URL-safe paths and atomic writes
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_STORAGE_DIR = '.odavl-guardian';

/**
 * Convert URL to safe filename slug
 * Example: https://example.com → example-com-<hash>
 */
function urlToSlug(url) {
  try {
    const parsed = new URL(url);
    let slug = `${parsed.hostname || 'unknown'}`;

    // Add port if non-standard
    if (parsed.port && !['80', '443'].includes(parsed.port)) {
      slug += `-${parsed.port}`;
    }

    // Add path if present (sanitized)
    if (parsed.pathname && parsed.pathname !== '/') {
      const pathSegment = parsed.pathname
        .replace(/\//g, '-')
        .replace(/[^a-z0-9\-]/gi, '')
        .substring(0, 30);
      if (pathSegment) slug += `-${pathSegment}`;
    }

    // Add hash of full URL for collision safety
    const hash = crypto
      .createHash('sha256')
      .update(url)
      .digest('hex')
      .substring(0, 8);

    slug += `-${hash}`;
    return slug;
  } catch (_err) {
    // Fallback: just use hash
    return crypto
      .createHash('sha256')
      .update(url)
      .digest('hex')
      .substring(0, 16);
  }
}

/**
 * Get baseline storage directory for a URL
 */
function getBaselineStorageDir(url, storageDir = DEFAULT_STORAGE_DIR) {
  const slug = urlToSlug(url);
  return path.join(storageDir, 'baselines', slug);
}

/**
 * Get baseline file path for a URL
 */
function getBaselineFilePath(url, storageDir = DEFAULT_STORAGE_DIR) {
  return path.join(getBaselineStorageDir(url, storageDir), 'baseline.json');
}

/**
 * Check if baseline exists for URL
 */
function baselineExists(url, storageDir = DEFAULT_STORAGE_DIR) {
  const filePath = getBaselineFilePath(url, storageDir);
  return fs.existsSync(filePath);
}

/**
 * Load baseline for URL
 */
function loadBaseline(url, storageDir = DEFAULT_STORAGE_DIR) {
  const filePath = getBaselineFilePath(url, storageDir);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const json = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(json);
  } catch (err) {
    throw new Error(`Failed to load baseline from ${filePath}: ${err.message}`);
  }
}

/**
 * Save baseline for URL
 * Uses atomic write: temp file + rename
 */
async function saveBaselineAtomic(url, baselineSnapshot, storageDir = DEFAULT_STORAGE_DIR) {
  const filePath = getBaselineFilePath(url, storageDir);
  const dir = path.dirname(filePath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${filePath}.tmp`;
  const json = typeof baselineSnapshot === 'string'
    ? baselineSnapshot
    : JSON.stringify(baselineSnapshot, null, 2);

  return new Promise((resolve, reject) => {
    fs.writeFile(tempPath, json, 'utf8', (err) => {
      if (err) return reject(err);

      fs.rename(tempPath, filePath, (err) => {
        if (err) return reject(err);
        resolve(filePath);
      });
    });
  });
}

/**
 * Create a baseline snapshot from a market reality snapshot
 */
function createBaselineFromSnapshot(snapshot) {
  if (!snapshot || !snapshot.attempts) {
    throw new Error('Cannot create baseline from invalid snapshot');
  }

  // Extract key data for baseline comparison
  const perAttempt = {};
  for (const attempt of snapshot.attempts) {
    perAttempt[attempt.attemptId] = {
      attemptId: attempt.attemptId,
      attemptName: attempt.attemptName,
      outcome: attempt.outcome,
      totalDurationMs: attempt.totalDurationMs,
      stepCount: attempt.stepCount,
      friction: attempt.friction
    };
  }

  const perFlow = {};
  for (const flow of snapshot.flows || []) {
    perFlow[flow.flowId] = {
      flowId: flow.flowId,
      flowName: flow.flowName,
      outcome: flow.outcome,
      stepsExecuted: flow.stepsExecuted,
      stepsTotal: flow.stepsTotal,
      durationMs: flow.durationMs || 0,
      error: flow.error || null
    };
  }

  return {
    schemaVersion: 'v1',
    createdAt: new Date().toISOString(),
    url: snapshot.meta.url,
    toolVersion: snapshot.meta.toolVersion,
    perAttempt,
    perFlow,
    crawl: snapshot.crawl,
    signals: snapshot.signals
  };
}

/**
 * Compare current snapshot against baseline
 * Returns: { regressions, improvements, attemptsDriftCount }
 */
function compareSnapshots(baselineSnapshot, currentSnapshot) {
  const regressions = {};
  const improvements = {};
  let attemptsDriftCount = 0;

  if (!baselineSnapshot || !baselineSnapshot.perAttempt) {
    return { regressions: {}, improvements: {}, attemptsDriftCount: 0 };
  }

  for (const attempt of currentSnapshot.attempts) {
    const attemptId = attempt.attemptId;
    const baselineAttempt = baselineSnapshot.perAttempt[attemptId];

    if (!baselineAttempt) {
      // New attempt added to registry, not a regression
      continue;
    }

    // Check outcome change
    if (baselineAttempt.outcome !== attempt.outcome) {
      attemptsDriftCount++;

      if (
        (baselineAttempt.outcome === 'SUCCESS' || baselineAttempt.outcome === 'FRICTION') &&
        attempt.outcome === 'FAILURE'
      ) {
        regressions[attemptId] = {
          before: baselineAttempt.outcome,
          after: attempt.outcome,
          reason: `Outcome regressed from ${baselineAttempt.outcome} to FAILURE`
        };
      } else if (
        baselineAttempt.outcome === 'FAILURE' &&
        (attempt.outcome === 'SUCCESS' || attempt.outcome === 'FRICTION')
      ) {
        improvements[attemptId] = {
          before: baselineAttempt.outcome,
          after: attempt.outcome,
          reason: `Outcome improved from FAILURE to ${attempt.outcome}`
        };
      }
    }

    // Check duration increase (>20%)
    const baseDuration = baselineAttempt.totalDurationMs || 0;
    const currentDuration = attempt.totalDurationMs || 0;

    if (baseDuration > 0) {
      const pctChange = ((currentDuration - baseDuration) / baseDuration) * 100;
      if (pctChange >= 20) {
        if (regressions[attemptId]) {
          regressions[attemptId].reason += `; duration increased by ${Math.round(pctChange)}%`;
        } else {
          regressions[attemptId] = {
            before: baselineAttempt,
            after: attempt,
            reason: `Duration increased by ${Math.round(pctChange)}% (${baseDuration}ms → ${currentDuration}ms)`
          };
        }
      }
    }
  }

  // Compare flows
  if (baselineSnapshot.perFlow) {
    for (const flow of currentSnapshot.flows || []) {
      const flowId = flow.flowId;
      const baselineFlow = baselineSnapshot.perFlow[flowId];

      if (!baselineFlow) {
        continue;
      }

      if (baselineFlow.outcome !== flow.outcome) {
        attemptsDriftCount++;

        if (baselineFlow.outcome === 'SUCCESS' && flow.outcome === 'FAILURE') {
          regressions[flowId] = {
            before: baselineFlow.outcome,
            after: flow.outcome,
            reason: `Flow outcome regressed from ${baselineFlow.outcome} to FAILURE`
          };
        } else if (baselineFlow.outcome === 'FAILURE' && flow.outcome === 'SUCCESS') {
          improvements[flowId] = {
            before: baselineFlow.outcome,
            after: flow.outcome,
            reason: 'Flow outcome improved from FAILURE to SUCCESS'
          };
        }
      }
    }
  }

  return {
    regressions,
    improvements,
    attemptsDriftCount
  };
}

module.exports = {
  DEFAULT_STORAGE_DIR,
  urlToSlug,
  getBaselineStorageDir,
  getBaselineFilePath,
  baselineExists,
  loadBaseline,
  saveBaselineAtomic,
  createBaselineFromSnapshot,
  compareSnapshots
};
