const { chromium } = require('playwright');

class GuardianBrowser {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.ownsContext = false; // Track if we own the context for cleanup
  }

  /**
   * Launch browser with its own context (legacy mode)
   * @param {number} timeout - Default timeout
   * @param {Object} options - Launch options
   * @returns {Promise<boolean>}
   */
  async launch(timeout = 20000, options = {}) {
    try {
      const launchOptions = { 
        headless: options.headless !== undefined ? options.headless : true,
        args: options.args || []
      };
      
      this.browser = await chromium.launch(launchOptions);
      
      const contextOptions = {
        ...options,
      };
      
      // Enable HAR recording if requested
      if (options.recordHar) {
        // Note: HAR path must be provided in the actual implementation
        // For now, we'll prepare the context for HAR recording
        contextOptions.recordHar = options.harPath ? { path: options.harPath } : undefined;
      }
      
      this.context = await this.browser.newContext(contextOptions);
      this.page = await this.context.newPage();
      this.page.setDefaultTimeout(timeout);
      this.ownsContext = true; // We own browser and context
      return true;
    } catch (err) {
      throw new Error(`Failed to launch browser: ${err.message}`);
    }
  }

  /**
   * Phase 7.3: Use an existing context from browser pool
   * @param {BrowserContext} context - Playwright browser context
   * @param {Page} page - Playwright page
   * @param {number} timeout - Default timeout
   */
  useContext(context, page, timeout = 20000) {
    this.context = context;
    this.page = page;
    this.ownsContext = false; // Pool owns the context
    if (timeout) {
      this.page.setDefaultTimeout(timeout);
    }
  }

  async navigate(url, timeout = 20000) {
    try {
      const response = await this.page.goto(url, {
        waitUntil: 'networkidle',
        timeout
      });
      
      return {
        success: true,
        status: response?.status() || 200,
        url: this.page.url()
      };
    } catch (err) {
      return {
        success: false,
        status: null,
        error: err.message
      };
    }
  }

  async getLinks() {
    try {
      const links = await this.page.locator('a[href]').evaluateAll(elements =>
        elements.map(el => ({
          href: el.href,
          text: el.innerText?.trim() || ''
        }))
      );
      return links;
    } catch (_err) {
      return [];
    }
  }

  async takeScreenshot(filePath) {
    try {
      await this.page.screenshot({ path: filePath });
      return true;
    } catch (_err) {
      return false;
    }
  }

  async close() {
    try {
      // Phase 7.3: Only close browser if we own it (legacy mode)
      // If using pool context, pool handles cleanup
      if (this.ownsContext && this.browser) {
        await this.browser.close();
      }
    } catch (_err) {
      // Ignore close errors
    }
  }
}

module.exports = { GuardianBrowser };
