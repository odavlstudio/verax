/**
 * TypeScript AST Node type extensions
 * These extend the base Node type to include properties used by VERAX
 */

import type * as ts from 'typescript';

declare module 'typescript' {
  interface Node {
    attributes?: ts.NodeArray<ts.JSDocAttribute>;
    tagName?: ts.Identifier;
    body?: ts.Node;
    arguments?: ts.NodeArray<ts.Expression>;
    initializer?: ts.Expression;
    expression?: ts.Expression;
    children?: ts.NodeArray<ts.Node>;
  }
  
  namespace ts {
    // Add isFalseKeyword if it doesn't exist (it might be in a different version)
    function isFalseKeyword(node: ts.Node): node is ts.FalseKeyword;
  }
}

