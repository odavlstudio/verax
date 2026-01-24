import { Buffer } from 'buffer';

/**
 * PHASE F1 – Evidence size accounting (instrumentation only)
 * 
 * EvidenceSizeTracker is a read-only instrumentation utility that tracks
 * the approximate byte size of evidence incrementally across a VERAX run.
 * 
 * This tracker is SAFE and NON-INVASIVE:
 * - Never throws or crashes
 * - Idempotent (safe to call multiple times)
 * - Approximate byte counting (not exact)
 * - No blocking, no limits, no early exits
 * - Used purely for observability and future budget decisions
 * 
 * Supported evidence types:
 * - screenshots (PNG/JPEG binary data)
 * - network (request/response objects)
 * - console (console message objects)
 * - dom (HTML strings)
 * - json (arbitrary JSON objects)
 * - other (fallback for unknown types)
 */

export class EvidenceSizeTracker {
  constructor() {
    // Phase F1 – Evidence size accounting (instrumentation only)
    this.totalBytes = 0;
    this.byType = {
      screenshots: 0,
      network: 0,
      console: 0,
      dom: 0,
      json: 0,
      other: 0,
    };
  }

  /**
   * Record evidence and accumulate approximate byte size
   * @param {string} type - Evidence type (screenshots, network, console, dom, json, other)
   * @param {*} value - Evidence value (string, Buffer, object, etc)
   * @returns {number} Approximate bytes recorded (0 if unable to compute)
   */
  record(type, value) {
    try {
      // Phase F1 – Evidence size accounting (instrumentation only)
      const bytes = this._approximateBytes(value);
      this.totalBytes += bytes;

      // Normalize type to supported categories
      const normalizedType = this._normalizeType(type);
      this.byType[normalizedType] += bytes;

      return bytes;
    } catch (err) {
      // CONSTITUTIONAL: Never throw. Log silently and continue.
      // Phase F1 – Evidence size accounting (instrumentation only)
      return 0;
    }
  }

  /**
   * Get aggregated statistics
   * @returns {{totalBytes: number, byType: Object}}
   */
  getStats() {
    // Phase F1 – Evidence size accounting (instrumentation only)
    return {
      totalBytes: this.totalBytes,
      byType: { ...this.byType },
    };
  }

  /**
   * Approximate byte size of a value
   * @private
   */
  _approximateBytes(value) {
    if (value === null || value === undefined) {
      return 0;
    }

    // Phase F1 – Evidence size accounting (instrumentation only)
    if (typeof value === 'string') {
      return Buffer.byteLength(value, 'utf8');
    }

    if (Buffer.isBuffer(value)) {
      return value.length;
    }

    if (typeof value === 'object') {
      try {
        const json = JSON.stringify(value);
        return Buffer.byteLength(json, 'utf8');
      } catch {
        // Circular reference or non-serializable object
        return 0;
      }
    }

    // Fallback for other types (numbers, booleans, etc.)
    return 0;
  }

  /**
   * Normalize type to supported categories
   * @private
   */
  _normalizeType(type) {
    // Phase F1 – Evidence size accounting (instrumentation only)
    const normalized = String(type || 'other').toLowerCase().trim();

    const supportedTypes = [
      'screenshots',
      'network',
      'console',
      'dom',
      'json',
    ];

    if (supportedTypes.includes(normalized)) {
      return normalized;
    }

    // Map common aliases
    if (normalized.includes('screenshot') || normalized.includes('screen')) {
      return 'screenshots';
    }
    if (normalized.includes('net') || normalized.includes('request') || normalized.includes('http')) {
      return 'network';
    }
    if (normalized.includes('console') || normalized.includes('log')) {
      return 'console';
    }
    if (normalized.includes('dom') || normalized.includes('html')) {
      return 'dom';
    }
    if (normalized.includes('json')) {
      return 'json';
    }

    return 'other';
  }

  /**
   * Reset all counters (for testing)
   * @private
   */
  _reset() {
    this.totalBytes = 0;
    this.byType = {
      screenshots: 0,
      network: 0,
      console: 0,
      dom: 0,
      json: 0,
      other: 0,
    };
  }
}








