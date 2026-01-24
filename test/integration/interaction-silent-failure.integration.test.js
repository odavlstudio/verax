import { strictEqual } from 'node:assert';
import { describe, it } from 'node:test';
import { chromium } from 'playwright';
import { classifyInteractionIntent } from '../../src/cli/util/observation/interaction-intent-engine.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/**
 *  Interaction Silent Failure Integration Tests
 * Category: heavy-playwright
 * Tests interaction intent detection and silent failure classification
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Interaction Silent Failure - Integration', () => {
  const fixturePath = resolve(__dirname, '../fixtures/interaction-silent-failure/index.html');

  it('should detect working button updates UI', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(`file://${fixturePath}`);
    
    // Verify result is not visible before click
    const resultBefore = await page.locator('#result').isVisible();
    strictEqual(resultBefore, false);
    
    // Click working button
    await page.locator('#working-btn').click();
    
    // Verify result is visible after click
    const resultAfter = await page.locator('#result').isVisible();
    strictEqual(resultAfter, true);
    
    await browser.close();
  });

  it('should detect silent button has no effect', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(`file://${fixturePath}`);
    
    // Get state before click
    const contentBefore = await page.locator('body').innerHTML();
    
    // Click silent button
    await page.locator('#silent-btn').click();
    
    // Get state after click
    const contentAfter = await page.locator('body').innerHTML();
    
    // Content should be identical (no UI change)
    strictEqual(contentBefore === contentAfter, true);
    
    await browser.close();
  });

  it('should classify working button as intentful', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(`file://${fixturePath}`);
    
    // Get element details
    const element = await page.locator('#working-btn').elementHandle();
    const details = await page.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tagName: el.tagName.toUpperCase(),
        role: el.getAttribute('role'),
        disabled: el.disabled,
        ariaDisabled: el.getAttribute('aria-disabled') === 'true',
        visible: rect.width > 0 && rect.height > 0,
        boundingBox: { width: rect.width, height: rect.height },
        hasOnClick: !!el.onclick,
      };
    }, element);
    
    const classification = classifyInteractionIntent(details);
    strictEqual(classification.intentful, true);
    
    await element.dispose();
    await browser.close();
  });

  it('should classify disabled button as NOT intentful', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(`file://${fixturePath}`);
    
    // Get element details
    const element = await page.locator('#disabled-btn').elementHandle();
    const details = await page.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tagName: el.tagName.toUpperCase(),
        role: el.getAttribute('role'),
        disabled: el.disabled,
        ariaDisabled: el.getAttribute('aria-disabled') === 'true',
        visible: rect.width > 0 && rect.height > 0,
        boundingBox: { width: rect.width, height: rect.height },
        hasOnClick: !!el.onclick,
      };
    }, element);
    
    const classification = classifyInteractionIntent(details);
    strictEqual(classification.intentful, false);
    strictEqual(classification.reason, 'disabled');
    
    await element.dispose();
    await browser.close();
  });

  it('should classify noop button as NOT intentful', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(`file://${fixturePath}`);
    
    // Get element details
    const element = await page.locator('#noop-btn').elementHandle();
    const details = await page.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tagName: el.tagName.toUpperCase(),
        type: el.getAttribute('type'),
        role: el.getAttribute('role'),
        disabled: el.disabled,
        ariaDisabled: el.getAttribute('aria-disabled') === 'true',
        visible: rect.width > 0 && rect.height > 0,
        boundingBox: { width: rect.width, height: rect.height },
        hasOnClick: !!el.onclick,
        hasForm: !!el.form,
      };
    }, element);
    
    const classification = classifyInteractionIntent(details);
    strictEqual(classification.intentful, false);
    strictEqual(classification.reason, 'noop-marker');
    
    await element.dispose();
    await browser.close();
  });

  it('should classify noop anchor (#) as NOT intentful', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(`file://${fixturePath}`);
    
    // Get element details
    const element = await page.locator('#noop-anchor').elementHandle();
    const details = await page.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tagName: el.tagName.toUpperCase(),
        role: el.getAttribute('role'),
        disabled: el.disabled,
        ariaDisabled: el.getAttribute('aria-disabled') === 'true',
        visible: rect.width > 0 && rect.height > 0,
        boundingBox: { width: rect.width, height: rect.height },
        href: el.href,
      };
    }, element);
    
    const classification = classifyInteractionIntent(details);
    strictEqual(classification.intentful, false);
    strictEqual(classification.reason, 'noop-marker');
    
    await element.dispose();
    await browser.close();
  });

  it('should distinguish between intentful and non-intentful interactions', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(`file://${fixturePath}`);
    
    // Gather all buttons using evaluate to get data from browser context
    const allButtonDetails = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      return Array.from(buttons).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          id: el.id,
          tagName: el.tagName.toUpperCase(),
          type: el.getAttribute('type'),
          disabled: el.disabled,
          ariaDisabled: el.getAttribute('aria-disabled') === 'true',
          visible: rect.width > 0 && rect.height > 0,
          boundingBox: { width: rect.width, height: rect.height },
          hasOnClick: !!el.onclick,
          hasForm: !!el.form,
        };
      });
    });
    
    for (const details of allButtonDetails) {
      const classification = classifyInteractionIntent(details);
      
      if (details.id === 'working-btn') {
        strictEqual(classification.intentful, true, 'working-btn should be intentful');
      } else if (details.id === 'disabled-btn') {
        strictEqual(classification.intentful, false, 'disabled-btn should NOT be intentful');
      } else if (details.id === 'noop-btn') {
        strictEqual(classification.intentful, false, 'noop-btn should NOT be intentful');
      }
    }
    
    await browser.close();
  });
});
