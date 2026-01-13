import { generateSelector } from './selector-generator.js';
import { isExternalHref } from './domain-boundary.js';
import { DEFAULT_SCAN_BUDGET } from '../shared/scan-budget.js';

function computePriority(candidate, viewportHeight) {
  const hasAboveFold = candidate.boundingAvailable && typeof viewportHeight === 'number' && candidate.boundingY < viewportHeight;
  const isFooter = candidate.boundingAvailable && typeof viewportHeight === 'number' && candidate.boundingY >= viewportHeight;
  const isInternalLink = candidate.type === 'link' && candidate.href && candidate.href !== '#' && (!candidate.isExternal || candidate.href.startsWith('/'));

  if (candidate.type === 'file_upload') return 2;
  if (candidate.type === 'keyboard') return 2.5;
  if (candidate.type === 'hover') return 3;
  if (candidate.type === 'login') return 1;
  if (candidate.type === 'logout') return 1.5;
  if (candidate.type === 'auth_guard') return 1.8;
  if (candidate.type === 'form') return 1;
  if (candidate.type === 'link' && isFooter) return 6;
  if (isInternalLink) return 2;
  if (candidate.type === 'button' && (candidate.dataHref || (candidate.isRoleButton && (candidate.id || candidate.dataTestId)))) return 3;
  if (hasAboveFold) return 4;
  if (candidate.type === 'button') return 5;
  if (isFooter) return 6;
  return 7;
}

function sortCandidates(candidates) {
  return candidates.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const selectorCompare = (a.selector || '').localeCompare(b.selector || '');
    if (selectorCompare !== 0) return selectorCompare;
    return (a.label || '').localeCompare(b.label || '');
  });
}

async function isLanguageToggle(elementHandle) {
  if (!elementHandle) return false;
  
  try {
    const text = await elementHandle.evaluate(el => el.textContent?.trim() || '');
    const label = await elementHandle.evaluate(el => el.getAttribute('aria-label') || '');
    const combined = (text + ' ' + label).toLowerCase();
    
    const languagePatterns = [
      /^(en|de|fr|es|it|pt|ru|zh|ja|ko|ar|he)$/i,
      /\blanguage\b/i,
      /\blang\b/i
    ];
    
    return languagePatterns.some(pattern => pattern.test(combined));
  } catch (error) {
    return false;
  }
}

async function extractLabel(element) {
  try {
    const innerText = await element.evaluate(el => el.innerText?.trim() || '');
    if (innerText) return innerText.substring(0, 100);
    
    const ariaLabel = await element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim().substring(0, 100);
    
    const title = await element.getAttribute('title');
    if (title && title.trim()) return title.trim().substring(0, 100);
    
    return '';
  } catch (error) {
    return '';
  }
}

