import { chromium } from 'playwright';

/**
 * VERAX Global Playwright Cleanup System
 * 
 * Guarantees zero dangling Playwright processes.
 * Used by test-runner-wrapper.js for hard enforcement.
 */

const activePlaywrightResources = new Set();

/**
 * Track a Playwright resource (browser, context, page)
 */
export function trackResource(resource) {
  if (resource) {
    activePlaywrightResources.add(resource);
  }
  return resource;
}

/**
 * Release a Playwright resource
 */
export function untrackResource(resource) {
  if (resource) {
    activePlaywrightResources.delete(resource);
  }
}

/**
 * Force close ALL active Playwright resources
 * Called when hanging is detected or process is exiting
 */
export async function closeAllPlaywrightResources() {
  const resourcesCopy = Array.from(activePlaywrightResources);
  activePlaywrightResources.clear();

  for (const resource of resourcesCopy) {
    try {
      // Determine resource type and close appropriately
      if (resource.close) {
        if (typeof resource.close === 'function') {
          await Promise.race([
            resource.close().catch(() => {}),
            new Promise(r => setTimeout(r, 2000)) // 2 second timeout per resource
          ]);
        }
      }
    } catch (e) {
      // Silently ignore; resource may already be closed
    }
  }
}

/**
 * Get count of active resources (for debugging)
 */
export function getActiveResourceCount() {
  return activePlaywrightResources.size;
}

/**
 * HARD ENFORCEMENT: Kill ALL Playwright browsers with OS-level signals
 * Last resort when graceful shutdown fails
 * Called by test-runner-wrapper.js before process exit
 */
export async function forceKillAllBrowsers() {
  try {
    // First attempt graceful cleanup
    await closeAllPlaywrightResources();
  } catch (e) {
    // Ignore errors during graceful cleanup
  }

  // Then use OS commands to force kill any remaining Playwright processes
  const { execSync } = await import('child_process');
  
  try {
    if (process.platform === 'win32') {
      // Windows: Kill all chromium.exe processes
      try {
        execSync('taskkill /F /IM chromium.exe /T', { stdio: 'ignore' });
      } catch (e) {
        // Process may not exist
      }
    } else {
      // Unix/Mac: Kill all Playwright-related processes
      try {
        execSync('pkill -9 -f "chromium|playwright"', { stdio: 'ignore' });
      } catch (e) {
        // Process may not exist
      }
    }
  } catch (e) {
    // Ignore errors from force kill
  }
}

/**
 * Wrapper to safely manage Playwright browser instance
 */
export async function createManagedBrowser(options = {}) {
  const browser = await chromium.launch(options);
  trackResource(browser);
  
  const originalClose = browser.close.bind(browser);
  browser.close = async () => {
    untrackResource(browser);
    return originalClose();
  };

  return browser;
}

/**
 * Wrapper to safely manage Playwright context instance
 */
export function createManagedContext(context) {
  if (!context) return null;
  trackResource(context);
  
  const originalClose = context.close.bind(context);
  context.close = async () => {
    untrackResource(context);
    return originalClose();
  };

  return context;
}

/**
 * Wrapper to safely manage Playwright page instance
 */
export function createManagedPage(page) {
  if (!page) return null;
  trackResource(page);
  
  const originalClose = page.close.bind(page);
  page.close = async () => {
    untrackResource(page);
    return originalClose();
  };

  return page;
}

/**
 * High-level helper: create browser and ensure cleanup
 */
export async function withBrowser(testFn, options = {}) {
  let browser;
  try {
    browser = await createManagedBrowser(options);
    return await testFn(browser);
  } finally {
    if (browser) {
      untrackResource(browser);
      try {
        await browser.close();
      } catch (e) {
        // Already closed or closing
      }
    }
  }
}

/**
 * High-level helper: create browser + context and ensure cleanup
 */
export async function withBrowserContext(testFn, options = {}) {
  let browser;
  let context;
  try {
    browser = await createManagedBrowser(options);
    context = await browser.newContext();
    trackResource(context);
    return await testFn(browser, context);
  } finally {
    if (context) {
      untrackResource(context);
      try {
        await context.close();
      } catch (e) {
        // Already closed or closing
      }
    }
    if (browser) {
      untrackResource(browser);
      try {
        await browser.close();
      } catch (e) {
        // Already closed or closing
      }
    }
  }
}

/**
 * High-level helper: create browser + context + page and ensure cleanup
 */
export async function withBrowserPage(testFn, options = {}) {
  let browser;
  let context;
  let page;
  try {
    browser = await createManagedBrowser(options);
    context = await browser.newContext();
    trackResource(context);
    page = await context.newPage();
    trackResource(page);
    return await testFn(browser, context, page);
  } finally {
    if (page) {
      untrackResource(page);
      try {
        await page.close();
      } catch (e) {
        // Already closed or closing
      }
    }
    if (context) {
      untrackResource(context);
      try {
        await context.close();
      } catch (e) {
        // Already closed or closing
      }
    }
    if (browser) {
      untrackResource(browser);
      try {
        await browser.close();
      } catch (e) {
        // Already closed or closing
      }
    }
  }
}
