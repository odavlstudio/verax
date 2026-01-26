/**
 * GAP-006: Deterministic Runtime Micro-Crawl
 * 
 * PURPOSE:
 * Perform bounded, single-step micro-crawl AFTER initial page load to discover
 * hidden navigation targets in SPAs that only appear after user interaction.
 * 
 * CONSTRAINTS:
 * - One-step only: No recursion beyond initial targets
 * - Deterministic: Same app → same routes (stable sort, no randomness)
 * - Hard caps: maxTargets, maxTime enforced strictly
 * - Safety: Reuse destructive route filters, cross-origin checks
 * - Read-only: No side effects or mutations
 * - Zero config: No heuristics, no scoring
 * 
 * ALGORITHM:
 * 1. Take first N targets from initial runtime discovery (deterministically sorted)
 * 2. For each target: navigate → extract new links → reset
 * 3. Merge all discovered links, deduplicate, apply safety filters
 * 4. Return merged list with metadata (attempted, discovered, capped)
 */

import { discoverRuntimeNavigation, createRuntimeNavExpectation } from './runtime-navigation-discovery.js';
import { getTimeProvider } from '../support/time-provider.js';

function isDestructiveRoute(href) {
  const val = (href || '').toLowerCase();
  return val.includes('logout') || val.includes('delete') || val.includes('destroy') || val.includes('remove');
}

/**
 * Perform single-step micro-crawl from discovered navigation targets
 * 
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {Array} initialTargets - Already-discovered targets from initial runtime discovery
 * @param {Object} options - Micro-crawl options
 * @param {string} options.baseUrl - Base URL for navigation
 * @param {string} options.originalUrl - Original page URL to return to
 * @param {boolean} [options.allowCrossOrigin=false] - Allow cross-origin targets
 * @param {number} [options.maxTargets=5] - Max targets to crawl (hard cap)
 * @param {number} [options.maxTime=15000] - Max time in ms (hard cap)
 * @param {number} [options.maxDiscoveryPerTarget=10] - Max new links per target
 * @param {Function} [options.onProgress] - Progress callback
 * @returns {Promise<Object>} Micro-crawl results with metadata
 */
