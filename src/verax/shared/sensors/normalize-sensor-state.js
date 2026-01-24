// @ts-nocheck
/**
 * Canonical sensor state normalization (internal semantics only).
 * Does not alter consumer output shapes; purely classifies sensor inputs.
 */
export const SENSOR_STATE = {
  ABSENT: 'ABSENT',
  FAILED: 'FAILED',
  EMPTY: 'EMPTY',
  PRESENT: 'PRESENT'
};

/**
 * Normalize raw sensor data into a SensorState classification.
 * @param {*} sensorData - Raw sensor data (may be null/undefined/object)
 * @param {Object} options - Normalization options
 * @param {boolean} [options.failed=false] - Whether the capture failed explicitly
 * @param {Error|null} [options.error=null] - Optional error for FAILED state
 * @param {Function} [options.hasData] - Predicate that returns true when sensorData has meaningful data
 * @returns {{ state: 'ABSENT'|'FAILED'|'EMPTY'|'PRESENT', data: *, error: Error|null }}
 */
export function normalizeSensorState(sensorData, options = {}) {
  const { failed = false, error = null, hasData } = options;

  if (failed) {
    return { state: SENSOR_STATE.FAILED, data: sensorData, error: error || null };
  }

  if (sensorData === null || sensorData === undefined) {
    return { state: SENSOR_STATE.ABSENT, data: null, error: null };
  }

  const present = typeof hasData === 'function' ? hasData(sensorData) : defaultHasData(sensorData);
  if (present) {
    return { state: SENSOR_STATE.PRESENT, data: sensorData, error: null };
  }

  return { state: SENSOR_STATE.EMPTY, data: sensorData, error: null };
}

function defaultHasData(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return Boolean(value);
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
}
