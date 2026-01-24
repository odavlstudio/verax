/**
 * PHASE 5: Runtime Navigation Discovery
 * 
 * PURPOSE:
 * Discover concrete navigation targets from the live DOM after page load.
 * Enables detection of dynamic routes and framework-specific navigation
 * that cannot be statically extracted from source code.
 * 
 * EVIDENCE-ONLY PRINCIPLES:
 * - Only extract explicitly visible navigation targets (a[href], role="link")
 * - Reject non-concrete targets (href="#", javascript:, mailto:, etc.)
 * - No guessing or semantic inference about business logic
 * - Deterministic IDs and stable ordering
 * 
 * SAFETY CONSTRAINTS:
 * - Read-only: discovery only, no mutations
 * - Budget-limited: maximum N targets to prevent infinite expansion
 * - Cross-origin: respect existing safety flags
 * - Graceful degradation: never crash on malformed DOM
 */

import { createHash } from 'crypto';

/**
 * Discover runtime navigation targets from the current DOM
 * 
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {Object} options - Discovery options
 * @param {string} options.baseUrl - Base URL for resolving relative hrefs
 * @param {boolean} [options.allowCrossOrigin=false] - Allow cross-origin targets
 * @param {number} [options.maxTargets=25] - Maximum targets to discover
 * @returns {Promise<Array>} Discovered navigation targets
 */
export async function discoverRuntimeNavigation(page, options = { baseUrl: '' }) {
  const {
    baseUrl,
    allowCrossOrigin = false,
    maxTargets = 25
  } = options;

  try {
    // Discover all navigation targets from DOM, including open shadow roots
    const rawTargets = await page.evaluate(({ baseUrlArg: _baseUrlArg }) => {
      /* eslint-disable no-undef */
      const targets = [];

      function isConcreteHref(href) {
        if (!href || typeof href !== 'string') return false;
        const t = href.trim();
        if (!t || t === '#' || t.startsWith('#')) return false;
        if (t.startsWith('javascript:')) return false;
        if (t.startsWith('mailto:')) return false;
        if (t.startsWith('tel:')) return false;
        if (t.startsWith('sms:')) return false;
        if (t.startsWith('data:')) return false;
        return true;
      }

      function isVisible(el) {
        try {
          const rect = el.getBoundingClientRect();
          return !!rect && rect.width > 0 && rect.height > 0;
        } catch {
          return false;
        }
      }

      // Build a deterministic selector within the current root (document or shadow root)
      function selectorWithinRoot(el) {
        const parts = [];
        let cur = el;
        let depth = 0;
        const MAX = 5;
        while (cur && cur.nodeType === Node.ELEMENT_NODE && depth < MAX) {
          if (cur.id) {
            parts.unshift('#' + cur.id);
            break;
          }
          const tag = (cur.tagName || 'div').toLowerCase();
          let sel = tag;
          // use nth-of-type for disambiguation
          const parent = cur.parentElement;
          if (parent) {
            const sameType = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
            const idx = sameType.indexOf(cur);
            if (idx >= 0) sel += `:nth-of-type(${idx + 1})`;
          }
          parts.unshift(sel);
          cur = cur.parentElement;
          depth++;
        }
        return parts.join(' > ');
      }

      // Build shadow-aware selector path including ::shadow markers
      function shadowAwarePath(el) {
        const segments = [];
        let node = el;
        let guard = 0;
        while (node && guard < 10) {
          const root = node.getRootNode();
          segments.unshift(selectorWithinRoot(node));
          if (root && root instanceof ShadowRoot) {
            const host = root.host;
            if (!host) break;
            segments.unshift(selectorWithinRoot(host) + '::shadow');
            node = host;
          } else {
            break;
          }
          guard++;
        }
        return segments.join(' > ');
      }

      function attrSnapshot(el) {
        const a = {};
        if (el.hasAttribute('href')) a.href = el.getAttribute('href');
        if (el.hasAttribute('role')) a.role = el.getAttribute('role');
        if (el.hasAttribute('aria-label')) a.ariaLabel = el.getAttribute('aria-label');
        if (el.hasAttribute('title')) a.title = el.getAttribute('title');
        return a;
      }

      // Traverse DOM and shadow roots deterministically
      function traverseRoot(root, contextKind, hostTag) {
        const walker = (node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const el = node;
          const tag = el.tagName ? el.tagName.toLowerCase() : '';

          if (tag === 'a' && el.hasAttribute('href')) {
            const href = el.getAttribute('href');
            if (isConcreteHref(href) && isVisible(el)) {
              targets.push({
                tagName: 'a',
                href,
                selectorPath: shadowAwarePath(el),
                attributes: attrSnapshot(el),
                textContent: (el.textContent || '').trim().substring(0, 100),
                sourceKind: contextKind,
                hostTagName: hostTag || undefined,
              });
            }
          }

          if (el.getAttribute && el.getAttribute('role') === 'link') {
            const direct = el.getAttribute('href');
            if (direct && isConcreteHref(direct) && isVisible(el)) {
              targets.push({
                tagName: tag,
                href: direct,
                selectorPath: shadowAwarePath(el),
                attributes: attrSnapshot(el),
                textContent: (el.textContent || '').trim().substring(0, 100),
                sourceKind: contextKind,
                hostTagName: hostTag || undefined,
              });
            } else {
              const childAnchor = el.querySelector && el.querySelector('a[href]');
              if (childAnchor) {
                const ch = childAnchor.getAttribute('href');
                if (isConcreteHref(ch) && isVisible(childAnchor)) {
                  targets.push({
                    tagName: tag,
                    href: ch,
                    selectorPath: shadowAwarePath(el),
                    attributes: attrSnapshot(el),
                    textContent: (el.textContent || '').trim().substring(0, 100),
                    sourceKind: contextKind,
                    hostTagName: hostTag || undefined,
                  });
                }
              }
            }
          }

          // Recurse into shadow root if open
          if (el.shadowRoot && el.shadowRoot.mode === 'open') {
            traverseRoot(el.shadowRoot, 'shadow-dom', el.tagName.toLowerCase());
          }

          // Continue with children
          const children = el.children ? Array.from(el.children) : [];
          for (const child of children) walker(child);
        };

        const startNodes = root instanceof Document || root instanceof ShadowRoot ? Array.from(root.children) : [];
        for (const n of startNodes) walker(n);
      }

      // Start from main document
      traverseRoot(document, 'dom', undefined);

      return targets;
      /* eslint-enable no-undef */
    }, { baseUrlArg: baseUrl });
    
    // Process targets: normalize hrefs and apply filters
    const processedTargets = [];
    const seenHrefs = new Set(); // Deduplicate by normalized href
    
    for (const target of rawTargets) {
      // Normalize href
      const normalized = normalizeHref(target.href, baseUrl);
      if (!normalized) continue;
      
      // Apply cross-origin filter
      if (!allowCrossOrigin && isCrossOrigin(normalized, baseUrl)) {
        continue;
      }
      
      // Deduplicate by normalized href
      if (seenHrefs.has(normalized)) {
        continue;
      }
      seenHrefs.add(normalized);
      
      processedTargets.push({
        ...target,
        normalizedHref: normalized,
      });
    }
    
    // Sort deterministically: by normalized href, then selector path
    processedTargets.sort((a, b) => {
      const hrefCompare = a.normalizedHref.localeCompare(b.normalizedHref);
      if (hrefCompare !== 0) return hrefCompare;
      return a.selectorPath.localeCompare(b.selectorPath);
    });
    
    // Apply budget limit
    const limitedTargets = processedTargets.slice(0, maxTargets);
    
    return limitedTargets;
    
  } catch (error) {
    // Graceful degradation: return empty array on error
    return [];
  }
}

