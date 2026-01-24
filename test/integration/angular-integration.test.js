/**
 *  Angular Framework Parity - Integration Test
 * Category: framework-integration
 * 
 * Purpose: Prove production-grade Angular support end-to-end
 * 
 * Test Coverage:
 * 1. Detection: Angular framework detected with evidence (angular.json, @angular/core)
 * 2. Learn Extraction: Literal-only extraction from templates and TypeScript
 *    - Templates: [routerLink]="/path", [routerLink]="'/path'", [routerLink]="['/a', 'b']"
 *    - TypeScript: router.navigate(['/a', 'b']), router.navigateByUrl('/path')
 *    - Array segment joining: ['/products', 'electronics'] → /products/electronics
 * 3. Dynamic Skip: Variables, params, computed segments skipped with explicit counters
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

const FIXTURE_TEMPLATES = path.resolve(__dirname, '../fixtures/angular-templates-lite');
const FIXTURE_RUNTIME = path.resolve(__dirname, '../fixtures/angular-runtime-lite');
const CLI_BIN = path.resolve(__dirname, '../../bin/verax.js');

describe(' Angular Framework Parity', () => {
  
  describe('Detection', () => {
    test('should detect Angular framework with evidence', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_TEMPLATES}"`, { encoding: 'utf8' });
      
      expect(result).toContain('"framework":"angular"');
      expect(result).toContain('"evidence":');
      expect(result).toContain('angular.json');
    });
  });
  
  describe('Learn Extraction: Literal-Only', () => {
    test('should extract literal routerLink variants from templates', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_TEMPLATES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      const expectations = parsed.expectations || [];
      
      // Static routerLink="/about"
      const aboutExp = expectations.find(e => e.value === '/about' && e.type === 'navigation');
      expect(aboutExp).toBeDefined();
      expect(aboutExp.id).toBeDefined(); // deterministic ID
      expect(aboutExp.category).toBe('expectation');
      
      // Static [routerLink]="'/pricing'"
      const pricingExp = expectations.find(e => e.value === '/pricing' && e.type === 'navigation');
      expect(pricingExp).toBeDefined();
      
      // Static array [routerLink]="['/products', 'electronics']" → should be joined to /products/electronics
      const productsExp = expectations.find(e => e.value === '/products/electronics' && e.type === 'navigation');
      expect(productsExp).toBeDefined();
      expect(productsExp.value).toBe('/products/electronics'); // segments joined
    });
    
    test('should extract literal router.navigate and router.navigateByUrl from TypeScript', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_TEMPLATES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      const expectations = parsed.expectations || [];
      
      // router.navigate(['/checkout', 'confirm']) → should be joined to /checkout/confirm
      const checkoutExp = expectations.find(e => e.value === '/checkout/confirm' && e.type === 'navigation');
      expect(checkoutExp).toBeDefined();
      expect(checkoutExp.value).toBe('/checkout/confirm'); // segments joined
      
      // router.navigateByUrl('/contact')
      const contactExp = expectations.find(e => e.value === '/contact' && e.type === 'navigation');
      expect(contactExp).toBeDefined();
    });
    
    test('should extract literal form actions', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_TEMPLATES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      const expectations = parsed.expectations || [];
      
      // <form action="/submit-form">
      const formExp = expectations.find(e => e.value === '/submit-form' && e.type === 'navigation');
      expect(formExp).toBeDefined();
    });
  });
  
  describe('Dynamic Skip with Explicit Counters', () => {
    test('should skip dynamic patterns and report counters', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_TEMPLATES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      
      // Should have skipped counters
      expect(parsed.skipped).toBeDefined();
      expect(parsed.skipped.dynamic).toBeGreaterThan(0); // variables, ternaries, template strings
      expect(parsed.skipped.params).toBeGreaterThan(0); // routes with :id
      expect(parsed.skipped.computed).toBeGreaterThan(0); // non-literal segments in arrays
    });
    
    test('should NOT extract dynamic patterns', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_TEMPLATES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      const expectations = parsed.expectations || [];
      
      // Should NOT have extracted these dynamic patterns:
      // - [routerLink]="dynamicPath" (variable)
      // - [routerLink]="condition ? '/a' : '/b'" (ternary)
      // - /user/:id (param route)
      // - ['/category', categoryId] (computed segment)
      // - router.navigate(['/user', this.categoryId]) (variable in array)
      // - router.navigateByUrl(`/user/${id}`) (template string)
      
      const dynamicCount = expectations.filter(e => 
        e.value.includes('dynamic') || 
        e.value.includes(':id') ||
        e.value.includes('${')
      ).length;
      
      expect(dynamicCount).toBe(0); // no dynamic patterns should be extracted
    });
  });
  
  describe('Determinism', () => {
    test('should generate identical IDs and stable ordering across dual extraction', () => {
      const result1 = execSync(`node "${CLI_BIN}" learn "${FIXTURE_TEMPLATES}"`, { encoding: 'utf8' });
      const result2 = execSync(`node "${CLI_BIN}" learn "${FIXTURE_TEMPLATES}"`, { encoding: 'utf8' });
      
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
      expect(parsed1.skipped.computed).toBe(parsed2.skipped.computed);
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
    test('should report ProductionReady support for Angular', () => {
      const result = execSync(`node "${CLI_BIN}" learn "${FIXTURE_TEMPLATES}"`, { encoding: 'utf8' });
      const parsed = JSON.parse(result);
      
      // If all above tests pass, support level should be ProductionReady
      expect(parsed.supportLevel).toBe('ProductionReady');
      expect(parsed.framework).toBe('angular');
    });
  });
});
