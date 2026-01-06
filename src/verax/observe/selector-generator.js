export async function generateSelector(locator) {
  try {
    const element = await locator.elementHandle();
    if (!element) return 'unknown';
    
    const id = await element.getAttribute('id');
    if (id && id.trim()) {
      return `#${id.trim()}`;
    }
    
    const dataTestId = await element.getAttribute('data-testid');
    if (dataTestId && dataTestId.trim()) {
      return `[data-testid="${dataTestId.trim()}"]`;
    }
    
    const name = await element.getAttribute('name');
    if (name && name.trim()) {
      const tag = await element.evaluate(el => el.tagName.toLowerCase());
      return `${tag}[name="${name.trim()}"]`;
    }
    
    const ariaLabel = await element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
      const tag = await element.evaluate(el => el.tagName.toLowerCase());
      return `${tag}[aria-label="${ariaLabel.trim()}"]`;
    }
    
    const tag = await element.evaluate(el => el.tagName.toLowerCase());
    const parent = await element.evaluateHandle(el => el.parentElement);
    
    if (parent && !parent.isDisposed()) {
      const parentTag = await parent.evaluate(el => el.tagName.toLowerCase());
      const parentId = await parent.getAttribute('id');
      
      if (parentId && parentId.trim()) {
        const siblings = await element.evaluate((el, t) => {
          const parent = el.parentElement;
          if (!parent) return 0;
          const children = Array.from(parent.children);
          return children.filter(c => c.tagName.toLowerCase() === t).indexOf(el);
        }, tag);
        
        if (siblings > 0) {
          return `#${parentId.trim()} > ${tag}:nth-of-type(${siblings + 1})`;
        }
        return `#${parentId.trim()} > ${tag}`;
      }
      
      if (parentTag) {
        const siblings = await element.evaluate((el, t) => {
          const parent = el.parentElement;
          if (!parent) return 0;
          const children = Array.from(parent.children);
          return children.filter(c => c.tagName.toLowerCase() === t).indexOf(el);
        }, tag);
        
        if (siblings > 0) {
          return `${parentTag} > ${tag}:nth-of-type(${siblings + 1})`;
        }
      }
    }
    
    const classes = await element.getAttribute('class');
    if (classes && classes.trim()) {
      const classList = classes.trim().split(/\s+/).filter(c => c).slice(0, 3).join('.');
      return `${tag}.${classList}`;
    }
    
    return tag;
  } catch (error) {
    return 'unknown';
  }
}

