/**
 * PERFORMANCE_HOOKS.js
 * 
 * Lightweight timing instrumentation for Stage 4 performance baseline measurement
 * NO optimization — only measurement and data collection
 * 
 * USAGE:
 * import { measure, report } from './performance-hooks.js'
 * 
 * const result = await measure('operation-name', async () => {
 *   // your code
 *   return result;
 * });
 * 
 * at end: console.log(report());
 */

import { getTimeProvider } from './support/time-provider.js';

const measurements = new Map();

export function measure(name, durationMs, metadata = {}) {
  if (!measurements.has(name)) {
    measurements.set(name, []);
  }
  
  measurements.get(name).push({
    duration: durationMs,
    timestamp: getTimeProvider().now(),
    metadata
  });
}

export function measureAsync(name, asyncFn, metadata = {}) {
  return async (...args) => {
    const start = getTimeProvider().now();
    try {
      const result = await asyncFn(...args);
      const duration = getTimeProvider().now() - start;
      measure(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = getTimeProvider().now() - start;
      measure(`${name}:error`, duration, { ...metadata, error: error.message });
      throw error;
    }
  };
}

export function reportMetrics() {
  const report = {};
  
  for (const [name, samples] of measurements.entries()) {
    const times = samples.map(s => s.duration);
    times.sort((a, b) => a - b);
    
    report[name] = {
      count: times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      median: times[Math.floor(times.length / 2)],
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)]
    };
  }
  
  return report;
}

export function formatReport() {
  const metrics = reportMetrics();
  let output = '\n=== PERFORMANCE METRICS ===\n';
  
  const sorted = Object.entries(metrics)
    .sort((a, b) => b[1].avg - a[1].avg);
  
  for (const [name, stats] of sorted) {
    output += `\n${name}:\n`;
    output += `  Samples: ${stats.count}\n`;
    output += `  Avg:     ${stats.avg.toFixed(2)}ms\n`;
    output += `  Min:     ${stats.min.toFixed(2)}ms\n`;
    output += `  Max:     ${stats.max.toFixed(2)}ms\n`;
    output += `  P95:     ${stats.p95.toFixed(2)}ms\n`;
    output += `  P99:     ${stats.p99.toFixed(2)}ms\n`;
  }
  
  return output;
}

export function clear() {
  measurements.clear();
}
