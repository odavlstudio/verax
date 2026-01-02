/**
 * Phase B: Recipe Runtime Enforcement
 * 
 * Executes recipes as strict, enforced runtime journeys.
 * Each step maps to a browser action; deviations trigger deterministic failure.
 */

const { GuardianBrowser } = require('../guardian/browser');
const { getRecipe } = require('./recipe-store');

/**
 * Execute a recipe as an enforced runtime journey
 * 
 * @param {string} recipeId - ID of recipe to execute
 * @param {string} baseUrl - Target URL
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Structured result: { success, steps, failedStep, failureReason, evidence }
 */
async function executeRecipeRuntime(recipeId, baseUrl, options = {}) {
  const recipe = getRecipe(recipeId);
  if (!recipe) {
    return {
      success: false,
      recipe: recipeId,
      baseUrl,
      steps: [],
      failedStep: null,
      failureReason: `Recipe not found: ${recipeId}`,
      evidence: [],
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      duration: 0
    };
  }

  const timeout = options.timeout || 20000;
  const headless = options.headless !== false;
  const screenshotDir = options.screenshotDir;
  
  const browser = new GuardianBrowser();
  const executionSteps = [];
  let failedStepId = null;
  let failureReason = null;
  const startedAt = new Date();
  
  try {
    // Launch browser
    await browser.launch(timeout, { headless });

    // Execute each recipe step in strict order
    let stepIndex = 0;
    for (const stepDef of recipe.steps) {
      const stepId = `${recipe.id}-step-${stepIndex}`;
      
      try {
        // Parse step definition (string format for now)
        const actionObj = parseRecipeStep(stepDef, stepIndex);
        
        // Execute action
        const result = await executeRecipeAction(browser, actionObj, baseUrl, timeout);
        
        executionSteps.push({
          id: stepId,
          index: stepIndex,
          text: stepDef,
          action: actionObj.action,
          success: result.success,
          duration: result.duration || 0,
          evidence: result.evidence || {}
        });

        if (!result.success) {
          failedStepId = stepId;
          failureReason = result.error || `Step failed: ${stepDef}`;
          break;
        }
      } catch (err) {
        executionSteps.push({
          id: stepId,
          index: stepIndex,
          text: stepDef,
          success: false,
          error: err.message
        });
        failedStepId = stepId;
        failureReason = `Step execution error: ${err.message}`;
        break;
      }
      
      stepIndex++;
    }

    // Evaluate goal if all steps succeeded
    let goalReached = false;
    if (!failedStepId) {
      try {
        goalReached = await evaluateRecipeGoal(browser, recipe, baseUrl);
        if (!goalReached) {
          failureReason = `Goal not reached: ${recipe.expectedGoal}`;
        }
      } catch (err) {
        failureReason = `Goal evaluation error: ${err.message}`;
      }
    }

    const endedAt = new Date();
    const duration = Math.round((endedAt - startedAt) / 1000);

    return {
      success: !failedStepId && goalReached,
      recipe: recipe.id,
      recipeName: recipe.name,
      baseUrl,
      steps: executionSteps,
      failedStep: failedStepId,
      failureReason,
      goalReached,
      evidence: {
        stepCount: executionSteps.length,
        successCount: executionSteps.filter(s => s.success).length
      },
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      duration
    };
  } catch (err) {
    const endedAt = new Date();
    return {
      success: false,
      recipe: recipe.id,
      baseUrl,
      steps: executionSteps,
      failedStep: null,
      failureReason: `Runtime error: ${err.message}`,
      evidence: {},
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      duration: Math.round((endedAt - startedAt) / 1000)
    };
  } finally {
    await browser.close();
  }
}

/**
 * Parse a recipe step string into an action object
 * 
 * Step format:
 *   "Navigate to product page"
 *   "Navigate to the homepage"
 *   "Click on 'Add to Cart' button"
 *   "Click on 'Contact' button"
 *   "Fill email with 'test@example.com'"
 *   "Assert visible 'Success message'"
 */
