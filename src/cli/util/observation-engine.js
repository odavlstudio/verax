import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { redactHeaders, redactUrl, redactBody, redactConsole, getRedactionCounters } from './redact.js';

/**
 * Real Browser Observation Engine
 * Monitors expectations from learn.json using actual Playwright browser
 */

export async function observeExpectations(expectations, url, evidencePath, onProgress) {
  const observations = [];
  let observed = 0;
  let notObserved = 0;
  const redactionCounters = { headersRedacted: 0, tokensRedacted: 0 };
  let browser = null;
  let page = null;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
    });

    page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    // Set up network and console monitoring
    const networkLogs = [];
    const consoleLogs = [];

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

      networkLogs.push({
        url: redactedUrl,
        method: request.method(),
        headers: redactedHeaders,
        body: redactedBody,
        timestamp: new Date().toISOString(),
      });
    });

    page.on('console', (msg) => {
      const redactedText = redactConsole(msg.text(), redactionCounters);
      consoleLogs.push({
        type: msg.type(),
        text: redactedText,
        timestamp: new Date().toISOString(),
      });
    });

    // Navigate to base URL first with explicit timeout
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', // Use domcontentloaded instead of networkidle for faster timeout
        timeout: 30000 
      });
      // Wait for network idle with separate timeout
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        // Network idle timeout is acceptable, continue
      });
    } catch (error) {
      // Continue even if initial load fails
      if (onProgress) {
        onProgress({
          event: 'observe:warning',
          message: `Failed to load base URL: ${error.message}`,
        });
      }
    }

    // Track visited URLs for navigation observations
    const visitedUrls = new Set([url]);

    // Process each expectation
    for (let i = 0; i < expectations.length; i++) {
      const exp = expectations[i];
      const expNum = i + 1;

      if (onProgress) {
        onProgress({
          event: 'observe:attempt',
          index: expNum,
          total: expectations.length,
          type: exp.type,
          promise: exp.promise,
        });
      }

      const observation = {
        id: exp.id,
        type: exp.type,
        promise: exp.promise,
        source: exp.source,
        attempted: false,
        observed: false,
        observedAt: null,
        evidenceFiles: [],
        reason: null,
      };

      try {
        let result = false;
        let evidence = null;

        if (exp.type === 'navigation') {
          observation.attempted = true; // Mark as attempted
          result = await observeNavigation(
            page,
            exp,
            url,
            visitedUrls,
            evidencePath,
            expNum
          );
          evidence = result ? `nav_${expNum}_after.png` : null;
        } else if (exp.type === 'network') {
          observation.attempted = true; // Mark as attempted
          result = await observeNetwork(page, exp, networkLogs, 5000);
          if (result) {
            const evidenceFile = `network_${expNum}.json`;
            try {
              mkdirSync(evidencePath, { recursive: true });
              const targetUrl = exp.promise.value;
              const relevant = networkLogs.filter((log) =>
                log.url === targetUrl || log.url.includes(targetUrl) || targetUrl.includes(log.url)
              );
              writeFileSync(resolve(evidencePath, evidenceFile), JSON.stringify(relevant, null, 2), 'utf-8');
            } catch {
              // best effort
            }
            evidence = evidenceFile;
          } else {
            evidence = null;
          }
        } else if (exp.type === 'state') {
          observation.attempted = true; // Mark as attempted
          result = await observeState(page, exp, evidencePath, expNum);
          evidence = result ? `state_${expNum}_after.png` : null;
        }

        if (result) {
          observation.observed = true;
          observation.observedAt = new Date().toISOString();
          if (evidence) observation.evidenceFiles.push(evidence);
          observed++;
        } else {
          observation.reason = 'No matching event observed';
          notObserved++;
        }
      } catch (error) {
        observation.reason = `Error: ${error.message}`;
        notObserved++;
      }

      observations.push(observation);

      if (onProgress) {
        onProgress({
          event: 'observe:result',
          index: expNum,
          observed: observation.observed,
          reason: observation.reason,
        });
      }
    }

    // Persist shared evidence
    try {
      mkdirSync(evidencePath, { recursive: true });
      const networkPath = resolve(evidencePath, 'network_logs.json');
      writeFileSync(networkPath, JSON.stringify(networkLogs, null, 2), 'utf-8');
      const consolePath = resolve(evidencePath, 'console_logs.json');
      writeFileSync(consolePath, JSON.stringify(consoleLogs, null, 2), 'utf-8');
    } catch {
      // Best effort; do not throw
    }

    return {
      observations,
      stats: {
        attempted: expectations.length,
        observed,
        notObserved,
      },
      redaction: getRedactionCounters(redactionCounters),
      observedAt: new Date().toISOString(),
    };
  } finally {
    // Robust cleanup: ensure browser/context/page are closed
    // Remove all event listeners to prevent leaks
    if (page) {
      try {
        // Remove all listeners
        page.removeAllListeners();
        // @ts-expect-error - Playwright page.close() doesn't accept timeout option, but we use it for safety
        await page.close({ timeout: 5000 }).catch(() => {});
      } catch (e) {
        // Ignore close errors but emit warning if onProgress available
        if (onProgress) {
          onProgress({
            event: 'observe:warning',
            message: `Page cleanup warning: ${e.message}`,
          });
        }
      }
    }
    
    // Close browser context if it exists
    if (browser) {
      try {
        const contexts = browser.contexts();
        for (const context of contexts) {
          try {
            // @ts-expect-error - Playwright context.close() doesn't accept timeout option, but we use it for safety
            await context.close({ timeout: 5000 }).catch(() => {});
          } catch (e) {
            // Ignore context close errors
          }
        }
        // @ts-expect-error - Playwright browser.close() doesn't accept timeout option, but we use it for safety
        await browser.close({ timeout: 5000 }).catch(() => {});
      } catch (e) {
        // Ignore browser close errors but emit warning if onProgress available
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

/**
 * Observe navigation expectation
 * Attempts to find and click element, observes URL/SPA changes
 */
async function observeNavigation(page, expectation, baseUrl, visitedUrls, evidencePath, expNum) {
  const targetPath = expectation.promise.value;

  try {
    // Screenshot before interaction
    const beforePath = resolve(evidencePath, `nav_${expNum}_before.png`);
    await page.screenshot({ path: beforePath }).catch(() => {});

    // Find element by searching all anchor tags
    const element = await page.evaluate((path) => {
      const anchors = Array.from(document.querySelectorAll('a'));
      const found = anchors.find(a => {
        const href = a.getAttribute('href');
        return href === path || href.includes(path);
      });
      return found ? { tag: 'a', href: found.getAttribute('href') } : null;
    }, targetPath);

    if (!element) {
      return false;
    }

    const urlBefore = page.url();
    const contentBefore = await page.content();

    // Click the element - try multiple approaches
    try {
      await page.locator(`a[href="${element.href}"]`).click({ timeout: 3000 });
    } catch (e) {
      try {
        await page.click(`a[href="${element.href}"]`);
      } catch (e2) {
        // Try clicking by text content
        // eslint-disable-next-line no-undef
        const text = await page.evaluate((href) => {
          const anchors = Array.from(document.querySelectorAll('a'));
          const found = anchors.find(a => a.getAttribute('href') === href);
          return found ? found.textContent : null;
        }, element.href);
        
        if (text) {
          await page.click(`a:has-text("${text}")`).catch(() => {});
        }
      }
    }

    // Wait for navigation or SPA update with explicit timeout
    try {
      await page.waitForNavigation({ 
        waitUntil: 'domcontentloaded', 
        timeout: 5000 
      }).catch(() => {
        // Navigation timeout is acceptable for SPAs
      });
      // Wait for network idle with separate timeout
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
        // Network idle timeout is acceptable
      });
    } catch (e) {
      // Navigation might not happen, continue
    }

    // Wait for potential SPA updates (bounded)
    await page.waitForTimeout(300);

    // Screenshot after interaction
    const afterPath = resolve(evidencePath, `nav_${expNum}_after.png`);
    await page.screenshot({ path: afterPath }).catch(() => {});

    const urlAfter = page.url();
    const contentAfter = await page.content();

    // Check if URL changed or content changed
    if (urlBefore !== urlAfter || contentBefore !== contentAfter) {
      visitedUrls.add(urlAfter);
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Observe network expectation
 * Checks if matching request was made
 */
async function observeNetwork(page, expectation, networkLogs, timeoutMs) {
  const targetUrl = expectation.promise.value;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const checkTimer = setInterval(() => {
      const found = networkLogs.some((log) => {
        return (
          log.url === targetUrl ||
          log.url.includes(targetUrl) ||
          targetUrl.includes(log.url)
        );
      });

      if (found) {
        clearInterval(checkTimer);
        resolve(true);
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkTimer);
        resolve(false);
        return;
      }
    }, 100);
    
    // CRITICAL: Unref the interval so it doesn't keep the process alive
    // This allows tests to exit cleanly even if interval is not cleared
    if (checkTimer && checkTimer.unref) {
      checkTimer.unref();
    }
  });
}

/**
 * Observe state expectation
 * Detects DOM changes or loading indicators
 */
async function observeState(page, expectation, evidencePath, expNum) {
  try {
    // Screenshot before
    const beforePath = resolve(evidencePath, `state_${expNum}_before.png`);
    await page.screenshot({ path: beforePath });

    const htmlBefore = await page.content();

    // Wait briefly for potential state changes
    await page.waitForTimeout(2000);

    const htmlAfter = await page.content();

    // Screenshot after
    const afterPath = resolve(evidencePath, `state_${expNum}_after.png`);
    await page.screenshot({ path: afterPath });

    // Check if DOM changed
    if (htmlBefore !== htmlAfter) {
      return true;
    }

    // Check for common state indicators (loading, error, success messages)
    const hasStateIndicators =
      (await page.$('.loading')) ||
      (await page.$('[role="status"]')) ||
      (await page.$('.toast')) ||
      (await page.$('[aria-live]'));

    return !!hasStateIndicators;
  } catch (error) {
    return false;
  }
}

