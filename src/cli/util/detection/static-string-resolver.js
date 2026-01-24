/**
 * StaticStringResolver - Deterministic AST-based String Resolution
 * 
 * Promise Extraction 2.0: Resolves static strings from AST with hard bounds
 * 
 * SUPPORTED:
 * - String literals: "/path"
 * - Template literals with static parts: `/${X}` where X is const
 * - Binary concatenation: "/a" + "/b"
 * - Identifier references to module-level const and simple local const
 * - Arrays of literals: ["/users", "123"] → ["/users", "123"]
 * 
 * HARD BOUNDS:
 * - No function execution
 * - No cross-module import resolution
 * - No runtime expression evaluation
 * - Max recursion depth: 10
 * - Max resolution attempts per file: 1000
 * 
 * Returns:
 * - {value: "/resolved", confidence: "STATIC"} on success
 * - {unresolvedReason: "dynamic_*", confidence: "NONE"} on failure
 */

const MAX_RECURSION_DEPTH = 10;
const MAX_RESOLUTION_ATTEMPTS = 1000;

function unresolved(reason, detail) {
  return detail ? { unresolvedReason: reason, detail } : { unresolvedReason: reason };
}

/**
 * Resolution context for a single file
 */
export class ResolutionContext {
  constructor(ast, scopeMap) {
    this.ast = ast;
    this.scopeMap = scopeMap; // Map of identifier name → const value
    this.attempts = 0;
    this.cache = new Map(); // identifier → resolved value
    this.resolving = new Set(); // guard against self-recursion
  }
  
  checkAttempts() {
    this.attempts++;
    if (this.attempts > MAX_RESOLUTION_ATTEMPTS) {
      throw new Error('MAX_RESOLUTION_ATTEMPTS exceeded');
    }
  }
}

/**
 * Build scope map of module-level const declarations
 * @param {Object} ast - Babel AST
 * @returns {Map} identifier name → resolved value
 */
export function buildScopeMap(ast) {
  const scopeMap = new Map();
  const context = new ResolutionContext(ast, scopeMap);
  
  // Only track top-level const declarations with literal values
  if (ast.program && ast.program.body) {
    for (const node of ast.program.body) {
      if (node.type === 'VariableDeclaration' && node.kind === 'const') {
        for (const decl of node.declarations) {
          if (decl.id.type === 'Identifier' && decl.init) {
            const resolved = resolveStaticString(decl.init, context, 0, null);
            if (!resolved.unresolvedReason) {
              scopeMap.set(decl.id.name, resolved.value);
            }
          }
        }
      }
    }
  }
  
  return scopeMap;
}

/**
 * Try to extract a literal value from an AST node (non-recursive)
 */
/**
 * Resolve a string expression to a static value
 * @param {Object} node - AST node to resolve
 * @param {ResolutionContext} context - Resolution context
 * @param {number} depth - Current recursion depth
 * @param {Object} scope - Optional Babel scope for lexical bindings
 * @returns {Object} {value: string} or {unresolvedReason: string}
 */
export function resolveStaticString(node, context, depth = 0, scope = null) {
  if (!node) {
    return unresolved('null_node');
  }
  
  // Hard bound: recursion depth
  if (depth > MAX_RECURSION_DEPTH) {
    return unresolved('max_depth_exceeded');
  }
  
  // Hard bound: attempts counter
  try {
    context.checkAttempts();
  } catch (error) {
    return unresolved('max_attempts_exceeded');
  }
  
  // String literal
  if (node.type === 'StringLiteral') {
    return { value: node.value, confidence: 'STATIC' };
  }
  
  // Numeric literal
  if (node.type === 'NumericLiteral') {
    return { value: String(node.value), confidence: 'STATIC' };
  }
  
  // Template literal
  if (node.type === 'TemplateLiteral') {
    return resolveTemplateLiteral(node, context, depth, scope);
  }
  
  // Binary expression (concatenation)
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return resolveBinaryConcat(node, context, depth, scope);
  }
  
  // Identifier (const reference)
  if (node.type === 'Identifier') {
    return resolveIdentifier(node, context, depth, scope);
  }
  
  // Array expression (for Angular/routing arrays)
  if (node.type === 'ArrayExpression') {
    return resolveArrayExpression(node, context, depth, scope);
  }
  
  // JSX attribute (extract expression)
  if (node.type === 'JSXExpressionContainer') {
    return resolveStaticString(node.expression, context, depth, scope);
  }
  
  // Parenthesized expression
  if (node.type === 'ParenthesizedExpression') {
    return resolveStaticString(node.expression, context, depth, scope);
  }
  
  // Call expression → always dynamic
  if (node.type === 'CallExpression') {
    return unresolved('dynamic_call');
  }
  
  // Member expression → always dynamic (could be runtime property access)
  if (node.type === 'MemberExpression') {
    return unresolved('dynamic_member');
  }
  
  // Conditional expression → always dynamic
  if (node.type === 'ConditionalExpression') {
    return unresolved('dynamic_conditional');
  }
  
  // Logical expression → dynamic
  if (node.type === 'LogicalExpression') {
    return unresolved('dynamic_logical');
  }
  
  // Tagged templates / unsupported nodes → dynamic
  if (node.type === 'TaggedTemplateExpression') {
    return unresolved('dynamic_template_expr');
  }
  
  // Object expression → unsupported
  if (node.type === 'ObjectExpression') {
    return unresolved('object_expression');
  }
  
  // Default: unknown node type
  return unresolved('unknown_node_type', node.type);
}

