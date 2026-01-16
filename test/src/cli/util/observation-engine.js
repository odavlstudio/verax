import { chromium } from 'playwright';
import { writeFileSync as _writeFileSync, mkdirSync as _mkdirSync } from 'fs';
import { resolve as _resolve } from 'path';
import { redactHeaders, redactUrl, redactBody, redactConsole, getRedactionCounters } from './redact.js';
import { InteractionPlanner } from './interaction-planner.js';
import { computeDigest } from './digest-engine.js';

/**
 * PHASE H3/M3 - Real Browser Observation Engine
 * Uses Interaction Planner to execute promises with evidence capture
 * H5: Added read-only safety mode by default
 */

export async function observeExpectations(expectations, url, evidencePath, onProgress, _options = {}) {
  // TEST MODE FAST PATH: In VERAX_TEST_MODE, skip browser work entirely for determinism and speed.
  if (process.env.VERAX_TEST_MODE === '1') {
    const observations = (expectations || []).map((exp, idx) => ({
      id: exp.id,
      expectationId: exp.id,
      type: exp.type,
      category: exp.category,
      promise: exp.promise,
      source: exp.source,
      attempted: false,
      observed: false,
      reason: 'test-mode-skip',
      observedAt: new Date().toISOString(),
      evidenceFiles: [],
      signals: {},
      action: null,
      cause: null,
      index: idx + 1,
    }));

    const digest = computeDigest(expectations || [], observations, {
      framework: 'unknown',
      url,
      version: '1.0',
    });

    return {
      observations,
      stats: {
        attempted: 0,
        observed: 0,
        notObserved: 0,
        blockedWrites: 0,
      },
      blockedWrites: [],
      digest,
      redaction: getRedactionCounters({ headersRedacted: 0, tokensRedacted: 0 }),
      observedAt: new Date().toISOString(),
    };
  }

  const observations = [];
  const redactionCounters = { headersRedacted: 0, tokensRedacted: 0 };
  let browser = null;
  let page = null;
  let planner = null;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
    });

    page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    // Create interaction planner (read-only mode enforced)
    planner = new InteractionPlanner(page, evidencePath, {});

    // Set up network monitoring (H5: with write-blocking)
    const networkRecordingStartTime = Date.now();
    
    // H5: Route handler for blocking mutating requests (MUST be before page.on)
    await page.route('**/*', async (route) => {
      const request = route.request();
      const method = request.method();
      
      if (planner.shouldBlockRequest(method)) {
        const redactedUrl = redactUrl(request.url(), redactionCounters);
        planner.blockedRequests.push({
          url: redactedUrl,
          method: method,
          reason: 'write-blocked-read-only-mode',
          timestamp: new Date().toISOString(),
        });
        await route.abort('blockedbyclient');
        return;
      }
      
      await route.continue();
    });
    
    page.on('request', (request) => {
      const redactedHeaders = redactHeaders(request.headers(), redactionCounters);
      const redactedUrl = redactUrl(request.url(), redactionCounters);
      let redactedBody = null;
      try {
        const body = request.postData();
        redactedBody = body ? redactBody(body, redactionCounters) : null;
      } catch {
        redactedBody = null;
      }

      const event = {
        url: redactedUrl,
        method: request.method(),
        headers: redactedHeaders,
        body: redactedBody,
        timestamp: new Date().toISOString(),
        relativeMs: Date.now() - networkRecordingStartTime,
      };
      
      planner.recordNetworkEvent(event);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        const redactedText = redactConsole(msg.text(), redactionCounters);
        planner.recordConsoleEvent({
          type: msg.type(),
          text: redactedText,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Navigate to base URL
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    } catch (error) {
      if (onProgress) {
        onProgress({
          event: 'observe:warning',
          message: `Failed to load base URL: ${error.message}`,
        });
      }
    }

    // Execute each promise via interaction planner
    for (let i = 0; i < expectations.length; i++) {
      const exp = expectations[i];
      const expNum = i + 1;

      if (onProgress) {
        onProgress({
          event: 'observe:attempt',
          index: expNum,
          total: expectations.length,
          type: exp.type,
          category: exp.category,
          promise: exp.promise,
        });
      }

      // Execute the promise
      const attempt = await planner.executeSinglePromise(exp, expNum);

      // Convert attempt to observation
      const observation = {
        id: exp.id,
        type: exp.type,
        category: exp.category,
        promise: exp.promise,
        source: exp.source,
        attempted: attempt.attempted,
        observed: attempt.signals ? Object.values(attempt.signals).some(v => v === true) : false,
        action: attempt.action,
        reason: attempt.reason,
        observedAt: new Date().toISOString(),
        evidenceFiles: attempt.evidence?.files || [],
        signals: attempt.signals,
      };

      observations.push(observation);

      if (onProgress) {
        onProgress({
          event: 'observe:result',
          index: expNum,
          attempted: observation.attempted,
          observed: observation.observed,
          reason: observation.reason,
        });
      }
    }

    // Count results
    const observed = observations.filter(o => o.observed).length;
    const attempted = observations.filter(o => o.attempted).length;
    const notObserved = attempted - observed;

    // H5: Compute deterministic digest for reproducibility proof
    const digest = computeDigest(expectations, observations, {
      framework: 'unknown', // Will be populated by caller
      url,
      version: '1.0',
    });

    return {
      observations,
      stats: {
        attempted,
        observed,
        notObserved,
        blockedWrites: planner.getBlockedRequests().length, // H5: Include write-blocking stats
      },
      blockedWrites: planner.getBlockedRequests(), // H5: Include details of blocked writes
      digest, // H5: Deterministic digest
      redaction: getRedactionCounters(redactionCounters),
      observedAt: new Date().toISOString(),
    };
    
  } finally {
    // Cleanup
    if (page) {
      try {
        page.removeAllListeners();
        await page.close().catch(() => {});
      } catch (e) {
        if (onProgress) {
          onProgress({
            event: 'observe:warning',
            message: `Page cleanup warning: ${e.message}`,
          });
        }
      }
    }
    
    if (browser) {
      try {
        const contexts = browser.contexts();
        for (const context of contexts) {
          try {
            await context.close().catch(() => {});
          } catch (e) {
            // Ignore
          }
        }
        await browser.close().catch(() => {});
      } catch (e) {
        if (onProgress) {
          onProgress({
            event: 'observe:warning',
            message: `Browser cleanup warning: ${e.message}`,
          });
        }
      }
    }
  }
}

