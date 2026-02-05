import { getTimeProvider } from '../support/time-provider.js';

/**
 * PHASE 3: Interaction Intent Record
 * Captures observable facts about user interactions at runtime
 */

/**
 * Create an Interaction Intent Record
 * Captures structural facts ONLY (no selectors, no text, no HTML blobs).
 * 
 * @param {Object} options
 * @returns {Object} Interaction intent record
 */
export function createInteractionIntentRecord(options = {}) {
  const timeProvider = getTimeProvider();
  return {
    // Element structure (minimal)
    tagName: options.tagName || 'unknown',
    role: options.role || null,
    type: options.type || null,
    
    // State
    disabled: options.disabled === true,
    ariaDisabled: options.ariaDisabled === true,
    visible: options.visible === true,
    boundingBox: {
      // Keep only width/height (x/y are unnecessary and can be sensitive)
      width: options.boundingBox?.width || 0,
      height: options.boundingBox?.height || 0,
    },

    // Container tag (coarse context; not a selector)
    containerTagName: options.containerTagName || null,

    // Link semantics (do NOT store the URL value)
    href: options.href || { present: false, kind: null },

    // Form semantics (no action URL)
    form: options.form || { associated: false, isSubmitControl: false, method: null, hasAction: false },

    // Event handler semantics (conservative, but deterministic)
    hasOnClick: options.hasOnClick === true,

    // Toggle semantics (minimal)
    aria: options.aria || { expanded: null, pressed: null, checked: null },
    control: options.control || { checked: null },

    // Optional after-snapshot/delta (used for toggle intent contracts)
    after: options.after || null,
    delta: options.delta || null,
    
    // Event context
    eventType: options.eventType || 'click', // click, submit, change, etc.
    
    // Accessibility
    ariaLabel: options.ariaLabel || null,
    ariaLive: options.ariaLive || null,
    
    // Nesting context
    nestedInButton: options.nestedInButton === true,
    nestedInLink: options.nestedInLink === true,
    
    // Timestamp of capture
    capturedAt: options.capturedAt || timeProvider.iso(),
  };
}

function normalizeHrefKind(rawHref) {
  if (typeof rawHref !== 'string') {
    return { present: false, kind: null };
  }

  const href = rawHref.trim();
  if (!href) {
    return { present: false, kind: null };
  }

  if (href.startsWith('#')) {
    return { present: true, kind: 'hash_only' };
  }

  if (href === '#' || href.endsWith('#')) {
    return { present: true, kind: 'noop_hash' };
  }

  if (href.toLowerCase().startsWith('javascript:')) {
    return { present: true, kind: 'noop_js' };
  }

  if (href.startsWith('/')) return { present: true, kind: 'relative' };
  if (href.startsWith('http://') || href.startsWith('https://')) return { present: true, kind: 'absolute' };
  return { present: true, kind: 'other' };
}

function normalizeAriaTriState(value) {
  if (value === null || value === undefined) return null;
  const v = String(value).toLowerCase();
  if (v === 'true') return 'true';
  if (v === 'false') return 'false';
  if (v === 'mixed') return 'mixed';
  return null;
}

function buildToggleDelta(before = null, after = null) {
  if (!before || !after) return null;

  const beforeAria = before.aria || {};
  const afterAria = after.aria || {};

  const beforeControl = before.control || {};
  const afterControl = after.control || {};

  return {
    ariaExpandedChanged: beforeAria.expanded !== afterAria.expanded,
    ariaPressedChanged: beforeAria.pressed !== afterAria.pressed,
    ariaCheckedChanged: beforeAria.checked !== afterAria.checked,
    controlCheckedChanged: beforeControl.checked !== afterControl.checked,
  };
}

/**
 * Extract Interaction Intent Record from DOM element
 * Called during interaction execution in page context
 * 
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {import('playwright').ElementHandle} element - The element that was interacted with
 * @returns {Promise<Object|null>} Interaction intent record
 */
