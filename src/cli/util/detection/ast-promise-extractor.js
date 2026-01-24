import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { readFileSync as _readFileSync } from 'fs';

// Handle default export from @babel/traverse (CommonJS/ESM compatibility)
const traverse = _traverse.default || _traverse;

/**
 * PHASE H2/M2 — AST-Based Promise Extraction
 * 
 * Extracts user promises from code using real AST parsing:
 * - Button interactions (<button>, role="button", onClick)
 * - Forms & submission (<form>, onSubmit, preventDefault)
 * - Validation promises (required, disabled, validation branches)
 * - UI feedback (toasts, alerts, aria-live, status banners)
 * 
 * Evidence-first: Only emit promises we can prove exist in code
 * Deterministic: Same code → same promises every run
 */

/**
 * Extract promises from JSX/TSX file using AST
 */
export function extractPromisesFromAST(content, filePath, relPath) {
  const promises = [];
  
  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'optionalChaining',
        'nullishCoalescingOperator',
        'dynamicImport',
        ['decorators', { decoratorsBeforeExport: true }],
        'topLevelAwait',
        'objectRestSpread',
        'asyncGenerators',
      ],
      errorRecovery: true,
    });
    
    const context = {
      filePath,
      relPath,
      lines: content.split('\n'),
      imports: trackImports(ast),
      formElements: new Map(), // Track form refs for submit button association
    };
    
    traverse(ast, {
      // Button interactions
      JSXElement(path) {
        extractButtonPromises(path, context, promises);
        extractFormPromises(path, context, promises);
        extractValidationInputPromises(path, context, promises);
        extractFeedbackPromises(path, context, promises);
      },
      
      // Validation logic in handlers
      FunctionDeclaration(path) {
        extractValidationPromises(path, context, promises);
      },
      ArrowFunctionExpression(path) {
        extractValidationPromises(path, context, promises);
      },
      FunctionExpression(path) {
        extractValidationPromises(path, context, promises);
      },
    });
  } catch (error) {
    // Parse error - skip this file silently
  }
  
  return promises;
}

/**
 * Track imports for context (router, toast libraries, etc.)
 */
function trackImports(ast) {
  const imports = {
    router: new Set(),
    navigation: new Set(),
    toast: new Set(),
    modal: new Set(),
  };
  
  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value;
      
      // React Router
      if (source.includes('react-router')) {
        path.node.specifiers.forEach((spec) => {
          if (spec.type === 'ImportSpecifier' || spec.type === 'ImportDefaultSpecifier') {
            imports.router.add(spec.local.name);
            if (['useNavigate', 'useHistory'].includes(spec.imported?.name)) {
              imports.navigation.add(spec.local.name);
            }
          }
        });
      }
      
      // Next.js
      if (source.includes('next/')) {
        path.node.specifiers.forEach((spec) => {
          if (spec.type === 'ImportSpecifier' || spec.type === 'ImportDefaultSpecifier') {
            if (source.includes('next/link')) imports.router.add(spec.local.name);
            if (source.includes('next/navigation')) imports.navigation.add(spec.local.name);
          }
        });
      }
      
      // Toast libraries (generic detection)
      if (source.includes('toast') || source.includes('notification') || 
          source.includes('alert') || source.includes('snackbar')) {
        path.node.specifiers.forEach((spec) => {
          if (spec.local) imports.toast.add(spec.local.name);
        });
      }
      
      // Modal libraries
      if (source.includes('modal') || source.includes('dialog')) {
        path.node.specifiers.forEach((spec) => {
          if (spec.local) imports.modal.add(spec.local.name);
        });
      }
    },
  });
  
  return imports;
}

/**
 * Extract button interaction promises
 */
function extractButtonPromises(path, context, promises) {
  const opening = path.node.openingElement;
  const elementName = opening.name.name || opening.name.property?.name;
  
  // Check if this is a button element
  const isButton = elementName === 'button' || 
                   hasAttribute(opening, 'role', 'button') ||
                   elementName === 'Button'; // Common component name
  
  if (!isButton) return;
  
  // Look for onClick handler
  const onClickAttr = opening.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name.name === 'onClick'
  );
  
  if (!onClickAttr) return;
  
  const loc = path.node.loc;
  if (!loc) return;
  
  // Check if button has type="submit" - if so, skip (handled by form extraction)
  const typeAttr = opening.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name.name === 'type'
  );
  if (typeAttr?.value?.value === 'submit') return;
  
  // Extract button text/label for selector
  const buttonText = extractElementText(path.node);
  const selector = buttonText ? `button:contains("${buttonText}")` : 'button[onClick]';
  
  // Check if handler contains navigation
  const handlerSource = extractHandlerSource(onClickAttr.value, context);
  const hasNavigationCall = detectNavigationInSource(handlerSource, context);
  
  promises.push({
    category: 'button',
    type: 'interaction',
    promise: {
      kind: 'click',
      value: buttonText || 'button click',
    },
    source: {
      file: context.relPath,
      line: loc.start.line,
      column: loc.start.column,
    },
    selector,
    action: 'click',
    expectedOutcome: hasNavigationCall ? 'navigation' : 'ui-change',
    confidenceHint: 'medium',
  });
}

