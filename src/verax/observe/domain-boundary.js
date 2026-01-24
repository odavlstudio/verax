export function getBaseOrigin(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === 'file:') {
      return 'file://';
    }
    return urlObj.origin;
  } catch (error) {
    return null;
  }
}

export function isExternalUrl(url, baseOrigin) {
  if (!baseOrigin) return false;
  
  try {
    const urlObj = new URL(url);
    // Special-case file protocol: treat all file:// URLs as same-origin
    const isFileProtocol = urlObj.protocol === 'file:';
    const baseIsFile = baseOrigin.startsWith('file:');
    if (isFileProtocol && baseIsFile) {
      return false;
    }
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




