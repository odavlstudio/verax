/**
 * Market Reality Validators Framework
 * 
 * Pure deterministic checks that detect soft failures:
 * - Interactions technically succeeded (no Playwright exception)
 * - But user would NOT succeed (no confirmation, wrong state, etc)
 * 
 * Validators return: { id, type, status: PASS|FAIL|WARN, message, evidence? }
 */

const validator = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARN: 'WARN'
};

/**
 * URL includes substring
 */
function urlIncludes(page, substring) {
  try {
    const url = page.url();
    return {
      id: `url_includes_${substring}`,
      type: 'urlIncludes',
      status: url.includes(substring) ? validator.PASS : validator.FAIL,
      message: url.includes(substring) 
        ? `URL contains "${substring}"` 
        : `URL does not contain "${substring}". Current: ${url}`,
      evidence: { url, expected: substring }
    };
  } catch (err) {
    return {
      id: `url_includes_${substring}`,
      type: 'urlIncludes',
      status: validator.FAIL,
      message: `Error checking URL: ${err.message}`,
      evidence: { error: err.message }
    };
  }
}

/**
 * URL matches regex pattern
 */
function urlMatches(page, pattern) {
  try {
    const url = page.url();
    const regex = new RegExp(pattern);
    return {
      id: `url_matches_${pattern}`,
      type: 'urlMatches',
      status: regex.test(url) ? validator.PASS : validator.FAIL,
      message: regex.test(url)
        ? `URL matches pattern "${pattern}"`
        : `URL does not match pattern "${pattern}". Current: ${url}`,
      evidence: { url, pattern }
    };
  } catch (err) {
    return {
      id: `url_matches_${pattern}`,
      type: 'urlMatches',
      status: validator.FAIL,
      message: `Error checking URL pattern: ${err.message}`,
      evidence: { error: err.message }
    };
  }
}

/**
 * Element is visible (exists and not hidden)
 */
async function elementVisible(page, selector) {
  try {
    const element = page.locator(selector);
    const visible = await element.isVisible().catch(() => false);
    
    return {
      id: `element_visible_${selector}`,
      type: 'elementVisible',
      status: visible ? validator.PASS : validator.FAIL,
      message: visible
        ? `Element visible: ${selector}`
        : `Element not visible: ${selector}`,
      evidence: { selector, visible }
    };
  } catch (err) {
    return {
      id: `element_visible_${selector}`,
      type: 'elementVisible',
      status: validator.FAIL,
      message: `Error checking element visibility: ${err.message}`,
      evidence: { selector, error: err.message }
    };
  }
}

/**
 * Element is NOT visible
 */
async function elementNotVisible(page, selector) {
  try {
    const element = page.locator(selector);
    const visible = await element.isVisible().catch(() => false);
    
    return {
      id: `element_not_visible_${selector}`,
      type: 'elementNotVisible',
      status: !visible ? validator.PASS : validator.FAIL,
      message: !visible
        ? `Element not visible: ${selector}`
        : `Element is visible but should not be: ${selector}`,
      evidence: { selector, visible }
    };
  } catch (_err) {
    return {
      id: `element_not_visible_${selector}`,
      type: 'elementNotVisible',
      status: validator.PASS, // If element doesn't exist, that's good
      message: `Element not found (expected)`,
      evidence: { selector }
    };
  }
}

/**
 * Element contains text
 */
async function elementContainsText(page, selector, expectedText) {
  try {
    const element = page.locator(selector);
    const text = await element.textContent().catch(() => '');
    const contains = text.includes(expectedText);
    
    return {
      id: `element_contains_${selector}_${expectedText}`,
      type: 'elementContainsText',
      status: contains ? validator.PASS : validator.FAIL,
      message: contains
        ? `Element contains "${expectedText}"`
        : `Element text does not contain "${expectedText}". Found: "${text}"`,
      evidence: { selector, expectedText, actualText: text }
    };
  } catch (err) {
    return {
      id: `element_contains_${selector}_${expectedText}`,
      type: 'elementContainsText',
      status: validator.FAIL,
      message: `Error checking element text: ${err.message}`,
      evidence: { selector, expectedText, error: err.message }
    };
  }
}

/**
 * Page contains ANY of the provided text strings
 * Useful for language detection or success keywords
 */