/**
 * Resolve template literal
 */
function resolveTemplateLiteral(node, context, depth, scope) {
  let result = '';
  
  // Interleave quasis (string parts) and expressions
  for (let i = 0; i < node.quasis.length; i++) {
    result += node.quasis[i].value.cooked || node.quasis[i].value.raw;
    
    if (i < node.expressions.length) {
      const expr = node.expressions[i];
      const resolved = resolveStaticString(expr, context, depth + 1, scope);
      
      if (resolved.unresolvedReason) {
        return unresolved('dynamic_template_expr', resolved.unresolvedReason);
      }
      
      result += resolved.value;
    }
  }
  
  return { value: result, confidence: 'STATIC' };
}

/**
 * Resolve binary concatenation
 */
function resolveBinaryConcat(node, context, depth, scope) {
  const left = resolveStaticString(node.left, context, depth + 1, scope);
  if (left.unresolvedReason) {
    return unresolved('dynamic_concat', { side: 'left', reason: left.unresolvedReason });
  }
  
  const right = resolveStaticString(node.right, context, depth + 1, scope);
  if (right.unresolvedReason) {
    return unresolved('dynamic_concat', { side: 'right', reason: right.unresolvedReason });
  }
  
  return { value: String(left.value) + String(right.value), confidence: 'STATIC' };
}

/**
 * Resolve identifier (const reference)
 */
function resolveIdentifier(node, context, depth, scope) {
  const name = node.name;
  
  if (context.cache.has(name)) {
    return { value: context.cache.get(name), confidence: 'STATIC' };
  }
  
  if (context.resolving.has(name)) {
    return unresolved('dynamic_identifier');
  }
  
  // Check scope map for const value
  if (context.scopeMap.has(name)) {
    const value = context.scopeMap.get(name);
    context.cache.set(name, value);
    return { value, confidence: 'STATIC' };
  }
  
  // Check lexical scope (if provided by Babel traversal)
  if (scope?.getBinding) {
    const binding = scope.getBinding(name);
    if (binding && binding.kind === 'const' && binding.path?.node?.init) {
      context.resolving.add(name);
      const resolved = resolveStaticString(binding.path.node.init, context, depth + 1, binding.path.scope || scope);
      context.resolving.delete(name);
      if (!resolved.unresolvedReason) {
        context.cache.set(name, resolved.value);
        return resolved;
      }
      return unresolved(resolved.unresolvedReason, resolved.detail);
    }
  }
  
  // Not in scope → dynamic
  return unresolved('dynamic_identifier', name);
}

/**
 * Resolve array expression (for routing arrays like ['/users', id])
 */
function resolveArrayExpression(node, context, depth, scope) {
  const elements = [];
  
  for (const elem of node.elements) {
    if (!elem) {
      // Sparse array or null element
      return unresolved('dynamic_array');
    }
    
    if (elem.type === 'SpreadElement') {
      return unresolved('dynamic_array');
    }
    
    const resolved = resolveStaticString(elem, context, depth + 1, scope);
    if (resolved.unresolvedReason) {
      return unresolved('dynamic_array', resolved.unresolvedReason);
    }
    
    elements.push(resolved.value);
  }
  
  return { value: elements, confidence: 'STATIC', isArray: true };
}

/**
 * Helper: Resolve a node to static string or return null
 * Convenience wrapper that returns null instead of unresolved object
 */
export function tryResolveStaticString(node, ast) {
  if (!node || !ast) return null;
  
  try {
    const scopeMap = buildScopeMap(ast);
    const context = new ResolutionContext(ast, scopeMap);
    const result = resolveStaticString(node, context);
    
    if (result.unresolvedReason) {
      return null;
    }
    
    return result.value;
  } catch (error) {
    // Resolution failed (likely bounds exceeded)
    return null;
  }
}

/**
 * Helper: Join array result into a path string
 * For Angular/routing arrays like ['/users', '123'] → '/users/123'
 */
export function joinArrayToPath(arrayValue) {
  if (!Array.isArray(arrayValue)) return arrayValue;
  
  // Filter out empty strings and join with /
  const segments = arrayValue.filter(s => s && s !== '');
  if (segments.length === 0) return '/';
  
  // If first segment starts with /, use it as base
  const firstSegment = segments[0];
  if (firstSegment.startsWith('/')) {
    return segments.join('/').replace(/\/+/g, '/');
  }
  
  // Otherwise, prepend /
  return '/' + segments.join('/').replace(/\/+/g, '/');
}