export async function discoverInteractions(page, baseOrigin, scanBudget = DEFAULT_SCAN_BUDGET) {
  const currentUrl = page.url();
  const seenElements = new Set();
  
  const allInteractions = [];
  
  const links = await page.locator('a[href]').all();
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      const isExternal = isExternalHref(href, baseOrigin, currentUrl);
      const selector = await generateSelector(link);
      const selectorKey = `link:${selector}`;
      
      if (!seenElements.has(selectorKey)) {
        seenElements.add(selectorKey);
        const label = await extractLabel(link);
        const tagName = await link.evaluate(el => el.tagName.toLowerCase());
        const id = await link.getAttribute('id');
        const text = await link.evaluate(el => el.textContent?.trim() || '');
        
        allInteractions.push({
          type: 'link',
          selector: selector,
          label: label,
          element: link,
          tagName: tagName,
          id: id || '',
          text: text,
          isExternal: isExternal,
          href: href
        });
      }
    }
  }
  
  const buttons = await page.locator('button:not([disabled])').all();
  for (const button of buttons) {
    const selector = await generateSelector(button);
    const selectorKey = `button:${selector}`;
    
    if (!seenElements.has(selectorKey)) {
      seenElements.add(selectorKey);
      const label = await extractLabel(button);
      const elementHandle = await button.elementHandle();
      const isLangToggle = elementHandle ? await isLanguageToggle(elementHandle) : false;
      const tagName = await button.evaluate(el => el.tagName.toLowerCase());
      const id = await button.getAttribute('id');
      const text = await button.evaluate(el => el.textContent?.trim() || '');
      const dataHref = await button.getAttribute('data-href');
      const dataTestId = await button.getAttribute('data-testid');
      const dataDanger = await button.getAttribute('data-danger');
      const dataDestructive = await button.getAttribute('data-destructive');
      
      allInteractions.push({
        type: isLangToggle ? 'toggle' : 'button',
        selector: selector,
        label: label,
        element: button,
        tagName: tagName,
        id: id || '',
        text: text,
        dataHref: dataHref || '',
        dataTestId: dataTestId || '',
        dataDanger: dataDanger !== null,
        dataDestructive: dataDestructive !== null,
        isRoleButton: false
      });
    }
  }
  
  const submitInputs = await page.locator('input[type="submit"]:not([disabled]), input[type="button"]:not([disabled])').all();
  for (const input of submitInputs) {
    const selector = await generateSelector(input);
    const selectorKey = `input:${selector}`;
    
    if (!seenElements.has(selectorKey)) {
      seenElements.add(selectorKey);
      const label = await extractLabel(input);
      const tagName = await input.evaluate(el => el.tagName.toLowerCase());
      const id = await input.getAttribute('id');
      const text = await input.getAttribute('value') || '';
      const dataHref = await input.getAttribute('data-href');
      const dataTestId = await input.getAttribute('data-testid');
      
      allInteractions.push({
        type: 'button',
        selector: selector,
        label: label || text,
        element: input,
        tagName: tagName,
        id: id || '',
        text: text,
        dataHref: dataHref || '',
        dataTestId: dataTestId || '',
        isRoleButton: false
      });
    }
  }
  
  const roleButtons = await page.locator('[role="button"]:not([disabled])').all();
  for (const roleButton of roleButtons) {
    const selector = await generateSelector(roleButton);
    const selectorKey = `role-button:${selector}`;
    
    if (!seenElements.has(selectorKey)) {
      seenElements.add(selectorKey);
      const label = await extractLabel(roleButton);
      const tagName = await roleButton.evaluate(el => el.tagName.toLowerCase());
      const id = await roleButton.getAttribute('id');
      const text = await roleButton.evaluate(el => el.textContent?.trim() || '');
      const dataHref = await roleButton.getAttribute('data-href');
      const dataTestId = await roleButton.getAttribute('data-testid');
      
      allInteractions.push({
        type: 'button',
        selector: selector,
        label: label,
        element: roleButton,
        tagName: tagName,
        id: id || '',
        text: text,
        dataHref: dataHref || '',
        dataTestId: dataTestId || '',
        isRoleButton: true
      });
    }
  }
  
  const forms = await page.locator('form').all();
  for (const form of forms) {
    const submitButton = form.locator('button[type="submit"], input[type="submit"]').first();
    if (await submitButton.count() > 0) {
      const formAction = await form.getAttribute('action');
      const selector = await generateSelector(submitButton);
      const selectorKey = `form:${selector}`;
      
      // Check if this is a login form (has password input)
      const hasPasswordInput = await form.locator('input[type="password"]').count() > 0;
      const formText = await form.evaluate(el => el.textContent?.toLowerCase() || '');
      const isLoginForm = hasPasswordInput || 
                         /login|signin|sign.in|authenticate/i.test(formText) ||
                         /email|username|user/i.test(formText) && hasPasswordInput;
      
      if (!seenElements.has(selectorKey)) {
        seenElements.add(selectorKey);
        const label = await extractLabel(submitButton);
        const tagName = await submitButton.evaluate(el => el.tagName.toLowerCase());
        const id = await submitButton.getAttribute('id');
        const text = await submitButton.evaluate(el => el.textContent?.trim() || el.getAttribute('value') || '');
        
        allInteractions.push({
          type: isLoginForm ? 'login' : 'form',
          selector: selector,
          label: label || text,
          element: submitButton,
          tagName: tagName,
          id: id || '',
          text: text,
          dataHref: '',
          dataTestId: '',
          isRoleButton: false,
          formAction: formAction || '',
          hasPasswordInput: hasPasswordInput
        });
      }
    }
  }
  
  // Detect logout actions (buttons/links with logout/signout patterns) - check existing buttons/links first
  for (const item of allInteractions) {
    if (item.type === 'button' || item.type === 'link') {
      const text = (item.text || '').trim().toLowerCase();
      const label = (item.label || '').trim().toLowerCase();
      
      const isLogout = /^(logout|sign\s*out|signout|log\s*out)$/i.test(text) ||
                       /^(logout|sign\s*out|signout|log\s*out)$/i.test(label) ||
                       (text.includes('logout') || text.includes('sign out') || text.includes('signout'));
      
      if (isLogout) {
        const selectorKey = `logout:${item.selector}`;
        if (!seenElements.has(selectorKey)) {
          seenElements.add(selectorKey);
          allInteractions.push({
            type: 'logout',
            selector: item.selector,
            label: item.label,
            element: item.element,
            tagName: item.tagName,
            id: item.id,
            text: item.text,
            dataHref: item.dataHref || '',
            dataTestId: item.dataTestId || '',
            isRoleButton: item.isRoleButton || false
          });
        }
      }
    }
  }

  // Detect potential protected routes by looking for links/buttons with typical protected path patterns
  const internalLinks = await page.locator('a[href]:not([href*="://"])').all();
  for (const link of internalLinks) {
    const href = await link.getAttribute('href');
    const text = await link.evaluate(el => el.textContent?.trim() || '');
    const id = await link.getAttribute('id') || '';
    const combined = `${href} ${text} ${id}`.toLowerCase();
    
    const isProtectedPath = /admin|dashboard|profile|account|settings|private|protected|secure/i.test(href || '') ||
                           /admin|dashboard|profile|account|settings/i.test(combined);
    
    if (isProtectedPath && href && !href.startsWith('#')) {
      const selector = await generateSelector(link);
      const selectorKey = `auth_guard:${selector}`;
      
      if (!seenElements.has(selectorKey)) {
        seenElements.add(selectorKey);
        const label = await extractLabel(link);
        const tagName = await link.evaluate(el => el.tagName.toLowerCase());
        
        allInteractions.push({
          type: 'auth_guard',
          selector: selector,
          label: label || text,
          element: link,
          tagName: tagName,
          id: id || '',
          text: text,
          href: href || '',
          dataHref: '',
          dataTestId: '',
          isRoleButton: false
        });
      }
    }
  }

  const fileInputs = await page.locator('input[type="file"]:not([disabled])').all();
  for (const fileInput of fileInputs) {
    const selector = await generateSelector(fileInput);
    const selectorKey = `file:${selector}`;

    if (!seenElements.has(selectorKey)) {
      seenElements.add(selectorKey);
      const label = await extractLabel(fileInput);
      const tagName = await fileInput.evaluate(el => el.tagName.toLowerCase());
      const id = await fileInput.getAttribute('id');
      const accept = await fileInput.getAttribute('accept');

      allInteractions.push({
        type: 'file_upload',
        selector,
        label: label || 'File upload',
        element: fileInput,
        tagName,
        id: id || '',
        text: accept || '',
        dataHref: '',
        dataTestId: '',
        isRoleButton: false
      });
    }
  }

  const hoverableCandidates = await page.locator('[aria-haspopup], [data-hover], [role="menu"], [role="menuitem"]').all();
  for (const hoverEl of hoverableCandidates) {
    try {
      const selector = await generateSelector(hoverEl);
      const selectorKey = `hover:${selector}`;
      
      if (!seenElements.has(selectorKey)) {
        seenElements.add(selectorKey);
        const label = await extractLabel(hoverEl);
        const tagName = await hoverEl.evaluate(el => el.tagName.toLowerCase());
        const id = await hoverEl.getAttribute('id');
        const text = await hoverEl.evaluate(el => el.textContent?.trim() || '');
        const ariaHasPopup = await hoverEl.getAttribute('aria-haspopup') || '';
        const role = await hoverEl.getAttribute('role') || '';
        const dataHover = await hoverEl.getAttribute('data-hover') || '';
        
        const box = await hoverEl.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          allInteractions.push({
            type: 'hover',
            selector: selector,
            label: label || text || role || 'hoverable',
            element: hoverEl,
            tagName: tagName,
            id: id || '',
            text: text,
            ariaHasPopup: ariaHasPopup,
            role: role,
            dataHover: dataHover,
            dataHref: '',
            dataTestId: '',
            isRoleButton: false
          });
        }
      }
    } catch (error) {
      // Skip if element is invalid
    }
  }

  const keyboardFocusableElements = await page.locator('button, a[href], input[type="submit"], input[type="button"]').all();
  for (const focusableEl of keyboardFocusableElements) {
    try {
      const selector = await generateSelector(focusableEl);
      const selectorKey = `keyboard:${selector}`;
      
      if (!seenElements.has(selectorKey)) {
        seenElements.add(selectorKey);
        const label = await extractLabel(focusableEl);
        const tagName = await focusableEl.evaluate(el => el.tagName.toLowerCase());
        const id = await focusableEl.getAttribute('id');
        const text = await focusableEl.evaluate(el => el.textContent?.trim() || el.value || '');
        
        const box = await focusableEl.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          allInteractions.push({
            type: 'keyboard',
            selector: selector,
            label: label || text,
            element: focusableEl,
            tagName: tagName,
            id: id || '',
            text: text,
            dataHref: '',
            dataTestId: '',
            isRoleButton: false
          });
        }
      }
    } catch (error) {
      // Skip if element is invalid
    }
  }


  const viewport = page.viewportSize();
  const viewportHeight = viewport ? viewport.height : undefined;

  for (const item of allInteractions) {
    try {
      const box = await item.element.boundingBox();
      if (box) {
        // @ts-expect-error - Adding runtime properties to interaction object
        item.boundingY = box.y;
        // @ts-expect-error - Adding runtime properties to interaction object
        item.boundingAvailable = true;
      }
    } catch (error) {
      // @ts-expect-error - Adding runtime properties to interaction object
      item.boundingAvailable = false;
    }
    // @ts-expect-error - Adding runtime properties to interaction object
    item.priority = computePriority(item, viewportHeight);
  }

  const sorted = sortCandidates(allInteractions);
  const capped = sorted.length > scanBudget.maxInteractionsPerPage;
  const selected = sorted.slice(0, scanBudget.maxInteractionsPerPage);

  const coverage = {
    candidatesDiscovered: sorted.length,
    candidatesSelected: selected.length,
    cap: scanBudget.maxInteractionsPerPage,
    capped
  };
  
  return {
    interactions: selected.map(item => ({
      type: item.type,
      selector: item.selector,
      label: item.label,
      element: item.element,
      isExternal: item.isExternal || false,
      href: item.href,
      text: item.text
    })),
    coverage
  };
}