export async function performMicroCrawl(page, initialTargets, options = { baseUrl: '', originalUrl: '' }) {
  const {
    originalUrl,
    allowCrossOrigin = false,
    maxTargets = 5,
    maxTime = 15000,
    maxDiscoveryPerTarget = 10,
    onProgress
  } = options;

  const metadata = {
    attempted: 0,
    discoveredCount: 0,
    capped: false,
    reasons: [],
    targetsCrawled: [],
    errors: []
  };

  const allDiscoveredTargets = [];
  const alreadyKnownHrefs = new Set(
    initialTargets.map(t => t.normalizedHref || t.href)
  );

  const startTime = getTimeProvider().now();

  // DETERMINISTIC SELECTION: Take first N targets (already sorted by discovery)
  // Initial targets are sorted by normalizedHref + selectorPath (deterministic)
  const targetsToCrawl = initialTargets
    .filter(t => !isDestructiveRoute(t.normalizedHref || t.href))
    .slice(0, maxTargets);

  if (targetsToCrawl.length === 0) {
    metadata.reasons.push('no-safe-targets-to-crawl');
    return { targets: [], metadata };
  }

  if (targetsToCrawl.length < initialTargets.length) {
    metadata.capped = true;
    metadata.reasons.push(`capped-at-max-targets-${maxTargets}`);
  }

  // ONE-STEP CRAWL: Navigate to each target, discover links, return
  for (const target of targetsToCrawl) {
    // Check time budget
    if (getTimeProvider().now() - startTime > maxTime) {
      metadata.capped = true;
      metadata.reasons.push(`exceeded-max-time-${maxTime}ms`);
      break;
    }

    metadata.attempted++;
    const targetUrl = target.normalizedHref || target.href;

    try {
      if (onProgress) {
        onProgress({
          event: 'micro-crawl:navigate',
          message: `Micro-crawl navigating to ${targetUrl}`,
        });
      }

      // Navigate to target
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 5000
      });

      // Wait for potential dynamic content
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

      // Discover navigation targets on this page
      const discovered = await discoverRuntimeNavigation(page, {
        baseUrl: targetUrl,
        allowCrossOrigin,
        maxTargets: maxDiscoveryPerTarget
      });

      // Filter: exclude already-known hrefs, exclude destructive routes
      const newTargets = discovered.filter(t => {
        const href = t.normalizedHref || t.href;
        if (alreadyKnownHrefs.has(href)) return false;
        if (isDestructiveRoute(href)) return false;
        return true;
      });

      // Mark these targets with micro-crawl context
      for (const t of newTargets) {
        alreadyKnownHrefs.add(t.normalizedHref || t.href);
        allDiscoveredTargets.push({
          ...t,
          discoveredVia: 'micro-crawl',
          sourceUrl: targetUrl,
          crawlDepth: 1
        });
      }

      metadata.targetsCrawled.push({
        url: targetUrl,
        discoveredCount: newTargets.length
      });

      metadata.discoveredCount += newTargets.length;

    } catch (error) {
      metadata.errors.push({
        url: targetUrl,
        error: error.message
      });
      
      if (onProgress) {
        onProgress({
          event: 'micro-crawl:error',
          message: `Micro-crawl error on ${targetUrl}: ${error.message}`,
        });
      }
    }

    // Reset to original page for consistency
    try {
      await page.goto(originalUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 5000
      });
      await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
    } catch (error) {
      metadata.errors.push({
        url: originalUrl,
        error: `Reset failed: ${error.message}`
      });
    }
  }

  // DETERMINISTIC SORT: Same as initial discovery (normalizedHref + selectorPath)
  allDiscoveredTargets.sort((a, b) => {
    const hrefCompare = (a.normalizedHref || a.href).localeCompare(b.normalizedHref || b.href);
    if (hrefCompare !== 0) return hrefCompare;
    return (a.selectorPath || '').localeCompare(b.selectorPath || '');
  });

  if (metadata.discoveredCount === 0) {
    metadata.reasons.push('no-new-targets-discovered');
  }

  return {
    targets: allDiscoveredTargets,
    metadata
  };
}

/**
 * Convert micro-crawl targets to runtime expectations
 * 
 * @param {Array} microCrawlTargets - Targets from micro-crawl
 * @returns {Array} Runtime expectations
 */
export function convertMicroCrawlToExpectations(microCrawlTargets) {
  return microCrawlTargets.map(target => {
    const runtimeExp = createRuntimeNavExpectation(target, 'micro-crawl-phase');
    const selector = target.selectorPath || runtimeExp.source?.selectorPath || null;
    const rawHref = target.attributes?.href || target.href || target.normalizedHref;

    return {
      ...runtimeExp,
      type: 'navigation',
      category: 'navigation',
      selector,
      expectedOutcome: 'navigation',
      promise: {
        ...runtimeExp.promise,
        value: runtimeExp.promise?.value || target.normalizedHref,
        rawHref,
        selector
      },
      source: {
        ...(runtimeExp.source || {}),
        type: 'runtime-dom',
        selectorPath: selector,
        discoveredVia: 'micro-crawl',
        sourceUrl: target.sourceUrl,
        crawlDepth: target.crawlDepth
      },
      isRuntimeNav: true,
      isMicroCrawl: true,
      runtimeNav: {
        href: target.href,
        normalizedHref: target.normalizedHref,
        selectorPath: target.selectorPath,
        targetId: runtimeExp.id,
        tagName: target.tagName,
        attributes: target.attributes,
        discoveredAt: 'micro-crawl-phase',
        discoveredVia: 'micro-crawl',
        sourceUrl: target.sourceUrl,
        crawlDepth: target.crawlDepth,
        context: target.sourceKind === 'iframe'
          ? { kind: 'iframe', frameUrl: target.frameUrl }
          : (target.sourceKind === 'shadow-dom' ? { kind: 'shadow-dom', hostTagName: target.hostTagName || null } : null)
      }
    };
  });
}

