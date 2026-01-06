import { generateSelector } from './selector-generator.js';
import { isExternalHref } from './domain-boundary.js';

const MAX_INTERACTIONS_PER_PAGE = 30;

function computePriority(candidate, viewportHeight) {
  const hasAboveFold = candidate.boundingAvailable && typeof viewportHeight === 'number' && candidate.boundingY < viewportHeight;
  const isFooter = candidate.boundingAvailable && typeof viewportHeight === 'number' && candidate.boundingY >= viewportHeight;
  const isInternalLink = candidate.type === 'link' && candidate.href && candidate.href !== '#' && (!candidate.isExternal || candidate.href.startsWith('/'));

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

export async function discoverInteractions(page, baseOrigin) {
  const currentUrl = page.url();
  const interactions = [];
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
      const selector = await generateSelector(submitButton);
      const selectorKey = `form:${selector}`;
      
      if (!seenElements.has(selectorKey)) {
        seenElements.add(selectorKey);
        const label = await extractLabel(submitButton);
        const tagName = await submitButton.evaluate(el => el.tagName.toLowerCase());
        const id = await submitButton.getAttribute('id');
        const text = await submitButton.evaluate(el => el.textContent?.trim() || el.getAttribute('value') || '');
        
        allInteractions.push({
          type: 'form',
          selector: selector,
          label: label || text,
          element: submitButton,
          tagName: tagName,
          id: id || '',
          text: text,
          dataHref: '',
          dataTestId: '',
          isRoleButton: false
        });
      }
    }
  }

  const viewport = page.viewportSize();
  const viewportHeight = viewport ? viewport.height : undefined;

  for (const item of allInteractions) {
    try {
      const box = await item.element.boundingBox();
      if (box) {
        item.boundingY = box.y;
        item.boundingAvailable = true;
      }
    } catch (error) {
      item.boundingAvailable = false;
    }
    item.priority = computePriority(item, viewportHeight);
  }

  const sorted = sortCandidates(allInteractions);
  const capped = sorted.length > MAX_INTERACTIONS_PER_PAGE;
  const selected = sorted.slice(0, MAX_INTERACTIONS_PER_PAGE);

  const coverage = {
    candidatesDiscovered: sorted.length,
    candidatesSelected: selected.length,
    cap: MAX_INTERACTIONS_PER_PAGE,
    capped
  };
  
  return {
    interactions: selected.map(item => ({
      type: item.type,
      selector: item.selector,
      label: item.label,
      element: item.element,
      isExternal: item.isExternal || false
    })),
    coverage
  };
}

