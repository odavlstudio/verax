/**
 * Guardian Network Trace Module
 * Captures network activity (HAR files) and browser traces
 */

const fs = require('fs');
const path = require('path');

class GuardianNetworkTrace {
  constructor(options = {}) {
    this.enableHAR = options.enableHAR !== false; // Enable HAR by default
    this.enableTrace = options.enableTrace !== false; // Enable trace by default
  }

  /**
   * Start HAR recording for a browser context
   * @param {BrowserContext} context - Playwright browser context
   * @param {string} artifactsDir - Directory to save HAR
   * @returns {Promise<string|null>} Path to HAR file
   */
  async startHAR(context, artifactsDir) {
    if (!this.enableHAR) {
      return null;
    }

    try {
      const harPath = path.join(artifactsDir, 'network.har');
      
      // Note: HAR recording must be started when creating context
      // This method returns the path where HAR will be saved
      return harPath;
    } catch (error) {
      console.error(`❌ Failed to prepare HAR recording: ${error.message}`);
      return null;
    }
  }

  /**
   * Stop HAR recording (Playwright handles this automatically on context.close())
   * @param {BrowserContext} context - Playwright browser context
   * @returns {Promise<boolean>} Success status
   */
  async stopHAR(context) {
    // HAR is saved automatically when context closes
    return true;
  }

  /**
   * Start browser trace recording
   * @param {BrowserContext} context - Playwright browser context
   * @param {string} artifactsDir - Directory to save trace
   * @returns {Promise<string|null>} Path where trace will be saved
   */
  async startTrace(context, artifactsDir) {
    if (!this.enableTrace) {
      return null;
    }

    try {
      const tracePath = path.join(artifactsDir, 'trace.zip');
      
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: false, // Don't include source code
      });

      return tracePath;
    } catch (error) {
      console.error(`❌ Failed to start trace: ${error.message}`);
      return null;
    }
  }

  /**
   * Stop browser trace recording and save
   * @param {BrowserContext} context - Playwright browser context
   * @param {string} tracePath - Where to save trace file
   * @returns {Promise<boolean>} Success status
   */
  async stopTrace(context, tracePath) {
    if (!this.enableTrace || !tracePath) {
      return false;
    }

    try {
      await context.tracing.stop({ path: tracePath });
      return true;
    } catch (error) {
      console.error(`❌ Failed to stop trace: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate HAR file exists and is valid JSON
   * @param {string} harPath - Path to HAR file
   * @returns {boolean} True if valid
   */
  validateHAR(harPath) {
    try {
      if (!fs.existsSync(harPath)) {
        return false;
      }

      const content = fs.readFileSync(harPath, 'utf8');
      const har = JSON.parse(content);
      
      // Basic HAR structure validation
      return har.log && har.log.entries && Array.isArray(har.log.entries);
    } catch (_error) {
      return false;
    }
  }

  /**
   * Validate trace file exists and has reasonable size
   * @param {string} tracePath - Path to trace file
   * @returns {boolean} True if valid
   */
  validateTrace(tracePath) {
    try {
      if (!fs.existsSync(tracePath)) {
        return false;
      }

      const stats = fs.statSync(tracePath);
      // Trace should be at least 10KB
      return stats.size > 10240;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get HAR statistics (request count, failed requests, etc.)
   * @param {string} harPath - Path to HAR file
   * @returns {object|null} HAR statistics
   */
  getHARStats(harPath) {
    try {
      if (!this.validateHAR(harPath)) {
        return null;
      }

      const content = fs.readFileSync(harPath, 'utf8');
      const har = JSON.parse(content);
      const entries = har.log.entries;

      const stats = {
        totalRequests: entries.length,
        failedRequests: entries.filter(e => e.response && e.response.status >= 400).length,
        requestsByType: {},
        totalSize: 0,
      };

      // Count by content type
      entries.forEach(entry => {
        const mimeType = entry.response?.content?.mimeType || 'unknown';
        const baseType = mimeType.split(';')[0].split('/')[0]; // e.g., 'text', 'image'
        
        stats.requestsByType[baseType] = (stats.requestsByType[baseType] || 0) + 1;
        
        // Sum up sizes
        if (entry.response?.content?.size) {
          stats.totalSize += entry.response.content.size;
        }
      });

      return stats;
    } catch (error) {
      console.error(`❌ Failed to parse HAR stats: ${error.message}`);
      return null;
    }
  }
}

module.exports = GuardianNetworkTrace;
