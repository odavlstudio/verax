import { getTimeProvider } from '../support/time-provider.js';

/**
 * PHASE 2C: UI Mutation Tracker
 * Lightweight tracking of UI mutations for stronger state → UI reality signals
 */

/**
 * Capture UI mutation summary for an interaction
 * Returns: { nodesAdded, nodesRemoved, attributeChanges, textChanges, timestamp }
 */
export async function captureUIMutationSummary(page, options = {}) {
  const { maxTextSnippets = 5, snippetLength = 50 } = options;

  try {
    const summary = await page.evaluate(
      ({ maxSnippets, snippetLen }) => {
        // Initialize mutation observer if not already done
        if (!window.__veraxMutationSummary) {
          window.__veraxMutationSummary = {
            nodesAdded: 0,
            nodesRemoved: 0,
            attributeChanges: {
              disabled: 0,
              'aria-invalid': 0,
              'aria-busy': 0,
              'aria-live': 0,
              class: 0,
              hidden: 0,
            },
            textChanges: [],
          };

          // Set up mutation observer
          const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              // Count added/removed nodes
              if (mutation.addedNodes?.length > 0) {
                window.__veraxMutationSummary.nodesAdded += mutation.addedNodes.length;
              }
              if (mutation.removedNodes?.length > 0) {
                window.__veraxMutationSummary.nodesRemoved += mutation.removedNodes.length;
              }

              // Track key attribute changes
              if (mutation.type === 'attributes') {
                const attrName = mutation.attributeName;
                if (window.__veraxMutationSummary.attributeChanges[attrName] !== undefined) {
                  window.__veraxMutationSummary.attributeChanges[attrName]++;
                }
              }

              // Track text content changes
              if (mutation.type === 'characterData' || mutation.type === 'childList') {
                const target = mutation.target;
                const text = target.textContent || '';
                const trimmed = text.trim();

                if (trimmed.length > 0 && trimmed.length < 500) {
                  // Avoid duplicates
                  const existing = window.__veraxMutationSummary.textChanges.find(
                    (tc) => tc.text === trimmed
                  );
                  if (!existing && window.__veraxMutationSummary.textChanges.length < maxSnippets) {
                    window.__veraxMutationSummary.textChanges.push({
                      text: trimmed.substring(0, snippetLen),
                      length: trimmed.length,
                    });
                  }
                }
              }
            }
          });

          // Observe main container
          const container =
            document.getElementById('root') ||
            document.getElementById('app') ||
            document.getElementById('__next') ||
            document.querySelector('main') ||
            document.querySelector('[role="main"]') ||
            document.body;

          if (container) {
            observer.observe(container, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeOldValue: false,
              characterData: true,
              characterDataOldValue: false,
              attributeFilter: ['disabled', 'aria-invalid', 'aria-busy', 'aria-live', 'class', 'hidden'],
            });
          }

          window.__veraxMutationObserver = observer;
        }

        // Return current summary and reset
        const currentSummary = { ...window.__veraxMutationSummary };
        window.__veraxMutationSummary = {
          nodesAdded: 0,
          nodesRemoved: 0,
          attributeChanges: {
            disabled: 0,
            'aria-invalid': 0,
            'aria-busy': 0,
            'aria-live': 0,
            class: 0,
            hidden: 0,
          },
          textChanges: [],
        };

        return currentSummary;
      },
      { maxSnippets: maxTextSnippets, snippetLen: snippetLength }
    );

    // Redact text snippets (basic redaction)
    summary.textChanges = summary.textChanges.map((tc) => ({
      ...tc,
      text: redactTextSnippet(tc.text),
    }));

    const timeProvider = getTimeProvider();

    return {
      ...summary,
      timestamp: timeProvider.now(),
    };
  } catch (error) {
    // Never crash observation
    return {
      nodesAdded: 0,
      nodesRemoved: 0,
      attributeChanges: {},
      textChanges: [],
      error: error.message,
    };
  }
}

/**
 * Basic text snippet redaction (email, token patterns)
 */
export function redactTextSnippet(text) {
  if (!text) return text;

  // Redact email addresses
  let redacted = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

  // Redact potential tokens (long alphanumeric strings)
  redacted = redacted.replace(/\b[A-Za-z0-9]{32,}\b/g, '[TOKEN]');

  // Redact credit card patterns
  redacted = redacted.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');

  return redacted;
}

/**
 * Analyze mutation summary to determine if meaningful UI change occurred
 * Returns: { meaningful, reason }
 */
export function analyzeMutationSummary(summary) {
  if (!summary) {
    return { meaningful: false, reason: 'no-summary' };
  }

  const { nodesAdded, nodesRemoved, attributeChanges, textChanges } = summary;

  // Substantial node changes
  if (nodesAdded > 5 || nodesRemoved > 5) {
    return { meaningful: true, reason: 'substantial-dom-change' };
  }

  // Key accessibility attribute changes
  const totalAttrChanges = Object.values(attributeChanges).reduce((sum, count) => sum + count, 0);
  if (totalAttrChanges > 2) {
    return { meaningful: true, reason: 'accessibility-state-change' };
  }

  // Text content changes
  if (textChanges.length > 0) {
    return { meaningful: true, reason: 'text-content-change' };
  }

  // Minor changes detected but not substantial
  if (nodesAdded > 0 || nodesRemoved > 0 || totalAttrChanges > 0) {
    return { meaningful: false, reason: 'minor-change' };
  }

  return { meaningful: false, reason: 'no-change' };
}

/**
 * Reset mutation tracking state
 */
export async function resetMutationTracking(page) {
  try {
    await page.evaluate(() => {
      if (window.__veraxMutationObserver) {
        window.__veraxMutationObserver.disconnect();
        delete window.__veraxMutationObserver;
      }
      delete window.__veraxMutationSummary;
    });
  } catch {
    // Ignore errors
  }
}
