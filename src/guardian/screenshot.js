/**
 * Guardian Screenshot Module
 * Captures and saves screenshots of visited pages
 */

const fs = require('fs');
const path = require('path');

class GuardianScreenshot {
  constructor(options = {}) {
    this.quality = options.quality || 80; // JPEG quality 0-100
    this.fullPage = options.fullPage !== false; // Capture full page by default
    this.type = options.type || 'jpeg'; // jpeg or png
    this.normalizedViewport = options.normalizedViewport || { width: 1280, height: 720 }; // Phase 5: Consistent viewport
  }

  /**
   * Normalize browser viewport for consistent screenshots (Phase 5)
   * @param {Page} page - Playwright page object
   * @returns {Promise<void>}
   */
  async normalizeViewport(page) {
    try {
      await page.setViewportSize({
        width: this.normalizedViewport.width,
        height: this.normalizedViewport.height
      });
      // Wait for layout to settle
      await page.waitForTimeout(100);
    } catch (err) {
      console.warn(`⚠️  Viewport normalization failed: ${err.message}`);
    }
  }

  /**
   * Capture screenshot of current page
   * @param {Page} page - Playwright page object
   * @param {string} outputPath - Where to save the screenshot
   * @param {object} options - Additional screenshot options
   * @returns {Promise<boolean>} Success status
   */
  async capture(page, outputPath, options = {}) {
    try {
      // Phase 5: Normalize viewport for consistent visuals
      if (options.normalize !== false) {
        await this.normalizeViewport(page);
      }

      const screenshotOptions = {
        path: outputPath,
        type: this.type,
        fullPage: options.fullPage !== undefined ? options.fullPage : this.fullPage,
      };

      // Add quality for JPEG
      if (this.type === 'jpeg') {
        screenshotOptions.quality = this.quality;
      }

      await page.screenshot(screenshotOptions);
      return true;
    } catch (error) {
      console.error(`❌ Screenshot failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate filename for screenshot based on URL
   * @param {string} url - Page URL
   * @param {number} index - Page index
   * @returns {string} Safe filename
   */
  generateFilename(url, index) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Root path
      if (pathname === '/' || pathname === '') {
        return `page-${index}-home.${this.type}`;
      }

      // Clean pathname for filename
      const safeName = pathname
        .replace(/^\//, '') // Remove leading slash
        .replace(/\/$/, '') // Remove trailing slash
        .replace(/\//g, '-') // Replace slashes with dashes
        .replace(/[^a-zA-Z0-9\-_.]/g, '_') // Replace unsafe chars
        .substring(0, 100); // Limit length

      return `page-${index}-${safeName}.${this.type}`;
    } catch (_error) {
      // Fallback for invalid URLs
      return `page-${index}-unknown.${this.type}`;
    }
  }

  /**
   * Save screenshot during crawl
   * @param {Page} page - Playwright page
   * @param {string} url - Current URL
   * @param {number} index - Page index
   * @param {string} artifactsDir - Artifacts directory
   * @returns {Promise<string|null>} Path to saved screenshot or null
   */
  async captureForCrawl(page, url, index, artifactsDir) {
    try {
      // Create pages subdirectory
      const pagesDir = path.join(artifactsDir, 'pages');
      if (!fs.existsSync(pagesDir)) {
        fs.mkdirSync(pagesDir, { recursive: true });
      }

      // Generate filename and full path
      const filename = this.generateFilename(url, index);
      const outputPath = path.join(pagesDir, filename);

      // Capture screenshot
      const success = await this.capture(page, outputPath);
      
      if (success) {
        return filename; // Return relative filename
      }
      return null;
    } catch (error) {
      console.error(`❌ Failed to capture screenshot for ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate that screenshot file exists and has reasonable size
   * @param {string} filepath - Path to screenshot file
   * @returns {boolean} True if valid
   */
  validateScreenshot(filepath) {
    try {
      if (!fs.existsSync(filepath)) {
        return false;
      }

      const stats = fs.statSync(filepath);
      // Screenshot should be at least 1KB
      return stats.size > 1024;
    } catch (_error) {
      return false;
    }
  }
}

module.exports = GuardianScreenshot;
