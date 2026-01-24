/**
 * TRUTH BOUNDARY: State-Driven Navigation / View Switch Detection Rules
 * 
 * Hard rules encoded as constants and predicates. No prose, only code.
 */

/**
 * Detectable view switch function name patterns (strict allowlist)
 * Only literal string/number arguments are accepted.
 */
export const VIEW_SWITCH_FUNCTION_PATTERNS = {
  // React setState patterns
  react: [
    /^setView$/i,
    /^setPage$/i,
    /^setStep$/i,
    /^setScreen$/i,
    /^setTab$/i,
    /^setModalOpen$/i,
    /^setDrawerOpen$/i,
    /^setPanelOpen$/i,
    /^setActiveTab$/i,
    /^setActiveView$/i,
    /^setCurrentStep$/i,
    /^setCurrentPage$/i,
    /^setCurrentScreen$/i,
    /^setCurrentView$/i,
    /^setShowModal$/i,
    /^setShowDrawer$/i,
    /^setShowPanel$/i,
    /^setIsModalOpen$/i,
    /^setIsDrawerOpen$/i,
    /^setIsPanelOpen$/i
  ],
  
  // Redux dispatch action types
  redux: [
    /^NAVIGATE$/i,
    /^SET_VIEW$/i,
    /^SET_STEP$/i,
    /^SET_PAGE$/i,
    /^SET_SCREEN$/i,
    /^SET_TAB$/i,
    /^OPEN_MODAL$/i,
    /^CLOSE_MODAL$/i,
    /^OPEN_DRAWER$/i,
    /^CLOSE_DRAWER$/i,
    /^OPEN_PANEL$/i,
    /^CLOSE_PANEL$/i,
    /^SWITCH_VIEW$/i,
    /^SWITCH_TAB$/i,
    /^SWITCH_STEP$/i
  ],
  
  // Generic function call patterns
  generic: [
    /^showModal$/i,
    /^hideModal$/i,
    /^openDrawer$/i,
    /^closeDrawer$/i,
    /^openPanel$/i,
    /^closePanel$/i,
    /^switchView$/i,
    /^switchTab$/i,
    /^switchStep$/i,
    /^navigateTo$/i,
    /^goToView$/i,
    /^goToStep$/i,
    /^goToPage$/i,
    /^goToScreen$/i
  ]
};

/**
 * View switch kinds (categories)
 */
export const VIEW_SWITCH_KINDS = {
  TAB: 'tab',
  VIEW: 'view',
  MODAL: 'modal',
  DRAWER: 'drawer',
  PANEL: 'panel',
  STEP: 'step',
  SCREEN: 'screen',
  PAGE: 'page'
};

/**
 * Reason codes for truth boundary decisions
 */
export const VIEW_SWITCH_REASON_CODES = {
  DETECTABLE_LITERAL_ARG: 'DETECTABLE_LITERAL_ARG',
  REJECTED_COMPLEX_EXPRESSION: 'REJECTED_COMPLEX_EXPRESSION',
  REJECTED_DYNAMIC_VALUE: 'REJECTED_DYNAMIC_VALUE',
  REJECTED_MEMBER_EXPRESSION: 'REJECTED_MEMBER_EXPRESSION',
  REJECTED_FUNCTION_CALL: 'REJECTED_FUNCTION_CALL',
  REJECTED_NOT_IN_ALLOWLIST: 'REJECTED_NOT_IN_ALLOWLIST',
  ACCEPTED_STRING_LITERAL: 'ACCEPTED_STRING_LITERAL',
  ACCEPTED_NUMBER_LITERAL: 'ACCEPTED_NUMBER_LITERAL'
};

/**
 * Check if a function name matches view switch patterns
 * @param {string} functionName - Function name to check
 * @returns {Object|null} - { kind, pattern } or null
 */
export function isViewSwitchFunction(functionName) {
  if (!functionName || typeof functionName !== 'string') return null;
  
  // Check React patterns
  for (const pattern of VIEW_SWITCH_FUNCTION_PATTERNS.react) {
    if (pattern.test(functionName)) {
      const kind = inferViewSwitchKind(functionName);
      return { kind, pattern: 'react', functionName };
    }
  }
  
  // Check Redux patterns
  for (const pattern of VIEW_SWITCH_FUNCTION_PATTERNS.redux) {
    if (pattern.test(functionName)) {
      const kind = inferViewSwitchKind(functionName);
      return { kind, pattern: 'redux', functionName };
    }
  }
  
  // Check generic patterns
  for (const pattern of VIEW_SWITCH_FUNCTION_PATTERNS.generic) {
    if (pattern.test(functionName)) {
      const kind = inferViewSwitchKind(functionName);
      return { kind, pattern: 'generic', functionName };
    }
  }
  
  return null;
}

/**
 * Infer view switch kind from function name
 * @param {string} functionName - Function name
 * @returns {string} - View switch kind
 */
function inferViewSwitchKind(functionName) {
  const lower = functionName.toLowerCase();
  
  if (lower.includes('tab')) return VIEW_SWITCH_KINDS.TAB;
  if (lower.includes('modal')) return VIEW_SWITCH_KINDS.MODAL;
  if (lower.includes('drawer')) return VIEW_SWITCH_KINDS.DRAWER;
  if (lower.includes('panel')) return VIEW_SWITCH_KINDS.PANEL;
  if (lower.includes('step')) return VIEW_SWITCH_KINDS.STEP;
  if (lower.includes('screen')) return VIEW_SWITCH_KINDS.SCREEN;
  if (lower.includes('page')) return VIEW_SWITCH_KINDS.PAGE;
  if (lower.includes('view')) return VIEW_SWITCH_KINDS.VIEW;
  
  return VIEW_SWITCH_KINDS.VIEW; // Default
}

/**
 * Check if an AST node is a detectable literal argument
 * TRUTH BOUNDARY: Only StringLiteral and NumericLiteral are accepted
 * @param {Object} node - AST node
 * @returns {Object|null} - { value, reasonCode } or null
 */
export function isDetectableLiteralArg(node) {
  if (!node) return null;
  
  // String literal: setView('settings')
  if (node.type === 'StringLiteral') {
    return {
      value: node.value,
      reasonCode: VIEW_SWITCH_REASON_CODES.ACCEPTED_STRING_LITERAL
    };
  }
  
  // Number literal: setStep(2)
  if (node.type === 'NumericLiteral') {
    return {
      value: String(node.value),
      reasonCode: VIEW_SWITCH_REASON_CODES.ACCEPTED_NUMBER_LITERAL
    };
  }
  
  // Template literal without interpolation: setView(`settings`)
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    const value = node.quasis[0]?.value?.cooked;
    if (value) {
      return {
        value,
        reasonCode: VIEW_SWITCH_REASON_CODES.ACCEPTED_STRING_LITERAL
      };
    }
  }
  
  // REJECTED: Complex expressions
  if (node.type === 'CallExpression') {
    return { reasonCode: VIEW_SWITCH_REASON_CODES.REJECTED_FUNCTION_CALL };
  }
  
  if (node.type === 'MemberExpression') {
    return { reasonCode: VIEW_SWITCH_REASON_CODES.REJECTED_MEMBER_EXPRESSION };
  }
  
  if (node.type === 'Identifier') {
    return { reasonCode: VIEW_SWITCH_REASON_CODES.REJECTED_DYNAMIC_VALUE };
  }
  
  return { reasonCode: VIEW_SWITCH_REASON_CODES.REJECTED_COMPLEX_EXPRESSION };
}




