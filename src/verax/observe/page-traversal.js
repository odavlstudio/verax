/**
 * PAGE TRAVERSAL ENGINE
 * 
 * Manages page frontier, link discovery, and page-to-page navigation.
 */

import { isExternalUrl } from './domain-boundary.js';

/**
 * Discover links on current page
 * 
 * @param {Object} page - Playwright page
 * @param {string} baseOrigin - Base origin URL
 * @param {Object} silenceTracker - Silence tracker
 * @returns {Promise<Array>}
 */
export async function discoverPageLinks(page, baseOrigin, silenceTracker) {
  try {
    // Discover all links on the page
    const links = await page.locator('a[href]').all();
    const linkData = [];
    
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href) {
        linkData.push({ href });
      }
    }
    
    // Filter to same-origin links
    const sameOriginLinks = linkData.filter(link => {
      if (!link.href) return false;
      return !isExternalUrl(link.href, baseOrigin);
    });

    return sameOriginLinks;
  } catch (error) {
    silenceTracker.record('link_discovery_error');
    return [];
  }
}

/**
 * Get next page URL from frontier
 * 
 * @param {Object} frontier - Page frontier object
 * @returns {string|null}
 */
export function getNextPageUrl(frontier) {
  if (!frontier || !frontier.queue || frontier.queue.length === 0) {
    return null;
  }

  const nextUrl = frontier.queue[0];
  return nextUrl;
}

/**
 * Mark page as visited in frontier
 * 
 * @param {Object} frontier - Page frontier object
 * @param {string} url - URL that was visited
 */
export function markPageVisited(frontier, url) {
  if (!frontier) return;
  
  // Remove from queue
  if (frontier.queue && frontier.queue.length > 0) {
    frontier.queue = frontier.queue.filter(u => u !== url);
  }

  // Add to visited
  if (!frontier.visited) {
    frontier.visited = [];
  }
  if (!frontier.visited.includes(url)) {
    frontier.visited.push(url);
  }
}

/**
 * Add discovered links to frontier queue
 * 
 * @param {Object} frontier - Page frontier object
 * @param {Array} links - Links to add
 */
export function addLinksToFrontier(frontier, links) {
  if (!frontier || !links || links.length === 0) return;

  if (!frontier.queue) {
    frontier.queue = [];
  }

  for (const link of links) {
    if (link.href && !frontier.queue.includes(link.href) && 
        (!frontier.visited || !frontier.visited.includes(link.href))) {
      frontier.queue.push(link.href);
    }
  }
}

/**
 * Check if page limit has been reached
 * 
 * @param {number} pagesVisited - Number of pages visited
 * @param {number} pageLimit - Maximum pages to visit
 * @returns {boolean}
 */
export function isPageLimitReached(pagesVisited, pageLimit) {
  return pagesVisited >= pageLimit;
}

/**
 * Cap frontier to maximum size
 * 
 * @param {Object} frontier - Page frontier object
 * @param {number} maxFrontierSize - Maximum frontier queue size
 */
export function capFrontier(frontier, maxFrontierSize) {
  if (!frontier || !frontier.queue) return;

  if (frontier.queue.length > maxFrontierSize) {
    frontier.queue = frontier.queue.slice(0, maxFrontierSize);
  }
}

/**
 * Initialize frontier for traversal
 * 
 * @param {string} baseUrl - Starting URL
 * @returns {Object}
 */
export function initializeFrontier(baseUrl) {
  return {
    queue: [baseUrl],
    visited: []
  };
}



