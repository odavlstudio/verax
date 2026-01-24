import { getTimeProvider } from '../support/time-provider.js';

/**
 * PHASE 3: Interaction Intent Record
 * Captures observable facts about user interactions at runtime
 */

/**
 * Create an Interaction Intent Record
 * Captures structural facts ONLY (no business logic inference)
 * 
 * @param {Object} options
 * @returns {Object} Interaction intent record
 */
export function createInteractionIntentRecord(options = {}) {
  const timeProvider = getTimeProvider();
  return {
    // Element structure
    tagName: options.tagName || 'unknown',
    role: options.role || null,
    type: options.type || null,
    className: options.className || null,
    id: options.id || null,
    
    // State
    disabled: options.disabled === true,
    ariaDisabled: options.ariaDisabled === true,
    visible: options.visible === true,
    
    // Positioning
    boundingBox: {
      x: options.boundingBox?.x || 0,
      y: options.boundingBox?.y || 0,
      width: options.boundingBox?.width || 0,
      height: options.boundingBox?.height || 0,
    },
    
    // DOM location
    selectorPath: options.selectorPath || [],
    containerTagName: options.containerTagName || null,
    
    // Link/Button semantics
    href: options.href || null,
    hasForm: options.hasForm === true,
    hasOnClick: options.hasOnClick === true,
    
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
    // Use page.evaluate to extract element details in page context
    const record = await page.evaluate((el) => {
      if (!el) return null;
      
      // Cast to HTMLElement for property access
      const element = /** @type {HTMLElement} */ (el);

      // Get bounding box
      const rect = element.getBoundingClientRect();
      const boundingBox = {
        x: rect.left,
        y: rect.top,
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

      // Get selector path (last 3 ancestors + self)
      const selectorPath = [];
      let current = element;
      let depth = 0;
      while (current && depth < 4) {
        const tag = current.tagName.toLowerCase();
        const id = current.id ? `#${current.id}` : '';
        const className = current.className ? `.${current.className.split(' ').join('.')}` : '';
        const selector = tag + id + className;
        selectorPath.unshift(selector);
        current = current.parentElement;
        depth++;
      }

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

      // Check nesting in link/button
      let nestedInButton = false;
      let nestedInLink = false;
      current = element.parentElement;
      while (current) {
        const tag = current.tagName.toLowerCase();
        if (tag === 'button') nestedInButton = true;
        if (tag === 'a') nestedInLink = true;
        current = current.parentElement;
      }

      return {
        tagName: element.tagName.toUpperCase(),
        role: element.getAttribute('role'),
        type: element.getAttribute('type'),
        className: element.className,
        id: element.id,
        disabled: /** @type {any} */ (element).disabled === true || element.hasAttribute('disabled'),
        ariaDisabled: element.getAttribute('aria-disabled') === 'true',
        visible,
        boundingBox,
        selectorPath,
        containerTagName: containerTag,
        href: /** @type {any} */ (element).href || null,
        hasForm: !!/** @type {any} */ (element).form,
        hasOnClick: !!element.onclick,
        ariaLabel: element.getAttribute('aria-label'),
        ariaLive: element.getAttribute('aria-live'),
        nestedInButton,
        nestedInLink,
      };
    }, element);

    if (!record) return null;

    // Add event type (default click, could be submit for forms)
    // @ts-expect-error - element.type may not exist on all element types
    const eventType = element.tagName === 'FORM' || element.type === 'submit' ? 'submit' : 'click';

    return createInteractionIntentRecord({
      ...record,
      eventType,
      capturedAt: getTimeProvider().iso(),
    });
  } catch (error) {
    // Graceful degradation: return null if extraction fails
    return null;
  }
}
