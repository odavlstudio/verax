import { getTimeProvider } from '../support/time-provider.js';
import { computeDigest } from '../evidence/digest-engine.js';
import { getRedactionCounters } from '../evidence/redact.js';

/**
 * Test Mode Stub Generator
 * 
 * Generates deterministic stub data for observation phase when running in test mode.
 * This allows integration tests to run without actual browser execution.
 * 
 * @param {Array} expectations - Array of expectations to stub
 * @param {string} url - Target URL
 * @returns {Object} Complete observation result with stub data
 */
export function createTestModeStub(expectations, url) {
  const observations = (expectations || []).map((exp, idx) => ({
    id: exp.id,
    expectationId: exp.id,
    type: exp.type,
    category: exp.category,
    promise: exp.promise,
    source: exp.source,
    attempted: true,
    observed: false,
    reason: 'test-mode-skip',
    observedAt: getTimeProvider().iso(),
    evidenceFiles: [],
    signals: {},
    action: null,
    cause: null,
    index: idx + 1,
  }));

  // Simulate retries and stability tracking based on test pattern
  const testPattern = process.env.VERAX_TEST_OBS_PATTERN || '';
  
  const stability = {
    retries: {
      attempted: 0,
      succeeded: 0,
      exhausted: 0,
    },
    incompleteReasons: [],
    incompleteInteractions: 0,
    flakeSignals: {
      sensorMissing: 0,
    }
  };
  
  let status = 'SUCCESS';
  
  // Apply test patterns
  if (testPattern === 'transient-pass') {
    stability.retries.attempted = 1;
    stability.retries.succeeded = 1;
    stability.retries.exhausted = 0;
  } else if (testPattern === 'transient-fail') {
    stability.retries.attempted = 1;
    stability.retries.succeeded = 0;
    stability.retries.exhausted = 1;
    status = 'INCOMPLETE';
    stability.incompleteReasons.push('error:transient-net');
  } else if (testPattern === 'sensor-fail') {
    status = 'INCOMPLETE';
    stability.flakeSignals.sensorMissing = 1;
    stability.incompleteInteractions = observations.length;
    stability.incompleteReasons.push('error:sensor-failure');
  }

  // Forced timeout path used by contract tests to simulate incomplete runs even in test mode
  if (process.env.VERAX_TEST_FORCE_TIMEOUT === '1') {
    status = 'INCOMPLETE';
    if (!stability.incompleteReasons.includes('observe:timeout')) {
      stability.incompleteReasons.push('observe:timeout');
    }
  }

  const digest = computeDigest(expectations || [], observations, {
    framework: 'unknown',
    url,
    version: '1.0',
  });

  const totalExpectations = expectations?.length || 0;
  const completed = observations.filter(o => o.observed).length;
  const attempted = observations.filter(o => o.attempted).length;

  return {
    observations,
    networkFirewall: {
      enabled: false,
      blockedCount: 0,
      blockedMethods: { POST: 0, PUT: 0, PATCH: 0, DELETE: 0 },
      sampleBlocked: [],
    },
    stats: {
      totalExpectations,
      attempted,
      observed: 0,
      completed,
      notObserved: attempted,
      skipped: 0,
      skippedReasons: {},
      blockedWrites: 0,
      coverageRatio: totalExpectations > 0 ? (attempted / totalExpectations) : 1.0,
    },
    status,
    stability,
    blockedWrites: [],
    digest,
    redaction: getRedactionCounters({ headersRedacted: 0, tokensRedacted: 0 }),
    observedAt: getTimeProvider().iso(),
  };
}
