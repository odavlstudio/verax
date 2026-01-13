import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { 
  mapImpactLevel, 
  mapUserRisk, 
  mapOwnership,
  generateGroupingMetadata,
  enrichFindingWithSignals
} from '../src/verax/detect/signal-mapper.js';

test('mapImpactLevel - navigation failure on critical route is HIGH', () => {
  const finding = {
    type: 'navigation_silent_failure',
    confidence: { level: 'HIGH' },
    interaction: { type: 'link' },
    evidence: {
      beforeUrl: 'http://localhost/'
    }
  };
  const manifest = {
    routes: [{ path: '/', sourceRef: 'index.ts:1' }],
    staticExpectations: [
      { type: 'navigation', fromPath: '/', targetPath: '/about', sourceRef: 'home.vue:10' }
    ]
  };
  
  const impact = mapImpactLevel(finding, manifest);
  assert.equal(impact, 'HIGH', 'Navigation failure on critical route should be HIGH impact');
});

test('mapImpactLevel - accessibility failures are always HIGH', () => {
  const finding = {
    type: 'focus_silent_failure',
    confidence: { level: 'MEDIUM' },
    interaction: { type: 'button' }
  };
  const manifest = { routes: [], staticExpectations: [] };
  
  const impact = mapImpactLevel(finding, manifest);
  assert.equal(impact, 'HIGH', 'Accessibility failures should always be HIGH impact');
});

test('mapImpactLevel - hover failure is LOW', () => {
  const finding = {
    type: 'hover_silent_failure',
    confidence: { level: 'MEDIUM' },
    interaction: { type: 'button' }
  };
  const manifest = { routes: [], staticExpectations: [] };
  
  const impact = mapImpactLevel(finding, manifest);
  assert.equal(impact, 'LOW', 'Hover failures should be LOW impact');
});

test('mapImpactLevel - network failure on non-critical route is LOW', () => {
  const finding = {
    type: 'network_silent_failure',
    confidence: { level: 'MEDIUM' },
    interaction: { type: 'button' }
  };
  const manifest = {
    routes: [{ path: '/other', sourceRef: 'other.ts:1' }],
    staticExpectations: []
  };
  
  const impact = mapImpactLevel(finding, manifest);
  assert.equal(impact, 'LOW', 'Network failure on non-critical route should be LOW impact');
});

test('mapImpactLevel - loading stuck failure is HIGH', () => {
  const finding = {
    type: 'loading_stuck_silent_failure',
    confidence: { level: 'MEDIUM' },
    interaction: { type: 'form' }
  };
  const manifest = { routes: [], staticExpectations: [] };
  
  const impact = mapImpactLevel(finding, manifest);
  assert.equal(impact, 'HIGH', 'Loading stuck failures should be HIGH impact');
});

test('mapUserRisk - navigation failure BLOCKS user', () => {
  const finding = {
    type: 'navigation_silent_failure',
    interaction: { type: 'link' }
  };
  
  const risk = mapUserRisk(finding);
  assert.equal(risk, 'BLOCKS', 'Navigation failures should BLOCKS user');
});

test('mapUserRisk - feedback gap CONFUSES user', () => {
  const finding = {
    type: 'feedback_gap_silent_failure',
    interaction: { type: 'button' }
  };
  
  const risk = mapUserRisk(finding);
  assert.equal(risk, 'CONFUSES', 'Feedback gap failures should CONFUSES user');
});

test('mapUserRisk - focus failure DEGRADES experience', () => {
  const finding = {
    type: 'focus_silent_failure',
    interaction: { type: 'button' }
  };
  
  const risk = mapUserRisk(finding);
  assert.equal(risk, 'DEGRADES', 'Focus failures should DEGRADES experience');
});

test('mapUserRisk - hover failure DEGRADES experience', () => {
  const finding = {
    type: 'hover_silent_failure',
    interaction: { type: 'button' }
  };
  
  const risk = mapUserRisk(finding);
  assert.equal(risk, 'DEGRADES', 'Hover failures should DEGRADES experience');
});

test('mapOwnership - focus failure is ACCESSIBILITY', () => {
  const finding = {
    type: 'focus_silent_failure',
    interaction: { type: 'button' }
  };
  const trace = {
    sensors: {
      focus: { before: {}, after: {} }
    }
  };
  
  const ownership = mapOwnership(finding, trace);
  assert.equal(ownership, 'ACCESSIBILITY', 'Focus failures should be ACCESSIBILITY ownership');
});

test('mapOwnership - aria failure is ACCESSIBILITY', () => {
  const finding = {
    type: 'aria_announce_silent_failure',
    interaction: { type: 'form' }
  };
  const trace = {
    sensors: {
      aria: { before: {}, after: {} }
    }
  };
  
  const ownership = mapOwnership(finding, trace);
  assert.equal(ownership, 'ACCESSIBILITY', 'ARIA failures should be ACCESSIBILITY ownership');
});

test('mapOwnership - loading stuck is PERFORMANCE', () => {
  const finding = {
    type: 'loading_stuck_silent_failure',
    interaction: { type: 'button' }
  };
  const trace = {
    sensors: {
      timing: { feedbackDelayMs: 5000 },
      loading: { hasLoadingIndicators: true }
    }
  };
  
  const ownership = mapOwnership(finding, trace);
  assert.equal(ownership, 'PERFORMANCE', 'Loading stuck failures should be PERFORMANCE ownership');
});