/**
 * Extract form submission promises
 */
function extractFormPromises(path, context, promises) {
  const opening = path.node.openingElement;
  const elementName = opening.name.name || opening.name.property?.name;
  
  if (elementName !== 'form' && elementName !== 'Form') return;
  
  // Look for onSubmit handler
  const onSubmitAttr = opening.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name.name === 'onSubmit'
  );
  
  if (!onSubmitAttr) return;
  
  const loc = path.node.loc;
  if (!loc) return;
  
  // Extract handler source
  const handlerSource = extractHandlerSource(onSubmitAttr.value, context);
  
  // Check for preventDefault (indicates form handling, not default browser submit)
  const hasPreventDefault = handlerSource.includes('preventDefault');
  
  // Check for validation
  const hasValidation = detectValidationInSource(handlerSource);
  
  // Check for navigation
  const hasNavigation = detectNavigationInSource(handlerSource, context);
  
  // Check for network calls
  const hasNetwork = detectNetworkInSource(handlerSource);
  
  // Determine expected outcome
  let expectedOutcome = 'ui-change';
  if (hasNetwork) expectedOutcome = 'network';
  if (hasNavigation) expectedOutcome = 'navigation';
  
  promises.push({
    category: 'form',
    type: 'interaction',
    promise: {
      kind: 'submit',
      value: 'form submission',
    },
    source: {
      file: context.relPath,
      line: loc.start.line,
      column: loc.start.column,
    },
    selector: 'form[onSubmit]',
    action: 'submit',
    expectedOutcome,
    confidenceHint: hasPreventDefault ? 'medium' : 'low',
  });
  
  // If validation detected, add validation promise
  if (hasValidation) {
    promises.push({
      category: 'validation',
      type: 'feedback',
      promise: {
        kind: 'validation',
        value: 'input validation feedback',
      },
      source: {
        file: context.relPath,
        line: loc.start.line,
        column: loc.start.column,
      },
      selector: 'form[onSubmit]',
      action: 'observe',
      expectedOutcome: 'feedback',
      confidenceHint: 'medium',
    });
  }
}

/**
 * Extract validation promises from input elements with required attribute
 */
function extractValidationInputPromises(path, context, promises) {
  const opening = path.node.openingElement;
  const elementName = opening.name.name || opening.name.property?.name;
  
  // Check if this is an input element
  if (elementName !== 'input' && elementName !== 'Input') return;
  
  // Check for required attribute
  const hasRequired = opening.attributes.some(
    attr => attr.type === 'JSXAttribute' && attr.name.name === 'required'
  );
  
  if (!hasRequired) return;
  
  const loc = path.node.loc;
  if (!loc) return;
  
  // Extract name or id for selector
  const nameAttr = opening.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name.name === 'name'
  );
  const idAttr = opening.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name.name === 'id'
  );
  
  let selector = 'input[required]';
  if (nameAttr?.value?.value) {
    selector = `input[name="${nameAttr.value.value}"]`;
  } else if (idAttr?.value?.value) {
    selector = `input#${idAttr.value.value}`;
  }
  
  promises.push({
    category: 'validation',
    type: 'feedback',
    promise: {
      kind: 'validation',
      value: 'required field validation',
    },
    source: {
      file: context.relPath,
      line: loc.start.line,
      column: loc.start.column,
    },
    selector,
    action: 'observe',
    expectedOutcome: 'feedback',
    confidenceHint: 'medium',
  });
}

/**
 * Extract validation promises from code
 */
function extractValidationPromises(path, context, promises) {
  const body = path.node.body;
  if (!body) return;
  
  const source = extractFunctionSource(path, context);
  if (!source) return;
  
  // Look for validation patterns
  const hasValidationLogic = (
    source.includes('required') ||
    source.includes('validate') ||
    source.includes('.length') ||
    source.includes('isEmpty') ||
    source.includes('isValid') ||
    source.includes('error') && (source.includes('set') || source.includes('Error'))
  );
  
  if (!hasValidationLogic) return;
  
  // Check if this function is used as a form handler or validator
  const isValidationContext = (
    path.node.id?.name?.toLowerCase().includes('valid') ||
    path.node.id?.name?.toLowerCase().includes('check') ||
    path.node.id?.name?.toLowerCase().includes('submit') ||
    source.includes('onSubmit') ||
    source.includes('onChange')
  );
  
  if (!isValidationContext) return;
  
  const loc = path.node.loc;
  if (!loc) return;
  
  promises.push({
    category: 'validation',
    type: 'feedback',
    promise: {
      kind: 'validation',
      value: 'validation feedback',
    },
    source: {
      file: context.relPath,
      line: loc.start.line,
      column: loc.start.column,
    },
    selector: null, // Cannot determine selector from handler alone
    action: 'observe',
    expectedOutcome: 'feedback',
    confidenceHint: 'low',
  });
}

