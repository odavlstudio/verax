/**
 * Promise Extraction 2.0 - Enhanced AST-Based Extraction
 * 
 * Comprehensive extraction for:
 * - Navigation: Next.js, React Router, Vue Router, Angular, SvelteKit
 * - Network: fetch(), axios, GraphQL, WebSocket with relative URLs
 * - Feedback: toast, modal, notification libraries
 * - State: Redux Toolkit, Zustand, setState
 * 
 * Uses StaticStringResolver for deterministic static value resolution
 */

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import { resolveStaticString, buildScopeMap, joinArrayToPath, ResolutionContext } from './static-string-resolver.js';

const traverse = _traverse.default || _traverse;

/**
 * Extract promises from file content using Promise Extraction 2.0
 * @param {string} content - File content
 * @param {string} filePath - Absolute file path
 * @param {string} relPath - Relative path for reporting
 * @returns {Object} {expectations: Array, skipped: Object}
 */
export function extractPromises2(content, filePath, relPath) {
  const expectations = [];
  const skipped = {
    dynamic_identifier: 0,
    dynamic_template_expr: 0,
    dynamic_call: 0,
    dynamic_array: 0,
    dynamic_member: 0,
    dynamic_conditional: 0,
    dynamic_concat: 0,
    dynamic_logical: 0,
    dynamic_baseurl: 0,
    max_depth_exceeded: 0,
    max_attempts_exceeded: 0,
    unknown_node_type: 0,
    parse_error: 0,
  };
  
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
    
    const scopeMap = buildScopeMap(ast);
    const context = {
      filePath,
      relPath,
      lines: content.split('\n'),
      ast,
      scopeMap,
      imports: trackImports(ast, scopeMap),
    };
    
    traverse(ast, {
      // Navigation: router.push(), navigate(), Link href, router-link, routerLink
      CallExpression(path) {
        extractNavigationCallPromises(path, context, expectations, skipped);
        extractNetworkCallPromises(path, context, expectations, skipped);
        extractFeedbackCallPromises(path, context, expectations, skipped);
        extractStateCallPromises(path, context, expectations, skipped);
      },

      // new WebSocket("ws://...")
      NewExpression(path) {
        extractNetworkCallPromises(path, context, expectations, skipped, { isNewExpression: true });
      },
      
      // JSX: <Link href>, <router-link to>
      JSXElement(path) {
        extractJSXNavigationPromises(path, context, expectations, skipped);
      },
    });
  } catch (error) {
    skipped.parse_error++;
  }
  
  return { expectations, skipped };
}

/**
 * Track imports for context
 */
