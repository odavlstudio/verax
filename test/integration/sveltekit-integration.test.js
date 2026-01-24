/**
 *  SvelteKit Framework Parity - Integration Test
 * Category: framework-integration
 * 
 * Purpose: Prove production-grade SvelteKit support end-to-end
 * 
 * Test Coverage:
 * 1. Detection: SvelteKit framework detected with evidence (@sveltejs/kit, svelte.config.js)
 * 2. Learn Extraction: Literal-only extraction from templates and filesystem routes
 *    - Templates: <a href="/path">, goto('/path'), <form action="/path">
 *    - Filesystem: src/routes/+page.svelte → "/", src/routes/about/+page.svelte → "/about"
 * 3. Dynamic Skip: Variables, params ([id]), dynamic segments skipped with explicit counters
 * 4. Determinism: Dual extraction yields identical IDs and stable ordering
 * 5. Observe: Broken navigation in runtime fixture produces finding
 * 6. Support Contract: ProductionReady if all above pass
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import path from 'path';
import _fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock expect for Jest-style assertions
const expect = (actual) => ({
  toContain: (expected) => assert.ok(actual.includes(expected), `Expected "${actual}" to contain "${expected}"`),
  toBe: (expected) => assert.strictEqual(actual, expected),
  toBeDefined: () => assert.ok(actual !== undefined, `Expected value to be defined`),
  toBeGreaterThan: (expected) => assert.ok(actual > expected, `Expected ${actual} to be greater than ${expected}`),
});

const FIXTURE_ROUTES = path.resolve(__dirname, '../fixtures/sveltekit-routes-lite');
const FIXTURE_RUNTIME = path.resolve(__dirname, '../fixtures/sveltekit-runtime-lite');
const CLI_BIN = path.resolve(__dirname, '../../bin/verax.js');

describe(' SvelteKit Framework Parity', () => {
  
  describe('Detection', () => {
    test('should detect SvelteKit framework with evidence', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_ROUTES}"`, { encoding: 'utf8' });
      
      expect(result).toContain('"framework":"sveltekit"');
      expect(result).toContain('"evidence":');
      expect(result).toContain('@sveltejs/kit');
    });
  });
  
  describe('Learn Extraction: Literal-Only', () => {
    test('should extract literal href from templates', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_ROUTES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      const expectations = parsed.expectations || [];
      
      // Static href="/about"
      const aboutExp = expectations.find(e => e.value === '/about' && e.source?.pattern === '<a href>');
      expect(aboutExp).toBeDefined();
      expect(aboutExp.id).toBeDefined(); // deterministic ID
      expect(aboutExp.type).toBe('navigation');
      expect(aboutExp.category).toBe('expectation');
      
      // Static href="/contact"
      const contactExp = expectations.find(e => e.value === '/contact' && e.source?.pattern === '<a href>');
      expect(contactExp).toBeDefined();
      
      // Static href="/pricing"
      const pricingExp = expectations.find(e => e.value === '/pricing' && e.source?.pattern === '<a href>');
      expect(pricingExp).toBeDefined();
    });
    
    test('should extract literal goto() from templates', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_ROUTES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      const expectations = parsed.expectations || [];
      
      // goto('/about')
      const aboutGoto = expectations.find(e => e.value === '/about' && e.source?.pattern === 'goto()');
      expect(aboutGoto).toBeDefined();
      
      // goto('/contact')
      const contactGoto = expectations.find(e => e.value === '/contact' && e.source?.pattern === 'goto()');
      expect(contactGoto).toBeDefined();
    });
    
    test('should extract literal form actions', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_ROUTES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      const expectations = parsed.expectations || [];
      
      // <form action="/submit-form">
      const formExp = expectations.find(e => e.value === '/submit-form' && e.source?.pattern === '<form action>');
      expect(formExp).toBeDefined();
    });
    
    test('should extract filesystem routes', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_ROUTES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      const expectations = parsed.expectations || [];
      
      // src/routes/+page.svelte → "/"
      const homeRoute = expectations.find(e => e.value === '/' && e.kind === 'filesystem-route');
      expect(homeRoute).toBeDefined();
      
      // src/routes/about/+page.svelte → "/about"
      const aboutRoute = expectations.find(e => e.value === '/about' && e.kind === 'filesystem-route');
      expect(aboutRoute).toBeDefined();
      
      // src/routes/contact/+page.svelte → "/contact"
      const contactRoute = expectations.find(e => e.value === '/contact' && e.kind === 'filesystem-route');
      expect(contactRoute).toBeDefined();
    });
  });
  
  describe('Dynamic Skip with Explicit Counters', () => {
    test('should skip dynamic patterns and report counters', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_ROUTES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      
      // Should have skipped counters
      expect(parsed.skipped).toBeDefined();
      expect(parsed.skipped.dynamic).toBeGreaterThan(0); // variables, ternaries, template strings
      expect(parsed.skipped.params).toBeGreaterThan(0); // [id] dynamic route
    });
    
    test('should NOT extract dynamic patterns', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_ROUTES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      const expectations = parsed.expectations || [];
      
      // Should NOT have extracted these dynamic patterns:
      // - href={dynamicPath} (variable)
      // - href={condition ? '/path1' : '/path2'} (ternary)
      // - goto(dynamicPath) (variable)
      // - goto(`/user/${id}`) (template string)
      // - action={getFormAction()} (function call)
      // - src/routes/user/[id]/+page.svelte (dynamic route segment)
      
      const dynamicCount = expectations.filter(e => 
        e.value.includes('dynamic') || 
        e.value.includes('[id]') ||
        e.value.includes('${')
      ).length;
      
      expect(dynamicCount).toBe(0); // no dynamic patterns should be extracted
    });
    
    test('should skip filesystem routes with dynamic segments', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_ROUTES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      const expectations = parsed.expectations || [];
      
      // src/routes/user/[id]/+page.svelte should NOT be extracted
      const userIdRoute = expectations.find(e => 
        (e.value.includes('[id]') || e.value.includes('/user')) && 
        e.kind === 'filesystem-route'
      );
      expect(userIdRoute).toBeUndefined();
    });
  });
  
  describe('Determinism', () => {
    test('should generate identical IDs and stable ordering across dual extraction', () => {
      const result1 = execSync(`node "${CLI_BIN}" learn "${FIXTURE_ROUTES}"`, { encoding: 'utf8' });
      const result2 = execSync(`node "${CLI_BIN}" learn "${FIXTURE_ROUTES}"`, { encoding: 'utf8' });
      
      const parsed1 = JSON.parse(result1);
      const parsed2 = JSON.parse(result2);
      
      const expectations1 = parsed1.expectations || [];
      const expectations2 = parsed2.expectations || [];
      
      // Same count
      expect(expectations1.length).toBe(expectations2.length);
      
      // Identical IDs and ordering
      for (let i = 0; i < expectations1.length; i++) {
        expect(expectations1[i].id).toBe(expectations2[i].id);
        expect(expectations1[i].value).toBe(expectations2[i].value);
        expect(expectations1[i].type).toBe(expectations2[i].type);
      }
      
      // Skip counters should be identical
      expect(parsed1.skipped.dynamic).toBe(parsed2.skipped.dynamic);
      expect(parsed1.skipped.params).toBe(parsed2.skipped.params);
    });
  });
  
  describe('Observe: Broken Navigation Detection', () => {
    test('should detect broken navigation in runtime fixture', () => {
      // Runtime fixture has broken navigation buttons that call preventDefault
      // VERAX should detect these as broken promises
      const result = execSync(`node "${CLI_BIN}" observe "${FIXTURE_RUNTIME}/index.html"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      
      // Should have findings for broken navigation
      const findings = parsed.findings || [];
      expect(findings.length).toBeGreaterThan(0);
      
      // Findings should reference broken navigation paths
      const brokenNavFindings = findings.filter(f => 
        f.path === '/pricing' || f.path === '/help'
      );
      expect(brokenNavFindings.length).toBeGreaterThan(0);
    });
  });
  
  describe('Support Level Contract', () => {
    test('should report ProductionReady support for SvelteKit', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_ROUTES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      
      // If all above tests pass, support level should be ProductionReady
      expect(parsed.supportLevel).toBe('ProductionReady');
      expect(parsed.framework).toBe('sveltekit');
    });
  });
});
