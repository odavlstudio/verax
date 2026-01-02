/**
 * Browser Pool - Phase 7.3
 * 
 * Manages a single browser instance per run with context-based isolation.
 * - One browser launched per run
 * - Each attempt gets a fresh context (isolated cookies, storage, viewport)
 * - Deterministic cleanup of contexts and browser
 * - Compatible with parallel execution
 */

const { chromium } = require('playwright');

class BrowserPool {
  constructor() {
    this.browser = null;
    this.contexts = new Set();
    this.launched = false;
  }

  /**
   * Launch the shared browser instance
   * @param {Object} options - Launch options (headless, args, timeout)
   * @returns {Promise<void>}
   */
  async launch(options = {}) {
    if (this.launched) {
      return; // Already launched
    }

    const launchOptions = {
      headless: options.headless !== undefined ? options.headless : true,
      args: options.args || []
    };

    try {
      this.browser = await chromium.launch(launchOptions);
      this.launched = true;
    } catch (err) {
      throw new Error(`Failed to launch browser: ${err.message}`);
    }
  }

  /**
   * Create a new isolated context for an attempt
   * @param {Object} contextOptions - Context options (viewport, recordHar, etc.)
   * @returns {Promise<Object>} { context, page }
   */
  async createContext(contextOptions = {}) {
    if (!this.browser) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    try {
      const options = { ...contextOptions };
      
      // Enable HAR recording if requested
      if (contextOptions.recordHar && contextOptions.harPath) {
        options.recordHar = { path: contextOptions.harPath };
      }

      const context = await this.browser.newContext(options);
      this.contexts.add(context);

      const page = await context.newPage();
      if (contextOptions.timeout) {
        page.setDefaultTimeout(contextOptions.timeout);
      }

      return { context, page };
    } catch (err) {
      throw new Error(`Failed to create context: ${err.message}`);
    }
  }

  /**
   * Close a specific context (deterministic cleanup)
   * @param {BrowserContext} context - The context to close
   * @returns {Promise<void>}
   */
  async closeContext(context) {
    if (!context) return;

    try {
      this.contexts.delete(context);
      await context.close();
    } catch (_err) {
      // Ignore close errors (may already be closed)
    }
  }

  /**
   * Close all contexts and the browser (end of run)
   * @returns {Promise<void>}
   */
  async close() {
    // Close all remaining contexts first
    const contextArray = Array.from(this.contexts);
    for (const context of contextArray) {
      await this.closeContext(context);
    }

    // Close browser
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (_err) {
        // Ignore close errors
      }
      this.browser = null;
      this.launched = false;
    }
  }

  /**
   * Check if browser is launched
   * @returns {boolean}
   */
  isLaunched() {
    return this.launched && this.browser !== null;
  }

  /**
   * Get count of active contexts (for testing/debugging)
   * @returns {number}
   */
  getActiveContextCount() {
    return this.contexts.size;
  }
}

module.exports = { BrowserPool };