test('mapOwnership - network failure without UI change is BACKEND', () => {
  const finding = {
    type: 'network_silent_failure',
    interaction: { type: 'form' }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 1, failedRequests: 0 },
      uiSignals: { diff: { changed: false } }
    }
  };
  
  const ownership = mapOwnership(finding, trace);
  assert.equal(ownership, 'BACKEND', 'Network failure without UI change should be BACKEND ownership');
});

test('mapOwnership - auth failure is BACKEND', () => {
  const finding = {
    type: 'auth_silent_failure',
    interaction: { type: 'form' }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 1 }
    }
  };
  
  const ownership = mapOwnership(finding, trace);
  assert.equal(ownership, 'BACKEND', 'Auth failures should be BACKEND ownership');
});

test('mapOwnership - navigation failure without network is FRONTEND', () => {
  const finding = {
    type: 'navigation_silent_failure',
    interaction: { type: 'link' }
  };
  const trace = {
    sensors: {}
  };
  
  const ownership = mapOwnership(finding, trace);
  assert.equal(ownership, 'FRONTEND', 'Navigation failure without network should be FRONTEND ownership');
});

test('generateGroupingMetadata - extracts route and feature', () => {
  const finding = {
    type: 'navigation_silent_failure',
    evidence: {
      beforeUrl: 'http://localhost/users/profile'
    }
  };
  const manifest = {
    routes: [{ path: '/users/profile', sourceRef: 'users.ts:1' }],
    staticExpectations: []
  };
  
  const grouping = generateGroupingMetadata(finding, manifest);
  
  assert.equal(grouping.groupByRoute, '/users/profile', 'Should extract route from URL');
  assert.equal(grouping.groupByFailureType, 'navigation_silent_failure', 'Should extract failure type');
  assert.equal(grouping.groupByFeature, 'users', 'Should extract feature from route');
});

test('generateGroupingMetadata - handles missing URL', () => {
  const finding = {
    type: 'network_silent_failure',
    evidence: {}
  };
  const manifest = { routes: [], staticExpectations: [] };
  
  const grouping = generateGroupingMetadata(finding, manifest);
  
  assert.equal(grouping.groupByRoute, '*', 'Should use * for missing route');
  assert.equal(grouping.groupByFailureType, 'network_silent_failure', 'Should extract failure type');
  assert.equal(grouping.groupByFeature, 'unknown', 'Should use unknown for missing feature');
});

test('enrichFindingWithSignals - adds all signals', () => {
  const finding = {
    type: 'navigation_silent_failure',
    confidence: { level: 'HIGH' },
    interaction: { type: 'link' },
    evidence: {
      beforeUrl: 'http://localhost/'
    }
  };
  const trace = {
    sensors: {
      network: { totalRequests: 0 }
    }
  };
  const manifest = {
    routes: [{ path: '/', sourceRef: 'index.ts:1' }],
    staticExpectations: [
      { type: 'navigation', fromPath: '/', targetPath: '/about', sourceRef: 'home.vue:10' }
    ]
  };
  
  const enriched = enrichFindingWithSignals(finding, trace, manifest);
  
  assert.ok(enriched.signals, 'Should have signals object');
  assert.equal(enriched.signals.impact, 'HIGH', 'Should map impact');
  assert.equal(enriched.signals.userRisk, 'BLOCKS', 'Should map user risk');
  assert.ok(['FRONTEND', 'INTEGRATION'].includes(enriched.signals.ownership), 'Should map ownership');
  assert.ok(enriched.signals.grouping, 'Should have grouping metadata');
  assert.equal(enriched.signals.grouping.groupByRoute, '/', 'Should extract route');
});

test('stable grouping - same route produces same groupByRoute', () => {
  const finding1 = {
    type: 'navigation_silent_failure',
    evidence: { beforeUrl: 'http://localhost/users' }
  };
  const finding2 = {
    type: 'network_silent_failure',
    evidence: { beforeUrl: 'http://localhost/users' }
  };
  const manifest = { routes: [], staticExpectations: [] };
  
  const grouping1 = generateGroupingMetadata(finding1, manifest);
  const grouping2 = generateGroupingMetadata(finding2, manifest);
  
  assert.equal(grouping1.groupByRoute, grouping2.groupByRoute, 'Same route should produce same groupByRoute');
  assert.equal(grouping1.groupByFeature, grouping2.groupByFeature, 'Same route should produce same groupByFeature');
});

test('deterministic mapping - same finding produces same signals', () => {
  const finding = {
    type: 'focus_silent_failure',
    confidence: { level: 'MEDIUM' },
    interaction: { type: 'button' }
  };
  const trace = {
    sensors: {
      focus: { before: {}, after: {} }
    }
  };
  const manifest = { routes: [], staticExpectations: [] };
  
  const enriched1 = enrichFindingWithSignals(finding, trace, manifest);
  const enriched2 = enrichFindingWithSignals(finding, trace, manifest);
  
  assert.deepEqual(enriched1.signals, enriched2.signals, 'Same finding should produce same signals');
});