export async function extractIntentRecordFromElement(page, element) {
  if (!page || !element) {
    return null;
  }

  try {
    const record = await page.evaluate((el) => {
      if (!el) return null;
      
      // Cast to HTMLElement for property access
      const element = /** @type {HTMLElement} */ (el);

      const rect = element.getBoundingClientRect();
      const boundingBox = {
        width: rect.width,
        height: rect.height,
      };

      // Get visibility
      const style = window.getComputedStyle(element);
      const visible = style.display !== 'none' && 
                      style.visibility !== 'hidden' && 
                      style.opacity !== '0' &&
                      rect.width > 0 && 
                      rect.height > 0;

      // Get container (closest nav/header/footer/aside)
      let container = element;
      let containerTag = null;
      while (container) {
        const tag = container.tagName.toLowerCase();
        if (['nav', 'header', 'footer', 'aside', 'main'].includes(tag)) {
          containerTag = tag;
          break;
        }
        container = container.parentElement;
      }

      // Form association (do not capture action URL)
      const formEl = element.closest('form');
      const associated = !!formEl;
      const formMethod = formEl ? (formEl.getAttribute('method') || '').toLowerCase() : null;
      const formHasAction = formEl ? formEl.hasAttribute('action') : false;

      // Determine if this element is a submit control
      const tagName = element.tagName.toUpperCase();
      const typeAttr = (element.getAttribute('type') || '').toLowerCase();
      const isSubmitControl =
        (tagName === 'BUTTON' && (typeAttr === 'submit' || typeAttr === '')) ||
        (tagName === 'INPUT' && typeAttr === 'submit');

      // Link semantics (store only kind)
      const rawHrefAttr = element.getAttribute('href');

      // Toggle semantics
      const ariaExpanded = element.getAttribute('aria-expanded');
      const ariaPressed = element.getAttribute('aria-pressed');
      const ariaChecked = element.getAttribute('aria-checked');
      const checked = (/** @type {any} */ (element)).checked;
      const controlChecked = typeof checked === 'boolean' ? checked : null;

      return {
        tagName,
        role: element.getAttribute('role'),
        type: element.getAttribute('type'),
        disabled: /** @type {any} */ (element).disabled === true || element.hasAttribute('disabled'),
        ariaDisabled: element.getAttribute('aria-disabled') === 'true',
        visible,
        boundingBox,
        containerTagName: containerTag,
        hasOnClick: !!element.onclick,
        hrefAttr: rawHrefAttr,
        form: {
          associated,
          isSubmitControl,
          method: formMethod || null,
          hasAction: formHasAction === true,
        },
        aria: {
          expanded: ariaExpanded,
          pressed: ariaPressed,
          checked: ariaChecked,
        },
        control: {
          checked: controlChecked,
        }
      };
    }, element);

    if (!record) return null;

    // Add event type (default click, could be submit for forms)
    // @ts-expect-error - element.type may not exist on all element types
    const eventType = element.tagName === 'FORM' || element.type === 'submit' ? 'submit' : 'click';

    const href = normalizeHrefKind(record.hrefAttr);
    const aria = {
      expanded: normalizeAriaTriState(record.aria?.expanded),
      pressed: normalizeAriaTriState(record.aria?.pressed),
      checked: normalizeAriaTriState(record.aria?.checked),
    };

    /** @type {{ associated?: boolean, isSubmitControl?: boolean, method?: string | null, hasAction?: boolean }} */
    const normalizedForm = record.form || {};
    const form = {
      associated: normalizedForm.associated === true,
      isSubmitControl: normalizedForm.isSubmitControl === true,
      method: typeof normalizedForm.method === 'string' && normalizedForm.method.length > 0
        ? normalizedForm.method.toUpperCase()
        : null,
      hasAction: normalizedForm.hasAction === true,
    };

    const control = {
      checked: (typeof record.control?.checked === 'boolean') ? record.control.checked : null,
    };

    return createInteractionIntentRecord({
      ...record,
      href,
      form,
      aria,
      control,
      eventType,
      capturedAt: getTimeProvider().iso(),
    });
  } catch (error) {
    // Graceful degradation: return null if extraction fails
    return null;
  }
}

/**
 * Best-effort: extract only the after-state fields needed for toggle contracts.
 *
 * @param {import('playwright').Page} page
 * @param {import('playwright').ElementHandle} element
 * @returns {Promise<Object|null>} { aria, control }
 */
export async function extractAfterSnapshotFromElement(page, element) {
  if (!page || !element) return null;
  try {
    const after = await page.evaluate((el) => {
      if (!el) return null;
      const element = /** @type {HTMLElement} */ (el);
      const ariaExpanded = element.getAttribute('aria-expanded');
      const ariaPressed = element.getAttribute('aria-pressed');
      const ariaChecked = element.getAttribute('aria-checked');
      const checked = (/** @type {any} */ (element)).checked;
      const controlChecked = typeof checked === 'boolean' ? checked : null;
      return {
        aria: {
          expanded: ariaExpanded,
          pressed: ariaPressed,
          checked: ariaChecked,
        },
        control: {
          checked: controlChecked,
        }
      };
    }, element);

    if (!after) return null;

    return {
      aria: {
        expanded: normalizeAriaTriState(after.aria?.expanded),
        pressed: normalizeAriaTriState(after.aria?.pressed),
        checked: normalizeAriaTriState(after.aria?.checked),
      },
      control: {
        checked: (typeof after.control?.checked === 'boolean') ? after.control.checked : null,
      }
    };
  } catch {
    return null;
  }
}

/**
 * Attach after-snapshot and delta to an existing intent record (pure).
 *
 * @param {Object} beforeRecord
 * @param {Object|null} afterSnapshot
 * @returns {Object}
 */
export function withAfterSnapshot(beforeRecord, afterSnapshot) {
  if (!beforeRecord || typeof beforeRecord !== 'object') return beforeRecord;
  if (!afterSnapshot || typeof afterSnapshot !== 'object') return beforeRecord;

  const after = {
    aria: afterSnapshot.aria || { expanded: null, pressed: null, checked: null },
    control: afterSnapshot.control || { checked: null },
  };

  const delta = buildToggleDelta(beforeRecord, after);
  return {
    ...beforeRecord,
    after,
    delta,
  };
}
