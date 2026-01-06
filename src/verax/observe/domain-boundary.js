export function getBaseOrigin(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.port ? `:${urlObj.port}` : ''}`;
  } catch (error) {
    return null;
  }
}

export function isExternalUrl(url, baseOrigin) {
  if (!baseOrigin) return false;
  
  try {
    const urlObj = new URL(url);
    const urlOrigin = urlObj.origin;
    return urlOrigin !== baseOrigin;
  } catch (error) {
    return false;
  }
}

export function isExternalHref(href, baseOrigin, currentUrl) {
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
    return false;
  }
  
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return isExternalUrl(href, baseOrigin);
  }
  
  try {
    const resolvedUrl = new URL(href, currentUrl);
    return isExternalUrl(resolvedUrl.href, baseOrigin);
  } catch (error) {
    return false;
  }
}