/**
 * Normalize href to absolute URL
 * 
 * @param {string} href - Raw href value
 * @param {string} baseUrl - Base URL for resolution
 * @returns {string|null} Normalized URL or null if invalid
 */
export function normalizeHref(href, baseUrl) {
  try {
    if (!href || typeof href !== 'string') return null;
    
    const trimmed = href.trim();
    if (!trimmed) return null;
    
    // Already absolute URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    
    // Relative URL - resolve against base
    const base = new URL(baseUrl);
    const resolved = new URL(trimmed, base);
    return resolved.href;
    
  } catch (error) {
    // Invalid URL
    return null;
  }
}

/**
 * Check if URL is cross-origin relative to base
 * 
 * @param {string} url - URL to check
 * @param {string} baseUrl - Base URL
 * @returns {boolean} True if cross-origin
 */
function isCrossOrigin(url, baseUrl) {
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(baseUrl);
    return urlObj.origin !== baseObj.origin;
  } catch {
    return true; // Treat invalid URLs as cross-origin (safe default)
  }
}

/**
 * Create runtime navigation expectation from discovered target
 * 
 * @param {Object} target - Discovered navigation target
 * @param {string} discoveredAtPhase - Phase name when discovered
 * @returns {Object} Runtime expectation object
 */
export function createRuntimeNavExpectation(target, discoveredAtPhase = 'runtime-discovery') {
  const id = stableTargetId(target);
  
  return {
    id,
    kind: 'navigation.runtime',
    value: target.normalizedHref,
    confidence: 0.90, // High confidence - concrete user-visible link
    source: {
      type: 'runtime-dom',
      kind: target.sourceKind || 'dom',
      frameUrl: target.frameUrl || undefined,
      hostTagName: target.hostTagName || undefined,
      selectorPath: target.selectorPath,
      tagName: target.tagName,
      attributes: target.attributes,
      textContent: target.textContent,
      discoveredAtPhase,
    },
    promise: {
      kind: 'navigation',
      value: target.normalizedHref,
      description: `Runtime navigation to ${target.normalizedHref}`,
      sourceType: 'runtime',
    },
  };
}

/**
 * Generate deterministic ID for navigation target
 * 
 * CRITICAL: Must be stable across runs (no timestamps)
 * 
 * @param {Object} target - Navigation target
 * @returns {string} Deterministic hash ID
 */
export function stableTargetId(target) {
  // Construct stable identity from:
  // - normalized href (primary)
  // - tag name
  // - bounded selector path (for uniqueness if same href appears multiple times)
  // - role attribute (if present)
  
  const components = [
    target.normalizedHref,
    target.tagName,
    target.selectorPath,
    target.attributes?.role || '',
  ];
  
  const canonical = components.join('::');
  const hash = /** @type {string} */ (createHash('sha256').update(canonical).digest('hex'));
  
  // Use prefix to distinguish from static expectations
  return `runtime-nav-${hash.substring(0, 16)}`;
}
