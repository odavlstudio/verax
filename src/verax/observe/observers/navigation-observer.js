/**
 * PHASE 21.3 — Navigation Observer
 * 
 * Responsibilities:
 * - Page navigation
 * - Link discovery
 * - Frontier management
 * - NO file I/O
 * - NO side effects outside its scope
 */

import { navigateToUrl } from '../browser.js';
import { isExternalUrl } from '../domain-boundary.js';

/**
 * Navigate to a URL
 * 
 * @param {Object} context - Observe context
 * @param {string} targetUrl - URL to navigate to
 * @returns {Promise<boolean>} True if navigation succeeded, false if failed
 */
export async function navigateToPage(context, targetUrl) {
  const { page, scanBudget, frontier, silenceTracker } = context;

  try {
    await navigateToUrl(page, targetUrl, scanBudget);
    return true;
  } catch (error) {
    // Record navigation failure as silence and skip
    silenceTracker.record({
      scope: 'navigation',
      reason: 'navigation_timeout',
      description: 'Navigation to page failed',
      context: { targetUrl },
      impact: 'blocks_nav'
    });
    
    const normalizedFailed = frontier.normalizeUrl(targetUrl);
    if (!frontier.visited.has(normalizedFailed)) {
      frontier.visited.add(normalizedFailed);
      frontier.markVisited();
    }
    
    return false;
  }
}

/**
 * Discover links on current page and add to frontier
 * 
 * @param {Object} context - Observe context
 * @returns {Promise<void>}
 */
export async function discoverPageLinks(context) {
  const { page, baseOrigin, frontier, silenceTracker } = context;

  try {
    const currentLinks = await page.locator('a[href]').all();
    for (const link of currentLinks) {
      try {
        const href = await link.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          const resolvedUrl = href.startsWith('http') ? href : new URL(href, page.url()).href;
          if (!isExternalUrl(resolvedUrl, baseOrigin)) {
            frontier.addUrl(resolvedUrl);
          }
        }
      } catch (error) {
        // Record invalid URL discovery as silence
        silenceTracker.record({
          scope: 'discovery',
          reason: 'discovery_error',
          description: 'Invalid or unreadable link during discovery',
          context: { pageUrl: page.url() },
          impact: 'incomplete_check'
        });
      }
    }
  } catch (error) {
    // Record link discovery failure as silence
    silenceTracker.record({
      scope: 'discovery',
      reason: 'discovery_error',
      description: 'Link discovery failed on page',
      context: { pageUrl: page.url() },
      impact: 'incomplete_check'
    });
  }
}

/**
 * Check if we're already on the target page
 * 
 * @param {Object} context - Observe context
 * @param {string} targetUrl - Target URL
 * @returns {boolean} True if already on page
 */
export function isAlreadyOnPage(context, targetUrl) {
  const { page, frontier } = context;
  const currentUrl = page.url();
  const normalizedNext = frontier.normalizeUrl(targetUrl);
  const normalizedCurrent = frontier.normalizeUrl(currentUrl);
  return normalizedCurrent === normalizedNext;
}

/**
 * Mark page as visited in frontier
 * 
 * @param {Object} context - Observe context
 * @param {string} targetUrl - Target URL
 * @param {boolean} alreadyOnPage - Whether we're already on the page
 * @returns {void}
 */
export function markPageVisited(context, targetUrl, alreadyOnPage) {
  const { frontier } = context;
  const normalizedNext = frontier.normalizeUrl(targetUrl);

  if (!alreadyOnPage) {
    // We navigated via getNextUrl() - it already marked in visited set, now increment counter
    frontier.markVisited();
  } else {
    // We navigated via link click (alreadyOnPage=true) - mark as visited and increment
    if (!frontier.visited.has(normalizedNext)) {
      frontier.visited.add(normalizedNext);
      frontier.markVisited();
    } else {
      // Already marked as visited, but still increment counter since we're processing it
      frontier.markVisited();
    }
  }
}