function parseRecipeStep(stepText, index) {
  const text = stepText.toLowerCase().trim();
  
  // Navigate: "Navigate to X" or "Go to X"
  if (text.startsWith('navigate') || text.startsWith('go to ')) {
    // Try to extract something meaningful
    let target = 'homepage';
    if (text.includes('homepage') || text.includes('home')) {
      target = 'homepage';
    } else if (text.includes('product')) {
      target = 'product';
    } else {
      // Get last noun-like word
      const quoted = stepText.match(/'([^']+)'/) || stepText.match(/"([^"]+)"/);
      if (quoted) {
        target = quoted[1];
      } else {
        const words = stepText.split(/\s+/).slice(2); // Skip "Navigate to"
        target = words.join('-').toLowerCase();
      }
    }
    return {
      action: 'navigate',
      target,
      index
    };
  }
  
  // Click: "Click on X" or "Click 'Button text'"
  if (text.includes('click')) {
    let selector = 'button';
    
    // Try to find quoted button text
    const quoted = stepText.match(/'([^']+)'/) || stepText.match(/"([^"]+)"/);
    if (quoted) {
      selector = quoted[1];
    } else {
      // Extract button description from text
      if (text.includes('contact')) {
        selector = 'Contact';
      } else if (text.includes('submit')) {
        selector = 'Submit';
      } else if (text.includes('add')) {
        selector = 'Add';
      } else {
        // Last word after "click"
        const match = stepText.match(/click(?:\s+on)?\s+(.+)/i);
        selector = match ? match[1].replace('button', '').trim() : 'button';
      }
    }
    
    return {
      action: 'click',
      selector,
      index
    };
  }
  
  // Fill: "Fill X with 'value'" or "Enter email"
  if (text.startsWith('fill ') || text.startsWith('enter ')) {
    let field = 'email';
    let value = 'test-data';
    
    const parts = stepText.split(' with ');
    
    // Extract field name
    if (parts[0].includes('email')) {
      field = 'email';
    } else if (parts[0].includes('name')) {
      field = 'name';
    } else if (parts[0].includes('password')) {
      field = 'password';
    } else {
      const quoted = parts[0].match(/'([^']+)'/) || parts[0].match(/"([^"]+)"/);
      field = quoted ? quoted[1] : 'email';
    }
    
    // Extract value
    if (parts[1]) {
      const quoted = parts[1].match(/'([^']+)'/) || parts[1].match(/"([^"]+)"/);
      value = quoted ? quoted[1] : parts[1].trim();
    }
    
    return {
      action: 'fill',
      field,
      value,
      index
    };
  }
  
  // Submit: "Submit form" or "Submit"
  if (text.includes('submit')) {
    return {
      action: 'submit',
      selector: 'button[type="submit"], input[type="submit"]',
      index
    };
  }
  
  // Wait: "Wait for X" or "Wait until X"
  if (text.includes('wait')) {
    const quoted = stepText.match(/'([^']+)'/) || stepText.match(/"([^"]+)"/);
    const target = quoted ? quoted[1] : 'element';
    return {
      action: 'waitFor',
      selector: target,
      index
    };
  }
  
  // Assert: "Assert visible X" or "Verify X"
  if (text.includes('assert') || text.includes('verify')) {
    const quoted = stepText.match(/'([^']+)'/) || stepText.match(/"([^"]+)"/);
    const target = quoted ? quoted[1] : 'element';
    return {
      action: 'assertVisible',
      selector: target,
      index
    };
  }
  
  // Default: treat as navigation
  return {
    action: 'navigate',
    target: stepText,
    index
  };
}

/**
 * Extract quoted text or last word from a string
 */
function extractQuotedOrLastWord(text) {
  const quoted = text.match(/'([^']+)'/) || text.match(/"([^"]+)"/);
  if (quoted) return quoted[1];
  
  const words = text.trim().split(/\s+/);
  return words[words.length - 1];
}

/**
 * Execute a single recipe action against the browser
 */