function trackImports(ast, scopeMap) {
  const imports = {
    // Navigation
    router: new Set(), // next/router, react-router, vue-router
    navigation: new Set(), // useNavigate, useHistory, useRouter
    link: new Set(), // Link components
    vueRouter: new Set(),

    // Network
    axios: new Set(),
    axiosInstance: new Map(), // instance name → baseURL if static

    // Feedback
    toast: new Set(), // react-hot-toast, sonner, chakra toast
    snackbar: new Set(), // notistack enqueueSnackbar
    notification: new Set(), // mantine notifications
    modal: new Set(), // radix, headlessui, dialog hints

    // State
    redux: new Set(),
    zustand: new Set(),
  };

  const resolutionContext = new ResolutionContext(ast, scopeMap);

  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value || '';

      // React Router / Next.js / Vue Router
      if (source.includes('react-router') || source.includes('next/router') || source.includes('next/navigation') || source.includes('vue-router')) {
        path.node.specifiers.forEach((spec) => {
          const name = spec.local.name;
          if (spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportSpecifier') {
            imports.router.add(name);
            if (['useNavigate', 'useHistory', 'useRouter'].includes(spec.imported?.name || name)) {
              imports.navigation.add(name);
            }
            if (['Link', 'RouterLink'].includes(spec.imported?.name || name)) {
              imports.link.add(name);
            }
            if (source.includes('vue-router')) {
              imports.vueRouter.add(name);
            }
          }
        });
      }

      // Axios
      if (source === 'axios' || source.includes('axios')) {
        path.node.specifiers.forEach((spec) => {
          if (spec.type === 'ImportDefaultSpecifier') {
            imports.axios.add(spec.local.name);
          }
        });
      }

      // Toast libraries
      const toastLibs = ['react-hot-toast', 'sonner', 'react-toastify', '@chakra-ui/react'];
      if (toastLibs.some(lib => source.includes(lib))) {
        path.node.specifiers.forEach((spec) => {
          if (spec.local?.name) imports.toast.add(spec.local.name);
        });
      }

      // Snackbar / notification libraries
      const snackbarLibs = ['notistack'];
      if (snackbarLibs.some(lib => source.includes(lib))) {
        path.node.specifiers.forEach((spec) => {
          if (spec.local?.name) imports.snackbar.add(spec.local.name);
        });
      }

      const notificationLibs = ['@mantine/notifications'];
      if (notificationLibs.some(lib => source.includes(lib))) {
        path.node.specifiers.forEach((spec) => {
          if (spec.local?.name) imports.notification.add(spec.local.name);
        });
      }

      // Modal libraries
      const modalLibs = ['@radix-ui/react-dialog', '@headlessui/react', 'react-modal'];
      if (modalLibs.some(lib => source.includes(lib))) {
        path.node.specifiers.forEach((spec) => {
          if (spec.local?.name) imports.modal.add(spec.local.name);
        });
      }

      // Redux Toolkit
      if (source.includes('@reduxjs/toolkit') || source.includes('redux')) {
        path.node.specifiers.forEach((spec) => {
          if (spec.local?.name) imports.redux.add(spec.local.name);
        });
      }

      // Zustand
      if (source.includes('zustand')) {
        path.node.specifiers.forEach((spec) => {
          if (spec.local?.name) imports.zustand.add(spec.local.name);
        });
      }
    },

    // Track axios.create({ baseURL: "..." })
    VariableDeclarator(path) {
      if (path.node.init?.type === 'CallExpression') {
        const callee = path.node.init.callee;
        const calleeObjectName = callee?.object?.name;
        const isAxiosCreate = callee.type === 'MemberExpression' &&
          callee.property?.name === 'create' &&
          calleeObjectName && (calleeObjectName === 'axios' || imports.axios.has(calleeObjectName));

        if (isAxiosCreate) {
          // Check for baseURL in config object
          const args = path.node.init.arguments;
          if (args.length > 0 && args[0].type === 'ObjectExpression') {
            const baseURLProp = args[0].properties.find(
              p => p.key?.name === 'baseURL'
            );
            if (baseURLProp && baseURLProp.value && path.node.id.type === 'Identifier') {
              const resolved = resolveStaticString(baseURLProp.value, resolutionContext, 0, path.scope);
              if (!resolved.unresolvedReason && typeof resolved.value === 'string') {
                imports.axiosInstance.set(path.node.id.name, resolved.value);
              }
            }
          }
        }
      }
    },
  });

  return imports;
}

function incrementSkip(skipped, reason) {
  if (!reason) return;
  skipped[reason] = (skipped[reason] || 0) + 1;
}

/**
 * Extract navigation call promises
 * - router.push(arg), router.replace(arg)
 * - navigate(arg)
 * - this.$router.push(arg)
 * - router.navigate([...])
 * - goto(arg) (SvelteKit)
 */