/**
 * Discover ALL interactions on a page (no priority cap).
 * Used for full-site coverage traversal.
 */
export async function discoverAllInteractions(page, baseOrigin, _scanBudget = DEFAULT_SCAN_BUDGET) {
  const currentUrl = page.url();
  const seenElements = new Set();
  const allInteractions = [];
  
  const links = await page.locator('a[href]').all();
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      const isExternal = isExternalHref(href, baseOrigin, currentUrl);
      const selector = await generateSelector(link);
      const selectorKey = `link:${selector}`;
      
      if (!seenElements.has(selectorKey)) {
        seenElements.add(selectorKey);
        const label = await extractLabel(link);
        const text = await link.evaluate(el => el.textContent?.trim() || '');
        
        allInteractions.push({
          type: 'link',
          selector: selector,
          label: label,
          element: link,
          isExternal: isExternal,
          href: href,
          text: text
        });
      }
    }
  }
  
  const buttons = await page.locator('button:not([disabled])').all();
  for (const button of buttons) {
    const selector = await generateSelector(button);
    const selectorKey = `button:${selector}`;
    
    if (!seenElements.has(selectorKey)) {
      seenElements.add(selectorKey);
      const label = await extractLabel(button);
      const elementHandle = await button.elementHandle();
      const isLangToggle = elementHandle ? await isLanguageToggle(elementHandle) : false;
      const text = await button.evaluate(el => el.textContent?.trim() || '');
      const dataHref = await button.getAttribute('data-href');
      
      allInteractions.push({
        type: isLangToggle ? 'toggle' : 'button',
        selector: selector,
        label: label,
        element: button,
        text: text,
        dataHref: dataHref || ''
      });
    }
  }
  
  const submitInputs = await page.locator('input[type="submit"]:not([disabled]), input[type="button"]:not([disabled])').all();
  for (const input of submitInputs) {
    const selector = await generateSelector(input);
    const selectorKey = `input:${selector}`;
    
    if (!seenElements.has(selectorKey)) {
      seenElements.add(selectorKey);
      const label = await extractLabel(input);
      const text = await input.getAttribute('value') || '';
      const dataHref = await input.getAttribute('data-href');
      
      allInteractions.push({
        type: 'button',
        selector: selector,
        label: label || text,
        element: input,
        text: text,
        dataHref: dataHref || ''
      });
    }
  }
  
  const roleButtons = await page.locator('[role="button"]:not([disabled])').all();
  for (const roleButton of roleButtons) {
    const selector = await generateSelector(roleButton);
    const selectorKey = `role-button:${selector}`;
    
    if (!seenElements.has(selectorKey)) {
      seenElements.add(selectorKey);
      const label = await extractLabel(roleButton);
      const text = await roleButton.evaluate(el => el.textContent?.trim() || '');
      const dataHref = await roleButton.getAttribute('data-href');
      
      allInteractions.push({
        type: 'button',
        selector: selector,
        label: label,
        element: roleButton,
        text: text,
        dataHref: dataHref || ''
      });
    }
  }
  
  const forms = await page.locator('form').all();
  for (const form of forms) {
    const submitButton = form.locator('button[type="submit"], input[type="submit"]').first();
    if (await submitButton.count() > 0) {
      const formAction = await form.getAttribute('action');
      const selector = await generateSelector(submitButton);
      const selectorKey = `form:${selector}`;
      
      if (!seenElements.has(selectorKey)) {
        seenElements.add(selectorKey);
        const label = await extractLabel(submitButton);
        const text = await submitButton.evaluate(el => el.textContent?.trim() || el.getAttribute('value') || '');
        
        allInteractions.push({
          type: 'form',
          selector: selector,
          label: label || text,
          element: submitButton,
          text: text,
          formAction: formAction || ''
        });
      }
    }
  }
  
  // Prioritize non-navigating interactions so navigation doesn't starve buttons/forms
  const priority = {
    form: 0,
    button: 1,
    toggle: 1,
    link: 2
  };
  const ordered = allInteractions.sort((a, b) => {
    const pa = priority[a.type] ?? 3;
    const pb = priority[b.type] ?? 3;
    if (pa !== pb) return pa - pb;
    return (a.selector || '').localeCompare(b.selector || '');
  });
  
  // Return ALL interactions (no priority cap)
  return {
    interactions: ordered.map(item => {
      const mapped = {
        type: item.type,
        selector: item.selector,
        label: item.label,
        element: item.element,
        isExternal: item.isExternal || false,
        href: item.href,
        text: item.text,
        dataHref: item.dataHref,
        // @ts-expect-error - dataDanger and dataDestructive are optional runtime properties on interaction objects
        dataDanger: item.dataDanger || false,
        // @ts-expect-error - dataDestructive is an optional runtime property on interaction objects
        dataDestructive: item.dataDestructive || false
      };
      // hasPasswordInput only exists on form types
      if (item.type === 'form' || item.type === 'login') {
        // @ts-expect-error - hasPasswordInput is only on form/login types at runtime
        mapped.hasPasswordInput = item.hasPasswordInput || false;
      }
      return mapped;
    }),
    coverage: {
      candidatesDiscovered: allInteractions.length,
      candidatesSelected: allInteractions.length,
      cap: Infinity,
      capped: false
    }
  };
}