async function executeRecipeAction(browser, action, baseUrl, timeout) {
  const startTime = Date.now();
  
  try {
    if (action.action === 'navigate') {
      const url = action.target.startsWith('http')
        ? action.target
        : new URL(action.target, baseUrl).href;
      
      const response = await browser.navigate(url, timeout);
      if (!response.success) {
        return {
          success: false,
          error: response.error || `Navigation failed to ${url}`,
          duration: Date.now() - startTime
        };
      }
      
      return {
        success: true,
        duration: Date.now() - startTime,
        evidence: { url: response.url, status: response.status }
      };
    }
    
    if (action.action === 'click') {
      const selector = action.selector.toLowerCase().trim();
      let targetElement = null;
      
      // Find all clickable elements
      try {
        const allElements = await browser.page.$$('button, a, [role="button"], input[type="button"]');
        
        for (const el of allElements) {
          try {
            const text = await browser.page.evaluate(elem => (elem.textContent || elem.value || '').toLowerCase().trim(), el);
            const isVisible = await browser.page.evaluate(elem => elem.offsetParent !== null, el);
            
            if (isVisible && (text === selector || text.includes(selector) || selector.includes(text))) {
              targetElement = el;
              break;
            }
          } catch (_e) {
            // Skip this element
          }
        }
      } catch (_e) {
        // Fallback: try as selector
        targetElement = await browser.page.$(selector).catch(() => null);
      }
      
      if (!targetElement) {
        return {
          success: false,
          error: `Element not found: ${selector}`,
          duration: Date.now() - startTime
        };
      }
      
      // Perform click
      const initialUrl = browser.page.url();
      try {
        await browser.page.evaluate(el => el.click(), targetElement);
      } catch (e) {
        return {
          success: false,
          error: `Click failed: ${e.message}`,
          duration: Date.now() - startTime
        };
      }
      
      // Wait for navigation or content change
      await new Promise(r => setTimeout(r, 500));
      
      return {
        success: true,
        duration: Date.now() - startTime,
        evidence: { clicked: selector, urlChanged: initialUrl !== browser.page.url() }
      };
    }
    
    if (action.action === 'fill') {
      const field = action.field;
      const value = action.value;
      const locator = browser.page.locator(`input[name="${field}"], textarea[name="${field}"]`);
      
      const count = await locator.count();
      if (count === 0) {
        return {
          success: false,
          error: `Field not found: ${field}`,
          duration: Date.now() - startTime
        };
      }
      
      await locator.first().fill(value, { timeout });
      
      return {
        success: true,
        duration: Date.now() - startTime,
        evidence: { field, valueFilled: true }
      };
    }
    
    if (action.action === 'submit') {
      const locator = browser.page.locator(action.selector);
      const count = await locator.count();
      
      if (count === 0) {
        return {
          success: false,
          error: `Submit button not found: ${action.selector}`,
          duration: Date.now() - startTime
        };
      }
      
      await locator.first().click({ timeout });
      
      // Wait for response
      await new Promise(r => setTimeout(r, 1000));
      
      return {
        success: true,
        duration: Date.now() - startTime,
        evidence: { submitted: true }
      };
    }
    
    if (action.action === 'waitFor') {
      const locator = browser.page.locator(action.selector);
      await locator.waitFor({ timeout, state: 'visible' });
      
      return {
        success: true,
        duration: Date.now() - startTime,
        evidence: { elementVisible: action.selector }
      };
    }
    
    if (action.action === 'assertVisible') {
      const locator = browser.page.locator(action.selector);
      const isVisible = await locator.isVisible();
      
      if (!isVisible) {
        return {
          success: false,
          error: `Assertion failed: element not visible: ${action.selector}`,
          duration: Date.now() - startTime
        };
      }
      
      return {
        success: true,
        duration: Date.now() - startTime,
        evidence: { assertion: action.selector, visible: true }
      };
    }
    
    return {
      success: false,
      error: `Unknown action: ${action.action}`,
      duration: Date.now() - startTime
    };
  } catch (err) {
    return {
      success: false,
      error: `Action error: ${err.message}`,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Evaluate if recipe goal was reached
 */
async function evaluateRecipeGoal(browser, recipe, baseUrl) {
  const url = browser.page.url();
  const title = await browser.page.title();
  const bodyText = await browser.page.textContent('body');
  
  // Simple heuristics for goal validation
  const goal = recipe.expectedGoal.toLowerCase();
  const pageContent = `${url} ${title} ${bodyText}`.toLowerCase();
  
  // Check for goal keywords in page
  const keywordMatches = [
    'success', 'confirm', 'thank', 'order', 'dashboard',
    'welcome', 'complete', 'verified', 'registration',
    'payment', 'checkout'
  ];
  
  for (const keyword of keywordMatches) {
    if (goal.includes(keyword) && pageContent.includes(keyword)) {
      return true;
    }
  }
  
  // Check for goal phrases directly in page
  return pageContent.includes(goal);
}

module.exports = {
  executeRecipeRuntime,
  parseRecipeStep,
  extractQuotedOrLastWord,
  executeRecipeAction,
  evaluateRecipeGoal
};