function extractNavigationCallPromises(path, context, expectations, skipped) {
  const node = path.node;
  const callee = node.callee;
  
  const navMeta = resolveNavigationCallee(callee, context);
  if (!navMeta || node.arguments.length === 0) return;
  
  const arg = node.arguments[0];
  const resolutionContext = new ResolutionContext(context.ast, context.scopeMap);
  const resolved = resolveStaticString(arg, resolutionContext, 0, path.scope);
  
  if (resolved.unresolvedReason) {
    incrementSkip(skipped, resolved.unresolvedReason);
    return;
  }
  
  const loc = node.loc;
  if (!loc) return;
  
  let navValue = resolved.value;
  
  // Handle array results (Angular router.navigate(['/a', 'b']))
  if (resolved.isArray && Array.isArray(resolved.value)) {
    navValue = joinArrayToPath(resolved.value);
  }
  
  const isPathLike = typeof navValue === 'string' && (
    navValue.startsWith('/') || navValue.startsWith('http') || navValue.startsWith('./') || navValue.startsWith('../')
  );
  
  if (!isPathLike) {
    return;
  }
  
  expectations.push({
    category: 'navigation',
    type: 'navigation',
    promise: {
      kind: 'navigate',
      value: navValue,
      method: navMeta.method,
    },
    source: {
      file: context.relPath,
      line: loc.start.line,
      column: loc.start.column,
    },
    selector: null,
    action: 'navigate',
    expectedOutcome: 'navigation',
    confidence: resolved.confidence || 'STATIC',
    confidenceHint: 'high',
    extractionVersion: '2.0',
  });
}

function resolveNavigationCallee(callee, context) {
  const navMethods = new Set(['push', 'replace', 'navigate', 'navigateByUrl']);
  const isRouterName = (name) => !!name && (
    name === 'router' ||
    name === '$router' ||
    context.imports.router.has(name) ||
    context.imports.navigation.has(name) ||
    context.imports.vueRouter.has(name)
  );

  if (!callee) return null;

  if (callee.type === 'MemberExpression') {
    const propName = callee.property?.name || callee.property?.value;
    const objectName = getMemberBaseName(callee.object);

    if (propName && navMethods.has(propName) && isRouterName(objectName)) {
      return { method: propName };
    }
  }

  if (callee.type === 'Identifier') {
    const funcName = callee.name;
    if (funcName === 'navigate' || funcName === 'goto' || context.imports.navigation.has(funcName)) {
      return { method: funcName };
    }
  }

  return null;
}

function getMemberBaseName(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'ThisExpression') return 'this';
  if (node.type === 'MemberExpression') {
    if (node.property?.name) return node.property.name;
    if (node.property?.value) return node.property.value;
  }
  return null;
}

/**
 * Extract JSX navigation promises
 * - <Link href="/path">
 * - <router-link to="/path">
 * - <RouterLink to="/path">
 * - <a [routerLink]="/path"> (Angular in JSX-like templates)
 */
function extractJSXNavigationPromises(path, context, expectations, skipped) {
  const opening = path.node.openingElement;
  const elementName = opening.name.name || opening.name.property?.name;
  
  // Check for Link components or router-link
  const isLinkComponent = elementName === 'Link' || elementName === 'RouterLink' || 
                           elementName === 'router-link' || elementName === 'a';
  
  if (!isLinkComponent) return;
  
  // Look for href or to attribute
  const hrefAttr = opening.attributes.find(
    attr => attr.type === 'JSXAttribute' && ['href', 'to', 'routerLink'].includes(attr.name.name)
  );
  
  if (!hrefAttr || !hrefAttr.value) return;
  
  const resolutionContext = new ResolutionContext(context.ast, context.scopeMap);
  const resolved = resolveStaticString(hrefAttr.value, resolutionContext, 0, path.scope);
  
  if (resolved.unresolvedReason) {
    incrementSkip(skipped, resolved.unresolvedReason);
    return;
  }
  
  const loc = path.node.loc;
  if (!loc) return;
  
  const navValueRaw = resolved.isArray && Array.isArray(resolved.value)
    ? joinArrayToPath(resolved.value)
    : resolved.value;
  
  const isPathLike = typeof navValueRaw === 'string' && (
    navValueRaw.startsWith('/') || navValueRaw.startsWith('http') || navValueRaw.startsWith('./') || navValueRaw.startsWith('../')
  );
  
  if (!isPathLike) return;
  
  expectations.push({
    category: 'navigation',
    type: 'navigation',
    promise: {
      kind: 'navigate',
      value: navValueRaw,
    },
    source: {
      file: context.relPath,
      line: loc.start.line,
      column: loc.start.column,
    },
    selector: `${elementName}[${hrefAttr.name.name}]`,
    action: 'click',
    expectedOutcome: 'navigation',
    confidenceHint: 'high',
    extractionVersion: '2.0',
  });
}

