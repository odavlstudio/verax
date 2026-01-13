/**
 * Page Frontier — Multi-page traversal manager
 * 
 * Manages a queue of pages to visit and enforces:
 * - Same-origin only
 * - No re-visiting (canonical URLs)
 * - Budget limits (maxPages, maxScanDurationMs, maxUniqueUrls)
 * - Skipping dangerous actions (logout, delete)
 */

import { canonicalizeUrl } from '../shared/url-normalizer.js';

// Normalize a textual label for deterministic matching
function normalizeLabel(label) {
  return (label || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Deterministic destructive-action classifier
// Returns { skip: boolean, reasonCode: string|null, matched: string|null }
function isDestructiveLabel(label) {
  const normalized = normalizeLabel(label);
  if (!normalized) {
    return { skip: false, reasonCode: null, matched: null };
  }

  // Strong destructive keywords (word-boundary guarded)
  const strongKeywords = ['delete', 'remove', 'erase', 'wipe', 'destroy', 'drop', 'reset', 'terminate', 'unsubscribe', 'deactivate'];
  const strongRegex = new RegExp(`\\b(${strongKeywords.join('|')})\\b`, 'i');

  // Financial/destructive-ish actions we still treat conservatively
  const financialRegex = /\b(pay|purchase|checkout)\b/i;

  // Safe allowlist for clear-related actions (explicitly non-destructive)
  const safeClearRegex = /\bclear\b[^\w]*(filters?|search|selection|input|form|field|query|results?)\b/i;

  // Destructive uses of "clear" require sensitive nouns
  const destructiveClearRegex = /\bclear\b[^\w]*(data|account|all|history|cache|storage|database|everything|session|profile|settings|config)\b/i;

  // If it is an explicit safe clear phrase, allow
  if (safeClearRegex.test(normalized)) {
    return { skip: false, reasonCode: null, matched: 'safe_clear' };
  }

  // If strong destructive or financial keyword appears, skip
  const strongMatch = normalized.match(strongRegex);
  if (strongMatch) {
    return { skip: true, reasonCode: 'destructive_keyword', matched: strongMatch[1] };
  }

  const financialMatch = normalized.match(financialRegex);
  if (financialMatch) {
    return { skip: true, reasonCode: 'financial_action', matched: financialMatch[1] };
  }

  // Handle ambiguous "clear" only when paired with sensitive nouns
  const clearMatch = normalized.match(destructiveClearRegex);
  if (clearMatch) {
    return { skip: true, reasonCode: 'clear_sensitive', matched: clearMatch[0] };
  }

  return { skip: false, reasonCode: null, matched: null };
}

export class PageFrontier {
  constructor(startUrl, baseOrigin, scanBudget, startTime) {
    this.baseOrigin = baseOrigin;
    this.scanBudget = scanBudget;
    this.startTime = startTime;
    
    this.queue = [startUrl]; // URLs to visit
    this.visited = new Set(); // Visited URLs (canonical form)
    this.pagesVisited = 0;
    this.pagesDiscovered = 1; // include start page
    this.frontierCapped = false; // Track if maxUniqueUrls was exceeded
  }

  /**
   * Normalize a URL to canonical form using shared URL normalizer.
   * - Remove hash fragments
   * - Sort query params
   * - Drop tracking params (utm_*, gclid, fbclid, etc.)
   */
  normalizeUrl(urlString) {
    return canonicalizeUrl(urlString);
  }

  /**
   * Check if URL is same-origin.
   */
  isSameOrigin(urlString) {
    try {
      const url = new URL(urlString);
      if (url.protocol === 'file:' && this.baseOrigin.startsWith('file:')) {
        return true;
      }
      return url.origin === this.baseOrigin;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if we've exceeded page limit.
   */
  isPageLimitExceeded() {
    if (this.scanBudget.maxPages && this.pagesVisited >= this.scanBudget.maxPages) {
      return true;
    }
    return false;
  }

  /**
   * Check if we've exceeded time limit.
   */
  isTimeLimitExceeded() {
    const elapsed = Date.now() - this.startTime;
    return elapsed > this.scanBudget.maxScanDurationMs;
  }

  /**
   * Get next URL to visit (if any and within budget).
   * Returns null if queue empty or limits exceeded.
   */
  getNextUrl() {
    // Check limits
    if (this.isPageLimitExceeded() || this.isTimeLimitExceeded()) {
      return null;
    }

    // Find next unvisited same-origin URL
    while (this.queue.length > 0) {
      const nextUrl = this.queue.shift();
      const normalized = this.normalizeUrl(nextUrl);

      // Skip if already visited
      if (this.visited.has(normalized)) {
        continue;
      }

      // Skip if not same-origin
      if (!this.isSameOrigin(nextUrl)) {
        continue;
      }

      this.visited.add(normalized);
      return nextUrl;
    }

    return null;
  }

  /**
   * Add a new URL to the frontier (discovered during interaction).
   * Only adds if same-origin, not already visited, and within maxUniqueUrls limit.
   * Returns true if added, false if skipped (with reason).
   */
  addUrl(urlString) {
    if (!this.isSameOrigin(urlString)) {
      return false;
    }

    const normalized = this.normalizeUrl(urlString);
    if (this.visited.has(normalized)) {
      return false;
    }

    // Check maxUniqueUrls cap
    const maxUniqueUrls = this.scanBudget.maxUniqueUrls || Infinity;
    if (this.pagesDiscovered >= maxUniqueUrls) {
      this.frontierCapped = true;
      return false; // Frontier capped, don't add
    }

    // Add the normalized URL to visited set and original to queue
    this.visited.add(normalized);
    this.queue.push(urlString);
    this.pagesDiscovered++;
    return true;
  }

  /**
   * Mark that we've visited a page.
   */
  markVisited() {
    this.pagesVisited++;
  }

  /**
   * Check if an interaction should be skipped (destructive/safe-action policy).
   * Returns { skip: boolean, reason: string } with strict rules.
   * Only uses properties available from interaction discovery (text, label, selector).
   * Note: label may contain aria-label if that was the source (from extractLabel).
   */
  shouldSkipInteraction(interaction) {
    // Allow explicit auth flows when labeled by type (keep auth testing intact)
    if (interaction.type === 'login' || interaction.type === 'logout') {
      return { skip: false, reason: null };
    }

    // Aggregate all human-visible labels
    const text = (interaction.text || '').trim();
    const label = (interaction.label || '').trim();
    const ariaLabel = (interaction.ariaLabel || '').trim();
    const combinedText = `${text} ${label} ${ariaLabel}`.trim();

    const destructiveCheck = isDestructiveLabel(combinedText);
    if (destructiveCheck.skip) {
      return { skip: true, reason: 'safety_policy', matched: destructiveCheck.matched };
    }

    // Check selector for explicit danger markers
    const selector = (interaction.selector || '').toLowerCase();
    if (selector.includes('data-danger') || selector.includes('data-destructive')) {
      return { skip: true, reason: 'safety_policy', matched: 'data-danger' };
    }

    return { skip: false, reason: null };
  }

  /**
   * Get frontier stats.
   */
  getStats() {
    return {
      pagesVisited: this.pagesVisited,
      pagesDiscovered: this.pagesDiscovered,
      queueLength: this.queue.length,
      isPageLimitExceeded: this.isPageLimitExceeded(),
      isTimeLimitExceeded: this.isTimeLimitExceeded()
    };
  }
}

export { normalizeLabel, isDestructiveLabel };