/**
 * Extract UI feedback promises
 */
function extractFeedbackPromises(path, context, promises) {
  const opening = path.node.openingElement;
  
  // Check for aria-live regions (explicit feedback promise)
  const ariaLiveAttr = opening.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name.name === 'aria-live'
  );
  
  if (ariaLiveAttr) {
    const loc = path.node.loc;
    if (!loc) return;
    
    promises.push({
      category: 'feedback',
      type: 'feedback',
      promise: {
        kind: 'ui-feedback',
        value: 'live region update',
      },
      source: {
        file: context.relPath,
        line: loc.start.line,
        column: loc.start.column,
      },
      selector: '[aria-live]',
      action: 'observe',
      expectedOutcome: 'feedback',
      confidenceHint: 'medium',
    });
  }
  
  // Check for role="status" or role="alert"
  const roleAttr = opening.attributes.find(
    attr => attr.type === 'JSXAttribute' && attr.name.name === 'role'
  );
  
  if (roleAttr?.value?.value === 'status' || roleAttr?.value?.value === 'alert') {
    const loc = path.node.loc;
    if (!loc) return;
    
    promises.push({
      category: 'feedback',
      type: 'feedback',
      promise: {
        kind: 'ui-feedback',
        value: `${roleAttr.value.value} message`,
      },
      source: {
        file: context.relPath,
        line: loc.start.line,
        column: loc.start.column,
      },
      selector: `[role="${roleAttr.value.value}"]`,
      action: 'observe',
      expectedOutcome: 'feedback',
      confidenceHint: 'medium',
    });
  }
}

/**
 * Extract handler source code from JSX attribute value
 */
function extractHandlerSource(value, context) {
  if (!value) return '';
  
  if (value.type === 'JSXExpressionContainer') {
    const expr = value.expression;
    
    // Inline arrow function
    if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') {
      const loc = expr.loc;
      if (!loc) return '';
      return context.lines.slice(loc.start.line - 1, loc.end.line).join('\n');
    }
    
    // Reference to function
    if (expr.type === 'Identifier') {
      return expr.name; // Return function name for pattern matching
    }
    
    // Member expression (e.g., this.handleClick)
    if (expr.type === 'MemberExpression') {
      return `${expr.object.name}.${expr.property.name}`;
    }
  }
  
  return '';
}

/**
 * Extract function source code
 */
function extractFunctionSource(path, context) {
  const loc = path.node.loc;
  if (!loc) return '';
  
  return context.lines.slice(loc.start.line - 1, loc.end.line).join('\n');
}

/**
 * Extract text content from JSX element
 */
function extractElementText(node) {
  if (!node.children || node.children.length === 0) return '';
  
  for (const child of node.children) {
    if (child.type === 'JSXText') {
      return child.value.trim();
    }
    if (child.type === 'JSXExpressionContainer' && child.expression.type === 'StringLiteral') {
      return child.expression.value;
    }
  }
  
  return '';
}

/**
 * Check if element has specific attribute with value
 */
function hasAttribute(opening, attrName, attrValue = null) {
  const attr = opening.attributes.find(
    a => a.type === 'JSXAttribute' && a.name.name === attrName
  );
  
  if (!attr) return false;
  if (attrValue === null) return true;
  
  return attr.value?.value === attrValue;
}

/**
 * Detect navigation calls in source code
 */
function detectNavigationInSource(source, context) {
  if (!source) return false;
  
  return (
    source.includes('.push(') ||
    source.includes('.replace(') ||
    source.includes('navigate(') ||
    source.includes('router.') ||
    source.includes('history.') ||
    Array.from(context.imports.navigation).some(name => source.includes(name))
  );
}

/**
 * Detect validation logic in source code
 */
function detectValidationInSource(source) {
  if (!source) return false;
  
  return (
    source.includes('required') ||
    source.includes('validate') ||
    source.includes('isValid') ||
    source.includes('isEmpty') ||
    (source.includes('error') && (source.includes('set') || source.includes('Error'))) ||
    source.includes('pattern') ||
    source.includes('minLength') ||
    source.includes('maxLength')
  );
}

/**
 * Detect network calls in source code
 */
function detectNetworkInSource(source) {
  if (!source) return false;
  
  return (
    source.includes('fetch(') ||
    source.includes('axios.') ||
    source.includes('.post(') ||
    source.includes('.get(') ||
    source.includes('.put(') ||
    source.includes('.delete(') ||
    source.includes('api.')
  );
}

/**
 * Detect toast/notification calls in source code
 */
function _detectToastInSource(source, context) {
  if (!source) return false;
  
  return (
    source.includes('toast.') ||
    source.includes('notify(') ||
    source.includes('alert(') ||
    source.includes('showMessage') ||
    Array.from(context.imports.toast).some(name => source.includes(name))
  );
}



