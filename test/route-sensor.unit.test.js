#!/usr/bin/env node
/**
 * Route sensor unit tests
 * 
 * Tests the route sensor's ability to detect SPA navigation
 * via History API and route signatures.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { 
  routeSignatureChanged, 
  hashRouteSignature,
  analyzeRouteTransitions 
} from '../../src/cli/util/observation/route-sensor.js';

describe('Route Sensor Unit Tests', () => {
  test('routeSignatureChanged detects URL change', () => {
    const before = {
      url: 'https://example.com/home',
      path: '/home',
      title: 'Home',
      canonical: null,
      containerFingerprint: '100:50:Hello World'
    };
    
    const after = {
      url: 'https://example.com/about',
      path: '/about',
      title: 'About',
      canonical: null,
      containerFingerprint: '100:50:Hello World'
    };
    
    const changed = routeSignatureChanged(before, after);
    assert.strictEqual(changed, true, 'URL change should be detected');
  });
  
  test('routeSignatureChanged detects path change', () => {
    const before = {
      url: 'https://example.com/',
      path: '/home',
      title: 'App',
      canonical: null,
      containerFingerprint: '100:50:Home Content'
    };
    
    const after = {
      url: 'https://example.com/',
      path: '/about',
      title: 'App',
      canonical: null,
      containerFingerprint: '100:50:About Content'
    };
    
    const changed = routeSignatureChanged(before, after);
    assert.strictEqual(changed, true, 'Path change should be detected');
  });
  
  test('routeSignatureChanged detects title change', () => {
    const before = {
      url: 'https://example.com/',
      path: '/',
      title: 'Home',
      canonical: null,
      containerFingerprint: '100:50:Content'
    };
    
    const after = {
      url: 'https://example.com/',
      path: '/',
      title: 'About',
      canonical: null,
      containerFingerprint: '100:50:Content'
    };
    
    const changed = routeSignatureChanged(before, after);
    assert.strictEqual(changed, true, 'Title change should be detected');
  });
  
  test('routeSignatureChanged detects substantial container change', () => {
    const before = {
      url: 'https://example.com/',
      path: '/',
      title: 'App',
      canonical: null,
      containerFingerprint: '100:50:Content'
    };
    
    const after = {
      url: 'https://example.com/',
      path: '/',
      title: 'App',
      canonical: null,
      containerFingerprint: '200:100:Different Content'
    };
    
    const changed = routeSignatureChanged(before, after);
    assert.strictEqual(changed, true, 'Substantial container change should be detected');
  });
  
  test('routeSignatureChanged ignores minor container changes', () => {
    const before = {
      url: 'https://example.com/',
      path: '/',
      title: 'App',
      canonical: null,
      containerFingerprint: '100:50:Content ABC'
    };
    
    const after = {
      url: 'https://example.com/',
      path: '/',
      title: 'App',
      canonical: null,
      containerFingerprint: '105:52:Content XYZ'
    };
    
    const changed = routeSignatureChanged(before, after);
    assert.strictEqual(changed, false, 'Minor container change should not be detected as route change');
  });
  
  test('hashRouteSignature produces deterministic hash', () => {
    const signature1 = {
      url: 'https://example.com/home',
      path: '/home',
      title: 'Home',
      canonical: null,
      containerFingerprint: '100:50:Hello',
      timestamp: 1234567890
    };
    
    const signature2 = {
      url: 'https://example.com/home',
      path: '/home',
      title: 'Home',
      canonical: null,
      containerFingerprint: '100:50:Hello',
      timestamp: 9876543210 // Different timestamp
    };
    
    const hash1 = hashRouteSignature(signature1);
    const hash2 = hashRouteSignature(signature2);
    
    assert.strictEqual(hash1, hash2, 'Hash must be deterministic (ignore timestamp)');
    assert.strictEqual(hash1.length, 12, 'Hash must be 12 characters');
  });
  
  test('hashRouteSignature changes when content changes', () => {
    const signature1 = {
      url: 'https://example.com/home',
      path: '/home',
      title: 'Home',
      canonical: null,
      containerFingerprint: '100:50:Hello'
    };
    
    const signature2 = {
      url: 'https://example.com/about',
      path: '/about',
      title: 'About',
      canonical: null,
      containerFingerprint: '100:50:Different'
    };
    
    const hash1 = hashRouteSignature(signature1);
    const hash2 = hashRouteSignature(signature2);
    
    assert.notStrictEqual(hash1, hash2, 'Different signatures must produce different hashes');
  });
  
  test('analyzeRouteTransitions detects pushState', () => {
    const transitions = [
      { type: 'pushState', timestamp: 1000, url: 'https://example.com/about' }
    ];
    
    const analysis = analyzeRouteTransitions(transitions);
    
    assert.strictEqual(analysis.hasTransitions, true);
    assert.strictEqual(analysis.pushStateCount, 1);
    assert.strictEqual(analysis.replaceStateCount, 0);
    assert.strictEqual(analysis.popstateCount, 0);
  });
  
  test('analyzeRouteTransitions detects replaceState', () => {
    const transitions = [
      { type: 'replaceState', timestamp: 1000, url: 'https://example.com/home' }
    ];
    
    const analysis = analyzeRouteTransitions(transitions);
    
    assert.strictEqual(analysis.hasTransitions, true);
    assert.strictEqual(analysis.pushStateCount, 0);
    assert.strictEqual(analysis.replaceStateCount, 1);
    assert.strictEqual(analysis.popstateCount, 0);
  });
  
  test('analyzeRouteTransitions detects popstate', () => {
    const transitions = [
      { type: 'popstate', timestamp: 1000, url: 'https://example.com/back' }
    ];
    
    const analysis = analyzeRouteTransitions(transitions);
    
    assert.strictEqual(analysis.hasTransitions, true);
    assert.strictEqual(analysis.pushStateCount, 0);
    assert.strictEqual(analysis.replaceStateCount, 0);
    assert.strictEqual(analysis.popstateCount, 1);
  });
  
  test('analyzeRouteTransitions handles no transitions', () => {
    const analysis = analyzeRouteTransitions([]);
    
    assert.strictEqual(analysis.hasTransitions, false);
    assert.strictEqual(analysis.pushStateCount, 0);
    assert.strictEqual(analysis.replaceStateCount, 0);
    assert.strictEqual(analysis.popstateCount, 0);
  });
  
  test('analyzeRouteTransitions counts multiple transitions', () => {
    const transitions = [
      { type: 'pushState', timestamp: 1000, url: 'https://example.com/about' },
      { type: 'pushState', timestamp: 2000, url: 'https://example.com/contact' },
      { type: 'popstate', timestamp: 3000, url: 'https://example.com/about' },
      { type: 'replaceState', timestamp: 4000, url: 'https://example.com/about-v2' }
    ];
    
    const analysis = analyzeRouteTransitions(transitions);
    
    assert.strictEqual(analysis.hasTransitions, true);
    assert.strictEqual(analysis.pushStateCount, 2);
    assert.strictEqual(analysis.replaceStateCount, 1);
    assert.strictEqual(analysis.popstateCount, 1);
  });
});
