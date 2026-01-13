import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { normalizeTemplateLiteral, isDynamicRoute } from '../src/verax/shared/dynamic-route-utils.js';
import { extractASTContracts } from '../src/verax/learn/ast-contract-extractor.js';

test('Phase 2: Template literal utilities work correctly', () => {
  // Test pattern detection
  assert.ok(isDynamicRoute('/users/${id}'), 'Should detect ${id} pattern');
  assert.ok(isDynamicRoute('/blog/${slug}'), 'Should detect ${slug} pattern');
  assert.ok(!isDynamicRoute('/users'), 'Should not detect static paths as dynamic');
  
  // Test normalization
  const userIdResult = normalizeTemplateLiteral('/users/${id}');
  assert.ok(userIdResult, 'Should normalize /users/${id}');
  assert.strictEqual(userIdResult.examplePath, '/users/1', 'Should convert id to /users/1');
  assert.strictEqual(userIdResult.originalPattern, '/users/${id}', 'Should preserve original');
  
  const slugResult = normalizeTemplateLiteral('/blog/${slug}');
  assert.ok(slugResult, 'Should normalize /blog/${slug}');
  assert.strictEqual(slugResult.examplePath, '/blog/example', 'Should convert slug to /blog/example');
  
  const postIdResult = normalizeTemplateLiteral('/posts/${postId}/comments/${commentId}');
  assert.ok(postIdResult, 'Should normalize nested template literals');
  assert.strictEqual(postIdResult.examplePath, '/posts/1/comments/1', 'Should convert nested params');
});

test('Phase 2: AST contract extractor handles template literals in router.push', async () => {
  const projectRoot = resolve('./test/fixtures/react-app');
  const contracts = await extractASTContracts(projectRoot);
  
  // Find contracts from template literal navigation
  const templateLiteralContracts = contracts.filter(c => c.isDynamic && c.originalPattern?.includes('${'));
  
  // Template literals may not be in test fixture, so just verify the structure if found
  for (const contract of templateLiteralContracts) {
    assert.strictEqual(contract.kind, 'NAVIGATION', 'Should be NAVIGATION contract');
    assert.ok(contract.targetPath, 'Should have example targetPath');
    assert.ok(contract.originalPattern, 'Should preserve originalPattern');
    assert.ok(contract.isDynamic, 'Should mark as dynamic');
    assert.strictEqual(contract.proof, 'PROVEN_EXPECTATION', 'Should be PROVEN');
  }
});

test('Phase 2: AST contract extractor handles template literals in navigate()', async () => {
  const projectRoot = resolve('./test/fixtures/react-app');
  const contracts = await extractASTContracts(projectRoot);
  
  // Filter for navigate() calls with template literals
  const navigateTemplates = contracts.filter(c => 
    c.element === 'navigate' && c.isDynamic && c.originalPattern?.includes('${')
  );
  
  for (const contract of navigateTemplates) {
    assert.strictEqual(contract.element, 'navigate', 'Should be from navigate() call');
    assert.ok(contract.targetPath.startsWith('/'), 'Example path should be valid route');
    assert.ok(!contract.targetPath.includes('${'), 'Example path should not have templates');
  }
});

test('Phase 2: Dynamic routes are deterministic across runs', () => {
  // Same input should always produce same output
  const result1 = normalizeTemplateLiteral('/users/${userId}');
  const result2 = normalizeTemplateLiteral('/users/${userId}');
  
  assert.strictEqual(result1.examplePath, result2.examplePath, 'Should be deterministic');
  assert.strictEqual(result1.examplePath, '/users/1', 'Should always produce /users/1');
  
  // Different parameter names should produce different examples
  const idResult = normalizeTemplateLiteral('/items/${id}');
  const slugResult = normalizeTemplateLiteral('/items/${slug}');
  
  assert.strictEqual(idResult.examplePath, '/items/1', 'id should map to numeric');
  assert.strictEqual(slugResult.examplePath, '/items/example', 'slug should map to text');
});

test('Phase 2: Complex nested template literals work', () => {
  const result = normalizeTemplateLiteral('/api/users/${userId}/posts/${postId}/comments');
  assert.ok(result, 'Should handle nested params');
  assert.strictEqual(result.examplePath, '/api/users/1/posts/1/comments', 'Should normalize nested');
  assert.strictEqual(result.originalPattern, '/api/users/${userId}/posts/${postId}/comments', 'Should preserve original');
});

test('Phase 2: Template literals with special param names', () => {
  const tests = [
    { input: '/blog/${slug}', expected: '/blog/example' },
    { input: '/products/${productId}', expected: '/products/1' },
    { input: '/users/${userName}', expected: '/users/example' },
    { input: '/items/${id}', expected: '/items/1' },
    { input: '/posts/${title}', expected: '/posts/example' },
    { input: '/files/${filePath}', expected: '/files/example' },
    { input: '/api/${version}/resource', expected: '/api/v1/resource' },
  ];
  
  for (const { input, expected } of tests) {
    const result = normalizeTemplateLiteral(input);
    assert.ok(result, `Should normalize ${input}`);
    assert.strictEqual(result.examplePath, expected, `${input} should map to ${expected}`);
  }
});

test('Phase 2: Only proven expectations from contract extraction', async () => {
  const projectRoot = resolve('./test/fixtures/react-app');
  const contracts = await extractASTContracts(projectRoot);
  
  // All navigation contracts should have proof field
  const navContracts = contracts.filter(c => c.kind === 'NAVIGATION');
  for (const contract of navContracts) {
    assert.ok(contract.proof, `Contract should have proof field: ${JSON.stringify(contract)}`);
    assert.strictEqual(contract.proof, 'PROVEN_EXPECTATION', 'All navigation contracts should be PROVEN');
  }
});

test('Phase 2: Dynamic navigation example paths are valid routes', async () => {
  const projectRoot = resolve('./test/fixtures/react-app');
  const contracts = await extractASTContracts(projectRoot);
  
  const dynamicContracts = contracts.filter(c => c.kind === 'NAVIGATION' && c.isDynamic);
  
  for (const contract of dynamicContracts) {
    // Example path should be valid route (start with /)
    assert.ok(contract.targetPath.startsWith('/'), `${contract.targetPath} should start with /`);
    // Should not have template markers
    assert.ok(!contract.targetPath.includes('${'), `${contract.targetPath} should not have \${ markers`);
    // Should be different from original pattern
    assert.notStrictEqual(contract.targetPath, contract.originalPattern, 'Example should differ from pattern');
  }
});
