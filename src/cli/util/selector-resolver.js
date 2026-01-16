/**
 * Selector Resolver
 * Finds and validates selectors for extracted promises
 */

/**
 * Resolve a selector to an actual element
 * Returns {found: boolean, selector: string, reason?: string}
 */
export async function resolveSelector(page, promise) {
  // Try promise.selector first if it exists
  if (promise.selector) {
    const resolved = await trySelectorVariants(page, promise.selector);
    if (resolved.found) {
      return resolved;
    }
  }
  
  // Try to derive selector from promise details
  if (promise.category === 'button') {
    return await resolveButtonSelector(page, promise);
  }
  
  if (promise.category === 'form') {
    return await resolveFormSelector(page, promise);
  }
  
  if (promise.category === 'validation') {
    return await resolveValidationSelector(page, promise);
  }
  
  if (promise.type === 'navigation') {
    return await resolveNavigationSelector(page, promise);
  }
  
  return {
    found: false,
    selector: null,
    reason: 'unsupported-promise-type',
  };
}

/**
 * Try multiple selector variants
 */
async function trySelectorVariants(page, baseSelector) {
  const variants = [
    baseSelector,
    baseSelector.replace(/button:contains/, 'button:has-text'),
    baseSelector.replace(/"/g, "'"),
  ];
  
  for (const selector of variants) {
    try {
      const count = await page.locator(selector).count();
      if (count === 1) {
        return { found: true, selector };
      }
      if (count > 1) {
        return { found: false, selector, reason: 'ambiguous-selector' };
      }
    } catch (e) {
      // Try next variant
    }
  }
  
  return { found: false, selector: baseSelector, reason: 'not-found' };
}

/**
 * Resolve button selector
 */
async function resolveButtonSelector(page, promise) {
  // First try the provided selector
  if (promise.selector) {
    const result = await trySelectorVariants(page, promise.selector);
    if (result.found) return result;
  }
  
  // Try all button variants
  const selectors = [
    'button[onClick]',
    'button',
    '[role="button"][onClick]',
    '[role="button"]',
  ];
  
  for (const selector of selectors) {
    try {
      const count = await page.locator(selector).count();
      if (count === 1) {
        return { found: true, selector };
      }
      if (count > 0) {
        // Multiple buttons - try to narrow down by content
        const buttons = await page.locator(selector).all();
        for (const btn of buttons) {
          const text = await btn.textContent();
          if (text && (text.includes('Save') || text.includes('Submit') || text.includes('Click'))) {
            const specific = `${selector}:has-text("${text.trim()}")`;
            const count = await page.locator(specific).count();
            if (count === 1) {
              return { found: true, selector: specific };
            }
          }
        }
      }
    } catch (e) {
      // Try next
    }
  }
  
  return { found: false, selector: null, reason: 'not-found' };
}

/**
 * Resolve form selector
 */
async function resolveFormSelector(page, promise) {
  if (promise.selector) {
    const result = await trySelectorVariants(page, promise.selector);
    if (result.found) return result;
  }
  
  const selectors = [
    'form[onSubmit]',
    'form',
  ];
  
  for (const selector of selectors) {
    try {
      const count = await page.locator(selector).count();
      if (count === 1) {
        return { found: true, selector };
      }
    } catch (e) {
      // Try next
    }
  }
  
  return { found: false, selector: null, reason: 'not-found' };
}

/**
 * Resolve validation selector (for required inputs)
 */
async function resolveValidationSelector(page, promise) {
  if (promise.selector) {
    const result = await trySelectorVariants(page, promise.selector);
    if (result.found) return result;
  }
  
  // Look for required inputs
  const selectors = [
    'input[required]',
    'textarea[required]',
    'select[required]',
  ];
  
  for (const selector of selectors) {
    try {
      const count = await page.locator(selector).count();
      if (count >= 1) {
        return { found: true, selector };
      }
    } catch (e) {
      // Try next
    }
  }
  
  return { found: false, selector: null, reason: 'not-found' };
}

/**
 * Resolve navigation selector (for anchor tags)
 */
async function resolveNavigationSelector(page, promise) {
  const targetPath = promise.promise.value;
  
  const selectors = [
    `a[href="${targetPath}"]`,
    `a[href*="${targetPath}"]`,
  ];
  
  for (const selector of selectors) {
    try {
      const count = await page.locator(selector).count();
      if (count === 1) {
        return { found: true, selector };
      }
    } catch (e) {
      // Try next
    }
  }
  
  return { found: false, selector: null, reason: 'not-found' };
}

/**
 * Find submit button in form
 */
export async function findSubmitButton(page, formSelector) {
  try {
    // Look for explicit submit button in form
    const submitBtn = await page.locator(`${formSelector} button[type="submit"]`).first();
    const count = await submitBtn.count();
    if (count > 0) {
      return submitBtn;
    }
    
    // Look for any button in form
    const btn = await page.locator(`${formSelector} button`).first();
    if (await btn.count() > 0) {
      return btn;
    }
  } catch (e) {
    // Fall through
  }
  
  return null;
}

/**
 * Check if element is clickable/visible
 */
export async function isElementInteractable(page, selector) {
  try {
    const element = page.locator(selector).first();
    const isVisible = await element.isVisible();
    const isEnabled = await element.isEnabled();
    return isVisible && isEnabled;
  } catch (e) {
    return false;
  }
}
