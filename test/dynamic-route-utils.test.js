import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDynamicRoute,
  normalizeDynamicRoute,
  normalizeTemplateLiteral
} from '../src/verax/shared/dynamic-route-utils.js';

test('isDynamicRoute: detects React Router :param pattern', () => {
  assert.strictEqual(isDynamicRoute('/users/:id'), true);
  assert.strictEqual(isDynamicRoute('/blog/:slug/comments/:id'), true);
  assert.strictEqual(isDynamicRoute('/users'), false);
});

test('isDynamicRoute: detects Next.js [param] pattern', () => {
  assert.strictEqual(isDynamicRoute('/users/[id]'), true);
  assert.strictEqual(isDynamicRoute('/blog/[slug]/comments'), true);
  assert.strictEqual(isDynamicRoute('/api/route'), false);
});

test('isDynamicRoute: detects template literal ${param} pattern', () => {
  assert.strictEqual(isDynamicRoute('/users/${id}'), true);
  assert.strictEqual(isDynamicRoute('/blog/${slug}/comments'), true);
  assert.strictEqual(isDynamicRoute('/static/path'), false);
});

test('normalizeDynamicRoute: converts :id to /1', () => {
  const result = normalizeDynamicRoute('/users/:id');
  assert.ok(result, 'Should return result');
  assert.strictEqual(result.examplePath, '/users/1');
  assert.strictEqual(result.originalPattern, '/users/:id');
  assert.strictEqual(result.isDynamic, true);
});

test('normalizeDynamicRoute: converts [slug] to /example', () => {
  const result = normalizeDynamicRoute('/blog/[slug]');
  assert.ok(result);
  assert.strictEqual(result.examplePath, '/blog/example');
  assert.strictEqual(result.originalPattern, '/blog/[slug]');
});

test('normalizeDynamicRoute: preserves static paths', () => {
  const result = normalizeDynamicRoute('/users');
  assert.strictEqual(result, null);
});

test('normalizeDynamicRoute: handles multiple dynamic segments', () => {
  const result = normalizeDynamicRoute('/users/:userId/posts/:postId');
  assert.ok(result);
  assert.strictEqual(result.examplePath, '/users/1/posts/1');
});

test('normalizeDynamicRoute: converts slug parameter deterministically', () => {
  const result = normalizeDynamicRoute('/blog/[slug]/author/[authorName]');
  assert.ok(result);
  assert.strictEqual(result.examplePath, '/blog/example/author/example');
});

test('normalizeDynamicRoute: numeric pattern → 1', () => {
  const result1 = normalizeDynamicRoute('/users/:id');
  assert.strictEqual(result1.examplePath, '/users/1');
  
  const result2 = normalizeDynamicRoute('/post/:postId');
  assert.strictEqual(result2.examplePath, '/post/1');
});

test('normalizeDynamicRoute: string patterns → example', () => {
  const result1 = normalizeDynamicRoute('/blog/:slug');
  assert.strictEqual(result1.examplePath, '/blog/example');
  
  const result2 = normalizeDynamicRoute('/user/:username');
  assert.strictEqual(result2.examplePath, '/user/example');
});

test('normalizeTemplateLiteral: converts template literal in path', () => {
  const result = normalizeTemplateLiteral('/users/${userId}');
  assert.ok(result);
  assert.strictEqual(result.examplePath, '/users/1');
  assert.strictEqual(result.isDynamic, true);
});

test('normalizeTemplateLiteral: preserves static paths', () => {
  const result = normalizeTemplateLiteral('/users/profile');
  assert.strictEqual(result, null);
});

test('normalizeTemplateLiteral: converts multiple template parameters', () => {
  const result = normalizeTemplateLiteral('/blog/${slug}/author/${authorName}');
  assert.ok(result);
  assert.strictEqual(result.examplePath, '/blog/example/author/example');
});