/**
 * Extract network call promises
 * - fetch(url, options)
 * - axios.get/post/put/delete(url)
 * - axios({ url, method })
 * - axiosInstance.get(url) with baseURL resolution
 * - new WebSocket(url)
 */
function extractNetworkCallPromises(path, context, expectations, skipped, { isNewExpression = false } = {}) {
  const node = path.node;
  const callee = node.callee;
  if (!callee) return;
  
  let isNetwork = false;
  let method = 'GET';
  let instanceBaseURL = null;
  let optionsNode = null;
  
  // fetch(url)
  if (!isNewExpression && callee.type === 'Identifier' && callee.name === 'fetch') {
    isNetwork = true;
    // Determine method from second arg if present
    if (node.arguments.length > 1 && node.arguments[1].type === 'ObjectExpression') {
      optionsNode = node.arguments[1];
      const methodProp = optionsNode.properties.find(
        p => (p.key?.name === 'method' || p.key?.value === 'method')
      );
      if (methodProp?.value) {
        const resolutionContext = new ResolutionContext(context.ast, context.scopeMap);
        const resolvedMethod = resolveStaticString(methodProp.value, resolutionContext, 0, path.scope);
        if (!resolvedMethod.unresolvedReason && typeof resolvedMethod.value === 'string') {
          method = resolvedMethod.value.toUpperCase();
        }
      }
    }
  }
  
  // axios.get/post/put/delete(url) or axiosInstance.method(url)
  if (!isNewExpression && callee.type === 'MemberExpression') {
    const objName = callee.object?.name;
    const propName = callee.property?.name || callee.property?.value;
    
    if ((objName === 'axios' || context.imports.axios.has(objName) || context.imports.axiosInstance.has(objName)) &&
        ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(propName)) {
      isNetwork = true;
      method = propName.toUpperCase();
      
      // Check if this is an instance with baseURL
      if (context.imports.axiosInstance.has(objName)) {
        instanceBaseURL = context.imports.axiosInstance.get(objName);
      }
    }
  }
  
  // axios({ url, method })
  if (!isNewExpression && callee.type === 'Identifier' && (callee.name === 'axios' || context.imports.axios.has(callee.name))) {
    if (node.arguments.length > 0 && node.arguments[0].type === 'ObjectExpression') {
      isNetwork = true;
      optionsNode = node.arguments[0];
      const methodProp = optionsNode.properties.find(
        p => (p.key?.name === 'method' || p.key?.value === 'method')
      );
      if (methodProp?.value) {
        const resolutionContext = new ResolutionContext(context.ast, context.scopeMap);
        const resolvedMethod = resolveStaticString(methodProp.value, resolutionContext, 0, path.scope);
        if (!resolvedMethod.unresolvedReason && typeof resolvedMethod.value === 'string') {
          method = resolvedMethod.value.toUpperCase();
        }
      }
    }
  }
  
  // new WebSocket(url)
  if (isNewExpression && callee.type === 'Identifier' && callee.name === 'WebSocket') {
    isNetwork = true;
    method = 'WS';
  }
  
  if (!isNetwork || node.arguments.length === 0) return;
  
  const urlArg = node.arguments[0];
  const resolutionContext = new ResolutionContext(context.ast, context.scopeMap);
  
  // For axios config object, extract url property
  let urlNode = urlArg;
  if (urlArg.type === 'ObjectExpression') {
    const urlProp = urlArg.properties.find(p => p.key?.name === 'url');
    if (urlProp) {
      urlNode = urlProp.value;
      optionsNode = urlArg;
    } else {
      return; // No url property
    }
  }
  
  const resolved = resolveStaticString(urlNode, resolutionContext, 0, path.scope);
  
  if (resolved.unresolvedReason) {
    incrementSkip(skipped, resolved.unresolvedReason);
    return;
  }
  
  const loc = node.loc;
  if (!loc) return;
  
  let rawUrl = resolved.value;
  let effectiveUrl = rawUrl;

  const isRelative = typeof rawUrl === 'string' && !rawUrl.startsWith('http') && !rawUrl.startsWith('ws') && !rawUrl.startsWith('//');

  // Resolve relative URLs with baseURL
  if (instanceBaseURL && rawUrl && isRelative) {
    const normalizedBase = instanceBaseURL.replace(/\/$/, '');
    const normalizedPath = String(rawUrl).replace(/^\//, '');
    effectiveUrl = `${normalizedBase}/${normalizedPath}`;
  }

  // Accept both absolute and relative URLs
  if (typeof effectiveUrl === 'string' && effectiveUrl.length > 0) {
    const isGraphQLEndpoint = looksLikeGraphQL(effectiveUrl);
    const hasGraphQLBody = optionsNode ? containsGraphQLBody(optionsNode, resolutionContext, path.scope) : false;
    const isGraphQL = isGraphQLEndpoint && hasGraphQLBody;
    const isWebSocket = method === 'WS' || effectiveUrl.startsWith('ws://') || effectiveUrl.startsWith('wss://');

    let promiseKind = 'network.request';
    if (isGraphQL) promiseKind = 'network.graphql';
    if (isWebSocket) promiseKind = 'network.ws';

    expectations.push({
      category: 'network',
      type: 'network',
      promise: {
        kind: promiseKind,
        value: effectiveUrl,
        rawUrl,
        effectiveUrl,
        method,
        intent: isGraphQL ? 'graphql' : undefined,
      },
      source: {
        file: context.relPath,
        line: loc.start.line,
        column: loc.start.column,
      },
      selector: null,
      action: 'request',
      expectedOutcome: 'network',
      confidenceHint: 'high',
      extractionVersion: '2.0',
    });
  }
}

function looksLikeGraphQL(urlValue) {
  if (typeof urlValue !== 'string') return false;
  return /graphql/i.test(urlValue);
}

function containsGraphQLBody(optionsNode, resolutionContext, scope) {
  if (!optionsNode || optionsNode.type !== 'ObjectExpression') return false;
  const bodyProp = optionsNode.properties.find((p) => {
    const keyName = p.key?.name || p.key?.value;
    return keyName === 'body' || keyName === 'data';
  });
  if (!bodyProp?.value) return false;

  const bodyValue = bodyProp.value;

  // Direct string body
  const resolvedBody = resolveStaticString(bodyValue, resolutionContext, 0, scope);
  if (!resolvedBody.unresolvedReason && typeof resolvedBody.value === 'string') {
    return resolvedBody.value.includes('query');
  }

  // JSON.stringify({ query: '...' })
  if (bodyValue.type === 'CallExpression' && bodyValue.arguments?.length) {
    const arg = bodyValue.arguments[0];
    if (arg.type === 'ObjectExpression') {
      const queryProp = arg.properties.find((p) => (p.key?.name || p.key?.value) === 'query');
      if (queryProp?.value) {
        const queryResolved = resolveStaticString(queryProp.value, resolutionContext, 0, scope);
        if (!queryResolved.unresolvedReason && typeof queryResolved.value === 'string') {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Extract feedback call promises
 * - toast(), toast.success(), toast.error()
 * - enqueueSnackbar()
 * - notify(), showNotification()
 * - openModal(), setOpen(true)
 */
function extractFeedbackCallPromises(path, context, expectations, skipped) {
  const node = path.node;
  const callee = node.callee;
  
  const feedbackMeta = resolveFeedbackCall(callee, context, node.arguments, path.scope);
  if (!feedbackMeta) return;
  if (!feedbackMeta.importSatisfied) {
    incrementSkip(skipped, 'no_matching_import');
    return;
  }
  
  const loc = node.loc;
  if (!loc) return;
  
  const resolutionContext = new ResolutionContext(context.ast, context.scopeMap);
  let message = null;
  if (node.arguments.length > 0) {
    const resolvedMessage = resolveStaticString(node.arguments[0], resolutionContext, 0, path.scope);
    if (!resolvedMessage.unresolvedReason && typeof resolvedMessage.value === 'string') {
      message = resolvedMessage.value;
    }
  }
  
  const selector = feedbackSelectorFor(feedbackMeta.kind);
  
  expectations.push({
    category: 'feedback',
    type: 'feedback',
    promise: {
      kind: feedbackMeta.kind,
      value: message || feedbackMeta.label,
      intent: 'feedback',
    },
    source: {
      file: context.relPath,
      line: loc.start.line,
      column: loc.start.column,
    },
    selector,
    action: 'observe',
    expectedOutcome: 'feedback',
    evidenceExpectation: 'feedback',
    confidenceHint: 'medium',
    extractionVersion: '2.0',
  });
}

function resolveFeedbackCall(callee, context, args, scope) {
  const hasToastLib = context.imports.toast.size > 0;
  const hasSnackbarLib = context.imports.snackbar.size > 0 || context.imports.notification.size > 0;
  const hasModalLib = context.imports.modal.size > 0;

  // Identifier calls
  if (callee.type === 'Identifier') {
    const name = callee.name;
    if (context.imports.toast.has(name) || name === 'toast') {
      return { kind: 'feedback.toast', label: 'feedback', importSatisfied: hasToastLib || context.imports.toast.has(name) };
    }
    if (name === 'enqueueSnackbar') {
      return { kind: 'feedback.snackbar', label: 'feedback', importSatisfied: hasSnackbarLib };
    }
    if (name === 'notify' || name === 'showNotification') {
      return { kind: 'feedback.notification', label: 'feedback', importSatisfied: hasSnackbarLib }; 
    }
    if ((/^set.*Open$/i.test(name) || name === 'openModal' || name === 'setOpen') && hasModalLib) {
      if (args?.length === 0 || !isTrueLiteral(args[0], context, scope)) return null;
      return { kind: 'feedback.modal', label: 'feedback', importSatisfied: true };
    }
  }

  if (callee.type === 'MemberExpression') {
    const objName = callee.object.name || callee.object.property?.name;
    const propName = callee.property.name || callee.property.value;

    if ((context.imports.toast.has(objName) || objName === '$toast' || objName === 'toast') && (propName || objName)) {
      return { kind: 'feedback.toast', label: 'feedback', importSatisfied: context.imports.toast.size > 0 || objName === '$toast' };
    }

    if (objName === '$notify') {
      return { kind: 'feedback.notification', label: 'feedback', importSatisfied: true };
    }

    if (propName === 'enqueueSnackbar') {
      return { kind: 'feedback.snackbar', label: 'feedback', importSatisfied: hasSnackbarLib };
    }

    if (propName === 'showNotification' || propName === 'notify') {
      return { kind: 'feedback.notification', label: 'feedback', importSatisfied: hasSnackbarLib };
    }

    if ((propName === 'openModal' || propName === 'setOpen' || propName === 'open') && hasModalLib) {
      if (args?.length === 0 || !isTrueLiteral(args[0], context, scope)) return null;
      return { kind: 'feedback.modal', label: 'feedback', importSatisfied: true };
    }
  }

  return null;
}

function isTrueLiteral(node, context, scope) {
  if (!node) return false;
  if (node.type === 'BooleanLiteral') return node.value === true;
  if (node.type === 'NumericLiteral') return node.value === 1;
  if (node.type === 'StringLiteral') return node.value.toLowerCase() === 'true';

  const resolutionContext = new ResolutionContext(context.ast, context.scopeMap);
  const resolved = resolveStaticString(node, resolutionContext, 0, scope);
  if (resolved.unresolvedReason) return false;
  return String(resolved.value).toLowerCase() === 'true' || String(resolved.value) === '1';
}

function feedbackSelectorFor(kind) {
  if (kind === 'feedback.toast') {
    return '[data-sonner-toaster], .Toastify, #toast-root, [role="status"]';
  }
  if (kind === 'feedback.snackbar' || kind === 'feedback.notification') {
    return '[role="alert"], [data-sonner-toaster]';
  }
  if (kind === 'feedback.modal') {
    return '[role="dialog"], [data-state="open"]';
  }
  return null;
}

/**
 * Extract state call promises
 * - dispatch(slice.actions.xyz())
 * - set(...) (Zustand)
 * - this.setState(...)
 * 
 * Only emit if within UI-coupled context (onClick, onSubmit handler)
 */
function extractStateCallPromises(path, context, expectations, _skipped) {
  const node = path.node;
  const callee = node.callee;
  
  let isState = false;
  let stateKind = 'state';
  let actionLabel = 'state mutation';
  
  // dispatch(...)
  if (callee.type === 'Identifier' && callee.name === 'dispatch') {
    isState = true;
    stateKind = 'state.redux';
    actionLabel = describeStateAction(node);
  }
  
  // set(...) - Zustand
  if (callee.type === 'Identifier' && callee.name === 'set' && context.imports.zustand.size > 0) {
    isState = true;
    stateKind = 'state.zustand';
    actionLabel = describeStateAction(node);
  }
  
  // this.setState(...)
  if (callee.type === 'MemberExpression' && 
      callee.object.type === 'ThisExpression' && 
      callee.property.name === 'setState') {
    isState = true;
    stateKind = 'state.react';
    actionLabel = describeStateAction(node);
  }

  if (callee.type === 'MemberExpression' && callee.property?.name === 'dispatch') {
    isState = true;
    stateKind = 'state.redux';
    actionLabel = describeStateAction(node);
  }
  
  if (!isState) return;
  
  // Check if within UI handler context (onClick, onSubmit, etc.)
  if (!isWithinUIHandler(path)) return;
  
  const loc = node.loc;
  if (!loc) return;
  
  expectations.push({
    category: 'state',
    type: 'state-change',
    promise: {
      kind: stateKind,
      value: actionLabel,
    },
    source: {
      file: context.relPath,
      line: loc.start.line,
      column: loc.start.column,
    },
    selector: null,
    action: 'observe',
    expectedOutcome: 'state-change',
    confidenceHint: 'medium',
    extractionVersion: '2.0',
  });
}

function describeStateAction(node) {
  const arg = node.arguments?.[0];
  if (!arg) return 'state mutation';

  if (arg.type === 'StringLiteral') return arg.value;
  if (arg.type === 'CallExpression' && arg.callee?.type === 'MemberExpression') {
    const objectName = arg.callee.object.name || arg.callee.object.property?.name;
    const propName = arg.callee.property?.name || arg.callee.property?.value;
    if (objectName && propName) return `${objectName}.${propName}`;
    if (propName) return propName;
  }
  if (arg.type === 'ObjectExpression') {
    const typeProp = arg.properties.find((p) => (p.key?.name || p.key?.value) === 'type');
    if (typeProp?.value?.type === 'StringLiteral') {
      return typeProp.value.value;
    }
  }
  if (arg.type === 'MemberExpression') {
    const objectName = arg.object.name || arg.object.property?.name;
    const propName = arg.property?.name || arg.property?.value;
    if (objectName && propName) return `${objectName}.${propName}`;
    if (propName) return propName;
  }
  return 'state mutation';
}

function isWithinUIHandler(path) {
  let current = path;
  let depth = 0;
  const uiAttributes = new Set(['onClick', 'onSubmit', 'onChange', 'onInput', 'onPress']);
  while (current && depth < 15) {
    const node = current.node;

    if (node.type === 'JSXAttribute' && uiAttributes.has(node.name?.name)) {
      return true;
    }

    if ((node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') && node.id?.name && /handle|click|submit|change|press|tap/i.test(node.id.name)) {
      return true;
    }

    if (node.type === 'VariableDeclarator' && node.id?.name && /handle|click|submit|change|press|tap/i.test(node.id.name)) {
      return true;
    }

    if (node.type === 'CallExpression' && node.callee?.name === 'addEventListener') {
      return true;
    }

    current = current.parentPath;
    depth++;
  }
  return false;
}