async function pageContainsAnyText(page, textList) {
  try {
    const pageText = await page.content();
    const found = textList.find(text => pageText.includes(text));
    
    return {
      id: `page_contains_any_${textList.join('_')}`,
      type: 'pageContainsAnyText',
      status: found ? validator.PASS : validator.FAIL,
      message: found
        ? `Page contains expected text: "${found}"`
        : `Page does not contain any of: ${textList.join(', ')}`,
      evidence: { searchTerms: textList, found }
    };
  } catch (err) {
    return {
      id: `page_contains_any_${textList.join('_')}`,
      type: 'pageContainsAnyText',
      status: validator.FAIL,
      message: `Error checking page content: ${err.message}`,
      evidence: { searchTerms: textList, error: err.message }
    };
  }
}

/**
 * HTML lang attribute matches (for language detection)
 */
async function htmlLangAttribute(page, expectedLang) {
  try {
    const lang = await page.locator('html').getAttribute('lang');
    const matches = lang === expectedLang;
    
    return {
      id: `html_lang_${expectedLang}`,
      type: 'htmlLangAttribute',
      status: matches ? validator.PASS : validator.FAIL,
      message: matches
        ? `HTML lang attribute is "${expectedLang}"`
        : `HTML lang is "${lang}", expected "${expectedLang}"`,
      evidence: { attribute: 'lang', expected: expectedLang, actual: lang }
    };
  } catch (err) {
    return {
      id: `html_lang_${expectedLang}`,
      type: 'htmlLangAttribute',
      status: validator.FAIL,
      message: `Error checking lang attribute: ${err.message}`,
      evidence: { error: err.message }
    };
  }
}

/**
 * No console errors above severity level
 * Requires console messages to be captured during attempt
 */
function noConsoleErrorsAbove(consoleMessages, minSeverity = 'error') {
  const severities = { log: 0, warning: 1, error: 2 };
  const minLevel = severities[minSeverity] || 2;
  
  const violatingMessages = consoleMessages.filter(msg => 
    severities[msg.type] >= minLevel
  );
  
  return {
    id: `no_console_errors_${minSeverity}`,
    type: 'noConsoleErrorsAbove',
    status: violatingMessages.length === 0 ? validator.PASS : validator.FAIL,
    message: violatingMessages.length === 0
      ? `No console errors (threshold: ${minSeverity})`
      : `Found ${violatingMessages.length} console errors: ${violatingMessages.map(m => m.text).join('; ')}`,
    evidence: { minSeverity, count: violatingMessages.length, messages: violatingMessages }
  };
}

/**
 * Validator runner: execute all validators and return results
 */
async function runValidators(validatorSpecs, context) {
  const results = [];
  
  for (const spec of validatorSpecs) {
    try {
      let result;
      
      switch (spec.type) {
        case 'urlIncludes':
          result = urlIncludes(context.page, spec.param);
          break;
        case 'urlMatches':
          result = urlMatches(context.page, spec.param);
          break;
        case 'elementVisible':
          result = await elementVisible(context.page, spec.selector);
          break;
        case 'elementNotVisible':
          result = await elementNotVisible(context.page, spec.selector);
          break;
        case 'elementContainsText':
          result = await elementContainsText(context.page, spec.selector, spec.text);
          break;
        case 'pageContainsAnyText':
          result = await pageContainsAnyText(context.page, spec.textList);
          break;
        case 'htmlLangAttribute':
          result = await htmlLangAttribute(context.page, spec.lang);
          break;
        case 'noConsoleErrorsAbove':
          result = noConsoleErrorsAbove(context.consoleMessages || [], spec.minSeverity);
          break;
        default:
          result = {
            id: spec.type,
            type: spec.type,
            status: validator.WARN,
            message: `Unknown validator type: ${spec.type}`
          };
      }
      
      results.push(result);
    } catch (err) {
      results.push({
        id: spec.type,
        type: spec.type,
        status: validator.FAIL,
        message: `Validator error: ${err.message}`,
        evidence: { error: err.message }
      });
    }
  }
  
  return results;
}

/**
 * Determine if validators indicate a soft failure
 * Returns: { hasSoftFailure: boolean, failureCount: number, warnCount: number }
 */
function analyzeSoftFailures(validatorResults) {
  const failures = validatorResults.filter(r => r.status === validator.FAIL);
  const warnings = validatorResults.filter(r => r.status === validator.WARN);
  
  return {
    hasSoftFailure: failures.length > 0,
    failureCount: failures.length,
    warnCount: warnings.length,
    failedValidators: failures,
    warnedValidators: warnings
  };
}

module.exports = {
  validator,
  urlIncludes,
  urlMatches,
  elementVisible,
  elementNotVisible,
  elementContainsText,
  pageContainsAnyText,
  htmlLangAttribute,
  noConsoleErrorsAbove,
  runValidators,
  analyzeSoftFailures
};
