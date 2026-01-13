import { test } from 'node:test';
import assert from 'node:assert';
import { getExpectation } from '../src/verax/detect/expectation-model.js';
import { ExpectationProof } from '../src/verax/shared/expectation-proof.js';

test('getExpectation returns UNKNOWN for SPA without static expectations', () => {
  const manifest = {
    projectType: 'react_spa',
    routes: [
      { path: '/', source: 'App.js', public: true },
      { path: '/about', source: 'App.js', public: true }
    ],
    publicRoutes: ['/', '/about'],
    internalRoutes: []
  };
  
  const interaction = {
    type: 'link',
    selector: 'a#about-link',
    label: 'About'
  };
  
  const beforeUrl = 'http://localhost:3000/';
  
  const result = getExpectation(manifest, interaction, beforeUrl);
  
  assert.strictEqual(result.hasExpectation, false);
  assert.strictEqual(result.proof, ExpectationProof.UNKNOWN_EXPECTATION);
});

test('getExpectation returns PROVEN for static site with matching expectation', () => {
  const manifest = {
    projectType: 'static',
    routes: [
      { path: '/', source: 'index.html', public: true },
      { path: '/about', source: 'about.html', public: true }
    ],
    publicRoutes: ['/', '/about'],
    internalRoutes: [],
    staticExpectations: [
      {
        fromPath: '/',
        type: 'navigation',
        targetPath: '/about',
        proof: ExpectationProof.PROVEN_EXPECTATION,
        evidence: {
          source: 'index.html',
          selectorHint: 'a[href="/about.html"]'
        }
      }
    ]
  };
  
  const interaction = {
    type: 'link',
    selector: 'a[href="/about.html"]',
    label: 'About'
  };
  
  const beforeUrl = 'http://localhost:8080/';
  
  const result = getExpectation(manifest, interaction, beforeUrl);
  
  assert.strictEqual(result.hasExpectation, true);
  assert.strictEqual(result.proof, ExpectationProof.PROVEN_EXPECTATION);
  assert.strictEqual(result.expectedTargetPath, '/about');
  assert.strictEqual(result.expectationType, 'navigation');
});

test('getExpectation returns UNKNOWN when label matches but no static expectation exists', () => {
  const manifest = {
    projectType: 'react_spa',
    routes: [
      { path: '/', source: 'App.js', public: true },
      { path: '/contact', source: 'App.js', public: true }
    ],
    publicRoutes: ['/', '/contact'],
    internalRoutes: []
  };
  
  const interaction = {
    type: 'button',
    selector: 'button#contact-btn',
    label: 'Contact' // This matches route name but should NOT create expectation
  };
  
  const beforeUrl = 'http://localhost:3000/';
  
  const result = getExpectation(manifest, interaction, beforeUrl);
  
  // Wave 0 - TRUTH LOCK: No heuristic matching allowed
  assert.strictEqual(result.hasExpectation, false);
  assert.strictEqual(result.proof, ExpectationProof.UNKNOWN_EXPECTATION);
});

test('getExpectation does not match on label-only for static sites', () => {
  const manifest = {
    projectType: 'static',
    routes: [
      { path: '/', source: 'index.html', public: true },
      { path: '/pricing', source: 'pricing.html', public: true }
    ],
    publicRoutes: ['/', '/pricing'],
    internalRoutes: [],
    staticExpectations: [
      {
        fromPath: '/',
        type: 'navigation',
        targetPath: '/about',
        proof: ExpectationProof.PROVEN_EXPECTATION,
        evidence: {
          source: 'index.html',
          selectorHint: 'a#about-link'
        }
      }
    ]
  };
  
  // This link has "Pricing" label but doesn't match the expectation selector
  const interaction = {
    type: 'link',
    selector: 'a#pricing-link',
    label: 'Pricing'
  };
  
  const beforeUrl = 'http://localhost:8080/';
  
  const result = getExpectation(manifest, interaction, beforeUrl);
  
  // Should not match because selector is different
  assert.strictEqual(result.hasExpectation, false);
  assert.strictEqual(result.proof, ExpectationProof.UNKNOWN_EXPECTATION);
});
