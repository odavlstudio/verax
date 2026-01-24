/**
 * Wave 9 — Timing Metrics Collector
 *
 * Collects performance metrics throughout the scan pipeline.
 * Metrics are stored in-memory and included in final artifacts.
 *
 * Tracked phases:
 * - parseMs: Time to parse/load page
 * - resolveMs: Time to resolve TS contracts
 * - observeMs: Time to observe interactions
 * - detectMs: Time to detect findings
 * - totalMs: Total scan duration
 */

import { getTimeProvider } from '../../cli/util/support/time-provider.js';

const metrics = {};
let startTime = null;

export function initMetrics() {
  const now = getTimeProvider().now();
  metrics.start = now;
  startTime = now;
}

export function recordMetric(phase, durationMs) {
  if (!metrics[phase]) {
    metrics[phase] = 0;
  }
  metrics[phase] += durationMs;
}

export function getMetrics() {
  const now = getTimeProvider().now();
  return {
    parseMs: metrics.parseMs || 0,
    resolveMs: metrics.resolveMs || 0,
    observeMs: metrics.observeMs || 0,
    detectMs: metrics.detectMs || 0,
    totalMs: startTime ? now - startTime : 0
  };
}

export function clearMetrics() {
  Object.keys(metrics).forEach(k => delete metrics[k]);
  startTime = null;
}



