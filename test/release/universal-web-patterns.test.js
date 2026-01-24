#!/usr/bin/env node

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClientSideRoutingDetector } from '../../src/cli/util/detection/client-side-routing-detector.js';
import { UIFeedbackPatternDetector } from '../../src/cli/util/detection/ui-feedback-pattern-detector.js';
import { LoadingResolutionDetector } from '../../src/cli/util/detection/loading-resolution-detector.js';

// ============================================================================
// CLIENT-SIDE ROUTING DETECTOR TESTS
// ============================================================================

test('ClientSideRoutingDetector: hash navigation detected', () => {
  const before = 'http://example.com/page';
  const after = 'http://example.com/page#section1';
  const result = ClientSideRoutingDetector.detectHashNavigation(before, after);
  assert.equal(result.hashChanged, true);
  assert.equal(result.beforeHash, '');
  assert.equal(result.afterHash, '#section1');
});

test('ClientSideRoutingDetector: no hash change returns false', () => {
  const before = 'http://example.com/page#section1';
  const after = 'http://example.com/page#section1';
  const result = ClientSideRoutingDetector.detectHashNavigation(before, after);
  assert.equal(result.hashChanged, false);
});

test('ClientSideRoutingDetector: path navigation detected', () => {
  const before = 'http://example.com/products';
  const after = 'http://example.com/products/123';
  const result = ClientSideRoutingDetector.detectPathNavigation(before, after);
  assert.equal(result.pathChanged, true);
  assert.equal(result.beforePath, '/products');
  assert.equal(result.afterPath, '/products/123');
});

test('ClientSideRoutingDetector: query string change detected', () => {
  const before = 'http://example.com/search';
  const after = 'http://example.com/search?q=test';
  const result = ClientSideRoutingDetector.detectPathNavigation(before, after);
  assert.equal(result.queryChanged, true);
  assert.equal(result.beforeQuery, '');
  assert.equal(result.afterQuery, '?q=test');
});

test('ClientSideRoutingDetector: history state changes detected', () => {
  const before = { historyLength: 5 };
  const after = { historyLength: 6 };
  const result = ClientSideRoutingDetector.detectHistoryStateChanges(before, after);
  assert.equal(result.historyStateChanged, true);
  assert.equal(result.historyStateDiff.lengthDiff, 1);
});

test('ClientSideRoutingDetector: graceful null handling', () => {
  const result1 = ClientSideRoutingDetector.detectHashNavigation(null, null);
  assert.equal(result1.hashChanged, false);

  const result2 = ClientSideRoutingDetector.detectPathNavigation(null, null);
  assert.equal(result2.pathChanged, false);

  const result3 = ClientSideRoutingDetector.detectHistoryStateChanges(null, null);
  assert.equal(result3.historyStateChanged, false);
});

test('ClientSideRoutingDetector: comprehensive routing detection', () => {
  const result = ClientSideRoutingDetector.detectAllRouting(
    { historyLength: 5 },
    { historyLength: 6 },
    'http://example.com/page',
    'http://example.com/page#new'
  );
  assert.equal(result.clientSideRoutingDetected, true);
  assert.equal(result.history.historyStateChanged, true);
  assert.equal(result.hash.hashChanged, true);
});

// ============================================================================
// UI FEEDBACK PATTERN DETECTOR TESTS
// ============================================================================

test('UIFeedbackPatternDetector: loading indicators detected in HTML', () => {
  const _before = '<div>Content</div>';
  const after = '<div>Content</div><div aria-busy="true">Loading...</div>';
  const result = UIFeedbackPatternDetector.detectLoadingIndicators(after);
  assert.equal(result.hasLoadingIndicators, true);
});

test('UIFeedbackPatternDetector: progressbar role detected', () => {
  const html = '<div role="progressbar" aria-valuenow="50"></div>';
  const result = UIFeedbackPatternDetector.detectLoadingIndicators(html);
  assert.equal(result.hasLoadingIndicators, true);
});

test('UIFeedbackPatternDetector: spinner class detected', () => {
  const html = '<div class="spinner-icon">Loading...</div>';
  const result = UIFeedbackPatternDetector.detectLoadingIndicators(html);
  assert.equal(result.hasLoadingIndicators, true);
});

test('UIFeedbackPatternDetector: no loading indicators returns false', () => {
  const html = '<div>Content loaded</div>';
  const result = UIFeedbackPatternDetector.detectLoadingIndicators(html);
  assert.equal(result.hasLoadingIndicators, false);
});

