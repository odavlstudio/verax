/**
 * Guardian Sitemap Discovery Module
 * Discovers URLs from robots.txt and sitemap.xml
 */

const https = require('https');
const http = require('http');

class GuardianSitemap {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000; // 10 seconds timeout
    this.maxUrls = options.maxUrls || 200; // Maximum URLs to extract
  }

  /**
   * Fetch content from URL
   * @param {string} url - URL to fetch
   * @returns {Promise<string|null>} Content or null if failed
   */
  async fetch(url) {
    return new Promise((resolve) => {
      try {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const request = client.get(url, { timeout: this.timeout }, (response) => {
          // Follow redirects
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            return this.fetch(response.headers.location).then(resolve);
          }

          if (response.statusCode !== 200) {
            return resolve(null);
          }

          let data = '';
          response.on('data', (chunk) => { data += chunk; });
          response.on('end', () => resolve(data));
        });

        request.on('error', () => resolve(null));
        request.on('timeout', () => {
          request.destroy();
          resolve(null);
        });
      } catch (_error) {
        resolve(null);
      }
    });
  }

  /**
   * Discover sitemap URLs from robots.txt
   * @param {string} baseUrl - Base URL of the website
   * @returns {Promise<string[]>} Array of sitemap URLs
   */
  async discoverFromRobots(baseUrl) {
    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).href;
      const content = await this.fetch(robotsUrl);
      
      if (!content) {
        return [];
      }

      const sitemaps = [];
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.toLowerCase().startsWith('sitemap:')) {
          const sitemapUrl = trimmed.substring(8).trim();
          if (sitemapUrl) {
            sitemaps.push(sitemapUrl);
          }
        }
      }

      return sitemaps;
    } catch (error) {
      console.error(`❌ Failed to fetch robots.txt: ${error.message}`);
      return [];
    }
  }

  /**
   * Parse sitemap XML and extract URLs
   * @param {string} xml - Sitemap XML content
   * @returns {string[]} Array of URLs
   */
  parseSitemap(xml) {
    try {
      const urls = [];
      
      // Simple regex to extract <loc> tags (works for most sitemaps)
      const locRegex = /<loc>(.*?)<\/loc>/gi;
      let match;
      
      while ((match = locRegex.exec(xml)) !== null && urls.length < this.maxUrls) {
        const url = match[1].trim();
        if (url) {
          urls.push(url);
        }
      }

      return urls;
    } catch (error) {
      console.error(`❌ Failed to parse sitemap: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if URL is a sitemap index (contains other sitemaps)
   * @param {string} xml - XML content
   * @returns {boolean} True if sitemap index
   */
  isSitemapIndex(xml) {
    return xml.includes('<sitemapindex') || xml.includes('</sitemapindex>');
  }

  /**
   * Discover all URLs from base URL (robots.txt + sitemaps)
   * @param {string} baseUrl - Base URL of the website
   * @returns {Promise<object>} Object with discovered URLs and stats
   */
  async discover(baseUrl) {
    const result = {
      urls: [],
      sitemapsChecked: 0,
      source: 'none',
    };

    try {
      // Step 1: Check robots.txt for sitemap URLs
      console.log('🗺️  Checking robots.txt for sitemaps...');
      const sitemapUrls = await this.discoverFromRobots(baseUrl);
      
      if (sitemapUrls.length === 0) {
        // Try default sitemap.xml location
        console.log('🗺️  Trying default sitemap.xml...');
        sitemapUrls.push(new URL('/sitemap.xml', baseUrl).href);
      }

      // Step 2: Fetch and parse each sitemap
      for (const sitemapUrl of sitemapUrls) {
        if (result.urls.length >= this.maxUrls) {
          break;
        }

        console.log(`🗺️  Fetching sitemap: ${sitemapUrl}`);
        const xml = await this.fetch(sitemapUrl);
        
        if (!xml) {
          continue;
        }

        result.sitemapsChecked++;

        // Check if it's a sitemap index
        if (this.isSitemapIndex(xml)) {
          const childSitemaps = this.parseSitemap(xml);
          console.log(`🗺️  Found sitemap index with ${childSitemaps.length} child sitemaps`);
          
          // Fetch child sitemaps
          for (const childUrl of childSitemaps) {
            if (result.urls.length >= this.maxUrls) {
              break;
            }

            const childXml = await this.fetch(childUrl);
            if (childXml) {
              const childUrls = this.parseSitemap(childXml);
              result.urls.push(...childUrls.slice(0, this.maxUrls - result.urls.length));
              result.sitemapsChecked++;
            }
          }
        } else {
          // Regular sitemap
          const urls = this.parseSitemap(xml);
          result.urls.push(...urls.slice(0, this.maxUrls - result.urls.length));
        }
      }

      // Deduplicate URLs
      result.urls = [...new Set(result.urls)];
      
      if (result.urls.length > 0) {
        result.source = 'sitemap';
        console.log(`✅ Discovered ${result.urls.length} URLs from ${result.sitemapsChecked} sitemap(s)`);
      } else {
        console.log('⚠️  No URLs found in sitemaps');
      }

      return result;
    } catch (error) {
      console.error(`❌ Sitemap discovery failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Filter URLs to same origin only
   * @param {string[]} urls - Array of URLs
   * @param {string} baseUrl - Base URL to compare against
   * @returns {string[]} Filtered URLs
   */
  filterSameOrigin(urls, baseUrl) {
    try {
      const baseOrigin = new URL(baseUrl).origin;
      
      return urls.filter(url => {
        try {
          return new URL(url).origin === baseOrigin;
        } catch {
          return false;
        }
      });
    } catch (_error) {
      return [];
    }
  }
}

module.exports = GuardianSitemap;
