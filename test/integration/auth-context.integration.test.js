import { strictEqual } from 'node:assert';
import { describe, it } from 'node:test';
import { chromium } from 'playwright';
import { parseAuthCookie } from '../../src/cli/util/auth/auth-utils.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/**
 *  Auth Context Integration Test
 * Category: heavy-playwright
 * Tests full auth flow with browser and fixture
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Auth Context - Integration', () => {
  it('should block access without auth cookie', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const fixturePath = resolve(__dirname, '../fixtures/auth-protected/index.html');
    await page.goto(`file://${fixturePath}`);
    
    const errorVisible = await page.locator('.auth-error').isVisible();
    strictEqual(errorVisible, true);
    
    const protectedVisible = await page.locator('.protected-content').isVisible();
    strictEqual(protectedVisible, false);
    
    await browser.close();
  });

  it('should allow access with valid auth cookie', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    
    // Add auth cookie
    const cookie = parseAuthCookie('auth_token=valid_test_token;domain=localhost;path=/');
    await context.addCookies([cookie]);
    
    const page = await context.newPage();
    const fixturePath = resolve(__dirname, '../fixtures/auth-protected/index.html');
    await page.goto(`file://${fixturePath}`);
    
    const protectedVisible = await page.locator('.protected-content').isVisible();
    strictEqual(protectedVisible, true);
    
    const errorVisible = await page.locator('.auth-error').isVisible();
    strictEqual(errorVisible, false);
    
    await browser.close();
  });

  it('should reject access with invalid auth cookie', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    
    // Add invalid auth cookie
    const cookie = parseAuthCookie('auth_token=invalid_token;domain=localhost;path=/');
    await context.addCookies([cookie]);
    
    const page = await context.newPage();
    const fixturePath = resolve(__dirname, '../fixtures/auth-protected/index.html');
    await page.goto(`file://${fixturePath}`);
    
    const errorVisible = await page.locator('.auth-error').isVisible();
    strictEqual(errorVisible, true);
    
    const protectedVisible = await page.locator('.protected-content').isVisible();
    strictEqual(protectedVisible, false);
    
    await browser.close();
  });
});
