import { strictEqual } from 'node:assert';
import { describe, it } from 'node:test';
import { chromium } from 'playwright';
import { watchForOutcome } from '../../src/cli/util/observation/outcome-watcher.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


/**
 *  Delayed Outcome Integration Test
 * Category: heavy-playwright
 * Tests outcome watcher with delayed feedback fixture
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Delayed Outcome - Integration', () => {
  it('should detect delayed acknowledgment (4s)', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const fixturePath = resolve(__dirname, '../fixtures/delayed-outcome/index.html');
    await page.goto(`file://${fixturePath}`);
    
    // Click submit button
    await page.locator('#submit-btn').click();
    
    // Watch for outcome (should wait ~4s and detect feedbackAppeared)
    const startTime = getTimeProvider().now();
    const result = await watchForOutcome(page, { maxWaitMs: 10000 });
    const duration = getTimeProvider().now() - startTime;
    
    // Verify acknowledgment detected
    strictEqual(result.acknowledged, true);
    
    // Verify latency bucket (should be 3-6s since delay is 4s)
    strictEqual(result.latencyBucket, '3-6s');
    
    // Verify feedbackAppeared signal
    strictEqual(result.signals.feedbackAppeared, true);
    
    // Verify duration is approximately 4 seconds (allow 500ms variance)
    strictEqual(duration >= 3500 && duration <= 5000, true);
    
    await browser.close();
  });

  it('should detect loading resolution', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const fixturePath = resolve(__dirname, '../fixtures/delayed-outcome/index.html');
    await page.goto(`file://${fixturePath}`);
    
    // Click submit button
    await page.locator('#submit-btn').click();
    
    // Watch for outcome
    const result = await watchForOutcome(page, { maxWaitMs: 10000 });
    
    // Verify loading resolved (spinner disappeared)
    strictEqual(result.signals.loadingResolved, true);
    
    await browser.close();
  });

  it('should early exit on no acknowledgment', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const fixturePath = resolve(__dirname, '../fixtures/delayed-outcome/index.html');
    await page.goto(`file://${fixturePath}`);
    
    // Don't click button - no acknowledgment expected
    const startTime = getTimeProvider().now();
    const result = await watchForOutcome(page, { maxWaitMs: 2000 });
    const duration = getTimeProvider().now() - startTime;
    
    // Verify no acknowledgment
    strictEqual(result.acknowledged, false);
    
    // Verify duration is close to maxWaitMs (2s)
    strictEqual(duration >= 1900 && duration <= 2500, true);
    
    await browser.close();
  });

  it('should handle early exit with stability window', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const fixturePath = resolve(__dirname, '../fixtures/delayed-outcome/index.html');
    await page.goto(`file://${fixturePath}`);
    
    // Click submit button
    await page.locator('#submit-btn').click();
    
    // Watch with default config (early exit at 500ms minimum)
    const result = await watchForOutcome(page, { maxWaitMs: 10000 });
    
    // Verify early exit happened (duration should be around 4s, not 10s)
    strictEqual(result.duration < 6000, true);
    strictEqual(result.acknowledged, true);
    
    await browser.close();
  });
});