test('UIFeedbackPatternDetector: graceful null handling', () => {
  const result1 = UIFeedbackPatternDetector.detectAriaLiveUpdates(null, null);
  assert.equal(result1.ariaLiveUpdated, false);

  const result2 = UIFeedbackPatternDetector.detectAriaRoleAlerts(null, null);
  assert.equal(result2.alertsDetected, false);

  const result3 = UIFeedbackPatternDetector.detectEphemeralDOM(null, null);
  assert.equal(result3.ephemeralChangesDetected, false);
});

test('UIFeedbackPatternDetector: ephemeral DOM patterns detected', () => {
  const before = '<div>Content</div>';
  const after = '<div>Content</div><div style="display:none">Hidden</div>';
  const result = UIFeedbackPatternDetector.detectEphemeralDOM(before, after);
  assert.equal(result.ephemeralChangesDetected, true);
});

test('UIFeedbackPatternDetector: comprehensive pattern detection', () => {
  const before = '<div>Before</div>';
  const after = '<div>Before</div><div role="alert">Error message</div>';
  const result = UIFeedbackPatternDetector.detectAllUIFeedbackPatterns(before, after);
  // Alert detected should trigger uiFeedbackPatternsDetected
  assert.equal(result.uiFeedbackPatternsDetected, true);
});

// ============================================================================
// LOADING RESOLUTION DETECTOR TESTS
// ============================================================================

test('LoadingResolutionDetector: loading start detected', () => {
  const before = '<div>Content</div>';
  const after = '<div>Content</div><div aria-busy="true">Loading...</div>';
  const result = LoadingResolutionDetector.detectLoadingStart(before, after);
  assert.equal(result.loadingStarted, true);
  assert.equal(result.beforeHadLoading, false);
  assert.equal(result.afterHasLoading, true);
});

test('LoadingResolutionDetector: loading resolution detected', () => {
  const before = '<div><div aria-busy="true">Loading...</div></div>';
  const after = '<div>Content loaded</div>';
  const result = LoadingResolutionDetector.detectLoadingResolution(before, after);
  assert.equal(result.loadingResolved, true);
  assert.equal(result.beforeHadLoading, true);
  assert.equal(result.afterHasLoading, false);
});

test('LoadingResolutionDetector: stalled loading detected', () => {
  const before = '<div><div aria-busy="true">Loading...</div></div>';
  const after = '<div><div aria-busy="true">Still loading...</div></div>';
  const result = LoadingResolutionDetector.detectStalledLoading(before, after, false);
  assert.equal(result.loadingStalled, true);
});

test('LoadingResolutionDetector: stalled loading not detected when content changed', () => {
  const before = '<div><div aria-busy="true">Loading...</div></div>';
  const after = '<div><div aria-busy="true">Loading...</div><p>New content</p></div>';
  const result = LoadingResolutionDetector.detectStalledLoading(before, after, true);
  assert.equal(result.loadingStalled, false);
});

test('LoadingResolutionDetector: graceful null handling', () => {
  const result1 = LoadingResolutionDetector.detectLoadingStart(null, null);
  assert.equal(result1.loadingStarted, false);

  const result2 = LoadingResolutionDetector.detectLoadingResolution(null, null);
  assert.equal(result2.loadingResolved, false);

  const result3 = LoadingResolutionDetector.detectStalledLoading(null, null, false);
  assert.equal(result3.loadingStalled, false);
});

test('LoadingResolutionDetector: comprehensive loading state detection', () => {
  const before = '<div>Start</div>';
  const after = '<div>Start</div><div aria-busy="true">Loading...</div>';
  const result = LoadingResolutionDetector.detectLoadingResolutionState(before, after, false);
  assert.equal(result.loadingStateTransition, true);
  assert.equal(result.start.loadingStarted, true);
});

test('LoadingResolutionDetector: deterministic output for identical inputs', () => {
  const before = '<div><div class="spinner">Loading</div></div>';
  const after = '<div><div class="spinner">Loading</div><p>Data</p></div>';

  const result1 = LoadingResolutionDetector.detectStalledLoading(before, after, true);
  const result2 = LoadingResolutionDetector.detectStalledLoading(before, after, true);

  assert.deepEqual(result1, result2);
});

test('LoadingResolutionDetector: no false positives on unrelated HTML changes', () => {
  const before = '<div>Content</div>';
  const after = '<div>Updated Content</div>';
  const result = LoadingResolutionDetector.detectLoadingStart(before, after);
  assert.equal(result.loadingStarted, false);
});




