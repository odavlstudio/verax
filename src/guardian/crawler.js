class GuardianCrawler {
  constructor(baseUrl, maxPages = 25, maxDepth = 3) {
    this.baseUrl = new URL(baseUrl);
    this.maxPages = maxPages;
    this.maxDepth = maxDepth;
    
    this.visited = new Set();
    this.discovered = new Set();
    this.toVisit = ['/'];
    this.pages = [];
    
    // Phase 2 features
    this.screenshot = null; // Will be set by main engine
    this.safety = null; // Will be set by main engine
    this.artifactsDir = null; // Will be set during crawl
    this.safetyStats = { urlsBlocked: 0 };
  }

  isSameOrigin(url) {
    try {
      const parsed = new URL(url, this.baseUrl);
      return parsed.origin === this.baseUrl.origin;
    } catch (_e) {
      return false;
    }
  }

  getPathname(url) {
    try {
      const parsed = new URL(url, this.baseUrl);
      return parsed.pathname;
    } catch (_e) {
      return null;
    }
  }

  async crawl(browser, artifactsDir = null) {
    this.artifactsDir = artifactsDir;
    let depth = 0;
    let currentDepthUrls = ['/'];
    
    while (currentDepthUrls.length > 0 && depth < this.maxDepth && this.visited.size < this.maxPages) {
      const nextDepthUrls = [];
      
      for (const pathname of currentDepthUrls) {
        if (this.visited.size >= this.maxPages) break;
        if (this.visited.has(pathname)) continue;
        
        // Safety check
        const fullUrl = new URL(pathname, this.baseUrl).toString();
        if (this.safety) {
          const safetyCheck = this.safety.isUrlSafe(fullUrl);
          if (!safetyCheck.safe) {
            console.log(`🛡️  Blocked: ${pathname} (${safetyCheck.reason})`);
            this.safetyStats.urlsBlocked++;
            continue;
          }
        }
        
        this.visited.add(pathname);
        this.discovered.add(pathname);
        
        const result = await browser.navigate(fullUrl);
        
        if (result.success) {
          const links = await browser.getLinks();
          
          // Capture screenshot if enabled
          let screenshotFile = null;
          if (this.screenshot && this.artifactsDir) {
            screenshotFile = await this.screenshot.captureForCrawl(
              browser.page, 
              fullUrl, 
              this.pages.length + 1, 
              this.artifactsDir
            );
          }
          
          const pageRecord = {
            index: this.pages.length + 1,
            url: fullUrl,
            pathname: pathname,
            status: result.status,
            links: links.length,
            linkCount: links.length, // Deprecated, use 'links'
            depth: depth,
            screenshot: screenshotFile,
            timestamp: new Date().toISOString()
          };
          
          this.pages.push(pageRecord);
          
          // Extract unique new links
          for (const link of links) {
            if (!this.isSameOrigin(link.href)) continue;
            
            const newPathname = this.getPathname(link.href);
            if (!newPathname || this.discovered.has(newPathname)) continue;
            
            this.discovered.add(newPathname);
            if (!this.visited.has(newPathname)) {
              nextDepthUrls.push(newPathname);
            }
          }
        } else {
          // Still record failed visits
          this.pages.push({
            index: this.pages.length + 1,
            url: fullUrl,
            pathname: pathname,
            status: null,
            links: 0,
            linkCount: 0,
            depth: depth,
            error: result.error,
            screenshot: null,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      currentDepthUrls = nextDepthUrls;
      depth++;
    }
    
    // Add discovered but not visited pages
    for (const pathname of this.discovered) {
      if (!this.visited.has(pathname)) {
        // Do nothing, we'll handle in report
      }
    }
    
    return {
      visited: this.pages,
      totalDiscovered: this.discovered.size,
      totalVisited: this.visited.size,
      safetyStats: this.safetyStats
    };
  }
}

module.exports = { GuardianCrawler };
